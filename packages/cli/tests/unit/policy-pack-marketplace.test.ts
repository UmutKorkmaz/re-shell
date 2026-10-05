import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  policyInstallResponseSchema,
  policyListResponseSchema,
  policySearchResponseSchema,
  policyRemoveResponseSchema,
} from '@re-shell/contracts';
import {
  PolicyPackError,
  installPolicyPack,
  listPolicyPacks,
  removePolicyPack,
  searchPolicyPacks,
} from '../../src/utils/policy-pack-marketplace';
import {
  findInstalledPack,
  isValidPackName,
  packDirName,
  policyPackIndexPath,
  readPackIndex,
  sha256,
  PolicyPackStoreError,
} from '../../src/utils/policy-pack-store';
import { evaluatePolicyPack, resolvePolicyPackWithSource } from '../../src/utils/policy-engine';
import { RegistryUnreachableError, type FetchLike } from '../../src/utils/registry-client';
import { isolateNpm, startFakeRegistry, type FakeRegistry } from '../utils/fake-registry';

let tmp: string;
let ws: string;

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-policy-')));
  ws = path.join(tmp, 'ws');
  await fs.ensureDir(ws);
});

afterEach(async () => {
  await fs.remove(tmp);
});

const PACK_YAML = `name: acme-strict
description: ACME strict rules
rules:
  - id: needs-test
    type: required-scripts
    severity: error
    scripts: [test]
  - id: mit-only
    type: license
    severity: warning
    allowed: [MIT]
`;

/** A pack package directory: package.json with the reshell-policy-pack key + the pack file. */
async function packagePack(
  dir: string,
  over: { manifest?: Record<string, unknown>; file?: string; content?: string } = {}
): Promise<string> {
  const root = path.join(tmp, dir);
  const file = over.file ?? 'policy/pack.yml';
  await fs.outputFile(path.join(root, file), over.content ?? PACK_YAML);
  await fs.writeJSON(path.join(root, 'package.json'), {
    name: '@acme/reshell-policy-pack',
    version: '1.2.0',
    keywords: ['reshell-policy-pack'],
    'reshell-policy-pack': file,
    ...over.manifest,
  });
  return root;
}

const install = (identifier: string, over: Partial<Parameters<typeof installPolicyPack>[1]> = {}) =>
  installPolicyPack(identifier, { workspaceRoot: ws, verifySignatures: false, ...over });

