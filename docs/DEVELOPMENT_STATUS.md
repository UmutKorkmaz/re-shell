# Hardening candidate status

This is an unreleased development candidate based on the published CLI 0.31.0,
contracts 0.3.0, MCP 0.2.0 and UI 0.6.0. Versions have not been advanced. The
published npm artifacts do not contain these changes.

| Work | Implemented | Verification and remaining gates |
|---|---|---|
| UI package imports | Safe Vite environment reads, required React Query peer, packed ESM/CommonJS/hooks/SSR and consuming-Vite regression smoke | 318 UI tests and all 11 clean-package checks pass, including the installed CLI/dashboard and nine-tool MCP handshake. New package publication still requires the candidate release gates. |
| Release documentation | Published version/status corrections and explicit Marketplace/desktop/control-plane boundaries | Documentation command and site-link checks; historical CI links describe their exact older commits. |
| Desktop | Workspace picker, packaged Node runtime, hub recovery and opt-in updater | Native macOS picker cancellation, persisted workspace switch, hub crash/banner/restart recovery and unconfigured-updater sheet verified. Independent Rust review, check, strict clippy, formatting and 42 tests pass. Signed distribution and installed Windows/Linux verification remain. |
| Hosted identity | Pinned RS256 JWKS, issuer/audience/time validation, database-owned roles, atomic key reload and durable token revocation | All 377 control-plane tests pass, including real HTTP/SQLite/CLI jobs, canonical-token and open-stream revocation regressions. External IdP authentication and browser authorization-code/PKCE login remain. |
| Administration and metrics | Tenant/member/policy/audit UI, platform-admin metrics and request correlation | Real Node API/browser checks at desktop/tablet/mobile sizes and last-admin protection. Distributed tracing remains. |
| Local Docker staging | Private generated configuration, unique disposable Compose project, hardened containers and real worker-job gate | Docker engine restored after an authorized restart. Both images build; loopback API, authenticated tenant/workspace/policy creation and the real worker doctor job pass. Health, identity and admin metrics return 200 with request IDs. Worker direct-IP egress probe is blocked; the control-plane API bridge probe succeeds. |
| VS Code distribution | Opt-in main-only publication after tests and same-run VSIX verification | VSIX packaging, 130 unit and 28 CLI/hub integration tests pass. No Marketplace listing; publisher credentials and a successful publishing run remain. |
| Live integrations | Existing live provider tests exercised against the configured OpenAI-compatible endpoint | Eight provider tests failed with HTTP 429; eight Anthropic tests skipped. TURN, cloud deployment and live Argo CD checks remain unverified. |

The administration browser used a local Node control plane, not Docker. Docker
staging is the selected deployment scope and its container/API/worker acceptance
passes; public hosting is not configured. All workspace typechecks pass.

JavaScript syntax and security/source reviews were performed. The repository has
no root ESLint configuration, so the TypeScript reviewer's formal lint gate could
not run. Rust strict lint passed separately.

The pinned OIDC support consumes already-issued API bearer tokens. It does not
provide an IdP, a login redirect or a browser PKCE flow. Local identity fixtures do
not prove interoperability with a live provider.

The control plane remains single-node with SQLite and in-process fan-out. The
worker container is hardened, but jobs do not receive separate containers. A
multi-node database/broker and job-specific sandbox are separate future work.

Production dependency audit reported 80 advisories (6 critical, 35 high, 33 moderate
and 6 low) in the existing dependency tree. Those advisories require scoped
reachability review and updates before a security-clean production release can be
claimed; the count alone is not an exploitability assessment.

Public desktop signing requires a Developer ID Application identity/notarization
credentials for macOS, Windows signing credentials and the updater signing key.
The available Apple Development/Distribution identities are not public macOS
Developer ID signing identities. No signed desktop release has been produced.
