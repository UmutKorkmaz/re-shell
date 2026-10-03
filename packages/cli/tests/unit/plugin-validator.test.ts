import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { pluginValidateResponseSchema } from '@re-shell/contracts';
import {
  PluginValidationInputError,
  getCliVersion,
  lexSource,
  pluginManifestSchema,
  stripComments,
  validatePluginPath,
} from '../../src/utils/plugin-validator';
import type { FetchLike } from '../../src/utils/registry-client';

let root: string;
let counter = 0;

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'reshell-validate-')));
});

afterEach(async () => {
  await fs.remove(root);
});

const CLI = '0.30.1';

/** A valid, minimal plugin manifest. */
function manifest(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'reshell-plugin-v',
    version: '1.0.0',
    description: 'A validator fixture',
    main: 'index.js',
    keywords: ['reshell-plugin'],
    engines: { 'reshell-cli': '>=0.30.0' },
    ...extra,
  };
}

async function plugin(
  man: Record<string, unknown> | null,
  files: Record<string, string> = { 'index.js': 'module.exports = { activate() {} };' }
): Promise<string> {
  const dir = path.join(root, `p${counter++}`);
  await fs.ensureDir(dir);
  if (man) await fs.writeJSON(path.join(dir, 'package.json'), man);
  for (const [rel, body] of Object.entries(files)) await fs.outputFile(path.join(dir, rel), body);
  return dir;
}

async function validate(
  man: Record<string, unknown> | null,
  files?: Record<string, string>,
  options: Parameters<typeof validatePluginPath>[1] = {}
) {
  return validatePluginPath(await plugin(man, files), { cliVersion: CLI, nodeVersion: 'v22.0.0', ...options });
}

function ids(report: { findings: Array<{ id: string }> }): string[] {
  return report.findings.map((f) => f.id);
}

