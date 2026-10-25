//! 任务相关 Tauri commands（M1）
//!
//! 业务规则：
//! - 添加任务要求所属项目处于 active 状态
//! - 修改/删除/勾选要求所属项目未归档（归档项目是成就记录，只读）
//! - 实际得分 = 任务分数 × 任务价值系数（见 crate::scoring）

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{now_iso, Db};
use crate::scoring::{actual_score, parse_value, value_to_str, TaskValue};

// ---------- 类型（与前端 src/types/task.ts 对齐） ----------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Done,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub description: String,
    pub value: TaskValue,
    pub score: i64,
    pub status: TaskStatus,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    /// 实际得分（含价值系数）
    pub actual_score: f64,
    /// 所属项目信息（list_tasks / 分析查询时填充）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_icon: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub value: TaskValue,
    pub score: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    pub project_id: String,
    pub name: String,
    pub description: Option<String>,
    pub value: TaskValue,
    pub score: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum TaskError {
    #[error("项目不存在")]
    ProjectNotFound,
    #[error("目标项目必须处于进行中状态才能添加任务")]
    ProjectNotActive,
    #[error("项目已归档，无法修改其任务")]
    ProjectArchived,
    #[error("任务不存在")]
    NotFound,
    #[error("任务名称不能为空")]
    InvalidName,
    #[error("分数必须是正整数")]
    InvalidScore,
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl Serialize for TaskError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

// ---------- 内部工具 ----------

fn lock_conn<'a>(state: &'a State<'_, Db>) -> std::sync::MutexGuard<'a, Connection> {
    state.0.lock().expect("db mutex poisoned")
}

pub(crate) fn row_to_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    let value_str: String = row.get("value")?;
    let value = parse_value(&value_str).ok_or(rusqlite::Error::InvalidQuery)?;
    let score: i64 = row.get("score")?;
    let status: String = row.get("status")?;
    Ok(Task {
        id: row.get("id")?,
        project_id: row.get("project_id")?,
        name: row.get("name")?,
        description: row.get("description")?,
        value,
        score,
        status: if status == "done" {
            TaskStatus::Done
        } else {
            TaskStatus::Pending
        },
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        completed_at: row.get("completed_at")?,
        actual_score: actual_score(score, value),
        project_name: None,
        project_icon: None,
    })
}

fn get_task(conn: &Connection, id: &str) -> rusqlite::Result<Option<Task>> {
    conn.query_row(
        "SELECT id, project_id, name, description, value, score, status,
                created_at, updated_at, completed_at
         FROM tasks WHERE id = ?1",
        [id],
        row_to_task,
    )
    .optional()
}

fn project_status(conn: &Connection, id: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT status FROM projects WHERE id = ?1", [id], |r| r.get(0))
        .optional()
}

// ---------- Commands ----------

#[tauri::command]
pub fn list_tasks(state: State<'_, Db>, project_id: Option<String>) -> Result<Vec<Task>, TaskError> {
    let conn = lock_conn(&state);
    let mut stmt = conn.prepare(
        "SELECT t.id, t.project_id, t.name, t.description, t.value, t.score, t.status,
                t.created_at, t.updated_at, t.completed_at,
                p.name, p.icon
         FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE (?1 IS NULL OR t.project_id = ?1)
         ORDER BY t.updated_at DESC, t.id ASC",
    )?;
    let rows = stmt.query_map([project_id], |r| {
        let mut task = row_to_task(r)?;
        task.project_name = Some(r.get(10)?);
        task.project_icon = Some(r.get(11)?);
        Ok(task)
    })?;
    let mut tasks = Vec::new();
    for row in rows {
        tasks.push(row?);
    }
    Ok(tasks)
}

#[tauri::command]
pub fn create_task(state: State<'_, Db>, input: CreateTaskInput) -> Result<Task, TaskError> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(TaskError::InvalidName);
    }
    if input.score <= 0 {
        return Err(TaskError::InvalidScore);
    }

    let conn = lock_conn(&state);
    let status = project_status(&conn, &input.project_id)?.ok_or(TaskError::ProjectNotFound)?;
    if status != "active" {
        return Err(TaskError::ProjectNotActive);
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_iso();
    conn.execute(
        "INSERT INTO tasks (id, project_id, name, description, value, score, status,
                            created_at, updated_at, completed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?7, NULL)",
        rusqlite::params![
            id,
            input.project_id,
            name,
            input.description.unwrap_or_default(),
            value_to_str(input.value),
            input.score,
            now
        ],
    )?;

    Ok(get_task(&conn, &id)?.expect("just inserted"))
}

#[tauri::command]
pub fn update_task(state: State<'_, Db>, id: String, input: UpdateTaskInput) -> Result<Task, TaskError> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err(TaskError::InvalidName);
    }
    if input.score <= 0 {
        return Err(TaskError::InvalidScore);
    }

    let conn = lock_conn(&state);
    let old = get_task(&conn, &id)?.ok_or(TaskError::NotFound)?;
    let new_status =
        project_status(&conn, &input.project_id)?.ok_or(TaskError::ProjectNotFound)?;
    if new_status == "archived" {
        return Err(TaskError::ProjectArchived);
    }
    // 换项目：新项目必须是进行中；原项目不动时仅要求未归档
    if input.project_id != old.project_id && new_status != "active" {
        return Err(TaskError::ProjectNotActive);
    }

    let now = now_iso();
    let affected = conn.execute(
        "UPDATE tasks
         SET project_id = ?2, name = ?3, description = ?4, value = ?5, score = ?6, updated_at = ?7
         WHERE id = ?1",
        rusqlite::params![
            id,
            input.project_id,
            name,
            input.description.unwrap_or_default(),
            value_to_str(input.value),
            input.score,
            now
        ],
    )?;
    if affected == 0 {
        return Err(TaskError::NotFound);
    }

    Ok(get_task(&conn, &id)?.expect("just updated"))
}

#[tauri::command]
pub fn toggle_task_done(state: State<'_, Db>, id: String, done: bool) -> Result<Task, TaskError> {
    let conn = lock_conn(&state);
    let task = get_task(&conn, &id)?.ok_or(TaskError::NotFound)?;
    let status = project_status(&conn, &task.project_id)?.ok_or(TaskError::ProjectNotFound)?;
    if status == "archived" {
        return Err(TaskError::ProjectArchived);
    }

    let now = now_iso();
    if done {
        conn.execute(
            "UPDATE tasks SET status = 'done', completed_at = ?2, updated_at = ?2 WHERE id = ?1",
            rusqlite::params![id, now],
        )?;
    } else {
        // 撤销完成：清空完成时间，退出所有统计
        conn.execute(
            "UPDATE tasks SET status = 'pending', completed_at = NULL, updated_at = ?2 WHERE id = ?1",
            rusqlite::params![id, now],
        )?;
    }

    Ok(get_task(&conn, &id)?.expect("just toggled"))
}

#[tauri::command]
pub fn delete_task(state: State<'_, Db>, id: String) -> Result<(), TaskError> {
    let conn = lock_conn(&state);
    let task = get_task(&conn, &id)?.ok_or(TaskError::NotFound)?;
    let status = project_status(&conn, &task.project_id)?.ok_or(TaskError::ProjectNotFound)?;
    if status == "archived" {
        return Err(TaskError::ProjectArchived);
    }

    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])?;
    Ok(())
}
