import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import type { AddressInfo } from 'net';

/**
 * A tiny but REAL npm registry for tests: an HTTP server on 127.0.0.1 that
 * serves packuments, real gzipped tarballs (built with `tar`), the signing-key
 * endpoint and the search endpoint. The CLI's installer shells out to a real
 * `npm pack --registry <url>` against it, so install/update/pin/signature flows
 * run end to end with no mocks and no external network.
 *
 * Signatures are genuine ECDSA P-256 / SHA-256 over `<name>@<version>:<integrity>`,
 * exactly what registry.npmjs.org publishes, verified by the CLI's real
 * `verifyRegistrySignature`.
 */

export interface FakeVersion {
  /** Extra package.json fields (name/version are filled in). */
  manifest?: Record<string, unknown>;
  /** Files to put in the tarball, relative to the package root. */
  files?: Record<string, string>;
  /** Deprecation message for this version. */
  deprecated?: string;
}

export interface FakePackage {
  name: string;
  versions: Record<string, FakeVersion>;
  /** dist-tags; `latest` defaults to the highest version listed. */
  distTags?: Record<string, string>;
  /** Package-level fields served on the packument (keywords, readme, ...). */
  packument?: Record<string, unknown>;
}

export interface FakeRegistryOptions {
  packages: FakePackage[];
  /** Sign every version with this key (served from /-/npm/v1/keys). */
  signing?: { keyid: string } | false;
  /** Extra search hits to return from /-/v1/search (default: derived from packages). */
  searchObjects?: unknown[];
  /** If set, every request returns this status (simulate an outage). */
  failWith?: number;
  /** Serve signatures that do NOT verify (flipped bytes) to exercise rejection. */
  tamperSignatures?: boolean;
}

export interface FakeRegistry {
  url: string;
  /** Paths requested, in order. */
  requests: string[];
  /** Replace/extend packages while running (e.g. publish a new version). */
  setPackage(pkg: FakePackage): void;
  close(): Promise<void>;
}

function highest(versions: string[]): string {
  const parse = (v: string): number[] => v.split('.').map((n) => parseInt(n, 10));
  return [...versions].sort((a, b) => {
    const [x, y] = [parse(a), parse(b)];
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  })[versions.length - 1];
}

