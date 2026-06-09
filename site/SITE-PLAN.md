# Re-Shell Site — Plan (W15-1)

> Marketing landing + docs for **Re-Shell** built on **Astro + Starlight**, deployed to the GitHub
> Pages project page `https://umutkorkmaz.github.io/re-shell` (`site: 'https://umutkorkmaz.github.io'`,
> `base: '/re-shell'`). One product, two surfaces: the **CLI** (`@re-shell/cli@0.29.2`) and the
> bundled **dashboard** (`@re-shell/ui@0.3.0`), wired by the typed JSON contract
> (`@re-shell/contracts@0.1.0`). The site reuses the dashboard's **dark mission-control** brand
> exactly — it is the third surface of the same product.

---

## 1. Distilled takeaways from best-in-class dev sites

Reviewed: Bun (bun.sh), Biome (biomejs.dev), Linear (linear.app), plus Starlight/Astro/Vercel/Tailwind
docs patterns. Concrete things to steal:

- **Install command IS the primary CTA** (Bun, Biome). Hero's most prominent interactive element is a
  copy-paste-ready, OS/PM-toggled `npm i -g @re-shell/cli` block — not a generic "Get started" button.
  We reuse the dashboard's `cli-chip` terminal-chip affordance for one-click copy.
- **Show real product chrome, not marketing mockups** (Linear). Screenshots of the actual app, layered
  with implied depth, ARE the hero. We have no screenshots, so the hero is an **HTML/CSS recreation of
  the dashboard chrome** (sidebar + bento + live terminal) built from the same brand tokens — a real,
  responsive, themed artifact rather than a static image.
- **Code/terminal examples > prose; with filename/context labels and progressive disclosure** (Bun).
  Start simple (`re-shell init my-app`) and escalate to real polyglot flows. Every command block is
  monospace, syntax-highlighted, copy-ready, and labelled with intent — never bare output dumps.
- **Proof through concrete numbers, not adjectives** (Biome "~35x faster", Bun benchmark cards). Our
  equivalent honest metrics: **205 framework templates across 36 languages**, **~43ms startup**, a
  **stable typed JSON contract**, **27 command groups**. Surface these as scannable stat/feature cells,
  not vague claims.
- **Comparison / capability tables read instantly** (Bun vs Node vs Deno). Use a dense capability matrix
  (microfrontends + microservices + k8s + security + observability under one CLI) and reuse the live
  `templates matrix` grid as a real artifact on the Templates page.
- **IA: deep taxonomy by tool/feature + project phase; Ctrl+K search; version + theme switch in nav;
  dark/light first-class** (Biome, Bun, Starlight). Starlight gives us Ctrl+K (pagefind) search, prev/next,
  sidebar autogen, and theme switching out of the box — we theme it to the brand and keep the sidebar
  grouped by phase (Getting Started → Reference → Concepts → Architecture → Roadmap).
- **Restraint + purposeful motion** (Linear/Starlight). Reuse the dashboard's `stagger-in`, `pulse-live`,
  `log-flash` motion tokens for the hero terminal only; everything fully disabled under
  `prefers-reduced-motion`. No decorative gradients-as-UI; depth comes from elevation + hairline + glow.

---

## 2. Re-Shell feature + command inventory (surveyed from the real project)

**Sources:** `packages/cli/README.md`, `packages/cli/EXAMPLES.md`, `docs/CLI-CONTRACTS.md`,
`docs/ROADMAP.md`, `docs/RE_SHELL_ULTIMATE_PLAN.md`, `packages/cli/CHANGELOG.md`,
`packages/cli/src/utils/command-catalog.ts`, and live `node packages/cli/dist/index.js [<group>] --help`.

### Headline truths (verified)
- **Full-stack platform**: unites microfrontends (Module Federation: React/Vue/Svelte/Angular) AND
  polyglot microservices under one CLI.
