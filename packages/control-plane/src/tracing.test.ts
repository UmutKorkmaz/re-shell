import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { InMemorySpanExporter, type SpanExporter } from '@opentelemetry/sdk-trace-base';
import { SpanKind } from '@opentelemetry/api';
import { Tracing, currentTraceParent, parseTraceParent, loadTracingOptions } from './tracing.js';
import { STANDARD_SEED, startHarness } from './test-support/harness.js';
import { WorkerClient } from './worker/client.js';
import { DEFAULT_RUNNER_OPTIONS, runJob } from './worker/runner.js';

const parent = '00-11111111111111111111111111111111-2222222222222222-01';

describe('distributed tracing', () => {
  it('rejects ambiguous, oversized and zero W3C contexts', () => {
    expect(parseTraceParent(parent)?.traceId).toBe('11111111111111111111111111111111');
    for (const value of [undefined, `${parent},${parent}`, parent.replace(/1/g, 'A'), parent.replace(/1/g, '0'), parent.replace(/2/g, '0'), ` ${parent}`, `ff${parent.slice(2)}`]) {
      expect(parseTraceParent(value)).toBeUndefined();
    }
  });

  it('requires an explicit safe collector endpoint and valid bounded sampling', () => {
    expect(loadTracingOptions({}).ok).toBe(true);
    for (const endpoint of ['file:///tmp/traces', 'http://user:secret@localhost:4318/v1/traces', 'http://localhost/v1/traces?secret=x']) {
      expect(loadTracingOptions({ CONTROL_PLANE_TRACE_ENDPOINT: endpoint }).ok).toBe(false);
    }
    expect(loadTracingOptions({ CONTROL_PLANE_TRACE_ENDPOINT: 'http://127.0.0.1:4318/v1/traces', CONTROL_PLANE_TRACE_SAMPLE_RATIO: '2' }).ok).toBe(false);
  });

  it('isolates concurrent async traces and never records exception messages', async () => {
    const exporter = new InMemorySpanExporter();
    const tracer = new Tracing({ serviceName: 'test', sampleRatio: 1 }, exporter);
    try {
      const ids = await Promise.all([1, 2].map(() => tracer.run('job', {}, async () => {
        const before = currentTraceParent();
        await new Promise((resolve) => setTimeout(resolve, 2));
        expect(currentTraceParent()).toBe(before);
        return before;
      })));
      expect(ids[0]).not.toBe(ids[1]);
      expect(currentTraceParent()).toBeUndefined();
      await expect(tracer.run('failure', {}, () => { throw new Error('bearer-secret'); })).rejects.toThrow('bearer-secret');
      await tracer.flush();
      expect(JSON.stringify(exporter.getFinishedSpans().map((s) => ({ name: s.name, attributes: s.attributes, events: s.events })))).not.toContain('bearer-secret');
      expect(exporter.getFinishedSpans().find((s) => s.name === 'failure')?.status.code).toBe(2);
    } finally { await tracer.close(); }
  });

  it('persists enqueue context and propagates worker calls without leaking payloads', async () => {
    const exporter = new InMemorySpanExporter();
    const tracer = new Tracing({ serviceName: 'test', sampleRatio: 1 }, exporter);
    const h = await startHarness({ seed: STANDARD_SEED, serverOptions: { tracing: tracer } });
    try {
      const response = await h.request('POST', '/tenants/acme/workspaces/main/commands', {
        token: h.userToken('alice'), headers: { traceparent: parent }, body: { commandId: 'workspace.summary', params: {} },
      });
      expect(response.status).toBe(202);
      const job = h.jobs.get('acme', response.json.data.job.id);
      expect(job?.traceParent).toMatch(/^00-11111111111111111111111111111111-/);
      expect(response.json.data.job.traceParent).toBeUndefined();
      const client = new WorkerClient(h.url, h.workerToken('trace-worker', 'acme'), fetch, tracer);
      const claimed = await client.claim(0);
      expect(claimed.kind).toBe('ok');
      if (claimed.kind !== 'ok') return;
      expect(claimed.data.claim?.job.traceParent).toBe(job?.traceParent);
      await tracer.run('re-shell.job.execute', { 're_shell.command': 'workspace.summary' }, async () => {
        await client.postOutput(response.json.data.job.id, []);
      }, job?.traceParent);
      await tracer.flush();
      const spans = exporter.getFinishedSpans();
      const execute = spans.find((s) => s.name === 're-shell.job.execute');
      expect(execute?.spanContext().traceId).toBe('11111111111111111111111111111111');
      const posts = spans.filter((s) => s.kind === SpanKind.SERVER && s.name.includes('/worker/jobs/:jobId/output'));
      expect(posts).toHaveLength(1);
      expect(posts[0].spanContext().traceId).toBe(execute?.spanContext().traceId);
      const wire = JSON.stringify(spans.map((s) => ({ name: s.name, attributes: s.attributes, events: s.events })));
      expect(wire).not.toContain(h.userToken('alice'));
      expect(wire).not.toContain('acme');
      expect(wire).not.toContain(response.json.data.job.id);
    } finally { await h.close(); await tracer.close(); }
  });

  it('reports exporter failure once without secrets or changing job results and shutdown', async () => {
    const logger = vi.fn();
    const exporter: SpanExporter = {
      export: (_spans, done) => done({ code: 1, error: new Error('collector-secret-token') }),
      shutdown: async () => { throw new Error('shutdown-secret-token'); },
    };
    const tracer = new Tracing({ serviceName: 'test', sampleRatio: 1 }, exporter, logger);
    const h = await startHarness({ seed: STANDARD_SEED, serverOptions: { tracing: tracer } });
    try {
      const queued = await h.request('POST', '/tenants/acme/workspaces/main/commands', {
        token: h.userToken('alice'), body: { commandId: 'workspace.summary' },
      });
      const client = new WorkerClient(h.url, h.workerToken('w', 'acme'), fetch, tracer);
      expect((await client.claim(0)).kind).toBe('ok');
      expect((await client.postExit(queued.json.data.job.id, { exitCode: 0 })).kind).toBe('ok');
      await tracer.flush();
      expect(h.jobs.get('acme', queued.json.data.job.id)?.status).toBe('succeeded');
      await expect(tracer.run('another', {}, () => 42)).resolves.toBe(42);
      await tracer.flush();
    } finally { await h.close(); await expect(tracer.close()).resolves.toBeUndefined(); }
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0][0]).toMatchObject({ level: 'warn', component: 'tracing' });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('secret');
  });

  it('marks worker HTTP failures and status without recording server bodies', async () => {
    const exporter = new InMemorySpanExporter();
    const tracer = new Tracing({ serviceName: 'test', sampleRatio: 1 }, exporter);
    const fetchFailure = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: { message: 'private-body' } }), { status: 503 }));
    try {
      const client = new WorkerClient('http://localhost', 'private-token', fetchFailure, tracer);
      expect((await client.claim(0)).kind).toBe('retry');
      await tracer.flush();
      const span = exporter.getFinishedSpans()[0];
      expect(span.status.code).toBe(2);
      expect(span.attributes['http.response.status_code']).toBe(503);
      expect(JSON.stringify(span.attributes)).not.toContain('private');
    } finally { await tracer.close(); }
  });

  it('marks a reported nonzero child exit as a failed job span', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-job-'));
    fs.mkdirSync(path.join(root, 'main'));
    const cli = path.join(root, 'cli.mjs'); fs.writeFileSync(cli, 'process.exit(7);');
    const exporter = new InMemorySpanExporter();
    const tracer = new Tracing({ serviceName: 'test', sampleRatio: 1 }, exporter);
    const h = await startHarness({ seed: STANDARD_SEED, serverOptions: { tracing: tracer } });
    try {
      const queued = await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: h.userToken('alice'), body: { commandId: 'workspace.summary' } });
      const client = new WorkerClient(h.url, h.workerToken('failed-job', 'acme'), fetch, tracer);
      const claim = await client.claim(0);
      if (claim.kind !== 'ok' || !claim.data.claim) throw new Error('Expected the queued job to be claimed.');
      await runJob(claim.data.claim, client, { ...DEFAULT_RUNNER_OPTIONS, workspaceRoot: root, cliBin: cli, tracing: tracer }, { latestPolicy: () => undefined, log: () => undefined }, new AbortController().signal);
      expect(h.jobs.get('acme', queued.json.data.job.id)).toMatchObject({ status: 'failed', exitCode: 7 });
      await tracer.flush();
      expect(exporter.getFinishedSpans().find((span) => span.name === 're-shell.job.execute')?.status.code).toBe(2);
    } finally { await h.close(); await tracer.close(); fs.rmSync(root, { recursive: true, force: true }); }
  });
});
