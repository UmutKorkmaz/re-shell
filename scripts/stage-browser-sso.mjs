#!/usr/bin/env node
// Loopback-only development protocol fixture. No production account or real IdP is authenticated.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startLocalOidcFixture } from './test-support/local-oidc-fixture.mjs';
import { generateSecret, loadServeConfig, oidcUserId, startRuntime } from '../packages/control-plane/dist/index.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--dashboard-url') {
  console.error('Usage: node scripts/stage-browser-sso.mjs --dashboard-url http://127.0.0.1:5173/'); process.exit(1);
}
const dashboard = new URL(args[1]);
if (dashboard.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(dashboard.hostname) || dashboard.username || dashboard.password || dashboard.hash || dashboard.search) {
  throw new Error('Use an HTTP loopback dashboard base URL, without query or fragment.');
}
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-oidc-stage-')); fs.chmodSync(folder, 0o700);
let runtime; let idp;
async function close() {
  await runtime?.close(); await idp?.close(); fs.rmSync(folder, { recursive: true, force: true });
}
try {
  idp = await startLocalOidcFixture({ redirectUris: [dashboard.href] });
  const jwksFile = path.join(folder, 'jwks.json'); fs.writeFileSync(jwksFile, JSON.stringify(idp.jwks), { mode: 0o600 });
  const userId = oidcUserId(idp.issuer, idp.subject);
  const config = loadServeConfig({ CONTROL_PLANE_HOST: '127.0.0.1', CONTROL_PLANE_PORT: '0', CONTROL_PLANE_DB: ':memory:',
    CONTROL_PLANE_JWT_KEYS: JSON.stringify({ keys: { stage: generateSecret() }, activeKid: 'stage' }),
    CONTROL_PLANE_OIDC_ISSUER: idp.issuer, CONTROL_PLANE_OIDC_AUDIENCE: idp.audience, CONTROL_PLANE_OIDC_JWKS_FILE: jwksFile,
    CONTROL_PLANE_OIDC_CLIENT_ID: idp.clientId, CONTROL_PLANE_OIDC_AUTHORIZATION_ENDPOINT: idp.browserConfig.authorizationEndpoint,
    CONTROL_PLANE_OIDC_TOKEN_ENDPOINT: idp.browserConfig.tokenEndpoint, CONTROL_PLANE_OIDC_REDIRECT_URIS: dashboard.href,
    CONTROL_PLANE_CORS_ORIGINS: dashboard.origin, CONTROL_PLANE_PLATFORM_ADMINS: userId });
  if (!config.ok) throw new Error(config.error.message);
  // loadServeConfig resolves paths; restore the SQLite special in-memory name for this ephemeral fixture.
  runtime = await startRuntime({ ...config.data, dbPath: ':memory:' });
  runtime.store.createTenant({ id: 'sso-stage', name: 'Local SSO staging', allowedCommandIds: ['doctor'], policyVersion: 1 });
  runtime.store.setMember('sso-stage', userId, 'admin');
  console.log(JSON.stringify({ kind: 'LOCAL_PROTOCOL_FIXTURE_NOT_A_REAL_IDP', controlPlaneUrl: runtime.listening.url,
    issuer: idp.issuer, dashboardUrl: `${dashboard.href}?screen=admin`, userId, tenant: 'sso-stage' }));
  let closing = false;
  const shutdown = async () => { if (closing) return; closing = true; await close(); process.exit(0); };
  process.once('SIGINT', () => void shutdown()); process.once('SIGTERM', () => void shutdown());
} catch (error) { await close(); throw error; }
