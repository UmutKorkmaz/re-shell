import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';

/**
 * Registers the `config profile env` and `config profile template` subgroups
 * onto the shared profile command. Split out of profile.ts to stay under the
 * 800-line limit. Extracted verbatim from the former config.group.ts.
 */
export function registerProfileSubgroups(profileGroup: Command): void {
  // --- config profile env ---
  const profileEnvGroup = profileGroup.command('env')
    .description('Manage encrypted environment variables for profiles');

  profileEnvGroup
    .command('add <profile> <name> <value>')
    .description('Add environment variable to profile (with optional encryption)')
    .option('--no-encrypt', 'Store without encryption')
    .option('--description <desc>', 'Variable description')
    .option('--required', 'Mark as required')
    .action(
      createAsyncCommand(async (profileName, varName, value, options) => {
        const { addEnvVariable } = await import('../../commands/profile-env');
        await addEnvVariable(profileName, varName, value, {
          encrypt: options.encrypt !== false,
          description: options.description,
          required: options.required,
        });
      })
    );

  profileEnvGroup
    .command('list <profile>')
    .description('List all environment variables for a profile')
    .action(
      createAsyncCommand(async (profileName, options) => {
        const { listEnvVariables } = await import('../../commands/profile-env');
        await listEnvVariables(profileName);
      })
    );

  profileEnvGroup
    .command('remove <profile> <name>')
    .description('Remove environment variable from profile')
    .action(
      createAsyncCommand(async (profileName, varName, options) => {
        const { removeEnvVariable } = await import('../../commands/profile-env');
        await removeEnvVariable(profileName, varName);
      })
    );

  profileEnvGroup
    .command('export <profile>')
    .description('Export environment variables to .env file')
    .option('--output <file>', 'Output file path', '.env')
    .option('--no-decrypt', 'Export encrypted values without decrypting')
    .action(
      createAsyncCommand(async (profileName, options) => {
        const spinner = createSpinner('Exporting environment variables...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { exportEnvVariables } = await import('../../commands/profile-env');
          await exportEnvVariables(profileName, {
            outputPath: options.output,
            decrypt: options.decrypt !== false,
          });
          spinner.stop();
        }, 10000);
      })
    );

  profileEnvGroup
    .command('validate <profile>')
    .description('Validate required environment variables are set')
    .action(
      createAsyncCommand(async (profileName, options) => {
        const spinner = createSpinner('Validating environment variables...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateRequiredEnvVars } = await import('../../commands/profile-env');
          const result = await validateRequiredEnvVars(profileName);

          spinner.stop();

          console.log(chalk.cyan.bold(`\n🔍 Environment Variable Validation: ${profileName}\n`));

          if (result.valid) {
            console.log(chalk.green(`✓ All required variables are set\n`));
            console.log(chalk.gray('Present:'));
            result.present.forEach(v => console.log(chalk.gray(`  ✓ ${v}`)));
          } else {
            console.log(chalk.red(`✗ Missing required variables\n`));
            console.log(chalk.red('Missing:'));
            result.missing.forEach(v => console.log(chalk.red(`  ✗ ${v}`)));
            console.log('');
            console.log(chalk.gray('Present:'));
            result.present.forEach(v => console.log(chalk.gray(`  ✓ ${v}`)));
          }
          console.log('');
        }, 10000);
      })
    );

  profileEnvGroup
    .command('migrate [source]')
    .description('Migrate existing .env file to encrypted storage')
    .option('--profile <name>', 'Target profile name', 'production')
    .action(
      createAsyncCommand(async (source = '.env', options) => {
        const spinner = createSpinner('Migrating environment variables...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { migrateToEncryptedStorage } = await import('../../commands/profile-env');
          spinner.stop();
          await migrateToEncryptedStorage(source, options.profile);
        }, 10000);
      })
    );

  // --- config profile template ---
  const profileTemplateGroup = profileGroup.command('template')
    .description('Manage profile templates for common scenarios');

  profileTemplateGroup
    .command('list')
    .description('List all available profile templates')
    .action(
      createAsyncCommand(async (options) => {
        const { listTemplates } = await import('../../commands/profile-templates');
        listTemplates();
      })
    );

  profileTemplateGroup
    .command('show <id>')
    .description('Show template details')
    .action(
      createAsyncCommand(async (id, options) => {
        const { showTemplate } = await import('../../commands/profile-templates');
        showTemplate(id);
      })
    );

  profileTemplateGroup
    .command('apply <id> [name]')
    .description('Apply template to create a new profile')
    .option('--overwrite', 'Overwrite existing profile')
    .action(
      createAsyncCommand(async (id, name, options) => {
        const spinner = createSpinner('Applying template...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { applyTemplate } = await import('../../commands/profile-templates');
          await applyTemplate(id, name || id, options);
          spinner.stop();
        }, 10000);
      })
    );

  profileTemplateGroup
    .command('search <keyword>')
    .description('Search templates by keyword')
    .action(
      createAsyncCommand(async (keyword, options) => {
        const { searchTemplates } = await import('../../commands/profile-templates');
        searchTemplates(keyword);
      })
    );
}
