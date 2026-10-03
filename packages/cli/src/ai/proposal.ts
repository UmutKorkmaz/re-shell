import { explainCandidate, type IntentCandidate } from '../utils/ai-intent';
import { vetArgv, type CatalogIndex, type VetFailure, type VetSuccess } from './argv-guard';
import { EXCLUDED_PATH_PREFIXES } from './prompt';
import {
  resolveNodeValue,
  toNodeRef,
  type WorkspaceContext,
  type WorkspaceNode,
} from './workspace-context';
import {
  DESTRUCTIVE_MIN_CONFIDENCE,
  MIN_RESOLVE_CONFIDENCE,
  type RawProposal,
  type WorkspaceNodeRef,
} from './types';

/**
 * Turn an UNTRUSTED model proposal into something the CLI may act on.
 *
 * This is the gate between "what the model said" and "what re-shell will run":
 *
 *  1. every argv (the proposal and each alternative) goes through
 *     {@link vetArgv}: real catalogue command, declared flags only, shell-inert
 *     values;
 *  2. values that refer to workspace nodes (`--filter payments`, `restart api`)
 *     are resolved against the LIVE workspace graph and rewritten to the
 *     node's canonical name — a model cannot target a node that does not
 *     exist; ambiguous or unknown references become a clarification;
 *  3. low-confidence proposals, and destructive commands below a higher bar,
 *     become clarifications instead of resolutions.
 *
 * Nothing that fails a step is repaired silently or executed.
 */

/** Flags whose value names a workspace node. */
const NODE_FLAGS: ReadonlySet<string> = new Set([
  '--filter', '--workspace', '--service', '--app', '--package', '--project', '--microfrontend',
]);

/** Declared positional argument names that refer to an existing node. */
const NODE_ARG_NAMES: ReadonlySet<string> = new Set([
  'service', 'pkg', 'package', 'workspace', 'app', 'microfrontend', 'project',
]);

/** Commands whose generic `name` positional refers to an existing node. */
const NODE_NAME_ARG_PATHS: ReadonlySet<string> = new Set([
  'build', 'serve', 'remove', 'workspace impact workspace',
]);

/** Penalties applied to the model's confidence. */
const FUZZY_NODE_PENALTY = 0.15;
const WORDS_NODE_PENALTY = 0.05;
const REWRITE_NODE_PENALTY = 0.02;
const MISSING_ARGS_PENALTY = 0.1;

/** Everything proposal validation needs. */
export interface ProposalContext {
  index: CatalogIndex;
  workspace: WorkspaceContext;
  /** The user's prompt (used to honour a request for JSON output). */
  prompt: string;
}

/** Outcome of validating a proposal. */
export type ProposalResolution =
  | {
      kind: 'resolved';
      candidate: IntentCandidate;
      alternatives: IntentCandidate[];
      explanation: string;
      warnings: string[];
    }
  | {
      kind: 'clarify';
      reason: string;
      question: string;
      candidates: IntentCandidate[];
      warnings: string[];
    }
  | { kind: 'invalid'; code: string; message: string };

type BuildOutcome =
  | { kind: 'ok'; candidate: IntentCandidate; vet: VetSuccess }
  | { kind: 'invalid'; failure: VetFailure }
  | { kind: 'node-issue'; value: string; slotIndex: number; vet: VetSuccess; nodes: WorkspaceNode[] };

const WANTS_JSON = /\bjson\b|machine[- ]readable|parseable/i;

