import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import {
  runUiThemeInstall,
  runUiThemeList,
  runUiThemeRemove,
  runUiThemeSearch,
} from '../../src/commands/ui-theme';
import { RegistryClient } from '../../src/utils/registry-client';
import {
  ThemeRegistryError,
  classifyThemeIdentifier,
  fetchThemeFromNpm,
  fetchThemeUrl,
  isAllowedThemeUrl,
  readTarGzEntries,
  readThemeFile,
  searchThemes,
  verifyTarballIntegrity,
} from '../../src/utils/ui-theme-registry';
import {
  ThemeStoreError,
  installThemePack,
  listThemes,
  loadThemePack,
  readThemeIndex,
  removeThemePack,
  themesDir,
} from '../../src/utils/ui-theme-store';

const LIGHT = {
  background: 'oklch(0.97 0.004 265)',
  foreground: 'oklch(0.21 0.015 265)',
  primary: 'oklch(0.74 0.18 130)',
  'primary-foreground': 'oklch(0.16 0.03 130)',
};

function pack(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { schemaVersion: 1, id: 'midnight-lime', name: 'Midnight Lime', version: '1.2.0', radius: '0.5rem', colors: { light: LIGHT }, ...overrides };
}

/** A REAL ustar archive (512-byte headers, checksums), gzip'd, like `npm pack` produces. */
function makeTgz(files: Record<string, string>): Buffer {
  const blocks: Buffer[] = [];
  for (const [name, content] of Object.entries(files)) {
    const body = Buffer.from(content);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8');
    header.write('0000644\0', 100);
    header.write('0000000\0', 108);
    header.write('0000000\0', 116);
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124);
    header.write('00000000000\0', 136);
    header.write('        ', 148);
    header.write('0', 156);
    header.write('ustar\0', 257);
    header.write('00', 263);
    let sum = 0;
    for (const byte of header) sum += byte;
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return zlib.gzipSync(Buffer.concat(blocks));
}

