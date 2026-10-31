//! 个人档案本地存储（Pro 专属数据，免费构建不读写）。
//!
//! 本模块**不注册 Tauri 命令**：Pro 的读取/写入命令在 `pro/` 增量 crate，
//! 由 desktop 以闭包注入本模块的函数（与备份 provider 同模式）。
//! 档案按邮箱一行，随备份 zip 导出/导入（云备份 E2E 加密同步，服务器只见密文）。

use rusqlite::{Connection, OptionalExtension};

use crate::db::now_iso;

/// 读取某账号的档案：返回 (nickname, avatar)，无记录返回 None
/// 免费构建下无调用方（仅 Pro 通过注入闭包使用），消除 dead_code 警告
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn load_profile(
    conn: &Connection,
    email: &str,
) -> rusqlite::Result<Option<(Option<String>, Option<String>)>> {
    conn.query_row(
        "SELECT nickname, avatar FROM profile WHERE email = ?1",
        [email],
        |r| Ok((r.get(0)?, r.get(1)?)),
    )
    .optional()
}

/// 写入（upsert）某账号的档案（同上：免费构建无调用方）
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn save_profile(
    conn: &Connection,
    email: &str,
    nickname: Option<&str>,
    avatar: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO profile (email, nickname, avatar, updated_at) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(email) DO UPDATE SET
           nickname = excluded.nickname,
           avatar = excluded.avatar,
           updated_at = excluded.updated_at",
        rusqlite::params![email, nickname, avatar, now_iso()],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;

    #[test]
    fn profile_upsert_and_load() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();

        // 无记录 → None
        assert!(load_profile(&conn, "a@x.com").unwrap().is_none());

        // 写入 → 可读回
        save_profile(&conn, "a@x.com", Some("alice"), Some("data:image/png;base64,AA")).unwrap();
        let row = load_profile(&conn, "a@x.com").unwrap().unwrap();
        assert_eq!(row.0.as_deref(), Some("alice"));
        assert_eq!(row.1.as_deref(), Some("data:image/png;base64,AA"));

        // 同一邮箱 upsert 覆盖（昵称清空 = 恢复邮箱前缀默认）
        save_profile(&conn, "a@x.com", None, None).unwrap();
        let row = load_profile(&conn, "a@x.com").unwrap().unwrap();
        assert_eq!(row.0, None);
        assert_eq!(row.1, None);

        // 不同邮箱互不影响
        save_profile(&conn, "b@x.com", Some("bob"), None).unwrap();
        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM profile", [], |r| r.get(0))
            .unwrap();
        assert_eq!(rows, 2);
    }
}
