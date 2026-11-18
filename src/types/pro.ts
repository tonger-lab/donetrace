/** Pro 账号与云备份（仅官方安装包可用；免费构建中相关命令不存在） */

export interface LicensePart {
  active: boolean;
  starts_at: string;
  expires_at: string | null;
}

export interface ProStatus {
  proBuild: boolean;
  serverUrl: string;
  loggedIn: boolean;
  unlocked: boolean;
  email: string | null;
  license: {
    trial: LicensePart | null;
    pro: LicensePart | null;
    sync: LicensePart | null;
  } | null;
  /** 本机设备指纹（设备管理页「当前设备」标记；未登录时为空串） */
  deviceId: string;
}

export interface ProRegisterResult {
  expiresIn: number;
  recoveryCode: string | null;
}

export interface ProBackupDone {
  id: string;
  filename: string;
  encryptedSize: number;
  status: string;
}

export interface BackupMeta {
  id: string;
  seq: number;
  filename: string;
  size: number;
  sha256: string;
  status: string;
  createdAt: string;
}

export interface ProRestoreDone {
  filename: string;
  summary: import("./backup").ImportSummary;
}

/** 个人档案（本地存储，随 E2E 备份同步；nickname/avatar 为 null 时回落到默认） */
export interface ProfileData {
  nickname: string | null;
  avatar: string | null;
}

/** 心灵寄语（Soul Notes，Pro 专属，登录后可用；本地存储按邮箱，随 E2E 备份同步） */
export interface SoulNote {
  id: string;
  text: string;
}

export interface SoulNotesState {
  enabled: boolean;
  intervalSecs: number;
  notes: SoulNote[];
}

/** 个性化 AI 复盘档案（Pro 专属，登录后可用；本地存储按邮箱，随 E2E 备份同步） */
export interface AiPersonalizationData {
  enabled: boolean;
  role: string;
  goals: string;
  tone: "encouraging" | "direct" | "concise";
  focus: string;
  temperature: number;
}

/** WebDAV 备份配置（Pro 专属，登录后可用；密码仅本机存储、不随备份导出） */
export interface WebdavConfigData {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
  lastSuccessAt: string | null;
}

/** 官方 AI 额度剩余视图（GET /ai/quota，服务端权威值） */
export interface AiQuota {
  /** 试用/Pro 权益是否有效（无效时余量恒为 0） */
  entitled: boolean;
  /** 服务是否已开通（上游 Key 已配置） */
  available: boolean;
  dailyCalls: number;
  usedCalls: number;
  remainingCalls: number;
  dailyTokens: number;
  usedTokens: number;
  remainingTokens: number;
  /** 下次重置时刻（UTC 下一天 0 点，ISO 8601） */
  resetAt: string;
}

/** 登录设备（GET /me/devices 列表项，服务端字段转 camelCase） */
export interface DeviceInfo {
  id: string;
  name: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
}

/** 自定义工作时间表（Pro 专属；未保存 = 内置标准 Mon–Fri 9:00–18:00） */
export interface WorkScheduleData {
  /** 周一~周日（0 = 休息，1 = 工作日） */
  workdays: boolean[];
  /** HH:MM（24 小时制） */
  start: string;
  end: string;
}
