import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { 
  PluginCommandDefinition, 
  PluginCommandArgument, 
  PluginCommandOption,
  PluginCommandContext,
  RegisteredCommand
} from './plugin-command-registry';

// Validation rule types
export enum ValidationRuleType {
  REQUIRED = 'required',
  TYPE = 'type',
  RANGE = 'range',
  LENGTH = 'length',
  PATTERN = 'pattern',
  ENUM = 'enum',
  CUSTOM = 'custom',
  CONDITIONAL = 'conditional',
  DEPENDENCY = 'dependency',
  EXCLUSION = 'exclusion'
}

// Parameter transformation types
export enum TransformationType {
  CASE = 'case',
  TRIM = 'trim',
  PARSE = 'parse',
  FORMAT = 'format',
  NORMALIZE = 'normalize',
  CONVERT = 'convert',
  SANITIZE = 'sanitize',
  EXPAND = 'expand',
  RESOLVE = 'resolve',
  CUSTOM = 'custom'
}

// Validation severity levels
export enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

// Validation rule definition
export interface ValidationRule {
  type: ValidationRuleType;
  severity: ValidationSeverity;
  message?: string;
  condition?: ValidationCondition;
  validator?: ValidationFunction;
  options?: Record<string, any>;
}

// Parameter transformation definition
export interface ParameterTransformation {
  type: TransformationType;
  order: number;
  transformer: TransformationFunction;
  options?: Record<string, any>;
  condition?: TransformationCondition;
}

// Validation condition function
export type ValidationCondition = (
  value: any,
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext
) => boolean;

// Validation function
export type ValidationFunction = (
  value: any,
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext
) => boolean | string;

// Transformation condition function
export type TransformationCondition = (
  value: any,
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext
) => boolean;

// Transformation function
export type TransformationFunction = (
  value: any,
  args: Record<string, any>,
  options: Record<string, any>,
  context: PluginCommandContext
) => any;

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  transformedArgs: Record<string, any>;
  transformedOptions: Record<string, any>;
}

// Validation issue
export interface ValidationIssue {
  field: string;
  type: ValidationRuleType;
  severity: ValidationSeverity;
  message: string;
  value: any;
  rule?: ValidationRule;
}

// Schema validation configuration
export interface ValidationSchema {
  arguments?: Record<string, ArgumentValidationConfig>;
  options?: Record<string, OptionValidationConfig>;
  globalRules?: ValidationRule[];
  transformations?: ParameterTransformation[];
  strict?: boolean;
  allowUnknown?: boolean;
  failFast?: boolean;
}

// Argument validation configuration
export interface ArgumentValidationConfig {
  rules: ValidationRule[];
  transformations?: ParameterTransformation[];
  dependencies?: string[];
  conflicts?: string[];
}

// Option validation configuration  
export interface OptionValidationConfig {
  rules: ValidationRule[];
  transformations?: ParameterTransformation[];
  dependencies?: string[];
  conflicts?: string[];
  implies?: string[];
}

// Built-in validation rules
export interface BuiltInValidationRules {
  required: (message?: string) => ValidationRule;
  type: (type: string, message?: string) => ValidationRule;
  minLength: (min: number, message?: string) => ValidationRule;
  maxLength: (max: number, message?: string) => ValidationRule;
  min: (min: number, message?: string) => ValidationRule;
  max: (max: number, message?: string) => ValidationRule;
  pattern: (pattern: RegExp, message?: string) => ValidationRule;
  enum: (values: any[], message?: string) => ValidationRule;
  email: (message?: string) => ValidationRule;
  url: (message?: string) => ValidationRule;
  path: (mustExist?: boolean, message?: string) => ValidationRule;
  json: (message?: string) => ValidationRule;
  custom: (validator: ValidationFunction, message?: string) => ValidationRule;
}

