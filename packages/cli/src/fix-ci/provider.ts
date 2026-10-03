// AI provider abstraction for the `fix --ci` fix applier (R-3).
//
// The applier asks a provider for ONE thing: a unified-diff patch plus a short
// explanation, as structured output. Providers are thin transports; prompt
// construction and patch validation live in applier.ts / patch.ts so that a
// provider can never bypass the safety checks.
//
// Provider resolution is explicit: when no provider is configured the fixer is
// unavailable and the command runs in report-only mode (it never claims a fix).

export interface FixProviderRequest {
  /** System prompt: role + hard rules. */
  system: string;
  /** User prompt: failing gates, entries and relevant file contents. */
  prompt: string;
}

export interface FixProviderResponse {
  /** Unified diff (git format). Empty string means "no safe fix". */
  patch: string;
  /** One or two sentences describing the change (or why none was made). */
  explanation: string;
}

export interface FixProvider {
  /** Stable provider id, e.g. `anthropic`. */
  readonly name: string;
  /** Model identifier when applicable. */
  readonly model?: string;
  /** Produce a patch for the request; throw on transport/refusal/format errors. */
  propose(request: FixProviderRequest): Promise<FixProviderResponse>;
}

/** JSON schema for the structured output every provider must return. */
export const PATCH_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    patch: {
      type: 'string',
      description:
        'A unified diff in git format (diff --git a/<path> b/<path>, --- a/<path>, +++ b/<path>, @@ hunks). Empty string when no safe fix exists.',
    },
    explanation: {
      type: 'string',
      description: 'One or two sentences describing the change, or why no patch is proposed.',
    },
  },
  required: ['patch', 'explanation'],
  additionalProperties: false,
} as const;

/** Default model for the Anthropic provider (override with RE_SHELL_FIX_CI_MODEL or --model). */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-5-5';

export interface AnthropicProviderOptions {
  apiKey?: string;
  authToken?: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}

/** Models that accept the server-side `fallbacks: "default"` refusal-fallback parameter. */
function supportsDefaultFallbacks(model: string): boolean {
  return /^claude-(opus-5|sonnet-5-5|fable-5)/.test(model);
}

/**
 * Create the Anthropic-backed provider (official SDK, structured JSON output).
 * The SDK is loaded lazily so the CLI's startup path never pays for it.
 */
export function createAnthropicProvider(options: AnthropicProviderOptions = {}): FixProvider {
  const model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
  return {
    name: 'anthropic',
    model,
    async propose(request: FixProviderRequest): Promise<FixProviderResponse> {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        ...(options.authToken ? { authToken: options.authToken } : {}),
        ...(options.baseURL ? { baseURL: options.baseURL } : {}),
        timeout: options.timeoutMs ?? 300_000,
      });
      let response;
      try {
        // Beta endpoint so the server-side refusal fallback can be requested.
        response = await client.beta.messages.create({
          model,
          max_tokens: options.maxTokens ?? 16000,
          system: request.system,
          messages: [{ role: 'user', content: request.prompt }],
          output_config: {
            effort: 'high',
            format: { type: 'json_schema', schema: PATCH_OUTPUT_SCHEMA as unknown as Record<string, unknown> },
          },
          ...(supportsDefaultFallbacks(model)
            ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
            : {}),
        });
      } catch (err) {
        if (err instanceof Anthropic.APIError) {
          throw new Error(`Anthropic API error${err.status ? ` ${err.status}` : ''}: ${err.message}`);
        }
        throw err;
      }
      if (response.stop_reason === 'refusal') {
        throw new Error('the model declined the request (stop_reason: refusal)');
      }
      if (response.stop_reason === 'max_tokens') {
        throw new Error('the model output was cut off (stop_reason: max_tokens)');
      }
      const text = response.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map(b => b.text)
        .join('');
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('the model did not return valid structured JSON output');
      }
      const obj = parsed as Record<string, unknown>;
      if (!obj || typeof obj.patch !== 'string' || typeof obj.explanation !== 'string') {
        throw new Error('the model output did not match the {patch, explanation} schema');
      }
      return { patch: obj.patch, explanation: obj.explanation };
    },
  };
}

export interface ResolveProviderOptions {
  env?: NodeJS.ProcessEnv;
  /** Model override (e.g. `--model`). */
  model?: string;
}

/**
 * Resolve the provider from the environment. Returns null when none is
 * configured; the caller must then run report-only and say so.
 *
 * Supported: Anthropic via `ANTHROPIC_API_KEY` (or `ANTHROPIC_AUTH_TOKEN`);
 * `ANTHROPIC_BASE_URL` and `RE_SHELL_FIX_CI_MODEL` are honoured.
 */
export function resolveProvider(options: ResolveProviderOptions = {}): FixProvider | null {
  const env = options.env ?? process.env;
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const authToken = env.ANTHROPIC_AUTH_TOKEN?.trim();
  if (!apiKey && !authToken) return null;
  return createAnthropicProvider({
    ...(apiKey ? { apiKey } : {}),
    ...(!apiKey && authToken ? { authToken } : {}),
    ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
    model: options.model || env.RE_SHELL_FIX_CI_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
  });
}
