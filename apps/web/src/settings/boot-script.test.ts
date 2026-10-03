/**
 * The inline boot script in index.html runs BEFORE the first paint. These tests execute that real
 * script (extracted from the file) against jsdom: the default is dark, a stored light preference
 * is applied before React mounts (no dark-then-light flash), and a stored theme pack's CSS is
 * injected immediately.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from './settings-store';

const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
const bootScript = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

function runBootScript(): void {
  // Same semantics as the browser executing the inline script in the page.
  window.eval(bootScript);
}

describe('index.html boot script (no theme flash)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.querySelectorAll('#re-shell-theme-pack').forEach((el) => el.remove());
    // The static markup of index.html: dark by default.
    document.documentElement.className = 'dark';
    document.documentElement.style.colorScheme = 'dark';
  });
  afterEach(() => window.localStorage.clear());

  it('ships dark in the markup and the default setting is dark (the design-system default)', () => {
    expect(html).toMatch(/<html[^>]*class="dark"/);
    expect(html).toMatch(/color-scheme: dark/);
    expect(DEFAULT_SETTINGS.theme).toBe('dark');
    expect(bootScript.length).toBeGreaterThan(50);
  });

  it('leaves the dark default alone when nothing is stored', () => {
    runBootScript();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('applies a stored light preference synchronously, before React exists', () => {
    window.localStorage.setItem('re-shell.dashboard.settings.v1', JSON.stringify({ ...DEFAULT_SETTINGS, theme: 'light' }));
    runBootScript();
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('ignores a corrupt or unknown stored theme', () => {
    window.localStorage.setItem('re-shell.dashboard.settings.v1', '{broken');
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    window.localStorage.setItem('re-shell.dashboard.settings.v1', JSON.stringify({ theme: 'neon' }));
    runBootScript();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('injects the active theme pack CSS before paint', () => {
    window.localStorage.setItem('re-shell.dashboard.themepack-css.v1', ':root:root{--radius:0.25rem;}');
    runBootScript();
    expect(document.getElementById('re-shell-theme-pack')?.textContent).toBe(':root:root{--radius:0.25rem;}');
  });

  it('survives unavailable storage', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    try {
      expect(runBootScript).not.toThrow();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
