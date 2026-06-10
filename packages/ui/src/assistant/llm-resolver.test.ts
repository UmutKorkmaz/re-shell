import { describe, expect, it } from 'vitest';
import { applyLlmResolver, type LlmResolver } from './llm-resolver';
import type { AllowedCommand } from './resolve-command';

const ALLOWED: readonly AllowedCommand[] = [
  { id: 'workspace.health', title: 'Workspace health', description: 'Health checks.' },
  { id: 'analyze', title: 'Analyze', description: 'Analyze bundles.' },
];

function fixedResolver(proposal: Awaited<ReturnType<LlmResolver['propose']>>): LlmResolver {
  return { name: 'fixed', propose: async () => proposal };
}

describe('applyLlmResolver', () => {
  it('honours a proposal whose id is in the allow-list', async () => {
    const result = await applyLlmResolver(
      fixedResolver({ commandId: 'workspace.health', confidence: 0.8 }),
      'is it healthy',
      ALLOWED
    );
    expect(result).toEqual({
      kind: 'match',
      commandId: 'workspace.health',
      confidence: 0.8,
      matched: [],
    });
  });

  it('rejects a hallucinated id not in the allow-list (defensive filter)', async () => {
    const result = await applyLlmResolver(
      fixedResolver({ commandId: 'rm -rf', confidence: 1 }),
      'delete everything',
      ALLOWED
    );
    expect(result.kind).toBe('no-match');
  });

  it('treats an abstention (null) as no-match', async () => {
    const result = await applyLlmResolver(fixedResolver(null), 'hmm', ALLOWED);
    expect(result.kind).toBe('no-match');
  });

  it('clamps an out-of-range confidence into [0,1]', async () => {
    const high = await applyLlmResolver(
      fixedResolver({ commandId: 'analyze', confidence: 5 }),
      'analyze',
      ALLOWED
    );
    expect(high.kind === 'match' && high.confidence).toBe(1);

    const low = await applyLlmResolver(
      fixedResolver({ commandId: 'analyze', confidence: -2 }),
      'analyze',
      ALLOWED
    );
    expect(low.kind === 'match' && low.confidence).toBe(0);
  });

  it('defaults confidence to 1 when the adapter omits it', async () => {
    const result = await applyLlmResolver(
      fixedResolver({ commandId: 'analyze' }),
      'analyze',
      ALLOWED
    );
    expect(result.kind === 'match' && result.confidence).toBe(1);
  });
});
