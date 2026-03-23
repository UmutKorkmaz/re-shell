import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as yaml from 'yaml';
import {
  WorkspaceTemplateManager,
  WorkspaceTemplate,
  TemplateVariable,
  TemplateContext,
  createWorkspaceTemplateManager,
  exportWorkspaceAsTemplate
} from '../utils/workspace-template';
import { loadWorkspaceDefinition } from '../utils/workspace-schema';
import { ProgressSpinner, createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface WorkspaceTemplateCommandOptions {
  list?: boolean;
  create?: boolean;
  apply?: boolean;
  show?: boolean;
  delete?: boolean;
  export?: boolean;
  interactive?: boolean;
  
  // Template options
  template?: string;
  name?: string;
  extends?: string;
  
  // File options
  file?: string;
  output?: string;
  workspaceFile?: string;
  
  // Variable options
  variables?: string;
  varsFile?: string;
  
  // Output options
  json?: boolean;
  verbose?: boolean;
  
  spinner?: ProgressSpinner;
}

const DEFAULT_WORKSPACE_FILE = 're-shell.workspaces.yaml';

export async function manageWorkspaceTemplate(options: WorkspaceTemplateCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.list) {
      await listTemplates(options, spinner);
      return;
    }

    if (options.create) {
      await createTemplateInteractive(options, spinner);
      return;
    }

    if (options.apply) {
      await applyTemplate(options, spinner);
      return;
    }

    if (options.show) {
      await showTemplate(options, spinner);
      return;
    }

    if (options.delete) {
      await deleteTemplate(options, spinner);
      return;
    }

    if (options.export) {
      await exportTemplate(options, spinner);
      return;
    }

    if (options.interactive) {
      await interactiveTemplateManagement(options, spinner);
      return;
    }

    // Default: list templates
    await listTemplates(options, spinner);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Template operation failed'));
    throw error;
  }
}

async function listTemplates(options: WorkspaceTemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading templates...');

  try {
    const manager = await createWorkspaceTemplateManager();
    const templates = await manager.listTemplates();

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(templates, null, 2));
      return;
    }

    if (templates.length === 0) {
      console.log(chalk.yellow('\n⚠️  No templates found'));
      console.log(chalk.gray('Create one with: re-shell workspace-template create'));
      return;
    }

    console.log(chalk.cyan('\n📋 Available Workspace Templates'));
    console.log(chalk.gray('═'.repeat(50)));

    for (const template of templates) {
      console.log(`\n${chalk.bold(template.name)} v${template.version}`);
      
      if (template.description) {
        console.log(`  ${chalk.gray(template.description)}`);
      }
      
      if (template.extends) {
        console.log(`  ${chalk.yellow('Extends:')} ${template.extends}`);
      }
      
      if (template.variables && template.variables.length > 0) {
        console.log(`  ${chalk.blue('Variables:')} ${template.variables.map(v => v.name).join(', ')}`);
      }
      
      if (options.verbose) {
        if (template.patterns && template.patterns.length > 0) {
          console.log(`  ${chalk.green('Patterns:')} ${template.patterns.join(', ')}`);
        }
        
        if (template.scripts && Object.keys(template.scripts).length > 0) {
          console.log(`  ${chalk.magenta('Scripts:')} ${Object.keys(template.scripts).join(', ')}`);
        }
      }
    }

    console.log(chalk.cyan('\n🛠️  Commands:'));
    console.log('  • re-shell workspace-template show <name>');
    console.log('  • re-shell workspace-template apply <name>');
    console.log('  • re-shell workspace-template create');

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to load templates'));
    throw error;
  }
}

