import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  WorkspaceMigrationManager,
  createWorkspaceMigrationManager,
  checkForUpgrades,
  validateWorkspace,
  type MigrationPlan,
} from '../../src/utils/workspace-migration';
import { ValidationError } from '../../src/utils/error-handler';

// Minimal valid workspace definition. Built as an untyped object because the
// full WorkspaceDefinition interface is large; the manager only reads/writes it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDefinition(overrides: Record<string, unknown> = {}): any {
  return {
    version: '1.0.0',
    name: 'myws',
    root: '.',
    patterns: ['apps/*'],
    types: { app: { name: 'Application', framework: 'react' } },
    workspaces: {
      web: { name: 'web', type: 'app', path: 'apps/web' },
    },
    dependencies: {},
    build: { parallel: true, cache: true },
    ...overrides,
  };
}

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-migration-'));
});

afterEach(() => {
  fs.removeSync(tmp);
});

async function writeWorkspaceFile(
  def: Record<string, unknown>,
): Promise<string> {
  const file = path.join(tmp, 'workspace.yaml');
  await fs.writeFile(file, yaml.stringify(def), 'utf8');
  return file;
}

async function readWorkspaceVersion(file: string): Promise<string> {
  const content = await fs.readFile(file, 'utf8');
  return (yaml.parse(content) as { version: string }).version;
}

describe('createWorkspaceMigrationManager / constructor', () => {
  it('creates a manager with a custom root path', async () => {
    const manager = await createWorkspaceMigrationManager(tmp);
    expect(manager).toBeInstanceOf(WorkspaceMigrationManager);
  });

  it('defaults rootPath to the current working directory when omitted', () => {
    const manager = new WorkspaceMigrationManager();
    expect((manager as unknown as { rootPath: string }).rootPath).toBe(
      process.cwd(),
    );
  });
});

describe('createMigrationPlan', () => {
  it('throws ValidationError on an invalid version format', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    await expect(manager.createMigrationPlan('nope', '1.0.0')).rejects.toThrow(
      ValidationError,
    );
    await expect(
      manager.createMigrationPlan('1.0.0', 'nope'),
    ).rejects.toThrow(/Invalid version format/);
  });

  it('throws ValidationError when the target is not higher than the current', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    await expect(manager.createMigrationPlan('1.1.0', '1.0.0')).rejects.toThrow(
      /Target version must be higher/,
    );
    await expect(manager.createMigrationPlan('1.0.0', '1.0.0')).rejects.toThrow(
      ValidationError,
    );
  });

  it('builds a single generic step for an adjacent patch bump with no backup required', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const plan = await manager.createMigrationPlan('1.0.0', '1.0.1');
    expect(plan.currentVersion).toBe('1.0.0');
    expect(plan.targetVersion).toBe('1.0.1');
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].id).toBe('1.0.0-to-1.0.1');
    expect(plan.hasBreakingChanges).toBe(false);
    expect(plan.backupRequired).toBe(false);
    expect(plan.estimatedDuration).toBe(30);
  });

  it('walks multiple steps and requires a backup for a multi-step plan', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    // getNextVersion always picks the lowest compatible <= target, so this path
    // goes 1.0.0 -> 1.0.1 -> 1.0.2 -> 1.1.0 (3 generic steps).
    const plan = await manager.createMigrationPlan('1.0.0', '1.1.0');
    expect(plan.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.backupRequired).toBe(true);
    expect(plan.hasBreakingChanges).toBe(false);
    expect(plan.estimatedDuration).toBe(plan.steps.length * 30);
  });

  it('flags breaking changes and a required backup when crossing a major boundary', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const plan = await manager.createMigrationPlan('1.1.0', '2.0.0');
    expect(plan.hasBreakingChanges).toBe(true);
    expect(plan.backupRequired).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(0);
    // The generic step crossing into 2.x is breaking.
    expect(plan.steps.some((s) => s.breaking)).toBe(true);
  });
});

