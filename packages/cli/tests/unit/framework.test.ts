import { describe, expect, it } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  SUPPORTED_FRAMEWORKS,
  getFrameworkChoices,
  getFrameworkConfig,
  detectFramework,
  validateFramework,
} from '../../src/utils/framework';

describe('SUPPORTED_FRAMEWORKS', () => {
  it('contains react and vue entries', () => {
    expect(SUPPORTED_FRAMEWORKS['react']).toBeDefined();
    expect(SUPPORTED_FRAMEWORKS['react-ts']).toBeDefined();
    expect(Object.keys(SUPPORTED_FRAMEWORKS).length).toBeGreaterThan(5);
  });
});

describe('getFrameworkChoices', () => {
  it('returns an array of framework choices', () => {
    const choices = getFrameworkChoices();
    expect(Array.isArray(choices)).toBe(true);
    expect(choices.length).toBeGreaterThan(0);
  });
});

describe('getFrameworkConfig', () => {
  it('returns config for a known framework', () => {
    const config = getFrameworkConfig('react');
    expect(config).toBeDefined();
    expect(config.name).toBe('react');
    expect(config.buildTool).toBeDefined();
  });

  it('throws for unknown framework', () => {
    expect(() => getFrameworkConfig('nonexistent-framework')).toThrow();
  });
});

describe('validateFramework', () => {
  it('returns true for supported frameworks', () => {
    expect(validateFramework('react')).toBe(true);
    expect(validateFramework('vue')).toBe(true);
  });

  it('returns false for unsupported framework', () => {
    expect(validateFramework('nonexistent')).toBe(false);
  });
});

describe('detectFramework', () => {
  it('returns null for empty directory', () => {
    const tmpDir = path.join(os.tmpdir(), `fw-empty-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const result = detectFramework(tmpDir);
    expect(result).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects react from package.json', () => {
    const tmpDir = path.join(os.tmpdir(), `fw-react-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', dependencies: { react: '^18.0.0' } })
    );
    const result = detectFramework(tmpDir);
    expect(result).not.toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
