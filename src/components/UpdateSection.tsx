import { Download, ExternalLink, RefreshCw, RotateCw } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "../i18n";
import { openWebsite } from "../lib/updater";
import { useUpdaterStore } from "../stores/updater";

/**
 * 设置页「更新」区块（免费版与 Pro 共用）：
 * - 支持应用内更新的格式（Windows NSIS / Linux AppImage）：检查更新 → 用户确认 → 下载进度 → 完成重启；
 * - deb 等不支持自更新的格式：显示官网下载引导（拍板 v1 口径）。
 */
export default function UpdateSection() {
  const t = useI18n((s) => s.t);
  const {
    status,
    currentVersion,
    availableVersion,
    notes,
    progress,
    error,
    capability,
    upToDate,
    init,
    check,
    download,
    relaunch,
  } = useUpdaterStore();

  useEffect(() => {
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const percent = progress === null ? null : Math.round(progress * 100);

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      <h3 className="font-medium">{t("update.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("update.currentVersion")} {currentVersion || "…"}
      </p>

      {capability === "website" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">{t("update.websiteHint")}</p>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            onClick={() => void openWebsite()}
          >
            <ExternalLink className="size-4" /> {t("update.websiteGo")}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={status === "checking" || status === "downloading"}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
              onClick={() => void check()}
            >
              <RefreshCw
                className={
                  status === "checking" ? "size-4 animate-spin" : "size-4"
                }
              />
              {status === "checking" ? t("update.checking") : t("update.check")}
            </button>
            {status === "available" && (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                onClick={() => void download()}
              >
                <Download className="size-4" />
                {t("update.download", { version: availableVersion ?? "" })}
              </button>
            )}
            {status === "done" && (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
                onClick={() => void relaunch()}
              >
                <RotateCw className="size-4" /> {t("update.relaunch")}
              </button>
            )}
          </div>

          {status === "available" && (
            <>
              <p className="mt-2 text-sm text-emerald-600">
                {t("update.available", { version: availableVersion ?? "" })}
              </p>
              {notes && (
                <p className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {notes}
                </p>
              )}
            </>
          )}
          {upToDate && status === "idle" && (
            <p className="mt-2 text-sm text-emerald-600">{t("update.upToDate")}</p>
          )}
          {status === "downloading" && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                {percent === null
                  ? t("update.downloading")
                  : t("update.downloadingPercent", { percent })}
              </p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: percent === null ? "30%" : `${percent}%` }}
                />
              </div>
            </div>
          )}
          {status === "done" && (
            <p className="mt-2 text-sm text-emerald-600">{t("update.done")}</p>
          )}
          {status === "error" && (
            <p className="mt-2 text-sm text-destructive">
              {t("update.failed", { error: error ?? "" })}
            </p>
          )}
        </>
      )}
    </section>
  );
}
