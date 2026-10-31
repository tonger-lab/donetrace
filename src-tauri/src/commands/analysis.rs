//! 分析模块 Tauri commands（M3）
//!
//! 周期语义（权威实现见 crate::period）：
//! - today / yesterday：按 completed_at 的日期键过滤
//! - week / last_week：ISO 周（周一为起点），按 completed_at 落在周范围过滤
//! - AI 分析结果按 (type, period_key) 唯一存储，由 M4 的 analyze 命令写入

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::tasks::{row_to_task, Task};
use crate::db::Db;
use crate::period;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisPeriod {
    Today,
    Yesterday,
    Week,
    LastWeek,
}

impl AnalysisPeriod {
    pub fn as_str(self) -> &'static str {
        match self {
            AnalysisPeriod::Today => "today",
            AnalysisPeriod::Yesterday => "yesterday",
            AnalysisPeriod::Week => "week",
            AnalysisPeriod::LastWeek => "last_week",
        }
    }

    pub fn period_key(self) -> String {
        match self {
            AnalysisPeriod::Today => period::today_key(),
            AnalysisPeriod::Yesterday => period::yesterday_key(),
            AnalysisPeriod::Week => period::this_week_key(),
            AnalysisPeriod::LastWeek => period::last_week_key(),
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            AnalysisPeriod::Today => "今日",
            AnalysisPeriod::Yesterday => "昨日",
            AnalysisPeriod::Week => "本周",
            AnalysisPeriod::LastWeek => "上周",
        }
    }

    /// 英文标签（AI 提示词本地化用）
    pub fn label_en(self) -> &'static str {
        match self {
            AnalysisPeriod::Today => "Today",
            AnalysisPeriod::Yesterday => "Yesterday",
            AnalysisPeriod::Week => "This Week",
            AnalysisPeriod::LastWeek => "Last Week",
        }
    }
}

/// 分析列表中的任务（项目信息挂在 Task 的 project_name/project_icon 上）
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisTask {
    #[serde(flatten)]
    pub task: Task,
}

/// 按项目分类统计
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStat {
    pub project_id: String,
    pub project_name: String,
    pub project_icon: String,
    pub task_count: i64,
    pub score: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisReport {
    pub period_key: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisData {
    pub period_key: String,
    pub tasks: Vec<AnalysisTask>,
    pub total_score: f64,
    pub task_count: i64,
    pub by_project: Vec<ProjectStat>,
    pub report: Option<AnalysisReport>,
}

#[derive(Debug, thiserror::Error)]
pub enum AnalysisError {
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl Serialize for AnalysisError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

/// 判断完成时间是否落在指定周期内（日期部分字符串比较）
fn in_period(completed_at: &str, period: AnalysisPeriod) -> bool {
    let date = completed_at.get(0..10).unwrap_or("");
    if date.is_empty() {
        return false;
    }
    match period {
        AnalysisPeriod::Today => date == period::today_key(),
        AnalysisPeriod::Yesterday => date == period::yesterday_key(),
        AnalysisPeriod::Week | AnalysisPeriod::LastWeek => {
            match period::week_range(&period.period_key()) {
                Some((start, end)) => {
                    let s = period::date_key(start);
                    let e = period::date_key(end);
                    date >= s.as_str() && date <= e.as_str()
                }
                None => false,
            }
        }
    }
}

/// 收集周期内已完成任务（含项目信息），按完成时间倒序
pub(crate) fn collect_period_tasks(
    conn: &Connection,
    period: AnalysisPeriod,
) -> rusqlite::Result<Vec<AnalysisTask>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.project_id, t.name, t.description, t.value, t.score, t.status,
                t.created_at, t.updated_at, t.completed_at,
                p.name, p.icon
         FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE t.status = 'done' AND t.completed_at IS NOT NULL
         ORDER BY t.completed_at DESC, t.id ASC",
    )?;
    let rows = stmt.query_map([], |r| {
        let mut task = row_to_task(r)?;
        task.project_name = Some(r.get(10)?);
        task.project_icon = Some(r.get(11)?);
        Ok(task)
    })?;

    let mut tasks: Vec<AnalysisTask> = Vec::new();
    for row in rows {
        let task = row?;
        let in_range = task
            .completed_at
            .as_deref()
            .map(|ca| in_period(ca, period))
            .unwrap_or(false);
        if in_range {
            tasks.push(AnalysisTask { task });
        }
    }
    Ok(tasks)
}

#[tauri::command]
pub fn get_analysis(
    state: State<'_, Db>,
    period: AnalysisPeriod,
) -> Result<AnalysisData, AnalysisError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let key = period.period_key();

    let tasks = collect_period_tasks(&conn, period)?;

    // 按项目分类统计（按得分降序）
    let mut by_project: Vec<ProjectStat> = Vec::new();
    for t in &tasks {
        match by_project
            .iter_mut()
            .find(|s| s.project_id == t.task.project_id)
        {
            Some(stat) => {
                stat.task_count += 1;
                stat.score += t.task.actual_score;
            }
            None => by_project.push(ProjectStat {
                project_id: t.task.project_id.clone(),
                project_name: t.task.project_name.clone().unwrap_or_default(),
                project_icon: t.task.project_icon.clone().unwrap_or_default(),
                task_count: 1,
                score: t.task.actual_score,
            }),
        }
    }
    by_project.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let total_score: f64 = tasks.iter().map(|t| t.task.actual_score).sum();

    // 已有 AI 分析结果（若有）
    let report = conn
        .query_row(
            "SELECT period_key, content, created_at FROM analysis_reports
             WHERE type = ?1 AND period_key = ?2",
            rusqlite::params![period.as_str(), key],
            |r| {
                Ok(AnalysisReport {
                    period_key: r.get(0)?,
                    content: r.get(1)?,
                    created_at: r.get(2)?,
                })
            },
        )
        .optional()?;

    Ok(AnalysisData {
        period_key: key,
        task_count: tasks.len() as i64,
        tasks,
        total_score,
        by_project,
        report,
    })
}
