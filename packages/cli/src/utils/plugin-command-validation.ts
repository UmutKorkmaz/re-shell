import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { 
  PluginCommandContext,
} from './plugin-command-registry';

/**
 * Defines the categories of validation rules that can be applied to command
 * parameters.
 */
export enum ValidationRuleType {
  /** Rule enforcing that a value must be present. */
  REQUIRED = 'required',
  /** Rule validating the JavaScript type of a value. */
  TYPE = 'type',
  /** Rule constraining a numeric value to a specific range. */
  RANGE = 'range',
  /** Rule enforcing minimum and/or maximum string lengths. */
  LENGTH = 'length',
  /** Rule validating a value against a regular expression. */
  PATTERN = 'pattern',
  /** Rule restricting a value to a predefined set of allowed values. */
  ENUM = 'enum',
  /** Rule using a user-supplied validator function. */
  CUSTOM = 'custom',
  /** Rule that is only applied when its condition evaluates to true. */
  CONDITIONAL = 'conditional',
  /** Rule ensuring required companion parameters are also provided. */
  DEPENDENCY = 'dependency',
  /** Rule ensuring mutually exclusive parameters are not both provided. */
  EXCLUSION = 'exclusion'
}

/**
 * Defines the categories of transformations that can be applied to command
 * parameters before or during validation.
 */
export enum TransformationType {
  /** Transformation that changes the case of string values. */
  CASE = 'case',
  /** Transformation that removes leading and/or trailing whitespace. */
  TRIM = 'trim',
  /** Transformation that parses a string into a structured value. */
  PARSE = 'parse',
  /** Transformation that reformats a value into a specific display format. */
  FORMAT = 'format',
  /** Transformation that normalizes a value to a canonical form. */
  NORMALIZE = 'normalize',
  /** Transformation that converts a value from one type to another. */
  CONVERT = 'convert',
  /** Transformation that sanitizes potentially unsafe input. */
  SANITIZE = 'sanitize',
  /** Transformation that expands shorthand (e.g. `~`) into a full value. */
  EXPAND = 'expand',
  /** Transformation that resolves a relative value to an absolute one. */
  RESOLVE = 'resolve',
  /** Transformation using a user-supplied transformer function. */
  CUSTOM = 'custom'
}

/**
 * Severity levels for validation issues, determining how they are surfaced to
 * the caller and whether they affect overall validity.
 */
export enum ValidationSeverity {
  /** A critical issue that causes validation to fail. */
  ERROR = 'error',
  /** A non-blocking issue that should be brought to the user's attention. */
  WARNING = 'warning',
  /** Informational feedback that does not affect validation status. */
  INFO = 'info'
}

/**
 * Represents a single validation rule applied to a command parameter.
 */
export interface ValidationRule {
  /** The category of validation to perform. */
  type: ValidationRuleType;
  /** The severity assigned to issues produced by this rule. */
  severity: ValidationSeverity;
  /** Optional custom error message used when validation fails. */
  message?: string;
  /** Optional predicate that must return true for the rule to be evaluated. */
  condition?: ValidationCondition;
  /** Optional validator function that determines whether the value is valid. */
  validator?: ValidationFunction;
  /** Additional rule-specific configuration. */
  options?: Record<string, unknown>;
}

/**
 * Defines a transformation applied to a parameter value prior to or during
 * validation.
 */
export interface ParameterTransformation {
  /** The category of transformation to perform. */
  type: TransformationType;
  /** Numeric ordering controlling when this transformation runs relative to others (lower runs first). */
  order: number;
  /** The function that performs the actual value transformation. */
  transformer: TransformationFunction;
  /** Additional transformation-specific configuration. */
  options?: Record<string, unknown>;
  /** Optional predicate that must return true for the transformation to be applied. */
  condition?: TransformationCondition;
}

/**
 * Predicate function that determines whether a validation rule should be
 * evaluated for the given value.
 *
 * @param value - The parameter value being considered.
 * @param args - The full set of command arguments.
 * @param options - The full set of command options.
 * @param context - The execution context for the plugin command.
 * @returns `true` if the rule should run, otherwise `false`.
 */
