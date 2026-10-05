import type { IntentCandidate } from '../utils/ai-intent';
import { canonicalWord, STOPWORDS, words } from './text';

/**
 * Interpreting the user's answer to a clarifying question.
 *
 * After an ambiguous prompt the session holds the candidate list. The next turn
 * is classified as one of:
 *  - `choice`  : an ordinal ("the second one", "2", "option 3", "last") or a
 *                candidate name/keyword ("payments", "run the tests") that picks
 *                exactly one candidate;
 *  - `cancel`  : "none", "never mind", "cancel";
 *  - `refine`  : anything else — more information, which the resolver combines
 *                with the original prompt and resolves afresh.
 *
 * Matching is deterministic and offline; it never guesses between tied
 * candidates (a tie is treated as `refine` so the user is asked again with the
 * extra detail).
 */

/** Result of interpreting an answer. */
export type ClarificationAnswer =
  | { kind: 'choice'; index: number; candidate: IntentCandidate; how: 'ordinal' | 'name' }
  | { kind: 'cancel' }
  | { kind: 'refine' };

const ORDINALS: Readonly<Record<string, number>> = {
  first: 0, '1st': 0,
  second: 1, '2nd': 1,
  third: 2, '3rd': 2,
  fourth: 3, '4th': 3,
  fifth: 4, '5th': 4,
};

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
};

const CANCEL = /^(?:none|neither|nothing|nope|cancel|abort|stop|forget it|never ?mind|no(?: thanks)?)(?:\b.*)?$/i;

/** Filler words that may surround a bare ordinal ("go with the second one"). */
const FILLER: ReadonlySet<string> = new Set([
  'the', 'a', 'an', 'one', 'option', 'number', 'choice', 'no', 'go', 'with', 'pick', 'choose',
  'select', 'take', 'use', 'run', 'please', 'i', 'll', 'want', 'that', 'it', 'its', 'do', 'lets',
  'let', 's', 'is', 'on', 'of', 'item', 'candidate', 'answer',
]);

function ordinalIndex(answer: string, count: number): number | undefined {
  const lower = answer.toLowerCase().trim();
  const ws = words(lower);
  if (ws.length === 0 || ws.length > 6) return undefined;

  // "last"
  if (ws.includes('last') && ws.every(w => w === 'last' || FILLER.has(w))) return count - 1;

  // "first", "2nd", ...
  for (const w of ws) {
    if (w in ORDINALS && ws.every(x => x === w || FILLER.has(x))) return ORDINALS[w];
  }

  // "2", "#2", "option 3", "number 2"
  const digits = lower.match(/^(?:(?:go with|pick|choose|select|take|use)\s+)?(?:the\s+)?(?:option|number|choice|no\.?|#)?\s*#?(\d{1,2})\s*(?:one)?\.?$/);
  if (digits) return Number(digits[1]) - 1;

  // "option two"
  const named = lower.match(/(?:option|number|choice)\s+(one|two|three|four|five)\b/);
  if (named && ws.every(w => w in NUMBER_WORDS || FILLER.has(w))) return NUMBER_WORDS[named[1]] - 1;
  return undefined;
}

/** Canonical content tokens of a candidate (argv words, path, node names). */
function candidateTokens(c: IntentCandidate): Set<string> {
  const out = new Set<string>();
  const add = (text: string): void => {
    for (const w of words(text)) {
      if (!STOPWORDS.has(w)) out.add(canonicalWord(w));
    }
  };
  for (const token of c.argv) {
    if (!token.startsWith('--')) add(token);
  }
  add(c.path);
  for (const n of c.nodes ?? []) add(n.name);
  add(c.description);
  return out;
}

/**
 * Interpret the user's reply to a clarifying question.
 *
 * @param answer - The user's reply.
 * @param candidates - The candidates offered with the question.
 * @returns A choice, a cancellation, or `refine` when it is neither.
 */
export function interpretAnswer(
  answer: string,
  candidates: readonly IntentCandidate[]
): ClarificationAnswer {
  const trimmed = answer.trim();
  if (trimmed === '') return { kind: 'refine' };

  const idx = ordinalIndex(trimmed, candidates.length);
  if (idx !== undefined && idx >= 0 && idx < candidates.length) {
    return { kind: 'choice', index: idx, candidate: candidates[idx], how: 'ordinal' };
  }
  if (CANCEL.test(trimmed) && candidates.length >= 0 && words(trimmed).length <= 3) {
    return { kind: 'cancel' };
  }
  if (candidates.length === 0) return { kind: 'refine' };

  // Name / keyword match against what DISTINGUISHES the candidates.
  const answerTokens = Array.from(
    new Set(words(trimmed).filter(w => !STOPWORDS.has(w) && !FILLER.has(w)).map(canonicalWord))
  );
  if (answerTokens.length === 0) return { kind: 'refine' };

  const sets = candidates.map(candidateTokens);
  const shared = new Set<string>();
  for (const t of sets[0]) if (sets.every(s => s.has(t))) shared.add(t);

  const scores = sets.map(s => answerTokens.filter(t => s.has(t) && !shared.has(t)).length);
  const best = Math.max(...scores);
  if (best === 0) return { kind: 'refine' };
  const winners = scores
    .map((s, i) => ({ s, i }))
    .filter(x => x.s === best);
  if (winners.length !== 1) return { kind: 'refine' }; // tie: do not guess
  const i = winners[0].i;
  // Every word of the answer must be explained by the chosen candidate. A word
  // the candidate does not contain is NEW information ("...the tests for the
  // service" when no candidate runs tests), so picking would silently drop it:
  // treat the answer as a refinement of the original prompt instead.
  if (!answerTokens.every(t => sets[i].has(t))) return { kind: 'refine' };
  return { kind: 'choice', index: i, candidate: candidates[i], how: 'name' };
}
