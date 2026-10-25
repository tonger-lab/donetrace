# DoneTrace 成迹

> Record what you've done. See how far you've come.
> 记录完成，看清来时路。

<details open>
<summary>English</summary>

**DoneTrace** is a local-first achievement tracker for knowledge workers — indie developers, engineers, and anyone who does brain work. It is *not* a todo app. Todos ask, "What's left to do?" DoneTrace asks, "What have I accomplished?"

Everything lives on your machine: tasks, projects, scores, and retrospectives. Nothing leaves it unless you export it.

## Install (Windows)

Download the latest installer from [GitHub Releases](https://github.com/tonger-lab/donetrace/releases/latest) (`DoneTrace_x.y.z_x64-setup.exe`) and run it. All data is stored locally in `%APPDATA%\DoneTrace` — no account, no cloud, no tracking.

## Philosophy

- **Completion over planning.** Record finished work, not endless lists of unfinished intent.
- **Time invested counts.** Tasks with effort spent but no direct output yet are still worth recording and celebrating.
- **Your data is yours.** Local SQLite storage, no account, no cloud, no tracking.

## Features

- **Tasks & scoring** — mark value as normal (×1.0), important (×1.5), or critical (×2.0); every task earns a score, automatically converted to weighted work hours (1 day = 8 h).
- **Projects** — organize tasks into projects, mark core projects, set custom icons, and archive finished projects.
- **Period analysis** — today / yesterday / this week / last week: total score, work hours, and per-project breakdown.
- **AI retrospectives** — optional reviews powered by DeepSeek (OpenAI-compatible); bring your own API key. Period reviews and per-project logs are saved as Markdown.
- **Achievements** — archived projects stay on display as trophies of your journey.
- **Data management** — one-click export/import (zip) for backup and migration.
- **English & Chinese UI** — switch language in Settings (follows the system by default).
- **Single instance** — launching again focuses the existing window instead of opening a new one.

## Tech Stack

Tauri 2 · Rust · React 18 · TypeScript · Vite · Tailwind CSS 4 · SQLite (rusqlite) · Zustand · Recharts

## Development

> The public mirror keeps the app at the repository root. In the private monorepo, run all commands from the `desktop/` directory.

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/)
- Windows: [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) runtime and MSVC build tools

### Commands

```bash
pnpm install        # install dependencies
pnpm tauri dev      # start in development mode
pnpm test           # frontend unit tests (Vitest)
cargo test          # Rust unit tests (inside src-tauri/)
pnpm lint           # ESLint
pnpm tauri build    # Windows installer (NSIS)
```

## Status

v0.2.1 — early stage. The core app is free and open source; this repository contains the full-featured free version.

## License

[Apache License 2.0](LICENSE)

</details>

<details>
<summary>中文</summary>

**成迹 DoneTrace** 是一款本地优先的个人成果记录工具，面向独立开发者、工程师等脑力工作者。它**不是**待办清单应用：待办清单问「还有什么没做？」，成迹问「我已经做成了什么？」。

所有数据都保存在你的设备上：任务、项目、分数与复盘记录。除非你主动导出，任何数据都不会离开本机。

## 安装（Windows）

从 [GitHub Releases](https://github.com/tonger-lab/donetrace/releases/latest) 下载最新安装包（`DoneTrace_x.y.z_x64-setup.exe`）并运行即可。所有数据保存在本机 `%APPDATA%\DoneTrace`——无账号、无云端、无追踪。

## 产品理念

- **记录完成，而非罗列计划。** 记录已完成的工作，而不是堆积未完成的意图。
- **投入了时间就值得记录。** 花了时间但暂无直接产出的任务，同样值得记录与肯定。
- **数据属于你自己。** 本地 SQLite 存储，无账号、无云端、无追踪。

## 功能

- **任务与计分** —— 价值三档：常规（×1.0）、重要（×1.5）、关键（×2.0）；每个任务都有分数，自动折算为加权工时（1 天 = 8 小时）。
- **项目** —— 任务按项目组织，支持核心项目标记、自定义图标、归档。
- **周期分析** —— 今日 / 昨日 / 本周 / 上周：总分、工时、按项目分类统计。
- **AI 复盘** —— 可选功能，由 DeepSeek（OpenAI 兼容协议）驱动，自带 API Key；周期分析与项目复盘以 Markdown 保存。
- **成就** —— 归档项目永久陈列，见证你的来路。
- **数据管理** —— 一键导出 / 导入（zip），方便备份与迁移。
- **中英双语界面** —— 设置中切换语言（默认跟随系统）。
- **单实例运行** —— 应用运行中再次启动，会聚焦已有窗口而不是新开一个。

## 技术栈

Tauri 2 · Rust · React 18 · TypeScript · Vite · Tailwind CSS 4 · SQLite (rusqlite) · Zustand · Recharts

## 开发

> 公开镜像中应用位于仓库根目录；私有 monorepo 中所有命令请在 `desktop/` 目录下执行。

### 环境要求

- [Rust](https://www.rust-lang.org/tools/install)（stable）
- [Node.js](https://nodejs.org/) 18+ 与 [pnpm](https://pnpm.io/)
- Windows：[WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 运行时与 MSVC 构建工具

### 常用命令

```bash
pnpm install        # 安装依赖
pnpm tauri dev      # 开发模式启动
pnpm test           # 前端单元测试（Vitest）
cargo test          # Rust 单元测试（在 src-tauri/ 内）
pnpm lint           # ESLint
pnpm tauri build    # 构建 Windows 安装包（NSIS）
```

## 当前状态

v0.2.1 —— 早期阶段。核心应用免费且开源，本仓库即完整功能的免费版。

## 开源协议

[Apache License 2.0](LICENSE)

</details>
