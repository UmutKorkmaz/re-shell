/**
 * @re-shell/control-plane
 *
 * The hosted, multi-tenant control plane for Re-Shell: an authenticated HTTP/SSE
 * API in front of a SQLite-backed tenant store, signed-token identity, an
 * append-only audit trail, team policy sync, and remote execution workers that
 * run the allow-listed Re-Shell CLI. See docs/control-plane.md.
 *
 * Layers (each independently testable):
 *  - model + authorization  errors, tenant, auth, authz, policy, audit, events
 *  - request pipeline       api, admin, jobs (pure handlers)
 *  - identity               jwt, identity
 *  - persistence            db/* (node:sqlite)
 *  - HTTP edge              http/server
 *  - workers                worker/*
 *  - operations             config, runtime, cli
 */
export * from './errors.js';
export * from './tenant.js';
export * from './auth.js';
export * from './authz.js';
export * from './api.js';
export * from './audit.js';
export * from './events.js';
export * from './policy.js';
export * from './admin.js';
export * from './jobs.js';
export * from './collab.js';
export * from './collab-hub.js';
export * from './jwt.js';
export * from './identity.js';
export * from './config.js';
export * from './runtime.js';
export { migrate, MIGRATIONS, LATEST_SCHEMA_VERSION } from './db/migrations.js';
export type { Migration, MigrationReport } from './db/migrations.js';
export { openDatabase, transaction } from './db/sqlite.js';
export { SqliteTenantStore } from './db/sqlite-store.js';
export { SqliteAuditLog } from './db/sqlite-audit.js';
export { SqliteJobStore, MAX_JOB_OUTPUT_BYTES } from './db/sqlite-jobs.js';
export { SqliteCollabStore } from './db/sqlite-collab.js';
export type { Job, JobStatus, JobOutputChunk } from './db/sqlite-jobs.js';
export {
  createControlPlaneServer,
  DEFAULT_LIMITS,
} from './http/server.js';
export type {
  ControlPlaneServer,
  ControlPlaneServerOptions,
  ListenInfo,
  ServerLimits,
} from './http/server.js';
export { Worker } from './worker/worker.js';
export type { WorkerEvent, WorkerOptions } from './worker/worker.js';
export { WorkerClient } from './worker/client.js';
export { runJob } from './worker/runner.js';
export {
  containCwd,
  resolveWorkspaceDir,
  resolveCliInvocation,
  childEnvironment,
} from './worker/containment.js';
export { parseSse, openSseStream, SseHttpError } from './sse-client.js';
export type { SseMessage } from './sse-client.js';
