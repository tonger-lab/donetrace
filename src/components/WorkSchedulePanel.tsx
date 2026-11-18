import { useCallback, useEffect, useState } from "react";
import { localizeError, useI18n } from "../i18n";
import { api } from "../lib/api";
import { scheduleStandards } from "../lib/workhours";
import { cn } from "../lib/cn";
import type { WorkScheduleData } from "../types/pro";

type Msg = { kind: "ok" | "err"; text: string } | null;

/** 内置标准工作时间（免费版 / Pro 未自定义时的口径） */
const BUILTIN_SCHEDULE: WorkScheduleData = {
  workdays: [true, true, true, true, true, false, false],
  start: "09:00",
  end: "18:00",
};

const DAY_KEYS = [
  "workSchedule.day.mon",
  "workSchedule.day.tue",
  "workSchedule.day.wed",
  "workSchedule.day.thu",
  "workSchedule.day.fri",
  "workSchedule.day.sat",
  "workSchedule.day.sun",
] as const;

function fmtHours(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(1).replace(/\.0$/, "");
}

/**
 * 自定义工作时间面板（个人档案页「工作时间」页签，仅官方安装包）：
 * - Pro 用户：每周工作几天 + 起止时间，保存后作用于 AI 复盘「时间背景」与完成度百分比；
 * - 未保存 = 内置标准（周一至周五 9:00–18:00，完成度日 8h / 周 40h），与免费版一致。
 */
export default function WorkSchedulePanel({ loggedIn }: { loggedIn: boolean }) {
  const t = useI18n((s) => s.t);

  const [schedule, setSchedule] = useState<WorkScheduleData>(BUILTIN_SCHEDULE);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const refresh = useCallback(async () => {
    if (!loggedIn) {
      setSchedule(BUILTIN_SCHEDULE);
      setLoaded(false);
      return;
    }
    try {
      const saved = await api.pro.getWorkSchedule();
      setSchedule(saved ?? BUILTIN_SCHEDULE);
    } catch {
      setSchedule(BUILTIN_SCHEDULE);
    } finally {
      setLoaded(true);
    }
  }, [loggedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!loggedIn) {
    return (
      <section className="mt-6 rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("workSchedule.loginRequired")}</p>
      </section>
    );
  }

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  const toggleDay = (i: number) => {
    setMsg(null);
    setSchedule((s) => {
      const days = [...s.workdays];
      days[i] = !days[i];
      return { ...s, workdays: days };
    });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.setWorkSchedule(schedule);
      setMsg({ kind: "ok", text: t("workSchedule.saved") });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const standards = scheduleStandards(schedule);
  const summary = t("workSchedule.summary", {
    day: fmtHours(standards.dayMinutes),
    week: fmtHours(standards.weekMinutes),
  });

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      {!loaded && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
      {loaded && (
        <>
          {/* 每周工作日 */}
          <label className="text-sm font-medium">{t("workSchedule.workdays")}</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {DAY_KEYS.map((key, i) => (
              <button
                key={key}
                type="button"
                disabled={busy}
                onClick={() => toggleDay(i)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
                  schedule.workdays[i]
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {t(key)}
              </button>
            ))}
          </div>

          {/* 起止时间 */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("workSchedule.start")}</label>
              <input
                type="time"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                value={schedule.start}
                disabled={busy}
                onChange={(e) => {
                  setMsg(null);
                  setSchedule({ ...schedule, start: e.target.value });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("workSchedule.end")}</label>
              <input
                type="time"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                value={schedule.end}
                disabled={busy}
                onChange={(e) => {
                  setMsg(null);
                  setSchedule({ ...schedule, end: e.target.value });
                }}
              />
            </div>
          </div>

          {/* 当前口径摘要 */}
          <p className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {summary}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {t("workSchedule.save")}
            </button>
            {msg && (
              <p
                className={
                  msg.kind === "ok"
                    ? "text-sm text-emerald-600"
                    : "text-sm text-destructive"
                }
              >
                {msg.text}
              </p>
            )}
          </div>

          <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
            {t("workSchedule.hint")}
          </p>
        </>
      )}
    </section>
  );
}
