import * as fs from 'fs-extra';
import * as yaml from 'yaml';
import { ValidationError } from './error-handler';

// Enhanced validation system with detailed error messages
export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'enum' | 'pattern' | 'range' | 'custom';
  message: string;
  validator?: (value: any, context?: any) => boolean;
  details?: {
    allowedValues?: any[];
    pattern?: RegExp;
    min?: number;
    max?: number;
    expectedType?: string;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
  value?: any;
  expectedValue?: any;
  suggestions?: string[];
  context?: string;
  line?: number;
  column?: number;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
}

export interface ValidationSuggestion {
  field: string;
  suggestion: string;
  reason: string;
  autoFixable: boolean;
  autoFixValue?: any;
}

// Configuration schema definitions
export const GLOBAL_CONFIG_SCHEMA: ValidationRule[] = [
  {
    field: 'version',
    type: 'required',
    message: 'Configuration version is required for migration tracking'
  },
  {
    field: 'version',
    type: 'pattern',
    message: 'Version must follow semantic versioning (e.g., 1.0.0)',
    details: { pattern: /^\d+\.\d+\.\d+$/ }
  },
  {
    field: 'packageManager',
    type: 'required',
    message: 'Package manager specification is required'
  },
  {
    field: 'packageManager',
    type: 'enum',
    message: 'Package manager must be one of: npm, yarn, pnpm, bun',
    details: { allowedValues: ['npm', 'yarn', 'pnpm', 'bun'] }
  },
  {
    field: 'defaultFramework',
    type: 'required',
    message: 'Default framework must be specified'
  },
  {
    field: 'defaultFramework',
    type: 'enum',
    message: 'Framework must be one of: react, react-ts, vue, vue-ts, svelte, svelte-ts, angular, angular-ts',
    details: { allowedValues: ['react', 'react-ts', 'vue', 'vue-ts', 'svelte', 'svelte-ts', 'angular', 'angular-ts'] }
  },
  {
    field: 'cli.autoUpdate',
    type: 'type',
    message: 'Auto-update setting must be a boolean value',
    details: { expectedType: 'boolean' }
  },
  {
    field: 'cli.telemetry',
    type: 'type',
    message: 'Telemetry setting must be a boolean value',
    details: { expectedType: 'boolean' }
  },
  {
    field: 'cli.theme',
    type: 'enum',
    message: 'Theme must be one of: auto, light, dark',
    details: { allowedValues: ['auto', 'light', 'dark'] }
  },
  {
    field: 'paths.templates',
    type: 'required',
    message: 'Templates directory path is required'
  },
  {
    field: 'paths.cache',
    type: 'required',
    message: 'Cache directory path is required'
  },
  {
    field: 'plugins.enabled',
    type: 'type',
    message: 'Enabled plugins must be an array of plugin names',
    details: { expectedType: 'array' }
  },
  {
    field: 'plugins.marketplace.registry',
    type: 'pattern',
    message: 'Plugin registry must be a valid URL',
    details: { pattern: /^https?:\/\/.+/ }
  }
];

export const PROJECT_CONFIG_SCHEMA: ValidationRule[] = [
  {
    field: 'name',
    type: 'required',
    message: 'Project name is required'
  },
  {
    field: 'name',
    type: 'pattern',
    message: 'Project name must be lowercase, alphanumeric with hyphens only',
    details: { pattern: /^[a-z0-9-]+$/ }
  },
  {
    field: 'version',
    type: 'required',
    message: 'Project version is required'
  },
  {
    field: 'version',
    type: 'pattern',
    message: 'Version must follow semantic versioning (e.g., 1.0.0)',
    details: { pattern: /^\d+\.\d+\.\d+/ }
  },
  {
    field: 'type',
    type: 'enum',
    message: 'Project type must be either "monorepo" or "standalone"',
    details: { allowedValues: ['monorepo', 'standalone'] }
  },
  {
    field: 'workspaces.patterns',
    type: 'type',
    message: 'Workspace patterns must be an array of glob patterns',
    details: { expectedType: 'array' }
  },
  {
    field: 'environments',
    type: 'custom',
    message: 'At least one environment configuration is required',
    validator: (value) => value && typeof value === 'object' && Object.keys(value).length > 0
  },
  {
    field: 'dev.port',
    type: 'range',
    message: 'Development port must be between 1024 and 65535',
    details: { min: 1024, max: 65535 }
  },
  {
    field: 'quality.coverage.threshold',
    type: 'range',
    message: 'Coverage threshold must be between 0 and 100',
    details: { min: 0, max: 100 }
  }
];

