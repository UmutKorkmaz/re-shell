import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  findResponseSchema,
  workspaceSummaryWireSchema,
  workspaceGraphWireSchema,
  workspaceHealthWireSchema,
  workspaceListWireSchema,
  templatesListWireSchema,
  templateWireSchema,
  templatesMatrixWireSchema,
  commandCatalogWireSchema,
  doctorWireSchema,
  microfrontendListWireSchema,
  aiIntentResponseSchema,
  aiSuggestResponseSchema,
  aiConfigShowResponseSchema,
} from '@re-shell/contracts';
// @ts-expect-error -- plain ESM script (no type declarations); see scripts/gen-cli-contracts.mjs
import { buildFixtureWorkspace, findUndeclaredKeys, generateDoc, describeDifference, DOC_PATH, REGENERATE_COMMAND } from '../scripts/gen-cli-contracts.mjs';

/**
 * Contract conformance regression suite.
 *
 * Spawns the BUILT CLI (dist/index.js) for every documented `--json` command,
 * captures stdout THROUGH A PIPE (the way every real consumer reads it), and
 * asserts:
 *   1. stdout is exactly one JSON.parse-able line (the single-line envelope
 *      contract), complete even for payloads far larger than a pipe buffer;
 *   2. the parsed payload validates against `jsonResponseSchema(<wire schema>)`
 *      from @re-shell/contracts, i.e. against the schemas the MCP server, the VS
 *      Code extension and the dashboard feed parsing use, NOT against a local
 *      copy of what the output happens to look like;
 *   3. the CLI prints no key the wire schema does not declare. Wire schemas are
 *      loose (they preserve unknown keys at runtime), so this is what makes a new
 *      CLI field fail here until the contract is updated;
 *   4. docs/CLI-CONTRACTS.md equals what the generator
 *      (scripts/gen-cli-contracts.mjs) produces from the CLI and the contracts.
 *
 * If a command's output changes, update the wire schema in
 * packages/contracts/src/wire.ts (and its fixtures), then regenerate the doc.
 */

// The CLI binary under test. Tests run with cwd = packages/cli.
const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
// The monorepo root is a real, populated workspace fixture.
const MONOREPO_ROOT = path.resolve(process.cwd(), '..', '..');

const MAX_BUFFER = 64 * 1024 * 1024;
/** Pipe buffers are 64KB on Linux; payloads above this prove a pipe is not truncating. */
const PIPE_BUFFER_BYTES = 64 * 1024;

interface RunResult {
  stdout: string;
  status: number;
  /** Captured only to make a failing run diagnosable. */
  stderr: string;
}

/**
 * Spawn the built CLI and capture stdout + exit code through an OS pipe. Never
 * rejects on a non-zero exit: error-path commands legitimately exit 1.
 */
