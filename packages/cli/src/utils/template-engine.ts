import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { ValidationError } from './error-handler';

/**
 * Defines a variable that can be substituted within a configuration template.
 * Includes metadata describing the variable's type, default value, and validation rules.
 */
export interface TemplateVariable {
  /** The unique identifier for the variable, used in template substitution syntax. */
  name: string;
  /** The expected JavaScript type of the variable value. */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Human-readable description of what the variable represents. */
  description: string;
  /** Optional default value used when the variable is not explicitly provided. */
  default?: any;
  /** Whether the variable must be provided when rendering the template. */
  required?: boolean;
  /** Optional validation rules applied to the variable value during rendering. */
  validation?: {
    /** Regular expression pattern that string values must match. */
    pattern?: string;
    /** Minimum allowed numeric value or string length. */
    min?: number;
    /** Maximum allowed numeric value or string length. */
    max?: number;
    /** Allowed enumerable values the variable may take. */
    options?: any[];
  };
}

/**
 * Represents a complete configuration template definition.
 * A template contains metadata, variable definitions, and the templated
 * configuration body that gets rendered with substituted values.
 */
export interface ConfigTemplate {
  /** The unique name identifying this template. */
  name: string;
  /** Semantic version string of the template. */
  version: string;
  /** Human-readable description of the template's purpose. */
  description: string;
  /** Optional author or maintainer of the template. */
  author?: string;
  /** Categorization tags used for organizing and filtering templates. */
  tags: string[];
  /** Variable definitions describing inputs accepted by the template. */
  variables: TemplateVariable[];
  /** The actual configuration template with variables to be substituted during rendering. */
  template: any; // The actual configuration template with variables
  /** Optional named examples demonstrating usage of the template. */
  examples?: Record<string, unknown>;
  /** ISO timestamp marking when the template was created. */
  createdAt: string;
  /** ISO timestamp marking when the template was last updated. */
  updatedAt: string;
}

/**
 * Context object passed to the substitution engine.
 * Provides access to user-supplied variables as well as optional
 * environment, project, user, and timestamp metadata that can be
 * referenced from within template expressions.
 */
export interface TemplateContext {
  /** User-supplied variables keyed by name. */
  variables: Record<string, unknown>;
  /** Optional map of environment variables to expose during substitution. */
  environment?: Record<string, string>;
  /** Optional metadata describing the project being configured. */
  projectInfo?: {
    /** Name of the project. */
    name?: string;
    /** Type or category of the project. */
    type?: string;
    /** Semantic version of the project. */
    version?: string;
    /** Framework used by the project. */
    framework?: string;
    /** Package manager used by the project. */
    packageManager?: string;
  };
  /** Optional metadata describing the current user. */
  userInfo?: {
    /** User's display name. */
    name?: string;
    /** User's email address. */
    email?: string;
    /** User's organization. */
    organization?: string;
  };
  /** Optional precomputed timestamp values for use in templates. */
  timestamp?: {
    /** ISO-formatted timestamp string. */
    iso: string;
    /** Unix epoch seconds. */
    unix: number;
    /** Locale-formatted timestamp string. */
    formatted: string;
  };
}

/**
 * Engine for loading, validating, rendering, and persisting configuration templates.
 * Supports multiple substitution syntaxes, variable validation, and in-memory caching
 * of loaded templates.
 */
export class ConfigTemplateEngine {
  private templates: Map<string, ConfigTemplate> = new Map();
  private templatesDir: string;

