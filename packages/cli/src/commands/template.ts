import chalk from 'chalk';
import prompts from 'prompts';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import { templateEngine, ConfigTemplate, TemplateVariable, TemplateHelpers } from '../utils/template-engine';
import { configManager } from '../utils/config';
import { ProgressSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';

export interface TemplateCommandOptions {
  list?: boolean;
  create?: boolean;
  delete?: boolean;
  apply?: boolean;
  show?: boolean;
  template?: string;
  name?: string;
  output?: string;
  variables?: string;
  interactive?: boolean;
  json?: boolean;
  verbose?: boolean;
  spinner?: ProgressSpinner;
}

export async function manageTemplates(options: TemplateCommandOptions = {}): Promise<void> {
  const { spinner, verbose, json } = options;

  try {
    if (options.list) {
      await listTemplates(options, spinner);
      return;
    }

    if (options.create) {
      await createTemplate(options, spinner);
      return;
    }

    if (options.delete && options.template) {
      await deleteTemplate(options.template, options, spinner);
      return;
    }

    if (options.apply && options.template) {
      await applyTemplate(options.template, options, spinner);
      return;
    }

    if (options.show && options.template) {
      await showTemplate(options.template, options, spinner);
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

async function listTemplates(options: TemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText('Loading templates...');
  
  const templates = await templateEngine.listTemplates();
  
  if (spinner) spinner.stop();

  if (templates.length === 0) {
    console.log(chalk.yellow('⚠️  No templates found.'));
    console.log(chalk.gray('Create your first template with: re-shell template create'));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(templates, null, 2));
  } else {
    console.log(chalk.cyan('\\n📋 Available Configuration Templates'));
    console.log(chalk.gray('═'.repeat(50)));

    for (const template of templates) {
      console.log(chalk.cyan(`\\n📄 ${template.name} (v${template.version})`));
      console.log(`   ${template.description}`);
      
      if (template.tags.length > 0) {
        console.log(`   ${chalk.gray('Tags:')} ${template.tags.map(tag => chalk.blue(tag)).join(', ')}`);
      }
      
      console.log(`   ${chalk.gray('Variables:')} ${template.variables.length}`);
      
      if (template.author) {
        console.log(`   ${chalk.gray('Author:')} ${template.author}`);
      }
      
      if (options.verbose) {
        console.log(`   ${chalk.gray('Created:')} ${new Date(template.createdAt).toLocaleDateString()}`);
        console.log(`   ${chalk.gray('Updated:')} ${new Date(template.updatedAt).toLocaleDateString()}`);
      }
    }

    console.log(chalk.gray(`\\nTotal: ${templates.length} template(s)`));
  }
}

async function createTemplate(options: TemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'source',
      message: 'How would you like to create the template?',
      choices: [
        { title: '📋 From existing configuration file', value: 'file' },
        { title: '🏗️  From project configuration', value: 'project' },
        { title: '🏢 From workspace configuration', value: 'workspace' },
        { title: '⚡ Quick template (built-in)', value: 'builtin' },
        { title: '✏️  Custom template (manual)', value: 'custom' }
      ]
    }
  ]);

  if (!response.source) return;

  switch (response.source) {
    case 'file':
      await createTemplateFromFile(options);
      break;
    case 'project':
      await createTemplateFromProject(options);
      break;
    case 'workspace':
      await createTemplateFromWorkspace(options);
      break;
    case 'builtin':
      await createBuiltinTemplate(options);
      break;
    case 'custom':
      await createCustomTemplate(options);
      break;
  }
}

async function createTemplateFromFile(options: TemplateCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'filePath',
      message: 'Path to configuration file:',
      validate: (value: string) => value.trim() ? true : 'File path is required'
    },
    {
      type: 'text',
      name: 'templateName',
      message: 'Template name:',
      validate: (value: string) => {
        if (!value.trim()) return 'Template name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
        return true;
      }
    },
    {
      type: 'text',
      name: 'description',
      message: 'Template description:',
      validate: (value: string) => value.trim() ? true : 'Description is required'
    }
  ]);

  if (!response.templateName) return;

  // For now, create a simple template without variables
  // In a real implementation, this would analyze the config file and suggest variables
  const variables: TemplateVariable[] = [
    {
      name: 'name',
      type: 'string',
      description: 'Configuration name',
      required: true
    }
  ];

  const template = await templateEngine.createTemplate(
    response.templateName,
    { name: '${name}' }, // Simplified for demo
    variables,
    {
      description: response.description,
      version: '1.0.0',
      tags: ['custom', 'file-based']
    }
  );

  console.log(chalk.green(`✅ Template '${template.name}' created successfully!`));
}

