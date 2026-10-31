# DoneTrace

> Record what you've done. See how far you've come.

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
- **Projects** — organize tasks into projects with a three-state lifecycle: in progress ⇄ launched → archived. Launched projects keep accepting maintenance tasks; archived projects fold away at the bottom and can be reactivated.
- **Core projects & icons** — pin one core project to the top; emoji or custom (cropped) project icons.
- **Period analysis** — today / yesterday / this week / last week: total score, work hours, and per-project breakdown.
- **AI retrospectives** — optional reviews powered by DeepSeek (OpenAI-compatible); bring your own API key. Period reviews and per-project logs are saved as Markdown.
- **Achievements** — projects you've launched are showcased as achievements, with their launch date and days live.
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

v0.3.0 — early stage. The core app is free and open source; this repository contains the full-featured free version.

## License

[Apache License 2.0](LICENSE)
