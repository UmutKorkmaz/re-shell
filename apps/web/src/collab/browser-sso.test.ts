import { webcrypto, createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { beginSso, BrowserSsoSession, completeSso, SSO_TRANSACTION_KEY, ssoCallbackScreen, validateSsoConfig } from './browser-sso';

const cp = 'https://cp.example';
const href = 'https://dash.example/?screen=admin';
const config = { issuer: 'https://id.example', clientId: 'dashboard', authorizationEndpoint: 'https://id.example/auth',
  tokenEndpoint: 'https://id.example/token', redirectUris: [href], scope: 'openid api', requireResponseIssuer: true };
function setup() {
  const tokenCalls: RequestInit[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url) === `${cp}/auth/oidc`) return new Response(JSON.stringify({ ok: true, data: config }));
    tokenCalls.push(init!);
    return new Response(JSON.stringify({ access_token: 'access-credential', token_type: 'Bearer', expires_in: 300, id_token: 'id-credential', refresh_token: 'refresh-credential' }));
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
    callback.searchParams.set('session_state', 'provider-session-opaque-marker');
    const replaceUrl = vi.fn(); const result = await completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl, now: 2000 });
    expect(result).toMatchObject({ accessToken: 'access-credential', controlPlaneUrl: cp });
    expect(result.session.canRefresh).toBe(true);
    const sent = new URLSearchParams(String(tokenCalls[0].body)); expect(sent.get('code_verifier')).toBe(pending.verifier);
    expect(sent.has('client_secret')).toBe(false); expect(tokenCalls[0]).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    expect(replaceUrl).toHaveBeenCalledWith(href); expect(sessionStorage.length).toBe(0); expect(localStorage.length).toBe(0);
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl, now: 2000 })).rejects.toThrow('no pending');
    expect(tokenCalls).toHaveLength(1);
  });
  it.each(['state', 'issuer', 'redirect', 'duplicate', 'expired', 'cp', 'query-token', 'query-refresh', 'provider-error', 'fragment'])('rejects %s before exchanging and clears callback and transaction', async (kind) => {
    const { fetchImpl, tokenCalls } = setup(); const { callback } = await started(fetchImpl); let url = cp; let now = 2000;
    if (kind === 'state') callback.searchParams.set('state', 'foreign');
    if (kind === 'issuer') callback.searchParams.set('iss', 'https://foreign.example');
    if (kind === 'redirect') callback.pathname = '/other';
    if (kind === 'duplicate') callback.searchParams.append('code', 'other');
    if (kind === 'expired') now = 400_000;
    if (kind === 'cp') url = 'https://foreign.example';
    if (kind === 'query-token') callback.searchParams.set('access_token', 'bad');
    if (kind === 'query-refresh') callback.searchParams.set('refresh_token', 'bad');
    if (kind === 'provider-error') callback.searchParams.set('error', 'access_denied');
    if (kind === 'fragment') callback.hash = 'access_token=bad';
    const replaceUrl = vi.fn();
    await expect(completeSso({ controlPlaneUrl: url, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl, now })).rejects.toThrow();
    expect(tokenCalls).toHaveLength(0); expect(sessionStorage.length).toBe(0);
    const cleaned = new URL(replaceUrl.mock.calls[0][0]); expect(cleaned.searchParams.has('code')).toBe(false); expect(cleaned.searchParams.has('access_token')).toBe(false); expect(cleaned.searchParams.has('refresh_token')).toBe(false); expect(cleaned.hash).toBe('');
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

describe('memory-only session renewal and provider logout', () => {
  async function session() {
    let grants = 0;
    const requests: Array<{ url: string; body: URLSearchParams }> = [];
    const pinned = { ...config, revocationEndpoint: 'https://id.example/revoke', endSessionEndpoint: 'https://id.example/logout' };
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url) === `${cp}/auth/oidc`) return new Response(JSON.stringify({ ok: true, data: pinned }));
      requests.push({ url: String(url), body: new URLSearchParams(String(init?.body)) });
      if (String(url) === pinned.revocationEndpoint) return new Response(null, { status: 200 });
      grants += 1;
      return new Response(JSON.stringify({ access_token: `access-${grants}`, refresh_token: `refresh-${grants}`, expires_in: 60, token_type: 'Bearer', id_token: 'never-retained-id' }));
    }) as typeof fetch;
    const { callback } = await started(fetchImpl);
    const result = await completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, fetchImpl, replaceUrl: vi.fn(), now: 2000 });
    return { ...result, fetchImpl, requests, pinned };
  }
  it('serializes rotating refresh grants and revokes the latest refresh/access pair before pinned logout', async () => {
    const { session: active, requests } = await session();
    expect(active.expiresAt).toBe(62_000);
    const one = active.refresh(3000); const two = active.refresh(3000);
    expect(one).toBe(two); expect(await one).toBe('access-2');
    expect(requests.filter((r) => r.body.get('grant_type') === 'refresh_token')).toHaveLength(1);
    expect(requests[1].body.get('refresh_token')).toBe('refresh-1');
    expect(await active.refresh(4000)).toBe('access-3');
    expect(requests[2].body.get('refresh_token')).toBe('refresh-2');
    const logout = new URL((await active.signOut())!);
    expect(logout.origin + logout.pathname).toBe('https://id.example/logout');
    expect(logout.searchParams.get('post_logout_redirect_uri')).toBe(href);
    expect(logout.searchParams.get('client_id')).toBe(config.clientId);
    expect(logout.searchParams.has('id_token_hint')).toBe(false);
    expect(requests.slice(-2).map((r) => [r.body.get('token'), r.body.get('token_type_hint')])).toEqual([
      ['refresh-3', 'refresh_token'], ['access-3', 'access_token'],
    ]);
    expect(active.canRefresh).toBe(false);
    await expect(active.refresh()).rejects.toThrow('Sign in again');
    expect(JSON.stringify(active)).not.toContain('refresh-');
    expect(JSON.stringify(active)).not.toContain('never-retained-id');
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });
  it('fails closed on changed configuration and does not send refresh credentials to replacement endpoints', async () => {
    const { session: active, fetchImpl, requests, pinned } = await session();
    vi.mocked(fetchImpl).mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, data: { ...pinned, tokenEndpoint: 'https://other.example/token' } })));
    await expect(active.refresh()).rejects.toThrow('Session renewal failed');
    expect(requests).toHaveLength(1); expect(active.canRefresh).toBe(false);
  });
  it('does not resurrect a closed session after a pending refresh response', async () => {
    const { session: active, fetchImpl } = await session();
    let resolve!: (value: Response) => void;
    vi.mocked(fetchImpl).mockImplementationOnce(async () => new Response(JSON.stringify({ ok: true, data: active.config })))
      .mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    const pending = active.refresh();
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    active.close();
    resolve(new Response(JSON.stringify({ access_token: 'late-access', refresh_token: 'late-refresh', token_type: 'Bearer', expires_in: 60 })));
    await expect(pending).rejects.toThrow('Session renewal failed'); expect(active.canRefresh).toBe(false);
  });
  it('waits for in-flight rotation before sign-out revocation, and never persists credentials', async () => {
    const { session: active, requests } = await session();
    const revokeLocal = vi.fn(async () => undefined);
    const pending = active.refresh(); const logout = active.signOut(revokeLocal);
    await pending; await logout;
    expect(revokeLocal).toHaveBeenCalledTimes(1); expect(revokeLocal).toHaveBeenCalledWith('access-2');
    expect(requests.slice(-2).map((r) => r.body.get('token'))).toEqual(['refresh-2', 'access-2']);
    expect(active.canRefresh).toBe(false); expect(localStorage.length + sessionStorage.length).toBe(0);
  });
  it('clears credentials and surfaces provider revocation failure without token text', async () => {
    const { session: active, fetchImpl } = await session();
    vi.mocked(fetchImpl).mockResolvedValueOnce(new Response('private-provider-error', { status: 503 }));
    await expect(active.signOut()).rejects.toThrow('Local credentials cleared; server or provider revocation failed');
    expect(active.canRefresh).toBe(false); await expect(active.refresh()).rejects.toThrow('Sign in again');
  });
  it('invokes provider fetch without binding the session as the browser receiver', async () => {
    const fetchImpl = vi.fn(async function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return new Response(null, { status: 200 });
    }) as typeof fetch;
    const active = new BrowserSsoSession({ ...config, revocationEndpoint: 'https://id.example/revoke' }, cp, href,
      { accessToken: 'access', refreshToken: 'refresh', expiresAt: 60_000 }, fetchImpl);
    await expect(active.signOut()).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(active.canRefresh).toBe(false);
  });
});


