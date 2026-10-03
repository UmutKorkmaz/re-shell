import { describe, expect, it } from 'vitest';

import { BRAND_SCRIPT_ID, renderBrandIntoHtml } from './brand-html.js';
import { resolveWhiteLabel } from './ui-theme.js';

const html =
  '<!doctype html><html><head><title>Re-Shell UI</title><link rel="icon" type="image/svg+xml" href="/favicon.svg" />' +
  `<script id="${BRAND_SCRIPT_ID}" type="application/json">{}</script></head><body><div id="root"></div></body></html>`;

function embedded(out: string): Record<string, unknown> {
  const match = new RegExp(`<script id="${BRAND_SCRIPT_ID}" type="application/json">(.*?)</script>`).exec(out);
  if (!match) throw new Error('brand script missing');
  return JSON.parse(match[1]);
}

describe('renderBrandIntoHtml', () => {
  it('sets the title, the favicon and the brand JSON the app reads at boot', () => {
    const resolved = resolveWhiteLabel({ productName: 'Acme Console', favicon: '/acme.ico', accentColor: '#ffcc00' });
    if (!resolved.ok) throw new Error('config should be valid');
    const out = renderBrandIntoHtml(html, resolved.config);
    expect(out).toContain('<title>Acme Console</title>');
    expect(out).toContain('<link rel="icon" href="/acme.ico" />');
    expect(out).not.toContain('/favicon.svg');
    expect(embedded(out)).toEqual(resolved.config);
    expect(out.split(BRAND_SCRIPT_ID).length - 1).toBe(1);
  });

  it('inserts the pieces that are missing from the document', () => {
    const out = renderBrandIntoHtml('<html><head></head><body></body></html>', { productName: 'Acme', favicon: '/a.png' });
    expect(out).toContain('<title>Acme</title>');
    expect(out).toContain('<link rel="icon" href="/a.png" />');
    expect(out).toContain(`id="${BRAND_SCRIPT_ID}"`);
  });

  it('keeps the existing favicon when the brand has none', () => {
    expect(renderBrandIntoHtml(html, { productName: 'Acme' })).toContain('href="/favicon.svg"');
  });

  it('is idempotent', () => {
    const brand = { productName: 'Acme', favicon: '/a.png' };
    const once = renderBrandIntoHtml(html, brand);
    expect(renderBrandIntoHtml(once, brand)).toBe(once);
  });

  it('cannot be broken out of by hostile values (HTML and script contexts)', () => {
    const out = renderBrandIntoHtml(html, {
      productName: '</title><script>alert(1)</script>',
      tagline: '</script><img src=x onerror=alert(2)>',
      favicon: '/x.png" onload="alert(3)',
    });
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).not.toContain('<img src=x');
    // the quote in the URL is escaped, so `onload=` stays inside the single href value
    const link = /<link rel="icon"[^>]*>/.exec(out)![0];
    expect(link).toBe('<link rel="icon" href="/x.png&quot; onload=&quot;alert(3)" />');
    expect(out).toContain('&lt;/title&gt;');
    expect(embedded(out).tagline).toBe('</script><img src=x onerror=alert(2)>');
  });

  it('treats `$` sequences in values literally', () => {
    expect(renderBrandIntoHtml(html, { productName: "Acme $& $1 $'" })).toContain("<title>Acme $&amp; $1 $&#39;</title>");
  });
});
