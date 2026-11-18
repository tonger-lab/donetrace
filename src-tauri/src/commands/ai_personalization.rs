//! 个性化 AI 复盘档案存储（Pro 功能数据，免费构建不读写，惰性存在）。
//!
//! 设计依据：个性化AI复盘设计 v0.2
//! - 按邮箱一行（`ai_personalization` 表，迁移 V12），随备份 zip → 云备份 E2E 加密同步
//! - 业务逻辑与提示词拼接在 pro/（红线目录），本模块只提供存取与数据校验
//! - temperature 独立于总开关（生成偏好），范围 0.0–2.0 步进 0.1，默认 0.7
//! - 校验规则：role ≤60 字符；goals 换行分隔 ≤3 条、每条 1..60 字符；
//!   tone 三值之一（非法回退 encouraging）；focus 只允许四个预定义值（非法项丢弃）

use rusqlite::{Connection, OptionalExtension};

use crate::db::now_iso;

/// 语气档位（与设计文档 §3.1 一致）
pub const TONES: [&str; 3] = ["encouraging", "direct", "concise"];
pub const DEFAULT_TONE: &str = "encouraging";

/// 侧重点预定义值（与设计文档 §3.2 一致）
pub const FOCUSES: [&str; 4] = ["efficiency", "quality", "learning", "balance"];

/// 默认 temperature（免费版硬编码同值；Pro 可自定义）
pub const DEFAULT_TEMPERATURE: f64 = 0.7;
pub const TEMPERATURE_MIN: f64 = 0.0;
pub const TEMPERATURE_MAX: f64 = 2.0;

pub const ROLE_MAX_CHARS: usize = 60;
pub const GOAL_MAX_COUNT: usize = 3;
pub const GOAL_MAX_CHARS: usize = 60;

/// 档案行（pro/ 通过注入闭包读写；免费构建不使用）
#[derive(Debug, Clone, PartialEq)]
pub struct AiPersonalizationRow {
    pub enabled: bool,
    pub role: String,
    pub goals: String,
    pub tone: String,
    pub focus: String,
    pub temperature: f64,
}

impl Default for AiPersonalizationRow {
    fn default() -> Self {
        Self {
            enabled: false,
            role: String::new(),
            goals: String::new(),
            tone: DEFAULT_TONE.to_string(),
            focus: String::new(),
            temperature: DEFAULT_TEMPERATURE,
        }
    }
}

// ---------- 校验 ----------

/// 校验并规范化档案字段；返回错误码（前端 localizeError 翻译为当前语言）。
/// 规范化：role/goals 逐条 trim；goals 去空行去重；focus 去重并丢弃非法项；
/// tone 非法回退默认；temperature 越界按错误处理（滑杆本不会越界，防御导入的脏数据）。
pub fn validate_and_normalize(row: &AiPersonalizationRow) -> Result<AiPersonalizationRow, String> {
    let role = row.role.trim().to_string();
    if role.chars().count() > ROLE_MAX_CHARS {
        return Err("ai_personalization.role_too_long".to_string());
    }

    // goals：换行切分 → trim → 去空行 → 去重 → 限条数与长度
    let mut goals: Vec<String> = Vec::new();
    for raw in row.goals.lines() {
        let g = raw.trim();
        if g.is_empty() || goals.iter().any(|x| x == g) {
            continue;
        }
        if g.chars().count() > GOAL_MAX_CHARS {
            return Err("ai_personalization.goal_too_long".to_string());
        }
        goals.push(g.to_string());
    }
    if goals.len() > GOAL_MAX_COUNT {
        return Err("ai_personalization.too_many_goals".to_string());
    }

    let tone = if TONES.contains(&row.tone.as_str()) {
        row.tone.clone()
    } else {
        DEFAULT_TONE.to_string()
    };

    let mut focus: Vec<String> = Vec::new();
    for raw in row.focus.split(',') {
        let f = raw.trim();
        if f.is_empty() || focus.iter().any(|x| x == f) {
            continue;
        }
        if FOCUSES.contains(&f) {
            focus.push(f.to_string());
        }
    }

    if !(TEMPERATURE_MIN..=TEMPERATURE_MAX).contains(&row.temperature) {
        return Err("ai_personalization.temperature_out_of_range".to_string());
    }

    Ok(AiPersonalizationRow {
        enabled: row.enabled,
        role,
        goals: goals.join("\n"),
        tone,
        focus: focus.join(","),
        temperature: row.temperature,
    })
}

// ---------- 存取 ----------

