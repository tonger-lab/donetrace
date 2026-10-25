//! 周期键计算（权威实现；前端副本 src/lib/period.ts）。
//! 周一为一周起点（ISO 周），周期键按设备本地时区计算。

use chrono::{Datelike, Duration, Local, NaiveDate, Weekday};

/// 日期键：YYYY-MM-DD
pub fn date_key(d: NaiveDate) -> String {
    d.format("%Y-%m-%d").to_string()
}

/// 今日键
pub fn today_key() -> String {
    date_key(Local::now().date_naive())
}

/// 昨日键
pub fn yesterday_key() -> String {
    date_key(Local::now().date_naive() - Duration::days(1))
}

/// ISO 周键：YYYY-Www
pub fn week_key(d: NaiveDate) -> String {
    let w = d.iso_week();
    format!("{}-W{:02}", w.year(), w.week())
}

/// 本周键
pub fn this_week_key() -> String {
    week_key(Local::now().date_naive())
}

/// 上周键（任一天减 7 天必落在上一 ISO 周）
pub fn last_week_key() -> String {
    week_key(Local::now().date_naive() - Duration::days(7))
}

/// 解析周键，返回该周 [周一, 周日]（含两端整天）
pub fn week_range(key: &str) -> Option<(NaiveDate, NaiveDate)> {
    let (y, w) = key.split_once("-W")?;
    let year: i32 = y.parse().ok()?;
    let week: u32 = w.parse().ok()?;
    let start = NaiveDate::from_isoywd_opt(year, week, Weekday::Mon)?;
    Some((start, start + Duration::days(6)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    #[test]
    fn date_keys() {
        assert_eq!(date_key(d("2026-10-23")), "2026-10-23");
        assert_eq!(yesterday_key(), date_key(Local::now().date_naive() - Duration::days(1)));
    }

    #[test]
    fn week_keys_monday_start() {
        assert_eq!(week_key(d("2026-10-23")), "2026-W43"); // 周五
        assert_eq!(week_key(d("2026-01-01")), "2026-W01"); // 周四，含首周四 → 第 1 周
        assert_eq!(week_key(d("2026-12-31")), "2026-W53"); // 周四，2026 有 53 周
        assert_eq!(week_key(d("2027-01-01")), "2026-W53"); // 跨年仍属 2026 年第 53 周
    }

    #[test]
    fn week_ranges() {
        let (start, end) = week_range("2026-W53").unwrap();
        assert_eq!(start, d("2026-12-28")); // 周一
        assert_eq!(end, d("2027-01-03")); // 周日
        assert!(week_range("2026-53").is_none());
        assert!(week_range("bad").is_none());
    }
}
