import { describe, expect, it } from 'vitest';
import {
  AnthropicProvider,
  OpenAiCompatibleProvider,
  OfflineProvider,
  createProvider,
  extractJsonObject,
  isLocalOrPrivateHost,
  normalizeBaseUrl,
  parseRawProposal,
  supportsEffort,
} from '../../../src/ai/providers';
import { AiProviderError, type ProviderRequest } from '../../../src/ai/types';
import { emptyWorkspaceContext } from '../../../src/ai/workspace-context';
import {
  anthropicError,
  anthropicMessage,
  chatCompletion,
  fakeFetch,
  fixtureCatalog,
  hangingFetch,
  jsonResponse,
  proposalJson,
} from './helpers';

/**
 * Provider tests run the REAL Anthropic SDK / real OpenAI-compatible client
 * code against an injected `fetch`, so request shaping, error mapping and
 * output parsing are all exercised without any network access.
 */

const REQUEST: ProviderRequest = {
  prompt: 'build the api',
  catalog: [
    {
      path: 'run',
      description: 'Run a task',
      args: [{ name: 'task', required: true }],
      flags: [{ name: '--filter', takesValue: true }],
      destructive: false,
    },
  ],
  groups: ['run', 'workspace'],
  workspaceContext: 'workspace "acme" (1 node)\n- @acme/api [package] path=packages/api',
  history: [],
};

const GOOD = proposalJson({
  argv: ['run', 'build', '--filter', '@acme/api'],
  confidence: 0.93,
  rationale: 'build one package',
});

function anthropic(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}): AnthropicProvider {
  return new AnthropicProvider({
    model: 'claude-opus-5-5',
    apiKey: 'sk-ant-unit-test-key-000000',
    timeoutMs: 2000,
    maxRetries: 0,
    fetch: fetchImpl,
    ...extra,
  });
}

function local(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}): OpenAiCompatibleProvider {
  return new OpenAiCompatibleProvider({
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.1:8b',
    timeoutMs: 2000,
    fetch: fetchImpl,
    ...extra,
  });
}

async function failure(p: Promise<unknown>): Promise<AiProviderError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AiProviderError);
    return e as AiProviderError;
  }
  throw new Error('expected the provider to fail');
}

describe('parsing model output', () => {
  it('extracts JSON from fences, think blocks and surrounding prose', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJsonObject('<think>hmm {not json}</think>\n{"a":2}')).toEqual({ a: 2 });
    expect(extractJsonObject('Sure! Here you go: {"a":{"b":"}"}} thanks')).toEqual({ a: { b: '}' } });
  });

  it('rejects text with no JSON object', () => {
    expect(() => extractJsonObject('no json here')).toThrow(SyntaxError);
    expect(() => extractJsonObject('{"a":')).toThrow(SyntaxError);
  });

  it('checks proposal shape and clamps confidence', () => {
    const p = parseRawProposal(
      { outcome: 'command', argv: ['run', 'build'], confidence: 7, alternatives: [{ argv: ['x'], confidence: -1 }] },
      'anthropic'
    );
    expect(p.confidence).toBe(1);
    expect(p.alternatives[0].confidence).toBe(0);
    expect(p.rationale).toBe('');
  });

  it.each([
    [null],
    [[]],
    [{ outcome: 'explode', argv: [] }],
    [{ outcome: 'command', argv: [] }],
    [{ outcome: 'command', argv: ['run', 3] }],
    [{ outcome: 'clarify', argv: [], alternatives: 'no' }],
  ])('rejects malformed proposal %#', value => {
    expect(() => parseRawProposal(value, 'anthropic')).toThrow(AiProviderError);
  });
});

