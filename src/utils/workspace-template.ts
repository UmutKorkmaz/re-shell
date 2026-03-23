import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition, WorkspaceEntry, WorkspaceTypeConfig } from './workspace-schema';

// Template interfaces
export interface WorkspaceTemplate {
  name: string;
  description?: string;
  version: string;
  extends?: string; // Parent template name
  variables?: TemplateVariable[];
  workspaceDefaults?: Partial<WorkspaceEntry>;
  typeDefaults?: Record<string, Partial<WorkspaceTypeConfig>>;
  patterns?: string[];
  dependencies?: Record<string, any>;
  scripts?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface TemplateVariable {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: any;
  required?: boolean;
  enum?: any[];
  pattern?: string;
}

export interface TemplateContext {
  variables: Record<string, any>;
  workspace?: WorkspaceEntry;
  definition?: WorkspaceDefinition;
}

export interface InheritanceChain {
  templates: WorkspaceTemplate[];
  variables: Record<string, TemplateVariable>;
  merged: WorkspaceTemplate;
}

// Template registry
export interface TemplateRegistry {
  version: string;
  templates: Record<string, WorkspaceTemplate>;
  metadata: {
    created: string;
    modified: string;
    count: number;
  };
}

// Workspace template manager
export class WorkspaceTemplateManager {
  private templatesPath: string;
  private registry: TemplateRegistry;
  private templateCache: Map<string, WorkspaceTemplate> = new Map();

  constructor(rootPath: string = process.cwd()) {
    this.templatesPath = path.join(rootPath, '.re-shell', 'templates');
    this.registry = this.createDefaultRegistry();
  }

  // Initialize template system
  async init(): Promise<void> {
    await fs.ensureDir(this.templatesPath);
    await this.loadRegistry();
    await this.loadBuiltInTemplates();
  }

  // Load template registry
  async loadRegistry(): Promise<void> {
    const registryPath = path.join(this.templatesPath, 'registry.json');
    
    try {
      if (await fs.pathExists(registryPath)) {
        this.registry = await fs.readJson(registryPath);
      } else {
        await this.saveRegistry();
      }
    } catch (error) {
      this.registry = this.createDefaultRegistry();
    }
  }

  // Save template registry
  async saveRegistry(): Promise<void> {
    const registryPath = path.join(this.templatesPath, 'registry.json');
    this.registry.metadata.modified = new Date().toISOString();
    this.registry.metadata.count = Object.keys(this.registry.templates).length;
    
    await fs.writeJson(registryPath, this.registry, { spaces: 2 });
  }

  // Create new template
  async createTemplate(template: WorkspaceTemplate): Promise<void> {
    // Validate template
    this.validateTemplate(template);
    
    // Check for existing template
    if (this.registry.templates[template.name]) {
      throw new ValidationError(`Template '${template.name}' already exists`);
    }
    
    // Save template file
    const templatePath = path.join(this.templatesPath, `${template.name}.yaml`);
    await fs.writeFile(templatePath, yaml.stringify(template));
    
    // Update registry
    this.registry.templates[template.name] = template;
    await this.saveRegistry();
    
    // Clear cache
    this.templateCache.delete(template.name);
  }

  // Get template by name
  async getTemplate(name: string): Promise<WorkspaceTemplate | null> {
    // Check cache first
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }
    
    // Check registry
    if (!this.registry.templates[name]) {
      return null;
    }
    
    // Load template file
    const templatePath = path.join(this.templatesPath, `${name}.yaml`);
    
    try {
      if (await fs.pathExists(templatePath)) {
        const content = await fs.readFile(templatePath, 'utf8');
        const template = yaml.parse(content) as WorkspaceTemplate;
        
        // Cache for future use
        this.templateCache.set(name, template);
        return template;
      }
    } catch (error) {
      console.warn(`Failed to load template '${name}': ${(error as Error).message}`);
    }
    
    return null;
  }

  // List all templates
  async listTemplates(): Promise<WorkspaceTemplate[]> {
    const templates: WorkspaceTemplate[] = [];
    
    for (const name of Object.keys(this.registry.templates)) {
      const template = await this.getTemplate(name);
      if (template) {
        templates.push(template);
      }
    }
    
    return templates;
  }

