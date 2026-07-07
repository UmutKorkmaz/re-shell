// Auto-generated Velocity Tracking Utility
// Generated at: 2026-01-13T14:05:00.000Z

/**
 * Supported velocity metrics used to quantify team output.
 */
type VelocityMetric = 'story-points' | 'tasks-completed' | 'bugs-resolved' | 'features-delivered';

/**
 * Time window over which velocity can be aggregated.
 */
type TimePeriod = 'sprint' | 'week' | 'month' | 'quarter';

/**
 * Statistical or machine-learning model used to forecast future velocity.
 */
type PredictionModel = 'linear' | 'exponential' | 'moving-average' | 'ml-based';

/**
 * Factor that influences effective team capacity.
 */
type CapacityFactor = 'available' | 'vacation' | 'meetings' | 'overhead';

/**
 * Represents recorded data for a single sprint.
 */
interface SprintData {
  /** Unique identifier for the sprint. */
  id: string;
  /** Human-readable name of the sprint. */
  name: string;
  /** Sprint start time as a Unix epoch timestamp (milliseconds). */
  startDate: number;
  /** Sprint end time as a Unix epoch timestamp (milliseconds). */
  endDate: number;
  /** Velocity that was planned/committed for the sprint. */
  plannedVelocity: number;
  /** Velocity actually achieved during the sprint. */
  actualVelocity: number;
  /** Number of story points completed in the sprint. */
  storyPointsCompleted: number;
  /** Number of tasks completed in the sprint. */
  tasksCompleted: number;
  /** Number of team members assigned to the sprint. */
  teamSize: number;
  /** Total available capacity in hours. */
  capacity: number; // in hours
}

/**
 * Aggregated velocity trend data for a reporting period.
 */
interface VelocityTrend {
  /** Identifier for the reporting period (e.g. "2026-W01"). */
  period: string;
  /** Planned velocity for the period. */
  planned: number;
  /** Actual velocity achieved in the period. */
  actual: number;
  /** Difference between actual and planned velocity. */
  variance: number;
  /** Number of team members in the period. */
  teamSize: number;
  /** Team efficiency expressed as a percentage. */
  efficiency: number; // percentage
}

/**
 * Capacity plan describing how a team's hours are allocated.
 */
interface CapacityPlan {
  /** Unique identifier for the team. */
  teamId: string;
  /** Human-readable name of the team. */
  teamName: string;
  /** Number of members on the team. */
  members: number;
  /** Total hours the team has available per sprint. */
  hoursPerSprint: number;
  /** Breakdown of hour allocation by category. */
  allocation: {
    /** Hours allocated to development work. */
    development: number;
    /** Hours allocated to meetings. */
    meetings: number;
    /** Hours allocated to support activities. */
    support: number;
    /** Hours reserved as buffer/unallocated. */
    buffer: number;
  };
  /** Overall team availability expressed as a percentage. */
  availability: number; // percentage
}

/**
 * Result of a velocity forecast produced by a prediction model.
 */
interface Prediction {
  /** Model used to produce the prediction. */
  model: PredictionModel;
  /** Confidence level of the prediction expressed as a percentage. */
  confidence: number; // percentage
  /** Human-readable description of the forecast timeframe. */
  timeframe: string;
  /** Central predicted velocity value. */
  predictedVelocity: number;
  /** Upper bound of the predicted velocity range. */
  upperBound: number;
  /** Lower bound of the predicted velocity range. */
  lowerBound: number;
}

/**
 * Configuration object driving velocity tracking, capacity planning, and prediction.
 */
interface VelocityTrackingConfig {
  /** Name of the project this configuration applies to. */
  projectName: string;
  /** Cloud providers targeted by the generated artifacts. */
  providers: ('aws' | 'azure' | 'gcp')[];
  /** Recorded sprint data entries. */
  sprints: SprintData[];
  /** Aggregated velocity trend entries. */
  trends: VelocityTrend[];
  /** Per-team capacity plans. */
  capacity: CapacityPlan[];
  /** Velocity predictions produced by configured models. */
  predictions: Prediction[];
  /** Whether predictive analytics features are enabled. */
  enablePredictiveAnalytics: boolean;
  /** Whether capacity planning features are enabled. */
  enableCapacityPlanning: boolean;
  /** Whether resource optimization features are enabled. */
  enableResourceOptimization: boolean;
}

/**
 * Prints a human-readable summary of the velocity tracking configuration to the console.
 *
 * @param config - The velocity tracking configuration to display.
 * @returns No return value; output is written to stdout.
 */