describe('AnthropicProvider', () => {
  it('sends a well-formed Messages API request and parses the structured output', async () => {
    const { fetch, calls } = fakeFetch(() => anthropicMessage(JSON.stringify(GOOD)));
    const res = await anthropic(fetch).propose(REQUEST);

    expect(res.proposal.argv).toEqual(['run', 'build', '--filter', '@acme/api']);
    expect(res.proposal.confidence).toBeCloseTo(0.93);
    expect(res.model).toBe('claude-opus-5-5');
    expect(res.usage).toEqual({ inputTokens: 11, outputTokens: 22 });

    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call.method).toBe('POST');
    expect(call.url).toMatch(/\/v1\/messages$/);
    expect(call.headers['x-api-key']).toBe('sk-ant-unit-test-key-000000');
    expect(call.headers['anthropic-version']).toBeTruthy();
    expect(call.body.model).toBe('claude-opus-5-5');
    // Structured output, not forced tool use; no sampling params the new models reject.
    expect(call.body.output_config.format.type).toBe('json_schema');
    expect(call.body.output_config.format.schema.required).toContain('outcome');
    expect(call.body.output_config.effort).toBe('low');
    expect(call.body.tool_choice).toBeUndefined();
    expect(call.body.temperature).toBeUndefined();
    expect(call.body.thinking).toBeUndefined();
    expect(call.body.max_tokens).toBeGreaterThanOrEqual(1024);
    expect(call.body.system).toContain('re-shell');
    const last = call.body.messages[call.body.messages.length - 1];
    expect(last.role).toBe('user');
    expect(last.content).toContain('build the api');
    expect(last.content).toContain('@acme/api');
    expect(last.content).toContain('COMMAND CATALOG');
  });

  it('omits effort for models that do not support it', async () => {
    const { fetch, calls } = fakeFetch(() => anthropicMessage(JSON.stringify(GOOD)));
    await anthropic(fetch, { model: 'claude-haiku-4-5' }).propose(REQUEST);
    expect(calls[0].body.output_config.effort).toBeUndefined();
    expect(supportsEffort('claude-opus-5-5')).toBe(true);
    expect(supportsEffort('claude-sonnet-5-5')).toBe(true);
    expect(supportsEffort('claude-haiku-4-5')).toBe(false);
  });

  it('carries multi-turn history as alternating messages', async () => {
    const { fetch, calls } = fakeFetch(() => anthropicMessage(JSON.stringify(GOOD)));
    await anthropic(fetch).propose({
      ...REQUEST,
      history: [{ prompt: 'build payments', answer: '{"outcome":"clarify"}' }],
      pendingQuestion: 'Which payments node?',
    });
    const msgs = calls[0].body.messages;
    expect(msgs.map((m: any) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(msgs[2].content).toContain('Which payments node?');
  });

  it('treats a malformed (non-JSON) response as a malformed error', async () => {
    const { fetch } = fakeFetch(() => anthropicMessage('I think you want to build the api.'));
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.kind).toBe('malformed');
  });

  it('treats a wrong-shaped JSON response as a malformed error', async () => {
    const { fetch } = fakeFetch(() => anthropicMessage(JSON.stringify({ outcome: 'command', argv: [] })));
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.kind).toBe('malformed');
  });

  it('treats an empty content array as malformed', async () => {
    const { fetch } = fakeFetch(() => anthropicMessage('', { content: [] }));
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.kind).toBe('malformed');
  });

  it('surfaces a model refusal', async () => {
    const { fetch } = fakeFetch(() =>
      anthropicMessage('', {
        content: [],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: null },
      })
    );
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.kind).toBe('refusal');
    expect(err.message).toContain('cyber');
  });

  it('surfaces truncation (max_tokens)', async () => {
    const { fetch } = fakeFetch(() => anthropicMessage('{"outcome":', { stop_reason: 'max_tokens' }));
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.kind).toBe('truncated');
  });

  it.each([
    [400, 'invalid_request_error', 'http'],
    [404, 'not_found_error', 'http'],
    [401, 'authentication_error', 'auth'],
    [403, 'permission_error', 'auth'],
    [429, 'rate_limit_error', 'rate-limit'],
    [500, 'api_error', 'http'],
    [529, 'overloaded_error', 'http'],
  ])('maps HTTP %i to error kind %s -> %s', async (status, type, kind) => {
    const { fetch } = fakeFetch(() => anthropicError(status as number, type as string, 'boom'));
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.kind).toBe(kind);
    expect(err.status ?? status).toBe(status);
  });

  it('never leaks the API key into an error message', async () => {
    const { fetch } = fakeFetch(() =>
      anthropicError(400, 'invalid_request_error', 'bad key sk-ant-unit-test-key-000000 in request')
    );
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.message).not.toContain('sk-ant-unit-test-key-000000');
  });

  it('times out when the transport hangs', async () => {
    const { fetch } = hangingFetch();
    const started = Date.now();
    const err = await failure(anthropic(fetch, { timeoutMs: 60 }).propose(REQUEST));
    expect(err.kind).toBe('timeout');
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('maps a transport failure to a network error', async () => {
    const { fetch } = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    const err = await failure(anthropic(fetch).propose(REQUEST));
    expect(err.kind).toBe('network');
  });

  it('honours an external abort signal', async () => {
    const { fetch } = hangingFetch();
    const controller = new AbortController();
    const p = anthropic(fetch, { timeoutMs: 5000 }).propose(REQUEST, controller.signal);
    setTimeout(() => controller.abort(), 20);
    const err = await failure(p);
    expect(['network', 'timeout']).toContain(err.kind);
  });
});

