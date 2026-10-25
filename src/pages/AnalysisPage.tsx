import dayjs from "dayjs";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ProjectIcon from "../components/ProjectIcon";
import MarkdownView from "../components/MarkdownView";
import TaskRow from "../components/TaskRow";
import { useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import { formatScore } from "../lib/scoring";
import { completionPercent, formatWorkHours } from "../lib/workhours";
import type { AnalysisData, AnalysisPeriod } from "../types/analysis";

const TABS: { key: AnalysisPeriod; labelKey: MessageKey }[] = [
  { key: "today", labelKey: "analysis.tabToday" },
  { key: "yesterday", labelKey: "analysis.tabYesterday" },
  { key: "week", labelKey: "analysis.tabWeek" },
  { key: "last_week", labelKey: "analysis.tabLastWeek" },
];

const PERIOD_HINT_KEYS: Record<AnalysisPeriod, MessageKey> = {
  today: "analysis.hintToday",
  yesterday: "analysis.hintYesterday",
  week: "analysis.hintWeek",
  last_week: "analysis.hintLastWeek",
};

export default function AnalysisPage() {
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);
  const [period, setPeriod] = useState<AnalysisPeriod>("today");
  const [data, setData] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.analysis
      .get(period)
      .then(setData)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const runAnalyze = async () => {
    setAnalyzing(true);
    setAiError(null);
    try {
      await api.analysis.analyze(period);
      load();
    } catch (err) {
      setAiError(String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const isWeekly = period === "week" || period === "last_week";
  const chartData = (data?.byProject ?? []).map((s) => ({
    name: s.projectName,
    score: s.score,
  }));

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-2xl font-semibold">{t("analysis.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t(PERIOD_HINT_KEYS[period])}</p>

      {/* 周期切换 */}
      <div className="mt-4 inline-flex rounded-lg border bg-card p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setPeriod(tab.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              period === tab.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && <p className="mt-6 text-sm text-muted-foreground">{t("common.loading")}</p>}

      {!loading && data && (
        <>
          {/* 总览 */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t("analysis.completedTasks")}</p>
              <p className="mt-1 text-2xl font-semibold">
                {t("common.items", { count: data.taskCount })}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t("common.totalWorkHours")}</p>
              <p className="mt-1 text-2xl font-semibold">
                {formatWorkHours(data.totalScore, locale)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  （{completionPercent(data.totalScore, isWeekly ? "week" : "day")}%）
                </span>
              </p>
            </div>
          </div>

          {/* 周视图：按项目分类统计 */}
          {isWeekly && data.byProject.length > 0 && (
            <section className="mt-6 rounded-lg border bg-card p-4">
              <h3 className="font-medium">{t("analysis.byProject")}</h3>
              <div className="mt-3 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                    <Tooltip
                      formatter={(value) => [formatScore(Number(value)), t("common.scoreUnit")]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="score" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 space-y-1.5">
                {data.byProject.map((s) => (
                  <li key={s.projectId} className="flex items-center gap-2 text-sm">
                    <ProjectIcon icon={s.projectIcon} className="size-5" />
                    <span className="flex-1 truncate">{s.projectName}</span>
                    <span className="text-muted-foreground">
                      {t("common.items", { count: s.taskCount })}
                    </span>
                    <span className="w-14 text-right font-medium">
                      {formatScore(s.score)} {t("common.scoreUnit")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 任务列表 */}
          <section className="mt-6">
            <h3 className="border-b pb-1.5 font-medium">
              {isWeekly ? t("analysis.records") : t("analysis.completedList")}
            </h3>
            {data.tasks.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {isWeekly ? t("analysis.noRecordsWeek") : t("analysis.noRecordsDay")}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2.5 px-2 pb-1 pt-2 text-xs text-muted-foreground">
                  <span className="min-w-0 flex-1">{t("table.taskName")}</span>
                  <span className="w-32 shrink-0">{t("table.project")}</span>
                  <span className="w-16 shrink-0">{t("table.value")}</span>
                  <span className="w-14 shrink-0 text-right">{t("table.score")}</span>
                  <span className="w-24 shrink-0 text-right">{t("table.completedAt")}</span>
                </div>
                <ul className="mt-1">
                  {data.tasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      canToggle={false}
                      onToggle={() => {}}
                      onEdit={() => {}}
                      onDelete={() => {}}
                      showProject
                      timeText={
                        task.completedAt ? dayjs(task.completedAt).format("MM-DD HH:mm") : ""
                      }
                      hideToggle
                      hideActions
                    />
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* AI 分析 */}
          <section className="mt-8">
            <h3 className="flex items-center gap-1.5 border-b pb-1.5 font-medium">
              <Sparkles className="size-4" /> {t("analysis.aiSection")}
            </h3>
            {aiError && (
              <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {aiError}
              </div>
            )}
            {data.report ? (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">
                  {t("analysis.generatedAt", {
                    time: dayjs(data.report.createdAt).format("YYYY-MM-DD HH:mm"),
                  })}
                  {period === "today" || period === "week" ? t("analysis.overwriteNote") : ""}
                </p>
                <div className="mt-2 rounded-lg border bg-card p-4">
                  <MarkdownView content={data.report.content} />
                </div>
                <button
                  type="button"
                  onClick={() => void runAnalyze()}
                  disabled={analyzing}
                  className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {analyzing ? t("detail.analyzing") : t("analysis.reanalyze")}
                </button>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">{t("analysis.analyzeHint")}</p>
                <button
                  type="button"
                  onClick={() => void runAnalyze()}
                  disabled={analyzing || data.taskCount === 0}
                  className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {analyzing
                    ? t("detail.analyzing")
                    : data.taskCount === 0
                      ? t("analysis.noRecordsForAi")
                      : t("analysis.generateBtn")}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
