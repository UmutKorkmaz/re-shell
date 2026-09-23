import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';

// Covers three registration groups in src/groups/ whose actions run against
// real (already unit-tested) utils:
//   - quality.group.ts — universal test runner + IntelliSense/LSP surface
//   - templates.group.ts — backend template registry (list/show/matrix/apply/
//     recommend) with ok/fail JSON envelopes
//   - agents.group.ts — AGENTS.md + llms.txt init/sync/check over a real temp
//     workspace
// Only the heavy filesystem/util collaborators that are NOT already covered
// elsewhere are mocked (universal-test runner + intellisense generator +
// fs-extra writes for the editor configs).

vi.mock('../../src/utils/universal-test', () => ({
  runTests: vi.fn(),
  formatTestResult: vi.fn(() => 'formatted-test-result'),
  createTestRunner: vi.fn(),
  getSupportedTestFrameworks: vi.fn(() => [
    { name: 'jest', language: 'javascript', frameworks: ['jest'] },
    { name: 'vitest', language: 'javascript', frameworks: ['vitest'] },
    { name: 'pytest', language: 'python', frameworks: ['pytest'] },
  ]),
}));

vi.mock('../../src/utils/intellisense', () => {
  const generator = {
    detectLanguages: vi.fn(async () => ['typescript']),
    setupIntelliSense: vi.fn(async () => ({
      vimSettings: '-- nvim lsp stub',
      emacsSettings: ';; emacs lsp stub',
    })),
  };
  return {
    createIntelliSenseGenerator: vi.fn(async () => generator),
    getRecommendedExtensions: vi.fn(() => ['dbaeumer.vscode-eslint']),
    getAllLanguageServers: vi.fn(() => ({
      typescript: {
        language: 'TypeScript',
        fileExtensions: ['.ts', '.tsx'],
        serverName: 'typescript-language-server',
        requiresInstall: true,
        installCommand: 'npm i -g typescript-language-server',
      },
      python: {
        language: 'Python',
        fileExtensions: ['.py'],
        serverName: 'pyright',
        requiresInstall: false,
        installCommand: undefined,
      },
    })),
  };
});


const { registerQualityGroup } = await import('../../src/groups/quality.group');
const { registerTemplatesGroup } = await import('../../src/groups/templates.group');
const { registerAgentsGroup } = await import('../../src/groups/agents.group');

const { runTests, createTestRunner, formatTestResult } = await import('../../src/utils/universal-test');
const { createIntelliSenseGenerator } = await import('../../src/utils/intellisense');
const formatTestResultDefault = formatTestResult;

/** Build a program with the given groups registered, ready for parseAsync. */
function programWith(...register: Array<(program: Command) => void>): Command {
  const program = new Command();
  program.exitOverride();
  register.forEach(fn => fn(program));
  return program;
}

/** Find a subcommand by name (throws when missing, for shape asserts). */
function subcommand(parent: Command, name: string): Command {
  const found = parent.commands.find(command => command.name() === name);
  if (!found) {
    throw new Error(`subcommand "${name}" not found on ${parent.name()}`);
  }
  return found;
}

/** Option flags of a command for shape assertions. */
function optionFlags(command: Command): string[] {
  return command.options.map(option => option.flags);
}

