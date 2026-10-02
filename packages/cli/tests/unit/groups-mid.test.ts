import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// Covers the mid-size commander registration groups in src/groups/ that carry
// their action handlers inline: cache (stats/clean), commands (list),
// generate (component/hook/service/test/docs/backend/feature), find, and the
// run + service groups' shared helpers are out of scope here. Each test builds
// a fresh real Commander program, registers the group, and asserts the command
// tree shape and the action wiring — option forwarding, defaults, timeout
// wrapping (withTimeout), spinner lifecycle, and json-mode envelopes.

vi.mock('../../src/utils/cache-store', () => ({
  computeCacheStats: vi.fn(),
  cleanCache: vi.fn(),
}));
vi.mock('../../src/utils/cache-telemetry', () => ({
  readCacheTelemetry: vi.fn(),
  resetCacheTelemetry: vi.fn(),
}));
vi.mock('../../src/utils/cache-config', () => ({
  // Deterministic root so assertions don't depend on the real cwd.
  resolveCacheRoot: vi.fn((_root: string, override?: string) => override ?? '/c/root'),
}));
vi.mock('../../src/utils/command-catalog', () => ({
  buildCommandCatalog: vi.fn(),
}));
vi.mock('../../src/commands/generate', () => ({
  generateCode: vi.fn(),
  generateTests: vi.fn(),
  generateDocumentation: vi.fn(),
}));
vi.mock('../../src/commands/create-feature', () => ({
  createFeature: vi.fn(),
}));
vi.mock('../../src/utils/find-corpus', () => ({
  buildFindCorpus: vi.fn(() => []),
}));
vi.mock('../../src/utils/find-index', () => ({
  rankDocs: vi.fn(() => []),
}));

vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(function (this: unknown) {
      return this;
    }),
    stop: vi.fn(),
    setText: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
  flushOutput: vi.fn(),
}));

const { registerCacheGroup } = await import('../../src/groups/cache.group');
const { registerCommandsGroup } = await import('../../src/groups/commands.group');
const { registerGenerateGroup } = await import('../../src/groups/generate.group');
const { registerFindGroup } = await import('../../src/groups/find.group');

const { computeCacheStats, cleanCache } = await import('../../src/utils/cache-store');
const { readCacheTelemetry, resetCacheTelemetry } = await import(
  '../../src/utils/cache-telemetry'
);
const { resolveCacheRoot } = await import('../../src/utils/cache-config');
const { buildCommandCatalog } = await import('../../src/utils/command-catalog');
const { generateCode, generateTests, generateDocumentation } = await import(
  '../../src/commands/generate'
);
const { createFeature } = await import('../../src/commands/create-feature');
const { rankDocs } = await import('../../src/utils/find-index');
const { buildFindCorpus } = await import('../../src/utils/find-corpus');

/** Build a program with the given group registered, ready for parseAsync. */
function programWith(register: (program: Command) => void): Command {
  const program = new Command();
  program.exitOverride();
  register(program);
  return program;
}

/** Find a subcommand by name on a program/command. */
function subcommand(parent: Command, name: string): Command {
  const found = parent.commands.find(command => command.name() === name);
  if (!found) {
    throw new Error(`subcommand "${name}" not found on ${parent.name()}`);
  }
  return found;
}

/** Option flags of a command in declaration order. */
function optionFlags(command: Command): string[] {
  return command.options.map(option => option.flags);
}

