import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  policyInstallResponseSchema,
  policyListResponseSchema,
  policyRemoveResponseSchema,
  policySearchResponseSchema,
} from '@re-shell/contracts';
import {
  runPolicyInstall,
  runPolicyList,
  runPolicyRemove,
  runPolicySearch,
} from '../../src/commands/workspace-policy-packs';
import { runPolicyCheck } from '../../src/commands/workspace-policy';
import { ValidationError } from '../../src/utils/error-handler';
import { findInstalledPack } from '../../src/utils/policy-pack-store';
import { readPluginsFile, writePluginsFile } from '../../src/utils/plugin-store';
import type { FetchLike } from '../../src/utils/registry-client';
import { isolateNpm, startFakeRegistry, type FakeRegistry } from '../utils/fake-registry';

let tmp: string;
let ws: string;
let stdout: string;
let consoleOut: string[];
const originalExitCode = process.exitCode;

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

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-policy-cmd-')));
  ws = path.join(tmp, 'ws');
  await fs.copy(path.resolve(__dirname, '..', 'fixtures', 'policy-violating'), ws);
  process.exitCode = undefined;
  stdout = '';
  consoleOut = [];
  vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
    stdout += String(chunk);
    return true;
  }) as typeof process.stdout.write);
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    consoleOut.push(args.map(String).join(' '));
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
  await fs.remove(tmp);
});

function envelope(): { ok: boolean; data?: any; error?: { code: string; message: string; details?: any }; warnings: string[] } {
  const lines = stdout.split('\n').filter((l) => l.length > 0);
  expect(lines, `stdout was: ${stdout}`).toHaveLength(1);
  return JSON.parse(lines[0]);
}

function validated<T extends z.ZodTypeAny>(schema: T) {
  const parsed = jsonResponseSchema(schema).safeParse(envelope());
  expect(parsed.success, JSON.stringify(parsed, null, 1)).toBe(true);
  return envelope();
}

const human = () => consoleOut.join('\n');

async function packDir(name = 'pkg', content = PACK_YAML): Promise<string> {
  const dir = path.join(tmp, name);
  await fs.outputFile(path.join(dir, 'policy.yml'), content);
  await fs.writeJSON(path.join(dir, 'package.json'), {
    name: '@acme/reshell-policy-pack',
    version: '1.2.0',
    keywords: ['reshell-policy-pack'],
    'reshell-policy-pack': 'policy.yml',
  });
  return dir;
}

