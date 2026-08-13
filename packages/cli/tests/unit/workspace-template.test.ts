import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { manageWorkspaceTemplate } from '../../src/commands/workspace-template';
import { ValidationError } from '../../src/utils/error-handler';

// Covers src/commands/workspace-template.ts — the `workspace-template` command
// (list/create/apply/show/delete/export/interactive/default-list). We mock the
// WorkspaceTemplateManager factory + exportWorkspaceAsTemplate + loadWorkspaceDefinition
// + prompts + createSpinner, and use a real temp dir for the --output write path.

const mocks = vi.hoisted(() => ({
  listTemplates: vi.fn(),
  getTemplate: vi.fn(),
  createTemplate: vi.fn(),
  applyTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  resolveInheritanceChain: vi.fn(),
  createWorkspaceTemplateManager: vi.fn(),
  exportWorkspaceAsTemplate: vi.fn(),
  loadWorkspaceDefinition: vi.fn(),
  prompts: vi.fn(),
  createSpinner: vi.fn(),
}));

vi.mock('../../src/utils/workspace-template', () => ({
  createWorkspaceTemplateManager: mocks.createWorkspaceTemplateManager,
  exportWorkspaceAsTemplate: mocks.exportWorkspaceAsTemplate,
}));
vi.mock('../../src/utils/workspace-schema', () => ({
  loadWorkspaceDefinition: mocks.loadWorkspaceDefinition,
}));
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: mocks.createSpinner,
  flushOutput: vi.fn(),
  ProgressSpinner: class {},
}));
vi.mock('prompts', () => ({ default: mocks.prompts }));

const TEMPLATE = {
  name: 'std',
  version: '1.2.0',
  description: 'standard template',
  extends: 'base',
  variables: [{ name: 'port', type: 'number', required: false, default: 3000 }],
  patterns: ['apps/*'],
  scripts: { dev: 'vite' },
};

function fakeSpinner() {
  return {
    setText: vi.fn(),
    stop: vi.fn(),
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn(),
    fail: vi.fn(),
    warn: vi.fn(),
  } as any;
}

let tmp: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function out(): string {
  return logSpy.mock.calls.map(a => a.join(' ')).join('\n');
}
function loggedJson(find: (s: string) => boolean): any {
  return JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(find)!);
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-wst-'));
});
afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.createWorkspaceTemplateManager.mockResolvedValue({
    listTemplates: mocks.listTemplates,
    getTemplate: mocks.getTemplate,
    createTemplate: mocks.createTemplate,
    applyTemplate: mocks.applyTemplate,
    deleteTemplate: mocks.deleteTemplate,
    resolveInheritanceChain: mocks.resolveInheritanceChain,
  });
  mocks.listTemplates.mockResolvedValue([]);
  mocks.getTemplate.mockResolvedValue(TEMPLATE);
  mocks.applyTemplate.mockResolvedValue({ workspaces: { web: { port: 3000 } } });
  mocks.resolveInheritanceChain.mockResolvedValue({
    templates: [TEMPLATE, { name: 'base', version: '1.0.0' }],
    variables: { port: { type: 'number', default: 3000 } },
    merged: { workspaces: {} },
  });
  mocks.exportWorkspaceAsTemplate.mockResolvedValue({ name: 'exp', version: '1.0.0' });
  mocks.loadWorkspaceDefinition.mockResolvedValue({ version: '2.0.0', name: 'proj' });
  mocks.createTemplate.mockResolvedValue(undefined);
  mocks.deleteTemplate.mockResolvedValue(undefined);
  mocks.createSpinner.mockReturnValue(fakeSpinner());
});

afterEach(() => {
  logSpy.mockRestore();
});

