/** 系统成就类型（与 Rust achievements.rs 的序列化结构对齐） */
export type AchievementCategory = "start" | "milestone" | "habit" | "depth";

export type AchievementKind = "count" | "hours" | "days" | "score" | "reviews" | "binary";

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface SystemAchievement {
  id: string;
  category: AchievementCategory;
  icon: string;
  unlockedAt: string | null;
  kind: AchievementKind;
  progress: AchievementProgress | null;
}

/** 解锁事件（achievements://unlocked）载荷条目 */
export interface AchievementUnlockEventItem {
  id: string;
  icon: string;
  category: string;
}
