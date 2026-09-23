import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCRDMD,
  generateTypeScriptCRD,
  generatePythonCRD,
  writeFiles,
} from '../../src/utils/crd-generator';

const config = {
  projectName: 'crd-app',
  namespace: 'operators',
  crds: [
    {
      name: 'customapp',
      group: 'apps.example.com',
      scope: 'Namespaced' as const,
      kind: 'CustomApp',
      plural: 'customapps',
      singular: 'customapp',
      properties: {
        spec: {
          type: 'object',
          description: 'App spec',
        },
      },
    },
  ],
  enableController: true,
  enableWebhooks: false,
};

describe('generateCRDMD', () => {
  it('generates markdown with title', () => {
    const md = generateCRDMD(config);
    expect(md).toContain('# Custom Resource Definitions');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateCRDMD(config).toLowerCase()).toContain('resource');
  });
});

describe('generateTypeScriptCRD', () => {
  it('generates TS operator class', () => {
    const ts = generateTypeScriptCRD(config);
    expect(ts).toContain('class CRDOperator');
    expect(ts).toContain('crd-app');
  });
});

describe('generatePythonCRD', () => {
  it('generates Python operator class', () => {
    const py = generatePythonCRD(config);
    expect(py).toContain('class CRDOperator');
    expect(py).toContain('crd-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crd-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes all output files', async () => {
    await writeFiles(config, tmpDir);
    expect(await fs.pathExists(path.join(tmpDir, 'crd-generator.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'crd-generator.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CRD.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir);
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('crd-app');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir);
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'crd-config.json'), 'utf-8'));
    expect(json.projectName).toBe('crd-app');
    expect(json.enableController).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir);
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pyyaml');
    expect(req).toContain('kubernetes');
  });
});

describe('displayConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
