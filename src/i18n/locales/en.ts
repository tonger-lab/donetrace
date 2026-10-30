/**
 * English catalog — the source of truth for message keys.
 * zh-CN is typed against this object, so every key here must exist there.
 */
export const en = {
  /* ---------- common ---------- */
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.saving": "Saving…",
  "common.confirm": "Confirm",
  "common.ok": "OK",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.close": "Close",
  "common.loading": "Loading…",
  "common.processing": "Processing…",
  "common.testing": "Testing…",
  "common.unknownProject": "Unknown project",
  "common.selectPlaceholder": "Select",
  "common.noOptions": "No options available",
  "common.items": "{count} items",
  "common.scoreUnit": "pts",
  "common.totalWorkHours": "Total work hours",
  "common.totalScore": "Total score",
  "common.addTask": "Add task",
  "common.editTask": "Edit task",
  "common.deleteTask": "Delete task",
  "common.newProject": "New project",
  "common.editProject": "Edit project",

  /* ---------- brand ---------- */
  "brand.name": "DoneTrace",
  "brand.tagline": "DoneTrace · Record the path you've walked",
  "brand.confirmWord": "DoneTrace",
  "brand.footer": "DoneTrace v0.1.0 · Record the path you've walked",

  /* ---------- nav ---------- */
  "nav.tasks": "Tasks",
  "nav.projects": "Projects",
  "nav.analysis": "Analysis",
  "nav.achievements": "Achievements",
  "nav.settings": "Settings",

  /* ---------- theme ---------- */
  "theme.toLight": "Switch to light mode",
  "theme.toDark": "Switch to dark mode",
  "theme.light": "Light mode",
  "theme.dark": "Dark mode",

  /* ---------- task value ---------- */
  "value.normal": "Normal",
  "value.important": "Important",
  "value.critical": "Critical",

  /* ---------- units ---------- */
  "units.day": "d",
  "units.hour": "h",
  "units.minute": "min",

  /* ---------- backend errors (codes) ---------- */
  "errors.ai.no_api_key": "No DeepSeek API key configured. Add one in Settings first.",
  "errors.ai.empty_period": "No completed tasks in this period, nothing to analyze.",
  "errors.ai.project_not_found": "Project not found.",
  "errors.ai.log_not_found": "Review log not found.",
  "errors.ai.unauthorized": "API key invalid (401). Check your settings.",
  "errors.ai.insufficient_balance": "Insufficient account balance (402). Top up and retry.",
  "errors.ai.invalid_response": "The AI returned an unexpected response format.",
  "errors.settings.sqlite": "Database error.",
  "errors.settings.invalid_language": "Invalid language setting.",

  /* ---------- tasks page ---------- */
  "tasks.title": "Tasks",
  "tasks.todayFilter": "Today's tasks",
  "tasks.weekFilter": "This week's tasks",
  "tasks.addDisabledHint": "Create or reactivate an active project first",
  "tasks.noActiveProject":
    "No active projects. Create one on the Projects page or reactivate a completed project.",
  "tasks.pending": "Pending ({count})",
  "tasks.noTasksInPeriod": "No tasks recorded in this period.",
  "tasks.noPendingInPeriod": "No pending tasks in this period.",
  "tasks.doneToday": "Completed today",
  "tasks.doneThisWeek": "Completed this week",
  "tasks.noDoneInPeriod": "No completed records in this period yet.",
  "tasks.deleteTaskConfirm": 'Delete task "{name}"? This cannot be undone.',

  /* ---------- task form ---------- */
  "taskForm.name": "Task name",
  "taskForm.namePlaceholder": "What did you get done today?",
  "taskForm.project": "Project",
  "taskForm.projectPlaceholder": "Select a project",
  "taskForm.value": "Task value",
  "taskForm.score": "Task score (subjective estimate of time invested)",
  "taskForm.description": "Task description (optional)",
  "taskForm.descriptionPlaceholder": "Additional notes…",

  /* ---------- table headers ---------- */
  "table.taskName": "Task name",
  "table.project": "Project",
  "table.value": "Task value",
  "table.score": "Score",
  "table.createdAt": "Created",
  "table.completedAt": "Completed",

  /* ---------- task row ---------- */
  "row.markDone": "Mark as done",
  "row.undoDone": "Undo completion",

  /* ---------- projects page ---------- */
  "projects.title": "Projects",
  "projects.hint": "Use ↑ ↓ to reorder. Archive and delete live on the project detail page.",
  "projects.empty": 'No projects yet. Click "New project" to get started.',
  "projects.viewDetail": "View project details",
  "projects.core": "Core",
  "projects.default": "Default",
  "projects.moveUp": "Move up",
  "projects.moveDown": "Move down",

  /* ---------- project form ---------- */
  "projectForm.name": "Project name",
  "projectForm.namePlaceholder": "e.g. DoneTrace development",
  "projectForm.icon": "Project icon",
  "projectForm.uploadCustom": "Upload custom image",
  "projectForm.currentIcon": "Current icon",
  "projectForm.customImage": "Custom image",
  "projectForm.description": "Project description (optional)",
  "projectForm.descriptionPlaceholder": "What is this project about?",

  /* ---------- icon picker ---------- */
  "iconPicker.title": "Custom project icon",
  "iconPicker.hint": "Pick an image (png / jpg), drag to position, zoom to crop",
  "iconPicker.zoom": "Zoom",
  "iconPicker.reset": "Reset",
  "iconPicker.reselect": "Choose again",
  "iconPicker.pick": "Choose image",

  /* ---------- project detail ---------- */
  "detail.back": "Back to projects",
  "detail.archived": "Archived",
  "detail.markCore": "Mark as core project",
  "detail.markCoreHint": "Mark as core project (unique, pinned to top)",
  "detail.unmarkCore": "Remove core mark",
  "detail.unmarkCoreHint": "Remove core mark",
  "detail.reactivate": "Reactivate",
  "detail.archive": "Archive",
  "detail.deleteProject": "Delete project",
  "detail.pendingTasks": "Pending tasks ({count})",
  "detail.noPendingTasks": "No pending tasks",
  "detail.projectEnded": "This project has ended and no longer accepts new tasks.",
  "detail.timeline": "Completion timeline",
  "detail.noDoneYet": "Nothing completed yet. Finished tasks are archived here by date.",
  "detail.groupMeta": "{count} items · {score} pts",
  "detail.aiReview": "AI Review",
  "detail.analyzing": "Analyzing… (may take tens of seconds)",
  "detail.generateReview": "Generate / overwrite today's review",
  "detail.reviewHint":
    "Results are saved as dated log files; configure the DeepSeek API in Settings first.",
  "detail.logMeta": "Review log {date} · generated on {date}",
  "detail.addTaskToProject": 'Add a task to "{name}"',
  "detail.archiveTitle": "Archive project",
  "detail.archiveConfirm":
    'Archiving "{name}" moves it to Achievements; no more tasks can be added or modified.',
  "detail.deleteProjectConfirm":
    'Delete project "{name}"? Only projects without any tasks can be deleted. This cannot be undone.',

  /* ---------- achievements ---------- */
  "achievements.title": "Achievements",
  "achievements.subtitle":
    "Archived projects are displayed here as trophies of your journey. Reactivate them to continue.",
  "achievements.empty": "No achievements yet. Complete and archive a project to see it here.",
  "achievements.statusBefore": "Status before archiving:",
  "achievements.statusCompleted": "Completed",
  "achievements.statusActive": "In progress",
  "achievements.cumulative": "Cumulative",
  "achievements.archivedOn": "archived {date}",
  "achievements.reactivateTitle": "Reactivate project",
  "achievements.reactivateConfirm":
    'Restore "{name}" to "{status}" status and move it back to the project list.',
  "achievements.activate": "Activate",

  /* ---------- analysis ---------- */
  "analysis.title": "Analysis",
  "analysis.tabToday": "Today's analysis",
  "analysis.tabYesterday": "Yesterday's review",
  "analysis.tabWeek": "This week's analysis",
  "analysis.tabLastWeek": "Last week's review",
  "analysis.hintToday": "Everything you finished today is here.",
  "analysis.hintYesterday": "Look back at yesterday: what went well, what needs adjusting?",
  "analysis.hintWeek": "This week by project — see where your time went.",
  "analysis.hintLastWeek": "Last week's review: a new week, a fresh start.",
  "analysis.completedTasks": "Tasks completed",
  "analysis.byProject": "Breakdown by project",
  "analysis.records": "Completion records",
  "analysis.completedList": "Completed tasks",
  "analysis.noRecordsWeek": "No completed records this week.",
  "analysis.noRecordsDay": "No completed records on this day.",
  "analysis.aiSection": "AI Analysis",
  "analysis.generatedAt": "Generated at {time}",
  "analysis.overwriteNote": " (re-analyzing overwrites)",
  "analysis.reanalyze": "Re-analyze (overwrite)",
  "analysis.analyzeHint":
    "Send this period's completions to AI for review; the result is saved for later.",
  "analysis.noRecordsForAi": "No completed records in this period",
  "analysis.generateBtn": "Generate analysis (requires DeepSeek API configured)",

  /* ---------- settings ---------- */
  "settings.title": "Settings",
  "settings.languageTitle": "Language",
  "settings.languageHint": "Interface language. \"Follow system\" uses your OS language.",
  "settings.themeTitle": "Color mode",
  "settings.themeHint": "Light or dark interface.",
  "settings.languageAuto": "Follow system",
  "settings.languageEn": "English",
  "settings.languageZh": "简体中文",
  "settings.deepseekTitle": "DeepSeek API (AI review)",
  "settings.deepseekHint":
    "Without configuration, all AI features are unavailable. The API key is stored locally only and never included in exports.",
  "settings.apiKey": "API Key",
  "settings.apiKeyConfigured": "Configured (leave blank to keep unchanged)",
  "settings.apiKeyPlaceholder": "sk-…",
  "settings.baseUrl": "Base URL",
  "settings.model": "Model",
  "settings.saved": "Saved",
  "settings.testConnection": "Test connection",
  "settings.dataTitle": "Data management",
  "settings.dataHint":
    "Your data is this tool's lifeblood — export a backup weekly. Exports never contain your API key.",
  "settings.exportData": "Export data",
  "settings.importData": "Import data",
  "settings.clearAll": "Clear all",
  "settings.exportedTo": "Exported to: {path}",
  "settings.importSummary":
    "Import complete: projects +{pc}/updated {pu}; tasks +{tc}/updated {tu}; reports +{rc}/updated {ru}; logs +{lc}/updated {lu}.",
  "settings.importRefreshNote": "(switch to another page and back to see the latest data)",
  "settings.cleared":
    "All data cleared and default project recreated (DeepSeek API configuration kept).",

  /* ---------- import dialog ---------- */
  "import.title": "Import backup",
  "import.hint": 'The backup contains the following data; "New" is the count not present in the current app.',
  "import.type": "Type",
  "import.fileCount": "In file",
  "import.newCount": "New",
  "import.reports": "AI analysis reports",
  "import.logs": "Project review logs",
  "import.replace": "Replace all (clear existing data)",
  "import.merge": "Merge (recommended)",

  /* ---------- clear data dialog ---------- */
  "clear.title": "Clear all data",
  "clear.warningPre": "This will delete ",
  "clear.warningBold": "all projects, tasks, analysis reports, and review logs",
  "clear.warningPost":
    " and recreate the default project; the DeepSeek API configuration is kept. This cannot be undone!",
  "clear.confirmPrompt": "Type {word} to confirm:",
  "clear.confirmBtn": "Clear data",

  /* ---------- pro account ---------- */
  "pro.title": "Pro Account",
  "pro.hint":
    "Pro trial & official cloud backup. Backups are end-to-end encrypted — the server only stores ciphertext.",
  "pro.freeBuild":
    "This is the free open-source build. Download the official build to use Pro features (30-day free trial included).",
  "pro.serverUrl": "Server",
  "pro.serverSaved": "Server address saved",
  "pro.registerEmail": "Email",
  "pro.registerPassword": "Password",
  "pro.registerBtn": "Register (30-day trial)",
  "pro.registerSent": "Sign-up submitted — a verification code has been sent to your email.",
  "pro.e2eLabel": "End-to-end encrypted cloud storage (recommended)",
  "pro.e2eWarn":
    "With E2E, only you can read your backups. If you forget your password AND lose the recovery code, cloud backups cannot be recovered. Please save the recovery code shown after sign-up.",
  "pro.e2eOffNote":
    "Server-side encrypted storage: forgetting your password can never lose your cloud backups, but the server could technically read them. Only disable this if you prefer recoverability over privacy.",
  "pro.recoveryTitle": "⚠️ Save your recovery code — it is shown only once!",
  "pro.recoveryHint":
    "If you forget your password, this code is the only way to recover your cloud backups. Download it as a file and keep it in a safe place.",
  "pro.downloadRecovery": "Download code file",
  "pro.recoverySaved": "I have saved the recovery code",
  "pro.verifyPrompt": "Enter the verification code sent to your email to activate the trial:",
  "pro.verifyCode": "Email verification code",
  "pro.verifyBtn": "Verify & activate trial",
  "pro.verifyDone": "Trial activated until {date}. Now log in.",
  "pro.loginBtn": "Log in",
  "pro.loginTitle": "Log in",
  "pro.loggedInAs": "Logged in as {email}",
  "pro.trialActive": "Trial active until {date}",
  "pro.proActive": "Pro license active",
  "pro.syncActive": "Cloud sync active until {date}",
  "pro.noLicense": "No active license",
  "pro.lockedHint": "Session locked — enter your password to enable cloud backup.",
  "pro.unlockWhy": "Why a password? Your password never leaves your device, and the login state does not carry the decryption key — this is the design that keeps your backup unreadable even to us.",
  "pro.unlockPassword": "Password",
  "pro.unlockBtn": "Unlock",
  "pro.backupNow": "Back up now",
  "pro.backupDone": "Cloud backup uploaded ({size} bytes, encrypted)",
  "pro.restoreLatest": "Restore latest from cloud",
  "pro.restoreDone": "Restored from cloud and merged into local data.",
  "pro.logout": "Log out",
  "pro.busy": "Working…",
  "pro.loginOrRegister": "Log in / Register",
  "pro.loginHint": "Not logged in — click to open the website to register or log in (state transfers back to the app)",
  "pro.serverCurrent": "Server (built-in, no setup needed)",
} as const;
