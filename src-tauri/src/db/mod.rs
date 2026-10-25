//! SQLite 连接、版本化迁移与数据目录管理。

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use thiserror::Error;

/// 托管在 Tauri 状态中的数据库句柄
pub struct Db(pub Mutex<Connection>);

#[derive(Debug, Error)]
pub enum DbError {
    #[error("无法解析应用数据目录: {0}")]
    Env(String),
    #[error("创建数据目录失败: {0}")]
    Io(#[from] std::io::Error),
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

pub type DbResult<T> = Result<T, DbError>;

/// 应用数据根目录：%APPDATA%/DoneTrace（MVP 仅 Windows）
pub fn data_dir() -> DbResult<PathBuf> {
    let appdata = std::env::var("APPDATA").map_err(|e| DbError::Env(e.to_string()))?;
    Ok(PathBuf::from(appdata).join("DoneTrace"))
}

/// 初始化：建目录 → 打开库 → 迁移 → 播种默认项目
pub fn init(_app: &tauri::AppHandle) -> DbResult<Db> {
    let base = data_dir()?;
    fs::create_dir_all(&base)?;
    fs::create_dir_all(base.join("logs"))?;

    let db_path = base.join("done.db");
    let mut conn = Connection::open(&db_path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "journal_mode", "WAL")?;

    migrate(&mut conn)?;
    seed_default_project(&conn)?;

    Ok(Db(Mutex::new(conn)))
}

/// 当前本地时间（ISO 8601，含时区偏移，如 2026-10-23T12:53:28+08:00）
pub fn now_iso() -> String {
    chrono::Local::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, false)
}

// ---------- 迁移 ----------

/// 版本化迁移列表：索引即目标版本号（1 起），PRAGMA user_version 记录当前版本
const MIGRATIONS: &[&str] = &[V1, V2, V3, V4];

const V1: &str = r#"
CREATE TABLE projects (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  icon                  TEXT NOT NULL DEFAULT '📁',
  description           TEXT NOT NULL DEFAULT '',
  priority              INTEGER NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 99),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  is_default            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  completed_at          TEXT,
  archived_at           TEXT,
  archived_from_status  TEXT CHECK (archived_from_status IN ('active','completed'))
);
CREATE INDEX idx_projects_status ON projects(status);

CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  value         TEXT NOT NULL DEFAULT 'normal' CHECK (value IN ('normal','important','critical')),
  score         INTEGER NOT NULL DEFAULT 1 CHECK (score > 0),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  completed_at  TEXT
);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_completed_at ON tasks(completed_at);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE analysis_reports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT NOT NULL CHECK (type IN ('today','yesterday','week','last_week')),
  period_key  TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (type, period_key)
);

CREATE TABLE ai_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  log_date    TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (project_id, log_date)
);
"#;

/// V2：项目优先级改为 0-99、数值越小越靠前（重建表以更新 CHECK 约束）
const V2: &str = r#"
CREATE TABLE projects_new (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  icon                  TEXT NOT NULL DEFAULT '📁',
  description           TEXT NOT NULL DEFAULT '',
  priority              INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 99),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived')),
  is_default            INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  completed_at          TEXT,
  archived_at           TEXT,
  archived_from_status  TEXT CHECK (archived_from_status IN ('active','completed'))
);
INSERT INTO projects_new
  SELECT id, name, icon, description, priority, status, is_default,
         created_at, updated_at, completed_at, archived_at, archived_from_status
  FROM projects;
DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;
CREATE INDEX idx_projects_status ON projects(status);
"#;

/// V3：手动排序字段 + 去掉完成状态（遗留 completed 统一转 active）
const V3: &str = r#"
ALTER TABLE projects ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE projects SET status = 'active', completed_at = NULL, archived_from_status = NULL
WHERE status = 'completed';
UPDATE projects SET sort_order = (
  SELECT rn FROM (
    SELECT rowid AS rid, ROW_NUMBER() OVER (
      ORDER BY priority ASC, created_at ASC, rowid ASC
    ) AS rn FROM projects
  ) t WHERE t.rid = projects.rowid
);
"#;

/// V4：核心项目（唯一标记，列表置顶）
const V4: &str = r#"
ALTER TABLE projects ADD COLUMN is_core INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_projects_core ON projects(is_core) WHERE is_core = 1;
"#;

fn migrate(conn: &mut Connection) -> DbResult<()> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    let mut current = version as usize;
    if current < MIGRATIONS.len() {
        // 迁移期间临时关闭外键约束（表重建需要），完成后重新开启
        conn.pragma_update(None, "foreign_keys", "OFF")?;
        while current < MIGRATIONS.len() {
            let tx = conn.transaction()?;
            tx.execute_batch(MIGRATIONS[current])?;
            tx.execute_batch(&format!("PRAGMA user_version = {};", current + 1))?;
            tx.commit()?;
            current += 1;
        }
        conn.pragma_update(None, "foreign_keys", "ON")?;
    }
    Ok(())
}

// ---------- 播种 ----------

/// 账户初始只有一个默认项目（项目表为空时播种）
pub(crate) fn seed_default_project(conn: &Connection) -> DbResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))?;
    if count == 0 {
        let id = uuid::Uuid::new_v4().to_string();
        let now = now_iso();
        conn.execute(
            "INSERT INTO projects
               (id, name, icon, description, priority, status, is_default, created_at, updated_at)
             VALUES (?1, '默认项目', '📁', '', 50, 'active', 1, ?2, ?2)",
            rusqlite::params![id, now],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 用内存库验证迁移与播种（比 V1 更早的版本不存在，直接从 0 开始）
    #[test]
    fn migrate_and_seed_on_fresh_db() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut conn).unwrap();
        seed_default_project(&conn).unwrap();

        let version: i64 = conn.query_row("PRAGMA user_version", [], |r| r.get(0)).unwrap();
        assert_eq!(version as usize, MIGRATIONS.len());

        let (name, is_default): (String, i64) = conn
            .query_row("SELECT name, is_default FROM projects", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(name, "默认项目");
        assert_eq!(is_default, 1);

        // V2 后的优先级约束：0-99 合法，100 非法
        conn.execute(
            "INSERT INTO projects (id, name, priority, status, is_default, created_at, updated_at)
             VALUES ('t1', 'x', 0, 'active', 0, 'a', 'a')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO projects (id, name, priority, status, is_default, created_at, updated_at)
             VALUES ('t2', 'y', 99, 'active', 0, 'a', 'a')",
            [],
        )
        .unwrap();
        assert!(
            conn.execute(
                "INSERT INTO projects (id, name, priority, status, is_default, created_at, updated_at)
                 VALUES ('t3', 'z', 100, 'active', 0, 'a', 'a')",
                [],
            )
            .is_err()
        );
    }
}
