import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCommunicationAnalysisMD,
  generateTerraformCommunicationAnalysis,
  generateTypeScriptCommunicationAnalysis,
  generatePythonCommunicationAnalysis,
  writeFiles,
  communicationAnalysis,
} from '../../src/utils/communication-analysis';

const config = {
  projectName: 'comm-app',
  providers: ['aws' as const],
  patterns: [
    {
      teamId: 't1',
      teamName: 'Backend',
      events: [
        { id: 'e1', channel: 'slack' as const, type: 'message' as const, participants: ['a', 'b'], timestamp: Date.now() },
      ],
      metrics: [
        { channel: 'slack' as const, metric: 'response-time' as const, value: 30, unit: 'min', trend: 'improving' as const, benchmark: 60 },
      ],
      strengths: ['fast response'],
      weaknesses: ['low participation'],
    },
  ],
  insights: [
    { id: 'i1', type: 'bottleneck' as const, title: 'Slow PR reviews', description: 'PRs wait >2 days', impact: 'delivery delay', priority: 'high' as const, actionable: true },
  ],
  enableRealTimeAnalysis: true,
  enableSentimentAnalysis: false,
  enableAutoOptimization: true,
};

describe('communicationAnalysis', () => {
  it('returns the config as-is', () => {
    expect(communicationAnalysis(config)).toBe(config);
  });
});

describe('generateCommunicationAnalysisMD', () => {
  it('generates markdown with title', () => {
    const md = generateCommunicationAnalysisMD(config);
    expect(md).toContain('# Team Communication Pattern Analysis');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateCommunicationAnalysisMD(config);
    expect(md).toContain('Communication channels');
    expect(md).toContain('Slack');
    expect(md).toContain('Sentiment analysis');
  });
});

describe('generateTerraformCommunicationAnalysis', () => {
  it('includes project name', () => {
    const tf = generateTerraformCommunicationAnalysis(config);
    expect(tf).toContain('comm-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformCommunicationAnalysis(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptCommunicationAnalysis', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCommunicationAnalysis(config);
    expect(ts).toContain('CommunicationAnalysisManager');
    expect(ts).toContain('comm-app');
  });
});

describe('generatePythonCommunicationAnalysis', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCommunicationAnalysis(config);
    expect(py).toContain('class CommunicationAnalysisManager');
    expect(py).toContain('comm-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comm-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'communication-analysis.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'communication-analysis-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'COMMUNICATION_ANALYSIS.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'communication-analysis-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'communication_analysis_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('comm-app-communication-analysis');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'communication-analysis-config.json'));
    expect(json.projectName).toBe('comm-app');
    expect(json.enableRealTimeAnalysis).toBe(true);
    expect(json.patterns).toHaveLength(1);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pandas');
    expect(req).toContain('textblob');
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
