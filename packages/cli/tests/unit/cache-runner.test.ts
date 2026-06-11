import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import { runTask, type SpawnTask } from '../../src/utils/task-runner';
import {
  LocalFsCache,
  type CacheBackend,
  type CachedResult,
} from '../../src/utils/cache-store';

let root: string;
let cacheRoot: string;

afterEach(async () => {
  if (root) await fs.remove(root);
  if (cacheRoot) await fs.remove(cacheRoot);
});

/**
 * A single-package workspace whose `build` task declares `dist/**` as its output
 * and `src/**` as its input. The injected spawner writes a deterministic file
 * into dist so the cache has a real artifact to capture/restore.
 */
async function makeWorkspace(buildBody = 'tsc'): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-run-'));
  await fs.writeJson(path.join(dir, 'package.json'), {
    name: 'fixture-root',
    private: true,
  });
  await fs.writeFile(path.join(dir, 'package-lock.json'), '');

  const pkg = path.join(dir, 'packages', 'a');
  await fs.ensureDir(path.join(pkg, 'src'));
  await fs.writeFile(path.join(pkg, 'src', 'index.ts'), 'export const x = 1;');
  await fs.writeJson(path.join(pkg, 'package.json'), {
    name: 'a',
    scripts: { build: buildBody },
  });

  await fs.writeFile(
    path.join(dir, 're-shell.workspaces.yaml'),
    'tasks:\n' +
      '  build:\n' +
      '    inputs: ["src/**", "package.json"]\n' +
      '    outputs: ["dist/**"]\n'
  );
  return dir;
}

/** A spawner that writes a dist artifact and records every invocation. */
function buildingSpawner(spawns: string[]): SpawnTask {
  return async ({ pkg, task }) => {
    spawns.push(`${pkg.name}:${task}`);
    const dist = path.join(pkg.dir, 'dist');
    await fs.ensureDir(dist);
    await fs.writeFile(path.join(dist, 'out.js'), 'compiled');
    return { exitCode: 0, logs: 'compiled ok\n' };
  };
}

