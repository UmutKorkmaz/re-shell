# External bearer identity for the control plane

The control plane accepts RS256 JWT access tokens from one configured OIDC issuer alongside existing internal HS256 user and worker tokens. External tokens authenticate users; worker endpoints require internal worker credentials. Tenant membership and roles stay in the local database. External roles, groups and tenant claims grant no access.

This is API bearer SSO. Browser authorization-code/PKCE login, discovery, refresh-token management and provider logout remain separate work. Tests use locally generated RSA keys and signed fixtures; they do not prove a live provider login.

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

The OIDC suite covers signed fixtures, foreign issuer/audience/algorithm, tampering, expiry/future claims, key-source headers, public-key validation, overlapping and retired keys, failed atomic reload, membership-only roles, fingerprint revocation, real HTTP coexistence with internal credentials, and runtime SQLite revocation wiring. Selecting and validating a live IdP and browser login remains separate integration work.
