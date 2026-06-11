import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildToolchainFingerprint,
  computeCacheKey,
  resolveInputFiles,
  snapshotEnv,
  stableStringify,
  type CacheKeyInput,
  type ToolchainFingerprint,
} from '../../src/utils/cache-key';

let dir: string;

afterEach(async () => {
  if (dir) await fs.remove(dir);
});

/** A minimal package dir with two source files. */
async function makePkg(files: Record<string, string>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-key-'));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    await fs.ensureDir(path.dirname(abs));
    await fs.writeFile(abs, content);
  }
  return root;
}

const TOOLCHAIN: ToolchainFingerprint = {
  node: 'v20.0.0',
  packageManager: 'pnpm',
  languages: {},
};

function baseInput(packageDir: string): CacheKeyInput {
  return {
    packageDir,
    task: 'build',
    command: 'tsc',
    dependencyKeys: [],
    toolchain: TOOLCHAIN,
    env: {},
  };
}

describe('stableStringify', () => {
  it('produces identical output regardless of key insertion order', () => {
    const a = stableStringify({ b: 1, a: 2, c: { y: 1, x: 2 } });
    const b = stableStringify({ c: { x: 2, y: 1 }, a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('preserves array order', () => {
    expect(stableStringify([3, 1, 2])).toBe('[3,1,2]');
  });
});

describe('resolveInputFiles', () => {
  it('defaults to the whole package dir minus node_modules and dist', async () => {
    dir = await makePkg({
      'src/index.ts': 'a',
      'node_modules/x/index.js': 'ignored',
      'dist/index.js': 'ignored',
      'package.json': '{}',
    });
    const files = (await resolveInputFiles(dir)).map(f => path.relative(dir, f));
    expect(files).toContain('src/index.ts');
    expect(files).toContain('package.json');
    expect(files.some(f => f.startsWith('node_modules'))).toBe(false);
    expect(files.some(f => f.startsWith('dist'))).toBe(false);
  });

  it('excludes declared outputs from the default input set', async () => {
    dir = await makePkg({ 'src/a.ts': 'x', 'build/out.js': 'y' });
    const files = (await resolveInputFiles(dir, undefined, ['build/**'])).map(f =>
      path.relative(dir, f)
    );
    expect(files).toContain('src/a.ts');
    expect(files.some(f => f.startsWith('build'))).toBe(false);
  });

  it('honours explicit input globs', async () => {
    dir = await makePkg({ 'src/a.ts': 'x', 'README.md': 'y' });
    const files = (await resolveInputFiles(dir, ['src/**'])).map(f =>
      path.relative(dir, f)
    );
    expect(files).toEqual(['src/a.ts']);
  });
});

describe('computeCacheKey', () => {
  it('is deterministic: same inputs => same key', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const k1 = await computeCacheKey(baseInput(dir));
    const k2 = await computeCacheKey(baseInput(dir));
    expect(k1).toBe(k2);
    expect(k1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when an input file content changes', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const before = await computeCacheKey(baseInput(dir));
    await fs.writeFile(path.join(dir, 'src/a.ts'), 'goodbye');
    const after = await computeCacheKey(baseInput(dir));
    expect(after).not.toBe(before);
  });

  it('changes when the toolchain fingerprint changes', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const before = await computeCacheKey(baseInput(dir));
    const after = await computeCacheKey({
      ...baseInput(dir),
      toolchain: { ...TOOLCHAIN, node: 'v22.0.0' },
    });
    expect(after).not.toBe(before);
  });

  it('changes when a per-language toolchain version changes', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const before = await computeCacheKey({
      ...baseInput(dir),
      toolchain: { ...TOOLCHAIN, languages: { 'go.mod:go': '1.21' } },
    });
    const after = await computeCacheKey({
      ...baseInput(dir),
      toolchain: { ...TOOLCHAIN, languages: { 'go.mod:go': '1.22' } },
    });
    expect(after).not.toBe(before);
  });

  it('changes when the command body changes', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const before = await computeCacheKey(baseInput(dir));
    const after = await computeCacheKey({ ...baseInput(dir), command: 'tsc --strict' });
    expect(after).not.toBe(before);
  });

  it('changes when a dependency key changes (upstream invalidation)', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const before = await computeCacheKey({
      ...baseInput(dir),
      dependencyKeys: ['dep-key-1'],
    });
    const after = await computeCacheKey({
      ...baseInput(dir),
      dependencyKeys: ['dep-key-2'],
    });
    expect(after).not.toBe(before);
  });

  it('is invariant to dependency key ORDER', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const k1 = await computeCacheKey({
      ...baseInput(dir),
      dependencyKeys: ['a', 'b'],
    });
    const k2 = await computeCacheKey({
      ...baseInput(dir),
      dependencyKeys: ['b', 'a'],
    });
    expect(k1).toBe(k2);
  });

  it('changes when an allow-listed env var changes', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const before = await computeCacheKey({
      ...baseInput(dir),
      env: { NODE_ENV: 'development' },
    });
    const after = await computeCacheKey({
      ...baseInput(dir),
      env: { NODE_ENV: 'production' },
    });
    expect(after).not.toBe(before);
  });

  it('ignores env vars that are not allow-listed', async () => {
    dir = await makePkg({ 'src/a.ts': 'hello' });
    const before = await computeCacheKey({
      ...baseInput(dir),
      env: { SOME_RANDOM_VAR: 'a' },
    });
    const after = await computeCacheKey({
      ...baseInput(dir),
      env: { SOME_RANDOM_VAR: 'b' },
    });
    expect(after).toBe(before);
  });
});

describe('snapshotEnv', () => {
  it('reads only the allow-listed keys', () => {
    const snap = snapshotEnv({ NODE_ENV: 'test', SECRET: 'nope' });
    expect(snap.NODE_ENV).toBe('test');
    expect('SECRET' in snap).toBe(false);
  });
});

describe('buildToolchainFingerprint', () => {
  it('reads .nvmrc and the go.mod go directive offline', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-tc-'));
    await fs.writeFile(path.join(dir, '.nvmrc'), '20.11.0\n');
    await fs.writeFile(
      path.join(dir, 'go.mod'),
      'module example.com/x\n\ngo 1.22\n'
    );
    const fp = await buildToolchainFingerprint(dir, dir, 'pnpm');
    expect(fp.node).toBe(process.version);
    expect(fp.packageManager).toBe('pnpm');
    expect(fp.languages['.nvmrc']).toBe('20.11.0');
    expect(fp.languages['go.mod:go']).toBe('1.22');
  });
});
