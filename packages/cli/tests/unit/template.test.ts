import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import prompts from 'prompts';
import { manageTemplates } from '../../src/commands/template';
import { templateEngine, TemplateHelpers } from '../../src/utils/template-engine';
import { configManager } from '../../src/utils/config';
import type { ConfigTemplate } from '../../src/utils/template-engine';

// Covers src/commands/template.ts (875 lines) via its single export
// manageTemplates: list/create/delete/apply/show dispatch, five create-source
// flows (file/project/workspace/builtin/custom), interactive management, and
// the JSON/verbose renderers. The templateEngine singleton and configManager
// are mocked; prompts are scripted per flow.

vi.mock('../../src/utils/template-engine', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/template-engine')>();
  return {
    ...original,
    templateEngine: {
      listTemplates: vi.fn(),
      getTemplate: vi.fn(),
      createTemplate: vi.fn(),
      saveTemplate: vi.fn(),
      deleteTemplate: vi.fn(),
      renderTemplate: vi.fn(),
    },
  };
});

vi.mock('../../src/utils/config', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/utils/config')>();
  return {
    ...original,
    configManager: {
      loadProjectConfig: vi.fn(),
      loadWorkspaceConfig: vi.fn(),
      loadGlobalConfig: vi.fn(),
    },
  };
});

vi.mock('prompts', () => ({ default: vi.fn() }));

const engine = vi.mocked(templateEngine);
const promptsMock = vi.mocked(prompts);
const loadProject = vi.mocked(configManager.loadProjectConfig);
const loadWorkspace = vi.mocked(configManager.loadWorkspaceConfig);
const loadGlobal = vi.mocked(configManager.loadGlobalConfig);

let logSpy: ReturnType<typeof vi.spyOn>;
let tempRoot: string;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

