/**
 * re-shell-control-plane
 *
 * ENV-LIMITED SCAFFOLD. Pure, single-process, in-memory multi-tenant
 * control-plane logic that extends the local Re-Shell hub model to an
 * authenticated, multi-tenant surface.
 *
 * What this IS:
 *  - Typed tenant/workspace model with structural isolation (tenant.ts)
 *  - Token/session auth layer + role hierarchy (auth.ts)
 *  - Tenant-isolation + authz checks (authz.ts)
 *  - Pure request handlers: list workspaces, proxy an allow-listed command (api.ts)
 *  - A stable error vocabulary + result envelope (errors.ts)
 *
 * What this is NOT (see docs/control-plane.md):
 *  - NOT a running server (no HTTP/router/middleware)
 *  - NOT backed by a database (in-memory snapshot only)
 *  - NOT executing commands (it authorizes; a worker would execute)
 *  - NOT deployed and NOT a crypto/identity provider
 */
export * from './errors.js';
export * from './tenant.js';
export * from './auth.js';
export * from './authz.js';
export * from './api.js';
