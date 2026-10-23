# Per-job execution isolation

**Last updated:** 2026-10-23.

The control-plane API authorizes jobs; authorization alone is not a sandbox.
The worker supports two explicit operator modes:

- `process`: trusted local development. CLI children share the worker's OS and user permissions. No cross-workspace or network isolation is claimed.
- `docker`: isolated local staging. Each claim runs in a separate Linux container. A daemon/configuration failure stops startup before claims; a job never falls back to a host process. Unconfirmed cleanup stops all claims and requires operator recovery.

The CLI requires `CONTROL_PLANE_WORKER_MODE` or `--mode`. The SDK's default remains process mode for existing trusted local integrations. The Compose `worker` is available only with `--profile development` and runs in process mode. Compose's resource limits on that worker are not per-job isolation.

## Trust and deployment boundary

Run the Docker orchestration worker **on the host of a dedicated local Docker daemon/VM**, preferably a rootless daemon with working cgroup CPU/memory/pids enforcement. The worker account controls that daemon and is trusted like its administrator. Use a dedicated daemon/VM for staging and an operator-owned workspace parent directory. Do not give remote tenants access to the worker account, daemon socket, images, parent directories, or worker state directory. Containers share a Linux kernel; this is not a VM boundary for hostile multi-tenant production workloads.

The orchestration worker holds the control-plane token and invokes the Docker CLI using an explicit local `unix:///...` socket. No service in the shipped Compose file mounts a host Docker socket. No job container receives that socket, Docker CLI configuration, worker token, control-plane environment, host home directory, workspace root, or sibling workspace. A generic unrestricted socket proxy would have the same authority problem and is not part of this design. TCP/SSH daemons and implicit Docker contexts are rejected. The supplied job image contains the CLI, without the control-plane worker.

The daemon and worker must resolve the **same absolute real workspace paths**. Workspaces are operator-provisioned directories `<workspaceRoot>/<workspaceId>`, owned/writable for the configured job uid/gid. Keep the parent and `.re-shell-workers` inaccessible to jobs, and keep other tenant roots out of the bind-mounted workspace. Do not place secrets within a workspace intentionally made available to its jobs. Symlinks are not a way to grant access to sibling host paths. Nested bind mounts are disabled; Docker versions lacking `bind-recursive=disabled` fail the job.

## Container contract

Each job runs the registry-produced argv as literal arguments to `node /opt/re-shell/dist/index.js` in a pinned, already-present image ID or digest. Mutable tags and automatic pulls are rejected. There is one bind mount: the exact realpath of the authorized workspace at `/workspace`; cwd must realpath to an existing directory beneath it. Mount-parser control characters and commas are rejected.

The worker fixes `--network=none`, a read-only root filesystem, a private IPC namespace, non-root uid/gid, `--cap-drop=ALL`, `no-new-privileges`, no daemon logging, a 64 MiB `noexec,nosuid,nodev` temporary filesystem, CPU/memory limits, memory+swap capped at the same value, and a pids limit. No network opt-out is available. Commands requiring external package registries fail their checks in this staging mode. The default limits are 1 CPU, 512 MiB RAM, 128 pids and uid/gid 1000:1000. A fixed `/usr/bin/env -i` entrypoint clears image-baked environment too, then runs `/usr/local/bin/node` with only fixed PATH, NODE_ENV, HOME, TMPDIR, CI and terminal settings.

Decoded stdout/stderr is capped at 4 MiB total per job, including queued output awaiting delivery; exceeding it terminates the job with `OUTPUT_LIMIT`. Each POST is additionally bounded in character/chunk count. Only one heartbeat can be queued at once. HTTP output attempts have a five-second deadline; after process/container exit, queued output has a five-second drain budget. Final-result reporting has a fifteen-second total budget, so a stalled control plane cannot hold shutdown indefinitely. Jobs time out after ten minutes by default. SDK `runner` settings can shorten these limits. Worker cancellation, timeout, shutdown and revoked ownership remove the job container with `docker rm --force --volumes`, killing descendants and removing anonymous volumes owned by that container as well. The Docker attachment process also has a bounded termination grace. Cleanup is retried after attachment exit, including ordinary success and spawn failure. A Docker command has a thirty-second wall deadline and a 1 MiB diagnostic-output ceiling. Cleanup failure is logged and stops the worker; it does not report success for a potentially running job.

A forcibly killed container reports the corresponding control-plane reason (`CANCELED`, `TIMEOUT`, `WORKER_SHUTDOWN`, `OUTPUT_LIMIT`). The container's runtime exit code otherwise reaches the job result. A CLI doctor may correctly return exit 1 with a valid JSON diagnosis; container execution alone does not mean workspace health.

## Local staging setup

The package requires Node **22.13.0+**; the local validation host uses **22.22.3** with Corepack pnpm **9.15.9**. Build from the repository root using your dedicated local Docker context. The build target includes no runtime secrets:

