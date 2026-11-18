import { BadgeCheck, LogIn, LogOut, Server, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { localizeError, useI18n } from "../i18n";
import { api } from "../lib/api";
import type { ProStatus } from "../types/pro";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

const btnCls =
  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";

type Msg = { kind: "ok" | "err"; text: string } | null;

/**
 * Pro 账号面板：仅官方安装包显示（免费构建显示提示）。
 * 注册 → 保存恢复码 → 邮箱验证 → 登录 → 立即备份 / 云端恢复。
 */
export default function ProAccountSection() {
  const t = useI18n((s) => s.t);

  const [proBuild, setProBuild] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [e2e, setE2e] = useState(true);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");

  const refreshStatus = () => api.pro.status().then(setStatus).catch(() => {});

  useEffect(() => {
    api.pro
      .isProBuild()
      .then(setProBuild)
      .catch(() => setProBuild(false));
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fail = (e: unknown) => {
    const s = String(e);
    // 试用防刷错误码：服务端消息为中文、英文界面需本地化
    if (s.includes("TRIAL_DEVICE_LIMIT")) {
      setMsg({ kind: "err", text: t("errors.trial_device_limit") });
      return;
    }
    setMsg({ kind: "err", text: localizeError(t, s) });
  };

  /** 兑换码错误码本地化（服务端消息为中文，英文界面需翻译） */
  const redeemFail = (e: unknown) => {
    const s = String(e);
    if (s.includes("INVALID_CODE")) return setMsg({ kind: "err", text: t("errors.redeem_invalid") });
    if (s.includes("ALREADY_REDEEMED")) return setMsg({ kind: "err", text: t("errors.redeem_used") });
    if (s.includes("CODE_EXPIRED")) return setMsg({ kind: "err", text: t("errors.redeem_expired") });
    if (s.includes("ALREADY_PRO")) return setMsg({ kind: "err", text: t("errors.redeem_already_pro") });
    setMsg({ kind: "err", text: localizeError(t, s) });
  };

  if (proBuild === null) return null;

  if (!proBuild) {
    return (
      <section className="mt-6 rounded-lg border bg-card p-5">
        <h3 className="font-medium">{t("pro.title")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("pro.freeBuild")}</p>
      </section>
    );
  }

  const license = status?.license ?? null;
  const loggedIn = status?.loggedIn ?? false;

  const register = async () => {
    setBusy(true);
    setMsg(null);
    setAwaitingVerify(false);
    setRecoveryCode(null);
    setRecoverySaved(false);
    try {
      const r = await api.pro.register(email.trim(), password, e2e);
      setAwaitingVerify(true);
      setRecoveryCode(r.recoveryCode);
      setMsg({ kind: "ok", text: t("pro.registerSent") });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const date = await api.pro.verify(email.trim(), verifyCode.trim());
      setMsg({ kind: "ok", text: t("pro.verifyDone", { date }) });
      setAwaitingVerify(false);
      setVerifyCode("");
      setRecoveryCode(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const downloadRecovery = () => {
    if (!recoveryCode) return;
    const blob = new Blob(
      [
        `DoneTrace recovery code\n\nAccount: ${email.trim()}\nRecovery code: ${recoveryCode}\n\n` +
          "Keep this file in a safe place. If you forget your password, this code is the ONLY way to recover your cloud backups.\n",
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "done-trace-recovery-code.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const login = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.login(email.trim(), password);
      setPassword("");
      await refreshStatus();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.unlock(password);
      setPassword("");
      await refreshStatus();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await api.pro.logout();
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  };

  /** 兑换 Pro 许可码（买断 + 附赠 1 年官方云同步）；成功后刷新许可状态 */
  const redeem = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.redeemLicense(redeemCode.trim());
      setRedeemCode("");
      setMsg({ kind: "ok", text: t("pro.redeemDone") });
      await refreshStatus();
    } catch (e) {
      redeemFail(e);
    } finally {
      setBusy(false);
    }
  };

  const licenseLine = (kind: "trial" | "pro") => {
    if (!license) return null;
    const part = license[kind];
    if (!part?.active) return null;
    if (kind === "pro") return <p className="text-xs text-emerald-600">{t("pro.proActive")}</p>;
    if (part.expires_at) {
      return (
        <p className="text-xs text-emerald-600">
          {t("pro.trialActive", { date: part.expires_at.slice(0, 10) })}
        </p>
      );
    }
    return null;
  };

  return (
    <section className="mt-6 rounded-lg border bg-card p-5">
      <h3 className="font-medium">{t("pro.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{t("pro.hint")}</p>

      {/* 服务器（内置，无需填写） */}
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Server className="size-4 shrink-0" />
        <span>{t("pro.serverCurrent")}：</span>
        <span className="truncate font-mono text-xs">
          {status?.serverUrl || "https://api.donetrace.app"}
        </span>
      </div>

      {!loggedIn ? (
        <>
          {/* 注册（注册后进入验证流程） */}
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("pro.registerEmail")}</label>
                <input
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("pro.registerPassword")}</label>
                <input
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="off"
                />
              </div>
            </div>
            {awaitingVerify && (
              <>
                {recoveryCode && (
                  <div className="rounded-md border border-red-400/50 bg-red-50 p-3 dark:bg-red-950/30">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                      {t("pro.recoveryTitle")}
                    </p>
                    <p className="mt-1 text-xs text-red-700/80 dark:text-red-400/80">
                      {t("pro.recoveryHint")}
                    </p>
                    <p className="mt-2 select-all font-mono text-sm tracking-wider">
                      {recoveryCode}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className={btnCls}
                        onClick={() => downloadRecovery()}
                      >
                        {t("pro.downloadRecovery")}
                      </button>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={recoverySaved}
                          onChange={(e) => setRecoverySaved(e.target.checked)}
                        />
                        {t("pro.recoverySaved")}
                      </label>
                    </div>
                  </div>
                )}
                <div className="rounded-md border border-amber-400/50 bg-amber-50 p-3 dark:bg-amber-950/30">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                    {t("pro.verifyPrompt")}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <input
                      className={inputCls}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder={t("pro.verifyCode")}
                    />
                    <button
                      type="button"
                      className={btnCls}
                      disabled={busy || (!!recoveryCode && !recoverySaved)}
                      onClick={() => void verify()}
                    >
                      {t("pro.verifyBtn")}
                    </button>
                  </div>
                </div>
              </>
            )}
            <label className="flex items-start gap-2 rounded-md border p-3 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={e2e}
                onChange={(e) => setE2e(e.target.checked)}
              />
              <span>
                <b>{t("pro.e2eLabel")}</b>
                <br />
                {e2e ? t("pro.e2eWarn") : t("pro.e2eOffNote")}
              </span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                disabled={busy || !email.trim() || !password}
                onClick={() => void register()}
              >
                <UserPlus className="size-4" /> {t("pro.registerBtn")}
              </button>
              <button
                type="button"
                className={btnCls}
                disabled={busy || !email.trim() || !password}
                onClick={() => void login()}
              >
                <LogIn className="size-4" /> {t("pro.loginBtn")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 space-y-2 border-t pt-4">
            <p className="text-sm">
              {status?.email ? t("pro.loggedInAs", { email: status.email }) : ""}
            </p>
            {!license?.pro?.active && licenseLine("trial")}
            {licenseLine("pro")}
            {!license?.trial?.active && !license?.pro?.active && !license?.sync?.active && (
              <p className="text-xs text-destructive">{t("pro.noLicense")}</p>
            )}
          </div>
          {!license?.pro?.active && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <p className="text-xs text-muted-foreground">{t("pro.redeemHint")}</p>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value)}
                  placeholder={t("pro.redeemPlaceholder")}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className={btnCls}
                  disabled={busy || !redeemCode.trim()}
                  onClick={() => void redeem()}
                >
                  <BadgeCheck className="size-4" /> {t("pro.redeemBtn")}
                </button>
              </div>
            </div>
          )}
          {!status?.unlocked && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">{t("pro.lockedHint")}</p>
              <p className="text-xs text-muted-foreground/80">{t("pro.unlockWhy")}</p>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder={t("pro.unlockPassword")}
                />
                <button type="button" className={btnCls} disabled={busy} onClick={() => void unlock()}>
                  {t("pro.unlockBtn")}
                </button>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={btnCls} disabled={busy} onClick={() => void logout()}>
              <LogOut className="size-4" /> {t("pro.logout")}
            </button>
          </div>
        </>
      )}

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
  );
}
