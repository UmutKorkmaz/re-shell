# Re-Shell Roadmap

> Consolidated from the legacy `re-shell` umbrella repo's planning artifacts
> (`CLI_IMPLEMENTATION_TODO.md`, `UI_IMPLEMENTATION_TODO.md`, `CLI_FUTURE_PLANS.txt`)
> during the W8 archive/salvage of that repo. This is the single forward-looking
> roadmap for the **`re-shell-cli` monorepo** (`packages/cli` + `packages/ui` +
> `packages/contracts` + `apps/web`). The legacy umbrella is archived read-only;
> see [`legacy/`](./legacy/) for the salvaged design references.

## Status legend

- **MVP-done** — shipped in the current monorepo (CLI is at `0.28.0`).
- **DONE+tested** — Phase 9 feature implemented AND verified by unit/integration tests in this wave.
- **SCAFFOLD/SPEC** — code structure and types are present, but live-environment requirements (network, running cluster, LLM backend, Rust toolchain) make the feature env-limited; unit tests pass with controlled doubles.
- **post-MVP-planned** — carried forward as a real, scoped intention.
- **DROPPED** — explicitly removed from scope (speculative / out of mission).

---

## 1. CLI platform

### Foundation & core infrastructure

| Feature | Status |
|---------|--------|
| Global config (`~/.re-shell/config.yaml`) + schema validation, presets, env overrides, migration | MVP-done |
| Project config (`.re-shell/config.yaml`) with inheritance, cascading, templating, diff/merge, backup/restore, hot-reload | MVP-done |
| Declarative `re-shell.workspaces.yaml` schema, dependency graph engine, cycle detection, topology health | MVP-done |
| Workspace state persistence/caching, backup/restore, migration, conflict detection | MVP-done |
| File watching + content-hash change detection, change-impact analysis, incremental rebuild, debouncing, cross-platform fallbacks | MVP-done |
| Plugin architecture: registration/discovery, lifecycle, hooks API, dependency resolution, sandboxing, marketplace foundation | MVP-done |
| Command extension system: plugin command registration, middleware, conflict resolution, auto-docs, caching | MVP-done |
| Startup optimization (<100ms; ~43ms achieved), lazy loading, tree shaking, startup cache, regression tests | MVP-done |
| Resource management: cleanup/leak prevention, memory monitoring, concurrency + rate limiting, priority queue | MVP-done |
| Group command architecture (`config` / `tools` / `workspace` / `templates` groups) | MVP-done |
| `doctor`, `analyze`, `completion` commands wired and reachable | MVP-done |

### Universal microservices / backend templates

| Feature | Status |
|---------|--------|
| Backend framework template registry (Node, Python, Rust, Java, .NET, PHP, Go, Ruby, emerging langs) — large shipped catalog | MVP-done |
| Docker / service orchestration generation, compose output | MVP-done |
| API contract management (OpenAPI/GraphQL), type-safe client generation scaffolds | MVP-done |
| Database integration templates + migration support | MVP-done |
| Full-stack feature creation across frameworks (`create-feature`) | MVP-done |
| Expand emerging-language coverage (Deno, Bun, Kotlin, Scala, Crystal, Zig, Elixir, Nim) to parity | post-MVP-planned |
| Cross-language service bridge (gRPC/REST/GraphQL federation, polyglot client gen) — salvaged refs in `legacy/salvage-refs/` | post-MVP-planned |

### Workspace graph intelligence

| Feature | Status |
|---------|--------|
| Workspace graph generation + `workspace graph --json` topology shape | MVP-done |
| Workspace health (`workspace health --json`) with scored checks | MVP-done |
| Multi-environment profiles (`profile`, `profile-env`, `profile-sync`, `profile-version`) | MVP-done |
| Interactive terminal graph explorer scaling to thousands of nodes (pan/zoom, real-time) | post-MVP-planned |
| Profile optimization recommendations from usage patterns (heuristic, non-speculative) | post-MVP-planned |

### AI-assisted development

| Feature | Status |
|---------|--------|
| Optional LLM-assisted command translation / code generation behind a provider abstraction | post-MVP-planned |
| Architecture analysis (security/performance/scalability heuristics) | post-MVP-planned |

> Scope discipline: AI assistance is an **optional, provider-abstracted** layer, not a
> rewrite of the CLI. No always-on telemetry, no mandatory cloud dependency.

