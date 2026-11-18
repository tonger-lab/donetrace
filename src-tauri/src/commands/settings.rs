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
const KEY_PROVIDER: &str = "ai_provider";
/// 官方 AI 开关（Pro 专属，默认关；自 2026-11 起从"提供商预设"改为独立开关，
/// 入口在个人档案页，不再出现在设置页）
const KEY_AI_USE_OFFICIAL: &str = "ai_use_official";

/// 提供商协议：openai_compatible（默认，覆盖 DeepSeek/OpenAI/Gemini/Mistral/OpenRouter/Groq/Ollama）
/// / anthropic（原生 Messages API）。官方额度不再是提供商预设，而是独立开关（仅 Pro）。
pub const DEFAULT_PROVIDER: &str = "openai_compatible";
const VALID_PROVIDERS: [&str; 2] = ["openai_compatible", "anthropic"];

/// 是否 Pro 构建：前端据此门控 Pro 界面（官方安装包 true；社区构建恒为 false）。
/// 命令本身始终存在，两种构建都可调用。
#[tauri::command]
pub fn is_pro_build() -> bool {
    cfg!(feature = "pro")
}

// ---------------------------------------------------------------------------
// 应用内更新（tauri-plugin-updater；免费版与 Pro 共用）
// ---------------------------------------------------------------------------

/// Linux 更新能力纯函数：AppImage 自更新；deb 等包格式不支持应用内更新 → 引导官网。
/// （AppImage 运行时由打包器注入 APPIMAGE 环境变量；deb 安装无该变量。）
fn linux_update_capability(appimage_env: Option<&str>) -> &'static str {
    match appimage_env {
        Some(v) if !v.is_empty() => "full",
        _ => "website",
    }
}

fn update_capability() -> &'static str {
    #[cfg(target_os = "linux")]
    {
        linux_update_capability(std::env::var("APPIMAGE").ok().as_deref())
    }
    #[cfg(not(target_os = "linux"))]
    {
        "full"
    }
}

/// 更新能力："full" = 支持应用内下载安装；"website" = 需引导到官网下载（deb 等）。
#[tauri::command]
pub fn get_update_capability() -> String {
    update_capability().to_string()
}

/// 用系统默认浏览器打开官网（免费版下载入口等；Pro 已有 pro_open_website 专用命令）。
#[tauri::command]
pub fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

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
    pub provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetDeepSeekConfigInput {
    /// None 或空串 = 保持现有 Key 不变
    pub api_key: Option<String>,
    pub base_url: String,
    pub model: String,
    #[serde(default)]
    pub provider: Option<String>,
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
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| {
        r.get(0)
    })
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
    pub provider: String,
}

pub(crate) fn load_deepseek_config(conn: &Connection) -> Result<DeepSeekConfig, rusqlite::Error> {
    let provider = get_setting(conn, KEY_PROVIDER)?
        .unwrap_or_else(|| DEFAULT_PROVIDER.to_string());
    // 旧版曾把官方额度作为提供商预设（provider = donetrace）；迁移 V10 已将其重置，
    // 此处兜底归一化，避免旧数据走通未知协议分支。
    let provider = if provider == "donetrace" {
        DEFAULT_PROVIDER.to_string()
    } else {
        provider
    };
    Ok(DeepSeekConfig {
        api_key: get_setting(conn, KEY_API_KEY)?,
        base_url: get_setting(conn, KEY_BASE_URL)?.unwrap_or_else(|| DEFAULT_BASE_URL.to_string()),
        model: get_setting(conn, KEY_MODEL)?.unwrap_or_else(|| DEFAULT_MODEL.to_string()),
        provider,
    })
}

/// 官方 AI 开关（Pro 专属，默认关；入口在个人档案页）。
/// 仅在未配置自有 API Key 时生效——自有 Key 永远优先（BYOK 原则）。
/// 免费构建无 UI 与调用方（仅 Pro 通过注入闭包与 ai.rs 路由读取）。
#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn load_ai_use_official(conn: &Connection) -> rusqlite::Result<bool> {
    Ok(get_setting(conn, KEY_AI_USE_OFFICIAL)?.as_deref() == Some("1"))
}

#[cfg_attr(not(feature = "pro"), allow(dead_code))]
pub(crate) fn save_ai_use_official(conn: &Connection, enabled: bool) -> rusqlite::Result<()> {
    set_setting(conn, KEY_AI_USE_OFFICIAL, if enabled { "1" } else { "0" })
}

#[tauri::command]
pub fn get_deepseek_config(state: State<'_, Db>) -> Result<DeepSeekConfigView, SettingsError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let cfg = load_deepseek_config(&conn)?;
    Ok(DeepSeekConfigView {
        has_api_key: cfg.api_key.is_some(),
        base_url: cfg.base_url,
        model: cfg.model,
        provider: cfg.provider,
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
    set_setting(
        &conn,
        KEY_MODEL,
        if model.is_empty() {
            DEFAULT_MODEL
        } else {
            model
        },
    )?;
    if let Some(provider) = input.provider {
        let provider = provider.trim();
        if VALID_PROVIDERS.contains(&provider) {
            set_setting(&conn, KEY_PROVIDER, provider)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn test_deepseek_connection(
    state: State<'_, Db>,
) -> Result<String, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let cfg = load_deepseek_config(&conn)?;

    // 设置页只测 BYOK 自有 Key（官方 AI 的连通性由个人档案页额度面板体现）
    let api_key = cfg.api_key.ok_or(AiError::NoApiKey)?;
    ai::chat(
        &cfg.provider,
        &cfg.base_url,
        &api_key,
        &cfg.model,
        "你是一个连通性测试助手。",
        "请只回复两个字：正常",
        0.7,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linux_capability_depends_on_appimage_env() {
        assert_eq!(linux_update_capability(Some("/path/DoneTrace.AppImage")), "full");
        assert_eq!(linux_update_capability(Some("")), "website");
        assert_eq!(linux_update_capability(None), "website");
    }
}
