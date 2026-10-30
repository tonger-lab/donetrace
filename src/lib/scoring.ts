/**
 * 分数计算规则（前端副本，用于即时回显）
 * 权威实现位于 Rust：src-tauri/src/scoring.rs，两边各配单元测试互相印证。
 */

export type TaskValue = "normal" | "important" | "critical";

/** 任务价值系数：常规 x1.0 / 重要 x1.5 / 关键 x2.0 */
export const VALUE_MULTIPLIERS: Record<TaskValue, number> = {
  normal: 1.0,
  important: 1.5,
  critical: 2.0,
};

export const VALUE_LABELS: Record<TaskValue, string> = {
  normal: "常规",
  important: "重要",
  critical: "关键",
};

export const ALL_TASK_VALUES: TaskValue[] = ["normal", "important", "critical"];

/** 实际得分 = 任务分数 × 任务价值系数 */
export function actualScore(score: number, value: TaskValue): number {
  return score * VALUE_MULTIPLIERS[value];
}

/** 得分展示：整数不带小数位，非整数保留 1 位 */
export function formatScore(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
