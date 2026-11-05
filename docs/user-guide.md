# DoneTrace User Guide

DoneTrace is a **local-first achievement tracker** for knowledge workers. It helps you record what
you complete, see how far you've come, and review your work periodically — including the time you
spent on things that produced no direct output, because that time counts too.

Everything is stored on your device. No account, no cloud, no tracking. Exports are yours.

## 1. Core concepts

### Score = time estimate

A task's **score** is your estimate of the focused effort it took (or will take):

- **1 point ≈ 1 minute** of focused work.
- Work hours are derived from scores: **8 h = 480 points per day, 40 h = 2,400 points per week**.
- Displays like "2d 3h 5min" are conversions of accumulated scores.

### Value tiers

Every task carries a **value tier** that weights its score:

| Tier | Multiplier | Meaning |
|---|---|---|
| Normal | ×1.0 | routine work |
| Important | ×1.5 | clearly matters |
| Critical | ×2.0 | milestone, make-or-break |

**Actual score = score × value multiplier.** All statistics, work-hour displays, and AI reviews
use the actual score.

### Only completed tasks count

Tasks are statistics-ready only after you complete them. All date-based analysis uses the
**completion time**, so complete a task on the day it actually happened.

### Periods

- Views: **Today / Yesterday / This week / Last week**.
- Weeks start on **Monday** and use your device's local time zone.

## 2. Tasks

- **Add a task**: name, project, value tier, score, optional description.
- **Complete / undo** with one click (undo exists to guard against mis-clicks).
- **Edit** and **delete** anytime.
- Filter by **today** or **this week**; the completed section shows accumulated work hours.

### Recording revenue as a task

Revenue is the outcome of work you completed — record the **achievement**, not the accounting.
Create a task for each meaningful event ("First payment received", "October payout arrived") and
score it by **reverse projection**:

> **Actual score (points) = Revenue ÷ hourly rate × 60**
>
> In words: ask "for how long could this revenue hire one skilled person?" — convert that time to
> minutes. Points are minutes, so this is the same "score = time estimate" principle, applied to
> money through the market price of skilled labor.

Because the app multiplies your entered score by the value tier, enter:

> **Score to enter = Actual score ÷ value multiplier** (normal ×1.0, important ×1.5, critical ×2.0)

#### Worked examples

| Event | Revenue | Reference rate | Tier | Skilled time it buys | Actual score | Score to enter |
|---|---|---|---|---|---|---|
| First payment | $100 | $50/h | Critical | 2 h | 120 | **60** |
| Client contract payout | $1,200 | $60/h | Normal | 20 h | 1,200 | **1,200** |
| Monthly revenue milestone | $2,400 | $60/h | Important | 40 h | 2,400 | **1,600** |

Reading it back: a 600-point revenue task ≈ 10 hours of skilled labor ≈ what $600 buys at $60/h.
A 2,400-point task equals one standard 40-hour week — the weekly standard used in Analysis.

#### Guidelines

1. **Pick one reference rate** — what a skilled person costs per hour in your market — and keep it
   consistent. It is your personal "money ↔ time" exchange rate.
2. **Record milestones, not line items.** One task per meaningful event, completed on the day it
   happened. Routine payouts → Normal; firsts and major milestones → Important or Critical (and
   divide the entered score by the multiplier as shown above).
3. **Use the description** for context (product, source, client) — it stays local and feeds your
   AI retrospectives.
4. Revenue tasks flow into Analysis and retrospectives like any other task; their work hours read
   as "skilled-labor equivalent", which keeps the 8 h/day convention honest.

## 3. Projects

- **Create / edit** projects with a name, optional description, and an icon (emoji, or upload and
  crop an image).
- **Manual ordering**, and one **core project** (globally unique, pinned to the top).
- **Lifecycle**: **In progress ⇄ Launched → Archived**.
  - **Launch** a project when it goes live — you pick the launch date (defaults to today) and can
    edit it later from the project's detail page. Launched projects still accept maintenance tasks.
  - **Archive** a finished project: it becomes read-only and folds into a section at the bottom of
    the Projects page, where it can be reactivated back to its pre-archive status.
  - Un-launching a launched project moves it back to in-progress and clears the launch date.

## 4. Analysis

Four period views — **Today's analysis, Yesterday's review, This week's analysis, Last week's
review** — each showing:

- tasks completed in the period,
- accumulated work hours (from actual scores),
- completion percentage against the standard (8 h/day, 40 h/week),
- for weekly views: a bar chart and detail table **by project**.

**AI Analysis** per period: sends the period's completed tasks to your AI provider and saves the
result (Markdown). Re-running **overwrites** the previous result. Empty periods cannot be analyzed.

## 5. Achievements

The Achievements page showcases your **launched projects** — launch date and days live — as the
milestones they are.

## 6. AI retrospective

DoneTrace is **BYOK**: you bring your own AI provider and key.

- **Provider presets** fill in the API address and default model in one click: **DeepSeek, OpenAI,
  Anthropic Claude (native API), Google Gemini, Mistral AI, OpenRouter, Groq, Ollama (local)** —
  or **Custom** for any OpenAI-compatible endpoint. You can still edit the address and model.
- Your API key is stored **on this device only**; it can be written but never read back or included
  in exports.
- Retrospectives reply in your **interface language**, order tasks by **completion time**, and use
  the **1 day = 8 hours** convention when interpreting work hours.

## 7. Settings & data

- **Language**: follow system, English, or 简体中文 (applies immediately).
- **Color mode**: light / dark (persists across restarts).
- **Data management**:
  - **Export** your data as a zip (projects, tasks, analysis reports, logs — never your API key).
  - **Import** a backup zip (preview before applying).
  - **Clear all** data (your API configuration is kept).
- On Windows, data lives in `%APPDATA%\DoneTrace`. Export a backup weekly — it is your data.

## 8. Quick reference

| 60 points | 1 hour |
|---|---|
| 480 points | 1 working day (8 h standard) |
| 2,400 points | 1 standard week (40 h) |

| Value tier | Multiplier |
|---|---|
| Normal | ×1.0 |
| Important | ×1.5 |
| Critical | ×2.0 |

| Revenue task | Formula |
|---|---|
| Actual score | revenue ÷ hourly rate × 60 |
| Score to enter | actual score ÷ value multiplier |