### Polyglot integration

| Feature | Status |
|---------|--------|
| Universal cross-language service communication protocols | post-MVP-planned |
| Unified package-manager abstraction (npm/pip/cargo/maven/nuget/composer/gem) | post-MVP-planned |
| Cross-language debugging / refactoring | post-MVP-planned |

### Enterprise platform

| Feature | Status |
|---------|--------|
| Kubernetes manifest generation + GitOps integration | post-MVP-planned |
| Multi-cloud deployment targets (AWS/Azure/GCP) | post-MVP-planned |
| Compliance reporting (audit trails) | post-MVP-planned |
| Real-time WebRTC pair-programming / live collaboration | post-MVP-planned |

---

## 2. UI / dashboard

| Feature | Status |
|---------|--------|
| Single shadcn-React component system in `packages/ui` (Web Components layer retired) | MVP-done |
| `@umutkorkmaz/contracts` authoritative TS + zod contract shapes shared by CLI and UI | MVP-done |
| Dashboard app (`apps/web`) + token-authed hub-server: SSE `/events`, WS `/jobs`, 127.0.0.1 bind | MVP-done |
| `re-shell ui` launcher | MVP-done |
| Advanced type system (polymorphic `as` props, discriminated variants, branded CSS units) | MVP-done |
| Design-system tokens + theming | MVP-done |
| Accessibility excellence (WCAG 2.1 AA across components, keyboard, screen-reader, focus mgmt) | post-MVP-planned |
| Performance budgets + bundle optimization for the component library | post-MVP-planned |
| Component dev tooling (docs site, playground, codegen) | post-MVP-planned |
| Enterprise UI features (theming marketplace, white-label) | post-MVP-planned |
| AI-assisted UI generation | post-MVP-planned |

---

## 3. Phase 9 — Post-MVP Feature Status

This section records the honest delivery status for every Phase 9 feature (P9-A through P9-K) as of Wave 9d (2026-06-08). Each row states what was verified and HOW it was verified.

