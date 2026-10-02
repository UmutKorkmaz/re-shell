import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updatePlugins, validatePlugin } from '../../src/commands/plugin';
import { createPluginRegistry } from '../../src/utils/plugin-system';
import { createSpinner } from '../../src/utils/spinner';
import { createAsyncCommand } from '../../src/utils/error-handler';
import { isJsonModeActive } from '../../src/utils/json-output';
import { jsonResponseSchema } from '@re-shell/contracts';
import { z } from 'zod';

vi.mock('../../src/utils/plugin-system', () => ({ createPluginRegistry: vi.fn() }));
vi.mock('../../src/utils/spinner', () => ({ createSpinner: vi.fn() }));

describe('unimplemented plugin actions', () => {
  let stdout: string;
  let stderr: string;
  const registry = {
    initialize: vi.fn(),
    getPlugins: vi.fn(() => [{ manifest: { name: 'installed-plugin', version: '1.0.0' } }]),
  };
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    stdout = '';
    stderr = '';
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(createPluginRegistry).mockReturnValue(registry as never);
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout += String(chunk);
      return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderr += String(chunk);
      return true;
    });
    vi.spyOn(console, 'error').mockImplementation((message: unknown) => {
      stderr += String(message) + '\n';
    });
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns one failing JSON envelope for update with populated registry', async () => {
    await updatePlugins({ json: true, verbose: true });

    const result = jsonResponseSchema(z.unknown()).parse(JSON.parse(stdout));
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'PLUGIN_UPDATE_ERROR', details: { status: 'not-implemented', operation: 'update' } },
    });
    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(stderr).toBe('');
    expect(process.exitCode).toBe(1);
    expect(createPluginRegistry).not.toHaveBeenCalled();
    expect(registry.initialize).not.toHaveBeenCalled();
    expect(createSpinner).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(isJsonModeActive()).toBe(false);
  });

  it.each(['/missing/plugin', '/invalid/plugin', ''])('never passes validation for target %j', async path => {
    await validatePlugin(path, { json: true, verbose: true });

    const result = jsonResponseSchema(z.unknown()).parse(JSON.parse(stdout));
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'PLUGIN_VALIDATE_ERROR', details: { status: 'not-implemented', path } },
    });
    expect(stdout.trim().split('\n')).toHaveLength(1);
    expect(process.exitCode).toBe(1);
    expect(createPluginRegistry).not.toHaveBeenCalled();
    expect(createSpinner).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(isJsonModeActive()).toBe(false);
  });

  it.each([
    ['update', () => updatePlugins()],
    ['validate', () => validatePlugin('/missing/plugin')],
  ] as const)('returns a human-mode failure through the command wrapper for %s', async (_operation, action) => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    await createAsyncCommand(action)();

    expect(exit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
    expect(stderr).toContain('not implemented');
    expect(stdout).toBe('');
    expect(createSpinner).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
