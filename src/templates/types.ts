// Template system types for Re-Shell CLI

export interface FileTemplate {
  path: string;
  content: string;
  encoding?: string;
  permissions?: number;
}

export interface BaseTemplate {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  files: Record<string, any>;
  prompts?: TemplatePrompt[];
  postInstall?: string[];
}

export interface BackendTemplate extends BaseTemplate {
  framework: string;
  displayName: string;
  language: 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'java' | 'csharp' | 'php' | 'ruby' | 'lua' | 'cpp' | 'kotlin' | 'scala' | 'elixir' | 'swift' | 'dart' | 'crystal' | 'zig' | 'nim' | 'v' | 'gleam' | 'haskell' | 'fsharp' | 'clojure' | 'perl' | 'julia' | 'deno' | 'bun' | 'ocaml' | 'odin' | 'pony' | 'red' | 'rescript' | 'grain' | 'mojo' | 'roc' | 'ballerina' | 'unison';
  port?: number;
  features?: BackendFeature[];
}

export interface FrontendTemplate extends BaseTemplate {
  framework: 'react' | 'vue' | 'svelte' | 'angular' | 'vanilla';
  language: 'typescript' | 'javascript';
  buildTool: 'vite' | 'webpack' | 'rollup' | 'esbuild';
  features?: FrontendFeature[];
}

export interface DatabaseTemplate extends BaseTemplate {
  type: 'sql' | 'nosql' | 'graph' | 'cache';
  engine: string;
  orm?: string;
  migrations?: boolean;
}

export interface TemplatePrompt {
  type: 'input' | 'confirm' | 'list' | 'checkbox' | 'password';
  name: string;
  message: string;
  default?: any;
  choices?: string[] | PromptChoice[];
  when?: (answers: Record<string, any>) => boolean;
  validate?: (input: any) => boolean | string;
  filter?: (input: any) => any;
}

export interface PromptChoice {
  name: string;
  value: any;
  short?: string;
}

export type BackendFeature =
  | 'authentication'
  | 'authorization'
  | 'database'
  | 'caching'
  | 'logging'
  | 'monitoring'
  | 'testing'
  | 'documentation'
  | 'security'
  | 'validation'
  | 'rate-limiting'
  | 'cors'
  | 'compression'
  | 'session-management'
  | 'file-upload'
  | 'email'
  | 'websockets'
  | 'graphql'
  | 'rest-api'
  | 'microservices'
  | 'docker'
  | 'ci-cd'
  | 'queue'
  | 'routing'
  | 'middleware'
  | 'streaming'
  | 'swagger'
  | 'channels'
  | 'wasi'
  | 'simd'
  | 'performance'
  | 'python-interop'
  | 'grpc'
  | 'caching'
  | 'deprecation'
  | 'migration'
  | 'cli'
  | 'sessions'
  | 'pubsub'
  | 'connection-pooling'
  | 'monitoring'
  | 'jsonb'
  | 'json'
  | 'fulltext'
  | 'extensions';

export type FrontendFeature =
  | 'routing'
  | 'state-management'
  | 'styling'
  | 'testing'
  | 'pwa'
  | 'ssr'
  | 'ssg'
  | 'i18n'
  | 'accessibility'
  | 'performance'
  | 'error-tracking'
  | 'analytics'
  | 'ui-library'
  | 'forms'
  | 'charts'
  | 'animations'
  | 'theming'
  | 'responsive'
  | 'typescript';

export interface TemplateContext {
  projectName: string;
  author?: string;
  description?: string;
  version?: string;
  license?: string;
  repository?: string;
  keywords?: string[];
  features?: string[];
  [key: string]: any;
}

export interface TemplateGenerationOptions {
  template: BaseTemplate;
  context: TemplateContext;
  outputPath: string;
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface TemplateGenerationResult {
  success: boolean;
  filesCreated: string[];
  filesSkipped: string[];
  errors: string[];
  warnings: string[];
  postInstallCommands?: string[];
}

// Template metadata for discovery and filtering
export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  category: 'backend' | 'frontend' | 'fullstack' | 'database' | 'utility';
  framework: string;
  language: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  features: string[];
  prerequisites?: string[];
  documentation?: string;
  examples?: string[];
  maintainer?: string;
  repository?: string;
  license?: string;
  lastUpdated?: Date;
  downloads?: number;
  rating?: number;
}

// Template registry for managing available templates
export interface TemplateRegistry {
  templates: Map<string, BaseTemplate>;
  metadata: Map<string, TemplateMetadata>;
  categories: Map<string, string[]>;
  tags: Map<string, string[]>;
}

// Template validation schemas
export interface TemplateValidationResult {
  valid: boolean;
  errors: TemplateValidationError[];
  warnings: TemplateValidationWarning[];
}

export interface TemplateValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface TemplateValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Custom template hooks for advanced functionality
export interface TemplateHooks {
  beforeGeneration?: (context: TemplateContext) => Promise<void>;
  afterGeneration?: (result: TemplateGenerationResult) => Promise<void>;
  beforeFileWrite?: (filePath: string, content: string) => Promise<string>;
  afterFileWrite?: (filePath: string) => Promise<void>;
  onError?: (error: Error) => Promise<void>;
}

// Template engine configuration
export interface TemplateEngineConfig {
  interpolationRegex?: RegExp;
  conditionalRegex?: RegExp;
  loopRegex?: RegExp;
  includeRegex?: RegExp;
  escapeHtml?: boolean;
  strictMode?: boolean;
  customHelpers?: Record<string, (...args: any[]) => any>;
}

// Language-specific template configurations
export interface TypeScriptConfig {
  target: string;
  module: string;
  strict: boolean;
  esModuleInterop: boolean;
  skipLibCheck: boolean;
  forceConsistentCasingInFileNames: boolean;
  declaration?: boolean;
  sourceMap?: boolean;
  outDir?: string;
  rootDir?: string;
  include?: string[];
  exclude?: string[];
  compilerOptions?: Record<string, any>;
}

export interface ESLintConfig {
  env: Record<string, boolean>;
  extends: string[];
  parser?: string;
  parserOptions?: Record<string, any>;
  plugins?: string[];
  rules: Record<string, any>;
  overrides?: Array<{
    files: string[];
    rules?: Record<string, any>;
  }>;
}

export interface PrettierConfig {
  semi: boolean;
  trailingComma: string;
  singleQuote: boolean;
  printWidth: number;
  tabWidth: number;
  useTabs: boolean;
  [key: string]: any;
}

// Docker configuration for templates
export interface DockerConfig {
  baseImage: string;
  workdir: string;
  exposedPorts: number[];
  volumes?: string[];
  environment?: Record<string, string>;
  buildArgs?: Record<string, string>;
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
  };
}

// CI/CD configuration templates
export interface CICDConfig {
  provider: 'github' | 'gitlab' | 'jenkins' | 'circleci' | 'azure';
  triggers: string[];
  jobs: CICDJob[];
  environment?: Record<string, string>;
  secrets?: string[];
}

export interface CICDJob {
  name: string;
  runsOn: string;
  steps: CICDStep[];
  needs?: string[];
  if?: string;
  environment?: Record<string, string>;
}

export interface CICDStep {
  name: string;
  uses?: string;
  run?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
  if?: string;
}