describe('workspace policy install --json', () => {
  it('installs a pack and emits the install envelope (warnings kept in the envelope)', async () => {
    const dir = await packDir();
    await fs.writeJSON(path.join(dir, 'package.json'), {
      name: '@acme/no-keyword',
      version: '1.0.0',
      'reshell-policy-pack': 'policy.yml',
    });

    await runPolicyInstall(dir, { json: true, cwd: ws });
    const env = validated(policyInstallResponseSchema);
    expect(env.data).toMatchObject({ name: 'acme-strict', version: '1.0.0', source: 'local', package: '@acme/no-keyword', ruleCount: 2, replaced: false, dryRun: false });
    expect(env.data.path).toBe(path.join(ws, '.re-shell', 'policy-packs', 'acme-strict', 'pack.yml'));
    expect(env.warnings[0]).toMatch(/keyword/);
    expect(process.exitCode).toBeUndefined();
    expect(await fs.pathExists(env.data.path)).toBe(true);
  });

  it('--dry-run validates without storing', async () => {
    await runPolicyInstall(await packDir(), { json: true, cwd: ws, dryRun: true });
    expect(validated(policyInstallResponseSchema).data.dryRun).toBe(true);
    expect(await fs.pathExists(path.join(ws, '.re-shell', 'policy-packs'))).toBe(false);
  });

  it('an invalid pack is POLICY_PACK_ERROR with exit 1 and nothing stored', async () => {
    await runPolicyInstall(await packDir('bad', 'name: x\nrules: []\n'), { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'POLICY_PACK_ERROR', details: { reason: 'invalid-pack' } } });
    expect(envelope().error!.message).toMatch(/Invalid policy pack/);
    expect(process.exitCode).toBe(1);
    expect(await fs.pathExists(path.join(ws, '.re-shell', 'policy-packs'))).toBe(false);
  });

  it('a duplicate needs --force; shadowing a built-in is refused', async () => {
    const dir = await packDir();
    await runPolicyInstall(dir, { json: true, cwd: ws });
    stdout = '';
    process.exitCode = undefined;

    await runPolicyInstall(dir, { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'POLICY_PACK_ERROR', details: { reason: 'exists' } } });
    expect(process.exitCode).toBe(1);

    stdout = '';
    process.exitCode = undefined;
    await runPolicyInstall(dir, { json: true, cwd: ws, force: true });
    expect(envelope()).toMatchObject({ ok: true, data: { replaced: true } });

    stdout = '';
    process.exitCode = undefined;
    await runPolicyInstall(await packDir('shadow', PACK_YAML.replace('acme-strict', 'baseline')), { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { details: { reason: 'reserved-name' } } });
  });

  it('human mode summarizes the install and how to use it; failures become ValidationErrors', async () => {
    await runPolicyInstall(await packDir(), { cwd: ws });
    expect(human()).toContain('Installed policy pack acme-strict@1.2.0 (2 rule(s), source: local)');
    expect(human()).toContain('re-shell workspace policy check --pack acme-strict');

    await expect(runPolicyInstall(await packDir('bad', 'name: x\nrules: []\n'), { cwd: ws })).rejects.toThrow(ValidationError);
    await expect(runPolicyInstall(path.join(tmp, 'missing'), { cwd: ws })).rejects.toThrow(/Policy pack installation failed/);
  });

  describe('npm packs: signature policy comes from the workspace security setting', () => {
    let signed: FakeRegistry;
    let unsigned: FakeRegistry;
    let restoreNpm: () => void;

    const packages = [
      {
        name: '@acme/reshell-policy-pack',
        versions: {
          '1.2.0': {
            manifest: { keywords: ['reshell-policy-pack'], 'reshell-policy-pack': 'policy.yml', description: 'd' },
            files: { 'policy.yml': PACK_YAML },
          },
        },
      },
    ];

    beforeAll(async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-policy-cmd-npm-'));
      restoreNpm = isolateNpm(dir);
      signed = await startFakeRegistry({ packages });
      unsigned = await startFakeRegistry({ packages, signing: false });
    });

    afterAll(async () => {
      await Promise.all([signed.close(), unsigned.close()]);
      restoreNpm();
    });

    it('verifies by default and records the signature', async () => {
      await runPolicyInstall('@acme/reshell-policy-pack', { json: true, cwd: ws, registry: signed.url });
      const env = validated(policyInstallResponseSchema);
      expect(env.data).toMatchObject({ source: 'npm', signature: { verified: true, gated: true } });
    });

    it('refuses an unsigned pack by default with MARKETPLACE_VERIFY_ERROR and exit 1', async () => {
      await runPolicyInstall('@acme/reshell-policy-pack', { json: true, cwd: ws, registry: unsigned.url });
      expect(envelope()).toMatchObject({ ok: false, error: { code: 'MARKETPLACE_VERIFY_ERROR', details: { reason: 'unverified' } } });
      expect(process.exitCode).toBe(1);
      expect(await fs.pathExists(path.join(ws, '.re-shell', 'policy-packs'))).toBe(false);
    });

    it('--no-verify installs it (and the envelope says it was not verified)', async () => {
      await runPolicyInstall('@acme/reshell-policy-pack', { json: true, cwd: ws, registry: unsigned.url, verify: false });
      const env = validated(policyInstallResponseSchema);
      expect(env.data.signature).toEqual({ verified: false, gated: false });
      expect(env.warnings.join(' ')).toMatch(/Signature verification disabled/);
    });

    it('settings.security.allowUnverified=true relaxes the default', async () => {
      const file = await readPluginsFile(ws);
      await writePluginsFile(ws, { ...file, settings: { ...file.settings, security: { allowUnverified: true } } });
      await runPolicyInstall('@acme/reshell-policy-pack', { json: true, cwd: ws, registry: unsigned.url });
      expect(envelope().ok).toBe(true);

      // ...but an explicit --verify still wins.
      stdout = '';
      await runPolicyInstall('@acme/reshell-policy-pack', { json: true, cwd: ws, registry: unsigned.url, verify: true, force: true });
      expect(envelope()).toMatchObject({ ok: false, error: { code: 'MARKETPLACE_VERIFY_ERROR' } });
    });

    it('an unreachable registry is MARKETPLACE_UNREACHABLE', async () => {
      const dead = await startFakeRegistry({ packages: [], failWith: 503 });
      try {
        await runPolicyInstall('@acme/reshell-policy-pack', { json: true, cwd: ws, registry: dead.url });
        expect(envelope()).toMatchObject({ ok: false, error: { code: 'MARKETPLACE_UNREACHABLE' } });
        expect(process.exitCode).toBe(1);
      } finally {
        await dead.close();
      }
    });
  });
});