export const ENVIRONMENT_CONFIG_SCHEMA: ValidationRule[] = [
  {
    field: 'name',
    type: 'required',
    message: 'Environment name is required'
  },
  {
    field: 'build.mode',
    type: 'enum',
    message: 'Build mode must be one of: development, staging, production',
    details: { allowedValues: ['development', 'staging', 'production'] }
  },
  {
    field: 'deployment.provider',
    type: 'enum',
    message: 'Deployment provider must be one of: vercel, netlify, aws, azure, gcp, docker, custom',
    details: { allowedValues: ['vercel', 'netlify', 'aws', 'azure', 'gcp', 'docker', 'custom'] }
  }
];

// Enhanced validation engine
export class ConfigurationValidator {
  private errors: ValidationErrorDetail[] = [];
  private warnings: ValidationWarning[] = [];
  private suggestions: ValidationSuggestion[] = [];

  // Validate configuration against schema
  validateConfiguration(config: any, schema: ValidationRule[], context = ''): ValidationResult {
    this.reset();

    for (const rule of schema) {
      const value = this.getNestedValue(config, rule.field);
      const fieldContext = context ? `${context}.${rule.field}` : rule.field;

      this.validateField(value, rule, fieldContext, config);
    }

    // Add additional contextual validations
    this.performContextualValidations(config, context);

    return {
      valid: this.errors.filter(e => e.severity === 'error').length === 0,
      errors: this.errors,
      warnings: this.warnings,
      suggestions: this.suggestions
    };
  }

  // Validate individual field
  private validateField(value: any, rule: ValidationRule, fieldPath: string, fullConfig: any): void {
    switch (rule.type) {
      case 'required':
        this.validateRequired(value, rule, fieldPath);
        break;
      case 'type':
        this.validateType(value, rule, fieldPath);
        break;
      case 'enum':
        this.validateEnum(value, rule, fieldPath);
        break;
      case 'pattern':
        this.validatePattern(value, rule, fieldPath);
        break;
      case 'range':
        this.validateRange(value, rule, fieldPath);
        break;
      case 'custom':
        this.validateCustom(value, rule, fieldPath, fullConfig);
        break;
    }
  }

  private validateRequired(value: any, rule: ValidationRule, fieldPath: string): void {
    if (value === undefined || value === null || value === '') {
      this.addError({
        field: fieldPath,
        message: rule.message,
        severity: 'error',
        code: 'REQUIRED_FIELD_MISSING',
        value,
        suggestions: this.generateRequiredFieldSuggestions(fieldPath)
      });
    }
  }

  private validateType(value: any, rule: ValidationRule, fieldPath: string): void {
    if (value === undefined || value === null) return;

    const expectedType = rule.details?.expectedType;
    let actualType: string = typeof value;
    
    if (expectedType === 'array' && !Array.isArray(value)) {
      actualType = 'non-array';
    }

    if ((expectedType === 'array' && !Array.isArray(value)) ||
        (expectedType !== 'array' && actualType !== expectedType)) {
      this.addError({
        field: fieldPath,
        message: rule.message,
        severity: 'error',
        code: 'INVALID_TYPE',
        value,
        expectedValue: expectedType,
        suggestions: this.generateTypeSuggestions(value, expectedType!)
      });
    }
  }

  private validateEnum(value: any, rule: ValidationRule, fieldPath: string): void {
    if (value === undefined || value === null) return;

    const allowedValues = rule.details?.allowedValues || [];
    if (!allowedValues.includes(value)) {
      this.addError({
        field: fieldPath,
        message: rule.message,
        severity: 'error',
        code: 'INVALID_ENUM_VALUE',
        value,
        expectedValue: allowedValues,
        suggestions: this.generateEnumSuggestions(value, allowedValues)
      });
    }
  }

  private validatePattern(value: any, rule: ValidationRule, fieldPath: string): void {
    if (value === undefined || value === null) return;

    const pattern = rule.details?.pattern;
    if (pattern && typeof value === 'string' && !pattern.test(value)) {
      this.addError({
        field: fieldPath,
        message: rule.message,
        severity: 'error',
        code: 'PATTERN_MISMATCH',
        value,
        suggestions: this.generatePatternSuggestions(value, pattern, fieldPath)
      });
    }
  }

