import * as crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RegistryClient,
  RegistryUnreachableError,
  verifyRegistrySignature,
  type FetchLike,
  type FetchResponse,
  type RegistryVersion,
  type RegistryKey,
} from '../../src/utils/registry-client';
import {
  PluginMarketplace,
  isValidPluginId,
} from '../../src/utils/plugin-marketplace';

// The marketplace install path delegates to the real installer. We mock that
// module so NO network (npm pack/tarball) is touched in CI; the test asserts the
// delegation contract (identifier + options) instead.
vi.mock('../../src/utils/plugin-installer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/utils/plugin-installer')>();
  return {
    ...actual,
    installPluginFromIdentifier: vi.fn(async (identifier: string) => ({
      name: identifier.split('@').slice(0, -1).join('@') || identifier,
      version: identifier.split('@').pop() ?? '0.0.0',
      source: 'npm' as const,
      path: `/tmp/plugins/${identifier}`,
      dryRun: false,
    })),
  };
});

import { installPluginFromIdentifier } from '../../src/utils/plugin-installer';

// --- Mocked HTTP layer ----------------------------------------------------

function jsonResponse(body: unknown, ok = true, status = 200): FetchResponse {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => body,
  };
}

/** Build a fetch mock that routes registry URLs to canned payloads. */
function makeFetch(routes: Record<string, () => FetchResponse>): FetchLike {
  return vi.fn(async (url: string) => {
    for (const [pattern, handler] of Object.entries(routes)) {
      if (url.includes(pattern)) return handler();
    }
    return jsonResponse({ error: 'not found' }, false, 404);
  });
}

const SEARCH_PAYLOAD = {
  objects: [
    {
      package: {
        name: '@re-shell/sample-plugin',
        version: '1.2.0',
        description: 'A sample re-shell plugin',
        keywords: ['reshell-plugin', 'testing'],
        date: '2026-01-01T00:00:00Z',
        author: { name: 'Umut' },
        links: { homepage: 'https://example.com', repository: 'https://github.com/x/y' },
      },
    },
    {
      package: {
        name: 'reshell-plugin-deploy',
        version: '0.3.1',
        description: 'Deploy helper',
        keywords: ['reshell-plugin', 'deploy'],
        date: '2026-02-01T00:00:00Z',
      },
    },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('isValidPluginId', () => {
  it('accepts scoped and plain npm names', () => {
    expect(isValidPluginId('@re-shell/sample-plugin')).toBe(true);
    expect(isValidPluginId('reshell-plugin-deploy')).toBe(true);
  });
  it('rejects empty / illegal names', () => {
    expect(isValidPluginId('')).toBe(false);
    expect(isValidPluginId('Has Spaces')).toBe(false);
  });
});

describe('RegistryClient.search (mocked fetch)', () => {
  it('appends the reshell-plugin keyword qualifier and parses hits', async () => {
    const fetchImpl = makeFetch({ '/-/v1/search': () => jsonResponse(SEARCH_PAYLOAD) });
    const client = new RegistryClient({ fetchImpl });

    const hits = await client.search('deploy', 10);
    expect(hits).toHaveLength(2);
    expect(hits[0].name).toBe('@re-shell/sample-plugin');

    // The query string carried the keyword qualifier.
    const calledUrl = (fetchImpl as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(calledUrl).toContain('keywords%3Areshell-plugin');
    expect(calledUrl).toContain('deploy');
  });

  it('throws MARKETPLACE_UNREACHABLE-shaped error on transport failure', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const client = new RegistryClient({ fetchImpl });
    await expect(client.search('x', 10)).rejects.toBeInstanceOf(RegistryUnreachableError);
  });

  it('throws on non-OK HTTP status', async () => {
    const fetchImpl = makeFetch({ '/-/v1/search': () => jsonResponse({}, false, 503) });
    const client = new RegistryClient({ fetchImpl });
    await expect(client.search('x', 10)).rejects.toBeInstanceOf(RegistryUnreachableError);
  });
});

describe('PluginMarketplace.searchPlugins (mocked registry)', () => {
  it('maps registry hits to the marketplace plugin shape', async () => {
    const fetchImpl = makeFetch({ '/-/v1/search': () => jsonResponse(SEARCH_PAYLOAD) });
    const marketplace = new PluginMarketplace({ fetchImpl, verifySignatures: false });

    const result = await marketplace.searchPlugins({ limit: 10 });
    expect(result.total).toBe(2);
    const first = result.plugins[0];
    expect(first.name).toBe('@re-shell/sample-plugin');
    expect(first.version).toBe('1.2.0');
    expect(first.author).toBe('Umut');
    expect(first.homepage).toBe('https://example.com');
    expect(first.keywords).toContain('reshell-plugin');
    // Search results are conservatively unverified (no signature known yet).
    expect(first.verified).toBe(false);
  });

  it('propagates MARKETPLACE_UNREACHABLE on network error (no mock fallback)', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('network down');
    });
    const marketplace = new PluginMarketplace({ fetchImpl });
    await expect(marketplace.searchPlugins({})).rejects.toBeInstanceOf(RegistryUnreachableError);
  });
});

