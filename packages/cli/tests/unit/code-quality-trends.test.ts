import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateQualityTrendMD,
  generateTerraformQualityTrend,
  generateTypeScriptQualityTrend,
  generatePythonQualityTrend,
  writeFiles,
  codeQualityTrends,
} from '../../src/utils/code-quality-trends';

const config = {
  projectName: 'quality-app',
  providers: ['aws' as const],
  metrics: [
    { id: 'm1', name: 'Complexity', type: 'complexity' as const, score: 75, target: 90 },
  ],
  technicalDebt: [
    { id: 'd1', title: 'God class', category: 'code-smell' as const, severity: 'high' as const, description: 'Too large' },
  ],
  recommendations: [
    { id: 'r1', debtId: 'd1', type: 'refactor' as const, priority: 1, title: 'Split class' },
  ],
  enableAutomatedAnalysis: true,
  enableTrendPrediction: false,
  enableDebtPrioritization: true,
};

describe('codeQualityTrends', () => {
  it('returns the config as-is', () => {
    expect(codeQualityTrends(config)).toBe(config);
  });
});

describe('generateQualityTrendMD', () => {
  it('generates markdown with title', () => {
    const md = generateQualityTrendMD(config);
    expect(md).toContain('# Code Quality');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    expect(generateQualityTrendMD(config).toLowerCase()).toContain('quality');
  });
});

describe('generateTerraformQualityTrend', () => {
  it('includes project name', () => {
    expect(generateTerraformQualityTrend(config)).toContain('quality-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformQualityTrend(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptQualityTrend', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptQualityTrend(config);
    expect(ts).toContain('CodeQualityTrendsManager');
    expect(ts).toContain('quality-app');
  });
});

describe('generatePythonQualityTrend', () => {
  it('generates Python manager class', () => {
    const py = generatePythonQualityTrend(config);
    expect(py).toContain('class CodeQualityTrendsManager');
    expect(py).toContain('quality-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cqt-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'code-quality-trends.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'code-quality-trends-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CODE_QUALITY_TRENDS.md'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'code_quality_trends_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('quality-app-code-quality-trends');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = JSON.parse(await fs.readFile(path.join(tmpDir, 'code-quality-trends-config.json'), 'utf-8'));
    expect(json.projectName).toBe('quality-app');
    expect(json.enableAutomatedAnalysis).toBe(true);
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('radon');
    expect(req).toContain('pylint');
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
