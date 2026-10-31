import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import type { ProfileData, ProStatus } from "../types/pro";

/**
 * 主界面左下角 Pro 账户入口（仅官方安装包显示）：
 * - 未登录：默认头像，点击 → 默认浏览器打开官网账号页（注册/登录/找回密码）
 * - 已登录：头像（自定义头像或首字母）+ 昵称，点击 → 个人档案页
 * 深链登录后通过轮询 pro_status 自动刷新；档案（头像/昵称）随轮询同步刷新。
 */
export default function ProAccountBadge() {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const [proBuild, setProBuild] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);

  useEffect(() => {
    api.pro
      .isProBuild()
      .then(setProBuild)
      .catch(() => setProBuild(false));
    const load = async () => {
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
    };
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  if (!proBuild) return null;

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
