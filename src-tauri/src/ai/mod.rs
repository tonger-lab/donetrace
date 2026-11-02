//! AI 客户端：OpenAI 兼容协议（DeepSeek/OpenAI/Gemini/Mistral/OpenRouter/Groq/Ollama 等）
//! 与 Anthropic 原生协议；阻塞式，供 Tauri commands 调用。

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AiError {
    #[error("尚未配置 AI API Key，请先在「设置」中配置")]
    NoApiKey,
    #[error("该周期内没有已完成任务，暂无法分析")]
    EmptyPeriod,
    #[error("项目不存在")]
    ProjectNotFound,
    #[error("未找到该复盘日志")]
    LogNotFound,
    #[error("请求失败: {0}")]
    Request(String),
    #[error("错误码: {0}")]
    #[cfg_attr(not(feature = "pro"), allow(dead_code))]
    Code(String),
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
            AiError::Code(c) => serializer.serialize_str(c),
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

/// 按提供商协议分发：anthropic → 原生 Messages API；其余 → OpenAI 兼容 chat/completions。
/// （官方 AI 不走本函数：由 commands/ai.rs 在未配置自有 Key 时经 /ai/proxy 调用。）
pub fn chat(
    provider: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, AiError> {
    if provider == "anthropic" {
        chat_anthropic(base_url, api_key, model, system, user)
    } else {
        chat_openai_compat(base_url, api_key, model, system, user)
    }
}

/// 发送一次 OpenAI 兼容对话请求，返回助手回复文本
fn chat_openai_compat(
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

/// Anthropic 原生 Messages API（x-api-key + anthropic-version 头）
fn chat_anthropic(
    base_url: &str,
    api_key: &str,
    model: &str,
    system: &str,
    user: &str,
) -> Result<String, AiError> {
    let url = format!("{}/messages", base_url.trim_end_matches('/'));
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 4096,
        "system": system,
        "messages": [ { "role": "user", "content": user } ],
    });

    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| AiError::Request(e.to_string()))?;

    let resp = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
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

    let data: serde_json::Value = resp
        .json()
        .map_err(|e| AiError::Request(format!("解析响应失败: {e}")))?;
    data["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|b| b["text"].as_str())
        .map(str::to_string)
        .filter(|s| !s.trim().is_empty())
        .ok_or(AiError::InvalidResponse)
}
