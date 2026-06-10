import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONFIDENCE_THRESHOLD,
  resolveCommand,
  tokenize,
  type AllowedCommand,
} from './resolve-command';

/**
 * A small stand-in for the hub allow-list. In the app this is derived from the
 * command registry; the resolver only needs the metadata shape, so the tests
 * exercise it directly with no React and no network.
 */
const ALLOWED: readonly AllowedCommand[] = [
  {
    id: 'workspace.health',
    title: 'Workspace health',
    description: 'Health checks for the current workspace.',
    keywords: ['doctor', 'diagnostics', 'healthy', 'status'],
  },
  {
    id: 'workspace.summary',
    title: 'Workspace summary',
    description: 'Machine-readable summary of the current workspace.',
    keywords: ['overview'],
  },
  {
    id: 'workspace.graph',
    title: 'Workspace dependency graph',
    description: 'Dependency graph of the current workspace.',
    keywords: ['deps', 'dependencies', 'topology'],
  },
  {
    id: 'templates.list',
    title: 'List templates',
    description: 'List available framework templates.',
    keywords: ['scaffold', 'starter'],
  },
  {
    id: 'analyze',
    title: 'Analyze',
    description: 'Analyze bundles, dependencies, performance, and security.',
    keywords: ['bundle', 'performance', 'security'],
  },
];

describe('tokenize', () => {
  it('lower-cases and splits on non-alphanumeric runs (dash is kept)', () => {
    expect(tokenize('Workspace.Health --json!')).toEqual(['workspace', 'health', '--json']);
  });

  it('drops empty tokens from punctuation', () => {
    expect(tokenize('  hello,,, world  ')).toEqual(['hello', 'world']);
  });
});

describe('resolveCommand', () => {
  it('resolves the health intent to workspace.health (issue acceptance)', () => {
    const result = resolveCommand('is my workspace healthy?', ALLOWED);
    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.commandId).toBe('workspace.health');
      expect(result.confidence).toBeGreaterThanOrEqual(DEFAULT_CONFIDENCE_THRESHOLD);
      expect(result.matched).toContain('workspace');
    }
  });

  it('matches a keyword synonym not present in the title/description', () => {
    const result = resolveCommand('show me the dependency graph', ALLOWED);
    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.commandId).toBe('workspace.graph');
    }
  });

  it('resolves a templates request', () => {
    const result = resolveCommand('list available templates', ALLOWED);
    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.commandId).toBe('templates.list');
    }
  });

  it('returns no-match for an out-of-allowlist / unsupported request', () => {
    const result = resolveCommand('delete the production database', ALLOWED);
    expect(result.kind).toBe('no-match');
    if (result.kind === 'no-match') {
      expect(result.reason).toBe('below-threshold');
    }
  });

  it('returns no-match (empty) for a blank or all-stop-word query', () => {
    expect(resolveCommand('   ', ALLOWED)).toEqual({ kind: 'no-match', reason: 'empty' });
    expect(resolveCommand('please can you show me', ALLOWED)).toEqual({
      kind: 'no-match',
      reason: 'empty',
    });
  });

  it('never returns an id outside the supplied allow-list', () => {
    const queries = [
      'analyze the bundle for security issues',
      'workspace summary overview',
      'dependency topology',
      'healthy doctor diagnostics',
    ];
    const allowedIds = new Set(ALLOWED.map((c) => c.id));
    for (const q of queries) {
      const r = resolveCommand(q, ALLOWED);
      if (r.kind === 'match') {
        expect(allowedIds.has(r.commandId)).toBe(true);
      }
    }
  });

  it('is deterministic — same query yields the same result', () => {
    const a = resolveCommand('analyze bundle performance security', ALLOWED);
    const b = resolveCommand('analyze bundle performance security', ALLOWED);
    expect(a).toEqual(b);
    expect(a.kind).toBe('match');
    if (a.kind === 'match') {
      expect(a.commandId).toBe('analyze');
    }
  });

  it('respects a custom threshold (raising it can force a refusal)', () => {
    // "machine-readable" only appears in workspace.summary's description (the
    // lowest-weighted field), so it is a soft match: cleared by a lenient bar,
    // refused by a near-perfect one.
    const lenient = resolveCommand('machine-readable', ALLOWED, { threshold: 0.1 });
    expect(lenient.kind).toBe('match');

    const strict = resolveCommand('machine-readable', ALLOWED, { threshold: 0.99 });
    expect(strict.kind).toBe('no-match');
  });

  it('returns no-match against an empty allow-list', () => {
    const result = resolveCommand('workspace health', []);
    expect(result.kind).toBe('no-match');
  });
});
