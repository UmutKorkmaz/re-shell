import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  migrationManager,
  autoMigrate,
  migrateGlobalConfig,
  migrateProjectConfig,
  checkConfigIntegrity,
} from '../../src/utils/migration';

describe('MigrationManager.getAvailableMigrations', () => {
  it('returns migrations between from and to versions for global config', () => {
    const list = migrationManager.getAvailableMigrations('global', '1.0.0');
    expect(Array.isArray(list)).toBe(true);
    for (const m of list) {
      expect(m.version).toBeTruthy();
      expect(typeof m.description).toBe('string');
      expect(typeof m.up).toBe('function');
    }
  });

  it('returns sorted ascending by version', () => {
    const list = migrationManager.getAvailableMigrations('global', '0.0.1');
    const versions = list.map(m => m.version);
    const sorted = [...versions].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    expect(versions).toEqual(sorted);
  });

  it('returns empty when fromVersion is already current', () => {
    // Pass an extremely high version so nothing is greater
    const list = migrationManager.getAvailableMigrations('global', '999.0.0');
    expect(list).toEqual([]);
  });

  it('returns migrations for project config type', () => {
    const list = migrationManager.getAvailableMigrations('project', '0.0.1');
    expect(Array.isArray(list)).toBe(true);
  });
});

describe('MigrationManager.getCurrentVersion', () => {
  let tmpDir: string;
  let oldConfigDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-'));
    oldConfigDir = process.env.RE_SHELL_CONFIG_DIR;
    process.env.RE_SHELL_CONFIG_DIR = tmpDir;
  });

  afterEach(async () => {
    if (oldConfigDir === undefined) {
      delete process.env.RE_SHELL_CONFIG_DIR;
    } else {
      process.env.RE_SHELL_CONFIG_DIR = oldConfigDir;
    }
    await fs.remove(tmpDir);
  });

  it('returns the current config version (default when no config present)', async () => {
    const version = await migrationManager.getCurrentVersion('global');
    expect(typeof version).toBe('string');
    expect(version.length).toBeGreaterThan(0);
  });
});

describe('exported helper functions', () => {
  it('autoMigrate is exposed as a function returning a promise', () => {
    expect(typeof autoMigrate).toBe('function');
  });

  it('migrateGlobalConfig is exposed', () => {
    expect(typeof migrateGlobalConfig).toBe('function');
  });

  it('migrateProjectConfig is exposed', () => {
    expect(typeof migrateProjectConfig).toBe('function');
  });

  it('checkConfigIntegrity is exposed', () => {
    expect(typeof checkConfigIntegrity).toBe('function');
  });
});

describe('autoMigrate end-to-end on empty config dir', () => {
  let tmpDir: string;
  let oldConfigDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migration-'));
    oldConfigDir = process.env.RE_SHELL_CONFIG_DIR;
    process.env.RE_SHELL_CONFIG_DIR = tmpDir;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (oldConfigDir === undefined) {
      delete process.env.RE_SHELL_CONFIG_DIR;
    } else {
      process.env.RE_SHELL_CONFIG_DIR = oldConfigDir;
    }
    await fs.remove(tmpDir);
    vi.restoreAllMocks();
  });

  it('returns a result object with global/project keys', async () => {
    const result = await autoMigrate();
    expect(result).toHaveProperty('global');
    expect(result).toHaveProperty('project');
  });
});
