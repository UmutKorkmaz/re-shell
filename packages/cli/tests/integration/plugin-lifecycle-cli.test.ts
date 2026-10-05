import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import {
  jsonResponseSchema,
  pluginInfoResponseSchema,
  pluginListResponseSchema,
  pluginPinResponseSchema,
  pluginReviewAddResponseSchema,
  pluginReviewListResponseSchema,
  pluginUninstallResponseSchema,
  pluginUpdateResponseSchema,
  pluginValidateResponseSchema,
  policyInstallResponseSchema,
  policyListResponseSchema,
  policyRemoveResponseSchema,
  policySearchResponseSchema,
} from '@re-shell/contracts';
import { isolateNpm, startFakeRegistry, type FakeRegistry } from '../utils/fake-registry';

/**
 * End-to-end conformance for the plugin lifecycle (install / list / info / pin /
 * review / update / validate / uninstall) and policy-pack distribution, driving
 * the BUILT CLI as a real subprocess in a throwaway workspace.
 *
 * Everything is real: files are written and removed on disk, `npm pack` talks to a
 * local HTTP registry that serves real tarballs and real ECDSA signatures, git
 * clones a local repository. No network, no mocks. Every `--json` run must print
 * exactly one envelope that validates against @re-shell/contracts and exit
 * non-zero exactly when the envelope says `ok: false`.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');

// Each test spawns the real CLI many times (and npm for the registry flows); on a
// busy CI box a single scenario can take minutes.
vi.setConfig({ testTimeout: 600_000, hookTimeout: 120_000 });

interface Run {
  stdout: string;
  stderr: string;
  status: number;
}

/** Spawn the CLI asynchronously (the in-process fake registry must keep serving). */
function runCli(args: string[], cwd: string): Promise<Run> {
  const tag = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  const outFile = path.join(os.tmpdir(), `rs-plc-${tag}.out`);
  const errFile = path.join(os.tmpdir(), `rs-plc-${tag}.err`);
  const out = fs.openSync(outFile, 'w');
  const err = fs.openSync(errFile, 'w');
  return new Promise((resolve, reject) => {
    const child = spawn('node', [CLI_PATH, ...args], {
      cwd,
      stdio: ['ignore', out, err],
      env: { ...process.env, NO_COLOR: '1' },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      fs.closeSync(out);
      fs.closeSync(err);
      const result = {
        stdout: fs.readFileSync(outFile, 'utf8'),
        stderr: fs.readFileSync(errFile, 'utf8'),
        status: code ?? 1,
      };
      fs.rmSync(outFile, { force: true });
      fs.rmSync(errFile, { force: true });
      resolve(result);
    });
  });
}

function envelopeOf(run: Run): { ok: boolean; data?: any; error?: { code: string; message: string; details?: any }; warnings: string[] } {
  const lines = run.stdout.split('\n').filter((l) => l.length > 0);
  expect(lines, `expected exactly one JSON line; stdout=${run.stdout} stderr=${run.stderr}`).toHaveLength(1);
  return JSON.parse(lines[0]);
}

/** Run with --json; assert the envelope matches the schema and the exit code matches `ok`. */
async function json<T extends z.ZodTypeAny>(
  schema: T,
  args: string[],
  cwd: string,
  expectOk = true
): Promise<ReturnType<typeof envelopeOf>> {
  const run = await runCli([...args, '--json'], cwd);
  const env = envelopeOf(run);
  const parsed = jsonResponseSchema(schema).safeParse(env);
  expect(parsed.success, `${args.join(' ')} => ${JSON.stringify(env)}\n${parsed.success ? '' : JSON.stringify(parsed.error.issues)}`).toBe(true);
  expect(env.ok, `${args.join(' ')} => ${run.stdout} ${run.stderr}`).toBe(expectOk);
  expect(run.status, `${args.join(' ')} exit code`).toBe(expectOk ? 0 : 1);
  return env;
}

const anything = z.unknown();

let root: string;
let ws: string;
let src: string;
let restoreNpm: () => void;

beforeAll(() => {
  restoreNpm = isolateNpm(fs.mkdtempSync(path.join(os.tmpdir(), 'rs-plc-npm-')));
});

