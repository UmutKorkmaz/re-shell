import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateVSCodeLaunchConfig,
  generateJetbrainsRunConfig,
  generateDebugConfigs,
  writeDebugConfigs,
  displayDebugConfigInfo,
} from '../../src/utils/debugging';

const tsProject: any = {
  name: 'my-api',
  type: 'backend',
  framework: 'express',
  language: 'typescript',
  entryPoint: 'src/index.ts',
  port: 3000,
};

const reactProject: any = {
  name: 'my-app',
  type: 'frontend',
  framework: 'react',
  language: 'typescript',
  port: 3000,
};

const pythonProject: any = {
  name: 'py-svc',
  type: 'backend',
  framework: 'fastapi',
  language: 'python',
  entryPoint: 'main.py',
  port: 8000,
};

describe('generateVSCodeLaunchConfig', () => {
  it('generates launch configs for TypeScript Express', () => {
    const configs = generateVSCodeLaunchConfig(tsProject);
    expect(configs.length).toBeGreaterThan(0);
    const serverConfig = configs.find(c => c.name.includes('Server'));
    expect(serverConfig).toBeDefined();
    expect(serverConfig!.type).toBe('node');
  });

  it('generates launch configs for React frontend', () => {
    const configs = generateVSCodeLaunchConfig(reactProject);
    expect(configs.length).toBeGreaterThan(0);
    const chromeConfig = configs.find(c => c.type === 'chrome');
    expect(chromeConfig).toBeDefined();
  });

  it('generates launch configs for Python', () => {
    const configs = generateVSCodeLaunchConfig(pythonProject);
    expect(configs.length).toBeGreaterThan(0);
    const pyConfig = configs.find(c => c.name.includes('Debug') || c.type === 'python' || c.type === 'debugpy');
    expect(pyConfig).toBeDefined();
  });
});

describe('generateJetbrainsRunConfig', () => {
  it('generates JetBrains run configs for TypeScript', () => {
    const configs = generateJetbrainsRunConfig(tsProject);
    expect(configs.length).toBeGreaterThan(0);
  });

  it('generates JetBrains run configs for Python', () => {
    const configs = generateJetbrainsRunConfig(pythonProject);
    expect(configs.length).toBeGreaterThan(0);
  });
});

describe('generateDebugConfigs', () => {
  it('generates debug configs with file paths', async () => {
    const tmpDir = path.join(os.tmpdir(), `debug-gen-${Date.now()}`);
    const results = await generateDebugConfigs(tmpDir, tsProject);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].files.length).toBeGreaterThan(0);
    expect(results[0].files[0].content).toContain('configurations');
  });
});

describe('writeDebugConfigs', () => {
  it('writes debug config files to disk', async () => {
    const tmpDir = path.join(os.tmpdir(), `debug-write-${Date.now()}`);
    await writeDebugConfigs(tmpDir, tsProject, { force: true });
    expect(fs.existsSync(path.join(tmpDir, '.vscode', 'launch.json'))).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayDebugConfigInfo', () => {
  it('logs debug info without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayDebugConfigInfo(tsProject)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
