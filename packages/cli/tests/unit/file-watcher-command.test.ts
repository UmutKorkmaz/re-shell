import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/file-watcher.ts — the `file-watcher` command group
// (start / stop / status / stats / rules / add-rule / remove-rule /
// interactive). startWorkspaceWatcher is mocked to return controllable fake
// watchers so the command layer's state machine (module-level globalWatcher)
// and its renderers are exercised without real FS events.

class FakeWatcher extends EventEmitter {
  isWatching = vi.fn(() => true);
  stopWatching = vi.fn(async () => undefined);
  getStats = vi.fn(() => ({
    watchedPaths: ['/repo/apps/shell', '/repo/packages/ui'],
    activeRules: 2,
    totalEvents: 12,
    propagatedEvents: 5,
    startTime: Date.now() - 90_000,
    uptime: 90_000,
    eventsByType: { change: 8, add: 3, unlink: 1 },
    eventsByWorkspace: { shell: 7, 'ui-kit': 5 },
  }));
  addPropagationRule = vi.fn();
  removePropagationRule = vi.fn(() => true);
  propagationRules = new Map([
    [
      'rule-1',
      {
        id: 'rule-1',
        name: 'Rebuild UI',
        description: 'Rebuild UI workspaces',
        sourcePattern: /packages\/ui\/.*/,
        targetWorkspaces: ['shell'],
        actionType: 'rebuild',
        debounceMs: 500,
      },
    ],
  ]);
}

const mocks = vi.hoisted(() => ({
  prompts: vi.fn(),
  startWorkspaceWatcher: vi.fn(),
}));

vi.mock('../../src/utils/file-watcher', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/file-watcher')>();
  return {
    ...original,
    startWorkspaceWatcher: mocks.startWorkspaceWatcher,
  };
});
vi.mock('prompts', () => ({ default: mocks.prompts }));

// The command keeps a module-level globalWatcher between calls; the module is
// imported once and afterEach stops a running watcher so each test starts
// from a clean state.
const commandModule: typeof import('../../src/commands/file-watcher') =
  await import('../../src/commands/file-watcher');
const manageFileWatcher = commandModule.manageFileWatcher;

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let tempRoot: string;
let workspaceFile: string;

function output(): string {
  return logSpy.mock.calls.map(c => String(c[0])).join('\n');
}

