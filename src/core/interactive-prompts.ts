import prompts from 'prompts';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface PromptChoice {
  title: string;
  value: any;
  description?: string;
  disabled?: boolean | string;
}

export interface PromptValidator {
  (value: any): boolean | string | Promise<boolean | string>;
}

export interface PromptTransformer {
  (value: any): any;
}

export interface PromptSuggestion {
  title: string;
  value: string;
  description?: string;
}

export interface PromptConfig {
  type: 'text' | 'password' | 'confirm' | 'number' | 'select' | 'multiselect' | 'autocomplete' | 'list';
  name: string;
  message: string;
  initial?: any;
  choices?: PromptChoice[];
  validate?: PromptValidator;
  format?: PromptTransformer;
  min?: number;
  max?: number;
  separator?: string;
  suggest?: (input: string) => Promise<PromptSuggestion[]> | PromptSuggestion[];
  limit?: number;
  instructions?: boolean;
  hint?: string;
  warn?: string;
  onCancel?: () => void;
}

export interface EnhancedPromptOptions {
  nonInteractive?: boolean;
  defaults?: Record<string, any>;
  skipValidation?: boolean;
  theme?: PromptTheme;
  timeout?: number;
  saveResponses?: boolean;
  responseFile?: string;
}

export interface PromptTheme {
  prefix: string;
  suffix: string;
  separator: string;
  errorPrefix: string;
  successPrefix: string;
  warningPrefix: string;
  infoPrefix: string;
}

export interface PromptHistory {
  timestamp: Date;
  prompts: Array<{
    name: string;
    value: any;
    duration: number;
  }>;
}

export class InteractivePrompter {
  private theme: PromptTheme;
  private history: PromptHistory[] = [];
  private responseCache: Map<string, any> = new Map();
  private suggestions: Map<string, PromptSuggestion[]> = new Map();

  constructor(options: EnhancedPromptOptions = {}) {
    this.theme = options.theme || this.getDefaultTheme();
    
    // Load suggestions
    this.loadSuggestions();
    
    // Override prompts for theming
    this.setupPromptTheme();
  }

  private getDefaultTheme(): PromptTheme {
    return {
      prefix: chalk.cyan('?'),
      suffix: chalk.gray(':'),
      separator: chalk.gray('›'),
      errorPrefix: chalk.red('✖'),
      successPrefix: chalk.green('✓'),
      warningPrefix: chalk.yellow('⚠'),
      infoPrefix: chalk.blue('ℹ')
    };
  }

  private setupPromptTheme(): void {
    prompts.override({
      onCancel: () => {
        console.log(chalk.red('\n✖ Operation cancelled'));
        process.exit(1);
      }
    });
  }

  private loadSuggestions(): void {
    // Load framework suggestions
    this.suggestions.set('framework', [
      { title: 'React', value: 'react', description: 'Popular library for building user interfaces' },
      { title: 'Vue', value: 'vue', description: 'Progressive framework for building UIs' },
      { title: 'Svelte', value: 'svelte', description: 'Compile-time optimized framework' },
      { title: 'Angular', value: 'angular', description: 'Platform for building mobile and desktop apps' },
      { title: 'Vanilla', value: 'vanilla', description: 'Plain JavaScript without frameworks' }
    ]);

    // Load package manager suggestions
    this.suggestions.set('packageManager', [
      { title: 'pnpm', value: 'pnpm', description: 'Fast, disk space efficient package manager' },
      { title: 'npm', value: 'npm', description: 'Default Node.js package manager' },
      { title: 'yarn', value: 'yarn', description: 'Fast, reliable, and secure dependency management' },
      { title: 'bun', value: 'bun', description: 'Incredibly fast JavaScript runtime and package manager' }
    ]);

    // Load template suggestions
    this.suggestions.set('template', [
      { title: 'Basic', value: 'basic', description: 'Simple project structure' },
      { title: 'E-commerce', value: 'ecommerce', description: 'Online store template' },
      { title: 'Dashboard', value: 'dashboard', description: 'Analytics dashboard template' },
      { title: 'SaaS', value: 'saas', description: 'Software as a Service template' },
      { title: 'Blog', value: 'blog', description: 'Content management template' }
    ]);

    // Load common project names
    this.suggestions.set('projectName', [
      { title: 'my-app', value: 'my-app', description: 'Generic application name' },
      { title: 'frontend-app', value: 'frontend-app', description: 'Frontend application' },
      { title: 'web-platform', value: 'web-platform', description: 'Web platform project' },
      { title: 'micro-frontend', value: 'micro-frontend', description: 'Microfrontend application' }
    ]);
  }

