import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { planOperation, assertSafePackageSpecs } from '../../src/pkg/commands';
import {
  parseBundlerOutdated,
  parseBunOutdated,
  parseCargoOutdated,
  parseComposerOutdated,
  parseDotnetOutdated,
  parseGoOutdated,
  parseMavenOutdated,
  parseNpmOutdated,
  parsePipOutdated,
  parsePnpmOutdated,
  parsePoetryOutdated,
  parseYarnOutdated,
  parseOutdated,
  splitJsonStream,
} from '../../src/pkg/outdated';
import { PkgError, type Ecosystem, type PkgOperation } from '../../src/pkg/types';
import { pkgOutdatedSchema } from '@re-shell/contracts';

const FIX = path.resolve(__dirname, '..', 'fixtures', 'pkg');
const dirOf = (n: string): string => path.join(FIX, n);

function argvs(eco: Ecosystem, op: PkgOperation, packages: string[], dev = false, dir = dirOf(eco)): string[][] {
  return planOperation({ ecosystem: eco, operation: op, packages, dev, dir }).commands.map(c => c.argv);
}

describe('pkg planOperation: native argv per ecosystem and operation', () => {
  it('npm', () => {
    expect(argvs('npm', 'add', ['left-pad@1.0.0'])).toEqual([['npm', 'install', 'left-pad@1.0.0']]);
    expect(argvs('npm', 'add', ['vitest'], true)).toEqual([['npm', 'install', '--save-dev', 'vitest']]);
    expect(argvs('npm', 'remove', ['a', 'b'])).toEqual([['npm', 'uninstall', 'a', 'b']]);
    expect(argvs('npm', 'install', [])).toEqual([['npm', 'install']]);
    expect(argvs('npm', 'outdated', [])).toEqual([['npm', 'outdated', '--json']]);
  });

  it('pnpm', () => {
    expect(argvs('pnpm', 'add', ['x'])).toEqual([['pnpm', 'add', 'x']]);
    expect(argvs('pnpm', 'add', ['x'], true)).toEqual([['pnpm', 'add', '-D', 'x']]);
    expect(argvs('pnpm', 'remove', ['x'])).toEqual([['pnpm', 'remove', 'x']]);
    expect(argvs('pnpm', 'install', [])).toEqual([['pnpm', 'install']]);
    expect(argvs('pnpm', 'outdated', [])).toEqual([['pnpm', 'outdated', '--format', 'json']]);
  });

  it('yarn (classic) and berry outdated', () => {
    expect(argvs('yarn', 'add', ['x'], true)).toEqual([['yarn', 'add', '--dev', 'x']]);
    expect(argvs('yarn', 'remove', ['x'])).toEqual([['yarn', 'remove', 'x']]);
    expect(argvs('yarn', 'install', [])).toEqual([['yarn', 'install']]);
    expect(argvs('yarn', 'outdated', [])).toEqual([['yarn', 'outdated', '--json']]);
    const berry = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-berry-'));
    fs.writeFileSync(path.join(berry, '.yarnrc.yml'), '');
    expect(() => planOperation({ ecosystem: 'yarn', operation: 'outdated', packages: [], dev: false, dir: berry })).toThrow(
      /berry/
    );
    fs.rmSync(berry, { recursive: true, force: true });
  });

  it('bun', () => {
    expect(argvs('bun', 'add', ['x'], true)).toEqual([['bun', 'add', '--dev', 'x']]);
    expect(argvs('bun', 'remove', ['x'])).toEqual([['bun', 'remove', 'x']]);
    expect(argvs('bun', 'install', [])).toEqual([['bun', 'install']]);
    expect(argvs('bun', 'outdated', [])).toEqual([['bun', 'outdated']]);
  });

  it('pip uses python -m pip and records requirements via manifest edits', () => {
    const add = planOperation({ ecosystem: 'pip', operation: 'add', packages: ['requests==2.0'], dev: false, dir: dirOf('pip') });
    expect(add.commands[0].argv.slice(1)).toEqual(['-m', 'pip', 'install', 'requests==2.0']);
    expect(add.edits).toEqual([
      { kind: 'pip-requirements', file: path.join(dirOf('pip'), 'requirements.txt'), action: 'add', entries: ['requests==2.0'], phase: 'after' },
    ]);
    const dev = planOperation({ ecosystem: 'pip', operation: 'add', packages: ['pytest'], dev: true, dir: dirOf('pip') });
    expect(dev.edits[0].file).toBe(path.join(dirOf('pip'), 'requirements-dev.txt'));
    const rm = planOperation({ ecosystem: 'pip', operation: 'remove', packages: ['requests==2.0'], dev: false, dir: dirOf('pip') });
    expect(rm.commands[0].argv.slice(1)).toEqual(['-m', 'pip', 'uninstall', '-y', 'requests']);
    expect(rm.edits.map(e => path.basename(e.file)).sort()).toEqual(['requirements-dev.txt', 'requirements.txt']);
    const install = planOperation({ ecosystem: 'pip', operation: 'install', packages: [], dev: false, dir: dirOf('pip') });
    expect(install.commands[0].argv.slice(1)).toEqual(['-m', 'pip', 'install', '-r', 'requirements-dev.txt', '-r', 'requirements.txt']);
    expect(argvs('pip', 'outdated', [])[0].slice(1)).toEqual(['-m', 'pip', 'list', '--outdated', '--format', 'json']);
  });

  it('pip install without any requirements/pyproject is unsupported', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-pipempty-'));
    expect(() => planOperation({ ecosystem: 'pip', operation: 'install', packages: [], dev: false, dir })).toThrow(PkgError);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('poetry', () => {
    expect(argvs('poetry', 'add', ['x'])).toEqual([['poetry', 'add', 'x']]);
    expect(argvs('poetry', 'add', ['x'], true)).toEqual([['poetry', 'add', '--group', 'dev', 'x']]);
    expect(argvs('poetry', 'remove', ['x'], true)).toEqual([['poetry', 'remove', '--group', 'dev', 'x']]);
    expect(argvs('poetry', 'install', [])).toEqual([['poetry', 'install']]);
    expect(argvs('poetry', 'outdated', [])).toEqual([['poetry', 'show', '--outdated', '--top-level', '--no-ansi']]);
  });

  it('uv', () => {
    expect(argvs('uv', 'add', ['x'], true)).toEqual([['uv', 'add', '--dev', 'x']]);
    expect(argvs('uv', 'remove', ['x'])).toEqual([['uv', 'remove', 'x']]);
    expect(argvs('uv', 'install', [])).toEqual([['uv', 'sync']]);
    expect(argvs('uv', 'outdated', [])).toEqual([['uv', 'pip', 'list', '--outdated', '--format', 'json']]);
  });

  it('cargo', () => {
    expect(argvs('cargo', 'add', ['serde@1'], true)).toEqual([['cargo', 'add', '--dev', 'serde@1']]);
    expect(argvs('cargo', 'remove', ['serde'])).toEqual([['cargo', 'remove', 'serde']]);
    expect(argvs('cargo', 'install', [])).toEqual([['cargo', 'fetch']]);
    expect(argvs('cargo', 'outdated', [])).toEqual([['cargo', 'outdated', '--format', 'json', '--root-deps-only']]);
  });

  it('maven: add/remove are pom edits (no native command), install/outdated use mvn', () => {
    const add = planOperation({ ecosystem: 'maven', operation: 'add', packages: ['junit:junit:4.13.2'], dev: true, dir: dirOf('maven') });
    expect(add.edits).toEqual([
      { kind: 'maven-pom', file: path.join(dirOf('maven'), 'pom.xml'), action: 'add', entries: ['junit:junit:4.13.2'], phase: 'before' },
    ]);
    expect(add.commands.map(c => c.argv)).toEqual([['mvn', '-B', 'dependency:resolve']]);
    const rm = planOperation({ ecosystem: 'maven', operation: 'remove', packages: ['junit:junit'], dev: false, dir: dirOf('maven') });
    expect(rm.commands).toEqual([]);
    expect(rm.edits[0].action).toBe('remove');
    expect(argvs('maven', 'install', [])).toEqual([['mvn', '-B', 'dependency:resolve']]);
    expect(argvs('maven', 'outdated', [])[0]).toEqual([
      'mvn', '-B', 'versions:display-dependency-updates', '-DprocessDependencyManagement=false',
    ]);
  });

  it('gradle: edits the build file matching the dialect; outdated is explicitly unsupported', () => {
    const groovy = planOperation({ ecosystem: 'gradle', operation: 'add', packages: ['a:b:1'], dev: false, dir: dirOf('gradle') });
    expect(path.basename(groovy.edits[0].file)).toBe('build.gradle');
    const kts = planOperation({ ecosystem: 'gradle', operation: 'add', packages: ['a:b:1'], dev: false, dir: dirOf('gradle-kts') });
    expect(path.basename(kts.edits[0].file)).toBe('build.gradle.kts');
    expect(groovy.commands[0].argv).toEqual(['gradle', '--console=plain', 'dependencies']);
    expect(() => planOperation({ ecosystem: 'gradle', operation: 'outdated', packages: [], dev: false, dir: dirOf('gradle') })).toThrow(
      /no native outdated/
    );
  });

  it('dotnet: one command per package, @version -> --version, no dev scope', () => {
    expect(argvs('dotnet', 'add', ['Serilog@3.1.1', 'Dapper'])).toEqual([
      ['dotnet', 'add', 'App.csproj', 'package', 'Serilog', '--version', '3.1.1'],
      ['dotnet', 'add', 'App.csproj', 'package', 'Dapper'],
    ]);
    expect(argvs('dotnet', 'remove', ['Serilog'])).toEqual([['dotnet', 'remove', 'App.csproj', 'package', 'Serilog']]);
    expect(argvs('dotnet', 'install', [])).toEqual([['dotnet', 'restore']]);
    expect(argvs('dotnet', 'outdated', [])).toEqual([
      ['dotnet', 'list', 'App.csproj', 'package', '--outdated', '--format', 'json'],
    ]);
    expect(() => argvs('dotnet', 'add', ['x'], true)).toThrow(/--dev is not supported for dotnet/);
  });

  it('dotnet refuses to guess between multiple projects', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-dn-'));
    fs.writeFileSync(path.join(dir, 'A.csproj'), '<Project/>');
    fs.writeFileSync(path.join(dir, 'B.csproj'), '<Project/>');
    expect(() => planOperation({ ecosystem: 'dotnet', operation: 'add', packages: ['x'], dev: false, dir })).toThrow(/Multiple project files/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('composer', () => {
    expect(argvs('composer', 'add', ['monolog/monolog:^3'], true)).toEqual([
      ['composer', 'require', '--no-interaction', '--dev', 'monolog/monolog:^3'],
    ]);
    expect(argvs('composer', 'remove', ['x/y'])).toEqual([['composer', 'remove', '--no-interaction', 'x/y']]);
    expect(argvs('composer', 'install', [])).toEqual([['composer', 'install', '--no-interaction']]);
    expect(argvs('composer', 'outdated', [])).toEqual([['composer', 'outdated', '--format=json', '--direct', '--no-interaction']]);
  });

  it('bundler: one `bundle add` per gem, @version -> --version, dev -> development group', () => {
    expect(argvs('bundler', 'add', ['rake@13.0.0', 'rspec'], true)).toEqual([
      ['bundle', 'add', 'rake', '--version', '13.0.0', '--group', 'development'],
      ['bundle', 'add', 'rspec', '--group', 'development'],
    ]);
    expect(argvs('bundler', 'remove', ['rake', 'rspec'])).toEqual([['bundle', 'remove', 'rake', 'rspec']]);
    expect(argvs('bundler', 'install', [])).toEqual([['bundle', 'install']]);
    expect(argvs('bundler', 'outdated', [])).toEqual([['bundle', 'outdated', '--parseable']]);
  });

  it('go: remove uses @none, no dev scope', () => {
    expect(argvs('go', 'add', ['github.com/google/uuid@v1.6.0'])).toEqual([['go', 'get', 'github.com/google/uuid@v1.6.0']]);
    expect(argvs('go', 'remove', ['github.com/google/uuid@v1.6.0'])).toEqual([['go', 'get', 'github.com/google/uuid@none']]);
    expect(argvs('go', 'install', [])).toEqual([['go', 'mod', 'download']]);
    expect(argvs('go', 'outdated', [])).toEqual([['go', 'list', '-u', '-m', '-json', 'all']]);
    expect(() => argvs('go', 'add', ['x'], true)).toThrow(/--dev/);
  });

  it('exit codes 0 and 1 both mean success for outdated commands that signal via exit status', () => {
    for (const eco of ['npm', 'pnpm', 'yarn', 'bundler'] as Ecosystem[]) {
      const [c] = planOperation({ ecosystem: eco, operation: 'outdated', packages: [], dev: false, dir: dirOf(eco) }).commands;
      expect(c.okExitCodes, eco).toEqual([0, 1]);
    }
  });

  it('list has no commands', () => {
    expect(planOperation({ ecosystem: 'npm', operation: 'list', packages: [], dev: false, dir: dirOf('npm') }).commands).toEqual([]);
  });

  it('validates arguments', () => {
    expect(() => argvs('npm', 'add', [])).toThrow(/at least one package/);
    expect(() => argvs('npm', 'install', ['x'])).toThrow(/does not take package/);
    expect(() => argvs('npm', 'outdated', [], true)).toThrow(/--dev only applies/);
  });

  it('rejects flag-looking and control-character specs (argv injection)', () => {
    expect(() => assertSafePackageSpecs(['--registry=https://evil'])).toThrow(/looks like a flag/);
    expect(() => assertSafePackageSpecs(['-g'])).toThrow(PkgError);
    expect(() => assertSafePackageSpecs(['ok\nbad'])).toThrow(/control characters/);
    expect(() => assertSafePackageSpecs(['left-pad@1.0.0', '@scope/x'])).not.toThrow();
  });

  it('package specs are never shell-quoted or joined: they stay separate argv entries', () => {
    expect(argvs('npm', 'add', ['a b', '$(rm -rf /)'])[0]).toEqual(['npm', 'install', 'a b', '$(rm -rf /)']);
  });
});

describe('pkg outdated normalizers', () => {
  it('npm', () => {
    const rows = parseNpmOutdated(
      JSON.stringify({ 'is-odd': { current: '2.0.0', wanted: '2.0.0', latest: '3.0.1', dependent: 'x', location: '/x' } })
    );
    expect(rows).toEqual([{ name: 'is-odd', current: '2.0.0', wanted: '2.0.0', latest: '3.0.1', kind: null, ecosystem: 'npm' }]);
    expect(parseNpmOutdated('')).toEqual([]);
  });

  it('pnpm maps dependencyType to kind', () => {
    const rows = parsePnpmOutdated(
      JSON.stringify({
        'left-pad': { current: '1.0.0', latest: '1.3.0', wanted: '1.0.0', isDeprecated: true, dependencyType: 'devDependencies' },
        'is-odd': { current: '2.0.0', latest: '3.0.1', wanted: '2.0.0', isDeprecated: false, dependencyType: 'dependencies' },
      })
    );
    expect(rows.map(r => [r.name, r.kind])).toEqual([['left-pad', 'dev'], ['is-odd', 'prod']]);
  });

  it('yarn classic ndjson table', () => {
    const out = [
      '{"type":"warning","data":"package.json: No license field"}',
      '{"type":"info","data":"Color legend"}',
      '{"type":"table","data":{"head":["Package","Current","Wanted","Latest","Package Type","URL"],"body":[["is-odd","2.0.0","2.0.0","3.0.1","dependencies","https://x"],["left-pad","1.0.0","1.0.0","1.3.0","devDependencies","https://y"]]}}',
    ].join('\n');
    const rows = parseYarnOutdated(out);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ name: 'left-pad', current: '1.0.0', wanted: '1.0.0', latest: '1.3.0', kind: 'dev', ecosystem: 'yarn' });
    expect(parseYarnOutdated('')).toEqual([]);
  });

  it('bun table with (dev) markers', () => {
    const out = [
      'bun outdated v1.3.14 (0d9b296a)',
      '|--------------------------------------------|',
      '| Package        | Current | Update | Latest |',
      '|----------------|---------|--------|--------|',
      '| is-odd         | 2.0.0   | 2.0.0  | 3.0.1  |',
      '|----------------|---------|--------|--------|',
      '| left-pad (dev) | 1.0.0   | 1.0.0  | 1.3.0  |',
      '|--------------------------------------------|',
    ].join('\n');
    expect(parseBunOutdated(out)).toEqual([
      { name: 'is-odd', current: '2.0.0', wanted: '2.0.0', latest: '3.0.1', kind: 'prod', ecosystem: 'bun' },
      { name: 'left-pad', current: '1.0.0', wanted: '1.0.0', latest: '1.3.0', kind: 'dev', ecosystem: 'bun' },
    ]);
    expect(parseBunOutdated('bun outdated v1.3.14 (0d9b296a)\n')).toEqual([]);
    expect(() => parseBunOutdated('garbage that is not a table')).toThrow(/Unrecognized/);
  });

  it('pip / uv json', () => {
    const json = JSON.stringify([{ name: 'six', version: '1.15.0', latest_version: '1.17.0', latest_filetype: 'wheel' }]);
    expect(parsePipOutdated(json, 'pip')).toEqual([
      { name: 'six', current: '1.15.0', wanted: null, latest: '1.17.0', kind: null, ecosystem: 'pip' },
    ]);
    expect(parsePipOutdated(json, 'uv')[0].ecosystem).toBe('uv');
    expect(() => parsePipOutdated('not json')).toThrow(/Could not parse/);
  });

  it('poetry text table (real output)', () => {
    const out = 'attrs 21.2.0 26.1.0 Classes Without Boilerplate\nsix   1.15.0 1.17.0 Python 2 and 3 compatibility utilities\n';
    expect(parsePoetryOutdated(out).map(r => [r.name, r.current, r.latest])).toEqual([
      ['attrs', '21.2.0', '26.1.0'],
      ['six', '1.15.0', '1.17.0'],
    ]);
    expect(parsePoetryOutdated('')).toEqual([]);
  });

  it('cargo-outdated json (concatenated documents, --- means unavailable)', () => {
    const doc = (name: string): string =>
      JSON.stringify({
        crate_name: name,
        dependencies: [
          { name: 'serde', project: '1.0.100', compat: '1.0.210', latest: '1.0.215', kind: 'Normal', platform: null },
          { name: 'old', project: '0.1.0', compat: '---', latest: '---', kind: 'Development', platform: null },
        ],
      });
    const rows = parseCargoOutdated(`${doc('a')}\n${doc('b')}`);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'serde', current: '1.0.100', wanted: '1.0.210', latest: '1.0.215', kind: 'prod', ecosystem: 'cargo' });
  });

  it('maven versions plugin, including wrapped long names', () => {
    const out = [
      '[INFO] --- versions:2.18.0:display-dependency-updates (default-cli) @ x ---',
      '[INFO] The following dependencies in Dependencies have newer versions:',
      '[INFO]   junit:junit ................................................ 4.12 -> 4.13.2',
      '[INFO]   org.some.very.long.group.name:some-very-long-artifact-name-here ...',
      '[INFO]                                                  1.0.0 -> 2.1.0',
      '[INFO] ',
      '[INFO] The following dependencies in Dependency Management have newer versions:',
      '[INFO]   org.managed:managed ........................................ 1.0 -> 9.9',
      '[INFO] ',
      '[INFO] BUILD SUCCESS',
    ].join('\n');
    expect(parseMavenOutdated(out).map(r => [r.name, r.current, r.latest])).toEqual([
      ['junit:junit', '4.12', '4.13.2'],
      ['org.some.very.long.group.name:some-very-long-artifact-name-here', '1.0.0', '2.1.0'],
    ]);
    expect(parseMavenOutdated('[INFO] All dependencies are using the latest versions.')).toEqual([]);
  });

  it('dotnet list package json', () => {
    const json = JSON.stringify({
      version: 1,
      projects: [
        {
          path: '/x/App.csproj',
          frameworks: [
            {
              framework: 'net8.0',
              topLevelPackages: [
                { id: 'Newtonsoft.Json', requestedVersion: '12.0.1', resolvedVersion: '12.0.1', latestVersion: '13.0.3' },
                { id: 'Uptodate', requestedVersion: '1.0.0', resolvedVersion: '1.0.0' },
              ],
            },
          ],
        },
      ],
    });
    expect(parseDotnetOutdated(json)).toEqual([
      { name: 'Newtonsoft.Json', current: '12.0.1', wanted: null, latest: '13.0.3', kind: 'prod', ecosystem: 'dotnet' },
    ]);
  });

  it('composer outdated json drops up-to-date entries', () => {
    const json = JSON.stringify({
      installed: [
        { name: 'monolog/monolog', version: '2.0.0', latest: '3.5.0', 'latest-status': 'update-possible' },
        { name: 'ok/ok', version: '1.0.0', latest: '1.0.0', 'latest-status': 'up-to-date' },
      ],
    });
    expect(parseComposerOutdated(json)).toEqual([
      { name: 'monolog/monolog', current: '2.0.0', wanted: null, latest: '3.5.0', kind: null, ecosystem: 'composer' },
    ]);
  });

  it('bundler --parseable (real output)', () => {
    const out = 'rake (newest 13.4.2, installed 12.3.0, requested = 12.3.0)\nrack (newest 3.1.8, installed 2.2.0)\n';
    expect(parseBundlerOutdated(out)).toEqual([
      { name: 'rake', current: '12.3.0', wanted: null, latest: '13.4.2', kind: null, ecosystem: 'bundler' },
      { name: 'rack', current: '2.2.0', wanted: null, latest: '3.1.8', kind: null, ecosystem: 'bundler' },
    ]);
  });

  it('go list -u -m -json all skips main and up-to-date modules', () => {
    const out =
      '{"Path":"example.com/x","Main":true}\n' +
      '{"Path":"github.com/google/uuid","Version":"v1.3.0","Update":{"Path":"github.com/google/uuid","Version":"v1.6.0"}}\n' +
      '{"Path":"golang.org/x/sys","Version":"v0.18.0","Indirect":true,"Update":{"Version":"v0.20.0"}}\n' +
      '{"Path":"current/mod","Version":"v1.0.0"}\n';
    expect(parseGoOutdated(out)).toEqual([
      { name: 'github.com/google/uuid', current: 'v1.3.0', wanted: null, latest: 'v1.6.0', kind: 'prod', ecosystem: 'go' },
      { name: 'golang.org/x/sys', current: 'v0.18.0', wanted: null, latest: 'v0.20.0', kind: 'indirect', ecosystem: 'go' },
    ]);
  });

  it('splitJsonStream handles nested braces/strings and rejects truncation', () => {
    expect(splitJsonStream('{"a":"}"}\n{"b":{"c":1}}')).toEqual([{ a: '}' }, { b: { c: 1 } }]);
    expect(() => splitJsonStream('{"a":')).toThrow(/Truncated/);
  });

  it('every normalizer output satisfies the contracts schema', () => {
    const samples: Array<[Ecosystem, string]> = [
      ['npm', JSON.stringify({ a: { current: '1', wanted: '1', latest: '2' } })],
      ['pnpm', JSON.stringify({ a: { current: '1', wanted: '1', latest: '2', dependencyType: 'dependencies' } })],
      ['pip', JSON.stringify([{ name: 'a', version: '1', latest_version: '2' }])],
      ['go', '{"Path":"a","Version":"v1","Update":{"Version":"v2"}}'],
    ];
    for (const [eco, out] of samples) {
      for (const row of parseOutdated(eco, out)) expect(pkgOutdatedSchema.safeParse(row).success).toBe(true);
    }
  });
});
