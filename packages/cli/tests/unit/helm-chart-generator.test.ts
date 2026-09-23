import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateHelmMD,
  generateTypeScriptHelm,
  generatePythonHelm,
  writeFiles,
} from '../../src/utils/helm-chart-generator';

const config: any = {
  projectName: 'test-helm',
  chartName: 'my-chart',
  environments: ['dev', 'staging', 'prod'],
  services: [
    { name: 'web', port: 3000, image: 'nginx:latest', replicas: 2 },
    { name: 'api', port: 8000, image: 'api:latest', replicas: 3 },
  ],
};

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateHelmMD', () => {
  it('generates markdown', () => {
    const md = generateHelmMD(config);
    expect(md).toBeDefined();
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('generateTypeScriptHelm', () => {
  it('generates TypeScript code', () => {
    const ts = generateTypeScriptHelm(config);
    expect(ts).toBeDefined();
    expect(ts.length).toBeGreaterThan(0);
  });
});

describe('generatePythonHelm', () => {
  it('generates Python code', () => {
    const py = generatePythonHelm(config);
    expect(py).toBeDefined();
    expect(py.length).toBeGreaterThan(0);
  });
});

describe('writeFiles', () => {
  it('writes artifacts to disk (TypeScript)', async () => {
    const tmpDir = path.join(os.tmpdir(), `helm-test-${Date.now()}`);
    await writeFiles(config, tmpDir, 'typescript');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes artifacts to disk (Python)', async () => {
    const tmpDir = path.join(os.tmpdir(), `helm-test-py-${Date.now()}`);
    await writeFiles(config, tmpDir, 'python');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
