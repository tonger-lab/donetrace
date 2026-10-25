import dayjs from "dayjs";
import { RotateCcw, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import ProjectIcon from "../components/ProjectIcon";
import { useI18n } from "../i18n";
import { formatScore } from "../lib/scoring";
import { useProjectsStore } from "../stores/projects";
import type { Project } from "../types/project";

export default function AchievementsPage() {
  const store = useProjectsStore();
  const t = useI18n((s) => s.t);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState<Project | null>(null);

  useEffect(() => {
    void store.load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const archived = store.projects.filter((p) => p.status === "archived");

  const confirmActivate = async () => {
    if (!activating) return;
    try {
      await store.reactivate(activating.id);
      setActivating(null);
      setError(null);
    } catch (err) {
      setError(String(err));
      setActivating(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h2 className="text-2xl font-semibold">{t("achievements.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("achievements.subtitle")}</p>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {archived.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed p-10 text-center">
            <Trophy className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t("achievements.empty")}</p>
          </div>
        )}

        {archived.map((project) => (
          <article key={project.id} className="flex flex-col rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <ProjectIcon icon={project.icon} className="size-8" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium">{project.name}</h3>
                {project.description && (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {project.description}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {t("achievements.statusBefore")}
                  {project.archivedFromStatus === "completed"
                    ? t("achievements.statusCompleted")
                    : t("achievements.statusActive")}{" "}
                  · {t("achievements.cumulative")}{" "}
                  <span className="font-semibold text-foreground">
                    {formatScore(project.totalScore)}
                  </span>{" "}
                  {t("common.scoreUnit")}
                  {project.archivedAt && (
                    <>
                      {" "}
                      · {t("achievements.archivedOn", {
                        date: dayjs(project.archivedAt).format("YYYY-MM-DD"),
                      })}
                    </>
                  )}
                </p>
              </div>
            </div>
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

      <ConfirmDialog
        open={activating !== null}
        title={t("achievements.reactivateTitle")}
        description={t("achievements.reactivateConfirm", {
          name: activating?.name ?? "",
          status:
            activating?.archivedFromStatus === "completed"
              ? t("achievements.statusCompleted")
              : t("achievements.statusActive"),
        })}
        confirmText={t("achievements.activate")}
        onConfirm={() => void confirmActivate()}
        onCancel={() => setActivating(null)}
      />
    </div>
  );
}
