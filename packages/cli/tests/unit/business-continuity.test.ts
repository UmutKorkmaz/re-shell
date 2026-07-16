import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  createExampleBCPConfig,
  generateBCPMarkdown,
  generateBCPTerraform,
  generateTypeScriptManager,
  generatePythonManager,
  writeBCPFiles,
  displayBCPConfig,
} from '../../src/utils/business-continuity';

const config = createExampleBCPConfig();

describe('createExampleBCPConfig', () => {
  it('returns a valid config with expected top-level fields', () => {
    expect(config.projectName).toBe('my-bcp');
    expect(config.organization).toBe('Acme Corp');
    expect(config.providers).toContain('aws');
    expect(config.businessUnits.length).toBeGreaterThan(0);
    expect(config.criticalFunctions.length).toBeGreaterThan(0);
  });
});

describe('generateBCPMarkdown', () => {
  it('produces markdown with project overview and business units', () => {
    const md = generateBCPMarkdown(config);
    expect(md).toContain('# Business Continuity and Disaster Recovery Planning');
    expect(md).toContain('**Project:** my-bcp');
    expect(md).toContain('## Business Units');
    expect(md).toContain('## Critical Functions');
    expect(md).toContain('## RTO/RPO Summary');
  });
});

describe('generateBCPTerraform', () => {
  it('generates AWS Terraform with SNS and DynamoDB', () => {
    const tf = generateBCPTerraform(config, 'aws');
    expect(tf).toContain('# Terraform for Business Continuity - AWS');
    expect(tf).toContain('aws_sns_topic');
    expect(tf).toContain('aws_dynamodb_table');
    expect(tf).toContain(config.projectName);
  });

  it('generates Azure Terraform with storage and cosmos', () => {
    const tf = generateBCPTerraform(config, 'azure');
    expect(tf).toContain('# Terraform for Business Continuity - AZURE');
    expect(tf).toContain('azurerm_storage_account');
    expect(tf).toContain('azurerm_cosmosdb_account');
  });

  it('generates GCP Terraform with storage and firestore', () => {
    const tf = generateBCPTerraform(config, 'gcp');
    expect(tf).toContain('# Terraform for Business Continuity - GCP');
    expect(tf).toContain('google_storage_bucket');
    expect(tf).toContain('google_firestore_database');
  });
});

describe('generateTypeScriptManager', () => {
  it('generates TypeScript manager class with enums and methods', () => {
    const ts = generateTypeScriptManager(config);
    expect(ts).toContain('class BusinessContinuityManager');
    expect(ts).toContain('export enum ImpactLevel');
    expect(ts).toContain('export enum RecoveryPriority');
    expect(ts).toContain('createCriticalFunction');
    expect(ts).toContain('executeDRTest');
  });
});

describe('generatePythonManager', () => {
  it('generates Python manager class with enums and dataclasses', () => {
    const py = generatePythonManager(config);
    expect(py).toContain('class BusinessContinuityManager');
    expect(py).toContain('class ImpactLevel(Enum)');
    expect(py).toContain('@dataclass');
    expect(py).toContain('def execute_dr_test');
  });
});

describe('writeBCPFiles', () => {
  it('writes TypeScript files with terraform for each provider', async () => {
    const tmpDir = path.join(os.tmpdir(), `bcp-test-${Date.now()}`);
    await writeBCPFiles(config, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'BCP_GUIDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'bc-manager.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'bcp-config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);

    for (const provider of config.providers) {
      expect(fs.existsSync(path.join(tmpDir, 'terraform', provider, 'main.tf'))).toBe(true);
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes Python files with requirements.txt', async () => {
    const tmpDir = path.join(os.tmpdir(), `bcp-test-py-${Date.now()}`);
    await writeBCPFiles(config, tmpDir, 'python');

    expect(fs.existsSync(path.join(tmpDir, 'BCP_GUIDE.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'bc_manager.py'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'bcp-config.json'))).toBe(true);

    const reqs = fs.readFileSync(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(reqs).toContain('boto3');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayBCPConfig', () => {
  it('logs config summary and writes artifacts without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const tmpDir = path.join(os.tmpdir(), `bcp-display-${Date.now()}`);
    expect(() => displayBCPConfig(config, 'typescript', tmpDir)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
