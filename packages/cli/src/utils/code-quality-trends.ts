// Auto-generated Code Quality Trends Utility
// Generated at: 2026-01-13T14:00:00.000Z

import chalk from 'chalk';

type QualityMetric = 'complexity' | 'duplication' | 'test-coverage' | 'code-smell' | 'security' | 'maintainability';
type DebtCategory = 'bug-risk' | 'code-smell' | 'documentation' | 'testing' | 'architecture' | 'performance';
type TrendDirection = 'improving' | 'declining' | 'stable';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface QualityMetricData {
  id: string;
  name: string;
  type: QualityMetric;
  score: number;
  target: number;
  trend: TrendDirection;
  history: { timestamp: number; value: number }[];
}

interface TechnicalDebt {
  id: string;
  title: string;
  category: DebtCategory;
  severity: Severity;
  description: string;
  file: string;
  line: number;
  effort: number; // in hours
  interest: number; // cost of delay per month
  createdAt: number;
}

interface Recommendation {
  id: string;
  debtId: string;
  type: 'refactor' | 'test' | 'document' | 'optimize' | 'secure';
  priority: number;
  title: string;
  description: string;
  effort: number;
  impact: 'high' | 'medium' | 'low';
}

interface QualityTrendConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  metrics: QualityMetricData[];
  technicalDebt: TechnicalDebt[];
  recommendations: Recommendation[];
  enableAutomatedAnalysis: boolean;
  enableTrendPrediction: boolean;
  enableDebtPrioritization: boolean;
}

/**
 * Prints a human-readable summary of the code quality trends configuration to the console.
 *
 * The output includes the project name, configured cloud providers, counts of
 * tracked quality metrics, technical debt items, and recommendations, as well as
 * flags indicating whether automated analysis, trend prediction, and debt
 * prioritization are enabled.
 *
 * @param config - The quality trend configuration to display.
 * @returns No return value; output is written to the console.
 */
