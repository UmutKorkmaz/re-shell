---
title: "JSON Contract"
description: "The stable, typed { ok, data, warnings } envelope every --json command emits, the exact wire schemas and adapters behind it, the closed ErrorCode vocabulary, and exit codes."
---

Every Re-Shell command that accepts `--json` emits **one envelope** on stdout that
scripts, CI, the [dashboard](/re-shell/dashboard/overview/), the MCP server and the VS
Code extension parse. The envelope, its error-code vocabulary and the exact shape of
each command's payload are defined once, as [zod](https://zod.dev) schemas in
[`@re-shell/contracts`](/re-shell/architecture/contracts-package/), and the CLI is
conformance-tested against them, so the wire shape and the TypeScript types cannot
drift.

```bash
re-shell workspace summary --json
re-shell templates list --json > templates.json
```

> The reference for every command's payload, plus the full error-code table, is the
> **generated** [`docs/CLI-CONTRACTS.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/CLI-CONTRACTS.md).
> It is produced from the built CLI and the wire schemas by
> `node packages/cli/scripts/gen-cli-contracts.mjs` and checked in CI, so it
> cannot go stale silently. It describes **CLI envelopes**; the dashboard's hub
> transport (SSE `/events`, WS `/jobs`) is defined by schemas in the same package
> and described on [Secure Hub](/re-shell/architecture/secure-hub/).

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

1. **Exactly one envelope on stdout**, a single `JSON.parse`-able object terminated by one
   `\n`. No pretty-printing on the wire (samples here are formatted only for readability).
2. **stdout is pure JSON.** Everything incidental (spinners, banners, progress, library
   logging, human-readable previews) goes to **stderr**, never stdout. A usage error
   (unknown flag or command) is also an envelope: `USAGE_ERROR`, with the parser's
   message on stderr.
3. **`warnings` is always present** on both branches (`[]` when empty).
4. **Non-zero exit on `ok: false`.** Error envelopes set the exit code to `1`.
5. **`details` is omitted when absent.**
6. **`--version` prints only the version**, with no banner.
7. **A closed pipe is handled.** `re-shell commands list --json | head -c 100` exits
   cleanly (EPIPE is swallowed), and large payloads are not truncated when piped:
   `re-shell commands list --json | wc -c` and the same command redirected to a file
   print the same byte count. (An older caveat about truncation on pipes no longer
   applies.)

Unexpected failures inside a command are the generic `COMMAND_ERROR`; bad flags and
arguments are `USAGE_ERROR`; commands with their own failure modes use specific codes.

## Exit codes

| Exit code | Meaning |
| --- | --- |
| `0` | Success: `{ "ok": true }`. |
| `1` | Handled error: `{ "ok": false, "error": { ... } }` with a closed `ErrorCode`. |

A command can also exit `1` with `ok: true` when its result is a failing *gate*:
**`doctor`** returns `{ ok: true, data: { checks, summary, healthy } }` and exits 1 when
`healthy` is false, `security audit verify` exits 1 on a broken chain, `service
validate` on an invalid link graph, `workspace policy check` on a failed `error` rule,
and `analyze --fail-on <severity>` at or above the severity. The payload tells you why.

## ErrorCode vocabulary

`ErrorCode` is a **closed** zod enum (148 values in this tree). Emitting a code outside
the union is a compile error in the CLI, so consumers can switch on it safely. Some
codes are *reserved* (defined, not yet emitted); the generated table in
`docs/CLI-CONTRACTS.md` marks which. A few you will meet often:

| Code | Emitted by |
| --- | --- |
| `COMMAND_ERROR` | Any command that fails unexpectedly |
| `USAGE_ERROR` | Unknown flag/command, invalid arguments |
| `NOT_IN_MONOREPO` | `workspace summary\|status\|graph diff` (no monorepo root found) |
| `WORKSPACE_NOT_FOUND` | `workspace health` (no workspace config in cwd) |
| `TEMPLATE_NOT_FOUND` | `templates show <id>`, `create --template <id>` (unknown id; carries `details`) |
| `CREATE_INVALID_OPTIONS` | `create` (for example `--type` other than `app\|package\|lib\|tool`) |
| `DOCTOR_ERROR`, `ANALYZE_ERROR`, `HEALTH_CHECK_ERROR` | `doctor`, `analyze`, `workspace health` |
| `SCHEMA_VALIDATION_ERROR` | `config schema validate` |
| `POLICY_CHECK_ERROR` | `workspace policy check` |
| `K8S_GENERATE_ERROR`, `HELM_GENERATE_ERROR`, `GITOPS_GENERATE_ERROR` | `k8s ...` generators |
| `BRIDGE_GENERATE_ERROR` | `service bridge ...` |
| `PLUGIN_INSTALL_ERROR`, `MARKETPLACE_*` | `plugin ...` |
| `UI_TEST_ERROR`, `UI_COMPONENT_ERROR` | `ui test`, `ui component new` |
| `FIX_CI_ERROR` | `fix` |
| `SERVICES_*` | `service run ...` (spawn failure, immediate exit, stale pid file) |
| `PKG_*` | `pkg ...` (`PKG_INVALID_ARGS`, `PKG_TOOLCHAIN_MISSING`, `PKG_UNSUPPORTED_OPERATION`) |

## Two layers: wire and domain

`@re-shell/contracts` deliberately has two layers for CLI data:

- **Wire schemas** (`workspaceSummaryWireSchema`, `workspaceHealthWireSchema`,
  `templatesListWireSchema`, `commandCatalogWireSchema`, `doctorWireSchema`,
  `analyzeWireSchema`, ...) describe **exactly what the CLI prints**. Use them to validate
  raw output. They are loose: declared keys are enforced and unknown keys are kept, so a
  newer CLI's extra fields pass through. The conformance suite fails the build if the CLI
  prints a key a wire schema does not declare.
- **Domain schemas and adapters** (`WorkspaceSummary`, `HealthSummary`, ...) are the models
  the UI renders. They differ on purpose (health is `healthy|degraded|critical` on the
  wire and `pass|warn|fail` in the UI). Pure adapter functions
  (`workspaceSummaryWireToModel`, `healthWireToSummary`) convert a validated wire payload
  into the domain model.

## Real examples

These are captured from the built CLI. Samples are abbreviated.

### `workspace health --json`

```bash
re-shell workspace health --json
```

```json
{
  "ok": true,
  "data": {
    "score": 67,
    "status": "critical",
    "checks": [
      { "name": "Workspaces", "status": "healthy", "message": "1 workspace(s) detected", "details": ["billing (service)"] },
      { "name": "File Structure", "status": "warning", "message": "Workspace structure could be improved", "details": ["Missing recommended files: README.md"] },
      { "name": "Package Manager", "status": "warning", "message": "No package manager lock file detected" }
    ]
  },
  "warnings": ["Workspace structure could be improved", "No package manager lock file detected"]
}
```

Run outside any workspace and you get the error branch with a non-zero exit.

### `workspace summary --json`

```json
{
  "ok": true,
  "data": {
    "root": "/abs/path/to/monorepo",
    "packageManager": "pnpm",
    "workspaces": [
      { "name": "@acme/ui", "path": "packages/ui", "type": "package", "framework": "react-ts", "version": "1.0.0", "dependencies": ["react"] }
    ],
    "graph": { "apps": [], "services": [] },
    "health": { "score": 83, "status": "degraded", "checks": [] }
  },
  "warnings": []
}
```

### `templates list --json`

Every scaffolding template (208 at this version). The payload is about 95 KB.

```json
{
  "ok": true,
  "data": [
    {
      "id": "express", "name": "express", "displayName": "Express.js",
      "language": "typescript", "framework": "express", "version": "4.19.2",
      "tags": ["nodejs", "express", "api", "rest", "middleware", "typescript"],
      "features": ["middleware", "routing", "cors", "authentication", "validation"],
      "port": 3000, "fileCount": 34
    }
  ],
  "warnings": []
}
```

## Consuming the contract in TypeScript

Validate raw CLI output with the **wire** schema, then adapt it if you need the UI model:

```ts
import {
  jsonResponseSchema,
  workspaceSummaryWireSchema,
  workspaceSummaryWireToModel,
} from '@re-shell/contracts';

const parsed = jsonResponseSchema(workspaceSummaryWireSchema).safeParse(JSON.parse(stdout));

if (parsed.success && parsed.data.ok) {
  const model = workspaceSummaryWireToModel(parsed.data.data); // WorkspaceSummary (apps, services, templates)
  // ...
}
```

A quick shell consumer with `jq`:

```bash
re-shell workspace health --json | jq '.data.status'
re-shell templates list --json   | jq '.data | length'   # 208
```

## See also

- [Contracts Package](/re-shell/architecture/contracts-package/): the schemas, adapters and exports.
- [`workspace`](/re-shell/cli/workspace/) and [`templates`](/re-shell/cli/templates/): commands that emit these payloads.
- [Dashboard](/re-shell/dashboard/overview/): the hub reads the same envelopes over SSE/WS.
