import * as path from 'path';
import { WorkspaceInfo } from './monorepo';
import {
  WorkspaceDefinition,
  WorkspaceEntry,
  WorkspaceDependency,
  WorkspaceTypeConfig,
} from './workspace-schema';

/**
 * Build the set of workspace type configurations the schema validator expects.
 *
 * `getWorkspaces()` classifies each workspace as one of app/package/lib/tool, so
 * we register all four (each with the required `name` field) to guarantee every
 * derived workspace entry references a valid type.
 */
function buildTypeConfigs(): Record<string, WorkspaceTypeConfig> {
  return {
    app: {
      name: 'Application',
      description: 'Frontend applications',
      build: { command: 'npm run build', outputDir: 'dist' },
      dev: { command: 'npm run dev' },
      test: { command: 'npm run test' },
      requiredFiles: ['package.json'],
    },
    package: {
      name: 'Package',
      description: 'Shared packages and libraries',
      build: { command: 'npm run build', outputDir: 'dist' },
      test: { command: 'npm run test' },
      requiredFiles: ['package.json'],
    },
    lib: {
      name: 'Library',
      description: 'Internal libraries',
      build: { command: 'npm run build', outputDir: 'dist' },
      test: { command: 'npm run test' },
      requiredFiles: ['package.json'],
    },
    tool: {
      name: 'Tool',
      description: 'Development tools and utilities',
      build: { command: 'npm run build' },
      requiredFiles: ['package.json'],
    },
  };
}

/**
 * Adapt the zero-config workspace list returned by `getWorkspaces()` into a
 * fully-formed `WorkspaceDefinition` that passes `WorkspaceSchemaValidator`
 * validation. This lets the rich workspace engines run without a hand-written
 * `re-shell.workspaces.yaml` on disk.
 *
 * Internal (workspace-to-workspace) dependency relationships are preserved: an
 * entry's dependencies are filtered to only the names that are themselves
 * workspaces, and self-dependencies are dropped (the schema rejects them).
 *
 * @param workspaces Discovered workspaces (from `getWorkspaces()`).
 * @param root       Monorepo root path; defaults to the current directory.
 */
export function toWorkspaceDefinition(
  workspaces: ReadonlyArray<WorkspaceInfo>,
  root: string = process.cwd()
): WorkspaceDefinition {
  const knownNames = new Set(workspaces.map(ws => ws.name));

  const workspaceEntries: Record<string, WorkspaceEntry> = {};
  const dependencies: Record<string, WorkspaceDependency[]> = {};

  for (const ws of workspaces) {
    workspaceEntries[ws.name] = {
      name: ws.name,
      type: ws.type,
      path: ws.path,
      active: true,
      ...(ws.framework ? { tags: [ws.framework] } : {}),
    };

    // Preserve only internal edges; drop self-references and externals so the
    // resulting definition satisfies the dependency validation rules.
    const internalDeps: WorkspaceDependency[] = ws.dependencies
      .filter(dep => dep !== ws.name && knownNames.has(dep))
      .map(dep => ({ name: dep, type: 'runtime' as const }));

    if (internalDeps.length > 0) {
      dependencies[ws.name] = internalDeps;
    }
  }

  const now = new Date().toISOString();

  return {
    version: '1.0',
    name: path.basename(path.resolve(root)) || 'monorepo',
    description: 'Auto-derived Re-Shell workspace definition',
    root: '.',
    patterns: ['apps/*', 'packages/*', 'libs/*', 'tools/*'],
    types: buildTypeConfigs(),
    workspaces: workspaceEntries,
    dependencies,
    build: {
      target: 'es2020',
      parallel: true,
      maxConcurrency: 4,
      cache: true,
      sourcemap: true,
    },
    dev: {
      mode: 'concurrent',
      cors: true,
      hot: true,
    },
    test: {
      coverage: {
        enabled: true,
        threshold: 80,
        exclude: ['dist/**', 'node_modules/**'],
      },
      parallel: true,
      timeout: 30000,
    },
    scripts: {
      'build:all': {
        description: 'Build all workspaces',
        command: 'npm run build',
        workspaces: 'all',
        parallel: true,
      },
      'test:all': {
        description: 'Test all workspaces',
        command: 'npm run test',
        workspaces: 'all',
        parallel: true,
        continueOnError: true,
      },
    },
    metadata: {
      created: now,
      lastModified: now,
      tags: ['auto-derived'],
    },
  };
}
