import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import {
  UnifiedConfigManager,
  createUnifiedConfig,
  getConfigValue,
  setConfigValue,
  listEnvironments,
  compareConfigs,
  type ConfigLayer,
} from '../../src/utils/unified-config';

function once<T = unknown>(emitter: { on: (e: string, cb: (p: T) => void) => void }, event: string) {
  const seen: T[] = [];
  emitter.on(event, (p: T) => seen.push(p));
  return seen;
}

describe('UnifiedConfigManager — default layers', () => {
  it('registers global/project/env/local layers with the expected priorities', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    const byName = (n: string) => m.getLayer(n);
    expect(byName('global')?.priority).toBe(0);
    expect(byName('project')?.priority).toBe(100);
    for (const env of ['development', 'staging', 'production', 'test']) {
      expect(byName(`env:${env}`)?.priority).toBe(200);
    }
    expect(byName('local')?.priority).toBe(1000);
  });

  it('getAllLayers returns layers sorted by ascending priority', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    const layers = m.getAllLayers();
    const priorities = layers.map((l) => l.priority);
    const sorted = [...priorities].sort((a, b) => a - b);
    expect(priorities).toEqual(sorted);
  });

  it('points layer sources at the project path', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    expect(m.getLayer('project')?.source).toBe(path.join('/tmp/uc-test', 're-shell.config.yaml'));
    expect(m.getLayer('local')?.source).toBe(path.join('/tmp/uc-test', '.re-shell.local.yaml'));
    expect(m.getLayer('env:staging')?.source).toBe(path.join('/tmp/uc-test', '.re-shell.staging.yaml'));
  });
});

describe('UnifiedConfigManager — layer management + events', () => {
  it('addLayer/getLayer/removeLayer emit the right events', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    const added = once<ConfigLayer>(m, 'layer-added');
    const removed = once<string>(m, 'layer-removed');

    const custom: ConfigLayer = { name: 'custom', priority: 500, source: '/tmp/c.yaml', config: {} };
    m.addLayer(custom);
    expect(added[0]).toBe(custom);
    expect(m.getLayer('custom')).toBe(custom);

    m.removeLayer('custom');
    expect(removed[0]).toBe('custom');
    expect(m.getLayer('custom')).toBeUndefined();
  });

  it('getLayer returns undefined for an unknown layer', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    expect(m.getLayer('nope')).toBeUndefined();
  });
});

describe('UnifiedConfigManager — merging + getValue', () => {
  it('higher-priority layers override lower ones', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    m.setValue('shared.k', 'global-val', 'global');
    m.setValue('shared.k', 'local-val', 'local');
    expect(m.getValue('shared.k')).toBe('local-val');
  });

  it('deep-merges nested objects across layers', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    m.setValue('db.host', 'g-host', 'global');
    m.setValue('db.port', 5432, 'project');
    const merged = m.getMergedConfig();
    expect(merged.db).toEqual({ host: 'g-host', port: 5432 });
  });

  it('filters environment layers by the requested environment', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    m.setValue('flag', 'dev-only', 'env:development');
    m.setValue('flag', 'stg-only', 'env:staging');
    expect(m.getValue('flag', 'development')).toBe('dev-only');
    expect(m.getValue('flag', 'staging')).toBe('stg-only');
  });

  it('returns undefined for unknown paths', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    expect(m.getValue('does.not.exist')).toBeUndefined();
  });
});

describe('UnifiedConfigManager — setValue', () => {
  it('creates nested objects along the dot path in the target layer', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    m.setValue('a.b.c', 42);
    expect(m.getLayer('project')?.config.a.b.c).toBe(42);
  });

  it('defaults to the project layer', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    m.setValue('k', 'v');
    expect(m.getLayer('project')?.config.k).toBe('v');
  });

  it('emits value-changed with layer, keyPath and value', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    const events = once<{ layer: string; keyPath: string; value: unknown }>(m, 'value-changed');
    m.setValue('k', 'v', 'local');
    expect(events[0]).toEqual({ layer: 'local', keyPath: 'k', value: 'v' });
  });

  it('throws when the target layer does not exist', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    expect(() => m.setValue('k', 'v', 'ghost')).toThrow(/Layer not found/);
  });
});

