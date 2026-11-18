export type Theme = "light" | "dark";

const KEY = "donetrace-theme";

/** 读取持久化主题；无记录时跟随系统偏好 */
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* localStorage 不可用时忽略 */
  }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** 应用主题：切换 document 上的 dark class 并持久化 */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* 忽略持久化失败 */
  }
}
