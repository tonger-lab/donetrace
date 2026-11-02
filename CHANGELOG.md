# Changelog

All notable changes to this project will be documented in this file.
Pro-only features are marked with `(Pro)`.

## [0.4.0] - 2026-11-02

### Added

- AI provider presets: OpenAI, Anthropic Claude (native API), Google Gemini, Mistral, OpenRouter, Groq, Ollama, DeepSeek, or any OpenAI-compatible endpoint — one-click preset fills the address and default model
- (Pro) Built-in AI quota: use the official DoneTrace AI endpoint instead of your own key — requests are proxied through DoneTrace's server (never stored) with daily limits; BYOK stays the default and remains unlimited
- Launch date: when marking a project as launched you now pick the launch date (year-month-day), and launched projects can have their launch date edited from the detail page
- Installer language: setup and uninstall now auto-detect the OS language (Simplified Chinese on Chinese systems, English everywhere else — English is the default)
- (Pro) Soul Notes (心灵寄语): a rotating line of personal notes under the DoneTrace logo in the sidebar
  - Requires a signed-in Pro account; managed from a new "Soul Notes" tab on the profile page
  - Toggle rotation and pick a switch interval (30 s / 1 min / 5 min / 30 min / 1 h; default 5 min)
  - Five starter notes are seeded on first use, in your interface language — classical Chinese
    adages and established English proverbs; add, edit, and delete freely
  - Each note allows up to 60 character-widths (CJK characters count as 2) and shows on at most 2 lines
  - Deleting every note turns rotation off automatically, and it stays off until you add one back
  - Notes and settings are stored locally per account and travel with your encrypted backups
  - Notes are typed out character by character (typewriter effect) when they switch
- AI reviews generated for "Today" now carry over automatically: when you open the app the next day, yesterday's Today review appears under "Yesterday"

### Changed

- The sidebar tagline now reads "成迹 · 记录你的来时路" (Chinese) / "DoneTrace · Record what you've done" (English)
- Settings now configures only your own (BYOK) AI provider; the official quota is no longer a provider preset there
- (Pro) Official AI moved to a new "Official AI" tab on the profile page: an off-by-default toggle that shows today's remaining quota; when enabled, the official quota is used first and automatically falls back to your own key if it runs out

## [0.3.0] - 2026-10-31

### Added

- Project "Launched" status: projects now have a three-state lifecycle — in progress, launched, archived
  - Marking a project as launched records its launch date; launched projects can still take on maintenance tasks
  - The Achievements page now showcases launched projects (launch date and days live) instead of archived ones
  - Archived projects are folded into a collapsible section at the bottom of the Projects page, where they can be reactivated back to their pre-archive status
- (Pro) Personal profile page: avatar (upload with zoom & crop) and nickname (defaults to the email prefix)
  - Stored locally only — the server never sees your profile; it travels with your end-to-end encrypted backups
  - The Pro account section moved from Settings to the profile page (opened via the account badge)

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
