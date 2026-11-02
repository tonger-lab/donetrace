/** 项目 AI 复盘日志（与 Rust 端 commands/ai.rs 对齐） */
export interface AiLogEntry {
  projectId: string;
  logDate: string;
  content: string;
  createdAt: string;
}

export interface AiLogMeta {
  logDate: string;
  filePath: string;
  createdAt: string;
}
