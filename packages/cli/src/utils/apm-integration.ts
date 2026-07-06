// Auto-generated APM Integration Utility
// Generated at: 2026-01-13T12:20:00.000Z

import chalk from 'chalk';
type ApmBackend = 'datadog' | 'newrelic' | 'dynatrace' | 'appdynamics' | 'elastic-apm';
type ProfilingMode = 'continuous' | 'on-demand' | 'sampling';
type InsightType = 'performance' | 'error' | 'security' | 'business';

interface ApmConfig {
  enabled: boolean;
  backend: ApmBackend;
  apiKey: string;
  environment: string;
  serviceUrl: string;
  profilingMode: ProfilingMode;
  sampleRate: number;
}

interface MetricConfig {
  name: string;
  type: 'counter' | 'gauge' | 'histogram';
  enabled: boolean;
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'percentile';
}

interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: 'info' | 'warning' | 'critical';
}

interface AiInsight {
  type: InsightType;
  enabled: boolean;
  confidence: number;
  recommendations: string[];
  relatedMetrics: string[];
}

interface ApmIntegrationConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  apm: ApmConfig;
  metrics: MetricConfig[];
  alerts: AlertConfig[];
  aiInsights: AiInsight[];
  enableDistributedTracing: boolean;
  enableErrorTracking: boolean;
  enableSecurityMonitoring: boolean;
  enableProfiling: boolean;
}

/**
 * Displays a formatted summary of the APM integration configuration to the console.
 * Prints project metadata, APM backend details, profiling mode, sample rate, counts of
 * configured metrics/alerts/AI insights, and the status of each monitoring capability
 * (distributed tracing, error tracking, security monitoring, profiling).
 *
 * @param config - The full APM integration configuration to display.
 * @returns No return value; output is written to the console.
 */
