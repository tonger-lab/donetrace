# Changelog

All notable changes to this project will be documented in this file.

## [0.5.0] - 2026-11-18

### Added

- In-app updates: the Settings page now has an "Updates" section — check for updates, download and install directly inside the app, with progress and one-click restart. Updates are signed and verified (Ed25519) before installing
  - Checks for updates automatically once per day on startup, and prompts before downloading anything; manual check is always available
  - Supported on the Windows installer and the Linux AppImage; the .deb build shows a link to the website download page instead

### Fixed

- Pending tasks no longer disappear from the Tasks page when the day rolls over: the period filter now applies only to completed records, while all unfinished tasks of active projects stay visible until completed or deleted (data was never deleted, but the default "Today" view previously hid unfinished tasks entered on earlier days)

## [0.4.1] - 2026-11-05

### Added

- System achievements: the Achievements page now has a "System Achievements" section with 27 built-in milestones across four tracks — getting started, milestones, habits, and deep cuts
  - Gradients: 1/10/50/100/500/1,000 tasks · 1/10/50/100/500/1,000 recorded hours · 3/5 consecutive-day streaks (deliberately capped — no encouragement to work without rest) · 1/10/50/100 AI retrospectives · single-day scores of 480/576/720/960
  - Locked achievements show live progress bars (computed from your data, never stored); unlocked ones show the unlock date
  - No achievement points and no rollback: undoing or deleting tasks never revokes an unlock
  - Unlocks appear as bottom-right toasts; existing data is backfilled silently on first launch (unlock date = enablement day)
  - Achievement cards and unlock toasts use a bundled three-state SVG icon set: full-color when unlocked, muted silhouettes when locked, with separate variants tuned for light and dark themes

### Changed

- AI review requests now set a fixed temperature of 0.7 (previously the provider's default) for more stable output
- AI reviews for "Today" and "This Week" now include the current time and the remaining working hours of the period (Mon–Fri, 9:00–18:00) as context, so reviews distinguish a still-growing snapshot from close-to-final data
- This-week and last-week review length limits raised from 500 to 800 words

## [0.4.0] - 2026-11-02

### Added

- AI provider presets: OpenAI, Anthropic Claude (native API), Google Gemini, Mistral, OpenRouter, Groq, Ollama, DeepSeek, or any OpenAI-compatible endpoint — one-click preset fills the address and default model
- Launch date: when marking a project as launched you now pick the launch date (year-month-day), and launched projects can have their launch date edited from the detail page
- Installer language: setup and uninstall now auto-detect the OS language (Simplified Chinese on Chinese systems, English everywhere else — English is the default)
- AI reviews generated for "Today" now carry over automatically: when you open the app the next day, yesterday's Today review appears under "Yesterday"

### Changed

- The sidebar tagline now reads "成迹 · 记录你的来时路" (Chinese) / "DoneTrace · Record what you've done" (English)
- Settings now configures only your own (BYOK) AI provider; the official quota is no longer a provider preset there

## [0.3.0] - 2026-10-31

### Added

- Project "Launched" status: projects now have a three-state lifecycle — in progress, launched, archived
  - Marking a project as launched records its launch date; launched projects can still take on maintenance tasks
  - The Achievements page now showcases launched projects (launch date and days live) instead of archived ones
  - Archived projects are folded into a collapsible section at the bottom of the Projects page, where they can be reactivated back to their pre-archive status

### Changed

- Removed the legacy "completed" project status entirely (any historical rows are normalized to in-progress); the project lifecycle is now strictly in progress / launched / archived

## [0.2.2] - 2026-10-30

### Added

- Distinct uninstaller icon for the open-source installer (matches the open-source branding)

### Changed

- README is now English-only (the Chinese edition was removed)

### Fixed

- AI retrospectives now reply in English when the UI language is English, even when task names and descriptions are written in other languages
- Task lists sent to the AI are now ordered by completion time (earliest first), so retrospectives follow the actual order of execution
- Dark mode now persists across restarts (the saved theme is applied at startup)

## [0.2.1] - 2026-10-25

### Added

- Bilingual README (tab-switched English/Chinese) with GitHub Releases installation instructions
- GitHub Release binary publishing: Windows installer + SHA256 checksums (generated automatically after each source release)

### Changed

- None

### Fixed

- None

## [0.2.0] - 2026-10-25

### Added

- English UI: a new "Language" option in Settings (follow system / English / Chinese)
- AI review prompts localized to the UI language (separate English and Chinese prompts; context and work-hour formatting switch accordingly)

### Changed

- Window title unified to "DoneTrace"
- Backend errors now return error codes that the frontend translates for the current language

### Fixed

- Launching the app again no longer opens a new window: it focuses the existing one
- Language switches take effect immediately (including the sidebar and all dialogs)
- AI period-analysis prompts now state "1 day = 8 work hours" to prevent multi-day work hours from being read as 24-hour days
