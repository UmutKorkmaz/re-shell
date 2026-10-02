import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type * as vscodeApi from 'vscode';

import { activate, type BuildCommandOutcome, type ReShellExtensionApi, type RunViaHubOutcome } from '../../src/extension.js';
import { createFixtureWorkspace, removeFixtureWorkspace } from '../support/fixture-workspace.js';
import { resolveRepoArtifacts, startRealHub, type RunningHub } from '../support/hub-process.js';
import { commands, createExtensionContext, stubState } from '../support/vscode-stub.js';

/**
 * Activates the real `src/extension.ts` against the REAL built CLI and the REAL
 * hub, with the `vscode` module replaced by the recording stub in
 * tests/support/vscode-stub.ts. This checks the extension's own wiring end to
 * end (tree, spec building, hub run, terminal path) in every environment. The
 * same flows run inside a genuine VS Code in tests/host.
 */

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = resolveRepoArtifacts(packageRoot);

let workspace: string;
let hub: RunningHub;
let api: ReShellExtensionApi;

function configure(overrides: Record<string, unknown> = {}): void {
  stubState.settings.set('reShell.cliBin', artifacts.cliEntry);
  stubState.settings.set('reShell.hub.url', hub.url);
  stubState.settings.set('reShell.hub.token', hub.token);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      stubState.settings.delete(key);
    } else {
      stubState.settings.set(key, value);
    }
  }
}

beforeAll(async () => {
  workspace = createFixtureWorkspace();
  hub = await startRealHub({ artifacts, workspace });

  stubState.reset();
  stubState.workspaceFolders = [{ uri: { fsPath: workspace } }];
  configure();
  api = activate(createExtensionContext() as unknown as vscodeApi.ExtensionContext);
  await api.ready;
});

afterAll(async () => {
  await hub?.stop();
  if (workspace) removeFixtureWorkspace(workspace);
});

afterEach(() => {
  // Keep the activated extension's command registrations; reset only the
  // per-test observations and answers.
  stubState.messages.length = 0;
  stubState.terminals.length = 0;
  stubState.quickPickAnswers.length = 0;
  stubState.inputAnswers.length = 0;
  stubState.messageChoice = undefined;
  configure();
});

describe('activation + Commands tree', () => {
  it('spawned the configured JS-entry CLI and loaded its catalog', () => {
    expect(api.resolvedCli()).toBe(artifacts.cliEntry);
    expect(api.catalog().length).toBeGreaterThan(20);
  });

  it('renders every command from `re-shell commands list --json` in the tree, grouped by category', () => {
    const tree = api.commandsTree();
    const rendered = tree.flatMap((group) => group.commands).sort();
    const expected = api
      .catalog()
      .map((entry) => entry.path)
      .sort();
    expect(rendered).toEqual(expected);

    const workspaceGroup = tree.find((group) => group.category === 'Workspace');
    expect(workspaceGroup?.commands).toEqual(
      expect.arrayContaining(['workspace summary', 'workspace health', 'workspace graph'])
    );
    expect(tree.find((group) => group.category === 'General')?.commands).toContain('doctor');
  });
});

describe('reShell.buildCommand', () => {
  it('builds a contract-valid spec for a catalog command without running anything', async () => {
    const outcome = (await commands.executeCommand('reShell.buildCommand', {
      path: 'workspace health',
    })) as BuildCommandOutcome;
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.spec).toMatchObject({
      id: 'workspace.health',
      title: 'workspace health',
      command: ['re-shell', 'workspace', 'health'],
      cwd: workspace,
      destructive: false,
      requiresConfirmation: false,
    });
    expect(stubState.terminals).toHaveLength(0);
    expect(stubState.output.join('\n')).toContain('"workspace.health"');
  });

  it('rejects an injection payload instead of building a spec', async () => {
    const outcome = (await commands.executeCommand('reShell.buildCommand', {
      path: 'add',
      params: { args: { name: 'foo; rm -rf ~' } },
    })) as BuildCommandOutcome;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toMatch(/Unsafe value for argument "name"/);
    expect(stubState.messages.some((m) => m.level === 'error')).toBe(true);
  });

  it('builds from prompted answers when invoked without an argument', async () => {
    // Flat quick pick (hub-runnable list is not used here: full catalog -> 2 steps).
    stubState.quickPickAnswers.push(
      (items: readonly unknown[]) => items.find((i) => (i as { label: string }).label === 'Workspace'),
      (items: readonly unknown[]) => items.find((i) => (i as { label: string }).label === 'workspace summary')
    );
    // `workspace summary` only declares --json: one switches prompt, then done.
    stubState.quickPickAnswers.push(undefined);
    const outcome = (await commands.executeCommand('reShell.buildCommand')) as BuildCommandOutcome;
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.spec.command).toEqual(['re-shell', 'workspace', 'summary']);
  });
});

