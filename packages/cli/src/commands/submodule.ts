import chalk from 'chalk';
import prompts from 'prompts';
import {
  addSubmodule,
  removeSubmodule,
  updateSubmodules,
  getSubmoduleStatus,
  createSubmoduleDocumentation,
  isGitRepository,
  SubmoduleInfo,
} from '../utils/submodule';
import { findMonorepoRoot } from '../utils/monorepo';
import { ProgressSpinner } from '../utils/spinner';

/** Options for the `submodule add` command. */
interface SubmoduleAddOptions {
  /** Branch to track (defaults to the submodule's default branch). */
  branch?: string;
  /** Target path within the monorepo. */
  path?: string;
  /** Optional progress spinner. */
  spinner?: ProgressSpinner;
}

/** Options for the `submodule update` command. */
interface SubmoduleUpdateOptions {
  /** Restrict the update to a single submodule path. */
  path?: string;
  /** Recursively update nested submodules. */
  recursive?: boolean;
  /** Optional progress spinner. */
  spinner?: ProgressSpinner;
}

/** Options for the `submodule remove` command. */
interface SubmoduleRemoveOptions {
  /** Skip the confirmation prompt. */
  force?: boolean;
  /** Optional progress spinner. */
  spinner?: ProgressSpinner;
}

/**
 * Add a new Git submodule to the monorepo.
 *
 * @param repositoryUrl - Remote URL of the submodule repository.
 * @param options - Add options (branch, path, spinner).
 */
export async function addGitSubmodule(
  repositoryUrl: string,
  options: SubmoduleAddOptions = {}
): Promise<void> {
  const { spinner } = options;

  try {
    if (spinner) {
      spinner.setText('Checking Git repository...');
    }

    // Ensure we're in a Git repository
    if (!(await isGitRepository())) {
      throw new Error('Not in a Git repository. Initialize Git first with: git init');
    }

    if (spinner) {
      spinner.stop();
    }

    // Interactive prompts for missing options
    const responses = await prompts([
      {
        type: options.path ? null : 'text',
        name: 'path',
        message: 'Submodule path:',
        initial: repositoryUrl.split('/').pop()?.replace('.git', '') || 'submodule',
        validate: (value: string) => (value.trim() ? true : 'Path is required'),
      },
      {
        type: options.branch ? null : 'text',
        name: 'branch',
        message: 'Branch to track:',
        initial: 'main',
      },
    ]);

    const finalOptions = {
      path: options.path || responses.path,
      branch: options.branch || responses.branch || 'main',
    };

    if (spinner) {
      spinner.start();
      spinner.setText(`Adding submodule: ${repositoryUrl}`);
    }

    console.log(chalk.cyan(`Adding submodule: ${repositoryUrl}`));
    console.log(chalk.gray(`Path: ${finalOptions.path}`));
    console.log(chalk.gray(`Branch: ${finalOptions.branch}`));

    await addSubmodule(finalOptions.path, repositoryUrl, finalOptions.branch);

    if (spinner) {
      spinner.setText('Updating documentation...');
    }

    // Update documentation
    const submodules = await getSubmoduleStatus();
    const monorepoRoot = (await findMonorepoRoot()) || process.cwd();
    await createSubmoduleDocumentation(monorepoRoot, submodules);

    if (spinner) {
      spinner.succeed(chalk.green(`✓ Submodule added successfully: ${finalOptions.path}`));
    } else {
      console.log(chalk.green(`✓ Submodule added successfully: ${finalOptions.path}`));
    }

    console.log(chalk.gray('Documentation updated in docs/SUBMODULES.md'));
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Error adding submodule'));
    }
    console.error(chalk.red('Error adding submodule:'), error);
    throw error;
  }
}

/**
 * Remove a Git submodule from the monorepo.
 *
 * @param submodulePath - Path or name of the submodule to remove.
 * @param options - Remove options (force, spinner).
 */