describe('PluginMarketplace.getPlugin (mocked registry)', () => {
  const PACKUMENT = {
    name: '@re-shell/sample-plugin',
    'dist-tags': { latest: '1.2.0' },
    time: { created: '2025-01-01T00:00:00Z', modified: '2026-01-01T00:00:00Z' },
    versions: {
      '1.2.0': {
        name: '@re-shell/sample-plugin',
        version: '1.2.0',
        description: 'A sample re-shell plugin',
        license: 'MIT',
        keywords: ['reshell-plugin'],
        dependencies: { chalk: '^5.0.0' },
        dist: { tarball: 'https://r/t.tgz', integrity: 'sha512-abc', signatures: [{ keyid: 'k', sig: 's' }] },
      },
    },
  };

  it('maps the packument latest version to a plugin', async () => {
    const fetchImpl = makeFetch({ 'sample-plugin': () => jsonResponse(PACKUMENT) });
    const marketplace = new PluginMarketplace({ fetchImpl });
    const plugin = await marketplace.getPlugin('@re-shell/sample-plugin');
    expect(plugin).not.toBeNull();
    expect(plugin?.version).toBe('1.2.0');
    expect(plugin?.license).toBe('MIT');
    expect(plugin?.dependencies).toEqual({ chalk: '^5.0.0' });
    // Has signatures => marked as signed.
    expect(plugin?.verified).toBe(true);
  });

  it('returns null on a genuine 404', async () => {
    const fetchImpl = makeFetch({}); // everything 404s
    const marketplace = new PluginMarketplace({ fetchImpl });
    expect(await marketplace.getPlugin('does-not-exist')).toBeNull();
  });
});

describe('verifyRegistrySignature (real crypto, no network)', () => {
  function makeSignedVersion(): { version: RegistryVersion; keys: RegistryKey[] } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const name = '@re-shell/sample-plugin';
    const ver = '1.2.0';
    const integrity = 'sha512-deadbeef';
    const message = Buffer.from(`${name}@${ver}:${integrity}`);
    const sig = crypto.sign(null, message, privateKey).toString('base64');
    const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');

    const version: RegistryVersion = {
      name,
      version: ver,
      dist: { tarball: 'https://r/t.tgz', integrity, signatures: [{ keyid: 'key-1', sig }] },
    };
    const keys: RegistryKey[] = [{ keyid: 'key-1', keytype: 'ecdsa-sha2-nistp256', key: spki }];
    return { version, keys };
  }

  it('verifies a correctly signed version', () => {
    const { version, keys } = makeSignedVersion();
    const result = verifyRegistrySignature(version, keys);
    expect(result.verified).toBe(true);
    expect(result.keyid).toBe('key-1');
  });

  it('rejects when the signature does not match the key', () => {
    const { version } = makeSignedVersion();
    const other = crypto.generateKeyPairSync('ed25519').publicKey;
    const keys: RegistryKey[] = [
      { keyid: 'key-1', keytype: 'x', key: other.export({ format: 'der', type: 'spki' }).toString('base64') },
    ];
    expect(verifyRegistrySignature(version, keys).verified).toBe(false);
  });

  it('rejects an unsigned version (no signatures)', () => {
    const version: RegistryVersion = {
      name: 'x',
      version: '1.0.0',
      dist: { tarball: 't', integrity: 'sha512-x' },
    };
    const result = verifyRegistrySignature(version, []);
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/unsigned|no registry signatures/i);
  });

  it('rejects when no matching key is published', () => {
    const { version } = makeSignedVersion();
    expect(verifyRegistrySignature(version, []).verified).toBe(false);
  });
});

