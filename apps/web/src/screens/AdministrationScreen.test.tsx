import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdministrationScreen } from './AdministrationScreen';

function server(role = 'admin', platformAdmin?: boolean, noTenants = false) {
  const requests: { method: string; path: string; body: unknown; authorization: string | null }[] = [];
  let members = [{ tenantId: 'acme', userId: 'alice', role: 'admin' }];
  let policy = { tenantId: 'acme', policyVersion: 1, policyPack: null as string | null, allowedCommandIds: ['doctor'], workspaces: [] };
  let denyMutation = false;
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(url)); const path = u.pathname; const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ method, path: `${path}${u.search}`, body, authorization: new Headers(init?.headers).get('Authorization') });
    const reply = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { status: 200 });
    if (path === '/me') return reply({ userId: 'alice', ...(platformAdmin !== undefined ? { platformAdmin } : {}), tenants: noTenants ? [] : [{ tenantId: 'acme', role }] });
    if (denyMutation && method !== 'GET') return new Response(JSON.stringify({ ok: false, error: { code: 'CONFLICT', message: 'A tenant must keep at least one admin.' } }), { status: 409 });
    if (path === '/tenants' && method === 'POST') return reply({ tenant: { id: body.id }, admin: { userId: 'alice' } });
    if (path === '/tenants/acme/policy') {
      if (method === 'PUT') policy = { ...policy, ...body, policyVersion: policy.policyVersion + 1 };
      return reply({ policy });
    }
    if (path === '/tenants/acme/members') return reply({ tenantId: 'acme', members });
    if (path.startsWith('/tenants/acme/members/')) {
      const userId = decodeURIComponent(path.split('/').pop()!);
      members = members.filter((member) => member.userId !== userId);
      if (method === 'PUT') { members.push({ tenantId: 'acme', userId, role: body.role }); if (userId === 'alice') role = body.role; }
      return reply({});
    }
    if (path === '/tenants/acme/audit') return reply({ entries: [{ id: u.searchParams.has('beforeId') ? 49 : 50, ts: 1700000000000, userId: 'alice', action: u.searchParams.has('beforeId') ? 'policy.update' : 'members.list', decision: 'allow', code: null }], nextBeforeId: u.searchParams.has('beforeId') ? null : 50 });
    throw new Error(`Unexpected request ${method} ${path}`);
  }) as typeof fetch;
  return { fetchImpl, requests, deny: () => { denyMutation = true; } };
}
function connect() {
  fireEvent.change(screen.getByLabelText('Control plane URL'), { target: { value: 'http://127.0.0.1:8787' } });
  fireEvent.change(screen.getByLabelText('Bearer token'), { target: { value: 'test-session-token' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('AdministrationScreen authenticated API behavior', () => {
  it('loads policy for viewers and never requests restricted members or audit data', async () => {
    const cp = server('viewer'); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    expect(await screen.findByDisplayValue('doctor')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save policy' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Members' })).toBeNull();
    expect(cp.requests.map((r) => r.path)).toEqual(['/me', '/tenants/acme/policy']);
    expect(cp.requests.every((r) => r.authorization === 'Bearer test-session-token')).toBe(true);
  });
  it('loads admin models, saves validated command lists and clears the pack, then refreshes', async () => {
    const cp = server(); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    await screen.findByDisplayValue('doctor');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save policy' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Allowed command IDs'), { target: { value: 'doctor, workspace.summary\ndoctor\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }));
    expect(await screen.findByText('Team policy saved.')).toBeInTheDocument();
    expect(cp.requests.find((r) => r.method === 'PUT')?.body).toEqual({ allowedCommandIds: ['doctor', 'workspace.summary'], policyPack: null });
    expect(screen.getByText('Policy version 2')).toBeInTheDocument();
  });
  it('adds members through encoded URLs and refreshes current identity after mutations', async () => {
    const cp = server(); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    await screen.findByRole('button', { name: 'Edit alice' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit alice' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Member user ID'), { target: { value: 'oidc:https://id.example#bob' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'operator' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
    expect(await screen.findByRole('button', { name: 'Edit oidc:https://id.example#bob' })).toBeInTheDocument();
    const mutation = cp.requests.find((r) => r.method === 'PUT');
    expect(mutation?.path).toBe('/tenants/acme/members/oidc%3Ahttps%3A%2F%2Fid.example%23bob');
    expect(mutation?.body).toEqual({ role: 'operator' });
    expect(cp.requests.filter((r) => r.path === '/me')).toHaveLength(2);
  });
  it('requires explicit removal confirmation and exposes last-admin refusals', async () => {
    const cp = server(); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    await screen.findByRole('button', { name: 'Remove alice' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove alice' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Remove alice' }));
    expect(cp.requests.some((r) => r.method === 'DELETE')).toBe(false);
    cp.deny(); fireEvent.click(screen.getByRole('button', { name: 'Confirm removal of alice' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A tenant must keep at least one admin. (CONFLICT)');
    expect(screen.getByRole('button', { name: 'Edit alice' })).toBeInTheDocument();
  });
  it('pages audit history using the returned cursor and resets it on refresh', async () => {
    const cp = server(); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    await screen.findByText('members.list');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load older audit entries' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Load older audit entries' }));
    expect(await screen.findByText('policy.update')).toBeInTheDocument();
    expect(cp.requests.some((r) => r.path.endsWith('audit?limit=50&beforeId=50'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Load older audit entries' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh administration' }));
    await screen.findByRole('button', { name: 'Load older audit entries' });
    expect(screen.queryByText('policy.update')).toBeNull();
  });
  it('connects platform admins without a tenant and creates a tenant with no permitted commands', async () => {
    const cp = server('admin', true, true); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    const form = await screen.findByRole('region', { name: 'Create tenant' });
    fireEvent.change(within(form).getByLabelText('New tenant ID'), { target: { value: 'new-team' } });
    fireEvent.change(within(form).getByLabelText('Tenant name'), { target: { value: 'New team' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Create tenant' }));
    expect(await screen.findByText(/Tenant created\. Enter its tenant ID/)).toBeInTheDocument();
    expect(cp.requests.find((r) => r.method === 'POST')?.body).toEqual({ id: 'new-team', name: 'New team', allowedCommandIds: [] });
    expect(cp.requests.some((r) => r.path.includes('/policy'))).toBe(false);
  });
  it('does not grant platform access when older /me responses omit the capability', async () => {
    const cp = server(); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    await screen.findByDisplayValue('doctor');
    expect(screen.queryByRole('region', { name: 'Create tenant' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(screen.queryByRole('region', { name: 'Team policy' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Members' })).toBeNull();
  });
  it('drops admin controls immediately after self-demotion by re-reading /me', async () => {
    const cp = server(); render(<AdministrationScreen fetchImpl={cp.fetchImpl} />); connect();
    await screen.findByRole('button', { name: 'Edit alice' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit alice' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Edit alice' }));
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'viewer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save member' }));
    await screen.findByText(/read-only policy access/);
    expect(screen.queryByRole('region', { name: 'Members' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Audit history' })).toBeNull();
    expect(screen.getByLabelText('Allowed command IDs')).toHaveAttribute('readonly');
  });
  it('shows read failures and supports refreshing without hiding successful sections', async () => {
    const cp = server(); let failPolicy = true;
    const failingFetch = (async (...args: Parameters<typeof fetch>) => {
      if (String(args[0]).endsWith('/policy') && failPolicy) {
        return new Response(JSON.stringify({ ok: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Policy unavailable' } }), { status: 503 });
      }
      return cp.fetchImpl(...args);
    }) as typeof fetch;
    render(<AdministrationScreen fetchImpl={failingFetch} />); connect();
    expect(await screen.findByRole('alert')).toHaveTextContent('Policy unavailable');
    expect(await screen.findByText('members.list')).toBeInTheDocument();
    failPolicy = false;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh administration' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh administration' }));
    await screen.findByDisplayValue('doctor');
    expect(screen.queryByRole('alert')).toBeNull();
  });

});
