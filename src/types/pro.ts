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