async function createTemplateFromProject(options: TemplateCommandOptions): Promise<void> {
  const projectConfig = await configManager.loadProjectConfig();
  if (!projectConfig) {
    console.log(chalk.yellow('⚠️  No project configuration found.'));
    return;
  }

  const response = await prompts([
    {
      type: 'text',
      name: 'templateName',
      message: 'Template name:',
      initial: `${projectConfig.name}-template`,
      validate: (value: string) => {
        if (!value.trim()) return 'Template name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
        return true;
      }
    },
    {
      type: 'text',
      name: 'description',
      message: 'Template description:',
      initial: `Template based on ${projectConfig.name} project configuration`
    },
    {
      type: 'multiselect',
      name: 'variableFields',
      message: 'Which fields should be variables?',
      choices: [
        { title: 'Project name', value: 'name', selected: true },
        { title: 'Package manager', value: 'packageManager' },
        { title: 'Framework', value: 'framework' },
        { title: 'Development port', value: 'dev.port' },
        { title: 'Coverage threshold', value: 'quality.coverage.threshold' }
      ]
    }
  ]);

  if (!response.templateName) return;

  // Create variables based on selection
  const variables: TemplateVariable[] = response.variableFields.map((field: string) => {
    switch (field) {
      case 'name':
        return {
          name: 'projectName',
          type: 'string' as const,
          description: 'Name of the project',
          required: true,
          validation: { pattern: '^[a-z0-9-]+$' }
        };
      case 'packageManager':
        return {
          name: 'packageManager',
          type: 'string' as const,
          description: 'Package manager to use',
          default: projectConfig.packageManager,
          validation: { options: ['npm', 'yarn', 'pnpm', 'bun'] }
        };
      case 'framework':
        return {
          name: 'framework',
          type: 'string' as const,
          description: 'Framework to use',
          default: projectConfig.framework
        };
      case 'dev.port':
        return {
          name: 'devPort',
          type: 'number' as const,
          description: 'Development server port',
          default: projectConfig.dev?.port || 3000,
          validation: { min: 1000, max: 65535 }
        };
      case 'quality.coverage.threshold':
        return {
          name: 'coverageThreshold',
          type: 'number' as const,
          description: 'Code coverage threshold',
          default: projectConfig.quality?.coverage?.threshold || 80,
          validation: { min: 0, max: 100 }
        };
      default:
        return {
          name: field.replace('.', '_'),
          type: 'string' as const,
          description: `Configuration for ${field}`,
          required: false
        };
    }
  });

  // Create template config with variable substitutions
  const templateConfig = JSON.parse(JSON.stringify(projectConfig));
  
  response.variableFields.forEach((field: string) => {
    switch (field) {
      case 'name':
        templateConfig.name = '${projectName}';
        break;
      case 'packageManager':
        templateConfig.packageManager = '${packageManager}';
        break;
      case 'framework':
        templateConfig.framework = '${framework}';
        break;
      case 'dev.port':
        if (templateConfig.dev) templateConfig.dev.port = '${devPort}';
        break;
      case 'quality.coverage.threshold':
        if (templateConfig.quality?.coverage) templateConfig.quality.coverage.threshold = '${coverageThreshold}';
        break;
    }
  });

  const template = await templateEngine.createTemplate(
    response.templateName,
    templateConfig,
    variables,
    {
      description: response.description,
      version: '1.0.0',
      tags: ['project', projectConfig.framework, projectConfig.packageManager]
    }
  );

  console.log(chalk.green(`✅ Template '${template.name}' created from project configuration!`));
}

