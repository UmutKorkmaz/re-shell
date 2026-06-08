import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab code-review-workflow` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerCodeReviewWorkflow(collab: Command): void {
  collab
  .command('code-review-workflow')
  .description('Generate real-time code review and approval workflows with integration')
  .argument('<name>', 'Name of the code review workflow setup')
  .option('--integration <provider>', 'Integration provider (github, gitlab, bitbucket, azure-devops)', 'github')
  .option('--min-approvals <number>', 'Minimum approvals required', '2')
  .option('--min-reviewers <number>', 'Minimum reviewers required', '1')
  .option('--enable-auto-merge', 'Enable auto-merge after approval')
  .option('--enable-auto-review', 'Enable automated reviews')
  .option('--enable-comments', 'Enable comment threading')
  .option('--enable-notifications', 'Enable notifications')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './code-review-workflow')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/code-review-workflow.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      review: {
        minApprovals: parseInt(options.minApprovals),
        minReviewers: parseInt(options.minReviewers),
        autoMerge: options.enableAutoMerge || false,
        blockingChecks: ['ci-tests', 'code-coverage', 'linting'],
      },
      comments: [
        { id: 'c1', userId: 'user1', userName: 'Developer 1', file: 'index.ts', line: 42, content: 'Consider using async/await', resolved: false, timestamp: Date.now() },
        { id: 'c2', userId: 'user2', userName: 'Developer 2', file: 'api.ts', line: 15, content: 'Add error handling', resolved: false, timestamp: Date.now() },
      ],
      rules: [
        { name: 'senior-review', condition: 'seniority >= senior', required: true, role: 'senior-developer' },
        { name: 'code-owner', condition: 'file_match_pattern', required: false },
      ],
      integration: options.integration as ('github' | 'gitlab' | 'bitbucket' | 'azure-devops'),
      enableAutoReview: options.enableAutoReview || false,
      enableComments: options.enableComments || false,
      enableNotifications: options.enableNotifications || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating code review workflow configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: code-review-workflow.tf`));
      console.log(chalk.green(`✅ Generated: code-review-workflow-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: CODE_REVIEW_WORKFLOW.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: code-review-workflow-config.json\n`));

      console.log(chalk.green('✓ Code review workflow configuration generated successfully!'));
    }, 30000);
  }));

// Collaborative testing commands
}
