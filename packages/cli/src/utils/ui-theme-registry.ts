// Discovery and installation of dashboard theme packs.
//
// Same registry-client approach as the plugin marketplace: themes are ordinary npm
// packages carrying the `reshell-theme` keyword, found through the keyword-scoped
// npm search (RegistryClient.search) and downloaded from their registry tarball.
//
//   npm package   packument -> tarball -> sha512 integrity check -> read the theme file
//                 (`"reshell-theme": "path.json"` in package.json, else reshell-theme.json,
//                 else theme.json) -> parseThemePack
//   file / URL    read -> parseThemePack (https only for remote URLs; size-capped)
//
// A theme pack is DATA (OKLCH tokens, radius, font stacks), validated by the contracts
// schema, which also rejects packs that fall below WCAG AA contrast. No package code is
// ever executed or installed: only one JSON file is read out of the tarball in memory.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import {
  THEME_PACK_KEYWORD,
  THEME_PACK_MAX_BYTES,
  parseThemePack,
  type ThemePack,
} from '@re-shell/contracts';
import { RegistryClient, verifyRegistrySignature, type RegistrySearchHit } from './registry-client';
import { parseNpmSpec } from './plugin-installer';
import type { ThemeInstallMeta } from './ui-theme-store';

/** Raised for discovery / download / validation failures. */
export class ThemeRegistryError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ThemeRegistryError';
    this.details = details;
  }
}

/** A theme package found on the registry. */
export interface ThemeSearchHit {
  name: string;
  version: string;
  description?: string;
  author?: string;
  keywords: string[];
  date?: string;
  homepage?: string;
}

/** Search the registry for packages tagged `reshell-theme`. */
export async function searchThemes(
  client: RegistryClient,
  query: string | undefined,
  limit: number
): Promise<ThemeSearchHit[]> {
  const hits = await client.search(query, limit, THEME_PACK_KEYWORD);
  return hits.map((hit: RegistrySearchHit) => ({
    name: hit.name,
    version: hit.version,
    ...(hit.description ? { description: hit.description } : {}),
    ...(hit.author?.name ? { author: hit.author.name } : hit.publisher?.username ? { author: hit.publisher.username } : {}),
    keywords: hit.keywords ?? [],
    ...(hit.date ? { date: hit.date } : {}),
    ...(hit.links?.homepage ? { homepage: hit.links.homepage } : {}),
  }));
}

/** A pack together with where it came from. */
export interface ResolvedTheme {
  pack: ThemePack;
  meta: ThemeInstallMeta;
}

// ---------------------------------------------------------------------------
// tar.gz (just enough to read a few files out of an npm tarball, in memory)
// ---------------------------------------------------------------------------

function cString(buffer: Buffer): string {
  const end = buffer.indexOf(0);
  return buffer.subarray(0, end < 0 ? buffer.length : end).toString('utf8');
}

/**
 * Read selected regular files out of a gzip'd tar archive.
 *
 * Nothing is written to disk and entry names are only compared, never joined to a path, so a
 * hostile archive cannot traverse out of anywhere. Entries larger than `maxEntryBytes`
 * are skipped; the decompressed size is capped to defuse zip bombs.
 */
export function readTarGzEntries(
  archive: Buffer,
  wanted: (name: string) => boolean,
  options: { maxEntryBytes?: number; maxTotalBytes?: number } = {}
): Map<string, Buffer> {
  const maxEntry = options.maxEntryBytes ?? 512 * 1024;
  let tar: Buffer;
  try {
    tar = zlib.gunzipSync(archive, { maxOutputLength: options.maxTotalBytes ?? 64 * 1024 * 1024 });
  } catch (error) {
    throw new ThemeRegistryError(`the package tarball could not be decompressed: ${(error as Error).message}`);
  }
  const found = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const name = cString(header.subarray(0, 100));
    const prefix = cString(header.subarray(345, 500));
    const size = Number.parseInt(cString(header.subarray(124, 136)).trim() || '0', 8);
    if (!Number.isFinite(size) || size < 0) {
      throw new ThemeRegistryError('the package tarball has a corrupt header');
    }
    const type = String.fromCharCode(header[156] || 0x30);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const bodyStart = offset + 512;
    if ((type === '0' || type === '\0') && size <= maxEntry && wanted(fullName)) {
      found.set(fullName, Buffer.from(tar.subarray(bodyStart, bodyStart + size)));
    }
    offset = bodyStart + Math.ceil(size / 512) * 512;
  }
  return found;
}

