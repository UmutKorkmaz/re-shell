import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab communication-analysis` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerCommunicationAnalysis(collab: Command): void {
  collab
  .command('communication-analysis')
  .description('Generate team communication pattern analysis and optimization')
  .argument('<name>', 'Name of the communication analysis setup')
  .option('--enable-realtime-analysis', 'Enable real-time communication analysis')
  .option('--enable-sentiment-analysis', 'Enable sentiment analysis')
  .option('--enable-auto-optimization', 'Enable automatic optimization suggestions')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './communication-analysis')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/communication-analysis.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      patterns: [
        {
          teamId: 'team1',
          teamName: 'Frontend Squad',
          events: [
            { id: 'evt1', channel: 'slack' as const, type: 'message' as const, participants: ['user1', 'user2'], timestamp: Date.now() - 3600000, threadLength: 5 },
            { id: 'evt2', channel: 'zoom' as const, type: 'meeting' as const, participants: ['user1', 'user2', 'user3'], timestamp: Date.now() - 86400000, duration: 45 },
            { id: 'evt3', channel: 'jira' as const, type: 'comment' as const, participants: ['user2'], timestamp: Date.now() - 172800000, threadLength: 12 },
          ],
          metrics: [
            { channel: 'slack' as const, metric: 'response-time' as const, value: 15, unit: 'minutes', trend: 'improving' as const, benchmark: 30 },
            { channel: 'slack' as const, metric: 'participation' as const, value: 85, unit: '%', trend: 'stable' as const, benchmark: 70 },
            { channel: 'email' as const, metric: 'response-time' as const, value: 120, unit: 'minutes', trend: 'declining' as const, benchmark: 60 },
          ],
          strengths: ['High participation in standups', 'Quick Slack responses', 'Good meeting attendance'],
          weaknesses: ['Slow email response times', 'Low participation in async discussions', 'Meeting frequency too high'],
        },
        {
          teamId: 'team2',
          teamName: 'Backend Squad',
          events: [
            { id: 'evt4', channel: 'github' as const, type: 'comment' as const, participants: ['user3', 'user4'], timestamp: Date.now() - 7200000, threadLength: 8 },
            { id: 'evt5', channel: 'email' as const, type: 'email' as const, participants: ['user3'], timestamp: Date.now() - 14400000, threadLength: 3 },
          ],
          metrics: [
            { channel: 'github' as const, metric: 'participation' as const, value: 92, unit: '%', trend: 'improving' as const, benchmark: 70 },
            { channel: 'email' as const, metric: 'response-time' as const, value: 45, unit: 'minutes', trend: 'stable' as const, benchmark: 60 },
            { channel: 'slack' as const, metric: 'sentiment' as const, value: 7.5, unit: 'score', trend: 'stable' as const, benchmark: 6.0 },
          ],
          strengths: ['Excellent code review participation', 'Fast email responses', 'Positive sentiment in discussions'],
          weaknesses: ['Low Slack activity', 'Limited knowledge sharing', 'Async communication gaps'],
        },
      ],
      insights: [
        { id: 'insight1', type: 'bottleneck' as const, title: 'Email Response Time Bottleneck', description: 'Frontend Squad has slow email responses (120min vs 60min benchmark)', impact: 'Delayed decision making and blocked dependencies', priority: 'high' as const, actionable: true, recommendation: 'Implement email SLA and use async communication channels for urgent matters' },
        { id: 'insight2', type: 'best-practice' as const, title: 'GitHub Review Best Practice', description: 'Backend Squad has excellent PR participation at 92%', impact: 'High code quality and fast iteration cycles', priority: 'low' as const, actionable: false },
        { id: 'insight3', type: 'gap' as const, title: 'Knowledge Sharing Gap', description: 'Both teams have low cross-team knowledge sharing', impact: 'Duplicate work and reduced collaboration efficiency', priority: 'medium' as const, actionable: true, recommendation: 'Schedule weekly cross-team knowledge sharing sessions' },
      ],
      enableRealTimeAnalysis: options.enableRealtimeAnalysis || false,
      enableSentimentAnalysis: options.enableSentimentAnalysis || false,
      enableAutoOptimization: options.enableAutoOptimization || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating communication analysis configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: communication-analysis.tf`));
      console.log(chalk.green(`✅ Generated: communication-analysis-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: COMMUNICATION_ANALYSIS.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: communication-analysis-config.json\n`));

      console.log(chalk.green('✓ Communication analysis configuration generated successfully!'));
    }, 30000);
  }));
}
