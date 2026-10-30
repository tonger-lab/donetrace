//! AI 复盘 Tauri commands（M4）
//!
//! - analyze_period：四类周期分析，结果按 (type, period_key) 唯一存储，再次分析覆盖
//! - analyze_project：项目复盘，正文落盘为 logs/{project_id}/{date}.md，同日覆盖
//! - list_project_logs / get_project_log：项目复盘日志的读取

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use tauri::State;

use crate::ai::{self, AiError};
use crate::commands::analysis::{collect_period_tasks, AnalysisPeriod, AnalysisReport, AnalysisTask};
use crate::commands::projects::{get_project, project_total, Project};
use crate::commands::settings::load_deepseek_config;
use crate::db::{data_dir, now_iso, Db};
use crate::period::today_key;
use crate::scoring::{
    fmt_score, fmt_work_hours, fmt_work_hours_en, parse_value, value_label, value_label_en,
    TaskValue,
};

/// 周期分析（今日/昨日/本周/上周）专用提示词（中文）
const SYSTEM_PROMPT_PERIOD_ZH: &str = "\
你是「成迹 DoneTrace」的 AI 复盘助手。

成迹 DoneTrace 是一款个人成果记录工具，核心理念是：记录完成、让用户看清自己的来时路、增强自信；并协助用户定期复盘、发现问题。它适用于独立开发者、上班族等脑力工作者，并认为「投入了时间但暂无直接产出」的任务同样值得记录与肯定。

你会收到用户的本期成果记录，包含：
- 任务清单：任务名称、所属项目、任务描述、折算工时（工时已按 1 天 = 8 小时、并结合任务价值加权折算好）；
- 项目情报：项目名称、是否核心项目、项目简介。

重要：工时单位说明——记录中的「1 天」代表 8 个工时，不是自然日的 24 小时。例如「1天2小时30分」= 8 + 2.5 = 10.5 个工时。解读任何天数时请始终按 1 天 = 8 小时换算，不要把它理解成 24 小时。

请基于上述情报：
1. 给出本期分析结论（完成了什么、时间投入的结构如何）；
2. 尝试给出 1-3 条建设性、具体可执行的建议；
3. 语气鼓励但直率，像一个懂行的朋友；
4. 在结尾给予正向鼓励，肯定用户本期的投入；
5. 全文不超过 500 字，使用 Markdown 格式；
6. 尊重「投入了时间但暂无直接产出」的任务，不要否定它们的价值；
7. 始终使用中文回复，即使任务名称或描述中包含其他语言。";

const SYSTEM_PROMPT_PERIOD_EN: &str = "\
You are the AI review assistant for DoneTrace.

DoneTrace is a personal achievement tracker. Its core philosophy: record what has been done, let users see the path they have walked and build confidence, and help them review periodically to spot problems. It serves knowledge workers such as indie developers and office workers, and it believes tasks where \"time was invested but there is no direct output yet\" are equally worth recording and affirming.

You will receive the user's achievement records for this period, including:
- Task list: task name, project, description, and converted work hours (already weighted: 1 day = 8 hours, adjusted by task value);
- Project brief: project name, whether it is a core project, and a short description.

IMPORTANT — work-hour unit: in these records, 1d means 8 work hours, NOT a 24-hour calendar day. For example, 1d 2h 30min = 8 + 2.5 = 10.5 work hours. Always convert days at 8 work hours per day; never treat a day as 24 hours.

Based on this information:
1. Give a conclusion for this period (what was accomplished and how time was structured);
2. Offer 1-3 constructive, concrete, actionable suggestions;
3. Be encouraging but frank, like a knowledgeable friend;
4. End with positive encouragement that affirms the user's effort;
5. Keep the whole reply under 500 words, in Markdown;
6. Respect tasks where time was invested but there is no direct output yet — do not devalue them;
7. Reply entirely in English, even if task names, descriptions, or project names appear in other languages.";

