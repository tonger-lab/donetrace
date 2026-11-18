import { useCallback, useEffect, useState } from "react";
import { CloudDownload, CloudUpload, PlugZap } from "lucide-react";
import { localizeError, useI18n } from "../i18n";
import { api } from "../lib/api";
import { cn } from "../lib/cn";
import type { WebdavConfigData } from "../types/pro";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

const btnCls =
  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";

type Msg = { kind: "ok" | "err"; text: string } | null;

const DEFAULT_CONFIG: WebdavConfigData = {
  enabled: false,
  url: "",
  username: "",
  password: "",
  lastSuccessAt: null,
};

/**
 * WebDAV 备份区块（「云备份」页签的第二区块，仅官方安装包、登录后可用）。
 * 配置按邮箱本地存储（密码仅本机、不随备份导出）；每小时自动加密备份 + 手动备份 + 恢复。
 * 校验与 WebDAV 协议在 pro/ 后端（错误码经 localizeError 翻译）。
 */
export default function WebdavPanel({ unlocked }: { unlocked: boolean }) {
  const t = useI18n((s) => s.t);
  const [data, setData] = useState<WebdavConfigData | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const refresh = useCallback(async () => {
    const d = await api.pro.getWebdavConfig().catch(() => null);
    setData(d);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  const d = data ?? DEFAULT_CONFIG;

  const patch = (p: Partial<WebdavConfigData>) =>
    setData((prev) => ({ ...(prev ?? DEFAULT_CONFIG), ...p }));

  const save = async () => {
    if (!data) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.setWebdavConfig(data);
      setMsg({ kind: "ok", text: t("webdav.saved") });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    if (!data) return;
    setTesting(true);
    setMsg(null);
    try {
      await api.pro.testWebdav(data);
      setMsg({ kind: "ok", text: t("webdav.testOk") });
    } catch (e) {
      fail(e);
    } finally {
      setTesting(false);
    }
  };

  const backupNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.webdavBackupNow();
      setMsg({ kind: "ok", text: t("webdav.backupDone") });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const restoreLatest = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.webdavRestoreLatest();
      setMsg({ kind: "ok", text: t("webdav.restoreDone") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      <h3 className="font-medium">{t("webdav.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("webdav.hint")}</p>

      <label className="mt-4 flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={d.enabled}
          disabled={busy}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="size-4"
        />
        <span className="text-sm font-medium">{t("webdav.enabled")}</span>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">{t("webdav.enabledHint")}</p>

      <div className={cn("mt-4 space-y-4", !d.enabled && "pointer-events-none opacity-50")}>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("webdav.url")}</label>
          <input
            className={inputCls}
            value={d.url}
            onChange={(e) => patch({ url: e.target.value })}
            placeholder={t("webdav.urlPlaceholder")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("webdav.username")}</label>
            <input
              className={inputCls}
              value={d.username}
              onChange={(e) => patch({ username: e.target.value })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("webdav.password")}</label>
            <input
              className={inputCls}
              value={d.password}
              onChange={(e) => patch({ password: e.target.value })}
              type="password"
              autoComplete="off"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("webdav.passwordNote")}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !data}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {t("webdav.save")}
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={testing || busy || !data}
          onClick={() => void testConnection()}
        >
          <PlugZap className="size-3.5" /> {t("webdav.test")}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          disabled={busy || !unlocked || !data?.enabled}
          onClick={() => void backupNow()}
        >
          <CloudUpload className="size-4" /> {t("webdav.backupNow")}
        </button>
        <button
          type="button"
          className={btnCls}
          disabled={busy || !unlocked || !data?.enabled}
          onClick={() => void restoreLatest()}
        >
          <CloudDownload className="size-4" /> {t("webdav.restore")}
        </button>
        <span className="text-xs text-muted-foreground">
          {data?.lastSuccessAt
            ? t("webdav.lastSuccess", { date: data.lastSuccessAt.slice(0, 19).replace("T", " ") })
            : t("webdav.neverSuccess")}
        </span>
      </div>

      {msg && (
        <p className={msg.kind === "ok" ? "mt-3 text-sm text-emerald-600" : "mt-3 text-sm text-destructive"}>
          {msg.text}
        </p>
      )}
      {busy && <p className="mt-2 text-xs text-muted-foreground">{t("pro.busy")}</p>}
    </section>
  );
}
