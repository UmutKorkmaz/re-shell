import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import { satisfies } from 'semver';

const root = resolve(__dirname, '../../../..');
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const workspace = parse(readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8'));
const lock = parse(readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8'));
const overrides: Record<string, string> = {
  '@types/react': '18.3.31',
  '@types/react-dom': '18.3.7',
  hono: '^4.13.7',
  'form-data': '^4.0.6',
  protobufjs: '^7.6.3',
  'http-cache-semantics': '^4.3.0',
  'uuid@<11.1.1': '^11.1.1',
  'postcss-selector-parser@<7.1.6': '^7.1.6',
  'vite@>=8.0.0>esbuild': '^0.28.1',
};

const resolvedRanges: Record<string, string> = {
  ...Object.fromEntries(Object.entries(overrides).filter(([name]) => !name.includes('>') && !name.slice(1).includes('@'))),
  uuid: '>=11.1.1',
  'postcss-selector-parser': '>=7.1.6',
};

describe('pnpm 9 dependency overrides', () => {
  it('keeps overrides in the supported root manifest location', () => {
    expect(manifest.packageManager).toBe('pnpm@9.15.9');
    expect(manifest.pnpm.overrides).toEqual(overrides);
    expect(workspace.overrides).toBeUndefined();
  });

  it('records the effective overrides in the generated lockfile', () => {
    expect(lock.overrides).toEqual(overrides);
  });

  it.each(Object.entries(resolvedRanges))('resolves every %s version within %s', (name, range) => {
    const prefix = `${name}@`;
    const versions = Object.keys(lock.packages)
      .filter(key => key.startsWith(prefix))
      .map(key => key.slice(prefix.length));
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(satisfies(version, range)).toBe(true);
    }
  });

  it('applies the esbuild floor when a Vite 8 dependency uses esbuild', () => {
    for (const [name, snapshot] of Object.entries(lock.snapshots) as [string, { dependencies?: Record<string, string> }][]) {
      if (!name.startsWith('vite@8.')) continue;
      const version = snapshot.dependencies?.esbuild;
      if (version) expect(satisfies(version.split('(')[0], '^0.28.1')).toBe(true);
    }
  });
});
