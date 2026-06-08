import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab burnout-detection` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerBurnoutDetection(collab: Command): void {
  collab
  .command('burnout-detection')
  .description('Generate team burnout detection and wellness monitoring')
  .argument('<name>', 'Name of the burnout detection setup')
  .option('--enable-realtime-monitoring', 'Enable real-time wellness monitoring')
  .option('--enable-automated-interventions', 'Enable automatic intervention triggers')
  .option('--enable-anonymous-surveys', 'Enable anonymous wellness surveys')
  .option('--survey-frequency <days>', 'Survey frequency in days', '30')
  .option('--risk-threshold <threshold>', 'Risk threshold percentage (0-100)', '70')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './burnout-detection-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { burnoutDetection, writeFiles, displayConfig } = await import('../../utils/burnout-detection.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    if (providers.length === 0) {
      providers.push('aws', 'azure', 'gcp');
    }

    const config = {
      projectName: name,
      providers,
      teamMembers: [
        {
          memberId: 'member1',
          memberName: 'Alice Johnson',
          team: 'Frontend',
          role: 'Senior Developer',
          indicators: [
            { metric: 'work-hours' as const, value: 52, unit: 'hours/week', threshold: 45, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'overtime' as const, value: 12, unit: 'hours/week', threshold: 5, status: 'critical' as const, trend: 'stable' as const },
            { metric: 'breaks' as const, value: 0.5, unit: 'hours/day', threshold: 1, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'time-off' as const, value: 0, unit: 'days/month', threshold: 2, status: 'critical' as const, trend: 'stable' as const },
            { metric: 'sentiment' as const, value: 3, unit: 'score (1-10)', threshold: 6, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'engagement' as const, value: 4, unit: 'score (1-10)', threshold: 7, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'stress-level' as const, value: 8, unit: 'score (1-10)', threshold: 6, status: 'critical' as const, trend: 'declining' as const },
            { metric: 'sleep-pattern' as const, value: 5, unit: 'hours/night', threshold: 7, status: 'warning' as const, trend: 'declining' as const },
          ],
          riskFactors: [
            { category: 'workload' as const, factor: 'Excessive overtime hours', severity: 8, duration: 45, impact: 'High stress and fatigue' },
            { category: 'workload' as const, factor: 'Multiple tight deadlines', severity: 7, duration: 30, impact: 'Pressure and anxiety' },
            { category: 'environment' as const, factor: 'Poor work-life balance', severity: 6, duration: 60, impact: 'Burnout risk' },
            { category: 'organizational' as const, factor: 'Limited team support', severity: 5, duration: 90, impact: 'Isolation and stress' },
          ],
          overallRiskLevel: 'high' as const,
          riskScore: 78,
          interventions: [
            {
              id: 'int-001',
              type: 'reduce-workload' as const,
              title: 'Reduce weekly hours',
              description: 'Limit work hours to 45 hours per week for next 4 weeks',
              priority: 'high' as const,
              status: 'in-progress' as const,
              startDate: new Date(),
              estimatedDuration: 28,
              effectiveness: 65,
            },
          ],
          lastAssessment: new Date(),
          nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          notes: ['Showing signs of burnout', 'Needs immediate attention', 'Consider time-off'],
        },
        {
          memberId: 'member2',
          memberName: 'Bob Smith',
          team: 'Backend',
          role: 'Tech Lead',
          indicators: [
            { metric: 'work-hours' as const, value: 42, unit: 'hours/week', threshold: 45, status: 'healthy' as const, trend: 'stable' as const },
            { metric: 'overtime' as const, value: 3, unit: 'hours/week', threshold: 5, status: 'healthy' as const, trend: 'improving' as const },
            { metric: 'breaks' as const, value: 1.2, unit: 'hours/day', threshold: 1, status: 'healthy' as const, trend: 'stable' as const },
            { metric: 'time-off' as const, value: 3, unit: 'days/month', threshold: 2, status: 'healthy' as const, trend: 'stable' as const },
            { metric: 'sentiment' as const, value: 7, unit: 'score (1-10)', threshold: 6, status: 'healthy' as const, trend: 'stable' as const },
            { metric: 'engagement' as const, value: 8, unit: 'score (1-10)', threshold: 7, status: 'healthy' as const, trend: 'improving' as const },
            { metric: 'stress-level' as const, value: 4, unit: 'score (1-10)', threshold: 6, status: 'healthy' as const, trend: 'stable' as const },
            { metric: 'sleep-pattern' as const, value: 7.5, unit: 'hours/night', threshold: 7, status: 'healthy' as const, trend: 'stable' as const },
          ],
          riskFactors: [],
          overallRiskLevel: 'low' as const,
          riskScore: 22,
          interventions: [],
          lastAssessment: new Date(),
          nextCheckIn: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          notes: ['Excellent wellness indicators', 'Role model for team'],
        },
        {
          memberId: 'member3',
          memberName: 'Carol Davis',
          team: 'QA',
          role: 'QA Engineer',
          indicators: [
            { metric: 'work-hours' as const, value: 48, unit: 'hours/week', threshold: 45, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'overtime' as const, value: 7, unit: 'hours/week', threshold: 5, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'breaks' as const, value: 0.7, unit: 'hours/day', threshold: 1, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'time-off' as const, value: 1, unit: 'days/month', threshold: 2, status: 'warning' as const, trend: 'stable' as const },
            { metric: 'sentiment' as const, value: 5, unit: 'score (1-10)', threshold: 6, status: 'warning' as const, trend: 'stable' as const },
            { metric: 'engagement' as const, value: 6, unit: 'score (1-10)', threshold: 7, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'stress-level' as const, value: 6, unit: 'score (1-10)', threshold: 6, status: 'warning' as const, trend: 'declining' as const },
            { metric: 'sleep-pattern' as const, value: 6, unit: 'hours/night', threshold: 7, status: 'warning' as const, trend: 'stable' as const },
          ],
          riskFactors: [
            { category: 'workload' as const, factor: 'Increasing workload', severity: 5, duration: 21, impact: 'Stress building' },
            { category: 'environment' as const, factor: 'Limited peer support', severity: 4, duration: 60, impact: 'Feeling isolated' },
          ],
          overallRiskLevel: 'medium' as const,
          riskScore: 55,
          interventions: [
            {
              id: 'int-002',
              type: 'mandatory-break' as const,
              title: 'Daily break enforcement',
              description: 'Take mandatory 1-hour break away from desk',
              priority: 'medium' as const,
              status: 'recommended' as const,
              estimatedDuration: 30,
            },
          ],
          lastAssessment: new Date(),
          nextCheckIn: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          notes: ['Early warning signs detected', 'Monitor closely'],
        },
      ],
      metricConfigs: [
        { metric: 'work-hours' as const, weight: 0.2, healthyRange: [35, 45] as [number, number], warningRange: [46, 50] as [number, number], criticalRange: [51, 100] as [number, number], collectionMethod: 'automated' as const },
        { metric: 'overtime' as const, weight: 0.15, healthyRange: [0, 5] as [number, number], warningRange: [6, 10] as [number, number], criticalRange: [11, 50] as [number, number], collectionMethod: 'automated' as const },
        { metric: 'breaks' as const, weight: 0.1, healthyRange: [1, 2] as [number, number], warningRange: [0.5, 0.9] as [number, number], criticalRange: [0, 0.4] as [number, number], collectionMethod: 'automated' as const },
        { metric: 'time-off' as const, weight: 0.1, healthyRange: [2, 10] as [number, number], warningRange: [0, 1] as [number, number], criticalRange: [0, 0] as [number, number], collectionMethod: 'manager-input' as const },
        { metric: 'sentiment' as const, weight: 0.15, healthyRange: [7, 10] as [number, number], warningRange: [4, 6] as [number, number], criticalRange: [1, 3] as [number, number], collectionMethod: 'survey' as const },
        { metric: 'engagement' as const, weight: 0.1, healthyRange: [7, 10] as [number, number], warningRange: [5, 6] as [number, number], criticalRange: [1, 4] as [number, number], collectionMethod: 'survey' as const },
        { metric: 'stress-level' as const, weight: 0.1, healthyRange: [1, 5] as [number, number], warningRange: [6, 7] as [number, number], criticalRange: [8, 10] as [number, number], collectionMethod: 'survey' as const },
        { metric: 'sleep-pattern' as const, weight: 0.1, healthyRange: [7, 10] as [number, number], warningRange: [5, 6] as [number, number], criticalRange: [0, 4] as [number, number], collectionMethod: 'survey' as const },
      ],
      interventions: [
        {
          id: 'int-001',
          type: 'reduce-workload' as const,
          title: 'Reduce weekly hours',
          description: 'Limit work hours to 45 hours per week for next 4 weeks',
          priority: 'high' as const,
          status: 'in-progress' as const,
          startDate: new Date(),
          estimatedDuration: 28,
          effectiveness: 65,
        },
        {
          id: 'int-002',
          type: 'mandatory-break' as const,
          title: 'Daily break enforcement',
          description: 'Take mandatory 1-hour break away from desk',
          priority: 'medium' as const,
          status: 'recommended' as const,
          estimatedDuration: 30,
        },
      ],
      enableRealTimeMonitoring: options.enableRealtimeMonitoring || false,
      enableAutomatedInterventions: options.enableAutomatedInterventions || false,
      enableAnonymousSurveys: options.enableAnonymousSurveys || false,
      surveyFrequency: parseInt(options.surveyFrequency),
      riskThreshold: parseInt(options.riskThreshold),
      escalationMatrix: {
        medium: ['Manager notification', 'Wellness resources', 'Check-in schedule'],
        high: ['HR notification', 'Mandatory counseling', 'Workload adjustment', 'Weekly reviews'],
        critical: ['Immediate HR intervention', 'Mandatory time-off', 'Comprehensive support', 'Daily monitoring'],
      },
    };

    const finalConfig = burnoutDetection(config);
    displayConfig(finalConfig);

    await writeFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: burnout-detection.tf`));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'burnout-detection-manager.ts' : 'burnout_detection_manager.py'}`));
    console.log(chalk.green(`✅ Generated: BURNOUT_DETECTION.md`));
    console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
    console.log(chalk.green(`✅ Generated: burnout-detection-config.json\n`));

    console.log(chalk.green('✓ Burnout detection configuration generated successfully!'));
  }));
}
