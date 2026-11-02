/** 数据管理相关类型（与 Rust 端 commands/backup.rs 对齐） */
export interface ImportPreview {
  projects: number;
  tasks: number;
  reports: number;
  logs: number;
  newProjects: number;
  newTasks: number;
  newReports: number;
  newLogs: number;
}

export interface ImportSummary {
  projectsCreated: number;
  projectsUpdated: number;
  tasksCreated: number;
  tasksUpdated: number;
  reportsCreated: number;
  reportsUpdated: number;
  logsCreated: number;
  logsUpdated: number;
}