  /**
   * Create a new template engine instance.
   *
   * @param templatesDir - Optional path to the directory used for template storage.
   *   Defaults to `<cwd>/.re-shell/templates` when not provided.
   */
  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(process.cwd(), '.re-shell', 'templates');
  }

  /**
   * Load and validate a template from a YAML file on disk.
   *
   * @param templatePath - Absolute or relative path to the template YAML file.
   * @returns The parsed and validated template.
   * @throws {ValidationError} If the file cannot be read or fails validation.
   */
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

  /**
   * Validate and persist a template to disk as YAML, caching it in memory.
   *
   * @param template - The template definition to save.
   * @param templatePath - Optional output file name or absolute path.
   *   When omitted, `<templatesDir>/<template.name>.template.yaml` is used.
   * @returns The full path where the template was written.
   * @throws {ValidationError} If validation or file writing fails.
   */
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

  /**
   * Enumerate all templates found in the configured templates directory.
   *
   * @returns Array of templates sorted alphabetically by name. Templates that
   *   fail to load are skipped with a warning.
   * @throws {ValidationError} If the templates directory cannot be read.
   */
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

  /**
   * Retrieve a template by name, checking the in-memory cache first
   * and falling back to disk lookup when not cached.
   *
   * @param name - The unique template name to look up.
   * @returns The matching template, or `null` when no template exists.
   */
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

  /**
   * Resolve a template by name and render it with the supplied variables,
   * performing variable validation and substitution against a fully built context.
   *
   * @param templateName - Name of the template to render.
   * @param variables - Variable values to substitute into the template.
   * @param context - Optional partial context providing project, user, and other metadata.
   * @returns The rendered template with all substitutions applied.
   * @throws {ValidationError} If the template is not found or required variables are missing.
   */
  async renderTemplate(
    templateName: string, 
    variables: Record<string, unknown>, 
    context?: Partial<TemplateContext>
  ): Promise<unknown> {
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

  /**
   * Construct a new template from an existing configuration object and
   * persist it via {@link saveTemplate}.
   *
   * @param name - Unique name for the new template.
   * @param config - Configuration object containing template substitution placeholders.
   * @param variables - Variable definitions describing the inputs accepted by the template.
   * @param options - Optional metadata including description, author, tags, and version.
   * @returns The newly created and saved template.
   */
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

  /**
   * Delete a template file from disk and remove it from the in-memory cache.
   *
   * @param name - Name of the template to delete.
   * @throws {ValidationError} If the template does not exist or deletion fails.
   */
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

  /**
   * Recursively walk a template value, substituting variables in strings,
   * array elements, and object keys/values.
   *
   * @param obj - The current node of the template being processed.
   * @param context - The fully built context used for substitution.
   * @returns The substituted value with the same structural shape as `obj`.
   */
  private substituteVariables(obj: any, context: TemplateContext): any {
    if (typeof obj === 'string') {
      return this.substituteString(obj, context);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariables(item, context));
    } else if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Allow template key substitution
        const newKey = this.substituteString(key, context);
        result[newKey] = this.substituteVariables(value, context);
      }
      return result;
    }
    return obj;
  }

  /**
   * Apply all supported substitution syntaxes to a single string and
   * coerce the result to its native type when possible.
   *
   * Supported syntaxes include `${var}`, `{{var}}`, `${{expression}}`,
   * and `${var:default}` conditional fallbacks. Results that resemble
   * JSON, numbers, booleans, `null`, or `undefined` are parsed to
   * their corresponding native values.
   *
   * @param str - The raw template string.
   * @param context - The fully built context used for substitution.
   * @returns The substituted and coerced value.
   */
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

  /**
   * Resolve a dot-notation variable path against the substitution context.
   *
   * @param path - Dot-delimited path (e.g. `variables.port`).
   * @param context - The fully built context used for lookup.
   * @returns The resolved value, or `undefined` when the path does not exist.
   */
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

  /**
   * Evaluate a simple arithmetic or logical expression after substituting
   * any referenced variables. Only basic numeric, comparison, and logical
   * operators are permitted.
   *
   * @param expression - The expression string to evaluate.
   * @param context - The fully built context used for variable substitution.
   * @returns The result of evaluating the expression.
   * @throws {ValidationError} If the expression contains disallowed syntax or fails to evaluate.
   */
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

  /**
   * Merge user-supplied variables with default environment, project,
   * user, and timestamp values to produce a complete substitution context.
   *
   * @param variables - User-supplied variable values.
   * @param partial - Optional partial context overriding default metadata.
   * @returns A fully populated template context.
   */
  private buildContext(
    variables: Record<string, unknown>, 
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

  /**
   * Validate that a template has the required structural fields and
   * that each declared variable is itself well-formed.
   *
   * @param template - The template to validate.
   * @throws {ValidationError} If any required field is missing or invalid.
   */
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

  /**
   * Validate that an individual variable definition has a valid name,
   * supported type, and a non-empty description.
   *
   * @param variable - The variable definition to validate.
   * @throws {ValidationError} If the variable definition is incomplete or invalid.
   */
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

  /**
   * Validate a set of supplied variable values against a template's
   * requirements, checking presence of required variables, type
   * conformance, and any custom validation rules.
   *
   * @param template - The template whose variable definitions drive validation.
   * @param variables - The user-supplied variable values to validate.
   * @throws {ValidationError} If a required variable is missing or a value fails validation.
   */
  private validateVariables(template: ConfigTemplate, variables: Record<string, unknown>): void {
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

  /**
   * Validate that a supplied value matches the declared type of a variable.
   *
   * @param varDef - The variable definition specifying the expected type.
   * @param value - The value supplied for the variable.
   * @throws {ValidationError} If the value's type does not match the declared type.
   */
  private validateVariableType(varDef: TemplateVariable, value: any): void {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (actualType !== varDef.type) {
      throw new ValidationError(
        `Variable '${varDef.name}' must be of type ${varDef.type}, got ${actualType}`
      );
    }
  }

  /**
   * Validate a variable value against any custom validation rules
   * declared on its definition, including regex patterns, min/max
   * bounds, and enumerable option sets.
   *
   * @param varDef - The variable definition containing validation rules.
   * @param value - The value supplied for the variable.
   * @throws {ValidationError} If the value violates any declared validation rule.
   */
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

/**
 * Collection of built-in helper factories that produce common
 * {@link ConfigTemplate} instances for projects and workspaces.
 */
export const TemplateHelpers = {
  /**
   * Build a project configuration template for a given framework and package manager.
   *
   * @param projectName - Name of the project (also used as the default value for the `projectName` variable).
   * @param framework - Target framework for the project (e.g. `react`, `vue`).
   * @param packageManager - Package manager used by the project (e.g. `npm`, `pnpm`).
   * @returns A populated project configuration template.
   */
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

  /**
   * Build a workspace configuration template for a given workspace type.
   *
   * @param type - Category of the workspace (`app`, `package`, `lib`, or `tool`).
   * @returns A populated workspace configuration template.
   */
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

/**
 * Shared singleton instance of {@link ConfigTemplateEngine} using the default
 * templates directory. Useful when a single engine should be reused across
 * the application.
 */
export const templateEngine = new ConfigTemplateEngine();