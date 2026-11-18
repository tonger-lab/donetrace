//! AI 复盘 Tauri commands（M4）
//!
//! - analyze_period：四类周期分析，结果按 (type, period_key) 唯一存储，再次分析覆盖
//! - analyze_project：项目复盘，正文落盘为 logs/{project_id}/{date}.md，同日覆盖
//! - list_project_logs / get_project_log：项目复盘日志的读取

use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, Timelike, Weekday};
use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use tauri::{Manager, State};

use crate::ai::{self, AiError};
use crate::commands::analysis::{
    collect_period_tasks, AnalysisPeriod, AnalysisReport, AnalysisTask,
};
use crate::commands::projects::{get_project, project_total, Project};
use crate::commands::settings::load_deepseek_config;
use crate::db::{data_dir, now_iso, Db};
use crate::period::today_key;
use crate::scoring::{
    fmt_score, fmt_work_hours, fmt_work_hours_en, parse_value, value_label, value_label_en,
    TaskValue,
};

// ---------------------------------------------------------------------------
// 时间背景（今日/本周复盘的剩余工作时间；2026-11-02 新增，2026-11-18 支持自定义）
// ---------------------------------------------------------------------------

/// 工作时间表（内置标准：周一至周五 9:00–18:00）。
/// Pro 用户保存过自定义工作时间后（`work_schedule` 表），本结构由 bridge 数据填充。
struct WorkSchedule {
    /// 周一~周日（0 = 休息，1 = 工作日）
    workdays: [bool; 7],
    /// 自午夜起的分钟数
    start_min: i64,
    end_min: i64,
    /// 是否来自用户自定义（影响提示词措辞）
    custom: bool,
}

impl Default for WorkSchedule {
    fn default() -> Self {
        Self {
            workdays: [true, true, true, true, true, false, false],
            start_min: 9 * 60,
            end_min: 18 * 60,
            custom: false,
        }
    }
}

impl WorkSchedule {
    fn minutes_per_day(&self) -> i64 {
        self.end_min - self.start_min
    }
}

/// 从用户自定义数据构造（数据非法回退内置标准）
fn schedule_from_parts(workdays: Vec<bool>, start: &str, end: &str) -> WorkSchedule {
    let mut days = [false; 7];
    if workdays.len() != 7 || !workdays.iter().any(|d| *d) {
        return WorkSchedule::default();
    }
    days.copy_from_slice(&workdays);
    let (Some(s), Some(e)) = (
        crate::commands::work_schedule::parse_hhmm(start),
        crate::commands::work_schedule::parse_hhmm(end),
    ) else {
        return WorkSchedule::default();
    };
    if s >= e {
        return WorkSchedule::default();
    }
    WorkSchedule {
        workdays: days,
        start_min: s,
        end_min: e,
        custom: true,
    }
}

fn is_workday(date: NaiveDate, schedule: &WorkSchedule) -> bool {
    schedule.workdays[date.weekday().num_days_from_monday() as usize]
}

/// 今天剩余工作时间（分钟）：开工前 = 全天；收工后或非工作日 = 0
fn remaining_minutes_today(now: NaiveDateTime, schedule: &WorkSchedule) -> i64 {
    if !is_workday(now.date(), schedule) {
        return 0;
    }
    let now_min = now.time().num_seconds_from_midnight() as i64 / 60;
    if now_min < schedule.start_min {
        return schedule.minutes_per_day();
    }
    if now_min >= schedule.end_min {
        return 0;
    }
    schedule.end_min - now_min
}

/// 本周（截至周日，ISO 周周一为起点）剩余工作时间（分钟）
fn remaining_minutes_week(now: NaiveDateTime, schedule: &WorkSchedule) -> i64 {
    let mut total = remaining_minutes_today(now, schedule);
    let days_until_sunday =
        Weekday::Sun.num_days_from_monday() as i64 - now.weekday().num_days_from_monday() as i64;
    for offset in 1..=days_until_sunday {
        let day = now.date() + Duration::days(offset);
        if is_workday(day, schedule) {
            total += schedule.minutes_per_day();
        }
    }
    total
}

fn weekday_zh(w: Weekday) -> &'static str {
    match w {
        Weekday::Mon => "周一",
        Weekday::Tue => "周二",
        Weekday::Wed => "周三",
        Weekday::Thu => "周四",
        Weekday::Fri => "周五",
        Weekday::Sat => "周六",
        Weekday::Sun => "周日",
    }
}

fn fmt_minutes_zh(m: i64) -> String {
    let (h, min) = (m / 60, m % 60);
    match (h, min) {
        (0, 0) => "0分钟".to_string(),
        (0, x) => format!("{x}分钟"),
        (x, 0) => format!("{x}小时"),
        (h, m) => format!("{h}小时{m}分"),
    }
}

fn fmt_minutes_en(m: i64) -> String {
    let (h, min) = (m / 60, m % 60);
    match (h, min) {
        (0, 0) => "0min".to_string(),
        (0, x) => format!("{x}min"),
        (x, 0) => format!("{x}h"),
        (h, m) => format!("{h}h {m}min"),
    }
}

