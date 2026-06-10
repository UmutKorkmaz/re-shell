/**
 * Deterministic, offline, dependency-free natural-language → allow-listed command
 * resolver for the dashboard assistant.
 *
 * Given a free-text query and the hub's allow-list (passed in as metadata — never
 * hardcoded here, so this can never drift from the real registry), it resolves to
 * AT MOST ONE allowed command using field-weighted term-overlap scoring. If
 * nothing clears the confidence floor, it returns a `no-match` result so the UI
 * REFUSES rather than guessing.
 *
 * Design mirrors the CLI find ranker (packages/cli/src/utils/find-index.ts):
 *  - OFFLINE & PURE: no network, no I/O, no time/randomness. Same query + same
 *    catalog always yields the same resolution. The default path never leaves the
 *    box.
 *  - TRANSPARENT: scoring is exact term overlap + bounded fuzzy substring over
 *    id/title/keywords/description, each field weighted. Every result reports the
 *    matched query terms so the choice is explainable in the UI.
 *  - SAFE BY CONSTRUCTION: the candidate set IS the allow-list. The resolver can
 *    only ever return an id that was supplied to it; it cannot invent a command.
 */

/**
 * The minimum metadata the resolver scores against. The dashboard derives this
 * from the hub command registry (the single source of truth for the allow-list)
 * and passes it in; the resolver itself stays decoupled from any registry shape.
 */
export interface AllowedCommand {
  /** Stable command id routed back through the hub (`{ commandId, params }`). */
  readonly id: string;
  /** Human title — a strong identity signal. */
  readonly title: string;
  /** Free-text description — a soft signal. */
  readonly description: string;
  /**
   * Optional extra intent keywords/synonyms not present in the title/description
   * (e.g. "deps" for a dependency graph). Boosts recall without polluting the
   * displayed copy. Defaults to none.
   */
  readonly keywords?: readonly string[];
}

/** Outcome of resolving one query against the allow-list. */
export type ResolveCommandResult =
  | {
      readonly kind: 'match';
      /** The single chosen allow-listed command id. */
      readonly commandId: string;
      /** Normalised [0,1] confidence; always >= the configured floor. */
      readonly confidence: number;
      /** Query terms that contributed to the score, in query order. */
      readonly matched: readonly string[];
    }
  | {
      readonly kind: 'no-match';
      /**
       * Why nothing was returned — `empty` for a blank/all-stop-word query,
       * `below-threshold` when the best candidate did not clear the floor.
       */
      readonly reason: 'empty' | 'below-threshold';
    };

// ---------------------------------------------------------------------------
// Tuning (named — no magic numbers)
// ---------------------------------------------------------------------------

/**
 * Field weights. Id/title carry the command's identity; keywords are curated
 * intent signals; the description is a soft tie-breaker. Mirrors the CLI ranker's
 * relative ordering.
 */
const FIELD_WEIGHTS = {
  id: 5,
  title: 4,
  keywords: 3,
  description: 1,
} as const;

/** A whole-token exact hit on a field scores this much (times the field weight). */
const EXACT_TERM_SCORE = 1;

/**
 * A fuzzy substring hit (query term contains, or is contained by, a field token)
 * scores this fraction of an exact hit — always < 1 so precise beats partial.
 */
const FUZZY_TERM_SCORE = 0.4;

/** Query terms shorter than this never participate in fuzzy substring matching. */
const MIN_FUZZY_TERM_LENGTH = 3;

/**
 * Minimum normalised confidence required to RETURN a command. Below this the
 * resolver refuses (the UI shows "I can only run these commands: …") rather than
 * running a weakly-matched command. Tuned so a single soft description hit alone
 * does not trigger an execution.
 */
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.25;

/**
 * Search-oriented stop-words ignored during scoring so generic filler ("is my
 * workspace healthy?") cannot manufacture phantom matches.
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
  'me',
  'can',
  'you',
  'please',
  'show',
  'get',
  'run',
  'whats',
  'what',
]);

// ---------------------------------------------------------------------------
// Tokenisation (shared shape with the CLI ranker)
// ---------------------------------------------------------------------------

/**
 * Lower-case alphanumeric/dash tokens. Any other run is a delimiter, so
 * punctuation and shell metacharacters never become tokens. Pure and
 * order-preserving.
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

/** Per-hit score for one query term against one field token. */
function termTokenScore(term: string, tok: string): number {
  if (term === tok) return EXACT_TERM_SCORE;
  if (term.length < MIN_FUZZY_TERM_LENGTH || tok.length < MIN_FUZZY_TERM_LENGTH) {
    return 0;
  }
  if (tok.includes(term) || term.includes(tok)) return FUZZY_TERM_SCORE;
  return 0;
}

