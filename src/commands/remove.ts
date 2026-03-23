import * as fs from 'fs-extra';
import * as path from 'path';
import prompts from 'prompts';
import chalk from 'chalk';
import { ProgressSpinner, flushOutput } from '../utils/spinner';

interface RemoveMicrofrontendOptions {
  force?: boolean;
  spinner?: ProgressSpinner;
}

/**
 * Removes a microfrontend from a Re-Shell project
 *
 * @param name - Name of the microfrontend to remove
 * @param options - Additional options for removal
 * @version 0.1.0
 */
export async function removeMicrofrontend(
  name: string,
  options: RemoveMicrofrontendOptions
): Promise<void> {
  const { force, spinner } = options;

  // Normalize name to kebab-case for consistency
  const normalizedName = name.toLowerCase().replace(/\s+/g, '-');

  console.log(chalk.cyan(`Removing microfrontend "${normalizedName}"...`));

  // Determine if we're in a Re-Shell project
  const isInReshellProject =
    fs.existsSync('package.json') && (fs.existsSync('apps') || fs.existsSync('packages'));

  if (!isInReshellProject) {
    throw new Error(
      'Not in a Re-Shell project. Please run this command from the root of a Re-Shell project.'
    );
  }

  // Check if the microfrontend exists
  const mfPath = path.resolve(process.cwd(), 'apps', normalizedName);
  if (!fs.existsSync(mfPath)) {
    throw new Error(`Microfrontend "${normalizedName}" not found in apps directory.`);
  }

  // Stop spinner for interactive prompts
  if (spinner) {
    spinner.stop();
  }

  // Confirm deletion unless --force flag is used
  if (!force) {
    const confirmation = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Are you sure you want to remove the microfrontend "${normalizedName}"? This cannot be undone.`,
      initial: false,
    });

    if (!confirmation.confirm) {
      console.log(chalk.yellow('Operation cancelled.'));
      return;
    }
  }

  // Restart spinner for file operations
  if (spinner) {
    spinner.start();
    spinner.setText('Checking for dependencies...');
    flushOutput();
  }

  // Check if the microfrontend is referenced in shell application
  const shellAppPath = path.resolve(process.cwd(), 'apps', 'shell');
  if (fs.existsSync(shellAppPath)) {
    const shellAppFiles = [
      path.join(shellAppPath, 'src', 'App.tsx'),
      path.join(shellAppPath, 'src', 'App.jsx'),
      path.join(shellAppPath, 'src', 'config.ts'),
      path.join(shellAppPath, 'src', 'config.js'),
    ];

    for (const file of shellAppFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes(normalizedName)) {
          console.log(
            chalk.yellow(
              `Warning: The microfrontend "${normalizedName}" appears to be referenced in ${file}.`
            )
          );
          console.log(
            chalk.yellow(`You should manually remove references to it to prevent errors.`)
          );
          break;
        }
      }
    }
  }

  // Remove the microfrontend directory
  fs.removeSync(mfPath);
  console.log(chalk.green(`Successfully removed microfrontend "${normalizedName}".`));
}