describe('UnifiedConfigManager — save / load round-trip', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-io-')); });
  afterEach(() => fs.removeSync(root));

  it('persists and reloads a layer via saveLayer + loadLayers', async () => {
    const m = new UnifiedConfigManager(root);
    m.setValue('database.host', 'db.example.com');
    await m.saveLayer('project');

    const m2 = new UnifiedConfigManager(root);
    await m2.loadLayers();
    expect(m2.getValue('database.host')).toBe('db.example.com');
  });

  it('refuses to save a read-only layer', async () => {
    const m = new UnifiedConfigManager(root);
    await expect(m.saveLayer('global')).rejects.toThrow(/read-only/);
  });

  it('throws when saving an unknown layer', async () => {
    const m = new UnifiedConfigManager(root);
    await expect(m.saveLayer('ghost')).rejects.toThrow(/Layer not found/);
  });

  it('saveAll writes every writable layer that has a source', async () => {
    const m = new UnifiedConfigManager(root);
    m.setValue('p', 1);
    m.setValue('l', 2, 'local');
    await m.saveAll();
    expect(await fs.pathExists(path.join(root, 're-shell.config.yaml'))).toBe(true);
    expect(await fs.pathExists(path.join(root, '.re-shell.local.yaml'))).toBe(true);
  });
});

describe('UnifiedConfigManager — syncConfigurations', () => {
  let root: string;
  let m: UnifiedConfigManager;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-sync-'));
    m = new UnifiedConfigManager(root);
    m.setValue('host', 'dev.db', 'env:development');
    m.setValue('api_key', 'secret', 'env:development');
    m.setValue('port', 5432, 'env:development');
  });
  afterEach(() => fs.removeSync(root));

  it('merges the source config into the target environment and persists it', async () => {
    const status = await m.syncConfigurations({
      sourceEnv: 'development',
      targetEnvs: ['staging'],
      mergeStrategy: 'merge',
      includeSecrets: true,
    });
    expect(status.syncedEnvironments).toEqual(['staging']);
    expect(status.success).toBe(true);
    expect(m.getLayer('env:staging')?.config).toMatchObject({ host: 'dev.db', port: 5432 });
    expect(await fs.pathExists(path.join(root, '.re-shell.staging.yaml'))).toBe(true);
  });

  it('filters secret keys unless includeSecrets is set', async () => {
    await m.syncConfigurations({
      sourceEnv: 'development',
      targetEnvs: ['staging'],
      mergeStrategy: 'merge',
      includeSecrets: false,
    });
    const cfg = m.getLayer('env:staging')?.config as Record<string, unknown>;
    expect(cfg.host).toBe('dev.db');
    expect(cfg.api_key).toBeUndefined();
  });

  it('overwrite strategy keeps existing target keys and adds new source keys', async () => {
    m.setValue('host', 'stg.db', 'env:staging');
    await m.syncConfigurations({
      sourceEnv: 'development',
      targetEnvs: ['staging'],
      mergeStrategy: 'overwrite',
      includeSecrets: true,
    });
    const cfg = m.getLayer('env:staging')?.config as Record<string, unknown>;
    // Target's existing `host` wins; new `port` is added from source.
    expect(cfg.host).toBe('stg.db');
    expect(cfg.port).toBe(5432);
  });

  it('dryRun reports synced environments but does not write the file', async () => {
    const status = await m.syncConfigurations({
      sourceEnv: 'development',
      targetEnvs: ['staging'],
      mergeStrategy: 'merge',
      includeSecrets: true,
      dryRun: true,
    });
    expect(status.syncedEnvironments).toEqual(['staging']);
    expect(await fs.pathExists(path.join(root, '.re-shell.staging.yaml'))).toBe(false);
  });

  it('records a pending change for a missing target environment', async () => {
    const status = await m.syncConfigurations({
      sourceEnv: 'development',
      targetEnvs: ['ghost-env'],
    });
    expect(status.syncedEnvironments).toHaveLength(0);
    expect(status.pendingChanges.some((c) => c.includes('ghost-env'))).toBe(true);
  });

  it('fails when the source environment does not exist', async () => {
    const status = await m.syncConfigurations({
      sourceEnv: 'ghost',
      targetEnvs: ['staging'],
    });
    expect(status.success).toBe(false);
    expect(status.message).toMatch(/Source environment not found/);
  });
});