/** Verify a downloaded tarball against npm's `dist.integrity` (SRI) or `dist.shasum` (sha1). */
export function verifyTarballIntegrity(tarball: Buffer, integrity?: string, shasum?: string): void {
  if (integrity) {
    for (const part of integrity.split(/\s+/)) {
      const match = /^(sha512|sha384|sha256)-(.+)$/.exec(part);
      if (!match) continue;
      const digest = crypto.createHash(match[1]).update(tarball).digest('base64');
      if (digest === match[2]) return;
    }
    throw new ThemeRegistryError('the downloaded tarball does not match the registry integrity hash; refusing to install', { integrity });
  }
  if (shasum) {
    if (crypto.createHash('sha1').update(tarball).digest('hex') === shasum) return;
    throw new ThemeRegistryError('the downloaded tarball does not match the registry shasum; refusing to install', { shasum });
  }
  throw new ThemeRegistryError('the registry published neither an integrity hash nor a shasum for this version; refusing to install');
}

function themeFileCandidates(manifest: { 'reshell-theme'?: unknown }): string[] {
  const declared = manifest['reshell-theme'];
  const candidates: string[] = [];
  if (typeof declared === 'string') {
    const normalized = path.posix.normalize(declared.replace(/^\.\//, ''));
    if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
      throw new ThemeRegistryError(`"reshell-theme": "${declared}" must be a relative path inside the package`);
    }
    candidates.push(normalized);
  }
  candidates.push('reshell-theme.json', 'theme.json');
  return candidates;
}

// ---------------------------------------------------------------------------
// sources
// ---------------------------------------------------------------------------

function validate(text: string, origin: string): ThemePack {
  const result = parseThemePack(text);
  if (!result.ok) {
    // (the CLI compiles without strictNullChecks, which disables the union narrowing)
    const errors = (result as { errors: readonly string[] }).errors;
    throw new ThemeRegistryError(`${origin} is not a valid theme pack:\n  ${errors.join('\n  ')}`, { errors });
  }
  return (result as { pack: ThemePack }).pack;
}

/** Read a theme pack from a local file. */
export function readThemeFile(file: string): ResolvedTheme {
  const absolute = path.resolve(file);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolute);
  } catch {
    throw new ThemeRegistryError(`${file} does not exist`);
  }
  if (!stat.isFile()) throw new ThemeRegistryError(`${file} is not a file`);
  if (stat.size > THEME_PACK_MAX_BYTES) throw new ThemeRegistryError(`${file} is larger than ${THEME_PACK_MAX_BYTES} bytes`);
  return { pack: validate(fs.readFileSync(absolute, 'utf8'), file), meta: { source: 'file', origin: absolute } };
}

/** Whether a remote theme URL is acceptable: https, or http to a loopback host. */
export function isAllowedThemeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch {
    return false;
  }
}

/** Download a theme pack from a URL (size-capped, https or loopback http only). */
export async function fetchThemeUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<ResolvedTheme> {
  if (!isAllowedThemeUrl(url)) throw new ThemeRegistryError(`${url}: only https:// URLs (or http://localhost) can be installed from`);
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: 'application/json' }, redirect: 'follow' });
  } catch (error) {
    throw new ThemeRegistryError(`could not download ${url}: ${(error as Error).message}`, { kind: 'unreachable' });
  }
  if (!response.ok) throw new ThemeRegistryError(`${url} returned HTTP ${response.status}`);
  const text = await response.text();
  if (Buffer.byteLength(text) > THEME_PACK_MAX_BYTES) throw new ThemeRegistryError(`${url} is larger than ${THEME_PACK_MAX_BYTES} bytes`);
  return { pack: validate(text, url), meta: { source: 'url', origin: url } };
}

