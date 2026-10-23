# October 23, 2026 release-line verification

**Last updated:** 2026-10-23. This checkout contains CLI **0.33.0**, contracts
**0.3.2**, MCP **0.3.1**, UI **0.7.0** and private control plane **0.2.0**.
These identify this release line's source. The previous release line used CLI
**0.32.0**, contracts **0.3.1**, MCP **0.3.0** and UI **0.6.1**. Check the primary
[GitHub releases](https://github.com/UmutKorkmaz/re-shell/releases) and
[npm CLI](https://www.npmjs.com/package/@re-shell/cli),
[contracts](https://www.npmjs.com/package/@re-shell/contracts),
[MCP](https://www.npmjs.com/package/@re-shell/mcp) and
[UI](https://www.npmjs.com/package/@re-shell/ui) entries for distribution status.
Building or testing this checkout does not update those artifacts.

CLI, dashboard hub, MCP and control plane require **Node.js 22.13.0+**. The local
validation host uses Node **22.22.3**; that does not raise the declared floor.
The **8** tracing/operations tests also pass on actual Node **22.13.0**. This is
minimum-version proof for that scope, rather than a full-suite minimum-version run.

| Work | Implemented in this release line | Verification and remaining gates |
|---|---|---|
| Package and tooling updates | Updated manifests/lockfile, build tooling and checked Apollo composition bundle | Full CLI **8,518**, contracts **329**, UI package **318**, MCP **73**, control plane **402** and dashboard hub/UI **52/400** tests pass. CLI and control-plane runs skip **53** and **7** tests respectively. All seven configured typecheck targets, root ESLint and UI/dashboard size budgets pass locally. Fresh clean-package smoke passes **13/13**; whole-CLI branch coverage is recorded below. Hosted results are available in the [CI workflow](https://github.com/UmutKorkmaz/re-shell/actions/workflows/ci.yml). |
| Dependency hardening | Patched dependency resolutions; Apollo **2.14.4** bundled with reviewed UUID **11.1.1**, shared `graphql` kept external, inventory/licenses emitted | October 23 full/production workspace audits and the fresh four-tarball npm consumer production audit report zero findings. The complete **13/13** package smoke passes, including actual installed Apollo entity composition and invalid-federation rejection. See audit and verification scope below. |
| Browser SSO lifecycle | Pinned RS256 JWKS and public-client authorization code with S256 PKCE, memory-only refresh credentials, access-token renewal/rotation, optional provider revocation/logout, durable API fingerprint revocation | The full genuine Keycloak **26.4.0** lifecycle passes against the frozen production dashboard: password login, PKCE/issuer/callback/API audience and membership, proactive browser rotation, latest-credential provider revocation and logout. The API token returns **200 before / 401 after** sign-out while still unexpired; a new login requires a password, and consumed-refresh replay returns **400** in a separate fresh session. **39** SSO regression tests pass, including the native-browser fetch sign-out fix. See [OIDC](./OIDC.md). |
| Observability and recovery | Opt-in OTLP HTTP JSON across API/job/worker boundaries, consistent SQLite WAL snapshots, offline restore and rollback procedure | **8** tracing/operations tests pass, including on actual Node **22.13.0**, separate built API and worker processes, a local OTLP receiver, restored membership/revocation/audit/queue state and expired-lease recovery. Remote collectors and production recovery remain unverified. See [observability](./observability.md). |
| Per-job Docker isolation | Explicit process/Docker modes; immutable job image, exact workspace bind, no network, scrubbed image environment, non-root identity, resource/capability bounds, exact-owner cleanup and serialized stale-lock recovery | The freshly built minimal job image contains CLI **0.33.0**, and all **7** real Docker checks pass against it: actual allowlisted CLI, denials/resource inspection, scoped recovery, timeout/cancel/shutdown/output-limit cleanup and anonymous-volume removal. Process mode remains trusted local execution. See [job isolation](./job-isolation.md). |
| TURN transport | Opt-in forced-relay integration using the application `PeerLink` in two browser contexts | Actual local TURN run passes: both endpoints select relay candidates, bidirectional pings succeed, and the control-plane relay fallback records **0** sends. This verifies that local TURN configuration; it does not establish arbitrary NAT/provider compatibility. See [local integrations](./local-integrations.md). |
| Administration and local staging | Tenant/member/policy/audit UI, platform-admin metrics and request IDs; private, disposable Docker staging | **12** core browser flows pass in bundled Chromium. Both collaboration E2Es pass in Chrome **155**, covering P2P, editor/console, handover and forced server fallback. Four viewport captures report no page errors or overflow. Local Docker staging is the selected hosting scope. Public cloud deployment was not requested. |
| Desktop and VS Code | Workspace picker, bundled Node, hub recovery, opt-in updater; VSIX build/publish workflow | Earlier native macOS flows and Rust/extension checks passed. Signed desktop distribution and Marketplace publication are explicitly deferred; installed Windows/Linux proof remains separate. |
| External integrations | Provider adapters and cloud/GitOps commands | **8** actual network AI tests pass through the existing Ollama OpenAI-compatible configuration with `gemma4:31b-cloud`, without offline fallback; **8** Anthropic tests skip. This supersedes the earlier quota/billing-only attempts. Live cloud-account and Argo CD validation remain unverified. |

The main implementation received independent code review with no remaining P0–P2
findings at that review point, before the latest symlinked Git rename fix. This
is a source review, not an external security certification, provider approval,
successful current CI run or publication proof.

The control plane remains **single-node**, with SQLite and in-process fan-out.
Multi-node database/broker adoption is outside this release scope. The process-mode
worker is not a sandbox; Docker mode uses a dedicated trusted local daemon and
shares its Linux kernel. Neither local test mode establishes hostile-tenant
production isolation.

## Local verification and pending gates

The final full CLI run passes **8,518** tests with **53** skipped: **441** files
pass and **4** skip (**445** total). This supersedes the earlier failing run.
The final scoped CLI coverage run passes **8,104** tests with **34** skipped:
**394** files pass and **1** skips. Coverage is **92.27%** statements, **84.23%**
branches, **90.05%** functions and **93.53%** lines. Every unchanged **80%**
threshold passes. This complete configured run supersedes the earlier failing
coverage result and the intervening focused registry/cache/failure-path runs.

Fresh local package coverage is:

| Scope | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|
| Scoped CLI coverage | 8,104 passed, 34 skipped | 92.27% | 84.23% | 90.05% | 93.53% |
| UI package | 318 passed | 93.55% | 83.73% | 96.64% | 95.29% |
| Dashboard UI | 400 passed, 40 files | 88.97% | 81.64% | 83.70% | 90.34% |
| Control plane | 402 passed, 7 skipped | 89.85% | 84.09% | 93.32% | 91.73% |

Dashboard hub tests pass **52/52**. All seven configured typecheck targets and
root ESLint pass, including the updated SSO hook's targeted checks. UI/dashboard
size budgets pass. Validation of **776** documented commands in **71** files
reports **0** errors and **0** flag warnings. These are local results, separate
from current hosted CI.

The final clean four-tarball smoke passes **13/13**. A fresh npm consumer verifies
CLI **0.33.0**, all **204** templates, the bundled dashboard, MCP **0.3.1**
initialization with **9** tools, UI ESM/CommonJS/hooks/SSR and consuming-Vite
environment behavior. Installed Apollo entity composition and invalid-federation
rejection pass with Apollo **2.14.4**, UUID **11.1.1** and shared `graphql`.
The consumer production audit reports **0** vulnerabilities. Verified local
tarballs are exported to `/tmp/re-shell-033-release-assets`; these are local
release inputs, not proof of registry publication.

Both collaboration scenarios pass with Chrome **155**. The default bundled
Chromium **156** fails direct ICE connection establishment; an independent raw
WebRTC probe reproduces that host/browser limitation. Its **12** core dashboard
flows pass. The forced TURN check is separate evidence from the collaboration
test's server fallback. Four loaded viewport captures are under
`.design/screenshots/2026-10-23-stabilization`; the recorded metrics report no
page errors or horizontal overflow at 390×844, 1024×768, 1280×800 and 1440×900.

The new local-staging workflow requires actual Keycloak, TURN, Docker isolation
and OTLP/recovery checks. Consult the
[local-staging workflow](https://github.com/UmutKorkmaz/re-shell/actions/workflows/local-staging.yml)
and [CI workflow](https://github.com/UmutKorkmaz/re-shell/actions/workflows/ci.yml)
for hosted execution results. Release and registry entries above establish
publication; local builds and tests do not publish packages.

The final Keycloak script passes again after the latest renewal fix, with cleanup
confirmed, using the official **26.4.0** image and a frozen production dashboard
bundle. With Remember disabled, no issued credentials enter
browser storage. Provider revocation of the exact latest refresh and access tokens
returns **200**, logout redirects successfully, and the previously accepted API
JWT is denied before expiry. A fresh password login and independent consumed-token
replay rejection complete the local provider proof. This verifies that exact local
provider configuration; it does not establish other providers or public hosting.
The native browser fetch sign-out fix has a failing-before/passing-after regression.
All **39** SSO regression tests pass, including Remember races and repeated renewal
across three cycles when the provider returns the same access-token string.
The fresh CLI **0.33.0** minimal job image also passes all **7/7** Docker checks;
its local image ID is recorded in [job isolation](./job-isolation.md).

## Dependency audit scope

Fresh October 23 `pnpm audit --json` reports contain **0 findings** across **1,842**
reported workspace dependencies; `pnpm audit --prod --json` contains **0 findings**
across **811** reported dependencies. These are the counts returned by the current
audit API for this lockfile and those scopes. They are not a guarantee that every
dependency or execution path is secure.

Earlier workspace and packed-npm reports contained development-tool findings and
six moderate affected-package reports through Apollo/UUID
([GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq)). The
release line's composition bundle pins the reviewed UUID version and checks its
actual included inputs. The current zero-count workspace reports do not establish
that an upstream advisory was withdrawn, and workspace overrides alone do not
prove a clean installed npm consumer. A separate clean npm installation of the
four packed source packages now also reports **0 production findings**. This
establishes that reported consumer audit scope. The complete **13/13** runtime
smoke also passes; neither result establishes registry publication or universal
dependency safety.

## Deferred distribution

Marketplace extension and signed desktop publication are deferred. Public desktop
signing requires a Developer ID Application identity/notarization credentials for
macOS, Windows signing credentials and the updater signing key. Available Apple
Development/Distribution identities do not provide public macOS Developer ID
signing. No signed desktop release is claimed. GitHub/npm publication of the four
public packages is a separate release-workflow action, established by the primary
release/registry entries above. The control plane and dashboard are private packages.
