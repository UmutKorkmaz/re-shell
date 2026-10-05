import * as assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import * as vscode from 'vscode';

import type {
  BuildCommandOutcome,
  ReShellExtensionApi,
  RunViaHubOutcome,
} from '../../../src/extension';

/**
 * Runs INSIDE a real VS Code extension host (launched by tests/host/run.ts).
 *
 * The launcher opened the editor on a real fixture workspace, started the real
 * hub (apps/web/dist/hub-server.js) with a random token, and configured the
 * extension through user settings (`reShell.cliBin`, `reShell.hub.url`,
 * `reShell.hub.token`) and the matching environment variables.
 */

const EXTENSION_ID = 'umutkorkmaz.re-shell';
const execFileAsync = promisify(execFile);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} was not provided by the host-test launcher.`);
  }
  return value;
}

const cliEntry = requiredEnv('RE_SHELL_TEST_CLI');
const workspaceRoot = requiredEnv('RE_SHELL_TEST_WORKSPACE');
const hubToken = requiredEnv('RE_SHELL_TEST_HUB_TOKEN');

const hubConfig = (): vscode.WorkspaceConfiguration => vscode.workspace.getConfiguration('reShell.hub');

/** Set a user setting, run `fn`, then restore the previous value. */
async function withHubSetting<T>(key: string, value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const config = hubConfig();
  const before = config.inspect<string>(key)?.globalValue;
  await config.update(key, value, vscode.ConfigurationTarget.Global);
  try {
    return await fn();
  } finally {
    await hubConfig().update(key, before, vscode.ConfigurationTarget.Global);
  }
}

describe('Re-Shell extension in a real VS Code host', () => {
  let api: ReShellExtensionApi;

  before(async () => {
    const extension = vscode.extensions.getExtension<ReShellExtensionApi>(EXTENSION_ID);
    assert.ok(extension, `extension ${EXTENSION_ID} is not loaded in the host`);
    api = await extension.activate();
    assert.ok(extension.isActive, 'extension did not activate');
    await api.ready;
  });

  describe('activation', () => {
    it('activates and exposes its API', () => {
      assert.equal(typeof api.refresh, 'function');
      assert.equal(typeof api.commandsTree, 'function');
    });

    it('opened the fixture workspace', () => {
      const folders = vscode.workspace.workspaceFolders ?? [];
      assert.equal(folders.length, 1);
      assert.equal(folders[0].uri.fsPath, workspaceRoot);
    });

    it('registers every palette command', async () => {
      const registered = await vscode.commands.getCommands(true);
      for (const id of [
        'reShell.refresh',
        'reShell.runCommand',
        'reShell.buildCommand',
        'reShell.runViaHub',
        'reShell.runDoctor',
      ]) {
        assert.ok(registered.includes(id), `${id} is not registered`);
      }
    });

    it('reveals its activity-bar container and focuses the Commands view', async () => {
      // Both commands only exist if the manifest's viewsContainers/views and the
      // extension's createTreeView ids line up inside the real editor.
      await vscode.commands.executeCommand('workbench.view.extension.reShell');
      await vscode.commands.executeCommand('reShell.commands.focus');
    });
  });

  describe('Commands tree', () => {
    it('spawned the configured CLI (setting/env), not a PATH lookup', () => {
      assert.equal(api.resolvedCli(), cliEntry);
    });

    it('is populated from `re-shell commands list --json`', async () => {
      // Ground truth: run the same built CLI directly, in the same workspace.
      const { stdout } = await execFileAsync(process.execPath, [cliEntry, 'commands', 'list', '--json'], {
        cwd: workspaceRoot,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      });
      const envelope = JSON.parse(stdout) as { ok: boolean; data: { path: string }[] };
      assert.equal(envelope.ok, true);
      const expected = envelope.data.map((entry) => entry.path).sort();
      assert.ok(expected.length > 20, 'the CLI catalog is unexpectedly small');

      const tree = api.commandsTree();
      const rendered = tree.flatMap((group) => group.commands).sort();
      assert.deepEqual(rendered, expected);

      const workspaceGroup = tree.find((group) => group.category === 'Workspace');
      assert.ok(workspaceGroup, 'no "Workspace" category in the tree');
      for (const path of ['workspace summary', 'workspace health', 'workspace graph']) {
        assert.ok(workspaceGroup.commands.includes(path), `"${path}" missing from the Workspace group`);
      }
    });
  });

  describe('palette: build a spec and run it through the local hub', () => {
    it('builds a contract-shaped spec for a catalog command without running it', async () => {
      // Ready-made params (here: none) skip the option prompts; a bare path is what a
      // tree click sends and prompts, which nothing answers in a headless host.
      const outcome = (await vscode.commands.executeCommand('reShell.buildCommand', {
        path: 'workspace health',
        params: {},
      })) as BuildCommandOutcome;
      assert.equal(outcome.ok, true);
      if (!outcome.ok) return;
      assert.equal(outcome.spec.id, 'workspace.health');
      assert.deepEqual(outcome.spec.command, ['re-shell', 'workspace', 'health']);
      assert.equal(outcome.spec.cwd, workspaceRoot);
      assert.equal(outcome.spec.destructive, false);
    });

    it('refuses to build a spec from an unsafe value', async () => {
      const outcome = (await vscode.commands.executeCommand('reShell.buildCommand', {
        path: 'add',
        params: { args: { name: 'foo; rm -rf ~' } },
      })) as BuildCommandOutcome;
      assert.equal(outcome.ok, false);
    });

    it('runs the spec through the real hub and the job result comes back', async () => {
      const outcome = (await vscode.commands.executeCommand('reShell.runViaHub', {
        path: 'workspace summary',
      })) as RunViaHubOutcome;

      assert.equal(outcome.ok, true, outcome.ok ? '' : `${outcome.stage}: ${outcome.error}`);
      if (!outcome.ok) return;
      assert.deepEqual(outcome.spec.command, ['re-shell', 'workspace', 'summary', '--json']);
      assert.equal(outcome.exitCode, 0);

      const data = outcome.envelope.data as { root: string; workspaces: { name: string }[] };
      // The CLI ran in the fixture workspace the hub is contained to.
      assert.equal(data.root, workspaceRoot);
      assert.deepEqual(data.workspaces.map((w) => w.name).sort(), ['demo-app', 'demo-lib']);
    });

    it('goes through the hub: the same run fails when the hub rejects the token', async () => {
      await withHubSetting('token', 'definitely-not-the-token', async () => {
        const outcome = (await vscode.commands.executeCommand('reShell.runViaHub', {
          path: 'workspace summary',
        })) as RunViaHubOutcome;
        assert.equal(outcome.ok, false);
        if (outcome.ok) return;
        assert.equal(outcome.stage, 'hub');
        assert.match(outcome.error, /rejected the session token/);
      });
    });

    it('falls back to RE_SHELL_UI_HUB_TOKEN when the token setting is empty', async () => {
      await withHubSetting('token', '', async () => {
        const outcome = (await vscode.commands.executeCommand('reShell.runViaHub', {
          path: 'workspace health',
        })) as RunViaHubOutcome;
        assert.equal(outcome.ok, true, outcome.ok ? '' : `${outcome.stage}: ${outcome.error}`);
        if (outcome.ok) assert.equal(outcome.exitCode, 0);
      });
      // Sanity: the env token the extension just used is the hub's real token.
      assert.equal(process.env.RE_SHELL_UI_HUB_TOKEN, hubToken);
    });

    it('reports a job that exits non-zero as a failure, never as success', async () => {
      const outcome = (await vscode.commands.executeCommand('reShell.runViaHub', {
        path: 'workspace validate',
      })) as RunViaHubOutcome;
      assert.equal(outcome.ok, false);
      if (outcome.ok) return;
      assert.equal(outcome.stage, 'command');
      assert.notEqual(outcome.exitCode, 0);
    });

    it('rejects a command that is not on the hub allow-list before sending anything', async () => {
      const outcome = (await vscode.commands.executeCommand('reShell.runViaHub', {
        path: 'add',
      })) as RunViaHubOutcome;
      assert.equal(outcome.ok, false);
      if (!outcome.ok) assert.equal(outcome.stage, 'spec');
    });
  });
});
