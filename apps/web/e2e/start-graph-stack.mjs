/**
 * E2E stack for the large-graph spec (e2e/graph-scale.spec.ts).
 *
 * Same secure round-trip as start-stack.mjs (token-protected loopback hub that
 * spawns the REAL built re-shell CLI, plus the built dashboard served by
 * `vite preview`), but over a generated 2000-workspace monorepo instead of the
 * tiny fixture, with its own ports and its own dashboard build directory so it
 * can run next to (or after) the default stack without clobbering it.
 *
 * It also stands up what live status needs something real to probe:
 *   - a health server answering 200 on /health  -> one app reads `running`
 *   - a server that is up but answers 500       -> one app reads `unhealthy`
 *   - closed ports                              -> two apps read `stopped`
 * and turns the generated workspace into a git repo with one commit followed by
 * an uncommitted working-tree change, so `workspace graph diff --base HEAD`
 * has a real diff to report (+1 node, +3 edges).
 */
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { buildGraphSpec, writeGraphWorkspace } from './fixtures/graph-fixture.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appWebRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appWebRoot, '..', '..');

const PREVIEW_PORT = Number(process.env.E2E_GRAPH_PREVIEW_PORT ?? 4417);
const HUB_PORT = Number(process.env.E2E_GRAPH_HUB_PORT ?? 4418);
const NODE_COUNT = Number(process.env.E2E_GRAPH_NODES ?? 2000);
const HUB_URL = `http://127.0.0.1:${HUB_PORT}`;
const TOKEN = process.env.E2E_HUB_TOKEN ?? randomBytes(24).toString('hex');

const CLI_BIN = path.join(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const HUB_BUNDLE = path.join(appWebRoot, 'dist', 'hub-server.js');
const VITE_BIN = path.join(appWebRoot, 'node_modules', '.bin', 'vite');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-graph-e2e-'));
const WORKSPACE = path.join(scratch, 'workspace');
const DASHBOARD_DIST = path.join(scratch, 'dashboard-dist');

function log(msg) {
  process.stdout.write(`[e2e-graph-stack] ${msg}\n`);
}

function runSync(cmd, args, env, cwd = appWebRoot) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
}

function listen(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

const children = [];
const servers = [];
let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) if (child && !child.killed) child.kill('SIGTERM');
  for (const server of servers) server.close();
  try {
    fs.rmSync(scratch, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  process.exit(code ?? 0);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// 1. Real things for live status to probe.
const healthy = await listen((req, res) => {
  res.statusCode = req.url === '/health' ? 200 : 404;
  res.end('ok');
});
const unhealthy = await listen((_req, res) => {
  res.statusCode = 500;
  res.end('sick');
});
servers.push(healthy.server, unhealthy.server);
const closedPorts = [await freePort(), await freePort()];

// 2. Generate the workspace, commit it, then leave an uncommitted change.
log(`Generating a ${NODE_COUNT}-workspace monorepo in ${WORKSPACE}`);
const spec = buildGraphSpec(NODE_COUNT, {
  healthyPort: healthy.port,
  unhealthyPort: unhealthy.port,
  closedPorts,
});
writeGraphWorkspace(WORKSPACE, spec);

const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'e2e',
  GIT_AUTHOR_EMAIL: 'e2e@example.com',
  GIT_COMMITTER_NAME: 'e2e',
  GIT_COMMITTER_EMAIL: 'e2e@example.com',
};
const git = (...args) => execFileSync('git', args, { cwd: WORKSPACE, env: gitEnv, stdio: 'pipe' });
git('init', '-q', '-b', 'main');
git('add', '-A');
git('commit', '-q', '-m', 'graph fixture');

// Working-tree change: one new app depending on two packages, one existing
// package gaining a dependency edge. `workspace graph diff --base HEAD` => +1 node, +3 edges.
const firstApp = spec.find((w) => w.kind === 'app');
const pkgs = spec.filter((w) => w.kind === 'package');
const newApp = path.join(WORKSPACE, 'apps', 'app-new');
fs.mkdirSync(newApp, { recursive: true });
fs.writeFileSync(
  path.join(newApp, 'package.json'),
  JSON.stringify(
    { name: '@fx/app-new', version: '1.0.0', private: true, dependencies: { [pkgs[0].name]: 'workspace:*', [pkgs[1].name]: 'workspace:*' } },
    null,
    2
  )
);
const firstAppPkgPath = path.join(WORKSPACE, firstApp.dir, 'package.json');
const firstAppPkg = JSON.parse(fs.readFileSync(firstAppPkgPath, 'utf8'));
const extraDep = pkgs.find((p) => !(p.name in (firstAppPkg.dependencies ?? {})) && !(p.name in (firstAppPkg.devDependencies ?? {})));
firstAppPkg.dependencies[extraDep.name] = 'workspace:*';
fs.writeFileSync(firstAppPkgPath, JSON.stringify(firstAppPkg, null, 2));

// 3. Build the dashboard (hub URL + token baked in) into its own directory.
for (const [what, p] of [['Built re-shell CLI', CLI_BIN]]) {
  if (!fs.existsSync(p)) throw new Error(`${what} not found at ${p}`);
}
log('Building dashboard with baked hub URL/token...');
runSync(VITE_BIN, ['build', '--outDir', DASHBOARD_DIST, '--emptyOutDir'], {
  VITE_RE_SHELL_UI_HUB_URL: HUB_URL,
  VITE_RE_SHELL_UI_HUB_TOKEN: TOKEN,
});
// Always re-bundle: the hub inlines the contracts command registry at build time.
log('Bundling hub server...');
runSync(process.execPath, [path.join(appWebRoot, 'scripts', 'build-hub.mjs')], {});
if (!fs.existsSync(HUB_BUNDLE)) throw new Error(`Hub server bundle not found at ${HUB_BUNDLE}`);

// 4. Hub against the generated workspace, spawning the real CLI.
log(`Starting hub at ${HUB_URL}`);
const hub = spawn(process.execPath, [HUB_BUNDLE], {
  cwd: WORKSPACE,
  stdio: 'inherit',
  env: {
    ...process.env,
    RE_SHELL_UI_HUB_PORT: String(HUB_PORT),
    RE_SHELL_UI_HUB_TOKEN: TOKEN,
    RE_SHELL_WORKSPACE: WORKSPACE,
    RE_SHELL_CLI_BIN: CLI_BIN,
    VITE_RE_SHELL_UI_PORT: String(PREVIEW_PORT),
    VITE_RE_SHELL_UI_HOST: '127.0.0.1',
  },
});
children.push(hub);

// 5. Serve the dashboard. Playwright waits on this port.
log(`Starting vite preview on ${PREVIEW_PORT}`);
const preview = spawn(
  VITE_BIN,
  ['preview', '--outDir', DASHBOARD_DIST, '--host', '127.0.0.1', '--port', String(PREVIEW_PORT), '--strictPort'],
  { cwd: appWebRoot, stdio: 'inherit', env: { ...process.env } }
);
children.push(preview);

hub.on('exit', (code) => {
  log(`hub exited with code ${code}`);
  shutdown(code ?? 1);
});
preview.on('exit', (code) => {
  log(`preview exited with code ${code}`);
  shutdown(code ?? 1);
});
