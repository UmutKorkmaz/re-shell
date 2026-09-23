import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  detectFrameworks,
  analyzeProject,
  showProjectAnalysis,
} from '../../src/utils/framework-detection';

describe('detectFrameworks', () => {
  it('returns empty array for empty directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `fd-empty-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const result = await detectFrameworks(tmpDir);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('detects react from package.json dependencies', async () => {
    const tmpDir = path.join(os.tmpdir(), `fd-react-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      })
    );
    const result = await detectFrameworks(tmpDir);
    expect(result.length).toBeGreaterThan(0);
    const names = result.map(f => f.name.toLowerCase());
    expect(names.some(n => n.includes('react'))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('analyzeProject', () => {
  it('returns analysis for a react project', async () => {
    const tmpDir = path.join(os.tmpdir(), `fd-analyze-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test',
        dependencies: { vue: '^3.0.0' },
        devDependencies: { vite: '^4.0.0' },
      })
    );
    const result = await analyzeProject(tmpDir);
    expect(result.frameworks).toBeDefined();
    expect(result.primaryLanguage).toBeDefined();
    expect(result.packageManager).toBeDefined();
    expect(result.recommendedConfig).toBeDefined();
    expect(result.recommendedConfig.port).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns analysis with defaults for empty dir', async () => {
    const tmpDir = path.join(os.tmpdir(), `fd-defaults-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const result = await analyzeProject(tmpDir);
    expect(result.frameworks).toEqual([]);
    expect(result.hasTypeScript).toBe(false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('showProjectAnalysis', () => {
  it('logs analysis without throwing', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const tmpDir = path.join(os.tmpdir(), `fd-show-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    await expect(showProjectAnalysis(tmpDir)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
