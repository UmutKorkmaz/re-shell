import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import chalk from 'chalk';
import glob from 'glob';
import { ValidationError } from './error-handler';

// Workspace definition schema
export interface WorkspaceDefinition {
  version: string;
  name: string;
  description?: string;
  root: string;
  
  // Workspace discovery patterns
  patterns: string[];
  
  // Workspace types and their configurations
  types: {
    [key: string]: WorkspaceTypeConfig;
  };
  
  // Individual workspace definitions
  workspaces: {
    [key: string]: WorkspaceEntry;
  };
  
  // Dependencies between workspaces
  dependencies: {
    [key: string]: WorkspaceDependency[];
  };
  
  // Build and development configuration
  build: {
    target?: string;
    parallel?: boolean;
    maxConcurrency?: number;
    cache?: boolean;
    outputDir?: string;
    sourcemap?: boolean;
  };
  
  // Development server configuration
  dev: {
    mode?: 'concurrent' | 'sequential';
    proxy?: Record<string, string>;
    cors?: boolean;
    hot?: boolean;
  };
  
  // Testing configuration
  test: {
    coverage?: {
      enabled: boolean;
      threshold: number;
      exclude?: string[];
    };
    parallel?: boolean;
    timeout?: number;
  };
  
  // Scripts that can be run across workspaces
  scripts: {
    [key: string]: WorkspaceScript;
  };
  
  // Environment-specific overrides
  environments?: {
    [key: string]: Partial<WorkspaceDefinition>;
  };
  
  // Plugin configuration
  plugins?: string[];
  
  // Metadata
  metadata?: {
    created: string;
    lastModified: string;
    author?: string;
    tags?: string[];
    [key: string]: any;
  };
}

// Workspace type configuration
export interface WorkspaceTypeConfig {
  name: string;
  description?: string;
  framework?: string;
  template?: string;
  
  // Build configuration for this type
  build?: {
    command?: string;
    outputDir?: string;
    env?: Record<string, string>;
    dependencies?: string[];
  };
  
  // Development configuration
  dev?: {
    command?: string;
    port?: number;
    env?: Record<string, string>;
  };
  
  // Testing configuration
  test?: {
    command?: string;
    pattern?: string;
    env?: Record<string, string>;
  };
  
  // Linting configuration
  lint?: {
    command?: string;
    files?: string[];
    env?: Record<string, string>;
  };
  
  // Type checking configuration
  typecheck?: {
    command?: string;
    files?: string[];
    env?: Record<string, string>;
  };
  
  // File patterns for this workspace type
  patterns?: {
    source?: string[];
    test?: string[];
    config?: string[];
    assets?: string[];
  };
  
  // Required files for this type
  requiredFiles?: string[];
  
  // Auto-detection rules
  detection?: {
    files?: string[];
    packageJsonFields?: string[];
    commands?: string[];
  };
}

// Individual workspace entry
export interface WorkspaceEntry {
  name: string;
  type: string;
  path: string;
  description?: string;
  
  // Override type-level configuration
  build?: Partial<WorkspaceTypeConfig['build']>;
  dev?: Partial<WorkspaceTypeConfig['dev']>;
  test?: Partial<WorkspaceTypeConfig['test']>;
  lint?: Partial<WorkspaceTypeConfig['lint']>;
  typecheck?: Partial<WorkspaceTypeConfig['typecheck']>;
  
  // Workspace-specific environment variables
  env?: Record<string, string>;
  
  // Tags for grouping and filtering
  tags?: string[];
  
  // Whether this workspace is active
  active?: boolean;
  
  // Custom metadata
  metadata?: Record<string, any>;
}

// Workspace dependency definition
export interface WorkspaceDependency {
  name: string;
  type: 'build' | 'dev' | 'test' | 'runtime';
  version?: string;
  optional?: boolean;
  conditions?: string[];
}

