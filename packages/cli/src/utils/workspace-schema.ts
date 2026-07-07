import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';

import glob from 'glob';
import { ValidationError } from './error-handler';

/**
 * Root schema describing a workspace definition for a Re-Shell monorepo.
 *
 * This structure is the source of truth for how workspaces are discovered,
 * typed, built, tested, and interrelated within a single repository.
 */
export interface WorkspaceDefinition {
  /** Schema version of the workspace definition (e.g. `"1.0"`). */
  version: string;
  /** Human-readable name of the workspace/monorepo. */
  name: string;
  /** Optional short description of the workspace's purpose. */
  description?: string;
  /** Root directory of the monorepo, relative to the definition file. */
  root: string;

  /** Glob patterns used to discover workspace directories. */
  patterns: string[];

  /**
   * Mapping of workspace type identifiers (e.g. `app`, `package`) to their
   * respective configuration objects.
   */
  types: {
    [key: string]: WorkspaceTypeConfig;
  };

  /** Mapping of individual workspace identifiers to their definitions. */
  workspaces: {
    [key: string]: WorkspaceEntry;
  };

  /** Mapping of workspace identifiers to their declared dependencies. */
  dependencies: {
    [key: string]: WorkspaceDependency[];
  };

  /** Build and development configuration applied to all workspaces. */
  build: {
    /** ECMAScript build target (e.g. `es2020`). */
    target?: string;
    /** Whether builds may run in parallel. */
    parallel?: boolean;
    /** Maximum number of workspaces that may build concurrently. */
    maxConcurrency?: number;
    /** Whether build caching is enabled. */
    cache?: boolean;
    /** Directory where build output is written. */
    outputDir?: string;
    /** Whether sourcemaps should be generated. */
    sourcemap?: boolean;
  };

  /** Development server configuration for running workspaces locally. */
  dev: {
    /** Whether dev servers should run concurrently or sequentially. */
    mode?: 'concurrent' | 'sequential';
    /** Optional path-to-URL proxy mappings for the dev server. */
    proxy?: Record<string, string>;
    /** Whether CORS headers should be enabled. */
    cors?: boolean;
    /** Whether hot module reloading is enabled. */
    hot?: boolean;
  };

  /** Testing configuration applied across workspaces. */
  test: {
    /** Coverage collection settings. */
    coverage?: {
      /** Whether coverage collection is enabled. */
      enabled: boolean;
      /** Minimum coverage percentage required (0-100). */
      threshold: number;
      /** Glob patterns of paths to exclude from coverage. */
      exclude?: string[];
    };
    /** Whether tests may run in parallel. */
    parallel?: boolean;
    /** Maximum duration in milliseconds a test run may take before timing out. */
    timeout?: number;
  };

  /** Named scripts that can be run across one or more workspaces. */
  scripts: {
    [key: string]: WorkspaceScript;
  };

  /** Optional per-environment overrides keyed by environment name. */
  environments?: {
    [key: string]: Partial<WorkspaceDefinition>;
  };

  /** Optional list of plugins to load for this workspace. */
  plugins?: string[];

  /** Optional metadata tracking creation/modification and tags. */
  metadata?: {
    /** ISO timestamp of when the workspace was created. */
    created: string;
    /** ISO timestamp of the last modification. */
    lastModified: string;
    /** Optional author identifier. */
    author?: string;
    /** Optional list of free-form tags. */
    tags?: string[];
    /** Allows additional arbitrary metadata fields. */
    [key: string]: any;
  };
}

/**
 * Configuration for a category of workspace (e.g. `app`, `package`, `tool`).
 *
 * A `WorkspaceTypeConfig` defines how workspaces of a given type are built,
 * tested, linted, detected, and structured on disk.
 */
export interface WorkspaceTypeConfig {
  /** Display name of the workspace type. */
  name: string;
  /** Optional description of the workspace type. */
  description?: string;
  /** Optional framework identifier (e.g. `react`, `vue`). */
  framework?: string;
  /** Optional template identifier used to scaffold this type. */
  template?: string;

  /** Build configuration for this workspace type. */
  build?: {
    /** Command used to build the workspace. */
    command?: string;
    /** Directory where build output is emitted. */
    outputDir?: string;
    /** Environment variables to set during the build. */
    env?: Record<string, string>;
    /** Additional dependencies required to build this type. */
    dependencies?: string[];
  };