describe('validatePluginPath: a good plugin', () => {
  it('is valid with no findings and conforms to the contract schema', async () => {
    const report = await validate(manifest());
    expect(report.valid).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.counts).toEqual({ errors: 0, warnings: 0, info: 0 });
    expect(report.checks).toEqual({
      manifest: 'pass',
      entry: 'pass',
      engines: 'pass',
      dependencies: 'pass',
      security: 'pass',
      size: 'pass',
    });
    expect(report.name).toBe('reshell-plugin-v');
    expect(report.engines).toMatchObject({ reshellCli: '>=0.30.0', reshellCliSatisfied: true });
    expect(pluginValidateResponseSchema.safeParse(report).success).toBe(true);
  });

  it('accepts the package.json path as well as the directory', async () => {
    const dir = await plugin(manifest());
    const report = await validatePluginPath(path.join(dir, 'package.json'), { cliVersion: CLI });
    expect(report.valid).toBe(true);
    expect(report.path).toBe(dir);
  });

  it('validates the shipped sample-plugin fixture (reshell-plugin manifest key with compatibility)', async () => {
    const fixture = path.resolve(__dirname, '..', 'fixtures', 'sample-plugin');
    const report = await validatePluginPath(fixture, { cliVersion: CLI });
    // The fixture declares the plugin via the `reshell-plugin` key (and `@re-shell/` scope).
    expect(report.findings.filter((f) => f.severity === 'error')).toEqual([]);
    expect(report.engines.reshellCli).toBe('>=0.7.0');
    expect(report.engines.reshellCliSatisfied).toBe(true);
    expect(report.valid).toBe(true);
  });

  it('reads the real CLI version by default', async () => {
    const report = await validatePluginPath(await plugin(manifest()));
    expect(report.cliVersion).toBe(getCliVersion());
    expect(report.cliVersion).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('validatePluginPath: input errors', () => {
  it('throws for a path that does not exist', async () => {
    await expect(validatePluginPath(path.join(root, 'nope'))).rejects.toMatchObject({
      name: 'PluginValidationInputError',
      details: { reason: 'not-found' },
    });
  });

  it('throws for a file that is not package.json', async () => {
    const dir = await plugin(manifest());
    await expect(validatePluginPath(path.join(dir, 'index.js'))).rejects.toBeInstanceOf(PluginValidationInputError);
  });

  it('reports a directory without package.json as invalid, not as a crash', async () => {
    const report = await validate(null, { 'index.js': '' });
    expect(report.valid).toBe(false);
    expect(ids(report)).toContain('manifest-missing');
    expect(report.name).toBeNull();
  });

  it('reports unparsable JSON', async () => {
    const dir = await plugin(null);
    await fs.writeFile(path.join(dir, 'package.json'), '{ nope');
    const report = await validatePluginPath(dir, { cliVersion: CLI });
    expect(report.valid).toBe(false);
    expect(ids(report)).toContain('manifest-unparsable');
  });
});

describe('validatePluginPath: manifest schema', () => {
  it.each([
    ['name', { name: 'Bad Name!' }, /name: must be a valid npm package name/],
    ['version', { version: 'one' }, /version: must be a valid semver version/],
    ['description', { description: '  ' }, /description: must be a non-empty string/],
    ['main', { main: '' }, /main: must be a non-empty string/],
    ['keywords', { keywords: 'reshell-plugin' }, /keywords/],
    ['engines', { engines: { node: 18 } }, /engines/],
    ['permissions', { reshell: { permissions: [{ type: 'teleport', access: 'read' }] } }, /reshell\.permissions/],
  ])('rejects an invalid %s', async (_label, patch, message) => {
    const report = await validate(manifest(patch));
    expect(report.valid).toBe(false);
    expect(report.checks.manifest).toBe('fail');
    expect(report.findings.some((f) => f.id === 'manifest-invalid' && message.test(f.message))).toBe(true);
  });

  it('requires a main entry point (the loader needs one)', async () => {
    const { main: _main, ...noMain } = manifest();
    void _main;
    const report = await validate(noMain);
    expect(report.valid).toBe(false);
    expect(report.findings.some((f) => /main/.test(f.message))).toBe(true);
    expect(report.checks.entry).toBe('skip');
  });

  it('rejects a package that is not recognized as a re-shell plugin', async () => {
    const { keywords: _k, ...plain } = manifest({ name: 'plain-library' });
    void _k;
    const report = await validate(plain);
    expect(ids(report)).toContain('manifest-not-plugin');
    expect(report.valid).toBe(false);
  });

  it('rejects first-party packages', async () => {
    const report = await validate(manifest({ name: '@re-shell/cli' }));
    expect(ids(report)).toContain('manifest-first-party');
    expect(report.valid).toBe(false);
  });

  it('recognizes every manifest signal the installer accepts', async () => {
    for (const patch of [
      { keywords: undefined, reshell: {} },
      { keywords: undefined, 'reshell-plugin': {} },
      { keywords: undefined, 'reshell-cli': {} },
      { keywords: undefined, name: 'reshell-plugin-prefixed' },
      { keywords: undefined, name: '@re-shell/community' },
    ]) {
      const report = await validate(manifest(patch));
      expect(ids(report), JSON.stringify(patch)).not.toContain('manifest-not-plugin');
    }
  });

  it('warns about hooks that do not exist', async () => {
    const report = await validate(manifest({ reshell: { hooks: ['cli:init', 'bogus:hook'] } }));
    expect(report.findings).toContainEqual(
      expect.objectContaining({ id: 'manifest-unknown-hook', severity: 'warning', message: expect.stringContaining('bogus:hook') })
    );
    expect(report.valid).toBe(true);
  });

  it('exports the schema for reuse', () => {
    expect(pluginManifestSchema.safeParse(manifest()).success).toBe(true);
  });
});

describe('validatePluginPath: entry file', () => {
  it('errors when main does not exist', async () => {
    const report = await validate(manifest({ main: 'dist/missing.js' }));
    expect(ids(report)).toContain('entry-missing');
    expect(report.checks.entry).toBe('fail');
    expect(report.valid).toBe(false);
  });

  it('resolves main like Node does: missing extension, and a directory with index.js', async () => {
    expect((await validate(manifest({ main: 'lib/entry' }), { 'lib/entry.js': 'exports.activate = () => {};' })).valid).toBe(true);
    expect((await validate(manifest({ main: 'lib' }), { 'lib/index.js': 'exports.activate = () => {};' })).valid).toBe(true);
  });

  it('rejects an entry that points outside the plugin directory', async () => {
    const report = await validate(manifest({ main: '../outside.js' }));
    expect(ids(report)).toContain('entry-escapes');
    expect(report.valid).toBe(false);
  });

  it('rejects a TypeScript entry (the loader require()s JavaScript)', async () => {
    const report = await validate(manifest({ main: 'src/index.ts' }), { 'src/index.ts': 'export function activate() {}' });
    expect(ids(report)).toContain('entry-typescript');
    expect(report.valid).toBe(false);
  });

  it('warns for an ES-module entry and for a missing activate()', async () => {
    const esm = await validate(manifest({ main: 'index.mjs' }), { 'index.mjs': 'export function activate() {}' });
    expect(esm.findings).toContainEqual(expect.objectContaining({ id: 'entry-esm', severity: 'warning' }));
    expect(esm.valid).toBe(true);

    const noActivate = await validate(manifest(), { 'index.js': 'module.exports = {};' });
    expect(noActivate.findings).toContainEqual(expect.objectContaining({ id: 'entry-no-activate', severity: 'warning' }));
    expect(noActivate.valid).toBe(true);
  });

  it('does not count a commented-out activate() as present', async () => {
    const report = await validate(manifest(), { 'index.js': '// activate() goes here later\nmodule.exports = {};' });
    expect(ids(report)).toContain('entry-no-activate');
  });
});

describe('validatePluginPath: engines', () => {
  it('errors when the CLI does not satisfy engines.reshell-cli', async () => {
    const report = await validate(manifest({ engines: { 'reshell-cli': '^1.0.0' } }));
    expect(ids(report)).toContain('engines-reshell-cli-unsatisfied');
    expect(report.engines.reshellCliSatisfied).toBe(false);
    expect(report.valid).toBe(false);
    expect(report.findings.find((f) => f.id === 'engines-reshell-cli-unsatisfied')?.message).toContain('0.30.1');
  });

  it('accepts ranges the CLI satisfies, including prereleases of the same line', async () => {
    expect((await validate(manifest({ engines: { 'reshell-cli': '^0.30.0' } }))).engines.reshellCliSatisfied).toBe(true);
    const pre = await validate(manifest({ engines: { 'reshell-cli': '^0.30.0' } }), undefined, { cliVersion: '0.30.2-beta.1' });
    expect(pre.engines.reshellCliSatisfied).toBe(true);
  });

  it('errors for an invalid range', async () => {
    const report = await validate(manifest({ engines: { 'reshell-cli': 'newer than yesterday' } }));
    expect(ids(report)).toContain('engines-reshell-cli-invalid');
    expect(report.valid).toBe(false);
  });

  it('warns (does not fail) when no CLI range is declared', async () => {
    const report = await validate(manifest({ engines: {} }));
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'engines-reshell-cli-missing', severity: 'warning' }));
    expect(report.engines.reshellCliSatisfied).toBeNull();
    expect(report.valid).toBe(true);
  });

  it('falls back to reshell.compatibility', async () => {
    const report = await validate(manifest({ engines: {}, reshell: { compatibility: '>=99.0.0' } }));
    expect(ids(report)).toContain('engines-reshell-cli-unsatisfied');
  });

  it('checks engines.node against the running Node', async () => {
    const bad = await validate(manifest({ engines: { 'reshell-cli': '*', node: '>=24' } }), undefined, { nodeVersion: 'v20.1.0' });
    expect(ids(bad)).toContain('engines-node-unsatisfied');
    expect(bad.valid).toBe(false);
    const good = await validate(manifest({ engines: { 'reshell-cli': '*', node: '>=18' } }), undefined, { nodeVersion: 'v20.1.0' });
    expect(good.engines).toMatchObject({ node: '>=18', nodeSatisfied: true });
  });
});

