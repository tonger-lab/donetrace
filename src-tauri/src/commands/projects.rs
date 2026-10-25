//! 项目相关 Tauri commands
//!
//! 业务规则：
//! - 排序：手动排序（sort_order 字段），↑/↓ 移动；同 sort_order 按创建时间升序
//! - 状态仅 active / archived：归档项目不可修改、不可删除，仅可重新激活
//! - 删除保护：项目列表至少保留 1 个项目；包含任务（任何状态）时不可删除
//! - 默认项目可删除（与其他项目同等对待）
//! - completed 为历史遗留状态，迁移 V3 已统一转 active，仅保留解析兼容

use std::collections::HashMap;

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::tasks::{row_to_task, Task};
use crate::db::{now_iso, Db};
use crate::scoring::{actual_score, parse_value};

// ---------- 类型（与前端 src/types/project.ts 对齐） ----------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    Active,
    /// 历史遗留状态（迁移 V3 后不再产生，仅解析兼容）
    Completed,
    Archived,
}

impl ProjectStatus {
    fn parse(s: &str) -> Option<Self> {
        match s {
            "active" => Some(ProjectStatus::Active),
            "completed" => Some(ProjectStatus::Completed),
            "archived" => Some(ProjectStatus::Archived),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    /// 历史遗留字段（排序已改用 sort_order）
    pub priority: i64,
    pub status: ProjectStatus,
    pub is_default: bool,
    /// 核心项目（唯一，列表置顶）
    pub is_core: bool,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub archived_at: Option<String>,
    pub archived_from_status: Option<String>,
    /// 已完成任务实际得分之和
    pub total_score: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub name: String,
    pub icon: Option<String>,
    pub description: Option<String>,
}

/// 项目详情页：按日期倒序分组的完成时间线
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyGroup {
    pub date: String,
    pub tasks: Vec<Task>,
    pub score: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDetail {
    pub project: Project,
    pub pending_tasks: Vec<Task>,
    pub done_groups: Vec<DailyGroup>,
}

#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    #[error("项目不存在")]
    NotFound,
    #[error("已归档项目不可修改，请先重新激活")]
    ArchivedImmutable,
    #[error("项目内存在任务，无法删除（请先删除或移出全部任务）")]
    HasTasks,
    #[error("项目列表至少保留一个项目，无法删除最后一个项目")]
    AtLeastOne,
    #[error("项目名称不能为空")]
    InvalidName,
    #[error("已存在核心项目「{0}」，请先取消该项目的核心标记")]
    CoreExists(String),
    #[error("无效的移动方向（仅支持 up / down）")]
    InvalidDirection,
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl Serialize for ProjectError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

// ---------- 内部工具 ----------

const PROJECT_COLS: &str = "id, name, icon, description, priority, status, is_default, is_core,
                            created_at, updated_at, completed_at, archived_at, archived_from_status";

fn lock_conn<'a>(state: &'a State<'_, Db>) -> std::sync::MutexGuard<'a, Connection> {
    state.0.lock().expect("db mutex poisoned")
}

fn row_to_project(row: &rusqlite::Row<'_>) -> rusqlite::Result<Project> {
    let status_str: String = row.get("status")?;
    let status = ProjectStatus::parse(&status_str).ok_or(rusqlite::Error::InvalidQuery)?;
    Ok(Project {
        id: row.get("id")?,
        name: row.get("name")?,
        icon: row.get("icon")?,
        description: row.get("description")?,
        priority: row.get("priority")?,
        status,
        is_default: row.get::<_, i64>("is_default")? != 0,
        is_core: row.get::<_, i64>("is_core")? != 0,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        completed_at: row.get("completed_at")?,
        archived_at: row.get("archived_at")?,
        archived_from_status: row.get("archived_from_status")?,
        total_score: 0.0,
    })
}

pub(crate) fn get_project(conn: &Connection, id: &str) -> rusqlite::Result<Option<Project>> {
    conn.query_row(
        &format!("SELECT {PROJECT_COLS} FROM projects WHERE id = ?1"),
        [id],
        row_to_project,
    )
    .optional()
}

/// 加载项目（可选含归档），按手动排序（sort_order）返回，并计算各项目总分
fn load_projects(conn: &Connection, include_archived: bool) -> rusqlite::Result<Vec<Project>> {
    let sql = if include_archived {
        format!(
            "SELECT {PROJECT_COLS} FROM projects
             ORDER BY is_core DESC, sort_order ASC, created_at ASC, id ASC"
        )
    } else {
        format!(
            "SELECT {PROJECT_COLS} FROM projects WHERE status != 'archived'
             ORDER BY is_core DESC, sort_order ASC, created_at ASC, id ASC"
        )
    };
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], row_to_project)?;
    let mut projects: Vec<Project> = rows.collect::<rusqlite::Result<_>>()?;

    let mut stmt =
        conn.prepare("SELECT project_id, score, value FROM tasks WHERE status = 'done'")?;
    let rows = stmt.query_map([], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, i64>(1)?,
            r.get::<_, String>(2)?,
        ))
    })?;
    let mut scores: HashMap<String, f64> = HashMap::new();
    for row in rows {
        let (pid, score, value) = row?;
        if let Some(v) = parse_value(&value) {
            *scores.entry(pid).or_insert(0.0) += actual_score(score, v);
        }
    }
    for p in &mut projects {
        p.total_score = scores.get(&p.id).copied().unwrap_or(0.0);
    }
    Ok(projects)
}

