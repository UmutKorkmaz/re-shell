# Re-Shell CLI JSON Contracts

Machine-readable JSON contracts for the Re-Shell CLI. Every command that
accepts `--json` emits a single-line envelope on stdout that downstream
consumers (the dashboard hub, the MCP server, the VS Code extension, scripts,
CI) parse.

> **The shapes and the error table in this document are generated, not
> hand-captured.** `packages/cli/scripts/gen-cli-contracts.mjs` builds a fixture
> workspace, runs the built CLI (`packages/cli/dist/index.js`) against it for every
> command below, checks each real envelope against the wire schemas in
> `@re-shell/contracts`, and rewrites the regions between the
> `<!-- BEGIN GENERATED: ... -->` / `<!-- END GENERATED: ... -->` markers. It fails
> (and writes nothing) when the real output and the contract disagree. Everything
> outside the markers is prose.
>
> ```bash
> pnpm --filter @re-shell/cli build
> node packages/cli/scripts/gen-cli-contracts.mjs           # regenerate this file
> node packages/cli/scripts/gen-cli-contracts.mjs --check   # CI: fail if it is stale
> ```
>
> The CLI test suite (`packages/cli/tests/contract-conformance.test.ts`) runs the
> same check, so a contract, CLI or error-code change that is not reflected here
> fails the build.

---

## Source of truth: `@re-shell/contracts`

`@re-shell/contracts` is the single place the wire is defined. It holds two
layers that are deliberately different and must not be confused:

1. **Wire schemas** (`wire.ts`, the `*WireSchema` exports) describe **exactly what
   the CLI prints** under `data`. Real CLI output is validated against them by the
   conformance suite, the MCP server, the VS Code extension and the dashboard's
   feed parsing. They are loose objects: every declared key is enforced, unknown
   keys are preserved (so a consumer that forwards the payload never drops data
   from a newer CLI), and the conformance suite fails on any key the CLI prints
   that the schema does not declare.
2. **Domain schemas** (`schemas.ts`: `workspaceSummarySchema`,
   `healthSummarySchema`, `templateSummarySchema`, `commandSpecSchema`, ...) are
   the **UI models** the React components render. They are richer than, and shaped
   differently from, the wire (for example `templateSummarySchema` needs a
   `domain` and a `command` that the CLI does not print). They are **never**
   validated against raw CLI output: doing that is the bug the wire layer exists
   to prevent.

`adapters.ts` is the documented bridge from the first layer to the second:

| Wire | Domain | Adapter |
| --- | --- | --- |
| `workspaceHealthWireSchema` (`healthy`/`degraded`/`critical`, checks with `name`) | `HealthSummary` (`pass`/`warn`/`fail`, checks with `id`/`title`/`level`) | `healthWireToSummary` |
| `workspaceSummaryWireSchema` (`root`, `workspaces[]`, `graph`, `health`) | `WorkspaceSummary` (`path`, `name`, `apps[]`, `services[]`, `health`) | `workspaceSummaryWireToModel` |
| `templateWireSchema` (no `domain`/`tier`/`command`) | `TemplateSummary` | dashboard-side `feedToTemplateSummary` (derives the missing fields) |

The envelope itself (`jsonResponseSchema`, `errorCodeSchema`) lives in
`envelope.ts`; the CLI's `packages/cli/src/utils/json-output.ts` re-exports its
types and is the one place that writes to stdout.

### Command to schema map

<!-- BEGIN GENERATED: schema-map -->
| Command | Wire schema (`@re-shell/contracts`) | Domain / UI model |
| --- | --- | --- |
| `re-shell workspace summary` | `workspaceSummaryWireSchema` | `WorkspaceSummary` via `workspaceSummaryWireToModel` |
| `re-shell workspace graph` | `workspaceGraphWireSchema` | none (the dashboard validates the wire shape directly) |
| `re-shell workspace health` | `workspaceHealthWireSchema` | `HealthSummary` via `healthWireToSummary` |
| `re-shell workspace list` | `workspaceListWireSchema` | none |
| `re-shell templates list` | `templatesListWireSchema` | `TemplateSummary` via the dashboard adapter `feedToTemplateSummary` |
| `re-shell templates show <id>` | `templateWireSchema` | `TemplateSummary` via the dashboard adapter `feedToTemplateSummary` |
| `re-shell templates matrix` | `templatesMatrixWireSchema` | none |
| `re-shell commands list` | `commandCatalogWireSchema` | none (`CommandSpec` is the resolved, ready-to-spawn form, not the catalog) |
| `re-shell doctor` | `doctorWireSchema` | none |
| `re-shell analyze` | `analyzeWireSchema` | none |
| `re-shell list` | `microfrontendListWireSchema` | none |
<!-- END GENERATED: schema-map -->

