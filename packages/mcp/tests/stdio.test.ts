import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  commandCatalogWireSchema,
  doctorWireSchema,
  templateWireSchema,
  templatesListWireSchema,
  templatesMatrixWireSchema,
  workspaceGraphWireSchema,
  workspaceHealthWireSchema,
  workspaceSummaryWireSchema,
} from '@re-shell/contracts';

/**
 * End-to-end tests of the BUILT package: dist/index.js, started the way an MCP
 * host starts it (through the installed `bin` symlink), speaking MCP over stdio
 * to the REAL re-shell CLI. No spawn is mocked anywhere in this file.
 *
 * Together they pin the two defects that made `re-shell-mcp` unusable:
 *   1. the entry guard compared the symlinked argv[1] with the real file path, so
 *      the bin exited 0 without starting;
 *   2. the tools validated raw CLI output against the domain schemas, so
 *      workspace_summary / workspace_health / templates_list threw on every real
 *      workspace.
 */

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_ENTRY = path.join(PKG_ROOT, 'dist', 'index.js');
// The monorepo root is a real, populated workspace for the CLI to inspect.
const MONOREPO_ROOT = path.resolve(PKG_ROOT, '..', '..');

const EXPECTED_TOOLS = [
  'workspace_summary',
  'workspace_graph',
  'workspace_health',
  'templates_list',
  'templates_show',
  'templates_matrix',
  'doctor',
  'analyze',
  'commands_list',
];

// Every tool call boots the (large) CLI, which takes seconds on an idle machine and
// far longer on a loaded CI runner; the SDK's 60s default would flake.
const REQUEST_TIMEOUT_MS = 240_000;
/** How many CLI processes the suite lets run at once. */
const CONCURRENCY = 4;

/** Run async tasks with at most `limit` in flight, preserving result order. */
async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

let tmp: string;
/** `<tmp>/node_modules/.bin/re-shell-mcp` -> the real dist/index.js. */
let directBin: string;
/** pnpm/npm layout: `.bin/re-shell-mcp` -> `../@re-shell/mcp/dist/index.js`, and `@re-shell/mcp` is itself a symlink to the package. */
let nestedBin: string;

beforeAll(() => {
  expect(fs.existsSync(DIST_ENTRY), `${DIST_ENTRY} must exist (global setup builds it)`).toBe(true);

  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-bin-')));
  const bin = path.join(tmp, 'node_modules', '.bin');
  fs.mkdirSync(bin, { recursive: true });

  directBin = path.join(bin, 're-shell-mcp');
  fs.symlinkSync(DIST_ENTRY, directBin);

  const scope = path.join(tmp, 'node_modules', '@re-shell');
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(PKG_ROOT, path.join(scope, 'mcp'));
  nestedBin = path.join(bin, 're-shell-mcp-nested');
  fs.symlinkSync(path.join('..', '@re-shell', 'mcp', 'dist', 'index.js'), nestedBin);
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Run `node <script>` to completion and capture everything it printed. */
function runNode(
  args: string[],
  env: NodeJS.ProcessEnv = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: MONOREPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
    child.on('error', reject);
    // 'close' (not 'exit') so every byte of stdout/stderr has been delivered.
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Connect a real MCP client to the server started via `entry` (in `cwd`). */
async function connect(
  entry: string,
  cwd: string = MONOREPO_ROOT
): Promise<{ client: Client; stderr: () => string }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entry],
    cwd,
    stderr: 'pipe',
  });
  let stderrText = '';
  transport.stderr?.on('data', (d: Buffer) => (stderrText += d.toString()));

  const client = new Client({ name: 'stdio-test-client', version: '0.0.0' });
  await client.connect(transport);
  return { client, stderr: () => stderrText };
}