function isNodeSlot(vet: VetSuccess, slot: VetSuccess['slots'][number]): boolean {
  if (slot.kind === 'flag-value') return slot.flag !== undefined && NODE_FLAGS.has(slot.flag);
  const name = (slot.argName ?? '').toLowerCase();
  if (NODE_ARG_NAMES.has(name)) return true;
  return name === 'name' && NODE_NAME_ARG_PATHS.has(vet.entry.path);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function sanitizeText(text: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Validate one argv and build its {@link IntentCandidate}.
 *
 * @param argv - Untrusted argv.
 * @param confidence - The model's reported confidence for it.
 * @param ctx - Validation context.
 * @returns The candidate, a vet failure, or an unresolved-node issue.
 */
function buildCandidate(argv: unknown, confidence: number, ctx: ProposalContext): BuildOutcome {
  const vet = vetArgv(argv, ctx.index, { excludePathPrefixes: EXCLUDED_PATH_PREFIXES });
  if (vet.ok === false) return { kind: 'invalid', failure: vet };

  const tokens = [...vet.argv];
  const refs = new Map<string, WorkspaceNodeRef>();
  let penalty = 0;

  if (ctx.workspace.nodes.length > 0) {
    for (const slot of vet.slots) {
      const value = tokens[slot.index];
      const resolution = resolveNodeValue(ctx.workspace, value);
      if (isNodeSlot(vet, slot)) {
        if (!resolution.node) {
          return { kind: 'node-issue', value, slotIndex: slot.index, vet, nodes: resolution.candidates };
        }
        if (resolution.node.name !== value) {
          tokens[slot.index] = resolution.node.name;
          penalty +=
            resolution.how === 'fuzzy'
              ? FUZZY_NODE_PENALTY
              : resolution.how === 'words'
                ? WORDS_NODE_PENALTY
                : REWRITE_NODE_PENALTY;
        }
        refs.set(resolution.node.name, toNodeRef(resolution.node));
      } else if (resolution.node && ['exact', 'path', 'basename'].includes(resolution.how)) {
        // Informational: the value happens to be a real node.
        refs.set(resolution.node.name, toNodeRef(resolution.node));
      }
    }
  }

  // Honour an explicit request for JSON output, exactly like the offline parser.
  if (
    WANTS_JSON.test(ctx.prompt) &&
    vet.entry.supportsJson &&
    !tokens.includes('--json')
  ) {
    tokens.push('--json');
  }

  // A node name rewritten into argv must itself be shell-inert; re-vet the
  // final argv so the guarantee holds for exactly what is returned.
  const final = vetArgv(tokens, ctx.index, { excludePathPrefixes: EXCLUDED_PATH_PREFIXES });
  if (final.ok === false) return { kind: 'invalid', failure: final };

  if (final.missingArgs.length > 0) penalty += MISSING_ARGS_PENALTY;
  const entry = final.entry;
  const candidate: IntentCandidate = {
    path: entry.path,
    description: entry.description,
    argv: final.argv,
    confidence: Number(clamp01(confidence - penalty).toFixed(4)),
    destructive: entry.destructive,
    supportsJson: entry.supportsJson,
    supportsDryRun: entry.supportsDryRun,
    ...(refs.size > 0 ? { nodes: [...refs.values()] } : {}),
    ...(final.missingArgs.length > 0 ? { missingArgs: final.missingArgs } : {}),
  };
  return { kind: 'ok', candidate, vet: final };
}

/** Validate a list of alternative argvs, dropping any that fail. */
function validAlternatives(
  proposal: RawProposal,
  ctx: ProposalContext,
  excludeArgv?: string[]
): IntentCandidate[] {
  const out: IntentCandidate[] = [];
  const seen = new Set<string>(excludeArgv ? [excludeArgv.join(' ')] : []);
  for (const alt of proposal.alternatives) {
    const built = buildCandidate(alt.argv, alt.confidence, ctx);
    if (built.kind !== 'ok') continue;
    const key = built.candidate.argv.join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(built.candidate);
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}

/**
 * Validate a model proposal against the live catalogue and workspace.
 *
 * @param proposal - The (shape-checked, otherwise untrusted) model proposal.
 * @param ctx - Catalogue index, workspace context and the user's prompt.
 * @returns A resolved command, a clarification, or an invalid verdict.
 */
export function validateProposal(proposal: RawProposal, ctx: ProposalContext): ProposalResolution {
  const warnings: string[] = [];

  if (proposal.outcome === 'unsupported') {
    return {
      kind: 'clarify',
      reason: 'no-match',
      question:
        sanitizeText(proposal.question, 300) ||
        'I could not match that to a known command. Try naming a command, e.g. "list templates" or "check workspace health".',
      candidates: [],
      warnings,
    };
  }

  if (proposal.outcome === 'clarify') {
    const candidates: IntentCandidate[] = [];
    if (proposal.argv.length > 0) {
      const primary = buildCandidate(proposal.argv, proposal.confidence, ctx);
      if (primary.kind === 'ok') candidates.push(primary.candidate);
    }
    candidates.push(
      ...validAlternatives(proposal, ctx, candidates[0]?.argv)
    );
    return {
      kind: 'clarify',
      reason: 'multiple-candidates',
      question:
        sanitizeText(proposal.question, 300) || 'That could match more than one command. Which did you mean?',
      candidates: candidates.slice(0, 4),
      warnings,
    };
  }

  // outcome === 'command'
  const built = buildCandidate(proposal.argv, proposal.confidence, ctx);
  if (built.kind === 'invalid') {
    return { kind: 'invalid', code: built.failure.code, message: built.failure.message };
  }

  if (built.kind === 'node-issue') {
    // The model named a node that is not (unambiguously) in the workspace.
    const options: IntentCandidate[] = [];
    for (const node of built.nodes.slice(0, 4)) {
      const rewritten = [...built.vet.argv];
      rewritten[built.slotIndex] = node.name;
      const alt = buildCandidate(rewritten, Math.min(proposal.confidence, 0.6), ctx);
      if (alt.kind === 'ok') options.push(alt.candidate);
    }
    return {
      kind: 'clarify',
      reason: options.length > 1 ? 'ambiguous-node' : 'unknown-node',
      question:
        options.length > 1
          ? `"${sanitizeText(built.value, 60)}" matches several workspace nodes. Which one did you mean?`
          : `No workspace node matches "${sanitizeText(built.value, 60)}". Which node did you mean?`,
      candidates: options,
      warnings,
    };
  }

  const candidate = built.candidate;
  const alternatives = validAlternatives(proposal, ctx, candidate.argv);

  if (candidate.confidence < MIN_RESOLVE_CONFIDENCE) {
    return {
      kind: 'clarify',
      reason: 'low-confidence',
      question: 'I am not confident which command you mean. Did you mean one of these?',
      candidates: [candidate, ...alternatives].slice(0, 4),
      warnings,
    };
  }
  if (candidate.destructive && candidate.confidence < DESTRUCTIVE_MIN_CONFIDENCE) {
    return {
      kind: 'clarify',
      reason: 'destructive-low-confidence',
      question:
        'That would run a destructive command and I am not sure it is what you want. Please confirm or rephrase.',
      candidates: [candidate, ...alternatives].slice(0, 4),
      warnings,
    };
  }

  const rationale = sanitizeText(proposal.rationale, 240);
  const explanation = [
    explainCandidate(candidate, built.vet.entry),
    rationale ? `Why: ${rationale}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return { kind: 'resolved', candidate, alternatives, explanation, warnings };
}
