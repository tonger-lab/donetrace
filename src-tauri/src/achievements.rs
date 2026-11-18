//! 系统成就（免费功能，desktop/）：27 个内置里程碑成就，四类梯度。
//!
//! 设计依据：系统成就设计 v1.0（2026-11-03 拍板）
//! - 成就页双分区：个人成就（已上线项目，AchievementsPage 现有）+ 系统成就（本模块）
//! - 梯度：任务数 1/10/50/100/500/1000；累计小时 1/10/50/100/500/1000；
//!   连续天数仅 3/5 天（不鼓励连续工作不休息）；AI 复盘 1/10/50/100；
//!   单日总分数 480/576/720/960（不按任务数，防拆任务刷成就）
//! - 无成就分；不回滚（撤销/删除不回收）；进度实时聚合不落库；
//!   解锁记录写入 `system_achievements`（迁移 V11），随备份导出/导入
//! - 触发：启动静默补发（不通知）、完成任务/项目上线/标记核心/生成 AI 复盘
//!   即时评估并广播 `achievements://unlocked` 事件（右下角 toast）；
//!   备份导入完成后静默补发
//!
//! 红线：成就只依赖聚合数字，分享物不含任务名/项目名/描述/AI 复盘内容。

use std::collections::{HashMap, HashSet};

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use tauri::{Emitter, State};

use crate::db::{now_iso, Db};
use crate::period::date_key;
use crate::scoring::{actual_score, parse_value, TaskValue};

/// 成就类别（前端按此分组展示，顺序即展示顺序）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Category {
    Start,
    Milestone,
    Habit,
    Depth,
}

impl Category {
    pub fn as_str(self) -> &'static str {
        match self {
            Category::Start => "start",
            Category::Milestone => "milestone",
            Category::Habit => "habit",
            Category::Depth => "depth",
        }
    }
}

/// 进度类型（前端据此选择 i18n 文案模板与数值格式）
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    /// 计数类：{current} / {target}
    Count,
    /// 累计小时：{current} / {target} 小时（<10 保留 1 位小数）
    Hours,
    /// 连续天数：当前连续 {current} / {target} 天
    Days,
    /// 单日最高总分数
    Score,
    /// AI 复盘次数
    Reviews,
    /// 二值成就（first_critical / first_live / first_review / first_core）：无进度条
    Binary,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Count => "count",
            Kind::Hours => "hours",
            Kind::Days => "days",
            Kind::Score => "score",
            Kind::Reviews => "reviews",
            Kind::Binary => "binary",
        }
    }
}

/// 成就条件评估所需的一次性聚合统计
#[derive(Debug, Default)]
pub struct Stats {
    pub done_count: i64,
    pub done_score: f64,
    pub critical_count: i64,
    pub important_critical_count: i64,
    pub live_count: i64,
    pub core_count: i64,
    pub review_count: i64,
    pub streak_days: i64,
    pub best_day_score: f64,
}

/// 成就定义（静态表：id 稳定 snake_case，改文案不动 id）
pub struct Def {
    pub id: &'static str,
    pub category: Category,
    pub icon: &'static str,
    pub kind: Kind,
    /// 条件是否满足（基于聚合 Stats 的纯函数）
    pub check: fn(&Stats) -> bool,
    /// 进度展示（当前, 目标）；二值成就返回 None
    pub progress: fn(&Stats) -> Option<(f64, f64)>,
}

