import type { FindResult, FindResultType } from '@re-shell/contracts';

/**
 * Offline, deterministic, dependency-free search index + ranker for
 * `re-shell find`.
 *
 * This module turns a free-text query into a ranked list of {@link FindResult}
 * hits drawn from two corpora: the live command catalogue and the static
 * template registry. It is intentionally:
 *
 *  - OFFLINE: no network, no LLM, no I/O. Indexing and scoring are pure
 *    functions of their inputs. The default `find` path never leaves the box.
 *  - DETERMINISTIC: the same query + corpus always yields the same ranking.
 *    No randomness, time, or environment dependence; ties break lexicographically.
 *  - TRANSPARENT: scoring is a field-weighted blend of exact term overlap and
 *    bounded fuzzy substring matching. Every hit reports which query terms
 *    contributed (`matched`) so the ranking is explainable.
 *
 * The rankable logic lives here as pure functions so it is unit-testable in
 * isolation; the command layer (groups/find.group.ts) only adapts data in and
 * formats results out. An optional {@link EmbeddingReranker} can reorder the
 * top-K when explicitly enabled, but it is OFF by default and never invoked on
 * the offline path.
 */

// ---------------------------------------------------------------------------
// Indexable document model
// ---------------------------------------------------------------------------

/**
 * A weighted field of an indexed document. The ranker scores query-term hits
 * per field and multiplies by `weight`, so callers control which fields matter
 * most (e.g. id/title higher than a long description).
 */
export interface IndexField {
  /** Raw field text (un-tokenised). */
  text: string;
  /** Relative importance multiplier; higher = stronger signal. */
  weight: number;
}

/**
 * A single searchable document. `type`/`id`/`title` flow straight into the
 * emitted {@link FindResult}; `usage` (commands) is carried through untouched.
 * `fields` are the weighted text the ranker scores against.
 */
export interface IndexDoc {
  type: FindResultType;
  id: string;
  title: string;
  usage?: string;
  fields: IndexField[];
}

// ---------------------------------------------------------------------------
// Tuning constants (named — no magic numbers)
// ---------------------------------------------------------------------------

/**
 * Field weights applied when building docs from the two corpora. Centralised so
 * the relative importance of id/title vs. description is declared in one place.
 */
export const FIELD_WEIGHTS = {
  /** Command path / template id — the strongest identity signal. */
  id: 5,
  /** Human title (command path echo / template display name). */
  title: 4,
  /** Curated tags / categories / language / framework. */
  tags: 3,
  /** Free-text description — a soft signal, easily out-weighed by an id hit. */
  description: 1,
} as const;

/** A whole-token exact hit on a field scores this much (times field weight). */
const EXACT_TERM_SCORE = 1;

/**
 * A fuzzy substring hit (query term is a substring of a field token, or vice
 * versa) scores this fraction of an exact hit. Always < EXACT_TERM_SCORE so a
 * precise match always outranks a partial one.
 */
const FUZZY_TERM_SCORE = 0.4;

/** A query term shorter than this never participates in fuzzy substring matching. */
const MIN_FUZZY_TERM_LENGTH = 3;

/**
 * Stop-words ignored entirely during scoring so generic filler can't
 * manufacture phantom matches. Kept small and search-oriented.
 */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'an',
  'the',
  'to',
  'of',
  'as',
  'in',
  'on',
  'for',
  'with',
  'and',
  'or',
  'is',
  'are',
  'it',
  'how',
  'do',
  'i',
  'my',
]);

// ---------------------------------------------------------------------------
// Tokenisation
// ---------------------------------------------------------------------------

