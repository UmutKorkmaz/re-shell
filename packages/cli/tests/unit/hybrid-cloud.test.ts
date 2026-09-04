import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateHybridCloudMD,
  generateTerraformHybridCloud,
  generateTypeScriptHybridCloud,
  generatePythonHybridCloud,
  writeFiles,
  hybridCloud,
} from '../../src/utils/hybrid-cloud';

const config: any = {
  projectName: 'test-hybrid',
  primaryCloud: 'aws',
  secondaryClouds: ['azure', 'gcp'],
  deploymentStrategy: 'active-active',
  edgeCompute: {
    enabled: true,
    locations: ['cdn', 'regional'],
    deviceCount: 50,
    processingPower: 'medium',
    syncStrategy: 'real-time',
    offlineMode: false,
    dataRetentionDays: 30,
  },
  connectivity: {
    vpnTunnels: true,
    expressRoutes: false,
    interconnects: true,
    latencyThreshold: 100,
    bandwidthMbps: 1000,
    failoverEnabled: true,
  },
  dataSync: {
    enabled: true,
    mode: 'bi-directional',
    conflictResolution: 'last-write-wins',
    syncFrequency: '5m',
    compressionEnabled: true,
    encryptionEnabled: true,
  },
  regions: ['us-east-1', 'eu-west-1'],
};

describe('hybridCloud', () => {
  it('returns passthrough config', () => {
    const result = hybridCloud(config);
    expect(result.projectName).toBe('test-hybrid');
    expect(result.primaryCloud).toBe('aws');
  });
});

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateHybridCloudMD', () => {
  it('generates markdown', () => {
    const md = generateHybridCloudMD(config);
    expect(md).toBeDefined();
    expect(md).toContain('Hybrid Cloud');
    expect(md.length).toBeGreaterThan(0);
  });
});

describe('generateTerraformHybridCloud', () => {
  it('generates terraform config', () => {
    const tf = generateTerraformHybridCloud(config);
    expect(tf).toBeDefined();
    expect(tf.length).toBeGreaterThan(0);
  });
});

describe('generateTypeScriptHybridCloud', () => {
  it('generates TypeScript code', () => {
    const ts = generateTypeScriptHybridCloud(config);
    expect(ts).toBeDefined();
    expect(ts.length).toBeGreaterThan(0);
  });
});

describe('generatePythonHybridCloud', () => {
  it('generates Python code', () => {
    const py = generatePythonHybridCloud(config);
    expect(py).toBeDefined();
    expect(py.length).toBeGreaterThan(0);
  });
});

describe('writeFiles', () => {
  it('writes artifacts to disk (TypeScript)', async () => {
    const tmpDir = path.join(os.tmpdir(), `hybrid-test-${Date.now()}`);
    await writeFiles(config, tmpDir, 'typescript');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes artifacts to disk (Python)', async () => {
    const tmpDir = path.join(os.tmpdir(), `hybrid-test-py-${Date.now()}`);
    await writeFiles(config, tmpDir, 'python');
    expect(fs.existsSync(tmpDir)).toBe(true);
    expect(fs.readdirSync(tmpDir).length).toBeGreaterThan(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