/// 项目复盘专用提示词（中文）
const SYSTEM_PROMPT_PROJECT_ZH: &str = "\
你是「成迹 DoneTrace」的个人复盘教练，用户会把他的项目成果记录交给你分析。

成迹 DoneTrace 是一款个人成果记录工具，核心理念是：记录完成、让用户看清自己的来时路、增强自信；并协助用户定期复盘、发现问题。它认为「投入了时间但暂无直接产出」的任务同样值得记录与肯定。

要求：
1. 语气鼓励但直率，像一个懂行的朋友；
2. 输出三个部分：①本期亮点 ②发现的问题/风险 ③对下一周期的 1-3 条具体可执行建议；
3. 全文不超过 500 字，使用 Markdown 格式；
4. 在结尾给予正向鼓励；
5. 始终使用中文回复，即使任务名称或描述中包含其他语言。";

const SYSTEM_PROMPT_PROJECT_EN: &str = "\
You are the personal review coach of DoneTrace. The user will hand you their project achievement records for analysis.

DoneTrace is a personal achievement tracker. Its core philosophy: record what has been done, let users see the path they have walked and build confidence, and help them review periodically to spot problems. It believes tasks where \"time was invested but there is no direct output yet\" are equally worth recording and affirming.

Requirements:
1. Be encouraging but frank, like a knowledgeable friend;
2. Output three sections: ① highlights of this period ② problems/risks found ③ 1-3 concrete, actionable suggestions for the next cycle;
3. Keep the whole reply under 500 words, in Markdown;
4. End with positive encouragement;
5. Reply entirely in English, even if task names or descriptions appear in other languages.";