describe('installPolicyPack: from a package directory', () => {
  it('validates the pack, stores only the pack file, and records provenance + sha256', async () => {
    const dir = await packagePack('pkg');
    await fs.writeFile(path.join(dir, 'README.md'), 'not copied');

    const result = await install(dir);

    expect(result).toMatchObject({
      name: 'acme-strict',
      version: '1.2.0',
      source: 'local',
      package: '@acme/reshell-policy-pack',
      ruleCount: 2,
      replaced: false,
      dryRun: false,
      // Signatures only exist for registry packages; a local directory has none to check.
      signature: null,
      warnings: [],
    });
    expect(result.path).toBe(path.join(ws, '.re-shell', 'policy-packs', 'acme-strict', 'pack.yml'));
    expect(await fs.readFile(result.path, 'utf8')).toBe(PACK_YAML);
    expect(result.sha256).toBe(sha256(PACK_YAML));
    // Only the validated pack file is stored - not the package.
    expect(await fs.readdir(path.dirname(result.path))).toEqual(['pack.yml']);
    expect(policyInstallResponseSchema.safeParse({ ...result, warnings: undefined }).success).toBe(true);

    const index = await readPackIndex(ws);
    expect(index.packs['acme-strict']).toMatchObject({
      name: 'acme-strict',
      description: 'ACME strict rules',
      version: '1.2.0',
      source: 'local',
      package: '@acme/reshell-policy-pack',
      spec: dir,
      file: 'acme-strict/pack.yml',
      sha256: sha256(PACK_YAML),
      ruleCount: 2,
    });
    expect(typeof index.packs['acme-strict'].installedAt).toBe('string');
  });

  it('accepts a JSON pack file and keeps its extension', async () => {
    const json = JSON.stringify({ name: 'json-pack', rules: [{ id: 'r', type: 'required-files', files: ['README.md'] }] });
    const dir = await packagePack('pkg', { file: 'rules.json', content: json, manifest: { name: 'json-pack-pkg' } });
    const result = await install(dir);
    expect(result.path.endsWith(path.join('json-pack', 'pack.json'))).toBe(true);
    expect(result.ruleCount).toBe(1);
  });

  it('warns when the package lacks the discoverability keyword', async () => {
    const dir = await packagePack('pkg', { manifest: { keywords: ['other'] } });
    const result = await install(dir);
    expect(result.warnings.some((w) => w.includes('reshell-policy-pack" keyword'))).toBe(true);
  });

  it('dry-run validates and reports but writes nothing', async () => {
    const dir = await packagePack('pkg');
    const result = await install(dir, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.ruleCount).toBe(2);
    expect(await fs.pathExists(path.join(ws, '.re-shell'))).toBe(false);
  });

  it('refuses to replace an installed pack without --force, and replaces with it', async () => {
    const dir = await packagePack('pkg');
    const first = await install(dir);
    const firstRecord = (await readPackIndex(ws)).packs['acme-strict'];

    await expect(install(dir)).rejects.toMatchObject({ code: 'exists' });

    await new Promise((r) => setTimeout(r, 5));
    const changed = PACK_YAML.replace('[MIT]', '[MIT, Apache-2.0]');
    await fs.writeFile(path.join(dir, 'policy', 'pack.yml'), changed);
    const second = await install(dir, { force: true });

    expect(second.replaced).toBe(true);
    expect(second.sha256).toBe(sha256(changed));
    expect(second.path).toBe(first.path);
    expect(await fs.readFile(second.path, 'utf8')).toBe(changed);
    const record = (await readPackIndex(ws)).packs['acme-strict'];
    expect(record.installedAt).toBe(firstRecord.installedAt);
    expect(typeof record.updatedAt).toBe('string');
    // no staging leftovers
    expect(await fs.readdir(path.join(ws, '.re-shell', 'policy-packs'))).toEqual(['acme-strict', 'index.json']);
  });
});

describe('installPolicyPack: from a bare pack file', () => {
  it('installs a .yml / .yaml / .json file as a local pack', async () => {
    const file = path.join(tmp, 'solo.yaml');
    await fs.writeFile(file, PACK_YAML);
    const result = await install(file);
    expect(result).toMatchObject({ name: 'acme-strict', source: 'local', package: null, version: null });
    expect((await readPackIndex(ws)).packs['acme-strict'].spec).toBe(file);
  });

  it('rejects a file with an unsupported extension', async () => {
    const file = path.join(tmp, 'rules.txt');
    await fs.writeFile(file, PACK_YAML);
    await expect(install(file)).rejects.toMatchObject({ code: 'invalid-pack' });
  });
});

