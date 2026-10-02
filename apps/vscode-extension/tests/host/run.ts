import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { runTests } from '@vscode/test-electron';

import { createFixtureWorkspace, removeFixtureWorkspace } from '../support/fixture-workspace.js';
import { resolveRepoArtifacts, startRealHub } from '../support/hub-process.js';

/**
 * Launcher for the VS Code HOST integration tests (`pnpm run test:host`).
 *
 * Runs in plain Node, outside the editor. It
 *   1. creates a real fixture workspace on disk,
 *   2. starts the REAL hub (apps/web/dist/hub-server.js) with a random token,
 *      contained to that workspace,
 *   3. downloads (or reuses) a real VS Code and launches it with this extension
 *      loaded from the package directory, opened on the fixture workspace, with
 *      the built CLI and the hub configured through the extension's settings
 *      (user settings.json) and environment,
 *   4. runs tests/host/suite inside the editor's extension host, and
 *   5. tears everything down, exiting non-zero on any failure.
 *
 * Environment:
 *   VSCODE_TEST_VERSION     VS Code build to download: `stable` (default), `insiders`
 *                           or a version such as `1.85.0`.
 *   VSCODE_EXECUTABLE_PATH  Use this existing VS Code binary instead of downloading.
 *   RE_SHELL_TEST_CLI / RE_SHELL_TEST_HUB_BUNDLE  Override the built artifacts.
 *
 * Keep the launch directories short: they end up inside Unix-domain-socket
 * paths, which are limited to ~107 characters.
 */

// Compiled to <package>/dist-test/host/run.js, so the package root is two levels up.
const packageRoot = path.resolve(__dirname, '../..');

async function main(): Promise<void> {
  const artifacts = resolveRepoArtifacts(packageRoot);
  const workspace = createFixtureWorkspace();
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-vsc-'));
  const userDataDir = path.join(sandbox, 'u');
  const extensionsDir = path.join(sandbox, 'e');
  fs.mkdirSync(path.join(userDataDir, 'User'), { recursive: true });
  fs.mkdirSync(extensionsDir, { recursive: true });

  const hub = await startRealHub({ artifacts, workspace });
  console.log(`[host-test] hub listening at ${hub.url}, workspace ${workspace}`);

  // The extension's own settings point it at the built CLI and the hub. They are
  // `machine`-scoped, so they only take effect from user settings.
  fs.writeFileSync(
    path.join(userDataDir, 'User', 'settings.json'),
    JSON.stringify(
      {
        'reShell.cliBin': artifacts.cliEntry,
        'reShell.hub.url': hub.url,
        'reShell.hub.token': hub.token,
        'security.workspace.trust.enabled': false,
        'telemetry.telemetryLevel': 'off',
        'update.mode': 'none',
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false,
        'workbench.startupEditor': 'none',
        'window.restoreWindows': 'none',
      },
      null,
      2
    )
  );

  let failed = false;
  try {
    await runTests({
      version: process.env.VSCODE_TEST_VERSION ?? 'stable',
      ...(process.env.VSCODE_EXECUTABLE_PATH
        ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH }
        : {}),
      extensionDevelopmentPath: packageRoot,
      extensionTestsPath: path.join(packageRoot, 'dist-test/host/suite/index.js'),
      launchArgs: [
        workspace,
        '--disable-extensions',
        '--disable-workspace-trust',
        '--disable-gpu',
        // Required when the editor runs as root (containers, some CI images).
        '--no-sandbox',
        '--skip-welcome',
        '--skip-release-notes',
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
      ],
      extensionTestsEnv: {
        // Facts the suite asserts against.
        RE_SHELL_TEST_CLI: artifacts.cliEntry,
        RE_SHELL_TEST_WORKSPACE: workspace,
        RE_SHELL_TEST_HUB_URL: hub.url,
        RE_SHELL_TEST_HUB_TOKEN: hub.token,
        // Environment fallbacks the extension supports when a setting is unset.
        RE_SHELL_CLI_BIN: artifacts.cliEntry,
        RE_SHELL_UI_HUB_URL: hub.url,
        RE_SHELL_UI_HUB_TOKEN: hub.token,
      },
    });
  } catch (err) {
    failed = true;
    console.error('[host-test] VS Code host tests failed:', err instanceof Error ? err.message : err);
    console.error(
      '[host-test] If VS Code could not be downloaded (update.code.visualstudio.com unreachable), ' +
        'point VSCODE_EXECUTABLE_PATH at an installed VS Code binary.'
    );
    console.error(`[host-test] hub log:\n${hub.logs()}`);
  } finally {
    await hub.stop();
    removeFixtureWorkspace(workspace);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  if (failed) {
    process.exit(1);
  }
}

console.log(`[host-test] launcher running on node ${process.version}`);
main().catch((err) => {
  console.error('[host-test] launcher error:', err);
  process.exit(1);
});
