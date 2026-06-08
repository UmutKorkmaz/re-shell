# Re-Shell Master Plan (HISTORICAL — superseded by the Ultimate Plan)

> **Status: implemented through Phase 8.** The four binding decisions in §2 were made by the
> owner and executed; the repos described in §0 have since been consolidated into the **single
> pnpm monorepo** at `re-shell-cli` (`packages/cli` + `packages/ui` + `packages/contracts` +
> `apps/web`), all on the `@re-shell/*` scope. This file is kept as the **historical audit
> record** of the original three-repo reality and the disposition decisions.
>
> **Canonical plan:** see [`docs/RE_SHELL_ULTIMATE_PLAN.md`](./RE_SHELL_ULTIMATE_PLAN.md),
> which supersedes this draft and folds in the adversarial-verification corrections. For the
> current docs map, see [`docs/README.md`](./README.md).
>
> Original provenance: produced 2026-06-04 from a 17-agent parallel audit of the then-separate
> `re-shell-cli`, `re-shell-ui`, and legacy `re-shell` repos.

---

## 0. Topology — RESOLVED: one pnpm monorepo

> **This section is now history.** Decision 3 (single pnpm monorepo) and Decision 2
> (`@re-shell/*` everywhere) have been executed. The three separate repos have been
> consolidated into the **single pnpm workspace** rooted at `re-shell-cli`.

### Current (post-consolidation) topology

| Workspace package | Name | Role |
|-------------------|------|------|
| `packages/cli` | `re-shell-cli` | The published CLI / engine. Group architecture, backend template registry, `re-shell ui` launcher. |
| `packages/ui` | `re-shell-ui` | shadcn-React component library (primitives + domain components), the single UI system. |
| `packages/contracts` | `re-shell-contracts` | Authoritative TS + zod contract shapes shared by CLI and UI. |
| `apps/web` | `re-shell-dashboard` | The dashboard app + token-authed hub-server (SSE `/events`, WS `/jobs`). |

Key facts after consolidation:
- There is **one repo, one pnpm workspace, one `@re-shell/*` scope** — no submodules, no divergent CLI fork, no separate UI repo.
- The legacy `re-shell` umbrella is **archived read-only** after salvage (see §7/§8); the salvaged contract + service-bridge references live under [`docs/legacy/`](./legacy/).
- The Web Components layer has been **retired** in favour of the single shadcn-React system (Decision 1).

### Original three-repo reality (historical, pre-consolidation)

| Repo | Package | Version | Branch | Role |
|------|---------|---------|--------|------|
| `re-shell-cli` | `re-shell-cli` | 0.28.0 | `the working branch` (+ uncommitted) | The real, published CLI / engine. ~67 command files, group architecture. |
| `re-shell-ui` | `re-shell-ui` (pnpm ws) | 0.1.0 | `the UI working branch` | Standalone dashboard + `@re-shell/ui` + `@re-shell/contracts`. **No git remote.** |
| `re-shell` | `re-shell-monorepo` | 0.2.2 | `the legacy working branch` (+ uncommitted) | Legacy umbrella. `packages/cli` was a *submodule* of re-shell-cli (single-sourced, not a fork). Broken build. Now archived. |

These three were merged into the single workspace above; the table is retained only to explain
where the consolidated code and salvaged references came from.

---

## 1. Verified current state (reality, not the docs' claims)

The execution plan's "what is implemented" sections and `CLI-CONTRACTS.md` are **materially
overstated**. The plan below starts from what the audit *empirically verified*.

### 1.1 The CLI↔UI contract is broken at every layer (3-way drift)

There are **three disagreeing definitions** of almost every shape:
1. **CLI runtime output** — `{ok,data,warnings}` envelope (json-output.ts).
2. **CLI docs** — `docs/CLI-CONTRACTS.md` (aspirational, wrong shapes + wrong error codes).
3. **UI contracts** — `@re-shell/contracts` (what the UI components actually expect).

