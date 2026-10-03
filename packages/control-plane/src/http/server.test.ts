import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HTTP_STATUS_BY_CODE, controlPlaneErrorCodeSchema } from '../errors.js';
import { STANDARD_SEED, startHarness, type Harness } from '../test-support/harness.js';

let h: Harness;

beforeEach(async () => {
  h = await startHarness({ seed: STANDARD_SEED, platformAdmins: ['root'] });
});
afterEach(async () => {
  await h.close();
});

describe('edge basics', () => {
  it('serves /healthz unauthenticated and reports DB failure as 503', async () => {
    const ok = await h.request('GET', '/healthz');
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ ok: true, data: { status: 'ok' }, warnings: [] });

    h.db.close();
    const down = await h.request('GET', '/healthz');
    expect(down.status).toBe(503);
    expect(down.json).toMatchObject({ ok: false, error: { code: 'SERVICE_UNAVAILABLE' } });
  });

  it('answers unknown routes with a 404 envelope and wrong methods with 405 + Allow', async () => {
    const nf = await h.request('GET', '/nope', { token: h.userToken('alice') });
    expect(nf.status).toBe(404);
    expect(nf.json).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });

    const bad = await h.request('PATCH', '/tenants/acme/workspaces', { token: h.userToken('alice') });
    expect(bad.status).toBe(405);
    expect(bad.json.error.code).toBe('METHOD_NOT_ALLOWED');
    expect(bad.headers.get('allow')).toBe('GET, POST');
  });

  it('sets security headers on success and error responses alike', async () => {
    for (const res of [
      await h.request('GET', '/healthz'),
      await h.request('GET', '/tenants/acme/workspaces'), // 401
      await h.request('GET', '/nope'), // 404
    ]) {
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(res.headers.get('content-type')).toContain('application/json');
      // No wildcard CORS, ever.
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  it('every failure status comes from HTTP_STATUS_BY_CODE', async () => {
    const samples = [
      await h.request('GET', '/tenants/acme/workspaces'),
      await h.request('GET', '/tenants/globex/workspaces', { token: h.userToken('alice') }),
      await h.request('GET', '/nope'),
      await h.request('POST', '/tenants', { token: h.userToken('alice'), body: { id: 'x', name: 'x' } }),
    ];
    for (const res of samples) {
      expect(res.json.ok).toBe(false);
      const code = controlPlaneErrorCodeSchema.parse(res.json.error.code);
      expect(res.status).toBe(HTTP_STATUS_BY_CODE[code]);
    }
  });
});

describe('authentication (no oracle)', () => {
  it('returns the identical 401 for missing, garbage, expired, wrong-kind and foreign-key tokens', async () => {
    await h.close();
    let now = 1_800_000_000_000;
    h = await startHarness({ seed: STANDARD_SEED, now: () => now });
    const short = h.userToken('alice', 5);
    const worker = h.workerToken('w1', 'acme');
    const { JwtKeyRing, generateSecret } = await import('../jwt.js');
    const { issueUserToken } = await import('../identity.js');
    const foreign = issueUserToken(
      { keyRing: new JwtKeyRing({ k1: generateSecret() }, 'k1'), now: () => now },
      { userId: 'alice' }
    ).token;
    // Sanity: the short-lived token works until it expires.
    expect((await h.request('GET', '/me', { token: short })).status).toBe(200);
    now += 6_000;

    const responses = await Promise.all(
      [undefined, 'garbage', short, worker, foreign].map((token) =>
        h.request('GET', '/tenants/acme/workspaces', { token })
      )
    );
    for (const res of responses) {
      expect(res.status).toBe(401);
      expect(res.headers.get('www-authenticate')).toBe('Bearer');
      expect(res.json).toEqual(responses[0].json);
    }
    expect(responses[0].json).toEqual({
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required.' },
      warnings: [],
    });
  });

  it('does not accept the token in the query string or a cookie', async () => {
    const token = h.userToken('alice');
    const viaQuery = await h.request('GET', `/tenants/acme/workspaces?access_token=${token}`);
    expect(viaQuery.status).toBe(401);
    const viaCookie = await h.request('GET', '/tenants/acme/workspaces', {
      headers: { Cookie: `token=${token}` },
    });
    expect(viaCookie.status).toBe(401);
  });

  it('throttles repeated failed authentication per address before it reaches the audit log', async () => {
    await h.close();
    h = await startHarness({
      seed: STANDARD_SEED,
      limits: { authFailBurst: 3, authFailPerMinute: 1 },
    });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await h.request('GET', '/me', { token: 'bad' })).status);
    }
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3).every((s) => s === 429)).toBe(true);
    const failures = h.audit.query({ tenantId: 'acme' });
    expect(failures).toHaveLength(0); // /me has no tenant; throttled attempts are not written at all
    const row = h.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'auth.failed'").get() as { n: number };
    expect(row.n).toBe(3);
  });

  it('a user token authenticates /me and lists current memberships', async () => {
    const me = await h.request('GET', '/me', { token: h.userToken('alice') });
    expect(me.status).toBe(200);
    expect(me.json.data).toEqual({ userId: 'alice', tenants: [{ tenantId: 'acme', role: 'admin' }] });
  });
});

