import { Command } from 'commander';
import {
  buildCommandCatalog,
  CommandCatalogEntry,
} from './command-catalog';

/**
 * Offline, deterministic Natural-Language -> CLI-command intent parser.
 *
 * This module turns a free-text prompt (e.g. "list all templates as json")
 * into a concrete, vetted command candidate drawn from the live command
 * catalogue. It is intentionally:
 *
 *  - OFFLINE: no network, no LLM, no process spawning. Scoring is a pure
 *    function of the prompt text and the static catalogue.
 *  - DETERMINISTIC: the same prompt always yields the same ranking. There is no
 *    randomness, no time, no environment dependence.
 *  - SAFE: the prompt is treated strictly as DATA. We only ever assemble argv
 *    arrays from (a) catalogue-declared command paths/flags and (b) a small set
 *    of value slots whose values are sanitised to a safe identifier charset.
 *    Shell metacharacters in the prompt (`;`, `|`, `&`, backticks, `$()`,
 *    `rm -rf`, ...) can never become part of an executable command — they are
 *    scored as ordinary words and discarded.
 *
 * The parser is exposed behind a pluggable {@link IntentBackend} interface so a
 * future LLM-backed adapter can be slotted in without touching callers. The
 * offline parser is the default and the ONLY backend exercised in tests/CI.
 */

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

/**
 * A single ranked candidate produced by the parser. `argv` is the assembled,
 * already-vetted argument vector (NOT including the binary name) — every token
 * originates from the catalogue or a sanitised value slot, never raw prompt
 * text spliced verbatim.
 */
export interface IntentCandidate {
  /** Catalogue command path, e.g. `templates list`. */
  path: string;
  /** One-line description sourced from the catalogue. */
  description: string;
  /** Assembled argv tokens, e.g. `['templates', 'list', '--json']`. */
  argv: string[];
  /** Confidence in [0, 1]. Higher is better. */
  confidence: number;
  /** Whether the catalogue marks this command as destructive. */
  destructive: boolean;
  /** Whether the resolved command supports `--json`. */
  supportsJson: boolean;
  /** Whether the resolved command supports `--dry-run`. */
  supportsDryRun: boolean;
}

/**
 * Outcome of parsing a prompt. Either a confident single resolution, or a
 * request for clarification when the prompt is ambiguous / too weak to act on.
 *
 * `needsClarification` is the discriminant. On the clarify branch the top
 * candidates are still returned so a caller (or UI) can offer a choice.
 */
export type IntentResult =
  | {
      needsClarification: false;
      candidate: IntentCandidate;
      /** Other plausible candidates, ranked, excluding the chosen one. */
      alternatives: IntentCandidate[];
      /** A human-readable explanation of what the resolved command does. */
      explanation: string;
    }
  | {
      needsClarification: true;
      /** Why clarification is required. */
      reason: string;
      /** Ranked candidates the user could pick from (may be empty). */
      candidates: IntentCandidate[];
      /** A clarifying question to put to the user. */
      question: string;
    };

/**
 * Pluggable backend contract. The offline parser is the default
 * implementation; an LLM adapter can implement the same shape later.
 */
export interface IntentBackend {
  /** Short identifier for this backend (e.g. `offline`, `llm-stub`). */
  readonly name: string;
  /**
   * Parse a free-text prompt into a ranked, vetted command candidate.
   *
   * @param prompt - The raw user prompt text, treated strictly as data.
   * @returns A discriminated `IntentResult`: either a confident resolution or a
   *   request for clarification with ranked alternatives.
   */
  parse(prompt: string): IntentResult;
}

// ---------------------------------------------------------------------------
// Tuning constants (named — no magic numbers)
// ---------------------------------------------------------------------------

/** Minimum absolute score for the top candidate to be acted on at all. */
const MIN_CONFIDENT_SCORE = 0.45;

/**
 * If the runner-up is within this fraction of the leader's score, the result is
 * considered ambiguous and we ask for clarification instead of guessing.
 */
const AMBIGUITY_MARGIN = 0.15;

/** How many candidates to surface on the clarify branch. */
const MAX_CLARIFY_CANDIDATES = 4;

