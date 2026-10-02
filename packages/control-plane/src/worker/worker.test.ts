import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EventTap } from '../test-support/event-tap.js';
import { STANDARD_SEED, startHarness, type Harness } from '../test-support/harness.js';
import { Worker, type WorkerEvent, type WorkerOptions } from './worker.js';

/**
 * Worker behaviour against a REAL control-plane server and REAL child processes.
 * The "CLI" is a small Node script that reports how it was invoked, so these
 * tests can prove argv, cwd, environment and signal handling exactly.
 */

const FAKE_CLI = `
const args = process.argv.slice(2);
const out = (v) => process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v) + '\\n');
if (args[0] === 'templates' && args[1] === 'show' && args[2] === 'sleep') {
  process.stderr.write('sleeping\\n');
  process.on('SIGTERM', () => { process.stdout.write('got SIGTERM\\n'); process.exit(143); });
  setInterval(() => {}, 1000);
} else if (args[0] === 'templates' && args[1] === 'show' && args[2] === 'stubborn') {
  process.on('SIGTERM', () => { process.stdout.write('ignoring SIGTERM\\n'); });
  setInterval(() => {}, 1000);
} else if (args[0] === 'scorecard') {
  process.stderr.write('scorecard failed\\n');
  process.exit(3);
} else if (args[0] === 'commands') {
  // Let the process end naturally: process.exit() can truncate large pipe output.
  for (let i = 0; i < 400; i += 1) out('line ' + i + ' ' + 'x'.repeat(200) + '\\n');
} else if (args[0] === 'templates' && args[1] === 'show' && args[2] === 'alternate') {
  let i = 0;
  const tick = () => {
    if (i >= 700) return;
    process.stdout.write('o' + i + ';');
    process.stderr.write('e' + i + ';');
    i += 1;
    setImmediate(tick);
  };
  tick();
} else if (args[0] === 'templates' && args[1] === 'show' && args[2] === 'unicode') {
  out('héllo wörld — 你好 🌍\\n');
  process.exit(0);
} else {
  out({
    argv: args,
    cwd: process.cwd(),
    hasPath: Boolean(process.env.PATH),
    workerToken: process.env.CONTROL_PLANE_WORKER_TOKEN ?? null,
    anyControlPlaneVar: Object.keys(process.env).some((k) => k.startsWith('CONTROL_PLANE')),
  });
}
`;

let h: Harness;
let tmp: string;
let workspaceRoot: string;
let cliBin: string;
const workers: Worker[] = [];
const taps: EventTap[] = [];

const SEED = {
  tenants: [
    {
      id: 'acme',
      name: 'Acme',
      allowedCommandIds: ['workspace.summary', 'doctor', 'scorecard', 'commands.list', 'templates.show', 'templates.list'],
    },
    STANDARD_SEED.tenants[1],
  ],
  workspaces: [
    {
      id: 'main',
      tenantId: 'acme',
      name: 'Main',
      allowedCommandIds: ['workspace.summary', 'doctor', 'scorecard', 'commands.list', 'templates.show', 'templates.list'],
    },
    { id: 'nodir', tenantId: 'acme', name: 'No dir', allowedCommandIds: ['doctor'] },
    { id: 'linked', tenantId: 'acme', name: 'Linked', allowedCommandIds: ['doctor'] },
    STANDARD_SEED.workspaces[1],
  ],
  members: STANDARD_SEED.members,
};

beforeEach(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-worker-'));
  workspaceRoot = path.join(tmp, 'workspaces');
  fs.mkdirSync(path.join(workspaceRoot, 'main', 'apps', 'web'), { recursive: true });
  const outside = path.join(tmp, 'outside');
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(workspaceRoot, 'linked'));
  cliBin = path.join(tmp, 'fake-cli.js');
  fs.writeFileSync(cliBin, FAKE_CLI);
  h = await startHarness({ seed: SEED });
});

