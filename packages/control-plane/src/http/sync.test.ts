import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EventTap } from '../test-support/event-tap.js';
import { STANDARD_SEED, startHarness, type Harness } from '../test-support/harness.js';

let h: Harness;
const taps: EventTap[] = [];

beforeEach(async () => {
  h = await startHarness({ seed: STANDARD_SEED });
});
afterEach(async () => {
  for (const tap of taps.splice(0)) {
    tap.close();
  }
  await h.close();
});

async function tap(token: string, tenant = 'acme'): Promise<EventTap> {
  const t = await EventTap.open(`${h.url}/tenants/${tenant}/events`, token);
  taps.push(t);
  return t;
}

const submit = (token: string, commandId: string, workspace = 'main') =>
  h.request('POST', `/tenants/acme/workspaces/${workspace}/commands`, { token, body: { commandId } });

describe('multi-user shared workspace', () => {
  it('two users in one tenant both see the shared workspace', async () => {
    const [a, b] = await Promise.all([
      h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('bob') }),
      h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') }),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.json.data.workspaces).toEqual(b.json.data.workspaces);
    expect(a.json.data.workspaces.map((w: { id: string }) => w.id)).toEqual(['main']);
  });

  it('a workspace created by an admin appears for the other user, live', async () => {
    const vera = await tap(h.userToken('vera'));
    await vera.waitForEvent('snapshot');
    const created = await h.request('POST', '/tenants/acme/workspaces', {
      token: h.userToken('alice'),
      body: { id: 'docs', name: 'Docs' },
    });
    expect(created.status).toBe(201);
    await vera.waitForEvent('workspace.created');
    expect(vera.json('workspace.created')[0]).toMatchObject({
      tenantId: 'acme',
      workspace: { id: 'docs', name: 'Docs' },
      createdBy: 'alice',
    });
    const list = await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') });
    expect(list.json.data.workspaces.map((w: { id: string }) => w.id)).toEqual(['main', 'docs']);
  });
});

