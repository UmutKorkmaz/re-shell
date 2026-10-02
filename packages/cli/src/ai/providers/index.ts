import type { CommandCatalogEntry } from '../../utils/command-catalog';
import { ContextualIntentBackend } from '../offline-resolver';
import {
  AiProviderError,
  type AiProvider,
  type AiProviderConfig,
  type ProviderRequest,
  type ProviderResponse,
  type RawProposal,
} from '../types';
import { emptyWorkspaceContext, type WorkspaceContext } from '../workspace-context';
import { AnthropicProvider } from './anthropic';
import { OpenAiCompatibleProvider } from './openai-compatible';

export { AnthropicProvider, supportsEffort } from './anthropic';
export {
  OpenAiCompatibleProvider,
  normalizeBaseUrl,
  isLocalOrPrivateHost,
} from './openai-compatible';
export { extractJsonObject, parseProposalText, parseRawProposal } from './parse';

/** Collaborators a provider may need. */
export interface ProviderDeps {
  /** Injected transport for the network providers (tests). */
  fetch?: typeof fetch;
  /** Needed by the offline provider. */
  catalog?: readonly CommandCatalogEntry[];
  /** Used by the offline provider for node-aware resolution. */
  workspace?: WorkspaceContext;
  /** SDK retries for the Anthropic provider. */
  maxRetries?: number;
}

/**
 * The always-available offline provider. It adapts the deterministic
 * {@link ContextualIntentBackend} to the {@link AiProvider} interface so
 * programmatic callers can treat all three backends uniformly.
 */
export class OfflineProvider implements AiProvider {
  public readonly name = 'offline' as const;
  private readonly backend: ContextualIntentBackend;

  constructor(catalog: readonly CommandCatalogEntry[], workspace: WorkspaceContext) {
    this.backend = new ContextualIntentBackend(catalog, workspace);
  }

  async propose(request: ProviderRequest): Promise<ProviderResponse> {
    const started = Date.now();
    const result = this.backend.parse(request.prompt);
    let proposal: RawProposal;
    if (result.needsClarification === true) {
      proposal = {
        outcome: result.reason === 'no-match' ? 'unsupported' : 'clarify',
        argv: [],
        confidence: 0,
        rationale: result.reason,
        question: result.question,
        alternatives: result.candidates.map(c => ({ argv: c.argv, confidence: c.confidence })),
      };
    } else {
      proposal = {
        outcome: 'command',
        argv: result.candidate.argv,
        confidence: result.candidate.confidence,
        rationale: result.explanation,
        question: '',
        alternatives: result.alternatives.map(c => ({ argv: c.argv, confidence: c.confidence })),
      };
    }
    return { proposal, model: 'offline', latencyMs: Date.now() - started };
  }
}

/**
 * Create a provider from a resolved configuration.
 *
 * Programmatic entry point: callers (the CLI, the dashboard assistant, tests)
 * get a uniform {@link AiProvider} whichever backend is configured. A provider
 * only PROPOSES; its output is untrusted until it passes `validateProposal`
 * (or is run through `resolveIntent`, which does that for you).
 *
 * @param config - Resolved provider configuration (see `resolveAiConfig`).
 * @param deps - Injected transport / catalogue / workspace.
 * @returns The provider.
 * @throws {AiProviderError} `config` when the configuration cannot produce one
 *   (e.g. `openai-compatible` without a base URL, `offline` without a catalogue).
 */
export function createProvider(config: AiProviderConfig, deps: ProviderDeps = {}): AiProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider({
        model: config.model ?? 'claude-opus-5-5',
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        timeoutMs: config.timeoutMs,
        fetch: deps.fetch,
        maxRetries: deps.maxRetries,
      });
    case 'openai-compatible':
      if (!config.baseUrl) {
        throw new AiProviderError(
          'openai-compatible',
          'config',
          'the openai-compatible provider needs a base URL (set RE_SHELL_AI_BASE_URL or `re-shell ai config set baseUrl <url>`)'
        );
      }
      return new OpenAiCompatibleProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs,
        fetch: deps.fetch,
      });
    case 'offline':
      if (!deps.catalog) {
        throw new AiProviderError('offline', 'config', 'the offline provider needs the command catalogue');
      }
      return new OfflineProvider(deps.catalog, deps.workspace ?? emptyWorkspaceContext(process.cwd()));
  }
}
