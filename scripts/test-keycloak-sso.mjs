#!/usr/bin/env node
// Isolated, real Keycloak + dashboard + SQLite control-plane integration. Never uses existing containers or accounts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireWeb = createRequire(path.join(root, 'apps/web/package.json'));
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 180_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const optional = process.argv.includes('--allow-skip');
try { execFileSync('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 15_000, stdio: 'pipe' }); }
catch {
  console.error('KEYCLOAK_INTEGRATION_UNAVAILABLE: Docker engine is unavailable. No provider checks ran.');
  process.exit(optional ? 0 : 1);
}
const image = process.env.RE_SHELL_KEYCLOAK_IMAGE ?? 'quay.io/keycloak/keycloak:26.4.0';
if (!/^quay\.io\/keycloak\/keycloak:[a-zA-Z0-9._-]+(?:@sha256:[a-f0-9]{64})?$/.test(image)) throw new Error('Use a versioned official Keycloak image.');
const container = `re-shell-keycloak-${randomUUID()}`;
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 're-shell-keycloak-')); fs.chmodSync(folder, 0o700);
const userId = '11111111-1111-4111-8111-111111111111';
const password = randomBytes(24).toString('hex');
let closeDashboard; let runtime; let browser; let page; let started = false;
let dashboardOrigin; let providerOrigin;
const responseStatuses = [];
const grantShapes = [];
const navigationKinds = [];
const viteEvents = [];
const checks = [];
let phase = 'provider-startup';
async function cleanup() {
  const failures = [];
  for (const action of [() => browser?.close(), () => runtime?.close(), () => closeDashboard?.(), () => {
    if (!started) return;
    try { docker('rm', '--force', '--volumes', container); }
    catch (error) { if (!/No such container:/i.test(String(error.stderr))) throw error; }
  }, () => fs.rmSync(folder, { recursive: true, force: true })]) {
    try { await action(); } catch { failures.push(true); }
  }
  if (failures.length) {
    console.error(`KEYCLOAK_INTEGRATION_CLEANUP_FAILED: verify owned container ${container} and temporary directory ${folder}.`);
    process.exitCode = 1;
  }
}
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  if (stopping) return; stopping = true;
  void cleanup().finally(() => process.exit(1));
});
try {
  phase = 'dashboard-startup';
  const { build, preview } = await import(requireWeb.resolve('vite'));
  // Build a frozen shipping dashboard in this run's own folder. Dev-server
  // dependency optimization/HMR can reload the page and erase its memory session.
  process.env.RE_SHELL_UI_HUB_MANAGED = '1';
  const dashboardBuild = path.join(folder, 'dashboard');
  const dashboardConfig = { root: path.join(root, 'apps/web'), configFile: path.join(root, 'apps/web/vite.config.mts'), logLevel: 'error',
    build: { outDir: dashboardBuild, emptyOutDir: true } };
  await build(dashboardConfig);
  const dashboardServer = await preview({ ...dashboardConfig, preview: { host: '127.0.0.1', port: 0, open: false } });
  closeDashboard = () => new Promise((resolve, reject) => dashboardServer.httpServer.close((error) => error ? reject(error) : resolve()));
  const dashboard = `http://127.0.0.1:${dashboardServer.httpServer.address().port}/`;
  dashboardOrigin = new URL(dashboard).origin;
  const callback = `${dashboard}?screen=admin`;
  const realm = { realm: 're-shell-local', enabled: true, sslRequired: 'none', registrationAllowed: false,
    accessTokenLifespan: 30, ssoSessionIdleTimeout: 300, revokeRefreshToken: true, refreshTokenMaxReuse: 0,
    users: [{ id: userId, username: 'local-alice', email: 'local-alice@example.invalid', enabled: true, emailVerified: true, firstName: 'Local', lastName: 'Alice',
      credentials: [{ type: 'password', value: password, temporary: false }] }],
    clients: [{ clientId: 're-shell-dashboard', enabled: true, publicClient: true, standardFlowEnabled: true,
      directAccessGrantsEnabled: false, implicitFlowEnabled: false, redirectUris: [callback], webOrigins: [new URL(dashboard).origin],
      attributes: { 'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': callback },
      protocolMappers: [{ name: 'api-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
        config: { 'included.custom.audience': 're-shell-local-api', 'id.token.claim': 'false', 'access.token.claim': 'true' } }] }] };
  const realmFile = path.join(folder, 'realm.json'); fs.writeFileSync(realmFile, JSON.stringify(realm), { mode: 0o644 });
  // Unique name, ephemeral DB, only loopback published port, no host project mounts.
  phase = 'provider-startup';
  started = true;
  docker('run', '--detach', '--rm', '--name', container, '--publish', '127.0.0.1::8080', '--memory', '1g',
    '--volume', `${realmFile}:/opt/keycloak/data/import/realm.json:ro`, image, 'start-dev', '--import-realm', '--hostname-strict=false');
  const port = docker('port', container, '8080/tcp').split(':').at(-1);
  assert.match(port, /^\d+$/);
  const issuer = `http://127.0.0.1:${port}/realms/re-shell-local`;
  providerOrigin = new URL(issuer).origin;
  const endpoints = `${issuer}/protocol/openid-connect`;
  let discovery;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { discovery = await response.json(); break; }
    } catch { /* provider startup only */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.equal(discovery?.issuer, issuer, 'Keycloak failed to start with the exact local issuer');
  const jwks = await (await fetch(`${endpoints}/certs`, { signal: AbortSignal.timeout(5000) })).json();
  // Pin the provider public RS256 signing keys; encryption keys are not trust anchors.
  const jwksFile = path.join(folder, 'jwks.json');
  fs.writeFileSync(jwksFile, JSON.stringify({ keys: jwks.keys.filter((key) => key.use === 'sig' && key.alg === 'RS256') }), { mode: 0o600 });
  phase = 'control-plane-startup';
  const { generateSecret, loadServeConfig, oidcUserId, startRuntime } = await import('../packages/control-plane/dist/index.js');
  const mappedUser = oidcUserId(issuer, userId);
  const config = loadServeConfig({ CONTROL_PLANE_HOST: '127.0.0.1', CONTROL_PLANE_PORT: '0', CONTROL_PLANE_DB: ':memory:',
    CONTROL_PLANE_JWT_KEYS: JSON.stringify({ keys: { local: generateSecret() } }),
    CONTROL_PLANE_OIDC_ISSUER: issuer, CONTROL_PLANE_OIDC_AUDIENCE: 're-shell-local-api', CONTROL_PLANE_OIDC_JWKS_FILE: jwksFile,
    CONTROL_PLANE_OIDC_CLIENT_ID: 're-shell-dashboard', CONTROL_PLANE_OIDC_AUTHORIZATION_ENDPOINT: `${endpoints}/auth`,
    CONTROL_PLANE_OIDC_TOKEN_ENDPOINT: `${endpoints}/token`, CONTROL_PLANE_OIDC_REVOCATION_ENDPOINT: `${endpoints}/revoke`,
    CONTROL_PLANE_OIDC_END_SESSION_ENDPOINT: `${endpoints}/logout`, CONTROL_PLANE_OIDC_REDIRECT_URIS: callback,
    CONTROL_PLANE_CORS_ORIGINS: new URL(dashboard).origin, CONTROL_PLANE_PLATFORM_ADMINS: mappedUser });
  assert.equal(config.ok, true, 'Real provider configuration was rejected');
  runtime = await startRuntime({ ...config.data, dbPath: ':memory:' });
  runtime.store.createTenant({ id: 'local-provider', name: 'Local provider test', allowedCommandIds: ['doctor'], policyVersion: 1 });
  runtime.store.setMember('local-provider', mappedUser, 'admin');
  phase = 'browser-startup';
  const { chromium } = requireWeb('@playwright/test');
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  page.setDefaultTimeout(30_000);
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    const origin = new URL(frame.url()).origin;
    navigationKinds.push(origin === dashboardOrigin ? 'dashboard' : origin === providerOrigin ? 'provider' : 'other');
  });
  page.on('console', (message) => {
    const text = message.text();
    if (!text.startsWith('[vite]')) return;
    viteEvents.push(text.includes('page reload') ? 'page-reload' : text.includes('hot updated') ? 'hot-update' : 'dev-client');
  });
  const grants = []; const revocations = []; const captures = [];
  let captureFailed = false;
  const flushCaptures = async () => { await Promise.all(captures); assert.equal(captureFailed, false, 'Could not observe a successful provider grant'); };
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin === providerOrigin || url.origin === new URL(runtime.listening.url).origin) {
      // Categories and numeric status only: never query strings, response bodies or request data.
      const category = url.pathname.endsWith('/token') ? 'provider-token'
        : url.pathname.includes('/login-actions/') ? 'provider-login-action'
        : url.pathname.endsWith('/auth') ? 'provider-authorization'
        : url.pathname === '/me' ? 'api-identity' : url.pathname === '/auth/oidc' ? 'api-sso-config' : undefined;
      if (category) { responseStatuses.push({ category, status: response.status() }); if (responseStatuses.length > 24) responseStatuses.shift(); }
    }
    if (response.url() === `${endpoints}/token` && response.ok()) {
      captures.push(response.json().then((body) => {
        grantShapes.push({ hasRefreshToken: typeof body.refresh_token === 'string', hasExpiry: Number.isSafeInteger(body.expires_in),
          ...(Number.isSafeInteger(body.expires_in) ? { expiresInSeconds: body.expires_in } : {}),
          authorizationCodeGrant: new URLSearchParams(response.request().postData() ?? '').get('grant_type') === 'authorization_code' });
        grants.push({ body, request: new URLSearchParams(response.request().postData() ?? '') });
      }).catch(() => { captureFailed = true; }));
    }
    if (response.url() === `${endpoints}/revoke`) {
      const request = new URLSearchParams(response.request().postData() ?? '');
      revocations.push({ status: response.status(), hint: request.get('token_type_hint'), token: request.get('token') });
    }
  });
  phase = 'dashboard-navigation';
  await page.goto(callback);
  phase = 'dashboard-connection-url';
  await page.getByTestId('collab-url').fill(runtime.listening.url);
  phase = 'provider-authorization-navigation';
  await page.getByTestId('collab-sign-in').click();
  phase = 'provider-credential-form';
  await page.locator('#username').fill('local-alice');
  await page.locator('#password').fill(password);
  phase = 'provider-password-submit';
  await page.locator('#kc-login').click();
  phase = 'dashboard-authenticated-callback';
  await page.getByTestId('collab-status').filter({ hasText: `connected as ${mappedUser}` }).waitFor();
  assert.equal(new URL(page.url()).searchParams.has('code'), false);
  await page.waitForFunction(() => document.querySelector('[data-testid="collab-token"]')?.value?.length > 0);
  await flushCaptures();
  assert.equal(grants.length, 1);
  assert.equal(grants[0].request.get('grant_type'), 'authorization_code');
  assert.match(grants[0].request.get('code_verifier'), /^[A-Za-z0-9_-]{43}$/);
  const dashboardLoads = navigationKinds.filter((kind) => kind === 'dashboard').length;
  checks.push('real Keycloak password authentication, public S256 code exchange, exact issuer/callback, API audience, mapped SQLite membership');
  phase = 'proactive-refresh-rotation';
  const initialRefresh = grants[0].body.refresh_token;
  await page.waitForResponse((response) => response.url() === `${endpoints}/token` && response.request().postData()?.includes('grant_type=refresh_token'), { timeout: 45_000 });
  await page.waitForFunction((first) => document.querySelector('[data-testid="collab-token"]')?.value !== first, grants[0].body.access_token);
  await flushCaptures();
  assert.equal(grants.length >= 2, true);
  assert.equal(grants[1].request.get('grant_type'), 'refresh_token');
  assert.notEqual(grants[1].body.refresh_token, initialRefresh);
  assert.equal(navigationKinds.filter((kind) => kind === 'dashboard').length, dashboardLoads, 'Dashboard reloaded instead of renewing its in-memory session');
  assert.equal(viteEvents.length, 0, 'A development Vite client reached the frozen dashboard');
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  for (const grant of grants) for (const key of ['access_token', 'refresh_token', 'id_token']) if (grant.body[key]) assert.equal(stored.includes(grant.body[key]), false);
  checks.push('proactive browser renewal and refresh rotation, no credentials in browser storage');
  phase = 'provider-revocation-and-logout';
  const latest = grants.at(-1).body;
  assert.equal(await page.getByTestId('collab-token').inputValue(), latest.access_token);
  const accepted = await fetch(`${runtime.listening.url}/me`, { headers: { Authorization: `Bearer ${latest.access_token}` }, signal: AbortSignal.timeout(5000) });
  assert.equal(accepted.status, 200, 'Latest access token was not usable before sign-out'); await accepted.body?.cancel();
  const logoutRequest = page.waitForRequest((request) => {
    const url = new URL(request.url()); return url.origin === providerOrigin && url.pathname === `${new URL(endpoints).pathname}/logout`;
  });
  const signedOutDocument = page.waitForEvent('domcontentloaded');
  void logoutRequest.catch(() => {}); void signedOutDocument.catch(() => {});
  await page.getByTestId('collab-sign-out').click();
  await logoutRequest;
  await signedOutDocument;
  // Public-client logout without id_token_hint can require provider confirmation.
  if (new URL(page.url()).origin !== new URL(dashboard).origin) {
    const confirm = page.locator('#kc-logout');
    if (await confirm.count()) await confirm.click();
    else await page.getByRole('button', { name: /log out|sign out/i }).click();
  }
  await page.waitForURL((url) => url.origin === new URL(dashboard).origin);
  assert.equal(revocations.length, 2); assert.equal(revocations.every(({ status }) => status === 200), true);
  assert.equal(revocations.find(({ hint }) => hint === 'refresh_token')?.token, latest.refresh_token);
  assert.equal(revocations.find(({ hint }) => hint === 'access_token')?.token, latest.access_token);
  assert.equal(await page.getByTestId('collab-token').inputValue(), '');
  const revokedRefresh = await fetch(`${endpoints}/token`, { method: 'POST', signal: AbortSignal.timeout(5000), body: new URLSearchParams({
    grant_type: 'refresh_token', client_id: 're-shell-dashboard', refresh_token: latest.refresh_token }) });
  assert.equal(revokedRefresh.status, 400); await revokedRefresh.body?.cancel();
  checks.push('latest refresh/access provider revocation, public-client provider logout, local cleanup');
  // Sign-out denies the exact API access token even before its JWT expiry.
  phase = 'api-signout-revocation';
  const denied = await fetch(`${runtime.listening.url}/me`, { headers: { Authorization: `Bearer ${latest.access_token}` }, signal: AbortSignal.timeout(5000) });
  assert.equal(denied.status, 401); await denied.body?.cancel();
  const claims = JSON.parse(Buffer.from(latest.access_token.split('.')[1], 'base64url').toString());
  assert.equal(Number.isSafeInteger(claims.exp) && claims.exp * 1000 > Date.now(), true, 'Access JWT expired before API revocation was demonstrated');
  checks.push('dashboard sign-out immediately revokes the latest API JWT fingerprint');
  phase = 'provider-session-termination';
  await page.getByTestId('collab-sign-in').click();
  await page.locator('#username').waitFor();
  checks.push('fresh sign-in requires provider authentication after logout');
  // Keycloak detaches the client session after reuse detection. Test replay in
  // a new authenticated session so it cannot invalidate the earlier logout proof.
  phase = 'separate-session-refresh-replay';
  const priorGrants = grants.length;
  await page.locator('#username').fill('local-alice');
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await page.getByTestId('collab-status').filter({ hasText: `connected as ${mappedUser}` }).waitFor();
  await flushCaptures();
  const fresh = grants.slice(priorGrants).find(({ request }) => request.get('grant_type') === 'authorization_code');
  assert.ok(fresh, 'Fresh authenticated session did not issue a code grant');
  const rotated = await fetch(`${endpoints}/token`, { method: 'POST', signal: AbortSignal.timeout(5000), body: new URLSearchParams({
    grant_type: 'refresh_token', client_id: 're-shell-dashboard', refresh_token: fresh.body.refresh_token }) });
  assert.equal(rotated.status, 200, 'Fresh session refresh token could not be consumed');
  const rotatedGrant = await rotated.json();
  assert.equal(typeof rotatedGrant.refresh_token, 'string');
  assert.notEqual(rotatedGrant.refresh_token, fresh.body.refresh_token);
  const reused = await fetch(`${endpoints}/token`, { method: 'POST', signal: AbortSignal.timeout(5000), body: new URLSearchParams({
    grant_type: 'refresh_token', client_id: 're-shell-dashboard', refresh_token: fresh.body.refresh_token }) });
  assert.equal(reused.status, 400, 'Consumed rotating refresh token was reusable'); await reused.body?.cancel();
  checks.push('separate fresh session rejects a consumed rotating refresh token without contaminating logout evidence');
  console.log(JSON.stringify({ result: 'PASS', provider: image, dashboard: 'frozen production build in owned temporary folder', scope: 'isolated local Docker only', checks }));
} catch (error) {
  // Never emit response bodies, token values, request headers, password or browser URL queries.
  let ui;
  try {
    ui = await page?.evaluate(({ dashboardOrigin, providerOrigin }) => ({
      atDashboard: location.origin === dashboardOrigin, atProvider: location.origin === providerOrigin,
      hasUsername: Boolean(document.querySelector('#username')), hasPassword: Boolean(document.querySelector('#password')),
      hasProfileEmail: Boolean(document.querySelector('#email')), hasProfileFirstName: Boolean(document.querySelector('#firstName')),
      hasProviderError: Boolean(document.querySelector('#kc-error-message, #input-error')), hasAlert: Boolean(document.querySelector('[role="alert"]')),
      alertCategories: [
        ['expired', 'The SSO access token expired.'], ['renewal-failed', 'Session renewal failed.'],
        ['config-changed', 'Sign-in configuration changed.'], ['provider-request-rejected', 'Sign-in request was rejected.'],
        ['api-token-rejected', 'The control plane rejected the token'], ['identity-changed', 'Session identity or tenant membership changed.'],
        ['revocation-failed', 'server or provider revocation failed.'],
        ['illegal-invocation', 'Illegal invocation'],
      ].filter(([, text]) => [...document.querySelectorAll('[role="alert"]')].some((alert) => alert.textContent?.includes(text))).map(([category]) => category),
      hasSsoSignOut: Boolean(document.querySelector('[data-testid="collab-sign-out"]')),
      hasAccessTokenValue: Boolean(document.querySelector('[data-testid="collab-token"]')?.value),
      dashboardConnected: document.querySelector('[data-testid="collab-status"]')?.textContent?.startsWith('connected as ') === true,
      hasCallbackCode: new URL(location.href).searchParams.has('code'), hasCallbackError: new URL(location.href).searchParams.has('error'),
    }), { dashboardOrigin, providerOrigin });
  } catch { /* A closed browser has no UI diagnostic. */ }
  console.error(`KEYCLOAK_INTEGRATION_FAILED: ${JSON.stringify({ phase, error: error?.name ?? 'UnknownError', ui, responseStatuses, grantShapes, navigationKinds, viteEvents })}`);
  process.exitCode = 1;
} finally { await cleanup(); }
