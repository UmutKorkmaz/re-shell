import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { ValidationError } from './error-handler';

// Template variable types
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  default?: any;
  required?: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: any[];
  };
}

// Template definition
export interface ConfigTemplate {
  name: string;
  version: string;
  description: string;
  author?: string;
  tags: string[];
  variables: TemplateVariable[];
  template: any; // The actual configuration template with variables
  examples?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Template context for variable substitution
export interface TemplateContext {
  variables: Record<string, any>;
  environment?: Record<string, string>;
  projectInfo?: {
    name?: string;
    type?: string;
    version?: string;
    framework?: string;
    packageManager?: string;
  };
  userInfo?: {
    name?: string;
    email?: string;
    organization?: string;
  };
  timestamp?: {
    iso: string;
    unix: number;
    formatted: string;
  };
}

// Template engine for configuration substitution
export class ConfigTemplateEngine {
  private templates: Map<string, ConfigTemplate> = new Map();
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(process.cwd(), '.re-shell', 'templates');
  }

  // Load template from file
  async loadTemplate(templatePath: string): Promise<ConfigTemplate> {
    try {
      const content = await fs.readFile(templatePath, 'utf8');
      const template = yaml.parse(content) as ConfigTemplate;
      this.validateTemplate(template);
      return template;
    } catch (error) {
      throw new ValidationError(`Failed to load template: ${(error as Error).message}`);
    }
  }

  // Save template to file
  async saveTemplate(template: ConfigTemplate, templatePath?: string): Promise<string> {
    try {
      this.validateTemplate(template);
      
      const fileName = templatePath || `${template.name}.template.yaml`;
      const fullPath = path.isAbsolute(fileName) ? fileName : path.join(this.templatesDir, fileName);
      
      await fs.ensureDir(path.dirname(fullPath));
      
      template.updatedAt = new Date().toISOString();
      const content = yaml.stringify(template);
      await fs.writeFile(fullPath, content, 'utf8');
      
      this.templates.set(template.name, template);
      return fullPath;
    } catch (error) {
      throw new ValidationError(`Failed to save template: ${(error as Error).message}`);
    }
  }

  // List available templates
  async listTemplates(): Promise<ConfigTemplate[]> {
    try {
      await fs.ensureDir(this.templatesDir);
      const files = await fs.readdir(this.templatesDir);
      const templateFiles = files.filter(file => file.endsWith('.template.yaml'));
      
      const templates: ConfigTemplate[] = [];
      for (const file of templateFiles) {
        try {
          const template = await this.loadTemplate(path.join(this.templatesDir, file));
          templates.push(template);
        } catch (error) {
          console.warn(`Failed to load template ${file}: ${(error as Error).message}`);
        }
      }
      
      return templates.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      throw new ValidationError(`Failed to list templates: ${(error as Error).message}`);
    }
  }

  // Get template by name
  async getTemplate(name: string): Promise<ConfigTemplate | null> {
    if (this.templates.has(name)) {
      return this.templates.get(name)!;
    }

    try {
      const templatePath = path.join(this.templatesDir, `${name}.template.yaml`);
      if (await fs.pathExists(templatePath)) {
        const template = await this.loadTemplate(templatePath);
        this.templates.set(name, template);
        return template;
      }
    } catch (error) {
      // Template not found or invalid
    }

    return null;
  }

