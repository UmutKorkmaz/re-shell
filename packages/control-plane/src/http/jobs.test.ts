import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MAX_JOB_OUTPUT_BYTES } from '../db/sqlite-jobs.js';
import { EventTap } from '../test-support/event-tap.js';
import { STANDARD_SEED, startHarness, type Harness } from '../test-support/harness.js';

let h: Harness;
const taps: EventTap[] = [];

beforeEach(async () => {
  h = await startHarness({ seed: STANDARD_SEED });
});
afterEach(async () => {
  for (const tap of taps.splice(0)) {
    tap.close();
  }
  await h.close();
});

const submit = (user = 'bob', commandId = 'workspace.summary', params: unknown = undefined) =>
  h.request('POST', '/tenants/acme/workspaces/main/commands', {
    token: h.userToken(user),
    body: params === undefined ? { commandId } : { commandId, params },
  });

const claim = (worker = 'w1', tenant = 'acme', waitMs = 0) =>
  h.request('POST', '/worker/claim', { token: h.workerToken(worker, tenant), body: { waitMs } });

const output = (jobId: string, chunks: Array<{ stream: 'stdout' | 'stderr'; data: string }>, worker = 'w1', tenant = 'acme') =>
  h.request('POST', `/worker/jobs/${jobId}/output`, { token: h.workerToken(worker, tenant), body: { chunks } });

const exit = (jobId: string, body: unknown, worker = 'w1', tenant = 'acme') =>
  h.request('POST', `/worker/jobs/${jobId}/exit`, { token: h.workerToken(worker, tenant), body });

describe('submitting and reading jobs', () => {
  it('queues an authorized command as a job (202) and never runs it itself', async () => {
    const res = await submit('bob', 'workspace.summary', { cwd: 'apps' });
    expect(res.status).toBe(202);
    expect(res.json.data.job).toMatchObject({
      tenantId: 'acme',
      workspaceId: 'main',
      commandId: 'workspace.summary',
      params: { cwd: 'apps' },
      requestedBy: 'bob',
      status: 'queued',
      exitCode: null,
    });
    const id = res.json.data.job.id;
    const got = await h.request('GET', `/tenants/acme/jobs/${id}`, { token: h.userToken('alice') });
    expect(got.status).toBe(200);
    expect(got.json.data.job.status).toBe('queued');
    expect(got.json.data.output).toEqual({ chunks: [], nextSeq: 0 });
    const list = await h.request('GET', '/tenants/acme/jobs', { token: h.userToken('bob') });
    expect(list.json.data.jobs.map((j: { id: string }) => j.id)).toEqual([id]);
  });

  it('refuses viewers, unknown commands and not-allowed commands before queueing anything', async () => {
    expect((await submit('vera')).status).toBe(403);
    expect((await submit('bob', 'analyze')).json.error.code).toBe('COMMAND_NOT_ALLOWED'); // not in the ceiling
    expect((await submit('bob', 'workspace.graph')).json.error.code).toBe('COMMAND_NOT_ALLOWED'); // real command, not granted
    expect((await submit('bob', 'definitely-not-a-command')).status).toBe(400);
    expect(h.jobs.list('acme', { limit: 10 })).toEqual([]);
  });

  it('viewers cannot read jobs; other tenants cannot see them at all', async () => {
    const id = (await submit()).json.data.job.id;
    expect((await h.request('GET', `/tenants/acme/jobs/${id}`, { token: h.userToken('vera') })).status).toBe(403);
    expect((await h.request('GET', '/tenants/acme/jobs', { token: h.userToken('vera') })).status).toBe(403);
    // Another tenant's admin, naming their OWN tenant with acme's job id: indistinguishable from absent.
    const foreign = await h.request('GET', `/tenants/globex/jobs/${id}`, { token: h.userToken('gina') });
    const absent = await h.request('GET', `/tenants/globex/jobs/${randomUUID()}`, { token: h.userToken('gina') });
    expect(foreign.status).toBe(404);
    expect(foreign.json.error.code).toBe('JOB_NOT_FOUND');
    expect(foreign.json.error.message).toBe(absent.json.error.message);
    // Naming acme directly is simply forbidden.
    expect((await h.request('GET', `/tenants/acme/jobs/${id}`, { token: h.userToken('gina') })).status).toBe(403);
    expect((await h.request('GET', '/tenants/globex/jobs', { token: h.userToken('gina') })).json.data.jobs).toEqual([]);
  });

  it('rejects malformed job ids', async () => {
    const res = await h.request('GET', '/tenants/acme/jobs/not-a-uuid', { token: h.userToken('bob') });
    expect(res.status).toBe(400);
  });
});

