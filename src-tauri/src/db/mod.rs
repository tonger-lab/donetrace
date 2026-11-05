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

/// 应用数据根目录（跨平台，目录名统一为 DoneTrace）：
/// - Windows：`%APPDATA%\DoneTrace`（与历史版本完全一致，既有数据无缝兼容）
/// - macOS：`~/Library/Application Support/DoneTrace`
/// - Linux：`$XDG_DATA_HOME/DoneTrace`（默认 `~/.local/share/DoneTrace`）
pub fn data_dir() -> DbResult<PathBuf> {
    let base = dirs::data_dir().ok_or_else(|| DbError::Env("无法解析系统数据目录".into()))?;
    Ok(base.join("DoneTrace"))
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
const MIGRATIONS: &[&str] = &[V1, V2, V3, V4, V5, V6, V7, V8, V9, V10, V11, V12];

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

/// V5：项目「已上线」状态（三态：进行中 / 已上线 / 已归档）+ 上线日期
/// 重建表以放宽 CHECK：status 允许 'live'；archived_from_status 允许 'live'（归档后激活回原状态）
const V5: &str = r#"
CREATE TABLE projects_new (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  icon                  TEXT NOT NULL DEFAULT '📁',
  description           TEXT NOT NULL DEFAULT '',
  priority              INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 99),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','live','completed','archived')),
  is_default            INTEGER NOT NULL DEFAULT 0,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_core               INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  completed_at          TEXT,
  launched_at           TEXT,
  archived_at           TEXT,
  archived_from_status  TEXT CHECK (archived_from_status IN ('active','live','completed'))
);
INSERT INTO projects_new
  SELECT id, name, icon, description, priority, status, is_default, sort_order, is_core,
         created_at, updated_at, completed_at, NULL, archived_at, archived_from_status
  FROM projects;
DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;
CREATE INDEX idx_projects_status ON projects(status);
CREATE UNIQUE INDEX idx_projects_core ON projects(is_core) WHERE is_core = 1;
"#;

/// V6：个人档案本地存储（Pro 功能数据，按邮箱一行；免费构建不读写，惰性存在）
/// 档案随备份导出/导入 → 云备份 E2E 加密同步，服务器只见密文
const V6: &str = r#"
CREATE TABLE profile (
  email      TEXT PRIMARY KEY,
  nickname   TEXT,
  avatar     TEXT,
  updated_at TEXT NOT NULL
);
"#;

/// V7：彻底移除遗留 completed 状态（2026-10-31，无外部用户，历史行统一转 active）
/// - status CHECK 收紧为 active/live/archived；archived_from_status 收紧为 active/live
/// - 删除遗留 completed_at 列
const V7: &str = r#"
CREATE TABLE projects_new (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  icon                  TEXT NOT NULL DEFAULT '📁',
  description           TEXT NOT NULL DEFAULT '',
  priority              INTEGER NOT NULL DEFAULT 50 CHECK (priority BETWEEN 0 AND 99),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','live','archived')),
  is_default            INTEGER NOT NULL DEFAULT 0,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_core               INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  launched_at           TEXT,
  archived_at           TEXT,
  archived_from_status  TEXT CHECK (archived_from_status IN ('active','live'))
);
INSERT INTO projects_new
  SELECT id, name, icon, description, priority,
         CASE status WHEN 'completed' THEN 'active' ELSE status END,
         is_default, sort_order, is_core, created_at, updated_at, launched_at, archived_at,
         CASE archived_from_status WHEN 'completed' THEN NULL ELSE archived_from_status END
  FROM projects;
DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;
CREATE INDEX idx_projects_status ON projects(status);
CREATE UNIQUE INDEX idx_projects_core ON projects(is_core) WHERE is_core = 1;
"#;

/// V8：心灵寄语（Soul Notes，Pro 功能数据，按邮箱一行/一条；免费构建不读写，惰性存在）
/// - soul_notes：寄语正文，按 (email, id) 主键、sort_order 升序展示
/// - soul_notes_config：开关 + 切换时间 + 默认寄语播种标记（仅播种一次，删空不复活）
/// 随备份导出/导入 → 云备份 E2E 加密同步，服务器只见密文
const V8: &str = r#"
CREATE TABLE soul_notes (
  email      TEXT NOT NULL,
  id         TEXT NOT NULL,
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (email, id)
);
CREATE INDEX idx_soul_notes_email ON soul_notes(email);

