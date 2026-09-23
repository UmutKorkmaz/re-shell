import { describe, expect, it } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  HotReloadManager,
  createHotReload,
  detectProjectFramework,
  listSupportedFrameworks,
  getFrameworkPattern,
} from '../../src/utils/hot-reload';

describe('listSupportedFrameworks', () => {
  it('returns a non-empty array of frameworks', () => {
    const list = listSupportedFrameworks();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});

describe('getFrameworkPattern', () => {
  it('returns pattern for a known framework', () => {
    const pattern = getFrameworkPattern('express');
    expect(pattern).toBeDefined();
    expect(pattern!.framework).toBe('express');
    expect(pattern!.devCommand).toBeDefined();
  });

  it('returns undefined for unknown framework', () => {
    const pattern = getFrameworkPattern('nonexistent-fw');
    expect(pattern).toBeUndefined();
  });
});

describe('detectProjectFramework', () => {
  it('returns null for empty directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `hr-empty-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const result = await detectProjectFramework(tmpDir);
    expect(result).toBeNull();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects express from package.json', async () => {
    const tmpDir = path.join(os.tmpdir(), `hr-express-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        dependencies: { express: '^4.0.0' },
        scripts: { dev: 'nodemon index.js' },
      })
    );
    const result = await detectProjectFramework(tmpDir);
    expect(result).not.toBeNull();
    expect(result!.framework).toBe('express');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('createHotReload', () => {
  it('creates a HotReloadManager instance', async () => {
    const tmpDir = path.join(os.tmpdir(), `hr-create-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const mgr = await createHotReload({ projectPath: tmpDir });
    expect(mgr).toBeDefined();
    expect(mgr).toBeInstanceOf(HotReloadManager);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
