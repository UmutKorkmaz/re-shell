// Auto-generated Business Metrics Utility
// Generated at: 2026-01-13T12:25:00.000Z

import chalk from 'chalk';
type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';
type AggregationType = 'sum' | 'avg' | 'max' | 'min' | 'percentile' | 'count';
type DashboardProvider = 'grafana' | 'kibana' | 'datadog' | 'cloudwatch' | 'custom';

interface BusinessMetric {
  name: string;
  type: MetricType;
  category: 'revenue' | 'user' | 'engagement' | 'performance' | 'custom';
  description: string;
  aggregation: AggregationType;
  unit: string;
  tags: string[];
}

interface KpiDefinition {
  name: string;
  metric: string;
  target: number;
  warningThreshold: number;
  criticalThreshold: number;
  timeWindow: string;
  calculation: string;
}

interface DashboardConfig {
  provider: DashboardProvider;
  url: string;
  refreshInterval: number;
  enabled: boolean;
}

interface BusinessMetricsConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  metrics: BusinessMetric[];
  kpis: KpiDefinition[];
  dashboard: DashboardConfig;
  enableRealTime: boolean;
  enableAlerting: boolean;
  enableReporting: boolean;
}

/**
 * Prints a formatted summary of the business metrics and KPI tracking configuration to the console.
 *
 * Outputs the project name, providers, dashboard provider, metrics/KPI counts, and the status
 * of real-time, alerting, and reporting features using colored output.
 *
 * @param config - The business metrics configuration to display.
 */
export function displayConfig(config: BusinessMetricsConfig): void {
  console.log(chalk.cyan('📈 Business Metrics and KPI Tracking with Real-Time Dashboards'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Dashboard Provider:'), config.dashboard.provider);
  console.log(chalk.yellow('Metrics:'), config.metrics.length);
  console.log(chalk.yellow('KPIs:'), config.kpis.length);
  console.log(chalk.yellow('Real-Time:'), config.enableRealTime ? 'Yes' : 'No');
  console.log(chalk.yellow('Alerting:'), config.enableAlerting ? 'Yes' : 'No');
  console.log(chalk.yellow('Reporting:'), config.enableReporting ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown overview of the business metrics and KPI tracking feature.
 *
 * The returned Markdown includes a header and a feature list describing capabilities such as
 * real-time metric collection, custom KPIs, multi-category metrics, dashboards, reporting,
 * aggregation, time-series analysis, visualizations, and multi-cloud support.
 *
 * @param config - The business metrics configuration used to scope the documentation.
 * @returns A Markdown string documenting the business metrics feature.
 */
export function generateBusinessMetricsMD(config: BusinessMetricsConfig): string {
  let md = '# Business Metrics and KPI Tracking\n\n';
  md += '## Features\n\n';
  md += '- Real-time business metrics collection and tracking\n';
  md += '- Custom KPI definitions with target thresholds\n';
  md += '- Multi-category metrics (revenue, user, engagement, performance)\n';
  md += '- Interactive dashboards with real-time updates\n';
  md += '- Automated reporting and alerts\n';
  md += '- Metric aggregation and rollups\n';
  md += '- Time-series data analysis\n';
  md += '- Custom visualizations and widgets\n';
  md += '- Integration with multiple dashboard providers\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header stub for provisioning business metrics resources.
 *
 * The returned code includes the project name and the current ISO timestamp. It is intended to
 * serve as the starting point for Terraform configuration related to the business metrics setup.
 *
 * @param config - The business metrics configuration to source the project name from.
 * @returns A Terraform code string containing header comments for the given project.
 */
export function generateTerraformBusinessMetrics(config: BusinessMetricsConfig): string {
  let code = '# Auto-generated Business Metrics Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript `BusinessMetricsManager` class definition from the given configuration.
 *
 * The returned source code imports `EventEmitter` from the Node.js `events` module and defines a
 * `BusinessMetricsManager` class that extends `EventEmitter`. A default singleton instance is
 * created and exported. The header comment includes the project name and the current ISO timestamp.
 *
 * @param config - The business metrics configuration used to populate the generated manager.
 * @returns A TypeScript source string implementing a `BusinessMetricsManager` class.
 */
export function generateTypeScriptBusinessMetrics(config: BusinessMetricsConfig): string {
  let code = '// Auto-generated Business Metrics Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class BusinessMetricsManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const businessMetricsManager = new BusinessMetricsManager();\n';
  code += 'export default businessMetricsManager;\n';
  return code;
}

/**
 * Generates a Python `BusinessMetricsManager` class definition from the given configuration.
 *
 * The returned source code uses `asyncio` and includes type hints (`Dict`, `Any`). The class
 * constructor accepts a project name, defaulting to the project name from the provided config.
 * A module-level singleton instance is created at the end of the generated file.
 *
 * @param config - The business metrics configuration used to populate the generated manager.
 * @returns A Python source string implementing a `BusinessMetricsManager` class.
 */
export function generatePythonBusinessMetrics(config: BusinessMetricsConfig): string {
  let code = '# Auto-generated Business Metrics Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class BusinessMetricsManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'business_metrics_manager = BusinessMetricsManager()\n';
  return code;
}

/**
 * Writes the generated business metrics files to the specified output directory.
 *
 * Always writes the Terraform file (`business-metrics.tf`) and the Markdown documentation
 * (`BUSINESS_METRICS.md`). For `typescript` language output, also writes the TypeScript manager
 * (`business-metrics-manager.ts`) and a `package.json` with the required dependencies. For any
 * other language, writes a Python manager (`business_metrics_manager.py`) and a `requirements.txt`
 * instead. Finally, writes a `business-metrics-config.json` reflecting the provided configuration.
 *
 * @param config - The business metrics configuration used to generate the files.
 * @param outputDir - The directory where files will be written. It will be created if missing.
 * @param language - The target language (`typescript` for TS output; anything else for Python).
 * @returns A promise that resolves when all files have been written.
 * @throws {Error} If the underlying `fs-extra` write operations fail (e.g. permission errors).
 */
export async function writeFiles(config: BusinessMetricsConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformBusinessMetrics(config);
  await fs.writeFile(path.join(outputDir, 'business-metrics.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptBusinessMetrics(config);
    await fs.writeFile(path.join(outputDir, 'business-metrics-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-business-metrics',
      version: '1.0.0',
      description: 'Business Metrics and KPI Tracking',
      main: 'business-metrics-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonBusinessMetrics(config);
    await fs.writeFile(path.join(outputDir, 'business_metrics_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'prometheus-client>=0.19.0', 'grafana-api>=1.3.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateBusinessMetricsMD(config);
  await fs.writeFile(path.join(outputDir, 'BUSINESS_METRICS.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    metrics: config.metrics,
    kpis: config.kpis,
    dashboard: config.dashboard,
    enableRealTime: config.enableRealTime,
    enableAlerting: config.enableAlerting,
    enableReporting: config.enableReporting,
  };
  await fs.writeFile(path.join(outputDir, 'business-metrics-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided business metrics configuration unchanged.
 *
 * This is a pass-through helper that can be used as a normalization/validation entry point for
 * business metrics configuration in pipelines where the config may be transformed or validated later.
 *
 * @param config - The business metrics configuration to return.
 * @returns The same `BusinessMetricsConfig` instance that was passed in.
 */
export function businessMetrics(config: BusinessMetricsConfig): BusinessMetricsConfig {
  return config;
}
