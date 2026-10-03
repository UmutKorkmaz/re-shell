import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { jsonResponseSchema, pkgResponseSchema } from '@re-shell/contracts';

/**
 * Integration tests for `re-shell pkg ...` driving the BUILT CLI against the
 * REAL toolchains installed on the machine (registries must be reachable).
 * Every test works in its own temp directory. A toolchain that is not
 * installed skips its own suite only; the "missing toolchain" behaviour is
 * itself tested for real by running with an empty PATH.
 */

const CLI_PATH = path.resolve(process.cwd(), 'dist/index.js');
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-pkg-int-'));

function which(tool: string): boolean {
  return (process.env.PATH ?? '')
    .split(path.delimiter)
    .some(d => d && fs.existsSync(path.join(d, tool)));
}

interface CliRun {
  status: number;
  body: ReturnType<typeof parse>;
  raw: string;
}

function parse(stdout: string): { ok: boolean; data?: any; error?: any; warnings: string[] } {
  const lines = stdout.split('\n').filter(l => l.length > 0);
  expect(lines.length, `expected exactly one JSON line, got:\n${stdout}`).toBe(1);
  const json = JSON.parse(lines[0]);
  expect(jsonResponseSchema(pkgResponseSchema).safeParse(json).success || json.ok === false).toBe(true);
  return json;
}

function runCli(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): CliRun {
  const res = spawnSync(process.execPath, [CLI_PATH, ...args, '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, COMPOSER_ALLOW_SUPERUSER: '1', POETRY_VIRTUALENVS_IN_PROJECT: 'true', ...env },
  });
  return { status: res.status ?? 1, body: parse(res.stdout), raw: res.stdout };
}

function project(name: string, files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(SCRATCH, `${name}-`));
  for (const [f, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), content);
  }
  return dir;
}

const nodePkg = JSON.stringify({ name: 'int-node', version: '1.0.0', license: 'MIT' }, null, 2);
const names = (deps: Array<{ name: string }>): string[] => deps.map(d => d.name).sort();

beforeAll(() => {
  expect(fs.existsSync(CLI_PATH), 'dist/index.js must be built').toBe(true);
});
afterAll(() => fs.rmSync(SCRATCH, { recursive: true, force: true }));

describe('pkg: missing toolchain is an explicit error', () => {
  it('reports PKG_TOOLCHAIN_MISSING (exit 1) with the tool and a hint when the manager is not on PATH', () => {
    const dir = project('notool', { 'package.json': nodePkg, 'package-lock.json': '{}' });
    const emptyBin = fs.mkdtempSync(path.join(SCRATCH, 'emptybin-'));
    const r = runCli(['pkg', 'add', 'left-pad'], dir, { PATH: emptyBin });
    expect(r.status).toBe(1);
    expect(r.body.ok).toBe(false);
    expect(r.body.error.code).toBe('PKG_TOOLCHAIN_MISSING');
    expect(r.body.error.details).toMatchObject({ tool: 'npm', ecosystem: 'npm' });
    expect(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).toBe(nodePkg);
  });

  it.skipIf(which('dotnet'))('dotnet add without the .NET SDK installed fails with PKG_TOOLCHAIN_MISSING', () => {
    const dir = project('dn', {
      'App.csproj': '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>',
    });
    const r = runCli(['pkg', 'add', 'Serilog'], dir);
    expect(r.status).toBe(1);
    expect(r.body.error.code).toBe('PKG_TOOLCHAIN_MISSING');
    expect(r.body.error.details.tool).toBe('dotnet');
  });

  it('dry-run never needs the toolchain and executes nothing', () => {
    const dir = project('dry', { 'App.csproj': '<Project Sdk="Microsoft.NET.Sdk"/>' });
    const emptyBin = fs.mkdtempSync(path.join(SCRATCH, 'emptybin-'));
    const r = runCli(['pkg', 'add', 'Serilog@3.1.1', '--dry-run'], dir, { PATH: emptyBin });
    expect(r.status).toBe(0);
    expect(r.body.ok).toBe(true);
    expect(r.body.data.dryRun).toBe(true);
    expect(r.body.data.commands).toEqual([
      expect.objectContaining({
        argv: ['dotnet', 'add', 'App.csproj', 'package', 'Serilog', '--version', '3.1.1'],
        executed: false,
        exitCode: null,
      }),
    ]);
  });
});

