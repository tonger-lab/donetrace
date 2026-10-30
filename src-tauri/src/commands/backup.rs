//! 数据管理 Tauri commands（M5）：导出 / 导入 / 一键清除
//!
//! 导出：zip（data.json + logs/**）→ 保存对话框选择位置；不含 API Key
//! 导入：解析预览 → merge（同 id 覆盖）/ replace（清空后重建）；settings（含 API Key）不受影响
//! 清除：清空项目/任务/分析报告/复盘日志并重建默认项目；settings 保留

use std::collections::HashSet;
use std::fs::File;
use std::io::{Cursor, Read, Write};
use std::path::Path;

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_dialog::DialogExt;

use crate::db::{data_dir, now_iso, seed_default_project, Db};

// ---------- 备份文件结构 ----------

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ProjectRow {
    id: String,
    name: String,
    icon: String,
    description: String,
    priority: i64,
    status: String,
    is_default: i64,
    sort_order: i64,
    is_core: i64,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
    archived_at: Option<String>,
    archived_from_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct TaskRow {
    id: String,
    project_id: String,
    name: String,
    description: String,
    value: String,
    score: i64,
    status: String,
    created_at: String,
    updated_at: String,
    completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct SettingRow {
    key: String,
    value: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ReportRow {
    #[serde(rename = "type")]
    report_type: String,
    period_key: String,
    content: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LogRow {
    project_id: String,
    log_date: String,
    file_path: String,
    created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupData {
    version: i32,
    exported_at: String,
    projects: Vec<ProjectRow>,
    tasks: Vec<TaskRow>,
    settings: Vec<SettingRow>,
    analysis_reports: Vec<ReportRow>,
    ai_logs: Vec<LogRow>,
}

const BACKUP_VERSION: i32 = 1;

// ---------- 对外结构 ----------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPreview {
    pub projects: i64,
    pub tasks: i64,
    pub reports: i64,
    pub logs: i64,
    pub new_projects: i64,
    pub new_tasks: i64,
    pub new_reports: i64,
    pub new_logs: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub projects_created: i64,
    pub projects_updated: i64,
    pub tasks_created: i64,
    pub tasks_updated: i64,
    pub reports_created: i64,
    pub reports_updated: i64,
    pub logs_created: i64,
    pub logs_updated: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum BackupError {
    #[error("不是有效的备份文件: {0}")]
    InvalidFile(String),
    #[error("备份文件版本不受支持")]
    UnsupportedVersion,
    #[error("无效的导入模式")]
    InvalidMode,
    #[error("备份文件解析失败: {0}")]
    Json(#[from] serde_json::Error),
    #[error("打包/解包失败: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("文件读写失败: {0}")]
    Io(#[from] std::io::Error),
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("数据库错误: {0}")]
    Db(#[from] crate::db::DbError),
}

impl Serialize for BackupError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

// ---------- 内部工具 ----------

fn lock_conn<'a>(state: &'a State<'_, Db>) -> std::sync::MutexGuard<'a, Connection> {
    state.0.lock().expect("db mutex poisoned")
}

fn dump_projects(conn: &Connection) -> rusqlite::Result<Vec<ProjectRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, description, priority, status, is_default, sort_order, is_core,
                created_at, updated_at, completed_at, archived_at, archived_from_status FROM projects",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(ProjectRow {
            id: r.get(0)?,
            name: r.get(1)?,
            icon: r.get(2)?,
            description: r.get(3)?,
            priority: r.get(4)?,
            status: r.get(5)?,
            is_default: r.get(6)?,
            sort_order: r.get(7)?,
            is_core: r.get(8)?,
            created_at: r.get(9)?,
            updated_at: r.get(10)?,
            completed_at: r.get(11)?,
            archived_at: r.get(12)?,
            archived_from_status: r.get(13)?,
        })
    })?;
    rows.collect()
}

fn dump_tasks(conn: &Connection) -> rusqlite::Result<Vec<TaskRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, description, value, score, status, created_at,
                updated_at, completed_at FROM tasks",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(TaskRow {
            id: r.get(0)?,
            project_id: r.get(1)?,
            name: r.get(2)?,
            description: r.get(3)?,
            value: r.get(4)?,
            score: r.get(5)?,
            status: r.get(6)?,
            created_at: r.get(7)?,
            updated_at: r.get(8)?,
            completed_at: r.get(9)?,
        })
    })?;
    rows.collect()
}

