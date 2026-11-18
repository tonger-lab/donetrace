import { invoke } from "@tauri-apps/api/core";
import type { CreateTaskInput, Task, UpdateTaskInput } from "../types/task";
import type { Project, ProjectDetail, ProjectInput } from "../types/project";
import type { AnalysisData, AnalysisPeriod, AnalysisReport } from "../types/analysis";
import type { AiLogEntry, AiLogMeta } from "../types/ai";
import type { DeepSeekConfig, SetDeepSeekConfigInput } from "../types/settings";
import type { ImportPreview, ImportSummary } from "../types/backup";
import type { IconPreview } from "../types/icon";
import type { SystemAchievement } from "../types/achievements";
import type {
  AiPersonalizationData,
  AiQuota,
  BackupMeta,
  DeviceInfo,
  ProBackupDone,
  ProfileData,
  ProRegisterResult,
  ProRestoreDone,
  ProStatus,
  SoulNotesState,
  WebdavConfigData,
  WorkScheduleData,
} from "../types/pro";

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
    launch: (id: string, date: string | null) =>
      invoke<Project>("launch_project", { id, date }),
    unlaunch: (id: string) => invoke<Project>("unlaunch_project", { id }),
    setLaunchDate: (id: string, date: string) =>
      invoke<Project>("set_launch_date", { id, date }),
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
  /** Pro 命令仅在官方安装包存在；免费构建调用会抛错（界面由 isProBuild 门控） */
  pro: {
    isProBuild: () => invoke<boolean>("is_pro_build"),
    status: () => invoke<ProStatus>("pro_status"),
    setServer: (url: string) => invoke<void>("pro_set_server", { url }),
    openWebsite: () => invoke<void>("pro_open_website"),
    register: (email: string, password: string, e2e: boolean) =>
      invoke<ProRegisterResult>("pro_register", { email, password, e2e }),
    verify: (email: string, code: string) => invoke<string>("pro_verify", { email, code }),
    login: (email: string, password: string) =>
      invoke<ProStatus["license"]>("pro_login", { email, password }),
    unlock: (password: string) => invoke<void>("pro_unlock", { password }),
    logout: () => invoke<void>("pro_logout"),
    backupNow: () => invoke<ProBackupDone>("pro_backup_now"),
    listBackups: () => invoke<{ backups: BackupMeta[] }>("pro_list_backups"),
    restoreLatest: () => invoke<ProRestoreDone>("pro_restore_latest"),
    getProfile: () => invoke<ProfileData>("pro_get_profile"),
    setProfile: (nickname: string | null, avatar: string | null) =>
      invoke<void>("pro_set_profile", { nickname, avatar }),
    getSoulNotes: (locale: string) =>
      invoke<SoulNotesState>("pro_get_soul_notes", { locale }),
    setSoulNotesConfig: (enabled: boolean, intervalSecs: number) =>
      invoke<SoulNotesState>("pro_set_soul_notes_config", { enabled, intervalSecs }),
    addSoulNote: (text: string) => invoke<SoulNotesState>("pro_add_soul_note", { text }),
    updateSoulNote: (id: string, text: string) =>
      invoke<SoulNotesState>("pro_update_soul_note", { id, text }),
    deleteSoulNote: (id: string) => invoke<SoulNotesState>("pro_delete_soul_note", { id }),
    getAiOfficial: () => invoke<boolean>("pro_get_ai_official"),
    setAiOfficial: (enabled: boolean) =>
      invoke<void>("pro_set_ai_official", { enabled }),
    getAiQuota: () => invoke<AiQuota>("pro_get_ai_quota"),
    redeemLicense: (code: string) =>
      invoke<{ message: string; sync_expires_at?: string }>("pro_redeem_license", { code }),
    getAiPersonalization: () => invoke<AiPersonalizationData>("pro_get_ai_personalization"),
    setAiPersonalization: (data: AiPersonalizationData) =>
      invoke<void>("pro_set_ai_personalization", { data }),
    getWebdavConfig: () => invoke<WebdavConfigData>("pro_get_webdav_config"),
    setWebdavConfig: (data: WebdavConfigData) =>
      invoke<void>("pro_set_webdav_config", { data }),
    testWebdav: (data: WebdavConfigData) => invoke<void>("pro_test_webdav", { data }),
    webdavBackupNow: () => invoke<{ filename: string; size: number }>("pro_webdav_backup_now"),
    webdavListBackups: () => invoke<string[]>("pro_webdav_list_backups"),
    webdavRestoreLatest: () => invoke<unknown>("pro_webdav_restore_latest"),
    listDevices: () => invoke<{ devices: DeviceInfo[] }>("pro_list_devices"),
    revokeDevice: (deviceId: string) => invoke<void>("pro_revoke_device", { deviceId }),
    getWorkSchedule: () => invoke<WorkScheduleData | null>("pro_get_work_schedule"),
    setWorkSchedule: (data: WorkScheduleData) =>
      invoke<void>("pro_set_work_schedule", { data }),
  },
  icons: {
    pick: () => invoke<string | null>("pick_project_icon"),
    preview: (path: string) => invoke<IconPreview>("load_project_icon_preview", { path }),
    crop: (path: string, rect: { sx: number; sy: number; sw: number; sh: number }) =>
      invoke<string>("crop_project_icon", { path, input: rect }),
  },
  achievements: {
    get: () => invoke<SystemAchievement[]>("get_system_achievements"),
  },
};
