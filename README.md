# Ploten: live report MCP for Power BI Desktop

Claude Code or Codex edits the Power BI report you have open in Desktop. Your unsaved work stays.

Ploten is the live report MCP for Power BI Desktop. It connects Claude Code or Codex to the report you have open. You ask, and the canvas updates.

- Builds and edits report pages in the open report, with no save-and-reload loop. Your unsaved work stays.
- Writes the DAX measure, then the visual that uses it.
- Styles every new visual from one design system you can change.

Needs Windows 10 or 11, Power BI Desktop (June 2026 or later), Node.js 22 or later, a report saved as a Power BI project (PBIP), and Claude Code or Codex. Free for 14 days. Then $19 a month. (The trial asks for a card.)

Website: https://ploten.dev

## What this repository is

This repository holds a launcher of about 140 lines, not Ploten itself. Ploten is a separate, paid program. Its installer puts it on your PC, in `%LOCALAPPDATA%\Ploten`.

The launcher is [`bin/start.mjs`](bin/start.mjs). When your agent starts it, it does one of three things:

1. Ploten is not installed. The launcher answers your agent with one line: "Ploten is not installed on this PC. Install it from https://ploten.dev/install, then restart your agent." It gives one tool that returns the same line.
2. Ploten is installed. The launcher starts `%LOCALAPPDATA%\Ploten\launcher\ploten-mcp.mjs` with the same Node, with no shell, and passes stdin and stdout through. That file is the installer's own launcher. It starts the Ploten version that the installer set.
3. Claude Code already starts Ploten from the installer's own entry `ploten`. The launcher then gives no tools, so your agent does not see each Power BI tool twice.

The launcher has no dependencies and no install script. It reads no licence key, downloads nothing and writes no file. It reads two places only: the Ploten folder, to see if the launcher file is there, and Claude Code's settings file (`.claude.json`), to see if the entry `ploten` is there.

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