fn dump_settings(conn: &Connection) -> rusqlite::Result<Vec<SettingRow>> {
    let mut stmt =
        conn.prepare("SELECT key, value FROM settings WHERE key != 'deepseek_api_key'")?;
    let rows = stmt.query_map([], |r| {
        Ok(SettingRow {
            key: r.get(0)?,
            value: r.get(1)?,
        })
    })?;
    rows.collect()
}

fn dump_reports(conn: &Connection) -> rusqlite::Result<Vec<ReportRow>> {
    let mut stmt =
        conn.prepare("SELECT type, period_key, content, created_at FROM analysis_reports")?;
    let rows = stmt.query_map([], |r| {
        Ok(ReportRow {
            report_type: r.get(0)?,
            period_key: r.get(1)?,
            content: r.get(2)?,
            created_at: r.get(3)?,
        })
    })?;
    rows.collect()
}

fn dump_logs(conn: &Connection) -> rusqlite::Result<Vec<LogRow>> {
    let mut stmt =
        conn.prepare("SELECT project_id, log_date, file_path, created_at FROM ai_logs")?;
    let rows = stmt.query_map([], |r| {
        Ok(LogRow {
            project_id: r.get(0)?,
            log_date: r.get(1)?,
            file_path: r.get(2)?,
            created_at: r.get(3)?,
        })
    })?;
    rows.collect()
}

/// 解析备份文件（data.json），附带校验版本
fn parse_backup(path: &str) -> Result<BackupData, BackupError> {
    let file = File::open(path)?;
    let mut archive = zip::ZipArchive::new(file)?;
    let mut entry = archive
        .by_name("data.json")
        .map_err(|_| BackupError::InvalidFile("缺少 data.json".to_string()))?;
    let mut text = String::new();
    entry.read_to_string(&mut text)?;
    let data: BackupData =
        serde_json::from_str(&text).map_err(|e| BackupError::InvalidFile(e.to_string()))?;
    if data.version != BACKUP_VERSION {
        return Err(BackupError::UnsupportedVersion);
    }
    Ok(data)
}

/// 校验 log 文件相对路径（防止路径穿越）
fn safe_log_rel(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);
    if path.is_absolute() || file_path.contains("..") {
        return None;
    }
    let mut comps = path.components().map(|c| c.as_os_str().to_string_lossy());
    if comps.next().as_deref() != Some("logs") {
        return None;
    }
    Some(file_path.to_string())
}

fn exists_project(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    conn.query_row("SELECT 1 FROM projects WHERE id = ?1", [id], |_| Ok(()))
        .optional()
        .map(|o| o.is_some())
}

fn exists_task(conn: &Connection, id: &str) -> rusqlite::Result<bool> {
    conn.query_row("SELECT 1 FROM tasks WHERE id = ?1", [id], |_| Ok(()))
        .optional()
        .map(|o| o.is_some())
}

fn exists_report(conn: &Connection, report_type: &str, period_key: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT 1 FROM analysis_reports WHERE type = ?1 AND period_key = ?2",
        [report_type, period_key],
        |_| Ok(()),
    )
    .optional()
    .map(|o| o.is_some())
}

fn exists_log(conn: &Connection, project_id: &str, log_date: &str) -> rusqlite::Result<bool> {
    conn.query_row(
        "SELECT 1 FROM ai_logs WHERE project_id = ?1 AND log_date = ?2",
        [project_id, log_date],
        |_| Ok(()),
    )
    .optional()
    .map(|o| o.is_some())
}