/// 「时间背景」单行（今日/本周专用；昨日/上周已完全结束，返回 None）：
/// 当前时间 + 剩余工作时间，供 AI 判断"本期数据是快照还是接近最终"。
/// 免费版/未自定义：按内置标准（Mon–Fri 9:00–18:00）描述；自定义后按用户口径描述。
fn time_context(
    period: AnalysisPeriod,
    now: NaiveDateTime,
    zh: bool,
    schedule: &WorkSchedule,
) -> Option<String> {
    match period {
        AnalysisPeriod::Today | AnalysisPeriod::Week => {}
        AnalysisPeriod::Yesterday | AnalysisPeriod::LastWeek => return None,
    }
    let custom_note_zh = if schedule.custom {
        "（按你的自定义工作时间计）"
    } else {
        "（工作时间按 9:00–18:00 计）"
    };
    let custom_note_en = if schedule.custom {
        "(based on your custom working hours)"
    } else {
        "(working hours 9:00–18:00)"
    };
    if zh {
        let head = format!(
            "- 当前时间：{} {}。",
            weekday_zh(now.weekday()),
            now.format("%H:%M")
        );
        let body = match period {
            AnalysisPeriod::Today => {
                let r = remaining_minutes_today(now, schedule);
                if r == 0 {
                    "今天已无剩余工作时间（已过工作时间或今天为非工作日），本期数据接近最终。"
                        .to_string()
                } else {
                    format!(
                        "今天剩余工作时间约 {}{custom_note_zh}，后续还可能产生新的完成记录。",
                        fmt_minutes_zh(r)
                    )
                }
            }
            _ => {
                let r = remaining_minutes_week(now, schedule);
                if r == 0 {
                    "本周已无剩余工作时间（剩余日子均为休息日），本期数据接近最终。".to_string()
                } else {
                    format!(
                        "本周剩余工作时间约 {}{custom_note_zh}，后续还可能产生新的完成记录。",
                        fmt_minutes_zh(r)
                    )
                }
            }
        };
        Some(format!("{head}{body}"))
    } else {
        let head = format!(
            "- Current time: {} {}. ",
            now.format("%a"),
            now.format("%H:%M")
        );
        let body = match period {
            AnalysisPeriod::Today => {
                let r = remaining_minutes_today(now, schedule);
                if r == 0 {
                    "No working time remains today (past your working hours or a non-workday), so this data is close to final.".to_string()
                } else {
                    format!(
                        "About {} of working time remains today {custom_note_en}, so more completions may still come in.",
                        fmt_minutes_en(r)
                    )
                }
            }
            _ => {
                let r = remaining_minutes_week(now, schedule);
                if r == 0 {
                    "No working time remains this week (the remaining days are non-workdays), so this data is close to final."
                        .to_string()
                } else {
                    format!(
                        "About {} of working time remains this week {custom_note_en}, so more completions may still come in.",
                        fmt_minutes_en(r)
                    )
                }
            }
        };
        Some(format!("{head}{body}"))
    }
}

/// 周期分析（今日/昨日/本周/上周）专用提示词（中文）
const SYSTEM_PROMPT_PERIOD_ZH: &str = "\
你是「成迹 DoneTrace」的 AI 复盘助手。

成迹 DoneTrace 是一款个人成果记录工具，核心理念是：记录完成、让用户看清自己的来时路、增强自信；并协助用户定期复盘、发现问题。它适用于独立开发者、上班族等脑力工作者，并认为「投入了时间但暂无直接产出」的任务同样值得记录与肯定。

你会收到用户的本期成果记录，包含：
- 任务清单：任务名称、所属项目、任务描述、折算工时（工时已按 1 天 = 8 小时、并结合任务价值加权折算好）；
- 项目情报：项目名称、是否核心项目、项目简介。

重要：工时单位说明——记录中的「1 天」代表 8 个工时，不是自然日的 24 小时。例如「1天2小时30分」= 8 + 2.5 = 10.5 个工时。解读任何天数时请始终按 1 天 = 8 小时换算，不要把它理解成 24 小时。

请基于上述情报：
1. 给出本期分析结论（完成了什么、时间投入的结构如何）；
2. 尝试给出 1-3 条建设性、具体可执行的建议；
3. 语气鼓励但直率，像一个懂行的朋友；
4. 在结尾给予正向鼓励，肯定用户本期的投入；
5. 全文不超过 {WORD_LIMIT} 字，使用 Markdown 格式；
6. 尊重「投入了时间但暂无直接产出」的任务，不要否定它们的价值；
7. 始终使用中文回复，即使任务名称或描述中包含其他语言；
8. 若报告包含「时间背景」段（当前时间与剩余工作时间），请结合它把握复盘基调：剩余工作时间较多时，把本期数据视为仍在增长的快照，可展望后续可推进方向；临近结束或已无剩余时间时，把数据视为接近最终，以总结成果、肯定投入为主。
9. 若提示词末尾附有「【个性化】」指令块（Pro 个性化 AI 复盘），必须遵守其中的语气、复盘侧重点与「目标对照」输出要求。";