/// 27 个成就的权威定义（顺序即成就页展示顺序：类别 → 阈值递增）
pub const DEFS: &[Def] = &[
    // ---------- 起步（7） ----------
    Def {
        id: "first_task",
        category: Category::Start,
        icon: "🚀",
        kind: Kind::Count,
        check: |s| s.done_count >= 1,
        progress: |s| Some((s.done_count as f64, 1.0)),
    },
    Def {
        id: "ten_tasks",
        category: Category::Start,
        icon: "✨",
        kind: Kind::Count,
        check: |s| s.done_count >= 10,
        progress: |s| Some((s.done_count as f64, 10.0)),
    },
    Def {
        id: "one_hour",
        category: Category::Start,
        icon: "🕐",
        kind: Kind::Hours,
        check: |s| s.done_score >= 60.0,
        progress: |s| Some((s.done_score / 60.0, 1.0)),
    },
    Def {
        id: "first_critical",
        category: Category::Start,
        icon: "🎯",
        kind: Kind::Binary,
        check: |s| s.critical_count >= 1,
        progress: |_| None,
    },
    Def {
        id: "first_live",
        category: Category::Start,
        icon: "🛫",
        kind: Kind::Binary,
        check: |s| s.live_count >= 1,
        progress: |_| None,
    },
    Def {
        id: "first_review",
        category: Category::Start,
        icon: "🔍",
        kind: Kind::Binary,
        check: |s| s.review_count >= 1,
        progress: |_| None,
    },
    Def {
        id: "streak_3",
        category: Category::Start,
        icon: "🌱",
        kind: Kind::Days,
        check: |s| s.streak_days >= 3,
        progress: |s| Some((s.streak_days as f64, 3.0)),
    },
    // ---------- 里程碑（10） ----------
    Def {
        id: "fifty_tasks",
        category: Category::Milestone,
        icon: "📚",
        kind: Kind::Count,
        check: |s| s.done_count >= 50,
        progress: |s| Some((s.done_count as f64, 50.0)),
    },
    Def {
        id: "hundred_tasks",
        category: Category::Milestone,
        icon: "💯",
        kind: Kind::Count,
        check: |s| s.done_count >= 100,
        progress: |s| Some((s.done_count as f64, 100.0)),
    },
    Def {
        id: "ten_hours",
        category: Category::Milestone,
        icon: "🕙",
        kind: Kind::Hours,
        check: |s| s.done_score >= 600.0,
        progress: |s| Some((s.done_score / 60.0, 10.0)),
    },
    Def {
        id: "fifty_hours",
        category: Category::Milestone,
        icon: "⏳",
        kind: Kind::Hours,
        check: |s| s.done_score >= 3_000.0,
        progress: |s| Some((s.done_score / 60.0, 50.0)),
    },
    Def {
        id: "hundred_hours",
        category: Category::Milestone,
        icon: "🕰️",
        kind: Kind::Hours,
        check: |s| s.done_score >= 6_000.0,
        progress: |s| Some((s.done_score / 60.0, 100.0)),
    },
    Def {
        id: "ten_reviews",
        category: Category::Milestone,
        icon: "🤖",
        kind: Kind::Reviews,
        check: |s| s.review_count >= 10,
        progress: |s| Some((s.review_count as f64, 10.0)),
    },
    Def {
        id: "fifty_reviews",
        category: Category::Milestone,
        icon: "📈",
        kind: Kind::Reviews,
        check: |s| s.review_count >= 50,
        progress: |s| Some((s.review_count as f64, 50.0)),
    },
    Def {
        id: "fifty_important",
        category: Category::Milestone,
        icon: "🌟",
        kind: Kind::Count,
        check: |s| s.important_critical_count >= 50,
        progress: |s| Some((s.important_critical_count as f64, 50.0)),
    },
    Def {
        id: "five_live",
        category: Category::Milestone,
        icon: "🚀",
        kind: Kind::Count,
        check: |s| s.live_count >= 5,
        progress: |s| Some((s.live_count as f64, 5.0)),
    },
    Def {
        id: "first_core",
        category: Category::Milestone,
        icon: "⭐",
        kind: Kind::Binary,
        check: |s| s.core_count >= 1,
        progress: |_| None,
    },
    // ---------- 习惯（5） ----------
    Def {
        id: "streak_5",
        category: Category::Habit,
        icon: "🔥",
        kind: Kind::Days,
        check: |s| s.streak_days >= 5,
        progress: |s| Some((s.streak_days as f64, 5.0)),
    },
    Def {
        id: "day_480",
        category: Category::Habit,
        icon: "⚡",
        kind: Kind::Score,
        check: |s| s.best_day_score >= 480.0,
        progress: |s| Some((s.best_day_score, 480.0)),
    },
    Def {
        id: "day_576",
        category: Category::Habit,
        icon: "🌊",
        kind: Kind::Score,
        check: |s| s.best_day_score >= 576.0,
        progress: |s| Some((s.best_day_score, 576.0)),
    },
    Def {
        id: "day_720",
        category: Category::Habit,
        icon: "☀️",
        kind: Kind::Score,
        check: |s| s.best_day_score >= 720.0,
        progress: |s| Some((s.best_day_score, 720.0)),
    },
    Def {
        id: "day_960",
        category: Category::Habit,
        icon: "🏃",
        kind: Kind::Score,
        check: |s| s.best_day_score >= 960.0,
        progress: |s| Some((s.best_day_score, 960.0)),
    },
    // ---------- 深度（5） ----------
    Def {
        id: "five_hundred_tasks",
        category: Category::Depth,
        icon: "🏅",
        kind: Kind::Count,
        check: |s| s.done_count >= 500,
        progress: |s| Some((s.done_count as f64, 500.0)),
    },
    Def {
        id: "thousand_tasks",
        category: Category::Depth,
        icon: "👑",
        kind: Kind::Count,
        check: |s| s.done_count >= 1_000,
        progress: |s| Some((s.done_count as f64, 1_000.0)),
    },
    Def {
        id: "five_hundred_hours",
        category: Category::Depth,
        icon: "🗻",
        kind: Kind::Hours,
        check: |s| s.done_score >= 30_000.0,
        progress: |s| Some((s.done_score / 60.0, 500.0)),
    },
    Def {
        id: "thousand_hours",
        category: Category::Depth,
        icon: "🏔️",
        kind: Kind::Hours,
        check: |s| s.done_score >= 60_000.0,
        progress: |s| Some((s.done_score / 60.0, 1_000.0)),
    },
    Def {
        id: "hundred_reviews",
        category: Category::Depth,
        icon: "🧠",
        kind: Kind::Reviews,
        check: |s| s.review_count >= 100,
        progress: |s| Some((s.review_count as f64, 100.0)),
    },
];

