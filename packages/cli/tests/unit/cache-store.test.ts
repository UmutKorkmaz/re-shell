import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LocalFsCache,
  RemoteCache,
  captureOutputs,
  restoreOutputs,
  computeCacheStats,
  cleanCache,
  type CacheHttpTransport,
  type CachedResult,
  type RemoteEnvelope,
} from '../../src/utils/cache-store';

let dir: string;

afterEach(async () => {
  if (dir) await fs.remove(dir);
});

const SECRET = 'test-secret';

function sampleResult(): CachedResult {
  return {
    exitCode: 0,
    outputs: ['dist/out.js'],
    logs: 'built ok\n',
    files: [{ path: 'dist/out.js', content: Buffer.from('console.log(1)') }],
  };
}

describe('LocalFsCache', () => {
  it('round-trips a result: put then get returns the same artifacts + logs', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-store-'));
    const cache = new LocalFsCache({ root: dir, secret: SECRET });
    const key = 'a'.repeat(64);

    expect(await cache.has(key)).toBe(false);
    await cache.put(key, sampleResult());
    expect(await cache.has(key)).toBe(true);

    const got = await cache.get(key);
    expect(got).toBeDefined();
    expect(got!.exitCode).toBe(0);
    expect(got!.logs).toBe('built ok\n');
    expect(got!.files).toHaveLength(1);
    expect(got!.files[0].path).toBe('dist/out.js');
    expect(got!.files[0].content.toString()).toBe('console.log(1)');
  });

  it('returns undefined for a missing key', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-store-'));
    const cache = new LocalFsCache({ root: dir, secret: SECRET });
    expect(await cache.get('b'.repeat(64))).toBeUndefined();
  });

  it('REJECTS a tampered artifact (returns undefined on get)', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-store-'));
    const cache = new LocalFsCache({ root: dir, secret: SECRET });
    const key = 'c'.repeat(64);
    await cache.put(key, sampleResult());

    // Flip a byte in the stored artifact without updating the signature.
    const artifact = path.join(cache.entryDir(key), 'files', 'dist', 'out.js');
    await fs.writeFile(artifact, 'TAMPERED');

    expect(await cache.get(key)).toBeUndefined();
  });

  it('REJECTS a tampered record (returns undefined on get)', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-store-'));
    const cache = new LocalFsCache({ root: dir, secret: SECRET });
    const key = 'd'.repeat(64);
    await cache.put(key, sampleResult());

    const recordPath = path.join(cache.entryDir(key), 'record.json');
    const record = await fs.readJson(recordPath);
    record.exitCode = 1; // tamper: pretend it succeeded with a different code
    await fs.writeJson(recordPath, record);

    expect(await cache.get(key)).toBeUndefined();
  });

  it('REJECTS an entry read with the wrong secret', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-store-'));
    const writer = new LocalFsCache({ root: dir, secret: SECRET });
    const key = 'e'.repeat(64);
    await writer.put(key, sampleResult());

    const reader = new LocalFsCache({ root: dir, secret: 'different-secret' });
    expect(await reader.get(key)).toBeUndefined();
  });
});

describe('RemoteCache (in-memory transport)', () => {
  /** A fully in-memory transport — never touches the network. */
  function memoryTransport(): {
    transport: CacheHttpTransport;
    store: Map<string, RemoteEnvelope>;
  } {
    const store = new Map<string, RemoteEnvelope>();
    const transport: CacheHttpTransport = {
      async head(key) {
        return store.has(key);
      },
      async getRaw(key) {
        return store.get(key);
      },
      async putRaw(key, envelope) {
        store.set(key, envelope);
      },
    };
    return { transport, store };
  }

  it('round-trips through a verified envelope', async () => {
    const { transport } = memoryTransport();
    const cache = new RemoteCache({ secret: SECRET, transport });
    const key = 'f'.repeat(64);
    await cache.put(key, sampleResult());
    expect(await cache.has(key)).toBe(true);

    const got = await cache.get(key);
    expect(got!.files[0].content.toString()).toBe('console.log(1)');
    expect(got!.exitCode).toBe(0);
  });

  it('REJECTS a tampered remote envelope', async () => {
    const { transport, store } = memoryTransport();
    const cache = new RemoteCache({ secret: SECRET, transport });
    const key = 'a1'.repeat(32);
    await cache.put(key, sampleResult());

    // Corrupt the stored base64 artifact without re-signing.
    const env = store.get(key)!;
    env.files['dist/out.js'] = Buffer.from('TAMPERED').toString('base64');
    store.set(key, env);

    expect(await cache.get(key)).toBeUndefined();
  });

  it('REJECTS an envelope signed with a different secret', async () => {
    const { transport } = memoryTransport();
    const writer = new RemoteCache({ secret: SECRET, transport });
    const key = 'b2'.repeat(32);
    await writer.put(key, sampleResult());

    const reader = new RemoteCache({ secret: 'other', transport });
    expect(await reader.get(key)).toBeUndefined();
  });
});

describe('captureOutputs / restoreOutputs', () => {
  it('captures declared output globs and restores them byte-for-byte', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-cap-'));
    const pkg = path.join(dir, 'pkg');
    await fs.ensureDir(path.join(pkg, 'dist'));
    await fs.writeFile(path.join(pkg, 'dist', 'a.js'), 'AAA');
    await fs.writeFile(path.join(pkg, 'dist', 'b.js'), 'BBB');

    const files = await captureOutputs(pkg, ['dist/**']);
    expect(files.map(f => f.path).sort()).toEqual(['dist/a.js', 'dist/b.js']);

    await fs.remove(path.join(pkg, 'dist'));
    expect(await fs.pathExists(path.join(pkg, 'dist'))).toBe(false);

    await restoreOutputs(pkg, files);
    expect(await fs.readFile(path.join(pkg, 'dist', 'a.js'), 'utf8')).toBe('AAA');
    expect(await fs.readFile(path.join(pkg, 'dist', 'b.js'), 'utf8')).toBe('BBB');
  });

  it('refuses to restore a path that escapes the package dir', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-cap-'));
    const pkg = path.join(dir, 'pkg');
    await fs.ensureDir(pkg);
    await expect(
      restoreOutputs(pkg, [{ path: '../escape.js', content: Buffer.from('x') }])
    ).rejects.toThrow(/outside the package directory/);
  });
});

describe('computeCacheStats / cleanCache', () => {
  it('reports entry count + size, then clean prunes everything', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-stats-'));
    const cache = new LocalFsCache({ root: dir, secret: SECRET });
    await cache.put('1'.repeat(64), sampleResult());
    await cache.put('2'.repeat(64), sampleResult());

    const stats = await computeCacheStats(dir);
    expect(stats.entries).toBe(2);
    expect(stats.sizeBytes).toBeGreaterThan(0);

    const cleaned = await cleanCache(dir);
    expect(cleaned.removedEntries).toBe(2);
    expect(cleaned.reclaimedBytes).toBe(stats.sizeBytes);

    const after = await computeCacheStats(dir);
    expect(after.entries).toBe(0);
    expect(after.sizeBytes).toBe(0);
  });

  it('returns zeros for a non-existent cache root', async () => {
    const stats = await computeCacheStats(
      path.join(os.tmpdir(), 'does-not-exist-' + Math.random())
    );
    expect(stats.entries).toBe(0);
    expect(stats.sizeBytes).toBe(0);
  });
});
