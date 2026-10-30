import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyTheme } from "./lib/theme";
import { useTheme } from "./stores/theme";

// 启动即应用上次保存的主题（渲染前执行，避免浅色闪屏）。
// 颜色模式按钮已移入设置页（stores/theme.ts），此处负责恢复持久化状态。
applyTheme(useTheme.getState().theme);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
