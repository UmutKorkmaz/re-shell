import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { JobStatus, WsServerMessage } from '@re-shell/contracts';
import { WsClient } from '@/hub/ws-client';
import {
  buildJobsUrl,
  resolveHubBaseUrl,
  resolveHubToken,
  type HubConnectionOptions,
} from './config';
import { redactSecrets } from './redact';

/** A single rendered job-output line, tagged by source stream. */
export interface JobLine {
  stream: 'stdout' | 'stderr';
  text: string;
}

/** State plus controls returned by {@link useJob}. */
export interface UseJobResult {
  /** Redacted output lines in arrival order (stdout + stderr interleaved). */
  lines: JobLine[];
  /** Lifecycle status driven by the WS start/exit/error messages. */
  status: JobStatus;
  /** Process exit code, set once an `exit` message arrives. */
  exitCode: number | null;
  /** Transport/validation error, if any. */
  error: Error | null;
  /** Connect and emit the `start` message for `{ commandId, params }`. */
  start: () => void;
  /** Emit a `cancel` message for the active job (no-op if not running). */
  cancel: () => void;
}

export interface UseJobOptions extends HubConnectionOptions {
  /**
   * Disable the per-line secret redaction pass. Off by default — displayed
   * lines are redacted unless a caller explicitly opts out.
   */
  disableRedaction?: boolean;
}

/** Monotonic-ish job id generator for the WS `{ id }` correlation field. */
function nextJobId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `job_${Date.now().toString(36)}_${rand}`;
}

/**
 * Drive a streaming job over the secure WebSocket client.
 *
 * The job is started by sending `{ type: 'start', id, commandId, params }` — an
 * allow-listed `{ commandId, params }` pair, never a raw command/argv. Inbound
 * `stdout`/`stderr` frames are appended (reading `msg.content`, never
 * `msg.output`), redacted for obvious secrets, and exposed as `lines`. The
 * `exit` frame sets `status` + `exitCode`; `cancel` sends `{ type: 'cancel', id }`.
 */
export function useJob(
  commandId: string,
  params?: unknown,
  options: UseJobOptions = {}
): UseJobResult {
  const { baseUrl, token, disableRedaction = false } = options;

  const [lines, setLines] = useState<JobLine[]>([]);
  const [status, setStatus] = useState<JobStatus>('queued');
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const clientRef = useRef<WsClient | null>(null);
  const jobIdRef = useRef<string | null>(null);

  // Stable serialization so a fresh `params` literal does not invalidate the
  // memoized start callback on every render.
  const paramsKey = params === undefined ? '' : JSON.stringify(params);

  const transform = useCallback(
    (content: string): string => (disableRedaction ? content : redactSecrets(content)),
    [disableRedaction]
  );

  const handleMessage = useCallback(
    (msg: WsServerMessage): void => {
      // Ignore frames for other jobs once we have a correlation id.
      if (jobIdRef.current && msg.id && msg.id !== jobIdRef.current) {
        return;
      }

      switch (msg.type) {
        case 'stdout':
        case 'stderr': {
          if (msg.content === undefined) {
            return;
          }
          const stream: JobLine['stream'] = msg.type === 'stderr' ? 'stderr' : 'stdout';
          const text = transform(msg.content);
          setLines((prev) => [...prev, { stream, text }]);
          setStatus((prev) => (prev === 'queued' ? 'running' : prev));
          return;
        }
        case 'exit': {
          const code = msg.code ?? 0;
          setExitCode(code);
          setStatus(code === 0 ? 'success' : 'failed');
          return;
        }
        case 'error': {
          setStatus('failed');
          setError(new Error(msg.message ?? 'Job reported an error'));
          return;
        }
        case 'heartbeat':
        default:
          return;
      }
    },
    [transform]
  );

  const start = useCallback(() => {
    // Tear down any prior connection before starting a fresh job.
    clientRef.current?.close();

    setLines([]);
    setExitCode(null);
    setError(null);
    setStatus('queued');

    const jobId = nextJobId();
    jobIdRef.current = jobId;

    const url = buildJobsUrl(resolveHubBaseUrl(baseUrl));
    const client = new WsClient({
      url,
      token: resolveHubToken(token),
      onMessage: handleMessage,
      onError: (err) => setError(err),
      onClose: () => {
        // Transition to a terminal state if the socket closed before the job
        // finished (network drop, hub restart, auth rejection). Without this,
        // the UI shows a spinner that runs forever with no error.
        setStatus((prev) =>
          prev === 'success' || prev === 'failed' || prev === 'cancelled'
            ? prev
            : 'failed',
        );
        setError((prev) =>
          prev ?? new Error('Connection to the hub closed before the job finished'),
        );
      },
      onOpen: () => {
        client.send({ type: 'start', id: jobId, commandId, params });
        setStatus('running');
      },
    });

    clientRef.current = client;
    client.connect();
    // params is captured via the stable key; reading the live value is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandId, paramsKey, baseUrl, token, handleMessage]);

  const cancel = useCallback(() => {
    const client = clientRef.current;
    const jobId = jobIdRef.current;
    if (!client || !jobId) {
      return;
    }
    client.send({ type: 'cancel', id: jobId });
    setStatus('cancelled');
    client.close();
  }, []);

  // Close the socket on unmount so a backgrounded panel does not leak a job.
  useEffect(() => {
    return () => {
      clientRef.current?.close();
    };
  }, []);

  return useMemo(
    () => ({ lines, status, exitCode, error, start, cancel }),
    [lines, status, exitCode, error, start, cancel]
  );
}