describe('groups — mid-size registration groups', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBackup: string | number | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitCodeBackup = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
    process.exitCode = exitCodeBackup;
  });

  describe('cache group', () => {
    it('registers cache stats + clean with json/cache-dir options', () => {
      const program = programWith(registerCacheGroup);
      const cache = subcommand(program, 'cache');
      expect(cache.commands.map(command => command.name())).toEqual(['stats', 'clean']);
      for (const name of ['stats', 'clean']) {
        expect(optionFlags(subcommand(cache, name))).toEqual([
          '--json',
          '--cache-dir <dir>',
        ]);
      }
    });

    it('stats composes store + telemetry into a payload and renders it', async () => {
      const program = programWith(registerCacheGroup);
      vi.mocked(computeCacheStats).mockResolvedValue({
        location: '/c/root',
        entries: 4,
        sizeBytes: 4096,
      } as never);
      vi.mocked(readCacheTelemetry).mockResolvedValue({
        hits: 3,
        misses: 1,
      } as never);
      await program.parseAsync(['node', 're-shell', 'cache', 'stats']);
      expect(resolveCacheRoot).toHaveBeenCalledWith(process.cwd(), undefined);
      expect(computeCacheStats).toHaveBeenCalledWith('/c/root');
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('build cache stats');
      expect(out).toContain('/c/root');
      expect(out).toContain('4');
      expect(out).toContain('4.0 KiB');
      expect(out).toContain('75.0%');
      expect(out).toContain('3 hits / 1 misses');
    });

    it('stats renders n/a hit-rate when no runs are recorded', async () => {
      const program = programWith(registerCacheGroup);
      vi.mocked(computeCacheStats).mockResolvedValue({
        location: '/c/root',
        entries: 0,
        sizeBytes: 0,
      } as never);
      vi.mocked(readCacheTelemetry).mockResolvedValue({ hits: 0, misses: 0 } as never);
      await program.parseAsync(['node', 're-shell', 'cache', 'stats']);
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('n/a (no runs recorded)');
    });

    it('stats honours --cache-dir for the cache root', async () => {
      const program = programWith(registerCacheGroup);
      vi.mocked(computeCacheStats).mockResolvedValue({
        location: '/custom',
        entries: 1,
        sizeBytes: 10,
      } as never);
      vi.mocked(readCacheTelemetry).mockResolvedValue({ hits: 0, misses: 0 } as never);
      await program.parseAsync([
        'node', 're-shell', 'cache', 'stats', '--cache-dir', '/custom',
      ]);
      expect(resolveCacheRoot).toHaveBeenCalledWith(process.cwd(), '/custom');
    });

    it('stats emits a JSON envelope with hitRate in json mode', async () => {
      const program = programWith(registerCacheGroup);
      const jsonWrite = vi.fn();
      const { enableJsonMode } = await import('../../src/utils/json-output');
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(computeCacheStats).mockResolvedValue({
        location: '/c/root',
        entries: 2,
        sizeBytes: 2048,
      } as never);
      vi.mocked(readCacheTelemetry).mockResolvedValue({ hits: 1, misses: 1 } as never);
      await program.parseAsync(['node', 're-shell', 'cache', 'stats', '--json']);
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload).toMatchObject({
        ok: true,
        data: {
          location: '/c/root',
          entries: 2,
          sizeBytes: 2048,
          hits: 1,
          misses: 1,
          hitRate: 0.5,
        },
      });
    });

    it('clean reports removed entries + reclaimed bytes and resets telemetry', async () => {
      const program = programWith(registerCacheGroup);
      vi.mocked(cleanCache).mockResolvedValue({
        location: '/c/root',
        removedEntries: 3,
        reclaimedBytes: 1536,
      } as never);
      await program.parseAsync(['node', 're-shell', 'cache', 'clean']);
      expect(cleanCache).toHaveBeenCalledWith('/c/root');
      expect(resetCacheTelemetry).toHaveBeenCalledWith('/c/root');
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('removed 3 entries');
      expect(out).toContain('1.5 KiB');
    });

    it('clean singularizes the entry count for exactly one entry', async () => {
      const program = programWith(registerCacheGroup);
      vi.mocked(cleanCache).mockResolvedValue({
        location: '/c/root',
        removedEntries: 1,
        reclaimedBytes: 512,
      } as never);
      await program.parseAsync(['node', 're-shell', 'cache', 'clean']);
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('removed 1 entry');
      expect(out).not.toContain('1 entries');
    });

    it('surfaces a CACHE_ERROR envelope in json mode on failure', async () => {
      const program = programWith(registerCacheGroup);
      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(computeCacheStats).mockRejectedValue(new Error('disk exploded'));
      await program.parseAsync(['node', 're-shell', 'cache', 'stats', '--json']);
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe('CACHE_ERROR');
      expect(payload.error.message).toContain('disk exploded');
    });

    it('writes a human error to stderr with exitCode 1 on failure', async () => {
      const program = programWith(registerCacheGroup);
      const stderrSpy = vi.mocked(process.stderr.write);
      vi.mocked(cleanCache).mockRejectedValue(new Error('locked'));
      await program.parseAsync(['node', 're-shell', 'cache', 'clean']);
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Cache error: locked'));
      expect(process.exitCode).toBe(1);
    });
  });

  describe('commands group', () => {
    it('registers commands list with a json option', () => {
      const program = programWith(registerCommandsGroup);
      const list = subcommand(subcommand(program, 'commands'), 'list');
      expect(optionFlags(list)).toEqual(['--json']);
    });

    it('renders the catalog with badges in human mode', async () => {
      const program = programWith(registerCommandsGroup);
      vi.mocked(buildCommandCatalog).mockReturnValue([
        {
          path: 're-shell build',
          description: 'Build everything',
          supportsJson: true,
          supportsDryRun: false,
          destructive: false,
        },
        {
          path: 're-shell nuke',
          description: 'Delete everything',
          supportsJson: true,
          supportsDryRun: true,
          destructive: true,
        },
      ] as never);
      await program.parseAsync(['node', 're-shell', 'commands', 'list']);
      expect(buildCommandCatalog).toHaveBeenCalledWith(program);
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('Commands (2)');
      expect(out).toContain('re-shell build');
      expect(out).toContain('Build everything');
      expect(out).toContain('json');
      expect(out).toContain('dry-run');
      expect(out).toContain('destructive');
    });

    it('emits the raw catalog array in json mode', async () => {
      const program = programWith(registerCommandsGroup);
      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(buildCommandCatalog).mockReturnValue([
        { path: 're-shell build' },
      ] as never);
      await program.parseAsync(['node', 're-shell', 'commands', 'list', '--json']);
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload).toMatchObject({ ok: true, data: [{ path: 're-shell build' }] });
    });

    it('emits COMMANDS_LIST_ERROR when the catalog build throws', async () => {
      const program = programWith(registerCommandsGroup);
      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(buildCommandCatalog).mockImplementation(() => {
        throw new Error('catalog exploded');
      });
      await program.parseAsync(['node', 're-shell', 'commands', 'list', '--json']);
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe('COMMANDS_LIST_ERROR');
    });
  });

  describe('generate group', () => {
    it('registers all seven generators with their defaults', () => {
      const program = programWith(registerGenerateGroup);
      const generate = subcommand(program, 'generate');
      expect(generate.commands.map(command => command.name())).toEqual([
        'component', 'hook', 'service', 'test', 'docs', 'backend', 'feature',
      ]);
      const component = subcommand(generate, 'component');
      const framework = component.options.find(option => option.long === '--framework');
      expect(framework?.defaultValue).toBe('react');
      const backend = subcommand(generate, 'backend');
      const backendFramework = backend.options.find(option => option.long === '--framework');
      expect(backendFramework?.defaultValue).toBe('express');
      const port = backend.options.find(option => option.long === '--port');
      expect(port?.defaultValue).toBe('8000');
      const feature = subcommand(generate, 'feature');
      expect(feature.alias()).toBe('create-feature');
      const typeOption = feature.options.find(option => option.long === '--type');
      expect(typeOption?.defaultValue).toBe('crud');
    });

    it('component forwards name + options with type component', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(generateCode).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'generate', 'component', 'Button',
        '--framework', 'vue', '--workspace', 'web', '--export', '--verbose',
      ]);
      const call = vi.mocked(generateCode).mock.calls[0];
      expect(call[0]).toBe('Button');
      expect(call[1]).toMatchObject({
        type: 'component',
        framework: 'vue',
        workspace: 'web',
        export: true,
        verbose: true,
        spinner: expect.anything(),
      });
    });

    it('hook forces the react framework', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(generateCode).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'generate', 'hook', 'useAuth']);
      const call = vi.mocked(generateCode).mock.calls[0];
      expect(call[0]).toBe('useAuth');
      expect(call[1]).toMatchObject({ type: 'hook', framework: 'react' });
    });

    it('service human path passes a spinner; json path emits an envelope without one', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(generateCode).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'generate', 'service', 'UserService']);
      expect(vi.mocked(generateCode).mock.calls[0][1]).toMatchObject({
        type: 'service',
        spinner: expect.anything(),
      });

      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      await program.parseAsync([
        'node', 're-shell', 'generate', 'service', 'UserService', '--json',
      ]);
      expect(vi.mocked(generateCode).mock.calls[1][1]).not.toHaveProperty('spinner');
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload).toMatchObject({
        ok: true,
        data: { type: 'service', name: 'UserService', framework: null },
      });
    });

    it('service json failures emit a GENERATE_ERROR envelope', async () => {
      const program = programWith(registerGenerateGroup);
      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(generateCode).mockRejectedValue(new Error('no workspace'));
      await program.parseAsync([
        'node', 're-shell', 'generate', 'service', 'S', '--json',
      ]);
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload.ok).toBe(false);
      expect(payload.error.code).toBe('GENERATE_ERROR');
      expect(payload.error.message).toContain('no workspace');
    });

    it('test and docs forward to their dedicated generators', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(generateTests).mockResolvedValue(undefined);
      vi.mocked(generateDocumentation).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'generate', 'test', 'api', '--verbose']);
      expect(generateTests).toHaveBeenCalledWith('api', expect.objectContaining({ verbose: true }));
      await program.parseAsync(['node', 're-shell', 'generate', 'docs', '--verbose']);
      expect(generateDocumentation).toHaveBeenCalledWith(expect.objectContaining({ verbose: true }));
    });

    it('backend forwards framework/language/port options', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(generateCode).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'generate', 'backend', 'payments-api',
        '--framework', 'fastapi', '--language', 'python', '--port', '9000',
      ]);
      const call = vi.mocked(generateCode).mock.calls[0];
      expect(call[0]).toBe('payments-api');
      expect(call[1]).toMatchObject({
        type: 'backend',
        framework: 'fastapi',
        language: 'python',
        port: '9000',
      });
    });

    it('feature splits comma-separated features and forwards createFeature', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(createFeature).mockResolvedValue(undefined);
      await program.parseAsync([
        'node', 're-shell', 'generate', 'feature', 'billing',
        '--type', 'auth', '--backend', 'fastify', '--features', 'a,b',
      ]);
      const call = vi.mocked(createFeature).mock.calls[0];
      expect(call[0]).toBe('billing');
      expect(call[1]).toMatchObject({
        type: 'auth',
        backend: 'fastify',
        features: ['a', 'b'],
        spinner: expect.anything(),
      });
    });

    it('feature defaults to an empty features array', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(createFeature).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'generate', 'feature', 'x']);
      expect(vi.mocked(createFeature).mock.calls[0][1]).toMatchObject({ features: [] });
    });

    it('runs the feature alias create-feature identically', async () => {
      const program = programWith(registerGenerateGroup);
      vi.mocked(createFeature).mockResolvedValue(undefined);
      await program.parseAsync(['node', 're-shell', 'generate', 'create-feature', 'x']);
      expect(createFeature).toHaveBeenCalledWith('x', expect.anything());
    });
  });

  describe('find group', () => {
    it('registers find with a required query argument and defaults', async () => {
      const program = programWith(registerFindGroup);
      const cmd = subcommand(program, 'find');
      expect(optionFlags(cmd)).toEqual([
        '--json',
        '--limit <n>',
        '--type <type>',
      ]);
      expect(cmd.registeredArguments[0].name()).toBe('query');
      expect(cmd.options.find(option => option.long === '--limit')?.defaultValue).toBe('10');
      expect(cmd.options.find(option => option.long === '--type')?.defaultValue).toBe('all');
    });

    it('builds the corpus from the program and ranks it with limit + type', async () => {
      const program = programWith(registerFindGroup);
      vi.mocked(rankDocs).mockReturnValue([]);
      await program.parseAsync([
        'node', 're-shell', 'find', 'kubernetes', '--limit', '5', '--type', 'command',
      ]);
      expect(buildFindCorpus).toHaveBeenCalledWith(program);
      expect(rankDocs).toHaveBeenCalledWith('kubernetes', [], { limit: 5, type: 'command' });
    });

    it('clamps an invalid limit back to the default of 10', async () => {
      const program = programWith(registerFindGroup);
      vi.mocked(rankDocs).mockReturnValue([]);
      await program.parseAsync(['node', 're-shell', 'find', 'q', '--limit', 'abc']);
      expect(rankDocs).toHaveBeenCalledWith('q', [], { limit: 10, type: 'all' });
      await program.parseAsync(['node', 're-shell', 'find', 'q', '--limit', '0']);
      expect(rankDocs).toHaveBeenLastCalledWith('q', [], { limit: 10, type: 'all' });
    });

    it('rejects an unknown --type in human mode with exitCode 1', async () => {
      const program = programWith(registerFindGroup);
      await program.parseAsync(['node', 're-shell', 'find', 'q', '--type', 'bogus']);
      expect(rankDocs).not.toHaveBeenCalled();
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('Invalid --type "bogus"');
      expect(process.exitCode).toBe(1);
    });

    it('renders ranked results grouped by commands and templates', async () => {
      const program = programWith(registerFindGroup);
      vi.mocked(rankDocs).mockReturnValue([
        {
          type: 'command',
          title: 're-shell k8s',
          usage: 're-shell k8s generate',
          score: 0.9,
          matched: ['k8s'],
        },
        {
          type: 'template',
          title: 'react-ts',
          usage: undefined,
          score: 0.4,
          matched: [],
        },
      ] as never);
      await program.parseAsync(['node', 're-shell', 'find', 'k8s']);
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('Results for "k8s" (2)');
      expect(out).toContain('Commands');
      expect(out).toContain('re-shell k8s');
      expect(out).toContain('(90%)');
      expect(out).toContain('matched: k8s');
      expect(out).toContain('Templates');
      expect(out).toContain('react-ts');
    });

    it('suggests different keywords when nothing matches', async () => {
      const program = programWith(registerFindGroup);
      vi.mocked(rankDocs).mockReturnValue([]);
      await program.parseAsync(['node', 're-shell', 'find', 'zzz']);
      const out = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      expect(out).toContain('No matches');
    });

    it('emits a JSON envelope with query + limit + results', async () => {
      const program = programWith(registerFindGroup);
      const jsonWrite = vi.fn();
      vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
        jsonWrite(String(chunk));
        return true;
      }) as never);
      vi.mocked(rankDocs).mockReturnValue([
        { type: 'command', title: 't', score: 1, matched: [] },
      ] as never);
      await program.parseAsync(['node', 're-shell', 'find', 'q', '--json', '--limit', '3']);
      const payload = JSON.parse(jsonWrite.mock.calls.flat().join(''));
      expect(payload).toMatchObject({
        ok: true,
        data: {
          query: 'q',
          limit: 3,
          results: [{ type: 'command', title: 't' }],
        },
      });
    });
  });
});