describe('installPolicyPack: validation failures leave nothing behind', () => {
  async function expectRefused(dir: string, code: string, message: RegExp): Promise<void> {
    const error = await install(dir).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PolicyPackError);
    expect(error).toMatchObject({ code });
    expect((error as Error).message).toMatch(message);
    expect(await fs.pathExists(path.join(ws, '.re-shell', 'policy-packs'))).toBe(false);
  }

  it('a package without the reshell-policy-pack key is not a pack', async () => {
    const dir = await packagePack('pkg');
    const manifest = await fs.readJSON(path.join(dir, 'package.json'));
    delete manifest['reshell-policy-pack'];
    await fs.writeJSON(path.join(dir, 'package.json'), manifest);
    await expectRefused(dir, 'not-a-pack', /no "reshell-policy-pack" key/);
  });

  it('a package whose directory has no package.json is not a pack', async () => {
    const dir = path.join(tmp, 'empty');
    await fs.ensureDir(dir);
    await expectRefused(dir, 'not-a-pack', /No package\.json/);
  });

  it.each([
    ['an absolute path', '/etc/passwd', /inside the package/],
    ['a parent traversal', '../outside.yml', /outside the package/],
    ['a non-pack extension', 'policy/pack.txt', /\.json, \.yml or \.yaml/],
    ['a missing file', 'policy/nope.yml', /does not exist/],
  ])('rejects %s in the manifest key', async (_label, key, message) => {
    const dir = await packagePack('pkg', { manifest: { 'reshell-policy-pack': key } });
    await fs.outputFile(path.join(tmp, 'outside.yml'), PACK_YAML);
    await fs.outputFile(path.join(dir, 'policy', 'pack.txt'), PACK_YAML);
    await expectRefused(dir, 'invalid-pack', message);
  });

  it('rejects a pack file that is a symlink to something outside the package', async () => {
    const dir = await packagePack('pkg', { manifest: { 'reshell-policy-pack': 'link.yml' } });
    const secret = path.join(tmp, 'secret.yml');
    await fs.writeFile(secret, PACK_YAML);
    await fs.symlink(secret, path.join(dir, 'link.yml'));
    await expectRefused(dir, 'invalid-pack', /resolves outside the package/);
  });

  it('rejects content that is not valid YAML/JSON or fails the pack schema', async () => {
    await expectRefused(await packagePack('p1', { content: 'a: [unclosed' }), 'invalid-pack', /Invalid policy pack/);
    await expectRefused(await packagePack('p2', { content: 'name: x\nrules: []\n' }), 'invalid-pack', /rules/);
    await expectRefused(
      await packagePack('p3', { content: 'name: x\nrules:\n  - id: r\n    type: unknown-type\n' }),
      'invalid-pack',
      /Invalid policy pack/
    );
    await expectRefused(await packagePack('p4', { content: '- just\n- a list\n' }), 'invalid-pack', /Invalid policy pack/);
  });

  it('rejects a naming rule with an invalid or oversized regular expression at install time', async () => {
    const bad = `name: bad-re\nrules:\n  - id: n\n    type: naming\n    pattern: "(unclosed"\n`;
    await expectRefused(await packagePack('p1', { content: bad }), 'invalid-pack', /pattern must be a valid regular expression/);
    const huge = `name: huge-re\nrules:\n  - id: n\n    type: naming\n    pattern: "${'a'.repeat(600)}"\n`;
    await expectRefused(await packagePack('p2', { content: huge }), 'invalid-pack', /at most 512/);
  });

  it('rejects an oversized pack file', async () => {
    const big = `name: big\nrules:\n  - id: r\n    type: required-files\n    files: [${'"x",'.repeat(300000)}"y"]\n`;
    await expectRefused(await packagePack('pkg', { content: big }), 'invalid-pack', /too large/);
  });

  it.each([
    ['..', /not valid/],
    ['a/../b', /not valid/],
    ['bad name', /not valid/],
    ['', /name/],
  ])('rejects the pack name %j', async (name, message) => {
    const content = `name: ${JSON.stringify(name)}\nrules:\n  - id: r\n    type: required-files\n    files: [README.md]\n`;
    await expectRefused(await packagePack('pkg', { content }), 'invalid-pack', message);
  });

  it('refuses to shadow a built-in pack', async () => {
    const content = PACK_YAML.replace('acme-strict', 'recommended');
    await expectRefused(await packagePack('pkg', { content }), 'reserved-name', /built-in/);
  });

  it('refuses a name whose directory collides with a different installed pack', async () => {
    await install(await packagePack('a', { content: PACK_YAML.replace('acme-strict', '"@a/shared"') }));
    const error = await install(await packagePack('b', { content: PACK_YAML.replace('acme-strict', 'a__shared') })).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'exists', details: { conflictsWith: '@a/shared' } });
  });
});

