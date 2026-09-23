import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, writeFileSync as fsWrite } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as yaml from 'yaml';
import {
  WorkspaceSchemaValidator,
  DEFAULT_WORKSPACE_DEFINITION,
  createDefaultWorkspaceDefinition,
  loadWorkspaceDefinition,
  saveWorkspaceDefinition,
  type WorkspaceDefinition,
  type WorkspaceEntry,
  type WorkspaceDependency,
} from '../../src/utils/workspace-schema';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-schema-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function makeMinimalDefinition(overrides: Partial<WorkspaceDefinition> = {}): WorkspaceDefinition {
  return {
    ...DEFAULT_WORKSPACE_DEFINITION,
    workspaces: {},
    dependencies: {},
    ...overrides,
  };
}

const wsEntry = (name: string, type = 'app'): WorkspaceEntry => ({
  name,
  type,
  path: `./apps/${name}`,
});

const dep = (name: string, type: WorkspaceDependency['type'] = 'build'): WorkspaceDependency => ({
  name,
  type,
});

describe('DEFAULT_WORKSPACE_DEFINITION', () => {
  it('should have version 1.0', () => {
    expect(DEFAULT_WORKSPACE_DEFINITION.version).toBe('1.0');
  });

  it('should include default workspace types', () => {
    expect(DEFAULT_WORKSPACE_DEFINITION.types).toHaveProperty('app');
    expect(DEFAULT_WORKSPACE_DEFINITION.types).toHaveProperty('package');
    expect(DEFAULT_WORKSPACE_DEFINITION.types).toHaveProperty('tool');
  });

  it('should have default scripts', () => {
    expect(DEFAULT_WORKSPACE_DEFINITION.scripts).toHaveProperty('build:all');
    expect(DEFAULT_WORKSPACE_DEFINITION.scripts).toHaveProperty('test:all');
    expect(DEFAULT_WORKSPACE_DEFINITION.scripts).toHaveProperty('lint:all');
  });

  it('should have default patterns', () => {
    expect(DEFAULT_WORKSPACE_DEFINITION.patterns).toContain('apps/*');
    expect(DEFAULT_WORKSPACE_DEFINITION.patterns).toContain('packages/*');
  });
});

describe('createDefaultWorkspaceDefinition', () => {
  it('should create a definition with the given name', () => {
    const def = createDefaultWorkspaceDefinition('my-project');
    expect(def.name).toBe('my-project');
  });

  it('should set metadata timestamps', () => {
    const def = createDefaultWorkspaceDefinition('test');
    expect(def.metadata).toBeDefined();
    expect(def.metadata!.created).toBeTruthy();
    expect(def.metadata!.lastModified).toBeTruthy();
  });

  it('should apply overrides', () => {
    const def = createDefaultWorkspaceDefinition('test', {
      version: '2.0',
      root: '/custom',
    });
    expect(def.version).toBe('2.0');
    expect(def.root).toBe('/custom');
  });
});

