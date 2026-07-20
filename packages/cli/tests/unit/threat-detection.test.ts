import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generateThreatDetectionMarkdown,
  generateThreatDetectionTerraform,
  generateThreatManagerTypeScript,
  generateThreatManagerPython,
  writeThreatDetectionFiles,
  displayThreatDetectionConfig,
} from '../../src/utils/threat-detection';

const config = {
  projectName: 'threat-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  detectionSettings: {
    enabled: true,
    mode: 'detect-and-respond',
    realtimeAnalysis: true,
    batchAnalysis: true,
    analysisInterval: 5,
    severityThreshold: 'medium',
    autoContainment: false,
    autoQuarantine: false,
    mlEnabled: true,
    mlUpdateFrequency: 7,
    threatIntelEnabled: true,
    behavioralBaseline: true,
    anomalyThreshold: 3,
    falsePositiveRate: 0.05,
    recallRate: 0.95,
    dataSource: ['network', 'endpoint', 'cloud'],
  } as any,
  threats: [],
  mlModels: [],
  responsePlans: [],
  incidents: [],
  analytics: [],
  integrations: [],
} as any;

describe('generateThreatDetectionMarkdown', () => {
  it('references project name', () => {
    expect(generateThreatDetectionMarkdown(config)).toContain('threat-app');
  });
});

describe('generateThreatDetectionTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generateThreatDetectionTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generateThreatDetectionTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generateThreatDetectionTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generateThreatManagerTypeScript', () => {
  it('produces a typescript module', () => {
    expect(generateThreatManagerTypeScript(config)).toMatch(/class|ThreatManager|threat/i);
  });
});

describe('generateThreatManagerPython', () => {
  it('produces a python module', () => {
    expect(generateThreatManagerPython(config)).toMatch(/class|def/i);
  });
});

describe('writeThreatDetectionFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threat-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown, terraform per provider, TS manager, package.json, config', async () => {
    await writeThreatDetectionFiles(config, tmpDir, 'typescript');
    for (const file of [
      'THREAT_DETECTION.md',
      'threat-detection-aws.tf',
      'threat-detection-azure.tf',
      'threat-detection-gcp.tf',
      'threat-detection-manager.ts',
      'package.json',
      'threat-detection-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python manager + requirements', async () => {
    await writeThreatDetectionFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'threat_detection_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writeThreatDetectionFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'threat-detection-config.json'), 'utf-8'));
    expect(json.projectName).toBe('threat-app');
  });
});

describe('displayThreatDetectionConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayThreatDetectionConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
