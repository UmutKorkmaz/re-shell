import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  sanitizeServiceName,
  inferType,
  inferFramework,
  inferLanguage,
  inferPort,
  inferRoute,
  detectSource,
  detectNx,
  detectTurbo,
  detectLerna,
  detectYarn,
  detectPnpm,
  importMonorepo,
  renderWorkspaceYaml,
  type DetectedService,
} from '../../src/utils/monorepo-importer';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-import-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function writePackageJson(dir: string, data: Record<string, unknown>): void {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(data, null, 2));
}

function createProject(
  root: string,
  relPath: string,
  pkg: Record<string, unknown>
): void {
  const projectDir = join(root, relPath);
  mkdirSync(projectDir, { recursive: true });
  writePackageJson(projectDir, pkg);
}

// --- Pure function tests ---

describe('sanitizeServiceName', () => {
  it('should lowercase and kebab-case', () => {
    expect(sanitizeServiceName('MyApp')).toBe('myapp');
    expect(sanitizeServiceName('@scope/MyPackage')).toBe('mypackage');
    expect(sanitizeServiceName('foo_bar.baz')).toBe('foo-bar-baz');
  });

  it('should strip npm scopes', () => {
    expect(sanitizeServiceName('@re-shell/cli')).toBe('cli');
    expect(sanitizeServiceName('@my-org/my-package')).toBe('my-package');
  });

  it('should handle empty results with fallback', () => {
    expect(sanitizeServiceName('___')).toBe('service');
    expect(sanitizeServiceName('')).toBe('service');
  });

  it('should truncate long names', () => {
    const long = 'a'.repeat(100);
    const result = sanitizeServiceName(long);
    expect(result.length).toBeLessThanOrEqual(63);
  });
});

describe('inferType', () => {
  it('should detect frontend from deps', () => {
    expect(inferType({ dependencies: { react: '18' } }, 'x')).toBe('frontend');
    expect(inferType({ dependencies: { vue: '3' } }, 'x')).toBe('frontend');
    expect(inferType({ dependencies: { next: '14' } }, 'x')).toBe('frontend');
  });

  it('should detect backend from deps', () => {
    expect(inferType({ dependencies: { express: '4' } }, 'x')).toBe('backend');
    expect(inferType({ dependencies: { '@nestjs/core': '10' } }, 'x')).toBe('backend');
  });

  it('should infer from name patterns', () => {
    expect(inferType({}, 'my-web-app')).toBe('frontend');
    expect(inferType({}, 'api-server')).toBe('backend');
    expect(inferType({}, 'worker-job')).toBe('worker');
    expect(inferType({}, 'lambda-fn')).toBe('function');
  });

  it('should default to worker for libraries', () => {
    expect(inferType({}, 'shared-lib')).toBe('worker');
  });
});

describe('inferFramework', () => {
  it('should detect next', () => {
    expect(inferFramework({ dependencies: { next: '14' } })).toBe('next');
  });

  it('should detect react', () => {
    expect(inferFramework({ dependencies: { react: '18' } })).toBe('react');
  });

  it('should detect express', () => {
    expect(inferFramework({ dependencies: { express: '4' } })).toBe('express');
  });

  it('should fallback to vanilla', () => {
    expect(inferFramework({})).toBe('vanilla');
    expect(inferFramework({ dependencies: { lodash: '4' } })).toBe('vanilla');
  });
});

describe('inferLanguage', () => {
  it('should detect typescript', () => {
    expect(inferLanguage({ devDependencies: { typescript: '5' } })).toBe('typescript');
    expect(inferLanguage({ dependencies: { typescript: '5' } })).toBe('typescript');
  });

  it('should default to javascript', () => {
    expect(inferLanguage({})).toBe('javascript');
  });
});

