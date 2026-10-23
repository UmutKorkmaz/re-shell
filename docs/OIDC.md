# OIDC browser sign-in and external bearer identity

The control plane accepts RS256 JWT access tokens from one configured OIDC issuer alongside existing internal HS256 user and worker tokens. External tokens authenticate users; worker endpoints require internal worker credentials. Tenant membership and roles stay in the local database. External roles, groups and tenant claims grant no access.

The dashboard supports an operator-configured public-client authorization-code flow with S256 PKCE. Manual bearer connections remain available. It renews short-lived access tokens using provider refresh tokens held only in page memory, and supports operator-pinned revocation and provider logout. Discovery remains disabled. The protocol fixture is distinct from the isolated real Keycloak integration described below.

## Configure trust

Set all three variables to enable external identity:

```dotenv
CONTROL_PLANE_OIDC_ISSUER=http://localhost:9090/issuer
CONTROL_PLANE_OIDC_AUDIENCE=re-shell-staging-api
CONTROL_PLANE_OIDC_JWKS_FILE=/run/secrets/oidc-jwks.json
```

The issuer must exactly match token `iss`, including trailing slashes. HTTPS is required except HTTP loopback URLs for local staging. The external issuer must differ from the internal issuer. Configure the API audience separately from the browser client ID-token audience. Opaque access tokens are not supported.

Mount an operator-managed public JWKS read-only. No discovery or token-provided key URL is fetched. JSON must contain 1–32 public RSA signing keys with unique `kid`, `n`, `e` and at least 2048 bits. Optional `alg` must be `RS256`, `use` must be `sig`, and `key_ops` may contain only `verify`. Private key fields and files above 1 MiB are refused.

Token headers permit only `alg`, `kid` and optional `typ` (`JWT` or `at+jwt`). Other headers, including `jku`, `jwk`, `x5u` and critical extensions, are rejected. Providers with different headers/algorithms need explicit compatibility work. JWTs are bounded to 16 KiB; HTTP header limits also apply.

Signature, issuer, audience, expiry and not-before use `jsonwebtoken` with explicit RS256 and zero clock tolerance. `sub`, `iat` and `exp` are required. Future issued-at values, expiry, invalid subjects and non-integer timestamps are refused. Keep clocks aligned. Failures return the normal unauthenticated response.

Partial/invalid trust prevents startup. With none of these variables set, only internal identity is active. Internal signing keys remain required.

## Provision membership

External local user IDs are deterministic:

```text
oidc:<hex SHA-256 of UTF-8 JSON.stringify([issuer, subject])>
```

Use exported `oidcUserId(issuer, subject)` and add that ID through existing tenant member administration or provisioning commands. Configure platform-admin IDs explicitly if needed. A valid external token initially has no tenant roles; membership removal applies on the next request. Raw external subjects cannot impersonate same-named internal users, and changing issuer URLs changes mapped IDs, requiring membership migration.

Send the access token in the Authorization Bearer header. `/me` returns the mapped user and current memberships. External admin claims do not authorize access to other tenants.

## Rotation and revocation

Update the pinned public JWKS and send SIGHUP. Add new keys while retaining old ones for an overlap period, then remove old keys when their tokens should stop working. Malformed replacements retain current trusted keys. Rotation is manual, without discovery or polling.

External revocation uses issuer plus `sha256:<hex SHA-256 of the full token>` as deny-list identity, even without `jti`. Verified expiry is persisted; raw bearer tokens are never stored in SQLite. `verifyOidcToken` returns `issuer`, `revocationId` and `expiresAt`. `revoke-token --token-file <file>` verifies configured external tokens before revocation. Protect input token files as credentials.

Revoking one access token does not revoke other tokens, refresh tokens or the provider account. Remove local tenant membership for immediate tenant access removal and use provider controls for provider-wide revocation. An unavailable revocation store rejects external authentication.

## Verification scope

The OIDC suite covers signed fixtures, foreign issuer/audience/algorithm, tampering, expiry/future claims, key-source headers, public-key validation, overlapping and retired keys, failed atomic reload, membership-only roles, fingerprint revocation, real HTTP coexistence with internal credentials, and runtime SQLite revocation wiring. A separate browser suite exercises S256/state, issuer and redirect binding, expiry, single-use transactions, callback cleanup, access-token-only handling, blocked storage, and the React callback under StrictMode. A real loopback HTTP protocol fixture exercises code exchange, PKCE mismatch and replay rejection, followed by `/me` through real JWT verification and SQLite membership. The optional real Keycloak integration below exercises an actual provider in local Docker; a passing local run does not establish compatibility with a different provider or a production deployment.


## Enable browser sign-in

