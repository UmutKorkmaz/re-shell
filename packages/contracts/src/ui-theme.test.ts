import { describe, expect, it } from 'vitest';

import {
  THEME_COLOR_TOKENS,
  THEME_PACK_MAX_BYTES,
  contrastRatio,
  findThemeContrastIssues,
  parseOklch,
  parseThemePack,
  readableInkOn,
  renderThemePackCss,
  resolveWhiteLabel,
  whiteLabelFromEnv,
} from './ui-theme.js';

const lightColors = {
  background: 'oklch(0.97 0.004 265)',
  foreground: 'oklch(0.21 0.015 265)',
  primary: 'oklch(0.74 0.18 130)',
  'primary-foreground': 'oklch(0.16 0.03 130)',
};

function pack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'midnight-lime',
    name: 'Midnight Lime',
    version: '1.0.0',
    radius: '0.5rem',
    fonts: { display: '"Space Grotesk", system-ui', mono: 'ui-monospace, Menlo' },
    colors: { light: lightColors },
    ...overrides,
  };
}

describe('colour math', () => {
  it('parses OKLCH with percentages, degrees and alpha', () => {
    expect(parseOklch('oklch(0.5 0.1 120)')).toEqual({ l: 0.5, c: 0.1, h: 120, alpha: 1 });
    expect(parseOklch('oklch(50% 25% 120deg / 40%)')).toMatchObject({ l: 0.5, h: 120, alpha: 0.4 });
    expect(parseOklch('oklch(1.2 0.1 120)')).toBeNull();
    expect(parseOklch('oklch(0.5 0.1)')).toBeNull();
    expect(parseOklch('red')).toBeNull();
  });

  it('computes WCAG ratios that match known references', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // oklch(1 0 0) is white, oklch(0 0 0) is black.
    expect(contrastRatio('oklch(0 0 0)', 'oklch(1 0 0)')).toBeCloseTo(21, 1);
    expect(contrastRatio('nope', '#fff')).toBeNull();
  });

  it('picks readable ink for a brand colour', () => {
    expect(readableInkOn('#ffff00')).toBe('#0b0d11');
    expect(readableInkOn('#0b1020')).toBe('#ffffff');
  });
});

