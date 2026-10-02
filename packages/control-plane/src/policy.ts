import { effectiveAllowedCommands } from './authz.js';
import type { TenantStore } from './tenant.js';

/**
 * The full, current team policy of one tenant: the tenant ceiling, the optional
 * policy-pack reference, and per-workspace grants with the resulting EFFECTIVE
 * allow-list (ceiling ∩ grant). It is the single payload shape used by
 * `GET /tenants/:id/policy`, the SSE `snapshot` and `policy.updated` events, and
 * the worker claim response — so every consumer sees the same enforcement view.
 */
export interface PolicySnapshot {
  tenantId: string;
  policyVersion: number;
  policyPack: string | null;
  /** The tenant ceiling. */
  allowedCommandIds: string[];
  workspaces: Array<{
    id: string;
    /** The workspace grant (before intersection). */
    allowedCommandIds: string[];
    /** ceiling ∩ grant: what is actually permitted. */
    effectiveCommandIds: string[];
  }>;
}

/** Build the current snapshot for a tenant, or undefined when it does not exist. */
export function buildPolicySnapshot(
  store: TenantStore,
  tenantId: string
): PolicySnapshot | undefined {
  const tenant = store.getTenant(tenantId);
  if (!tenant) {
    return undefined;
  }
  return {
    tenantId: tenant.id,
    policyVersion: tenant.policyVersion,
    policyPack: tenant.policyPack ?? null,
    allowedCommandIds: [...tenant.allowedCommandIds],
    workspaces: store.listWorkspaces(tenant.id).map((workspace) => ({
      id: workspace.id,
      allowedCommandIds: [...workspace.allowedCommandIds],
      effectiveCommandIds: [...effectiveAllowedCommands(tenant, workspace)],
    })),
  };
}
