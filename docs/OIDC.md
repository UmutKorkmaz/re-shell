# OIDC browser sign-in and external bearer identity

The control plane accepts RS256 JWT access tokens from one configured OIDC issuer alongside existing internal HS256 user and worker tokens. External tokens authenticate users; worker endpoints require internal worker credentials. Tenant membership and roles stay in the local database. External roles, groups and tenant claims grant no access.

The dashboard supports an operator-configured public-client authorization-code flow with S256 PKCE. Manual bearer connections remain available. Discovery, refresh-token management and provider logout are separate work. Tests and the local protocol fixture do not prove a live external provider login.

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

The OIDC suite covers signed fixtures, foreign issuer/audience/algorithm, tampering, expiry/future claims, key-source headers, public-key validation, overlapping and retired keys, failed atomic reload, membership-only roles, fingerprint revocation, real HTTP coexistence with internal credentials, and runtime SQLite revocation wiring. A separate browser suite exercises S256/state, issuer and redirect binding, expiry, single-use transactions, callback cleanup, access-token-only handling, blocked storage, and the React callback under StrictMode. A real loopback HTTP protocol fixture exercises code exchange, PKCE mismatch and replay rejection, followed by `/me` through real JWT verification and SQLite membership. Selecting and validating a live external IdP remains separate integration work.


## Enable browser sign-in

Register a **public SPA/browser client** with the provider. Enable authorization code and S256 PKCE, exact redirects, and token-endpoint CORS for the dashboard origin. No client secret belongs in this application. Configure an access token for the API audience above; an ID token is not accepted as the API credential.

In addition to pinned issuer/JWKS/API audience, configure:

```dotenv
CONTROL_PLANE_OIDC_CLIENT_ID=re-shell-dashboard
CONTROL_PLANE_OIDC_AUTHORIZATION_ENDPOINT=https://id.example.com/authorize
CONTROL_PLANE_OIDC_TOKEN_ENDPOINT=https://id.example.com/token
CONTROL_PLANE_OIDC_REDIRECT_URIS=https://dashboard.example.com/
CONTROL_PLANE_CORS_ORIGINS=https://dashboard.example.com
CONTROL_PLANE_OIDC_SCOPE=openid re-shell-api
CONTROL_PLANE_OIDC_REQUIRE_RESPONSE_ISSUER=true
```

Endpoints are explicit operator settings; no token/request-controlled discovery is performed. HTTPS is required except HTTP loopback staging. Redirect URLs must be canonical, exact, without fragments or OAuth response parameters; their origins must also be in the control plane CORS allowlist. Comma-separated redirects permit multiple registered dashboard URLs. Do not use wildcards. Partial or invalid browser settings fail startup. `/auth/oidc` exposes public settings with `Cache-Control: no-store`, never signing keys or a secret.

The default requires the provider's RFC 9207 `iss` authorization-response parameter to match the pinned issuer. If a selected provider does not support that parameter, the operator can explicitly set `CONTROL_PLANE_OIDC_REQUIRE_RESPONSE_ISSUER=false`; a supplied `iss` is still checked, state and PKCE remain required, and the API still verifies issuer/audience/signature. Validate provider compatibility before enabling this exception.

Open Administration or Collaboration, enter the control plane URL and optional tenant, then choose **Sign in with SSO**. The browser generates independent 256-bit state/verifier values and sends an S256 challenge. A five-minute transaction in tab storage binds the issuer, public client, endpoints, exact callback, control plane and return screen. The callback consumes that transaction before exchanging its code, checks state/issuer/redirect/configuration, and removes OAuth response parameters from browser history. Callback history is scrubbed even when the browser denies storage access; the failure is shown so the user can retry.

Only the bearer **access token** is passed to `/me`; ID and refresh tokens are ignored. Sign-in itself keeps the access token in the active page's memory and does not replace stored manual tokens or enable the Remember option. Unrelated URL, tenant and ICE edits do not persist the SSO token. The current Remember checkbox starts unchecked even if a previous manual token was remembered; explicitly checking it, or explicitly editing the token field, uses the existing token-storage behavior. On expiry, sign in again. Forget token clears the active connection and stored manual token; it is not provider logout.

## Local protocol staging

After building `@re-shell/control-plane`, run the dashboard on loopback, then:

```sh
node scripts/stage-browser-sso.mjs --dashboard-url http://127.0.0.1:5173/
```

The script starts an isolated loopback IdP **protocol fixture** and control-plane API with in-memory SQLite, ephemeral signing keys, one `sso-stage` tenant and mapped staging Alice membership. It prints public URLs and the mapped user ID, never a token or private key. Enter its control-plane URL in the dashboard and sign in; the fixture displays **Continue as staging Alice**. SIGINT/SIGTERM closes its own servers and removes its temporary public-JWKS directory. Existing Docker projects are untouched.

This fixture intentionally has no real user authentication. It validates the implemented redirect/code/PKCE/JWT/membership path and is not a deployable identity provider. Docker control-plane staging and external provider checks remain distinct evidence.

Protocol references: [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636.html), [OAuth 2.0 Security BCP / RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), and [authorization-response issuer identification / RFC 9207](https://www.rfc-editor.org/rfc/rfc9207.html).
