import { create } from "zustand";
import type { AchievementUnlockEventItem } from "../types/achievements";

export interface AchievementToastItem {
  key: number;
  id: string;
  icon: string;
  category: string;
}

interface ToastsState {
  toasts: AchievementToastItem[];
  push: (items: AchievementUnlockEventItem[]) => void;
  dismiss: (key: number) => void;
}

let nextKey = 1;

/** 右下角成就解锁 toast（同屏最多 3 条，超出丢弃最旧；5 秒自动消失由组件控制） */
export const useAchievementToasts = create<ToastsState>((set) => ({
  toasts: [],
  push: (items) => {
    if (items.length === 0) return;
    set((s) => ({
      toasts: [
        ...s.toasts,
        ...items.map((it) => ({
          key: nextKey++,
          id: it.id,
          icon: it.icon,
          category: it.category,
        })),
      ].slice(-3),
    }));
  },
  dismiss: (key) => set((s) => ({ toasts: s.toasts.filter((t) => t.key !== key) })),
}));