describe('installPolicyPack: from git (real git, local repository)', () => {
  it('clones the repository, validates and installs the pack', async () => {
    const repo = path.join(tmp, 'repo');
    await packagePack('repo');
    const git = (...args: string[]) =>
      execFileSync('git', args, {
        cwd: repo,
        env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x.io', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x.io' },
      });
    git('init', '--quiet', '-b', 'main');
    git('add', '-A');
    git('commit', '--quiet', '-m', 'pack');

    const result = await install(`git+file://${repo}`);
    expect(result).toMatchObject({ name: 'acme-strict', source: 'git', version: '1.2.0' });
    expect(await fs.readFile(result.path, 'utf8')).toBe(PACK_YAML);
    expect((await readPackIndex(ws)).packs['acme-strict'].spec).toBe(`git+file://${repo}`);
  });

  it('reports a failing clone as a source error', async () => {
    await expect(install(`git+file://${path.join(tmp, 'no-such-repo')}`)).rejects.toMatchObject({ code: 'source-error' });
  });
});

describe('installPolicyPack: from npm (real npm pack against a local registry)', () => {
  let registry: FakeRegistry;
  let unsigned: FakeRegistry;
  let tampered: FakeRegistry;
  let restoreNpm: () => void;

  const packages = (extraKeywords: string[] = ['reshell-policy-pack']) => [
    {
      name: '@acme/reshell-policy-pack',
      versions: {
        '1.0.0': {
          manifest: {
            keywords: extraKeywords,
            'reshell-policy-pack': 'policy/pack.yml',
            description: 'ACME pack',
          },
          files: { 'policy/pack.yml': PACK_YAML.replace('[MIT]', '[ISC]') },
        },
        '1.2.0': {
          manifest: { keywords: extraKeywords, 'reshell-policy-pack': 'policy/pack.yml', description: 'ACME pack' },
          files: { 'policy/pack.yml': PACK_YAML },
        },
      },
    },
  ];

  beforeAll(async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-policy-npm-'));
    restoreNpm = isolateNpm(dir);
    registry = await startFakeRegistry({ packages: packages() });
    unsigned = await startFakeRegistry({ packages: packages(), signing: false });
    tampered = await startFakeRegistry({ packages: packages(), tamperSignatures: true });
  });

  afterAll(async () => {
    await Promise.all([registry.close(), unsigned.close(), tampered.close()]);
    restoreNpm();
  });

  it('installs the latest version, verifying its registry signature when required', async () => {
    const result = await install('@acme/reshell-policy-pack', { registryUrl: registry.url, verifySignatures: true });
    expect(result).toMatchObject({
      name: 'acme-strict',
      version: '1.2.0',
      source: 'npm',
      package: '@acme/reshell-policy-pack',
      signature: { verified: true, gated: true, keyid: 'SHA256:fake-test-key' },
      warnings: [],
    });
    expect(await fs.readFile(result.path, 'utf8')).toBe(PACK_YAML);

    const record = (await readPackIndex(ws)).packs['acme-strict'];
    expect(record.integrity).toMatch(/^sha512-/);
    expect(record.signature).toMatchObject({ verified: true, gated: true, keyid: 'SHA256:fake-test-key' });
  });

  it('installs exactly the version whose signature was verified (name@range and name@version)', async () => {
    const exact = await install('@acme/reshell-policy-pack@1.0.0', { registryUrl: registry.url, verifySignatures: true });
    expect(exact.version).toBe('1.0.0');
    expect(await fs.readFile(exact.path, 'utf8')).toContain('[ISC]');

    const ranged = await install('@acme/reshell-policy-pack@^1.0.0', { registryUrl: registry.url, verifySignatures: true, force: true });
    expect(ranged.version).toBe('1.2.0');
  });

  it('refuses an unsigned pack when verification is required, without downloading the tarball', async () => {
    const error = await install('@acme/reshell-policy-pack', { registryUrl: unsigned.url, verifySignatures: true }).catch((e: unknown) => e);
    expect(error).toMatchObject({ code: 'unverified' });
    expect((error as Error).message).toMatch(/Refusing to install unverified policy pack "@acme\/reshell-policy-pack@1\.2\.0"/);
    expect(unsigned.requests.some((r) => r.endsWith('.tgz'))).toBe(false);
    expect(await fs.pathExists(path.join(ws, '.re-shell'))).toBe(false);
  });

  it('refuses a pack whose signature does not verify', async () => {
    await expect(
      install('@acme/reshell-policy-pack', { registryUrl: tampered.url, verifySignatures: true })
    ).rejects.toMatchObject({ code: 'unverified' });
    expect(tampered.requests.some((r) => r.endsWith('.tgz'))).toBe(false);
  });

  it('installs an unsigned pack when verification is explicitly disabled, and says so', async () => {
    const result = await install('@acme/reshell-policy-pack', { registryUrl: unsigned.url, verifySignatures: false });
    expect(result.signature).toEqual({ verified: false, gated: false });
    expect(result.warnings.join(' ')).toMatch(/Signature verification disabled/);
  });

  it('cannot verify a non-registry npm spec (tarball URL) and refuses unless verification is off', async () => {
    await expect(
      install('https://example.com/pack.tgz', { registryUrl: registry.url, verifySignatures: true })
    ).rejects.toMatchObject({ code: 'unverified' });
  });

  it('reports an unreachable registry as RegistryUnreachableError, not as an invalid pack', async () => {
    const dead = await startFakeRegistry({ packages: [], failWith: 503 });
    try {
      await expect(install('@acme/reshell-policy-pack', { registryUrl: dead.url, verifySignatures: true })).rejects.toBeInstanceOf(
        RegistryUnreachableError
      );
    } finally {
      await dead.close();
    }
  });

  it('fails clearly for a package that is not a policy pack', async () => {
    const plain = await startFakeRegistry({
      packages: [{ name: 'plain-lib', versions: { '1.0.0': { manifest: {} } } }],
    });
    try {
      await expect(install('plain-lib', { registryUrl: plain.url, verifySignatures: true })).rejects.toMatchObject({ code: 'not-a-pack' });
    } finally {
      await plain.close();
    }
  });
});