/** Download and read a theme pack out of an npm package. */
export async function fetchThemeFromNpm(
  spec: string,
  client: RegistryClient,
  fetchImpl: typeof fetch = fetch
): Promise<ResolvedTheme> {
  const parsed = parseNpmSpec(spec);
  if (!parsed.name) throw new ThemeRegistryError(`"${spec}" is not a valid npm package name (name or name@version)`);

  const version = await client.getVersion(parsed.name, parsed.requested ?? undefined);
  if (!(version.keywords ?? []).includes(THEME_PACK_KEYWORD)) {
    throw new ThemeRegistryError(`${version.name}@${version.version} is not a Re-Shell theme: it lacks the "${THEME_PACK_KEYWORD}" keyword`);
  }
  if (version.deprecated) {
    throw new ThemeRegistryError(`${version.name}@${version.version} is deprecated: ${version.deprecated}`);
  }
  const tarballUrl = version.dist?.tarball;
  if (!tarballUrl || !isAllowedThemeUrl(tarballUrl)) {
    throw new ThemeRegistryError(`${version.name}@${version.version} has no usable tarball URL`);
  }

  let response: Response;
  try {
    response = await fetchImpl(tarballUrl);
  } catch (error) {
    throw new ThemeRegistryError(`could not download ${tarballUrl}: ${(error as Error).message}`, { kind: 'unreachable' });
  }
  if (!response.ok) throw new ThemeRegistryError(`${tarballUrl} returned HTTP ${response.status}`);
  const tarball = Buffer.from(await response.arrayBuffer());
  verifyTarballIntegrity(tarball, version.dist.integrity, version.dist.shasum);

  const entries = readTarGzEntries(tarball, (name) => /^[^/]+\/(package\.json|[^/]+\.json|.+\/[^/]+\.json)$/.test(name) && !name.includes('node_modules/'));
  const manifestBuffer = [...entries].find(([name]) => name.endsWith('/package.json') && name.split('/').length === 2)?.[1];
  const manifest = manifestBuffer ? (JSON.parse(manifestBuffer.toString('utf8')) as { 'reshell-theme'?: unknown }) : {};
  let themeText: string | undefined;
  for (const candidate of themeFileCandidates(manifest)) {
    const entry = [...entries].find(([name]) => name.split('/').slice(1).join('/') === candidate);
    if (entry) {
      themeText = entry[1].toString('utf8');
      break;
    }
  }
  if (themeText === undefined) {
    throw new ThemeRegistryError(
      `${version.name}@${version.version} contains no theme pack (looked for the "reshell-theme" package.json field, reshell-theme.json and theme.json)`
    );
  }

  // Best-effort provenance: record whether npm's signature verifies. Not gating: a pack is
  // inert, schema-validated data and the tarball integrity above is what protects the install.
  let signature: { verified: boolean; reason?: string };
  try {
    const verdict = verifyRegistrySignature(version, await client.getSigningKeys());
    signature = { verified: verdict.verified, ...(verdict.reason ? { reason: verdict.reason } : {}) };
  } catch (error) {
    signature = { verified: false, reason: `could not fetch registry signing keys: ${(error as Error).message}` };
  }

  return {
    pack: validate(themeText, `${version.name}@${version.version}`),
    meta: { source: 'npm', origin: `${version.name}@${version.version}`, integrity: version.dist.integrity, signature },
  };
}

/** What kind of identifier the user passed. */
export type ThemeIdentifierKind = 'file' | 'url' | 'npm';

/** Classify an install identifier: existing path, http(s) URL, otherwise an npm spec. */
export function classifyThemeIdentifier(identifier: string): ThemeIdentifierKind {
  if (/^https?:\/\//i.test(identifier)) return 'url';
  if (fs.existsSync(identifier)) return 'file';
  return 'npm';
}
