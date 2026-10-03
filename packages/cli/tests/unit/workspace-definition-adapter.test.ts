import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  WorkspaceDefinitionError,
  deriveWorkspaceDefinition,
  derivedDefinitionNote,
  reportMissingWorkspaceDefinition,
  resolveWorkspaceDefinition,
  toWorkspaceDefinition,
  workspaceDefinitionErrorCode,
} from '../../src/utils/workspace-definition-adapter';
import { WorkspaceSchemaValidator } from '../../src/utils/workspace-schema';
import { createWorkspaceDependencyGraph } from '../../src/utils/workspace-graph';
import { ValidationError } from '../../src/utils/error-handler';
import type { WorkspaceInfo } from '../../src/utils/monorepo';

function info(over: Partial<WorkspaceInfo> & { name: string; path: string }): WorkspaceInfo {
  return { type: 'package', version: '1.0.0', dependencies: [], ...over };
}

describe('toWorkspaceDefinition (pure)', () => {
  const workspaces: WorkspaceInfo[] = [
    info({ name: '@acme/core', path: 'packages/core' }),
    info({ name: '@acme/ui', path: 'packages/ui', dependencies: ['@acme/core', 'react'] }),
    info({ name: 'web', path: 'apps/web', type: 'app', dependencies: ['@acme/ui', '@acme/core'] }),
    info({ name: 'helpers', path: 'libs/helpers', type: 'lib' }),
  ];

  it('maps detected workspaces to entries keyed by unscoped package name', () => {
    const def = toWorkspaceDefinition(workspaces, { name: 'acme' });
    expect(def.name).toBe('acme');
    expect(Object.keys(def.workspaces).sort()).toEqual(['core', 'helpers', 'ui', 'web']);
    expect(def.workspaces.ui).toMatchObject({ name: 'ui', type: 'package', path: 'packages/ui' });
    expect(def.workspaces.ui.metadata).toMatchObject({ packageName: '@acme/ui', derived: true });
    expect(def.workspaces.web.type).toBe('app');
  });

  it('keeps only workspace-to-workspace dependency edges', () => {
    const def = toWorkspaceDefinition(workspaces);
    expect(def.dependencies.ui).toEqual([{ name: 'core', type: 'runtime' }]);
    expect(def.dependencies.web.map(d => d.name)).toEqual(['core', 'ui']);
    expect(def.dependencies.core).toBeUndefined();
  });

  it('derives discovery patterns from workspace locations', () => {
    expect(toWorkspaceDefinition(workspaces).patterns).toEqual(['apps/*', 'libs/*', 'packages/*']);
  });

  it('defines a type for every detected workspace type, including lib', () => {
    const def = toWorkspaceDefinition(workspaces);
    for (const ws of Object.values(def.workspaces)) expect(def.types[ws.type]).toBeDefined();
  });

  it('keeps dependency kinds and ranges when manifests are supplied; runtime outranks dev', () => {
    const def = toWorkspaceDefinition(workspaces, {
      manifests: {
        'packages/ui': {
          dependencies: { '@acme/core': 'workspace:*' },
          devDependencies: { '@acme/core': '^1.0.0' },
        },
        'apps/web': { devDependencies: { '@acme/ui': 'workspace:^' }, peerDependencies: { '@acme/core': '*' } },
      },
    });
    expect(def.dependencies.ui).toEqual([{ name: 'core', type: 'runtime', version: 'workspace:*' }]);
    expect(def.dependencies.web).toEqual([
      { name: 'core', type: 'runtime', version: '*', optional: true },
      { name: 'ui', type: 'dev', version: 'workspace:^' },
    ]);
  });

  it('disambiguates colliding unscoped names deterministically', () => {
    const def = toWorkspaceDefinition([
      info({ name: '@a/web', path: 'packages/a-web' }),
      info({ name: '@b/web', path: 'packages/b-web' }),
    ]);
    expect(Object.keys(def.workspaces).sort()).toEqual(['a-web', 'b-web']);
  });

  it('throws WORKSPACE_NOT_FOUND instead of fabricating an empty definition', () => {
    expect(() => toWorkspaceDefinition([])).toThrow(WorkspaceDefinitionError);
    try {
      toWorkspaceDefinition([]);
    } catch (e) {
      expect((e as WorkspaceDefinitionError).code).toBe('WORKSPACE_NOT_FOUND');
    }
  });

  it('produces a definition the schema validator and graph engine accept', async () => {
    const def = toWorkspaceDefinition(workspaces);
    const result = await new WorkspaceSchemaValidator(def, '.').validateDefinition();
    expect(result.errors.map(e => e.message)).toEqual([]);
    const analysis = createWorkspaceDependencyGraph(def).analyzeGraph();
    expect(analysis.nodeCount).toBe(4);
    expect(analysis.edgeCount).toBe(3);
    expect(analysis.cycles.hasCycles).toBe(false);
  });
});