afterEach(async () => {
  for (const w of workers.splice(0)) {
    await w.stop();
  }
  for (const t of taps.splice(0)) {
    t.close();
  }
  await h.close();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function startWorker(overrides: Partial<WorkerOptions> = {}, tenant = 'acme'): Worker {
  const worker = new Worker({
    controlPlaneUrl: h.url,
    token: h.workerToken(`w${workers.length + 1}`, tenant),
    tenantId: tenant,
    workspaceRoot,
    cliBin,
    claimWaitMs: 1000,
    runner: { outputFlushMs: 20, heartbeatMs: 300, killGraceMs: 300 },
    ...overrides,
  });
  workers.push(worker);
  worker.start();
  return worker;
}

const submit = (commandId: string, params?: Record<string, unknown>, workspace = 'main', user = 'bob') =>
  h.request('POST', `/tenants/acme/workspaces/${workspace}/commands`, {
    token: h.userToken(user),
    body: params ? { commandId, params } : { commandId },
  });

async function waitForJob(jobId: string, until: (status: string) => boolean = (s) => ['succeeded', 'failed', 'canceled'].includes(s), timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await h.request('GET', `/tenants/acme/jobs/${jobId}?outputLimit=1000`, { token: h.userToken('alice') });
    if (until(res.json.data.job.status)) {
      return res.json.data as { job: Record<string, any>; output: { chunks: Array<{ stream: string; data: string }> } }; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    if (Date.now() > deadline) {
      throw new Error(`job ${jobId} stuck in ${res.json.data.job.status}`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

const stdoutOf = (d: { output: { chunks: Array<{ stream: string; data: string }> } }, stream = 'stdout') =>
  d.output.chunks.filter((c) => c.stream === stream).map((c) => c.data).join('');

describe('running jobs', () => {
  it('builds argv from the shared registry, runs in the workspace dir, and reports the exit', async () => {
    startWorker();
    const job = (await submit('templates.list', { language: 'typescript', framework: 'react' })).json.data.job;
    const done = await waitForJob(job.id);
    expect(done.job).toMatchObject({ status: 'succeeded', exitCode: 0 });
    const report = JSON.parse(stdoutOf(done));
    expect(report.argv).toEqual(['templates', 'list', '--json', '--language', 'typescript', '--framework', 'react']);
    expect(report.cwd).toBe(fs.realpathSync(path.join(workspaceRoot, 'main')));
  });

  it('passes hostile-looking param values as ONE literal argv element (no shell)', async () => {
    startWorker();
    const marker = path.join(tmp, 'pwned');
    const evil = `$(touch ${marker}); touch ${marker} && echo \`id\``;
    const job = (await submit('templates.list', { language: evil })).json.data.job;
    const done = await waitForJob(job.id);
    expect(JSON.parse(stdoutOf(done)).argv).toEqual(['templates', 'list', '--json', '--language', evil]);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('applies the cwd param inside the workspace and refuses to leave it', async () => {
    startWorker();
    const ok = await waitForJob((await submit('workspace.summary', { cwd: 'apps/web' })).json.data.job.id);
    expect(JSON.parse(stdoutOf(ok)).cwd).toBe(fs.realpathSync(path.join(workspaceRoot, 'main', 'apps', 'web')));

    for (const cwd of ['..', '../..', tmp, '/', 'apps/../../..']) {
      const bad = await waitForJob((await submit('workspace.summary', { cwd })).json.data.job.id);
      expect(bad.job, cwd).toMatchObject({ status: 'failed', exitCode: null, errorCode: 'INVALID_PARAMS' });
      expect(bad.output.chunks).toEqual([]);
    }
  });

  it('fails (without spawning) when the workspace directory is missing or escapes the root', async () => {
    startWorker();
    const missing = await waitForJob((await submit('doctor', undefined, 'nodir')).json.data.job.id);
    expect(missing.job).toMatchObject({ status: 'failed', errorCode: 'WORKSPACE_UNAVAILABLE' });
    const linked = await waitForJob((await submit('doctor', undefined, 'linked')).json.data.job.id);
    expect(linked.job).toMatchObject({ status: 'failed', errorCode: 'WORKSPACE_UNAVAILABLE' });
  });

  it('scrubs the worker credentials from the child environment', async () => {
    const worker = startWorker();
    await worker.whenSynced();
    process.env.CONTROL_PLANE_WORKER_TOKEN = 'must-not-leak';
    try {
      const done = await waitForJob((await submit('doctor')).json.data.job.id);
      const report = JSON.parse(stdoutOf(done));
      expect(report.workerToken).toBeNull();
      expect(report.anyControlPlaneVar).toBe(false);
      expect(report.hasPath).toBe(true);
    } finally {
      delete process.env.CONTROL_PLANE_WORKER_TOKEN;
    }
  });

  it('streams stdout and stderr and records non-zero exit codes', async () => {
    startWorker();
    const done = await waitForJob((await submit('scorecard')).json.data.job.id);
    expect(done.job).toMatchObject({ status: 'failed', exitCode: 3 });
    expect(stdoutOf(done, 'stderr')).toBe('scorecard failed\n');
  });

  it('handles large output across many posts without loss or reordering', async () => {
    startWorker();
    const done = await waitForJob((await submit('commands.list')).json.data.job.id);
    expect(done.job.status).toBe('succeeded');
    const lines = stdoutOf(done).split('\n').filter(Boolean);
    expect(lines).toHaveLength(400);
    lines.forEach((line, i) => expect(line.startsWith(`line ${i} `)).toBe(true));
  });

  it('delivers hundreds of tiny alternating stdout/stderr writes without dropping any', async () => {
    startWorker({ runner: { outputFlushMs: 5, heartbeatMs: 300, killGraceMs: 300 } });
    const done = await waitForJob((await submit('templates.show', { id: 'alternate' })).json.data.job.id);
    expect(done.job).toMatchObject({ status: 'succeeded', exitCode: 0 });
    expect(done.job.errorMessage).toBeNull();
    const expected = (prefix: string) => Array.from({ length: 700 }, (_, i) => `${prefix}${i};`).join('');
    expect(stdoutOf(done, 'stdout')).toBe(expected('o'));
    expect(stdoutOf(done, 'stderr')).toBe(expected('e'));
  });

  it('does not corrupt multi-byte characters', async () => {
    startWorker();
    const done = await waitForJob((await submit('templates.show', { id: 'unicode' })).json.data.job.id);
    expect(stdoutOf(done)).toBe('héllo wörld — 你好 🌍\n');
  });

  it('reports a spawn failure as SPAWN_FAILED', async () => {
    startWorker({ cliBin: 'definitely-not-a-real-binary-xyz' });
    const done = await waitForJob((await submit('doctor')).json.data.job.id);
    expect(done.job).toMatchObject({ status: 'failed', errorCode: 'SPAWN_FAILED' });
  });

  it('runs jobs in parallel up to its concurrency', async () => {
    startWorker({ concurrency: 2 });
    const a = (await submit('templates.show', { id: 'sleep' })).json.data.job.id;
    const b = (await submit('templates.show', { id: 'sleep' })).json.data.job.id;
    await waitForJob(a, (s) => s === 'running');
    await waitForJob(b, (s) => s === 'running');
    await h.request('POST', `/tenants/acme/jobs/${a}/cancel`, { token: h.userToken('bob') });
    await h.request('POST', `/tenants/acme/jobs/${b}/cancel`, { token: h.userToken('bob') });
    expect((await waitForJob(a)).job.status).toBe('canceled');
    expect((await waitForJob(b)).job.status).toBe('canceled');
  });
});

describe('cancel, timeout and shutdown', () => {
  it('stops a running job on cancel (SIGTERM) and reports it as canceled', async () => {
    startWorker();
    const id = (await submit('templates.show', { id: 'sleep' })).json.data.job.id;
    await waitForJob(id, (s) => s === 'running');
    // Wait until the child is really up (it writes to stderr).
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && h.jobs.readOutput('acme', id, 0, 10).length === 0) {
      await new Promise((r) => setTimeout(r, 25));
    }
    await h.request('POST', `/tenants/acme/jobs/${id}/cancel`, { token: h.userToken('bob') });
    const done = await waitForJob(id);
    expect(done.job).toMatchObject({ status: 'canceled', errorCode: 'CANCELED' });
    expect(stdoutOf(done)).toContain('got SIGTERM');
  });

  it('escalates to SIGKILL for a process that ignores SIGTERM', async () => {
    startWorker();
    const id = (await submit('templates.show', { id: 'stubborn' })).json.data.job.id;
    await waitForJob(id, (s) => s === 'running');
    await new Promise((r) => setTimeout(r, 400)); // let it install its handler
    await h.request('POST', `/tenants/acme/jobs/${id}/cancel`, { token: h.userToken('bob') });
    const done = await waitForJob(id);
    expect(done.job.status).toBe('canceled');
  });

  it('kills a job that exceeds the job timeout', async () => {
    startWorker({ runner: { jobTimeoutMs: 400, outputFlushMs: 20, heartbeatMs: 300, killGraceMs: 300 } });
    const id = (await submit('templates.show', { id: 'sleep' })).json.data.job.id;
    const done = await waitForJob(id);
    expect(done.job).toMatchObject({ status: 'failed', errorCode: 'TIMEOUT' });
  });

  it('terminates running jobs on shutdown and reports WORKER_SHUTDOWN', async () => {
    const worker = startWorker();
    const id = (await submit('templates.show', { id: 'sleep' })).json.data.job.id;
    await waitForJob(id, (s) => s === 'running');
    await new Promise((r) => setTimeout(r, 300));
    await worker.stop();
    const done = await waitForJob(id);
    expect(done.job).toMatchObject({ status: 'failed', errorCode: 'WORKER_SHUTDOWN' });
  });
});

describe('policy enforcement and sync on the worker', () => {
  it('receives the policy snapshot and later updates over the event stream', async () => {
    const events: WorkerEvent[] = [];
    const worker = startWorker({ onEvent: (e) => events.push(e) });
    await worker.whenSynced();
    expect(worker.policy?.policyVersion).toBe(0);

    await h.request('PUT', '/tenants/acme/policy', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['doctor'], policyPack: 'recommended' },
    });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline && worker.policy?.policyVersion !== 1) {
      await new Promise((r) => setTimeout(r, 25));
    }
    expect(worker.policy).toMatchObject({ policyVersion: 1, policyPack: 'recommended', allowedCommandIds: ['doctor'] });
    expect(events.filter((e) => e.type === 'policy')).toHaveLength(2);
  });

  it('does not run a queued job whose command a policy change removed before it was claimed', async () => {
    // No worker yet: the job waits in the queue.
    const id = (await submit('doctor')).json.data.job.id;
    await h.request('PUT', '/tenants/acme/policy', { token: h.userToken('alice'), body: { allowedCommandIds: ['workspace.summary'] } });
    startWorker();
    const done = await waitForJob(id);
    expect(done.job).toMatchObject({ status: 'failed', errorCode: 'COMMAND_NOT_ALLOWED' });
    expect(done.output.chunks).toEqual([]);
  });

  it('refuses at the worker too: it checks the claim policy before spawning', async () => {
    // Simulate a control plane that (wrongly) hands out a command outside the policy it reports.
    const { runJob, DEFAULT_RUNNER_OPTIONS } = await import('./runner.js');
    const { WorkerClient } = await import('./client.js');
    const id = (await submit('doctor')).json.data.job.id;
    const claimed = await h.request('POST', '/worker/claim', { token: h.workerToken('rogue', 'acme'), body: {} });
    expect(claimed.json.data.claim.job.id).toBe(id);
    const tampered = {
      ...claimed.json.data.claim,
      policy: { ...claimed.json.data.claim.policy, effectiveCommandIds: ['workspace.summary'] },
    };
    const outcome = await runJob(
      tampered,
      new WorkerClient(h.url, h.workerToken('rogue', 'acme')),
      { ...DEFAULT_RUNNER_OPTIONS, workspaceRoot, cliBin },
      { latestPolicy: () => undefined, log: () => undefined },
      new AbortController().signal
    );
    expect(outcome).toEqual({ kind: 'reported', status: 'failed-before-spawn' });
    const done = await waitForJob(id);
    expect(done.job).toMatchObject({ status: 'failed', errorCode: 'COMMAND_NOT_ALLOWED' });
    expect(done.output.chunks).toEqual([]);
  });

  it('prefers a NEWER policy from the event stream over the one in the claim', async () => {
    const worker = startWorker();
    await worker.whenSynced();
    await h.request('PUT', '/tenants/acme/policy', { token: h.userToken('alice'), body: { allowedCommandIds: [] } });
    while (worker.policy?.policyVersion !== 1) {
      await new Promise((r) => setTimeout(r, 20));
    }
    const { runJob, DEFAULT_RUNNER_OPTIONS } = await import('./runner.js');
    const { WorkerClient } = await import('./client.js');
    // A claim that still carries version 0 (the state before the update).
    const id = h.jobs.enqueue({ tenantId: 'acme', workspaceId: 'main', commandId: 'doctor', params: {}, requestedBy: 'bob', now: Date.now(), maxQueued: 10 })!.id;
    h.jobs.tryClaim('acme', id, 'rogue', Date.now(), 60_000);
    const outcome = await runJob(
      {
        job: { id, tenantId: 'acme', workspaceId: 'main', commandId: 'doctor', params: {} },
        policy: { policyVersion: 0, policyPack: null, effectiveCommandIds: ['doctor'] },
        leaseExpiresAt: Date.now() + 60_000,
      },
      new WorkerClient(h.url, h.workerToken('rogue', 'acme')),
      { ...DEFAULT_RUNNER_OPTIONS, workspaceRoot, cliBin },
      { latestPolicy: () => worker.policy, log: () => undefined },
      new AbortController().signal
    );
    expect(outcome.kind).toBe('reported');
    expect(h.jobs.get('acme', id)).toMatchObject({ status: 'failed', errorCode: 'COMMAND_NOT_ALLOWED' });
  });

  it('stops itself when the control plane rejects its token', async () => {
    const events: WorkerEvent[] = [];
    const worker = startWorker({ token: 'not-a-valid-token', onEvent: (e) => events.push(e) });
    await worker.done();
    expect(worker.fatal).toMatch(/token|refused/);
    expect(events.some((e) => e.type === 'fatal')).toBe(true);
  });

  it('a worker bound to another tenant never receives acme jobs', async () => {
    const other = startWorker({}, 'globex');
    const id = (await submit('doctor')).json.data.job.id;
    await new Promise((r) => setTimeout(r, 1500));
    expect(h.jobs.get('acme', id)?.status).toBe('queued');
    expect(other.completed).toBe(0);
    // Its policy stream is globex's, never acme's.
    await other.whenSynced();
    expect(other.policy?.tenantId).toBe('globex');
  });
});

describe('job stream while a worker runs it', () => {
  it('streams output live over SSE and ends with the exit event', async () => {
    startWorker();
    const id = (await submit('scorecard')).json.data.job.id;
    const tap = await EventTap.open(`${h.url}/tenants/acme/jobs/${id}/stream`, h.userToken('bob'));
    taps.push(tap);
    await tap.waitForEvent('exit', 1, 10_000);
    await tap.waitForEnd();
    expect(tap.of('stderr').map((m) => JSON.parse(m.data).data).join('')).toBe('scorecard failed\n');
    expect(tap.json('exit')[0].job).toMatchObject({ status: 'failed', exitCode: 3 });
  });
});