  // Render template with variables
  async renderTemplate(
    templateName: string, 
    variables: Record<string, any>, 
    context?: Partial<TemplateContext>
  ): Promise<any> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new ValidationError(`Template '${templateName}' not found`);
    }

    // Validate required variables
    this.validateVariables(template, variables);

    // Build full context
    const fullContext = this.buildContext(variables, context);

    // Perform substitution
    return this.substituteVariables(template.template, fullContext);
  }

  // Create a new template from existing configuration
  async createTemplate(
    name: string,
    config: any,
    variables: TemplateVariable[],
    options: {
      description?: string;
      author?: string;
      tags?: string[];
      version?: string;
    } = {}
  ): Promise<ConfigTemplate> {
    const template: ConfigTemplate = {
      name,
      version: options.version || '1.0.0',
      description: options.description || `Configuration template for ${name}`,
      author: options.author,
      tags: options.tags || [],
      variables,
      template: config,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.saveTemplate(template);
    return template;
  }

  // Delete template
  async deleteTemplate(name: string): Promise<void> {
    try {
      const templatePath = path.join(this.templatesDir, `${name}.template.yaml`);
      if (await fs.pathExists(templatePath)) {
        await fs.unlink(templatePath);
        this.templates.delete(name);
      } else {
        throw new ValidationError(`Template '${name}' not found`);
      }
    } catch (error) {
      throw new ValidationError(`Failed to delete template: ${(error as Error).message}`);
    }
  }

  // Variable substitution engine
  private substituteVariables(obj: any, context: TemplateContext): any {
    if (typeof obj === 'string') {
      return this.substituteString(obj, context);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariables(item, context));
    } else if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Allow template key substitution
        const newKey = this.substituteString(key, context);
        result[newKey] = this.substituteVariables(value, context);
      }
      return result;
    }
    return obj;
  }

  // String substitution with multiple syntaxes
  private substituteString(str: string, context: TemplateContext): any {
    let result = str;

    // Handle different template syntaxes
    
    // 1. Simple variable substitution: ${varName}
    result = result.replace(/\$\{([^}]+)\}/g, (match, varPath) => {
      const value = this.getVariableValue(varPath.trim(), context);
      return value !== undefined ? String(value) : match;
    });

    // 2. Mustache-style: {{varName}}
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
      const value = this.getVariableValue(varPath.trim(), context);
      return value !== undefined ? String(value) : match;
    });

    // 3. Expression syntax: ${{expression}}
    result = result.replace(/\$\{\{([^}]+)\}\}/g, (match, expression) => {
      try {
        const value = this.evaluateExpression(expression.trim(), context);
        return value !== undefined ? String(value) : match;
      } catch (error) {
        return match; // Keep original if evaluation fails
      }
    });

    // 4. Conditional substitution: ${varName:defaultValue}
    result = result.replace(/\$\{([^:}]+):([^}]*)\}/g, (match, varPath, defaultValue) => {
      const value = this.getVariableValue(varPath.trim(), context);
      return value !== undefined ? String(value) : defaultValue;
    });

    // Try to parse as JSON if it looks like an object/array
    if ((result.startsWith('{') && result.endsWith('}')) || 
        (result.startsWith('[') && result.endsWith(']'))) {
      try {
        return JSON.parse(result);
      } catch {
        // If parsing fails, return as string
      }
    }

    // Try to parse as number or boolean
    if (result === 'true') return true;
    if (result === 'false') return false;
    if (result === 'null') return null;
    if (result === 'undefined') return undefined;
    
    const numberValue = Number(result);
    if (!isNaN(numberValue) && result === numberValue.toString()) {
      return numberValue;
    }

    return result;
  }

  // Get variable value from context with dot notation support
  private getVariableValue(path: string, context: TemplateContext): any {
    const keys = path.split('.');
    let current: any = context;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  // Simple expression evaluator (basic arithmetic and logic)
  private evaluateExpression(expression: string, context: TemplateContext): any {
    // Replace variables in expression
    const substituted = expression.replace(/([a-zA-Z_][a-zA-Z0-9_.]*)/g, (match) => {
      const value = this.getVariableValue(match, context);
      if (value === undefined) return match;
      return typeof value === 'string' ? `"${value}"` : String(value);
    });

    // Basic arithmetic and comparison operations
    try {
      // Use Function constructor for safer evaluation (still limited)
      // Only allow basic operations
      if (!/^[0-9+\-*/.()!&|=<> "'"`\s]+$/.test(substituted)) {
        throw new Error('Invalid expression');
      }
      
      return Function(`"use strict"; return (${substituted});`)();
    } catch (error) {
      throw new ValidationError(`Invalid expression: ${expression}`);
    }
  }

  // Build complete context for substitution
  private buildContext(
    variables: Record<string, any>, 
    partial?: Partial<TemplateContext>
  ): TemplateContext {
    const now = new Date();
    
    return {
      variables,
      environment: process.env as Record<string, string>,
      projectInfo: partial?.projectInfo || {},
      userInfo: partial?.userInfo || {},
      timestamp: {
        iso: now.toISOString(),
        unix: Math.floor(now.getTime() / 1000),
        formatted: now.toLocaleDateString()
      },
      ...partial
    };
  }

  // Validate template structure
  private validateTemplate(template: ConfigTemplate): void {
    if (!template.name || typeof template.name !== 'string') {
      throw new ValidationError('Template must have a valid name');
    }

    if (!template.version || typeof template.version !== 'string') {
      throw new ValidationError('Template must have a valid version');
    }

    if (!template.description || typeof template.description !== 'string') {
      throw new ValidationError('Template must have a description');
    }

    if (!Array.isArray(template.variables)) {
      throw new ValidationError('Template must have a variables array');
    }

    if (!template.template) {
      throw new ValidationError('Template must have a template object');
    }

    // Validate variables
    for (const variable of template.variables) {
      this.validateVariable(variable);
    }
  }

  // Validate individual variable definition
  private validateVariable(variable: TemplateVariable): void {
    if (!variable.name || typeof variable.name !== 'string') {
      throw new ValidationError('Variable must have a valid name');
    }

    if (!variable.type || !['string', 'number', 'boolean', 'array', 'object'].includes(variable.type)) {
      throw new ValidationError('Variable must have a valid type');
    }

    if (!variable.description || typeof variable.description !== 'string') {
      throw new ValidationError('Variable must have a description');
    }
  }

  // Validate variables against template requirements
  private validateVariables(template: ConfigTemplate, variables: Record<string, any>): void {
    for (const varDef of template.variables) {
      const value = variables[varDef.name];

      // Check required variables
      if (varDef.required && (value === undefined || value === null)) {
        throw new ValidationError(`Required variable '${varDef.name}' is missing`);
      }

      // Skip validation for optional undefined variables
      if (value === undefined) continue;

      // Type validation
      this.validateVariableType(varDef, value);

      // Custom validation rules
      if (varDef.validation) {
        this.validateVariableRules(varDef, value);
      }
    }
  }

  // Validate variable type
  private validateVariableType(varDef: TemplateVariable, value: any): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (actualType !== varDef.type) {
      throw new ValidationError(
        `Variable '${varDef.name}' must be of type ${varDef.type}, got ${actualType}`
      );
    }
  }

  // Validate variable against custom rules
  private validateVariableRules(varDef: TemplateVariable, value: any): void {
    const rules = varDef.validation!;

    if (rules.pattern && typeof value === 'string') {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        throw new ValidationError(
          `Variable '${varDef.name}' must match pattern: ${rules.pattern}`
        );
      }
    }

    if (rules.min !== undefined) {
      if (typeof value === 'number' && value < rules.min) {
        throw new ValidationError(
          `Variable '${varDef.name}' must be at least ${rules.min}`
        );
      }
      if (typeof value === 'string' && value.length < rules.min) {
        throw new ValidationError(
          `Variable '${varDef.name}' must be at least ${rules.min} characters`
        );
      }
    }

    if (rules.max !== undefined) {
      if (typeof value === 'number' && value > rules.max) {
        throw new ValidationError(
          `Variable '${varDef.name}' must be at most ${rules.max}`
        );
      }
      if (typeof value === 'string' && value.length > rules.max) {
        throw new ValidationError(
          `Variable '${varDef.name}' must be at most ${rules.max} characters`
        );
      }
    }

    if (rules.options && !rules.options.includes(value)) {
      throw new ValidationError(
        `Variable '${varDef.name}' must be one of: ${rules.options.join(', ')}`
      );
    }
  }
}

// Built-in template helpers
export const TemplateHelpers = {
  // Generate common configuration templates
  createProjectTemplate(
    projectName: string,
    framework: string,
    packageManager: string
  ): ConfigTemplate {
    return {
      name: `${framework}-project`,
      version: '1.0.0',
      description: `${framework} project configuration template`,
      tags: [framework, 'project', packageManager],
      variables: [
        {
          name: 'projectName',
          type: 'string',
          description: 'Name of the project',
          required: true,
          validation: {
            pattern: '^[a-z0-9-]+$'
          }
        },
        {
          name: 'port',
          type: 'number',
          description: 'Development server port',
          default: 3000,
          validation: {
            min: 1000,
            max: 65535
          }
        },
        {
          name: 'enableTesting',
          type: 'boolean',
          description: 'Enable testing setup',
          default: true
        }
      ],
      template: {
        name: '${projectName}',
        type: 'monorepo',
        packageManager,
        framework,
        dev: {
          port: '${port}',
          host: 'localhost',
          open: false,
          hmr: true
        },
        quality: {
          linting: true,
          testing: '${enableTesting}',
          coverage: {
            enabled: '${enableTesting}',
            threshold: 80
          }
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  // Create workspace template
  createWorkspaceTemplate(type: 'app' | 'package' | 'lib' | 'tool'): ConfigTemplate {
    return {
      name: `${type}-workspace`,
      version: '1.0.0',
      description: `${type} workspace configuration template`,
      tags: [type, 'workspace'],
      variables: [
        {
          name: 'workspaceName',
          type: 'string',
          description: 'Name of the workspace',
          required: true,
          validation: {
            pattern: '^[a-z0-9-]+$'
          }
        },
        {
          name: 'framework',
          type: 'string',
          description: 'Framework for the workspace',
          default: 'react-ts',
          validation: {
            options: ['react', 'react-ts', 'vue', 'vue-ts', 'svelte', 'svelte-ts']
          }
        }
      ],
      template: {
        name: '${workspaceName}',
        type,
        framework: '${framework}',
        build: {
          target: 'es2020',
          optimize: true,
          analyze: false
        }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
};

// Export singleton instance
export const templateEngine = new ConfigTemplateEngine();