describe('groups — quality / templates / agents registration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBackup: string | number | undefined;
  let cwdBackup: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempRoot: string;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    // ok()/fail() emit envelopes via process.stdout.write (and enableJsonMode
    // no-ops console.log), so JSON assertions must read from stdout.
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    exitCodeBackup = process.exitCode;
    process.exitCode = undefined;
    tempRoot = fsReal.mkdtempSync(path.join(os.tmpdir(), 'groups-qta-'));
    // vitest workers ban process.chdir — redirect process.cwd instead so the
    // groups' workspaceRoot()/path-argument defaults resolve into tempRoot.
    cwdBackup = process.cwd();
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    vi.mocked(runTests).mockReset();
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    fsReal.rmSync(tempRoot, { recursive: true, force: true });
    exitSpy.mockRestore();
    logSpy.mockRestore();
    stdoutSpy.mockRestore();
    process.exitCode = exitCodeBackup;
  });

  /** All console.log output joined for content assertions. */
  function output(): string {
    return logSpy.mock.calls.map(call => call.join(' ')).join('\n');
  }

  /** The last JSON envelope emitted on stdout (ok()/fail() path). */
  function jsonOutput(): any {
    const lines = stdoutSpy.mock.calls
      .map(call => String(call[0]))
      .filter(text => text.trim().startsWith('{'));
    if (lines.length === 0) {
      throw new Error('no JSON envelope emitted on stdout');
    }
    return JSON.parse(lines[lines.length - 1].trim());
  }

  describe('quality group', () => {
    it('registers the test + intellisense subgroups with aliases', () => {
      const program = programWith(registerQualityGroup);
      const quality = subcommand(program, 'quality');
      expect(quality.commands.map(command => command.name())).toEqual([
        'test', 'intellisense',
      ]);
      expect(subcommand(quality, 'test').aliases()).toContain('ut');
      expect(subcommand(quality, 'intellisense').aliases()).toContain('lsp');
    });

    it('test run lists its runner options and forwards parsed ones', async () => {
      const program = programWith(registerQualityGroup);
      const test = subcommand(subcommand(program, 'quality'), 'test');
      const runCmd = subcommand(test, 'run');
      expect(optionFlags(runCmd)).toEqual([
        '-p, --pattern <pattern>',
        '-c, --coverage',
        '-w, --watch',
        '-v, --verbose',
        '--parallel',
        '--max-workers <n>',
        '-u, --update-snapshot',
      ]);
      vi.mocked(runTests).mockResolvedValue({
        framework: 'vitest', command: 'vitest run', passed: 2, failed: 0,
        total: 2, duration: 10, success: true, output: '',
      } as never);
      await program.parseAsync([
        'node', 're-shell', 'quality', 'test', 'run', './src',
        '--pattern', '*.spec.ts', '--coverage', '--parallel',
        '--max-workers', '4', '--update-snapshot',
      ]);
      expect(runTests).toHaveBeenCalledWith('./src', {
        pattern: '*.spec.ts',
        coverage: true,
        watch: undefined,
        verbose: undefined,
        parallel: true,
        maxWorkers: 4,
        updateSnapshot: true,
      });
    });

    it('test run exits 1 when tests fail and prints the formatted result', async () => {
      const program = programWith(registerQualityGroup);
      vi.mocked(runTests).mockResolvedValue({
        framework: 'vitest', command: 'vitest run', passed: 1, failed: 2,
        total: 3, duration: 10, success: false, output: '',
      } as never);
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'run']);
      expect(runTests).toHaveBeenCalledWith(tempRoot, expect.anything());
      expect(output()).toContain('formatted-test-result');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('test run swallows no-framework errors with a hint', async () => {
      const program = programWith(registerQualityGroup);
      vi.mocked(runTests).mockRejectedValue(
        new Error('No test framework detected in this project')
      );
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'run']);
      expect(output()).toContain('No test framework detected');
      expect(output()).toContain('Supported frameworks');
      expect(process.exitCode).toBeUndefined();
    });

    it('test run exits 1 on non-framework errors after failing the spinner', async () => {
      const program = programWith(registerQualityGroup);
      vi.mocked(runTests).mockRejectedValue(new Error('disk exploded'));
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'run']);
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(output()).toContain('Test execution failed');
    });

    it('test list renders frameworks, file count, command', async () => {
      const program = programWith(registerQualityGroup);
      vi.mocked(createTestRunner).mockResolvedValue({
        listTestFiles: vi.fn(async () => ['a.test.ts', 'b.test.ts']),
        getTestInfo: vi.fn(async () => ({
          frameworks: ['vitest'], testFileCount: 2, testCommand: 'vitest run',
        })),
      } as never);
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'list']);
      expect(output()).toContain('Frameworks: vitest');
      expect(output()).toContain('Test files: 2');
      expect(output()).toContain('Command: vitest run');
      expect(output()).toContain('a.test.ts');
    });

    it('test frameworks groups supported frameworks by language', async () => {
      const program = programWith(registerQualityGroup);
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'frameworks']);
      expect(output()).toContain('Supported Test Frameworks');
      expect(output()).toContain('Javascript:');
      expect(output()).toContain('jest');
      expect(output()).toContain('Python:');
      expect(output()).toContain('pytest');
    });

    it('test frameworks emits JSON with --json', async () => {
      const program = programWith(registerQualityGroup);
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'frameworks', '--json']);
      const parsed = JSON.parse(output());
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toMatchObject({ name: 'jest', language: 'javascript' });
    });

    it('test info reports detected frameworks and the command', async () => {
      const program = programWith(registerQualityGroup);
      vi.mocked(createTestRunner).mockResolvedValue({
        getTestInfo: vi.fn(async () => ({
          frameworks: ['vitest'], testFileCount: 5, testCommand: 'vitest run',
        })),
      } as never);
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'info']);
      expect(output()).toContain('Detected Frameworks');
      expect(output()).toContain('vitest');
      expect(output()).toContain('Test Files Found: 5');
    });

    it('test info renders the no-framework fallback hint', async () => {
      const program = programWith(registerQualityGroup);
      vi.mocked(createTestRunner).mockResolvedValue({
        getTestInfo: vi.fn(async () => ({
          frameworks: [], testFileCount: 0, testCommand: '',
        })),
      } as never);
      await program.parseAsync(['node', 're-shell', 'quality', 'test', 'info']);
      expect(output()).toContain('No test framework detected');
    });

    it('intellisense setup --dry-run previews without writing', async () => {
      const program = programWith(registerQualityGroup);
      await program.parseAsync([
        'node', 're-shell', 'quality', 'intellisense', 'setup',
        '--dry-run', '-l', 'typescript', 'python',
      ]);
      const generator = await vi.mocked(createIntelliSenseGenerator).mock.results[0].value;
      expect(generator.setupIntelliSense).not.toHaveBeenCalled();
      expect(output()).toContain('Dry-run IntelliSense setup');
      expect(output()).toContain('typescript, python');
    });

    it('intellisense setup writes config and renders generated files', async () => {
      const program = programWith(registerQualityGroup);
      await program.parseAsync(['node', 're-shell', 'quality', 'intellisense', 'setup']);
      const generator = await vi.mocked(createIntelliSenseGenerator).mock.results[0].value;
      expect(generator.setupIntelliSense).toHaveBeenCalledWith(['typescript']);
      expect(output()).toContain('IntelliSense setup complete');
      expect(output()).toContain('.vscode/settings.json');
    });

    it('intellisense list-languages renders servers and honors --json', async () => {
      const program = programWith(registerQualityGroup);
      await program.parseAsync(['node', 're-shell', 'quality', 'intellisense', 'list-languages']);
      expect(output()).toContain('Supported Languages for IntelliSense');
      expect(output()).toContain('typescript-language-server');
      expect(output()).toContain('npm i -g typescript-language-server');

      logSpy.mockClear();
      await program.parseAsync([
        'node', 're-shell', 'quality', 'intellisense', 'list-languages', '--json',
      ]);
      const parsed = JSON.parse(output());
      expect(Object.keys(parsed)).toEqual(['typescript', 'python']);
    });

    it('intellisense extensions renders recommendations and warns on unknown', async () => {
      const program = programWith(registerQualityGroup);
      await program.parseAsync([
        'node', 're-shell', 'quality', 'intellisense', 'extensions', 'typescript',
      ]);
      expect(output()).toContain('Recommended Extensions for TypeScript');
      expect(output()).toContain('dbaeumer.vscode-eslint');
      expect(output()).toContain('Language Server: typescript-language-server');

      logSpy.mockClear();
      await program.parseAsync([
        'node', 're-shell', 'quality', 'intellisense', 'extensions', 'cobol',
      ]);
      expect(output()).toContain('Language not found: cobol');
    });

    it('intellisense vim-config + emacs-config write editor configs', async () => {
      const program = programWith(registerQualityGroup);
      const vimPath = path.join(tempRoot, 'nvim.lsp.lua');
      await program.parseAsync([
        'node', 're-shell', 'quality', 'intellisense', 'vim-config', '-o', vimPath,
      ]);
      expect(fsReal.readFileSync(vimPath, 'utf8')).toContain('nvim lsp stub');
      expect(output()).toContain('Neovim config generated');

      logSpy.mockClear();
      const emacsPath = path.join(tempRoot, 'lsp-config.el');
      await program.parseAsync([
        'node', 're-shell', 'quality', 'intellisense', 'emacs-config', '-o', emacsPath,
      ]);
      expect(fsReal.readFileSync(emacsPath, 'utf8')).toContain('emacs lsp stub');
      expect(output()).toContain('Emacs config generated');
    });
  });

  describe('templates group', () => {
    it('registers list/show/matrix/apply/recommend', () => {
      const program = programWith(registerTemplatesGroup);
      const templates = subcommand(program, 'templates');
      expect(templates.commands.map(command => command.name())).toEqual([
        'list', 'show', 'matrix', 'apply', 'recommend',
      ]);
    });

    it('list renders the real template registry', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync(['node', 're-shell', 'templates', 'list']);
      expect(output()).toContain('Templates (');
      expect(output()).toContain('express');
    });

    it('list filters by language and framework', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync([
        'node', 're-shell', 'templates', 'list', '--language', 'python',
      ]);
      expect(output()).toContain('[python]');
      expect(output()).not.toContain('[typescript]');
    });

    it('list --json emits the summary array', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync(['node', 're-shell', 'templates', 'list', '--json']);
      const parsed = jsonOutput().data;
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(5);
      expect(parsed[0]).toMatchObject({ id: expect.any(String), language: expect.any(String) });
    });

    it('show renders template details for a known id', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync(['node', 're-shell', 'templates', 'show', 'express']);
      expect(output()).toContain('Template: express');
      expect(output()).toContain('Language:');
      expect(output()).toContain('Framework:');
    });

    it('show --json emits the template summary', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync([
        'node', 're-shell', 'templates', 'show', 'express', '--json',
      ]);
      expect(jsonOutput().data).toMatchObject({ id: 'express' });
    });

    it('show fails with exit code 1 for an unknown template (human + json)', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync(['node', 're-shell', 'templates', 'show', 'nope']);
      expect(output()).toContain('Template not found: nope');
      expect(process.exitCode).toBe(1);

      process.exitCode = undefined;
      logSpy.mockClear();
      await program.parseAsync(['node', 're-shell', 'templates', 'show', 'nope', '--json']);
      expect(jsonOutput().error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('matrix renders facets + rows and honors --json', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync(['node', 're-shell', 'templates', 'matrix']);
      expect(output()).toContain('Template compatibility matrix');
      expect(output()).toContain('Languages:');
      expect(output()).toContain('Databases:');

      logSpy.mockClear();
      await program.parseAsync(['node', 're-shell', 'templates', 'matrix', '--json']);
      const parsed = jsonOutput().data;
      expect(parsed.matrix.length).toBeGreaterThan(5);
      expect(parsed.facets.languages.length).toBeGreaterThan(1);
    });

    it('apply previews the dry-run file list without writing', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync([
        'node', 're-shell', 'templates', 'apply', 'express', '--name', 'orders-api',
      ]);
      expect(output()).toContain('Dry run: express');
      expect(output()).toContain('orders-api');
      expect(output()).toContain('Nothing written');
      expect(output()).toMatch(/\+\s+src\//);
    });

    it('apply --json emits the file manifest', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync([
        'node', 're-shell', 'templates', 'apply', 'express', '--json',
      ]);
      const parsed = jsonOutput().data;
      expect(parsed).toMatchObject({ templateId: 'express', dryRun: true });
      expect(parsed.files.length).toBeGreaterThan(3);
      expect(typeof parsed.totalBytes).toBe('number');
    });

    it('apply reports unknown templates as an error', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync(['node', 're-shell', 'templates', 'apply', 'nope']);
      expect(output()).toContain('Template not found');
      expect(process.exitCode).toBe(1);
    });

    it('recommend ranks real templates for a query', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync(['node', 're-shell', 'templates', 'recommend', 'python api']);
      expect(output()).toContain('Recommendations for "python api"');
      expect(output()).toContain('re-shell create <name> --template');
    });

    it('recommend --limit clamps invalid input to the default 5', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync([
        'node', 're-shell', 'templates', 'recommend', 'api',
        '--limit', 'abc', '--json',
      ]);
      const parsed = jsonOutput().data;
      expect(parsed.limit).toBe(5);
      expect(parsed.results.length).toBeLessThanOrEqual(5);
    });

    it('recommend surfaces a no-match notice', async () => {
      const program = programWith(registerTemplatesGroup);
      await program.parseAsync([
        'node', 're-shell', 'templates', 'recommend', 'qqqqzzzzxxxx',
      ]);
      expect(output()).toContain('No templates match');
    });
  });

  describe('agents group', () => {
    /** Minimal real monorepo fixture the discovery module can parse. */
    function stageWorkspace(): void {
      fsReal.mkdirSync(path.join(tempRoot, 'apps', 'web'), { recursive: true });
      fsReal.mkdirSync(path.join(tempRoot, 'packages', 'ui-kit'), { recursive: true });
      fsReal.writeFileSync(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({
          name: 'fixture-root',
          private: true,
          workspaces: ['apps/*', 'packages/*'],
        })
      );
      fsReal.writeFileSync(
        path.join(tempRoot, 'apps', 'web', 'package.json'),
        JSON.stringify({ name: '@fixture/web', version: '1.0.0' })
      );
      fsReal.writeFileSync(
        path.join(tempRoot, 'packages', 'ui-kit', 'package.json'),
        JSON.stringify({ name: '@fixture/ui-kit', version: '1.0.0' })
      );
    }

    it('registers init/sync/check with --json', () => {
      const program = programWith(registerAgentsGroup);
      const agents = subcommand(program, 'agents');
      expect(agents.commands.map(command => command.name())).toEqual([
        'init', 'sync', 'check',
      ]);
      for (const cmd of agents.commands) {
        expect(optionFlags(cmd)).toEqual(['--json']);
      }
    });

    it('init writes the root + per-package docs to disk', async () => {
      stageWorkspace();
      const program = programWith(registerAgentsGroup);
      await program.parseAsync(['node', 're-shell', 'agents', 'init']);
      expect(output()).toContain('agents init: wrote');
      expect(fsReal.existsSync(path.join(tempRoot, 'AGENTS.md'))).toBe(true);
      expect(fsReal.existsSync(path.join(tempRoot, 'llms.txt'))).toBe(true);
      expect(fsReal.existsSync(path.join(tempRoot, 'apps', 'web', 'AGENTS.md'))).toBe(true);
      expect(fsReal.existsSync(path.join(tempRoot, 'packages', 'ui-kit', 'AGENTS.md'))).toBe(true);
    });

    it('init --json emits the written manifest envelope', async () => {
      stageWorkspace();
      const program = programWith(registerAgentsGroup);
      await program.parseAsync(['node', 're-shell', 'agents', 'init', '--json']);
      const parsed = jsonOutput().data;
      expect(parsed.written).toBe(true);
      expect(parsed.files.length).toBeGreaterThan(2);
      expect(parsed.files[0]).toMatchObject({ path: expect.any(String), kind: expect.any(String) });
    });

    it('sync is idempotent — re-running yields identical bytes', async () => {
      stageWorkspace();
      const program = programWith(registerAgentsGroup);
      await program.parseAsync(['node', 're-shell', 'agents', 'sync']);
      const first = fsReal.readFileSync(path.join(tempRoot, 'AGENTS.md'), 'utf8');
      await program.parseAsync(['node', 're-shell', 'agents', 'sync']);
      const second = fsReal.readFileSync(path.join(tempRoot, 'AGENTS.md'), 'utf8');
      expect(second).toBe(first);
      expect(output()).toContain('agents sync: wrote');
    });

    it('check passes when docs are fresh', async () => {
      stageWorkspace();
      const program = programWith(registerAgentsGroup);
      await program.parseAsync(['node', 're-shell', 'agents', 'init']);
      logSpy.mockClear();
      await program.parseAsync(['node', 're-shell', 'agents', 'check']);
      expect(output()).toContain('AGENTS docs in sync');
      expect(process.exitCode).toBeUndefined();
    });

    it('check detects missing + stale docs and exits 1', async () => {
      stageWorkspace();
      const program = programWith(registerAgentsGroup);
      await program.parseAsync(['node', 're-shell', 'agents', 'check']);
      expect(output()).toContain('AGENTS docs out of date');
      expect(output()).toContain('missing');
      expect(process.exitCode).toBe(1);

      // Stale: write fresh docs, then mutate one byte.
      process.exitCode = undefined;
      logSpy.mockClear();
      await program.parseAsync(['node', 're-shell', 'agents', 'init']);
      fsReal.appendFileSync(path.join(tempRoot, 'AGENTS.md'), '\n<!-- drift -->');
      await program.parseAsync(['node', 're-shell', 'agents', 'check']);
      expect(output()).toContain('stale');
      expect(process.exitCode).toBe(1);
    });

    it('check --json emits a drift envelope with per-file reasons', async () => {
      stageWorkspace();
      const program = programWith(registerAgentsGroup);
      await program.parseAsync(['node', 're-shell', 'agents', 'check', '--json']);
      const parsed = jsonOutput();
      expect(parsed.error.code).toBe('AGENTS_ERROR');
      expect(parsed.error.details.drift).toBe(true);
      expect(parsed.error.details.files.length).toBeGreaterThan(0);
      expect(parsed.error.details.files[0].reason).toBe('missing');
    });
  });
});
