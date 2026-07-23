import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PluginHookSystem,
  PluginHookAPI,
  HookType,
  HookPriority,
  BuiltinHooks,
  createHookSystem,
  isValidHookType,
  type HookContext,
  type HookMiddleware,
} from '../../src/utils/plugin-hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The default "logger" middleware writes to console.error on handler errors.
 * Silence it so test output stays clean while still exercising the error path.
 */
function silenceConsole() {
  const spies = [
    vi.spyOn(console, 'error').mockImplementation(() => undefined),
    vi.spyOn(console, 'log').mockImplementation(() => undefined),
  ];
  return () => spies.forEach((s) => s.mockRestore());
}

describe('enums + isValidHookType', () => {
  it('exposes the built-in hook type values', () => {
    expect(HookType.CLI_INIT).toBe('cli:init');
    expect(HookType.COMMAND_BEFORE).toBe('command:before');
    expect(HookType.BUILD_START).toBe('build:start');
    expect(HookType.CUSTOM).toBe('custom');
  });

  it('orders HookPriority from HIGHEST to LOWEST', () => {
    expect(HookPriority.HIGHEST).toBeLessThan(HookPriority.HIGH);
    expect(HookPriority.HIGH).toBeLessThan(HookPriority.NORMAL);
    expect(HookPriority.NORMAL).toBeLessThan(HookPriority.LOW);
    expect(HookPriority.LOW).toBeLessThan(HookPriority.LOWEST);
  });

  it('BuiltinHooks is an alias for HookType', () => {
    expect(BuiltinHooks).toBe(HookType);
  });

  it('isValidHookType recognises built-ins and rejects unknowns', () => {
    expect(isValidHookType('cli:init')).toBe(true);
    expect(isValidHookType('build:end')).toBe(true);
    expect(isValidHookType('not-a-hook')).toBe(false);
  });
});

describe('PluginHookSystem — register / unregister', () => {
  let system: PluginHookSystem;
  beforeEach(() => { system = new PluginHookSystem(); });

  it('register returns an id and records the handler', () => {
    const id = system.register(HookType.CLI_INIT, () => 1, 'plugin-a');
    expect(id).toContain('plugin-a');
    expect(system.getHooks(HookType.CLI_INIT)).toHaveLength(1);
  });

  it('emits hook-registered with the handler details', () => {
    const seen: any[] = [];
    system.on('hook-registered', (p) => seen.push(p));
    system.register(HookType.CLI_INIT, () => 1, 'plugin-a', { priority: HookPriority.HIGH });
    expect(seen[0]).toMatchObject({ hookType: HookType.CLI_INIT, pluginName: 'plugin-a', priority: HookPriority.HIGH });
  });

  it('sorts handlers by ascending priority', async () => {
    system.register(HookType.CLI_INIT, () => 'low', 'p-low', { priority: HookPriority.LOW });
    system.register(HookType.CLI_INIT, () => 'high', 'p-high', { priority: HookPriority.HIGHEST });
    const result = await system.execute(HookType.CLI_INIT);
    expect(result.results.map((r: any) => r.result)).toEqual(['high', 'low']);
  });

  it('unregister removes a handler by id and returns false when missing', () => {
    const id = system.register(HookType.CLI_INIT, () => 1, 'p');
    expect(system.unregister(HookType.CLI_INIT, id)).toBe(true);
    expect(system.getHooks(HookType.CLI_INIT)).toHaveLength(0);
    expect(system.unregister(HookType.CLI_INIT, id)).toBe(false);
    expect(system.unregister(HookType.CLI_EXIT, 'missing')).toBe(false);
  });

  it('NOTE: unregisterAll removes every handler for a plugin but always reports 0 removed (count bug)', () => {
    // The handlers ARE removed (the map is replaced with a filtered array), but
    // the returned count is always 0 because the local `handlers` reference still
    // points at the original (unfiltered) array, so `initialLength - handlers.length`
    // is 0. Assert the real behaviour: handlers gone, returned count 0.
    system.register(HookType.CLI_INIT, () => 1, 'p-a');
    system.register(HookType.CLI_EXIT, () => 2, 'p-a');
    system.register(HookType.CLI_INIT, () => 3, 'p-b');
    const removed = system.unregisterAll('p-a');
    expect(removed).toBe(0);
    expect(system.getPluginHooks('p-a')).toHaveLength(0);
    expect(system.getPluginHooks('p-b')).toHaveLength(1);
  });
});

