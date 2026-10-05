import { describe, expect, it } from 'vitest';
import { AnthropicProvider, OpenAiCompatibleProvider, OfflineProvider, createProvider } from '../../../src/ai/providers';
import { AiProviderError } from '../../../src/ai/types';
import { emptyWorkspaceContext } from '../../../src/ai/workspace-context';
import { anthropicError, anthropicMessage, chatCompletion, fakeFetch, fixtureCatalog, jsonResponse } from './helpers';

/**
 * `AiProvider.complete` is the free-form text path used by `re-shell ui generate`.
 * Like the structured `propose` path it runs the REAL Anthropic SDK / OpenAI-compatible client
 * code against an injected `fetch`.
 */

const REQUEST = { system: 'You write components.', prompt: 'a status badge', maxTokens: 4000 };

function anthropic(fetchImpl: typeof fetch): AnthropicProvider {
  return new AnthropicProvider({ model: 'claude-opus-5-5', apiKey: 'sk-ant-unit-test-key-000000', timeoutMs: 2000, maxRetries: 0, fetch: fetchImpl });
}

function local(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({ baseUrl: 'http://localhost:11434/v1', model: 'llama3.1:8b', timeoutMs: 2000, fetch: fetchImpl, ...extra });
}

async function failure(p: Promise<unknown>): Promise<AiProviderError> {
  try {
    await p;
  } catch (error) {
    expect(error).toBeInstanceOf(AiProviderError);
    return error as AiProviderError;
  }
  throw new Error('expected the provider to fail');
}

describe('AnthropicProvider.complete', () => {
  it('sends the system and user prompt (no structured-output schema) and returns the text', async () => {
    const { fetch, calls } = fakeFetch(() => anthropicMessage('```tsx component\nexport const A = 1;\n```'));
    const result = await anthropic(fetch).complete!(REQUEST);
    expect(result.text).toContain('export const A');
    expect(result.model).toBe('claude-opus-5-5');
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 22 });

    expect(calls).toHaveLength(1);
    const body = calls[0].body as Record<string, unknown>;
    expect(body.system).toBe('You write components.');
    expect(body.messages).toEqual([{ role: 'user', content: 'a status badge' }]);
    expect(body.max_tokens).toBe(4000);
    expect(body.output_config).toBeUndefined();
  });

  it('clamps max_tokens to the provider ceiling', async () => {
    const { fetch, calls } = fakeFetch(() => anthropicMessage('ok'));
    await anthropic(fetch).complete!({ ...REQUEST, maxTokens: 999_999 });
    expect((calls[0].body as { max_tokens: number }).max_tokens).toBe(8192);
  });

  it('maps refusals, truncation, empty replies and HTTP errors to typed provider errors', async () => {
    expect((await failure(anthropic(fakeFetch(() => anthropicMessage('x', { stop_reason: 'refusal' })).fetch).complete!(REQUEST))).kind).toBe('refusal');
    expect((await failure(anthropic(fakeFetch(() => anthropicMessage('x', { stop_reason: 'max_tokens' })).fetch).complete!(REQUEST))).kind).toBe('truncated');
    expect((await failure(anthropic(fakeFetch(() => anthropicMessage('  ')).fetch).complete!(REQUEST))).kind).toBe('malformed');
    const auth = await failure(anthropic(fakeFetch(() => anthropicError(401, 'authentication_error', 'bad key')).fetch).complete!(REQUEST));
    expect(auth.kind).toBe('auth');
    expect(auth.message).not.toContain('sk-ant-unit-test-key');
  });
});

describe('OpenAiCompatibleProvider.complete', () => {
  it('posts a plain chat completion (no response_format) and returns the text', async () => {
    const { fetch, calls } = fakeFetch(() => chatCompletion('hello component'));
    const result = await local(fetch).complete!(REQUEST);
    expect(result.text).toBe('hello component');
    expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 9 });

    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions');
    const body = calls[0].body as Record<string, unknown>;
    expect(body.messages).toEqual([
      { role: 'system', content: 'You write components.' },
      { role: 'user', content: 'a status badge' },
    ]);
    expect(body.response_format).toBeUndefined();
  });

  it('discovers the model from /models when none is configured', async () => {
    const { fetch, calls } = fakeFetch((call) =>
      call.url.endsWith('/models') ? jsonResponse(200, { data: [{ id: 'qwen2.5-coder' }] }) : chatCompletion('ok')
    );
    const provider = local(fetch, { model: undefined });
    await provider.complete!(REQUEST);
    expect((calls[1].body as { model: string }).model).toBe('qwen2.5-coder');
  });

  it('refuses to send an API key over plain http to a remote host', async () => {
    const { fetch, calls } = fakeFetch(() => chatCompletion('x'));
    const error = await failure(local(fetch, { baseUrl: 'http://models.example.com/v1', apiKey: 'sk-secret' }).complete!(REQUEST));
    expect(error.kind).toBe('config');
    expect(calls).toHaveLength(0);
  });

  it('maps rate limits, auth failures and refusals', async () => {
    expect((await failure(local(fakeFetch(() => jsonResponse(429, {})).fetch).complete!(REQUEST))).kind).toBe('rate-limit');
    expect((await failure(local(fakeFetch(() => jsonResponse(401, {})).fetch).complete!(REQUEST))).kind).toBe('auth');
    expect((await failure(local(fakeFetch(() => chatCompletion('', { finish_reason: 'length' })).fetch).complete!(REQUEST))).kind).toBe('truncated');
    expect((await failure(local(fakeFetch(() => chatCompletion(null, { message: { refusal: 'no' } })).fetch).complete!(REQUEST))).kind).toBe('refusal');
  });
});

describe('createProvider / OfflineProvider', () => {
  it('network providers implement complete; the offline provider has no model to ask', () => {
    expect(typeof createProvider({ provider: 'anthropic', apiKey: 'k', timeoutMs: 1000 }).complete).toBe('function');
    expect(typeof createProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:1/v1', timeoutMs: 1000 }).complete).toBe('function');
    expect(new OfflineProvider(fixtureCatalog(), emptyWorkspaceContext('/tmp')).complete).toBeUndefined();
  });
});