describe('team policy sync', () => {
  it('propagates a policy update to both users and a worker, and enforces it immediately', async () => {
    const alice = h.userToken('alice');
    const bob = h.userToken('bob');
    const workerTok = h.workerToken('w1', 'acme');

    // Two principals and one worker are connected before the change.
    const aliceTap = await tap(alice);
    const bobTap = await tap(bob);
    const workerTap = await tap(workerTok);
    for (const t of [aliceTap, bobTap, workerTap]) {
      await t.waitForEvent('snapshot');
      const snap = t.json('snapshot')[0];
      expect(snap.policy.policyVersion).toBe(0);
      expect(snap.policy.workspaces[0].effectiveCommandIds).toEqual(['workspace.summary', 'doctor']);
    }

    // Before the change user B may run `doctor`.
    expect((await submit(bob, 'doctor')).status).toBe(202);

    // The admin tightens the team policy and attaches a policy pack.
    const update = await h.request('PUT', '/tenants/acme/policy', {
      token: alice,
      body: { allowedCommandIds: ['workspace.summary'], policyPack: 'recommended' },
    });
    expect(update.status).toBe(200);
    expect(update.json.data.policy).toMatchObject({ policyVersion: 1, policyPack: 'recommended' });

    // User B (and A, and the worker) receive the event.
    for (const t of [aliceTap, bobTap, workerTap]) {
      await t.waitForEvent('policy.updated');
      const ev = t.json('policy.updated')[0];
      expect(ev).toMatchObject({
        tenantId: 'acme',
        change: { scope: 'tenant' },
        updatedBy: 'alice',
        policy: { policyVersion: 1, policyPack: 'recommended', allowedCommandIds: ['workspace.summary'] },
      });
      expect(ev.policy.workspaces[0].effectiveCommandIds).toEqual(['workspace.summary']);
    }

    // The previously allowed command is now refused — immediately, same token.
    const denied = await submit(bob, 'doctor');
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe('COMMAND_NOT_ALLOWED');
    // ...while a command still inside the ceiling keeps working.
    expect((await submit(bob, 'workspace.summary')).status).toBe(202);

    // The GET view agrees with the pushed event.
    const view = await h.request('GET', '/tenants/acme/policy', { token: h.userToken('vera') });
    expect(view.json.data.policy).toMatchObject({ policyVersion: 1, policyPack: 'recommended' });
  });

  it('propagates workspace grant changes as scoped events and enforces them', async () => {
    const bobTap = await tap(h.userToken('bob'));
    await bobTap.waitForEvent('snapshot');
    await h.request('PUT', '/tenants/acme/workspaces/main/grant', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['scorecard'] },
    });
    await bobTap.waitForEvent('policy.updated');
    expect(bobTap.json('policy.updated')[0]).toMatchObject({
      change: { scope: 'workspace', workspaceId: 'main' },
      policy: { policyVersion: 1 },
    });
    expect((await submit(h.userToken('bob'), 'scorecard')).status).toBe(202);
    expect((await submit(h.userToken('bob'), 'doctor')).json.error.code).toBe('COMMAND_NOT_ALLOWED');
  });

  it('a permissive workspace grant can never exceed the tenant ceiling', async () => {
    await h.request('PUT', '/tenants/acme/policy', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['workspace.summary'] },
    });
    // Grant a command the ceiling does not contain.
    await h.request('PUT', '/tenants/acme/workspaces/main/grant', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['workspace.summary', 'scorecard'] },
    });
    const view = await h.request('GET', '/tenants/acme/policy', { token: h.userToken('alice') });
    expect(view.json.data.policy.workspaces[0]).toMatchObject({
      allowedCommandIds: ['workspace.summary', 'scorecard'],
      effectiveCommandIds: ['workspace.summary'],
    });
    expect((await submit(h.userToken('bob'), 'scorecard')).json.error.code).toBe('COMMAND_NOT_ALLOWED');
  });

  it('never leaks events across tenants', async () => {
    const aliceTap = await tap(h.userToken('alice'), 'acme');
    const ginaTap = await tap(h.userToken('gina'), 'globex');
    await aliceTap.waitForEvent('snapshot');
    await ginaTap.waitForEvent('snapshot');
    expect(ginaTap.json('snapshot')[0].policy.tenantId).toBe('globex');

    await h.request('PUT', '/tenants/acme/policy', { token: h.userToken('alice'), body: { allowedCommandIds: [] } });
    await aliceTap.waitForEvent('policy.updated');
    await new Promise((r) => setTimeout(r, 150));
    expect(ginaTap.of('policy.updated')).toHaveLength(0);

    // Cross-tenant subscription is refused, for users and for workers, for real and absent tenants alike.
    expect((await EventTap.refused(`${h.url}/tenants/acme/events`, h.userToken('gina'))).status).toBe(403);
    expect((await EventTap.refused(`${h.url}/tenants/nope/events`, h.userToken('gina'))).status).toBe(403);
    expect((await EventTap.refused(`${h.url}/tenants/acme/events`, h.workerToken('w', 'globex'))).status).toBe(403);
    expect((await EventTap.refused(`${h.url}/tenants/acme/events`, 'garbage')).status).toBe(401);
  });

  it('ends a user stream when their membership is removed', async () => {
    const bobTap = await tap(h.userToken('bob'));
    await bobTap.waitForEvent('snapshot');
    await h.request('DELETE', '/tenants/acme/members/bob', { token: h.userToken('alice') });
    await bobTap.waitForEvent('revoked');
    await bobTap.waitForEnd();
    expect((await EventTap.refused(`${h.url}/tenants/acme/events`, h.userToken('bob'))).status).toBe(403);
  });

  it('ends a stream when its token expires', async () => {
    const short = await tap(h.userToken('vera', 1));
    await short.waitForEvent('snapshot');
    await short.waitForEvent('expired', 1, 4000);
    await short.waitForEnd();
  });

  it('caps concurrent streams per principal', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, limits: { maxStreamsPerPrincipal: 2 } });
    const token = h.userToken('vera');
    await tap(token);
    await tap(token);
    const third = await EventTap.refused(`${h.url}/tenants/acme/events`, token);
    expect(third.status).toBe(429);
  });

  it('a reconnecting client gets the current policy in a fresh snapshot (no missed update)', async () => {
    const first = await tap(h.userToken('vera'));
    await first.waitForEvent('snapshot');
    first.close();
    await h.request('PUT', '/tenants/acme/policy', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['doctor'], policyPack: 'baseline' },
    });
    const second = await tap(h.userToken('vera'));
    await second.waitForEvent('snapshot');
    expect(second.json('snapshot')[0].policy).toMatchObject({
      policyVersion: 1,
      policyPack: 'baseline',
      allowedCommandIds: ['doctor'],
    });
  });
});
