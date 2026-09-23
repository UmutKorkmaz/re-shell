import { describe, it, expect } from 'vitest';

import {
  displayConfig,
  generatePerformanceMonitoringCollabMD,
  generateTerraformPerformanceMonitoringCollab,
  generateTypeScriptPerformanceMonitoringCollab,
  generatePythonPerformanceMonitoringCollab,
  writeFiles,
  performanceMonitoringCollab,
} from '../../src/utils/performance-monitoring-collab';

const baseConfig = {
  projectName: 'perftest',
  providers: ['aws' as const, 'gcp' as const],
  dashboards: [
    {
      id: 'd1',
      name: 'Main',
      widgets: [],
    },
  ],
  widgets: [],
  alerts: [
    {
      id: 'a1',
      name: 'HighCPU',
      condition: 'rate(cpu_usage[5m]) > 0.8',
      threshold: 0.8,
      duration: '5m',
      severity: 'warning' as const,
      notificationChannels: ['slack:ops'],
    },
  ],
  collaboration: {
    enableSharedDashboards: true,
    enableRealTimeUpdates: true,
    enableAnnotations: false,
    enableCollaborativeEditing: false,
    maxViewers: 20,
    maxEditors: 4,
  },
  enableExport: true,
  enableScheduling: false,
};

describe('performance-monitoring-collab', () => {
  describe('performanceMonitoringCollab passthrough', () => {
    it('returns the same config reference', () => {
      expect(performanceMonitoringCollab(baseConfig)).toBe(baseConfig);
    });
  });

  describe('displayConfig', () => {
    it('does not throw', () => {
      expect(() => displayConfig(baseConfig)).not.toThrow();
    });
  });

  describe('generatePerformanceMonitoringCollabMD', () => {
    it('renders the title header', () => {
      const md = generatePerformanceMonitoringCollabMD(baseConfig);
      expect(md).toContain('# Real-Time Performance Monitoring Collaboration');
    });

    it('lists the supported data sources', () => {
      const md = generatePerformanceMonitoringCollabMD(baseConfig);
      expect(md).toContain('Prometheus');
      expect(md).toContain('Grafana');
      expect(md).toContain('Datadog');
      expect(md).toContain('CloudWatch');
      expect(md).toContain('Stackdriver');
      expect(md).toContain('InfluxDB');
    });

    it('lists the visualization types', () => {
      const md = generatePerformanceMonitoringCollabMD(baseConfig);
      expect(md).toContain('line');
      expect(md).toContain('bar');
      expect(md).toContain('pie');
      expect(md).toContain('heatmap');
      expect(md).toContain('gauge');
      expect(md).toContain('table');
    });
  });

  describe('generateTerraformPerformanceMonitoringCollab', () => {
    it('embeds the project name in the comment header', () => {
      const tf = generateTerraformPerformanceMonitoringCollab(baseConfig);
      expect(tf).toContain('perftest');
      expect(tf).toContain('Auto-generated Performance Monitoring Collaboration Terraform');
    });

    it('emits an ISO 8601 timestamp', () => {
      const tf = generateTerraformPerformanceMonitoringCollab(baseConfig);
      expect(tf).toMatch(/Generated at: \d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('generateTypeScriptPerformanceMonitoringCollab', () => {
    it('embeds the project name in the comment header', () => {
      const ts = generateTypeScriptPerformanceMonitoringCollab(baseConfig);
      expect(ts).toContain('perftest');
      expect(ts).toContain('Auto-generated Performance Monitoring Collaboration Manager');
    });

    it('imports EventEmitter and declares the manager class', () => {
      const ts = generateTypeScriptPerformanceMonitoringCollab(baseConfig);
      expect(ts).toContain("import { EventEmitter } from 'events';");
      expect(ts).toContain('class PerformanceMonitoringCollabManager extends EventEmitter');
    });

    it('exports the manager instance as default', () => {
      const ts = generateTypeScriptPerformanceMonitoringCollab(baseConfig);
      expect(ts).toContain('export default performanceMonitoringCollabManager;');
    });
  });

  describe('generatePythonPerformanceMonitoringCollab', () => {
    it('embeds the project name in the comment header', () => {
      const py = generatePythonPerformanceMonitoringCollab(baseConfig);
      expect(py).toContain('perftest');
      expect(py).toContain('Auto-generated Performance Monitoring Collaboration Manager');
    });

    it('imports asyncio and typing', () => {
      const py = generatePythonPerformanceMonitoringCollab(baseConfig);
      expect(py).toContain('import asyncio');
      expect(py).toContain('from typing import Dict, Any');
    });

    it('uses the project name as the __init__ default argument', () => {
      const py = generatePythonPerformanceMonitoringCollab(baseConfig);
      expect(py).toContain('def __init__(self, project_name: str = "perftest")');
    });
  });

  describe('writeFiles', () => {
    it('writes TypeScript artifacts when language=typescript', async () => {
      const fs = await import('fs-extra');
      const path = await import('path');
      const tmp = `/tmp/perfmon-test-${Date.now()}`;
      await fs.ensureDir(tmp);
      try {
        await writeFiles(baseConfig, tmp, 'typescript');
        const files = await fs.readdir(tmp);
        expect(files).toEqual(
          expect.arrayContaining([
            'performance-monitoring-collab.tf',
            'performance-monitoring-collab-manager.ts',
            'package.json',
            'PERFORMANCE_MONITORING_COLLAB.md',
            'performance-monitoring-collab-config.json',
          ])
        );

        const pkgJson = JSON.parse(
          await fs.readFile(path.join(tmp, 'package.json'), 'utf-8')
        );
        expect(pkgJson.name).toBe('perftest-performance-monitoring-collab');

        const configJson = JSON.parse(
          await fs.readFile(path.join(tmp, 'performance-monitoring-collab-config.json'), 'utf-8')
        );
        expect(configJson.projectName).toBe('perftest');
        expect(configJson.enableExport).toBe(true);
      } finally {
        await fs.remove(tmp);
      }
    });

    it('writes Python artifacts when language != typescript', async () => {
      const fs = await import('fs-extra');
      const path = await import('path');
      const tmp = `/tmp/perfmon-test-${Date.now()}`;
      await fs.ensureDir(tmp);
      try {
        await writeFiles(baseConfig, tmp, 'python');
        const files = await fs.readdir(tmp);
        expect(files).toEqual(
          expect.arrayContaining([
            'performance-monitoring-collab.tf',
            'performance_monitoring_collab_manager.py',
            'requirements.txt',
            'PERFORMANCE_MONITORING_COLLAB.md',
            'performance-monitoring-collab-config.json',
          ])
        );

        const requirements = (
          await fs.readFile(path.join(tmp, 'requirements.txt'), 'utf-8')
        ).split('\n');
        expect(requirements.some(r => r.startsWith('prometheus-client'))).toBe(true);
      } finally {
        await fs.remove(tmp);
      }
    });
  });
});
