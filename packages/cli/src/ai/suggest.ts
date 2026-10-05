import type { CommandCatalogEntry } from '../utils/command-catalog';
import { indexCatalog, vetArgv } from './argv-guard';
import { NODE_ACTION_ORDER, nodeActionArgv } from './offline-resolver';
import { EXCLUDED_PATH_PREFIXES } from './prompt';
import { editDistance, stem, words } from './text';
import { LOW_CONFIDENCE_THRESHOLD } from './types';
import type { WorkspaceContext } from './workspace-context';

/**
 * Confidence-scored autocomplete for `re-shell ai suggest <partial>`.
 *
 * Completions come from three pools, all local and instant (no model call):
 *  - `history` : prompts the user has already had resolved (from sessions),
 *  - `node`    : actions on REAL workspace nodes ("build payments-service"),
 *  - `command` : paths from the live command catalogue.
 *
 * Each completion carries a confidence in [0,1] built from how well the partial
 * matches (whole-prefix > word-prefix > typo), how much of the completion the
 * partial already covers, how much was typed at all (a two-letter fragment
 * should not look certain), and how trustworthy the pool is. Anything under
 * {@link LOW_CONFIDENCE_THRESHOLD} is flagged `lowConfidence` rather than hidden.
 */

/** Where a completion came from. */
export type SuggestionKind = 'history' | 'node' | 'command';

/** One completion. */
export interface Suggestion {
  /** The completed phrase to show / insert. */
  text: string;
  kind: SuggestionKind;
  confidence: number;
  /** True when `confidence` is below the low-confidence threshold. */
  lowConfidence: boolean;
  /** The re-shell argv this completion maps to (without the binary). */
  argv: string[];
  /** One-line description (usage for commands). */
  description?: string;
}

/** A previously resolved prompt, for the history pool. */
export interface HistoryEntry {
  prompt: string;
  argv: string[];
}

/** Inputs to {@link suggest}. */
export interface SuggestInput {
  catalog: readonly CommandCatalogEntry[];
  workspace: WorkspaceContext;
  history?: readonly HistoryEntry[];
  limit?: number;
}

const KIND_WEIGHT: Readonly<Record<SuggestionKind, number>> = {
  history: 1,
  node: 0.9,
  command: 0.85,
};

const MIN_REPORTED_CONFIDENCE = 0.15;
const DEFAULT_LIMIT = 8;
/** Confidence margin by which a history phrasing beats another pool for the same command. */
const HISTORY_TIE_MARGIN = 0.1;
/** Characters of partial at which the length factor saturates. */
const FULL_LENGTH_FACTOR_AT = 6;

interface Pooled {
  text: string;
  kind: SuggestionKind;
  argv: string[];
  description?: string;
}

/**
 * Match quality of a partial against a completion's words, or 0 for no match.
 * Every complete partial word must match a completion word; the last partial
 * word may be a prefix (still being typed).
 */
function matchQuality(partialWords: readonly string[], textWords: readonly string[]): number {
  if (partialWords.length === 0) return 0;
  const used = new Set<number>();
  let quality = 1;
  for (let i = 0; i < partialWords.length; i++) {
    const pw = partialWords[i];
    const isLast = i === partialWords.length - 1;
    let found = -1;
    let step = 1;
    // Exact (stemmed) word match, in order preference.
    for (let j = 0; j < textWords.length; j++) {
      if (used.has(j)) continue;
      if (textWords[j] === pw || stem(textWords[j]) === stem(pw)) {
        found = j;
        break;
      }
    }
    // The word still being typed may be a prefix.
    if (found === -1 && isLast) {
      for (let j = 0; j < textWords.length; j++) {
        if (!used.has(j) && textWords[j].startsWith(pw)) {
          found = j;
          step = 0.95;
          break;
        }
      }
    }
    // A one-edit typo in a longer word.
    if (found === -1 && pw.length >= 4) {
      for (let j = 0; j < textWords.length; j++) {
        if (!used.has(j) && editDistance(pw, textWords[j], 1) <= 1) {
          found = j;
          step = 0.6;
          break;
        }
      }
    }
    if (found === -1) return 0;
    used.add(found);
    quality *= step;
  }
  // A completion whose words appear in a different order than typed is weaker.
  const order = partialWords.map(pw => textWords.findIndex(tw => tw === pw || tw.startsWith(pw)));
  const inOrder = order.every((v, i) => i === 0 || v >= order[i - 1]);
  return inOrder ? quality : quality * 0.8;
}

