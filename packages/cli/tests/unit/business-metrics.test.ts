import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generateBusinessMetricsMD,
  generateTerraformBusinessMetrics,
  generateTypeScriptBusinessMetrics,
  generatePythonBusinessMetrics,
  writeFiles,
  businessMetrics,
} from '../../src/utils/business-metrics';

const config = {
  projectName: 'metrics-app',
  providers: ['aws' as const, 'gcp' as const],
  metrics: [
    {
      name: 'revenue',
      type: 'counter' as const,
      category: 'revenue' as const,
      description: 'Total revenue',
      aggregation: 'sum' as const,
      unit: 'USD',
      tags: ['finance'],
    },
  ],
  kpis: [
    {
      name: 'mrr',
      metric: 'revenue',
      target: 100000,
      warningThreshold: 80000,
      criticalThreshold: 60000,
      timeWindow: '30d',
      calculation: 'sum(revenue)',
    },
  ],
  dashboard: {
    provider: 'grafana' as const,
    url: 'https://grafana.example.com',
    refreshInterval: 30,
    enabled: true,
  },
  enableRealTime: true,
  enableAlerting: false,
  enableReporting: true,
};

describe('businessMetrics', () => {
  it('returns the config as-is', () => {
    const result = businessMetrics(config);
    expect(result).toBe(config);
  });
});

describe('generateBusinessMetricsMD', () => {
  it('generates markdown with title', () => {
    const md = generateBusinessMetricsMD(config);
    expect(md).toContain('# Business Metrics and KPI Tracking');
    expect(md).toContain('## Features');
  });

  it('includes feature descriptions', () => {
    const md = generateBusinessMetricsMD(config);
    expect(md).toContain('Real-time business metrics');
    expect(md).toContain('Custom KPI definitions');
    expect(md).toContain('Multi-category metrics');
    expect(md).toContain('Multi-cloud provider support');
  });
});

describe('generateTerraformBusinessMetrics', () => {
  it('includes project name', () => {
    const tf = generateTerraformBusinessMetrics(config);
    expect(tf).toContain('metrics-app');
    expect(tf).toContain('Terraform');
  });

  it('includes ISO timestamp', () => {
    const tf = generateTerraformBusinessMetrics(config);
    expect(tf).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('generateTypeScriptBusinessMetrics', () => {
  it('generates TypeScript manager class', () => {
    const ts = generateTypeScriptBusinessMetrics(config);
    expect(ts).toContain('BusinessMetricsManager');
    expect(ts).toContain('extends EventEmitter');
    expect(ts).toContain('export default');
    expect(ts).toContain('metrics-app');
  });
});

describe('generatePythonBusinessMetrics', () => {
  it('generates Python manager class', () => {
    const py = generatePythonBusinessMetrics(config);
    expect(py).toContain('class BusinessMetricsManager');
    expect(py).toContain('metrics-app');
    expect(py).toContain('import asyncio');
  });
});

describe('writeFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'biz-metrics-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('writes TypeScript output files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'business-metrics.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'business-metrics-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'BUSINESS_METRICS.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'business-metrics-config.json'))).toBe(true);
  });

  it('writes Python output files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'business-metrics.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'business_metrics_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'BUSINESS_METRICS.md'))).toBe(true);
  });

  it('package.json has correct name', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('metrics-app-business-metrics');
    expect(pkg.dependencies).toHaveProperty('@types/node');
  });

  it('config.json contains all config fields', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    const json = await fs.readJson(path.join(tmpDir, 'business-metrics-config.json'));
    expect(json.projectName).toBe('metrics-app');
    expect(json.metrics).toHaveLength(1);
    expect(json.kpis).toHaveLength(1);
    expect(json.dashboard.provider).toBe('grafana');
    expect(json.enableRealTime).toBe(true);
  });

  it('requirements.txt contains expected deps for Python', async () => {
    await writeFiles(config, tmpDir, 'python');
    const req = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf-8');
    expect(req).toContain('prometheus-client');
    expect(req).toContain('grafana-api');
  });
});

describe('displayConfig', () => {
  it('logs config without throwing', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
