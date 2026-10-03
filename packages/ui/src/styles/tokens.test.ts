/**
 * Colour-contrast audit of the design tokens in BOTH themes, computed from the
 * real `globals.css` (OKLCH -> sRGB -> WCAG 2.x ratio). jsdom cannot compute
 * contrast, so this is where the status colours, the signal accent and the
 * focus ring are proven; the Playwright `a11y` project proves the rendered pages.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compositeOver, contrastRatio, contrastRatioLinear, parseColorToLinearRgb } from '@re-shell/contracts';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, 'globals.css'), 'utf8');

type Tokens = Record<string, string>;

/** Read `--name: value;` declarations from the block that starts at `opening`. */
function readBlock(opening: string): Tokens {
  const start = css.indexOf(opening);
  if (start < 0) throw new Error(`block not found: ${opening.trim()}`);
  const end = css.indexOf('\n  }', start);
  const tokens: Tokens = {};
  for (const match of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const THEMES: Record<'dark' | 'light', Tokens> = {
  dark: readBlock('  :root,\n  .dark {'),
  light: readBlock('\n  .light {')
};

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

function ratio(tokens: Tokens, fg: string, bg: string): number {
  const value = contrastRatio(tokens[fg], tokens[bg]);
  if (value === null) throw new Error(`cannot compute contrast for --${fg} on --${bg}`);
  return value;
}

describe.each(['dark', 'light'] as const)('%s theme contrast', (theme) => {
  const t = THEMES[theme];
  const surfaces = ['background', 'bg-0', 'bg-1', 'bg-2', 'card', 'popover'];

  it.each(surfaces)('body text on %s', (surface) => {
    const fg = surface === 'card' ? 'card-foreground' : surface === 'popover' ? 'popover-foreground' : 'foreground';
    expect(ratio(t, fg, surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([...surfaces, 'muted', 'input'])('muted text on %s', (surface) => {
    expect(ratio(t, 'muted-foreground', surface)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['accent-foreground', 'accent'],
    ['destructive-foreground', 'destructive'],
    ['signal-foreground', 'signal'],
    ['status-healthy-foreground', 'status-healthy'],
    ['status-warn-foreground', 'status-warn'],
    ['status-critical-foreground', 'status-critical'],
    ['status-info-foreground', 'status-info']
  ])('--%s text on --%s fill', (fg, bg) => {
    expect(ratio(t, fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  describe.each(['healthy', 'warn', 'critical', 'info'] as const)('status %s as text', (status) => {
    const token = `status-${status}`;

    it.each(['background', 'bg-0', 'bg-1', 'bg-2', 'card'])('on %s', (surface) => {
      expect(ratio(t, token, surface)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('on its own 10% tinted badge background (what <Badge variant> renders)', () => {
      const fg = parseColorToLinearRgb(t[token])!;
      for (const surface of ['card', 'bg-0', 'bg-2']) {
        const bg = compositeOver(fg, 0.1, parseColorToLinearRgb(t[surface])!);
        expect(contrastRatioLinear(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  });

  describe('signal accent', () => {
    it.each(['background', 'bg-0', 'bg-1', 'card'])('as text / icon on %s', (surface) => {
      // `text-signal` is used for icons, links and the active-nav marker.
      expect(ratio(t, 'signal', surface)).toBeGreaterThanOrEqual(AA_TEXT);
    });

    it('primary button label on the primary fill', () => {
      expect(ratio(t, 'primary-foreground', 'primary')).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe('non-text UI (WCAG 1.4.11)', () => {
    it.each(['background', 'bg-0', 'card', 'bg-2'])('focus ring on %s', (surface) => {
      expect(ratio(t, 'ring', surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it.each(['background', 'bg-0', 'card', 'bg-2'])('control boundary / off state on %s', (surface) => {
      expect(ratio(t, 'control', surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  });
});

describe('theme completeness', () => {
  it('defines the same colour tokens in both themes', () => {
    expect(Object.keys(THEMES.light).sort()).toEqual(
      Object.keys(THEMES.dark).filter((name) => !/^(dur-|ease-|radius$|font-)/.test(name)).sort()
    );
  });

  it('keeps the dark theme the default (`:root` shares the dark block)', () => {
    expect(css).toContain(':root,\n  .dark {');
  });

  it('has a status foreground and glow for every status in both themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const status of ['healthy', 'warn', 'critical', 'info']) {
        for (const suffix of ['', '-foreground', '-glow']) {
          expect(THEMES[theme][`status-${status}${suffix}`], `${theme} --status-${status}${suffix}`).toBeDefined();
        }
      }
    }
  });

  it('keeps the OKLCH-less hex fallback (incl. status foreground/glow) in sync with the tokens', () => {
    // Fails with a readable message when a token changes without regenerating.
    expect(() =>
      execFileSync(process.execPath, [resolve(here, '../../scripts/hex-fallback.mjs')], { stdio: 'pipe' })
    ).not.toThrow();

    const fallbackStart = css.indexOf('@supports not (color: oklch(0 0 0))');
    const lightFallback = css.slice(css.indexOf('.light {', fallbackStart));
    for (const status of ['healthy', 'warn', 'critical', 'info']) {
      expect(lightFallback).toContain(`--status-${status}-foreground:`);
      expect(lightFallback).toContain(`--status-${status}-glow:`);
    }
  });
});

describe('motion and focus rules', () => {
  it('disables animation under prefers-reduced-motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block).toContain('animation-duration: 0.001ms !important');
    expect(block).toContain('transition-duration: 0.001ms !important');
    expect(block).toContain('.animate-pulse-live');
  });

  it('draws a baseline focus indicator for anything a component does not style', () => {
    expect(css).toMatch(/:focus-visible\s*\{\s*outline: 2px solid var\(--ring\)/);
  });

  it('does not inline webfonts into the library stylesheet', () => {
    expect(css).not.toContain('@fontsource');
  });
});