export type ValidationCondition = (
  value: any,
  args: Record<string, unknown>,
  options: Record<string, unknown>,
  context: PluginCommandContext
) => boolean;

/**
 * Validator function that checks whether a value satisfies a rule.
 *
 * @param value - The parameter value to validate.
 * @param args - The full set of command arguments.
 * @param options - The full set of command options.
 * @param context - The execution context for the plugin command.
 * @returns `true` when valid, `false` when invalid, or a custom error message string.
 */
export type ValidationFunction = (
  value: any,
  args: Record<string, unknown>,
  options: Record<string, unknown>,
  context: PluginCommandContext
) => boolean | string;

/**
 * Predicate function that determines whether a transformation should be applied
 * to the given value.
 *
 * @param value - The parameter value being considered.
 * @param args - The full set of command arguments.
 * @param options - The full set of command options.
 * @param context - The execution context for the plugin command.
 * @returns `true` if the transformation should run, otherwise `false`.
 */
export type TransformationCondition = (
  value: any,
  args: Record<string, unknown>,
  options: Record<string, unknown>,
  context: PluginCommandContext
) => boolean;

/**
 * Function that transforms a parameter value into a new value.
 *
 * @param value - The original parameter value.
 * @param args - The full set of command arguments.
 * @param options - The full set of command options.
 * @param context - The execution context for the plugin command.
 * @returns The transformed value.
 */
export type TransformationFunction = (
  value: any,
  args: Record<string, unknown>,
  options: Record<string, unknown>,
  context: PluginCommandContext
) => any;

/**
 * The outcome of validating (and transforming) a command's parameters.
 */
export interface ValidationResult {
  /** Whether the overall validation passed with no errors. */
  valid: boolean;
  /** Collection of error-level issues found during validation. */
  errors: ValidationIssue[];
  /** Collection of warning-level issues found during validation. */
  warnings: ValidationIssue[];
  /** Collection of informational issues found during validation. */
  info: ValidationIssue[];
  /** The fully transformed set of arguments. */
  transformedArgs: Record<string, unknown>;
  /** The fully transformed set of options. */
  transformedOptions: Record<string, unknown>;
}

/**
 * Describes a single issue discovered during parameter validation.
 */
export interface ValidationIssue {
  /** The name of the field (argument or option) that produced the issue. */
  field: string;
  /** The type of rule that generated the issue. */
  type: ValidationRuleType;
  /** The severity of the issue. */
  severity: ValidationSeverity;
  /** Human-readable description of the issue. */
  message: string;
  /** The value that failed validation. */
  value: any;
  /** The original rule that produced the issue, if applicable. */
  rule?: ValidationRule;
}

/**
 * Schema describing how a plugin command's parameters should be validated and
 * transformed.
 */
export interface ValidationSchema {
  /** Per-argument validation configurations keyed by argument name. */
  arguments?: Record<string, ArgumentValidationConfig>;
  /** Per-option validation configurations keyed by option name. */
  options?: Record<string, OptionValidationConfig>;
  /** Rules applied across the entire parameter set. */
  globalRules?: ValidationRule[];
  /** Transformations applied to every parameter before validation. */
  transformations?: ParameterTransformation[];
  /** When `true`, unknown parameters cause a validation error. */
  strict?: boolean;
  /** When `true`, parameters not declared in the schema are permitted. */
  allowUnknown?: boolean;
  /** When `true`, validation stops and throws on the first error encountered. */
  failFast?: boolean;
}

/**
 * Validation configuration for a single command argument.
 */
export interface ArgumentValidationConfig {
  /** The set of validation rules to apply to this argument. */
  rules: ValidationRule[];
  /** Optional transformations applied to the argument value before validation. */
  transformations?: ParameterTransformation[];
  /** Names of other arguments that must also be provided when this argument is present. */
  dependencies?: string[];
  /** Names of other arguments that must not be provided alongside this argument. */
  conflicts?: string[];
}

/**
 * Validation configuration for a single command option.
 */
