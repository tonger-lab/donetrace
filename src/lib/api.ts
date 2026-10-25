import { invoke } from "@tauri-apps/api/core";
import type { CreateTaskInput, Task, UpdateTaskInput } from "../types/task";
import type { Project, ProjectDetail, ProjectInput } from "../types/project";
import type { AnalysisData, AnalysisPeriod, AnalysisReport } from "../types/analysis";
import type { AiLogEntry, AiLogMeta } from "../types/ai";
import type { DeepSeekConfig, SetDeepSeekConfigInput } from "../types/settings";
import type { ImportPreview, ImportSummary } from "../types/backup";
import type { IconPreview } from "../types/icon";

/** Tauri command 封装：所有业务都走 Rust 后端 */
export const api = {
  tasks: {
    list: (projectId?: string) => invoke<Task[]>("list_tasks", { projectId }),
    create: (input: CreateTaskInput) => invoke<Task>("create_task", { input }),
    update: (id: string, input: UpdateTaskInput) => invoke<Task>("update_task", { id, input }),
    remove: (id: string) => invoke<void>("delete_task", { id }),
    toggleDone: (id: string, done: boolean) => invoke<Task>("toggle_task_done", { id, done }),
  },
  projects: {
    list: (includeArchived = false) =>
      invoke<Project[]>("list_projects", { includeArchived }),
    create: (input: ProjectInput) => invoke<Project>("create_project", { input }),
    update: (id: string, input: ProjectInput) => invoke<Project>("update_project", { id, input }),
    remove: (id: string) => invoke<void>("delete_project", { id }),
    move: (id: string, direction: "up" | "down") =>
      invoke<void>("move_project", { id, direction }),
    setCore: (id: string, core: boolean) =>
      invoke<Project>("set_core_project", { id, core }),
    archive: (id: string) => invoke<Project>("archive_project", { id }),
    reactivate: (id: string) => invoke<Project>("reactivate_project", { id }),
    detail: (id: string) => invoke<ProjectDetail>("get_project_detail", { id }),
  },
  analysis: {
    get: (period: AnalysisPeriod) => invoke<AnalysisData>("get_analysis", { period }),
    analyze: (period: AnalysisPeriod) => invoke<AnalysisReport>("analyze_period", { period }),
  },
  ai: {
    analyzeProject: (projectId: string) => invoke<AiLogEntry>("analyze_project", { projectId }),
    listProjectLogs: (projectId: string) =>
      invoke<AiLogMeta[]>("list_project_logs", { projectId }),
    getProjectLog: (projectId: string, logDate: string) =>
      invoke<string>("get_project_log", { projectId, logDate }),
  },
  settings: {
    getDeepseekConfig: () => invoke<DeepSeekConfig>("get_deepseek_config"),
    setDeepseekConfig: (input: SetDeepSeekConfigInput) =>
      invoke<void>("set_deepseek_config", { input }),
    testConnection: () => invoke<string>("test_deepseek_connection"),
    getLanguage: () => invoke<string>("get_language"),
    setLanguage: (lang: string) => invoke<void>("set_language", { lang }),
    getSystemLocale: () => invoke<string>("get_system_locale"),
  },
  backup: {
    export: () => invoke<string | null>("export_data"),
    pickFile: () => invoke<string | null>("pick_backup_file"),
    preview: (path: string) => invoke<ImportPreview>("preview_import", { path }),
    import: (path: string, mode: "merge" | "replace") =>
      invoke<ImportSummary>("import_data", { path, mode }),
    clear: () => invoke<void>("clear_all_data"),
  },
  icons: {
    pick: () => invoke<string | null>("pick_project_icon"),
    preview: (path: string) => invoke<IconPreview>("load_project_icon_preview", { path }),
    crop: (path: string, rect: { sx: number; sy: number; sw: number; sh: number }) =>
      invoke<string>("crop_project_icon", { path, input: rect }),
  },
};
