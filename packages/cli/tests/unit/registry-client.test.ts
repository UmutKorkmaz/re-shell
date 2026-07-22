import { describe, it, expect, vi } from 'vitest';
import * as crypto from 'crypto';
import {
  DEFAULT_REGISTRY_URL,
  PLUGIN_KEYWORD,
  RegistryUnreachableError,
  RegistryClient,
  verifyRegistrySignature,
  type FetchLike,
  type FetchResponse,
  type RegistryVersion,
  type RegistryPackument,
} from '../../src/utils/registry-client';

/** Build an injectable fetch that resolves with a controlled JSON response. */
function makeFetch(
  body: unknown,
  opts: { ok?: boolean; status?: number; statusText?: string } = {},
): FetchLike & { mock: { calls: unknown[][] } } {
  const fn = vi.fn(async (): Promise<FetchResponse> => ({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: opts.statusText ?? 'OK',
    json: async () => body,
  }));
  return fn as unknown as FetchLike & { mock: { calls: unknown[][] } };
}

/** Build an injectable fetch whose response body fails to parse. */
function makeJsonErrorFetch(): FetchLike {
  return vi.fn(async (): Promise<FetchResponse> => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => {
      throw new SyntaxError('Unexpected token <');
    },
  })) as unknown as FetchLike;
}

/** Build an injectable fetch that rejects (transport failure). */
function makeThrowingFetch(error: unknown): FetchLike {
  return vi.fn(async (): Promise<FetchResponse> => {
    throw error;
  }) as unknown as FetchLike;
}

function packument(overrides: Partial<RegistryPackument> = {}): RegistryPackument {
  return {
    name: 'pkg',
    'dist-tags': { latest: '1.0.0' },
    versions: {
      '1.0.0': {
        name: 'pkg',
        version: '1.0.0',
        dist: { tarball: 'https://example.com/pkg.tgz' },
      } as RegistryVersion,
    },
    ...overrides,
  };
}

