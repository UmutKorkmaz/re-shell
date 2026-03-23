import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';
import * as handlebars from 'handlebars';
import * as yaml from 'js-yaml';

export interface Template {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  repository?: string;
  tags: string[];
  category: TemplateCategory;
  extends?: string[];
  implements?: string[];
  requires?: TemplateRequirement[];
  variables: TemplateVariable[];
  files: TemplateFile[];
  hooks: TemplateHook[];
  metadata: {
    created: Date;
    updated: Date;
    downloads?: number;
    rating?: number;
    verified?: boolean;
  };
}

export enum TemplateCategory {
  MICROFRONTEND = 'microfrontend',
  BACKEND = 'backend',
  FULLSTACK = 'fullstack',
  LIBRARY = 'library',
  APPLICATION = 'application',
  SERVICE = 'service',
  COMPONENT = 'component',
  CONFIGURATION = 'configuration',
  INFRASTRUCTURE = 'infrastructure',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  CUSTOM = 'custom'
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'choice';
  description: string;
  default?: any;
  required: boolean;
  choices?: any[];
  pattern?: string;
  transform?: string;
  when?: string;
  validate?: string;
  group?: string;
}

export interface TemplateFile {
  source: string;
  destination: string;
  condition?: string;
  transform?: 'handlebars' | 'ejs' | 'none';
  permissions?: string;
  encoding?: string;
  merge?: boolean;
  mergeStrategy?: 'override' | 'append' | 'prepend' | 'deep' | 'custom';
  mergeCustom?: string;
}

export interface TemplateHook {
  type: HookType;
  name: string;
  description?: string;
  command?: string;
  script?: string;
  condition?: string;
  timeout?: number;
  allowFailure?: boolean;
  environment?: Record<string, string>;
}

export enum HookType {
  BEFORE_INSTALL = 'before_install',
  AFTER_INSTALL = 'after_install',
  BEFORE_PROCESS = 'before_process',
  AFTER_PROCESS = 'after_process',
  BEFORE_FILE = 'before_file',
  AFTER_FILE = 'after_file',
  VALIDATE = 'validate',
  CLEANUP = 'cleanup'
}

export interface TemplateRequirement {
  type: 'template' | 'package' | 'command' | 'file' | 'environment';
  name: string;
  version?: string;
  condition?: string;
  message?: string;
}

export interface TemplateContext {
  variables: Record<string, any>;
  template: Template;
  parentTemplates?: Template[];
  interfaces?: Template[];
  projectPath: string;
  timestamp: Date;
  user?: {
    name?: string;
    email?: string;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
  };
}

export interface ProcessedTemplate {
  template: Template;
  mergedVariables: Record<string, any>;
  processedFiles: Array<{
    source: string;
    destination: string;
    content?: string;
    processed: boolean;
    error?: string;
  }>;
  executedHooks: Array<{
    hook: TemplateHook;
    success: boolean;
    output?: string;
    error?: string;
    duration: number;
  }>;
  inheritanceChain: string[];
  warnings: string[];
  errors: string[];
}

export class TemplateEngine extends EventEmitter {
  private templates: Map<string, Template> = new Map();
  private templateCache: Map<string, ProcessedTemplate> = new Map();
  private handlebarsInstance: typeof handlebars;
  
  constructor(
    private templatePaths: string[] = [],
    private options: {
      enableCache?: boolean;
      enableRemoteTemplates?: boolean;
      templateRegistry?: string;
      customHelpers?: Record<string, (...args: any[]) => any>;
      strictMode?: boolean;
    } = {}
  ) {
    super();
    this.handlebarsInstance = handlebars.create();
    this.registerBuiltinHelpers();
    this.registerCustomHelpers();
    this.loadTemplates();
  }

