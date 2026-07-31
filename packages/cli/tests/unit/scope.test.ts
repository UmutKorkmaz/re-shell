import { describe, it, expect } from 'vitest';
import { GENERATED_PKG_SCOPE, RECOGNIZED_PKG_SCOPES } from '../../src/utils/scope';

describe('scope constants', () => {
  it('exposes the generated-package scope', () => {
    expect(GENERATED_PKG_SCOPE).toBe('@re-shell');
    // Composes scoped names as documented in the JSDoc example.
    expect(`${GENERATED_PKG_SCOPE}/core`).toBe('@re-shell/core');
  });

  it('lists the recognized scope prefixes as a readonly tuple', () => {
    expect(RECOGNIZED_PKG_SCOPES).toEqual(['@re-shell/']);
    expect(RECOGNIZED_PKG_SCOPES).toHaveLength(1);
  });

  describe('documented detection pattern — RECOGNIZED_PKG_SCOPES.some(prefix => name.startsWith(prefix))', () => {
    const isRecognized = (name: string) => RECOGNIZED_PKG_SCOPES.some((p) => name.startsWith(p));

    it('recognizes generated @re-shell/* packages', () => {
      expect(isRecognized('@re-shell/core')).toBe(true);
      expect(isRecognized('@re-shell/cli')).toBe(true);
      expect(isRecognized('@re-shell/very-deep-name')).toBe(true);
    });

    it('rejects unscoped or foreign-scoped packages', () => {
      expect(isRecognized('lodash')).toBe(false);
      expect(isRecognized('@other/core')).toBe(false);
      expect(isRecognized('re-shell')).toBe(false);
    });

    it('requires the trailing slash (bare scope is not a match)', () => {
      // '@re-shell' lacks the trailing slash listed in the prefix.
      expect(isRecognized('@re-shell')).toBe(false);
      expect(isRecognized('@re-shellish')).toBe(false);
    });
  });
});
