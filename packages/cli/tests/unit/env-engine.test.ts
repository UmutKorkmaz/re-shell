import { describe, it, expect } from 'vitest';
import {
  generateDevbox,
  generateDevcontainer,
  verifyEnvConfig,
  distinctLanguages,
  packagesForLanguage,
  TOOLCHAIN_MAP,
  type DetectedToolchain,
} from '../../src/utils/env-engine';
import { envResponseSchema } from '@re-shell/contracts';

/** Pure-engine conformance for `re-shell env` (issue #21). */

describe('distinctLanguages + packagesForLanguage', () => {
  it('dedupes and sorts detected languages, dropping unknown', () => {
    const tcs: DetectedToolchain[] = [
      { language: 'python' },
      { language: 'typescript' },
      { language: 'python' },
      { language: 'unknown' },
    ];
    expect(distinctLanguages(tcs)).toEqual(['python', 'typescript']);
  });
  it('maps every known language to a devbox package + devcontainer feature', () => {
    for (const lang of Object.keys(TOOLCHAIN_MAP)) {
      const pkgs = packagesForLanguage(lang as DetectedToolchain['language']);
      expect(pkgs).not.toBeNull();
      expect(pkgs!.devboxPackage.length).toBeGreaterThan(0);
      expect(pkgs!.devcontainerFeature.length).toBeGreaterThan(0);
    }
  });
  it('returns null for unknown', () => {
    expect(packagesForLanguage('unknown')).toBeNull();
  });
});

describe('generateDevbox', () => {
  it('emits one sorted Nix package per distinct language', () => {
    const devbox = generateDevbox([
      { language: 'python' },
      { language: 'typescript' },
      { language: 'go' },
    ]);
    expect(devbox.packages).toEqual(['go', 'nodejs', 'python3']);
  });
  it('version-pins a package when a version was detected', () => {
    const devbox = generateDevbox([{ language: 'typescript', version: '18' }]);
    expect(devbox.packages).toEqual(['nodejs@18']);
  });
  it('picks the highest declared version when multiple services pin the same language', () => {
    const devbox = generateDevbox([
      { language: 'typescript', version: '16' },
      { language: 'typescript', version: '20' },
      { language: 'typescript', version: '18' },
    ]);
    expect(devbox.packages).toEqual(['nodejs@20']);
  });
  it('emits a valid devbox.json shape', () => {
    const devbox = generateDevbox([{ language: 'python' }]);
    expect(devbox).toHaveProperty('packages');
    expect(devbox).toHaveProperty('shell');
    expect(devbox).toHaveProperty('nixpkgs');
  });
});

describe('generateDevcontainer', () => {
  it('emits one devcontainer feature per distinct language', () => {
    const dc = generateDevcontainer([{ language: 'typescript' }, { language: 'python' }]);
    const features = dc.features as Record<string, string>;
    expect(Object.keys(features)).toHaveLength(2);
    expect(features['ghcr.io/devcontainers/features/node:1']).toBeDefined();
    expect(features['ghcr.io/devcontainers/features/python:1']).toBeDefined();
  });
  it('version-pins a feature when a version was detected, else "latest"', () => {
    const pinned = generateDevcontainer([{ language: 'python', version: '3.11' }]);
    expect((pinned.features as Record<string, string>)['ghcr.io/devcontainers/features/python:1']).toBe('3.11');
    const unpinned = generateDevcontainer([{ language: 'python' }]);
    expect((unpinned.features as Record<string, string>)['ghcr.io/devcontainers/features/python:1']).toBe('latest');
  });
});

describe('verifyEnvConfig', () => {
  it('reports no drift when the generated config matches detection', () => {
    const drift = verifyEnvConfig(['nodejs', 'python3'], [
      { language: 'typescript' },
      { language: 'python' },
    ]);
    expect(drift.missing).toEqual([]);
    expect(drift.extra).toEqual([]);
  });
  it('reports languages added since generation (missing)', () => {
    const drift = verifyEnvConfig(['nodejs'], [
      { language: 'typescript' },
      { language: 'go' },
    ]);
    expect(drift.missing).toEqual(['go']);
    expect(drift.extra).toEqual([]);
  });
  it('reports languages removed since generation (extra)', () => {
    const drift = verifyEnvConfig(['nodejs', 'python3'], [{ language: 'typescript' }]);
    expect(drift.missing).toEqual([]);
    expect(drift.extra).toEqual(['python']);
  });
  it('ignores version pins when matching', () => {
    const drift = verifyEnvConfig(['nodejs@18'], [{ language: 'typescript' }]);
    expect(drift.missing).toEqual([]);
    expect(drift.extra).toEqual([]);
  });
});

describe('contracts conformance', () => {
  it('a constructed env response validates against envResponseSchema', () => {
    const payload = {
      languages: ['python', 'typescript'],
      dryRun: true,
      files: [
        { path: 'devbox.json', kind: 'devbox', written: false },
        { path: '.devcontainer/devcontainer.json', kind: 'devcontainer', written: false },
      ],
      drift: { missing: [], extra: [] },
      warnings: [],
    };
    expect(envResponseSchema.safeParse(payload).success).toBe(true);
  });
  it('rejects an unknown file kind against the schema', () => {
    const payload = {
      languages: ['typescript'],
      dryRun: true,
      files: [{ path: 'x', kind: 'vagrant', written: false }],
      drift: { missing: [], extra: [] },
      warnings: [],
    };
    expect(envResponseSchema.safeParse(payload).success).toBe(false);
  });
});