describe('token response limits', () => {
  it.each([0, -1, 1.5, 86_401, '300', undefined])('refuses invalid refresh-grant access lifetime %s', async (expires_in) => {
    const { fetchImpl } = setup(); const { callback } = await started(fetchImpl);
    const invalid = vi.fn(async (url: RequestInfo | URL) => new Response(JSON.stringify(String(url).endsWith('/auth/oidc') ? { ok: true, data: config } : {
      access_token: 'valid-access', refresh_token: 'valid-refresh', token_type: 'Bearer', expires_in,
    }))) as typeof fetch;
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, replaceUrl: vi.fn(), fetchImpl: invalid, now: 2000 })).rejects.toThrow('expiry');
    expect(sessionStorage.length).toBe(0);
  });
  it('limits streamed token replies before retaining an oversized body', async () => {
    const { fetchImpl } = setup(); const { callback } = await started(fetchImpl);
    const large = vi.fn(async (url: RequestInfo | URL) => new Response(String(url).endsWith('/auth/oidc') ? JSON.stringify({ ok: true, data: config }) : 'x'.repeat(65_537))) as typeof fetch;
    await expect(completeSso({ controlPlaneUrl: cp, href: callback.href, storage: sessionStorage, replaceUrl: vi.fn(), fetchImpl: large, now: 2000 })).rejects.toThrow('too large');
  });
});