// ---------- 统计聚合 ----------

/// 连续天数：今天尚未完成任务时从昨天开始往前数（今天不完成不判断签）；
/// 已完成则从今天数；自然日相邻判定（本地时区）。
fn compute_streak(days: &HashSet<String>) -> i64 {
    let today = chrono::Local::now().date_naive();
    let mut anchor = today;
    if !days.contains(&date_key(today)) {
        anchor = today - chrono::Duration::days(1);
    }
    let mut n = 0;
    let mut d = anchor;
    while days.contains(&date_key(d)) {
        n += 1;
        d -= chrono::Duration::days(1);
    }
    n
}

/// 聚合全部成就条件的统计（进度口径：completed_at 前 10 位 = 本地日期）
pub fn collect_stats(conn: &Connection) -> rusqlite::Result<Stats> {
    let done_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE status = 'done'",
        [],
        |r| r.get(0),
    )?;
    let critical_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE status = 'done' AND value = 'critical'",
        [],
        |r| r.get(0),
    )?;
    let important_critical_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE status = 'done' AND value IN ('important','critical')",
        [],
        |r| r.get(0),
    )?;
    let live_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM projects WHERE status = 'live'",
        [],
        |r| r.get(0),
    )?;
    let core_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM projects WHERE is_core = 1", [], |r| {
            r.get(0)
        })?;
    let review_count: i64 =
        conn.query_row("SELECT COUNT(*) FROM analysis_reports", [], |r| r.get(0))?;

    let mut done_score = 0.0f64;
    let mut best_day: HashMap<String, f64> = HashMap::new();
    let mut days: HashSet<String> = HashSet::new();
    {
        let mut stmt = conn.prepare(
            "SELECT value, score, substr(completed_at, 1, 10) FROM tasks
             WHERE status = 'done' AND completed_at IS NOT NULL",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, i64>(1)?,
                r.get::<_, String>(2)?,
            ))
        })?;
        for row in rows {
            let (value, score, day) = row?;
            let v = parse_value(&value).unwrap_or(TaskValue::Normal);
            let s = actual_score(score, v);
            done_score += s;
            *best_day.entry(day.clone()).or_insert(0.0) += s;
            days.insert(day);
        }
    }
    let best_day_score = best_day.values().cloned().fold(0.0f64, f64::max);
    let streak_days = compute_streak(&days);

    Ok(Stats {
        done_count,
        done_score,
        critical_count,
        important_critical_count,
        live_count,
        core_count,
        review_count,
        streak_days,
        best_day_score,
    })
}

