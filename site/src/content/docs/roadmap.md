---
title: "Roadmap"
description: "Re-Shell delivery status: what is done and tested, what is environment-limited, what is partial, and what was dropped."
---

This is the status page for the Re-Shell monorepo. It records what was **checked**, not
what was hoped for. The October 23 local verification for this release line is in
[`docs/DEVELOPMENT_STATUS.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/DEVELOPMENT_STATUS.md).
The earlier feature inventory, with test files and commands, is
[`docs/ROADMAP.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/ROADMAP.md);
release gates are in
[`docs/STABILITY.md`](https://github.com/UmutKorkmaz/re-shell/blob/main/docs/STABILITY.md).

## Snapshot

| Fact | Value |
| --- | --- |
| CLI | `0.33.0` source for this release line; previous line `0.32.0` |
| Other packages | Source: contracts `0.3.2`, MCP `0.3.1`, UI `0.7.0`; previous line: `0.3.1`, `0.3.0`, `0.6.1` respectively |
| Commands | **585** command paths in **46** top-level commands (`re-shell commands list --json`) |
| Backend templates | **204** across **35** languages and **169** frameworks (`re-shell templates list --json`) |
| Dashboard | **12** screens |
| Startup | Lazy command loading: `--version` about 45 ms, `--help` about 100 ms (median of 10 runs on the development VM; `--help` took about 2.6 s before). Measured, machine-dependent. The older "under 100 ms, about 43 ms" claim was true only for `--version`. |

These versions identify this release line's source. Check the primary
[npm CLI entry](https://www.npmjs.com/package/@re-shell/cli) and
[GitHub releases](https://github.com/UmutKorkmaz/re-shell/releases) for distribution
status; building or testing source does not publish packages. Marketplace
publication and signed desktop distribution are deferred.
The selected control-plane hosting scope is local Docker staging; public cloud
hosting was not requested and multi-node operation is outside this release scope.

The earlier four-package
[v0.31.0 release](https://github.com/UmutKorkmaz/re-shell/releases/tag/v0.31.0) on
October 5 had a successful
[publish workflow](https://github.com/UmutKorkmaz/re-shell/actions/runs/37273442085).
Historical GitHub checks passed on pull request #395 (commit `3a06508`), including
all 19 template-health jobs
([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37245729171)). Those runs
and the feature inventory below apply to their linked revisions. Hosted execution
results are in the [CI workflow](https://github.com/UmutKorkmaz/re-shell/actions/workflows/ci.yml).

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
| `fix --ci` | 31 targeted regression tests pass; a live provider-driven fix is not covered by the separate AI resolver proof. |
| Backend template registry: 204 templates, every placeholder substituted (including in file paths), at least 3 templates per emerging runtime (Deno, Bun, Kotlin, Scala, Crystal, Zig, Elixir, Nim) | DONE+tested |
| Generated projects install, build and boot | **All 204 templates build with their own toolchain in hosted CI** ([run](https://github.com/UmutKorkmaz/re-shell/actions/runs/37245729171)), and 8 Node/Bun templates boot. Of the 32 added last, 14 were also built locally with their real toolchain and 18 could not be. 4 infeasible templates (`perfect`, `roc`, `carbon`, `vale`) were removed. See the [catalog page](/re-shell/templates/catalog/#verification) |
| `create` non-interactive in every mode, honest skeletons, dry-run diffs | DONE+tested |

## UI / dashboard

| Area | Status |
| --- | --- |
| shadcn-React component system, exact wire schemas and adapters, 12-screen dashboard over the token-authed hub | DONE+tested |
| `re-shell ui` fails if the hub is unhealthy; hub URL pinned to loopback | DONE+tested |
| WCAG 2.1 AA work (skip link, focus management, live regions, contrast in both themes) | DONE+tested (axe audit passes in hosted CI; automated checks are not a manual audit) |
| Code splitting with enforced gzip budgets | DONE+tested |
| Storybook 10.6 and a real `ui test` runner (interaction, a11y, visual; an empty run is an error) | Implemented; the earlier Storybook 9 CI job passed on PR #395. Consult the CI workflow for later execution results. |
| `ui component new`, `ui generate`, `ui theme ...`, white-label (`re-shell.whitelabel.json`, `RE_SHELL_BRAND_*`) | DONE+tested (theme search on the live npm registry not exercised) |
| Polymorphic `Box`/`Text`/`Stack`, branded CSS units | DONE+tested (the earlier "shipped" claim was premature; it is true now) |

## Phase 9

| ID | Feature | Status |
| --- | --- | --- |
| P9-A | [AI](/re-shell/cli/ai/): Anthropic, OpenAI-compatible and offline providers, sessions, cache, `ai suggest`, `@re-shell/cli/ai` | Eight real network tests pass with Ollama's OpenAI-compatible `gemma4:31b-cloud`, without offline fallback. Eight Anthropic tests skip; that provider remains unverified. |
| P9-B | [Bridge](/re-shell/cli/service-bridge/): spec-driven clients, `service link\|unlink\|validate`, gateway, async (Kafka, Redis Streams), transform, diff, mock | DONE+tested (broker round trips need Docker and skip without it) |
| P9-C | workspace.yaml v2 JSON Schema, served by this site; every writer emits valid v2 | DONE+tested (live URL not reachable from the development environment; Pages verifies it post-deploy) |
| P9-D | [Kubernetes](/re-shell/cli/k8s-helm-gitops/): hardened manifests, Helm, GitOps (Flux defaults to HelmRelease), `k8s rollback`, CRD, operator, mesh | DONE (env-limited: live k3s checks steps 1-8 ran locally; Flux and Argo CD sync only in CI) |
| P9-E | `workspace migrate-monorepo` Nx/Turbo importer | DONE+tested |
| P9-F | [Plugins](/re-shell/cli/plugin/): uninstall, update, validate, pin, review, ratings | DONE+tested (against a fake registry; live npm not asserted) |
| P9-G | [Policy packs](/re-shell/cli/workspace/#workspace-policy) and drift | DONE+tested |
| P9-H | Template matrix and dry-run diffs | DONE+tested |
| P9-I | [VS Code extension](/re-shell/integrations/vscode/) | DONE (env-limited: the host test could not download VS Code; CI) |
| P9-J | [Control plane](/re-shell/architecture/control-plane/) | Local API/worker, tracing/WAL recovery and per-job Docker checks pass. The full genuine Keycloak 26.4.0 SSO lifecycle passes against the frozen production dashboard. Public hosting not requested; other providers remain separate scopes. |
| P9-K | [Desktop app](/re-shell/integrations/desktop/) | DONE (env-limited: Linux built and smoke-tested; macOS and Windows only in CI; never signed) |
| P9-L | [Graph explorer](/re-shell/dashboard/overview/#the-workspace-graph-explorer), `workspace graph diff`, `workspace status`, `workspace explore` | DONE+tested |
| P9-M | `dev --profile` | DONE+tested |
| P9-N | [Collaboration](/re-shell/integrations/collaboration/) | Actual local forced TURN relay passes in two browser contexts; both endpoints select relay candidates and bidirectional pings use zero server fallback sends. Public network/NAT compatibility remains unverified. |

## Remaining items

Local verification for this release line includes **329** contracts, **318** UI-package,
**73** MCP, **402** control-plane and **52/400** dashboard hub/UI tests passing.
The control-plane suite skips **7** optional tests and reports **91.73%** line
coverage; **8** separate tracing/WAL recovery tests and all **7** real Docker
isolation checks pass on the fresh minimal CLI **0.33.0** job image. The 8
tracing/operations tests also pass on actual Node **22.13.0**. All seven configured
typecheck targets and root ESLint pass locally. Both collaboration E2Es pass with Chrome **155**; **12**
core flows pass in bundled Chromium. Its direct ICE limitation also reproduces in
an independent raw WebRTC probe.

Full/production workspace audits and a clean four-package npm consumer production audit report
zero findings. The final full CLI run has **8,518 passed / 53 skipped**, with
**441** files passing and **4** skipped. The final scoped coverage run has
**8,104 passed / 34 skipped**, with **394** files passing and **1** skipped.
Coverage is **92.27%** statements, **84.23%** branches, **90.05%** functions and
**93.53%** lines; all unchanged **80%** thresholds pass. The fresh complete
four-tarball smoke now passes **13/13**, including installed Apollo composition
and conflict rejection, CLI **0.33.0** with **204** templates and dashboard assets,
MCP **0.3.1** with **9** tools, and UI ESM/CommonJS/SSR/consuming-Vite checks.
UI/dashboard size budgets and all **776** documented-command checks pass locally.
Keycloak 26.4.0 passes password/PKCE login, proactive
rotation, latest-token provider revocation and logout against the frozen production
dashboard. The same API JWT is accepted before sign-out and rejected while still
unexpired afterward; fresh login requires a password, and independent consumed
refresh replay is rejected. All 39 SSO regression tests pass. The CI workflow
records hosted results; the release and registry entries above establish
publication. See the development status record for local evidence and limits.

External validation and deferred distribution remain separate:

- Signed/notarized desktop distribution and VS Code Marketplace publication are deferred.
- `cloud deploy` and live Argo CD require an explicitly selected real account/cluster.
- Eight actual OpenAI-compatible AI tests now pass; Anthropic and other provider configurations remain unverified.
- Public control-plane hosting and production TURN/NAT deployment were not requested.
- Multi-node database/broker adoption is outside this release scope.

## Explicitly dropped

Recorded so the decision stays explicit:

- **Quantum computing integration.**
- **Blockchain / Web3** (smart-contract templates, dApp workflows).
- **VR/AR / immersive development environments.**
- **Voice or neural "natural-language-as-primary-interface"** as a core pillar. (A narrow, optional, provider-abstracted AI assist remains: [`ai`](/re-shell/cli/ai/).)

These are speculative and mission-divergent; the value is a polyglot workspace and
microfrontend toolkit with a typed CLI-to-UI [contract](/re-shell/contract/json-contract/).
