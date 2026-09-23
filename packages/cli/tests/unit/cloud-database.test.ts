import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCloudDatabaseMD,
  generateTerraformDatabase,
  generateTypeScriptCloudDatabase,
  generatePythonCloudDatabase,
  writeFiles,
} from '../../src/utils/cloud-database';

const config = {
  projectName: 'cdb-app',
  engine: 'postgres' as const,
  version: '15.3',
  providers: ['aws' as const],
  disasterRecovery: {
    enabled: true,
    crossRegionReplication: true,
    failoverStrategy: 'automatic' as const,
    replicationLagThreshold: 5,
    drRegion: 'us-west-2',
  },
  monitoring: {
    enabled: true,
    metricsRetention: 30,
    alertingEnabled: true,
    performanceInsights: true,
  },
};

describe('generateCloudDatabaseMD', () => {
  it('generates markdown with title', () => {
    const md = generateCloudDatabaseMD(config);
    expect(md).toContain('# Cloud-Native Database');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateCloudDatabaseMD(config).toLowerCase()).toContain('database');
  });
});

describe('generateTerraformDatabase', () => {
  it('includes project name', () => {
    expect(generateTerraformDatabase(config)).toContain('cdb-app');
  });
});

describe('generateTypeScriptCloudDatabase', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCloudDatabase(config);
    expect(ts).toContain('CloudDatabaseManager');
    expect(ts).toContain('cdb-app');
  });
});

describe('generatePythonCloudDatabase', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCloudDatabase(config);
    expect(py).toContain('class CloudDatabaseManager');
    expect(py).toContain('cdb-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdb-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'database.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'cloud-database-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CLOUD_DATABASE.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'cloud_database_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('cdb-app-cloud-database');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'database-config.json'), 'utf-8'));
    expect(json.projectName).toBe('cdb-app');
    expect(json.engine).toBe('postgres');
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('boto3');
    expect(req).toContain('azure-cosmos');
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
