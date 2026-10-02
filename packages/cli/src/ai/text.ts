/**
 * Text normalisation + similarity primitives for the semantic cache, the
 * clarification matcher and autocomplete.
 *
 * Everything here is pure and deterministic. The pipeline is:
 *
 *   lower-case -> split on non-alphanumerics (punctuation vanishes)
 *   -> drop stop-words / fillers (NEGATIONS are kept: "do not" changes meaning)
 *   -> light stemming (plural / -ing / -ed / trailing -e)
 *   -> synonym canonicalisation ("make" -> "create", "ls" -> "list", ...)
 *
 * Two normalised prompts are "equivalent" when their canonical token multisets
 * match (with typo tolerance only for out-of-vocabulary words), and "similar"
 * above a threshold when a blend of token-cosine and character-trigram Dice
 * scores high. Equivalence is the safety guard; similarity is the soft score.
 */

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Words that carry no intent. Negations are intentionally NOT here. */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'to', 'of', 'as', 'in', 'on', 'for', 'with', 'from', 'into',
  'by', 'at', 'is', 'are', 'was', 'be', 'it', 'its', 'i', 'me', 'my', 'we', 'us',
  'our', 'you', 'your', 'this', 'that', 'these', 'those', 'there', 'here', 'and',
  'or', 'so', 'then', 'also', 'can', 'could', 'would', 'should', 'will', 'shall',
  'may', 'might', 'do', 'does', 'did', 'want', 'need', 'like', 'let', 'lets',
  'please', 'pls', 'kindly', 'thanks', 'thank', 'hey', 'hi', 'hello', 'just',
  'now', 'quickly', 'really', 'simply', 'about', 'how', 'what', 'which',
]);

/** Negations flip intent, so they always survive normalisation. */
export const NEGATIONS: ReadonlySet<string> = new Set([
  'no', 'not', 'never', 'without', 'dont', 'don', 'cannot', 'cant', 'except', 'skip',
]);

/**
 * Synonym groups. The FIRST member of each group is the canonical form. The
 * groups are intentionally conservative: words that map to *different*
 * commands (list vs show, create vs generate) are kept apart so that two
 * prompts only collide in the cache when they truly mean the same thing.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['build', 'compile', 'bundle'],
  ['list', 'ls', 'enumerate'],
  ['show', 'display', 'view', 'print'],
  ['create', 'make', 'new'],
  ['generate', 'scaffold'],
  ['remove', 'delete', 'drop', 'uninstall', 'rm'],
  ['check', 'verify'],
  ['service', 'svc', 'microservice'],
  ['workspace', 'monorepo', 'repo', 'repository'],
  ['dependency', 'dep'],
  ['config', 'configuration', 'setting'],
  ['app', 'application'],
  ['package', 'pkg'],
  ['test', 'spec'],
  ['lint', 'eslint'],
  ['json', 'machine-readable', 'parseable'],
  ['restart', 'reboot', 'bounce'],
  ['log', 'logs'],
  ['inspect', 'describe', 'detail'],
  ['run', 'execute'],
  ['start', 'launch', 'boot'],
  ['stop', 'halt', 'kill'],
];

/** Irregular forms the light stemmer cannot derive. */
const IRREGULAR: Readonly<Record<string, string>> = {
  built: 'build',
  made: 'make',
  ran: 'run',
  running: 'run',
  began: 'begin',
  stopped: 'stop',
  deleted: 'delete',
  data: 'data',
  status: 'status',
  series: 'series',
};

/**
 * Synonym lookup, keyed by BOTH the raw member and its stem so that "services",
 * "service" and "svc" all land on the same canonical (stemmed) form.
 */
const SYNONYM_CANONICAL: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const group of SYNONYM_GROUPS) {
    const canonical = stem(group[0]);
    for (const member of group) {
      map.set(member, canonical);
      map.set(stem(member), canonical);
    }
  }
  return map;
})();

