---
name: ploten-power-bi
description: Use when the user wants Claude to build or change report pages, visuals, measures or themes in a Power BI report that is open in Power BI Desktop. Tells Claude how to check that Ploten is installed and, when it is not, which steps the user does to install it.
---

# Ploten for Power BI Desktop

Ploten is an MCP server that lets Claude Code edit the Power BI report the user has open in Power BI Desktop. The changes appear on the canvas while Desktop stays open, so the user does not save, close or reload the report. Ploten runs on the user's Windows PC, next to Power BI Desktop.

This plugin holds no program. Ploten is a paid program. It is free to try for 14 days. The user installs it from ploten.dev.

## Step 1: check for the Ploten tools

Look at the tools in this session. In Claude Code, MCP tools show with a server prefix. If tools whose names end with `pbi_live_inspect` and `pbi_live_edit_page` are there, Ploten is installed: use those tools for the user's request and follow the guidance they return. This skill has nothing more to add.

If they are not there, go to step 2.

## Step 2: check what Ploten needs

Ploten needs all of these. Ask the user only about the items you cannot see yourself:

- Windows 10 or 11, in English.
- Power BI Desktop, June 2026 release or later, in English. Other languages are not tested yet.
- Node.js 22 or later.
- The report saved as a Power BI project (a `.pbip` file). A `.pbix` report is saved as a project first, in Power BI Desktop.
- An administrator on the PC, one time, for a Power BI setting. The install asks for it. With no administrator, the route is the notes for IT: https://ploten.dev/it-note

If one is missing, tell the user which one, and stop there.

## Step 3: give the user the install steps

The user must close every Claude Code window, this one too, before the install line runs. So give ALL the steps in one answer, and tell the user to keep them, or the install guide page, open.

Give them as a short numbered list:

1. Start the 14-day free trial at https://ploten.dev. The install line, with the user's own key in it, shows on the page after checkout and in the key email.
2. Close every Claude Code window, this one too. If the Claude desktop app is open, the install asks before it closes it.
3. Run the install line in PowerShell, as the install guide says: https://ploten.dev/docs/install. Answer its questions.
4. Restart Power BI Desktop. Open the report's `.pbip` file, and start Claude Code in the folder that holds it.
5. In Claude Code, type `/mcp` and look for `ploten` in the list.

The install line holds the user's licence key. Do not ask the user to paste the line or the key into the chat, and do not run the line for them.

## What not to say

- Do not state a price. Say "free to try for 14 days".
- Do not say Ploten works on macOS or with Power BI Service in the browser. It works with Power BI Desktop on Windows.
- Do not call Ploten open source. The MIT licence covers this plugin's own files only.
- Do not promise a feature that the installed tools do not show. After the install, the tools describe what they can do.
