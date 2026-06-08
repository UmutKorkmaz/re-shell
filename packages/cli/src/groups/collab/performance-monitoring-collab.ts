import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab performance-monitoring-collab` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerPerformanceMonitoringCollab(collab: Command): void {
  collab
  .command('performance-monitoring-collab')
  .description('Generate real-time performance monitoring collaboration with shared dashboards')
  .argument('<name>', 'Name of the performance monitoring collaboration setup')
  .option('--enable-shared-dashboards', 'Enable shared dashboards')
  .option('--enable-realtime-updates', 'Enable real-time dashboard updates')
  .option('--enable-annotations', 'Enable annotations for events')
  .option('--enable-collab-editing', 'Enable collaborative dashboard editing')
  .option('--max-viewers <number>', 'Maximum concurrent viewers', '50')
  .option('--max-editors <number>', 'Maximum concurrent editors', '10')
  .option('--enable-export', 'Enable dashboard export')
  .option('--enable-scheduling', 'Enable dashboard scheduling')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './performance-monitoring-collab')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/performance-monitoring-collab.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      dashboards: [
        {
          id: 'dash1',
          name: 'Application Performance',
          widgets: [
            { id: 'w1', title: 'Request Rate', type: 'line' as const, metrics: [{ id: 'm1', name: 'http_requests_total', type: 'counter' as const, query: 'rate(http_requests_total[5m])', dataSource: 'prometheus' as const, labels: { app: 'web' } }], position: { x: 0, y: 0, w: 12, h: 6 }, refreshInterval: '5s' as const, drillingEnabled: true },
            { id: 'w2', title: 'Error Rate', type: 'gauge' as const, metrics: [{ id: 'm2', name: 'http_errors_total', type: 'counter' as const, query: 'rate(http_errors_total[5m])', dataSource: 'prometheus' as const, labels: {} }], position: { x: 12, y: 0, w: 6, h: 6 }, refreshInterval: '10s' as const, drillingEnabled: true },
          ],
        },
        {
          id: 'dash2',
          name: 'Infrastructure Metrics',
          widgets: [
            { id: 'w3', title: 'CPU Usage', type: 'heatmap' as const, metrics: [{ id: 'm3', name: 'cpu_usage_percent', type: 'gauge' as const, query: 'avg(cpu_usage_percent)', dataSource: 'grafana' as const, labels: {} }], position: { x: 0, y: 0, w: 8, h: 8 }, refreshInterval: '30s' as const, drillingEnabled: false },
          ],
        },
      ],
      widgets: [
        { id: 'w4', title: 'Memory Usage', type: 'line' as const, metrics: [{ id: 'm4', name: 'memory_usage_bytes', type: 'gauge' as const, query: 'memory_usage_bytes', dataSource: 'cloudwatch' as const, labels: { instance: 'i-123' } }], position: { x: 0, y: 0, w: 12, h: 6 }, refreshInterval: '1m' as const, drillingEnabled: true },
      ],
      alerts: [
        { id: 'a1', name: 'High Error Rate', condition: 'error_rate > 5', threshold: 5, duration: '5m', severity: 'critical' as const, notificationChannels: ['slack', 'pagerduty'] },
        { id: 'a2', name: 'High Latency', condition: 'p95_latency > 1000ms', threshold: 1000, duration: '10m', severity: 'warning' as const, notificationChannels: ['slack'] },
      ],
      collaboration: {
        enableSharedDashboards: options.enableSharedDashboards || false,
        enableRealTimeUpdates: options.enableRealtimeUpdates || false,
        enableAnnotations: options.enableAnnotations || false,
        enableCollaborativeEditing: options.enableCollabEditing || false,
        maxViewers: parseInt(options.maxViewers),
        maxEditors: parseInt(options.maxEditors),
      },
      enableExport: options.enableExport || false,
      enableScheduling: options.enableScheduling || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating performance monitoring collaboration configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: performance-monitoring-collab.tf`));
      console.log(chalk.green(`✅ Generated: performance-monitoring-collab-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: PERFORMANCE_MONITORING_COLLAB.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: performance-monitoring-collab-config.json\n`));

      console.log(chalk.green('✓ Performance monitoring collaboration configuration generated successfully!'));
    }, 30000);
  }));

// Incident response commands
}
