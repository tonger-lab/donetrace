/**
 * 工时换算：1 分 = 1 分钟，每天按 8 小时（480 分钟）计。
 * 显示格式随语言：zh-CN "2天3小时5分" / en "2d 3h 5min"（0 值段省略）。
 */
import { en } from "../i18n/locales/en";
import { zhCN } from "../i18n/locales/zh-CN";
import type { Locale } from "../i18n/types";

export function formatWorkHours(score: number, locale: Locale = "en"): string {
  const cat = locale === "zh-CN" ? zhCN : en;
  const day = cat["units.day"];
  const hour = cat["units.hour"];
  const minute = cat["units.minute"];

  const total = Math.max(0, Math.round(score));
  const days = Math.floor(total / 480);
  const hours = Math.floor((total % 480) / 60);
  const minutes = total % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}${day}`);
  if (hours > 0) parts.push(`${hours}${hour}`);
  if (minutes > 0) parts.push(`${minutes}${minute}`);
  return parts.length > 0 ? parts.join(locale === "zh-CN" ? "" : " ") : `0${minute}`;
}

/**
 * 完成度百分比：按标准时间折算。
 * - 默认标准：日 8 小时（480 分钟）、周 40 小时（2400 分钟）
 * - Pro 用户自定义工作时间后传入 standards（日 = 收工−开工，周 = 日 × 工作日数）
 * 返回四舍五入的整数百分比（可超过 100）。
 */
export function completionPercent(
  score: number,
  period: "day" | "week",
  standards?: { dayMinutes: number; weekMinutes: number },
): number {
  const minutes = Math.max(0, Math.round(score));
  const standard = period === "day" ? 480 : 2400;
  const custom = period === "day" ? standards?.dayMinutes : standards?.weekMinutes;
  const base = custom && custom > 0 ? custom : standard;
  return Math.round((minutes / base) * 100);
}

/** 解析 HH:MM → 自午夜起的分钟数；非法返回 null（与 Rust 端校验一致） */
export function parseHhmm(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 由工作时间表推导完成度标准（纯函数，供单测）：
 * - 未自定义（null/非法）→ 内置标准 { 480, 2400 }（日 8h / 周 40h）
 * - 自定义 → 日 = end−start 分钟；周 = 日 × 工作日数
 */
export function scheduleStandards(schedule: {
  workdays: boolean[];
  start: string;
  end: string;
} | null | undefined): { dayMinutes: number; weekMinutes: number } {
  if (!schedule || schedule.workdays.length !== 7) {
    return { dayMinutes: 480, weekMinutes: 2400 };
  }
  const start = parseHhmm(schedule.start);
  const end = parseHhmm(schedule.end);
  const dayMinutes = start !== null && end !== null && end > start ? end - start : 480;
  const days = schedule.workdays.filter(Boolean).length;
  return { dayMinutes, weekMinutes: days > 0 ? dayMinutes * days : 2400 };
}