describe('workspace-template — list / default', () => {
  it('lists templates by default when no flag is given', async () => {
    mocks.listTemplates.mockResolvedValue([TEMPLATE]);
    await manageWorkspaceTemplate({});
    expect(mocks.listTemplates).toHaveBeenCalled();
    expect(out()).toContain('std v1.2.0');
  });

  it('reports when no templates exist', async () => {
    await manageWorkspaceTemplate({ list: true });
    expect(out()).toContain('No templates found');
  });

  it('renders template details including extends, variables and verbose fields', async () => {
    mocks.listTemplates.mockResolvedValue([TEMPLATE]);
    await manageWorkspaceTemplate({ list: true, verbose: true });
    const o = out();
    expect(o).toContain('Extends: base');
    expect(o).toContain('Variables: port');
    expect(o).toContain('Patterns: apps/*');
    expect(o).toContain('Scripts: dev');
  });

  it('emits the template list as JSON in json mode', async () => {
    mocks.listTemplates.mockResolvedValue([TEMPLATE]);
    await manageWorkspaceTemplate({ list: true, json: true });
    const json = loggedJson(s => s.trim().startsWith('['));
    expect(json[0].name).toBe('std');
  });
});

describe('workspace-template — create', () => {
  it('collects answers and persists a new template (no variables/patterns/scripts)', async () => {
    mocks.prompts
      .mockResolvedValueOnce({ name: 't', description: 'd', version: '1.0.0', extends: '', addVariables: false })
      .mockResolvedValueOnce({ addPatterns: false, patterns: undefined, addScripts: false });
    await manageWorkspaceTemplate({ create: true });
    expect(mocks.createTemplate).toHaveBeenCalledTimes(1);
    expect(mocks.createTemplate.mock.calls[0][0].name).toBe('t');
    // success is reported through the createSpinner instance, not console.log
    const results = mocks.createSpinner.mock.results;
    expect(results[results.length - 1].value.succeed).toHaveBeenCalled();
  });

  it('returns early when the create prompt is cancelled (no name)', async () => {
    mocks.prompts.mockResolvedValue({ name: '', addVariables: false });
    await manageWorkspaceTemplate({ create: true });
    expect(mocks.createTemplate).not.toHaveBeenCalled();
  });
});

