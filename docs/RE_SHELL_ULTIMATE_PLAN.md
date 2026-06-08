# Re-Shell — Ultimate Implementation Plan

> **Status:** Authoritative implementation plan. Supersedes `docs/RE_SHELL_MASTER_PLAN.md` (the earlier DRAFT) and the scattered legacy plan/TODO files.
> **Produced:** 2026-06-06, from a 41-agent workflow: **18 parallel empirical-audit agents** (read source + ran the built CLI/tests) → **18 adversarial verifiers** (each tried to *refute* the audit's CRITICAL/HIGH findings against the live working tree) → **5 domain-synthesis agents**. Every claim below is verified-against-code, with the verifier corrections folded in.
> **Repos audited:** `re-shell-cli` (`@umutkorkmaz/re-shell-cli@0.28.0`, branch `the working branch`), `re-shell-ui` (branch `the UI working branch`, **no git remote**), legacy `re-shell` (`the legacy working branch`, broken build, to be archived).

---

## A. Locked owner decisions (do not re-litigate)

These four decisions were made by the owner and are baked into every task below.

| # | Decision | Consequence |
|---|----------|-------------|
| 1 | **UI delivery model = shadcn React** | Export `components/ui` + `components/re-shell` from the UI package; refactor `apps/web` to consume React; **retire the Web Components layer** (keep at most a thin custom-element wrapper *only* if a real non-React embedder appears — none today). |
| 2 | **npm scope = `@umutkorkmaz/*` everywhere** | Rename `@re-shell/contracts → @umutkorkmaz/contracts`, `@re-shell/ui → @umutkorkmaz/ui`; fix the CLI source emitters that hardcode `@re-shell/*` for generated/installed packages. |
| 3 | **Repo strategy = single pnpm monorepo** | Merge `cli` + `ui` + `contracts` into one pnpm workspace; retire the legacy submodule composition. |
| 4 | **Legacy `re-shell` = archive read-only after salvage; plan covers ALL features** | This is a **full** plan: the MVP critical path (Phases 0–6) **and** every post-MVP feature fully specced (Phase 9). |

---

## B. Verified current state (corrected reality)

The earlier draft's "what is implemented" claims were materially overstated. This section is what the audit **empirically verified** (and what the adversarial pass *corrected*). Read it before touching anything — several "obvious" facts are wrong.

### B.0 The single most important correction — the `re-shell-ui` working tree is a dirty WC regression over a healthy React baseline

The committed **HEAD** of `re-shell-ui` is **React-first and correct**: `packages/ui/src/index.ts` exports `./components/re-shell`, `./components/ui`, `./contracts`, `./lib`; `package.json` is `@re-shell/ui@0.2.2` ("Shadcn-first React component library") with a React vite build (`@vitejs/plugin-react` + `vite-plugin-dts`); `apps/web/src/App.tsx` (at HEAD) renders React shadcn components.

The **working tree** is an **uncommitted Web-Components regression** layered on top: `index.ts` rewritten to register custom elements, `package.json` downgraded to `0.1.0`, plus an **untracked** WC overlay (`components/atomic/`, `components/domain/`, `components/layout/`, `hub/`, `lib/cn.ts`, `lib/styles.ts`, `tests/`) and an untracked **but genuinely valuable** `apps/web/src/hub-server.ts` (the real SSE/WS transport).

**Implication:** several audit agents (and the earlier draft) audited the *dirty tree* and concluded "React is dead / not exported / rebuild apps/web." That is **false of HEAD**. The correct action is **not** "rebuild in React" — it is: **(1) back up the untracked work first (there is no remote — a stray `git clean` destroys it), (2) salvage the transport (`hub-server.ts`, SSE/WS clients), (3) discard the WC overlay, (4) build forward from the committed React baseline.** This is task **P3-00** and it gates all of Phase 3–4.

### B.1 The CLI↔UI contract is broken end-to-end (verified by running the built CLI)

- **No `WorkspaceSummary` producer.** `workspace --json` → `error: unknown option '--json'` (the base `workspace` command has no `.action()`); `grep WorkspaceSummary src/` = 0 hits.
- **`templates list --json` does not exist.** No top-level `templates`/`template` command is registered; `node dist/index.js templates list --json` → `error: unknown command 'templates'`. The 205-framework registry has no list command at all.
- **`config template list --json` emits 0 bytes.** `enableJsonMode()` nulls `console.log`, but `listTemplates` only `console.log`s and never calls `jsonSuccess` → empty output.
- **`workspace graph` rejects `--json`** (real flag is `--format json`) **and emits `{nodes,edges}`** while the UI reads `{apps,services}` — doubly broken. Even with `--format json` it leaks `⏳`/`✅` spinner lines onto stdout.
- **`workspace health --json` is 3-way divergent** and on the no-config path prints human text to stdout **and exits 0** (false success). Live emits `{checks:[{name,status:'healthy'|'warning'|'critical'}],overall}`; the contract wants `{score,status:'pass'|'warn'|'fail',checks:[{id,title,level,message}]}`; the docs describe a *third* category-based shape.
- **Every JSON error path exits 0.** `workspace list --json` from a non-monorepo returns `{ok:false,...}` with exit code **0** — any exit-code-based success check is defeated.
- **SSE double-wrap breaks every UI data path.** The hub emits `{type:'stdout',content:line}`; the live UI consumers (`health.ts`, `topology.ts`) do bare `JSON.parse(event.data)` and read `.apps`/`.score` off the *wrapper* → always `undefined`. The terminal expects `{type:'output',output}` while the hub emits `{type:'stdout',content}` → live output never renders. No multi-line JSON reassembly anywhere.
- **`cli-adapters.ts` is dead/test-only** (imported only by its test) and encodes the wrong command strings; the *live* invocations are hardcoded EventSource URLs in the web components. (Correcting the earlier draft, which attributed the live invocation to `cli-adapters.ts`.)

### B.2 Transport security — unauthenticated local RCE (CRITICAL)

`apps/web/src/hub-server.ts` runs `spawn(..., { shell: true })` on **browser-supplied** `command`/`args` via **both** SSE `GET /events` (query params — exploitable by a bare `<img src=…/events?command=…>`, no CORS preflight) **and** WS `/jobs` (message body), with `Access-Control-Allow-Origin: '*'`, **no token auth**, and **unvalidated `cwd`** (path-traversal). The `re-shell ui` launcher prints no token. Additional confirmed gaps: WS disconnect orphans child processes (no socket→job association); `broadcastToWs` leaks every job's output to *all* sockets (cross-client disclosure). And the hub **never even starts today** — the CLI spawns `node -r ts-node/register hub-server.ts` but neither `ts-node` nor `tsx` is installed (only the vite dev plugin actually runs it).

### B.3 Tests are vacuously green

- CLI: `vitest run` is **RED** — `6 failed | 112 passed | 5 skipped`. `cli-adapters.test.ts` fails (forEach arity leak; signal exit coerced to 0; `echo -e` macOS portability). `json-output.ts` has **zero** tests. No coverage tooling installed; no thresholds. No CI (`.github` absent). Tests pollute tracked fixtures (dirty tree after run).
- UI: `pnpm test` runs **zero** tests (no `test` script on the UI package). `vitest@4.1.7` is incompatible with `vite@5` (`ERR_PACKAGE_PATH_NOT_EXPORTED: './module-runner'`) → component tests can't run. `pnpm -r typecheck` **fails** (5 TS errors in `apps/web`) but the CI command (`pnpm -r exec tsc --noEmit`) masks it. `hub.test.ts` has a `0 || DEFAULT_PORT` falsy-zero bug and reports green while 3 assertions throw post-resolve; its `../test-workspace` fixture doesn't exist.

### B.4 CLI internal debt (verified, with corrections)

- **Four built features are dead-on-arrival:** `doctor`, `analyze`, `completion`, `templates` have complete, maintained handlers (doctor was rebuilt *today* with `--json`) but are **registered nowhere** in the live `src/index.ts` → `error: unknown command`. Highest-value/lowest-effort win.
- **Two dead entrypoints** (`index-optimized.ts`, `minimal-index.ts`) compile and **ship** in the published tarball; they are the only thing keeping the orphaned handlers falsely "reachable" to naive greps.
- **~164 orphan files / ~144,083 lines of dead code ship** in the package (corrected *up* from the draft's 142/~131.8k). **All 28** `src/core/*.ts` are orphan (draft wrongly said keep 6). `src/utils/template-engine.ts` is **LIVE** via a CommonJS `require()` edge — any ESM-only reachability tool would wrongly delete it.
- **Oversized files:** `security.group.ts` = **9,819** lines, `config.group.ts` = 2,527 (121 subcommands), `collab.group.ts` = 2,589.
- **9 distinct JSON error codes** are actually emitted (not 10). **205** registered frameworks / **219** template files (not "200/218"). README uses retired IDs `express-ts`/`fastify-ts`; real IDs are `express`/`fastify` (and `create --template express-ts` throws "Unsupported framework").
- **53 hardcoded `@re-shell/*`** references across 15 CLI source files (the scope-unification surface for Decision 2); `config-client-frameworks.ts` is the worst (11) but is itself orphan — it dies with the dead-code sweep.
- Plugin install is a `setTimeout(2000)` stub that reports success; the marketplace is fully mocked and hardcodes `verified:true` while defaulting `verifySignatures:true` (a latent trust issue, not just a fake feature).

### B.5 What genuinely works (assets to build on)

- The `{ok,data,warnings}` / `{ok,error}` **envelope** (`json-output.ts`) is a clean, viable single foundation.
- The committed **React shadcn layer** (10 primitives + 6 domain components, cva/Radix/`cn`/lucide) is well-formed, exported at HEAD, and sufficient to start the 7 screens.
- The **hub transport** (SSE `/events`, WS `/jobs`, heartbeat, job cancel, SSE client-disconnect kill) is real — only its *payload contract* and *security* are wrong.
- **`@re-shell/contracts`** already centralizes the intended shapes in one file — a feasible single source of truth (needs zod + rename + envelope).
- The **`re-shell ui` launcher** (`ui.ts`) is solid on workspace/PM detection, dry-run/json plan, env handoff, browser open — it just needs token generation, env fixes, and a launchable hub.
- The CLI **backend template breadth** (205 frameworks / 219 files) is real with clean registry accessors; the rich `workspace-graph`/`workspace-health` engines (SCC cycles, topo sort, build order, scored health) are capable — they're just not the handlers the UI calls.
- The legacy repo's `docs/architecture.md` (467 L) and `docs/requirements.md` (297 L) are the only salvage-worthy design refs.

---

## C. Critical-risk register (fix-before-anything-else)

| # | Severity | Risk | Owning task(s) |
|---|----------|------|----------------|
| 1 | CRITICAL | `re-shell-ui` has **no git remote** AND its valuable transport work is **untracked/uncommitted** — a stray `git clean`/disk loss is total data loss | P0-01, P3-00 |
| 2 | CRITICAL | hub-server `shell:true` + no auth + CORS `*` + unvalidated `cwd` = unauthenticated **localhost RCE** (via both SSE GET and WS) | P3-02→P3-07 |
| 3 | CRITICAL | Envelope/SSE double-wrap + terminal WS mismatch break **every** UI data path | P3-08 |
| 4 | CRITICAL | `WorkspaceSummary`, `templates list`, real `workspace graph --json`, `workspace health --json` shape — **no conforming CLI producer** | P2-05→P2-09 |
| 5 | CRITICAL | Dirty WC working tree masquerades as the baseline; naive reconciliation either rebuilds needlessly or destroys the untracked transport | P3-00 |
| 6 | CRITICAL | Every JSON **error path exits 0** — machine consumers can't detect failure | P2-16 |
| 7 | HIGH | `pnpm test` runs **zero** tests; CLI suite is RED; typecheck masked; vitest@4/vite@5 breaks UI tests | P6-01→P6-05 |
| 8 | HIGH | Four built CLI features (`doctor`/`analyze`/`completion`/`templates`) unreachable | P2-11, P2-09 |
| 9 | HIGH | Legacy `re-shell` install/build broken (missing `file:` tarball, gutted submodule, leaked absolute-path tree) | P8-14, P8-15 |

---

## D. How to read this plan

- **Phases & task IDs.** Work is organized into phases P0–P9. Every task has a **stable ID** (e.g. `P2-07`, `P4-08`, `P9-B3`), a file list, an effort size (**XS** <2h · **S** <½d · **M** 1–2d · **L** 3–5d · **XL** >1wk), explicit **dependencies** on other task IDs, and **acceptance criteria**. Tasks marked *parallel-safe* can run concurrently.
- **Critical path to a working, safe MVP:** Phases 0 → 6. **Phases 7–8** (cleanup, docs, legacy archive) are parallelizable, lower-urgency. **Phase 9** is the full post-MVP roadmap, each feature a self-contained mini-plan.
- **Cross-section dependency tags** used inside sections: `P0-safety`, `P1-contract`, `P2-cli`, `P3-transport-security`, `P4-ui-fork`, `P5-screens`, `P6-tests`.
- The master sequencing & agent-assignment map is in **§E (end of document)**.

---

## Phase 0–1 — Repo Unification, Safety, Scope & Contract Lock

This phase establishes the foundation every later phase depends on: a backed-up, single pnpm monorepo with one consistent `@umutkorkmaz/*` scope, `@umutkorkmaz/contracts` as the single typed source of truth (with zod), and a regenerated, conformance-tested contract surface. Nothing in P2+ (CLI producers, transport hardening, UI fork) is safe to start until P0 safety and P1 contract-lock land.

**Verified preconditions (ground truth at plan time):**
- `re-shell-ui` has **NO git remote** (`git remote -v` empty) and sits on branch `the UI working branch` with uncommitted changes — a single `git clean`/disk loss destroys it. This is the highest-priority safety gap.
- `re-shell-cli` remote is `https://github.com/UmutKorkmaz/re-shell-cli.git`; package is already `@umutkorkmaz/re-shell-cli@0.28.0`, bin `re-shell`, but uses **npm** (`package-lock.json`, no `packageManager` field).
- UI is already a pnpm workspace (`pnpm-workspace.yaml`: `apps/*`, `packages/*`) with `packages/contracts` (`@re-shell/contracts`), `packages/ui` (`@re-shell/ui`), `apps/web`.
- CLI `src/` has `@re-shell/` in **15 files** (line-level count 53); CLI has **no zod**, but `ajv@^8.17.1` is present.
- CLI `docs/` and `AGENTS.md` are git-**untracked**; `docs/CLI-CONTRACTS.md` exists (564 lines, aspirational/inaccurate per findings).

---

### P0 — Safety & Backup (do first, blocks everything)

#### P0-01 — Create remote for `re-shell-ui` and push all branches/tags
**Effort:** XS · **Deps:** none · **Parallel:** yes (with P0-02)
- Create `https://github.com/UmutKorkmaz/re-shell-ui` via `gh repo create UmutKorkmaz/re-shell-ui --private --source . --remote origin` from `/Users/umut/Projects/github/UmutKorkmaz/re-shell-ui`.
- Commit the current working-tree changes on `the UI working branch` first (do NOT discard), then `git push -u origin --all && git push origin --tags`.
- **Acceptance:** `gh repo view UmutKorkmaz/re-shell-ui` resolves; `git ls-remote origin` lists `the UI working branch`; remote HEAD commit == local HEAD; no uncommitted work lost.

#### P0-02 — Snapshot/tag CLI pre-merge state
**Effort:** XS · **Deps:** none · **Parallel:** yes
- In `re-shell-cli`, tag the current tip `pre-monorepo-merge` and push: `git tag pre-monorepo-merge && git push origin pre-monorepo-merge`.
- **Acceptance:** tag visible on remote; recoverable rollback point exists before any history rewrite/merge.

#### P0-03 — Commit untracked authoritative docs in CLI; remove memory-dump artifact
**Effort:** XS · **Deps:** none · **Parallel:** yes
- Files: `re-shell-cli/docs/**` (currently `?? docs/`), `re-shell-cli/AGENTS.md`.
- `git add docs/` (commits `RE_SHELL_MASTER_PLAN.md`, `CLI-CONTRACTS.md`, the design spec). DELETE `re-shell-cli/AGENTS.md` (it is a `agent-context auto-dump` auto-dump, opens `<agent-context auto-dump-context>`), and add `AGENTS.md` + `.agents/` to `.gitignore` if not already ignored.
- **Acceptance:** `git status` shows no untracked `docs/`; `AGENTS.md` gone and gitignored; master plan + contract doc are in history (not just working tree).

#### P0-04 — Archive-after-salvage marker for legacy `re-shell`
**Effort:** XS · **Deps:** none · **Parallel:** yes
- Record (in the new monorepo `/docs/legacy/README.md`) that the legacy `re-shell` repo is to become read-only after salvage; do NOT delete legacy content until P1 salvage tasks (handled in the docs section) extract `docs/architecture.md` + `docs/requirements.md`.
- **Acceptance:** a tracked note exists naming the legacy repo, the two salvage-worthy files, and the read-only intent. (Actual archive flip happens in the docs phase, gated on salvage completion.)

---

### P1 — Monorepo Unification & Scope Rename

> Ordering note: do the **monorepo merge (P1-01..P1-04) BEFORE the scope rename (P1-05..P1-08)** so the rename is one atomic sweep across a single tree, not three repos. P1-01 depends on P0-01/P0-02 (backups exist first).

#### P1-01 — Define the unified pnpm workspace layout
**Effort:** S · **Deps:** P0-01, P0-02 · **Parallel:** no (gates the merge)
- Target single-monorepo layout (root = new unified repo, recommend keeping the CLI repo as the monorepo home given it already has the remote + history, or a fresh `re-shell` monorepo — owner pick; plan assumes CLI repo becomes root):
  ```
  /                      (root: pnpm-workspace.yaml, package.json w/ packageManager, tsconfig.base.json)
  ├─ packages/
  │   ├─ cli/            (← current re-shell-cli src/, dist/, tests/, bin → @umutkorkmaz/re-shell-cli)
  │   ├─ contracts/      (← re-shell-ui/packages/contracts → @umutkorkmaz/contracts)
  │   └─ ui/             (← re-shell-ui/packages/ui → @umutkorkmaz/ui)
  ├─ apps/
  │   └─ web/            (← re-shell-ui/apps/web)
  └─ docs/               (master plan, CLI-CONTRACTS.md, ROADMAP.md, legacy/)
  ```
- Author root `pnpm-workspace.yaml` (`packages: ['packages/*', 'apps/*']`) and root `package.json` with `"packageManager": "pnpm@<pinned>"`, workspace-wide `scripts` (`build`, `test`, `typecheck`, `lint`) using `pnpm -r` / topological build order (contracts → ui → web; cli independent).
- **Acceptance:** layout documented in `docs/RE_SHELL_MASTER_PLAN.md` §0/§3 (replacing the submodule/2-repo framing); `pnpm-workspace.yaml` and root `package.json` drafted; build order is contracts-before-ui-before-web.

#### P1-02 — Move CLI into the monorepo and convert npm→pnpm
**Effort:** L · **Deps:** P1-01 · **Parallel:** no
- Move current CLI tree into `packages/cli/`; delete `package-lock.json`; remove npm-specific lock assumptions.
- Reconcile `packages/cli/package.json`: keep `name: @umutkorkmaz/re-shell-cli`, bin `re-shell` → `dist/index.js`; ensure its build script and the `dist/utils/schemas` copy step still resolve from the new path.
- Use `git mv` (or `git subtree`/`git filter-repo` if preserving UI history into this repo) so CLI history is retained; UI history preservation is best-effort via subtree merge from the now-remote `re-shell-ui` (P0-01).
- Run `pnpm install` at root; resolve any hoisting/peer issues.
- **Acceptance:** `pnpm -w install` succeeds; `pnpm --filter @umutkorkmaz/re-shell-cli build` produces `packages/cli/dist/index.js`; `node packages/cli/dist/index.js --version` prints `0.28.0`; no `package-lock.json` remains; `pnpm-lock.yaml` committed.

#### P1-03 — Move contracts, ui, apps/web into the monorepo
**Effort:** M · **Deps:** P1-01 · **Parallel:** yes (with P1-02)
- Bring `packages/contracts`, `packages/ui`, `apps/web` from `re-shell-ui` into the unified tree (subtree-merge to preserve history where feasible).
- Update any intra-UI relative paths, `tsconfig` references, and `vite.config.ts` aliases for the new root.
- **Acceptance:** `pnpm --filter @re-shell/contracts build` (pre-rename name) and `--filter @re-shell/ui build` succeed in the new tree; `apps/web` `vite build` runs; `workspace:*` links resolve.

#### P1-04 — Retire legacy submodule composition
**Effort:** S · **Deps:** P1-02, P1-03 · **Parallel:** no
- Remove any `.gitmodules` / submodule wiring tying the old multi-repo composition together; delete dead CLI entrypoints surfaced by findings (`packages/cli/src/index-optimized.ts`, `packages/cli/src/minimal-index.ts`) and `.bak*` util files — these are unreferenced and diverge from the live `src/index.ts` bin.
- **Acceptance:** no submodules remain (`git submodule status` empty); `grep -rl "index-optimized\|minimal-index" packages/cli/src` returns nothing importing them; build still green.

#### P1-05 — Rename UI packages to `@umutkorkmaz/*`
**Effort:** S · **Deps:** P1-03 · **Parallel:** no (gates downstream rename verification)
- Edit `packages/contracts/package.json:name` → `@umutkorkmaz/contracts`; `packages/ui/package.json:name` → `@umutkorkmaz/ui` (and `@re-shell/ui-web`/`@re-shell/ui-dashboard` → `@umutkorkmaz/*` if present).
- Update all consumer references: `apps/web/package.json` deps (`@re-shell/contracts`, `@re-shell/ui` → `@umutkorkmaz/*`), `packages/ui/package.json` dep on contracts, `packages/ui/src/contracts/index.ts` (`export type * from '@re-shell/contracts'`), direct imports in `packages/ui/src/components/domain/health.ts`, `topology.ts`, `packages/ui/src/hub/ws-client.ts`, all `components/re-shell/*.tsx` (`@/contracts` alias may shield some — verify), `vite.config.ts` aliases, `tsconfig` paths, and root build/test script filters.
- Do as one atomic commit; `pnpm install` to refresh links.
- **Acceptance:** `pnpm -r ls --depth -1` shows `@umutkorkmaz/contracts`, `@umutkorkmaz/ui`; zero remaining `@re-shell/contracts`/`@re-shell/ui` in any `package.json` or import (`grep -rn "@re-shell/\(contracts\|ui\)" packages apps` empty); all packages still build.

#### P1-06 — Fix CLI source emitters that hardcode `@re-shell/*` for generated/installed packages
**Effort:** M · **Deps:** P1-02 · **Parallel:** yes (with P1-05)
- Introduce a single constant/config (e.g. `packages/cli/src/utils/scope.ts` exporting `GENERATED_PKG_SCOPE = '@umutkorkmaz'`) and replace hardcoded `@re-shell/*` literals across the **15 files**: `src/utils/plugin-system.ts`, `service-integration.ts`, `config-client-frameworks.ts`, `change-impact-analyzer.ts`, `src/templates/index.ts`, `src/templates/backend/{microfrontend-orchestration,cross-framework-component-sharing,api-contract-testing,frontend-service-mesh-client,shared-config-server,realtime-data-sync,comprehensive-auth-service,universal-state-management}.ts`, `src/commands/ui.ts`, `src/commands/add.ts`.
- Note: `service-integration.ts` is dead code (unimported) — change or delete per the config/service section; do not block on it. For plugin-detection contract (`@re-shell/` prefix, `reshell-cli`/`reshell-plugin` manifest keys in `plugin-system.ts`), decide rebrand vs backward-compat detection here and document it (default: accept legacy AND new prefixes during transition).
- **Acceptance:** `grep -rn '@re-shell/' packages/cli/src` returns only intentional backward-compat detection (if any), each annotated; generated SDK imports emitted by `config-client-frameworks.ts`/templates use `@umutkorkmaz/*`; CLI build green; a smoke generate (one backend template) produces code with `@umutkorkmaz/*` imports.

#### P1-07 — Org-casing & branding-token sweep
**Effort:** S · **Deps:** P1-05, P1-06 · **Parallel:** no
- Normalize casing/branding tokens flagged across findings: contracts `README.md` title (`@re-shell/ui-contracts` → `@umutkorkmaz/contracts`), root/UI README scope references, root build/test script `--filter` names. Defer the `re-shell.dev` domain replacements and `.re-shell` dir naming to their owning sections (docs/config) — record them as out-of-scope-for-P1 to avoid scope creep.
- **Acceptance:** no `@re-shell/ui-contracts` token anywhere; contracts README title matches its `package.json` name; root scripts filter on `@umutkorkmaz/*`.

#### P1-08 — Update CLI hub adapter to local entrypoint + envelope-aware (rename reconciliation)
**Effort:** S · **Deps:** P1-02, P1-05, P1-13 · **Parallel:** no
- File: `packages/cli/src/utils/cli-adapters.ts:88,96,104,112`. Replace the literal `'re-shell'` PATH spawn with the locally-built entrypoint (`packages/cli/dist/index.js` resolved relative path) so the hub runs the monorepo build, not a globally-installed bin.
- Parse the `{ok,data,warnings}` envelope (consume `JsonResponse<T>` from `@umutkorkmaz/contracts`, P1-13) instead of raw line streaming. (Command-string correctness — `templates list`, `workspace graph --json` etc. — is fixed in P2; this task only fixes bin resolution + envelope parsing. Note `cli-adapters.ts` is currently test-only/dead per findings; reconcile or delete in P2 when the live invocation paths are fixed.)
- **Acceptance:** adapter no longer references `'re-shell'` from PATH; imports `JsonResponse` from `@umutkorkmaz/contracts`; `tests/unit/cli-adapters.test.ts` updated to reflect local-path spawn and passes.

---

### P1 — Contract Lock: `@umutkorkmaz/contracts` as single source of truth + zod

> All of the following depend on the package being renamed (P1-05) and in the monorepo (P1-03). P1-09 gates P1-10/P1-11/P1-13/P1-14.

#### P1-09 — Add zod to contracts; convert value-types to schema-derived
**Effort:** M · **Deps:** P1-05 · **Parallel:** no (gates contract tasks)
- File: `packages/contracts/src/re-shell.ts` (split into modules under `packages/contracts/src/` if it grows). Add `zod` as a real dependency (currently only `typescript` devDep).
- For every type that crosses a process boundary, author a zod schema and derive the TS type via `export type X = z.infer<typeof xSchema>` so types/validators cannot drift: `WorkspaceSummary`, `WorkspaceApp`, `WorkspaceService`, `GitSummary`, `TemplateSummary`, `HealthSummary`, `HealthCheck`, `JobRecord`, `CommandSpec`, `WorkspaceNodeStatus`/`PackageManager` enums.
- Add a shared `Argv = z.array(z.string())` reused by `TemplateSummary.command` and `CommandSpec.command`.
- **Acceptance:** `@umutkorkmaz/contracts` builds with `zod` dependency declared; each listed type is `z.infer`-derived; `tsc --noEmit` clean; `dist/` emits both runtime schemas and `.d.ts`.

#### P1-10 — Add the JSON response envelope to contracts (canonical wire format)
**Effort:** M · **Deps:** P1-09 · **Parallel:** yes (with P1-11)
- File: `packages/contracts/src/re-shell.ts` (or `envelope.ts`). Define `JsonSuccess<T> = { ok: true; data: T; warnings: string[] }`, `JsonError = { ok: false; error: { code: ErrorCode; message: string; details?: Record<string,unknown> } }`, `JsonResponse<T>`, and a generic `jsonResponseSchema(dataSchema)` helper, mirroring `packages/cli/src/utils/json-output.ts:3-18`.
- **Acceptance:** envelope types + generic schema exported from `@umutkorkmaz/contracts`; `jsonResponseSchema(workspaceSummarySchema).safeParse(...)` round-trips a valid envelope and rejects a malformed one in a unit test.

#### P1-11 — Centralize the error-code taxonomy in contracts
**Effort:** S · **Deps:** P1-09 · **Parallel:** yes (with P1-10)
- Create the canonical `ErrorCode` union from the **9** distinct codes actually emitted (verified, not 10): `NOT_IN_MONOREPO`, `LIST_WORKSPACES_ERROR`, `GRAPH_GENERATION_ERROR`, `WORKSPACE_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `INVALID_VARIABLES`, `NOT_IN_RESHELL_PROJECT`, `APPS_DIR_NOT_FOUND`, `LIST_MICROFRONTENDS_ERROR`. Export as a zod enum + TS union from `@umutkorkmaz/contracts`.
- **Acceptance:** `ErrorCode` exported; new codes are added here, not ad hoc. (Wiring `jsonError`'s `code` param to this type is done in P1-12.)

#### P1-12 — Make the CLI consume contracts instead of re-declaring the envelope
**Effort:** S · **Deps:** P1-10, P1-11 · **Parallel:** no
- File: `packages/cli/src/utils/json-output.ts`. Replace the locally-declared `JsonSuccess`/`JsonError`/`JsonResponse` (lines 3-18) with imports from `@umutkorkmaz/contracts`; type `jsonError`'s `code` to `ErrorCode`. Add `@umutkorkmaz/contracts` as a CLI dependency.
- Do NOT re-implement the `enableJsonMode` behavioral fixes here (those are P2/P0-safety in other sections) — this task is purely the type-source switch.
- **Acceptance:** `packages/cli/src/utils/json-output.ts` imports envelope + `ErrorCode` from `@umutkorkmaz/contracts`; no duplicate envelope `interface`/`type` definitions remain in CLI; `jsonError('BAD_CODE', ...)` is a type error; CLI build green.

#### P1-13 — Replace blind casts with zod parse at live UI boundaries
**Effort:** S · **Deps:** P1-09, P1-10 · **Parallel:** yes
- Files: `packages/ui/src/hub/ws-client.ts:32` (stop swallowing parse errors — `safeParse`, surface failures via an `onError` callback instead of `// ignore parse errors`), and the live SSE consumer in `packages/ui/src/components/domain/health.ts` (the live `EventSource` path) — `safeParse` the parsed payload against the contract schema before use.
- Note for the section consumer: the hub double-wraps (`{type:'stdout',content:<cli json>}`) — the unwrap-then-parse fix is owned by the transport section (P3); here, only swap the cast for a schema parse at the existing parse site.
- **Acceptance:** no `as WsServerMessage`/`as HealthSummary` blind casts at these sites; parse failures are observable (logged/surfaced), not silently dropped; UI builds.

#### P1-14 — Fix the no-op `CommandSpecInput` Omit
**Effort:** S · **Deps:** P1-09 · **Parallel:** yes
- File: `packages/contracts/src/re-shell.ts:112-125`. `Omit<CommandSpec, 'commandText'>` strips a non-existent field. Either (a) add `commandText: string` to a `CommandSpecBase` and derive cleanly, or (b) delete the Omit and define `CommandSpecInput = CommandSpec & { commandText?: string }` with a doc comment that `commandText` is a derived display string. Update consumers `packages/ui/src/lib/command.ts:47-53` and `packages/ui/src/components/re-shell/command-preview.tsx`.
- **Acceptance:** no `Omit<…, 'commandText'>`; `CommandSpecInput` is intentional and documented; `command.test.ts` passes.

---

### P1 — Contract Doc Regeneration & Conformance Test

#### P1-15 — Regenerate `CLI-CONTRACTS.md` from real CLI output
**Effort:** S · **Deps:** P1-12, and the P2 producer fixes (cross-section dependency) · **Parallel:** no
- File: `packages/cli/docs/CLI-CONTRACTS.md` (currently 564 lines, aspirational — documents `templates list`, category-based `HealthSummary`, `workspace graph --json` with `{nodes,edges}` that don't match reality).
- Regenerate by running each `--json` command against the built `dist/index.js` and capturing actual envelope output; document the envelope contract (single-line `JsonResponse<T>`, `warnings[]`, no stderr in JSON mode), the 9-code error table, and the `@umutkorkmaz/contracts` types as the source of truth. Archive the old aspirational version.
- **Acceptance:** every shape/command in `CLI-CONTRACTS.md` is reproducible by running the documented command and `JSON.parse`-ing stdout; no documented command/flag is unregistered; the error-code table matches `ErrorCode`. (This task is sequenced AFTER P2 producers conform; listed here because the doc is part of the contract-lock deliverable.)

#### P1-16 — Add the contract-conformance regression test
**Effort:** M · **Deps:** P1-09, P1-10, P1-11, P1-12, and P2 producers · **Parallel:** no
- Add `packages/cli/tests/contract-conformance.test.ts` (vitest): for each `--json` command, spawn the built CLI in a fixture workspace, capture stdout, `JSON.parse` it (assert single-line/NDJSON), and validate against `jsonResponseSchema(<typeSchema>)` from `@umutkorkmaz/contracts` (`safeParse(...).success === true`). Include the spinner-leak regression: run `workspace list --json` (or its renamed equivalent) with `isTTY=true` and assert stdout is parseable (no `\x1b[?25l` prefix).
- Add `packages/contracts/__tests__/*.test.ts`: valid-fixture parses + malformed-rejects per schema; assert `z.infer` type identity.
- Wire both into the root `pnpm test` (which currently only ran the UI package filter) so CI runs them by default.
- **Acceptance:** every `--json` command output passes its contract schema in CI; malformed fixtures are rejected; `workspace list --json` TTY test passes; `pnpm -w test` (root) executes contracts + CLI conformance suites; failing a contract shape fails CI.

---

### Phase dependency summary

- **Gates:** P0-01/P0-02 → P1-01 → (P1-02 ∥ P1-03) → P1-04; P1-03 → P1-05; P1-05/P1-06 → P1-07; P1-05 → P1-09 → (P1-10 ∥ P1-11 ∥ P1-13 ∥ P1-14); P1-10+P1-11 → P1-12 → P1-08; P1-12 + P2-producers → P1-15 → P1-16.
- **Parallelizable clusters:** {P0-01, P0-02, P0-03, P0-04}; {P1-02, P1-03}; {P1-05, P1-06}; {P1-10, P1-11, P1-13, P1-14}.
- **Cross-section dependencies (not owned here):** P1-15 and P1-16 require the P2 CLI producer fixes (real `workspace info`/`health`/`templates`/`graph` `--json` emitters) to assert against; P1-13's full unwrap correctness depends on the P3 transport-framing fix. These are sequenced after their P2/P3 prerequisites land.

---

## Phase 2 — Make the CLI satisfy the contract (engine work)

This phase makes the shipped binary (`dist/index.js` ← `src/index.ts`) actually emit the machine-readable contract that the UI hub, Command Builder, and IDE tooling depend on. Every task here is grounded in verified live-run behavior, not source-reading assumptions. Phase 2 depends on the Phase 1 contract module (`P1-contract`) being available; tasks that touch generated-package scope assume the `@umutkorkmaz/*` rename constant exists.

**Cross-cutting invariants for every task below (the "JSON contract"):**
- A `--json` command emits exactly one single-line `JsonResponse<T>` envelope to **stdout** and nothing else on stdout.
- `{ok:false, ...}` MUST set a non-zero process exit code. (Today every JSON error path exits 0 — verified.)
- All spinner/progress/diagnostic chrome goes to **stderr** or is suppressed in JSON mode — never stdout.
- No raw `console.log(JSON.stringify(x, null, 2))` on a `--json` path. Pretty output is opt-in via `--pretty` only.

---

### P2-00 — Replace `enableJsonMode` monkey-patch with an explicit JSON writer
**Effort:** M
**Files:** `src/utils/json-output.ts`, new `src/utils/json-writer.ts` (or fold into existing)
**Depends on:** P1-contract (canonical envelope types)
**Parallel:** No — foundational; most P2 tasks build on it.

Replace the suppress-everything `enableJsonMode()` (`json-output.ts:41-67`) — which monkey-patches `process.stdout.write`/`console.*` and passes only chunks starting with `{`/`[` — with an explicit, opt-in writer. The current design silently drops Buffers, indented JSON, ANSI-prefixed writes, and any multi-line chunked write whose continuation does not start with `{`/`[` (verified: truncates output mid-object).

Implement:
```ts
export function emitJson<T>(res: JsonResponse<T>): void {
  process.stdout.write(JSON.stringify(res) + '\n'); // single-line NDJSON-friendly
}
export const ok = <T>(data: T, warnings: string[] = []): void =>
  emitJson({ ok: true, data, warnings });
export const fail = (code: ErrorCode, message: string, details?: Record<string, unknown>): void => {
  emitJson({ ok: false, error: { code, message, details } });
  process.exitCode = 1; // enforce non-zero on error
};
```
Keep a thin compat shim for `enableJsonMode`/`restoreJson` during migration, but stop patching `console.error` to a no-op (real errors must surface, routed through `fail()` or `warnings[]`).

**Acceptance:**
- `emitJson`/`ok`/`fail` exported; `fail()` sets `process.exitCode = 1`.
- No code path relies on the prefix-sniffing stdout patch for correctness.
- `details: undefined` is omitted from output (verified behavior preserved).
- Buffer writes and multi-line JSON are no longer silently dropped.

---

### P2-01 — Centralize and type the JSON error-code taxonomy
**Effort:** S
**Files:** new `src/utils/json-error-codes.ts`, `src/utils/json-output.ts`
**Depends on:** P1-contract
**Parallel:** Yes — independent of P2-00 internals (can develop alongside).

Create a `const` union of all error codes and type `fail()`/`jsonError()`'s `code` param to it. The 9 verified existing codes: `NOT_IN_MONOREPO`, `WORKSPACE_NOT_FOUND`, `TEMPLATE_NOT_FOUND`, `INVALID_VARIABLES`, `NOT_IN_RESHELL_PROJECT`, `APPS_DIR_NOT_FOUND`, `LIST_WORKSPACES_ERROR`, `GRAPH_GENERATION_ERROR`, `LIST_MICROFRONTENDS_ERROR`. Add new codes this phase needs: `TEMPLATES_LIST_ERROR`, `WORKSPACE_SUMMARY_ERROR`, `COMMANDS_LIST_ERROR`, `DOCTOR_ERROR`, `ANALYZE_ERROR`.

**Acceptance:**
- `ErrorCode` union exported and imported by `json-output.ts`.
- `fail('NOT_A_CODE', ...)` is a TypeScript compile error.
- `tsc --noEmit` exits 0.

---

### P2-02 — Fix the `workspace list --json` spinner leak (the reported bug)
**Effort:** S
**Files:** `src/groups/workspace.group.ts:44-60`, `src/commands/workspace.ts:39-41`
**Depends on:** none (can land before P2-00; full fix tightened by P2-00)
**Parallel:** Yes

The spinner is `createSpinner('Loading workspaces...').start()`-ed at `workspace.group.ts:46` BEFORE `listWorkspaces()` installs any stdout handling (`workspace.ts:40`). Verified: `workspace list --json 2>/dev/null` emits `⏳ Loading workspaces...` as a stdout line before the JSON, corrupting line-based parsers. Gate spinner creation on `!options.json`, mirroring the correct pattern already in `src/index.ts:347` (`options.json ? undefined : createSpinner(...)`) and `config.group.ts:1304`. Skip `spinner.stop/succeed` when json.

**Acceptance:**
- `workspace list --json` (TTY and non-TTY) produces stdout that is exactly one parseable JSON line.
- `RE_SHELL_NO_SPINNER=1 workspace list --json` produces no stdout chrome (currently this env makes the leak worse — verified).
- Regression test in `tests/unit` parses stdout with `JSON.parse`.

---

### P2-03 — Make `createSpinner` JSON/quiet-safe at the source
**Effort:** M
**Files:** `src/utils/spinner.ts:34-38,131-149`, all `createSpinner(...).start()` callsites in `src/groups/*`
**Depends on:** P2-00
**Parallel:** No — touches many group files; coordinate with P2-02.

Root-cause fix so individual callsites can't reintroduce the leak. In non-interactive mode, `spinner.ts:36` does `console.log(chalk.cyan('⏳'), options.text)` immediately — to stdout, before any JSON handling. Make `createSpinner` accept `{ json?: boolean }` (or auto-detect via a process-wide quiet flag set when `--json` is parsed), and in JSON/quiet mode emit **nothing** to stdout (route all spinner text to stderr regardless). Then sweep group actions (e.g. `workspace.group.ts:283,291`; graph also leaks a trailing `✅ Workspace graph generated successfully!` line — verified) to pass `{ json: options.json }` and skip `succeed`/`stop` text in JSON mode.

**Acceptance:**
- Grep shows every `createSpinner(...)` in a `--json`-bearing action receives the json flag (or relies on the global quiet flag).
- `workspace graph --format json` emits zero `⏳`/`✅` lines on stdout (verified both currently leak).
- All spinner output that remains goes to stderr.

---

### P2-04 — Fix `workspace health --json`: honor JSON on the no-config path + upward root search
**Effort:** S
**Files:** `src/commands/workspace.ts:1299-1314,1689-1694`
**Depends on:** P2-00, P2-01
**Parallel:** Yes (after P2-00/P2-01)

Verified: `checkWorkspaceHealth` never calls any JSON path on the missing-config branch — it does `console.log(chalk.red('✗ No workspace configuration found'))` + tip + bare `return`, **regardless of `--json`, and exits 0** (false success). It also reads `re-shell.workspaces.yaml` from `process.cwd()` only (no upward search), unlike list/graph. Fix:
1. On missing config with `options.json`: `fail('WORKSPACE_NOT_FOUND', 'No workspace configuration found', {...})` (non-zero exit), else keep human text.
2. Resolve config via `findMonorepoRoot()` instead of cwd-only.
3. Apply the same human-text-on-error fix to the sibling early-returns at `workspace.ts:974, 1733, 2078`.

**Acceptance:**
- `workspace health --json` in a non-workspace dir emits a single `{ok:false,error:{code:"WORKSPACE_NOT_FOUND",...}}` line and exits non-zero.
- Running from a subdirectory of a monorepo resolves the root config.
- Happy path still emits `{ok:true,data:{score,status,checks[]}}` (see P2-06 for shape normalization).

---

### P2-05 — Real `workspace graph --json` emitting `{apps, services}`
**Effort:** M
**Files:** `src/commands/workspace.ts:268-407` (lightweight `generateWorkspaceGraph`), `src/groups/workspace.group.ts:276-293`
**Depends on:** P2-00, P2-01, P2-03
**Parallel:** Yes (after deps)

Two verified problems: (1) the lightweight `graph` subcommand accepts only `--format json`, not `--json` (so the hub's `workspace graph --json` errors `unknown option '--json'`); (2) it emits `{nodes, edges}`, never the contract's `{apps, services}`. The graph derives purely from `getWorkspaces()` (no yaml needed) — keep that zero-config source.

1. Add a `--json` flag (alias of `--format json`) to the `graph` subcommand.
2. Add an `{apps, services}` projection alongside (or replacing, per contract) `{nodes, edges}`: partition `getWorkspaces()` results by `type` (apps vs services), each entry carrying `{name, path, framework, dependencies[]}`; preserve internal dependency edges. Document that external deps are dropped and node identity is keyed by package `name` (verified current behavior).
3. Emit via `ok(...)` (single-line envelope), no spinner chrome.

**Acceptance:**
- `workspace graph --json` and `workspace graph --format json` both succeed and emit a single-line `{ok:true,data:{apps:[...],services:[...]}}` envelope.
- Works in a pnpm/npm workspace with no `re-shell.workspaces.yaml` present (verified zero-config source works today).
- No `⏳`/`✅` chrome on stdout.

---

### P2-06 — Align `workspace health --json` to one normalizer `{score, status, checks[]}`
**Effort:** M
**Files:** `src/commands/workspace.ts:1689-1694` (lightweight `displayHealthResults`), `src/utils/workspace-health.ts:40-58` (rich `WorkspaceHealthReport`), new `src/utils/health-normalizer.ts`
**Depends on:** P2-00, P2-01, P2-04
**Parallel:** No — defines the canonical shape consumed downstream.

Two divergent health shapes exist: lightweight `{checks:[{name,status,message,details?}], overall:'healthy'|'critical'|'degraded'}` vs rich `{overall:{status,score,summary}, categories[], recommendations[], metrics}`. The contract requires ONE normalizer. Create `normalizeHealth()` producing `{ score: number, status: 'healthy'|'degraded'|'critical', checks: Array<{name, status, message, details?}> }`. Map the rich report's `categories`→`checks` and `overall.score`→`score`; for the lightweight path, derive a numeric `score` from check severities. Wire `workspace health --json` to emit the normalized shape via `ok(...)`.

**Acceptance:**
- `workspace health --json` (happy path) emits `{ok:true,data:{score,status,checks:[...]}}` — exactly the contract shape.
- `score` is a number 0–100; `status` is one of the three enum values.
- A unit test asserts both lightweight and rich engines normalize to the identical schema.

---

### P2-07 — Add `workspace --json` producing a full `WorkspaceSummary`
**Effort:** M
**Files:** `src/groups/workspace.group.ts:21-22` (base command has no action), `src/commands/workspace.ts` (new `summarizeWorkspace`)
**Depends on:** P2-00, P2-01, P2-05, P2-06, P2-09
**Parallel:** No — composes graph + health + list outputs.

Verified: bare `workspace` has only `.description()`, no `.action()` → `workspace --json` errors `unknown option '--json'`; no `WorkspaceSummary` type exists anywhere. Add an action to the base `workspace` command (or a `workspace summary` subcommand — pick one and make the hub call it) that composes a single `WorkspaceSummary` envelope:
```
{ root, packageManager, workspaces: WorkspaceInfo[], graph: {apps, services}, health: {score, status, checks[]} }
```
Source it from `getWorkspaces()` + the P2-05 graph projection + a yaml-free P2-06 health pass — zero-config, derived purely from package metadata (`getWorkspaces()` reads `package.json#workspaces`/`pnpm-workspace.yaml`). The `WorkspaceSummary` type lives in `@umutkorkmaz/contracts` (P1) and is imported here.

**Acceptance:**
- `workspace --json` (or `workspace summary --json`) emits a single-line `{ok:true,data:WorkspaceSummary}` envelope.
- Runs zero-config in `re-shell-ui` (has only `pnpm-workspace.yaml`) and returns populated `workspaces`, `graph`, `health`.
- Errors (not in a monorepo) emit `{ok:false,error:{code:"NOT_IN_MONOREPO"|"WORKSPACE_SUMMARY_ERROR",...}}` with non-zero exit.

---

### P2-08 — Auto-derive `WorkspaceDefinition` from `getWorkspaces()` (bridge for rich engines)
**Effort:** S
**Files:** new `src/utils/workspace-definition-adapter.ts`, consumed by `src/commands/workspace-graph.ts`, `src/commands/workspace-health.ts`
**Depends on:** P2-01
**Parallel:** Yes

The rich engines (`WorkspaceDependencyGraph`, `WorkspaceHealthChecker`) require a hand-written `re-shell.workspaces.yaml` matching `workspace-schema.ts`; verified the committed sample yaml matches none of the three coexisting schemas and rich `graph-analysis`/`diagnostics` fail on it. Build an adapter `toWorkspaceDefinition(workspaces: WorkspaceInfo[], root: string): WorkspaceDefinition` so the rich engines run without yaml when none exists. This also lets P2-06's normalizer feed the rich health checker zero-config.

**Acceptance:**
- `toWorkspaceDefinition()` produces a `WorkspaceDefinition` that passes `workspace-schema.ts` validation.
- `workspace graph-analysis analyze` and `workspace diagnostics check` succeed in a yaml-free repo by falling back to the adapter.
- Unit test feeds `getWorkspaces()` output through the adapter into the rich graph engine and asserts cycles/topo-order compute.

---

### P2-09 — Register `templates list --json` → normalized `TemplateSummary[]`
**Effort:** M
**Files:** new `src/groups/templates.group.ts`, `src/index.ts:462-476` (registration), `src/templates/backend/index.ts:465-479` (add `toTemplateSummary` mapper)
**Depends on:** P2-00, P2-01, P1-contract (`TemplateSummary` type)
**Parallel:** Yes

Verified: no top-level `templates`/`template` command exists (only a deprecated alias to `generate` + `workspace template`/`config template` subcommands); the 205-framework `BackendTemplate` registry has NO list command at all; and the new UI adapter calls `re-shell templates list --json` which errors `unknown command`. Build it:
1. Add `toTemplateSummary(t: BackendTemplate): TemplateSummary` (`{id,name,displayName,description,language,framework,version,tags,features,port,fileCount}`) in `src/templates/backend/index.ts`.
2. New `src/groups/templates.group.ts` registering `templates list [--json] [--language <l>] [--framework <f>]` and `templates show <id> [--json]`, backed by `listBackendTemplates()`/`getBackendTemplate()`.
3. Register `registerTemplatesGroup(program)` in `src/index.ts`.
4. Emit `TemplateSummary[]` via `ok(...)`; `templates show` on unknown id → `fail('TEMPLATE_NOT_FOUND', ...)`.

**Acceptance:**
- `templates list --json` emits `{ok:true,data:TemplateSummary[]}` with all 205 registry entries (filterable by language/framework).
- `templates show express --json` returns one `TemplateSummary`; `templates show express-ts --json` → `{ok:false,error:{code:"TEMPLATE_NOT_FOUND"}}` non-zero exit.
- The hub adapter call (P2-15) resolves against this real command.

---

### P2-10 — Fix `config template list --json` empty-output bug
**Effort:** S
**Files:** `src/groups/config.group.ts:1292-1320`, `src/commands/workspace.ts:2249-2342` (`manageWorkspaceTemplates`→`listTemplates`)
**Depends on:** P2-00
**Parallel:** Yes

Verified CRITICAL: `config template list --json` produces **0 bytes** of output. `config.group.ts:1302` calls `enableJsonMode()` (patching `console.log` to no-op) then `listTemplates` (`workspace.ts:2294-2341`) emits only via `console.log` and never `jsonSuccess` → everything suppressed. Thread `json` into `listTemplates`/`manageWorkspaceTemplates` and emit via `ok(...)`; route the catch at `workspace.ts:2286` (currently `console.error`, swallowed under the patch) through `fail('TEMPLATES_LIST_ERROR', ...)`.

**Acceptance:**
- `config template list --json` emits a non-empty single-line `{ok:true,data:[...]}` envelope (workspace scaffolds).
- Error path emits `{ok:false,...}` to stdout (not swallowed `console.error`) with non-zero exit.
- This command lists workspace scaffolds; framework templates are P2-09 (documented distinction).

---

### P2-11 — Register `doctor`, `analyze`, `completion` as top-level commands
**Effort:** S
**Files:** `src/index.ts:77-85,462-480`, `src/commands/doctor.ts:23`, `src/commands/analyze.ts:53`, `src/commands/completion.ts:60`
**Depends on:** P2-00, P2-01, P2-12 (analyze collision rename)
**Parallel:** No (blocked by P2-12 for analyze; doctor/completion independent)

Verified: `runDoctorCheck`, `analyzeProject` (command-level), and `installCompletion` are complete, maintained handlers (doctor was rebuilt today with `--json` support) but imported by **nothing** in the live entry — running them returns `error: unknown command`. Wire them:
1. `program.command('doctor')` → `runDoctorCheck`, options `--fix --verbose --json` (mirror `DoctorOptions`, `doctor.ts:16-21`).
2. `program.command('analyze')` → renamed `runProjectAnalysis` (P2-12), options per `AnalyzeOptions` (`analyze.ts:53`).
3. `program.command('completion')` → `installCompletion`, option `--shell <bash|zsh>` (`completion.ts:9-11`).
Audit each handler's `restoreJson`/emit ordering against P2-00 (doctor uses the try/finally pattern; ensure error paths route through `fail()`).

**Acceptance:**
- `re-shell doctor`, `re-shell analyze`, `re-shell completion` all resolve (no `unknown command`).
- `doctor --json` emits a valid envelope; `doctor --json` failure exits non-zero.
- `completion --shell zsh` installs the existing `dist/completions/zsh` script.

---

### P2-12 — Resolve the `analyzeProject` name collision before wiring analyze
**Effort:** XS
**Files:** `src/commands/analyze.ts:53` (rename export), its sole caller
**Depends on:** none
**Parallel:** Yes — but is a hard dependency of P2-11's analyze wiring.

Two distinct exported `analyzeProject` functions exist: the orphaned command-level one (`src/commands/analyze.ts:53`) and the live util (`src/utils/framework-detection.ts:265`, already used by `tools.group.ts:26` and `workspace analyze`). Rename the command-level export to `runProjectAnalysis` to prevent wrong-import bugs when P2-11 wires it.

**Acceptance:**
- `src/commands/analyze.ts` exports `runProjectAnalysis`; no remaining import of the old name.
- `tsc --noEmit` exits 0; `tools detect` still calls the util `analyzeProject` (unchanged).

---

### P2-13 — Refresh `RE_SHELL_COMMANDS` completion list from the live tree
**Effort:** S
**Files:** `src/commands/completion.ts:13-24`
**Depends on:** P2-11, P2-14 (catalog walker is the ideal source)
**Parallel:** Yes (after P2-11)

Verified: the generated completion `RE_SHELL_COMMANDS` array advertises `analyze`, `completion`, `doctor`, plus unreachable flat names (`auth`, `deploy`, `i18n`, `microservice`, `scaffold`). Once completion is wired, tab-completion would suggest commands that error. Derive `RE_SHELL_COMMANDS` by walking `program.commands` (reuse the P2-14 catalog walker) so completion never advertises unreachable commands.

**Acceptance:**
- `RE_SHELL_COMMANDS` contains exactly the live top-level commands + 15 groups.
- No stale flat names (`auth`/`deploy`/`i18n`/`microservice`/`scaffold`) remain.
- After P2-11, `analyze`/`doctor`/`completion` ARE present and reachable.

---

### P2-14 — Build `commands list --json` metadata producer for the Command Builder
**Effort:** L
**Files:** new `src/groups/commands.group.ts` (or `src/commands/commands-list.ts`), `src/index.ts` registration, new `src/utils/command-catalog.ts` (tree walker)
**Depends on:** P2-00, P2-01
**Parallel:** Yes — independent producer; consumers (UI/IDE/docs) depend on it.

There is no catalog endpoint; the Command Builder, hub allowlist, and IDE autocomplete all need one. Build `src/utils/command-catalog.ts` that walks the runtime Commander tree (`program.commands`, recursing nested subgroups — `plugin` ~73, `workspace` 13 subgroups, `config profile` 30+ leaves) and emits per-command metadata:
```
{ path, aliases[], description, args[], flags: [{name, description, default, takesValue}],
  supportsJson, supportsDryRun, destructive }
```
Derive `supportsJson`/`supportsDryRun` from declared options; mark `destructive: true` for known verbs (uninstall, delete, clear-*, rollback, restore, `service down`). Register `commands list --json` to emit the full catalog via `ok(...)`.

**Acceptance:**
- `commands list --json` emits `{ok:true,data:Command[]}` covering all 9 standalone + 15 groups and their nested subcommands.
- Each entry reports accurate `flags`, `supportsJson`, `supportsDryRun`, `destructive`.
- Output is a single parseable JSON line; a snapshot test locks the tree against drift.
- Consumable as the source for P2-13 (completion), hub allowlist (P3), and IDE autocomplete (P9).

---

### P2-15 — Fix `cli-adapters.ts` to call real commands/flags + parse the envelope
**Effort:** S
**Files:** `src/utils/cli-adapters.ts:88-113`, `tests/unit/cli-adapters.test.ts`
**Depends on:** P2-05, P2-07, P2-09, P2-04/P2-06, P1-contract (scope/bin rename)
**Parallel:** No — depends on the producer tasks landing.

Verified: 3 of 4 adapter calls target non-existent commands/flags — `workspace graph --json` (real: `--format json` / now `--json` via P2-05), `templates list --json` (no such command until P2-09), `workspace --json` (no producer until P2-07). Only `workspace health --json` resolves, and it's broken (P2-04). Also the adapter hardcodes the literal `'re-shell'` bin (`:88,96,104,112`); reconcile with the `@umutkorkmaz/*` rename and prefer the local built entrypoint over a globally-installed bin. Rewrite all four adapters to the corrected commands, switch from raw line streaming to parsing the `{ok,data,error}` envelope (checking exit code AND `ok`), and add real tests.

**Acceptance:**
- All four adapters invoke commands/flags that exist and return parseable envelopes.
- Adapters surface `{ok:false}` (and non-zero exit) as a typed error, not a silent empty result.
- `cli-adapters.test.ts` passes (note: 4 of 10 existing tests currently FAIL — `echo -e` portability bug on macOS — fix those too).
- Bin resolution targets the renamed `@umutkorkmaz` bin / local build, not a literal global `re-shell`.

---

### P2-16 — Make all existing JSON error paths exit non-zero
**Effort:** S
**Files:** `src/utils/json-output.ts` (`jsonError`), audit all `jsonError(` callsites (9 codes, ~15 sites)
**Depends on:** P2-00, P2-01
**Parallel:** Yes

Verified contract bug: `workspace list --json`, `workspace graph --format json`, and others return `{ok:false,...}` while exiting **0** — a machine consumer checking the exit code cannot distinguish success from failure. Make `jsonError()` (and the new `fail()`) set `process.exitCode = 1`. Audit the ~15 `jsonError(` sites to ensure none also call `process.exit(0)` afterward.

**Acceptance:**
- Every `{ok:false}` emission results in a non-zero process exit code.
- `workspace list --json` from a non-monorepo dir exits non-zero with `{ok:false,error:{code:"NOT_IN_MONOREPO"}}`.
- A test asserts exit code correlation with the `ok` field across all adopters.

---

### P2-17 — Fix `restoreJson` emit-before-restore ordering bugs
**Effort:** S
**Files:** `src/groups/tools.group.ts:81-97` (di-analyze), audit all ~22 `restoreJson()` sites
**Depends on:** P2-00
**Parallel:** Yes

Verified: `tools.group.ts` di-analyze calls `restoreJson()` at `:83` BEFORE the JSON emit at `:97` (works by luck; a `console.log` emit there would silently break). Also `tools.group.ts:97` emits bare `JSON.stringify(jsonGraph, null, 2)` with no envelope. Fix the ordering (wrap the emit), convert to `ok(...)`, and audit all `restoreJson()` callsites for emit-before-restore. Post-P2-00, prefer migrating these to the explicit writer (no patch to restore).

**Acceptance:**
- `tools di-analyze --json` (or equivalent) emits a single-line enveloped JSON line, not multi-line bare JSON.
- No `restoreJson()` site emits JSON after restore in a way that depends on the patch.
- Grep confirms no remaining `JSON.stringify(x, null, 2)` on `--json` paths in `tools.group.ts`.

---

### P2-18 — Delete dead JSON utilities
**Effort:** XS
**Files:** `src/utils/json-output.ts:24-35` (`createJsonWriter`), `:88-90` (`isJsonMode`)
**Depends on:** P2-00, P2-15 (no callers remain)
**Parallel:** No — must run after migration so nothing references them.

Verified dead/misleading: `createJsonWriter()` declares `isMode` it never reads and forwards everything unfiltered (doc claims it "only outputs valid JSON" — false); zero callers. `isJsonMode()` scans global `process.argv` (footgun: `--type=--json` false-positive) while every adopter uses Commander's `options.json`; zero callers. Delete both once migration completes.

**Acceptance:**
- `createJsonWriter` and `isJsonMode` removed; grep confirms zero references.
- `tsc --noEmit` exits 0.

---

### P2-19 — Phase 2 contract regression tests
**Effort:** M
**Files:** new `tests/unit/json-contract.test.ts`, extend `tests/unit/cli-adapters.test.ts`
**Depends on:** P2-02, P2-04, P2-05, P2-06, P2-07, P2-09, P2-10, P2-14, P2-16
**Parallel:** No — validates the whole phase.

Lock the contract with tests covering the exact failure modes verified this phase:
- `workspace list/summary/graph/health --json` each produce exactly one `JSON.parse`-able stdout line (faked-TTY `process.stdout.isTTY=true` to lock the spinner fix).
- No-config and bad-schema paths emit `{ok:false}` envelopes with **non-zero exit** (the precise spots that break today).
- `templates list --json` returns all 205 entries; `templates show <bad>` errors correctly.
- `commands list --json` snapshot covers the full tree.
- Envelope invariants: single-line, `details` omitted when undefined, NDJSON-friendly `\n` terminator.

**Acceptance:**
- All listed commands have a parseable-JSON + correct-exit-code assertion.
- A faked-TTY regression test for the `workspace list --json` spinner leak.
- Coverage for the JSON contract paths ≥ 80%.

---

### Execution notes & parallelism map
- **Foundational first (sequential):** P2-00 → then everything. P2-01 and P2-12 can develop in parallel with P2-00.
- **Fully parallel after P2-00/P2-01:** P2-02, P2-04, P2-05, P2-08, P2-09, P2-10, P2-14, P2-16, P2-17.
- **Serial chains:**
  - P2-03 (spinner source fix) coordinates with P2-02; both feed P2-05/P2-07.
  - P2-06 (health normalizer) → P2-07 (summary composes graph+health) → P2-15 (adapters consume).
  - P2-12 → P2-11 (analyze wiring) → P2-13 (completion list refresh, also wants P2-14).
  - P2-14 (catalog) feeds P2-13, the P3 hub allowlist, and P9 IDE autocomplete.
  - P2-18 (delete dead utils) and P2-19 (regression tests) run last.
- **Highest-value / lowest-effort wins to schedule early:** P2-02 (the named bug), P2-10 (zero-byte output), P2-11 (four dead-on-arrival commands), P2-16 (exit-code contract).

---

## Phase 3–4 — Secure Transport + UI Fork Resolution + Package Build

This section closes the local-RCE transport surface, builds a typed allow-listed command adapter, reconciles the React/shadcn fork with the Web Components layer, and produces a publishable `@umutkorkmaz/ui` build. It assumes the locked owner decisions: shadcn React is the delivery model, `@umutkorkmaz/*` scope everywhere, single pnpm monorepo, Web Components retired.

> **Working-tree caveat (load-bearing).** The adversarial verdicts established that the committed `HEAD` of the UI repo is already React-first and correctly exported (`packages/ui/src/index.ts` exports `./components/ui`, `./components/re-shell`, `./contracts`, `./lib`; `package.json` is `0.2.2`, "Shadcn-first React component library"; `vite.config.ts` uses `@vitejs/plugin-react` + `vite-plugin-dts`). The Web-Components-only state (entry exports custom elements, `version 0.1.0`, broken build) is an **uncommitted working-tree regression** plus untracked overlay files. Task **P3-00** resolves this divergence first; every later task targets the reconciled tree. Do not treat the WC-only state as the baseline to rebuild from — it is a regression to discard or reconcile.

All paths are relative to the merged monorepo. Until the merge (decision #3) lands, CLI paths live in `re-shell-cli/` and UI paths in `re-shell-ui/`; after merge, both collapse under one workspace root. Task IDs referencing the merge depend on it explicitly.

---

### P3-00 — Reconcile working-tree divergence (baseline gate)
**Effort:** S · **Deps:** none · **Parallel:** no (blocks all of Phase 3–4)
**Files:** `re-shell-ui/packages/ui/src/index.ts`, `re-shell-ui/packages/ui/package.json`, `re-shell-ui/packages/ui/vite.config.ts`, `re-shell-ui/apps/web/src/App.tsx`, `re-shell-ui/apps/web/src/main.tsx`, untracked: `apps/web/src/hub-server.ts`, `apps/web/src/vite-env.d.ts`, the entire untracked WC overlay (`components/atomic/*`, `components/domain/*`, `components/layout/*`, `hub/index.ts`, `lib/cn.ts`, `lib/styles.ts`, `components/index.ts`, `tests/components.test.ts`)

Decide and execute the reconciliation: restore the committed React-first `index.ts`/`package.json`/`vite.config.ts` (discard the WC-only regression in the working tree), and explicitly classify each untracked file as **salvage** (transport logic, hub-server) or **delete** (WC overlay). Commit the reconciled baseline so downstream tasks operate on a known state.

**Acceptance:**
- `git status` shows no uncommitted regression of `packages/ui/src/index.ts`, `package.json` (back to `0.2.2`+ React description), `vite.config.ts`.
- The React-first entry re-exports `./components/ui`, `./components/re-shell`, `./contracts`, `./lib`.
- Untracked files are either committed (hub-server, vite-env) or removed (WC overlay), with no `??` entries left for the WC layer.
- A short reconciliation note in the PR description lists every salvaged vs deleted file.

---

## Phase 3 — Secure Transport

The hub is an unauthenticated local-RCE gateway: `spawn(..., { shell: true })` on browser-supplied commands via both SSE `GET /events` and WS `/jobs`, `Access-Control-Allow-Origin: '*'`, no auth token, unvalidated `cwd`. These are P0/P1.

### P3-01 — Process lifecycle safety: register hub child + signal teardown
**Effort:** S · **Deps:** P3-00 · **Parallel:** yes (independent of P3-02..P3-09)
**Files:** `re-shell-cli/src/commands/ui.ts` (spawn/cleanup block ~`:290-343`), `re-shell-cli/src/utils/error-handler.ts` (`createAsyncCommand` `:61-74`, `processManager.addCleanup` `:20`)

Register the spawned hub child with `processManager.addCleanup`, and add SIGINT/SIGTERM handlers in `createAsyncCommand`/`launchUi` so the hub is always torn down. Replace the blunt `hubProcess.kill()` with a call into the hub's own `stopHubServer` path where reachable, or at minimum SIGTERM-then-SIGKILL with a drain timeout. Also fix `setupStreamErrorHandlers` swallowing `unhandledRejection` without exiting (`error-handler.ts:55-57`) so a post-spawn rejection cannot orphan the hub.

**Acceptance:**
- Killing the parent CLI with SIGINT/SIGTERM leaves no hub process listening on the hub port (verified by a test that spawns, signals, then polls the port).
- Hub child is registered via `processManager.addCleanup`.
- `unhandledRejection` after hub spawn triggers cleanup, not a silent continue.

### P3-02 — Per-launch session token: generate, thread, enforce
**Effort:** M · **Deps:** P3-00 · **Parallel:** partially (token generation/threading parallel with P3-03; enforcement coordinates with P3-04)
**Files:** `re-shell-cli/src/commands/ui.ts` (env block `:227-238`), hub `apps/web/src/hub-server.ts` (routes `:103-130`, `:176-234`), clients `packages/ui/src/hub/sse-client.ts`, `packages/ui/src/hub/ws-client.ts`, terminal/consumer code

Generate a per-launch token in the CLI via `crypto.randomBytes`. Thread it as `RE_SHELL_UI_HUB_TOKEN` (to the hub spawn env) and `VITE_RE_SHELL_UI_HUB_TOKEN` (to the dashboard build env). Enforce it on **every** hub route: `/events` (header or query param — note the `<img>`/top-level-navigation GET vector flagged by the verdict, so a query-param fallback plus an `Accept`/`Sec-Fetch` guard is required, not header-only), `/jobs` (first WS message or `Sec-WebSocket-Protocol`), `/status`, `/health`. Reject with 401/close otherwise. Define the token handoff for the **standalone daemon** launch path (not just vite `import.meta.env`) — write the token where the same-origin client can read it after origin validation.

**Acceptance:**
- Requests without the correct token to `/events`, `/jobs`, `/status` are rejected (401 for HTTP, close with policy code for WS).
- A bare `<img src="http://127.0.0.1:PORT/events?command=...">` without a token does not execute anything.
- Token is present in both hub env and dashboard env; the dashboard health indicator goes online.
- Negative tests assert rejection on missing/wrong token for all routes.

### P3-03 — Env handoff fix: set `VITE_RE_SHELL_UI_HUB_URL`
**Effort:** XS · **Deps:** P3-00 · **Parallel:** yes
**Files:** `re-shell-cli/src/commands/ui.ts` (env block `:227-238`, plan `hubUrl` at `:213,224`), `re-shell-ui/apps/web/src/main.tsx` (`:29,32`)

Pass `VITE_RE_SHELL_UI_HUB_URL: plan.hubUrl` in the launch env so the dashboard health poll (`if (!hubUrl) return`) actually fires.

**Acceptance:**
- With the hub running, the dashboard hub indicator reads online, not `(offline)`.
- A test asserts `VITE_RE_SHELL_UI_HUB_URL` is present in the env handed to the vite child.

### P3-04 — Origin/Host allowlist + drop CORS `*`
**Effort:** S · **Deps:** P3-02 · **Parallel:** no (shares hub route code with P3-02)
**Files:** `re-shell-ui/apps/web/src/hub-server.ts` (`:71`, `:122`, WS upgrade handler)

Replace `Access-Control-Allow-Origin: '*'` (both `:71` and `:122`) with an exact-origin allowlist (the dashboard's dev/prod origin). Validate `Origin`/`Host` on the WS upgrade to block DNS-rebinding. WS is not CORS-gated by the browser, so the explicit Origin check on upgrade is the real control.

**Acceptance:**
- Cross-origin `fetch`/`EventSource` from a disallowed origin is rejected.
- WS upgrade from a disallowed `Origin` is refused before any spawn.
- No `Access-Control-Allow-Origin: '*'` remains in `hub-server.ts`.

### P3-05 — Typed allow-listed command adapter (replace free-form execution)
**Effort:** L · **Deps:** P3-00, P3-08 (contract envelope) · **Parallel:** no (core P0; gates P3-06)
**Files:** `re-shell-ui/apps/web/src/hub-server.ts` (SSE handler `:103-130`, WS handler `:176-234`), `packages/contracts/src/re-shell.ts` (`CommandSpec` `:111-121`), new registry module (e.g. `apps/web/src/hub/command-registry.ts` or, post-merge, `src/hub/command-registry.ts`)

Define a `CommandSpec` registry mapping stable command IDs to fixed argv templates with typed, validated params (reuse `CommandSpec` at `re-shell.ts:111-121`). SSE and WS accept only `{ commandId, params }`; the server resolves to a vetted argv against the registry. Reject any request whose `commandId` is not registered or whose params fail schema validation. The hub may only ever invoke the `re-shell` CLI binary — never an arbitrary `command[0]`.

**Acceptance:**
- A request with an unregistered `commandId` is rejected without spawning.
- A request with a registered ID but invalid params is rejected with a validation error.
- Resolved argv is constructed only from the registry template + validated params (no browser string concatenated into argv).
- An injection string (`workspace; rm -rf ~`) as a param value is treated as a literal arg, never shell-interpreted.

### P3-06 — Remove `shell: true`; execute resolved argv directly
**Effort:** L · **Deps:** P3-05 · **Parallel:** no
**Files:** `re-shell-ui/apps/web/src/hub-server.ts` (`:128` SSE spawn, `:195` WS spawn)

Remove `shell: true` from both spawns. Execute the registry-resolved argv directly with an explicit binary and an array of args. With the allow-list in place, no browser-supplied string ever reaches a shell.

**Acceptance:**
- No `shell: true` remains in `hub-server.ts`.
- Both SSE and WS paths spawn via explicit `binary, args[]` from the resolved argv.
- A negative test confirms a shell metacharacter in a param does not spawn a subshell.

### P3-07 — Constrain `cwd`, hard-pin bind, per-socket job cleanup, fix output fan-out
**Effort:** M · **Deps:** P3-05 · **Parallel:** partially (cwd/bind/socket-cleanup independent of each other)
**Files:** `re-shell-ui/apps/web/src/hub-server.ts` (`cwd` from input `:107`,`:190`; bind `:32`,`:278`; WS close `:254-256`; `activeJobs` map `:35`; `broadcastToWs` `:207,215,222`; SSE exit code `:147-148`), `re-shell-cli/src/commands/ui.ts` (host normalization `:63-67`, hub spawn env `:280-282`)

Four hardening fixes flagged by the verdicts as missed/under-addressed:
1. **`cwd` containment** — resolve and realpath-check `cwd` against the workspace root; reject anything outside it. (Currently unvalidated even after an allow-list.)
2. **Hard-pin bind to `127.0.0.1`** in the hub itself, ignoring any caller-supplied host; remove the `options.host` override so the CLI cannot push the hub to `0.0.0.0`.
3. **Per-socket job association** — key `activeJobs` (or a secondary index) by originating WS socket; on `ws.on('close')` SIGTERM all children started by that socket. Stop the SSE-vs-WS asymmetry (SSE already kills on `req.on('close')`).
4. **Stop cross-client output leakage** — `broadcastToWs` currently fans every job's stdout/stderr to all sockets; scope output to the originating socket only. Also coerce SSE exit code (`code ?? 0`) to match the WS path.

**Acceptance:**
- A request with `cwd` outside the workspace root is rejected before spawn.
- The hub binds to `127.0.0.1` regardless of any `--host`/env input.
- Opening a WS, starting a long job, then disconnecting leaves no orphaned child (test: spawn `sleep`, disconnect, poll for child).
- Job stdout/stderr is delivered only to the originating socket; a second WS client receives nothing from the first client's job.
- SSE `exit` events always carry a numeric code.

### P3-08 — Typed envelope as single source of truth + multi-line JSON reassembly
**Effort:** M · **Deps:** P3-00 · **Parallel:** yes (independent of P3-01..P3-04; gates P3-05 consumers)
**Files:** `packages/contracts/src/re-shell.ts` (`WsServerMessage`/`SseEvent`/`WsClientMessage` `:85-109`, no-op `Omit` `:123`), `packages/ui/src/components/domain/terminal.ts` (local `JobMessage` `:7-12`, handler `:397`) — or its React successor, `packages/ui/src/hub/sse-client.ts` (`:47-48` double-stringify), `packages/ui/src/hub/ws-client.ts`, consumers `topology.ts:477-489` / `health.ts:367-375` (or React hook successors)

Make the contracts envelope (`{ type: 'stdout'|'stderr'|'exit'|'heartbeat'|'error', content?, code?, id?, ts? }`) the only message shape. Delete any local `JobMessage` re-declaration and import from `@umutkorkmaz/contracts`. The hub double-wraps each stdout line and consumers do bare `JSON.parse(event.data)` (reading the wrapper, so `response.apps` is always undefined) and the terminal expects `{type:'output',output}` while the server emits `{type:'stdout',content}` — align all of these. Add an unwrap + multi-line reassembly helper in the hub clients: buffer `content` across `stdout` events keyed by `id`, expose `onJson(parsed)` only after a complete JSON document or on `exit`. Fix `sse-client.ts:47-48` re-stringify and the no-op `Omit<CommandSpec, 'commandText'>` at `re-shell.ts:123`.

**Acceptance:**
- Topology/health consumers receive a single parsed domain object (`response.apps` is defined), not the `{type,content}` wrapper.
- A pretty-printed / chunk-split `--json` payload reassembles into one valid parsed object.
- Terminal renders stdout (reads `msg.content`, handles `stdout`/`stderr`).
- No component re-declares the envelope type; all import from `@umutkorkmaz/contracts`.
- The `Omit` no-op is resolved (either `commandText` added to `CommandSpec` or the `Omit` dropped); consumers re-typecheck clean.

### P3-09 — Make the hub actually launchable + SSE keepalive
**Effort:** S · **Deps:** P3-00 · **Parallel:** yes
**Files:** `re-shell-cli/src/commands/ui.ts` (spawn `:286-300`, dead `'node':'node'` ternary `:291`), `re-shell-ui/package.json` (build script / `tsx` dep), `re-shell-ui/apps/web/src/hub-server.ts` (SSE write path for keepalive)

The hub never starts today: the CLI spawns `node -r ts-node/register hub-server.ts` but neither `ts-node` nor `tsx` is installed, and no compiled `hub-server.js` exists. Fix by either (a) adding a UI build step that emits `hub-server.js` and spawning that with `node`, or (b) adding `tsx` as a real UI dependency and spawning `tsx hub-server.ts`. **Strongly prefer the post-merge approach (see P3-10): move the hub into the CLI package and ship compiled JS** — this also resolves the fragile `ws` resolution (cwd-dependent ESM bare import) and the `cwd: apps/web/src` brittleness. Fix the dead `pathExists(...) ? 'node' : 'node'` ternary. Add SSE keepalive comments (`: ping\n\n`) on an interval so SSE streams don't die behind proxies.

**Acceptance:**
- `re-shell ui` actually starts a reachable hub (health endpoint responds with the token).
- No reliance on an uninstalled `ts-node`/`ts-node/register`.
- Dead ternary removed.
- SSE connections receive periodic keepalive.

### P3-10 — (Decision-gated) Relocate hub into the CLI package as compiled JS
**Effort:** M · **Deps:** P3-00, monorepo merge (decision #3), P3-05/P3-06/P3-07 · **Parallel:** no
**Files:** new `re-shell-cli/src/hub/*` (the relocated server + command registry), retire `re-shell-ui/apps/web/src/hub-server.ts`, `re-shell-cli/src/commands/ui.ts` (spawn path), `re-shell-ui/apps/web/vite.config.ts` (dev hub plugin)

Per the open question in the findings: under the single-monorepo strategy, move the hub-server into the CLI package (`src/hub/`), spawn it as compiled JS shipped with the CLI, and have the dev vite plugin import the same module rather than reaching into `apps/web/src`. This eliminates the `ts-node`/`tsx` runtime dependency, the `ws` resolution fragility, and the untracked-`hub-server.ts` reproducibility risk in one move. The secure transport work (P3-05/06/07) lands in the relocated module.

**Acceptance:**
- A single hub implementation exists under the CLI package; `apps/web/src/hub-server.ts` is removed.
- The CLI spawns the compiled hub; the vite dev plugin imports the same module.
- All P3-05/06/07 security properties hold in the relocated module.
- No `ts-node`/`tsx` runtime dependency remains in the launch path.

---

## Phase 4 — UI Fork Resolution + Package Build

These tasks assume the reconciled React-first baseline (P3-00). The committed `HEAD` already has correct exports and a React vite config; the work here is the **scope rename**, the **build-dependency/CSS/types fixes** (which were broken even before the WC regression), and the **Web Components deletion + apps/web React refactor**.

### P4-01 — Rename `@re-shell/contracts` → `@umutkorkmaz/contracts`
**Effort:** S · **Deps:** P3-00 · **Parallel:** yes (with P4-02 once both name fields land; sequence the package-name field before consumers)
**Files:** `packages/contracts/package.json` (`name` `:2`), `packages/ui/package.json` (workspace dep `:46`), `packages/ui/src/contracts/index.ts` (`:1`), `packages/ui/src/hub/ws-client.ts` (`:1`), `packages/ui/src/components/domain/{health,topology}.ts` (or React successors), `apps/web/package.json`, root `package.json` build/test filter scripts

Rename the contracts package and update every importer. Note from the verdict: the UI repo is **uniformly** `@re-shell/*` today and resolves correctly via pnpm workspace symlinks — this is a planned cross-repo rename, not a present bug, so do it atomically with workspace dep specifiers updated together. Exports-map keys stay unchanged.

**Acceptance:**
- `grep -r '@re-shell/contracts'` over source returns zero hits.
- `pnpm install` resolves the renamed workspace dep; `tsc --noEmit` passes.
- Root `build`/`test` filter scripts reference `@umutkorkmaz/contracts`.

### P4-02 — Rename `@re-shell/ui` → `@umutkorkmaz/ui` (incl. aliases + scripts)
**Effort:** S · **Deps:** P3-00, P4-01 · **Parallel:** no (touches root scripts shared with P4-01)
**Files:** `packages/ui/package.json` (`name` `:2`), root `package.json` filter scripts (`--filter @re-shell/...`), `apps/web/package.json`, `apps/web/src/main.tsx` (`:8`,`:11`), `apps/web/vite.config.ts` (alias `find:` strings `:60-66`), root + `packages/ui` `components.json` aliases (`:13-19`), `apps/web/tsconfig.json` path mappings, `README.md`, docs

Rename the UI package everywhere it is referenced: package name, root filter scripts (critical — a stale `--filter @re-shell/ui` silently no-ops the build), apps/web deps/imports/aliases, both `components.json` alias blocks, tsconfig paths. **Keep exports-map keys** (`.`, `./styles.css`, `./components/ui`, `./components/re-shell`, `./lib`) unchanged so consumer import paths don't move.

**Acceptance:**
- `grep -r '@re-shell/ui'` (and `@re-shell/ui-web`, `@re-shell/ui-contracts`) over source returns zero hits.
- Root `pnpm build` runs both package builds (no silent no-op from a stale filter).
- apps/web dev server resolves `@umutkorkmaz/ui`.

### P4-03 — Fix build dependencies (tailwindcss/autoprefixer/postcss) + `@/` alias
**Effort:** M · **Deps:** P3-00 · **Parallel:** yes (independent of rename)
**Files:** `packages/ui/package.json` (devDeps `:38-60`), `packages/ui/postcss.config.cjs`, `packages/ui/vite.config.ts` (add `resolve.alias`), `packages/ui/tsconfig.json` (`@/*` paths `:6-9`)

`vite build` crashes with `Cannot find module 'tailwindcss'` because `postcss.config.cjs` requires `tailwindcss`/`autoprefixer` that aren't declared in `packages/ui`. Add `tailwindcss`, `autoprefixer`, `postcss` to devDeps. **Critical missed prerequisite from the verdict:** `vite.config.ts` has no `resolve.alias` for `@/*`, but all 16 `.tsx` files import `@/lib/utils` — add `resolve.alias = { '@': resolve(__dirname, 'src') }` or the React entry bundle fails at build time with unresolved `@/lib/utils`. Note the root `build` is partially failing today (contracts builds, ui crashes); this fixes the whole chain.

**Acceptance:**
- `pnpm --filter @umutkorkmaz/ui build` exits 0 in isolation.
- `@/lib/utils` and other `@/` imports resolve in the bundle.
- Root `pnpm build` completes both packages.

### P4-04 — Emit type declarations + bundle `styles.css` + correct exports/externals
**Effort:** M · **Deps:** P4-03 · **Parallel:** no (same build config as P4-03)
**Files:** `packages/ui/vite.config.ts` (add/confirm `vite-plugin-dts`, externals, CSS import), `packages/ui/package.json` (`exports`, `main`/`module`/`types`)

Ensure the library build emits `.d.ts` (via `vite-plugin-dts` with `insertTypesEntry`, or `tsc --emitDeclarationOnly` — `tsconfig.json` already has `declaration: true`, `outDir: dist`, so it is one step away). Import `src/styles/globals.css` from the entry so `cssCodeSplit:false` flushes `dist/re-shell-ui.css` (the `exports["./styles.css"]` target that currently does not exist and which `apps/web/src/main.tsx:11` imports). Externalize `react`, `react-dom`, `react/jsx-runtime`, all `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@umutkorkmaz/contracts` so React isn't duplicated in consumers. Add a `"types"` condition to every `exports` entry and a top-level `"types"`. Fix the masquerading metadata: `react`/`react-dom` are marked `peerDependenciesMeta.optional: true` (wrong for a React-only library — make them required) and move `@testing-library/react` from `dependencies` to `devDependencies`.

**Acceptance:**
- `dist/` contains `index.js`, an `index.d.ts` (+ per-module declarations), and `re-shell-ui.css`.
- `import '@umutkorkmaz/ui/styles.css'` resolves against the built package.
- Built bundle does not inline React/Radix/lucide (externals verified by grep on `dist`).
- Every `exports` entry has a `types` condition; `react`/`react-dom` are required peers; `@testing-library/react` is a devDep.

### P4-05 — Single `cn`, single token system; delete divergent helpers
**Effort:** S · **Deps:** P3-00 · **Parallel:** yes
**Files:** `packages/ui/src/index.ts` (export `cn` from `./lib/utils`), `packages/ui/src/lib/cn.ts` (delete), `packages/ui/src/lib/styles.ts` (delete with WC retirement), `packages/ui/src/styles/globals.css` (canonical tokens), `contracts/src/re-shell.ts:123` if not already done in P3-08

Export the real shadcn `cn` (`twMerge(clsx(...))` from `lib/utils.ts`) from the public entry; remove the naive `join(' ')` `cn` in `lib/cn.ts`. Consolidate on the shadcn `--primary`/`--radius` token set in `globals.css`; remove the parallel `--rs-color-*` scheme in `lib/styles.ts` (tied to the WC layer, deleted in P4-07).

**Acceptance:**
- The package's public `cn` is the twMerge implementation (class-conflict dedup works).
- `lib/cn.ts` is removed; no source imports it.
- Only one CSS-variable token system remains (`globals.css`).

### P4-06 — Delete the stub hub clients
**Effort:** XS · **Deps:** P3-00, P3-08 · **Parallel:** yes
**Files:** `packages/ui/src/hub/index.ts` (delete), verify `packages/ui/src/index.ts` re-exports the real `./hub/sse-client`/`./hub/ws-client`

`hub/index.ts` exports `console.warn` no-op `SseClient`/`WsClient` with signatures incompatible with the real clients. Inert today (nothing imports `./hub`) but a footgun: any future `import … from './hub'` silently swaps in no-ops. Delete it; keep the real `sse-client.ts`/`ws-client.ts` and the live barrel.

**Acceptance:**
- `packages/ui/src/hub/index.ts` no longer exists.
- The public entry still exports the real `SseClient`/`WsClient`.
- No source imports the deleted stub barrel.

### P4-07 — Salvage transport logic into React hooks, then delete the Web Components layer
**Effort:** M · **Deps:** P3-08, P4-05, P4-06 · **Parallel:** no (hooks must land before deletion; gates apps/web refactor P4-08)
**Files:** salvage from `packages/ui/src/components/domain/{health,topology,terminal}.ts` (SSE URL `health.ts:362`/`topology.ts:472`, WS `terminal.ts:349,450-457`); new `packages/ui/src/hooks/{useHealthStream,useTopologyStream,useJobSocket}.ts`; then delete `components/{atomic,domain,layout}/*`, `components/index.ts`, `lib/styles.ts`

Before deleting, port the domain Web Components' fetch/transport logic into React hooks consuming the secure clients from P3: `useHealthStream`, `useTopologyStream` (SSE), `useJobSocket` (WS). Use the typed allow-list (`commandId`/`params`) and the envelope/reassembly helper from P3-05/P3-08 — not the old free-form `?command=...` URLs. Then retire the entire Web Components layer: `atomic/*`, `domain/*`, `layout/*`, `components/index.ts`, `lib/styles.ts`. Keep **at most** a thin custom-element wrapper only if a confirmed non-React embedder exists (none today — defer).

**Acceptance:**
- The three hooks exist, consume the secure SSE/WS clients with `commandId`/`params`, and unwrap via the P3-08 helper.
- All `components/{atomic,domain,layout}` files and `lib/styles.ts` are deleted.
- No source imports the deleted WC modules; `tsc --noEmit` passes.
- No `customElements.define` remains in the built bundle.

### P4-08 — Refactor apps/web to consume React + TanStack Query
**Effort:** L · **Deps:** P4-02, P4-04, P4-07 · **Parallel:** no
**Files:** `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/styles.css` (Tailwind entry), `apps/web/tailwind.config.ts`, remove vite source aliases for `@umutkorkmaz/ui` once the built package is correct, empty `apps/web/src/{components,data}/` dirs

Refactor apps/web to render React shadcn components from `@umutkorkmaz/ui` (`WorkspaceSummaryPanel`, `HealthStatus`, `TopologyNodeCard`, `JobLogPanel`, `CommandPreview`, `TemplateCatalogCard`) composed into a real React app shell (sidebar/tabs via shadcn `Tabs`/`Sheet`). Wire **TanStack Query** as the server-state layer over the P4-07 hooks (stale-while-revalidate, no duplicated server state in client stores). Convert `apps/web/src/styles.css` to a Tailwind entry (`@tailwind base/components/utilities`) using the existing `tailwind.config.ts` (which already scans `../../packages/ui/src`); import `@umutkorkmaz/ui/styles.css`. Remove the empty `apps/web/src/components/` and `apps/web/src/data/` dirs. The committed `HEAD` App.tsx is already React — this reconciles it onto the secure transport and the renamed/built package, not a from-scratch rebuild.

**Acceptance:**
- apps/web renders zero custom elements; all UI comes from React components imported from `@umutkorkmaz/ui`.
- Server state (health/topology/jobs) flows through TanStack Query over the P4-07 hooks.
- `apps/web/src/styles.css` is a Tailwind entry; shadcn tokens render correctly.
- apps/web dev and build both succeed resolving the built (not source-aliased) package.
- Empty scaffold dirs removed; no untracked load-bearing files left.

---

## Tests & Docs (Phase 3–4)

### P3-T1 — Hub security + transport test suite (rewrite)
**Effort:** M · **Deps:** P3-02, P3-04, P3-05, P3-06, P3-07, P3-08 · **Parallel:** no
**Files:** `re-shell-ui/tests/hub.test.ts` (rewrite), CLI `tests/unit/ui-command.test.ts`

Rewrite the hub tests so all assertions are **awaited** (the current suite reports green while 3 assertions throw post-resolve in `ws.on('close')`). Assert the corrected envelope (`content`, not `output`). Add negative tests: missing/wrong token → 401/WS-close; unregistered `commandId` → reject without spawn; injection string in a param → not shell-executed; `cwd` outside workspace → rejected; WS disconnect → child killed; cross-origin → blocked; second WS client receives no output from the first client's job. Add CLI tests for `launchUi` (mock spawn), env handoff (assert `VITE_RE_SHELL_UI_HUB_URL` + token present), and cleanup-on-signal.

**Acceptance:**
- `vitest run tests/hub.test.ts` reports no post-resolve `Errors`; all assertions awaited.
- Each security property (token, allow-list, no-shell, cwd, per-socket cleanup, origin, output isolation) has a passing negative test.
- CLI launch/env/cleanup tests pass.

### P4-T1 — Fix the test runner (vitest/vite compatibility) and component coverage
**Effort:** S · **Deps:** P3-00 · **Parallel:** yes (blocks all other test execution)
**Files:** root `package.json` (`vitest ^2.1.9`), `packages/ui/package.json` (`vitest ^4.1.7` `:59`), `packages/ui/vitest.config.ts`

`vitest run` in `packages/ui` fails at startup (`ERR_PACKAGE_PATH_NOT_EXPORTED: './module-runner'`) because vitest@4.1.7 is incompatible with vite@5. Both 2.1.9 and 4.1.7 are installed. Pin a single vite@5-compatible vitest (2.1.x) in both root and `packages/ui`; dedupe the install.

**Acceptance:**
- `vitest run` executes in `packages/ui` without the `module-runner` error.
- Existing `button.test.tsx`, `command.test.ts`, `utils.test.ts` run and report.
- A single vitest version is installed across the workspace.

### P4-T2 — Component + integration test coverage (≥80%)
**Effort:** M · **Deps:** P4-T1, P4-04, P4-07, P4-08 · **Parallel:** no
**Files:** `packages/ui/src/components/**/*.test.tsx`, replace `re-shell-ui/tests/components.test.ts` (mock-shadow-DOM WC tests), new built-package integration test, apps/web render test

Replace the mock-shadow-DOM WC tests with RTL tests for the promoted React components (cva variants, `asChild`, callbacks, copied-state timers) — reuse `button.test.tsx` as the pattern. Add a render test for the refactored apps/web dashboard. Add an integration test that imports the **built** `@umutkorkmaz/ui` via the exports map (not the source alias) and verifies `index.js`, `index.d.ts`, and `styles.css` all resolve. Target ≥80% per repo rules.

**Acceptance:**
- RTL tests cover all 16 components and the apps/web shell; coverage ≥80%.
- The old `components.test.ts` WC suite is removed.
- The built-package integration test passes (exports map resolves `index.js`/`index.d.ts`/`styles.css`).

### P3-T3 / P4-D1 — Docs: secure transport model + React delivery reality
**Effort:** S · **Deps:** P3-09 (auto-start true), P3-05 (allow-list), P4-04, P4-07, P4-08 · **Parallel:** yes (after its deps)
**Files:** `re-shell-ui/docs/hub-server.md` (`:19` false auto-start claim), `packages/ui/README.md`, `README.md`, `docs/RE_SHELL_UI_EXECUTION_PLAN.md`, `docs/cli-integration.md`, `docs/web-components-usage.md` (archive)

Correct `docs/hub-server.md:19` once the hub genuinely auto-starts; document the token handshake, allow-listed command IDs, envelope shape, and 127.0.0.1-only bind, and mark the free-form `command`/`args` API as removed. Rewrite the UI README + execution plan Milestone 0 to reflect the React-export reality (real `dist` filenames, `@umutkorkmaz/*` scope, externals). Archive `docs/web-components-usage.md` (describes the retired layer).

**Acceptance:**
- Docs describe auto-start, the token model, allow-list IDs, the envelope, and the loopback-only bind.
- No doc claims the package exports Web Components or emits `index.d.ts`/`index.css` that don't exist.
- WC usage doc is archived/marked retired.

---

## Sequencing summary

- **Gate:** `P3-00` first (baseline reconciliation) — everything depends on it.
- **Parallelizable after P3-00:** `P3-01`, `P3-03`, `P3-08`, `P3-09`, `P4-01`, `P4-03`, `P4-05`, `P4-06`, `P4-T1`.
- **Security core (sequential):** `P3-02` → `P3-04`; `P3-08` → `P3-05` → `P3-06`; `P3-05` → `P3-07`.
- **Build core (sequential):** `P4-03` → `P4-04`; `P4-01` → `P4-02`.
- **Fork resolution:** `P4-05`+`P4-06`+`P3-08` → `P4-07` → `P4-08` (needs `P4-02`,`P4-04` too).
- **Decision-gated (post-merge):** `P3-10` (hub relocation) after `P3-05/06/07` and the monorepo merge.
- **Tests/docs land after their feature deps:** `P3-T1`, `P4-T2`, `P3-T3/P4-D1`; `P4-T1` early (unblocks test execution).

---

## Phase 5–6 — MVP Screens + Tests/CI/E2E

This phase delivers the seven MVP screens as React shadcn components consuming the secure hub contract, then makes both repos honestly green: real test scripts, fixed runners, an enforced 80% coverage bar, Playwright E2E for the core flow, and per-package CI. It assumes the merged single pnpm monorepo and the `@umutkorkmaz/*` scope from Phases 1–4; every screen and test references the canonical machine contract (`commands list --json`, `{ok,data,warnings}` envelope, allow-listed hub adapter) established earlier. Tasks here depend on the contract module (P1-contract), the React export rewrite (P4-ui-fork), the secure hub (P0-safety/P3-transport-security), and the `commands list --json` catalog (P2-cli) from prior phases.

### Dependency overview

- **P5 screens** depend on: React layer exported and consumed (`P4-ui-fork`), contract types in `@umutkorkmaz/contracts` (`P1-contract`), secure hub envelope + allow-list (`P0-safety`, `P3-transport-security`), `commands list --json` catalog (`P2-cli`), and the hub client unwrap/reassembly helper.
- **P6 tests/CI** depend on: green screens (P5), the vitest/vite pin fix, and the contract being settled.
- Within P5, screens are largely parallel once the shared app shell (P5-01) and shared hub data hooks (P5-02) land.

---

### P5 — MVP Screens

#### P5-01 — React app shell, routing, and navigation

- **Effort:** M
- **Files:** `apps/web/src/App.tsx`, `apps/web/src/main.tsx`, `apps/web/src/styles.css`, new `apps/web/src/app/AppShell.tsx`, `apps/web/src/app/routes.tsx`, `apps/web/src/app/nav.ts`
- **Depends on:** P4-ui-fork (React export rewrite), P1-contract (scope rename to `@umutkorkmaz/*`), the `apps/web` Tailwind/shadcn token wiring task
- **Description:** Replace the custom-element shell in `App.tsx`/`main.tsx` with a React app shell that consumes `@umutkorkmaz/ui`. Convert `apps/web/src/styles.css` to a Tailwind entry (`@tailwind base/components/utilities`) and import `@umutkorkmaz/ui/styles.css`. Define a 7-route navigation (Overview, Workspace Graph, Templates, Command Builder, Jobs & Logs, Health, Settings) using a lightweight router (route-as-state via search params per repo patterns). Build a persistent left nav using `components/ui` primitives + lucide icons; no `<re-shell-*>` custom elements remain.
- **Acceptance criteria:**
  - `apps/web` renders an all-React shell; `grep -c "re-shell-" apps/web/src/App.tsx` returns 0.
  - All 7 routes navigable; active route reflected in the URL (`?screen=overview` etc.).
  - `main.tsx` imports `@umutkorkmaz/ui/styles.css`; Tailwind directives present in `apps/web/src/styles.css`.
  - `pnpm --filter @umutkorkmaz/web build` (or apps/web build) exits 0.
- **Parallel:** No (gating for all other P5 screens).

#### P5-02 — Shared hub data layer (SSE/WS hooks with envelope unwrap + reassembly)

- **Effort:** M
- **Files:** new `apps/web/src/hub/useHubStream.ts`, `apps/web/src/hub/useJob.ts`, `apps/web/src/hub/client.ts`, `apps/web/src/hub/token.ts`
- **Depends on:** P1-contract (typed envelope in `@umutkorkmaz/contracts`), the hub-client unwrap/reassembly helper task, P3-transport-security (bearer token handshake), P0-safety (allow-list adapter)
- **Description:** Provide React hooks wrapping the real `SseClient`/`WsClient` from `@umutkorkmaz/ui`. `useHubStream(commandId, params)` buffers `content` across `stdout` events keyed by `id` and parses one complete JSON document on `exit` (fixes the SSE double-wrap + multiline-reassembly defects). `useJob(commandId, params)` drives the WS lifecycle (start/stdout/stderr/exit/cancel) reading `msg.content` (not `output`). Both attach the per-session bearer token from `token.ts` (read from CLI-injected `import.meta.env`). All command invocations are by `{commandId, params}` against the allow-list — never raw `command`/`args`.
- **Acceptance criteria:**
  - Hooks return typed data from `@umutkorkmaz/contracts` (no `any`).
  - Unit test proves a chunk-split / pretty-printed JSON payload across multiple `stdout` events reassembles into one parsed object.
  - Unit test proves terminal/log output reads `content` and renders (regression guard for the `output` vs `content` mismatch).
  - No call path constructs raw `command`/`args`; only `{commandId, params}`.
- **Parallel:** Can develop in parallel with P5-01 after contracts land; both gate the screens.

#### P5-03 — Overview screen

- **Effort:** M
- **Files:** new `apps/web/src/screens/OverviewScreen.tsx`; reuses `@umutkorkmaz/ui` `WorkspaceSummaryPanel`, `HealthStatus`, `CommandPreview`
- **Depends on:** P5-01, P5-02; data source = `workspace list --json` (the corrected `runWorkspaceInspect` adapter, not the broken bare `workspace --json`)
- **Description:** Compose `WorkspaceSummaryPanel` (metrics grid, git status) + `HealthStatus` summary into a dashboard landing screen. Include a copy-CLI-command affordance: a `CommandPreview` showing the exact `re-shell workspace list --json` (and refresh) command behind the panel, with copy/dry-run/run.
- **Acceptance criteria:**
  - Renders workspace summary from a corrected adapter feed; empty/no-workspace state shows a clear empty panel (not a crash).
  - Copy button copies the literal CLI command to clipboard; verified by component test asserting `copyTextToClipboard` called with the formatted command.
  - Loading and error states rendered (no silent blank).
- **Parallel:** Yes (independent of other screens after P5-01/02).

#### P5-04 — Workspace Graph screen (React Flow)

- **Effort:** L
- **Files:** new `apps/web/src/screens/WorkspaceGraphScreen.tsx`, `apps/web/src/screens/graph/nodes.ts`, `apps/web/src/screens/graph/NodeDetailDrawer.tsx`; reuses `TopologyNodeCard`, `Sheet`
- **Depends on:** P5-01, P5-02; data source = corrected `runWorkspaceGraph` adapter using `workspace graph --format json` (NOT `--json`), with the leading spinner + trailing success line stripped by the P0-safety spinner fix
- **Description:** Render a React Flow canvas of the workspace dependency graph. Nodes use status coloring (via `TopologyNodeCard` status→variant map), port/framework labels; edges show dependencies. Clicking a node opens a `Sheet`-based `NodeDetailDrawer` with app/service metadata. Add `react-flow` (`@xyflow/react`) to `apps/web` deps. Include a copy-CLI-command affordance for `re-shell workspace graph --format json`.
- **Acceptance criteria:**
  - Graph renders nodes + edges from the `--format json` feed; node count matches the workspace fixture.
  - Node click opens the drawer with correct metadata; Esc/overlay closes it.
  - No reliance on a `--json` flag for graph (regression guard: adapter test asserts `--format json`).
  - Copy affordance copies `re-shell workspace graph --format json`.
- **Parallel:** Yes.

#### P5-05 — Templates screen (filters + dry-run)

- **Effort:** M
- **Files:** new `apps/web/src/screens/TemplatesScreen.tsx`, `apps/web/src/screens/templates/TemplateFilters.tsx`; reuses `TemplateCatalogCard`, `CommandPreview`
- **Depends on:** P5-01, P5-02; **Open Question gate:** the canonical template data source must be decided in P2-cli (candidates: `config template list --json`, `workspace template list --json`, or a new `generate templates list --json`). This task consumes whichever the owner locks; the adapter `runTemplateList` must be rewritten away from the non-existent `templates list --json`.
- **Description:** Render a filterable grid of `TemplateCatalogCard`s. Filters: domain / language / framework / database / cache / deployment (filter state in URL search params). Each card's `CommandPreview` shows the scaffold command with a dry-run toggle (`--dry-run`), and a copy affordance.
- **Acceptance criteria:**
  - Filters narrow the grid; filter state persists in the URL and survives reload.
  - Dry-run toggle injects `--dry-run` into the previewed command; copy copies the exact command.
  - Adapter test asserts the locked canonical template command (no `templates list --json`).
  - Empty-filter-result state rendered.
- **Parallel:** Yes (but blocked until the template-source Open Question is resolved in P2-cli).

#### P5-06 — Command Builder screen (from `commands list --json`)

- **Effort:** L
- **Files:** new `apps/web/src/screens/CommandBuilderScreen.tsx`; new `@umutkorkmaz/ui` `components/re-shell/CommandBuilderForm.tsx`; reuses `CommandPreview`, `lib/command.ts`
- **Depends on:** P5-01, P5-02; P2-cli (the `commands list --json` catalog with per-command `{path, aliases, args, flags:[{name,description,default,takesValue}], supportsJson, supportsDryRun, destructive}`); P1-contract (`CommandSpec` typing — and the `commandText` Omit fix)
- **Description:** Build `CommandBuilderForm` that renders an options form generated from the `commands list --json` catalog: a command picker, typed flag inputs (driven by `takesValue`/`default`), positional args preserving order, a `--json` toggle, a `--dry-run` toggle, and a required confirmation gate for `destructive: true` commands. Live-preview the assembled command via `CommandPreview` (copy/dry-run/run through the allow-listed hub adapter).
- **Acceptance criteria:**
  - Form is generated from the catalog (no hardcoded command list); adding a CLI command/flag surfaces automatically.
  - Flag ordering and arg order are preserved in the previewed command string; verified against `lib/command.ts` formatting.
  - Destructive commands require explicit confirmation before run is enabled; test proves run is blocked until confirmed.
  - Copy affordance copies the exact assembled command; `--json`/`--dry-run` toggles reflected in the preview.
- **Parallel:** Yes (after P2-cli catalog exists).

#### P5-07 — Jobs & Logs screen (live stream)

- **Effort:** M
- **Files:** new `apps/web/src/screens/JobsLogsScreen.tsx`; reuses `JobLogPanel`, `useJob` (P5-02)
- **Depends on:** P5-01, P5-02; P3-transport-security (token + per-socket job kill on disconnect); P0-safety (WS job→socket association)
- **Description:** Live job runner: launch a job via `useJob`, stream stdout/stderr into `JobLogPanel`'s scroll area, show exit code, and expose a cancel control (WS `{type:'cancel',id}` → exit 130). Render multiple concurrent jobs in a list. Redact secrets from displayed log lines (acceptance criterion from the execution plan: "Secrets are redacted from display").
- **Acceptance criteria:**
  - Live stdout/stderr renders as it arrives (reads `content`, not `output`); exit code displayed.
  - Cancel terminates the job and shows exit 130; closing the screen/socket kills the child (per-socket cleanup verified by a hub test, P6-04).
  - Secret-pattern redaction applied to log rendering; test asserts a known secret pattern is masked.
  - Numeric/`null` exit code handled (no crash on SIGTERM `code: null`).
- **Parallel:** Yes.

#### P5-08 — Health screen

- **Effort:** S
- **Files:** new `apps/web/src/screens/HealthScreen.tsx`; reuses `HealthStatus`
- **Depends on:** P5-01, P5-02; P0-safety (`workspace health --json` must emit `jsonError('WORKSPACE_NOT_FOUND')` + exit 1 on no-config instead of human text + exit 0)
- **Description:** Full health view consuming `runWorkspaceHealth` (`workspace health --json`). Render per-check results with status variants; surface the structured error envelope on the no-config path rather than blank. Copy-CLI affordance for `re-shell workspace health --json`.
- **Acceptance criteria:**
  - Healthy and degraded states render distinctly; no-config path shows the `WORKSPACE_NOT_FOUND` error state (not a parse failure or blank).
  - Component test feeds an `{ok:false,error}` envelope and asserts the error UI renders.
  - Copy affordance copies `re-shell workspace health --json`.
- **Parallel:** Yes.

#### P5-09 — Settings screen

- **Effort:** M
- **Files:** new `apps/web/src/screens/SettingsScreen.tsx`; new `@umutkorkmaz/ui` `components/re-shell/SettingsPanel.tsx`
- **Depends on:** P5-01; P5-02 (for CLI/daemon path defaults)
- **Description:** Build `SettingsPanel` for: workspace path, CLI binary path, daemon port, telemetry opt-in, theme (light/dark), and safety mode (require confirmation for destructive). Persist locally (localStorage) with schema validation; values feed the hub token/connection config and Command Builder destructive gate.
- **Acceptance criteria:**
  - All settings render with current values and persist across reload (localStorage).
  - Theme toggle switches shadcn light/dark tokens live.
  - Safety-mode setting is read by the Command Builder destructive gate (P5-06).
  - Invalid input (e.g. non-numeric port) rejected with inline validation.
- **Parallel:** Yes.

#### P5-10 — Copy-CLI-command affordance consistency pass

- **Effort:** S
- **Files:** all `apps/web/src/screens/*`; reuses `CommandPreview`, `lib/command.ts`
- **Depends on:** P5-03 … P5-09
- **Description:** Ensure every screen exposes a consistent copy-CLI-command affordance using `CommandPreview` + `copyTextToClipboard`, with copied-state feedback and timer cleanup. Standardize the rendered command format via `formatCommand`/`createReShellCommand`.
- **Acceptance criteria:**
  - Each of the 7 screens has at least one working copy-CLI affordance using the shared formatter.
  - Copied-state resets after the timeout; no leaked timers (cleanup on unmount verified by test).
- **Parallel:** No (consolidation pass after screens exist).

---

### P6 — Tests / CI / E2E

#### P6-01 — Pin vitest↔vite across both repos (unblock all test runs)

- **Effort:** S
- **Files:** `packages/ui/package.json` (vitest/vite), root `package.json`, `pnpm-lock.yaml`; CLI repo `package.json`, `vitest.config.ts`
- **Depends on:** none (do first; blocks every other P6 task)
- **Description:** Resolve the vitest@4 vs vite@5 `ERR_PACKAGE_PATH_NOT_EXPORTED: './module-runner'` crash. Lock a single compatible pairing across the merged monorepo: pin `vitest` to `^2.1.x` (matching `vite@5`) OR bump `vite`→`^6` + `@vitejs/plugin-react`→`^5` keeping `vitest@4` — decided by the merged-monorepo vite-version Open Question. Dedupe the duplicate vitest installs (root `2.1.9` vs ui `4.1.7`).
- **Acceptance criteria:**
  - `vitest run` in `packages/ui` exits without the `module-runner` error and executes `button.test.tsx`, `command.test.ts`, `utils.test.ts`.
  - Exactly one vitest major resolved across the workspace (`pnpm why vitest` shows one major).
  - CLI repo `vitest run` still executes (no version regression).
- **Parallel:** No (foundational).

#### P6-02 — Real, wired test scripts in both repos (kill the false-green)

- **Effort:** S
- **Files:** `packages/ui/package.json` scripts, root `package.json` scripts, `apps/web/package.json`; CLI repo `package.json`
- **Depends on:** P6-01
- **Description:** Add `"test": "vitest run"` (+ `"test:watch"`) to `@umutkorkmaz/ui`. Fix the root delegate so `pnpm test` actually runs something: run package vitest AND the integration suite (`vitest run --config tests/vitest.config.ts`) — or relocate `tests/hub.test.ts` under `apps/web` with its own `test` script. Update all hardcoded `--filter @re-shell/ui` references to `@umutkorkmaz/ui`. Add a guard so an empty/misrouted runner fails loudly (assert a minimum test count; keep vitest default `--passWithNoTests=false`).
- **Acceptance criteria:**
  - `pnpm test` at the root runs a non-zero number of tests and fails if zero tests execute.
  - The previously orphaned `tests/` suite runs via a script (not only manual invocation).
  - No `@re-shell/` references remain in any test/build script (`grep -r "@re-shell/" package.json packages/*/package.json apps/*/package.json` returns 0).
- **Parallel:** No (depends on P6-01).

#### P6-03 — Fix cli-adapters failures + json-output tests (CLI repo)

- **Effort:** M
- **Files:** CLI repo `src/utils/cli-adapters.ts:59,64,67-72`, `tests/unit/cli-adapters.test.ts:127,135,153,183,201,210`, new `tests/unit/json-output.test.ts`, `src/utils/json-output.ts`
- **Depends on:** P6-01; P1-contract (canonical envelope), P0-safety (spinner stdout fix), P2-cli (corrected adapter command/flags)
- **Description:** (1) Fix the `forEach` arity leak: `lines.forEach(onLine)` → `lines.forEach((l) => onLine(l))` (and `onError`). (2) Fix signal exit code: `resolve(code ?? 0)` → resolve non-zero on signal kill (use `close(code, signal)`; e.g. `code ?? (signal ? 124 : 0)`). (3) De-brittle test data: replace `echo -e '...'` with `printf 'line1\nline2\n'`. (4) Add `tests/unit/json-output.test.ts` (currently zero) covering `jsonSuccess`/`jsonError` envelope shape, `enableJsonMode` suppression of `console.log/warn/error`, the `{`/`[` write filter, restore() idempotency, and `isJsonMode()` argv detection. (5) Fix the asymmetric envelope: add `warnings` to `jsonError` so success/error shapes are uniform. (6) Update the two failing JSON tests to read `jsonOutput.data.microfrontends` and assert on `process.stdout.write` (not the suppressed `console.log`).
- **Acceptance criteria:**
  - `vitest run tests/unit/cli-adapters.test.ts` is fully green (was 4 failed / 6 passed).
  - `tests/cli.test.ts` and `tests/integration/cli-integration.test.ts` JSON tests pass against the `{ok,data,warnings}` envelope.
  - `json-output.ts` has tests covering envelope shape, suppression, write filter, and restore; `jsonError` includes `warnings`.
  - `vitest run` in the CLI repo exits 0 (suite RED→GREEN).
- **Parallel:** Yes (CLI-repo-local, parallel with UI-repo P6 work).

#### P6-04 — Fix hub.test.ts: falsy-zero port, fixtures, isolation, awaited assertions

- **Effort:** M
- **Files:** `apps/web/src/hub-server.ts:35,38,61`, `tests/hub.test.ts:44,70,147,183,198,233,258,289,308,361`, new `test-workspace/` fixture (or `os.tmpdir()` per test)
- **Depends on:** P6-01; P0-safety (per-socket job kill, allow-list), P3-transport-security (token negative tests)
- **Description:** (1) Fix the falsy-zero port bug at `hub-server.ts:61`: `Number.parseInt(env ?? '',10)` guarded by `Number.isFinite`, else `options.port ?? DEFAULT_PORT`, so `{port:0}` → OS-assigned ephemeral port. (2) Create the missing `test-workspace/` fixture (or per-test tmpdir) so spawns don't race. (3) Reset module-level `activeJobs`/`wsConnections` between tests (export `resetHubState()` or instantiate per-server state) to stop cross-test leakage. (4) `await` all assertions before `resolve()` so the 3 post-resolve throws (`:198`, `:258`, `:308`) become real pass/fail, not dirty-exit. (5) Add a `stopHubServer` on dev-server shutdown / `afterEach` to stop heartbeat + child leaks. (6) Add negative tests: missing token → reject; disallowed `commandId` → reject; shell-injection string → not executed; WS disconnect → child killed; cross-origin → blocked.
- **Acceptance criteria:**
  - `vitest run --config tests/vitest.config.ts` exits 0 with zero uncaught errors (was `35 passed` + `3 errors`, exit 1).
  - Tests bind OS-assigned ports (no shared 3334); runnable in parallel without port conflicts.
  - Security negative tests present and passing (token, allow-list, injection, disconnect-kill, origin).
  - No leaked child processes or heartbeat interval after the suite.
- **Parallel:** Yes (UI-repo-local).

#### P6-05 — Honest typecheck wiring (both repos) + apps/web TS error fixes

- **Effort:** M
- **Files:** `apps/web/tsconfig.node.json`, `apps/web/vite.config.ts:17,44`, `apps/web/src/hub-server.ts:48,300,307`, root `package.json:18`; CLI repo `tsconfig.json` posture note
- **Depends on:** P6-01 (so the fixed code is testable); pairs with P5-01/P5-02 (apps/web React refactor may move hub-server)
- **Description:** Make CI typecheck real instead of vacuous. (1) Fix the 5 apps/web errors: set `"target":"ES2022"` (or `lib`) in `tsconfig.node.json` (fixes TS2802×3 Set/Map iteration), change its `include` to `["vite.config.ts","src/hub-server.ts"]` (fixes TS6307), and stop assigning read-only `server.config.define` at `vite.config.ts:44` (use the documented config hook / narrow cast — fixes TS2540). (2) Change the root `typecheck` script from `pnpm -r exec tsc --noEmit` (which runs bare `tsc` and skips `tsconfig.node.json`) to `pnpm -r typecheck` so each package's own two-tsconfig pass runs. (3) Ensure `apps/web` is included in the workspace `build`/`typecheck` so its hub/vite code is actually type-checked.
- **Acceptance criteria:**
  - `pnpm -r typecheck` exits 0 (was exit 1 with 5 errors).
  - Root `typecheck` script runs each package's `typecheck` (not bare `tsc`); CI uses it.
  - `apps/web` `tsc -p tsconfig.json && tsc -p tsconfig.node.json` both pass.
  - For the CLI repo: default `tsc -p tsconfig.json` remains green; strict-mode migration is explicitly deferred (post-MVP, see P7 track).
- **Parallel:** Yes (largely UI-repo-local; CLI part is a no-op verification).

#### P6-06 — Coverage tooling + 80% thresholds (both repos)

- **Effort:** M
- **Files:** `packages/ui/vitest.config.ts`, `tests/vitest.config.ts`, `packages/ui/package.json` (deps + `test:coverage`); CLI repo `vitest.config.ts`, `package.json`
- **Depends on:** P6-01, P6-02, P6-03, P6-04 (suites must be green before a coverage number is meaningful), P5 (screen/component tests must exist to hit 80%)
- **Description:** Install `@vitest/coverage-v8` (as a real devDep, not the transitive optional peer) in both repos. Enable `coverage.provider:'v8'`, `coverage.all:true`, and set thresholds (lines/functions/statements/branches). Ramp strategy: start at the measured current % then raise to **80%** per repo rules. Add `test:coverage` scripts. Scope decision (Open Question): 80% over the contract surface (`cli-adapters.ts`, `json-output.ts`, command JSON paths; UI `components/ui` + `components/re-shell` + hub hooks) first, then broaden — document the chosen scope.
- **Acceptance criteria:**
  - `pnpm test:coverage` produces a coverage report in both repos (no MISSING DEP).
  - Thresholds enforced at 80% on the agreed scope; CI fails if coverage drops below.
  - Component/screen tests bring UI contract surface ≥80%; CLI contract surface (`cli-adapters.ts`, `json-output.ts`) ≥80%.
- **Parallel:** No (gated on green suites + screen tests).

#### P6-07 — Component + screen render/interaction tests (UI)

- **Effort:** L
- **Files:** `packages/ui/src/components/ui/*.test.tsx`, `packages/ui/src/components/re-shell/*.test.tsx`, `apps/web/src/screens/*.test.tsx`, `apps/web/src/hub/*.test.ts`
- **Depends on:** P6-01; P5-01 … P5-10 (screens must exist); P5-02 (hooks)
- **Description:** Add render/interaction tests for all 16 components (cva variants, `asChild`, callbacks, copied-state timer cleanup) and the 7 screens (loading/empty/error/data states, copy affordance, filter URL persistence, destructive confirmation gate, log redaction). Add unit tests for the hub hooks (envelope unwrap, multiline reassembly, `content` vs `output`, token attachment).
- **Acceptance criteria:**
  - Each of the 16 components has at least variant + interaction coverage; each screen has loading/empty/error/data tests.
  - Copy-CLI affordance test asserts `copyTextToClipboard` called with the formatted command on every screen.
  - Hook tests cover reassembly + redaction + token; all green.
  - Contributes the UI portion of the 80% bar (P6-06).
- **Parallel:** Yes (parallel with CLI P6-03 once screens land).

#### P6-08 — Playwright E2E for the core flow

- **Effort:** L
- **Files:** new `apps/web/playwright.config.ts`, `apps/web/e2e/core-flow.spec.ts`, `apps/web/e2e/fixtures/`; CLI repo: re-enable `tests/e2e/cli-e2e.test.ts:16` from `describe.skip` to env-gated
- **Depends on:** P5 (all screens), P6-04 (deterministic hub), P0-safety + P3-transport-security (secure hub for the round-trip)
- **Description:** Add Playwright config + a core-flow spec: launch `apps/web` dev server with a started secure hub, then exercise the primary path — load Overview → open Workspace Graph (nodes render) → pick a template (filter + dry-run preview + copy) → build a command in Command Builder → run a job and see live logs stream → confirm exit code. Assert the SSE/WS round-trip works end-to-end against the allow-listed hub. Test breakpoints 375/768/1024/1440 per web testing rules. Separately, convert the CLI repo's disabled e2e suite to `describe.skipIf(!process.env.RUN_E2E)` so CI can opt in.
- **Acceptance criteria:**
  - `playwright test` runs the core-flow spec headless and passes: dashboard loads, graph renders, template dry-run copies, command builds, job streams logs, exit code shown.
  - SSE and WS round-trips verified against the secure hub (token + allow-list path), not the removed free-form API.
  - Responsive assertions at 375/768/1024/1440 with no overflow.
  - CLI e2e suite is env-gated (`RUN_E2E`) rather than hard-skipped.
- **Parallel:** No (depends on all screens + deterministic hub).

#### P6-09 — Per-package CI workflows (both repos)

- **Effort:** M
- **Files:** new CLI repo `.github/workflows/ci.yml`; UI repo `.github/workflows/ci.yml` (rewrite the vacuous one)
- **Depends on:** P6-01 … P6-08 (gates must be real and green first)
- **Description:** Stand up honest CI for the merged monorepo. Steps per package: `pnpm install --frozen-lockfile`, `pnpm -r typecheck` (the real one), `pnpm test` (real, fails on zero tests), `pnpm test:coverage` (80% gate), `pnpm build`, a gated Playwright job, and a `git diff --exit-code` clean-tree check (after the fixture-pollution fix). Add a grep guard against scope regressions (`@re-shell/` must not appear in source/scripts) and a CLI-tree snapshot guard. For the CLI repo specifically: create `.github/workflows/ci.yml` (none exists today) running `tsc -p tsconfig.json`, `vitest run`, coverage, and the clean-tree check.
- **Depends additionally on:** P6-10 (fixture pollution must be fixed for the clean-tree check to be meaningful).
- **Acceptance criteria:**
  - Both repos have CI that runs typecheck + tests + coverage + build on push/PR and goes RED on any real failure (verified by intentionally breaking one test).
  - CI no longer passes with zero tests or with TS errors hidden by bare `tsc`.
  - Scope-regression grep guard and CLI-tree snapshot guard run in CI.
  - Clean-tree check passes (no fixture mutation) after P6-10.
- **Parallel:** No (final gate).

#### P6-10 — Stop fixture pollution + dead-code/lint hygiene (CLI repo)

- **Effort:** S
- **Files:** CLI repo `test-workspace/test-backup-export.json`, `tests/templates/backend-templates-comprehensive-test-results.json`, `tests/templates/validate-hapi-template-results.json`, integration tests, `.gitignore`; `src/utils/json-output.ts` (dead `createJsonWriter`, shadowed `isJsonMode`)
- **Depends on:** P6-03 (json-output work) ideally, but largely independent
- **Description:** Tests currently write results back into tracked fixtures, dirtying a clean checkout. Copy fixtures to a tmpdir before mutation (or write outputs to a gitignored path) so `git diff --exit-code` is meaningful in CI. Also remove/repair the dead `createJsonWriter` (unused, provides false JSON-safe-write confidence) and rename the shadowed local `isJsonMode` in `createJsonWriter`. Optionally refactor integration tests off per-test `npm run build` (build once in global setup) to cut the ~70s runtime — but that can be deferred.
- **Acceptance criteria:**
  - `vitest run` in the CLI repo leaves the git tree clean (`git diff --exit-code` passes; the 3 tracked JSONs are untouched).
  - Dead `createJsonWriter` removed (or genuinely wired + tested); local `isJsonMode` shadow renamed.
  - (If done) integration suite builds once; runtime materially reduced.
- **Parallel:** Yes (CLI-repo-local).

---

### Sequencing summary

1. **P6-01** (vitest/vite pin) first — unblocks everything test-related.
2. **P5-01 + P5-02** (shell + hub hooks) gate all screens; build in parallel.
3. **P5-03 … P5-09** screens in parallel; **P5-05** waits on the template-source decision (P2-cli); **P5-06** waits on the `commands list --json` catalog (P2-cli).
4. **P5-10** consolidation pass after screens.
5. **P6-02** (real scripts) after P6-01; **P6-03 / P6-04 / P6-10** run in parallel (CLI vs UI repo); **P6-05** typecheck wiring in parallel.
6. **P6-07** component/screen tests after screens; **P6-06** coverage thresholds after green suites + tests.
7. **P6-08** Playwright after all screens + deterministic hub.
8. **P6-09** per-package CI last, as the enforcing gate.

---

## Phase 7–9 — CLI Cleanup, Docs/Legacy Archive, and the FULL Post-MVP Feature Roadmap

> Scope: this section assumes the LOCKED owner decisions (shadcn React UI; `@umutkorkmaz/*` scope everywhere; single pnpm monorepo; legacy `re-shell` archived read-only after salvage). Tasks below are grounded only in verified findings; refuted claims (e.g. "all `src/core/` keep 6 live files", "workspace `state/merge/backup` modules are live", "apps/web README has a wrong path") are corrected here. Effort: XS<2h, S<½d, M~1–2d, L~3–5d, XL>1wk.
>
> Cross-phase deps referenced by ID: **P1-contract** (`@umutkorkmaz/contracts` + envelope), **P2-cli** (command registration + scope-emitter fix + JSON contracts), **P3-transport-security** (hub auth hardening), **P4-ui-fork** (React export refactor), **P6-tests** (test suite). This section owns **P7-xx** (cleanup), **P8-xx** (docs/legacy archive), **P9-xx** (post-MVP features).

---

### Phase 7 — CLI Cleanup, Dead-Code Deletion, Large-File Splits

**Sequencing rule (critical):** delete dead *entrypoints* first so reachability is computed only from the single live root `src/index.ts`; then delete leaf orphans; then split live large files; never edit a file scheduled for deletion. A naive ESM-only reachability pass would mis-mark `src/utils/template-engine.ts` as dead — it is LIVE via a **CommonJS `require('./template-engine')`** edge in `src/utils/config-backup.ts:125/205/557` ← `commands/backup.ts` ← `config.group.ts`. Any tooling MUST honor `require()` edges, not just `import`/`import()`.

#### P7-01 — Build the authoritative reachability index [S] [parallel-safe]
- **Files:** new `scripts/reachability.mjs`; reads all of `src/`.
- **Do:** BFS from the single root `src/index.ts` only (NOT `index-optimized.ts`/`minimal-index.ts`). Resolve `from`, `import(...)`, AND `require(...)` specifiers; extension-normalize. Emit `orphans.json` + line totals.
- **Acceptance:** report reproduces the verified ~164 orphan files / ~144,083 lines; `src/utils/template-engine.ts` is classified LIVE (require-edge honored); `src/graph/dependency-graph-engine.ts`, `optimization/workspace-optimizer.ts`, `parsers/workspace-parser.ts`, `validators/topology-validator.ts` classified LIVE.
- **Deps:** none.

#### P7-02 — Delete dead alternate entrypoints [S]
- **Files:** delete `src/index-optimized.ts`, `src/minimal-index.ts`.
- **Why first:** they are the only references keeping `analyze/completion/doctor/platform-test/template` falsely "reachable" in naive greps.
- **Acceptance:** `grep -rn "index-optimized|minimal-index" src/ package.json` returns nothing; `npm run build` green.
- **Deps:** P7-01 (confirm both are orphan roots).

#### P7-03 — Delete `.bak` files + ignore [XS] [parallel-safe]
- **Files:** delete `src/resolvers/cross-language-resolver.ts.bak`, `src/utils/documentation-generation.ts.bak`, `src/utils/event-streaming-enhanced.ts.bak`; add `*.bak` to `.gitignore`.
- **Acceptance:** `git ls-files "*.bak"` empty; `.gitignore` contains `*.bak`.
- **Deps:** none.

#### P7-04 — "Salvage-reference" snapshot of post-MVP-themed dead stubs [S]
- **Files:** dead utils whose *themes* are re-specced in Phase 9 — `src/utils/{grpc-bridge,rest-adapter,service-protocol,polyglot-client-generator,cross-language-error-handler,type-mapping}.ts`; orphan `src/utils/service-integration.ts`, `service-discovery.ts` (the **util**, NOT the live `templates/backend/service-discovery.ts`), `service-relationships.ts`, `service-versioning.ts`, `service-scaffolding.ts`.
- **Do:** before deletion, copy these to `docs/legacy/salvage-refs/` (read-only reference, NOT compiled) for the P9 bridge designers, then delete from `src/`.
- **Acceptance:** files absent from `src/`; copies exist under `docs/legacy/salvage-refs/`; build green.
- **Deps:** P7-01.

#### P7-05 — Delete 93 orphan `src/utils/*.ts` (~53k lines) [M]
- **Files:** the orphan-utils list from P7-01 (verdict count = **93**, not 82; the extra ~11 were transitively "reached" only via the dead `core/` cluster). Includes the 4× duplicated profilers (`utils/performance-profiler.ts`, `utils/performance-profiling.ts`, `utils/unified-performance-profiler.ts`), `utils/security-scanner.ts`, `utils/doc-generation.ts`, `utils/documentation-generation.ts`, and `utils/config-client-frameworks.ts` (orphan; its 11 `@re-shell/` refs die with it — do NOT spend effort renaming).
- **Acceptance:** all 93 deleted; `npm run build` + `vitest run` green (no test imports any orphan — verified); KEEP `utils/template-engine.ts`, `utils/config-backup.ts`, `utils/error-handler.ts`, `utils/spinner.ts`, `utils/json-output.ts`, `utils/cli-adapters.ts`, `utils/config.ts`, the live `templates/backend/*`, and any other LIVE-classified util.
- **Deps:** P7-01, P7-04 (salvage first).

#### P7-06 — Delete dead directories + standalone dead files [S] [parallel-safe with P7-05]
- **Files:** whole dirs `src/quality/` (4), `src/documentation/` (3), `src/testing/` (8 internal product files — confirm distinct from the Vitest `tests/` dir), `src/discovery/` (1); plus `src/config/framework-metadata.ts`, `src/cache/multi-level-cache.ts`, `src/resolvers/cross-language-resolver.ts`.
- **Acceptance:** dirs/files absent; build + tests green.
- **Deps:** P7-01.

#### P7-07 — Delete ALL 28 orphan `src/core/*.ts` [S]
- **Correction (per verdict):** **all 28** `src/core/*.ts` are orphan, not 19. The "keep `logger/config-manager/command-registry/interactive-prompts/analytics/performance-monitor`" advice is WRONG — none of those are imported via a `core/` path by reachable code; live config/logging infra lives in `src/commands/config.ts` + `src/utils/{error-handler,spinner}.ts`.
- **Files:** delete entire `src/core/` incl. the self-referential 6-file `template-*` cluster (`template-engine/analytics/wizard/marketplace/validator/versioning`).
- **Acceptance:** `src/core/` absent; build + tests green; `grep -rn "from '.*core/" src` (minus deletions) empty.
- **Deps:** P7-01 (re-verify each core file is orphan, since the report undercounted).

#### P7-08 — Delete 13 orphan `src/templates/*` files (~31k lines) [S]
- **Files:** the 13 orphan template files under `src/templates/{frontend,backend,shared,testing,infrastructure}/` from P7-01 (vue-storefront/cdn-integration string-matches are substring false-positives, not module loads — exclude from deletion only if P7-01 marks them LIVE).
- **Acceptance:** none of the 13 referenced by `src/templates/index.ts`; deleted; `re-shell create`/`generate` smoke tests still resolve all advertised template IDs; build green.
- **Deps:** P7-01.

#### P7-09 — Delete `src/discovery/service-registry.ts` group/template stubs + scaffolding md [XS] [parallel-safe]
- **Files:** delete `src/groups/_template.group.ts`; move `src/groups/_middle_commands.md` to `docs/legacy/migration-map.md` (non-compiled), delete after migration complete.
- **Acceptance:** `src/groups/` contains only registered group files; build green.
- **Deps:** P7-01.

#### P7-10 — Untrack runtime scratch artifacts [XS] [parallel-safe]
- **Files:** `git rm -r --cached test-workspace/ tests/templates/*results*.json`; add both globs to `.gitignore`.
- **Acceptance:** `git ls-files test-workspace 'tests/templates/*results*.json'` empty; `git status` no longer shows them as modified.
- **Deps:** none.

#### P7-11 — Canonical template-engine decision [S]
- **Decision (locked by findings):** the canonical engine is the LIVE `src/utils/template-engine.ts` + `src/templates/index.ts` (`BaseTemplate` registry). The dead `core/template-*` cluster is deleted in P7-07. All future template work (compat matrix P9, marketplace P9) builds on the `utils` path. Record this in `docs/RE_SHELL_MASTER_PLAN.md`.
- **Acceptance:** plan documents the canonical engine; no code references `core/template-engine`.
- **Deps:** P7-07.

#### P7-12 — Collapse the two divergent workspace schemas [S]
- **Files:** keep `src/schemas/workspace-v2.schema.json` as the single source of truth; delete `src/utils/schemas/re-shell-workspace.schema.json` (the build at `package.json:18` already silently overwrites it with v2 — a maintainer trap); make the build copy explicit and the runtime `getSchemaPath()` (`schema-generator.ts:357`) point at the canonical file.
- **Acceptance:** one committed schema; runtime loads v2; build copies it deterministically; editing the source file changes runtime behavior.
- **Deps:** P1-contract (schema content), P7-01.

#### P7-13 — Split `security.group.ts` (9,819 L / 403 KB) into per-subcommand modules [L]
- **Files:** `src/groups/security.group.ts` → `src/groups/security/` (~22 modules, one per `.command(`: `zero-trust.ts`, `threat-detection.ts`, `penetration-testing.ts`, `supply-chain.ts`, `rbac.ts`, `audit.ts`, `risk.ts`, `vendor.ts`, `bcp.ts`, `governance.ts`, `regulatory.ts`, `custom-policy.ts`, `compliance.ts`, `security-policy.ts`, `training.ts`, `infra-security.ts`, `container-security.ts`, `secret-detection.ts`, `code-security.ts`, …) + a thin `security.group.ts` registrar (<200 L).
- **Why after deletion:** many handlers call now-deleted orphan utils; re-home only the live handlers cleanly.
- **Acceptance:** each module <800 L; `re-shell security --help` lists all original subcommands; build + tests green; registrar only wires modules.
- **Deps:** P7-05, P7-07 (orphan utils gone first).

#### P7-14 — Split `config.group.ts` (121 subcmds, 2,527 L) and `collab.group.ts` (27 subcmds, 2,589 L) [L] [parallel-safe with P7-13]
- **Files:** `src/groups/config.group.ts` → `src/groups/config/` grouped by domain (presets, env, layers, snapshots, migrations, diff/backup, schema); `src/groups/collab.group.ts` → `src/groups/collab/` (collab already uses dynamic `import('../utils/X.js')` — preserve those edges, just split the registrar).
- **Acceptance:** each module <800 L; all subcommands still resolve via `--help`; build + tests green.
- **Deps:** P7-05, P7-07.

#### P7-15 — Split remaining LIVE >800-line logic files [L] [parallel-safe]
- **Files (data-as-code `templates/*.ts` scaffolders LOWER priority — treat as data):** `utils/database.ts` (4,748), `commands/create.ts` (3,822), `commands/ink-tui.tsx` (2,775), `commands/workspace.ts` (2,646), `commands/profile.ts` (2,445), `commands/create-feature.ts` (2,388), `commands/services.ts` (2,151), `utils/business-continuity.ts` (2,405 — only if it survives P7-05 as LIVE), plus large live `groups/{api,workspace,learn,cloud,tools,k8s,plugin}.group.ts`.
- **Acceptance:** each split file <800 L; behavior unchanged; build + tests green.
- **Deps:** P7-05, P7-07, P7-13/14 (group splits land first to avoid churn).

#### P7-16 — Harden `enableJsonMode` (replace the stdout/console monkey-patch) [S]
- **Files:** `src/utils/json-output.ts:41-67`.
- **Why:** current impl overrides `process.stdout.write`/`console.*` and only forwards strings starting with `{`/`[` — a fragile heuristic that drops/leaks legitimate output and depends on `finally` restore. The UI hub parses this output, so correctness is load-bearing.
- **Do:** replace with a structured logger + explicit `--json`/`--quiet` channel (commands write data via a returned emitter; logs go to stderr). Audit every JSON-emitting command (`doctor`, `analyze`, `workspace health/graph/inspect`, `templates list`) for clean single-object stdout.
- **Acceptance:** each JSON command emits exactly one parseable JSON document on stdout, nothing else; no global monkey-patch remains; UI adapter parses all of them.
- **Deps:** P2-cli (command registration so all consumers exist).

#### P7-17 — Final cleanup verification [S]
- **Do:** `npm run build && vitest run`; measure `dist` size before/after.
- **Acceptance:** suite green; `dist` shrinks materially (target: drop the ~144k orphan lines); no orphan file in `dist`.
- **Deps:** P7-02..P7-15.

---

### Phase 8 — Docs Consolidation + Legacy Salvage and Read-Only Archive

#### P8-01 — Commit the untracked CLI docs tree; decide AGENTS.md [XS] [BLOCKER for all P8]
- **Files:** `git add docs/` (commits `RE_SHELL_MASTER_PLAN.md`, `CLI-CONTRACTS.md`, `docs/superpowers/specs/2026-05-29-…design.md`). **DELETE** `re-shell-cli/AGENTS.md` (it is a agent-context auto-dump auto-dump, NOT authored docs — corrects §8 "KEEP"); add `AGENTS.md` to `.gitignore` (it is currently NOT ignored). Optionally `.gitignore` `/.agents/` handoff dumps if not already.
- **Acceptance:** master plan, contracts doc, design spec tracked in git; `AGENTS.md` deleted + ignored; `git status` clean of these.
- **Deps:** none. **Everything else in P8 depends on this.**

#### P8-02 — Correct master-plan §8 disposition in place [S]
- **Files:** `docs/RE_SHELL_MASTER_PLAN.md` (§0, §3, §8 ~lines 218-273).
- **Do:** add the 16+ unlisted files (4 `.agents/handoff/*.md`, the 12 `re-shell/tools/fullstack-demo/fullstack-app/**` generated READMEs, `re-shell/tools/comprehensive-platform/README.md`, `CLI_FUTURE_PLANS.txt`); flip `AGENTS.md` KEEP→DELETE; flip `web-components-usage.md` REWRITE→DELETE-AFTER-SALVAGE (Web Components retired, decision 1); change contracts target `@re-shell/contracts`→`@umutkorkmaz/contracts` (decision 2); reframe §0/§3 from "submodule/2-repo" to single pnpm monorepo (decision 3).
- **Acceptance:** §8 table covers all 65 md + 1 txt; no stale scope/repo framing remains.
- **Deps:** P8-01.

#### P8-03 — Define monorepo `/docs` IA and MOVE survivors [S]
- **Do:** central `/docs` houses `RE_SHELL_MASTER_PLAN.md`, `CLI-CONTRACTS.md`, the design spec, the merged execution plan, `hub-server.md`, the CLI `EXAMPLES.md` + `examples/*.md` corpus (KEEP — verified accurate/current), `CHANGELOG.md`, `tests/README.md`. Per-package READMEs become thin pointers to `/docs`.
- **Acceptance:** documented IA in `/docs/README.md`; survivors located; KEEP files unchanged in content.
- **Deps:** P8-02.

#### P8-04 — Implement real schema validation (unblocks workspace.yaml v2 core) [M]
- **Files:** `src/utils/schema-generator.ts:325-352` (replace the `TODO: ... ajv` stub that only checks existence/extension).
- **Do:** validate parsed YAML against `workspace-v2.schema.json` using the already-installed `ajv@8.17.1` + a YAML parser; return ajv error objects (path + message).
- **Acceptance:** `config schema validate` rejects an invalid workspace and reports field-level errors; accepts a valid one; unit tests cover both.
- **Deps:** P7-12 (single schema), P1-contract (envelope), P6-tests.

#### P8-05 — Replace `re-shell.dev` URLs + centralize as constants [S] [parallel-safe]
- **Files:** `schema-generator.ts` (`$id`, IDE namespaces, doc links ~lines 61/82-87/107/111/150/154), `plugin-marketplace.ts:166/620`, `schemas/*.json` `$id`, `workspace.ts:1050`, `template-versioning.ts:396`.
- **Do:** route through a single `BRAND` constants module (owned origin or local schema refs).
- **Acceptance:** zero `re-shell.dev` literals in `src/`; IDE autocomplete `$ref` points at an owned/served origin.
- **Deps:** P7-12.

#### P8-06 — Salvage-then-delete legacy roadmap corpus [M]
- **Do:** extract post-MVP items from `re-shell/CLI_IMPLEMENTATION_TODO.md`, `UI_IMPLEMENTATION_TODO.md`, `CLI_FUTURE_PLANS.txt` (27 KB) into a new `/docs/ROADMAP.md` (the P9 backlog below is the structured target); salvage the backend framework selection matrix from `HOW_TO_USE_BACKEND_TEMPLATES.md` + `BACKEND_TEMPLATES_DEMO.md` with CORRECTED counts (current is **0.28.0 / ~200 frameworks**, not the stale `v0.23.0 / 82 Templates`); salvage `RE_SHELL_UI_EXECUTION_PLAN.md` (the UI/daemon spec) as the merged execution-plan spine. Then delete all DELETE / DELETE-AFTER-SALVAGE legacy docs.
- **Acceptance:** `/docs/ROADMAP.md` exists; framework matrix in CLI docs uses current counts; salvaged plan reconciled (see P8-07); DELETE-marked legacy docs removed.
- **Deps:** P8-02.

#### P8-07 — Reconcile `RE_SHELL_UI_EXECUTION_PLAN.md` to locked decisions [M]
- **Files:** the salvaged plan + new `@umutkorkmaz/contracts`.
- **Do:** rename `@re-shell/ui-contracts`→`@umutkorkmaz/contracts`, `packages/ui`→`@umutkorkmaz/ui`; fix the 10 stale `/Users/dtumkorkmaz/...` paths → `/Users/umut/...`; adopt its `WorkspaceSummary`/`CommandSpec`/`JobRecord` contract types verbatim into the contracts package.
- **Acceptance:** plan has zero `@re-shell/`/`dtumkorkmaz` references; contract types live in `@umutkorkmaz/contracts`.
- **Deps:** P1-contract, P8-06.

#### P8-08 — Delete byte-duplicate + empty files [XS] [parallel-safe]
- **Do:** delete `re-shell/docs/RE_SHELL_UI_EXECUTION_PLAN.md` (md5 `71c602734…`, byte-identical to the UI copy — keep the UI copy as spine); delete empty the empty package memory file (0 bytes).
- **Acceptance:** only one execution-plan copy remains; empty file gone.
- **Deps:** P8-06 (salvage from the canonical copy first).

#### P8-09 — Rewrite the 3 reality-divergent active READMEs [S]
- **Files:** `re-shell-cli/README.md` (fix dead `github/workflow/status` CI badge → `actions/workflow/status`; `/Users/dtumkorkmaz`→`/Users/umut` at line 120; retired IDs `express-ts`/`fastify-ts`→`express`/`fastify` at lines 257/264/947/989/1013/1035), `re-shell-ui/README.md` (drop "intentionally separate from re-shell/re-shell-cli" → single-monorepo framing; fix `dtumkorkmaz` path). NOTE: `apps/web/README.md` does NOT contain a wrong `/Users/` path (verdict refuted that) — its only defect is the broken `WorkspaceSummaryPanel` import, fixed in P8-10.
- **Acceptance:** badges render; paths correct; template IDs match `framework-metadata` (`express`/`fastify`); no "separate repo" language.
- **Deps:** P4-ui-fork (so README describes the actual React surface).

#### P8-10 — Rewrite UI package READMEs after React export refactor [S]
- **Files:** `packages/ui/README.md` (current claims `dist/index.{js,cjs,d.ts,css}` + `WorkspaceSummaryPanel` export — both false: dist emits `re-shell-ui.js`/`re-shell-ui.umd.cjs`, and `WorkspaceSummaryPanel` lives in the ORPHANED `components/re-shell/index.ts` barrel never wired into `components/index.ts`), `apps/web/README.md` (describe the actually-rendered surface; the `<re-shell-layout>` Web Component is being retired), `packages/contracts/README.md` (title `@re-shell/ui-contracts` → `@umutkorkmaz/contracts`).
- **Important:** the orphaned `components/re-shell/index.ts` barrel (exports `command-preview`, `health-status`, `job-log-panel`, `template-catalog-card`, `topology-node-card`, `workspace-summary-panel`) is a real **packaging bug**, not just a doc error — flag to P4-ui-fork to wire it into the package root, then document the true exports here.
- **Acceptance:** READMEs match real exports/dist filenames post-P4; titles use `@umutkorkmaz/*`.
- **Deps:** P4-ui-fork (export wiring + scope rename).

#### P8-11 — Annotate hub-server.md security; merge cli-integration.md [XS]
- **Files:** `re-shell-ui/docs/hub-server.md` (ZERO auth/token mention today — add the no-auth + `shell:true` risk and the token-auth target), merge `cli-integration.md` into it (drop the stale "/events future" framing — `/events` is implemented).
- **Acceptance:** hub-server.md documents the security posture + token plan; `cli-integration.md` removed/merged.
- **Deps:** P3-transport-security (final hardened state).

#### P8-12 — Salvage-then-delete web-components-usage.md [S]
- **Files:** `re-shell-ui/docs/web-components-usage.md` — extract still-accurate transport/embedding notes into `hub-server.md`, then DELETE (Web Components retired, decision 1; corrects §8 "REWRITE").
- **Acceptance:** file deleted; salvaged transport notes present in hub-server.md.
- **Deps:** P8-11, P4-ui-fork.

#### P8-13 — Reconcile divergent INTEGRATION.md pair [XS] [parallel-safe]
- **Files:** `re-shell/INTEGRATION.md` vs `re-shell/docs/INTEGRATION.md` (212 differing sorted lines — overlapping not identical). Only merge if anything survives salvage; otherwise both die with the archive.
- **Acceptance:** at most one INTEGRATION doc survives, in `/docs`; legacy copies removed.
- **Deps:** P8-06.

#### P8-14 — Legacy `re-shell` working-tree reconciliation BEFORE archive [S]
- **Why (missed by reports):** the legacy working tree is dirty — `package.json` has an uncommitted edit swapping the dead tarball path `dtumkorkmaz`→`umut`, and the `packages/cli` submodule pointer is moved (`+2f8713d`, while tag `cli-v0.28.0` actually resolves to `32cd6b1`). An "archive read-only" step must first discard or commit these pending changes.
- **Do:** discard the uncommitted `package.json` edit (the tarball is absent either way — do NOT fix it); reconcile the submodule gitlink; remove the broken `@re-shell/core` `file:` dep, `.gitmodules`, `lerna.json`, root `package.json` `workspaces`, and the leaked tracked tree `Users/dtumkorkmaz/...` (3 files); keep one `pnpm-workspace.yaml` only if the legacy repo were merged (it is being archived, so just drop competing tooling).
- **Acceptance:** legacy working tree clean; `git ls-files Users/` empty; no `.gitmodules`/`lerna.json`; `git status` clean.
- **Deps:** P8-06 (salvage docs first — CLI source is recoverable only via submodule objects, but it is the same source as the active repo, so no code salvage needed).

#### P8-15 — Archive legacy `re-shell` read-only [XS]
- **Files:** new `re-shell/ARCHIVED.md` (read-only notice pointing to active `re-shell-cli` + `re-shell-ui`); retain `docs/architecture.md` (467 L) + `docs/requirements.md` (297 L) inside the archived snapshot (the only substantive design refs); optionally copy them to `/docs/legacy/`.
- **Do:** mark the GitHub repo archived (read-only). Do NOT attempt to make it build.
- **Acceptance:** `ARCHIVED.md` present; repo set read-only on GitHub; `architecture.md`/`requirements.md` preserved.
- **Deps:** P8-06, P8-14.

#### P8-16 — Decide `packages/core` submodule fate [XS] [parallel-safe]
- **Open item:** uninitialized submodule at `Re-Shell/core.git` (dead org, commit `1afdba3`). Fetch-attempt once; if it contains unique microfrontend-runtime code, snapshot to `/docs/legacy/`; else confirm fully superseded by shadcn React and drop. (Likely DROP per decision 1.)
- **Acceptance:** documented decision in `ARCHIVED.md`; no dangling submodule ref.
- **Deps:** P8-15.

---

### Phase 9 — FULL Post-MVP Feature Roadmap

> Each feature is a self-contained mini-plan (phased tasks → deps → acceptance). All `@umutkorkmaz/*`. **DROPPED, do not spec** (per `CLI_FUTURE_PLANS.txt:519-544`): quantum computing, VR/AR dev environments, neural self-healing infra, blockchain/Web3/dApp/cross-chain. Every Phase-9 feature depends on Phase-7 cleanup landing (no dead-stub confusion) and the P1-contract envelope (`{ok,data,warnings}` / `{ok,error{code,message,details}}`).

#### P9-A — AI/NLP Command Interface [XL]
Source: `CLI_IMPLEMENTATION_TODO.md:944-1010`; UI surface plan §19.
- **P9-A1 [M]** NL→CLI intent parser scaffold: registered `re-shell ai <prompt>` command; pluggable model backend (cloud + offline local LLM). *Acceptance:* maps a fixed phrase set to valid command specs with confidence scores. *Deps:* P2-cli, P1-contract.
- **P9-A2 [M]** Context injection from the live workspace graph (`graph/dependency-graph-engine.ts`) + ambiguity resolution via clarifying questions; multi-turn session memory. *Acceptance:* ambiguous prompt triggers a clarifying turn; resolved spec references real workspace nodes. *Deps:* P9-A1.
- **P9-A3 [M]** Safety sandbox: generated commands run through the allow-listed arg-array validator + a mandatory preview/confirm before execution; command explanation output. *Acceptance:* no generated command executes without confirm; injection attempt is rejected. *Deps:* P9-A2, P3-transport-security (arg allow-listing).
- **P9-A4 [S]** Semantic response caching with dedup; confidence-scored autocomplete. *Acceptance:* repeated equivalent prompts hit cache; low-confidence suggestions are flagged. *Deps:* P9-A3.

#### P9-B — Cross-Language Service Bridge (gRPC/REST/GraphQL) [XL]
Source: `CLI_IMPLEMENTATION_TODO.md:1263-1340`. Build FRESH — the existing `service-integration.ts`/`service-protocol.ts` etc. are dead stubs (salvage-referenced in P7-04, deleted). `service.group.ts` has NO bridge surface today.
- **P9-B1 [L]** Command surface `re-shell service bridge generate --grpc|--rest|--graphql`; universal language-agnostic protocol contract; replace the bogus `services-link/validate/unlink` strings with real `service link`/`service validate`. *Acceptance:* `--help` lists bridge subcommands; each emits a valid client scaffold. *Deps:* P7-04, P7-13/14 (group split), P2-cli.
- **P9-B2 [L]** gRPC bridges (autogen clients), REST adapters (auto serialization), GraphQL federation (schema stitching). *Acceptance:* generated client compiles against a sample service in two languages. *Deps:* P9-B1.
- **P9-B3 [M]** Async message-queue transport (Kafka/Redis Streams) with schema evolution; cross-language discovery, circuit breakers, distributed tracing (correlation IDs). *Acceptance:* generated async stub round-trips a message with a correlation ID. *Deps:* P9-B2.
- **P9-B4 [M]** Data transformation across JSON/Protobuf/Avro/MessagePack with backward-compat migration; contract testing + universal mock servers; polyglot client-lib generation. *Acceptance:* a contract change is detected by the contract test; mock server serves all three protocols. *Deps:* P9-B3, P1-contract.

#### P9-C — workspace.yaml v2 + JSON Schema + IDE Autocomplete [L]
Source: `CLI_IMPLEMENTATION_TODO.md:831-871`; YAML example `CLI_FUTURE_PLANS.txt:41-135`. ~50% present (schema authored + IDE config emit works); validate path was the stub fixed in P8-04.
- **P9-C1 [S]** Finalize the v2 schema (multi-language service defs + framework metadata; required `[name,version,services]`) as canonical. *Acceptance:* `config schema validate` enforces v2. *Deps:* P7-12, P8-04.
- **P9-C2 [M]** Dependency-graph engine with cycle detection + cross-language resolution (Node→Java, Python→Rust). *Acceptance:* a cycle is detected and reported with the offending path. *Deps:* P9-C1, P9-B1.
- **P9-C3 [M]** Commands `workspace init/validate/health/migrate/optimize/backup/restore/template` + interactive setup wizard. *Acceptance:* each subcommand round-trips a v2 workspace; wizard produces a valid file. *Deps:* P9-C1.
- **P9-C4 [S]** Publish JSON Schema for VSCode/IntelliJ/Vim/Emacs autocompletion (served from owned origin per P8-05). *Acceptance:* VSCode resolves the `$schema` and autocompletes service keys. *Deps:* P9-C1, P8-05.

#### P9-D — K8s/Helm/GitOps Generation [L]
Source: `CLI_IMPLEMENTATION_TODO.md:1371-1387`.
- **P9-D1 [M]** Generate K8s manifests from workspace YAML; HPA on custom metrics; network policies/security contexts. *Acceptance:* `re-shell k8s generate` emits `kubectl apply`-valid manifests for a sample workspace. *Deps:* P9-C1.
- **P9-D2 [M]** Helm chart templates with env-specific values + dependency mgmt. *Acceptance:* `helm lint` passes on generated chart. *Deps:* P9-D1.
- **P9-D3 [M]** GitOps integration (ArgoCD/Flux deploy + rollback); ingress with SSL/TLS automation. *Acceptance:* generated GitOps manifests deploy + roll back in a kind cluster. *Deps:* P9-D2.
- **P9-D4 [S]** Optional CRDs + operators + multi-cluster service mesh (Istio/Linkerd). *Acceptance:* CRD installs; mesh sidecar injection documented. *Deps:* P9-D3.

#### P9-E — Nx/Turbo Monorepo Importer [M]
Source: `CLI_IMPLEMENTATION_TODO.md:854`. Build on the existing live `src/commands/import-monorepo.ts`.
- **P9-E1 [M]** `re-shell workspace migrate` ingests Nx + Turborepo configs → emits `re-shell.workspaces.yaml` v2 + workspace graph. *Acceptance:* a sample Nx repo and a Turbo repo each produce a valid v2 workspace. *Deps:* P9-C1.

#### P9-F — Plugin Marketplace / Registry [XL]
Source: plan §5 + `CLI_IMPLEMENTATION_TODO.md:95,167`; current `plugin install`/`plugin-marketplace.ts` are fully mocked (`setTimeout(2000)`; `mock*`; writes literal `'mock-plugin-archive'`; signature verify hardcoded `verified:true` while default config advertises `verifySignatures:true` — a latent trust issue, NOT just a fake feature).
- **P9-F1 [L]** Real `plugin install` (`commands/plugin.ts:141`): resolve npm/git/local id, install into `.re-shell/plugins`, validate manifest, register. Replace the `setTimeout` simulation. *Acceptance:* installing a real npm plugin makes its commands available; failure surfaces an error. *Deps:* P2-cli.
- **P9-F2 [XL]** Real marketplace client (replace all `mock*` in `plugin-marketplace.ts`): search/download/install against an owned registry (or npm keyword `reshell-plugin` as MVP source); reviews/ratings. *Acceptance:* search returns live results; download fetches a real archive. *Deps:* P9-F1, P8-05.
- **P9-F3 [M]** Real signature verification gated behind config; security-scan/security-fix of plugins; version pinning. *Acceptance:* an unsigned plugin is rejected when `verifySignatures:true`; verification is no longer hardcoded. *Deps:* P9-F2.
- **P9-F4 [S]** Plugin-detection contract decision: rebrand prefix `@re-shell/`→`@umutkorkmaz/` and manifest keys `reshell-cli`/`reshell-plugin`, with backward-compat detection of legacy-published plugins. *Acceptance:* both legacy and new-scope plugins are discovered. *Deps:* P9-F1, P1-contract.

#### P9-G — Policy Packs + Repo Readiness Score + Dependency Drift [M]
Source: `RE_SHELL_UI_EXECUTION_PLAN.md:880-884`.
- **P9-G1 [M]** Workspace policy packs (declarative rule sets) + a generated-repo readiness score. *Acceptance:* a violating workspace fails a named policy with a clear message; readiness score is reproducible. *Deps:* P9-C1, P9-F2 (packs distributable via marketplace).
- **P9-G2 [M]** Dependency drift detection across the workspace. *Acceptance:* a drifted dependency is reported with current vs expected versions. *Deps:* P9-C2.

#### P9-H — Template Compatibility Matrix + Visual Diff Before Generation [M]
Source: `RE_SHELL_UI_EXECUTION_PLAN.md:883-884`; inventory `BACKEND_FRAMEWORKS_COMPREHENSIVE.md`. Built on the canonical `utils/template-engine.ts` + `templates/index.ts` (P7-11), NOT the deleted `core/template-*` cluster.
- **P9-H1 [M]** Compat matrix across the ~219 backend templates (language/framework/db/cache/deploy). *Acceptance:* `re-shell templates matrix --json` returns the full compatibility grid. *Deps:* P7-11, P2-cli, P7-16 (clean JSON).
- **P9-H2 [M]** Visual diff of files a `create` would produce, BEFORE mutation (`create --dry-run` preview). *Acceptance:* dry-run shows the exact file set + diffs and writes nothing. *Deps:* P9-H1.

#### P9-I — VS Code Extension Bridge [L]
Source: `RE_SHELL_UI_EXECUTION_PLAN.md:886`.
- **P9-I1 [L]** VS Code extension surfacing the `re-shell` JSON contracts + command builder inside the editor (consumes the hardened JSON output from P7-16). *Acceptance:* extension lists commands, builds a spec, runs it via the local hub. *Deps:* P7-16, P3-transport-security, P9-H1.

#### P9-J — Hosted Control Plane [L]
Source: `RE_SHELL_UI_EXECUTION_PLAN.md:887`; plan §4.
- **P9-J1 [L]** Multi-user/team dashboard, remote agents, team policy sync (extends the local hub to an authenticated multi-tenant control plane). *Acceptance:* two users see a shared workspace; policy sync propagates. *Deps:* P3-transport-security (auth foundation), P9-G1.

#### P9-K — Desktop / Tauri Packaging [L]
Source: `RE_SHELL_UI_EXECUTION_PLAN.md:196-199, §18 Phase 3`.
- **P9-K1 [L]** Package the `re-shell-ui` React dashboard as a Tauri desktop app (post-React-fork). *Acceptance:* signed desktop build launches and drives the local hub. *Deps:* P4-ui-fork, P3-transport-security.

#### P9-L — Interactive Workspace Graph Explorer [M]
Source: `CLI_IMPLEMENTATION_TODO.md:874-918`; UI plan §12.2.
- **P9-L1 [M]** React-Flow graph for 2000+ nodes: pan/zoom, status coloring, search/filter by language/framework/status, dependency-path viz, export (PNG/SVG/Mermaid/D3/JSON/PDF), graph diff for PR review. *Acceptance:* renders a 2000-node graph; filter + export + diff work. *Deps:* P4-ui-fork, P9-C2.

#### P9-M — Multi-Environment Profiles [M]
Source: `CLI_IMPLEMENTATION_TODO.md:920-940`. Distinct from the existing `config` profile subcommands.
- **P9-M1 [M]** Env-specific workspace configs with inheritance/override, active-profile persistence + context switching, conflict detection, `dev --profile`, profile create wizard, Git team sync. *Acceptance:* switching profiles changes resolved config deterministically; conflicts are detected. *Deps:* P9-C1.

#### P9-N — Real-Time Collaboration [M] (sequence LAST — heaviest)
Source: `CLI_IMPLEMENTATION_TODO.md:1411-1460`.
- **P9-N1 [M]** WebRTC pair programming, shared terminals, OT-based shared editing, team analytics. *Acceptance:* two clients share a terminal session with synchronized state. *Deps:* P9-J1 (control plane), P3-transport-security.

---

### Open Questions carried into Phase 9 (decide before the relevant feature starts)
- **Emitted SDK packages** (`@umutkorkmaz/config-client`, `shared-config`, `auth-client`, `service-mesh-client`, `microfrontend-client`, …): will these actually exist in the monorepo, or are they aspirational? If aspirational, the live emitters (`commands/add.ts`, `templates/index.ts`, `templates/backend/*`) currently produce broken user code regardless of scope — blocks P2-cli scope fix and P9-B/P9-F acceptance.
- **Marketplace source of truth** (P9-F): owned registry vs npm keyword `reshell-plugin` for MVP.
- **Legacy plugin back-compat** (P9-F4): keep accepting `@re-shell/` / `reshell-cli` plugins post-rebrand, or clean break.
- **`packages/core` submodule** (P8-16): unique runtime code worth salvaging, or fully superseded by shadcn React.

---

## E. Master sequencing & parallel agent-assignment map

This is the cross-phase orchestration view. Within each wave, tasks are independent and can be handed to **separate agents/PRs in parallel**; waves are ordered by hard dependency.

### Critical-path waves (Phases 0–6 → working, safe MVP)

**Wave 0 — Safety & backup (do first; nothing else is safe before this).** Parallel: `P0-01` (UI git remote + commit untracked work), `P0-02` (tag CLI pre-merge), `P0-03` (commit CLI docs, delete AGENTS.md dump), `P0-04` (legacy archive marker), **`P3-00`** (reconcile the dirty WC tree → React baseline; salvage transport, discard overlay). *`P0-01` must precede `P3-00` — back up before you discard.*

**Wave 1 — Monorepo + scope + contract lock.** Sequential spine: `P1-01` (workspace layout) → {`P1-02` move CLI (npm→pnpm) ∥ `P1-03` move ui/contracts/web} → `P1-04` (retire submodule) → `P1-05` (rename UI pkgs) ∥ `P1-06` (fix CLI emitters) → `P1-07` (org-casing). Contract sub-spine (after `P1-05`): `P1-09` (zod) → {`P1-10` envelope ∥ `P1-11` error codes ∥ `P1-13` boundary parses ∥ `P1-14` Omit fix} → `P1-12` (CLI consumes contracts) → `P1-08` (adapter reconcile).

**Wave 2 — CLI producers (Phase 2).** Foundational first: `P2-00` (explicit JSON writer) → then fully parallel: `P2-02` (spinner leak), `P2-04` (health no-config), `P2-05` (graph `{apps,services}`), `P2-08` (WorkspaceDefinition adapter), `P2-09` (`templates list --json`), `P2-10` (`config template list` empty fix), `P2-14` (`commands list --json` catalog), `P2-16` (non-zero exit on error), `P2-17` (restoreJson ordering). Serial: `P2-06` (health normalizer) → `P2-07` (WorkspaceSummary, composes graph+health) → `P2-15` (adapters consume); `P2-12` (analyze rename) → `P2-11` (register doctor/analyze/completion) → `P2-13` (completion list). Then `P2-18` (delete dead utils), `P2-19` (regression tests). *Highest-value/lowest-effort early wins: `P2-02`, `P2-10`, `P2-11`, `P2-16`.*

**Wave 3 — Secure transport (Phase 3).** Gated by `P3-00`. Parallel: `P3-01` (lifecycle/signals), `P3-03` (env `HUB_URL`), `P3-08` (typed envelope + reassembly), `P3-09` (make hub launchable). Security core (sequential): `P3-02` (session token) → `P3-04` (origin allowlist); `P3-08` → `P3-05` (typed allow-list adapter) → `P3-06` (remove `shell:true`) → `P3-07` (cwd containment, bind pin, per-socket cleanup, output isolation). Post-merge: `P3-10` (relocate hub into CLI package as compiled JS).

**Wave 4 — UI fork resolution + build (Phase 4).** Gated by `P3-00`. Parallel: `P4-01` (contracts rename), `P4-03` (build deps + `@/` alias), `P4-05` (single `cn`/tokens), `P4-06` (delete stub hub clients), `P4-T1` (vitest/vite pin). Serial: `P4-01` → `P4-02` (ui rename + scripts); `P4-03` → `P4-04` (d.ts + styles.css + externals + peer fix); {`P4-05` + `P4-06` + `P3-08`} → `P4-07` (salvage transport into hooks, delete WC layer) → `P4-08` (apps/web React + TanStack Query).

**Wave 5 — MVP screens (Phase 5).** Gates: `P5-01` (React shell/routing) + `P5-02` (hub hooks) first. Then parallel screens: `P5-03` Overview, `P5-04` Graph (React Flow), `P5-05` Templates *(blocked on the template-source open question, §G)*, `P5-06` Command Builder *(needs `P2-14`)*, `P5-07` Jobs & Logs, `P5-08` Health, `P5-09` Settings. Then `P5-10` (copy-CLI consistency pass).

**Wave 6 — Honest tests/CI/E2E (Phase 6).** `P6-01` (vitest/vite pin) first. Then parallel across repos: `P6-02` (real scripts), `P6-03` (CLI adapter+json-output tests), `P6-04` (hub.test fixes), `P6-05` (typecheck wiring), `P6-10` (fixture pollution). Then `P6-07` (component/screen tests) → `P6-06` (80% coverage gate); `P6-08` (Playwright E2E) after all screens; `P6-09` (per-package CI) as the final enforcing gate.

### Parallelizable cleanup/docs (Phases 7–8) — can overlap Waves 2–6

`P7-01` (reachability index) gates the deletions; then `P7-02`…`P7-10` (dead-code/entrypoint/artifact deletion) largely parallel; `P7-13`/`P7-14`/`P7-15` (large-file splits) after the orphan utils are gone; `P7-16` (harden enableJsonMode) with `P2-cli`. Docs: `P8-01` (commit docs / delete AGENTS dump) blocks the rest; then `P8-02`…`P8-16` mostly parallel, with the legacy archive (`P8-14`→`P8-15`→`P8-16`) last.

### Phase 9 (post-MVP) — independent feature tracks

Every Phase-9 feature depends on Phase-7 cleanup + the `P1-contract` envelope. The tracks are mutually independent and can be scheduled by priority: `P9-A` AI/NLP · `P9-B` cross-language bridge · `P9-C` workspace.yaml v2 · `P9-D` K8s/Helm/GitOps · `P9-E` Nx/Turbo importer · `P9-F` plugin marketplace · `P9-G` policy/drift · `P9-H` template matrix + visual diff · `P9-I` VS Code extension · `P9-J` hosted control plane · `P9-K` Tauri desktop. **Dropped, do not build:** quantum, VR/AR, neural self-healing, blockchain/Web3.

### Recommended branch/merge order

1. `re-shell-cli` engine + contract work (Phases 1–3 CLI side) → `main`.
2. `@umutkorkmaz/contracts` locked (+ published if the 2-repo fallback is ever chosen — not under Decision 3).
3. `re-shell-ui` consumes the locked contract; reconciled React baseline merged.
4. Monorepo merge lands (Decision 3); hub relocates into the CLI package (`P3-10`).
5. Legacy `re-shell` archived last.

---

## F. Definition of Done (MVP)

- `re-shell ui` from any workspace opens a dashboard showing **real** workspace data (overview, graph, templates, health) sourced from the CLI through a **token-authenticated, 127.0.0.1-only** hub.
- Every action shows/copies its equivalent `re-shell` command; destructive actions confirm; dry-run supported.
- **No `shell:true`, no arbitrary-command path, `cwd` constrained to the workspace; token required on every endpoint.**
- **One** UI system (shadcn React), **one** contract source of truth (`@umutkorkmaz/contracts` with zod), `CLI-CONTRACTS.md` generated from real output and CI-verified by the conformance test.
- All `--json` commands emit a single parseable `{ok,data,warnings}` line on stdout and **exit non-zero on `ok:false`**.
- `pnpm test` runs real suites that pass with **≥80%** coverage on the agreed scope; `pnpm -r typecheck` is honest (no masked errors); the git tree stays clean after a test run.
- Playwright covers the core flow (open → inspect → filter templates → build command → dry-run → run → live logs → cancel). Fresh clone → demo in <5 min.

---

## G. Open questions for the owner (do not block Phase 0–2; resolve before the dependent task)

1. **Monorepo home (P1-01):** make the existing `re-shell-cli` repo the monorepo root (keeps remote + history; recommended), or a fresh `re-shell` monorepo?
2. **Template data source for the Templates screen (gates P5-05 + P2-09 framing):** expose framework templates via a new top-level `templates list --json` (recommended), and/or normalize `config template list` (workspace scaffolds) — confirm the canonical source the UI consumes.
3. **Health canonical engine (P2-06):** normalize to the lightweight `checkWorkspaceHealth` or the rich `manageWorkspaceHealth`? (Plan assumes one normalizer emitting `{score,status,checks[]}` fed by whichever; pick which engine backs it.)
4. **Runtime fields:** should apps/services carry live runtime fields (`status`/`port`/`healthUrl` via probing), or stay static-detection only for MVP? (Plan assumes static for MVP.)
5. **vitest/vite pinning direction (P6-01):** pin `vitest@^2.1.x` (matches `vite@5`, recommended) or bump `vite@^6` + `@vitejs/plugin-react@^5` keeping `vitest@4`?
6. **`Re-Shell/core` submodule (P8-16):** confirm it is fully superseded by shadcn React and can be dropped (likely), or snapshot unique microfrontend-runtime code first?

---

## H. Provenance & verification appendix

This plan was produced by workflow run `wf_bcf46c8e-415`:

- **Phase 1 — Analyze:** 18 agents, each owning one area (`cli-entrypoints-registry`, `cli-json-system`, `cli-workspace-graph-health`, `cli-templates-system`, `cli-dead-code-debt`, `cli-ui-launcher-hub`, `cli-full-command-inventory`, `cli-tests-ci`, `cli-config-plugin-service`, `ui-contracts`, `ui-react-layer`, `ui-webcomponents-appsweb`, `ui-hub-server-security`, `ui-build-package`, `ui-tests-ci`, `contract-drift-map`, `docs-inventory-disposition`, `legacy-salvage-postmvp`). They read source and ran the built CLI + test suites for ground truth.
- **Phase 2 — Verify:** 18 adversarial verifiers re-opened the cited files and tried to *refute* each CRITICAL/HIGH finding against the live working tree. Notable corrections folded into this plan: the dirty-WC-tree-vs-React-HEAD reconciliation (§B.0); 9 error codes (not 10); 205 frameworks / 219 files (not 200/218); all 28 `core/` files orphan (not "keep 6"); `utils/template-engine.ts` is LIVE via a `require()` edge; the live UI invocation is hardcoded EventSource URLs, not the dead `cli-adapters.ts`; ~164 orphan files (not 142).
- **Phase 3 — Synthesize:** 5 domain agents produced the phase sections below from the verified findings only.

The full per-area audit reports and adversarial verdicts are preserved alongside this plan's generation transcript. If a task's premise ever looks stale, re-verify against the working tree before acting — the codebase moves under uncommitted branches.
