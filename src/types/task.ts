import type { TaskValue } from "../lib/scoring";

export type TaskStatus = "pending" | "done";

/** 与 Rust 端 src-tauri/src/commands/tasks.rs 的 Task 对齐 */
export interface Task {
  id: string;
  projectId: string;
  name: string;
  description: string;
  value: TaskValue;
  score: number;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** 实际得分（含价值系数） */
  actualScore: number;
  /** 所属项目信息（list_tasks/分析查询时返回） */
  projectName?: string;
  projectIcon?: string;
}

export interface CreateTaskInput {
  projectId: string;
  name: string;
  description?: string;
  value: TaskValue;
  score: number;
}

export interface UpdateTaskInput {
  projectId: string;
  name: string;
  description?: string;
  value: TaskValue;
  score: number;
}
