import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab custom-analytics` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerCustomAnalytics(collab: Command): void {
  collab
  .command('custom-analytics')
  .description('Generate custom analytics for management insights and reporting with drill-down')
  .argument('<name>', 'Name of the custom analytics setup')
  .option('--enable-scheduled-reports', 'Enable scheduled report generation')
  .option('--enable-realtime-updates', 'Enable real-time data updates')
  .option('--enable-data-export', 'Enable data export functionality')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './custom-analytics')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/custom-analytics.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      reports: [
        {
          id: 'report1',
          name: 'Executive Summary',
          type: 'executive' as const,
          description: 'High-level overview for executives',
          metrics: [
            { id: 'm1', name: 'Total Revenue', formula: 'SUM(revenue)', aggregation: 'sum' as const, format: 'currency' },
            { id: 'm2', name: 'Active Users', formula: 'COUNT(users)', aggregation: 'count' as const, format: 'number' },
            { id: 'm3', name: 'Customer Satisfaction', formula: 'AVG(satisfaction)', aggregation: 'avg' as const, format: 'percentage' },
          ],
          filters: { period: 'last-30-days' },
          groupBy: ['region'],
          orderBy: 'revenue',
          limit: 10,
        },
        {
          id: 'report2',
          name: 'Team Performance',
          type: 'performance' as const,
          description: 'Detailed team performance metrics',
          metrics: [
            { id: 'm4', name: 'Sprint Velocity', formula: 'AVG(velocity)', aggregation: 'avg' as const, format: 'number' },
            { id: 'm5', name: 'Code Quality', formula: 'AVG(quality_score)', aggregation: 'avg' as const, format: 'percentage' },
            { id: 'm6', name: 'Tasks Completed', formula: 'COUNT(completed_tasks)', aggregation: 'count' as const, format: 'number' },
          ],
          filters: { period: 'current-sprint' },
          groupBy: ['team', 'sprint'],
          orderBy: 'velocity',
          limit: 50,
        },
        {
          id: 'report3',
          name: 'Resource Utilization',
          type: 'resource' as const,
          description: 'Resource allocation and utilization',
          metrics: [
            { id: 'm7', name: 'Capacity Used', formula: 'SUM(capacity_used)', aggregation: 'sum' as const, format: 'hours' },
            { id: 'm8', name: 'Utilization Rate', formula: 'AVG(utilization)', aggregation: 'avg' as const, format: 'percentage' },
          ],
          filters: { period: 'last-week' },
          groupBy: ['team', 'resource_type'],
          orderBy: 'utilization',
          limit: 100,
        },
      ],
      dashboards: [
        {
          id: 'dash1',
          name: 'Management Overview',
          description: 'Executive dashboard with KPIs',
          reports: ['report1', 'report2', 'report3'],
          layout: [
            { reportId: 'report1', position: { x: 0, y: 0, w: 12, h: 6 } },
            { reportId: 'report2', position: { x: 0, y: 6, w: 6, h: 6 } },
            { reportId: 'report3', position: { x: 6, y: 6, w: 6, h: 6 } },
          ],
          refreshInterval: 300000, // 5 minutes
        },
      ],
      drillDown: {
        level: 'summary' as const,
        dimensions: ['team', 'sprint', 'region', 'product'],
        availableFilters: ['date_range', 'team', 'priority', 'status'],
        maxDepth: 5,
      },
      enableScheduledReports: options.enableScheduledReports || false,
      enableRealTimeUpdates: options.enableRealtimeUpdates || false,
      enableDataExport: options.enableDataExport || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating custom analytics configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: custom-analytics.tf`));
      console.log(chalk.green(`✅ Generated: custom-analytics-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: CUSTOM_ANALYTICS.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: custom-analytics-config.json\n`));

      console.log(chalk.green('✓ Custom analytics configuration generated successfully!'));
    }, 30000);
  }));

// Team performance optimization commands
}
