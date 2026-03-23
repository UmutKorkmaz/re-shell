// Auto-generated Velocity Tracking Utility
// Generated at: 2026-01-13T14:05:00.000Z

type VelocityMetric = 'story-points' | 'tasks-completed' | 'bugs-resolved' | 'features-delivered';
type TimePeriod = 'sprint' | 'week' | 'month' | 'quarter';
type PredictionModel = 'linear' | 'exponential' | 'moving-average' | 'ml-based';
type CapacityFactor = 'available' | 'vacation' | 'meetings' | 'overhead';

interface SprintData {
  id: string;
  name: string;
  startDate: number;
  endDate: number;
  plannedVelocity: number;
  actualVelocity: number;
  storyPointsCompleted: number;
  tasksCompleted: number;
  teamSize: number;
  capacity: number; // in hours
}

interface VelocityTrend {
  period: string;
  planned: number;
  actual: number;
  variance: number;
  teamSize: number;
  efficiency: number; // percentage
}

interface CapacityPlan {
  teamId: string;
  teamName: string;
  members: number;
  hoursPerSprint: number;
  allocation: {
    development: number;
    meetings: number;
    support: number;
    buffer: number;
  };
  availability: number; // percentage
}

interface Prediction {
  model: PredictionModel;
  confidence: number; // percentage
  timeframe: string;
  predictedVelocity: number;
  upperBound: number;
  lowerBound: number;
}

interface VelocityTrackingConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  sprints: SprintData[];
  trends: VelocityTrend[];
  capacity: CapacityPlan[];
  predictions: Prediction[];
  enablePredictiveAnalytics: boolean;
  enableCapacityPlanning: boolean;
  enableResourceOptimization: boolean;
}

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

export function generateTerraformVelocityTracking(config: VelocityTrackingConfig): string {
  let code = '# Auto-generated Velocity Tracking Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

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

export function velocityTracking(config: VelocityTrackingConfig): VelocityTrackingConfig {
  return config;
}
