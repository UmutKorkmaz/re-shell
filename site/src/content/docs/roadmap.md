---
title: "Roadmap"
description: "Re-Shell delivery status — what's shipped, what's scaffolded, what's planned, and what's explicitly out of scope."
---

This is the single forward-looking roadmap for the Re-Shell monorepo
(`@re-shell/cli` + `@re-shell/ui` + `@re-shell/contracts` + the dashboard app).
It records honest delivery status, not aspiration — every "done" item is shipped
in the current CLI (`0.29.2`) and backed by tests.

## Status legend

| Status | Meaning |
| --- | --- |
| **MVP-done** | Shipped in the current monorepo. |
| **DONE+tested** | Implemented **and** verified by unit/integration tests. |
| **SCAFFOLD/SPEC** | Code structure + types present, but live-environment requirements (network, running cluster, LLM backend, Rust toolchain) make it env-limited; unit tests pass with controlled doubles. |
| **post-MVP-planned** | A real, scoped intention carried forward. |
| **DROPPED** | Explicitly removed from scope (speculative / mission-divergent). |

## CLI platform — shipped (MVP-done)

- **Configuration** — global config (`~/.re-shell/config.yaml`) and project config
  (`.re-shell/config.yaml`) with inheritance, cascading, templating, diff/merge,
  backup/restore, hot-reload, and schema validation.
- **Workspaces** — declarative `re-shell.workspaces.yaml`, dependency-graph engine
  with cycle detection, topology health, state persistence, and change-impact
  analysis with content-hash file watching.
- **Plugins** — registration/discovery, lifecycle, hooks API, dependency
  resolution, sandboxing, and the command-extension system.
- **Performance** — sub-100ms startup (≈43ms achieved), lazy loading, tree
  shaking, and a startup cache.
- **Templates** — a large, shipped backend/frontend registry (Node, Python, Rust,
  Java, .NET, PHP, Go, Ruby, and emerging languages), Docker/orchestration
  output, API-contract management, and database integration.
- **Health & analysis** — `doctor`, `analyze`, and `completion` wired and
  reachable; command-group architecture (`config` / `tools` / `workspace` /
  `templates` / …).

## Phase 9 — post-MVP feature status

Status as of Wave 9d. Each row states what was verified.

| Feature | Status |
| --- | --- |
| **AI / NLP offline command interface** (`re-shell ai <prompt>`) | DONE+tested — offline intent parser resolves prompts to catalog-vetted argv with confidence scores; never auto-executes; spawns without a shell. |
| **Cross-language service bridge** (`service bridge generate`) | DONE+tested — typed gRPC/REST/GraphQL client scaffolds, validated against installed `tsc`. Async transport (Kafka/Redis Streams, circuit breakers, tracing) is SCAFFOLD. |
| **workspace.yaml v2 + JSON Schema + IDE autocomplete** | DONE+tested — canonical schema, AJV validation, VSCode/IntelliJ/Vim/Emacs config generation. Live `$schema` TLS resolution is SCAFFOLD. |
| **K8s / Helm / GitOps generation** (`k8s generate`, `k8s helm generate`, `k8s gitops generate`) | DONE+tested — Deployment/Service/HPA/NetworkPolicy, Helm charts, and ArgoCD/Flux manifests; `--out` + `--dry-run`. Live cluster apply not run in CI. |
| **Nx / Turbo monorepo importer** (`workspace migrate`) | DONE+tested — reads Nx and Turborepo configs, emits `re-shell.workspaces.yaml` v2. |
| **Plugin marketplace / registry** | DONE+tested (CI-mocked) — real installer (npm/git/local) + registry client against the npm registry; live-network install is best-effort. |
| **Policy packs + dependency drift** (`workspace policy check`, `workspace drift`) | DONE+tested — declarative zod-validated policy packs (`recommended`, `baseline`) + cross-workspace version-mismatch detection. |
| **Template compatibility matrix + dry-run visual diff** (`templates matrix`, `create --dry-run`) | DONE+tested — full compat grid from the registry; throwaway-dir scaffold preview with per-file diff. |
| **VS Code extension bridge** (`@re-shell/vscode`) | DONE+tested (compiled + unit) — pure core layer tested without the host; VS Code host launch is SCAFFOLD. |
| **Hosted control plane** (`@re-shell/control-plane`) | SCAFFOLD/SPEC — typed tenant model, token auth, RBAC, allow-listed proxy as pure in-memory logic; no running server/DB/deploy. |
| **Desktop / Tauri packaging** | SCAFFOLD/SPEC — `src-tauri/` config + scaffold exist and the dashboard compiles; no signed binary produced. |

## UI / dashboard — shipped (MVP-done)

- A single shadcn-React component system in `@re-shell/ui` (the Web Components
  layer was retired).
- `@re-shell/contracts` as the authoritative shared contract for CLI and UI.
- The dashboard app + token-authed [hub server](/re-shell/architecture/secure-hub/):
  SSE `/events`, WS `/jobs`, `127.0.0.1` bind.
- The `re-shell ui` launcher, design-system tokens, and theming.

Planned: WCAG 2.1 AA across all components, component performance budgets,
component dev tooling (playground/codegen), and enterprise theming.

## Post-MVP-planned

- Expand emerging-language coverage (Deno, Bun, Kotlin, Scala, Crystal, Zig,
  Elixir, Nim) to parity.
- Interactive terminal graph explorer scaling to thousands of nodes.
- Optional, provider-abstracted LLM-assisted command translation / architecture
  analysis (no always-on telemetry, no mandatory cloud).
- Unified package-manager abstraction and cross-language debugging/refactoring.
- Multi-cloud deployment targets and compliance reporting.

## Explicitly DROPPED (out of scope)

Recorded so the decision is explicit and not silently re-introduced:

- **Quantum computing integration** — DROPPED.
- **Blockchain / Web3** (smart-contract templates, dApp workflows) — DROPPED.
- **VR/AR / immersive development environments** — DROPPED.
- **Voice/neural "natural-language-as-primary-interface"** as a core pillar —
  DROPPED. (A narrow, optional, provider-abstracted AI assist remains — see
  [`ai`](/re-shell/cli/ai/).)

These are speculative and mission-divergent; they would dilute the platform's
actual value: a polyglot workspace + microfrontend toolkit with a typed CLI ↔ UI
[contract](/re-shell/contract/json-contract/).