describe('inferPort', () => {
  it('should return 3xxx for frontend', () => {
    const port = inferPort('my-app', 'frontend');
    expect(port).toBeGreaterThanOrEqual(3000);
    expect(port).toBeLessThan(4000);
  });

  it('should return 4xxx for backend', () => {
    const port = inferPort('my-api', 'backend');
    expect(port).toBeGreaterThanOrEqual(4000);
    expect(port).toBeLessThan(5000);
  });

  it('should return undefined for worker/function', () => {
    expect(inferPort('job', 'worker')).toBeUndefined();
    expect(inferPort('fn', 'function')).toBeUndefined();
  });

  it('should be deterministic (same name = same port)', () => {
    expect(inferPort('foo', 'frontend')).toBe(inferPort('foo', 'frontend'));
  });
});

describe('inferRoute', () => {
  it('should return /name for frontend', () => {
    expect(inferRoute('my-app', 'frontend')).toBe('/my-app');
  });

  it('should return undefined for non-frontend', () => {
    expect(inferRoute('api', 'backend')).toBeUndefined();
    expect(inferRoute('worker', 'worker')).toBeUndefined();
  });
});

// --- Source detection tests ---

describe('detectSource', () => {
  it('should detect nx', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'nx.json'), '{}');
    expect(detectSource(dir)).toBe('nx');
  });

  it('should detect turbo', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'turbo.json'), '{}');
    expect(detectSource(dir)).toBe('turbo');
  });

  it('should detect lerna', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'lerna.json'), '{}');
    expect(detectSource(dir)).toBe('lerna');
  });

  it('should detect pnpm', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*');
    expect(detectSource(dir)).toBe('pnpm');
  });

  it('should detect yarn workspaces', () => {
    const dir = createTempDir();
    writePackageJson(dir, { workspaces: ['packages/*'] });
    expect(detectSource(dir)).toBe('yarn');
  });

  it('should return null for non-monorepo', () => {
    const dir = createTempDir();
    expect(detectSource(dir)).toBeNull();
  });

  it('should prioritize nx over turbo', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'nx.json'), '{}');
    writeFileSync(join(dir, 'turbo.json'), '{}');
    expect(detectSource(dir)).toBe('nx');
  });
});

// --- Fixture-based detection tests ---

function makeService(name: string, overrides: Partial<DetectedService> = {}): DetectedService {
  const type = overrides.type || 'worker';
  return {
    originalName: name,
    name: sanitizeServiceName(name),
    path: `packages/${sanitizeServiceName(name)}`,
    type,
    language: overrides.language || 'typescript',
    framework: overrides.framework || 'vanilla',
    dependencies: overrides.dependencies || {},
    scripts: overrides.scripts || {},
    port: overrides.port,
    route: overrides.route,
  };
}

describe('detectNx', () => {
  it('should detect projects from nx.json projects map', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'nx.json'), JSON.stringify({
      projects: {
        'web-app': { root: 'apps/web' },
        'api-server': { root: 'apps/api' },
      },
    }));
    createProject(dir, 'apps/web', { name: 'web-app', dependencies: { react: '18' } });
    createProject(dir, 'apps/api', { name: 'api-server', dependencies: { express: '4' } });

    const services = await detectNx(dir);
    expect(services.length).toBe(2);
    expect(services[0].name).toBe('api-server');
    expect(services[0].type).toBe('backend');
    expect(services[1].name).toBe('web-app');
    expect(services[1].type).toBe('frontend');
  });

  it('should detect projects from project.json files', async () => {
    const dir = createTempDir();
    mkdirSync(join(dir, 'apps', 'myapp'), { recursive: true });
    writeFileSync(join(dir, 'nx.json'), JSON.stringify({}));
    writeFileSync(join(dir, 'apps', 'myapp', 'project.json'), JSON.stringify({ name: 'myapp' }));
    createProject(dir, 'apps/myapp', { name: 'myapp', dependencies: { vue: '3' } });

    const services = await detectNx(dir);
    expect(services.length).toBe(1);
    expect(services[0].name).toBe('myapp');
    expect(services[0].framework).toBe('vue');
  });

  it('should throw when nx.json not found', async () => {
    const dir = createTempDir();
    await expect(detectNx(dir)).rejects.toThrow('nx.json not found');
  });
});

