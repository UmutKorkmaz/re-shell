// Auto-generated Predictive Scaling Utility
// Generated at: 2026-01-13T12:35:00.000Z

import chalk from 'chalk';

/**
 * Supported machine learning models for capacity forecasting.
 */
type PredictionModel = 'arima' | 'prophet' | 'lstm' | 'xgboost' | 'linear-regression';

/**
 * Available scaling strategies that determine how aggressively resources are adjusted.
 */
type ScalingStrategy = 'aggressive' | 'conservative' | 'balanced';

/**
 * Categories of cloud resources that can be scaled.
 */
type ResourceType = 'compute' | 'database' | 'storage' | 'network';

/**
 * Configuration for the prediction engine used to forecast capacity needs.
 */
interface PredictionConfig {
  /** Whether predictive forecasting is enabled. */
  enabled: boolean;
  /** The ML model to use for generating forecasts. */
  model: PredictionModel;
  /** Duration of historical data to consider (e.g. "30d"). */
  lookbackWindow: string;
  /** How far into the future to forecast (e.g. "7d"). */
  forecastHorizon: string;
  /** Desired prediction accuracy as a fraction between 0 and 1. */
  accuracyTarget: number;
}

/**
 * Describes the capacity bounds and current/target state of a single resource.
 */
interface ResourceCapacity {
  /** The type of resource being scaled. */
  resource: ResourceType;
  /** Minimum allowed capacity value. */
  min: number;
  /** Maximum allowed capacity value. */
  max: number;
  /** Current allocated capacity. */
  current: number;
  /** Desired target capacity. */
  target: number;
  /** Unit of measurement for capacity (e.g. "vCPU", "GB"). */
  unit: string;
}

/**
 * Defines a scaling policy for a specific resource.
 */
interface ScalingPolicy {
  /** Human-readable name of the policy. */
  name: string;
  /** The resource this policy applies to. */
  resource: ResourceType;
  /** Strategy governing how aggressively to scale. */
  strategy: ScalingStrategy;
  /** Utilization fraction that triggers a scale-up. */
  scaleUpThreshold: number;
  /** Utilization fraction that triggers a scale-down. */
  scaleDownThreshold: number;
  /** Cooldown period in seconds between scaling actions. */
  cooldownPeriod: number;
  /** Weight (0-1) given to predicted vs. current utilization. */
  predictionWeight: number;
}

/**
 * Cost optimization settings applied to provisioned resources.
 */
interface CostOptimization {
  /** Whether cost optimization is enabled. */
  enabled: boolean;
  /** Target cost savings as a fraction between 0 and 1. */
  targetSavings: number;
  /** Preferred instance type names to select when scaling. */
  preferredInstanceTypes: string[];
  /** Whether to use reserved instances for discounts. */
  reservedInstances: boolean;
  /** Whether to use spot/preemptible instances. */
  spotInstances: boolean;
  /** Whether to right-size resources to actual utilization. */
  rightSizing: boolean;
}

/**
 * Top-level configuration for predictive scaling and capacity planning.
 */
interface PredictiveScalingConfig {
  /** Name of the project this configuration applies to. */
  projectName: string;
  /** Cloud providers targeted by this configuration. */
  providers: ('aws' | 'azure' | 'gcp')[];
  /** Prediction engine settings. */
  prediction: PredictionConfig;
  /** Capacity definitions for each managed resource. */
  capacity: ResourceCapacity[];
  /** Scaling policies to apply. */
  policies: ScalingPolicy[];
  /** Cost optimization settings. */
  costOptimization: CostOptimization;
  /** Whether budget alerts are enabled. */
  enableBudgetAlerts: boolean;
  /** Whether resource optimization recommendations are enabled. */
  enableResourceOptimization: boolean;
}

/**
 * Prints a human-readable summary of the predictive scaling configuration to the console.
 *
 * @param config - The predictive scaling configuration to display.
 * @returns Nothing.
 */
export function displayConfig(config: PredictiveScalingConfig): void {
  console.log(chalk.cyan('📈 Predictive Scaling and Capacity Planning with Cost Optimization'));
  console.log(chalk.gray('────────────────────────────────────────────────────────────'));
  console.log(chalk.yellow('Project Name:'), config.projectName);
  console.log(chalk.yellow('Providers:'), config.providers.join(', '));
  console.log(chalk.yellow('Prediction Model:'), config.prediction.model);
  console.log(chalk.yellow('Lookback Window:'), config.prediction.lookbackWindow);
  console.log(chalk.yellow('Forecast Horizon:'), config.prediction.forecastHorizon);
  console.log(chalk.yellow('Accuracy Target:'), (config.prediction.accuracyTarget * 100).toFixed(1) + '%');
  console.log(chalk.yellow('Resources:'), config.capacity.length);
  console.log(chalk.yellow('Scaling Policies:'), config.policies.length);
  console.log(chalk.yellow('Cost Optimization:'), config.costOptimization.enabled ? 'Yes' : 'No');
  console.log(chalk.yellow('Target Savings:'), (config.costOptimization.targetSavings * 100).toFixed(1) + '%');
  console.log(chalk.yellow('Budget Alerts:'), config.enableBudgetAlerts ? 'Yes' : 'No');
  console.log(chalk.yellow('Resource Optimization:'), config.enableResourceOptimization ? 'Yes' : 'No');
  console.log(chalk.gray('────────────────────────────────────────────────────────────\n'));
}