| ID | Feature | Status | Verified HOW |
|----|---------|--------|-------------|
| **P9-A** | **AI/NLP Offline Command Interface** | **DONE+tested** | `ai.group.ts` registers `re-shell ai <prompt...>` with `--json/--run/--explain`. Offline intent parser (`ai-intent.ts`) resolves prompts to catalog-vetted argv with confidence scores; `needsClarification:true` on no-match. Smoke: `ai "list templates as json" --json` returns resolved spec; `ai "do something vague" --json` returns `needsClarification:true`. Unit tests: 17 tests in `tests/unit/ai-intent.test.ts` (all green). Safety: spawns `re-shell` without `shell:true`; never auto-executes. LLM backend: NOT wired (offline-only; pluggable model abstraction is post-MVP). |
| **P9-B** | **Cross-Language Service Bridge (gRPC/REST/GraphQL)** | **DONE+tested** | `service bridge generate` command registered in `service.group.ts`; `bridge-generate.ts` produces typed client scaffolds for gRPC, REST, GraphQL; `typeCheckTsClient()` validates generated TS against installed tsc. Unit tests: 20 tests in `tests/unit/bridge-generate.test.ts` (all green). Async transport (Kafka/Redis Streams, circuit breakers, distributed tracing) and cross-language mock servers are SCAFFOLD — types and stubs exist; no live broker/cluster in CI. |
| **P9-C** | **workspace.yaml v2 + JSON Schema + IDE Autocomplete** | **DONE+tested** | `workspace-v2.schema.json` is the canonical schema; `schema-generator.ts` publishes it with VSCode/IntelliJ/Vim/Emacs config generation. `config schema validate` enforces v2 via AJV. `workspace migrate` (Nx/Turbo importer, P9-E below). JSON Schema `$id` targets `schemas.umutkorkmaz.dev` (owned origin). Unit tests: 10 tests in `tests/unit/schema-generator.test.ts` (all green); integration: `tests/integration/schema-validate.test.ts` (2 tests). IDE resolution of `$schema`: SCAFFOLD/SPEC (requires a running TLS server at the $id origin; not deployed). |
| **P9-D** | **K8s/Helm/GitOps Generation** | **DONE+tested** | `k8s generate` produces Deployment, Service, HPA, NetworkPolicy manifests from workspace v2 config. `k8s helm generate` produces a Helm chart. `k8s gitops generate --tool argocd|flux` produces ArgoCD Application or Flux GitRepository+Kustomization manifests. All three write files to `--out <dir>` with `--dry-run` support. Unit tests: 13 tests `k8s-generate.test.ts`; 13 tests `helm-generate.test.ts`; 11 tests `gitops-generate.test.ts` (all green). Live `kubectl apply` / `helm lint` / kind-cluster deploy: NOT RUN (no live cluster in CI; manifests are syntactically valid YAML). |
| **P9-E** | **Nx/Turbo Monorepo Importer** | **DONE+tested** | `workspace migrate` / `workspace migrate-monorepo` reads Nx (`nx.json` + `project.json`) and Turborepo (`turbo.json` + workspace globs) and emits `re-shell.workspaces.yaml` v2. Unit tests: 7 tests `tests/unit/migrate-monorepo.test.ts`; integration: 3 tests `tests/integration/migrate-monorepo.test.ts` (all green using fixture workspaces). |
| **P9-F** | **Plugin Marketplace / Registry** | **DONE+tested (CI-mocked) / SCAFFOLD/SPEC (live-network)** | `plugin-installer.ts` (`installPluginFromIdentifier`) is a REAL installer: classifies source as npm/git/local, resolves and validates manifest, registers in `.re-shell/plugins/registry.json` — NO `setTimeout` simulation. `PluginMarketplace` / `RegistryClient` connect to the real npm registry (keyword `reshell-plugin`) with injected-fetch for testability. `verifyRegistrySignature` is implemented against the npm key API. Unit tests: 17 tests `plugin-install.test.ts`; 17 tests `plugin-marketplace.test.ts` — all CI-mocked (no live network in CI). Signature verification config (`verifySignatures: true`) is no longer hardcoded. Live-network install against a published npm package: BEST-EFFORT (requires network; not asserted in CI). |
| **P9-G** | **Policy Packs + Dependency Drift** | **DONE+tested** | `policy-engine.ts` evaluates declarative policy packs (zod-validated rules: `required-scripts`, `no-dependency-drift`, `no-circular-deps`, `license-conformance`); built-in `recommended` and `baseline` packs. `workspace policy check` command. `dependency-drift.ts` scans all workspace `package.json` files and reports version mismatches. Unit tests: 13 tests `tests/unit/workspace-policy.test.ts` with compliant + violating fixture workspaces. Readiness score is derived deterministically. Policy distribution via marketplace: SCAFFOLD (depends on live P9-F network path). |
| **P9-H** | **Template Compatibility Matrix + Dry-Run Visual Diff** | **DONE+tested** | `template-matrix.ts` builds a full compat grid from the ~219-template registry (languages, frameworks, databases, caches, deploy targets, features). `templates matrix` command with `--json` emits the grid. `computeBackendDryRun()` in `template-dry-run.ts` renders a scaffold to a throwaway tmp dir and returns the file set + per-file preview without touching the workspace. `create --dry-run` flag in the top-level command. Unit tests: 4 tests `template-matrix.test.ts`; 6 tests `template-dry-run.test.ts`; integration: 4 tests `template-matrix-dryrun.test.ts` (all green). |
| **P9-I** | **VS Code Extension Bridge** | **DONE+tested (compiled + unit) / SCAFFOLD/SPEC (VS Code host launch)** | `apps/vscode-extension` is a full TypeScript package (`@umutkorkmaz/vscode-re-shell@0.1.0`). Pure core layer (`src/core/`) implements catalog parsing, command building, hub request shaping, and allow-list gating — all tested without the VS Code host. `extension.ts` wires the tree view + command palette. Compiles to `dist/extension.js` (551 kB bundle via esbuild). Unit tests: 28 tests across `command-builder.test.ts`, `hub-client.test.ts`, `catalog.test.ts` (all green). VS Code host launch (`@vscode/test-electron`) is NOT RUN — it downloads VS Code binaries, which is blocked in this env. |
| **P9-J** | **Hosted Control Plane** | **SCAFFOLD/SPEC (env-limited)** | `packages/control-plane` (`@umutkorkmaz/control-plane`) provides typed tenant/workspace model, token/session auth, RBAC authz checks, and allow-listed command proxy handlers — all pure in-memory logic. Unit tests: 42 tests across `errors.test.ts`, `auth.test.ts`, `tenant.test.ts`, `authz.test.ts`, `api.test.ts` (all green). NOT a running server (no HTTP router); NOT backed by a database; NOT deployed. Multi-user/team dashboard + remote agent deploy requires a production hosting environment. |
| **P9-K** | **Desktop / Tauri Packaging** | **SCAFFOLD/SPEC (env-limited)** | `apps/web` includes `src-tauri/` with `tauri.conf.json`, `Cargo.toml`, icons, and capabilities config. `pnpm tauri:build` is wired in `apps/web/package.json`. Rust toolchain (`cargo 1.94.1`) IS present on this machine. Tauri CLI is NOT installed globally (`tauri: NOT FOUND`); `tauri:build` is NOT run in CI. The Tauri build/sign/notarize pipeline requires platform-specific code-signing credentials and a Tauri CLI install. Status: Tauri config + src-tauri scaffold exists, React dashboard compiles, but no desktop binary was produced or verified. |

