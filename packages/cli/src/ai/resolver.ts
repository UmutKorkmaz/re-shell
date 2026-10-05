import * as path from 'path';
import type { Command } from 'commander';
import { buildCommandCatalog, type CommandCatalogEntry } from '../utils/command-catalog';
import {
  explainCandidate,
  type IntentCandidate,
  type IntentResult,
} from '../utils/ai-intent';
import { indexCatalog, vetArgv, type CatalogIndex } from './argv-guard';
import { catalogSignature, SemanticCache, type CacheScope } from './cache';
import { interpretAnswer } from './clarify';
import {
  readPersistedAiConfig,
  resolveAiConfig,
  type AiConfigOverrides,
  type PersistedAiConfig,
  type ResolvedAiConfig,
} from './config';
import { ContextualIntentBackend } from './offline-resolver';
import {
  commandGroups,
  DEFAULT_EXCERPT_SIZE,
  EXCLUDED_PATH_PREFIXES,
  retrieveCatalogExcerpt,
  toExcerptEntries,
} from './prompt';
import { validateProposal, type ProposalResolution } from './proposal';
import { createProvider } from './providers';
import {
  historyForModel,
  SessionError,
  SessionStore,
  storablePrompt,
  type AiSession,
} from './session';
import { aiStateDir } from './store';
import { canonicalWord, words } from './text';
import {
  AiProviderError,
  LOW_CONFIDENCE_THRESHOLD,
  type AiProvider,
  type AiProviderName,
  type ProviderRequest,
} from './types';
import {
  buildWorkspaceContext,
  nodeIdentityStems,
  renderWorkspaceContext,
  type WorkspaceContext,
} from './workspace-context';

/**
 * `resolveIntent`: the programmatic heart of `re-shell ai`.
 *
 * Given a prompt it (optionally) answers a pending clarification, consults the
 * semantic cache, asks the configured provider (cloud LLM, local LLM, or the
 * offline parser), validates whatever comes back against the live command
 * catalogue and workspace graph, falls back to the offline parser with a
 * warning when a provider fails, and records the turn in the session.
 *
 * It never executes anything. Execution is a separate, confirmed step (see
 * `run.ts`).
 */

/** Longest prompt we process; longer input is truncated with a warning. */
export const MAX_PROMPT_LENGTH = 4000;

/** Error raised for conditions that must fail the command (not fall back). */
export class AiResolveError extends Error {
  constructor(
    public readonly code: 'AI_PROVIDER_ERROR' | 'AI_SESSION_ERROR' | 'AI_INTENT_ERROR',
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AiResolveError';
  }
}

/** Options for {@link resolveIntent}. */
export interface ResolveOptions {
  /** The live commander program (used to build the catalogue). */
  program?: Command;
  /** A pre-built catalogue (alternative to `program`). */
  catalog?: readonly CommandCatalogEntry[];
  /** Directory to resolve the workspace from. Defaults to `process.cwd()`. */
  cwd?: string;
  /** A pre-built workspace context (skips discovery). */
  workspace?: WorkspaceContext;
  /** Environment (defaults to `process.env`). */
  env?: Readonly<Record<string, string | undefined>>;
  /** Persisted `ai:` config (defaults to the global config file). */
  persistedConfig?: PersistedAiConfig;
  /** CLI-flag overrides for the config. */
  overrides?: AiConfigOverrides;
  /** A fully resolved config (skips env/persisted resolution). */
  config?: ResolvedAiConfig;
  /** Injected transport for network providers (tests). */
  fetch?: typeof fetch;
  /** An already-constructed provider (skips `createProvider`). */
  provider?: AiProvider;
  /** Session selection. `id` creates the session if it does not exist yet. */
  session?: { id?: string; continue?: boolean };
  /** Force the cache on/off (default: from config). */
  useCache?: boolean;
  /** Fall back to the offline parser when a provider fails (default true). */
  fallback?: boolean;
  /** Abort signal for the provider call. */
  signal?: AbortSignal;
  /** Injected clock for the cache (tests). */
  now?: () => number;
}

/** Where the answer came from. */
export type ResolutionSource = 'offline' | 'llm' | 'cache' | 'clarification';

