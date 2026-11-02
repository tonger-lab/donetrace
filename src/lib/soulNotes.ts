/**
 * 心灵寄语（Soul Notes）宽度规则（前端副本，用于即时计数回显）
 * 权威实现位于 pro/：src/tauri_bridge.rs 的 display_width（两边规则一致）。
 * 英文字符宽：ASCII 计 1，其余（中文/全角/emoji）计 2 → 60 宽 ≈ 60 英文 / 30 中文。
 */

export const SOUL_NOTE_MAX_WIDTH = 60;

export function displayWidth(text: string): number {
  return Array.from(text).reduce((n, c) => n + (c.charCodeAt(0) < 128 ? 1 : 2), 0);
}

/** 合法寄语：trim 后非空且宽度 ≤ 60 */
export function isValidSoulNote(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && displayWidth(t) <= SOUL_NOTE_MAX_WIDTH;
}