export function displayConfig(config: QualityTrendConfig): void {
  console.log(chalk.cyan('📊 Code Quality Trends and Technical Debt Tracking'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Quality Metrics:'), config.metrics.length);
  console.log(chalk.yellow('Technical Debt Items:'), config.technicalDebt.length);
  console.log(chalk.yellow('Recommendations:'), config.recommendations.length);
  console.log(chalk.yellow('Automated Analysis:'), config.enableAutomatedAnalysis ? 'Yes' : 'No');
  console.log(chalk.yellow('Trend Prediction:'), config.enableTrendPrediction ? 'Yes' : 'No');
  console.log(chalk.yellow('Debt Prioritization:'), config.enableDebtPrioritization ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown document describing the code quality trends and
 * technical debt tracking features for the given configuration.
 *
 * The resulting Markdown lists the supported quality metrics, technical debt
 * categories, severity levels, effort estimation capabilities, debt interest
 * calculation, trend analysis options, and recommendation types.
 *
 * @param config - The quality trend configuration used to scope the document.
 * @returns A Markdown string summarizing the available quality tracking features.
 */
export function generateQualityTrendMD(config: QualityTrendConfig): string {
  let md = '# Code Quality Trends and Technical Debt Tracking\n\n';
  md += '## Features\n\n';
  md += '- Quality metrics: complexity, duplication, test coverage, code smells, security, maintainability\n';
  md += '- Technical debt categories: bug risk, code smell, documentation, testing, architecture, performance\n';
  md += '- Debt severity levels: low, medium, high, critical\n';
  md += '- Effort estimation in hours\n';
  md += '- Debt interest calculation (cost of delay)\n';
  md += '- Trend analysis: improving, declining, stable\n';
  md += '- Historical data tracking\n';
  md += '- Automated recommendations: refactor, test, document, optimize, secure\n';
  md += '- Priority-based task management\n';
  md += '- Impact assessment: high, medium, low\n';
  md += '- File and line-level tracking\n';
  md += '- Trend prediction capabilities\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform file header for the code quality trends configuration.
 *
 * The generated content includes an auto-generated banner with the project name
 * and a timestamp of when the file was produced. The returned string is intended
 * to be written to a `.tf` file.
 *
 * @param config - The quality trend configuration providing the project name.
 * @returns A string containing the Terraform header content.
 */
export function generateTerraformQualityTrend(config: QualityTrendConfig): string {
  let code = '# Auto-generated Code Quality Trends Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript source file that scaffolds a code quality trends
 * manager for the given project.
 *
 * The emitted code defines a `CodeQualityTrendsManager` class extending
 * `EventEmitter`, instantiates a default singleton, and exports it. The string
 * is intended to be written to a `.ts` file.
 *
 * @param config - The quality trend configuration providing the project name.
 * @returns A TypeScript source string containing the generated manager class.
 */
export function generateTypeScriptQualityTrend(config: QualityTrendConfig): string {
  let code = '// Auto-generated Code Quality Trends Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class CodeQualityTrendsManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const codeQualityTrendsManager = new CodeQualityTrendsManager();\n';
  code += 'export default codeQualityTrendsManager;\n';
  return code;
}

/**
 * Generates a Python source file that scaffolds a code quality trends manager
 * for the given project.
 *
 * The emitted code defines a `CodeQualityTrendsManager` class with a
 * `project_name` attribute, then instantiates a module-level singleton. The
 * string is intended to be written to a `.py` file.
 *
 * @param config - The quality trend configuration providing the project name.
 * @returns A Python source string containing the generated manager class.
 */
export function generatePythonQualityTrend(config: QualityTrendConfig): string {
  let code = '# Auto-generated Code Quality Trends Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class CodeQualityTrendsManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'code_quality_trends_manager = CodeQualityTrendsManager()\n';
  return code;
}

/**
 * Writes the generated code quality trends files to the specified output directory.
 *
 * This always writes a Terraform file and a Markdown documentation file. When
 * `language` is `'typescript'`, it additionally writes a TypeScript manager
 * module and a `package.json`; otherwise it writes a Python manager module and
 * a `requirements.txt`. A JSON configuration file capturing the full quality
 * trend configuration is also emitted.
 *
 * @param config - The quality trend configuration to generate files from.
 * @param outputDir - The target directory where files will be written. It is
 *   created if it does not already exist.
 * @param language - The implementation language to generate. Use `'typescript'`
 *   for TypeScript output; any other value produces Python output.
 * @returns A promise that resolves once all files have been written.
 * @throws Rejected if the filesystem operations fail, for example due to
 *   permission errors or an invalid output directory path.
 */
export async function writeFiles(config: QualityTrendConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformQualityTrend(config);
  await fs.writeFile(path.join(outputDir, 'code-quality-trends.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptQualityTrend(config);
    await fs.writeFile(path.join(outputDir, 'code-quality-trends-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-code-quality-trends',
      version: '1.0.0',
      description: 'Code Quality Trends and Technical Debt Tracking',
      main: 'code-quality-trends-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonQualityTrend(config);
    await fs.writeFile(path.join(outputDir, 'code_quality_trends_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'radon>=5.1.0', 'pylint>=2.17.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateQualityTrendMD(config);
  await fs.writeFile(path.join(outputDir, 'CODE_QUALITY_TRENDS.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    metrics: config.metrics,
    technicalDebt: config.technicalDebt,
    recommendations: config.recommendations,
    enableAutomatedAnalysis: config.enableAutomatedAnalysis,
    enableTrendPrediction: config.enableTrendPrediction,
    enableDebtPrioritization: config.enableDebtPrioritization,
  };
  await fs.writeFile(path.join(outputDir, 'code-quality-trends-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided quality trend configuration unchanged.
 *
 * This acts as a passthrough/identity accessor, allowing callers to obtain a
 * typed reference to a `QualityTrendConfig` value, for example for validation
 * or registration within a larger configuration pipeline.
 *
 * @param config - The quality trend configuration to return.
 * @returns The same `QualityTrendConfig` instance that was passed in.
 */
export function codeQualityTrends(config: QualityTrendConfig): QualityTrendConfig {
  return config;
}