interface ToolOutcome {
  isError: boolean;
  /** The parsed JSON text block the server returned. */
  body: Record<string, unknown>;
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<ToolOutcome> {
  const result = await client.callTool({ name, arguments: args }, undefined, {
    timeout: REQUEST_TIMEOUT_MS,
  });
  const content = result.content as Array<{ type: string; text?: string }>;
  expect(content).toHaveLength(1);
  expect(content[0].type).toBe('text');
  return {
    isError: result.isError === true,
    body: JSON.parse(content[0].text ?? 'null') as Record<string, unknown>,
  };
}

describe('re-shell-mcp started through its bin symlink', () => {
  it.each([
    ['a symlink to dist/index.js (node_modules/.bin)', () => directBin],
    ['a relative symlink through a symlinked package dir (pnpm/npm layout)', () => nestedBin],
    ['the real path', () => DIST_ENTRY],
  ])('completes the MCP initialize + tools/list handshake via %s', async (_label, entry) => {
    const { client, stderr } = await connect(entry());
    try {
      // initialize ran inside connect(); the server identified itself.
      expect(client.getServerVersion()?.name).toBe('@re-shell/mcp');
      // The server reports the package's own version, not a hard-coded constant.
      expect(client.getServerVersion()?.version).toBe(
        JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
      );
      expect(client.getServerCapabilities()?.tools).toBeDefined();

      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(EXPECTED_TOOLS);
      for (const tool of tools) {
        expect(tool.description?.length ?? 0).toBeGreaterThan(0);
        expect(tool.annotations?.readOnlyHint).toBe(true);
      }

      // The server announces itself on stderr only (stdout is the MCP channel).
      expect(stderr()).toContain('[re-shell-mcp] Listening on stdio.');
    } finally {
      await client.close();
    }
  });

  it('runs main() (and fails loudly) instead of exiting 0 silently when the CLI cannot be resolved', async () => {
    // Regression: via the symlink the old guard was false, so this exited 0 with
    // no output. Now the entry runs and reports the misconfiguration.
    const result = await runNode([directBin], { RE_SHELL_BIN: path.join(tmp, 'no-such-cli.js') });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('[re-shell-mcp] Fatal: RE_SHELL_BIN points at a missing file');
    expect(result.stdout).toBe('');
  });

  it('does NOT start the server when dist/index.js is merely imported', async () => {
    const script = `await import(${JSON.stringify(pathToFileURL(DIST_ENTRY).href)}); console.log('imported');`;
    const result = await runNode(['--input-type=module', '-e', script]);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe('imported');
    expect(result.stderr).not.toContain('Listening on stdio');
  });
});


describe('tools against the REAL re-shell CLI (no mocks), over stdio', () => {
  // Starting the CLI costs seconds per call, so the requests are issued up front
  // and a few at a time (the server runs them in parallel); the tests below then
  // assert on the collected results.
  let client: Client;
  let calls: {
    summary: ToolOutcome;
    graph: ToolOutcome;
    health: ToolOutcome;
    templatesAll: ToolOutcome;
    templatesTs: ToolOutcome;
    templateFound: ToolOutcome;
    templateMissing: ToolOutcome;
    matrix: ToolOutcome;
    commands: ToolOutcome;
    resources: Record<string, string>;
  };

  const RESOURCE_URIS = [
    'reshell://workspace/summary',
    'reshell://workspace/graph',
    'reshell://workspace/health',
    'reshell://contracts/commands',
  ];

  beforeAll(async () => {
    ({ client } = await connect(directBin));

    // Each job is one request to the server (and so one real CLI process).
    const jobs: Array<() => Promise<unknown>> = [
      () => callTool(client, 'workspace_summary'),
      () => callTool(client, 'workspace_graph'),
      () => callTool(client, 'workspace_health'),
      () => callTool(client, 'templates_list'),
      () => callTool(client, 'templates_list', { language: 'typescript' }),
      () => callTool(client, 'templates_show', { id: 'express' }),
      () => callTool(client, 'templates_show', { id: '__definitely_not_a_template__' }),
      () => callTool(client, 'templates_matrix'),
      () => callTool(client, 'commands_list'),
      ...RESOURCE_URIS.map((uri) => async () => {
        const result = await client.readResource({ uri }, { timeout: REQUEST_TIMEOUT_MS });
        return (result.contents[0] as { text: string }).text;
      }),
    ];
    const out = await mapLimited(jobs, CONCURRENCY, (job) => job());
    const [
      summary,
      graph,
      health,
      templatesAll,
      templatesTs,
      templateFound,
      templateMissing,
      matrix,
      commands,
      ...resourceTexts
    ] = out as [
      ToolOutcome, ToolOutcome, ToolOutcome, ToolOutcome, ToolOutcome,
      ToolOutcome, ToolOutcome, ToolOutcome, ToolOutcome, ...string[],
    ];
    calls = {
      summary,
      graph,
      health,
      templatesAll,
      templatesTs,
      templateFound,
      templateMissing,
      matrix,
      commands,
      resources: Object.fromEntries(RESOURCE_URIS.map((uri, i) => [uri, resourceTexts[i]])),
    };
  }, 290_000);

  afterAll(async () => {
    await client.close();
  });

  it('workspace_summary returns the real summary (root/packageManager/workspaces/graph/health)', () => {
    const { isError, body } = calls.summary;
    expect(isError).toBe(false);
    expect(body.ok).toBe(true);
    const data = workspaceSummaryWireSchema.parse(body.data);
    expect(fs.realpathSync(data.root)).toBe(fs.realpathSync(MONOREPO_ROOT));
    expect(data.workspaces.map((w) => w.name)).toContain('@re-shell/mcp');
    expect(data.graph.services.length + data.graph.apps.length).toBeGreaterThan(0);
  });

  it('workspace_graph returns { apps, services } with internal edges', () => {
    const { isError, body } = calls.graph;
    expect(isError).toBe(false);
    expect(body.ok).toBe(true);
    const graph = workspaceGraphWireSchema.parse(body.data);
    const mcp = [...graph.apps, ...graph.services].find((n) => n.name === '@re-shell/mcp');
    expect(mcp?.dependencies).toContain('@re-shell/contracts');
    // The dependency this very package now declares on the CLI is part of the graph.
    expect(mcp?.dependencies).toContain('@re-shell/cli');
  });

  it('workspace_health returns the canonical health report', () => {
    const { isError, body } = calls.health;
    expect(isError).toBe(false);
    expect(body.ok).toBe(true);
    const health = workspaceHealthWireSchema.parse(body.data);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(['healthy', 'degraded', 'critical']).toContain(health.status);
    expect(health.checks.length).toBeGreaterThan(0);
  });

  it('templates_list returns the registry projection, and honours the language filter', () => {
    expect(calls.templatesAll.isError).toBe(false);
    const templates = templatesListWireSchema.parse(calls.templatesAll.body.data);
    expect(templates.length).toBeGreaterThan(100);

    expect(calls.templatesTs.isError).toBe(false);
    const typescript = templatesListWireSchema.parse(calls.templatesTs.body.data);
    expect(typescript.length).toBeGreaterThan(0);
    expect(typescript.length).toBeLessThan(templates.length);
    expect(typescript.every((t) => t.language === 'typescript')).toBe(true);
  });

  it('templates_show returns one template; an unknown id is a structured CLI error, not a crash', () => {
    expect(calls.templateFound.isError).toBe(false);
    expect(templateWireSchema.parse(calls.templateFound.body.data).id).toBe('express');

    expect(calls.templateMissing.isError).toBe(true);
    expect((calls.templateMissing.body.error as { code: string }).code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('templates_matrix returns the compatibility grid', () => {
    expect(calls.matrix.isError).toBe(false);
    const matrix = templatesMatrixWireSchema.parse(calls.matrix.body.data);
    expect(matrix.matrix.length).toBeGreaterThan(100);
    expect(matrix.facets.languages.length).toBeGreaterThan(0);
  });

  it('commands_list returns the full catalog (hundreds of KB over the pipe, untruncated)', () => {
    expect(calls.commands.isError).toBe(false);
    const catalog = commandCatalogWireSchema.parse(calls.commands.body.data);
    expect(catalog.length).toBeGreaterThan(100);
    expect(catalog.some((c) => c.path === 'workspace summary' && c.supportsJson)).toBe(true);
  });

  it.each(RESOURCE_URIS)('resource %s serves a validated envelope (never MCP_RESOURCE_ERROR)', (uri) => {
    const envelope = JSON.parse(calls.resources[uri]) as { ok?: boolean; error?: { code: string } };
    expect(envelope.error?.code).toBeUndefined();
    expect(envelope.ok).toBe(true);
  });
});

describe('doctor against the REAL CLI, over stdio', () => {
  // `doctor` at the monorepo root shells out to `npm audit` / `outdated` (about a
  // minute, and network-bound), so it runs in an empty directory: still a real
  // CLI invocation with real `doctor --json` output, but offline.
  it('yields a validated report or a structured CLI error, never a schema-mismatch crash', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-doctor-'));
    const { client } = await connect(directBin, empty);
    try {
      const { isError, body } = await callTool(client, 'doctor');
      if (isError) {
        // The CLI reported failure through its own error envelope.
        const error = body.error as { code: string; message: string };
        expect(error.code).not.toBe('MCP_TOOL_ERROR');
      } else {
        expect(body.ok).toBe(true);
        const report = doctorWireSchema.parse(body.data);
        expect(report.checks.length).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });
});