describe('validatePluginPath: dependencies', () => {
  it('errors for a dependency that cannot be resolved', async () => {
    const report = await validate(manifest({ dependencies: { 'left-pad-ish': '^1.0.0' } }));
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'deps-unresolvable', severity: 'error' }));
    expect(report.valid).toBe(false);
  });

  it('resolves dependencies from node_modules, including ancestors and symlinks (pnpm)', async () => {
    const dir = await plugin(manifest({ dependencies: { local: '^1.0.0', hoisted: '>=2', linked: '*' } }));
    await fs.outputJSON(path.join(dir, 'node_modules', 'local', 'package.json'), { name: 'local', version: '1.4.0' });
    await fs.outputJSON(path.join(root, 'node_modules', 'hoisted', 'package.json'), { name: 'hoisted', version: '2.1.0' });
    const real = path.join(root, 'store', 'linked');
    await fs.outputJSON(path.join(real, 'package.json'), { name: 'linked', version: '9.9.9' });
    await fs.ensureDir(path.join(dir, 'node_modules'));
    await fs.symlink(real, path.join(dir, 'node_modules', 'linked'), 'dir');

    const report = await validatePluginPath(dir, { cliVersion: CLI });
    expect(report.findings.filter((f) => f.category === 'dependencies')).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('errors when an installed dependency does not satisfy the range', async () => {
    const dir = await plugin(manifest({ dependencies: { dep: '^2.0.0' } }));
    await fs.outputJSON(path.join(dir, 'node_modules', 'dep', 'package.json'), { name: 'dep', version: '1.0.0' });
    const report = await validatePluginPath(dir, { cliVersion: CLI });
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'deps-version-mismatch', severity: 'error' }));
  });

  it('treats missing optional peers and optional dependencies as warnings, and skips node builtins', async () => {
    const report = await validate(
      manifest({
        dependencies: { fs: '*', 'node:path': '*' },
        peerDependencies: { 'soft-peer': '^1.0.0' },
        peerDependenciesMeta: { 'soft-peer': { optional: true } },
        optionalDependencies: { 'nice-to-have': '^1.0.0' },
      })
    );
    const deps = report.findings.filter((f) => f.category === 'dependencies');
    expect(deps.map((f) => f.severity)).toEqual(['warning', 'warning']);
    expect(report.valid).toBe(true);
  });

  it('treats a missing required peer dependency as an error', async () => {
    const report = await validate(manifest({ peerDependencies: { 'needs-host': '^1.0.0' } }));
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'deps-unresolvable', severity: 'error' }));
  });

  it('errors for invalid specifiers but accepts workspace:/file:/tag specs', async () => {
    const bad = await validate(manifest({ dependencies: { x: 'not a range!!' } }));
    expect(ids(bad)).toContain('deps-invalid-spec');

    const dir = await plugin(manifest({ dependencies: { a: 'workspace:*', b: 'file:../b', c: 'latest' } }));
    for (const name of ['a', 'b', 'c']) {
      await fs.outputJSON(path.join(dir, 'node_modules', name, 'package.json'), { name, version: '1.0.0' });
    }
    const report = await validatePluginPath(dir, { cliVersion: CLI });
    expect(report.findings.filter((f) => f.category === 'dependencies')).toEqual([]);
  });

  describe('with checkRegistry (mocked registry)', () => {
    function registry(handlers: Record<string, () => { status: number; body: unknown } | Error>): FetchLike {
      return vi.fn(async (url: string) => {
        for (const [needle, handler] of Object.entries(handlers)) {
          if (url.includes(needle)) {
            const out = handler();
            if (out instanceof Error) throw out;
            return { ok: out.status < 400, status: out.status, statusText: String(out.status), json: async () => out.body };
          }
        }
        return { ok: false, status: 404, statusText: 'Not Found', json: async () => ({}) };
      });
    }

    it('downgrades a locally-missing but registry-resolvable dependency to a warning', async () => {
      const fetchImpl = registry({
        'some-dep': () => ({ status: 200, body: { name: 'some-dep', 'dist-tags': {}, versions: { '1.2.0': {}, '2.0.0': {} } } }),
      });
      const report = await validate(manifest({ dependencies: { 'some-dep': '^1.0.0' } }), undefined, {
        checkRegistry: true,
        fetchImpl,
      });
      expect(report.findings).toContainEqual(expect.objectContaining({ id: 'deps-not-installed', severity: 'warning' }));
      expect(report.valid).toBe(true);
    });

    it('errors when the registry has no matching version or no such package', async () => {
      const fetchImpl = registry({
        'old-dep': () => ({ status: 200, body: { name: 'old-dep', 'dist-tags': {}, versions: { '1.0.0': {} } } }),
      });
      const report = await validate(
        manifest({ dependencies: { 'old-dep': '^3.0.0', 'ghost-dep': '^1.0.0' } }),
        undefined,
        { checkRegistry: true, fetchImpl }
      );
      expect(report.findings.filter((f) => f.id === 'deps-unresolvable')).toHaveLength(2);
      expect(report.valid).toBe(false);
    });

    it('warns (does not claim success or failure) when the registry is unreachable', async () => {
      const fetchImpl = registry({ '': () => new Error('ECONNREFUSED') });
      const report = await validate(manifest({ dependencies: { dep: '^1.0.0' } }), undefined, {
        checkRegistry: true,
        fetchImpl,
      });
      expect(report.findings).toContainEqual(expect.objectContaining({ id: 'deps-registry-unreachable', severity: 'warning' }));
      expect(report.valid).toBe(true);
    });
  });
});

