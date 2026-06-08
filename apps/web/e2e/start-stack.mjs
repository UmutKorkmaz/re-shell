/**
 * E2E stack launcher used by Playwright's `webServer`.
 *
 * Brings up the FULL secure round-trip the dashboard depends on:
 *
 *   1. Builds the dashboard with the hub URL + session token baked in
 *      (Vite inlines `VITE_*` at build time, so the token must be present here).
 *   2. Builds + starts the hub (apps/web/dist/hub-server.js) against a fixture
 *      monorepo, with the SAME token and the dashboard origin allow-listed.
 *      The hub spawns the REAL built re-shell CLI for every job.
 *   3. Serves the built dashboard via `vite preview`.
 *
 * The hub binds loopback-only and is token-protected; the token here is a fixed
 * per-invocation value (generated once, shared by build + hub + the dashboard
 * bundle) so the three coordinated processes agree without a discovery channel.
 *
 * On any signal/exit it tears down the hub so no orphan lingers on the port.
 */
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appWebRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appWebRoot, '..', '..');

// Fixed test ports. Preview serves the dashboard; the hub listens one port up.
// The hub allow-lists the dashboard origin via VITE_RE_SHELL_UI_PORT below.
const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? 4317);
const HUB_PORT = Number(process.env.E2E_HUB_PORT ?? 4318);
const HUB_URL = `http://127.0.0.1:${HUB_PORT}`;

// One token shared by the dashboard bundle (baked at build) and the hub.
const TOKEN = process.env.E2E_HUB_TOKEN ?? randomBytes(24).toString('hex');

const FIXTURE_WORKSPACE = path.join(here, 'fixtures', 'workspace');
const CLI_BIN = path.join(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const HUB_BUNDLE = path.join(appWebRoot, 'dist', 'hub-server.js');
const VITE_BIN = path.join(appWebRoot, 'node_modules', '.bin', 'vite');

function log(msg) {
  process.stdout.write(`[e2e-stack] ${msg}\n`);
}

function runSync(cmd, args, env) {
  execFileSync(cmd, args, {
    cwd: appWebRoot,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

function assertExists(p, hint) {
  if (!fs.existsSync(p)) {
    throw new Error(`${hint} not found at ${p}`);
  }
}

// 1. Build the dashboard + hub bundle with the token/URL baked in.
log('Building dashboard + hub bundle with baked hub URL/token...');
runSync(VITE_BIN, ['build'], {
  VITE_RE_SHELL_UI_HUB_URL: HUB_URL,
  VITE_RE_SHELL_UI_HUB_TOKEN: TOKEN,
});
// `vite build` runs `build:hub` only via the npm script; invoke it explicitly so
// the hub bundle is fresh against the current source.
log('Bundling hub server...');
runSync(process.execPath, [path.join(appWebRoot, 'scripts', 'build-hub.mjs')], {});

assertExists(CLI_BIN, 'Built re-shell CLI');
assertExists(HUB_BUNDLE, 'Hub server bundle');
assertExists(FIXTURE_WORKSPACE, 'Fixture workspace');

// 2. Start the hub against the fixture workspace, spawning the real CLI.
log(`Starting hub at ${HUB_URL} against fixture ${FIXTURE_WORKSPACE}`);
const hub = spawn(process.execPath, [HUB_BUNDLE], {
  cwd: FIXTURE_WORKSPACE,
  stdio: 'inherit',
  env: {
    ...process.env,
    RE_SHELL_UI_HUB_PORT: String(HUB_PORT),
    RE_SHELL_UI_HUB_TOKEN: TOKEN,
    RE_SHELL_WORKSPACE: FIXTURE_WORKSPACE,
    RE_SHELL_CLI_BIN: CLI_BIN,
    // Allow-list the dashboard preview origin for CORS + WS upgrade checks.
    VITE_RE_SHELL_UI_PORT: String(PREVIEW_PORT),
    VITE_RE_SHELL_UI_HOST: '127.0.0.1',
  },
});

// 3. Serve the built dashboard. Playwright waits on this port.
log(`Starting vite preview on ${PREVIEW_PORT}`);
const preview = spawn(
  VITE_BIN,
  ['preview', '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
  { cwd: appWebRoot, stdio: 'inherit', env: { ...process.env } }
);

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of [hub, preview]) {
    if (child && !child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exit(code ?? 0);
}

hub.on('exit', (code) => {
  log(`hub exited with code ${code}`);
  shutdown(code ?? 1);
});
preview.on('exit', (code) => {
  log(`preview exited with code ${code}`);
  shutdown(code ?? 1);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