/** Minimal well-formed template fixture. */
function tpl(overrides: Partial<ConfigTemplate> = {}): ConfigTemplate {
  return {
    name: 'demo-template',
    version: '1.2.0',
    description: 'A demo template',
    template: { name: '${projectName}', type: 'frontend' },
    variables: [
      {
        name: 'projectName',
        type: 'string',
        description: 'Name of the project',
        required: true,
        validation: { pattern: '^[a-z0-9-]+$' },
      },
      {
        name: 'devPort',
        type: 'number',
        description: 'Dev server port',
        default: 3000,
        validation: { min: 1000, max: 65535 },
      },
    ],
    tags: ['demo', 'frontend'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-02-02T00:00:00.000Z',
    author: 're-shell',
    ...overrides,
  } as ConfigTemplate;
}

describe('template — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-template-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    loadGlobal.mockResolvedValue({
      user: { name: 'Dev', email: 'dev@example.com', organization: 'ACME' },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.removeSync(tempRoot);
  });

  describe('list (default action)', () => {
    it('warns when the template store is empty', async () => {
      engine.listTemplates.mockResolvedValue([]);
      await manageTemplates({});
      expect(output()).toContain('No templates found');
      expect(output()).toContain('re-shell template create');
    });

    it('renders each template with tags, variables and totals', async () => {
      engine.listTemplates.mockResolvedValue([tpl(), tpl({ name: 'other', tags: [] })]);
      await manageTemplates({ list: true });
      expect(output()).toContain('Available Configuration Templates');
      expect(output()).toContain('demo-template (v1.2.0)');
      expect(output()).toContain('A demo template');
      expect(output()).toContain('Tags: demo, frontend');
      expect(output()).toContain('Variables: 2');
      expect(output()).toContain('Author: re-shell');
      expect(output()).toContain('Total: 2 template(s)');
    });

    it('includes creation/update dates in verbose mode', async () => {
      engine.listTemplates.mockResolvedValue([tpl()]);
      await manageTemplates({ list: true, verbose: true });
      expect(output()).toContain('Created:');
      expect(output()).toContain('Updated:');
    });

    it('emits the raw array in JSON mode', async () => {
      engine.listTemplates.mockResolvedValue([tpl()]);
      await manageTemplates({ list: true, json: true });
      expect(JSON.parse(output())).toHaveLength(1);
      expect(JSON.parse(output())[0].name).toBe('demo-template');
    });
  });

  describe('delete', () => {
    it('fails the spinner for an unknown template', async () => {
      engine.getTemplate.mockResolvedValue(null);
      const spinner = stubSpinner();
      await manageTemplates({ delete: true, template: 'ghost', spinner });
      expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining("'ghost' not found"));
      expect(engine.deleteTemplate).not.toHaveBeenCalled();
    });

    it('cancels without deleting when confirmation is declined', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      promptsMock.mockResolvedValueOnce({ confirmed: false } as never);
      const spinner = stubSpinner();
      await manageTemplates({ delete: true, template: 'demo-template', spinner });
      expect(output()).toContain('Operation cancelled');
      expect(engine.deleteTemplate).not.toHaveBeenCalled();
    });

    it('deletes after confirmation', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      promptsMock.mockResolvedValueOnce({ confirmed: true } as never);
      const spinner = stubSpinner();
      await manageTemplates({ delete: true, template: 'demo-template', spinner });
      expect(engine.deleteTemplate).toHaveBeenCalledWith('demo-template');
      expect(output()).toContain("'demo-template' deleted successfully");
    });
  });

  describe('apply', () => {
    it('fails the spinner for an unknown template', async () => {
      engine.getTemplate.mockResolvedValue(null);
      const spinner = stubSpinner();
      await manageTemplates({ apply: true, template: 'ghost', spinner });
      expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining("'ghost' not found"));
    });

    it('rejects malformed --variables JSON', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      await expect(
        manageTemplates({ apply: true, template: 'demo-template', variables: '{bad' })
      ).rejects.toThrow('Invalid variables JSON format');
    });

    it('renders with CLI variables and prints the generated config', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      engine.renderTemplate.mockResolvedValue({ name: 'my-app' } as never);
      await manageTemplates({
        apply: true,
        template: 'demo-template',
        variables: '{"projectName":"my-app"}',
      });
      expect(engine.renderTemplate).toHaveBeenCalledWith(
        'demo-template',
        { projectName: 'my-app' },
        expect.objectContaining({
          userInfo: { name: 'Dev', email: 'dev@example.com', organization: 'ACME' },
        })
      );
      expect(output()).toContain('Generated Configuration');
      expect(output()).toContain('my-app');
    });

    it('collects variable values interactively when --variables is absent', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      engine.renderTemplate.mockResolvedValue({ name: 'prompted-app' } as never);
      promptsMock
        .mockResolvedValueOnce({ value: 'prompted-app' } as never)
        .mockResolvedValueOnce({ value: 4000 } as never);
      await manageTemplates({ apply: true, template: 'demo-template' });
      expect(promptsMock).toHaveBeenCalledTimes(2);
      expect(engine.renderTemplate).toHaveBeenCalledWith(
        'demo-template',
        { projectName: 'prompted-app', devPort: 4000 },
        expect.anything()
      );
    });

    it('attaches project context when a project config exists', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      engine.renderTemplate.mockResolvedValue({} as never);
      loadProject.mockResolvedValue({
        name: 'proj',
        type: 'frontend',
        framework: 'react',
        packageManager: 'pnpm',
      } as never);
      await manageTemplates({
        apply: true,
        template: 'demo-template',
        variables: '{}',
      });
      expect(engine.renderTemplate).toHaveBeenCalledWith(
        'demo-template',
        {},
        expect.objectContaining({
          projectInfo: { name: 'proj', type: 'frontend', framework: 'react', packageManager: 'pnpm' },
        })
      );
    });

    it('writes the rendered config to --output', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      engine.renderTemplate.mockResolvedValue({ name: 'saved-app' } as never);
      fs.ensureDirSync(path.join(tempRoot, 'out')); // writeFile does not mkdir
      const outPath = path.join(tempRoot, 'out', 'config.json');
      await manageTemplates({
        apply: true,
        template: 'demo-template',
        variables: '{}',
        output: outPath,
      });
      expect(fs.readJsonSync(outPath)).toEqual({ name: 'saved-app' });
      expect(output()).toContain(`saved to: ${path.resolve(outPath)}`);
    });

    it('emits raw JSON in JSON mode', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      engine.renderTemplate.mockResolvedValue({ name: 'json-app' } as never);
      await manageTemplates({
        apply: true,
        template: 'demo-template',
        variables: '{}',
        json: true,
      });
      // Header lines print before the payload — parse the final log entry.
      const lines = logSpy.mock.calls.map(c => c.map(String).join(' '));
      expect(JSON.parse(lines[lines.length - 1])).toEqual({ name: 'json-app' });
    });
  });

  describe('show', () => {
    it('fails the spinner for an unknown template', async () => {
      engine.getTemplate.mockResolvedValue(null);
      const spinner = stubSpinner();
      await manageTemplates({ show: true, template: 'ghost', spinner });
      expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining("'ghost' not found"));
    });

    it('renders metadata, variables and validation rules', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      await manageTemplates({ show: true, template: 'demo-template' });
      expect(output()).toContain('Template: demo-template (v1.2.0)');
      expect(output()).toContain('Description: A demo template');
      expect(output()).toContain('Tags: demo, frontend');
      expect(output()).toContain('1. projectName (string)');
      expect(output()).toContain('Required');
      expect(output()).toContain('Pattern: ^[a-z0-9-]+$');
      expect(output()).toContain('Default: 3000');
      expect(output()).toContain('Min: 1000');
      expect(output()).toContain('Max: 65535');
    });

    it('prints the template structure in verbose mode', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      await manageTemplates({ show: true, template: 'demo-template', verbose: true });
      expect(output()).toContain('Template Structure:');
      expect(output()).toContain('"type": "frontend"');
    });

    it('emits the template as raw JSON', async () => {
      engine.getTemplate.mockResolvedValue(tpl());
      await manageTemplates({ show: true, template: 'demo-template', json: true });
      expect(JSON.parse(output()).name).toBe('demo-template');
    });
  });

  describe('create', () => {
    it('returns silently when the source prompt is cancelled', async () => {
      promptsMock.mockResolvedValueOnce({} as never);
      await manageTemplates({ create: true });
      expect(engine.createTemplate).not.toHaveBeenCalled();
    });

    it('creates a file-based template with a name variable', async () => {
      promptsMock
        .mockResolvedValueOnce({ source: 'file' } as never)
        .mockResolvedValueOnce({
          filePath: 'config.json',
          templateName: 'from-file',
          description: 'FromFile desc',
        } as never);
      engine.createTemplate.mockResolvedValue(tpl({ name: 'from-file' }));
      await manageTemplates({ create: true });
      expect(engine.createTemplate).toHaveBeenCalledWith(
        'from-file',
        { name: '${name}' },
        [expect.objectContaining({ name: 'name', required: true })],
        expect.objectContaining({ description: 'FromFile desc', tags: ['custom', 'file-based'] })
      );
      expect(output()).toContain("'from-file' created successfully");
    });

    it('bails when no project configuration exists', async () => {
      loadProject.mockResolvedValue(null);
      promptsMock.mockResolvedValueOnce({ source: 'project' } as never);
      await manageTemplates({ create: true });
      expect(output()).toContain('No project configuration found');
      expect(engine.createTemplate).not.toHaveBeenCalled();
    });

    it('creates a project template with substituted variables', async () => {
      loadProject.mockResolvedValue({
        name: 'my-proj',
        framework: 'react',
        packageManager: 'pnpm',
        dev: { port: 3000 },
        quality: { coverage: { threshold: 80 } },
      } as never);
      promptsMock
        .mockResolvedValueOnce({ source: 'project' } as never)
        .mockResolvedValueOnce({
          templateName: 'proj-tpl',
          description: 'From project',
          variableFields: ['name', 'dev.port'],
        } as never);
      engine.createTemplate.mockResolvedValue(tpl({ name: 'proj-tpl' }));
      await manageTemplates({ create: true });

      const [name, config, variables, meta] = engine.createTemplate.mock.calls[0];
      expect(name).toBe('proj-tpl');
      expect(config).toMatchObject({ name: '${projectName}', dev: { port: '${devPort}' } });
      expect(variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'projectName', required: true }),
          expect.objectContaining({ name: 'devPort', default: 3000 }),
        ])
      );
      expect(meta.tags).toEqual(['project', 'react', 'pnpm']);
      expect(output()).toContain('created from project configuration');
    });

    it('bails when no workspace configuration exists at the path', async () => {
      promptsMock
        .mockResolvedValueOnce({ source: 'workspace' } as never)
        .mockResolvedValueOnce({ workspacePath: tempRoot } as never);
      loadWorkspace.mockResolvedValue(null);
      await manageTemplates({ create: true });
      expect(output()).toContain('No workspace configuration found');
      expect(engine.createTemplate).not.toHaveBeenCalled();
    });

    it('creates a workspace template with substituted name and framework', async () => {
      loadWorkspace.mockResolvedValue({
        name: 'my-workspace',
        type: 'app',
        framework: 'react',
      } as never);
      promptsMock
        .mockResolvedValueOnce({ source: 'workspace' } as never)
        .mockResolvedValueOnce({ workspacePath: tempRoot } as never)
        .mockResolvedValueOnce({
          templateName: 'ws-tpl',
          description: 'From workspace',
        } as never);
      engine.createTemplate.mockResolvedValue(tpl({ name: 'ws-tpl' }));
      await manageTemplates({ create: true });

      const [name, config, variables, meta] = engine.createTemplate.mock.calls[0];
      expect(name).toBe('ws-tpl');
      expect(config).toEqual({ name: '${workspaceName}', type: 'app', framework: '${framework}' });
      expect(variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'workspaceName', required: true }),
          expect.objectContaining({ name: 'framework', default: 'react' }),
        ])
      );
      expect(meta.tags).toEqual(['workspace', 'app', 'react']);
    });

    it('saves a built-in react project template', async () => {
      promptsMock
        .mockResolvedValueOnce({ source: 'builtin' } as never)
        .mockResolvedValueOnce({ type: 'react-project', packageManager: 'yarn' } as never);
      await manageTemplates({ create: true });
      const saved = engine.saveTemplate.mock.calls[0][0];
      // TemplateHelpers derives the name from the framework + '-ts' suffix.
      expect(saved.name).toBe('react-ts-project');
      expect(output()).toContain(
        "Built-in template 'react-ts-project' created successfully"
      );
    });

    it('saves a built-in workspace template for each workspace kind', async () => {
      for (const kind of ['package-workspace', 'app-workspace', 'lib-workspace']) {
        vi.clearAllMocks();
        logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        promptsMock
          .mockResolvedValueOnce({ source: 'builtin' } as never)
          .mockResolvedValueOnce({ type: kind, packageManager: 'pnpm' } as never);
        await manageTemplates({ create: true });
        const saved = engine.saveTemplate.mock.calls[0][0];
        expect(saved.name).toBe(kind.split('-')[0] + '-workspace');
      }
    });

    it('creates a custom template with interactively defined variables', async () => {
      promptsMock
        .mockResolvedValueOnce({ source: 'custom' } as never)
        .mockResolvedValueOnce({
          name: 'my-custom',
          description: 'Custom desc',
          version: '2.0.0',
          tags: ['alpha', 'beta'],
        } as never)
        // first variable: JSON default parses to an object
        .mockResolvedValueOnce({
          name: 'featureFlags',
          type: 'object',
          description: 'Feature flags',
          required: false,
          defaultValue: '{"dark":true}',
          addMore: true,
        } as never)
        // second variable: plain-string default stays a string
        .mockResolvedValueOnce({
          name: 'region',
          type: 'string',
          description: 'Deploy region',
          required: true,
          defaultValue: 'eu-west-1',
          addMore: false,
        } as never);
      engine.createTemplate.mockResolvedValue(tpl({ name: 'my-custom' }));
      await manageTemplates({ create: true });

      const [name, , variables, meta] = engine.createTemplate.mock.calls[0];
      expect(name).toBe('my-custom');
      expect(variables).toEqual([
        expect.objectContaining({ name: 'featureFlags', default: { dark: true } }),
        expect.objectContaining({ name: 'region', default: 'eu-west-1', required: true }),
      ]);
      expect(meta).toMatchObject({ version: '2.0.0', tags: ['alpha', 'beta'] });
      expect(output()).toContain("Custom template 'my-custom' created successfully");
    });

    it('drops a custom variable when its name prompt is cancelled', async () => {
      promptsMock
        .mockResolvedValueOnce({ source: 'custom' } as never)
        .mockResolvedValueOnce({
          name: 'solo',
          description: 'd',
          version: '1.0.0',
          tags: [],
        } as never)
        .mockResolvedValueOnce({ addMore: false } as never); // no `name` → skipped
      engine.createTemplate.mockResolvedValue(tpl({ name: 'solo' }));
      await manageTemplates({ create: true });
      expect(engine.createTemplate.mock.calls[0][2]).toEqual([]);
    });

    it('rejects an unknown built-in template type', async () => {
      promptsMock
        .mockResolvedValueOnce({ source: 'builtin' } as never)
        .mockResolvedValueOnce({ type: 'zig-project', packageManager: 'pnpm' } as never);
      await expect(manageTemplates({ create: true })).rejects.toThrow(
        'Unknown template type: zig-project'
      );
    });
  });

  describe('interactive', () => {
    it('lists templates through the interactive menu', async () => {
      promptsMock.mockResolvedValueOnce({ action: 'list' } as never);
      engine.listTemplates.mockResolvedValue([tpl()]);
      await manageTemplates({ interactive: true });
      expect(output()).toContain('demo-template (v1.2.0)');
    });

    it('shows a selected template through the interactive menu', async () => {
      engine.listTemplates.mockResolvedValue([tpl()]);
      promptsMock
        .mockResolvedValueOnce({ action: 'show' } as never)
        .mockResolvedValueOnce({ template: 'demo-template' } as never);
      engine.getTemplate.mockResolvedValue(tpl());
      await manageTemplates({ interactive: true });
      expect(output()).toContain('Template: demo-template (v1.2.0)');
    });

    it('applies a selected template through the interactive menu', async () => {
      engine.listTemplates.mockResolvedValue([tpl()]);
      promptsMock
        .mockResolvedValueOnce({ action: 'apply' } as never)
        .mockResolvedValueOnce({ template: 'demo-template' } as never);
      engine.getTemplate.mockResolvedValue(tpl());
      engine.renderTemplate.mockResolvedValue({ name: 'interactive-app' } as never);
      promptsMock.mockResolvedValueOnce({ value: 'interactive-app' } as never);
      promptsMock.mockResolvedValueOnce({ value: 3000 } as never);
      await manageTemplates({ interactive: true });
      expect(engine.renderTemplate).toHaveBeenCalledWith(
        'demo-template',
        { projectName: 'interactive-app', devPort: 3000 },
        expect.anything()
      );
    });

    it('deletes a selected template through the interactive menu', async () => {
      engine.listTemplates.mockResolvedValue([tpl()]);
      promptsMock
        .mockResolvedValueOnce({ action: 'delete' } as never)
        .mockResolvedValueOnce({ template: 'demo-template' } as never)
        .mockResolvedValueOnce({ confirmed: true } as never);
      engine.getTemplate.mockResolvedValue(tpl());
      await manageTemplates({ interactive: true });
      expect(engine.deleteTemplate).toHaveBeenCalledWith('demo-template');
    });

    it('notifies when no templates exist for the show/apply/delete sub-actions', async () => {
      engine.listTemplates.mockResolvedValue([]);
      for (const action of ['show', 'apply', 'delete']) {
        logSpy.mockClear();
        promptsMock.mockResolvedValueOnce({ action } as never);
        await manageTemplates({ interactive: true });
        expect(output()).toContain('No templates available');
      }
    });

    it('returns silently when the interactive menu is cancelled', async () => {
      promptsMock.mockResolvedValueOnce({} as never);
      await manageTemplates({ interactive: true });
      expect(engine.listTemplates).not.toHaveBeenCalled();
    });
  });

  it('fails the spinner and rethrows on engine errors', async () => {
    engine.listTemplates.mockRejectedValue(new Error('engine exploded'));
    const spinner = stubSpinner();
    await expect(manageTemplates({ spinner })).rejects.toThrow('engine exploded');
    expect(spinner.fail).toHaveBeenCalledWith(expect.stringContaining('Template operation failed'));
  });
});

/** Minimal spinner stub matching the ProgressSpinner surface used here. */
function stubSpinner() {
  return {
    setText: vi.fn(),
    stop: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };
}

// TemplateHelpers stays real (its own suite covers it) — reference it so the
// import is exercised and tree-shaking keeps it wired in the mock module.
void TemplateHelpers;