describe('OpenAiCompatibleProvider', () => {
  it('posts a chat-completions request and parses the proposal', async () => {
    const { fetch, calls } = fakeFetch(() => chatCompletion(JSON.stringify(GOOD)));
    const res = await local(fetch).propose(REQUEST);

    expect(res.proposal.argv).toEqual(['run', 'build', '--filter', '@acme/api']);
    expect(res.usage).toEqual({ inputTokens: 7, outputTokens: 9 });
    const call = calls[0];
    expect(call.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(call.method).toBe('POST');
    expect(call.headers.authorization).toBeUndefined();
    expect(call.body.model).toBe('llama3.1:8b');
    expect(call.body.temperature).toBe(0);
    expect(call.body.messages[0].role).toBe('system');
    expect(call.body.response_format.type).toBe('json_schema');
  });

  it('sends the bearer token only when a key is configured', async () => {
    const { fetch, calls } = fakeFetch(() => chatCompletion(JSON.stringify(GOOD)));
    await local(fetch, { apiKey: 'local-secret-key' }).propose(REQUEST);
    expect(calls[0].headers.authorization).toBe('Bearer local-secret-key');
  });

  it('recovers JSON wrapped in fences / think blocks', async () => {
    const wrapped = '<think>let me see</think>\n```json\n' + JSON.stringify(GOOD) + '\n```';
    const { fetch } = fakeFetch(() => chatCompletion(wrapped));
    const res = await local(fetch).propose(REQUEST);
    expect(res.proposal.outcome).toBe('command');
  });

  it('steps down the response_format ladder when the server rejects it', async () => {
    const seen: unknown[] = [];
    const { fetch } = fakeFetch(call => {
      seen.push(call.body.response_format);
      if (call.body.response_format?.type === 'json_schema') {
        return jsonResponse(400, { error: { message: 'response_format json_schema not supported' } });
      }
      if (call.body.response_format?.type === 'json_object') {
        return jsonResponse(422, { error: 'unprocessable' });
      }
      return chatCompletion(JSON.stringify(GOOD));
    });
    const res = await local(fetch).propose(REQUEST);
    expect(res.proposal.outcome).toBe('command');
    expect(seen).toHaveLength(3);
    expect((seen[0] as any).type).toBe('json_schema');
    expect((seen[1] as any).type).toBe('json_object');
    expect(seen[2]).toBeUndefined();
  });

  it('gives up after the whole ladder is rejected', async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse(400, { error: { message: 'nope' } }));
    const err = await failure(local(fetch).propose(REQUEST));
    expect(err.kind).toBe('http');
    expect(err.status).toBe(400);
    expect(calls).toHaveLength(3);
  });

  it('discovers the model from GET /models when none is configured', async () => {
    const { fetch, calls } = fakeFetch(call =>
      call.url.endsWith('/models')
        ? jsonResponse(200, { data: [{ id: 'qwen2.5-coder' }, { id: 'other' }] })
        : chatCompletion(JSON.stringify(GOOD))
    );
    const provider = local(fetch, { model: undefined });
    await provider.propose(REQUEST);
    expect(calls[0].url).toMatch(/\/models$/);
    expect(calls[1].body.model).toBe('qwen2.5-coder');
    expect(provider.model).toBe('qwen2.5-coder');
  });

  it('fails with a config error when no model can be found', async () => {
    const { fetch } = fakeFetch(() => jsonResponse(200, { data: [] }));
    const err = await failure(local(fetch, { model: undefined }).propose(REQUEST));
    expect(err.kind).toBe('config');
    expect(err.message).toContain('RE_SHELL_AI_MODEL');
  });

  it('treats non-JSON content as malformed', async () => {
    const { fetch } = fakeFetch(() => chatCompletion('You should build it.'));
    expect((await failure(local(fetch).propose(REQUEST))).kind).toBe('malformed');
  });

  it('treats a non-JSON HTTP body as malformed', async () => {
    const { fetch } = fakeFetch(() => new Response('<html>oops</html>', { status: 200 }));
    expect((await failure(local(fetch).propose(REQUEST))).kind).toBe('malformed');
  });

  it('treats a missing choices array as malformed', async () => {
    const { fetch } = fakeFetch(() => jsonResponse(200, { choices: [] }));
    expect((await failure(local(fetch).propose(REQUEST))).kind).toBe('malformed');
  });

  it('surfaces a refusal field', async () => {
    const { fetch } = fakeFetch(() =>
      chatCompletion(null, { message: { refusal: "I can't help with that." } })
    );
    expect((await failure(local(fetch).propose(REQUEST))).kind).toBe('refusal');
  });

  it('surfaces truncation and content filtering', async () => {
    const trunc = fakeFetch(() => chatCompletion('{"outcome":', { finish_reason: 'length' }));
    expect((await failure(local(trunc.fetch).propose(REQUEST))).kind).toBe('truncated');
    const filt = fakeFetch(() => chatCompletion('', { finish_reason: 'content_filter' }));
    expect((await failure(local(filt.fetch).propose(REQUEST))).kind).toBe('refusal');
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate-limit'],
    [500, 'http'],
    [503, 'http'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    const { fetch } = fakeFetch(() => jsonResponse(status as number, { error: 'x' }));
    const err = await failure(local(fetch).propose(REQUEST));
    expect(err.kind).toBe(kind);
  });

  it('times out when the server hangs', async () => {
    const { fetch } = hangingFetch();
    const err = await failure(local(fetch, { timeoutMs: 50 }).propose(REQUEST));
    expect(err.kind).toBe('timeout');
  });

  it('maps a refused connection to a network error', async () => {
    const { fetch } = fakeFetch(() => {
      const e: any = new TypeError('fetch failed');
      e.cause = { code: 'ECONNREFUSED' };
      throw e;
    });
    const err = await failure(local(fetch).propose(REQUEST));
    expect(err.kind).toBe('network');
    expect(err.message).toContain('ECONNREFUSED');
  });

  it('refuses to send an API key over plain http to a remote host', async () => {
    const { fetch, calls } = fakeFetch(() => chatCompletion(JSON.stringify(GOOD)));
    const err = await failure(
      local(fetch, { baseUrl: 'http://models.example.com/v1', apiKey: 'remote-secret-key' }).propose(REQUEST)
    );
    expect(err.kind).toBe('config');
    expect(calls).toHaveLength(0);
  });

  it('allows a key to a loopback or private host', async () => {
    const { fetch } = fakeFetch(() => chatCompletion(JSON.stringify(GOOD)));
    await local(fetch, { baseUrl: 'http://192.168.1.20:8080', apiKey: 'lan-secret-key' }).propose(REQUEST);
    expect(isLocalOrPrivateHost('127.0.0.1')).toBe(true);
    expect(isLocalOrPrivateHost('10.1.2.3')).toBe(true);
    expect(isLocalOrPrivateHost('172.20.0.1')).toBe(true);
    expect(isLocalOrPrivateHost('172.40.0.1')).toBe(false);
    expect(isLocalOrPrivateHost('example.com')).toBe(false);
  });

  it('scrubs the key from error output', async () => {
    const { fetch } = fakeFetch(() => jsonResponse(500, { error: 'upstream saw local-secret-key' }));
    const err = await failure(local(fetch, { apiKey: 'local-secret-key' }).propose(REQUEST));
    expect(err.message).not.toContain('local-secret-key');
  });
});

