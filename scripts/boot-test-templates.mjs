#!/usr/bin/env node
/**
 * Boot check for generated backend templates.
 *
 * For each template this script does what a new user does, against the built
 * CLI, and verifies the result for real:
 *
 *   1. scaffold   `create test-<tpl> --backend <tpl> --yes` in a temp dir
 *   2. install    `pnpm --dir <app> install` (run from the repo root so the
 *                 repository's pinned pnpm is selected)
 *   3. build      the template's build step (skipped only for run-from-source
 *                 runtimes such as Bun, which have no build step)
 *   4. start      the template's real `start` script on a free PORT, with no
 *                 database and no Redis available (their hosts point at an
 *                 unroutable address, so any code that waits for a connection
 *                 before listening stalls instead of failing fast)
 *   5. ready      poll GET /health until it returns 200 (hard timeout, plus a
 *                 startup budget so slow-failing Redis/DB retries are caught)
 *   6. probe      functional routes (GraphQL introspection, API info, ...)
 *   7. shutdown   SIGTERM and require a clean exit (code 0) within a timeout
 *
 * Every template ends as PASS, FAIL or SKIP with a reason. Exit code is
 * non-zero if any template FAILs. A SKIP is only used when a required
 * toolchain is genuinely absent (for example `bun` for the Bun templates).
 *
 * Usage (from the repo root, after `pnpm -r build`):
 *   node scripts/boot-test-templates.mjs [options] [template ...]
 *
 * Options:
 *   --keep               keep the temp directory (prints its path)
 *   --ready-timeout <ms> hard limit for /health to return 200 (default 60000)
 *   --startup-budget <ms> max time from spawn to /health 200 (default 30000)
 *   --shutdown-timeout <ms> max time for a clean exit after SIGTERM (default 10000)
 *   --json               print the machine-readable result on the last line
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, createWriteStream } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const CLI_BIN = join(REPO_ROOT, 'packages/cli/dist/index.js');

const GRAPHQL_TYPENAME = {
  method: 'POST',
  path: '/graphql',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: '{__typename}' }),
  expectStatus: 200,
  expectJson: (json) => json && json.data && json.data.__typename === 'Query',
  describe: 'POST /graphql {__typename} -> data.__typename == "Query"',
};

/**
 * Per-template boot plan.
 *   runtime:   toolchain that must exist on PATH (else SKIP with a reason)
 *   build:     argv run through `pnpm --dir <app>` (null = no build step)
 *   startScript: package.json script run for the boot
 *   probes:    functional requests issued after /health is green
 */
const PLANS = {
  express: {
    runtime: 'node',
    build: ['run', 'build'],
    startScript: 'start',
    probes: [
      GRAPHQL_TYPENAME,
      {
        method: 'GET',
        path: '/api/v1/',
        expectStatus: 200,
        expectJson: (json) => json && typeof json.message === 'string',
        describe: 'GET /api/v1/ -> API info',
      },
    ],
  },
  fastify: {
    runtime: 'node',
    build: ['run', 'build'],
    startScript: 'start',
    probes: [GRAPHQL_TYPENAME],
  },
  koa: {
    runtime: 'node',
    build: ['run', 'build'],
    startScript: 'start',
    probes: [GRAPHQL_TYPENAME],
  },
  hono: {
    runtime: 'bun',
    build: ['run', 'build'],
    startScript: 'start',
    probes: [GRAPHQL_TYPENAME],
  },
  nestjs: {
    runtime: 'node',
    build: ['run', 'build'],
    startScript: 'start:prod',
    probes: [
      GRAPHQL_TYPENAME,
      {
        method: 'GET',
        path: '/health/ready',
        expectStatus: [200, 503],
        expectJson: (json) => json && (json.status === 'ok' || json.status === 'error'),
        describe: 'GET /health/ready -> reports database state (200 ok, or 503 error while the DB is down)',
      },
    ],
  },
  // Bun-native templates added alongside the five above.
  'elysia-bun': {
    runtime: 'bun',
    build: null,
    startScript: 'start',
    probes: [GRAPHQL_TYPENAME],
  },
  'bun-serve': {
    runtime: 'bun',
    build: null,
    startScript: 'start',
    probes: [
      {
        method: 'GET',
        path: '/api/v1/todos',
        expectStatus: 200,
        expectJson: (json) => json && Array.isArray(json.data),
        describe: 'GET /api/v1/todos -> { data: [] }',
      },
    ],
  },
  'trpc-bun': {
    runtime: 'bun',
    build: null,
    startScript: 'start',
    probes: [
      {
        method: 'GET',
        path: '/trpc/hello?input=%7B%22name%22%3A%22boot%22%7D',
        expectStatus: 200,
        expectJson: (json) => json && json.result && json.result.data && json.result.data.message === 'Hello, boot!',
        describe: 'GET /trpc/hello -> typed RPC query result',
      },
    ],
  },
};

