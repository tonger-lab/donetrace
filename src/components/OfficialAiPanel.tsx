import { useCallback, useEffect, useState } from "react";
import { localizeError, useI18n } from "../i18n";
import { api } from "../lib/api";
import type { AiQuota } from "../types/pro";

type Msg = { kind: "ok" | "err" | "info"; text: string } | null;

/**
 * 官方 AI（DoneTrace Official AI）面板（个人档案页的第三页签，仅官方安装包）：
 * - 开关「使用 DoneTrace 官方 AI」（默认关，本地存储；仅未配置自有 API Key 时生效）；
 * - 显示今日剩余额度（GET /ai/quota，登录后）；
 * - 已配置自有 API Key 时提示"自有 Key 优先"。
 * 业务规则（自有 Key 优先 / 额度门禁）在 desktop ai.rs 与服务端执行，这里只做展示与开关。
 */
export default function OfficialAiPanel({ loggedIn }: { loggedIn: boolean }) {
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);

  const [official, setOfficial] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [quota, setQuota] = useState<AiQuota | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const refreshQuota = useCallback(async () => {
    if (!loggedIn) {
      setQuota(null);
      setQuotaLoading(false);
      return;
    }
    setQuotaLoading(true);
    try {
      setQuota(await api.pro.getAiQuota());
    } catch {
      setQuota(null);
    } finally {
      setQuotaLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    // 开关与自有 Key 状态（本地读取，免费构建缺命令时静默）
    api.pro
      .getAiOfficial()
      .then(setOfficial)
      .catch(() => setOfficial(false));
    api.settings
      .getDeepseekConfig()
      .then((c) => setHasApiKey(c.hasApiKey))
      .catch(() => setHasApiKey(false));
    void refreshQuota();
  }, [refreshQuota]);

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  const toggle = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const next = !official;
      await api.pro.setAiOfficial(next);
      setOfficial(next);
      setMsg({ kind: "ok", text: t("aiOfficial.saved") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (!loggedIn) {
    return (
      <section className="mt-6 rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("aiOfficial.loginRequired")}</p>
      </section>
    );
  }

  const entitled = quota?.entitled ?? false;
  const available = quota?.available ?? false;
  const remaining = quota?.remainingCalls ?? 0;
  const daily = quota?.dailyCalls ?? 0;
  const resetTime = quota ? new Date(quota.resetAt) : null;
  const resetText = resetTime
    ? resetTime.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <>
      <section className="mt-6 rounded-lg border bg-card p-5">
        {/* 开关（默认关） */}
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={official}
            onChange={() => void toggle()}
            disabled={busy}
            className="mt-0.5 size-4 shrink-0 accent-primary disabled:opacity-50"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{t("aiOfficial.useLabel")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t("aiOfficial.useHint")}
            </span>
          </span>
        </label>

        {hasApiKey && (
          <p className="mt-3 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {t("aiOfficial.ownApiNote")}
          </p>
        )}
        {msg && (
          <p
            className={
              msg.kind === "ok"
                ? "mt-3 text-sm text-emerald-600"
                : msg.kind === "err"
                  ? "mt-3 text-sm text-destructive"
                  : "mt-3 text-sm text-muted-foreground"
            }
          >
            {msg.text}
          </p>
        )}
      </section>

      {/* 今日额度（账号级，登录后始终展示） */}
      <section className="mt-6 rounded-lg border bg-card p-5">
        <h3 className="font-medium">{t("aiOfficial.quotaTitle")}</h3>
        {quotaLoading && (
          <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
        )}
        {!quotaLoading && !quota && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("aiOfficial.quotaUnavailable")}
          </p>
        )}
        {!quotaLoading && quota && !entitled && (
          <p className="mt-2 text-sm text-destructive">{t("aiOfficial.entitlementExpired")}</p>
        )}
        {!quotaLoading && quota && entitled && !available && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t("aiOfficial.serviceUnavailable")}
          </p>
        )}
        {!quotaLoading && quota && entitled && available && (
          <>
            <p className="mt-2 text-2xl font-semibold">
              {t("aiOfficial.quotaRemaining", { remaining, daily })}
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${daily > 0 ? Math.min(100, (remaining / daily) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {remaining > 0
                ? t("aiOfficial.quotaResetNote", { time: resetText })
                : hasApiKey
                  ? t("aiOfficial.quotaExhaustedWithApi")
                  : t("aiOfficial.quotaExhausted")}
            </p>
          </>
        )}
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {t("aiOfficial.proxyNote")}
        </p>
      </section>
    </>
  );
}