  private registerBuiltinHelpers(): void {
    // String helpers
    this.handlebarsInstance.registerHelper('lowercase', (str: string) => str?.toLowerCase());
    this.handlebarsInstance.registerHelper('uppercase', (str: string) => str?.toUpperCase());
    this.handlebarsInstance.registerHelper('capitalize', (str: string) => 
      str?.charAt(0).toUpperCase() + str?.slice(1));
    this.handlebarsInstance.registerHelper('camelCase', (str: string) => 
      str?.replace(/[-_\s]+(.)?/g, (_, c) => c?.toUpperCase() || ''));
    this.handlebarsInstance.registerHelper('kebabCase', (str: string) => 
      str?.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, ''));
    this.handlebarsInstance.registerHelper('snakeCase', (str: string) => 
      str?.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, ''));
    
    // Logic helpers
    this.handlebarsInstance.registerHelper('eq', (a: any, b: any) => a === b);
    this.handlebarsInstance.registerHelper('ne', (a: any, b: any) => a !== b);
    this.handlebarsInstance.registerHelper('lt', (a: any, b: any) => a < b);
    this.handlebarsInstance.registerHelper('gt', (a: any, b: any) => a > b);
    this.handlebarsInstance.registerHelper('lte', (a: any, b: any) => a <= b);
    this.handlebarsInstance.registerHelper('gte', (a: any, b: any) => a >= b);
    this.handlebarsInstance.registerHelper('and', (...args: any[]) => {
      const values = args.slice(0, -1); // Remove options object
      return values.every(v => v);
    });
    this.handlebarsInstance.registerHelper('or', (...args: any[]) => {
      const values = args.slice(0, -1); // Remove options object
      return values.some(v => v);
    });
    this.handlebarsInstance.registerHelper('not', (value: any) => !value);
    
    // Array helpers
    this.handlebarsInstance.registerHelper('includes', (array: any[], value: any) => 
      Array.isArray(array) && array.includes(value));
    this.handlebarsInstance.registerHelper('join', (array: any[], separator: string) => 
      Array.isArray(array) ? array.join(separator || ', ') : '');
    
    // Date helpers
    this.handlebarsInstance.registerHelper('year', () => new Date().getFullYear());
    this.handlebarsInstance.registerHelper('date', () => new Date().toISOString());
    
    // JSON helpers
    this.handlebarsInstance.registerHelper('json', (obj: any) => JSON.stringify(obj, null, 2));
    this.handlebarsInstance.registerHelper('jsonParse', (str: string) => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    });
  }

  private registerCustomHelpers(): void {
    if (this.options.customHelpers) {
      for (const [name, helper] of Object.entries(this.options.customHelpers)) {
        this.handlebarsInstance.registerHelper(name, helper);
      }
    }
  }

  private async loadTemplates(): Promise<void> {
    for (const templatePath of this.templatePaths) {
      try {
        if (await fs.pathExists(templatePath)) {
          await this.loadTemplatesFromDirectory(templatePath);
        }
      } catch (error) {
        this.emit('error', { type: 'load', path: templatePath, error });
      }
    }

    // Load remote templates if enabled
    if (this.options.enableRemoteTemplates && this.options.templateRegistry) {
      await this.loadRemoteTemplates();
    }
  }

  private async loadTemplatesFromDirectory(directory: string): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const templatePath = path.join(directory, entry.name);
        const manifestPath = path.join(templatePath, 'template.yaml');
        
        if (await fs.pathExists(manifestPath)) {
          try {
            const manifest = await fs.readFile(manifestPath, 'utf8');
            const template = yaml.load(manifest) as Template;
            
            // Validate and enhance template
            template.id = template.id || entry.name;
            template.metadata = {
              ...template.metadata,
              created: new Date(template.metadata?.created || Date.now()),
              updated: new Date(template.metadata?.updated || Date.now())
            };
            
            // Resolve file paths
            template.files = template.files.map(file => ({
              ...file,
              source: path.isAbsolute(file.source) 
                ? file.source 
                : path.join(templatePath, file.source)
            }));
            
            this.templates.set(template.id, template);
            this.emit('template:loaded', template);
          } catch (error) {
            this.emit('error', { type: 'parse', path: manifestPath, error });
          }
        }
      }
    }
  }

  private async loadRemoteTemplates(): Promise<void> {
    // TODO: Implement remote template loading from registry
    this.emit('info', 'Remote template loading not yet implemented');
  }

  async registerTemplate(template: Template): Promise<void> {
    // Validate template
    const validation = await this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    this.templates.set(template.id, template);
    this.emit('template:registered', template);
  }

  async processTemplate(
    templateId: string,
    context: Partial<TemplateContext>
  ): Promise<ProcessedTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    // Build complete context
    const fullContext = await this.buildContext(template, context);
    
    // Process inheritance chain
    const { mergedTemplate, inheritanceChain } = await this.resolveInheritance(template);
    
    // Process interfaces
    const interfaceTemplates = await this.resolveInterfaces(mergedTemplate);
    
    // Merge variables from inheritance chain and interfaces
    const mergedVariables = await this.mergeVariables(
      mergedTemplate,
      inheritanceChain,
      interfaceTemplates,
      fullContext.variables
    );

    // Update context with merged data
    fullContext.variables = mergedVariables;
    fullContext.template = mergedTemplate;
    fullContext.parentTemplates = inheritanceChain.slice(1).map(id => this.templates.get(id)!);
    fullContext.interfaces = interfaceTemplates;

    // Initialize result
    const result: ProcessedTemplate = {
      template: mergedTemplate,
      mergedVariables,
      processedFiles: [],
      executedHooks: [],
      inheritanceChain: inheritanceChain.map(t => t),
      warnings: [],
      errors: []
    };

    try {
      // Execute before hooks
      await this.executeHooks(mergedTemplate, HookType.BEFORE_PROCESS, fullContext, result);

      // Process files
      for (const file of mergedTemplate.files) {
        await this.processFile(file, fullContext, result);
      }

      // Execute after hooks
      await this.executeHooks(mergedTemplate, HookType.AFTER_PROCESS, fullContext, result);

      // Cache if enabled
      if (this.options.enableCache) {
        const cacheKey = this.getCacheKey(templateId, fullContext);
        this.templateCache.set(cacheKey, result);
      }

      this.emit('template:processed', result);
      return result;

    } catch (error: any) {
      result.errors.push(error.message);
      this.emit('template:error', { template, error, result });
      throw error;
    }
  }

  private async buildContext(
    template: Template,
    partial: Partial<TemplateContext>
  ): Promise<TemplateContext> {
    return {
      variables: partial.variables || {},
      template,
      projectPath: partial.projectPath || process.cwd(),
      timestamp: new Date(),
      user: partial.user || {
        name: process.env.USER || process.env.USERNAME,
        email: process.env.GIT_AUTHOR_EMAIL
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      },
      ...partial
    };
  }

  private async resolveInheritance(
    template: Template,
    visited: Set<string> = new Set()
  ): Promise<{ mergedTemplate: Template; inheritanceChain: string[] }> {
    const inheritanceChain: string[] = [template.id];
    
    if (visited.has(template.id)) {
      throw new Error(`Circular inheritance detected: ${template.id}`);
    }
    visited.add(template.id);

    if (!template.extends || template.extends.length === 0) {
      return { mergedTemplate: template, inheritanceChain };
    }

    // Deep clone template
    let mergedTemplate = JSON.parse(JSON.stringify(template));

    // Process each parent template
    for (const parentId of template.extends) {
      const parentTemplate = this.templates.get(parentId);
      if (!parentTemplate) {
        throw new Error(`Parent template '${parentId}' not found`);
      }

      // Recursively resolve parent's inheritance
      const { mergedTemplate: resolvedParent, inheritanceChain: parentChain } = 
        await this.resolveInheritance(parentTemplate, visited);

      // Merge parent into current template
      mergedTemplate = this.mergeTemplates(resolvedParent, mergedTemplate);
      inheritanceChain.push(...parentChain);
    }

    return { mergedTemplate, inheritanceChain: [...new Set(inheritanceChain)] };
  }

  private async resolveInterfaces(template: Template): Promise<Template[]> {
    if (!template.implements || template.implements.length === 0) {
      return [];
    }

    const interfaces: Template[] = [];
    
    for (const interfaceId of template.implements) {
      const interfaceTemplate = this.templates.get(interfaceId);
      if (!interfaceTemplate) {
        throw new Error(`Interface template '${interfaceId}' not found`);
      }
      interfaces.push(interfaceTemplate);
    }

    return interfaces;
  }

  private mergeTemplates(parent: Template, child: Template): Template {
    // Deep merge templates with child taking precedence
    const merged: Template = {
      ...parent,
      ...child,
      variables: this.mergeArrays(parent.variables, child.variables, 'name'),
      files: this.mergeArrays(parent.files, child.files, 'destination'),
      hooks: [...parent.hooks, ...child.hooks],
      tags: [...new Set([...parent.tags, ...child.tags])],
      requires: this.mergeArrays(parent.requires || [], child.requires || [], 'name')
    };

    return merged;
  }

  private mergeArrays<T extends { [key: string]: any }>(
    parent: T[],
    child: T[],
    keyField: keyof T
  ): T[] {
    const merged = new Map<any, T>();
    
    // Add parent items
    for (const item of parent) {
      merged.set(item[keyField], item);
    }
    
    // Override with child items
    for (const item of child) {
      merged.set(item[keyField], item);
    }
    
    return Array.from(merged.values());
  }

  private async mergeVariables(
    template: Template,
    inheritanceChain: string[],
    interfaces: Template[],
    userVariables: Record<string, any>
  ): Promise<Record<string, any>> {
    const merged: Record<string, any> = {};

    // Start with template defaults
    for (const variable of template.variables) {
      if (variable.default !== undefined) {
        merged[variable.name] = variable.default;
      }
    }

    // Apply interface requirements
    for (const interfaceTemplate of interfaces) {
      for (const variable of interfaceTemplate.variables) {
        if (variable.required && !(variable.name in merged)) {
          throw new Error(
            `Interface '${interfaceTemplate.id}' requires variable '${variable.name}'`
          );
        }
      }
    }

    // Apply user overrides
    for (const [key, value] of Object.entries(userVariables)) {
      merged[key] = value;
    }

    // Validate all required variables are present
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in merged)) {
        throw new Error(`Required variable '${variable.name}' not provided`);
      }

      // Apply transformations
      if (variable.transform && variable.name in merged) {
        merged[variable.name] = await this.transformValue(
          merged[variable.name],
          variable.transform
        );
      }

      // Validate value
      if (variable.name in merged) {
        const validation = await this.validateVariable(variable, merged[variable.name]);
        if (!validation.valid) {
          throw new Error(
            `Invalid value for '${variable.name}': ${validation.error}`
          );
        }
      }
    }

    return merged;
  }

  private async transformValue(value: any, transform: string): Promise<any> {
    // Execute transformation function
    try {
      const fn = new Function('value', transform);
      return fn(value);
    } catch (error: any) {
      throw new Error(`Transform failed: ${error.message}`);
    }
  }

  private async validateVariable(
    variable: TemplateVariable,
    value: any
  ): Promise<{ valid: boolean; error?: string }> {
    // Type validation
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== variable.type && variable.type !== 'choice') {
      return { 
        valid: false, 
        error: `Expected ${variable.type}, got ${actualType}` 
      };
    }

    // Choice validation
    if (variable.type === 'choice' && variable.choices) {
      if (!variable.choices.includes(value)) {
        return {
          valid: false,
          error: `Must be one of: ${variable.choices.join(', ')}`
        };
      }
    }

    // Pattern validation
    if (variable.pattern && typeof value === 'string') {
      const regex = new RegExp(variable.pattern);
      if (!regex.test(value)) {
        return {
          valid: false,
          error: `Does not match pattern: ${variable.pattern}`
        };
      }
    }

    // Custom validation
    if (variable.validate) {
      try {
        const fn = new Function('value', variable.validate);
        const result = fn(value);
        if (result !== true) {
          return {
            valid: false,
            error: typeof result === 'string' ? result : 'Validation failed'
          };
        }
      } catch (error: any) {
        return {
          valid: false,
          error: `Validation error: ${error.message}`
        };
      }
    }

    return { valid: true };
  }

  private async processFile(
    file: TemplateFile,
    context: TemplateContext,
    result: ProcessedTemplate
  ): Promise<void> {
    // Check condition
    if (file.condition) {
      const shouldProcess = await this.evaluateCondition(file.condition, context);
      if (!shouldProcess) {
        return;
      }
    }

    const processedFile = {
      source: file.source,
      destination: this.resolvePath(file.destination, context),
      content: undefined as string | undefined,
      processed: false,
      error: undefined as string | undefined
    };

    try {
      // Execute before file hook
      await this.executeHooks(
        context.template,
        HookType.BEFORE_FILE,
        { ...context, file },
        result
      );

      // Read source file
      const sourceContent = await fs.readFile(file.source, (file.encoding || 'utf8') as BufferEncoding);

      // Process content based on transform type
      let processedContent: string;
      switch (file.transform || 'handlebars') {
        case 'handlebars':
          processedContent = this.handlebarsInstance.compile(sourceContent)(context.variables);
          break;
        case 'ejs':
          // TODO: Implement EJS processing
          processedContent = sourceContent;
          break;
        case 'none':
          processedContent = sourceContent;
          break;
        default:
          processedContent = sourceContent;
      }

      processedFile.content = processedContent;

      // Handle file writing based on merge strategy
      const destPath = processedFile.destination;
      const destDir = path.dirname(destPath);
      await fs.ensureDir(destDir);

      if (file.merge && await fs.pathExists(destPath)) {
        processedContent = await this.mergeFileContent(
          destPath,
          processedContent,
          file.mergeStrategy || 'override',
          file.mergeCustom
        );
      }

      // Write file
      await fs.writeFile(destPath, processedContent, (file.encoding || 'utf8') as BufferEncoding);

      // Set permissions if specified
      if (file.permissions) {
        await fs.chmod(destPath, file.permissions);
      }

      processedFile.processed = true;

      // Execute after file hook
      await this.executeHooks(
        context.template,
        HookType.AFTER_FILE,
        { ...context, file },
        result
      );

    } catch (error: any) {
      processedFile.error = error.message;
      result.errors.push(`Failed to process ${file.source}: ${error.message}`);
    }

    result.processedFiles.push(processedFile);
  }

  private async mergeFileContent(
    existingPath: string,
    newContent: string,
    strategy: string,
    customStrategy?: string
  ): Promise<string> {
    const existingContent = await fs.readFile(existingPath, 'utf8');

    switch (strategy) {
      case 'override':
        return newContent;
      
      case 'append':
        return existingContent + '\n' + newContent;
      
      case 'prepend':
        return newContent + '\n' + existingContent;
      
      case 'deep':
        // Try to parse as JSON and deep merge
        try {
          const existing = JSON.parse(existingContent);
          const newData = JSON.parse(newContent);
          return JSON.stringify(this.deepMerge(existing, newData), null, 2);
        } catch {
          // Fall back to append if not JSON
          return existingContent + '\n' + newContent;
        }
      
      case 'custom':
        if (customStrategy) {
          try {
            const fn = new Function('existing', 'new', customStrategy);
            return fn(existingContent, newContent);
          } catch (error: any) {
            throw new Error(`Custom merge failed: ${error.message}`);
          }
        }
        return newContent;
      
      default:
        return newContent;
    }
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private async executeHooks(
    template: Template,
    type: HookType,
    context: TemplateContext & any,
    result: ProcessedTemplate
  ): Promise<void> {
    const hooks = template.hooks.filter(h => h.type === type);

    for (const hook of hooks) {
      // Check condition
      if (hook.condition) {
        const shouldExecute = await this.evaluateCondition(hook.condition, context);
        if (!shouldExecute) {
          continue;
        }
      }

      const startTime = Date.now();
      const executedHook = {
        hook,
        success: false,
        output: undefined as string | undefined,
        error: undefined as string | undefined,
        duration: 0
      };

      try {
        let output = '';

        if (hook.command) {
          // Execute shell command

          const env = {
            ...process.env,
            ...hook.environment,
            ...this.createHookEnvironment(context)
          };

          output = execSync(hook.command, {
            cwd: context.projectPath,
            env,
            timeout: hook.timeout || 30000,
            encoding: 'utf8'
          });
        } else if (hook.script) {
          // Execute JavaScript
          const fn = new Function('context', 'require', hook.script);
          const result = await fn(context, require);
          output = String(result || '');
        }

        executedHook.success = true;
        executedHook.output = output;

      } catch (error: any) {
        executedHook.error = error.message;
        
        if (!hook.allowFailure) {
          throw error;
        }
        
        result.warnings.push(`Hook '${hook.name}' failed: ${error.message}`);
      }

      executedHook.duration = Date.now() - startTime;
      result.executedHooks.push(executedHook);
    }
  }

  private createHookEnvironment(context: TemplateContext): Record<string, string> {
    const env: Record<string, string> = {};
    
    // Add all variables as environment variables
    for (const [key, value] of Object.entries(context.variables)) {
      env[`TEMPLATE_VAR_${key.toUpperCase()}`] = String(value);
    }

    // Add context information
    env.TEMPLATE_ID = context.template.id;
    env.TEMPLATE_NAME = context.template.name;
    env.TEMPLATE_VERSION = context.template.version;
    env.PROJECT_PATH = context.projectPath;
    env.TIMESTAMP = context.timestamp.toISOString();

    return env;
  }

  private async evaluateCondition(
    condition: string,
    context: TemplateContext
  ): Promise<boolean> {
    try {
      const fn = new Function('context', `return ${condition}`);
      return Boolean(fn(context));
    } catch (error: any) {
      throw new Error(`Invalid condition: ${error.message}`);
    }
  }

  private resolvePath(pathTemplate: string, context: TemplateContext): string {
    // Replace variables in path
    let resolved = pathTemplate;
    
    for (const [key, value] of Object.entries(context.variables)) {
      resolved = resolved.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
    }

    // Make path absolute
    if (!path.isAbsolute(resolved)) {
      resolved = path.join(context.projectPath, resolved);
    }

    return resolved;
  }

  private getCacheKey(templateId: string, context: TemplateContext): string {
    const variables = JSON.stringify(context.variables);

    return crypto
      .createHash('sha256')
      .update(`${templateId}:${variables}`)
      .digest('hex');
  }

  async validateTemplate(template: Template): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Required fields
    if (!template.id) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.version) errors.push('Template version is required');
    if (!template.category) errors.push('Template category is required');
    if (!template.files || template.files.length === 0) {
      errors.push('Template must have at least one file');
    }

    // Validate extends
    if (template.extends) {
      for (const parentId of template.extends) {
        if (!this.templates.has(parentId)) {
          errors.push(`Parent template '${parentId}' not found`);
        }
      }
    }

    // Validate implements
    if (template.implements) {
      for (const interfaceId of template.implements) {
        if (!this.templates.has(interfaceId)) {
          errors.push(`Interface template '${interfaceId}' not found`);
        }
      }
    }

    // Validate files
    for (const file of template.files || []) {
      if (!file.source) errors.push('File source is required');
      if (!file.destination) errors.push('File destination is required');
    }

    // Validate variables
    const variableNames = new Set<string>();
    for (const variable of template.variables || []) {
      if (!variable.name) errors.push('Variable name is required');
      if (!variable.type) errors.push('Variable type is required');
      
      if (variableNames.has(variable.name)) {
        errors.push(`Duplicate variable name: ${variable.name}`);
      }
      variableNames.add(variable.name);
    }

    return { valid: errors.length === 0, errors };
  }

  // Query methods
  getTemplate(id: string): Template | undefined {
    return this.templates.get(id);
  }

  getAllTemplates(): Template[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: TemplateCategory): Template[] {
    return Array.from(this.templates.values())
      .filter(t => t.category === category);
  }

  getTemplatesByTag(tag: string): Template[] {
    return Array.from(this.templates.values())
      .filter(t => t.tags.includes(tag));
  }

  searchTemplates(query: string): Template[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values())
      .filter(t => 
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
  }

  getInheritanceHierarchy(templateId: string): string[] {
    const template = this.templates.get(templateId);
    if (!template) return [];

    const hierarchy: string[] = [templateId];
    const visited = new Set<string>();

    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const t = this.templates.get(id);
      if (t?.extends) {
        for (const parentId of t.extends) {
          hierarchy.push(parentId);
          traverse(parentId);
        }
      }
    };

    traverse(templateId);
    return hierarchy;
  }

  clearCache(): void {
    this.templateCache.clear();
    this.emit('cache:cleared');
  }
}

// Global template engine
let globalTemplateEngine: TemplateEngine | null = null;

export function createTemplateEngine(
  templatePaths?: string[],
  options?: ConstructorParameters<typeof TemplateEngine>[1]
): TemplateEngine {
  return new TemplateEngine(templatePaths, options);
}

export function getGlobalTemplateEngine(): TemplateEngine {
  if (!globalTemplateEngine) {
    globalTemplateEngine = new TemplateEngine();
  }
  return globalTemplateEngine;
}

export function setGlobalTemplateEngine(engine: TemplateEngine): void {
  globalTemplateEngine = engine;
}