/** Metadata about how a prompt was resolved. */
export interface ResolveMeta {
  /** The provider that actually produced the answer. */
  provider: AiProviderName;
  /** The provider that was configured (differs after a fallback). */
  requestedProvider: AiProviderName;
  model?: string;
  source: ResolutionSource;
  cached: boolean;
  cache?: { similarity: number; hits: number };
  /** True when a resolved result's confidence is under the low-confidence bar. */
  lowConfidence: boolean;
  warnings: string[];
  fallback?: { from: AiProviderName; kind: string; message: string };
  session?: { id: string; turn: number; pending: boolean };
  workspace: { root: string; inWorkspace: boolean; nodes: number; fingerprint: string };
  usage?: { inputTokens?: number; outputTokens?: number; latencyMs?: number };
}

/** The result of resolving a prompt. */
export interface ResolveOutput {
  result: IntentResult;
  meta: ResolveMeta;
}

/** Canonical tokens that must match exactly when comparing prompts (cache guard). */
function buildProtectedTokens(
  workspace: WorkspaceContext,
  catalog: readonly CommandCatalogEntry[]
): Set<string> {
  const out = new Set<string>();
  for (const node of workspace.nodes) {
    const { identity, generic } = nodeIdentityStems(node);
    for (const s of [...identity, ...generic]) out.add(canonicalWord(s));
  }
  for (const entry of catalog) {
    for (const w of words(entry.path)) out.add(canonicalWord(w));
  }
  return out;
}

function toIntentResult(validation: Exclude<ProposalResolution, { kind: 'invalid' }>): IntentResult {
  if (validation.kind === 'resolved') {
    return {
      needsClarification: false,
      candidate: validation.candidate,
      alternatives: validation.alternatives,
      explanation: validation.explanation,
    };
  }
  return {
    needsClarification: true,
    reason: validation.reason,
    candidates: validation.candidates,
    question: validation.question,
  };
}

function offlineHintPaths(result: IntentResult): string[] {
  return result.needsClarification === true
    ? result.candidates.map(c => c.path)
    : [result.candidate.path, ...result.alternatives.map(c => c.path)];
}

function describeFailure(error: AiProviderError): string {
  return `${error.kind}: ${error.message}`;
}

/**
 * Resolve a prompt to a vetted command (or a clarifying question).
 *
 * @param prompt - The user's natural-language prompt (treated strictly as data).
 * @param options - Catalogue source, config, session, cache and fallback options.
 * @returns The intent result plus metadata about how it was produced.
 * @throws {AiResolveError} For session errors, and for provider failures when
 *   `fallback` is `false`.
 */