### Phase 9 summary

| Status | Features |
|--------|---------|
| DONE+tested | P9-A (ai-offline), P9-B (bridge-generation), P9-C (schema-v2+importer), P9-D (k8s/helm/gitops GENERATION), P9-E (nx/turbo importer), P9-G (policy+drift), P9-H (matrix+dry-run-diff) |
| DONE+tested (CI-mocked) / SCAFFOLD (live-network) | P9-F (plugin marketplace: real installer + mocked-network tests; live npm install is best-effort) |
| DONE+tested (compiled+unit) / SCAFFOLD (host launch) | P9-I (vscode-extension: pure core tested; VS Code host launch blocked) |
| SCAFFOLD/SPEC (env-limited) | P9-J (control-plane: pure logic tested; no live server/DB/deploy), P9-K (tauri: config+scaffold exists; no binary produced) |

---

## 4. Explicitly DROPPED (out of scope)

These appeared in the legacy "Future Vision / Next-Generation" sections and are
**not** part of the Re-Shell roadmap. They are recorded here only so the decision
is explicit and not silently re-introduced.

- **Quantum computing integration** (quantum algorithm templates, hybrid classical-quantum orchestration, quantum-safe crypto layer). DROPPED.
- **Blockchain / Web3** (smart-contract templates, dApp workflows, cross-chain interop). DROPPED.
- **VR/AR / immersive development environments** (spatial code organization, 3D architecture visualization, gesture coding). DROPPED.
- **Neural / "natural-language-as-primary-interface" / voice-command coding** as a core platform pillar. DROPPED (a narrow, optional, provider-abstracted AI assist remains — see §1 and P9-A).

Rationale: these are speculative, mission-divergent, and would dilute the CLI's
actual value proposition (polyglot workspace + microfrontend tooling with a typed
CLI↔UI contract).

---

## 5. New packages and commands added in Wave 9d

### New workspace packages

| Package | Location | Role |
|---------|----------|------|
| `@umutkorkmaz/vscode-re-shell` | `apps/vscode-extension` | VS Code extension (P9-I): tree view + command palette wired to the local hub via typed pure core layer. Compiles to `dist/extension.js`. |
| `@umutkorkmaz/control-plane` | `packages/control-plane` | Control-plane scaffold (P9-J): typed tenant model, token auth, RBAC authz, allow-listed command proxy — pure in-memory, no server. |

### Key new CLI commands (Wave 9d additions)

| Command | Group | Feature |
|---------|-------|---------|
| `ai <prompt...>` | top-level | P9-A: offline NL→command resolver |
| `k8s generate` | k8s | P9-D: K8s manifests from workspace v2 |
| `k8s helm generate` | k8s | P9-D: Helm chart generation |
| `k8s gitops generate` | k8s | P9-D: ArgoCD/Flux GitOps manifests |
| `templates list` | templates | P9-C/H: list registered templates |
| `templates matrix` | templates | P9-H: full compat matrix |
| `workspace migrate` | workspace | P9-E: Nx/Turbo → re-shell.workspaces.yaml |
| `workspace drift` | workspace | P9-G: dependency drift detection |
| `workspace policy check` | workspace | P9-G: policy pack evaluation |
| `service bridge generate` | service | P9-B: cross-language client scaffold |
| `commands list` | commands | catalog introspection (543 total commands) |

Total registered commands at CLI v0.28.0: **543**.