// Workspace script definition
export interface WorkspaceScript {
  description?: string;
  command: string;
  workspaces?: string[] | 'all';
  parallel?: boolean;
  continueOnError?: boolean;
  env?: Record<string, string>;
  timeout?: number;
  cache?: boolean;
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationWarning {
  path: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ValidationSuggestion {
  path: string;
  message: string;
  fix?: string;
}

// Default workspace definition
export const DEFAULT_WORKSPACE_DEFINITION: WorkspaceDefinition = {
  version: '1.0',
  name: 'monorepo',
  description: 'Re-Shell monorepo workspace definition',
  root: '.',
  patterns: [
    'apps/*',
    'packages/*',
    'libs/*',
    'tools/*'
  ],
  types: {
    app: {
      name: 'Application',
      description: 'Frontend applications',
      framework: 'react',
      build: {
        command: 'npm run build',
        outputDir: 'dist'
      },
      dev: {
        command: 'npm run dev',
        port: 3000
      },
      test: {
        command: 'npm run test'
      },
      patterns: {
        source: ['src/**/*'],
        test: ['**/*.test.*', '**/*.spec.*'],
        config: ['*.config.*', 'config/*'],
        assets: ['public/**/*', 'assets/**/*']
      },
      requiredFiles: ['package.json'],
      detection: {
        files: ['src/index.tsx', 'src/App.tsx'],
        packageJsonFields: ['scripts.dev', 'scripts.build']
      }
    },
    package: {
      name: 'Package',
      description: 'Shared packages and libraries',
      build: {
        command: 'npm run build',
        outputDir: 'dist'
      },
      test: {
        command: 'npm run test'
      },
      patterns: {
        source: ['src/**/*', 'lib/**/*'],
        test: ['**/*.test.*', '**/*.spec.*']
      },
      requiredFiles: ['package.json'],
      detection: {
        files: ['src/index.ts', 'lib/index.js'],
        packageJsonFields: ['main', 'module', 'types']
      }
    },
    tool: {
      name: 'Tool',
      description: 'Development tools and utilities',
      build: {
        command: 'npm run build'
      },
      patterns: {
        source: ['src/**/*', 'bin/**/*'],
        config: ['*.config.*']
      },
      requiredFiles: ['package.json']
    }
  },
  workspaces: {},
  dependencies: {},
  build: {
    target: 'es2020',
    parallel: true,
    maxConcurrency: 4,
    cache: true,
    sourcemap: true
  },
  dev: {
    mode: 'concurrent',
    cors: true,
    hot: true
  },
  test: {
    coverage: {
      enabled: true,
      threshold: 80,
      exclude: ['dist/**', 'node_modules/**']
    },
    parallel: true,
    timeout: 30000
  },
  scripts: {
    'build:all': {
      description: 'Build all workspaces',
      command: 'npm run build',
      workspaces: 'all',
      parallel: true
    },
    'test:all': {
      description: 'Test all workspaces',
      command: 'npm run test',
      workspaces: 'all',
      parallel: true,
      continueOnError: true
    },
    'lint:all': {
      description: 'Lint all workspaces',
      command: 'npm run lint',
      workspaces: 'all',
      parallel: true,
      continueOnError: true
    }
  }
};

// Workspace schema validator
export class WorkspaceSchemaValidator {
  private definition: WorkspaceDefinition;
  private rootPath: string;

  constructor(definition: WorkspaceDefinition, rootPath: string = process.cwd()) {
    this.definition = definition;
    this.rootPath = rootPath;
  }

  // Validate the entire workspace definition
  async validateDefinition(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Validate required fields
      this.validateRequiredFields(errors);
      
      // Validate version compatibility
      this.validateVersion(errors, warnings);
      
      // Validate workspace types
      this.validateWorkspaceTypes(errors, warnings);
      
      // Validate workspace entries
      await this.validateWorkspaceEntries(errors, warnings, suggestions);
      
      // Validate dependencies
      this.validateDependencies(errors, warnings);
      
      // Validate scripts
      this.validateScripts(errors, warnings);
      
      // Validate patterns
      this.validatePatterns(warnings, suggestions);
      
      // Validate build configuration
      this.validateBuildConfig(warnings, suggestions);

    } catch (error) {
      errors.push(new ValidationError(`Validation failed: ${(error as Error).message}`));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  // Validate workspace structure on disk
  async validateWorkspaceStructure(): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    try {
      // Check if workspace directories exist
      for (const [name, workspace] of Object.entries(this.definition.workspaces)) {
        const workspacePath = path.resolve(this.rootPath, workspace.path);
        
        if (!(await fs.pathExists(workspacePath))) {
          errors.push(new ValidationError(`Workspace directory not found: ${workspace.path}`));
          continue;
        }

        // Check required files for workspace type
        const typeConfig = this.definition.types[workspace.type];
        if (typeConfig?.requiredFiles) {
          for (const requiredFile of typeConfig.requiredFiles) {
            const filePath = path.join(workspacePath, requiredFile);
            if (!(await fs.pathExists(filePath))) {
              errors.push(new ValidationError(
                `Required file missing in workspace '${name}': ${requiredFile}`
              ));
            }
          }
        }

        // Validate workspace package.json if it exists
        const packageJsonPath = path.join(workspacePath, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
          try {
            const packageJson = await fs.readJson(packageJsonPath);
            this.validateWorkspacePackageJson(packageJson, name, workspace, warnings, suggestions);
          } catch (error) {
            errors.push(new ValidationError(
              `Invalid package.json in workspace '${name}': ${(error as Error).message}`
            ));
          }
        }
      }

      // Check for orphaned directories (exist on disk but not in definition)
      await this.checkOrphanedWorkspaces(warnings, suggestions);

    } catch (error) {
      errors.push(new ValidationError(`Structure validation failed: ${(error as Error).message}`));
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  // Auto-detect workspaces based on patterns and types
  async autoDetectWorkspaces(): Promise<WorkspaceEntry[]> {
    const detected: WorkspaceEntry[] = [];

    try {
      for (const pattern of this.definition.patterns) {

        const matches = glob.sync(pattern, { cwd: this.rootPath });

        for (const match of matches) {
          const workspacePath = path.resolve(this.rootPath, match);
          
          if (await fs.pathExists(workspacePath)) {
            const stat = await fs.stat(workspacePath);
            if (stat.isDirectory()) {
              const detectedWorkspace = await this.detectWorkspaceType(match, workspacePath);
              if (detectedWorkspace) {
                detected.push(detectedWorkspace);
              }
            }
          }
        }
      }
    } catch (error) {
      throw new ValidationError(`Auto-detection failed: ${(error as Error).message}`);
    }

    return detected;
  }

  // Private validation methods
  private validateRequiredFields(errors: ValidationError[]): void {
    const required = ['version', 'name', 'root', 'patterns', 'types'];
    
    for (const field of required) {
      if (!(field in this.definition) || this.definition[field as keyof WorkspaceDefinition] === undefined) {
        errors.push(new ValidationError(`Required field missing: ${field}`));
      }
    }

    if (this.definition.patterns && this.definition.patterns.length === 0) {
      errors.push(new ValidationError('At least one workspace pattern is required'));
    }
  }

  private validateVersion(errors: ValidationError[], warnings: ValidationWarning[]): void {
    const version = this.definition.version;
    const supportedVersions = ['1.0'];

    if (!supportedVersions.includes(version)) {
      errors.push(new ValidationError(`Unsupported version: ${version}. Supported: ${supportedVersions.join(', ')}`));
    }
  }

  private validateWorkspaceTypes(errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!this.definition.types || Object.keys(this.definition.types).length === 0) {
      errors.push(new ValidationError('At least one workspace type must be defined'));
      return;
    }

    for (const [typeName, typeConfig] of Object.entries(this.definition.types)) {
      if (!typeConfig.name) {
        errors.push(new ValidationError(`Workspace type '${typeName}' missing name field`));
      }

      // Validate commands exist if specified
      if (typeConfig.build?.command) {
        this.validateCommand(typeConfig.build.command, `${typeName}.build.command`, warnings);
      }
    }
  }

  private async validateWorkspaceEntries(
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): Promise<void> {
    const workspaceNames = new Set<string>();
    const workspacePaths = new Set<string>();

    for (const [name, workspace] of Object.entries(this.definition.workspaces)) {
      // Check for duplicate names
      if (workspaceNames.has(name)) {
        errors.push(new ValidationError(`Duplicate workspace name: ${name}`));
      }
      workspaceNames.add(name);

      // Check for duplicate paths
      if (workspacePaths.has(workspace.path)) {
        errors.push(new ValidationError(`Duplicate workspace path: ${workspace.path}`));
      }
      workspacePaths.add(workspace.path);

      // Validate workspace type exists
      if (!this.definition.types[workspace.type]) {
        errors.push(new ValidationError(`Unknown workspace type '${workspace.type}' in workspace '${name}'`));
      }

      // Validate path format
      if (path.isAbsolute(workspace.path)) {
        warnings.push({
          path: `workspaces.${name}.path`,
          message: 'Absolute paths are not recommended for portability',
          severity: 'medium'
        });
      }
    }
  }

  private validateDependencies(errors: ValidationError[], warnings: ValidationWarning[]): void {
    const workspaceNames = new Set(Object.keys(this.definition.workspaces));

    for (const [workspaceName, deps] of Object.entries(this.definition.dependencies)) {
      if (!workspaceNames.has(workspaceName)) {
        errors.push(new ValidationError(`Dependencies defined for unknown workspace: ${workspaceName}`));
        continue;
      }

      for (const dep of deps) {
        if (!workspaceNames.has(dep.name)) {
          errors.push(new ValidationError(
            `Unknown dependency '${dep.name}' in workspace '${workspaceName}'`
          ));
        }

        // Check for self-dependencies
        if (dep.name === workspaceName) {
          errors.push(new ValidationError(`Workspace '${workspaceName}' cannot depend on itself`));
        }
      }
    }

    // TODO: Implement cycle detection (will be done in next task)
  }

  private validateScripts(errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [scriptName, script] of Object.entries(this.definition.scripts || {})) {
      if (!script.command) {
        errors.push(new ValidationError(`Script '${scriptName}' missing command`));
      }

      // Validate workspace targets
      if (Array.isArray(script.workspaces)) {
        const workspaceNames = new Set(Object.keys(this.definition.workspaces));
        for (const workspace of script.workspaces) {
          if (!workspaceNames.has(workspace)) {
            errors.push(new ValidationError(
              `Script '${scriptName}' targets unknown workspace: ${workspace}`
            ));
          }
        }
      }
    }
  }

  private validatePatterns(warnings: ValidationWarning[], suggestions: ValidationSuggestion[]): void {
    // Check for overly broad patterns
    for (const pattern of this.definition.patterns) {
      if (pattern === '*' || pattern === '**/*') {
        warnings.push({
          path: 'patterns',
          message: `Pattern '${pattern}' is very broad and may include unintended directories`,
          severity: 'medium'
        });
      }
    }
  }

  private validateBuildConfig(warnings: ValidationWarning[], suggestions: ValidationSuggestion[]): void {
    const buildConfig = this.definition.build;
    
    if (buildConfig.maxConcurrency && buildConfig.maxConcurrency > 10) {
      warnings.push({
        path: 'build.maxConcurrency',
        message: 'High concurrency may overwhelm system resources',
        severity: 'low'
      });
    }

    if (!buildConfig.cache) {
      suggestions.push({
        path: 'build.cache',
        message: 'Consider enabling build cache for better performance',
        fix: 'Set build.cache to true'
      });
    }
  }

  private validateCommand(command: string, path: string, warnings: ValidationWarning[]): void {
    // Check for common command issues
    if (command.includes('npm run') && !command.startsWith('npm run')) {
      warnings.push({
        path,
        message: 'Command should start with npm run for consistency',
        severity: 'low'
      });
    }
  }

  private async detectWorkspaceType(relativePath: string, absolutePath: string): Promise<WorkspaceEntry | null> {
    // Try to detect workspace type based on detection rules
    for (const [typeName, typeConfig] of Object.entries(this.definition.types)) {
      if (typeConfig.detection) {
        let matches = 0;
        let total = 0;

        // Check detection files
        if (typeConfig.detection.files) {
          for (const file of typeConfig.detection.files) {
            total++;
            if (await fs.pathExists(path.join(absolutePath, file))) {
              matches++;
            }
          }
        }

        // Check package.json fields
        if (typeConfig.detection.packageJsonFields) {
          const packageJsonPath = path.join(absolutePath, 'package.json');
          if (await fs.pathExists(packageJsonPath)) {
            try {
              const packageJson = await fs.readJson(packageJsonPath);
              for (const field of typeConfig.detection.packageJsonFields) {
                total++;
                if (this.hasNestedProperty(packageJson, field)) {
                  matches++;
                }
              }
            } catch (error) {
              // Ignore package.json read errors
            }
          }
        }

        // If most detection criteria match, use this type
        if (total > 0 && matches / total > 0.5) {
          const name = path.basename(relativePath);
          return {
            name,
            type: typeName,
            path: relativePath,
            description: `Auto-detected ${typeConfig.name}`,
            active: true,
            tags: ['auto-detected']
          };
        }
      }
    }

    return null;
  }

  private validateWorkspacePackageJson(
    packageJson: any,
    workspaceName: string,
    workspace: WorkspaceEntry,
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): void {
    // Check for consistent naming
    if (packageJson.name && packageJson.name !== workspaceName) {
      warnings.push({
        path: `workspaces.${workspaceName}`,
        message: `Package name '${packageJson.name}' differs from workspace name '${workspaceName}'`,
        severity: 'low'
      });
    }

    // Check for missing scripts based on workspace type
    const typeConfig = this.definition.types[workspace.type];
    if (typeConfig?.build?.command?.includes('npm run')) {
      const scriptName = typeConfig.build.command.replace('npm run ', '');
      if (!packageJson.scripts?.[scriptName]) {
        suggestions.push({
          path: `workspaces.${workspaceName}`,
          message: `Consider adding '${scriptName}' script to package.json`,
          fix: `Add "${scriptName}": "..." to scripts section`
        });
      }
    }
  }

  private async checkOrphanedWorkspaces(
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[]
  ): Promise<void> {
    const definedPaths = new Set(Object.values(this.definition.workspaces).map(w => w.path));
    
    for (const pattern of this.definition.patterns) {

      const matches = glob.sync(pattern, { cwd: this.rootPath });

      for (const match of matches) {
        if (!definedPaths.has(match)) {
          const workspacePath = path.resolve(this.rootPath, match);
          if (await fs.pathExists(path.join(workspacePath, 'package.json'))) {
            suggestions.push({
              path: 'workspaces',
              message: `Directory '${match}' looks like a workspace but is not defined`,
              fix: `Add ${match} to workspaces definition or update patterns`
            });
          }
        }
      }
    }
  }

  private hasNestedProperty(obj: any, propertyPath: string): boolean {
    const parts = propertyPath.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }
    
    return true;
  }
}

// Utility functions
export async function loadWorkspaceDefinition(filePath: string): Promise<WorkspaceDefinition> {
  try {
    if (!(await fs.pathExists(filePath))) {
      throw new ValidationError(`Workspace definition file not found: ${filePath}`);
    }

    const content = await fs.readFile(filePath, 'utf8');
    const definition = yaml.parse(content) as WorkspaceDefinition;

    // Validate basic structure
    const validator = new WorkspaceSchemaValidator(definition, path.dirname(filePath));
    const result = await validator.validateDefinition();

    if (!result.valid) {
      const errorMessages = result.errors.map(err => err.message).join(', ');
      throw new ValidationError(`Invalid workspace definition: ${errorMessages}`);
    }

    return definition;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to load workspace definition: ${(error as Error).message}`);
  }
}

export async function saveWorkspaceDefinition(
  definition: WorkspaceDefinition,
  filePath: string
): Promise<void> {
  try {
    // Validate before saving
    const validator = new WorkspaceSchemaValidator(definition, path.dirname(filePath));
    const result = await validator.validateDefinition();

    if (!result.valid) {
      const errorMessages = result.errors.map(err => err.message).join(', ');
      throw new ValidationError(`Cannot save invalid workspace definition: ${errorMessages}`);
    }

    // Update metadata
    definition.metadata = {
      created: definition.metadata?.created || new Date().toISOString(),
      ...definition.metadata,
      lastModified: new Date().toISOString()
    };

    const content = yaml.stringify(definition, {
      indent: 2,
      lineWidth: 100,
      minContentWidth: 40
    });

    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf8');
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to save workspace definition: ${(error as Error).message}`);
  }
}

export function createDefaultWorkspaceDefinition(
  name: string,
  options: Partial<WorkspaceDefinition> = {}
): WorkspaceDefinition {
  return {
    ...DEFAULT_WORKSPACE_DEFINITION,
    name,
    metadata: {
      created: new Date().toISOString(),
      lastModified: new Date().toISOString()
    },
    ...options
  };
}