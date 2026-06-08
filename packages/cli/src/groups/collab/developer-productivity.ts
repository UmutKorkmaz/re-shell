import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab developer-productivity` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerDeveloperProductivity(collab: Command): void {
  collab
  .command('developer-productivity')
  .description('Generate developer productivity metrics and personalized dashboards with insights')
  .argument('<name>', 'Name of the developer productivity setup')
  .option('--enable-personalization', 'Enable personalized dashboards')
  .option('--enable-benchmarking', 'Enable team benchmarking')
  .option('--enable-goal-tracking', 'Enable goal tracking')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './developer-productivity')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/developer-productivity.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      metrics: [
        { id: 'm1', name: 'Commits per Day', category: 'code' as const, unit: 'commits', target: 10, current: 12, trend: 'up' as const },
        { id: 'm2', name: 'Code Review Time', category: 'review' as const, unit: 'hours', target: 4, current: 3.5, trend: 'down' as const },
        { id: 'm3', name: 'PR Merge Rate', category: 'quality' as const, unit: '%', target: 95, current: 92, trend: 'stable' as const },
        { id: 'm4', name: 'Sprint Velocity', category: 'velocity' as const, unit: 'story points', target: 50, current: 48, trend: 'up' as const },
      ],
      developers: [
        {
          developerId: 'dev1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
          team: 'Frontend',
          metrics: {
            commitsCount: 245,
            linesAdded: 15420,
            linesRemoved: 3280,
            pullRequestsCreated: 18,
            pullRequestsReviewed: 32,
            codeReviewsCompleted: 28,
            avgReviewTime: 2.5,
            issuesClosed: 15,
            tasksCompleted: 42,
            velocity: 52,
            codeChurn: 0.21,
          },
          period: 'weekly' as const,
        },
        {
          developerId: 'dev2',
          name: 'Bob Smith',
          email: 'bob@example.com',
          team: 'Backend',
          metrics: {
            commitsCount: 198,
            linesAdded: 12350,
            linesRemoved: 4120,
            pullRequestsCreated: 14,
            pullRequestsReviewed: 28,
            codeReviewsCompleted: 25,
            avgReviewTime: 3.2,
            issuesClosed: 12,
            tasksCompleted: 38,
            velocity: 45,
            codeChurn: 0.33,
          },
          period: 'weekly' as const,
        },
      ],
      widgets: [
        { id: 'w1', title: 'Commits Over Time', type: 'line' as const, metric: 'commits', timeRange: 'weekly' as const, position: { x: 0, y: 0, w: 12, h: 6 }, comparison: true },
        { id: 'w2', title: 'Code Review Time', type: 'bar' as const, metric: 'reviewTime', timeRange: 'weekly' as const, position: { x: 12, y: 0, w: 6, h: 6 }, comparison: false },
        { id: 'w3', title: 'Velocity Distribution', type: 'pie' as const, metric: 'velocity', timeRange: 'monthly' as const, position: { x: 0, y: 6, w: 6, h: 6 }, comparison: true },
      ],
      insights: [
        { id: 'i1', type: 'achievement' as const, title: 'Top Performer', description: 'Alice is in the top 10% of contributors this week', actionable: false, priority: 'low' as const },
        { id: 'i2', type: 'improvement' as const, title: 'Review Time Improvement', description: 'Consider reducing code review time by setting up automated checks', actionable: true, priority: 'medium' as const },
        { id: 'i3', type: 'warning' as const, title: 'High Code Churn', description: 'Bob\'s code churn rate (33%) is above team average', actionable: true, priority: 'high' as const },
      ],
      enablePersonalization: options.enablePersonalization || false,
      enableBenchmarking: options.enableBenchmarking || false,
      enableGoalTracking: options.enableGoalTracking || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating developer productivity configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: developer-productivity.tf`));
      console.log(chalk.green(`✅ Generated: developer-productivity-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: DEVELOPER_PRODUCTIVITY.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: developer-productivity-config.json\n`));

      console.log(chalk.green('✓ Developer productivity configuration generated successfully!'));
    }, 30000);
  }));

// Code quality trends commands
}