CREATE TABLE soul_notes_config (
  email         TEXT PRIMARY KEY,
  enabled       INTEGER NOT NULL DEFAULT 0,
  interval_secs INTEGER NOT NULL DEFAULT 300,
  seeded        INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL
);
"#;

/// V9：心灵寄语默认寄语换新（功能未发布，仅内部测试阶段）。
/// 仅当某邮箱的寄语恰好是"未被改动过的旧默认集"（正好 5 条且与旧集一一相同）时，
/// 才将旧文本替换为新默认文本（id/排序保留）；用户增删改过的邮箱不受影响。
const V9: &str = r#"
UPDATE soul_notes
SET text = CASE text
  WHEN '每一步完成，都是来时路上的一枚脚印。' THEN '行百里者半九十'
  WHEN '日拱一卒，回头看时已是千里。' THEN '不忘初心，方得始终'
  WHEN '没有直接产出的付出，同样值得被记录。' THEN '一张一弛，文武之道也'
  WHEN '你比自己以为的走得更远——回看记录便知。' THEN '临渊羡鱼，不如退而结网'
  WHEN '认真做事，然后让记录替你讲述。' THEN '学而不思则罔，思而不学则殆'
END
WHERE email IN (
  SELECT email FROM soul_notes
  WHERE text IN (
    '每一步完成，都是来时路上的一枚脚印。',
    '日拱一卒，回头看时已是千里。',
    '没有直接产出的付出，同样值得被记录。',
    '你比自己以为的走得更远——回看记录便知。',
    '认真做事，然后让记录替你讲述。'
  )
  GROUP BY email
  HAVING COUNT(*) = 5 AND COUNT(DISTINCT text) = 5
);

UPDATE soul_notes
SET text = CASE text
  WHEN 'Progress is made one completed task at a time.' THEN 'The darkest hour is just before the dawn.'
  WHEN 'Small steps every day add up to a long road behind you.' THEN 'Where there''s a will, there''s a way.'
  WHEN 'Effort without visible output still counts — record it.' THEN 'All work and no play makes Jack a dull boy.'
  WHEN 'You have come further than you think. Look back and see.' THEN 'If wishes were horses, beggars would ride.'
  WHEN 'Do the work, then let the record tell your story.' THEN 'A little learning is a dangerous thing.'
END
WHERE email IN (
  SELECT email FROM soul_notes
  WHERE text IN (
    'Progress is made one completed task at a time.',
    'Small steps every day add up to a long road behind you.',
    'Effort without visible output still counts — record it.',
    'You have come further than you think. Look back and see.',
    'Do the work, then let the record tell your story.'
  )
  GROUP BY email
  HAVING COUNT(*) = 5 AND COUNT(DISTINCT text) = 5
);
"#;

/// V10：官方 AI 从"提供商预设"改为独立开关（2026-11-02，功能未发布、仅内部测试）。
/// - 旧版选择过 donetrace 提供商的用户视为已选择官方额度 → 自动开启 `ai_use_official`；
/// - 提供商统一重置为 openai_compatible：自有 API Key 永远优先，无 Key 时按开关回退官方额度。
const V10: &str = r#"
INSERT OR IGNORE INTO settings (key, value)
SELECT 'ai_use_official', '1'
WHERE EXISTS (
  SELECT 1 FROM settings WHERE key = 'ai_provider' AND value = 'donetrace'
);
UPDATE settings SET value = 'openai_compatible' WHERE key = 'ai_provider' AND value = 'donetrace';
"#;

/// V11：系统成就解锁记录（免费功能，2026-11-03，设计依据：系统成就设计 v1.0）。
/// 解锁即永久保留（不回滚，撤销/删除不回收）；进度不落库、由 achievements 模块实时聚合；
/// 随备份导出/导入同步（与个人档案同理），清除数据时一并清空。
const V11: &str = r#"
CREATE TABLE system_achievements (
  id          TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL
);
"#;

