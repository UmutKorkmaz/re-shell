// Auto-generated Developer Productivity Utility
// Generated at: 2026-01-13T13:55:00.000Z
import chalk from 'chalk';

type MetricCategory = 'code' | 'review' | 'collaboration' | 'quality' | 'velocity';
type TimeRange = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type ChartType = 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter' | 'gauge';

interface MetricDefinition {
  id: string;
  name: string;
  category: MetricCategory;
  unit: string;
  target: number;
  current: number;
  trend: 'up' | 'down' | 'stable';
}

interface DeveloperStats {
  developerId: string;
  name: string;
  email: string;
  team: string;
  metrics: {
    commitsCount: number;
    linesAdded: number;
    linesRemoved: number;
    pullRequestsCreated: number;
    pullRequestsReviewed: number;
    codeReviewsCompleted: number;
    avgReviewTime: number;
    issuesClosed: number;
    tasksCompleted: number;
    velocity: number;
    codeChurn: number;
  };
  period: TimeRange;
}

interface DashboardWidget {
  id: string;
  title: string;
  type: ChartType;
  metric: string;
  timeRange: TimeRange;
  position: { x: number; y: number; w: number; h: number };
  comparison: boolean;
}

interface Insight {
  id: string;
  type: 'achievement' | 'improvement' | 'warning' | 'tip';
  title: string;
  description: string;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface DeveloperProductivityConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  metrics: MetricDefinition[];
  developers: DeveloperStats[];
  widgets: DashboardWidget[];
  insights: Insight[];
  enablePersonalization: boolean;
  enableBenchmarking: boolean;
  enableGoalTracking: boolean;
}

/**
 * Prints a summary of the developer productivity configuration to the console.
 *
 * The output includes the project name, configured providers, counts of
 * metrics, developers, widgets and insights, and the status of the
 * personalization, benchmarking and goal tracking toggles.
 *
 * @param config - The developer productivity configuration to display.
 * @returns No return value; output is written to the console.
 */
