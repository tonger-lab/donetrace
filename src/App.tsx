import { useEffect, useState } from "react";
import { HashRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { BarChart3, CheckSquare, FolderKanban, Moon, Settings, Sun, Trophy } from "lucide-react";
import { cn } from "./lib/cn";
import { applyTheme, getStoredTheme, type Theme } from "./lib/theme";
import { useI18n, type MessageKey } from "./i18n";
import TasksPage from "./pages/TasksPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import AnalysisPage from "./pages/AnalysisPage";
import AchievementsPage from "./pages/AchievementsPage";
import SettingsPage from "./pages/SettingsPage";

const NAV_ITEMS: { to: string; key: MessageKey; icon: typeof CheckSquare }[] = [
  { to: "/tasks", key: "nav.tasks", icon: CheckSquare },
  { to: "/projects", key: "nav.projects", icon: FolderKanban },
  { to: "/analysis", key: "nav.analysis", icon: BarChart3 },
  { to: "/achievements", key: "nav.achievements", icon: Trophy },
  { to: "/settings", key: "nav.settings", icon: Settings },
];

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());
  const ready = useI18n((s) => s.ready);
  const t = useI18n((s) => s.t);

  useEffect(() => {
    void useI18n.getState().init();
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 语言初始化完成前不渲染，避免语言闪烁
  if (!ready) return null;

  return (
    <HashRouter>
      <div className="flex h-full">
        <aside className="flex w-52 shrink-0 flex-col border-r border-border bg-card p-3">
          <div className="mb-4 px-2 py-3">
            <h1 className="text-xl font-bold tracking-wide">{t("brand.name")}</h1>
            <p className="text-xs text-muted-foreground">{t("brand.tagline")}</p>
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

          <button
            type="button"
            onClick={() => setTheme((cur) => (cur === "dark" ? "light" : "dark"))}
            className="mt-auto flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            title={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {theme === "dark" ? t("theme.light") : t("theme.dark")}
          </button>
        </aside>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/analysis" element={<AnalysisPage />} />
            <Route path="/achievements" element={<AchievementsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
