//! 设置相关 Tauri commands（M4/M5）
//!
//! DeepSeek API 配置存于 settings 表；API Key 只写不读（对外仅返回是否已配置）。

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::ai::{self, AiError};
use crate::db::Db;

const KEY_API_KEY: &str = "deepseek_api_key";
const KEY_BASE_URL: &str = "deepseek_base_url";
const KEY_MODEL: &str = "deepseek_model";

/// 界面语言：auto = 跟随操作系统
pub(crate) const KEY_LANG: &str = "lang";
pub(crate) const LANG_DEFAULT: &str = "auto";
const VALID_LANGS: [&str; 3] = ["auto", "en", "zh-CN"];

pub const DEFAULT_BASE_URL: &str = "https://api.deepseek.com";
pub const DEFAULT_MODEL: &str = "deepseek-chat";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepSeekConfigView {
    pub has_api_key: bool,
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDeepSeekConfigInput {
    /// None 或空串 = 保持现有 Key 不变
    pub api_key: Option<String>,
    pub base_url: String,
    pub model: String,
}

#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("无效的语言设置: {0}")]
    InvalidLanguage(String),
}

impl Serialize for SettingsError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // 错误码由前端 i18n 翻译；动态信息（Sqlite 内部错误）不对外透出
        match self {
            SettingsError::Sqlite(_) => serializer.serialize_str("settings.sqlite"),
            SettingsError::InvalidLanguage(_) => {
                serializer.serialize_str("settings.invalid_language")
            }
        }
    }
}

pub(crate) fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
        .optional()
}

pub(crate) fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        [key, value],
    )?;
    Ok(())
}

pub(crate) struct DeepSeekConfig {
    pub api_key: Option<String>,
    pub base_url: String,
    pub model: String,
}

pub(crate) fn load_deepseek_config(conn: &Connection) -> Result<DeepSeekConfig, rusqlite::Error> {
    Ok(DeepSeekConfig {
        api_key: get_setting(conn, KEY_API_KEY)?,
        base_url: get_setting(conn, KEY_BASE_URL)?
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string()),
        model: get_setting(conn, KEY_MODEL)?.unwrap_or_else(|| DEFAULT_MODEL.to_string()),
    })
}

#[tauri::command]
pub fn get_deepseek_config(state: State<'_, Db>) -> Result<DeepSeekConfigView, SettingsError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let cfg = load_deepseek_config(&conn)?;
    Ok(DeepSeekConfigView {
        has_api_key: cfg.api_key.is_some(),
        base_url: cfg.base_url,
        model: cfg.model,
    })
}

#[tauri::command]
pub fn set_deepseek_config(
    state: State<'_, Db>,
    input: SetDeepSeekConfigInput,
) -> Result<(), SettingsError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    if let Some(key) = input.api_key {
        let key = key.trim();
        if !key.is_empty() {
            set_setting(&conn, KEY_API_KEY, key)?;
        }
    }
    let base_url = input.base_url.trim();
    set_setting(
        &conn,
        KEY_BASE_URL,
        if base_url.is_empty() {
            DEFAULT_BASE_URL
        } else {
            base_url
        },
    )?;
    let model = input.model.trim();
    set_setting(&conn, KEY_MODEL, if model.is_empty() { DEFAULT_MODEL } else { model })?;
    Ok(())
}

#[tauri::command]
pub fn test_deepseek_connection(state: State<'_, Db>) -> Result<String, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let cfg = load_deepseek_config(&conn)?;
    let api_key = cfg.api_key.ok_or(AiError::NoApiKey)?;
    ai::chat(
        &cfg.base_url,
        &api_key,
        &cfg.model,
        "你是一个连通性测试助手。",
        "请只回复两个字：正常",
    )?;
    Ok("连接成功，API 可用".to_string())
}

// ---------- 语言设置（前端 i18n） ----------

/// 读取界面语言设置：auto = 跟随系统（默认）
#[tauri::command]
pub fn get_language(state: State<'_, Db>) -> Result<String, SettingsError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    Ok(get_setting(&conn, KEY_LANG)?.unwrap_or_else(|| LANG_DEFAULT.to_string()))
}

/// 写入界面语言设置（auto / en / zh-CN）
#[tauri::command]
pub fn set_language(state: State<'_, Db>, lang: String) -> Result<(), SettingsError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let lang = lang.trim().to_string();
    if !VALID_LANGS.contains(&lang.as_str()) {
        return Err(SettingsError::InvalidLanguage(lang));
    }
    set_setting(&conn, KEY_LANG, &lang)?;
    Ok(())
}

/// 操作系统语言（如 zh-CN / en-US），检测失败时回退 "en"
#[tauri::command]
pub fn get_system_locale() -> Result<String, SettingsError> {
    Ok(sys_locale::get_locale().unwrap_or_else(|| "en".to_string()))
}
