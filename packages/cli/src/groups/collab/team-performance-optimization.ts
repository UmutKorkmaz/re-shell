import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab team-performance-optimization` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerTeamPerformanceOptimization(collab: Command): void {
  collab
  .command('team-performance-optimization')
  .description('Generate team performance optimization recommendations with coaching')
  .argument('<name>', 'Name of the team performance optimization setup')
  .option('--enable-auto-detection', 'Enable automated performance issue detection')
  .option('--enable-progress-tracking', 'Enable progress tracking')
  .option('--enable-feedback-collection', 'Enable feedback collection')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './team-performance-optimization')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/team-performance-optimization.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      issues: [
        {
          id: 'issue1',
          teamId: 'team1',
          teamName: 'Frontend Squad',
          area: 'velocity' as const,
          description: 'Team velocity has declined by 20% over the last 3 sprints',
          severity: 7,
          impact: 'Reduced delivery capacity, missed sprint goals',
          detectedAt: Date.now() - 604800000,
        },
        {
          id: 'issue2',
          teamId: 'team2',
          teamName: 'Backend Squad',
          area: 'quality' as const,
          description: 'Code review time exceeds 48 hours on average',
          severity: 5,
          impact: 'Delayed feedback cycles, slower iteration',
          detectedAt: Date.now() - 1209600000,
        },
        {
          id: 'issue3',
          teamId: 'team1',
          teamName: 'Frontend Squad',
          area: 'collaboration' as const,
          description: 'Low cross-team collaboration, knowledge silos forming',
          severity: 6,
          impact: 'Duplicate work, reduced knowledge sharing',
          detectedAt: Date.now() - 2592000000,
        },
      ],
      recommendations: [
        {
          id: 'rec1',
          issueId: 'issue1',
          type: 'training' as const,
          title: 'Advanced React Performance Optimization Training',
          description: 'Provide training on React performance optimization techniques to improve velocity',
          expectedImpact: 25,
          effort: 3,
          priority: 'high' as const,
          dependencies: [],
        },
        {
          id: 'rec2',
          issueId: 'issue2',
          type: 'process-change' as const,
          title: 'Implement Code Review SLA',
          description: 'Establish 24-hour maximum code review turnaround time',
          expectedImpact: 40,
          effort: 5,
          priority: 'medium' as const,
          dependencies: [],
        },
        {
          id: 'rec3',
          issueId: 'issue3',
          type: 'mentorship' as const,
          title: 'Cross-team Pair Programming Sessions',
          description: 'Organize weekly pair programming sessions between frontend and backend teams',
          expectedImpact: 30,
          effort: 7,
          priority: 'medium' as const,
          dependencies: [],
        },
      ],
      sessions: [
        {
          id: 'session1',
          teamId: 'team1',
          coachId: 'coach1',
          style: 'facilitative' as const,
          focus: ['velocity-improvement', 'sprint-planning', 'estimation'],
          frequency: 'weekly' as const,
          duration: 60,
          goals: ['Increase velocity by 20%', 'Reduce estimation variance', 'Improve sprint predictability'],
          progress: 35,
        },
        {
          id: 'session2',
          teamId: 'team2',
          coachId: 'coach2',
          style: 'directive' as const,
          focus: ['code-quality', 'review-process', 'best-practices'],
          frequency: 'bi-weekly' as const,
          duration: 45,
          goals: ['Reduce code review time to under 24 hours', 'Improve code quality scores'],
          progress: 60,
        },
      ],
      goals: [
        {
          id: 'goal1',
          teamId: 'team1',
          area: 'velocity' as const,
          current: 40,
          target: 50,
          deadline: Date.now() + 2592000000,
          status: 'on-track' as const,
        },
        {
          id: 'goal2',
          teamId: 'team2',
          area: 'quality' as const,
          current: 72,
          target: 85,
          deadline: Date.now() + 5184000000,
          status: 'at-risk' as const,
        },
      ],
      enableAutoDetection: options.enableAutoDetection || false,
      enableProgressTracking: options.enableProgressTracking || false,
      enableFeedbackCollection: options.enableFeedbackCollection || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating team performance optimization configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: team-performance-optimization.tf`));
      console.log(chalk.green(`✅ Generated: team-performance-optimization-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: TEAM_PERFORMANCE_OPTIMIZATION.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: team-performance-optimization-config.json\n`));

      console.log(chalk.green('✓ Team performance optimization configuration generated successfully!'));
    }, 30000);
  }));

// Knowledge sharing automation commands
}
