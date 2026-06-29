// Workspace Templates and Inheritance
// Template composition, inheritance, and instantiation

import * as fs from 'fs';
import * as path from 'path';

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  extends?: string[];
  config: unknown;
  variables?: TemplateVariable[];
  validations?: TemplateValidation[];
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default?: unknown;
  required?: boolean;
  description?: string;
}

export interface TemplateValidation {
  type: 'required' | 'pattern' | 'range' | 'custom';
  field: string;
  rule: unknown;
  message: string;
}

export interface TemplateInstantiationOptions {
  variables?: Record<string, unknown>;
  overrides?: Record<string, unknown>;
  skipValidation?: boolean;
}

export class WorkspaceTemplateManager {
  private templates: Map<string, WorkspaceTemplate> = new Map();
  private templatePath: string;

  constructor(templatePath: string) {
    this.templatePath = templatePath;
    this.loadTemplates();
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...target };

    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = target[key];
      if (sourceVal instanceof Object && key in target && targetVal instanceof Object) {
        result[key] = this.deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
      } else {
        result[key] = sourceVal;
      }
    }

    return result;
  }

  /**
   * Load all templates from directory
   */
  loadTemplates(): void {
    if (!fs.existsSync(this.templatePath)) {
      return;
    }

    const files = fs.readdirSync(this.templatePath);
    for (const file of files) {
      if (file.endsWith('.template.json')) {
        const filePath = path.join(this.templatePath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const template: WorkspaceTemplate = JSON.parse(content);
        this.templates.set(template.id, template);
      }
    }
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): WorkspaceTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * List all templates
   */
  listTemplates(): WorkspaceTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Instantiate template
   */
  instantiate(templateId: string, options: TemplateInstantiationOptions = {}): unknown {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Resolve template inheritance
    const resolvedConfig = this.resolveTemplate(template);

    // Apply variables
    const configWithVars = this.applyVariables(resolvedConfig, options.variables ?? {});

    // Apply overrides
    const finalConfig = this.applyOverrides(configWithVars, options.overrides ?? {});

    // Validate
    if (!options.skipValidation) {
      this.validateConfig(finalConfig, template);
    }

    return finalConfig;
  }

  /**
   * Resolve template inheritance
   */
  private resolveTemplate(template: WorkspaceTemplate): unknown {
    let config = this.deepClone(template.config);

    // Process parent templates
    if (template.extends && template.extends.length > 0) {
      for (const parentId of template.extends) {
        const parent = this.getTemplate(parentId);
        if (!parent) {
          throw new Error(`Parent template not found: ${parentId}`);
        }

        const parentConfig = this.resolveTemplate(parent);
        config = this.deepMerge(parentConfig as Record<string, unknown>, config as Record<string, unknown>);
      }
    }

    return config;
  }

  /**
   * Apply variables to config
   */
  private applyVariables(config: unknown, variables: Record<string, unknown>): unknown {
    let configStr = JSON.stringify(config);

    // Replace variables in format {{variable.name}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{variable\\.${key}\\}\\}`, 'g');
      configStr = configStr.replace(regex, String(value));
    }

    return JSON.parse(configStr);
  }

  /**
   * Apply overrides to config
   */
  private applyOverrides(config: unknown, overrides: Record<string, unknown>): unknown {
    return this.deepMerge(config as Record<string, unknown>, overrides);
  }

  /**
   * Validate config against template
   */
  private validateConfig(config: unknown, template: WorkspaceTemplate): void {
    if (!template.validations) return;

    for (const validation of template.validations) {
      const value = this.getNestedValue(config, validation.field);

      switch (validation.type) {
        case 'required':
          if (!value) {
            throw new Error(`${validation.message}: ${validation.field} is required`);
          }
          break;

        case 'pattern':
          {
          const regex = new RegExp(validation.rule as string);
          if (!regex.test(value as string)) {
            throw new Error(`${validation.message}: ${validation.field} does not match pattern`);
          }
          break;

          }
        case 'range':
          if (typeof value === 'number') {
            const { min, max } = validation.rule as { min: number; max: number };
            if (value < min || value > max) {
              throw new Error(`${validation.message}: ${validation.field} must be between ${min} and ${max}`);
            }
          }
          break;
      }
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Deep clone object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Create template
   */
  async createTemplate(template: WorkspaceTemplate): Promise<void> {
    const filePath = path.join(this.templatePath, `${template.id}.template.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(template, null, 2));
    this.templates.set(template.id, template);
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    const filePath = path.join(this.templatePath, `${id}.template.json`);

    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    this.templates.delete(id);
  }

  /**
   * Validate template
   */
  validateTemplate(template: WorkspaceTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.id) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.config) errors.push('Template config is required');

    // Validate parent templates exist
    if (template.extends) {
      for (const parentId of template.extends) {
        if (!this.templates.has(parentId)) {
          errors.push(`Parent template not found: ${parentId}`);
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set<string>();
    const checkCircular = (id: string) => {
      if (visited.has(id)) {
        errors.push(`Circular dependency detected: ${id}`);
        return;
      }
      visited.add(id);

      const t = this.templates.get(id);
      if (t?.extends) {
        for (const parentId of t.extends) {
          checkCircular(parentId);
        }
      }
    };

    checkCircular(template.id);

    return { valid: errors.length === 0, errors };
  }

  /**
   * Compose multiple templates
   */
  composeTemplates(templateIds: string[], options: TemplateInstantiationOptions = {}): unknown {
    if (templateIds.length === 0) {
      throw new Error('At least one template is required');
    }

    if (templateIds.length === 1) {
      return this.instantiate(templateIds[0], options);
    }

    // Merge all templates
    let mergedConfig: Record<string, unknown> = {};

    for (const templateId of templateIds) {
      const config = this.instantiate(templateId, {
        ...options,
        skipValidation: true,
      });
      mergedConfig = this.deepMerge(mergedConfig, config as Record<string, unknown>);
    }

    return mergedConfig;
  }

  /**
   * Export template
   */
  async exportTemplate(id: string, outputPath: string): Promise<void> {
    const template = this.getTemplate(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    await fs.promises.writeFile(outputPath, JSON.stringify(template, null, 2));
  }

  /**
   * Import template
   */
  async importTemplate(filePath: string): Promise<WorkspaceTemplate> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const template: WorkspaceTemplate = JSON.parse(content);

    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    await this.createTemplate(template);
    return template;
  }

  /**
   * Get template inheritance chain
   */
  getInheritanceChain(id: string): WorkspaceTemplate[] {
    const chain: WorkspaceTemplate[] = [];
    const visited = new Set<string>();

    const buildChain = (templateId: string) => {
      if (visited.has(templateId)) return;
      visited.add(templateId);

      const template = this.getTemplate(templateId);
      if (!template) return;

      chain.push(template);

      if (template.extends) {
        for (const parentId of template.extends) {
          buildChain(parentId);
        }
      }
    };

    buildChain(id);
    return chain;
  }
}

export const workspaceTemplateManager = new WorkspaceTemplateManager('./templates');
