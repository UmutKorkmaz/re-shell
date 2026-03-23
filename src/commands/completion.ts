// Shell Completion Installation
// Install shell completion scripts for bash and zsh

import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import * as os from 'os';

export interface CompletionInstallOptions {
  shell?: 'bash' | 'zsh';
}

const RE_SHELL_COMMANDS = [
  'add', 'alert-management', 'analytics', 'analyze', 'api-gateway', 'api-versioning',
  'auth', 'backend', 'bottleneck', 'build', 'cache', 'cdn', 'ci', 'completion',
  'compression', 'contract', 'create', 'db', 'deploy', 'detect', 'dev', 'devenv',
  'distribute', 'doctor', 'error-handling', 'feature', 'generate', 'health',
  'hotreload', 'i18n', 'ide', 'init', 'integration', 'lint', 'list', 'mesh',
  'microservice', 'migrate', 'mock', 'monitor', 'otel', 'perf', 'plugin',
  'pwa', 'realtime', 'remove', 'resource', 'rollback', 'run', 'scaffold',
  'secrets', 'service', 'setup', 'share', 'state', 'sync', 'test', 'update',
  'version', 'workspace',
];

function generateBashCompletionScript(): string {
  const cmds = RE_SHELL_COMMANDS.join(' ');
  return `# re-shell bash completion
_re_shell_completions() {
  local cur prev words cword
  _init_completion 2>/dev/null || {
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
  }
  local commands="${cmds}"
  if [[ \${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") ) # eslint-disable-line no-useless-escape
  fi
  return 0
}
complete -F _re_shell_completions re-shell
`;
}

function generateZshCompletionScript(): string {
  const cmds = RE_SHELL_COMMANDS.map(c => `    '${c}'`).join('\n');
  return `#compdef re-shell
_re_shell() {
  local commands
  commands=(
${cmds}
  )
  if (( CURRENT == 2 )); then
    _describe 'command' commands
  fi
}
compdef _re_shell re-shell
`;
}

export async function installCompletion(options: CompletionInstallOptions = {}): Promise<void> {
  const { shell = 'bash' } = options;

  console.log(chalk.cyan.bold('\nInstalling Shell Completion\n'));

  const homeDir = os.homedir();

  try {
    if (shell === 'bash') {
      await installBashCompletion(homeDir);
    } else if (shell === 'zsh') {
      await installZshCompletion(homeDir);
    } else {
      console.log(chalk.red('Unsupported shell: ' + shell));
      console.log(chalk.gray('Supported shells: bash, zsh\n'));
      return;
    }
  } catch (error: any) {
    console.log(chalk.red('Error installing completion: ' + error.message));
  }
}

async function installBashCompletion(homeDir: string): Promise<void> {
  const bashrcPath = path.join(homeDir, '.bashrc');
  const sourceLine = '\n# re-shell completion\n. ~/.re-shell/completion.bash\n';

  console.log(chalk.gray('Installing bash completion...\n'));

  // Create .re-shell directory and write script inline
  const reShellDir = path.join(homeDir, '.re-shell');
  await fs.ensureDir(reShellDir);

  const targetPath = path.join(reShellDir, 'completion.bash');
  await fs.writeFile(targetPath, generateBashCompletionScript(), 'utf8');
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

async function installZshCompletion(homeDir: string): Promise<void> {
  const zshrcPath = path.join(homeDir, '.zshrc');
  const zfuncDir = path.join(homeDir, '.zfunc');

  console.log(chalk.gray('Installing zsh completion...\n'));

  // Create .zfunc directory and write script inline
  await fs.ensureDir(zfuncDir);

  const targetPath = path.join(zfuncDir, '_re-shell');
  await fs.writeFile(targetPath, generateZshCompletionScript(), 'utf8');
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