  /** Development configuration for this workspace type. */
  dev?: {
    /** Command used to start the dev server. */
    command?: string;
    /** Port the dev server listens on. */
    port?: number;
    /** Environment variables to set for the dev server. */
    env?: Record<string, string>;
  };

  /** Testing configuration for this workspace type. */
  test?: {
    /** Command used to run tests. */
    command?: string;
    /** Glob pattern matching test files. */
    pattern?: string;
    /** Environment variables to set when running tests. */
    env?: Record<string, string>;
  };

  /** Linting configuration for this workspace type. */
  lint?: {
    /** Command used to run the linter. */
    command?: string;
    /** Files or globs to lint. */
    files?: string[];
    /** Environment variables to set when linting. */
    env?: Record<string, string>;
  };

  /** Type checking configuration for this workspace type. */
  typecheck?: {
    /** Command used to run type checking. */
    command?: string;
    /** Files or globs to type check. */
    files?: string[];
    /** Environment variables to set when type checking. */
    env?: Record<string, string>;
  };

  /** File patterns describing the layout of this workspace type. */
  patterns?: {
    /** Globs matching source files. */
    source?: string[];
    /** Globs matching test files. */
    test?: string[];
    /** Globs matching configuration files. */
    config?: string[];
    /** Globs matching static asset files. */
    assets?: string[];
  };

  /** Files that must exist for a workspace of this type to be valid. */
  requiredFiles?: string[];

  /** Rules used to auto-detect whether a directory matches this type. */
  detection?: {
    /** Files whose presence indicates this type. */
    files?: string[];
    /** package.json fields whose presence indicates this type. */
    packageJsonFields?: string[];
    /** Commands whose availability indicates this type. */
    commands?: string[];
  };
}

/**
 * Definition of an individual workspace within the monorepo.
 *
 * A `WorkspaceEntry` references a workspace type and may override any of the
 * type-level configuration sections for this specific workspace.
 */
export interface WorkspaceEntry {
  /** Identifier of the workspace, unique within the definition. */
  name: string;
  /** Key into `WorkspaceDefinition.types` describing this workspace's type. */
  type: string;
  /** Path to the workspace directory, relative to the workspace root. */
  path: string;
  /** Optional human-readable description of the workspace. */
  description?: string;

  /** Optional override of the type-level build configuration. */
  build?: Partial<WorkspaceTypeConfig['build']>;
  /** Optional override of the type-level dev configuration. */
  dev?: Partial<WorkspaceTypeConfig['dev']>;
  /** Optional override of the type-level test configuration. */
  test?: Partial<WorkspaceTypeConfig['test']>;
  /** Optional override of the type-level lint configuration. */
  lint?: Partial<WorkspaceTypeConfig['lint']>;
  /** Optional override of the type-level typecheck configuration. */
  typecheck?: Partial<WorkspaceTypeConfig['typecheck']>;

  /** Workspace-specific environment variables applied to all commands. */
  env?: Record<string, string>;

  /** Tags used to group or filter this workspace. */
  tags?: string[];

  /** Whether this workspace is currently active. */
  active?: boolean;

  /** Free-form custom metadata for this workspace. */
  metadata?: Record<string, unknown>;
}

/**
 * Describes a dependency from one workspace to another.
 */
export interface WorkspaceDependency {
  /** Name of the workspace this dependency points to. */
  name: string;
  /** Phase in which the dependency is required. */
  type: 'build' | 'dev' | 'test' | 'runtime';
  /** Optional version constraint for the dependency. */
  version?: string;
  /** Whether the dependency is optional. */
  optional?: boolean;
  /** Named conditions under which this dependency applies. */
  conditions?: string[];
}

/**
 * Definition of a named script that can be executed across workspaces.
 */
export interface WorkspaceScript {
  /** Optional human-readable description of what the script does. */
  description?: string;
  /** Shell command executed by this script. */
  command: string;
  /** Workspaces to run the command in, or `'all'` for every workspace. */
  workspaces?: string[] | 'all';
  /** Whether the script may run across workspaces in parallel. */
  parallel?: boolean;
  /** Whether execution should continue after a workspace fails. */
  continueOnError?: boolean;
  /** Environment variables to set when running the script. */
  env?: Record<string, string>;
  /** Maximum duration in milliseconds the script may run before timing out. */
  timeout?: number;
  /** Whether results of this script should be cached. */
  cache?: boolean;
}

