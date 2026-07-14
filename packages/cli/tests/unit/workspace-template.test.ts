import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  WorkspaceTemplateManager,
  createWorkspaceTemplateManager,
  exportWorkspaceAsTemplate,
  type WorkspaceTemplate,
  type TemplateVariable,
  type TemplateContext,
} from '../../src/utils/workspace-template';
import {
  DEFAULT_WORKSPACE_DEFINITION,
  type WorkspaceDefinition,
} from '../../src/utils/workspace-schema';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reshell-tmpl-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const simpleTemplate: WorkspaceTemplate = {
  name: 'simple-app',
  description: 'A simple app template',
  version: '1.0.0',
  variables: [
    { name: 'appName', type: 'string', required: true },
    { name: 'port', type: 'number', default: 3000 },
  ],
  patterns: ['apps/*'],
  scripts: {
    dev: 'vite --port {{port}}',
    build: 'vite build',
  },
  workspaceDefaults: {
    type: 'app',
  },
};

describe('WorkspaceTemplateManager', () => {
  describe('init + built-in templates', () => {
    it('should initialize and load built-in templates', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      const templates = await manager.listTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);
      expect(templates.some(t => t.name === 'microfrontend')).toBe(true);
      expect(templates.some(t => t.name === 'library')).toBe(true);
      expect(templates.some(t => t.name === 'monorepo')).toBe(true);
    });

    it('should persist registry to disk', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      // Re-create manager from same dir
      const manager2 = new WorkspaceTemplateManager(dir);
      await manager2.loadRegistry();

      const templates = await manager2.listTemplates();
      expect(templates.length).toBeGreaterThan(0);
    });
  });

  describe('createTemplate + getTemplate', () => {
    it('should create and retrieve a template', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      const retrieved = await manager.getTemplate('simple-app');

      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('simple-app');
      expect(retrieved!.version).toBe('1.0.0');
    });

    it('should cache templates after first retrieval', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      const t1 = await manager.getTemplate('simple-app');
      const t2 = await manager.getTemplate('simple-app');
      expect(t1).toBe(t2); // Same reference (cached)
    });

    it('should throw when creating duplicate template', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      await expect(manager.createTemplate(simpleTemplate)).rejects.toThrow('already exists');
    });

    it('should throw for template without name', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await expect(
        manager.createTemplate({ name: '', version: '1.0.0' } as WorkspaceTemplate),
      ).rejects.toThrow('name is required');
    });

    it('should throw for template without version', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await expect(
        manager.createTemplate({ name: 'test', version: '' } as WorkspaceTemplate),
      ).rejects.toThrow('version is required');
    });

    it('should throw for self-extending template', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await expect(
        manager.createTemplate({
          name: 'self-ref',
          version: '1.0.0',
          extends: 'self-ref',
        }),
      ).rejects.toThrow('extend itself');
    });

    it('should return null for non-existent template', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      const result = await manager.getTemplate('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      await manager.deleteTemplate('simple-app');

      const result = await manager.getTemplate('simple-app');
      expect(result).toBeNull();
    });

    it('should throw when deleting non-existent template', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await expect(manager.deleteTemplate('non-existent')).rejects.toThrow('not found');
    });

    it('should refuse to delete template that is extended', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'parent-tmpl',
        version: '1.0.0',
      });
      await manager.createTemplate({
        name: 'child-tmpl',
        version: '1.0.0',
        extends: 'parent-tmpl',
      });

      await expect(manager.deleteTemplate('parent-tmpl')).rejects.toThrow('used by');
    });
  });

  describe('applyTemplate', () => {
    it('should apply template with variable substitution', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      const context: TemplateContext = {
        variables: { appName: 'my-app', port: 8080 },
      };

      const result = await manager.applyTemplate('simple-app', context);
      expect(result.scripts).toBeDefined();
      expect(result.scripts!['dev']).toContain('8080');
    });

    it('should use default variable when not provided for validation', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      const context: TemplateContext = {
        variables: { appName: 'my-app' },
      };

      // Default is used for validation (no error thrown) but not
      // automatically injected into substitution context
      const result = await manager.applyTemplate('simple-app', context);
      expect(result.scripts).toBeDefined();
      expect(result.scripts!['build']).toBe('vite build');
    });

    it('should throw when required variable is missing', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      await expect(
        manager.applyTemplate('simple-app', { variables: {} }),
      ).rejects.toThrow('Required variable');
    });

    it('should throw for wrong variable type', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'type-test',
        version: '1.0.0',
        variables: [
          { name: 'count', type: 'number', required: true },
        ],
      });

      await expect(
        manager.applyTemplate('type-test', { variables: { count: 'not-a-number' } }),
      ).rejects.toThrow('must be of type number');
    });

    it('should throw for enum violation', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'enum-test',
        version: '1.0.0',
        variables: [
          { name: 'color', type: 'string', enum: ['red', 'green', 'blue'] },
        ],
      });

      await expect(
        manager.applyTemplate('enum-test', { variables: { color: 'yellow' } }),
      ).rejects.toThrow('must be one of');
    });

    it('should throw for pattern mismatch', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'pattern-test',
        version: '1.0.0',
        variables: [
          { name: 'id', type: 'string', required: true, pattern: '^[a-z]+$' },
        ],
      });

      await expect(
        manager.applyTemplate('pattern-test', { variables: { id: 'ABC123' } }),
      ).rejects.toThrow('pattern');
    });

    it('should throw for non-existent template', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await expect(
        manager.applyTemplate('non-existent', { variables: {} }),
      ).rejects.toThrow('not found');
    });

    it('should apply workspace defaults to context workspace', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate(simpleTemplate);
      const ws = { name: 'test', type: '', path: './test' } as any;
      const context: TemplateContext = {
        variables: { appName: 'test', port: 3000 },
        workspace: ws,
      };

      await manager.applyTemplate('simple-app', context);
      expect(ws.type).toBe('app');
    });
  });

  describe('resolveInheritanceChain', () => {
    it('should resolve simple inheritance', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'base-tmpl',
        version: '1.0.0',
        scripts: { build: 'npm run build' },
        patterns: ['apps/*'],
      });
      await manager.createTemplate({
        name: 'derived-tmpl',
        version: '1.0.0',
        extends: 'base-tmpl',
        scripts: { test: 'vitest' },
      });

      const chain = await manager.resolveInheritanceChain('derived-tmpl');
      expect(chain.templates).toHaveLength(2);
      expect(chain.templates[0].name).toBe('base-tmpl');
      expect(chain.templates[1].name).toBe('derived-tmpl');
      expect(chain.merged.scripts).toHaveProperty('build');
      expect(chain.merged.scripts).toHaveProperty('test');
    });

    it('should merge patterns from inheritance chain', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'parent-pat',
        version: '1.0.0',
        patterns: ['apps/*'],
      });
      await manager.createTemplate({
        name: 'child-pat',
        version: '1.0.0',
        extends: 'parent-pat',
        patterns: ['packages/*'],
      });

      const chain = await manager.resolveInheritanceChain('child-pat');
      expect(chain.merged.patterns).toContain('apps/*');
      expect(chain.merged.patterns).toContain('packages/*');
    });

    it('should detect circular inheritance', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      // Manually create two templates that extend each other
      await manager.createTemplate({
        name: 'circ-a',
        version: '1.0.0',
        extends: 'circ-b',
      });
      await manager.createTemplate({
        name: 'circ-b',
        version: '1.0.0',
        extends: 'circ-a',
      });

      await expect(manager.resolveInheritanceChain('circ-a')).rejects.toThrow('Circular');
    });

    it('should throw when parent template is missing', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'orphan-child',
        version: '1.0.0',
        extends: 'missing-parent',
      });

      await expect(manager.resolveInheritanceChain('orphan-child')).rejects.toThrow('not found');
    });
  });

  describe('variable validation edge cases', () => {
    it('should validate enum default at template creation', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await expect(
        manager.createTemplate({
          name: 'bad-enum',
          version: '1.0.0',
          variables: [
            {
              name: 'color',
              type: 'string',
              enum: ['red', 'green'],
              default: 'blue',
            },
          ],
        }),
      ).rejects.toThrow('not in enum');
    });

    it('should validate pattern only on string type', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await expect(
        manager.createTemplate({
          name: 'bad-pattern',
          version: '1.0.0',
          variables: [
            { name: 'count', type: 'number', pattern: '^[0-9]+$' },
          ],
        }),
      ).rejects.toThrow('Pattern validation only applies to string');
    });

    it('should validate boolean type', async () => {
      const dir = makeTempDir();
      const manager = new WorkspaceTemplateManager(dir);
      await manager.init();

      await manager.createTemplate({
        name: 'bool-test',
        version: '1.0.0',
        variables: [
          { name: 'enabled', type: 'boolean', default: true },
        ],
      });

      await expect(
        manager.applyTemplate('bool-test', { variables: { enabled: 'yes' } }),
      ).rejects.toThrow('must be of type boolean');
    });
  });
});

