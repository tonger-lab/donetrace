import dayjs from "dayjs";
import { describe, expect, it } from "vitest";
import { splitTasks } from "../src/lib/taskFilter";
import type { Task } from "../src/types/task";

function task(partial: Partial<Task> & { id: string }): Task {
  const now = dayjs().toISOString();
  return {
    projectId: "p1",
    name: "t",
    description: "",
    value: "normal",
    score: 1,
    status: "done",
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    actualScore: 1,
    ...partial,
  };
}

describe("任务页视图拆分（待办跨天可见，完成记录按周期筛选）", () => {
  // 固定"现在"：2026-11-18（周三）；本周一为 11-16
  const now = dayjs("2026-11-18T10:00:00");

  it("昨天录入的未完成任务在「本日」视图依然可见（不因跨天消失）", () => {
    const old = task({
      id: "a",
      status: "pending",
      createdAt: "2026-11-16T09:00:00",
      completedAt: null,
    });
    const { pending, done } = splitTasks([old], new Set(["p1"]), "today", now);
    expect(pending).toEqual([old]);
    expect(done).toEqual([]);
  });

  it("上周录入的未完成任务同样永远可见", () => {
    const old = task({
      id: "a",
      status: "pending",
      createdAt: "2026-11-05T09:00:00",
      completedAt: null,
    });
    const { pending } = splitTasks([old], new Set(["p1"]), "week", now);
    expect(pending).toEqual([old]);
  });

  it("归档项目的未完成任务不进待办（项目只读）", () => {
    const archived = task({
      id: "a",
      projectId: "p-archived",
      status: "pending",
      createdAt: "2026-11-18T08:00:00",
      completedAt: null,
    });
    const { pending } = splitTasks([archived], new Set(["p1"]), "today", now);
    expect(pending).toEqual([]);
  });

  it("已完成任务按完成时间筛选（本日/本周）", () => {
    const monday = now.subtract((now.day() + 6) % 7, "day").hour(9); // 2026-11-16 09:00
    const lastSunday = monday.subtract(1, "day").hour(9); // 2026-11-15 09:00
    const doneToday = task({ id: "a", completedAt: now.hour(8).toISOString() });
    const doneThisWeek = task({ id: "b", completedAt: monday.toISOString() });
    const doneLastWeek = task({ id: "c", completedAt: lastSunday.toISOString() });
    const all = [doneToday, doneThisWeek, doneLastWeek];

    const today = splitTasks(all, new Set(["p1"]), "today", now);
    expect(today.done.map((t) => t.id)).toEqual(["a"]);

    const week = splitTasks(all, new Set(["p1"]), "week", now);
    expect(week.done.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("completedAt 为空的任务不会进入已完成", () => {
    const noDate = task({ id: "a", status: "done", completedAt: null });
    const { done } = splitTasks([noDate], new Set(["p1"]), "today", now);
    expect(done).toEqual([]);
  });
});
