// Cells for bin/start.mjs. Run: node --test test/start.test.mjs
// Each cell starts the launcher as a child with a made-up home folder, so no cell reads this computer's own
// Ploten folder or Claude Code settings.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const shim = path.join(root, "bin", "start.mjs");
const source = readFileSync(shim, "utf8").replace(/\r\n/gu, "\n");
const readJson = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));

const NOT_INSTALLED =
  "Ploten is not installed on this PC. Install it from https://ploten.dev/install, then restart your agent.";
const ALREADY_RUNS =
  'Ploten already runs from its installed entry "ploten" in Claude Code, so this plugin copy is off and has no tools.';

function tempFolder() {
  return mkdtempSync(path.join(os.tmpdir(), "ploten-launcher-cell-"));
}

// A Ploten folder with a fake launcher. The fake echoes its first stdin line and two env values, writes a mark file,
// and exits with code 7.
function fakeInstall(folder = tempFolder()) {
  mkdirSync(path.join(folder, "launcher"), { recursive: true });
  const mark = path.join(folder, "started.mark");
  writeFileSync(
    path.join(folder, "launcher", "ploten-mcp.mjs"),
    [
      'import { writeFileSync } from "node:fs";',
      `writeFileSync(${JSON.stringify(mark)}, "started");`,
      'let text = "";',
      'process.stdin.setEncoding("utf8");',
      'process.stdin.on("data", (chunk) => { text += chunk; });',
      'process.stdin.on("end", () => {',
      '  process.stdout.write(JSON.stringify({ echo: text.trim(), adapter: process.env.PBI_COMPANION_MODEL_ADAPTER ?? null }) + "\\n");',
      "  process.exit(7);",
      "});",
    ].join("\n"),
  );
  return { folder, mark };
}

function claudeSettings(servers) {
  const folder = tempFolder();
  writeFileSync(path.join(folder, ".claude.json"), JSON.stringify({ numStartups: 3, mcpServers: servers }));
  return folder;
}

// Starts the launcher, writes the lines to its stdin, closes stdin, and returns the exit code and stdout lines.
function run(env, lines) {
  return new Promise((resolve, reject) => {
    const home = tempFolder();
    const child = spawn(process.execPath, [shim], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: home, USERPROFILE: home, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code, err, lines: out.split("\n").filter(Boolean).map((line) => JSON.parse(line)) }));
    for (const line of lines) child.stdin.write(`${typeof line === "string" ? line : JSON.stringify(line)}\n`);
    child.stdin.end();
  });
}

const initialize = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "cell", version: "0" } } };
const initialized = { jsonrpc: "2.0", method: "notifications/initialized" };
const list = { jsonrpc: "2.0", id: 2, method: "tools/list" };
const call = { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "ploten_install_help", arguments: {} } };

test("1. installed: hands over to the installed launcher, passes stdin and stdout, keeps its exit code", async () => {
  const { folder, mark } = fakeInstall();
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder }, ["hello from the agent"]);
  assert.equal(result.code, 7);
  assert.deepEqual(result.lines, [{ echo: "hello from the agent", adapter: "1" }]);
  assert.ok(existsSync(mark));
});

test("1b. installed: an entry that sets the model value keeps its value", async () => {
  const { folder } = fakeInstall();
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, PBI_COMPANION_MODEL_ADAPTER: "0" }, ["x"]);
  assert.deepEqual(result.lines, [{ echo: "x", adapter: "0" }]);
});

test("1c. installed, Claude Code plugin, no installed entry in Claude Code: hands over", async () => {
  const { folder, mark } = fakeInstall();
  const settings = claudeSettings({ other: { command: "node", args: [] } });
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, CLAUDE_PLUGIN_ROOT: root, CLAUDE_CONFIG_DIR: settings }, ["y"]);
  assert.equal(result.code, 7);
  assert.ok(existsSync(mark));
});

test("1d. installed, not Claude Code (Codex), an installed Claude Code entry exists: hands over", async () => {
  const { folder, mark } = fakeInstall();
  const settings = claudeSettings({ ploten: { command: "node", args: ["x"] } });
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, CLAUDE_CONFIG_DIR: settings }, ["z"]);
  assert.equal(result.code, 7);
  assert.ok(existsSync(mark));
});