/**
 * Outcome of validating a workspace definition or on-disk structure.
 */
export interface ValidationResult {
  /** `true` when no errors were found; `false` otherwise. */
  valid: boolean;
  /** Errors that block the workspace from being considered valid. */
  errors: ValidationError[];
  /** Non-blocking issues that the user may want to address. */
  warnings: ValidationWarning[];
  /** Optional improvements the user may apply. */
  suggestions: ValidationSuggestion[];
}

/**
 * A non-blocking warning produced during validation.
 */
export interface ValidationWarning {
  /** Dotted path to the offending field in the definition. */
  path: string;
  /** Human-readable description of the warning. */
  message: string;
  /** Severity of the warning. */
  severity: 'low' | 'medium' | 'high';
}

/**
 * A suggested improvement produced during validation.
 */
export interface ValidationSuggestion {
  /** Dotted path to the relevant field in the definition. */
  path: string;
  /** Human-readable description of the suggestion. */
  message: string;
  /** Optional instructions for applying the suggested fix. */
  fix?: string;
}

/**
 * Default workspace definition used as the baseline for new Re-Shell monorepos.
 *
 * Includes sensible defaults for workspace types (`app`, `package`, `tool`),
 * build/dev/test configuration, and the `build:all`, `test:all`, and
 * `lint:all` scripts.
 */
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

/**
 * Validates a `WorkspaceDefinition` for structural correctness and consistency
 * against the files on disk.
 *
 * A validator instance is bound to a single definition and root path, and
 * exposes methods to validate the definition itself, the workspace structure
 * on disk, and to auto-detect workspaces from the configured patterns.
 */
export class WorkspaceSchemaValidator {
  private definition: WorkspaceDefinition;
  private rootPath: string;

  /**
   * Create a new validator for the given definition.
   *
   * @param definition - The workspace definition to validate.
   * @param rootPath - Absolute path used as the workspace root for on-disk checks.
   * Defaults to the current working directory.
   */
  constructor(definition: WorkspaceDefinition, rootPath: string = process.cwd()) {
    this.definition = definition;
    this.rootPath = rootPath;
  }

  /**
   * Validate the entire workspace definition for correctness and consistency.
   *
   * @returns A promise resolving to the validation result containing any
   * errors, warnings, and suggestions produced.
   */
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

  /**
   * Validate the workspace definition against the actual structure on disk.
   *
   * Verifies that referenced workspace directories exist, that any
   * type-required files are present, and that workspace `package.json`
   * files are consistent with their definitions. Also reports orphaned
   * directories that look like workspaces but are not defined.
   *
   * @returns A promise resolving to the validation result containing any
   * errors, warnings, and suggestions produced.
   */
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

  /**
   * Auto-detect workspaces by matching the configured patterns against the
   * filesystem and inferring each match's type from the configured detection
   * rules.
   *
   * @returns A promise resolving to the list of detected workspace entries.
   * @throws {ValidationError} When the detection process fails.
   */
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

/**
 * Load and validate a workspace definition from a YAML file on disk.
 *
 * @param filePath - Absolute or relative path to the workspace definition file.
 * @returns A promise resolving to the parsed and validated `WorkspaceDefinition`.
 * @throws {ValidationError} When the file is missing, cannot be parsed, or
 * fails validation.
 */
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

/**
 * Validate and persist a workspace definition to a YAML file on disk.
 *
 * The definition is validated before saving and its `metadata.lastModified`
 * timestamp is updated. The parent directory is created if it does not exist.
 *
 * @param definition - The workspace definition to save.
 * @param filePath - Absolute or relative path to the destination file.
 * @returns A promise that resolves once the file has been written.
 * @throws {ValidationError} When the definition is invalid or the file
 * cannot be written.
 */
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

/**
 * Create a new workspace definition seeded from `DEFAULT_WORKSPACE_DEFINITION`.
 *
 * @param name - Name to assign to the new workspace definition.
 * @param options - Optional overrides applied on top of the defaults.
 * @returns A new `WorkspaceDefinition` with default values and the provided
 * overrides applied.
 */
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