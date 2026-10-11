#!/usr/bin/env node
/** Exercise packed UI artifacts outside the workspace, including automatic peer installation. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 10 * 60_000,
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === 'win32',
    // NODE_PATH and inherited npm run settings must not resolve workspace peers.
    env: Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      key !== 'NODE_PATH' && !key.startsWith('npm_') && !key.startsWith('VITE_'))),
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

/** Called by the monorepo release smoke with the same tarballs it publishes. */
export function verifyUiPackage({ uiTarball, contractsTarball, workDir }) {
  const installDir = path.join(workDir, 'ui-install');
  mkdirSync(installDir);
  writeFileSync(path.join(installDir, 'package.json'), JSON.stringify({
    name: 're-shell-ui-clean-install', version: '0.0.0', private: true,
  }));
  // Install only the UI and local contracts tarballs. The installer must supply
  // React, React DOM and React Query from the declared peer metadata.
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', uiTarball, contractsTarball], installDir);
  const uiManifest = JSON.parse(readFileSync(path.join(installDir, 'node_modules/@re-shell/ui/package.json')));
  assert.equal(uiManifest.peerDependenciesMeta?.['@tanstack/react-query']?.optional, undefined);
  assert.ok(uiManifest.peerDependencies['@tanstack/react-query']);
  assert.ok(existsSync(path.join(installDir, 'node_modules/@tanstack/react-query/package.json')));

  const checks = `
assert.equal(typeof ui.useHubQuery, 'function');
assert.equal(typeof hooks.useHubQuery, 'function');
assert.equal(ui.resolveHubBaseUrl(), 'http://127.0.0.1:3333');
assert.equal(ui.resolveHubToken(), undefined);
assert.equal(ui.resolveHubBaseUrl('http://explicit:4444/'), 'http://explicit:4444');
globalThis.window = { __RE_SHELL_HUB__: { url: 'http://runtime:5555/', token: 'runtime-token' } };
assert.equal(ui.resolveHubBaseUrl(), 'http://runtime:5555');
assert.equal(ui.resolveHubToken(), 'runtime-token');
delete globalThis.window;
assert.match(renderToStaticMarkup(React.createElement(ui.Button, null, 'Packed button')), /Packed button/);
assert.equal(button.Button, ui.Button);
`;
  writeFileSync(path.join(installDir, 'esm.mjs'), `
import assert from 'node:assert/strict';
import * as ui from '@re-shell/ui';
import * as hooks from '@re-shell/ui/hooks';
import * as button from '@re-shell/ui/components/ui/button';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
${checks}`);
  writeFileSync(path.join(installDir, 'cjs.cjs'), `
const assert = require('node:assert/strict');
const ui = require('@re-shell/ui');
const hooks = require('@re-shell/ui/hooks');
const button = require('@re-shell/ui/components/ui/button');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
${checks}`);
  run(process.execPath, ['esm.mjs'], installDir);
  run(process.execPath, ['cjs.cjs'], installDir);

  // Build a consuming Vite app against the actual installed package. Library
  // compilation must preserve env reads for this later application build.
  writeFileSync(path.join(installDir, 'hub.mjs'), `
import { resolveHubBaseUrl, resolveHubToken } from '@re-shell/ui';
export { resolveHubBaseUrl, resolveHubToken };
`);
  writeFileSync(path.join(installDir, '.env.production'), [
    'VITE_RE_SHELL_UI_HOST=consumer.example.test',
    'VITE_RE_SHELL_UI_PORT=9876',
    'VITE_RE_SHELL_UI_HUB_TOKEN=consumer-smoke-token',
  ].join('\n'));
  writeFileSync(path.join(installDir, 'vite.config.mjs'), `export default {
  build: { lib: { entry: 'hub.mjs', formats: ['es'], fileName: () => 'hub.mjs' }, minify: false }
};`);
  const viteBin = path.join(repoRoot, 'packages/ui/node_modules/vite/bin/vite.js');
  run(process.execPath, [viteBin, 'build'], installDir);
  const validateVite = `
import assert from 'node:assert/strict';
import { resolveHubBaseUrl, resolveHubToken } from './dist/hub.mjs';
assert.equal(resolveHubBaseUrl(), 'http://consumer.example.test:9876');
assert.equal(resolveHubToken(), 'consumer-smoke-token');
globalThis.window = { __RE_SHELL_HUB__: { url: 'http://runtime:5555/', token: 'runtime-token' } };
assert.equal(resolveHubBaseUrl(), 'http://runtime:5555');
assert.equal(resolveHubToken(), 'runtime-token');
assert.equal(resolveHubToken('explicit-token'), 'explicit-token');
`;
  writeFileSync(path.join(installDir, 'vite-check.mjs'), validateVite);
  run(process.execPath, ['vite-check.mjs'], installDir);
  // Repeat with a complete URL to cover the other env branch.
  writeFileSync(path.join(installDir, '.env.production'), 'VITE_RE_SHELL_UI_HUB_URL=https://consumer.example.test/hub/\n');
  run(process.execPath, [viteBin, 'build'], installDir);
  writeFileSync(path.join(installDir, 'vite-url-check.mjs'), `
import assert from 'node:assert/strict';
import { resolveHubBaseUrl } from './dist/hub.mjs';
assert.equal(resolveHubBaseUrl(), 'https://consumer.example.test/hub');
`);
  run(process.execPath, ['vite-url-check.mjs'], installDir);
  return 'automatic peers, ESM/CJS roots + hooks + SSR, consuming Vite env and runtime precedence';
}

function main() {
  const workDir = mkdtempSync(path.join(os.tmpdir(), 're-shell-ui-pack-smoke-'));
  try {
    if (!process.argv.includes('--no-build')) {
      run('pnpm', ['--filter', '@re-shell/contracts', '--filter', '@re-shell/ui', 'build'], repoRoot);
    }
    const packsDir = path.join(workDir, 'packs');
    mkdirSync(packsDir);
    const tarballs = {};
    for (const name of ['contracts', 'ui']) {
      const cwd = path.join(repoRoot, 'packages', name);
      const { version } = JSON.parse(readFileSync(path.join(cwd, 'package.json')));
      // Prerequisites were built above; --no-build likewise uses existing dist.
      run('pnpm', ['--config.ignore-scripts=true', 'pack', '--pack-destination', packsDir], cwd);
      tarballs[name] = path.join(packsDir, `re-shell-${name}-${version}.tgz`);
    }
    console.log(`[ui-pack-smoke] PASS ${verifyUiPackage({ uiTarball: tarballs.ui, contractsTarball: tarballs.contracts, workDir })}`);
    if (!process.argv.includes('--keep')) rmSync(workDir, { recursive: true, force: true });
    else console.log(`[ui-pack-smoke] Kept ${workDir}`);
  } catch (error) {
    console.error(`[ui-pack-smoke] Failed; kept ${workDir} for inspection.`);
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error); process.exitCode = 1; }
}
