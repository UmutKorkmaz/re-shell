import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab project-mgmt` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerProjectMgmt(collab: Command): void {
  collab
  .command('project-mgmt')
  .description('Generate project management and tracking systems with metrics and dashboards')
  .argument('<name>', 'Name of the project management system')
  .option('--organization <name>', 'Organization name', 'Acme Corp')
  .option('--enable-sprints', 'Enable sprint management')
  .option('--sprint-duration <weeks>', 'Sprint duration in weeks', '2')
  .option('--enable-points', 'Enable story point estimation')
  .option('--enable-time-tracking', 'Enable time tracking')
  .option('--require-time-estimate', 'Require time estimates for tasks')
  .option('--enable-issue-tracking', 'Enable issue tracking')
  .option('--auto-assign', 'Auto-assign issues to team members')
  .option('--enable-notifications', 'Enable notifications')
  .option('--notification-channels <channels>', 'Notification channels (comma-separated: email,slack,teams,webhook)', 'email,slack')
  .option('--enable-reporting', 'Enable reporting')
  .option('--report-frequency <frequency>', 'Report frequency (daily, weekly, sprint)', 'sprint')
  .option('--enable-burndown', 'Enable burndown charts')
  .option('--enable-velocity', 'Enable velocity tracking')
  .option('--velocity-sprints <count>', 'Number of sprints to average for velocity', '3')
  .option('--enable-capacity', 'Enable capacity planning')
  .option('--team-size <number>', 'Default team size', '7')
  .option('--enable-labels', 'Enable task labels')
  .option('--enable-epics', 'Enable epic tracking')
  .option('--enable-subtasks', 'Enable subtasks')
  .option('--subtask-depth <depth>', 'Maximum subtask depth', '3')
  .option('--enable-dependencies', 'Enable task dependencies')
  .option('--enable-blocked', 'Enable blocked status')
  .option('--require-completion', 'Require tasks to be completed for sprint')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './pm-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeProjectMgmtFiles, displayProjectMgmtConfig, createExampleProjectMgmtConfig } = await import('../../utils/project-mgmt.js');

    const providers: Array<'aws' | 'azure' | 'gcp'> = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const notificationChannels = options.notificationChannels.split(',').map((c: string) => c.trim());

    const finalConfig = createExampleProjectMgmtConfig();
    finalConfig.projectName = name;
    finalConfig.organization = options.organization;
    finalConfig.providers = providers.length > 0 ? providers : ['aws'];
    finalConfig.settings = {
      enableSprints: options.enableSprints === true,
      sprintDuration: parseInt(options.sprintDuration),
      sprintPointsEnabled: options.enablePoints === true,
      enableTimeTracking: options.enableTimeTracking === true,
      requireTimeEstimate: options.requireTimeEstimate === true,
      enableIssueTracking: options.enableIssueTracking !== false,
      autoAssignIssues: options.autoAssign === true,
      enableNotifications: options.enableNotifications !== false,
      notificationChannels: notificationChannels as Array<'email' | 'slack' | 'teams' | 'webhook'>,
      enableReporting: options.enableReporting !== false,
      reportFrequency: options.reportFrequency,
      enableBurndown: options.enableBurndown !== false,
      enableVelocity: options.enableVelocity !== false,
      velocitySprints: parseInt(options.velocitySprints),
      enableCapacityPlanning: options.enableCapacity === true,
      defaultTeamSize: parseInt(options.teamSize),
      enableLabels: options.enableLabels !== false,
      enableEpics: options.enableEpics !== false,
      enableSubtasks: options.enableSubtasks !== false,
      maxSubtaskDepth: parseInt(options.subtaskDepth),
      enableDependencies: options.enableDependencies !== false,
      enableBlockedStatus: options.enableBlocked !== false,
      requireCompletionForSprint: options.requireCompletion !== false,
    };

    displayProjectMgmtConfig(finalConfig, options.language, options.output);

    await writeProjectMgmtFiles(finalConfig, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    if (providers.length > 0) {
      console.log(chalk.green(`✅ Generated: terraform/${providers.join('/main.tf, terraform/')}/main.tf`));
    }
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'pm-manager.ts' : 'pm_manager.py'}`));
    console.log(chalk.green('✅ Generated: PROJECT_MGMT_GUIDE.md'));
    console.log(chalk.green('✅ Generated: pm-config.json\n'));

    console.log(chalk.green('✓ Project management system configured successfully!'));
  }));
}
