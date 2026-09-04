import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { manageMigration } from '../../src/commands/migration';

// UNIT coverage for src/commands/migration.ts — the `migration` command
// (NOT utils/migration MigrationManager, covered by the open migration.test.ts
// from PR #225). Named migration-command.test.ts to avoid that collision.
// manageMigration dispatches (auto/check/history/rollback/interactive/global/
// project/default-checkAndPrompt) and delegates to migrationManager + prompts;
// we mock both and spy console.log so every branch is exercised deterministically.

const mocks = vi.hoisted(() => ({
  autoMigrate: vi.fn(),
  migrate: vi.fn(),
  rollback: vi.fn(),
  checkIntegrity: vi.fn(),
  getMigrationHistory: vi.fn(),
  needsMigration: vi.fn(),
  prompts: vi.fn(),
}));

vi.mock('../../src/utils/migration', () => ({
  migrationManager: {
    autoMigrate: mocks.autoMigrate,
    migrate: mocks.migrate,
    rollback: mocks.rollback,
    checkIntegrity: mocks.checkIntegrity,
    getMigrationHistory: mocks.getMigrationHistory,
    needsMigration: mocks.needsMigration,
  },
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

function spinner() {
  return { setText: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() } as any;
}

const OK_RESULT = {
  success: true,
  fromVersion: '1.0.0',
  toVersion: '2.0.0',
  appliedMigrations: ['1.1.0', '2.0.0'],
  warnings: [],
  errors: [],
};
const FAIL_RESULT = { ...OK_RESULT, success: false, errors: ['boom'] };

const OK_CHECK = { valid: true, version: '2.0.0', issues: [], recommendations: [] };
const BAD_CHECK = {
  valid: false,
  version: '1.0.0',
  issues: ['stale field'],
  recommendations: ['run migration'],
};

const HISTORY = {
  currentVersion: '2.0.0',
  availableVersions: ['2.0.0', '1.1.0', '1.0.0'],
  appliedMigrations: ['1.1.0', '2.0.0'],
  pendingMigrations: [],
};

let logSpy: ReturnType<typeof vi.spyOn>;
function logged(): string {
  return logSpy.mock.calls.map(a => a.join(' ')).join('\n');
}
function loggedJson(find: (s: string) => boolean): any {
  return JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(find)!);
}

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('migration — auto', () => {
  it('renders results for both configs when present (human)', async () => {
    mocks.autoMigrate.mockResolvedValue({ global: OK_RESULT, project: OK_RESULT });
    await manageMigration({ auto: true });
    expect(logged()).toContain('1.0.0 → 2.0.0');
    expect(logged()).toContain('Applied migrations');
  });

  it('renders up-to-date notes when a config needs no migration', async () => {
    mocks.autoMigrate.mockResolvedValue({ global: null, project: null });
    await manageMigration({ auto: true });
    expect(logged()).toContain('Global Configuration: Up to date');
    expect(logged()).toContain('Up to date or not found');
  });

  it('emits the results as JSON in json mode', async () => {
    mocks.autoMigrate.mockResolvedValue({ global: OK_RESULT, project: null });
    await manageMigration({ auto: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.global.toVersion).toBe('2.0.0');
    expect(json.project).toBeNull();
  });
});

describe('migration — check', () => {
  it('renders integrity for both configs (valid + issues variants)', async () => {
    mocks.checkIntegrity.mockResolvedValueOnce(OK_CHECK).mockResolvedValueOnce(BAD_CHECK);
    await manageMigration({ check: true });
    const out = logged();
    expect(out).toContain('Status: Valid');
    expect(out).toContain('Issues found');
    expect(out).toContain('stale field');
    expect(out).toContain('run migration');
  });

  it('emits the integrity checks as JSON in json mode', async () => {
    mocks.checkIntegrity.mockResolvedValue(OK_CHECK);
    await manageMigration({ check: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.global.valid).toBe(true);
    expect(json.project.valid).toBe(true);
  });
});

describe('migration — history', () => {
  it('renders applied/pending migrations and the up-to-date status', async () => {
    mocks.getMigrationHistory.mockResolvedValue(HISTORY);
    await manageMigration({ history: true });
    const out = logged();
    expect(out).toContain('Current version: 2.0.0');
    expect(out).toContain('✅ 1.1.0');
    expect(out).toContain('Up to date');
  });

  it('renders pending migrations when present', async () => {
    mocks.getMigrationHistory.mockResolvedValue({ ...HISTORY, pendingMigrations: ['3.0.0'] });
    await manageMigration({ history: true });
    expect(logged()).toContain('⏳ 3.0.0');
  });

  it('emits the history as JSON in json mode', async () => {
    mocks.getMigrationHistory.mockResolvedValue(HISTORY);
    await manageMigration({ history: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.global.currentVersion).toBe('2.0.0');
  });
});

describe('migration — rollback', () => {
  it('rolls back the project config by default and succeeds the spinner', async () => {
    mocks.rollback.mockResolvedValue(OK_RESULT);
    const s = spinner();
    await manageMigration({ rollback: '1.0.0', spinner: s });
    expect(mocks.rollback).toHaveBeenCalledWith('project', '1.0.0');
    expect(s.succeed).toHaveBeenCalled();
    expect(logged()).toContain('Migration successful');
  });

  it('rolls back the global config when --global is set', async () => {
    mocks.rollback.mockResolvedValue(OK_RESULT);
    await manageMigration({ rollback: '1.0.0', global: true });
    expect(mocks.rollback).toHaveBeenCalledWith('global', '1.0.0');
  });

  it('fails the spinner when the rollback result is unsuccessful', async () => {
    mocks.rollback.mockResolvedValue(FAIL_RESULT);
    const s = spinner();
    await manageMigration({ rollback: '1.0.0', spinner: s });
    expect(s.fail).toHaveBeenCalled();
    expect(logged()).toContain('Migration failed');
  });

  it('emits the rollback result as JSON in json mode', async () => {
    mocks.rollback.mockResolvedValue(OK_RESULT);
    await manageMigration({ rollback: '1.0.0', json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.success).toBe(true);
  });
});

describe('migration — global / project migrate', () => {
  it('migrates the global config and succeeds the spinner', async () => {
    mocks.migrate.mockResolvedValue(OK_RESULT);
    const s = spinner();
    await manageMigration({ global: true, spinner: s });
    expect(mocks.migrate).toHaveBeenCalledWith('global');
    expect(s.succeed).toHaveBeenCalled();
  });

  it('fails the spinner when project migration is unsuccessful', async () => {
    mocks.migrate.mockResolvedValue(FAIL_RESULT);
    const s = spinner();
    await manageMigration({ project: true, spinner: s });
    expect(mocks.migrate).toHaveBeenCalledWith('project');
    expect(s.fail).toHaveBeenCalled();
  });
});

describe('migration — default (checkAndPrompt)', () => {
  it('reports up-to-date when neither config needs migration', async () => {
    mocks.needsMigration.mockResolvedValue(false);
    await manageMigration({});
    expect(logged()).toContain('All configurations are up to date');
    expect(mocks.prompts).not.toHaveBeenCalled();
  });

  it('runs autoMigrate without prompting when --force is set', async () => {
    mocks.needsMigration.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mocks.autoMigrate.mockResolvedValue({ global: OK_RESULT, project: null });
    await manageMigration({ force: true });
    expect(mocks.prompts).not.toHaveBeenCalled();
    expect(mocks.autoMigrate).toHaveBeenCalled();
    expect(logged()).toContain('migration required');
  });

  it('cancels when the confirmation prompt is declined', async () => {
    mocks.needsMigration.mockResolvedValue(true);
    mocks.prompts.mockResolvedValue({ migrate: false });
    await manageMigration({});
    expect(logged()).toContain('Migration cancelled');
    expect(mocks.autoMigrate).not.toHaveBeenCalled();
  });

  it('runs autoMigrate when the confirmation prompt is accepted', async () => {
    mocks.needsMigration.mockResolvedValue(true);
    mocks.prompts.mockResolvedValue({ migrate: true });
    mocks.autoMigrate.mockResolvedValue({ global: OK_RESULT, project: null });
    await manageMigration({});
    expect(mocks.autoMigrate).toHaveBeenCalled();
  });
});

describe('migration — interactive', () => {
  it('dispatches to check when the user picks "check"', async () => {
    mocks.prompts.mockResolvedValue({ action: 'check' });
    mocks.checkIntegrity.mockResolvedValue(OK_CHECK);
    await manageMigration({ interactive: true });
    expect(mocks.checkIntegrity).toHaveBeenCalled();
    expect(logged()).toContain('Migration Status Check');
  });

  it('dispatches to history when the user picks "history"', async () => {
    mocks.prompts.mockResolvedValue({ action: 'history' });
    mocks.getMigrationHistory.mockResolvedValue(HISTORY);
    await manageMigration({ interactive: true });
    expect(logged()).toContain('Migration History');
  });

  it('shows the advanced-options "coming soon" notice for the "advanced" action', async () => {
    mocks.prompts.mockResolvedValue({ action: 'advanced' });
    await manageMigration({ interactive: true });
    const out = logged();
    expect(out).toContain('coming soon');
    expect(out).toContain('Planned features');
  });

  it('returns early when the interactive prompt is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageMigration({ interactive: true });
    expect(mocks.autoMigrate).not.toHaveBeenCalled();
  });
});

describe('migration — error handling', () => {
  it('fails the spinner and rethrows when an operation rejects', async () => {
    mocks.migrate.mockRejectedValue(new Error('disk full'));
    const s = spinner();
    await expect(manageMigration({ project: true, spinner: s })).rejects.toThrow('disk full');
    expect(s.fail).toHaveBeenCalled();
  });
});
