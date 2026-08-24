import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  listMiddleware,
  showMiddlewareStats,
  testMiddleware,
  clearMiddlewareCache,
  showMiddlewareChain,
  createExampleMiddleware,
} from '../../src/commands/plugin-middleware';
import { ValidationError } from '../../src/utils/error-handler';
import {
  createMiddlewareChainManager,
  builtinMiddleware,
  MiddlewareType,
} from '../../src/utils/plugin-command-middleware';

// Covers src/commands/plugin-middleware.ts (553 lines) — the six
// `plugin middleware` subcommands. The middleware chain manager engine has
// its own suite; here it is mocked so the command layer's filtering,
// grouping and rendering are exercised in isolation. builtinMiddleware
// factories stay REAL so testMiddleware actually drives the built-ins.

const mocks = vi.hoisted(() => ({
  getMiddlewares: vi.fn(),
  getStats: vi.fn(),
  clearCache: vi.fn(),
}));

vi.mock('../../src/utils/plugin-command-middleware', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/utils/plugin-command-middleware')>();
  return {
    ...actual,
    createMiddlewareChainManager: vi.fn(() => ({
      getMiddlewares: mocks.getMiddlewares,
      getStats: mocks.getStats,
      clearCache: mocks.clearCache,
    })),
  };
});

vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
}));

const FACTORY = vi.mocked(createMiddlewareChainManager);

function registration(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'my-plugin:validation:123',
    type: MiddlewareType.VALIDATION,
    pluginName: 'my-plugin',
    priority: 0,
    isActive: true,
    handler: vi.fn(),
    ...overrides,
  };
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getMiddlewares.mockReturnValue([]);
  mocks.getStats.mockReturnValue({
    totalMiddlewares: 0,
    activeMiddlewares: 0,
    cacheSize: 0,
    rateLimiters: 0,
    byType: {},
    byPlugin: {},
  });
  FACTORY.mockClear();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

function out(): string {
  return logSpy.mock.calls.map(c => String(c[0])).join('\n');
}

describe('listMiddleware', () => {
  it('groups middleware by type with status icons and priorities', async () => {
    mocks.getMiddlewares.mockReturnValue([
      registration(),
      registration({
        id: 'other:logger:1',
        type: MiddlewareType.LOGGER,
        pluginName: 'other',
        priority: 10,
        isActive: false,
      }),
    ]);
    mocks.getStats.mockReturnValue({
      totalMiddlewares: 2,
      activeMiddlewares: 1,
      cacheSize: 3,
      rateLimiters: 0,
      byType: {},
      byPlugin: {},
    });

    await listMiddleware();

    const text = out();
    expect(text).toContain('Registered Middleware');
    expect(text).toContain('validation (1)');
    expect(text).toContain('logger (1)');
    expect(text).toContain('my-plugin:validation:123');
    expect(text).toContain('Plugin: my-plugin');
    expect(text).toContain('Priority: 0');
    expect(text).toContain('Total middleware: 2');
    expect(text).toContain('Active: 1');
    expect(text).toContain('Cache entries: 3');
  });

  it('filters by type, plugin and active status', async () => {
    const target = registration();
    const other = registration({
      id: 'other:logger:1',
      type: MiddlewareType.LOGGER,
      pluginName: 'other',
      isActive: false,
    });
    mocks.getMiddlewares.mockReturnValue([target, other]);

    await listMiddleware({
      type: MiddlewareType.VALIDATION,
      plugin: 'my-plugin',
      active: true,
    });

    expect(out()).toContain('my-plugin:validation:123');
    expect(out()).not.toContain('other:logger:1');
  });

  it('renders caching and rate-limit annotations', async () => {
    mocks.getMiddlewares.mockReturnValue([
      registration({
        options: {
          cache: { enabled: true, ttl: 5000 },
          rateLimit: { maxRequests: 10, windowMs: 60000 },
        },
      }),
    ]);

    await listMiddleware();

    const text = out();
    expect(text).toContain('Caching enabled');
    expect(text).toContain('TTL: 5000ms');
    expect(text).toContain('Rate limiting');
    expect(text).toContain('10 req/60000ms');
  });

  it('renders appliesTo and metadata in verbose mode', async () => {
    mocks.getMiddlewares.mockReturnValue([
      registration({
        appliesTo: {
          commands: ['build', 'test'],
          plugins: ['core'],
          categories: ['ci'],
        },
        metadata: { author: 'team' },
      }),
    ]);

    await listMiddleware({ verbose: true });

    const text = out();
    expect(text).toContain('Applies to:');
    expect(text).toContain('Commands: build, test');
    expect(text).toContain('Plugins: core');
    expect(text).toContain('Categories: ci');
    expect(text).toContain('"author":"team"');
  });

  it('emits the filtered list as raw JSON', async () => {
    mocks.getMiddlewares.mockReturnValue([registration()]);
    await listMiddleware({ json: true });

    const parsed = JSON.parse(out());
    expect(parsed[0].id).toBe('my-plugin:validation:123');
  });

  it('notes when no middleware matches the criteria', async () => {
    await listMiddleware({ type: MiddlewareType.CACHE });
    expect(out()).toContain('No middleware found matching criteria.');
  });
});

