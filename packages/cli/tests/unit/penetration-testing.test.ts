import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  generatePenetrationTestingMarkdown,
  generatePenetrationTestingTerraform,
  generatePenTestManagerTypeScript,
  generatePenTestManagerPython,
  writePenetrationTestingFiles,
  displayPenetrationTestingConfig,
} from '../../src/utils/penetration-testing';

const config = {
  projectName: 'pentest-app',
  providers: ['aws', 'azure', 'gcp'] as const,
  settings: {
    autoScheduling: true,
    frequency: 'monthly',
    scanMethod: 'gray-box',
    assessmentType: 'hybrid',
    concurrentTests: 3,
    maxDuration: 24,
    allowProduction: false,
    requireApproval: true,
    approvers: ['security-team'],
    notificationChannels: ['slack', 'email'],
    severityThreshold: 'medium',
    autoRemediation: false,
    continuousTesting: true,
    testingWindow: { start: '22:00', end: '06:00', timezone: 'UTC' },
    complianceStandards: ['owasp', 'pci-dss'],
    scope: { allowedTargets: [], excludedTargets: [] },
    credentials: { provided: true, storage: 'vault' },
    safeMode: true,
    detailedReports: true,
    includeFalsePositives: false,
    maxRetries: 2,
    timeout: 3600,
    rate: { enabled: false, requestsPerSecond: 0 },
    fuzzing: { enabled: false, iterations: 0 },
    toolsConfiguration: {},
  } as any,
  tests: [],
  vulnerabilities: [],
  assessments: [],
  reports: [],
  analytics: [],
  integrations: [],
} as any;

describe('generatePenetrationTestingMarkdown', () => {
  it('references project name', () => {
    expect(generatePenetrationTestingMarkdown(config)).toContain('pentest-app');
  });
});

describe('generatePenetrationTestingTerraform', () => {
  it('aws provider emits terraform', () => {
    expect(generatePenetrationTestingTerraform(config, 'aws')).toMatch(/aws|provider/i);
  });

  it('azure provider emits terraform', () => {
    expect(generatePenetrationTestingTerraform(config, 'azure')).toMatch(/azurerm|provider/i);
  });

  it('gcp provider emits terraform', () => {
    expect(generatePenetrationTestingTerraform(config, 'gcp')).toMatch(/google|provider/i);
  });
});

describe('generatePenTestManagerTypeScript', () => {
  it('produces a typescript module', () => {
    expect(generatePenTestManagerTypeScript(config)).toMatch(/class|PenTest|penetration/i);
  });
});

describe('generatePenTestManagerPython', () => {
  it('produces a python module', () => {
    expect(generatePenTestManagerPython(config)).toMatch(/class|def/i);
  });
});

describe('writePenetrationTestingFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pentest-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes markdown, terraform per provider, TS manager, package.json, config', async () => {
    await writePenetrationTestingFiles(config, tmpDir, 'typescript');
    for (const file of [
      'PENETRATION_TESTING.md',
      'penetration-testing-aws.tf',
      'penetration-testing-azure.tf',
      'penetration-testing-gcp.tf',
      'penetration-testing-manager.ts',
      'package.json',
      'penetration-testing-config.json',
    ]) {
      expect(await fs.pathExists(path.join(tmpDir, file))).toBe(true);
    }
  });

  it('writes Python manager + requirements', async () => {
    await writePenetrationTestingFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'penetration_testing_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json mirrors input config', async () => {
    await writePenetrationTestingFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'penetration-testing-config.json'), 'utf-8'));
    expect(json.projectName).toBe('pentest-app');
  });
});

describe('displayPenetrationTestingConfig', () => {
  it('logs without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayPenetrationTestingConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
