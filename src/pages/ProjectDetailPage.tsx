import {
  Archive,
  ChevronLeft,
  Pencil,
  Plus,
  Sparkles,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import MarkdownView from "../components/MarkdownView";
import ProjectFormDialog, { type ProjectFormData } from "../components/ProjectFormDialog";
import ProjectIcon from "../components/ProjectIcon";
import TaskFormDialog, { type TaskFormData } from "../components/TaskFormDialog";
import TaskRow from "../components/TaskRow";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { formatScore } from "../lib/scoring";
import type { AiLogMeta } from "../types/ai";
import type { ProjectDetail } from "../types/project";
import type { Task } from "../types/task";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logs, setLogs] = useState<AiLogMeta[]>([]);
  const [selectedLog, setSelectedLog] = useState<{ date: string; content: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.projects.detail(id);
      setDetail(data);
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!id) return;
    api.ai
      .listProjectLogs(id)
      .then(setLogs)
      .catch(() => setLogs([]));
  }, [id]);

  const runAiReview = async () => {
    if (!id) return;
    setAnalyzing(true);
    setError(null);
    try {
      const entry = await api.ai.analyzeProject(id);
      setSelectedLog({ date: entry.logDate, content: entry.content });
      setLogs(await api.ai.listProjectLogs(id));
    } catch (err) {
      setError(String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const openLog = async (logDate: string) => {
    if (!id) return;
    try {
      const content = await api.ai.getProjectLog(id, logDate);
      setSelectedLog({ date: logDate, content });
    } catch (err) {
      setError(String(err));
    }
  };

  if (!id || !detail) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-8">
        <p className="text-sm text-muted-foreground">{error ?? t("common.loading")}</p>
      </div>
    );
  }

  const { project, pendingTasks, doneGroups } = detail;
  const isActive = project.status === "active";
  const isArchived = project.status === "archived";
  const canModify = !isArchived;

  const submitTask = async (data: TaskFormData) => {
    try {
      if (editingTask) {
        await api.tasks.update(editingTask.id, data);
      } else {
        await api.tasks.create(data);
      }
      setTaskFormOpen(false);
      setEditingTask(null);
      await reload();
    } catch (err) {
      setError(String(err));
    }
  };

  const toggleTask = async (task: Task, done: boolean) => {
    try {
      await api.tasks.toggleDone(task.id, done);
      await reload();
    } catch (err) {
      setError(String(err));
    }
  };

  const confirmDeleteTask = async () => {
    if (!deletingTask) return;
    try {
      await api.tasks.remove(deletingTask.id);
      setDeletingTask(null);
      await reload();
    } catch (err) {
      setError(String(err));
      setDeletingTask(null);
    }
  };

  const submitProject = async (data: ProjectFormData) => {
    try {
      await api.projects.update(project.id, data);
      setProjectFormOpen(false);
      await reload();
    } catch (err) {
      setError(String(err));
    }
  };

  const archive = async () => {
    try {
      await api.projects.archive(project.id);
      setArchiving(false);
      await reload();
    } catch (err) {
      setError(String(err));
      setArchiving(false);
    }
  };

  const reactivate = async () => {
    try {
      await api.projects.reactivate(project.id);
      await reload();
    } catch (err) {
      setError(String(err));
    }
  };

  const setCore = async (core: boolean) => {
    try {
      await api.projects.setCore(project.id, core);
      await reload();
    } catch (err) {
      setError(String(err));
    }
  };

  const deleteProject = async () => {
    try {
      await api.projects.remove(project.id);
      navigate("/projects");
    } catch (err) {
      setError(String(err));
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <button
        type="button"
        onClick={() => navigate("/projects")}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> {t("detail.back")}
      </button>

      {/* 头部 */}
      <header className="flex items-start gap-3">
        <ProjectIcon icon={project.icon} className="size-10" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-2xl font-semibold">{project.name}</h2>
            {project.isCore && (
              <span className="flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                <Star className="size-3 fill-amber-500 text-amber-500" /> {t("projects.core")}
              </span>
            )}
            {isArchived && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {t("detail.archived")}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{project.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {t("common.totalScore")}{" "}
            <span className="text-sm font-semibold text-foreground">
              {formatScore(project.totalScore)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canModify && !project.isCore && (
            <button
              type="button"
              title={t("detail.markCoreHint")}
              onClick={() => void setCore(true)}
              className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Star className="size-3.5" /> {t("detail.markCore")}
            </button>
          )}
          {canModify && project.isCore && (
            <button
              type="button"
              title={t("detail.unmarkCoreHint")}
              onClick={() => void setCore(false)}
              className="flex items-center gap-1 rounded-md border border-amber-400/60 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
            >
              <StarOff className="size-3.5" /> {t("detail.unmarkCore")}
            </button>
          )}
          {canModify && (
            <button
              type="button"
              title={t("common.editProject")}
              onClick={() => setProjectFormOpen(true)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent"
            >
              <Pencil className="size-4" />
            </button>
          )}
          {!isArchived && (
            <button
              type="button"
              title={t("detail.archive")}
              onClick={() => setArchiving(true)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent"
            >
              <Archive className="size-4" />
            </button>
          )}
          {isArchived && (
            <button
              type="button"
              onClick={() => void reactivate()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
            >
              {t("detail.reactivate")}
            </button>
          )}
          {canModify && (
            <button
              type="button"
              title={t("detail.deleteProject")}
              onClick={() => setDeleting(true)}
              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* 待办任务 */}
      <section className="mt-6">
        <div className="flex items-center justify-between border-b pb-1.5">
          <h3 className="font-medium">
            {t("detail.pendingTasks", { count: pendingTasks.length })}
          </h3>
          {isActive && (
            <button
              type="button"
              onClick={() => {
                setEditingTask(null);
                setTaskFormOpen(true);
              }}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-sm text-primary-foreground hover:opacity-90"
            >
              <Plus className="size-4" /> {t("common.addTask")}
            </button>
          )}
        </div>
        <ul className="mt-1">
          {pendingTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              canToggle={canModify}
              onToggle={() => void toggleTask(task, true)}
              onEdit={() => {
                setEditingTask(task);
                setTaskFormOpen(true);
              }}
              onDelete={() => setDeletingTask(task)}
            />
          ))}
          {pendingTasks.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">
              {isActive ? t("detail.noPendingTasks") : t("detail.projectEnded")}
            </li>
          )}
        </ul>
      </section>

      {/* 完成时间线 */}
      <section className="mt-6">
        <h3 className="border-b pb-1.5 font-medium">{t("detail.timeline")}</h3>
        {doneGroups.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">{t("detail.noDoneYet")}</p>
        )}
        <div className="mt-3 space-y-5">
          {doneGroups.map((group) => (
            <div key={group.date}>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{group.date}</span>
                <span>{t("detail.groupMeta", { count: group.tasks.length, score: formatScore(group.score) })}</span>
              </div>
              <ul className="mt-1">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    canToggle={canModify}
                    onToggle={() => void toggleTask(task, false)}
                    onEdit={() => {
                      setEditingTask(task);
                      setTaskFormOpen(true);
                    }}
                    onDelete={() => setDeletingTask(task)}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* AI 复盘 */}
      <section className="mt-8">
        <h3 className="flex items-center gap-1.5 border-b pb-1.5 font-medium">
          <Sparkles className="size-4" /> {t("detail.aiReview")}
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runAiReview()}
            disabled={analyzing}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Sparkles className="size-4" />
            {analyzing ? t("detail.analyzing") : t("detail.generateReview")}
          </button>
          <span className="text-xs text-muted-foreground">{t("detail.reviewHint")}</span>
        </div>

        {logs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {logs.map((log) => (
              <button
                key={log.logDate}
                type="button"
                onClick={() => void openLog(log.logDate)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs transition-colors",
                  selectedLog?.date === log.logDate
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {log.logDate}
              </button>
            ))}
          </div>
        )}

        {selectedLog && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">
              {t("detail.logMeta", { date: selectedLog.date })}
            </p>
            <div className="mt-2 rounded-lg border bg-card p-4">
              <MarkdownView content={selectedLog.content} />
            </div>
          </div>
        )}
      </section>

      {/* 对话框 */}
      <TaskFormDialog
        open={taskFormOpen}
        title={
          editingTask ? t("common.editTask") : t("detail.addTaskToProject", { name: project.name })
        }
        projects={isActive ? [project] : []}
        initial={editingTask}
        defaultProjectId={project.id}
        error={taskFormOpen ? error : null}
        onClose={() => {
          setTaskFormOpen(false);
          setEditingTask(null);
        }}
        onSubmit={(data) => void submitTask(data)}
      />

      <ProjectFormDialog
        open={projectFormOpen}
        title={t("common.editProject")}
        initial={project}
        error={projectFormOpen ? error : null}
        onClose={() => setProjectFormOpen(false)}
        onSubmit={(data) => void submitProject(data)}
      />

      <ConfirmDialog
        open={deletingTask !== null}
        title={t("common.deleteTask")}
        description={t("tasks.deleteTaskConfirm", { name: deletingTask?.name ?? "" })}
        confirmText={t("common.delete")}
        danger
        onConfirm={() => void confirmDeleteTask()}
        onCancel={() => setDeletingTask(null)}
      />

      <ConfirmDialog
        open={archiving}
        title={t("detail.archiveTitle")}
        description={t("detail.archiveConfirm", { name: project.name })}
        confirmText={t("detail.archive")}
        onConfirm={() => void archive()}
        onCancel={() => setArchiving(false)}
      />

      <ConfirmDialog
        open={deleting}
        title={t("detail.deleteProject")}
        description={t("detail.deleteProjectConfirm", { name: project.name })}
        confirmText={t("common.delete")}
        danger
        onConfirm={() => void deleteProject()}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}