/// 判断当前有效语言是否为中文：设置 zh-CN → 是；en → 否；auto → 按操作系统
fn is_zh(conn: &Connection) -> bool {
    let lang = crate::commands::settings::get_setting(conn, crate::commands::settings::KEY_LANG)
        .ok()
        .flatten()
        .unwrap_or_default();
    match lang.as_str() {
        "en" => false,
        "zh-CN" => true,
        _ => sys_locale::get_locale()
            .map(|l| l.to_lowercase().starts_with("zh"))
            .unwrap_or(false),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiLogEntry {
    pub project_id: String,
    pub log_date: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiLogMeta {
    pub log_date: String,
    pub file_path: String,
    pub created_at: String,
}

/// 任务清单涉及项目的简报（名称 / 是否核心 / 简介）
#[derive(Debug, Clone)]
struct ProjectInfo {
    name: String,
    is_core: bool,
    description: String,
}

/// 构造周期复盘上下文：
/// 总览（任务数 + 累计工时）→ 项目情报 → 任务清单（名称/项目/描述/折算工时，不含录入时间与原始分数）
#[allow(clippy::too_many_arguments)]
fn build_period_context(
    period: AnalysisPeriod,
    key: &str,
    tasks: &[AnalysisTask],
    total: f64,
    projects: &[ProjectInfo],
    zh: bool,
) -> String {
    if zh {
        let mut s = format!(
            "# {} 成果记录（{}）\n\n## 总览\n- 完成任务：{} 个\n- 累计工时：{}\n",
            period.label(),
            key,
            tasks.len(),
            fmt_work_hours(total)
        );

        s.push_str("\n## 项目情报\n");
        for p in projects {
            let kind = if p.is_core { "核心项目" } else { "普通项目" };
            let desc = if p.description.trim().is_empty() {
                "（无简介）".to_string()
            } else {
                p.description.trim().to_string()
            };
            s.push_str(&format!("- {}（{}）：{}\n", p.name, kind, desc));
        }

        s.push_str("\n## 任务清单\n");
        for (i, t) in tasks.iter().enumerate() {
            s.push_str(&format!(
                "{}. [{}] {}（工时 {}）",
                i + 1,
                t.task.project_name.as_deref().unwrap_or("未知项目"),
                t.task.name,
                fmt_work_hours(t.task.actual_score)
            ));
            let desc = t.task.description.trim();
            if !desc.is_empty() {
                s.push_str(&format!("\n   描述：{desc}"));
            }
            s.push('\n');
        }
        s
    } else {
        let mut s = format!(
            "# {} Achievement Record ({})\n\n## Overview\n- Tasks completed: {}\n- Work hours: {}\n",
            period.label_en(),
            key,
            tasks.len(),
            fmt_work_hours_en(total)
        );

        s.push_str("\n## Project brief\n");
        for p in projects {
            let kind = if p.is_core { "core project" } else { "regular project" };
            let desc = if p.description.trim().is_empty() {
                "(no description)".to_string()
            } else {
                p.description.trim().to_string()
            };
            s.push_str(&format!("- {} ({kind}): {desc}\n", p.name));
        }

        s.push_str("\n## Task list\n");
        for (i, t) in tasks.iter().enumerate() {
            s.push_str(&format!(
                "{}. [{}] {} (work hours {})",
                i + 1,
                t.task.project_name.as_deref().unwrap_or("Unknown project"),
                t.task.name,
                fmt_work_hours_en(t.task.actual_score)
            ));
            let desc = t.task.description.trim();
            if !desc.is_empty() {
                s.push_str(&format!("\n   Description: {desc}"));
            }
            s.push('\n');
        }
        s
    }
}

fn load_config_or_err(conn: &Connection) -> Result<(String, String, String), AiError> {
    let cfg = load_deepseek_config(conn)?;
    let api_key = cfg.api_key.ok_or(AiError::NoApiKey)?;
    Ok((cfg.base_url, api_key, cfg.model))
}

#[tauri::command]
pub fn analyze_period(
    state: State<'_, Db>,
    period: AnalysisPeriod,
) -> Result<AnalysisReport, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let (base_url, api_key, model) = load_config_or_err(&conn)?;
    let key = period.period_key();
    let mut tasks = collect_period_tasks(&conn, period)?;
    if tasks.is_empty() {
        return Err(AiError::EmptyPeriod);
    }
    let total: f64 = tasks.iter().map(|t| t.task.actual_score).sum();

    // 发送给 AI 的任务清单按完成时间正序（从早到晚），让 AI 按实际执行顺序复盘
    // （collect_period_tasks 为界面展示返回倒序，此处仅翻转 AI 上下文）
    tasks.reverse();

    // 收集任务清单涉及项目的简报
    let mut project_ids: Vec<String> = tasks
        .iter()
        .map(|t| t.task.project_id.clone())
        .collect();
    project_ids.sort();
    project_ids.dedup();
    let mut projects: Vec<ProjectInfo> = Vec::new();
    for pid in &project_ids {
        let info = conn
            .query_row(
                "SELECT name, is_core, description FROM projects WHERE id = ?1",
                [pid],
                |r| {
                    Ok(ProjectInfo {
                        name: r.get(0)?,
                        is_core: r.get::<_, i64>(1)? != 0,
                        description: r.get(2)?,
                    })
                },
            )
            .optional()?;
        if let Some(info) = info {
            projects.push(info);
        }
    }

    let zh = is_zh(&conn);
    let user = build_period_context(period, &key, &tasks, total, &projects, zh);
    let system = if zh {
        SYSTEM_PROMPT_PERIOD_ZH
    } else {
        SYSTEM_PROMPT_PERIOD_EN
    };
    let content = ai::chat(&base_url, &api_key, &model, system, &user)?;
    let now = now_iso();
    conn.execute(
        "INSERT INTO analysis_reports (type, period_key, content, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(type, period_key) DO UPDATE SET content = ?3, created_at = ?4",
        rusqlite::params![period.as_str(), key, content, now],
    )?;
    Ok(AnalysisReport {
        period_key: key,
        content,
        created_at: now,
    })
}

#[tauri::command]
pub fn analyze_project(
    state: State<'_, Db>,
    project_id: String,
) -> Result<AiLogEntry, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let (base_url, api_key, model) = load_config_or_err(&conn)?;
    let project: Project = get_project(&conn, &project_id)?.ok_or(AiError::ProjectNotFound)?;
    let total = project_total(&conn, &project_id)?;

    // 最近 20 条完成记录（SQL 取最新在前；发送给 AI 前翻转为时间正序）
    let mut stmt = conn.prepare(
        "SELECT name, value, score, completed_at FROM tasks
         WHERE project_id = ?1 AND status = 'done' AND completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT 20",
    )?;
    let rows = stmt.query_map([&project_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, String>(3)?,
        ))
    })?;
    let mut recent: Vec<(String, TaskValue, i64, String)> = Vec::new();
    for row in rows {
        let (name, value, score, completed_at) = row?;
        if let Some(v) = parse_value(&value) {
            recent.push((name, v, score, completed_at));
        }
    }
    // 按完成时间正序（从早到晚），让 AI 按实际执行顺序复盘
    recent.reverse();

    let zh = is_zh(&conn);
    let mut user = if zh {
        format!(
            "# 项目「{}」复盘（{}）\n\n## 总览\n- 项目总分：{}\n- 最近完成记录（近 20 条）：{} 条\n",
            project.name,
            today_key(),
            fmt_score(total),
            recent.len()
        )
    } else {
        format!(
            "# Project \"{}\" Review ({})\n\n## Overview\n- Project total score: {}\n- Recent completions (up to 20): {}\n",
            project.name,
            today_key(),
            fmt_score(total),
            recent.len()
        )
    };
    for (name, value, score, _completed_at) in &recent {
        if zh {
            user.push_str(&format!(
                "- {} [{}]（{} 分 → {}）\n",
                name,
                value_label(*value),
                score,
                fmt_score(crate::scoring::actual_score(*score, *value))
            ));
        } else {
            user.push_str(&format!(
                "- {} [{}] ({} pts → {})\n",
                name,
                value_label_en(*value),
                score,
                fmt_score(crate::scoring::actual_score(*score, *value))
            ));
        }
    }
    if recent.is_empty() {
        if zh {
            user.push_str("（暂无完成记录）\n");
        } else {
            user.push_str("(no completed records yet)\n");
        }
    }

    let system = if zh {
        SYSTEM_PROMPT_PROJECT_ZH
    } else {
        SYSTEM_PROMPT_PROJECT_EN
    };
    let content = ai::chat(&base_url, &api_key, &model, system, &user)?;

    // 落盘 log 文件 + 索引（同日再次分析则覆盖）
    let date = today_key();
    let rel = format!("logs/{}/{date}.md", project_id);
    let base = data_dir().map_err(|e| AiError::Request(e.to_string()))?;
    let abs = base.join(&rel);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&abs, &content)?;

    let now = now_iso();
    conn.execute(
        "INSERT INTO ai_logs (project_id, log_date, file_path, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id, log_date) DO UPDATE SET file_path = ?3, created_at = ?4",
        rusqlite::params![project_id, date, rel, now],
    )?;

    Ok(AiLogEntry {
        project_id,
        log_date: date,
        content,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_project_logs(
    state: State<'_, Db>,
    project_id: String,
) -> Result<Vec<AiLogMeta>, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let mut stmt = conn.prepare(
        "SELECT log_date, file_path, created_at FROM ai_logs
         WHERE project_id = ?1 ORDER BY log_date DESC",
    )?;
    let rows = stmt.query_map([project_id], |r| {
        Ok(AiLogMeta {
            log_date: r.get(0)?,
            file_path: r.get(1)?,
            created_at: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

#[tauri::command]
pub fn get_project_log(
    state: State<'_, Db>,
    project_id: String,
    log_date: String,
) -> Result<String, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let rel: Option<String> = conn
        .query_row(
            "SELECT file_path FROM ai_logs WHERE project_id = ?1 AND log_date = ?2",
            rusqlite::params![project_id, log_date],
            |r| r.get(0),
        )
        .optional()?;
    let rel = rel.ok_or(AiError::LogNotFound)?;
    let base = data_dir().map_err(|e| AiError::Request(e.to_string()))?;
    Ok(std::fs::read_to_string(base.join(rel))?)
}
