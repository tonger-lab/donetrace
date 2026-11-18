import { Loader2, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import { useProSignin } from "../stores/proSignin";
import type { ProfileData, ProStatus } from "../types/pro";

/**
 * 主界面左下角 Pro 账户入口（仅官方安装包显示）：
 * - 未登录：默认头像，点击 → 默认浏览器打开官网账号页（注册/登录/找回密码）
 * - 已登录：头像（自定义头像或首字母）+ 昵称，点击 → 个人档案页
 * - 官网深链登录转移中：显示「正在登录中…」（全局遮罩同时锁定交互）
 * 深链登录后通过 pro://signin-state 事件即时刷新（兜底 5 秒轮询 pro_status）。
 */
export default function ProAccountBadge() {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const [proBuild, setProBuild] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const signinPhase = useProSignin((s) => s.phase);
  const signinSeq = useProSignin((s) => s.seq);

  const load = useCallback(async () => {
    try {
      const s = await api.pro.status();
      setStatus(s);
      if (s.loggedIn) {
        setProfile(await api.pro.getProfile());
      } else {
        setProfile(null);
      }
    } catch {
      /* 免费构建或命令不存在时静默 */
    }
  }, []);

  useEffect(() => {
    api.pro
      .isProBuild()
      .then(setProBuild)
      .catch(() => setProBuild(false));
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [load]);

  // 深链登录转移完成（成功或失败）→ 立即刷新，不用等轮询
  useEffect(() => {
    if (signinSeq > 0) void load();
  }, [signinSeq, load]);

  if (!proBuild) return null;

  if (signinPhase === "signing-in") {
    return (
      <div className="mt-auto flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        <span className="truncate">{t("pro.signingIn")}</span>
      </div>
    );
  }

  const loggedIn = status?.loggedIn ?? false;
  const email = status?.email ?? "";
  const name = profile?.nickname || email.split("@")[0] || "";
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <button
      type="button"
      onClick={() => {
        if (loggedIn) {
          void navigate("/profile");
        } else {
          void api.pro.openWebsite();
        }
      }}
      className="mt-auto flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title={loggedIn ? email : t("pro.loginHint")}
    >
      {loggedIn && profile?.avatar ? (
        <img
          src={profile.avatar}
          alt={name}
          className="size-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {loggedIn ? initial : <User className="size-4" />}
        </span>
      )}
      <span className="truncate">{loggedIn ? name : t("pro.loginOrRegister")}</span>
    </button>
  );
}
