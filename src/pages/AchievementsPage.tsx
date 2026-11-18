import dayjs from "dayjs";
import { Rocket, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AchievementIcon from "../components/AchievementIcon";
import ProjectIcon from "../components/ProjectIcon";
import { useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { CATEGORY_ORDER, formatProgressValue, progressPercent } from "../lib/achievements";
import { cn } from "../lib/cn";
import { formatScore } from "../lib/scoring";
import { useProjectsStore } from "../stores/projects";
import type { SystemAchievement } from "../types/achievements";

/** 系统成就卡片：已解锁高亮 + 解锁日期；未解锁灰色 + 进度条（二值成就无进度） */
function SystemAchievementCard({ item }: { item: SystemAchievement }) {
  const t = useI18n((s) => s.t);
  const nameKey = `achievements.sys.${item.id}.name` as MessageKey;
  const descKey = `achievements.sys.${item.id}.desc` as MessageKey;
  const unlocked = item.unlockedAt !== null;
  const progress = item.progress;
  const pct = progress ? progressPercent(progress.current, progress.target) : 0;

  return (
    <article
      className={cn(
        "rounded-lg border p-4",
        unlocked
          ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start gap-3">
        <AchievementIcon id={item.id} unlocked={unlocked} size={48} fallback={item.icon} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn("truncate font-medium", !unlocked && "text-muted-foreground")}>
              {t(nameKey)}
            </h3>
            {unlocked && (
              <Trophy
                className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                aria-label="unlocked"
              />
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(descKey)}</p>

          {unlocked ? (
            <p className="mt-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              {t("achievements.unlockedOn", {
                date: dayjs(item.unlockedAt).format("YYYY-MM-DD"),
              })}
            </p>
          ) : progress ? (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground">
                {t(`achievements.progress.${item.kind}` as MessageKey, {
                  current: formatProgressValue(item.kind, progress.current),
                  target: formatProgressValue(item.kind, progress.target),
                })}
              </p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {t("achievements.progress.binary")}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AchievementsPage() {
  const store = useProjectsStore();
  const navigate = useNavigate();
  const t = useI18n((s) => s.t);
  const [system, setSystem] = useState<SystemAchievement[]>([]);

  useEffect(() => {
    void store.load();
    api.achievements
      .get()
      .then(setSystem)
      .catch(() => setSystem([]));
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

  const unlockedCount = system.filter((a) => a.unlockedAt !== null).length;

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <h2 className="text-2xl font-semibold">{t("achievements.title")}</h2>

      {/* 区块一：个人成就（已上线项目，第一屏） */}
      <section className="mt-6">
        <h3 className="text-base font-semibold">{t("achievements.personal")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("achievements.subtitle")}</p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      </section>

      {/* 区块二：系统成就（固定 27 个，按类别 → 阈值递增排列） */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-base font-semibold">{t("achievements.system")}</h3>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {t("achievements.unlockedCount", {
              unlocked: unlockedCount,
              total: system.length,
            })}
          </span>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("achievements.systemSubtitle")}</p>

        {CATEGORY_ORDER.map((category) => {
          const items = system.filter((a) => a.category === category);
          if (items.length === 0) return null;
          return (
            <div key={category} className="mt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`achievements.cat.${category}` as MessageKey)}
              </h4>
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <SystemAchievementCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