Register a **public SPA/browser client** with the provider. Enable authorization code and S256 PKCE, exact redirects, and token-endpoint CORS for the dashboard origin. No client secret belongs in this application. Configure an access token for the API audience above; an ID token is not accepted as the API credential.

In addition to pinned issuer/JWKS/API audience, configure:

```dotenv
CONTROL_PLANE_OIDC_CLIENT_ID=re-shell-dashboard
CONTROL_PLANE_OIDC_AUTHORIZATION_ENDPOINT=https://id.example.com/authorize
CONTROL_PLANE_OIDC_TOKEN_ENDPOINT=https://id.example.com/token
CONTROL_PLANE_OIDC_REVOCATION_ENDPOINT=https://id.example.com/revoke
CONTROL_PLANE_OIDC_END_SESSION_ENDPOINT=https://id.example.com/logout
CONTROL_PLANE_OIDC_REDIRECT_URIS=https://dashboard.example.com/
CONTROL_PLANE_CORS_ORIGINS=https://dashboard.example.com
CONTROL_PLANE_OIDC_SCOPE=openid re-shell-api
CONTROL_PLANE_OIDC_REQUIRE_RESPONSE_ISSUER=true
```

Endpoints are explicit operator settings; no token/request-controlled discovery is performed. HTTPS is required except HTTP loopback staging. Redirect URLs must be canonical, exact, without fragments or OAuth response parameters; their origins must also be in the control plane CORS allowlist. Comma-separated redirects permit multiple registered dashboard URLs. Do not use wildcards. Partial or invalid browser settings fail startup. `/auth/oidc` exposes public settings with `Cache-Control: no-store`, never signing keys or a secret.

The default requires the provider's RFC 9207 `iss` authorization-response parameter to match the pinned issuer. If a selected provider does not support that parameter, the operator can explicitly set `CONTROL_PLANE_OIDC_REQUIRE_RESPONSE_ISSUER=false`; a supplied `iss` is still checked, state and PKCE remain required, and the API still verifies issuer/audience/signature. Validate provider compatibility before enabling this exception.

Open Administration or Collaboration, enter the control plane URL and optional tenant, then choose **Sign in with SSO**. The browser generates independent 256-bit state/verifier values and sends an S256 challenge. A five-minute transaction in tab storage binds the issuer, public client, endpoints, exact callback, control plane and return screen. The callback consumes that transaction before exchanging its code, checks state/issuer/redirect/configuration, and removes OAuth response parameters from browser history. Callback history is scrubbed even when the browser denies storage access; the failure is shown so the user can retry.

Only the bearer **access token** is passed to the API. ID tokens are discarded. Refresh tokens are held in page memory only; they are never returned through the connection settings, serialized, or written to either browser store. The provider must return a bearer access token and a numeric `expires_in` between 1 and 86,400 seconds when issuing refresh tokens. Requests time out after 20 seconds; JSON responses are limited to 64 KiB while reading.

Sign-in keeps the access token in page memory and leaves a previous stored manual token unchanged. Unrelated URL, tenant and ICE edits do not persist SSO credentials. The current Remember checkbox starts unchecked even when a previous manual token was remembered. Explicitly checking it permits storing the current and subsequently rotated **access tokens** on this device. Unchecking it returns the SSO access token to page memory and erases its stored copy. Explicitly editing the bearer-token field switches to manual credential handling and ends automatic SSO renewal. Reloading loses refresh credentials, including when an access token was explicitly remembered; a remembered access token can reconnect until it expires, then requires sign-in.

While connected, the dashboard renews before access-token expiry with a single in-flight refresh grant. A rotated refresh token replaces the previous one; if a provider omits the replacement, the existing refresh token is retained according to RFC 6749. Configure provider refresh-token rotation and reuse detection for public clients. Renewal rechecks the pinned issuer/client/endpoints/redirect configuration before sending credentials. Rejected, malformed or failed renewal ends the active session and asks for sign-in. Disconnect pauses renewal while retaining the SSO lifecycle in page memory so reconnect can resume it. Forget clears the local SSO lifecycle and stored tokens. Both are local actions and do not terminate the provider login.

**Sign out of SSO** immediately clears local credentials, waits for any rotating grant already in flight, then revokes the latest access-token fingerprint through `POST /auth/oidc/logout`. This denies that API JWT immediately using the local revocation store. If a revocation endpoint is configured, the dashboard also requests provider revocation of the latest refresh and access tokens as a public client, with no secret. If an end-session endpoint is configured, it redirects there with `client_id` and the exact registered `post_logout_redirect_uri`; the provider may require confirmation because no ID token is retained or supplied as a hint. Register the same exact callback as an allowed post-logout redirect at the provider, and enable browser CORS for its token and revocation endpoints.

