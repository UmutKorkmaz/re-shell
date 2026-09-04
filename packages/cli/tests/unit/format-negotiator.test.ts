import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateFormatNegotiatorConfig,
  generateTypeScriptFormatNegotiator,
  generatePythonFormatNegotiator,
  generateGoFormatNegotiator,
  writeFormatNegotiatorFiles,
  displayFormatNegotiatorConfig,
} from '../../src/utils/format-negotiator';

describe('generateFormatNegotiatorConfig', () => {
  it('returns a config with defaults', async () => {
    const config = await generateFormatNegotiatorConfig('my-api');
    expect(config.serviceName).toBe('my-api');
    expect(config.defaultFormat).toBe('json');
    expect(config.enableAutoConversion).toBe(true);
    expect(config.supportedFormats.length).toBeGreaterThan(0);
  });

  it('accepts a custom default format', async () => {
    const config = await generateFormatNegotiatorConfig('my-api', 'yaml');
    expect(config.defaultFormat).toBe('yaml');
  });
});

describe('generateTypeScriptFormatNegotiator', () => {
  it('generates TS files and dependencies', async () => {
    const config = await generateFormatNegotiatorConfig('my-svc');
    const result = await generateTypeScriptFormatNegotiator(config);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.dependencies.length).toBeGreaterThan(0);
    expect(result.files[0].content).toContain('FormatNegotiator');
  });
});

describe('generatePythonFormatNegotiator', () => {
  it('generates Python files and dependencies', async () => {
    const config = await generateFormatNegotiatorConfig('my-svc');
    const result = await generatePythonFormatNegotiator(config);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.dependencies.length).toBeGreaterThan(0);
  });
});

describe('generateGoFormatNegotiator', () => {
  it('generates Go files and dependencies', async () => {
    const config = await generateFormatNegotiatorConfig('my-svc');
    const result = await generateGoFormatNegotiator(config);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.dependencies.length).toBeGreaterThan(0);
  });
});

describe('writeFormatNegotiatorFiles', () => {
  it('writes integration files and BUILD.md to disk', async () => {
    const config = await generateFormatNegotiatorConfig('my-svc');
    const integration = await generateTypeScriptFormatNegotiator(config);
    const tmpDir = path.join(os.tmpdir(), `fn-test-${Date.now()}`);
    await writeFormatNegotiatorFiles('my-svc', integration, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'BUILD.md'))).toBe(true);
    for (const file of integration.files) {
      expect(fs.existsSync(path.join(tmpDir, file.path))).toBe(true);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayFormatNegotiatorConfig', () => {
  it('logs config without throwing', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const config = await generateFormatNegotiatorConfig('my-svc');
    await displayFormatNegotiatorConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
