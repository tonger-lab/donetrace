import { useEffect, useState, type FormEvent } from "react";
import Modal from "./ui/Modal";
import Select from "./Select";
import ProjectIcon from "./ProjectIcon";
import { cn } from "../lib/cn";
import { ALL_TASK_VALUES, type TaskValue } from "../lib/scoring";
import { VALUE_ICONS } from "./ValueBadge";
import { useI18n } from "../i18n";
import type { Project } from "../types/project";
import type { Task } from "../types/task";

export interface TaskFormData {
  name: string;
  projectId: string;
  value: TaskValue;
  score: number;
  description: string;
}

interface TaskFormDialogProps {
  open: boolean;
  title: string;
  /** 可选项目列表（active） */
  projects: Project[];
  /** null = 新建 */
  initial: Task | null;
  defaultProjectId: string;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => void;
}

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export default function TaskFormDialog({
  open,
  title,
  projects,
  initial,
  defaultProjectId,
  error,
  onClose,
  onSubmit,
}: TaskFormDialogProps) {
  const t = useI18n((s) => s.t);
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [value, setValue] = useState<TaskValue>("normal");
  const [score, setScore] = useState("1");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setProjectId(initial?.projectId ?? defaultProjectId);
    setValue(initial?.value ?? "normal");
    setScore(String(initial?.score ?? 1));
    setDescription(initial?.description ?? "");
  }, [open, initial, defaultProjectId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      projectId,
      value,
      score: Math.max(1, Number(score) || 1),
      description,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("taskForm.name")}</label>
          <input
            className={inputCls}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("taskForm.namePlaceholder")}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("taskForm.project")}</label>
          <Select
            value={projectId}
            onChange={setProjectId}
            placeholder={t("taskForm.projectPlaceholder")}
            options={projects.map((p) => ({
              value: p.id,
              label: (
                <span className="flex min-w-0 items-center gap-1.5">
                  <ProjectIcon icon={p.icon} className="size-4" />
                  <span className="truncate">{p.name}</span>
                </span>
              ),
            }))}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("taskForm.value")}</label>
          <div className="grid grid-cols-3 gap-2">
            {ALL_TASK_VALUES.map((v) => {
              const Icon = VALUE_ICONS[v];
              const selected = value === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setValue(v)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {t(`value.${v}`)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("taskForm.score")}</label>
          <input
            className={inputCls}
            type="number"
            min={1}
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("taskForm.description")}</label>
          <textarea
            className={`${inputCls} min-h-20 resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("taskForm.descriptionPlaceholder")}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={!name.trim() || !projectId}
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
