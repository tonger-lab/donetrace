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
 * - 日标准：8 小时（480 分钟）
 * - 周标准：40 小时（2400 分钟）
 * 返回四舍五入的整数百分比（可超过 100）。
 */
export function completionPercent(score: number, period: "day" | "week"): number {
  const minutes = Math.max(0, Math.round(score));
  const standard = period === "day" ? 480 : 2400;
  return Math.round((minutes / standard) * 100);
}
