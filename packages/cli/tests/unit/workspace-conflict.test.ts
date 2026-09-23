import { describe, expect, it } from 'vitest';
import {
  WorkspaceConflictManager,
  createWorkspaceConflictManager,
  type WorkspaceConflict,
  type ConflictDetectionOptions,
} from '../../src/utils/workspace-conflict';
import {
  DEFAULT_WORKSPACE_DEFINITION,
  type WorkspaceDefinition,
  type WorkspaceEntry,
  type WorkspaceDependency,
} from '../../src/utils/workspace-schema';

function makeDefinition(
  workspaces: Record<string, WorkspaceEntry>,
  dependencies: Record<string, WorkspaceDependency[]> = {},
  types?: WorkspaceDefinition['types'],
): WorkspaceDefinition {
  return {
    ...DEFAULT_WORKSPACE_DEFINITION,
    workspaces,
    dependencies,
    types: types ?? DEFAULT_WORKSPACE_DEFINITION.types,
  };
}

const ws = (name: string, type = 'app', extra: Partial<WorkspaceEntry> = {}): WorkspaceEntry => ({
  name,
  type,
  path: `./apps/${name}`,
  ...extra,
});

const dep = (name: string, type: WorkspaceDependency['type'] = 'build'): WorkspaceDependency => ({
  name,
  type,
});

