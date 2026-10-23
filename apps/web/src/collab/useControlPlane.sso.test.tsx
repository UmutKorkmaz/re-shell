import React from 'react';
import { webcrypto } from 'node:crypto';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlPlaneProvider, useControlPlane } from './useControlPlane';
import { useScreenRoute } from '../shell/useScreenRoute';
import { beginSso, SSO_TRANSACTION_KEY } from './browser-sso';
import { loadConnectionSettings, saveConnectionSettings } from './connection-settings';

const cp = 'https://cp.example';
function Probe() {
  const value = useControlPlane();
  return <div><span data-testid="status">{value.status}</span><span data-testid="identity">{value.identity?.userId}</span><span data-testid="token">{value.settings.token}</span><span>{value.error}</span><span data-testid="remember">{String(value.settings.rememberToken)}</span>
    <button onClick={() => value.updateSettings({ tenant: 'acme', iceServers: '[]' })}>Edit metadata</button>
    <button onClick={() => value.updateSettings({ rememberToken: true })}>Remember current token</button>
    <button onClick={() => void value.signOut()}>Sign out</button>
    <button onClick={() => value.disconnect()}>Disconnect</button>
    <button onClick={() => void value.connect()}>Connect</button>
    <button onClick={() => value.updateSettings({ rememberToken: false })}>Stop remembering</button>
    <button onClick={() => value.forgetToken()}>Forget</button></div>;
}
const initialHref = window.location.href;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); window.history.replaceState(null, '', '/?screen=admin'); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); cleanup(); window.history.replaceState(null, '', initialHref); });
async function callback(rememberToken = false, expiresIn = 300) {
  const href = window.location.href;
  const config = { issuer: 'https://id.example', clientId: 'dashboard', authorizationEndpoint: 'https://id.example/authorize', tokenEndpoint: 'https://id.example/token',
    redirectUris: [href], scope: 'openid', requireResponseIssuer: true };
  const requests: { url: string; authorization: string | null }[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), authorization: new Headers(init?.headers).get('Authorization') });
    if (String(url) === `${cp}/auth/oidc`) return new Response(JSON.stringify({ ok: true, data: config }));
    if (String(url) === config.tokenEndpoint) return new Response(JSON.stringify({ access_token: String(init?.body).includes('grant_type=refresh_token') ? 'renewed-access-token' : 'only-access-token', token_type: 'Bearer', expires_in: expiresIn, id_token: 'ignored-id', refresh_token: 'ignored-refresh' }));
    if (String(url) === `${cp}/auth/oidc/logout`) return new Response(null, { status: 204 });
    if (String(url) === `${cp}/me`) return new Response(JSON.stringify({ ok: true, data: { userId: 'oidc:user', tenants: [{ tenantId: 'acme', role: 'viewer' }] } }));
    throw new Error('Unexpected fetch');
  }) as typeof fetch;
  saveConnectionSettings({ url: cp, tenant: '', token: 'previous-manual-token', rememberToken, iceServers: '' });
  const authorization = new URL(await beginSso({ controlPlaneUrl: cp, href, storage: sessionStorage, fetchImpl, cryptoImpl: webcrypto as unknown as Crypto }));
  const redirect = new URL(href); redirect.searchParams.set('code', 'code'); redirect.searchParams.set('state', authorization.searchParams.get('state')!); redirect.searchParams.set('iss', config.issuer);
  window.history.replaceState(null, '', redirect);
  return { fetchImpl, requests };
}
describe('control plane full-page SSO callback integration', () => {
  it('connects once under StrictMode with access token, cleans history, and leaves token storage unchanged', async () => {
    const { fetchImpl, requests } = await callback();
    render(<React.StrictMode><ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider></React.StrictMode>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'));
    expect(screen.getByTestId('identity')).toHaveTextContent('oidc:user'); expect(screen.getByTestId('token')).toHaveTextContent('only-access-token');
    expect(requests.filter((r) => r.url.endsWith('/me'))).toEqual([{ url: `${cp}/me`, authorization: 'Bearer only-access-token' }]);
    expect(sessionStorage.getItem(SSO_TRANSACTION_KEY)).toBeNull();
    expect(loadConnectionSettings().token).toBe('previous-manual-token');
    expect(window.location.search).toBe('?screen=admin');
    expect([...Array(localStorage.length)].map((_, i) => localStorage.getItem(localStorage.key(i)!)).join('')).not.toContain('only-access-token');
  });
  it('never inherits an old Remember preference or persists SSO on unrelated edits; current explicit consent works', async () => {
    const { fetchImpl } = await callback(true);
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'));
    expect(screen.getByTestId('remember')).toHaveTextContent('false');
    fireEvent.click(screen.getByRole('button', { name: 'Edit metadata' }));
    expect(loadConnectionSettings().token).toBe('previous-manual-token');
    const stored = [...Array(localStorage.length)].map((_, i) => localStorage.getItem(localStorage.key(i)!)).join('') +
      [...Array(sessionStorage.length)].map((_, i) => sessionStorage.getItem(sessionStorage.key(i)!)).join('');
    expect(stored).not.toContain('only-access-token'); expect(stored).not.toContain('ignored-id'); expect(stored).not.toContain('ignored-refresh');
    fireEvent.click(screen.getByRole('button', { name: 'Remember current token' }));
    expect(loadConnectionSettings().token).toBe('only-access-token'); expect(loadConnectionSettings().rememberToken).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Stop remembering' }));
    expect(loadConnectionSettings().token).toBe('');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('only-access-token');
  });
  it('scrubs callback before a blocked sessionStorage getter and reports the error', async () => {
    const { fetchImpl } = await callback();
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('Tab storage is blocked.'); });
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    expect(await screen.findByText('Tab storage is blocked.')).toBeInTheDocument();
    expect(window.location.search).toBe('?screen=admin');
    expect(window.location.href).not.toContain('code=');
    expect(window.location.href).not.toContain('state=');
  });
  it('routes a base-URL callback to the connection screen and scrubs it even with blocked storage', async () => {
    window.history.replaceState(null, '', '/');
    const { fetchImpl } = await callback();
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new Error('Tab storage is blocked.'); });
    function RoutedProbe() {
      const [route] = useScreenRoute();
      return route === 'collab' ? <ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider> : <span>Wrong screen</span>;
    }
    render(<RoutedProbe />);
    expect(await screen.findByText('Tab storage is blocked.')).toBeInTheDocument();
    expect(window.location.search).toBe(''); expect(window.location.hash).toBe('');
    expect(screen.queryByText('Wrong screen')).not.toBeInTheDocument();
  });
  it('reports state mismatch and cleans callback without auto-connecting the previous token', async () => {
    const { fetchImpl, requests } = await callback();
    const url = new URL(window.location.href); url.searchParams.set('state', 'foreign'); window.history.replaceState(null, '', url);
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    expect(await screen.findByText('Sign-in state did not match. Start sign-in again.')).toBeInTheDocument();
    expect(requests.some((r) => r.url.endsWith('/me'))).toBe(false); expect(window.location.search).toBe('?screen=admin');
  });
});


