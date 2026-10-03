import * as React from 'react';
import { useHubQuery } from '@re-shell/ui';
import { jsonResponseSchema, workspaceGraphDiffSchema, type WorkspaceGraphDiff } from '@re-shell/contracts';

const envelopeSchema = jsonResponseSchema(workspaceGraphDiffSchema);

/**
 * The hub answers a ref that fails its allow-list validation with HTTP 400 and
 * the SSE client surfaces only the status. Say what that means instead of
 * showing a bare "SSE error: 400".
 */
export function describeTransportError(message: string): string {
  if (/\b400\b/.test(message)) {
    return 'The hub rejected these refs (HTTP 400). Use a git ref (branch, tag, sha, HEAD~1) or a relative .json path: letters, digits and . _ / @ ^ ~ + - only, not starting with "-" or "/", no "..".';
  }
  return message;
}

export interface GraphDiffState {
  diff: WorkspaceGraphDiff | null;
  error: string | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Fetch `workspace.graph.diff` through the hub allow-list. Disabled (and
 * nothing is sent) until a base ref is set. The hub validates the refs against a
 * strict charset; a rejected ref or a git failure arrives as an error envelope
 * and is surfaced verbatim, never as an empty diff.
 */
export function useGraphDiff(base: string, head: string): GraphDiffState {
  const enabled = base.trim() !== '';
  const params = enabled ? { base: base.trim(), ...(head.trim() ? { head: head.trim() } : {}) } : undefined;
  const query = useHubQuery('workspace.graph.diff', params, {
    schema: envelopeSchema,
    query: { enabled, retry: false, staleTime: 15_000 },
  });
  const { data, error, isLoading, refetch } = query;

  return React.useMemo<GraphDiffState>(() => {
    const base: Pick<GraphDiffState, 'isLoading' | 'refetch'> = { isLoading: enabled && isLoading, refetch: () => void refetch() };
    if (!enabled) return { ...base, diff: null, error: null };
    if (error) return { ...base, diff: null, error: describeTransportError(error.message) };
    if (!data) return { ...base, diff: null, error: null };
    const env = data as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
    if (env.ok === false) {
      return { ...base, diff: null, error: `${env.error?.code ?? 'ERROR'}: ${env.error?.message ?? 'graph diff failed'}` };
    }
    const parsed = workspaceGraphDiffSchema.safeParse(env.data);
    if (!parsed.success) return { ...base, diff: null, error: 'workspace.graph.diff returned an unexpected payload' };
    return { ...base, diff: parsed.data, error: null };
  }, [data, error, isLoading, refetch, enabled]);
}
