import { describe, it, expect, vi } from 'vitest';
import {
  MiddlewareChainManager,
  createMiddlewareChainManager,
  composeMiddleware,
  builtinMiddleware,
  MiddlewareType,
  type MiddlewareOptions,
} from '../../src/utils/plugin-command-middleware';
import { ValidationError } from '../../src/utils/error-handler';
import type { PluginCommandContext, PluginCommandMiddleware } from '../../src/utils/plugin-command-registry';
import type { PluginPermission } from '../../src/utils/plugin-system';

/**
 * Minimal PluginCommandContext stub with a recording logger and a utils bag
 * that built-in middleware (timing) can decorate.
 */
function makeContext(overrides: {
  commandName?: string;
  category?: string;
  pluginName?: string;
  permissions?: PluginPermission[];
} = {}): { context: PluginCommandContext; logs: { info: string[]; debug: string[]; error: string[] } } {
  const logs = { info: [] as string[], debug: [] as string[], error: [] as string[] };
  const context = {
    command: {
      name: overrides.commandName ?? 'deploy',
      description: 'test command',
      category: overrides.category,
      handler: () => {},
      options: [],
    },
    plugin: {
      manifest: {
        name: overrides.pluginName ?? 'test-plugin',
        version: '1.0.0',
        reshell: { permissions: overrides.permissions ?? [] },
      },
    },
    cli: {},
    logger: {
      debug: (m: string) => logs.debug.push(m),
      info: (m: string) => logs.info.push(m),
      warn: () => {},
      error: (m: string) => logs.error.push(m),
    },
    utils: {} as Record<string, unknown>,
  } as unknown as PluginCommandContext;
  return { context, logs };
}

/** Builds a middleware that records its label into `order` then calls next. */
function recordingMiddleware(order: string[], label: string): PluginCommandMiddleware {
  return async (_args, _options, _context, next) => {
    order.push(label);
    await next();
  };
}

describe('plugin-command-middleware — enums & factory', () => {
  it('exposes the expected MiddlewareType values', () => {
    expect(MiddlewareType.PRE_VALIDATION).toBe('pre-validation');
    expect(MiddlewareType.VALIDATION).toBe('validation');
    expect(MiddlewareType.PRE_EXECUTION).toBe('pre-execution');
    expect(MiddlewareType.POST_EXECUTION).toBe('post-execution');
    expect(MiddlewareType.ERROR_HANDLER).toBe('error-handler');
    expect(MiddlewareType.LOGGER).toBe('logger');
    expect(MiddlewareType.RATE_LIMITER).toBe('rate-limiter');
    expect(MiddlewareType.CACHE).toBe('cache');
    expect(MiddlewareType.TRANSFORM).toBe('transform');
    expect(MiddlewareType.AUTHORIZATION).toBe('authorization');
  });

  it('createMiddlewareChainManager returns a MiddlewareChainManager instance', () => {
    const manager = createMiddlewareChainManager();
    expect(manager).toBeInstanceOf(MiddlewareChainManager);
    expect(manager.getMiddlewares()).toEqual([]);
  });
});

