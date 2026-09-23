import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  detectLanguage,
  detectFramework,
  getBuildCommand,
  getOutputPath,
  filterServices,
  scanWorkspace,
  buildService,
  printBuildResults,
  type ServiceInfo,
  type PolyglotBuildOptions,
} from '../../src/utils/polyglot-build';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-polyglot-'));
});

afterEach(() => {
  fs.removeSync(tmp);
});

/** Create a service directory populated with the given manifest files. */
async function makeService(
  relPath: string,
  files: Record<string, unknown>,
): Promise<string> {
  const dir = path.join(tmp, relPath);
  await fs.ensureDir(dir);
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    if (content !== null && typeof content === 'object') {
      await fs.writeJson(full, content);
    } else {
      await fs.writeFile(full, String(content));
    }
  }
  return dir;
}

describe('detectLanguage', () => {
  it('returns typescript when package.json depends on typescript', async () => {
    const dir = await makeService('ts', {
      'package.json': { devDependencies: { typescript: '^5.0.0' } },
    });
    expect(detectLanguage(dir)).toBe('typescript');
  });

  it('returns javascript when package.json has no typescript dependency', async () => {
    const dir = await makeService('js', {
      'package.json': { dependencies: { express: '^4.0.0' } },
    });
    expect(detectLanguage(dir)).toBe('javascript');
  });

  it.each([
    ['requirements.txt', 'flask==2.0.0'],
    ['setup.py', 'from setuptools import setup'],
    ['pyproject.toml', '[tool.poetry]'],
    ['Pipfile', '[[source]]'],
    ['poetry.lock', '[[package]]'],
  ])('returns python when %s is present', async (file, content) => {
    const dir = await makeService(`py-${file}`, { [file]: content });
    expect(detectLanguage(dir)).toBe('python');
  });

  it.each([
    ['go.mod', 'module example\n\ngo 1.20'],
    ['Cargo.toml', '[package]\nname = "x"'],
    ['pom.xml', '<project></project>'],
    ['build.gradle', "plugins { id 'java' }"],
    ['build.gradle.kts', 'plugins { kotlin("jvm") }'],
    ['composer.json', { require: { 'php': '^8.0' } }],
    ['Gemfile', "source 'https://rubygems.org'"],
  ])('returns the right language when %s is present', async (file, content) => {
    const expected =
      file === 'go.mod' ? 'go'
      : file === 'Cargo.toml' ? 'rust'
      : file.startsWith('build.gradle') || file === 'pom.xml' ? 'java'
      : file === 'composer.json' ? 'php'
      : 'ruby';
    const dir = await makeService(`l-${file}`, { [file]: content });
    expect(detectLanguage(dir)).toBe(expected);
  });

  it('returns csharp when a .csproj or project.json file is present', async () => {
    // NOTE: detectLanguage matches a file literally named '.csproj' / 'project.json'
    // (exact-name match), unlike getBuildCommand/detectFramework which use endsWith.
    const dir = await makeService('cs', { '.csproj': '<Project></Project>' });
    expect(detectLanguage(dir)).toBe('csharp');
    const dir2 = await makeService('cs2', { 'project.json': '{}' });
    expect(detectLanguage(dir2)).toBe('csharp');
  });

  it('returns unknown when no recognized manifest is present', async () => {
    const dir = await makeService('empty', { 'README.md': '# hi' });
    expect(detectLanguage(dir)).toBe('unknown');
  });
});