async function createTemplateInteractive(options: WorkspaceTemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  console.log(chalk.cyan('\n🎨 Create Workspace Template'));
  console.log(chalk.gray('═'.repeat(50)));

  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Template name:',
      validate: value => value.trim() ? true : 'Name is required'
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description (optional):'
    },
    {
      type: 'text',
      name: 'version',
      message: 'Version:',
      initial: '1.0.0'
    },
    {
      type: 'text',
      name: 'extends',
      message: 'Extends template (optional):'
    },
    {
      type: 'confirm',
      name: 'addVariables',
      message: 'Add template variables?',
      initial: true
    }
  ]);

  if (!response.name) return;

  const template: WorkspaceTemplate = {
    name: response.name,
    version: response.version,
    description: response.description || undefined,
    extends: response.extends || undefined,
    variables: []
  };

  // Add variables
  if (response.addVariables) {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const varResponse = await prompts([
        {
          type: 'text',
          name: 'name',
          message: 'Variable name (empty to finish):'
        },
        {
          type: prev => prev ? 'select' : null,
          name: 'type',
          message: 'Variable type:',
          choices: [
            { title: 'String', value: 'string' },
            { title: 'Number', value: 'number' },
            { title: 'Boolean', value: 'boolean' },
            { title: 'Array', value: 'array' },
            { title: 'Object', value: 'object' }
          ]
        },
        {
          type: prev => prev ? 'text' : null,
          name: 'description',
          message: 'Description (optional):'
        },
        {
          type: prev => prev ? 'confirm' : null,
          name: 'required',
          message: 'Required?',
          initial: false
        },
        {
          type: (prev, values) => values.type === 'string' || values.type === 'number' ? 'text' : null,
          name: 'default',
          message: 'Default value (optional):'
        }
      ]);

      if (!varResponse.name) break;

      const variable: TemplateVariable = {
        name: varResponse.name,
        type: varResponse.type,
        description: varResponse.description || undefined,
        required: varResponse.required
      };

      if (varResponse.default) {
        variable.default = varResponse.type === 'number' 
          ? Number(varResponse.default) 
          : varResponse.default;
      }

      template.variables!.push(variable);
    }
  }

  // Add template content
  const contentResponse = await prompts([
    {
      type: 'confirm',
      name: 'addPatterns',
      message: 'Add workspace patterns?',
      initial: false
    },
    {
      type: prev => prev ? 'list' : null,
      name: 'patterns',
      message: 'Patterns (comma-separated):',
      separator: ','
    },
    {
      type: 'confirm',
      name: 'addScripts',
      message: 'Add default scripts?',
      initial: false
    }
  ]);

  if (contentResponse.patterns) {
    template.patterns = contentResponse.patterns.map((p: string) => p.trim());
  }

  if (contentResponse.addScripts) {
    template.scripts = {};
    
    const commonScripts = ['dev', 'build', 'test', 'lint'];
    for (const scriptName of commonScripts) {
      const scriptResponse = await prompts({
        type: 'text',
        name: 'command',
        message: `${scriptName} script (optional):`
      });
      
      if (scriptResponse.command) {
        template.scripts[scriptName] = scriptResponse.command;
      }
    }
  }

  // Save template
  spinner = createSpinner('Creating template...').start();

  try {
    const manager = await createWorkspaceTemplateManager();
    await manager.createTemplate(template);

    if (spinner) spinner.succeed(chalk.green(`Template '${template.name}' created successfully!`));

    // Show next steps
    console.log(chalk.cyan('\n🚀 Next steps:'));
    console.log(`  • Apply template: re-shell workspace-template apply ${template.name}`);
    console.log(`  • View template: re-shell workspace-template show ${template.name}`);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to create template'));
    throw error;
  }
}

