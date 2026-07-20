import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateInfrastructureSecurityMarkdown,
  generateInfrastructureSecurityTerraform,
  generateSecurityManagerTypeScript,
  generateSecurityManagerPython,
  writeInfrastructureSecurityFiles,
  displayInfrastructureSecurityConfig,
} from '../../src/utils/infrastructure-security';

const config = {
  projectName: 'infra-sec-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  scanSettings: {
    enabled: true,
    frequency: 'on-schedule' as const,
    interval: '0 2 * * *',
    severityThreshold: 'high' as const,
    failOnThreshold: 'critical' as const,
    targets: ['aws', 'azure', 'gcp', 'kubernetes', 'terraform'],
    resourceTypes: ['compute', 'storage', 'network'],
    complianceStandards: ['cis-benchmark', 'pci-dss'],
    deepAnalysis: true,
    includeDeprecated: false,
    scanDrift: true,
    scanMisconfigurations: true,
    scanCompliance: true,
    scanVulnerabilities: true,
    autoRemediate: false,
    remediationType: 'manual' as const,
    notifyOnFindings: true,
    generateReports: true,
  } as any,
  resources: [],
  findings: [],
  remediations: [],
  complianceReports: [],
  benchmarks: [],
  integrations: [],
} as any;

describe('generateInfrastructureSecurityMarkdown', () => {
  it('references project name', () => {
    const md = generateInfrastructureSecurityMarkdown(config);
    expect(md).toContain('infra-sec-app');
  });
});

describe('generateInfrastructureSecurityTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateInfrastructureSecurityTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateInfrastructureSecurityTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateInfrastructureSecurityTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateSecurityManagerTypeScript', () => {
  it('produces a typescript module', () => {
    const ts = generateSecurityManagerTypeScript(config);
    expect(ts).toMatch(/class|SecurityManager|infrastructure/i);
  });
});

describe('generateSecurityManagerPython', () => {
  it('produces a python module', () => {
    const py = generateSecurityManagerPython(config);
    expect(py).toMatch(/class|def/i);
  });
});

describe('writeInfrastructureSecurityFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'infra-sec-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output + per-provider terraform', async () => {
    await writeInfrastructureSecurityFiles(config, tmpDir, 'typescript');
    for (const file of [
      'INFRASTRUCTURE_SECURITY.md',
      'infrastructure-security-aws.tf',
      'infrastructure-security-azure.tf',
      'infrastructure-security-gcp.tf',
      'infrastructure-security-manager.ts',
      'package.json',
      'infrastructure-security-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python output', async () => {
    await writeInfrastructureSecurityFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'infrastructure_security_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeInfrastructureSecurityFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'infrastructure-security-config.json'), 'utf-8'));
    expect(json.projectName).toBe('infra-sec-app');
  });
});

describe('displayInfrastructureSecurityConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayInfrastructureSecurityConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
