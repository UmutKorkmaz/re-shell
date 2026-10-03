import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { detectEcosystems, detectNodeManager, isYarnBerry, resolvePythonForPip } from '../../src/pkg/detect';
import { listDependencies } from '../../src/pkg/manifests';
import { resolveEcosystem } from '../../src/pkg/engine';
import { PkgError, type Ecosystem } from '../../src/pkg/types';
import { pkgDependencySchema } from '@re-shell/contracts';

const FIX = path.resolve(__dirname, '..', 'fixtures', 'pkg');
const fixture = (name: string): string => path.join(FIX, name);

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rs-pkg-detect-'));
}

describe('pkg ecosystem detection', () => {
  const cases: Array<[string, Ecosystem]> = [
    ['npm', 'npm'],
    ['pnpm', 'pnpm'],
    ['yarn', 'yarn'],
    ['bun', 'bun'],
    ['pip', 'pip'],
    ['poetry', 'poetry'],
    ['uv', 'uv'],
    ['cargo', 'cargo'],
    ['maven', 'maven'],
    ['gradle', 'gradle'],
    ['gradle-kts', 'gradle'],
    ['dotnet', 'dotnet'],
    ['composer', 'composer'],
    ['bundler', 'bundler'],
    ['go', 'go'],
  ];

  it.each(cases)('fixture %s is detected as %s', (dir, eco) => {
    const found = detectEcosystems(fixture(dir));
    expect(found).toHaveLength(1);
    expect(found[0].ecosystem).toBe(eco);
    expect(found[0].reason.length).toBeGreaterThan(0);
  });

  it('reports every family when a directory is polyglot', () => {
    const found = detectEcosystems(fixture('ambiguous'));
    expect(found.map(f => f.ecosystem).sort()).toEqual(['go', 'npm']);
  });

  it('resolveEcosystem raises PKG_ECOSYSTEM_AMBIGUOUS with candidates for polyglot dirs', () => {
    try {
      resolveEcosystem(fixture('ambiguous'));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PkgError);
      expect((err as PkgError).code).toBe('PKG_ECOSYSTEM_AMBIGUOUS');
      expect((err as PkgError).details?.candidates).toHaveLength(2);
    }
  });

  it('--ecosystem override wins over ambiguity', () => {
    expect(resolveEcosystem(fixture('ambiguous'), 'go').ecosystem).toBe('go');
  });

  it('raises PKG_ECOSYSTEM_UNDETECTED for an empty directory', () => {
    const dir = tmp();
    try {
      resolveEcosystem(dir);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as PkgError).code).toBe('PKG_ECOSYSTEM_UNDETECTED');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('raises PKG_INVALID_ARGS for a missing directory', () => {
    expect(() => resolveEcosystem(path.join(os.tmpdir(), 'rs-definitely-missing-dir'))).toThrow(/does not exist/);
  });

  describe('node package manager selection', () => {
    it('uses the packageManager field when there is no lockfile', () => {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', packageManager: 'pnpm@9.15.9' }));
      expect(detectNodeManager(dir).ecosystem).toBe('pnpm');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('prefers a lockfile over the packageManager field', () => {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'x', packageManager: 'pnpm@9.15.9' }));
      fs.writeFileSync(path.join(dir, 'yarn.lock'), '');
      expect(detectNodeManager(dir).ecosystem).toBe('yarn');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('finds a workspace-root lockfile above a service directory', () => {
      const root = tmp();
      fs.writeFileSync(path.join(root, 'pnpm-lock.yaml'), '');
      const svc = path.join(root, 'services', 'api');
      fs.mkdirSync(svc, { recursive: true });
      fs.writeFileSync(path.join(svc, 'package.json'), '{"name":"api"}');
      const d = detectNodeManager(svc);
      expect(d.ecosystem).toBe('pnpm');
      expect(d.reason).toContain('workspace-root');
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('stops walking up at a .git boundary', () => {
      const root = tmp();
      fs.writeFileSync(path.join(root, 'yarn.lock'), '');
      const repo = path.join(root, 'repo');
      fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
      fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"api"}');
      expect(detectNodeManager(repo).ecosystem).toBe('npm');
      fs.rmSync(root, { recursive: true, force: true });
    });

    it('defaults to npm without any hint', () => {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x"}');
      const d = detectNodeManager(dir);
      expect(d.ecosystem).toBe('npm');
      expect(d.reason).toContain('defaulting');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('detects yarn berry from .yarnrc.yml or packageManager', () => {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ packageManager: 'yarn@4.1.0' }));
      expect(isYarnBerry(dir)).toBe(true);
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ packageManager: 'yarn@1.22.22' }));
      expect(isYarnBerry(dir)).toBe(false);
      fs.writeFileSync(path.join(dir, '.yarnrc.yml'), 'nodeLinker: node-modules');
      expect(isYarnBerry(dir)).toBe(true);
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('python tool selection', () => {
    it('pyproject without poetry/uv markers falls back to pip', () => {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname="x"\n');
      expect(detectEcosystems(dir)[0].ecosystem).toBe('pip');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('poetry.lock selects poetry even without [tool.poetry]', () => {
      const dir = tmp();
      fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname="x"\n');
      fs.writeFileSync(path.join(dir, 'poetry.lock'), '');
      expect(detectEcosystems(dir)[0].ecosystem).toBe('poetry');
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('prefers a project virtualenv interpreter for pip', () => {
      const dir = tmp();
      fs.mkdirSync(path.join(dir, '.venv', 'bin'), { recursive: true });
      fs.writeFileSync(path.join(dir, '.venv', 'bin', 'python'), '');
      expect(resolvePythonForPip(dir)).toBe(path.join(dir, '.venv', 'bin', 'python'));
      fs.rmSync(dir, { recursive: true, force: true });
    });
  });
});

describe('pkg list: manifests normalize to one shape', () => {
  const byName = (deps: ReturnType<typeof listDependencies>, name: string) => deps.find(d => d.name === name);

  it('every parsed entry satisfies the contracts schema (all fixtures)', () => {
    const all: Array<[string, Ecosystem]> = [
      ['npm', 'npm'], ['pnpm', 'pnpm'], ['yarn', 'yarn'], ['bun', 'bun'], ['pip', 'pip'], ['poetry', 'poetry'],
      ['uv', 'uv'], ['cargo', 'cargo'], ['maven', 'maven'], ['gradle', 'gradle'], ['gradle-kts', 'gradle'],
      ['dotnet', 'dotnet'], ['composer', 'composer'], ['bundler', 'bundler'], ['go', 'go'],
    ];
    for (const [dir, eco] of all) {
      const deps = listDependencies(fixture(dir), eco);
      expect(deps.length, `${dir} has dependencies`).toBeGreaterThan(0);
      for (const d of deps) expect(pkgDependencySchema.safeParse(d).success, `${dir}:${d.name}`).toBe(true);
    }
  });

  it('package.json: all four sections', () => {
    const deps = listDependencies(fixture('npm'), 'npm');
    expect(byName(deps, 'express')).toMatchObject({ requested: '^4.18.2', kind: 'prod' });
    expect(byName(deps, '@scope/lib')).toMatchObject({ requested: '~1.2.0', kind: 'prod' });
    expect(byName(deps, 'typescript')).toMatchObject({ kind: 'dev' });
    expect(byName(deps, 'fsevents')).toMatchObject({ kind: 'optional' });
    expect(byName(deps, 'react')).toMatchObject({ kind: 'peer' });
    expect(deps.every(d => d.manifest === 'package.json' && d.ecosystem === 'npm')).toBe(true);
  });

  it('requirements.txt: skips comments, options, includes and VCS urls; keeps extras/markers out of the name', () => {
    const deps = listDependencies(fixture('pip'), 'pip');
    expect(deps.map(d => d.name).sort()).toEqual(['Flask', 'black', 'numpy', 'pytest', 'requests']);
    expect(byName(deps, 'requests')).toMatchObject({ requested: '==2.31.0', kind: 'prod', manifest: 'requirements.txt' });
    expect(byName(deps, 'Flask')).toMatchObject({ requested: '>=2.3,<3' });
    expect(byName(deps, 'numpy')).toMatchObject({ requested: null });
    expect(byName(deps, 'pytest')).toMatchObject({ kind: 'dev', manifest: 'requirements-dev.txt' });
    expect(byName(deps, 'black')).toMatchObject({ requested: '==24.3.0' });
  });

  it('pyproject (poetry): skips python, handles table specs and groups', () => {
    const deps = listDependencies(fixture('poetry'), 'poetry');
    expect(byName(deps, 'python')).toBeUndefined();
    expect(byName(deps, 'fastapi')).toMatchObject({ requested: '^0.110', kind: 'prod' });
    expect(byName(deps, 'uvicorn')).toMatchObject({ requested: '^0.29', kind: 'prod' });
    expect(byName(deps, 'pytest')).toMatchObject({ requested: '^8.0', kind: 'dev' });
  });

  it('pyproject (PEP 621 / uv): dependencies, optional, dependency-groups', () => {
    const deps = listDependencies(fixture('uv'), 'uv');
    expect(byName(deps, 'httpx')).toMatchObject({ requested: '>=0.27', kind: 'prod' });
    expect(byName(deps, 'pydantic')).toMatchObject({ requested: '==2.6.4' });
    expect(byName(deps, 'click')).toMatchObject({ kind: 'optional' });
    expect(byName(deps, 'ruff')).toMatchObject({ kind: 'dev' });
    expect(deps.every(d => d.ecosystem === 'uv')).toBe(true);
  });

  it('Cargo.toml: dev/build/target tables and path deps', () => {
    const deps = listDependencies(fixture('cargo'), 'cargo');
    expect(byName(deps, 'serde')).toMatchObject({ requested: '1.0', kind: 'prod' });
    expect(byName(deps, 'tokio')).toMatchObject({ requested: '1.37' });
    expect(byName(deps, 'local-helper')).toMatchObject({ requested: 'path:../helper' });
    expect(byName(deps, 'tempfile')).toMatchObject({ kind: 'dev' });
    expect(byName(deps, 'cc')).toMatchObject({ kind: 'build' });
    expect(byName(deps, 'winapi')).toMatchObject({ kind: 'prod' });
  });

  it('pom.xml: direct deps only, resolves ${properties}, maps scope, ignores comments/management/plugins', () => {
    const deps = listDependencies(fixture('maven'), 'maven');
    expect(deps.map(d => d.name).sort()).toEqual([
      'com.google.guava:guava',
      'org.junit.jupiter:junit-jupiter',
      'org.slf4j:slf4j-api',
    ]);
    expect(byName(deps, 'org.slf4j:slf4j-api')).toMatchObject({ requested: '2.0.12', kind: 'prod' });
    expect(byName(deps, 'org.junit.jupiter:junit-jupiter')).toMatchObject({ kind: 'dev' });
  });

  it('build.gradle: string + map notation, test/compileOnly kinds, no comments', () => {
    const deps = listDependencies(fixture('gradle'), 'gradle');
    expect(byName(deps, 'com.google.guava:guava')).toMatchObject({ requested: '33.0.0-jre', kind: 'prod', manifest: 'build.gradle' });
    expect(byName(deps, 'org.apache.commons:commons-lang3')).toMatchObject({ requested: '3.14.0' });
    expect(byName(deps, 'org.projectlombok:lombok')).toMatchObject({ kind: 'build' });
    expect(byName(deps, 'org.junit.jupiter:junit-jupiter')).toMatchObject({ kind: 'dev' });
    expect(byName(deps, 'commented:out')).toBeUndefined();
  });

  it('build.gradle.kts: call notation', () => {
    const deps = listDependencies(fixture('gradle-kts'), 'gradle');
    expect(deps.map(d => d.name).sort()).toEqual(['com.squareup.okhttp3:okhttp', 'io.mockk:mockk']);
    expect(byName(deps, 'io.mockk:mockk')).toMatchObject({ kind: 'dev', manifest: 'build.gradle.kts' });
  });

  it('csproj: attribute + element Version, PrivateAssets => build', () => {
    const deps = listDependencies(fixture('dotnet'), 'dotnet');
    expect(byName(deps, 'Newtonsoft.Json')).toMatchObject({ requested: '13.0.3', kind: 'prod', manifest: 'App.csproj' });
    expect(byName(deps, 'Serilog')).toMatchObject({ requested: '3.1.1' });
    expect(byName(deps, 'StyleCop.Analyzers')).toMatchObject({ kind: 'build' });
  });

  it('composer.json: skips php and ext-*, maps require-dev', () => {
    const deps = listDependencies(fixture('composer'), 'composer');
    expect(deps.map(d => d.name).sort()).toEqual(['guzzlehttp/guzzle', 'monolog/monolog', 'phpunit/phpunit']);
    expect(byName(deps, 'phpunit/phpunit')).toMatchObject({ kind: 'dev', requested: '^10.5' });
  });

  it('Gemfile: versions, group blocks and inline group option', () => {
    const deps = listDependencies(fixture('bundler'), 'bundler');
    expect(byName(deps, 'rails')).toMatchObject({ requested: '~> 7.1, >= 7.1.3', kind: 'prod' });
    expect(byName(deps, 'pg')).toMatchObject({ requested: null, kind: 'prod' });
    expect(byName(deps, 'puma')).toMatchObject({ requested: '>= 5.0' });
    expect(byName(deps, 'rspec-rails')).toMatchObject({ kind: 'dev' });
    expect(byName(deps, 'debug')).toMatchObject({ kind: 'dev' });
    expect(byName(deps, 'redis')).toMatchObject({ kind: 'prod' });
    expect(byName(deps, 'rubocop')).toMatchObject({ kind: 'dev' });
  });

  it('go.mod: single + block requires, indirect flagged', () => {
    const deps = listDependencies(fixture('go'), 'go');
    expect(byName(deps, 'github.com/google/uuid')).toMatchObject({ requested: 'v1.6.0', kind: 'prod' });
    expect(byName(deps, 'github.com/gin-gonic/gin')).toMatchObject({ requested: 'v1.9.1', kind: 'prod' });
    expect(byName(deps, 'golang.org/x/sys')).toMatchObject({ kind: 'indirect' });
  });

  it('an unparseable manifest is an error, not an empty list', () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'package.json'), '{ not json');
    expect(() => listDependencies(dir, 'npm')).toThrow(/Failed to parse package.json/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