describe('worker protocol', () => {
  it('authenticates workers and keeps worker and user credentials apart', async () => {
    const jobId = (await submit()).json.data.job.id;
    expect((await h.request('POST', '/worker/claim', { body: {} })).status).toBe(401);
    expect((await h.request('POST', '/worker/claim', { token: h.userToken('alice'), body: {} })).status).toBe(401);
    expect((await h.request('GET', '/tenants/acme/jobs', { token: h.workerToken('w1', 'acme') })).status).toBe(401);
    expect((await h.request('POST', `/worker/jobs/${jobId}/exit`, { token: h.userToken('bob'), body: { exitCode: 0 } })).status).toBe(401);
  });

  it('a worker only ever sees its own tenant queue', async () => {
    const jobId = (await submit()).json.data.job.id;
    const wrongTenant = await claim('w9', 'globex');
    expect(wrongTenant.status).toBe(200);
    expect(wrongTenant.json.data.claim).toBeNull();
    expect(h.jobs.get('acme', jobId)?.status).toBe('queued');

    const right = await claim('w1', 'acme');
    expect(right.json.data.claim.job).toMatchObject({
      id: jobId,
      tenantId: 'acme',
      workspaceId: 'main',
      commandId: 'workspace.summary',
    });
    expect(right.json.data.claim.policy).toMatchObject({
      policyVersion: 0,
      effectiveCommandIds: ['workspace.summary', 'doctor'],
    });
    // A claimed job is not handed out twice.
    expect((await claim('w2', 'acme')).json.data.claim).toBeNull();
  });

  it('runs a job through claim, output and exit, and exposes it by polling', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    const o1 = await output(jobId, [{ stream: 'stdout', data: 'hello ' }, { stream: 'stderr', data: 'warn\n' }]);
    expect(o1.json.data).toEqual({ cancelRequested: false, truncated: false });
    await output(jobId, [{ stream: 'stdout', data: 'world\n' }]);

    const mid = await h.request('GET', `/tenants/acme/jobs/${jobId}`, { token: h.userToken('bob') });
    expect(mid.json.data.job.status).toBe('running');
    expect(mid.json.data.output.chunks.map((c: { stream: string; data: string }) => `${c.stream}:${c.data}`)).toEqual([
      'stdout:hello ',
      'stderr:warn\n',
      'stdout:world\n',
    ]);

    const done = await exit(jobId, { exitCode: 0 });
    expect(done.json.data.job).toMatchObject({ status: 'succeeded', exitCode: 0 });
    const final = await h.request('GET', `/tenants/acme/jobs/${jobId}?afterSeq=2`, { token: h.userToken('bob') });
    expect(final.json.data.job.status).toBe('succeeded');
    expect(final.json.data.output).toEqual({
      chunks: [expect.objectContaining({ seq: 3, data: 'world\n' })],
      nextSeq: 3,
    });
  });

  it('records a non-zero exit as failed with its exit code', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    const res = await exit(jobId, { exitCode: 2 });
    expect(res.json.data.job).toMatchObject({ status: 'failed', exitCode: 2 });
  });

  it('records worker-side failures with their error code', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    const res = await exit(jobId, { exitCode: null, errorCode: 'WORKSPACE_UNAVAILABLE', errorMessage: 'no such dir' });
    expect(res.json.data.job).toMatchObject({ status: 'failed', exitCode: null, errorCode: 'WORKSPACE_UNAVAILABLE' });
  });

  it("a worker cannot touch another worker's job, another tenant's job, or a finished job", async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim('w1', 'acme');
    for (const [worker, tenant] of [['w2', 'acme'], ['w1', 'globex']] as const) {
      expect((await output(jobId, [{ stream: 'stdout', data: 'x' }], worker, tenant)).status).toBe(404);
      expect((await exit(jobId, { exitCode: 0 }, worker, tenant)).status).toBe(404);
    }
    expect(h.jobs.get('acme', jobId)?.status).toBe('running');
    expect((await exit(jobId, { exitCode: 0 })).status).toBe(200);
    // Replays after completion are refused too.
    expect((await exit(jobId, { exitCode: 1 })).status).toBe(404);
    expect((await output(jobId, [{ stream: 'stdout', data: 'late' }])).status).toBe(404);
    expect(h.jobs.get('acme', jobId)).toMatchObject({ status: 'succeeded', exitCode: 0 });
  });

  it('validates worker bodies strictly', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    expect((await output(jobId, [{ stream: 'stdin' as never, data: 'x' }])).status).toBe(400);
    expect((await exit(jobId, { exitCode: 'zero' })).status).toBe(400);
    expect((await exit(jobId, { exitCode: 0, status: 'succeeded' })).status).toBe(400);
    expect((await exit(jobId, { exitCode: 0, errorCode: 'lower case' })).status).toBe(400);
    expect((await h.request('POST', '/worker/jobs/nope/exit', { token: h.workerToken('w1', 'acme'), body: { exitCode: 0 } })).status).toBe(400);
    expect((await h.request('POST', '/worker/claim', { token: h.workerToken('w1', 'acme'), body: { waitMs: 99999 } })).status).toBe(400);
  });

  it('caps stored output per job and flags truncation', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    const block = 'x'.repeat(64 * 1024);
    const chunks = Array.from({ length: 12 }, () => ({ stream: 'stdout' as const, data: block })); // ~768 KiB per post
    let truncated = false;
    for (let i = 0; i < 8 && !truncated; i += 1) {
      const res = await output(jobId, chunks);
      expect(res.status).toBe(200);
      truncated = res.json.data.truncated;
    }
    expect(truncated).toBe(true);
    const job = h.jobs.get('acme', jobId)!;
    expect(job.outputTruncated).toBe(true);
    expect(job.outputBytes).toBe(MAX_JOB_OUTPUT_BYTES);
  });

  it('enforces the worker body limit with 413', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    const big = JSON.stringify({ chunks: [{ stream: 'stdout', data: 'x'.repeat(1024 * 1024 + 10) }] });
    const res = await h.request('POST', `/worker/jobs/${jobId}/output`, { token: h.workerToken('w1', 'acme'), rawBody: big });
    expect(res.status).toBe(413);
  });
});

