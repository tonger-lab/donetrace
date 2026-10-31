import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Pencil,
  Rocket,
  RotateCcw,
  Star,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectFormDialog, { type ProjectFormData } from "../components/ProjectFormDialog";
import ProjectIcon from "../components/ProjectIcon";
import { useI18n } from "../i18n";
import { formatWorkHours } from "../lib/workhours";
import { useProjectsStore } from "../stores/projects";
import type { Project } from "../types/project";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const store = useProjectsStore();
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);
  const { projects, error: loadError } = store;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [activating, setActivating] = useState<Project | null>(null);

  useEffect(() => {
    void store.load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 主区：进行中 + 已上线（混排，徽章区分）；归档区折叠在底部 */
  const visible = projects.filter((p) => p.status !== "archived");
  const archived = projects.filter((p) => p.status === "archived");

  const submitForm = async (data: ProjectFormData) => {
    try {
      if (editing) {
        await store.update(editing.id, data);
      } else {
        await store.create(data);
      }
      setFormOpen(false);
      setEditing(null);
      setActionError(null);
    } catch (err) {
      setActionError(String(err));
    }
  };

  const move = async (project: Project, direction: "up" | "down") => {
    try {
      await store.move(project.id, direction);
      setActionError(null);
    } catch (err) {
      setActionError(String(err));
    }
  };

  /** 上线 ⇄ 回炉（进行中）切换 */
  const toggleLaunch = async (project: Project) => {
    try {
      if (project.status === "live") {
        await store.unlaunch(project.id);
      } else {
        await store.launch(project.id);
      }
      setActionError(null);
    } catch (err) {
      setActionError(String(err));
    }
  };

  const confirmActivate = async () => {
    if (!activating) return;
    try {
      await store.reactivate(activating.id);
      setActivating(null);
      setActionError(null);
    } catch (err) {
      setActionError(String(err));
      setActivating(null);
    }
  };

  const statusLabel = (project: Project) =>
    project.archivedFromStatus === "live"
      ? t("achievements.statusLive")
      : t("achievements.statusActive");

  const error = loadError ?? actionError;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{t("projects.title")}</h2>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          <FolderPlus className="size-4" /> {t("common.newProject")}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("projects.hint")}</p>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("projects.empty")}
          </div>
        )}

        {visible.map((project, index) => (
          <article
            key={project.id}
            className="group flex flex-col rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => navigate(`/projects/${project.id}`)}
              title={t("projects.viewDetail")}
            >
              <div className="flex items-start gap-3">
                <ProjectIcon icon={project.icon} className="size-16" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{project.name}</h3>
                    {project.isCore && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                        <Star className="size-3 fill-amber-500 text-amber-500" />{" "}
                        {t("projects.core")}
                      </span>
                    )}
                    {project.status === "live" && (
                      <span className="flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                        <Rocket className="size-3" /> {t("projects.live")}
                      </span>
                    )}
                    {project.isDefault && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {t("projects.default")}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("common.totalWorkHours")}{" "}
                    <span className="text-sm font-semibold text-foreground">
                      {formatWorkHours(project.totalScore, locale)}
                    </span>
                  </p>
                </div>
              </div>
            </button>

            <div className="mt-3 flex items-center justify-end gap-1 border-t pt-2">
              <button
                type="button"
                title={t("projects.moveUp")}
                disabled={index === 0}
                onClick={() => void move(project, "up")}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                title={t("projects.moveDown")}
                disabled={index === visible.length - 1}
                onClick={() => void move(project, "down")}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
              <button
                type="button"
                title={project.status === "live" ? t("projects.unlaunch") : t("projects.launch")}
                onClick={() => void toggleLaunch(project)}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent"
              >
                {project.status === "live" ? (
                  <Undo2 className="size-3.5" />
                ) : (
                  <Rocket className="size-3.5" />
                )}
              </button>
              <button
                type="button"
                title={t("common.edit")}
                onClick={() => {
                  setEditing(project);
                  setFormOpen(true);
                }}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          </article>
        ))}
      </div>

      {/* 归档区：默认折叠，展开后可重新激活 */}
      {archived.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setArchiveOpen((open) => !open)}
            className="flex w-full items-center gap-1 rounded-md border px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            {archiveOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            {t("projects.archivedSection", { count: archived.length })}
          </button>
          {archiveOpen && (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {archived.map((project) => (
                <article
                  key={project.id}
                  className="flex flex-col rounded-lg border bg-card p-4 opacity-80"
                >
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() => navigate(`/projects/${project.id}`)}
                    title={t("projects.viewDetail")}
                  >
                    <div className="flex items-start gap-3">
                      <ProjectIcon icon={project.icon} className="size-16" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium">{project.name}</h3>
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            {t("detail.archived")}
                          </span>
                        </div>
                        {project.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {project.description}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {t("achievements.cumulative")}{" "}
                          <span className="text-sm font-semibold text-foreground">
                            {formatWorkHours(project.totalScore, locale)}
                          </span>
                          {project.archivedAt && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {t("achievements.archivedOn", {
                                date: project.archivedAt.slice(0, 10),
                              })}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                  <div className="mt-3 flex justify-end border-t pt-2">
                    <button
                      type="button"
                      onClick={() => setActivating(project)}
                      className="flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent"
                    >
                      <RotateCcw className="size-3.5" /> {t("detail.reactivate")}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        title={editing ? t("common.editProject") : t("common.newProject")}
        initial={editing}
        error={formOpen ? actionError : null}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={(data) => void submitForm(data)}
      />

      <ConfirmDialog
        open={activating !== null}
        title={t("achievements.reactivateTitle")}
        description={t("achievements.reactivateConfirm", {
          name: activating?.name ?? "",
          status: activating ? statusLabel(activating) : "",
        })}
        confirmText={t("achievements.activate")}
        onConfirm={() => void confirmActivate()}
        onCancel={() => setActivating(null)}
      />
    </div>
  );
}