// ---------- Commands ----------

/// 导出：保存对话框 → 写 zip → 返回路径（取消返回 null）
#[tauri::command]
pub fn export_data(
    app: tauri::AppHandle,
    state: State<'_, Db>,
) -> Result<Option<String>, BackupError> {
    let bytes = build_backup_zip(&state)?;

    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let default_name = format!("DoneTrace-backup-{stamp}.zip");
    let picked = app
        .dialog()
        .file()
        .add_filter("DoneTrace 备份", &["zip"])
        .set_file_name(&default_name)
        .blocking_save_file();
    let Some(path) = picked else {
        return Ok(None);
    };
    let path = path
        .into_path()
        .map_err(|e| BackupError::InvalidFile(e.to_string()))?;

    std::fs::write(&path, bytes)?;
    Ok(Some(path.to_string_lossy().to_string()))
}

/// 构建备份 zip 字节（本地导出与 Pro 云端备份共用；不含 API Key）
pub fn build_backup_zip(state: &State<'_, Db>) -> Result<Vec<u8>, BackupError> {
    let conn = lock_conn(state);

    let data = BackupData {
        version: BACKUP_VERSION,
        exported_at: now_iso(),
        projects: dump_projects(&conn)?,
        tasks: dump_tasks(&conn)?,
        settings: dump_settings(&conn)?,
        analysis_reports: dump_reports(&conn)?,
        ai_logs: dump_logs(&conn)?,
    };
    let json = serde_json::to_vec_pretty(&data)?;

    // 打包：data.json + 日志文件
    let base = data_dir().map_err(|e| BackupError::InvalidFile(e.to_string()))?;
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let opts = zip::write::SimpleFileOptions::default();
    zip.start_file("data.json", opts)?;
    zip.write_all(&json)?;
    let mut seen: HashSet<String> = HashSet::new();
    for log in &data.ai_logs {
        let rel = match safe_log_rel(&log.file_path) {
            Some(r) => r,
            None => continue,
        };
        if !seen.insert(rel.clone()) {
            continue;
        }
        if let Ok(content) = std::fs::read(base.join(&rel)) {
            zip.start_file(&rel, opts)?;
            zip.write_all(&content)?;
        }
    }
    Ok(zip.finish()?.into_inner())
}

/// 打开选择备份文件对话框，返回路径（取消返回 null）
#[tauri::command]
pub fn pick_backup_file(app: tauri::AppHandle) -> Option<String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("DoneTrace 备份", &["zip"])
        .blocking_pick_file();
    picked
        .and_then(|p| p.into_path().ok())
        .map(|p| p.to_string_lossy().to_string())
}

/// 导入预览：解析文件并统计新增数量
#[tauri::command]
pub fn preview_import(state: State<'_, Db>, path: String) -> Result<ImportPreview, BackupError> {
    let conn = lock_conn(&state);
    let data = parse_backup(&path)?;

    let mut new_projects = 0;
    let mut new_tasks = 0;
    let mut new_reports = 0;
    let mut new_logs = 0;

    let mut project_ids: HashSet<String> = HashSet::new();
    for p in &data.projects {
        if project_ids.insert(p.id.clone()) && !exists_project(&conn, &p.id)? {
            new_projects += 1;
        }
    }
    let mut task_ids: HashSet<String> = HashSet::new();
    for t in &data.tasks {
        if task_ids.insert(t.id.clone()) && !exists_task(&conn, &t.id)? {
            new_tasks += 1;
        }
    }
    let mut report_keys: HashSet<(String, String)> = HashSet::new();
    for r in &data.analysis_reports {
        let key = (r.report_type.clone(), r.period_key.clone());
        if report_keys.insert(key.clone()) && !exists_report(&conn, &key.0, &key.1)? {
            new_reports += 1;
        }
    }
    let mut log_keys: HashSet<(String, String)> = HashSet::new();
    for l in &data.ai_logs {
        let key = (l.project_id.clone(), l.log_date.clone());
        if log_keys.insert(key.clone()) && !exists_log(&conn, &key.0, &key.1)? {
            new_logs += 1;
        }
    }

    Ok(ImportPreview {
        projects: data.projects.len() as i64,
        tasks: data.tasks.len() as i64,
        reports: data.analysis_reports.len() as i64,
        logs: data.ai_logs.len() as i64,
        new_projects,
        new_tasks,
        new_reports,
        new_logs,
    })
}