async function createTemplateFromWorkspace(options: TemplateCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'text',
      name: 'workspacePath',
      message: 'Workspace path:',
      initial: process.cwd(),
      validate: (value: string) => value.trim() ? true : 'Workspace path is required'
    }
  ]);

  if (!response.workspacePath) return;

  const workspaceConfig = await configManager.loadWorkspaceConfig(response.workspacePath);
  if (!workspaceConfig) {
    console.log(chalk.yellow('⚠️  No workspace configuration found at the specified path.'));
    return;
  }

  const templateResponse = await prompts([
    {
      type: 'text',
      name: 'templateName',
      message: 'Template name:',
      initial: `${workspaceConfig.name}-workspace-template`,
      validate: (value: string) => {
        if (!value.trim()) return 'Template name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
        return true;
      }
    },
    {
      type: 'text',
      name: 'description',
      message: 'Template description:',
      initial: `Template for ${workspaceConfig.type} workspace`
    }
  ]);

  if (!templateResponse.templateName) return;

  const variables: TemplateVariable[] = [
    {
      name: 'workspaceName',
      type: 'string',
      description: 'Name of the workspace',
      required: true,
      validation: { pattern: '^[a-z0-9-]+$' }
    },
    {
      name: 'framework',
      type: 'string',
      description: 'Framework for the workspace',
      default: workspaceConfig.framework
    }
  ];

  const templateConfig = JSON.parse(JSON.stringify(workspaceConfig));
  templateConfig.name = '${workspaceName}';
  if (templateConfig.framework) templateConfig.framework = '${framework}';

  const template = await templateEngine.createTemplate(
    templateResponse.templateName,
    templateConfig,
    variables,
    {
      description: templateResponse.description,
      version: '1.0.0',
      tags: ['workspace', workspaceConfig.type, workspaceConfig.framework || 'generic']
    }
  );

  console.log(chalk.green(`✅ Template '${template.name}' created from workspace configuration!`));
}

async function createBuiltinTemplate(options: TemplateCommandOptions): Promise<void> {
  const response = await prompts([
    {
      type: 'select',
      name: 'type',
      message: 'Choose a built-in template type:',
      choices: [
        { title: '🚀 React Project Template', value: 'react-project' },
        { title: '🎯 Vue Project Template', value: 'vue-project' },
        { title: '⚡ Svelte Project Template', value: 'svelte-project' },
        { title: '📦 Package Workspace Template', value: 'package-workspace' },
        { title: '🏗️  App Workspace Template', value: 'app-workspace' },
        { title: '📚 Library Workspace Template', value: 'lib-workspace' }
      ]
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Default package manager:',
      choices: [
        { title: 'pnpm (recommended)', value: 'pnpm' },
        { title: 'npm', value: 'npm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' }
      ]
    }
  ]);

  if (!response.type) return;

  let template: ConfigTemplate;

  switch (response.type) {
    case 'react-project':
    case 'vue-project':
    case 'svelte-project':
      {
      const framework = response.type.split('-')[0];
      template = TemplateHelpers.createProjectTemplate(
        `${framework}-project`,
        `${framework}-ts`,
        response.packageManager
      );
      break;
      }
    case 'package-workspace':
    case 'app-workspace':
    case 'lib-workspace':
      {
      const workspaceType = response.type.split('-')[0] as 'app' | 'package' | 'lib';
      template = TemplateHelpers.createWorkspaceTemplate(workspaceType);
      break;
      }
    default:
      throw new ValidationError(`Unknown template type: ${response.type}`);
  }

  await templateEngine.saveTemplate(template);
  console.log(chalk.green(`✅ Built-in template '${template.name}' created successfully!`));
}

async function createCustomTemplate(options: TemplateCommandOptions): Promise<void> {
  console.log(chalk.cyan('\\n✏️  Custom Template Creator'));
  console.log(chalk.gray('Create a template from scratch with custom variables'));

  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Template name:',
      validate: (value: string) => {
        if (!value.trim()) return 'Template name is required';
        if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens only';
        return true;
      }
    },
    {
      type: 'text',
      name: 'description',
      message: 'Template description:',
      validate: (value: string) => value.trim() ? true : 'Description is required'
    },
    {
      type: 'text',
      name: 'version',
      message: 'Template version:',
      initial: '1.0.0'
    },
    {
      type: 'list',
      name: 'tags',
      message: 'Tags (comma-separated):',
      separator: ','
    }
  ]);

  if (!response.name) return;

  // Create variables interactively
  const variables: TemplateVariable[] = [];
  let addMoreVariables = true;

  while (addMoreVariables) {
    const varResponse = await prompts([
      {
        type: 'text',
        name: 'name',
        message: `Variable ${variables.length + 1} name:`,
        validate: (value: string) => {
          if (!value.trim()) return 'Variable name is required';
          if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(value)) return 'Use valid identifier (letters, numbers, underscore)';
          return true;
        }
      },
      {
        type: 'select',
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
        type: 'text',
        name: 'description',
        message: 'Variable description:',
        validate: (value: string) => value.trim() ? true : 'Description is required'
      },
      {
        type: 'toggle',
        name: 'required',
        message: 'Is this variable required?',
        initial: false,
        active: 'yes',
        inactive: 'no'
      },
      {
        type: 'text',
        name: 'defaultValue',
        message: 'Default value (optional):'
      },
      {
        type: 'toggle',
        name: 'addMore',
        message: 'Add another variable?',
        initial: true,
        active: 'yes',
        inactive: 'no'
      }
    ]);

    if (varResponse.name) {
      const variable: TemplateVariable = {
        name: varResponse.name,
        type: varResponse.type,
        description: varResponse.description,
        required: varResponse.required
      };

      if (varResponse.defaultValue) {
        try {
          variable.default = JSON.parse(varResponse.defaultValue);
        } catch {
          variable.default = varResponse.defaultValue;
        }
      }

      variables.push(variable);
    }

    addMoreVariables = varResponse.addMore;
  }

  // Create basic template structure
  const templateConfig = {
    name: '${name}',
    type: 'custom',
    // Add more fields based on variables
  };

  const template = await templateEngine.createTemplate(
    response.name,
    templateConfig,
    variables,
    {
      description: response.description,
      version: response.version,
      tags: response.tags || []
    }
  );

  console.log(chalk.green(`✅ Custom template '${template.name}' created successfully!`));
  console.log(chalk.gray(`Edit the template file to customize the configuration structure.`));
}