```sh
docker build -f packages/control-plane/Dockerfile --target job -t re-shell/job:local .
docker image inspect --format '{{.Id}}' re-shell/job:local
corepack pnpm@9.15.9 --filter @re-shell/contracts build
corepack pnpm@9.15.9 --filter @re-shell/control-plane build
```

Export the resulting immutable image ID, not the tag. Configure an existing loopback control plane and a tenant-bound worker token issued by the normal bootstrap flow. Example environment (replace all paths/values):

```sh
export CONTROL_PLANE_WORKER_MODE=docker
export CONTROL_PLANE_DOCKER_HOST=unix:///absolute/path/to/dedicated/docker.sock
export CONTROL_PLANE_JOB_IMAGE=sha256:REPLACE_WITH_64_HEX_IMAGE_ID
export CONTROL_PLANE_WORKER_ID=staging-1
export CONTROL_PLANE_WORKSPACE_ROOT=/absolute/path/to/workspaces
export CONTROL_PLANE_TENANT=acme
export CONTROL_PLANE_URL=http://127.0.0.1:8787
export CONTROL_PLANE_WORKER_TOKEN_FILE=/absolute/private/path/worker-token
node packages/control-plane/dist/bin.js worker
```

Optional settings: `CONTROL_PLANE_JOB_CPUS`, `CONTROL_PLANE_JOB_MEMORY_MB`, `CONTROL_PLANE_JOB_PIDS`, `CONTROL_PLANE_JOB_UID`, `CONTROL_PLANE_JOB_GID`. Invalid settings fail startup. Keep concurrency within the dedicated daemon's capacity; per-job limits multiply by concurrent slots. Container mounts are writable for authorized CLI workspace operations; rootfs immutability does not make the workspace read-only.

## Recovery

Startup takes a local lock keyed by stable worker ID, tenant and real workspace root. A live owner prevents duplicate startup. Only containers carrying BOTH `io.re-shell.job=1` and that exact hashed `io.re-shell.owner` are removed before claims begin. Containers belonging to other workers/tenants/roots are untouched. Existing stopped containers with those labels are removed too.

Use a unique stable worker ID per concurrent orchestrator. After a crash, restart with the same ID/root/tenant to reap orphaned jobs. A dead recorded host PID permits stale-lock recovery. Before inspecting or replacing a stale lock, startup creates an exclusive `.re-shell-workers/<owner>.recovery` directory; this serializes recovery between competing starts. The resulting `<owner>.lock` records both the host PID and a random generation nonce. Release removes a lock only when its stored nonce still matches that owner's acquisition, so an old release callback cannot remove a replacement generation.

An existing recovery guard, an incomplete lock or PID reuse fails closed. A process killed during the synchronous recovery critical section can leave the guard behind; it is intentionally not reclaimed by guessing that the owner is dead. For operator recovery, stop all orchestrators for that exact owner, verify the recorded process is absent, inspect and remove only containers matching both owner labels on the configured daemon, and confirm none remain. Only then remove that owner's stale `<owner>.lock` and, if present, `<owner>.recovery` directory. Restart with the same worker ID/root/tenant. Do not remove another owner's state or broadly prune/restart containers.

The host lock coordinates one host; running the same owner from another host is unsupported. Host failure recovery requires the operator to return to that same daemon and root. A daemon outage can defer actual removal; jobs can stay active until the lease expires, and this must be treated as an operational incident rather than successful cleanup.

## Evidence and tests

The final October 23 local run passes all **7** real Docker checks using the freshly
built minimal job image with CLI **0.33.0**. Its local immutable image ID is
`sha256:d31918c05e8f214dc70fc2dc0a1b1dceffe536dd4a094f914d9ae882b896f8c8`.
This identifies the tested local artifact; it is not a published registry image.

Normal unit/HTTP tests cover configuration, literal argv, realpath/mount parser containment, output caps, and failing closed before a claim when a daemon is unavailable. Those tests do not prove container isolation.

For real Docker verification, build the actual job image above, export the explicit socket/image settings, and run:

```sh
node scripts/test-job-isolation.mjs
```

This opt-in suite fails if its daemon/image is unavailable. It runs the actual allowlisted `doctor --json` against the pinned real image and prints its JSON evidence, then derives a temporary diagnostic fixture image by copying into a never-started local container to probe root write denial, non-root uid, absence of socket/worker secrets, sibling/symlink denial, external-network denial, and cross-job loopback denial. It inspects the actual live memory/CPU/pids/capability configuration, simulates an attachment crash, verifies exact-owner orphan recovery while preserving a foreign owner, and exercises timeout, cancellation, shutdown and output-limit cleanup through the actual HTTP worker. Tests remove only their UUID-scoped containers and fixture image. Successful suite output is runtime evidence; merely skipping this suite is not verification.
