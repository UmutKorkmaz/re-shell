import { Command } from 'commander';
import { createAsyncCommand } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab collaboration` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerCollaboration(collab: Command): void {
  collab
  .command('collaboration')
  .description('Generate advanced collaboration and team management features with analytics')
  .argument('<name>', 'Name of the collaboration project')
  .option('--organization <name>', 'Organization name', 'Acme Corp')
  .option('--description <description>', 'Project description')
  .option('--enable-messaging', 'Enable real-time messaging')
  .option('--enable-file-sharing', 'Enable file sharing')
  .option('--enable-code-review', 'Enable code review workflow')
  .option('--enable-tasks', 'Enable task management')
  .option('--enable-video', 'Enable video conferencing')
  .option('--enable-analytics', 'Enable analytics and reporting')
  .option('--max-file-size <mb>', 'Maximum file size in MB', '100')
  .option('--max-team-size <number>', 'Maximum team size', '1000')
  .option('--enable-aws', 'Enable AWS provider')
  .option('--enable-azure', 'Enable Azure provider')
  .option('--enable-gcp', 'Enable GCP provider')
  .option('--output <directory>', 'Output directory', './collaboration-output')
  .option('--language <language>', 'Language (typescript, python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const {
      writeCollaborationFiles,
      displayCollaborationConfig,
      createExampleCollaborationConfig
    } = await import('../../utils/collaboration.js');

    const config = createExampleCollaborationConfig();
    config.organization = options.organization;
    config.description = options.description;
    config.enableMessaging = options.enableMessaging === true;
    config.enableFileSharing = options.enableFileSharing === true;
    config.enableCodeReview = options.enableCodeReview === true;
    config.enableTaskManagement = options.enableTasks === true;
    config.enableVideoConferencing = options.enableVideo === true;
    config.enableAnalytics = options.enableAnalytics === true;
    config.maxFileSize = parseInt(options.maxFileSize);
    config.maxTeamSize = parseInt(options.maxTeamSize);

    displayCollaborationConfig(config, options.language, options.output);

    await writeCollaborationFiles(config, options.output, options.language);

    console.log(chalk.green(`\n✅ Files generated successfully in: ${options.output}`));
    console.log(chalk.green('✅ Generated files:'));
    console.log(chalk.green(`✅ Generated: ${options.language === 'typescript' ? 'collaboration-manager.ts' : 'collaboration_manager.py'}`));
    console.log(chalk.green('✅ Generated: COLLABORATION_GUIDE.md'));
    console.log(chalk.green('✅ Generated: collaboration-config.json'));
    console.log(chalk.green('✅ Generated: terraform/provider/main.tf\n'));

    console.log(chalk.green('✓ Collaboration platform configured successfully!'));
  }));
}