async function deleteTemplate(templateName: string, options: TemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Deleting template: ${templateName}`);
  
  const template = await templateEngine.getTemplate(templateName);
  if (!template) {
    if (spinner) spinner.fail(chalk.red(`Template '${templateName}' not found`));
    return;
  }

  if (spinner) spinner.stop();

  const confirmation = await prompts([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to delete template '${templateName}'?`,
      initial: false
    }
  ]);

  if (!confirmation.confirmed) {
    console.log(chalk.yellow('Operation cancelled.'));
    return;
  }

  await templateEngine.deleteTemplate(templateName);
  console.log(chalk.green(`✅ Template '${templateName}' deleted successfully!`));
}

async function applyTemplate(templateName: string, options: TemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Loading template: ${templateName}`);
  
  const template = await templateEngine.getTemplate(templateName);
  if (!template) {
    if (spinner) spinner.fail(chalk.red(`Template '${templateName}' not found`));
    return;
  }

  if (spinner) spinner.stop();

  console.log(chalk.cyan(`\\n🎯 Applying Template: ${template.name}`));
  console.log(chalk.gray(template.description));

  // Collect variable values
  const variables: Record<string, any> = {};
  
  if (options.variables) {
    // Parse variables from command line (JSON format)
    try {
      const parsed = JSON.parse(options.variables);
      Object.assign(variables, parsed);
    } catch (error) {
      throw new ValidationError('Invalid variables JSON format');
    }
  } else {
    // Interactive variable collection
    for (const varDef of template.variables) {
      const response = await prompts([
        {
          type: varDef.type === 'boolean' ? 'toggle' :
                varDef.type === 'number' ? 'number' : 'text',
          name: 'value',
          message: `${varDef.description}:`,
          initial: varDef.default,
          validate: varDef.required ? 
            (value: any) => value !== undefined && value !== '' ? true : `${varDef.name} is required` :
            undefined,
          active: varDef.type === 'boolean' ? 'yes' : undefined,
          inactive: varDef.type === 'boolean' ? 'no' : undefined
        }
      ]);

      if (response.value !== undefined) {
        variables[varDef.name] = response.value;
      }
    }
  }

  // Get project info for context
  const projectConfig = await configManager.loadProjectConfig();
  const globalConfig = await configManager.loadGlobalConfig();

  const context = {
    projectInfo: projectConfig ? {
      name: projectConfig.name,
      type: projectConfig.type,
      framework: projectConfig.framework,
      packageManager: projectConfig.packageManager
    } : undefined,
    userInfo: {
      name: globalConfig.user.name,
      email: globalConfig.user.email,
      organization: globalConfig.user.organization
    }
  };

  // Render template
  const result = await templateEngine.renderTemplate(templateName, variables, context);

  // Output result
  if (options.output) {
    // Save to file
    const outputPath = path.resolve(options.output);
    await fsExtra.writeFile(outputPath, JSON.stringify(result, null, 2));
    console.log(chalk.green(`✅ Configuration saved to: ${outputPath}`));
  } else if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(chalk.cyan('\\n📄 Generated Configuration:'));
    console.log(chalk.gray('═'.repeat(40)));
    console.log(JSON.stringify(result, null, 2));
  }
}

async function showTemplate(templateName: string, options: TemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.setText(`Loading template: ${templateName}`);
  
  const template = await templateEngine.getTemplate(templateName);
  if (!template) {
    if (spinner) spinner.fail(chalk.red(`Template '${templateName}' not found`));
    return;
  }

  if (spinner) spinner.stop();

  if (options.json) {
    console.log(JSON.stringify(template, null, 2));
  } else {
    console.log(chalk.cyan(`\\n📄 Template: ${template.name} (v${template.version})`));
    console.log(chalk.gray('═'.repeat(50)));
    
    console.log(`\\n${chalk.cyan('Description:')} ${template.description}`);
    
    if (template.author) {
      console.log(`${chalk.cyan('Author:')} ${template.author}`);
    }
    
    if (template.tags.length > 0) {
      console.log(`${chalk.cyan('Tags:')} ${template.tags.map(tag => chalk.blue(tag)).join(', ')}`);
    }
    
    console.log(`${chalk.cyan('Created:')} ${new Date(template.createdAt).toLocaleDateString()}`);
    console.log(`${chalk.cyan('Updated:')} ${new Date(template.updatedAt).toLocaleDateString()}`);
    
    console.log(chalk.cyan('\\n📋 Variables:'));
    template.variables.forEach((variable, index) => {
      console.log(`  ${index + 1}. ${chalk.yellow(variable.name)} (${variable.type})`);
      console.log(`     ${variable.description}`);
      if (variable.required) console.log(`     ${chalk.red('Required')}`);
      if (variable.default !== undefined) console.log(`     Default: ${variable.default}`);
      if (variable.validation) {
        const rules = [];
        if (variable.validation.pattern) rules.push(`Pattern: ${variable.validation.pattern}`);
        if (variable.validation.min !== undefined) rules.push(`Min: ${variable.validation.min}`);
        if (variable.validation.max !== undefined) rules.push(`Max: ${variable.validation.max}`);
        if (variable.validation.options) rules.push(`Options: ${variable.validation.options.join(', ')}`);
        if (rules.length > 0) console.log(`     ${chalk.gray('Validation:')} ${rules.join(', ')}`);
      }
      console.log('');
    });
    
    if (options.verbose) {
      console.log(chalk.cyan('Template Structure:'));
      console.log(JSON.stringify(template.template, null, 2));
    }
  }
}

async function interactiveTemplateManagement(options: TemplateCommandOptions, spinner?: ProgressSpinner): Promise<void> {
  if (spinner) spinner.stop();

  const response = await prompts([
    {
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: '📋 List templates', value: 'list' },
        { title: '🆕 Create new template', value: 'create' },
        { title: '👁️  Show template details', value: 'show' },
        { title: '🎯 Apply template', value: 'apply' },
        { title: '🗑️  Delete template', value: 'delete' }
      ]
    }
  ]);

  if (!response.action) return;

  switch (response.action) {
    case 'list':
      await listTemplates(options);
      break;
    case 'create':
      await createTemplate(options);
      break;
    case 'show':
      {
      const templates = await templateEngine.listTemplates();
      if (templates.length === 0) {
        console.log(chalk.yellow('No templates available.'));
        return;
      }
      const showResponse = await prompts([
        {
          type: 'select',
          name: 'template',
          message: 'Select template to show:',
          choices: templates.map(t => ({ title: `${t.name} - ${t.description}`, value: t.name }))
        }
      ]);
      if (showResponse.template) {
        await showTemplate(showResponse.template, options);
      }
      break;
      }
    case 'apply':
      {
      const applyTemplates = await templateEngine.listTemplates();
      if (applyTemplates.length === 0) {
        console.log(chalk.yellow('No templates available.'));
        return;
      }
      const applyResponse = await prompts([
        {
          type: 'select',
          name: 'template',
          message: 'Select template to apply:',
          choices: applyTemplates.map(t => ({ title: `${t.name} - ${t.description}`, value: t.name }))
        }
      ]);
      if (applyResponse.template) {
        await applyTemplate(applyResponse.template, options);
      }
      break;
      }
    case 'delete':
      {
      const deleteTemplates = await templateEngine.listTemplates();
      if (deleteTemplates.length === 0) {
        console.log(chalk.yellow('No templates available.'));
        return;
      }
      const deleteResponse = await prompts([
        {
          type: 'select',
          name: 'template',
          message: 'Select template to delete:',
          choices: deleteTemplates.map(t => ({ title: `${t.name} - ${t.description}`, value: t.name }))
        }
      ]);
      if (deleteResponse.template) {
        await deleteTemplate(deleteResponse.template, options);
      }
      break;
      }
  }
}