describe('detectTurbo', () => {
  it('should detect from package.json workspaces', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'turbo.json'), '{}');
    writePackageJson(dir, {
      name: 'monorepo',
      workspaces: ['apps/*', 'packages/*'],
    });
    createProject(dir, 'apps/web', { name: 'web', dependencies: { next: '14' } });
    createProject(dir, 'packages/ui', { name: 'ui' });

    const services = await detectTurbo(dir);
    expect(services.length).toBe(2);
  });

  it('should throw when turbo.json not found', async () => {
    const dir = createTempDir();
    await expect(detectTurbo(dir)).rejects.toThrow('turbo.json not found');
  });

  it('should fall back to pnpm-workspace.yaml', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'turbo.json'), '{}');
    writePackageJson(dir, { name: 'mono' });
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*');
    createProject(dir, 'apps/web', { name: 'web', dependencies: { react: '18' } });

    const services = await detectTurbo(dir);
    expect(services.length).toBe(1);
    expect(services[0].name).toBe('web');
  });
});

describe('detectLerna', () => {
  it('should detect from lerna.json packages', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'lerna.json'), JSON.stringify({ packages: ['packages/*'] }));
    createProject(dir, 'packages/shared', { name: 'shared' });
    createProject(dir, 'packages/tools', { name: 'tools' });

    const services = await detectLerna(dir);
    expect(services.length).toBe(2);
  });

  it('should throw when lerna.json not found', async () => {
    const dir = createTempDir();
    await expect(detectLerna(dir)).rejects.toThrow('lerna.json not found');
  });
});

describe('detectYarn', () => {
  it('should detect from package.json workspaces array', async () => {
    const dir = createTempDir();
    writePackageJson(dir, { name: 'mono', workspaces: ['packages/*'] });
    createProject(dir, 'packages/lib1', { name: 'lib1' });

    const services = await detectYarn(dir);
    expect(services.length).toBe(1);
  });

  it('should detect from workspaces.packages object', async () => {
    const dir = createTempDir();
    writePackageJson(dir, { name: 'mono', workspaces: { packages: ['modules/*'] } });
    createProject(dir, 'modules/core', { name: 'core' });

    const services = await detectYarn(dir);
    expect(services.length).toBe(1);
  });

  it('should throw when no workspaces', async () => {
    const dir = createTempDir();
    writePackageJson(dir, { name: 'mono' });
    await expect(detectYarn(dir)).rejects.toThrow('No workspaces');
  });
});

describe('detectPnpm', () => {
  it('should detect from pnpm-workspace.yaml', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*');
    createProject(dir, 'packages/util', { name: 'util' });

    const services = await detectPnpm(dir);
    expect(services.length).toBe(1);
  });

  it('should throw when pnpm-workspace.yaml not found', async () => {
    const dir = createTempDir();
    await expect(detectPnpm(dir)).rejects.toThrow('pnpm-workspace.yaml not found');
  });
});

// --- renderWorkspaceYaml tests ---

describe('renderWorkspaceYaml', () => {
  it('should produce valid YAML with services', () => {
    const services = [
      makeService('web-app', { type: 'frontend', framework: 'react', port: 3000, route: '/web-app' }),
      makeService('api', { type: 'backend', framework: 'express', port: 4000 }),
    ];
    const yaml = renderWorkspaceYaml('my-workspace', 'nx', services);
    expect(yaml).toContain('name: my-workspace');
    expect(yaml).toContain('web-app');
    expect(yaml).toContain('type: frontend');
    expect(yaml).toContain('framework: react');
    expect(yaml).toContain('port: 3000');
    expect(yaml).toContain('route: /web-app');
    expect(yaml).toContain('api');
    expect(yaml).toContain('type: backend');
  });

  it('should include dependencies when present', () => {
    const services = [
      makeService('svc', { dependencies: { express: '^4.18' } }),
    ];
    const yaml = renderWorkspaceYaml('ws', 'turbo', services);
    expect(yaml).toContain('dependencies');
    expect(yaml).toContain('production');
    expect(yaml).toContain('express');
  });

  it('should include scripts when present', () => {
    const services = [
      makeService('svc', { scripts: { dev: 'vite', build: 'vite build' } }),
    ];
    const yaml = renderWorkspaceYaml('ws', 'lerna', services);
    expect(yaml).toContain('scripts');
    expect(yaml).toContain('dev: vite');
    expect(yaml).toContain('build: vite build');
  });

  it('should de-duplicate colliding service names', () => {
    const services = [
      makeService('@scope/foo'),
      makeService('foo'),
    ];
    const yaml = renderWorkspaceYaml('ws', 'pnpm', services);
    // Both sanitize to 'foo', second should become 'foo-2'
    expect(yaml).toContain('foo:');
    expect(yaml).toContain('foo-2:');
  });
});