describe('streaming job status (SSE)', () => {
  it('streams live output and ends with the exit event', async () => {
    const jobId = (await submit()).json.data.job.id;
    const tap = await EventTap.open(`${h.url}/tenants/acme/jobs/${jobId}/stream`, h.userToken('bob'));
    taps.push(tap);
    await tap.waitForEvent('status');
    expect(tap.json('status')[0].job.status).toBe('queued');

    await claim();
    await tap.waitFor((m) => m.some((x) => x.event === 'status' && JSON.parse(x.data).job.status === 'running'), 4000, 'running status');
    await output(jobId, [{ stream: 'stdout', data: 'line 1\n' }]);
    await tap.waitForEvent('stdout');
    await output(jobId, [{ stream: 'stderr', data: 'oops\n' }, { stream: 'stdout', data: 'line 2\n' }]);
    await exit(jobId, { exitCode: 0 });

    await tap.waitForEvent('exit');
    await tap.waitForEnd();
    expect(tap.of('stdout').map((m) => JSON.parse(m.data).data)).toEqual(['line 1\n', 'line 2\n']);
    expect(tap.of('stderr').map((m) => JSON.parse(m.data).data)).toEqual(['oops\n']);
    expect(tap.json('exit')[0].job).toMatchObject({ status: 'succeeded', exitCode: 0 });
    // Output events carry resumable ids.
    expect(tap.of('stdout').map((m) => m.id)).toEqual(['1', '3']);
  });

  it('replays a finished job from the start, or from a cursor, then ends', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    await output(jobId, [{ stream: 'stdout', data: 'a' }, { stream: 'stdout', data: 'b' }, { stream: 'stdout', data: 'c' }]);
    await exit(jobId, { exitCode: 0 });

    const full = await EventTap.open(`${h.url}/tenants/acme/jobs/${jobId}/stream`, h.userToken('alice'));
    taps.push(full);
    await full.waitForEnd();
    expect(full.of('stdout').map((m) => JSON.parse(m.data).data)).toEqual(['a', 'b', 'c']);
    expect(full.of('exit')).toHaveLength(1);

    const resumed = await EventTap.open(`${h.url}/tenants/acme/jobs/${jobId}/stream`, h.userToken('alice'), '2');
    taps.push(resumed);
    await resumed.waitForEnd();
    expect(resumed.of('stdout').map((m) => JSON.parse(m.data).data)).toEqual(['c']);
  });

  it('is operator-only and tenant-scoped', async () => {
    const jobId = (await submit()).json.data.job.id;
    expect((await EventTap.refused(`${h.url}/tenants/acme/jobs/${jobId}/stream`, h.userToken('vera'))).status).toBe(403);
    expect((await EventTap.refused(`${h.url}/tenants/acme/jobs/${jobId}/stream`, h.userToken('gina'))).status).toBe(403);
    expect((await EventTap.refused(`${h.url}/tenants/globex/jobs/${jobId}/stream`, h.userToken('gina'))).status).toBe(404);
    expect((await EventTap.refused(`${h.url}/tenants/acme/jobs/${jobId}/stream`, 'nope')).status).toBe(401);
  });

  it('ends the stream of a user who loses operator access', async () => {
    const jobId = (await submit()).json.data.job.id;
    const tap = await EventTap.open(`${h.url}/tenants/acme/jobs/${jobId}/stream`, h.userToken('bob'));
    taps.push(tap);
    await tap.waitForEvent('status');
    await h.request('PUT', '/tenants/acme/members/bob', { token: h.userToken('alice'), body: { role: 'viewer' } });
    await tap.waitForEvent('revoked');
    await tap.waitForEnd();
  });
});