/// 执行导入：merge（同 id 覆盖）/ replace（清空数据后重建）
#[tauri::command]
pub fn import_data(
    state: State<'_, Db>,
    path: String,
    mode: String,
) -> Result<ImportSummary, BackupError> {
    import_zip(&state, path, mode)
}

/// 导入实现（本地导入与 Pro 云端恢复共用）
pub fn import_zip(
    state: &State<'_, Db>,
    path: String,
    mode: String,
) -> Result<ImportSummary, BackupError> {
    let mut conn = lock_conn(state);
    let data = parse_backup(&path)?;
    let base = data_dir().map_err(|e| BackupError::InvalidFile(e.to_string()))?;

    let mut summary = ImportSummary {
        projects_created: 0,
        projects_updated: 0,
        tasks_created: 0,
        tasks_updated: 0,
        reports_created: 0,
        reports_updated: 0,
        logs_created: 0,
        logs_updated: 0,
    };

    let tx = conn.transaction()?;

    if mode == "replace" {
        // 清空记录类数据（settings 保留），外键安全顺序
        tx.execute("DELETE FROM tasks", [])?;
        tx.execute("DELETE FROM ai_logs", [])?;
        tx.execute("DELETE FROM analysis_reports", [])?;
        tx.execute("DELETE FROM projects", [])?;
    } else if mode != "merge" {
        return Err(BackupError::InvalidMode);
    }

    // 项目
    for p in &data.projects {
        if mode == "replace" || !exists_project(&tx, &p.id)? {
            tx.execute(
                "INSERT INTO projects
                   (id, name, icon, description, priority, status, is_default, sort_order, is_core,
                    created_at, updated_at, completed_at, archived_at, archived_from_status)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
                rusqlite::params![
                    p.id,
                    p.name,
                    p.icon,
                    p.description,
                    p.priority,
                    p.status,
                    p.is_default,
                    p.sort_order,
                    p.is_core,
                    p.created_at,
                    p.updated_at,
                    p.completed_at,
                    p.archived_at,
                    p.archived_from_status
                ],
            )?;
            summary.projects_created += 1;
        } else {
            tx.execute(
                "UPDATE projects SET name=?2, icon=?3, description=?4, priority=?5, status=?6,
                        is_default=?7, sort_order=?8, is_core=?9, created_at=?10, updated_at=?11,
                        completed_at=?12, archived_at=?13, archived_from_status=?14
                 WHERE id=?1",
                rusqlite::params![
                    p.id,
                    p.name,
                    p.icon,
                    p.description,
                    p.priority,
                    p.status,
                    p.is_default,
                    p.sort_order,
                    p.is_core,
                    p.created_at,
                    p.updated_at,
                    p.completed_at,
                    p.archived_at,
                    p.archived_from_status
                ],
            )?;
            summary.projects_updated += 1;
        }
    }

    // 任务
    for t in &data.tasks {
        if mode == "replace" || !exists_task(&tx, &t.id)? {
            tx.execute(
                "INSERT INTO tasks
                   (id, project_id, name, description, value, score, status, created_at,
                    updated_at, completed_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
                rusqlite::params![
                    t.id,
                    t.project_id,
                    t.name,
                    t.description,
                    t.value,
                    t.score,
                    t.status,
                    t.created_at,
                    t.updated_at,
                    t.completed_at
                ],
            )?;
            summary.tasks_created += 1;
        } else {
            tx.execute(
                "UPDATE tasks SET project_id=?2, name=?3, description=?4, value=?5, score=?6,
                        status=?7, created_at=?8, updated_at=?9, completed_at=?10
                 WHERE id=?1",
                rusqlite::params![
                    t.id,
                    t.project_id,
                    t.name,
                    t.description,
                    t.value,
                    t.score,
                    t.status,
                    t.created_at,
                    t.updated_at,
                    t.completed_at
                ],
            )?;
            summary.tasks_updated += 1;
        }
    }

    // 分析报告
    for r in &data.analysis_reports {
        if mode == "replace" || !exists_report(&tx, &r.report_type, &r.period_key)? {
            tx.execute(
                "INSERT INTO analysis_reports (type, period_key, content, created_at)
                 VALUES (?1,?2,?3,?4)",
                rusqlite::params![r.report_type, r.period_key, r.content, r.created_at],
            )?;
            summary.reports_created += 1;
        } else {
            tx.execute(
                "UPDATE analysis_reports SET content=?3, created_at=?4
                 WHERE type=?1 AND period_key=?2",
                rusqlite::params![r.report_type, r.period_key, r.content, r.created_at],
            )?;
            summary.reports_updated += 1;
        }
    }

    // 复盘日志：行 + 落盘文件
    let mut log_files: Vec<(String, String)> = Vec::new(); // (abs_path, content)
    for l in &data.ai_logs {
        let rel = format!("logs/{}/{}.md", l.project_id, l.log_date);
        if mode == "replace" || !exists_log(&tx, &l.project_id, &l.log_date)? {
            tx.execute(
                "INSERT INTO ai_logs (project_id, log_date, file_path, created_at)
                 VALUES (?1,?2,?3,?4)",
                rusqlite::params![l.project_id, l.log_date, rel, l.created_at],
            )?;
            summary.logs_created += 1;
        } else {
            tx.execute(
                "UPDATE ai_logs SET file_path=?3, created_at=?4
                 WHERE project_id=?1 AND log_date=?2",
                rusqlite::params![l.project_id, l.log_date, rel, l.created_at],
            )?;
            summary.logs_updated += 1;
        }
        log_files.push((base.join(&rel).to_string_lossy().to_string(), String::new()));
    }

    tx.commit()?;

    // 事务提交后写日志文件
    let mut archive = zip::ZipArchive::new(File::open(&path)?)?;
    for (abs, _) in &mut log_files {
        let rel = Path::new(abs.as_str())
            .strip_prefix(&base)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        if let Ok(mut entry) = archive.by_name(&rel) {
            let mut content = String::new();
            entry.read_to_string(&mut content)?;
            if let Some(parent) = Path::new(abs).parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::write(abs, content)?;
        }
    }

    // 重建默认项目（若项目表为空）
    seed_default_project(&conn)?;

    Ok(summary)
}

/// 一键清除：清空记录类数据并重建默认项目（settings 保留）
#[tauri::command]
pub fn clear_all_data(state: State<'_, Db>) -> Result<(), BackupError> {
    let mut conn = lock_conn(&state);
    let base = data_dir().map_err(|e| BackupError::InvalidFile(e.to_string()))?;

    // 先收集日志文件并删除
    let paths: Vec<String> = {
        let mut stmt = conn.prepare("SELECT file_path FROM ai_logs")?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<_>>()?;
        rows
    };
    for rel in paths {
        if let Some(rel) = safe_log_rel(&rel) {
            let _ = std::fs::remove_file(base.join(rel));
        }
    }

    let tx = conn.transaction()?;
    tx.execute("DELETE FROM tasks", [])?;
    tx.execute("DELETE FROM ai_logs", [])?;
    tx.execute("DELETE FROM analysis_reports", [])?;
    tx.execute("DELETE FROM projects", [])?;
    tx.commit()?;

    seed_default_project(&conn)?;
    Ok(())
}
