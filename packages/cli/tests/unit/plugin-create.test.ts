import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPluginCommand, validatePublish } from '../../src/commands/plugin-create';
import { ValidationError } from '../../src/utils/error-handler';
import * as wizard from '../../src/utils/plugin-wizard';
import * as scaffolder from '../../src/utils/plugin-scaffolder';
import * as publishValidator from '../../src/utils/plugin-publish-validator';
import * as jsonOutput from '../../src/utils/json-output';
import type { PublishValidationResult } from '../../src/utils/plugin-publish-validator';

// Covers src/commands/plugin-create.ts (147 lines) — the two `plugin create` /
// `plugin validate-publish` entry points. The wizard flag parser, scaffolder
// and publish validator have their own suites; here they are mocked so the
// command layer's JSON envelope, spinner lifecycle and human rendering are
// exercised in isolation.

const mocks = vi.hoisted(() => ({
  scaffold: vi.fn(),
  validatePluginForPublish: vi.fn(),
}));

vi.mock('../../src/utils/plugin-scaffolder', () => ({
  scaffold: mocks.scaffold,
}));
vi.mock('../../src/utils/plugin-publish-validator', () => ({
  validatePluginForPublish: mocks.validatePluginForPublish,
}));

const okSpy = vi.spyOn(jsonOutput, 'ok');
const failSpy = vi.spyOn(jsonOutput, 'fail');
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function scaffoldResult(): scaffolder.ScaffoldResult {
  return {
    pluginDir: '/mock-project/my-plugin',
    files: [
      { path: 'my-plugin/package.json', content: '{}' },
      { path: 'my-plugin/src/index.ts', content: 'export {};' },
    ],
  };
}

function publishResult(valid: boolean): PublishValidationResult {
  return {
    valid,
    errors: valid ? [] : [{ name: 'name-mismatch', message: 'package name mismatch' }],
    warnings: [{ name: 'no-license-file', message: 'LICENSE file missing' }],
    checks: [
      { name: 'manifest', message: 'manifest parses', passed: true },
      { name: 'name-mismatch', message: 'package name mismatch', passed: !valid },
    ],
  } as unknown as PublishValidationResult;
}

