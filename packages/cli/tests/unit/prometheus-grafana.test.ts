import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import {
  displayConfig,
  generatePrometheusGrafanaMD,
  generateTerraformMonitoring,
  generateTypeScriptMonitoring,
  generatePythonMonitoring,
  writeFiles,
  prometheusGrafana,
} from '../../src/utils/prometheus-grafana';

const config: any = {
  projectName: 'monitoring-app',
  providers: ['aws', 'gcp'],
  prometheus: {
    enabled: true,
    retentionDays: 30,
    scrapeInterval: '15s',
    evaluationInterval: '30s',
    externalLabels: { cluster: 'prod' },
    globalScrapeConfigs: [
      { jobName: 'app', targets: ['localhost:9090'], scrapeInterval: '15s', metricsPath: '/metrics' },
    ],
  },
  grafana: {
    enabled: true,
    adminPassword: 'secret',
    anonymousAccess: false,
    dashboards: ['overview', 'performance'],
    datasources: [
      { name: 'Prometheus', type: 'prometheus', url: 'http://prom:9090', access: 'proxy' },
    ],
    alerts: { enabled: true, webhookUrl: 'https://hooks.example.com/slack' },
  },
  metrics: [
    { name: 'http_requests_total', type: 'counter', help: 'Total HTTP requests', labels: ['method', 'status'] },
    { name: 'request_duration_seconds', type: 'histogram', help: 'Request duration', labels: ['endpoint'], buckets: [0.1, 0.5, 1, 5] },
  ],
  alerts: [
    { name: 'HighErrorRate', expr: 'rate(http_requests_total[5m]) > 0.1', for: '5m', labels: { severity: 'critical' }, annotations: { summary: 'High error rate' } },
  ],
  enableRecordingRules: true,
  enableAlerting: true,
};

describe('displayConfig', () => {
  it('logs summary of monitoring configuration', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    displayConfig(config);
    expect(spy).toHaveBeenCalled();
    const out = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(out).toContain('monitoring-app');
    expect(out).toContain('aws');
    expect(out).toContain('gcp');
    expect(out).toContain('Yes'); // Prometheus/Grafana
    spy.mockRestore();
  });
});

describe('generatePrometheusGrafanaMD', () => {
  it('returns markdown with feature list and usage examples', () => {
    const md = generatePrometheusGrafanaMD(config);
    expect(md).toContain('# Prometheus/Grafana Integration');
    expect(md).toContain('Prometheus metrics collection');
    expect(md).toContain('Grafana dashboards');
    expect(md).toContain('Multi-cloud');
    expect(md).toContain('prometheus --config.file');
  });
});

describe('generateTerraformMonitoring', () => {
  it('returns Terraform header with project name', () => {
    const tf = generateTerraformMonitoring(config);
    expect(tf).toContain('monitoring-app');
    expect(tf).toContain('# Auto-generated Prometheus/Grafana Terraform');
  });
});

describe('generateTypeScriptMonitoring', () => {
  it('generates a TypeScript manager with project name', () => {
    const code = generateTypeScriptMonitoring(config);
    expect(code).toContain('monitoring-app');
    expect(code).toMatch(/class\s+\w+Manager|Manager/);
  });
});

describe('generatePythonMonitoring', () => {
  it('generates a Python manager with project name', () => {
    const code = generatePythonMonitoring(config);
    expect(code).toContain('monitoring-app');
    expect(code).toMatch(/class\s+\w+Manager/);
  });
});

describe('prometheusGrafana passthrough', () => {
  it('returns the same config that was provided', () => {
    expect(prometheusGrafana(config)).toBe(config);
  });
});

describe('writeFiles', () => {
  let tmpDir: string;
  beforeEach(async () => { tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pg-')); });
  afterEach(async () => { await fs.remove(tmpDir); });

  it('writes TypeScript language files', async () => {
    await writeFiles(config, tmpDir, 'typescript');
    expect(await fs.pathExists(path.join(tmpDir, 'monitoring.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'prometheus-grafana-manager.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'package.json'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'PROMETHEUS_GRAFANA.md'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'monitoring-config.json'))).toBe(true);

    const pkg = await fs.readJson(path.join(tmpDir, 'package.json'));
    expect(pkg.name).toBe('monitoring-app-prometheus-grafana');
    expect(pkg.scripts).toHaveProperty('init');

    const stored = await fs.readJson(path.join(tmpDir, 'monitoring-config.json'));
    expect(stored.projectName).toBe('monitoring-app');
    expect(stored.metrics.length).toBe(2);
  });

  it('writes Python language files', async () => {
    await writeFiles(config, tmpDir, 'python');
    expect(await fs.pathExists(path.join(tmpDir, 'monitoring.tf'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'prometheus_grafana_manager.py'))).toBe(true);
    expect(await fs.pathExists(path.join(tmpDir, 'requirements.txt'))).toBe(true);
    const reqs = await fs.readFile(path.join(tmpDir, 'requirements.txt'), 'utf8');
    expect(reqs).toContain('prometheus-client');
    expect(reqs).toContain('grafana-api');
  });
});
