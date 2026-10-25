import { Circle, Flame, Star } from "lucide-react";
import { cn } from "../lib/cn";
import type { TaskValue } from "../lib/scoring";
import { useI18n } from "../i18n";

const ICONS: Record<TaskValue, typeof Circle> = {
  normal: Circle,
  important: Star,
  critical: Flame,
};

const STYLES: Record<TaskValue, string> = {
  normal: "bg-muted text-muted-foreground",
  important: "bg-blue-100 text-blue-700",
  critical: "bg-amber-100 text-amber-800",
};

/** 任务价值徽章：图标 + 标签（常规灰 / 重要蓝 / 关键金），标签随界面语言 */
export default function ValueBadge({ value }: { value: TaskValue }) {
  const t = useI18n((s) => s.t);
  const Icon = ICONS[value];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs",
        STYLES[value],
      )}
    >
      <Icon className="size-3" />
      {t(`value.${value}`)}
    </span>
  );
}

export { ICONS as VALUE_ICONS };
