// Auto-generated Anomaly Detection Utility
// Generated at: 2026-01-13T12:30:00.000Z

import chalk from 'chalk';
type MlAlgorithm = 'isolation-forest' | 'autoencoder' | 'lstm' | 'prophet' | 'arima';
type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
type ResponseAction = 'alert' | 'scale-up' | 'scale-down' | 'restart' | 'block' | 'ignore';

interface AnomalyConfig {
  enabled: boolean;
  algorithm: MlAlgorithm;
  sensitivity: number;
  trainingWindow: string;
  detectionInterval: number;
  threshold: number;
}

interface MetricPattern {
  name: string;
  pattern: string;
  metrics: string[];
  conditions: { [key: string]: any };
}

interface AnomalyAlert {
  name: string;
  condition: string;
  severity: AnomalySeverity;
  channels: string[];
}

interface ResponseRule {
  trigger: string;
  actions: { type: ResponseAction; params: { [key: string]: any } }[];
  cooldown: number;
}

interface AnomalyDetectionConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  anomaly: AnomalyConfig;
  patterns: MetricPattern[];
  alerts: AnomalyAlert[];
  responses: ResponseRule[];
  enableAutoResponse: boolean;
  enableRetraining: boolean;
  enableExplainability: boolean;
}

/**
 * Displays the anomaly detection configuration to the console in a human-readable format.
 * Prints project metadata, ML algorithm details, sensitivity, configured patterns, alerts,
 * response rules, and feature flags (auto-response, auto-retraining, explainability).
 *
 * @param config - The anomaly detection configuration to display.
 */
export function displayConfig(config: AnomalyDetectionConfig): void {
  console.log(chalk.cyan('🤖 Anomaly Detection with Machine Learning and Automated Response'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('ML Algorithm:'), config.anomaly.algorithm);
  console.log(chalk.yellow('Sensitivity:'), (config.anomaly.sensitivity * 100).toFixed(1) + '%');
  console.log(chalk.yellow('Training Window:'), config.anomaly.trainingWindow);
  console.log(chalk.yellow('Detection Interval:'), config.anomaly.detectionInterval + 's');
  console.log(chalk.yellow('Patterns:'), config.patterns.length);
  console.log(chalk.yellow('Alerts:'), config.alerts.length);
  console.log(chalk.yellow('Response Rules:'), config.responses.length);
  console.log(chalk.yellow('Auto-Response:'), config.enableAutoResponse ? 'Yes' : 'No');
  console.log(chalk.yellow('Auto-Retraining:'), config.enableRetraining ? 'Yes' : 'No');
  console.log(chalk.yellow('Explainability:'), config.enableExplainability ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates a Markdown documentation string summarizing the anomaly detection features.
 * The output includes a feature list describing supported ML algorithms, real-time
 * analysis, alerting, automated responses, self-learning, explainability, and more.
 *
 * @param config - The anomaly detection configuration used to scope the documentation.
 * @returns A Markdown string containing the anomaly detection feature overview.
 */
export function generateAnomalyDetectionMD(config: AnomalyDetectionConfig): string {
  let md = '# Anomaly Detection with Machine Learning\n\n';
  md += '## Features\n\n';
  md += '- Machine learning-based anomaly detection (Isolation Forest, Autoencoder, LSTM, Prophet, ARIMA)\n';
  md += '- Real-time metric pattern analysis\n';
  md += '- Automated alerting with severity levels\n';
  md += '- Automated response actions (scale, restart, block)\n';
  md += '- Self-learning with continuous retraining\n';
  md += '- Model explainability and insights\n';
  md += '- Configurable sensitivity and thresholds\n';
  md += '- Multi-metric correlation analysis\n';
  md += '- Integration with cloud providers\n';
  md += '- Custom response rules and cooldowns\n\n';
  return md;
}

/**
 * Generates a Terraform code stub for provisioning anomaly detection resources.
 * The output includes a header comment with the project name and the generation timestamp.
 *
 * @param config - The anomaly detection configuration to provision.
 * @returns A Terraform code string with header comments for the given project.
 */
export function generateTerraformAnomalyDetection(config: AnomalyDetectionConfig): string {
  let code = '# Auto-generated Anomaly Detection Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript source string defining an `AnomalyDetectionManager` class
 * that extends `EventEmitter`, along with a default exported singleton instance.
 * The generated code includes a header comment with the project name and timestamp.
 *
 * @param config - The anomaly detection configuration used to scope the generated manager.
 * @returns A TypeScript source string containing the anomaly detection manager definition.
 */
export function generateTypeScriptAnomalyDetection(config: AnomalyDetectionConfig): string {
  let code = '// Auto-generated Anomaly Detection Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class AnomalyDetectionManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const anomalyDetectionManager = new AnomalyDetectionManager();\n';
  code += 'export default anomalyDetectionManager;\n';
  return code;
}

/**
 * Generates a Python source string defining an `AnomalyDetectionManager` class
 * with an `__init__` method that accepts a project name, plus a module-level
 * singleton instance. The generated code includes a header comment with the
 * project name and timestamp.
 *
 * @param config - The anomaly detection configuration used to scope the generated manager.
 * @returns A Python source string containing the anomaly detection manager definition.
 */
export function generatePythonAnomalyDetection(config: AnomalyDetectionConfig): string {
  let code = '# Auto-generated Anomaly Detection Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class AnomalyDetectionManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'anomaly_detection_manager = AnomalyDetectionManager()\n';
  return code;
}

/**
 * Writes the anomaly detection artifacts to the specified output directory.
 *
 * Ensures the output directory exists, then writes a Terraform file and,
 * depending on the chosen language, either TypeScript sources (with a
 * `package.json`) or Python sources (with a `requirements.txt`). Always
 * emits a Markdown documentation file and a JSON configuration snapshot.
 *
 * @param config - The anomaly detection configuration to materialize.
 * @param outputDir - The target directory where files will be written. Created if missing.
 * @param language - The implementation language; `'typescript'` produces TS artifacts,
 *   any other value produces Python artifacts.
 * @returns A promise that resolves when all files have been written.
 * @throws {Error} If the filesystem operations fail (e.g. permission errors).
 */
export async function writeFiles(config: AnomalyDetectionConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformAnomalyDetection(config);
  await fs.writeFile(path.join(outputDir, 'anomaly-detection.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptAnomalyDetection(config);
    await fs.writeFile(path.join(outputDir, 'anomaly-detection-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-anomaly-detection',
      version: '1.0.0',
      description: 'Anomaly Detection with Machine Learning',
      main: 'anomaly-detection-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonAnomalyDetection(config);
    await fs.writeFile(path.join(outputDir, 'anomaly_detection_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'scikit-learn>=1.0.0', 'tensorflow>=2.10.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateAnomalyDetectionMD(config);
  await fs.writeFile(path.join(outputDir, 'ANOMALY_DETECTION.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    anomaly: config.anomaly,
    patterns: config.patterns,
    alerts: config.alerts,
    responses: config.responses,
    enableAutoResponse: config.enableAutoResponse,
    enableRetraining: config.enableRetraining,
    enableExplainability: config.enableExplainability,
  };
  await fs.writeFile(path.join(outputDir, 'anomaly-detection-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided anomaly detection configuration unchanged.
 *
 * Acts as a pass-through/identity helper that can be used as an extension
 * point or for normalizing config objects in pipelines.
 *
 * @param config - The anomaly detection configuration to return.
 * @returns The same `AnomalyDetectionConfig` instance that was passed in.
 */
export function anomalyDetection(config: AnomalyDetectionConfig): AnomalyDetectionConfig {
  return config;
}
