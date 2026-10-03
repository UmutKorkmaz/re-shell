import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { fixCiResponseSchema } from '@re-shell/contracts';
import { FAST_GATES, TYPE_ERROR_FIX_PATCH, createFixture, git, type Fixture } from '../utils/fix-ci-fixture';

/**
 * Integration: the BUILT CLI (dist/index.js) running `fix --ci` against a real
 * fixture git repo with a deliberately failing gate, running the real tsc and
 * vitest. The Anthropic API is a local HTTP stub that the real @anthropic-ai/sdk
 * talks to (ANTHROPIC_BASE_URL), so the whole chain is exercised: config ->
 * gates -> provider request -> patch validation -> apply -> gates -> commit.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');

interface CliResult {
  stdout: string;
  stderr: string;
  status: number | null;
}

function startCli(args: string[], cwd: string, env: Record<string, string | undefined>) {
  const merged: NodeJS.ProcessEnv = { ...process.env, ...env };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete merged[k];
  const child = spawn(process.execPath, [CLI_PATH, ...args], { cwd, env: merged, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', d => (stdout += d));
  child.stderr.on('data', d => (stderr += d));
  const done = new Promise<CliResult>(resolve => child.on('close', status => resolve({ stdout, stderr, status })));
  return { child, done };
}

function runCli(args: string[], cwd: string, env: Record<string, string | undefined>): Promise<CliResult> {
  return startCli(args, cwd, env).done;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** True when the pid is gone or only a zombie awaiting reaping (an orphan nobody waits on). */
function isDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return true;
  }
  try {
    return /^\d+ \(.*\) Z/.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8'));
  } catch {
    return false;
  }
}

const NO_PROVIDER_ENV = { ANTHROPIC_API_KEY: undefined, ANTHROPIC_AUTH_TOKEN: undefined, ANTHROPIC_BASE_URL: undefined };

interface Stub {
  url: string;
  requests: Array<{ headers: http.IncomingHttpHeaders; body: Record<string, unknown> }>;
  close: () => Promise<void>;
}

/** A minimal Anthropic Messages API stub returning the given structured-output text. */
function startAnthropicStub(respond: () => { patch: string; explanation: string }): Promise<Stub> {
  const requests: Stub['requests'] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => (raw += c));
    req.on('end', () => {
      requests.push({ headers: req.headers, body: raw ? JSON.parse(raw) : {} });
      const payload = {
        id: 'msg_stub',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: JSON.stringify(respond()) }],
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 },
      };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise<void>(r => server.close(() => r())),
      });
    });
  });
}

let fx: Fixture | undefined;
let stub: Stub | undefined;
afterEach(async () => {
  fx?.cleanup();
  fx = undefined;
  await stub?.close();
  stub = undefined;
});

function parseEnvelope(stdout: string): { ok: boolean; data?: Record<string, unknown>; error?: { code: string; message: string; details?: Record<string, unknown> } } {
  const lines = stdout.trim().split('\n');
  expect(lines, `expected exactly one JSON line, got: ${stdout}`).toHaveLength(1);
  return JSON.parse(lines[0]);
}

