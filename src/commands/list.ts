import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import { ProgressSpinner } from '../utils/spinner';

interface ListOptions {
  json?: boolean;
  spinner?: ProgressSpinner;
}

interface MicrofrontendInfo {
  name: string;
  path: string;
  route?: string;
  team?: string;
  version?: string;
}

/**
 * Lists all microfrontends in the current Re-Shell project
 *
 * @param options - Options for listing microfrontends
 * @version 0.1.0
 */
export async function listMicrofrontends(options: ListOptions = {}): Promise<void> {
  const { spinner } = options;

  try {
    // Validate we're in a Re-Shell project
    if (spinner) {
      spinner.setText('Validating Re-Shell project...');
    }

    // Determine if we're in a Re-Shell project
    const isInReshellProject =
      fs.existsSync('package.json') && (fs.existsSync('apps') || fs.existsSync('packages'));

    if (!isInReshellProject) {
      if (spinner) {
        spinner.stop();
      }
      throw new Error(
        'Not in a Re-Shell project. Please run this command from the root of a Re-Shell project.'
      );
    }

    if (spinner) {
      spinner.setText('Scanning for microfrontends...');
    }

    // Check for apps directory
    const appsDir = path.resolve(process.cwd(), 'apps');
    if (!fs.existsSync(appsDir)) {
      if (spinner) {
        spinner.stop();
      }
      throw new Error('Apps directory not found. Is this a valid Re-Shell project?');
    }

    // Get all directories in the apps folder
    const appDirs = fs
      .readdirSync(appsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .filter(dirent => dirent.name !== 'shell') // Exclude shell application
      .map(dirent => dirent.name);

    if (appDirs.length === 0) {
      if (spinner) {
        spinner.stop();
      }

      const message = 'No microfrontends found in this project.';
      if (options.json) {
        console.log(JSON.stringify({ microfrontends: [] }));
      } else {
        console.log(chalk.yellow(message));
      }
      return;
    }

    if (spinner) {
      spinner.setText('Loading microfrontend information...');
    }

    // Collect information about each microfrontend
    const microfrontends: MicrofrontendInfo[] = [];

    for (const appName of appDirs) {
      const appPath = path.join(appsDir, appName);
      const packageJsonPath = path.join(appPath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          const info: MicrofrontendInfo = {
            name: appName,
            path: appPath,
            version: packageJson.version,
            team: packageJson.author,
            route: packageJson.reshell?.route || `/${appName}`,
          };
          microfrontends.push(info);
        } catch (error) {
          console.error(`Error reading package.json for ${appName}:`, error);
        }
      } else {
        // Include even without package.json
        microfrontends.push({
          name: appName,
          path: appPath,
        });
      }
    }

    if (spinner) {
      spinner.stop();
    }

    // Output the results
    if (options.json) {
      console.log(JSON.stringify({ microfrontends }, null, 2));
    } else {
      console.log(chalk.cyan(`Found ${microfrontends.length} microfrontends:`));

      microfrontends.forEach(mf => {
        console.log(chalk.green(`\n- ${mf.name}`));
        if (mf.version) console.log(`  Version: ${mf.version}`);
        if (mf.team) console.log(`  Team: ${mf.team}`);
        if (mf.route) console.log(`  Route: ${mf.route}`);
      });
    }
  } catch (error) {
    if (spinner) {
      spinner.stop();
    }
    throw error;
  }
}
