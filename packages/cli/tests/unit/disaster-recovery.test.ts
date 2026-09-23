import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateDisasterRecoveryMD,
  generateTerraformDR,
  generateTypeScriptDRManager,
  generatePythonDRManager,
  writeFiles,
} from '../../src/utils/disaster-recovery';

const config = {
  projectName: 'dr-app',
  primaryRegion: 'us-east-1',
  drRegion: 'us-west-2',
  providers: ['aws' as const],
  replication: {
    enabled: true,
    sourceRegion: 'us-east-1',
    destinationRegion: 'us-west-2',
    replicationLagThreshold: 5,
    consistency: 'strong' as const,
  },
  backup: {
    enabled: true,
    type: 'snapshot' as const,
    schedule: {
      frequency: 'daily',
      retentionDays: 30,
      backupWindow: '03:00-05:00',
      compression: true,
      encryption: true,
    },
    crossRegionBackup: true,
  },
  failover: {
    strategy: 'active-passive' as const,
    trigger: 'automatic' as const,
    healthCheckInterval: 30,
    healthCheckTimeout: 10,
    unhealthyThreshold: 3,
    dnsFailover: true,
    loadBalancerFailover: true,
  },
  testing: {
    enabled: true,
    schedule: 'monthly',
    testScenarios: ['region-outage' as const],
    automatedFailoverTest: true,
    dataIntegrityCheck: true,
    performanceValidation: false,
  },
  rto: 60,
  rpo: 15,
};

describe('generateDisasterRecoveryMD', () => {
  it('generates markdown with title', () => {
    const md = generateDisasterRecoveryMD(config);
    expect(md).toContain('# Cross-Cloud Disaster Recovery');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateDisasterRecoveryMD(config).toLowerCase()).toContain('backup');
  });
});

describe('generateTerraformDR', () => {
  it('includes project name', () => {
    expect(generateTerraformDR(config)).toContain('dr-app');
  });
});

describe('generateTypeScriptDRManager', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptDRManager(config);
    expect(ts).toContain('DRManager');
    expect(ts).toContain('dr-app');
  });
});

describe('generatePythonDRManager', () => {
  it('generates Python manager class', () => {
    const py = generatePythonDRManager(config);
    expect(py).toContain('class DRManager');
    expect(py).toContain('dr-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dr-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'dr.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'dr-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'DISASTER_RECOVERY.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'dr_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'dr-config.json'), 'utf-8'));
    expect(json.projectName).toBe('dr-app');
    expect(json.rto).toBe(60);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('boto3');
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
