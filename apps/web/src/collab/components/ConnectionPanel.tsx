import * as React from 'react';
import { Badge, Button, Input } from '@re-shell/ui';
import { Plug } from 'lucide-react';

import { parseIceOverride, type ConnectionSettings } from '../connection-settings';
import type { ConnectionStatus, Identity } from '../useControlPlane';
import { Field, InlineError, Panel } from './shared';

export interface ConnectionPanelProps {
  settings: ConnectionSettings;
  status: ConnectionStatus;
  error: string | null;
  warning: string | null;
  identity: Identity | null;
  tenantId: string | null;
  role: string | null;
  onChange: (patch: Partial<ConnectionSettings>) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onForgetToken: () => void;
}

const STATUS_VARIANT = {
  disconnected: 'outline',
  connecting: 'info',
  connected: 'healthy',
  error: 'critical',
} as const;

/** Control-plane connection settings: URL, tenant and bearer token (plus an optional ICE override). */
export function ConnectionPanel(props: ConnectionPanelProps): React.ReactElement {
  const { settings, status, error, warning, identity, tenantId, role } = props;
  const ice = parseIceOverride(settings.iceServers);
  const connected = status === 'connected';

  return (
    <Panel
      testId="collab-connection"
      icon={<Plug className="size-3.5 text-signal" />}
      title="Control plane"
      description="The hosted control plane that shares sessions between teammates. Your token never leaves this browser except as an Authorization header to this URL."
      actions={
        <Badge variant={STATUS_VARIANT[status]} data-testid="collab-status">
          {connected && identity ? `connected as ${identity.userId}` : status}
        </Badge>
      }
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        data-testid="collab-connection-form"
        onSubmit={(event) => {
          event.preventDefault();
          props.onConnect();
        }}
      >
        <Field id="collab-url" label="Control plane URL" hint="For example https://control-plane.example.com">
          <Input
            id="collab-url"
            data-testid="collab-url"
            value={settings.url}
            placeholder="http://127.0.0.1:8787"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => props.onChange({ url: e.target.value })}
          />
        </Field>
        <Field id="collab-tenant" label="Tenant" hint="Optional when your token belongs to exactly one tenant.">
          <Input
            id="collab-tenant"
            data-testid="collab-tenant"
            value={settings.tenant}
            placeholder="acme"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => props.onChange({ tenant: e.target.value })}
          />
        </Field>
        <Field
          id="collab-token"
          label="Bearer token"
          hint={
            settings.rememberToken
              ? 'Stored on this device until you forget it.'
              : 'Kept for this tab only (sessionStorage); cleared when the tab closes.'
          }
        >
          <Input
            id="collab-token"
            data-testid="collab-token"
            type="password"
            value={settings.token}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => props.onChange({ token: e.target.value })}
          />
        </Field>
        <div className="grid content-start gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="collab-remember"
              checked={settings.rememberToken}
              onChange={(e) => props.onChange({ rememberToken: e.target.checked })}
            />
            Remember the token on this device
          </label>
          <Field
            id="collab-ice"
            label="ICE servers override (optional)"
            hint="JSON array. Empty = the server's configuration; with none configured only host candidates are used."
          >
            <Input
              id="collab-ice"
              data-testid="collab-ice"
              value={settings.iceServers}
              placeholder='[{"urls":"stun:stun.example.org:3478"}]'
              aria-invalid={!ice.ok}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => props.onChange({ iceServers: e.target.value })}
            />
          </Field>
          {!ice.ok ? <InlineError message={ice.message} /> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <Button type="submit" data-testid="collab-connect" disabled={status === 'connecting' || !ice.ok}>
            {connected ? 'Reconnect' : 'Connect'}
          </Button>
          {connected ? (
            <Button type="button" variant="outline" data-testid="collab-disconnect" onClick={props.onDisconnect}>
              Disconnect
            </Button>
          ) : null}
          <Button type="button" variant="ghost" data-testid="collab-forget" onClick={props.onForgetToken}>
            Forget token
          </Button>
          {connected && tenantId ? (
            <span className="text-sm text-muted-foreground" data-testid="collab-identity">
              tenant <span className="font-mono">{tenantId}</span> · role <span className="font-mono">{role}</span>
            </span>
          ) : null}
        </div>
        {warning ? (
          <p className="text-sm text-warn md:col-span-2" role="status">
            {warning}
          </p>
        ) : null}
        {error ? (
          <div className="md:col-span-2">
            <InlineError message={error} />
          </div>
        ) : null}
      </form>
    </Panel>
  );
}
