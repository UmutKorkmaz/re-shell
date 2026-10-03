import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'http';
import {
  DEFAULT_ANTHROPIC_MODEL,
  PATCH_OUTPUT_SCHEMA,
  createAnthropicProvider,
  resolveProvider,
} from '../../src/fix-ci/provider';

/** The REAL @anthropic-ai/sdk talking to a local HTTP stub of the Messages API. */

interface Captured {
  headers: http.IncomingHttpHeaders;
  url: string;
  body: Record<string, any>;
}

let server: http.Server | undefined;
afterEach(async () => {
  await new Promise<void>(r => (server ? server.close(() => r()) : r()));
  server = undefined;
});

async function stub(
  respond: () => { status?: number; body: unknown }
): Promise<{ baseURL: string; captured: Captured[] }> {
  const captured: Captured[] = [];
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      captured.push({ headers: req.headers, url: req.url ?? '', body: raw ? JSON.parse(raw) : {} });
      const { status = 200, body } = respond();
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    });
  });
  await new Promise<void>(r => server!.listen(0, '127.0.0.1', () => r()));
  return { baseURL: `http://127.0.0.1:${(server!.address() as { port: number }).port}`, captured };
}

const message = (over: Record<string, unknown>) => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: 'claude-opus-5-5',
  content: [{ type: 'text', text: '{}' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage: { input_tokens: 1, output_tokens: 1 },
  ...over,
});

const REQUEST = { system: 'sys', prompt: 'fix it' };

describe('createAnthropicProvider', () => {
  it('sends a structured-output request and parses {patch, explanation}', async () => {
    const { baseURL, captured } = await stub(() => ({
      body: message({ content: [{ type: 'text', text: JSON.stringify({ patch: 'diff --git ...', explanation: 'because' }) }] }),
    }));
    const provider = createAnthropicProvider({ apiKey: 'sk-test', baseURL });
    expect(provider).toMatchObject({ name: 'anthropic', model: DEFAULT_ANTHROPIC_MODEL });

    await expect(provider.propose(REQUEST)).resolves.toEqual({ patch: 'diff --git ...', explanation: 'because' });

    const [req] = captured;
    expect(req.headers['x-api-key']).toBe('sk-test');
    expect(req.body.model).toBe('claude-opus-5-5');
    expect(req.body.system).toBe('sys');
    expect(req.body.messages).toEqual([{ role: 'user', content: 'fix it' }]);
    expect(req.body.output_config.format).toEqual({ type: 'json_schema', schema: PATCH_OUTPUT_SCHEMA });
    expect(req.body.output_config.effort).toBe('high');
    // Default-model refusal fallback is requested; no deprecated thinking budget is sent.
    expect(req.body.fallbacks).toBe('default');
    expect(String(req.headers['anthropic-beta'])).toContain('server-side-fallback-2026-07-01');
    expect(req.body.thinking).toBeUndefined();
    expect(req.body.temperature).toBeUndefined();
  });

  it('omits the fallback parameter for models that do not support it', async () => {
    const { baseURL, captured } = await stub(() => ({
      body: message({ content: [{ type: 'text', text: '{"patch":"","explanation":"x"}' }] }),
    }));
    await createAnthropicProvider({ apiKey: 'k', baseURL, model: 'claude-haiku-4-5' }).propose(REQUEST);
    expect(captured[0].body.model).toBe('claude-haiku-4-5');
    expect(captured[0].body.fallbacks).toBeUndefined();
  });

  it.each([
    [{ stop_reason: 'refusal' }, /declined the request/],
    [{ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"patch"' }] }, /cut off/],
    [{ content: [{ type: 'text', text: 'not json' }] }, /valid structured JSON/],
    [{ content: [{ type: 'text', text: '{"patch": 1}' }] }, /schema/],
  ])('fails explicitly on a bad response %#', async (over, re) => {
    const { baseURL } = await stub(() => ({ body: message(over as Record<string, unknown>) }));
    await expect(createAnthropicProvider({ apiKey: 'k', baseURL }).propose(REQUEST)).rejects.toThrow(re);
  });

  it('maps API errors to a readable message', async () => {
    const { baseURL } = await stub(() => ({
      status: 401,
      body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
    }));
    await expect(createAnthropicProvider({ apiKey: 'bad', baseURL }).propose(REQUEST)).rejects.toThrow(
      /Anthropic API error 401: .*invalid x-api-key/
    );
  });
});

describe('resolveProvider', () => {
  it('is null (report-only) without credentials', () => {
    expect(resolveProvider({ env: {} })).toBeNull();
    expect(resolveProvider({ env: { ANTHROPIC_API_KEY: '  ' } })).toBeNull();
  });

  it('resolves Anthropic from ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN, honouring the model override', () => {
    expect(resolveProvider({ env: { ANTHROPIC_API_KEY: 'k' } })).toMatchObject({ name: 'anthropic', model: DEFAULT_ANTHROPIC_MODEL });
    expect(resolveProvider({ env: { ANTHROPIC_AUTH_TOKEN: 't' } })).toMatchObject({ name: 'anthropic' });
    expect(resolveProvider({ env: { ANTHROPIC_API_KEY: 'k', RE_SHELL_FIX_CI_MODEL: 'claude-sonnet-5-5' } })?.model).toBe('claude-sonnet-5-5');
    expect(resolveProvider({ env: { ANTHROPIC_API_KEY: 'k', RE_SHELL_FIX_CI_MODEL: 'x' }, model: 'claude-haiku-4-5' })?.model).toBe('claude-haiku-4-5');
  });
});
