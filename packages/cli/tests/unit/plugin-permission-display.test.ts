import { describe, expect, it } from 'vitest';
import { extractPermissionsForDisplay, hasDangerousCombos } from '../../src/utils/plugin-marketplace';

describe('extractPermissionsForDisplay', () => {
  it('should return empty array when no permissions', () => {
    expect(extractPermissionsForDisplay(undefined)).toEqual([]);
  });

  it('should return empty array when reshell exists but no permissions key', () => {
    expect(extractPermissionsForDisplay({ reshell: {} })).toEqual([]);
  });

  it('should map permissions with severity', () => {
    const result = extractPermissionsForDisplay({
      reshell: {
        permissions: [
          { type: 'filesystem', access: 'read', description: 'Read files' },
          { type: 'process', access: 'execute', description: 'Run commands' },
        ],
      },
    });
    expect(result.length).toBe(2);
    expect(result[0].severity).toBe('info');
    expect(result[1].severity).toBe('danger');
  });

  it('should mark filesystem:write as warn', () => {
    const result = extractPermissionsForDisplay({
      reshell: {
        permissions: [
          { type: 'filesystem', access: 'write', resource: '/tmp', description: 'Write temp' },
        ],
      },
    });
    expect(result[0].severity).toBe('warn');
  });

  it('should mark filesystem:full as danger', () => {
    const result = extractPermissionsForDisplay({
      reshell: {
        permissions: [
          { type: 'filesystem', access: 'full', description: 'Full fs' },
        ],
      },
    });
    expect(result[0].severity).toBe('danger');
  });

  it('should preserve resource field', () => {
    const result = extractPermissionsForDisplay({
      reshell: {
        permissions: [
          { type: 'filesystem', access: 'write', resource: '/data', description: 'd' },
        ],
      },
    });
    expect(result[0].resource).toBe('/data');
  });
});

describe('hasDangerousCombos', () => {
  it('should detect filesystem + process + network combo', () => {
    const perms = extractPermissionsForDisplay({
      reshell: {
        permissions: [
          { type: 'filesystem', access: 'full', description: 'a' },
          { type: 'process', access: 'execute', description: 'b' },
          { type: 'network', access: 'full', description: 'c' },
        ],
      },
    });
    expect(hasDangerousCombos(perms)).toBe(true);
  });

  it('should return false for safe permissions', () => {
    const perms = extractPermissionsForDisplay({
      reshell: {
        permissions: [
          { type: 'filesystem', access: 'read', description: 'a' },
        ],
      },
    });
    expect(hasDangerousCombos(perms)).toBe(false);
  });
});
