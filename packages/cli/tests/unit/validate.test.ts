import { describe, it, expect, beforeEach, vi } from 'vitest';

// The validate command orchestrates config loading, schema validation, prompts,
// and console output. We mock its three dependencies so the dispatch logic,
// output formatting, and error handling can be exercised deterministically.

const validResult = { valid: true, errors: [], warnings: [], suggestions: [] };
const invalidResult = {
  valid: false,
  errors: [
    { field: 'name', message: 'required', severity: 'error' },
    { field: 'port', message: 'out of range', severity: 'warning' },
  ],
  warnings: [],
  suggestions: [],
};

vi.mock('../../src/utils/validation', () => ({
  validateConfigFile: vi.fn(),
  validateGlobalConfig: vi.fn(),
  validateProjectConfig: vi.fn(),
}));

vi.mock('../../src/utils/config', () => ({
  configManager: {
    loadGlobalConfig: vi.fn(),
    loadProjectConfig: vi.fn(),
  },
}));

vi.mock('prompts', () => ({ default: vi.fn() }));

import { validateConfiguration } from '../../src/commands/validate';
import { validateConfigFile, validateGlobalConfig, validateProjectConfig } from '../../src/utils/validation';
import { configManager } from '../../src/utils/config';
import prompts from 'prompts';

const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(validateConfigFile).mockResolvedValue(validResult as never);
  vi.mocked(validateGlobalConfig).mockReturnValue(validResult as never);
  vi.mocked(validateProjectConfig).mockReturnValue(validResult as never);
  vi.mocked(configManager.loadGlobalConfig).mockResolvedValue({ version: '1' } as never);
  vi.mocked(configManager.loadProjectConfig).mockResolvedValue({ name: 'p' } as never);
});

describe('validateConfiguration — dispatch precedence', () => {
  it('routes to file validation when options.file is set', async () => {
    await validateConfiguration({ file: '/some/path.json', json: true });
    expect(validateConfigFile).toHaveBeenCalledWith('/some/path.json', expect.any(String));
    expect(validateGlobalConfig).not.toHaveBeenCalled();
  });

  it('routes to global validation when options.global is set (and no file)', async () => {
    await validateConfiguration({ global: true, json: true });
    expect(configManager.loadGlobalConfig).toHaveBeenCalled();
    expect(validateGlobalConfig).toHaveBeenCalled();
    expect(validateProjectConfig).not.toHaveBeenCalled();
  });

  it('routes to project validation when options.project is set', async () => {
    await validateConfiguration({ project: true, json: true });
    expect(configManager.loadProjectConfig).toHaveBeenCalled();
    expect(validateProjectConfig).toHaveBeenCalled();
  });

  it('routes to interactive validation when options.interactive is set', async () => {
    vi.mocked(prompts).mockResolvedValue({ action: '' } as never);
    await validateConfiguration({ interactive: true });
    expect(prompts).toHaveBeenCalled();
  });

  it('file takes precedence over global/project/interactive', async () => {
    await validateConfiguration({ file: '/a.json', global: true, project: true, interactive: true, json: true });
    expect(validateConfigFile).toHaveBeenCalled();
    expect(validateGlobalConfig).not.toHaveBeenCalled();
    expect(validateProjectConfig).not.toHaveBeenCalled();
    expect(prompts).not.toHaveBeenCalled();
  });

  it('validates both global and project by default', async () => {
    await validateConfiguration({ json: true });
    expect(validateGlobalConfig).toHaveBeenCalled();
    expect(validateProjectConfig).toHaveBeenCalled();
  });
});

describe('validateConfiguration — JSON output', () => {
  it('prints the file result as JSON when options.json is set', async () => {
    await validateConfiguration({ file: '/a.json', json: true });
    const printed = JSON.parse(log.mock.calls[0][0] as string);
    expect(printed).toEqual(validResult);
  });

  it('prints combined global+project results as JSON in default mode', async () => {
    await validateConfiguration({ json: true });
    const printed = JSON.parse(log.mock.calls[0][0] as string);
    expect(printed.global).toEqual(validResult);
    expect(printed.project).toEqual(validResult);
  });

  it('includes a null project result when no project config exists', async () => {
    vi.mocked(configManager.loadProjectConfig).mockResolvedValue(null as never);
    await validateConfiguration({ json: true });
    const printed = JSON.parse(log.mock.calls[0][0] as string);
    expect(printed.global).toEqual(validResult);
    expect(printed.project).toBeNull();
  });
});

describe('validateConfiguration — project path with no config', () => {
  it('prints a "No project configuration found" notice and skips validation', async () => {
    vi.mocked(configManager.loadProjectConfig).mockResolvedValue(null as never);
    await validateConfiguration({ project: true });
    expect(validateProjectConfig).not.toHaveBeenCalled();
    expect(log.mock.calls.some(c => String(c[0]).includes('No project configuration found'))).toBe(true);
  });
});

describe('validateConfiguration — configType classification (file path heuristic)', () => {
  // validateSpecificFile infers the config schema type from the file path:
  //   includes('global') || includes('.re-shell/config') → 'project'
  //   otherwise → 'global'
  // NOTE: the 'global' branch returns 'project', which looks inverted — pinned here.

  it('classifies a "global"-named file as "project" (heuristic quirk)', async () => {
    await validateConfiguration({ file: '/app/.re-shell/global.yaml', json: true });
    expect(validateConfigFile).toHaveBeenCalledWith('/app/.re-shell/global.yaml', 'project');
  });

  it('classifies a ".re-shell/config" path as "project"', async () => {
    await validateConfiguration({ file: '/app/.re-shell/config.yaml', json: true });
    expect(validateConfigFile).toHaveBeenCalledWith('/app/.re-shell/config.yaml', 'project');
  });

  it('falls back to "global" for any other path', async () => {
    await validateConfiguration({ file: '/app/random.json', json: true });
    expect(validateConfigFile).toHaveBeenCalledWith('/app/random.json', 'global');
  });
});

describe('validateConfiguration — error handling', () => {
  it('calls spinner.fail and rethrows when validation throws', async () => {
    const spinner = { setText: vi.fn(), stop: vi.fn(), fail: vi.fn() };
    vi.mocked(validateConfigFile).mockRejectedValue(new Error('boom') as never);
    await expect(
      validateConfiguration({ file: '/a.json', spinner: spinner as never }),
    ).rejects.toThrow('boom');
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('rethrows without a spinner when none is provided', async () => {
    vi.mocked(validateGlobalConfig).mockImplementation(() => {
      throw new Error('kaboom');
    });
    await expect(validateConfiguration({ global: true })).rejects.toThrow('kaboom');
  });
});

describe('validateConfiguration — display output (non-JSON)', () => {
  it('renders an invalid result with error/warning lines', async () => {
    vi.mocked(validateGlobalConfig).mockReturnValue(invalidResult as never);
    vi.mocked(configManager.loadProjectConfig).mockResolvedValue(null as never);
    await validateConfiguration({ global: true });
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Invalid');
    expect(output).toContain('name: required');
  });

  it('renders a valid result with a Valid status', async () => {
    await validateConfiguration({ global: true });
    const output = log.mock.calls.map(c => String(c[0])).join('\n');
    expect(output).toContain('Valid');
  });
});