  // Delete template
  async deleteTemplate(name: string): Promise<void> {
    if (!this.registry.templates[name]) {
      throw new ValidationError(`Template '${name}' not found`);
    }
    
    // Check if other templates depend on this one
    const dependents = await this.findDependentTemplates(name);
    if (dependents.length > 0) {
      throw new ValidationError(
        `Cannot delete template '${name}': used by ${dependents.join(', ')}`
      );
    }
    
    // Delete template file
    const templatePath = path.join(this.templatesPath, `${name}.yaml`);
    await fs.remove(templatePath);
    
    // Update registry
    delete this.registry.templates[name];
    await this.saveRegistry();
    
    // Clear cache
    this.templateCache.delete(name);
  }

  // Apply template with variable substitution
  async applyTemplate(
    templateName: string,
    context: TemplateContext
  ): Promise<Partial<WorkspaceDefinition>> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new ValidationError(`Template '${templateName}' not found`);
    }
    
    // Resolve inheritance chain
    const chain = await this.resolveInheritanceChain(templateName);
    
    // Validate variables against template requirements
    this.validateVariables(chain.variables, context.variables);
    
    // Apply template with inheritance
    const result = this.applyTemplateWithInheritance(chain.merged, context);
    
    return result;
  }

  // Resolve template inheritance chain
  async resolveInheritanceChain(templateName: string): Promise<InheritanceChain> {
    const templates: WorkspaceTemplate[] = [];
    const variables: Record<string, TemplateVariable> = {};
    const visited = new Set<string>();
    
    // Build inheritance chain
    let currentName: string | undefined = templateName;
    
    while (currentName) {
      // Check for circular inheritance
      if (visited.has(currentName)) {
        throw new ValidationError(`Circular inheritance detected: ${currentName}`);
      }
      visited.add(currentName);
      
      const template = await this.getTemplate(currentName);
      if (!template) {
        throw new ValidationError(`Template '${currentName}' not found in inheritance chain`);
      }
      
      templates.unshift(template); // Add to beginning (parent first)
      
      // Merge variables (child overrides parent)
      if (template.variables) {
        for (const variable of template.variables) {
          variables[variable.name] = { ...variables[variable.name], ...variable };
        }
      }
      
      currentName = template.extends;
    }
    
    // Merge templates (child overrides parent)
    const merged = this.mergeTemplates(templates);
    
    return { templates, variables, merged };
  }

  // Merge templates in inheritance chain
  private mergeTemplates(templates: WorkspaceTemplate[]): WorkspaceTemplate {
    let merged: WorkspaceTemplate = {
      name: templates[templates.length - 1].name,
      version: templates[templates.length - 1].version
    };
    
    for (const template of templates) {
      merged = {
        ...merged,
        ...template,
        workspaceDefaults: {
          ...merged.workspaceDefaults,
          ...template.workspaceDefaults
        },
        typeDefaults: {
          ...merged.typeDefaults,
          ...template.typeDefaults
        },
        patterns: [...(merged.patterns || []), ...(template.patterns || [])],
        dependencies: {
          ...merged.dependencies,
          ...template.dependencies
        },
        scripts: {
          ...merged.scripts,
          ...template.scripts
        },
        metadata: {
          ...merged.metadata,
          ...template.metadata
        }
      };
    }
    
    // Remove duplicates from arrays
    if (merged.patterns) {
      merged.patterns = Array.from(new Set(merged.patterns));
    }
    
    return merged;
  }

  // Apply template with context
  private applyTemplateWithInheritance(
    template: WorkspaceTemplate,
    context: TemplateContext
  ): Partial<WorkspaceDefinition> {
    const result: Partial<WorkspaceDefinition> = {};
    
    // Apply workspace defaults if creating new workspace
    if (context.workspace && template.workspaceDefaults) {
      Object.assign(context.workspace, this.substituteVariables(
        template.workspaceDefaults,
        context.variables
      ));
    }
    
    // Apply type defaults
    if (template.typeDefaults) {
      result.types = this.substituteVariables(
        template.typeDefaults,
        context.variables
      ) as Record<string, WorkspaceTypeConfig>;
    }
    
    // Apply patterns
    if (template.patterns) {
      result.patterns = template.patterns.map(pattern =>
        this.substituteString(pattern, context.variables)
      );
    }
    
    // Apply dependencies
    if (template.dependencies) {
      result.dependencies = this.substituteVariables(
        template.dependencies,
        context.variables
      ) as any;
    }
    
    // Apply scripts
    if (template.scripts) {
      result.scripts = Object.entries(template.scripts).reduce((acc, [key, value]) => {
        acc[key] = typeof value === 'string' 
          ? this.substituteString(value, context.variables)
          : value;
        return acc;
      }, {} as Record<string, any>);
    }
    
    return result;
  }

  // Validate template
  private validateTemplate(template: WorkspaceTemplate): void {
    if (!template.name) {
      throw new ValidationError('Template name is required');
    }
    
    if (!template.version) {
      throw new ValidationError('Template version is required');
    }
    
    // Validate variable definitions
    if (template.variables) {
      for (const variable of template.variables) {
        this.validateVariableDefinition(variable);
      }
    }
    
    // Validate inheritance
    if (template.extends && template.extends === template.name) {
      throw new ValidationError('Template cannot extend itself');
    }
  }

  // Validate variable definition
  private validateVariableDefinition(variable: TemplateVariable): void {
    if (!variable.name) {
      throw new ValidationError('Variable name is required');
    }
    
    if (!['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
      throw new ValidationError(`Invalid variable type: ${variable.type}`);
    }
    
    if (variable.enum && variable.default) {
      if (!variable.enum.includes(variable.default)) {
        throw new ValidationError(
          `Default value '${variable.default}' not in enum values`
        );
      }
    }
    
    if (variable.pattern && variable.type !== 'string') {
      throw new ValidationError('Pattern validation only applies to string variables');
    }
  }

  // Validate variables against requirements
  private validateVariables(
    definitions: Record<string, TemplateVariable>,
    values: Record<string, any>
  ): void {
    for (const [name, definition] of Object.entries(definitions)) {
      const value = values[name] ?? definition.default;
      
      // Check required
      if (definition.required && value === undefined) {
        throw new ValidationError(`Required variable '${name}' not provided`);
      }
      
      if (value !== undefined) {
        // Check type
        if (!this.isValidType(value, definition.type)) {
          throw new ValidationError(
            `Variable '${name}' must be of type ${definition.type}`
          );
        }
        
        // Check enum
        if (definition.enum && !definition.enum.includes(value)) {
          throw new ValidationError(
            `Variable '${name}' must be one of: ${definition.enum.join(', ')}`
          );
        }
        
        // Check pattern
        if (definition.pattern && definition.type === 'string') {
          const regex = new RegExp(definition.pattern);
          if (!regex.test(value)) {
            throw new ValidationError(
              `Variable '${name}' does not match pattern: ${definition.pattern}`
            );
          }
        }
      }
    }
  }

  // Type validation
  private isValidType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      default:
        return false;
    }
  }

  // Variable substitution
  private substituteVariables(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.substituteString(obj, variables);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariables(item, variables));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariables(value, variables);
      }
      return result;
    }
    
    return obj;
  }

  // String variable substitution
  private substituteString(str: string, variables: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (varName in variables) {
        return String(variables[varName]);
      }
      return match;
    });
  }

  // Find templates that depend on a given template
  private async findDependentTemplates(templateName: string): Promise<string[]> {
    const dependents: string[] = [];
    
    for (const template of await this.listTemplates()) {
      if (template.extends === templateName) {
        dependents.push(template.name);
      }
    }
    
    return dependents;
  }

  // Load built-in templates
  private async loadBuiltInTemplates(): Promise<void> {
    const builtInTemplates = [
      this.createMicrofrontendTemplate(),
      this.createLibraryTemplate(),
      this.createServiceTemplate(),
      this.createMonorepoTemplate()
    ];
    
    for (const template of builtInTemplates) {
      if (!this.registry.templates[template.name]) {
        try {
          await this.createTemplate(template);
        } catch (error) {
          // Ignore if template already exists
        }
      }
    }
  }

  // Built-in template definitions
  private createMicrofrontendTemplate(): WorkspaceTemplate {
    return {
      name: 'microfrontend',
      description: 'Standard microfrontend application template',
      version: '1.0.0',
      variables: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Microfrontend name',
          pattern: '^[a-z][a-z0-9-]*$'
        },
        {
          name: 'framework',
          type: 'string',
          default: 'react',
          enum: ['react', 'vue', 'angular', 'svelte'],
          description: 'Frontend framework'
        },
        {
          name: 'port',
          type: 'number',
          default: 5173,
          description: 'Development server port'
        }
      ],
      workspaceDefaults: {
        type: 'app'
      },
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
        test: 'vitest',
        lint: 'eslint src --ext ts,tsx'
      },
      dependencies: {
        'react': '^18.0.0',
        'react-dom': '^18.0.0',
        'vite': '^4.0.0'
      }
    };
  }

  private createLibraryTemplate(): WorkspaceTemplate {
    return {
      name: 'library',
      description: 'Shared library template',
      version: '1.0.0',
      variables: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Library name'
        },
        {
          name: 'type',
          type: 'string',
          default: 'utils',
          enum: ['utils', 'components', 'hooks', 'services'],
          description: 'Library type'
        }
      ],
      workspaceDefaults: {
        type: 'lib'
      },
      scripts: {
        build: 'tsc',
        test: 'vitest',
        lint: 'eslint src --ext ts,tsx'
      }
    };
  }

  private createServiceTemplate(): WorkspaceTemplate {
    return {
      name: 'service',
      description: 'Backend service template',
      version: '1.0.0',
      extends: 'base',
      variables: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Service name'
        },
        {
          name: 'runtime',
          type: 'string',
          default: 'node',
          enum: ['node', 'deno', 'bun'],
          description: 'JavaScript runtime'
        }
      ],
      workspaceDefaults: {
        type: 'service'
      },
      scripts: {
        dev: 'nodemon src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js'
      }
    };
  }

  private createMonorepoTemplate(): WorkspaceTemplate {
    return {
      name: 'monorepo',
      description: 'Full monorepo setup template',
      version: '1.0.0',
      variables: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Project name'
        },
        {
          name: 'packageManager',
          type: 'string',
          default: 'pnpm',
          enum: ['npm', 'yarn', 'pnpm'],
          description: 'Package manager'
        }
      ],
      patterns: [
        'apps/*',
        'packages/*',
        'services/*'
      ],
      scripts: {
        dev: '{{packageManager}} run dev',
        build: '{{packageManager}} run build',
        test: '{{packageManager}} run test',
        lint: '{{packageManager}} run lint'
      },
      typeDefaults: {
        app: {
          framework: 'react',
          build: { command: 'vite build' }
        },
        lib: {
          framework: 'typescript',
          build: { command: 'tsc' }
        },
        service: {
          framework: 'node',
          build: { command: 'esbuild src/index.ts --bundle --platform=node --outfile=dist/index.js' }
        }
      }
    };
  }

  // Utility methods
  private createDefaultRegistry(): TemplateRegistry {
    return {
      version: '1.0.0',
      templates: {},
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        count: 0
      }
    };
  }
}

// Utility functions
export async function createWorkspaceTemplateManager(
  rootPath?: string
): Promise<WorkspaceTemplateManager> {
  const manager = new WorkspaceTemplateManager(rootPath);
  await manager.init();
  return manager;
}

// Export template from workspace definition
export async function exportWorkspaceAsTemplate(
  definition: WorkspaceDefinition,
  templateName: string,
  variables?: TemplateVariable[]
): Promise<WorkspaceTemplate> {
  const template: WorkspaceTemplate = {
    name: templateName,
    description: `Template exported from ${definition.name}`,
    version: '1.0.0',
    variables: variables || [],
    patterns: definition.patterns,
    typeDefaults: definition.types,
    scripts: definition.scripts || {},
    metadata: {
      exportedFrom: definition.name,
      exportedAt: new Date().toISOString()
    }
  };
  
  return template;
}