/** Canonical vocabulary words — typo tolerance never applies to these. */
export const VOCABULARY: ReadonlySet<string> = (() => {
  const set = new Set<string>(NEGATIONS);
  for (const group of SYNONYM_GROUPS) {
    for (const member of group) set.add(stem(member));
  }
  return set;
})();

// ---------------------------------------------------------------------------
// Tokenisation + stemming
// ---------------------------------------------------------------------------

/**
 * Light, deterministic suffix stemmer. Not linguistically complete — it only
 * has to be CONSISTENT so "creating", "created", "creates" and "create" meet.
 *
 * @param word - A lower-case alphanumeric word.
 * @returns The stemmed form.
 */
export function stem(word: string): string {
  if (IRREGULAR[word]) return IRREGULAR[word];
  if (word.length <= 3 || /\d/.test(word)) return word;

  let w = word;
  let stripped = false;

  if (w.endsWith('ies') && w.length > 4) {
    w = w.slice(0, -3) + 'y';
  } else if (/(sses|ches|shes|xes|zes)$/.test(w)) {
    w = w.slice(0, -2);
  } else if (w.endsWith('s') && !/(ss|us|is)$/.test(w) && w.length > 3) {
    w = w.slice(0, -1);
  }

  if (w.endsWith('ing') && w.length > 5) {
    w = w.slice(0, -3);
    stripped = true;
  } else if (w.endsWith('ed') && w.length > 4) {
    w = w.slice(0, -2);
    stripped = true;
  }

  // "running" -> "runn" -> "run" (but keep "install", "pass", "buzz").
  if (stripped && /([b-df-hj-np-tv-xz])\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) {
    w = w.slice(0, -1);
  }
  if (w.endsWith('e') && w.length > 4) w = w.slice(0, -1);
  return w;
}

/**
 * Split a prompt into raw lower-case alphanumeric words. Punctuation (including
 * every shell metacharacter) acts as a delimiter and is never emitted.
 *
 * @param text - Arbitrary text.
 * @returns Words in order, with duplicates.
 */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['`\u2019]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Canonical form of one word: stem, then synonym canonicalisation. */
export function canonicalWord(word: string): string {
  const stemmed = stem(word);
  return SYNONYM_CANONICAL.get(word) ?? SYNONYM_CANONICAL.get(stemmed) ?? stemmed;
}

/** A prompt after normalisation. */
export interface NormalizedPrompt {
  /** Canonical content tokens, in original order (duplicates preserved). */
  tokens: string[];
  /** Space-joined sorted tokens — a stable order-independent key. */
  key: string;
}

/**
 * Normalise free text into canonical content tokens.
 *
 * @param text - Raw prompt text.
 * @returns The canonical tokens and an order-independent key.
 */
export function normalizeText(text: string): NormalizedPrompt {
  const tokens: string[] = [];
  for (const w of words(text)) {
    if (STOPWORDS.has(w) && !NEGATIONS.has(w)) continue;
    tokens.push(canonicalWord(w));
  }
  const key = [...tokens].sort().join(' ');
  return { tokens, key };
}

// ---------------------------------------------------------------------------
// Distances + similarity
// ---------------------------------------------------------------------------

/**
 * Optimal-string-alignment (Damerau-Levenshtein) distance, capped.
 *
 * @param a - First string.
 * @param b - Second string.
 * @param cap - Stop early once the distance is certain to exceed this.
 * @returns The distance, or `cap + 1` when it exceeds `cap`.
 */
export function editDistance(a: string, b: string, cap = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, (prev2[j - 2] ?? Infinity) + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > cap) return cap + 1;
    prev2.length = 0;
    prev2.push(...prev);
    prev = cur;
  }
  return prev[b.length];
}

