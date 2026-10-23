import * as React from 'react';
import { ControlPlaneClient, ControlPlaneError } from '@re-shell/contracts';
import { beginSso, completeSso, isSsoCallback, cleanSsoCallbackUrl, type BrowserSsoSession } from './browser-sso';

import {
  checkControlPlaneUrl,
  clearConnectionToken,
  loadConnectionSettings,
  saveConnectionSettings,
  type ConnectionSettings,
} from './connection-settings';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface Identity {
  userId: string;
  platformAdmin?: boolean;
  tenants: Array<{ tenantId: string; role: string }>;
}

interface ControlPlaneContextValue {
  settings: ConnectionSettings;
  tokenInMemory: boolean;
  updateSettings: (patch: Partial<ConnectionSettings>) => void;
  status: ConnectionStatus;
  error: string | null;
  warning: string | null;
  identity: Identity | null;
  /** The tenant the dashboard operates in (settings.tenant, or the only one the token has). */
  tenantId: string | null;
  role: string | null;
  /** Non-null once connected. */
  client: ControlPlaneClient | null;
  connect: () => Promise<void>;
  signIn: () => Promise<void>;
  ssoSession: boolean;
  signOut: () => Promise<void>;
  /** Drop the live connection (stored settings stay). */
  disconnect: () => void;
  /** Disconnect AND erase the stored token. */
  forgetToken: () => void;
}

const ControlPlaneContext = React.createContext<ControlPlaneContextValue | null>(null);

export interface ControlPlaneProviderProps {
  children: React.ReactNode;
  /** Inject `fetch` (tests). Defaults to the global. */
  fetchImpl?: typeof fetch;
  /** Connect immediately with the stored settings when they are complete. */
  autoConnect?: boolean;
  /** Administration can connect a platform operator before the first tenant exists. */
  allowTenantlessPlatformAdmin?: boolean;
}