  async prompt<T = any>(
    config: PromptConfig | PromptConfig[],
    options: EnhancedPromptOptions = {}
  ): Promise<T> {
    const startTime = Date.now();
    const configs = Array.isArray(config) ? config : [config];
    
    // Handle non-interactive mode
    if (options.nonInteractive || process.env.CI) {
      return this.handleNonInteractive(configs, options) as T;
    }

    // Prepare prompts with enhancements
    const enhancedConfigs = configs.map(cfg => this.enhancePromptConfig(cfg, options));
    
    try {
      // Execute prompts
      const response = await prompts(enhancedConfigs, {
        onCancel: () => {
          console.log(chalk.red('\n✖ Operation cancelled'));
          process.exit(1);
        }
      });

      // Record history
      this.recordHistory(configs, response, Date.now() - startTime);

      // Save responses if requested
      if (options.saveResponses) {
        await this.saveResponses(response, options.responseFile);
      }

      // Cache responses
      for (const [key, value] of Object.entries(response)) {
        this.responseCache.set(key, value);
      }

      return response as T;

    } catch (error: any) {
      console.error(chalk.red(`\n${this.theme.errorPrefix} Prompt error: ${error.message}`));
      throw error;
    }
  }

  private enhancePromptConfig(config: PromptConfig, options: EnhancedPromptOptions): any {
    const enhanced: any = {
      ...config,
      name: config.name,
      message: `${this.theme.prefix} ${config.message}${this.theme.suffix}`
    };

    // Add choices with descriptions
    if (config.choices) {
      enhanced.choices = config.choices.map(choice => ({
        ...choice,
        title: choice.description ? 
          `${choice.title} ${chalk.gray('- ' + choice.description)}` : 
          choice.title
      }));
    }

    // Enhanced validation
    if (config.validate) {
      enhanced.validate = async (value: any) => {
        if (options.skipValidation) return true;
        
        const result = await config.validate!(value);
        if (typeof result === 'string') {
          return `${this.theme.errorPrefix} ${result}`;
        }
        return result;
      };
    }

    // Enhanced autocomplete
    if (config.type === 'autocomplete') {
      enhanced.suggest = async (input: string) => {
        // Use custom suggest function if provided
        if (config.suggest) {
          return await config.suggest(input);
        }

        // Use built-in suggestions
        const suggestions = this.suggestions.get(config.name) || [];
        return suggestions.filter(suggestion =>
          suggestion.title.toLowerCase().includes(input.toLowerCase()) ||
          suggestion.value.toLowerCase().includes(input.toLowerCase())
        );
      };

      enhanced.limit = config.limit || 10;
    }

    // Add hints and warnings
    if (config.hint) {
      enhanced.message += chalk.gray(` (${config.hint})`);
    }

    if (config.warn) {
      enhanced.message += chalk.yellow(` ⚠ ${config.warn}`);
    }

    // Default values from cache or options
    if (!enhanced.initial) {
      enhanced.initial = options.defaults?.[config.name] || 
                       this.responseCache.get(config.name) ||
                       config.initial;
    }

    return enhanced;
  }

  private handleNonInteractive<T>(
    configs: PromptConfig[],
    options: EnhancedPromptOptions
  ): T {
    const response: Record<string, any> = {};

    for (const config of configs) {
      const defaultValue = options.defaults?.[config.name] || 
                          this.responseCache.get(config.name) ||
                          config.initial;

      if (defaultValue !== undefined) {
        response[config.name] = defaultValue;
      } else {
        throw new Error(
          `No default value provided for required prompt '${config.name}' in non-interactive mode`
        );
      }
    }

    return response as T;
  }

  private recordHistory(
    configs: PromptConfig[],
    response: Record<string, any>,
    duration: number
  ): void {
    const historyEntry: PromptHistory = {
      timestamp: new Date(),
      prompts: configs.map(config => ({
        name: config.name,
        value: response[config.name],
        duration: duration / configs.length // Approximate per-prompt duration
      }))
    };

    this.history.push(historyEntry);

    // Keep only last 50 entries
    if (this.history.length > 50) {
      this.history = this.history.slice(-50);
    }
  }

  private async saveResponses(
    response: Record<string, any>,
    filename?: string
  ): Promise<void> {
    try {
      const saveFile = filename || path.join(process.cwd(), '.re-shell', 'prompt-responses.json');
      const dir = path.dirname(saveFile);
      
      await fs.ensureDir(dir);
      
      let existingData: Record<string, any> = {};
      if (await fs.pathExists(saveFile)) {
        existingData = await fs.readJson(saveFile);
      }

      const updatedData = {
        ...existingData,
        ...response,
        lastUpdated: new Date().toISOString()
      };

      await fs.writeJson(saveFile, updatedData, { spaces: 2 });
    } catch (error) {
      // Don't throw on save errors
      console.warn(chalk.yellow(`${this.theme.warningPrefix} Failed to save responses: ${error}`));
    }
  }

