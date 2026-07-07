import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { ValidationError } from './error-handler';
import { WorkspaceDefinition, WorkspaceEntry, WorkspaceTypeConfig } from './workspace-schema';

/**
 * Represents a workspace template definition that can be applied to generate
 * workspace configurations. Templates support variable substitution, inheritance,
 * and provide sensible defaults for workspace entries.
 */
export interface WorkspaceTemplate {
  /** Unique identifier name of the template. */
  name: string;
  /** Optional human-readable description of the template's purpose. */
  description?: string;
  /** Semantic version string of the template (e.g. "1.0.0"). */
  version: string;
  /** Optional name of a parent template to inherit configuration from. */
  extends?: string;
  /** Optional list of variables that consumers of the template must or may supply. */
  variables?: TemplateVariable[];
  /** Optional default values applied to workspace entries created from this template. */
  workspaceDefaults?: Partial<WorkspaceEntry>;
  /** Optional map of workspace type names to their default configuration. */
  typeDefaults?: Record<string, Partial<WorkspaceTypeConfig>>;
  /** Optional list of glob patterns describing the workspace structure (e.g. "apps/*"). */
  patterns?: string[];
  /** Optional map of dependency names to version specifiers. */
  dependencies?: Record<string, any>;
  /** Optional map of script names to their command strings. */
  scripts?: Record<string, any>;
  /** Optional free-form metadata associated with the template. */
  metadata?: Record<string, any>;
}

/**
 * Describes a single variable that a template accepts, including its type,
 * validation rules, and default value.
 */
export interface TemplateVariable {
  /** The variable name used for `{{name}}` substitution and lookup. */
  name: string;
  /** Optional human-readable description of the variable. */
  description?: string;
  /** The expected JavaScript type of the variable value. */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Optional default value used when the variable is not provided. */
  default?: any;
  /** Whether the variable must be supplied by the consumer. Defaults to false. */
  required?: boolean;
  /** Optional list of allowed values the variable may take. */
  enum?: any[];
  /** Optional regex pattern (as a string) that string-typed values must match. */
  pattern?: string;
}

/**
 * Context object supplied when applying a template, carrying variable values
 * and optionally a target workspace and definition.
 */
export interface TemplateContext {
  /** Map of variable names to their resolved values for substitution. */
  variables: Record<string, any>;
  /** Optional target workspace entry to receive the template's workspace defaults. */
  workspace?: WorkspaceEntry;
  /** Optional originating workspace definition, when applicable. */
  definition?: WorkspaceDefinition;
}

/**
 * Result of resolving a template's inheritance chain, including the ordered
 * list of ancestor templates, merged variable definitions, and the fully
 * merged template.
 */
export interface InheritanceChain {
  /** Ordered list of templates in the chain, starting from the root parent. */
  templates: WorkspaceTemplate[];
  /** Map of variable names to their merged definitions across the chain. */
  variables: Record<string, TemplateVariable>;
  /** The fully merged template after applying all ancestors in order. */
  merged: WorkspaceTemplate;
}

/**
 * On-disk registry tracking all known templates along with versioning and
 * timestamp metadata.
 */
export interface TemplateRegistry {
  /** Schema version of the registry file. */
  version: string;
  /** Map of template names to their definitions. */
  templates: Record<string, WorkspaceTemplate>;
  /** Metadata describing the registry's lifecycle. */
  metadata: {
    /** ISO timestamp of when the registry was first created. */
    created: string;
    /** ISO timestamp of the most recent modification. */
    modified: string;
    /** Number of templates currently stored in the registry. */
    count: number;
  };
}

/**
 * Manager for workspace templates. Handles loading, creating, listing,
 * deleting, and applying templates, as well as resolving inheritance chains
 * and performing variable substitution.
 */
export class WorkspaceTemplateManager {
  private templatesPath: string;
  private registry: TemplateRegistry;
  private templateCache: Map<string, WorkspaceTemplate> = new Map();