describe('UnifiedConfigManager — validateConfig', () => {
  it('reports a missing name/project field', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    const result = m.validateConfig();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('name or project'))).toBe(true);
  });

  it('flags an invalid packageManager and theme', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    m.setValue('name', 'app');
    m.setValue('packageManager', 'composer');
    m.setValue('theme', 'neon');
    const result = m.validateConfig();
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('composer'))).toBe(true);
    expect(result.errors.some((e) => e.includes('neon'))).toBe(true);
  });

  it('passes for a valid minimal config', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    m.setValue('name', 'app');
    expect(m.validateConfig().valid).toBe(true);
  });
});

describe('UnifiedConfigManager — snapshots', () => {
  it('createSnapshot captures the env layer, lists and restores it', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-snap-'));
    try {
      const m = new UnifiedConfigManager(root);
      m.setValue('host', 'dev.db', 'env:development');
      const snap = await m.createSnapshot('development', 'v1');
      expect(snap.environment).toBe('development');
      expect(snap.version).toBe('v1');
      expect(snap.checksum).toMatch(/^[0-9a-f]{16}$/);
      expect(m.listSnapshots('development').map((s) => s.version)).toEqual(['v1']);

      // Mutate the layer, then restore from the snapshot.
      m.setValue('host', 'changed', 'env:development');
      await m.restoreSnapshot('development', 'v1');
      expect(m.getLayer('env:development')?.config.host).toBe('dev.db');
    } finally {
      fs.removeSync(root);
    }
  });

  it('createSnapshot throws for an unknown environment', async () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    await expect(m.createSnapshot('ghost')).rejects.toThrow(/Environment not found/);
  });

  it('listSnapshots returns an empty array for an environment with none', () => {
    const m = new UnifiedConfigManager('/tmp/uc-test');
    expect(m.listSnapshots('development')).toEqual([]);
  });
});

describe('standalone helpers', () => {
  describe('listEnvironments', () => {
    it('returns the four built-in environments', () => {
      expect(listEnvironments()).toEqual(['development', 'staging', 'production', 'test']);
    });
  });

  describe('compareConfigs', () => {
    it('classifies keys as added, removed, changed and unchanged', () => {
      const result = compareConfigs(
        { a: 1, b: 2, c: 3 },
        { b: 2, c: 30, d: 4 },
      );
      expect(result.added).toEqual(['d']);
      expect(result.removed).toEqual(['a']);
      expect(result.changed).toEqual({ c: { from: 3, to: 30 } });
      expect(result.unchanged).toEqual(['b']);
    });
  });

  describe('getConfigValue / setConfigValue', () => {
    let root: string;
    beforeEach(async () => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-helpers-'));
      // Seed a project config so getConfigValue has something to read.
      await fs.ensureDir(root);
      await fs.writeFile(
        path.join(root, 're-shell.config.yaml'),
        yaml.stringify({ featureX: { enabled: true } }),
      );
    });
    afterEach(() => fs.removeSync(root));

    it('reads a value previously persisted to the project layer', async () => {
      expect(await getConfigValue('featureX.enabled', root)).toBe(true);
    });

    it('round-trips a set value through the project layer', async () => {
      await setConfigValue('featureX.enabled', false, root);
      expect(await getConfigValue('featureX.enabled', root)).toBe(false);
    });
  });

  describe('createUnifiedConfig', () => {
    it('constructs and initializes a manager', async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uc-factory-'));
      try {
        const m = await createUnifiedConfig(root);
        expect(m).toBeInstanceOf(UnifiedConfigManager);
        expect(m.getLayer('project')?.source).toBe(path.join(root, 're-shell.config.yaml'));
      } finally {
        fs.removeSync(root);
      }
    });
  });
});
