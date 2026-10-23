# Local integration checks

These checks create isolated local resources. Passing them demonstrates the named local integration; it does not validate a public service, production network, signed desktop release, or Marketplace publication.

## TURN relay

Install workspace dependencies and the Playwright Chromium browser, then run:

```sh
corepack pnpm --filter @re-shell/contracts build
corepack pnpm --filter @re-shell/dashboard exec playwright install chromium
node scripts/test-turn-relay.mjs
```

The script requires a running Docker engine. Docker absence, a failed image pull, missing browser dependencies, or a failed assertion exits nonzero. `--allow-skip` explicitly permits skipping only when Docker is unavailable; it never converts a failed TURN check into a pass.

The pinned official `coturn/coturn:4.18.0-r0-alpine` image runs under a unique container name with temporary randomized credentials. Both TURN control ports bind to ephemeral ports on host `127.0.0.1`. The script imports the real dashboard `PeerLink` through a local Vite server with the optional CLI hub disabled. Two independent Chromium contexts force `iceTransportPolicy: 'relay'`; both must report a nominated successful candidate pair whose local and remote candidates are `relay`, and the selected TURN transport must be TCP. A unique application ping must arrive in both directions with zero application relay attempts. A raw unauthenticated UDP Allocate request must receive a `401` challenge without a relayed address.

The harness delivers offer, answer, and ICE signaling between contexts. This command does not start the control plane; the ordinary collaboration E2E covers its real signaling endpoints separately.

`PeerLink` calls an open WebRTC data channel `p2p`, including when TURN carries the packets. That label alone is insufficient evidence: this check inspects the selected ICE candidates. The ordinary collaboration E2E separately covers host-candidate data channels and the HTTP server fallback when WebRTC is unavailable.

Both allocations use relay sockets on the container's own loopback interface. Coturn's `allow-loopback-peers` setting is confined to this development container, and no relay port range is published. This verifies actual local TURN allocation and data relay while avoiding host NAT and Docker Desktop address mapping. It does not verify traversal between two external networks, public DNS, TLS TURN, UDP data transport, or production coturn configuration. See the [official coturn image documentation](https://github.com/coturn/coturn/blob/master/docker/coturn/README.md) for network deployment options.

Cleanup removes the exact owned container and temporary configuration, even after an assertion failure. The pulled versioned image remains cached for later runs; existing containers, images, volumes, networks, and application services are not pruned.

## Keycloak browser SSO

Build the shared packages before starting this check, and keep those outputs stable during the browser run:

```sh
corepack pnpm --filter @re-shell/contracts build
corepack pnpm --filter @re-shell/control-plane build
corepack pnpm --filter @re-shell/dashboard exec playwright install chromium
node scripts/test-keycloak-sso.mjs
```

The script starts the pinned official `quay.io/keycloak/keycloak:26.4.0` image with an imported temporary realm, a fictional test user with a complete profile, and a randomized password. Its published port binds only to host `127.0.0.1`. It builds the dashboard into an owned temporary folder and serves that frozen production bundle with Vite preview, keeping development reloads out of the in-memory session check. The dashboard connects to a real local control plane backed by in-memory SQLite and pinned Keycloak signing keys. Existing providers, accounts, containers, and application databases are not used.

A successful run requires password authentication through Keycloak, a public-client authorization-code exchange with S256 PKCE, a matching API audience and mapped tenant membership, proactive browser refresh with a replacement refresh token, and no issued credentials in browser storage. Sign-out must revoke the exact latest access and refresh credentials, complete provider logout, reject the refresh token afterward, and reject the previously accepted API JWT while it is still unexpired. A subsequent sign-in must require provider authentication again.

Refresh-token replay is tested in a fresh authenticated session after the main logout checks. Reusing a consumed refresh token must fail. Keeping this probe separate prevents Keycloak's reuse response from invalidating the session whose logout is being measured.

Docker absence fails by default; `--allow-skip` permits only an explicit unavailable-engine skip. Browser or provider assertion failures remain failures. Diagnostics report only phase names, UI presence/origin booleans, and endpoint-category HTTP statuses. Passwords, tokens, response bodies, authorization query strings, and screenshots are not logged. Cleanup attempts every owned resource independently and reports any incomplete cleanup; the pulled image remains cached. This local check does not establish compatibility with other providers or a production SSO deployment.
