import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab team-coding-sessions` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerTeamCodingSessions(collab: Command): void {
  collab
  .command('team-coding-sessions')
  .description('Generate team coding sessions with role-based permissions and activity tracking')
  .argument('<name>', 'Name of the team coding session setup')
  .option('--max-duration <minutes>', 'Maximum session duration in minutes', '240')
  .option('--enable-auto-archive', 'Enable auto-archive after session')
  .option('--enable-recording', 'Enable session recording')
  .option('--enable-voice-chat', 'Enable voice chat')
  .option('--enable-screen-share', 'Enable screen sharing')
  .option('--enable-analytics', 'Enable activity analytics')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './team-coding-sessions')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/team-coding-sessions.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      session: {
        name: name + '-session',
        maxDuration: parseInt(options.maxDuration),
        autoArchive: options.enableAutoArchive || false,
        recordingEnabled: options.enableRecording || false,
      },
      permissions: {
        host: { canEdit: true, canComment: true, canReview: true, canApprove: true, canExecute: true },
        moderator: { canEdit: true, canComment: true, canReview: true, canApprove: true, canExecute: false },
        editor: { canEdit: true, canComment: true, canReview: false, canApprove: false, canExecute: false },
        viewer: { canEdit: false, canComment: true, canReview: false, canApprove: false, canExecute: false },
        guest: { canEdit: false, canComment: false, canReview: false, canApprove: false, canExecute: false },
      },
      activityLog: [
        { userId: 'user1', userName: 'Developer 1', action: 'edit' as const, timestamp: Date.now(), details: { file: 'index.ts' } },
        { userId: 'user2', userName: 'Developer 2', action: 'comment' as const, timestamp: Date.now(), details: { line: 42 } },
      ],
      enableVoiceChat: options.enableVoiceChat || false,
      enableScreenShare: options.enableScreenShare || false,
      enableAnalytics: options.enableAnalytics || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating team coding sessions configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: team-coding-sessions.tf`));
      console.log(chalk.green(`✅ Generated: team-coding-sessions-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: TEAM_CODING_SESSIONS.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: team-coding-sessions-config.json\n`));

      console.log(chalk.green('✓ Team coding sessions configuration generated successfully!'));
    }, 30000);
  }));

// Code review workflow commands
}
