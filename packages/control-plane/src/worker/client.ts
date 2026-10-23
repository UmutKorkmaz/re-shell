import type { ClaimedJob } from '../jobs.js';
import { SpanKind, SpanStatusCode, type Span } from '@opentelemetry/api';
import { currentTraceParent, type Tracing } from '../tracing.js';

/**
 * HTTP client for the worker side of the protocol (`/worker/*`). Every call
 * carries the worker's bearer token; results are the control plane's standard
 * envelopes, surfaced as typed outcomes so the worker loop can tell "try again"
 * from "you are no longer authorized" from "that job is not yours".
 */

export type WorkerCallResult<T> =
  | { kind: 'ok'; data: T }
  /** HTTP 401: the token is invalid or expired. Fatal for the worker. */
  | { kind: 'unauthenticated' }
  /** The job is not (or no longer) running for this worker: stop working on it. */
  | { kind: 'job-gone' }
  /** A transient failure (network, 5xx, 429): retry with backoff. */
  | { kind: 'retry'; reason: string }
  /** Any other refusal; not retryable. */
  | { kind: 'rejected'; status: number; code: string; message: string };

export interface OutputChunk {
  stream: 'stdout' | 'stderr';
  data: string;
}

export interface FinishBody {
  exitCode: number | null;
  signal?: string | null;
  errorCode?: string;
  errorMessage?: string;
  canceled?: boolean;
}

export class WorkerClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly tracing?: Tracing
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async call<T>(
    method: string,
    path: string,
    body: unknown,
    signal?: AbortSignal
  ): Promise<WorkerCallResult<T>> {
    const run = async (span?: Span): Promise<WorkerCallResult<T>> => {
      const result = await this.request<T>(method, path, body, signal, span);
      if (result.kind !== 'ok') span?.setStatus({ code: SpanStatusCode.ERROR });
      return result;
    };
    // IDs and arbitrary paths never become span names/attributes.
    const route = path.replace(/\/jobs\/[^/]+\//, '/jobs/:jobId/');
    return this.tracing ? this.tracing.run(`${method} ${route}`, { 'http.request.method': method, 'http.route': route }, run, undefined, SpanKind.CLIENT) : run();
  }

  private async request<T>(method: string, path: string, body: unknown, signal?: AbortSignal, span?: Span): Promise<WorkerCallResult<T>> {
    let response: Response;
    const parent = currentTraceParent();
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(parent ? { traceparent: parent } : {}),
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      if (signal?.aborted) {
        return { kind: 'retry', reason: 'aborted' };
      }
      return { kind: 'retry', reason: error instanceof Error ? error.message : String(error) };
    }

    span?.setAttribute('http.response.status_code', response.status);
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { kind: 'retry', reason: `HTTP ${response.status} with a non-JSON body` };
    }
    const envelope = json as {
      ok?: boolean;
      data?: T;
      error?: { code?: string; message?: string };
    };
    if (response.ok && envelope.ok === true) {
      return { kind: 'ok', data: envelope.data as T };
    }
    if (response.status === 401) {
      return { kind: 'unauthenticated' };
    }
    if (response.status === 404 && envelope.error?.code === 'JOB_NOT_FOUND') {
      return { kind: 'job-gone' };
    }
    if (response.status === 429 || response.status >= 500) {
      return { kind: 'retry', reason: `HTTP ${response.status}` };
    }
    return {
      kind: 'rejected',
      status: response.status,
      code: envelope.error?.code ?? 'UNKNOWN',
      message: envelope.error?.message ?? 'Request rejected.',
    };
  }

  /** Long-poll for the next job of this worker's tenant. */
  claim(waitMs: number, signal?: AbortSignal): Promise<WorkerCallResult<{ claim: ClaimedJob | null }>> {
    return this.call('POST', '/worker/claim', { waitMs }, signal);
  }

  /** Append output and/or heartbeat. The reply says whether a cancel was requested. */
  postOutput(
    jobId: string,
    chunks: readonly OutputChunk[],
    signal?: AbortSignal
  ): Promise<WorkerCallResult<{ cancelRequested: boolean; truncated: boolean }>> {
    return this.call('POST', `/worker/jobs/${jobId}/output`, { chunks }, signal);
  }

  /** Report the final result. */
  postExit(jobId: string, body: FinishBody, signal?: AbortSignal): Promise<WorkerCallResult<unknown>> {
    return this.call('POST', `/worker/jobs/${jobId}/exit`, body, signal);
  }
}