Concrete breakages (CRITICAL unless noted):
- **`WorkspaceSummary`** (the UI's central type) has **no CLI producer**. `re-shell workspace --json` has no action → prints help. `WorkspaceSummaryPanel` has no data source.
- **`re-shell templates list --json`** — command **not registered at all**; `manageTemplates` is dead-wired. Templates panel cannot load.
- **`workspace graph --json`** — wrong flag (only `--format json` exists); and it emits `{nodes,edges}` while topology expects `{apps,services}` → topology permanently empty.
- **`workspace health --json`** — wired to the lightweight `checkWorkspaceHealth` (`{checks:[{name,status:'healthy'|'warning'|'critical'}],overall}`), **not** the rich `manageWorkspaceHealth` that matches the docs. UI expects `{score,status:'pass'|'warn'|'fail',checks:[{id,title,level,message}]}`. None of the three agree.
- **`doctor --json`** — fully implemented in `doctor.ts` but **not registered** in `index.ts` → unreachable. Same for `analyze`, `completion`.
- **Envelope + SSE double-wrap (CRITICAL):** the hub forwards each raw stdout line as `{type:'stdout',content:line}`; UI components do `JSON.parse(event.data)` expecting a bare domain object — they never read `.content`, never read `.data`. Pretty-printed multi-line JSON fragments across SSE events and never reparses. **Even with perfect shapes the parse chain fails.**
- **Terminal WS mismatch:** terminal component consumes legacy `{type:'output',output}` while hub/contracts emit `{type:'stdout',content}` → live output never renders.
- **Only `list --json` works cleanly.** `workspace list --json` works but **leaks spinner text** before the JSON.

### 1.2 Two parallel UI systems (violates the plan's own rule)

- **shadcn React layer** (`components/ui/*` + `components/re-shell/*`: Button, Card, CommandPreview, HealthStatus, JobLogPanel, …) — well-formed (cva, Radix, `cn()`, lucide), but **NOT exported** from `@re-shell/ui`, **NOT consumed** by `apps/web`, and its tests **can't run** (vitest@4 vs vite@5 incompatibility). Effectively dead code — yet it's the plan's headline deliverable.
- **Web Components layer** (`re-shell-layout/sidebar/tabs/health/topology/terminal`) — what actually ships and what `apps/web` renders. Undocumented in the plan, stub-heavy (`atomic/*` are labelled "will be implemented").
- The package **build emits no `.d.ts` and no CSS** despite declaring a `./styles.css` export; `src/hub/index.ts` is a `console.warn` **stub that shadows** the real `SseClient`/`WsClient`.

### 1.3 Security (CRITICAL)

`apps/web/src/hub-server.ts` executes **browser-supplied command + args with `shell:true`** via SSE query params and WS messages, with **no token auth** and **CORS `*`**. This is arbitrary RCE on localhost — the **exact opposite** of the plan's headline safety model (§9/§15: 127.0.0.1 bind, session token, typed allow-listed adapters, no arbitrary shell). `re-shell ui` prints no auth token.

### 1.4 Repo / scope / branch hygiene

- **`re-shell-ui` has NO git remote** → all UI work is local-only, unbacked-up. (CRITICAL data-loss risk.)
- **Scope split:** CLI ships as `@re-shell/*` but its source (plugin-system, service-integration, config-client) hardcodes `@re-shell/*` for generated/installed packages; UI packages are `@re-shell/ui` + `@re-shell/contracts`. No coherent scope.
- **Three diverged unmerged feature branches branches**, all with uncommitted work, none tracking upstream.
- **Legacy `re-shell` is broken:** `package.json` depends on a `file:` tarball at an absolute path that doesn't exist (install fails); the `packages/cli` submodule checkout is **gutted** (all files staged-deleted) and 2 commits stale; `packages/core` submodule uninitialized; a tracked `Users/dtumkorkmaz/Projects/Re-Shell/...` absolute-path directory leaks local layout into git.
- GitHub org casing inconsistent (`umutkorkmaz` in metadata/.gitmodules vs `UmutKorkmaz` remotes).

### 1.5 CLI internal debt

- **Three entrypoints:** `index.ts` (real), `index-optimized.ts` (broken — expects `setupXxxCommand` exports that don't exist), `minimal-index.ts`.
- **Orphaned subsystems (dead code):** `core/template-engine.*` (full YAML+Handlebars engine + marketplace/versioning/validator/wizard), `graph/dependency-graph-engine.ts`, `discovery/`, `quality/` (~217KB), `config/framework-metadata.ts`, plus `*.bak` files. The advanced workspace/graph/template engines are dead while the live commands use simpler inline versions.
- `security.group.ts` (~9700 lines) and `collab.group.ts` (~3000 lines) blow past the 800-line guideline and likely embed mock/demo data.
- **README↔filesystem template-ID mismatch:** README uses `express-ts`/`fastify-ts`; the actual files are `express`/`fastify`.
- `enableJsonMode()` globally monkey-patches `stdout.write`/`console.*` and only lets through strings starting with `{`/`[` — fragile; can swallow legitimate output.

### 1.6 Tests are vacuously green

- `re-shell-ui` `pnpm test` runs **zero tests** (no `test` script on `@re-shell/ui`, no `--if-present`) → CI green with no coverage.
- `hub.test.ts` has a `0 || DEFAULT_PORT` falsy-zero bug → 3 uncaught WS errors (real fixed-port collision).
- Real `pnpm -r run typecheck` **fails** (5 TS errors in `apps/web`); the audit's `tsc --noEmit` masked it.
- CLI `cli-adapters.test.ts` **fails 4/10**; `json-output.ts` (load-bearing) has **zero tests**.
- No coverage thresholds anywhere (vs the 80% target).

### 1.7 What genuinely works (the assets to build on)

- The `{ok,data,warnings}` / `{ok,error}` **envelope** is a clean, viable single foundation.
- The **hub-server transport** is real (SSE `/events`, WS `/jobs`, heartbeat, job cancel, client-disconnect kill) — only the *payload contract* and *security* are wrong.
- **`@re-shell/contracts`** centralizes the intended shapes in one file — a feasible single source of truth.
- The **`re-shell ui` launcher** (`ui.ts`) is solid: workspace/UI-path resolution, PM detection, dry-run/json plan, env handoff, browser open, cleanup.
- The **shadcn React primitives/domain components** that exist are well-formed and salvageable.
- CLI **backend template breadth** is real (200 registered frameworks, 218 files) with clean registry accessors.
- `workspace-graph.ts` / `workspace-health.ts` schema engines are genuinely capable (SCC cycles, topo sort, build order, scored category health) — they're just not the handlers the UI calls.

---

## 2. Binding decisions required from the owner

These genuinely change the plan's shape. Recommendations given; final call is the owner's.

1. **UI delivery model — React vs Web Components.**
   *Recommendation: shadcn React.* It's the plan's hard requirement (§2.1), the primitives/domain components already exist and are well-formed, and it unlocks TanStack Router/Query + React Flow per the plan. Export them from `@re-shell/ui`, refactor `apps/web` to consume them, retire the Web Components stubs (keep a thin custom-element wrapper *only* if embedding in non-React hosts is a real requirement).

2. **npm scope unification — `@re-shell/*` vs `@re-shell/*`.**
   *Recommendation: pick one and apply everywhere.* The CLI is *published* as `re-shell-cli`, but the CLI *source* and the UI packages assume `@re-shell/*`. Either unify on `@re-shell/*` (rename UI packages + fix CLI source emitters) or reclaim `@re-shell/*` (rename the CLI). Do not ship half-and-half.

3. **Repo strategy — single monorepo vs 2-repo split.**
   *Recommendation: a single pnpm monorepo* (`cli` + `ui` + `contracts` as workspace packages) retiring the submodule composition — unless independent release cadence for the UI is a hard requirement, in which case keep the 2-repo split and **publish `@re-shell/contracts` to npm** as the shared seam.

4. **Contract source of truth.**
   *Recommendation: `@re-shell/contracts` is authoritative.* The CLI runtime output and `CLI-CONTRACTS.md` both conform to it. Add zod schemas for runtime validation at the boundary.

5. **Legacy `re-shell` monorepo — archive vs keep.**
   *Recommendation: archive (read-only)* after salvaging (§8). Don't delete the repo outright (architecture/requirements docs + submodule history have residual value), but it should stop being an active build target.

6. **Post-MVP scope salvage — keep or drop?** From the legacy TODOs: AI/NLP command interface, cross-language service bridge (gRPC/REST/GraphQL), workspace.yaml v2 JSON Schema + IDE autocomplete, K8s/Helm/GitOps generation, Nx/Turbo importer. *Recommendation: capture in a short `ROADMAP.md`, build none of it pre-MVP.*

---

## 3. The plan (phased, ordered by dependency + risk) — EXECUTED

> **Historical.** This phased plan has been carried out (through Phase 8) under the consolidated
> single-monorepo model in §0. The phase text below is preserved as the original record; the
> repo-safety / multi-repo framing in Phase 0 no longer applies because there is now **one repo,
> one workspace, one `@re-shell/*` scope**. The canonical, up-to-date plan with the
> post-consolidation task breakdown is [`docs/RE_SHELL_ULTIMATE_PLAN.md`](./RE_SHELL_ULTIMATE_PLAN.md).
>
> Phases 0–6 were the critical path to a working, safe MVP. Phases 7–8 were parallelizable
> cleanup. Effort sizes are rough.

### Phase 0 — Stop the bleeding (repo safety) — DONE *(superseded by the monorepo merge)*
The original repo-safety steps below assumed three separate repos on unmerged feature branches
branches. They have been **superseded** by consolidating everything into the single pnpm
monorepo (Decision 3) on the `@re-shell/*` scope (Decision 2):
- ~~Create a git remote for `re-shell-ui` and push `the UI working branch`.~~ → folded into the monorepo; no separate UI repo remains.
- ~~Set upstream tracking on all three feature branches branches; record the merge order.~~ → all code now lives on `re-shell-cli`.
- ~~Legacy `re-shell`: do not commit the dirty submodule; remove the broken `file:` `@re-shell/core` dep; detach the submodule.~~ → legacy repo archived read-only after salvage (§7/§8); salvaged refs in [`docs/legacy/`](./legacy/).
- Scope (Decision 2) + org-casing applied across `package.json` repository/bugs/homepage — **done** (scope is `@re-shell/*`).

### Phase 1 — Lock the contract — ~1–2 days  *(gates everything UI)*
- Make `@re-shell/contracts` authoritative (Decision 4). Fix the `CommandSpecInput` no-op `Omit`; add an error-envelope type; consider a `schemaVersion` on `WorkspaceSummary`.
- Add **zod schemas** mirroring the TS types for runtime validation.
- **Regenerate `CLI-CONTRACTS.md` from real output** and conform it to contracts; align the error-code table to codes actually emitted (`NOT_IN_MONOREPO`, `LIST_WORKSPACES_ERROR`, `GRAPH_GENERATION_ERROR`, `TEMPLATE_NOT_FOUND`, …).
- Add a **contract-conformance test** in `re-shell-cli` that runs each `--json` command and validates output against the contracts. (This is the regression guard that prevents future drift.)

### Phase 2 — Make the CLI satisfy the contract — ~3–5 days
- Add `re-shell workspace --json` producing the full **`WorkspaceSummary`** (path, name, packageManager, nodeVersion, git, apps, services, templates, health).
- Register `templates list --json` → normalized **`TemplateSummary`** (with `command[]`, `domain`), not the internal engine shape.
- Add a real `--json` to `workspace graph` emitting topology in the **`{apps,services}`** the UI needs (or normalize `{nodes,edges}`→topology in one place).
- Align `workspace health --json` to **one** normalizer emitting `{score,status:'pass'|'warn'|'fail',checks:[{id,title,level,message}]}` (map healthy→pass, warning→warn, critical→fail). Pick rich vs lightweight health and delete the other path.
- **Register `doctor`** (decide top-level vs `tools doctor`); decide `analyze`/`completion`.
- **Auto-derive `WorkspaceDefinition` from `getWorkspaces()`** so health/graph work on real `package.json` monorepos without a hand-written `re-shell.workspaces.yaml`.
- Fix the `workspace list --json` **spinner leak** (gate spinner on `!options.json`).
- Harden `enableJsonMode()` — route JSON through an explicit writer, not stdout sniffing.

### Phase 3 — Harden the transport (hub → daemon) + security — ~3–5 days  *(CRITICAL)*
- **Remove `shell:true`.** Execute via argument arrays through an **allow-list adapter** (the typed `ReShellCommand` union from the plan). No browser-supplied command strings.
- **Add session-token auth:** `re-shell ui` generates a random token, prints it, passes it to the UI; the hub requires it on every endpoint. Bind 127.0.0.1; drop CORS `*`.
- **Hub unwraps the `{ok,data,warnings}` envelope** and reassembles multi-line JSON, emitting one parsed domain object per command (e.g. SSE `{type:'result',data}`). Handle `{ok:false,error}` explicitly.
- Align WS `/jobs`: terminal consumes `{type:'stdout'|'stderr'|'exit',content}`; add `start`/`cancel` to a shared `WsClientMessage`.
- Remove/replace the stub `src/hub/index.ts` so the real `SseClient`/`WsClient` always resolve.

### Phase 4 — Resolve the dual-UI fork + fix package build — ~3–5 days  *(needs Decision 1)*
- Per Decision 1 (rec: React): export `components/ui/*` + `components/re-shell/*` from `@re-shell/ui`; add **vite-plugin-dts** (.d.ts) and bundle **`globals.css`** to the `./styles.css` export; fix dist filenames; remove the `Drawer` claim or implement it.
- Refactor `apps/web` to consume the React layer; add a data-fetching layer (TanStack Query) wiring contracts → hub client → components.
- Delete the orphaned UI system (Web Components stubs) — or, if Web Components win, delete the React layer and re-scope the plan instead.

### Phase 5 — Build the MVP screens against real data — ~2–3 weeks
Per execution-plan §12, each screen with a **copy-CLI-command** affordance (the teach-the-CLI principle):
Overview · Workspace Graph (React Flow) · Templates (filters + dry-run) · Command Builder (forms from a `commands list --json`) · Jobs & Logs (history + live stream) · Health · Settings (persisted).

### Phase 6 — Tests, CI, hardening — ~1 week (overlaps 1–5)
- `re-shell-ui`: add a real `test` script; fix vitest@4/vite@5 mismatch; fix the `?? DEFAULT_PORT` falsy-zero bug; wire root tests + coverage; make `pnpm -r run typecheck` honest and fix the 5 `apps/web` TS errors.
- `re-shell-cli`: fix the 4 `cli-adapters` test failures (printf vs `echo -e`, SIGTERM assertion); add `json-output.ts` tests; add coverage thresholds.
- Playwright E2E for the critical flows (open → inspect → filter templates → build → dry-run → run → logs → cancel). CI per repo.

### Phase 7 — CLI internal cleanup — parallelizable, lower urgency
- Delete dead code: `index-optimized.ts`, `minimal-index.ts`, `quality/`, `discovery/`, orphaned `core/template-engine.*` + `graph/dependency-graph-engine.ts` (or wire one in), `*.bak`.
- Decide the **canonical template engine** (live class-based vs orphaned YAML/Handlebars); delete the loser.
- Split `security.group.ts` / `collab.group.ts` into <800-line files; strip or flag mock data.
- Fix the README↔filesystem **template-ID** mismatch (`express-ts` vs `express`).

### Phase 8 — Docs consolidation + legacy archive — ~1 day (after salvage)
- Execute the §8 disposition.
- Create `re-shell-cli/ROADMAP.md` from the salvaged post-MVP items.
- Archive the legacy `re-shell` monorepo (read-only) once salvage is done.

---

## 4. Critical-risk register (fix-before-anything-else)

| # | Severity | Issue | Phase |
|---|----------|-------|-------|
| 1 | CRITICAL | `re-shell-ui` has no git remote — UI work unbacked-up | 0 |
| 2 | CRITICAL | hub-server `shell:true` + no auth = localhost RCE | 3 |
| 3 | CRITICAL | Envelope/SSE double-wrap breaks every UI data path | 1→3 |
| 4 | CRITICAL | `WorkspaceSummary` + `templates list` have no CLI producer | 2 |
| 5 | CRITICAL | Two parallel UI systems; the documented one is dead | 4 |
| 6 | HIGH | Legacy `re-shell` install broken (missing `file:` tarball) + gutted submodule | 0 |
| 7 | HIGH | 3-way HealthSummary drift; topology gets `{nodes,edges}` not `{apps,services}` | 1→2 |
| 8 | HIGH | `pnpm test` runs zero tests; cli-adapters 4/10 fail; typecheck masked | 6 |

---

## 5. Recommended merge / branch order
1. `re-shell-cli` engine + contract work (Phases 1–3 CLI side) → merge to `main`.
2. `@re-shell/contracts` locked and (if 2-repo) published.
3. `re-shell-ui` consumes the released contract; merge `the UI working branch`.
4. Legacy `re-shell` archived last.

---

## 6. Definition of done (MVP)
- `re-shell ui` from any workspace opens a dashboard that shows **real** workspace data (overview, graph, templates, health) sourced from the CLI through the token-authed hub.
- Every action shows/copies its equivalent CLI command; destructive actions confirm; dry-run supported.
- **No `shell:true` / no arbitrary-command path; token required.**
- One UI system, one contract source of truth, `CLI-CONTRACTS.md` generated from real output and CI-verified.
- `pnpm test` / `npm test` run real suites that pass with coverage thresholds; typecheck honest.
- Fresh clone → demo in <5 min; Playwright covers the core flow.

---

## 7. Salvage from legacy before deletion
- **From `CLI_IMPLEMENTATION_TODO.md`** → `re-shell-cli/ROADMAP.md`: AI/NLP command interface, cross-language service bridge, workspace.yaml v2 JSON Schema + IDE autocomplete, K8s/Helm/GitOps generation, Nx/Turbo importer.
- **From `HOW_TO_USE_BACKEND_TEMPLATES.md` / `BACKEND_TEMPLATES_DEMO.md`** → CLI docs/README (if not already covered): the backend framework **selection matrix** (perf/real-time/GraphQL/microservices/enterprise) — after correcting counts to 218 and verifying IDs.
- **From `UI_IMPLEMENTATION_TODO.md`** → UI plan (post-MVP): design-token system, runtime theme switching, core layout primitives, WCAG/a11y infrastructure. *Drop all quantum/AR-VR/neural/blockchain content.*

---

## 8. Document disposition (the "remove old ones" list)

Legend: **DELETE** (remove; after salvage where noted) · **MERGE** (fold into another) ·
**REWRITE** (keep file, correct content) · **KEEP** · **MOVE** (relocate to the right repo).

### 8.1 `re-shell` (legacy) — archive the repo; before that:

| File | Verdict | Note |
|------|---------|------|
| `docs/RE_SHELL_UI_EXECUTION_PLAN.md` | **DELETE** | Byte-identical dup of the re-shell-ui copy (same md5). |
| `CLI_IMPLEMENTATION_TODO.md` | **DELETE** (after salvage §7) | 1722 lines, ~40% fantasy. |
| `CLI_IMPLEMENTATION_TODO_BACKEND_EXPANDED.md` | **DELETE** | 1500-task per-driver sprawl (YAGNI). |
| `CLI_FUTURE_PLANS.txt` | **DELETE** | Marketing prose, no actionable detail. |
| `CLI_SPINNER_IMPROVEMENTS_SUMMARY.md` | **DELETE** | Work shipped long ago. |
| `UI_IMPLEMENTATION_TODO.md` | **DELETE** (after salvage §7) | 1469 lines, mostly fantasy. |
| `BACKEND_FRAMEWORKS_COMPREHENSIVE.md` | **DELETE** | 914-line unchecked backlog; realized in code. |
| `BACKEND_IMPLEMENTATION_PROGRESS.md` | **DELETE** | Stale progress tracker (v0.23/82 templates). |
| `BACKEND_IMPLEMENTATION_SUMMARY.md` | **DELETE** | One-time session summary. |
| `BACKEND_TEMPLATES_ARCHITECTURE.md` | **DELETE** | Stale counts/benchmarks. |
| `BACKEND_TEMPLATES_DEMO.md` | **DELETE** (after salvage §7) | Selection matrix worth porting. |
| `HOW_TO_USE_BACKEND_TEMPLATES.md` | **DELETE** (after salvage §7) | Framework matrix worth porting. |
| `PACKAGE_MANAGERS.md` | **DELETE** | Legacy monorepo build (manager.sh). |
| `AGENTS.md` | **DELETE** | agent-context auto-dump; gitignore it. |
| the empty package memory file | **DELETE** | Empty 0-byte file. |
| `docs/PROJECT_PLAN.md` | **DELETE/REWRITE** | Predates the standalone split; layout stale. |
| `docs/README.md` | **DELETE/REWRITE** | Conflicts with root README; broken links. |
| `INTEGRATION.md` + `docs/INTEGRATION.md` | **MERGE** → one | Two overlapping integration guides. |
| `README.md` | **REWRITE** | Broken links, fictional stats, old org names. |
| `docs/requirements.md` | **KEEP/ARCHIVE** | Timeless MF requirements. |
| `docs/architecture.md` | **KEEP/ARCHIVE** | Substantive design reference. |
| `docs/COMMIT_CONVENTION.md` | **KEEP** | Generic, reusable. |

### 8.2 `re-shell-cli` monorepo — active

Now the single workspace root. CLI-package docs live under `packages/cli/`; cross-cutting
plan/contract docs live under `/docs` (see [`docs/README.md`](./README.md) for the IA).

| File | Verdict | Note |
|------|---------|------|
| `docs/CLI-CONTRACTS.md` | **DONE (REWRITE)** | Regenerated from real output in Wave 2; conforms to `re-shell-contracts`; documents the SSE/WS transport + error-code vocabulary; backed by `packages/cli/tests/contract-conformance.test.ts`. |
| `docs/legacy/CLI-CONTRACTS.old.md` | **ARCHIVED** | The pre-rewrite contract, kept for history under `docs/legacy/`. |
| `docs/superpowers/specs/2026-05-29-…design.md` | **KEEP** | The UI design spec; package name updated to `@re-shell/*`. Flip "Draft"→"Implemented" where shipped. |
| `packages/cli/README.md` | **REWRITE** | CI badge, org casing (`@re-shell`), template-ID mismatch; thin pointer to `/docs`. |
| `AGENTS.md` | **DELETE** | agent-context auto-dump (opens `<agent-context auto-dump-context>`); now gitignored (`AGENTS.md`, `.agents/`). **Removed.** |
| `src/groups/_middle_commands.md` | **KEEP** | Migration map; delete once migration done. |
| `packages/cli/tests/README.md`, `packages/cli/EXAMPLES.md`, `packages/cli/examples/*.md`, `packages/cli/CHANGELOG.md` | **KEEP** | Accurate / usage refs (live under `packages/cli`). |
| `docs/RE_SHELL_MASTER_PLAN.md` (this file) | **KEEP (historical)** | Audit record; superseded by `docs/RE_SHELL_ULTIMATE_PLAN.md`. |
| `docs/RE_SHELL_ULTIMATE_PLAN.md` | **KEEP (canonical)** | The authoritative implementation plan. |
| `docs/README.md` | **KEEP** | Monorepo docs index / IA. |

### 8.3 former `re-shell-ui` — now `packages/ui` + `packages/contracts` + `apps/web`

The standalone UI repo has been folded into the monorepo. **Web Components are retired**
(Decision 1): the single UI system is shadcn-React in `packages/ui`. Package names are now
`re-shell-ui`, `re-shell-contracts`, and `re-shell-dashboard`.

| File | Verdict | Note |
|------|---------|------|
| `docs/RE_SHELL_UI_EXECUTION_PLAN.md` | **SUPERSEDED** | Folded into `docs/RE_SHELL_ULTIMATE_PLAN.md` (canonical); no separate daemon, React resolved. |
| hub-server / security doc | **KEEP** | The token-authed SSE `/events` + WS `/jobs` transport in `apps/web/src/hub-server.ts`; the prior `shell:true`/no-auth RCE risk is fixed. Transport + error vocabulary documented in `docs/CLI-CONTRACTS.md`. |
| `docs/cli-integration.md` | **MERGED** | Stale endpoint table; folded into the hub-server/contracts docs. |
| `docs/web-components-usage.md` | **DELETE** | Web Components layer retired (Decision 1). |
| `packages/ui/README.md` | **REWRITE** | shadcn-React exports under `re-shell-ui`; thin pointer to `/docs`. |
| `packages/contracts/README.md` | **REWRITE** | Correct package name `re-shell-contracts` (authoritative contract source); thin pointer to `docs/CLI-CONTRACTS.md`. |
| `apps/web/README.md` | **REWRITE** | `re-shell-dashboard` dashboard; describes the React panels it actually renders; thin pointer to `/docs`. |

---

## 9. Open questions rolled up (for the owner)
- Health: rich `manageWorkspaceHealth` report or lightweight `checkWorkspaceHealth` — which is canonical? (Plan assumes rich.)
- `templates`: new top-level command, or repoint the UI to `config template list` / `generate`?
- Should apps/services carry runtime fields (status/port/healthUrl) that require live probing, or stay static-detection only?
- Is `@re-shell/core` (and the `Re-Shell/core` submodule) a live dependency or dead weight?
- Should `@re-shell/contracts` be published to npm to decouple CLI/UI release cycles?

---

## Canonical Template Engine (W7-3 decision)

There is exactly ONE template engine in the live CLI:

- Engine: `packages/cli/src/utils/template-engine.ts`
- Registry/loader: `packages/cli/src/templates/index.ts`

These are the canonical, reachable modules (imported by `src/commands/template.ts`
and `src/commands/create.ts`). The competing `src/core/template-*` cluster was
DEAD and was deleted in W7-2; no source file references `core/template*` anymore
(verified via `grep -rn "core/template" src/` → no matches). Do not reintroduce a
second engine; extend `src/utils/template-engine.ts` + `src/templates/index.ts`.

## Oversized live-file split (W7-3)

The three oversized command-group monoliths were split into per-domain modules,
each under 800 lines, with a thin registrar that only wires modules:

- `src/groups/security.group.ts` (was ~9,819 lines) → registrar (59 lines) +
  `src/groups/security/*.ts` (one module per subcommand; `rbac` and `vendor`
  additionally factor their large config literals into `*-config.ts` /
  `*-fixtures.ts`). All 22 subcommands + `help` intact.
- `src/groups/config.group.ts` (was ~2,527 lines) → registrar (41 lines) +
  `src/groups/config/*.ts` (direct, schema, env, unified, migrate, validate,
  project, workspace, template, diff, backup, profile; `profile` splits its
  env/template subgroups into `profile-subgroups.ts`). All 18 subcommands +
  `help`, the `uc` alias, and nested `profile env` / `profile template`
  subgroups intact.
- `src/groups/collab.group.ts` (was ~2,589 lines) → registrar (70 lines) +
  `src/groups/collab/*.ts` (one module per subcommand). The per-module
  `import('../../utils/X.js')` dynamic edges are preserved. All 27 subcommands +
  `help` intact.

## `enableJsonMode` hardening (W7-3)

`src/utils/json-output.ts` no longer sniffs `{`/`[` prefixes to decide what
reaches stdout. In JSON mode, `enableJsonMode()` swallows ALL incidental stdout
(banners, progress, library logging, Buffers, multi-line text) and the single
sanctioned emitter `emitJson()` (used by `ok`/`fail`/`jsonSuccess`/`jsonError`)
opens a one-shot gate around its lone write. Result: every JSON command emits
exactly one parseable document on stdout and nothing else. console.log/warn are
silenced; console.error is routed to stderr so real failures are never lost. The
patch is re-entrant (nested enable is a no-op restore) and exposes
`isJsonModeActive()`. Public helper signatures and their non-zero-exit /
single-line behavior are unchanged; the conformance + contract tests still pass.

---
*This plan is derived from the audit findings; the underlying agent output lives in the session transcript. Update this file as the binding decisions in §2 are made.*
