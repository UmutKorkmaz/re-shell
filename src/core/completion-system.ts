import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { CommandDefinition } from './command-registry';

export interface CompletionConfig {
  enableFileCompletion: boolean;
  enableDirectoryCompletion: boolean;
  enableCommandCompletion: boolean;
  enableOptionCompletion: boolean;
  enableValueCompletion: boolean;
  customCompletions: Record<string, CompletionProvider>;
}

export interface CompletionProvider {
  (current: string, previous: string[], context: CompletionContext): Promise<string[]> | string[];
}

export interface CompletionContext {
  command: string;
  subcommand?: string;
  option?: string;
  cwd: string;
  env: Record<string, string>;
}

export interface ShellCompletionScript {
  shell: 'bash' | 'zsh' | 'fish' | 'powershell';
  script: string;
  installPath: string;
  instructions: string;
}

export class CompletionSystem {
  private config: CompletionConfig;
  private commands: Map<string, CommandDefinition> = new Map();
  private customProviders: Map<string, CompletionProvider> = new Map();

  constructor(config: Partial<CompletionConfig> = {}) {
    this.config = {
      enableFileCompletion: true,
      enableDirectoryCompletion: true,
      enableCommandCompletion: true,
      enableOptionCompletion: true,
      enableValueCompletion: true,
      customCompletions: {},
      ...config
    };

    this.setupBuiltinProviders();
  }

  private setupBuiltinProviders(): void {
    // Framework completion
    this.customProviders.set('framework', () => [
      'react', 'vue', 'svelte', 'angular', 'vanilla'
    ]);

    // Package manager completion
    this.customProviders.set('packageManager', () => [
      'npm', 'yarn', 'pnpm', 'bun'
    ]);

    // Template completion
    this.customProviders.set('template', () => [
      'basic', 'ecommerce', 'dashboard', 'saas', 'blog'
    ]);

    // Log level completion
    this.customProviders.set('logLevel', () => [
      'debug', 'info', 'warn', 'error', 'silent'
    ]);

    // Boolean completion
    this.customProviders.set('boolean', () => [
      'true', 'false'
    ]);

    // Environment completion
    this.customProviders.set('environment', () => [
      'development', 'staging', 'production', 'test'
    ]);

    // Port completion (common ports)
    this.customProviders.set('port', () => [
      '3000', '3001', '3002', '4000', '5000', '8000', '8080', '9000'
    ]);
  }

  registerCommand(command: CommandDefinition): void {
    this.commands.set(command.name, command);
    
    // Register aliases
    if (command.alias) {
      for (const alias of command.alias) {
        this.commands.set(alias, command);
      }
    }
  }

  unregisterCommand(name: string): void {
    const command = this.commands.get(name);
    if (command) {
      this.commands.delete(name);
      
      // Remove aliases
      if (command.alias) {
        for (const alias of command.alias) {
          this.commands.delete(alias);
        }
      }
    }
  }

  registerProvider(name: string, provider: CompletionProvider): void {
    this.customProviders.set(name, provider);
  }

  async complete(
    args: string[],
    current: string,
    context: CompletionContext
  ): Promise<string[]> {
    const completions: string[] = [];

    // Complete command names
    if (args.length === 0 || (args.length === 1 && !current.startsWith('-'))) {
      if (this.config.enableCommandCompletion) {
        const commandCompletions = this.completeCommands(current);
        completions.push(...commandCompletions);
      }
      return completions;
    }

    const commandName = args[0];
    const command = this.commands.get(commandName);
    
    if (!command) {
      return completions;
    }

    // Complete options
    if (current.startsWith('-')) {
      if (this.config.enableOptionCompletion) {
        const optionCompletions = this.completeOptions(command, current);
        completions.push(...optionCompletions);
      }
      return completions;
    }

    // Complete option values
    const lastArg = args[args.length - 1];
    if (lastArg && lastArg.startsWith('-')) {
      if (this.config.enableValueCompletion) {
        const valueCompletions = await this.completeOptionValues(
          command, lastArg, current, context
        );
        completions.push(...valueCompletions);
      }
      return completions;
    }

    // Complete arguments
    const argumentCompletions = await this.completeArguments(
      command, args.slice(1), current, context
    );
    completions.push(...argumentCompletions);

    // Complete files and directories
    if (this.config.enableFileCompletion || this.config.enableDirectoryCompletion) {
      const pathCompletions = await this.completeFiles(current, context);
      completions.push(...pathCompletions);
    }

    return Array.from(new Set(completions)).sort();
  }