describe('themePackSchema', () => {
  it('accepts a complete valid pack', () => {
    const result = parseThemePack(pack());
    expect(result.ok).toBe(true);
  });

  it('accepts JSON text and enforces a size ceiling', () => {
    expect(parseThemePack(JSON.stringify(pack())).ok).toBe(true);
    const huge = JSON.stringify(pack({ description: 'x'.repeat(THEME_PACK_MAX_BYTES) }));
    const result = parseThemePack(huge);
    expect(result).toEqual({ ok: false, errors: [expect.stringContaining('exceeds')] });
  });

  it('reports non-JSON input without throwing', () => {
    const result = parseThemePack('{nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('not valid JSON');
  });

  it('requires the core tokens and at least one scheme', () => {
    const missing = parseThemePack(pack({ colors: { light: { background: lightColors.background } } }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.errors.join('\n')).toContain('"foreground" is missing');
    }
    const none = parseThemePack(pack({ colors: {} }));
    expect(none.ok).toBe(false);
  });

  it('rejects non-OKLCH colours, unknown tokens and unknown keys', () => {
    expect(parseThemePack(pack({ colors: { light: { ...lightColors, primary: '#ff0000' } } })).ok).toBe(false);
    expect(parseThemePack(pack({ colors: { light: { ...lightColors, sparkle: 'oklch(0.5 0.1 120)' } } })).ok).toBe(false);
    expect(parseThemePack(pack({ extra: true })).ok).toBe(false);
  });

  it('rejects CSS injection through every free-text channel', () => {
    const attacks = [
      { colors: { light: { ...lightColors, background: 'oklch(0.97 0.004 265); } body{display:none' } } },
      { fonts: { sans: 'Inter; } body { background: url(https://evil.test/x)' } },
      { fonts: { mono: 'url(https://evil.test/font.woff)' } },
      { radius: '1rem; color: red' },
      { name: '<img src=x onerror=alert(1)>' },
    ];
    for (const attack of attacks) {
      expect(parseThemePack(pack(attack)).ok, JSON.stringify(attack)).toBe(false);
    }
  });

  it('rejects bad ids, versions and oversized radius', () => {
    expect(parseThemePack(pack({ id: 'Not A Slug' })).ok).toBe(false);
    expect(parseThemePack(pack({ id: '../etc/passwd' })).ok).toBe(false);
    expect(parseThemePack(pack({ version: 'one' })).ok).toBe(false);
    expect(parseThemePack(pack({ radius: '9rem' })).ok).toBe(false);
  });

  it('rejects packs below WCAG AA and says which pair failed', () => {
    const result = parseThemePack(
      pack({ colors: { light: { ...lightColors, foreground: 'oklch(0.9 0.01 265)' } } })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toMatch(/foreground on background has contrast \d+(\.\d+)?:1/);
    }
  });

  it('lists every token the CSS grammar can set', () => {
    expect(THEME_COLOR_TOKENS).toContain('signal');
    expect(new Set(THEME_COLOR_TOKENS).size).toBe(THEME_COLOR_TOKENS.length);
  });

  it('finds contrast issues only for pairs defined on both sides', () => {
    expect(findThemeContrastIssues('dark', { foreground: 'oklch(0.5 0 0)' })).toEqual([]);
    const issues = findThemeContrastIssues('dark', {
      background: 'oklch(0.2 0 0)',
      foreground: 'oklch(0.3 0 0)',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ scheme: 'dark', foreground: 'foreground', background: 'background' });
  });
});

describe('renderThemePackCss', () => {
  it('emits scheme-scoped custom properties plus shared radius and fonts', () => {
    const parsed = parseThemePack(pack({ colors: { light: lightColors, dark: { ...lightColors, background: 'oklch(0.16 0.01 265)', foreground: 'oklch(0.96 0.006 265)' } } }));
    if (!parsed.ok) throw new Error(parsed.errors.join('; '));
    const css = renderThemePackCss(parsed.pack);
    expect(css).toContain(':root{--radius:0.5rem;--font-display:"Space Grotesk", system-ui;--font-mono:ui-monospace, Menlo;}');
    expect(css).toContain(':root.light{--background:oklch(0.97 0.004 265);');
    expect(css).toContain(':root.dark{--background:oklch(0.16 0.01 265);');
    expect(css).not.toContain('{}');
  });
});

describe('white-label config', () => {
  it('resolves to defaults for empty input', () => {
    expect(resolveWhiteLabel(undefined)).toEqual({ ok: true, config: { productName: 'Re-Shell' } });
  });

  it('merges the file with env values, env winning, and derives accent ink', () => {
    const env = whiteLabelFromEnv({ RE_SHELL_BRAND_NAME: ' Acme Console ', RE_SHELL_BRAND_ACCENT: '#ffcc00', OTHER: 'x' });
    expect(env).toEqual({ productName: 'Acme Console', accentColor: '#ffcc00' });
    const result = resolveWhiteLabel({ productName: 'File Name', tagline: 'Platform', logo: '/acme.svg' }, env);
    expect(result).toEqual({
      ok: true,
      config: {
        productName: 'Acme Console',
        tagline: 'Platform',
        logo: '/acme.svg',
        accentColor: '#ffcc00',
        accentForeground: '#0b0d11',
      },
    });
  });

  it('rejects unsafe logo / favicon URLs and bad accents', () => {
    for (const bad of [
      { logo: 'javascript:alert(1)' },
      { logo: 'http://evil.test/logo.png' },
      { favicon: '//evil.test/x.ico' },
      { logo: 'data:text/html;base64,AAAA' },
      { accentColor: 'rebeccapurple' },
      { productName: '<b>x</b>' },
      { productName: '' },
      { unknown: 'field' },
    ]) {
      expect(resolveWhiteLabel(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('accepts https, same-origin and data:image brand assets', () => {
    expect(resolveWhiteLabel({ logo: 'https://cdn.acme.test/logo.svg', favicon: '/favicon.ico' }).ok).toBe(true);
    expect(resolveWhiteLabel({ logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }).ok).toBe(true);
    expect(resolveWhiteLabel({ logo: 'http://localhost:3000/logo.png' }).ok).toBe(true);
  });

  it('rejects a non-object config file', () => {
    expect(resolveWhiteLabel([1, 2]).ok).toBe(false);
    expect(resolveWhiteLabel('text').ok).toBe(false);
  });
});
