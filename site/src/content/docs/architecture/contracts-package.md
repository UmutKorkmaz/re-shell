---
title: "Contracts Package"
description: "@re-shell/contracts — the zod schemas and TypeScript types that are the single source of truth for every CLI ↔ UI boundary."
---

[`@re-shell/contracts`](https://www.npmjs.com/package/@re-shell/cli) is the
**single source of truth** for every shape that crosses a process boundary
between the Re-Shell CLI and the UI. Each contract is authored as a
[zod](https://zod.dev) schema, and its TypeScript type is derived via `z.infer` —
so the runtime validators and the static types **cannot drift**.

```bash
pnpm add @re-shell/contracts   # @re-shell/contracts@0.1.0
```

ESM-only. Requires `zod` (`^4`). Everything is re-exported from the package root.

## The wire envelope

The canonical envelope every `--json` CLI command emits, plus its runtime
validator:

```ts
import { jsonResponseSchema, jsonErrorBodySchema } from '@re-shell/contracts';
import type { JsonResponse, JsonSuccess, JsonError, JsonErrorBody } from '@re-shell/contracts';

// success: { ok: true,  data: T,           warnings: string[] }
// error:   { ok: false, error: JsonErrorBody, warnings: string[] }
```

`jsonResponseSchema(dataSchema)` builds a discriminated-union validator for the
full envelope around any data schema — the error branch is fixed; the success
branch is parameterized by your data shape. See the
[JSON Contract](/re-shell/contract/json-contract/) page for the rules and
examples.

## ErrorCode

A **closed** zod enum of the error codes the CLI is allowed to emit
(`NOT_IN_MONOREPO`, `WORKSPACE_NOT_FOUND`, `TEMPLATE_NOT_FOUND`,
`INVALID_VARIABLES`, `DOCTOR_ERROR`, `ANALYZE_ERROR`, `HEALTH_CHECK_ERROR`, and
more). Typos cannot leak into output, and consumers can exhaustively switch on it.

```ts
import { errorCodeSchema } from '@re-shell/contracts';
import type { ErrorCode } from '@re-shell/contracts';
```

## Domain schemas

Workspace and catalog shapes, each with a schema **and** an inferred type:

- **Enums** — `packageManagerSchema`, `workspaceNodeStatusSchema`,
  `workspaceAppTypeSchema`, `workspaceServiceTypeSchema`, `templateDomainSchema`,
  `healthStatusSchema`, `healthCheckLevelSchema`, `jobStatusSchema`.
- **Workspace** — `gitSummarySchema`, `workspaceAppSchema`,
  `workspaceServiceSchema`, `templateSummarySchema`, `healthCheckSchema`,
  `healthSummarySchema`, `workspaceSummarySchema`.
- **Jobs** — `jobRecordSchema`.
- **Command spec** — `commandSpecSchema`, `commandSpecInputSchema` (used to build
  the dashboard's allow-listed Command Builder).

Matching types: `PackageManager`, `WorkspaceNodeStatus`, `JobStatus`,
`GitSummary`, `WorkspaceApp`, `WorkspaceService`, `TemplateSummary`,
`HealthCheck`, `HealthSummary`, `WorkspaceSummary`, `JobRecord`, `CommandSpec`,
`CommandSpecInput`.

## Hub transport (SSE / WS)

The wire messages for the dashboard's token-authed
[hub server](/re-shell/architecture/secure-hub/), validated on both the emit side
(hub) and the consume side (browser) against one schema:

- `sseEventSchema` / `SseEvent` — a chunk on the `/events` SSE stream
  (`stdout` | `stderr` | `exit` | `error` | `heartbeat`).
- `wsClientMessageSchema` / `WsClientMessage` — a `start` / `cancel` from the
  browser, carrying only a stable `commandId` + opaque `params` (never raw argv).
- `wsServerMessageSchema` / `WsServerMessage` — per-job output from the hub.
- `hubServerConfigSchema` / `HubServerConfig` — `{ port, workspace, cliBin }`.

## Why schemas, not just types

Authoring the contract as zod schemas means the CLI can **validate its own
output** and the dashboard can **validate what it receives**, at runtime, against
the identical definition. The conformance suite
(`packages/cli/tests/contract-conformance.test.ts`) spawns the built CLI for
every `--json` command and asserts the payload parses against
`jsonResponseSchema(<dataSchema>)` — any drift between the docs, the schemas, and
reality is caught in CI.

## See also

- [JSON Contract](/re-shell/contract/json-contract/) — the envelope, rules, exit codes.
- [Monorepo](/re-shell/architecture/monorepo/) — how this package is shared.
- [Secure Hub](/re-shell/architecture/secure-hub/) — where the SSE/WS schemas are used.
