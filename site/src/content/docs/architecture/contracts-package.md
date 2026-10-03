---
title: "Contracts Package"
description: "@re-shell/contracts: the zod schemas, exact wire layer, adapters and shared registries behind every Re-Shell process boundary."
---

[`@re-shell/contracts`](https://www.npmjs.com/package/@re-shell/contracts) is the
**single source of truth** for every shape that crosses a process boundary in
Re-Shell: the CLI's `--json` output, the dashboard hub's transport, the command
allow-list, the control plane's collaboration protocol and the UI models. Each contract
is authored as a [zod](https://zod.dev) schema and its TypeScript type is derived with
`z.infer`, so runtime validators and static types **cannot drift**.

```bash
pnpm add @re-shell/contracts   # 0.3.0 in the tree; 0.2.0 is the last published version
```

Requires `zod` (`^4`). It ships both ESM and CommonJS builds. Everything is re-exported
from the package root; `@re-shell/contracts/command-registry` is a second entry point.

## The wire envelope

```ts
import { jsonResponseSchema, jsonErrorBodySchema } from '@re-shell/contracts';

// success: { ok: true,  data: T,            warnings: string[] }
// error:   { ok: false, error: JsonErrorBody, warnings: string[] }
```

`jsonResponseSchema(dataSchema)` builds a discriminated-union validator for the full
envelope around any data schema. See the [JSON Contract](/re-shell/contract/json-contract/)
page for the rules and examples.

## ErrorCode

A **closed** zod enum of the error codes the CLI may emit (148 in this tree, for
example `NOT_IN_MONOREPO`, `TEMPLATE_NOT_FOUND`, `COMMAND_ERROR`, `USAGE_ERROR`).
Typos cannot leak into output and consumers can switch on it exhaustively. The
generated `docs/CLI-CONTRACTS.md` lists every code and marks the reserved ones.

## The wire layer

One schema per consumed `--json` command, describing the `data` payload **exactly**
(`workspaceSummaryWireSchema`, `workspaceGraphWireSchema`, `workspaceHealthWireSchema`,
`workspaceListWireSchema`, `templatesListWireSchema`, `templateWireSchema`,
`templatesMatrixWireSchema`, `commandCatalogWireSchema`, `doctorWireSchema`,
`analyzeWireSchema`, `microfrontendListWireSchema`). Validate raw CLI output with these.
They are *loose*: declared keys are enforced, unknown keys preserved, so a newer CLI's
extra fields are never dropped. Newer command groups have their own payload schemas
exported from the same package (AI, bridge, Kubernetes and Terraform generation, plugin
and policy-pack lifecycle, `fix --ci`, `pkg`, `debug config`, `refactor`, the audit trail
and compliance report, and more).

## Adapters

The wire shape and the UI model differ on purpose (health is `healthy|degraded|critical`
on the wire and `pass|warn|fail` in the UI). The documented bridge is a set of pure
functions: `healthWireToSummary`, `workspaceSummaryWireToModel`, and helpers
(`checkStatusToLevel`, `healthStatusToDomain`, `toPackageManager`).

## Domain schemas

The models the React components render: `WorkspaceSummary` (with `apps[]`,
`services[]`, `templates[]`), `HealthSummary`, `JobRecord`, `CommandSpec` and their enums.
They are **not** the CLI's output format; adapt a validated wire payload instead of
parsing CLI output with them.

## Shared registries and protocols

- **Command registry** (`@re-shell/contracts/command-registry`): the single allow-list of
  commands the hub, the control plane and the VS Code extension may run, with the one argv
  builder (`resolveCommand`). The registry ids are `workspace.summary`, `workspace.graph`,
  `workspace.health`, `workspace.status`, `workspace.graph.diff`, `templates.list`,
  `templates.show`, `scorecard`, `commands.list`, `doctor`, `analyze` and `run`.
- **Workspace graph model**: nodes, edges, converters from the wire graph, cycle detection,
  shortest paths, graph diff and live-status schemas (the dashboard explorer and
  `workspace graph diff` / `workspace status`).
- **Collaboration protocol**: operational-transform operations, session, console,
  document, signaling and analytics schemas, and the client state machine shared by the
  dashboard and the control plane.
- **Theme packs and white-label**: schemas with OKLCH contrast checks.

## Hub transport (SSE / WS)

The wire messages for the dashboard's token-authed
[hub server](/re-shell/architecture/secure-hub/), validated on both the emit side (hub)
and the consume side (browser) against one schema:

- `sseEventSchema` / `SseEvent`: a chunk on the `/events` SSE stream (`stdout` |
  `stderr` | `exit` | `error` | `heartbeat`).
- `wsClientMessageSchema` / `WsClientMessage`: `start` / `cancel` (and the first-message
  auth handshake), carrying only a stable `commandId` plus opaque `params`.
- `wsServerMessageSchema` / `WsServerMessage`: per-job output from the hub.
- `hubServerConfigSchema` / `HubServerConfig`.

## Why schemas, not just types

Authoring the contract as zod schemas lets the CLI **validate its own output** and every
consumer **validate what it receives** against the identical definition. The conformance
suite (`packages/cli/tests/contract-conformance.test.ts`) spawns the built CLI for the
`--json` commands and asserts each payload parses against its wire schema **and that the
CLI prints no key the schema does not declare**. `docs/CLI-CONTRACTS.md` is generated from
the schemas plus real CLI output (`node packages/cli/scripts/gen-cli-contracts.mjs`) and
CI fails when it drifts.

## See also

- [JSON Contract](/re-shell/contract/json-contract/): the envelope, rules, exit codes.
- [Monorepo](/re-shell/architecture/monorepo/): how this package is shared.
- [Secure Hub](/re-shell/architecture/secure-hub/): where the SSE/WS schemas are used.