test("2. not installed: answers with the install line, one tool, and ends when stdin ends", async () => {
  const empty = tempFolder();
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: empty }, [initialize, initialized, list, call, "not json"]);
  assert.equal(result.code, 0);
  const [init, tools, called, parseError] = result.lines;
  assert.equal(result.lines.length, 4);
  assert.equal(init.id, 1);
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.equal(init.result.serverInfo.name, "ploten");
  assert.equal(init.result.instructions, NOT_INSTALLED);
  assert.deepEqual(tools.result.tools.map((tool) => tool.name), ["ploten_install_help"]);
  assert.ok(tools.result.tools[0].description.startsWith(NOT_INSTALLED));
  assert.deepEqual(called.result, { content: [{ type: "text", text: NOT_INSTALLED }], isError: true });
  assert.equal(parseError.error.code, -32700);
});

test("2b. not installed, no Ploten folder variable: uses the home folder rule and still answers the line", async () => {
  const result = await run({}, [initialize]);
  assert.equal(result.lines[0].result.instructions, NOT_INSTALLED);
});

test("3. two entries in Claude Code: no tools, the 'already runs' line, the installed launcher is not started", async () => {
  const { folder, mark } = fakeInstall();
  const settings = claudeSettings({ ploten: { command: "node", args: ["C:/x/launcher/ploten-mcp.mjs"] } });
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, CLAUDE_PLUGIN_ROOT: root, CLAUDE_CONFIG_DIR: settings }, [initialize, list, call]);
  assert.equal(result.code, 0);
  const [init, tools, called] = result.lines;
  assert.equal(init.result.instructions, ALREADY_RUNS);
  assert.deepEqual(tools.result.tools, []);
  assert.equal(called.result.content[0].text, ALREADY_RUNS);
  assert.equal(existsSync(mark), false);
});

test("3b. Claude Code settings file that is not JSON: hands over (never leaves the user with no Ploten)", async () => {
  const { folder, mark } = fakeInstall();
  const settings = tempFolder();
  writeFileSync(path.join(settings, ".claude.json"), "{ not json");
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, CLAUDE_PLUGIN_ROOT: root, CLAUDE_CONFIG_DIR: settings }, ["w"]);
  assert.equal(result.code, 7);
  assert.ok(existsSync(mark));
});

test("3c. two entries, Claude Code settings file starts with a byte order mark: still off", async () => {
  const { folder, mark } = fakeInstall();
  const settings = tempFolder();
  writeFileSync(path.join(settings, ".claude.json"), `\uFEFF${JSON.stringify({ mcpServers: { ploten: { command: "node" } } })}`);
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, CLAUDE_PLUGIN_ROOT: root, CLAUDE_CONFIG_DIR: settings }, [initialize]);
  assert.equal(result.lines[0].result.instructions, ALREADY_RUNS);
  assert.equal(existsSync(mark), false);
});

test("3d. two entries in the older Claude Code settings file .config.json (it wins when it has text): off", async () => {
  const { folder, mark } = fakeInstall();
  const settings = claudeSettings({ other: { command: "node" } });
  writeFileSync(path.join(settings, ".config.json"), JSON.stringify({ mcpServers: { ploten: { command: "node" } } }));
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, CLAUDE_PLUGIN_ROOT: root, CLAUDE_CONFIG_DIR: settings }, [initialize]);
  assert.equal(result.lines[0].result.instructions, ALREADY_RUNS);
  assert.equal(existsSync(mark), false);
});

test("3e. an empty older .config.json: .claude.json decides (no entry there: hands over)", async () => {
  const { folder, mark } = fakeInstall();
  const settings = claudeSettings({ other: { command: "node" } });
  writeFileSync(path.join(settings, ".config.json"), "");
  const result = await run({ PLOTEN_LOCAL_STATE_DIR: folder, CLAUDE_PLUGIN_ROOT: root, CLAUDE_CONFIG_DIR: settings }, ["v"]);
  assert.equal(result.code, 7);
  assert.ok(existsSync(mark));
});

const onWindows = { skip: process.platform !== "win32" && "the Windows folder rule runs only on Windows" };

test("W1. Windows: LOCALAPPDATA is a drive path: the launcher in <LOCALAPPDATA>\\Ploten starts", onWindows, async () => {
  const local = tempFolder();
  const { mark } = fakeInstall(path.join(local, "Ploten"));
  const result = await run({ LOCALAPPDATA: local }, ["a"]);
  assert.equal(result.code, 7);
  assert.ok(existsSync(mark));
});