describe('validatePluginPath: static security scan', () => {
  const scan = async (source: string, man: Record<string, unknown> = manifest(), file = 'index.js') =>
    validate(man, { [file]: `exports.activate = () => {};\n${source}` });
  const find = (report: Awaited<ReturnType<typeof scan>>, id: string) => report.findings.filter((f) => f.id === id);

  it.each([
    ['eval(', 'eval(userCode);', 'security-eval'],
    ['global eval', 'globalThis.eval("1")', 'security-eval'],
    ['new Function', 'const f = new Function("a", "return a");', 'security-new-function'],
    ['Function()', 'const f = Function("return 1");', 'security-new-function'],
    ['constructor("...")', 'const f = (() => {}).constructor("return 1");', 'security-new-function'],
    ['vm', 'require("vm").runInNewContext(code);', 'security-eval'],
    ['timer string', 'setTimeout("doIt()", 10);', 'security-eval'],
  ])('flags %s as an error', async (_label, source, id) => {
    const report = await scan(source);
    const hits = find(report, id);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]).toMatchObject({ severity: 'error', file: 'index.js', category: 'security' });
    expect(report.valid).toBe(false);
    expect(report.checks.security).toBe('fail');
  });

  it('reports the line number of the finding', async () => {
    const report = await validate(manifest(), {
      'index.js': 'exports.activate = () => {};\n\n\nconst x = 1;\neval(y);\n',
    });
    expect(find(report, 'security-eval')[0].line).toBe(5);
  });

  it('does not flag eval/exec inside comments or string literals', async () => {
    const report = await scan(
      [
        '// eval(x) is dangerous; never use new Function() here',
        '/* child_process.exec(cmd); fetch("http://x"); */',
        'const doc = "call eval(code) or new Function(body) to run it";',
        'const re = /eval\\(/;',
        'const tpl = `require("child_process") and fetch(url)`;',
      ].join('\n')
    );
    expect(report.findings).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('does not flag lookalike identifiers', async () => {
    const report = await scan('const retrieval = medieval(1); obj.eval(2); const myFunction = (x) => x; myFunction(3);');
    expect(find(report, 'security-eval')).toHaveLength(0);
    expect(find(report, 'security-new-function')).toHaveLength(0);
  });

  it('flags a dynamic require built from user-controlled input as an error', async () => {
    for (const code of [
      'const m = require(process.argv[2]);',
      'const m = require(`./plugins/${options.name}`);',
      'const m = require(process.env.PLUGIN_PATH);',
      'const m = await import(args.module);',
      'const m = require("./x/" + req.query.name);',
    ]) {
      const report = await scan(code);
      expect(find(report, 'security-dynamic-require-input'), code).toHaveLength(1);
      expect(report.valid, code).toBe(false);
    }
  });

  it('warns for other non-literal requires, and ignores literal ones', async () => {
    const dynamic = await scan('const target = "./local"; const m = require(target);');
    expect(find(dynamic, 'security-dynamic-require')[0]).toMatchObject({ severity: 'warning' });
    expect(dynamic.valid).toBe(true);

    const literal = await scan('const a = require("./a"); const b = require(`./b`); const c = require.resolve(dynamicName);');
    expect(literal.findings.filter((f) => f.category === 'security')).toEqual([]);
  });

  it('flags child_process usage; a "process" permission downgrades it to info', async () => {
    const code = 'const { execSync } = require("child_process"); execSync("ls");';
    const undeclared = await scan(code);
    expect(find(undeclared, 'security-child-process')[0]).toMatchObject({ severity: 'warning' });

    const declared = await scan(code, manifest({ reshell: { permissions: [{ type: 'process', access: 'execute', description: 'runs ls' }] } }));
    expect(find(declared, 'security-child-process')[0]).toMatchObject({ severity: 'info' });
    expect(declared.valid).toBe(true);

    for (const importStyle of ['import cp from "node:child_process";', 'const cp = await import("child_process");', 'const x = require("execa");']) {
      expect(find(await scan(importStyle), 'security-child-process'), importStyle).toHaveLength(1);
    }
  });

  it('flags network calls; a "network" permission downgrades them to info', async () => {
    for (const code of [
      'fetch("https://example.com");',
      'const https = require("https");',
      'import http from "node:http";',
      'new XMLHttpRequest();',
      'new WebSocket("wss://x");',
      'const got = require("got");',
    ]) {
      const report = await scan(code);
      expect(find(report, 'security-network')[0], code).toMatchObject({ severity: 'warning' });
    }
    const declared = await scan(
      'fetch("https://example.com");',
      manifest({ reshell: { permissions: [{ type: 'network', access: 'read', description: 'reads api' }] } })
    );
    expect(find(declared, 'security-network')[0]).toMatchObject({ severity: 'info' });
    // A method named fetch on an object is not a network call.
    expect(find(await scan('repo.fetch(remote);'), 'security-network')).toHaveLength(0);
  });

  it('flags filesystem writes outside the plugin dir; sensitive targets are errors', async () => {
    const sensitive = await scan('require("fs").writeFileSync("/etc/passwd", "x");');
    expect(find(sensitive, 'security-fs-write-sensitive')[0]).toMatchObject({ severity: 'error' });
    expect(sensitive.valid).toBe(false);

    for (const code of [
      'fs.writeFileSync(os.homedir() + "/.config/x", d);',
      'fs.writeFile("../../escape.txt", d, cb);',
      'fs.appendFileSync("/var/log/x.log", d);',
      'fs.createWriteStream(path.join(os.tmpdir(), "x"));',
      'fse.outputFile("C:\\\\Users\\\\x\\\\y.txt", d);',
      'fs.rmSync("/tmp/other", { recursive: true });',
      'fs.mkdirSync(process.env.HOME + "/x");',
    ]) {
      const report = await scan(code);
      const outside = report.findings.filter((f) => f.id === 'security-fs-write-outside' || f.id === 'security-fs-write-sensitive');
      expect(outside.length, code).toBeGreaterThan(0);
    }

    const sshKey = await scan('fs.writeFileSync(os.homedir() + "/.ssh/authorized_keys", key);');
    expect(find(sshKey, 'security-fs-write-sensitive')).toHaveLength(1);
  });

  it('downgrades non-sensitive outside writes with a filesystem write permission', async () => {
    const report = await scan(
      'fs.writeFileSync(os.homedir() + "/.cache/x", d);',
      manifest({ reshell: { permissions: [{ type: 'filesystem', access: 'write', description: 'cache' }] } })
    );
    expect(find(report, 'security-fs-write-outside')[0]).toMatchObject({ severity: 'info' });
    expect(report.valid).toBe(true);
  });

  it('does not flag writes that stay inside the plugin directory', async () => {
    const report = await scan('fs.writeFileSync(path.join(__dirname, "state.json"), d); fs.mkdirSync(__dirname + "/cache");');
    expect(report.findings.filter((f) => f.category === 'security')).toEqual([]);
  });

  it('notes (info) writes whose target cannot be determined statically', async () => {
    const report = await scan('fs.writeFileSync(somePath, data);');
    expect(find(report, 'security-fs-write')[0]).toMatchObject({ severity: 'info' });
    expect(report.valid).toBe(true);
  });

  it('scans every source file in the package, not just the entry, and skips node_modules', async () => {
    const dir = await plugin(manifest(), {
      'index.js': 'exports.activate = () => {};',
      'lib/deep/helper.js': 'module.exports = (s) => eval(s);',
      'src/util.ts': 'export const f = new Function("return 1");',
      'types/index.d.ts': 'declare function eval(x: string): unknown;',
      'node_modules/dep/index.js': 'eval("not scanned");',
    });
    const report = await validatePluginPath(dir, { cliVersion: CLI });
    const files = report.findings.filter((f) => f.severity === 'error').map((f) => f.file).sort();
    expect(files).toEqual(['lib/deep/helper.js', 'src/util.ts']);
  });

  it('caps repeated findings per file and says so', async () => {
    const report = await scan('eval(a);\n'.repeat(12));
    expect(find(report, 'security-eval').filter((f) => f.severity === 'error')).toHaveLength(5);
    expect(find(report, 'security-eval').find((f) => f.severity === 'info')?.message).toContain('7 more');
  });

  it('flags a symlink that escapes the plugin directory', async () => {
    const dir = await plugin(manifest());
    await fs.symlink('/etc', path.join(dir, 'etc-link'), 'dir');
    await fs.symlink('./index.js', path.join(dir, 'inside-link'));
    const report = await validatePluginPath(dir, { cliVersion: CLI });
    const escapes = report.findings.filter((f) => f.id === 'security-symlink-escape');
    expect(escapes).toHaveLength(1);
    expect(escapes[0].file).toBe('etc-link');
    expect(report.valid).toBe(false);
  });

  it('warns about files above the scan limit instead of silently skipping them', async () => {
    const report = await validate(manifest(), { 'index.js': 'exports.activate = () => {};', 'big.js': 'x'.repeat(2000) }, { maxScanFileBytes: 1000 });
    expect(report.findings).toContainEqual(expect.objectContaining({ id: 'security-file-not-scanned', severity: 'warning', file: 'big.js' }));
  });
});

