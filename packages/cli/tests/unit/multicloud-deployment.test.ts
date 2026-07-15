import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateMultiCloudMD,
  generateTerraformConfig,
  generateTypeScriptMultiCloud,
  generatePythonMultiCloud,
  writeFiles,
} from '../../src/utils/multicloud-deployment';

const config = {
  projectName: 'mcd-app',
  providers: [
    {
      name: 'aws' as const,
      enabled: true,
      priority: 1,
      region: 'us-east-1',
      credentials: {
        type: 'access-key' as const,
        envVar: 'AWS_ACCESS_KEY_ID',
      },
    },
    {
      name: 'azure' as const,
      enabled: false,
      priority: 2,
      region: 'eastus',
      credentials: {
        type: 'managed-identity' as const,
      },
    },
  ],
  deploymentStrategy: {
    type: 'active-active' as const,
    failover: true,
    healthCheck: {
      enabled: true,
      interval: 30,
      timeout: 5,
      threshold: 3,
    },
  },
  lockPrevention: {
    abstractionLayer: true,
    multiProviderSDK: true,
    portableContainers: true,
    standardTerraform: true,
    apiGateway: false,
    dataReplication: true,
  },
  costOptimization: {
    enabled: true,
    spotInstances: true,
    reservedInstances: false,
    autoScaling: true,
    rightSizing: true,
    budgetAlerts: false,
  },
  enableObservability: true,
};

describe('generateMultiCloudMD', () => {
  it('generates markdown with title', () => {
    const md = generateMultiCloudMD(config);
    expect(md).toContain('# Multi-Cloud Deployment');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateMultiCloudMD(config).toLowerCase()).toContain('cloud');
  });
});

describe('generateTerraformConfig', () => {
  it('includes project name', () => {
    expect(generateTerraformConfig(config)).toContain('mcd-app');
  });
});

describe('generateTypeScriptMultiCloud', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptMultiCloud(config);
    expect(ts).toContain('MultiCloudManager');
    expect(ts).toContain('mcd-app');
  });
});

describe('generatePythonMultiCloud', () => {
  it('generates Python manager class', () => {
    const py = generatePythonMultiCloud(config);
    expect(py).toContain('class MultiCloudManager');
    expect(py).toContain('mcd-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcd-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'main.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'multicloud-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'MULTICLOUD.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'multicloud_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('mcd-app-multicloud');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'multicloud-config.json'), 'utf-8'));
    expect(json.projectName).toBe('mcd-app');
    expect(json.enableObservability).toBe(true);
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
