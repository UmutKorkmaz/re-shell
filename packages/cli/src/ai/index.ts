/**
 * Programmatic API for the `re-shell ai` command interface.
 *
 * Importable as `@re-shell/cli/ai` (see the package `exports` map):
 *
 * ```ts
 * import { resolveIntent, createProvider, resolveAiConfig } from '@re-shell/cli/ai';
 *
 * const { result, meta } = await resolveIntent('build the payments service', {
 *   catalog,                       // CommandCatalogEntry[] (e.g. from `commands list --json`)
 *   cwd: workspaceRoot,
 * });
 * if (!result.needsClarification) {
 *   // result.candidate.argv is a vetted `re-shell` argv: run it with shell:false
 * }
 * ```
 *
 * Guarantees: nothing here executes a command; every argv returned has been
 * checked against the command catalogue and the shell-inert allow-list; a
 * failing provider degrades to the offline parser (a warning, not an error)
 * unless `fallback: false` is passed.
 */

export {
  resolveIntent,
  AiResolveError,
  MAX_PROMPT_LENGTH,
  type ResolveOptions,
  type ResolveOutput,
  type ResolveMeta,
  type ResolutionSource,
} from './resolver';

export {
  createProvider,
  OfflineProvider,
  AnthropicProvider,
  OpenAiCompatibleProvider,
  type ProviderDeps,
} from './providers';

export {
  resolveAiConfig,
  describeAiConfig,
  readPersistedAiConfig,
  writePersistedAiConfig,
  parseConfigValue,
  isAiConfigKey,
  AI_CONFIG_KEYS,
  DEFAULT_ANTHROPIC_MODEL,
  type ResolvedAiConfig,
  type RedactedAiConfig,
  type PersistedAiConfig,
  type AiConfigKey,
  type AiConfigOverrides,
} from './config';

export {
  buildWorkspaceContext,
  renderWorkspaceContext,
  findNodeMentions,
  resolveNodeValue,
  type WorkspaceContext,
  type WorkspaceNode,
} from './workspace-context';

export { vetArgv, indexCatalog, isSafeArgValue, type VetResult } from './argv-guard';
export { validateProposal, type ProposalResolution } from './proposal';
export { ContextualIntentBackend } from './offline-resolver';
export { SemanticCache, catalogSignature, type CacheStats } from './cache';
export { SessionStore, type AiSession, type SessionSummary } from './session';
export { suggest, type Suggestion } from './suggest';
export { confirmAndRun, resolveSelfCommand } from './run';

export {
  AiProviderError,
  AI_PROVIDER_NAMES,
  LOW_CONFIDENCE_THRESHOLD,
  type AiProvider,
  type AiProviderName,
  type AiProviderConfig,
  type ProviderRequest,
  type ProviderResponse,
  type RawProposal,
} from './types';

export type { IntentCandidate, IntentResult } from '../utils/ai-intent';
