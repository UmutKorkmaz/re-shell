import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  generateComplianceReportingMarkdown,
  generateComplianceReportingTerraform,
  generateComplianceManagerTypeScript,
  generateComplianceManagerPython,
  writeComplianceReportingFiles,
  displayComplianceReportingConfig,
} from '../../src/utils/compliance-reporting';

const config: any = {
  projectName: 'comp-project',
  providers: ['aws', 'azure'],
  settings: {
    autoGenerate: true,
    frequency: 'monthly',
    format: 'pdf',
    includeEvidence: true,
    requireApproval: true,
    complianceThreshold: 90,
    generateGapAnalysis: true,
    signReports: false,
    retentionDays: 365,
    notifyOnFailure: true,
    notificationChannels: ['email', 'slack'],
  },
  frameworks: ['SOX', 'GDPR'],
  reports: [],
  controls: [],
  requirements: [],
  evidence: [],
  assessments: [],
  findings: [],
  remediation: [],
  notifications: [],
};

describe('generateComplianceReportingMarkdown', () => {
  it('produces markdown with project and framework info', () => {
    const md = generateComplianceReportingMarkdown(config);
    expect(md).toContain('# SOX, GDPR, HIPAA Compliance Reporting');
    expect(md).toContain('**Project**: comp-project');
    expect(md).toContain('### SOX');
    expect(md).toContain('### GDPR');
  });
});

describe('generateComplianceReportingTerraform', () => {
  it('generates AWS Terraform with S3 bucket', () => {
    const tf = generateComplianceReportingTerraform(config, 'aws');
    expect(tf).toContain('# AWS Compliance Reporting Infrastructure');
    expect(tf).toContain('aws_s3_bucket');
    expect(tf).toContain('comp-project');
  });

  it('generates Azure Terraform', () => {
    const tf = generateComplianceReportingTerraform(config, 'azure');
    expect(tf).toContain('Azure');
  });

  it('generates GCP Terraform', () => {
    const tf = generateComplianceReportingTerraform(config, 'gcp');
    expect(tf).toContain('GCP');
  });
});

describe('generateComplianceManagerTypeScript', () => {
  it('generates TypeScript manager class', () => {
    const ts = generateComplianceManagerTypeScript(config);
    expect(ts).toContain('class ComplianceReportingManager');
    expect(ts.length).toBeGreaterThan(100);
  });
});

describe('generateComplianceManagerPython', () => {
  it('generates Python manager class', () => {
    const py = generateComplianceManagerPython(config);
    expect(py).toContain('class ComplianceReportingManager');
    expect(py.length).toBeGreaterThan(100);
  });
});

describe('writeComplianceReportingFiles', () => {
  it('writes TypeScript files to output directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `comp-rpt-ts-${Date.now()}`);
    await writeComplianceReportingFiles(config, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'COMPLIANCE_REPORTING.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'compliance-reporting-aws.tf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'compliance-reporting-azure.tf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'compliance-reporting-manager.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'compliance-reporting-config.json'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes Python files to output directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `comp-rpt-py-${Date.now()}`);
    await writeComplianceReportingFiles(config, tmpDir, 'python');

    expect(fs.existsSync(path.join(tmpDir, 'COMPLIANCE_REPORTING.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'compliance_reporting_manager.py'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'requirements.txt'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('displayComplianceReportingConfig', () => {
  it('logs config summary without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(() => displayComplianceReportingConfig(config)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
