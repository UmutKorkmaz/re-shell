import React from 'react';
import { webcrypto } from 'node:crypto';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlPlaneProvider, useControlPlane } from './useControlPlane';
import { useScreenRoute } from '../shell/useScreenRoute';
import { beginSso, SSO_TRANSACTION_KEY } from './browser-sso';
import { useCollabSession, useSharedDoc } from './useCollabSession';
import { FakeControlPlane } from './test-support/fake-control-plane';
import type { CollabConnection, ControlPlaneClient, SharedDocSync } from '@re-shell/contracts';
import { loadConnectionSettings, saveConnectionSettings } from './connection-settings';

const cp = 'https://cp.example';
function Probe() {
  const value = useControlPlane();
  return <div><span data-testid="status">{value.status}</span><span data-testid="identity">{value.identity?.userId}</span><span data-testid="token">{value.settings.token}</span><span>{value.error}</span><span data-testid="remember">{String(value.settings.rememberToken)}</span>
    <button onClick={() => value.updateSettings({ url: 'https://different.example' })}>Change endpoint</button>
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
async function callback(rememberToken = false, expiresIn = 300, controlPlaneUrl = cp) {
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
  saveConnectionSettings({ url: controlPlaneUrl, tenant: '', token: 'previous-manual-token', rememberToken, iceServers: '' });
  const authorization = new URL(await beginSso({ controlPlaneUrl, href, storage: sessionStorage, fetchImpl, cryptoImpl: webcrypto as unknown as Crypto }));
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
  it.each([false, true])('preserves pending OT and the stream across validated renewal (old token expired: %s)', async (expired) => {
    const { fetchImpl } = await callback(false, 60);
    const original = vi.mocked(fetchImpl).getMockImplementation()!;
    const server = new FakeControlPlane({ withSession: true });
    const calls: Array<{ path: string; authorization: string | null; body?: BodyInit | null }> = [];
    let finishValidation!: () => void;
    let validating = false;
    let rejectOldToken = false;
    const pendingValidation = new Promise<void>((resolve) => { finishValidation = resolve; });
    vi.mocked(fetchImpl).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const authorization = new Headers(init?.headers).get('Authorization');
      calls.push({ path: url.pathname + url.search, authorization, body: init?.body });
      if (url.pathname === '/me') {
        if (authorization === 'Bearer renewed-access-token') { validating = true; await pendingValidation; }
        return new Response(JSON.stringify({ ok: true, data: { userId: 'alice', tenants: [{ tenantId: 'acme', role: 'operator' }] } }));
      }
      if (url.pathname.startsWith('/tenants/')) {
        if (rejectOldToken && authorization === 'Bearer only-access-token') return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Expired.' } }), { status: 401 });
        // The wire-format fixture maps both validated tokens to the same user.
        const headers = new Headers(init?.headers);
        headers.set('Authorization', 'Bearer tok-alice');
        return server.fetch(input, { ...init, headers });
      }
      return original(input, init);
    });
    let current: { client: ControlPlaneClient | null; connection: CollabConnection | null; doc: SharedDocSync | null } = { client: null, connection: null, doc: null };
    function SharedEditor() {
      const cp = useControlPlane();
      const connected = cp.status === 'connected' ? cp.client : null;
      const live = useCollabSession(connected, cp.tenantId, '11111111-1111-4111-8111-111111111111');
      const view = useSharedDoc(connected, live.connection, 'notes', live.state?.docs.some((doc) => doc.id === 'notes') ?? false);
      current = { client: cp.client, connection: live.connection, doc: view.doc };
      return <><textarea aria-label="Shared notes" value={view.text} onChange={(event) => view.setText(event.target.value)} />
        <span data-testid="document-sync">{view.dirty ? 'pending' : 'synced'}</span></>;
    }
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /><SharedEditor /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(current.doc).not.toBeNull();
    const originalClient = current.client!;
    const originalConnection = current.connection!;
    const originalDoc = current.doc!;
    await act(async () => { await vi.advanceTimersByTimeAsync(48_000); });
    expect(validating).toBe(true);
    // The refresh grant has returned, but the API has not validated its token yet.
    expect(originalClient.token()).toBe('only-access-token');
    await act(async () => { await originalClient.listWorkspaces('acme'); server.dropStreams(); await vi.advanceTimersByTimeAsync(300); });
    expect(calls.filter((call) => call.path.startsWith('/tenants/')).every((call) => call.authorization === 'Bearer only-access-token')).toBe(true);
    expect(calls.filter((call) => call.path.includes('/stream'))).toHaveLength(2);
    if (expired) {
      await act(async () => { await vi.advanceTimersByTimeAsync(12_100); });
      rejectOldToken = true;
      await act(async () => { server.dropStreams(); await vi.advanceTimersByTimeAsync(300); });
    }
    fireEvent.change(screen.getByLabelText('Shared notes'), { target: { value: 'An edit waiting for its 120 ms flush' } });
    expect(originalDoc.dirty).toBe(true);
    if (expired) await act(async () => { await vi.advanceTimersByTimeAsync(120); });
    await act(async () => { finishValidation(); await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(120); });
    // Assert committed content first: a still-mounted child alone cannot catch lost edits.
    expect(server.state?.docs[0].content).toBe('An edit waiting for its 120 ms flush');
    expect(screen.getByLabelText('Shared notes')).toHaveValue('An edit waiting for its 120 ms flush');
    expect(screen.getByTestId('document-sync')).toHaveTextContent('synced');
    expect(current.client).toBe(originalClient);
    expect(current.connection).toBe(originalConnection);
    expect(current.doc).toBe(originalDoc);
    expect(originalClient.token()).toBe('renewed-access-token');
    const operations = calls.filter((call) => call.path.endsWith('/docs/notes/ops'));
    expect(operations.at(-1)?.authorization).toBe('Bearer renewed-access-token');
    if (expired) {
      expect(operations.map((call) => call.authorization)).toEqual(['Bearer only-access-token', 'Bearer renewed-access-token']);
      expect(operations[1].body).toBe(operations[0].body);
    }
    await act(async () => { await originalClient.listWorkspaces('acme'); server.dropStreams(); await vi.advanceTimersByTimeAsync(300); });
    expect(calls.filter((call) => call.path.endsWith('/workspaces')).at(-1)?.authorization).toBe('Bearer renewed-access-token');
    expect(calls.filter((call) => call.path.includes('/stream')).at(-1)?.authorization).toBe('Bearer renewed-access-token');
    expect(calls.filter((call) => call.path.endsWith('/join'))).toHaveLength(1);
    expect(current.connection).toBe(originalConnection);
    expect(current.doc).toBe(originalDoc);
  });
  it.each(['refresh failure', 'API refusal', 'identity change', 'membership loss'])('retires the connected credential on %s without publishing an invalid renewal', async (failure) => {
    const { fetchImpl } = await callback(false, 60);
    const original = vi.mocked(fetchImpl).getMockImplementation()!;
    vi.mocked(fetchImpl).mockImplementation(async (input, init) => {
      if (failure === 'refresh failure' && String(init?.body).includes('grant_type=refresh_token')) return new Response('{}', { status: 400 });
      if (String(input).endsWith('/me') && new Headers(init?.headers).get('Authorization') === 'Bearer renewed-access-token') {
        if (failure === 'API refusal') return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Rejected.' } }), { status: 401 });
        return new Response(JSON.stringify({ ok: true, data: { userId: failure === 'identity change' ? 'other-user' : 'oidc:user',
          tenants: failure === 'membership loss' ? [] : [{ tenantId: 'acme', role: 'viewer' }] } }));
      }
      return original(input, init);
    });
    const observed = { client: null as ControlPlaneClient | null };
    function CaptureClient() { observed.client = useControlPlane().client; return null; }
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /><CaptureClient /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const retainedClient = observed.client!;
    expect(retainedClient.token()).toBe('only-access-token');
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('status')).toHaveTextContent('error');
    expect(screen.getByTestId('token')).toBeEmptyDOMElement();
    expect(observed.client).toBeNull();
    expect(retainedClient.token()).toBe('');
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('renewed-access-token');
  });
  it.each([false, true])('handles a stale 401 after validation, checking retirement again after body disposal (%s)', async (retireDuringDisposal) => {
    const { fetchImpl } = await callback(false, 60);
    const original = vi.mocked(fetchImpl).getMockImplementation()!;
    let finishResponse!: () => void;
    const pendingResponse = new Promise<void>((resolve) => { finishResponse = resolve; });
    const sent: Array<string | null> = [];
    vi.mocked(fetchImpl).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/stream')) {
        sent.push(new Headers(init?.headers).get('Authorization'));
        if (sent.length === 1) {
          await pendingResponse;
          const response = new Response('{}', { status: 401 });
          if (retireDuringDisposal) vi.spyOn(response.body!, 'cancel').mockImplementation(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
          });
          return response;
        }
        return new Response(JSON.stringify({ ok: true, data: {} }));
      }
      return original(input, init);
    });
    let client: ControlPlaneClient | null = null;
    function Capture() { client = useControlPlane().client; return null; }
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /><Capture /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const request = client!.call('GET', '/tenants/acme/sessions/session/stream').catch(() => undefined);
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('token')).toHaveTextContent('renewed-access-token');
    await act(async () => { finishResponse(); await request; });
    expect(sent).toEqual(retireDuringDisposal ? ['Bearer only-access-token'] : ['Bearer only-access-token', 'Bearer renewed-access-token']);
  });
  it('renews when the stored endpoint is equivalent to its canonical URL', async () => {
    const { fetchImpl } = await callback(false, 60, 'https://CP.example:443/');
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('token')).toHaveTextContent('renewed-access-token');
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(vi.mocked(fetchImpl).mock.calls.filter(([, init]) => String(init?.body).includes('grant_type=refresh_token'))).toHaveLength(2);
  });
  it.each(['abort', 'disconnect', 'endpoint change', 'validation refusal', 'validation timeout'])('releases a waiting expired request on %s without replaying it', async (outcome) => {
    const { fetchImpl } = await callback(false, 60);
    const original = vi.mocked(fetchImpl).getMockImplementation()!;
    let finishValidation!: () => void;
    const pending = new Promise<void>((resolve) => { finishValidation = resolve; });
    let validationSignal: AbortSignal | null | undefined;
    const protectedHeaders: Array<string | null> = [];
    vi.mocked(fetchImpl).mockImplementation(async (input, init) => {
      if (String(input).endsWith('/me') && new Headers(init?.headers).get('Authorization') === 'Bearer renewed-access-token') {
        validationSignal = init?.signal;
        await pending; // Deliberately ignores abort: the provider must still bound its wait.
        return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Refused.' } }), { status: 401 });
      }
      if (String(input).includes('/tenants/')) {
        protectedHeaders.push(new Headers(init?.headers).get('Authorization'));
        return new Response(JSON.stringify({ ok: false, error: { code: 'UNAUTHENTICATED', message: 'Expired.' } }), { status: 401 });
      }
      return original(input, init);
    });
    let client: ControlPlaneClient | null = null;
    function Capture() { client = useControlPlane().client; return null; }
    vi.useFakeTimers();
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /><Capture /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    const controller = new AbortController();
    let settled = false;
    const waiting = client!.call('GET', '/tenants/acme/sessions/session/stream', undefined, controller.signal).then(() => { settled = true; }, () => { settled = true; });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(settled).toBe(false);
    // Arbitrary mutations must fail immediately, never join the retry gate.
    let unsafeSettled = false;
    void client!.call('POST', '/tenants/acme/sessions/session/commands', { command: 'do not replay' }).catch(() => { unsafeSettled = true; });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(unsafeSettled).toBe(true);
    await act(async () => {
      if (outcome === 'abort') controller.abort();
      else if (outcome === 'disconnect') fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
      else if (outcome === 'endpoint change') fireEvent.click(screen.getByRole('button', { name: 'Change endpoint' }));
      else if (outcome === 'validation refusal') finishValidation();
      else await vi.advanceTimersByTimeAsync(20_000);
      await vi.advanceTimersByTimeAsync(0);
    });
    await waiting;
    expect(settled).toBe(true);
    expect(protectedHeaders).toEqual(['Bearer only-access-token', 'Bearer only-access-token']);
    if (['disconnect', 'endpoint change', 'validation timeout'].includes(outcome)) expect(validationSignal?.aborted).toBe(true);
    if (outcome.startsWith('validation ')) expect(screen.getByTestId('status')).toHaveTextContent('error');
  });
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
    const observed = { client: null as ControlPlaneClient | null };
    function ActiveChild() {
      React.useEffect(() => { mounts += 1; }, []);
      return <span>Joined session remains</span>;
    }
    function ConnectedChild() { const cp = useControlPlane(); observed.client = cp.client; return cp.status === 'connected' ? <ActiveChild /> : null; }
    render(<ControlPlaneProvider fetchImpl={fetchImpl}><Probe /><ConnectedChild /></ControlPlaneProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(mounts).toBe(1);
    const firstClient = observed.client!;
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('token')).toHaveTextContent('renewed-access-token');
    expect(mounts).toBe(1);
    expect(observed.client).toBe(firstClient);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(firstClient.token()).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Remember current token' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop remembering' }));
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('renewed-access-token');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Connect' })); });
    expect(screen.getByTestId('status')).toHaveTextContent('connected');
    expect(observed.client).not.toBe(firstClient);
    expect(observed.client?.token()).toBe('renewed-access-token');
    await act(async () => { await vi.advanceTimersByTimeAsync(49_000); });
    expect(screen.getByTestId('status')).toHaveTextContent('connected');
    expect(firstClient.token()).toBe('');
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