- **205 framework templates** across **36 languages** (verified via `templates list --json`): TypeScript
  74, JavaScript 21, C# 12, Python/C++ 7 each, Go 6, Rust/Java/PHP/Lua/Kotlin/Clojure/Haskell/ReScript 4
  each, plus Ruby, Scala, Elixir, Crystal, Nim, F#, Perl, and emerging langs (Zig, V, Gleam, Mojo, Roc,
  Grain, Unison, Odin, Pony, Red, Ballerina, Julia, OCaml).
- **Stable JSON contract** (`{ok,data,warnings}` envelope, zod-defined in `@re-shell/contracts`):
  `workspace summary/graph/health`, `templates list/show/matrix`, `commands list`, `doctor`, `analyze`.
  Errors exit non-zero. The conformance suite pins the real wire shape.
- **Bundled web dashboard** (`re-shell ui`, `@re-shell/ui@0.3.0`): overview, workspace graph, templates,
  command builder, jobs & logs, health, settings. **Hardened local hub**: token-auth, bound to
  `127.0.0.1`, allow-listed, shell-free (no arbitrary command execution).
- **Interactive TUI** (`re-shell tui`, Ink) rendering real workspace data.
- **Startup** optimized (<100ms target; ~43ms achieved per ROADMAP).

### Top-level commands (from `--help`)
`init` · `create` · `add` · `remove` · `list` · `tui` · `ui` · `build` · `serve` · `doctor` ·
`analyze` · `completion` · `ai` · `templates` · `commands`

### Command groups (27 groups; key commands per group)
| Group | Purpose | Notable commands |
|-------|---------|------------------|
| `workspace` | Health, deps, sync, topology | `summary`, `graph`, `health`, `validate`, `optimize`, `import` (Nx/Turbo/Lerna/Yarn/PNPM), `migrate-monorepo`, `diff`, `def`, `graph-analysis`, `diagnostics`, `state`, `backup`, `migration` |
| `templates` | Discover/inspect framework templates | `list`, `show <id>`, `matrix`, `apply <id>` (dry-run) |
| `generate` | Scaffold code/tests/docs | `component`, `hook`, `service`, `test`, `docs`, `backend`, `feature` (CRUD/auth/file-upload/websocket/graphql) |
| `config` | Config management | `show`, `get`, `set`, `preset`, `backup/restore`, `env`, `unified`, `migrate`, `validate`, `project`, `workspace`, `template`, `diff`, `profile` |
| `quality` | Testing + IDE | `test`/`ut`, `intellisense`/`lsp` |
| `api` | API toolchain | `openapi`, `swagger`, `versioning`, `validation`, `test`, `docs`, `gateway`, `analytics`, `client` |
| `service` | Polyglot services + bridges | `bridge generate` (proto/OpenAPI/GraphQL + typed TS client + Python scaffold), `polyglot`, `run`/`svc` |
| `plugin` | Plugins/marketplace | `list`, `discover`, `install`, `info`, `enable/disable`, `hooks`, `deps`, `security-scan`, `search`/marketplace, `featured`, `popular` (~35 subcommands) |
| `k8s` | K8s/Helm/GitOps | `generate`, `manifests`, `helm`, `gitops`, `mesh`, `hpa`, `network-policy`, `crd`, `operator`, `multi-tenant`, `cicd`, `multi-cluster`, `ingress`, `pod-security`, `cluster` |
| `cloud` | Cloud + CDN | `aws`, `azure`, `gcp`, `multi`, `db`, `serverless`, `storage`, `iac`, `dr`, `cost`, `hybrid`, `resources`, `network` |
| `observe` | Metrics/tracing/logging | `metrics`, `trace`, `logs`, `apm`, `business`, `anomaly`, `scale`, `alerts` |
| `security` | Security/compliance | `vulnerability-scan`, `container-security`, `code-security`, `secret-detection`, `zero-trust`, `threat-detection`, `rbac`, `audit`, `compliance-reporting` (SOX/GDPR/HIPAA), `supply-chain-security`/SBOM (~22 subcommands) |
| `data` | DB/cache/serialization | `convert`, `schema`, `serialize`, `compress`, `lineage`, `encrypt`, `format`, `cache` |
| `collab` | Team/productivity | WebRTC sharing, terminal broadcasting, OT, code-review-workflow, feature-flag, velocity-tracking (~27 subcommands) |
| `learn` | Training/knowledge | `interactive-tutorials`, `skill-assessment`, `mentorship`, `best-practices`, `technical-docs` |
| `tools` | Dev utilities/env | `detect`, `dry-run`, `di-analyze`/`di-generate`, `snapshots`/`rollback`/`recover`, `submodule`, `migrate`, `cicd`, `dev`, `hotreload`, `devenv`, `debug` |