describe('checkUpgrades', () => {
  it('lists available, recommended (minor), and breaking upgrades', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.checkUpgrades('1.0.0');
    expect(result.available).toEqual(['1.0.1', '1.0.2', '1.1.0']);
    expect(result.recommended).toBe('1.1.0');
    expect(result.breaking).toEqual([]);
  });

  it('reports major-bump targets as breaking', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.checkUpgrades('1.1.1');
    expect(result.available).toContain('2.0.0');
    expect(result.breaking).toEqual(['2.0.0']);
    expect(result.recommended).toBe('1.2.0');
  });

  it('returns empty available / undefined recommended for an unknown version', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.checkUpgrades('0.0.1');
    expect(result.available).toEqual([]);
    expect(result.breaking).toEqual([]);
    expect(result.recommended).toBeUndefined();
  });
});

describe('validateDefinition', () => {
  it('accepts a valid definition', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.validateDefinition(makeDefinition());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports an invalid version and missing name', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.validateDefinition(
      makeDefinition({ version: 'bad', name: '' }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining(['Invalid version format', 'Workspace name is required']));
  });

  it('warns when no workspaces are defined', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.validateDefinition(makeDefinition({ workspaces: {} }));
    expect(result.warnings).toContain('No workspaces defined');
  });

  it('errors when a workspace is missing a type or references an undefined type', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.validateDefinition(
      makeDefinition({
        workspaces: {
          web: { name: 'web', type: 'app', path: 'apps/web' },
          api: { name: 'api', path: 'apps/api' }, // missing type
          svc: { name: 'svc', type: 'service', path: 'apps/svc' }, // undefined type
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Workspace 'api' missing type");
    expect(result.errors).toContain(
      "Workspace 'svc' references undefined type 'service'",
    );
  });

  it('warns when a workspace is missing a path', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.validateDefinition(
      makeDefinition({ workspaces: { web: { name: 'web', type: 'app' } } }),
    );
    expect(result.warnings).toContain("Workspace 'web' missing path");
  });

  it('errors on dependencies for unknown workspaces or referencing unknown deps', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.validateDefinition(
      makeDefinition({
        dependencies: {
          ghost: [{ name: 'web', type: 'build' }], // unknown owner
          web: [{ name: 'api', type: 'build' }], // unknown dependency target
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Dependencies defined for unknown workspace 'ghost'",
    );
    expect(result.errors).toContain(
      "Workspace 'web' depends on unknown workspace 'api'",
    );
  });

  it('suggests adding a description and common scripts', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const result = await manager.validateDefinition(
      makeDefinition({ description: undefined, scripts: {} }),
    );
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        'Consider adding a workspace description',
        'Consider defining common scripts',
      ]),
    );
  });
});