  private completeCommands(current: string): string[] {
    const commandNames = Array.from(this.commands.keys());
    return commandNames.filter(name => 
      name.startsWith(current) && 
      !this.commands.get(name)?.hidden
    );
  }

  private completeOptions(command: CommandDefinition, current: string): string[] {
    if (!command.options) return [];

    const completions: string[] = [];
    
    for (const option of command.options) {
      const flags = option.flag.split(',').map(f => f.trim());
      
      for (const flag of flags) {
        if (flag.startsWith(current)) {
          completions.push(flag);
        }
      }
    }

    return completions;
  }

  private async completeOptionValues(
    command: CommandDefinition,
    option: string,
    current: string,
    context: CompletionContext
  ): Promise<string[]> {
    if (!command.options) return [];

    // Find the option definition
    const optionDef = command.options.find(opt => {
      const flags = opt.flag.split(',').map(f => f.trim());
      return flags.includes(option);
    });

    if (!optionDef) return [];

    // Use choices if available
    if (optionDef.choices) {
      return optionDef.choices
        .filter(choice => choice.toString().startsWith(current))
        .map(choice => choice.toString());
    }

    // Use custom completion provider if available
    const providerName = this.getProviderForOption(option);
    if (providerName && this.customProviders.has(providerName)) {
      const provider = this.customProviders.get(providerName)!;
      const results = await provider(current, [option], context);
      return results.filter(result => result.startsWith(current));
    }

    return [];
  }

  private getProviderForOption(option: string): string | null {
    const providerMap: Record<string, string> = {
      '--framework': 'framework',
      '-f': 'framework',
      '--package-manager': 'packageManager',
      '--pm': 'packageManager',
      '--template': 'template',
      '-t': 'template',
      '--log-level': 'logLevel',
      '--yes': 'boolean',
      '--no': 'boolean',
      '--typescript': 'boolean',
      '--ts': 'boolean',
      '--port': 'port',
      '-p': 'port',
      '--env': 'environment',
      '--environment': 'environment'
    };

    return providerMap[option] || null;
  }

  private async completeArguments(
    command: CommandDefinition,
    args: string[],
    current: string,
    context: CompletionContext
  ): Promise<string[]> {
    if (!command.arguments) return [];

    const argIndex = args.length;
    const argumentDef = command.arguments[argIndex];
    
    if (!argumentDef) return [];

    // Use custom completion if available
    const providerName = this.getProviderForArgument(command.name, argumentDef.name);
    if (providerName && this.customProviders.has(providerName)) {
      const provider = this.customProviders.get(providerName)!;
      return await provider(current, args, context);
    }

    return [];
  }

  private getProviderForArgument(command: string, argument: string): string | null {
    const providerMap: Record<string, Record<string, string>> = {
      init: {
        name: 'projectName'
      },
      add: {
        name: 'microfrontendName'
      }
    };

    return providerMap[command]?.[argument] || null;
  }

  private async completeFiles(
    current: string,
    context: CompletionContext
  ): Promise<string[]> {
    try {
      const isDirectory = current.endsWith('/');
      const basePath = isDirectory ? current : path.dirname(current);
      const filename = isDirectory ? '' : path.basename(current);
      
      const fullPath = path.resolve(context.cwd, basePath);
      
      if (!await fs.pathExists(fullPath)) {
        return [];
      }

      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const completions: string[] = [];

      for (const entry of entries) {
        if (!entry.name.startsWith(filename)) continue;
        
        if (entry.isDirectory() && this.config.enableDirectoryCompletion) {
          const dirPath = path.join(basePath, entry.name);
          completions.push(dirPath + '/');
        } else if (entry.isFile() && this.config.enableFileCompletion) {
          const filePath = path.join(basePath, entry.name);
          completions.push(filePath);
        }
      }

      return completions;
    } catch {
      return [];
    }
  }

  generateShellCompletions(programName: string): ShellCompletionScript[] {
    return [
      this.generateBashCompletion(programName),
      this.generateZshCompletion(programName),
      this.generateFishCompletion(programName),
      this.generatePowerShellCompletion(programName)
    ];
  }