describe('file-watcher — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-fw-'));
    fs.writeFileSync(
      path.join(tempRoot, 're-shell.workspaces.yaml'),
      'workspaces:\n  - name: shell\n    type: frontend\n'
    );
    vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.startWorkspaceWatcher.mockImplementation(
      async () => new FakeWatcher()
    );
    workspaceFile = path.join(tempRoot, 're-shell.workspaces.yaml');
  });

  afterEach(async () => {
    // Stop any watcher the test left running so module state stays clean.
    // Uses human mode: the JSON branch of stopFileWatcher returns BEFORE
    // resetting globalWatcher, so a json stop would leak the watcher into
    // the next test ("already running" cascade).
    try {
      await manageFileWatcher({ stop: true });
    } catch {
      // No watcher running — nothing to clean.
    }
    // Kill the keep-alive interval --follow / interactive start created so
    // vitest's worker can exit.
    vi.clearAllTimers();
    process.removeAllListeners('SIGINT');
    vi.restoreAllMocks();
    fs.removeSync(tempRoot);
  });

  describe('start', () => {
    it('starts the watcher and reports paths and rules', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      const out = output();
      expect(mocks.startWorkspaceWatcher).toHaveBeenCalledTimes(1);
      expect(out).toContain('File watcher started successfully!');
      expect(out).toContain('Watching: 2 paths');
      expect(out).toContain('Active rules: 2');
    });

    it('throws when the workspace file is missing', async () => {
      fs.removeSync(workspaceFile);
      await expect(manageFileWatcher({ start: true })).rejects.toThrow(
        'Workspace file not found'
      );
      expect(mocks.startWorkspaceWatcher).not.toHaveBeenCalled();
    });

    it('emits a JSON envelope with stats', async () => {
      await manageFileWatcher({ start: true, json: true, workspaceFile });
      const payload = JSON.parse(output());
      expect(payload.status).toBe('started');
      expect(payload.stats.totalEvents).toBe(12);
    });

    it('lists watched paths in verbose mode', async () => {
      await manageFileWatcher({ start: true, verbose: true, workspaceFile });
      expect(output()).toContain('/repo/apps/shell');
    });

    it('rejects starting a second watcher while one is running', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      await expect(
        manageFileWatcher({ start: true, workspaceFile })
      ).rejects.toThrow('already running');
    });

    it('prints the follow banner and registers a SIGINT handler with --follow', async () => {
      const onSpy = vi.spyOn(process, 'on');
      vi.useFakeTimers(); // keep-alive setInterval must not hold the worker
      await manageFileWatcher({ start: true, follow: true, workspaceFile });
      vi.useRealTimers();
      expect(output()).toContain('Watching for changes...');
      expect(onSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      vi.useRealTimers();
    });

    it('forwards watch options to startWorkspaceWatcher', async () => {
      await manageFileWatcher({
        start: true,
        workspaceFile,
        usePolling: true,
        interval: 250,
        depth: 3,
        persistent: false,
        ignored: ['**/tmp/**'],
      });
      const [, opts] = mocks.startWorkspaceWatcher.mock.calls[0];
      expect(opts).toEqual(
        expect.objectContaining({
          usePolling: true,
          interval: 250,
          depth: 3,
          persistent: false,
          ignored: ['**/tmp/**'],
        })
      );
    });
  });

  describe('stop', () => {
    it('throws when no watcher is active', async () => {
      await expect(manageFileWatcher({ stop: true })).rejects.toThrow(
        'No active file watcher found'
      );
    });

    it('stops the running watcher and reports final stats', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ stop: true });
      const out = output();
      expect(out).toContain('File watcher stopped successfully!');
      expect(out).toContain('Total events: 12');
      expect(out).toContain('Propagated events: 5');
    });

    it('prints the verbose event breakdown', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ stop: true, verbose: true });
      expect(output()).toContain('change: 8');
    });

    it('emits a JSON envelope with final stats', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ stop: true, json: true });
      const payload = JSON.parse(output());
      expect(payload.status).toBe('stopped');
      expect(payload.finalStats.totalEvents).toBe(12);
    });
  });

  describe('status (default action)', () => {
    it('reports the inactive state', async () => {
      await manageFileWatcher({});
      const out = output();
      expect(out).toContain('File watcher is not running');
      expect(out).toContain('re-shell file-watcher start');
    });

    it('reports the active state with live stats', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ status: true });
      const out = output();
      expect(out).toContain('File watcher is active');
      expect(out).toContain('Status: Running');
      expect(out).toContain('Total events: 12');
    });

    it('emits the active/inactive JSON envelope', async () => {
      await manageFileWatcher({ json: true });
      // NOTE: `globalWatcher && ...` short-circuits to null (not false) when
      // no watcher has ever been started — documented quirk of the status
      // payload.
      expect(JSON.parse(output()).active).toBeFalsy();

      await manageFileWatcher({ start: true, json: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ status: true, json: true });
      expect(JSON.parse(output()).active).toBe(true);
    });
  });

  describe('stats', () => {
    it('throws when no watcher is active', async () => {
      await expect(manageFileWatcher({ stats: true })).rejects.toThrow(
        'No active file watcher found'
      );
    });

    it('renders overview, per-type, per-workspace and performance sections', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ stats: true });
      const out = output();
      expect(out).toContain('File Watcher Statistics');
      expect(out).toContain('Total events: 12');
      expect(out).toContain('Events by type:');
      expect(out).toContain('change: 8 (66.7%)');
      expect(out).toContain('Events by workspace:');
      expect(out).toContain('shell: 7 (58.3%)');
      expect(out).toContain('Performance:');
      expect(out).toContain('Propagation rate: 41.7%');
    });

    it('emits stats as JSON', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ stats: true, json: true });
      expect(JSON.parse(output()).totalEvents).toBe(12);
    });
  });

  describe('rules', () => {
    it('throws when no watcher instance exists', async () => {
      await expect(manageFileWatcher({ rules: true })).rejects.toThrow(
        'No file watcher instance available'
      );
    });

    it('renders configured rules with patterns and actions', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ rules: true });
      const out = output();
      expect(out).toContain('Change Propagation Rules');
      expect(out).toContain('1. Rebuild UI');
      expect(out).toContain('ID: rule-1');
      expect(out).toContain('Action: rebuild');
      expect(out).toContain('Targets: shell');
      expect(out).toContain('Debounce: 500ms');
    });

    it('renders the verbose description', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ rules: true, verbose: true });
      expect(output()).toContain('Description: Rebuild UI workspaces');
    });

    it('reports the empty state when no rules exist', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      const watcher = mocks.startWorkspaceWatcher.mock
        .results[0] as unknown as { value: FakeWatcher };
      watcher.value.propagationRules.clear();
      logSpy.mockClear();
      await manageFileWatcher({ rules: true });
      expect(output()).toContain('No propagation rules configured');
    });
  });

  describe('addRule', () => {
    it('throws when no watcher instance exists', async () => {
      await expect(manageFileWatcher({ addRule: true })).rejects.toThrow(
        'No file watcher instance available'
      );
    });

    it('adds a rule from prompted answers', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      mocks.prompts.mockResolvedValueOnce({
        id: 'rule-2',
        name: 'Test on change',
        description: 'Runs tests',
        pattern: '/src\\/.*\\.test\\.ts/',
        actionType: 'run-tests',
        targetType: 'specific',
        targetWorkspaces: 'shell, checkout',
        debounceMs: 250,
      });
      await manageFileWatcher({ addRule: true });
      const out = output();
      expect(out).toContain('Propagation rule added successfully!');
      expect(out).toContain('Rule ID: rule-2');
      const watcher = mocks.startWorkspaceWatcher.mock
        .results[0] as unknown as { value: FakeWatcher };
      expect(watcher.value.addPropagationRule).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rule-2', actionType: 'run-tests' })
      );
    });

    it('aborts when the prompt is cancelled', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      mocks.prompts.mockResolvedValueOnce({});
      await manageFileWatcher({ addRule: true });
      expect(output()).not.toContain('Propagation rule added');
    });
  });

  describe('removeRule', () => {
    it('throws when no watcher instance exists', async () => {
      await expect(manageFileWatcher({ removeRule: 'rule-1' })).rejects.toThrow(
        'No file watcher instance available'
      );
    });

    it('removes a known rule', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      await manageFileWatcher({ removeRule: 'rule-1' });
      const out = output();
      expect(out).toContain('Propagation rule removed successfully!');
      expect(out).toContain('Removed rule: rule-1');
    });

    it('warns for unknown rules', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      const watcher = mocks.startWorkspaceWatcher.mock
        .results[0] as unknown as { value: FakeWatcher };
      watcher.value.removePropagationRule.mockReturnValueOnce(false);
      logSpy.mockClear();
      await manageFileWatcher({ removeRule: 'ghost' });
      expect(output()).toContain('Rule not found');
    });
  });

  describe('interactive', () => {
    it('dispatches to status from the action prompt', async () => {
      mocks.prompts.mockResolvedValueOnce({ action: 'status' });
      await manageFileWatcher({ interactive: true });
      expect(output()).toContain('File watcher is not running');
    });

    it('dispatches to stats from the action prompt', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      mocks.prompts.mockResolvedValueOnce({ action: 'stats' });
      await manageFileWatcher({ interactive: true });
      expect(output()).toContain('File Watcher Statistics');
    });

    it('dispatches to rules from the action prompt', async () => {
      await manageFileWatcher({ start: true, workspaceFile });
      logSpy.mockClear();
      mocks.prompts.mockResolvedValueOnce({ action: 'rules' });
      await manageFileWatcher({ interactive: true });
      expect(output()).toContain('Change Propagation Rules');
    });

    it('does nothing when the prompt is cancelled', async () => {
      mocks.prompts.mockResolvedValueOnce({});
      await manageFileWatcher({ interactive: true });
      expect(mocks.startWorkspaceWatcher).not.toHaveBeenCalled();
      expect(output()).not.toContain('File watcher started');
    });

    it('starts via the interactive start flow', async () => {
      vi.useFakeTimers(); // prompt answers include follow:true → keep-alive interval
      mocks.prompts
        .mockResolvedValueOnce({ action: 'start' })
        .mockResolvedValueOnce({
          workspaceFile,
          usePolling: false,
          follow: true,
        });
      await manageFileWatcher({ interactive: true });
      expect(mocks.startWorkspaceWatcher).toHaveBeenCalledTimes(1);
      expect(output()).toContain('File watcher started successfully!');
      vi.useRealTimers();
    });

    it('starts with polling options when confirmed', async () => {
      mocks.prompts
        .mockResolvedValueOnce({ action: 'start' })
        .mockResolvedValueOnce({
          workspaceFile,
          usePolling: true,
          interval: 500,
          follow: false,
        });
      await manageFileWatcher({ interactive: true });
      const [, opts] = mocks.startWorkspaceWatcher.mock.calls[0];
      expect(opts.usePolling).toBe(true);
      expect(opts.interval).toBe(500);
    });
  });

  describe('error handling', () => {
    it('fails the spinner and rethrows on start failure', async () => {
      mocks.startWorkspaceWatcher.mockRejectedValueOnce(
        new Error('chokidar exploded')
      );
      const fail = vi.fn();
      await expect(
        manageFileWatcher({
          start: true,
          workspaceFile,
          spinner: { setText: vi.fn(), stop: vi.fn(), fail } as never,
        })
      ).rejects.toThrow('chokidar exploded');
      expect(fail).toHaveBeenCalled();
    });
  });
});
