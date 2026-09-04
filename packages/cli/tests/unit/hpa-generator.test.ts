import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateHPAMD,
  generateTypeScriptHPA,
  generatePythonHPA,
  writeFiles,
} from '../../src/utils/hpa-generator';

const config: any = {
  projectName: 'test-hpa',
  namespace: 'production',
  minReplicas: 2,
  maxReplicas: 10,
  targetMetrics: [
    {
      name: 'cpu',
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: { type: 'Utilization', averageUtilization: 70 },
      },
    },
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

describe('generateHPAMD', () => {
  it('generates markdown', () => {
    const md = generateHPAMD(config);
    expect(md).toBeDefined();
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('generateTypeScriptHPA', () => {
  it('generates TypeScript code', () => {
    const ts = generateTypeScriptHPA(config);
    expect(ts).toBeDefined();
    expect(ts.length).toBeGreaterThan(0);
  });
});

describe('generatePythonHPA', () => {
  it('generates Python code', () => {
    const py = generatePythonHPA(config);
    expect(py).toBeDefined();
    expect(py.length).toBeGreaterThan(0);
  });
});

describe('writeFiles', () => {
  it('writes artifacts to disk (TypeScript)', async () => {
    const tmpDir = path.join(os.tmpdir(), `hpa-test-${Date.now()}`);
    await writeFiles(config, tmpDir, 'typescript');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes artifacts to disk (Python)', async () => {
    const tmpDir = path.join(os.tmpdir(), `hpa-test-py-${Date.now()}`);
    await writeFiles(config, tmpDir, 'python');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