/**
 * Generates Markdown documentation describing the predictive scaling feature set.
 *
 * @param config - The predictive scaling configuration to document.
 * @returns A Markdown string summarizing the feature's capabilities.
 */
export function generatePredictiveScalingMD(config: PredictiveScalingConfig): string {
  let md = '# Predictive Scaling and Capacity Planning\n\n';
  md += '## Features\n\n';
  md += '- Predictive scaling with ML models (ARIMA, Prophet, LSTM, XGBoost, Linear Regression)\n';
  md += '- Automatic capacity planning based on historical patterns\n';
  md += '- Cost optimization strategies (reserved instances, spot instances, right-sizing)\n';
  md += '- Multiple scaling strategies (aggressive, conservative, balanced)\n';
  md += '- Budget alerts and cost tracking\n';
  md += '- Resource optimization recommendations\n';
  md += '- Custom scaling policies with cooldowns\n';
  md += '- Forecast horizon and lookback configuration\n';
  md += '- Multi-cloud provider support\n';
  md += '- Real-time resource utilization monitoring\n\n';
  return md;
}

/**
 * Generates a Terraform header for predictive scaling resources for the given project.
 *
 * @param config - The predictive scaling configuration to generate Terraform from.
 * @returns A Terraform code string (header) for predictive scaling.
 */
export function generateTerraformPredictiveScaling(config: PredictiveScalingConfig): string {
  let code = '# Auto-generated Predictive Scaling Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates a TypeScript `PredictiveScalingManager` stub for the given project.
 *
 * @param config - The predictive scaling configuration to generate code from.
 * @returns A TypeScript source string defining a manager class and default export.
 */
export function generateTypeScriptPredictiveScaling(config: PredictiveScalingConfig): string {
  let code = '// Auto-generated Predictive Scaling Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class PredictiveScalingManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const predictiveScalingManager = new PredictiveScalingManager();\n';
  code += 'export default predictiveScalingManager;\n';
  return code;
}

/**
 * Generates a Python `PredictiveScalingManager` stub for the given project.
 *
 * @param config - The predictive scaling configuration to generate code from.
 * @returns A Python source string defining a manager class and instance.
 */
export function generatePythonPredictiveScaling(config: PredictiveScalingConfig): string {
  let code = '# Auto-generated Predictive Scaling Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class PredictiveScalingManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'predictive_scaling_manager = PredictiveScalingManager()\n';
  return code;
}

/**
 * Writes generated predictive scaling files (Terraform, runtime code, docs, and config)
 * to the specified output directory.
 *
 * @param config - The predictive scaling configuration to materialize.
 * @param outputDir - Directory path where generated files will be written.
 * @param language - Target runtime language; "typescript" produces TS files, otherwise Python.
 * @returns A promise that resolves when all files have been written.
 */
export async function writeFiles(config: PredictiveScalingConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformPredictiveScaling(config);
  await fs.writeFile(path.join(outputDir, 'predictive-scaling.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptPredictiveScaling(config);
    await fs.writeFile(path.join(outputDir, 'predictive-scaling-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-predictive-scaling',
      version: '1.0.0',
      description: 'Predictive Scaling and Capacity Planning',
      main: 'predictive-scaling-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonPredictiveScaling(config);
    await fs.writeFile(path.join(outputDir, 'predictive_scaling_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'scikit-learn>=1.0.0', 'prophet>=1.1.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generatePredictiveScalingMD(config);
  await fs.writeFile(path.join(outputDir, 'PREDICTIVE_SCALING.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    prediction: config.prediction,
    capacity: config.capacity,
    policies: config.policies,
    costOptimization: config.costOptimization,
    enableBudgetAlerts: config.enableBudgetAlerts,
    enableResourceOptimization: config.enableResourceOptimization,
  };
  await fs.writeFile(path.join(outputDir, 'predictive-scaling-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Identity passthrough that returns the supplied predictive scaling configuration.
 *
 * @param config - The predictive scaling configuration to return.
 * @returns The same configuration object that was passed in.
 */
export function predictiveScaling(config: PredictiveScalingConfig): PredictiveScalingConfig {
  return config;
}
