# @re-shell/contracts

Shared zod schemas and TypeScript types that define every shape crossing a process
boundary between the Re-Shell CLI and the UI. This package is the **single source of
truth**: each contract is authored as a zod schema and its TS type is derived via
`z.infer`, so validators and types cannot drift.

> Part of the [Re-Shell monorepo](https://github.com/umutkorkmaz/re-shell-cli). The
> wire contract is documented end-to-end in
> [`docs/CLI-CONTRACTS.md`](../../docs/CLI-CONTRACTS.md).

## Install

```bash
pnpm add @re-shell/contracts
```

ESM-only. Requires `zod` (`^4`).

## What it exports

Everything is re-exported from the package root (`@re-shell/contracts`).

### The JSON wire envelope

The canonical envelope every `--json` CLI command emits:

```ts
import type { JsonResponse, JsonSuccess, JsonError } from '@re-shell/contracts';
import { jsonResponseSchema } from '@re-shell/contracts';

// success: { ok: true,  data: T,                     warnings: string[] }
// error:   { ok: false, error: JsonErrorBody,         warnings: string[] }
```

- `jsonResponseSchema`, `jsonErrorBodySchema` — runtime validators.
- `JsonSuccess<T>`, `JsonError`, `JsonResponse<T>`, `JsonErrorBody` — types.

### ErrorCode

A **closed** set of error codes (zod enum) the CLI is allowed to emit, e.g.
`NOT_IN_MONOREPO`, `WORKSPACE_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `INVALID_VARIABLES`,
`DOCTOR_ERROR`, `ANALYZE_ERROR`, `HEALTH_CHECK_ERROR`. Typos cannot leak into output.

```ts
import { errorCodeSchema } from '@re-shell/contracts';
import type { ErrorCode } from '@re-shell/contracts';
```

### Domain schemas

Workspace and catalog shapes, each with a schema + inferred type:

- **Enums**: `packageManagerSchema`, `workspaceNodeStatusSchema`,
  `workspaceAppTypeSchema`, `workspaceServiceTypeSchema`, `templateDomainSchema`,
  `healthStatusSchema`, `healthCheckLevelSchema`, `jobStatusSchema`.
- **Workspace**: `gitSummarySchema`, `workspaceAppSchema`, `workspaceServiceSchema`,
  `templateSummarySchema`, `healthCheckSchema`, `healthSummarySchema`,
  `workspaceSummarySchema`.
- **Jobs**: `jobRecordSchema`.
- **Command spec**: `commandSpecSchema`, `commandSpecInputSchema`.

Matching types: `PackageManager`, `WorkspaceNodeStatus`, `JobStatus`, `GitSummary`,
`WorkspaceApp`, `WorkspaceService`, `TemplateSummary`, `HealthCheck`, `HealthSummary`,
`WorkspaceSummary`, `JobRecord`, `CommandSpec`, `CommandSpecInput`.

### Hub transport (SSE / WS)

Wire messages for the dashboard's token-authed hub-server, validated on both the
emit side (hub) and consume side (browser) against one schema:

- `sseEventSchema` / `SseEvent`
- `wsClientMessageSchema` / `WsClientMessage`
- `wsServerMessageSchema` / `WsServerMessage`
- `hubServerConfigSchema` / `HubServerConfig`

## Scripts

```bash
pnpm --filter @re-shell/contracts build      # tsc -> dist/
pnpm --filter @re-shell/contracts typecheck
```
