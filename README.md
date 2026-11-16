# Ploten: live report MCP for Power BI Desktop

Claude Code or Codex edits the Power BI report you have open in Desktop.

Ploten works in the report you have open, unlike file-based agents that edit the project files and wait for Desktop to reload them. You ask, and the change happens live on the canvas. Your unsaved work stays. Change something by hand, then ask your agent for the next step. You and your agent work in the same report.

## What your agent can do with Ploten

- Build a page from one sentence. Your agent reads your model, so you paste no table names.
- Write a DAX measure, check it, then build the visual that uses it.
- Add a date table with month, quarter and year to date measures.
- Style every new visual from a design system you can change. Ask for blue-9 and you get that exact shade.
- Switch Ploten's light and dark themes in one ask.
- Group visuals into a card, sync a slicer to another page, and add bookmarks with buttons.

Ploten runs on your PC, next to Power BI Desktop. It sends no report content, data or model to Ploten. Microsoft's Power BI Authoring MCP Server makes the model changes, and Ploten's installer can set it up.

Needs Windows 10 or 11, Power BI Desktop (June 2026 or later), Node.js 22 or later, a report saved as a Power BI project (PBIP), and Claude Code or Codex. Free to try for 14 days.

Website: https://ploten.dev

## What this repository is

This repository holds a launcher of about 140 lines, not Ploten itself. Ploten is a separate, paid program. Its installer puts it on your PC, in `%LOCALAPPDATA%\Ploten`.

The launcher is [`bin/start.mjs`](bin/start.mjs). When your agent starts it, it does one of three things:

1. Ploten is not installed. The launcher answers your agent with one line: "Ploten is not installed on this PC. Install it from https://ploten.dev/install, then restart your agent." It gives one tool that returns the same line.
2. Ploten is installed. The launcher starts `%LOCALAPPDATA%\Ploten\launcher\ploten-mcp.mjs` with the same Node, with no shell, and passes stdin and stdout through. That file is the installer's own launcher. It starts the Ploten version that the installer set.
3. Claude Code already starts Ploten from the installer's own entry `ploten`. The launcher then gives no tools, so your agent does not see each Power BI tool twice.

The launcher has no dependencies and no install script. It reads no licence key, downloads nothing and writes no file. It reads two places only: the Ploten folder, to see if the launcher file is there, and Claude Code's settings file (`.claude.json`, or the older `.config.json` when that file has text), to see if the entry `ploten` is there.

The launcher sets one value for the program that it starts: `PBI_COMPANION_MODEL_ADAPTER=1`, which turns on changes to the data model (as the installer's own entry does). It sets it only when your environment does not set it. If you installed Ploten with `--no-model-writes`, set the Windows user variable `PBI_COMPANION_MODEL_ADAPTER` to `0` and restart your agent: Ploten makes model changes only when the value is `1`.

## Install

1. Start the free trial at [ploten.dev](https://ploten.dev). The install line with your key is on the page after checkout and in the key email.
2. Follow the [install guide](https://ploten.dev/docs/install): run the install line in PowerShell, answer its questions, then restart Power BI Desktop and your agent. The installer adds Ploten to Claude Code and Codex. It also asks to turn on the Power BI setting.
3. Open your report's .pbip file in Power BI Desktop, and start your agent in the folder that holds it.

After step 2 you do not need this plugin. Add it if you found Ploten here and want your agent to show the install step, or if your team adds plugins from a marketplace.

### Claude Code

```
/plugin marketplace add ploten-team/ploten-powerbi
/plugin install ploten@ploten
```

### Codex

```
codex plugin marketplace add ploten-team/ploten-powerbi
codex plugin add ploten@ploten
```

In Codex, the installer's own entry `ploten` comes first, so Codex starts Ploten once.

### npm

The entry in the official MCP Registry points at the npm package [`@ploten/ploten-powerbi`](https://www.npmjs.com/package/@ploten/ploten-powerbi). It holds the same launcher and nothing else.

## For reviewers

The whole path: a 14-day trial key from ploten.dev, the install line on a Windows PC with Power BI Desktop, a restart, then a request to the agent in the folder of a .pbip report. The launcher in this repository starts the installed program. It never holds that program.

## Licence

The launcher in this repository: MIT, see [LICENSE](LICENSE). Ploten itself is not open source. Its terms: https://ploten.dev/terms

Contact: hello@ploten.dev