### Standalone commands worth a dedicated callout
- `doctor` — health checks + optional auto-fix (`--json`).
- `analyze` — bundles/deps/performance/security (`--json`).
- `completion` — install shell completion.
- `ai <prompt...>` — **offline** NL→command resolver, **never auto-runs** (`--json`, `--explain`, `--run` gated by confirmation).
- `ui` — launch hardened dashboard (`--port 3333`, `--host 127.0.0.1`, `--workspace`, `--dry-run`, `--json`, `--no-open`).

---

## 3. Information architecture

### 3.1 Landing page sections (single scroll, `site/src/pages/index.astro`)
1. **Hero** — value prop ("Full-stack platform: microfrontends + microservices, one CLI"), install
   `cli-chip` (PM toggle), primary CTA → Quickstart, secondary → GitHub/npm. Right/below: the
   **dashboard-chrome recreation** (see §4.3). Source: README overview.
2. **Stat band** — 205 templates · 36 languages · 27 command groups · ~43ms startup · typed JSON
   contract. Source: `templates list --json`, ROADMAP, CHANGELOG.
3. **Dashboard showcase** — captioned tour of the live HTML chrome (overview/graph/templates/command
   builder/jobs+logs/health) framing `re-shell ui`. Source: README "Bundled Web Dashboard", dashboard-design.md §5.
4. **Feature bento** — asymmetric grid (mixed spans, no uniform cards): Full-Stack Unity ·
   Microservices Excellence · Microfrontend Architecture · K8s/Helm/GitOps · Observability · Security &
   Compliance · Typed JSON Contract · AI command resolver. Source: README "Key Capabilities".
5. **Command tour** — tabbed/scrollytelling terminal walkthrough: `init` → `add` → `templates show`
   → `generate feature` → `doctor`/`analyze --json` → `ui`. Copy-ready blocks. Source: EXAMPLES.md.
6. **Install / quickstart** — `npm i -g @re-shell/cli`, `re-shell init`, `re-shell ui`. Source: README.
7. **Why Re-Shell** — one CLI vs stitched tools; capability matrix; honest scope (MVP-done vs
   post-MVP). Source: ROADMAP status legend.
8. **Footer / CTA** — docs, GitHub (`UmutKorkmaz/re-shell`), npm, roadmap, license; final install CTA.

### 3.2 Docs tree (Starlight, `site/src/content/docs/**`)
Each page → its content source. Sidebar grouped by phase.

**Getting Started**
- `getting-started/install.md` — npm global / per-project, requirements, verify, shell completion. ← README install, `completion --help`.
- `getting-started/quickstart.md` — `init` → `add` → `serve`/`build` → `ui` in ~5 min. ← README quick-start, EXAMPLES.md "Getting Started".
- `getting-started/concepts.md` — monorepo, `re-shell.workspaces.yaml` (v2), microfrontend vs microservice, the hub. ← README, ROADMAP "Foundation", docs/control-plane.md.

