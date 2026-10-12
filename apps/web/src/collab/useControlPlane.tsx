import * as React from 'react';
import { ControlPlaneClient, ControlPlaneError } from '@re-shell/contracts';
import { beginSso, completeSso, isSsoCallback, cleanSsoCallbackUrl } from './browser-sso';

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
  const attempt = React.useRef(0);
  const volatileSsoToken = React.useRef<string | null>(null);

  const updateSettings = React.useCallback((patch: Partial<ConnectionSettings>): void => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
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

  const connect = React.useCallback(() => connectWithSettings(settings), [connectWithSettings, settings]);
  const signInBusy = React.useRef(false);
  const signIn = React.useCallback(async (): Promise<void> => {
    if (signInBusy.current) return;
    signInBusy.current = true;
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
      window.location.assign(destination);
    } catch (cause) {
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
          if (attempt.current !== mine) return;
          // Sign-in itself keeps the access token in memory. Remembering remains an explicit user choice.
          const next = { ...settings, token: result.accessToken, rememberToken: false };
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
      disconnect,
      forgetToken: () => {
        clearConnectionToken();
        updateSettings({ token: '' });
        disconnect();
      },
    }),
    [settings, tokenInMemory, updateSettings, status, error, warning, identity, tenantId, role, client, connect, signIn, disconnect]
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
