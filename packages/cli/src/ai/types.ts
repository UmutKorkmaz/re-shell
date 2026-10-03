/**
 * Shared types for the `re-shell ai` command interface (P9-A).
 *
 * This file is deliberately dependency-free (types + a couple of tiny runtime
 * constants/classes) so every other module in `src/ai/` can import it without
 * creating cycles.
 */

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/**
 * The model backends `re-shell ai` can route a prompt through.
 *
 * - `anthropic`         : the Anthropic Messages API (cloud LLM).
 * - `openai-compatible` : any server speaking `/v1/chat/completions` (Ollama,
 *                         llama.cpp server, LM Studio, vLLM, ...). This is the
 *                         offline-capable *local LLM* option.
 * - `offline`           : the deterministic, catalogue-scored parser. Always
 *                         available; also the fallback when an LLM provider
 *                         fails.
 */
export type AiProviderName = 'anthropic' | 'openai-compatible' | 'offline';

/** Every provider name, in documentation order. */
export const AI_PROVIDER_NAMES: readonly AiProviderName[] = [
  'anthropic',
  'openai-compatible',
  'offline',
];

/** Where a resolved config value came from (never the value itself). */
export type ConfigSource = 'override' | 'env' | 'config' | 'auto' | 'default';

/** Fully resolved provider configuration, secrets included. NEVER print this. */
export interface AiProviderConfig {
  provider: AiProviderName;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  timeoutMs: number;
}

// ---------------------------------------------------------------------------
// Workspace references
// ---------------------------------------------------------------------------

/** A real workspace node a resolved command refers to. */
export interface WorkspaceNodeRef {
  /** Canonical node name (package name / service name). */
  name: string;
  /** Path relative to the workspace root. */
  path: string;
  /** app | service | package | lib | tool */
  kind: string;
}

// ---------------------------------------------------------------------------
// Model proposals (UNTRUSTED until validated)
// ---------------------------------------------------------------------------

/** What the model decided to do with the prompt. */
export type ProposalOutcome = 'command' | 'clarify' | 'unsupported';

/** One alternative command the model suggests. */
export interface RawAlternative {
  argv: string[];
  confidence: number;
}

/**
 * The structured proposal a provider returns. It is UNTRUSTED model output:
 * nothing in here may be executed or even displayed as a command until
 * `validateProposal` has checked it against the live command catalogue and the
 * argv allow-list.
 */
export interface RawProposal {
  outcome: ProposalOutcome;
  /** Full argv WITHOUT the `re-shell` binary, e.g. ["run","build","--filter","api"]. */
  argv: string[];
  /** Model-reported confidence in [0,1]. */
  confidence: number;
  rationale: string;
  /** Clarifying question when `outcome === 'clarify'`. */
  question: string;
  alternatives: RawAlternative[];
}

/** One prior conversational turn handed to the model for multi-turn memory. */
export interface HistoryTurn {
  prompt: string;
  /** Compact summary of how that turn was answered (argv or the question asked). */
  answer: string;
}

/** A trimmed catalogue entry rendered into the model prompt. */
export interface CatalogExcerptEntry {
  path: string;
  description: string;
  args: Array<{ name: string; required: boolean }>;
  flags: Array<{ name: string; takesValue: boolean }>;
  destructive: boolean;
}

/** Everything a provider needs to ask the model one question. */
export interface ProviderRequest {
  prompt: string;
  catalog: CatalogExcerptEntry[];
  /** Names of every top-level command group (so the model knows the whole surface). */
  groups?: string[];
  /** Compact, pre-rendered workspace context (see workspace-context.ts). */
  workspaceContext?: string;
  history: HistoryTurn[];
  /** Pending clarification question from the previous turn, if any. */
  pendingQuestion?: string;
}

/** What a provider returns on success. */
export interface ProviderResponse {
  proposal: RawProposal;
  model: string;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** A free-form text completion request (used by generators such as `re-shell ui generate`). */
export interface TextRequest {
  /** System prompt: the rules the model must follow. */
  system: string;
  /** The user's request. */
  prompt: string;
  /** Output ceiling; providers clamp it to their own maximum. */
  maxTokens?: number;
}

/** A free-form text completion. The text is UNTRUSTED model output. */
export interface TextResponse {
  text: string;
  model: string;
  latencyMs: number;
  usage?: { inputTokens?: number; outputTokens?: number };
}

/**
 * A model backend. Implementations MUST NOT execute anything: they only turn a
 * request into an untrusted {@link RawProposal} (or, via the optional
 * {@link AiProvider.complete}, untrusted text).
 */
export interface AiProvider {
  readonly name: AiProviderName;
  readonly model?: string;
  propose(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse>;
  /**
   * Free-form text completion. Implemented by the network providers; the offline
   * provider has no model and does not implement it, so callers must fall back to
   * their own deterministic path when it is `undefined`.
   */
  complete?(request: TextRequest, signal?: AbortSignal): Promise<TextResponse>;
}

/** Why a provider call failed. Every kind maps to an offline fallback. */
export type AiProviderErrorKind =
  | 'config' // missing key / model / base URL
  | 'auth' // 401 / 403
  | 'rate-limit' // 429
  | 'http' // any other 4xx / 5xx
  | 'timeout'
  | 'network' // connection refused, DNS, TLS
  | 'malformed' // not JSON / wrong shape
  | 'truncated' // hit max_tokens / finish_reason=length
  | 'refusal'; // model or safety layer declined

/** Typed provider failure. The message never contains the API key. */
export class AiProviderError extends Error {
  public readonly kind: AiProviderErrorKind;
  public readonly status?: number;
  public readonly provider: AiProviderName;

  constructor(
    provider: AiProviderName,
    kind: AiProviderErrorKind,
    message: string,
    status?: number
  ) {
    super(message);
    this.name = 'AiProviderError';
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Thresholds shared across modules
// ---------------------------------------------------------------------------

/** Suggestions / results below this confidence are flagged `lowConfidence`. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** An LLM proposal below this is turned into a clarification, never resolved. */
export const MIN_RESOLVE_CONFIDENCE = 0.45;

/** A destructive command proposed by an LLM must clear this bar to resolve. */
export const DESTRUCTIVE_MIN_CONFIDENCE = 0.75;