export async function removeGitSubmodule(
  submodulePath: string,
  options: SubmoduleRemoveOptions = {}
): Promise<void> {
  const { spinner } = options;

  try {
    if (spinner) {
      spinner.setText('Checking Git repository...');
    }

    // Ensure we're in a Git repository
    if (!(await isGitRepository())) {
      throw new Error('Not in a Git repository.');
    }

    if (spinner) {
      spinner.setText('Loading submodule information...');
    }

    // Get current submodules to validate path
    const submodules = await getSubmoduleStatus();
    const submodule = submodules.find(
      sub => sub.path === submodulePath || sub.name === submodulePath
    );

    if (!submodule) {
      throw new Error(`Submodule not found: ${submodulePath}`);
    }

    if (spinner) {
      spinner.stop();
    }

    // Confirmation prompt unless force option is used
    if (!options.force) {
      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: `Are you sure you want to remove submodule "${submodule.path}"?`,
        initial: false,
      });

      if (!confirm) {
        console.log(chalk.yellow('Operation cancelled.'));
        return;
      }
    }

    if (spinner) {
      spinner.start();
      spinner.setText(`Removing submodule: ${submodule.path}`);
    }

    console.log(chalk.cyan(`Removing submodule: ${submodule.path}`));

    await removeSubmodule(submodule.path);

    if (spinner) {
      spinner.setText('Updating documentation...');
    }

    // Update documentation
    const updatedSubmodules = await getSubmoduleStatus();
    const monorepoRoot = (await findMonorepoRoot()) || process.cwd();
    await createSubmoduleDocumentation(monorepoRoot, updatedSubmodules);

    if (spinner) {
      spinner.succeed(chalk.green(`✓ Submodule removed successfully: ${submodule.path}`));
    } else {
      console.log(chalk.green(`✓ Submodule removed successfully: ${submodule.path}`));
    }

    console.log(chalk.gray('Documentation updated in docs/SUBMODULES.md'));
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Error removing submodule'));
    }
    console.error(chalk.red('Error removing submodule:'), error);
    throw error;
  }
}

/**
 * Update one or all Git submodules in the monorepo.
 *
 * @param options - Update options (path, recursive, spinner).
 */
export async function updateGitSubmodules(options: SubmoduleUpdateOptions = {}): Promise<void> {
  const { spinner } = options;

  try {
    if (spinner) {
      spinner.setText('Checking Git repository...');
    }

    // Ensure we're in a Git repository
    if (!(await isGitRepository())) {
      throw new Error('Not in a Git repository.');
    }

    if (options.path) {
      if (spinner) {
        spinner.setText(`Updating submodule: ${options.path}`);
      }

      console.log(chalk.cyan(`Updating submodule: ${options.path}`));
      await updateSubmodules(options.path);

      if (spinner) {
        spinner.succeed(chalk.green(`✓ Submodule updated: ${options.path}`));
      } else {
        console.log(chalk.green(`✓ Submodule updated: ${options.path}`));
      }
    } else {
      if (spinner) {
        spinner.setText('Updating all submodules...');
      }

      console.log(chalk.cyan('Updating all submodules...'));
      await updateSubmodules();

      if (spinner) {
        spinner.succeed(chalk.green('✓ All submodules updated'));
      } else {
        console.log(chalk.green('✓ All submodules updated'));
      }
    }

    if (spinner) {
      spinner.setText('Updating documentation...');
    }

    // Update documentation
    const submodules = await getSubmoduleStatus();
    const monorepoRoot = (await findMonorepoRoot()) || process.cwd();
    await createSubmoduleDocumentation(monorepoRoot, submodules);
  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('Error updating submodules'));
    }
    console.error(chalk.red('Error updating submodules:'), error);
    throw error;
  }
}

/**
 * Display the current status of all Git submodules.
 */
export async function showSubmoduleStatus(): Promise<void> {
  try {
    // Ensure we're in a Git repository with timeout
    let isGitRepo: boolean;
    try {
      isGitRepo = await Promise.race([
        isGitRepository(),
        new Promise<boolean>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout checking Git repository')), 3000)
        ),
      ]);
    } catch {
      isGitRepo = false;
    }

    if (!isGitRepo) {
      console.error(chalk.red('Error: Not in a git repository. Please run this command from within a git project.'));
      process.exit(1);
    }

    const submodules = await Promise.race([
      getSubmoduleStatus(),
      new Promise<SubmoduleInfo[]>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout getting submodule status')), 5000)
      ),
    ]);

    if (submodules.length === 0) {
      console.log(chalk.yellow('No submodules found.'));
      return;
    }

    console.log(chalk.cyan('\n📁 Submodule Status\n'));

    submodules.forEach((submodule: SubmoduleInfo) => {
      const statusColor = getStatusColor(submodule.status);
      const statusIcon = getStatusIcon(submodule.status);

      console.log(`${statusIcon} ${chalk.bold(submodule.name)} ${statusColor(submodule.status)}`);
      console.log(`   ${chalk.gray('Path:')} ${submodule.path}`);
      console.log(`   ${chalk.gray('URL:')} ${submodule.url}`);
      console.log(`   ${chalk.gray('Branch:')} ${submodule.branch}`);
      console.log(`   ${chalk.gray('Commit:')} ${submodule.commit}`);
      console.log();
    });

    console.log(chalk.gray(`Total: ${submodules.length} submodules`));

    // Show summary by status
    const statusCounts = submodules.reduce((acc: Record<string, number>, sub: SubmoduleInfo) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if (Object.keys(statusCounts).length > 1) {
      console.log(chalk.gray('\nStatus Summary:'));
      Object.entries(statusCounts).forEach(([status, count]) => {
        const color = getStatusColor(status as SubmoduleInfo['status']);
        console.log(`  ${color(status)}: ${count}`);
      });
    }
  } catch (error) {
    console.error(chalk.red('Error getting submodule status:'), error);
    process.exit(1);
  }
}

