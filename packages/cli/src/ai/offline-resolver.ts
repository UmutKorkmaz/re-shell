import type { CommandCatalogEntry } from '../utils/command-catalog';
import {
  explainCandidate,
  OfflineIntentBackend,
  type IntentBackend,
  type IntentCandidate,
  type IntentResult,
} from '../utils/ai-intent';
import { indexCatalog, vetArgv, type CatalogIndex } from './argv-guard';
import { EXCLUDED_PATH_PREFIXES } from './prompt';
import { canonicalWord, words } from './text';
import {
  findNodeMentions,
  toNodeRef,
  type NodeMention,
  type WorkspaceContext,
  type WorkspaceNode,
} from './workspace-context';

/**
 * The offline resolver with live workspace context.
 *
 * It wraps the deterministic {@link OfflineIntentBackend} and adds one thing the
 * base parser cannot do: resolving a prompt that names a REAL workspace node
 * ("build the payments service") to a command that targets that node
 * (`run build --filter @acme/payments`).
 *
 * It is still fully offline and deterministic, and still safe by construction:
 * every argv it emits is assembled from catalogue-declared paths/flags plus a
 * node name taken from the workspace graph, and is re-checked with
 * {@link vetArgv} against the live catalogue before it is returned. Prompts
 * that mention no node (or no recognisable action) are delegated untouched to
 * the base parser, so its behaviour is unchanged outside a workspace.
 */

/** Verbs that target a workspace node, and the command each maps to. */
export type NodeVerb = 'build' | 'test' | 'lint' | 'typecheck' | 'logs' | 'restart' | 'inspect' | 'impact';

/** Nodes whose mention scores are within this margin are considered tied. */
const NODE_AMBIGUITY_MARGIN = 0.3;

/** Max candidates surfaced on a clarification. */
const MAX_CANDIDATES = 4;

/** Confidence bounds for a resolved node-targeted command. */
const NODE_BASE_CONFIDENCE = 0.55;
const NODE_CONFIDENCE_SPAN = 0.4;
const MISSING_SCRIPT_PENALTY = 0.2;
const NO_VERB_CONFIDENCE = 0.5;

/** Canonical-word -> verb. Keys are canonical forms (see text.ts `canonicalWord`). */
const VERB_BY_CANONICAL: Readonly<Record<string, NodeVerb>> = {
  build: 'build',
  test: 'test',
  lint: 'lint',
  typecheck: 'typecheck',
  log: 'logs',
  restart: 'restart',
  inspect: 'inspect',
  impact: 'impact',
  dependent: 'impact',
};

/** Verbs that run a package script through `re-shell run <task>`. */
const TASK_VERBS: ReadonlySet<NodeVerb> = new Set(['build', 'test', 'lint', 'typecheck']);

/** Detect the node-targeted verbs a prompt contains, in order of appearance. */
export function detectNodeVerbs(prompt: string): NodeVerb[] {
  const found: NodeVerb[] = [];
  const ws = words(prompt);
  for (let i = 0; i < ws.length; i++) {
    let verb: NodeVerb | undefined;
    if (ws[i] === 'type' && ws[i + 1] === 'check') verb = 'typecheck';
    else verb = VERB_BY_CANONICAL[canonicalWord(ws[i])];
    if (verb && !found.includes(verb)) found.push(verb);
  }
  return found;
}

const WANTS_JSON = /\bjson\b|machine[- ]readable|parseable/i;

/** Words that mean "make something new", which overloads verbs like "build". */
const CREATION_WORDS: ReadonlySet<string> = new Set([
  'new', 'called', 'named', 'scaffold', 'generate', 'create', 'make', 'init',
]);

function looksLikeCreation(prompt: string): boolean {
  return words(prompt).some(w => CREATION_WORDS.has(w));
}

/** Actions offered for a node when the prompt names no action, in order. */
export const NODE_ACTION_ORDER: readonly NodeVerb[] = [
  'build', 'test', 'lint', 'logs', 'inspect', 'impact',
];

/**
 * The (unvetted) argv a node-targeted verb maps to, or `undefined` when the verb
 * cannot target that node (e.g. a polyglot service has no package.json for
 * `run` to find). `penalty` is a confidence reduction for a likely-useless run
 * (the task script is not defined for the node).
 *
 * @param verb - The action.
 * @param node - The real workspace node.
 * @returns The argv and penalty, or `undefined`.
 */
export function nodeActionArgv(
  verb: NodeVerb,
  node: WorkspaceNode
): { argv: string[]; penalty: number } | undefined {
  if (TASK_VERBS.has(verb)) {
    if (!node.runnable) return undefined;
    const penalty =
      node.scripts.length > 0 && !node.scripts.includes(verb) ? MISSING_SCRIPT_PENALTY : 0;
    return { argv: ['run', verb, '--filter', node.name], penalty };
  }
  if (verb === 'logs' || verb === 'restart' || verb === 'inspect') {
    if (node.kind !== 'service') return undefined;
    return { argv: ['service', 'run', verb, node.name], penalty: 0 };
  }
  if (verb === 'impact') {
    return { argv: ['workspace', 'impact', 'workspace', node.name], penalty: 0 };
  }
  return undefined;
}

/** The offline resolver with workspace context. */
export class ContextualIntentBackend implements IntentBackend {
  public readonly name = 'offline';
  private readonly base: OfflineIntentBackend;
  private readonly catalog: CommandCatalogEntry[];
  private readonly index: CatalogIndex;

  /**
   * @param catalog - The live command catalogue (the `ai` family is excluded).
   * @param workspace - The live workspace context (may be empty).
   */
  constructor(
    catalog: readonly CommandCatalogEntry[],
    private readonly workspace: WorkspaceContext
  ) {
    this.catalog = catalog.filter(
      e => !EXCLUDED_PATH_PREFIXES.some(p => e.path === p || e.path.startsWith(`${p} `))
    );
    this.base = new OfflineIntentBackend(this.catalog);
    this.index = indexCatalog(this.catalog);
  }

