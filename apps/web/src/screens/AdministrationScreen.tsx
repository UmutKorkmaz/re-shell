import * as React from 'react';
import { ControlPlaneError, type ControlPlaneClient } from '@re-shell/contracts';
import { Button, Input } from '@re-shell/ui';
import { Shield, Users, ScrollText, Building2 } from 'lucide-react';
import { AdministrationClient, type AuditPage, type Member, type Role, type TeamPolicy } from '../collab/admin-client';
import { ConnectionPanel } from '../collab/components/ConnectionPanel';
import { Field, InlineError, Panel, formatTime } from '../collab/components/shared';
import { ControlPlaneProvider, useControlPlane } from '../collab/useControlPlane';

const controlClass = 'w-full rounded-md border border-border bg-bg-0 p-2 text-sm text-foreground';
function describe(error: unknown): string {
  if (error instanceof ControlPlaneError) return `${error.message} (${error.code})`;
  return error instanceof Error ? error.message : String(error);
}
function commandIds(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((id) => id.trim()).filter(Boolean))];
}

export function AdministrationScreen({ fetchImpl }: { fetchImpl?: typeof fetch } = {}): React.ReactElement {
  return <ControlPlaneProvider fetchImpl={fetchImpl} allowTenantlessPlatformAdmin><AdministrationContent /></ControlPlaneProvider>;
}

function AdministrationContent(): React.ReactElement {
  const cp = useControlPlane();
  return <div className="screen-enter grid gap-4" data-testid="admin-screen">
    <ConnectionPanel settings={cp.settings} status={cp.status} error={cp.error} warning={cp.warning}
      identity={cp.identity} tenantId={cp.tenantId} role={cp.role} onChange={cp.updateSettings}
      onConnect={() => void cp.connect()} onDisconnect={cp.disconnect} onForgetToken={cp.forgetToken} />
    {cp.status === 'connected' && cp.client ? <ConnectedAdministration client={cp.client} tenantId={cp.tenantId}
      role={cp.role} platformAdmin={cp.identity?.platformAdmin === true} onReconnect={cp.connect} /> : null}
  </div>;
}

/** Keyed by the authenticated connection, and unmounted during reconnect/disconnect. */
function ConnectedAdministration({ client, tenantId, role, platformAdmin, onReconnect }: {
  client: ControlPlaneClient; tenantId: string | null; role: string | null; platformAdmin: boolean;
  onReconnect: () => Promise<void>;
}): React.ReactElement {
  const api = React.useMemo(() => new AdministrationClient(client), [client]);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [tenantName, setTenantName] = React.useState('');
  const [newTenantId, setNewTenantId] = React.useState('');
  const run = async (action: () => Promise<void>, success: string): Promise<void> => {
    if (busy) return;
    setBusy(true); setActionError(null); setMessage('');
    try { await action(); if (alive.current) setMessage(success); }
    catch (error) { if (alive.current) setActionError(describe(error)); }
    finally { if (alive.current) setBusy(false); }
  };
  return <>
    {platformAdmin ? <Panel icon={<Building2 className="size-4" />} title="Create tenant"
      description="Platform administrator access. You become the new tenant's first admin.">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void run(async () => {
        await api.createTenant({ id: newTenantId.trim(), name: tenantName.trim(), allowedCommandIds: [] });
        setNewTenantId(''); setTenantName('');

      }, 'Tenant created. Enter its tenant ID above and reconnect to administer it.'); }}>
        <Field id="admin-tenant-id" label="New tenant ID"><Input id="admin-tenant-id" required disabled={busy} value={newTenantId} onChange={(e) => setNewTenantId(e.target.value)} /></Field>
        <Field id="admin-tenant-name" label="Tenant name"><Input id="admin-tenant-name" required disabled={busy} value={tenantName} onChange={(e) => setTenantName(e.target.value)} /></Field>
        <p className="text-xs text-muted-foreground sm:col-span-2">New tenants start with no permitted commands. Configure the policy after creation.</p>
        <Button type="submit" disabled={busy || !newTenantId.trim() || !tenantName.trim()}>Create tenant</Button>
      </form>
    </Panel> : null}
    {actionError ? <InlineError message={actionError} /> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    {tenantId ? <TenantAdministration key={tenantId} api={api} tenantId={tenantId} admin={role === 'admin'} onReconnect={onReconnect} />
      : <p className="text-sm text-muted-foreground">Create your first tenant to manage its members and policy.</p>}
  </>;
}

