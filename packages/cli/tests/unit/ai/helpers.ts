import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { CommandCatalogEntry } from '../../../src/utils/command-catalog';

/**
 * Shared fixtures for the AI test suite: a command catalogue shaped like the
 * live one, an on-disk polyglot workspace, and fake transports for the model
 * providers. Nothing here touches the network or the real home directory.
 */

const jsonFlag = { name: '--json', description: 'Output as JSON', takesValue: false };

function entry(
  p: string,
  description: string,
  extra: Partial<CommandCatalogEntry> = {}
): CommandCatalogEntry {
  return {
    path: p,
    aliases: [],
    description,
    args: [],
    flags: [jsonFlag],
    supportsJson: true,
    supportsDryRun: false,
    destructive: false,
    ...extra,
  };
}

/** A catalogue shaped like the live one (same paths/args/flags for what the AI layer uses). */
export function fixtureCatalog(): CommandCatalogEntry[] {
  return [
    entry('templates list', 'List available framework templates'),
    entry('templates show', 'Show details for a single framework template', {
      args: [{ name: 'id', required: true }],
    }),
    entry('workspace health', 'Run workspace health checks'),
    entry('workspace summary', 'Summarize the workspace'),
    entry('workspace graph', 'Generate the workspace dependency graph'),
    entry('workspace impact workspace', 'Show the impact of changing a workspace', {
      args: [{ name: 'name', required: true }],
    }),
    entry('create', 'Create a new Re-Shell project with shell application', {
      args: [{ name: 'name', required: true }],
      flags: [
        { name: '--template', description: 'Template to use', takesValue: true },
        { name: '--framework', description: 'Frontend framework', takesValue: true },
        jsonFlag,
      ],
      supportsDryRun: true,
    }),
    entry('commands list', 'List all available commands as a machine-readable catalog'),
    entry('doctor', 'Diagnose common environment issues'),
    entry('list', 'List all microfrontends in the current project'),
    entry('build', 'Build all or specific microfrontends', {
      args: [{ name: 'name', required: false }],
      flags: [
        { name: '--production', description: 'Build for production', takesValue: false },
        { name: '--analyze', description: 'Analyze bundle size', takesValue: false },
      ],
      supportsJson: false,
    }),
    entry('run', 'Run a task across the workspace in dependency order', {
      args: [{ name: 'task', required: true }],
      flags: [
        { name: '--affected', description: 'Only affected packages', takesValue: false },
        { name: '--filter', description: 'Restrict to package name(s)', takesValue: true },
        { name: '--concurrency', description: 'Max parallel tasks', takesValue: true },
        jsonFlag,
      ],
    }),
    entry('service run logs', 'Show service logs', {
      args: [{ name: 'service', required: false }],
      supportsJson: false,
      flags: [{ name: '--follow', description: 'Follow logs', takesValue: false }],
    }),
    entry('service run restart', 'Restart a service', {
      args: [{ name: 'service', required: true }],
      supportsJson: false,
      flags: [],
    }),
    entry('service run inspect', 'Inspect a service', {
      args: [{ name: 'service', required: true }],
      supportsJson: false,
      flags: [],
    }),
    entry('service run down', 'Stop and remove development services', {
      supportsJson: false,
      flags: [],
      destructive: true,
    }),
    entry('remove', 'Remove a microfrontend', {
      args: [{ name: 'name', required: true }],
      supportsJson: false,
      flags: [{ name: '--force', description: 'Skip confirmation', takesValue: false }],
      destructive: true,
    }),
    // The AI command family itself: must never be proposable.
    entry('ai', 'Resolve a natural-language prompt', {
      args: [{ name: 'prompt', required: true }],
    }),
    entry('ai create', 'Plan a project scaffold', { args: [{ name: 'description', required: true }] }),
  ];
}

/** A throwaway directory. */
export function tmpDir(prefix = 'rs-ai-'): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/**
 * Create an on-disk polyglot workspace:
 *   @acme/payments-service  (packages/, express, depends on payments-db)
 *   @acme/payments-db       (packages/)
 *   @acme/api               (packages/, depends on payments-service)
 *   @acme/web               (apps/, react, depends on api)
 *   orders                  (services/orders, python/fastapi, declared in re-shell.workspaces.yaml)
 */
