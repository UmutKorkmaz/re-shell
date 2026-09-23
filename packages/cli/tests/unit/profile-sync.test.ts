import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import prompts from 'prompts';
import { loadProfileConfig, saveProfileConfig } from '../../src/commands/profile';
import type { EnvironmentProfile } from '../../src/commands/profile';
import {
  exportProfiles,
  importProfiles,
  syncProfilesLocal,
  showSyncStatus,
  resolveConflicts,
} from '../../src/commands/profile-sync';

// Covers src/commands/profile-sync.ts (605 lines, 6 exports) against a REAL
// temp cwd: export (YAML + .meta.json sidecars, overwrite prompts), import
// (conflict strategies local/remote/merge/manual incl. interactive prompt
// choices), local sync (export → merge-import round-trip), status rendering
// (sync dir, metadata, git state) and interactive conflict resolution.
// Only prompts is mocked; all file round-trips are real. syncProfilesGit is
// not driven directly — its git plumbing needs a remote; the local+status
// surface exercises the same export/import core it composes.

vi.mock('prompts', () => ({ default: vi.fn() }));
const promptsMock = vi.mocked(prompts);

const SYNC_DIR = '.re-shell/sync';
const SYNC_METADATA_FILE = '.re-shell/sync-metadata.json';

let tempRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

function profile(name: string, overrides: Partial<EnvironmentProfile> = {}): EnvironmentProfile {
  return {
    name,
    description: `${name} profile`,
    environment: 'development',
    config: { dev: { port: 3000 } },
    ...overrides,
  };
}

async function stageProfiles(...profiles: EnvironmentProfile[]): Promise<void> {
  const config = await loadProfileConfig();
  for (const p of profiles) {
    config.profiles[p.name] = p;
  }
  await saveProfileConfig(config);
}

/** Write a profile YAML into a source directory for import tests. */
async function seedImportFile(dir: string, p: EnvironmentProfile): Promise<void> {
  await fs.ensureDir(dir);
  await fs.writeFile(path.join(dir, `${p.name}.yaml`), yaml.stringify(p), 'utf8');
}

async function readProfile(name: string): Promise<EnvironmentProfile> {
  const config = await loadProfileConfig();
  return config.profiles[name];
}

/** Write sync metadata, creating the .re-shell dir if needed. */
async function writeMetadata(metadata: Record<string, unknown>): Promise<void> {
  await fs.ensureDir(path.join(tempRoot, '.re-shell'));
  await fs.writeJson(path.join(tempRoot, SYNC_METADATA_FILE), metadata);
}

beforeEach(() => {
  vi.clearAllMocks();
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-psync-'));
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  // Seed an empty profile store so loadProfileConfig/saveProfileConfig work.
  fs.writeFileSync(
    path.join(tempRoot, 're-shell.profiles.yaml'),
    yaml.stringify({ profiles: {} }),
    'utf8'
  );
});

afterEach(() => {
  cwdSpy.mockRestore();
  vi.restoreAllMocks();
  fs.removeSync(tempRoot);
});

