import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as semver from 'semver';
import * as yaml from 'js-yaml';
import { Template, TemplateCategory, TemplateVariable, TemplateFile, TemplateHook } from './template-engine';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  compatibility: CompatibilityReport;
  suggestions: string[];
  score: number;
}

export interface ValidationError {
  type: ErrorType;
  severity: 'error' | 'critical';
  field: string;
  message: string;
  details?: any;
}

export interface ValidationWarning {
  type: WarningType;
  field: string;
  message: string;
  suggestion?: string;
}

export enum ErrorType {
  MISSING_FIELD = 'missing_field',
  INVALID_TYPE = 'invalid_type',
  INVALID_VALUE = 'invalid_value',
  INVALID_REFERENCE = 'invalid_reference',
  CIRCULAR_DEPENDENCY = 'circular_dependency',
  VERSION_CONFLICT = 'version_conflict',
  FILE_NOT_FOUND = 'file_not_found',
  SYNTAX_ERROR = 'syntax_error',
  SECURITY_ISSUE = 'security_issue',
  COMPATIBILITY_ISSUE = 'compatibility_issue'
}

export enum WarningType {
  DEPRECATED_FEATURE = 'deprecated_feature',
  MISSING_OPTIONAL = 'missing_optional',
  PERFORMANCE_ISSUE = 'performance_issue',
  BEST_PRACTICE = 'best_practice',
  NAMING_CONVENTION = 'naming_convention',
  DOCUMENTATION = 'documentation',
  ACCESSIBILITY = 'accessibility'
}

export interface CompatibilityReport {
  nodeVersion: CompatibilityCheck;
  cliVersion: CompatibilityCheck;
  dependencies: CompatibilityCheck[];
  platforms: PlatformCompatibility[];
  frameworks: FrameworkCompatibility[];
  overallScore: number;
}

export interface CompatibilityCheck {
  name: string;
  required: string;
  current?: string;
  compatible: boolean;
  recommendation?: string;
}

export interface PlatformCompatibility {
  platform: 'windows' | 'darwin' | 'linux';
  compatible: boolean;
  issues: string[];
}

export interface FrameworkCompatibility {
  framework: string;
  version: string;
  compatible: boolean;
  issues: string[];
}

export interface ValidationConfig {
  strict: boolean;
  checkSecurity: boolean;
  checkPerformance: boolean;
  checkBestPractices: boolean;
  checkAccessibility: boolean;
  customRules?: ValidationRule[];
  trustedAuthors?: string[];
  allowedCategories?: TemplateCategory[];
  maxComplexity?: number;
}

export interface ValidationRule {
  name: string;
  description: string;
  check: (template: Template) => ValidationError | ValidationWarning | null;
}

export class TemplateValidator extends EventEmitter {
  private defaultConfig: ValidationConfig = {
    strict: true,
    checkSecurity: true,
    checkPerformance: true,
    checkBestPractices: true,
    checkAccessibility: false,
    maxComplexity: 100
  };

