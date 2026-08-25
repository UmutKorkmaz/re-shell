import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generatePluginDocumentation,
  showCommandHelp,
  listDocumentedCommands,
  searchDocumentation,
  showDocumentationStats,
  configureHelpSystem,
  showDocumentationTemplates,
} from '../../src/commands/plugin-docs';
import { ValidationError } from '../../src/utils/error-handler';
import {
  DocumentationFormat,
  HelpDisplayMode,
} from '../../src/utils/plugin-command-docs';
import type { RegisteredCommand } from '../../src/utils/plugin-command-registry';

// Covers src/commands/plugin-docs.ts — the plugin documentation & help surface
// (generate / help / list / search / stats / configure / templates). The
// command registry is mocked to serve scripted RegisteredCommand fixtures;
// the REAL documentation generator (plugin-command-docs) runs against them,
// so generate/help/search/stats exercise genuine rendering logic.

const mocks = vi.hoisted(() => ({
  commandRegistry: {
    initialize: vi.fn(async () => undefined),
    getCommands: vi.fn() as unknown as { (): RegisteredCommand[] },
  },
}));

vi.mock('../../src/utils/plugin-command-registry', () => ({
  createPluginCommandRegistry: vi.fn(() => mocks.commandRegistry),
  RegisteredCommand: {},
}));
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let tempRoot: string;

function makeCommand(overrides: Partial<RegisteredCommand> = {}): RegisteredCommand {
  return {
    id: 'demo-plugin:build',
    pluginName: 'demo-plugin',
    definition: {
      name: 'build',
      description: 'Builds the demo workspace artifacts',
      aliases: ['b'],
      category: 'build',
      priority: 5,
      examples: ['re-shell plugin build --watch'],
      handler: () => undefined,
    },
    isActive: true,
    usageCount: 3,
    registeredAt: Date.now(),
    lastUsed: Date.now(),
    conflicts: [],
    ...overrides,
  } as RegisteredCommand;
}

function output(): string {
  return logSpy.mock.calls.map(c => String(c[0])).join('\n');
}