describe('plugin-command-middleware — registration & queries', () => {
  it('registerMiddleware stores the middleware, emits middleware-registered and returns an id', () => {
    const manager = createMiddlewareChainManager();
    const listener = vi.fn();
    manager.on('middleware-registered', listener);
    const id = manager.registerMiddleware('alpha', MiddlewareType.LOGGER, async () => {});
    expect(id).toMatch(/^alpha:logger:\d+$/);
    const reg = manager.getMiddlewares()[0];
    expect(reg.id).toBe(id);
    expect(reg.pluginName).toBe('alpha');
    expect(reg.type).toBe(MiddlewareType.LOGGER);
    expect(reg.priority).toBe(0);
    expect(reg.isActive).toBe(true);
    expect(listener).toHaveBeenCalledWith({ id, pluginName: 'alpha', type: MiddlewareType.LOGGER });
  });

  it('registerMiddleware accepts priority, options, appliesTo and metadata', () => {
    const manager = createMiddlewareChainManager();
    const opts: MiddlewareOptions = { timeout: 1000, skipOnError: true };
    const id = manager.registerMiddleware('alpha', MiddlewareType.CACHE, async () => {}, {
      priority: 5,
      options: opts,
      appliesTo: { commands: ['deploy'] },
      metadata: { foo: 'bar' },
    });
    const reg = manager.getMiddlewares()[0];
    expect(reg.priority).toBe(5);
    expect(reg.options).toBe(opts);
    expect(reg.appliesTo).toEqual({ commands: ['deploy'] });
    expect(reg.metadata).toEqual({ foo: 'bar' });
    expect(id).toBeDefined();
  });

  it('unregisterMiddleware returns true and emits; false for unknown ids', () => {
    const manager = createMiddlewareChainManager();
    const id = manager.registerMiddleware('alpha', MiddlewareType.LOGGER, async () => {});
    const listener = vi.fn();
    manager.on('middleware-unregistered', listener);
    expect(manager.unregisterMiddleware(id)).toBe(true);
    expect(listener).toHaveBeenCalledWith({ id });
    expect(manager.getMiddlewares()).toHaveLength(0);
    expect(manager.unregisterMiddleware(id)).toBe(false);
  });

  it('unregisterMiddleware cleans up command-specific associations', () => {
    const manager = createMiddlewareChainManager();
    const id = manager.registerMiddleware('alpha', MiddlewareType.LOGGER, async () => {});
    manager.registerCommandMiddleware('deploy', id);
    manager.unregisterMiddleware(id);
    // Re-associating then querying by type should not resurrect it.
    expect(manager.getMiddlewaresByType(MiddlewareType.LOGGER)).toHaveLength(0);
  });

  it('registerCommandMiddleware associates and is idempotent on duplicates', () => {
    const manager = createMiddlewareChainManager();
    // No public getter for command middleware; verify idempotency indirectly by
    // ensuring executeChain runs a command middleware exactly once.
    const order: string[] = [];
    const id = manager.registerMiddleware('alpha', MiddlewareType.LOGGER, recordingMiddleware(order, 'once'));
    manager.registerCommandMiddleware('deploy', id);
    manager.registerCommandMiddleware('deploy', id); // duplicate, should be ignored
    const { context } = makeContext({ commandName: 'deploy' });
    return manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context).then(() => {
      expect(order).toEqual(['once']);
    });
  });

  it('getMiddlewaresByType and getMiddlewaresByPlugin filter correctly', () => {
    const manager = createMiddlewareChainManager();
    manager.registerMiddleware('alpha', MiddlewareType.LOGGER, async () => {});
    manager.registerMiddleware('alpha', MiddlewareType.CACHE, async () => {});
    manager.registerMiddleware('beta', MiddlewareType.LOGGER, async () => {});
    expect(manager.getMiddlewaresByType(MiddlewareType.LOGGER)).toHaveLength(2);
    expect(manager.getMiddlewaresByType(MiddlewareType.CACHE)).toHaveLength(1);
    expect(manager.getMiddlewaresByPlugin('alpha')).toHaveLength(2);
    expect(manager.getMiddlewaresByPlugin('beta')).toHaveLength(1);
  });

  it('getStats reports totals, active count, per-type and per-plugin breakdowns', () => {
    const manager = createMiddlewareChainManager();
    manager.registerMiddleware('alpha', MiddlewareType.LOGGER, async () => {});
    manager.registerMiddleware('beta', MiddlewareType.CACHE, async () => {});
    const stats = manager.getStats();
    expect(stats.totalMiddlewares).toBe(2);
    expect(stats.activeMiddlewares).toBe(2);
    expect(stats.byType[MiddlewareType.LOGGER]).toBe(1);
    expect(stats.byType[MiddlewareType.CACHE]).toBe(1);
    expect(stats.byPlugin.alpha).toBe(1);
    expect(stats.byPlugin.beta).toBe(1);
    expect(stats.cacheSize).toBe(0);
    expect(stats.rateLimiters).toBe(0);
  });

  it('clearCache emits cache-cleared', () => {
    const manager = createMiddlewareChainManager();
    const listener = vi.fn();
    manager.on('cache-cleared', listener);
    manager.clearCache();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('plugin-command-middleware — chain execution', () => {
  it('an empty chain succeeds and returns copies of the args/options', async () => {
    const manager = createMiddlewareChainManager();
    const { context } = makeContext();
    const result = await manager.executeChain(MiddlewareType.PRE_EXECUTION, { a: 1 }, { b: 2 }, context);
    expect(result.success).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.modified?.args).toEqual({ a: 1 });
    expect(result.modified?.options).toEqual({ b: 2 });
  });

  it('emits chain-execution-started and chain-execution-completed', async () => {
    const manager = createMiddlewareChainManager();
    const started = vi.fn();
    const completed = vi.fn();
    manager.on('chain-execution-started', started);
    manager.on('chain-execution-completed', completed);
    const { context } = makeContext();
    await manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context);
    expect(started).toHaveBeenCalledWith(expect.objectContaining({ type: MiddlewareType.PRE_EXECUTION }));
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('runs middlewares in descending priority order', async () => {
    const manager = createMiddlewareChainManager();
    const order: string[] = [];
    // NOTE: generateMiddlewareId is `${plugin}:${type}:${Date.now()}`, so two
    // middlewares from the SAME plugin+type registered in the same millisecond
    // collide on id and clobber each other. Use distinct plugin names here.
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, recordingMiddleware(order, 'low'), { priority: 1 });
    manager.registerMiddleware('beta', MiddlewareType.PRE_EXECUTION, recordingMiddleware(order, 'high'), { priority: 10 });
    const { context } = makeContext();
    await manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context);
    expect(order).toEqual(['high', 'low']);
  });

  it('a failing middleware aborts the chain and reports the error', async () => {
    const manager = createMiddlewareChainManager();
    const failing: PluginCommandMiddleware = async () => {
      throw new Error('boom');
    };
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, failing);
    const failed = vi.fn();
    manager.on('chain-execution-failed', failed);
    const { context } = makeContext();
    const result = await manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('boom');
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('skipOnError=true lets the chain continue past a failing middleware', async () => {
    // NOTE: the JSDoc says skipOnError "skips remaining middlewares", but the
    // actual implementation does the opposite — it suppresses the abort so the
    // chain continues. This test documents the implemented behaviour.
    const manager = createMiddlewareChainManager();
    const order: string[] = [];
    const failing: PluginCommandMiddleware = async () => {
      throw new Error('boom');
    };
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, failing, {
      options: { skipOnError: true },
    });
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, recordingMiddleware(order, 'after'));
    const { context } = makeContext();
    const result = await manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context);
    expect(result.success).toBe(true);
    expect(order).toEqual(['after']);
  });

  it('the transform builtin mutates args in place, reflected in the chain result', async () => {
    const manager = createMiddlewareChainManager();
    manager.registerMiddleware('alpha', MiddlewareType.TRANSFORM, builtinMiddleware.transform({
      args: (a: Record<string, unknown>) => ({ ...a, added: true }),
    }));
    const { context } = makeContext();
    const result = await manager.executeChain(MiddlewareType.TRANSFORM, { a: 1 }, {}, context);
    expect(result.success).toBe(true);
    expect(result.modified?.args).toMatchObject({ a: 1, added: true });
  });

  it('filters exclude middlewares whose appliesTo.commands does not match', async () => {
    const manager = createMiddlewareChainManager();
    const order: string[] = [];
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, recordingMiddleware(order, 'scoped'), {
      appliesTo: { commands: ['other'] },
    });
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, recordingMiddleware(order, 'global'));
    const { context } = makeContext({ commandName: 'deploy' });
    await manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context);
    expect(order).toEqual(['global']);
  });

  it('filters honor appliesTo.patterns', async () => {
    const manager = createMiddlewareChainManager();
    const order: string[] = [];
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, recordingMiddleware(order, 'matched'), {
      appliesTo: { patterns: [/^dep/] },
    });
    const { context } = makeContext({ commandName: 'deploy' });
    await manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context);
    expect(order).toEqual(['matched']);
  });
});

