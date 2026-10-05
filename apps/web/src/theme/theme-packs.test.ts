import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_THEME_PACK_STATE,
  MAX_INSTALLED_PACKS,
  THEME_PACK_CSS_KEY,
  THEME_PACK_STORAGE_KEY,
  THEME_PACK_STYLE_ID,
  ThemeInstallError,
  addThemePack,
  applyThemePack,
  fetchThemePack,
  isAllowedThemeUrl,
  loadThemePackState,
  parseThemePackText,
  readThemePackFile,
  removeThemePack,
  saveThemePackState,
} from './theme-packs';

const LIGHT = {
  background: 'oklch(0.97 0.004 265)',
  foreground: 'oklch(0.21 0.015 265)',
  primary: 'oklch(0.74 0.18 130)',
  'primary-foreground': 'oklch(0.16 0.03 130)',
};

function packJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'midnight-lime',
    name: 'Midnight Lime',
    version: '1.0.0',
    radius: '0.25rem',
    fonts: { mono: 'ui-monospace, Menlo' },
    colors: {
      light: LIGHT,
      dark: { ...LIGHT, background: 'oklch(0.16 0.01 265)', foreground: 'oklch(0.96 0.006 265)' },
    },
    ...overrides,
  };
}

function pack(overrides: Record<string, unknown> = {}) {
  return parseThemePackText(JSON.stringify(packJson(overrides)), 'test');
}

describe('theme pack state', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.getElementById(THEME_PACK_STYLE_ID)?.remove();
  });
  afterEach(() => window.localStorage.clear());

  it('install -> apply -> remove round trip restores the built-in theme', () => {
    let state = addThemePack(EMPTY_THEME_PACK_STATE, pack());
    expect(state.installed.map((p) => p.id)).toEqual(['midnight-lime']);
    state = { ...state, activeId: 'midnight-lime' };

    applyThemePack(state.installed[0]);
    const style = document.getElementById(THEME_PACK_STYLE_ID);
    expect(style?.tagName).toBe('STYLE');
    expect(style?.textContent).toContain(':root:root{--radius:0.25rem;--font-mono:ui-monospace, Menlo;}');
    expect(style?.textContent).toContain(':root.light{--background:oklch(0.97 0.004 265);');
    expect(style?.textContent).toContain(':root.dark{--background:oklch(0.16 0.01 265);');

    // Re-applying updates in place (still exactly one element).
    applyThemePack(pack({ radius: '1rem' }));
    expect(document.querySelectorAll(`#${THEME_PACK_STYLE_ID}`)).toHaveLength(1);
    expect(document.getElementById(THEME_PACK_STYLE_ID)?.textContent).toContain('--radius:1rem');

    state = removeThemePack(state, 'midnight-lime');
    applyThemePack(null);
    expect(state).toEqual({ installed: [], activeId: null });
    expect(document.getElementById(THEME_PACK_STYLE_ID)).toBeNull();
  });

  it('persists, mirrors the active CSS for the boot script, and reloads re-validated', () => {
    const state = { ...addThemePack(EMPTY_THEME_PACK_STATE, pack()), activeId: 'midnight-lime' };
    saveThemePackState(state);
    expect(window.localStorage.getItem(THEME_PACK_CSS_KEY)).toContain(':root:root{--radius:0.25rem');
    expect(loadThemePackState()).toEqual(state);

    // No active pack: the boot-script CSS mirror disappears.
    saveThemePackState({ ...state, activeId: null });
    expect(window.localStorage.getItem(THEME_PACK_CSS_KEY)).toBeNull();
  });

  it('drops stored packs that no longer validate and clears a dangling active id', () => {
    window.localStorage.setItem(
      THEME_PACK_STORAGE_KEY,
      JSON.stringify({
        installed: [packJson(), packJson({ id: 'broken', radius: '99rem' }), 'nonsense'],
        activeId: 'broken',
      })
    );
    const state = loadThemePackState();
    expect(state.installed.map((p) => p.id)).toEqual(['midnight-lime']);
    expect(state.activeId).toBeNull();
  });

  it('survives corrupt storage', () => {
    window.localStorage.setItem(THEME_PACK_STORAGE_KEY, '{nope');
    expect(loadThemePackState()).toEqual(EMPTY_THEME_PACK_STATE);
  });

  it('replaces a pack with the same id and caps the number of installed packs', () => {
    let state = addThemePack(EMPTY_THEME_PACK_STATE, pack());
    state = addThemePack(state, pack({ version: '2.0.0' }));
    expect(state.installed).toHaveLength(1);
    expect(state.installed[0].version).toBe('2.0.0');

    state = EMPTY_THEME_PACK_STATE;
    for (let i = 0; i < MAX_INSTALLED_PACKS; i += 1) state = addThemePack(state, pack({ id: `pack-${i}` }));
    expect(() => addThemePack(state, pack({ id: 'one-too-many' }))).toThrow(/At most/);
  });

  it('removing the active pack falls back to the built-in theme', () => {
    const state = { ...addThemePack(EMPTY_THEME_PACK_STATE, pack()), activeId: 'midnight-lime' };
    expect(removeThemePack(state, 'midnight-lime').activeId).toBeNull();
    expect(removeThemePack(state, 'other').activeId).toBe('midnight-lime');
  });
});

