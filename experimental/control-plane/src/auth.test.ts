import { describe, expect, it } from 'vitest';

import {
  InMemorySessionResolver,
  Session,
  authenticate,
  roleInTenant,
  roleSatisfies,
} from './auth.js';

const PRINCIPAL = {
  userId: 'user-1',
  tenantRoles: { 'tenant-a': 'operator' as const },
};

function resolver(expiresAt = Date.now() + 60_000): InMemorySessionResolver {
  const session: Session = { token: 'tok-good', principal: PRINCIPAL, expiresAt };
  return new InMemorySessionResolver([session]);
}

describe('authenticate', () => {
  it('rejects a missing token', () => {
    const r = authenticate(resolver(), undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects a blank token', () => {
    const r = authenticate(resolver(), '   ');
    expect(r.ok).toBe(false);
  });

  it('rejects an unknown token', () => {
    const r = authenticate(resolver(), 'tok-unknown');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects an expired session', () => {
    const r = authenticate(resolver(1_000), 'tok-good', 2_000);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.message).toMatch(/expired/i);
    }
  });

  it('accepts a valid, unexpired token', () => {
    const r = authenticate(resolver(), 'tok-good', Date.now());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.userId).toBe('user-1');
    }
  });

  it('rejects a malformed principal at resolver construction', () => {
    expect(
      () =>
        new InMemorySessionResolver([
          { token: 't', principal: { userId: '' } as never, expiresAt: 1 },
        ])
    ).toThrow();
  });
});

describe('role helpers', () => {
  it('returns the role held in a tenant or undefined', () => {
    expect(roleInTenant(PRINCIPAL, 'tenant-a')).toBe('operator');
    expect(roleInTenant(PRINCIPAL, 'tenant-z')).toBeUndefined();
  });

  it('enforces the role hierarchy', () => {
    expect(roleSatisfies('admin', 'operator')).toBe(true);
    expect(roleSatisfies('operator', 'operator')).toBe(true);
    expect(roleSatisfies('viewer', 'operator')).toBe(false);
    expect(roleSatisfies('viewer', 'viewer')).toBe(true);
  });
});
