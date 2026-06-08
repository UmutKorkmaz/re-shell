# Re-Shell CLI JSON Contracts

Machine-readable JSON contracts for the Re-Shell CLI. Every command that
accepts `--json` emits a single-line envelope on stdout that downstream
consumers (the UI hub server, scripts, CI) parse.

> **This document is regenerated from real CLI output.** Every payload below was
> captured by running the built CLI (`packages/cli/dist/index.js`) against the
> monorepo root and is reproduced by the conformance suite at
> `packages/cli/tests/contract-conformance.test.ts`. The aspirational/historical
> draft of this file was archived to
> [`legacy/CLI-CONTRACTS.old.md`](./legacy/CLI-CONTRACTS.old.md).

---

## Source of truth: `@umutkorkmaz/contracts`

The **wire envelope** and the **error-code vocabulary** are defined once, as
zod schemas, in the `@umutkorkmaz/contracts` package. The CLI imports them (it
no longer re-declares its own copies):

- `envelope.ts` — `JsonResponse<T>` / `JsonSuccess<T>` / `JsonError`,
  `errorCodeSchema` / `ErrorCode`, and the `jsonResponseSchema(dataSchema)`
  helper that builds a runtime validator for the full envelope around any data
  schema.
- `schemas.ts` — domain data schemas.

The TS types are derived from the zod schemas via `z.infer`, so the validators
and the types cannot drift. The CLI's `packages/cli/src/utils/json-output.ts`
re-exports the envelope types and centralizes the single stdout write.

> **Envelope vs. data shape.** The **envelope** (`{ ok, data, warnings }` /
> `{ ok: false, error, warnings }`) is the enforced, validated cross-process
> contract — every command below conforms to it, verified by
> `jsonResponseSchema(...)` in the conformance suite. The **data payload** shape
> for each command is what the CLI ships today (documented per command below).
> Several payloads do **not** match the aspirational domain schemas in
> `contracts/schemas.ts` (`workspaceSummarySchema`, `healthSummarySchema`,
> `templateSummarySchema`, `commandSpecSchema`); the schemas describe a target
> shape, while this document records reality. The conformance suite pins the
> real shape so any drift is caught.

---

## Response envelope contract

All `--json` output obeys these rules:

1. **Exactly one line.** stdout carries a single JSON object terminated by one
   `\n`. There is no pretty-printing and no multi-line output. (Pretty-printed
   samples below are for readability only — on the wire it is one line.)
2. **stdout is pure JSON.** All human-facing chrome — spinners, banners,
   progress text — is suppressed in `--json` mode and never reaches stdout.
   Genuine errors are routed to **stderr** only.
3. **`warnings` is always present** on both success and error envelopes (it is
   `[]` when there are none).
4. **Non-zero exit on `ok: false`.** Error envelopes set `process.exitCode = 1`,
   so a non-zero exit code accompanies every `{ "ok": false }` payload.
5. **`details` is omitted when absent** from the error body (keeps shapes
   minimal); it is present only when a command supplies structured context.

### Success envelope

```json
{ "ok": true, "data": { "...": "..." }, "warnings": [] }
```

### Error envelope

```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "Human-readable message" }, "warnings": [] }
```

With optional `details`:

```json
{ "ok": false, "error": { "code": "TEMPLATE_NOT_FOUND", "message": "Template not found: foo", "details": { "id": "foo" } }, "warnings": [] }
```

---

## Error code vocabulary (`ErrorCode`)

Closed set, defined by `errorCodeSchema` in `@umutkorkmaz/contracts`. Emitting a
code outside this union is a compile error in the CLI.

| Code | Emitted by |
| --- | --- |
| `NOT_IN_MONOREPO` | `workspace summary` (no monorepo root found) |
| `LIST_WORKSPACES_ERROR` | `workspace list` |
| `GRAPH_GENERATION_ERROR` | `workspace graph` |
| `WORKSPACE_NOT_FOUND` | `workspace health` (no workspace config in cwd) |
| `TEMPLATE_NOT_FOUND` | `templates show <id>` (unknown id) |
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

---

## Commands

Each section lists the exact invocation, the data-payload keys, and a real
captured sample. Reproduce any sample with:

```bash
pnpm --filter @umutkorkmaz/re-shell-cli run build
node packages/cli/dist/index.js <command> --json
```

> **Large-payload / pipe caveat.** The CLI calls `process.exit()` as soon as a
> command resolves, which truncates large stdout payloads (> ~64KB, e.g.
> `commands list`) when stdout is an OS **pipe**. Redirect to a file
> (`... --json > out.json`) — the supported capture pattern — to receive the
> full payload. The conformance suite captures via a file for this reason.

### `re-shell workspace summary --json`

Aggregate snapshot of the monorepo: root, package manager, all workspaces, the
dependency graph projection, and a health roll-up.

- **Envelope:** `JsonResponse<WorkspaceSummary>`
- **`data` keys:** `root`, `packageManager`, `workspaces[]`, `graph`, `health`
  - `workspaces[]` items: `name`, `path`, `type`, `framework?`, `version?`, `dependencies[]`
  - `graph`: `{ apps[], services[] }` (see `workspace graph` below)
  - `health`: `{ score, status, checks[] }` (see `workspace health` below)