describe('theme pack install sources', () => {
  it('rejects invalid text with every problem listed', () => {
    try {
      parseThemePackText(JSON.stringify(packJson({ id: 'Bad Id', radius: '99rem', colors: { light: { ...LIGHT, foreground: 'oklch(0.9 0.01 265)' } } })), 'x.json');
      throw new Error('should have failed');
    } catch (error) {
      expect(error).toBeInstanceOf(ThemeInstallError);
      const problems = (error as ThemeInstallError).problems.join('\n');
      expect(problems).toContain('id:');
      expect(problems).toContain('radius:');
      expect(problems).toMatch(/foreground on background has contrast/);
    }
    expect(() => parseThemePackText('{nope', 'x.json')).toThrow(ThemeInstallError);
  });

  it('only fetches from https (or loopback http), without credentials', async () => {
    expect(isAllowedThemeUrl('https://a.example/t.json')).toBe(true);
    expect(isAllowedThemeUrl('http://localhost:3000/t.json')).toBe(true);
    expect(isAllowedThemeUrl('http://a.example/t.json')).toBe(false);
    expect(isAllowedThemeUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedThemeUrl('not a url')).toBe(false);
    const never = vi.fn();
    await expect(fetchThemePack('http://a.example/t.json', never as unknown as typeof fetch)).rejects.toThrow(/https/);
    expect(never).not.toHaveBeenCalled();

    const ok = vi.fn(async () => new Response(JSON.stringify(packJson()))) as unknown as typeof fetch;
    expect((await fetchThemePack(' https://a.example/t.json ', ok)).id).toBe('midnight-lime');
    expect(ok).toHaveBeenCalledWith('https://a.example/t.json', expect.objectContaining({ credentials: 'omit', referrerPolicy: 'no-referrer' }));
  });

  it('reports HTTP errors, network errors (CORS hint) and oversized bodies', async () => {
    const http = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchThemePack('https://a.example/t.json', http)).rejects.toThrow(/HTTP 404/);
    const net = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(fetchThemePack('https://a.example/t.json', net)).rejects.toThrow(/CORS/);
    const big = vi.fn(async () => new Response('x'.repeat(70_000))) as unknown as typeof fetch;
    await expect(fetchThemePack('https://a.example/t.json', big)).rejects.toThrow(/larger than/);
  });

  it('reads a file and validates it', async () => {
    const good = new File([JSON.stringify(packJson())], 'theme.json', { type: 'application/json' });
    expect((await readThemePackFile(good)).name).toBe('Midnight Lime');
    const bad = new File(['{"nope":true}'], 'bad.json');
    await expect(readThemePackFile(bad)).rejects.toThrow(ThemeInstallError);
    const huge = new File(['x'.repeat(70_000)], 'huge.json');
    await expect(readThemePackFile(huge)).rejects.toThrow(/larger than/);
  });
});