describe('PluginMarketplace.installPlugin signature gating (mocked registry)', () => {
  function signedPackument() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const name = '@re-shell/sample-plugin';
    const ver = '1.2.0';
    const integrity = 'sha512-deadbeef';
    const message = Buffer.from(`${name}@${ver}:${integrity}`);
    const sig = crypto.sign(null, message, privateKey).toString('base64');
    const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
    return {
      packument: {
        name,
        'dist-tags': { latest: ver },
        versions: {
          [ver]: {
            name,
            version: ver,
            dist: { tarball: 'https://r/t.tgz', integrity, signatures: [{ keyid: 'key-1', sig }] },
          },
        },
      },
      keys: { keys: [{ keyid: 'key-1', keytype: 'x', key: spki }] },
    };
  }

  it('verifySignatures:true + unsigned => REJECTED (not installed)', async () => {
    const packument = {
      name: '@re-shell/sample-plugin',
      'dist-tags': { latest: '1.2.0' },
      versions: {
        '1.2.0': {
          name: '@re-shell/sample-plugin',
          version: '1.2.0',
          // No signatures => unsigned.
          dist: { tarball: 'https://r/t.tgz', integrity: 'sha512-x' },
        },
      },
    };
    const fetchImpl = makeFetch({
      '/-/npm/v1/keys': () => jsonResponse({ keys: [] }),
      'sample-plugin': () => jsonResponse(packument),
    });
    const marketplace = new PluginMarketplace({ fetchImpl, verifySignatures: true });

    const result = await marketplace.installPlugin('@re-shell/sample-plugin');
    expect(result.success).toBe(false);
    expect(result.errors.join(' ')).toMatch(/unverified|unsigned/i);
    // The installer must NOT have been invoked for a rejected plugin.
    expect(installPluginFromIdentifier).not.toHaveBeenCalled();
  });

  it('verifySignatures:true + valid signature => delegates to the installer', async () => {
    const { packument, keys } = signedPackument();
    const fetchImpl = makeFetch({
      '/-/npm/v1/keys': () => jsonResponse(keys),
      'sample-plugin': () => jsonResponse(packument),
    });
    const marketplace = new PluginMarketplace({
      fetchImpl,
      verifySignatures: true,
      workspaceRoot: '/tmp/ws',
    });

    const result = await marketplace.installPlugin('@re-shell/sample-plugin');
    expect(result.success).toBe(true);
    expect(result.signature.verified).toBe(true);
    expect(installPluginFromIdentifier).toHaveBeenCalledWith(
      '@re-shell/sample-plugin@1.2.0',
      expect.objectContaining({ workspaceRoot: '/tmp/ws' })
    );
  });

  it('verifySignatures:false => installs unsigned but warns honestly', async () => {
    const packument = {
      name: '@re-shell/sample-plugin',
      'dist-tags': { latest: '1.2.0' },
      versions: {
        '1.2.0': {
          name: '@re-shell/sample-plugin',
          version: '1.2.0',
          dist: { tarball: 'https://r/t.tgz', integrity: 'sha512-x' },
        },
      },
    };
    const fetchImpl = makeFetch({ 'sample-plugin': () => jsonResponse(packument) });
    const marketplace = new PluginMarketplace({ fetchImpl, verifySignatures: false });

    const result = await marketplace.installPlugin('@re-shell/sample-plugin');
    expect(result.success).toBe(true);
    expect(result.signature.gated).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/disabled/i);
    expect(installPluginFromIdentifier).toHaveBeenCalled();
  });

  it('propagates MARKETPLACE_UNREACHABLE when the registry is down during install', async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error('offline');
    });
    const marketplace = new PluginMarketplace({ fetchImpl, verifySignatures: true });
    await expect(marketplace.installPlugin('@re-shell/sample-plugin')).rejects.toBeInstanceOf(
      RegistryUnreachableError
    );
  });
});