test("W2. Windows: no LOCALAPPDATA: the launcher in <home>\\AppData\\Local\\Ploten starts", onWindows, async () => {
  const home = tempFolder();
  const { mark } = fakeInstall(path.join(home, "AppData", "Local", "Ploten"));
  const result = await run({ HOME: home, USERPROFILE: home }, ["b"]);
  assert.equal(result.code, 7);
  assert.ok(existsSync(mark));
});

test("W3. Windows: LOCALAPPDATA is not a full path: it counts as missing, the home rule decides", onWindows, async () => {
  const home = tempFolder();
  const { mark } = fakeInstall(path.join(home, "AppData", "Local", "Ploten"));
  const result = await run({ HOME: home, USERPROFILE: home, LOCALAPPDATA: "relative\\folder" }, ["c"]);
  assert.equal(result.code, 7);
  assert.ok(existsSync(mark));
});

test("W4. Windows: LOCALAPPDATA is a share path: the share is used, not the home rule", onWindows, async () => {
  const home = tempFolder();
  const { mark } = fakeInstall(path.join(home, "AppData", "Local", "Ploten"));
  const share = "\\\\localhost\\ploten-cell-no-such-share";
  const result = await run({ HOME: home, USERPROFILE: home, LOCALAPPDATA: share }, [initialize]);
  assert.equal(result.lines[0].result.instructions, NOT_INSTALLED);
  assert.equal(existsSync(mark), false);
});

test("4. no shell: one spawn, of this same Node, with shell off; no other way to start a program", () => {
  const code = source.replace(/^\s*\/\/.*$/gmu, "");
  assert.equal(code.match(/\bspawn\(/gu)?.length, 1);
  assert.match(code, /spawn\(process\.execPath, \[launcher\], \{[^}]*shell: false/u);
  for (const banned of ["exec(", "execSync", "execFile", "spawnSync", "fork(", "eval(", "new Function", "import("]) {
    assert.equal(code.includes(banned), false, banned);
  }
});

test("5. no network: imports only child_process, fs, os and path; no network module or call", () => {
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gmu)].map((match) => match[1]);
  assert.deepEqual(imports, ["node:child_process", "node:fs", "node:os", "node:path"]);
  for (const banned of ["http", "https", "node:net", "node:tls", "dgram", "fetch(", "WebSocket", "require("]) {
    const code = source.replace(/https:\/\/ploten\.dev\/install/gu, "");
    assert.equal(code.includes(banned), false, banned);
  }
});

test("6. package: no install script, no dependency, one bin, only the launcher in the files list; one version everywhere", () => {
  const pkg = readJson("package.json");
  for (const field of ["scripts", "dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "bundleDependencies"]) {
    assert.equal(pkg[field], undefined, field);
  }
  assert.deepEqual(pkg.bin, { "ploten-powerbi": "bin/start.mjs" });
  assert.deepEqual(pkg.files, ["bin/start.mjs"]);
  assert.equal(pkg.license, "MIT");
  const version = source.match(/const VERSION = "([^"]+)";/u)[1];
  for (const file of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json", "server.json"]) {
    assert.equal(readJson(file).version, pkg.version, file);
  }
  assert.equal(version, pkg.version);
});

test("7. registry: the server name is the package mcpName, the npm entry pins this version, description 1 to 100 characters", () => {
  const pkg = readJson("package.json");
  const server = readJson("server.json");
  assert.equal(server.name, pkg.mcpName);
  assert.equal(server.packages.length, 1);
  assert.deepEqual(
    { type: server.packages[0].registryType, id: server.packages[0].identifier, version: server.packages[0].version },
    { type: "npm", id: pkg.name, version: pkg.version },
  );
  assert.ok(server.description.length >= 1 && server.description.length <= 100, String(server.description.length));
});

test("8. plugin entries: the server is named ploten in both clients and starts this file", () => {
  const claude = readJson(".mcp.json").mcpServers;
  const codex = readJson("codex.mcp.json").mcpServers;
  assert.deepEqual(Object.keys(claude), ["ploten"]);
  assert.deepEqual(Object.keys(codex), ["ploten"]);
  assert.deepEqual(claude.ploten, { command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/bin/start.mjs"] });
  assert.deepEqual(codex.ploten, { command: "node", args: ["./bin/start.mjs"], cwd: "." });
  assert.equal(readJson(".codex-plugin/plugin.json").mcpServers, "./codex.mcp.json");
});