  private validateRange(value: any, rule: ValidationRule, fieldPath: string): void {
    if (value === undefined || value === null) return;

    const { min, max } = rule.details || {};
    if (typeof value === 'number') {
      if (min !== undefined && value < min) {
        this.addError({
          field: fieldPath,
          message: `Value ${value} is below minimum ${min}`,
          severity: 'error',
          code: 'VALUE_BELOW_MINIMUM',
          value,
          expectedValue: `>= ${min}`,
          suggestions: [`Use a value >= ${min}`]
        });
      }
      if (max !== undefined && value > max) {
        this.addError({
          field: fieldPath,
          message: `Value ${value} exceeds maximum ${max}`,
          severity: 'error',
          code: 'VALUE_ABOVE_MAXIMUM',
          value,
          expectedValue: `<= ${max}`,
          suggestions: [`Use a value <= ${max}`]
        });
      }
    }
  }

  private validateCustom(value: any, rule: ValidationRule, fieldPath: string, fullConfig: any): void {
    if (rule.validator && !rule.validator(value, fullConfig)) {
      this.addError({
        field: fieldPath,
        message: rule.message,
        severity: 'error',
        code: 'CUSTOM_VALIDATION_FAILED',
        value,
        suggestions: this.generateCustomSuggestions(fieldPath, value)
      });
    }
  }

  // Contextual validations
  private performContextualValidations(config: any, context: string): void {
    if (context === 'global') {
      this.validateGlobalContextual(config);
    } else if (context === 'project') {
      this.validateProjectContextual(config);
    }
  }

  private validateGlobalContextual(config: any): void {
    // Check if directories exist
    if (config.paths) {
      for (const [key, dirPath] of Object.entries(config.paths)) {
        if (typeof dirPath === 'string') {
          const expandedPath = dirPath.replace(/^~/, process.env.HOME || '~');
          if (!fs.existsSync(expandedPath)) {
            this.addWarning({
              field: `paths.${key}`,
              message: `Directory does not exist: ${dirPath}`,
              suggestion: `Create directory or update path`,
              impact: 'medium'
            });
            
            this.addSuggestion({
              field: `paths.${key}`,
              suggestion: `Create missing directory: ${dirPath}`,
              reason: 'Required directory for Re-Shell operation',
              autoFixable: true,
              autoFixValue: dirPath
            });
          }
        }
      }
    }

    // Check plugin registry accessibility
    if (config.plugins?.marketplace?.registry) {
      this.addSuggestion({
        field: 'plugins.marketplace.registry',
        suggestion: 'Verify registry URL is accessible',
        reason: 'Ensure plugin marketplace functionality',
        autoFixable: false
      });
    }
  }

  private validateProjectContextual(config: any): void {
    // Validate workspace patterns
    if (config.workspaces?.patterns) {
      for (const pattern of config.workspaces.patterns) {
        if (typeof pattern === 'string' && pattern.includes('..')) {
          this.addWarning({
            field: 'workspaces.patterns',
            message: `Pattern "${pattern}" may expose parent directories`,
            suggestion: 'Use patterns within project boundaries',
            impact: 'high'
          });
        }
      }
    }

    // Validate environment consistency
    if (config.environments) {
      const envNames = Object.keys(config.environments);
      const requiredEnvs = ['development', 'staging', 'production'];
      
      for (const required of requiredEnvs) {
        if (!envNames.includes(required)) {
          this.addWarning({
            field: 'environments',
            message: `Missing recommended environment: ${required}`,
            suggestion: `Add ${required} environment configuration`,
            impact: 'medium'
          });
        }
      }
    }

    // Check port conflicts
    if (config.dev?.port) {
      const commonPorts = [3000, 8080, 8000, 5000, 3001];
      if (commonPorts.includes(config.dev.port)) {
        this.addWarning({
          field: 'dev.port',
          message: `Port ${config.dev.port} is commonly used and may cause conflicts`,
          suggestion: 'Consider using a different port',
          impact: 'low'
        });
      }
    }
  }

  // Suggestion generation methods
  private generateRequiredFieldSuggestions(fieldPath: string): string[] {
    const suggestions: Record<string, string[]> = {
      'version': ['Use "1.0.0" for new configurations'],
      'name': ['Use lowercase project name with hyphens'],
      'packageManager': ['Use "pnpm" (recommended)', 'Use "npm", "yarn", or "bun"'],
      'defaultFramework': ['Use "react-ts" for TypeScript React', 'Use "vue-ts" for TypeScript Vue']
    };
    
    return suggestions[fieldPath] || [`Provide a value for ${fieldPath}`];
  }