/**
 * Initialize and update submodules (for fresh clones).
 */
export async function initSubmodules(): Promise<void> {
  try {
    // Ensure we're in a Git repository
    if (!(await isGitRepository())) {
      throw new Error('Not in a Git repository.');
    }

    console.log(chalk.cyan('Initializing submodules...'));
    await updateSubmodules(); // This will init and update
    console.log(chalk.green('✓ Submodules initialized'));
  } catch (error) {
    console.error(chalk.red('Error initializing submodules:'), error);
    throw error;
  }
}

/**
 * Interactive submodule management menu (status, add, update, remove, init).
 */
export async function manageSubmodules(): Promise<void> {
  try {
    // Ensure we're in a Git repository
    if (!(await isGitRepository())) {
      throw new Error('Not in a Git repository.');
    }

    const { action } = await prompts({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: 'Show status', value: 'status' },
        { title: 'Add submodule', value: 'add' },
        { title: 'Update submodules', value: 'update' },
        { title: 'Remove submodule', value: 'remove' },
        { title: 'Initialize submodules', value: 'init' },
      ],
    });

    switch (action) {
      case 'status':
        await showSubmoduleStatus();
        break;

      case 'add': {
        const { url } = await prompts({
          type: 'text',
          name: 'url',
          message: 'Repository URL:',
          validate: (value: string) => (value.trim() ? true : 'URL is required'),
        });
        await addGitSubmodule(url);
        break;
      }

      case 'update': {
        const submodules = await getSubmoduleStatus();
        if (submodules.length === 0) {
          console.log(chalk.yellow('No submodules to update.'));
          return;
        }

        const { updateTarget } = await prompts({
          type: 'select',
          name: 'updateTarget',
          message: 'What to update?',
          choices: [
            { title: 'All submodules', value: 'all' },
            ...submodules.map((sub: SubmoduleInfo) => ({ title: sub.path, value: sub.path })),
          ],
        });

        if (updateTarget === 'all') {
          await updateGitSubmodules();
        } else {
          await updateGitSubmodules({ path: updateTarget });
        }
        break;
      }

      case 'remove': {
        const currentSubmodules = await getSubmoduleStatus();
        if (currentSubmodules.length === 0) {
          console.log(chalk.yellow('No submodules to remove.'));
          return;
        }

        const { removeTarget } = await prompts({
          type: 'select',
          name: 'removeTarget',
          message: 'Which submodule to remove?',
          choices: currentSubmodules.map((sub: SubmoduleInfo) => ({
            title: sub.path,
            value: sub.path,
          })),
        });

        await removeGitSubmodule(removeTarget);
        break;
      }

      case 'init': {
        await initSubmodules();
        break;
      }
    }
  } catch (error) {
    console.error(chalk.red('Error managing submodules:'), error);
    throw error;
  }
}

/**
 * Return a chalk colour function for the given submodule status.
 *
 * @param status - Submodule status string.
 * @returns A chalk colour function.
 */
function getStatusColor(status: SubmoduleInfo['status']): (text: string) => string {
  switch (status) {
    case 'clean':
      return chalk.green;
    case 'modified':
      return chalk.yellow;
    case 'untracked':
      return chalk.red;
    case 'ahead':
      return chalk.blue;
    case 'behind':
      return chalk.magenta;
    default:
      return chalk.gray;
  }
}

/**
 * Return a coloured icon for the given submodule status.
 *
 * @param status - Submodule status string.
 * @returns A coloured icon string.
 */
function getStatusIcon(status: SubmoduleInfo['status']): string {
  switch (status) {
    case 'clean':
      return chalk.green('✓');
    case 'modified':
      return chalk.yellow('●');
    case 'untracked':
      return chalk.red('✗');
    case 'ahead':
      return chalk.blue('↑');
    case 'behind':
      return chalk.magenta('↓');
    default:
      return chalk.gray('?');
  }
}