export interface OptionValidationConfig {
  /** The set of validation rules to apply to this option. */
  rules: ValidationRule[];
  /** Optional transformations applied to the option value before validation. */
  transformations?: ParameterTransformation[];
  /** Names of other options that must also be provided when this option is present. */
  dependencies?: string[];
  /** Names of other options that must not be provided alongside this option. */
  conflicts?: string[];
  /** Names of other options that are automatically required when this option is present. */
  implies?: string[];
}

/**
 * A collection of factory functions that produce commonly used validation
 * rules.
 */
export interface BuiltInValidationRules {
  /** Creates a rule ensuring a value is present. */
  required: (message?: string) => ValidationRule;
  /** Creates a rule validating the JavaScript type of the value. */
  type: (type: string, message?: string) => ValidationRule;
  /** Creates a rule enforcing a minimum string length. */
  minLength: (min: number, message?: string) => ValidationRule;
  /** Creates a rule enforcing a maximum string length. */
  maxLength: (max: number, message?: string) => ValidationRule;
  /** Creates a rule enforcing a minimum numeric value. */
  min: (min: number, message?: string) => ValidationRule;
  /** Creates a rule enforcing a maximum numeric value. */
  max: (max: number, message?: string) => ValidationRule;
  /** Creates a rule validating the value against a regular expression. */
  pattern: (pattern: RegExp, message?: string) => ValidationRule;
  /** Creates a rule restricting the value to a predefined set. */
  enum: (values: any[], message?: string) => ValidationRule;
  /** Creates a rule validating that the value is a well-formed email address. */
  email: (message?: string) => ValidationRule;
  /** Creates a rule validating that the value is a well-formed URL. */
  url: (message?: string) => ValidationRule;
  /** Creates a rule validating a filesystem path, optionally requiring existence. */
  path: (mustExist?: boolean, message?: string) => ValidationRule;
  /** Creates a rule validating that the value is parseable as JSON. */
  json: (message?: string) => ValidationRule;
  /** Creates a rule delegating validation to a custom function. */
  custom: (validator: ValidationFunction, message?: string) => ValidationRule;
}

/**
 * A collection of factory functions that produce commonly used parameter
 * transformations.
 */
export interface BuiltInTransformations {
  /** Creates a transformation that trims whitespace from string values. */
  trim: (options?: { start?: boolean; end?: boolean }) => ParameterTransformation;
  /** Creates a transformation converting strings to lower case. */
  lowercase: () => ParameterTransformation;
  /** Creates a transformation converting strings to upper case. */
  uppercase: () => ParameterTransformation;
  /** Creates a transformation converting strings to camelCase. */
  camelCase: () => ParameterTransformation;
  /** Creates a transformation converting strings to kebab-case. */
  kebabCase: () => ParameterTransformation;
  /** Creates a transformation converting strings to snake_case. */
  snakeCase: () => ParameterTransformation;
  /** Creates a transformation parsing strings into numbers. */
  parseNumber: (options?: { float?: boolean; base?: number }) => ParameterTransformation;
  /** Creates a transformation parsing common boolean string representations. */
  parseBoolean: () => ParameterTransformation;
  /** Creates a transformation parsing JSON strings into objects. */
  parseJSON: () => ParameterTransformation;
  /** Creates a transformation expanding shorthand path segments (e.g. `~`) and resolving relative paths. */
  expandPath: (options?: { relative?: string }) => ParameterTransformation;
  /** Creates a transformation resolving a path to an absolute path. */
  resolvePath: () => ParameterTransformation;
  /** Creates a transformation stripping HTML tags from string values. */
  sanitizeHtml: () => ParameterTransformation;
  /** Creates a transformation normalizing URL strings. */
  normalizeUrl: () => ParameterTransformation;
  /** Creates a transformation delegating to a custom transformer function. */
  custom: (transformer: TransformationFunction, order?: number) => ParameterTransformation;
}

