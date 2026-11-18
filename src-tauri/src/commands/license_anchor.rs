//! 离线许可宽限锚点存储（Pro 功能数据，免费构建不读写，惰性存在）。
//!
//! 设计依据：离线许可宽限验证设计 v0.2
//! - 单行锚点（id = 1）：最近一次成功联网校验的墙钟时间 + 应用累计运行秒（单调计数）
//! - **不随备份导出/导入**（本机锚点，防「导出 → 清库 → 导入重置宽限」循环）
//! - 清除数据（clear_all_data）时一并清空；replace 模式导入不清（保留本机锚点）
//! - 判定逻辑在 pro/（红线），本模块只提供存取

use rusqlite::Connection;

/// 锚点行
#[derive(Debug, Clone, PartialEq)]
pub struct LicenseAnchor {
    /// 最近一次成功联网校验的墙钟时间（RFC3339，含本地时区偏移）
    pub wall_last_check: String,
    /// 同一时刻的应用累计运行秒（单调计数，墙钟回拨时兜底）
    pub mono_last_check: i64,
}

pub fn load_anchor(conn: &Connection) -> rusqlite::Result<Option<LicenseAnchor>> {
    use rusqlite::OptionalExtension;
    conn.query_row(
        "SELECT wall_last_check, mono_last_check FROM license_anchor WHERE id = 1",
        [],
        |r| {
            Ok(LicenseAnchor {
                wall_last_check: r.get(0)?,
                mono_last_check: r.get(1)?,
            })
        },
    )
    .optional()
}

pub fn save_anchor(
    conn: &Connection,
    wall_last_check: &str,
    mono_last_check: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO license_anchor (id, wall_last_check, mono_last_check, updated_at)
         VALUES (1, ?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET
           wall_last_check = excluded.wall_last_check,
           mono_last_check = excluded.mono_last_check,
           updated_at = excluded.updated_at",
        rusqlite::params![wall_last_check, mono_last_check, crate::db::now_iso()],
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
    fn anchor_round_trip_and_upsert() {
        let conn = test_conn();
        assert!(load_anchor(&conn).unwrap().is_none());
        save_anchor(&conn, "2026-11-05T10:00:00+08:00", 120).unwrap();
        let a = load_anchor(&conn).unwrap().unwrap();
        assert_eq!(a.wall_last_check, "2026-11-05T10:00:00+08:00");
        assert_eq!(a.mono_last_check, 120);

        // upsert 单行（不产生第二行）
        save_anchor(&conn, "2026-11-05T11:00:00+08:00", 180).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM license_anchor", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1);
        let a = load_anchor(&conn).unwrap().unwrap();
        assert_eq!(a.mono_last_check, 180);
    }
}
