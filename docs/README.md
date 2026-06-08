# Re-Shell Docs

This is the documentation index for the **single pnpm monorepo** at `re-shell-cli`. The
workspace holds four packages on the `@re-shell/*` scope:

| Package | Name | Role |
|---------|------|------|
| `packages/cli` | `re-shell-cli` | The published CLI / engine + `re-shell ui` launcher. |
| `packages/ui` | `re-shell-ui` | shadcn-React component library (the single UI system). |
| `packages/contracts` | `re-shell-contracts` | Authoritative TS + zod contract shapes shared by CLI and UI. |
| `apps/web` | `re-shell-dashboard` | Dashboard app + token-authed hub-server (SSE `/events`, WS `/jobs`). |

> The Web Components layer has been **retired**; shadcn-React in `packages/ui` is the one UI system.

## Documentation information architecture

### Canonical docs (start here)

| Doc | What it is |
|-----|------------|
| [`RE_SHELL_ULTIMATE_PLAN.md`](./RE_SHELL_ULTIMATE_PLAN.md) | **The canonical implementation plan.** Authoritative; supersedes the master-plan draft and the scattered legacy plans. |
| [`RE_SHELL_MASTER_PLAN.md`](./RE_SHELL_MASTER_PLAN.md) | **Historical audit record** (the earlier DRAFT). Documents the original three-repo reality and the document-disposition decisions. Implemented through Phase 8; kept for provenance. |
| [`CLI-CONTRACTS.md`](./CLI-CONTRACTS.md) | The CLI↔UI JSON contract: response envelope, error-code vocabulary, per-command `--json` shapes, and the SSE `/events` + WS `/jobs` hub transport. Regenerated from real CLI output in Wave 2 and conformance-tested. Source of truth: `re-shell-contracts`. |
| hub-server / security | The token-authed transport that fronts the CLI for the dashboard (`apps/web/src/hub-server.ts`): SSE `/events`, WS `/jobs`, 127.0.0.1 bind, session token, no arbitrary shell. Documented in [`CLI-CONTRACTS.md`](./CLI-CONTRACTS.md) (transport + error vocabulary). |
| [`superpowers/specs/2026-05-29-re-shell-ui-web-components-design.md`](./superpowers/specs/2026-05-29-re-shell-ui-web-components-design.md) | The UI design spec (component system, tokens, layout primitives). |

### Per-package docs

Per-package `README.md` files are **thin pointers** back to `/docs` plus package-specific
install/usage notes — they should not duplicate the canonical plan or contract.

| File | Scope |
|------|-------|
| `packages/cli/README.md` | CLI install / quick-start; points to `/docs`. |
| `packages/ui/README.md` | `re-shell-ui` exports / usage; points to `/docs`. |
| `packages/contracts/README.md` | `re-shell-contracts`; points to `CLI-CONTRACTS.md`. |
| `apps/web/README.md` | `re-shell-dashboard` dashboard; points to `/docs`. |

### CLI usage examples (accurate, kept)

These live under `packages/cli` and are accurate usage references:

- [`packages/cli/EXAMPLES.md`](../packages/cli/EXAMPLES.md) — top-level examples index.
- `packages/cli/examples/*.md` — workflow guides:
  - `core-workflows.md`
  - `workspace-and-config.md`
  - `scaffolding-api-and-generation.md`
  - `services-tools-and-quality.md`
  - `plugins-and-data.md`
  - `cloud-k8s-and-observability.md`
  - `security-collaboration-and-learning.md`
- `packages/cli/tests/README.md` — test-suite reference.
- `packages/cli/CHANGELOG.md` — release history.

### Legacy / archived

[`legacy/`](./legacy/) holds material salvaged from the archived `re-shell` umbrella and the
pre-rewrite contract:

- [`legacy/CLI-CONTRACTS.old.md`](./legacy/CLI-CONTRACTS.old.md) — the pre-Wave-2 contract, kept for history.
- [`legacy/migration-map.md`](./legacy/migration-map.md) — command/migration mapping.
- [`legacy/salvage-refs/`](./legacy/salvage-refs/) — salvaged source references (service bridge, gRPC/REST adapters, type mapping, etc.) for post-MVP roadmap work.

## Conventions

- The **canonical plan** is `RE_SHELL_ULTIMATE_PLAN.md`. When plans conflict, it wins.
- `re-shell-contracts` is the **single source of truth** for CLI↔UI shapes; `CLI-CONTRACTS.md` documents it and is conformance-tested.
- `AGENTS.md` and `.agents/` are agent-context auto-dumps and are **gitignored** — never tracked.
