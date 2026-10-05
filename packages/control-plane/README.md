# @re-shell/control-plane

The hosted, multi-tenant Re-Shell control plane (P9-J) with real-time collaboration
(P9-N). Part of the [Re-Shell monorepo](https://github.com/UmutKorkmaz/re-shell).

> **Status: implemented and tested, packaged for Docker, NOT deployed.** The package is
> `private` (it is not published to npm). It has not been deployed to any public host,
> has had no external security review, and is single-node by design (SQLite, in-process
> event bus). Read [`docs/control-plane.md`](../../docs/control-plane.md), especially
> section 13 (remaining limits) and section 14.10 (collaboration limits), before putting
> it on a network.

## What it is

- An authenticated HTTP/SSE API (`node:http`) with signed HS256 bearer tokens (key
  rotation, expiry), tenants, workspaces, memberships (`viewer` / `operator` / `admin`)
  and an append-only audit trail.
- A job queue and **workers** that run the allow-listed Re-Shell CLI (the same command
  registry as the local hub, `@re-shell/contracts/command-registry`), with cwd
  containment, no shell and a scrubbed environment.
- Live team policy sync over SSE.
- **Collaboration**: shared console sessions (driver / viewer, hand-over), operational-
  transform shared editing, WebRTC signaling with a server relay fallback, team
  analytics. Clients: `re-shell collab session ...` and the dashboard's Collaboration
  screen.
- SQLite persistence through Node's built-in `node:sqlite` (**requires Node 22.13 or
  newer**; it prints an `ExperimentalWarning` on Node 22).

## Run it

```bash
pnpm install --frozen-lockfile
pnpm -r build

# signing key (required), then bootstrap an admin and start the server
node packages/control-plane/dist/bin.js gen-key --raw           # put the JSON in CONTROL_PLANE_JWT_KEYS
export CONTROL_PLANE_JWT_KEYS='{"activeKid":"key-1","keys":{"key-1":"<secret>"}}'
export CONTROL_PLANE_DB=./control-plane.db
node packages/control-plane/dist/bin.js issue-token --user alice --tenant acme --role admin --raw
node packages/control-plane/dist/bin.js serve                    # 127.0.0.1:8787 by default
```

The bin (`re-shell-control-plane`) has `serve`, `worker`, `issue-token`, `gen-key` and
`migrate`. All configuration is through `CONTROL_PLANE_*` environment variables; a bad
or missing setting exits non-zero with a `CONFIG_ERROR` envelope. The full table is in
[`docs/control-plane.md`](../../docs/control-plane.md) section 9.

Docker (build from the repository root; `docker-compose.yml` in this directory runs the
server plus one worker, publishing the API on loopback only):

```bash
docker build -f packages/control-plane/Dockerfile --target control-plane -t re-shell/control-plane .
docker build -f packages/control-plane/Dockerfile --target worker        -t re-shell/control-plane-worker .
```

## Tests

```bash
pnpm -r build                                      # the end-to-end suites need the built CLI
pnpm --filter @re-shell/control-plane test         # vitest; coverage gated at 80% in CI
```

The suites cover tenant isolation against both the in-memory and SQLite stores, token
handling, the HTTP edge, jobs and workers with real child processes, the built bin as
real processes, an end-to-end run with the real built CLI, and the collaboration stack.
See `docs/control-plane.md` sections 10 and 14.9 for what each suite proves.

## Not done

No deployment, TLS termination (put a TLS-terminating reverse proxy in front), OIDC/SSO,
Postgres or row-level security, horizontal scale-out, metrics or tracing, TURN server, or
an external security review. The dashboard covers collaboration only; tenant, policy
and member administration and the audit log have no UI (use the API).