  private generateBashCompletion(programName: string): ShellCompletionScript {
    const script = `#!/bin/bash

_${programName}_completions() {
    local cur prev words cword
    _init_completion || return

    # Call the completion endpoint
    local completions
    completions=$(${programName} __complete "\${COMP_WORDS[@]}" "\${COMP_CWORD}")
    
    if [[ $? -eq 0 ]]; then
        COMPREPLY=($(compgen -W "\${completions}" -- "\${cur}"))
    fi
}

complete -F _${programName}_completions ${programName}`;

    return {
      shell: 'bash',
      script,
      installPath: '/etc/bash_completion.d/' + programName,
      instructions: `To install bash completion:
1. Save the script to /etc/bash_completion.d/${programName}
2. Or add to your ~/.bashrc:
   source <(${programName} completion bash)
3. Restart your shell or run: source ~/.bashrc`
    };
  }

  private generateZshCompletion(programName: string): ShellCompletionScript {
    const script = `#compdef ${programName}

_${programName}() {
    local context state line
    local -a completions

    # Call the completion endpoint
    completions=($(${programName} __complete "\${words[@]}" "\${CURRENT}"))
    
    if [[ $? -eq 0 ]]; then
        _describe 'commands' completions
    fi
}

_${programName} "$@"`;

    return {
      shell: 'zsh',
      script,
      installPath: `${os.homedir()}/.zsh/completions/_${programName}`,
      instructions: `To install zsh completion:
1. Create directory: mkdir -p ~/.zsh/completions
2. Save the script to ~/.zsh/completions/_${programName}
3. Add to your ~/.zshrc:
   fpath=(~/.zsh/completions $fpath)
   autoload -U compinit && compinit
4. Restart your shell`
    };
  }

  private generateFishCompletion(programName: string): ShellCompletionScript {
    const script = `function __${programName}_complete
    set -l completions (${programName} __complete (commandline -cp) (commandline -t))
    if test $status -eq 0
        printf '%s\\n' $completions
    end
end

complete -c ${programName} -f -a "(__${programName}_complete)"`;

    return {
      shell: 'fish',
      script,
      installPath: `${os.homedir()}/.config/fish/completions/${programName}.fish`,
      instructions: `To install fish completion:
1. Create directory: mkdir -p ~/.config/fish/completions
2. Save the script to ~/.config/fish/completions/${programName}.fish
3. Restart your shell`
    };
  }

  private generatePowerShellCompletion(programName: string): ShellCompletionScript {
    const script = `Register-ArgumentCompleter -Native -CommandName ${programName} -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    
    $completions = & ${programName} __complete $commandAst.CommandElements
    
    $completions | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
    }
}`;

    return {
      shell: 'powershell',
      script,
      installPath: '$PROFILE',
      instructions: `To install PowerShell completion:
1. Add the script to your PowerShell profile
2. Or run: ${programName} completion powershell | Out-String | Invoke-Expression
3. Restart PowerShell`
    };
  }

  async installCompletion(
    shell: 'bash' | 'zsh' | 'fish' | 'powershell',
    programName: string
  ): Promise<void> {
    const completions = this.generateShellCompletions(programName);
    const completion = completions.find(c => c.shell === shell);
    
    if (!completion) {
      throw new Error(`Unsupported shell: ${shell}`);
    }

    try {
      const installDir = path.dirname(completion.installPath);
      await fs.ensureDir(installDir);
      await fs.writeFile(completion.installPath, completion.script);
      
      console.log(`✓ Completion installed to ${completion.installPath}`);
      console.log('\nNext steps:');
      console.log(completion.instructions);
    } catch (error: any) {
      throw new Error(`Failed to install completion: ${error.message}`);
    }
  }

  async handleCompletionRequest(args: string[]): Promise<void> {
    // Parse completion request
    const words = args.slice(0, -1); // All words except the current one
    const current = args[args.length - 1] || '';
    
    const context: CompletionContext = {
      command: words[0] || '',
      cwd: process.cwd(),
      env: process.env as Record<string, string>
    };

    try {
      const completions = await this.complete(words.slice(1), current, context);
      console.log(completions.join('\n'));
    } catch (error) {
      // Silent fail for completion errors
      process.exit(1);
    }
  }
}

// Global completion system
let globalCompletion: CompletionSystem | null = null;

export function createCompletionSystem(config?: Partial<CompletionConfig>): CompletionSystem {
  return new CompletionSystem(config);
}

export function getGlobalCompletion(): CompletionSystem {
  if (!globalCompletion) {
    globalCompletion = new CompletionSystem();
  }
  return globalCompletion;
}

export function setGlobalCompletion(completion: CompletionSystem): void {
  globalCompletion = completion;
}