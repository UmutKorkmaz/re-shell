# Hosted Control Plane (P9-J) — Spec & Scaffold

> **ENV-LIMITED SCAFFOLD.** This document specifies a hosted, multi-tenant
> control plane that extends the local Re-Shell hub. The accompanying code
> (`packages/control-plane`) is **pure, single-process, in-memory logic only**:
> **not deployed, no database, no live HTTP server, no command execution.** It
> exists so the security-critical decisions (tenant isolation, authz, request
> validation) are fully unit-testable today, and so a real deployment has an
> exact contract to implement.

## 1. Why a control plane

The local hub (`apps/web/src/hub`) lets a single developer drive the Re-Shell
CLI from a browser on their own machine. It is single-user, single-workspace,
and trusts the loopback boundary. The control plane generalizes that model to a
**hosted, multi-tenant** surface:

| Concern              | Local hub                         | Control plane                                  |
| -------------------- | --------------------------------- | ---------------------------------------------- |
| Identity             | Implicit (loopback owner)         | Authenticated principal (bearer token/session) |
| Tenancy              | One implicit workspace root       | Many tenants, each owning many workspaces      |
| Command allow-list   | `command-registry.ts` (static)    | Tenant ceiling ∩ per-workspace grant           |
| Execution            | Spawns the CLI in-process         | Authorizes, then forwards to an execution worker |
| Trust boundary       | localhost                         | Network + authz on every request               |

The **command allow-list discipline is preserved end-to-end**: the control
plane never builds argv. It only decides *whether* a `commandId` is permitted for
a `(tenant, workspace)`. Argv construction stays in the local hub's vetted
`command-registry.ts` running inside the per-tenant execution worker.

## 2. Architecture

```
            ┌─────────────────────────────────────────────────────────┐
            │                    Control Plane (hosted)                 │
            │                                                           │
  client ──▶│  HTTP edge ──▶ auth ──▶ validate ──▶ authz ──▶ decision   │
 (bearer    │   (real)      (real    (zod, pure)  (pure,    (pure)      │
  token)    │               IdP)                   pure)     │          │
            │                                                ▼          │
            │                                   forward {tenant,        │
            │                                   workspace, commandId,   │
            │                                   params} to worker       │
            └────────────────────────────────────────────────│────────┘
                                                               ▼
                                            ┌──────────────────────────────┐
                                            │ Per-tenant execution worker   │
                                            │ owns local hub + CLI binary,  │
                                            │ builds argv via command-      │
                                            │ registry, spawns (no shell)   │
                                            └──────────────────────────────┘
```

The **pure middle band** (auth → validate → authz → decision) is what
`packages/control-plane` implements and tests. Everything in *(real)* boxes is
the deployment's responsibility and is intentionally out of scope here.

### Module map (`packages/control-plane/src`)

| Module       | Responsibility                                                                 |
| ------------ | ------------------------------------------------------------------------------ |
| `errors.ts`  | Closed `ControlPlaneErrorCode` enum, result envelope (`ok`/`fail`), HTTP map.  |
| `tenant.ts`  | `Tenant`/`Workspace` zod models; `TenantStore` + `InMemoryTenantStore`.        |
| `auth.ts`    | `Principal`, `Role` hierarchy, `Session`, `authenticate`, role helpers.        |
| `authz.ts`   | `authorizeTenant`, `authorizeWorkspace`, command allow-list intersection.      |
| `api.ts`     | Pure request handlers: `listWorkspaces`, `proxyCommand` (auth→validate→authz). |

## 3. Multi-tenant model

- A **Tenant** is the isolation boundary. It owns a set of **Workspaces** and
  carries a tenant-level `allowedCommandIds` *ceiling*.
- A **Workspace** belongs to exactly one tenant (`tenantId` is the isolation
  key) and carries its own `allowedCommandIds` *grant*.
- The **effective** command allow-list for a workspace is the **intersection**
  `tenant.allowedCommandIds ∩ workspace.allowedCommandIds`. A permissive
  workspace entry can never exceed the tenant ceiling; a permissive tenant entry
  never auto-grants a workspace that did not opt in. Empty intersection =
  deny-all.

### Isolation guarantees (enforced + unit-tested)

1. **Tenant-first indexing.** `InMemoryTenantStore` indexes workspaces as
   `tenantId → (workspaceId → Workspace)`. A lookup for tenant A never even
   considers tenant B's bucket, so `getWorkspace('tenant-a', 'ws-b1')` returns
   `undefined` even though `ws-b1` is a real workspace under tenant B.
2. **Membership = the only source of truth.** A principal may only touch a
   tenant listed in its `tenantRoles`. Absence is a hard deny.
3. **No existence oracle.** A non-member asking about *any* tenant — real or
   absent — receives `FORBIDDEN`, never `TENANT_NOT_FOUND`, so tenant ids cannot
   be enumerated by probing.
