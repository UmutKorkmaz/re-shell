// Auto-generated Performance Monitoring Collaboration Utility
// Generated at: 2026-01-13T13:45:00.000Z

import chalk from 'chalk';

/**
 * Supported metric types for performance monitoring.
 */
type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * Supported visualization types for dashboard widgets.
 */
type VisualizationType = 'line' | 'bar' | 'pie' | 'heatmap' | 'gauge' | 'table';

/**
 * Supported data sources from which metrics can be queried.
 */
type DataSource = 'prometheus' | 'grafana' | 'datadog' | 'cloudwatch' | 'stackdriver' | 'influxdb';

/**
 * Supported refresh intervals for dashboard widgets.
 */
type RefreshInterval = '5s' | '10s' | '30s' | '1m' | '5m' | '15m';

/**
 * Definition of a single performance metric.
 */
interface MetricDefinition {
  /** Unique identifier for the metric. */
  id: string;
  /** Human-readable name of the metric. */
  name: string;
  /** The type of the metric (counter, gauge, histogram, or summary). */
  type: MetricType;
  /** Query string used to fetch the metric from its data source. */
  query: string;
  /** The data source from which this metric is queried. */
  dataSource: DataSource;
  /** Key/value labels associated with the metric. */
  labels: { [key: string]: string };
}

/**
 * Definition of a dashboard widget that visualizes one or more metrics.
 */
interface DashboardWidget {
  /** Unique identifier for the widget. */
  id: string;
  /** Title displayed at the top of the widget. */
  title: string;
  /** Visualization type used to render the widget. */
  type: VisualizationType;
  /** Metrics rendered by this widget. */
  metrics: MetricDefinition[];
  /** Grid position and dimensions (x, y, width, height) of the widget. */
  position: { x: number; y: number; w: number; h: number };
  /** Interval at which the widget refreshes its data. */
  refreshInterval: RefreshInterval;
  /** Whether drill-down navigation is enabled for the widget. */
  drillingEnabled: boolean;
}

/**
 * Definition of an alert rule that fires when a metric crosses a threshold.
 */
interface AlertRule {
  /** Unique identifier for the alert rule. */
  id: string;
  /** Human-readable name of the alert rule. */
  name: string;
  /** Condition expression evaluated against the metric. */
  condition: string;
  /** Numeric threshold that triggers the alert when crossed. */
  threshold: number;
  /** Duration the condition must hold before the alert fires. */
  duration: string;
  /** Severity level of the alert. */
  severity: 'info' | 'warning' | 'critical';
  /** List of notification channels to notify when the alert fires. */
  notificationChannels: string[];
}

/**
 * Configuration options controlling collaboration behavior.
 */
interface CollaborationConfig {
  /** Whether shared dashboards are enabled. */
  enableSharedDashboards: boolean;
  /** Whether real-time updates are enabled for collaborators. */
  enableRealTimeUpdates: boolean;
  /** Whether annotations (events, incidents) are enabled. */
  enableAnnotations: boolean;
  /** Whether multiple users can edit dashboards concurrently. */
  enableCollaborativeEditing: boolean;
  /** Maximum number of concurrent viewers allowed. */
  maxViewers: number;
  /** Maximum number of concurrent editors allowed. */
  maxEditors: number;
}

/**
 * Top-level configuration for the performance monitoring collaboration feature.
 */
interface PerformanceMonitoringCollabConfig {
  /** Name of the project this configuration applies to. */
  projectName: string;
  /** Cloud providers targeted by this configuration. */
  providers: ('aws' | 'azure' | 'gcp')[];
  /** Dashboards and the widgets they contain. */
  dashboards: { id: string; name: string; widgets: DashboardWidget[] }[];
  /** Top-level widgets not bound to a specific dashboard. */
  widgets: DashboardWidget[];
  /** Alert rules associated with this configuration. */
  alerts: AlertRule[];
  /** Collaboration settings for shared dashboards. */
  collaboration: CollaborationConfig;
  /** Whether dashboard export is enabled. */
  enableExport: boolean;
  /** Whether dashboard scheduling is enabled. */
  enableScheduling: boolean;
}

/**
 * Prints a human-readable summary of the performance monitoring collaboration
 * configuration to the console.
 *
 * @param config - The performance monitoring collaboration configuration to display.
 * @returns Nothing; output is written to the console.
 */
export function displayConfig(config: PerformanceMonitoringCollabConfig): void {
  console.log(chalk.cyan('📊 Real-Time Performance Monitoring Collaboration'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Dashboards:'), config.dashboards.length);
  console.log(chalk.yellow('Widgets:'), config.widgets.length);
  console.log(chalk.yellow('Alert Rules:'), config.alerts.length);
  console.log(chalk.yellow('Shared Dashboards:'), config.collaboration.enableSharedDashboards ? 'Yes' : 'No');
  console.log(chalk.yellow('Real-time Updates:'), config.collaboration.enableRealTimeUpdates ? 'Yes' : 'No');
  console.log(chalk.yellow('Annotations:'), config.collaboration.enableAnnotations ? 'Yes' : 'No');
  console.log(chalk.yellow('Collaborative Editing:'), config.collaboration.enableCollaborativeEditing ? 'Yes' : 'No');
  console.log(chalk.yellow('Max Viewers:'), config.collaboration.maxViewers);
  console.log(chalk.yellow('Max Editors:'), config.collaboration.maxEditors);
  console.log(chalk.yellow('Export:'), config.enableExport ? 'Yes' : 'No');
  console.log(chalk.yellow('Scheduling:'), config.enableScheduling ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown overview document describing the performance monitoring
 * collaboration feature and its capabilities.
 *
 * @param config - The performance monitoring collaboration configuration to document.
 * @returns A Markdown string summarizing the feature set.
 */
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

/**
 * Generates a Terraform header snippet for the performance monitoring
 * collaboration resources associated with the given project.
 *
 * @param config - The performance monitoring collaboration configuration.
 * @returns A Terraform code string (header/comment block) for the project.
 */
export function generateTerraformPerformanceMonitoringCollab(config: PerformanceMonitoringCollabConfig): string {
  let code = '# Auto-generated Performance Monitoring Collaboration Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript stub module that exports a
 * `PerformanceMonitoringCollabManager` instance for the given project.
 *
 * @param config - The performance monitoring collaboration configuration.
 * @returns TypeScript source code implementing the manager stub.
 */
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

/**
 * Generates a Python stub module that instantiates a
 * `PerformanceMonitoringCollabManager` for the given project.
 *
 * @param config - The performance monitoring collaboration configuration.
 * @returns Python source code implementing the manager stub.
 */
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

/**
 * Writes the generated performance monitoring collaboration artifacts to disk.
 *
 * Produces Terraform, language-specific manager stub (TypeScript or Python),
 * a Markdown overview, and a JSON config file under the specified output
 * directory.
 *
 * @param config - The performance monitoring collaboration configuration.
 * @param outputDir - Directory where generated files will be written. Created if missing.
 * @param language - Target implementation language; `'typescript'` produces TS + package.json, anything else produces Python + requirements.txt.
 * @returns A promise that resolves when all files have been written.
 */
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

/**
 * Identity passthrough that returns the provided performance monitoring
 * collaboration configuration unchanged. Useful as a normalization/validator
 * hook for callers that want a single entry point.
 *
 * @param config - The performance monitoring collaboration configuration to return.
 * @returns The same configuration object that was passed in.
 */
export function performanceMonitoringCollab(config: PerformanceMonitoringCollabConfig): PerformanceMonitoringCollabConfig {
  return config;
}
