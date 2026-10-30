import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { api } from "../lib/api";
import type { ProStatus } from "../types/pro";

/**
 * 主界面左下角 Pro 账户入口（仅官方安装包显示）：
 * - 未登录：默认头像，点击 → 默认浏览器打开官网账号页（注册/登录/找回密码）
 * - 已登录：头像首字母 + 用户名，点击 → 跳转设置页 Pro 区域
 * 深链登录后通过轮询 pro_status 自动刷新。
 */
export default function ProAccountBadge() {
  const t = useI18n((s) => s.t);
  const navigate = useNavigate();
  const [proBuild, setProBuild] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ProStatus | null>(null);

  useEffect(() => {
    api.pro
      .isProBuild()
      .then(setProBuild)
      .catch(() => setProBuild(false));
    const load = () => api.pro.status().then(setStatus).catch(() => {});
    void load();
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, []);

  if (!proBuild) return null;

  const loggedIn = status?.loggedIn ?? false;
  const email = status?.email ?? "";
  const name = email.split("@")[0] || "";
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <button
      type="button"
      onClick={() => {
        if (loggedIn) {
          void navigate("/settings");
        } else {
          void api.pro.openWebsite();
        }
      }}
      className="mt-auto flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title={loggedIn ? email : t("pro.loginHint")}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {loggedIn ? initial : <User className="size-4" />}
      </span>
      <span className="truncate">{loggedIn ? name : t("pro.loginOrRegister")}</span>
    </button>
  );
}
