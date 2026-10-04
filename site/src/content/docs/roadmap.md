---
title: "Roadmap"
description: "Re-Shell delivery status: what is done and tested, what is environment-limited, what is partial, and what was dropped."
---

This is the status page for the Re-Shell monorepo. It records what was **checked**, not
what was hoped for. The authoritative, more detailed version, with the test files and
commands behind each claim, is
[`docs/ROADMAP.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/ROADMAP.md);
release gates are in
[`docs/STABILITY.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/STABILITY.md).

## Snapshot

| Fact | Value |
| --- | --- |
| CLI | `0.31.0` in the tree; **`0.30.1` is the last published version** |
| Other packages | contracts `0.3.0` (published `0.2.0`), mcp `0.2.0` (published `0.1.0`), ui `0.6.0` (published `0.5.0`) |
| Commands | **585** command paths in **46** top-level commands (`re-shell commands list --json`) |
| Backend templates | **208** across **36** languages (`re-shell templates list --json`) |
| Dashboard | **11** screens |
| Startup | Lazy command loading: `--version` about 45 ms, `--help` about 100 ms (median of 10 runs on the development VM; `--help` took about 2.6 s before). Measured, machine-dependent. The older "under 100 ms, about 43 ms" claim was true only for `--version`. |

Nothing has been published or deployed by this work. "Pending first CI run" means a
workflow exists but no hosted run has executed it yet.

## Status legend

- **DONE+tested**: implemented and covered by automated tests that run in CI (or a script that was run for real).
- **DONE (env-limited: ...)**: implemented and tested except for the named part, which needs something the development environment did not have.
- **PARTIAL (...)**: part of the feature exists; the parentheses say what is missing.
- **DROPPED**: removed from scope on purpose.

## CLI platform

