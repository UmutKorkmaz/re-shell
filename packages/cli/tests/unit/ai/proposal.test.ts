import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { indexCatalog } from '../../../src/ai/argv-guard';
import { validateProposal, type ProposalContext } from '../../../src/ai/proposal';
import type { RawProposal } from '../../../src/ai/types';
import { buildWorkspaceContext } from '../../../src/ai/workspace-context';
import { createFixtureWorkspace, fixtureCatalog } from './helpers';

function proposal(p: Partial<RawProposal> = {}): RawProposal {
  return {
    outcome: 'command',
    argv: [],
    confidence: 0.9,
    rationale: '',
    question: '',
    alternatives: [],
    ...p,
  };
}

describe('validateProposal (the gate between model output and execution)', () => {
  let ws: ReturnType<typeof createFixtureWorkspace>;
  let ctx: ProposalContext;

  beforeAll(async () => {
    ws = createFixtureWorkspace();
    ctx = {
      index: indexCatalog(fixtureCatalog()),
      workspace: await buildWorkspaceContext(ws.root),
      prompt: 'build the api',
    };
  });
  afterAll(() => ws.cleanup());

  it('resolves a valid proposal and records the real node it targets', () => {
    const r = validateProposal(
      proposal({ argv: ['run', 'build', '--filter', '@acme/api'], rationale: 'Build one package' }),
      ctx
    );
    expect(r.kind).toBe('resolved');
    if (r.kind === 'resolved') {
      expect(r.candidate.argv).toEqual(['run', 'build', '--filter', '@acme/api']);
      expect(r.candidate.nodes).toEqual([{ name: '@acme/api', path: 'packages/api', kind: 'package' }]);
      expect(r.candidate.confidence).toBeCloseTo(0.9);
      expect(r.explanation).toContain('Why: Build one package');
    }
  });

  it('rewrites a loosely-named node to its canonical name (small confidence cost)', () => {
    const r = validateProposal(proposal({ argv: ['run', 'build', '--filter', 'api'] }), ctx);
    expect(r.kind).toBe('resolved');
    if (r.kind === 'resolved') {
      expect(r.candidate.argv).toEqual(['run', 'build', '--filter', '@acme/api']);
      expect(r.candidate.confidence).toBeLessThan(0.9);
    }
  });

  it('refuses to invent a node: an unknown node becomes a clarification', () => {
    const r = validateProposal(proposal({ argv: ['run', 'build', '--filter', 'billing-engine'] }), ctx);
    expect(r.kind).toBe('clarify');
    if (r.kind === 'clarify') {
      expect(r.reason).toBe('unknown-node');
      expect(r.question).toContain('billing-engine');
      expect(r.candidates).toEqual([]);
    }
  });

  it('turns an ambiguous node into a clarification with real candidates', () => {
    const r = validateProposal(proposal({ argv: ['run', 'build', '--filter', 'payments'] }), ctx);
    expect(r.kind).toBe('clarify');
    if (r.kind === 'clarify') {
      expect(r.reason).toBe('ambiguous-node');
      expect(r.candidates.map(c => c.argv[3]).sort()).toEqual([
        '@acme/payments-db',
        '@acme/payments-service',
      ]);
    }
  });

  it('enforces node references on positionals declared as services', () => {
    const ok = validateProposal(proposal({ argv: ['service', 'run', 'restart', 'orders'] }), ctx);
    expect(ok.kind).toBe('resolved');
    const bad = validateProposal(proposal({ argv: ['service', 'run', 'restart', 'ghost-svc'] }), ctx);
    expect(bad.kind).toBe('clarify');
  });

  it('does not enforce node references for a "new name" positional', () => {
    const r = validateProposal(proposal({ argv: ['create', 'brand-new-app'] }), ctx);
    expect(r.kind).toBe('resolved');
  });

  it.each([
    ['unknown command', ['frobnicate', 'x']],
    ['unknown flag', ['run', 'build', '--no-verify']],
    ['shell metacharacters in a value', ['run', 'build', '--filter', 'api;rm']],
    ['command substitution', ['run', '$(whoami)']],
    ['path traversal', ['run', 'build', '--filter', '../../etc']],
    ['the ai command itself', ['ai', 'build the api']],
    ['too many positionals', ['run', 'build', 'test']],
    ['flag injection through a value', ['run', 'build', '--filter', '--json']],
  ])('rejects %s without executing or repairing it', (_name, argv) => {
    const r = validateProposal(proposal({ argv }), ctx);
    expect(r.kind).toBe('invalid');
  });

  it('validates every alternative and silently drops the bad ones', () => {
    const r = validateProposal(
      proposal({
        argv: ['run', 'build', '--filter', '@acme/api'],
        alternatives: [
          { argv: ['run', 'test', '--filter', '@acme/api'], confidence: 0.4 },
          { argv: ['rm', '-rf', '/'], confidence: 0.99 },
          { argv: ['run', 'build', '--filter', '@acme/api'], confidence: 0.5 }, // duplicate of primary
        ],
      }),
      ctx
    );
    expect(r.kind).toBe('resolved');
    if (r.kind === 'resolved') {
      expect(r.alternatives.map(a => a.argv)).toEqual([['run', 'test', '--filter', '@acme/api']]);
    }
  });

  it('adds --json only when the prompt asks for it and the command supports it', () => {
    const withJson = validateProposal(proposal({ argv: ['run', 'build', '--filter', '@acme/api'] }), {
      ...ctx,
      prompt: 'build the api and give me json',
    });
    expect(withJson.kind === 'resolved' && withJson.candidate.argv).toContain('--json');
    const noJson = validateProposal(proposal({ argv: ['service', 'run', 'restart', 'orders'] }), {
      ...ctx,
      prompt: 'restart orders as json',
    });
    // `service run restart` does not support --json, so none is invented.
    expect(noJson.kind === 'resolved' && noJson.candidate.argv).not.toContain('--json');
  });

  it('turns low confidence into a clarification, not a resolution', () => {
    const r = validateProposal(
      proposal({
        argv: ['run', 'build', '--filter', '@acme/api'],
        confidence: 0.3,
        alternatives: [{ argv: ['run', 'test', '--filter', '@acme/api'], confidence: 0.3 }],
      }),
      ctx
    );
    expect(r.kind).toBe('clarify');
    if (r.kind === 'clarify') {
      expect(r.reason).toBe('low-confidence');
      expect(r.candidates).toHaveLength(2);
    }
  });

  it('holds destructive commands to a higher confidence bar', () => {
    const lowish = validateProposal(proposal({ argv: ['service', 'run', 'down'], confidence: 0.6 }), ctx);
    expect(lowish.kind).toBe('clarify');
    if (lowish.kind === 'clarify') expect(lowish.reason).toBe('destructive-low-confidence');
    const sure = validateProposal(proposal({ argv: ['service', 'run', 'down'], confidence: 0.95 }), ctx);
    expect(sure.kind).toBe('resolved');
    if (sure.kind === 'resolved') expect(sure.candidate.destructive).toBe(true);
  });

  it('flags missing required arguments and penalises them', () => {
    const r = validateProposal(proposal({ argv: ['templates', 'show'], confidence: 0.9 }), ctx);
    expect(r.kind).toBe('resolved');
    if (r.kind === 'resolved') {
      expect(r.candidate.missingArgs).toEqual(['id']);
      expect(r.candidate.confidence).toBeLessThan(0.9);
    }
  });

  it('passes a clarify outcome through with validated candidates only', () => {
    const r = validateProposal(
      proposal({
        outcome: 'clarify',
        question: 'Which service do you want to restart?',
        alternatives: [
          { argv: ['service', 'run', 'restart', 'orders'], confidence: 0.5 },
          { argv: ['service', 'run', 'restart', 'ghost'], confidence: 0.5 },
          { argv: ['evil'], confidence: 0.9 },
        ],
      }),
      ctx
    );
    expect(r.kind).toBe('clarify');
    if (r.kind === 'clarify') {
      expect(r.question).toBe('Which service do you want to restart?');
      expect(r.candidates.map(c => c.argv)).toEqual([['service', 'run', 'restart', 'orders']]);
    }
  });

  it('turns "unsupported" into a no-match clarification', () => {
    const r = validateProposal(proposal({ outcome: 'unsupported' }), ctx);
    expect(r.kind).toBe('clarify');
    if (r.kind === 'clarify') expect(r.reason).toBe('no-match');
  });

  it('strips control characters from model-authored text', () => {
    const r = validateProposal(
      proposal({ outcome: 'clarify', question: 'Pick one\u001b[31m\nplease\u0007' }),
      ctx
    );
    expect(r.kind === 'clarify' && r.question).toBe('Pick one [31m please');
  });
});
