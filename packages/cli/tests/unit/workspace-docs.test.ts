import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateWorkspaceDocs } from '../../src/commands/workspace-docs';
import { workspaceParser } from '../../src/parsers/workspace-parser';
import type { WorkspaceConfig } from '../../src/parsers/workspace-parser';

// Covers src/commands/workspace-docs.ts (635 lines) — the `workspace docs`
// generator. The parser is mocked (its own suite covers parsing) and fs-extra
// is stubbed for the three members the command touches; everything else
// (markdown/json/html renderers, ASCII diagram, mermaid graph, watch loop)
// is real code exercised through the single public export.

const fseMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  writeFile: vi.fn(async () => undefined),
  watch: vi.fn(() => ({ close: vi.fn() })),
}));

vi.mock('fs-extra', () => ({
  default: fseMocks,
  ...fseMocks,
}));
vi.mock('../../src/parsers/workspace-parser', () => ({
  workspaceParser: { parse: vi.fn() },
}));

const fs = fseMocks;

const PARSE = vi.mocked(workspaceParser.parse);

/** Service fixture with every optional field the renderers read. */
function fullConfig(): WorkspaceConfig {
  return {
    name: 'acme-platform',
    version: '2.1.0',
    description: 'ACME commerce platform',
    metadata: { team: 'platform', 'slack-channel': '#acme' },
    services: {
      storefront: {
        name: 'storefront',
        type: 'frontend',
        language: 'typescript',
        framework: { name: 'react', version: '18.2.0' },
        port: 3000,
        path: 'apps/storefront',
        displayName: 'Storefront',
        description: 'Customer-facing shop',
        scripts: { dev: 'vite', build: 'vite build' },
        env: { API_URL: 'https://api.acme.dev' },
        dependencies: {
          production: { react: '^18.2.0' },
          development: { vite: '^5.0.0' },
        },
      },
      'orders-api': {
        name: 'orders-api',
        type: 'backend',
        language: 'typescript',
        framework: 'fastify',
        port: 8080,
        env: { NODE_ENV: 'production' },
      },
      'report-worker': {
        name: 'report-worker',
        type: 'worker',
        language: 'python',
        framework: { name: 'celery' },
      },
    },
    dependencies: {
      databases: [{ type: 'postgres', host: 'db.acme.internal' }],
      caches: [{ type: 'redis' }],
      queues: [{ type: 'kafka', topic: 'orders' }],
    },
  } as unknown as WorkspaceConfig;
}

