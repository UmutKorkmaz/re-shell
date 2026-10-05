import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { IntentCandidate } from '../utils/ai-intent';
import { comparePrompts, normalizeText, type NormalizedPrompt } from './text';
import { ensureStateDir, readJsonSafe, writeJsonAtomic } from './store';
import type { AiProviderName } from './types';

/**
 * Semantic response cache with dedup (`.re-shell/ai/cache.json`).
 *
 * A prompt is normalised (case, punctuation, stop-words, light stemming,
 * synonyms — see text.ts) and compared with cached prompts by a blend of token
 * cosine and character-trigram Dice similarity. A hit needs BOTH:
 *   - similarity >= `threshold` (default 0.82), and
 *   - the prompts to be *equivalent*: identical canonical token multisets, with
 *     typo tolerance only for out-of-vocabulary words. This is the safety guard
 *     that stops "create service alpha" from hitting "create service beta".
 *
 * Entries are scoped by provider + model + a fingerprint of the workspace graph
 * and command catalogue, so a different provider, a changed workspace, or a new
 * CLI version never reuses a stale answer.
 *
 * Dedup: storing a prompt equivalent to an existing in-scope entry refreshes
 * that entry instead of adding another. TTL and a size cap (LRU eviction)
 * bound the file. Only the NORMALISED form of a prompt is stored, never the
 * raw text.
 */

/** Default similarity threshold for a cache hit. */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.82;

/** Default max number of entries. */
export const DEFAULT_MAX_ENTRIES = 200;

/** What is cached for a prompt: the resolved command and how it was explained. */
export interface CachedResolution {
  candidate: IntentCandidate;
  alternatives: IntentCandidate[];
  explanation: string;
}

/** The partition a cache entry belongs to. */
export interface CacheScope {
  provider: AiProviderName;
  model?: string;
  /** Workspace fingerprint + catalogue signature. */
  fingerprint: string;
}

interface CacheEntry {
  id: string;
  tokens: string[];
  key: string;
  provider: AiProviderName;
  model?: string;
  fingerprint: string;
  createdAt: number;
  lastHitAt: number;
  hits: number;
  result: CachedResolution;
}

interface CacheFile {
  version: 1;
  stats: { hits: number; misses: number };
  entries: CacheEntry[];
}

/** Options for {@link SemanticCache}. */
export interface SemanticCacheOptions {
  ttlSeconds: number;
  maxEntries?: number;
  threshold?: number;
  /** Injected clock (tests). */
  now?: () => number;
}

/** A cache hit. */
export interface CacheHit {
  result: CachedResolution;
  similarity: number;
  hits: number;
}

/** Cache statistics. */
export interface CacheStats {
  path: string;
  entries: number;
  /** Entries past their TTL that have not been pruned yet. */
  expired: number;
  bytes: number;
  hits: number;
  misses: number;
  /** hits / (hits + misses), or 0 with no lookups. */
  hitRate: number;
  oldestAt: string | null;
  newestAt: string | null;
  ttlSeconds: number;
  maxEntries: number;
  threshold: number;
  byProvider: Record<string, number>;
}

function sameScope(e: CacheEntry, s: CacheScope): boolean {
  return e.provider === s.provider && (e.model ?? '') === (s.model ?? '') && e.fingerprint === s.fingerprint;
}

/** The semantic cache. */
export class SemanticCache {
  private readonly file: string;
  private readonly stateRoot: string;
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly threshold: number;
  private readonly now: () => number;

  /**
   * @param stateDir - The AI state directory (`<root>/.re-shell/ai`).
   * @param options - TTL, size cap, threshold, clock.
   */
  constructor(stateDir: string, options: SemanticCacheOptions) {
    this.stateRoot = stateDir;
    this.file = path.join(stateDir, 'cache.json');
    this.ttlMs = options.ttlSeconds * 1000;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.threshold = options.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    this.now = options.now ?? Date.now;
  }

  /** Location of the cache file. */
  get path(): string {
    return this.file;
  }

  private load(): CacheFile {
    const data = readJsonSafe<CacheFile>(this.file);
    if (!data || data.version !== 1 || !Array.isArray(data.entries)) {
      return { version: 1, stats: { hits: 0, misses: 0 }, entries: [] };
    }
    return {
      version: 1,
      stats: {
        hits: Number(data.stats?.hits) || 0,
        misses: Number(data.stats?.misses) || 0,
      },
      entries: data.entries.filter(
        e => e && Array.isArray(e.tokens) && typeof e.key === 'string' && e.result?.candidate
      ),
    };
  }

  private save(data: CacheFile): void {
    ensureStateDir(this.stateRoot, this.stateRoot);
    writeJsonAtomic(this.file, data);
  }

  private isExpired(e: CacheEntry): boolean {
    return this.now() - e.createdAt > this.ttlMs;
  }