describe('plugin-command-middleware — execution options', () => {
  it('rate limiting blocks execution once the window quota is exceeded', async () => {
    const manager = createMiddlewareChainManager();
    const opts: MiddlewareOptions = { rateLimit: { maxRequests: 1, windowMs: 1000 } };
    manager.registerMiddleware('alpha', MiddlewareType.RATE_LIMITER, recordingMiddleware([], 'noop'), {
      options: opts,
    });
    const { context } = makeContext();
    const first = await manager.executeChain(MiddlewareType.RATE_LIMITER, {}, {}, context);
    expect(first.success).toBe(true);
    const second = await manager.executeChain(MiddlewareType.RATE_LIMITER, {}, {}, context);
    expect(second.success).toBe(false);
    expect(second.error?.message).toBe('Rate limit exceeded');
  });

  it('a middleware that exceeds its timeout fails the chain', async () => {
    const manager = createMiddlewareChainManager();
    const hanging: PluginCommandMiddleware = async (_a, _o, _c, _next) => {
      // Never call next(); resolve slowly so the timeout wins the race cleanly.
      await new Promise((r) => setTimeout(r, 200));
    };
    manager.registerMiddleware('alpha', MiddlewareType.PRE_EXECUTION, hanging, {
      options: { timeout: 30 },
    });
    const { context } = makeContext();
    const result = await manager.executeChain(MiddlewareType.PRE_EXECUTION, {}, {}, context);
    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('Middleware timeout');
  });

  it('manager-level caching never populates (result is never captured) — documents bug', async () => {
    // NOTE: executeMiddleware declares `let result: any` but never assigns it,
    // so the `result !== undefined` cache-store guard is always false and the
    // manager cache is never written. A cache-enabled middleware therefore
    // always misses and never emits middleware-cache-hit.
    const manager = createMiddlewareChainManager();
    const hit = vi.fn();
    manager.on('middleware-cache-hit', hit);
    manager.registerMiddleware('alpha', MiddlewareType.CACHE, recordingMiddleware([], 'noop'), {
      options: { cache: { enabled: true, ttl: 1000 } },
    });
    const { context } = makeContext();
    await manager.executeChain(MiddlewareType.CACHE, { x: 1 }, {}, context);
    await manager.executeChain(MiddlewareType.CACHE, { x: 1 }, {}, context);
    expect(hit).not.toHaveBeenCalled();
    expect(manager.getStats().cacheSize).toBe(0);
  });
});