  private builtinRules: ValidationRule[] = [];
  private securityPatterns = {
    dangerousCommands: [
      /rm\s+-rf\s+\//,
      /eval\s*\(/,
      /exec\s*\(/,
      /require\s*\(\s*['"]\s*child_process/,
      /process\.env\./,
      /\$\{.*\}/
    ],
    sensitiveFiles: [
      /\.env/,
      /\.ssh/,
      /private.*key/,
      /password/,
      /secret/,
      /token/
    ]
  };

  constructor(
    private config: Partial<ValidationConfig> = {}
  ) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.initializeBuiltinRules();
  }

  private initializeBuiltinRules(): void {
    // Structure validation rules
    this.builtinRules.push({
      name: 'required_fields',
      description: 'Check for required template fields',
      check: (template) => {
        if (!template.id) {
          return {
            type: ErrorType.MISSING_FIELD,
            severity: 'critical',
            field: 'id',
            message: 'Template ID is required'
          };
        }
        if (!template.name) {
          return {
            type: ErrorType.MISSING_FIELD,
            severity: 'critical',
            field: 'name',
            message: 'Template name is required'
          };
        }
        if (!template.version) {
          return {
            type: ErrorType.MISSING_FIELD,
            severity: 'critical',
            field: 'version',
            message: 'Template version is required'
          };
        }
        if (!template.category) {
          return {
            type: ErrorType.MISSING_FIELD,
            severity: 'critical',
            field: 'category',
            message: 'Template category is required'
          };
        }
        return null;
      }
    });

    // Version validation
    this.builtinRules.push({
      name: 'valid_version',
      description: 'Check for valid semantic version',
      check: (template) => {
        if (!semver.valid(template.version)) {
          return {
            type: ErrorType.INVALID_VALUE,
            severity: 'error',
            field: 'version',
            message: `Invalid version format: ${template.version}. Must be valid semver (e.g., 1.0.0)`
          };
        }
        return null;
      }
    });

    // Category validation
    this.builtinRules.push({
      name: 'valid_category',
      description: 'Check for valid template category',
      check: (template) => {
        const validCategories = Object.values(TemplateCategory);
        if (!validCategories.includes(template.category)) {
          return {
            type: ErrorType.INVALID_VALUE,
            severity: 'error',
            field: 'category',
            message: `Invalid category: ${template.category}. Must be one of: ${validCategories.join(', ')}`
          };
        }
        
        if (this.config.allowedCategories && 
            !this.config.allowedCategories.includes(template.category)) {
          return {
            type: ErrorType.INVALID_VALUE,
            severity: 'error',
            field: 'category',
            message: `Category '${template.category}' is not allowed in this context`
          };
        }
        
        return null;
      }
    });

    // Naming convention
    this.builtinRules.push({
      name: 'naming_convention',
      description: 'Check naming conventions',
      check: (template) => {
        if (!/^[a-z0-9-]+$/.test(template.id)) {
          return {
            type: WarningType.NAMING_CONVENTION,
            field: 'id',
            message: 'Template ID should use lowercase letters, numbers, and hyphens only',
            suggestion: template.id.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          };
        }
        return null;
      }
    });

    // Documentation check
    this.builtinRules.push({
      name: 'documentation',
      description: 'Check for proper documentation',
      check: (template) => {
        if (!template.description || template.description.length < 20) {
          return {
            type: WarningType.DOCUMENTATION,
            field: 'description',
            message: 'Template should have a detailed description (at least 20 characters)',
            suggestion: 'Add a comprehensive description explaining the template purpose and usage'
          };
        }
        return null;
      }
    });
  }

  async validate(template: Template): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: string[] = [];

    this.emit('validation:start', template);

    try {
      // Run built-in rules
      for (const rule of this.builtinRules) {
        const result = rule.check(template);
        if (result) {
          if ('severity' in result) {
            errors.push(result);
          } else {
            warnings.push(result);
          }
        }
      }

      // Run custom rules
      if (this.config.customRules) {
        for (const rule of this.config.customRules) {
          const result = rule.check(template);
          if (result) {
            if ('severity' in result) {
              errors.push(result);
            } else {
              warnings.push(result);
            }
          }
        }
      }

      // Validate structure
      await this.validateStructure(template, errors, warnings);

      // Validate files
      await this.validateFiles(template, errors, warnings);

      // Validate variables
      this.validateVariables(template, errors, warnings);

      // Validate hooks
      this.validateHooks(template, errors, warnings);

      // Check security
      if (this.config.checkSecurity) {
        await this.validateSecurity(template, errors, warnings);
      }

      // Check performance
      if (this.config.checkPerformance) {
        this.validatePerformance(template, errors, warnings);
      }

      // Check best practices
      if (this.config.checkBestPractices) {
        this.validateBestPractices(template, errors, warnings, suggestions);
      }

      // Check compatibility
      const compatibility = await this.checkCompatibility(template);

      // Calculate score
      const score = this.calculateScore(errors, warnings, compatibility);

      const result: ValidationResult = {
        valid: errors.length === 0 || errors.every(e => e.severity !== 'critical'),
        errors,
        warnings,
        compatibility,
        suggestions,
        score
      };

      this.emit('validation:complete', { template, result });
      return result;

    } catch (error) {
      this.emit('validation:error', { template, error });
      throw error;
    }
  }

  private async validateStructure(
    template: Template,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Check for circular dependencies in extends
    if (template.extends) {
      const visited = new Set<string>();
      const checkCircular = (id: string, chain: string[]): boolean => {
        if (visited.has(id)) {
          return true;
        }
        visited.add(id);
        // Note: This would need access to other templates to fully check
        return false;
      };

      if (checkCircular(template.id, [])) {
        errors.push({
          type: ErrorType.CIRCULAR_DEPENDENCY,
          severity: 'critical',
          field: 'extends',
          message: 'Circular dependency detected in template inheritance'
        });
      }
    }

    // Check template complexity
    const complexity = this.calculateComplexity(template);
    if (this.config.maxComplexity && complexity > this.config.maxComplexity) {
      warnings.push({
        type: WarningType.PERFORMANCE_ISSUE,
        field: 'template',
        message: `Template complexity (${complexity}) exceeds recommended maximum (${this.config.maxComplexity})`,
        suggestion: 'Consider breaking the template into smaller, more focused templates'
      });
    }

    // Validate metadata
    if (!template.metadata?.created) {
      warnings.push({
        type: WarningType.MISSING_OPTIONAL,
        field: 'metadata.created',
        message: 'Template should include creation date'
      });
    }

    // Check for required tags
    if (!template.tags || template.tags.length === 0) {
      warnings.push({
        type: WarningType.BEST_PRACTICE,
        field: 'tags',
        message: 'Template should include tags for better discoverability'
      });
    }
  }

  private async validateFiles(
    template: Template,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    if (!template.files || template.files.length === 0) {
      errors.push({
        type: ErrorType.MISSING_FIELD,
        severity: 'error',
        field: 'files',
        message: 'Template must include at least one file'
      });
      return;
    }

    const destinations = new Set<string>();

    for (const file of template.files) {
      // Check required fields
      if (!file.source) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'file.source',
          message: 'File source is required'
        });
      }

      if (!file.destination) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'file.destination',
          message: 'File destination is required'
        });
      }

      // Check for duplicate destinations
      if (destinations.has(file.destination)) {
        errors.push({
          type: ErrorType.INVALID_VALUE,
          severity: 'error',
          field: 'file.destination',
          message: `Duplicate destination: ${file.destination}`
        });
      }
      destinations.add(file.destination);

      // Check if source file exists (if absolute path)
      if (file.source && path.isAbsolute(file.source)) {
        if (!await fs.pathExists(file.source)) {
          errors.push({
            type: ErrorType.FILE_NOT_FOUND,
            severity: 'error',
            field: 'file.source',
            message: `Source file not found: ${file.source}`
          });
        }
      }

      // Validate transform type
      if (file.transform && !['handlebars', 'ejs', 'none'].includes(file.transform)) {
        errors.push({
          type: ErrorType.INVALID_VALUE,
          severity: 'error',
          field: 'file.transform',
          message: `Invalid transform type: ${file.transform}`
        });
      }

      // Validate merge strategy
      if (file.mergeStrategy && 
          !['override', 'append', 'prepend', 'deep', 'custom'].includes(file.mergeStrategy)) {
        errors.push({
          type: ErrorType.INVALID_VALUE,
          severity: 'error',
          field: 'file.mergeStrategy',
          message: `Invalid merge strategy: ${file.mergeStrategy}`
        });
      }

      // Check for security issues in paths
      if (this.config.checkSecurity) {
        if (file.destination.includes('..')) {
          errors.push({
            type: ErrorType.SECURITY_ISSUE,
            severity: 'critical',
            field: 'file.destination',
            message: `Path traversal detected in destination: ${file.destination}`
          });
        }
      }
    }
  }

  private validateVariables(
    template: Template,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const variableNames = new Set<string>();

    for (const variable of template.variables || []) {
      // Check required fields
      if (!variable.name) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'variable.name',
          message: 'Variable name is required'
        });
        continue;
      }

      if (!variable.type) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'variable.type',
          message: `Variable type is required for '${variable.name}'`
        });
      }

      // Check for duplicates
      if (variableNames.has(variable.name)) {
        errors.push({
          type: ErrorType.INVALID_VALUE,
          severity: 'error',
          field: 'variable.name',
          message: `Duplicate variable name: ${variable.name}`
        });
      }
      variableNames.add(variable.name);

      // Validate type
      const validTypes = ['string', 'number', 'boolean', 'array', 'object', 'choice'];
      if (variable.type && !validTypes.includes(variable.type)) {
        errors.push({
          type: ErrorType.INVALID_TYPE,
          severity: 'error',
          field: 'variable.type',
          message: `Invalid variable type '${variable.type}' for '${variable.name}'`
        });
      }

      // Validate choices for choice type
      if (variable.type === 'choice' && (!variable.choices || variable.choices.length === 0)) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'variable.choices',
          message: `Choices are required for choice type variable '${variable.name}'`
        });
      }

      // Validate pattern
      if (variable.pattern) {
        try {
          new RegExp(variable.pattern);
        } catch {
          errors.push({
            type: ErrorType.INVALID_VALUE,
            severity: 'error',
            field: 'variable.pattern',
            message: `Invalid regex pattern for variable '${variable.name}'`
          });
        }
      }

      // Check for documentation
      if (!variable.description) {
        warnings.push({
          type: WarningType.DOCUMENTATION,
          field: 'variable.description',
          message: `Variable '${variable.name}' should have a description`
        });
      }

      // Validate transform and validate functions
      if (variable.transform) {
        try {
          new Function('value', variable.transform);
        } catch (error: any) {
          errors.push({
            type: ErrorType.SYNTAX_ERROR,
            severity: 'error',
            field: 'variable.transform',
            message: `Invalid transform function for '${variable.name}': ${error.message}`
          });
        }
      }

      if (variable.validate) {
        try {
          new Function('value', variable.validate);
        } catch (error: any) {
          errors.push({
            type: ErrorType.SYNTAX_ERROR,
            severity: 'error',
            field: 'variable.validate',
            message: `Invalid validate function for '${variable.name}': ${error.message}`
          });
        }
      }
    }
  }

  private validateHooks(
    template: Template,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    for (const hook of template.hooks || []) {
      // Check required fields
      if (!hook.type) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'hook.type',
          message: 'Hook type is required'
        });
      }

      if (!hook.name) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'hook.name',
          message: 'Hook name is required'
        });
      }

      // Must have either command or script
      if (!hook.command && !hook.script) {
        errors.push({
          type: ErrorType.MISSING_FIELD,
          severity: 'error',
          field: 'hook.command|script',
          message: `Hook '${hook.name}' must have either command or script`
        });
      }

      // Validate script syntax
      if (hook.script) {
        try {
          new Function('context', 'require', hook.script);
        } catch (error: any) {
          errors.push({
            type: ErrorType.SYNTAX_ERROR,
            severity: 'error',
            field: 'hook.script',
            message: `Invalid script for hook '${hook.name}': ${error.message}`
          });
        }
      }

      // Check for security issues
      if (this.config.checkSecurity && hook.command) {
        for (const pattern of this.securityPatterns.dangerousCommands) {
          if (pattern.test(hook.command)) {
            errors.push({
              type: ErrorType.SECURITY_ISSUE,
              severity: 'critical',
              field: 'hook.command',
              message: `Potentially dangerous command in hook '${hook.name}'`,
              details: { command: hook.command }
            });
          }
        }
      }

      // Validate timeout
      if (hook.timeout && (hook.timeout < 0 || hook.timeout > 600000)) {
        warnings.push({
          type: WarningType.BEST_PRACTICE,
          field: 'hook.timeout',
          message: `Hook timeout should be between 0 and 600000ms (10 minutes)`
        });
      }
    }
  }

  private async validateSecurity(
    template: Template,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): Promise<void> {
    // Check author trust
    if (template.author && 
        this.config.trustedAuthors && 
        !this.config.trustedAuthors.includes(template.author)) {
      warnings.push({
        type: WarningType.BEST_PRACTICE,
        field: 'author',
        message: `Template author '${template.author}' is not in trusted authors list`
      });
    }

    // Check for sensitive file patterns
    for (const file of template.files || []) {
      for (const pattern of this.securityPatterns.sensitiveFiles) {
        if (pattern.test(file.destination)) {
          warnings.push({
            type: WarningType.BEST_PRACTICE,
            field: 'file.destination',
            message: `File destination may contain sensitive data: ${file.destination}`
          });
        }
      }
    }

    // Check variable names for sensitive data
    for (const variable of template.variables || []) {
      if (/password|secret|token|key/i.test(variable.name)) {
        warnings.push({
          type: WarningType.BEST_PRACTICE,
          field: 'variable.name',
          message: `Variable '${variable.name}' may contain sensitive data. Ensure proper handling.`
        });
      }
    }
  }

  private validatePerformance(
    template: Template,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Check file count
    if (template.files.length > 100) {
      warnings.push({
        type: WarningType.PERFORMANCE_ISSUE,
        field: 'files',
        message: `Template has ${template.files.length} files. Consider splitting into smaller templates.`
      });
    }

    // Check hook count
    if (template.hooks.length > 20) {
      warnings.push({
        type: WarningType.PERFORMANCE_ISSUE,
        field: 'hooks',
        message: `Template has ${template.hooks.length} hooks. This may impact processing time.`
      });
    }

    // Check variable count
    if (template.variables.length > 50) {
      warnings.push({
        type: WarningType.PERFORMANCE_ISSUE,
        field: 'variables',
        message: `Template has ${template.variables.length} variables. Consider grouping related variables.`
      });
    }
  }

  private validateBestPractices(
    template: Template,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    // Check for README
    const hasReadme = template.files.some(f => 
      /readme\.(md|txt)/i.test(path.basename(f.destination))
    );
    
    if (!hasReadme) {
      suggestions.push('Consider adding a README file to document the generated project');
    }

    // Check for .gitignore
    const hasGitignore = template.files.some(f => 
      path.basename(f.destination) === '.gitignore'
    );
    
    if (!hasGitignore && template.category !== TemplateCategory.CONFIGURATION) {
      suggestions.push('Consider adding a .gitignore file');
    }

    // Check for license
    if (!template.license) {
      warnings.push({
        type: WarningType.DOCUMENTATION,
        field: 'license',
        message: 'Template should specify a license'
      });
    }

    // Check for repository
    if (!template.repository) {
      warnings.push({
        type: WarningType.DOCUMENTATION,
        field: 'repository',
        message: 'Template should include repository URL for updates and issues'
      });
    }

    // Check for semantic variable names
    for (const variable of template.variables || []) {
      if (variable.name.length < 3) {
        warnings.push({
          type: WarningType.NAMING_CONVENTION,
          field: 'variable.name',
          message: `Variable name '${variable.name}' is too short. Use descriptive names.`
        });
      }
    }
  }

  private async checkCompatibility(template: Template): Promise<CompatibilityReport> {
    const nodeVersion = await this.checkNodeCompatibility(template);
    const cliVersion = await this.checkCliCompatibility(template);
    const dependencies = await this.checkDependencyCompatibility(template);
    const platforms = await this.checkPlatformCompatibility(template);
    const frameworks = await this.checkFrameworkCompatibility(template);

    const scores = [
      nodeVersion.compatible ? 100 : 0,
      cliVersion.compatible ? 100 : 0,
      ...dependencies.map(d => d.compatible ? 100 : 50),
      ...platforms.map(p => p.compatible ? 100 : 0),
      ...frameworks.map(f => f.compatible ? 100 : 50)
    ];

    const overallScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 100;

    return {
      nodeVersion,
      cliVersion,
      dependencies,
      platforms,
      frameworks,
      overallScore
    };
  }

  private async checkNodeCompatibility(template: Template): Promise<CompatibilityCheck> {
    const required = template.requires?.find(r => r.type === 'environment' && r.name === 'node')?.version || '>=14.0.0';
    const current = process.version;

    return {
      name: 'Node.js',
      required,
      current,
      compatible: semver.satisfies(current, required),
      recommendation: semver.satisfies(current, required) 
        ? undefined 
        : `Requires Node.js ${required}, you have ${current}`
    };
  }

  private async checkCliCompatibility(template: Template): Promise<CompatibilityCheck> {
    const required = template.requires?.find(r => r.type === 'environment' && r.name === 'cli')?.version || '*';
    
    // Get CLI version
    let current = 'unknown';
    try {
      const packagePath = path.join(__dirname, '..', '..', 'package.json');
      const pkg = await fs.readJson(packagePath);
      current = pkg.version;
    } catch {
      // Ignore
    }

    return {
      name: 'Re-Shell CLI',
      required,
      current,
      compatible: required === '*' || semver.satisfies(current, required),
      recommendation: undefined
    };
  }

  private async checkDependencyCompatibility(template: Template): Promise<CompatibilityCheck[]> {
    const checks: CompatibilityCheck[] = [];
    
    const packageDeps = template.requires?.filter(r => r.type === 'package') || [];
    
    for (const dep of packageDeps) {
      checks.push({
        name: dep.name,
        required: dep.version || '*',
        compatible: true, // TODO: Actually check if package is available
        recommendation: undefined
      });
    }

    return checks;
  }

  private async checkPlatformCompatibility(template: Template): Promise<PlatformCompatibility[]> {
    const platforms: PlatformCompatibility[] = [
      { platform: 'windows', compatible: true, issues: [] },
      { platform: 'darwin', compatible: true, issues: [] },
      { platform: 'linux', compatible: true, issues: [] }
    ];

    // Check for platform-specific issues
    for (const file of template.files || []) {
      // Check for Windows path issues
      if (file.destination.includes(':') || file.destination.includes('\\')) {
        platforms[0].issues.push(`Path may have issues on Windows: ${file.destination}`);
      }

      // Check for case sensitivity issues
      if (file.destination !== file.destination.toLowerCase()) {
        platforms[0].issues.push(`Case-sensitive path may cause issues on Windows: ${file.destination}`);
      }

      // Check for permissions (Windows doesn't support chmod)
      if (file.permissions) {
        platforms[0].issues.push(`File permissions not supported on Windows: ${file.destination}`);
      }
    }

    // Check hooks for platform-specific commands
    for (const hook of template.hooks || []) {
      if (hook.command) {
        if (hook.command.includes('chmod') || hook.command.includes('chown')) {
          platforms[0].issues.push(`Unix-specific command in hook: ${hook.name}`);
        }
        if (hook.command.includes('.sh')) {
          platforms[0].issues.push(`Shell script may not work on Windows: ${hook.name}`);
        }
      }
    }

    // Update compatibility based on issues
    for (const platform of platforms) {
      platform.compatible = platform.issues.length === 0;
    }

    return platforms;
  }

  private async checkFrameworkCompatibility(template: Template): Promise<FrameworkCompatibility[]> {
    const frameworks: FrameworkCompatibility[] = [];
    
    // Check based on template category and tags
    if (template.category === TemplateCategory.MICROFRONTEND || 
        template.tags.includes('react')) {
      frameworks.push({
        framework: 'react',
        version: '>=16.8.0',
        compatible: true,
        issues: []
      });
    }

    if (template.tags.includes('vue')) {
      frameworks.push({
        framework: 'vue',
        version: '>=3.0.0',
        compatible: true,
        issues: []
      });
    }

    if (template.tags.includes('angular')) {
      frameworks.push({
        framework: 'angular',
        version: '>=12.0.0',
        compatible: true,
        issues: []
      });
    }

    return frameworks;
  }

  private calculateComplexity(template: Template): number {
    let complexity = 0;
    
    // Base complexity
    complexity += template.files.length * 2;
    complexity += template.variables.length;
    complexity += template.hooks.length * 3;
    
    // Inheritance complexity
    complexity += (template.extends?.length || 0) * 5;
    complexity += (template.implements?.length || 0) * 3;
    
    // Conditional complexity
    for (const file of template.files) {
      if (file.condition) complexity += 2;
      if (file.merge) complexity += 3;
    }
    
    for (const variable of template.variables) {
      if (variable.when) complexity += 2;
      if (variable.validate) complexity += 2;
      if (variable.transform) complexity += 2;
    }
    
    for (const hook of template.hooks) {
      if (hook.condition) complexity += 2;
      if (hook.script) complexity += 5; // Scripts are more complex than commands
    }
    
    return complexity;
  }

  private calculateScore(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    compatibility: CompatibilityReport
  ): number {
    let score = 100;
    
    // Deduct for errors
    for (const error of errors) {
      if (error.severity === 'critical') {
        score -= 20;
      } else {
        score -= 10;
      }
    }
    
    // Deduct for warnings
    score -= warnings.length * 2;
    
    // Factor in compatibility
    score = Math.round((score + compatibility.overallScore) / 2);
    
    return Math.max(0, Math.min(100, score));
  }

  // Utility methods
  async validateTemplateFile(filePath: string): Promise<ValidationResult> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const template = yaml.load(content) as Template;
      return await this.validate(template);
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          type: ErrorType.SYNTAX_ERROR,
          severity: 'critical',
          field: 'file',
          message: `Failed to parse template file: ${error.message}`
        }],
        warnings: [],
        compatibility: {
          nodeVersion: { name: 'Node.js', required: '*', compatible: true },
          cliVersion: { name: 'CLI', required: '*', compatible: true },
          dependencies: [],
          platforms: [],
          frameworks: [],
          overallScore: 0
        },
        suggestions: [],
        score: 0
      };
    }
  }

  updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  addCustomRule(rule: ValidationRule): void {
    if (!this.config.customRules) {
      this.config.customRules = [];
    }
    this.config.customRules.push(rule);
  }

  removeCustomRule(name: string): boolean {
    if (!this.config.customRules) return false;
    
    const index = this.config.customRules.findIndex(r => r.name === name);
    if (index >= 0) {
      this.config.customRules.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Global template validator
let globalTemplateValidator: TemplateValidator | null = null;

export function createTemplateValidator(
  config?: Partial<ValidationConfig>
): TemplateValidator {
  return new TemplateValidator(config);
}

export function getGlobalTemplateValidator(): TemplateValidator {
  if (!globalTemplateValidator) {
    globalTemplateValidator = new TemplateValidator();
  }
  return globalTemplateValidator;
}

export function setGlobalTemplateValidator(validator: TemplateValidator): void {
  globalTemplateValidator = validator;
}