// ---------- 评估与解锁 ----------

/// 评估全部成就：满足条件且未解锁的立即写入解锁记录（unlocked_at = 当前时刻），
/// 返回本次新解锁 id 列表。已解锁的永不重复写入（幂等），数据减少不回滚。
pub fn evaluate(conn: &Connection) -> rusqlite::Result<Vec<String>> {
    let stats = collect_stats(conn)?;
    let mut new_ids: Vec<String> = Vec::new();
    for def in DEFS {
        if (def.check)(&stats) {
            let exists: bool = conn
                .query_row(
                    "SELECT 1 FROM system_achievements WHERE id = ?1",
                    [def.id],
                    |_| Ok(true),
                )
                .optional()?
                .unwrap_or(false);
            if !exists {
                conn.execute(
                    "INSERT INTO system_achievements (id, unlocked_at) VALUES (?1, ?2)",
                    rusqlite::params![def.id, now_iso()],
                )?;
                new_ids.push(def.id.to_string());
            }
        }
    }
    Ok(new_ids)
}

/// 前端 toast 事件载荷：一条新解锁成就（名称/描述由前端按 id 走 i18n）
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockEventEntry {
    pub id: String,
    pub icon: String,
    pub category: String,
}

/// 评估并广播 `achievements://unlocked` 事件（交互触发点专用；
/// 启动补发与备份导入恢复一律静默，只调 evaluate()）。
pub fn evaluate_and_notify(app: &tauri::AppHandle, conn: &Connection) -> rusqlite::Result<()> {
    let ids = evaluate(conn)?;
    if !ids.is_empty() {
        let payload: Vec<UnlockEventEntry> = ids
            .iter()
            .filter_map(|id| {
                DEFS.iter().find(|d| d.id == id).map(|d| UnlockEventEntry {
                    id: id.clone(),
                    icon: d.icon.to_string(),
                    category: d.category.as_str().to_string(),
                })
            })
            .collect();
        let _ = app.emit("achievements://unlocked", payload);
    }
    Ok(())
}

// ---------- 对外视图与命令 ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementProgress {
    pub current: f64,
    pub target: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementView {
    pub id: String,
    pub category: String,
    pub icon: String,
    pub unlocked_at: Option<String>,
    pub kind: String,
    pub progress: Option<AchievementProgress>,
}