function sri(buffer: Buffer): string {
  return `sha512-${crypto.createHash('sha512').update(buffer).digest('base64')}`;
}

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ui-theme-'));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** A fake npm registry: search, packument, signing keys and tarball. */
function registry(options: { keywords?: string[]; tamper?: boolean; files?: Record<string, string>; deprecated?: string } = {}) {
  const files = options.files ?? {
    'package/package.json': JSON.stringify({ name: 'reshell-theme-midnight', version: '1.2.0', keywords: ['reshell-theme'] }),
    'package/reshell-theme.json': JSON.stringify(pack()),
  };
  const tarball = makeTgz(files);
  const served = options.tamper ? makeTgz({ ...files, 'package/evil.txt': 'x' }) : tarball;
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/-/v1/search')) {
      return json({
        objects: [
          { package: { name: 'reshell-theme-midnight', version: '1.2.0', description: 'Dark lime', keywords: ['reshell-theme'], author: { name: 'Ada' }, links: { homepage: 'https://x.test' } } },
          { package: { name: 'reshell-theme-paper', version: '0.1.0', keywords: ['reshell-theme'], publisher: { username: 'bob' } } },
        ],
      });
    }
    if (url.endsWith('/-/npm/v1/keys')) return json({ keys: [] });
    if (url.endsWith('.tgz')) return new Response(served);
    if (url.includes('reshell-theme-midnight')) {
      return json({
        name: 'reshell-theme-midnight',
        'dist-tags': { latest: '1.2.0' },
        versions: {
          '1.2.0': {
            name: 'reshell-theme-midnight',
            version: '1.2.0',
            keywords: options.keywords ?? ['reshell-theme'],
            ...(options.deprecated ? { deprecated: options.deprecated } : {}),
            dist: { tarball: 'https://registry.test/reshell-theme-midnight/-/reshell-theme-midnight-1.2.0.tgz', integrity: sri(tarball) },
          },
        },
      });
    }
    return json({ error: 'not found' }, 404);
  });
  const client = new RegistryClient({ registryUrl: 'https://registry.test', fetchImpl: fetchImpl as never });
  return { client, fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('theme store', () => {
  let ws: string;
  beforeEach(() => {
    ws = tmp();
  });
  afterEach(() => fs.rmSync(ws, { recursive: true, force: true }));

  const parsed = () => {
    const file = path.join(ws, 'theme.json');
    fs.writeFileSync(file, JSON.stringify(pack()));
    return readThemeFile(file);
  };

  it('installs, lists, loads (re-validating) and removes a pack: the round trip', () => {
    const { pack: p, meta } = parsed();
    const entry = installThemePack(ws, p, meta, { now: () => new Date('2026-01-02T03:04:05Z') });
    expect(entry).toMatchObject({ id: 'midnight-lime', version: '1.2.0', source: 'file', installedAt: '2026-01-02T03:04:05.000Z', file: 'midnight-lime.json' });
    expect(listThemes(ws).map((t) => t.id)).toEqual(['midnight-lime']);
    expect(loadThemePack(ws, 'midnight-lime')).toEqual(p);
    expect(fs.existsSync(path.join(themesDir(ws), 'midnight-lime.json'))).toBe(true);

    removeThemePack(ws, 'midnight-lime');
    expect(listThemes(ws)).toEqual([]);
    expect(fs.existsSync(path.join(themesDir(ws), 'midnight-lime.json'))).toBe(false);
    expect(() => loadThemePack(ws, 'midnight-lime')).toThrow(/not installed/);
    expect(() => removeThemePack(ws, 'midnight-lime')).toThrow(ThemeStoreError);
  });

  it('refuses a duplicate id unless forced, and re-installs over it with --force', () => {
    const { pack: p, meta } = parsed();
    installThemePack(ws, p, meta);
    expect(() => installThemePack(ws, p, meta)).toThrow(/already installed/);
    const upgraded = { ...p, version: '2.0.0' };
    expect(installThemePack(ws, upgraded, meta, { force: true }).version).toBe('2.0.0');
    expect(listThemes(ws)).toHaveLength(1);
  });

  it('fails loudly on a corrupt index instead of overwriting it', () => {
    fs.mkdirSync(themesDir(ws), { recursive: true });
    fs.writeFileSync(path.join(themesDir(ws), 'index.json'), '{broken');
    expect(() => listThemes(ws)).toThrow(/not valid JSON/);
    fs.writeFileSync(path.join(themesDir(ws), 'index.json'), '{"themes":[]}');
    expect(() => readThemeIndex(ws)).toThrow(/no "themes" object/);
  });

  it('re-validates an installed pack that was edited by hand into something invalid', () => {
    const { pack: p, meta } = parsed();
    installThemePack(ws, p, meta);
    fs.writeFileSync(path.join(themesDir(ws), 'midnight-lime.json'), JSON.stringify(pack({ radius: '9rem' })));
    expect(() => loadThemePack(ws, 'midnight-lime')).toThrow(/no longer validates/);
  });

  it('pack ids cannot escape the themes directory (the schema only allows slugs)', () => {
    const file = path.join(ws, 'evil.json');
    fs.writeFileSync(file, JSON.stringify(pack({ id: '../../outside' })));
    expect(() => readThemeFile(file)).toThrow(/not a valid theme pack/);
  });
});

describe('tar.gz reading', () => {
  it('reads only the wanted regular files from a real archive', () => {
    const tgz = makeTgz({ 'package/a.json': '{"a":1}', 'package/b.txt': 'b', 'package/sub/c.json': '{"c":3}' });
    const found = readTarGzEntries(tgz, (name) => name.endsWith('.json'));
    expect([...found.keys()].sort()).toEqual(['package/a.json', 'package/sub/c.json']);
    expect(found.get('package/sub/c.json')?.toString()).toBe('{"c":3}');
  });

  it('skips oversized entries and rejects garbage', () => {
    const tgz = makeTgz({ 'package/big.json': 'x'.repeat(2000) });
    expect(readTarGzEntries(tgz, () => true, { maxEntryBytes: 100 }).size).toBe(0);
    expect(() => readTarGzEntries(Buffer.from('not gzip'), () => true)).toThrow(/could not be decompressed/);
  });

  it('verifies integrity (sha512 SRI and sha1 shasum) and refuses when nothing is published', () => {
    const buf = Buffer.from('tarball bytes');
    expect(() => verifyTarballIntegrity(buf, sri(buf))).not.toThrow();
    expect(() => verifyTarballIntegrity(buf, undefined, crypto.createHash('sha1').update(buf).digest('hex'))).not.toThrow();
    expect(() => verifyTarballIntegrity(buf, sri(Buffer.from('other')))).toThrow(/does not match the registry integrity/);
    expect(() => verifyTarballIntegrity(buf)).toThrow(/neither an integrity hash nor a shasum/);
  });
});

describe('theme discovery (npm keyword reshell-theme)', () => {
  it('searches the registry scoped to the reshell-theme keyword', async () => {
    const { client, calls } = registry();
    const hits = await searchThemes(client, 'dark', 10);
    expect(decodeURIComponent(calls[0])).toContain('text=dark keywords:reshell-theme');
    expect(calls[0]).toContain('size=10');
    expect(hits).toEqual([
      { name: 'reshell-theme-midnight', version: '1.2.0', description: 'Dark lime', author: 'Ada', keywords: ['reshell-theme'], homepage: 'https://x.test' },
      { name: 'reshell-theme-paper', version: '0.1.0', author: 'bob', keywords: ['reshell-theme'] },
    ]);
  });
});

describe('installing a pack', () => {
  let ws: string;
  beforeEach(() => {
    ws = tmp();
  });
  afterEach(() => fs.rmSync(ws, { recursive: true, force: true }));

  it('from npm: downloads the tarball, verifies integrity, reads reshell-theme.json, validates', async () => {
    const { client, fetchImpl } = registry();
    const { pack: p, meta } = await fetchThemeFromNpm('reshell-theme-midnight', client, fetchImpl);
    expect(p).toMatchObject({ id: 'midnight-lime', name: 'Midnight Lime' });
    expect(meta).toMatchObject({ source: 'npm', origin: 'reshell-theme-midnight@1.2.0' });
    expect(meta.integrity).toMatch(/^sha512-/);
    expect(meta.signature?.verified).toBe(false); // unsigned fixture: recorded, not gating
  });

  it('from npm: honours the "reshell-theme" package.json field and rejects path escapes', async () => {
    const nested = registry({
      files: {
        'package/package.json': JSON.stringify({ name: 'reshell-theme-midnight', version: '1.2.0', keywords: ['reshell-theme'], 'reshell-theme': './themes/main.json' }),
        'package/themes/main.json': JSON.stringify(pack({ id: 'nested-theme' })),
      },
    });
    expect((await fetchThemeFromNpm('reshell-theme-midnight', nested.client, nested.fetchImpl)).pack.id).toBe('nested-theme');

    const escape = registry({
      files: {
        'package/package.json': JSON.stringify({ name: 'reshell-theme-midnight', version: '1.2.0', keywords: ['reshell-theme'], 'reshell-theme': '../../etc/passwd' }),
      },
    });
    await expect(fetchThemeFromNpm('reshell-theme-midnight', escape.client, escape.fetchImpl)).rejects.toThrow(/relative path inside the package/);
  });

  it('from npm: refuses a tampered tarball, a non-theme package, a deprecated one and an empty one', async () => {
    const t = registry({ tamper: true });
    await expect(fetchThemeFromNpm('reshell-theme-midnight', t.client, t.fetchImpl)).rejects.toThrow(/does not match the registry integrity/);
    const k = registry({ keywords: ['something-else'] });
    await expect(fetchThemeFromNpm('reshell-theme-midnight', k.client, k.fetchImpl)).rejects.toThrow(/lacks the "reshell-theme" keyword/);
    const d = registry({ deprecated: 'use v2' });
    await expect(fetchThemeFromNpm('reshell-theme-midnight', d.client, d.fetchImpl)).rejects.toThrow(/deprecated: use v2/);
    const e = registry({ files: { 'package/package.json': JSON.stringify({ name: 'reshell-theme-midnight', version: '1.2.0', keywords: ['reshell-theme'] }) } });
    await expect(fetchThemeFromNpm('reshell-theme-midnight', e.client, e.fetchImpl)).rejects.toThrow(/contains no theme pack/);
  });

  it('from npm: rejects a pack that fails the schema (low contrast) with a readable reason', async () => {
    const bad = registry({
      files: {
        'package/package.json': JSON.stringify({ name: 'reshell-theme-midnight', version: '1.2.0', keywords: ['reshell-theme'] }),
        'package/reshell-theme.json': JSON.stringify(pack({ colors: { light: { ...LIGHT, foreground: 'oklch(0.9 0.01 265)' } } })),
      },
    });
    await expect(fetchThemeFromNpm('reshell-theme-midnight', bad.client, bad.fetchImpl)).rejects.toThrow(/foreground on background has contrast/);
  });

  it('from a URL: https (or loopback http) only, size-capped and validated', async () => {
    const ok = vi.fn(async () => json(pack())) as unknown as typeof fetch;
    expect((await fetchThemeUrl('https://themes.example/midnight.json', ok)).meta).toMatchObject({ source: 'url', origin: 'https://themes.example/midnight.json' });
    await expect(fetchThemeUrl('http://themes.example/x.json', ok)).rejects.toThrow(/only https/);
    await expect(fetchThemeUrl('file:///etc/passwd', ok)).rejects.toThrow(/only https/);
    expect(isAllowedThemeUrl('http://127.0.0.1:8080/x.json')).toBe(true);
    const huge = vi.fn(async () => new Response('x'.repeat(70_000))) as unknown as typeof fetch;
    await expect(fetchThemeUrl('https://a.example/x.json', huge)).rejects.toThrow(/larger than/);
    const missing = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchThemeUrl('https://a.example/x.json', missing)).rejects.toThrow(/HTTP 404/);
    const down = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    await expect(fetchThemeUrl('https://a.example/x.json', down)).rejects.toMatchObject({ details: { kind: 'unreachable' } });
  });

  it('classifies identifiers', () => {
    const file = path.join(ws, 't.json');
    fs.writeFileSync(file, '{}');
    expect(classifyThemeIdentifier(file)).toBe('file');
    expect(classifyThemeIdentifier('https://x.test/t.json')).toBe('url');
    expect(classifyThemeIdentifier('reshell-theme-midnight@1.2.0')).toBe('npm');
    expect(() => readThemeFile(path.join(ws, 'missing.json'))).toThrow(ThemeRegistryError);
  });
});

