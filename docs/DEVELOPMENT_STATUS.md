# October 12, 2026 hardening release candidate

The prepared npm versions are CLI **0.32.0**, contracts **0.3.1**, MCP **0.3.0**
and UI **0.6.1**. GitHub and npm publication are pending; local version changes
are not publication proof. The previous published release is CLI 0.31.0,
contracts 0.3.0, MCP 0.2.0 and UI 0.6.0, released October 5, 2026.
The candidate changes are not contained in those older artifacts.

CLI and MCP now require **Node.js 22.13.0+**. The control plane uses `node:sqlite`
and needs the same floor. Full workspace builds and typechecks pass; the fresh
four-tarball release smoke passes **11/11** checks outside the monorepo.

| Work | Implemented | Verification and remaining gates |
|---|---|---|
| UI package imports | Safe Vite environment reads, required React Query peer, packed ESM/CommonJS/hooks/SSR and consuming-Vite regression smoke | 318 UI tests and all 11 clean-package checks pass, including installed CLI/dashboard resolution and the nine-tool MCP handshake. Publish UI 0.6.1 to distribute the fixes. |
| Release documentation | Candidate versions, historical publication and explicit distribution boundaries | Documentation command, generated-contract and site-link checks; historical CI links describe their exact older commits. New-version publication remains pending. |
| Desktop | Workspace picker, packaged Node runtime, hub recovery and opt-in updater | Native macOS picker cancellation, persisted workspace switch, hub crash/banner/restart recovery and unconfigured-updater sheet verified. Independent Rust review, check, strict clippy, formatting and 42 tests pass. Signed distribution and installed Windows/Linux verification remain. |
| Hosted identity and browser sign-in | Pinned RS256 JWKS, issuer/audience/time validation, database-owned roles, atomic key reload, durable token revocation and public-client authorization code with S256 PKCE | All 380 control-plane tests in 30 files pass. Actual browser sign-in and local HTTP code/PKCE exchange, replay rejection, JWT verification and SQLite membership pass. Live external IdP compatibility, provider refresh and logout remain unverified. |
| Administration and metrics | Tenant/member/policy/audit UI, platform-admin metrics and request correlation | Real Node API/browser checks at desktop/tablet/mobile sizes and last-admin protection. Distributed tracing remains. |
| Local Docker staging | Private generated configuration, unique disposable Compose project, hardened containers and real worker-job gate | Both images build; loopback API, authenticated tenant/workspace/policy creation and the real worker doctor job pass. Health, identity and admin metrics return 200 with request IDs. Worker direct-IP egress probe is blocked; the control-plane API bridge probe succeeds. |
| VS Code distribution | Opt-in main-only publication after tests and same-run VSIX verification | VSIX packaging, 130 unit and 28 CLI/hub integration tests pass. No Marketplace publication; publisher credentials and a successful publishing run remain. This distribution step is deferred. |
| Dependency hardening | Updated vulnerable production dependencies, scoped overrides and patched CLI file-discovery adapter | Workspace production audit reduced from 80 findings to zero. Fresh packed npm consumption and development tooling retain findings described below. |
| Live integrations | Provider test attempts against configured endpoints | Earlier OpenAI-compatible runs returned HTTP 429; the current Ollama cloud attempt returned HTTP 402, so successful account-backed LLM validation is incomplete. Anthropic, TURN, real cloud deployment and live Argo CD checks remain unverified. |

The administration browser authenticated against both the local Node control plane
and the new isolated Docker control plane. Docker staging is the selected deployment
scope; authentication, SQLite membership, a real worker doctor job and restricted
worker networking pass. Public hosting is not configured. The SSO browser used a
local identity-provider protocol fixture. That verifies the application flow and protocol checks, not compatibility
with a selected external identity provider. See [OIDC configuration](./OIDC.md).

JavaScript syntax and security/source reviews were performed. The repository has
no root ESLint configuration, so the TypeScript reviewer's formal lint gate could
not run. Rust strict lint passed separately.

The control plane remains single-node with SQLite and in-process fan-out. The
worker container is hardened, but jobs do not receive separate containers. A
multi-node database/broker, distributed tracing and job-specific sandbox are
separate future work.

## Dependency audit scope

Production workspace audit is zero after targeted updates (previously 80). A
fresh installation of the packed npm artifacts still reports **six moderate
findings**, all affected-package reports from one upstream UUID advisory,
[GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq), through
Apollo dependencies. Consumer installation does not inherit pnpm workspace
overrides, so the clean workspace count does not clear those consumer findings.
The advisory affects UUID v3()/v5()/v6() output-buffer handling; reviewed Apollo call sites use
v1()/v4(). This reachability finding narrows the observed path but does not remove
the advisory or establish an entirely security-clean consumer release.

Development-tool audit retains **31 findings**: 7 critical, 6 high, 16 moderate
and 2 low. Those are unresolved and must be addressed separately; the production
workspace result does not establish a clean development dependency tree. Audit
counts are dependency reports, not proof that every reported issue is exploitable.

## Deferred distribution

Marketplace extension and signed desktop publication are deferred. Public desktop
signing requires a Developer ID Application identity/notarization credentials for
macOS, Windows signing credentials and the updater signing key. The available
Apple Development/Distribution identities are not public macOS Developer ID
signing identities. No signed desktop release has been produced. GitHub/npm
publication of the four candidate packages remains an independent final step.
