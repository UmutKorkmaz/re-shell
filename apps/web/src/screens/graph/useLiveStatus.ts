import * as React from 'react';
import { useHubQuery } from '@re-shell/ui';
import {
  jsonResponseSchema,
  workspaceStatusReportSchema,
  type WorkspaceLiveStatus,
  type WorkspaceStatusEntry,
} from '@re-shell/contracts';

const envelopeSchema = jsonResponseSchema(workspaceStatusReportSchema);

export interface LiveStatus {
  /** Status per node name. Nodes missing from the report read as `unknown`. */
  byName: ReadonlyMap<string, WorkspaceStatusEntry>;
  /** ISO time of the last successful report. */
  checkedAt: string | null;
  /** Why live status is unavailable (transport, CLI error envelope or a malformed payload). */
  error: string | null;
  isFetching: boolean;
  refetch: () => void;
  statusOf: (id: string) => WorkspaceLiveStatus;
  /** Name -> status for adapters that take a plain map. */
  statusMap: ReadonlyMap<string, WorkspaceLiveStatus>;
  summary: Record<WorkspaceLiveStatus, number>;
}

const EMPTY = new Map<string, WorkspaceStatusEntry>();
const ZERO = { running: 0, stopped: 0, unhealthy: 0, unknown: 0 } as const;

/**
 * Poll `workspace.status` from the hub. Replaces the old hardcoded `'unknown'`:
 * every node's colour comes from the CLI's real probes. When the poll fails the
 * error is surfaced and nodes stay honestly `unknown`; stale data is never
 * presented as fresh (an error clears the previous report).
 *
 * @param intervalSeconds poll period; `0` fetches once and then only on demand.
 */
export function useLiveStatus(intervalSeconds: number): LiveStatus {
  const query = useHubQuery('workspace.status', undefined, {
    schema: envelopeSchema,
    query: {
      refetchInterval: intervalSeconds > 0 ? intervalSeconds * 1000 : false,
      refetchIntervalInBackground: false,
      staleTime: 0,
      retry: false,
    },
  });
  const { data, error: transportError, isFetching, refetch } = query;

  const parsed = React.useMemo(() => {
    // A failed poll must not leave the previous report on screen as if it were current.
    if (!data || transportError) return { report: null, error: null as string | null };
    // `data` is already schema-validated by the hook; re-check defensively so a
    // test double or a future contract drift degrades to an error chip.
    const env = data as { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } };
    if (env.ok === false) return { report: null, error: `${env.error?.code ?? 'ERROR'}: ${env.error?.message ?? 'workspace status failed'}` };
    const report = workspaceStatusReportSchema.safeParse(env.data);
    if (!report.success) return { report: null, error: 'workspace.status returned an unexpected payload' };
    return { report: report.data, error: null };
  }, [data, transportError]);

  const byName = React.useMemo(() => {
    if (!parsed.report) return EMPTY;
    return new Map(parsed.report.nodes.map((n) => [n.name, n]));
  }, [parsed.report]);

  const statusOf = React.useCallback((id: string): WorkspaceLiveStatus => byName.get(id)?.status ?? 'unknown', [byName]);

  const statusMap = React.useMemo(() => new Map([...byName].map(([name, entry]) => [name, entry.status] as const)), [byName]);

  return {
    byName,
    statusMap,
    checkedAt: parsed.report?.checkedAt ?? null,
    error: transportError ? transportError.message : parsed.error,
    isFetching,
    refetch: () => void refetch(),
    statusOf,
    summary: parsed.report ? { ...parsed.report.summary } : { ...ZERO },
  };
}
