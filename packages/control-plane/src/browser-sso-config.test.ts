import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadOidcBrowserConfig } from './config.js';
import { OidcJwks } from './oidc.js';
import { startHarness } from './test-support/harness.js';
const publicKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
const oidc = { issuer: 'https://id.example', audience: 'api', jwks: new OidcJwks({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k' }] }) };
const env = { CONTROL_PLANE_OIDC_CLIENT_ID: 'dashboard', CONTROL_PLANE_OIDC_AUTHORIZATION_ENDPOINT: 'https://id.example/auth', CONTROL_PLANE_OIDC_TOKEN_ENDPOINT: 'https://id.example/token',
  CONTROL_PLANE_OIDC_REDIRECT_URIS: 'https://dashboard.example/?screen=admin', CONTROL_PLANE_CORS_ORIGINS: 'https://dashboard.example' };
describe('operator-pinned browser client config', () => {
  it('is opt-in and exposes public settings only through a no-store endpoint', async () => {
    expect(loadOidcBrowserConfig({})).toMatchObject({ ok: true, data: undefined });
    const parsed = loadOidcBrowserConfig(env, oidc); if (!parsed.ok) throw new Error('config failed');
    expect(parsed.data?.requireResponseIssuer).toBe(true);
    const h = await startHarness({ serverOptions: { oidc, oidcBrowser: parsed.data }, corsOrigins: ['https://dashboard.example'] });
    try {
      const response = await h.request('GET', '/auth/oidc', { headers: { Origin: 'https://dashboard.example' } });
      expect(response.status).toBe(200); expect(response.json.data).toEqual(parsed.data); expect(response.json.data.jwks).toBeUndefined();
      expect(response.headers.get('Cache-Control')).toBe('no-store'); expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://dashboard.example');
    } finally { await h.close(); }
  });
  it('rejects partial trust, unsafe endpoints, unknown redirect origins and callback response parameters', () => {
    expect(loadOidcBrowserConfig(env).ok).toBe(false);
    for (const patch of [ { CONTROL_PLANE_OIDC_CLIENT_ID: '' }, { CONTROL_PLANE_OIDC_TOKEN_ENDPOINT: 'http://id.example/token' },
      { CONTROL_PLANE_OIDC_AUTHORIZATION_ENDPOINT: 'https://user:secret@id.example/auth' }, { CONTROL_PLANE_OIDC_AUTHORIZATION_ENDPOINT: 'https://id.example/auth?client_secret=bad' },
      { CONTROL_PLANE_OIDC_REDIRECT_URIS: 'https://unknown.example/' }, { CONTROL_PLANE_OIDC_REDIRECT_URIS: 'https://dashboard.example/#fragment' },
      { CONTROL_PLANE_OIDC_REDIRECT_URIS: 'https://dashboard.example/?state=bad' }, { CONTROL_PLANE_OIDC_SCOPE: 'openid\nadmin' },
      { CONTROL_PLANE_OIDC_REQUIRE_RESPONSE_ISSUER: 'maybe' } ]) expect(loadOidcBrowserConfig({ ...env, ...patch }, oidc).ok, JSON.stringify(patch)).toBe(false);
  });
  it('returns an actionable error when browser sign-in is disabled', async () => {
    const h = await startHarness(); try { expect((await h.request('GET', '/auth/oidc')).status).toBe(404); } finally { await h.close(); }
  });
});
