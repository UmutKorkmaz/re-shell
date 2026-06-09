---
title: "JSON Contract"
description: "The stable, typed { ok, data, warnings } envelope every --json command emits, the closed ErrorCode vocabulary, exit codes, and real captured examples."
---

Every Re-Shell command that accepts `--json` emits a **single line of JSON** on
stdout: one stable envelope that scripts, CI, and the [dashboard](/re-shell/dashboard/overview/)
parse. The envelope and its error-code vocabulary are defined exactly once — as
[zod](https://zod.dev) schemas in [`@re-shell/contracts`](/re-shell/architecture/contracts-package/) —
and the CLI imports them, so the wire shape and the TypeScript types can never
drift.

```bash
re-shell workspace summary --json
re-shell templates list --json > templates.json
```

## The envelope

There are exactly two branches, discriminated by `ok`.

### Success

```json
{ "ok": true, "data": { "...": "..." }, "warnings": [] }
```

### Error

```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" }, "warnings": [] }
```

The error body carries an optional `details` object with structured context:

```json
{ "ok": false, "error": { "code": "TEMPLATE_NOT_FOUND", "message": "Template not found: foo", "details": { "id": "foo" } }, "warnings": [] }
```

## Envelope rules

The contract guarantees the following on **every** `--json` invocation:

1. **Exactly one line.** stdout is a single `JSON.parse`-able object terminated by
   one `\n`. No pretty-printing on the wire (samples here are formatted only for
   readability).
2. **stdout is pure JSON.** All human chrome — spinners, banners, progress — is
   suppressed in `--json` mode and never reaches stdout. Genuine errors go to
   **stderr** only.
3. **`warnings` is always present** on both branches (it is `[]` when empty).
4. **Non-zero exit on `ok: false`.** Error envelopes set the process exit code to
   `1`, so a non-zero exit accompanies every `{ "ok": false }` payload.
5. **`details` is omitted when absent**, keeping shapes minimal; it appears only
   when a command supplies structured context.

> **Large-payload caveat.** The CLI exits as soon as a command resolves, which can
> truncate large stdout payloads (e.g. `templates list`, `commands list`) when
> stdout is an OS pipe. Redirect to a file (`... --json > out.json`) to capture
> the full payload — this is the supported pattern.

## Exit codes

| Exit code | Meaning |
| --- | --- |
| `0` | Success — `{ "ok": true }`. |
| `1` | Handled error — `{ "ok": false, "error": { ... } }` with a closed `ErrorCode`. |

## ErrorCode vocabulary

`ErrorCode` is a **closed** zod enum. Emitting a code outside this union is a
compile error in the CLI, so consumers can switch on it safely. Codes in active
use today:

| Code | Emitted by |
| --- | --- |
| `NOT_IN_MONOREPO` | `workspace summary` (no monorepo root found) |
| `LIST_WORKSPACES_ERROR` | `workspace list` |
| `GRAPH_GENERATION_ERROR` | `workspace graph` |
| `WORKSPACE_NOT_FOUND` | `workspace health` (no workspace config in cwd) |
| `TEMPLATE_NOT_FOUND` | `templates show <id>` (unknown id; carries `details.id`) |
| `INVALID_VARIABLES` | template variable validation |
| `NOT_IN_RESHELL_PROJECT` | `list` (not a Re-Shell project) |
| `APPS_DIR_NOT_FOUND` | `list` (no apps directory) |
| `LIST_MICROFRONTENDS_ERROR` | `list` |
| `TEMPLATES_LIST_ERROR` | `templates list` |
| `WORKSPACE_SUMMARY_ERROR` | `workspace summary` |
| `COMMANDS_LIST_ERROR` | `commands list` |
| `DOCTOR_ERROR` | `doctor` |
| `ANALYZE_ERROR` | `analyze` |
| `HEALTH_CHECK_ERROR` | `workspace health` |

The enum also reserves codes for newer slices —
`SCHEMA_VALIDATION_ERROR`, `MONOREPO_MIGRATE_ERROR`, `TEMPLATES_MATRIX_ERROR`,
`TEMPLATE_DRY_RUN_ERROR`, `PLUGIN_INSTALL_ERROR`, `MARKETPLACE_UNREACHABLE`,
`MARKETPLACE_ERROR`, `MARKETPLACE_VERIFY_ERROR`, `POLICY_CHECK_ERROR`,
`DRIFT_CHECK_ERROR`, `K8S_GENERATE_ERROR`, `HELM_GENERATE_ERROR`,
`GITOPS_GENERATE_ERROR`, `BRIDGE_GENERATE_ERROR`, and `AI_INTENT_ERROR`.

## Real examples

### `workspace summary --json`

An aggregate snapshot: root, package manager, all workspaces, the dependency
graph projection, and a health roll-up.

```bash
re-shell workspace summary --json
```

```json
{
  "ok": true,
  "data": {
    "root": "/abs/path/to/monorepo",
    "packageManager": "pnpm",
    "workspaces": [
      {
        "name": "@re-shell/ui",
        "path": "packages/ui",
        "type": "package",
        "framework": "react-ts",
        "version": "0.3.0",
        "dependencies": ["@re-shell/contracts", "react"]
      }
    ],
    "graph": { "apps": [], "services": [] },
    "health": { "score": 83, "status": "degraded", "checks": [] }
  },
  "warnings": []
}
```

### `workspace health --json`

Scored diagnostics. `warnings[]` mirrors the non-fatal checks.

```bash
re-shell workspace health --json
```

```json
{
  "ok": true,
  "data": {
    "score": 83,
    "status": "degraded",
    "checks": [
      { "name": "Workspaces", "status": "healthy", "message": "6 workspace(s) detected", "details": ["@re-shell/ui (package)"] },
      { "name": "File Structure", "status": "warning", "message": "Workspace structure could be improved", "details": ["Missing recommended files: README.md"] },
      { "name": "Package Manager", "status": "healthy", "message": "Using pnpm" }
    ]
  },
  "warnings": ["Workspace structure could be improved"]
}
```

Run outside any workspace and you get the error branch with a non-zero exit:

```json
{ "ok": false, "error": { "code": "WORKSPACE_NOT_FOUND", "message": "No workspace configuration found" }, "warnings": [] }
```

### `templates list --json`

Every scaffolding template. The payload is large — capture it to a file.

```bash
re-shell templates list --json > templates.json
```

```json
{
  "ok": true,
  "data": [
    {
      "id": "express",
      "name": "express",
      "displayName": "Express.js",
      "description": "Fast, unopinionated, minimalist web framework for Node.js with extensive middleware ecosystem",
      "language": "typescript",
      "framework": "express",
      "version": "4.19.2",
      "tags": ["nodejs", "express", "api", "rest", "middleware", "typescript"],
      "features": ["middleware", "routing", "cors", "authentication", "validation"],
      "port": 3000,
      "fileCount": 27
    }
  ],
  "warnings": []
}
```

## Consuming the contract in TypeScript

Validate any payload at runtime against the same schema the CLI used to produce
it:

```ts
import { jsonResponseSchema, workspaceSummarySchema } from '@re-shell/contracts';
import type { JsonResponse, WorkspaceSummary } from '@re-shell/contracts';

const envelope = jsonResponseSchema(workspaceSummarySchema);
const parsed = envelope.safeParse(JSON.parse(stdout));

if (parsed.success && parsed.data.ok) {
  const summary: WorkspaceSummary = parsed.data.data;
  // ...
}
```

A quick shell consumer with `jq`:

```bash
re-shell workspace health --json | jq '.data.status'   # "degraded"
re-shell templates list --json   | jq '.data | length' # 205
```

## See also

- [Contracts Package](/re-shell/architecture/contracts-package/) — the schemas and types.
- [`workspace`](/re-shell/cli/workspace/) and [`templates`](/re-shell/cli/templates/) — commands that emit these payloads.
- [Dashboard](/re-shell/dashboard/overview/) — the hub reads the same envelopes over SSE/WS.