describe('exportProfiles', () => {
  it('warns when there are no profiles to export', async () => {
    await exportProfiles();
    expect(output()).toContain('No profiles to export');
  });

  it('writes every profile as YAML and reports the location', async () => {
    await stageProfiles(profile('dev'), profile('prod', { environment: 'production' }));

    await exportProfiles();

    const dir = path.join(tempRoot, SYNC_DIR, 'profiles');
    expect(await fs.pathExists(path.join(dir, 'dev.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'prod.yaml'))).toBe(true);

    const stored = yaml.parse(await fs.readFile(path.join(dir, 'dev.yaml'), 'utf8'));
    expect(stored.name).toBe('dev');

    const text = output();
    expect(text).toContain('Exporting 2 profile(s)');
    expect(text).toContain('✓ Exported dev');
    expect(text).toContain('✓ Exported prod');
    expect(text).toContain('Successfully exported 2/2 profile(s)');
    expect(text).toContain(dir);
  });

  it('exports only the requested profiles and skips unknown names', async () => {
    await stageProfiles(profile('dev'), profile('prod'));

    await exportProfiles(['dev', 'ghost']);

    const dir = path.join(tempRoot, SYNC_DIR, 'profiles');
    expect(await fs.pathExists(path.join(dir, 'dev.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'prod.yaml'))).toBe(false);
    const text = output();
    expect(text).toContain('Profile "ghost" not found, skipping');
    expect(text).toContain('Successfully exported 1/2 profile(s)');
  });

  it('writes .meta.json sidecars with a content hash when includeMetadata is set', async () => {
    await stageProfiles(profile('dev'));

    await exportProfiles(['dev'], { includeMetadata: true });

    const meta = await fs.readJson(path.join(tempRoot, SYNC_DIR, 'profiles', 'dev.meta.json'));
    expect(meta.profileName).toBe('dev');
    expect(meta.environment).toBe('development');
    expect(meta.exportedBy).toBe(process.env.USER || 'unknown');
    expect(meta.profileHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('prompts on re-export of unchanged content because hashes never match', async () => {
    // QUIRK: the conflict check hashes the on-disk YAML bytes but compares them
    // against sha256(JSON.stringify(profile)) — YAML serialization can never
    // equal the JSON form, so every re-export of an existing file is treated as
    // "local changes" and prompts (unless includeMetadata is set).
    await stageProfiles(profile('dev'));

    await exportProfiles(['dev']);
    promptsMock.mockReset();
    promptsMock.mockResolvedValue({ value: true } as never);

    await exportProfiles(['dev']);

    expect(promptsMock).toHaveBeenCalledTimes(1);
    expect(output()).toContain('Profile "dev" has local changes');
  });

  it('prompts before overwriting changed files and honours a decline', async () => {
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));
    await exportProfiles(['dev']);

    // Change the profile so the on-disk export is now stale.
    await stageProfiles(profile('dev', { config: { dev: { port: 9999 } } }));
    promptsMock.mockResolvedValueOnce({ value: false } as never);

    await exportProfiles(['dev']);

    const text = output();
    expect(text).toContain('Profile "dev" has local changes');
    expect(text).toContain('Skipped dev');

    const onDisk = yaml.parse(
      await fs.readFile(path.join(tempRoot, SYNC_DIR, 'profiles', 'dev.yaml'), 'utf8')
    );
    expect(onDisk.config.dev.port).toBe(3000);
  });

  it('overwrites changed files when the prompt is accepted', async () => {
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));
    await exportProfiles(['dev']);

    await stageProfiles(profile('dev', { config: { dev: { port: 9999 } } }));
    promptsMock.mockResolvedValueOnce({ value: true } as never);

    await exportProfiles(['dev']);

    const onDisk = yaml.parse(
      await fs.readFile(path.join(tempRoot, SYNC_DIR, 'profiles', 'dev.yaml'), 'utf8')
    );
    expect(onDisk.config.dev.port).toBe(9999);
  });

  it('skips the prompt entirely when includeMetadata is set on a changed file', async () => {
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));
    await exportProfiles(['dev']);

    await stageProfiles(profile('dev', { config: { dev: { port: 9999 } } }));

    await exportProfiles(['dev'], { includeMetadata: true });

    expect(promptsMock).not.toHaveBeenCalled();
    const onDisk = yaml.parse(
      await fs.readFile(path.join(tempRoot, SYNC_DIR, 'profiles', 'dev.yaml'), 'utf8')
    );
    expect(onDisk.config.dev.port).toBe(9999);
  });
});

describe('importProfiles', () => {
  it('fails with a notice when the source directory is missing', async () => {
    await importProfiles(path.join(tempRoot, 'nowhere'));
    expect(output()).toContain('Source directory not found');
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it('warns when the directory holds no profile YAML files', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await fs.ensureDir(dir);
    await fs.writeFile(path.join(dir, 'readme.txt'), 'hi', 'utf8');

    await importProfiles(dir);

    expect(output()).toContain('No profile files found to import');
  });

  it('imports new profiles without prompting', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('staging'));

    await importProfiles(dir);

    expect(promptsMock).not.toHaveBeenCalled();
    expect((await readProfile('staging')).description).toBe('staging profile');
    const text = output();
    expect(text).toContain('Importing 1 profile(s)');
    expect(text).toContain('✓ Imported staging');
    expect(text).toContain('Import complete: 1 imported, 0 skipped');
  });

  it('re-imports identical profiles without a conflict', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('staging'));
    await stageProfiles(profile('staging'));

    await importProfiles(dir);

    expect(promptsMock).not.toHaveBeenCalled();
    expect(output()).toContain('Import complete: 1 imported, 0 skipped');
  });

  it('asks how to resolve a modified profile in manual mode and keeps local', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('dev', { config: { dev: { port: 8080 } } }));
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));

    promptsMock.mockResolvedValueOnce({ value: 'local' } as never);
    await importProfiles(dir);

    const text = output();
    expect(text).toContain('Conflict detected for profile "dev"');
    expect(text).toContain('Kept local dev');
    expect(text).toContain('Import complete: 0 imported, 1 skipped');
    expect(text).toContain('Conflicts resolved: 1');
    expect((await readProfile('dev')).config.dev?.port).toBe(3000);
  });

  it('manual mode: takes the remote version when chosen', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('dev', { config: { dev: { port: 8080 } } }));
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));

    promptsMock.mockResolvedValueOnce({ value: 'remote' } as never);
    await importProfiles(dir);

    expect(output()).toContain('✓ Imported dev (remote)');
    expect((await readProfile('dev')).config.dev?.port).toBe(8080);
  });

  it('manual mode: merges both versions when chosen', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(
      dir,
      profile('dev', {
        description: 'remote desc',
        config: { dev: { port: 8080 }, build: { target: 'es2020' } },
      })
    );
    await stageProfiles(
      profile('dev', {
        config: { dev: { port: 3000 }, test: { coverage: 80 } },
      })
    );

    promptsMock.mockResolvedValueOnce({ value: 'merge' } as never);
    await importProfiles(dir);

    expect(output()).toContain('✓ Merged dev');
    const merged = await readProfile('dev');
    expect(merged.description).toBe('remote desc'); // override wins
    expect(merged.config.dev?.port).toBe(8080); // deep-merged dev section
    expect(merged.config.test?.coverage).toBe(80); // local section kept
    expect(merged.config.build?.target).toBe('es2020'); // remote section added
  });

  it('manual mode: skips the profile when chosen', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('dev', { config: { dev: { port: 8080 } } }));
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));

    promptsMock.mockResolvedValueOnce({ value: 'skip' } as never);
    await importProfiles(dir);

    expect(output()).toContain('Skipped dev');
    expect((await readProfile('dev')).config.dev?.port).toBe(3000);
  });

  it('strategy=local keeps the existing profile without prompting', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('dev', { config: { dev: { port: 8080 } } }));
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));

    await importProfiles(dir, { strategy: 'local' });

    expect(promptsMock).not.toHaveBeenCalled();
    expect((await readProfile('dev')).config.dev?.port).toBe(3000);
  });

  it('strategy=remote takes the imported profile without prompting', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('dev', { config: { dev: { port: 8080 } } }));
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));

    await importProfiles(dir, { strategy: 'remote' });

    expect(promptsMock).not.toHaveBeenCalled();
    expect((await readProfile('dev')).config.dev?.port).toBe(8080);
  });

  it('strategy=merge deep-merges without prompting', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(
      dir,
      profile('dev', {
        framework: 'react',
        config: { dev: { port: 8080 } },
        extends: ['remote-base'],
      })
    );
    await stageProfiles(
      profile('dev', {
        config: { dev: { port: 3000 } },
        extends: ['local-base'],
      })
    );

    await importProfiles(dir, { strategy: 'merge' });

    expect(promptsMock).not.toHaveBeenCalled();
    const merged = await readProfile('dev');
    expect(merged.framework).toBe('react');
    expect(merged.config.dev?.port).toBe(8080);
    expect(merged.extends).toEqual(['local-base', 'remote-base']); // union, deduped
  });

  it('imports several profiles in one pass and reports conflicts together', async () => {
    const dir = path.join(tempRoot, 'src-profiles');
    await seedImportFile(dir, profile('fresh'));
    await seedImportFile(dir, profile('dev', { config: { dev: { port: 8080 } } }));
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));

    promptsMock.mockResolvedValueOnce({ value: 'remote' } as never);
    await importProfiles(dir, { strategy: 'manual' });

    const text = output();
    expect(text).toContain('Import complete: 2 imported, 0 skipped');
    expect(text).toContain('Conflicts resolved: 1');
  });
});

