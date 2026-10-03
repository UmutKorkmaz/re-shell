import * as React from 'react';
import type { CollabAnalytics, CollabSessionSummary, ControlPlaneClient } from '@re-shell/contracts';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Sessions of the tenant, refreshed on an interval and on demand. */
export function useSessionsList(
  client: ControlPlaneClient | null,
  tenantId: string | null,
  pollMs = 4000
): { sessions: CollabSessionSummary[] | null; error: string | null; refresh: () => void } {
  const [sessions, setSessions] = React.useState<CollabSessionSummary[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    setSessions(null);
    setError(null);
    if (!client || !tenantId) return;
    let cancelled = false;
    const load = (): void => {
      client
        .listSessions(tenantId, { limit: 50 })
        .then((rows) => {
          if (!cancelled) {
            setSessions(rows);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(message(e));
        });
    };
    load();
    const timer = pollMs > 0 ? setInterval(load, pollMs) : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [client, tenantId, pollMs, tick]);

  return { sessions, error, refresh: React.useCallback(() => setTick((n) => n + 1), []) };
}

/** Workspaces of the tenant (for the "start a session" form). */
export function useWorkspaces(
  client: ControlPlaneClient | null,
  tenantId: string | null
): Array<{ id: string; name: string }> {
  const [workspaces, setWorkspaces] = React.useState<Array<{ id: string; name: string }>>([]);
  React.useEffect(() => {
    setWorkspaces([]);
    if (!client || !tenantId) return;
    let cancelled = false;
    client
      .listWorkspaces(tenantId)
      .then((res) => {
        if (!cancelled) setWorkspaces(res.workspaces.map((w) => ({ id: w.id, name: w.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, tenantId]);
  return workspaces;
}

/** The commands the team policy lets a workspace run (ceiling intersect grant). */
export function useEffectiveCommands(
  client: ControlPlaneClient | null,
  tenantId: string | null,
  workspaceId: string | null
): string[] {
  const [ids, setIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    setIds([]);
    if (!client || !tenantId || !workspaceId) return;
    let cancelled = false;
    client
      .call<{ policy: { workspaces: Array<{ id: string; effectiveCommandIds: string[] }> } }>(
        'GET',
        `/tenants/${encodeURIComponent(tenantId)}/policy`
      )
      .then((res) => {
        if (!cancelled) {
          setIds(res.policy.workspaces.find((w) => w.id === workspaceId)?.effectiveCommandIds ?? []);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, tenantId, workspaceId]);
  return ids;
}

/** Team analytics for a trailing window. */
export function useAnalytics(
  client: ControlPlaneClient | null,
  tenantId: string | null,
  windowMs: number
): { analytics: CollabAnalytics | null; error: string | null; loading: boolean; refresh: () => void } {
  const [analytics, setAnalytics] = React.useState<CollabAnalytics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    setAnalytics(null);
    setError(null);
    if (!client || !tenantId) return;
    let cancelled = false;
    setLoading(true);
    const to = Date.now() + 1000;
    client
      .analytics(tenantId, { from: Math.max(0, to - windowMs), to })
      .then((res) => {
        if (!cancelled) setAnalytics(res);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(message(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, tenantId, windowMs, tick]);

  return { analytics, error, loading, refresh: React.useCallback(() => setTick((n) => n + 1), []) };
}
