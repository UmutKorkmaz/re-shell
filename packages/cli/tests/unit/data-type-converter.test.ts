import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateConverterConfig,
  generateTypeScriptConverter,
  generatePythonConverter,
  writeConverterFiles,
  displayConverterConfig,
} from '../../src/utils/data-type-converter';

describe('generateConverterConfig', () => {
  it('returns a config with defaults', async () => {
    const config = await generateConverterConfig('json', 'protobuf');
    expect(config.sourceFormat).toBe('json');
    expect(config.targetFormat).toBe('protobuf');
    expect(config.preserveTypes).toBe(true);
    expect(config.handleOptional).toBe(true);
    expect(config.enumAsString).toBe(false);
    expect(config.dateAsTimestamp).toBe(true);
  });

  it('accepts different format pairs', async () => {
    const config = await generateConverterConfig('yaml', 'csv');
    expect(config.sourceFormat).toBe('yaml');
    expect(config.targetFormat).toBe('csv');
  });
});

describe('generateTypeScriptConverter', () => {
  it('generates files with converter code', async () => {
    const config = await generateConverterConfig('json', 'protobuf');
    const result = await generateTypeScriptConverter(config);
    expect(result.files.length).toBeGreaterThan(0);
    const allContent = result.files.map(f => f.content).join('\n');
    expect(allContent.length).toBeGreaterThan(100);
  });
});

describe('generatePythonConverter', () => {
  it('generates Python files', async () => {
    const config = await generateConverterConfig('json', 'protobuf');
    const result = await generatePythonConverter(config);
    expect(result.files.length).toBeGreaterThan(0);
  });
});

describe('writeConverterFiles', () => {
  it('writes integration files and BUILD.md', async () => {
    const config = await generateConverterConfig('json', 'protobuf');
    const integration = await generateTypeScriptConverter(config);
    const tmpDir = path.join(os.tmpdir(), `conv-test-${Date.now()}`);
    await writeConverterFiles('converter', integration, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'BUILD.md'))).toBe(true);
    for (const file of integration.files) {
      expect(fs.existsSync(path.join(tmpDir, file.path))).toBe(true);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayConverterConfig', () => {
  it('logs config without throwing', async () => {
    const config = await generateConverterConfig('json', 'protobuf');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(displayConverterConfig(config)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
