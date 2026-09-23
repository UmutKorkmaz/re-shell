import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  generateCode,
  generateTests,
  generateDocumentation,
} from '../../src/commands/generate';
import { findMonorepoRoot } from '../../src/utils/monorepo';

// Covers src/commands/generate.ts (1404 lines) — the `generate` command
// group: generateCode (component/hook/service/test/config/documentation/
// backend generators), generateTests (jest suite bootstrap) and
// generateDocumentation (project README + typedoc config). All file writes
// run for real inside a staged temp monorepo; only findMonorepoRoot is
// spied so the cwd scan resolves to the temp root.

vi.mock('../../src/utils/monorepo', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../src/utils/monorepo')>();
  return {
    ...original,
    findMonorepoRoot: vi.fn(original.findMonorepoRoot),
  };
});

const monorepoMock = vi.mocked(findMonorepoRoot);

let tempRoot: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

function errOutput(): string {
  return errSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

function stageMonorepo(): void {
  fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
    name: 'gen-mono',
    private: true,
    description: 'staged for generate tests',
    workspaces: ['apps/*', 'packages/*'],
  });
  // The component/hook/service "best workspace" candidates resolve to apps/web.
  fs.ensureDirSync(path.join(tempRoot, 'apps', 'web', 'src'));
}

describe('generate — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-generate-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Throw from process.exit so the (mocked) no-op path cannot run on with
    // a null workspace — matches real runtime semantics where exit(1) halts.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    monorepoMock.mockImplementation(async () => tempRoot);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.remove(tempRoot);
  });

  describe('monorepo guard', () => {
    it('rejects code generation outside a monorepo', async () => {
      monorepoMock.mockResolvedValueOnce(null);
      await expect(generateCode('Button', {})).rejects.toThrow(
        'Not in a Re-Shell monorepo'
      );
    });

    it('rejects test generation outside a monorepo', async () => {
      monorepoMock.mockResolvedValueOnce(null);
      await expect(generateTests('apps/web', {})).rejects.toThrow(
        'Not in a Re-Shell monorepo'
      );
    });

    it('rejects documentation generation outside a monorepo', async () => {
      monorepoMock.mockResolvedValueOnce(null);
      await expect(generateDocumentation({})).rejects.toThrow(
        'Not in a Re-Shell monorepo'
      );
    });
  });

  describe('generateCode — component', () => {
    it('scaffolds a react component with test, css and index', async () => {
      stageMonorepo();
      await generateCode('Button', { type: 'component', framework: 'react' });

      const dir = path.join(tempRoot, 'apps', 'web', 'src', 'components', 'Button');
      expect(fs.existsSync(path.join(dir, 'Button.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'Button.css'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'Button.test.tsx'))).toBe(true);
      expect(fs.existsSync(path.join(dir, 'index.ts'))).toBe(true);
      expect(output()).toContain('Type: component');
      expect(output()).toContain('Button');
    });

    it('lists created files in verbose mode', async () => {
      stageMonorepo();
      await generateCode('Card', {
        type: 'component',
        framework: 'react',
        verbose: true,
      });

      expect(output()).toContain('Created src/components/Card/Card.tsx');
    });

    it('scaffolds a vue component', async () => {
      stageMonorepo();
      await generateCode('Widget', { type: 'component', framework: 'vue' });

      expect(
        fs.existsSync(
          path.join(tempRoot, 'apps', 'web', 'src', 'components', 'Widget.vue')
        )
      ).toBe(true);
    });

    it('appends to src/index.ts with --export', async () => {
      stageMonorepo();
      const idx = path.join(tempRoot, 'apps', 'web', 'src', 'index.ts');
      fs.writeFileSync(idx, "export const existing = 1;\n");

      await generateCode('Badge', {
        type: 'component',
        framework: 'react',
        export: true,
      });

      const content = fs.readFileSync(idx, 'utf8');
      expect(content).toContain('export const existing = 1');
      expect(content).toContain("export { Badge } from './components/Badge'");
    });

    it('creates src/index.ts when absent with --export', async () => {
      stageMonorepo();
      await generateCode('Chip', {
        type: 'component',
        framework: 'react',
        export: true,
      });

      const idx = path.join(tempRoot, 'apps', 'web', 'src', 'index.ts');
      expect(fs.readFileSync(idx, 'utf8')).toContain(
        "export { Chip } from './components/Chip'"
      );
    });

    it('does not duplicate the export line on repeated runs', async () => {
      stageMonorepo();
      const opts = { type: 'component' as const, framework: 'react' as const, export: true };
      await generateCode('Tag', opts);
      await generateCode('Tag', opts);

      const content = fs.readFileSync(
        path.join(tempRoot, 'apps', 'web', 'src', 'index.ts'),
        'utf8'
      );
      expect(content.match(/export \{ Tag \}/g)?.length).toBe(1);
    });

    it('writes into an explicit --workspace target', async () => {
      stageMonorepo();
      fs.ensureDirSync(path.join(tempRoot, 'packages', 'ui', 'src'));

      await generateCode('Icon', {
        type: 'component',
        framework: 'react',
        workspace: 'packages/ui',
      });

      expect(
        fs.existsSync(
          path.join(tempRoot, 'packages', 'ui', 'src', 'components', 'Icon', 'Icon.tsx')
        )
      ).toBe(true);
    });

    it('throws for a missing explicit workspace', async () => {
      stageMonorepo();
      await expect(
        generateCode('Ghost', {
          type: 'component',
          framework: 'react',
          workspace: 'apps/missing',
        })
      ).rejects.toThrow('Workspace not found');
    });

    it('exits with a hint when no workspace can be located', async () => {
      // monorepo exists but has no apps/ or packages/ dirs
      fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
        name: 'empty-mono',
        private: true,
        workspaces: ['apps/*'],
      });

      await expect(generateCode('Orphan', { type: 'component' })).rejects.toThrow(
        'process.exit called'
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errOutput()).toContain('No workspace found');
    });
  });

  describe('generateCode — hook', () => {
    it('scaffolds a hook with use-prefix normalization and a test', async () => {
      stageMonorepo();
      await generateCode('counter', { type: 'hook', framework: 'react' });

      const hooksDir = path.join(tempRoot, 'apps', 'web', 'src', 'hooks');
      expect(fs.existsSync(path.join(hooksDir, 'useCounter.ts'))).toBe(true);
      expect(fs.existsSync(path.join(hooksDir, 'useCounter.test.ts'))).toBe(true);
      const content = fs.readFileSync(path.join(hooksDir, 'useCounter.ts'), 'utf8');
      expect(content).toContain('export function useCounter(');
    });

    it('keeps an already-prefixed name as-is', async () => {
      stageMonorepo();
      await generateCode('useFetcher', { type: 'hook', framework: 'react' });

      expect(
        fs.existsSync(
          path.join(tempRoot, 'apps', 'web', 'src', 'hooks', 'useFetcher.ts')
        )
      ).toBe(true);
    });

    it('rejects hooks for non-react frameworks', async () => {
      stageMonorepo();
      await expect(
        generateCode('thing', { type: 'hook', framework: 'vue' })
      ).rejects.toThrow('only supported for React');
    });
  });

  describe('generateCode — service', () => {
    it('scaffolds a fetch-based service class with tests', async () => {
      stageMonorepo();
      await generateCode('user', { type: 'service' });

      const svcDir = path.join(tempRoot, 'apps', 'web', 'src', 'services');
      const content = fs.readFileSync(path.join(svcDir, 'UserService.ts'), 'utf8');
      expect(content).toContain('export class UserService');
      expect(content).toContain('export const userService');
      expect(
        fs.existsSync(path.join(svcDir, 'UserService.test.ts'))
      ).toBe(true);
    });
  });

  describe('generateCode — test file', () => {
    it('scaffolds a skeleton suite under src/__tests__', async () => {
      stageMonorepo();
      await generateCode('parser', { type: 'test' });

      const file = path.join(
        tempRoot, 'apps', 'web', 'src', '__tests__', 'parser.test.ts'
      );
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, 'utf8')).toContain("describe('parser'");
    });
  });

  describe('generateCode — config', () => {
    it('writes a typed config module under config/', async () => {
      fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
        name: 'cfg-mono', private: true, workspaces: ['apps/*'],
      });

      await generateCode('app', { type: 'config', verbose: true });

      const file = path.join(tempRoot, 'config', 'app.config.ts');
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, 'utf8')).toContain('export interface AppConfig');
      expect(output()).toContain('Created config/app.config.ts');
    });
  });

  describe('generateCode — docs page', () => {
    it('writes a markdown template under docs/', async () => {
      fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
        name: 'docs-mono', private: true, workspaces: ['apps/*'],
      });

      await generateCode('guide', { type: 'documentation', verbose: true });

      const file = path.join(tempRoot, 'docs', 'guide.md');
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, 'utf8')).toContain('# Guide');
    });
  });

  describe('generateCode — backend', () => {
    it('scaffolds a python service with requirements', async () => {
      fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
        name: 'be-mono', private: true, workspaces: ['apps/*'],
      });

      await generateCode('payments', {
        type: 'backend',
        language: 'python',
        framework: 'fastapi',
      });

      const svc = path.join(tempRoot, 'services', 'payments');
      expect(fs.existsSync(svc)).toBe(true);
      // main.py + requirements.txt are the python scaffold anchors
      const files = fs.readdirSync(svc);
      expect(files.length).toBeGreaterThan(0);
    });

    it('scaffolds a typescript express service', async () => {
      fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
        name: 'be2-mono', private: true, workspaces: ['apps/*'],
      });

      await generateCode('orders', {
        type: 'backend',
        language: 'typescript',
        framework: 'express',
      });

      const svc = path.join(tempRoot, 'services', 'orders');
      expect(fs.existsSync(path.join(svc, 'package.json'))).toBe(true);
      const pkg = fs.readJsonSync(path.join(svc, 'package.json'));
      expect(JSON.stringify(pkg)).toContain('express');
    });

    it('expands laravel templates from the backend template catalog', async () => {
      fs.writeJsonSync(path.join(tempRoot, 'package.json'), {
        name: 'php-mono', private: true, workspaces: ['apps/*'],
      });

      await generateCode('crm', {
        type: 'backend',
        language: 'php',
        framework: 'laravel',
        port: '9000',
      });

      const svc = path.join(tempRoot, 'services', 'crm');
      expect(fs.existsSync(svc)).toBe(true);
      const written = fs.readdirSync(svc);
      expect(written.length).toBeGreaterThan(0);
    });
  });

  describe('unknown generator', () => {
    it('fails the spinner and rethrows for an unknown type', async () => {
      stageMonorepo();
      const spinner = {
        text: '', succeed: vi.fn(), fail: vi.fn(), stop: vi.fn(), start: vi.fn(),
      };
      await expect(
        generateCode('X', { type: 'nope' as never, spinner })
      ).rejects.toThrow('Unknown generator type');
      expect(spinner.fail).toHaveBeenCalled();
    });
  });

  describe('spinner lifecycle', () => {
    it('drives text and succeed through a provided spinner', async () => {
      stageMonorepo();
      const spinner = {
        text: '', succeed: vi.fn(), fail: vi.fn(), stop: vi.fn(), start: vi.fn(),
      };
      await generateCode('Spinner', { type: 'component', spinner });

      expect(spinner.text).toContain('Generating component');
      expect(spinner.succeed).toHaveBeenCalled();
      expect(spinner.fail).not.toHaveBeenCalled();
    });

    it('fails the spinner when generation throws', async () => {
      stageMonorepo();
      const spinner = {
        text: '', succeed: vi.fn(), fail: vi.fn(), stop: vi.fn(), start: vi.fn(),
      };
      await expect(
        generateCode('Boom', {
          type: 'component',
          workspace: 'apps/nope',
          spinner,
        })
      ).rejects.toThrow('Workspace not found');
      expect(spinner.fail).toHaveBeenCalled();
    });
  });

  describe('generateTests', () => {
    it('bootstraps jest config, setup and test-utils for a workspace', async () => {
      stageMonorepo();
      await generateTests('apps/web', { verbose: true });

      const ws = path.join(tempRoot, 'apps', 'web');
      expect(fs.existsSync(path.join(ws, 'jest.config.js'))).toBe(true);
      expect(fs.existsSync(path.join(ws, 'src', 'setupTests.ts'))).toBe(true);
      expect(fs.existsSync(path.join(ws, 'src', 'test-utils', 'index.ts'))).toBe(true);
      const jestCfg = fs.readFileSync(path.join(ws, 'jest.config.js'), 'utf8');
      expect(jestCfg).toContain('ts-jest');
      expect(jestCfg).toContain('coverageThreshold');
    });

    it('rejects an unknown workspace', async () => {
      stageMonorepo();
      await expect(generateTests('apps/ghost', {})).rejects.toThrow(
        'Workspace not found: apps/ghost'
      );
    });

    it('fails the spinner when the workspace is missing', async () => {
      stageMonorepo();
      const spinner = {
        text: '', succeed: vi.fn(), fail: vi.fn(), stop: vi.fn(), start: vi.fn(),
      };
      await expect(
        generateTests('apps/ghost', { spinner })
      ).rejects.toThrow();
      expect(spinner.fail).toHaveBeenCalled();
    });
  });

  describe('generateDocumentation', () => {
    it('writes the project README from package.json and typedoc config', async () => {
      stageMonorepo();
      await generateDocumentation({ verbose: true });

      const readme = fs.readFileSync(path.join(tempRoot, 'README.md'), 'utf8');
      expect(readme).toContain('# gen-mono');
      expect(readme).toContain('staged for generate tests');
      expect(readme).toContain('Quick Start');

      const typedoc = fs.readFileSync(path.join(tempRoot, 'typedoc.json'), 'utf8');
      expect(typedoc).toContain('entryPoints');
      expect(typedoc).toContain('docs/api');
    });

    it('fails the spinner when package.json is unreadable', async () => {
      stageMonorepo();
      fs.removeSync(path.join(tempRoot, 'package.json'));
      const spinner = {
        text: '', succeed: vi.fn(), fail: vi.fn(), stop: vi.fn(), start: vi.fn(),
      };
      await expect(generateDocumentation({ spinner })).rejects.toThrow();
      expect(spinner.fail).toHaveBeenCalled();
    });
  });
});
