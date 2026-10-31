import dayjs from "dayjs";

/** 日期键：YYYY-MM-DD（本地时区） */
export function dateKey(d: dayjs.Dayjs): string {
  return d.format("YYYY-MM-DD");
}

/** 今日键 */
export function todayKey(): string {
  return dateKey(dayjs());
}

/** 昨日键 */
export function yesterdayKey(): string {
  return dateKey(dayjs().subtract(1, "day"));
}

/**
 * ISO 周键：YYYY-Www（周一为一周起点）。
 * 算法：取该周周四所在的 ISO 年，周数 = 距该年第一个周四的整周数 + 1。
 */
export function weekKey(d: dayjs.Dayjs): string {
  const monday = d.startOf("day").subtract((d.day() + 6) % 7, "day");
  const thursday = monday.add(3, "day");
  const year = thursday.year();
  const jan1 = dayjs(`${year}-01-01`);
  const firstThursday = jan1.add((4 - jan1.day() + 7) % 7, "day");
  const week = Math.floor(thursday.diff(firstThursday, "day") / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** 本周键 */
export function thisWeekKey(): string {
  return weekKey(dayjs());
}

/** 上周键（任一天减 7 天必落在上一 ISO 周） */
export function lastWeekKey(): string {
  return weekKey(dayjs().subtract(7, "day"));
}

/** 解析周键，返回该周的 [起点(周一 00:00), 终点(周日 23:59:59)] */
export function weekRange(key: string): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!m) throw new Error(`无效的周键: ${key}`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  const jan1 = dayjs(`${year}-01-01`);
  const firstThursday = jan1.add((4 - jan1.day() + 7) % 7, "day");
  const start = firstThursday.add((week - 1) * 7 - 3, "day").startOf("day");
  return { start, end: start.add(6, "day").endOf("day") };
}
