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
| Collaboration      | None                           | Shared workspaces, roles, live team-policy sync (SSE)      |
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
| `policy.ts`, `events.ts`    | `PolicySnapshot`; in-process tenant event bus                                      |
| `audit.ts`                  | Append-only audit contract + in-memory log                                         |
| `jwt.ts`, `identity.ts`     | Strict HS256 JWT, key ring, `JwtSessionResolver`, worker token verifier            |
| `db/*`                      | `node:sqlite` helpers, migrations, SQLite stores (tenants, audit, jobs)            |
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
- **No dashboard UI here.** The multi-user dashboard is a separate workstream
  that consumes this HTTP/SSE API.
- **Not externally reviewed or load-tested.** The security properties above are
  covered by tests in this repository, not by an independent audit.