describe('validatePluginPath: size', () => {
  it('warns above the warning threshold and errors above the maximum', async () => {
    const files = { 'index.js': 'exports.activate = () => {};', 'data.bin': 'x'.repeat(5000) };
    const warn = await validate(manifest(), files, { warnSizeBytes: 1000, maxSizeBytes: 100000 });
    expect(warn.findings).toContainEqual(expect.objectContaining({ id: 'size-large', severity: 'warning' }));
    expect(warn.valid).toBe(true);
    expect(warn.size.bytes).toBeGreaterThan(5000);
    expect(warn.size.files).toBe(3);

    const err = await validate(manifest(), files, { warnSizeBytes: 1000, maxSizeBytes: 4000 });
    expect(err.findings).toContainEqual(expect.objectContaining({ id: 'size-too-large', severity: 'error' }));
    expect(err.valid).toBe(false);
  });

  it('does not count node_modules or .git toward the size', async () => {
    const dir = await plugin(manifest(), {
      'index.js': 'exports.activate = () => {};',
      'node_modules/huge/blob.bin': 'x'.repeat(10000),
      '.git/objects/pack': 'x'.repeat(10000),
    });
    const report = await validatePluginPath(dir, { cliVersion: CLI });
    expect(report.size.bytes).toBeLessThan(1000);
  });
});

