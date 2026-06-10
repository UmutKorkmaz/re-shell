import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import { jsonResponseSchema, findResponseSchema } from '@re-shell/contracts';

/**
 * Contract conformance regression suite.
 *
 * Spawns the BUILT CLI (dist/index.js) for every documented `--json` command,
 * captures stdout, and asserts:
 *   1. stdout is exactly one JSON.parse-able line (the single-line envelope
 *      contract), and
 *   2. the parsed payload validates against `jsonResponseSchema(<dataSchema>)`
 *      from @re-shell/contracts — the canonical, zod-backed wire envelope.
 *
 * The envelope (`{ ok, data, warnings }` / `{ ok:false, error, warnings }`) is
 * the enforced cross-process contract and is validated for every command. Each
 * command additionally pins its real, shipped data shape via a reality-derived
 * schema so payload drift is caught. The doc at docs/CLI-CONTRACTS.md is
 * reproducible from these same invocations.
 */

// The CLI binary under test. Tests run with cwd = packages/cli.
const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
// The monorepo root is a real, populated workspace fixture.
const MONOREPO_ROOT = path.resolve(process.cwd(), '..', '..');

const MAX_BUFFER = 64 * 1024 * 1024; // template list payloads exceed 64KB

interface RunResult {
  stdout: string;
  status: number;
}

/**
 * Spawn the built CLI and capture stdout + exit code. Never throws on a
 * non-zero exit — error-path commands legitimately exit 1.
 *
 * stdout is captured by redirecting the child's fd 1 to a temp file rather than
 * an OS pipe. The CLI calls `process.exit()` immediately after a command
 * resolves, which truncates large payloads (> ~64KB, e.g. `commands list`)
 * mid-write when fd 1 is a pipe but flushes fully to a regular file. Capturing
 * via a file mirrors the supported `re-shell ... --json > out.json` consumer
 * pattern and avoids masking real payloads. (See docs/CLI-CONTRACTS.md for the
 * pipe-truncation caveat.)
 */