Provider endpoints are optional; without them, API/local cleanup still occurs but provider-wide logout is unavailable and the UI explains that limit. API/provider revocation failures remain visible after local cleanup; they never claim provider-wide success. Provider revocation alone does not make an offline JWT verifier aware of revocation: this control plane's fingerprint deny list covers the exact access token submitted on sign-out. Other access tokens, other devices and the provider account require the provider's administration/session controls or local membership removal. Disconnect retains refresh credentials only in page memory; Forget discards them without remotely revoking them. Use Sign out of SSO for the configured API/provider revocation and logout flow.

## Local protocol staging

After building `@re-shell/control-plane`, run the dashboard on loopback, then:

```sh
node scripts/stage-browser-sso.mjs --dashboard-url http://127.0.0.1:5173/
```

The script starts an isolated loopback IdP **protocol fixture** and control-plane API with in-memory SQLite, ephemeral signing keys, one `sso-stage` tenant and mapped staging Alice membership. It prints public URLs and the mapped user ID, never a token or private key. Enter its control-plane URL in the dashboard and sign in; the fixture displays **Continue as staging Alice**. SIGINT/SIGTERM closes its own servers and removes its temporary public-JWKS directory. Existing Docker projects are untouched.

This fixture intentionally has no real user authentication. It validates the implemented redirect/code/PKCE/JWT/membership path and is not a deployable identity provider. Docker control-plane staging and external provider checks remain distinct evidence.

Protocol references: [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html), [OAuth 2.0 Security BCP / RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), and [authorization-response issuer identification / RFC 9207](https://www.rfc-editor.org/rfc/rfc9207.html).

## Isolated real-provider integration (local Docker)

**October 23 local result:** the final script passes the complete genuine provider
lifecycle with official Keycloak **26.4.0** and the frozen production dashboard.
The check covers password login, S256 PKCE, issuer/callback binding, API audience
and tenant membership, proactive browser refresh/rotation and no issued credentials
in browser storage with Remember disabled. Revocation of the exact latest refresh
and access tokens returns **200** at the provider, followed by the logout redirect.
The same API JWT returns **200 before** sign-out and **401 after** while still
unexpired, establishing revocation rather than an expiry-only denial. A subsequent
sign-in requires a password. A separate fresh authenticated session rejects replay
of a consumed refresh token with **400**. The native-browser fetch sign-out fix
also has a failing-before/passing-after regression; all **39** SSO tests pass and
the native-browser fix was reviewed. The final provider script passes again after
the renewal-version fix, with cleanup confirmed. Regressions include three renewal
cycles returning the same access-token string and Remember changes during pending
requests. This local result is specific to the named image and configuration,
separate from other providers and production hosting.

The reproducible integration uses an actual versioned official Keycloak container, a public SPA client with required S256, rotation/reuse rejection, a real password login in Chromium, and the actual dashboard and SQLite-backed API. It creates a unique container name, binds only a random loopback port, imports an ephemeral realm with a random password, and removes only its own container and temporary files. It does not use cloud credentials or existing Docker projects.

Install the repository dependencies and browser, and build the workspace dependencies first, using Node 22.22.3 and the pinned pnpm version:

```sh
corepack pnpm --filter @re-shell/contracts build
corepack pnpm --filter @re-shell/ui build
corepack pnpm --filter @re-shell/control-plane build
corepack pnpm --filter @re-shell/dashboard exec playwright install chromium
node scripts/test-keycloak-sso.mjs
```

The script uses `quay.io/keycloak/keycloak:26.4.0` by default; `RE_SHELL_KEYCLOAK_IMAGE` permits an explicit official version tag/digest. It prints a credential-free PASS record only after real authentication, access-token API identity/membership, proactive renewal and refresh rotation, consumed refresh replay rejection, browser storage checks, latest-credential provider revocation, API rejection after sign-out, provider logout and a new authentication prompt pass. Runtime/provider/browser failures exit nonzero. If Docker is unavailable, the default is a nonzero `KEYCLOAK_INTEGRATION_UNAVAILABLE`; `--allow-skip` makes this an explicitly optional skipped run and never emits PASS. A successful local run is evidence for this exact provider image and local configuration only.

Keycloak references: [official container guide](https://www.keycloak.org/server/containers) and [OIDC endpoint documentation](https://www.keycloak.org/securing-apps/oidc-layers). OAuth references for the lifecycle: [refresh grants (RFC 6749)](https://www.rfc-editor.org/rfc/rfc6749.html#section-6), [revocation (RFC 7009)](https://www.rfc-editor.org/rfc/rfc7009.html) and [RP-Initiated Logout](https://openid.net/specs/openid-connect-rpinitiated-1_0.html).
