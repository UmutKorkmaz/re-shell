import { Principal, Role, roleInTenant, roleSatisfies } from './auth.js';
import { ControlPlaneResult, fail, ok } from './errors.js';
import { Tenant, TenantStore, Workspace } from './tenant.js';

/**
 * Authorization + tenant-isolation logic. These are the security-critical pure
 * functions the whole control plane funnels through. They take an already
 * authenticated {@link Principal} and decide whether an action is permitted for
 * a given tenant/workspace.
 *
 * Two layered guarantees:
 *  1. MEMBERSHIP — a principal may only touch a tenant it is a member of.
 *  2. ISOLATION  — a workspace is only reachable via its OWNING tenant, and the
 *     store is queried tenant-first, so tenant A can never resolve tenant B's
 *     workspace even by guessing its id.
 */

/** A tenant resolved AND authorized for the principal. */
export interface AuthorizedTenant {
  principal: Principal;
  tenant: Tenant;
  role: Role;
}

/**
 * Resolve a tenant and assert the principal is a member with at least
 * `minRole`. Order matters for non-leakage:
 *  - Non-membership is reported as FORBIDDEN, never TENANT_NOT_FOUND, so a
 *    caller cannot enumerate which tenant ids exist by probing.
 *  - Only AFTER membership is established do we read the tenant record.
 */
export function authorizeTenant(
  store: TenantStore,
  principal: Principal,
  tenantId: string,
  minRole: Role = 'viewer'
): ControlPlaneResult<AuthorizedTenant> {
  const role = roleInTenant(principal, tenantId);
  if (!role) {
    // Deny without confirming existence: same response whether the tenant is
    // real-but-foreign or entirely absent.
    return fail('FORBIDDEN', 'Principal is not a member of the requested tenant.', {
      tenantId,
    });
  }
  if (!roleSatisfies(role, minRole)) {
    return fail('FORBIDDEN', `Action requires role "${minRole}" or higher.`, {
      tenantId,
      held: role,
      required: minRole,
    });
  }
  const tenant = store.getTenant(tenantId);
  if (!tenant) {
    // Membership claimed a tenant that the store does not have. Treat as a data
    // inconsistency, surfaced as not-found (the principal WAS authorized to ask).
    return fail('TENANT_NOT_FOUND', 'Tenant does not exist.', { tenantId });
  }
  return ok({ principal, tenant, role });
}

/**
 * Resolve a workspace WITHIN an authorized tenant. The lookup is tenant-scoped
 * (store.getWorkspace(tenantId, workspaceId)), so a workspace under any other
 * tenant is structurally unreachable and reported identically to a non-existent
 * one — the isolation guarantee.
 */
export function authorizeWorkspace(
  store: TenantStore,
  authorized: AuthorizedTenant,
  workspaceId: string
): ControlPlaneResult<{ tenant: Tenant; workspace: Workspace; role: Role }> {
  const workspace = store.getWorkspace(authorized.tenant.id, workspaceId);
  if (!workspace) {
    return fail('WORKSPACE_NOT_FOUND', 'Workspace not found in this tenant.', {
      tenantId: authorized.tenant.id,
      workspaceId,
    });
  }
  return ok({ tenant: authorized.tenant, workspace, role: authorized.role });
}

/**
 * The effective set of command ids permitted for a workspace: the INTERSECTION
 * of the tenant ceiling and the workspace grant. A permissive workspace entry
 * can never exceed the tenant's allow-list, and a permissive tenant entry never
 * auto-grants a workspace that did not opt in. Empty intersection = deny-all.
 */
export function effectiveAllowedCommands(tenant: Tenant, workspace: Workspace): readonly string[] {
  const ceiling = new Set(tenant.allowedCommandIds);
  return workspace.allowedCommandIds.filter((id) => ceiling.has(id));
}

/**
 * Assert a command id is permitted for a workspace. Returns the (unchanged)
 * command id on success for ergonomic chaining; FORBIDDEN otherwise.
 */
export function authorizeCommand(
  tenant: Tenant,
  workspace: Workspace,
  commandId: string
): ControlPlaneResult<string> {
  const allowed = effectiveAllowedCommands(tenant, workspace);
  if (!allowed.includes(commandId)) {
    return fail('COMMAND_NOT_ALLOWED', 'Command is not allow-listed for this workspace.', {
      commandId,
      tenantId: tenant.id,
      workspaceId: workspace.id,
    });
  }
  return ok(commandId);
}
