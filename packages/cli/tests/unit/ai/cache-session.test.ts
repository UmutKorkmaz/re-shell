import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { SemanticCache, catalogSignature, type CachedResolution } from '../../../src/ai/cache';
import {
  SESSION_ID_PATTERN,
  SessionError,
  SessionStore,
  collectResolvedHistory,
  historyForModel,
  isValidSessionId,
  newSessionId,
  storablePrompt,
} from '../../../src/ai/session';
import { normalizeText } from '../../../src/ai/text';
import type { IntentCandidate } from '../../../src/utils/ai-intent';
import { tmpDir } from './helpers';

function candidate(argv: string[], confidence = 0.9): IntentCandidate {
  return {
    path: argv[0],
    description: 'd',
    argv,
    confidence,
    destructive: false,
    supportsJson: true,
    supportsDryRun: false,
  };
}

function resolution(argv: string[]): CachedResolution {
  return { candidate: candidate(argv), alternatives: [], explanation: `Runs ${argv.join(' ')}` };
}

const SCOPE = { provider: 'offline' as const, fingerprint: 'fp1:cat1' };

describe('SemanticCache', () => {
  function makeCache(opts: { ttl?: number; max?: number; now?: () => number } = {}) {
    const t = tmpDir();
    const cache = new SemanticCache(path.join(t.dir, 'ai'), {
      ttlSeconds: opts.ttl ?? 3600,
      maxEntries: opts.max,
      now: opts.now,
    });
    return { cache, t };
  }

  it('hits on an equivalent prompt (case, punctuation, stop-words, order, synonyms)', () => {
    const { cache, t } = makeCache();
    try {
      cache.store('Build the payments service', SCOPE, resolution(['run', 'build', '--filter', 'p']));
      for (const variant of [
        'build the payments service',
        'please BUILD payments service!!',
        'payments service, build it',
        'compile the payment services',
      ]) {
        const hit = cache.lookup(variant, SCOPE);
        expect(hit, variant).toBeDefined();
        expect(hit!.result.candidate.argv).toEqual(['run', 'build', '--filter', 'p']);
        expect(hit!.similarity).toBeGreaterThanOrEqual(0.82);
      }
    } finally {
      t.cleanup();
    }
  });

  it('misses on prompts that differ in a meaningful word', () => {
    const { cache, t } = makeCache();
    try {
      cache.store('create service orders', SCOPE, resolution(['create', 'orders']));
      expect(cache.lookup('create service payments', SCOPE)).toBeUndefined();
      expect(cache.lookup('delete service orders', SCOPE)).toBeUndefined();
      expect(cache.lookup('do not create service orders', SCOPE)).toBeUndefined();
      expect(cache.lookup('list templates', SCOPE)).toBeUndefined();
      expect(cache.lookup('', SCOPE)).toBeUndefined();
    } finally {
      t.cleanup();
    }
  });

  it('keys entries by provider, model and workspace/catalogue fingerprint', () => {
    const { cache, t } = makeCache();
    try {
      cache.store('list templates', { provider: 'anthropic', model: 'claude-opus-5-5', fingerprint: 'fp1' }, resolution(['templates', 'list']));
      expect(cache.lookup('list templates', { provider: 'anthropic', model: 'claude-opus-5-5', fingerprint: 'fp1' })).toBeDefined();
      expect(cache.lookup('list templates', { provider: 'offline', fingerprint: 'fp1' })).toBeUndefined();
      expect(cache.lookup('list templates', { provider: 'anthropic', model: 'claude-haiku-4-5', fingerprint: 'fp1' })).toBeUndefined();
      expect(cache.lookup('list templates', { provider: 'anthropic', model: 'claude-opus-5-5', fingerprint: 'fp2' })).toBeUndefined();
    } finally {
      t.cleanup();
    }
  });

  it('tolerates typos in out-of-vocabulary words but never in protected identity tokens', () => {
    const { cache, t } = makeCache();
    try {
      cache.store('deploy checkout service', SCOPE, resolution(['k8s', 'generate']));
      expect(cache.lookup('deploy chekout service', SCOPE)).toBeDefined();
      const guarded = new Set(normalizeText('checkout').tokens);
      expect(cache.lookup('deploy chekout service', SCOPE, guarded)).toBeUndefined();
    } finally {
      t.cleanup();
    }
  });

  it('dedups: storing an equivalent prompt refreshes the entry instead of adding another', () => {
    const { cache, t } = makeCache();
    try {
      expect(cache.store('build the api', SCOPE, resolution(['run', 'build'])).deduped).toBe(false);
      expect(cache.store('Please build api', SCOPE, resolution(['run', 'build', '--json'])).deduped).toBe(true);
      expect(cache.stats().entries).toBe(1);
      // The refreshed result wins.
      expect(cache.lookup('build api', SCOPE)!.result.candidate.argv).toEqual(['run', 'build', '--json']);
      // A different scope is a different entry, not a dup.
      expect(cache.store('build the api', { ...SCOPE, provider: 'anthropic' }, resolution(['run', 'build'])).deduped).toBe(false);
      expect(cache.stats().entries).toBe(2);
    } finally {
      t.cleanup();
    }
  });

  it('expires entries after the TTL', () => {
    let now = 1_000_000;
    const { cache, t } = makeCache({ ttl: 60, now: () => now });
    try {
      cache.store('list templates', SCOPE, resolution(['templates', 'list']));
      now += 59_000;
      expect(cache.lookup('list templates', SCOPE)).toBeDefined();
      now += 2_000;
      expect(cache.lookup('list templates', SCOPE)).toBeUndefined();
      expect(cache.stats().expired).toBe(1);
      // Storing prunes the expired entry.
      cache.store('workspace health', SCOPE, resolution(['workspace', 'health']));
      expect(cache.stats().entries).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it('caps the size, evicting the least recently used entry', () => {
    let now = 1_000;
    const { cache, t } = makeCache({ max: 3, now: () => ++now });
    try {
      const names = ['alpha', 'bravo', 'charlie', 'delta'];
      cache.store(`open ${names[0]}`, SCOPE, resolution(['x', names[0]]));
      cache.store(`open ${names[1]}`, SCOPE, resolution(['x', names[1]]));
      cache.store(`open ${names[2]}`, SCOPE, resolution(['x', names[2]]));
      cache.lookup(`open ${names[0]}`, SCOPE); // refresh alpha
      cache.store(`open ${names[3]}`, SCOPE, resolution(['x', names[3]]));
      expect(cache.stats().entries).toBe(3);
      expect(cache.lookup('open alpha', SCOPE)).toBeDefined();
      expect(cache.lookup('open bravo', SCOPE)).toBeUndefined(); // the LRU victim
      expect(cache.lookup('open delta', SCOPE)).toBeDefined();
    } finally {
      t.cleanup();
    }
  });

  it('tracks hits and misses and reports stats', () => {
    const { cache, t } = makeCache();
    try {
      expect(cache.stats()).toMatchObject({ entries: 0, hits: 0, misses: 0, hitRate: 0, oldestAt: null, newestAt: null });
      cache.store('list templates', SCOPE, resolution(['templates', 'list']));
      cache.lookup('list templates', SCOPE);
      cache.lookup('list the templates', SCOPE);
      cache.lookup('something else entirely', SCOPE);
      const s = cache.stats();
      expect(s).toMatchObject({ entries: 1, hits: 2, misses: 1, ttlSeconds: 3600, maxEntries: 200 });
      expect(s.hitRate).toBeCloseTo(2 / 3, 3);
      expect(s.byProvider).toEqual({ offline: 1 });
      expect(s.bytes).toBeGreaterThan(0);
      expect(s.path.endsWith('cache.json')).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it('clear() removes everything and resets statistics', () => {
    const { cache, t } = makeCache();
    try {
      cache.store('list templates', SCOPE, resolution(['templates', 'list']));
      cache.store('workspace health', SCOPE, resolution(['workspace', 'health']));
      cache.lookup('list templates', SCOPE);
      expect(cache.clear()).toEqual({ removed: 2 });
      expect(cache.stats()).toMatchObject({ entries: 0, hits: 0, misses: 0 });
      expect(cache.clear()).toEqual({ removed: 0 });
    } finally {
      t.cleanup();
    }
  });

  it('stores only the normalised prompt, never the raw text', () => {
    const { cache, t } = makeCache();
    try {
      cache.store('Please deploy with token ABC-SECRET-123!!', SCOPE, resolution(['k8s', 'generate']));
      const raw = fs.readFileSync(cache.path, 'utf8');
      expect(raw).not.toContain('Please');
      expect(raw).not.toContain('ABC-SECRET-123');
    } finally {
      t.cleanup();
    }
  });

  it('survives a corrupt cache file and a malformed entry', () => {
    const { cache, t } = makeCache();
    try {
      fs.mkdirSync(path.dirname(cache.path), { recursive: true });
      fs.writeFileSync(cache.path, '{ definitely not json');
      expect(cache.lookup('list templates', SCOPE)).toBeUndefined();
      cache.store('list templates', SCOPE, resolution(['templates', 'list']));
      expect(cache.lookup('list templates', SCOPE)).toBeDefined();
      const doc = JSON.parse(fs.readFileSync(cache.path, 'utf8'));
      doc.entries.push({ garbage: true });
      fs.writeFileSync(cache.path, JSON.stringify(doc));
      expect(cache.stats().entries).toBe(1);
    } finally {
      t.cleanup();
    }
  });

  it('git-ignores its own directory so cached prompts are never committed', () => {
    const { cache, t } = makeCache();
    try {
      cache.store('list templates', SCOPE, resolution(['templates', 'list']));
      expect(fs.readFileSync(path.join(path.dirname(cache.path), '.gitignore'), 'utf8')).toBe('*\n');
    } finally {
      t.cleanup();
    }
  });

  it('catalogueSignature changes when the command set changes', () => {
    expect(catalogSignature(['a', 'b'])).toBe(catalogSignature(['b', 'a']));
    expect(catalogSignature(['a', 'b'])).not.toBe(catalogSignature(['a', 'b', 'c']));
  });
});

describe('SessionStore', () => {
  function makeStore() {
    const t = tmpDir();
    return { store: new SessionStore(path.join(t.dir, 'ai')), t };
  }

  it('creates, saves, loads and lists sessions', () => {
    const { store, t } = makeStore();
    try {
      const s = store.create('demo', 'fp');
      s.turns.push({ at: new Date().toISOString(), prompt: 'build the api', kind: 'resolved', argv: ['run', 'build'], confidence: 0.9, provider: 'offline', source: 'offline' });
      expect(store.exists('demo')).toBe(false);
      store.save(s);
      expect(store.exists('demo')).toBe(true);
      expect(store.load('demo').turns).toHaveLength(1);
      const [row] = store.list();
      expect(row).toMatchObject({ id: 'demo', turns: 1, pending: false, lastPrompt: 'build the api' });
      expect(store.latestId()).toBe('demo');
      expect(store.directory.endsWith(path.join('ai', 'sessions'))).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it('lists most recently updated first', () => {
    const { store, t } = makeStore();
    try {
      const a = store.create('first', 'fp', new Date('2026-01-01T00:00:00Z'));
      store.save(a, new Date('2026-01-01T00:00:00Z'));
      const b = store.create('second', 'fp', new Date('2026-01-02T00:00:00Z'));
      store.save(b, new Date('2026-01-02T00:00:00Z'));
      expect(store.list().map(s => s.id)).toEqual(['second', 'first']);
      expect(store.latestId()).toBe('second');
    } finally {
      t.cleanup();
    }
  });

  it('removes one session or all of them', () => {
    const { store, t } = makeStore();
    try {
      for (const id of ['a1', 'a2', 'a3']) store.save(store.create(id, 'fp'));
      expect(store.remove('a1')).toBe(true);
      expect(store.remove('a1')).toBe(false);
      expect(store.removeAll()).toBe(2);
      expect(store.list()).toEqual([]);
    } finally {
      t.cleanup();
    }
  });

  it('keeps a pending clarification across save/load', () => {
    const { store, t } = makeStore();
    try {
      const s = store.create('p', 'fp');
      s.pending = { question: 'Which?', reason: 'multiple-candidates', candidates: [candidate(['run', 'build'])], originalPrompt: 'build payments', askedAt: new Date().toISOString() };
      store.save(s);
      expect(store.load('p').pending?.question).toBe('Which?');
      expect(store.list()[0].pending).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it('rejects ids that could escape the sessions directory', () => {
    const { store, t } = makeStore();
    try {
      for (const bad of ['../evil', '..', 'a/b', 'a\\b', '', '-rf', 'x'.repeat(65), 'a b', 'a.json']) {
        expect(isValidSessionId(bad), bad).toBe(false);
        expect(() => store.load(bad)).toThrow(SessionError);
        expect(() => store.create(bad, 'fp')).toThrow(SessionError);
        expect(() => store.remove(bad)).toThrow(SessionError);
      }
      expect(isValidSessionId('good_ID-1')).toBe(true);
      expect(SESSION_ID_PATTERN.test(newSessionId())).toBe(true);
    } finally {
      t.cleanup();
    }
  });

  it('reports a missing session as not-found and skips corrupt files when listing', () => {
    const { store, t } = makeStore();
    try {
      try {
        store.load('nope');
        throw new Error('expected not-found');
      } catch (e) {
        expect(e).toBeInstanceOf(SessionError);
        expect((e as SessionError).code).toBe('not-found');
      }
      store.save(store.create('ok', 'fp'));
      fs.writeFileSync(path.join(store.directory, 'broken.json'), '{nope');
      expect(store.list().map(s => s.id)).toEqual(['ok']);
    } finally {
      t.cleanup();
    }
  });

  it('trims old turns and stores only a bounded prompt', () => {
    const { store, t } = makeStore();
    try {
      const s = store.create('long', 'fp');
      for (let i = 0; i < 60; i++) {
        s.turns.push({ at: 'x', prompt: `turn ${i}`, kind: 'resolved', argv: ['run'], confidence: 1, provider: 'offline', source: 'offline' });
      }
      store.save(s);
      const loaded = store.load('long');
      expect(loaded.turns).toHaveLength(50);
      expect(loaded.turns[0].prompt).toBe('turn 10');
      expect(storablePrompt('x'.repeat(900))).toHaveLength(500);
      expect(storablePrompt('a\u0000b\nc')).toBe('a b c');
    } finally {
      t.cleanup();
    }
  });

  it('projects a session onto model history and autocomplete history', () => {
    const { store, t } = makeStore();
    try {
      const s = store.create('h', 'fp');
      const at = new Date().toISOString();
      s.turns.push({ at, prompt: 'build payments', kind: 'clarify', question: 'Which payments node?', candidates: [{ argv: ['run', 'build', '--filter', 'a'], confidence: 0.6 }], provider: 'offline', source: 'offline' });
      s.turns.push({ at, prompt: 'the first one', kind: 'resolved', argv: ['run', 'build', '--filter', 'a'], confidence: 0.9, provider: 'offline', source: 'clarification' });
      s.turns.push({ at, prompt: 'never mind', kind: 'cancelled', provider: 'offline', source: 'clarification' });
      store.save(s);

      const hist = historyForModel(store.load('h'));
      expect(hist.map(h => h.prompt)).toEqual(['build payments', 'the first one']);
      expect(JSON.parse(hist[0].answer)).toMatchObject({ outcome: 'clarify', question: 'Which payments node?' });
      expect(JSON.parse(hist[1].answer)).toMatchObject({ outcome: 'command', argv: ['run', 'build', '--filter', 'a'] });
      expect(historyForModel(undefined)).toEqual([]);

      expect(collectResolvedHistory(store)).toEqual([{ prompt: 'the first one', argv: ['run', 'build', '--filter', 'a'] }]);
    } finally {
      t.cleanup();
    }
  });
});
