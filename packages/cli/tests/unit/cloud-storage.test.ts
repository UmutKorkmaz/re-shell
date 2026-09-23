import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCloudStorageMD,
  generateTerraformStorage,
  generateTypeScriptCloudStorage,
  generatePythonCloudStorage,
  writeFiles,
} from '../../src/utils/cloud-storage';

const config = {
  projectName: 'cs-app',
  providers: ['aws' as const],
  governance: {
    dataClassification: {
      enabled: true,
      levels: ['public' as const, 'internal' as const],
      autoClassification: false,
    },
    retentionPolicies: {
      enabled: true,
      rules: [{ dataType: 'logs', retentionPeriod: 90 }],
    },
    auditLogging: {
      enabled: true,
      logLevel: 'INFO' as const,
      retentionDays: 365,
    },
    compliance: {
      standards: ['GDPR' as const],
      automatedChecks: true,
    },
  },
};

describe('generateCloudStorageMD', () => {
  it('generates markdown with title', () => {
    const md = generateCloudStorageMD(config);
    expect(md).toContain('# Cloud Storage Integration');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateCloudStorageMD(config).toLowerCase()).toContain('storage');
  });
});

describe('generateTerraformStorage', () => {
  it('includes project name', () => {
    expect(generateTerraformStorage(config)).toContain('cs-app');
  });
});

describe('generateTypeScriptCloudStorage', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCloudStorage(config);
    expect(ts).toContain('CloudStorageManager');
    expect(ts).toContain('cs-app');
  });
});

describe('generatePythonCloudStorage', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCloudStorage(config);
    expect(py).toContain('class CloudStorageManager');
    expect(py).toContain('cs-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cs-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'storage.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'cloud-storage-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CLOUD_STORAGE.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'cloud_storage_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('cs-app-cloud-storage');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'storage-config.json'), 'utf-8'));
    expect(json.projectName).toBe('cs-app');
    expect(json.governance.auditLogging.enabled).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('boto3');
    expect(req).toContain('azure-storage-blob');
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
