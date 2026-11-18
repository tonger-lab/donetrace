import { Globe, Monitor, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";
import { localizeError, useI18n } from "../i18n";
import { api } from "../lib/api";
import type { DeviceInfo } from "../types/pro";

type Msg = { kind: "ok" | "err"; text: string } | null;

/**
 * 登录设备管理面板（个人档案页「设备」页签，仅官方安装包）：
 * - 列出当前账号的全部登录设备（GET /me/devices，最新活跃在前）；
 * - 标记「当前设备」（本机 deviceId）；
 * - 注销其他设备（DELETE /me/devices/{id}）：释放每账号 5 台名额并吊销该设备刷新令牌。
 * 业务规则（设备上限/防刷）在服务端执行，这里只做展示与注销。
 */
export default function DevicesPanel({
  loggedIn,
  deviceId,
}: {
  loggedIn: boolean;
  deviceId: string;
}) {
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);

  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [revokeTarget, setRevokeTarget] = useState<DeviceInfo | null>(null);

  const refresh = useCallback(async () => {
    if (!loggedIn) {
      setDevices(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api.pro.listDevices();
      setDevices(r.devices);
    } catch {
      setDevices(null);
    } finally {
      setLoading(false);
    }
  }, [loggedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  const confirmRevoke = async () => {
    if (!revokeTarget || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.revokeDevice(revokeTarget.id);
      setMsg({ kind: "ok", text: t("devices.revokeDone") });
      setRevokeTarget(null);
      await refresh();
    } catch (e) {
      setRevokeTarget(null);
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (!loggedIn) {
    return (
      <section className="mt-6 rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("devices.loginRequired")}</p>
      </section>
    );
  }

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(locale === "zh-CN" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const platformLabel = (platform: string) =>
    platform === "web"
      ? t("devices.platformWeb")
      : platform === "desktop"
        ? t("devices.platformDesktop")
        : platform;

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t("devices.listTitle")}</h3>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          disabled={busy || loading}
          onClick={() => void refresh()}
        >
          <RefreshCw className="size-3.5" /> {t("devices.refresh")}
        </button>
      </div>

      {loading && (
        <p className="mt-3 text-sm text-muted-foreground">{t("common.loading")}</p>
      )}
      {!loading && !devices && (
        <p className="mt-3 text-sm text-muted-foreground">{t("devices.unavailable")}</p>
      )}
      {!loading && devices && (
        <ul className="mt-3 divide-y divide-border">
          {devices.map((d) => {
            const current = d.id === deviceId && deviceId !== "";
            return (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {d.platform === "web" ? <Globe className="size-4" /> : <Monitor className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium">
                    <span className="truncate">{d.name}</span>
                    {current && (
                      <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                        {t("devices.currentBadge")}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="rounded border px-1.5 py-0.5 text-[11px]">
                      {platformLabel(d.platform)}
                    </span>
                    <span>{t("devices.firstSeen", { date: fmtDate(d.createdAt) })}</span>
                    <span>{t("devices.lastActive", { date: fmtDate(d.lastSeenAt) })}</span>
                  </p>
                </div>
                {!current && (
                  <button
                    type="button"
                    className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                    disabled={busy}
                    onClick={() => {
                      setMsg(null);
                      setRevokeTarget(d);
                    }}
                  >
                    <Trash2 className="size-3.5" /> {t("devices.revoke")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {msg && (
        <p
          className={
            msg.kind === "ok"
              ? "mt-3 text-sm text-emerald-600"
              : "mt-3 text-sm text-destructive"
          }
        >
          {msg.text}
        </p>
      )}

      <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        {t("devices.limitHint")}
      </p>

      <ConfirmDialog
        open={revokeTarget !== null}
        title={t("devices.revokeConfirmTitle")}
        description={
          revokeTarget
            ? t("devices.revokeConfirmText", { name: revokeTarget.name })
            : ""
        }
        confirmText={t("devices.revoke")}
        danger
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setRevokeTarget(null)}
      />
    </section>
  );
}