function score(partial: string, partialWords: readonly string[], p: Pooled): number {
  const textWords = words(p.text);
  const quality = matchQuality(partialWords, textWords);
  if (quality === 0) return 0;
  const coverage = Math.min(1, partialWords.length / Math.max(1, textWords.length));
  const lengthFactor = Math.min(1, partial.trim().length / FULL_LENGTH_FACTOR_AT);
  const startsWith = p.text.toLowerCase().startsWith(partial.trim().toLowerCase()) ? 1 : 0.92;
  const confidence =
    KIND_WEIGHT[p.kind] * quality * startsWith * (0.55 + 0.45 * coverage) * (0.4 + 0.6 * lengthFactor);
  return Math.min(1, confidence);
}

function shortName(name: string): string {
  return name.replace(/^@[^/]+\//, '');
}

/**
 * Compute autocomplete suggestions.
 *
 * @param partial - The text typed so far.
 * @param input - Catalogue, workspace and history to draw completions from.
 * @returns Suggestions sorted by confidence, best first.
 */
export function suggest(partial: string, input: SuggestInput): Suggestion[] {
  const limit = input.limit ?? DEFAULT_LIMIT;
  const index = indexCatalog(input.catalog);
  const pool: Pooled[] = [];

  for (const h of input.history ?? []) {
    pool.push({ text: h.prompt, kind: 'history', argv: h.argv });
  }

  for (const node of input.workspace.nodes) {
    for (const verb of NODE_ACTION_ORDER) {
      const action = nodeActionArgv(verb, node);
      if (!action) continue;
      const vet = vetArgv(action.argv, index);
      if (vet.ok === false) continue;
      pool.push({
        text: `${verb} ${shortName(node.name)}`,
        kind: 'node',
        argv: vet.argv,
        description: `${vet.entry.description} (${node.path})`,
      });
    }
  }

  for (const entry of input.catalog) {
    if (EXCLUDED_PATH_PREFIXES.some(p => entry.path === p || entry.path.startsWith(`${p} `))) continue;
    const usage = [entry.path, ...entry.args.map(a => (a.required ? `<${a.name}>` : `[${a.name}]`))].join(' ');
    pool.push({
      text: entry.path,
      kind: 'command',
      argv: entry.path.split(' '),
      description: `${usage} — ${entry.description}`,
    });
  }

  const partialWords = words(partial);
  const best = new Map<string, Suggestion>();

  if (partialWords.length === 0) {
    // Nothing typed: offer recent history only, flagged as low confidence.
    for (const h of input.history ?? []) {
      const key = h.argv.join(' ');
      if (!best.has(key)) {
        best.set(key, {
          text: h.prompt,
          kind: 'history',
          confidence: 0.3,
          lowConfidence: true,
          argv: h.argv,
        });
      }
    }
    return [...best.values()].slice(0, limit);
  }

  for (const p of pool) {
    const confidence = score(partial, partialWords, p);
    if (confidence < MIN_REPORTED_CONFIDENCE) continue;
    const key = `${p.argv.join(' ')}`;
    const existing = best.get(key);
    if (existing) {
      // Same command from two pools: the user's own phrasing wins unless the
      // other candidate is clearly the better match.
      const historyBonus = (k: SuggestionKind): number => (k === 'history' ? HISTORY_TIE_MARGIN : 0);
      if (existing.confidence + historyBonus(existing.kind) >= confidence + historyBonus(p.kind)) continue;
    }
    best.set(key, {
      text: p.text,
      kind: p.kind,
      confidence: Number(confidence.toFixed(4)),
      lowConfidence: confidence < LOW_CONFIDENCE_THRESHOLD,
      argv: p.argv,
      ...(p.description ? { description: p.description } : {}),
    });
  }

  return [...best.values()]
    .sort((a, b) => b.confidence - a.confidence || a.text.localeCompare(b.text))
    .slice(0, limit);
}
