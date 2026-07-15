import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateMultiTenantMD,
  generateTypeScriptMultiTenant,
  generatePythonMultiTenant,
  writeFiles,
} from '../../src/utils/multi-tenant-isolation';

const config = {
  projectName: 'mti-app',
  namespaces: [
    { name: 'tenant-a-prod', tenant: 'tenant-a', environment: 'production' },
  ],
  enableNetworkIsolation: true,
  enableResourceQuotas: true,
  enableLimitRanges: false,
  enablePodSecurityPolicies: true,
};

describe('generateMultiTenantMD', () => {
  it('generates markdown with title', () => {
    const md = generateMultiTenantMD(config);
    expect(md).toContain('# Multi-Tenant Isolation');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateMultiTenantMD(config).toLowerCase()).toContain('tenant');
  });
});

describe('generateTypeScriptMultiTenant', () => {
  it('generates TS code with project name', () => {
    const ts = generateTypeScriptMultiTenant(config);
    expect(ts).toContain('mti-app');
  });
});

describe('generatePythonMultiTenant', () => {
  it('generates Python code with project name', () => {
    const py = generatePythonMultiTenant(config);
    expect(py).toContain('mti-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mti-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes all output files', async () => {
    await writeFiles(config, tmpDir);
    expect(await fs.pathExists(path.join(tmpDir, 'multi-tenant-isolation.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'multi-tenant-isolation.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'MULTI_TENANT.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir);
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'multi-tenant-config.json'), 'utf-8'));
    expect(json.projectName).toBe('mti-app');
    expect(json.enableNetworkIsolation).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir);
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pyyaml');
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