describe('createWorkspaceTemplateManager', () => {
  it('should create and initialize a manager', async () => {
    const dir = makeTempDir();
    const manager = await createWorkspaceTemplateManager(dir);
    const templates = await manager.listTemplates();
    expect(templates.length).toBeGreaterThan(0);
  });
});

describe('exportWorkspaceAsTemplate', () => {
  it('should export a definition as a template', async () => {
    const def: WorkspaceDefinition = {
      ...DEFAULT_WORKSPACE_DEFINITION,
      name: 'my-project',
    };

    const template = await exportWorkspaceAsTemplate(def, 'exported-tmpl');
    expect(template.name).toBe('exported-tmpl');
    expect(template.version).toBe('1.0.0');
    expect(template.description).toContain('my-project');
    expect(template.patterns).toEqual(def.patterns);
    expect(template.metadata).toBeDefined();
    expect(template.metadata!.exportedFrom).toBe('my-project');
  });

  it('should export with custom variables', async () => {
    const def: WorkspaceDefinition = { ...DEFAULT_WORKSPACE_DEFINITION };
    const vars: TemplateVariable[] = [
      { name: 'env', type: 'string', required: true },
    ];

    const template = await exportWorkspaceAsTemplate(def, 'test', vars);
    expect(template.variables).toHaveLength(1);
    expect(template.variables![0].name).toBe('env');
  });
});
