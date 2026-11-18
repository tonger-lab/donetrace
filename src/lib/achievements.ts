/// <reference types="vite/client" />
import type { AchievementCategory, AchievementKind } from "../types/achievements";

/** 成就页系统成就区的分类展示顺序（固定，与 Rust 定义顺序一致） */
export const CATEGORY_ORDER: AchievementCategory[] = ["start", "milestone", "habit", "depth"];

/** 27 个成就 id（与 Rust achievements.rs DEFS 一致；用于资源完整性校验与兜底） */
export const ACHIEVEMENT_IDS: string[] = [
  "first_task",
  "ten_tasks",
  "one_hour",
  "first_critical",
  "first_live",
  "first_review",
  "streak_3",
  "fifty_tasks",
  "hundred_tasks",
  "ten_hours",
  "fifty_hours",
  "hundred_hours",
  "ten_reviews",
  "fifty_reviews",
  "fifty_important",
  "five_live",
  "first_core",
  "streak_5",
  "day_480",
  "day_576",
  "day_720",
  "day_960",
  "five_hundred_tasks",
  "thousand_tasks",
  "five_hundred_hours",
  "thousand_hours",
  "hundred_reviews",
];

export type AchievementIconState = "unlocked" | "locked-light" | "locked-dark";

/**
 * 三态成就图标（assets/Achievements 图标集，2026-11-03）：
 * unlocked = 彩色已解锁（浅/深界面通用）；locked-light / locked-dark = 对应主题的未解锁灰态。
 * 由 Vite 打包进应用，离线可用；文件缺失时返回 undefined，调用方以 emoji 兜底。
 */
const iconSvgs = import.meta.glob<string>("../assets/achievements/svg/**/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

export function achievementIconSrc(
  state: AchievementIconState,
  id: string,
): string | undefined {
  return iconSvgs[`../assets/achievements/svg/${state}/${id}.svg`];
}

/**
 * 进度数值格式化（与设计文档 §3.2 一致）：
 * - hours：<10 保留 1 位小数，≥10 取整；不足 10 但四舍五入恰为 10 时显示 9.9
 *   （避免「10.0 / 10 却未解锁」的观感矛盾）
 * - days / count / reviews：整数
 * - score：整数不带小数位，非整数保留 1 位
 */
export function formatProgressValue(kind: AchievementKind, value: number): string {
  switch (kind) {
    case "hours": {
      if (value >= 10) return String(Math.round(value));
      const rounded = Math.round(value * 10) / 10;
      return rounded >= 10 ? "9.9" : rounded.toFixed(1);
    }
    case "score":
      return Number.isInteger(value) ? String(value) : value.toFixed(1);
    default:
      return String(Math.round(value));
  }
}

/** 进度条宽度百分比（0–100，超过目标封顶） */
export function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, (current / target) * 100));
}
