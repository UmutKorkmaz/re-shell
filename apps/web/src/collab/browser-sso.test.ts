import { webcrypto, createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beginSso, completeSso, SSO_TRANSACTION_KEY, ssoCallbackScreen, validateSsoConfig } from './browser-sso';

const cp = 'https://cp.example';
const href = 'https://dash.example/?screen=admin';
const config = { issuer: 'https://id.example', clientId: 'dashboard', authorizationEndpoint: 'https://id.example/auth',
  tokenEndpoint: 'https://id.example/token', redirectUris: [href], scope: 'openid api', requireResponseIssuer: true };
function setup() {
  const tokenCalls: RequestInit[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === `${cp}/auth/oidc`) return new Response(JSON.stringify({ ok: true, data: config }));
    tokenCalls.push(init!);
    return new Response(JSON.stringify({ access_token: 'access-credential', token_type: 'Bearer', id_token: 'id-credential', refresh_token: 'refresh-credential' }));
  }) as typeof fetch;
  return { fetchImpl, tokenCalls };
}
async function started(fetchImpl: typeof fetch) {
  const authorization = new URL(await beginSso({ controlPlaneUrl: cp, href, storage: sessionStorage, fetchImpl, cryptoImpl: webcrypto as unknown as Crypto, now: 1000 }));
  const callback = new URL(href);
  callback.searchParams.set('code', 'authorization-code'); callback.searchParams.set('state', authorization.searchParams.get('state')!); callback.searchParams.set('iss', config.issuer);
  return { authorization, callback };
}
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });
describe('browser SSO transaction', () => {
  it('uses independent high entropy state/verifier and S256, consumes the callback and never stores tokens', async () => {
    const { fetchImpl, tokenCalls } = setup(); const { authorization, callback } = await started(fetchImpl);
    const pending = JSON.parse(sessionStorage.getItem(SSO_TRANSACTION_KEY)!);
    expect(pending.state).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(pending.verifier).not.toBe(pending.state);
    expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorization.searchParams.get('code_challenge')).toBe(createHash('sha256').update(pending.verifier).digest('base64url'));
    expect(authorization.searchParams.has('code_verifier')).toBe(false);
    expect(ssoCallbackScreen(callback.href, sessionStorage)).toBe('admin');
    const replaceUrl = vi.fn(); const result = await completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl, now: 2000 });
    expect(result).toEqual({ accessToken: 'access-credential', controlPlaneUrl: cp });
    const sent = new URLSearchParams(String(tokenCalls[0].body)); expect(sent.get('code_verifier')).toBe(pending.verifier);
    expect(sent.has('client_secret')).toBe(false); expect(tokenCalls[0]).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    expect(replaceUrl).toHaveBeenCalledWith(href); expect(sessionStorage.length).toBe(0); expect(localStorage.length).toBe(0);
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl, now: 2000 })).rejects.toThrow('no pending');
    expect(tokenCalls).toHaveLength(1);
  });
  it.each(['state', 'issuer', 'redirect', 'duplicate', 'expired', 'cp', 'query-token', 'provider-error', 'fragment'])('rejects %s before exchanging and clears callback and transaction', async (kind) => {
    const { fetchImpl, tokenCalls } = setup(); const { callback } = await started(fetchImpl); let url = cp; let now = 2000;
    if (kind === 'state') callback.searchParams.set('state', 'foreign');
    if (kind === 'issuer') callback.searchParams.set('iss', 'https://foreign.example');
    if (kind === 'redirect') callback.pathname = '/other';
    if (kind === 'duplicate') callback.searchParams.append('code', 'other');
    if (kind === 'expired') now = 400_000;
    if (kind === 'cp') url = 'https://foreign.example';
    if (kind === 'query-token') callback.searchParams.set('access_token', 'bad');
    if (kind === 'provider-error') callback.searchParams.set('error', 'access_denied');
    if (kind === 'fragment') callback.hash = 'access_token=bad';
    const replaceUrl = vi.fn();
    await expect(completeSso({ controlPlaneUrl: url, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl, now })).rejects.toThrow();
    expect(tokenCalls).toHaveLength(0); expect(sessionStorage.length).toBe(0);
    const cleaned = new URL(replaceUrl.mock.calls[0][0]); expect(cleaned.searchParams.has('code')).toBe(false); expect(cleaned.searchParams.has('access_token')).toBe(false); expect(cleaned.hash).toBe('');
  });
  it('does not surface credentials from malformed token replies or transaction JSON', async () => {
    const { fetchImpl } = setup(); const { callback } = await started(fetchImpl);
    const malformed = vi.fn(async (url: RequestInfo | URL) => new Response(String(url).endsWith('/auth/oidc') ? JSON.stringify({ ok: true, data: config }) : 'sensitive-token-marker-not-json')) as typeof fetch;
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl: malformed, replaceUrl: vi.fn(), now: 2000 })).rejects.toThrow('returned invalid JSON');
    sessionStorage.setItem(SSO_TRANSACTION_KEY, '{"verifier":"sensitive-verifier-marker');
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl: vi.fn(), now: 2000 })).rejects.toThrow('Invalid sign-in transaction.');
    expect(sessionStorage.length).toBe(0);
  });
  it('rejects an ID-token-only response', async () => {
    const { fetchImpl } = setup(); const { callback } = await started(fetchImpl);
    const onlyId = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(String(url).endsWith('/auth/oidc') ? { ok: true, data: config } : { id_token: 'not-an-access-token', token_type: 'Bearer' }))) as typeof fetch;
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl: onlyId, replaceUrl: vi.fn(), now: 2000 })).rejects.toThrow('bearer access token');
  });
  it('rejects changed pinned configuration and unavailable storage before leaving', async () => {
    const { fetchImpl } = setup(); const { callback } = await started(fetchImpl);
    const changed = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { ...config, clientId: 'changed' } }))) as typeof fetch;
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl: changed, replaceUrl: vi.fn(), now: 2000 })).rejects.toThrow('configuration changed');
    const blocked = { setItem: () => { throw new Error('blocked storage'); }, getItem: () => null } as unknown as Storage;
    await expect(beginSso({ controlPlaneUrl: cp, href, storage: blocked, fetchImpl, cryptoImpl: webcrypto as unknown as Crypto })).rejects.toThrow('blocked storage');
  });
  it('rejects non-loopback HTTP endpoints and unregistered dashboard redirects', async () => {
    expect(() => validateSsoConfig({ ...config, tokenEndpoint: 'http://id.example/token' })).toThrow();
    expect(() => validateSsoConfig({ ...config, redirectUris: ['https://dash.example/#token'] })).toThrow();
    const { fetchImpl } = setup();
    await expect(beginSso({ controlPlaneUrl: cp, href: 'https://different.example/', storage: sessionStorage, fetchImpl })).rejects.toThrow('not an allowed');
  });
});
