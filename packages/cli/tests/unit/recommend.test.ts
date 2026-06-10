import { describe, expect, it } from 'vitest';
import {
  recommendTemplates,
  buildRationale,
  buildTemplateCorpus,
  applyPhraser,
  type RationalePhraser,
} from '../../src/utils/recommend';
import { recommendResponseSchema } from '@re-shell/contracts';

describe('buildTemplateCorpus', () => {
  it('produces template-only docs from the backend registry', () => {
    const corpus = buildTemplateCorpus();
    expect(corpus.length).toBeGreaterThan(100);
    expect(corpus.every(d => d.type === 'template')).toBe(true);
  });
});

describe('buildRationale', () => {
  it('joins matched terms with the language/framework and category', () => {
    const text = buildRationale(['async', 'api'], {
      language: 'python',
      framework: 'FastAPI',
      tags: ['backend', 'rest'],
    });
    expect(text).toBe('Matches "async, api"; python/FastAPI · backend');
  });

  it('omits the metadata clause when no language/framework/category exist', () => {
    expect(buildRationale(['express'], {})).toBe('Matches "express"');
  });

  it('is deterministic for the same inputs', () => {
    const meta = { language: 'go', framework: 'gin', tags: ['microservice'] };
    expect(buildRationale(['go'], meta)).toBe(buildRationale(['go'], meta));
  });
});

describe('recommendTemplates', () => {
  it('returns only templates, each with a non-empty rationale and matched terms', () => {
    const recs = recommendTemplates('express rest api', { limit: 5 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.length).toBeLessThanOrEqual(5);
    for (const r of recs) {
      expect(r.rationale.length).toBeGreaterThan(0);
      expect(r.matched.length).toBeGreaterThan(0);
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it('surfaces the express template for an express query', () => {
    const recs = recommendTemplates('express', { limit: 5 });
    expect(recs.some(r => r.id === 'express')).toBe(true);
  });

  it('surfaces grpc templates for a "grpc service" query with rationale', () => {
    const recs = recommendTemplates('grpc service', { limit: 6 });
    const ids = recs.map(r => r.id);
    expect(ids).toContain('grpc-service');
    expect(ids).toContain('grpc-go');
    for (const r of recs) {
      expect(r.rationale.length).toBeGreaterThan(0);
    }
  });

  it('surfaces graphql servers for a "graphql server" query with rationale', () => {
    const recs = recommendTemplates('graphql server', { limit: 6 });
    const ids = recs.map(r => r.id);
    expect(ids).toContain('apollo-server');
    expect(ids).toContain('graphql-yoga');
    expect(recs.every(r => r.rationale.length > 0)).toBe(true);
  });

  it('surfaces a websocket/async template for an "async API" query', () => {
    const recs = recommendTemplates('async API websockets', { limit: 6 });
    expect(recs.some(r => r.id === 'websocket-api-docs')).toBe(true);
    expect(recs.every(r => r.rationale.length > 0)).toBe(true);
  });

  it('surfaces react templates for a "static site react" query', () => {
    const recs = recommendTemplates('static site react', { limit: 6 });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.framework?.includes('react') || r.id.includes('react'))).toBe(true);
    expect(recs.every(r => r.rationale.length > 0 && r.matched.length > 0)).toBe(true);
  });

  it('ranks offline with no embeddings env configured (default path)', () => {
    // The default path must never read embeddings/LLM env vars; assert that
    // recommendations are produced regardless of their presence or absence.
    const before = process.env.RE_SHELL_EMBEDDINGS;
    delete process.env.RE_SHELL_EMBEDDINGS;
    try {
      const recs = recommendTemplates('grpc service', { limit: 3 });
      expect(recs.length).toBeGreaterThan(0);
      expect(recs.every(r => r.score > 0)).toBe(true);
    } finally {
      if (before !== undefined) process.env.RE_SHELL_EMBEDDINGS = before;
    }
  });

  it('respects the limit', () => {
    const recs = recommendTemplates('api', { limit: 3 });
    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it('is deterministic across repeated calls', () => {
    const a = recommendTemplates('async api websockets', { limit: 5 });
    const b = recommendTemplates('async api websockets', { limit: 5 });
    expect(a).toEqual(b);
  });

  it('produces a payload that validates against recommendResponseSchema', () => {
    const results = recommendTemplates('high-throughput async API', { limit: 5 });
    const payload = { query: 'high-throughput async API', limit: 5, results };
    const parsed = recommendResponseSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('returns nothing for a query of only stop-words', () => {
    expect(recommendTemplates('the a of', { limit: 5 })).toEqual([]);
  });
});

describe('applyPhraser', () => {
  it('rewrites only the rationale and preserves ids, scores, and order', async () => {
    const base = recommendTemplates('express api', { limit: 3 });
    const phraser: RationalePhraser = {
      name: 'test',
      async phrase(_q, recs) {
        return recs.map(r => ({ ...r, rationale: `rephrased: ${r.id}` }));
      },
    };
    const out = await applyPhraser(phraser, 'express api', base);
    expect(out.map(r => r.id)).toEqual(base.map(r => r.id));
    expect(out.map(r => r.score)).toEqual(base.map(r => r.score));
    expect(out.every((r, i) => r.rationale === `rephrased: ${base[i].id}`)).toBe(true);
  });

  it('keeps the original rationale when the phraser returns an empty string', async () => {
    const base = recommendTemplates('express', { limit: 2 });
    const phraser: RationalePhraser = {
      name: 'empty',
      async phrase(_q, recs) {
        return recs.map(r => ({ ...r, rationale: '' }));
      },
    };
    const out = await applyPhraser(phraser, 'express', base);
    expect(out.map(r => r.rationale)).toEqual(base.map(r => r.rationale));
  });
});