---

## Response envelope contract

All `--json` output obeys these rules:

1. **Exactly one line.** stdout carries a single JSON object terminated by one
   `\n`. There is no pretty-printing and no multi-line output. (The samples below
   are pretty-printed for readability only.)
2. **stdout is pure JSON.** All human-facing chrome (spinners, banners, progress
   text) is suppressed in `--json` mode and never reaches stdout. Genuine errors
   are routed to **stderr** only.
3. **Complete at any size.** The CLI drains stdout before it exits, so a payload of
   any size (`commands list` is several hundred KB) can be read from a pipe as well
   as from a file. The conformance suite reads every command through a pipe.
4. **`warnings` is always present** on both success and error envelopes (it is
   `[]` when there are none).
5. **Non-zero exit on `ok: false`.** Error envelopes set `process.exitCode = 1`,
   so a non-zero exit code accompanies every `{ "ok": false }` payload.
6. **`details` is omitted when absent** from the error body (keeps shapes
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

Closed set, defined by `errorCodeSchema` in `@re-shell/contracts`. Emitting a
code outside this union is a compile error in the CLI. The table is generated: the
status of each code is read from the CLI sources every time it is regenerated, so
it cannot claim a code is emitted when nothing emits it.

<!-- BEGIN GENERATED: error-codes -->
The vocabulary is `errorCodeSchema` in `@re-shell/contracts` (90 codes). A code is **emitted** when it appears as a string literal in the code of `packages/cli/src`, and **reserved** when it is defined but nothing emits it yet.

| Code | Status | Emitted from |
| --- | --- | --- |
| `NOT_IN_MONOREPO` | emitted | `packages/cli/src/commands/analyze.ts`, `packages/cli/src/commands/ink-tui.tsx`, `packages/cli/src/commands/workspace.ts` |
| `LIST_WORKSPACES_ERROR` | emitted | `packages/cli/src/commands/workspace.ts` |
| `GRAPH_GENERATION_ERROR` | emitted | `packages/cli/src/commands/workspace.ts` |
| `WORKSPACE_NOT_FOUND` | emitted | `packages/cli/src/commands/workspace-graph.ts`, `packages/cli/src/commands/workspace-health.ts`, `packages/cli/src/commands/workspace.ts` |
| `TEMPLATE_NOT_FOUND` | emitted | `packages/cli/src/groups/templates.group.ts` |
| `INVALID_VARIABLES` | reserved | |
| `NOT_IN_RESHELL_PROJECT` | emitted | `packages/cli/src/commands/list.ts` |
| `APPS_DIR_NOT_FOUND` | emitted | `packages/cli/src/commands/list.ts` |
| `LIST_MICROFRONTENDS_ERROR` | emitted | `packages/cli/src/commands/list.ts` |
| `TEMPLATES_LIST_ERROR` | emitted | `packages/cli/src/commands/workspace.ts`, `packages/cli/src/groups/templates.group.ts` |
| `WORKSPACE_SUMMARY_ERROR` | emitted | `packages/cli/src/commands/workspace.ts` |
| `COMMANDS_LIST_ERROR` | emitted | `packages/cli/src/groups/commands.group.ts` |
| `DOCTOR_ERROR` | reserved | |
| `ANALYZE_ERROR` | emitted | `packages/cli/src/commands/analyze.ts` |
| `HEALTH_CHECK_ERROR` | reserved | |
| `SCHEMA_VALIDATION_ERROR` | emitted | `packages/cli/src/commands/plugin-create.ts`, `packages/cli/src/groups/config/schema.ts` |
| `MONOREPO_MIGRATE_ERROR` | emitted | `packages/cli/src/groups/workspace.group.ts` |
| `TEMPLATES_MATRIX_ERROR` | emitted | `packages/cli/src/groups/templates.group.ts` |
| `TEMPLATE_DRY_RUN_ERROR` | emitted | `packages/cli/src/groups/templates.group.ts`, `packages/cli/src/index.ts` |
| `PLUGIN_INSTALL_ERROR` | emitted | `packages/cli/src/commands/plugin-create.ts`, `packages/cli/src/commands/plugin.ts` |
| `PLUGIN_UPDATE_ERROR` | emitted | `packages/cli/src/commands/plugin.ts` |
| `PLUGIN_VALIDATE_ERROR` | emitted | `packages/cli/src/commands/plugin.ts` |
| `MARKETPLACE_UNREACHABLE` | emitted | `packages/cli/src/commands/plugin-marketplace.ts`, `packages/cli/src/commands/workspace-policy-packs.ts` |
| `MARKETPLACE_ERROR` | emitted | `packages/cli/src/commands/plugin-marketplace.ts` |
| `MARKETPLACE_VERIFY_ERROR` | emitted | `packages/cli/src/commands/plugin-marketplace.ts`, `packages/cli/src/commands/workspace-policy-packs.ts` |
| `POLICY_CHECK_ERROR` | emitted | `packages/cli/src/commands/workspace-policy.ts` |
| `DRIFT_CHECK_ERROR` | emitted | `packages/cli/src/commands/workspace-policy.ts` |
| `K8S_GENERATE_ERROR` | emitted | `packages/cli/src/commands/k8s-generate.ts` |
| `HELM_GENERATE_ERROR` | emitted | `packages/cli/src/commands/helm-generate.ts` |
| `GITOPS_GENERATE_ERROR` | emitted | `packages/cli/src/commands/gitops-generate.ts` |
| `BRIDGE_GENERATE_ERROR` | emitted | `packages/cli/src/commands/bridge-generate.ts` |
| `AI_INTENT_ERROR` | emitted | `packages/cli/src/ai/resolver.ts`, `packages/cli/src/groups/ai.group.ts` |
| `FIND_ERROR` | emitted | `packages/cli/src/groups/find.group.ts`, `packages/cli/src/groups/templates.group.ts` |
| `AGENTS_ERROR` | emitted | `packages/cli/src/groups/agents.group.ts` |
| `RUN_ERROR` | emitted | `packages/cli/src/groups/run.group.ts` |
| `CACHE_ERROR` | emitted | `packages/cli/src/groups/cache.group.ts` |
| `DEV_CLUSTER_ERROR` | emitted | `packages/cli/src/commands/dev-cluster.ts` |
| `SCORECARD_ERROR` | emitted | `packages/cli/src/commands/scorecard.ts`, `packages/cli/src/groups/scorecard.group.ts` |
| `RELEASE_ERROR` | emitted | `packages/cli/src/commands/release.ts`, `packages/cli/src/groups/release.group.ts` |
| `MIGRATE_ERROR` | emitted | `packages/cli/src/commands/migrate.ts` |
| `CATALOG_ERROR` | emitted | `packages/cli/src/commands/catalog.ts` |
| `FEDERATION_ERROR` | emitted | `packages/cli/src/commands/federation.ts` |
| `GENERATE_ERROR` | emitted | `packages/cli/src/groups/generate.group.ts` |
| `DEV_FUSION_ERROR` | emitted | `packages/cli/src/commands/dev-restart-plan.ts` |
| `API_VERIFY_ERROR` | emitted | `packages/cli/src/commands/api-verify.ts` |
| `FIX_CI_ERROR` | emitted | `packages/cli/src/commands/fix-ci.ts` |
| `BOUNDARIES_ERROR` | emitted | `packages/cli/src/commands/boundaries.ts` |
| `ENV_ERROR` | emitted | `packages/cli/src/commands/env.ts` |
| `UI_TEST_ERROR` | emitted | `packages/cli/src/commands/ui-test.ts` |
| `PLUGIN_LIST_ERROR` | emitted | `packages/cli/src/commands/plugin.ts` |
| `PLUGIN_INFO_ERROR` | emitted | `packages/cli/src/commands/plugin.ts` |
| `PLUGIN_NOT_FOUND` | emitted | `packages/cli/src/commands/plugin.ts` |
| `PLUGIN_UNINSTALL_ERROR` | emitted | `packages/cli/src/commands/plugin.ts` |
| `PLUGIN_PIN_ERROR` | emitted | `packages/cli/src/commands/plugin.ts` |
| `PLUGIN_REVIEW_ERROR` | emitted | `packages/cli/src/commands/plugin.ts` |
| `POLICY_PACK_ERROR` | emitted | `packages/cli/src/commands/workspace-policy-packs.ts` |
| `POLICY_PACK_NOT_FOUND` | emitted | `packages/cli/src/commands/workspace-policy-packs.ts` |
| `UNAUTHENTICATED` | reserved | |
| `FORBIDDEN` | reserved | |
| `TENANT_NOT_FOUND` | reserved | |
| `INVALID_REQUEST` | reserved | |
| `COMMAND_NOT_ALLOWED` | reserved | |
| `NOT_FOUND` | emitted | `packages/cli/src/utils/k8s-rollback.ts` |
| `METHOD_NOT_ALLOWED` | reserved | |
| `ALREADY_EXISTS` | reserved | |
| `CONFLICT` | reserved | |
| `JOB_NOT_FOUND` | reserved | |
| `RATE_LIMITED` | reserved | |
| `PAYLOAD_TOO_LARGE` | reserved | |
| `UNSUPPORTED_MEDIA_TYPE` | reserved | |
| `CONFIG_ERROR` | reserved | |
| `INTERNAL_ERROR` | reserved | |
| `SERVICE_UNAVAILABLE` | reserved | |
| `SERVICES_NOT_FOUND` | emitted | `packages/cli/src/commands/services.ts` |
| `SERVICES_COMPOSE_UNAVAILABLE` | emitted | `packages/cli/src/commands/services.ts` |
| `SERVICES_COMPOSE_FAILED` | emitted | `packages/cli/src/commands/services.ts`, `packages/cli/src/utils/service-process.ts` |
| `SERVICES_START_FAILED` | emitted | `packages/cli/src/commands/services.ts`, `packages/cli/src/utils/service-process.ts` |
| `SERVICES_STOP_FAILED` | emitted | `packages/cli/src/commands/services.ts`, `packages/cli/src/utils/service-process.ts` |
| `SERVICES_UNHEALTHY` | emitted | `packages/cli/src/commands/services.ts` |
| `SERVICES_ERROR` | emitted | `packages/cli/src/commands/services.ts`, `packages/cli/src/groups/service.group.ts` |
| `DEV_PROFILE_ERROR` | emitted | `packages/cli/src/commands/dev-mode.ts` |
| `K8S_ROLLBACK_ERROR` | emitted | `packages/cli/src/commands/k8s-rollback.ts` |
| `K8S_CRD_ERROR` | emitted | `packages/cli/src/commands/k8s-crd.ts` |
| `K8S_MESH_ERROR` | emitted | `packages/cli/src/commands/k8s-mesh.ts` |
| `K8S_OPERATOR_ERROR` | emitted | `packages/cli/src/commands/k8s-operator.ts` |
| `AI_PROVIDER_ERROR` | emitted | `packages/cli/src/ai/resolver.ts` |
| `AI_CONFIG_ERROR` | emitted | `packages/cli/src/ai/cli.ts`, `packages/cli/src/groups/ai.group.ts` |
| `AI_SESSION_ERROR` | emitted | `packages/cli/src/ai/cli.ts`, `packages/cli/src/ai/resolver.ts`, `packages/cli/src/groups/ai.group.ts` |
| `AI_CACHE_ERROR` | emitted | `packages/cli/src/ai/cli.ts` |
| `AI_SUGGEST_ERROR` | emitted | `packages/cli/src/ai/cli.ts` |
<!-- END GENERATED: error-codes -->

---

## Commands

Each section gives the exact invocation, the wire schema, the error codes the
command can emit (a code marked *(reserved)* is defined but not emitted yet), the
generated `data` shape, and a real output sample where the output depends only on
the fixture workspace. Samples are not shown for commands whose output follows the
template registry or the machine (`templates *`, `commands list`, `doctor`).

### `re-shell workspace summary --json`

Aggregate snapshot of the monorepo: root, package manager, all workspaces, the
dependency graph projection, and a health roll-up. `workspaces[].path` is
relative to `root`; `dependencies` merges `dependencies` and `devDependencies`;
`framework` is omitted when none is detected. The dashboard adapts this with
`workspaceSummaryWireToModel`.

<!-- BEGIN GENERATED: command:workspace-summary -->
- **Invocation:** `re-shell workspace summary --json`
- **Wire schema:** `workspaceSummaryWireSchema` (`@re-shell/contracts`); domain / UI model: `WorkspaceSummary` via `workspaceSummaryWireToModel`
- **Error codes:** `NOT_IN_MONOREPO`, `WORKSPACE_SUMMARY_ERROR`

`data` shape:

```ts
{
  root: string;
  packageManager: 'npm' | 'yarn' | 'pnpm';
  workspaces: Array<{
    name: string;
    path: string;
    type: 'app' | 'package' | 'lib' | 'tool';
    framework?: string;
    version: string;
    dependencies: string[];
  }>;
  graph: {
    apps: Array<{
      name: string;
      path: string;
      framework: string | null;
      dependencies: string[];
    }>;
    services: Array<{
      name: string;
      path: string;
      framework: string | null;
      dependencies: string[];
    }>;
  };
  health: {
    score: number;
    status: 'healthy' | 'degraded' | 'critical';
    checks: Array<{
      name: string;
      status: 'healthy' | 'warning' | 'critical';
      message?: string;
      details?: unknown;
    }>;
    suggestions?: Array<{
      checkId: string;
      cause: string;
      suggestion: string;
      fixable: boolean;
      fixCommand?: string;
    }>;
  };
}
```

Real output for the generator's fixture workspace (`demo-monorepo`; one line on the wire, pretty-printed here):

```json
{
  "ok": true,
  "data": {
    "root": "/path/to/demo-monorepo",
    "packageManager": "pnpm",
    "workspaces": [
      {
        "name": "@demo/web",
        "path": "apps/web",
        "type": "app",
        "framework": "react-ts",
        "version": "1.2.0",
        "dependencies": ["@demo/ui", "react", "typescript"]
      },
      {
        "name": "@demo/admin",
        "path": "apps/admin",
        "type": "app",
        "version": "0.4.0",
        "dependencies": ["@demo/ui", "@demo/utils"]
      },
      {
        "name": "@demo/utils",
        "path": "packages/utils",
        "type": "package",
        "version": "1.0.0",
        "dependencies": []
      },
      {
        "name": "@demo/ui",
        "path": "packages/ui",
        "type": "package",
        "version": "1.0.0",
        "dependencies": ["@demo/utils"]
      },
      {
        "name": "@demo/lint",
        "path": "tools/lint",
        "type": "tool",
        "version": "1.0.0",
        "dependencies": []
      }
    ],
    "graph": {
      "apps": [
        {
          "name": "@demo/web",
          "path": "apps/web",
          "framework": "react-ts",
          "dependencies": ["@demo/ui"]
        },
        {
          "name": "@demo/admin",
          "path": "apps/admin",
          "framework": null,
          "dependencies": ["@demo/ui", "@demo/utils"]
        }
      ],
      "services": [
        {"name": "@demo/utils", "path": "packages/utils", "framework": null, "dependencies": []},
        {
          "name": "@demo/ui",
          "path": "packages/ui",
          "framework": null,
          "dependencies": ["@demo/utils"]
        },
        {"name": "@demo/lint", "path": "tools/lint", "framework": null, "dependencies": []}
      ]
    },
    "health": {
      "score": 83,
      "status": "degraded",
      "checks": [
        {
          "name": "Workspaces",
          "status": "healthy",
          "message": "5 workspace(s) detected",
          "details": [
            "@demo/web (app)",
            "@demo/admin (app)",
            "@demo/utils (package)",
            "@demo/ui (package)",
            "@demo/lint (tool)"
          ]
        },
        {
          "name": "File Structure",
          "status": "warning",
          "message": "Workspace structure could be improved",
          "details": [
            "Missing recommended files: README.md",
            "Not a Git repository (version control recommended)"
          ]
        },
        {"name": "Package Manager", "status": "healthy", "message": "Using pnpm"}
      ]
    }
  },
  "warnings": []
}
```

Error path, real output of `re-shell workspace summary --json` outside any workspace (exit code 1):

```json
{
  "ok": false,
  "error": {
    "code": "NOT_IN_MONOREPO",
    "message": "Not in a monorepo. Run this command from a monorepo root or workspace."
  },
  "warnings": []
}
```
<!-- END GENERATED: command:workspace-summary -->

### `re-shell workspace graph --json`

Internal workspace dependency graph, partitioned into `apps` (workspaces whose
path starts with `apps/`) and `services` (everything else: packages, libs, tools).
Each node's `dependencies` lists only internal workspace-to-workspace edges;
`framework` is `null` (not absent) when none is detected.

<!-- BEGIN GENERATED: command:workspace-graph -->
- **Invocation:** `re-shell workspace graph --json`
- **Wire schema:** `workspaceGraphWireSchema` (`@re-shell/contracts`); domain / UI model: none (the dashboard validates the wire shape directly)
- **Error codes:** `NOT_IN_MONOREPO`, `GRAPH_GENERATION_ERROR`

`data` shape:

```ts
{
  apps: Array<{
    name: string;
    path: string;
    framework: string | null;
    dependencies: string[];
  }>;
  services: Array<{
    name: string;
    path: string;
    framework: string | null;
    dependencies: string[];
  }>;
}
```

Real output for the generator's fixture workspace (`demo-monorepo`; one line on the wire, pretty-printed here):

```json
{
  "ok": true,
  "data": {
    "apps": [
      {
        "name": "@demo/web",
        "path": "apps/web",
        "framework": "react-ts",
        "dependencies": ["@demo/ui"]
      },
      {
        "name": "@demo/admin",
        "path": "apps/admin",
        "framework": null,
        "dependencies": ["@demo/ui", "@demo/utils"]
      }
    ],
    "services": [
      {"name": "@demo/utils", "path": "packages/utils", "framework": null, "dependencies": []},
      {
        "name": "@demo/ui",
        "path": "packages/ui",
        "framework": null,
        "dependencies": ["@demo/utils"]
      },
      {"name": "@demo/lint", "path": "tools/lint", "framework": null, "dependencies": []}
    ]
  },
  "warnings": []
}
```
<!-- END GENERATED: command:workspace-graph -->

### `re-shell workspace health --json`

Health diagnostics for the workspace (`score` is 0-100; `status` is the bucket
derived from it). Check `status` values are `healthy` / `warning` / `critical`,
which is **not** the domain vocabulary (`pass` / `warn` / `fail`); use
`healthWireToSummary` to map. `message` is omitted when empty and `details` is
opaque (a string array for the monorepo checks). `warnings[]` mirrors the
non-fatal checks. With `--explain` the payload gains a `suggestions` array
(`Suggestion[]`).

<!-- BEGIN GENERATED: command:workspace-health -->
- **Invocation:** `re-shell workspace health --json`
- **Wire schema:** `workspaceHealthWireSchema` (`@re-shell/contracts`); domain / UI model: `HealthSummary` via `healthWireToSummary`
- **Error codes:** `WORKSPACE_NOT_FOUND`, `HEALTH_CHECK_ERROR` *(reserved)*

`data` shape:

```ts
{
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  checks: Array<{
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    message?: string;
    details?: unknown;
  }>;
  suggestions?: Array<{
    checkId: string;
    cause: string;
    suggestion: string;
    fixable: boolean;
    fixCommand?: string;
  }>;
}
```

Real output for the generator's fixture workspace (`demo-monorepo`; one line on the wire, pretty-printed here):

```json
{
  "ok": true,
  "data": {
    "score": 83,
    "status": "degraded",
    "checks": [
      {
        "name": "Workspaces",
        "status": "healthy",
        "message": "5 workspace(s) detected",
        "details": [
          "@demo/web (app)",
          "@demo/admin (app)",
          "@demo/utils (package)",
          "@demo/ui (package)",
          "@demo/lint (tool)"
        ]
      },
      {
        "name": "File Structure",
        "status": "warning",
        "message": "Workspace structure could be improved",
        "details": [
          "Missing recommended files: README.md",
          "Not a Git repository (version control recommended)"
        ]
      },
      {"name": "Package Manager", "status": "healthy", "message": "Using pnpm"}
    ]
  },
  "warnings": ["Workspace structure could be improved"]
}
```

Error path, real output of `re-shell workspace health --json` outside any workspace (exit code 1):

```json
{
  "ok": false,
  "error": {"code": "WORKSPACE_NOT_FOUND", "message": "No workspace configuration found"},
  "warnings": []
}
```
<!-- END GENERATED: command:workspace-health -->

### `re-shell workspace list --json`

Flat array of discovered workspaces (the same item shape as `workspaces[]` inside
`workspace summary`). Also used by the faked-TTY spinner regression to prove
`--json` stdout stays clean even when the process believes it is attached to an
interactive terminal.

<!-- BEGIN GENERATED: command:workspace-list -->
- **Invocation:** `re-shell workspace list --json`
- **Wire schema:** `workspaceListWireSchema` (`@re-shell/contracts`); domain / UI model: none
- **Error codes:** `NOT_IN_MONOREPO`, `LIST_WORKSPACES_ERROR`

`data` shape:

```ts
Array<{
  name: string;
  path: string;
  type: 'app' | 'package' | 'lib' | 'tool';
  framework?: string;
  version: string;
  dependencies: string[];
}>
```

Real output for the generator's fixture workspace (`demo-monorepo`; one line on the wire, pretty-printed here):

```json
{
  "ok": true,
  "data": [
    {
      "name": "@demo/web",
      "path": "apps/web",
      "type": "app",
      "framework": "react-ts",
      "version": "1.2.0",
      "dependencies": ["@demo/ui", "react", "typescript"]
    },
    {
      "name": "@demo/admin",
      "path": "apps/admin",
      "type": "app",
      "version": "0.4.0",
      "dependencies": ["@demo/ui", "@demo/utils"]
    },
    {
      "name": "@demo/utils",
      "path": "packages/utils",
      "type": "package",
      "version": "1.0.0",
      "dependencies": []
    },
    {
      "name": "@demo/ui",
      "path": "packages/ui",
      "type": "package",
      "version": "1.0.0",
      "dependencies": ["@demo/utils"]
    },
    {
      "name": "@demo/lint",
      "path": "tools/lint",
      "type": "tool",
      "version": "1.0.0",
      "dependencies": []
    }
  ],
  "warnings": []
}
```
<!-- END GENERATED: command:workspace-list -->

### `re-shell templates list --json`

All available scaffolding templates (`--language` / `--framework` filter the
list). This is the registry projection, not the UI's `TemplateSummary`: there is
no `domain`, `tier`, `database` or scaffold `command`; the dashboard derives them.
`fileCount` is the number of files the scaffold would write. The payload is large
(about 100 KB).

<!-- BEGIN GENERATED: command:templates-list -->
- **Invocation:** `re-shell templates list --json`
- **Wire schema:** `templatesListWireSchema` (`@re-shell/contracts`); domain / UI model: `TemplateSummary` via the dashboard adapter `feedToTemplateSummary`
- **Error codes:** `TEMPLATES_LIST_ERROR`

`data` shape:

```ts
Array<{
  id: string;
  name: string;
  displayName?: string;
  description: string;
  language: string;
  framework: string;
  version?: string;
  tags?: string[];
  features?: string[];
  port?: number;
  fileCount?: number;
}>
```
<!-- END GENERATED: command:templates-list -->

### `re-shell templates show <id> --json`

A single template by id; the same item shape as `templates list`. An unknown id
fails with `TEMPLATE_NOT_FOUND` and `details: { id }`.

<!-- BEGIN GENERATED: command:templates-show -->
- **Invocation:** `re-shell templates show express --json`
- **Wire schema:** `templateWireSchema` (`@re-shell/contracts`); domain / UI model: `TemplateSummary` via the dashboard adapter `feedToTemplateSummary`
- **Error codes:** `TEMPLATE_NOT_FOUND`

`data` shape:

```ts
{
  id: string;
  name: string;
  displayName?: string;
  description: string;
  language: string;
  framework: string;
  version?: string;
  tags?: string[];
  features?: string[];
  port?: number;
  fileCount?: number;
}
```

Error path, real output of `re-shell templates show __nope__ --json` with an unknown id (exit code 1):

```json
{
  "ok": false,
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template not found: __nope__",
    "details": {"id": "__nope__"}
  },
  "warnings": []
}
```
<!-- END GENERATED: command:templates-show -->

### `re-shell templates matrix --json`

Compatibility grid across language, framework, database, cache and deployment
target, plus the distinct values of each facet.

<!-- BEGIN GENERATED: command:templates-matrix -->
- **Invocation:** `re-shell templates matrix --json`
- **Wire schema:** `templatesMatrixWireSchema` (`@re-shell/contracts`); domain / UI model: none
- **Error codes:** `TEMPLATES_MATRIX_ERROR`

`data` shape:

```ts
{
  matrix: Array<{
    id: string;
    name: string;
    displayName?: string;
    language: string;
    framework: string;
    databases: string[];
    caches: string[];
    deploymentTargets: string[];
    features: string[];
  }>;
  facets: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    caches: string[];
    deploymentTargets: string[];
    features: string[];
  };
}
```
<!-- END GENERATED: command:templates-matrix -->

### `re-shell commands list --json`

The machine-readable command catalog used to power a Command Builder UI. One entry
per runnable command. The payload is large (several hundred KB).

<!-- BEGIN GENERATED: command:commands-list -->
- **Invocation:** `re-shell commands list --json`
- **Wire schema:** `commandCatalogWireSchema` (`@re-shell/contracts`); domain / UI model: none (`CommandSpec` is the resolved, ready-to-spawn form, not the catalog)
- **Error codes:** `COMMANDS_LIST_ERROR`

`data` shape:

```ts
Array<{
  path: string;
  aliases: string[];
  description: string;
  args: Array<{
    name: string;
    required: boolean;
  }>;
  flags: Array<{
    name: string;
    description: string;
    takesValue: boolean;
    default?: unknown;
  }>;
  supportsJson: boolean;
  supportsDryRun: boolean;
  destructive: boolean;
}>
```
<!-- END GENERATED: command:commands-list -->

### `re-shell doctor --json`

Project diagnostics. Check `status` is `success` / `warning` / `error` (a third
vocabulary, distinct from the workspace health checks); `suggestion` is present when
a check did not pass. `--explain` adds a `suggestions` array; `--fix` replaces the
payload with `{ plan, suggestions }` (`doctorFixWireSchema`, a dry-run plan unless
`--yes`). `doctor` runs `npm audit` / `npm outdated`, so inside a real workspace it
is slow and needs the network; the generator runs it in an empty directory.

<!-- BEGIN GENERATED: command:doctor -->
- **Invocation:** `re-shell doctor --json`
- **Wire schema:** `doctorWireSchema` (`@re-shell/contracts`); domain / UI model: none
- **Error codes:** `DOCTOR_ERROR` *(reserved)*

`data` shape:

```ts
{
  checks: Array<{
    name: string;
    status: 'success' | 'warning' | 'error';
    message: string;
    suggestion?: string;
  }>;
  suggestions?: Array<{
    checkId: string;
    cause: string;
    suggestion: string;
    fixable: boolean;
    fixCommand?: string;
  }>;
}
```
<!-- END GENERATED: command:doctor -->

### `re-shell analyze --json`

Bundle, dependency, performance and security analysis (`--type bundle |
dependencies | performance | security | all`, default `all`). `analysis` is keyed by
workspace path and each value holds the blocks the requested type produced. **Slow
by default**: `all` / `dependencies` / `security` shell out to `npm outdated` and
`npm audit` and `performance` may run the workspace build, so the generator runs
`analyze --type bundle` (offline); the other blocks are pinned by the contracts
unit tests, against real captured output. `security.audit` is the raw
`npm audit --json` document and is opaque to the contract.

<!-- BEGIN GENERATED: command:analyze -->
- **Invocation:** `re-shell analyze --type bundle --json`
- **Wire schema:** `analyzeWireSchema` (`@re-shell/contracts`); domain / UI model: none
- **Error codes:** `NOT_IN_MONOREPO`, `ANALYZE_ERROR`

`data` shape:

```ts
{
  timestamp: string;
  monorepo: string;
  workspaces: number;
  analysis: Record<string, {
    bundle?: {
      workspace: string;
      size: {
        total: string;
        gzipped: string;
        assets: Array<{
          name: string;
          size: string;
          rawBytes: number;
          type: string;
        }>;
      };
      chunks: Array<{
        name: string;
        size: string;
        modules: number;
      }>;
      treeshaking: {
        unusedExports: string[];
        deadCode: number;
      };
    };
    dependencies?: {
      workspace: string;
      total: number;
      production: number;
      development: number;
      outdated: Array<{
        name: string;
        current: string;
        wanted: string;
        latest: string;
      }>;
      duplicates: Array<{
        name: string;
        versions: string[];
        locations: string[];
      }>;
      vulnerabilities: Array<{
        severity: string;
        count: number;
      }>;
      licenses: Array<{
        license: string;
        packages: string[];
      }>;
    };
    performance?: {
      workspace: string;
      buildTime: number;
      bundleSize: string;
      loadTime: {
        ttfb: number;
        fcp: number;
        lcp: number;
      };
      suggestions: string[];
    };
    security?: {
      workspace: string;
      audit: Record<string, unknown>;
      sensitiveFiles: string[];
      secretPatterns: string[];
      recommendations: string[];
    };
  }>;
}
```
<!-- END GENERATED: command:analyze -->

### `re-shell list --json`

Microfrontends discovered in the project's `apps/` directory. Only `name` and
`path` (absolute) are guaranteed; `team` is whatever the package.json `author`
field holds. **Quirk:** a project whose `apps/` folder contains no microfrontends
emits a bare empty array (with a warning) instead of `{ "microfrontends": [] }`;
both are part of the contract.

<!-- BEGIN GENERATED: command:list -->
- **Invocation:** `re-shell list --json`
- **Wire schema:** `microfrontendListWireSchema` (`@re-shell/contracts`); domain / UI model: none
- **Error codes:** `NOT_IN_RESHELL_PROJECT`, `APPS_DIR_NOT_FOUND`, `LIST_MICROFRONTENDS_ERROR`

`data` shape:

```ts
{
  microfrontends: Array<{
    name: string;
    path: string;
    version?: string;
    team?: unknown;
    route?: string;
  }>;
} | []
```

Real output for the generator's fixture workspace (`demo-monorepo`; one line on the wire, pretty-printed here):

```json
{
  "ok": true,
  "data": {
    "microfrontends": [
      {
        "name": "admin",
        "path": "/path/to/demo-monorepo/apps/admin",
        "version": "0.4.0",
        "route": "/admin"
      },
      {
        "name": "web",
        "path": "/path/to/demo-monorepo/apps/web",
        "version": "1.2.0",
        "route": "/web"
      }
    ]
  },
  "warnings": []
}
```

Error path, real output of `re-shell list --json` outside any workspace (exit code 1):

```json
{
  "ok": false,
  "error": {
    "code": "NOT_IN_RESHELL_PROJECT",
    "message": "Not in a Re-Shell project. Please run this command from the root of a Re-Shell project."
  },
  "warnings": []
}
```
<!-- END GENERATED: command:list -->

---

## Conformance

Two executable counterparts keep this document honest:

- `packages/cli/tests/contract-conformance.test.ts` spawns the built CLI for every
  command above, asserts stdout is exactly one `JSON.parse`-able line (read through
  a pipe), validates the payload against `jsonResponseSchema(<wire schema>)` from
  `@re-shell/contracts`, fails on any key the CLI prints that the schema does not
  declare, and asserts that this file matches what the generator produces.
- `packages/contracts/src/wire.test.ts` pins every wire schema with valid and
  malformed fixtures; `packages/mcp` and `apps/web` consume the same schemas.

```bash
pnpm --filter @re-shell/cli run build
cd packages/cli && npx vitest run tests/contract-conformance.test.ts
```
