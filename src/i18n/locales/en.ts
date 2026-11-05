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
  "brand.tagline": "DoneTrace · Record what you've done",
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
  "errors.ai.no_api_key": "No AI interface configured yet. Add your API key in Settings first.",
  "errors.ai.empty_period": "No completed tasks in this period, nothing to analyze.",
  "errors.ai.project_not_found": "Project not found.",
  "errors.ai.log_not_found": "Review log not found.",
  "errors.ai.unauthorized": "API key invalid (401). Check your settings.",
  "errors.ai.insufficient_balance": "Insufficient account balance (402). Top up and retry.",
  "errors.ai.invalid_response": "The AI returned an unexpected response format.",
  "errors.ai.ai_quota_exceeded":
    "Today's official AI quota is used up and no personal API is configured: add your own API key in Settings, or wait for tomorrow's reset.",
  "errors.ai.ai_entitlement_required":
    "The official AI requires an active trial or Pro license: buy Pro, or configure your own API key in Settings.",
  "errors.ai.ai_disabled":
    "The official AI is not available yet — configure your own API key in Settings.",
  "errors.ai.ai_not_configured":
    "No AI interface configured: enable DoneTrace Official AI in Profile → Official AI (preferred); if the official quota runs out, configure your own API in Settings.",
  "errors.ai.not_logged_in":
    "Official AI requires a signed-in Pro account: sign in and enable it in Profile → Official AI, or configure your own API key in Settings.",
  "errors.ai_personalization.role_too_long": "The role is limited to 60 characters.",
  "errors.ai_personalization.goal_too_long": "Each goal is limited to 60 characters.",
  "errors.ai_personalization.too_many_goals": "At most 3 goals.",
  "errors.ai_personalization.temperature_out_of_range":
    "Creativity must be between 0.0 and 2.0.",
  "errors.settings.sqlite": "Database error.",
  "errors.settings.invalid_language": "Invalid language setting.",

  /* ---------- tasks page ---------- */
  "tasks.title": "Tasks",
  "tasks.todayFilter": "Today's tasks",
  "tasks.weekFilter": "This week's tasks",
  "tasks.addDisabledHint": "Create or reactivate an in-progress or launched project first",
  "tasks.noActiveProject":
    "No in-progress or launched projects. Create one on the Projects page or reactivate an archived project.",
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
  "projects.hint":
    "Use ↑ ↓ to reorder. Launched projects get a badge; archived ones are folded at the bottom.",
  "projects.empty": 'No projects yet. Click "New project" to get started.',
  "projects.viewDetail": "View project details",
  "projects.core": "Core",
  "projects.default": "Default",
  "projects.moveUp": "Move up",
  "projects.moveDown": "Move down",
  "projects.live": "Launched",
  "projects.launch": "Mark as launched",
  "projects.unlaunch": "Back to in progress",
  "projects.archivedSection": "Archived ({count})",

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
  "detail.live": "Launched",
  "detail.launch": "Mark as launched",
  "detail.unlaunch": "Back to in progress",
  "detail.editLaunchDate": "Edit launch date",
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
    'Archiving "{name}" moves it to the archived section at the bottom of the Projects page; no more tasks can be added or modified.',
  "detail.deleteProjectConfirm":
    'Delete project "{name}"? Only projects without any tasks can be deleted. This cannot be undone.',

  /* ---------- achievements ---------- */
  "achievements.title": "Achievements",
  "achievements.subtitle":
    "Launched projects are displayed here as trophies of your journey — they have reached real users and started creating value.",
  "achievements.empty":
    "No achievements yet. When a project goes live, it will appear here as an achievement.",
  "achievements.statusActive": "In progress",
  "achievements.statusLive": "Launched",
  "achievements.cumulative": "Cumulative",
  "achievements.archivedOn": "archived {date}",
  "achievements.launchedOn": "launched {date}",
  "achievements.liveToday": "launched today",
  "achievements.oneDayLive": "live for 1 day",
  "achievements.daysLive": "live for {count} days",
  "achievements.reactivateTitle": "Reactivate project",
  "achievements.reactivateConfirm":
    'Restore "{name}" to "{status}" status and move it back to the project list.',
  "achievements.activate": "Activate",

  /* ---------- system achievements ---------- */
  "achievements.personal": "Personal Achievements",
  "achievements.system": "System Achievements",
  "achievements.systemSubtitle":
    "Built-in milestones along the way — no achievement points, just a record of how far you have come.",
  "achievements.unlockedCount": "{unlocked} / {total} unlocked",
  "achievements.unlockedOn": "unlocked {date}",
  "achievements.toastTitle": "Achievement unlocked",
  "achievements.toastClose": "Dismiss",
  "achievements.cat.start": "Getting Started",
  "achievements.cat.milestone": "Milestones",
  "achievements.cat.habit": "Habits",
  "achievements.cat.depth": "Deep Cuts",
  "achievements.progress.count": "{current} / {target} total",
  "achievements.progress.hours": "{current} / {target} hours",
  "achievements.progress.days": "streak {current} / {target} days",
  "achievements.progress.score": "best day {current} / {target} pts",
  "achievements.progress.reviews": "{current} / {target} reviews",
  "achievements.progress.binary": "Keep going to unlock this one.",
  "achievements.sys.first_task.name": "First Step",
  "achievements.sys.first_task.desc": "Complete your first task.",
  "achievements.sys.ten_tasks.name": "Warming Up",
  "achievements.sys.ten_tasks.desc": "Complete 10 tasks in total.",
  "achievements.sys.one_hour.name": "One Hour",
  "achievements.sys.one_hour.desc": "Record 1 hour of completed work.",
  "achievements.sys.first_critical.name": "Critical Hit",
  "achievements.sys.first_critical.desc": "Complete your first Critical task.",
  "achievements.sys.first_live.name": "Going Live",
  "achievements.sys.first_live.desc": "Take your first project live.",
  "achievements.sys.first_review.name": "First Retrospect",
  "achievements.sys.first_review.desc": "Generate your first AI retrospective.",
  "achievements.sys.streak_3.name": "Three-Day Streak",
  "achievements.sys.streak_3.desc":
    "Complete at least one task a day for 3 consecutive days.",
  "achievements.sys.fifty_tasks.name": "Getting Somewhere",
  "achievements.sys.fifty_tasks.desc": "Complete 50 tasks in total.",
  "achievements.sys.hundred_tasks.name": "Centurion",
  "achievements.sys.hundred_tasks.desc": "Complete 100 tasks in total.",
  "achievements.sys.ten_hours.name": "Ten Hours Club",
  "achievements.sys.ten_hours.desc": "Record 10 hours of completed work.",
  "achievements.sys.fifty_hours.name": "Half-Century Hours",
  "achievements.sys.fifty_hours.desc": "Record 50 hours of completed work.",
  "achievements.sys.hundred_hours.name": "Hundred Hours",
  "achievements.sys.hundred_hours.desc": "Record 100 hours of completed work.",
  "achievements.sys.ten_reviews.name": "Retrospect Pro",
  "achievements.sys.ten_reviews.desc": "Generate 10 AI retrospectives.",
  "achievements.sys.fifty_reviews.name": "Fifty Retrospects",
  "achievements.sys.fifty_reviews.desc": "Generate 50 AI retrospectives.",
  "achievements.sys.fifty_important.name": "Backbone",
  "achievements.sys.fifty_important.desc":
    "Complete 50 Important or Critical tasks.",
  "achievements.sys.five_live.name": "Serial Launcher",
  "achievements.sys.five_live.desc": "Take 5 projects live.",
  "achievements.sys.first_core.name": "Core Focus",
  "achievements.sys.first_core.desc": "Mark your first core project.",
  "achievements.sys.streak_5.name": "Five-Day Streak",
  "achievements.sys.streak_5.desc":
    "Complete at least one task a day for 5 consecutive days.",
  "achievements.sys.day_480.name": "Eight-Hour Day",
  "achievements.sys.day_480.desc": "Reach 480 points (8 hours) in a single day.",
  "achievements.sys.day_576.name": "Extra Mile",
  "achievements.sys.day_576.desc": "Reach 576 points in a single day.",
  "achievements.sys.day_720.name": "Twelve-Hour Day",
  "achievements.sys.day_720.desc": "Reach 720 points (12 hours) in a single day.",
  "achievements.sys.day_960.name": "Marathon Day",
  "achievements.sys.day_960.desc": "Reach 960 points (16 hours) in a single day.",
  "achievements.sys.five_hundred_tasks.name": "Half-K Tasks",
  "achievements.sys.five_hundred_tasks.desc": "Complete 500 tasks in total.",
  "achievements.sys.thousand_tasks.name": "Task Master",
  "achievements.sys.thousand_tasks.desc": "Complete 1,000 tasks in total.",
  "achievements.sys.five_hundred_hours.name": "Half-K Hours",
  "achievements.sys.five_hundred_hours.desc": "Record 500 hours of completed work.",
  "achievements.sys.thousand_hours.name": "Thousand Hours",
  "achievements.sys.thousand_hours.desc": "Record 1,000 hours of completed work.",
  "achievements.sys.hundred_reviews.name": "Century of Retrospects",
  "achievements.sys.hundred_reviews.desc": "Generate 100 AI retrospectives.",

  /* ---------- launch date dialog ---------- */
  "launchDate.title": "Launch date",
  "launchDate.label": "Launch date (year-month-day)",
  "launchDate.hint": "The project may have actually gone live on a different day than today.",
  "launchDate.invalid": "Please pick a valid date.",

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
  "settings.deepseekTitle": "AI review",
  "settings.aiProvider": "AI provider",
  "settings.aiProviderHint":
    "Pick a preset to fill in the API address and default model (you can still edit them). Your API key stays on this device and is never included in exports.",
  "settings.aiPresetDeepseek": "DeepSeek",
  "settings.aiPresetOpenai": "OpenAI",
  "settings.aiPresetAnthropic": "Anthropic Claude",
  "settings.aiPresetGemini": "Google Gemini",
  "settings.aiPresetMistral": "Mistral AI",
  "settings.aiPresetOpenrouter": "OpenRouter",
  "settings.aiPresetGroq": "Groq",
  "settings.aiPresetOllama": "Ollama (local)",
  "settings.aiPresetCustom": "Custom (OpenAI-compatible)",
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

  /* ---------- profile (Pro) ---------- */
  "profile.title": "Profile",
  "profile.subtitle":
    "Your avatar and nickname stay on this device and travel with your encrypted backups — the server never sees them.",
  "profile.changeAvatar": "Change avatar",
  "profile.removeAvatar": "Remove avatar",
  "profile.nickname": "Nickname",
  "profile.nicknameHint": 'Defaults to the part of your email before "@". Clear the field to restore the default.',
  "profile.save": "Save",
  "profile.saved": "Saved",

  /* ---------- soul notes (Pro) ---------- */
  "soulNotes.title": "Soul Notes",
  "soulNotes.subtitle":
    "Write a few words to your future self. When enabled, they rotate under the DoneTrace logo in the sidebar.",
  "soulNotes.enable": "Rotate in sidebar",
  "soulNotes.enableHint":
    "Shows a random note at the chosen interval; the default tagline appears when off.",
  "soulNotes.interval": "Switch every",
  "soulNotes.interval30s": "30 seconds",
  "soulNotes.interval1m": "1 minute",
  "soulNotes.interval5m": "5 minutes",
  "soulNotes.interval30m": "30 minutes",
  "soulNotes.interval1h": "1 hour",
  "soulNotes.addPlaceholder": "Write a note to yourself…",
  "soulNotes.add": "Add",
  "soulNotes.edit": "Edit",
  "soulNotes.delete": "Delete",
  "soulNotes.save": "Save",
  "soulNotes.cancel": "Cancel",
  "soulNotes.limitHint":
    "Up to 60 character-widths (CJK characters count as 2); displays on at most 2 lines",
  "soulNotes.empty": "No notes yet. Add one to enable rotation.",
  "soulNotes.cannotEnable": "You need at least one note before you can enable it.",
  "soulNotes.loginRequired": "Sign in to use Soul Notes.",
  "soulNotes.defaultsNote":
    "Five starter notes were added the first time you opened this page — edit or delete them freely.",
  "soulNotes.confirmDeleteTitle": "Delete this note?",
  "soulNotes.confirmDeleteBody": "This cannot be undone.",
  "soulNotes.autoDisabled": "The last note was deleted, so rotation has been turned off automatically.",
  "soulNotes.saved": "Saved",

  /* ---------- official AI (Pro) ---------- */
  "aiOfficial.title": "Official AI",
  "aiOfficial.subtitle":
    "Use DoneTrace's official AI quota for reviews. Your own API key always takes priority; the official quota is the fallback.",
  "aiOfficial.useLabel": "Use DoneTrace official AI",
  "aiOfficial.useHint":
    "Off by default. When enabled, AI reviews prefer the official quota and automatically fall back to the API you configured in Settings when the quota runs out.",
  "aiOfficial.ownApiNote":
    "You have your own API key configured: with Official AI on, the official quota is used first and your key is the automatic fallback; with it off, your key is always used.",
  "aiOfficial.quotaTitle": "Today's quota",
  "aiOfficial.quotaRemaining": "{remaining} of {daily} calls left",
  "aiOfficial.quotaResetNote": "Quota resets daily at {time} (local time).",
  "aiOfficial.quotaExhausted":
    "Today's quota is used up: configure your own API in Settings, or wait for the reset.",
  "aiOfficial.quotaExhaustedWithApi":
    "Today's official quota is used up: AI reviews will automatically fall back to your own API.",
  "aiOfficial.quotaUnavailable": "Quota information is temporarily unavailable — try again later.",
  "aiOfficial.entitlementExpired":
    "Your trial or Pro license is inactive or expired, so the official quota is unavailable.",
  "aiOfficial.serviceUnavailable": "The official AI service is not available yet.",
  "aiOfficial.proxyNote":
    "Review content is proxied through DoneTrace's server (never stored or logged); daily limits apply.",
  "aiOfficial.loginRequired": "Sign in to your Pro account to use official AI.",

  /* ---------- AI personalization (Pro) ---------- */
  "aiPersonalization.title": "Personalized Reviews",
  "aiPersonalization.subtitle":
    "Tailor AI reviews to your role, preferences and goals — computed on-device, the server never touches your profile.",
  "aiPersonalization.loginRequired": "Sign in to your Pro account to use personalized reviews.",
  "aiPersonalization.enabled": "Enable personalized reviews",
  "aiPersonalization.enabledHint":
    "Off by default. When off, review output is identical to the standard edition.",
  "aiPersonalization.role": "Role",
  "aiPersonalization.rolePlaceholder": "e.g. Indie developer shipping an overseas SaaS",
  "aiPersonalization.roleHint":
    "One line about yourself; reviews will be written from that perspective. (optional)",
  "aiPersonalization.goals": "Current goals",
  "aiPersonalization.goalsPlaceholder":
    "One per line, up to 3, each within 60 characters — keep goals focused and concise",
  "aiPersonalization.goalsHint":
    "Period reviews will include a \"Goals check-in\" section. (optional)",
  "aiPersonalization.tone": "Tone",
  "aiPersonalization.tone.encouraging": "Encouraging",
  "aiPersonalization.tone.direct": "Direct",
  "aiPersonalization.tone.concise": "Concise",
  "aiPersonalization.focus": "Review focus",
  "aiPersonalization.focus.efficiency": "Efficiency",
  "aiPersonalization.focus.quality": "Quality",
  "aiPersonalization.focus.learning": "Learning & growth",
  "aiPersonalization.focus.balance": "Work-life balance",
  "aiPersonalization.temperature": "Creativity",
  "aiPersonalization.temperatureHint":
    "Lower is more stable, higher is more creative; the free edition is fixed at 0.7.",
  "aiPersonalization.save": "Save",
  "aiPersonalization.saved": "Saved",
  "aiOfficial.saved": "Saved",
} as const;