describe('executeMigration', () => {
  it('does not modify the file in a dry run and marks steps as DRY-RUN', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const file = await writeWorkspaceFile(makeDefinition());
    const plan = await manager.createMigrationPlan('1.0.0', '1.0.1');
    const result = await manager.executeMigration(file, plan, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toEqual(['[DRY-RUN] 1.0.0-to-1.0.1']);
    // File version unchanged.
    expect(await readWorkspaceVersion(file)).toBe('1.0.0');
  });

  it('applies the migration and persists the target version to the file', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const file = await writeWorkspaceFile(makeDefinition());
    const plan = await manager.createMigrationPlan('1.0.0', '1.0.1');
    const result = await manager.executeMigration(file, plan);
    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toEqual(['1.0.0-to-1.0.1']);
    expect(result.fromVersion).toBe('1.0.0');
    expect(result.toVersion).toBe('1.0.1');
    expect(await readWorkspaceVersion(file)).toBe('1.0.1');
  });

  it('records a failed step in errors and reports success=false', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const file = await writeWorkspaceFile(makeDefinition());
    const plan: MigrationPlan = {
      currentVersion: '1.0.0',
      targetVersion: '1.0.1',
      hasBreakingChanges: false,
      backupRequired: false,
      estimatedDuration: 30,
      steps: [
        {
          id: 'boom',
          name: 'boom',
          description: 'd',
          fromVersion: '1.0.0',
          toVersion: '1.0.1',
          breaking: false,
          execute: async () => {
            throw new Error('kaboom');
          },
        },
      ],
    };
    const result = await manager.executeMigration(file, plan);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('kaboom'))).toBe(true);
  });

  it('aborts when pre-migration validation fails', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const file = await writeWorkspaceFile(makeDefinition());
    const plan: MigrationPlan = {
      currentVersion: '1.0.0',
      targetVersion: '1.0.1',
      hasBreakingChanges: false,
      backupRequired: false,
      estimatedDuration: 30,
      steps: [
        {
          id: 'vstep',
          name: 'vstep',
          description: 'd',
          fromVersion: '1.0.0',
          toVersion: '1.0.1',
          breaking: false,
          validate: async () => ({
            valid: false,
            errors: ['nope'],
            warnings: [],
            suggestions: [],
          }),
          execute: async (d) => d,
        },
      ],
    };
    const result = await manager.executeMigration(file, plan);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Pre-migration validation failed'))).toBe(true);
  });

  it('skips validation when skipValidation is set', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const file = await writeWorkspaceFile(makeDefinition());
    const plan: MigrationPlan = {
      currentVersion: '1.0.0',
      targetVersion: '1.0.1',
      hasBreakingChanges: false,
      backupRequired: false,
      estimatedDuration: 30,
      steps: [
        {
          id: 'vstep',
          name: 'vstep',
          description: 'd',
          fromVersion: '1.0.0',
          toVersion: '1.0.1',
          breaking: false,
          validate: async () => ({
            valid: false,
            errors: ['nope'],
            warnings: [],
            suggestions: [],
          }),
          execute: async (d) => {
            d.version = '1.0.1';
            return d;
          },
        },
      ],
    };
    const result = await manager.executeMigration(file, plan, {
      skipValidation: true,
    });
    expect(result.success).toBe(true);
    expect(result.stepsExecuted).toEqual(['vstep']);
  });
});

describe('getMigrationHistory / recordMigration', () => {
  it('returns an empty history when no history file exists', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    const history = await manager.getMigrationHistory(path.join(tmp, 'ws.yaml'));
    expect(history.migrations).toEqual([]);
  });

  it('returns an empty history when the file is corrupted', async () => {
    const historyFile = path.join(tmp, '.re-shell', 'migration-history.json');
    await fs.ensureDir(path.dirname(historyFile));
    await fs.writeFile(historyFile, '{ not valid json');
    const manager = new WorkspaceMigrationManager(tmp);
    const history = await manager.getMigrationHistory(path.join(tmp, 'ws.yaml'));
    expect(history.migrations).toEqual([]);
  });

  it('records a migration and reads it back', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    await manager.recordMigration('1.0.0', '1.0.1', 'bk-1');
    const history = await manager.getMigrationHistory(path.join(tmp, 'ws.yaml'));
    expect(history.migrations).toHaveLength(1);
    expect(history.migrations[0]).toMatchObject({
      fromVersion: '1.0.0',
      toVersion: '1.0.1',
      backupId: 'bk-1',
    });
    expect(typeof history.migrations[0].date).toBe('string');
  });

  it('appends to an existing history', async () => {
    const manager = new WorkspaceMigrationManager(tmp);
    await manager.recordMigration('1.0.0', '1.0.1');
    await manager.recordMigration('1.0.1', '1.1.0');
    const history = await manager.getMigrationHistory(path.join(tmp, 'ws.yaml'));
    expect(history.migrations).toHaveLength(2);
  });
});

describe('checkForUpgrades / validateWorkspace (file-based helpers)', () => {
  it('checkForUpgrades reads the file and reports upgrades', async () => {
    const file = await writeWorkspaceFile(makeDefinition({ version: '1.0.0' }));
    const result = await checkForUpgrades(file);
    expect(result.currentVersion).toBe('1.0.0');
    expect(result.available).toEqual(['1.0.1', '1.0.2', '1.1.0']);
    expect(result.recommended).toBe('1.1.0');
  });

  it('validateWorkspace reads the file and returns the validation result', async () => {
    const file = await writeWorkspaceFile(makeDefinition());
    const result = await validateWorkspace(file);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validateWorkspace reports errors for an invalid definition on disk', async () => {
    const file = await writeWorkspaceFile(makeDefinition({ name: '' }));
    const result = await validateWorkspace(file);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Workspace name is required');
  });
});