describe('tenant isolation over HTTP', () => {
  it('lists only the caller tenant workspaces', async () => {
    const res = await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('vera') });
    expect(res.status).toBe(200);
    expect(res.json.data.workspaces.map((w: { id: string }) => w.id)).toEqual(['main']);
  });

  it('answers a non-member identically for a real tenant and an absent one (FORBIDDEN, no oracle)', async () => {
    const token = h.userToken('vera'); // member of acme only
    const real = await h.request('GET', '/tenants/globex/workspaces', { token });
    const absent = await h.request('GET', '/tenants/does-not-exist/workspaces', { token });
    expect(real.status).toBe(403);
    expect(absent.status).toBe(403);
    expect(real.json.error.code).toBe('FORBIDDEN');
    expect(absent.json.error.code).toBe('FORBIDDEN');
    expect(real.json.error.message).toBe(absent.json.error.message);
    expect(Object.keys(real.json.error.details)).toEqual(Object.keys(absent.json.error.details));
  });

  it('cannot reach another tenant workspace by guessing its id (WORKSPACE_NOT_FOUND)', async () => {
    const token = h.userToken('bob');
    const foreign = await h.request('POST', '/tenants/acme/workspaces/secret/commands', {
      token,
      body: { commandId: 'workspace.summary' },
    });
    const absent = await h.request('POST', '/tenants/acme/workspaces/no-such-ws/commands', {
      token,
      body: { commandId: 'workspace.summary' },
    });
    expect(foreign.status).toBe(404);
    expect(foreign.json.error.code).toBe('WORKSPACE_NOT_FOUND');
    expect(foreign.json.error).toEqual({
      ...absent.json.error,
      details: { ...absent.json.error.details, workspaceId: 'secret' },
    });
  });

  it('a user with no memberships is forbidden everywhere', async () => {
    const token = h.userToken('stranger');
    for (const path of ['/tenants/acme/workspaces', '/tenants/globex/policy', '/tenants/acme/jobs']) {
      const res = await h.request('GET', path, { token });
      expect(res.status).toBe(403);
    }
  });
});

