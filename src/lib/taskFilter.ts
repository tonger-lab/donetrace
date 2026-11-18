import dayjs from "dayjs";
import { weekKey } from "./period";
import type { Task } from "../types/task";

export type TaskPeriodFilter = "today" | "week";

/**
 * 任务页视图拆分（纯函数，供单测）：
 * - **待办**：全部未完成任务（仅「进行中/已上线」项目；归档项目只读、其任务不进待办）。
 *   待办**不受时间筛选影响**——未完成的任务永远可见，不会"第二天自动消失"。
 * - **已完成**：按周期筛选——本日 = 今日完成；本周 = 本周（ISO 周，周一起）完成。
 *
 * @param now 当前时刻（默认 now；测试注入固定值）
 */
export function splitTasks(
  tasks: Task[],
  activeProjectIds: ReadonlySet<string>,
  period: TaskPeriodFilter,
  now: dayjs.Dayjs = dayjs(),
): { pending: Task[]; done: Task[] } {
  const pending = tasks.filter(
    (t) => t.status === "pending" && activeProjectIds.has(t.projectId),
  );
  const done = tasks.filter((t) => {
    if (t.status !== "done" || t.completedAt === null) return false;
    const at = dayjs(t.completedAt);
    return period === "today" ? at.isSame(now, "day") : weekKey(at) === weekKey(now);
  });
  return { pending, done };
}
