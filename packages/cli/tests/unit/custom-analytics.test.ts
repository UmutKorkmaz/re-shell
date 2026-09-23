import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateCustomAnalyticsMD,
  generateTerraformCustomAnalytics,
  generateTypeScriptCustomAnalytics,
  generatePythonCustomAnalytics,
  writeFiles,
  customAnalytics,
} from '../../src/utils/custom-analytics';

const config = {
  projectName: 'analytics-app',
  providers: ['gcp' as const],
  reports: [
    {
      id: 'r1',
      name: 'Revenue Report',
      type: 'executive' as const,
      description: 'Monthly revenue',
      metrics: [
        { id: 'm1', name: 'MRR', formula: 'sum(revenue)', aggregation: 'sum' as const, format: 'currency' },
      ],
      filters: { region: 'us-east' },
      groupBy: ['month'],
      orderBy: 'month DESC',
      limit: 12,
    },
  ],
  dashboards: [
    {
      id: 'd1',
      name: 'Executive Dashboard',
      description: 'C-level overview',
      reports: ['r1'],
      layout: [{ reportId: 'r1', position: { x: 0, y: 0, w: 6, h: 4 } }],
      refreshInterval: 300,
    },
  ],
  drillDown: {
    level: 'detailed' as const,
    dimensions: ['region', 'product'],
    availableFilters: ['date', 'region'],
    maxDepth: 5,
  },
  enableScheduledReports: true,
  enableRealTimeUpdates: false,
  enableDataExport: true,
};

describe('customAnalytics', () => {
  it('returns the config as-is', () => {
    expect(customAnalytics(config)).toBe(config);
  });
});

describe('generateCustomAnalyticsMD', () => {
  it('generates markdown with title', () => {
    const md = generateCustomAnalyticsMD(config);
    expect(md).toContain('# Custom Analytics');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateCustomAnalyticsMD(config);
    expect(md).toContain('Report types');
    expect(md).toContain('Drill-down');
    expect(md).toContain('Export formats');
  });
});

describe('generateTerraformCustomAnalytics', () => {
  it('includes project name', () => {
    expect(generateTerraformCustomAnalytics(config)).toContain('analytics-app');
  });

  it('includes ISO timestamp', () => {
    expect(generateTerraformCustomAnalytics(config)).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});

describe('generateTypeScriptCustomAnalytics', () => {
  it('generates TS manager class', () => {
    const ts = generateTypeScriptCustomAnalytics(config);
    expect(ts).toContain('CustomAnalyticsManager');
    expect(ts).toContain('analytics-app');
  });
});

describe('generatePythonCustomAnalytics', () => {
  it('generates Python manager class', () => {
    const py = generatePythonCustomAnalytics(config);
    expect(py).toContain('class CustomAnalyticsManager');
    expect(py).toContain('analytics-app');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'analytics-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'custom-analytics.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'custom-analytics-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'CUSTOM_ANALYTICS.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'custom-analytics-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'custom_analytics_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('analytics-app-custom-analytics');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'custom-analytics-config.json'));
    expect(json.projectName).toBe('analytics-app');
    expect(json.reports).toHaveLength(1);
    expect(json.drillDown.level).toBe('detailed');
  });

  it('requirements.txt contains expected deps', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('pandas');
    expect(req).toContain('plotly');
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