describe('reShell.runViaHub (real hub, real CLI)', () => {
  it('builds a spec for the command, runs it through the hub, and returns the job result', async () => {
    const outcome = (await commands.executeCommand('reShell.runViaHub', {
      path: 'workspace summary',
    })) as RunViaHubOutcome;

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.spec.command).toEqual(['re-shell', 'workspace', 'summary', '--json']);
    expect(outcome.exitCode).toBe(0);
    const data = outcome.envelope.data as { root: string; workspaces: { name: string }[] };
    expect(data.root).toBe(workspace);
    expect(data.workspaces.map((w) => w.name).sort()).toEqual(['demo-app', 'demo-lib']);
    expect(stubState.messages.some((m) => m.level === 'info' && /finished via hub/.test(m.text))).toBe(true);
    expect(stubState.output.join('\n')).toContain('finished (exit 0)');
  });

  it('reports a job that exits non-zero as a command failure, never as success', async () => {
    const outcome = (await commands.executeCommand('reShell.runViaHub', {
      path: 'workspace validate',
    })) as RunViaHubOutcome;
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('command');
    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.error).toMatch(/WORKSPACE_NOT_FOUND/);
  });

  it('fails at the hub stage with a clear message for a wrong token', async () => {
    configure({ 'reShell.hub.token': 'wrong-token' });
    const outcome = (await commands.executeCommand('reShell.runViaHub', {
      path: 'workspace summary',
    })) as RunViaHubOutcome;
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.stage).toBe('hub');
    expect(outcome.error).toMatch(/rejected the session token/);
    expect(outcome.error).not.toContain('wrong-token');
  });

  it('fails at the config stage when no token is configured', async () => {
    const saved = process.env.RE_SHELL_UI_HUB_TOKEN;
    delete process.env.RE_SHELL_UI_HUB_TOKEN;
    try {
      configure({ 'reShell.hub.token': '' });
      const outcome = (await commands.executeCommand('reShell.runViaHub', {
        path: 'workspace summary',
      })) as RunViaHubOutcome;
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.stage).toBe('config');
        expect(outcome.error).toMatch(/No hub token configured/);
      }
      expect(stubState.messages.some((m) => m.level === 'error' && m.actions.includes('Open Settings'))).toBe(true);
    } finally {
      if (saved !== undefined) process.env.RE_SHELL_UI_HUB_TOKEN = saved;
    }
  });

  it('takes the token from RE_SHELL_UI_HUB_TOKEN when the setting is empty', async () => {
    const saved = process.env.RE_SHELL_UI_HUB_TOKEN;
    process.env.RE_SHELL_UI_HUB_TOKEN = hub.token;
    try {
      configure({ 'reShell.hub.token': '' });
      const outcome = (await commands.executeCommand('reShell.runViaHub', {
        path: 'workspace health',
      })) as RunViaHubOutcome;
      expect(outcome.ok).toBe(true);
    } finally {
      if (saved === undefined) delete process.env.RE_SHELL_UI_HUB_TOKEN;
      else process.env.RE_SHELL_UI_HUB_TOKEN = saved;
    }
  });

  it('refuses a non-loopback hub URL before sending anything', async () => {
    configure({ 'reShell.hub.url': 'http://example.com:5179' });
    const outcome = (await commands.executeCommand('reShell.runViaHub', {
      path: 'workspace summary',
    })) as RunViaHubOutcome;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.stage).toBe('config');
      expect(outcome.error).toMatch(/not a loopback address/);
    }
  });

  it('rejects a command that is not on the hub allow-list at the spec stage', async () => {
    const outcome = (await commands.executeCommand('reShell.runViaHub', {
      path: 'add',
    })) as RunViaHubOutcome;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.stage).toBe('spec');
      expect(outcome.error).toMatch(/not on the hub run allow-list/);
    }
  });

  it('rejects a command that is not in the loaded catalog', async () => {
    const outcome = (await commands.executeCommand('reShell.runViaHub', {
      path: 'no such command',
    })) as RunViaHubOutcome;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.stage).toBe('catalog');
  });

  it('offers only hub-runnable commands when picking interactively', async () => {
    let offered: string[] = [];
    stubState.quickPickAnswers.push((items: readonly unknown[]) => {
      offered = items.map((i) => (i as { label: string }).label);
      return items.find((i) => (i as { label: string }).label === 'workspace health');
    });
    const outcome = (await commands.executeCommand('reShell.runViaHub')) as RunViaHubOutcome;
    expect(outcome.ok).toBe(true);
    expect(offered).toEqual(
      expect.arrayContaining(['workspace summary', 'workspace health', 'commands list', 'doctor'])
    );
    expect(offered).not.toContain('add');
  });

  it('reports an unreachable hub at the hub stage', async () => {
    const stopped = await startRealHub({ artifacts, workspace });
    await stopped.stop();
    configure({ 'reShell.hub.url': stopped.url, 'reShell.hub.token': stopped.token });
    const outcome = (await commands.executeCommand('reShell.runViaHub', {
      path: 'workspace summary',
    })) as RunViaHubOutcome;
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.stage).toBe('hub');
      expect(outcome.error).toMatch(/Could not reach the hub/);
    }
  });
});

