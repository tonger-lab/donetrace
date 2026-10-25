import dayjs from "dayjs";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import Select from "../components/Select";
import TaskFormDialog, { type TaskFormData } from "../components/TaskFormDialog";
import TaskRow from "../components/TaskRow";
import { useI18n } from "../i18n";
import { thisWeekKey, weekKey } from "../lib/period";
import { formatWorkHours } from "../lib/workhours";
import { useProjectsStore } from "../stores/projects";
import { useTasksStore } from "../stores/tasks";
import type { Task } from "../types/task";

type PeriodFilter = "today" | "week";

export default function TasksPage() {
  const tasksStore = useTasksStore();
  const projectsStore = useProjectsStore();
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);
  const { tasks, error: loadError } = tasksStore;
  const { projects } = projectsStore;

  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("today");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    void tasksStore.load();
    void projectsStore.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "active"),
    [projects],
  );
  const defaultProjectId = activeProjects[0]?.id ?? "";

  /** 时间筛选：本日 = 录入或完成于今日；本周 = 录入或完成于本周 */
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const now = dayjs();
      if (periodFilter === "today") {
        return (
          dayjs(task.createdAt).isSame(now, "day") ||
          (task.completedAt !== null && dayjs(task.completedAt).isSame(now, "day"))
        );
      }
      const currentWeek = thisWeekKey();
      return (
        weekKey(dayjs(task.createdAt)) === currentWeek ||
        (task.completedAt !== null && weekKey(dayjs(task.completedAt)) === currentWeek)
      );
    });
  }, [tasks, periodFilter]);

  const pending = filteredTasks.filter((task) => task.status === "pending");
  const done = filteredTasks.filter((task) => task.status === "done");

  const toggleTask = async (task: Task, doneFlag: boolean) => {
    try {
      await tasksStore.toggleDone(task.id, doneFlag);
      await tasksStore.load();
      setActionError(null);
    } catch (err) {
      setActionError(String(err));
    }
  };

  const submitForm = async (data: TaskFormData) => {
    try {
      if (editing) {
        await tasksStore.update(editing.id, data);
      } else {
        await tasksStore.create(data);
      }
      await tasksStore.load();
      setFormOpen(false);
      setEditing(null);
      setActionError(null);
    } catch (err) {
      setActionError(String(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await tasksStore.remove(deleting.id);
      await tasksStore.load();
      setDeleting(null);
      setActionError(null);
    } catch (err) {
      setActionError(String(err));
      setDeleting(null);
    }
  };

  const error = loadError ?? actionError;

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t("tasks.title")}</h2>
        <div className="flex items-center gap-2">
          <Select
            className="w-36"
            value={periodFilter}
            onChange={(v) => setPeriodFilter(v as PeriodFilter)}
            options={[
              { value: "today", label: t("tasks.todayFilter") },
              { value: "week", label: t("tasks.weekFilter") },
            ]}
          />
          <button
            type="button"
            disabled={activeProjects.length === 0}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            title={
              activeProjects.length === 0 ? t("tasks.addDisabledHint") : t("common.addTask")
            }
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" /> {t("common.addTask")}
          </button>
        </div>
      </div>
      {activeProjects.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{t("tasks.noActiveProject")}</p>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 待办 */}
      <section className="mt-6">
        <h3 className="border-b pb-1.5 font-medium">
          {t("tasks.pending", { count: pending.length })}
        </h3>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {filteredTasks.length === 0
              ? t("tasks.noTasksInPeriod")
              : t("tasks.noPendingInPeriod")}
          </p>
        ) : (
          <>
            <HeaderRow />
            <ul className="mt-1">
              {pending.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  canToggle
                  onToggle={() => void toggleTask(task, true)}
                  onEdit={() => {
                    setEditing(task);
                    setFormOpen(true);
                  }}
                  onDelete={() => setDeleting(task)}
                  showProject
                  timeText={dayjs(task.createdAt).format("MM-DD HH:mm")}
                />
              ))}
            </ul>
          </>
        )}
      </section>

      {/* 已完成 */}
      <section className="mt-6">
        <h3 className="border-b pb-1.5 font-medium">
          {periodFilter === "today" ? t("tasks.doneToday") : t("tasks.doneThisWeek")}（
          {done.length}）· {t("common.totalWorkHours")}{" "}
          {formatWorkHours(done.reduce((s, task) => s + task.actualScore, 0), locale)}
        </h3>
        {done.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t("tasks.noDoneInPeriod")}</p>
        ) : (
          <ul className="mt-1">
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                canToggle
                onToggle={() => void toggleTask(task, false)}
                onEdit={() => {
                  setEditing(task);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleting(task)}
                showProject
                timeText={dayjs(task.createdAt).format("MM-DD HH:mm")}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 编辑/新建对话框 */}
      <TaskFormDialog
        open={formOpen}
        title={editing ? t("common.editTask") : t("common.addTask")}
        projects={activeProjects}
        initial={editing}
        defaultProjectId={defaultProjectId}
        error={formOpen ? actionError : null}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(data) => void submitForm(data)}
      />

      {/* 删除确认 */}
      <ConfirmDialog
        open={deleting !== null}
        title={t("common.deleteTask")}
        description={t("tasks.deleteTaskConfirm", { name: deleting?.name ?? "" })}
        confirmText={t("common.delete")}
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

/** 列表列头（与 TaskRow 列宽对齐） */
function HeaderRow() {
  const t = useI18n((s) => s.t);
  return (
    <div className="flex items-center gap-2.5 px-2 pb-1 pt-2 text-xs text-muted-foreground">
      <span className="size-5 shrink-0" />
      <span className="min-w-0 flex-1">{t("table.taskName")}</span>
      <span className="w-32 shrink-0">{t("table.project")}</span>
      <span className="w-16 shrink-0">{t("table.value")}</span>
      <span className="w-14 shrink-0 text-right">{t("table.score")}</span>
      <span className="w-24 shrink-0 text-right">{t("table.createdAt")}</span>
      <span className="w-16 shrink-0" />
    </div>
  );
}