**CLI Reference** (one page per group/area)
- `cli/overview.md` — top-level commands + `commands list` introspection. ← root `--help`, command-catalog.ts.
- `cli/workspace.md` — ← `workspace --help`, ROADMAP "Workspace graph intelligence".
- `cli/templates.md` — `list`/`show`/`matrix`/`apply` + the 205/36 catalog link. ← `templates --help`.
- `cli/generate.md` — components/hooks/services/backend/feature. ← `generate --help`, EXAMPLES.
- `cli/doctor-analyze.md` — health checks + bundle/dep/perf/security analysis, `--json`. ← `doctor`/`analyze --help`, CLI-CONTRACTS.
- `cli/completion.md` — shell completion install. ← `completion --help`.
- `cli/ai.md` — offline NL→command resolver, safety (never auto-runs). ← `ai --help`, ROADMAP "AI-assisted".
- `cli/api.md` — OpenAPI/Swagger/gateway/client. ← `api --help`.
- `cli/service-bridge.md` — polyglot services + cross-language bridges. ← `service`/`service bridge --help`, ROADMAP cross-language bridge.
- `cli/k8s-helm-gitops.md` — manifests/Helm/GitOps/mesh/HPA/operators. ← `k8s --help`.
- `cli/cloud.md` — AWS/Azure/GCP/multi/serverless/IaC. ← `cloud --help`.
- `cli/observe.md` — metrics/trace/logs/apm/alerts. ← `observe --help`.
- `cli/security.md` — scanning/RBAC/audit/compliance/SBOM. ← `security --help`.
- `cli/data.md` — schema/serialize/cache/lineage/encrypt. ← `data --help`.
- `cli/collab-learn.md` — collaboration + learning suites. ← `collab`/`learn --help`.
- `cli/plugin.md` — plugin lifecycle + marketplace. ← `plugin --help`, ROADMAP "Plugin architecture".
- `cli/tools-config-quality.md` — tools/config/quality utility groups. ← respective `--help`.

**Concepts / Integration**
- `contract/json-contract.md` — `{ok,data,warnings}` envelope, error codes, per-command payloads, conformance. ← docs/CLI-CONTRACTS.md, `@re-shell/contracts`.
- `dashboard/overview.md` — `re-shell ui`, the seven screens, launch flags, hardened hub. ← README dashboard, `ui --help`, dashboard-design.md, docs/control-plane.md.
- `templates/catalog.md` — full 205-template catalog + 36-language breakdown. ← `templates list`.
- `templates/matrix.md` — live compatibility matrix (lang/framework/db/cache/deploy). ← `templates matrix`.

**Architecture**
- `architecture/monorepo.md` — packages: `cli` + `ui` + `contracts` (+ `apps/web`/this site). ← ROADMAP intro, repo layout.
- `architecture/contracts-package.md` — `@re-shell/contracts` as single source of truth (zod). ← CLI-CONTRACTS "Source of truth".
- `architecture/secure-hub.md` — token-auth, 127.0.0.1 binding, allow-list, shell-free bridge. ← README v0.29, docs/control-plane.md.

**Roadmap**
- `roadmap.md` — MVP-done / DONE+tested / SCAFFOLD / post-MVP-planned / DROPPED. ← docs/ROADMAP.md verbatim status.

---

## 4. Design spec

