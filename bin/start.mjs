#!/usr/bin/env node
// Ploten launcher for Power BI Desktop.
//
// This file holds no Ploten program code. Ploten itself is a separate, paid program that its installer puts on this
// PC (https://ploten.dev/install). This file does one of three things:
//   1. Ploten is not installed: it answers the agent as a small MCP server with one line that names the install page.
//   2. Claude Code already starts Ploten from the installer's own entry "ploten": it answers with no tools and one
//      line, so the agent does not get every Power BI tool twice.
//   3. Else it starts the installed Ploten launcher with this same Node, with no shell, and passes stdin, stdout and
//      stderr through.
// It reads no licence key, downloads nothing and writes no file.

import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "1.0.0";
const SERVER_NAME = "ploten";
const NOT_INSTALLED =
  "Ploten is not installed on this PC. Install it from https://ploten.dev/install, then restart your agent.";
const ALREADY_RUNS =
  'Ploten already runs from its installed entry "ploten" in Claude Code, so this plugin copy is off and has no tools.';

// The Ploten folder, by the installer's own rule: PLOTEN_LOCAL_STATE_DIR when set; on Windows %LOCALAPPDATA%\Ploten
// (a value that is not a full path counts as missing); elsewhere ~/.ploten.
function plotenFolder(env) {
  const named = env.PLOTEN_LOCAL_STATE_DIR?.trim();
  if (named) return path.resolve(named);
  const home = os.homedir();
  if (process.platform === "win32") {
    const local = env.LOCALAPPDATA?.trim() ?? "";
    const startsWithDrive = /^[a-z]:[\\/]/iu.test(local);
    const startsWithShare = local.startsWith("\\\\") || local.startsWith("//");
    if (startsWithDrive || startsWithShare) return path.join(local, "Ploten");
    return home ? path.join(home, "AppData", "Local", "Ploten") : null;
  }
  return home ? path.join(home, ".ploten") : null;
}

// Claude Code sets CLAUDE_PLUGIN_ROOT for a plugin's server. The installer adds its entry at user scope, which
// Claude Code keeps under the top-level "mcpServers" of its settings file: .claude.json in CLAUDE_CONFIG_DIR or the
// home folder, or an older .config.json (in CLAUDE_CONFIG_DIR or ~/.claude) when that file has text.
function claudeCodeSettingsFile(env) {
  const configDir = env.CLAUDE_CONFIG_DIR;
  const home = os.homedir();
  const older = path.join(configDir || path.join(home, ".claude"), ".config.json");
  try {
    if (statSync(older).size > 0) return older;
  } catch {
    // No older file.
  }
  return path.join(configDir || home, ".claude.json");
}

function claudeCodeHasInstalledEntry(env) {
  if (!env.CLAUDE_PLUGIN_ROOT) return false;
  try {
    const text = readFileSync(claudeCodeSettingsFile(env), "utf8").replace(/^\uFEFF/u, "");
    const servers = JSON.parse(text)?.mcpServers;
    return typeof servers === "object" && servers !== null && Object.hasOwn(servers, SERVER_NAME);
  } catch {
    return false;
  }
}

// A small MCP server (JSON-RPC, one message per line on stdin and stdout) that gives the agent one line.
function answerWithLine(line, tools) {
  const send = (message) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
  const answer = (text) => {
    let request;
    try {
      request = JSON.parse(text);
    } catch {
      send({ id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    if (request === null || typeof request !== "object" || request.id === undefined) return;
    const { id, method, params } = request;
    if (method === "initialize") {
      const protocolVersion = typeof params?.protocolVersion === "string" ? params.protocolVersion : "2025-06-18";
      send({
        id,
        result: {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: VERSION },
          instructions: line,
        },
      });
    } else if (method === "ping") {
      send({ id, result: {} });
    } else if (method === "tools/list") {
      send({ id, result: { tools } });
    } else if (method === "tools/call") {
      send({ id, result: { content: [{ type: "text", text: line }], isError: true } });
    } else {
      send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  };
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let end = buffer.indexOf("\n");
    while (end !== -1) {
      const text = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (text) answer(text);
      end = buffer.indexOf("\n");
    }
  });
  process.stdin.on("end", () => process.exit(0));
}

const env = process.env;
const folder = plotenFolder(env);
const launcher = folder ? path.join(folder, "launcher", "ploten-mcp.mjs") : null;

if (!launcher || !existsSync(launcher)) {
  answerWithLine(NOT_INSTALLED, [
    {
      name: "ploten_install_help",
      description: `${NOT_INSTALLED} Call this tool when the user asks for Power BI report work, and give the user this line.`,
      inputSchema: { type: "object", properties: {} },
    },
  ]);
} else if (claudeCodeHasInstalledEntry(env)) {
  answerWithLine(ALREADY_RUNS, []);
} else {
  // Model writes are on by default, as in the installer's own entry. An entry that sets the value keeps its value.
  const childEnv = { ...env, PBI_COMPANION_MODEL_ADAPTER: env.PBI_COMPANION_MODEL_ADAPTER ?? "1" };
  const child = spawn(process.execPath, [launcher], { stdio: "inherit", shell: false, windowsHide: true, env: childEnv });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
  child.on("error", (error) => {
    process.stderr.write(`Ploten could not start: ${error.message}\n`);
    process.exit(1);
  });
  child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}