- **Error codes:** `NOT_IN_MONOREPO`, `WORKSPACE_SUMMARY_ERROR`

```json
{
  "ok": true,
  "data": {
    "root": "/abs/path/to/monorepo",
    "packageManager": "pnpm",
    "workspaces": [
      {
        "name": "@umutkorkmaz/ui",
        "path": "packages/ui",
        "type": "package",
        "framework": "react-ts",
        "version": "0.2.2",
        "dependencies": ["@umutkorkmaz/contracts", "react", "..."]
      }
    ],
    "graph": { "apps": [], "services": [] },
    "health": { "score": 83, "status": "degraded", "checks": [] }
  },
  "warnings": []
}
```

### `re-shell workspace graph --json`

Internal workspace dependency graph, partitioned into apps and services. Each
node's `dependencies` lists only internal workspace-to-workspace edges.

- **Envelope:** `JsonResponse<ContractGraph>`
- **`data` keys:** `apps[]`, `services[]`
  - node: `name`, `path`, `framework` (string or `null`), `dependencies[]`
- **Error codes:** `NOT_IN_MONOREPO`, `GRAPH_GENERATION_ERROR`

```json
{
  "ok": true,
  "data": {
    "apps": [
      { "name": "@umutkorkmaz/ui-web", "path": "apps/web", "framework": "react-ts", "dependencies": ["@umutkorkmaz/contracts", "@umutkorkmaz/ui"] }
    ],
    "services": [
      { "name": "@umutkorkmaz/contracts", "path": "packages/contracts", "framework": null, "dependencies": [] }
    ]
  },
  "warnings": []
}
```

### `re-shell workspace health --json`

Health diagnostics for the workspace. `warnings[]` mirrors the non-fatal checks.

- **Envelope:** `JsonResponse<CanonicalHealth>`
- **`data` keys:** `score` (number), `status` (`healthy` | `degraded` | `critical`), `checks[]`
  - check: `name`, `status` (e.g. `healthy` | `warning` | `critical`), `message`, `details[]?`
- **Error codes:** `WORKSPACE_NOT_FOUND`, `HEALTH_CHECK_ERROR`

```json
{
  "ok": true,
  "data": {
    "score": 83,
    "status": "degraded",
    "checks": [
      { "name": "Workspaces", "status": "healthy", "message": "6 workspace(s) detected", "details": ["@umutkorkmaz/ui (package)"] },
      { "name": "File Structure", "status": "warning", "message": "Workspace structure could be improved", "details": ["Missing recommended files: README.md"] },
      { "name": "Package Manager", "status": "healthy", "message": "Using pnpm" }
    ]
  },
  "warnings": ["Workspace structure could be improved"]
}
```

**Error path** (run outside any workspace):

```json
{ "ok": false, "error": { "code": "WORKSPACE_NOT_FOUND", "message": "No workspace configuration found" }, "warnings": [] }
```

### `re-shell templates list --json`

All available scaffolding templates. (Payload is large — capture to a file.)

- **Envelope:** `JsonResponse<TemplateSummary[]>`
- **item keys:** `id`, `name`, `displayName`, `description`, `language`,
  `framework`, `version`, `tags[]`, `features[]`, `port`, `fileCount`
- **Error codes:** `TEMPLATES_LIST_ERROR`

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

### `re-shell templates show <id> --json`

A single template by id. Same item shape as `templates list`.

- **Envelope:** `JsonResponse<TemplateSummary>`
- **Error codes:** `TEMPLATE_NOT_FOUND` (with `details: { id }`)

```json
{
  "ok": true,
  "data": {
    "id": "express",
    "name": "express",
    "displayName": "Express.js",
    "language": "typescript",
    "framework": "express",
    "version": "4.19.2",
    "tags": ["nodejs", "express", "api", "rest", "middleware", "typescript"],
    "features": ["middleware", "routing", "cors"],
    "port": 3000,
    "fileCount": 27
  },
  "warnings": []
}
```

**Error path** (`templates show <unknown> --json`):

```json
{ "ok": false, "error": { "code": "TEMPLATE_NOT_FOUND", "message": "Template not found: __nope__", "details": { "id": "__nope__" } }, "warnings": [] }
```

### `re-shell commands list --json`

The machine-readable command catalog used to power a Command Builder UI. One
entry per runnable command. (Payload is large — capture to a file.)

- **Envelope:** `JsonResponse<CommandCatalogEntry[]>`
- **item keys:** `path`, `aliases[]`, `description`, `args[]`
  (`{ name, required }`), `flags[]` (`{ name, description, takesValue, default? }`),
  `supportsJson`, `supportsDryRun`, `destructive`
- **Error codes:** `COMMANDS_LIST_ERROR`

