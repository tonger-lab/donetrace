import { Check, Pencil, Trash2 } from "lucide-react";
import { cn } from "../lib/cn";
import { formatScore, type TaskValue } from "../lib/scoring";
import type { Task } from "../types/task";
import { useI18n } from "../i18n";
import ProjectIcon from "./ProjectIcon";
import ValueBadge from "./ValueBadge";

/** 实际得分按任务价值着色 */
const SCORE_COLORS: Record<TaskValue, string> = {
  normal: "text-foreground",
  important: "text-blue-600",
  critical: "text-amber-600",
};

interface TaskRowProps {
  task: Task;
  /** 归档项目只读 */
  canToggle: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** 任务列表页：显示所属项目列 */
  showProject?: boolean;
  /** 尾部时间列内容（如录入时间/完成时间） */
  timeText?: string;
  /** 隐藏勾选框（统计/分析视图） */
  hideToggle?: boolean;
  /** 隐藏编辑/删除操作（统计/分析视图） */
  hideActions?: boolean;
}

/** 单行任务：勾选 + 名称 / 项目 / 价值 / 分数（加成后，按价值着色）/ 时间 + 操作 */
export default function TaskRow({
  task,
  canToggle,
  onToggle,
  onEdit,
  onDelete,
  showProject = false,
  timeText,
  hideToggle = false,
  hideActions = false,
}: TaskRowProps) {
  const t = useI18n((s) => s.t);
  const done = task.status === "done";
  const toggleLabel = done ? t("row.undoDone") : t("row.markDone");
  return (
    <li className="group flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-accent/60">
      {!hideToggle && (
        <button
          type="button"
          onClick={onToggle}
          disabled={!canToggle}
          title={toggleLabel}
          aria-label={toggleLabel}
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-40",
            done
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:border-primary",
          )}
        >
          {done && <Check className="size-3.5" />}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm", done && "text-muted-foreground line-through")}>
          {task.name}
        </span>
      </div>

      {showProject && (
        <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ProjectIcon icon={task.projectIcon ?? "📁"} className="size-4" />
          <span className="truncate">{task.projectName ?? t("common.unknownProject")}</span>
        </span>
      )}

      <span className="w-16 shrink-0">
        <ValueBadge value={task.value} />
      </span>

      <span
        className={cn("w-14 shrink-0 text-right text-sm font-semibold", SCORE_COLORS[task.value])}
      >
        {formatScore(task.actualScore)}
      </span>

      {timeText !== undefined && (
        <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{timeText}</span>
      )}

      {!hideActions && (
        <>
          <button
            type="button"
            onClick={onEdit}
            title={t("common.edit")}
            className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={t("common.delete")}
            className="rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </li>
  );
}