  /**
   * Creates a new WorkspaceTemplateManager rooted at the given project path.
   *
   * @param rootPath - Project root directory. Defaults to the current working directory.
   */
  constructor(rootPath: string = process.cwd()) {
    this.templatesPath = path.join(rootPath, '.re-shell', 'templates');
    this.registry = this.createDefaultRegistry();
  }

  /**
   * Initializes the template system by ensuring the templates directory exists,
   * loading the existing registry, and seeding built-in templates.
   *
   * @returns Resolves once initialization is complete.
   */
  async init(): Promise<void> {
    await fs.ensureDir(this.templatesPath);
    await this.loadRegistry();
    await this.loadBuiltInTemplates();
  }

  /**
   * Loads the template registry from disk, creating a default registry if the
   * file does not exist or fails to parse.
   *
   * @returns Resolves once the registry has been loaded or initialized.
   */
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

  /**
   * Persists the current registry to disk, updating its modification timestamp
   * and template count.
   *
   * @returns Resolves once the registry file has been written.
   */
  async saveRegistry(): Promise<void> {
    const registryPath = path.join(this.templatesPath, 'registry.json');
    this.registry.metadata.modified = new Date().toISOString();
    this.registry.metadata.count = Object.keys(this.registry.templates).length;

    await fs.writeJson(registryPath, this.registry, { spaces: 2 });
  }

  /**
   * Creates and persists a new template after validating it and confirming
   * no existing template shares its name.
   *
   * @param template - The template definition to register.
   * @returns Resolves once the template has been written and the registry updated.
   * @throws {ValidationError} If the template is invalid or a template with the same name exists.
   */
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

  /**
   * Retrieves a template by name, using an in-memory cache to avoid repeated
   * disk reads on subsequent lookups.
   *
   * @param name - Name of the template to retrieve.
   * @returns The matching template, or `null` if it cannot be found or loaded.
   */
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

  /**
   * Lists all templates currently registered, resolving each from disk (or
   * cache).
   *
   * @returns An array of all registered templates. Templates that fail to
   * load are omitted from the result.
   */
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

  /**
   * Deletes a template by name. Refuses to delete templates that other
   * templates extend.
   *
   * @param name - Name of the template to delete.
   * @returns Resolves once the template file and registry entry have been removed.
   * @throws {ValidationError} If the template does not exist or is extended by other templates.
   */
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

  /**
   * Applies a named template against the supplied context, resolving its
   * inheritance chain, validating variables, and producing a partial workspace
   * definition with substituted values.
   *
   * @param templateName - Name of the template to apply.
   * @param context - Context providing variable values and optional target workspace.
   * @returns A partial workspace definition derived from the template.
   * @throws {ValidationError} If the template is missing, variables are invalid, or inheritance fails.
   */
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

  /**
   * Resolves the full inheritance chain for the given template, walking up the
   * `extends` references and merging variables and configuration along the way.
   *
   * @param templateName - Name of the template whose chain should be resolved.
   * @returns The resolved inheritance chain including merged variables and template.
   * @throws {ValidationError} If a referenced template is missing or a circular inheritance is detected.
   */
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

  /**
   * Merges a chain of templates into a single combined template, with child
   * templates overriding their parents for scalar fields while arrays and
   * maps are concatenated or shallow-merged.
   *
   * @param templates - Ordered templates to merge, parents first.
   * @returns The merged template.
   */
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