describe('syncProfilesLocal', () => {
  it('round-trips profiles through the sync directory and merges cleanly', async () => {
    await stageProfiles(profile('dev'));

    await syncProfilesLocal();

    const text = output();
    expect(text).toContain('Syncing profiles locally');
    expect(text).toContain('✓ Local sync completed');
    const dir = path.join(tempRoot, SYNC_DIR, 'profiles');
    expect(await fs.pathExists(path.join(dir, 'dev.yaml'))).toBe(true);
    // No conflicts (identical round-trip) → no prompts.
    expect(promptsMock).not.toHaveBeenCalled();
  });

  it('honours an explicit remote strategy', async () => {
    await stageProfiles(profile('dev', { config: { dev: { port: 3000 } } }));
    // Pre-seed a stale sync file so the export overwrites it and the import
    // runs against the freshly exported (identical) content.
    await fs.ensureDir(path.join(tempRoot, SYNC_DIR, 'profiles'));

    await syncProfilesLocal({ strategy: 'remote' });

    expect((await readProfile('dev')).name).toBe('dev');
  });
});

describe('showSyncStatus', () => {
  it('reports a missing sync directory', async () => {
    await showSyncStatus();
    const text = output();
    expect(text).toContain('Profile Sync Status');
    expect(text).toContain('No sync directory found');
  });

  it('counts synced profiles and reads last-sync metadata', async () => {
    const dir = path.join(tempRoot, SYNC_DIR, 'profiles');
    await fs.ensureDir(dir);
    await fs.writeFile(path.join(dir, 'dev.yaml'), yaml.stringify(profile('dev')), 'utf8');
    await fs.writeFile(path.join(dir, 'prod.yaml'), yaml.stringify(profile('prod')), 'utf8');

    await writeMetadata({
      lastSync: '2026-01-01T00:00:00.000Z',
      lastSyncBy: 'tester',
      profileHashes: {},
      conflicts: {},
    });

    await showSyncStatus();

    const text = output();
    expect(text).toContain('Profile Sync Status');
    expect(text).toContain('Synced profiles: 2');
    expect(text).toContain('Last sync:');
    expect(text).toContain('Time: 2026-01-01T00:00:00.000Z');
    expect(text).toContain('By: tester');
  });

  it('surfaces pending conflicts from metadata', async () => {
    await fs.ensureDir(path.join(tempRoot, SYNC_DIR));
    await writeMetadata({
      lastSync: '2026-01-01T00:00:00.000Z',
      lastSyncBy: 'tester',
      profileHashes: {},
      conflicts: {
        dev: {
          localProfile: profile('dev'),
          remoteProfile: profile('dev', { environment: 'production' }),
          conflictType: 'modified',
          detectedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    });

    await showSyncStatus();

    expect(output()).toContain('Pending conflicts: 1');
  });
});

describe('resolveConflicts', () => {
  it('does nothing without metadata', async () => {
    await resolveConflicts();
    expect(output()).toContain('No conflicts to resolve');
  });

  it('does nothing when metadata holds no conflicts', async () => {
    await writeMetadata({
      lastSync: '2026-01-01T00:00:00.000Z',
      lastSyncBy: 'tester',
      profileHashes: {},
      conflicts: {},
    });

    await resolveConflicts();

    expect(output()).toContain('No conflicts to resolve');
  });

  it('renders the conflict and applies the local version', async () => {
    await writeMetadata({
      lastSync: '2026-01-01T00:00:00.000Z',
      lastSyncBy: 'tester',
      profileHashes: {},
      conflicts: {
        dev: {
          localProfile: profile('dev', { description: 'local version' }),
          remoteProfile: profile('dev', { description: 'remote version' }),
          conflictType: 'modified',
          detectedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    });
    promptsMock.mockResolvedValueOnce({ value: 'local' } as never);

    await resolveConflicts();

    const text = output();
    expect(text).toContain('Resolving 1 conflict(s)');
    expect(text).toContain('Profile: dev');
    expect(text).toContain('Type: modified');
    expect(text).toContain('✓ Conflicts resolved');
    expect((await readProfile('dev')).description).toBe('local version');

    const metadata = await fs.readJson(path.join(tempRoot, SYNC_METADATA_FILE));
    expect(metadata.conflicts.dev).toBeUndefined();
  });

  it('applies the remote version when chosen', async () => {
    await writeMetadata({
      lastSync: '', lastSyncBy: '', profileHashes: {},
      conflicts: {
        dev: {
          localProfile: profile('dev', { description: 'local version' }),
          remoteProfile: profile('dev', { description: 'remote version' }),
          conflictType: 'modified',
          detectedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    });
    promptsMock.mockResolvedValueOnce({ value: 'remote' } as never);

    await resolveConflicts();

    expect((await readProfile('dev')).description).toBe('remote version');
  });

  it('merges both versions when chosen', async () => {
    await writeMetadata({
      lastSync: '', lastSyncBy: '', profileHashes: {},
      conflicts: {
        dev: {
          localProfile: profile('dev', {
            config: { dev: { port: 3000 }, test: { coverage: 80 } },
          }),
          remoteProfile: profile('dev', {
            framework: 'vue',
            config: { dev: { port: 8080 } },
          }),
          conflictType: 'modified',
          detectedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    });
    promptsMock.mockResolvedValueOnce({ value: 'merge' } as never);

    await resolveConflicts();

    const merged = await readProfile('dev');
    expect(merged.framework).toBe('vue');
    expect(merged.config.dev?.port).toBe(8080);
    expect(merged.config.test?.coverage).toBe(80);
  });

  it('leaves the profile untouched when skipping, but clears the conflict', async () => {
    await stageProfiles(profile('dev', { description: 'whatever is there' }));
    await writeMetadata({
      lastSync: '', lastSyncBy: '', profileHashes: {},
      conflicts: {
        dev: {
          localProfile: profile('dev', { description: 'local version' }),
          remoteProfile: profile('dev', { description: 'remote version' }),
          conflictType: 'modified',
          detectedAt: '2026-01-02T00:00:00.000Z',
        },
      },
    });
    promptsMock.mockResolvedValueOnce({ value: 'skip' } as never);

    await resolveConflicts();

    expect((await readProfile('dev')).description).toBe('whatever is there');
    const metadata = await fs.readJson(path.join(tempRoot, SYNC_METADATA_FILE));
    expect(metadata.conflicts.dev).toBeUndefined();
  });
});
