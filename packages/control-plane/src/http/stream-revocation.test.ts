import { describe, expect, it } from 'vitest';
import { JwtKeyRing, generateSecret } from '../jwt.js';
import { issueUserToken, issueWorkerToken } from '../identity.js';
import { EventTap } from '../test-support/event-tap.js';
import { startHarness, STANDARD_SEED } from '../test-support/harness.js';

describe('revoked live credentials', () => {
  it.each(['user', 'worker'] as const)('stops the %s tenant stream before sending newly published data', async (kind) => {
    const keyRing = new JwtKeyRing({ k1: generateSecret() });
    const revoked = new Set<string>();
    const h = await startHarness({ seed: STANDARD_SEED, keyRing,
      serverOptions: { identity: { keyRing, revocations: { isRevoked: (_issuer, jti) => revoked.has(jti) } } } });
    const issued = kind === 'user' ? issueUserToken({ keyRing }, { userId: 'alice' }) :
      issueWorkerToken({ keyRing }, { workerId: 'w1', tenantId: 'acme' });
    const tap = await EventTap.open(`${h.url}/tenants/acme/events`, issued.token);
    try {
      await tap.waitForEvent('snapshot');
      revoked.add(issued.jti);
      h.events.publish({ type: 'workspace.created', tenantId: 'acme', createdBy: 'alice', workspace: { id: 'secret', name: 'Secret', allowedCommandIds: [] } });
      await tap.waitForEvent('revoked');
      expect(tap.json('workspace.created')).toEqual([]);
    } finally { tap.close(); await h.close(); }
  });
});