const SYSTEM_PROMPT_PERIOD_EN: &str = "\
You are the AI review assistant for DoneTrace.

DoneTrace is a personal achievement tracker. Its core philosophy: record what has been done, let users see the path they have walked and build confidence, and help them review periodically to spot problems. It serves knowledge workers such as indie developers and office workers, and it believes tasks where \"time was invested but there is no direct output yet\" are equally worth recording and affirming.

You will receive the user's achievement records for this period, including:
- Task list: task name, project, description, and converted work hours (already weighted: 1 day = 8 hours, adjusted by task value);
- Project brief: project name, whether it is a core project, and a short description.

IMPORTANT — work-hour unit: in these records, 1d means 8 work hours, NOT a 24-hour calendar day. For example, 1d 2h 30min = 8 + 2.5 = 10.5 work hours. Always convert days at 8 work hours per day; never treat a day as 24 hours.

Based on this information:
1. Give a conclusion for this period (what was accomplished and how time was structured);
2. Offer 1-3 constructive, concrete, actionable suggestions;
3. Be encouraging but frank, like a knowledgeable friend;
4. End with positive encouragement that affirms the user's effort;
5. Keep the whole reply under {WORD_LIMIT} words, in Markdown;
6. Respect tasks where time was invested but there is no direct output yet — do not devalue them;
7. Reply entirely in English, even if task names, descriptions, or project names appear in other languages.
8. If the report includes a \"Time context\" section (current time and remaining working hours), use it to set the review's tone: when plenty of working time remains, treat the data as a still-growing snapshot and suggest what to push forward next; when the period is nearly over or no time remains, treat the data as close to final and focus on summarizing and affirming the work.
9. If a \"[Personalization]\" instruction block is appended to the end of this prompt (Pro personalized reviews), you must follow its tone, review focus and \"Goals check-in\" requirements.";

/// 项目复盘专用提示词（中文）
const SYSTEM_PROMPT_PROJECT_ZH: &str = "\
你是「成迹 DoneTrace」的个人复盘教练，用户会把他的项目成果记录交给你分析。

成迹 DoneTrace 是一款个人成果记录工具，核心理念是：记录完成、让用户看清自己的来时路、增强自信；并协助用户定期复盘、发现问题。它认为「投入了时间但暂无直接产出」的任务同样值得记录与肯定。

要求：
1. 语气鼓励但直率，像一个懂行的朋友；
2. 输出三个部分：①本期亮点 ②发现的问题/风险 ③对下一周期的 1-3 条具体可执行建议；
3. 全文不超过 500 字，使用 Markdown 格式；
4. 在结尾给予正向鼓励；
5. 始终使用中文回复，即使任务名称或描述中包含其他语言。
6. 若提示词末尾附有「【个性化】」指令块（Pro 个性化 AI 复盘），必须遵守其中的语气与复盘侧重点要求（项目复盘不含目标对照）。";

const SYSTEM_PROMPT_PROJECT_EN: &str = "\
You are the personal review coach of DoneTrace. The user will hand you their project achievement records for analysis.

DoneTrace is a personal achievement tracker. Its core philosophy: record what has been done, let users see the path they have walked and build confidence, and help them review periodically to spot problems. It believes tasks where \"time was invested but there is no direct output yet\" are equally worth recording and affirming.

Requirements:
1. Be encouraging but frank, like a knowledgeable friend;
2. Output three sections: ① highlights of this period ② problems/risks found ③ 1-3 concrete, actionable suggestions for the next cycle;
3. Keep the whole reply under 500 words, in Markdown;
4. End with positive encouragement;
5. Reply entirely in English, even if task names or descriptions appear in other languages.
6. If a \"[Personalization]\" instruction block is appended to the end of this prompt (Pro personalized reviews), you must follow its tone and review focus (project reviews do not include goals check-in).";