describe('ui theme commands', () => {
  let ws: string;
  let written: string[];
  let errors: string[];
  let out: ReturnType<typeof vi.spyOn>;
  let err: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    ws = tmp();
    written = [];
    errors = [];
    process.exitCode = undefined;
    out = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    }) as unknown as ReturnType<typeof vi.spyOn>;
    err = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      errors.push(String(chunk));
      return true;
    }) as unknown as ReturnType<typeof vi.spyOn>;
  });
  afterEach(() => {
    out.mockRestore();
    err.mockRestore();
    process.exitCode = undefined;
    fs.rmSync(ws, { recursive: true, force: true });
  });
  const last = (): Record<string, any> => JSON.parse(written[written.length - 1]);

  it('search --json', async () => {
    const { client } = registry();
    await runUiThemeSearch('dark', { json: true, client });
    expect(last()).toMatchObject({ ok: true, data: { keyword: 'reshell-theme', query: 'dark', themes: [{ name: 'reshell-theme-midnight' }, { name: 'reshell-theme-paper' }] } });
  });

  it('install from npm -> list -> remove, with JSON envelopes', async () => {
    const { client, fetchImpl } = registry();
    await runUiThemeInstall('reshell-theme-midnight', { json: true, workspace: ws, client, fetch: fetchImpl });
    expect(last()).toMatchObject({
      ok: true,
      data: { dryRun: false, schemes: ['light'], theme: { id: 'midnight-lime', source: 'npm', origin: 'reshell-theme-midnight@1.2.0' } },
    });
    expect(last().warnings[0]).toMatch(/registry signature not verified/);

    await runUiThemeList({ json: true, workspace: ws });
    expect(last().data.themes.map((t: { id: string }) => t.id)).toEqual(['midnight-lime']);

    await runUiThemeRemove('midnight-lime', { json: true, workspace: ws });
    expect(last().data.removed.id).toBe('midnight-lime');
    await runUiThemeList({ json: true, workspace: ws });
    expect(last().data.themes).toEqual([]);
  });

  it('install from a file honours --dry-run and --force', async () => {
    const file = path.join(ws, 'theme.json');
    fs.writeFileSync(file, JSON.stringify(pack()));
    await runUiThemeInstall(file, { json: true, workspace: ws, dryRun: true });
    expect(last().data).toMatchObject({ dryRun: true, theme: { id: 'midnight-lime' } });
    expect(listThemes(ws)).toEqual([]);

    await runUiThemeInstall(file, { json: true, workspace: ws });
    await runUiThemeInstall(file, { json: true, workspace: ws });
    expect(last()).toMatchObject({ ok: false, error: { code: 'UI_THEME_ERROR', message: expect.stringMatching(/already installed/) } });
    expect(process.exitCode).toBe(1);
    process.exitCode = undefined;
    await runUiThemeInstall(file, { json: true, workspace: ws, force: true });
    expect(last().ok).toBe(true);
  });

  it('reports an invalid pack as UI_THEME_ERROR with the validation errors', async () => {
    const file = path.join(ws, 'bad.json');
    fs.writeFileSync(file, JSON.stringify(pack({ fonts: { sans: 'x; } body{display:none' } })));
    await runUiThemeInstall(file, { json: true, workspace: ws });
    expect(last()).toMatchObject({ ok: false, error: { code: 'UI_THEME_ERROR', details: { errors: [expect.stringContaining('fonts.sans')] } } });
  });

  it('maps an unreachable registry to MARKETPLACE_UNREACHABLE (like the plugin marketplace)', async () => {
    const client = new RegistryClient({ fetchImpl: (async () => { throw new Error('offline'); }) as never });
    await runUiThemeSearch(undefined, { json: true, client });
    expect(last()).toMatchObject({ ok: false, error: { code: 'MARKETPLACE_UNREACHABLE' } });
  });

  it('removing an unknown id is an error', async () => {
    await runUiThemeRemove('ghost', { json: true, workspace: ws });
    expect(last()).toMatchObject({ ok: false, error: { code: 'UI_THEME_ERROR', message: expect.stringMatching(/not installed/) } });
  });

  it('prints human output and errors', async () => {
    await runUiThemeList({ workspace: ws });
    expect(written.join('')).toMatch(/no themes installed/);
    await runUiThemeRemove('ghost', { workspace: ws });
    expect(errors.join('')).toMatch(/not installed/);
    expect(process.exitCode).toBe(1);
  });
});
