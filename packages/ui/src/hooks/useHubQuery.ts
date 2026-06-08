import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { z } from 'zod';

import { fetchHubJson } from './fetchHubJson';
import type { HubConnectionOptions } from './config';

type QueryData<TSchema extends z.ZodTypeAny | undefined> =
  TSchema extends z.ZodTypeAny ? z.infer<TSchema> : unknown;

export interface UseHubQueryOptions<TSchema extends z.ZodTypeAny>
  extends HubConnectionOptions {
  /**
   * Contract zod schema to validate the response against (`safeParse`). The
   * query data type is inferred from it; validation failures surface as a query
   * error rather than a blind cast.
   */
  schema?: TSchema;
  /**
   * Extra TanStack Query options (staleTime, enabled, refetchInterval, etc.).
   * `queryKey` and `queryFn` are managed by this hook and cannot be overridden.
   */
  query?: Omit<
    UseQueryOptions<QueryData<TSchema>, Error, QueryData<TSchema>>,
    'queryKey' | 'queryFn'
  >;
}

/**
 * Cacheable read of a one-shot `--json` command, built on TanStack Query over
 * the same SSE reassembly + validation path as {@link useHubStream}.
 *
 * Intended for the cacheable surfaces — workspace summary/graph/health,
 * templates list, commands list. Every invocation is addressed by
 * `{ commandId, params }` against the hub allow-list; the token is attached
 * automatically. The query key is `['hub', commandId, params]` so distinct
 * params cache independently and re-fetch when params change.
 *
 * Requires a `QueryClientProvider` from `@tanstack/react-query` in the tree.
 */
export function useHubQuery<TSchema extends z.ZodTypeAny = z.ZodTypeAny>(
  commandId: string,
  params?: unknown,
  options: UseHubQueryOptions<TSchema> = {}
): UseQueryResult<QueryData<TSchema>, Error> {
  const { schema, baseUrl, token, query } = options;

  return useQuery<QueryData<TSchema>, Error, QueryData<TSchema>>({
    queryKey: ['hub', commandId, params ?? null],
    queryFn: ({ signal }) =>
      fetchHubJson<TSchema>(commandId, params, { schema, baseUrl, token, signal }),
    ...query,
  });
}