const DEFAULT_TEMPLATES = ['express', 'fastify', 'koa', 'hono', 'nestjs'];

// TEST-NET-1 (RFC 5737) is reserved and never routed: connecting to it hangs or
// is rejected, but never succeeds. Every backing-service setting the templates
// read is pointed at it, so the app is booted with a database and Redis that
// are configured but unreachable, which is the harshest "missing service" case.
const UNREACHABLE = '192.0.2.1';
const UNREACHABLE_SERVICES_ENV = {
  DATABASE_URL: `postgresql://postgres:postgres@${UNREACHABLE}:5432/app`,
  DB_HOST: UNREACHABLE,
  REDIS_URL: `redis://${UNREACHABLE}:6379`,
  REDIS_HOST: UNREACHABLE,
};

function parseArgs(argv) {
  const opts = {
    keep: false,
    json: false,
    readyTimeout: 60000,
    startupBudget: 30000,
    shutdownTimeout: 10000,
    templates: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const num = () => {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n <= 0) {
        console.error(`Invalid value for ${a}`);
        process.exit(2);
      }
      return n;
    };
    if (a === '--keep') opts.keep = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--ready-timeout') opts.readyTimeout = num();
    else if (a === '--startup-budget') opts.startupBudget = num();
    else if (a === '--shutdown-timeout') opts.shutdownTimeout = num();
    else if (a.startsWith('--')) {
      console.error(`Unknown option: ${a}`);
      process.exit(2);
    } else opts.templates.push(a);
  }
  if (opts.templates.length === 0) opts.templates = DEFAULT_TEMPLATES;
  return opts;
}

function hasCommand(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { stdio: 'ignore' });
  return r.status === 0;
}

function tail(file, lines = 25) {
  try {
    const all = readFileSync(file, 'utf8').split('\n');
    return all.slice(-lines).join('\n');
  } catch {
    return '(no log)';
  }
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolvePort(port));
    });
  });
}