describe('validatePluginPath: strict mode', () => {
  it('turns warnings into failures only when strict', async () => {
    const files = { 'index.js': 'exports.activate = () => {};\nfetch("https://x");' };
    const lenient = await validate(manifest(), files);
    expect(lenient.counts.warnings).toBeGreaterThan(0);
    expect(lenient.valid).toBe(true);
    expect(lenient.strict).toBe(false);

    const strict = await validate(manifest(), files, { strict: true });
    expect(strict.valid).toBe(false);
    expect(strict.strict).toBe(true);
    expect(strict.counts.errors).toBe(0);
  });
});

describe('lexSource / stripComments', () => {
  it('keeps offsets and line numbers aligned across both views', () => {
    const src = 'a /* x\ny */ b // c\n"str(" `t\nm` /re[/]x/ end';
    const { code, bare } = lexSource(src);
    expect(code).toHaveLength(src.length);
    expect(bare).toHaveLength(src.length);
    expect(code.split('\n')).toHaveLength(src.split('\n').length);
    expect(bare.split('\n')).toHaveLength(src.split('\n').length);
  });

  it('blanks comments in both views and literal bodies only in bare', () => {
    const { code, bare } = lexSource('x = "secret"; // note\ny = 1 /* c */');
    expect(code).toContain('"secret"');
    expect(bare).not.toContain('secret');
    expect(code).not.toContain('note');
    expect(bare).not.toContain('note');
    expect(stripComments('a // b\nc')).toBe('a     \nc');
  });

  it('copes with escapes and unterminated strings', () => {
    expect(() => lexSource('const s = "it\\"s"; const t = \'unterminated\nnext();')).not.toThrow();
    const { bare } = lexSource('const s = "a\\"eval(b)"; real();');
    expect(bare).not.toContain('eval');
    expect(bare).toContain('real()');
  });
});
