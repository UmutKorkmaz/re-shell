import { describe, expect, it, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import {
  codeSecurityAnalysis,
  displayConfig,
  generateMD,
  generateTerraform,
  generateTypeScript,
  generatePython,
  writeFiles,
} from '../../src/utils/code-security-analysis';

const config: any = {
  projectName: 'sec-project',
  providers: ['aws', 'azure'],
  analysisSettings: {
    enabled: true,
    frequency: 'on-commit',
    languages: ['typescript', 'python'],
    severityThreshold: 'critical',
    failOnThreshold: 'blocker',
    scanTests: true,
    scanTestCoverage: true,
    analyzeComplexity: true,
    analyzeDuplication: true,
    analyzeSecurityHotspots: true,
    customRulesEnabled: true,
    aiEnhancedAnalysis: true,
    autoFix: false,
    parallelAnalysis: true,
    maxAnalysisTime: 30,
  },
  codebases: [
    {
      id: 'cb1',
      name: 'frontend',
      language: 'typescript',
      path: '/src/frontend',
      branch: 'main',
      lastCommitSha: 'abc123',
      lastScanned: new Date('2026-01-01'),
      totalFiles: 50,
      totalLines: 5000,
      codeLines: 4000,
      testLines: 1000,
      coverage: 80,
      complexity: 3.5,
      duplication: 5,
      securityRating: 'A',
      reliabilityRating: 'A',
      maintainabilityRating: 'A',
      technicalDebt: 10,
      issues: [],
      hotspots: [],
      metrics: {
        files: [], functions: [], classes: [],
        complexity: [], coverage: [], duplication: [],
      },
    },
  ],
  issues: [
    {
      id: 'issue-1', ruleId: 'ts:S1', title: 'Bug', description: 'desc',
      severity: 'critical', type: 'bug', language: 'typescript',
      file: 'src/app.ts', line: 10, endLine: 10, effort: '5min', debt: '5',
      status: 'open', author: 'dev', createdAt: new Date(), updatedAt: new Date(),
      aiDetected: false, aiConfidence: 0, references: [],
      rule: {} as any, codeSnippet: '',
    },
    {
      id: 'issue-2', ruleId: 'ts:S2', title: 'Smell', description: 'desc',
      severity: 'minor', type: 'code-smell', language: 'typescript',
      file: 'src/util.ts', line: 5, endLine: 5, effort: '2min', debt: '2',
      status: 'open', author: 'dev', createdAt: new Date(), updatedAt: new Date(),
      aiDetected: true, aiConfidence: 0.9, references: [],
      rule: {} as any, codeSnippet: '',
    },
  ],
  rules: [],
  qualityGates: [
    {
      id: 'qg1', name: 'Gate1', description: 'Main gate', conditions: [],
      status: 'passed', lastEvaluation: new Date(), evaluatedBy: 'admin',
    },
  ],
  aiModels: [
    {
      id: 'm1', name: 'GPT-X', type: 'rule-generation', language: 'typescript',
      model: 'gpt-4', version: '1.0', accuracy: 0.95, precision: 0.9,
      recall: 0.88, f1Score: 0.89, trainingDataSize: 10000,
      lastTrained: new Date(), status: 'deployed', features: [], config: {},
    },
  ],
  integrations: [
    {
      tool: 'sonarqube', enabled: true, projectKey: 'sec',
      lastSync: new Date(), status: 'connected',
    },
  ],
  reports: [],
};

describe('codeSecurityAnalysis', () => {
  it('returns a normalized config object', () => {
    const result = codeSecurityAnalysis(config);
    expect(result.projectName).toBe('sec-project');
    expect(result.providers).toEqual(['aws', 'azure']);
    expect(result.codebases).toHaveLength(1);
    expect(result.issues).toHaveLength(2);
  });
});

describe('displayConfig', () => {
  it('logs security analysis summary without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const result = codeSecurityAnalysis(config);
    expect(() => displayConfig(result)).not.toThrow();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('generateMD', () => {
  it('produces markdown with codebases and issue summary', () => {
    const result = codeSecurityAnalysis(config);
    const md = generateMD(result);
    expect(md).toContain('# Code Security Analysis with SonarQube and AI Enhancement');
    expect(md).toContain('### frontend');
    expect(md).toContain('## Security Issues');
    expect(md).toContain('| Severity | Count |');
  });
});

describe('generateTerraform', () => {
  it('generates AWS Terraform', () => {
    const result = codeSecurityAnalysis(config);
    const tf = generateTerraform(result, 'aws');
    expect(tf).toContain('# Code Security Analysis Infrastructure on AWS');
    expect(tf).toContain('resource "aws_ecs_cluster"');
    expect(tf).toContain('sonarqube');
  });

  it('generates Azure Terraform', () => {
    const result = codeSecurityAnalysis(config);
    const tf = generateTerraform(result, 'azure');
    expect(tf).toContain('# Code Security Analysis Infrastructure on Azure');
    expect(tf).toContain('azurerm_container_app');
  });

  it('generates GCP Terraform', () => {
    const result = codeSecurityAnalysis(config);
    const tf = generateTerraform(result, 'gcp');
    expect(tf).toContain('# Code Security Analysis Infrastructure on GCP');
    expect(tf).toContain('google_cloud_run_service');
  });
});

describe('generateTypeScript', () => {
  it('generates TypeScript manager class', () => {
    const result = codeSecurityAnalysis(config);
    const ts = generateTypeScript(result);
    expect(ts).toContain('class CodeSecurityManager');
    expect(ts).toContain('import { EventEmitter }');
    expect(ts).toContain('async scanCodebase');
  });
});

describe('generatePython', () => {
  it('generates Python manager class', () => {
    const result = codeSecurityAnalysis(config);
    const py = generatePython(result);
    expect(py).toContain('class CodeSecurityManager');
    expect(py).toContain('from typing import');
    expect(py).toContain('class SeverityLevel(Enum)');
  });
});

describe('writeFiles', () => {
  it('writes all files for TypeScript output', async () => {
    const tmpDir = path.join(os.tmpdir(), `code-sec-test-${Date.now()}`);
    const result = codeSecurityAnalysis(config);
    await writeFiles(result, tmpDir, 'typescript');

    expect(fs.existsSync(path.join(tmpDir, 'code-security-aws.tf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'code-security-azure.tf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'code-security-manager.ts'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'CODE_SECURITY_ANALYSIS.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'code-security-config.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'package.json'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes all files for Python output', async () => {
    const tmpDir = path.join(os.tmpdir(), `code-sec-test-py-${Date.now()}`);
    const result = codeSecurityAnalysis(config);
    await writeFiles(result, tmpDir, 'python');

    expect(fs.existsSync(path.join(tmpDir, 'code-security-aws.tf'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'code_security_manager.py'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'CODE_SECURITY_ANALYSIS.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'requirements.txt'))).toBe(true);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