describe('detectFramework', () => {
  it('detects JS frameworks from dependencies', async () => {
    const cases: Array<[string, Record<string, unknown>, string]> = [
      ['express', { dependencies: { express: '4' } }, 'express'],
      ['react', { dependencies: { react: '18' } }, 'react'],
      ['vue', { dependencies: { vue: '3' } }, 'vue'],
      ['nestjs', { dependencies: { '@nestjs/core': '10' } }, 'nestjs'],
      ['next', { dependencies: { next: '14' } }, 'next'],
    ];
    for (const [name, pkg, expected] of cases) {
      const dir = await makeService(`fw-${name}`, { 'package.json': pkg });
      expect(detectFramework(dir, 'typescript')).toBe(expected);
    }
  });

  it('returns undefined for JS when no framework dependency matches', async () => {
    const dir = await makeService('fw-none', {
      'package.json': { dependencies: { lodash: '4' } },
    });
    expect(detectFramework(dir, 'javascript')).toBeUndefined();
  });

  it('detects python frameworks from requirements.txt', async () => {
    const dir = await makeService('py-fw', {
      'requirements.txt': 'fastapi==0.100\nuvicorn',
    });
    expect(detectFramework(dir, 'python')).toBe('fastapi');
  });

  it('detects python frameworks from pyproject.toml', async () => {
    const dir = await makeService('py-fw2', {
      'pyproject.toml': '[tool.poetry.dependencies]\ndjango = "^4"',
    });
    expect(detectFramework(dir, 'python')).toBe('django');
  });

  it('detects go/rust/java frameworks from their manifests', async () => {
    const go = await makeService('go-fw', {
      'go.mod': 'module x\n\nrequire github.com/gin-gonic/gin',
    });
    expect(detectFramework(go, 'go')).toBe('gin');

    const rust = await makeService('rust-fw', {
      'Cargo.toml': '[dependencies]\nactix-web = "4"',
    });
    expect(detectFramework(rust, 'rust')).toBe('actix');

    const java = await makeService('java-fw', {
      'pom.xml': '<dependency><artifactId>spring-boot</artifactId></dependency>',
    });
    expect(detectFramework(java, 'java')).toBe('spring-boot');
  });

  it('detects csharp/php/ruby frameworks', async () => {
    const cs = await makeService('cs-fw', {
      'App.csproj': '<PackageReference Include="Microsoft.AspNetCore" />',
    });
    expect(detectFramework(cs, 'csharp')).toBe('aspnet-core');

    const php = await makeService('php-fw', {
      'composer.json': { require: { 'laravel/framework': '^10' } },
    });
    expect(detectFramework(php, 'php')).toBe('laravel');

    const rb = await makeService('rb-fw', { 'Gemfile': "gem 'rails'" });
    expect(detectFramework(rb, 'ruby')).toBe('rails');
  });

  it('returns undefined and swallows errors when the manifest is unreadable', () => {
    // Path that does not exist — readJsonSync throws, the catch returns undefined.
    expect(detectFramework(path.join(tmp, 'nope'), 'typescript')).toBeUndefined();
  });
});

