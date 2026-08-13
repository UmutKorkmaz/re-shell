import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { manageWorkspaceDefinition } from '../../src/commands/workspace-definition';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/workspace-definition.ts — the `workspace-def` command
// (init/validate/auto-detect/structure/fix/interactive/default-status). We mock
// workspace-schema (load/save/createDefault + WorkspaceSchemaValidator) and
// prompts, use real on-disk temp files so fs.pathExists config discovery works,
// and no-op process.exit so the exit(1) gates don't kill the runner.

const mocks = vi.hoisted(() => ({
  loadWorkspaceDefinition: vi.fn(),
  saveWorkspaceDefinition: vi.fn(),
  createDefaultWorkspaceDefinition: vi.fn(),
  validateDefinition: vi.fn(),
  validateWorkspaceStructure: vi.fn(),
  autoDetectWorkspaces: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/workspace-schema', () => ({
  loadWorkspaceDefinition: mocks.loadWorkspaceDefinition,
  saveWorkspaceDefinition: mocks.saveWorkspaceDefinition,
  createDefaultWorkspaceDefinition: mocks.createDefaultWorkspaceDefinition,
  WorkspaceSchemaValidator: vi.fn(() => ({
    validateDefinition: mocks.validateDefinition,
    validateWorkspaceStructure: mocks.validateWorkspaceStructure,
    autoDetectWorkspaces: mocks.autoDetectWorkspaces,
  })),
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

const DEF = {
  version: '2.0.0',
  name: 'proj',
  description: 'a project',
  workspaces: { app1: { name: 'app1', type: 'app', path: 'apps/app1' } },
  types: { app: {} },
  patterns: ['apps/*'],
};
const VALID_RESULT = { valid: true, errors: [], warnings: [], suggestions: [] };

let tmp: string;
let existingFile: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-wsd-'));
  existingFile = path.join(tmp, 'exists.yaml');
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

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.createDefaultWorkspaceDefinition.mockReturnValue(DEF);
  mocks.saveWorkspaceDefinition.mockResolvedValue(undefined);
  mocks.loadWorkspaceDefinition.mockResolvedValue(DEF);
  mocks.validateDefinition.mockResolvedValue(VALID_RESULT);
  mocks.validateWorkspaceStructure.mockResolvedValue(VALID_RESULT);
  mocks.autoDetectWorkspaces.mockResolvedValue([]);
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  exitSpy.mockRestore();
});

describe('workspace-definition — default status', () => {
  it('reports when no workspace definition file is found', async () => {
    await manageWorkspaceDefinition({ file: path.join(tmp, 'missing.yaml') });
    expect(out()).toContain('No workspace definition found');
    expect(mocks.loadWorkspaceDefinition).not.toHaveBeenCalled();
  });

  it('renders the definition status when the file exists (human)', async () => {
    await manageWorkspaceDefinition({ file: existingFile });
    const o = out();
    expect(o).toContain('Workspace Definition Status');
    expect(o).toContain('Name: proj');
    expect(o).toContain('Definition:'); // ✅ Valid line
    expect(o).toContain('Structure:');
  });

  it('emits the status as JSON in json mode', async () => {
    await manageWorkspaceDefinition({ file: existingFile, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.file).toBe(existingFile);
    expect(json.workspaces).toBe(1);
    expect(json.definition.valid).toBe(true);
  });
});

describe('workspace-definition — init', () => {
  it('initializes a new definition and saves it', async () => {
    mocks.prompts.mockResolvedValue({ name: 'myproj', description: 'desc' });
    await manageWorkspaceDefinition({ output: path.join(tmp, 'new.yaml'), init: true });
    expect(mocks.createDefaultWorkspaceDefinition).toHaveBeenCalled();
    expect(mocks.saveWorkspaceDefinition).toHaveBeenCalledTimes(1);
    expect(out()).toContain('Workspace definition created');
  });

  it('cancels initialization when the file exists and overwrite is declined', async () => {
    mocks.prompts.mockResolvedValue({ overwrite: false });
    await manageWorkspaceDefinition({ output: existingFile, init: true });
    expect(mocks.saveWorkspaceDefinition).not.toHaveBeenCalled();
    expect(out()).toContain('Initialization cancelled');
  });

  it('prints a dry-run preview without prompting or saving', async () => {
    await manageWorkspaceDefinition({ output: path.join(tmp, 'preview.yaml'), init: true, dryRun: true });
    expect(mocks.prompts).not.toHaveBeenCalled();
    expect(mocks.saveWorkspaceDefinition).not.toHaveBeenCalled();
    expect(out()).toContain('Workspace Definition Preview');
  });
});

describe('workspace-definition — validate', () => {
  it('validates and reports a valid definition', async () => {
    await manageWorkspaceDefinition({ file: existingFile, validate: true });
    expect(out()).toContain('is valid');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('reports errors and exits 1 when the definition is invalid', async () => {
    mocks.validateDefinition.mockResolvedValue({
      valid: false,
      errors: [{ message: 'bad name', path: 'name' }],
      warnings: [],
      suggestions: [],
    });
    await manageWorkspaceDefinition({ file: existingFile, validate: true });
    expect(out()).toContain('Errors (1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('emits the validation result as JSON', async () => {
    await manageWorkspaceDefinition({ file: existingFile, validate: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.valid).toBe(true);
  });
});

describe('workspace-definition — structure', () => {
  it('validates workspace structure and reports validity', async () => {
    await manageWorkspaceDefinition({ file: existingFile, structure: true });
    const o = out();
    expect(o).toContain('Workspace Structure Validation');
    expect(o).toContain('is valid');
  });
});

describe('workspace-definition — auto-detect', () => {
  it('reports when auto-detection finds no workspaces', async () => {
    await manageWorkspaceDefinition({ file: existingFile, autoDetect: true });
    expect(out()).toContain('No workspaces detected');
  });

  it('lists detected workspaces in dry-run mode without saving', async () => {
    mocks.autoDetectWorkspaces.mockResolvedValue([
      { name: 'web', type: 'app', path: 'apps/web', description: 'frontend', tags: ['ui'] },
    ]);
    await manageWorkspaceDefinition({ file: existingFile, autoDetect: true, dryRun: true });
    const o = out();
    expect(o).toContain('Auto-Detected Workspaces (1)');
    expect(o).toContain('web');
    expect(o).toContain('Dry run');
    expect(mocks.saveWorkspaceDefinition).not.toHaveBeenCalled();
  });

  it('merges detected workspaces when --merge is confirmed', async () => {
    mocks.autoDetectWorkspaces.mockResolvedValue([{ name: 'web', type: 'app', path: 'apps/web' }]);
    mocks.prompts.mockResolvedValue({ merge: true });
    await manageWorkspaceDefinition({ file: existingFile, autoDetect: true, merge: true });
    expect(mocks.saveWorkspaceDefinition).toHaveBeenCalledTimes(1);
    expect(out()).toContain('Merged 1 workspaces');
  });
});

describe('workspace-definition — fix', () => {
  it('reports no fixes needed when the definition is valid with no suggestions', async () => {
    await manageWorkspaceDefinition({ file: existingFile, fix: true });
    expect(out()).toContain('No fixes needed');
  });

  it('lists auto-fixable suggestions and dry-runs the apply', async () => {
    mocks.validateDefinition.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [{ message: 'add field', path: 'name', fix: 'set name' }],
    });
    await manageWorkspaceDefinition({ file: existingFile, fix: true, dryRun: true });
    const o = out();
    expect(o).toContain('Available Fixes');
    expect(o).toContain('set name');
    expect(o).toContain('Dry run');
  });
});

describe('workspace-definition — interactive', () => {
  it('returns early when the interactive action is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageWorkspaceDefinition({ file: existingFile, interactive: true });
    expect(mocks.loadWorkspaceDefinition).not.toHaveBeenCalled();
  });

  it('dispatches to status when the user picks status', async () => {
    mocks.prompts.mockResolvedValue({ action: 'status' });
    await manageWorkspaceDefinition({ file: existingFile, interactive: true });
    expect(out()).toContain('Workspace Definition Status');
  });
});

describe('workspace-definition — error handling', () => {
  it('reports a missing definition and exits when load throws a ValidationError', async () => {
    mocks.loadWorkspaceDefinition.mockRejectedValue(new ValidationError('missing'));
    await manageWorkspaceDefinition({ file: existingFile });
    expect(out()).toContain('No workspace definition found');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs a generic error and exits when status load fails', async () => {
    mocks.loadWorkspaceDefinition.mockRejectedValue(new Error('parse failed'));
    await manageWorkspaceDefinition({ file: existingFile });
    expect(out()).toContain('parse failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