  /**
   * Applies a merged template against the supplied context, producing a partial
   * workspace definition and mutating the context's workspace with defaults.
   *
   * @param template - The merged template to apply.
   * @param context - Context providing variable values and optional target workspace.
   * @returns A partial workspace definition with substituted values.
   */
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
      ) as WorkspaceDefinition['dependencies'];
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

  /**
   * Validates a template definition, ensuring required fields are present,
   * variable definitions are well-formed, and self-inheritance is avoided.
   *
   * @param template - The template to validate.
   * @throws {ValidationError} If any validation rule is violated.
   */
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

  /**
   * Validates a single variable definition, ensuring it has a name, an allowed
   * type, a default value consistent with its enum, and a pattern only when
   * string-typed.
   *
   * @param variable - The variable definition to validate.
   * @throws {ValidationError} If the variable definition is invalid.
   */
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

  /**
   * Validates a set of supplied variable values against the variable
   * definitions declared by a template, checking requiredness, types,
   * enum membership, and pattern conformance.
   *
   * @param definitions - Map of variable names to their declared definitions.
   * @param values - Map of variable names to supplied values.
   * @throws {ValidationError} If any value fails validation.
   */
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

  /**
   * Determines whether a value matches the declared variable type.
   *
   * @param value - The value to inspect.
   * @param type - The declared type (one of string, number, boolean, array, object).
   * @returns `true` if the value's runtime type matches `type`; otherwise `false`.
   */
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

  /**
   * Recursively walks an arbitrary value and substitutes `{{name}}` placeholders
   * in any nested strings using the provided variable map.
   *
   * @param obj - The value to process (string, array, object, or primitive).
   * @param variables - Map of variable names to their resolved values.
   * @returns A new value of the same shape with substitutions applied.
   */
  private substituteVariables(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.substituteString(obj, variables);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.substituteVariables(item, variables));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteVariables(value, variables);
      }
      return result;
    }
    
    return obj;
  }

  /**
   * Replaces `{{name}}` placeholders in a string with the corresponding values
   * from the provided variable map. Unknown placeholders are left unchanged.
   *
   * @param str - The string containing zero or more placeholders.
   * @param variables - Map of variable names to their resolved values.
   * @returns The string with matching placeholders replaced.
   */
  private substituteString(str: string, variables: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (varName in variables) {
        return String(variables[varName]);
      }
      return match;
    });
  }

  /**
   * Returns the names of all templates that extend the given template, used to
   * prevent deletion of templates that are still depended upon.
   *
   * @param templateName - Name of the potential parent template.
   * @returns Array of template names that extend `templateName`.
   */
  private async findDependentTemplates(templateName: string): Promise<string[]> {
    const dependents: string[] = [];
    
    for (const template of await this.listTemplates()) {
      if (template.extends === templateName) {
        dependents.push(template.name);
      }
    }
    
    return dependents;
  }

  /**
   * Seeds the registry with built-in templates (microfrontend, library,
   * service, monorepo) the first time the manager is initialized. Existing
   * templates with the same name are preserved.
   *
   * @returns Resolves once all built-in templates have been considered.
   */
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

  /**
   * Builds the built-in "microfrontend" template, defining a standard
   * microfrontend application with framework selection and dev port.
   *
   * @returns The microfrontend template definition.
   */
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

  /**
   * Builds the built-in "library" template, defining a shared library with
   * a configurable library type.
   *
   * @returns The library template definition.
   */
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

  /**
   * Builds the built-in "service" template, defining a backend service with
   * runtime selection. This template extends the "base" template.
   *
   * @returns The service template definition.
   */
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

  /**
   * Builds the built-in "monorepo" template, defining a full monorepo layout
   * with workspace patterns, type defaults, and package-manager-aware scripts.
   *
   * @returns The monorepo template definition.
   */
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

  /**
   * Creates a fresh, empty registry with current timestamps, ready for first
   * use.
   *
   * @returns A default TemplateRegistry instance.
   */
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

/**
 * Factory helper that constructs a WorkspaceTemplateManager rooted at the
 * given path and initializes it (ensuring directories, loading the registry,
 * and seeding built-in templates).
 *
 * @param rootPath - Optional project root directory. Defaults to the current working directory.
 * @returns A promise resolving to the initialized WorkspaceTemplateManager.
 */
export async function createWorkspaceTemplateManager(
  rootPath?: string
): Promise<WorkspaceTemplateManager> {
  const manager = new WorkspaceTemplateManager(rootPath);
  await manager.init();
  return manager;
}

/**
 * Converts an existing workspace definition into a reusable WorkspaceTemplate,
 * copying its patterns, type defaults, and scripts, and tagging the result
 * with export metadata.
 *
 * @param definition - The source workspace definition to export from.
 * @param templateName - Name to assign to the generated template.
 * @param variables - Optional list of variable definitions to expose on the template.
 * @returns A promise resolving to the generated WorkspaceTemplate.
 */
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