describe('searchPolicyPacks (mocked registry fetch)', () => {
  const SEARCH = {
    objects: [
      {
        package: {
          name: '@acme/reshell-policy-pack',
          version: '1.2.0',
          description: 'ACME rules',
          keywords: ['reshell-policy-pack', 'acme'],
          date: '2026-09-01T00:00:00.000Z',
          publisher: { username: 'acme-bot' },
          links: { homepage: 'https://acme.example', repository: 'https://github.com/acme/policy' },
        },
      },
      // A registry that ignores the keyword qualifier must not leak unrelated packages.
      { package: { name: 'unrelated', version: '9.9.9', description: 'x', keywords: ['other'] } },
      { package: { name: 'bare-pack', version: '0.1.0', keywords: ['reshell-policy-pack'] } },
    ],
  };

  const fetchOk = (calls: string[]): FetchLike =>
    (async (url: string) => {
      calls.push(url);
      return { ok: true, status: 200, statusText: 'OK', json: async () => SEARCH };
    }) as FetchLike;

  it('queries the reshell-policy-pack keyword and maps hits to the contract shape', async () => {
    const calls: string[] = [];
    const hits = await searchPolicyPacks('acme', { fetchImpl: fetchOk(calls), limit: 7 });

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0]);
    expect(url.pathname).toBe('/-/v1/search');
    expect(url.searchParams.get('text')).toBe('acme keywords:reshell-policy-pack');
    expect(url.searchParams.get('size')).toBe('7');

    expect(hits).toEqual([
      {
        name: '@acme/reshell-policy-pack',
        version: '1.2.0',
        description: 'ACME rules',
        keywords: ['reshell-policy-pack', 'acme'],
        publisher: 'acme-bot',
        date: '2026-09-01T00:00:00.000Z',
        homepage: 'https://acme.example',
        repository: 'https://github.com/acme/policy',
      },
      {
        name: 'bare-pack',
        version: '0.1.0',
        description: '',
        keywords: ['reshell-policy-pack'],
        publisher: null,
        date: null,
        homepage: null,
        repository: null,
      },
    ]);
    expect(policySearchResponseSchema.safeParse({ query: 'acme', packs: hits, total: hits.length }).success).toBe(true);
  });

  it('searches without a query', async () => {
    const calls: string[] = [];
    await searchPolicyPacks(undefined, { fetchImpl: fetchOk(calls) });
    expect(new URL(calls[0]).searchParams.get('text')).toBe('keywords:reshell-policy-pack');
  });

  it('raises RegistryUnreachableError on transport failure or a non-OK status', async () => {
    const down: FetchLike = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(searchPolicyPacks('x', { fetchImpl: down })).rejects.toBeInstanceOf(RegistryUnreachableError);
    const unavailable: FetchLike = vi.fn(async () => ({ ok: false, status: 503, statusText: 'Unavailable', json: async () => ({}) }));
    await expect(searchPolicyPacks('x', { fetchImpl: unavailable })).rejects.toBeInstanceOf(RegistryUnreachableError);
  });

  it('hits a real (local) registry end to end', async () => {
    const registry = await startFakeRegistry({
      packages: [
        { name: 'reshell-policy-demo', versions: { '1.0.0': { manifest: { keywords: ['reshell-policy-pack'], description: 'demo pack' } } } },
        { name: 'not-a-pack', versions: { '1.0.0': { manifest: { keywords: ['x'] } } } },
      ],
    });
    try {
      const hits = await searchPolicyPacks('demo', { registryUrl: registry.url });
      expect(hits.map((h) => h.name)).toEqual(['reshell-policy-demo']);
      expect(registry.requests[0]).toContain('keywords%3Areshell-policy-pack');
    } finally {
      await registry.close();
    }
  });
});