  // Built-in prompt templates
  async promptProjectSetup(): Promise<{
    name: string;
    framework: string;
    typescript: boolean;
    packageManager: string;
    template: string;
    installDependencies: boolean;
  }> {
    return this.prompt([
      {
        type: 'text',
        name: 'name',
        message: 'Project name',
        initial: 'my-app',
        validate: (value: string) => {
          if (!value.trim()) return 'Project name is required';
          if (!/^[a-z0-9-_]+$/.test(value)) {
            return 'Project name must contain only lowercase letters, numbers, hyphens, and underscores';
          }
          return true;
        },
        hint: 'lowercase, no spaces'
      },
      {
        type: 'autocomplete',
        name: 'framework',
        message: 'Choose framework',
        choices: this.suggestions.get('framework')!
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript',
        initial: true
      },
      {
        type: 'select',
        name: 'packageManager',
        message: 'Package manager',
        choices: this.suggestions.get('packageManager')!,
        initial: 0
      },
      {
        type: 'select',
        name: 'template',
        message: 'Project template',
        choices: this.suggestions.get('template')!
      },
      {
        type: 'confirm',
        name: 'installDependencies',
        message: 'Install dependencies now',
        initial: true
      }
    ]);
  }

  async promptMicrofrontendConfig(): Promise<{
    name: string;
    framework: string;
    port: number;
    exposed: string[];
    typescript: boolean;
  }> {
    return this.prompt([
      {
        type: 'text',
        name: 'name',
        message: 'Microfrontend name',
        validate: (value: string) => {
          if (!value.trim()) return 'Name is required';
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Name must contain only lowercase letters, numbers, and hyphens';
          }
          return true;
        }
      },
      {
        type: 'autocomplete',
        name: 'framework',
        message: 'Framework',
        choices: this.suggestions.get('framework')!
      },
      {
        type: 'number',
        name: 'port',
        message: 'Development port',
        initial: 3001,
        min: 1000,
        max: 65535,
        validate: (value: number) => {
          if (value < 1000 || value > 65535) {
            return 'Port must be between 1000 and 65535';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'exposed',
        message: 'Exposed modules (comma-separated)',
        initial: './App',
        separator: ','
      },
      {
        type: 'confirm',
        name: 'typescript',
        message: 'Use TypeScript',
        initial: true
      }
    ]);
  }

  async promptConfigurationUpdate(): Promise<{
    updateGlobal: boolean;
    updateProject: boolean;
    backupExisting: boolean;
  }> {
    return this.prompt([
      {
        type: 'confirm',
        name: 'updateGlobal',
        message: 'Update global configuration',
        initial: false
      },
      {
        type: 'confirm',
        name: 'updateProject',
        message: 'Update project configuration',
        initial: true
      },
      {
        type: 'confirm',
        name: 'backupExisting',
        message: 'Backup existing configuration',
        initial: true
      }
    ]);
  }

  // Utility methods
  getCachedResponse(name: string): any {
    return this.responseCache.get(name);
  }

  setCachedResponse(name: string, value: any): void {
    this.responseCache.set(name, value);
  }

  clearCache(): void {
    this.responseCache.clear();
  }

  getHistory(): PromptHistory[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  addSuggestion(category: string, suggestion: PromptSuggestion): void {
    const existing = this.suggestions.get(category) || [];
    existing.push(suggestion);
    this.suggestions.set(category, existing);
  }

  getSuggestions(category: string): PromptSuggestion[] {
    return this.suggestions.get(category) || [];
  }

  // Validation helpers
  static validators = {
    required: (message = 'This field is required') => (value: any) => {
      if (value === undefined || value === null || value === '') {
        return message;
      }
      return true;
    },

    minLength: (min: number, message?: string) => (value: string) => {
      if (value.length < min) {
        return message || `Must be at least ${min} characters`;
      }
      return true;
    },

    maxLength: (max: number, message?: string) => (value: string) => {
      if (value.length > max) {
        return message || `Must be no more than ${max} characters`;
      }
      return true;
    },

    pattern: (pattern: RegExp, message?: string) => (value: string) => {
      if (!pattern.test(value)) {
        return message || 'Invalid format';
      }
      return true;
    },

    email: (message = 'Invalid email format') => (value: string) => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        return message;
      }
      return true;
    },

    url: (message = 'Invalid URL format') => (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return message;
      }
    },

    port: (message = 'Invalid port number') => (value: number) => {
      if (value < 1 || value > 65535 || !Number.isInteger(value)) {
        return message;
      }
      return true;
    },

    combine: (...validators: PromptValidator[]) => async (value: any) => {
      for (const validator of validators) {
        const result = await validator(value);
        if (result !== true) {
          return result;
        }
      }
      return true;
    }
  };
}

// Global instance
let globalPrompter: InteractivePrompter | null = null;

export function createPrompter(options?: EnhancedPromptOptions): InteractivePrompter {
  return new InteractivePrompter(options);
}

export function getGlobalPrompter(): InteractivePrompter {
  if (!globalPrompter) {
    globalPrompter = new InteractivePrompter();
  }
  return globalPrompter;
}

export function setGlobalPrompter(prompter: InteractivePrompter): void {
  globalPrompter = prompter;
}