| Area | Status |
| --- | --- |
| Config, workspaces (schema v2), dependency graph, state, change impact, incremental builds | DONE+tested |
| Single-envelope `--json` contract (`COMMAND_ERROR` / `USAGE_ERROR`, incidental output on stderr, `--version` only the version, EPIPE handled), `doctor` as a gate, completion generated from the live tree | DONE+tested |
| Lazy command loading | DONE+tested (a regression test asserts which modules load) |
| Resource governor: `run --max-memory --rate-limit`, same on `workspace ibuild build` | DONE+tested |
| Compliance audit trail, `security audit verify`, `security compliance report` | DONE+tested (evidence collection, not a certification) |
| Real `analyze --type architecture\|scalability` and `--fail-on` | DONE+tested |
| Profile insights and optimization from recorded history (`config profile insights\|optimize`), `dev --profile` | DONE+tested |
| `pkg`, `debug config`, `refactor rename-service` | DONE+tested |
| `cloud iac generate\|validate`, `cloud deploy` | DONE (env-limited: `cloud deploy` needs real credentials and was never run against an account; Terraform validation runs in CI) |
| `fix --ci` | DONE (env-limited: no live LLM call) |
| Backend template registry: 208 templates, every placeholder substituted (including in file paths), at least 3 templates per emerging runtime (Deno, Bun, Kotlin, Scala, Crystal, Zig, Elixir, Nim) | DONE+tested |
| Generated projects install, build and boot | Done: 172 of the 208 templates build with their own toolchain in hosted CI, and 8 Node/Bun templates boot; the other 36 need a registry or toolchain that was not available, and are listed on the [catalog page](/re-shell/templates/catalog/#verification) |
| `create` non-interactive in every mode, honest skeletons, dry-run diffs | DONE+tested |

## UI / dashboard

| Area | Status |
| --- | --- |
| shadcn-React component system, exact wire schemas and adapters, 11-screen dashboard over the token-authed hub | DONE+tested |
| `re-shell ui` fails if the hub is unhealthy; hub URL pinned to loopback | DONE+tested |
| WCAG 2.1 AA work (skip link, focus management, live regions, contrast in both themes) | DONE+tested (axe audit passes in hosted CI; automated checks are not a manual audit) |
| Code splitting with enforced gzip budgets | DONE+tested |
| Storybook 9 and a real `ui test` runner (interaction, a11y, visual; an empty run is an error) | DONE+tested (CI job pending first run) |
| `ui component new`, `ui generate`, `ui theme ...`, white-label (`re-shell.whitelabel.json`, `RE_SHELL_BRAND_*`) | DONE+tested (theme search on the live npm registry not exercised) |
| Polymorphic `Box`/`Text`/`Stack`, branded CSS units | DONE+tested (the earlier "shipped" claim was premature; it is true now) |

## Phase 9

| ID | Feature | Status |
| --- | --- | --- |
| P9-A | [AI](/re-shell/cli/ai/): Anthropic, OpenAI-compatible and offline providers, sessions, cache, `ai suggest`, `@re-shell/cli/ai` | DONE (env-limited: no live LLM call, no key) |
| P9-B | [Bridge](/re-shell/cli/service-bridge/): spec-driven clients, `service link\|unlink\|validate`, gateway, async (Kafka, Redis Streams), transform, diff, mock | DONE+tested (broker round trips need Docker and skip without it) |
| P9-C | workspace.yaml v2 JSON Schema, served by this site; every writer emits valid v2 | DONE+tested (live URL not reachable from the development environment; Pages verifies it post-deploy) |
| P9-D | [Kubernetes](/re-shell/cli/k8s-helm-gitops/): hardened manifests, Helm, GitOps (Flux defaults to HelmRelease), `k8s rollback`, CRD, operator, mesh | DONE (env-limited: live k3s checks steps 1-8 ran locally; Flux and Argo CD sync only in CI) |
| P9-E | `workspace migrate-monorepo` Nx/Turbo importer | DONE+tested |
| P9-F | [Plugins](/re-shell/cli/plugin/): uninstall, update, validate, pin, review, ratings | DONE+tested (against a fake registry; live npm not asserted) |
| P9-G | [Policy packs](/re-shell/cli/workspace/#workspace-policy) and drift | DONE+tested |
| P9-H | Template matrix and dry-run diffs | DONE+tested |
| P9-I | [VS Code extension](/re-shell/integrations/vscode/) | DONE (env-limited: the host test could not download VS Code; CI) |
| P9-J | [Control plane](/re-shell/architecture/control-plane/) | DONE+tested, **not deployed** |
| P9-K | [Desktop app](/re-shell/integrations/desktop/) | DONE (env-limited: Linux built and smoke-tested; macOS and Windows only in CI; never signed) |
| P9-L | [Graph explorer](/re-shell/dashboard/overview/#the-workspace-graph-explorer), `workspace graph diff`, `workspace status`, `workspace explore` | DONE+tested |
| P9-M | `dev --profile` | DONE+tested |
| P9-N | [Collaboration](/re-shell/integrations/collaboration/) | DONE (env-limited: no TURN server; control plane not deployed) |

## Remaining items

Everything left depends on something outside the development environment:

- The VS Code host test (network access to download VS Code; runs in CI).
- Signed and notarized desktop builds (signing secrets in the repository).
- Flux and Argo CD sync against a live cluster (registry egress; Flux runs in CI).
- `cloud deploy` against a real account (cloud credentials).
- Live LLM calls for `ai`, `ui generate` and `fix --ci` (an API key or a local server).
- Broker round-trip tests (Docker).
- Public hosting of the control plane (a deployment target, TLS, a security review).
- WebRTC across symmetric NATs (a TURN server).
- The first hosted run of the workflows that run only on `main` and pull requests (`ci.yml`, VS Code extension, k8s-live, IaC validation, desktop); `template-health` and `accessibility` already pass on GitHub.
- Building the 36 templates whose registry or toolchain was unavailable (hex, Clojars, nimble, shards, opam, deno.land, Swift, Julia, V, Gleam and others; see the [catalog page](/re-shell/templates/catalog/#verification)).

## Explicitly dropped

Recorded so the decision stays explicit:

- **Quantum computing integration.**
- **Blockchain / Web3** (smart-contract templates, dApp workflows).
- **VR/AR / immersive development environments.**
- **Voice or neural "natural-language-as-primary-interface"** as a core pillar. (A narrow, optional, provider-abstracted AI assist remains: [`ai`](/re-shell/cli/ai/).)

These are speculative and mission-divergent; the value is a polyglot workspace and
microfrontend toolkit with a typed CLI-to-UI [contract](/re-shell/contract/json-contract/).
