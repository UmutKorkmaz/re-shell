import * as React from 'react';
import { ControlPlaneClient, ControlPlaneError } from '@re-shell/contracts';

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
  tenants: Array<{ tenantId: string; role: string }>;
}

interface ControlPlaneContextValue {
  settings: ConnectionSettings;
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
}: ControlPlaneProviderProps): React.ReactElement {
  const [settings, setSettings] = React.useState<ConnectionSettings>(() => loadConnectionSettings());
  const [status, setStatus] = React.useState<ConnectionStatus>('disconnected');
  const [error, setError] = React.useState<string | null>(null);
  const [warning, setWarning] = React.useState<string | null>(null);
  const [identity, setIdentity] = React.useState<Identity | null>(null);
  const [client, setClient] = React.useState<ControlPlaneClient | null>(null);
  const [tenantId, setTenantId] = React.useState<string | null>(null);
  const attempt = React.useRef(0);

  const updateSettings = React.useCallback((patch: Partial<ConnectionSettings>): void => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveConnectionSettings(next);
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

  const connect = React.useCallback(async (): Promise<void> => {
    const mine = ++attempt.current;
    setError(null);
    const url = checkControlPlaneUrl(settings.url);
    if (!url.ok) {
      setStatus('error');
      setError(url.message);
      return;
    }
    if (settings.token.trim() === '') {
      setStatus('error');
      setError('Enter a bearer token.');
      return;
    }
    setWarning(url.warning ?? null);
    setStatus('connecting');
    const next = new ControlPlaneClient({ baseUrl: url.url, token: settings.token.trim(), fetch: fetchImpl });
    try {
      const me = await next.me();
      if (attempt.current !== mine) return;
      let tenant = settings.tenant.trim();
      if (tenant === '') {
        if (me.tenants.length === 1) tenant = me.tenants[0].tenantId;
        else {
          throw new Error(
            me.tenants.length === 0
              ? 'This token is not a member of any tenant.'
              : `This token belongs to several tenants (${me.tenants.map((t) => t.tenantId).join(', ')}); enter one.`
          );
        }
      }
      if (!me.tenants.some((t) => t.tenantId === tenant)) {
        throw new Error(`This token is not a member of tenant "${tenant}".`);
      }
      setIdentity(me);
      setTenantId(tenant);
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
  }, [settings.url, settings.token, settings.tenant, fetchImpl]);

  const autoRan = React.useRef(false);
  React.useEffect(() => {
    if (autoRan.current || !autoConnect) return;
    autoRan.current = true;
    if (settings.url.trim() !== '' && settings.token.trim() !== '') {
      void connect();
    }
  }, [autoConnect, connect, settings.url, settings.token]);

  const role = identity && tenantId ? (identity.tenants.find((t) => t.tenantId === tenantId)?.role ?? null) : null;

  const value = React.useMemo<ControlPlaneContextValue>(
    () => ({
      settings,
      updateSettings,
      status,
      error,
      warning,
      identity,
      tenantId,
      role,
      client,
      connect,
      disconnect,
      forgetToken: () => {
        clearConnectionToken();
        updateSettings({ token: '' });
        disconnect();
      },
    }),
    [settings, updateSettings, status, error, warning, identity, tenantId, role, client, connect, disconnect]
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