export function createFixtureWorkspace(options: { withPaymentsDb?: boolean } = {}): {
  root: string;
  cleanup: () => void;
} {
  const { dir, cleanup } = tmpDir('rs-ai-ws-');
  const withDb = options.withPaymentsDb !== false;
  write(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'acme', private: true, workspaces: ['apps/*', 'packages/*'] })
  );
  write(
    path.join(dir, 'packages/payments-service/package.json'),
    JSON.stringify({
      name: '@acme/payments-service',
      version: '1.0.0',
      scripts: { build: 'tsc', test: 'vitest' },
      dependencies: { ...(withDb ? { '@acme/payments-db': '*' } : {}), express: '^4' },
    })
  );
  if (withDb) {
    write(
      path.join(dir, 'packages/payments-db/package.json'),
      JSON.stringify({ name: '@acme/payments-db', version: '1.0.0', scripts: { build: 'tsc' } })
    );
  }
  write(
    path.join(dir, 'packages/api/package.json'),
    JSON.stringify({
      name: '@acme/api',
      version: '1.0.0',
      scripts: { build: 'tsc', test: 'vitest' },
      dependencies: { '@acme/payments-service': '*' },
    })
  );
  write(
    path.join(dir, 'apps/web/package.json'),
    JSON.stringify({
      name: '@acme/web',
      version: '1.0.0',
      scripts: { build: 'vite build' },
      dependencies: { react: '^19', '@acme/api': '*' },
    })
  );
  write(path.join(dir, 'services/orders/requirements.txt'), 'fastapi==0.110\nuvicorn\n');
  write(
    path.join(dir, 're-shell.workspaces.yaml'),
    [
      'version: 2',
      'name: acme',
      'services:',
      '  orders:',
      '    type: backend',
      '    language: python',
      '    framework: fastapi',
      '    path: services/orders',
      '    port: 8001',
      '    dependsOn: [payments-service]',
      '',
    ].join('\n')
  );
  return { root: dir, cleanup };
}

// ---------------------------------------------------------------------------
// Fake transports
// ---------------------------------------------------------------------------

/** One recorded fetch call. */
export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

/** A fetch fake that records calls and answers from a handler. */
export function fakeFetch(
  handler: (call: RecordedCall, init: RequestInit) => Response | Promise<Response>
): { fetch: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const impl = (async (input: any, init: RequestInit = {}) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers as any).forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    let body: any;
    if (typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const call: RecordedCall = {
      url: String(typeof input === 'string' ? input : input?.url ?? input),
      method: (init.method ?? 'GET').toUpperCase(),
      headers,
      body,
    };
    calls.push(call);
    return handler(call, init);
  }) as typeof fetch;
  return { fetch: impl, calls };
}

/** A fetch that never answers until its signal aborts (for timeout tests). */
export function hangingFetch(): { fetch: typeof fetch; calls: RecordedCall[] } {
  return fakeFetch(
    (_call, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal as AbortSignal | undefined;
        const abort = (): void => {
          const e = new Error('The operation was aborted');
          e.name = 'AbortError';
          reject(e);
        };
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      })
  );
}

/** A complete model proposal with defaults. */
export function proposalJson(
  partial: Partial<{
    outcome: string;
    argv: string[];
    confidence: number;
    rationale: string;
    question: string;
    alternatives: Array<{ argv: string[]; confidence: number }>;
  }> = {}
): Record<string, unknown> {
  return {
    outcome: 'command',
    argv: [],
    confidence: 0.9,
    rationale: '',
    question: '',
    alternatives: [],
    ...partial,
  };
}

/** An Anthropic Messages API response carrying `text` as the model output. */
export function anthropicMessage(
  text: string,
  overrides: Record<string, unknown> = {}
): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_test_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 11, output_tokens: 22 },
      ...overrides,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

/** An Anthropic error response. */
export function anthropicError(status: number, type: string, message: string): Response {
  return new Response(JSON.stringify({ type: 'error', error: { type, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** An OpenAI-compatible chat-completions response. */
export function chatCompletion(content: string | null, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion',
      model: 'llama3.1:8b',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content, ...(extra.message as object) },
          finish_reason: (extra.finish_reason as string) ?? 'stop',
        },
      ],
      usage: { prompt_tokens: 7, completion_tokens: 9 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

/** A plain JSON response. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