describe('build cache integration (runTask + LocalFsCache)', () => {
  it('second run reports the task as cached and does NOT spawn', async () => {
    root = await makeWorkspace();
    cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-dir-'));
    const cacheConfig = { root: cacheRoot, secret: 'sek' };

    const spawns1: string[] = [];
    const r1 = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner(spawns1),
    });
    expect(spawns1).toEqual(['a:build']);
    expect(r1.results[0].status).toBe('success');

    const spawns2: string[] = [];
    const r2 = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner(spawns2),
    });
    // The second run is a cache HIT: nothing spawned.
    expect(spawns2).toEqual([]);
    expect(r2.results[0].status).toBe('cached');
    expect(r2.hadFailure).toBe(false);
  });

  it('restores the output dir from cache when it was deleted', async () => {
    root = await makeWorkspace();
    cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-dir-'));
    const cacheConfig = { root: cacheRoot, secret: 'sek' };
    const pkgDist = path.join(root, 'packages', 'a', 'dist', 'out.js');

    await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner([]),
    });
    expect(await fs.pathExists(pkgDist)).toBe(true);

    // Delete the output dir, then re-run: the cache must restore it WITHOUT a spawn.
    await fs.remove(path.dirname(pkgDist));
    expect(await fs.pathExists(pkgDist)).toBe(false);

    const spawns: string[] = [];
    const r = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner(spawns),
    });
    expect(spawns).toEqual([]); // restored from cache, not rebuilt
    expect(r.results[0].status).toBe('cached');
    expect(await fs.pathExists(pkgDist)).toBe(true);
    expect(await fs.readFile(pkgDist, 'utf8')).toBe('compiled');
  });

  it('a changed input file invalidates the cache (miss -> spawn)', async () => {
    root = await makeWorkspace();
    cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-dir-'));
    const cacheConfig = { root: cacheRoot, secret: 'sek' };

    await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner([]),
    });

    // Change a source file -> different key -> miss.
    await fs.writeFile(
      path.join(root, 'packages', 'a', 'src', 'index.ts'),
      'export const x = 2;'
    );

    const spawns: string[] = [];
    const r = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner(spawns),
    });
    expect(spawns).toEqual(['a:build']); // rebuilt
    expect(r.results[0].status).toBe('success');
  });

  it('--no-cache (no cacheConfig) always spawns and never reports cached', async () => {
    root = await makeWorkspace();
    cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-dir-'));

    for (let i = 0; i < 2; i += 1) {
      const spawns: string[] = [];
      const r = await runTask({
        rootPath: root,
        task: 'build',
        concurrency: 1,
        spawnTask: buildingSpawner(spawns),
      });
      expect(spawns).toEqual(['a:build']);
      expect(r.results[0].status).toBe('success');
    }
  });

  it('a tampered cached artifact is rejected -> falls back to a real run', async () => {
    root = await makeWorkspace();
    cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-dir-'));
    const cacheConfig = { root: cacheRoot, secret: 'sek' };

    await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner([]),
    });

    // Tamper with the stored artifact directly via a LocalFsCache view: find the
    // single entry and flip a byte in its artifact.
    const shards = await fs.readdir(cacheRoot);
    const shard = shards.find(s => s.length === 2)!;
    const keys = await fs.readdir(path.join(cacheRoot, shard));
    const artifact = path.join(
      cacheRoot,
      shard,
      keys[0],
      'files',
      'dist',
      'out.js'
    );
    await fs.writeFile(artifact, 'EVIL');

    const spawns: string[] = [];
    const r = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig,
      spawnTask: buildingSpawner(spawns),
    });
    // Tampered entry is rejected -> a real run happens instead of a poisoned hit.
    expect(spawns).toEqual(['a:build']);
    expect(r.results[0].status).toBe('success');
    // And the restored-on-disk artifact is the freshly compiled (clean) one.
    expect(
      await fs.readFile(
        path.join(root, 'packages', 'a', 'dist', 'out.js'),
        'utf8'
      )
    ).toBe('compiled');
    // Reference the LocalFsCache import so the entry layout assertion is anchored.
    void LocalFsCache;
  });

  it('hydrates from a configured remote on a local miss (CI hydration), no spawn', async () => {
    root = await makeWorkspace();
    cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-dir-'));

    // First, populate ONLY the remote by building once with the remote attached
    // and a separate (throwaway) local root, then drop that local root so the
    // second run starts with an empty local store.
    const remoteStore = new Map<string, CachedResult>();
    const remote: CacheBackend = {
      async has(key) {
        return remoteStore.has(key);
      },
      async get(key) {
        return remoteStore.get(key);
      },
      async put(key, result) {
        remoteStore.set(key, result);
      },
    };

    const seedLocal = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-seed-'));
    await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig: { root: seedLocal, secret: 'sek', remote },
      spawnTask: buildingSpawner([]),
    });
    await fs.remove(seedLocal);
    expect(remoteStore.size).toBe(1); // pushed to remote on the miss

    // Remove the on-disk output so a hit must restore it.
    await fs.remove(path.join(root, 'packages', 'a', 'dist'));

    // Second run with a FRESH local store but the populated remote: remote-then-
    // local lookup hits the remote, restores the output, and never spawns.
    const spawns: string[] = [];
    const r = await runTask({
      rootPath: root,
      task: 'build',
      concurrency: 1,
      cacheConfig: { root: cacheRoot, secret: 'sek', remote },
      spawnTask: buildingSpawner(spawns),
    });
    expect(spawns).toEqual([]);
    expect(r.results[0].status).toBe('cached');
    expect(
      await fs.pathExists(path.join(root, 'packages', 'a', 'dist', 'out.js'))
    ).toBe(true);

    // The remote hit was seeded into the LOCAL store for subsequent instant hits.
    const localCache = new LocalFsCache({ root: cacheRoot, secret: 'sek' });
    const keys = [...remoteStore.keys()];
    expect(await localCache.has(keys[0])).toBe(true);
  });
});
