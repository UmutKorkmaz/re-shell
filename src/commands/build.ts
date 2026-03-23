import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { ProgressSpinner, flushOutput } from '../utils/spinner';

const execAsync = promisify(exec);

interface BuildOptions {
  production?: boolean;
  analyze?: boolean;
  spinner?: ProgressSpinner;
}

/**
 * Builds one or all microfrontends in the project
 *
 * @param name - Name of the microfrontend to build (optional, builds all if omitted)
 * @param options - Build options
 * @version 0.1.0
 */
export async function buildMicrofrontend(name?: string, options: BuildOptions = {}): Promise<void> {
  const { spinner } = options;

  try {
    // Validate we're in a Re-Shell project
    if (spinner) {
      spinner.setText('Validating Re-Shell project...');
    }

    const isInReshellProject =
      fs.existsSync('package.json') && (fs.existsSync('apps') || fs.existsSync('packages'));

    if (!isInReshellProject) {
      if (spinner) {
        spinner.stop();
        flushOutput();
      }
      throw new Error(
        'Not in a Re-Shell project. Please run this command from the root of a Re-Shell project.'
      );
    }

    // Build env variables
    const env = {
      ...process.env,
      NODE_ENV: options.production ? 'production' : 'development',
    };

    if (name) {
      // Build a specific microfrontend
      if (spinner) {
        spinner.setText(`Validating microfrontend "${name}"...`);
      }

      const mfPath = path.resolve(process.cwd(), 'apps', name);

      if (!fs.existsSync(mfPath)) {
        if (spinner) {
          spinner.stop();
          flushOutput();
        }
        throw new Error(`Microfrontend "${name}" not found in apps directory.`);
      }

      const packageJsonPath = path.join(mfPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        if (spinner) {
          spinner.stop();
          flushOutput();
        }
        throw new Error(`package.json not found for microfrontend "${name}".`);
      }

      // Determine build command based on package.json
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      if (!packageJson.scripts?.build) {
        throw new Error(`No build script found in package.json for microfrontend "${name}".`);
      }
      let buildCommand = 'npm run build';

      if (fs.existsSync(path.join(mfPath, 'pnpm-lock.yaml'))) {
        buildCommand = 'pnpm build';
      } else if (fs.existsSync(path.join(mfPath, 'yarn.lock'))) {
        buildCommand = 'yarn build';
      }

      // Optionally add bundle analysis
      if (options.analyze) {
        buildCommand += ' -- --analyze';
      }

      if (spinner) {
        spinner.setText(`Building microfrontend "${name}"...`);
      } else {
        console.log(chalk.cyan(`Building microfrontend "${name}"...`));
      }

      const originalCwd = process.cwd();
      process.chdir(mfPath);

      try {
        const { stdout, stderr } = await execAsync(buildCommand, { env });

        if (spinner) {
          spinner.stop();
          flushOutput();
        }

        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log(chalk.green(`✓ Successfully built microfrontend "${name}"`));
      } catch (error: any) {
        if (spinner) {
          spinner.stop();
          flushOutput();
        }
        throw new Error(`Failed to build microfrontend "${name}": ${error.message}`);
      } finally {
        process.chdir(originalCwd);
      }
    } else {
      // Build all microfrontends
      if (spinner) {
        spinner.setText('Scanning for microfrontends...');
      }

      const appsDir = path.resolve(process.cwd(), 'apps');
      if (!fs.existsSync(appsDir)) {
        if (spinner) {
          spinner.stop();
          flushOutput();
        }
        throw new Error('Apps directory not found. Is this a valid Re-Shell project?');
      }

      // Get all directories in the apps folder
      const appDirs = fs
        .readdirSync(appsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(dirName => {
          const packageJsonPath = path.join(appsDir, dirName, 'package.json');
          return fs.existsSync(packageJsonPath);
        });

      if (appDirs.length === 0) {
        if (spinner) {
          spinner.stop();
          flushOutput();
        }
        console.log(chalk.yellow('No microfrontends found to build.'));
        return;
      }

      if (spinner) {
        spinner.setText(
          `Building ${appDirs.length} microfrontend${appDirs.length > 1 ? 's' : ''}...`
        );
      } else {
        console.log(
          chalk.cyan(`Building ${appDirs.length} microfrontend${appDirs.length > 1 ? 's' : ''}...`)
        );
      }

      // Use the project's package manager
      let buildCommand = 'npm run build';
      if (fs.existsSync('pnpm-lock.yaml')) {
        buildCommand = 'pnpm run build';
      } else if (fs.existsSync('yarn.lock')) {
        buildCommand = 'yarn build';
      }

      try {
        const { stdout, stderr } = await execAsync(buildCommand, { env });

        if (spinner) {
          spinner.stop();
          flushOutput();
        }

        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        console.log(chalk.green(`✓ Successfully built all microfrontends`));
      } catch (error: any) {
        if (spinner) {
          spinner.stop();
          flushOutput();
        }
        throw new Error(`Failed to build microfrontends: ${error.message}`);
      }
    }
  } catch (error) {
    if (spinner) {
      spinner.stop();
      flushOutput();
    }
    throw error;
  }
}
