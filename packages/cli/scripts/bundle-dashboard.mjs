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
// bundle must never bake in a token.
//
// Safety properties enforced here (each one fails the script, and therefore the
// `prepack` hook and any `npm pack` / `pnpm pack` / `publish`, with a non-zero exit):
//   1. The dashboard package is selected by the name read from apps/web/package.json,
//      never a hardcoded string, and the previous apps/web/dist is deleted BEFORE the
//      build. A filter that matches no project (pnpm exits 0 in that case) therefore
//      cannot leave a stale build behind to be copied.
//   2. The build runs with every VITE_* variable (and the hub token variables)
//      removed from the environment. Vite inlines VITE_* into the client bundle at
//      build time; a leaked VITE_RE_SHELL_UI_HUB_TOKEN would ship a fixed token.
//   3. The copied bundle is scanned and rejected if it contains an inlined hub
//      token or hub URL (covers .env files that the environment scrub cannot see).

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(here, '..');
const monorepoRoot = path.resolve(cliRoot, '../..');
const webAppRoot = path.join(monorepoRoot, 'apps/web');
const webDist = path.join(webAppRoot, 'dist');
const targetDir = path.join(cliRoot, 'dist/dashboard');

/** Env var prefixes that must never reach the dashboard build. */
const SCRUBBED_ENV_PREFIXES = ['VITE_', 'RE_SHELL_UI_HUB_', 'E2E_HUB_'];

/**
 * Keys Vite would inline if they were present at build time. A built bundle that
 * assigns a non-empty string literal to any of these has a baked-in hub secret/URL.
 */
const FORBIDDEN_INLINED_KEYS = ['VITE_RE_SHELL_UI_HUB_TOKEN', 'VITE_RE_SHELL_UI_HUB_URL'];

function fail(message) {
  console.error(`[bundle-dashboard] ${message}`);
  process.exit(1);
}

/** A copy of `env` without anything Vite or the hub would pick up as config. */
export function scrubbedBuildEnv(env) {
  const clean = {};
  for (const [key, value] of Object.entries(env)) {
    if (SCRUBBED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      continue;
    }
    clean[key] = value;
  }
  return clean;
}

/** Recursively list files below `dir`. */
function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

/**
 * Find inlined hub config in a built bundle. Returns human-readable findings
 * (empty when clean). Matches `KEY:"value"`, `KEY: 'value'`, `KEY="value"` etc. for
 * the forbidden keys, ignoring empty strings and `void 0` / `undefined`.
 */
export function findInlinedHubConfig(rootDir) {
  const findings = [];
  const textExtensions = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json', '.map']);
  for (const file of listFiles(rootDir)) {
    if (!textExtensions.has(path.extname(file))) {
      continue;
    }
    const text = readFileSync(file, 'utf8');
    for (const key of FORBIDDEN_INLINED_KEYS) {
      const pattern = new RegExp(`${key}["']?\\s*[:=]\\s*(["'\`])([^"'\`]+)\\1`, 'g');
      for (const match of text.matchAll(pattern)) {
        findings.push(`${path.relative(rootDir, file)}: ${key} is inlined (value starts "${match[2].slice(0, 6)}...")`);
      }
    }
  }
  return findings;
}

function main() {
  const webPackageJsonPath = path.join(webAppRoot, 'package.json');
  if (!existsSync(webPackageJsonPath)) {
    fail(`Dashboard app not found at ${webAppRoot}. This script must run inside the monorepo.`);
  }

  const webPackageName = JSON.parse(readFileSync(webPackageJsonPath, 'utf8')).name;
  if (typeof webPackageName !== 'string' || webPackageName.length === 0) {
    fail(`${webPackageJsonPath} has no "name"; cannot select the dashboard package to build.`);
  }

  // Delete the previous build first. If the build below is a silent no-op (e.g.
  // the pnpm filter matched nothing and exited 0) the missing index.html is then
  // caught instead of an old - possibly E2E, token-baked - dist being shipped.
  rmSync(webDist, { recursive: true, force: true });

  // Build the dashboard (Vite SPA + esbuild hub bundle). Run via pnpm so the
  // workspace dependency graph resolves correctly.
  console.log(`[bundle-dashboard] Building ${webPackageName}...`);
  const build = spawnSync('pnpm', ['--filter', webPackageName, 'build'], {
    cwd: monorepoRoot,
    stdio: 'inherit',
    env: scrubbedBuildEnv(process.env),
    // pnpm is a .cmd shim on Windows, which Node can only spawn through a shell.
    shell: process.platform === 'win32'
  });

  if (build.error) {
    fail(`Could not run pnpm: ${build.error.message}`);
  }
  if (build.signal) {
    fail(`Dashboard build was terminated by ${build.signal}.`);
  }
  if (build.status !== 0) {
    fail(`Dashboard build failed (pnpm exited with code ${build.status}).`);
  }

  const indexHtml = path.join(webDist, 'index.html');
  const hubServer = path.join(webDist, 'hub-server.js');

  if (!existsSync(indexHtml)) {
    fail(
      `Expected built SPA at ${indexHtml} but it is missing. ` +
        `Did "pnpm --filter ${webPackageName} build" match the dashboard package?`
    );
  }
  if (!existsSync(hubServer)) {
    fail(`Expected built hub at ${hubServer} but it is missing.`);
  }

  // Replace the target directory wholesale so stale assets never linger.
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  // Copy the entire dist tree (index.html, assets/, favicon, hub-server.js).
  cpSync(webDist, targetDir, { recursive: true });

  // Refuse to ship a bundle with a baked-in hub token / URL.
  const findings = findInlinedHubConfig(targetDir);
  if (findings.length > 0) {
    rmSync(targetDir, { recursive: true, force: true });
    fail(
      'The dashboard bundle embeds hub configuration at build time, which must never ship:\n  ' +
        findings.join('\n  ') +
        '\nThe hub url + token are injected at runtime (window.__RE_SHELL_HUB__). ' +
        'Remove VITE_RE_SHELL_UI_HUB_* from apps/web/.env* and rebuild.'
    );
  }

  console.log(`[bundle-dashboard] Copied dashboard bundle to ${targetDir}`);
}

// Only run when executed directly, so the helpers above can be imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
