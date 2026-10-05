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
 * OpenAI-compatible `/v1/chat/completions` provider.
 *
 * This is the LOCAL / self-hosted LLM path: Ollama (`http://localhost:11434`),
 * the llama.cpp server (`http://localhost:8080`), LM Studio
 * (`http://localhost:1234`), vLLM, or any hosted gateway that implements the
 * chat-completions protocol. It uses plain `fetch` on purpose: there is no
 * "official SDK" for a de-facto protocol many servers implement with their own
 * quirks, and a hand-rolled client lets us handle those quirks:
 *
 *  - `response_format` support varies, so the request walks a ladder
 *    (`json_schema` -> `json_object` -> none), stepping down only when the
 *    server answers 400/422. The prompt itself always describes the JSON shape,
 *    so the lowest rung still works with a capable model.
 *  - small models wrap JSON in code fences or `<think>` blocks — the shared
 *    parser strips those.
 *  - when no model id is configured, the first model from `GET /models` is used
 *    (LM Studio and llama.cpp serve whatever is loaded).
 *
 * The API key (if any) is sent only over https or to a loopback/private host,
 * and is scrubbed from every error message.
 */

const MAX_OUTPUT_TOKENS = 2048;
/** Ceiling for free-form completions (generated source files are longer than a command proposal). */
const MAX_TEXT_TOKENS = 8192;

type FormatMode = 'json_schema' | 'json_object' | 'none';
const FORMAT_LADDER: readonly FormatMode[] = ['json_schema', 'json_object', 'none'];

/** Options for {@link OpenAiCompatibleProvider}. */
export interface OpenAiCompatibleOptions {
  baseUrl: string;
  apiKey?: string;
  /** When omitted the first model reported by `GET /models` is used. */
  model?: string;
  /** Overall deadline for the call (all ladder attempts included). */
  timeoutMs: number;
  /** Injected transport (tests). */
  fetch?: typeof fetch;
}

/**
 * Normalise a user-supplied base URL to `<origin>/<prefix>/v1`.
 *
 * Accepts `http://localhost:11434`, `http://localhost:11434/v1`,
 * `.../v1/` and a full `.../v1/chat/completions` URL.
 *
 * @param baseUrl - The configured base URL.
 * @returns The URL that `/chat/completions` and `/models` hang off.
 * @throws {AiProviderError} `config` when the URL is invalid or not http(s).
 */
export function normalizeBaseUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new AiProviderError('openai-compatible', 'config', 'RE_SHELL_AI_BASE_URL is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AiProviderError('openai-compatible', 'config', 'the base URL must be http or https');
  }
  let p = url.pathname.replace(/\/+$/, '');
  if (p.endsWith('/chat/completions')) p = p.slice(0, -'/chat/completions'.length);
  if (!/\/v\d+$/.test(p)) p += '/v1';
  url.pathname = p;
  url.search = '';
  url.hash = '';
  url.username = '';
  url.password = '';
  return url.toString().replace(/\/$/, '');
}

/** Loopback, RFC1918 and `.local` hosts: places a key may travel over plain http. */
export function isLocalOrPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** The OpenAI-compatible provider. */
export class OpenAiCompatibleProvider implements AiProvider {
  public readonly name = 'openai-compatible' as const;
  public model?: string;
  private readonly options: OpenAiCompatibleOptions;

  constructor(options: OpenAiCompatibleOptions) {
    this.options = options;
    this.model = options.model;
  }

