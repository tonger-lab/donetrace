//! 分数规则权威实现（前端副本 src/lib/scoring.ts，双端各配单元测试互相印证）。

use serde::{Deserialize, Serialize};

/// 任务价值三档
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskValue {
    Normal,
    Important,
    Critical,
}

impl TaskValue {
    /// 价值系数：常规 x1.0 / 重要 x1.5 / 关键 x2.0
    pub fn multiplier(self) -> f64 {
        match self {
            TaskValue::Normal => 1.0,
            TaskValue::Important => 1.5,
            TaskValue::Critical => 2.0,
        }
    }
}

/// 实际得分 = 任务分数 × 任务价值系数
pub fn actual_score(score: i64, value: TaskValue) -> f64 {
    score as f64 * value.multiplier()
}

/// 价值档位 → 数据库存储字符串
pub fn value_to_str(v: TaskValue) -> &'static str {
    match v {
        TaskValue::Normal => "normal",
        TaskValue::Important => "important",
        TaskValue::Critical => "critical",
    }
}

/// 数据库字符串 → 价值档位
pub fn parse_value(s: &str) -> Option<TaskValue> {
    match s {
        "normal" => Some(TaskValue::Normal),
        "important" => Some(TaskValue::Important),
        "critical" => Some(TaskValue::Critical),
        _ => None,
    }
}

/// 价值档位中文标签
pub fn value_label(v: TaskValue) -> &'static str {
    match v {
        TaskValue::Normal => "常规",
        TaskValue::Important => "重要",
        TaskValue::Critical => "关键",
    }
}

/// 价值档位英文标签（AI 提示词本地化用）
pub fn value_label_en(v: TaskValue) -> &'static str {
    match v {
        TaskValue::Normal => "normal",
        TaskValue::Important => "important",
        TaskValue::Critical => "critical",
    }
}

/// 得分展示：整数不带小数位，非整数保留 1 位
pub fn fmt_score(n: f64) -> String {
    if n.fract() == 0.0 {
        format!("{}", n as i64)
    } else {
        format!("{:.1}", n)
    }
}

/// 工时折算展示：1 分 = 1 分钟，8 小时 = 1 天（与前端 src/lib/workhours.ts 保持一致）
/// 例：100 → "1小时40分"；605 → "1天2小时5分"；0 → "0分"
pub fn fmt_work_hours(score: f64) -> String {
    let total = (score.round().max(0.0)) as i64;
    let days = total / 480;
    let hours = (total % 480) / 60;
    let minutes = total % 60;

    let mut parts: Vec<String> = Vec::new();
    if days > 0 {
        parts.push(format!("{days}天"));
    }
    if hours > 0 {
        parts.push(format!("{hours}小时"));
    }
    if minutes > 0 {
        parts.push(format!("{minutes}分"));
    }
    if parts.is_empty() {
        "0分".to_string()
    } else {
        parts.join("")
    }
}

/// 英文工时折算展示（AI 提示词本地化用）：100 → "1h 40min"，0 → "0min"
pub fn fmt_work_hours_en(score: f64) -> String {
    let total = (score.round().max(0.0)) as i64;
    let days = total / 480;
    let hours = (total % 480) / 60;
    let minutes = total % 60;

    let mut parts: Vec<String> = Vec::new();
    if days > 0 {
        parts.push(format!("{days}d"));
    }
    if hours > 0 {
        parts.push(format!("{hours}h"));
    }
    if minutes > 0 {
        parts.push(format!("{minutes}min"));
    }
    if parts.is_empty() {
        "0min".to_string()
    } else {
        parts.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn actual_score_with_multipliers() {
        assert_eq!(actual_score(3, TaskValue::Normal), 3.0);
        assert_eq!(actual_score(3, TaskValue::Important), 4.5);
        assert_eq!(actual_score(4, TaskValue::Critical), 8.0);
    }

    #[test]
    fn multipliers_are_exact() {
        assert_eq!(TaskValue::Normal.multiplier(), 1.0);
        assert_eq!(TaskValue::Important.multiplier(), 1.5);
        assert_eq!(TaskValue::Critical.multiplier(), 2.0);
    }

    #[test]
    fn work_hours_formatting() {
        assert_eq!(fmt_work_hours(100.0), "1小时40分");
        assert_eq!(fmt_work_hours(480.0), "1天");
        assert_eq!(fmt_work_hours(605.0), "1天2小时5分");
        assert_eq!(fmt_work_hours(120.0), "2小时");
        assert_eq!(fmt_work_hours(5.0), "5分");
        assert_eq!(fmt_work_hours(0.0), "0分");
        assert_eq!(fmt_work_hours(4.6), "5分");
    }
}