export function displayConfig(config: ApmIntegrationConfig): void {
  console.log(chalk.cyan('📊 Application Performance Monitoring (APM) with AI-Powered Insights'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('APM Backend:'), config.apm.backend);
  console.log(chalk.yellow('Environment:'), config.apm.environment);
  console.log(chalk.yellow('Profiling Mode:'), config.apm.profilingMode);
  console.log(chalk.yellow('Sample Rate:'), (config.apm.sampleRate * 100).toFixed(1) + '%');
  console.log(chalk.yellow('Metrics:'), config.metrics.length);
  console.log(chalk.yellow('Alerts:'), config.alerts.length);
  console.log(chalk.yellow('AI Insights:'), config.aiInsights.filter(i => i.enabled).length);
  console.log(chalk.yellow('Distributed Tracing:'), config.enableDistributedTracing ? 'Yes' : 'No');
  console.log(chalk.yellow('Error Tracking:'), config.enableErrorTracking ? 'Yes' : 'No');
  console.log(chalk.yellow('Security Monitoring:'), config.enableSecurityMonitoring ? 'Yes' : 'No');
  console.log(chalk.yellow('Profiling:'), config.enableProfiling ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown overview document describing the APM integration features,
 * including multi-platform APM backend support, AI-powered insights, distributed
 * tracing, error tracking, security monitoring, profiling, and multi-cloud integration.
 *
 * @param config - The APM integration configuration used to scope the document.
 * @returns A Markdown string describing the APM integration capabilities.
 */
export function generateApmIntegrationMD(config: ApmIntegrationConfig): string {
  let md = '# Application Performance Monitoring (APM) with AI Insights\n\n';
  md += '## Features\n\n';
  md += '- Multi-platform APM integration (Datadog, New Relic, Dynatrace, AppDynamics, Elastic)\n';
  md += '- AI-powered performance insights and anomaly detection\n';
  md += '- Real-time application monitoring with custom metrics\n';
  md += '- Distributed tracing integration\n';
  md += '- Error tracking and root cause analysis\n';
  md += '- Security monitoring and threat detection\n';
  md += '- Code profiling (continuous, on-demand, sampling)\n';
  md += '- Intelligent alerting with dynamic thresholds\n';
  md += '- Business impact analysis\n';
  md += '- Performance recommendations and optimization insights\n';
  md += '- Multi-cloud provider integration\n\n';
  return md;
}

/**
 * Generates a Terraform header stub for provisioning APM integration resources.
 * The returned string contains the project name and an ISO timestamp marking when
 * the configuration was generated.
 *
 * @param config - The APM integration configuration providing the project name.
 * @returns A Terraform-formatted string header for APM integration.
 */
export function generateTerraformApmIntegration(config: ApmIntegrationConfig): string {
  let code = '# Auto-generated APM Integration Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript source file string that defines an `ApmIntegrationManager`
 * class extending `EventEmitter`, along with a default exported singleton instance.
 * The generated file header records the project name and the ISO timestamp of generation.
 *
 * @param config - The APM integration configuration providing the project name.
 * @returns A TypeScript source string implementing the APM integration manager.
 */
export function generateTypeScriptApmIntegration(config: ApmIntegrationConfig): string {
  let code = '// Auto-generated APM Integration Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class ApmIntegrationManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const apmIntegrationManager = new ApmIntegrationManager();\n';
  code += 'export default apmIntegrationManager;\n';
  return code;
}

/**
 * Generates a Python source file string that defines an `ApmIntegrationManager`
 * class along with a module-level singleton instance. The class is initialized
 * with the configured project name, and the generated file header records the
 * ISO timestamp of generation.
 *
 * @param config - The APM integration configuration providing the project name.
 * @returns A Python source string implementing the APM integration manager.
 */
export function generatePythonApmIntegration(config: ApmIntegrationConfig): string {
  let code = '# Auto-generated APM Integration Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class ApmIntegrationManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'apm_integration_manager = ApmIntegrationManager()\n';
  return code;
}

/**
 * Writes the generated APM integration files to the specified output directory.
 *
 * Always writes the Terraform stub (`apm-integration.tf`) and the Markdown
 * overview (`APM_INTEGRATION.md`), plus a JSON serialization of the full
 * configuration (`apm-config.json`).
 *
 * When `language` is `'typescript'`, additionally writes the TypeScript manager
 * source (`apm-integration-manager.ts`) and a `package.json` with Node/TypeScript
 * dependencies. For any other `language` value, writes a Python manager source
 * (`apm_integration_manager.py`) and a `requirements.txt` listing asyncio,
 * datadog, and newrelic packages.
 *
 * @param config - The APM integration configuration to materialize.
 * @param outputDir - The target directory; it will be created if it does not exist.
 * @param language - Target implementation language (`'typescript'` or `'python'`).
 * @returns Resolves when all files have been written.
 * @throws Rejected if the directory cannot be created or any file write fails.
 */
export async function writeFiles(config: ApmIntegrationConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformApmIntegration(config);
  await fs.writeFile(path.join(outputDir, 'apm-integration.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptApmIntegration(config);
    await fs.writeFile(path.join(outputDir, 'apm-integration-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-apm-integration',
      version: '1.0.0',
      description: 'APM Integration with AI-Powered Insights',
      main: 'apm-integration-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonApmIntegration(config);
    await fs.writeFile(path.join(outputDir, 'apm_integration_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'datadog>=0.44.0', 'newrelic>=8.0.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateApmIntegrationMD(config);
  await fs.writeFile(path.join(outputDir, 'APM_INTEGRATION.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    apm: config.apm,
    metrics: config.metrics,
    alerts: config.alerts,
    aiInsights: config.aiInsights,
    enableDistributedTracing: config.enableDistributedTracing,
    enableErrorTracking: config.enableErrorTracking,
    enableSecurityMonitoring: config.enableSecurityMonitoring,
    enableProfiling: config.enableProfiling,
  };
  await fs.writeFile(path.join(outputDir, 'apm-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided APM integration configuration unchanged.
 *
 * Currently acts as an identity passthrough, allowing callers to pipe the config
 * through a stable entry point that may be extended with validation or
 * transformation logic in the future.
 *
 * @param config - The APM integration configuration to pass through.
 * @returns The same `ApmIntegrationConfig` instance that was provided.
 */
export function apmIntegration(config: ApmIntegrationConfig): ApmIntegrationConfig {
  return config;
}
