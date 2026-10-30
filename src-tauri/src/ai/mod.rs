//! DeepSeek API 客户端（OpenAI 兼容协议，阻塞式，供 Tauri commands 调用）

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AiError {
    #[error("尚未配置 DeepSeek API Key，请先在「设置」中配置")]
    NoApiKey,
    #[error("该周期内没有已完成任务，暂无法分析")]
    EmptyPeriod,
    #[error("项目不存在")]
    ProjectNotFound,
    #[error("未找到该复盘日志")]
    LogNotFound,
    #[error("请求失败: {0}")]
    Request(String),
    #[error("API Key 无效（401），请检查设置")]
    Unauthorized,
    #[error("账户余额不足（402），请充值后重试")]
    InsufficientBalance,
    #[error("AI 返回格式异常")]
    InvalidResponse,
    #[error("读写日志文件失败: {0}")]
    Io(#[from] std::io::Error),
    #[error("数据库错误: {0}")]
    Sqlite(#[from] rusqlite::Error),
}

impl Serialize for AiError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        // 固定错误以错误码输出，由前端 i18n 翻译；动态错误原样透出
        match self {
            AiError::NoApiKey => serializer.serialize_str("ai.no_api_key"),
            AiError::EmptyPeriod => serializer.serialize_str("ai.empty_period"),
            AiError::ProjectNotFound => serializer.serialize_str("ai.project_not_found"),
            AiError::LogNotFound => serializer.serialize_str("ai.log_not_found"),
            AiError::Unauthorized => serializer.serialize_str("ai.unauthorized"),
            AiError::InsufficientBalance => serializer.serialize_str("ai.insufficient_balance"),
            AiError::InvalidResponse => serializer.serialize_str("ai.invalid_response"),
            AiError::Request(e) => serializer.serialize_str(&format!("ai.request: {e}")),
            AiError::Io(e) => serializer.serialize_str(&format!("ai.io: {e}")),
            AiError::Sqlite(e) => serializer.serialize_str(&format!("ai.sqlite: {e}")),
        }
    }
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    stream: bool,
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: ChatMessageResp,
}

#[derive(Deserialize)]
struct ChatMessageResp {
    content: Option<String>,
}

/// 发送一次对话请求，返回助手回复文本
pub fn chat(
    base_url: &str,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, AiError> {
    let url = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let body = ChatRequest {
        model,
        messages: vec![
            ChatMessage {
                role: "system",
                content: system,
            },
            ChatMessage {
                role: "user",
                content: user,
            },
        ],
        stream: false,
    };

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| AiError::Request(e.to_string()))?;

    let resp = client
        .post(&url)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .map_err(|e| AiError::Request(e.to_string()))?;

    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(AiError::Unauthorized);
    }
    if status == reqwest::StatusCode::PAYMENT_REQUIRED {
        return Err(AiError::InsufficientBalance);
    }
    if !status.is_success() {
        let text = resp.text().unwrap_or_default();
        let snippet: String = text.chars().take(200).collect();
        return Err(AiError::Request(format!("HTTP {status}: {snippet}")));
    }

    let data: ChatResponse = resp
        .json()
        .map_err(|e| AiError::Request(format!("解析响应失败: {e}")))?;
    data.choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .filter(|s| !s.trim().is_empty())
        .ok_or(AiError::InvalidResponse)
}