describe('cancelling', () => {
  it('cancels a queued job immediately', async () => {
    const jobId = (await submit()).json.data.job.id;
    const res = await h.request('POST', `/tenants/acme/jobs/${jobId}/cancel`, { token: h.userToken('bob') });
    expect(res.status).toBe(200);
    expect(res.json.data.job).toMatchObject({ status: 'canceled', errorCode: 'CANCELED' });
    expect((await claim()).json.data.claim).toBeNull();
    expect((await h.request('POST', `/tenants/acme/jobs/${jobId}/cancel`, { token: h.userToken('bob') })).status).toBe(409);
  });

  it('flags a running job so its worker can stop it, and only accepts a real cancel', async () => {
    const jobId = (await submit()).json.data.job.id;
    await claim();
    // A worker cannot claim "canceled" for a job nobody canceled.
    const bogus = await exit(jobId, { exitCode: null, canceled: true });
    expect(bogus.json.data.job.status).toBe('failed');

    const second = (await submit()).json.data.job.id;
    await claim();
    expect((await output(second, [])).json.data.cancelRequested).toBe(false);
    const cancel = await h.request('POST', `/tenants/acme/jobs/${second}/cancel`, { token: h.userToken('bob') });
    expect(cancel.json.data.job).toMatchObject({ status: 'running', cancelRequested: true });
    expect((await output(second, [])).json.data.cancelRequested).toBe(true);
    const done = await exit(second, { exitCode: null, canceled: true });
    expect(done.json.data.job.status).toBe('canceled');
  });

  it('cannot cancel another tenant job', async () => {
    const jobId = (await submit()).json.data.job.id;
    expect((await h.request('POST', `/tenants/globex/jobs/${jobId}/cancel`, { token: h.userToken('gina') })).status).toBe(404);
    expect((await h.request('POST', `/tenants/acme/jobs/${jobId}/cancel`, { token: h.userToken('gina') })).status).toBe(403);
    expect(h.jobs.get('acme', jobId)?.status).toBe('queued');
  });
});