  async propose(request: ProviderRequest, signal?: AbortSignal): Promise<ProviderResponse> {
    const started = Date.now();
    const base = normalizeBaseUrl(this.options.baseUrl);
    const baseUrl = new URL(base);
    if (
      this.options.apiKey &&
      baseUrl.protocol === 'http:' &&
      !isLocalOrPrivateHost(baseUrl.hostname)
    ) {
      throw new AiProviderError(
        'openai-compatible',
        'config',
        'refusing to send an API key over plain http to a remote host; use https'
      );
    }

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
      const model = this.model ?? (await this.discoverModel(base, controller.signal));
      this.model = model;

      let lastError: AiProviderError | undefined;
      for (const mode of FORMAT_LADDER) {
        try {
          return await this.attempt(base, model, mode, request, controller.signal, started);
        } catch (error) {
          if (
            error instanceof AiProviderError &&
            error.kind === 'http' &&
            (error.status === 400 || error.status === 422)
          ) {
            lastError = error; // server dislikes this response_format: try the next rung
            continue;
          }
          throw error;
        }
      }
      throw lastError ?? new AiProviderError('openai-compatible', 'http', 'the server rejected every request format');
    } catch (error) {
      throw mapFetchError(error, deadlineHit, secrets);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  /**
   * Free-form completion: a plain chat-completions call without a
   * `response_format` (the caller parses the text). Same host / key / deadline /
   * error rules as {@link propose}.
   */
  async complete(request: TextRequest, signal?: AbortSignal): Promise<TextResponse> {
    const started = Date.now();
    const base = normalizeBaseUrl(this.options.baseUrl);
    const baseUrl = new URL(base);
    if (this.options.apiKey && baseUrl.protocol === 'http:' && !isLocalOrPrivateHost(baseUrl.hostname)) {
      throw new AiProviderError(
        'openai-compatible',
        'config',
        'refusing to send an API key over plain http to a remote host; use https'
      );
    }

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
      const model = this.model ?? (await this.discoverModel(base, controller.signal));
      this.model = model;
      const res = await this.doFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ],
          temperature: 0,
          max_tokens: Math.min(request.maxTokens ?? MAX_TEXT_TOKENS, MAX_TEXT_TOKENS),
          stream: false,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = scrubSecrets((await safeText(res)).slice(0, 300), secrets);
        if (res.status === 401 || res.status === 403) {
          throw new AiProviderError('openai-compatible', 'auth', `the server rejected the credentials (HTTP ${res.status})`, res.status);
        }
        if (res.status === 429) {
          throw new AiProviderError('openai-compatible', 'rate-limit', 'the server rate-limited the request', 429);
        }
        throw new AiProviderError(
          'openai-compatible',
          'http',
          `the server returned HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
          res.status
        );
      }
      let data: unknown;
      try {
        data = await res.json();
      } catch {
        throw new AiProviderError('openai-compatible', 'malformed', 'the server did not return JSON');
      }
      const choice = (data as { choices?: Array<Record<string, unknown>> })?.choices?.[0];
      if (!choice) throw new AiProviderError('openai-compatible', 'malformed', 'the response had no choices');
      const message = (choice.message ?? {}) as Record<string, unknown>;
      if (typeof message.refusal === 'string' && message.refusal.trim()) {
        throw new AiProviderError('openai-compatible', 'refusal', 'the model declined this request');
      }
      if (choice.finish_reason === 'length') {
        throw new AiProviderError('openai-compatible', 'truncated', 'the model response was cut off before it finished');
      }
      if (choice.finish_reason === 'content_filter') {
        throw new AiProviderError('openai-compatible', 'refusal', 'the response was blocked by a content filter');
      }
      const text = contentToText(message.content);
      if (!text.trim()) throw new AiProviderError('openai-compatible', 'malformed', 'the model returned no content');
      const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
      return {
        text,
        model: typeof (data as { model?: unknown }).model === 'string' ? (data as { model: string }).model : model,
        latencyMs: Date.now() - started,
        usage: { inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens },
      };
    } catch (error) {
      throw mapFetchError(error, deadlineHit, secrets);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  private headers(): Record<string, string> {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(this.options.apiKey ? { authorization: `Bearer ${this.options.apiKey}` } : {}),
    };
  }

  private get doFetch(): typeof fetch {
    return this.options.fetch ?? fetch;
  }

  private async discoverModel(base: string, signal: AbortSignal): Promise<string> {
    const res = await this.doFetch(`${base}/models`, { method: 'GET', headers: this.headers(), signal });
    if (!res.ok) {
      throw new AiProviderError(
        'openai-compatible',
        'config',
        `no model configured and ${base}/models returned HTTP ${res.status}; set RE_SHELL_AI_MODEL`
      );
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    const data = (body as { data?: Array<{ id?: unknown }> } | undefined)?.data;
    const id = Array.isArray(data) ? data.find(m => typeof m?.id === 'string')?.id : undefined;
    if (typeof id !== 'string') {
      throw new AiProviderError(
        'openai-compatible',
        'config',
        `no model configured and ${base}/models listed none; set RE_SHELL_AI_MODEL`
      );
    }
    return id;
  }

  private async attempt(
    base: string,
    model: string,
    mode: FormatMode,
    request: ProviderRequest,
    signal: AbortSignal,
    started: number
  ): Promise<ProviderResponse> {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...buildMessages(request)],
      temperature: 0,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: false,
    };
    if (mode === 'json_schema') {
      body.response_format = {
        type: 'json_schema',
        json_schema: { name: 're_shell_command_proposal', strict: true, schema: PROPOSAL_JSON_SCHEMA },
      };
    } else if (mode === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const res = await this.doFetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const detail = scrubSecrets((await safeText(res)).slice(0, 300), [this.options.apiKey]);
      if (res.status === 401 || res.status === 403) {
        throw new AiProviderError(
          'openai-compatible',
          'auth',
          `the server rejected the credentials (HTTP ${res.status})`,
          res.status
        );
      }
      if (res.status === 429) {
        throw new AiProviderError('openai-compatible', 'rate-limit', 'the server rate-limited the request', 429);
      }
      throw new AiProviderError(
        'openai-compatible',
        'http',
        `the server returned HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
        res.status
      );
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      throw new AiProviderError('openai-compatible', 'malformed', 'the server did not return JSON');
    }