/// V12：个性化 AI 复盘档案（Pro 功能数据，按邮箱一行；免费构建不读写，惰性存在）。
/// 设计依据：个性化AI复盘设计 v0.2。随备份导出/导入 → 云备份 E2E 加密同步，服务器只见密文。
/// temperature 独立于 enabled（生成偏好，Pro 未登录/无记录时用默认 0.7）。
const V12: &str = r#"
CREATE TABLE ai_personalization (
  email       TEXT PRIMARY KEY,
  enabled     INTEGER NOT NULL DEFAULT 0,
  role        TEXT NOT NULL DEFAULT '',
  goals       TEXT NOT NULL DEFAULT '',
  tone        TEXT NOT NULL DEFAULT 'encouraging',
  focus       TEXT NOT NULL DEFAULT '',
  temperature REAL NOT NULL DEFAULT 0.7,
  updated_at  TEXT NOT NULL
);
"#;

pub(crate) fn migrate(conn: &mut Connection) -> DbResult<()> {
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
    use rusqlite::OptionalExtension;

    /// 跨平台数据目录：目录名恒为 DoneTrace（Windows 保持 %APPDATA%\DoneTrace 兼容）
    #[test]
    fn data_dir_uses_donetrace_folder() {
        let dir = data_dir().unwrap();
        assert_eq!(dir.file_name().and_then(|n| n.to_str()), Some("DoneTrace"));
    }

    /// 用内存库验证迁移与播种（比 V1 更早的版本不存在，直接从 0 开始）
    #[test]
    fn migrate_and_seed_on_fresh_db() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        migrate(&mut conn).unwrap();
        seed_default_project(&conn).unwrap();

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
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

        // V5 后的状态约束：live 合法（含 launched_at），未知状态非法
        conn.execute(
            "INSERT INTO projects (id, name, priority, status, is_default, created_at, updated_at, launched_at)
             VALUES ('t4', 'live-project', 50, 'live', 0, 'a', 'a', '2026-10-31T00:00:00+08:00')",
            [],
        )
        .unwrap();
        assert!(
            conn.execute(
                "INSERT INTO projects (id, name, priority, status, is_default, created_at, updated_at)
                 VALUES ('t5', 'bogus', 50, 'bogus', 0, 'a', 'a')",
                [],
            )
            .is_err()
        );
        // archived_from_status 允许 live（已上线项目归档后激活回原状态）
        conn.execute(
            "UPDATE projects SET status = 'archived', archived_from_status = 'live' WHERE id = 't4'",
            [],
        )
        .unwrap();
        assert!(conn
            .execute(
                "UPDATE projects SET archived_from_status = 'bogus' WHERE id = 't4'",
                [],
            )
            .is_err());

        // V6：profile 表存在且可写入
        conn.execute(
            "INSERT INTO profile (email, nickname, avatar, updated_at)
             VALUES ('a@x.com', 'alice', NULL, 'a')",
            [],
        )
        .unwrap();
        let (nickname,): (Option<String>,) = conn
            .query_row(
                "SELECT nickname FROM profile WHERE email = 'a@x.com'",
                [],
                |r| Ok((r.get(0)?,)),
            )
            .unwrap();
        assert_eq!(nickname.as_deref(), Some("alice"));

        // V7：completed 状态已彻底移除（CHECK 拒绝），completed_at 列已删除
        assert!(
            conn.execute(
                "INSERT INTO projects (id, name, priority, status, is_default, created_at, updated_at)
                 VALUES ('t6', 'c', 50, 'completed', 0, 'a', 'a')",
                [],
            )
            .is_err()
        );
        assert!(
            conn.execute(
                "INSERT INTO projects (id, name, priority, status, is_default, created_at, updated_at, completed_at)
                 VALUES ('t7', 'd', 50, 'active', 0, 'a', 'a', 'a')",
                [],
            )
            .is_err()
        );

        // V8：soul_notes / soul_notes_config 表存在且可写入（按邮箱隔离）
        conn.execute(
            "INSERT INTO soul_notes (email, id, text, sort_order, created_at, updated_at)
             VALUES ('a@x.com', 'n1', 'day by day', 1, 'a', 'a')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO soul_notes_config (email, enabled, interval_secs, seeded, updated_at)
             VALUES ('a@x.com', 1, 300, 1, 'a')",
            [],
        )
        .unwrap();
        let (text, enabled): (String, i64) = conn
            .query_row(
                "SELECT n.text, c.enabled FROM soul_notes n
                 JOIN soul_notes_config c ON c.email = n.email WHERE n.email = 'a@x.com'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(text, "day by day");
        assert_eq!(enabled, 1);
        // 同邮箱同 id 冲突（复合主键），不同邮箱互不影响
        assert!(conn
            .execute(
                "INSERT INTO soul_notes (email, id, text, sort_order, created_at, updated_at)
                 VALUES ('a@x.com', 'n1', 'dup', 2, 'a', 'a')",
                [],
            )
            .is_err());
        conn.execute(
            "INSERT INTO soul_notes (email, id, text, sort_order, created_at, updated_at)
             VALUES ('b@x.com', 'n1', 'other', 1, 'a', 'a')",
            [],
        )
        .unwrap();
    }

    /// V9：仅"未改动的旧默认集"被替换为新默认集；用户增删改过的邮箱不受影响
    #[test]
    fn v9_replaces_only_untouched_old_defaults() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        // 先迁移到 V8（V9 需单独验证）
        for (i, sql) in MIGRATIONS.iter().enumerate().take(8) {
            conn.execute_batch(sql).unwrap();
            conn.execute_batch(&format!("PRAGMA user_version = {};", i + 1))
                .unwrap();
        }

        // a@x.com：未改动的旧中文默认集 → 应整体替换为新集
        let old_zh = [
            "每一步完成，都是来时路上的一枚脚印。",
            "日拱一卒，回头看时已是千里。",
            "没有直接产出的付出，同样值得被记录。",
            "你比自己以为的走得更远——回看记录便知。",
            "认真做事，然后让记录替你讲述。",
        ];
        for (i, text) in old_zh.iter().enumerate() {
            conn.execute(
                "INSERT INTO soul_notes (email, id, text, sort_order, created_at, updated_at)
                 VALUES ('a@x.com', ?1, ?2, ?3, 'a', 'a')",
                rusqlite::params![format!("n{i}"), text, i as i64],
            )
            .unwrap();
        }
        conn.execute(
            "INSERT INTO soul_notes_config (email, enabled, interval_secs, seeded, updated_at)
             VALUES ('a@x.com', 0, 300, 1, 'a')",
            [],
        )
        .unwrap();

        // b@x.com：用户改动过（一条旧文 + 一条自创）→ 不应被替换
        conn.execute(
            "INSERT INTO soul_notes (email, id, text, sort_order, created_at, updated_at)
             VALUES ('b@x.com', 'n0', '日拱一卒，回头看时已是千里。', 0, 'a', 'a')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO soul_notes (email, id, text, sort_order, created_at, updated_at)
             VALUES ('b@x.com', 'n1', '自定义的一条', 1, 'a', 'a')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO soul_notes_config (email, enabled, interval_secs, seeded, updated_at)
             VALUES ('b@x.com', 0, 300, 1, 'a')",
            [],
        )
        .unwrap();

        conn.execute_batch(MIGRATIONS[8]).unwrap();

        let new_zh = [
            "行百里者半九十",
            "不忘初心，方得始终",
            "一张一弛，文武之道也",
            "临渊羡鱼，不如退而结网",
            "学而不思则罔，思而不学则殆",
        ];
        let mut stmt = conn
            .prepare("SELECT text FROM soul_notes WHERE email = 'a@x.com' ORDER BY sort_order ASC")
            .unwrap();
        let texts: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        assert_eq!(
            texts,
            new_zh.iter().map(|s| s.to_string()).collect::<Vec<_>>()
        );

        // b@x.com 保持不变
        let kept: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM soul_notes WHERE email = 'b@x.com'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(kept, 2);
        let custom: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM soul_notes WHERE email = 'b@x.com' AND text = '自定义的一条'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(custom, 1);
    }

    /// V10：旧版 provider = donetrace 的用户自动开启官方 AI 开关，且提供商重置
    #[test]
    fn v10_migrates_legacy_donetrace_provider() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        // 先迁移到 V9（V10 需单独验证）
        for (i, sql) in MIGRATIONS.iter().enumerate().take(9) {
            conn.execute_batch(sql).unwrap();
            conn.execute_batch(&format!("PRAGMA user_version = {};", i + 1))
                .unwrap();
        }

        // 旧数据：provider = donetrace（无自有 Key）
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('ai_provider', 'donetrace')",
            [],
        )
        .unwrap();
        conn.execute_batch(MIGRATIONS[9]).unwrap();

        let official: Option<String> = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'ai_use_official'",
                [],
                |r| r.get(0),
            )
            .optional()
            .unwrap();
        assert_eq!(official.as_deref(), Some("1"));
        let provider: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'ai_provider'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(provider, "openai_compatible");

        // 从未选择过 donetrace 的库：不产生开关行（保持默认关）
        let mut conn2 = Connection::open_in_memory().unwrap();
        conn2.pragma_update(None, "foreign_keys", "ON").unwrap();
        for (i, sql) in MIGRATIONS.iter().enumerate().take(9) {
            conn2.execute_batch(sql).unwrap();
            conn2
                .execute_batch(&format!("PRAGMA user_version = {};", i + 1))
                .unwrap();
        }
        conn2
            .execute(
                "INSERT INTO settings (key, value) VALUES ('ai_provider', 'anthropic')",
                [],
            )
            .unwrap();
        conn2.execute_batch(MIGRATIONS[9]).unwrap();
        let official2: Option<String> = conn2
            .query_row(
                "SELECT value FROM settings WHERE key = 'ai_use_official'",
                [],
                |r| r.get(0),
            )
            .optional()
            .unwrap();
        assert!(official2.is_none());
        let provider2: String = conn2
            .query_row(
                "SELECT value FROM settings WHERE key = 'ai_provider'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(provider2, "anthropic");
    }

    /// V11：system_achievements 表存在、主键幂等、可写入
    #[test]
    fn v11_creates_system_achievements() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        for (i, sql) in MIGRATIONS.iter().enumerate().take(10) {
            conn.execute_batch(sql).unwrap();
            conn.execute_batch(&format!("PRAGMA user_version = {};", i + 1))
                .unwrap();
        }
        conn.execute_batch(MIGRATIONS[10]).unwrap();

        conn.execute(
            "INSERT INTO system_achievements (id, unlocked_at) VALUES ('first_task', '2026-11-03T10:00:00+08:00')",
            [],
        )
        .unwrap();
        // 主键幂等：重复插入报错
        assert!(conn
            .execute(
                "INSERT INTO system_achievements (id, unlocked_at) VALUES ('first_task', 'x')",
                [],
            )
            .is_err());
        let (unlocked_at,): (String,) = conn
            .query_row(
                "SELECT unlocked_at FROM system_achievements WHERE id = 'first_task'",
                [],
                |r| Ok((r.get(0)?,)),
            )
            .unwrap();
        assert_eq!(unlocked_at, "2026-11-03T10:00:00+08:00");
    }

    /// V12：ai_personalization 表存在、按邮箱主键、默认值正确
    #[test]
    fn v12_creates_ai_personalization() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        for (i, sql) in MIGRATIONS.iter().enumerate().take(11) {
            conn.execute_batch(sql).unwrap();
            conn.execute_batch(&format!("PRAGMA user_version = {};", i + 1))
                .unwrap();
        }
        conn.execute_batch(MIGRATIONS[11]).unwrap();

        conn.execute(
            "INSERT INTO ai_personalization (email, updated_at) VALUES ('a@x.com', 'a')",
            [],
        )
        .unwrap();
        // 同邮箱重复插入报错（按邮箱一行）
        assert!(conn
            .execute(
                "INSERT INTO ai_personalization (email, updated_at) VALUES ('a@x.com', 'a')",
                [],
            )
            .is_err());
        let (enabled, role, goals, tone, focus, temperature): (i64, String, String, String, String, f64) =
            conn.query_row(
                "SELECT enabled, role, goals, tone, focus, temperature
                 FROM ai_personalization WHERE email = 'a@x.com'",
                [],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(enabled, 0);
        assert_eq!(role, "");
        assert_eq!(goals, "");
        assert_eq!(tone, "encouraging");
        assert_eq!(focus, "");
        assert!((temperature - 0.7).abs() < 1e-9);
    }
}
