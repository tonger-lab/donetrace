//! WebDAV 自动加密备份配置存储（Pro 功能数据，免费构建不读写，惰性存在）。
//!
//! 设计依据：WebDAV自动加密备份设计 v0.2
//! - 按邮箱一行（`webdav_config` 表，迁移 V13）
//! - password 仅本机存储：备份导出时脱敏为空串（本模块提供 `for_export` 视图）
//! - 校验：url 必须 http(s):// 开头；username/password 必须非空（防"以为已加密却明文上云"）
//! - 业务（WebDAV 协议、加密、定时）全在 pro/（红线目录），本模块只提供存取与校验

use rusqlite::{Connection, OptionalExtension};

use crate::db::now_iso;

pub const URL_MAX_CHARS: usize = 512;
pub const CRED_MAX_CHARS: usize = 256;

/// 配置行（pro/ 通过注入闭包读写；免费构建不使用）
#[derive(Debug, Clone, PartialEq)]
pub struct WebdavConfigRow {
    pub enabled: bool,
    pub url: String,
    pub username: String,
    pub password: String,
    pub last_success_at: Option<String>,
}

impl Default for WebdavConfigRow {
    fn default() -> Self {
        Self {
            enabled: false,
            url: String::new(),
            username: String::new(),
            password: String::new(),
            last_success_at: None,
        }
    }
}

// ---------- 校验 ----------

/// 校验并规范化（返回错误码，前端 localizeError 翻译）。
/// 规则：url trim、必须 http(s)://；username/password trim 后必须非空。
pub fn validate_and_normalize(row: &WebdavConfigRow) -> Result<WebdavConfigRow, String> {
    let url = row.url.trim().to_string();
    if url.chars().count() > URL_MAX_CHARS {
        return Err("webdav.url_too_long".to_string());
    }
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("webdav.invalid_url".to_string());
    }
    let username = row.username.trim().to_string();
    if username.is_empty() {
        return Err("webdav.username_required".to_string());
    }
    if username.chars().count() > CRED_MAX_CHARS {
        return Err("webdav.username_too_long".to_string());
    }
    let password = row.password.trim().to_string();
    if password.is_empty() {
        return Err("webdav.password_required".to_string());
    }
    if password.chars().count() > CRED_MAX_CHARS {
        return Err("webdav.password_too_long".to_string());
    }
    Ok(WebdavConfigRow {
        enabled: row.enabled,
        url,
        username,
        password,
        last_success_at: row.last_success_at.clone(),
    })
}

// ---------- 存取 ----------

pub fn load_webdav_config(
    conn: &Connection,
    email: &str,
) -> rusqlite::Result<Option<WebdavConfigRow>> {
    conn.query_row(
        "SELECT enabled, url, username, password, last_success_at
         FROM webdav_config WHERE email = ?1",
        [email],
        |r| {
            Ok(WebdavConfigRow {
                enabled: r.get::<_, i64>(0)? != 0,
                url: r.get(1)?,
                username: r.get(2)?,
                password: r.get(3)?,
                last_success_at: r.get(4)?,
            })
        },
    )
    .optional()
}

/// 保存配置（校验在存储层；enabled 关闭时保留其余字段）
pub fn save_webdav_config(
    conn: &Connection,
    email: &str,
    row: &WebdavConfigRow,
) -> Result<(), String> {
    let normalized = validate_and_normalize(row)?;
    conn.execute(
        "INSERT INTO webdav_config
           (email, enabled, url, username, password, last_success_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(email) DO UPDATE SET
           enabled = excluded.enabled,
           url = excluded.url,
           username = excluded.username,
           password = excluded.password,
           last_success_at = excluded.last_success_at,
           updated_at = excluded.updated_at",
        rusqlite::params![
            email,
            normalized.enabled as i64,
            normalized.url,
            normalized.username,
            normalized.password,
            normalized.last_success_at,
            now_iso(),
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 更新最近一次备份成功时间（保留其余字段原值）
pub fn touch_webdav_success(
    conn: &Connection,
    email: &str,
    at: &str,
) -> Result<(), String> {
    conn.execute(
        "UPDATE webdav_config SET last_success_at = ?2, updated_at = ?3 WHERE email = ?1",
        rusqlite::params![email, at, now_iso()],
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

    fn valid_row() -> WebdavConfigRow {
        WebdavConfigRow {
            enabled: true,
            url: " https://dav.example.com/remote.php/dav/ ".to_string(),
            username: " alice ".to_string(),
            password: " s3cret ".to_string(),
            last_success_at: None,
        }
    }

    #[test]
    fn load_returns_none_for_unknown_email() {
        let conn = test_conn();
        assert!(load_webdav_config(&conn, "a@x.com").unwrap().is_none());
    }

    #[test]
    fn save_normalizes_and_round_trips() {
        let conn = test_conn();
        save_webdav_config(&conn, "a@x.com", &valid_row()).unwrap();
        let loaded = load_webdav_config(&conn, "a@x.com").unwrap().unwrap();
        assert!(loaded.enabled);
        assert_eq!(loaded.url, "https://dav.example.com/remote.php/dav/");
        assert_eq!(loaded.username, "alice");
        assert_eq!(loaded.password, "s3cret");

        // upsert 同邮箱覆盖；enabled 关闭保留字段
        let mut off = loaded.clone();
        off.enabled = false;
        save_webdav_config(&conn, "a@x.com", &off).unwrap();
        let again = load_webdav_config(&conn, "a@x.com").unwrap().unwrap();
        assert!(!again.enabled);
        assert_eq!(again.url, off.url);
    }

    #[test]
    fn validation_rejects_bad_url_and_empty_credentials() {
        let conn = test_conn();
        let mut r = valid_row();
        r.url = "ftp://dav.example.com".to_string();
        assert_eq!(
            save_webdav_config(&conn, "a@x.com", &r).unwrap_err(),
            "webdav.invalid_url"
        );
        r = valid_row();
        r.username = "   ".to_string();
        assert_eq!(
            save_webdav_config(&conn, "a@x.com", &r).unwrap_err(),
            "webdav.username_required"
        );
        r = valid_row();
        r.password = "  ".to_string();
        assert_eq!(
            save_webdav_config(&conn, "a@x.com", &r).unwrap_err(),
            "webdav.password_required"
        );
    }

    #[test]
    fn touch_success_updates_timestamp_only() {
        let conn = test_conn();
        save_webdav_config(&conn, "a@x.com", &valid_row()).unwrap();
        touch_webdav_success(&conn, "a@x.com", "2026-11-05T10:00:00+08:00").unwrap();
        let loaded = load_webdav_config(&conn, "a@x.com").unwrap().unwrap();
        assert_eq!(loaded.last_success_at.as_deref(), Some("2026-11-05T10:00:00+08:00"));
        assert_eq!(loaded.password, "s3cret");
    }
}