/** Run a command to completion, logging combined output to a file. */
function run(cmd, args, { cwd, env, logFile, timeoutMs }) {
  return new Promise((resolveRun) => {
    const out = createWriteStream(logFile, { flags: 'a' });
    out.write(`$ ${cmd} ${args.join(' ')}\n`);
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(out, { end: false });
    child.stderr.pipe(out, { end: false });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      out.write(`spawn error: ${err.message}\n`);
      out.end();
      resolveRun({ code: 127, timedOut: false });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      out.end();
      resolveRun({ code: code ?? 1, timedOut });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function httpRequest(port, probe, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`http://127.0.0.1:${port}${probe.path}`, {
      method: probe.method || 'GET',
      headers: probe.headers,
      body: probe.body,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, text, json };
  } finally {
    clearTimeout(t);
  }
}

async function bootTemplate(tpl, workRoot, opts) {
  const plan = PLANS[tpl];
  const result = { template: tpl, status: 'FAIL', reason: '', steps: [] };
  const step = (name, detail) => {
    result.steps.push(detail ? `${name}: ${detail}` : name);
    console.log(`  ✓ ${name}${detail ? ` (${detail})` : ''}`);
  };
  const fail = (reason, logFile) => {
    result.status = 'FAIL';
    result.reason = reason;
    console.log(`  ✗ FAIL: ${reason}`);
    if (logFile) console.log(tail(logFile).replace(/^/gm, '    | '));
    return result;
  };

  if (!plan) {
    return fail(`no boot plan defined for template "${tpl}" (add one to PLANS in scripts/boot-test-templates.mjs)`);
  }
  if (!hasCommand(plan.runtime)) {
    result.status = 'SKIP';
    result.reason = `required runtime "${plan.runtime}" is not installed`;
    console.log(`  SKIP: ${result.reason}`);
    return result;
  }

  const dir = join(workRoot, tpl);
  const logDir = join(workRoot, 'logs');
  const log = (name) => join(logDir, `${tpl}-${name}.log`);
  const { mkdirSync } = await import('node:fs');
  mkdirSync(dir, { recursive: true });
  mkdirSync(logDir, { recursive: true });
  const baseEnv = { ...process.env };
  // The generated project must boot with nothing but PORT set. Make sure an
  // inherited environment from the caller cannot mask a missing default.
  for (const k of ['DATABASE_URL', 'REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'DB_HOST', 'DB_PORT', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'NODE_ENV', 'PORT', 'HOST']) {
    delete baseEnv[k];
  }

  // 1. scaffold (from the temp dir, not the repo: inside the monorepo the CLI
  // switches to its interactive workspace flow).
  const scaffoldLog = log('scaffold');
  const scaffold = await run('node', [CLI_BIN, 'create', `test-${tpl}`, '--backend', tpl, '--yes'], {
    cwd: dir,
    env: baseEnv,
    logFile: scaffoldLog,
    timeoutMs: 180000,
  });
  if (scaffold.code !== 0 || !readFileSync(scaffoldLog, 'utf8').includes('Scaffolded')) {
    return fail('scaffold failed', scaffoldLog);
  }
  const projectDir = join(dir, `test-${tpl}`);
  let appDir = join(projectDir, 'apps', `test-${tpl}`);
  if (existsSync(join(projectDir, 'apps', `test-${tpl}-api`))) appDir = join(projectDir, 'apps', `test-${tpl}-api`);
  if (!existsSync(join(appDir, 'package.json'))) return fail(`generated app has no package.json at ${appDir}`);
  step('scaffold', appDir.replace(workRoot, '<tmp>'));

  // 2. install — from the repo root so the pinned pnpm is selected.
  const installLog = log('install');
  const install = await run('pnpm', ['--dir', appDir, 'install'], {
    cwd: REPO_ROOT,
    env: { ...baseEnv, CI: 'true' },
    logFile: installLog,
    timeoutMs: 600000,
  });
  if (install.code !== 0) return fail(install.timedOut ? 'dependency install timed out' : 'dependency install failed', installLog);
  step('install');

  // 3. build
  if (plan.build) {
    const buildLog = log('build');
    const build = await run('pnpm', ['--dir', appDir, ...plan.build], {
      cwd: REPO_ROOT,
      env: baseEnv,
      logFile: buildLog,
      timeoutMs: 300000,
    });
    if (build.code !== 0) return fail('build failed', buildLog);
    step('build');
  } else {
    step('build', 'no build step: runs from source');
  }

  // 4. start the real package.json script
  const pkg = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8'));
  const startCmd = pkg.scripts && pkg.scripts[plan.startScript];
  if (!startCmd) return fail(`package.json has no "${plan.startScript}" script`);
  const port = await freePort();
  const runLog = log('run');
  const out = createWriteStream(runLog);
  const binPath = `${join(appDir, 'node_modules', '.bin')}:${baseEnv.PATH ?? ''}`;
  const startedAt = Date.now();
  const child = spawn('sh', ['-c', `exec ${startCmd}`], {
    cwd: appDir,
    env: { ...baseEnv, ...UNREACHABLE_SERVICES_ENV, PORT: String(port), PATH: binPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(out, { end: false });
  child.stderr.pipe(out, { end: false });
  let exited = null;
  const exitPromise = new Promise((r) => {
    child.on('close', (code, signal) => {
      exited = { code, signal };
      r(exited);
    });
  });
  const killChild = () => {
    if (!exited) child.kill('SIGKILL');
  };
  process.once('exit', killChild);

  try {
    // 5. wait for /health
    let ready = false;
    const deadline = startedAt + opts.readyTimeout;
    while (Date.now() < deadline) {
      if (exited) break;
      try {
        const r = await httpRequest(port, { path: '/health' }, 2000);
        if (r.status === 200) {
          ready = true;
          break;
        }
      } catch {
        // not listening yet
      }
      await sleep(200);
    }
    if (exited && !ready) {
      return fail(`process exited before /health was ready (code=${exited.code} signal=${exited.signal})`, runLog);
    }
    if (!ready) return fail(`/health did not return 200 within ${opts.readyTimeout}ms`, runLog);
    const readyMs = Date.now() - startedAt;
    if (readyMs > opts.startupBudget) {
      return fail(`startup took ${readyMs}ms, over the ${opts.startupBudget}ms budget (a missing DB/Redis must not stall startup)`, runLog);
    }
    step('start', `/health 200 after ${readyMs}ms on :${port}`);

    // 6. probes
    for (const probe of plan.probes) {
      let r;
      try {
        r = await httpRequest(port, probe);
      } catch (err) {
        return fail(`probe failed: ${probe.describe}: ${err.message}`, runLog);
      }
      const allowed = Array.isArray(probe.expectStatus) ? probe.expectStatus : [probe.expectStatus];
      if (!allowed.includes(r.status)) {
        return fail(`probe failed: ${probe.describe}: got HTTP ${r.status}, body ${r.text.slice(0, 200)}`, runLog);
      }
      if (probe.expectJson && !probe.expectJson(r.json)) {
        return fail(`probe failed: ${probe.describe}: unexpected body ${r.text.slice(0, 200)}`, runLog);
      }
      step('probe', probe.describe);
    }

    // 7. SIGTERM -> clean exit
    const termAt = Date.now();
    child.kill('SIGTERM');
    const outcome = await Promise.race([exitPromise, sleep(opts.shutdownTimeout).then(() => null)]);
    if (!outcome) return fail(`did not exit within ${opts.shutdownTimeout}ms of SIGTERM`, runLog);
    if (outcome.code !== 0) {
      return fail(`unclean exit after SIGTERM (code=${outcome.code} signal=${outcome.signal})`, runLog);
    }
    step('shutdown', `clean exit 0 in ${Date.now() - termAt}ms`);

    result.status = 'PASS';
    return result;
  } finally {
    killChild();
    process.removeListener('exit', killChild);
    out.end();
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!existsSync(CLI_BIN)) {
    console.error(`Built CLI not found at ${CLI_BIN}. Run \`pnpm -r build\` first.`);
    process.exit(2);
  }
  const workRoot = mkdtempSync(join(tmpdir(), 'reshell-boot-'));
  const results = [];
  try {
    for (const tpl of opts.templates) {
      console.log(`\n━━━ Boot check: ${tpl} ━━━`);
      let result;
      try {
        result = await bootTemplate(tpl, workRoot, opts);
      } catch (err) {
        result = { template: tpl, status: 'FAIL', reason: `unexpected error: ${err && err.stack ? err.stack : err}`, steps: [] };
        console.log(`  ✗ FAIL: ${result.reason}`);
      }
      results.push(result);
      // Free disk early: node_modules per template is large.
      rmSync(join(workRoot, tpl), { recursive: true, force: true });
    }
  } finally {
    if (opts.keep) console.log(`\nKept work dir: ${workRoot}`);
    else rmSync(workRoot, { recursive: true, force: true });
  }

  const count = (s) => results.filter((r) => r.status === s).length;
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const r of results) {
    console.log(`  ${r.status.padEnd(4)}  ${r.template}${r.reason ? `  -- ${r.reason}` : ''}`);
  }
  console.log(`RESULTS: ${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped`);
  if (opts.json) console.log(JSON.stringify({ ok: count('FAIL') === 0, results }));
  process.exit(count('FAIL') > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