describe('workspace-template — apply', () => {
  it('throws when no template name is provided', async () => {
    await expect(manageWorkspaceTemplate({ apply: true })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws when the requested template is not found', async () => {
    mocks.getTemplate.mockResolvedValue(null);
    await expect(manageWorkspaceTemplate({ apply: true, template: 'ghost' })).rejects.toThrow(
      /not found/
    );
  });

  it('applies a template and renders the result (human)', async () => {
    await manageWorkspaceTemplate({ apply: true, template: 'std' });
    expect(mocks.applyTemplate).toHaveBeenCalledTimes(1);
    expect(out()).toContain('Applied Template Result');
  });

  it('parses --variables JSON and forwards it in the context', async () => {
    await manageWorkspaceTemplate({ apply: true, template: 'std', variables: '{"PORT":4000}' });
    const ctx = mocks.applyTemplate.mock.calls[0][1];
    expect(ctx.variables.PORT).toBe(4000);
  });

  it('rejects malformed --variables JSON', async () => {
    await expect(
      manageWorkspaceTemplate({ apply: true, template: 'std', variables: '{not json' })
    ).rejects.toThrow(/Invalid variables JSON/);
  });

  it('prompts for missing required variables', async () => {
    mocks.getTemplate.mockResolvedValue({
      name: 'std',
      version: '1.0.0',
      variables: [{ name: 'apiKey', type: 'string', required: true }],
    });
    mocks.prompts.mockResolvedValue({ value: 'secret' });
    await manageWorkspaceTemplate({ apply: true, template: 'std' });
    expect(mocks.prompts).toHaveBeenCalled();
    expect(mocks.applyTemplate.mock.calls[0][1].variables.apiKey).toBe('secret');
  });

  it('emits the applied result as JSON in json mode', async () => {
    await manageWorkspaceTemplate({ apply: true, template: 'std', json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.workspaces).toBeDefined();
  });

  it('writes the applied result to --output', async () => {
    const out2 = path.join(tmp, 'applied.yaml');
    await manageWorkspaceTemplate({ apply: true, template: 'std', output: out2 });
    expect(fs.existsSync(out2)).toBe(true);
    expect(out()).toContain('Template applied and saved to');
  });
});

describe('workspace-template — show', () => {
  it('throws when no template name is provided', async () => {
    await expect(manageWorkspaceTemplate({ show: true })).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws when the template is not found', async () => {
    mocks.getTemplate.mockResolvedValue(null);
    await expect(manageWorkspaceTemplate({ show: true, template: 'ghost' })).rejects.toThrow(
      /not found/
    );
  });

  it('renders template details and the inheritance chain', async () => {
    await manageWorkspaceTemplate({ show: true, template: 'std' });
    const o = out();
    expect(o).toContain('Template: std');
    expect(o).toContain('Inheritance Chain');
    expect(o).toContain('base v1.0.0');
  });

  it('emits the template + inheritance as JSON in json mode', async () => {
    await manageWorkspaceTemplate({ show: true, template: 'std', json: true });
    const json = loggedJson(s => s.trim().startsWith('{'));
    expect(json.template.name).toBe('std');
    expect(json.inheritance).toContain('base');
  });
});

describe('workspace-template — delete', () => {
  it('throws when no template name is provided', async () => {
    await expect(manageWorkspaceTemplate({ delete: true })).rejects.toBeInstanceOf(ValidationError);
  });

  it('deletes the template and confirms via the spinner', async () => {
    const s = fakeSpinner();
    await manageWorkspaceTemplate({ delete: true, template: 'std', spinner: s });
    expect(mocks.deleteTemplate).toHaveBeenCalledWith('std');
    expect(s.succeed).toHaveBeenCalled();
  });
});

describe('workspace-template — export', () => {
  it('throws when no template name is provided', async () => {
    await expect(manageWorkspaceTemplate({ export: true })).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates a template from the workspace when no --output is given', async () => {
    await manageWorkspaceTemplate({ export: true, name: 'exp' });
    expect(mocks.loadWorkspaceDefinition).toHaveBeenCalled();
    expect(mocks.exportWorkspaceAsTemplate).toHaveBeenCalled();
    expect(mocks.createTemplate).toHaveBeenCalled();
    expect(out()).toContain("Template 'exp' created from workspace");
  });

  it('writes the exported template to --output', async () => {
    const out2 = path.join(tmp, 'exported.yaml');
    await manageWorkspaceTemplate({ export: true, name: 'exp', output: out2 });
    expect(fs.existsSync(out2)).toBe(true);
    expect(out()).toContain('Template exported to');
  });
});

describe('workspace-template — interactive', () => {
  it('returns early when the interactive action is cancelled', async () => {
    mocks.prompts.mockResolvedValue({ action: undefined });
    await manageWorkspaceTemplate({ interactive: true });
    expect(mocks.listTemplates).not.toHaveBeenCalled();
  });

  it('dispatches to list when the user picks list', async () => {
    mocks.listTemplates.mockResolvedValue([TEMPLATE]);
    mocks.prompts.mockResolvedValue({ action: 'list' });
    await manageWorkspaceTemplate({ interactive: true });
    expect(mocks.listTemplates).toHaveBeenCalled();
  });

  it('confirms and deletes when the user picks delete', async () => {
    mocks.prompts
      .mockResolvedValueOnce({ action: 'delete' })
      .mockResolvedValueOnce({ template: 'std' })
      .mockResolvedValueOnce({ confirm: true });
    await manageWorkspaceTemplate({ interactive: true });
    expect(mocks.deleteTemplate).toHaveBeenCalledWith('std');
  });
});

describe('workspace-template — error handling', () => {
  it('fails the spinner and rethrows when listTemplates rejects', async () => {
    mocks.listTemplates.mockRejectedValue(new Error('disk gone'));
    const s = fakeSpinner();
    await expect(manageWorkspaceTemplate({ list: true, spinner: s })).rejects.toThrow('disk gone');
    expect(s.fail).toHaveBeenCalled();
  });
});
