import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { manageWorkspaceConflict } from '../../src/commands/workspace-conflict';
import { ValidationError } from '../../src/utils/error-handler';

// UNIT coverage for src/commands/workspace-conflict.ts — the `workspace-conflict`
// command (detect/resolve/preview/auto-resolve/interactive/default-detect).
// Complements the existing workspace-conflict.test.ts MANAGER suite (PR #137).
// We mock the conflict engine (createWorkspaceConflictManager + detectWorkspaceConflicts
// + autoResolveConflicts) + prompts, use real on-disk temp files for fs.pathExists
// discovery, and no-op process.exit so the catch-block exit(1) gates don't kill the
// runner.

const mocks = vi.hoisted(() => ({
  createWorkspaceConflictManager: vi.fn(),
  detectWorkspaceConflicts: vi.fn(),
  autoResolveConflicts: vi.fn(),
  // manager instance methods
  detectConflicts: vi.fn(),
  resolveConflicts: vi.fn(),
  previewResolution: vi.fn(),
  loadWorkspaceDefinition: vi.fn(),
  saveWorkspaceDefinition: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/workspace-conflict', () => ({
  createWorkspaceConflictManager: mocks.createWorkspaceConflictManager,
  detectWorkspaceConflicts: mocks.detectWorkspaceConflicts,
  autoResolveConflicts: mocks.autoResolveConflicts,
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

const DEFINITION = { version: '2.0.0', name: 'proj', workspaces: {} };
const SUGGESTION = { id: 'r1', description: 'reassign port', riskLevel: 'low', preview: 'b→3001', automatic: true };
const CONFLICT = {
  id: 'c1',
  type: 'port',
  severity: 'error',
  description: 'Port clash on 3000',
  details: 'app-a and app-b both bind 3000',
  affectedWorkspaces: ['app-a', 'app-b'],
  suggestions: [SUGGESTION],
};
const CONFLICTS = [
  CONFLICT,
  {
    id: 'c2',
    type: 'naming',
    severity: 'warning',
    description: 'Non-kebab name',
    details: 'AppA is not kebab-case',
    affectedWorkspaces: ['app-a'],
    suggestions: [],
  },
];

let tmp: string;
let existingFile: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-wcc-'));
  existingFile = path.join(tmp, 're-shell.workspaces.yaml');
  fs.writeFileSync(existingFile, '');
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

function out(): string {
  return [...logSpy.mock.calls, ...errSpy.mock.calls].map(a => a.join(' ')).join('\n');
}
function loggedJson(find: (s: string) => boolean): any {
  return JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(find)!);
}
function spinner() {
  return { setText: vi.fn(), stop: vi.fn(), start: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn() } as any;
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.createWorkspaceConflictManager.mockResolvedValue({
    detectConflicts: mocks.detectConflicts,
    resolveConflicts: mocks.resolveConflicts,
    previewResolution: mocks.previewResolution,
    loadWorkspaceDefinition: mocks.loadWorkspaceDefinition,
    saveWorkspaceDefinition: mocks.saveWorkspaceDefinition,
  });
  mocks.loadWorkspaceDefinition.mockResolvedValue(DEFINITION);
  mocks.detectConflicts.mockResolvedValue(CONFLICTS);
  mocks.detectWorkspaceConflicts.mockResolvedValue(CONFLICTS);
  mocks.autoResolveConflicts.mockResolvedValue({ resolved: [], unresolved: [], changes: [], warnings: [] });
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  exitSpy.mockRestore();
});

describe('workspace-conflict command — detect / default', () => {
  it('reports when no workspace definition is found', async () => {
    await manageWorkspaceConflict({ detect: true, workspaceFile: path.join(tmp, 'missing.yaml') });
    expect(out()).toContain('No workspace definition found');
  });

  it('reports when no conflicts are detected', async () => {
    mocks.detectWorkspaceConflicts.mockResolvedValue([]);
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile });
    expect(out()).toContain('No conflicts detected');
  });

  it('lists conflicts with error/warning/info counts (default grouping)', async () => {
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile });
    const o = out();
    expect(o).toContain('Workspace Conflict Analysis');
    expect(o).toContain('1 errors');
    expect(o).toContain('1 warnings');
    expect(o).toContain('Port clash on 3000');
  });

  it('groups conflicts by type when --groupBy type', async () => {
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile, groupBy: 'type' });
    expect(out()).toContain('PORT (1)');
    expect(out()).toContain('NAMING (1)');
  });

  it('groups conflicts by severity when --groupBy severity', async () => {
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile, groupBy: 'severity' });
    expect(out()).toContain('ERROR (1)');
    expect(out()).toContain('WARNING (1)');
  });

  it('groups conflicts by workspace when --groupBy workspace', async () => {
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile, groupBy: 'workspace' });
    expect(out()).toContain('app-a');
    expect(out()).toContain('app-b');
  });

  it('emits the conflicts as JSON in json mode', async () => {
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile, json: true });
    const json = loggedJson(s => s.trim().startsWith('['));
    expect(json).toHaveLength(2);
    expect(json[0].id).toBe('c1');
  });

  it('shows resolution hints when errors are present', async () => {
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile });
    expect(out()).toContain('Resolution Commands');
    expect(out()).toContain('auto-resolve');
  });
});