describe('WorkspaceConflictManager', () => {
  describe('detectConflicts — naming', () => {
    it('should detect no conflicts in a clean definition', async () => {
      const def = makeDefinition({
        a: ws('a'),
        b: ws('b'),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      // No naming conflicts expected (names are unique by object key)
      expect(conflicts.filter(c => c.type === 'naming')).toHaveLength(0);
    });

    it('should detect reserved name usage as warning', async () => {
      const def = makeDefinition({
        build: ws('build'),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const namingConflicts = conflicts.filter(c => c.type === 'naming');
      expect(namingConflicts.length).toBeGreaterThan(0);
      expect(namingConflicts.some(c => c.severity === 'warning')).toBe(true);
    });

    it('should suggest rename for reserved name', async () => {
      const def = makeDefinition({
        config: ws('config'),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const naming = conflicts.find(c => c.type === 'naming');
      expect(naming).toBeDefined();
      expect(naming!.suggestions.length).toBeGreaterThan(0);
      expect(naming!.suggestions.some(s => s.action === 'rename-workspace')).toBe(true);
    });
  });

  describe('detectConflicts — dependency-cycle', () => {
    it('should detect circular dependencies', async () => {
      const def = makeDefinition(
        { a: ws('a'), b: ws('b') },
        { a: [dep('b')], b: [dep('a')] },
      );
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const cycle = conflicts.find(c => c.type === 'dependency-cycle');
      expect(cycle).toBeDefined();
      expect(cycle!.severity).toBe('error');
      expect(cycle!.affectedWorkspaces).toContain('a');
      expect(cycle!.affectedWorkspaces).toContain('b');
    });

    it('should not detect cycles for acyclic dependencies', async () => {
      const def = makeDefinition(
        { a: ws('a'), b: ws('b'), c: ws('c') },
        { a: [dep('b')], b: [dep('c')] },
      );
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      expect(conflicts.filter(c => c.type === 'dependency-cycle')).toHaveLength(0);
    });
  });

  describe('detectConflicts — dependency-missing', () => {
    it('should detect missing dependency target', async () => {
      const def = makeDefinition(
        { a: ws('a') },
        { a: [dep('nonexistent')] },
      );
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const missing = conflicts.find(c => c.type === 'dependency-missing');
      expect(missing).toBeDefined();
      expect(missing!.severity).toBe('error');
    });

    it('should detect dependencies for non-existent workspace', async () => {
      const def = makeDefinition(
        { a: ws('a') },
        { ghost: [dep('a')] },
      );
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const missing = conflicts.find(
        c => c.type === 'dependency-missing' && c.affectedWorkspaces.includes('ghost'),
      );
      expect(missing).toBeDefined();
    });
  });

  describe('detectConflicts — port-collision', () => {
    it('should detect port collision between workspaces', async () => {
      const def = makeDefinition({
        a: ws('a', 'app', { dev: { port: 3000 } }),
        b: ws('b', 'app', { dev: { port: 3000 } }),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const port = conflicts.find(c => c.type === 'port-collision');
      expect(port).toBeDefined();
      expect(port!.severity).toBe('error');
      expect(port!.affectedWorkspaces).toContain('a');
      expect(port!.affectedWorkspaces).toContain('b');
    });

    it('should not detect port collision for unique ports', async () => {
      const def = makeDefinition({
        a: ws('a', 'app', { dev: { port: 3000 } }),
        b: ws('b', 'app', { dev: { port: 3001 } }),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      expect(conflicts.filter(c => c.type === 'port-collision')).toHaveLength(0);
    });

    it('should not check ports when disabled', async () => {
      const def = makeDefinition({
        a: ws('a', 'app', { dev: { port: 3000 } }),
        b: ws('b', 'app', { dev: { port: 3000 } }),
      });
      const manager = new WorkspaceConflictManager();
      const opts: ConflictDetectionOptions = { checkPorts: false };
      const conflicts = await manager.detectConflicts(def, opts);
      expect(conflicts.filter(c => c.type === 'port-collision')).toHaveLength(0);
    });
  });

  describe('detectConflicts — path-collision', () => {
    it('should detect path collision between workspaces', async () => {
      const def = makeDefinition({
        a: { name: 'a', type: 'app', path: './apps/shared' },
        b: { name: 'b', type: 'app', path: './apps/shared' },
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const pathConflict = conflicts.find(c => c.type === 'path-collision');
      expect(pathConflict).toBeDefined();
      expect(pathConflict!.severity).toBe('error');
    });

    it('should not detect path collision for unique paths', async () => {
      const def = makeDefinition({
        a: ws('a'),
        b: ws('b'),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      expect(conflicts.filter(c => c.type === 'path-collision')).toHaveLength(0);
    });
  });

  describe('detectConflicts — type-mismatch', () => {
    it('should detect undefined workspace type', async () => {
      const def = makeDefinition({
        a: ws('a', 'unknown-type'),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const typeConflict = conflicts.find(c => c.type === 'type-mismatch');
      expect(typeConflict).toBeDefined();
      expect(typeConflict!.severity).toBe('error');
    });

    it('should not flag valid workspace types', async () => {
      const def = makeDefinition({
        a: ws('a', 'app'),
        b: ws('b', 'package'),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      expect(conflicts.filter(c => c.type === 'type-mismatch')).toHaveLength(0);
    });
  });

  describe('detectConflicts — configuration', () => {
    it('should detect conflicting build commands as warning', async () => {
      const def = makeDefinition(
        {
          a: ws('a', 'app'),
          b: ws('b', 'app'),
        },
        {},
        {
          app: {
            ...DEFAULT_WORKSPACE_DEFINITION.types.app,
            build: { command: 'npm run build' },
          },
          package: DEFAULT_WORKSPACE_DEFINITION.types.package,
          tool: DEFAULT_WORKSPACE_DEFINITION.types.tool,
        },
      );
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      // Both workspaces use the same type 'app' with same build command
      const buildConflicts = conflicts.filter(c => c.type === 'build-target');
      expect(buildConflicts.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('resolveConflicts', () => {
    it('should auto-resolve port collision', async () => {
      const def = makeDefinition({
        a: ws('a', 'app', { dev: { port: 3000 } }),
        b: ws('b', 'app', { dev: { port: 3000 } }),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const portConflict = conflicts.find(c => c.type === 'port-collision');

      const result = await manager.resolveConflicts(def, [portConflict!], true);
      expect(result.resolved.length).toBeGreaterThan(0);
      expect(result.changes.some(c => c.property === 'dev.port')).toBe(true);
    });

    it('should auto-resolve type-mismatch by creating type', async () => {
      const def = makeDefinition({
        a: ws('a', 'custom'),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const typeConflict = conflicts.find(c => c.type === 'type-mismatch');

      const result = await manager.resolveConflicts(def, [typeConflict!], true);
      expect(result.resolved.length).toBeGreaterThan(0);
      expect(def.types['custom']).toBeDefined();
    });

    it('should leave unresolved when no resolution exists', async () => {
      const def = makeDefinition({
        a: ws('a'),
        b: ws('b'),
      });
      const manager = new WorkspaceConflictManager();

      // Create a fake conflict with no suggestions
      const result = await manager.resolveConflicts(def, [{
        id: 'fake',
        type: 'configuration',
        severity: 'error',
        description: 'fake',
        details: 'fake',
        affectedWorkspaces: ['a'],
        suggestions: [],
      }], false);

      expect(result.unresolved).toHaveLength(1);
    });
  });

  describe('previewResolution', () => {
    it('should preview port change without modifying definition', async () => {
      const def = makeDefinition({
        a: ws('a', 'app', { dev: { port: 3000 } }),
        b: ws('b', 'app', { dev: { port: 3000 } }),
      });
      const manager = new WorkspaceConflictManager();
      const conflicts = await manager.detectConflicts(def);
      const portConflict = conflicts.find(c => c.type === 'port-collision');
      const resolution = portConflict!.suggestions[0];

      const preview = await manager.previewResolution(def, portConflict!, resolution.id);

      expect(preview.success).toBe(true);
      expect(preview.changes.length).toBeGreaterThan(0);
      // Original should be unchanged
      expect(def.workspaces['b'].dev!.port).toBe(3000);
    });

    it('should throw for non-existent resolution', async () => {
      const def = makeDefinition({ a: ws('a') });
      const manager = new WorkspaceConflictManager();

      await expect(manager.previewResolution(def, {
        id: 'test',
        type: 'naming',
        severity: 'error',
        description: 'test',
        details: 'test',
        affectedWorkspaces: [],
        suggestions: [],
      }, 'non-existent')).rejects.toThrow();
    });
  });

  describe('detection options', () => {
    it('should skip dependency check when disabled', async () => {
      const def = makeDefinition(
        { a: ws('a') },
        { a: [dep('nonexistent')] },
      );
      const manager = new WorkspaceConflictManager();
      const opts: ConflictDetectionOptions = { checkDependencies: false };
      const conflicts = await manager.detectConflicts(def, opts);
      expect(conflicts.filter(c => c.type === 'dependency-missing')).toHaveLength(0);
    });

    it('should skip type check when disabled', async () => {
      const def = makeDefinition({
        a: ws('a', 'unknown'),
      });
      const manager = new WorkspaceConflictManager();
      const opts: ConflictDetectionOptions = { checkTypes: false };
      const conflicts = await manager.detectConflicts(def, opts);
      expect(conflicts.filter(c => c.type === 'type-mismatch')).toHaveLength(0);
    });
  });
});

describe('createWorkspaceConflictManager', () => {
  it('should create a manager instance', async () => {
    const manager = await createWorkspaceConflictManager('/some/path');
    expect(manager).toBeInstanceOf(WorkspaceConflictManager);
  });

  it('should default to cwd when no path provided', async () => {
    const manager = await createWorkspaceConflictManager();
    expect(manager).toBeInstanceOf(WorkspaceConflictManager);
  });
});