describe('strict boundary validation', () => {
  const token = () => h.userToken('bob');
  const post = (body: unknown, extra: { rawBody?: string; headers?: Record<string, string> } = {}) =>
    h.request('POST', '/tenants/acme/workspaces/main/commands', {
      token: token(),
      body: extra.rawBody === undefined ? body : undefined,
      rawBody: extra.rawBody,
      headers: extra.headers,
    });

  it('rejects unknown fields, missing fields and wrong types with INVALID_REQUEST', async () => {
    expect((await post({ commandId: 'doctor', surprise: 1 })).json.error.code).toBe('INVALID_REQUEST');
    expect((await post({})).json.error.code).toBe('INVALID_REQUEST');
    expect((await post({ commandId: 7 })).json.error.code).toBe('INVALID_REQUEST');
    expect((await post({ commandId: 'doctor', params: [] })).json.error.code).toBe('INVALID_REQUEST');
    expect((await post({ commandId: '../../etc/passwd' })).status).toBe(400);
  });

  it('refuses a body that tries to override credential or path fields', async () => {
    const res = await post({ commandId: 'doctor', tenantId: 'globex', token: 'x', workspaceId: 'secret' });
    expect(res.status).toBe(400);
    expect(res.json.error.details.fields.sort()).toEqual(['tenantId', 'token', 'workspaceId']);
  });

  it('rejects params the shared command registry does not accept, before any authorization', async () => {
    const unknownCmd = await post({ commandId: 'rm-rf' });
    expect(unknownCmd.status).toBe(400);
    expect(unknownCmd.json.error.details.reason).toMatch(/Unknown commandId/);
    const badParams = await post({ commandId: 'workspace.summary', params: { type: 'all' } });
    expect(badParams.status).toBe(400);
    expect(badParams.json.error.code).toBe('INVALID_REQUEST');
  });

  it('enforces body size limits with 413', async () => {
    const big = JSON.stringify({ commandId: 'doctor', params: { cwd: 'x'.repeat(70 * 1024) } });
    const res = await post(undefined, { rawBody: big });
    expect(res.status).toBe(413);
    expect(res.json.error.code).toBe('PAYLOAD_TOO_LARGE');
    // The server is still healthy afterwards.
    expect((await h.request('GET', '/healthz')).status).toBe(200);
  });

  it('enforces the size limit on a streamed body with no Content-Length', async () => {
    const { request } = await import('node:http');
    const url = new URL(h.url);
    const status = await new Promise<number>((resolve, reject) => {
      let got: number | undefined;
      const req = request(
        {
          host: url.hostname,
          port: url.port,
          method: 'POST',
          path: '/tenants/acme/workspaces/main/commands',
          headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
        },
        (res) => {
          got = res.statusCode;
          res.resume();
        }
      );
      // The server answers 413 and closes while we are still uploading, so a
      // reset on the write side is expected; what matters is the status it sent.
      req.on('error', () => undefined);
      req.on('close', () => (got === undefined ? reject(new Error('no response received')) : resolve(got)));
      req.write('{"commandId":"doctor","params":{"cwd":"');
      const chunk = 'y'.repeat(16 * 1024);
      let written = 0;
      const pump = (): void => {
        if (req.destroyed || written > 200 * 1024) {
          req.end('"}}');
          return;
        }
        written += chunk.length;
        req.write(chunk, () => setImmediate(pump));
      };
      pump();
    });
    expect(status).toBe(413);
  });

  it('requires application/json and an object body', async () => {
    const text = await post(undefined, { rawBody: '{"commandId":"doctor"}', headers: { 'Content-Type': 'text/plain' } });
    expect(text.status).toBe(415);
    expect(text.json.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect((await post(undefined, { rawBody: '{nope' })).status).toBe(400);
    expect((await post(undefined, { rawBody: '[1,2]' })).status).toBe(400);
    expect((await post(undefined, { rawBody: 'null' })).status).toBe(400);
  });

  it('rejects unknown query parameters and malformed path ids', async () => {
    const t = h.userToken('alice');
    expect((await h.request('GET', '/tenants/acme/audit?bogus=1', { token: t })).status).toBe(400);
    expect((await h.request('GET', '/tenants/acme/audit?limit=abc', { token: t })).status).toBe(400);
    expect((await h.request('GET', '/tenants/acme/audit?limit=0', { token: t })).status).toBe(400);
    expect((await h.request('GET', '/tenants/bad%20id/workspaces', { token: t })).status).toBe(400);
    expect((await h.request('GET', '/tenants/%E0%A4%A/workspaces', { token: t })).status).toBe(404); // malformed escape
  });
});

describe('rate limiting', () => {
  it('limits per principal (429 + Retry-After) without affecting other principals', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, limits: { userBurst: 3, userPerMinute: 1 } });
    const alice = h.userToken('alice');
    const results: number[] = [];
    let retryAfter: string | null = null;
    for (let i = 0; i < 5; i += 1) {
      const res = await h.request('GET', '/me', { token: alice });
      results.push(res.status);
      if (res.status === 429) {
        retryAfter = res.headers.get('retry-after');
        expect(res.json.error.code).toBe('RATE_LIMITED');
      }
    }
    expect(results).toEqual([200, 200, 200, 429, 429]);
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
    // Another principal has its own bucket.
    expect((await h.request('GET', '/me', { token: h.userToken('bob') })).status).toBe(200);
  });

  it('limits per address across anonymous requests', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, limits: { ipBurst: 4, ipPerMinute: 1 } });
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await h.request('GET', '/healthz')).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 429, 429]);
  });

  it('does not trust X-Forwarded-For unless configured to', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, limits: { ipBurst: 2, ipPerMinute: 1 } });
    const spoof = (i: number) => h.request('GET', '/healthz', { headers: { 'X-Forwarded-For': `10.0.0.${i}` } });
    expect([(await spoof(1)).status, (await spoof(2)).status, (await spoof(3)).status]).toEqual([200, 200, 429]);
  });
});

