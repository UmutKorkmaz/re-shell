import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Template, TemplateCategory, TemplateVariable, TemplateFile, TemplateHook, HookType } from './template-engine';
import { TemplateValidator } from './template-validator';
import { InteractivePrompter } from './interactive-prompts';

export interface WizardOptions {
  outputPath?: string;
  validate?: boolean;
  interactive?: boolean;
  defaults?: Partial<Template>;
  templatePath?: string;
  includeExamples?: boolean;
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  type: 'input' | 'select' | 'multiselect' | 'confirm' | 'custom';
  required?: boolean;
  validate?: (value: any) => boolean | string;
  transform?: (value: any) => any;
  when?: (answers: any) => boolean;
  default?: any;
  choices?: any[];
  customHandler?: (answers: any) => Promise<any>;
}

export interface WizardResult {
  template: Template;
  outputPath: string;
  validated: boolean;
  validationResult?: any;
  examples?: GeneratedExample[];
}

export interface GeneratedExample {
  name: string;
  description: string;
  files: Array<{
    path: string;
    content: string;
  }>;
  command: string;
}

export class TemplateWizard extends EventEmitter {
  private prompter: InteractivePrompter;
  private validator: TemplateValidator;
  private steps: WizardStep[] = [];
  private currentTemplate: Partial<Template> = {};

  constructor(
    private options: WizardOptions = {}
  ) {
    super();
    this.prompter = new InteractivePrompter();
    this.validator = new TemplateValidator();
    this.initializeSteps();
  }

  private initializeSteps(): void {
    // Basic Information
    this.steps.push({
      id: 'name',
      title: 'Template Name',
      description: 'Enter a name for your template',
      type: 'input',
      required: true,
      validate: (value: string) => {
        if (!value || value.trim().length < 3) {
          return 'Template name must be at least 3 characters';
        }
        return true;
      },
      transform: (value: string) => value.trim()
    });

    this.steps.push({
      id: 'id',
      title: 'Template ID',
      description: 'Enter a unique identifier (lowercase, hyphens)',
      type: 'input',
      required: true,
      default: (answers: any) => answers.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      validate: (value: string) => {
        if (!/^[a-z0-9-]+$/.test(value)) {
          return 'ID must contain only lowercase letters, numbers, and hyphens';
        }
        return true;
      }
    });

    this.steps.push({
      id: 'version',
      title: 'Initial Version',
      description: 'Enter the initial version (semantic versioning)',
      type: 'input',
      required: true,
      default: '1.0.0',
      validate: (value: string) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const semver = require('semver');
        if (!semver.valid(value)) {
          return 'Version must be valid semantic version (e.g., 1.0.0)';
        }
        return true;
      }
    });

    this.steps.push({
      id: 'description',
      title: 'Description',
      description: 'Provide a description of your template',
      type: 'input',
      required: true,
      validate: (value: string) => {
        if (!value || value.trim().length < 10) {
          return 'Description must be at least 10 characters';
        }
        return true;
      }
    });

    this.steps.push({
      id: 'category',
      title: 'Template Category',
      description: 'Select the category that best describes your template',
      type: 'select',
      required: true,
      choices: Object.values(TemplateCategory).map(cat => ({
        value: cat,
        title: this.formatCategoryName(cat)
      })),
      default: TemplateCategory.CUSTOM
    });

    this.steps.push({
      id: 'tags',
      title: 'Tags',
      description: 'Enter tags for your template (comma-separated)',
      type: 'input',
      transform: (value: string) => value.split(',').map(t => t.trim()).filter(Boolean),
      default: []
    });

    // Author Information
    this.steps.push({
      id: 'author',
      title: 'Author',
      description: 'Enter the author name',
      type: 'input',
      default: process.env.USER || process.env.USERNAME
    });

