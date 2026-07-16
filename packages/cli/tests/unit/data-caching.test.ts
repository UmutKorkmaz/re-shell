import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateCachingConfig,
  generateTypeScriptCaching,
  generatePythonCaching,
  writeCachingFiles,
  displayCachingConfig,
} from '../../src/utils/data-caching';

describe('generateCachingConfig', () => {
  it('returns a config with defaults', async () => {
    const config = await generateCachingConfig('my-svc');
    expect(config.serviceName).toBe('my-svc');
    expect(config.defaultBackend).toBe('memory');
    expect(config.defaultTTL).toBe(3600);
    expect(config.maxEntries).toBe(10000);
    expect(config.evictionPolicy).toBe('lru');
  });

  it('accepts a custom backend', async () => {
    const config = await generateCachingConfig('my-svc', 'redis');
    expect(config.defaultBackend).toBe('redis');
  });
});

describe('generateTypeScriptCaching', () => {
  it('generates files with caching code', async () => {
    const config = await generateCachingConfig('my-svc');
    const result = await generateTypeScriptCaching(config);
    expect(result.files.length).toBeGreaterThan(0);
    const allContent = result.files.map(f => f.content).join('\n');
    expect(allContent.length).toBeGreaterThan(100);
  });
});

describe('generatePythonCaching', () => {
  it('generates Python files', async () => {
    const config = await generateCachingConfig('my-svc');
    const result = await generatePythonCaching(config);
    expect(result.files.length).toBeGreaterThan(0);
    const mainFile = result.files.find(f => f.path.includes('.py'));
    expect(mainFile).toBeDefined();
  });
});

describe('writeCachingFiles', () => {
  it('writes integration files and BUILD.md', async () => {
    const config = await generateCachingConfig('my-svc');
    const integration = await generateTypeScriptCaching(config);
    const tmpDir = path.join(os.tmpdir(), `caching-test-${Date.now()}`);
    await writeCachingFiles('my-svc', integration, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'BUILD.md'))).toBe(true);
    for (const file of integration.files) {
      expect(fs.existsSync(path.join(tmpDir, file.path))).toBe(true);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayCachingConfig', () => {
  it('logs config without throwing', async () => {
    const config = await generateCachingConfig('my-svc');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(displayCachingConfig(config)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