function buildTarball(
  name: string,
  version: string,
  def: FakeVersion,
  workDir: string
): { file: string; integrity: string; shasum: string; unpackedSize: number } {
  const pkgRoot = path.join(workDir, `${name.replace(/[@/]/g, '_')}-${version}`, 'package');
  fs.mkdirSync(pkgRoot, { recursive: true });
  const manifest = { name, version, main: 'index.js', ...def.manifest };
  fs.writeFileSync(path.join(pkgRoot, 'package.json'), JSON.stringify(manifest, null, 2));
  const files = def.files ?? { 'index.js': 'module.exports = { activate() {} };\n' };
  let unpacked = 0;
  for (const [rel, body] of Object.entries(files)) {
    const target = path.join(pkgRoot, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    unpacked += Buffer.byteLength(body);
  }
  const file = path.join(workDir, `${name.replace(/[@/]/g, '_')}-${version}.tgz`);
  execFileSync('tar', ['-czf', file, '-C', path.dirname(pkgRoot), 'package']);
  const data = fs.readFileSync(file);
  return {
    file,
    integrity: `sha512-${crypto.createHash('sha512').update(data).digest('base64')}`,
    shasum: crypto.createHash('sha1').update(data).digest('hex'),
    unpackedSize: unpacked,
  };
}

/**
 * Start a fake registry.
 *
 * @param options - Packages to serve and signing behaviour.
 */
export async function startFakeRegistry(options: FakeRegistryOptions): Promise<FakeRegistry & { publicKeyDer: string }> {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-fake-registry-'));
  const packages = new Map<string, FakePackage>();
  options.packages.forEach((p) => packages.set(p.name, p));
  const requests: string[] = [];
  const keyPair = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const publicKeyDer = keyPair.publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const signing = options.signing === undefined ? { keyid: 'SHA256:fake-test-key' } : options.signing;
  const tarballs = new Map<string, string>();
  let baseUrl = '';

  function packument(pkg: FakePackage): unknown {
    const versions: Record<string, unknown> = {};
    for (const [version, def] of Object.entries(pkg.versions)) {
      const tar = buildTarball(pkg.name, version, def, workDir);
      const tarballPath = `/${pkg.name}/-/${path.basename(pkg.name)}-${version}.tgz`;
      tarballs.set(tarballPath, tar.file);
      const dist: Record<string, unknown> = {
        tarball: `${baseUrl}${tarballPath}`,
        integrity: tar.integrity,
        shasum: tar.shasum,
        unpackedSize: tar.unpackedSize,
        fileCount: Object.keys(def.files ?? { 'index.js': '' }).length + 1,
      };
      if (signing) {
        const message = Buffer.from(`${pkg.name}@${version}:${tar.integrity}`);
        const good = crypto.sign('sha256', message, keyPair.privateKey);
        if (options.tamperSignatures) good[good.length - 1] ^= 0xff;
        dist.signatures = [{ keyid: signing.keyid, sig: good.toString('base64') }];
      }
      versions[version] = {
        name: pkg.name,
        version,
        main: 'index.js',
        ...def.manifest,
        ...(def.deprecated ? { deprecated: def.deprecated } : {}),
        dist,
      };
    }
    const latest = pkg.distTags?.latest ?? highest(Object.keys(pkg.versions));
    return {
      name: pkg.name,
      'dist-tags': { latest, ...pkg.distTags },
      versions,
      time: {
        created: '2025-01-01T00:00:00.000Z',
        modified: '2026-09-01T00:00:00.000Z',
        ...Object.fromEntries(Object.keys(pkg.versions).map((v) => [v, '2026-09-01T00:00:00.000Z'])),
      },
      ...pkg.packument,
    };
  }

  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    requests.push(req.url ?? '/');
    const send = (status: number, body: unknown, type = 'application/json'): void => {
      res.writeHead(status, { 'content-type': type });
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };

    if (options.failWith) return send(options.failWith, { error: 'simulated outage' });

    if (url === '/-/npm/v1/keys') {
      return send(
        200,
        signing
          ? {
              keys: [
                {
                  keyid: signing.keyid,
                  keytype: 'ecdsa-sha2-nistp256',
                  scheme: 'ecdsa-sha2-nistp256',
                  key: publicKeyDer,
                  expires: null,
                },
              ],
            }
          : { keys: [] }
      );
    }

    if (url === '/-/v1/search') {
      const objects =
        options.searchObjects ??
        [...packages.values()].map((p) => {
          const latest = p.distTags?.latest ?? highest(Object.keys(p.versions));
          return {
            package: {
              name: p.name,
              version: latest,
              description: String(p.versions[latest]?.manifest?.description ?? ''),
              keywords: (p.versions[latest]?.manifest?.keywords as string[] | undefined) ?? [],
              date: '2026-09-01T00:00:00.000Z',
              publisher: { username: 'tester' },
              links: {},
            },
            score: { final: 0.8, detail: { quality: 0.9, popularity: 0.5, maintenance: 0.95 } },
          };
        });
      return send(200, { objects, total: objects.length });
    }

    const tarball = tarballs.get(url);
    if (tarball) return send(200, fs.readFileSync(tarball), 'application/octet-stream');

    const name = url.replace(/^\//, '');
    const pkg = packages.get(name);
    if (pkg) return send(200, packument(pkg));

    return send(404, { error: 'not found' });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    url: baseUrl,
    requests,
    publicKeyDer,
    setPackage: (pkg) => packages.set(pkg.name, pkg),
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          fs.rmSync(workDir, { recursive: true, force: true });
          resolve();
        });
        server.closeAllConnections?.();
      }),
  };
}

/** Isolate npm's cache/config so tests never touch the user's ~/.npm. */
export function isolateNpm(dir: string): () => void {
  const previous = {
    cache: process.env.npm_config_cache,
    userconfig: process.env.NPM_CONFIG_USERCONFIG,
  };
  process.env.npm_config_cache = path.join(dir, 'npm-cache');
  process.env.NPM_CONFIG_USERCONFIG = path.join(dir, 'npmrc');
  fs.writeFileSync(path.join(dir, 'npmrc'), '');
  return () => {
    if (previous.cache === undefined) delete process.env.npm_config_cache;
    else process.env.npm_config_cache = previous.cache;
    if (previous.userconfig === undefined) delete process.env.NPM_CONFIG_USERCONFIG;
    else process.env.NPM_CONFIG_USERCONFIG = previous.userconfig;
  };
}
