import { describe, it, expect } from 'vitest';
import {
  normalizeExposes,
  normalizeShared,
  parseManifest,
  diffRemote,
  diffToFindings,
  detectSharedSkew,
  skewToFindings,
  narrowsVersionRange,
} from '../../src/utils/federation-engine';
import { federationResponseSchema } from '@re-shell/contracts';

/**
 * Pure-engine conformance for `re-shell federation check`. Everything here is
 * offline, deterministic, and side-effect free — no git, no filesystem, no
 * network.
 */

describe('normalizeExposes', () => {
  it('normalizes an array of {id, path, types}', () => {
    const out = normalizeExposes([
      { id: './B', path: './src/B', types: './src/B.d.ts' },
      { id: './A', path: './src/A' },
    ]);
    expect(out).toEqual([
      { id: './A', path: './src/A' },
      { id: './B', path: './src/B', types: './src/B.d.ts' },
    ]);
  });

  it('normalizes a map of id → string path', () => {
    const out = normalizeExposes({ './A': './src/A', './B': './src/B' });
    expect(out.map(e => e.id)).toEqual(['./A', './B']);
    expect(out[0].path).toBe('./src/A');
  });

  it('normalizes a map of id → {import, types}', () => {
    const out = normalizeExposes({
      './A': { import: './src/A', types: './dist/A.d.ts' },
    });
    expect(out[0]).toEqual({ id: './A', path: './src/A', types: './dist/A.d.ts' });
  });

  it('accepts name/moduleName as the id alias', () => {
    const out = normalizeExposes([{ name: './A' }, { moduleName: './B' }]);
    expect(out.map(e => e.id).sort()).toEqual(['./A', './B']);
  });

  it('drops non-record array entries', () => {
    expect(normalizeExposes([null, 'x', { id: './A' }])).toEqual([{ id: './A' }]);
  });
});

describe('normalizeShared', () => {
  it('normalizes an array of {name, version, requiredVersion, singleton}', () => {
    const out = normalizeShared([
      { name: 'react', version: '18.0.0', requiredVersion: '^18.0.0', singleton: true },
    ]);
    expect(out).toEqual([
      { name: 'react', version: '18.0.0', requiredVersion: '^18.0.0', singleton: true },
    ]);
  });

  it('normalizes a map of name → bare version string', () => {
    const out = normalizeShared({ react: '^18.0.0' });
    expect(out[0]).toEqual({ name: 'react', requiredVersion: '^18.0.0' });
  });

  it('normalizes a map of name → {version, requiredVersion, singleton}', () => {
    const out = normalizeShared({
      'react-dom': { version: '18.0.0', requiredVersion: '^18.0.0', singleton: true },
    });
    expect(out[0]).toEqual({
      name: 'react-dom',
      version: '18.0.0',
      requiredVersion: '^18.0.0',
      singleton: true,
    });
  });

  it('sorts shared deps by name', () => {
    const out = normalizeShared([{ name: 'zod' }, { name: 'react' }]);
    expect(out.map(s => s.name)).toEqual(['react', 'zod']);
  });
});

describe('parseManifest', () => {
  it('parses a complete manifest', () => {
    const remote = parseManifest({
      name: 'app1',
      exposes: { './Widget': './src/Widget' },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0', singleton: true } },
    });
    expect(remote).not.toBeNull();
    expect(remote!.name).toBe('app1');
    expect(remote!.exposes.map(e => e.id)).toEqual(['./Widget']);
    expect(remote!.shared[0].name).toBe('react');
  });

  it('falls back to fallbackName when name is absent', () => {
    const remote = parseManifest({ exposes: {} }, 'fallback-remote');
    expect(remote!.name).toBe('fallback-remote');
  });

  it('returns null when no name is derivable', () => {
    expect(parseManifest({ exposes: {} })).toBeNull();
    expect(parseManifest('not an object')).toBeNull();
  });
});

