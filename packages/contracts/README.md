# @re-shell/contracts

Shared zod schemas and TypeScript types for every shape that crosses a process
boundary in Re-Shell: the CLI's `--json` output, the dashboard hub transport, the
command allow-list, the control plane's collaboration protocol and the UI models.
Each contract is authored as a zod schema and its TS type is derived with
`z.infer`, so validators and types cannot drift.

> Part of the [Re-Shell monorepo](https://github.com/UmutKorkmaz/re-shell). The CLI
> envelopes are documented, from this package and from real CLI output, in the
> **generated** [`docs/CLI-CONTRACTS.md`](../../docs/CLI-CONTRACTS.md).

Version in this tree: **0.3.0** (published: 0.2.0).

## Install

```bash
pnpm add @re-shell/contracts
```

Requires `zod` (`^4`). The package ships **both ESM and CommonJS** builds (the
`require` condition points at `dist/cjs`), so config loaders that `require()` it
work. Two entry points:

| Import | What |
|--------|------|
| `@re-shell/contracts` | Everything below. |
| `@re-shell/contracts/command-registry` | The single allow-list of commands the hub, the control plane and the VS Code extension may run, with the argv builder (`resolveCommand`, `listRegisteredCommands`, `isRegisteredCommandId`, `toCommandSpec`). |

## The layers

This package has two deliberately separate layers for CLI data. Mixing them up is
the most common mistake.

1. **The wire layer** (`wire.ts`): schemas that describe **exactly what the CLI
   prints**. Use these to validate raw CLI output.
2. **The domain layer** (`re-shell.ts`, `schemas.ts`): the models the React
   components render. They are *not* the CLI's output format. A bridge of pure
   adapter functions (`adapters.ts`) converts a validated wire payload into a
   domain model.

### The JSON wire envelope

Every `--json` CLI command emits exactly one envelope on stdout (incidental output
goes to stderr):

```ts
import { jsonResponseSchema } from '@re-shell/contracts';
import type { JsonResponse, JsonSuccess, JsonError } from '@re-shell/contracts';

// success: { ok: true,  data: T,            warnings: string[] }
// error:   { ok: false, error: JsonErrorBody, warnings: string[] }
```

- `jsonResponseSchema(dataSchema)`, `jsonErrorBodySchema`: runtime validators.
- `JsonSuccess<T>`, `JsonError`, `JsonResponse<T>`, `JsonErrorBody`: types.

### ErrorCode

A **closed** set of error codes (`errorCodeSchema`, a zod enum; 148 values in this
tree) that the CLI may emit, so a typo cannot leak into output. Examples:
`NOT_IN_MONOREPO`, `TEMPLATE_NOT_FOUND`, `ANALYZE_ERROR`, `COMMAND_ERROR`,
`USAGE_ERROR`. Some codes are *reserved* (defined, not emitted yet); the generated
table in `docs/CLI-CONTRACTS.md` marks which.

### Wire schemas (what the CLI actually prints)

One schema per consumed `--json` command, describing the `data` payload exactly.
Validate raw output with these, wrapped in `jsonResponseSchema(...)`:

| Command | Schema |
| --- | --- |
| `workspace summary` | `workspaceSummaryWireSchema` |
| `workspace graph` | `workspaceGraphWireSchema` |
| `workspace health` | `workspaceHealthWireSchema` |
| `workspace list` | `workspaceListWireSchema` |
| `templates list` / `show` | `templatesListWireSchema` / `templateWireSchema` |
| `templates matrix` | `templatesMatrixWireSchema` |
| `commands list` | `commandCatalogWireSchema` |
| `doctor` (`--fix`) | `doctorWireSchema` (`doctorFixWireSchema`) |
| `analyze` | `analyzeWireSchema` |
| `list` | `microfrontendListWireSchema` |

```ts
import { jsonResponseSchema, workspaceSummaryWireSchema } from '@re-shell/contracts';

const result = jsonResponseSchema(workspaceSummaryWireSchema).safeParse(JSON.parse(stdout));
```

Wire objects are *loose*: declared keys are enforced and unknown keys are preserved,
so forwarding a validated payload never drops data from a newer CLI. The CLI
conformance suite (`packages/cli/tests/contract-conformance.test.ts`) separately
fails on any key the CLI prints that a wire schema does not declare, and
`docs/CLI-CONTRACTS.md` is generated from these schemas plus real CLI output
(`node packages/cli/scripts/gen-cli-contracts.mjs`; CI runs it with `--check`).

### Adapters (wire to domain)

The two layers differ on purpose; for example health is `healthy|degraded|critical`
on the wire and `pass|warn|fail` in the UI. The documented bridge is a set of pure
functions: `healthWireToSummary`, `workspaceSummaryWireToModel`, and the helpers
`checkStatusToLevel`, `healthStatusToDomain`, `toPackageManager`.

### Domain schemas (UI models)

`WorkspaceSummary` (with `apps[]`, `services[]`, `templates[]`), `HealthSummary`,
`JobRecord`, `CommandSpec`, the status enums, and the other models the React
components render. Adapt a validated wire payload with the adapters above rather
than parsing CLI output with these.

### Payload schemas for newer commands

Command groups added after the original wire layer have their own schemas, exported
from the root: the AI command interface (`aiPlanResponseSchema`, resolve results,
sessions), `create` dry-run output, service bridge payloads (link, validate,
generate, diff), Kubernetes and Terraform generation payloads, plugin lifecycle
(install, uninstall, update, validate, pin, review) and policy-pack payloads, the
`fix --ci` run log, `ui test`, `pkg`, `debug config`, `refactor rename-service`,
`cloud deploy`, the compliance audit trail and report, profile insights, and the
finding schemas behind `analyze --type` (security, performance, scalability, architecture). They are in `plugins.ts`,
`platform.ts`, `re-shell.ts` and `schemas.ts`; the generated
`docs/CLI-CONTRACTS.md` shows which commands are covered by the live conformance
run and which are schema-only.

### Workspace graph model (`graph.ts`)

The graph model behind the dashboard explorer and `workspace graph diff` /
`workspace status`: node and edge schemas, converters from the wire graph, cycle
detection, shortest paths, graph diff, and the live-status schemas.

### Collaboration protocol (`ot.ts`, `collab.ts`, `collab-client.ts`)

The operational-transform text operations (`transform`, `compose`, `apply`, with
property tests for convergence), the session, console, document, signaling and
analytics schemas, and the client state machine shared by the dashboard and the
control plane. See [`docs/control-plane.md`](../../docs/control-plane.md) section 14.

### Theme packs and white-label (`ui-theme.ts`, `brand-html.ts`)

Theme-pack and white-label schemas with OKLCH contrast checks: a pack or accent
colour that fails the contrast floor is rejected. White-label sources:
`re-shell.whitelabel.json` (or `.re-shell/whitelabel.json`, or the file named by
`RE_SHELL_WHITE_LABEL_FILE`) and the `RE_SHELL_BRAND_NAME`, `_TAGLINE`, `_LOGO`,
`_FAVICON`, `_ACCENT` environment variables (environment wins). `brand-html.ts`
applies a resolved brand to the dashboard HTML.

### Hub transport (SSE / WS)

Wire messages for the dashboard's token-authed hub-server, validated on both the
emit side (hub) and the consume side (browser) against one schema:
`sseEventSchema`, `wsClientMessageSchema` (a union including the first-message auth
handshake), `wsServerMessageSchema`, `hubServerConfigSchema`. The hub validates
every inbound frame and types every outbound frame and SSE event with them. This
transport is **not** described in `docs/CLI-CONTRACTS.md`, which covers CLI
envelopes only; the schemas here are its definition.

## Scripts

```bash
pnpm --filter @re-shell/contracts build      # tsc -> dist/ (ESM) and dist/cjs (CommonJS); tests are not published
pnpm --filter @re-shell/contracts typecheck
pnpm --filter @re-shell/contracts test       # wire schemas, adapters, envelope, graph, OT, registry, hub messages
```
