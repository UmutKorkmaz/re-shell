// Auto-generated Distributed Tracing Utility
// Generated at: 2026-01-13T12:10:00.000Z
import chalk from 'chalk';

type TracingBackend = 'jaeger' | 'zipkin' | 'tempo' | 'xray';
type SamplingStrategy = 'probability' | 'rate-limiting' | 'dynamic';
type Protocol = 'http' | 'grpc' | 'thrift';

interface TraceConfig {
  enabled: boolean;
  backend: TracingBackend;
  samplingRate: number;
  maxPathLength: number;
  debugEnabled: boolean;
}

interface ServiceConfig {
  name: string;
  protocol: Protocol;
  endpoint: string;
  port: number;
  traced: boolean;
}

interface SpanConfig {
  serviceName: string;
  operationName: string;
  tags: { [key: string]: string };
  logs: { timestamp: number; fields: { [key: string]: string } }[];
}

interface PerformanceInsight {
  operationName: string;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  errorRate: number;
  throughput: number;
}

interface DistributedTracingConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  trace: TraceConfig;
  services: ServiceConfig[];
  spans: SpanConfig[];
  insights: PerformanceInsight[];
  enableProfiling: boolean;
  enableLogging: boolean;
  enableMetrics: boolean;
}

/**
 * Displays a summary of the distributed tracing configuration to the console,
 * including project name, providers, tracing backend, sampling rate, counts of
 * services and spans, and feature toggles (profiling, logging, metrics).
 *
 * @param config - The complete distributed tracing configuration to display.
 * @returns No return value; output is written to stdout via console.
 */
export function displayConfig(config: DistributedTracingConfig): void {
  console.log(chalk.cyan('✨ Distributed Tracing with Jaeger/Zipkin Performance Insights'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Tracing Backend:'), config.trace.backend);
  console.log(chalk.yellow('Sampling Rate:'), (config.trace.samplingRate * 100).toFixed(1) + '%');
  console.log(chalk.yellow('Services:'), config.services.length);
  console.log(chalk.yellow('Spans:'), config.spans.length);
  console.log(chalk.yellow('Profiling:'), config.enableProfiling ? 'Yes' : 'No');
  console.log(chalk.yellow('Logging:'), config.enableLogging ? 'Yes' : 'No');
  console.log(chalk.yellow('Metrics:'), config.enableMetrics ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown document describing the distributed tracing features,
 * such as supported backends, span propagation, performance insights, and
 * multi-cloud provider support.
 *
 * @param config - The distributed tracing configuration used for context.
 * @returns A Markdown string summarizing the distributed tracing features.
 */
export function generateDistributedTracingMD(config: DistributedTracingConfig): string {
  let md = '# Distributed Tracing with Performance Insights\n\n';
  md += '## Features\n\n';
  md += '- Distributed tracing with Jaeger/Zipkin/Tempo backends\n';
  md += '- Automatic span propagation across services\n';
  md += '- Performance insights (P95, P99 latencies, error rates)\n';
  md += '- Service dependency mapping\n';
  md += '- Root cause analysis with trace visualization\n';
  md += '- Custom tagging and logging for spans\n';
  md += '- Sampling strategies for production optimization\n';
  md += '- Integration with Prometheus metrics\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header snippet for provisioning distributed tracing
 * resources, including the project name and a timestamp of generation.
 *
 * @param config - The distributed tracing configuration providing the project name.
 * @returns A Terraform code string with header comments for the project.
 */
export function generateTerraformTracing(config: DistributedTracingConfig): string {
  let code = '# Auto-generated Distributed Tracing Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript source file defining a `DistributedTracingManager`
 * class that extends `EventEmitter`, along with a default exported instance.
 *
 * @param config - The distributed tracing configuration providing the project name.
 * @returns A TypeScript code string containing the generated manager class and instance.
 */
export function generateTypeScriptTracing(config: DistributedTracingConfig): string {
  let code = '// Auto-generated Distributed Tracing Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class DistributedTracingManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const distributedTracingManager = new DistributedTracingManager();\n';
  code += 'export default distributedTracingManager;\n';
  return code;
}

/**
 * Generates a Python source file defining a `DistributedTracingManager` class
 * with a default project name, along with a module-level instance.
 *
 * @param config - The distributed tracing configuration providing the project name.
 * @returns A Python code string containing the generated manager class and instance.
 */
export function generatePythonTracing(config: DistributedTracingConfig): string {
  let code = '# Auto-generated Distributed Tracing Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class DistributedTracingManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'distributed_tracing_manager = DistributedTracingManager()\n';
  return code;
}

/**
 * Writes the generated distributed tracing files to the specified output directory.
 *
 * Depending on the chosen language, this writes the Terraform file plus either
 * the TypeScript manager (with package.json) or the Python manager (with
 * requirements.txt). A Markdown documentation file and a JSON configuration
 * file are always written.
 *
 * @param config - The distributed tracing configuration to generate files from.
 * @param outputDir - The target directory where files will be written. It is created if missing.
 * @param language - The implementation language; `"typescript"` produces TS artifacts, otherwise Python artifacts are written.
 * @returns A promise that resolves when all files have been written.
 * @throws {Error} If the filesystem operations fail (e.g. permission denied or disk error).
 */
export async function writeFiles(config: DistributedTracingConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformTracing(config);
  await fs.writeFile(path.join(outputDir, 'distributed-tracing.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptTracing(config);
    await fs.writeFile(path.join(outputDir, 'distributed-tracing-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-distributed-tracing',
      version: '1.0.0',
      description: 'Distributed Tracing with Jaeger/Zipkin',
      main: 'distributed-tracing-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonTracing(config);
    await fs.writeFile(path.join(outputDir, 'distributed_tracing_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'jaeger-client>=4.8.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateDistributedTracingMD(config);
  await fs.writeFile(path.join(outputDir, 'DISTRIBUTED_TRACING.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    trace: config.trace,
    services: config.services,
    insights: config.insights,
    enableProfiling: config.enableProfiling,
    enableLogging: config.enableLogging,
    enableMetrics: config.enableMetrics,
  };
  await fs.writeFile(path.join(outputDir, 'tracing-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided distributed tracing configuration unchanged.
 *
 * This acts as a pass-through entry point, allowing callers to obtain a typed
 * configuration object for further use by the other functions in this module.
 *
 * @param config - The distributed tracing configuration to return.
 * @returns The same `DistributedTracingConfig` instance that was provided.
 */
export function distributedTracing(config: DistributedTracingConfig): DistributedTracingConfig {
  return config;
}