```json
{
  "ok": true,
  "data": [
    {
      "path": "analyze",
      "aliases": [],
      "description": "Analyze project bundles, dependencies, performance, and security",
      "args": [],
      "flags": [
        { "name": "--workspace", "description": "Analyze a specific workspace only", "takesValue": true },
        { "name": "--type", "description": "Analysis type (bundle|dependencies|performance|security|all)", "takesValue": true, "default": "all" },
        { "name": "--json", "description": "Output results as JSON", "takesValue": false }
      ],
      "supportsJson": true,
      "supportsDryRun": false,
      "destructive": false
    }
  ],
  "warnings": []
}
```

### `re-shell doctor --json`

Project diagnostics. `data.checks[]` each carry a `status` and an optional
`suggestion`.

- **Envelope:** `JsonResponse<{ checks[] }>`
- **check keys:** `name`, `status` (e.g. `success` | `warning`), `message`, `suggestion?`
- **Error codes:** `DOCTOR_ERROR`

```json
{
  "ok": true,
  "data": {
    "checks": [
      { "name": "package-json", "status": "warning", "message": "Package.json issues: Missing engines specification", "suggestion": "Update package.json with missing fields" },
      { "name": "workspace-config", "status": "success", "message": "Found 6 properly configured workspaces" }
    ]
  },
  "warnings": []
}
```

### `re-shell analyze --json`

Bundle, dependency, performance, and security analysis for every workspace.
**Slow** — it may build workspaces (multi-second to minutes). Documented here;
not exercised in the conformance suite for runtime reasons.

- **Envelope:** `JsonResponse<{ timestamp, monorepo, workspaces, analysis }>`
- **`data` keys:** `timestamp`, `monorepo`, `workspaces` (count), `analysis`
  (object keyed by workspace path; each value has `bundle`, `dependencies`,
  `performance`, `security`)
- **Error codes:** `ANALYZE_ERROR`

```json
{
  "ok": true,
  "data": {
    "timestamp": "2026-06-07T17:56:05.062Z",
    "monorepo": "re-shell-cli",
    "workspaces": 6,
    "analysis": {
      "apps/web": {
        "bundle": { "workspace": "apps/web", "size": {}, "chunks": [], "treeshaking": {} },
        "dependencies": { "workspace": "apps/web", "total": 6, "production": 2, "development": 4, "outdated": [], "duplicates": [], "vulnerabilities": [], "licenses": [] },
        "performance": { "workspace": "apps/web", "buildTime": -1, "bundleSize": "N/A", "loadTime": {}, "suggestions": [] },
        "security": { "workspace": "apps/web", "audit": {}, "sensitiveFiles": [], "secretPatterns": [], "recommendations": [] }
      }
    }
  },
  "warnings": []
}
```

### `re-shell list --json`

Microfrontends discovered in the project's apps directory.

- **Envelope:** `JsonResponse<{ microfrontends[] }>`
- **item keys:** `name`, `path` (absolute), `version`, `team?`, `route`
- **Error codes:** `NOT_IN_RESHELL_PROJECT`, `APPS_DIR_NOT_FOUND`, `LIST_MICROFRONTENDS_ERROR`

```json
{
  "ok": true,
  "data": {
    "microfrontends": [
      { "name": "name", "path": "/abs/path/apps/name", "version": "0.1.0", "team": "re-shell", "route": "/name" },
      { "name": "web", "path": "/abs/path/apps/web", "version": "1.0.0", "route": "/web" }
    ]
  },
  "warnings": []
}
```

### `re-shell workspace list --json`

Flat array of discovered workspaces (same item shape as the `workspaces[]`
inside `workspace summary`). Used by the faked-TTY spinner regression to prove
`--json` stdout stays clean even when the process believes it is attached to an
interactive terminal.

- **Envelope:** `JsonResponse<WorkspaceInfo[]>`
- **item keys:** `name`, `path`, `type`, `framework?`, `version?`, `dependencies[]?`
- **Error codes:** `LIST_WORKSPACES_ERROR`

```json
{
  "ok": true,
  "data": [
    { "name": "@umutkorkmaz/contracts", "path": "packages/contracts", "type": "package", "version": "0.1.0", "dependencies": ["zod", "typescript"] }
  ],
  "warnings": []
}
```

---

## Conformance test

`packages/cli/tests/contract-conformance.test.ts` is the executable counterpart
to this document. For every command it spawns the built CLI, asserts stdout is
exactly one `JSON.parse`-able line, and validates the payload against
`jsonResponseSchema(<dataSchema>)` from `@umutkorkmaz/contracts`:

- **ok-path:** `workspace summary`, `workspace graph`, `workspace health`,
  `templates list`, `templates show express`, `commands list`, `doctor`, `list`.
- **error-path:** `templates show <bad>` (`{ ok: false }` + `TEMPLATE_NOT_FOUND`
  + non-zero exit) and `workspace health` in a non-workspace dir (`{ ok: false }`
  + `WORKSPACE_NOT_FOUND` + non-zero exit).
- **faked-TTY regression:** `workspace list --json` under a forced
  `process.stdout.isTTY = true` carries no spinner frames or ANSI escapes — just
  the one JSON line.

Run it (the package build must produce a fresh `dist/` first):

```bash
pnpm --filter @umutkorkmaz/re-shell-cli run build
cd packages/cli && npx vitest run tests/contract-conformance.test.ts
```
