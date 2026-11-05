import type { Task } from "./task";

export type AnalysisPeriod = "today" | "yesterday" | "week" | "last_week";

/** 与 Rust 端 src-tauri/src/commands/analysis.rs 对齐 */
export interface AnalysisTask extends Task {
  projectName: string;
  projectIcon: string;
}

export interface ProjectStat {
  projectId: string;
  projectName: string;
  projectIcon: string;
  taskCount: number;
  score: number;
}

export interface AnalysisReport {
  periodKey: string;
  content: string;
  createdAt: string;
}

export interface AnalysisData {
  periodKey: string;
  tasks: AnalysisTask[];
  totalScore: number;
  taskCount: number;
  byProject: ProjectStat[];
  report: AnalysisReport | null;
}
