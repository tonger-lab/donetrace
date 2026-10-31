import { Camera } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import IconPickerDialog from "../components/IconPickerDialog";
import ProAccountSection from "../components/ProAccountSection";
import { localizeError, useI18n } from "../i18n";
import { api } from "../lib/api";
import type { ProfileData, ProStatus } from "../types/pro";

const inputCls =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60";

const btnCls =
  "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50";

type Msg = { kind: "ok" | "err"; text: string } | null;

/**
 * 个人档案页（仅官方安装包）：头像（缩放裁剪，复用图标裁剪组件）+ 昵称
 * （默认 = 邮箱前缀）+ 原设置页的 Pro 账户区块。
 * 档案本地存储（profile 表），随 E2E 加密备份同步，服务器不接触。
 */
export default function ProfilePage() {
  const t = useI18n((s) => s.t);

  const [proBuild, setProBuild] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const s = await api.pro.status().catch(() => null);
    setStatus(s ?? null);
    if (s?.loggedIn) {
      const p = await api.pro.getProfile().catch(() => null);
      setProfile(p ?? null);
    } else {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    api.pro
      .isProBuild()
      .then(setProBuild)
      .catch(() => setProBuild(false));
    void refresh();
    const id = setInterval(() => void refresh(), 5000);
    return () => clearInterval(id);
  }, [refresh]);

  // 档案变化（保存/登录切换）时同步编辑框；输入过程不受轮询干扰
  useEffect(() => {
    setNickname(profile?.nickname ?? "");
  }, [profile?.nickname, status?.email]);

  if (proBuild === null) return null;

  const loggedIn = status?.loggedIn ?? false;
  const email = status?.email ?? "";
  const emailPrefix = email.split("@")[0] || "";
  const displayName = profile?.nickname || emailPrefix;
  const initial = (email[0] ?? "?").toUpperCase();

  const fail = (e: unknown) => setMsg({ kind: "err", text: localizeError(t, String(e)) });

  const saveNickname = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.setProfile(nickname.trim() || null, profile?.avatar ?? null);
      setMsg({ kind: "ok", text: t("profile.saved") });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmAvatar = async (dataUrl: string) => {
    setAvatarOpen(false);
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.setProfile(profile?.nickname ?? null, dataUrl);
      setMsg({ kind: "ok", text: t("profile.saved") });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const removeAvatar = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api.pro.setProfile(profile?.nickname ?? null, null);
      setMsg({ kind: "ok", text: t("profile.saved") });
      await refresh();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h2 className="text-2xl font-semibold">{t("profile.title")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>

      {proBuild && loggedIn && (
        <section className="mt-6 rounded-lg border bg-card p-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setAvatarOpen(true)}
              title={t("profile.changeAvatar")}
              className="group relative shrink-0"
            >
              {profile?.avatar ? (
                <img
                  src={profile.avatar}
                  alt={displayName}
                  className="size-16 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-full bg-primary/15 text-xl font-bold text-primary">
                  {initial}
                </span>
              )}
              <span className="absolute bottom-0 right-0 rounded-full bg-primary p-1 text-primary-foreground">
                <Camera className="size-3.5" />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAvatarOpen(true)}
                  disabled={busy}
                  className={btnCls}
                >
                  <Camera className="size-3.5" /> {t("profile.changeAvatar")}
                </button>
                {profile?.avatar && (
                  <button type="button" onClick={() => void removeAvatar()} disabled={busy} className={btnCls}>
                    {t("profile.removeAvatar")}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            <label className="text-sm font-medium">{t("profile.nickname")}</label>
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={nickname}
                maxLength={32}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={emailPrefix}
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => void saveNickname()}
                disabled={busy}
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {t("profile.save")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("profile.nicknameHint")}</p>
          </div>

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
        </section>
      )}

      {/* Pro 账户（原设置页区块迁入；免费构建此处显示提示） */}
      <ProAccountSection />

      {/* 头像裁剪：复用项目图标组件（缩放 + 区域选择） */}
      <IconPickerDialog
        open={avatarOpen}
        onClose={() => setAvatarOpen(false)}
        onConfirm={(dataUrl) => void confirmAvatar(dataUrl)}
      />
    </div>
  );
}