afterAll(() => {
  restoreNpm();
});

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rs-plc-')));
  ws = path.join(root, 'ws');
  src = path.join(root, 'src');
  fs.mkdirSync(ws, { recursive: true });
  fs.mkdirSync(src, { recursive: true });
  fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'fixture-root', private: true }));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function makePlugin(name: string, files: Record<string, string> = {}, extra: Record<string, unknown> = {}): string {
  const dir = path.join(src, name.replace(/[@/]/g, '_'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name,
      version: '1.0.0',
      description: `${name} fixture`,
      main: 'index.js',
      keywords: ['reshell-plugin'],
      engines: { 'reshell-cli': '>=0.30.0' },
      ...extra,
    })
  );
  fs.writeFileSync(path.join(dir, 'index.js'), files['index.js'] ?? 'exports.activate = () => {};');
  return dir;
}

describe('plugin lifecycle (real CLI process)', () => {
  it('install -> list -> info -> pin -> review -> update --check -> uninstall, all on disk', async () => {
    const plugin = makePlugin('reshell-plugin-e2e');

    const installed = await json(anything, ['plugin', 'install', plugin, '--pin'], ws);
    expect(installed.data).toMatchObject({ name: 'reshell-plugin-e2e', version: '1.0.0', source: 'local', pin: '1.0.0' });
    const installDir = path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-e2e');
    expect(fs.existsSync(path.join(installDir, 'index.js'))).toBe(true);

    const list = await json(pluginListResponseSchema, ['plugin', 'list'], ws);
    expect(list.data.plugins).toHaveLength(1);
    expect(list.data.plugins[0]).toMatchObject({ name: 'reshell-plugin-e2e', origin: 'local', pin: '1.0.0', managed: true });

    const info = await json(pluginInfoResponseSchema, ['plugin', 'info', 'reshell-plugin-e2e', '--offline'], ws);
    expect(info.data).toMatchObject({ install: { source: 'local' }, quality: null, reviews: { count: 0 } });

    const unpinned = await json(pluginPinResponseSchema, ['plugin', 'unpin', 'reshell-plugin-e2e'], ws);
    expect(unpinned.data).toMatchObject({ pin: null, previousPin: '1.0.0' });
    const repinned = await json(pluginPinResponseSchema, ['plugin', 'pin', 'reshell-plugin-e2e', '^1.0.0'], ws);
    expect(repinned.data.pin).toBe('^1.0.0');

    const review = await json(
      pluginReviewAddResponseSchema,
      ['plugin', 'review', 'add', 'reshell-plugin-e2e', '--rating', '4', '--comment', 'works well', '--author', 'dev@example.com'],
      ws
    );
    expect(review.data.aggregate).toMatchObject({ count: 1, average: 4 });
    const reviews = await json(pluginReviewListResponseSchema, ['plugin', 'review', 'list', 'reshell-plugin-e2e'], ws);
    expect(reviews.data.reviews[0]).toMatchObject({ author: 'dev@example.com', comment: 'works well', version: '1.0.0' });
    expect(fs.existsSync(path.join(ws, '.re-shell', 'plugin-reviews.json'))).toBe(true);

    const withReview = await json(pluginInfoResponseSchema, ['plugin', 'info', 'reshell-plugin-e2e', '--offline'], ws);
    expect(withReview.data.reviews).toMatchObject({ count: 1, average: 4 });

    const update = await json(pluginUpdateResponseSchema, ['plugin', 'update', '--check'], ws);
    expect(update.data.plugins[0]).toMatchObject({ source: 'local', status: 'not-updatable' });

    const dry = await json(pluginUninstallResponseSchema, ['plugin', 'uninstall', 'reshell-plugin-e2e', '--dry-run'], ws);
    expect(dry.data).toMatchObject({ dryRun: true, removed: { registryEntry: true } });
    expect(fs.existsSync(installDir)).toBe(true);

    const removed = await json(pluginUninstallResponseSchema, ['plugin', 'uninstall', 'reshell-plugin-e2e', '--force'], ws);
    expect(removed.data).toMatchObject({ dryRun: false, removed: { paths: [installDir], registryEntry: true } });
    expect(fs.existsSync(installDir)).toBe(false);
    const registryFile = JSON.parse(fs.readFileSync(path.join(ws, '.re-shell', 'plugins.json'), 'utf8'));
    expect(registryFile.plugins).toEqual({});

    const after = await json(pluginListResponseSchema, ['plugin', 'list'], ws);
    expect(after.data.total).toBe(0);

    // The review file is team data and survives the uninstall.
    expect(fs.existsSync(path.join(ws, '.re-shell', 'plugin-reviews.json'))).toBe(true);
  });

  it('uninstalling something that is not installed exits non-zero with PLUGIN_NOT_FOUND (json and human)', async () => {
    const env = await json(anything, ['plugin', 'uninstall', 'reshell-plugin-ghost'], ws, false);
    expect(env.error).toMatchObject({ code: 'PLUGIN_NOT_FOUND', details: { name: 'reshell-plugin-ghost' } });

    const human = await runCli(['plugin', 'uninstall', 'reshell-plugin-ghost'], ws);
    expect(human.status).toBe(1);
    expect(human.stderr).toContain("Plugin 'reshell-plugin-ghost' is not installed");
    expect(human.stdout).not.toContain('uninstalled successfully');
  });

  it('list --json on an empty workspace prints an envelope (not nothing)', async () => {
    const env = await json(pluginListResponseSchema, ['plugin', 'list'], ws);
    expect(env.data).toEqual({ plugins: [], total: 0 });
  });

  it('validate: a good plugin passes; a risky one fails with the report; a missing path fails', async () => {
    const good = makePlugin('reshell-plugin-good');
    const ok = await json(pluginValidateResponseSchema, ['plugin', 'validate', good], ws);
    expect(ok.data).toMatchObject({ valid: true, counts: { errors: 0 } });

    const risky = makePlugin('reshell-plugin-risky', {
      'index.js': 'exports.activate = () => {};\nconst x = eval(process.argv[2]);\nrequire(process.argv[3]);\nfetch("https://example.com");',
    });
    const bad = await json(anything, ['plugin', 'validate', risky], ws, false);
    expect(bad.error).toMatchObject({ code: 'PLUGIN_VALIDATE_ERROR' });
    const ids = (bad.error!.details.findings as Array<{ id: string }>).map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['security-eval', 'security-dynamic-require-input', 'security-network']));
    expect(bad.warnings.some((w) => w.startsWith('security-network'))).toBe(true);

    const incompatible = makePlugin('reshell-plugin-future', {}, { engines: { 'reshell-cli': '^99.0.0' } });
    const engines = await json(anything, ['plugin', 'validate', incompatible], ws, false);
    expect(engines.error!.details.findings.some((f: { id: string }) => f.id === 'engines-reshell-cli-unsatisfied')).toBe(true);

    const missing = await json(anything, ['plugin', 'validate', path.join(root, 'nowhere')], ws, false);
    expect(missing.error).toMatchObject({ code: 'PLUGIN_VALIDATE_ERROR', details: { reason: 'not-found' } });

    const human = await runCli(['plugin', 'validate', risky], ws);
    expect(human.status).toBe(1);
    expect(human.stdout).toContain('security-eval');
  });

  it('discovers a pnpm-style symlinked plugin in node_modules but not first-party @re-shell packages', async () => {
    const real = path.join(ws, 'node_modules', '.pnpm', 'reshell-plugin-pnpm@1.0.0', 'node_modules', 'reshell-plugin-pnpm');
    fs.mkdirSync(real, { recursive: true });
    fs.writeFileSync(
      path.join(real, 'package.json'),
      JSON.stringify({ name: 'reshell-plugin-pnpm', version: '1.0.0', description: 'd', main: 'index.js', 'reshell-cli': {} })
    );
    fs.symlinkSync(real, path.join(ws, 'node_modules', 'reshell-plugin-pnpm'), 'dir');
    const firstParty = path.join(ws, 'node_modules', '@re-shell', 'cli');
    fs.mkdirSync(firstParty, { recursive: true });
    fs.writeFileSync(path.join(firstParty, 'package.json'), JSON.stringify({ name: '@re-shell/cli', version: '1.0.0', description: 'd', main: 'index.js' }));

    const list = await json(pluginListResponseSchema, ['plugin', 'list'], ws);
    expect(list.data.plugins.map((p: { name: string; origin: string }) => `${p.origin}:${p.name}`)).toEqual(['node_modules:reshell-plugin-pnpm']);
  });
});

