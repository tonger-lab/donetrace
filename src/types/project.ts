import type { Task } from "./task";

export type ProjectStatus = "active" | "live" | "archived";

/** 与 Rust 端 src-tauri/src/commands/projects.rs 的 Project 对齐 */
export interface Project {
  id: string;
  name: string;
  icon: string;
  description: string;
  priority: number;
  status: ProjectStatus;
  isDefault: boolean;
  /** 核心项目（唯一，列表置顶） */
  isCore: boolean;
  createdAt: string;
  updatedAt: string;
  /** 上线日期（最近一次上线） */
  launchedAt: string | null;
  archivedAt: string | null;
  archivedFromStatus: string | null;
  /** 已完成任务实际得分之和 */
  totalScore: number;
}

export interface ProjectInput {
  name: string;
  icon?: string;
  description?: string;
}

/** 项目详情页：按日期倒序分组的完成时间线 */
export interface DailyGroup {
  date: string;
  tasks: Task[];
  score: number;
}

export interface ProjectDetail {
  project: Project;
  pendingTasks: Task[];
  doneGroups: DailyGroup[];
}
