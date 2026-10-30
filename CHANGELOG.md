# Changelog

All notable changes to this project will be documented in this file.
Pro-only features are marked with `(Pro)`.

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