    this.steps.push({
      id: 'license',
      title: 'License',
      description: 'Select a license for your template',
      type: 'select',
      choices: [
        { value: 'MIT', title: 'MIT License' },
        { value: 'Apache-2.0', title: 'Apache License 2.0' },
        { value: 'GPL-3.0', title: 'GNU GPL v3' },
        { value: 'BSD-3-Clause', title: 'BSD 3-Clause' },
        { value: 'ISC', title: 'ISC License' },
        { value: 'UNLICENSED', title: 'Unlicensed (Private)' },
        { value: 'custom', title: 'Custom License' }
      ],
      default: 'MIT'
    });

    this.steps.push({
      id: 'repository',
      title: 'Repository URL',
      description: 'Enter the repository URL (optional)',
      type: 'input',
      validate: (value: string) => {
        if (value && !value.match(/^https?:\/\/.+/)) {
          return 'Repository URL must start with http:// or https://';
        }
        return true;
      }
    });

    // Template Features
    this.steps.push({
      id: 'features',
      title: 'Template Features',
      description: 'Select features to include in your template',
      type: 'multiselect',
      choices: [
        { value: 'inheritance', title: 'Template Inheritance (extends other templates)' },
        { value: 'interfaces', title: 'Template Interfaces (implements contracts)' },
        { value: 'variables', title: 'User Variables (customizable values)' },
        { value: 'hooks', title: 'Lifecycle Hooks (pre/post actions)' },
        { value: 'conditional', title: 'Conditional Files (based on variables)' },
        { value: 'merge', title: 'File Merging (merge with existing files)' },
        { value: 'examples', title: 'Usage Examples' }
      ],
      default: ['variables']
    });

    // Variable Configuration
    this.steps.push({
      id: 'variables',
      title: 'Configure Variables',
      description: 'Define template variables',
      type: 'custom',
      when: (answers: any) => answers.features.includes('variables'),
      customHandler: async (answers: any) => {
        const variables = await this.configureVariables();
        return variables;
      }
    });

    // File Configuration
    this.steps.push({
      id: 'files',
      title: 'Configure Files',
      description: 'Define template files',
      type: 'custom',
      required: true,
      customHandler: async (answers: any) => {
        const files = await this.configureFiles(answers);
        return files;
      }
    });

    // Hook Configuration
    this.steps.push({
      id: 'hooks',
      title: 'Configure Hooks',
      description: 'Define lifecycle hooks',
      type: 'custom',
      when: (answers: any) => answers.features.includes('hooks'),
      customHandler: async (answers: any) => {
        const hooks = await this.configureHooks();
        return hooks;
      }
    });

    // Inheritance Configuration
    this.steps.push({
      id: 'extends',
      title: 'Parent Templates',
      description: 'Enter parent template IDs (comma-separated)',
      type: 'input',
      when: (answers: any) => answers.features.includes('inheritance'),
      transform: (value: string) => value.split(',').map(t => t.trim()).filter(Boolean),
      default: []
    });

