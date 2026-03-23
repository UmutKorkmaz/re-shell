import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import chalk from 'chalk';
import { ProgressSpinner } from '../utils/spinner';
import { processManager } from '../utils/error-handler';

interface ServeOptions {
  port?: string;
  host?: string;
  open?: boolean;
  spinner?: ProgressSpinner;
}

/**
 * Starts development server for one or all microfrontends
 *
 * @param name - Name of the microfrontend to serve (optional, serves all if omitted)
 * @param options - Server options
 * @version 0.1.0
 */
export async function serveMicrofrontend(name?: string, options: ServeOptions = {}): Promise<void> {
  const { spinner } = options;

  // Set default options
  const port = options.port || '3000';
  const host = options.host || 'localhost';
  const open = options.open || false;

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

    if (name) {
      // Serve a specific microfrontend
      if (spinner) {
        spinner.setText(`Validating microfrontend "${name}"...`);
      }

      const mfPath = path.resolve(process.cwd(), 'apps', name);

      if (!fs.existsSync(mfPath)) {
        if (spinner) {
          spinner.stop();
        }
        throw new Error(`Microfrontend "${name}" not found in apps directory.`);
      }

      const packageJsonPath = path.join(mfPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        if (spinner) {
          spinner.stop();
        }
        throw new Error(`package.json not found for microfrontend "${name}".`);
      }

      // Change to the microfrontend directory and serve
      process.chdir(mfPath);

      if (spinner) {
        spinner.setText(`Starting development server for "${name}"...`);
      }

      console.log(chalk.cyan(`Starting development server for microfrontend "${name}"...`));

      // Build the serve command with options
      let serveCommand = `npm run dev -- --port ${port} --host ${host}`;
      if (open) {
        serveCommand += ' --open';
      }

      try {
        if (spinner) {
          spinner.stop();
        }

        const childProcess = exec(serveCommand);

        // Handle process output
        childProcess.stdout?.on('data', (data: Buffer) => {
          console.log(data.toString());
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          console.error(data.toString());
        });

        // Handle process exit
        childProcess.on('exit', (code: number | null) => {
          if (code !== 0) {
            console.error(chalk.red(`Development server exited with code ${code}`));
          }
        });

        // Keep the process running
        console.log(chalk.green(`Development server started at http://${host}:${port}`));
        console.log(chalk.yellow('Press Ctrl+C to stop the server'));

        // Prevent the Node.js process from exiting
        process.stdin.resume();
        // Signal that this command should keep the process running
        processManager.keepRunning();
      } catch (error: any) {
        throw new Error(`Failed to start development server: ${error.message}`);
      }
    } else {
      // Serve all microfrontends using the workspace manager
      if (spinner) {
        spinner.setText('Starting development servers for all applications...');
      }

      console.log(chalk.cyan('Starting development servers for all applications...'));

      // Use the project's package manager if possible
      let devCommand = 'npm run dev';
      if (fs.existsSync('pnpm-lock.yaml')) {
        devCommand = 'pnpm run dev';
      } else if (fs.existsSync('yarn.lock')) {
        devCommand = 'yarn dev';
      }

      try {
        if (spinner) {
          spinner.stop();
        }

        const childProcess = exec(devCommand);

        // Handle process output
        childProcess.stdout?.on('data', (data: Buffer) => {
          console.log(data.toString());
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
          console.error(data.toString());
        });

        // Handle process exit
        childProcess.on('exit', (code: number | null) => {
          if (code !== 0) {
            console.error(chalk.red(`Development servers exited with code ${code}`));
          }
        });

        // Keep the process running
        console.log(chalk.green('Development servers started'));
        console.log(chalk.yellow('Press Ctrl+C to stop all servers'));

        // Prevent the Node.js process from exiting
        process.stdin.resume();
        // Signal that this command should keep the process running
        processManager.keepRunning();
      } catch (error: any) {
        throw new Error(`Failed to start development servers: ${error.message}`);
      }
    }
  } catch (error) {
    if (spinner) {
      spinner.stop();
    }
    throw error;
  }
}
