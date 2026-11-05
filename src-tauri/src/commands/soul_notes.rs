//! 心灵寄语（Soul Notes）本地存储（Pro 专属数据，免费构建不读写）。
//!
//! 与 profile.rs 同模式：本模块**不注册 Tauri 命令**，由 pro/ 增量 crate 经闭包
//! 注入调用（业务校验与命令在 pro/，本模块只负责本地 SQLite 读写）。
//! 寄语与开关配置按邮箱隔离，随备份 zip 导出/导入（云备份 E2E 加密同步）。

use rusqlite::{Connection, OptionalExtension};

use crate::db::now_iso;

/// 某账号的寄语快照（desktop 存储层视图；pro/ 侧有对应的公开结构）
/// 免费构建下无调用方（仅 Pro 通过注入闭包使用），消除 dead_code 警告
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) struct SoulNotesSnapshot {
    pub enabled: bool,
    pub interval_secs: i64,
    pub seeded: bool,
    /// (id, text)，按 sort_order 升序
    pub notes: Vec<(String, String)>,
}

/// 读取某账号的寄语与开关配置（无配置记录时按默认：关闭 / 300 秒 / 未播种 / 空）
/// 免费构建下无调用方（仅 Pro 通过注入闭包使用）
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn load_soul_notes(
    conn: &Connection,
    email: &str,
) -> rusqlite::Result<SoulNotesSnapshot> {
    let cfg = conn
        .query_row(
            "SELECT enabled, interval_secs, seeded FROM soul_notes_config WHERE email = ?1",
            [email],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, i64>(2)?,
                ))
            },
        )
        .optional()?;

    let mut stmt = conn.prepare(
        "SELECT id, text FROM soul_notes WHERE email = ?1
         ORDER BY sort_order ASC, created_at ASC",
    )?;
    let notes = stmt
        .query_map([email], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    Ok(SoulNotesSnapshot {
        enabled: cfg.as_ref().map(|c| c.0 != 0).unwrap_or(false),
        interval_secs: cfg.as_ref().map(|c| c.1).unwrap_or(300),
        seeded: cfg.as_ref().map(|c| c.2 != 0).unwrap_or(false),
        notes,
    })
}

/// 写入开关配置（upsert）
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn save_soul_notes_config(
    conn: &Connection,
    email: &str,
    enabled: bool,
    interval_secs: i64,
    seeded: bool,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO soul_notes_config (email, enabled, interval_secs, seeded, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(email) DO UPDATE SET
           enabled = excluded.enabled,
           interval_secs = excluded.interval_secs,
           seeded = excluded.seeded,
           updated_at = excluded.updated_at",
        rusqlite::params![email, enabled as i64, interval_secs, seeded as i64, now_iso()],
    )?;
    Ok(())
}

/// 新增（id = None，生成 UUID）或编辑（id = Some）一条寄语。
/// 返回 (id, 该账号剩余寄语条数)；编辑不改变排序。
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn upsert_soul_note(
    conn: &Connection,
    email: &str,
    id: Option<&str>,
    text: &str,
) -> rusqlite::Result<(String, usize)> {
    let id = match id {
        Some(id) => id.to_string(),
        None => uuid::Uuid::new_v4().to_string(),
    };
    conn.execute(
        "INSERT INTO soul_notes (email, id, text, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3,
                 (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM soul_notes WHERE email = ?1),
                 ?4, ?4)
         ON CONFLICT(email, id) DO UPDATE SET
           text = excluded.text,
           updated_at = excluded.updated_at",
        rusqlite::params![email, id, text, now_iso()],
    )?;
    let remaining = count_soul_notes(conn, email)?;
    Ok((id, remaining))
}

/// 删除一条寄语，返回该账号剩余条数
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn delete_soul_note(
    conn: &Connection,
    email: &str,
    id: &str,
) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM soul_notes WHERE email = ?1 AND id = ?2", [email, id])?;
    count_soul_notes(conn, email)
}