pub(crate) fn project_total(conn: &Connection, id: &str) -> rusqlite::Result<f64> {
    let mut stmt = conn.prepare(
        "SELECT score, value FROM tasks WHERE project_id = ?1 AND status = 'done'",
    )?;
    let rows = stmt.query_map([id], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))?;
    let mut total = 0.0;
    for row in rows {
        let (score, value) = row?;
        if let Some(v) = parse_value(&value) {
            total += actual_score(score, v);
        }
    }
    Ok(total)
}

// ---------- Commands ----------

#[tauri::command]
pub fn list_projects(state: State<'_, Db>, include_archived: bool) -> Result<Vec<Project>, ProjectError> {
    let conn = lock_conn(&state);
    Ok(load_projects(&conn, include_archived)?)
}

#[tauri::command]
pub fn create_project(state: State<'_, Db>, input: ProjectInput) -> Result<Project, ProjectError> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ProjectError::InvalidName);
    }

    let conn = lock_conn(&state);
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_iso();
    let sort_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects",
        [],
        |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO projects
           (id, name, icon, description, priority, status, is_default, sort_order,
            created_at, updated_at, completed_at, archived_at, archived_from_status)
         VALUES (?1, ?2, ?3, ?4, 50, 'active', 0, ?5, ?6, ?6, NULL, NULL, NULL)",
        rusqlite::params![
            id,
            name,
            input.icon.unwrap_or_else(|| "📁".to_string()),
            input.description.unwrap_or_default(),
            sort_order,
            now
        ],
    )?;

    Ok(get_project(&conn, &id)?.expect("just inserted"))
}

#[tauri::command]
pub fn update_project(
    state: State<'_, Db>,
    id: String,
    input: ProjectInput,
) -> Result<Project, ProjectError> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(ProjectError::InvalidName);
    }

    let conn = lock_conn(&state);
    let old = get_project(&conn, &id)?.ok_or(ProjectError::NotFound)?;
    if old.status == ProjectStatus::Archived {
        return Err(ProjectError::ArchivedImmutable);
    }

    conn.execute(
        "UPDATE projects
         SET name = ?2, icon = ?3, description = ?4, updated_at = ?5
         WHERE id = ?1",
        rusqlite::params![
            id,
            name,
            input.icon.unwrap_or_else(|| old.icon.clone()),
            input.description.unwrap_or_else(|| old.description.clone()),
            now_iso()
        ],
    )?;

    let mut project = get_project(&conn, &id)?.expect("just updated");
    project.total_score = project_total(&conn, &id)?;
    Ok(project)
}

#[tauri::command]
pub fn delete_project(state: State<'_, Db>, id: String) -> Result<(), ProjectError> {
    let conn = lock_conn(&state);
    let project = get_project(&conn, &id)?.ok_or(ProjectError::NotFound)?;
    if project.status == ProjectStatus::Archived {
        return Err(ProjectError::ArchivedImmutable);
    }

    // 项目列表至少保留 1 个项目
    let list_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM projects WHERE status != 'archived'",
        [],
        |r| r.get(0),
    )?;
    if list_count <= 1 {
        return Err(ProjectError::AtLeastOne);
    }

    let task_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM tasks WHERE project_id = ?1",
        [&id],
        |r| r.get(0),
    )?;
    if task_count > 0 {
        return Err(ProjectError::HasTasks);
    }

    conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
    Ok(())
}

