import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  displayConfig,
  generateAzureCloudMD,
  generateBicepTemplate,
  generateTypeScriptAzureCloud,
  generatePythonAzureCloud,
  writeFiles,
} from '../../src/utils/azure-cloud';

const config: any = {
  projectName: 'azure-project',
  subscriptionId: '12345678-1234-1234-1234-123456789abc',
  aksConfig: {
    clusterName: 'prod-aks',
    resourceGroupName: 'prod-rg',
    location: 'eastus',
    kubernetesVersion: '1.28',
    nodeCount: 3,
    nodeVmSize: 'Standard_DS2_v2',
    enableAutoScaling: true,
    minCount: 2,
    maxCount: 8,
    osDiskSizeGB: 128,
    osDiskType: 'Managed',
    enablePrivateCluster: true,
    enableManagedIdentity: true,
  },
  devOpsConfig: {
    organization: 'myorg',
    project: 'myproject',
    repoName: 'myrepo',
    buildPipeline: 'build',
    releasePipeline: 'release',
    enableCI: true,
    enableCD: true,
    branch: 'main',
  },
  monitoringConfig: {
    enableLogAnalytics: true,
    enableApplicationInsights: true,
    enableAzureMonitor: true,
    retentionDays: 30,
  },
  enableACR: true,
  enableKeyVault: true,
};

describe('displayConfig', () => {
  it('logs config summary without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayConfig(config)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateAzureCloudMD', () => {
  it('returns markdown with Azure AKS heading and features', () => {
    const md = generateAzureCloudMD(config);
    expect(md).toContain('# Azure AKS with ARM/Bicep Integration and Azure DevOps');
    expect(md).toContain('## Features');
    expect(md).toContain('## Usage');
    expect(md).toContain('az deployment group create');
  });
});

describe('generateBicepTemplate', () => {
  it('generates Bicep code with project name and cluster config', () => {
    const bicep = generateBicepTemplate(config);
    expect(bicep).toContain('// Auto-generated AKS Bicep Template for azure-project');
    expect(bicep).toContain("param clusterName string = 'prod-aks'");
    expect(bicep).toContain("param nodeVmSize string = 'Standard_DS2_v2'");
    expect(bicep).toContain('param enableAutoScaling bool = true');
    expect(bicep).toContain('param enablePrivateCluster bool = true');
  });

  it('includes ACR resource when enableACR is true', () => {
    const bicep = generateBicepTemplate(config);
    expect(bicep).toContain('Microsoft.ContainerRegistry/registries');
  });

  it('includes Key Vault resource when enableKeyVault is true', () => {
    const bicep = generateBicepTemplate(config);
    expect(bicep).toContain('Microsoft.KeyVault/vaults');
  });
});

describe('generateTypeScriptAzureCloud', () => {
  it('generates TypeScript manager class with project config', () => {
    const ts = generateTypeScriptAzureCloud(config);
    expect(ts).toContain('azure-project');
    expect(ts).toContain('class AzureCloudManager');
    expect(ts).toContain("'prod-rg'");
    expect(ts).toContain('--enable-cluster-autoscaler');
  });
});

describe('generatePythonAzureCloud', () => {
  it('generates Python manager class with project config', () => {
    const py = generatePythonAzureCloud(config);
    expect(py).toContain('azure-project');
    expect(py).toContain('class AzureCloudManager');
    expect(py).toContain('from azure.identity import DefaultAzureCredential');
    expect(py).toContain('"prod-aks"');
  });
});

describe('writeFiles', () => {
  it('writes TypeScript files including Bicep template', async () => {
    const tmpDir = path.join(os.tmpdir(), `azure-cloud-test-${Date.now()}`);
    await writeFiles(config, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'main.bicep'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'azure-cloud-manager.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'AZURE_CLOUD.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'azure-config.json'))).toBe(true);

    const pkgJson = JSON.parse(fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8'));
    expect(pkgJson.name).toBe('azure-project-azure-cloud');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes Python files including Bicep template', async () => {
    const tmpDir = path.join(os.tmpdir(), `azure-cloud-test-py-${Date.now()}`);
    await writeFiles(config, tmpDir, 'python');

    expect(fs.existsSync(path.join(tmpDir, 'main.bicep'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'azure_cloud_manager.py'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'AZURE_CLOUD.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'azure-config.json'))).toBe(true);

    const reqs = fs.readFileSync(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(reqs).toContain('azure-identity');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
