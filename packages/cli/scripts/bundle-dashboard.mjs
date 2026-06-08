// Builds the re-shell dashboard (apps/web) and copies its static output into
// the CLI package so a published, npm-installed CLI can launch the dashboard
// WITHOUT the monorepo source or a Vite dev server.
//
// Output layout produced here:
//   packages/cli/dist/dashboard/index.html
//   packages/cli/dist/dashboard/assets/*
//   packages/cli/dist/dashboard/hub-server.js
//
// The CLI's static server (src/utils/ui-static-server.ts) serves the SPA from
// this directory and the launcher spawns dist/dashboard/hub-server.js with
// plain `node`. The dashboard SPA receives its per-launch hub url + token at
// RUNTIME via an injected `window.__RE_SHELL_HUB__` script, so this prebuilt
// bundle never bakes in a token.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');
const monorepoRoot = path.resolve(cliRoot, '../..');
const webAppRoot = path.join(monorepoRoot, 'apps/web');
const webDist = path.join(webAppRoot, 'dist');
const targetDir = path.join(cliRoot, 'dist/dashboard');

function fail(message) {
  console.error(`[bundle-dashboard] ${message}`);
  process.exit(1);
}

if (!existsSync(path.join(webAppRoot, 'package.json'))) {
  fail(`Dashboard app not found at ${webAppRoot}. This script must run inside the monorepo.`);
}

// Build the dashboard (Vite SPA + esbuild hub bundle). Run via pnpm so the
// workspace dependency graph resolves correctly.
console.log('[bundle-dashboard] Building re-shell-dashboard...');
const build = spawnSync('pnpm', ['--filter', 're-shell-dashboard', 'build'], {
  cwd: monorepoRoot,
  stdio: 'inherit'
});

if (build.status !== 0) {
  fail('Dashboard build failed.');
}

const indexHtml = path.join(webDist, 'index.html');
const hubServer = path.join(webDist, 'hub-server.js');

if (!existsSync(indexHtml)) {
  fail(`Expected built SPA at ${indexHtml} but it is missing.`);
}
if (!existsSync(hubServer)) {
  fail(`Expected built hub at ${hubServer} but it is missing.`);
}

// Replace the target directory wholesale so stale assets never linger.
rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });

// Copy the entire dist tree (index.html, assets/, favicon, hub-server.js).
cpSync(webDist, targetDir, { recursive: true });

console.log(`[bundle-dashboard] Copied dashboard bundle to ${targetDir}`);