/**
 * Lower-case word tokens. Splits on any non-alphanumeric/non-dash run, so
 * punctuation and shell metacharacters act purely as delimiters and never
 * become tokens. Pure and order-preserving.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
}

/** Distinct, non-stop-word query terms in stable first-seen order. */
function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tok of tokenize(query)) {
    if (STOP_WORDS.has(tok)) continue;
    if (seen.has(tok)) continue;
    seen.add(tok);
    out.push(tok);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Does query term `term` match field token `tok`?
 * Returns the per-hit score: exact (1) > fuzzy substring (0.4) > none (0).
 */
function termTokenScore(term: string, tok: string): number {
  if (term === tok) return EXACT_TERM_SCORE;
  // Both sides must clear the fuzzy floor: a 1–2 char field token (e.g. a flag
  // letter) can't substring-match a long query term, which would otherwise
  // manufacture phantom hits for unrelated queries.
  if (term.length < MIN_FUZZY_TERM_LENGTH || tok.length < MIN_FUZZY_TERM_LENGTH) {
    return 0;
  }
  // Bounded fuzzy: containment in either direction. No edit-distance, so this
  // stays O(field-size) and fully deterministic.
  if (tok.includes(term) || term.includes(tok)) return FUZZY_TERM_SCORE;
  return 0;
}

/**
 * Score one document against the query terms. Returns the raw weighted score
 * and the set of query terms that contributed at least one hit.
 *
 * Per field, each query term contributes its BEST hit against any token in that
 * field (exact preferred over fuzzy), multiplied by the field weight. Summing
 * the best-per-term avoids letting a term that appears many times in a long
 * description dominate; it rewards covering MORE distinct query terms.
 */
function scoreDoc(
  doc: IndexDoc,
  terms: readonly string[]
): { raw: number; matched: string[] } {
  let raw = 0;
  const matched = new Set<string>();

  for (const field of doc.fields) {
    const fieldTokens = tokenize(field.text);
    if (fieldTokens.length === 0) continue;

    for (const term of terms) {
      let best = 0;
      for (const tok of fieldTokens) {
        const s = termTokenScore(term, tok);
        if (s > best) best = s;
        if (best === EXACT_TERM_SCORE) break;
      }
      if (best > 0) {
        raw += best * field.weight;
        matched.add(term);
      }
    }
  }

  // Stable order for `matched`: query order, restricted to the ones that hit.
  const orderedMatched = terms.filter(t => matched.has(t));
  return { raw, matched: orderedMatched };
}

/**
 * Normalise a raw weighted score into a [0, 1] confidence. The ceiling assumes
 * every query term lands an exact hit on the highest-weighted field present in
 * the doc, so a doc that matches all terms strongly approaches 1 without any
 * single doc structurally exceeding the bound.
 */
function toConfidence(raw: number, termCount: number, doc: IndexDoc): number {
  if (termCount === 0) return 0;
  const maxFieldWeight = doc.fields.reduce((m, f) => Math.max(m, f.weight), 1);
  const ceiling = EXACT_TERM_SCORE * maxFieldWeight * termCount;
  return Math.min(1, raw / ceiling);
}

// ---------------------------------------------------------------------------
// Public ranking entry point
// ---------------------------------------------------------------------------

export interface RankOptions {
  /** Max results to return after ranking. */
  limit: number;
  /** Restrict to a single corpus, or 'all'. */
  type?: FindResultType | 'all';
}

/**
 * Rank `docs` against `query` and return the top {@link FindResult} hits.
 *
 * Deterministic: results are sorted by score desc, then (to break ties)
 * command-before-template, then by id lexicographically. Docs with zero matches
 * are dropped. Pure — no side effects, no I/O.
 */
export function rankDocs(
  query: string,
  docs: readonly IndexDoc[],
  options: RankOptions
): FindResult[] {
  const terms = queryTerms(query);
  const typeFilter = options.type ?? 'all';

  if (terms.length === 0) return [];

  const scored: Array<{ result: FindResult; raw: number }> = [];

  for (const doc of docs) {
    if (typeFilter !== 'all' && doc.type !== typeFilter) continue;

    const { raw, matched } = scoreDoc(doc, terms);
    if (raw <= 0) continue;

    const score = Number(toConfidence(raw, terms.length, doc).toFixed(4));
    const result: FindResult = {
      type: doc.type,
      id: doc.id,
      title: doc.title,
      score,
      matched,
      ...(doc.usage !== undefined ? { usage: doc.usage } : {}),
    };
    scored.push({ result, raw });
  }

  scored.sort((a, b) => {
    if (b.raw !== a.raw) return b.raw - a.raw;
    // Deterministic tie-breaks: commands first, then id lexicographic.
    if (a.result.type !== b.result.type) {
      return a.result.type === 'command' ? -1 : 1;
    }
    return a.result.id.localeCompare(b.result.id);
  });

  const limit = Math.max(0, Math.floor(options.limit));
  return scored.slice(0, limit).map(s => s.result);
}

// ---------------------------------------------------------------------------
// Pluggable embedding reranker (optional, OFF by default)
// ---------------------------------------------------------------------------

/**
 * Pluggable contract for an embedding-based reranker. A real provider adapter
 * may reorder the top-K keyword/fuzzy hits using semantic similarity.
 *
 * Contract guarantees the caller relies on:
 *  - It receives ALREADY-RANKED keyword results, never raw user text alone.
 *  - It MUST return a permutation of (a subset of) the SAME result objects —
 *    it reorders/filters, it never fabricates new ids. This keeps every emitted
 *    hit catalogue/registry-vetted even when a model is in the loop.
 *  - The DEFAULT `find` path does not construct or call any reranker, so the
 *    offline guarantee holds regardless of this interface's existence.
 */
export interface EmbeddingReranker {
  readonly name: string;
  /**
   * Reorder (and optionally trim) `results` for `query`. Implementations may be
   * async (network/provider calls) — but are never invoked on the default path.
   */
  rerank(query: string, results: readonly FindResult[]): Promise<FindResult[]>;
}

/**
 * Apply a reranker defensively: the returned list is filtered back down to the
 * id set of the original keyword results, so a misbehaving adapter can only ever
 * reorder/trim vetted hits — it can never inject an unknown id into output.
 */
export async function applyReranker(
  reranker: EmbeddingReranker,
  query: string,
  results: readonly FindResult[]
): Promise<FindResult[]> {
  const byId = new Map<string, FindResult>(
    results.map(r => [`${r.type}:${r.id}`, r])
  );
  const reranked = await reranker.rerank(query, results);
  const seen = new Set<string>();
  const safe: FindResult[] = [];
  for (const r of reranked) {
    const key = `${r.type}:${r.id}`;
    const original = byId.get(key);
    if (original && !seen.has(key)) {
      seen.add(key);
      // Emit the ORIGINAL vetted object, not the adapter's copy.
      safe.push(original);
    }
  }
  return safe;
}