// Built-in transformations
export interface BuiltInTransformations {
  trim: (options?: { start?: boolean; end?: boolean }) => ParameterTransformation;
  lowercase: () => ParameterTransformation;
  uppercase: () => ParameterTransformation;
  camelCase: () => ParameterTransformation;
  kebabCase: () => ParameterTransformation;
  snakeCase: () => ParameterTransformation;
  parseNumber: (options?: { float?: boolean; base?: number }) => ParameterTransformation;
  parseBoolean: () => ParameterTransformation;
  parseJSON: () => ParameterTransformation;
  expandPath: (options?: { relative?: string }) => ParameterTransformation;
  resolvePath: () => ParameterTransformation;
  sanitizeHtml: () => ParameterTransformation;
  normalizeUrl: () => ParameterTransformation;
  custom: (transformer: TransformationFunction, order?: number) => ParameterTransformation;
}

// Plugin command validator
export class PluginCommandValidator extends EventEmitter {
  private schemas: Map<string, ValidationSchema> = new Map();
  private validationCache: Map<string, ValidationResult> = new Map();
  private builtInRules!: BuiltInValidationRules;
  private builtInTransformations!: BuiltInTransformations;
  private globalValidationConfig = {
    enableCaching: true,
    cacheSize: 1000,
    enableMetrics: true,
    strictMode: false
  };

  constructor() {
    super();
    this.initializeBuiltInRules();
    this.initializeBuiltInTransformations();
  }

