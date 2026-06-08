import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  applyTheme,
  getSafetyMode,
  isDestructiveGateEnabled,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings-store';

const STORAGE_KEY = 're-shell.dashboard.settings.v1';

describe('settings-store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns safe defaults when nothing is persisted', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('persists and reloads a valid settings value across "reload"', () => {
    const next: Settings = {
      ...DEFAULT_SETTINGS,
      workspacePath: '/tmp/ws',
      daemonPort: 4444,
      theme: 'dark',
      safetyMode: false,
    };
    saveSettings(next);

    // Simulate a fresh page load by reading from storage again.
    expect(loadSettings()).toEqual(next);
  });

  it('falls back to defaults when stored JSON is corrupt', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('fills missing keys from defaults and drops unknown keys', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ theme: 'dark', bogus: 'x' })
    );
    const loaded = loadSettings();
    expect(loaded.theme).toBe('dark');
    expect(loaded.daemonPort).toBe(DEFAULT_SETTINGS.daemonPort);
    expect(loaded).not.toHaveProperty('bogus');
  });

  it('rejects an out-of-range port (falls back to defaults on load)', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, daemonPort: 70_000 })
    );
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('exposes the safety-mode gate read by the Command Builder', () => {
    saveSettings({ ...DEFAULT_SETTINGS, safetyMode: true });
    expect(getSafetyMode()).toBe(true);
    expect(isDestructiveGateEnabled()).toBe(true);

    saveSettings({ ...DEFAULT_SETTINGS, safetyMode: false });
    expect(getSafetyMode()).toBe(false);
    expect(isDestructiveGateEnabled()).toBe(false);
  });

  it('applyTheme toggles the dark class and color-scheme on the root', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});