describe('pkg: detection and error codes via the CLI', () => {
  it('PKG_ECOSYSTEM_UNDETECTED for an empty directory', () => {
    const dir = project('empty', {});
    const r = runCli(['pkg', 'list'], dir);
    expect(r.status).toBe(1);
    expect(r.body.error.code).toBe('PKG_ECOSYSTEM_UNDETECTED');
  });

  it('PKG_ECOSYSTEM_AMBIGUOUS lists candidates; --ecosystem resolves it', () => {
    const dir = project('mixed', {
      'package.json': nodePkg,
      'package-lock.json': '{}',
      'go.mod': 'module example.com/m\n\ngo 1.22\n\nrequire github.com/google/uuid v1.6.0\n',
    });
    const amb = runCli(['pkg', 'list'], dir);
    expect(amb.body.error.code).toBe('PKG_ECOSYSTEM_AMBIGUOUS');
    expect(amb.body.error.details.candidates.map((c: any) => c.ecosystem).sort()).toEqual(['go', 'npm']);
    const go = runCli(['pkg', 'list', '--ecosystem', 'go'], dir);
    expect(go.status).toBe(0);
    expect(names(go.body.data.dependencies)).toEqual(['github.com/google/uuid']);
  });

  it('PKG_INVALID_ARGS for flag-looking package specs and for --dev on go', () => {
    const dir = project('args', { 'go.mod': 'module example.com/m\n\ngo 1.22\n' });
    // a bare unknown option is rejected by commander (non-JSON, non-zero)
    const flag = spawnSync(process.execPath, [CLI_PATH, 'pkg', 'add', '--registry=https://evil.invalid', '--dry-run'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(flag.status).not.toBe(0);
    // `--` forces it through as a package spec, which pkg itself refuses
    const forced = spawnSync(process.execPath, [CLI_PATH, 'pkg', 'add', '--dry-run', '--json', '--', '--registry=x'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(JSON.parse(forced.stdout.trim()).error.code).toBe('PKG_INVALID_ARGS');
    const dev = runCli(['pkg', 'add', 'github.com/x/y', '--dev', '--dry-run'], dir);
    expect(dev.body.error.code).toBe('PKG_INVALID_ARGS');
  });

  it('--service resolves the directory from the workspace config, per service ecosystem', () => {
    const root = project('ws', {
      're-shell.workspaces.yaml': [
        'name: ws-demo',
        'version: 2.0.0',
        'services:',
        '  api:',
        '    name: api',
        '    type: backend',
        '    language: typescript',
        '    framework: express',
        '    path: services/api',
        '    port: 3000',
        '  engine:',
        '    name: engine',
        '    type: backend',
        '    language: go',
        '    framework: gin',
        '    path: services/engine',
        '    port: 3001',
        '',
      ].join('\n'),
      'services/api/package.json': nodePkg,
      'services/api/pnpm-lock.yaml': '',
      'services/engine/go.mod': 'module example.com/engine\n\ngo 1.22\n',
    });
    const api = runCli(['pkg', 'add', 'zod', '--service', 'api', '--dry-run'], root);
    expect(api.body.data.ecosystem).toBe('pnpm');
    expect(api.body.data.service).toBe('api');
    expect(api.body.data.commands[0].argv).toEqual(['pnpm', 'add', 'zod']);
    expect(api.body.data.commands[0].cwd).toBe(path.join(root, 'services', 'api'));
    const engine = runCli(['pkg', 'add', 'github.com/google/uuid', '--service', 'engine', '--dry-run'], root);
    expect(engine.body.data.ecosystem).toBe('go');
    const missing = runCli(['pkg', 'list', '--service', 'nope'], root);
    expect(missing.body.error.code).toBe('PKG_INVALID_ARGS');
    expect(missing.body.error.details.available).toEqual(['api', 'engine']);
    const both = runCli(['pkg', 'list', '--service', 'api', '--path', '.'], root);
    expect(both.body.error.code).toBe('PKG_INVALID_ARGS');
  });

  it('--service outside a workspace is WORKSPACE_NOT_FOUND', () => {
    const dir = project('nows', { 'package.json': nodePkg });
    const r = runCli(['pkg', 'list', '--service', 'x'], dir);
    expect(r.body.error.code).toBe('WORKSPACE_NOT_FOUND');
  });
});

describe.skipIf(!which('npm'))('pkg: npm (real)', () => {
  it('add / list / outdated / remove / install against the real registry', () => {
    const dir = project('npm', {
      'package.json': JSON.stringify({ name: 'int-npm', version: '1.0.0', license: 'MIT' }),
      'package-lock.json': '',
    });
    const add = runCli(['pkg', 'add', 'is-odd@2.0.0'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(add.body.data.ecosystem).toBe('npm');
    expect(add.body.data.commands[0]).toMatchObject({ argv: ['npm', 'install', 'is-odd@2.0.0'], executed: true, exitCode: 0 });
    const addDev = runCli(['pkg', 'add', 'left-pad@1.0.0', '--dev'], dir);
    expect(addDev.status, addDev.raw).toBe(0);

    const list = runCli(['pkg', 'list'], dir);
    expect(list.body.data.dependencies).toEqual([
      expect.objectContaining({ name: 'is-odd', kind: 'prod' }),
      expect.objectContaining({ name: 'left-pad', kind: 'dev' }),
    ]);

    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(names(outdated.body.data.outdated)).toEqual(['is-odd', 'left-pad']);
    const isOdd = outdated.body.data.outdated.find((o: any) => o.name === 'is-odd');
    expect(isOdd.current).toBe('2.0.0');
    expect(isOdd.latest).not.toBe('2.0.0');
    expect(isOdd.kind).toBe('prod');

    const rm = runCli(['pkg', 'remove', 'is-odd'], dir);
    expect(rm.status, rm.raw).toBe(0);
    expect(names(runCli(['pkg', 'list'], dir).body.data.dependencies)).toEqual(['left-pad']);

    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true });
    const install = runCli(['pkg', 'install'], dir);
    expect(install.status, install.raw).toBe(0);
    expect(fs.existsSync(path.join(dir, 'node_modules', 'left-pad'))).toBe(true);
  });

  it('a package that does not exist fails with PKG_COMMAND_FAILED and leaves package.json untouched', () => {
    const dir = project('npm-bad', { 'package.json': nodePkg, 'package-lock.json': '' });
    const r = runCli(['pkg', 'add', 'this-package-definitely-does-not-exist-re-shell-xyz'], dir);
    expect(r.status).toBe(1);
    expect(r.body.error.code).toBe('PKG_COMMAND_FAILED');
    expect(r.body.error.details.argv[0]).toBe('npm');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies).toBeUndefined();
  });
});

describe.skipIf(!which('pnpm'))('pkg: pnpm (real)', () => {
  it('add / outdated / remove', () => {
    const dir = project('pnpm', { 'package.json': nodePkg, 'pnpm-lock.yaml': '' });
    const add = runCli(['pkg', 'add', 'is-odd@2.0.0'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(add.body.data.ecosystem).toBe('pnpm');
    const addDev = runCli(['pkg', 'add', 'left-pad@1.0.0', '--dev'], dir);
    expect(addDev.status, addDev.raw).toBe(0);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(outdated.body.data.outdated.map((o: any) => [o.name, o.kind]).sort()).toEqual([
      ['is-odd', 'prod'],
      ['left-pad', 'dev'],
    ]);
    const rm = runCli(['pkg', 'remove', 'left-pad'], dir);
    expect(rm.status, rm.raw).toBe(0);
    expect(names(runCli(['pkg', 'list'], dir).body.data.dependencies)).toEqual(['is-odd']);
  });
});

describe.skipIf(!which('yarn'))('pkg: yarn classic (real)', () => {
  it('add / outdated / remove', () => {
    const dir = project('yarn', { 'package.json': nodePkg, 'yarn.lock': '# yarn lockfile v1\n' });
    const add = runCli(['pkg', 'add', 'is-odd@2.0.0'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(add.body.data.ecosystem).toBe('yarn');
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(outdated.body.data.outdated).toEqual([
      expect.objectContaining({ name: 'is-odd', current: '2.0.0', kind: 'prod', ecosystem: 'yarn' }),
    ]);
    expect(runCli(['pkg', 'remove', 'is-odd'], dir).status).toBe(0);
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([]);
  });
});

describe.skipIf(!which('bun'))('pkg: bun (real)', () => {
  it('add / outdated / remove', () => {
    const dir = project('bun', { 'package.json': nodePkg, 'bun.lock': '' });
    const add = runCli(['pkg', 'add', 'is-odd@2.0.0'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(add.body.data.ecosystem).toBe('bun');
    expect(runCli(['pkg', 'add', 'left-pad@1.0.0', '--dev'], dir).status).toBe(0);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(outdated.body.data.outdated.map((o: any) => [o.name, o.kind]).sort()).toEqual([
      ['is-odd', 'prod'],
      ['left-pad', 'dev'],
    ]);
    expect(runCli(['pkg', 'remove', 'is-odd'], dir).status).toBe(0);
    expect(names(runCli(['pkg', 'list'], dir).body.data.dependencies)).toEqual(['left-pad']);
  });
});

describe.skipIf(!which('python3'))('pkg: pip in a project venv (real)', () => {
  it('install / add / outdated / remove, keeping requirements.txt in sync', () => {
    const dir = project('pip', { 'requirements.txt': 'six==1.15.0\n' });
    const venv = spawnSync('python3', ['-m', 'venv', '.venv'], { cwd: dir, encoding: 'utf8' });
    expect(venv.status, venv.stderr).toBe(0);

    const install = runCli(['pkg', 'install'], dir);
    expect(install.status, install.raw).toBe(0);
    expect(install.body.data.commands[0].argv[0]).toBe(path.join(dir, '.venv', 'bin', 'python'));
    expect(install.body.data.warnings ?? install.body.warnings).toEqual([]);

    const add = runCli(['pkg', 'add', 'idna==3.4'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf8')).toBe('six==1.15.0\nidna==3.4\n');
    expect(add.body.data.manifestEdits).toEqual([
      expect.objectContaining({ action: 'add', entries: ['idna==3.4'], applied: true, changed: true }),
    ]);

    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(names(outdated.body.data.outdated)).toEqual(['idna', 'six']);

    const rm = runCli(['pkg', 'remove', 'idna'], dir);
    expect(rm.status, rm.raw).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf8')).toBe('six==1.15.0\n');
    const pipList = spawnSync(path.join(dir, '.venv', 'bin', 'python'), ['-m', 'pip', 'list', '--format', 'freeze'], { encoding: 'utf8' });
    expect(pipList.stdout).toContain('six==1.15.0');
    expect(pipList.stdout).not.toContain('idna');
  });

  it('a failed pip install does not write the requirement', () => {
    const dir = project('pip-bad', { 'requirements.txt': 'six==1.15.0\n' });
    spawnSync('python3', ['-m', 'venv', '.venv'], { cwd: dir });
    const r = runCli(['pkg', 'add', 'this-package-does-not-exist-re-shell-xyz==9.9'], dir);
    expect(r.status).toBe(1);
    expect(r.body.error.code).toBe('PKG_COMMAND_FAILED');
    expect(fs.readFileSync(path.join(dir, 'requirements.txt'), 'utf8')).toBe('six==1.15.0\n');
  });
});

describe.skipIf(!which('poetry'))('pkg: poetry (real)', () => {
  it('add / list / outdated / remove', () => {
    const dir = project('poetry', {
      'pyproject.toml': [
        '[tool.poetry]',
        'name = "int-poetry"',
        'version = "0.1.0"',
        'description = ""',
        'authors = ["t <t@example.com>"]',
        '',
        '[tool.poetry.dependencies]',
        'python = ">=3.9"',
        '',
        '[build-system]',
        'requires = ["poetry-core"]',
        'build-backend = "poetry.core.masonry.api"',
        '',
      ].join('\n'),
    });
    const add = runCli(['pkg', 'add', 'six@1.15.0'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(add.body.data.ecosystem).toBe('poetry');
    expect(runCli(['pkg', 'add', 'attrs==21.2.0', '--dev'], dir).status).toBe(0);
    const list = runCli(['pkg', 'list'], dir);
    expect(list.body.data.dependencies.map((d: any) => [d.name, d.kind]).sort()).toEqual([
      ['attrs', 'dev'],
      ['six', 'prod'],
    ]);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(names(outdated.body.data.outdated)).toEqual(['attrs', 'six']);
    expect(runCli(['pkg', 'remove', 'six'], dir).status).toBe(0);
    expect(names(runCli(['pkg', 'list'], dir).body.data.dependencies)).toEqual(['attrs']);
  });
});

describe.skipIf(!which('uv'))('pkg: uv (real)', () => {
  it('add / list / outdated / install / remove', () => {
    const dir = project('uv', {
      'pyproject.toml': '[project]\nname = "int-uv"\nversion = "0.1.0"\nrequires-python = ">=3.9"\ndependencies = []\n',
    });
    const add = runCli(['pkg', 'add', 'six==1.15.0', '--ecosystem', 'uv'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(runCli(['pkg', 'add', 'attrs==21.2.0', '--dev'], dir).body.data.ecosystem).toBe('uv'); // uv.lock now detected
    const list = runCli(['pkg', 'list'], dir);
    expect(list.body.data.dependencies.map((d: any) => [d.name, d.kind]).sort()).toEqual([
      ['attrs', 'dev'],
      ['six', 'prod'],
    ]);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(names(outdated.body.data.outdated)).toEqual(['attrs', 'six']);
    expect(runCli(['pkg', 'install'], dir).status).toBe(0);
    expect(runCli(['pkg', 'remove', 'six'], dir).status).toBe(0);
    expect(names(runCli(['pkg', 'list'], dir).body.data.dependencies)).toEqual(['attrs']);
  });
});

describe.skipIf(!which('cargo'))('pkg: cargo (real)', () => {
  it('add / list / install / remove', () => {
    const dir = project('cargo', {
      'Cargo.toml': '[package]\nname = "int-cargo"\nversion = "0.1.0"\nedition = "2021"\n',
      'src/main.rs': 'fn main() {}\n',
    });
    const add = runCli(['pkg', 'add', 'itoa@=1.0.0'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(runCli(['pkg', 'add', 'tempfile', '--dev'], dir).status).toBe(0);
    const list = runCli(['pkg', 'list'], dir);
    expect(list.body.data.dependencies.map((d: any) => [d.name, d.kind])).toEqual([
      ['itoa', 'prod'],
      ['tempfile', 'dev'],
    ]);
    expect(list.body.data.dependencies[0].requested).toBe('=1.0.0');
    expect(runCli(['pkg', 'install'], dir).status).toBe(0);
    expect(runCli(['pkg', 'remove', 'tempfile', '--dev'], dir).status).toBe(0);
    expect(names(runCli(['pkg', 'list'], dir).body.data.dependencies)).toEqual(['itoa']);
  });

  it.skipIf(!spawnSync('cargo', ['outdated', '--version'], { encoding: 'utf8' }).stdout)(
    'outdated uses cargo-outdated and normalizes its JSON',
    () => {
      const dir = project('cargo-out', {
        'Cargo.toml': '[package]\nname = "int-cargo-out"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\nitoa = "=1.0.0"\n',
        'src/main.rs': 'fn main() {}\n',
      });
      const r = runCli(['pkg', 'outdated'], dir);
      expect(r.status, r.raw).toBe(0);
      expect(r.body.data.outdated).toEqual([
        expect.objectContaining({ name: 'itoa', current: '1.0.0', kind: 'prod', ecosystem: 'cargo' }),
      ]);
      expect(r.body.data.outdated[0].latest).not.toBe('1.0.0');
    }
  );

  it.skipIf(!!spawnSync('cargo', ['outdated', '--version'], { encoding: 'utf8' }).stdout)(
    'outdated without cargo-outdated installed is PKG_TOOLCHAIN_MISSING with an install hint',
    () => {
      const dir = project('cargo-noplugin', {
        'Cargo.toml': '[package]\nname = "x"\nversion = "0.1.0"\nedition = "2021"\n',
        'src/main.rs': 'fn main() {}\n',
      });
      const r = runCli(['pkg', 'outdated'], dir);
      expect(r.body.error.code).toBe('PKG_TOOLCHAIN_MISSING');
      expect(r.body.error.details.hint).toContain('cargo install cargo-outdated');
    }
  );
});

describe.skipIf(!which('go'))('pkg: go modules (real)', () => {
  it('add / list / outdated / install / remove', () => {
    const dir = project('go', {
      'go.mod': 'module example.com/int\n\ngo 1.21\n',
      'main.go': 'package main\n\nimport _ "github.com/google/uuid"\n\nfunc main() {}\n',
    });
    const add = runCli(['pkg', 'add', 'github.com/google/uuid@v1.3.0'], dir);
    expect(add.status, add.raw).toBe(0);
    const list = runCli(['pkg', 'list'], dir);
    // `go get` records the requirement with `// indirect` until `go mod tidy`; list reports go.mod as written.
    expect(list.body.data.dependencies).toEqual([
      expect.objectContaining({ name: 'github.com/google/uuid', requested: 'v1.3.0', kind: 'indirect' }),
    ]);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(outdated.body.data.outdated).toEqual([
      expect.objectContaining({ name: 'github.com/google/uuid', current: 'v1.3.0', ecosystem: 'go' }),
    ]);
    expect(outdated.body.data.outdated[0].latest).not.toBe('v1.3.0');
    expect(runCli(['pkg', 'install'], dir).status).toBe(0);
    fs.writeFileSync(path.join(dir, 'main.go'), 'package main\n\nfunc main() {}\n');
    const rm = runCli(['pkg', 'remove', 'github.com/google/uuid'], dir);
    expect(rm.status, rm.raw).toBe(0);
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([]);
  });
});

describe.skipIf(!which('mvn'))('pkg: maven (real)', () => {
  it('add edits the pom and resolves; outdated parses versions-maven-plugin; remove edits the pom', () => {
    const dir = project('mvn', {
      'pom.xml': [
        '<project xmlns="http://maven.apache.org/POM/4.0.0">',
        '  <modelVersion>4.0.0</modelVersion>',
        '  <groupId>com.acme</groupId>',
        '  <artifactId>int-mvn</artifactId>',
        '  <version>1.0</version>',
        '</project>',
        '',
      ].join('\n'),
    });
    const add = runCli(['pkg', 'add', 'junit:junit:4.12', '--dev'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(add.body.data.manifestEdits).toEqual([expect.objectContaining({ applied: true, changed: true })]);
    expect(fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8')).toMatch(/<artifactId>junit<\/artifactId>\s*<version>4\.12<\/version>\s*<scope>test<\/scope>/);

    const list = runCli(['pkg', 'list'], dir);
    expect(list.body.data.dependencies).toEqual([
      expect.objectContaining({ name: 'junit:junit', requested: '4.12', kind: 'dev' }),
    ]);

    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(outdated.body.data.outdated).toEqual([
      expect.objectContaining({ name: 'junit:junit', current: '4.12', ecosystem: 'maven', kind: 'dev' }),
    ]);

    const rm = runCli(['pkg', 'remove', 'junit:junit'], dir);
    expect(rm.status, rm.raw).toBe(0);
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([]);
  }, 300_000);

  it('an unresolvable dependency fails and rolls the pom back', () => {
    const pom = '<project xmlns="http://maven.apache.org/POM/4.0.0">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>g</groupId>\n  <artifactId>a</artifactId>\n  <version>1</version>\n</project>\n';
    const dir = project('mvn-bad', { 'pom.xml': pom });
    const r = runCli(['pkg', 'add', 'no.such.group:no-such-artifact:9.9.9'], dir);
    expect(r.status).toBe(1);
    expect(r.body.error.code).toBe('PKG_COMMAND_FAILED');
    expect(fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8')).toBe(pom);
  }, 300_000);
});

describe.skipIf(!which('gradle'))('pkg: gradle (real)', () => {
  it('add edits build.gradle and resolves; outdated is explicitly unsupported', () => {
    const dir = project('gradle', {
      'build.gradle': "plugins { id 'java' }\nrepositories { mavenCentral() }\n",
      'settings.gradle': "rootProject.name = 'int-gradle'\n",
    });
    const add = runCli(['pkg', 'add', 'junit:junit:4.13.2', '--dev'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(fs.readFileSync(path.join(dir, 'build.gradle'), 'utf8')).toContain("testImplementation 'junit:junit:4.13.2'");
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([
      expect.objectContaining({ name: 'junit:junit', requested: '4.13.2', kind: 'dev' }),
    ]);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status).toBe(1);
    expect(outdated.body.error.code).toBe('PKG_UNSUPPORTED_OPERATION');
    const bad = runCli(['pkg', 'add', 'no.such.group:no-such-artifact:9.9.9'], dir);
    expect(bad.body.error.code).toBe('PKG_COMMAND_FAILED');
    expect(fs.readFileSync(path.join(dir, 'build.gradle'), 'utf8')).not.toContain('no-such-artifact');
    expect(runCli(['pkg', 'remove', 'junit:junit'], dir).status).toBe(0);
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([]);
  }, 400_000);
});

describe.skipIf(!which('bundle'))('pkg: bundler (real)', () => {
  it('add / list / outdated / remove', () => {
    const dir = project('bundler', { Gemfile: 'source "https://rubygems.org"\n' });
    const add = runCli(['pkg', 'add', 'rake@12.3.0'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([
      expect.objectContaining({ name: 'rake', requested: '= 12.3.0', kind: 'prod' }),
    ]);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(outdated.body.data.outdated).toEqual([
      expect.objectContaining({ name: 'rake', current: '12.3.0', ecosystem: 'bundler', kind: 'prod' }),
    ]);
    expect(runCli(['pkg', 'install'], dir).status).toBe(0);
    expect(runCli(['pkg', 'remove', 'rake'], dir).status).toBe(0);
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([]);
  }, 300_000);
});

describe.skipIf(!which('composer') || !which('php'))('pkg: composer (real, local path repository)', () => {
  it('require / list / outdated / remove / install without network access to packagist', () => {
    const dir = project('composer', {
      'composer.json': JSON.stringify(
        {
          name: 'acme/int-composer',
          repositories: [{ type: 'path', url: './lib', options: { symlink: false } }, { packagist: false }],
          'minimum-stability': 'dev',
        },
        null,
        2
      ),
      'lib/composer.json': JSON.stringify({ name: 'acme/lib', version: '1.2.3', autoload: { 'psr-4': { 'Acme\\Lib\\': 'src/' } } }),
      'lib/src/Hello.php': '<?php namespace Acme\\Lib; class Hello {}\n',
    });
    const add = runCli(['pkg', 'add', 'acme/lib:1.2.3'], dir);
    expect(add.status, add.raw).toBe(0);
    expect(add.body.data.ecosystem).toBe('composer');
    const list = runCli(['pkg', 'list'], dir);
    expect(list.body.data.dependencies).toEqual([
      expect.objectContaining({ name: 'acme/lib', requested: '1.2.3', kind: 'prod' }),
    ]);
    expect(fs.existsSync(path.join(dir, 'vendor', 'acme', 'lib', 'src', 'Hello.php'))).toBe(true);
    const outdated = runCli(['pkg', 'outdated'], dir);
    expect(outdated.status, outdated.raw).toBe(0);
    expect(outdated.body.data.outdated).toEqual([]);
    fs.rmSync(path.join(dir, 'vendor'), { recursive: true, force: true });
    expect(runCli(['pkg', 'install'], dir).status).toBe(0);
    expect(fs.existsSync(path.join(dir, 'vendor', 'acme', 'lib'))).toBe(true);
    expect(runCli(['pkg', 'remove', 'acme/lib'], dir).status).toBe(0);
    expect(runCli(['pkg', 'list'], dir).body.data.dependencies).toEqual([]);
  }, 300_000);
});