/** Character trigrams of a padded string. */
function trigrams(s: string): Map<string, number> {
  const padded = `  ${s} `;
  const out = new Map<string, number>();
  for (let i = 0; i + 3 <= padded.length; i++) {
    const g = padded.slice(i, i + 3);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice coefficient over character trigram multisets. */
export function trigramDice(a: string, b: string): number {
  if (a === b) return 1;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let overlap = 0;
  let total = 0;
  for (const v of ta.values()) total += v;
  for (const v of tb.values()) total += v;
  for (const [g, n] of ta) overlap += Math.min(n, tb.get(g) ?? 0);
  return total === 0 ? 0 : (2 * overlap) / total;
}

/** Cosine similarity between two token-frequency vectors. */
export function tokenCosine(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const fa = new Map<string, number>();
  const fb = new Map<string, number>();
  for (const t of a) fa.set(t, (fa.get(t) ?? 0) + 1);
  for (const t of b) fb.set(t, (fb.get(t) ?? 0) + 1);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [t, n] of fa) {
    dot += n * (fb.get(t) ?? 0);
    na += n * n;
  }
  for (const n of fb.values()) nb += n * n;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Result of comparing two normalised prompts. */
export interface PromptComparison {
  /** Blended similarity in [0,1]. */
  score: number;
  /**
   * True when the two prompts mean the same thing: identical canonical token
   * multisets, tolerating a single-edit typo only on out-of-vocabulary
   * alphabetic words of length >= 5 that are NOT protected tokens.
   */
  equivalent: boolean;
}

/**
 * Compare two normalised prompts.
 *
 * `protectedTokens` are identity-bearing words (workspace node names, command
 * path segments) that must match exactly — "billing" and "building" are one
 * edit apart but are different services.
 *
 * @param a - First normalised prompt.
 * @param b - Second normalised prompt.
 * @param protectedTokens - Canonical tokens that never tolerate typos.
 * @returns The similarity score and the equivalence verdict.
 */
export function comparePrompts(
  a: NormalizedPrompt,
  b: NormalizedPrompt,
  protectedTokens: ReadonlySet<string> = new Set()
): PromptComparison {
  const score =
    0.5 * tokenCosine(a.tokens, b.tokens) + 0.5 * trigramDice(a.key, b.key);

  if (a.tokens.length === 0 || b.tokens.length === 0) {
    return { score, equivalent: false };
  }
  if (a.key === b.key) return { score: Math.max(score, 1), equivalent: true };
  if (a.tokens.length !== b.tokens.length) return { score, equivalent: false };

  // Greedy alignment of the unmatched remainder with typo tolerance.
  const remainingB = [...b.tokens];
  const unmatchedA: string[] = [];
  for (const t of a.tokens) {
    const idx = remainingB.indexOf(t);
    if (idx >= 0) remainingB.splice(idx, 1);
    else unmatchedA.push(t);
  }
  // Each typo'd token is paired with its intended spelling, so the token-level
  // score reflects "same words" and only the character-level score carries the
  // (small) typo penalty.
  const aligned = new Map<string, string>();
  for (const t of unmatchedA) {
    const idx = remainingB.findIndex(u => isTypoPair(t, u, protectedTokens));
    if (idx < 0) return { score, equivalent: false };
    aligned.set(t, remainingB[idx]);
    remainingB.splice(idx, 1);
  }
  if (remainingB.length !== 0) return { score, equivalent: false };
  const alignedScore =
    0.5 * tokenCosine(a.tokens.map(t => aligned.get(t) ?? t), b.tokens) + 0.5 * trigramDice(a.key, b.key);
  return { score: alignedScore, equivalent: true };
}

/**
 * Two differing tokens count as one word with a typo when they are one edit
 * apart, purely alphabetic, long enough that a single edit is not a different
 * word (>= 5 chars), neither is a protected identity token, and they are not
 * both canonical vocabulary words ("list" vs "lint" are different commands).
 */
function isTypoPair(
  a: string,
  b: string,
  protectedTokens: ReadonlySet<string>
): boolean {
  if (!/^[a-z]+$/.test(a) || !/^[a-z]+$/.test(b)) return false;
  if (Math.max(a.length, b.length) < 5) return false;
  if (protectedTokens.has(a) || protectedTokens.has(b)) return false;
  if (VOCABULARY.has(a) && VOCABULARY.has(b)) return false;
  return editDistance(a, b, 1) <= 1;
}