describe('CORS', () => {
  it('allows only exact configured origins and never reflects others', async () => {
    await h.close();
    h = await startHarness({ seed: STANDARD_SEED, corsOrigins: ['https://dash.example.com'] });
    const token = h.userToken('alice');

    const allowed = await h.request('GET', '/me', { token, headers: { Origin: 'https://dash.example.com' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://dash.example.com');
    expect(allowed.headers.get('vary')).toBe('Origin');

    for (const origin of ['https://evil.example.com', 'https://dash.example.com.evil.com', 'null']) {
      const denied = await h.request('GET', '/me', { token, headers: { Origin: origin } });
      expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    }

    const preflight = await h.request('OPTIONS', '/tenants/acme/policy', {
      headers: { Origin: 'https://dash.example.com', 'Access-Control-Request-Method': 'PUT' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe('https://dash.example.com');
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization');

    const badPreflight = await h.request('OPTIONS', '/tenants/acme/policy', {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(badPreflight.status).toBe(204);
    expect(badPreflight.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('admin routes', () => {
  it('creates a tenant only for platform admins and makes the creator its admin', async () => {
    const denied = await h.request('POST', '/tenants', {
      token: h.userToken('alice'),
      body: { id: 'initech', name: 'Initech' },
    });
    expect(denied.status).toBe(403);

    const created = await h.request('POST', '/tenants', {
      token: h.userToken('root'),
      body: { id: 'initech', name: 'Initech', allowedCommandIds: ['doctor'], adminUserId: 'ivan' },
    });
    expect(created.status).toBe(201);
    expect(created.json.data.admin).toEqual({ tenantId: 'initech', userId: 'ivan', role: 'admin' });
    // ivan can now administer it; root (platform admin) is not automatically a member.
    expect((await h.request('GET', '/tenants/initech/members', { token: h.userToken('ivan') })).status).toBe(200);
    expect((await h.request('GET', '/tenants/initech/members', { token: h.userToken('root') })).status).toBe(403);

    const dup = await h.request('POST', '/tenants', {
      token: h.userToken('root'),
      body: { id: 'initech', name: 'again' },
    });
    expect(dup.status).toBe(409);
    expect(dup.json.error.code).toBe('ALREADY_EXISTS');
  });

  it('rejects policy that names commands which do not exist', async () => {
    const res = await h.request('PUT', '/tenants/acme/policy', {
      token: h.userToken('alice'),
      body: { allowedCommandIds: ['doctor', 'format-disk'] },
    });
    expect(res.status).toBe(400);
    expect(res.json.error.details.unknownCommandIds).toEqual(['format-disk']);
    expect(h.store.getTenant('acme')?.policyVersion).toBe(0);
  });

  it('requires the admin role for every admin route', async () => {
    const calls: Array<[string, string, unknown]> = [
      ['POST', '/tenants/acme/workspaces', { id: 'w2', name: 'W2' }],
      ['PUT', '/tenants/acme/workspaces/main/grant', { allowedCommandIds: ['doctor'] }],
      ['PUT', '/tenants/acme/policy', { allowedCommandIds: ['doctor'] }],
      ['GET', '/tenants/acme/members', undefined],
      ['PUT', '/tenants/acme/members/zed', { role: 'viewer' }],
      ['DELETE', '/tenants/acme/members/vera', undefined],
      ['GET', '/tenants/acme/audit', undefined],
    ];
    for (const user of ['bob', 'vera']) {
      for (const [method, path, body] of calls) {
        const res = await h.request(method, path, { token: h.userToken(user), body });
        expect(res.status, `${user} ${method} ${path}`).toBe(403);
      }
    }
    // And another tenant's admin is just as locked out.
    for (const [method, path, body] of calls) {
      const res = await h.request(method, path, { token: h.userToken('gina'), body });
      expect(res.status, `gina ${method} ${path}`).toBe(403);
    }
  });

  it('creates workspaces, sets grants, and manages members end to end', async () => {
    const alice = h.userToken('alice');
    const ws = await h.request('POST', '/tenants/acme/workspaces', {
      token: alice,
      body: { id: 'docs', name: 'Docs', allowedCommandIds: ['doctor'] },
    });
    expect(ws.status).toBe(201);
    expect((await h.request('POST', '/tenants/acme/workspaces', { token: alice, body: { id: 'docs', name: 'x' } })).status).toBe(409);

    const grant = await h.request('PUT', '/tenants/acme/workspaces/docs/grant', {
      token: alice,
      body: { allowedCommandIds: ['workspace.summary', 'scorecard'] },
    });
    expect(grant.status).toBe(200);
    expect(grant.json.data.policy.workspaces.find((w: { id: string }) => w.id === 'docs').effectiveCommandIds).toEqual(['workspace.summary', 'scorecard']);
    expect((await h.request('PUT', '/tenants/acme/workspaces/ghost/grant', { token: alice, body: { allowedCommandIds: [] } })).json.error.code).toBe('WORKSPACE_NOT_FOUND');

    // Membership: bob becomes admin, then can be demoted; the last admin is protected.
    expect((await h.request('PUT', '/tenants/acme/members/bob', { token: alice, body: { role: 'admin' } })).status).toBe(200);
    expect((await h.request('PUT', '/tenants/acme/members/alice', { token: h.userToken('bob'), body: { role: 'viewer' } })).status).toBe(200);
    const lastAdmin = await h.request('PUT', '/tenants/acme/members/bob', { token: h.userToken('bob'), body: { role: 'viewer' } });
    expect(lastAdmin.status).toBe(409);
    expect(lastAdmin.json.error.code).toBe('CONFLICT');

    const members = await h.request('GET', '/tenants/acme/members', { token: h.userToken('bob') });
    expect(members.json.data.members.map((m: { userId: string; role: string }) => `${m.userId}:${m.role}`)).toEqual([
      'alice:viewer',
      'bob:admin',
      'vera:viewer',
    ]);
    expect((await h.request('DELETE', '/tenants/acme/members/ghost', { token: h.userToken('bob') })).status).toBe(404);
    expect((await h.request('DELETE', '/tenants/acme/members/vera', { token: h.userToken('bob') })).status).toBe(200);
  });

  it('applies membership changes on the very next request (no stale token roles)', async () => {
    const vera = h.userToken('vera');
    expect((await h.request('GET', '/tenants/acme/workspaces', { token: vera })).status).toBe(200);
    expect((await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: vera, body: { commandId: 'doctor' } })).status).toBe(403);

    await h.request('PUT', '/tenants/acme/members/vera', { token: h.userToken('alice'), body: { role: 'operator' } });
    expect((await h.request('POST', '/tenants/acme/workspaces/main/commands', { token: vera, body: { commandId: 'doctor' } })).status).toBe(202);

    await h.request('DELETE', '/tenants/acme/members/vera', { token: h.userToken('alice') });
    expect((await h.request('GET', '/tenants/acme/workspaces', { token: vera })).status).toBe(403);
  });
});