async function applyTemplate(options: WorkspaceTemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.template) {
    throw new ValidationError('Template name is required');
  }

  if (spinner) spinner.setText(`Loading template: ${options.template}`);

  try {
    const manager = await createWorkspaceTemplateManager();
    const template = await manager.getTemplate(options.template);

    if (!template) {
      throw new ValidationError(`Template '${options.template}' not found`);
    }

    if (spinner) spinner.stop();

    // Collect variables
    const variables: Record<string, any> = {};

    // Load from file if provided
    if (options.varsFile) {
      const varsPath = path.resolve(options.varsFile);
      if (await fs.pathExists(varsPath)) {
        const content = await fs.readFile(varsPath, 'utf8');
        Object.assign(variables, yaml.parse(content));
      }
    }

    // Parse command line variables
    if (options.variables) {
      try {
        const parsed = JSON.parse(options.variables);
        Object.assign(variables, parsed);
      } catch (error) {
        throw new ValidationError('Invalid variables JSON format');
      }
    }

    // Prompt for missing required variables
    if (template.variables) {
      for (const varDef of template.variables) {
        if (varDef.required && !(varDef.name in variables)) {
          const response = await prompts({
            type: varDef.type === 'number' ? 'number' : 
                  varDef.type === 'boolean' ? 'confirm' : 'text',
            name: 'value',
            message: `${varDef.name}${varDef.description ? ` (${varDef.description})` : ''}:`,
            initial: varDef.default
          });

          if (response.value !== undefined) {
            variables[varDef.name] = response.value;
          }
        }
      }
    }

    // Apply template
    if (spinner) spinner = createSpinner('Applying template...').start();

    const context: TemplateContext = { variables };
    const result = await manager.applyTemplate(options.template, context);

    if (spinner) spinner.stop();

    if (options.output) {
      // Save to file
      const outputPath = path.resolve(options.output);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, yaml.stringify(result));
      
      console.log(chalk.green(`✅ Template applied and saved to: ${options.output}`));
    } else if (options.json) {
      // Output as JSON
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Display result
      console.log(chalk.cyan('\n📄 Applied Template Result'));
      console.log(chalk.gray('═'.repeat(50)));
      console.log(yaml.stringify(result));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to apply template'));
    throw error;
  }
}