describe('diffRemote (breaking-change detection)', () => {
  const base = parseManifest({
    name: 'app1',
    exposes: {
      './A': { import: './src/A', types: './dist/A.d.ts' },
      './B': { import: './src/B', types: './dist/B.d.ts' },
    },
    shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0' } },
  })!;

  it('flags a removed exposed module as breaking', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: { './A': { import: './src/A', types: './dist/A.d.ts' } },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.removedExposes).toEqual(['./B']);
    expect(diff.narrowedExposes).toEqual([]);
    expect(diff.changedShared).toEqual([]);
  });

  it('flags a changed types declaration as a type narrowing', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: {
        './A': { import: './src/A', types: './dist/A-changed.d.ts' },
        './B': { import: './src/B', types: './dist/B.d.ts' },
      },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.removedExposes).toEqual([]);
    expect(diff.narrowedExposes).toEqual([
      { id: './A', from: './dist/A.d.ts', to: './dist/A-changed.d.ts' },
    ]);
  });

  it('flags a removed types declaration as a narrowing (to undefined)', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: { './A': './src/A', './B': { import: './src/B', types: './dist/B.d.ts' } },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.narrowedExposes).toEqual([{ id: './A', from: './dist/A.d.ts', to: undefined }]);
  });

  it('flags a changed shared requiredVersion as breaking for consumers', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: {
        './A': { import: './src/A', types: './dist/A.d.ts' },
        './B': { import: './src/B', types: './dist/B.d.ts' },
      },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.2.0' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.changedShared).toEqual([{ name: 'react', from: '^18.0.0', to: '^18.2.0' }]);
  });

  it('a pure addition (new expose) is NOT breaking', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: {
        './A': { import: './src/A', types: './dist/A.d.ts' },
        './B': { import: './src/B', types: './dist/B.d.ts' },
        './C': { import: './src/C', types: './dist/C.d.ts' },
      },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.removedExposes).toEqual([]);
    expect(diff.narrowedExposes).toEqual([]);
    expect(diff.changedShared).toEqual([]);
  });

  it('a WIDENING of requiredVersion (^18.0.0 → ^18) is NOT breaking', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: {
        './A': { import: './src/A', types: './dist/A.d.ts' },
        './B': { import: './src/B', types: './dist/B.d.ts' },
      },
      shared: { react: { version: '18.0.0', requiredVersion: '^18' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.changedShared).toEqual([]);
  });

  it('an additive union (^18.0.0 → ^18.0.0 || ^19.0.0) is NOT breaking', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: {
        './A': { import: './src/A', types: './dist/A.d.ts' },
        './B': { import: './src/B', types: './dist/B.d.ts' },
      },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.0.0 || ^19.0.0' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.changedShared).toEqual([]);
  });

  it('a NARROWING of requiredVersion (^18.0.0 → ^18.2.0) IS breaking', () => {
    const current = parseManifest({
      name: 'app1',
      exposes: {
        './A': { import: './src/A', types: './dist/A.d.ts' },
        './B': { import: './src/B', types: './dist/B.d.ts' },
      },
      shared: { react: { version: '18.0.0', requiredVersion: '^18.2.0' } },
    })!;
    const diff = diffRemote(base, current);
    expect(diff.changedShared).toEqual([{ name: 'react', from: '^18.0.0', to: '^18.2.0' }]);
  });
});

describe('narrowsVersionRange', () => {
  it('returns false for equal ranges', () => {
    expect(narrowsVersionRange('^18.0.0', '^18.0.0')).toBe(false);
  });
  it('returns false for a widening', () => {
    expect(narrowsVersionRange('^18.0.0', '^18')).toBe(false);
  });
  it('returns true for a narrowing', () => {
    expect(narrowsVersionRange('^18.0.0', '^18.2.0')).toBe(true);
  });
});

describe('diffToFindings', () => {
  it('maps each diff field to a breaking finding', () => {
    const findings = diffToFindings('app1', {
      removedExposes: ['./B'],
      narrowedExposes: [{ id: './A', from: 'a.d.ts', to: 'a2.d.ts' }],
      changedShared: [{ name: 'react', from: '^18.0.0', to: '^18.2.0' }],
    });
    expect(findings.every(f => f.severity === 'breaking')).toBe(true);
    expect(findings.map(f => f.kind).sort()).toEqual([
      'expose-removed',
      'shared-narrowed',
      'type-narrowed',
    ]);
    expect(findings.every(f => f.remote === 'app1')).toBe(true);
  });
});