describe('SSO renewal in the dashboard', () => {
  it('continues renewing when the provider extends expiry without changing the access-token string', async () => {
    const { fetchImpl } = await callback(false, 60);
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    for (let count = 1; count <= 3; count += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
      const renewals = vi.mocked(fetchImpl).mock.calls.filter(([, init]) =>
        String(init?.body).includes('grant_type=refresh_token'));
      expect(renewals).toHaveLength(count);
      expect(screen.getByTestId('token')).toHaveTextContent('renewed-access-token');
      expect(screen.getByTestId('status')).toHaveTextContent('connected');
    }
  });
  it('does not undo a Remember opt-out while the renewed token is being validated', async () => {
    const { fetchImpl } = await callback(false, 60);
    const original = vi.mocked(fetchImpl).getMockImplementation()!;
    let finishValidation!: () => void;
    const pending = new Promise<void>((resolve) => { finishValidation = resolve; });
    vi.mocked(fetchImpl).mockImplementation(async (url, init) => {
      if (String(url).endsWith('/me') && new Headers(init?.headers).get('Authorization') === 'Bearer renewed-access-token') await pending;
      return original(url, init);
    });
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fireEvent.click(screen.getByRole('button', { name: 'Remember current token' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Stop remembering' }));
    await act(async () => { finishValidation(); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId('remember')).toHaveTextContent('false');
    expect(screen.getByTestId('token')).toHaveTextContent('renewed-access-token');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('renewed-access-token');
  });
  it('keeps connected children mounted through renewal and preserves SSO across disconnect/reconnect', async () => {
    const { fetchImpl } = await callback(false, 60);
    vi.useFakeTimers();
    let mounts = 0;
    function ActiveChild() {
      React.useEffect(() => { mounts += 1; }, []);
      return <span>Joined session remains</span>;
    }
    function ConnectedChild() { return useControlPlane().status === 'connected' ? <ActiveChild /> : null; }
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /><ConnectedChild /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mounts).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('token')).toHaveTextContent('renewed-access-token');
    expect(mounts).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remember current token' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop remembering' }));
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('renewed-access-token');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Connect' })); });
    expect(screen.getByTestId('status')).toHaveTextContent('connected');
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('status')).toHaveTextContent('connected');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign out' })); });
    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
  });
  it.each([false, true])('renews only in memory unless access-token Remember is explicitly enabled (%s)', async (remember) => {
    const { fetchImpl, requests } = await callback(false, 60);
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByTestId('status')).toHaveTextContent('connected');
    if (remember) fireEvent.click(screen.getByRole('button', { name: 'Remember current token' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('token')).toHaveTextContent('renewed-access-token');
    expect(requests.filter((r) => r.url.endsWith('/me')).at(-1)?.authorization).toBe('Bearer renewed-access-token');
    expect(loadConnectionSettings().token).toBe(remember ? 'renewed-access-token' : 'previous-manual-token');
    const stored = JSON.stringify({ ...localStorage, ...sessionStorage });
    expect(stored).not.toContain('ignored-refresh'); expect(stored).not.toContain('ignored-id');
    fireEvent.click(screen.getByRole('button', { name: 'Forget' }));
    const before = requests.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(requests).toHaveLength(before); expect(loadConnectionSettings().token).toBe('');
    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
  });
  it('clears local credentials on sign-out even without provider logout configuration', async () => {
    const { fetchImpl, requests } = await callback();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('connected'));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })));
    expect(requests.filter((r) => r.url.endsWith('/auth/oidc/logout'))).toEqual([{ url: `${cp}/auth/oidc/logout`, authorization: 'Bearer only-access-token' }]);
    expect(screen.getByTestId('status')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('token')).toBeEmptyDOMElement();
    expect(loadConnectionSettings().token).toBe('');
  });
});
