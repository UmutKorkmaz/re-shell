import type { z } from 'zod';

import { SseClient } from '@/hub/sse-client';
import {
  buildEventsUrl,
  resolveHubBaseUrl,
  resolveHubToken,
  type HubConnectionOptions,
} from './config';

export interface FetchHubJsonOptions<TSchema extends z.ZodTypeAny>
  extends HubConnectionOptions {
  /** Contract zod schema to validate the reassembled payload with `safeParse`. */
  schema?: TSchema;
  /** Abort signal so callers (e.g. TanStack Query) can cancel the stream. */
  signal?: AbortSignal;
}

type FetchResult<TSchema extends z.ZodTypeAny | undefined> =
  TSchema extends z.ZodTypeAny ? z.infer<TSchema> : unknown;

/**
 * Run a one-shot `--json` command over SSE and resolve with exactly one parsed,
 * schema-validated object. Rejects on transport error, validation failure, or
 * a stream that completes without producing JSON.
 *
 * Addressed by `{ commandId, params }` against the hub allow-list only. Shared
 * by {@link useHubQuery} so cacheable reads reuse the same reassembly +
 * validation path as the streaming hook.
 */
export function fetchHubJson<TSchema extends z.ZodTypeAny = z.ZodTypeAny>(
  commandId: string,
  params?: unknown,
  options: FetchHubJsonOptions<TSchema> = {}
): Promise<FetchResult<TSchema>> {
  const { schema, signal, baseUrl, token } = options;

  return new Promise<FetchResult<TSchema>>((resolve, reject) => {
    let settled = false;
    let produced = false;

    const resolvedBaseUrl = resolveHubBaseUrl(baseUrl);
    const url = buildEventsUrl(resolvedBaseUrl, commandId, params);

    const client = new SseClient({
      url,
      token: resolveHubToken(token),
      onJson: (parsed) => {
        if (settled) {
          return;
        }
        produced = true;
        if (!schema) {
          settled = true;
          client.close();
          resolve(parsed as FetchResult<TSchema>);
          return;
        }
        const result = schema.safeParse(parsed);
        if (!result.success) {
          settled = true;
          client.close();
          reject(new Error(`Response failed schema validation: ${result.error.message}`));
          return;
        }
        settled = true;
        client.close();
        resolve(result.data as FetchResult<TSchema>);
      },
      onError: (err) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(err);
      },
      onDone: () => {
        if (settled || produced) {
          return;
        }
        settled = true;
        reject(new Error(`Stream for "${commandId}" completed without a JSON payload`));
      },
    });

    if (signal) {
      if (signal.aborted) {
        client.close();
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          if (settled) {
            return;
          }
          settled = true;
          client.close();
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    }

    void client.connect();
  });
}
