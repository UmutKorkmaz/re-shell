# Hosted Control Plane (P9-J)

> **Status: implemented and tested, packaged for deployment, NOT deployed.**
> `packages/control-plane` (`@re-shell/control-plane`) is a real, runnable
> multi-tenant service: an authenticated HTTP/SSE API, a SQLite-backed tenant
> store, signed-token identity with key rotation, an append-only audit trail,
> team policy sync, and remote execution workers that run the allow-listed
> Re-Shell CLI. It is built and tested in CI and ships a Dockerfile and a
> Compose file. It has **not** been deployed to any public host, has had no
> external security review, and is single-node by design — see
> [Remaining limits](#13-remaining-limits) before putting it on a network.

## 1. Why a control plane

The local hub (`apps/web/src/hub`) lets a single developer drive the Re-Shell
CLI from a browser on their own machine. It is single-user, single-workspace,
and trusts the loopback boundary. The control plane generalizes that model to a
**hosted, multi-tenant** surface for teams:

| Concern            | Local hub                      | Control plane                                              |
| ------------------ | ------------------------------ | ---------------------------------------------------------- |
| Identity           | Implicit (loopback owner)      | Signed bearer tokens (HS256 JWT, `kid` rotation, expiry)   |
| Tenancy            | One implicit workspace root    | Many tenants, each owning many workspaces and members      |
| Command allow-list | `command-registry` (static)    | Same registry ∩ tenant ceiling ∩ workspace grant (live)    |
| Execution          | Spawns the CLI in-process      | Authorizes, queues a job, a **worker** spawns the CLI      |
| Collaboration      | None                           | Shared workspaces, roles, live team-policy sync (SSE); **shared terminal sessions, OT editing, WebRTC pairing, team analytics (§14)** |
| Trust boundary     | localhost                      | Network: authn + authz + rate limits + audit on every call |

**The allow-list discipline is preserved end to end.** There is exactly one
registry of runnable commands and one argv builder —
`packages/contracts/src/command-registry.ts`, exported as
`@re-shell/contracts/command-registry`. The local hub re-exports it
(`apps/web/src/hub/command-registry.ts` is a thin re-export), the control plane
validates requests against it, and the worker builds argv from it. The control
plane never builds argv and never spawns anything itself.

## 2. Architecture

```
 dashboard / API clients                                      worker host(s)
 ───────────────────────                                     ─────────────────
   Bearer user token                                          Bearer worker token
          │                                                            │
          ▼                                                            ▼
 ┌────────────────────────────── control plane (node:http) ───────────────────────────────┐
 │ headers/CORS → route → rate limit → authenticate → body limit + zod → handler            │
 │                                                                                          │
 │  handler = validate → authenticate → authorize (membership, role, isolation, allow-list) │
 │            → RECORD decision in audit_log (fails closed) → act                           │
 │                                                                                          │
 │  SQLite (node:sqlite): tenants · workspaces · memberships · audit_log · jobs · job_output│
 │  EventBus ──► SSE /tenants/:id/events   (policy.updated, workspace.created, job.updated) │
 │  Job queue ◄── POST /worker/claim (long-poll) · /worker/jobs/:id/output · /exit          │
 └──────────────────────────────────────────────────────────────────────────────────────────┘
                                                                          │ authorized job
                                                                          ▼
                                       worker: re-check policy → resolveCommand (shared registry)
                                       → contain cwd to <workspace-root>/<id> → spawn CLI (no shell)
                                       → stream stdout/stderr → report exit code
```

### Module map (`packages/control-plane/src`)

| Module                      | Responsibility                                                                    |
| --------------------------- | --------------------------------------------------------------------------------- |
| `errors.ts`                 | Closed `ControlPlaneErrorCode` enum, envelope (`ok`/`fail`), `HTTP_STATUS_BY_CODE` |
| `tenant.ts`                 | zod `Tenant`/`Workspace`/`Member` models; `TenantStore` + `TenantAdminStore`; `InMemoryTenantStore` |
| `auth.ts`, `authz.ts`       | `Principal`, roles, `authenticate`; tenant membership + allow-list intersection    |
| `pipeline.ts`               | Shared validate → authenticate → authorize → audit pipeline                        |
| `api.ts`                    | `listWorkspaces`, `proxyCommand` / `authorizeProxyCommand` (pure handlers)         |
| `admin.ts`                  | Tenants, workspaces, grants, members, team policy, audit query                     |
| `jobs.ts`                   | Job submit/read/cancel, worker claim/output/exit, claim-time re-authorization      |
| `collab.ts`, `collab-hub.ts` | Collaboration handlers (sessions, console, documents, signaling, analytics); live fan-out, presence and the job→console bridge (§14) |
| `policy.ts`, `events.ts`    | `PolicySnapshot`; in-process tenant event bus                                      |
| `audit.ts`                  | Append-only audit contract + in-memory log                                         |
| `jwt.ts`, `identity.ts`     | Strict HS256 JWT, key ring, `JwtSessionResolver`, worker token verifier            |
| `db/*`                      | `node:sqlite` helpers, migrations, SQLite stores (tenants, audit, jobs, collaboration) |
| `http/*`                    | `node:http` server, router, rate limiter + body reader, SSE                        |
| `worker/*`                  | Worker loop, job runner, filesystem containment, HTTP client                       |
| `config.ts`, `runtime.ts`, `cli.ts`, `bin.ts` | Env config, wiring, `re-shell-control-plane` command line         |

## 3. Multi-tenant model

- A **Tenant** is the isolation boundary. It owns **Workspaces** and **Members**
  and carries a tenant-level `allowedCommandIds` *ceiling*, an optional
  `policyPack` reference and a monotonic `policyVersion`.
- A **Workspace** belongs to exactly one tenant (`tenantId` is the isolation
  key) and carries its own `allowedCommandIds` *grant*.
- The **effective** command allow-list for a workspace is the **intersection**
  `tenant.allowedCommandIds ∩ workspace.allowedCommandIds`. A permissive
  workspace entry can never exceed the tenant ceiling; a permissive tenant entry
  never auto-grants a workspace that did not opt in. Empty intersection =
  deny-all. Policy may only name commands that exist in the shared registry.
- **Membership** (`tenantId, userId, role`) is stored in the database and is the
  only source of tenant membership. Roles: `viewer < operator < admin`.
- Ids are `[A-Za-z0-9._-]{1,128}` and may not consist only of dots, so an id can
  never be a path traversal segment when a worker maps a workspace id onto a
  directory.

### Isolation guarantees (enforced + tested against BOTH stores)

1. **Tenant-first indexing / queries.** In memory, workspaces are indexed
   `tenantId → (workspaceId → Workspace)`. In SQLite, `workspaces` and
   `memberships` are keyed `(tenant_id, id)`, carry foreign keys to `tenants`,
   and every statement binds `tenant_id` as its first predicate (jobs and audit
   queries too). There is no lookup of a workspace or job by its id alone.
2. **Membership = the only source of truth.** A principal may only touch a
   tenant it is a member of; absence is a hard deny.
3. **No existence oracle.** A non-member asking about *any* tenant — real or
   absent — receives `FORBIDDEN`, never `TENANT_NOT_FOUND`.
4. **Indistinguishable 404s.** "Workspace/job does not exist" and "belongs to
   another tenant" produce the same `WORKSPACE_NOT_FOUND` / `JOB_NOT_FOUND`.
5. **Schema backstop.** Orphan or cross-wired rows cannot be stored (foreign
   keys, `CHECK` constraints on roles/status).

The isolation, authorization and API suites (`tenant.test.ts`, `authz.test.ts`,
`api.test.ts`) are **parameterized**: every test runs against the in-memory
store and the SQLite store. SQLite has no row-level security; guarantees 1 and 5
above are the equivalent, and the tests were mutation-checked (removing the
tenant predicate from a query fails them).

## 4. Identity

- **Tokens** are compact JWTs signed with **HS256** via `node:crypto`. Header
  may contain only `alg`/`typ`/`kid`; `alg` must be exactly `HS256` (no `none`,
  no algorithm confusion); `kid` selects the key; `iss`, `aud`, `sub`, `iat`,
  `exp`, `jti` and a `kind` (`user` | `worker`) are required; comparison is
  constant-time. Worker tokens additionally bind one tenant (`ten`).
- A token proves **who** is calling. It does **not** carry roles: memberships are
  read from the database on every request, so adding, demoting or removing a
  member takes effect on the very next call and a leaked user token cannot
  outlive the user's membership.
- **No oracle:** missing, malformed, tampered, wrong-kind, unknown-`kid`,
  foreign-key and expired tokens all produce the byte-identical
  `401 {"ok":false,"error":{"code":"UNAUTHENTICATED","message":"Authentication required."}}`.
  Repeated failures from one address are throttled before they reach the audit
  log.
- **Key rotation.** `CONTROL_PLANE_JWT_KEYS[_FILE]` is a key ring
  `{"activeKid": "k2", "keys": {"k1": "<b64>", "k2": "<b64>"}}`; each secret is
  ≥ 32 random bytes. New tokens use the active key; every key in the ring still
  verifies. Rotate: add the new key and make it active, wait out the longest
  token lifetime, remove the old key. `SIGHUP` reloads the ring from env/file
  without a restart (a bad file leaves the old keys in force).
- **Lifetimes.** User tokens default to 1 h (max 30 d); worker tokens to 24 h
  (max 90 d).
- **No hardcoded secrets.** Keys come from the environment or a file the
  environment points at. Secrets are never accepted as command-line flags.
- **Revocation.** Remove a user's memberships to cut access at once. There is no
  per-token denylist: revoking a single worker token means rotating the key (see
  limits).

### Bootstrap: the first admin

`issue-token` is both the token minter and the bootstrap path. On a fresh
database:

```bash
re-shell-control-plane gen-key --raw > keys.json && chmod 600 keys.json
export CONTROL_PLANE_JWT_KEYS_FILE=$PWD/keys.json CONTROL_PLANE_DB=$PWD/cp.db
# create tenant "acme" (if absent) and make alice its admin, then mint her token
re-shell-control-plane issue-token --user alice --tenant acme --role admin --raw
# let alice create further tenants through the API
export CONTROL_PLANE_PLATFORM_ADMINS=alice
```

Creating tenants through `POST /tenants` is reserved for **platform admins**
(user ids listed in `CONTROL_PLANE_PLATFORM_ADMINS`); everything else is
tenant-scoped.

## 5. Authorization and the HTTP API

All bodies are JSON objects (`application/json`), validated by strict zod
schemas — unknown fields, wrong types and attempts to repeat path/credential
fields in the body are `INVALID_REQUEST`. Every response is the CLI-shaped
envelope `{ ok, data|error, warnings }`; failure statuses come from
`HTTP_STATUS_BY_CODE`. Every code in that table is also a member of
`errorCodeSchema` in `@re-shell/contracts` (tested), so the dashboard can parse
CLI and control-plane responses with one parser.

| Method & path                                      | Needs                         | Success | Notes |
| -------------------------------------------------- | ----------------------------- | ------- | ----- |
| `GET /healthz`                                     | nothing                       | 200     | `503 SERVICE_UNAVAILABLE` when the DB is unreachable |
| `GET /me`                                          | any user token                | 200     | `{ userId, tenants: [{ tenantId, role }] }` |
| `POST /tenants`                                    | platform admin                | 201     | `{ id, name, allowedCommandIds?, policyPack?, adminUserId? }` |
| `GET  /tenants/:t/workspaces`                      | viewer                        | 200     | |
| `POST /tenants/:t/workspaces`                      | admin                         | 201     | `{ id, name, allowedCommandIds? }` |
| `PUT  /tenants/:t/workspaces/:w/grant`             | admin                         | 200     | `{ allowedCommandIds }` (workspace grant) |
| `POST /tenants/:t/workspaces/:w/commands`          | operator                      | **202** | `{ commandId, params? }` → a queued job; nothing has run yet |
| `GET  /tenants/:t/policy`                          | viewer                        | 200     | `PolicySnapshot` (ceiling, pack, version, per-workspace effective lists) |
| `PUT  /tenants/:t/policy`                          | admin                         | 200     | `{ allowedCommandIds?, policyPack? }` (pack `null` clears) |
| `GET  /tenants/:t/members`                         | admin                         | 200     | |
| `PUT  /tenants/:t/members/:u`                      | admin                         | 200     | `{ role }`; `409 CONFLICT` when it would remove the last admin |
| `DELETE /tenants/:t/members/:u`                    | admin                         | 200     | same last-admin guard |
| `GET  /tenants/:t/events`                          | viewer, or a worker of `:t`   | SSE     | team events (§7) |
| `GET  /tenants/:t/jobs[?limit&status]`             | operator                      | 200     | |
| `GET  /tenants/:t/jobs/:id[?afterSeq&outputLimit]` | operator                      | 200     | status + output chunks after a cursor (polling) |
| `GET  /tenants/:t/jobs/:id/stream`                 | operator                      | SSE     | `status`, `stdout`, `stderr`, `exit`; resumable with `Last-Event-ID` / `?afterSeq` |
| `POST /tenants/:t/jobs/:id/cancel`                 | operator                      | 200     | queued → canceled now; running → worker stops it |
| `GET  /tenants/:t/audit[?limit&beforeId&userId&workspaceId&commandId&action&decision]` | admin | 200 | newest first, paged by `nextBeforeId` |
| `POST /worker/claim`                               | worker token                  | 200     | long-poll, `{ claim: null }` when idle |
| `POST /worker/jobs/:id/output`                     | worker token (job owner)      | 200     | output chunks / heartbeat → `{ cancelRequested }` |
| `POST /worker/jobs/:id/exit`                       | worker token (job owner)      | 200     | final result |

The collaboration routes (`/tenants/:t/sessions…`, `/tenants/:t/analytics`) are
listed in §14.2.

Edge protections, all exercised by `http/server.test.ts`:

- **Rate limits** (token bucket, per process): per principal for authenticated
  calls (users 120/min, burst 60; workers 1200/min, burst 600), per address for
  anonymous calls (600/min), and a separate throttle on failed
  authentications. `429 RATE_LIMITED` with `Retry-After`. `X-Forwarded-For` is
  ignored unless `CONTROL_PLANE_TRUST_PROXY=1`.
- **Body limits:** 64 KiB for client routes, 1 MiB for worker output; a declared
  or streamed overrun is `413 PAYLOAD_TOO_LARGE`; non-JSON is `415`.
- **Security headers** on every response: `X-Content-Type-Options: nosniff`,
  `Cache-Control: no-store`, `Content-Security-Policy: default-src 'none';
  frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy:
  no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, and
  `Strict-Transport-Security` when `CONTROL_PLANE_HSTS=1`.
- **CORS** is off unless `CONTROL_PLANE_CORS_ORIGINS` lists exact origins;
  there is no wildcard and no origin reflection.
- **CSRF:** authentication is a bearer `Authorization` header — never a cookie —
  so there is no ambient credential to forge; state-changing routes also require
  `application/json`. Tokens in the query string or cookies are not accepted.
- **Streams** are bounded (10 per principal), end when their token expires, and
  end immediately when the user's membership is removed or demoted below the
  route's role. A client that stops reading is disconnected. Browsers cannot set
  an `Authorization` header on `EventSource`; use `fetch` streaming
  (`src/sse-client.ts` is a reference parser).

## 6. Command execution and workers

1. A client `POST`s `{ commandId, params }`. The server validates the pair against
   the shared registry (unknown command / bad params → `400`), then authorizes
   tenant membership + `operator` role + workspace isolation + the allow-list
   intersection, **records the decision**, and queues a durable job (`202`).
2. A worker (`re-shell-control-plane worker --tenant T --workspace-root DIR`)
   authenticates with a worker token bound to `T` and long-polls
   `POST /worker/claim`. **At claim time the server re-authorizes**: the tenant
   ceiling, the workspace grant and the requester's role are read again, so a
   policy change or a demoted requester takes effect for jobs queued before it;
   such a job is failed (`COMMAND_NOT_ALLOWED` / `REQUESTER_NOT_AUTHORIZED`),
   audited, and never handed out.
3. The claim carries the policy in force. The worker **checks it again** —
   preferring a newer policy it received over the event stream — then builds
   argv with `resolveCommand` from the shared registry. No registry entry → no
   spawn.
4. The worker maps the workspace id to `<workspace-root>/<id>` and requires the
   *real path* to be a directory inside the real root (symlinks that leave the
   root are refused); the optional `cwd` param must stay inside that directory.
5. It spawns the CLI **without a shell** (`shell: false`, argv array; a JS entry
   runs under the worker's Node) with a **scrubbed environment** (small
   allow-list: `PATH`, `HOME`, `LANG`, …; no `CONTROL_PLANE_*`, so a child never
   sees the worker token), in its own process group.
6. stdout/stderr are decoded as UTF-8 (multi-byte safe), batched and POSTed to
   `/worker/jobs/:id/output` (stored with a 4 MiB per-job cap and a `truncated`
   flag); every post doubles as a heartbeat. The final exit code (or
   `SPAWN_FAILED`, `TIMEOUT`, `CANCELED`, `WORKER_SHUTDOWN`,
   `KILLED_BY_SIGNAL`, `INVALID_PARAMS`, `WORKSPACE_UNAVAILABLE`) is reported at
   `/worker/jobs/:id/exit`.
7. **Cancel:** the flag reaches the worker on its next post; it sends `SIGTERM`
   to the process group, then `SIGKILL` after a grace period. **Leases:** a
   running job whose worker stops heartbeating for 60 s is failed `WORKER_LOST`
   and later reports are ignored. **Timeouts:** 10 min per job by default.
8. Clients poll `GET /tenants/:t/jobs/:id` or stream
   `GET /tenants/:t/jobs/:id/stream`.

A worker can only ever claim, read and finish jobs of **its own tenant**, and
only finish jobs it claimed.

## 7. Team policy sync

Two users in the same tenant both see the shared workspace
(`GET /tenants/:t/workspaces`; `workspace.created` events arrive live). An admin
updates team policy with `PUT /tenants/:t/policy` (allowed commands and an
optional policy-pack reference) or `PUT …/workspaces/:w/grant`:

1. the change is persisted and `policyVersion` is bumped;
2. a `policy.updated` event carrying the full resulting `PolicySnapshot` is
   published to every connected client **and worker** on
   `GET /tenants/:t/events`;
3. **enforcement changes immediately** — the very next authorization reads the
   new ceiling, so a previously allowed command is now
   `403 COMMAND_NOT_ALLOWED` for the same token.

Event stream: `snapshot` on connect (so a reconnecting client never misses an
update), then `policy.updated`, `workspace.created`, `job.updated`; plus
terminal `revoked` / `expired`. The `policyPack` field is an **opaque
reference** (e.g. `recommended`); the control plane stores and propagates it but
does not resolve or evaluate it.

Tested with two principals: user B receives `policy.updated` and a command that
was allowed before is refused afterwards; a worker receives the same event and
refuses a command the claim policy no longer lists.

## 8. Audit trail

Every **authorization decision** — allow or deny — is appended to `audit_log`
with `(id, ts, user_id, tenant_id, workspace_id, command_id, action, decision,
code, detail)`: command authorizations, workspace/job/policy/member reads and
writes, stream subscriptions, worker claims, audit reads, and authentication
failures (with no user). Behaviour worth knowing:

- **Recorded before acting, fails closed.** If the decision cannot be recorded,
  an `allow` becomes `500 INTERNAL_ERROR` and nothing happens; a `deny` stays a
  deny.
- **Append-only.** The API exposes one read route (`GET /tenants/:t/audit`,
  tenant **admin** only, always tenant-scoped); `POST/PUT/PATCH/DELETE` on it
  are `405`. In SQLite, `BEFORE UPDATE`/`BEFORE DELETE` triggers abort any
  modification, even from the application's own connection. Tests assert both.
- A tenant admin also sees *attempts* against their tenant by outsiders
  (`deny`/`FORBIDDEN`, with the caller's user id) — useful, and deliberate.
- Audit growth is unbounded; see limits.

## 9. Deployment

### Configuration (environment only)

| Variable                                | Meaning                                                     | Default |
| --------------------------------------- | ----------------------------------------------------------- | ------- |
| `CONTROL_PLANE_JWT_KEYS` / `_KEYS_FILE` | Signing key ring (exactly one). **Required.**               | —       |
| `CONTROL_PLANE_JWT_ACTIVE_KID`          | Overrides the ring's `activeKid`                            | —       |
| `CONTROL_PLANE_JWT_ISSUER` / `_AUDIENCE`| Token `iss` / `aud`                                         | `re-shell-control-plane` |
| `CONTROL_PLANE_HOST`, `CONTROL_PLANE_PORT` | Bind address / port                                      | `127.0.0.1`, `8787` |
| `CONTROL_PLANE_DB`                      | SQLite file                                                 | `./control-plane.db` |
| `CONTROL_PLANE_PLATFORM_ADMINS`         | Comma-separated user ids allowed to create tenants          | none |
| `CONTROL_PLANE_CORS_ORIGINS`            | Exact allowed browser origins (no wildcard)                 | none |
| `CONTROL_PLANE_TRUST_PROXY`, `CONTROL_PLANE_HSTS` | `1` behind a reverse proxy you control / behind TLS | off |
| `CONTROL_PLANE_RATE_LIMIT_PER_MINUTE`, `…_BODY_LIMIT_BYTES`, `…_MAX_QUEUED_PER_TENANT`, `…_LEASE_MS` | Tuning | 120, 65536, 100, 60000 |
| `CONTROL_PLANE_MAX_ACTIVE_SESSIONS`     | Active shared sessions per tenant (§14)                     | 50 |
| `CONTROL_PLANE_ICE_SERVERS`             | JSON array of WebRTC STUN/TURN servers handed to session participants (§14.4) | none = host candidates only |
| Worker: `CONTROL_PLANE_URL`, `CONTROL_PLANE_TENANT`, `CONTROL_PLANE_WORKSPACE_ROOT`, `CONTROL_PLANE_WORKER_TOKEN` or `_TOKEN_FILE`, `RE_SHELL_CLI_BIN`, `CONTROL_PLANE_WORKER_CONCURRENCY` | Worker config (flags `--tenant --workspace-root --url --token-file --cli-bin --concurrency` override) | — |

A bad or missing setting exits non-zero with `{"ok":false,"error":{"code":"CONFIG_ERROR",…}}`.

### The `re-shell-control-plane` bin

```
re-shell-control-plane serve         run the API (logs JSON lines to stderr; SIGTERM = graceful stop, SIGHUP = reload keys)
re-shell-control-plane worker        run an execution worker for one tenant
re-shell-control-plane issue-token   --user <id> [--tenant <id> --role <r>]   (bootstrap)  |  --worker --worker-id <id> --tenant <id>
re-shell-control-plane gen-key       generate a signing key file
re-shell-control-plane migrate       apply DB migrations (serve also does this on start)
```

### Docker

`packages/control-plane/Dockerfile` is multi-stage with two targets
(`control-plane`, `worker`); build from the **repository root**:

```bash
docker build -f packages/control-plane/Dockerfile --target control-plane -t re-shell/control-plane .
docker build -f packages/control-plane/Dockerfile --target worker        -t re-shell/control-plane-worker .
```

The build stage installs only the needed workspace subset, compiles, and
`pnpm deploy`s two production trees; the runtime images are
`node:22-bookworm-slim`, run as the unprivileged `node` user, keep the database
on a `/data` volume, and contain no native addons (SQLite is Node's built-in
`node:sqlite`). `HEALTHCHECK` calls `/healthz`. Behind a TLS-intercepting proxy
pass its CA as a build secret: `--secret id=cacert,src=/path/ca.crt`. The worker
image does not include `git`; add OS packages with
`--build-arg WORKER_APT_PACKAGES="git"`. The CLI does not declare its `zod`
dependency (it only resolves through monorepo hoisting), so the Dockerfile links
the `zod` that `@re-shell/contracts` brings into the deployed CLI tree — a
documented workaround to remove once `packages/cli` declares it.

Verified locally (Docker 29, Node 22 image): both targets build; the server
container reports `healthy`, answers `GET /healthz` with 200 and rejects
unauthenticated `/me` with 401; a worker container on the same network claimed a
job and ran the real CLI against a mounted fixture workspace (`succeeded`, exit
0). This was not run in CI and not on any remote host.

`packages/control-plane/docker-compose.yml` runs the control plane plus one
worker, publishing the API on loopback only:

```bash
cd packages/control-plane
docker compose build
cp .env.example .env                       # then edit; never commit it
docker run --rm re-shell/control-plane:local gen-key --raw      # paste into CONTROL_PLANE_JWT_KEYS
docker compose run --rm control-plane issue-token --user alice --tenant acme --role admin --raw   # bootstrap admin
docker compose run --rm control-plane issue-token --worker --worker-id w1 --tenant acme --raw     # → CONTROL_PLANE_WORKER_TOKEN
mkdir -p workspaces/demo                   # one directory per workspace id
docker compose up -d
curl -fsS http://127.0.0.1:8787/healthz
```

## 10. What is tested

`pnpm --filter @re-shell/control-plane test` (vitest, ~270 tests, coverage gated
at 80% and currently ~90%; CI runs it after the build because the end-to-end
suites need the built CLI):

- **Isolation / authz / API** against both stores (parameterized); admin writes,
  policy versions, last-admin guard; migrations (fresh, partial, newer-than-build,
  failure rolls back); persistence across reopen.
- **Identity:** alg-confusion, header injection, tampering, rotation, expiry,
  no-oracle equality of failure responses, live membership.
- **HTTP edge:** validation, limits (declared and streamed bodies), rate limits,
  CORS, security headers, status mapping.
- **Policy sync** with two users and a worker; stream revocation and expiry.
- **Jobs:** queue, claim-time enforcement, cancel, leases, output caps,
  ownership.
- **Workers with real child processes:** argv, cwd containment (including
  symlinks), environment scrubbing, no-shell literal argv, SIGTERM/SIGKILL,
  timeout, shutdown, output integrity.
- **End to end with the real CLI:** server + worker + `packages/cli/dist` +
  a fixture workspace — POST a command, stream the real result and exit code.
- **Built bin as real processes:** `gen-key` → bootstrap `issue-token` → `serve`
  → `worker` → job → graceful stop → restart with persisted data.
- **Audit:** every decision recorded, admin-only, tenant-scoped, no write route,
  database rejects UPDATE/DELETE, fails closed.
- **Collaboration:** sessions, the shared console, OT documents, signaling and
  analytics — see §14.9.

## 11. Persistence

SQLite via `node:sqlite` (Node ≥ 22.13; WAL, foreign keys, busy timeout).
Migrations are forward-only, transactional, recorded in `schema_migrations`, and
refuse a database newer than the binary. Back up by copying the database with
the `-wal`/`-shm` files or `VACUUM INTO`; `/data` is the only state.

## 12. How the original spec items landed

| Original outline item (§6 of the scaffold)             | Status |
| ------------------------------------------------------ | ------ |
| HTTP edge, status mapping, rate limit, headers         | **Done** (`node:http`; CSRF n/a, bearer-only) |
| Identity provider: signed tokens, rotation             | **Done** (HS256 JWT issued by this service's own CLI). **Not done:** OIDC/SSO federation |
| Persistent tenant store with isolation                 | **Done** on SQLite (code-level isolation). **Not done:** Postgres / row-level security |
| Per-tenant execution workers                           | **Done** (long-poll workers, shared registry, containment) |
| Observability & audit                                  | **Done:** append-only audit + JSON request logs. **Not done:** metrics/tracing |
| Deployment                                             | **Done:** Dockerfile + Compose, image built and `/healthz` checked locally. **Not done:** any real hosting |

## 13. Remaining limits

Be honest about these before exposing it:

- **Not deployed.** Nothing runs on a public host; no TLS is terminated by the
  service (put a TLS-terminating reverse proxy in front and set
  `CONTROL_PLANE_TRUST_PROXY`/`CONTROL_PLANE_HSTS`).
- **Single node.** SQLite, in-process event bus, in-memory rate limiters and a
  per-process job reaper. Horizontal scale-out needs a shared database and
  broker behind the same interfaces; a second server process on one database
  would work for reads but would not share SSE events or rate-limit state.
- **Isolation is enforced in code and schema, not by the database engine.**
  There is no row-level security (SQLite has none). The audit triggers can be
  dropped by anyone with raw database access; ship the log to external immutable
  storage if that is in your threat model. Audit and job output grow without a
  retention policy.
- **Identity is self-issued.** Tokens are minted by the operator's CLI with a
  shared HS256 key; there is no OIDC/SSO, no password or session login, and no
  per-token revocation list (remove memberships, or rotate the key to revoke a
  worker token).
- **`node:sqlite` is experimental** in Node 22 (it prints an `ExperimentalWarning`
  at start-up) and requires Node ≥ 22.13.
- **Workers are trusted hosts.** A worker runs the CLI as its own OS user in a
  directory you mount; it is containment-checked and env-scrubbed, not
  sandboxed (no container-per-job, no seccomp, no network policy). Run workers
  in isolated containers/VMs. In-flight jobs are not interrupted by a policy
  change (queued jobs are re-checked at claim time).
- **`policyPack` is a reference only**; the control plane does not fetch or
  evaluate packs.
- **The dashboard covers collaboration only.** The Collaboration screen (§14.8)
  consumes the session and analytics API; tenant/policy/member administration
  and the audit log still have no UI (use the API or the CLI).
- **Not externally reviewed or load-tested.** The security properties above are
  covered by tests in this repository, not by an independent audit.

## 14. Collaboration (P9-N)

Real-time pair programming on top of the control plane: **shared terminal
sessions**, **shared editing**, **WebRTC pairing links** and **team analytics**.
All of it is multi-user, authenticated with the same bearer tokens, tenant-scoped
like everything else, and audited. Clients are `re-shell collab session ...`
(§14.7), the dashboard's **Collaboration** screen (§14.8) and any HTTP client.

### 14.1 The session model

A **session** belongs to one `(tenant, workspace)`. It has an **owner** (the
creator), a **driver** (initially the owner) and **participants**. Participants
are `driver` (exactly one, or nobody) or `viewer`.

| Who                         | Can                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| tenant `viewer`             | nothing here (console output is job output, which already needs `operator`)               |
| tenant `operator`+          | create, list, read, join, leave sessions; edit documents; signal/relay to participants    |
| the **driver**              | run allow-listed commands, cancel the running command, hand control to a participant      |
| the **owner**               | everything the driver can, at any time (the escape hatch for a driver who went away); end |
| a tenant `admin`            | end any session, cancel the running command                                                |

Control moves with `POST …/handover {toUserId}`. The target must have **joined**
and must still hold the `operator` role in the tenant (read live, so a demoted
user cannot be handed the keyboard). A driver who leaves hands control back to
the owner if the owner is present, otherwise to nobody (the owner can reassign).
A session ends with `POST …/end` (owner or admin) and is then read-only history;
ending is refused (`SESSION_BUSY`) while a command is queued or running.

### 14.2 Shared terminal sessions

**The shared state is the session's command console**: the ordered history of
runs with their streamed output, the currently queued/running run, the
participants and who drives. It is **the fold of an append-only, sequence-numbered
event log** (`collab_events`, one total order per session):

```
snapshot(seq N)  ==  fold(events 1..N)          (tested at every step)
```

Events: `session.started`, `participant.joined|left`, `control.handover`,
`command.queued|started|output|finished`, `doc.created`, `doc.op`, `session.ended`.
`@re-shell/contracts` ships the one reducer (`applyCollabEvent`) used by the
server tests, the CLI and the dashboard.

**Execution goes through the existing job and worker path — nothing new can run
anything.** `POST …/run {commandId, params}` is one authorization chain (tenant
role, session, *is the caller the driver*, nothing already running), audited as
`session.run`; the command is then handed to the ordinary job submit
(`command.authorize` audit entry, registry validation, tenant-ceiling ∩
workspace-grant allow-list, queue limits). A worker claims it (re-authorizing at
claim time, as in §6), runs the real CLI, and streams output. A small bridge
inside the server follows the job (wake-ups from the event bus plus a 500 ms
safety poll) and logs `command.started`, every output chunk (numbered like the
job's own chunks) and `command.finished` — in **one transaction per pump**, so
every participant sees the same events in the same order. The run's state lives
in `collab_runs` and mirrors what has been *logged*, never the raw job row. A
run that is in flight when the server stops is picked back up on the next start.
Only one command is queued/running per session.

**Sync protocol** — `GET /tenants/:t/sessions/:s/stream` (SSE; the bearer token
travels in the `Authorization` header, so browsers use `fetch` streaming):

| Event (SSE `event:`)      | `id:`  | Meaning                                                                           |
| ------------------------- | ------ | --------------------------------------------------------------------------------- |
| `snapshot`                | seq    | full state; sent on a fresh connect, or when a resume is impossible               |
| *a logged event type*     | seq    | `{seq,type,ts,actor,data}`, strictly consecutive                                  |
| `ready`                   | —      | `{seq}`: the catch-up is complete; live events follow                             |
| `presence`                | —      | `{online:[…]}`, the full roster of users with a live stream (ephemeral, resent on every connect) |
| `signal` / `relay`        | —      | WebRTC signaling / relayed peer message **addressed to this user** (ephemeral)    |
| `revoked`, `expired`      | —      | access removed / token expired; the stream ends                                   |

A late joiner gets a `snapshot` (output budget 2 MiB, newest runs win; trimmed
runs carry `outputDropped`) and then increments. A reconnecting client resumes
with `?afterSeq=N` (or `Last-Event-ID`) and receives exactly the missed events —
no snapshot, no gaps, no duplicates — because the snapshot (or replay) is taken
and the listener is registered in one synchronous step. If the cursor is in the
future or more than 20 000 events behind, the server sends a fresh `snapshot`.
`GET …/events?afterSeq=&limit=` (≤ 500 per page) serves the same log over plain HTTP.
An ended session's stream delivers its snapshot (or replay) and closes.

| Method & path (all under `/tenants/:t`)               | Needs               | Notes |
| ----------------------------------------------------- | ------------------- | ----- |
| `POST /sessions`                                      | operator            | `{workspaceId, title?}` → 201 snapshot; the caller owns and drives |
| `GET /sessions[?status&workspaceId&limit]`            | operator            | summaries with participant / online / run counts |
| `GET /sessions/:s`                                    | operator            | snapshot (reading does not join) |
| `POST /sessions/:s/join` · `/leave`                   | operator            | idempotent; a new participant is a `viewer` |
| `POST /sessions/:s/run`                               | driver              | **202**, `{commandId, params?}` → queued job; `403 NOT_SESSION_DRIVER`, `409 SESSION_BUSY` |
| `POST /sessions/:s/cancel`                            | driver, owner, admin | cancels the current run |
| `POST /sessions/:s/handover`                          | driver or owner     | `{toUserId}` |
| `POST /sessions/:s/end`                               | owner or admin      | `{reason?}` |
| `GET /sessions/:s/stream` · `/events`                 | operator            | SSE / log pages |
| `GET\|POST /sessions/:s/docs`, `GET /docs/:d`         | operator (+ seat to create) | §14.3 |
| `POST /sessions/:s/docs/:d/ops` · `GET …/ops?afterRev=` | operator + seat   | §14.3 |
| `POST /sessions/:s/signal` · `/relay`                 | operator + seat     | §14.4 |
| `GET /analytics[?from&to&workspaceId]`                | operator            | §14.5 |

New error codes (also members of the shared `errorCodeSchema`): `SESSION_NOT_FOUND`
(404, identical for "another tenant's"), `SESSION_ENDED` (409), `SESSION_BUSY`
(409), `NOT_SESSION_DRIVER` (403), `PARTICIPANT_NOT_FOUND` (404),
`DOCUMENT_NOT_FOUND` (404).

### 14.3 Shared editing (operational transformation)

Each session has a `notes` document and may hold up to 8 text documents in all (one
can be a **workspace YAML draft**, `kind: "yaml-draft"`). Documents are text only: nothing
ever writes a draft to a workspace or applies it.

**Why OT and not Yjs.** The control plane is a single-node, server-ordered
service whose every other resource is a sequence-numbered log. Server-ordered OT
fits that exactly: the server validates every operation (size, base length,
well-formed UTF-16) before it is persisted, needs no binary update format and no
new dependency in the server, CLI or browser, and a document is just
`(content, rev)` plus a readable JSON op log in the same session log. A CRDT
earns its keep when peers must converge *without* a central orderer; here there
always is one. The cost — transform functions — is paid once in
`@re-shell/contracts` (`ot.ts`) and covered by randomized tests.

* An operation is a list of components: positive int = retain, negative int =
  delete, string = insert (UTF-16 code units). The server transforms a client op
  `(baseRev, ops)` over every op committed since `baseRev` (committed ops win
  ties), applies it, assigns revision `rev + 1`, and logs `doc.op` — **one
  transaction**, so the doc row, the revision and the broadcast agree.
* The **author learns its edit was accepted from the committed op arriving on the
  stream**, so a lost HTTP response is harmless; resending the same
  `(clientId, clientSeq)` is applied once (`duplicate: true`).
* The client (`SharedDocSync`) keeps at most one op in flight and composes the rest
  (the Jupiter protocol), so typing is never blocked on the network.
* Refused: ops spanning more than the document at `baseRev` (`400`), a result with
  a split surrogate pair (it would not survive UTF-8 storage), `baseRev` from the
  future, more than 10 000 revisions behind (`409`, reload), > 256 KiB documents
  (`413`), > 64 K inserted characters per op (the request body is capped at 64 KiB).
* Documents survive a server restart (they are in SQLite); a client holding a
  pre-restart revision can still commit.

### 14.4 WebRTC pairing links and the relay fallback

`POST …/signal {to, kind: offer|answer|candidate|bye, connectionId, payload}`
relays one signaling message to **one other participant**, over the authenticated
channel. The server stamps `from` itself (a body that names `from` is rejected),
delivers only to the addressee's authenticated streams, never stores it, and
both ends must be **joined participants of that session** — sessions are looked up
tenant-first, so a message can never cross tenants (tested). Payloads are capped
at 16 KiB. The response says whether the peer had a live stream.

The dashboard opens an `RTCPeerConnection` **data channel** between each pair of
online participants (smaller user id offers, so there is no glare) and uses it
for presence cursors and pairing pings. **Host candidates only by default**: with
no ICE servers configured none are used. STUN/TURN are configurable:
`CONTROL_PLANE_ICE_SERVERS='[{"urls":"stun:stun.example.org:3478"}]'` is handed
to every participant in the session snapshot (`rtc.iceServers`); a user can also
override it in the dashboard's connection settings. TURN entries must carry
credentials. **These values are visible to every participant — use short-lived
TURN credentials, not a long-lived secret.**

**Fallback.** If the channel does not open in 8 s, ICE fails, the channel closes
or the browser has no WebRTC, the link switches to `POST …/relay {to?, channel:
ping|cursor|presence, payload}`: the same messages, relayed through the server to
one participant or to all others (ephemeral, 4 KiB cap). The panel shows which
transport each peer link uses (`p2p` / `relay`) and why it fell back.

### 14.5 Team analytics

`GET /tenants/:t/analytics?from=&to=&workspaceId=` (operator; default window the
last 7 days, max 366 days) returns per-tenant aggregates:

* **commands** (from `jobs`): total / succeeded / failed / canceled / active,
  success rate (`succeeded / (succeeded + failed)`; `null` when nothing finished),
  and the same counts **per user, per workspace and per command**;
* **sessions** (from the session tables): started / active / ended, total / average /
  max duration (active sessions count until *now*), distinct and average
  participants, commands run from sessions, per workspace;
* **audit** (from `audit_log`): allowed / denied decisions, auth failures, denials
  by code;
* **timeline**: commands, failures and session starts per bucket (1 min … 1 day,
  chosen so a window has ≤ 120 buckets).

Everything is tenant-scoped in SQL (`tenant_id = ?` first); another tenant's
activity never appears (tested).

### 14.6 Audit

Every collaboration decision is recorded before it is acted on, like §8:
`session.create|list|read|join|leave|end|run|cancel|handover|stream`,
`doc.create|read|edit`, `signal.send`, `relay.send`, `analytics.read`. A viewer's
refused `run` is `deny / NOT_SESSION_DRIVER` in the admin's audit view, followed
(when allowed) by the ordinary `command.authorize` entry from the job path.
**High-frequency traffic is sampled:** every *denial* of `doc.edit`, `signal.send`
and `relay.send` is audited, but an *allow* only the first time a user does that
action in a session (per process) — individual document ops are in the session log
itself with their author, and auditing every keystroke would swamp the append-only
log. (An allow that cannot be recorded still fails closed.) Collaboration writes
have their own, higher, per-principal rate budget (1 200/min, burst 200).

### 14.7 CLI

```
re-shell collab session start    --workspace <id> [--title <t>]
re-shell collab session list     [--status active|ended] [--workspace <id>] [--limit n]
re-shell collab session join     <sessionId>         # TTY: live shared console · piped / --json: snapshot
re-shell collab session run      <sessionId> <commandId> [--param k=v]… [--params-json '{}'] [--no-wait] [--timeout s]
re-shell collab session handover <sessionId> <userId>
re-shell collab session cancel   <sessionId>
re-shell collab session end      <sessionId> [--reason <text>]
```

Every command accepts `--json` (the standard envelope; failures carry the
control plane's error code and exit non-zero; a command that *ran and failed* is
`ok:false` with the run in `error.details`). Connection settings come from, in
order: flags (`--url`, `--token-file`, `--token`, `--tenant`), the environment
(`RE_SHELL_CONTROL_PLANE_URL`, `_TOKEN`, `_TOKEN_FILE`, `_TENANT`; the worker's
`CONTROL_PLANE_URL` / `_TENANT` are honoured too), then
`~/.re-shell/control-plane.json` (`{url, tenant, token?, tokenFile?}`, or
`RE_SHELL_CONTROL_PLANE_CONFIG`). A token with one tenant needs no `--tenant`.
`--token` and an `http://` non-loopback URL produce warnings; a config file
holding a token that others can read does too. Remote command output is stripped
of terminal escape sequences before it reaches your terminal. The older
`collab webrtc-sharing | terminal-broadcasting | operational-transform | …`
commands remain as **code generators** (they write starter code and talk to no
server) and are labelled as such in `--help`.

### 14.8 Dashboard

**Collaboration** (sidebar → Team) has: control-plane connection settings (URL,
tenant, token — the token lives in `sessionStorage` unless "remember" is ticked —
and an optional ICE override), the sessions list with a start form, the shared
console (run form for the driver, cancel, hand over, take control), presence with
the WebRTC link state per peer, the shared editor with remote cursors, and the
analytics panel. The control plane must list the dashboard's origin in
`CONTROL_PLANE_CORS_ORIGINS`.

### 14.9 What is tested

* **OT** (`contracts/src/ot.test.ts`): TP1 and compose properties over thousands of
  seeded random op pairs; multi-client convergence with arbitrary delivery order
  (3 and 5 clients, many seeds); surrogate-pair safety; the client state machine.
* **Server, real HTTP + SQLite + JWT** (`collab.test.ts`, `collab-docs.test.ts`):
  lifecycle, authorization and audit (a viewer's run is refused and recorded),
  streams (late-join snapshot, resume, presence, ordered identical events),
  tenant isolation incl. signaling, document validation, retried ops, **four
  clients (one user on two devices) typing concurrently end with identical text**,
  persistence **across a server restart**, analytics.
* **Acceptance** (`e2e/collab.e2e.test.ts`): two authenticated users join one
  session; the driver's command is executed by a **real worker with the real built
  CLI**; both clients receive the identical ordered output and final state; the
  viewer cannot run; control hands over; a late joiner gets the history; a run
  queued before a restart completes after it.
* **CLI** (`cli/tests/integration/collab-session-cli.test.ts`): the built CLI as
  separate processes against the built control-plane bin and worker.
* **Dashboard**: component and screen tests (jsdom), the WebRTC `PeerLink` against
  an RTCPeerConnection fake, and `apps/web/e2e/collab.spec.ts` — **Playwright
  with two browser contexts (two users) against the real control plane**: a real
  data channel opens (host candidates), a ping travels over it, the console, the
  editor and analytics work, and with WebRTC disabled in one browser the relay
  fallback carries the messages.

### 14.10 Limits

* **Single node.** Fan-out, presence and the run bridge are in-process (like the
  event bus); a second server process on one database would not see the other's
  streams. Presence is recomputed from live connections, never stored.
* **No end-to-end encryption.** Console output and documents are visible to the
  server and its operators and are stored in SQLite (the event log is append-only
  but is **not** compacted or expired: a session is capped at 200 000 events, a
  job at 4 MiB of output). Do not run commands whose output must not be retained.
* **WebRTC is a mesh** (one link per peer, at most 8). Behind symmetric NATs a
  direct link needs a TURN server, which this repository does not ship or deploy;
  the relay fallback covers that case at server cost. Remote cursors are shared
  as raw offsets and are not transformed against later edits.
* **Plain text only.** No rich text, no per-document ACLs (any operator in the
  session may edit), no presence typing indicators.
* **Output in a snapshot is bounded** (2 MiB); older output is available through
  `GET …/events`.
* Sessions are never expired automatically; end them (owner/admin).
