# Control-plane tracing and recovery

The control plane uses one local SQLite database with WAL journaling and an
in-process event bus. This is a single-node service. Multiple API hosts, a shared
network filesystem and active/active failover are not supported. The procedures
below provide a consistent snapshot and an offline restore, not high availability.

## Distributed tracing

Set the same collector endpoint on the API and each worker:

```sh
export CONTROL_PLANE_TRACE_ENDPOINT=http://127.0.0.1:4318/v1/traces
export CONTROL_PLANE_TRACE_SAMPLE_RATIO=0.1
```

The endpoint is the complete OTLP HTTP JSON traces URL, ending in `/v1/traces`.
HTTP and HTTPS are accepted; embedded credentials, query strings and fragments
are refused. Tracing is disabled when the endpoint is absent. Sampling defaults
to 0.1; set it to 1 for the local proof. Parent-based sampling honors a valid
parent's sampled flag, while the ratio applies to new root traces.

The API exports `service.name=re-shell-control-plane`; the worker exports
`service.name=re-shell-worker`. A canonical lowercase W3C version-00
`traceparent` establishes the API request's parent. The server span's context is
stored with a queued job, survives a restart and parents `re-shell.job.execute`
in the worker. Worker output and exit HTTP client spans propagate context back
to the API server spans. Claim polling has its own trace; execution resumes the
enqueue trace. Async-local context isolates concurrent work. Context is omitted
from public job responses and is sent only in the authenticated worker claim.

Names use route templates. Attributes contain method, route, HTTP status and
the allow-listed command ID. Bearer tokens, tenant/user/job IDs, workspace paths,
command parameters/output, exception text, baggage and tracestate are not
exported. HTTP or job failure sets span error status without recording those
contents. These limits apply to application instrumentation; secure the collector
and any downstream storage separately.

The SDK batches up to 64 spans with a 512-span queue and a one-second scheduled
delay. Export HTTP requests have a two-second timeout; batch exports have a
2.5-second deadline. Full queues may drop telemetry. Export errors emit the
fixed JSON warning `trace export failed; telemetry may be incomplete`, at most
once per 30 seconds per tracing instance. No collector URL or exception is
included. Failures do not change job results. Graceful shutdown drains ended
spans; a killed process can lose buffered spans. This is best-effort telemetry,
not the durable audit log or a delivery guarantee.

## Make a consistent snapshot

Do not copy only a live `.db` file: committed data may still be in its `-wal` file.
The included script uses SQLite `VACUUM INTO` through Node's built-in SQLite
driver, including committed WAL pages at one snapshot point. It supports the
package's Node 22.13 floor and does not use the newer `node:sqlite.backup` API.

```sh
node scripts/snapshot-control-plane.mjs /srv/re-shell/control-plane.db /srv/backups/control-plane-20261023.db
```

Use a new destination in an existing private backup directory. The script
refuses replacement, reserves the output with mode 0600, checks SQLite integrity
and foreign keys, then fsyncs the file and its directory. A failed invocation
returns nonzero and removes only the file it reserved. A process crash may leave
an incomplete destination: use another new filename and validate the previous
artifact before retaining it. The source must exist and is opened read-only.
Allow enough disk space for another database and SQLite temporary work. Avoid
wrapping the operation in an existing transaction. The source may remain open;
schedule large copies during a quiet period to limit I/O contention.

Copy validated snapshots to protected storage outside this node and apply an
explicit retention policy. Keep signing-key files and pinned OIDC public-key
configuration in separate protected recovery storage; database snapshots do not
contain signing keys. Workspace contents, worker images and external audit/trace
storage also need their own backups. Recovery point is the snapshot time; this
script does not schedule or retain backups automatically.

## Restore and rollback offline

1. Stop ingress, stop all workers and confirm their job children/containers have
   terminated. Stop the API before changing its database path. A restored queue
   must never coexist with workers still running against the original queue.
2. Preserve the current database directory, including any `.db`, `-wal` and
   `-shm` files, and the matching application build/configuration as the rollback
   set. Do not overwrite or delete the original directory. If the API cannot stop
   cleanly, preserve the complete directory together; never mix its sidecar files
   with a snapshot.
3. Create a fresh private restore directory and copy a validated snapshot to a
   new database path, preserving ownership and mode 0600. Start the same build
   against this path with workers and public ingress still stopped. Startup runs
   migrations and rejects schemas newer than the build. Do not downgrade a
   migrated database; rollback uses the preserved database with its matching build.
4. Check `/healthz`, admin access, tenant/workspace policy, viewer/operator/admin
   permissions, expected audit history and denied credentials. A restore loses
   changes after its snapshot, including membership removals and revocations.
   Reconcile these from independent records before reopening access. Rotate local
   signing keys if missing revocations cannot be reconstructed; reconcile or
   invalidate external IdP sessions/tokens separately. Restoring a database alone
   cannot preserve revocations made after the snapshot.
5. Review queued and running jobs before restarting workers. A running job whose
   lease expires becomes `failed` with `WORKER_LOST`, including after a restart.
   It is not automatically replayed. A saved queued job is authorized again when
   claimed. Confirm external side effects before explicitly resubmitting any job.
6. Start one worker, verify a read-only job and its output/trace, then restore
   intended workers and ingress. If validation fails, stop the restored API and
   workers, preserve that attempt separately and switch back to the original
   database directory and matching build. Recheck revocations before reopening.

## Reproduce the local proof

Build the real CLI and control plane, then run:

```sh
pnpm --filter @re-shell/control-plane exec vitest run src/tracing.test.ts src/e2e/operations.e2e.test.ts
```

The operational test starts a loopback OTLP JSON receiver and separate built API
and worker processes. It submits a job, snapshots an open WAL database, restores
into a fresh directory, verifies role/revocation/audit/queue state, reaps a lost
worker lease and runs the saved queued job using the real CLI. The receiver
asserts OTLP resource/scope/span structure, IDs, timestamps, both service names,
and enqueue → worker execution → worker HTTP → restored API parent relationships.
It also checks that private credentials, IDs and paths are absent from the wire
payload. Unit tests cover async context isolation, strict W3C validation and
exporter failure without job/shutdown failure.

This proves local HTTP transport and restore behavior. It does not certify a
particular collector distribution/backend, remote-network delivery, storage
durability after hardware loss, physical isolation or production deployment.
