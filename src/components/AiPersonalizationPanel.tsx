import { useCallback, useEffect, useState } from "react";
import { localizeError, useI18n, type MessageKey } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import type { AiPersonalizationData } from "../types/pro";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

const btnCls =
  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";

type Msg = { kind: "ok" | "err"; text: string } | null;

const TONES: { value: AiPersonalizationData["tone"]; labelKey: MessageKey }[] = [
  { value: "encouraging", labelKey: "aiPersonalization.tone.encouraging" },
  { value: "direct", labelKey: "aiPersonalization.tone.direct" },
  { value: "concise", labelKey: "aiPersonalization.tone.concise" },
];

const FOCUS_OPTIONS: { value: string; labelKey: MessageKey }[] = [
  { value: "efficiency", labelKey: "aiPersonalization.focus.efficiency" },
  { value: "quality", labelKey: "aiPersonalization.focus.quality" },
  { value: "learning", labelKey: "aiPersonalization.focus.learning" },
  { value: "balance", labelKey: "aiPersonalization.focus.balance" },
];

const DEFAULT_DATA: AiPersonalizationData = {
  enabled: false,
  role: "",
  goals: "",
  tone: "encouraging",
  focus: "",
  temperature: 0.7,
};

/**
 * 个性化 AI 复盘面板（个人档案页第四页签，仅官方安装包、登录后可用）。
 * L1 身份 / L2 偏好（语气 + 侧重点）/ L3 目标（纯文本）+ 创意度（temperature，
 * 独立于总开关生效）。所有业务校验在 pro/ 后端（desktop 存储层），
 * 错误码经 localizeError 翻译。档案本地存储按邮箱，随 E2E 备份同步。
 */
export default function AiPersonalizationPanel({ loggedIn }: { loggedIn: boolean }) {
  const t = useI18n((s) => s.t);
  const [data, setData] = useState<AiPersonalizationData | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!loggedIn) {
      setData(null);
      return;
    }
    const d = await api.pro.getAiPersonalization().catch(() => null);
    setData(d);
  }, [loggedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  if (!loggedIn) {
    return (
      <section className="mt-6 rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("aiPersonalization.loginRequired")}</p>
      </section>
    );
  }

  const d = data ?? DEFAULT_DATA;
  const focusSet = d.focus.split(",").filter(Boolean);

  const patch = (p: Partial<AiPersonalizationData>) =>
    setData((prev) => ({ ...(prev ?? DEFAULT_DATA), ...p }));

  const toggleFocus = (value: string, checked: boolean) => {
    const next = checked
      ? [...focusSet, value]
      : focusSet.filter((f) => f !== value);
    patch({ focus: next.join(",") });
  };

  const save = async () => {
    if (!data) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.setAiPersonalization(data);
      setMsg({ kind: "ok", text: t("aiPersonalization.saved") });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      {/* 总开关（默认关；关闭时其余控件置灰但保留值） */}
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={d.enabled}
          disabled={busy}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="size-4"
        />
        <span className="text-sm font-medium">{t("aiPersonalization.enabled")}</span>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">{t("aiPersonalization.enabledHint")}</p>

      <div className={cn("mt-4 space-y-4", !d.enabled && "pointer-events-none opacity-50")}>
        {/* L1 身份 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("aiPersonalization.role")}</label>
          <input
            className={inputCls}
            value={d.role}
            maxLength={60}
            onChange={(e) => patch({ role: e.target.value })}
            placeholder={t("aiPersonalization.rolePlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("aiPersonalization.roleHint")}</p>
        </div>

        {/* L3 目标 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("aiPersonalization.goals")}</label>
          <textarea
            className={cn(inputCls, "min-h-20 resize-y")}
            value={d.goals}
            onChange={(e) => patch({ goals: e.target.value })}
            placeholder={t("aiPersonalization.goalsPlaceholder")}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">{t("aiPersonalization.goalsHint")}</p>
        </div>

        {/* L2 语气 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("aiPersonalization.tone")}</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => (
              <label
                key={tone.value}
                className={cn(
                  btnCls,
                  "cursor-pointer",
                  d.tone === tone.value && "border-primary bg-primary/10",
                )}
              >
                <input
                  type="radio"
                  name="ai-personalization-tone"
                  checked={d.tone === tone.value}
                  onChange={() => patch({ tone: tone.value })}
                  className="sr-only"
                />
                {t(tone.labelKey)}
              </label>
            ))}
          </div>
        </div>

        {/* L2 侧重点 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("aiPersonalization.focus")}</label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  btnCls,
                  "cursor-pointer",
                  focusSet.includes(opt.value) && "border-primary bg-primary/10",
                )}
              >
                <input
                  type="checkbox"
                  checked={focusSet.includes(opt.value)}
                  onChange={(e) => toggleFocus(opt.value, e.target.checked)}
                  className="sr-only"
                />
                {t(opt.labelKey)}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* 创意度（独立于总开关生效：关闭个性化时仍可调整） */}
      <div className="mt-4 space-y-1.5">
        <label className="flex items-baseline justify-between text-sm font-medium">
          <span>{t("aiPersonalization.temperature")}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {d.temperature.toFixed(1)}
          </span>
        </label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={d.temperature}
          disabled={busy}
          onChange={(e) => patch({ temperature: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <p className="text-xs text-muted-foreground">{t("aiPersonalization.temperatureHint")}</p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !data}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {t("aiPersonalization.save")}
        </button>
        {msg && (
          <p className={msg.kind === "ok" ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