/// 手动排序：将项目在列表（未归档项目）中上移或下移一位
#[tauri::command]
pub fn move_project(state: State<'_, Db>, id: String, direction: String) -> Result<(), ProjectError> {
    let dir_up = match direction.as_str() {
        "up" => true,
        "down" => false,
        _ => return Err(ProjectError::InvalidDirection),
    };

    let mut conn = lock_conn(&state);
    let ids: Vec<String> = {
        let mut stmt = conn.prepare(
            "SELECT id FROM projects WHERE status != 'archived'
             ORDER BY sort_order ASC, created_at ASC, id ASC",
        )?;
        let rows = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .collect::<rusqlite::Result<_>>()?;
        rows
    };

    let Some(pos) = ids.iter().position(|x| x == &id) else {
        return Err(ProjectError::NotFound);
    };
    let target = if dir_up {
        pos.checked_sub(1)
    } else if pos + 1 < ids.len() {
        Some(pos + 1)
    } else {
        None
    };
    let Some(t) = target else {
        return Ok(()); // 已在边界，无需移动
    };

    let mut order = ids.clone();
    order.swap(pos, t);
    let tx = conn.transaction()?;
    for (i, pid) in order.iter().enumerate() {
        tx.execute(
            "UPDATE projects SET sort_order = ?2 WHERE id = ?1",
            rusqlite::params![pid, i as i64],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// 标记/取消核心项目（全局唯一，列表置顶）
#[tauri::command]
pub fn set_core_project(state: State<'_, Db>, id: String, core: bool) -> Result<Project, ProjectError> {
    let conn = lock_conn(&state);
    let project = get_project(&conn, &id)?.ok_or(ProjectError::NotFound)?;
    if project.status == ProjectStatus::Archived {
        return Err(ProjectError::ArchivedImmutable);
    }

    if core {
        // 唯一性：已存在其他核心项目则拒绝
        let existing: Option<String> = conn
            .query_row(
                "SELECT name FROM projects WHERE is_core = 1 AND id != ?1",
                [&id],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(name) = existing {
            return Err(ProjectError::CoreExists(name));
        }
        conn.execute(
            "UPDATE projects SET is_core = 1, updated_at = ?2 WHERE id = ?1",
            rusqlite::params![id, now_iso()],
        )?;
    } else {
        conn.execute(
            "UPDATE projects SET is_core = 0, updated_at = ?2 WHERE id = ?1",
            rusqlite::params![id, now_iso()],
        )?;
    }

    let mut project = get_project(&conn, &id)?.expect("just updated");
    project.total_score = project_total(&conn, &id)?;
    Ok(project)
}

#[tauri::command]
pub fn archive_project(state: State<'_, Db>, id: String) -> Result<Project, ProjectError> {
    let conn = lock_conn(&state);
    let project = get_project(&conn, &id)?.ok_or(ProjectError::NotFound)?;
    if project.status == ProjectStatus::Archived {
        let mut p = project;
        p.total_score = project_total(&conn, &id)?;
        return Ok(p); // 幂等
    }

    let now = now_iso();
    conn.execute(
        "UPDATE projects
         SET status = 'archived', archived_at = ?2, archived_from_status = 'active', updated_at = ?2
         WHERE id = ?1",
        rusqlite::params![id, now],
    )?;

    let mut project = get_project(&conn, &id)?.expect("just archived");
    project.total_score = project_total(&conn, &id)?;
    Ok(project)
}

#[tauri::command]
pub fn reactivate_project(state: State<'_, Db>, id: String) -> Result<Project, ProjectError> {
    let conn = lock_conn(&state);
    let project = get_project(&conn, &id)?.ok_or(ProjectError::NotFound)?;
    if project.status != ProjectStatus::Archived {
        let mut p = project;
        p.total_score = project_total(&conn, &id)?;
        return Ok(p); // 幂等
    }

    let now = now_iso();
    conn.execute(
        "UPDATE projects
         SET status = 'active', archived_at = NULL, archived_from_status = NULL, updated_at = ?2
         WHERE id = ?1",
        rusqlite::params![id, now],
    )?;

    let mut project = get_project(&conn, &id)?.expect("just reactivated");
    project.total_score = project_total(&conn, &id)?;
    Ok(project)
}

#[tauri::command]
pub fn get_project_detail(state: State<'_, Db>, id: String) -> Result<ProjectDetail, ProjectError> {
    let conn = lock_conn(&state);
    let mut project = get_project(&conn, &id)?.ok_or(ProjectError::NotFound)?;
    project.total_score = project_total(&conn, &id)?;

    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, description, value, score, status,
                created_at, updated_at, completed_at
         FROM tasks WHERE project_id = ?1
         ORDER BY COALESCE(completed_at, created_at) DESC, id ASC",
    )?;
    let rows = stmt.query_map([&id], row_to_task)?;
    let tasks: Vec<Task> = rows.collect::<rusqlite::Result<_>>()?;

    let mut pending_tasks: Vec<Task> = Vec::new();
    let mut done_groups: Vec<DailyGroup> = Vec::new();
    for task in tasks {
        match task.status {
            crate::commands::tasks::TaskStatus::Pending => pending_tasks.push(task),
            crate::commands::tasks::TaskStatus::Done => {
                let date = task
                    .completed_at
                    .as_deref()
                    .map(|s| s.chars().take(10).collect::<String>())
                    .unwrap_or_default();
                match done_groups.iter_mut().find(|g| g.date == date) {
                    Some(group) => {
                        group.score += task.actual_score;
                        group.tasks.push(task);
                    }
                    None => done_groups.push(DailyGroup {
                        date: date.clone(),
                        score: task.actual_score,
                        tasks: vec![task],
                    }),
                }
            }
        }
    }

    Ok(ProjectDetail {
        project,
        pending_tasks,
        done_groups,
    })
}
