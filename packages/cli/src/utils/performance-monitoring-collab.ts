// Auto-generated Performance Monitoring Collaboration Utility
// Generated at: 2026-01-13T13:45:00.000Z

type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
type VisualizationType = 'line' | 'bar' | 'pie' | 'heatmap' | 'gauge' | 'table';
type DataSource = 'prometheus' | 'grafana' | 'datadog' | 'cloudwatch' | 'stackdriver' | 'influxdb';
type RefreshInterval = '5s' | '10s' | '30s' | '1m' | '5m' | '15m';

interface MetricDefinition {
  id: string;
  name: string;
  type: MetricType;
  query: string;
  dataSource: DataSource;
  labels: { [key: string]: string };
}

interface DashboardWidget {
  id: string;
  title: string;
  type: VisualizationType;
  metrics: MetricDefinition[];
  position: { x: number; y: number; w: number; h: number };
  refreshInterval: RefreshInterval;
  drillingEnabled: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  duration: string;
  severity: 'info' | 'warning' | 'critical';
  notificationChannels: string[];
}

interface CollaborationConfig {
  enableSharedDashboards: boolean;
  enableRealTimeUpdates: boolean;
  enableAnnotations: boolean;
  enableCollaborativeEditing: boolean;
  maxViewers: number;
  maxEditors: number;
}

interface PerformanceMonitoringCollabConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  dashboards: { id: string; name: string; widgets: DashboardWidget[] }[];
  widgets: DashboardWidget[];
  alerts: AlertRule[];
  collaboration: CollaborationConfig;
  enableExport: boolean;
  enableScheduling: boolean;
}

export function displayConfig(config: PerformanceMonitoringCollabConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '📊 Real-Time Performance Monitoring Collaboration');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Dashboards:', config.dashboards.length);
  console.log('\x1b[33m%s\x1b[0m', 'Widgets:', config.widgets.length);
  console.log('\x1b[33m%s\x1b[0m', 'Alert Rules:', config.alerts.length);
  console.log('\x1b[33m%s\x1b[0m', 'Shared Dashboards:', config.collaboration.enableSharedDashboards ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Real-time Updates:', config.collaboration.enableRealTimeUpdates ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Annotations:', config.collaboration.enableAnnotations ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Collaborative Editing:', config.collaboration.enableCollaborativeEditing ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Max Viewers:', config.collaboration.maxViewers);
  console.log('\x1b[33m%s\x1b[0m', 'Max Editors:', config.collaboration.maxEditors);
  console.log('\x1b[33m%s\x1b[0m', 'Export:', config.enableExport ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Scheduling:', config.enableScheduling ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generatePerformanceMonitoringCollabMD(config: PerformanceMonitoringCollabConfig): string {
  let md = '# Real-Time Performance Monitoring Collaboration\n\n';
  md += '## Features\n\n';
  md += '- Multiple data sources (Prometheus, Grafana, Datadog, CloudWatch, Stackdriver, InfluxDB)\n';
  md += '- Metric types: counter, gauge, histogram, summary\n';
  md += '- Visualization types: line, bar, pie, heatmap, gauge, table\n';
  md += '- Shared dashboards with real-time updates\n';
  md += '- Collaborative dashboard editing\n';
  md += '- Annotations for events and incidents\n';
  md += '- Alert rules with thresholds and notifications\n';
  md += '- Drill-down capabilities\n';
  md += '- Configurable refresh intervals\n';
  md += '- Dashboard export and scheduling\n';
  md += '- Role-based access (viewers and editors)\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

export function generateTerraformPerformanceMonitoringCollab(config: PerformanceMonitoringCollabConfig): string {
  let code = '# Auto-generated Performance Monitoring Collaboration Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

export function generateTypeScriptPerformanceMonitoringCollab(config: PerformanceMonitoringCollabConfig): string {
  let code = '// Auto-generated Performance Monitoring Collaboration Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class PerformanceMonitoringCollabManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const performanceMonitoringCollabManager = new PerformanceMonitoringCollabManager();\n';
  code += 'export default performanceMonitoringCollabManager;\n';
  return code;
}

export function generatePythonPerformanceMonitoringCollab(config: PerformanceMonitoringCollabConfig): string {
  let code = '# Auto-generated Performance Monitoring Collaboration Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class PerformanceMonitoringCollabManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'performance_monitoring_collab_manager = PerformanceMonitoringCollabManager()\n';
  return code;
}

export async function writeFiles(config: PerformanceMonitoringCollabConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformPerformanceMonitoringCollab(config);
  await fs.writeFile(path.join(outputDir, 'performance-monitoring-collab.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptPerformanceMonitoringCollab(config);
    await fs.writeFile(path.join(outputDir, 'performance-monitoring-collab-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-performance-monitoring-collab',
      version: '1.0.0',
      description: 'Real-Time Performance Monitoring Collaboration',
      main: 'performance-monitoring-collab-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonPerformanceMonitoringCollab(config);
    await fs.writeFile(path.join(outputDir, 'performance_monitoring_collab_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'prometheus-client>=0.17.0', 'grafana-api>=1.0.3'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generatePerformanceMonitoringCollabMD(config);
  await fs.writeFile(path.join(outputDir, 'PERFORMANCE_MONITORING_COLLAB.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    dashboards: config.dashboards,
    widgets: config.widgets,
    alerts: config.alerts,
    collaboration: config.collaboration,
    enableExport: config.enableExport,
    enableScheduling: config.enableScheduling,
  };
  await fs.writeFile(path.join(outputDir, 'performance-monitoring-collab-config.json'), JSON.stringify(configJson, null, 2));
}

export function performanceMonitoringCollab(config: PerformanceMonitoringCollabConfig): PerformanceMonitoringCollabConfig {
  return config;
}
