import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';

import { SseClient } from '@/hub/sse-client';
import {
  buildEventsUrl,
  resolveHubBaseUrl,
  resolveHubToken,
  type HubConnectionOptions,
} from './config';

/**
 * State returned by {@link useHubStream}. `data` is the single, reassembled,
 * schema-validated object produced by a one-shot `--json` command; it is null
 * until the stream completes and validates.
 */
export interface HubStreamState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseHubStreamOptions<TSchema extends z.ZodTypeAny>
  extends HubConnectionOptions {
  /**
   * Contract zod schema the reassembled payload must satisfy. The hook runs
   * `safeParse` and surfaces a validation failure via `error` — it never casts
   * blindly. Omit to receive the raw parsed value as `unknown`.
   */
  schema?: TSchema;
  /**
   * When false the hook does not open a stream (useful for conditional reads).
   * Defaults to true.
   */
  enabled?: boolean;
}

type StreamResult<TSchema extends z.ZodTypeAny | undefined> =
  TSchema extends z.ZodTypeAny ? z.infer<TSchema> : unknown;

/**
 * Open an SSE stream for a one-shot `--json` command and return exactly one
 * parsed, schema-validated object plus `{ loading, error }`.
 *
 * The stream is addressed purely by `{ commandId, params }` against the hub
 * allow-list — never a raw command/argv. The session token is attached
 * automatically by {@link SseClient} (from the option or the Vite env). The
 * Wave-3 JSON reassembler (inside `SseClient`) coalesces chunked stdout into a
 * single JSON document, which this hook validates with `safeParse`.
 */
export function useHubStream<TSchema extends z.ZodTypeAny = z.ZodTypeAny>(
  commandId: string,
  params?: unknown,
  options: UseHubStreamOptions<TSchema> = {}
): HubStreamState<StreamResult<TSchema>> {
  const { schema, enabled = true, baseUrl, token } = options;

  const [state, setState] = useState<HubStreamState<StreamResult<TSchema>>>({
    data: null,
    loading: enabled,
    error: null,
  });

  // Stable serialization so a fresh object literal for `params` does not
  // re-open the stream on every render.
  const paramsKey = params === undefined ? '' : JSON.stringify(params);
  const schemaRef = useRef(schema);
  schemaRef.current = schema;

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    const resolvedBaseUrl = resolveHubBaseUrl(baseUrl);
    const url = buildEventsUrl(resolvedBaseUrl, commandId, params);

    const handleParsed = (parsed: unknown): void => {
      if (cancelled) {
        return;
      }
      const activeSchema = schemaRef.current;
      if (!activeSchema) {
        setState({ data: parsed as StreamResult<TSchema>, loading: false, error: null });
        return;
      }
      const result = activeSchema.safeParse(parsed);
      if (!result.success) {
        setState({
          data: null,
          loading: false,
          error: new Error(`Response failed schema validation: ${result.error.message}`),
        });
        return;
      }
      setState({ data: result.data as StreamResult<TSchema>, loading: false, error: null });
    };

    const client = new SseClient({
      url,
      token: resolveHubToken(token),
      onJson: handleParsed,
      onError: (err) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error: err });
        }
      },
      onDone: () => {
        if (!cancelled) {
          // If the stream ended with neither JSON nor an error, drop loading so
          // consumers are not stuck in a perpetual pending state.
          setState((prev) => (prev.loading ? { ...prev, loading: false } : prev));
        }
      },
    });

    void client.connect();

    return () => {
      cancelled = true;
      client.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandId, paramsKey, enabled, baseUrl, token]);

  return state;
}