describe('workspace-docs — command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue('/mock-project');
    fs.existsSync.mockReturnValue(true);
    fs.writeFile.mockReset();
    fs.writeFile.mockResolvedValue(undefined);
    fs.watch.mockReset();
    fs.watch.mockReturnValue({ close: vi.fn() } as never);
    PARSE.mockReset();
    PARSE.mockReturnValue({ valid: true, config: fullConfig() } as never);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    cwdSpy.mockRestore();
    vi.restoreAllMocks();
  });

  /** Concatenate every console.log argument into one string. */
  function logged(): string {
    return logSpy.mock.calls.map(c => c.join(' ')).join('\n');
  }

  /** Content handed to fs.writeFile for the generated doc. */
  function writtenContent(): string {
    return String(fs.writeFile.mock.calls[0]?.[1]);
  }

  describe('preconditions', () => {
    it('bails when no workspace configuration exists', async () => {
      fs.existsSync.mockReturnValue(false);
      await generateWorkspaceDocs();
      expect(logged()).toContain('No workspace configuration found');
      expect(logged()).toContain('re-shell.workspaces.yaml');
      expect(logged()).toContain('re-shell workspace init');
      expect(PARSE).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('bails with guidance when the parsed configuration is invalid', async () => {
      PARSE.mockReturnValue({ valid: false, errors: ['bad'] } as never);
      await generateWorkspaceDocs();
      expect(logged()).toContain('Invalid workspace configuration');
      expect(logged()).toContain('Please fix errors before generating documentation');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('bails when the parser returns no config despite valid=true', async () => {
      PARSE.mockReturnValue({ valid: true, config: null } as never);
      await generateWorkspaceDocs();
      expect(logged()).toContain('Invalid workspace configuration');
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('markdown rendering', () => {
    it('writes WORKSPACE.md with metadata, services table and detail sections', async () => {
      await generateWorkspaceDocs();
      expect(fs.writeFile).toHaveBeenCalledTimes(1);
      expect(fs.writeFile.mock.calls[0][0]).toBe('/mock-project/WORKSPACE.md');
      const md = writtenContent();
      expect(md).toContain('# acme-platform');
      expect(md).toContain('ACME commerce platform');
      expect(md).toContain('**Version:** 2.1.0');
      expect(md).toContain('**team:** platform');
      expect(md).toContain('| Service | Type | Language | Framework | Port |');
      expect(md).toContain('| storefront | frontend | typescript | react 18.2.0 | 3000 |');
      expect(md).toContain('| orders-api | backend | typescript | fastify | 8080 |');
      expect(md).toContain('| report-worker | worker | python | celery | - |');
      expect(md).toContain('### storefront');
      expect(md).toContain('**Display Name:** Storefront');
      expect(md).toContain('**Description:** Customer-facing shop');
      expect(md).toContain('**Path:** `apps/storefront`');
      expect(md).toContain('#### Scripts');
      expect(md).toContain('| `dev` | `vite` |');
      expect(logged()).toContain('Documentation generated successfully');
      expect(logged()).toContain('/mock-project/WORKSPACE.md');
    });

    it('renders environment variables and both dependency groups per service', async () => {
      const md = await run();
      expect(md).toContain('#### Environment Variables');
      expect(md).toContain('- `API_URL`: https://api.acme.dev');
      expect(md).toContain('#### Production Dependencies');
      expect(md).toContain('- `react`: ^18.2.0');
      expect(md).toContain('#### Development Dependencies');
      expect(md).toContain('- `vite`: ^5.0.0');
    });

    it('renders global dependency sections (databases, caches, queues)', async () => {
      const md = await run();
      expect(md).toContain('## Dependencies');
      expect(md).toContain('### Databases');
      expect(md).toContain('"type":"postgres"');
      expect(md).toContain('### Caches');
      expect(md).toContain('"type":"redis"');
      expect(md).toContain('### Message Queues');
      expect(md).toContain('"topic":"orders"');
    });

    it('emits the ASCII architecture diagram and mermaid graph by default', async () => {
      const md = await run();
      expect(md).toMatch(/Frontend Layer\s+│/);
      expect(md).toMatch(/Backend Layer\s+│/);
      expect(md).toMatch(/Worker Layer\s+│/);
      expect(md).toContain('Client/Browser');
      expect(md).toContain('```mermaid');
      expect(md).toContain('graph TD');
      expect(md).toContain('subgraph Frontend');
      expect(md).toContain('subgraph Backend');
      expect(md).toContain('subgraph Workers');
      expect(md).toContain('storefront --> orders-api');
    });

    it('omits diagrams, env and dependency sections when flags are false', async () => {
      await generateWorkspaceDocs({
        includeDiagrams: false,
        includeEnv: false,
        includeDependencies: false,
      });
      const md = writtenContent();
      expect(md).not.toContain('## Architecture');
      expect(md).not.toContain('mermaid');
      expect(md).not.toContain('#### Environment Variables');
      expect(md).not.toContain('#### Production Dependencies');
      expect(md).not.toContain('## Dependencies');
      expect(md).not.toContain('- [Dependencies](#dependencies)');
      expect(md).not.toContain('- [Environment Variables](#environment-variables)');
      expect(md).not.toContain('- [Architecture](#architecture)');
    });

    it('renders a string framework verbatim and omits absent optional fields', async () => {
      PARSE.mockReturnValue({
        valid: true,
        config: {
          name: 'minimal',
          version: '0.0.1',
          services: {
            svc: { name: 'svc', language: 'go', framework: 'chi' },
          },
        },
      } as never);
      await generateWorkspaceDocs();
      const md = writtenContent();
      expect(md).toContain('| svc | worker | go | chi | - |');
      expect(md).toContain('**Framework:** chi');
      expect(md).not.toContain('**Display Name:**');
      expect(md).not.toContain('**Port:**');
      expect(md).not.toContain('#### Scripts');
      // Empty workspace renders no layers but keeps the doc skeleton intact.
      expect(md).toContain('# minimal');
      expect(md).not.toContain('Client/Browser');
    });
  });

  describe('json and html formats', () => {
    it('serializes the parsed configuration as pretty JSON', async () => {
      await generateWorkspaceDocs({ format: 'json' });
      const parsed = JSON.parse(writtenContent());
      expect(parsed.name).toBe('acme-platform');
      expect(parsed.version).toBe('2.1.0');
      expect(Object.keys(parsed.services)).toEqual(
        expect.arrayContaining(['storefront', 'orders-api', 'report-worker'])
      );
    });

    it('renders an HTML document with a services table and detail cards', async () => {
      await generateWorkspaceDocs({ format: 'html' });
      const html = writtenContent();
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<title>acme-platform - Workspace Documentation</title>');
      expect(html).toContain('<h2>Services Overview</h2>');
      expect(html).toContain('<th>Framework</th>');
      expect(html).toContain('<strong>storefront</strong>');
      expect(html).toContain('react 18.2.0');
      expect(html).toContain('<h2>Service Details</h2>');
      expect(html).toContain('class="service-card"');
      expect(html).toContain('<strong>Description:</strong> Customer-facing shop');
      expect(html).toContain('<code>apps/storefront</code>');
      expect(html).toContain('</html>');
    });

    it('honours a custom output path', async () => {
      await generateWorkspaceDocs({ format: 'json', output: 'docs/workspace.json' });
      expect(fs.writeFile.mock.calls[0][0]).toBe('/mock-project/docs/workspace.json');
    });
  });

  describe('error handling', () => {
    it('prints a friendly message and swallows the error by default', async () => {
      PARSE.mockImplementation(() => {
        throw new Error('yaml exploded');
      });
      await generateWorkspaceDocs();
      expect(logged()).toContain('Error generating documentation: yaml exploded');
      expect(errorSpy).not.toHaveBeenCalled();
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('prints the full stack trace in verbose mode', async () => {
      PARSE.mockImplementation(() => {
        throw new Error('yaml exploded');
      });
      await generateWorkspaceDocs({ verbose: true });
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('watch mode', () => {
    it('watches the config file and regenerates on change events', async () => {
      vi.useFakeTimers();
      try {
        const pending = generateWorkspaceDocs({ watch: true });
        await vi.advanceTimersByTimeAsync(0);
        expect(fs.watch).toHaveBeenCalledTimes(1);
        expect(fs.watch.mock.calls[0][0]).toBe('/mock-project/re-shell.workspaces.yaml');
        // Initial generation happens before the watcher starts.
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        expect(logged()).toContain('Watching for changes');
        expect(logged()).toContain('Press Ctrl+C to stop');

        const onChange = fs.watch.mock.calls[0][1] as (
          event: string,
          filename: string
        ) => Promise<void>;
        // Do NOT await the callback directly: it sleeps 100ms on the fake
        // clock. Kick it off, then advance the clock to settle it.
        void onChange('change', 're-shell.workspaces.yaml');
        await vi.advanceTimersByTimeAsync(150);
        expect(fs.writeFile).toHaveBeenCalledTimes(2);
        expect(logged()).toContain('Documentation updated');
        expect(logged()).toContain('/mock-project/WORKSPACE.md');

        // Non-change events (rename) are ignored.
        void onChange('rename', 're-shell.workspaces.yaml');
        await vi.advanceTimersByTimeAsync(150);
        expect(fs.writeFile).toHaveBeenCalledTimes(2);
        void pending;
      } finally {
        vi.useRealTimers();
      }
    });

    it('skips regeneration when the changed config is invalid', async () => {
      vi.useFakeTimers();
      try {
        const pending = generateWorkspaceDocs({ watch: true });
        await vi.advanceTimersByTimeAsync(0);
        const onChange = fs.watch.mock.calls[0][1] as (
          event: string,
          filename: string
        ) => Promise<void>;
        PARSE.mockReturnValue({ valid: false, errors: ['bad'] } as never);
        void onChange('change', 're-shell.workspaces.yaml');
        await vi.advanceTimersByTimeAsync(150);
        expect(fs.writeFile).toHaveBeenCalledTimes(1);
        expect(logged()).toContain('Invalid workspace configuration - skipping');
        void pending;
      } finally {
        vi.useRealTimers();
      }
    });

    it('closes the watcher and exits on SIGINT', async () => {
      const close = vi.fn();
      fs.watch.mockReturnValue({ close } as never);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
      const sigintBefore = process.listenerCount('SIGINT');
      try {
        await generateWorkspaceDocs({ watch: true });
        const handler = process.listeners('SIGINT').at(-1) as () => void;
        expect(handler).toBeDefined();
        handler();
        expect(close).toHaveBeenCalled();
        expect(exitSpy).toHaveBeenCalledWith(0);
        expect(logged()).toContain('Stopped watching');
      } finally {
        process.removeAllListeners('SIGINT');
        for (let i = process.listenerCount('SIGINT'); i < sigintBefore; i++) {
          // removeAllListeners above wiped pre-existing listeners too; nothing
          // to restore, but keep the count sane for later suites.
          break;
        }
        exitSpy.mockRestore();
      }
    });
  });
});

/** Run the generator and return the last doc payload written. */
async function run(): Promise<string> {
  await generateWorkspaceDocs();
  return String(vi.mocked(fs.writeFile).mock.calls.at(-1)?.[1]);
}
