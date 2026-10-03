import {
  AiProviderError,
  type AiProvider,
  type ProviderRequest,
  type ProviderResponse,
  type TextRequest,
  type TextResponse,
} from '../types';
import { PROPOSAL_JSON_SCHEMA, SYSTEM_PROMPT, buildMessages } from '../prompt';
import { scrubSecrets } from '../config';
import { parseProposalText } from './parse';

/**
 * Anthropic Messages API provider (cloud LLM).
 *
 * Why the official SDK (`@anthropic-ai/sdk`) rather than a hand-rolled `fetch`:
 *  - it owns the request/response shapes, the `anthropic-version` header,
 *    credential resolution (API key, auth token, profiles) and typed errors, so
 *    this file tracks API changes by bumping a dependency instead of by
 *    maintaining wire code;
 *  - it still accepts an injected `fetch`, so the unit tests exercise the real
 *    SDK request/error paths against a fake transport.
 * The OpenAI-compatible provider has no official SDK to defer to (it targets a
 * de-facto protocol implemented by many local servers), so it uses plain
 * `fetch` — see `openai-compatible.ts`.
 *
 * Request shape (current API):
 *  - structured output via `output_config.format` (`json_schema`), which the
 *    API guarantees to be schema-valid JSON in a text block. Forced
 *    `tool_choice` is not used: it is rejected by the newest models.
 *  - no `temperature`/`top_p`/`budget_tokens` (rejected by current models);
 *    `output_config.effort: "low"` on models that support it, since mapping a
 *    sentence to a command is not a deep-reasoning task.
 *  - `max_tokens` is generous because adaptive-thinking models spend part of it
 *    on reasoning.
 *
 * Failure handling: every failure becomes a typed {@link AiProviderError}
 * (auth / rate-limit / http / timeout / network / refusal / truncated /
 * malformed / config). The caller turns each into a warning plus an offline
 * fallback. A `stop_reason: "refusal"` is surfaced as `refusal`, never
 * retried or papered over.
 */

/** Models that accept `output_config.effort`. Others reject it with a 400. */
const EFFORT_MODELS = /^claude-(opus-(4-[5-9]|[5-9])|sonnet-(4-[6-9]|[5-9])|fable|mythos)/;

const MAX_OUTPUT_TOKENS = 4096;
/** Ceiling for free-form completions (generated source files are longer than a command proposal). */
const MAX_TEXT_TOKENS = 8192;

/** Options for {@link AnthropicProvider}. */
export interface AnthropicProviderOptions {
  model: string;
  /** Explicit key. When omitted the SDK resolves credentials from its own chain. */
  apiKey?: string;
  /** Anthropic-compatible gateway/base URL (the SDK also honours ANTHROPIC_BASE_URL). */
  baseUrl?: string;
  /** Overall deadline for the call, retries included. */
  timeoutMs: number;
  /** Injected transport (tests). */
  fetch?: typeof fetch;
  /** SDK-level retries for 429/5xx/connection errors. Default 1. */
  maxRetries?: number;
}

/** Whether a model id accepts the `effort` output parameter. */
export function supportsEffort(model: string): boolean {
  return EFFORT_MODELS.test(model);
}

/** The Anthropic provider. */
export class AnthropicProvider implements AiProvider {
  public readonly name = 'anthropic' as const;
  public readonly model: string;
  private readonly options: AnthropicProviderOptions;

  constructor(options: AnthropicProviderOptions) {
    this.options = options;
    this.model = options.model;
  }