  private generateTypeSuggestions(value: any, expectedType: string): string[] {
    if (expectedType === 'array' && !Array.isArray(value)) {
      return [`Convert to array: [${JSON.stringify(value)}]`, 'Use empty array: []'];
    }
    if (expectedType === 'boolean') {
      return ['Use true or false', 'Remove quotes if using string'];
    }
    if (expectedType === 'number') {
      return ['Remove quotes from numeric value', 'Use valid number format'];
    }
    return [`Convert to ${expectedType}`];
  }

  private generateEnumSuggestions(value: any, allowedValues: any[]): string[] {
    // Find close matches using simple string similarity
    if (typeof value === 'string') {
      const closeMatches = allowedValues
        .filter(allowed => typeof allowed === 'string')
        .map(allowed => ({
          value: allowed,
          similarity: this.calculateSimilarity(value, allowed)
        }))
        .filter(match => match.similarity > 0.5)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3)
        .map(match => match.value);

      if (closeMatches.length > 0) {
        return [`Did you mean: ${closeMatches.join(', ')}?`, ...allowedValues.map(v => `Use: ${v}`)];
      }
    }
    return allowedValues.map(v => `Use: ${v}`);
  }

  private generatePatternSuggestions(value: string, pattern: RegExp, fieldPath: string): string[] {
    const suggestions: Record<string, string[]> = {
      'version': ['Use format: 1.0.0', 'Follow semantic versioning'],
      'name': ['Use lowercase letters, numbers, and hyphens only', 'Example: my-project-name'],
      'plugins.marketplace.registry': ['Use HTTPS URL', 'Example: https://registry.npmjs.org']
    };
    
    return suggestions[fieldPath] || [`Match pattern: ${pattern.source}`];
  }

  private generateCustomSuggestions(fieldPath: string, value: any): string[] {
    if (fieldPath === 'environments') {
      return ['Add at least one environment (development, staging, or production)'];
    }
    return ['Fix validation error'];
  }

  // Utility methods
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private addError(error: ValidationErrorDetail): void {
    this.errors.push(error);
  }

  private addWarning(warning: ValidationWarning): void {
    this.warnings.push(warning);
  }

  private addSuggestion(suggestion: ValidationSuggestion): void {
    this.suggestions.push(suggestion);
  }

  private reset(): void {
    this.errors = [];
    this.warnings = [];
    this.suggestions = [];
  }
}

// Export singleton instance and helper functions
export const configValidator = new ConfigurationValidator();

export function validateGlobalConfig(config: any): ValidationResult {
  return configValidator.validateConfiguration(config, GLOBAL_CONFIG_SCHEMA, 'global');
}

export function validateProjectConfig(config: any): ValidationResult {
  return configValidator.validateConfiguration(config, PROJECT_CONFIG_SCHEMA, 'project');
}

export function validateEnvironmentConfig(config: any): ValidationResult {
  return configValidator.validateConfiguration(config, ENVIRONMENT_CONFIG_SCHEMA, 'environment');
}

export async function validateConfigFile(filePath: string, configType: 'global' | 'project'): Promise<ValidationResult> {
  try {
    if (!await fs.pathExists(filePath)) {
      return {
        valid: false,
        errors: [{
          field: 'file',
          message: `Configuration file not found: ${filePath}`,
          severity: 'error',
          code: 'FILE_NOT_FOUND',
          suggestions: [`Create configuration file at ${filePath}`]
        }],
        warnings: [],
        suggestions: []
      };
    }

    const content = await fs.readFile(filePath, 'utf8');
    let config: any;

    try {
      config = yaml.parse(content);
    } catch (parseError) {
      return {
        valid: false,
        errors: [{
          field: 'syntax',
          message: `Invalid YAML syntax: ${(parseError as Error).message}`,
          severity: 'error',
          code: 'YAML_PARSE_ERROR',
          suggestions: ['Check YAML syntax', 'Validate indentation', 'Check for special characters']
        }],
        warnings: [],
        suggestions: []
      };
    }

    const schema = configType === 'global' ? GLOBAL_CONFIG_SCHEMA : PROJECT_CONFIG_SCHEMA;
    const result = configValidator.validateConfiguration(config, schema, configType);
    return result;

  } catch (error) {
    throw new ValidationError(`Failed to validate configuration: ${(error as Error).message}`);
  }
}