  /**
   * Look a prompt up. Records a hit or a miss in the persisted statistics.
   *
   * @param prompt - Raw prompt.
   * @param scope - Provider/model/fingerprint partition to search.
   * @param protectedTokens - Identity tokens that never tolerate typos.
   * @returns The best equivalent entry above the threshold, if any.
   */
  lookup(
    prompt: string,
    scope: CacheScope,
    protectedTokens: ReadonlySet<string> = new Set()
  ): CacheHit | undefined {
    const data = this.load();
    const probe = normalizeText(prompt);

    let best: { entry: CacheEntry; score: number } | undefined;
    if (probe.tokens.length > 0) {
      for (const entry of data.entries) {
        if (!sameScope(entry, scope) || this.isExpired(entry)) continue;
        const cmp = comparePrompts(probe, { tokens: entry.tokens, key: entry.key }, protectedTokens);
        if (cmp.equivalent && cmp.score >= this.threshold && (!best || cmp.score > best.score)) {
          best = { entry, score: cmp.score };
        }
      }
    }

    if (best) {
      data.stats.hits++;
      best.entry.hits++;
      best.entry.lastHitAt = this.now();
    } else {
      data.stats.misses++;
    }
    this.save(data);
    return best
      ? { result: best.entry.result, similarity: Number(best.score.toFixed(4)), hits: best.entry.hits }
      : undefined;
  }

  /**
   * Store a resolution. An equivalent in-scope entry is refreshed in place
   * (dedup) rather than duplicated.
   *
   * @param prompt - Raw prompt (only its normalised form is persisted).
   * @param scope - Partition to store under.
   * @param result - The resolution to cache.
   * @param protectedTokens - Identity tokens that never tolerate typos.
   * @returns Whether an existing entry was refreshed instead of a new one added.
   */
  store(
    prompt: string,
    scope: CacheScope,
    result: CachedResolution,
    protectedTokens: ReadonlySet<string> = new Set()
  ): { deduped: boolean } {
    const norm: NormalizedPrompt = normalizeText(prompt);
    if (norm.tokens.length === 0) return { deduped: false };

    const data = this.load();
    const t = this.now();
    data.entries = data.entries.filter(e => !this.isExpired(e));

    const existing = data.entries.find(
      e =>
        sameScope(e, scope) &&
        comparePrompts(norm, { tokens: e.tokens, key: e.key }, protectedTokens).equivalent
    );
    let deduped = false;
    if (existing) {
      existing.result = result;
      existing.lastHitAt = t;
      existing.createdAt = t;
      deduped = true;
    } else {
      data.entries.push({
        id: crypto
          .createHash('sha1')
          .update(`${scope.provider}|${scope.model ?? ''}|${scope.fingerprint}|${norm.key}`)
          .digest('hex')
          .slice(0, 16),
        tokens: norm.tokens,
        key: norm.key,
        provider: scope.provider,
        model: scope.model,
        fingerprint: scope.fingerprint,
        createdAt: t,
        lastHitAt: t,
        hits: 0,
        result,
      });
    }

    if (data.entries.length > this.maxEntries) {
      data.entries.sort((a, b) => b.lastHitAt - a.lastHitAt);
      data.entries = data.entries.slice(0, this.maxEntries);
    }
    this.save(data);
    return { deduped };
  }

  /**
   * Remove every cached entry and reset the statistics.
   *
   * @returns How many entries were removed.
   */
  clear(): { removed: number } {
    const data = this.load();
    const removed = data.entries.length;
    try {
      fs.rmSync(this.file, { force: true });
    } catch {
      /* nothing to clear */
    }
    return { removed };
  }

  /** Report cache statistics (does not modify the cache). */
  stats(): CacheStats {
    const data = this.load();
    let bytes = 0;
    try {
      bytes = fs.statSync(this.file).size;
    } catch {
      bytes = 0;
    }
    const byProvider: Record<string, number> = {};
    let expired = 0;
    let oldest = Infinity;
    let newest = -Infinity;
    for (const e of data.entries) {
      byProvider[e.provider] = (byProvider[e.provider] ?? 0) + 1;
      if (this.isExpired(e)) expired++;
      oldest = Math.min(oldest, e.createdAt);
      newest = Math.max(newest, e.createdAt);
    }
    const lookups = data.stats.hits + data.stats.misses;
    return {
      path: this.file,
      entries: data.entries.length,
      expired,
      bytes,
      hits: data.stats.hits,
      misses: data.stats.misses,
      hitRate: lookups === 0 ? 0 : Number((data.stats.hits / lookups).toFixed(4)),
      oldestAt: data.entries.length ? new Date(oldest).toISOString() : null,
      newestAt: data.entries.length ? new Date(newest).toISOString() : null,
      ttlSeconds: Math.round(this.ttlMs / 1000),
      maxEntries: this.maxEntries,
      threshold: this.threshold,
      byProvider,
    };
  }
}

/**
 * Hash the command catalogue into a short signature, so cached answers do not
 * outlive the set of commands they were validated against.
 *
 * @param paths - Every catalogue command path.
 * @returns A 12-hex-character signature.
 */
export function catalogSignature(paths: readonly string[]): string {
  return crypto
    .createHash('sha256')
    .update([...paths].sort().join('\n'))
    .digest('hex')
    .slice(0, 12);
}