describe('normalizeBaseUrl', () => {
  it.each([
    ['http://localhost:11434', 'http://localhost:11434/v1'],
    ['http://localhost:11434/', 'http://localhost:11434/v1'],
    ['http://localhost:1234/v1', 'http://localhost:1234/v1'],
    ['http://localhost:1234/v1/', 'http://localhost:1234/v1'],
    ['http://localhost:8080/v1/chat/completions', 'http://localhost:8080/v1'],
    ['https://gw.example.com/api/v1', 'https://gw.example.com/api/v1'],
    ['http://user:pass@localhost:8080', 'http://localhost:8080/v1'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected);
  });

  it('rejects non-http URLs', () => {
    expect(() => normalizeBaseUrl('ftp://x')).toThrow(AiProviderError);
    expect(() => normalizeBaseUrl('not a url')).toThrow(AiProviderError);
  });
});

describe('createProvider', () => {
  it('builds the right provider for each configuration', () => {
    expect(createProvider({ provider: 'anthropic', timeoutMs: 1000, apiKey: 'k'.repeat(10) }).name).toBe('anthropic');
    expect(createProvider({ provider: 'anthropic', timeoutMs: 1000 }).model).toBe('claude-opus-5-5');
    expect(
      createProvider({ provider: 'openai-compatible', baseUrl: 'http://localhost:11434', timeoutMs: 1000 }).name
    ).toBe('openai-compatible');
    expect(createProvider({ provider: 'offline', timeoutMs: 1000 }, { catalog: fixtureCatalog() }).name).toBe(
      'offline'
    );
  });

  it('fails explicitly when configuration is incomplete', () => {
    expect(() => createProvider({ provider: 'openai-compatible', timeoutMs: 1000 })).toThrow(/base URL/);
    expect(() => createProvider({ provider: 'offline', timeoutMs: 1000 })).toThrow(/catalogue/);
  });

  it('the offline provider adapts the deterministic parser to the provider interface', async () => {
    const provider = new OfflineProvider(fixtureCatalog(), emptyWorkspaceContext('/tmp'));
    const res = await provider.propose({ ...REQUEST, prompt: 'check workspace health as json' });
    expect(res.proposal.outcome).toBe('command');
    expect(res.proposal.argv).toEqual(['workspace', 'health', '--json']);
    const none = await provider.propose({ ...REQUEST, prompt: 'xyzzy frobnicate the quux' });
    expect(none.proposal.outcome).toBe('unsupported');
  });
});
