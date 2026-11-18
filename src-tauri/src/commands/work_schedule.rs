//! 自定义工作时间表存储（Pro 功能数据，免费构建不读写，惰性存在）。
//!
//! 设计依据：工作时间自定义 v1（2026-11-18 拍板）
//! - 按邮箱一行（`work_schedule` 表，迁移 V15），随备份 zip → 云备份 E2E 加密同步
//! - 业务规则：workdays 周一~周日 7 位 0/1（至少 1 个工作日）；start/end 为 HH:MM 且 start < end
//! - **未保存过 = 无记录**：AI 复盘时间背景与完成度口径全部回退内置标准
//!   （Mon–Fri 9:00–18:00；完成度日 8h / 周 40h），与免费版行为完全一致

use rusqlite::{Connection, OptionalExtension};

use crate::db::now_iso;

/// 周一~周日（0 = 休息，1 = 工作日）
pub const DEFAULT_WORKDAYS: [bool; 7] = [true, true, true, true, true, false, false];
pub const DEFAULT_START: &str = "09:00";
pub const DEFAULT_END: &str = "18:00";

/// 表行（pro/ 通过注入闭包读写；免费构建不使用）
#[derive(Debug, Clone, PartialEq)]
pub struct WorkScheduleRow {
    pub workdays: Vec<bool>,
    pub start: String,
    pub end: String,
}

impl Default for WorkScheduleRow {
    fn default() -> Self {
        Self {
            workdays: DEFAULT_WORKDAYS.to_vec(),
            start: DEFAULT_START.to_string(),
            end: DEFAULT_END.to_string(),
        }
    }
}

// ---------- 校验 ----------

/// 解析 HH:MM（严格两位 24 小时制）→ 自午夜起的分钟数；非法返回 None。
pub fn parse_hhmm(s: &str) -> Option<i64> {
    let (h, m) = s.split_once(':')?;
    if h.len() != 2 || m.len() != 2 {
        return None;
    }
    let h: i64 = h.parse().ok()?;
    let m: i64 = m.parse().ok()?;
    if h > 23 || m > 59 {
        return None;
    }
    Some(h * 60 + m)
}

/// 校验并规范化（错误码由前端 localizeError 翻译为当前语言）。
pub fn validate_and_normalize(row: &WorkScheduleRow) -> Result<WorkScheduleRow, String> {
    if row.workdays.len() != 7 {
        return Err("work_schedule.invalid_days".to_string());
    }
    if !row.workdays.iter().any(|d| *d) {
        return Err("work_schedule.no_workdays".to_string());
    }
    let start_min = parse_hhmm(row.start.trim())
        .ok_or_else(|| "work_schedule.invalid_time".to_string())?;
    let end_min = parse_hhmm(row.end.trim())
        .ok_or_else(|| "work_schedule.invalid_time".to_string())?;
    if start_min >= end_min {
        return Err("work_schedule.end_not_after_start".to_string());
    }
    Ok(WorkScheduleRow {
        workdays: row.workdays.clone(),
        start: row.start.trim().to_string(),
        end: row.end.trim().to_string(),
    })
}

// ---------- 存取 ----------

/// workdays 序列化：7 位逗号分隔 0/1
fn workdays_to_text(days: &[bool]) -> String {
    days.iter()
        .map(|d| if *d { "1" } else { "0" })
        .collect::<Vec<_>>()
        .join(",")
}

fn text_to_workdays(s: &str) -> Vec<bool> {
    let mut out: Vec<bool> = s
        .split(',')
        .map(|p| p.trim() == "1")
        .collect();
    out.resize(7, false);
    out
}

pub fn load_work_schedule(
    conn: &Connection,
    email: &str,
) -> rusqlite::Result<Option<WorkScheduleRow>> {
    conn.query_row(
        "SELECT workdays, start, end FROM work_schedule WHERE email = ?1",
        [email],
        |r| {
            Ok(WorkScheduleRow {
                workdays: text_to_workdays(&r.get::<_, String>(0)?),
                start: r.get(1)?,
                end: r.get(2)?,
            })
        },
    )
    .optional()
}