export async function resolveIntent(
  prompt: string,
  options: ResolveOptions = {}
): Promise<ResolveOutput> {
  const warnings: string[] = [];
  const catalog = options.catalog ?? (options.program ? buildCommandCatalog(options.program) : undefined);
  if (!catalog) {
    throw new AiResolveError('AI_INTENT_ERROR', 'resolveIntent needs either `program` or `catalog`');
  }

  let text = String(prompt ?? '').trim();
  if (text.length > MAX_PROMPT_LENGTH) {
    text = text.slice(0, MAX_PROMPT_LENGTH);
    warnings.push(`the prompt was longer than ${MAX_PROMPT_LENGTH} characters and was truncated`);
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const workspace = options.workspace ?? (await buildWorkspaceContext(cwd));
  const config =
    options.config ??
    resolveAiConfig(
      options.env ?? process.env,
      options.persistedConfig ?? safeReadPersisted(warnings),
      options.overrides
    );

  const index: CatalogIndex = indexCatalog(catalog);
  const offline = new ContextualIntentBackend(catalog, workspace);
  const stateDir = aiStateDir(workspace.root);
  const fingerprint = `${workspace.fingerprint}:${catalogSignature(catalog.map(e => e.path))}`;
  const meta: ResolveMeta = {
    provider: config.provider,
    requestedProvider: config.provider,
    model: config.model,
    source: 'offline',
    cached: false,
    lowConfidence: false,
    warnings,
    workspace: {
      root: workspace.root,
      inWorkspace: workspace.inWorkspace,
      nodes: workspace.nodes.length,
      fingerprint: workspace.fingerprint,
    },
  };

  const explain = (c: IntentCandidate): string => {
    const entry = index.byPath.get(c.path);
    return entry ? explainCandidate(c, entry) : `Runs \`re-shell ${c.argv.join(' ')}\`.`;
  };

  // ---- session ----
  const store = new SessionStore(stateDir);
  let session: AiSession | undefined;
  try {
    if (options.session?.id !== undefined) {
      session = store.exists(options.session.id)
        ? store.load(options.session.id)
        : store.create(options.session.id, workspace.fingerprint);
    } else if (options.session?.continue) {
      const latest = store.latestId();
      if (latest) session = store.load(latest);
      else {
        session = store.create(undefined, workspace.fingerprint);
        warnings.push('no previous session found; started a new one');
      }
    }
  } catch (error) {
    if (error instanceof SessionError) {
      throw new AiResolveError('AI_SESSION_ERROR', error.message, { reason: error.code });
    }
    throw error;
  }

  // The prompt as resolved: the raw text, or original prompt + refinement.
  let effectivePrompt = text;

  const finish = (result: IntentResult): ResolveOutput => {
    if (result.needsClarification === false) {
      meta.lowConfidence = result.candidate.confidence < LOW_CONFIDENCE_THRESHOLD;
    }
    // A clarification always gets a session so the user can answer it next turn.
    if (result.needsClarification === true && !session) {
      try {
        session = store.create(undefined, workspace.fingerprint);
      } catch {
        /* unreachable: generated ids are valid */
      }
    }
    if (session) {
      recordTurn(session, text, effectivePrompt, result, meta);
      try {
        store.save(session);
        meta.session = {
          id: session.id,
          turn: session.turns.length,
          pending: session.pending !== undefined,
        };
      } catch (error) {
        warnings.push(`could not save the session: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return { result, meta };
  };

  if (text === '') {
    return finish({
      needsClarification: true,
      reason: 'no-match',
      candidates: [],
      question: 'What would you like to do? Describe it in a sentence, e.g. "build the api service".',
    });
  }

  // ---- answer a pending clarification ----
  let pendingQuestion: string | undefined;
  const pending = session?.pending;
  if (session && pending) {
    const answer = interpretAnswer(text, pending.candidates);
    if (answer.kind === 'choice') {
      const picked: IntentCandidate = {
        ...answer.candidate,
        confidence: Math.max(answer.candidate.confidence, 0.9),
      };
      session.pending = undefined;
      meta.source = 'clarification';
      meta.provider = 'offline';
      return finish({
        needsClarification: false,
        candidate: picked,
        alternatives: pending.candidates.filter((_, i) => i !== answer.index),
        explanation: `${explain(picked)} (selected from the options offered for "${storablePrompt(pending.originalPrompt).slice(0, 80)}")`,
      });
    }
    if (answer.kind === 'cancel') {
      session.pending = undefined;
      meta.source = 'clarification';
      meta.provider = 'offline';
      return finish({
        needsClarification: true,
        reason: 'cancelled',
        candidates: [],
        question: 'Okay, cancelled. Nothing was run.',
      });
    }
    // refine: more information for the original prompt
    effectivePrompt = `${pending.originalPrompt} ${text}`;
    pendingQuestion = pending.question;
    session.pending = undefined;
  }

  // ---- cache lookup ----
  const cacheEnabled = options.useCache ?? config.cache;
  const hasHistory = (session?.turns.length ?? 0) > 0;
  // Answers that depend on conversation context are not cacheable: a refinement,
  // or any LLM answer that was given with prior turns in view.
  const cacheable =
    cacheEnabled && pendingQuestion === undefined && !(config.provider !== 'offline' && hasHistory);
  const protectedTokens = buildProtectedTokens(workspace, catalog);
  const cache = new SemanticCache(stateDir, {
    ttlSeconds: config.cacheTtlSeconds,
    now: options.now,
  });
  const requestedScope: CacheScope = {
    provider: config.provider,
    model: config.model,
    fingerprint,
  };

  if (cacheable) {
    try {
      const hit = cache.lookup(text, requestedScope, protectedTokens);
      if (hit) {
        const vet = vetArgv(hit.result.candidate.argv, index, {
          excludePathPrefixes: EXCLUDED_PATH_PREFIXES,
        });
        if (vet.ok === true) {
          meta.cached = true;
          meta.source = 'cache';
          meta.cache = { similarity: hit.similarity, hits: hit.hits };
          return finish({
            needsClarification: false,
            candidate: hit.result.candidate,
            alternatives: hit.result.alternatives,
            explanation: hit.result.explanation,
          });
        }
      }
    } catch (error) {
      warnings.push(`the AI cache could not be read: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  // ---- resolve ----
  let result: IntentResult;
  let usedFallback = false;

  if (config.provider === 'offline') {
    result = offline.parse(effectivePrompt);
    meta.source = 'offline';
    meta.model = undefined;
  } else {
    let provider: AiProvider | undefined = options.provider;
    let failure: AiProviderError | undefined;
    let validation: ProposalResolution | undefined;
    let usage: ResolveMeta['usage'];
    let model: string | undefined;

    try {
      provider = provider ?? createProvider(config, { fetch: options.fetch, catalog, workspace });
      const hint = offline.parse(effectivePrompt);
      const excerpt = retrieveCatalogExcerpt(
        catalog,
        effectivePrompt,
        DEFAULT_EXCERPT_SIZE,
        offlineHintPaths(hint)
      );
      const request: ProviderRequest = {
        prompt: text,
        catalog: toExcerptEntries(excerpt),
        groups: commandGroups(catalog),
        workspaceContext: renderWorkspaceContext(workspace, { prompt: effectivePrompt }),
        history: historyForModel(session),
        pendingQuestion,
      };
      const response = await provider.propose(request, options.signal);
      model = response.model;
      usage = {
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        latencyMs: response.latencyMs,
      };
      validation = validateProposal(response.proposal, { index, workspace, prompt: effectivePrompt });
      if (validation.kind === 'invalid') {
        failure = new AiProviderError(
          config.provider,
          'malformed',
          `the model proposed a command that failed validation (${validation.code}): ${validation.message}`
        );
      }
    } catch (error) {
      failure =
        error instanceof AiProviderError
          ? error
          : new AiProviderError(
              config.provider,
              'network',
              error instanceof Error ? error.message : String(error)
            );
    }

    if (failure || !validation || validation.kind === 'invalid') {
      const err = failure ?? new AiProviderError(config.provider, 'malformed', 'no usable proposal');
      if (options.fallback === false) {
        throw new AiResolveError('AI_PROVIDER_ERROR', err.message, {
          provider: err.provider,
          kind: err.kind,
          ...(err.status !== undefined ? { status: err.status } : {}),
        });
      }
      warnings.push(
        `AI provider "${config.provider}" failed (${describeFailure(err)}); used the offline parser instead.`
      );
      meta.fallback = { from: config.provider, kind: err.kind, message: err.message };
      meta.provider = 'offline';
      meta.model = undefined;
      meta.source = 'offline';
      usedFallback = true;
      result = offline.parse(effectivePrompt);
    } else {
      result = toIntentResult(validation);
      warnings.push(...validation.warnings);
      meta.source = 'llm';
      meta.model = model ?? config.model;
      meta.usage = usage;
    }
  }

  // ---- cache store (only fresh, resolved, non-fallback answers) ----
  if (cacheable && !usedFallback && result.needsClarification === false) {
    try {
      cache.store(
        text,
        { provider: meta.provider, model: meta.model, fingerprint },
        {
          candidate: result.candidate,
          alternatives: result.alternatives,
          explanation: result.explanation,
        },
        protectedTokens
      );
    } catch (error) {
      warnings.push(`the AI cache could not be written: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  return finish(result);
}

/** Append the turn to the session and (re)set its pending clarification. */
function recordTurn(
  session: AiSession,
  prompt: string,
  resolvedPrompt: string,
  result: IntentResult,
  meta: ResolveMeta
): void {
  const at = new Date().toISOString();
  const base = { at, prompt: storablePrompt(prompt), provider: meta.provider, source: meta.source };
  if (result.needsClarification === true) {
    if (result.reason === 'cancelled') {
      session.turns.push({ ...base, kind: 'cancelled' });
      session.pending = undefined;
      return;
    }
    session.turns.push({
      ...base,
      kind: 'clarify',
      question: result.question,
      candidates: result.candidates.map(c => ({ argv: c.argv, confidence: c.confidence })),
    });
    session.pending = {
      question: result.question,
      reason: result.reason,
      candidates: result.candidates,
      originalPrompt: storablePrompt(resolvedPrompt),
      askedAt: at,
    };
    return;
  }
  session.turns.push({
    ...base,
    kind: 'resolved',
    argv: result.candidate.argv,
    confidence: result.candidate.confidence,
  });
  session.pending = undefined;
}

function safeReadPersisted(warnings: string[]): PersistedAiConfig {
  try {
    return readPersistedAiConfig();
  } catch (error) {
    warnings.push(`could not read the persisted AI config: ${error instanceof Error ? error.message : 'unknown error'}`);
    return {};
  }
}
