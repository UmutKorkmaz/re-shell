// Auto-generated Log Aggregation Utility
// Generated at: 2026-01-13T12:15:00.000Z

import chalk from 'chalk';

type LogBackend = 'elk' | 'efk' | 'fluentd' | 'cloudwatch' | 'azure-log';
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
type LogFormat = 'json' | 'text' | 'cef' | 'syslog';

interface LogConfig {
  enabled: boolean;
  backend: LogBackend;
  format: LogFormat;
  level: LogLevel;
  retentionDays: number;
  maxFileSize: number;
  bufferSize: number;
  flushInterval: number;
}

interface ElasticsearchConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  indexPrefix: string;
  shards: number;
  replicas: number;
}

interface LogstashConfig {
  host: string;
  port: number;
  pipelines: string[];
}

interface KibanaConfig {
  enabled: boolean;
  host: string;
  port: number;
  dashboards: string[];
}

interface FluentdConfig {
  host: string;
  port: number;
  parsers: string[];
  buffers: { path: string; size: string }[];
}

interface LogParser {
  name: string;
  pattern: string;
  fields: { [key: string]: string };
  timestampField: string;
  timestampFormat: string;
}

interface LogFilter {
  name: string;
  condition: string;
  actions: { type: string; params: { [key: string]: any } }[];
}

interface LogAggregationConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  log: LogConfig;
  elasticsearch: ElasticsearchConfig;
  logstash: LogstashConfig;
  kibana: KibanaConfig;
  fluentd: FluentdConfig;
  parsers: LogParser[];
  filters: LogFilter[];
  enableAlerting: boolean;
  enableMetrics: boolean;
}

/**
 * Displays the log aggregation configuration to the console in a human-readable format.
 * Renders project, provider, backend, format, level, retention, and infrastructure details
 * using colored output via chalk.
 *
 * @param config - The full log aggregation configuration to display.
 * @returns No return value; output is written to stdout.
 */
export function displayConfig(config: LogAggregationConfig): void {
  console.log(chalk.cyan('🪵 Log Aggregation with ELK/EFK Stack and Structured Logging'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Log Backend:'), config.log.backend);
  console.log(chalk.yellow('Log Format:'), config.log.format);
  console.log(chalk.yellow('Log Level:'), config.log.level);
  console.log(chalk.yellow('Retention Days:'), config.log.retentionDays);
  console.log(chalk.yellow('Elasticsearch:'), config.elasticsearch.host + ':' + config.elasticsearch.port);
  console.log(chalk.yellow('Kibana:'), config.kibana.enabled ? (config.kibana.host + ':' + config.kibana.port) : 'Disabled');
  console.log(chalk.yellow('Parsers:'), config.parsers.length);
  console.log(chalk.yellow('Filters:'), config.filters.length);
  console.log(chalk.yellow('Alerting:'), config.enableAlerting ? 'Yes' : 'No');
  console.log(chalk.yellow('Metrics:'), config.enableMetrics ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown documentation string describing the log aggregation features
 * provided by the ELK/EFK stack integration.
 *
 * @param config - The log aggregation configuration used to scope the documentation.
 * @returns A Markdown-formatted string summarizing the log aggregation features.
 */
export function generateLogAggregationMD(config: LogAggregationConfig): string {
  let md = '# Log Aggregation with ELK/EFK Stack\n\n';
  md += '## Features\n\n';
  md += '- ELK (Elasticsearch, Logstash, Kibana) stack for log aggregation\n';
  md += '- EFK (Elasticsearch, Fluentd, Kibana) stack for containerized environments\n';
  md += '- Structured logging with JSON format\n';
  md += '- Intelligent log parsing with custom patterns\n';
  md += '- Log filtering and enrichment pipelines\n';
  md += '- Centralized log management and search\n';
  md += '- Real-time log analysis and visualization\n';
  md += '- Log retention policies and archival\n';
  md += '- Multi-cloud provider integration (AWS CloudWatch, Azure Monitor, GCP Cloud Logging)\n';
  md += '- Alerting on log patterns and anomalies\n';
  md += '- Log metrics and statistics\n\n';
  return md;
}

/**
 * Generates a Terraform header snippet for provisioning log aggregation resources.
 * The snippet includes the project name and a timestamp of generation.
 *
 * @param config - The log aggregation configuration providing the project name and metadata.
 * @returns A string containing the Terraform header comment for log aggregation.
 */
export function generateTerraformLogAggregation(config: LogAggregationConfig): string {
  let code = '# Auto-generated Log Aggregation Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript source file string defining a `LogAggregationManager` class
 * that extends `EventEmitter`. Includes the project name and a generation timestamp
 * in the file header.
 *
 * @param config - The log aggregation configuration providing the project name.
 * @returns A TypeScript source string for the log aggregation manager module.
 */
export function generateTypeScriptLogAggregation(config: LogAggregationConfig): string {
  let code = '// Auto-generated Log Aggregation Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class LogAggregationManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const logAggregationManager = new LogAggregationManager();\n';
  code += 'export default logAggregationManager;\n';
  return code;
}

/**
 * Generates a Python source file string defining a `LogAggregationManager` class
 * with async support. Includes the project name and a generation timestamp
 * in the file header.
 *
 * @param config - The log aggregation configuration providing the project name.
 * @returns A Python source string for the log aggregation manager module.
 */
export function generatePythonLogAggregation(config: LogAggregationConfig): string {
  let code = '# Auto-generated Log Aggregation Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class LogAggregationManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'log_aggregation_manager = LogAggregationManager()\n';
  return code;
}

/**
 * Writes the generated log aggregation files to the specified output directory.
 * Generates Terraform, language-specific manager code (TypeScript or Python),
 * Markdown documentation, and a JSON configuration file. Ensures the output
 * directory exists before writing.
 *
 * @param config - The log aggregation configuration to serialize and render.
 * @param outputDir - The target directory where files will be written.
 * @param language - The implementation language to generate; either `'typescript'` or `'python'`.
 * @returns A promise that resolves once all files have been written successfully.
 */
export async function writeFiles(config: LogAggregationConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformLogAggregation(config);
  await fs.writeFile(path.join(outputDir, 'log-aggregation.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptLogAggregation(config);
    await fs.writeFile(path.join(outputDir, 'log-aggregation-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-log-aggregation',
      version: '1.0.0',
      description: 'Log Aggregation with ELK/EFK Stack',
      main: 'log-aggregation-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonLogAggregation(config);
    await fs.writeFile(path.join(outputDir, 'log_aggregation_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'elasticsearch>=7.17.0', 'logstash>=0.1.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateLogAggregationMD(config);
  await fs.writeFile(path.join(outputDir, 'LOG_AGGREGATION.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    log: config.log,
    elasticsearch: config.elasticsearch,
    logstash: config.logstash,
    kibana: config.kibana,
    fluentd: config.fluentd,
    parsers: config.parsers,
    filters: config.filters,
    enableAlerting: config.enableAlerting,
    enableMetrics: config.enableMetrics,
  };
  await fs.writeFile(path.join(outputDir, 'log-aggregation-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided log aggregation configuration unchanged.
 * Acts as a pass-through/normalization entry point for the log aggregation utility.
 *
 * @param config - The log aggregation configuration to return.
 * @returns The same `LogAggregationConfig` instance that was provided.
 */
export function logAggregation(config: LogAggregationConfig): LogAggregationConfig {
  return config;
}
