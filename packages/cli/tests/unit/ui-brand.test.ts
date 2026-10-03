import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_WHITE_LABEL, resolveWhiteLabel } from '@re-shell/contracts';

import { WhiteLabelConfigError, loadWhiteLabel } from '../../src/utils/ui-brand';
import { startStaticServer, type StaticServer } from '../../src/utils/ui-static-server';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 're-shell-brand-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('loadWhiteLabel', () => {
  it('returns the defaults, not customised, when nothing is configured', () => {
    const loaded = loadWhiteLabel(dir, {});
    expect(loaded.brand.productName).toBe(DEFAULT_WHITE_LABEL.productName);
    expect(loaded.file).toBeNull();
    expect(loaded.customised).toBe(false);
  });

  it('reads re-shell.whitelabel.json from the workspace', () => {
    writeFileSync(join(dir, 're-shell.whitelabel.json'), JSON.stringify({ productName: 'Acme Console', accentColor: '#0b6bcb' }));
    const loaded = loadWhiteLabel(dir, {});
    expect(loaded.brand.productName).toBe('Acme Console');
    expect(loaded.brand.accentColor).toBe('#0b6bcb');
    expect(loaded.brand.accentForeground).toBeTruthy();
    expect(loaded.file).toBe(join(dir, 're-shell.whitelabel.json'));
    expect(loaded.customised).toBe(true);
  });

  it('falls back to .re-shell/whitelabel.json', () => {
    mkdirSync(join(dir, '.re-shell'));
    writeFileSync(join(dir, '.re-shell/whitelabel.json'), JSON.stringify({ productName: 'Nested' }));
    expect(loadWhiteLabel(dir, {}).brand.productName).toBe('Nested');
  });

  it('lets environment variables win over the file', () => {
    writeFileSync(join(dir, 're-shell.whitelabel.json'), JSON.stringify({ productName: 'From File', tagline: 'file tagline' }));
    const loaded = loadWhiteLabel(dir, { RE_SHELL_BRAND_NAME: 'From Env' });
    expect(loaded.brand.productName).toBe('From Env');
    expect(loaded.brand.tagline).toBe('file tagline');
  });

  it('honours RE_SHELL_WHITE_LABEL_FILE and fails loudly when it is missing', () => {
    writeFileSync(join(dir, 'brand.json'), JSON.stringify({ productName: 'Pointed' }));
    expect(loadWhiteLabel(dir, { RE_SHELL_WHITE_LABEL_FILE: 'brand.json' }).brand.productName).toBe('Pointed');
    expect(() => loadWhiteLabel(dir, { RE_SHELL_WHITE_LABEL_FILE: 'nope.json' })).toThrow(WhiteLabelConfigError);
  });

  it('rejects invalid JSON and invalid values with the reasons (never silently defaults)', () => {
    writeFileSync(join(dir, 're-shell.whitelabel.json'), '{ not json');
    expect(() => loadWhiteLabel(dir, {})).toThrow(/not valid JSON/);

    writeFileSync(join(dir, 're-shell.whitelabel.json'), JSON.stringify({ logo: 'javascript:alert(1)', accentColor: 'red-ish' }));
    expect(resolveWhiteLabel({ productName: 'x<script>' }).ok).toBe(false);
    try {
      loadWhiteLabel(dir, {});
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(WhiteLabelConfigError);
      expect((error as WhiteLabelConfigError).reasons.join(' ')).toMatch(/logo/);
      expect((error as WhiteLabelConfigError).reasons.join(' ')).toMatch(/accentColor/);
    }
  });
});

describe('static server applies the brand at serve time', () => {
  let server: StaticServer | null = null;
  afterEach(async () => {
    await server?.close();
    server = null;
  });

  function seed(): void {
    writeFileSync(
      join(dir, 'index.html'),
      '<!doctype html><html><head><title>Re-Shell</title><link rel="icon" href="/favicon.svg" />' +
        '<script id="re-shell-brand" type="application/json">{"productName":"Re-Shell"}</script>' +
        '<script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>'
    );
  }

  it('rewrites title, favicon and the brand block, and still injects the hub config first', async () => {
    seed();
    const result = resolveWhiteLabel({ productName: 'Acme & Co', favicon: '/acme.ico', accentColor: '#0b6bcb' });
    if (!result.ok) throw new Error('invalid brand');
    server = await startStaticServer({ rootDir: dir, host: '127.0.0.1', port: 0, hubUrl: 'http://127.0.0.1:1', hubToken: 'tok', brand: result.config });

    const html = await (await fetch(`${server.url}/`)).text();
    expect(html).toContain('<title>Acme &amp; Co</title>');
    expect(html).toContain('<link rel="icon" href="/acme.ico" />');
    expect(html).not.toContain('"productName":"Re-Shell"');
    expect(html).toContain('"accentColor":"#0b6bcb"');
    // Escaped for its HTML context (the schema already rejects markup characters like "<").
    expect(html).not.toContain('<title>Acme & Co</title>');
    expect(html.indexOf('window.__RE_SHELL_HUB__')).toBeLessThan(html.indexOf('type="module"'));

    // SPA fallback routes are branded too.
    expect(await (await fetch(`${server.url}/jobs`)).text()).toContain('Acme &amp; Co');
  });

  it('serves the file untouched when no brand is supplied', async () => {
    seed();
    server = await startStaticServer({ rootDir: dir, host: '127.0.0.1', port: 0, hubUrl: 'http://127.0.0.1:1', hubToken: 'tok' });
    const html = await (await fetch(`${server.url}/`)).text();
    expect(html).toContain('<title>Re-Shell</title>');
    expect(html).toContain('"productName":"Re-Shell"');
  });
});
