import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, X } from "lucide-react";
import { useI18n, type MessageKey } from "../i18n";
import { useAchievementToasts, type AchievementToastItem } from "../lib/achievementToasts";
import AchievementIcon from "./AchievementIcon";

function ToastCard({ toast }: { toast: AchievementToastItem }) {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const dismiss = useAchievementToasts((s) => s.dismiss);
  const nameKey = `achievements.sys.${toast.id}.name` as MessageKey;

  // 5 秒自动消失；点击卡片跳转成就页
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.key), 5000);
    return () => clearTimeout(timer);
  }, [toast.key, dismiss]);

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-80 cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 shadow-lg"
      onClick={() => {
        dismiss(toast.key);
        navigate("/achievements");
      }}
    >
      <AchievementIcon id={toast.id} unlocked size={32} fallback={toast.icon} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
          <Trophy className="size-3 shrink-0" />
          {t("achievements.toastTitle")}
        </p>
        <p className="truncate text-sm font-medium">{t(nameKey)}</p>
      </div>
      <button
        type="button"
        aria-label={t("achievements.toastClose")}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        onClick={(e) => {
          e.stopPropagation();
          dismiss(toast.key);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** 右下角成就解锁 toast 栈（不抢焦点、可堆叠，最多 3 条） */
export default function AchievementToasts() {
  const toasts = useAchievementToasts((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard key={toast.key} toast={toast} />
      ))}
    </div>
  );
}