export function displayConfig(config: DeveloperProductivityConfig): void {
  console.log(chalk.cyan('📈 Developer Productivity Metrics'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Metrics:'), config.metrics.length);
  console.log(chalk.yellow('Developers:'), config.developers.length);
  console.log(chalk.yellow('Widgets:'), config.widgets.length);
  console.log(chalk.yellow('Insights:'), config.insights.length);
  console.log(chalk.yellow('Personalization:'), config.enablePersonalization ? 'Yes' : 'No');
  console.log(chalk.yellow('Benchmarking:'), config.enableBenchmarking ? 'Yes' : 'No');
  console.log(chalk.yellow('Goal Tracking:'), config.enableGoalTracking ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown document describing the developer productivity
 * features tracked by the provided configuration.
 *
 * The resulting Markdown lists the supported metric categories, time ranges,
 * chart types, and tracking capabilities (velocity, code churn, review time,
 * benchmarking, goal tracking, trend analysis and more).
 *
 * @param config - The developer productivity configuration used as context.
 * @returns A Markdown string summarizing the productivity features.
 */
export function generateDeveloperProductivityMD(config: DeveloperProductivityConfig): string {
  let md = '# Developer Productivity Metrics and Personalized Dashboards\n\n';
  md += '## Features\n\n';
  md += '- Metric categories: code, review, collaboration, quality, velocity\n';
  md += '- Time ranges: daily, weekly, monthly, quarterly\n';
  md += '- Chart types: line, bar, pie, heatmap, scatter, gauge\n';
  md += '- Developer statistics tracking (commits, lines, PRs, reviews, issues)\n';
  md += '- Productivity metrics (velocity, code churn, review time)\n';
  md += '- Personalized dashboards with customizable widgets\n';
  md += '- AI-powered insights (achievements, improvements, warnings, tips)\n';
  md += '- Team benchmarking and comparison\n';
  md += '- Goal tracking and progress monitoring\n';
  md += '- Trend analysis (up, down, stable)\n';
  md += '- Target vs actual performance tracking\n';
  md += '- Actionable recommendations\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header snippet for provisioning developer
 * productivity resources for the given project.
 *
 * The generated code includes a comment header with the project name and the
 * generation timestamp.
 *
 * @param config - The developer productivity configuration to derive the project name from.
 * @returns A Terraform code string with a generated header.
 */
export function generateTerraformDeveloperProductivity(config: DeveloperProductivityConfig): string {
  let code = '# Auto-generated Developer Productivity Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript source file that defines a
 * `DeveloperProductivityManager` class extending `EventEmitter` for the
 * given project.
 *
 * The generated module exports a default singleton instance of the manager.
 *
 * @param config - The developer productivity configuration used to label the generated manager.
 * @returns A TypeScript source string containing the manager class and default export.
 */
export function generateTypeScriptDeveloperProductivity(config: DeveloperProductivityConfig): string {
  let code = '// Auto-generated Developer Productivity Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class DeveloperProductivityManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const developerProductivityManager = new DeveloperProductivityManager();\n';
  code += 'export default developerProductivityManager;\n';
  return code;
}

/**
 * Generates a Python source file that defines a
 * `DeveloperProductivityManager` class for the given project.
 *
 * The generated module instantiates a `developer_productivity_manager`
 * singleton using the project name from the configuration.
 *
 * @param config - The developer productivity configuration used to label the generated manager.
 * @returns A Python source string containing the manager class and instance.
 */
export function generatePythonDeveloperProductivity(config: DeveloperProductivityConfig): string {
  let code = '# Auto-generated Developer Productivity Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class DeveloperProductivityManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'developer_productivity_manager = DeveloperProductivityManager()\n';
  return code;
}

/**
 * Writes the developer productivity artifacts to the specified output directory.
 *
 * Depending on the chosen language, this function generates a Terraform file,
 * either a TypeScript or Python manager module (plus its dependency manifest),
 * a Markdown documentation file, and a JSON serialization of the configuration.
 *
 * @param config - The developer productivity configuration to materialize.
 * @param outputDir - The directory where the generated files will be written. It is created if it does not exist.
 * @param language - The target implementation language; either `'typescript'` or `'python'`.
 * @returns A promise that resolves once all files have been written.
 * @throws {Error} If the file system operations fail (for example, when the output directory cannot be created or written to).
 */
export async function writeFiles(config: DeveloperProductivityConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformDeveloperProductivity(config);
  await fs.writeFile(path.join(outputDir, 'developer-productivity.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptDeveloperProductivity(config);
    await fs.writeFile(path.join(outputDir, 'developer-productivity-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-developer-productivity',
      version: '1.0.0',
      description: 'Developer Productivity Metrics and Personalized Dashboards',
      main: 'developer-productivity-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonDeveloperProductivity(config);
    await fs.writeFile(path.join(outputDir, 'developer_productivity_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'pandas>=2.0.0', 'matplotlib>=3.7.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateDeveloperProductivityMD(config);
  await fs.writeFile(path.join(outputDir, 'DEVELOPER_PRODUCTIVITY.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    metrics: config.metrics,
    developers: config.developers,
    widgets: config.widgets,
    insights: config.insights,
    enablePersonalization: config.enablePersonalization,
    enableBenchmarking: config.enableBenchmarking,
    enableGoalTracking: config.enableGoalTracking,
  };
  await fs.writeFile(path.join(outputDir, 'developer-productivity-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided developer productivity configuration unchanged.
 *
 * This acts as a pass-through accessor, allowing callers to obtain or
 * normalize a configuration value through a consistent function interface.
 *
 * @param config - The developer productivity configuration to return.
 * @returns The same `DeveloperProductivityConfig` instance that was passed in.
 */
export function developerProductivity(config: DeveloperProductivityConfig): DeveloperProductivityConfig {
  return config;
}
