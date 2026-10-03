import { ensureFullCommandTree } from '../lazy-commands';
// Shell Completion Installation
// Install shell completion scripts for bash and zsh

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import * as os from 'os';
import type { Command } from 'commander';
import {
  COMPLETION_SHELLS,
  generateCompletionScript,
  isCompletionShell,
  type CompletionShell,
} from '../utils/completion-engine';

/**
 * Options for the shell completion installation command.
 */
export interface CompletionInstallOptions {
  shell?: 'bash' | 'zsh';
  /**
   * The root program the completion scripts are generated from. Required: the
   * command list is read from the live Commander tree (the same walker behind
   * `commands list --json`), never from a hardcoded list.
   */
  program?: Command;
}

function requireProgram(program: Command | undefined): Command {
  if (!program) {
    throw new Error(
      'Completion scripts are generated from the live command tree, but no program was provided'
    );
  }
  return program;
}

/**
 * Generate the completion script for `shell` from the live command tree.
 *
 * @param program - The root Commander program.
 * @param shell - Target shell.
 * @returns The script text.
 */
export function getCompletionScript(program: Command, shell: CompletionShell): string {
  // Command groups load lazily; completion must describe the whole tree.
  ensureFullCommandTree(program);
  return generateCompletionScript(program, shell);
}

/**
 * Print the completion script for `shell` to stdout and install nothing. stdout
 * carries only the script, so it can be redirected into a file or `source`d.
 *
 * @param options - Target shell (default bash) and the live program.
 * @returns `true` when a script was printed; `false` (with an error on stderr)
 *   for an unsupported shell.
 */
export function printCompletion(options: CompletionInstallOptions = {}): boolean {
  const { shell = 'bash' } = options;
  if (!isCompletionShell(shell)) {
    process.stderr.write(
      `Unsupported shell: ${shell}\nSupported shells: ${COMPLETION_SHELLS.join(', ')}\n`
    );
    return false;
  }
  process.stdout.write(getCompletionScript(requireProgram(options.program), shell));
  return true;
}

/**
 * Install shell completion scripts for the requested shell (bash or zsh).
 * Defaults to bash when no shell is specified. The script is generated from the
 * live command tree at install time, so it always matches the installed CLI.
 *
 * @param options - Installation options including the target shell and program.
 * @returns Resolves to `true` when the script was installed, `false` when the
 *   shell is unsupported or the install failed (the reason is printed). Callers
 *   map `false` to a non-zero exit code.
 */
export async function installCompletion(options: CompletionInstallOptions = {}): Promise<boolean> {
  const { shell = 'bash' } = options;

  console.log(chalk.cyan.bold('\nInstalling Shell Completion\n'));

  const homeDir = os.homedir();

  try {
    if (shell === 'bash') {
      const script = getCompletionScript(requireProgram(options.program), 'bash');
      await installBashCompletion(homeDir, script);
    } else if (shell === 'zsh') {
      const script = getCompletionScript(requireProgram(options.program), 'zsh');
      await installZshCompletion(homeDir, script);
    } else {
      console.log(chalk.red('Unsupported shell: ' + shell));
      console.log(chalk.gray('Supported shells: bash, zsh\n'));
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.log(chalk.red('Error installing completion: ' + (error as Error).message));
    return false;
  }
}

async function installBashCompletion(homeDir: string, script: string): Promise<void> {
  const bashrcPath = path.join(homeDir, '.bashrc');
  const sourceLine = '\n# re-shell completion\n. ~/.re-shell/completion.bash\n';

  console.log(chalk.gray('Installing bash completion...\n'));

  // Create .re-shell directory and write the generated script
  const reShellDir = path.join(homeDir, '.re-shell');
  await fs.ensureDir(reShellDir);

  const targetPath = path.join(reShellDir, 'completion.bash');
  await fs.writeFile(targetPath, script, 'utf8');
  console.log(chalk.gray('Installed: ' + targetPath));

  // Add to .bashrc if not already there
  if (await fs.pathExists(bashrcPath)) {
    const bashrc = await fs.readFile(bashrcPath, 'utf8');
    if (!bashrc.includes('.re-shell/completion.bash')) {
      await fs.appendFile(bashrcPath, sourceLine);
      console.log(chalk.gray('Added source line to: ' + bashrcPath));
    }
  } else {
    console.log(chalk.yellow('.bashrc not found'));
    console.log(chalk.gray('Add this line to your shell config:\n'));
    console.log(chalk.cyan('  . ~/.re-shell/completion.bash\n'));
  }

  console.log(chalk.green('\nBash completion installed!\n'));
  console.log(chalk.gray('Restart your shell or run:\n'));
  console.log(chalk.cyan('  source ~/.bashrc\n'));
}

async function installZshCompletion(homeDir: string, script: string): Promise<void> {
  const zshrcPath = path.join(homeDir, '.zshrc');
  const zfuncDir = path.join(homeDir, '.zfunc');

  console.log(chalk.gray('Installing zsh completion...\n'));

  // Create .zfunc directory and write the generated script
  await fs.ensureDir(zfuncDir);

  const targetPath = path.join(zfuncDir, '_re-shell');
  await fs.writeFile(targetPath, script, 'utf8');
  console.log(chalk.gray('Installed: ' + targetPath));

  // Add to .zshrc if not already there
  const fpathLine = '\n# re-shell completion\nfpath=(~/.zfunc $fpath)\nautoload -U compinit && compinit\n';

  if (await fs.pathExists(zshrcPath)) {
    const zshrc = await fs.readFile(zshrcPath, 'utf8');
    if (!zshrc.includes('.zfunc')) {
      await fs.appendFile(zshrcPath, fpathLine);
      console.log(chalk.gray('Added fpath to: ' + zshrcPath));
    }
  } else {
    console.log(chalk.yellow('.zshrc not found'));
    console.log(chalk.gray('Add these lines to your ~/.zshrc:\n'));
    console.log(chalk.cyan('  fpath=(~/.zfunc $fpath)'));
    console.log(chalk.cyan('  autoload -U compinit && compinit\n'));
  }

  console.log(chalk.green('\nZsh completion installed!\n'));
  console.log(chalk.gray('Restart your shell or run:\n'));
  console.log(chalk.cyan('  source ~/.zshrc\n'));
}
