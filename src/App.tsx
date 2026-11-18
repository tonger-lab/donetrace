import { useEffect, useState } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { BarChart3, CheckSquare, FolderKanban, Loader2, Settings, Trophy } from "lucide-react";
import { cn } from "./lib/cn";
import { useI18n, type MessageKey } from "./i18n";
import BrandTagline from "./components/BrandTagline";
import ProAccountBadge from "./components/ProAccountBadge";
import AchievementToasts from "./components/AchievementToasts";
import ConfirmDialog from "./components/ConfirmDialog";
import { startAchievementListener } from "./lib/achievementEvents";
import { startProSigninListener } from "./lib/proSigninEvents";
import { lastCheckKey, markCheckedToday, shouldAutoCheck, todayKey } from "./lib/updater";
import { useProSignin } from "./stores/proSignin";
import { useUpdaterStore } from "./stores/updater";
import TasksPage from "./pages/TasksPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import AnalysisPage from "./pages/AnalysisPage";
import AchievementsPage from "./pages/AchievementsPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

const NAV_ITEMS: { to: string; key: MessageKey; icon: typeof CheckSquare }[] = [
  { to: "/tasks", key: "nav.tasks", icon: CheckSquare },
  { to: "/projects", key: "nav.projects", icon: FolderKanban },
  { to: "/analysis", key: "nav.analysis", icon: BarChart3 },
  { to: "/achievements", key: "nav.achievements", icon: Trophy },
  { to: "/settings", key: "nav.settings", icon: Settings },
];

/**
 * 官网深链登录转移期间的全屏遮罩：显示「正在登录中…」并锁定全部交互；
 * 失败时显示错误与关闭按钮。
 */
function ProSigninOverlay() {
  const t = useI18n((s) => s.t);
  const phase = useProSignin((s) => s.phase);
  const error = useProSignin((s) => s.error);
  const dismiss = useProSignin((s) => s.dismiss);

  if (phase === "idle") return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70">
      <div className="flex w-80 flex-col items-center gap-3 rounded-xl border bg-card p-6 shadow-lg">
        {phase === "signing-in" ? (
          <>
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm">{t("pro.signingIn")}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-destructive">{t("pro.signInFailed")}</p>
            {error && (
              <p className="max-h-24 w-full overflow-auto break-all text-xs text-muted-foreground">
                {error}
              </p>
            )}
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
              onClick={dismiss}
            >
              {t("pro.dismiss")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const ready = useI18n((s) => s.ready);
  const t = useI18n((s) => s.t);
  const availableVersion = useUpdaterStore((s) => s.availableVersion);
  const [updatePrompt, setUpdatePrompt] = useState(false);

  useEffect(() => {
    void useI18n.getState().init();
    startAchievementListener();
    startProSigninListener();
  }, []);

  // 启动时自动检查更新（每天一次；支持应用内更新的格式才检查，发现新版弹确认框）
  useEffect(() => {
    if (!ready) return;
    const store = useUpdaterStore.getState();
    void store.init().then(async () => {
      if (useUpdaterStore.getState().capability !== "full") return;
      if (!shouldAutoCheck(lastCheckKey(), todayKey())) return;
      markCheckedToday();
      const found = await store.check();
      if (found) setUpdatePrompt(true);
    });
  }, [ready]);

  // 语言初始化完成前不渲染，避免语言闪烁
  if (!ready) return null;

  return (
    <HashRouter>
      <div className="flex h-full">
        <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-card p-3">
          <div className="mb-4 px-2 py-3">
            <h1 className="text-xl font-bold tracking-wide">{t("brand.name")}</h1>
            {/* 开源版固定品牌语；Pro 登录且开启心灵寄语后按设定时间随机轮换 */}
            <BrandTagline />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, key, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {t(key)}
              </NavLink>
            ))}
          </nav>

          {/* 左下角：Pro 账户入口（官方构建）；颜色模式已移至设置页 */}
          <ProAccountBadge />
        </aside>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        {/* 成就解锁右下角 toast（全局，订阅 Rust 端 achievements://unlocked 事件） */}
        <AchievementToasts />
        {/* 官网深链登录转移遮罩（进行中锁定交互 / 失败可关闭） */}
        <ProSigninOverlay />
        {/* 启动时自动检查发现新版本 → 用户确认后下载（进度见设置 → 更新） */}
        <ConfirmDialog
          open={updatePrompt}
          title={t("update.autoTitle")}
          description={t("update.autoPrompt", {
            version: availableVersion ?? "",
          })}
          confirmText={t("update.downloadNow")}
          onConfirm={() => {
            setUpdatePrompt(false);
            void useUpdaterStore.getState().download();
          }}
          onCancel={() => setUpdatePrompt(false)}
        />
      </div>
    </HashRouter>
  );
}
