import dayjs from "dayjs";
import { Rocket, Trophy } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ProjectIcon from "../components/ProjectIcon";
import { useI18n } from "../i18n";
import { formatScore } from "../lib/scoring";
import { useProjectsStore } from "../stores/projects";

export default function AchievementsPage() {
  const store = useProjectsStore();
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);

  useEffect(() => {
    void store.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 成就 = 已上线项目（面向真实用户、开始创造价值）；归档项目陈列在项目页底部 */
  const live = store.projects.filter((p) => p.status === "live");

  const daysLive = (launchedAt: string) => {
    const days = dayjs().startOf("day").diff(dayjs(launchedAt).startOf("day"), "day");
    if (days <= 0) return t("achievements.liveToday");
    if (days === 1) return t("achievements.oneDayLive");
    return t("achievements.daysLive", { count: days });
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h2 className="text-2xl font-semibold">{t("achievements.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("achievements.subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {live.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed p-10 text-center">
            <Trophy className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{t("achievements.empty")}</p>
          </div>
        )}

        {live.map((project) => (
          <article key={project.id} className="flex flex-col rounded-lg border bg-card p-4">
            <button
              type="button"
              className="flex-1 text-left"
              onClick={() => navigate(`/projects/${project.id}`)}
              title={t("projects.viewDetail")}
            >
              <div className="flex items-start gap-3">
                <ProjectIcon icon={project.icon} className="size-12" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium">{project.name}</h3>
                    <span className="flex shrink-0 items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">
                      <Rocket className="size-3" /> {t("achievements.statusLive")}
                    </span>
                  </div>
                  {project.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {project.description}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("achievements.cumulative")}{" "}
                    <span className="font-semibold text-foreground">
                      {formatScore(project.totalScore)}
                    </span>{" "}
                    {t("common.scoreUnit")}
                    {project.launchedAt && (
                      <>
                        {" "}
                        ·{" "}
                        {t("achievements.launchedOn", {
                          date: dayjs(project.launchedAt).format("YYYY-MM-DD"),
                        })}
                        {" · "}
                        {daysLive(project.launchedAt)}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