describe('showMiddlewareStats', () => {
  it('renders the overview, per-type and per-plugin breakdown', async () => {
    mocks.getStats.mockReturnValue({
      totalMiddlewares: 5,
      activeMiddlewares: 4,
      cacheSize: 2,
      rateLimiters: 1,
      byType: { validation: 3, logger: 2, cache: 0 },
      byPlugin: { 'my-plugin': 3, other: 2 },
    });

    await showMiddlewareStats();

    const text = out();
    expect(text).toContain('Total middleware: 5');
    expect(text).toContain('Active middleware: 4');
    expect(text).toContain('Cache size: 2');
    expect(text).toContain('Rate limiters: 1');
    expect(text).toContain('validation: 3');
    expect(text).toContain('logger: 2');
    // zero counts are skipped
    expect(text).not.toContain('cache: 0');
    expect(text).toContain('my-plugin: 3');
  });

  it('emits the stats object as JSON', async () => {
    mocks.getStats.mockReturnValue({
      totalMiddlewares: 1,
      activeMiddlewares: 1,
      cacheSize: 0,
      rateLimiters: 0,
      byType: { logger: 1 },
      byPlugin: { core: 1 },
    });

    await showMiddlewareStats({ json: true });

    expect(JSON.parse(out()).totalMiddlewares).toBe(1);
  });

  it('lists the type catalogue and built-ins in verbose mode', async () => {
    await showMiddlewareStats({ verbose: true });

    const text = out();
    expect(text).toContain('Middleware Types:');
    expect(text).toContain('Built-in Middleware:');
    expect(text).toContain('validation - Schema-based validation');
    expect(text).toContain('timing - Performance timing');
  });
});

describe('testMiddleware', () => {
  it('runs the validation built-in against supplied args and passes', async () => {
    await testMiddleware('validation', JSON.stringify({ args: { name: 'x' } }));

    expect(out()).toContain('Middleware execution passed');
  });

  it('runs the authorization built-in with the granted permission', async () => {
    // test context grants filesystem + network, authorization requires filesystem
    await testMiddleware('authorization', '{}');
    expect(out()).toContain('Middleware execution passed');
  });

  it('runs rateLimit, cache, logger, transform and timing built-ins', async () => {
    for (const type of ['rateLimit', 'cache', 'logger', 'transform', 'timing']) {
      logSpy.mockClear();
      await testMiddleware(type, '{}');
      expect(out()).toContain('Middleware execution passed');
    }
  });

  it('prints execution details in verbose mode', async () => {
    await testMiddleware('timing', JSON.stringify({ args: { a: 1 }, options: { b: 2 } }), {
      verbose: true,
    });

    const text = out();
    expect(text).toContain('Execution details:');
    expect(text).toContain('Middleware type: timing');
    expect(text).toContain('"a":1');
    expect(text).toContain('Execution complete: true');
  });

  it('rejects non-JSON test data', async () => {
    await testMiddleware('validation', 'not-json');
    expect(out()).toContain('Middleware execution failed: Test data must be valid JSON');
  });

  it('rejects unknown middleware types', async () => {
    await testMiddleware('nope', '{}');
    expect(out()).toContain('Unknown middleware type: nope');
  });

  it('reports a failing validation as a failed execution instead of throwing', async () => {
    // name is required by the built-in schema; omit it
    await testMiddleware('validation', JSON.stringify({ args: {} }));
    expect(out()).toContain('Middleware execution failed');
  });
});

describe('clearMiddlewareCache', () => {
  it('clears the cache through the manager', async () => {
    await clearMiddlewareCache();

    expect(mocks.clearCache).toHaveBeenCalledTimes(1);
    expect(out()).toContain('Middleware cache cleared');
  });
});

describe('showMiddlewareChain', () => {
  it('renders the numbered execution order around the command handler', async () => {
    await showMiddlewareChain('build');

    const text = out();
    expect(text).toContain("Middleware Chain for 'build'");
    expect(text).toContain('Execution Order:');
    expect(text).toContain('1. Pre-Validation');
    expect(text).toContain('Command Handler');
    expect(text).toContain('Error Handling');
  });

  it('emits the chain as JSON (after the header line)', async () => {
    await showMiddlewareChain('build', { json: true });
    // QUIRK: the header console.log fires before the json early-return, so the
    // JSON payload is the last console.log call, not the whole output
    const last = String(logSpy.mock.calls.at(-1)![0]);
    const parsed = JSON.parse(last);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(11);
  });

  it('documents middleware behavior in verbose mode', async () => {
    await showMiddlewareChain('build', { verbose: true });
    expect(out()).toContain('Middleware Behavior:');
  });
});

describe('createExampleMiddleware', () => {
  it('renders the description and code for a known type', async () => {
    await createExampleMiddleware('validation');

    const text = out();
    expect(text).toContain('Example validation Middleware');
    expect(text).toContain('Validates command arguments and options against a schema');
    expect(text).toContain('builtinMiddleware.validation({');
  });

  it('covers every documented example type', async () => {
    for (const type of [
      'authorization',
      'rateLimit',
      'cache',
      'logger',
      'transform',
      'custom',
    ]) {
      logSpy.mockClear();
      await createExampleMiddleware(type);
      expect(out()).toContain(`Example ${type} Middleware`);
    }
  });

  it('lists available types for an unknown request', async () => {
    await createExampleMiddleware('nope');

    const text = out();
    expect(text).toContain('Unknown middleware type: nope');
    expect(text).toContain('Available types:');
    expect(text).toContain('custom');
  });

  it('renders the plugin usage snippet in verbose mode', async () => {
    await createExampleMiddleware('cache', { verbose: true });

    const text = out();
    expect(text).toContain('Usage in Plugin:');
    expect(text).toContain("name: 'my-command'");
  });
});

describe('builtinMiddleware factories (integration smoke)', () => {
  it('exposes every factory the test command dispatches to', () => {
    for (const key of [
      'validation',
      'authorization',
      'rateLimit',
      'cache',
      'logger',
      'transform',
      'timing',
    ]) {
      expect(builtinMiddleware).toHaveProperty(key);
    }
  });
});