function describe(error: unknown): string {
  if (error instanceof ControlPlaneError) {
    return error.status === 401
      ? 'The control plane rejected the token (expired or invalid).'
      : `${error.message} (${error.code})`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function ControlPlaneProvider({
  children,
  fetchImpl,
  autoConnect = true,
  allowTenantlessPlatformAdmin = false,
}: ControlPlaneProviderProps): React.ReactElement {
  const [settings, setSettings] = React.useState<ConnectionSettings>(() => loadConnectionSettings());
  const [status, setStatus] = React.useState<ConnectionStatus>('disconnected');
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [identity, setIdentity] = React.useState<Identity | null>(null);
  const [client, setClient] = React.useState<ControlPlaneClient | null>(null);
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const [renewalVersion, setRenewalVersion] = React.useState(0);
  const attempt = React.useRef(0);
  const volatileSsoToken = React.useRef<string | null>(null);
  const session = React.useRef<BrowserSsoSession | null>(null);
  const settingsRef = React.useRef(settings);
  settingsRef.current = settings;
  const identityRef = React.useRef(identity);
  identityRef.current = identity;

  const updateSettings = React.useCallback((patch: Partial<ConnectionSettings>): void => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if ((patch.url !== undefined && patch.url !== prev.url) || (patch.token !== undefined && patch.token !== prev.token)) {
        session.current?.close(); session.current = null;
        attempt.current += 1;
      }
      if (session.current && patch.rememberToken === false && patch.token === undefined) {
        volatileSsoToken.current = next.token;
        clearConnectionToken();
        saveConnectionSettings({ ...next, token: '' });
        return next;
      }
      // A prior manual Remember choice is not consent to persist a newly issued SSO credential.
      if (patch.token !== undefined || patch.rememberToken === true) volatileSsoToken.current = null;
      if (volatileSsoToken.current !== null && next.token === volatileSsoToken.current) {
        const stored = loadConnectionSettings();
        saveConnectionSettings({ ...next, token: stored.token, rememberToken: stored.rememberToken });
      } else saveConnectionSettings(next);
      return next;
    });
  }, []);

  const disconnect = React.useCallback((): void => {
    attempt.current += 1;
    setClient(null);
    setIdentity(null);
    setTenantId(null);
    setStatus('disconnected');
    setError(null);
  }, []);

  const connectWithSettings = React.useCallback(async (connection: ConnectionSettings): Promise<void> => {
    const mine = ++attempt.current;
    setError(null);
    const url = checkControlPlaneUrl(connection.url);
    if (!url.ok) {
      setStatus('error');
      setError(url.message);
      return;
    }
    if (connection.token.trim() === '') {
      setStatus('error');
      setError('Enter a bearer token.');
      return;
    }
    setWarning(url.warning ?? null);
    setStatus('connecting');
    const next = new ControlPlaneClient({ baseUrl: url.url, token: connection.token.trim(), fetch: fetchImpl });
    try {
      const me: Identity = await next.me();
      if (attempt.current !== mine) return;
      let tenant = connection.tenant.trim();
      if (tenant === '') {
        if (allowTenantlessPlatformAdmin && me.platformAdmin === true && me.tenants.length === 0) tenant = '';
        else if (me.tenants.length === 1) tenant = me.tenants[0].tenantId;
        else {
          throw new Error(
            me.tenants.length === 0
              ? 'This token is not a member of any tenant.'
              : `This token belongs to several tenants (${me.tenants.map((t) => t.tenantId).join(', ')}); enter one.`
          );
        }
      }
      if (!(tenant === '' && allowTenantlessPlatformAdmin && me.platformAdmin === true) && !me.tenants.some((t) => t.tenantId === tenant)) {
        throw new Error(`This token is not a member of tenant "${tenant}".`);
      }
      setIdentity(me);
      setTenantId(tenant || null);
      setClient(next);
      setStatus('connected');
    } catch (cause) {
      if (attempt.current !== mine) return;
      setClient(null);
      setIdentity(null);
      setTenantId(null);
      setStatus('error');
      setError(describe(cause));
    }
  }, [fetchImpl, allowTenantlessPlatformAdmin]);

  const connect = React.useCallback(async (): Promise<void> => {
    const active = session.current;
    const mine = ++attempt.current;
    let connection = settingsRef.current;
    if (active) {
      try {
        if (active.expiresAt !== undefined && active.expiresAt <= Date.now()) await active.refresh();
        if (attempt.current !== mine || session.current !== active) return;
        connection = { ...settingsRef.current, token: active.accessToken };
        if (connection.rememberToken) saveConnectionSettings(connection);
        volatileSsoToken.current = connection.rememberToken ? null : connection.token;
        setSettings(connection);
      } catch (cause) {
        if (attempt.current !== mine) return;
        active.close(); session.current = null;
        clearConnectionToken(); volatileSsoToken.current = null;
        setSettings((current) => ({ ...current, token: '', rememberToken: false }));
        setClient(null); setIdentity(null); setTenantId(null);
        setStatus('error'); setError(describe(cause));
        return;
      }
    }
    await connectWithSettings(connection);
  }, [connectWithSettings]);
  const signInBusy = React.useRef(false);
  const signIn = React.useCallback(async (): Promise<void> => {
    if (signInBusy.current) return;
    signInBusy.current = true;
    const mine = ++attempt.current;
    setError(null);
    setStatus('connecting');
    try {
      if (volatileSsoToken.current === null) saveConnectionSettings(settings);
      else {
        const stored = loadConnectionSettings();
        saveConnectionSettings({ ...settings, token: stored.token, rememberToken: stored.rememberToken });
      }
      const destination = await beginSso({ controlPlaneUrl: settings.url, href: window.location.href,
        storage: window.sessionStorage, fetchImpl });
      if (attempt.current === mine) window.location.assign(destination);
    } catch (cause) {
      if (attempt.current !== mine) return;
      setStatus('error');
      setError(describe(cause));
    } finally { signInBusy.current = false; }
  }, [settings, fetchImpl]);

  const autoRan = React.useRef(false);
  React.useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (isSsoCallback(window.location.href)) {
      const callbackHref = window.location.href;
      // Clear response parameters before even accessing storage: its getter may throw.
      window.history.replaceState(null, '', cleanSsoCallbackUrl(callbackHref));
      const mine = ++attempt.current;
      setStatus('connecting');
      void (async () => completeSso({ controlPlaneUrl: settings.url, href: callbackHref, storage: window.sessionStorage,
        replaceUrl: (url) => window.history.replaceState(null, '', url), fetchImpl }))().then(async (result) => {
          if (attempt.current !== mine) { result.session.close(); return; }
          // Sign-in itself keeps the access token in memory. Remembering remains an explicit user choice.
          const next = { ...settings, token: result.accessToken, rememberToken: false };
          session.current?.close();
          session.current = result.session;
          volatileSsoToken.current = result.accessToken;
          setSettings(next);
          await connectWithSettings(next);
        }).catch((cause: unknown) => {
          if (attempt.current !== mine) return;
          setStatus('error');
          setError(describe(cause));
        });
      return;
    }
    if (autoConnect && settings.url.trim() !== '' && settings.token.trim() !== '') void connect();
  }, [autoConnect, connect, connectWithSettings, fetchImpl, settings]);

  React.useEffect(() => {
    const active = session.current;
    if (!active || status !== 'connected' || active.expiresAt === undefined) return;
    let cancelled = false;
    const mine = attempt.current;
    const lifetime = active.expiresAt - Date.now();
    const delay = Math.max(0, lifetime - (active.canRefresh ? Math.min(30_000, Math.max(100, lifetime / 5)) : 0));
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!active.canRefresh) throw new Error('The SSO access token expired. Sign in again.');
          const accessToken = await active.refresh();
          if (cancelled || attempt.current !== mine || session.current !== active) return;
          const current = settingsRef.current;
          if (current.url.replace(/\/+$/, '') !== active.controlPlaneUrl) return;
          const nextClient = new ControlPlaneClient({ baseUrl: active.controlPlaneUrl, token: accessToken, fetch: fetchImpl });
          const me: Identity = await nextClient.me();
          if (cancelled || attempt.current !== mine || session.current !== active) return;
          if (me.userId !== identityRef.current?.userId || (tenantId && !me.tenants.some((tenant) => tenant.tenantId === tenantId))) {
            throw new Error('Session identity or tenant membership changed. Sign in again.');
          }
          // Remember and metadata can change while /me is pending. Use the
          // latest explicit choice; an old request must never restore consent.
          const latest = settingsRef.current;
          const next = { ...latest, token: accessToken };
          // Explicit Remember applies to rotated access tokens only; refresh credentials never reach storage.
          if (latest.rememberToken) saveConnectionSettings(next);
          volatileSsoToken.current = latest.rememberToken ? null : accessToken;
          // Swap the validated client without disconnecting mounted collaboration/admin state.
          setIdentity(me);
          setClient(nextClient);
          setSettings(next);
          // A provider may reuse an access token while extending its expiry.
          // Reschedule only after validation and the token update commit.
          setRenewalVersion((version) => version + 1);
        } catch (cause) {
          if (cancelled || attempt.current !== mine || session.current !== active) return;
          active.close(); session.current = null;
          if (loadConnectionSettings().token === settingsRef.current.token) clearConnectionToken();
          volatileSsoToken.current = null;
          setSettings((current) => ({ ...current, token: '', rememberToken: false }));
          setClient(null); setIdentity(null); setTenantId(null);
          setStatus('error'); setError(describe(cause));
        }
      })();
    }, Math.min(delay, 2_147_483_647));
    return () => { cancelled = true; clearTimeout(timer); };
  }, [settings.token, renewalVersion, status, fetchImpl, tenantId]);

  const signOut = React.useCallback(async (): Promise<void> => {
    const active = session.current;
    // Clear local access immediately, even when the provider is unavailable.
    session.current = null; volatileSsoToken.current = null;
    clearConnectionToken();
    setSettings((current) => ({ ...current, token: '', rememberToken: false }));
    disconnect();
    const mine = attempt.current;
    if (!active) return;
    try {
      const destination = await active.signOut(async (accessToken) => {
        const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20_000);
        try {
          const response = await (fetchImpl ?? fetch)(`${active.controlPlaneUrl}/auth/oidc/logout`, {
            method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          await response.body?.cancel();
          if (!response.ok) throw new Error('Control plane access revocation failed.');
        } finally { clearTimeout(timer); }
      });
      if (attempt.current !== mine) return;
      if (destination) window.location.assign(destination);
      else setWarning('Local credentials cleared. Provider-wide logout is not configured; other issued API tokens expire normally.');
    } catch (cause) { if (attempt.current === mine) setError(describe(cause)); }
  }, [disconnect, fetchImpl]);

  const role = identity && tenantId ? (identity.tenants.find((t) => t.tenantId === tenantId)?.role ?? null) : null;

  const tokenInMemory = volatileSsoToken.current !== null && settings.token === volatileSsoToken.current;

  const value = React.useMemo<ControlPlaneContextValue>(
    () => ({
      settings,
      tokenInMemory,
      updateSettings,
      status,
      error,
      warning,
      identity,
      tenantId,
      role,
      client,
      connect,
      signIn,
      ssoSession: session.current !== null,
      signOut,
      disconnect,
      forgetToken: () => {
        clearConnectionToken();
        updateSettings({ token: '' });
        disconnect();
      },
    }),
    [settings, tokenInMemory, updateSettings, status, error, warning, identity, tenantId, role, client, connect, signIn, signOut, disconnect]
  );

  return <ControlPlaneContext.Provider value={value}>{children}</ControlPlaneContext.Provider>;
}

export function useControlPlane(): ControlPlaneContextValue {
  const ctx = React.useContext(ControlPlaneContext);
  if (ctx === null) {
    throw new Error('useControlPlane must be used within a ControlPlaneProvider');
  }
  return ctx;
}