/**
 * Manages validation schemas and performs validation/transformation of plugin
 * command parameters. Supports caching, built-in rules, built-in
 * transformations, and dependency/conflict checking.
 */
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

  /**
   * Creates a new validator and initializes the built-in rule and
   * transformation factories.
   */
  constructor() {
    super();
    this.initializeBuiltInRules();
    this.initializeBuiltInTransformations();
  }

  /**
   * Populates the built-in validation rule factories used by the validator.
   */
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

  /**
   * Populates the built-in transformation factories used by the validator.
   */
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

  /**
   * Registers a validation schema for the given command.
   *
   * @param commandId - The unique identifier of the command.
   * @param schema - The validation schema to associate with the command.
   */
  registerSchema(commandId: string, schema: ValidationSchema): void {
    this.schemas.set(commandId, schema);
    this.emit('schema-registered', { commandId, schema });
  }

  /**
   * Removes the validation schema associated with the given command.
   *
   * @param commandId - The unique identifier of the command.
   * @returns `true` if a schema was removed, otherwise `false`.
   */
  removeSchema(commandId: string): boolean {
    const removed = this.schemas.delete(commandId);
    if (removed) {
      this.validationCache.delete(commandId);
      this.emit('schema-removed', { commandId });
    }
    return removed;
  }

  /**
   * Validates and transforms the parameters of a plugin command using its
   * registered schema.
   *
   * @param commandId - The unique identifier of the command.
   * @param args - The raw arguments provided to the command.
   * @param options - The raw options provided to the command.
   * @param context - The execution context for the plugin command.
   * @returns The validation result including transformed values and any issues found.
   */
  async validateAndTransform(
    commandId: string,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
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

  /**
   * Applies transformations, validation rules, and dependency/conflict checks
   * to each declared argument.
   *
   * @param argumentSchemas - Per-argument validation configurations.
   * @param args - The arguments object (mutated in place with transformed values).
   * @param options - The full set of command options.
   * @param result - The accumulating validation result object.
   * @param context - The execution context for the plugin command.
   */
  private async validateAndTransformArguments(
    argumentSchemas: Record<string, ArgumentValidationConfig>,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
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

  /**
   * Applies transformations, validation rules, dependency/conflict checks, and
   * implication checks to each declared option.
   *
   * @param optionSchemas - Per-option validation configurations.
   * @param args - The full set of command arguments.
   * @param options - The options object (mutated in place with transformed values).
   * @param result - The accumulating validation result object.
   * @param context - The execution context for the plugin command.
   */
  private async validateAndTransformOptions(
    optionSchemas: Record<string, OptionValidationConfig>,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
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

  /**
   * Applies an ordered chain of transformations to a single value.
   *
   * @param transformations - The transformations to apply.
   * @param value - The starting value to transform.
   * @param args - The full set of command arguments.
   * @param options - The full set of command options.
   * @param context - The execution context for the plugin command.
   * @returns The fully transformed value.
   */
  private async applyTransformationChain(
    transformations: ParameterTransformation[],
    value: any,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
    context: PluginCommandContext
  ): Promise<unknown> {
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

  /**
   * Applies global transformations to every argument and option value.
   *
   * @param transformations - The transformations to apply.
   * @param args - The arguments object (mutated in place).
   * @param options - The options object (mutated in place).
   * @param context - The execution context for the plugin command.
   */
  private async applyTransformations(
    transformations: ParameterTransformation[],
    args: Record<string, unknown>,
    options: Record<string, unknown>,
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

  /**
   * Evaluates a single validation rule against a value, recording any issue at
   * the appropriate severity level.
   *
   * @param rule - The validation rule to evaluate.
   * @param fieldName - The name of the field being validated.
   * @param value - The value to validate.
   * @param args - The full set of command arguments.
   * @param options - The full set of command options.
   * @param result - The accumulating validation result object.
   * @param context - The execution context for the plugin command.
   */
  private async applyValidationRule(
    rule: ValidationRule,
    fieldName: string,
    value: any,
    args: Record<string, unknown>,
    options: Record<string, unknown>,
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

  /**
   * Applies global validation rules that inspect the entire parameter set
   * rather than a single field.
   *
   * @param rules - The global rules to evaluate.
   * @param args - The full set of command arguments.
   * @param options - The full set of command options.
   * @param result - The accumulating validation result object.
   * @param context - The execution context for the plugin command.
   */
  private async applyGlobalRules(
    rules: ValidationRule[],
    args: Record<string, unknown>,
    options: Record<string, unknown>,
    result: ValidationResult,
    context: PluginCommandContext
  ): Promise<void> {
    for (const rule of rules) {
      // Global rules apply to the entire parameter set
      await this.applyValidationRule(rule, '__global__', { args, options }, args, options, result, context);
    }
  }

  /**
   * Verifies that all dependency fields are present when the given field has a
   * value, adding errors to the result for any missing dependencies.
   *
   * @param fieldName - The name of the field being checked.
   * @param value - The value of the field.
   * @param dependencies - Names of fields that must also be present.
   * @param params - The full set of parameters to inspect.
   * @param result - The accumulating validation result object.
   */
  private checkDependencies(
    fieldName: string,
    value: any,
    dependencies: string[],
    params: Record<string, unknown>,
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

  /**
   * Verifies that no conflicting fields are present alongside the given field,
   * adding errors to the result for any conflicts found.
   *
   * @param fieldName - The name of the field being checked.
   * @param value - The value of the field.
   * @param conflicts - Names of fields that must not be present at the same time.
   * @param params - The full set of parameters to inspect.
   * @param result - The accumulating validation result object.
   */
  private checkConflicts(
    fieldName: string,
    value: any,
    conflicts: string[],
    params: Record<string, unknown>,
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

  /**
   * Verifies that all implied fields are present when the given field has a
   * value, adding errors to the result for any missing implications.
   *
   * @param fieldName - The name of the field being checked.
   * @param value - The value of the field.
   * @param implications - Names of fields that are required when this field is present.
   * @param params - The full set of parameters to inspect.
   * @param result - The accumulating validation result object.
   */
  private checkImplications(
    fieldName: string,
    value: any,
    implications: string[],
    params: Record<string, unknown>,
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

  /**
   * Generates a deterministic cache key from the command identifier and its
   * parameter values.
   *
   * @param commandId - The unique identifier of the command.
   * @param args - The command arguments.
   * @param options - The command options.
   * @returns A string hash representing the cache entry key.
   */
  private generateCacheKey(
    commandId: string,
    args: Record<string, unknown>,
    options: Record<string, unknown>
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

  /**
   * Adds a validation result to the cache, evicting the oldest entry when the
   * cache is at capacity.
   *
   * @param key - The cache key generated for the validation.
   * @param result - The validation result to store.
   */
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

  /**
   * Returns the set of built-in validation rule factories.
   *
   * @returns The built-in validation rules.
   */
  getBuiltInRules(): BuiltInValidationRules {
    return this.builtInRules;
  }

  /**
   * Returns the set of built-in transformation factories.
   *
   * @returns The built-in transformations.
   */
  getBuiltInTransformations(): BuiltInTransformations {
    return this.builtInTransformations;
  }

  /**
   * Returns statistics about the validator's current state, including the
   * number of registered schemas and cache utilization.
   *
   * @returns An object containing validation statistics.
   */
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

  /**
   * Removes all entries from the validation cache and emits a `cache-cleared`
   * event.
   */
  clearCache(): void {
    this.validationCache.clear();
    this.emit('cache-cleared');
  }

  /**
   * Merges the provided configuration values into the validator's global
   * configuration and emits a `configuration-updated` event.
   *
   * @param config - The partial configuration overrides to apply.
   */
  updateConfiguration(config: Partial<typeof this.globalValidationConfig>): void {
    this.globalValidationConfig = { ...this.globalValidationConfig, ...config };
    this.emit('configuration-updated', this.globalValidationConfig);
  }
}

/**
 * Creates and returns a new `PluginCommandValidator` instance.
 *
 * @returns A fresh plugin command validator.
 */
export function createCommandValidator(): PluginCommandValidator {
  return new PluginCommandValidator();
}

/**
 * Creates a `ValidationSchema` with sensible defaults merged with the provided
 * configuration overrides.
 *
 * @param config - Partial schema configuration to override the defaults.
 * @returns A complete validation schema.
 */
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

/**
 * Formats a validation result into a human-readable, colorized string showing
 * errors, warnings, and informational messages.
 *
 * @param result - The validation result to format.
 * @returns A formatted string representation of the result.
 */
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