pub fn save_work_schedule(
    conn: &Connection,
    email: &str,
    row: &WorkScheduleRow,
) -> Result<(), String> {
    let normalized = validate_and_normalize(row)?;
    conn.execute(
        "INSERT INTO work_schedule (email, workdays, start, end, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(email) DO UPDATE SET
           workdays = excluded.workdays,
           start = excluded.start,
           end = excluded.end,
           updated_at = excluded.updated_at",
        rusqlite::params![
            email,
            workdays_to_text(&normalized.workdays),
            normalized.start,
            normalized.end,
            now_iso(),
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- 测试 ----------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;

    fn test_conn() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut conn).unwrap();
        conn
    }

    #[test]
    fn parse_hhmm_accepts_valid_times() {
        assert_eq!(parse_hhmm("09:00"), Some(540));
        assert_eq!(parse_hhmm("00:00"), Some(0));
        assert_eq!(parse_hhmm("23:59"), Some(1439));
        assert_eq!(parse_hhmm("18:00"), Some(1080));
        assert_eq!(parse_hhmm("9:0"), None);
        assert_eq!(parse_hhmm("24:00"), None);
        assert_eq!(parse_hhmm("12:60"), None);
        assert_eq!(parse_hhmm("abc"), None);
        assert_eq!(parse_hhmm(""), None);
    }

    #[test]
    fn load_returns_none_for_unknown_email() {
        let conn = test_conn();
        assert!(load_work_schedule(&conn, "a@x.com").unwrap().is_none());
    }

    #[test]
    fn save_and_load_round_trip() {
        let conn = test_conn();
        // 周末工作者 + 晚班：22:00–23:30
        let r = WorkScheduleRow {
            workdays: vec![false, false, false, false, false, true, true],
            start: " 22:00 ".to_string(), // trim 规范化
            end: "23:30".to_string(),
        };
        save_work_schedule(&conn, "a@x.com", &r).unwrap();
        let loaded = load_work_schedule(&conn, "a@x.com").unwrap().unwrap();
        assert_eq!(
            loaded.workdays,
            vec![false, false, false, false, false, true, true]
        );
        assert_eq!(loaded.start, "22:00");
        assert_eq!(loaded.end, "23:30");

        // upsert：同邮箱覆盖
        let r2 = WorkScheduleRow::default();
        save_work_schedule(&conn, "a@x.com", &r2).unwrap();
        let loaded2 = load_work_schedule(&conn, "a@x.com").unwrap().unwrap();
        assert_eq!(loaded2, r2);
    }

    #[test]
    fn validation_rejects_invalid_schedules() {
        let conn = test_conn();
        let base = WorkScheduleRow::default();

        let mut r = base.clone();
        r.workdays = vec![true, true, true]; // 位数不足
        assert_eq!(
            save_work_schedule(&conn, "a@x.com", &r).unwrap_err(),
            "work_schedule.invalid_days"
        );

        let mut r = base.clone();
        r.workdays = vec![false; 7]; // 全休
        assert_eq!(
            save_work_schedule(&conn, "a@x.com", &r).unwrap_err(),
            "work_schedule.no_workdays"
        );

        let mut r = base.clone();
        r.start = "25:00".to_string();
        assert_eq!(
            save_work_schedule(&conn, "a@x.com", &r).unwrap_err(),
            "work_schedule.invalid_time"
        );

        let mut r = base;
        r.start = "18:00".to_string();
        r.end = "09:00".to_string(); // 起止倒挂
        assert_eq!(
            save_work_schedule(&conn, "a@x.com", &r).unwrap_err(),
            "work_schedule.end_not_after_start"
        );
    }
}