describe('detectSharedSkew', () => {
  it('reports skew when two remotes resolve a singleton shared dep to different versions', () => {
    const a = parseManifest({ name: 'a', shared: { react: { version: '18.0.0', singleton: true } } })!;
    const b = parseManifest({ name: 'b', shared: { react: { version: '18.2.0', singleton: true } } })!;
    const skews = detectSharedSkew([a, b]);
    expect(skews).toHaveLength(1);
    expect(skews[0].dep).toBe('react');
    const versions = skews[0].remotes.map(r => r.version).sort();
    expect(versions).toEqual(['18.0.0', '18.2.0']);
  });

  it('ignores version divergence on NON-singleton deps (each remote gets its own copy by design)', () => {
    const a = parseManifest({ name: 'a', shared: { lodash: { version: '4.0.0' } } })!;
    const b = parseManifest({ name: 'b', shared: { lodash: { version: '4.17.0' } } })!;
    expect(detectSharedSkew([a, b])).toEqual([]);
  });

  it('reports no skew when all remotes share the same version (healthy singleton)', () => {
    const a = parseManifest({ name: 'a', shared: { react: { version: '18.0.0', singleton: true } } })!;
    const b = parseManifest({ name: 'b', shared: { react: { version: '18.0.0', singleton: true } } })!;
    expect(detectSharedSkew([a, b])).toEqual([]);
  });

  it('does not report a single remote as skewed against itself', () => {
    // A degenerate manifest declaring the same dep twice — NOT cross-remote skew.
    const a = parseManifest({
      name: 'a',
      shared: [
        { name: 'react', version: '18.0.0', singleton: true },
        { name: 'react', version: '18.2.0', singleton: true },
      ],
    })!;
    expect(detectSharedSkew([a])).toEqual([]);
  });

  it('sorts skews by dependency name', () => {
    const a = parseManifest({ name: 'a', shared: { zod: { version: '3.0.0', singleton: true }, react: { version: '18.0.0', singleton: true } } })!;
    const b = parseManifest({ name: 'b', shared: { zod: { version: '3.1.0', singleton: true }, react: { version: '18.2.0', singleton: true } } })!;
    const skews = detectSharedSkew([a, b]);
    expect(skews.map(s => s.dep)).toEqual(['react', 'zod']);
  });
});

describe('skewToFindings', () => {
  it('produces a skew-severity finding with both versions', () => {
    const a = parseManifest({ name: 'a', shared: { react: { version: '18.0.0', singleton: true } } })!;
    const b = parseManifest({ name: 'b', shared: { react: { version: '18.2.0', singleton: true } } })!;
    const skew = detectSharedSkew([a, b])[0];
    const finding = skewToFindings(skew);
    expect(finding.severity).toBe('skew');
    expect(finding.kind).toBe('shared-skew');
    expect(finding.message).toMatch(/react/);
    expect(finding.detail?.versions).toEqual(['18.0.0', '18.2.0']);
  });
});

describe('contracts conformance', () => {
  it('a constructed federation response validates against federationResponseSchema', () => {
    const a = parseManifest({ name: 'a', exposes: { './A': './src/A' }, shared: { react: { version: '18.0.0', singleton: true } } })!;
    const b = parseManifest({ name: 'b', shared: { react: { version: '18.2.0', singleton: true } } })!;
    const skews = detectSharedSkew([a, b]);
    const findings = skews.map(skewToFindings);
    const payload = {
      pass: false,
      breakingCount: 0,
      skewCount: findings.length,
      hasBaseline: false,
      remotes: [a, b].map(r => ({
        name: r.name,
        manifest: `apps/${r.name}/federation-manifest.json`,
        exposes: r.exposes.map(e => ({ id: e.id })),
        shared: r.shared.map(s => ({ name: s.name, ...(s.version ? { version: s.version } : {}) })),
      })),
      findings: findings.map(f => ({
        severity: f.severity,
        kind: f.kind,
        message: f.message,
        ...(f.detail ? { detail: { ...f.detail } } : {}),
      })),
      warnings: [],
    };
    expect(federationResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown finding severity against the schema', () => {
    const payload = {
      pass: false,
      breakingCount: 0,
      skewCount: 0,
      hasBaseline: false,
      remotes: [],
      findings: [{ severity: 'catastrophe', kind: 'x', message: 'x' }],
      warnings: [],
    };
    expect(federationResponseSchema.safeParse(payload).success).toBe(false);
  });
});
