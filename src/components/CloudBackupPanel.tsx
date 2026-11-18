import { useCallback, useEffect, useState } from "react";
import { CloudDownload, CloudUpload, Cloud } from "lucide-react";
import { localizeError, useI18n } from "../i18n";
import { api } from "../lib/api";
import type { ProBackupDone, ProStatus } from "../types/pro";
import WebdavPanel from "./WebdavPanel";

const btnCls =
  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";

type Msg = { kind: "ok" | "err"; text: string } | null;

/**
 * 「云备份」页签（个人档案页第五页签，仅官方安装包、登录后可用）。
 * 两个区块并存、双开关：官方云同步（自原个人档案页 Pro 账户区迁入）+ WebDAV 备份。
 */
export default function CloudBackupPanel({ loggedIn }: { loggedIn: boolean }) {
  const t = useI18n((s) => s.t);
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const refreshStatus = useCallback(() => {
    api.pro
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setStatus(null);
      return;
    }
    refreshStatus();
    const id = setInterval(refreshStatus, 5000);
    return () => clearInterval(id);
  }, [loggedIn, refreshStatus]);

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  if (!loggedIn) {
    return (
      <section className="mt-6 rounded-lg border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("cloudBackup.loginRequired")}</p>
      </section>
    );
  }

  const license = status?.license ?? null;
  const unlocked = status?.unlocked ?? false;

  const backupNow = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const done: ProBackupDone = await api.pro.backupNow();
      setMsg({ kind: "ok", text: t("pro.backupDone", { size: done.encryptedSize }) });
      refreshStatus();
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
      await api.pro.restoreLatest();
      setMsg({ kind: "ok", text: t("pro.restoreDone") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* 区块一：官方云同步（自原个人档案页迁入） */}
      <section className="mt-6 rounded-lg border bg-card p-5">
        <h3 className="flex items-center gap-1.5 font-medium">
          <Cloud className="size-4" /> {t("cloudBackup.officialTitle")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("cloudBackup.officialHint")}</p>

        <div className="mt-3 space-y-2">
          <p className="text-sm">
            {status?.email ? t("pro.loggedInAs", { email: status.email }) : ""}
          </p>
          {license?.sync?.active && (
            <p className="text-xs text-emerald-600">
              {license.sync.expires_at
                ? t("pro.syncActive", { date: license.sync.expires_at.slice(0, 10) })
                : t("cloudBackup.officialTitle")}
            </p>
          )}
          {!license?.sync?.active && (
            <p className="text-xs text-muted-foreground">{t("cloudBackup.noSyncLicense")}</p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            disabled={busy || !unlocked}
            onClick={() => void backupNow()}
          >
            <CloudUpload className="size-4" /> {t("pro.backupNow")}
          </button>
          <button
            type="button"
            className={btnCls}
            disabled={busy || !unlocked}
            onClick={() => void restoreLatest()}
          >
            <CloudDownload className="size-4" /> {t("pro.restoreLatest")}
          </button>
        </div>

        {msg && (
          <p
            className={
              msg.kind === "ok" ? "mt-3 text-sm text-emerald-600" : "mt-3 text-sm text-destructive"
            }
          >
            {msg.text}
          </p>
        )}
        {busy && <p className="mt-2 text-xs text-muted-foreground">{t("pro.busy")}</p>}
      </section>

      {/* 区块二：WebDAV 备份 */}
      <WebdavPanel unlocked={unlocked} />
    </>
  );
}