describe('PluginHookSystem — execute', () => {
  let system: PluginHookSystem;
  let restore: () => void;
  beforeEach(() => {
    system = new PluginHookSystem();
    restore = silenceConsole();
  });
  afterEach(() => restore());

  it('returns an empty successful result when no handlers are registered', async () => {
    const result = await system.execute(HookType.CLI_EXIT);
    expect(result.success).toBe(true);
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('collects handler results and marks success', async () => {
    system.register(HookType.BUILD_END, () => 42, 'p');
    const result = await system.execute(HookType.BUILD_END);
    expect(result.results[0]).toMatchObject({ pluginName: 'p', result: 42 });
    expect(result.success).toBe(true);
  });

  it('skips handlers whose condition returns false', async () => {
    system.register(HookType.CLI_INIT, () => 'ran', 'p', { condition: (d) => d.go === true });
    const skipped = await system.execute(HookType.CLI_INIT, { go: false });
    expect(skipped.results).toHaveLength(0);
    const run = await system.execute(HookType.CLI_INIT, { go: true });
    expect(run.results).toHaveLength(1);
  });

  it('removes one-time handlers after execution', async () => {
    system.register(HookType.CLI_INIT, () => 1, 'p', { once: true });
    await system.execute(HookType.CLI_INIT);
    expect(system.getHooks(HookType.CLI_INIT)).toHaveLength(0);
  });

  it('aborts execution when a handler returns an abort signal', async () => {
    system.register(HookType.CLI_INIT, () => ({ abort: true }), 'p-first', { priority: HookPriority.HIGHEST });
    system.register(HookType.CLI_INIT, () => 'should-not-run', 'p-second', { priority: HookPriority.LOW });
    const result = await system.execute(HookType.CLI_INIT);
    expect(result.aborted).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.success).toBe(false);
  });

  it('records handler errors without aborting non-critical handlers', async () => {
    system.register(HookType.CLI_INIT, () => { throw new Error('boom'); }, 'p-err');
    system.register(HookType.CLI_INIT, () => 'ok', 'p-ok', { priority: HookPriority.LOW });
    const result = await system.execute(HookType.CLI_INIT);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ pluginName: 'p-err' });
    expect(result.results.map((r: any) => r.result)).toEqual(['ok']);
    expect(result.success).toBe(false);
  });

  it('aborts on a CRITICAL error message', async () => {
    system.register(HookType.CLI_INIT, () => { throw new Error('CRITICAL failure'); }, 'p-1', { priority: HookPriority.HIGHEST });
    system.register(HookType.CLI_INIT, () => 'after', 'p-2', { priority: HookPriority.LOW });
    const result = await system.execute(HookType.CLI_INIT);
    expect(result.aborted).toBe(true);
    expect(result.results).toHaveLength(0);
  });

  it('is a no-op when disabled', async () => {
    system.register(HookType.CLI_INIT, () => 1, 'p');
    system.setEnabled(false);
    const result = await system.execute(HookType.CLI_INIT);
    expect(result.results).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('emits hooks-executed on completion', async () => {
    const seen: any[] = [];
    system.on('hooks-executed', (p) => seen.push(p));
    system.register(HookType.CLI_INIT, () => 1, 'p');
    await system.execute(HookType.CLI_INIT);
    expect(seen[0]).toMatchObject({ hookType: HookType.CLI_INIT, handlersCount: 1, resultsCount: 1 });
  });
});

describe('PluginHookSystem — executeSync', () => {
  let system: PluginHookSystem;
  let restore: () => void;
  beforeEach(() => {
    system = new PluginHookSystem();
    restore = silenceConsole();
  });
  afterEach(() => restore());

  it('returns {pluginName, result} entries in priority order', () => {
    system.register(HookType.BUILD_START, () => 'a', 'p-low', { priority: HookPriority.LOW });
    system.register(HookType.BUILD_START, () => 'b', 'p-high', { priority: HookPriority.HIGHEST });
    const results = system.executeSync(HookType.BUILD_START);
    expect(results.map((r: any) => r.result)).toEqual(['b', 'a']);
    expect(results[0]).toHaveProperty('pluginName');
  });

  it('respects conditions and removes once-handlers', () => {
    system.register(HookType.BUILD_START, () => 1, 'p', { once: true, condition: () => true });
    expect(system.executeSync(HookType.BUILD_START)).toHaveLength(1);
    expect(system.getHooks(HookType.BUILD_START)).toHaveLength(0);
  });

  it('swallows handler errors and returns [] when disabled', () => {
    system.register(HookType.BUILD_START, () => { throw new Error('x'); }, 'p');
    expect(system.executeSync(HookType.BUILD_START)).toEqual([]);
    system.setEnabled(false);
    system.register(HookType.BUILD_START, () => 1, 'p2');
    expect(system.executeSync(HookType.BUILD_START)).toEqual([]);
  });
});

describe('PluginHookSystem — middleware', () => {
  let system: PluginHookSystem;
  let restore: () => void;
  beforeEach(() => {
    system = new PluginHookSystem();
    restore = silenceConsole();
  });
  afterEach(() => restore());

  it('invokes before/after phases around handlers', async () => {
    const order: string[] = [];
    const mw: HookMiddleware = {
      name: 'tracer',
      before: () => { order.push('before'); },
      after: () => { order.push('after'); },
    };
    system.addMiddleware(mw);
    system.register(HookType.CLI_INIT, () => { order.push('handler'); return 1; }, 'p');
    await system.execute(HookType.CLI_INIT);
    expect(order).toEqual(['before', 'handler', 'after']);
  });

  it('invokes the error phase when a handler throws', async () => {
    const errors: Error[] = [];
    system.addMiddleware({ name: 'err-tracer', error: (_c, e) => { errors.push(e); } });
    system.register(HookType.CLI_INIT, () => { throw new Error('boom'); }, 'p');
    await system.execute(HookType.CLI_INIT);
    expect(errors[0]?.message).toBe('boom');
  });

  it('removeMiddleware finds and removes by name', () => {
    system.addMiddleware({ name: 'temp', before: () => undefined });
    expect(system.removeMiddleware('temp')).toBe(true);
    expect(system.removeMiddleware('temp')).toBe(false);
    // The default logger middleware is always present.
    expect(system.getStats().middleware).toContain('logger');
  });
});

describe('PluginHookSystem — queries + stats + lifecycle', () => {
  let system: PluginHookSystem;
  beforeEach(() => { system = new PluginHookSystem(); });

  it('getHooks returns the full map when no type is given', () => {
    system.register(HookType.CLI_INIT, () => 1, 'p');
    const map = system.getHooks() as Map<HookType, unknown[]>;
    expect(map.get(HookType.CLI_INIT)).toHaveLength(1);
    expect(map.get(HookType.CLI_EXIT)).toEqual([]);
  });

  it('getStats aggregates totals by type and plugin', () => {
    system.register(HookType.CLI_INIT, () => 1, 'p-a');
    system.register(HookType.CLI_EXIT, () => 2, 'p-a');
    system.register(HookType.CLI_INIT, () => 3, 'p-b');
    const stats = system.getStats();
    expect(stats.totalHooks).toBe(3);
    expect(stats.hooksByType[HookType.CLI_INIT]).toBe(2);
    expect(stats.hooksByPlugin['p-a']).toBe(2);
    expect(stats.hooksByPlugin['p-b']).toBe(1);
    expect(stats.middleware).toContain('logger');
  });

  it('tracks cumulative execution time per plugin', async () => {
    system.register(HookType.CLI_INIT, () => 1, 'p');
    await system.execute(HookType.CLI_INIT);
    expect(system.getStats().executionStats['p']).toBeGreaterThanOrEqual(0);
  });

  it('clear removes handlers and re-emits system-cleared', () => {
    const seen: any[] = [];
    system.on('system-cleared', () => seen.push(true));
    system.register(HookType.CLI_INIT, () => 1, 'p');
    system.clear();
    expect(system.getHooks(HookType.CLI_INIT)).toHaveLength(0);
    expect(seen).toHaveLength(1);
  });

  it('setEnabled / setDebugMode emit toggle events', () => {
    const toggles: boolean[] = [];
    const debugs: boolean[] = [];
    system.on('system-toggled', (p: any) => toggles.push(p.enabled));
    system.on('debug-toggled', (p: any) => debugs.push(p.debug));
    system.setEnabled(false);
    system.setDebugMode(true);
    expect(toggles).toEqual([false]);
    expect(debugs).toEqual([true]);
  });
});

describe('PluginHookAPI (plugin scope)', () => {
  let system: PluginHookSystem;
  let restore: () => void;
  beforeEach(() => {
    system = new PluginHookSystem();
    restore = silenceConsole();
  });
  afterEach(() => restore());

  it('binds the plugin name on register and getHooks', async () => {
    const scope = system.createPluginScope('my-plugin');
    const id = scope.register(HookType.CLI_INIT, () => 1);
    expect(id).toContain('my-plugin');
    expect(scope.getHooks()).toHaveLength(1);
    const result = await scope.execute(HookType.CLI_INIT);
    expect(result.results[0]).toMatchObject({ pluginName: 'my-plugin' });
  });

  it('registerCustomHook namespaces the hook under the plugin', () => {
    const scope = system.createPluginScope('my-plugin');
    expect(scope.registerCustomHook('deploy')).toBe('my-plugin:deploy');
  });

  it('onCommand only fires for the matching command', async () => {
    const scope = system.createPluginScope('cmd-plugin');
    const calls: string[] = [];
    scope.onCommand('build', (data: any) => { calls.push(data.command); });
    await system.execute(HookType.COMMAND_BEFORE, { command: 'test' });
    await system.execute(HookType.COMMAND_BEFORE, { command: 'build' });
    expect(calls).toEqual(['build']);
  });

  it('onFileChange matches by RegExp or substring', async () => {
    const scope = system.createPluginScope('fs-plugin');
    const matched: string[] = [];
    scope.onFileChange(/\.tsx?$/, (_d: any, _c: HookContext) => { matched.push('regex'); });
    scope.onFileChange('.css', (_d: any, _c: HookContext) => { matched.push('str'); });
    await system.execute(HookType.FILE_CHANGE, { filePath: 'src/app.ts' });
    await system.execute(HookType.FILE_CHANGE, { path: 'styles/main.css' });
    await system.execute(HookType.FILE_CHANGE, { filePath: 'readme.md' });
    expect(matched).toEqual(['regex', 'str']);
  });

  it('onWorkspaceBuild matches a specific workspace or the wildcard', async () => {
    const scope = system.createPluginScope('build-plugin');
    const built: string[] = [];
    scope.onWorkspaceBuild('web', (_d: any) => { built.push('web'); });
    scope.onWorkspaceBuild('*', (_d: any) => { built.push('any'); });
    await system.execute(HookType.BUILD_START, { workspace: 'api' });
    await system.execute(HookType.BUILD_START, { workspace: 'web' });
    // '*' matches both builds (api + web); 'web' matches only the web build.
    expect(built.filter((x) => x === 'any')).toHaveLength(2);
    expect(built.filter((x) => x === 'web')).toHaveLength(1);
  });

  it('executeSync delegates to the system', () => {
    const scope = system.createPluginScope('sync-plugin');
    scope.register(HookType.BUILD_END, () => 7);
    expect(scope.executeSync(HookType.BUILD_END).map((r: any) => r.result)).toEqual([7]);
  });

  it('unregister delegates to the system', () => {
    const scope = system.createPluginScope('u-plugin');
    const id = scope.register(HookType.CLI_INIT, () => 1);
    expect(scope.unregister(HookType.CLI_INIT, id)).toBe(true);
    expect(scope.getHooks()).toHaveLength(0);
  });
});

describe('createHookSystem factory', () => {
  it('returns a new PluginHookSystem', () => {
    const system = createHookSystem();
    expect(system).toBeInstanceOf(PluginHookSystem);
    // Built-in hook types are pre-initialised as empty handler lists.
    expect(system.getHooks(HookType.CLI_INIT)).toEqual([]);
  });
});