describe('getBuildCommand', () => {
  it('uses pnpm/yarn/npm based on lockfile presence for JS builds', async () => {
    const withBuild = { scripts: { build: 'tsc' } };
    const pnpmDir = await makeService('js-pnpm', { 'package.json': withBuild });
    await fs.writeFile(path.join(pnpmDir, 'pnpm-lock.yaml'), '');
    expect(getBuildCommand('javascript', pnpmDir)).toBe('pnpm build');

    const yarnDir = await makeService('js-yarn', { 'package.json': withBuild });
    await fs.writeFile(path.join(yarnDir, 'yarn.lock'), '');
    expect(getBuildCommand('javascript', yarnDir)).toBe('yarn build');

    const npmDir = await makeService('js-npm', { 'package.json': withBuild });
    expect(getBuildCommand('typescript', npmDir)).toBe('npm run build');
  });

  it('returns undefined for JS when there is no build script', async () => {
    const dir = await makeService('js-nobuild', {
      'package.json': { scripts: { dev: 'tsc' } },
    });
    expect(getBuildCommand('javascript', dir)).toBeUndefined();
  });

  it('returns the python build command for pyproject and setup.py', async () => {
    const pyproject = await makeService('py1', { 'pyproject.toml': '[project]' });
    expect(getBuildCommand('python', pyproject)).toBe('python -m build');
    const setup = await makeService('py2', { 'setup.py': 'x' });
    expect(getBuildCommand('python', setup)).toBe('python setup.py build');
    const bare = await makeService('py3', { 'requirements.txt': 'flask' });
    expect(getBuildCommand('python', bare)).toBeUndefined();
  });

  it('returns fixed commands for go and rust', () => {
    expect(getBuildCommand('go', tmp)).toBe('go build -o bin/service');
    expect(getBuildCommand('rust', tmp)).toBe('cargo build --release');
  });

  it('returns maven/gradle commands for java', async () => {
    const maven = await makeService('j1', { 'pom.xml': '<x/>' });
    expect(getBuildCommand('java', maven)).toBe('mvn clean package');
    const gradle = await makeService('j2', { 'build.gradle.kts': 'x' });
    expect(getBuildCommand('java', gradle)).toBe('gradle build');
  });

  it('returns the dotnet command with the csproj file name for csharp', async () => {
    const dir = await makeService('cs1', { 'App.csproj': '<x/>' });
    expect(getBuildCommand('csharp', dir)).toBe('dotnet build App.csproj');
  });

  it('falls back to bare "dotnet build" when no csproj is present', () => {
    expect(getBuildCommand('csharp', tmp)).toBe('dotnet build');
  });

  it('returns composer/rake commands and undefined otherwise', async () => {
    const php = await makeService('php1', { 'composer.json': { x: 1 } });
    expect(getBuildCommand('php', php)).toBe('composer build');
    expect(getBuildCommand('php', tmp)).toBeUndefined();
    const rb = await makeService('rb1', { 'Rakefile': 'task :build' });
    expect(getBuildCommand('ruby', rb)).toBe('rake build');
    expect(getBuildCommand('ruby', tmp)).toBeUndefined();
  });
});

describe('getOutputPath', () => {
  const svc = (language: ServiceInfo['language'], dir: string): ServiceInfo => ({
    name: 's',
    path: dir,
    type: 'package',
    language,
    hasBuildScript: true,
  });

  it('maps each language to its expected output directory', () => {
    expect(getOutputPath(svc('typescript', '/srv/a'))).toBe(path.join('/srv/a', 'dist'));
    expect(getOutputPath(svc('javascript', '/srv/a'))).toBe(path.join('/srv/a', 'dist'));
    expect(getOutputPath(svc('python', '/srv/a'))).toBe(path.join('/srv/a', 'build'));
    expect(getOutputPath(svc('go', '/srv/a'))).toBe(path.join('/srv/a', 'bin'));
    expect(getOutputPath(svc('rust', '/srv/a'))).toBe(path.join('/srv/a', 'target', 'release'));
    expect(getOutputPath(svc('csharp', '/srv/a'))).toBe(path.join('/srv/a', 'bin', 'Release', 'net8.0'));
    expect(getOutputPath(svc('php', '/srv/a'))).toBe(path.join('/srv/a', 'public'));
  });

  it('returns target/ for a java service with pom.xml', async () => {
    const dir = await makeService('jp', { 'pom.xml': '<x/>' });
    expect(getOutputPath(svc('java', dir))).toBe(path.join(dir, 'target'));
  });

  it('returns build/libs for a java service without pom.xml', async () => {
    const dir = await makeService('jg', { 'build.gradle': 'x' });
    expect(getOutputPath(svc('java', dir))).toBe(path.join(dir, 'build', 'libs'));
  });

  it('returns undefined for unknown languages', () => {
    expect(getOutputPath(svc('unknown', tmp))).toBeUndefined();
  });
});