    const choice = (data as { choices?: Array<Record<string, unknown>> })?.choices?.[0];
    if (!choice) {
      throw new AiProviderError('openai-compatible', 'malformed', 'the response had no choices');
    }
    const message = (choice.message ?? {}) as Record<string, unknown>;
    if (typeof message.refusal === 'string' && message.refusal.trim()) {
      throw new AiProviderError('openai-compatible', 'refusal', 'the model declined this request');
    }
    if (choice.finish_reason === 'length') {
      throw new AiProviderError('openai-compatible', 'truncated', 'the model response was cut off before it finished');
    }
    if (choice.finish_reason === 'content_filter') {
      throw new AiProviderError('openai-compatible', 'refusal', 'the response was blocked by a content filter');
    }

    const text = contentToText(message.content);
    if (!text.trim()) {
      throw new AiProviderError('openai-compatible', 'malformed', 'the model returned no content');
    }

    const usage = (data as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
    return {
      proposal: parseProposalText(text, 'openai-compatible'),
      model: typeof (data as { model?: unknown }).model === 'string' ? ((data as { model: string }).model) : model,
      latencyMs: Date.now() - started,
      usage: { inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens },
    };
  }
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : ''))
      .join('');
  }
  return '';
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function mapFetchError(
  error: unknown,
  deadlineHit: boolean,
  secrets: ReadonlyArray<string | undefined>
): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const name = (error as { name?: string })?.name;
  if (deadlineHit || name === 'TimeoutError') {
    return new AiProviderError('openai-compatible', 'timeout', 'the request to the model server timed out');
  }
  if (name === 'AbortError') {
    return new AiProviderError('openai-compatible', 'network', 'the request was aborted');
  }
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;
  const detail = cause?.code ?? cause?.message ?? (error instanceof Error ? error.message : String(error));
  return new AiProviderError(
    'openai-compatible',
    'network',
    `could not reach the model server: ${scrubSecrets(String(detail), secrets).slice(0, 200)}`
  );
}