    // Interface Configuration
    this.steps.push({
      id: 'implements',
      title: 'Interface Templates',
      description: 'Enter interface template IDs (comma-separated)',
      type: 'input',
      when: (answers: any) => answers.features.includes('interfaces'),
      transform: (value: string) => value.split(',').map(t => t.trim()).filter(Boolean),
      default: []
    });
  }

  async run(): Promise<WizardResult> {
    this.emit('wizard:start');

    try {
      // Collect answers for all steps
      const answers: any = {};

      for (const step of this.steps) {
        // Check if step should be shown
        if (step.when && !step.when(answers)) {
          continue;
        }

        this.emit('step:start', step);

        let value: any;

        if (step.type === 'custom' && step.customHandler) {
          value = await step.customHandler(answers);
        } else {
          value = await this.promptStep(step, answers);
        }

        // Apply transformation
        if (step.transform) {
          value = step.transform(value);
        }

        answers[step.id] = value;
        this.emit('step:complete', { step, value });
      }

      // Build template from answers
      const template = this.buildTemplate(answers);

      // Validate if requested
      let validationResult;
      if (this.options.validate !== false) {
        validationResult = await this.validator.validate(template);
        
        if (!validationResult.valid) {
          const shouldContinue = await this.prompter.prompt({
            type: 'confirm',
            name: 'continue',
            message: `Template validation found ${validationResult.errors.length} errors. Continue anyway?`,
            initial: false
          });

          if (!shouldContinue.continue) {
            throw new Error('Template validation failed');
          }
        }
      }

      // Determine output path
      const outputPath = this.options.outputPath || 
        path.join(process.cwd(), 'templates', template.id);

      // Save template
      await this.saveTemplate(template, outputPath);

      // Generate examples if requested
      let examples: GeneratedExample[] = [];
      if (this.options.includeExamples && answers.features.includes('examples')) {
        examples = await this.generateExamples(template, outputPath);
      }

      const result: WizardResult = {
        template,
        outputPath,
        validated: this.options.validate !== false,
        validationResult,
        examples
      };

      this.emit('wizard:complete', result);
      return result;

    } catch (error) {
      this.emit('wizard:error', error);
      throw error;
    }
  }

  private async promptStep(step: WizardStep, answers: any): Promise<any> {
    const config: any = {
      type: step.type,
      name: 'value',
      message: step.title,
      validate: step.validate
    };

    if (step.description) {
      config.message = `${step.title}\n  ${step.description}`;
    }

    if (step.choices) {
      config.choices = step.choices;
    }

    if (step.default !== undefined) {
      config.default = typeof step.default === 'function' ? step.default(answers) : step.default;
    }

    const result = await this.prompter.prompt(config);
    return result.value;
  }

  private async configureVariables(): Promise<TemplateVariable[]> {
    const variables: TemplateVariable[] = [];
    let addMore = true;

    while (addMore) {
      console.log('\n📝 Configure a new variable:');
      
      const variable: TemplateVariable = {
        name: '',
        type: 'string',
        description: '',
        required: true
      };

      // Variable name
      const nameResult = await this.prompter.prompt({
        type: 'text',
        name: 'name',
        message: 'Variable name',
        validate: (value: string) => {
          if (!value || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
            return 'Variable name must start with letter/underscore and contain only letters, numbers, underscores';
          }
          if (variables.some(v => v.name === value)) {
            return 'Variable name already exists';
          }
          return true;
        }
      });
      variable.name = nameResult.name;

      // Variable type
      const typeResult = await this.prompter.prompt({
        type: 'select',
        name: 'type',
        message: 'Variable type',
        choices: [
          { value: 'string', title: 'String' },
          { value: 'number', title: 'Number' },
          { value: 'boolean', title: 'Boolean' },
          { value: 'choice', title: 'Choice (from list)' },
          { value: 'array', title: 'Array' },
          { value: 'object', title: 'Object' }
        ]
      });
      variable.type = typeResult.type;

      // Variable description
      const descResult = await this.prompter.prompt({
        type: 'text',
        name: 'description',
        message: 'Description',
        validate: (value: string) => value.length > 0 || 'Description is required'
      });
      variable.description = descResult.description;

      // Required?
      const requiredResult = await this.prompter.prompt({
        type: 'confirm',
        name: 'required',
        message: 'Is this variable required?',
        initial: true
      });
      variable.required = requiredResult.required;

      // Default value
      if (!variable.required) {
        const defaultResult = await this.prompter.prompt({
          type: 'text',
          name: 'default',
          message: 'Default value'
        });
        if (defaultResult.default !== '') {
          variable.default = defaultResult.default;
        }
      }

      // Choices for choice type
      if (variable.type === 'choice') {
        const choicesResult = await this.prompter.prompt({
          type: 'text',
          name: 'choices',
          message: 'Enter choices (comma-separated)',
          validate: (value: string) => value.length > 0 || 'At least one choice is required'
        });
        variable.choices = choicesResult.choices.split(',').map((s: string) => s.trim());
      }

      // Pattern validation
      const usePatternResult = await this.prompter.prompt({
        type: 'confirm',
        name: 'usePattern',
        message: 'Add pattern validation?',
        initial: false
      });

      if (usePatternResult.usePattern && variable.type === 'string') {
        const patternResult = await this.prompter.prompt({
          type: 'text',
          name: 'pattern',
          message: 'Regular expression pattern',
          validate: (value: string) => {
            try {
              new RegExp(value);
              return true;
            } catch {
              return 'Invalid regular expression';
            }
          }
        });
        variable.pattern = patternResult.pattern;
      }

      variables.push(variable);

      // Add more?
      const moreResult = await this.prompter.prompt({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another variable?',
        initial: false
      });
      addMore = moreResult.addMore;
    }

    return variables;
  }

  private async configureFiles(answers: any): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    let addMore = true;

    // Create template directory structure
    const templateDir = this.options.templatePath || path.join(process.cwd(), 'template-files');
    await fs.ensureDir(templateDir);

    console.log(`\n📁 Template files will be created in: ${templateDir}`);

    while (addMore) {
      console.log('\n📄 Configure a new file:');

      const file: TemplateFile = {
        source: '',
        destination: ''
      };

      // File destination
      const destResult = await this.prompter.prompt({
        type: 'text',
        name: 'destination',
        message: 'Destination path (in generated project)',
        validate: (value: string) => value.length > 0 || 'Destination is required'
      });
      file.destination = destResult.destination;

      // Source type
      const sourceTypeResult = await this.prompter.prompt({
        type: 'select',
        name: 'sourceType',
        message: 'How to create the source file?',
        choices: [
          { value: 'create', title: 'Create new file with content' },
          { value: 'existing', title: 'Use existing file' },
          { value: 'inline', title: 'Enter content inline' }
        ]
      });

      if (sourceTypeResult.sourceType === 'create') {
        // Create source file
        const filename = path.basename(file.destination);
        const sourcePath = path.join(templateDir, filename + '.hbs');
        
        const contentResult = await this.prompter.prompt({
          type: 'text',
          name: 'content',
          message: 'Enter file content (Handlebars template)'
        });

        await fs.writeFile(sourcePath, contentResult.content);
        file.source = path.relative(process.cwd(), sourcePath);

      } else if (sourceTypeResult.sourceType === 'existing') {
        const sourceResult = await this.prompter.prompt({
          type: 'text',
          name: 'source',
          message: 'Source file path',
          validate: async (value: string) => {
            if (!value) return 'Source path is required';
            if (!await fs.pathExists(value)) return 'File does not exist';
            return true;
          }
        });
        file.source = sourceResult.source;

      } else {
        // Inline content
        const filename = `inline-${Date.now()}.hbs`;
        const sourcePath = path.join(templateDir, filename);
        
        const contentResult = await this.prompter.prompt({
          type: 'text',
          name: 'content',
          message: 'Enter file content (single line)'
        });

        await fs.writeFile(sourcePath, contentResult.content);
        file.source = path.relative(process.cwd(), sourcePath);
      }

      // Transform type
      const transformResult = await this.prompter.prompt({
        type: 'select',
        name: 'transform',
        message: 'Template engine',
        choices: [
          { value: 'handlebars', title: 'Handlebars (default)' },
          { value: 'none', title: 'No transformation (copy as-is)' }
        ],
        initial: 'handlebars'
      });
      if (transformResult.transform !== 'handlebars') {
        file.transform = transformResult.transform;
      }

      // Conditional?
      if (answers.features.includes('conditional')) {
        const conditionalResult = await this.prompter.prompt({
          type: 'confirm',
          name: 'conditional',
          message: 'Make this file conditional?',
          initial: false
        });

        if (conditionalResult.conditional) {
          const conditionResult = await this.prompter.prompt({
            type: 'text',
            name: 'condition',
            message: 'Condition expression (JavaScript)',
            initial: 'context.variables.includeFeature === true'
          });
          file.condition = conditionResult.condition;
        }
      }

      // Merge strategy?
      if (answers.features.includes('merge')) {
        const mergeResult = await this.prompter.prompt({
          type: 'confirm',
          name: 'merge',
          message: 'Enable merging if file exists?',
          initial: false
        });

        if (mergeResult.merge) {
          file.merge = true;
          
          const strategyResult = await this.prompter.prompt({
            type: 'select',
            name: 'mergeStrategy',
            message: 'Merge strategy',
            choices: [
              { value: 'override', title: 'Override (replace existing)' },
              { value: 'append', title: 'Append to existing' },
              { value: 'prepend', title: 'Prepend to existing' },
              { value: 'deep', title: 'Deep merge (JSON/YAML only)' }
            ],
            initial: 'override'
          });
          
          if (strategyResult.mergeStrategy !== 'override') {
            file.mergeStrategy = strategyResult.mergeStrategy;
          }
        }
      }

      files.push(file);

      // Add more?
      const moreResult = await this.prompter.prompt({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another file?',
        initial: true
      });
      addMore = moreResult.addMore;
    }

    return files;
  }

  private async configureHooks(): Promise<TemplateHook[]> {
    const hooks: TemplateHook[] = [];
    let addMore = true;

    while (addMore) {
      console.log('\n🪝 Configure a new hook:');

      const hook: TemplateHook = {
        type: HookType.AFTER_PROCESS,
        name: ''
      };

      // Hook type
      const typeResult = await this.prompter.prompt({
        type: 'select',
        name: 'type',
        message: 'Hook type',
        choices: [
          { value: HookType.BEFORE_PROCESS, title: 'Before Process (before template processing)' },
          { value: HookType.AFTER_PROCESS, title: 'After Process (after all files)' },
          { value: HookType.BEFORE_FILE, title: 'Before File (before each file)' },
          { value: HookType.AFTER_FILE, title: 'After File (after each file)' },
          { value: HookType.VALIDATE, title: 'Validate (validation hook)' },
          { value: HookType.CLEANUP, title: 'Cleanup (cleanup hook)' }
        ]
      });
      hook.type = typeResult.type;

      // Hook name
      const nameResult = await this.prompter.prompt({
        type: 'text',
        name: 'name',
        message: 'Hook name',
        validate: (value: string) => value.length > 0 || 'Name is required'
      });
      hook.name = nameResult.name;

      // Hook description
      const descResult = await this.prompter.prompt({
        type: 'text',
        name: 'description',
        message: 'Description (optional)'
      });
      if (descResult.description) {
        hook.description = descResult.description;
      }

      // Hook implementation
      const implResult = await this.prompter.prompt({
        type: 'select',
        name: 'implementation',
        message: 'Hook implementation',
        choices: [
          { value: 'command', title: 'Shell command' },
          { value: 'script', title: 'JavaScript code' }
        ]
      });

      if (implResult.implementation === 'command') {
        const commandResult = await this.prompter.prompt({
          type: 'text',
          name: 'command',
          message: 'Shell command',
          validate: (value: string) => value.length > 0 || 'Command is required'
        });
        hook.command = commandResult.command;
      } else {
        const scriptResult = await this.prompter.prompt({
          type: 'text',
          name: 'script',
          message: 'JavaScript code (has access to context and require)'
        });
        hook.script = scriptResult.script;
      }

      // Allow failure?
      const allowFailureResult = await this.prompter.prompt({
        type: 'confirm',
        name: 'allowFailure',
        message: 'Allow hook to fail without stopping?',
        initial: false
      });
      hook.allowFailure = allowFailureResult.allowFailure;

      hooks.push(hook);

      // Add more?
      const moreResult = await this.prompter.prompt({
        type: 'confirm',
        name: 'addMore',
        message: 'Add another hook?',
        initial: false
      });
      addMore = moreResult.addMore;
    }

    return hooks;
  }

  private buildTemplate(answers: any): Template {
    const template: Template = {
      id: answers.id,
      name: answers.name,
      version: answers.version,
      description: answers.description,
      category: answers.category,
      tags: answers.tags || [],
      variables: answers.variables || [],
      files: answers.files || [],
      hooks: answers.hooks || [],
      metadata: {
        created: new Date(),
        updated: new Date()
      }
    };

    // Add optional fields
    if (answers.author) template.author = answers.author;
    if (answers.license) template.license = answers.license;
    if (answers.repository) template.repository = answers.repository;
    if (answers.extends && answers.extends.length > 0) template.extends = answers.extends;
    if (answers.implements && answers.implements.length > 0) template.implements = answers.implements;

    // Merge with defaults if provided
    if (this.options.defaults) {
      Object.assign(template, this.options.defaults);
    }

    return template;
  }

  private async saveTemplate(template: Template, outputPath: string): Promise<void> {
    await fs.ensureDir(outputPath);

    // Save template.yaml
    const templatePath = path.join(outputPath, 'template.yaml');
    const yamlContent = yaml.dump(template, {
      skipInvalid: true,
      noRefs: true,
      sortKeys: true
    });
    await fs.writeFile(templatePath, yamlContent);

    // Create README
    const readmePath = path.join(outputPath, 'README.md');
    const readmeContent = this.generateReadme(template);
    await fs.writeFile(readmePath, readmeContent);

    // Copy template files to template directory
    if (this.options.templatePath && this.options.templatePath !== outputPath) {
      const filesDir = path.join(outputPath, 'files');
      await fs.ensureDir(filesDir);

      for (const file of template.files) {
        if (file.source && !path.isAbsolute(file.source)) {
          const sourcePath = path.join(this.options.templatePath, file.source);
          if (await fs.pathExists(sourcePath)) {
            const destPath = path.join(filesDir, path.basename(file.source));
            await fs.copy(sourcePath, destPath);
            
            // Update file source to relative path
            file.source = path.join('files', path.basename(file.source));
          }
        }
      }

      // Update template.yaml with new paths
      await fs.writeFile(templatePath, yaml.dump(template));
    }

    this.emit('template:saved', { template, outputPath });
  }

  private generateReadme(template: Template): string {
    const sections: string[] = [];

    sections.push(`# ${template.name}`);
    sections.push('');
    sections.push(template.description);
    sections.push('');

    // Metadata
    sections.push('## Information');
    sections.push('');
    sections.push(`- **ID**: ${template.id}`);
    sections.push(`- **Version**: ${template.version}`);
    sections.push(`- **Category**: ${this.formatCategoryName(template.category)}`);
    if (template.author) sections.push(`- **Author**: ${template.author}`);
    if (template.license) sections.push(`- **License**: ${template.license}`);
    if (template.tags.length > 0) sections.push(`- **Tags**: ${template.tags.join(', ')}`);
    sections.push('');

    // Usage
    sections.push('## Usage');
    sections.push('');
    sections.push('```bash');
    sections.push(`re-shell create my-project --template ${template.id}`);
    sections.push('```');
    sections.push('');

    // Variables
    if (template.variables.length > 0) {
      sections.push('## Variables');
      sections.push('');
      sections.push('| Name | Type | Required | Description | Default |');
      sections.push('|------|------|----------|-------------|---------|');
      
      for (const variable of template.variables) {
        const required = variable.required ? 'Yes' : 'No';
        const defaultValue = variable.default !== undefined ? `\`${JSON.stringify(variable.default)}\`` : '-';
        sections.push(`| ${variable.name} | ${variable.type} | ${required} | ${variable.description} | ${defaultValue} |`);
      }
      sections.push('');
    }

    // Files
    if (template.files.length > 0) {
      sections.push('## Files');
      sections.push('');
      sections.push('This template will create the following files:');
      sections.push('');
      
      for (const file of template.files) {
        let line = `- \`${file.destination}\``;
        if (file.condition) line += ' (conditional)';
        sections.push(line);
      }
      sections.push('');
    }

    // Hooks
    if (template.hooks.length > 0) {
      sections.push('## Hooks');
      sections.push('');
      sections.push('This template includes the following hooks:');
      sections.push('');
      
      for (const hook of template.hooks) {
        sections.push(`- **${hook.name}** (${hook.type})`);
        if (hook.description) sections.push(`  ${hook.description}`);
      }
      sections.push('');
    }

    // Features
    const features: string[] = [];
    if (template.extends && template.extends.length > 0) {
      features.push(`Extends: ${template.extends.join(', ')}`);
    }
    if (template.implements && template.implements.length > 0) {
      features.push(`Implements: ${template.implements.join(', ')}`);
    }
    
    if (features.length > 0) {
      sections.push('## Features');
      sections.push('');
      for (const feature of features) {
        sections.push(`- ${feature}`);
      }
      sections.push('');
    }

    // Development
    sections.push('## Development');
    sections.push('');
    sections.push('To modify this template:');
    sections.push('');
    sections.push('1. Edit `template.yaml` to update metadata and configuration');
    sections.push('2. Modify files in the template directory');
    sections.push('3. Test your changes: `re-shell create test-project --template ./path/to/template`');
    sections.push('');

    return sections.join('\n');
  }

  private async generateExamples(template: Template, outputPath: string): Promise<GeneratedExample[]> {
    const examples: GeneratedExample[] = [];

    // Basic example
    const basicExample: GeneratedExample = {
      name: 'basic',
      description: 'Basic usage with default values',
      files: [],
      command: `re-shell create my-app --template ${template.id}`
    };

    // Create example output
    const exampleDir = path.join(outputPath, 'examples', 'basic');
    await fs.ensureDir(exampleDir);

    // Generate sample files
    for (const file of template.files.slice(0, 3)) { // Show first 3 files
      const content = `# Example output for ${file.destination}\n# This file would be generated with default variable values`;
      
      basicExample.files.push({
        path: file.destination,
        content
      });

      await fs.writeFile(path.join(exampleDir, path.basename(file.destination)), content);
    }

    examples.push(basicExample);

    // Advanced example with custom variables
    if (template.variables.length > 0) {
      const advancedExample: GeneratedExample = {
        name: 'advanced',
        description: 'Advanced usage with custom variables',
        files: [],
        command: `re-shell create my-app --template ${template.id}`
      };

      // Add variable flags
      for (const variable of template.variables.slice(0, 3)) {
        advancedExample.command += ` --var ${variable.name}=customValue`;
      }

      examples.push(advancedExample);
    }

    return examples;
  }

  private formatCategoryName(category: TemplateCategory): string {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Public methods
  addStep(step: WizardStep): void {
    this.steps.push(step);
  }

  removeStep(id: string): boolean {
    const index = this.steps.findIndex(s => s.id === id);
    if (index >= 0) {
      this.steps.splice(index, 1);
      return true;
    }
    return false;
  }

  getSteps(): WizardStep[] {
    return [...this.steps];
  }

  setOptions(options: Partial<WizardOptions>): void {
    Object.assign(this.options, options);
  }
}

// Convenience function for quick template creation
export async function createTemplateInteractive(options?: WizardOptions): Promise<WizardResult> {
  const wizard = new TemplateWizard(options);
  return await wizard.run();
}

// Export for CLI integration
export function createTemplateWizard(options?: WizardOptions): TemplateWizard {
  return new TemplateWizard(options);
}