pub fn load_personalization(
    conn: &Connection,
    email: &str,
) -> rusqlite::Result<Option<AiPersonalizationRow>> {
    conn.query_row(
        "SELECT enabled, role, goals, tone, focus, temperature
         FROM ai_personalization WHERE email = ?1",
        [email],
        |r| {
            Ok(AiPersonalizationRow {
                enabled: r.get::<_, i64>(0)? != 0,
                role: r.get(1)?,
                goals: r.get(2)?,
                tone: r.get(3)?,
                focus: r.get(4)?,
                temperature: r.get(5)?,
            })
        },
    )
    .optional()
}

pub fn save_personalization(
    conn: &Connection,
    email: &str,
    row: &AiPersonalizationRow,
) -> Result<(), String> {
    let normalized = validate_and_normalize(row)?;
    conn.execute(
        "INSERT INTO ai_personalization
           (email, enabled, role, goals, tone, focus, temperature, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(email) DO UPDATE SET
           enabled = excluded.enabled,
           role = excluded.role,
           goals = excluded.goals,
           tone = excluded.tone,
           focus = excluded.focus,
           temperature = excluded.temperature,
           updated_at = excluded.updated_at",
        rusqlite::params![
            email,
            normalized.enabled as i64,
            normalized.role,
            normalized.goals,
            normalized.tone,
            normalized.focus,
            normalized.temperature,
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

    fn row() -> AiPersonalizationRow {
        AiPersonalizationRow::default()
    }

    #[test]
    fn load_returns_none_for_unknown_email() {
        let conn = test_conn();
        assert!(load_personalization(&conn, "a@x.com").unwrap().is_none());
    }

    #[test]
    fn save_and_load_round_trip() {
        let conn = test_conn();
        let r = AiPersonalizationRow {
            enabled: true,
            role: " 独立开发者 ".to_string(),
            goals: "完成海外 SaaS 首版\n\n提升写作能力\n完成海外 SaaS 首版".to_string(),
            tone: "direct".to_string(),
            focus: "quality,efficiency,quality".to_string(),
            temperature: 0.9,
        };
        save_personalization(&conn, "a@x.com", &r).unwrap();
        let loaded = load_personalization(&conn, "a@x.com").unwrap().unwrap();
        assert!(loaded.enabled);
        assert_eq!(loaded.role, "独立开发者");
        assert_eq!(loaded.goals, "完成海外 SaaS 首版\n提升写作能力"); // 去空行 + 去重
        assert_eq!(loaded.tone, "direct");
        assert_eq!(loaded.focus, "quality,efficiency"); // 去重
        assert!((loaded.temperature - 0.9).abs() < 1e-9);

        // upsert：同邮箱覆盖
        let r2 = row();
        save_personalization(&conn, "a@x.com", &r2).unwrap();
        let loaded2 = load_personalization(&conn, "a@x.com").unwrap().unwrap();
        assert!(!loaded2.enabled);
        assert_eq!(loaded2.tone, DEFAULT_TONE);
    }

    #[test]
    fn validation_rejects_invalid_goals() {
        let mut r = row();
        r.goals = "a\nb\nc\nd".to_string();
        assert_eq!(
            save_personalization(&test_conn(), "a@x.com", &r).unwrap_err(),
            "ai_personalization.too_many_goals"
        );
        r.goals = format!("{}\nok", "长".repeat(GOAL_MAX_CHARS + 1));
        assert_eq!(
            save_personalization(&test_conn(), "a@x.com", &r).unwrap_err(),
            "ai_personalization.goal_too_long"
        );
    }

    #[test]
    fn validation_rejects_long_role() {
        let mut r = row();
        r.role = "长".repeat(ROLE_MAX_CHARS + 1);
        assert_eq!(
            save_personalization(&test_conn(), "a@x.com", &r).unwrap_err(),
            "ai_personalization.role_too_long"
        );
    }

    #[test]
    fn validation_rejects_out_of_range_temperature() {
        let mut r = row();
        r.temperature = 2.1;
        assert_eq!(
            save_personalization(&test_conn(), "a@x.com", &r).unwrap_err(),
            "ai_personalization.temperature_out_of_range"
        );
        r.temperature = -0.1;
        assert!(save_personalization(&test_conn(), "a@x.com", &r).is_err());
        // 边界值合法
        r.temperature = 0.0;
        save_personalization(&test_conn(), "a@x.com", &r).unwrap();
        r.temperature = 2.0;
        save_personalization(&test_conn(), "a@x.com", &r).unwrap();
    }

    #[test]
    fn validation_falls_back_illegal_tone_and_drops_illegal_focus() {
        let mut r = row();
        r.tone = "aggressive".to_string();
        r.focus = "efficiency,spicy,balance".to_string();
        let normalized = validate_and_normalize(&r).unwrap();
        assert_eq!(normalized.tone, DEFAULT_TONE);
        assert_eq!(normalized.focus, "efficiency,balance");
    }
}