4. **Indistinguishable workspace 404.** "Workspace does not exist" and
   "workspace belongs to another tenant" produce the same `WORKSPACE_NOT_FOUND`.

A real DB-backed store **must** uphold these (e.g. Postgres row-level security
keyed on `tenant_id`, or per-tenant schemas). The `TenantStore` interface is the
contract.

## 4. Authentication & authorization

### Auth (token/session)

- `authenticate(resolver, token, now)` resolves an opaque bearer token to a
  `Principal`, rejecting missing/blank/unknown/expired tokens as
  `UNAUTHENTICATED` **without leaking which condition failed** (no token-probing
  oracle).
- **ENV-LIMITED:** tokens are plain strings resolved against an in-memory map.
  There is **no crypto/JWT/OIDC and no session store**. A real deployment swaps
  `InMemorySessionResolver` for a verifier of signed bearer tokens (JWT/OIDC) or
  a server-side session lookup. The `SessionResolver` interface is the seam.

### Authz (roles)

Role hierarchy: `viewer < operator < admin`.

| Action                        | Minimum role |
| ----------------------------- | ------------ |
| List workspaces (read-only)   | `viewer`     |
| Proxy a command (side effect) | `operator`   |

`roleSatisfies(held, required)` is a total comparison over the rank table, so
authz decisions are explicit and testable.

### Request validation

Every handler validates its request body with a strict zod schema at the
boundary (`INVALID_REQUEST` on failure) **before** any authz, and ids are
constrained to a safe `[A-Za-z0-9._-]` charset so they remain single, well-formed
tokens downstream.

## 5. API skeleton

Handlers are pure `(deps, body) => ControlPlaneResult<T>`. A deployment mounts
each behind an HTTP route and maps the result envelope to a status code via
`HTTP_STATUS_BY_CODE`.

### `listWorkspaces` → `GET /tenants/:tenantId/workspaces`

Pipeline: authenticate → validate → `authorizeTenant(viewer)` → list the
tenant's own bucket. Returns `{ tenantId, workspaces }`.

### `proxyCommand` → `POST /tenants/:tenantId/workspaces/:workspaceId/commands`

Pipeline: authenticate → validate → `authorizeTenant(operator)` →
`authorizeWorkspace` (isolation) → `authorizeCommand` (allow-list intersection).
On success returns a **`ProxyCommandDecision`**, i.e. the *authorization
result* — `{ tenantId, workspaceId, commandId, params, authorized: true }`. It
does **not** execute anything; a deployment forwards this decision to the
per-tenant execution worker.

### Result envelope

Shaped like the CLI's JSON envelope so the dashboard uses one parser:

```ts
{ ok: true,  data: T,                         warnings: string[] }
{ ok: false, error: { code, message, details? }, warnings: string[] }
```

`ControlPlaneErrorCode`: `UNAUTHENTICATED`, `FORBIDDEN`, `TENANT_NOT_FOUND`,
`WORKSPACE_NOT_FOUND`, `INVALID_REQUEST`, `COMMAND_NOT_ALLOWED`.

## 6. Deployment outline (NOT performed here)

A production rollout would add, around the pure core:

1. **HTTP edge** — a router (Fastify/Hono/Express) mounting the handlers; map
   `ControlPlaneResult` → status via `HTTP_STATUS_BY_CODE`; apply per-tenant rate
   limiting, CSRF on state-changing routes, and standard security headers.
2. **Identity provider** — verify signed bearer tokens (JWT/OIDC) or
   server-side sessions; replace `InMemorySessionResolver`. Rotate signing keys;
   never hardcode secrets (env/secret-manager only).
3. **Persistent tenant store** — back `TenantStore` with Postgres using
   row-level security on `tenant_id` (or per-tenant schemas) so isolation holds
   at the database layer, not just in code.
4. **Per-tenant execution workers** — receive the `ProxyCommandDecision`, build
   argv via the existing `command-registry.ts`, spawn the CLI **without a shell**
   inside a contained workspace, stream results back.
5. **Observability & audit** — structured logs and an append-only audit trail of
   every authz decision (who, tenant, workspace, command, allow/deny).

## 7. What is tested vs scaffold-only

- **Tested (42 unit tests, 100% lines / 98.6% branches):** tenant isolation
  (cross-tenant workspace unreachable, no existence oracle, tenant-first
  indexing), authz (membership, role hierarchy, command allow-list
  intersection), authentication (missing/blank/unknown/expired), request
  validation, and the full `listWorkspaces` / `proxyCommand` pipelines.
- **Scaffold-only / NOT built here:** the HTTP server, real identity provider,
  database, execution workers, deployment, audit pipeline. These are specified
  in §6 but intentionally not implemented in this env-limited slice.