describe('listPolicyPacks / removePolicyPack', () => {
  it('lists the built-ins first, then installed packs, and conforms to the contract', async () => {
    await install(await packagePack('pkg'));
    const listed = await listPolicyPacks(ws);

    expect(listed.packs.map((p) => `${p.source}:${p.name}`)).toEqual([
      'builtin:recommended',
      'builtin:baseline',
      'local:acme-strict',
    ]);
    expect(listed.total).toBe(3);
    expect(listed.warnings).toEqual([]);
    expect(listed.packs[0]).toMatchObject({ path: null, sha256: null, version: null, ruleCount: 4 });
    expect(listed.packs[2]).toMatchObject({ version: '1.2.0', package: '@acme/reshell-policy-pack', ruleCount: 2 });
    expect(policyListResponseSchema.safeParse({ packs: listed.packs, total: listed.total }).success).toBe(true);
  });

  it('lists only built-ins in a fresh workspace without creating files', async () => {
    const listed = await listPolicyPacks(ws);
    expect(listed.packs.map((p) => p.name)).toEqual(['recommended', 'baseline']);
    expect(await fs.pathExists(path.join(ws, '.re-shell'))).toBe(false);
  });

  it('warns about an installed pack that was modified or deleted after install', async () => {
    const result = await install(await packagePack('pkg'));
    await fs.appendFile(result.path, '# tampered\n');
    expect((await listPolicyPacks(ws)).warnings[0]).toMatch(/modified after it was installed/);

    await fs.remove(result.path);
    expect((await listPolicyPacks(ws)).warnings[0]).toMatch(/missing its file/);
  });

  it('removes an installed pack and its directory', async () => {
    const result = await install(await packagePack('pkg'));
    const removed = await removePolicyPack(ws, 'acme-strict');
    expect(removed).toEqual({ name: 'acme-strict', removed: [path.dirname(result.path)] });
    expect(policyRemoveResponseSchema.safeParse(removed).success).toBe(true);
    expect(await fs.pathExists(path.dirname(result.path))).toBe(false);
    expect((await readPackIndex(ws)).packs).toEqual({});
    await expect(removePolicyPack(ws, 'acme-strict')).rejects.toMatchObject({ code: 'not-found' });
  });

  it('never removes a built-in pack', async () => {
    await expect(removePolicyPack(ws, 'recommended')).rejects.toMatchObject({ code: 'reserved-name' });
  });

  it('a corrupt index is an error, never silently replaced', async () => {
    await fs.outputFile(policyPackIndexPath(ws), '{ nope');
    await expect(listPolicyPacks(ws)).rejects.toBeInstanceOf(PolicyPackStoreError);
    await expect(install(await packagePack('pkg'))).rejects.toBeInstanceOf(PolicyPackStoreError);
    expect(await fs.readFile(policyPackIndexPath(ws), 'utf8')).toBe('{ nope');
  });
});

