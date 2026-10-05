import { render, screen } from '@testing-library/react';
import { DEFAULT_WHITE_LABEL, resolveWhiteLabel, renderBrandIntoHtml, type ResolvedWhiteLabel } from '@re-shell/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../shell/Sidebar';
import { BrandProvider } from './BrandProvider';
import { BRAND_STYLE_ID, applyBrand, brandAccentCss, documentTitle, readBrand } from './brand';

function resolved(input: Record<string, unknown>): ResolvedWhiteLabel {
  const result = resolveWhiteLabel(input);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.config;
}

function setBrandScript(content: string | null): void {
  document.getElementById('re-shell-brand')?.remove();
  if (content === null) return;
  const script = document.createElement('script');
  script.id = 're-shell-brand';
  script.type = 'application/json';
  script.textContent = content;
  document.head.appendChild(script);
}

describe('readBrand', () => {
  afterEach(() => {
    setBrandScript(null);
    vi.restoreAllMocks();
  });

  it('defaults when nothing is injected', () => {
    expect(readBrand()).toEqual(DEFAULT_WHITE_LABEL);
    setBrandScript('{}');
    expect(readBrand()).toEqual(DEFAULT_WHITE_LABEL);
  });

  it('reads and re-validates the injected brand, deriving the accent ink', () => {
    setBrandScript(JSON.stringify({ productName: 'Acme Console', tagline: 'Platform', accentColor: '#ffcc00', logo: '/acme.svg' }));
    expect(readBrand()).toEqual({
      productName: 'Acme Console',
      tagline: 'Platform',
      logo: '/acme.svg',
      accentColor: '#ffcc00',
      accentForeground: '#0b0d11',
    });
  });

  it('falls back to the defaults (and says why) for an invalid or unreadable block', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setBrandScript(JSON.stringify({ productName: '<b>x</b>', logo: 'javascript:alert(1)' }));
    expect(readBrand()).toEqual(DEFAULT_WHITE_LABEL);
    setBrandScript('{not json');
    expect(readBrand()).toEqual(DEFAULT_WHITE_LABEL);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0][0])).toMatch(/invalid white-label config/);
    expect(String(warn.mock.calls[1][0])).toMatch(/unreadable white-label config/);
  });

  it('reads the exact block the build/serve-time injector writes', () => {
    const brand = resolved({ productName: `Acme "Quoted" & Co's`, accentColor: 'oklch(0.7 0.15 250)' });
    const html = renderBrandIntoHtml('<html><head></head><body></body></html>', brand);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(readBrand(doc)).toEqual(brand);
  });
});

describe('brand accent', () => {
  it('always styles the primary button with a readable ink', () => {
    const css = brandAccentCss(resolved({ accentColor: '#1d4ed8' }));
    for (const scheme of ['light', 'dark']) {
      expect(css).toContain(`:root.${scheme}{--primary:#1d4ed8;--primary-foreground:#ffffff;`);
    }
  });

  it('only takes over signal / focus ring in a scheme where the accent stays visible (>= 3:1)', () => {
    // Deep blue: strong on the light page, nearly invisible on the near-black dark page.
    const blue = brandAccentCss(resolved({ accentColor: '#1d4ed8' }));
    expect(blue).toMatch(/:root\.light\{[^}]*--signal:#1d4ed8;--ring:#1d4ed8;/);
    expect(blue).not.toMatch(/:root\.dark\{[^}]*--signal:/);

    // Pale yellow: the opposite.
    const yellow = brandAccentCss(resolved({ accentColor: '#ffe600' }));
    expect(yellow).toMatch(/:root\.dark\{[^}]*--signal:#ffe600;--ring:#ffe600;/);
    expect(yellow).not.toMatch(/:root\.light\{[^}]*--signal:/);
  });

  it('is empty without an accent', () => {
    expect(brandAccentCss(resolved({ productName: 'Acme' }))).toBe('');
  });
});

describe('applyBrand', () => {
  beforeEach(() => {
    document.getElementById(BRAND_STYLE_ID)?.remove();
    document.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
    document.head.appendChild(link);
  });

  it('adds, updates and removes the accent style, and swaps the favicon', () => {
    applyBrand(resolved({ accentColor: '#1d4ed8', favicon: '/acme.ico' }));
    expect(document.getElementById(BRAND_STYLE_ID)?.textContent).toContain('--primary:#1d4ed8');
    const icon = document.querySelector('link[rel="icon"]')!;
    expect(icon.getAttribute('href')).toBe('/acme.ico');
    expect(icon.hasAttribute('type')).toBe(false);

    applyBrand(resolved({ accentColor: '#ff0000' }));
    expect(document.querySelectorAll(`#${BRAND_STYLE_ID}`)).toHaveLength(1);
    expect(document.getElementById(BRAND_STYLE_ID)?.textContent).toContain('--primary:#ff0000');

    applyBrand(DEFAULT_WHITE_LABEL);
    expect(document.getElementById(BRAND_STYLE_ID)).toBeNull();
  });

  it('formats the document title with the product name', () => {
    expect(documentTitle('Health', resolved({ productName: 'Acme Console' }))).toBe('Health · Acme Console');
    expect(documentTitle('Overview', DEFAULT_WHITE_LABEL)).toBe('Overview · Re-Shell');
  });
});

describe('Sidebar brand rendering', () => {
  function renderSidebar(brand?: ResolvedWhiteLabel) {
    return render(
      <BrandProvider brand={brand}>
        <Sidebar activeScreen="overview" onNavigate={() => undefined} />
      </BrandProvider>
    );
  }

  it('shows the default Re-Shell brand when nothing is configured', () => {
    renderSidebar(DEFAULT_WHITE_LABEL);
    expect(screen.getByTestId('brand-name')).toHaveTextContent('Re-Shell');
    expect(screen.getByTestId('brand-mark')).toHaveTextContent('Mission Control');
    expect(screen.queryByTestId('brand-logo')).toBeNull();
  });

  it('shows a white-label name, tagline and logo (logo is decorative next to the name)', () => {
    renderSidebar(resolved({ productName: 'Acme Console', tagline: 'Platform team', logo: 'https://cdn.acme.test/logo.svg' }));
    expect(screen.getByTestId('brand-name')).toHaveTextContent('Acme Console');
    expect(screen.getByTestId('brand-mark')).toHaveTextContent('Platform team');
    expect(screen.queryByText('Mission Control')).toBeNull();
    const logo = screen.getByTestId('brand-logo');
    expect(logo).toHaveAttribute('src', 'https://cdn.acme.test/logo.svg');
    expect(logo).toHaveAttribute('alt', '');
    // the footer carries the product name too
    expect(screen.getAllByText('Acme Console').length).toBeGreaterThanOrEqual(2);
  });

  it('applies the accent style when the provider mounts', () => {
    renderSidebar(resolved({ productName: 'Acme', accentColor: '#1d4ed8' }));
    expect(document.getElementById(BRAND_STYLE_ID)?.textContent).toContain('--primary:#1d4ed8');
  });
});
