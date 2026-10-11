import { describe, expect, it } from 'vitest';
import { startHarness, STANDARD_SEED } from '../test-support/harness.js';

describe('HTTP telemetry', () => {
  it('restricts metrics to platform admins and uses route labels without tenant identifiers', async () => {
    const h = await startHarness({ seed: STANDARD_SEED, platformAdmins: ['root'] });
    try {
      expect((await h.request('GET', '/me', { token: h.userToken('root') })).json.data.platformAdmin).toBe(true);
      expect((await h.request('GET', '/me', { token: h.userToken('alice') })).json.data.platformAdmin).toBe(false);
      expect((await h.request('GET', '/metrics')).status).toBe(401);
      expect((await h.request('GET', '/metrics', { token: h.userToken('alice') })).status).toBe(403);
      const first = await h.request('GET', '/tenants/acme/workspaces', { token: h.userToken('alice') });
      expect(first.headers.get('x-request-id')).toMatch(/^[a-f0-9-]{36}$/);
      const response = await fetch(`${h.url}/metrics`, { headers: { Authorization: `Bearer ${h.userToken('root')}` } });
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain('re_shell_http_requests_total');
      expect(text).toContain('route="/tenants/:tenantId/workspaces"');
      expect(text).not.toContain('acme');
      expect(text).not.toContain(h.userToken('root'));
      expect(text).toContain('re_shell_http_request_duration_seconds_sum');
    } finally { await h.close(); }
  });
});