### 4.1 Token + font reuse (one product, three surfaces)
- **Copy the dashboard tokens verbatim** from `packages/ui/src/styles/globals.css` into the site's global
  stylesheet: full dark (`:root`/`.dark`) + light (`.light`) OKLCH stacks, the `@supports not (color:
  oklch)` hex fallback, elevation stack (`--bg-0..3`), `--signal` (dark `oklch(0.86 0.21 130)` / #c4f042;
  light `oklch(0.74 0.18 130)` / #8fb834), status colors (healthy/warn/critical/info) with glow,
  `--border`/`--border-strong`/`--ring`, `--radius: 0.625rem`, and motion tokens
  (`--dur-fast/normal/slow`, `--ease-out-expo`, `--ease-standard`).
- **Self-hosted fonts via @fontsource** (NO Google CDN): Space Grotesk (display/headings/labels),
  JetBrains Mono (commands/data/code/metrics — always `tabular-nums`), Inter (body). Same weights the
  dashboard imports (`pnpm add @fontsource/{space-grotesk,jetbrains-mono,inter}` — single bounded install).
- **Reuse the utility layer**: `surface`, `surface-raised`, `surface-pop`, `hairline`, `label-eyebrow`,
  `cli-chip`, `status-badge` + variants, `stagger-children`, `screen-enter`, `skeleton`. Ported into the
  site so landing components and Starlight overrides share one vocabulary. Default theme = **dark**;
  refined light companion supported via the brand light stack (NOT pastel).
- **Anti-slop guardrails** (from dashboard-design.md §6): elevation + hairline + inner-top-highlight for
  depth (no decorative gradients-as-UI), ONE accent used semantically, distinct status colors, mono for
  all commands/numbers, designed hover/focus/active states, purposeful motion disabled under reduced-motion.

### 4.2 Starlight theme-override approach
Map Starlight's CSS custom properties to the brand in a `custom.css` injected via
`starlight({ customCss: [...] })`:
- `--sl-color-bg` → `var(--bg-0)`; `--sl-color-bg-nav`/`--sl-color-bg-sidebar` → `var(--bg-1)`;
  panels/cards → `surface` utility; popovers → `var(--bg-3)`.
- `--sl-color-accent` / `--sl-color-accent-high` / `--sl-color-text-accent` → `var(--signal)` (links,
  active sidebar item, focus ring → `--ring`).
- `--sl-color-text` → `var(--foreground)`; `--sl-color-gray-*` remapped onto the muted/foreground scale.
- `--sl-color-hairline`/border vars → `var(--border)`; raise `--sl-shadow-*` to the `elev-1..3` recipes.
- Fonts: `--sl-font` → Inter, `--sl-font-mono` → JetBrains Mono; headings → Space Grotesk via a heading
  selector override. Code blocks (Expressive Code / Shiki) themed dark-default with a `cli-chip`-style
  copy button; light theme uses the companion stack. Both themes wired through Starlight's
  `data-theme` ↔ our `.dark`/`.light` classes (single source of truth).
- Sidebar grouped per §3.2; Ctrl+K pagefind search kept; left nav active item gets the signal left-bar +
  glow exactly like the dashboard sidebar.

### 4.3 Hero concept — **CHOSEN: live HTML/CSS recreation of the dashboard chrome**
We have no screenshots, so the hero is a **real, responsive, themed recreation of the mission-control
dashboard** built entirely from the brand tokens/utilities — making the landing page a genuine third
surface of the product rather than a faked image. Composition (mirrors dashboard-design.md §5):

- **App-shell frame**: fixed-style sidebar (`w-60`, on `--bg-0`, hairline right border) with
  `font-display` nav rows (Overview/Graph/Templates/Builder/Jobs/Health) and a **signal left-indicator
  bar + glow on the active row**; top-bar (`h-14`, `--bg-1`, hairline bottom) with a mono breadcrumb
  path, a `cli-chip` copy affordance (the install command), a **`pulse-live` signal status dot**, and the
  theme toggle.
- **Bento overview** inside the frame: one large hero-metric panel (big mono number + sparkline +
  `label-eyebrow`), flanked by smaller `status-badge` tiles and a recent-jobs strip — mixed spans,
  `surface`/`surface-raised` elevation contrast, single signal CTA.
- **Live terminal panel** (`--bg-0`, JetBrains Mono, leading line marker) that types the real command
  tour (`re-shell init` → `templates show` → `re-shell ui`) using `stagger-in` + `log-flash`, with a
  `cli-chip` copy button — doubling as the install CTA.
- **Motion**: page-load `stagger-children`/`screen-enter` on panels, `pulse-live` on the live dot,
  `log-flash` on new terminal lines — all killed under `prefers-reduced-motion`.
- **Responsive**: on narrow viewports the sidebar collapses to an icon rail and the bento reflows to a
  single column with the terminal panel stacked beneath the hero copy; no horizontal overflow at
  320/375/768/1024/1440.

This delivers Linear-grade "real product as hero" credibility, Bun/Biome-grade install-first CTA, and
proves the dark mission-control brand on the marketing surface using the exact same tokens, fonts, and
utilities as `@re-shell/ui`.

---

## 5. Acceptance recap
- ✅ Takeaways (§1), command inventory (§2), IA page list (§3), design spec (§4).
- **Chosen hero concept:** live HTML/CSS recreation of the dashboard chrome (sidebar + bento + live
  terminal), themed from the dashboard tokens — no screenshots required.