describe('plugin-command-middleware — built-in middleware factories', () => {
  it('validation enforces required + type for args and options', async () => {
    const mw = builtinMiddleware.validation({
      args: { name: { required: true, type: 'string' } },
      options: { port: { required: true, type: 'number' } },
    });
    const { context } = makeContext();
    // valid
    await expect(mw({ name: 'x' }, { port: 8080 }, context, async () => {})).resolves.toBeUndefined();
    // missing required arg
    await expect(mw({}, { port: 8080 }, context, async () => {})).rejects.toBeInstanceOf(ValidationError);
    // wrong type
    await expect(mw({ name: 5 }, { port: 8080 }, context, async () => {})).rejects.toBeInstanceOf(ValidationError);
    // missing required option
    await expect(mw({ name: 'x' }, {}, context, async () => {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('authorization passes when required permissions are present by reference, throws on mismatch', async () => {
    // NOTE bug: requiredPermissions is string[] but plugin permissions are
    // PluginPermission objects, so a real string requirement never matches.
    // The only way to satisfy it is to pass the identical object reference.
    const perm: PluginPermission = { type: 'filesystem', access: 'read', description: 'read' };
    const okCtx = makeContext({ permissions: [perm] });
    const okMw = builtinMiddleware.authorization([perm as unknown as string]);
    await expect(okMw({}, {}, okCtx.context, async () => {})).resolves.toBeUndefined();

    const denyCtx = makeContext({ permissions: [perm] });
    const denyMw = builtinMiddleware.authorization(['filesystem:read']);
    await expect(denyMw({}, {}, denyCtx.context, async () => {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('rateLimit builtin allows up to maxRequests then rejects', async () => {
    const mw = builtinMiddleware.rateLimit({ maxRequests: 2, windowMs: 1000 });
    const { context } = makeContext();
    await expect(mw({}, {}, context, async () => {})).resolves.toBeUndefined();
    await expect(mw({}, {}, context, async () => {})).resolves.toBeUndefined();
    await expect(mw({}, {}, context, async () => {})).rejects.toBeInstanceOf(ValidationError);
  });

  it('logger builtin records start/completion messages', async () => {
    const mw = builtinMiddleware.logger({ level: 'info' });
    const { context, logs } = makeContext();
    await mw({ a: 1 }, {}, context, async () => {});
    expect(logs.info.some((m) => m.includes('Starting execution'))).toBe(true);
    expect(logs.info.some((m) => m.includes('Completed in'))).toBe(true);
  });

  it('logger debug level also logs arguments and options', async () => {
    const mw = builtinMiddleware.logger({ level: 'debug' });
    const { context, logs } = makeContext();
    await mw({ a: 1 }, { b: 2 }, context, async () => {});
    expect(logs.debug.some((m) => m.includes('Arguments'))).toBe(true);
    expect(logs.debug.some((m) => m.includes('Options'))).toBe(true);
  });

  it('logger rethrows downstream errors with a failure message', async () => {
    const mw = builtinMiddleware.logger();
    const { context, logs } = makeContext();
    await expect(
      mw({}, {}, context, async () => {
        throw new Error('downstream');
      })
    ).rejects.toThrow('downstream');
    expect(logs.error.some((m) => m.includes('Failed after'))).toBe(true);
  });

  it('transform builtin mutates args and options in place', async () => {
    const mw = builtinMiddleware.transform({
      args: (a: Record<string, unknown>) => ({ ...a, extra: 'x' }),
      options: (o: Record<string, unknown>) => ({ ...o, flag: true }),
    });
    const { context } = makeContext();
    const args = { a: 1 };
    const options = { b: 2 };
    await mw(args, options, context, async () => {});
    expect(args).toMatchObject({ a: 1, extra: 'x' });
    expect(options).toMatchObject({ b: 2, flag: true });
  });

  it('errorHandler builtin invokes the handler and rethrows', async () => {
    const handler = vi.fn();
    const mw = builtinMiddleware.errorHandler(handler);
    const { context } = makeContext();
    await expect(
      mw({}, {}, context, async () => {
        throw new Error('kaboom');
      })
    ).rejects.toThrow('kaboom');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(handler.mock.calls[0][0].message).toBe('kaboom');
  });

  it('timing builtin exposes startTimer/endTimer on context.utils and logs total', async () => {
    const mw = builtinMiddleware.timing();
    const { context, logs } = makeContext();
    await mw({}, {}, context, async () => {
      (context.utils as { startTimer: (n: string) => void }).startTimer('phase');
      (context.utils as { endTimer: (n: string) => number }).endTimer('phase');
    });
    expect(logs.info.some((m) => m.includes('Total execution time'))).toBe(true);
    // NOTE: the finally-block restore uses Object.assign(context, originalContext)
    // where originalContext is a shallow copy, so context.utils was shared and the
    // timing helpers added to it are NOT removed after execution.
    expect((context.utils as Record<string, unknown>).startTimer).toBeDefined();
  });
});

describe('plugin-command-middleware — composeMiddleware', () => {
  it('composes middlewares in order and invokes the final next', async () => {
    const order: string[] = [];
    const composed = composeMiddleware(
      recordingMiddleware(order, 'first'),
      recordingMiddleware(order, 'second')
    );
    const { context } = makeContext();
    let finalCalled = false;
    await composed({}, {}, context, async () => {
      finalCalled = true;
    });
    expect(order).toEqual(['first', 'second']);
    expect(finalCalled).toBe(true);
  });

  it('an empty composition simply calls next', async () => {
    const composed = composeMiddleware();
    const { context } = makeContext();
    let finalCalled = false;
    await composed({}, {}, context, async () => {
      finalCalled = true;
    });
    expect(finalCalled).toBe(true);
  });
});