describe('constants & error type', () => {
  it('exposes the default registry origin and plugin keyword', () => {
    expect(DEFAULT_REGISTRY_URL).toBe('https://registry.npmjs.org');
    expect(PLUGIN_KEYWORD).toBe('reshell-plugin');
  });

  it('RegistryUnreachableError carries name and optional details', () => {
    const err = new RegistryUnreachableError('boom', { url: 'u' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('RegistryUnreachableError');
    expect(err.message).toBe('boom');
    expect(err.details).toEqual({ url: 'u' });
  });

  it('RegistryUnreachableError omits details when not provided', () => {
    const err = new RegistryUnreachableError('boom');
    expect(err.details).toBeUndefined();
  });
});

describe('RegistryClient constructor', () => {
  it('uses the default registry URL and strips a trailing slash from a custom one', () => {
    const c1 = new RegistryClient({ fetchImpl: makeFetch(packument()) });
    expect((c1 as unknown as { registryUrl: string }).registryUrl).toBe(
      DEFAULT_REGISTRY_URL,
    );
    const c2 = new RegistryClient({
      registryUrl: 'https://npm.example.com///',
      fetchImpl: makeFetch(packument()),
    });
    expect((c2 as unknown as { registryUrl: string }).registryUrl).toBe(
      'https://npm.example.com',
    );
  });

  it('falls back to globalThis.fetch when no fetchImpl is injected', () => {
    const g = makeFetch(packument());
    const prev = (globalThis as { fetch?: FetchLike }).fetch;
    (globalThis as { fetch?: FetchLike }).fetch = g;
    try {
      const c = new RegistryClient();
      // If the ctor accepted it, a search will not throw on missing impl.
      expect(c).toBeInstanceOf(RegistryClient);
    } finally {
      (globalThis as { fetch?: FetchLike }).fetch = prev;
    }
  });

  it('throws RegistryUnreachableError when no fetch implementation is available', () => {
    const prev = (globalThis as { fetch?: FetchLike }).fetch;
    (globalThis as { fetch?: FetchLike }).fetch = undefined;
    try {
      expect(() => new RegistryClient()).toThrow(RegistryUnreachableError);
      expect(() => new RegistryClient()).toThrow(/No fetch implementation/);
    } finally {
      (globalThis as { fetch?: FetchLike }).fetch = prev;
    }
  });
});

describe('RegistryClient.search', () => {
  it('appends the plugin keyword qualifier and clamps size, then maps hits', async () => {
    const fetchImpl = makeFetch({
      objects: [
        { package: { name: 'a', version: '1.0.0' } },
        { package: { name: 'b', version: '2.0.0', description: 'd' } },
      ],
    });
    const c = new RegistryClient({ fetchImpl });
    const hits = await c.search('foo', 10);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toEqual({ name: 'a', version: '1.0.0' });
    expect(hits[1].name).toBe('b');

    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain('/-/v1/search?text=');
    expect(calledUrl).toContain(encodeURIComponent('keywords:reshell-plugin'));
    expect(calledUrl).toContain('&size=10');
  });

  it('omits the free-text term but keeps the keyword qualifier when query is undefined', async () => {
    const fetchImpl = makeFetch({ objects: [] });
    const c = new RegistryClient({ fetchImpl });
    await c.search(undefined, 5);
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain('&size=5');
    expect(calledUrl).toContain(encodeURIComponent('keywords:reshell-plugin'));
  });

  it('clamps the size to the 1-250 window', async () => {
    const fetchImpl = makeFetch({ objects: [] });
    const c = new RegistryClient({ fetchImpl });
    await c.search('x', 9999);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('&size=250');
  });

  it('returns an empty array when objects is missing or not an array', async () => {
    const c = new RegistryClient({ fetchImpl: makeFetch({}) });
    expect(await c.search('x', 5)).toEqual([]);
  });

  it('filters out objects whose package is missing a string name', async () => {
    const fetchImpl = makeFetch({
      objects: [
        { package: { name: 'good', version: '1.0.0' } },
        { package: { version: '1.0.0' } }, // no name
        { package: undefined },
        { /* no package */ },
      ],
    });
    const c = new RegistryClient({ fetchImpl });
    const hits = await c.search('x', 5);
    expect(hits.map((h) => h.name)).toEqual(['good']);
  });
});

describe('RegistryClient.getPackument', () => {
  it('returns a valid packument', async () => {
    const fetchImpl = makeFetch(packument());
    const c = new RegistryClient({ fetchImpl });
    const doc = await c.getPackument('pkg');
    expect(doc.name).toBe('pkg');
    expect(doc.versions['1.0.0']).toBeDefined();
  });

  it('encodes scoped package names with the %40 -> @ rewrite', async () => {
    const fetchImpl = makeFetch(packument());
    const c = new RegistryClient({ fetchImpl });
    await c.getPackument('@scope/pkg');
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    // %40 is rewritten back to @, but the slash stays percent-encoded.
    expect(calledUrl).toContain('/@scope%2Fpkg');
  });

  it('throws RegistryUnreachableError on a malformed packument (missing name)', async () => {
    const fetchImpl = makeFetch({ versions: {} });
    const c = new RegistryClient({ fetchImpl });
    await expect(c.getPackument('pkg')).rejects.toThrow(RegistryUnreachableError);
    await expect(c.getPackument('pkg')).rejects.toThrow(/Malformed packument/);
  });

  it('throws RegistryUnreachableError on a malformed packument (missing versions)', async () => {
    const fetchImpl = makeFetch({ name: 'pkg' });
    const c = new RegistryClient({ fetchImpl });
    await expect(c.getPackument('pkg')).rejects.toThrow(/Malformed packument/);
  });
});

describe('RegistryClient.getVersion', () => {
  it('resolves the latest dist-tag by default', async () => {
    const fetchImpl = makeFetch(packument());
    const c = new RegistryClient({ fetchImpl });
    const v = await c.getVersion('pkg');
    expect(v.version).toBe('1.0.0');
  });

  it('resolves a concrete version present in versions', async () => {
    const doc = packument({
      versions: {
        '1.0.0': { name: 'pkg', version: '1.0.0', dist: { tarball: 'a' } },
        '2.0.0': { name: 'pkg', version: '2.0.0', dist: { tarball: 'b' } },
      },
    });
    const c = new RegistryClient({ fetchImpl: makeFetch(doc) });
    const v = await c.getVersion('pkg', '2.0.0');
    expect(v.version).toBe('2.0.0');
  });

  it('resolves a custom dist-tag', async () => {
    const doc = packument({
      'dist-tags': { latest: '1.0.0', beta: '2.0.0' },
      versions: {
        '1.0.0': { name: 'pkg', version: '1.0.0', dist: { tarball: 'a' } },
        '2.0.0': { name: 'pkg', version: '2.0.0', dist: { tarball: 'b' } },
      },
    });
    const c = new RegistryClient({ fetchImpl: makeFetch(doc) });
    const v = await c.getVersion('pkg', 'beta');
    expect(v.version).toBe('2.0.0');
  });

  it('falls back to the latest dist-tag when a concrete version is requested that is also a dist-tag name', async () => {
    // 'latest' is both the default tag and a dist-tag entry.
    const c = new RegistryClient({ fetchImpl: makeFetch(packument()) });
    const v = await c.getVersion('pkg', 'latest');
    expect(v.version).toBe('1.0.0');
  });

  it('throws when the requested tag cannot be resolved and there is no latest fallback', async () => {
    const doc = packument({ 'dist-tags': {} });
    const c = new RegistryClient({ fetchImpl: makeFetch(doc) });
    await expect(c.getVersion('pkg', 'missing-tag')).rejects.toThrow(
      RegistryUnreachableError,
    );
    await expect(c.getVersion('pkg', 'missing-tag')).rejects.toThrow(/not found/);
  });
});

describe('RegistryClient.getSigningKeys', () => {
  it('returns the keys array', async () => {
    const keys = [{ keyid: 'k1', keytype: 'webhook', key: 'abc' }];
    const c = new RegistryClient({ fetchImpl: makeFetch({ keys }) });
    expect(await c.getSigningKeys()).toEqual(keys);
  });

  it('returns an empty array when keys is missing or not an array', async () => {
    const c = new RegistryClient({ fetchImpl: makeFetch({}) });
    expect(await c.getSigningKeys()).toEqual([]);
  });
});

describe('RegistryClient transport error mapping', () => {
  it('wraps a fetch rejection in RegistryUnreachableError', async () => {
    const c = new RegistryClient({
      fetchImpl: makeThrowingFetch(new Error('ETIMEDOUT')),
    });
    await expect(c.getPackument('pkg')).rejects.toThrow(/Failed to reach registry/);
  });

  it('wraps a non-Error fetch rejection using String()', async () => {
    const c = new RegistryClient({ fetchImpl: makeThrowingFetch('string error') });
    await expect(c.getPackument('pkg')).rejects.toThrow(/string error/);
  });

  it('maps a non-OK HTTP status to RegistryUnreachableError with the status', async () => {
    const c = new RegistryClient({
      fetchImpl: makeFetch({}, { ok: false, status: 404, statusText: 'Not Found' }),
    });
    await expect(c.getPackument('pkg')).rejects.toThrow(/404 Not Found/);
  });

  it('maps a JSON parse failure to RegistryUnreachableError', async () => {
    const c = new RegistryClient({ fetchImpl: makeJsonErrorFetch() });
    await expect(c.getPackument('pkg')).rejects.toThrow(/Failed to parse/);
  });
});

describe('verifyRegistrySignature', () => {
  // Real Ed25519 keypair generated once for the verified:true path.
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const spkiB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const keyid = 'SHA256:real';

  function signedVersion(integrity: string): {
    version: RegistryVersion;
    sign: (msg: string) => string;
  } {
    const version: RegistryVersion = {
      name: 'pkg',
      version: '1.0.0',
      dist: {
        tarball: 'https://example.com/pkg.tgz',
        integrity,
        signatures: [],
      },
    };
    return {
      version,
      sign: (msg: string) =>
        crypto.sign(null, Buffer.from(msg), privateKey).toString('base64'),
    };
  }

  it('fails when the version has no signatures', () => {
    const v: RegistryVersion = {
      name: 'pkg',
      version: '1.0.0',
      dist: { tarball: 't', integrity: 'sha512-abc' },
    };
    const res = verifyRegistrySignature(v, []);
    expect(res.verified).toBe(false);
    expect(res.reason).toMatch(/no registry signatures/);
  });

  it('fails when the version has signatures but no integrity', () => {
    const v: RegistryVersion = {
      name: 'pkg',
      version: '1.0.0',
      dist: { tarball: 't', signatures: [{ keyid, sig: 'x' }] },
    };
    const res = verifyRegistrySignature(v, []);
    expect(res.verified).toBe(false);
    expect(res.reason).toMatch(/no dist.integrity/);
  });

  it('verifies a valid Ed25519 signature against the matching published key', () => {
    const { version, sign } = signedVersion('sha512-deadbeef');
    const msg = `pkg@1.0.0:sha512-deadbeef`;
    version.dist!.signatures = [{ keyid, sig: sign(msg) }];
    const keys = [{ keyid, keytype: 'webhook', key: spkiB64 }];
    const res = verifyRegistrySignature(version, keys);
    expect(res.verified).toBe(true);
    expect(res.keyid).toBe(keyid);
  });

  it('rejects a signature made for a different message', () => {
    const { version, sign } = signedVersion('sha512-deadbeef');
    version.dist!.signatures = [
      { keyid, sig: sign('pkg@1.0.0:sha512-TOTALLY-DIFFERENT') },
    ];
    const keys = [{ keyid, keytype: 'webhook', key: spkiB64 }];
    const res = verifyRegistrySignature(version, keys);
    expect(res.verified).toBe(false);
    expect(res.reason).toMatch(/no registry signature validated/);
  });

  it('skips a signature whose keyid is not in the published keys', () => {
    const { version, sign } = signedVersion('sha512-deadbeef');
    version.dist!.signatures = [{ keyid, sig: sign('pkg@1.0.0:sha512-deadbeef') }];
    // Published keys do not contain our keyid.
    const keys = [{ keyid: 'other', keytype: 'webhook', key: spkiB64 }];
    const res = verifyRegistrySignature(version, keys);
    expect(res.verified).toBe(false);
  });

  it('skips a signature whose key has expired', () => {
    const { version, sign } = signedVersion('sha512-deadbeef');
    version.dist!.signatures = [{ keyid, sig: sign('pkg@1.0.0:sha512-deadbeef') }];
    const keys = [
      {
        keyid,
        keytype: 'webhook',
        key: spkiB64,
        expires: new Date(Date.now() - 1000).toISOString(),
      },
    ];
    const res = verifyRegistrySignature(version, keys);
    expect(res.verified).toBe(false);
  });

  it('skips an unexpired key when expires is null and verifies', () => {
    const { version, sign } = signedVersion('sha512-deadbeef');
    version.dist!.signatures = [{ keyid, sig: sign('pkg@1.0.0:sha512-deadbeef') }];
    const keys = [
      { keyid, keytype: 'webhook', key: spkiB64, expires: null as unknown as string },
    ];
    const res = verifyRegistrySignature(version, keys);
    expect(res.verified).toBe(true);
  });

  it('does not throw on a malformed key and continues to the next signature', () => {
    const { version, sign } = signedVersion('sha512-deadbeef');
    const msg = 'pkg@1.0.0:sha512-deadbeef';
    version.dist!.signatures = [
      { keyid, sig: 'not-valid-base64-signature' },
      { keyid: 'good', sig: sign(msg) },
    ];
    const keys = [
      { keyid, keytype: 'webhook', key: '!!not-a-valid-der-key!!' },
      { keyid: 'good', keytype: 'webhook', key: spkiB64 },
    ];
    const res = verifyRegistrySignature(version, keys);
    expect(res.verified).toBe(true);
    expect(res.keyid).toBe('good');
  });
});
