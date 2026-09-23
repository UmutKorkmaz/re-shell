import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateEncryptionConfig,
  generateTypeScriptEncryption,
  generatePythonEncryption,
  writeEncryptionFiles,
  displayEncryptionConfig,
} from '../../src/utils/data-encryption';

describe('generateEncryptionConfig', () => {
  it('returns a config with defaults', async () => {
    const config = await generateEncryptionConfig('my-svc');
    expect(config.serviceName).toBe('my-svc');
    expect(config.defaultAlgorithm).toBe('aes-256-gcm');
    expect(config.keyExchangeProtocol).toBe('ecdh');
    expect(config.enableKeyRotation).toBe(true);
    expect(config.keyRotationDays).toBe(90);
    expect(config.enableSigning).toBe(true);
    expect(config.signAlgorithm).toBe('sha256');
  });

  it('accepts a custom algorithm', async () => {
    const config = await generateEncryptionConfig('my-svc', 'chacha20-poly1305');
    expect(config.defaultAlgorithm).toBe('chacha20-poly1305');
  });
});

describe('generateTypeScriptEncryption', () => {
  it('generates files and dependencies', async () => {
    const config = await generateEncryptionConfig('my-svc');
    const result = await generateTypeScriptEncryption(config);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.dependencies).toContain('crypto');
    const allContent = result.files.map(f => f.content).join('\n');
    expect(allContent.length).toBeGreaterThan(100);
  });
});

describe('generatePythonEncryption', () => {
  it('generates Python files', async () => {
    const config = await generateEncryptionConfig('my-svc');
    const result = await generatePythonEncryption(config);
    expect(result.files.length).toBeGreaterThan(0);
  });
});

describe('writeEncryptionFiles', () => {
  it('writes integration files and BUILD.md', async () => {
    const config = await generateEncryptionConfig('my-svc');
    const integration = await generateTypeScriptEncryption(config);
    const tmpDir = path.join(os.tmpdir(), `enc-test-${Date.now()}`);
    await writeEncryptionFiles('my-svc', integration, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'BUILD.md'))).toBe(true);
    for (const file of integration.files) {
      expect(fs.existsSync(path.join(tmpDir, file.path))).toBe(true);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayEncryptionConfig', () => {
  it('logs config without throwing', async () => {
    const config = await generateEncryptionConfig('my-svc');
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(displayEncryptionConfig(config)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
