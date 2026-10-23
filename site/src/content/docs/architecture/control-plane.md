---
title: "Control Plane"
description: "The multi-tenant Re-Shell control plane: OIDC, workers, policy sync, tracing and audit. Verified in local staging; not publicly hosted."
---

> **Status: source 0.2.0, verified in local staging, not publicly hosted.**
> `@re-shell/control-plane` is a private package in the monorepo. It has not been
> deployed to any public host, has had no external security review, and is single-node
> by design. Read [Limits](#limits) before putting it on a network. The full
> design document is
> [`docs/control-plane.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/control-plane.md).

## Why it exists

The local [hub](/re-shell/architecture/secure-hub/) lets one developer drive the CLI
from a browser on their own machine: one user, one workspace, trust in the loopback
boundary. The control plane generalizes that to a **hosted, multi-tenant** service for
teams, with the same allow-list discipline.

| Concern | Local hub | Control plane |
| --- | --- | --- |
| Identity | Implicit (loopback owner) | Internal HS256 tokens; pinned RS256 OIDC and browser PKCE, renewal and logout |
| Tenancy | One workspace root | Many tenants, each with workspaces and members (`viewer`, `operator`, `admin`) |
| Command allow-list | Static registry | The same registry intersected with the tenant ceiling and the workspace grant |
| Execution | Spawns the CLI in-process | Authorizes and queues; a **worker** runs explicit process or per-job Docker mode |
| Collaboration | None | [Shared sessions](/re-shell/integrations/collaboration/) |
| Trust boundary | localhost | Network: authentication, authorization, rate limits and audit on every call |

There is exactly one registry of runnable commands and one argv builder
(`@re-shell/contracts/command-registry`). The control plane never builds argv and never
spawns anything itself.

## What is in it

- **HTTP/SSE API** on `node:http` (default `127.0.0.1:8787`), with request validation,
  body and rate limits, exact-origin CORS and security headers.
- **SQLite** persistence through Node's built-in `node:sqlite` (Node 22.13 or newer),
  with transactional forward-only migrations.
- **Tenant isolation** enforced in code and queries, tested against both the in-memory
  and SQLite stores.
- **Workers** (`re-shell-control-plane worker`) that claim authorized jobs, re-check
  policy and run the real CLI without a shell. Explicit process mode is trusted local
  execution; Docker mode uses a separate non-root, network-disabled container per job
  with a pinned image, exact workspace mount and CPU/memory/pids bounds. See
  [job isolation](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/job-isolation.md).
- **Identity**: internal HS256 tokens, pinned RS256 external access tokens, browser
  authorization code with S256 PKCE, memory-only refresh credentials, renewal/rotation,
  optional provider revocation/logout and durable individual-token API revocation.
- **Tracing and recovery**: opt-in OTLP HTTP JSON across API/job/worker boundaries and
  consistent SQLite WAL snapshots with offline restore/rollback. See
  [observability](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/observability.md).
- **Team policy sync** over SSE (a policy change reaches connected clients and workers).
- **Append-only audit** of every decision, recorded before the action; the database
  rejects updates and deletes.
- **Docker**: a multi-stage `Dockerfile` (`control-plane`, `worker` and `job` targets)
  and a Compose file publishing the API on loopback only. The Compose worker is an
  explicit process-mode development profile; the Docker orchestration worker uses a
  dedicated local daemon and never mounts its socket into a job.

## Running it

```bash
node packages/control-plane/dist/bin.js gen-key --raw        # signing key
export CONTROL_PLANE_JWT_KEYS='{"activeKid":"key-1","keys":{"key-1":"<secret>"}}'
export CONTROL_PLANE_DB=./control-plane.db
node packages/control-plane/dist/bin.js issue-token --user alice --tenant acme --role admin --raw
node packages/control-plane/dist/bin.js serve
node packages/control-plane/dist/bin.js worker --mode process --tenant acme --workspace-root ./workspaces --url http://127.0.0.1:8787 --token-file ./worker.token
```

Configuration is environment-only (`CONTROL_PLANE_*`); a bad or missing setting exits
non-zero with a `CONFIG_ERROR` envelope. `CONTROL_PLANE_CORS_ORIGINS` must list the
dashboard's origin for the Collaboration screen to work.

## What was tested

Isolation, authorization and the HTTP edge against both stores; token handling
(algorithm confusion, tampering, rotation, expiry); jobs and workers with real child
processes; the built bin as real processes; an end-to-end run with the real built CLI
(server + worker + `packages/cli/dist` + a fixture workspace); the audit guarantees; and
the collaboration stack. The configured CI coverage gate is 80%; hosted results
are in the [CI workflow](https://github.com/UmutKorkmaz/re-shell/actions/workflows/ci.yml).
The October 23 full control-plane suite
passes **402** tests and skips **7** optional tests, with **89.85%** statement,
**84.09%** branch, **93.32%** function and **91.73%** line coverage.

On October 23, **8** tracing/operations tests passed with a local OTLP HTTP receiver,
separate built API and worker processes, a live WAL snapshot/restore, persisted
roles/revocations/audit/queued trace context and expired-lease recovery. All **7** real
Docker isolation checks passed, including actual allowlisted CLI execution, resource
inspection, scoped recovery and timeout/cancellation/shutdown/output-limit cleanup.
Local forced TURN relay also passed in two browser contexts. These are local integration
results, separate from remote hosting. The full genuine Keycloak **26.4.0** lifecycle
passes against the frozen production dashboard: password/PKCE login,
issuer/callback/audience/membership checks, proactive refresh rotation, exact latest
token revocation and provider logout. The previously accepted API JWT is denied
after sign-out while still unexpired; a new login requires a password, and consumed
refresh replay is rejected in an independent fresh session. All **39** SSO tests
pass, including the reviewed native-browser fetch sign-out regression. See
[development status](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/DEVELOPMENT_STATUS.md)
for the complete current gates.

## Limits

- **Not deployed.** Nothing runs on a public host. The service terminates no TLS: put a
  TLS-terminating reverse proxy in front.
- **Single node.** SQLite, an in-process event bus and in-memory rate limits. A second
  server process on one database would not share events or rate-limit state.
- **Provider compatibility is a separate gate.** Pinned OIDC, browser PKCE,
  renewal/rotation and logout are implemented; fixture coverage does not prove
  real-provider behavior. Local API token denial is separate from provider-wide
  session invalidation. See [OIDC](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/OIDC.md).
- **Isolation is enforced in code and schema, not by the database engine** (SQLite has no
  row-level security), and audit triggers can be dropped by anyone with raw database access.
- **Workers use an explicit trust mode.** Process mode has host permissions and no
  sandbox boundary. Docker mode requires a dedicated trusted daemon; containers share
  a Linux kernel. Hostile-tenant production isolation is not established.
- `node:sqlite` is experimental in Node 22 (it prints an `ExperimentalWarning`).
- **Not externally reviewed or load-tested.**
- The dashboard includes Collaboration and Administration for tenant/policy/member
  management and audit records, using manual bearer or configured browser SSO.
- Public cloud hosting was not requested; multi-node operation is outside this release scope.

## See also

- [Collaboration](/re-shell/integrations/collaboration/): the shared sessions built on it.
- [Secure Hub](/re-shell/architecture/secure-hub/): the single-user ancestor.
- [Roadmap](/re-shell/roadmap/).