/// 播种默认寄语（仅一次）：本函数在**单次持锁**内完成"检查 seeded → 插入 → 置 seeded"，
/// 并发调用（侧栏轮询与档案页同时首读）串行化后第二次为 no-op，避免重复播种。
/// 播种后保持关闭状态、默认切换时间（开启与否由用户在界面上决定）。
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn seed_soul_notes(conn: &Connection, email: &str, texts: &[String]) -> rusqlite::Result<()> {
    let seeded: bool = conn
        .query_row(
            "SELECT seeded FROM soul_notes_config WHERE email = ?1",
            [email],
            |r| r.get::<_, i64>(0),
        )
        .optional()?
        .map(|v| v != 0)
        .unwrap_or(false);
    if seeded {
        return Ok(());
    }
    for text in texts {
        upsert_soul_note(conn, email, None, text)?;
    }
    save_soul_notes_config(conn, email, false, 300, true)
}

fn count_soul_notes(conn: &Connection, email: &str) -> rusqlite::Result<usize> {
    let n: i64 =
        conn.query_row("SELECT COUNT(*) FROM soul_notes WHERE email = ?1", [email], |r| {
            r.get(0)
        })?;
    Ok(n as usize)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrate;

    #[test]
    fn soul_notes_crud_and_config() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();

        // 初始：无配置记录 → 关闭 / 默认间隔 / 未播种 / 空
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert!(!snap.enabled);
        assert_eq!(snap.interval_secs, 300);
        assert!(!snap.seeded);
        assert!(snap.notes.is_empty());

        // 新增两条（id 自动生成、计数递增）
        let (id1, n1) = upsert_soul_note(&conn, "a@x.com", None, "first").unwrap();
        assert_eq!(n1, 1);
        let (id2, n2) = upsert_soul_note(&conn, "a@x.com", None, "second").unwrap();
        assert_eq!(n2, 2);
        assert_ne!(id1, id2);

        // 排序按插入顺序
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert_eq!(snap.notes, vec![(id1.clone(), "first".into()), (id2.clone(), "second".into())]);

        // 编辑：同 id 覆盖文本，条数不变
        let (_, n3) = upsert_soul_note(&conn, "a@x.com", Some(&id1), "first-edited").unwrap();
        assert_eq!(n3, 2);
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert_eq!(snap.notes[0].1, "first-edited");

        // 配置 upsert
        save_soul_notes_config(&conn, "a@x.com", true, 60, true).unwrap();
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert!(snap.enabled);
        assert_eq!(snap.interval_secs, 60);
        assert!(snap.seeded);

        // 删除 → 剩余数递减；删空后配置行仍在（由 pro/ 层决定关闭）
        assert_eq!(delete_soul_note(&conn, "a@x.com", &id2).unwrap(), 1);
        assert_eq!(delete_soul_note(&conn, "a@x.com", &id1).unwrap(), 0);
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert!(snap.notes.is_empty());
        assert!(snap.enabled); // 存储层不越权改开关；自动关闭在 pro/ 命令层

        // 不同邮箱互不影响
        let (_, n4) = upsert_soul_note(&conn, "b@x.com", None, "other").unwrap();
        assert_eq!(n4, 1);
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert!(snap.notes.is_empty());
    }

    #[test]
    fn seeding_happens_exactly_once() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();

        // 首次播种：5 条、seeded=1、保持关闭与默认间隔
        let defaults: Vec<String> = (0..5).map(|i| format!("note-{i}")).collect();
        seed_soul_notes(&conn, "a@x.com", &defaults).unwrap();
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert_eq!(snap.notes.len(), 5);
        assert!(snap.seeded);
        assert!(!snap.enabled);
        assert_eq!(snap.interval_secs, 300);

        // 再次播种（并发/重复调用）：no-op，不重复插入
        seed_soul_notes(&conn, "a@x.com", &defaults).unwrap();
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert_eq!(snap.notes.len(), 5);

        // 删空后不再复活（seeded 已置位）
        for (id, _) in &snap.notes {
            delete_soul_note(&conn, "a@x.com", id).unwrap();
        }
        seed_soul_notes(&conn, "a@x.com", &defaults).unwrap();
        let snap = load_soul_notes(&conn, "a@x.com").unwrap();
        assert!(snap.notes.is_empty());
    }
}
