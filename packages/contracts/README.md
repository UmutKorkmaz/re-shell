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
`NOT_IN_MONOREPO`, `WORKSPACE_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `ANALYZE_ERROR`.
Typos cannot leak into output. A few codes are *reserved* (defined, not emitted yet);
the generated table in `docs/CLI-CONTRACTS.md` marks which.

```ts
import { errorCodeSchema } from '@re-shell/contracts';
import type { ErrorCode } from '@re-shell/contracts';
```

### Wire schemas (what the CLI actually prints)

One schema per consumed `--json` command, describing the `data` payload **exactly**.
Validate raw CLI output with these (wrapped in `jsonResponseSchema(...)`), never with
the domain schemas below:

| Command | Schema |
| --- | --- |
| `workspace summary` | `workspaceSummaryWireSchema` |
| `workspace graph` | `workspaceGraphWireSchema` |
| `workspace health` | `workspaceHealthWireSchema` |
| `workspace list` | `workspaceListWireSchema` |
| `templates list` / `show` | `templatesListWireSchema` / `templateWireSchema` |
| `templates matrix` | `templatesMatrixWireSchema` |
| `commands list` | `commandCatalogWireSchema` |
| `doctor` | `doctorWireSchema` (`--fix`: `doctorFixWireSchema`) |
| `analyze` | `analyzeWireSchema` |
| `list` | `microfrontendListWireSchema` |

```ts
import { jsonResponseSchema, workspaceSummaryWireSchema } from '@re-shell/contracts';

const result = jsonResponseSchema(workspaceSummaryWireSchema).safeParse(JSON.parse(stdout));
```

Wire objects are *loose*: declared keys are enforced, unknown keys are preserved (so
forwarding a validated payload never drops data from a newer CLI). The CLI
conformance suite separately fails on any key the CLI prints that a wire schema does
not declare, and `docs/CLI-CONTRACTS.md` is generated from these schemas and the real
CLI output.

### Adapters (wire -> domain)

The wire shape and the UI model differ on purpose (for example the health vocabulary
is `healthy|degraded|critical` on the wire and `pass|warn|fail` in the UI). The
documented bridge is a set of pure functions:

- `healthWireToSummary(health)` -> `HealthSummary`
- `workspaceSummaryWireToModel(summary)` -> `WorkspaceSummary`
- helpers: `checkStatusToLevel`, `healthStatusToDomain`, `toPackageManager`

### Domain schemas (UI models)

These are the models the React components render. They are **not** the CLI wire
format (a `WorkspaceSummary` has `apps[]`/`services[]`/`templates[]`, while the CLI
prints `root`/`workspaces[]`/`graph`/`health`); adapt a validated wire payload with the
adapters above. Workspace and catalog shapes, each with a schema + inferred type:

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
- `wsClientMessageSchema` / `WsClientMessage` (a union of `wsJobMessageSchema`,
  `start`/`cancel`, and `wsAuthMessageSchema`, the first-message auth handshake)
- `wsServerMessageSchema` / `WsServerMessage`
- `hubServerConfigSchema` / `HubServerConfig`

The hub validates every inbound frame with the client-message schemas and types every
outbound frame and SSE event against the server-message schemas.

## Scripts

```bash
pnpm --filter @re-shell/contracts build      # tsc -> dist/ (tests are not published)
pnpm --filter @re-shell/contracts typecheck
pnpm --filter @re-shell/contracts test       # wire schemas, adapters, envelope, hub messages
```