  // Initialize built-in validation rules
  private initializeBuiltInRules(): void {
    this.builtInRules = {
      required: (message = 'Field is required') => ({
        type: ValidationRuleType.REQUIRED,
        severity: ValidationSeverity.ERROR,
        message,
        validator: (value) => value !== undefined && value !== null && value !== ''
      }),

      type: (type: string, message?: string) => ({
        type: ValidationRuleType.TYPE,
        severity: ValidationSeverity.ERROR,
        message: message || `Field must be of type ${type}`,
        validator: (value) => {
          switch (type) {
            case 'string': return typeof value === 'string';
            case 'number': return typeof value === 'number' && !isNaN(value);
            case 'boolean': return typeof value === 'boolean';
            case 'array': return Array.isArray(value);
            case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
            default: return true;
          }
        }
      }),

      minLength: (min: number, message?: string) => ({
        type: ValidationRuleType.LENGTH,
        severity: ValidationSeverity.ERROR,
        message: message || `Field must be at least ${min} characters long`,
        validator: (value) => typeof value === 'string' && value.length >= min
      }),

      maxLength: (max: number, message?: string) => ({
        type: ValidationRuleType.LENGTH,
        severity: ValidationSeverity.ERROR,
        message: message || `Field must be no more than ${max} characters long`,
        validator: (value) => typeof value === 'string' && value.length <= max
      }),

      min: (min: number, message?: string) => ({
        type: ValidationRuleType.RANGE,
        severity: ValidationSeverity.ERROR,
        message: message || `Field must be at least ${min}`,
        validator: (value) => typeof value === 'number' && value >= min
      }),

      max: (max: number, message?: string) => ({
        type: ValidationRuleType.RANGE,
        severity: ValidationSeverity.ERROR,
        message: message || `Field must be no more than ${max}`,
        validator: (value) => typeof value === 'number' && value <= max
      }),

      pattern: (pattern: RegExp, message?: string) => ({
        type: ValidationRuleType.PATTERN,
        severity: ValidationSeverity.ERROR,
        message: message || `Field must match pattern ${pattern.source}`,
        validator: (value) => typeof value === 'string' && pattern.test(value)
      }),

      enum: (values: any[], message?: string) => ({
        type: ValidationRuleType.ENUM,
        severity: ValidationSeverity.ERROR,
        message: message || `Field must be one of: ${values.join(', ')}`,
        validator: (value) => values.includes(value)
      }),

      email: (message = 'Field must be a valid email address') => ({
        type: ValidationRuleType.PATTERN,
        severity: ValidationSeverity.ERROR,
        message,
        validator: (value) => {
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return typeof value === 'string' && emailPattern.test(value);
        }
      }),

      url: (message = 'Field must be a valid URL') => ({
        type: ValidationRuleType.PATTERN,
        severity: ValidationSeverity.ERROR,
        message,
        validator: (value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        }
      }),

      path: (mustExist = false, message?: string) => ({
        type: ValidationRuleType.CUSTOM,
        severity: ValidationSeverity.ERROR,
        message: message || (mustExist ? 'Path must exist' : 'Field must be a valid path'),
        validator: (value) => {
          if (typeof value !== 'string') return false;
          if (!mustExist) return true;
          
          try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const fs = require('fs');
            return fs.existsSync(value);
          } catch {
            return false;
          }
        }
      }),

      json: (message = 'Field must be valid JSON') => ({
        type: ValidationRuleType.CUSTOM,
        severity: ValidationSeverity.ERROR,
        message,
        validator: (value) => {
          if (typeof value !== 'string') return false;
          try {
            JSON.parse(value);
            return true;
          } catch {
            return false;
          }
        }
      }),

      custom: (validator: ValidationFunction, message = 'Field is invalid') => ({
        type: ValidationRuleType.CUSTOM,
        severity: ValidationSeverity.ERROR,
        message,
        validator
      })
    };
  }

  // Initialize built-in transformations
  private initializeBuiltInTransformations(): void {
    this.builtInTransformations = {
      trim: (options = { start: true, end: true }) => ({
        type: TransformationType.TRIM,
        order: 1,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          if (options.start && options.end) return value.trim();
          if (options.start) return value.replace(/^\s+/, '');
          if (options.end) return value.replace(/\s+$/, '');
          return value;
        }
      }),

      lowercase: () => ({
        type: TransformationType.CASE,
        order: 2,
        transformer: (value) => typeof value === 'string' ? value.toLowerCase() : value
      }),

      uppercase: () => ({
        type: TransformationType.CASE,
        order: 2,
        transformer: (value) => typeof value === 'string' ? value.toUpperCase() : value
      }),

      camelCase: () => ({
        type: TransformationType.CASE,
        order: 2,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          return value.replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '');
        }
      }),

      kebabCase: () => ({
        type: TransformationType.CASE,
        order: 2,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          return value.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
        }
      }),

      snakeCase: () => ({
        type: TransformationType.CASE,
        order: 2,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          return value.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
        }
      }),

      parseNumber: (options = { float: true, base: 10 }) => ({
        type: TransformationType.PARSE,
        order: 3,
        transformer: (value) => {
          if (typeof value === 'number') return value;
          if (typeof value !== 'string') return value;
          
          const parsed = options.float ? parseFloat(value) : parseInt(value, options.base);
          return isNaN(parsed) ? value : parsed;
        }
      }),

      parseBoolean: () => ({
        type: TransformationType.PARSE,
        order: 3,
        transformer: (value) => {
          if (typeof value === 'boolean') return value;
          if (typeof value !== 'string') return value;
          
          const lower = value.toLowerCase();
          if (['true', '1', 'yes', 'on'].includes(lower)) return true;
          if (['false', '0', 'no', 'off'].includes(lower)) return false;
          return value;
        }
      }),

      parseJSON: () => ({
        type: TransformationType.PARSE,
        order: 3,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
      }),

      expandPath: (options = {}) => ({
        type: TransformationType.EXPAND,
        order: 4,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const path = require('path');
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const os = require('os');
          
          // Expand ~ to home directory
          if (value.startsWith('~/')) {
            value = path.join(os.homedir(), value.slice(2));
          }
          
          // Resolve relative to specific directory
          if (options.relative) {
            value = path.resolve(options.relative, value);
          }
          
          return value;
        }
      }),

      resolvePath: () => ({
        type: TransformationType.RESOLVE,
        order: 5,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const path = require('path');
          return path.resolve(value);
        }
      }),

      sanitizeHtml: () => ({
        type: TransformationType.SANITIZE,
        order: 6,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          return value.replace(/<[^>]*>/g, '');
        }
      }),

      normalizeUrl: () => ({
        type: TransformationType.NORMALIZE,
        order: 6,
        transformer: (value) => {
          if (typeof value !== 'string') return value;
          try {
            const url = new URL(value);
            return url.toString();
          } catch {
            return value;
          }
        }
      }),

      custom: (transformer: TransformationFunction, order = 10) => ({
        type: TransformationType.CUSTOM,
        order,
        transformer
      })
    };
  }

  // Register validation schema for a command
  registerSchema(commandId: string, schema: ValidationSchema): void {
    this.schemas.set(commandId, schema);
    this.emit('schema-registered', { commandId, schema });
  }

  // Remove validation schema
  removeSchema(commandId: string): boolean {
    const removed = this.schemas.delete(commandId);
    if (removed) {
      this.validationCache.delete(commandId);
      this.emit('schema-removed', { commandId });
    }
    return removed;
  }

  // Validate and transform command parameters
  async validateAndTransform(
    commandId: string,
    args: Record<string, any>,
    options: Record<string, any>,
    context: PluginCommandContext
  ): Promise<ValidationResult> {
    const cacheKey = this.generateCacheKey(commandId, args, options);
    
    if (this.globalValidationConfig.enableCaching && this.validationCache.has(cacheKey)) {
      return this.validationCache.get(cacheKey)!;
    }

    const schema = this.schemas.get(commandId);
    if (!schema) {
      // No schema means no validation/transformation
      return {
        valid: true,
        errors: [],
        warnings: [],
        info: [],
        transformedArgs: { ...args },
        transformedOptions: { ...options }
      };
    }

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      info: [],
      transformedArgs: { ...args },
      transformedOptions: { ...options }
    };

    this.emit('validation-started', { commandId, args, options });

    try {
      // Apply global transformations first
      if (schema.transformations) {
        await this.applyTransformations(
          schema.transformations,
          result.transformedArgs,
          result.transformedOptions,
          context
        );
      }

      // Validate and transform arguments
      if (schema.arguments) {
        await this.validateAndTransformArguments(
          schema.arguments,
          result.transformedArgs,
          result.transformedOptions,
          result,
          context
        );
      }

      // Validate and transform options
      if (schema.options) {
        await this.validateAndTransformOptions(
          schema.options,
          result.transformedArgs,
          result.transformedOptions,
          result,
          context
        );
      }

      // Apply global validation rules
      if (schema.globalRules) {
        await this.applyGlobalRules(
          schema.globalRules,
          result.transformedArgs,
          result.transformedOptions,
          result,
          context
        );
      }

      // Check validation result
      result.valid = result.errors.length === 0;

      // Fail fast if configured and there are errors
      if (schema.failFast && result.errors.length > 0) {
        throw new ValidationError(`Validation failed: ${result.errors[0].message}`);
      }

      // Cache result if enabled
      if (this.globalValidationConfig.enableCaching) {
        this.addToCache(cacheKey, result);
      }

      this.emit('validation-completed', { commandId, result });

    } catch (error) {
      this.emit('validation-error', { commandId, error });
      throw error;
    }

    return result;
  }

  // Validate and transform arguments
  private async validateAndTransformArguments(
    argumentSchemas: Record<string, ArgumentValidationConfig>,
    args: Record<string, any>,
    options: Record<string, any>,
    result: ValidationResult,
    context: PluginCommandContext
  ): Promise<void> {
    for (const [argName, argSchema] of Object.entries(argumentSchemas)) {
      const value = args[argName];

      // Apply transformations
      if (argSchema.transformations) {
        args[argName] = await this.applyTransformationChain(
          argSchema.transformations,
          value,
          args,
          options,
          context
        );
      }

      // Apply validation rules
      for (const rule of argSchema.rules) {
        await this.applyValidationRule(rule, argName, args[argName], args, options, result, context);
      }

      // Check dependencies
      if (argSchema.dependencies) {
        this.checkDependencies(argName, args[argName], argSchema.dependencies, args, result);
      }

      // Check conflicts
      if (argSchema.conflicts) {
        this.checkConflicts(argName, args[argName], argSchema.conflicts, args, result);
      }
    }
  }

  // Validate and transform options
  private async validateAndTransformOptions(
    optionSchemas: Record<string, OptionValidationConfig>,
    args: Record<string, any>,
    options: Record<string, any>,
    result: ValidationResult,
    context: PluginCommandContext
  ): Promise<void> {
    for (const [optionName, optionSchema] of Object.entries(optionSchemas)) {
      const value = options[optionName];

      // Apply transformations
      if (optionSchema.transformations) {
        options[optionName] = await this.applyTransformationChain(
          optionSchema.transformations,
          value,
          args,
          options,
          context
        );
      }

      // Apply validation rules
      for (const rule of optionSchema.rules) {
        await this.applyValidationRule(rule, optionName, options[optionName], args, options, result, context);
      }

      // Check dependencies
      if (optionSchema.dependencies) {
        this.checkDependencies(optionName, options[optionName], optionSchema.dependencies, options, result);
      }

      // Check conflicts
      if (optionSchema.conflicts) {
        this.checkConflicts(optionName, options[optionName], optionSchema.conflicts, options, result);
      }

      // Check implications
      if (optionSchema.implies) {
        this.checkImplications(optionName, options[optionName], optionSchema.implies, options, result);
      }
    }
  }

  // Apply transformation chain
  private async applyTransformationChain(
    transformations: ParameterTransformation[],
    value: any,
    args: Record<string, any>,
    options: Record<string, any>,
    context: PluginCommandContext
  ): Promise<any> {
    // Sort transformations by order
    const sortedTransformations = transformations.sort((a, b) => a.order - b.order);
    
    let transformedValue = value;
    
    for (const transformation of sortedTransformations) {
      // Check condition if specified
      if (transformation.condition && !transformation.condition(transformedValue, args, options, context)) {
        continue;
      }
      
      transformedValue = transformation.transformer(transformedValue, args, options, context);
    }
    
    return transformedValue;
  }

  // Apply transformations to all parameters
  private async applyTransformations(
    transformations: ParameterTransformation[],
    args: Record<string, any>,
    options: Record<string, any>,
    context: PluginCommandContext
  ): Promise<void> {
    const sortedTransformations = transformations.sort((a, b) => a.order - b.order);
    
    for (const transformation of sortedTransformations) {
      // Apply to all arguments
      for (const [argName, value] of Object.entries(args)) {
        if (!transformation.condition || transformation.condition(value, args, options, context)) {
          args[argName] = transformation.transformer(value, args, options, context);
        }
      }
      
      // Apply to all options
      for (const [optionName, value] of Object.entries(options)) {
        if (!transformation.condition || transformation.condition(value, args, options, context)) {
          options[optionName] = transformation.transformer(value, args, options, context);
        }
      }
    }
  }

  // Apply validation rule
  private async applyValidationRule(
    rule: ValidationRule,
    fieldName: string,
    value: any,
    args: Record<string, any>,
    options: Record<string, any>,
    result: ValidationResult,
    context: PluginCommandContext
  ): Promise<void> {
    // Check condition if specified
    if (rule.condition && !rule.condition(value, args, options, context)) {
      return;
    }

    let isValid = true;
    let message = rule.message || 'Validation failed';

    if (rule.validator) {
      const validationResult = rule.validator(value, args, options, context);
      
      if (typeof validationResult === 'boolean') {
        isValid = validationResult;
      } else if (typeof validationResult === 'string') {
        isValid = false;
        message = validationResult;
      }
    }

    if (!isValid) {
      const issue: ValidationIssue = {
        field: fieldName,
        type: rule.type,
        severity: rule.severity,
        message,
        value,
        rule
      };

      switch (rule.severity) {
        case ValidationSeverity.ERROR:
          result.errors.push(issue);
          break;
        case ValidationSeverity.WARNING:
          result.warnings.push(issue);
          break;
        case ValidationSeverity.INFO:
          result.info.push(issue);
          break;
      }
    }
  }

  // Apply global validation rules
  private async applyGlobalRules(
    rules: ValidationRule[],
    args: Record<string, any>,
    options: Record<string, any>,
    result: ValidationResult,
    context: PluginCommandContext
  ): Promise<void> {
    for (const rule of rules) {
      // Global rules apply to the entire parameter set
      await this.applyValidationRule(rule, '__global__', { args, options }, args, options, result, context);
    }
  }

  // Check parameter dependencies
  private checkDependencies(
    fieldName: string,
    value: any,
    dependencies: string[],
    params: Record<string, any>,
    result: ValidationResult
  ): void {
    if (value !== undefined && value !== null) {
      for (const dependency of dependencies) {
        if (params[dependency] === undefined || params[dependency] === null) {
          result.errors.push({
            field: fieldName,
            type: ValidationRuleType.DEPENDENCY,
            severity: ValidationSeverity.ERROR,
            message: `Field '${fieldName}' requires '${dependency}' to be specified`,
            value
          });
        }
      }
    }
  }

  // Check parameter conflicts
  private checkConflicts(
    fieldName: string,
    value: any,
    conflicts: string[],
    params: Record<string, any>,
    result: ValidationResult
  ): void {
    if (value !== undefined && value !== null) {
      for (const conflict of conflicts) {
        if (params[conflict] !== undefined && params[conflict] !== null) {
          result.errors.push({
            field: fieldName,
            type: ValidationRuleType.EXCLUSION,
            severity: ValidationSeverity.ERROR,
            message: `Field '${fieldName}' conflicts with '${conflict}'`,
            value
          });
        }
      }
    }
  }

  // Check parameter implications
  private checkImplications(
    fieldName: string,
    value: any,
    implications: string[],
    params: Record<string, any>,
    result: ValidationResult
  ): void {
    if (value !== undefined && value !== null) {
      for (const implication of implications) {
        if (params[implication] === undefined || params[implication] === null) {
          result.errors.push({
            field: fieldName,
            type: ValidationRuleType.DEPENDENCY,
            severity: ValidationSeverity.ERROR,
            message: `Field '${fieldName}' requires '${implication}' to be specified`,
            value
          });
        }
      }
    }
  }

  // Generate cache key
  private generateCacheKey(
    commandId: string,
    args: Record<string, any>,
    options: Record<string, any>
  ): string {
    const data = JSON.stringify({ commandId, args, options });
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Add result to cache
  private addToCache(key: string, result: ValidationResult): void {
    if (this.validationCache.size >= this.globalValidationConfig.cacheSize) {
      // Remove oldest entry
      const firstKey = this.validationCache.keys().next().value;
      if (firstKey !== undefined) {
        this.validationCache.delete(firstKey);
      }
    }
    this.validationCache.set(key, result);
  }

  // Get built-in validation rules
  getBuiltInRules(): BuiltInValidationRules {
    return this.builtInRules;
  }

  // Get built-in transformations
  getBuiltInTransformations(): BuiltInTransformations {
    return this.builtInTransformations;
  }

  // Get validation statistics
  getValidationStats(): any {
    return {
      totalSchemas: this.schemas.size,
      cacheSize: this.validationCache.size,
      cacheHitRate: 0, // Would track hits vs misses
      validationCount: 0, // Would track total validations
      errorCount: 0, // Would track total errors
      warningCount: 0, // Would track total warnings
      averageValidationTime: 0 // Would track performance
    };
  }

  // Clear validation cache
  clearCache(): void {
    this.validationCache.clear();
    this.emit('cache-cleared');
  }

  // Update global configuration
  updateConfiguration(config: Partial<typeof this.globalValidationConfig>): void {
    this.globalValidationConfig = { ...this.globalValidationConfig, ...config };
    this.emit('configuration-updated', this.globalValidationConfig);
  }
}

// Utility functions
export function createCommandValidator(): PluginCommandValidator {
  return new PluginCommandValidator();
}

export function createValidationSchema(config: Partial<ValidationSchema> = {}): ValidationSchema {
  return {
    arguments: {},
    options: {},
    globalRules: [],
    transformations: [],
    strict: false,
    allowUnknown: true,
    failFast: false,
    ...config
  };
}

export function formatValidationResult(result: ValidationResult): string {
  let output = '';
  
  if (result.errors.length > 0) {
    output += chalk.red('Validation Errors:\n');
    result.errors.forEach(error => {
      output += chalk.red(`  ✗ ${error.field}: ${error.message}\n`);
    });
  }
  
  if (result.warnings.length > 0) {
    output += chalk.yellow('Validation Warnings:\n');
    result.warnings.forEach(warning => {
      output += chalk.yellow(`  ⚠ ${warning.field}: ${warning.message}\n`);
    });
  }
  
  if (result.info.length > 0) {
    output += chalk.blue('Validation Info:\n');
    result.info.forEach(info => {
      output += chalk.blue(`  ℹ ${info.field}: ${info.message}\n`);
    });
  }
  
  return output;
}