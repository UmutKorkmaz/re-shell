import { describe, it, expect } from 'vitest';
import {
  evaluateBoundaries,
  matchesTags,
  DEFAULT_BOUNDARY_RULES,
  type BoundaryPackage,
  type BoundaryEdge,
} from '../../src/utils/boundaries-engine';
import { boundariesResponseSchema } from '@re-shell/contracts';

/** Pure-engine conformance for `re-shell boundaries` (issue #20). */

describe('matchesTags', () => {
  it('matches when every matcher key equals the tag', () => {
    expect(matchesTags({ layer: 'domain', scope: 'billing' }, { layer: 'domain' })).toBe(true);
  });
  it('does not match when any key differs', () => {
    expect(matchesTags({ layer: 'ui' }, { layer: 'domain' })).toBe(false);
    expect(matchesTags({}, { layer: 'domain' })).toBe(false);
  });
  it('an empty matcher matches everything', () => {
    expect(matchesTags({}, {})).toBe(true);
  });
});

describe('evaluateBoundaries', () => {
  const packages: BoundaryPackage[] = [
    { name: 'shell', tags: { scope: 'shell', layer: 'shell' }, declaredDeps: ['ui-kit', 'billing-domain'] },
    { name: 'ui-kit', tags: { type: 'ui', layer: 'ui' }, declaredDeps: [] },
    { name: 'billing-domain', tags: { type: 'core', layer: 'domain' }, declaredDeps: [] },
    { name: 'remote-internal', tags: { kind: 'remote-internal' }, declaredDeps: [] },
  ];

  it('flags a domain→ui import as a disallowed-import', () => {
    const edges: BoundaryEdge[] = [{ from: 'billing-domain', to: 'ui-kit', file: 'src/x.ts' }];
    const violations = evaluateBoundaries(packages, edges, DEFAULT_BOUNDARY_RULES);
    const disallowed = violations.filter(v => v.kind === 'disallowed-import');
    expect(disallowed).toHaveLength(1);
    expect(disallowed[0]!.ruleId).toBe('no-domain-imports-ui');
    expect(disallowed[0]!.from).toBe('billing-domain');
    expect(disallowed[0]!.to).toBe('ui-kit');
    expect(disallowed[0]!.file).toBe('src/x.ts');
  });

  it('flags the shell importing a remote internal', () => {
    const edges: BoundaryEdge[] = [{ from: 'shell', to: 'remote-internal' }];
    const violations = evaluateBoundaries(packages, edges, DEFAULT_BOUNDARY_RULES);
    expect(violations.some(v => v.kind === 'disallowed-import' && v.ruleId === 'shell-isolates-remote-internals')).toBe(true);
  });

  it('does NOT flag an allowed import (shell → ui-kit)', () => {
    const edges: BoundaryEdge[] = [{ from: 'shell', to: 'ui-kit' }];
    const violations = evaluateBoundaries(packages, edges, DEFAULT_BOUNDARY_RULES);
    expect(violations.filter(v => v.kind === 'disallowed-import')).toHaveLength(0);
  });

  it('flags an undeclared dependency (shell imports remote-internal without declaring it)', () => {
    const edges: BoundaryEdge[] = [{ from: 'shell', to: 'remote-internal' }];
    const violations = evaluateBoundaries(packages, edges, DEFAULT_BOUNDARY_RULES);
    // shell's declaredDeps are [ui-kit, billing-domain]; remote-internal is not declared.
    expect(violations.some(v => v.kind === 'undeclared-dependency' && v.to === 'remote-internal')).toBe(true);
  });

  it('does NOT flag a declared dependency as undeclared', () => {
    const edges: BoundaryEdge[] = [{ from: 'shell', to: 'ui-kit' }];
    const violations = evaluateBoundaries(packages, edges, DEFAULT_BOUNDARY_RULES);
    expect(violations.filter(v => v.kind === 'undeclared-dependency')).toHaveLength(0);
  });

  it('ignores self-imports', () => {
    const edges: BoundaryEdge[] = [{ from: 'shell', to: 'shell' }];
    expect(evaluateBoundaries(packages, edges, DEFAULT_BOUNDARY_RULES)).toEqual([]);
  });

  it('produces a deterministic ordering (disallowed before undeclared, then from/to/file)', () => {
    const edges: BoundaryEdge[] = [
      { from: 'billing-domain', to: 'ui-kit' }, // disallowed + undeclared
      { from: 'shell', to: 'remote-internal' }, // disallowed + undeclared
    ];
    const violations = evaluateBoundaries(packages, edges, DEFAULT_BOUNDARY_RULES);
    // All disallowed-imports come first.
    const kinds = violations.map(v => v.kind);
    const firstUndeclared = kinds.indexOf('undeclared-dependency');
    const lastDisallowed = kinds.lastIndexOf('disallowed-import');
    expect(firstUndeclared).toBeGreaterThan(lastDisallowed);
  });

  it('respects a custom ruleset', () => {
    const customRules = [
      { id: 'ui-no-ui', from: { layer: 'ui' }, disallow: { layer: 'ui' }, reason: 'ui must not import ui' },
    ];
    const edges: BoundaryEdge[] = [{ from: 'ui-kit', to: 'ui-kit-extra' }];
    const pkgs: BoundaryPackage[] = [
      ...packages,
      { name: 'ui-kit-extra', tags: { layer: 'ui' }, declaredDeps: [] },
    ];
    const violations = evaluateBoundaries(pkgs, edges, customRules);
    expect(violations.filter(v => v.kind === 'disallowed-import')).toHaveLength(1);
  });
});

describe('contracts conformance', () => {
  it('a constructed boundaries response validates against boundariesResponseSchema', () => {
    const violations = evaluateBoundaries(
      [
        { name: 'shell', tags: { layer: 'shell' }, declaredDeps: [] },
        { name: 'ui', tags: { layer: 'ui' }, declaredDeps: [] },
      ],
      [{ from: 'shell', to: 'ui' }],
      DEFAULT_BOUNDARY_RULES
    );
    const payload = {
      pass: violations.length === 0,
      disallowedCount: violations.filter(v => v.kind === 'disallowed-import').length,
      undeclaredCount: violations.filter(v => v.kind === 'undeclared-dependency').length,
      rules: DEFAULT_BOUNDARY_RULES.length,
      violations: violations.map(v => ({
        kind: v.kind,
        ...(v.ruleId ? { ruleId: v.ruleId } : {}),
        from: v.from,
        to: v.to,
        ...(v.file ? { file: v.file } : {}),
        message: v.message,
      })),
      warnings: [],
    };
    expect(boundariesResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown violation kind against the schema', () => {
    const payload = {
      pass: false,
      disallowedCount: 1,
      undeclaredCount: 0,
      rules: 1,
      violations: [{ kind: 'mystery', from: 'a', to: 'b', message: 'x' }],
      warnings: [],
    };
    expect(boundariesResponseSchema.safeParse(payload).success).toBe(false);
  });
});