/// 判断当前有效语言是否为中文：设置 zh-CN → 是；en → 否；auto → 按操作系统
fn is_zh(conn: &Connection) -> bool {
    let lang = crate::commands::settings::get_setting(conn, crate::commands::settings::KEY_LANG)
        .ok()
        .flatten()
        .unwrap_or_default();
    match lang.as_str() {
        "en" => false,
        "zh-CN" => true,
        _ => sys_locale::get_locale()
            .map(|l| l.to_lowercase().starts_with("zh"))
            .unwrap_or(false),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiLogEntry {
    pub project_id: String,
    pub log_date: String,
    pub content: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiLogMeta {
    pub log_date: String,
    pub file_path: String,
    pub created_at: String,
}

/// 任务清单涉及项目的简报（名称 / 是否核心 / 简介）
#[derive(Debug, Clone)]
struct ProjectInfo {
    name: String,
    is_core: bool,
    description: String,
}

/// 构造周期复盘上下文：
/// 总览（任务数 + 累计工时）→ 时间背景（今日/本周的剩余工作时间）→ 项目情报
/// → （可选）个性化档案段 → 任务清单（名称/项目/描述/折算工时，不含录入时间与原始分数）
#[allow(clippy::too_many_arguments)]
fn build_period_context(
    period: AnalysisPeriod,
    key: &str,
    tasks: &[AnalysisTask],
    total: f64,
    projects: &[ProjectInfo],
    zh: bool,
    now: NaiveDateTime,
    personalization: Option<&str>,
    schedule: &WorkSchedule,
) -> String {
    if zh {
        let mut s = format!(
            "# {} 成果记录（{}）\n\n## 总览\n- 完成任务：{} 个\n- 累计工时：{}\n",
            period.label(),
            key,
            tasks.len(),
            fmt_work_hours(total)
        );
        if let Some(ctx) = time_context(period, now, true, schedule) {
            s.push_str("\n## 时间背景\n");
            s.push_str(&ctx);
            s.push('\n');
        }

        s.push_str("\n## 项目情报\n");
        for p in projects {
            let kind = if p.is_core {
                "核心项目"
            } else {
                "普通项目"
            };
            let desc = if p.description.trim().is_empty() {
                "（无简介）".to_string()
            } else {
                p.description.trim().to_string()
            };
            s.push_str(&format!("- {}（{}）：{}\n", p.name, kind, desc));
        }

        if let Some(p) = personalization {
            s.push_str(p);
            s.push('\n');
        }

        s.push_str("\n## 任务清单\n");
        for (i, t) in tasks.iter().enumerate() {
            s.push_str(&format!(
                "{}. [{}] {}（工时 {}）",
                i + 1,
                t.task.project_name.as_deref().unwrap_or("未知项目"),
                t.task.name,
                fmt_work_hours(t.task.actual_score)
            ));
            let desc = t.task.description.trim();
            if !desc.is_empty() {
                s.push_str(&format!("\n   描述：{desc}"));
            }
            s.push('\n');
        }
        s
    } else {
        let mut s = format!(
            "# {} Achievement Record ({})\n\n## Overview\n- Tasks completed: {}\n- Work hours: {}\n",
            period.label_en(),
            key,
            tasks.len(),
            fmt_work_hours_en(total)
        );
        if let Some(ctx) = time_context(period, now, false, schedule) {
            s.push_str("\n## Time context\n");
            s.push_str(&ctx);
            s.push('\n');
        }

        s.push_str("\n## Project brief\n");
        for p in projects {
            let kind = if p.is_core {
                "core project"
            } else {
                "regular project"
            };
            let desc = if p.description.trim().is_empty() {
                "(no description)".to_string()
            } else {
                p.description.trim().to_string()
            };
            s.push_str(&format!("- {} ({kind}): {desc}\n", p.name));
        }

        if let Some(p) = personalization {
            s.push_str(p);
            s.push('\n');
        }

        s.push_str("\n## Task list\n");
        for (i, t) in tasks.iter().enumerate() {
            s.push_str(&format!(
                "{}. [{}] {} (work hours {})",
                i + 1,
                t.task.project_name.as_deref().unwrap_or("Unknown project"),
                t.task.name,
                fmt_work_hours_en(t.task.actual_score)
            ));
            let desc = t.task.description.trim();
            if !desc.is_empty() {
                s.push_str(&format!("\n   Description: {desc}"));
            }
            s.push('\n');
        }
        s
    }
}

fn load_config_or_err(
    conn: &Connection,
) -> Result<(String, String, Option<String>, String), AiError> {
    let cfg = load_deepseek_config(conn)?;
    Ok((cfg.provider, cfg.base_url, cfg.api_key, cfg.model))
}

/// AI 调用路由（优先级规则，纯函数便于单测；2026-11-02 拍板：官方 AI 优先）：
/// - `OfficialFirst`：官方 AI 开启（仅 Pro）→ 先走官方额度，失败（额度耗尽/权益无效/
///   未开通/未登录等）时若已配置自有 Key 则自动回退 BYOK；
/// - `Byok`：官方 AI 未开启但有自有 Key → 直连自有 API；
/// - `NotConfigured`：两者皆无 → 错误码引导（优先建议开启官方 AI）。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AiRoute {
    OfficialFirst,
    Byok,
    NotConfigured,
}

fn resolve_route(official_ai: bool, has_api_key: bool) -> AiRoute {
    if official_ai {
        AiRoute::OfficialFirst
    } else if has_api_key {
        AiRoute::Byok
    } else {
        AiRoute::NotConfigured
    }
}

#[cfg(feature = "pro")]
fn map_official_error(e: donetrace_pro::error::ProError) -> AiError {
    match e {
        donetrace_pro::error::ProError::Api { code, .. }
            if code == "AI_QUOTA_EXCEEDED"
                || code == "AI_ENTITLEMENT_REQUIRED"
                || code == "AI_DISABLED" =>
        {
            // 以错误码透出，前端按语言翻译（含引导文案）
            AiError::Code(format!("ai.{}", code.to_lowercase()))
        }
        donetrace_pro::error::ProError::NotLoggedIn => AiError::Code("ai.not_logged_in".into()),
        other => AiError::Request(other.to_string()),
    }
}

/// 按路由规则分发一次 AI 调用（官方 AI 优先，自有 Key 兜底）：
/// - 官方 AI 开启（仅 Pro）：先经服务端 /ai/proxy 代理（官方额度）；失败且已配置
///   自有 Key 时自动回退 BYOK；失败且无自有 Key 时返回错误码引导；
/// - 官方 AI 未开启：有自有 Key → BYOK 直连（anthropic 原生协议、其余 OpenAI 兼容）；
///   无自有 Key → 返回错误码引导（Pro 优先建议开启官方 AI；免费引导填 Key）。
#[allow(clippy::too_many_arguments)]
fn run_chat(
    app: &tauri::AppHandle,
    provider: &str,
    base_url: &str,
    api_key: Option<&str>,
    model: &str,
    official_ai: bool,
    system: &str,
    user: &str,
    temperature: f64,
) -> Result<String, AiError> {
    match resolve_route(official_ai, api_key.is_some()) {
        AiRoute::OfficialFirst => {
            #[cfg(feature = "pro")]
            {
                match donetrace_pro::tauri_bridge::ai_chat_blocking(
                    app,
                    system.to_string(),
                    user.to_string(),
                    temperature,
                ) {
                    Ok(content) => Ok(content),
                    Err(e) => {
                        // 官方 AI 不可用 → 已配置自有 Key 则回退 BYOK，否则透出错误码
                        if let Some(key) = api_key {
                            ai::chat(provider, base_url, key, model, system, user, temperature)
                        } else {
                            Err(map_official_error(e))
                        }
                    }
                }
            }
            #[cfg(not(feature = "pro"))]
            {
                unreachable!("免费构建 official_ai 恒为 false，不会进入 OfficialFirst 路由")
            }
        }
        AiRoute::Byok => {
            let key = api_key.expect("Byok 路由必有自有 Key");
            ai::chat(provider, base_url, key, model, system, user, temperature)
        }
        AiRoute::NotConfigured => {
            #[cfg(feature = "pro")]
            {
                let _ = app;
                Err(AiError::Code("ai.ai_not_configured".into()))
            }
            #[cfg(not(feature = "pro"))]
            {
                let _ = app;
                Err(AiError::NoApiKey)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- AI 路由优先级 ----------

    #[test]
    fn official_ai_takes_priority_over_own_key() {
        assert_eq!(resolve_route(true, true), AiRoute::OfficialFirst);
        assert_eq!(resolve_route(true, false), AiRoute::OfficialFirst);
    }

    #[test]
    fn own_key_used_when_official_ai_off() {
        assert_eq!(resolve_route(false, true), AiRoute::Byok);
    }

    #[test]
    fn neither_configured_guides_user() {
        assert_eq!(resolve_route(false, false), AiRoute::NotConfigured);
    }

    // ---------- 时间背景（剩余工作时间，9:00–18:00 周一至周五） ----------

    fn dt(y: i32, m: u32, d: u32, h: u32, min: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(y, m, d)
            .unwrap()
            .and_hms_opt(h, min, 0)
            .unwrap()
    }

    #[test]
    fn remaining_work_time_today() {
        let s = WorkSchedule::default();
        // 2026-11-02 是周一
        assert_eq!(remaining_minutes_today(dt(2026, 11, 2, 12, 0), &s), 360); // 中午 → 下午 6 小时
        assert_eq!(remaining_minutes_today(dt(2026, 11, 2, 8, 0), &s), 540); // 9 点前 → 全天
        assert_eq!(remaining_minutes_today(dt(2026, 11, 2, 20, 0), &s), 0); // 晚上 8 点 → 无剩余
        assert_eq!(remaining_minutes_today(dt(2026, 11, 7, 10, 0), &s), 0); // 周六 → 非工作日
    }

    #[test]
    fn remaining_work_time_week() {
        let s = WorkSchedule::default();
        // 周一 12:00：今天剩 6h + 周二~周五 4×9h = 42h
        assert_eq!(remaining_minutes_week(dt(2026, 11, 2, 12, 0), &s), 2520);
        // 周三 10:00：今天剩 8h + 周四/周五 2×9h = 26h
        assert_eq!(remaining_minutes_week(dt(2026, 11, 4, 10, 0), &s), 1560);
        // 周五 20:00：周六日非工作日 → 0
        assert_eq!(remaining_minutes_week(dt(2026, 11, 6, 20, 0), &s), 0);
        // 周日 → 0
        assert_eq!(remaining_minutes_week(dt(2026, 11, 8, 15, 0), &s), 0);
    }

    #[test]
    fn custom_schedule_weekend_worker() {
        // 周末工作者：周六/周日 22:00–23:30（每天 1.5h）
        let s = schedule_from_parts(
            vec![false, false, false, false, false, true, true],
            "22:00",
            "23:30",
        );
        assert!(s.custom);
        // 周三（非工作日）→ 今日无剩余
        assert_eq!(remaining_minutes_today(dt(2026, 11, 4, 10, 0), &s), 0);
        // 周六 21:00（开工前）→ 全天 90 分钟
        assert_eq!(remaining_minutes_today(dt(2026, 11, 7, 21, 0), &s), 90);
        // 周六 22:30 → 剩 60 分钟
        assert_eq!(remaining_minutes_today(dt(2026, 11, 7, 22, 30), &s), 60);
        // 周六 23:45（收工后）→ 0
        assert_eq!(remaining_minutes_today(dt(2026, 11, 7, 23, 45), &s), 0);
        // 周一视角：本周只剩周六+周日 2×90 = 180 分钟
        assert_eq!(remaining_minutes_week(dt(2026, 11, 2, 8, 0), &s), 180);
        // 时间背景文案标注自定义口径
        let zh = time_context(AnalysisPeriod::Today, dt(2026, 11, 7, 22, 30), true, &s).unwrap();
        assert!(zh.contains("自定义工作时间"), "{zh}");
        let en = time_context(AnalysisPeriod::Week, dt(2026, 11, 2, 8, 0), false, &s).unwrap();
        assert!(en.contains("custom working hours"), "{en}");
    }

    #[test]
    fn invalid_custom_schedule_falls_back_to_default() {
        // 起止倒挂 / 位数不足 → 内置标准
        let s = schedule_from_parts(vec![true, true], "18:00", "09:00");
        assert!(!s.custom);
        assert_eq!(s.minutes_per_day(), 540);
        assert_eq!(s.workdays, WorkSchedule::default().workdays);
    }

    #[test]
    fn time_context_only_for_today_and_week() {
        let s = WorkSchedule::default();
        let noon = dt(2026, 11, 2, 12, 0);
        // 今日/本周有「时间背景」，且包含剩余工作时间描述
        let today_zh = time_context(AnalysisPeriod::Today, noon, true, &s).unwrap();
        assert!(
            today_zh.contains("当前时间") && today_zh.contains("6小时"),
            "{today_zh}"
        );
        let week_en = time_context(AnalysisPeriod::Week, noon, false, &s).unwrap();
        assert!(
            week_en.contains("Current time") && week_en.contains("42h"),
            "{week_en}"
        );
        // 昨日/上周无「时间背景」
        assert!(time_context(AnalysisPeriod::Yesterday, noon, true, &s).is_none());
        assert!(time_context(AnalysisPeriod::LastWeek, noon, false, &s).is_none());
        // 晚上 8 点分析今日 → 明示无剩余时间
        let night_zh = time_context(AnalysisPeriod::Today, dt(2026, 11, 2, 20, 0), true, &s).unwrap();
        assert!(night_zh.contains("无剩余工作时间"), "{night_zh}");
    }
}

/// 默认生成温度（免费版固定；Pro 未登录/无档案记录时同值；设计文档拍板 6）
const AI_DEFAULT_TEMPERATURE: f64 = 0.7;

/// 读取个性化提示词（Pro）：**必须在两次 DB 锁之间调用**——loader 内部会自锁读库，
/// 主流程持锁时调用会重入死锁。免费构建恒为默认（无片段、温度 0.7）。
#[cfg(feature = "pro")]
fn fetch_personalization(
    app: &tauri::AppHandle,
    zh: bool,
    include_goals: bool,
) -> (String, String, f64, bool) {
    let p = match app.try_state::<donetrace_pro::tauri_bridge::Bridge>() {
        Some(bridge) => donetrace_pro::tauri_bridge::personalization_prompt(&bridge, zh, include_goals),
        None => Default::default(),
    };
    (p.system_extra, p.user_extra, p.temperature, p.has_goals)
}

#[cfg(not(feature = "pro"))]
fn fetch_personalization(
    _app: &tauri::AppHandle,
    _zh: bool,
    _include_goals: bool,
) -> (String, String, f64, bool) {
    (String::new(), String::new(), AI_DEFAULT_TEMPERATURE, false)
}

/// 读取自定义工作时间（Pro）：**必须在两次 DB 锁之间调用**——loader 内部自锁读库。
/// 免费构建 / 未登录 / 未保存过 = 内置标准（Mon–Fri 9:00–18:00）。
#[cfg(feature = "pro")]
fn fetch_work_schedule(app: &tauri::AppHandle) -> WorkSchedule {
    match app.try_state::<donetrace_pro::tauri_bridge::Bridge>() {
        Some(bridge) => match donetrace_pro::tauri_bridge::work_schedule(&bridge) {
            Some(d) => schedule_from_parts(d.workdays, &d.start, &d.end),
            None => WorkSchedule::default(),
        },
        None => WorkSchedule::default(),
    }
}

#[cfg(not(feature = "pro"))]
fn fetch_work_schedule(_app: &tauri::AppHandle) -> WorkSchedule {
    WorkSchedule::default()
}

#[tauri::command]
pub fn analyze_period(
    app: tauri::AppHandle,
    state: State<'_, Db>,
    period: AnalysisPeriod,
) -> Result<AnalysisReport, AiError> {
    // 第一段锁：读取配置、官方开关与语言（个性化读取内部自锁，须先释放本锁）
    let (provider, base_url, api_key, model, official_ai, zh) = {
        let conn = state.0.lock().expect("db mutex poisoned");
        let (provider, base_url, api_key, model) = load_config_or_err(&conn)?;
        let official_ai = {
            #[cfg(feature = "pro")]
            {
                crate::commands::settings::load_ai_use_official(&conn)?
            }
            #[cfg(not(feature = "pro"))]
            {
                false
            }
        };
        let zh = is_zh(&conn);
        (provider, base_url, api_key, model, official_ai, zh)
    };

    // 个性化提示词（周期复盘含 L3 目标对照）
    let (personalization_system, personalization_user, temperature, has_goals) =
        fetch_personalization(&app, zh, true);

    // 自定义工作时间（Pro 保存过才生效；否则内置标准 Mon–Fri 9:00–18:00）
    let work_schedule = fetch_work_schedule(&app);

    // 字数上限：今日/昨日 500，本周/上周 800（设计文档拍板 5）；注入目标对照 +150
    let base_limit: usize = match period {
        AnalysisPeriod::Today | AnalysisPeriod::Yesterday => 500,
        AnalysisPeriod::Week | AnalysisPeriod::LastWeek => 800,
    };
    let word_limit = base_limit + usize::from(has_goals) * 150;
    let mut system = (if zh {
        SYSTEM_PROMPT_PERIOD_ZH
    } else {
        SYSTEM_PROMPT_PERIOD_EN
    })
    .replace("{WORD_LIMIT}", &word_limit.to_string());
    if !personalization_system.is_empty() {
        system.push_str(&personalization_system);
    }

    // 第二段锁：主流程（收集任务 → 构造上下文 → 调用 → 写库）
    let conn = state.0.lock().expect("db mutex poisoned");
    let key = period.period_key();
    let mut tasks = collect_period_tasks(&conn, period)?;
    if tasks.is_empty() {
        return Err(AiError::EmptyPeriod);
    }
    let total: f64 = tasks.iter().map(|t| t.task.actual_score).sum();

    // 发送给 AI 的任务清单按完成时间正序（从早到晚），让 AI 按实际执行顺序复盘
    // （collect_period_tasks 为界面展示返回倒序，此处仅翻转 AI 上下文）
    tasks.reverse();

    // 收集任务清单涉及项目的简报
    let mut project_ids: Vec<String> = tasks.iter().map(|t| t.task.project_id.clone()).collect();
    project_ids.sort();
    project_ids.dedup();
    let mut projects: Vec<ProjectInfo> = Vec::new();
    for pid in &project_ids {
        let info = conn
            .query_row(
                "SELECT name, is_core, description FROM projects WHERE id = ?1",
                [pid],
                |r| {
                    Ok(ProjectInfo {
                        name: r.get(0)?,
                        is_core: r.get::<_, i64>(1)? != 0,
                        description: r.get(2)?,
                    })
                },
            )
            .optional()?;
        if let Some(info) = info {
            projects.push(info);
        }
    }

    let user = build_period_context(
        period,
        &key,
        &tasks,
        total,
        &projects,
        zh,
        chrono::Local::now().naive_local(),
        if personalization_user.is_empty() {
            None
        } else {
            Some(personalization_user.as_str())
        },
        &work_schedule,
    );
    let content = run_chat(
        &app,
        &provider,
        &base_url,
        api_key.as_deref(),
        &model,
        official_ai,
        &system,
        &user,
        temperature,
    )?;
    let now = now_iso();
    conn.execute(
        "INSERT INTO analysis_reports (type, period_key, content, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(type, period_key) DO UPDATE SET content = ?3, created_at = ?4",
        rusqlite::params![period.as_str(), key, content, now],
    )?;
    // 系统成就：生成 AI 复盘即时评估并广播解锁事件（同周期覆盖不新增行，评估幂等）
    crate::achievements::evaluate_and_notify(&app, &conn)?;
    Ok(AnalysisReport {
        period_key: key,
        content,
        created_at: now,
    })
}

#[tauri::command]
pub fn analyze_project(
    app: tauri::AppHandle,
    state: State<'_, Db>,
    project_id: String,
) -> Result<AiLogEntry, AiError> {
    // 第一段锁：读取配置、官方开关与语言（个性化读取内部自锁，须先释放本锁）
    let (provider, base_url, api_key, model, official_ai, zh) = {
        let conn = state.0.lock().expect("db mutex poisoned");
        let (provider, base_url, api_key, model) = load_config_or_err(&conn)?;
        let official_ai = {
            #[cfg(feature = "pro")]
            {
                crate::commands::settings::load_ai_use_official(&conn)?
            }
            #[cfg(not(feature = "pro"))]
            {
                false
            }
        };
        let zh = is_zh(&conn);
        (provider, base_url, api_key, model, official_ai, zh)
    };

    // 个性化提示词（项目复盘以项目自身为主，不含 L3 目标对照，设计文档拍板 2）
    let (personalization_system, personalization_user, temperature, _has_goals) =
        fetch_personalization(&app, zh, false);
    let mut system = (if zh {
        SYSTEM_PROMPT_PROJECT_ZH
    } else {
        SYSTEM_PROMPT_PROJECT_EN
    })
    .to_string();
    if !personalization_system.is_empty() {
        system.push_str(&personalization_system);
    }

    // 第二段锁：主流程（读项目 → 最近记录 → 构造上下文 → 调用 → 落盘）
    let conn = state.0.lock().expect("db mutex poisoned");
    let project: Project = get_project(&conn, &project_id)?.ok_or(AiError::ProjectNotFound)?;
    let total = project_total(&conn, &project_id)?;

    // 最近 20 条完成记录（SQL 取最新在前；发送给 AI 前翻转为时间正序）
    let mut stmt = conn.prepare(
        "SELECT name, value, score, completed_at FROM tasks
         WHERE project_id = ?1 AND status = 'done' AND completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT 20",
    )?;
    let rows = stmt.query_map([&project_id], |r| {
        Ok((
            r.get::<_, String>(0)?,
            r.get::<_, String>(1)?,
            r.get::<_, i64>(2)?,
            r.get::<_, String>(3)?,
        ))
    })?;
    let mut recent: Vec<(String, TaskValue, i64, String)> = Vec::new();
    for row in rows {
        let (name, value, score, completed_at) = row?;
        if let Some(v) = parse_value(&value) {
            recent.push((name, v, score, completed_at));
        }
    }
    // 按完成时间正序（从早到晚），让 AI 按实际执行顺序复盘
    recent.reverse();

    let mut user = if zh {
        format!(
            "# 项目「{}」复盘（{}）\n\n## 总览\n- 项目总分：{}\n- 最近完成记录（近 20 条）：{} 条\n",
            project.name,
            today_key(),
            fmt_score(total),
            recent.len()
        )
    } else {
        format!(
            "# Project \"{}\" Review ({})\n\n## Overview\n- Project total score: {}\n- Recent completions (up to 20): {}\n",
            project.name,
            today_key(),
            fmt_score(total),
            recent.len()
        )
    };
    for (name, value, score, _completed_at) in &recent {
        if zh {
            user.push_str(&format!(
                "- {} [{}]（{} 分 → {}）\n",
                name,
                value_label(*value),
                score,
                fmt_score(crate::scoring::actual_score(*score, *value))
            ));
        } else {
            user.push_str(&format!(
                "- {} [{}] ({} pts → {})\n",
                name,
                value_label_en(*value),
                score,
                fmt_score(crate::scoring::actual_score(*score, *value))
            ));
        }
    }
    if recent.is_empty() {
        if zh {
            user.push_str("（暂无完成记录）\n");
        } else {
            user.push_str("(no completed records yet)\n");
        }
    }
    if !personalization_user.is_empty() {
        user.push_str(&personalization_user);
    }

    let content = run_chat(
        &app,
        &provider,
        &base_url,
        api_key.as_deref(),
        &model,
        official_ai,
        &system,
        &user,
        temperature,
    )?;

    // 落盘 log 文件 + 索引（同日再次分析则覆盖）
    let date = today_key();
    let rel = format!("logs/{}/{date}.md", project_id);
    let base = data_dir().map_err(|e| AiError::Request(e.to_string()))?;
    let abs = base.join(&rel);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(&abs, &content)?;

    let now = now_iso();
    conn.execute(
        "INSERT INTO ai_logs (project_id, log_date, file_path, created_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id, log_date) DO UPDATE SET file_path = ?3, created_at = ?4",
        rusqlite::params![project_id, date, rel, now],
    )?;

    Ok(AiLogEntry {
        project_id,
        log_date: date,
        content,
        created_at: now,
    })
}

#[tauri::command]
pub fn list_project_logs(
    state: State<'_, Db>,
    project_id: String,
) -> Result<Vec<AiLogMeta>, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let mut stmt = conn.prepare(
        "SELECT log_date, file_path, created_at FROM ai_logs
         WHERE project_id = ?1 ORDER BY log_date DESC",
    )?;
    let rows = stmt.query_map([project_id], |r| {
        Ok(AiLogMeta {
            log_date: r.get(0)?,
            file_path: r.get(1)?,
            created_at: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

#[tauri::command]
pub fn get_project_log(
    state: State<'_, Db>,
    project_id: String,
    log_date: String,
) -> Result<String, AiError> {
    let conn = state.0.lock().expect("db mutex poisoned");
    let rel: Option<String> = conn
        .query_row(
            "SELECT file_path FROM ai_logs WHERE project_id = ?1 AND log_date = ?2",
            rusqlite::params![project_id, log_date],
            |r| r.get(0),
        )
        .optional()?;
    let rel = rel.ok_or(AiError::LogNotFound)?;
    let base = data_dir().map_err(|e| AiError::Request(e.to_string()))?;
    Ok(std::fs::read_to_string(base.join(rel))?)
}