function runCli(args: string[], cwd: string = MONOREPO_ROOT): RunResult {
  const outFile = path.join(os.tmpdir(), `rs-conf-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  const fd = fs.openSync(outFile, 'w');
  let status = 0;
  try {
    execFileSync('node', [CLI_PATH, ...args], {
      cwd,
      maxBuffer: MAX_BUFFER,
      stdio: ['ignore', fd, 'ignore'],
    });
  } catch (error: unknown) {
    const e = error as { status?: number };
    status = typeof e.status === 'number' ? e.status : 1;
  } finally {
    fs.closeSync(fd);
  }
  const stdout = fs.readFileSync(outFile, 'utf8');
  fs.rmSync(outFile, { force: true });
  return { stdout, status };
}

/**
 * Assert stdout is exactly one JSON line and return the parsed object.
 */
function parseSingleLine(stdout: string): Record<string, unknown> {
  const lines = stdout.split('\n').filter(line => line.length > 0);
  expect(lines.length, `expected exactly one stdout line, got ${lines.length}`).toBe(1);
  return JSON.parse(lines[0]) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Reality-derived data schemas (mirror ACTUAL shipped output, captured from
// dist/index.js). These intentionally use `.passthrough()`/`.partial()` where
// the shape is rich and stable enough to drift safely, while pinning the
// load-bearing keys each consumer relies on.
// ---------------------------------------------------------------------------

const workspaceInfoSchema = z
  .object({
    name: z.string(),
    path: z.string(),
    type: z.string(),
    version: z.string().optional(),
    framework: z.string().nullable().optional(),
    dependencies: z.array(z.string()).optional(),
  })
  .loose();

const graphNodeSchema = z
  .object({
    name: z.string(),
    path: z.string(),
    framework: z.string().nullable(),
    dependencies: z.array(z.string()),
  })
  .loose();

const contractGraphSchema = z.object({
  apps: z.array(graphNodeSchema),
  services: z.array(graphNodeSchema),
});

const canonicalHealthSchema = z
  .object({
    score: z.number(),
    status: z.enum(['healthy', 'degraded', 'critical']),
    checks: z.array(
      z
        .object({
          name: z.string(),
          status: z.string(),
          message: z.string(),
        })
        .loose()
    ),
  })
  .loose();

const workspaceSummaryRealSchema = z
  .object({
    root: z.string(),
    packageManager: z.string(),
    workspaces: z.array(workspaceInfoSchema),
    graph: contractGraphSchema,
    health: canonicalHealthSchema,
  })
  .loose();

const templateSummaryRealSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    language: z.string(),
    framework: z.string(),
  })
  .loose();

const commandCatalogEntrySchema = z
  .object({
    path: z.string(),
    aliases: z.array(z.string()),
    description: z.string(),
    args: z.array(z.object({ name: z.string(), required: z.boolean() }).loose()),
    flags: z.array(z.object({ name: z.string() }).loose()),
    supportsJson: z.boolean(),
    supportsDryRun: z.boolean(),
    destructive: z.boolean(),
  })
  .loose();

const doctorDataSchema = z
  .object({
    checks: z.array(
      z.object({ name: z.string(), status: z.string(), message: z.string() }).loose()
    ),
  })
  .loose();

const microfrontendListSchema = z
  .object({
    microfrontends: z.array(
      z
        .object({
          name: z.string(),
          path: z.string(),
          version: z.string(),
        })
        .loose()
    ),
  })
  .loose();

describe('contract conformance: --json envelope + data shapes', () => {
  beforeAll(() => {
    // The suite drives the built artifact. Assume dist is fresh (the package's
    // build runs before `vitest run` in CI / the documented test flow), but
    // fail loudly with an actionable message if it is missing.
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `Built CLI not found at ${CLI_PATH}. Run \`pnpm --filter @re-shell/cli run build\` first.`
      );
    }
  });

  // --- OK-path shape conformance -----------------------------------------

  it('workspace summary --json conforms to the envelope + summary shape', () => {
    const { stdout } = runCli(['workspace', 'summary', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(workspaceSummaryRealSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('workspace graph --json conforms to the envelope + graph shape', () => {
    const { stdout } = runCli(['workspace', 'graph', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(contractGraphSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('workspace health --json conforms to the envelope + health shape', () => {
    const { stdout } = runCli(['workspace', 'health', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(canonicalHealthSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('templates list --json conforms to the envelope + template[] shape', () => {
    const { stdout } = runCli(['templates', 'list', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(z.array(templateSummaryRealSchema)).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('templates show <valid> --json conforms to the envelope + template shape', () => {
    const { stdout } = runCli(['templates', 'show', 'express', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(templateSummaryRealSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('commands list --json conforms to the envelope + catalog[] shape', () => {
    const { stdout } = runCli(['commands', 'list', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(z.array(commandCatalogEntrySchema)).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('doctor --json conforms to the envelope + doctor shape', () => {
    const { stdout } = runCli(['doctor', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(doctorDataSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('list --json conforms to the envelope + microfrontend list shape', () => {
    const { stdout } = runCli(['list', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(microfrontendListSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });

  it('find --json conforms to the envelope + findResponse shape with relevant hits', () => {
    const { stdout } = runCli(['find', 'kubernetes manifests', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(findResponseSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
    // The k8s manifest generator is the most relevant real command for this query.
    const data = (env as { data: { results: Array<{ id: string }> } }).data;
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

  /** Run `find <query> --json` and return the typed result list. */
  function findResults(
    query: string,
    extraArgs: string[] = []
  ): Array<{ type: string; id: string; score: number; matched: string[] }> {
    const { stdout, status } = runCli(['find', query, '--json', ...extraArgs]);
    const env = parseSingleLine(stdout);
    expect(env.ok, `find "${query}" should succeed`).toBe(true);
    expect(status).toBe(0);
    const parsed = jsonResponseSchema(findResponseSchema).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
    return (env as { data: { results: Array<{ type: string; id: string; score: number; matched: string[] }> } })
      .data.results;
  }

  it('find "rotate a secret in k8s" surfaces the k8s + secret-related commands/templates', () => {
    const results = findResults('rotate a secret in k8s', ['--limit', '8']);
    const ids = results.map(r => r.id);
    // The K8s commands and the secrets-management template are the on-topic hits.
    expect(ids.some(id => id.startsWith('k8s'))).toBe(true);
    expect(
      ids.includes('security secret-detection') || ids.includes('secrets-management'),
      `expected a secret-related hit, got: ${ids.join(', ')}`
    ).toBe(true);
  });

  it('find "high-throughput async API" ranks real API templates at the top', () => {
    const results = findResults('high-throughput async API', ['--limit', '8']);
    expect(results.length).toBeGreaterThan(0);
    // Every top hit should have matched the load-bearing "api"/"async" terms.
    expect(results.some(r => r.id.includes('api'))).toBe(true);
    // The websocket-api-docs template is the strongest async+api match.
    expect(results.some(r => r.id === 'websocket-api-docs')).toBe(true);
    expect(results[0].matched).toContain('api');
  });

  it('find "generate helm chart" ranks the helm generator command first', () => {
    const results = findResults('generate helm chart');
    expect(results[0].id).toBe('k8s helm generate');
    expect(results[0].type).toBe('command');
    // All three load-bearing terms contributed to the top hit.
    expect(results[0].matched).toEqual(
      expect.arrayContaining(['generate', 'helm', 'chart'])
    );
  });

  it('find honours --limit', () => {
    const results = findResults('api', ['--limit', '3']);
    expect(results.length).toBe(3);
  });

  it('find --type template returns only templates; --type command only commands', () => {
    const templatesOnly = findResults('generate', ['--type', 'template', '--limit', '10']);
    expect(templatesOnly.length).toBeGreaterThan(0);
    expect(templatesOnly.every(r => r.type === 'template')).toBe(true);

    const commandsOnly = findResults('generate', ['--type', 'command', '--limit', '10']);
    expect(commandsOnly.length).toBeGreaterThan(0);
    expect(commandsOnly.every(r => r.type === 'command')).toBe(true);
  });

  it('find returns an empty (but valid) result set for an unmatchable query', () => {
    const results = findResults('zxqwvbjkmpfgvqxz');
    expect(results).toEqual([]);
  });

  it('find returns an empty result set for a stop-words-only query', () => {
    const results = findResults('the a of to');
    expect(results).toEqual([]);
  });

  // --- Error-path conformance --------------------------------------------

  it('templates show <bad> --json emits {ok:false} envelope and exits non-zero', () => {
    const { stdout, status } = runCli(['templates', 'show', '__definitely_not_a_template__', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(false);
    expect(status).not.toBe(0);
    // Validates against the error branch of the canonical envelope union.
    const parsed = jsonResponseSchema(z.unknown()).safeParse(env);
    expect(parsed.success).toBe(true);
    const error = (env as { error: { code: string } }).error;
    expect(error.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('workspace health --json in a non-workspace dir emits {ok:false} + non-zero exit', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-conformance-'));
    try {
      const { stdout, status } = runCli(['workspace', 'health', '--json'], tmpDir);
      const env = parseSingleLine(stdout);
      expect(env.ok).toBe(false);
      expect(status).not.toBe(0);
      const parsed = jsonResponseSchema(z.unknown()).safeParse(env);
      expect(parsed.success).toBe(true);
      const error = (env as { error: { code: string } }).error;
      expect(error.code).toBe('WORKSPACE_NOT_FOUND');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('find --type <bad> --json emits {ok:false} FIND_ERROR + non-zero exit', () => {
    const { stdout, status } = runCli(['find', 'anything', '--type', '__nope__', '--json']);
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(false);
    expect(status).not.toBe(0);
    const parsed = jsonResponseSchema(z.unknown()).safeParse(env);
    expect(parsed.success).toBe(true);
    const error = (env as { error: { code: string } }).error;
    expect(error.code).toBe('FIND_ERROR');
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

    // `workspace list --json` output is small (~2KB), well under the pipe
    // truncation threshold, so a pipe is safe here. A pipe (Socket) is also
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
    expect(/\[/.test(stdout)).toBe(false);
    // No braille spinner frames.
    expect(/[⠀-⣿]/.test(stdout)).toBe(false);
    // Exactly one clean JSON line, and it is the envelope.
    const env = parseSingleLine(stdout);
    expect(env.ok).toBe(true);
    const parsed = jsonResponseSchema(z.array(workspaceInfoSchema)).safeParse(env);
    expect(parsed.success, JSON.stringify((parsed as any).error?.issues?.[0])).toBe(true);
  });
});