beforeEach(() => {
  vi.clearAllMocks();
  okSpy.mockClear();
  failSpy.mockClear();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe('createPluginCommand', () => {
  it('scaffolds with flag-derived config and reports the created files (json)', async () => {
    mocks.scaffold.mockResolvedValue(scaffoldResult());
    await createPluginCommand('my-plugin', { json: true, description: 'A test plugin' });

    expect(mocks.scaffold).toHaveBeenCalledTimes(1);
    const [config, cwd, opts] = mocks.scaffold.mock.calls[0];
    expect(config).toMatchObject({
      name: 'my-plugin',
      displayName: 'my-plugin',
      description: 'A test plugin',
      author: 'unknown',
      license: 'MIT',
      pluginType: 'both',
      frameworkTarget: 'universal',
      includeTests: true,
      includeCI: true,
    });
    expect(cwd).toBe(process.cwd());
    expect(opts).toEqual({ dryRun: false, force: false });
    expect(okSpy).toHaveBeenCalledWith({
      pluginDir: '/mock-project/my-plugin',
      files: ['my-plugin/package.json', 'my-plugin/src/index.ts'],
    });
  });

  it('validates the name through the wizard before scaffolding (json fail envelope)', async () => {
    await createPluginCommand('Bad_Name', { json: true, description: 'desc' });
    expect(failSpy).toHaveBeenCalledWith(
      'SCHEMA_VALIDATION_ERROR',
      expect.stringContaining('Invalid plugin name')
    );
    expect(mocks.scaffold).not.toHaveBeenCalled();
  });

  it('validates the name through the wizard before scaffolding (human rethrow)', async () => {
    await expect(
      createPluginCommand('Bad_Name', { description: 'desc' })
    ).rejects.toThrow(ValidationError);
    expect(mocks.scaffold).not.toHaveBeenCalled();
  });

  it('requires a description', async () => {
    await createPluginCommand('my-plugin', { json: true, description: '' });
    expect(failSpy).toHaveBeenCalledWith(
      'SCHEMA_VALIDATION_ERROR',
      'Missing required field: description. Use --description flag'
    );
    expect(mocks.scaffold).not.toHaveBeenCalled();
  });

  it('passes force and dryRun through to the scaffolder', async () => {
    mocks.scaffold.mockResolvedValue(scaffoldResult());
    await createPluginCommand('my-plugin', {
      json: true,
      description: 'd',
      force: true,
      dryRun: true,
    });
    expect(mocks.scaffold).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { dryRun: true, force: true }
    );
  });

  it('emits PLUGIN_INSTALL_ERROR json when the scaffolder rejects', async () => {
    mocks.scaffold.mockRejectedValue(new Error('disk full'));
    await createPluginCommand('my-plugin', { json: true, description: 'd' });
    expect(failSpy).toHaveBeenCalledWith('PLUGIN_INSTALL_ERROR', 'disk full');
  });

  it('maps ValidationError to SCHEMA_VALIDATION_ERROR in json mode', async () => {
    mocks.scaffold.mockRejectedValue(new ValidationError('bad hooks'));
    await createPluginCommand('my-plugin', { json: true, description: 'd' });
    expect(failSpy).toHaveBeenCalledWith('SCHEMA_VALIDATION_ERROR', 'bad hooks');
  });

  it('rethrows the original error in human mode', async () => {
    mocks.scaffold.mockRejectedValue(new Error('disk full'));
    await expect(
      createPluginCommand('my-plugin', { description: 'd' })
    ).rejects.toThrow('disk full');
  });

  it('lists the files that would be created on a human dry run', async () => {
    mocks.scaffold.mockResolvedValue(scaffoldResult());
    await createPluginCommand('my-plugin', { description: 'd', dryRun: true });

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Dry run - files that would be created');
    expect(out).toContain('my-plugin/package.json');
    expect(out).toContain('my-plugin/src/index.ts');
    expect(out).not.toContain('Plugin created successfully');
  });

  it('renders success output with location, file count and next steps', async () => {
    mocks.scaffold.mockResolvedValue(scaffoldResult());
    await createPluginCommand('my-plugin', { description: 'd' });

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Plugin created successfully: my-plugin');
    expect(out).toContain('Location: /mock-project/my-plugin');
    expect(out).toContain('Files: 2');
    expect(out).toContain('Next steps:');
    expect(out).toContain('cd my-plugin');
    expect(out).toContain('re-shell plugin validate-publish');
  });
});

describe('validatePublish', () => {
  it('returns the raw result and emits a json envelope', async () => {
    mocks.validatePluginForPublish.mockResolvedValue(publishResult(true));
    const result = await validatePublish('/tmp/my-plugin', { json: true });

    expect(mocks.validatePluginForPublish).toHaveBeenCalledWith('/tmp/my-plugin');
    expect(result.valid).toBe(true);
    expect(okSpy).toHaveBeenCalledWith({
      valid: true,
      errors: [],
      warnings: expect.any(Array),
    });
  });

  it('declares validity in human mode and lists errors with their rule names', async () => {
    mocks.validatePluginForPublish.mockResolvedValue(publishResult(false));
    await validatePublish('/tmp/my-plugin', {});

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Plugin validation failed');
    expect(out).toContain('Errors:');
    expect(out).toContain('[name-mismatch] package name mismatch');
    expect(out).toContain('Warnings:');
    expect(out).toContain('[no-license-file] LICENSE file missing');
  });

  it('prints the green validity banner when the plugin is publishable', async () => {
    mocks.validatePluginForPublish.mockResolvedValue(publishResult(true));
    await validatePublish('/tmp/my-plugin', {});

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Plugin is valid for publishing');
    // errors list is empty so no Errors: section renders
    expect(out).not.toContain('Errors:');
  });

  it('lists passed checks only in verbose mode', async () => {
    mocks.validatePluginForPublish.mockResolvedValue(publishResult(true));
    await validatePublish('/tmp/my-plugin', { verbose: true });

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Passed checks:');
    expect(out).toContain('[manifest] manifest parses');
  });

  it('omits the passed-checks section when not verbose', async () => {
    mocks.validatePluginForPublish.mockResolvedValue(publishResult(true));
    await validatePublish('/tmp/my-plugin', {});

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).not.toContain('Passed checks:');
  });
});