describe('re-shell fix --ci (built CLI)', () => {
  it('requires --ci', async () => {
    fx = createFixture(FAST_GATES);
    const r = await runCli(['fix'], fx.dir, NO_PROVIDER_ENV);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/pass --ci/);
  }, 120_000);

  it('report-only without a provider: honest failing-gate report, JSON ok:false, exit 1, nothing changed', async () => {
    fx = createFixture(FAST_GATES);
    const r = await runCli(['fix', '--ci', '--json'], fx.dir, NO_PROVIDER_ENV);
    expect(r.status).toBe(1);
    const env = parseEnvelope(r.stdout);
    expect(env.ok).toBe(false);
    expect(env.error!.code).toBe('FIX_CI_NO_PROVIDER');
    const details = fixCiResponseSchema.parse(env.error!.details);
    expect(details).toMatchObject({ outcome: 'report-only', verdict: 'red', gatesPassed: false, provider: null, branch: null });
    const typecheck = details.finalGates!.find(g => g.name === 'typecheck')!;
    expect(typecheck.passed).toBe(false);
    expect(typecheck.failing[0]).toMatchObject({ file: 'src/index.ts', line: 3, code: 'TS2345' });
    expect(details.finalGates!.find(g => g.name === 'test')!.passed).toBe(true);
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
    expect(git(fx.dir, 'branch', '--format=%(refname:short)')).toBe('main');
  }, 180_000);

  it('human report-only output lists the failing gate and exits 1', async () => {
    fx = createFixture(FAST_GATES);
    const r = await runCli(['fix', '--ci'], fx.dir, NO_PROVIDER_ENV);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/report-only/);
    expect(r.stdout).toMatch(/typecheck/);
    expect(r.stdout).toMatch(/src\/index\.ts:3/);
  }, 180_000);

  it('refuses to skip a locked gate and a dirty tree, with distinct error codes', async () => {
    fx = createFixture(FAST_GATES);
    const skip = await runCli(['fix', '--ci', '--json', '--skip-gate', 'test'], fx.dir, NO_PROVIDER_ENV);
    expect(skip.status).toBe(1);
    expect(parseEnvelope(skip.stdout).error!.code).toBe('FIX_CI_CONFIG_INVALID');

    fs.writeFileSync(path.join(fx.dir, 'wip.txt'), 'x');
    const dirty = await runCli(['fix', '--ci', '--json'], fx.dir, NO_PROVIDER_ENV);
    expect(dirty.status).toBe(1);
    expect(parseEnvelope(dirty.stdout).error!.code).toBe('FIX_CI_DIRTY_TREE');
  }, 120_000);

  it('end to end through the Anthropic SDK: fixes the type error on a new branch, exits 0', async () => {
    fx = createFixture(FAST_GATES);
    stub = await startAnthropicStub(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'pass a number to add()' }));

    const r = await runCli(['fix', '--ci', '--json'], fx.dir, {
      ...NO_PROVIDER_ENV,
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
      ANTHROPIC_BASE_URL: stub.url,
    });

    expect(r.status, r.stderr + r.stdout).toBe(0);
    const env = parseEnvelope(r.stdout);
    expect(env.ok).toBe(true);
    const data = fixCiResponseSchema.parse(env.data);
    expect(data).toMatchObject({ outcome: 'pr-ready', verdict: 'green', gatesPassed: true, provider: 'anthropic', pr: null, prOpened: false });
    expect(data.branch).toMatch(/^re-shell\/fix-ci-\d{8}-\d{6}$/);
    expect(data.iterations).toHaveLength(1);
    expect(data.iterations[0].patch).toMatchObject({ accepted: true, additions: 1, deletions: 1 });
    expect(data.iterations[0].gateResultsBefore!.some(g => !g.passed)).toBe(true);
    expect(data.iterations[0].gateResultsAfter!.every(g => g.passed)).toBe(true);

    // The branch holds the fix commit; the starting branch is untouched and clean.
    expect(git(fx.dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
    expect(git(fx.dir, 'diff', '--name-only', 'main', data.branch!)).toBe('src/index.ts');
    expect(git(fx.dir, 'show', `${data.branch}:src/index.ts`)).toContain('add(1, 2)');

    // The real SDK request: structured output, the default model, auth, and the failing entry.
    expect(stub.requests).toHaveLength(1);
    const { headers, body } = stub.requests[0];
    expect(headers['x-api-key']).toBe('sk-ant-test-key');
    expect(body.model).toBe('claude-opus-5-5');
    expect(body.output_config).toMatchObject({ format: { type: 'json_schema' } });
    expect(JSON.stringify(body.output_config)).toContain('"patch"');
    expect(body.fallbacks).toBe('default');
    expect(body.thinking).toBeUndefined();
    expect(JSON.stringify(body.messages)).toContain('src/index.ts:3:');
    expect(JSON.stringify(body.system)).toMatch(/NEVER modify test files/);
  }, 240_000);

  it('a provider patch that edits a test file is rejected: exit 1, tree untouched, branch removed', async () => {
    fx = createFixture(FAST_GATES);
    const testPatch =
      'diff --git a/tests/add.test.ts b/tests/add.test.ts\n--- a/tests/add.test.ts\n+++ b/tests/add.test.ts\n@@ -5,3 +5,3 @@\n   it(\'adds\', () => {\n-    expect(add(1, 2)).toBe(3);\n+    expect(add(1, 2)).toBeTruthy();\n   });\n';
    stub = await startAnthropicStub(() => ({ patch: testPatch, explanation: 'relax the test' }));
    const r = await runCli(['fix', '--ci', '--json', '--max-iterations', '2'], fx.dir, {
      ...NO_PROVIDER_ENV,
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
      ANTHROPIC_BASE_URL: stub.url,
    });
    expect(r.status).toBe(1);
    const env = parseEnvelope(r.stdout);
    expect(env.ok).toBe(false);
    expect(env.error!.code).toBe('FIX_CI_GATES_RED');
    const details = fixCiResponseSchema.parse(env.error!.details);
    expect(details.verdict).toBe('red');
    expect(details.iterations).toHaveLength(2);
    expect(details.iterations[0].patch?.rejectedReason).toMatch(/test file/);
    expect(stub.requests).toHaveLength(2);
    expect(git(fx.dir, 'status', '--porcelain')).toBe('');
    expect(git(fx.dir, 'branch', '--format=%(refname:short)')).toBe('main');
  }, 240_000);

  it('an API failure is reported as provider-error (exit 1) with everything rolled back', async () => {
    fx = createFixture(FAST_GATES);
    const failing = http.createServer((_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    });
    await new Promise<void>(r => failing.listen(0, '127.0.0.1', () => r()));
    try {
      const { port } = failing.address() as { port: number };
      const r = await runCli(['fix', '--ci', '--json'], fx.dir, {
        ...NO_PROVIDER_ENV,
        ANTHROPIC_API_KEY: 'sk-bad',
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
      });
      expect(r.status).toBe(1);
      const env = parseEnvelope(r.stdout);
      expect(env.error!.code).toBe('FIX_CI_GATES_RED');
      expect(env.error!.details).toMatchObject({ outcome: 'provider-error', verdict: 'red' });
      expect(String(env.error!.message)).toMatch(/invalid x-api-key/);
      expect(git(fx.dir, 'branch', '--format=%(refname:short)')).toBe('main');
    } finally {
      await new Promise<void>(r => failing.close(() => r()));
    }
  }, 240_000);

  it('SIGINT mid-run kills the running gate, rolls the applied patch back, and restores the starting branch', async () => {
    const node = JSON.stringify(process.execPath);
    const gateScript = [
      "const fs = require('fs');",
      "const t = fs.readFileSync('src/index.ts', 'utf8');",
      'if (t.includes("\'2\'")) { console.error("src/index.ts(3,36): error TS2345: bad arg"); process.exit(1); }',
      'fs.writeFileSync(process.env.FIX_CI_MARKER, String(process.pid));',
      'setTimeout(() => {}, 60000);',
    ];
    fx = createFixture({
      '.re-shell/fix-ci.yaml': [
        'detect: false',
        'gates:',
        '  - name: typecheck',
        '    command:',
        `      - ${node}`,
        '      - -e',
        '      - |',
        ...gateScript.map(l => `        ${l}`),
        '  - name: test',
        `    command: [${node}, -e, "process.exit(0)"]`,
        '',
      ].join('\n'),
    });
    stub = await startAnthropicStub(() => ({ patch: TYPE_ERROR_FIX_PATCH, explanation: 'fix' }));
    const marker = path.join(path.dirname(fx.dir), `marker-${path.basename(fx.dir)}`);
    const { child, done } = startCli(['fix', '--ci', '--json'], fx.dir, {
      ...NO_PROVIDER_ENV,
      ANTHROPIC_API_KEY: 'sk-test',
      ANTHROPIC_BASE_URL: stub.url,
      FIX_CI_MARKER: marker,
    });
    try {
      // Wait until the patched tree is being re-evaluated (the gate wrote its marker and sleeps).
      for (let i = 0; i < 300 && !fs.existsSync(marker); i++) await sleep(100);
      expect(fs.existsSync(marker), 'gate never reached the post-patch evaluation').toBe(true);
      expect(git(fx.dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toMatch(/^re-shell\/fix-ci-/);
      expect(fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8')).toContain('add(1, 2)');
      const gatePid = Number(fs.readFileSync(marker, 'utf8'));

      child.kill('SIGINT');
      const result = await done;
      expect(result.status).toBe(130);

      expect(git(fx.dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
      expect(git(fx.dir, 'status', '--porcelain')).toBe('');
      expect(git(fx.dir, 'branch', '--format=%(refname:short)')).toBe('main');
      expect(fs.readFileSync(path.join(fx.dir, 'src/index.ts'), 'utf8')).toContain("add(1, '2')");
      await sleep(200);
      expect(isDead(gatePid)).toBe(true); // the gate process group was killed
    } finally {
      child.kill('SIGKILL');
      fs.rmSync(marker, { force: true });
    }
  }, 240_000);
});