describe('workspace-conflict command — resolve', () => {
  it('reports and exits when no conflict id is provided', async () => {
    // The outer catch swallows the ValidationError after logging + exit(1).
    await manageWorkspaceConflict({ resolve: true });
    expect(out()).toContain('Conflict ID is required');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('reports and exits when the conflict id is not found', async () => {
    mocks.detectConflicts.mockResolvedValue(CONFLICTS);
    await manageWorkspaceConflict({ resolve: true, conflictId: 'ghost', resolutionId: 'r1' });
    expect(out()).toContain('Conflict not found: ghost');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('applies the requested resolution and reports success', async () => {
    mocks.resolveConflicts.mockResolvedValue({
      resolved: [CONFLICT],
      changes: [{ target: 'app-b', property: 'port', oldValue: 3000, newValue: 3001, reason: 'reassigned' }],
      warnings: [],
    });
    await manageWorkspaceConflict({ resolve: true, conflictId: 'c1', resolutionId: 'r1' });
    expect(mocks.saveWorkspaceDefinition).toHaveBeenCalled();
    const o = out();
    expect(o).toContain('Conflict resolved successfully');
    expect(o).toContain('3000');
    expect(o).toContain('3001');
  });

  it('reports failure when nothing was resolved', async () => {
    mocks.resolveConflicts.mockResolvedValue({
      resolved: [],
      changes: [],
      warnings: ['risky'],
    });
    await manageWorkspaceConflict({ resolve: true, conflictId: 'c1', resolutionId: 'r1' });
    const o = out();
    expect(o).toContain('Failed to resolve conflict');
    expect(o).toContain('risky');
  });

  it('prompts for a resolution when none is given and no force', async () => {
    mocks.resolveConflicts.mockResolvedValue({ resolved: [CONFLICT], changes: [], warnings: [] });
    mocks.prompts.mockResolvedValue({ resolution: 'r1' });
    await manageWorkspaceConflict({ resolve: true, conflictId: 'c1' });
    expect(mocks.prompts).toHaveBeenCalled();
    expect(mocks.resolveConflicts).toHaveBeenCalled();
  });

  it('auto-selects an automatic resolution under --force', async () => {
    mocks.resolveConflicts.mockResolvedValue({ resolved: [CONFLICT], changes: [], warnings: [] });
    await manageWorkspaceConflict({ resolve: true, conflictId: 'c1', force: true });
    expect(mocks.resolveConflicts).toHaveBeenCalled();
  });
});

describe('workspace-conflict command — preview', () => {
  it('reports and exits when conflict id or resolution id is missing', async () => {
    await manageWorkspaceConflict({ preview: true, conflictId: 'c1' });
    expect(out()).toContain('required for preview');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('renders a successful preview', async () => {
    mocks.previewResolution.mockResolvedValue({
      success: true,
      changes: [{ target: 'app-b', property: 'port', oldValue: 3000, newValue: 3001, reason: 'reassign' }],
      warnings: [],
    });
    await manageWorkspaceConflict({ preview: true, conflictId: 'c1', resolutionId: 'r1' });
    expect(out()).toContain('Preview successful');
  });

  it('renders a failed preview with warnings', async () => {
    mocks.previewResolution.mockResolvedValue({ success: false, changes: [], warnings: ['blocked'] });
    await manageWorkspaceConflict({ preview: true, conflictId: 'c1', resolutionId: 'r1' });
    const o = out();
    expect(o).toContain('Preview failed');
    expect(o).toContain('blocked');
  });

  it('emits the preview as JSON in json mode', async () => {
    mocks.previewResolution.mockResolvedValue({ success: true, changes: [], warnings: [] });
    await manageWorkspaceConflict({ preview: true, conflictId: 'c1', resolutionId: 'r1', json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.success).toBe(true);
  });
});

describe('workspace-conflict command — auto-resolve', () => {
  it('renders resolved and unresolved conflicts', async () => {
    mocks.autoResolveConflicts.mockResolvedValue({
      resolved: [CONFLICT],
      unresolved: [CONFLICTS[1]],
      changes: [],
      warnings: ['note'],
    });
    await manageWorkspaceConflict({ autoResolve: true });
    const o = out();
    expect(o).toContain('Resolved: 1 conflicts');
    expect(o).toContain('Unresolved: 1 conflicts');
    expect(o).toContain('require manual intervention');
  });

  it('emits the auto-resolution result as JSON', async () => {
    mocks.autoResolveConflicts.mockResolvedValue({ resolved: [CONFLICT], unresolved: [], changes: [], warnings: [] });
    await manageWorkspaceConflict({ autoResolve: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.resolved).toHaveLength(1);
  });
});

describe('workspace-conflict command — interactive', () => {
  it('returns early when the action is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageWorkspaceConflict({ interactive: true });
    expect(mocks.autoResolveConflicts).not.toHaveBeenCalled();
  });

  it('dispatches to auto-resolve when the user picks auto-resolve', async () => {
    mocks.autoResolveConflicts.mockResolvedValue({ resolved: [], unresolved: [], changes: [], warnings: [] });
    mocks.prompts.mockResolvedValue({ action: 'auto-resolve' });
    await manageWorkspaceConflict({ interactive: true });
    expect(mocks.autoResolveConflicts).toHaveBeenCalled();
  });
});

describe('workspace-conflict command — error handling', () => {
  it('reports a ValidationError and exits', async () => {
    mocks.detectWorkspaceConflicts.mockRejectedValue(new ValidationError('bad workspace'));
    // Outer catch logs the message + exit(1), then swallows (no rethrow).
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile });
    expect(out()).toContain('bad workspace');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('fails the spinner and exits on a generic error', async () => {
    mocks.detectWorkspaceConflicts.mockRejectedValue(new Error('engine broke'));
    const s = spinner();
    await manageWorkspaceConflict({ detect: true, workspaceFile: existingFile, spinner: s });
    expect(out()).toContain('engine broke');
    expect(s.fail).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