  /** Catalogue entry for a path (used for explanations). */
  public entryFor(path: string): CommandCatalogEntry | undefined {
    return this.base.entryFor(path);
  }

  /** Parse a prompt, using workspace nodes where the prompt names one. */
  public parse(prompt: string): IntentResult {
    const mentions = findNodeMentions(this.workspace, prompt);
    // "build me a new service called payments" creates; it does not target a node.
    if (mentions.length === 0 || looksLikeCreation(prompt)) return this.base.parse(prompt);

    const verbs = detectNodeVerbs(prompt);
    const wantsJson = WANTS_JSON.test(prompt);

    if (verbs.length === 0) {
      // No recognisable action. Trust the base parser if it is confident;
      // otherwise ask what to do with the node.
      const base = this.base.parse(prompt);
      if (!base.needsClarification) return base;
      return this.askActionForNode(mentions, wantsJson) ?? base;
    }

    // Which node(s) does the prompt mean?
    const top = mentions[0];
    const contenders = mentions
      .filter(m => top.score - m.score < NODE_AMBIGUITY_MARGIN)
      .slice(0, MAX_CANDIDATES);

    if (verbs.length > 1) {
      // "build and test payments": several actions -> ask which.
      const candidates = verbs
        .map(v => this.candidateFor(v, top, wantsJson))
        .filter((c): c is IntentCandidate => c !== undefined);
      if (candidates.length > 1) {
        return {
          needsClarification: true,
          reason: 'multiple-candidates',
          candidates: candidates.slice(0, MAX_CANDIDATES),
          question: `Which action should I run for "${top.node.name}"?`,
        };
      }
    }

    const verb = verbs[0];
    const options = contenders
      .map(m => this.candidateFor(verb, m, wantsJson))
      .filter((c): c is IntentCandidate => c !== undefined);

    if (options.length === 0) {
      // The verb cannot target these nodes (e.g. a polyglot service has no
      // package.json to `run` a task in). Let the base parser have a go.
      return this.base.parse(prompt);
    }
    if (contenders.length > 1 && options.length > 1) {
      return {
        needsClarification: true,
        reason: 'multiple-candidates',
        candidates: options,
        question: `That could mean more than one workspace node. Which did you mean for "${verb}"?`,
      };
    }

    const candidate = options[0];
    const entry = this.base.entryFor(candidate.path);
    return {
      needsClarification: false,
      candidate,
      alternatives: [],
      explanation: entry
        ? `${explainCandidate(candidate, entry)} Targets workspace node ${candidate.nodes?.[0]?.name} (${candidate.nodes?.[0]?.path}).`
        : `Runs \`re-shell ${candidate.argv.join(' ')}\`.`,
    };
  }

  /** "payments" with no verb: offer the actions that make sense for the node. */
  private askActionForNode(mentions: NodeMention[], wantsJson: boolean): IntentResult | undefined {
    const top = mentions[0];
    const contenders = mentions.filter(m => top.score - m.score < NODE_AMBIGUITY_MARGIN);
    if (contenders.length > 1) {
      // Several nodes and no action: ask which node first.
      const candidates = contenders
        .slice(0, MAX_CANDIDATES)
        .map(m => this.candidateFor('build', m, wantsJson) ?? this.candidateFor('impact', m, wantsJson))
        .filter((c): c is IntentCandidate => c !== undefined);
      if (candidates.length === 0) return undefined;
      return {
        needsClarification: true,
        reason: 'ambiguous-node',
        candidates,
        question: `Which workspace node did you mean (${contenders.map(m => m.node.name).join(', ')})?`,
      };
    }
    const candidates = NODE_ACTION_ORDER
      .map(v => this.candidateFor(v, top, wantsJson, NO_VERB_CONFIDENCE))
      .filter((c): c is IntentCandidate => c !== undefined)
      .slice(0, MAX_CANDIDATES);
    if (candidates.length === 0) return undefined;
    return {
      needsClarification: true,
      reason: 'missing-action',
      candidates,
      question: `What would you like to do with "${top.node.name}"?`,
    };
  }

  /** Build + vet the candidate for (verb, node), or `undefined` if it cannot apply. */
  private candidateFor(
    verb: NodeVerb,
    mention: NodeMention,
    wantsJson: boolean,
    fixedConfidence?: number
  ): IntentCandidate | undefined {
    const node = mention.node;
    const action = nodeActionArgv(verb, node);
    if (!action) return undefined;
    let argv = action.argv;
    const penalty = action.penalty;

    const entryProbe = vetArgv(argv, this.index);
    if (!entryProbe.ok) return undefined; // catalogue drift: never emit an unvetted command
    if (wantsJson && entryProbe.entry.supportsJson) argv = [...argv, '--json'];

    const vetted = vetArgv(argv, this.index);
    if (!vetted.ok) return undefined;
    const entry = vetted.entry;

    const strength = mention.exact ? 1 : mention.coverage;
    const confidence =
      fixedConfidence ??
      Math.max(0, Math.min(0.97, NODE_BASE_CONFIDENCE + NODE_CONFIDENCE_SPAN * strength - penalty));

    return {
      path: entry.path,
      description: entry.description,
      argv: vetted.argv,
      confidence: Number(confidence.toFixed(4)),
      destructive: entry.destructive,
      supportsJson: entry.supportsJson,
      supportsDryRun: entry.supportsDryRun,
      nodes: [toNodeRef(node)],
      ...(vetted.missingArgs.length > 0 ? { missingArgs: vetted.missingArgs } : {}),
    };
  }
}
