import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateSecretDetectionMarkdown,
  generateVaultTerraform,
  generateSecretManagerTypeScript,
  generateSecretManagerPython,
  writeSecretDetectionFiles,
  displaySecretDetectionConfig,
} from '../../src/utils/secret-detection';

const config = {
  projectName: 'secret-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  detectionSettings: {
    enabled: true,
    frequency: 'on-push',
    interval: '0 0 * * *',
    scanHistory: true,
    scanIssues: true,
    scanCommits: true,
    scanEnvironmentVariables: true,
    entropyThreshold: 4.5,
    minSecretLength: 16,
    maxFalsePositives: 0.1,
    customPatterns: [],
    allowlistedPaths: [],
    allowlistedValues: [],
    customEntropyAlgorithms: [],
    enableMachineLearning: false,
    enableVerification: true,
    enableRotationTracking: true,
    enableAccessLogging: true,
    enableComplianceReporting: true,
    reportFormat: 'json',
    outputDirectory: './reports',
  } as any,
  secrets: [],
  rotationPolicies: [],
  vaultIntegrations: [],
  accessControls: [],
  auditLogs: [],
  complianceReports: [],
} as any;

describe('generateSecretDetectionMarkdown', () => {
  it('references project name', () => {
    expect(generateSecretDetectionMarkdown(config)).toContain('secret-app');
  });
});

describe('generateVaultTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateVaultTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateVaultTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateVaultTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateSecretManagerTypeScript', () => {
  it('produces a typescript module', () => {
    expect(generateSecretManagerTypeScript(config)).toMatch(/class|SecretManager|secret/i);
  });
});

describe('generateSecretManagerPython', () => {
  it('produces a python module', () => {
    expect(generateSecretManagerPython(config)).toMatch(/class|def/i);
  });
});

describe('writeSecretDetectionFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'secret-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown, terraform per provider, TS manager, package.json, config', async () => {
    await writeSecretDetectionFiles(config, tmpDir, 'typescript');
    for (const file of [
      'SECRET_DETECTION.md',
      'secret-detection-aws.tf',
      'secret-detection-azure.tf',
      'secret-detection-gcp.tf',
      'secret-detection-manager.ts',
      'package.json',
      'secret-detection-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python manager + requirements', async () => {
    await writeSecretDetectionFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'secret_detection_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeSecretDetectionFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'secret-detection-config.json'), 'utf-8'));
    expect(json.projectName).toBe('secret-app');
  });
});

describe('displaySecretDetectionConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displaySecretDetectionConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
