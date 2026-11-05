import { achievementIconSrc } from "../lib/achievements";

/**
 * 系统成就图标（三态 SVG 素材，assets/Achievements 图标集）：
 * - 已解锁：彩色 unlocked 图（浅/深主题通用）
 * - 未解锁：按主题渲染 locked-light / locked-dark 灰态（明度已按背景调好，100% 不透明度）
 * - 素材缺失时回退为 emoji（现网数据中由 Rust 端下发的 icon 字段）
 * 尺寸按素材 README：成就卡片 48 CSS px、解锁通知 32 CSS px。
 */
export default function AchievementIcon({
  id,
  unlocked,
  size = 48,
  fallback,
}: {
  id: string;
  unlocked: boolean;
  size?: number;
  fallback?: string;
}) {
  const unlockedSrc = achievementIconSrc("unlocked", id);
  const lockedLightSrc = achievementIconSrc("locked-light", id);
  const lockedDarkSrc = achievementIconSrc("locked-dark", id);

  // 任何状态素材缺失时整体回退 emoji（保证 27 个 id 全有素材后此分支不再触发）
  if (unlocked ? !unlockedSrc : !lockedLightSrc || !lockedDarkSrc) {
    return (
      <span className="text-2xl leading-none" style={{ width: size, height: size }}>
        {fallback ?? "🏆"}
      </span>
    );
  }

  if (unlocked) {
    return <img src={unlockedSrc} width={size} height={size} alt="" className="shrink-0" />;
  }
  return (
    <>
      <img src={lockedLightSrc} width={size} height={size} alt="" className="shrink-0 dark:hidden" />
      <img src={lockedDarkSrc} width={size} height={size} alt="" className="hidden shrink-0 dark:block" />
    </>
  );
}