async function showTemplate(options: WorkspaceTemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.template) {
    throw new ValidationError('Template name is required');
  }

  if (spinner) spinner.setText(`Loading template: ${options.template}`);

  try {
    const manager = await createWorkspaceTemplateManager();
    const template = await manager.getTemplate(options.template);

    if (!template) {
      throw new ValidationError(`Template '${options.template}' not found`);
    }

    // Resolve inheritance chain
    const chain = await manager.resolveInheritanceChain(options.template);

    if (spinner) spinner.stop();

    if (options.json) {
      console.log(JSON.stringify({
        template,
        inheritance: chain.templates.map(t => t.name),
        mergedVariables: chain.variables
      }, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n📋 Template: ${template.name}`));
    console.log(chalk.gray('═'.repeat(50)));

    console.log(`Version: ${template.version}`);
    if (template.description) {
      console.log(`Description: ${template.description}`);
    }

    if (template.extends) {
      console.log(`\n${chalk.yellow('Inheritance Chain:')}`);
      for (let i = 0; i < chain.templates.length; i++) {
        console.log(`  ${i + 1}. ${chain.templates[i].name} v${chain.templates[i].version}`);
      }
    }

    if (Object.keys(chain.variables).length > 0) {
      console.log(`\n${chalk.blue('Variables:')}`);
      for (const [name, varDef] of Object.entries(chain.variables)) {
        console.log(`  ${name}:`);
        console.log(`    Type: ${varDef.type}`);
        if (varDef.description) {
          console.log(`    Description: ${varDef.description}`);
        }
        if (varDef.required) {
          console.log(`    Required: ${chalk.red('yes')}`);
        }
        if (varDef.default !== undefined) {
          console.log(`    Default: ${JSON.stringify(varDef.default)}`);
        }
        if (varDef.enum) {
          console.log(`    Values: ${varDef.enum.join(', ')}`);
        }
        if (varDef.pattern) {
          console.log(`    Pattern: ${varDef.pattern}`);
        }
      }
    }

    if (options.verbose) {
      console.log(`\n${chalk.green('Template Content:')}`);
      console.log(yaml.stringify(chain.merged));
    }

    console.log(chalk.cyan('\n🛠️  Commands:'));
    console.log(`  • Apply: re-shell workspace-template apply ${template.name}`);
    console.log(`  • Delete: re-shell workspace-template delete ${template.name}`);

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to load template'));
    throw error;
  }
}

async function deleteTemplate(options: WorkspaceTemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (!options.template) {
    throw new ValidationError('Template name is required');
  }

  if (spinner) spinner.setText(`Deleting template: ${options.template}`);

  try {
    const manager = await createWorkspaceTemplateManager();
    await manager.deleteTemplate(options.template);

    if (spinner) spinner.succeed(chalk.green(`Template '${options.template}' deleted successfully!`));

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to delete template'));
    throw error;
  }
}

async function exportTemplate(options: WorkspaceTemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  const workspaceFile = options.workspaceFile || DEFAULT_WORKSPACE_FILE;
  
  if (!options.name) {
    throw new ValidationError('Template name is required for export');
  }

  if (spinner) spinner.setText('Exporting workspace as template...');

  try {
    const definition = await loadWorkspaceDefinition(workspaceFile);
    
    // Create variables for common fields
    const variables: TemplateVariable[] = [
      {
        name: 'projectName',
        type: 'string',
        required: true,
        description: 'Project name'
      },
      {
        name: 'description',
        type: 'string',
        required: false,
        description: 'Project description'
      }
    ];
    
    const template = await exportWorkspaceAsTemplate(definition, options.name, variables);
    
    if (spinner) spinner.stop();

    if (options.output) {
      // Save to file
      const outputPath = path.resolve(options.output);
      await fs.ensureDir(path.dirname(outputPath));
      await fs.writeFile(outputPath, yaml.stringify(template));
      
      console.log(chalk.green(`✅ Template exported to: ${options.output}`));
    } else {
      // Create template
      const manager = await createWorkspaceTemplateManager();
      await manager.createTemplate(template);
      
      console.log(chalk.green(`✅ Template '${options.name}' created from workspace`));
    }

  } catch (error) {
    if (spinner) spinner.fail(chalk.red('Failed to export template'));
    throw error;
  }
}

async function interactiveTemplateManagement(options: WorkspaceTemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '📋 List templates', value: 'list' },
        { title: '🎨 Create new template', value: 'create' },
        { title: '🔧 Apply template', value: 'apply' },
        { title: '👁️  Show template details', value: 'show' },
        { title: '📤 Export workspace as template', value: 'export' },
        { title: '🗑️  Delete template', value: 'delete' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'list':
      await listTemplates({ ...options, interactive: false });
      break;
    case 'create':
      await createTemplateInteractive({ ...options, interactive: false });
      break;
    case 'apply':
      {
      const applyResponse = await prompts({
        type: 'text',
        name: 'template',
        message: 'Template name:'
      });
      if (applyResponse.template) {
        await applyTemplate({ ...options, template: applyResponse.template, interactive: false });
      }
      break;
      }
    case 'show':
      {
      const showResponse = await prompts({
        type: 'text',
        name: 'template',
        message: 'Template name:'
      });
      if (showResponse.template) {
        await showTemplate({ ...options, template: showResponse.template, interactive: false });
      }
      break;
      }
    case 'export':
      {
      const exportResponse = await prompts({
        type: 'text',
        name: 'name',
        message: 'Template name:'
      });
      if (exportResponse.name) {
        await exportTemplate({ ...options, name: exportResponse.name, interactive: false });
      }
      break;
      }
    case 'delete':
      {
      const deleteResponse = await prompts({
        type: 'text',
        name: 'template',
        message: 'Template name to delete:'
      });
      if (deleteResponse.template) {
        const confirmResponse = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete '${deleteResponse.template}'?`,
          initial: false
        });
        if (confirmResponse.confirm) {
          await deleteTemplate({ ...options, template: deleteResponse.template, interactive: false });
        }
      }
      break;
      }
  }
}