function runCliAsync(args: string[], cwd: string = MONOREPO_ROOT): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    child.stderr.on('data', (chunk: Buffer) => errChunks.push(chunk));
    let size = 0;
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BUFFER) {
        child.kill('SIGKILL');
        reject(new Error(`stdout of \`${args.join(' ')}\` exceeded ${MAX_BUFFER} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    child.on('error', reject);
    // 'close' (not 'exit'): every byte of stdout has been delivered.
    child.on('close', (code, signal) =>
      resolve({
        stdout: Buffer.concat(chunks).toString('utf8'),
        status: code ?? 1,
        stderr: `${Buffer.concat(errChunks).toString('utf8')}${signal ? ` [killed by ${signal}]` : ''}`,
      })
    );
  });
}

/** Run async jobs with at most `limit` in flight, preserving result order. */
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

/**
 * Assert stdout is exactly one JSON line and return the parsed object.
 */
function parseSingleLine(stdout: string, diagnostics = ''): Record<string, unknown> {
  const lines = stdout.split('\n').filter(line => line.length > 0);
  expect(lines.length, `expected exactly one stdout line, got ${lines.length}${diagnostics}`).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

/**
 * Assert a captured run is a conforming SUCCESS: one line, ok:true, exit 0, the
 * envelope + `data` validate against `dataSchema`, and the CLI printed no key the
 * schema does not declare. Returns the parsed envelope.
 */
function expectConforms(
  run: RunResult,
  dataSchema: z.ZodTypeAny
): { ok: true; data: unknown; warnings: string[] } {
  const env = parseSingleLine(run.stdout);
  expect(env.ok, 'expected an ok:true envelope').toBe(true);
  expect(run.status, 'an ok:true envelope must exit 0').toBe(0);
  const parsed = jsonResponseSchema(dataSchema).safeParse(env);
  expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
  const undeclared = findUndeclaredKeys(dataSchema, env.data) as string[];
  expect(
    undeclared,
    `the CLI prints keys the wire schema does not declare (add them to packages/contracts/src/wire.ts): ${undeclared.join(', ')}`
  ).toEqual([]);
  return env as { ok: true; data: unknown; warnings: string[] };
}

/** Assert a captured run is a conforming ERROR envelope with `code` and a non-zero exit. */
function expectErrorEnvelope(run: RunResult, code: string): Record<string, unknown> {
  const env = parseSingleLine(run.stdout);
  expect(env.ok).toBe(false);
  expect(run.status).not.toBe(0);
  // The error branch of the canonical envelope union.
  const parsed = jsonResponseSchema(z.unknown()).safeParse(env);
  expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
  expect((env as { error: { code: string } }).error.code).toBe(code);
  return env;
}

// ---------------------------------------------------------------------------
// Every real run is started up front, a few at a time (each boots the whole CLI,
// which takes seconds), then the tests below assert on the captured output.
// ---------------------------------------------------------------------------

const FIND_QUERIES = {
  k8sManifests: ['find', 'kubernetes manifests', '--json'],
  rotateSecret: ['find', 'rotate a secret in k8s', '--json', '--limit', '8'],
  asyncApi: ['find', 'high-throughput async API', '--json', '--limit', '8'],
  helmChart: ['find', 'generate helm chart', '--json'],
  limited: ['find', 'api', '--json', '--limit', '3'],
  templateOnly: ['find', 'generate', '--json', '--type', 'template', '--limit', '10'],
  commandOnly: ['find', 'generate', '--json', '--type', 'command', '--limit', '10'],
  unmatchable: ['find', 'zxqwvbjkmpfgvqxz', '--json'],
  stopWords: ['find', 'the a of to', '--json'],
} as const;

describe('contract conformance: --json envelope + data shapes', () => {
  let emptyDir: string;
  let fixtureParent: string;
  let runs: Record<string, RunResult>;

  beforeAll(async () => {
    // The suite drives the built artifact. Assume dist is fresh (the package's
    // build runs before `vitest run` in CI / the documented test flow), but
    // fail loudly with an actionable message if it is missing.
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }

    emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-conformance-'));

    const jobs: Array<[string, string[], string?]> = [
      ['workspaceSummary', ['workspace', 'summary', '--json']],
      ['workspaceGraph', ['workspace', 'graph', '--json']],
      ['workspaceHealth', ['workspace', 'health', '--json']],
      ['workspaceList', ['workspace', 'list', '--json']],
      ['templatesList', ['templates', 'list', '--json']],
      ['templatesShow', ['templates', 'show', 'express', '--json']],
      ['templatesMatrix', ['templates', 'matrix', '--json']],
      ['commandsList', ['commands', 'list', '--json']],
      ['list', ['list', '--json']],
      ...Object.entries(FIND_QUERIES).map(([key, args]): [string, string[]] => [`find.${key}`, [...args]]),
      ['templatesShowBad', ['templates', 'show', '__definitely_not_a_template__', '--json']],
      ['healthOutside', ['workspace', 'health', '--json'], emptyDir],
      ['findBadType', ['find', 'anything', '--type', '__nope__', '--json']],
    ];
    // `doctor` shells out to `npm audit` / `npm outdated` per workspace and has its
    // own 120s operation timeout; at this repository's root that takes over a
    // minute on an idle machine. It runs against a small real fixture workspace
    // instead (same checks, same output shape), alone before the pool starts.
    fixtureParent = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-conformance-fx-'));
    const doctor = await runCliAsync(['doctor', '--json'], buildFixtureWorkspace(fixtureParent));

    const results = await mapLimited(jobs, 4, ([, args, cwd]) => runCliAsync(args, cwd));
    runs = { doctor, ...Object.fromEntries(jobs.map(([key], index) => [key, results[index]])) };
  }, 600_000);

  afterAll(() => {
    fs.rmSync(emptyDir, { recursive: true, force: true });
    fs.rmSync(fixtureParent, { recursive: true, force: true });
  });

  // --- OK-path shape conformance -----------------------------------------

  it('workspace summary --json conforms to the envelope + wire summary shape', () => {
    const env = expectConforms(runs.workspaceSummary, workspaceSummaryWireSchema);
    const data = workspaceSummaryWireSchema.parse(env.data);
    expect(fs.realpathSync(data.root)).toBe(fs.realpathSync(MONOREPO_ROOT));
    expect(data.workspaces.length).toBeGreaterThan(0);
  });

  it('workspace graph --json conforms to the envelope + graph shape', () => {
    expectConforms(runs.workspaceGraph, workspaceGraphWireSchema);
  });

  it('workspace health --json conforms to the envelope + canonical health shape', () => {
    expectConforms(runs.workspaceHealth, workspaceHealthWireSchema);
  });

  it('workspace list --json conforms to the envelope + workspace[] shape', () => {
    expectConforms(runs.workspaceList, workspaceListWireSchema);
  });

  it('the summary embeds exactly the graph and health the dedicated commands emit', () => {
    const summary = workspaceSummaryWireSchema.parse(
      (parseSingleLine(runs.workspaceSummary.stdout) as { data: unknown }).data
    );
    const graph = (parseSingleLine(runs.workspaceGraph.stdout) as { data: unknown }).data;
    const health = workspaceHealthWireSchema.parse(
      (parseSingleLine(runs.workspaceHealth.stdout) as { data: unknown }).data
    );
    expect(summary.graph).toEqual(graph);
    expect(summary.health.checks.map(c => c.name)).toEqual(health.checks.map(c => c.name));
  });

  it('templates list --json conforms to the envelope + template[] shape (large payload, through a pipe)', () => {
    // Bigger than a pipe buffer: proves the CLI flushes everything before exit.
    expect(Buffer.byteLength(runs.templatesList.stdout)).toBeGreaterThan(PIPE_BUFFER_BYTES);
    const env = expectConforms(runs.templatesList, templatesListWireSchema);
    expect((env.data as unknown[]).length).toBeGreaterThan(100);
  });

  it('templates show <valid> --json conforms to the envelope + template shape', () => {
    const env = expectConforms(runs.templatesShow, templateWireSchema);
    expect((env.data as { id: string }).id).toBe('express');
  });

  it('templates matrix --json conforms to the envelope + matrix shape', () => {
    expectConforms(runs.templatesMatrix, templatesMatrixWireSchema);
  });

  it('commands list --json conforms to the envelope + catalog[] shape (hundreds of KB, through a pipe)', () => {
    expect(Buffer.byteLength(runs.commandsList.stdout)).toBeGreaterThan(PIPE_BUFFER_BYTES);
    const env = expectConforms(runs.commandsList, commandCatalogWireSchema);
    expect((env.data as unknown[]).length).toBeGreaterThan(100);
  });

  it('doctor --json conforms to the envelope + doctor shape', () => {
    const env = parseSingleLine(
      runs.doctor.stdout,
      ` (exit ${runs.doctor.status}, stderr: ${runs.doctor.stderr.slice(0, 500)})`
    );
    // `doctor` may report failing checks through its own error envelope; both
    // branches must still satisfy the contract, and the exit code must agree.
    const parsed = jsonResponseSchema(doctorWireSchema).safeParse(env);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
    if (env.ok === true) {
      expect(runs.doctor.status).toBe(0);
      expect(findUndeclaredKeys(doctorWireSchema, env.data)).toEqual([]);
      expect(doctorWireSchema.parse(env.data).checks.length).toBeGreaterThan(0);
    } else {
      expect(runs.doctor.status).not.toBe(0);
      expect((env as { error: { code: string } }).error.code).toBe('DOCTOR_ERROR');
    }
  });

  it('list --json conforms to the envelope + microfrontend list shape', () => {
    expectConforms(runs.list, microfrontendListWireSchema);
  });

  // `--offline --no-cache` keeps these hermetic: no network, no cache/session writes.
  it('ai <prompt> --json conforms to the envelope + aiIntentResponse shape and never executes', async () => {
    const { stdout } = await runCliAsync(['ai', 'list templates', '--json', '--offline', '--no-cache']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(aiIntentResponseSchema).safeParse(env);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
    expect((env.data as { executed: boolean }).executed).toBe(false);
    expect((env.data as { provider: string }).provider).toBe('offline');
  });

  it('ai suggest --json conforms to the envelope + aiSuggestResponse shape', async () => {
    const { stdout } = await runCliAsync(['ai', 'suggest', 'workspace he', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(aiSuggestResponseSchema).safeParse(env);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
  });

  it('ai config show --json conforms to the envelope + shape and never contains a secret', async () => {
    const { stdout } = await runCliAsync(['ai', 'config', 'show', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(aiConfigShowResponseSchema).safeParse(env);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
    expect(stdout).not.toMatch(/sk-[A-Za-z0-9_-]{12,}/);
  });

  it('ai with an unknown provider emits {ok:false} AI_CONFIG_ERROR + non-zero exit', async () => {
    const { stdout, status } = await runCliAsync(['ai', 'list templates', '--provider', 'bogus', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(false);
    expect((env.error as { code: string }).code).toBe('AI_CONFIG_ERROR');
    expect(status).not.toBe(0);
  });

  it('find --json conforms to the envelope + findResponse shape with relevant hits', () => {
    const env = expectConforms(runs['find.k8sManifests'], findResponseSchema);
    // The k8s manifest generator is the most relevant real command for this query.
    const data = (env as unknown as { data: { results: Array<{ id: string }> } }).data;
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.some(r => r.id === 'k8s manifests')).toBe(true);
  });

  // --- Relevance: real corpus, real ranking (offline keyword path) -------
  //
  // These drive the FULL registered program (all command groups + the live
  // template registry) via the built CLI, exactly as `re-shell find` ships.
  // They assert the offline keyword/fuzzy ranker surfaces the right real
  // commands/templates for natural-language queries. No embeddings env is set,
  // so they also pin the keyword-fallback (default) path.

  /** The typed result list of a captured `find` run. */
  function findResults(
    key: keyof typeof FIND_QUERIES
  ): Array<{ type: string; id: string; score: number; matched: string[] }> {
    const run = runs[`find.${key}`];
    const env = parseSingleLine(run.stdout);
    expect(env.ok, `find "${FIND_QUERIES[key][1]}" should succeed`).toBe(true);
    expect(run.status).toBe(0);
    const parsed = jsonResponseSchema(findResponseSchema).safeParse(env);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
    return (env as { data: { results: Array<{ type: string; id: string; score: number; matched: string[] }> } })
      .data.results;
  }

  it('find "rotate a secret in k8s" surfaces the k8s + secret-related commands/templates', () => {
    const results = findResults('rotateSecret');
    const ids = results.map(r => r.id);
    // The K8s commands and the secrets-management template are the on-topic hits.
    expect(ids.some(id => id.startsWith('k8s'))).toBe(true);
    expect(
      ids.includes('security secret-detection') || ids.includes('secrets-management'),
      `expected a secret-related hit, got: ${ids.join(', ')}`
    ).toBe(true);
  });

  it('find "high-throughput async API" ranks real API templates at the top', () => {
    const results = findResults('asyncApi');
    expect(results.length).toBeGreaterThan(0);
    // Every top hit should have matched the load-bearing "api"/"async" terms.
    expect(results.some(r => r.id.includes('api'))).toBe(true);
    // The websocket-api-docs template is the strongest async+api match.
    expect(results.some(r => r.id === 'websocket-api-docs')).toBe(true);
    expect(results[0].matched).toContain('api');
  });

  it('find "generate helm chart" ranks the helm generator command first', () => {
    const results = findResults('helmChart');
    expect(results[0].id).toBe('k8s helm generate');
    expect(results[0].type).toBe('command');
    // All three load-bearing terms contributed to the top hit.
    expect(results[0].matched).toEqual(
      expect.arrayContaining(['generate', 'helm', 'chart'])
    );
  });

  it('find honours --limit', () => {
    const results = findResults('limited');
    expect(results.length).toBe(3);
  });

  it('find --type template returns only templates; --type command only commands', () => {
    const templatesOnly = findResults('templateOnly');
    expect(templatesOnly.length).toBeGreaterThan(0);
    expect(templatesOnly.every(r => r.type === 'template')).toBe(true);

    const commandsOnly = findResults('commandOnly');
    expect(commandsOnly.length).toBeGreaterThan(0);
    expect(commandsOnly.every(r => r.type === 'command')).toBe(true);
  });

  it('find returns an empty (but valid) result set for an unmatchable query', () => {
    const results = findResults('unmatchable');
    expect(results).toEqual([]);
  });

  it('find returns an empty result set for a stop-words-only query', () => {
    const results = findResults('stopWords');
    expect(results).toEqual([]);
  });

  // --- Error-path conformance --------------------------------------------

  it('templates show <bad> --json emits {ok:false} envelope and exits non-zero', () => {
    const env = expectErrorEnvelope(runs.templatesShowBad, 'TEMPLATE_NOT_FOUND');
    expect((env as { error: { details?: { id?: string } } }).error.details).toEqual({
      id: '__definitely_not_a_template__',
    });
  });

  it('workspace health --json in a non-workspace dir emits {ok:false} + non-zero exit', () => {
    expectErrorEnvelope(runs.healthOutside, 'WORKSPACE_NOT_FOUND');
  });

  it('find --type <bad> --json emits {ok:false} FIND_ERROR + non-zero exit', () => {
    expectErrorEnvelope(runs.findBadType, 'FIND_ERROR');
  });

  // --- Faked-TTY spinner regression --------------------------------------

  it('workspace list --json has no spinner prefix even when stdout is a TTY', () => {
    // Bootstrap that forces process.stdout.isTTY = true (the only condition
    // under which the spinner renders) before loading the CLI. If --json mode
    // failed to suppress the spinner, stdout would carry spinner frames /
    // ANSI cursor codes before the JSON line.
    // Only stdout.isTTY is forced (the spinner's render gate). stderr is left
    // untouched: the CLI calls setEncoding() on any stream it believes is a
    // TTY, and a non-Socket stderr (e.g. /dev/null) lacks setEncoding.
    const shim = [
      "Object.defineProperty(process.stdout,'isTTY',{value:true,configurable:true});",
      'const args=JSON.parse(process.env.RS_ARGS);',
      'process.argv=[process.argv[0],process.env.RS_CLI,...args];',
      'require(process.env.RS_CLI);',
    ].join('');

    // `workspace list --json` output is small (~2KB). A pipe (Socket) is
    // required: the CLI calls process.stdout.setEncoding() at startup, which a
    // file-backed SyncWriteStream does not support.
    let stdout = '';
    try {
      stdout = execFileSync('node', ['-e', shim], {
        cwd: MONOREPO_ROOT,
        encoding: 'utf8',
        maxBuffer: MAX_BUFFER,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          ...process.env,
          RS_CLI: CLI_PATH,
          RS_ARGS: JSON.stringify(['workspace', 'list', '--json']),
        },
      });
    } catch (error: unknown) {
      const e = error as { stdout?: string | Buffer };
      stdout = e.stdout ? e.stdout.toString() : '';
    }

    // No ANSI escape sequences (spinner cursor toggles / colors) anywhere.
    // eslint-disable-next-line no-control-regex
    expect(/\u001b\[/.test(stdout)).toBe(false);
    // No braille spinner frames.
    expect(/[⠀-⣿]/.test(stdout)).toBe(false);
    // Exactly one clean JSON line, and it is the envelope.
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(workspaceListWireSchema).safeParse(env);
    expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues[0])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The drift detector itself
// ---------------------------------------------------------------------------

describe('findUndeclaredKeys (the additive-drift detector)', () => {
  const schema = z.looseObject({
    a: z.string(),
    list: z.array(z.looseObject({ id: z.string(), tag: z.string().optional() })),
    nested: z.looseObject({ x: z.number() }).optional(),
    meta: z.record(z.string(), z.looseObject({ n: z.number() })),
    either: z.union([z.looseObject({ kind: z.literal('a'), extra: z.string() }), z.array(z.never())]),
  });

  it('reports nothing for a payload that only uses declared keys', () => {
    expect(
      findUndeclaredKeys(schema, {
        a: 'x',
        list: [{ id: '1' }, { id: '2', tag: 't' }],
        nested: { x: 1 },
        meta: { k: { n: 1 } },
        either: [],
      })
    ).toEqual([]);
  });

  it('reports undeclared keys at every depth, de-duplicated, as dotted paths', () => {
    expect(
      findUndeclaredKeys(schema, {
        a: 'x',
        surprise: 1,
        list: [{ id: '1', added: true }, { id: '2', added: false }],
        nested: { x: 1, deeper: {} },
        meta: { k: { n: 1, m: 2 } },
        either: { kind: 'a', extra: 'e', more: 1 },
      })
    ).toEqual(['either.more', 'list[].added', 'meta.*.m', 'nested.deeper', 'surprise']);
  });
});

// ---------------------------------------------------------------------------
// docs/CLI-CONTRACTS.md is generated; it must match the CLI + contracts
// ---------------------------------------------------------------------------

describe('docs/CLI-CONTRACTS.md', () => {
  it('is exactly what the generator produces from the real CLI and the contracts', async () => {
    const committed = fs.readFileSync(DOC_PATH as string, 'utf8');
    // Runs the CLI against the generator's fixture workspace; throws, listing every
    // problem, if the real output disagrees with @re-shell/contracts.
    const generated = (await generateDoc(committed)) as string;
    expect(
      generated === committed,
      `docs/CLI-CONTRACTS.md is out of date. Regenerate it with:\n  ${REGENERATE_COMMAND as string}\nFirst differences:\n${describeDifference(committed, generated) as string}`
    ).toBe(true);
  }, 600_000);

  it('documents every error code of the vocabulary and marks reserved ones', () => {
    const committed = fs.readFileSync(DOC_PATH as string, 'utf8');
    const rows = committed.match(/^\| `[A-Z0-9_]+` \| (emitted|reserved) \|/gm) ?? [];
    // One row per ErrorCode, none missing, none stale.
    const codes = rows.map(row => row.match(/`([A-Z0-9_]+)`/)![1]);
    expect(new Set(codes).size).toBe(codes.length);
    return import('@re-shell/contracts').then(({ errorCodeSchema }) => {
      expect([...codes].sort()).toEqual([...errorCodeSchema.options].sort());
    });
  });
});
