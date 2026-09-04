import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateMultiCloudNetworkingMD,
  generateTerraformNetworking,
  generateTypeScriptNetworking,
  generatePythonNetworking,
  writeFiles,
  multiCloudNetworking,
} from '../../src/utils/multi-cloud-networking';

const config = {
  projectName: 'mcn-app',
  providers: ['aws' as const, 'azure' as const],
  endpoints: [],
  connections: {},
  routingStrategy: 'latency-based' as const,
  loadBalancer: {
    algorithm: 'round-robin' as const,
    healthCheckInterval: 30,
    unhealthyThreshold: 3,
    healthyThreshold: 2,
    timeoutSeconds: 5,
  },
  performance: {
    enableCaching: true,
    enableCompression: false,
    enableCDN: true,
    tcpOptimization: true,
    keepAliveEnabled: true,
    connectionPooling: false,
  },
  enableMonitoring: true,
  enableFailover: false,
};

describe('multiCloudNetworking', () => {
  it('returns the config as-is', () => {
    expect(multiCloudNetworking(config)).toBe(config);
  });
});

describe('generateMultiCloudNetworkingMD', () => {
  it('generates markdown with title', () => {
    const md = generateMultiCloudNetworkingMD(config);
    expect(md).toContain('# Multi-Cloud Networking');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateMultiCloudNetworkingMD(config).toLowerCase()).toContain('networking');
  });
});

describe('generateTerraformNetworking', () => {
  it('includes project name', () => {
    expect(generateTerraformNetworking(config)).toContain('mcn-app');
  });
});

describe('generateTypeScriptNetworking', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptNetworking(config);
    expect(ts).toContain('MultiCloudNetworkManager');
    expect(ts).toContain('mcn-app');
  });
});

describe('generatePythonNetworking', () => {
  it('generates Python manager class', () => {
    const py = generatePythonNetworking(config);
    expect(py).toContain('class MultiCloudNetworkManager');
    expect(py).toContain('mcn-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcn-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'multi-cloud-networking.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'multi-cloud-network-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'MULTI_CLOUD_NETWORKING.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'multi_cloud_network_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'networking-config.json'), 'utf-8'));
    expect(json.projectName).toBe('mcn-app');
    expect(json.enableMonitoring).toBe(true);
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