function TenantAdministration({ api, tenantId, admin, onReconnect }: {
  api: AdministrationClient; tenantId: string; admin: boolean; onReconnect: () => Promise<void>;
}): React.ReactElement {
  const [policy, setPolicy] = React.useState<TeamPolicy | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [audit, setAudit] = React.useState<AuditPage | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState('');
  const [commands, setCommands] = React.useState('');
  const [pack, setPack] = React.useState('');
  const [memberId, setMemberId] = React.useState('');
  const [memberRole, setMemberRole] = React.useState<Role>('viewer');
  const [removeId, setRemoveId] = React.useState<string | null>(null);
  const generation = React.useRef(0);
  const alive = React.useRef(true);
  const load = React.useCallback(async (): Promise<void> => {
    const mine = ++generation.current;
    setLoading(true); setErrors({}); setPolicy(null); setMembers([]); setAudit(null);
    const capture = async (kind: string, action: () => Promise<void>): Promise<void> => {
      try { await action(); } catch (error) {
        if (alive.current && generation.current === mine) setErrors((old) => ({ ...old, [kind]: describe(error) }));
      }
    };
    const current = (): boolean => alive.current && generation.current === mine;
    await Promise.all([
      capture('policy', async () => { const next = await api.policy(tenantId); if (current()) {
        setPolicy(next); setCommands(next.allowedCommandIds.join('\n')); setPack(next.policyPack ?? '');
      } }),
      ...(admin ? [
        capture('members', async () => { const next = await api.members(tenantId); if (current()) setMembers(next); }),
        capture('audit', async () => { const next = await api.audit(tenantId); if (current()) setAudit(next); }),
      ] : []),
    ]);
    if (current()) setLoading(false);
  }, [api, tenantId, admin]);
  React.useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; generation.current++; }; }, [load]);
  const run = async (action: () => Promise<void>, success: string, reconnect = false): Promise<void> => {
    if (busy) return;
    setBusy(true); setActionError(null); setMessage('');
    try {
      await action();
      if (!alive.current) return;
      if (reconnect) await onReconnect();
      else { await load(); if (alive.current) setMessage(success); }
    } catch (error) { if (alive.current) setActionError(describe(error)); }
    finally { if (alive.current) setBusy(false); }
  };
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm">Tenant <span className="font-mono">{tenantId}</span> · {admin ? 'administrator' : 'read-only policy access'}</p>
      <Button variant="outline" disabled={busy || loading} onClick={() => void load()}>Refresh administration</Button>
    </div>
    {loading ? <p role="status">Loading administration…</p> : null}
    {actionError ? <InlineError message={actionError} /> : null}
    {message ? <p role="status">{message}</p> : null}
    <Panel icon={<Shield className="size-4" />} title="Team policy" description="The tenant command ceiling limits every workspace grant.">
      {errors.policy ? <InlineError message={errors.policy} /> : null}
      {policy ? <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void run(() => api.updatePolicy(tenantId,
        { allowedCommandIds: commandIds(commands), policyPack: pack.trim() || null }), 'Team policy saved.'); }}>
        <p className="text-xs text-muted-foreground">Policy version {policy.policyVersion}</p>
        <Field id="admin-commands" label="Allowed command IDs" hint="One ID per line, or comma-separated. Empty denies all commands.">
          <textarea id="admin-commands" className={controlClass} rows={4} value={commands} readOnly={!admin} disabled={busy || loading} onChange={(e) => setCommands(e.target.value)} />
        </Field>
        <Field id="admin-pack" label="Policy pack reference" hint="Empty clears the reference.">
          <Input id="admin-pack" value={pack} readOnly={!admin} disabled={busy || loading} onChange={(e) => setPack(e.target.value)} />
        </Field>
        {policy.workspaces.length ? <ul className="grid gap-1 text-sm">{policy.workspaces.map((workspace) => <li key={workspace.id}>
          <span className="font-mono">{workspace.id}</span>: {workspace.effectiveCommandIds.join(', ') || 'no effective commands'}
        </li>)}</ul> : <p className="text-sm text-muted-foreground">No workspace grants.</p>}
        {admin ? <Button className="justify-self-start" disabled={busy || loading} type="submit">Save policy</Button> : null}
      </form> : null}
    </Panel>
    {admin ? <>
      <Panel icon={<Users className="size-4" />} title="Members" description="Admins manage access. The server protects the tenant's last admin.">
        {errors.members ? <InlineError message={errors.members} /> : null}
        <ul className="mb-4 grid gap-3">{members.map((member) => <li key={member.userId} className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
          <span className="min-w-0 break-all font-mono text-sm">{member.userId}</span><span className="text-sm text-muted-foreground">{member.role}</span>
          <Button size="sm" variant="outline" disabled={busy || loading} onClick={() => { setMemberId(member.userId); setMemberRole(member.role); }}>Edit {member.userId}</Button>
          {removeId === member.userId ? <>
            <Button size="sm" disabled={busy || loading} onClick={() => void run(async () => { await api.removeMember(tenantId, member.userId); setRemoveId(null); }, 'Member removed.', true)}>Confirm removal of {member.userId}</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRemoveId(null)}>Keep member</Button>
          </> : <Button size="sm" variant="ghost" disabled={busy || loading} onClick={() => setRemoveId(member.userId)}>Remove {member.userId}</Button>}
        </li>)}</ul>
        {!loading && !errors.members && members.length === 0 ? <p className="mb-4 text-sm text-muted-foreground">No members returned.</p> : null}
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void run(async () => {
          await api.setMember(tenantId, memberId.trim(), memberRole); setMemberId('');
        }, 'Member saved.', true); }}>
          <Field id="admin-member-id" label="Member user ID"><Input id="admin-member-id" required value={memberId} disabled={busy || loading} onChange={(e) => setMemberId(e.target.value)} /></Field>
          <Field id="admin-member-role" label="Role"><select id="admin-member-role" className={controlClass} value={memberRole} disabled={busy || loading} onChange={(e) => setMemberRole(e.target.value as Role)}>
            <option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Admin</option>
          </select></Field>
          <Button type="submit" disabled={busy || loading || !memberId.trim()}>Save member</Button>
        </form>
      </Panel>
      <Panel icon={<ScrollText className="size-4" />} title="Audit history" description="Read-only authorization decisions, newest first.">
        {errors.audit ? <InlineError message={errors.audit} /> : null}
        {audit ? <>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Time', 'User', 'Action', 'Decision'].map((title) => <th key={title} className="p-2">{title}</th>)}</tr></thead>
            <tbody>{audit.entries.map((entry) => <tr key={entry.id} className="border-t border-border">
              <td className="whitespace-nowrap p-2">{formatTime(entry.ts)}</td><td className="p-2">{entry.userId ?? 'unauthenticated'}</td><td className="p-2">{entry.action}</td><td className="p-2">{entry.decision}{entry.code ? ` · ${entry.code}` : ''}</td>
            </tr>)}</tbody></table></div>
          {!audit.entries.length ? <p className="text-sm text-muted-foreground">No audit entries.</p> : null}
          {audit.nextBeforeId !== null ? <Button variant="outline" disabled={busy || loading} onClick={() => {
            const cursor = audit.nextBeforeId!;
            setBusy(true); setActionError(null);
            void api.audit(tenantId, cursor).then((page) => { if (alive.current) setAudit((old) => old ? { entries: [...old.entries, ...page.entries], nextBeforeId: page.nextBeforeId } : page); })
              .catch((error) => { if (alive.current) setActionError(describe(error)); }).finally(() => { if (alive.current) setBusy(false); });
          }}>Load older audit entries</Button> : null}
        </> : null}
      </Panel>
    </> : <p className="text-sm text-muted-foreground">Tenant admin access is required to manage members and read audit history.</p>}
  </>;
}
