import { listen } from "@tauri-apps/api/event";
import type { AchievementUnlockEventItem } from "../types/achievements";
import { useAchievementToasts } from "./achievementToasts";

let started = false;

/**
 * 订阅 Rust 端 `achievements://unlocked` 事件（任务完成 / 项目上线 / 标记核心 /
 * AI 复盘等交互触发的即时解锁）；启动补发与备份导入不广播，不在此处出现。
 * 幂等：应用生命周期内只注册一次。
 */
export function startAchievementListener(): void {
  if (started) return;
  started = true;
  void listen<AchievementUnlockEventItem[]>("achievements://unlocked", (event) => {
    if (Array.isArray(event.payload) && event.payload.length > 0) {
      useAchievementToasts.getState().push(event.payload);
    }
  });
}