/** Weight applied to a matched path segment (the strongest signal). */
const PATH_SEGMENT_WEIGHT = 3;

/** Weight applied to a matched alias token. */
const ALIAS_WEIGHT = 3;

/** Weight applied to a matched synonym for a path segment. */
const SYNONYM_WEIGHT = 2;

/** Weight applied to a description-word overlap. */
const DESCRIPTION_WEIGHT = 0.5;

/**
 * Max charge a description overlap can contribute, so a long description can't
 * outweigh a real path/alias hit on word-soup prompts.
 */
const DESCRIPTION_CAP = 2;

// ---------------------------------------------------------------------------
// Synonyms: map natural-language words to canonical catalogue segments.
// Offline + curated. Keys are lower-case prompt words; values are the catalogue
// path-segment tokens they imply.
// ---------------------------------------------------------------------------

const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  show: ['list', 'show'],
  display: ['list', 'show'],
  view: ['list', 'show'],
  all: ['list'],
  templates: ['templates'],
  template: ['templates'],
  scaffold: ['templates', 'create'],
  workspaces: ['workspace'],
  workspace: ['workspace'],
  repo: ['workspace'],
  monorepo: ['workspace'],
  health: ['health'],
  healthy: ['health'],
  status: ['health', 'summary'],
  check: ['health', 'validate', 'doctor'],
  validate: ['validate'],
  diagnose: ['doctor'],
  diagnostics: ['doctor'],
  graph: ['graph'],
  dependencies: ['graph', 'analyze'],
  deps: ['graph', 'analyze'],
  analyze: ['analyze'],
  analyse: ['analyze'],
  summary: ['summary'],
  overview: ['summary'],
  create: ['create'],
  make: ['create'],
  new: ['create'],
  generate: ['create', 'generate'],
  build: ['create'],
  service: ['create'],
  app: ['create'],
  project: ['create'],
  commands: ['commands'],
  command: ['commands'],
};

/** Words that strongly imply JSON output (sets the --json flag when present). */
const JSON_WORDS: ReadonlySet<string> = new Set([
  'json',
  'machine-readable',
  'machine',
  'parseable',
]);

/** Stop-words ignored entirely during scoring. */
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
  'please',
  'can',
  'you',
  'me',
  'my',
  'i',
  'want',
  'need',
  'and',
  'is',
  'are',
  'it',
]);

// ---------------------------------------------------------------------------
// Tokenisation + sanitisation
// ---------------------------------------------------------------------------

/**
 * Safe identifier charset for any value spliced into argv (e.g. a project
 * name). Anything outside it is dropped. This is the structural guarantee that
 * injection text in the prompt can never reach a command as an operator: even
 * if a value slot is filled, the value is constrained to `[A-Za-z0-9._-]`.
 */
