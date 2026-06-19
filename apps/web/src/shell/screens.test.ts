import { describe, it, expect } from 'vitest';
import { toScreenId, SCREENS, DEFAULT_SCREEN } from './screens';

/**
 * Tests for toScreenId — the URL→component trust boundary that narrows an
 * untrusted `?screen=` search param to a known ScreenId. Previously zero tests.
 */
describe('toScreenId', () => {
  it('round-trips every known screen id', () => {
    for (const screen of SCREENS) {
      expect(toScreenId(screen.id)).toBe(screen.id);
    }
  });

  it('falls back to DEFAULT_SCREEN for an unknown value', () => {
    expect(toScreenId('evil')).toBe(DEFAULT_SCREEN);
    expect(toScreenId('admin')).toBe(DEFAULT_SCREEN);
    expect(toScreenId('')).toBe(DEFAULT_SCREEN);
  });

  it('falls back to DEFAULT_SCREEN for null', () => {
    expect(toScreenId(null)).toBe(DEFAULT_SCREEN);
  });

  it('DEFAULT_SCREEN is a valid ScreenId in SCREENS', () => {
    expect(SCREENS.some((s) => s.id === DEFAULT_SCREEN)).toBe(true);
  });

  it('catalog is a registered screen (regression for #82)', () => {
    expect(SCREENS.some((s) => s.id === 'catalog')).toBe(true);
    expect(toScreenId('catalog')).toBe('catalog');
  });
});
