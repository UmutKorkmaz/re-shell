import { describe, expect, it } from 'vitest';
import {
  rankDocs,
  tokenize,
  applyReranker,
  FIELD_WEIGHTS,
  type IndexDoc,
  type EmbeddingReranker,
} from '../../src/utils/find-index';
import type { FindResult } from '@re-shell/contracts';

/**
 * Build a minimal corpus that mirrors the real shape: an id field (highest
 * weight), a tags field, and a description field (lowest weight).
 */
function doc(
  type: 'command' | 'template',
  id: string,
  tags: string,
  description: string
): IndexDoc {
  return {
    type,
    id,
    title: id,
    usage: `re-shell ${id}`,
    fields: [
      { text: id, weight: FIELD_WEIGHTS.id },
      { text: tags, weight: FIELD_WEIGHTS.tags },
      { text: description, weight: FIELD_WEIGHTS.description },
    ],
  };
}

const corpus: IndexDoc[] = [
  doc('command', 'k8s manifests', 'kubernetes k8s yaml', 'Generate Kubernetes manifests'),
  doc('command', 'workspace health', 'status check', 'Report workspace health'),
  doc('template', 'express', 'typescript node rest api', 'Express REST API server'),
  doc('template', 'react-spa', 'typescript react frontend', 'A React single page app'),
];

describe('tokenize', () => {
  it('lower-cases and splits on non-word runs, dropping shell metacharacters', () => {
    expect(tokenize('Deploy K8s; rm -rf $(pwd)')).toEqual([
      'deploy',
      'k8s',
      'rm',
      '-rf',
      'pwd',
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('rankDocs', () => {
  it('ranks the matching command first for an on-topic query', () => {
    const results = rankDocs('kubernetes manifests', corpus, { limit: 10 });
    expect(results[0].id).toBe('k8s manifests');
    expect(results[0].type).toBe('command');
  });

  it('weights an id/title hit above a description-only hit', () => {
    const results = rankDocs('express', corpus, { limit: 10 });
    expect(results[0].id).toBe('express');
    // 'express' is an exact id hit -> should approach max confidence.
    expect(results[0].score).toBeGreaterThan(0.5);
  });

  it('reports the query terms that contributed to each hit', () => {
    const results = rankDocs('react frontend', corpus, { limit: 10 });
    const spa = results.find(r => r.id === 'react-spa');
    expect(spa).toBeDefined();
    expect(spa?.matched).toEqual(['react', 'frontend']);
  });

  it('drops documents with zero matches', () => {
    const results = rankDocs('react', corpus, { limit: 10 });
    expect(results.every(r => r.id !== 'k8s manifests')).toBe(true);
  });

  it('returns nothing for a query of only stop-words', () => {
    expect(rankDocs('the a of to', corpus, { limit: 10 })).toEqual([]);
  });

  it('returns nothing for an empty query', () => {
    expect(rankDocs('', corpus, { limit: 10 })).toEqual([]);
  });

  it('does not let a 1–2 char field token fuzzy-match a long query term', () => {
    const tiny: IndexDoc[] = [
      { type: 'command', id: 'x', title: 'x', fields: [{ text: 'x', weight: 5 }] },
    ];
    expect(rankDocs('zzzqqqxx', tiny, { limit: 10 })).toEqual([]);
  });

  it('honours the --type filter', () => {
    const onlyTemplates = rankDocs('typescript', corpus, { limit: 10, type: 'template' });
    expect(onlyTemplates.length).toBeGreaterThan(0);
    expect(onlyTemplates.every(r => r.type === 'template')).toBe(true);

    const onlyCommands = rankDocs('typescript', corpus, { limit: 10, type: 'command' });
    expect(onlyCommands.every(r => r.type === 'command')).toBe(true);
  });

  it('clamps to the requested limit', () => {
    const results = rankDocs('typescript', corpus, { limit: 1 });
    expect(results.length).toBe(1);
  });

  it('is deterministic: identical inputs yield identical output', () => {
    const a = rankDocs('typescript api', corpus, { limit: 10 });
    const b = rankDocs('typescript api', corpus, { limit: 10 });
    expect(a).toEqual(b);
  });

  it('keyword fallback ranks with NO embeddings env set (offline default path)', () => {
    // Guarantee no embeddings provider is configured for this case.
    const prev = process.env.RE_SHELL_EMBEDDINGS;
    delete process.env.RE_SHELL_EMBEDDINGS;
    try {
      const results = rankDocs('kubernetes manifests', corpus, { limit: 10 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('k8s manifests');
    } finally {
      if (prev !== undefined) process.env.RE_SHELL_EMBEDDINGS = prev;
    }
  });

  it('is env-independent: ranking ignores RE_SHELL_EMBEDDINGS entirely', () => {
    const prev = process.env.RE_SHELL_EMBEDDINGS;
    try {
      delete process.env.RE_SHELL_EMBEDDINGS;
      const off = rankDocs('typescript api', corpus, { limit: 10 });
      process.env.RE_SHELL_EMBEDDINGS = 'some-provider';
      const on = rankDocs('typescript api', corpus, { limit: 10 });
      // The pure ranker is offline and never consults the env, so output is identical.
      expect(on).toEqual(off);
    } finally {
      if (prev !== undefined) process.env.RE_SHELL_EMBEDDINGS = prev;
      else delete process.env.RE_SHELL_EMBEDDINGS;
    }
  });

  it('breaks ties by command-before-template then id lexicographically', () => {
    // Two docs with the exact same single-field exact hit.
    const tied: IndexDoc[] = [
      { type: 'template', id: 'zeta', title: 'zeta', fields: [{ text: 'match', weight: 5 }] },
      { type: 'command', id: 'beta', title: 'beta', fields: [{ text: 'match', weight: 5 }] },
      { type: 'template', id: 'alpha', title: 'alpha', fields: [{ text: 'match', weight: 5 }] },
    ];
    const results = rankDocs('match', tied, { limit: 10 });
    expect(results.map(r => r.id)).toEqual(['beta', 'alpha', 'zeta']);
  });
});

describe('applyReranker (pluggable, defensive)', () => {
  it('only ever emits ids from the original keyword result set', async () => {
    const original = rankDocs('typescript', corpus, { limit: 10 });

    // A hostile reranker that reverses order AND tries to inject a fake hit.
    const reranker: EmbeddingReranker = {
      name: 'test',
      async rerank(_query, results): Promise<FindResult[]> {
        const fake: FindResult = {
          type: 'command',
          id: '__injected__',
          title: 'injected',
          score: 1,
          matched: [],
        };
        return [fake, ...[...results].reverse()];
      },
    };

    const safe = await applyReranker(reranker, 'typescript', original);
    expect(safe.some(r => r.id === '__injected__')).toBe(false);
    // It is a reordering of the original vetted objects.
    expect(new Set(safe.map(r => r.id))).toEqual(new Set(original.map(r => r.id)));
    // Emits the ORIGINAL objects (reference identity), not adapter copies.
    for (const r of safe) {
      expect(original).toContain(r);
    }
  });
});