export function displayConfig(config: VelocityTrackingConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '🚀 Velocity Tracking and Capacity Planning');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Sprints:', config.sprints.length);
  console.log('\x1b[33m%s\x1b[0m', 'Trends:', config.trends.length);
  console.log('\x1b[33m%s\x1b[0m', 'Capacity Plans:', config.capacity.length);
  console.log('\x1b[33m%s\x1b[0m', 'Predictions:', config.predictions.length);
  console.log('\x1b[33m%s\x1b[0m', 'Predictive Analytics:', config.enablePredictiveAnalytics ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Capacity Planning:', config.enableCapacityPlanning ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Resource Optimization:', config.enableResourceOptimization ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

/**
 * Generates Markdown documentation describing the velocity tracking features.
 *
 * @param config - The velocity tracking configuration used to scope the documentation.
 * @returns A Markdown string summarizing supported velocity tracking features.
 */
export function generateVelocityTrackingMD(config: VelocityTrackingConfig): string {
  let md = '# Velocity Tracking and Capacity Planning\n\n';
  md += '## Features\n\n';
  md += '- Velocity metrics: story points, tasks completed, bugs resolved, features delivered\n';
  md += '- Time periods: sprint, week, month, quarter\n';
  md += '- Sprint data tracking with planned vs actual velocity\n';
  md += '- Team efficiency calculation\n';
  md += '- Capacity planning with allocation breakdown\n';
  md += '- Resource availability tracking\n';
  md += '- Prediction models: linear, exponential, moving average, ML-based\n';
  md += '- Confidence intervals for predictions\n';
  md += '- Variance analysis\n';
  md += '- Predictive analytics for forecasting\n';
  md += '- Resource optimization recommendations\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

/**
 * Generates a Terraform header string for velocity tracking infrastructure.
 *
 * @param config - The velocity tracking configuration providing the project name.
 * @returns A Terraform code string containing a header comment for the project.
 */
export function generateTerraformVelocityTracking(config: VelocityTrackingConfig): string {
  let code = '# Auto-generated Velocity Tracking Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

/**
 * Generates TypeScript source code for a velocity tracking manager class.
 *
 * @param config - The velocity tracking configuration providing project details.
 * @returns TypeScript source code string defining a `VelocityTrackingManager` class.
 */
export function generateTypeScriptVelocityTracking(config: VelocityTrackingConfig): string {
  let code = '// Auto-generated Velocity Tracking Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class VelocityTrackingManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const velocityTrackingManager = new VelocityTrackingManager();\n';
  code += 'export default velocityTrackingManager;\n';
  return code;
}

/**
 * Generates Python source code for a velocity tracking manager class.
 *
 * @param config - The velocity tracking configuration providing project details.
 * @returns Python source code string defining a `VelocityTrackingManager` class.
 */
export function generatePythonVelocityTracking(config: VelocityTrackingConfig): string {
  let code = '# Auto-generated Velocity Tracking Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class VelocityTrackingManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'velocity_tracking_manager = VelocityTrackingManager()\n';
  return code;
}

/**
 * Writes the velocity tracking artifacts (Terraform, code, Markdown, and config) to disk.
 *
 * Depending on the requested language, TypeScript or Python source files are generated
 * along with the corresponding dependency manifests. Markdown documentation and a JSON
 * configuration file are always written.
 *
 * @param config - The velocity tracking configuration to materialize.
 * @param outputDir - Absolute or relative path of the directory to write files into.
 * @param language - Target language for generated source code, either `'typescript'` or `'python'`.
 * @returns A promise that resolves when all files have been written.
 */
export async function writeFiles(config: VelocityTrackingConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformVelocityTracking(config);
  await fs.writeFile(path.join(outputDir, 'velocity-tracking.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptVelocityTracking(config);
    await fs.writeFile(path.join(outputDir, 'velocity-tracking-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-velocity-tracking',
      version: '1.0.0',
      description: 'Velocity Tracking and Capacity Planning',
      main: 'velocity-tracking-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonVelocityTracking(config);
    await fs.writeFile(path.join(outputDir, 'velocity_tracking_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'scikit-learn>=1.2.0', 'numpy>=1.24.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateVelocityTrackingMD(config);
  await fs.writeFile(path.join(outputDir, 'VELOCITY_TRACKING.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    sprints: config.sprints,
    trends: config.trends,
    capacity: config.capacity,
    predictions: config.predictions,
    enablePredictiveAnalytics: config.enablePredictiveAnalytics,
    enableCapacityPlanning: config.enableCapacityPlanning,
    enableResourceOptimization: config.enableResourceOptimization,
  };
  await fs.writeFile(path.join(outputDir, 'velocity-tracking-config.json'), JSON.stringify(configJson, null, 2));
}

/**
 * Returns the provided velocity tracking configuration unchanged.
 *
 * Acts as a pass-through/identity helper for the velocity tracking configuration,
 * useful for validation pipelines or future augmentation.
 *
 * @param config - The velocity tracking configuration to return.
 * @returns The same `VelocityTrackingConfig` instance that was provided.
 */
export function velocityTracking(config: VelocityTrackingConfig): VelocityTrackingConfig {
  return config;
}