describe('npm plugins against a local registry (real npm pack, real signatures)', () => {
  let registry: FakeRegistry;

  beforeEach(async () => {
    const versions = (list: string[]) =>
      Object.fromEntries(
        list.map((v) => [v, { manifest: { keywords: ['reshell-plugin'], description: `n ${v}` }, files: { 'index.js': `exports.activate = () => {}; // ${v}` } }])
      );
    registry = await startFakeRegistry({ packages: [{ name: 'reshell-plugin-npm', versions: versions(['1.0.0', '1.1.0', '2.0.0']) }] });
  });

  afterEach(async () => {
    await registry.close();
  });

  it('install --pin, update respects the pin, unpin lets it move, signatures are verified', async () => {
    await json(anything, ['plugin', 'install', 'reshell-plugin-npm@1.0.0', '--pin', '--registry', registry.url], ws);

    const held = await json(pluginUpdateResponseSchema, ['plugin', 'update', '--registry', registry.url], ws);
    expect(held.data.plugins[0]).toMatchObject({ status: 'pinned', installed: '1.0.0', latest: '2.0.0', pin: '1.0.0' });

    await json(pluginPinResponseSchema, ['plugin', 'pin', 'reshell-plugin-npm', '^1.0.0'], ws);
    const check = await json(pluginUpdateResponseSchema, ['plugin', 'update', '--check', '--registry', registry.url], ws);
    expect(check.data.plugins[0]).toMatchObject({ status: 'update-available', target: '1.1.0' });
    expect(check.data.plugins[0].signature).toMatchObject({ verified: true, gated: true });
    expect(JSON.parse(fs.readFileSync(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-npm', 'package.json'), 'utf8')).version).toBe('1.0.0');

    const applied = await json(pluginUpdateResponseSchema, ['plugin', 'update', 'reshell-plugin-npm', '--registry', registry.url], ws);
    expect(applied.data.plugins[0]).toMatchObject({ status: 'updated', target: '1.1.0' });
    expect(fs.readFileSync(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-npm', 'index.js'), 'utf8')).toContain('1.1.0');

    await json(pluginPinResponseSchema, ['plugin', 'unpin', 'reshell-plugin-npm'], ws);
    const latest = await json(pluginUpdateResponseSchema, ['plugin', 'update', '--registry', registry.url], ws);
    expect(latest.data.plugins[0]).toMatchObject({ status: 'updated', target: '2.0.0' });

    const info = await json(pluginInfoResponseSchema, ['plugin', 'info', 'reshell-plugin-npm', '--offline'], ws);
    expect(info.data.version).toBe('2.0.0');
    expect(info.data.install).toMatchObject({ source: 'npm', signature: { verified: true, gated: true } });
  });

  it('an update that cannot be verified fails the command (exit 1) and keeps the old version', async () => {
    await json(anything, ['plugin', 'install', 'reshell-plugin-npm@1.0.0', '--registry', registry.url], ws);
    const unsigned = await startFakeRegistry({
      packages: [{ name: 'reshell-plugin-npm', versions: { '1.0.0': { manifest: { keywords: ['reshell-plugin'], description: 'n' } }, '3.0.0': { manifest: { keywords: ['reshell-plugin'], description: 'n' } } } }],
      signing: false,
    });
    try {
      const env = await json(anything, ['plugin', 'update', '--registry', unsigned.url], ws, false);
      expect(env.error).toMatchObject({ code: 'PLUGIN_UPDATE_ERROR' });
      expect(env.error!.details.plugins[0]).toMatchObject({ status: 'failed' });
      expect(env.error!.message).toMatch(/Refusing to update to unverified 3\.0\.0/);
      expect(JSON.parse(fs.readFileSync(path.join(ws, '.re-shell', 'plugins', 'reshell-plugin-npm', 'package.json'), 'utf8')).version).toBe('1.0.0');

      // An explicit, honest opt-out proceeds.
      const lax = await json(pluginUpdateResponseSchema, ['plugin', 'update', '--no-verify', '--registry', unsigned.url], ws);
      expect(lax.data.plugins[0]).toMatchObject({ status: 'updated', target: '3.0.0' });
    } finally {
      await unsigned.close();
    }
  });

  it('an unreachable registry fails update --check with a non-zero exit', async () => {
    await json(anything, ['plugin', 'install', 'reshell-plugin-npm@1.0.0', '--registry', registry.url], ws);
    const dead = await startFakeRegistry({ packages: [], failWith: 503 });
    try {
      const env = await json(anything, ['plugin', 'update', '--check', '--registry', dead.url], ws, false);
      expect(env.error!.code).toBe('PLUGIN_UPDATE_ERROR');
      expect(env.error!.details.plugins[0].status).toBe('failed');
    } finally {
      await dead.close();
    }
  });
});

describe('policy packs via the marketplace (real CLI process)', () => {
  const PACK_YAML = `name: e2e-pack
description: end to end pack
rules:
  - id: needs-test-script
    type: required-scripts
    severity: error
    scripts: [test]
`;

  function violatingMonorepo(): string {
    const dir = path.join(root, 'monorepo');
    fs.cpSync(path.resolve(process.cwd(), 'tests', 'fixtures', 'policy-violating'), dir, { recursive: true });
    return dir;
  }

  function packPackage(): string {
    const dir = path.join(src, 'policy-pkg');
    fs.mkdirSync(path.join(dir, 'rules'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'rules', 'e2e.yml'), PACK_YAML);
    fs.writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: '@acme/reshell-policy-e2e', version: '2.1.0', keywords: ['reshell-policy-pack'], 'reshell-policy-pack': 'rules/e2e.yml' })
    );
    return dir;
  }

  it('install from a package directory, list, check --pack <name>, remove', async () => {
    const monorepo = violatingMonorepo();
    const pkg = packPackage();

    const installed = await json(policyInstallResponseSchema, ['workspace', 'policy', 'install', pkg], monorepo);
    expect(installed.data).toMatchObject({ name: 'e2e-pack', version: '2.1.0', package: '@acme/reshell-policy-e2e', ruleCount: 1, source: 'local' });
    expect(fs.existsSync(path.join(monorepo, '.re-shell', 'policy-packs', 'e2e-pack', 'pack.yml'))).toBe(true);

    const listed = await json(policyListResponseSchema, ['workspace', 'policy', 'list'], monorepo);
    expect(listed.data.packs.map((p: { name: string }) => p.name)).toEqual(['recommended', 'baseline', 'e2e-pack']);

    // The violating fixture has no test scripts: the installed pack's error rule fails the check (exit 1).
    const check = await runCli(['workspace', 'policy', 'check', '--pack', 'e2e-pack', '--json'], monorepo);
    const env = envelopeOf(check);
    expect(env.ok).toBe(true);
    expect(env.data).toMatchObject({ pack: 'e2e-pack', source: 'installed' });
    expect(env.data.failed.some((f: { ruleId: string }) => f.ruleId === 'needs-test-script')).toBe(true);
    expect(check.status).toBe(1);

    const removed = await json(policyRemoveResponseSchema, ['workspace', 'policy', 'remove', 'e2e-pack'], monorepo);
    expect(removed.data.name).toBe('e2e-pack');
    const gone = await runCli(['workspace', 'policy', 'check', '--pack', 'e2e-pack', '--json'], monorepo);
    expect(envelopeOf(gone)).toMatchObject({ ok: false, error: { code: 'POLICY_CHECK_ERROR' } });
    expect(gone.status).toBe(1);
  });

  it('search and install from a local npm registry, verifying the registry signature', async () => {
    const registry = await startFakeRegistry({
      packages: [
        {
          name: '@acme/reshell-policy-e2e',
          versions: {
            '2.1.0': {
              manifest: { keywords: ['reshell-policy-pack'], description: 'e2e pack', 'reshell-policy-pack': 'rules/e2e.yml' },
              files: { 'rules/e2e.yml': PACK_YAML },
            },
          },
        },
      ],
    });
    try {
      const monorepo = violatingMonorepo();
      const found = await json(policySearchResponseSchema, ['workspace', 'policy', 'search', 'e2e', '--registry', registry.url], monorepo);
      expect(found.data.packs.map((p: { name: string }) => p.name)).toEqual(['@acme/reshell-policy-e2e']);

      const installed = await json(policyInstallResponseSchema, ['workspace', 'policy', 'install', '@acme/reshell-policy-e2e', '--registry', registry.url], monorepo);
      expect(installed.data).toMatchObject({ name: 'e2e-pack', version: '2.1.0', source: 'npm', signature: { verified: true, gated: true } });

      const dead = await startFakeRegistry({ packages: [], failWith: 503 });
      try {
        const unreachable = await json(anything, ['workspace', 'policy', 'search', 'x', '--registry', dead.url], monorepo, false);
        expect(unreachable.error!.code).toBe('MARKETPLACE_UNREACHABLE');
      } finally {
        await dead.close();
      }
    } finally {
      await registry.close();
    }
  });

  it('refuses an invalid pack with a non-zero exit and stores nothing', async () => {
    const monorepo = violatingMonorepo();
    const pkg = packPackage();
    fs.writeFileSync(path.join(pkg, 'rules', 'e2e.yml'), 'name: broken\nrules: []\n');
    const env = await json(anything, ['workspace', 'policy', 'install', pkg], monorepo, false);
    expect(env.error).toMatchObject({ code: 'POLICY_PACK_ERROR' });
    expect(fs.existsSync(path.join(monorepo, '.re-shell', 'policy-packs'))).toBe(false);
  });
});
