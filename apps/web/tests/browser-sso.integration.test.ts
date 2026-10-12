import { webcrypto } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { beginSso, completeSso, SSO_TRANSACTION_KEY } from '../src/collab/browser-sso';
import { startLocalOidcFixture } from '../../../scripts/test-support/local-oidc-fixture.mjs';
import { OidcJwks, oidcUserId } from '../../../packages/control-plane/src/oidc';
import { startHarness } from '../../../packages/control-plane/src/test-support/harness';

const href = 'http://127.0.0.1:8123/?screen=admin';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
function storage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => { values.set(k, v); }, removeItem: (k) => { values.delete(k); }, key: (n) => [...values.keys()][n] ?? null };
}
async function setup() {
  const idp = await startLocalOidcFixture({ redirectUris: [href] }); cleanup.push(idp.close);
  const userId = oidcUserId(idp.issuer, idp.subject);
  const cp = await startHarness({ corsOrigins: [new URL(href).origin], seed: { tenants: [{ id: 'acme', name: 'Acme' }], members: [{ tenantId: 'acme', userId, role: 'admin' }, { tenantId: 'acme', userId: 'local-owner', role: 'admin' }] },
    serverOptions: { oidc: { issuer: idp.issuer, audience: idp.audience, jwks: new OidcJwks(idp.jwks) }, oidcBrowser: idp.browserConfig } }); cleanup.push(cp.close);
  const tab = storage();
  const destination = await beginSso({ controlPlaneUrl: cp.url, href, storage: tab, cryptoImpl: webcrypto as unknown as Crypto });
  const authorization = await fetch(destination); expect(authorization.status).toBe(200);
  // Browsers enforce form-action across the approve->dashboard 303 redirect as well.
  const formAction = authorization.headers.get('content-security-policy')!.split(';').find((rule) => rule.trim().startsWith('form-action'))!;
  expect(formAction.split(/\s+/)).toContain(new URL(href).origin);
  expect(formAction).not.toContain('*');
  const requestId = (await authorization.text()).match(/name="request" value="([A-Za-z0-9_-]+)"/)![1];
  const approval = await fetch(`${idp.issuer}/approve`, { method: 'POST', body: new URLSearchParams({ request: requestId }), redirect: 'manual' });
  expect(approval.status).toBe(303);
  const callback = approval.headers.get('location')!;
  return { idp, cp, tab, callback, userId };
}
describe('real loopback authorization-code protocol and control-plane membership', () => {
  it('exchanges S256 code, authenticates /me with access token and applies SQLite membership removal', async () => {
    const { cp, tab, callback, userId, idp } = await setup();
    const transaction = JSON.parse(tab.getItem(SSO_TRANSACTION_KEY)!);
    let cleaned = '';
    const result = await completeSso({ controlPlaneUrl: cp.url, href: callback, storage: tab, replaceUrl: (url) => { cleaned = url; } });
    expect(cleaned).toBe(href); expect(tab.length).toBe(0); expect(result.accessToken).not.toContain('fixture-id-token');
    const me = await cp.request('GET', '/me', { token: result.accessToken });
    expect(me.status).toBe(200); expect(me.json.data).toMatchObject({ userId, tenants: [{ tenantId: 'acme', role: 'admin' }] });
    cp.store.removeMember('acme', userId);
    expect((await cp.request('GET', '/me', { token: result.accessToken })).json.data.tenants).toEqual([]);
    expect((await cp.request('GET', '/me', { token: 'fixture-id-token-must-never-be-used' })).status).toBe(401);
    const replay = await fetch(idp.browserConfig.tokenEndpoint, { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code',
      client_id: idp.clientId, redirect_uri: href, code: new URL(callback).searchParams.get('code')!, code_verifier: transaction.verifier }) });
    expect(replay.status).toBe(400); expect(await replay.json()).toEqual({ error: 'invalid_grant' });
  });
  it('refuses a wrong PKCE verifier at the real token endpoint and consumes the local transaction', async () => {
    const { cp, tab, callback } = await setup();
    const transaction = JSON.parse(tab.getItem(SSO_TRANSACTION_KEY)!); transaction.verifier = 'A'.repeat(43);
    tab.setItem(SSO_TRANSACTION_KEY, JSON.stringify(transaction));
    await expect(completeSso({ controlPlaneUrl: cp.url, href: callback, storage: tab, replaceUrl: () => undefined })).rejects.toThrow('rejected');
    expect(tab.length).toBe(0);
  });
});