describe('filterServices', () => {
  const services: ServiceInfo[] = [
    { name: 'web', path: '/a', type: 'frontend', language: 'typescript', hasBuildScript: true },
    { name: 'api', path: '/b', type: 'backend', language: 'python', hasBuildScript: true },
    { name: 'lib1', path: '/c', type: 'lib', language: 'go', hasBuildScript: false },
  ];

  it('returns all services when no filter is provided', () => {
    expect(filterServices(services, {})).toHaveLength(3);
  });

  it('filters by type', () => {
    const out = filterServices(services, { filter: { type: ['frontend'] } });
    expect(out.map((s) => s.name)).toEqual(['web']);
  });

  it('filters by language', () => {
    const out = filterServices(services, { filter: { language: ['python', 'go'] } });
    expect(out.map((s) => s.name)).toEqual(['api', 'lib1']);
  });

  it('filters by name', () => {
    const out = filterServices(services, { filter: { name: ['api'] } });
    expect(out.map((s) => s.name)).toEqual(['api']);
  });

  it('combines multiple filters (AND)', () => {
    const out = filterServices(services, {
      filter: { type: ['frontend', 'lib'], language: ['typescript', 'go'] },
    });
    expect(out.map((s) => s.name)).toEqual(['web', 'lib1']);
  });
});

describe('scanWorkspace', () => {
  it('discovers services under apps/packages/libs/tools and classifies them', async () => {
    // apps/frontend → typescript + react → frontend
    await makeService('apps/frontend', {
      'package.json': { dependencies: { react: '18', typescript: '5' }, scripts: { build: 'tsc' } },
    });
    // apps/api → python → backend
    await makeService('apps/api', { 'requirements.txt': 'flask' });
    // packages/shared → package
    await makeService('packages/shared', { 'package.json': { name: 'shared' } });
    // libs/c → lib
    await makeService('libs/c', { 'go.mod': 'module c' });
    // tools/t → tool
    await makeService('tools/t', { 'Cargo.toml': '[package]' });

    const services = scanWorkspace(tmp);
    const byName = Object.fromEntries(services.map((s) => [s.name, s]));
    expect(byName.frontend.type).toBe('frontend');
    expect(byName.frontend.language).toBe('typescript');
    expect(byName.frontend.framework).toBe('react');
    expect(byName.frontend.hasBuildScript).toBe(true);
    expect(byName.api.type).toBe('backend');
    expect(byName.api.language).toBe('python');
    expect(byName.shared.type).toBe('package');
    expect(byName.c.type).toBe('lib');
    expect(byName.c.language).toBe('go');
    expect(byName.t.type).toBe('tool');
    expect(byName.t.language).toBe('rust');
  });

  it('classifies a JS app without a known frontend framework as backend', async () => {
    await makeService('apps/svc', { 'package.json': { dependencies: { express: '4' } } });
    const services = scanWorkspace(tmp);
    expect(services[0].type).toBe('backend');
  });

  it('returns an empty array when none of the standard dirs exist', () => {
    expect(scanWorkspace(tmp)).toEqual([]);
  });
});

describe('buildService', () => {
  it('returns a failed result without invoking a build when there is no build command', async () => {
    const service: ServiceInfo = {
      name: 'bare',
      path: tmp,
      type: 'backend',
      language: 'python',
      hasBuildScript: false,
    };
    const result = await buildService(service);
    expect(result.success).toBe(false);
    expect(result.duration).toBe(0);
    expect(result.error).toMatch(/No build script found for python/);
  });
});

describe('printBuildResults', () => {
  it('prints a summary with successful and failed services plus total time', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const results = [
        {
          service: { name: 'web', language: 'typescript' } as ServiceInfo,
          success: true,
          duration: 1500,
        },
        {
          service: { name: 'api', language: 'python' } as ServiceInfo,
          success: false,
          duration: 500,
          error: 'boom',
        },
      ];
      printBuildResults(results);
      const out = logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Build Summary');
      expect(out).toContain('Built 1 service');
      expect(out).toContain('web');
      expect(out).toContain('Failed 1 service');
      expect(out).toContain('api');
      expect(out).toContain('boom');
      expect(out).toContain('Total time');
    } finally {
      logSpy.mockRestore();
    }
  });
});