describe('terminal runs go through the vetted builder', () => {
  it('runs a bare command in a terminal with the CLI entry under node', async () => {
    const entry = api.catalog().find((e) => e.path === 'workspace health');
    await commands.executeCommand('reShell.runCommandFromTree', entry);
    await new Promise((r) => setTimeout(r, 0));
    expect(stubState.terminals).toHaveLength(1);
    expect(stubState.terminals[0].sent).toEqual([`node ${artifacts.cliEntry} workspace health`]);
    expect(stubState.terminals[0].cwd).toBe(workspace);
  });

  it('prompts for a required argument and passes the sanitized value', async () => {
    const entry = api.catalog().find((e) => e.path === 'add');
    stubState.inputAnswers.push('my-app');
    await commands.executeCommand('reShell.runCommandFromTree', entry);
    await new Promise((r) => setTimeout(r, 0));
    expect(stubState.terminals[0]?.sent).toEqual([`node ${artifacts.cliEntry} add my-app`]);
  });

  it('never sends an injection payload to the terminal', async () => {
    const entry = api.catalog().find((e) => e.path === 'add');
    stubState.inputAnswers.push('foo; rm -rf ~');
    await commands.executeCommand('reShell.runCommandFromTree', entry);
    await new Promise((r) => setTimeout(r, 0));
    expect(stubState.terminals).toHaveLength(0);
    expect(stubState.messages.some((m) => m.level === 'error' && /Unsafe value/.test(m.text))).toBe(true);
  });

  it('asks for confirmation before running a destructive command', async () => {
    const entry = api.catalog().find((e) => e.path === 'config env delete');
    expect(entry?.destructive).toBe(true);

    stubState.inputAnswers.push('staging');
    await commands.executeCommand('reShell.runCommandFromTree', entry);
    await new Promise((r) => setTimeout(r, 0));
    expect(stubState.terminals).toHaveLength(0); // modal dismissed: nothing ran
    expect(stubState.messages.some((m) => m.level === 'warning' && m.actions.includes('Run'))).toBe(true);

    stubState.messages.length = 0;
    stubState.inputAnswers.push('staging');
    stubState.messageChoice = 'Run';
    await commands.executeCommand('reShell.runCommandFromTree', entry);
    await new Promise((r) => setTimeout(r, 0));
    expect(stubState.terminals[0]?.sent).toEqual([`node ${artifacts.cliEntry} config env delete staging`]);
  });
});