describe('deriveWorkspaceDefinition / resolveWorkspaceDefinition (real filesystem)', () => {
  let dir: string;

  function write(rel: string, content: unknown): void {
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-wd-adapter-'));
    write('package.json', { name: 'root-pkg', private: true });
    write('pnpm-workspace.yaml', "packages:\n  - 'packages/*'\n");
    write('packages/a/package.json', { name: '@x/a', version: '1.2.3' });
    write('packages/b/package.json', {
      name: '@x/b',
      version: '0.1.0',
      dependencies: { '@x/a': 'workspace:*', lodash: '^4' },
      devDependencies: { '@x/a': 'workspace:*' },
    });
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('derives from a plain pnpm monorepo (no yaml) with real dependency edges', async () => {
    const resolved = await resolveWorkspaceDefinition({ cwd: dir });
    expect(resolved.source).toBe('derived');
    expect(resolved.rootPath).toBe(dir);
    expect(resolved.definition.name).toBe('root-pkg');
    expect(Object.keys(resolved.definition.workspaces).sort()).toEqual(['a', 'b']);
    expect(resolved.definition.dependencies.b).toEqual([{ name: 'a', type: 'runtime', version: 'workspace:*' }]);
    expect(derivedDefinitionNote(resolved)).toMatch(/derived the workspace definition from the 2 detected/);
  });

  it('derives from a subdirectory of the monorepo', async () => {
    const resolved = await deriveWorkspaceDefinition(path.join(dir, 'packages', 'a'));
    expect(resolved.rootPath).toBe(dir);
  });

  it('prefers the yaml file when it exists', async () => {
    write(
      're-shell.workspaces.yaml',
      [
        "version: '1.0'",
        'name: from-yaml',
        'root: .',
        'patterns: [packages/*]',
        'types: { package: { name: Package } }',
        'workspaces: {}',
        'dependencies: {}',
        'build: {}',
        'dev: {}',
        'test: {}',
        'scripts: {}',
        '',
      ].join('\n')
    );
    const resolved = await resolveWorkspaceDefinition({ cwd: dir });
    expect(resolved.source).toBe('file');
    expect(resolved.definition.name).toBe('from-yaml');
    expect(derivedDefinitionNote(resolved)).toBeUndefined();
  });

  it('an invalid yaml is WORKSPACE_DEFINITION_ERROR, not silently replaced by a derived one', async () => {
    write('re-shell.workspaces.yaml', 'name: broken\n');
    await expect(resolveWorkspaceDefinition({ cwd: dir })).rejects.toMatchObject({
      code: 'WORKSPACE_DEFINITION_ERROR',
    });
  });

  it('an explicit, missing file is an error rather than a silent derive', async () => {
    await expect(resolveWorkspaceDefinition({ cwd: dir, file: 'custom.yaml' })).rejects.toMatchObject({
      code: 'WORKSPACE_NOT_FOUND',
    });
  });

  it('fails with NOT_IN_MONOREPO outside any monorepo', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-wd-empty-'));
    try {
      await expect(resolveWorkspaceDefinition({ cwd: empty })).rejects.toMatchObject({ code: 'NOT_IN_MONOREPO' });
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it('fails with WORKSPACE_NOT_FOUND for a monorepo that declares no workspaces', async () => {
    fs.rmSync(path.join(dir, 'packages'), { recursive: true });
    await expect(resolveWorkspaceDefinition({ cwd: dir })).rejects.toMatchObject({ code: 'WORKSPACE_NOT_FOUND' });
  });
});

describe('error helpers', () => {
  it('workspaceDefinitionErrorCode maps errors to codes', () => {
    expect(workspaceDefinitionErrorCode(new WorkspaceDefinitionError('NOT_IN_MONOREPO', 'x'))).toBe('NOT_IN_MONOREPO');
    expect(workspaceDefinitionErrorCode(new ValidationError('Workspace definition file not found: x'))).toBe(
      'WORKSPACE_NOT_FOUND'
    );
    expect(workspaceDefinitionErrorCode(new ValidationError('Invalid workspace definition: y'))).toBe(
      'WORKSPACE_DEFINITION_ERROR'
    );
    expect(workspaceDefinitionErrorCode(new Error('other'))).toBe('WORKSPACE_DEFINITION_ERROR');
  });

  it('reportMissingWorkspaceDefinition: json envelope, or hint + non-zero exit', () => {
    const writes: string[] = [];
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(((c: string) => {
      writes.push(String(c));
      return true;
    }) as never);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      reportMissingWorkspaceDefinition({ json: true, file: 'nope.yaml' });
      expect(JSON.parse(writes.join(''))).toMatchObject({ ok: false, error: { code: 'WORKSPACE_NOT_FOUND' } });
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
      reportMissingWorkspaceDefinition({ file: 'nope.yaml' });
      expect(log.mock.calls.flat().join('\n')).toContain('No workspace definition found');
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = undefined;
      out.mockRestore();
      log.mockRestore();
    }
  });
});