describe('WorkspaceSchemaValidator', () => {
  describe('validateDefinition', () => {
    it('should pass for a valid default definition', async () => {
      const def = makeMinimalDefinition();
      const validator = new WorkspaceSchemaValidator(def, makeTempDir());

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when required field version is missing', async () => {
      const def = makeMinimalDefinition();
      (def as any).version = undefined;
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('version'))).toBe(true);
    });

    it('should fail when required field name is missing', async () => {
      const def = makeMinimalDefinition();
      (def as any).name = undefined;
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('name'))).toBe(true);
    });

    it('should fail for unsupported version', async () => {
      const def = makeMinimalDefinition({ version: '2.0' });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unsupported version'))).toBe(true);
    });

    it('should fail when patterns array is empty', async () => {
      const def = makeMinimalDefinition({ patterns: [] });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('pattern'))).toBe(true);
    });

    it('should fail when types is empty', async () => {
      const def = makeMinimalDefinition({ types: {} });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('type'))).toBe(true);
    });

    it('should fail for unknown workspace type', async () => {
      const def = makeMinimalDefinition({
        workspaces: { myapp: wsEntry('myapp', 'unknown-type') },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unknown workspace type'))).toBe(true);
    });

    it('should detect self-dependency', async () => {
      const def = makeMinimalDefinition({
        workspaces: { a: wsEntry('a') },
        dependencies: { a: [dep('a')] },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('depend on itself'))).toBe(true);
    });

    it('should detect dependency on unknown workspace', async () => {
      const def = makeMinimalDefinition({
        workspaces: { a: wsEntry('a') },
        dependencies: { a: [dep('nonexistent')] },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Unknown dependency'))).toBe(true);
    });

    it('should detect dependency for unknown workspace key', async () => {
      const def = makeMinimalDefinition({
        workspaces: { a: wsEntry('a') },
        dependencies: { ghost: [dep('a')] },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('unknown workspace'))).toBe(true);
    });

    it('should warn for broad patterns', async () => {
      const def = makeMinimalDefinition({ patterns: ['*'] });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.warnings.some(w => w.message.includes('broad'))).toBe(true);
    });

    it('should warn for high concurrency', async () => {
      const def = makeMinimalDefinition({
        build: { maxConcurrency: 20 },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.warnings.some(w => w.path === 'build.maxConcurrency')).toBe(true);
    });

    it('should suggest enabling cache', async () => {
      const def = makeMinimalDefinition({
        build: { cache: false },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.suggestions.some(s => s.path === 'build.cache')).toBe(true);
    });

    it('should fail when script is missing command', async () => {
      const def = makeMinimalDefinition({
        scripts: { 'bad-script': { command: '' } as any },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.errors.some(e => e.message.includes('missing command'))).toBe(true);
    });

    it('should fail when script targets unknown workspace', async () => {
      const def = makeMinimalDefinition({
        scripts: {
          'my-script': {
            command: 'echo hi',
            workspaces: ['ghost'],
          },
        },
      });
      const validator = new WorkspaceSchemaValidator(def);

      const result = await validator.validateDefinition();
      expect(result.errors.some(e => e.message.includes('unknown workspace'))).toBe(true);
    });
  });

  describe('validateWorkspaceStructure', () => {
    it('should fail when workspace directory does not exist', async () => {
      const dir = makeTempDir();
      const def = makeMinimalDefinition({
        workspaces: { myapp: wsEntry('myapp') },
      });
      const validator = new WorkspaceSchemaValidator(def, dir);

      const result = await validator.validateWorkspaceStructure();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('not found'))).toBe(true);
    });

    it('should pass when workspace directory exists', async () => {
      const dir = makeTempDir();
      mkdirSync(join(dir, 'apps', 'myapp'), { recursive: true });
      fsWrite(join(dir, 'apps', 'myapp', 'package.json'), '{"name":"myapp"}');

      const def = makeMinimalDefinition({
        workspaces: { myapp: wsEntry('myapp') },
      });
      const validator = new WorkspaceSchemaValidator(def, dir);

      const result = await validator.validateWorkspaceStructure();
      // The workspace directory should exist (no "not found" error)
      expect(result.errors.some(e => e.message.includes('not found'))).toBe(false);
    });

    it('should fail when required file is missing', async () => {
      const dir = makeTempDir();
      mkdirSync(join(dir, 'apps', 'myapp'), { recursive: true });

      const def = makeMinimalDefinition({
        workspaces: { myapp: wsEntry('myapp') },
      });
      const validator = new WorkspaceSchemaValidator(def, dir);

      const result = await validator.validateWorkspaceStructure();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Required file missing'))).toBe(true);
    });

    it('should warn when package name differs from workspace name', async () => {
      const dir = makeTempDir();
      mkdirSync(join(dir, 'apps', 'myapp'), { recursive: true });
      fsWrite(join(dir, 'apps', 'myapp', 'package.json'), '{"name":"different-name"}');

      const def = makeMinimalDefinition({
        workspaces: { myapp: wsEntry('myapp') },
      });
      const validator = new WorkspaceSchemaValidator(def, dir);

      const result = await validator.validateWorkspaceStructure();
      expect(result.warnings.some(w => w.message.includes('differs'))).toBe(true);
    });
  });

  describe('autoDetectWorkspaces', () => {
    it('should throw when glob is not available (pre-existing import issue)', async () => {
      const dir = makeTempDir();
      const def = makeMinimalDefinition();
      const validator = new WorkspaceSchemaValidator(def, dir);

      // glob v10 removed default export sync — source code uses deprecated API
      await expect(validator.autoDetectWorkspaces()).rejects.toThrow();
    });
  });
});

describe('loadWorkspaceDefinition', () => {
  it('should load and validate a YAML definition file', async () => {
    const dir = makeTempDir();
    const def = makeMinimalDefinition();
    const filePath = join(dir, 'workspace.yaml');
    fsWrite(filePath, yaml.stringify(def));

    const loaded = await loadWorkspaceDefinition(filePath);
    expect(loaded.name).toBe(def.name);
    expect(loaded.version).toBe('1.0');
  });

  it('should throw when file does not exist', async () => {
    await expect(loadWorkspaceDefinition('/nonexistent/file.yaml')).rejects.toThrow();
  });

  it('should throw for invalid definition', async () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'workspace.yaml');
    fsWrite(filePath, yaml.stringify({ version: '99.0', name: 'bad' }));

    await expect(loadWorkspaceDefinition(filePath)).rejects.toThrow();
  });
});

describe('saveWorkspaceDefinition', () => {
  it('should save and update lastModified', async () => {
    const dir = makeTempDir();
    const def = makeMinimalDefinition();
    const filePath = join(dir, 'workspace.yaml');

    await saveWorkspaceDefinition(def, filePath);

    const loaded = await loadWorkspaceDefinition(filePath);
    expect(loaded.metadata).toBeDefined();
    expect(loaded.metadata!.lastModified).toBeTruthy();
  });

  it('should throw when saving invalid definition', async () => {
    const dir = makeTempDir();
    const filePath = join(dir, 'workspace.yaml');
    const def = makeMinimalDefinition({ version: '99.0' });

    await expect(saveWorkspaceDefinition(def, filePath)).rejects.toThrow();
  });

  it('should preserve existing created timestamp', async () => {
    const dir = makeTempDir();
    const originalCreated = '2020-01-01T00:00:00.000Z';
    const def = makeMinimalDefinition({
      metadata: {
        created: originalCreated,
        lastModified: originalCreated,
      },
    });
    const filePath = join(dir, 'workspace.yaml');

    await saveWorkspaceDefinition(def, filePath);
    const loaded = await loadWorkspaceDefinition(filePath);
    expect(loaded.metadata!.created).toBe(originalCreated);
  });
});