describe('enforcement at claim time', () => {
  it('fails a queued job whose command a policy change has since removed', async () => {
    const jobId = (await submit('bob', 'doctor')).json.data.job.id;
    await h.request('PUT', '/tenants/acme/policy', { token: h.userToken('alice'), body: { allowedCommandIds: ['workspace.summary'] } });

    const res = await claim();
    expect(res.json.data.claim).toBeNull();
    const job = h.jobs.get('acme', jobId)!;
    expect(job).toMatchObject({ status: 'failed', errorCode: 'COMMAND_NOT_ALLOWED' });
    const denies = h.audit.query({ tenantId: 'acme', action: 'job.claim', decision: 'deny' });
    expect(denies).toHaveLength(1);
    expect(denies[0]).toMatchObject({ userId: 'worker:w1', commandId: 'doctor', code: 'COMMAND_NOT_ALLOWED' });
  });

  it('fails a queued job whose requester has since lost the operator role', async () => {
    const jobId = (await submit('bob')).json.data.job.id;
    await h.request('PUT', '/tenants/acme/members/bob', { token: h.userToken('alice'), body: { role: 'viewer' } });
    expect((await claim()).json.data.claim).toBeNull();
    expect(h.jobs.get('acme', jobId)).toMatchObject({ status: 'failed', errorCode: 'REQUESTER_NOT_AUTHORIZED' });
  });

  it('still hands out later jobs that remain allowed', async () => {
    const denied = (await submit('bob', 'doctor')).json.data.job.id;
    const kept = (await submit('bob', 'workspace.summary')).json.data.job.id;
    await h.request('PUT', '/tenants/acme/policy', { token: h.userToken('alice'), body: { allowedCommandIds: ['workspace.summary'] } });
    const res = await claim();
    expect(res.json.data.claim.job.id).toBe(kept);
    expect(h.jobs.get('acme', denied)?.status).toBe('failed');
  });
});

describe('queueing behaviour', () => {
  it('long-polls and wakes as soon as a job is queued', async () => {
    const started = Date.now();
    const pending = claim('w1', 'acme', 10_000);
    await new Promise((r) => setTimeout(r, 200));
    const jobId = (await submit()).json.data.job.id;
    const res = await pending;
    expect(res.json.data.claim.job.id).toBe(jobId);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('a long-poll with nothing to do returns an empty claim after the wait', async () => {
    const started = Date.now();
    const res = await claim('w1', 'acme', 300);
    expect(res.json.data.claim).toBeNull();
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it('bounds the per-tenant queue', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, limits: { maxQueuedPerTenant: 2 } });
    expect((await submit()).status).toBe(202);
    expect((await submit()).status).toBe(202);
    const third = await submit();
    expect(third.status).toBe(429);
    expect(third.json.error.code).toBe('RATE_LIMITED');
  });

  it('fails a running job whose worker stopped heartbeating (lease reaper)', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, limits: { leaseMs: 80, reapIntervalMs: 30 } });
    const jobId = (await submit()).json.data.job.id;
    await claim();
    const deadline = Date.now() + 4000;
    while (h.jobs.get('acme', jobId)?.status === 'running' && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 40));
    }
    expect(h.jobs.get('acme', jobId)).toMatchObject({ status: 'failed', errorCode: 'WORKER_LOST' });
    // The dead worker's late report is ignored.
    expect((await exit(jobId, { exitCode: 0 })).status).toBe(404);
  });

  it('keeps a job alive while its worker heartbeats', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, limits: { leaseMs: 300, reapIntervalMs: 30 } });
    const jobId = (await submit()).json.data.job.id;
    await claim();
    for (let i = 0; i < 6; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      expect((await output(jobId, [])).status).toBe(200);
    }
    expect(h.jobs.get('acme', jobId)?.status).toBe('running');
  });
});