describe('plugin-docs — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-pdocs-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.commandRegistry.getCommands.mockReturnValue([
      makeCommand(),
      makeCommand({
        id: 'demo-plugin:test',
        definition: { ...makeCommand().definition, name: 'test', description: 'Runs tests', aliases: ['t'] },
      }),
      makeCommand({
        id: 'other:deploy',
        pluginName: 'other',
        definition: { ...makeCommand().definition, name: 'deploy', description: 'Deploys', category: 'deploy' },
      }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.removeSync(tempRoot);
  });

  describe('generatePluginDocumentation', () => {
    it('generates documentation and renders a preview without --output', async () => {
      await generatePluginDocumentation();
      const out = output();
      expect(out).toContain('Generated documentation for 3 command(s)');
      expect(out).toContain('Sample Documentation');
    });

    it('renders verbose details', async () => {
      await generatePluginDocumentation([], { verbose: true });
      const out = output();
      expect(out).toContain('Documentation Details');
      expect(out).toContain('Format: markdown');
      expect(out).toContain('Template: markdown');
    });

    it('saves markdown files into --output', async () => {
      const outDir = path.join(tempRoot, 'docs-out');
      // The generator writes index.json into outputDir before the command's
      // ensureDir runs, so the directory must already exist.
      await fs.ensureDir(outDir);
      await generatePluginDocumentation([], { output: outDir });
      expect(await fs.pathExists(path.join(outDir, 'build.md'))).toBe(true);
      expect(await fs.pathExists(path.join(outDir, 'deploy.md'))).toBe(true);
      const out = output();
      expect(out).toContain(`Documentation saved to: ${outDir}`);
    });

    it('writes .json files for the JSON format', async () => {
      const outDir = path.join(tempRoot, 'docs-json');
      await fs.ensureDir(outDir);
      await generatePluginDocumentation([], {
        output: outDir,
        format: DocumentationFormat.JSON,
      });
      expect(await fs.pathExists(path.join(outDir, 'build.json'))).toBe(true);
    });

    it('emits the docs array as JSON', async () => {
      await generatePluginDocumentation([], { json: true });
      const payload = JSON.parse(output());
      expect(payload).toHaveLength(3);
    });

    it('documents only the named commands when given', async () => {
      await generatePluginDocumentation(['build'], { json: true });
      expect(JSON.parse(output())).toHaveLength(1);
    });

    it('wraps generator failures in ValidationError', async () => {
      mocks.commandRegistry.getCommands.mockImplementation(() => {
        throw new Error('registry down');
      });
      await expect(generatePluginDocumentation()).rejects.toThrow(ValidationError);
    });
  });

  describe('showCommandHelp', () => {
    it('renders help text for a known command', async () => {
      await showCommandHelp('build');
      const out = output();
      expect(out).toContain('build');
      expect(out).toContain('Builds the demo workspace artifacts');
    });

    it('resolves aliases to the owning command', async () => {
      await showCommandHelp('b');
      const out = output();
      expect(out).toContain('Builds the demo workspace artifacts');
    });

    it('emits structured help data as JSON', async () => {
      await showCommandHelp('build', { json: true });
      const payload = JSON.parse(output());
      expect(payload.command).toBe('build');
      expect(payload.plugin).toBe('demo-plugin');
      expect(payload.aliases).toEqual(['b']);
    });

    it('throws for unknown commands', async () => {
      await expect(showCommandHelp('ghost')).rejects.toThrow(
        "Command 'ghost' not found"
      );
    });
  });

  describe('listDocumentedCommands', () => {
    it('lists commands grouped by plugin with totals', async () => {
      await listDocumentedCommands();
      const out = output();
      expect(out).toContain('Available Documented Commands');
      expect(out).toContain('demo-plugin (2 commands):');
      expect(out).toContain('other (1 commands):');
      expect(out).toContain('Total: 3 command(s)');
    });

    it('renders alias, deprecated and hidden badges', async () => {
      mocks.commandRegistry.getCommands.mockReturnValue([
        makeCommand({
          definition: {
            ...makeCommand().definition,
            deprecated: true,
            hidden: true,
          },
        }),
      ]);
      await listDocumentedCommands();
      const out = output();
      expect(out).toContain('(b)');
      expect(out).toContain('[DEPRECATED]');
      expect(out).toContain('[HIDDEN]');
    });

    it('prints verbose metadata', async () => {
      await listDocumentedCommands({ verbose: true });
      const out = output();
      expect(out).toContain('Category: build');
      expect(out).toContain('Usage: 3');
    });

    it('filters by plugin and category', async () => {
      await listDocumentedCommands({ plugin: 'other' });
      expect(output()).toContain('other (1 commands):');
      expect(output()).not.toContain('demo-plugin (2 commands):');

      logSpy.mockClear();
      await listDocumentedCommands({ category: 'deploy' });
      expect(output()).toContain('other (1 commands):');
    });

    it('reports the empty state', async () => {
      mocks.commandRegistry.getCommands.mockReturnValue([]);
      await listDocumentedCommands();
      expect(output()).toContain('No commands found matching criteria.');
    });

    it('emits JSON', async () => {
      await listDocumentedCommands({ json: true });
      const payload = JSON.parse(output());
      expect(payload).toHaveLength(3);
      expect(payload[0].name).toBe('build');
    });
  });

  describe('searchDocumentation', () => {
    it('finds commands by description text', async () => {
      const results = await searchDocumentation('builds');
      expect(output()).toContain('Search Results for "builds"');
      expect(output()).toContain('Found 1 result(s)');
      expect(results).toBeUndefined();
    });

    it('prints verbose tags and modification dates', async () => {
      await searchDocumentation('builds', { verbose: true });
      const out = output();
      expect(out).toContain('Tags:');
      expect(out).toContain('Last modified:');
    });

    it('suggests similar commands when nothing matches', async () => {
      // Search scores require a searchTerm to CONTAIN the query; 'buildzzz'
      // matches no indexed term, but the suggestion pass checks the reverse
      // containment (query includes name) and proposes 'build'.
      await searchDocumentation('buildzzz');
      const out = output();
      expect(out).toContain('No matching documentation found.');
      expect(out).toContain('Did you mean:');
      expect(out).toContain('build');
    });

    it('emits raw results as JSON', async () => {
      await searchDocumentation('builds', { json: true });
      const payload = JSON.parse(output());
      expect(payload.length).toBeGreaterThan(0);
      expect(payload[0].command).toBe('build');
    });

    it('wraps failures in ValidationError', async () => {
      mocks.commandRegistry.getCommands.mockImplementation(() => {
        throw new Error('search boom');
      });
      await expect(searchDocumentation('x')).rejects.toThrow(
        'Failed to search documentation: search boom'
      );
    });
  });

  describe('showDocumentationStats', () => {
    it('renders overview, format and plugin distributions', async () => {
      await showDocumentationStats();
      const out = output();
      expect(out).toContain('Documentation Statistics');
      expect(out).toContain('Total commands: 3');
      expect(out).toContain('Documented commands:');
      expect(out).toContain('Coverage:');
      expect(out).toContain('Format Distribution:');
      expect(out).toContain('Plugin Distribution:');
      expect(out).toContain('demo-plugin: 2');
      expect(out).toContain('other: 1');
    });

    it('emits stats as JSON', async () => {
      await showDocumentationStats({ json: true });
      const payload = JSON.parse(output());
      expect(payload.totalCommands).toBe(3);
    });
  });

  describe('configureHelpSystem', () => {
    it('applies a numeric setting with range validation', async () => {
      await configureHelpSystem('maxWidth', '120');
      expect(output()).toContain('Updated help configuration: maxWidth = 120');
    });

    it('rejects out-of-range widths', async () => {
      await expect(configureHelpSystem('maxWidth', '10')).rejects.toThrow(
        'maxWidth must be a number between 40 and 200'
      );
    });

    it('parses boolean settings', async () => {
      await configureHelpSystem('enableSearch', 'true');
      expect(output()).toContain('Updated help configuration: enableSearch = true');
      logSpy.mockClear();
      await configureHelpSystem('enableSearch', 'false');
      expect(output()).toContain('enableSearch = false');
    });

    it('validates display modes against the enum', async () => {
      await configureHelpSystem('displayMode', HelpDisplayMode.DETAILED);
      expect(output()).toContain(
        `Updated help configuration: displayMode = ${HelpDisplayMode.DETAILED}`
      );
      await expect(configureHelpSystem('displayMode', 'bogus')).rejects.toThrow(
        'Invalid display mode'
      );
    });

    it('rejects unknown settings', async () => {
      await expect(configureHelpSystem('nope', '1')).rejects.toThrow(
        "Invalid setting 'nope'"
      );
    });

    it('prints the current configuration in verbose mode', async () => {
      await configureHelpSystem('maxWidth', '100', { verbose: true });
      const out = output();
      expect(out).toContain('Current Configuration:');
      expect(out).toContain('maxWidth: 100');
    });
  });

  describe('showDocumentationTemplates', () => {
    it('renders the template catalogue with totals', async () => {
      await showDocumentationTemplates();
      const out = output();
      expect(out).toContain('Available Documentation Templates');
      expect(out).toMatch(/Total: \d+ template\(s\)/);
    });

    it('renders verbose section listings', async () => {
      await showDocumentationTemplates({ verbose: true });
      expect(output()).toContain('Section types:');
    });

    it('emits templates as JSON', async () => {
      await showDocumentationTemplates({ json: true });
      const payload = JSON.parse(output());
      expect(Array.isArray(payload)).toBe(true);
      expect(payload.length).toBeGreaterThan(0);
    });
  });
});
