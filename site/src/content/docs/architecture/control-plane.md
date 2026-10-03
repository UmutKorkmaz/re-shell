---
title: "Control Plane"
description: "The hosted, multi-tenant Re-Shell control plane: tokens, tenants, workers, policy sync, audit. Implemented and tested; not deployed."
---

> **Status: implemented and tested, packaged for Docker, not deployed.**
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
| Identity | Implicit (loopback owner) | Signed bearer tokens (HS256 JWT, key rotation, expiry) |
| Tenancy | One workspace root | Many tenants, each with workspaces and members (`viewer`, `operator`, `admin`) |
| Command allow-list | Static registry | The same registry intersected with the tenant ceiling and the workspace grant |
| Execution | Spawns the CLI in-process | Authorizes, queues a job; a **worker** spawns the CLI |
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
  policy, contain the working directory, scrub the environment and spawn the real CLI
  without a shell, streaming output back.
- **Team policy sync** over SSE (a policy change reaches connected clients and workers).
- **Append-only audit** of every decision, recorded before the action; the database
  rejects updates and deletes.
- **Docker**: a multi-stage `Dockerfile` (`control-plane` and `worker` targets) and a
  Compose file that publishes the API on loopback only.

## Running it

```bash
node packages/control-plane/dist/bin.js gen-key --raw        # signing key
export CONTROL_PLANE_JWT_KEYS='{"activeKid":"key-1","keys":{"key-1":"<secret>"}}'
export CONTROL_PLANE_DB=./control-plane.db
node packages/control-plane/dist/bin.js issue-token --user alice --tenant acme --role admin --raw
node packages/control-plane/dist/bin.js serve
node packages/control-plane/dist/bin.js worker --tenant acme --workspace-root ./workspaces --url http://127.0.0.1:8787 --token-file ./worker.token
```

Configuration is environment-only (`CONTROL_PLANE_*`); a bad or missing setting exits
non-zero with a `CONFIG_ERROR` envelope. `CONTROL_PLANE_CORS_ORIGINS` must list the
dashboard's origin for the Collaboration screen to work.

## What was tested

Isolation, authorization and the HTTP edge against both stores; token handling
(algorithm confusion, tampering, rotation, expiry); jobs and workers with real child
processes; the built bin as real processes; an end-to-end run with the real built CLI
(server + worker + `packages/cli/dist` + a fixture workspace); the audit guarantees; and
the collaboration stack. Coverage is gated at 80% in CI. The Docker images were built
and `/healthz` was checked locally once; that was not run in CI and not on any remote
host.

## Limits

- **Not deployed.** Nothing runs on a public host. The service terminates no TLS: put a
  TLS-terminating reverse proxy in front.
- **Single node.** SQLite, an in-process event bus and in-memory rate limits. A second
  server process on one database would not share events or rate-limit state.
- **Identity is self-issued.** There is no OIDC/SSO and no per-token revocation list
  (remove memberships or rotate the key).
- **Isolation is enforced in code and schema, not by the database engine** (SQLite has no
  row-level security), and audit triggers can be dropped by anyone with raw database access.
- **Workers are trusted hosts**: containment-checked and environment-scrubbed, not
  sandboxed. Run them in isolated containers or VMs.
- `node:sqlite` is experimental in Node 22 (it prints an `ExperimentalWarning`).
- **Not externally reviewed or load-tested.**
- The dashboard covers collaboration only; tenant, policy and member administration and
  the audit log have no UI.

## See also

- [Collaboration](/re-shell/integrations/collaboration/): the shared sessions built on it.
- [Secure Hub](/re-shell/architecture/secure-hub/): the single-user ancestor.
- [Roadmap](/re-shell/roadmap/).