interface WeightedField {
  readonly tokens: readonly string[];
  readonly weight: number;
}

/** Build the weighted, tokenised fields for one allow-listed command. */
function fieldsFor(command: AllowedCommand): WeightedField[] {
  return [
    { tokens: tokenize(command.id.replace(/\./g, ' ')), weight: FIELD_WEIGHTS.id },
    { tokens: tokenize(command.title), weight: FIELD_WEIGHTS.title },
    {
      tokens: tokenize((command.keywords ?? []).join(' ')),
      weight: FIELD_WEIGHTS.keywords,
    },
    { tokens: tokenize(command.description), weight: FIELD_WEIGHTS.description },
  ];
}

/**
 * Score one command against the query terms. Each query term contributes its BEST
 * hit per field (exact preferred), times the field weight; the best-per-term sum
 * rewards covering MORE distinct query terms over repeating one term.
 */
function scoreCommand(
  command: AllowedCommand,
  terms: readonly string[]
): { raw: number; matched: string[]; maxFieldWeight: number } {
  const fields = fieldsFor(command);
  let raw = 0;
  let maxFieldWeight = 1;
  const matched = new Set<string>();

  for (const field of fields) {
    if (field.tokens.length === 0) continue;
    maxFieldWeight = Math.max(maxFieldWeight, field.weight);
    for (const term of terms) {
      let best = 0;
      for (const tok of field.tokens) {
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

  const orderedMatched = terms.filter((t) => matched.has(t));
  return { raw, matched: orderedMatched, maxFieldWeight };
}

/**
 * Normalise a raw weighted score into [0,1]. Ceiling assumes every query term
 * lands an exact hit on the command's highest-weighted field, so a strong match
 * approaches 1 without any command structurally exceeding the bound.
 */
function toConfidence(raw: number, termCount: number, maxFieldWeight: number): number {
  if (termCount === 0) return 0;
  const ceiling = EXACT_TERM_SCORE * maxFieldWeight * termCount;
  return Math.min(1, raw / ceiling);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface ResolveCommandOptions {
  /** Minimum confidence to return a command. Defaults to {@link DEFAULT_CONFIDENCE_THRESHOLD}. */
  readonly threshold?: number;
}

/**
 * Resolve `query` to AT MOST ONE command from `allowed`.
 *
 * Deterministic: the single best candidate by raw score wins; ties break by
 * higher confidence, then by id lexicographically. If the best confidence is
 * below the threshold (or the query has no scorable terms), returns `no-match`
 * and the UI refuses.
 *
 * Pure — no side effects, no I/O. The returned `commandId` is always one of the
 * supplied `allowed` ids, never a fabricated one.
 */
export function resolveCommand(
  query: string,
  allowed: readonly AllowedCommand[],
  options: ResolveCommandOptions = {}
): ResolveCommandResult {
  const threshold = options.threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const terms = queryTerms(query);
  if (terms.length === 0) {
    return { kind: 'no-match', reason: 'empty' };
  }

  let bestRaw = 0;
  let best:
    | { commandId: string; confidence: number; matched: string[] }
    | null = null;

  for (const command of allowed) {
    const { raw, matched, maxFieldWeight } = scoreCommand(command, terms);
    if (raw <= 0) continue;
    const confidence = Number(toConfidence(raw, terms.length, maxFieldWeight).toFixed(4));

    if (
      raw > bestRaw ||
      (raw === bestRaw &&
        best !== null &&
        (confidence > best.confidence ||
          (confidence === best.confidence && command.id.localeCompare(best.commandId) < 0)))
    ) {
      bestRaw = raw;
      best = { commandId: command.id, confidence, matched };
    }
  }

  if (best === null || best.confidence < threshold) {
    return { kind: 'no-match', reason: 'below-threshold' };
  }

  return {
    kind: 'match',
    commandId: best.commandId,
    confidence: best.confidence,
    matched: best.matched,
  };
}
