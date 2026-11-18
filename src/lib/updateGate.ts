/**
 * 启动自动检查更新的日闸门（纯函数，无 Tauri 依赖，供单测）：
 * 每天最多自动检查一次；手动「检查更新」不受此限。
 */
const LAST_CHECK_KEY = "dt-last-update-check";

/** 今天是否还需要自动检查（last/today 为 YYYY-MM-DD） */
export function shouldAutoCheck(last: string | null, today: string): boolean {
  return last !== today;
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function markCheckedToday(): void {
  try {
    localStorage.setItem(LAST_CHECK_KEY, todayKey());
  } catch {
    /* 隐私模式忽略 */
  }
}

export function lastCheckKey(): string | null {
  try {
    return localStorage.getItem(LAST_CHECK_KEY);
  } catch {
    return null;
  }
}
