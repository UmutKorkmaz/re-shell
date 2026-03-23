// Auto-generated Team Performance Optimization Utility
// Generated at: 2026-01-13T14:15:00.000Z

type PerformanceArea = 'velocity' | 'quality' | 'collaboration' | 'communication' | 'technical-skills';
type ImprovementType = 'training' | 'mentorship' | 'process-change' | 'tool-upgrade' | 'resource-adjustment';
type CoachingStyle = 'directive' | 'facilitative' | 'supportive' | 'autocratic';
type Priority = 'low' | 'medium' | 'high' | 'critical';

interface PerformanceIssue {
  id: string;
  teamId: string;
  teamName: string;
  area: PerformanceArea;
  description: string;
  severity: number; // 1-10
  impact: string;
  detectedAt: number;
}

interface OptimizationRecommendation {
  id: string;
  issueId: string;
  type: ImprovementType;
  title: string;
  description: string;
  expectedImpact: number; // percentage
  effort: number; // in days
  priority: Priority;
  dependencies: string[];
}

interface CoachingSession {
  id: string;
  teamId: string;
  coachId: string;
  style: CoachingStyle;
  focus: string[];
  frequency: 'weekly' | 'bi-weekly' | 'monthly';
  duration: number; // in minutes
  goals: string[];
  progress: number; // percentage
}

interface PerformanceGoal {
  id: string;
  teamId: string;
  area: PerformanceArea;
  current: number;
  target: number;
  deadline: number;
  status: 'on-track' | 'at-risk' | 'behind' | 'achieved';
}

interface TeamPerformanceOptimizationConfig {
  projectName: string;
  providers: ('aws' | 'azure' | 'gcp')[];
  issues: PerformanceIssue[];
  recommendations: OptimizationRecommendation[];
  sessions: CoachingSession[];
  goals: PerformanceGoal[];
  enableAutoDetection: boolean;
  enableProgressTracking: boolean;
  enableFeedbackCollection: boolean;
}

export function displayConfig(config: TeamPerformanceOptimizationConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '🎯 Team Performance Optimization Recommendations');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Providers:', config.providers.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Performance Issues:', config.issues.length);
  console.log('\x1b[33m%s\x1b[0m', 'Recommendations:', config.recommendations.length);
  console.log('\x1b[33m%s\x1b[0m', 'Coaching Sessions:', config.sessions.length);
  console.log('\x1b[33m%s\x1b[0m', 'Performance Goals:', config.goals.length);
  console.log('\x1b[33m%s\x1b[0m', 'Auto Detection:', config.enableAutoDetection ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Progress Tracking:', config.enableProgressTracking ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Feedback Collection:', config.enableFeedbackCollection ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateTeamPerformanceOptimizationMD(config: TeamPerformanceOptimizationConfig): string {
  let md = '# Team Performance Optimization Recommendations with Coaching\n\n';
  md += '## Features\n\n';
  md += '- Performance areas: velocity, quality, collaboration, communication, technical skills\n';
  md += '- Improvement types: training, mentorship, process change, tool upgrade, resource adjustment\n';
  md += '- Coaching styles: directive, facilitative, supportive, autocratic\n';
  md += '- Performance issue detection and severity scoring\n';
  md += '- Impact assessment and prioritization\n';
  md += '- Optimization recommendations with expected impact\n';
  md += '- Effort estimation in days\n';
  md += '- Coaching session management\n';
  md += '- Performance goal tracking with deadlines\n';
  md += '- Progress monitoring and status tracking\n';
  md += '- Automated issue detection\n';
  md += '- Feedback collection\n';
  md += '- Multi-cloud provider support\n\n';
  return md;
}

export function generateTerraformTeamPerformanceOptimization(config: TeamPerformanceOptimizationConfig): string {
  let code = '# Auto-generated Team Performance Optimization Terraform for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  return code;
}

export function generateTypeScriptTeamPerformanceOptimization(config: TeamPerformanceOptimizationConfig): string {
  let code = '// Auto-generated Team Performance Optimization Manager for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'class TeamPerformanceOptimizationManager extends EventEmitter {\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    super();\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const teamPerformanceOptimizationManager = new TeamPerformanceOptimizationManager();\n';
  code += 'export default teamPerformanceOptimizationManager;\n';
  return code;
}

export function generatePythonTeamPerformanceOptimization(config: TeamPerformanceOptimizationConfig): string {
  let code = '# Auto-generated Team Performance Optimization Manager for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import asyncio\n';
  code += 'from typing import Dict, Any\n\n';
  code += 'class TeamPerformanceOptimizationManager:\n';
  code += '    def __init__(self, project_name: str = "' + config.projectName + '"):\n';
  code += '        self.project_name = project_name\n\n';
  code += 'team_performance_optimization_manager = TeamPerformanceOptimizationManager()\n';
  return code;
}

export async function writeFiles(config: TeamPerformanceOptimizationConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  const terraformCode = generateTerraformTeamPerformanceOptimization(config);
  await fs.writeFile(path.join(outputDir, 'team-performance-optimization.tf'), terraformCode);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptTeamPerformanceOptimization(config);
    await fs.writeFile(path.join(outputDir, 'team-performance-optimization-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-team-performance-optimization',
      version: '1.0.0',
      description: 'Team Performance Optimization Recommendations with Coaching',
      main: 'team-performance-optimization-manager.ts',
      dependencies: { '@types/node': '^20.0.0' },
      devDependencies: { typescript: '^5.0.0', 'ts-node': '^10.0.0' },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonTeamPerformanceOptimization(config);
    await fs.writeFile(path.join(outputDir, 'team_performance_optimization_manager.py'), pyCode);

    const requirements = ['asyncio>=3.4.3', 'scikit-learn>=1.2.0', 'pandas>=2.0.0'];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateTeamPerformanceOptimizationMD(config);
  await fs.writeFile(path.join(outputDir, 'TEAM_PERFORMANCE_OPTIMIZATION.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    providers: config.providers,
    issues: config.issues,
    recommendations: config.recommendations,
    sessions: config.sessions,
    goals: config.goals,
    enableAutoDetection: config.enableAutoDetection,
    enableProgressTracking: config.enableProgressTracking,
    enableFeedbackCollection: config.enableFeedbackCollection,
  };
  await fs.writeFile(path.join(outputDir, 'team-performance-optimization-config.json'), JSON.stringify(configJson, null, 2));
}

export function teamPerformanceOptimization(config: TeamPerformanceOptimizationConfig): TeamPerformanceOptimizationConfig {
  return config;
}