const SAFE_VALUE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Lower-case word tokens. We split on any non-word/non-dash run, which means
 * shell metacharacters (`;`, `|`, `&`, `` ` ``, `$`, `(`, `)`, `/`, `~`, ...)
 * act purely as delimiters — they are never emitted as tokens and so can never
 * be scored, matched, or assembled into a command.
 *
 * @param prompt - The raw prompt text to tokenise.
 * @returns An array of lower-case tokens containing only `[a-z0-9-]`.
 */
export function tokenize(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter(Boolean);
}

/** Words a token expands to via the synonym table (always includes itself). */
function expand(token: string): string[] {
  const syn = SYNONYMS[token];
  return syn ? [token, ...syn] : [token];
}

// ---------------------------------------------------------------------------
// Slot extraction (the only place a sanitised prompt value enters argv)
// ---------------------------------------------------------------------------

const TEMPLATE_HINTS: ReadonlySet<string> = new Set([
  'express',
  'fastify',
  'nestjs',
  'koa',
  'hapi',
  'react',
  'vue',
  'svelte',
  'next',
  'flask',
  'django',
  'fiber',
  'gin',
  'axum',
  'actix',
]);

/**
 * Pull a project name out of a "create"-style prompt. We look for the pattern
 * `called X` / `named X` / `service X`, then sanitise X. Only a value passing
 * {@link SAFE_VALUE} is accepted; otherwise no name slot is filled (the command
 * stays valid, just unnamed) — never the raw token.
 */
function extractProjectName(tokens: string[]): string | undefined {
  const triggers = new Set(['called', 'named', 'name']);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (triggers.has(tokens[i])) {
      const candidate = tokens[i + 1];
      if (SAFE_VALUE.test(candidate)) return candidate;
    }
  }
  return undefined;
}

/** Detect a framework/template hint present in the prompt. */
function extractTemplateHint(tokens: string[]): string | undefined {
  for (const t of tokens) {
    if (TEMPLATE_HINTS.has(t) && SAFE_VALUE.test(t)) return t;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface ScoredEntry {
  entry: CommandCatalogEntry;
  rawScore: number;
}

/**
 * Score one catalogue entry against the prompt's token bag. The score is a
 * weighted sum of path-segment hits, alias hits, synonym hits, and a capped
 * description overlap. Purely additive and order-independent => deterministic.
 */
function scoreEntry(
  entry: CommandCatalogEntry,
  tokenSet: ReadonlySet<string>,
  expandedSet: ReadonlySet<string>
): number {
  let score = 0;

  const segments = entry.path.split(' ').filter(Boolean);
  for (const seg of segments) {
    const segLower = seg.toLowerCase();
    if (tokenSet.has(segLower)) {
      score += PATH_SEGMENT_WEIGHT;
    } else if (expandedSet.has(segLower)) {
      score += SYNONYM_WEIGHT;
    }
  }

  for (const alias of entry.aliases) {
    if (tokenSet.has(alias.toLowerCase())) score += ALIAS_WEIGHT;
  }

  // Capped description overlap: a soft tie-breaker, never a primary driver.
  // Stop-words are excluded so generic filler ("the", "a", ...) shared with a
  // description can never manufacture a phantom match for an unrelated prompt.
  let descScore = 0;
  const descWords = tokenize(entry.description);
  const descSet = new Set(descWords);
  for (const token of tokenSet) {
    if (STOP_WORDS.has(token)) continue;
    if (descSet.has(token)) descScore += DESCRIPTION_WEIGHT;
  }
  score += Math.min(descScore, DESCRIPTION_CAP);

  return score;
}

/**
 * Normalise a raw additive score into a [0, 1] confidence. We divide by a
 * soft ceiling derived from the entry's own segment count so that deeper
 * commands (which can accrue more path hits) aren't structurally favoured.
 */
function toConfidence(rawScore: number, segmentCount: number): number {
  const ceiling = PATH_SEGMENT_WEIGHT * Math.max(segmentCount, 1) + DESCRIPTION_CAP;
  return Math.min(1, rawScore / ceiling);
}

// ---------------------------------------------------------------------------
// argv assembly (safe by construction)
// ---------------------------------------------------------------------------

/**
 * Assemble the argv for a resolved entry. Tokens come ONLY from:
 *  - the catalogue path segments (trusted, static),
 *  - catalogue-declared flags we choose to set (`--json`, `--template`, ...),
 *  - sanitised value slots that pass {@link SAFE_VALUE}.
 *
 * Raw prompt text is never spliced in. This is the safety sandbox boundary.
 */
function assembleArgv(
  entry: CommandCatalogEntry,
  tokens: string[],
  tokenSet: ReadonlySet<string>
): string[] {
  const argv: string[] = entry.path.split(' ').filter(Boolean);

  // create <name> [--template X] [--framework X]
  if (entry.path === 'create') {
    const name = extractProjectName(tokens);
    if (name) argv.push(name);

    const hint = extractTemplateHint(tokens);
    if (hint && entry.flags.some(f => f.name === '--template')) {
      argv.push('--template', hint);
    }
  }

  // --json when the catalogue supports it and the prompt asks for it.
  const wantsJson = tokens.some(t => JSON_WORDS.has(t));
  if (wantsJson && entry.supportsJson) {
    argv.push('--json');
  }

  // Touch tokenSet so the safe-by-construction contract is explicit and the
  // parameter is part of the signature for future slot extraction.
  void tokenSet;

  return argv;
}

function toCandidate(
  entry: CommandCatalogEntry,
  confidence: number,
  argv: string[]
): IntentCandidate {
  return {
    path: entry.path,
    description: entry.description,
    argv,
    confidence: Number(confidence.toFixed(4)),
    destructive: entry.destructive,
    supportsJson: entry.supportsJson,
    supportsDryRun: entry.supportsDryRun,
  };
}

/**
 * Build a human-readable explanation of what a resolved command does, sourced
 * entirely from the catalogue (description + the flags actually set in argv).
 *
 * @param candidate - The resolved candidate to describe.
 * @param entry - The backing catalogue entry providing descriptions/flag docs.
 * @returns A single human-readable explanation string, joined by spaces.
 */
export function explainCandidate(
  candidate: IntentCandidate,
  entry: CommandCatalogEntry
): string {
  const parts: string[] = [];
  parts.push(
    `Runs \`re-shell ${candidate.argv.join(' ')}\`.`
  );
  if (entry.description) parts.push(entry.description + '.');

  const setFlags = candidate.argv.filter(a => a.startsWith('--'));
  for (const flagName of setFlags) {
    const flag = entry.flags.find(f => f.name === flagName);
    if (flag && flag.description) {
      parts.push(`${flagName}: ${flag.description}.`);
    }
  }

  if (entry.destructive) {
    parts.push('WARNING: this command is destructive and may cause data loss.');
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Offline backend
// ---------------------------------------------------------------------------

/**
 * The default, offline, deterministic backend. It snapshots the catalogue once
 * at construction (callers pass the live `program`) so scoring stays a pure
 * function of prompt vs. a fixed catalogue.
 */
export class OfflineIntentBackend implements IntentBackend {
  public readonly name = 'offline';
  private readonly catalog: CommandCatalogEntry[];
  private readonly byPath: Map<string, CommandCatalogEntry>;

  /**
   * Snapshot the catalogue used for all subsequent scoring.
   *
   * @param catalog - The full command catalogue to score against. Stored by
   *   reference; callers should not mutate entries after construction.
   */
  constructor(catalog: CommandCatalogEntry[]) {
    this.catalog = catalog;
    this.byPath = new Map(catalog.map(e => [e.path, e]));
  }

  /**
   * Look up the catalogue entry for a resolved path (used for explanations).
   *
   * @param path - The catalogue command path, e.g. `templates list`.
   * @returns The matching entry, or `undefined` if no such path exists.
   */
  public entryFor(path: string): CommandCatalogEntry | undefined {
    return this.byPath.get(path);
  }

  /**
   * Parse a free-text prompt into a ranked, vetted command candidate.
   *
   * The prompt is tokenised, scored against every catalogue entry, and the
   * results are either resolved to a single confident candidate or surfaced
   * as a clarification request when the signal is too weak or ambiguous.
   *
   * @param prompt - The raw user prompt text, treated strictly as data.
   * @returns A discriminated `IntentResult`: confident resolution or
   *   clarification request with ranked candidates.
   */
  public parse(prompt: string): IntentResult {
    const tokens = tokenize(prompt);
    const tokenSet = new Set(tokens);

    const expanded = new Set<string>();
    for (const t of tokens) for (const e of expand(t)) expanded.add(e);

    // Meaningful tokens (drop stop-words) drive the "do we have any signal?"
    // check, so a prompt of pure noise/injection yields no confident match.
    const meaningful = tokens.filter(t => !STOP_WORDS.has(t));

    const scored: ScoredEntry[] = this.catalog
      .map(entry => ({
        entry,
        rawScore: scoreEntry(entry, tokenSet, expanded),
      }))
      .filter(s => s.rawScore > 0)
      .sort((a, b) => {
        if (b.rawScore !== a.rawScore) return b.rawScore - a.rawScore;
        // Deterministic tie-break: shorter path first, then lexicographic.
        const segDiff =
          a.entry.path.split(' ').length - b.entry.path.split(' ').length;
        if (segDiff !== 0) return segDiff;
        return a.entry.path.localeCompare(b.entry.path);
      });

    const candidates: IntentCandidate[] = scored.map(s => {
      const segCount = s.entry.path.split(' ').length;
      const confidence = toConfidence(s.rawScore, segCount);
      const argv = assembleArgv(s.entry, tokens, tokenSet);
      return toCandidate(s.entry, confidence, argv);
    });

    if (candidates.length === 0 || meaningful.length === 0) {
      return {
        needsClarification: true,
        reason: 'no-match',
        candidates: [],
        question:
          'I could not match that to a known command. Try naming a command, e.g. "list templates" or "check workspace health".',
      };
    }

    const top = candidates[0];
    const runnerUp = candidates[1];

    const tooWeak = top.confidence < MIN_CONFIDENT_SCORE;
    const tooClose =
      runnerUp !== undefined &&
      top.confidence - runnerUp.confidence < AMBIGUITY_MARGIN &&
      // Only ambiguous if the runner-up is also reasonably strong.
      runnerUp.confidence >= MIN_CONFIDENT_SCORE - AMBIGUITY_MARGIN;

    if (tooWeak || tooClose) {
      return {
        needsClarification: true,
        reason: tooWeak ? 'low-confidence' : 'multiple-candidates',
        candidates: candidates.slice(0, MAX_CLARIFY_CANDIDATES),
        question: tooWeak
          ? 'I am not confident which command you mean. Did you mean one of these?'
          : 'That could match more than one command. Which did you mean?',
      };
    }

    const entry = this.byPath.get(top.path);
    const explanation = entry
      ? explainCandidate(top, entry)
      : `Runs \`re-shell ${top.argv.join(' ')}\`.`;

    return {
      needsClarification: false,
      candidate: top,
      alternatives: candidates.slice(1, MAX_CLARIFY_CANDIDATES),
      explanation,
    };
  }
}

// ---------------------------------------------------------------------------
// LLM adapter STUB — NOT used in tests/CI, NOT wired to any network call.
// ---------------------------------------------------------------------------

/**
 * Placeholder for a future LLM-backed intent backend.
 *
 * It is intentionally inert: constructing it is fine, but `parse` throws so it
 * can never be silently exercised offline or in CI. A real implementation would
 * call out to a provider, then MUST funnel the model's suggestion back through
 * the same catalogue lookup + {@link assembleArgv} sandbox so that no free-form
 * shell string can ever escape — the model proposes a path, never raw argv.
 */
export class LlmIntentBackendStub implements IntentBackend {
  public readonly name = 'llm-stub';

  /**
   * Always throws — this backend is inert by design.
   *
   * A real adapter MUST still resolve through the catalogue + argv sandbox so
   * no free-form shell string can ever escape.
   *
   * @param _prompt - Unused prompt (accepted to satisfy the interface).
   * @returns Never — this implementation always throws.
   * @throws {Error} Always, because no LLM backend is configured.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(_prompt: string): IntentResult {
    throw new Error(
      'LlmIntentBackendStub is a stub: no LLM backend is configured. ' +
        'Use the offline backend (default). A real adapter must still resolve ' +
        'through the command catalogue + argv sandbox.'
    );
  }
}

// ---------------------------------------------------------------------------
// Convenience factory
// ---------------------------------------------------------------------------

/**
 * Build the default offline backend from a live commander program. Snapshots
 * the catalogue at call time.
 *
 * @param program - The commander `Command` instance for the running CLI.
 * @returns A new `OfflineIntentBackend` bound to the snapshot catalogue.
 */
export function createOfflineBackend(program: Command): OfflineIntentBackend {
  return new OfflineIntentBackend(buildCommandCatalog(program));
}

/**
 * One-shot convenience: parse a prompt against a program using the offline
 * backend. Equivalent to `createOfflineBackend(program).parse(prompt)`.
 *
 * @param program - The commander `Command` instance for the running CLI.
 * @param prompt - The raw user prompt text to resolve.
 * @returns A discriminated `IntentResult` from the offline backend.
 */
export function parseIntent(program: Command, prompt: string): IntentResult {
  return createOfflineBackend(program).parse(prompt);
}