// --- importMonorepo integration tests ---

describe('importMonorepo', () => {
  it('should auto-detect and import an Nx workspace', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'nx.json'), JSON.stringify({
      projects: { 'web': { root: 'apps/web' } },
    }));
    writePackageJson(dir, { name: 'my-monorepo' });
    createProject(dir, 'apps/web', { name: 'web', dependencies: { react: '18' } });

    const result = await importMonorepo({ cwd: dir });
    expect(result.source).toBe('nx');
    expect(result.workspaceName).toBe('my-monorepo');
    expect(result.detected.length).toBe(1);
    expect(result.detected[0].type).toBe('frontend');
    expect(result.yaml).toContain('my-monorepo');
  });

  it('should auto-detect a Turbo workspace', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'turbo.json'), '{}');
    writePackageJson(dir, {
      name: 'turbo-mono',
      workspaces: ['apps/*'],
    });
    createProject(dir, 'apps/api', { name: 'api', dependencies: { fastify: '4' } });

    const result = await importMonorepo({ cwd: dir });
    expect(result.source).toBe('turbo');
    expect(result.detected.length).toBe(1);
    expect(result.detected[0].type).toBe('backend');
  });

  it('should auto-detect a PNPM workspace', async () => {
    const dir = createTempDir();
    writePackageJson(dir, { name: 'pnpm-mono' });
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*');
    createProject(dir, 'packages/shared', { name: 'shared', devDependencies: { typescript: '5' } });

    const result = await importMonorepo({ cwd: dir });
    expect(result.source).toBe('pnpm');
    expect(result.detected.length).toBe(1);
    expect(result.detected[0].language).toBe('typescript');
  });

  it('should auto-detect a Yarn workspace', async () => {
    const dir = createTempDir();
    writePackageJson(dir, {
      name: 'yarn-mono',
      workspaces: ['packages/*'],
    });
    createProject(dir, 'packages/lib', { name: 'lib' });

    const result = await importMonorepo({ cwd: dir });
    expect(result.source).toBe('yarn');
    expect(result.detected.length).toBe(1);
  });

  it('should auto-detect a Lerna workspace', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'lerna.json'), JSON.stringify({ packages: ['packages/*'] }));
    createProject(dir, 'packages/util', { name: 'util' });

    const result = await importMonorepo({ cwd: dir });
    expect(result.source).toBe('lerna');
    expect(result.detected.length).toBe(1);
  });

  it('should throw for non-monorepo directory', async () => {
    const dir = createTempDir();
    await expect(importMonorepo({ cwd: dir })).rejects.toThrow('No supported monorepo');
  });

  it('should use explicit source when provided', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'nx.json'), JSON.stringify({
      projects: { app: { root: 'apps/app' } },
    }));
    createProject(dir, 'apps/app', { name: 'app' });

    const result = await importMonorepo({ cwd: dir, source: 'nx' });
    expect(result.source).toBe('nx');
  });

  it('should include deps and scripts in YAML', async () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'turbo.json'), '{}');
    writePackageJson(dir, { name: 'mono', workspaces: ['apps/*'] });
    createProject(dir, 'apps/web', {
      name: 'web',
      dependencies: { next: '14' },
      scripts: { dev: 'next dev', build: 'next build' },
    });

    const result = await importMonorepo({ cwd: dir });
    expect(result.yaml).toContain('production');
    expect(result.yaml).toContain('next');
    expect(result.yaml).toContain('scripts');
    expect(result.yaml).toContain('next dev');
  });
});