describe('installed packs drive `policy check`', () => {
  const VIOLATING = path.resolve(__dirname, '..', 'fixtures', 'policy-violating');

  async function workspaceWithPack(): Promise<string> {
    const root = path.join(tmp, 'monorepo');
    await fs.copy(VIOLATING, root);
    await install(await packagePack('pkg'), { workspaceRoot: root });
    return root;
  }

  it('resolves an installed pack by pack name and by package name, and evaluates it', async () => {
    const root = await workspaceWithPack();

    const byName = await resolvePolicyPackWithSource('acme-strict', root);
    expect(byName.source).toBe('installed');
    expect(byName.installed).toMatchObject({ name: 'acme-strict', package: '@acme/reshell-policy-pack' });

    const byPackage = await resolvePolicyPackWithSource('@acme/reshell-policy-pack', root);
    expect(byPackage.pack.name).toBe('acme-strict');

    const result = await evaluatePolicyPack(byName.pack, root);
    expect(result.pack).toBe('acme-strict');
    expect(result.hasErrors).toBe(true);
    expect(result.failed.some((f) => f.ruleId === 'needs-test')).toBe(true);
  });

  it('prefers built-in names, then installed packs, then files', async () => {
    const root = await workspaceWithPack();
    expect((await resolvePolicyPackWithSource('baseline', root)).source).toBe('builtin');
    expect((await resolvePolicyPackWithSource(undefined, root)).source).toBe('builtin');
    expect((await resolvePolicyPackWithSource('acme-strict', root)).source).toBe('installed');

    const file = path.join(root, 'local-pack.yml');
    await fs.writeFile(file, PACK_YAML.replace('acme-strict', 'from-file'));
    expect(await resolvePolicyPackWithSource(file, root)).toMatchObject({ source: 'file', pack: { name: 'from-file' } });
    // A relative path resolves against the workspace root.
    expect((await resolvePolicyPackWithSource('local-pack.yml', root)).pack.name).toBe('from-file');
  });

  it('refuses an installed pack whose file was modified after install (integrity check)', async () => {
    const root = await workspaceWithPack();
    const located = await findInstalledPack(root, 'acme-strict');
    await fs.writeFile(located!.filePath, PACK_YAML.replace('severity: error', 'severity: warning'));
    await expect(resolvePolicyPackWithSource('acme-strict', root)).rejects.toThrow(/modified after it was installed/);
  });

  it('reports a clear error for an unknown pack', async () => {
    const root = await workspaceWithPack();
    await expect(resolvePolicyPackWithSource('no-such-pack', root)).rejects.toThrow(
      /Policy pack not found: no-such-pack \(not a built-in pack, not installed in \.re-shell\/policy-packs, and not a file\)/
    );
  });
});

describe('policy pack names', () => {
  it('accepts npm-style names and maps scopes to a safe directory', () => {
    expect(isValidPackName('acme-strict')).toBe(true);
    expect(isValidPackName('@team/strict.v2')).toBe(true);
    expect(packDirName('@team/strict')).toBe('team__strict');
    expect(packDirName('plain')).toBe('plain');
  });

  it.each(['', '..', 'a/../b', '.hidden', 'has space', '/abs', 'a\\b', '@scope', 'x'.repeat(215)])('rejects %j', (name) => {
    expect(isValidPackName(name)).toBe(false);
  });
});