/// 系统成就全量视图（成就页双分区下半区）：定义顺序 = 展示顺序。
#[tauri::command]
pub fn get_system_achievements(state: State<'_, Db>) -> Result<Vec<AchievementView>, String> {
    let conn = state.0.lock().map_err(|_| "数据库锁获取失败".to_string())?;
    let stats = collect_stats(&conn).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, unlocked_at FROM system_achievements")
        .map_err(|e| e.to_string())?;
    let unlocked: HashMap<String, String> = stmt
        .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<rusqlite::Result<_>>()
        .map_err(|e| e.to_string())?;

    Ok(DEFS
        .iter()
        .map(|d| AchievementView {
            id: d.id.to_string(),
            category: d.category.as_str().to_string(),
            icon: d.icon.to_string(),
            unlocked_at: unlocked.get(d.id).cloned(),
            kind: d.kind.as_str().to_string(),
            progress: (d.progress)(&stats)
                .map(|(current, target)| AchievementProgress { current, target }),
        })
        .collect())
}

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{migrate, seed_default_project};
    use chrono::{Duration, Local};

    /// 内存库 + 全量迁移（V1..V11）
    fn test_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut conn).unwrap();
        conn
    }

    /// 日期（相对今天偏移 days）的 ISO 完成时间串：本地时区、前 10 位为本地日期
    fn iso_days_ago(days: i64) -> String {
        let d = Local::now().date_naive() - Duration::days(days);
        format!("{}T10:00:00+08:00", date_key(d))
    }

    fn insert_done_task(
        conn: &Connection,
        project_id: &str,
        value: &str,
        score: i64,
        completed_at: &str,
    ) {
        conn.execute(
            "INSERT INTO tasks (id, project_id, name, description, value, score, status,
                                created_at, updated_at, completed_at)
             VALUES (?1, ?2, 't', '', ?3, ?4, 'done', ?5, ?5, ?5)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                project_id,
                value,
                score,
                completed_at
            ],
        )
        .unwrap();
    }

    fn ensure_project(conn: &Connection) {
        seed_default_project(conn).unwrap();
    }

    fn insert_live_project(conn: &Connection) {
        conn.execute(
            "INSERT INTO projects
               (id, name, icon, description, priority, status, is_default, sort_order, is_core,
                created_at, updated_at, launched_at)
             VALUES (?1, 'live', '📁', '', 50, 'live', 0, 0, 0, 'a', 'a', '2026-01-01')",
            [uuid::Uuid::new_v4().to_string()],
        )
        .unwrap();
    }

    fn insert_report(conn: &Connection, period_key: &str) {
        conn.execute(
            "INSERT INTO analysis_reports (type, period_key, content, created_at)
             VALUES ('today', ?1, 'x', 'a')",
            [period_key],
        )
        .unwrap();
    }

    fn unlocked_ids(conn: &Connection) -> HashSet<String> {
        let mut stmt = conn.prepare("SELECT id FROM system_achievements").unwrap();
        let rows: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        rows.into_iter().collect()
    }

    #[test]
    fn fresh_db_unlocks_nothing() {
        let conn = test_conn();
        let stats = collect_stats(&conn).unwrap();
        assert_eq!(stats.done_count, 0);
        assert_eq!(stats.done_score, 0.0);
        assert_eq!(stats.streak_days, 0);
        assert!(evaluate(&conn).unwrap().is_empty());
    }

    #[test]
    fn task_count_gradients() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();

        // 1 → first_task；10 → ten_tasks；50 → fifty_tasks；100 → hundred_tasks；
        // 500 → five_hundred_tasks；1000 → thousand_tasks（逐段插入，验证逐段解锁；
        // 注意累计 60 分时 one_hour 会同步解锁，属预期行为）
        let cases = [
            (1, "first_task"),
            (9, "ten_tasks"),
            (40, "fifty_tasks"),
            (50, "hundred_tasks"),
            (400, "five_hundred_tasks"),
            (500, "thousand_tasks"),
        ];
        let mut expect: HashSet<String> = HashSet::new();
        for (add, unlock) in cases {
            for _ in 0..add {
                insert_done_task(&conn, &pid, "normal", 1, &iso_days_ago(30));
            }
            let new = evaluate(&conn).unwrap();
            assert!(
                new.contains(&unlock.to_string()),
                "期望解锁 {unlock}，实得 {new:?}"
            );
            expect.insert(unlock.to_string());
        }
        let got = unlocked_ids(&conn);
        for id in &expect {
            assert!(got.contains(id), "最终应含 {id}，实得 {got:?}");
        }
        assert!(got.contains("one_hour"), "累计 60 分后 one_hour 应解锁");
    }

    #[test]
    fn hour_gradients() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();

        let cases = [
            (60, "one_hour"),
            (540, "ten_hours"),
            (2_400, "fifty_hours"),
            (3_000, "hundred_hours"),
            (24_000, "five_hundred_hours"),
            (30_000, "thousand_hours"),
        ];
        for (add, unlock) in cases {
            insert_done_task(&conn, &pid, "normal", add, &iso_days_ago(30));
            let new = evaluate(&conn).unwrap();
            assert!(
                new.contains(&unlock.to_string()),
                "期望解锁 {unlock}，实得 {new:?}"
            );
        }
        let stats = collect_stats(&conn).unwrap();
        assert_eq!(stats.done_score, 60_000.0);
    }

    #[test]
    fn critical_and_important_gradients() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();

        insert_done_task(&conn, &pid, "critical", 5, &iso_days_ago(1));
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"first_critical".to_string()));

        for _ in 0..49 {
            insert_done_task(&conn, &pid, "important", 1, &iso_days_ago(1));
        }
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"fifty_important".to_string()));
    }

    #[test]
    fn live_and_core_gradients() {
        let conn = test_conn();
        ensure_project(&conn);
        insert_live_project(&conn);
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"first_live".to_string()));

        for _ in 0..4 {
            insert_live_project(&conn);
        }
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"five_live".to_string()));

        // 标记核心项目（借用默认项目）
        let pid = conn
            .query_row("SELECT id FROM projects WHERE is_default = 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();
        conn.execute("UPDATE projects SET is_core = 1 WHERE id = ?1", [&pid])
            .unwrap();
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"first_core".to_string()));
    }

    #[test]
    fn review_gradients() {
        let conn = test_conn();
        insert_report(&conn, "2026-01-01");
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"first_review".to_string()));

        let cases = [
            (9, "ten_reviews"),
            (40, "fifty_reviews"),
            (50, "hundred_reviews"),
        ];
        let mut n = 1;
        for (add, unlock) in cases {
            for _ in 0..add {
                n += 1;
                insert_report(&conn, &format!("2026-02-{n:02}"));
            }
            let new = evaluate(&conn).unwrap();
            assert!(
                new.contains(&unlock.to_string()),
                "期望解锁 {unlock}，实得 {new:?}"
            );
        }
    }

    #[test]
    fn streak_counts_from_yesterday_when_today_missing() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();

        // 昨天 + 前天：连续 2 天，streak_3 不解锁
        insert_done_task(&conn, &pid, "normal", 1, &iso_days_ago(1));
        insert_done_task(&conn, &pid, "normal", 1, &iso_days_ago(2));
        let new = evaluate(&conn).unwrap();
        assert!(!new.contains(&"streak_3".to_string()));
        assert_eq!(collect_stats(&conn).unwrap().streak_days, 2);

        // 大前天补上：连续 3 天 → streak_3 解锁
        insert_done_task(&conn, &pid, "normal", 1, &iso_days_ago(3));
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"streak_3".to_string()));

        // 中间断档：从昨天起数，不断 5 天不解锁 streak_5
        let conn2 = test_conn();
        ensure_project(&conn2);
        let pid2 = conn2
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();
        for d in [1, 2, 4, 5, 6] {
            insert_done_task(&conn2, &pid2, "normal", 1, &iso_days_ago(d));
        }
        let new = evaluate(&conn2).unwrap();
        assert!(!new.contains(&"streak_5".to_string())); // 第 3 天断档
        assert_eq!(collect_stats(&conn2).unwrap().streak_days, 2);
    }

    #[test]
    fn streak_counts_from_today_when_done_today() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();
        for d in 0..5 {
            insert_done_task(&conn, &pid, "normal", 1, &iso_days_ago(d));
        }
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"streak_5".to_string()));
        assert!(new.contains(&"streak_3".to_string()));
        assert_eq!(collect_stats(&conn).unwrap().streak_days, 5);
    }

    #[test]
    fn day_score_gradients() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();

        // 同一自然日内累计 480 分（8 小时）→ day_480
        insert_done_task(&conn, &pid, "normal", 300, &iso_days_ago(1));
        insert_done_task(&conn, &pid, "normal", 180, &iso_days_ago(1));
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"day_480".to_string()));
        assert!(!new.contains(&"day_576".to_string()));

        // 再补 96 分到 576 → day_576；价值系数不影响单日分组求和
        insert_done_task(&conn, &pid, "normal", 96, &iso_days_ago(1));
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"day_576".to_string()));

        // 另一天 720 → day_720；960 → day_960
        insert_done_task(&conn, &pid, "normal", 720, &iso_days_ago(2));
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"day_720".to_string()));

        insert_done_task(&conn, &pid, "normal", 960, &iso_days_ago(3));
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"day_960".to_string()));

        assert_eq!(collect_stats(&conn).unwrap().best_day_score, 960.0);
    }

    #[test]
    fn day_score_applies_value_multiplier() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();
        // 关键任务 x2.0：240 分 × 2 = 480 → day_480 达成
        insert_done_task(&conn, &pid, "critical", 240, &iso_days_ago(1));
        let new = evaluate(&conn).unwrap();
        assert!(new.contains(&"day_480".to_string()));
        assert_eq!(collect_stats(&conn).unwrap().best_day_score, 480.0);
    }

    #[test]
    fn idempotent_and_no_rollback() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();
        insert_done_task(&conn, &pid, "normal", 1, &iso_days_ago(1));
        let first = evaluate(&conn).unwrap();
        assert!(first.contains(&"first_task".to_string()));

        // 幂等：再次评估不产生新解锁
        assert!(evaluate(&conn).unwrap().is_empty());

        // 不回滚：删除任务后解锁记录仍在
        conn.execute("DELETE FROM tasks", []).unwrap();
        assert!(evaluate(&conn).unwrap().is_empty());
        assert!(unlocked_ids(&conn).contains("first_task"));
    }

    #[test]
    fn view_returns_progress_and_order() {
        let conn = test_conn();
        ensure_project(&conn);
        let pid = conn
            .query_row("SELECT id FROM projects LIMIT 1", [], |r| {
                r.get::<_, String>(0)
            })
            .unwrap();
        for _ in 0..5 {
            insert_done_task(&conn, &pid, "normal", 10, &iso_days_ago(1));
        }
        evaluate(&conn).unwrap();

        let stats = collect_stats(&conn).unwrap();
        let views = DEFS
            .iter()
            .map(|d| AchievementView {
                id: d.id.to_string(),
                category: d.category.as_str().to_string(),
                icon: d.icon.to_string(),
                unlocked_at: None,
                kind: d.kind.as_str().to_string(),
                progress: (d.progress)(&stats)
                    .map(|(current, target)| AchievementProgress { current, target }),
            })
            .collect::<Vec<_>>();

        assert_eq!(views.len(), 27);
        assert_eq!(views[0].id, "first_task"); // 定义顺序即展示顺序
        let ten = views.iter().find(|v| v.id == "ten_tasks").unwrap();
        let p = ten.progress.as_ref().unwrap();
        assert_eq!(p.current, 5.0);
        assert_eq!(p.target, 10.0);
        let one_hour = views.iter().find(|v| v.id == "one_hour").unwrap();
        let p = one_hour.progress.as_ref().unwrap();
        assert!((p.current - 50.0 / 60.0).abs() < 1e-9);
        let binary = views.iter().find(|v| v.id == "first_core").unwrap();
        assert_eq!(binary.kind, "binary");
        assert!(binary.progress.is_none());
    }
}