describe('workspace policy search --json', () => {
  const okFetch: FetchLike = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      objects: [
        { package: { name: '@acme/reshell-policy-pack', version: '1.2.0', description: 'ACME', keywords: ['reshell-policy-pack'] } },
      ],
    }),
  });

  it('emits the search envelope', async () => {
    await runPolicySearch('acme', { json: true, cwd: ws, fetchImpl: okFetch });
    const env = validated(policySearchResponseSchema);
    expect(env.data).toMatchObject({ query: 'acme', total: 1 });
    expect(env.data.packs[0]).toMatchObject({ name: '@acme/reshell-policy-pack', version: '1.2.0' });
  });

  it('emits MARKETPLACE_UNREACHABLE (exit 1) when the registry cannot be reached, never an empty success', async () => {
    const down: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    await runPolicySearch('acme', { json: true, fetchImpl: down });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'MARKETPLACE_UNREACHABLE' } });
    expect(process.exitCode).toBe(1);

    await expect(runPolicySearch('acme', { fetchImpl: down })).rejects.toThrow(/Policy pack search failed/);
  });

  it('rejects a bad --limit', async () => {
    await runPolicySearch('acme', { json: true, limit: 'zero', fetchImpl: okFetch });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'POLICY_PACK_ERROR' } });
  });

  it('human mode lists packs with an install hint, and says when there are none', async () => {
    await runPolicySearch('acme', { fetchImpl: okFetch });
    expect(human()).toContain('@acme/reshell-policy-pack');
    expect(human()).toContain('re-shell workspace policy install @acme/reshell-policy-pack');

    consoleOut = [];
    const none: FetchLike = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => ({ objects: [] }) });
    await runPolicySearch('zzz', { fetchImpl: none });
    expect(human()).toContain('No policy packs found for "zzz".');
  });
});

describe('workspace policy list / remove --json', () => {
  it('lists built-ins and installed packs', async () => {
    await runPolicyInstall(await packDir(), { json: true, cwd: ws });
    stdout = '';
    await runPolicyList({ json: true, cwd: ws });
    const env = validated(policyListResponseSchema);
    expect(env.data.packs.map((p: { name: string; source: string }) => `${p.source}:${p.name}`)).toEqual([
      'builtin:recommended',
      'builtin:baseline',
      'local:acme-strict',
    ]);
    expect(env.warnings).toEqual([]);
  });

  it('flags a tampered pack as a warning in the envelope', async () => {
    await runPolicyInstall(await packDir(), { json: true, cwd: ws });
    const located = await findInstalledPack(ws, 'acme-strict');
    await fs.appendFile(located!.filePath, '# edited\n');
    stdout = '';
    await runPolicyList({ json: true, cwd: ws });
    expect(envelope().warnings[0]).toMatch(/modified after it was installed/);
  });

  it('human list shows built-in and installed sources', async () => {
    await runPolicyInstall(await packDir(), { cwd: ws });
    consoleOut = [];
    await runPolicyList({ cwd: ws });
    expect(human()).toContain('recommended (built-in, 4 rule(s))');
    expect(human()).toContain('acme-strict (local: @acme/reshell-policy-pack@1.2.0, 2 rule(s))');
  });

  it('removes a pack; an unknown pack is POLICY_PACK_NOT_FOUND with exit 1', async () => {
    await runPolicyInstall(await packDir(), { json: true, cwd: ws });
    stdout = '';
    await runPolicyRemove('acme-strict', { json: true, cwd: ws });
    expect(validated(policyRemoveResponseSchema).data.name).toBe('acme-strict');

    stdout = '';
    await runPolicyRemove('acme-strict', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'POLICY_PACK_NOT_FOUND' } });
    expect(process.exitCode).toBe(1);

    stdout = '';
    process.exitCode = undefined;
    await runPolicyRemove('recommended', { json: true, cwd: ws });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'POLICY_PACK_ERROR', details: { reason: 'reserved-name' } } });
  });
});

describe('workspace policy check --pack <installed>', () => {
  it('evaluates an installed pack and reports which pack and where it came from', async () => {
    await runPolicyInstall(await packDir(), { json: true, cwd: ws });
    stdout = '';
    process.exitCode = undefined;

    await runPolicyCheck({ json: true, cwd: ws, pack: 'acme-strict' });
    const env = envelope();
    expect(env.ok).toBe(true);
    expect(env.data).toMatchObject({ pack: 'acme-strict', source: 'installed' });
    expect(env.data.failed.some((f: { ruleId: string }) => f.ruleId === 'needs-test')).toBe(true);
    // The fixture workspaces lack a test script: an error-severity rule failed.
    expect(process.exitCode).toBe(1);
  });

  it('built-in packs still work and report their source', async () => {
    await runPolicyCheck({ json: true, cwd: ws, pack: 'baseline' });
    expect(envelope().data).toMatchObject({ pack: 'baseline', source: 'builtin' });
  });

  it('fails (POLICY_CHECK_ERROR, exit 1) for an unknown pack and for a tampered installed pack', async () => {
    await runPolicyCheck({ json: true, cwd: ws, pack: 'nope' });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'POLICY_CHECK_ERROR' } });
    expect(envelope().error!.message).toMatch(/Policy pack not found: nope/);
    expect(process.exitCode).toBe(1);

    await runPolicyInstall(await packDir(), { json: true, cwd: ws });
    const located = await findInstalledPack(ws, 'acme-strict');
    await fs.writeFile(located!.filePath, PACK_YAML.replace('severity: error', 'severity: warning'));
    stdout = '';
    process.exitCode = undefined;
    await runPolicyCheck({ json: true, cwd: ws, pack: 'acme-strict' });
    expect(envelope()).toMatchObject({ ok: false, error: { code: 'POLICY_CHECK_ERROR' } });
    expect(envelope().error!.message).toMatch(/modified after it was installed/);
    expect(process.exitCode).toBe(1);
  });
});