  async propose(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const started = Date.now();

    // One overall deadline for the whole call (SDK retries included).
    const controller = new AbortController();
    let deadlineHit = false;
    const timer = setTimeout(() => {
      deadlineHit = true;
      controller.abort();
    }, this.options.timeoutMs);
    const onExternalAbort = (): void => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    const secrets = [this.options.apiKey];
    try {
      const client = new Anthropic({
        ...(this.options.apiKey ? { apiKey: this.options.apiKey } : {}),
        ...(this.options.baseUrl ? { baseURL: this.options.baseUrl } : {}),
        timeout: this.options.timeoutMs,
        maxRetries: this.options.maxRetries ?? 1,
        ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
      });

      const message = await client.messages.create(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: buildMessages(request),
          output_config: {
            format: {
              type: 'json_schema',
              schema: PROPOSAL_JSON_SCHEMA as unknown as Record<string, unknown>,
            },
            ...(supportsEffort(this.model) ? { effort: 'low' as const } : {}),
          },
        },
        { signal: controller.signal }
      );

      if (message.stop_reason === 'refusal') {
        const details = (message as { stop_details?: { category?: string | null } }).stop_details;
        throw new AiProviderError(
          'anthropic',
          'refusal',
          `the model declined this request${details?.category ? ` (${details.category})` : ''}`
        );
      }
      if (message.stop_reason === 'max_tokens') {
        throw new AiProviderError(
          'anthropic',
          'truncated',
          'the model response was cut off before it finished'
        );
      }

      const text = message.content
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map(block => block.text)
        .join('');
      if (!text.trim()) {
        throw new AiProviderError('anthropic', 'malformed', 'the model returned no text content');
      }

      return {
        proposal: parseProposalText(text, 'anthropic'),
        model: message.model ?? this.model,
        latencyMs: Date.now() - started,
        usage: {
          inputTokens: message.usage?.input_tokens,
          outputTokens: message.usage?.output_tokens,
        },
      };
    } catch (error) {
      throw await mapAnthropicError(error, deadlineHit, secrets);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  /**
   * Free-form completion (no structured-output schema): the same deadline, SDK,
   * refusal / truncation handling and error mapping as {@link propose}.
   */
  async complete(request: TextRequest, signal?: AbortSignal): Promise<TextResponse> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const started = Date.now();
    const controller = new AbortController();
    let deadlineHit = false;
    const timer = setTimeout(() => {
      deadlineHit = true;
      controller.abort();
    }, this.options.timeoutMs);
    const onExternalAbort = (): void => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });

    const secrets = [this.options.apiKey];
    try {
      const client = new Anthropic({
        ...(this.options.apiKey ? { apiKey: this.options.apiKey } : {}),
        ...(this.options.baseUrl ? { baseURL: this.options.baseUrl } : {}),
        timeout: this.options.timeoutMs,
        maxRetries: this.options.maxRetries ?? 1,
        ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
      });
      const message = await client.messages.create(
        {
          model: this.model,
          max_tokens: Math.min(request.maxTokens ?? MAX_TEXT_TOKENS, MAX_TEXT_TOKENS),
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
        },
        { signal: controller.signal }
      );

      if (message.stop_reason === 'refusal') {
        throw new AiProviderError('anthropic', 'refusal', 'the model declined this request');
      }
      if (message.stop_reason === 'max_tokens') {
        throw new AiProviderError('anthropic', 'truncated', 'the model response was cut off before it finished');
      }
      const text = message.content
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map(block => block.text)
        .join('');
      if (!text.trim()) {
        throw new AiProviderError('anthropic', 'malformed', 'the model returned no text content');
      }
      return {
        text,
        model: message.model ?? this.model,
        latencyMs: Date.now() - started,
        usage: { inputTokens: message.usage?.input_tokens, outputTokens: message.usage?.output_tokens },
      };
    } catch (error) {
      throw await mapAnthropicError(error, deadlineHit, secrets);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }
}

/** Translate any thrown value into a typed {@link AiProviderError}. */
async function mapAnthropicError(
  error: unknown,
  deadlineHit: boolean,
  secrets: ReadonlyArray<string | undefined>
): Promise<AiProviderError> {
  if (error instanceof AiProviderError) return error;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const text = (e: unknown): string =>
    scrubSecrets(e instanceof Error ? e.message : String(e), secrets).slice(0, 300);

  // Most specific classes first: the timeout/abort errors subclass broader ones.
  if (error instanceof Anthropic.APIConnectionTimeoutError || (error instanceof Anthropic.APIUserAbortError && deadlineHit)) {
    return new AiProviderError('anthropic', 'timeout', 'the request to Anthropic timed out');
  }
  if (error instanceof Anthropic.APIUserAbortError) {
    return new AiProviderError('anthropic', 'network', 'the request was aborted');
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AiProviderError(
      'anthropic',
      'auth',
      `Anthropic rejected the credentials (${(error as { status?: number }).status}); check ANTHROPIC_API_KEY`,
      (error as { status?: number }).status
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiProviderError('anthropic', 'rate-limit', 'Anthropic rate limit reached', 429);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiProviderError('anthropic', 'network', `could not reach Anthropic: ${text(error)}`);
  }
  if (error instanceof Anthropic.APIError) {
    const status = (error as { status?: number }).status;
    return new AiProviderError('anthropic', 'http', `Anthropic returned HTTP ${status ?? '?'}: ${text(error)}`, status);
  }
  if (error instanceof Anthropic.AnthropicError) {
    // e.g. "Could not resolve authentication method" — no credentials at all.
    return new AiProviderError('anthropic', 'config', text(error));
  }
  return new AiProviderError('anthropic', 'network', text(error));
}
