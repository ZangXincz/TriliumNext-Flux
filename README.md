# TriliumNext Flux

> Personal daily project & task manager · TriliumNext plugin

> **[简体中文](./README.zh.md) | English**

## Overview

Turn "achieving goals through projects" into a task panel you can see and complete every day, right inside your Trilium notes.

- **Project-driven**: In-progress / on-hold / cycling-phase projects are grouped and displayed with progress at a glance
- **Today first**: Overdue & today, future tasks and inbox are automatically categorized
- **Habit support**: Weekly check-ins and interval timer reminders keep you on your execution rhythm

| | |
|---|---|
| Data ownership | Everything is stored in Trilium notes — no external storage, no third-party services |
| Zero dependencies | Pure frontend implementation, no third-party libraries |
| Bilingual | One-click language switch (Chinese / English) |
| Flexible config | Each feature can be toggled; fixed tags with built-in # quick insert |
| Fixed sort | `#priority` tags pin the order of tasks / check-ins / timers (1-10) |
| Lightweight | Auto-refresh every 30 seconds without extra overhead |

## Preview

![TriliumNext Flux panel preview](./docs/screenshoten.png)

## Installation

### Prerequisites

- **TriliumNext** installed (version 0.105.0 or above; older versions may also work but have not been tested)
- Download the latest plugin zip from the [Releases page](https://github.com/ZangXincz/TriliumNext-Flux/releases)

### Import steps

1. If backend script execution has not been enabled before, enable it under `Settings` → `Security`

2. **Import the plugin zip**: right-click the Trilium root directory → Import into note → select the zip file → uncheck "Safe import"
   ![alt text](./docs/importzipen.png)

   After import
   ![alt text](./docs/importgraphic.png)

3. Create a Home note with type `Render`, set attributes `~renderNote=TriliumNext Flux` and `~configNote=config`, save and press F5 to refresh
   ![alt text](./docs/HomeNoteTypeen.png)

That's it — tweak the basics and view the usage guide in settings afterwards
![alt text](./docs/seten.png)

## Usage

The plugin collects checkbox tasks from your notes and groups them in the panel. All tags are `#markers` written in the task text.

### Panel overview

| Group | Content |
|---|---|
| Overdue & Today | Tasks due today or already overdue |
| In-Progress Projects | Project cards with `state=In-Progress` |
| On Hold / Awaiting Response | Project cards with `state=On-Hold` |
| Cycling-Phase Projects | Project cards with `state=Cycling-Phase` |
| Inbox | Tasks inside inbox notes and their subtrees |
| Future Tasks | Tasks marked with a future date |
| Check-in | Check-in cards with `#habit` tags |
| Interval Timer Reminder | Timer cards with `#timer` tags |

### Tags at a glance

| Tag | Purpose | Example |
|---|---|---|
| `#2026-08-28` | Due date: today/overdue → "Overdue & Today"; future → "Future Tasks" | `- [ ] Submit expenses #2026-08-28` |
| `#repeat:1w` | Recurring tasks (`d`/`w`/`m`/`y`, optional `:start` / `:end` / `:endwork` / `:actual`) | `- [ ] Weekly report #repeat:1w` |
| `#habit:5` | Weekly check-in: target N days/week, optional `:M` times per day | `- [ ] Early rising #habit:5` |
| `#timer:50:10` | Interval timer: work/rest minutes, optional custom phase labels | `- [ ] Deep work #timer:50:10` |
| `#priority:1` | Fixed sort: 1-10, lower = first (date first, then priority within the same date) | `- [ ] Review #2026-08-28 #priority:1` |
| `state=In-Progress` | Note attribute → project card (also `On-Hold` / `Cycling-Phase`) | `state=In-Progress` |
| `#priority=P1` | Note attribute → project card sort (P1 highest) | `#priority=P1` |

> **Inbox** is detected by note title (default `inbox` / `收集箱`), not a tag — tasks in its entire subtree form the "Inbox" group.
>
> Detailed rules and advanced usage for every tag live in **Settings → usage guide at the bottom of each tab**; typing `#` in task text also pops up live candidate hints.

### Quick insert (#)

Type `#` in task text to complete tags fast — `↑` `↓` to select, `Enter`/`Tab` to insert, or click. Can be turned off under Settings → General.

### Settings

Click **⚙️ Settings** in the panel's bottom-left corner. 5 tabs, each with a `#tag` usage guide at the bottom:

| Tab | Options |
|---|---|
| General | Language (中文 / English), enable/disable plugin, quick insert toggle, version info, GitHub repo |
| Tasks | Toggles: Overdue & Today / Future Tasks / Inbox; inbox titles (comma-separated) |
| Projects | Toggles: project groups; project root (comma-separated, empty = scan all notes) |
| Check-in | Check-in feature toggle (tag fixed to `#habit`) |
| Reminder | Reminder toggle; default rest minutes; notification methods (toast / fullscreen / sound, multiple) |

Settings are saved to the config note pointed to by the `~configNote` relation (`json` or `code` type). **Save** only updates changed fields; **Reset to default** writes back the full default config.

### FAQ

**Q1: The panel warns "Config note not found"?**
Add the `configNote` relation on the host note, pointing to a `json` or `code` note, then save and press F5. Without it the plugin runs on built-in defaults, but settings cannot be saved.

**Q2: Clicking a task checkbox does nothing?**
Enable backend script execution (Settings → Security) and make sure the plugin runs as a Render note (via the `~renderNote` relation).

**Q3: My timer is gone after refreshing?**
Timer state is stored in the `txState` field of the config note; without a config note it cannot persist.

**Q4: What do the numbers on the check-in cells mean?**
With `#habit:4:2`, at most 2 per day. `1/2` = 1 of today's 2 done; once full, clicking again resets it.

**Q5: Why do repeating tasks gain extra history sub-tasks?**
Those are auto-written completion records (with dates). Regular tasks without a repeat tag don't generate history.

## License

This project is open-sourced under the [MIT License](./LICENSE). You are free to use, modify and distribute it, provided you retain the copyright notice.
