import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';
import glob from 'fast-glob';

export interface InteractiveDocsConfig {
  outputPath?: string;
  templatePath?: string;
  includeExamples?: boolean;
  includeLiveDemo?: boolean;
  includeTypeDefinitions?: boolean;
  includeCodePlayground?: boolean;
  generateStaticSite?: boolean;
  autoRefresh?: boolean;
  port?: number;
  theme?: DocsTheme;
  customizations?: DocsCustomization;
  integrations?: DocsIntegration[];
}

export interface DocsTheme {
  name: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  layout: ThemeLayout;
  components: ThemeComponents;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  headingFont: string;
  codeFont: string;
}

export interface ThemeLayout {
  maxWidth: string;
  sidebarWidth: string;
  headerHeight: string;
  spacing: string;
  borderRadius: string;
}

export interface ThemeComponents {
  button: ComponentStyle;
  input: ComponentStyle;
  card: ComponentStyle;
  code: ComponentStyle;
  table: ComponentStyle;
}

export interface ComponentStyle {
  background: string;
  border: string;
  padding: string;
  margin: string;
  borderRadius: string;
  boxShadow?: string;
}

export interface DocsCustomization {
  logo?: string;
  favicon?: string;
  title?: string;
  description?: string;
  customCSS?: string;
  customJS?: string;
  socialLinks?: SocialLink[];
  navigation?: NavigationItem[];
}

export interface SocialLink {
  platform: 'github' | 'twitter' | 'discord' | 'slack' | 'linkedin';
  url: string;
  icon?: string;
}

export interface NavigationItem {
  title: string;
  url: string;
  external?: boolean;
  children?: NavigationItem[];
}

export interface DocsIntegration {
  type: 'analytics' | 'search' | 'comments' | 'feedback' | 'chat';
  provider: string;
  config: Record<string, any>;
}

export interface APIDocumentation {
  metadata: DocsMetadata;
  commands: CommandDocumentation[];
  types: TypeDocumentation[];
  examples: ExampleDocumentation[];
  guides: GuideDocumentation[];
  playground: PlaygroundConfiguration;
  search: SearchConfiguration;
}

export interface DocsMetadata {
  title: string;
  version: string;
  description: string;
  lastUpdated: Date;
  contributors: Contributor[];
  license: string;
  repository: string;
  homepage: string;
}

export interface Contributor {
  name: string;
  email?: string;
  github?: string;
  role: string;
}

export interface CommandDocumentation {
  name: string;
  category: string;
  description: string;
  synopsis: string;
  usage: UsageExample[];
  options: OptionDocumentation[];
  examples: CodeExample[];
  relatedCommands: string[];
  since: string;
  deprecated?: DeprecationInfo;
  tags: string[];
  complexity: 'beginner' | 'intermediate' | 'advanced';
}

export interface UsageExample {
  pattern: string;
  description: string;
  required: boolean;
}

export interface OptionDocumentation {
  name: string;
  alias?: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  default?: any;
  required: boolean;
  choices?: any[];
  validation?: ValidationRule[];
  examples: string[];
  since?: string;
  deprecated?: DeprecationInfo;
}

export interface ValidationRule {
  type: 'min' | 'max' | 'pattern' | 'enum' | 'custom';
  value: any;
  message: string;
}

export interface DeprecationInfo {
  since: string;
  reason: string;
  replacement?: string;
  removalVersion?: string;
}

export interface CodeExample {
  id: string;
  title: string;
  description: string;
  code: string;
  language: string;
  output?: string;
  interactive: boolean;
  playgroundEnabled: boolean;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  prerequisites?: string[];
  relatedExamples?: string[];
}

export interface TypeDocumentation {
  name: string;
  type: 'interface' | 'type' | 'enum' | 'class';
  description: string;
  definition: string;
  properties?: PropertyDocumentation[];
  methods?: MethodDocumentation[];
  examples: TypeExample[];
  since: string;
  module: string;
}

export interface PropertyDocumentation {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  readonly: boolean;
  default?: any;
  examples: string[];
}

export interface MethodDocumentation {
  name: string;
  signature: string;
  description: string;
  parameters: ParameterDocumentation[];
  returns: ReturnDocumentation;
  examples: CodeExample[];
  throws?: ExceptionDocumentation[];
}

export interface ParameterDocumentation {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  default?: any;
}

export interface ReturnDocumentation {
  type: string;
  description: string;
  examples: string[];
}

export interface ExceptionDocumentation {
  type: string;
  description: string;
  when: string;
}

export interface TypeExample {
  title: string;
  description: string;
  code: string;
  explanation: string;
}

export interface ExampleDocumentation {
  id: string;
  category: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  prerequisites: string[];
  objectives: string[];
  steps: ExampleStep[];
  fullCode: string;
  output: string;
  troubleshooting: TroubleshootingTip[];
  variations: ExampleVariation[];
  relatedExamples: string[];
}

export interface ExampleStep {
  stepNumber: number;
  title: string;
  description: string;
  code: string;
  explanation: string;
  output?: string;
  notes?: string[];
  tips?: string[];
}

export interface TroubleshootingTip {
  issue: string;
  solution: string;
  prevention?: string;
}

export interface ExampleVariation {
  title: string;
  description: string;
  changes: string[];
  code: string;
}

export interface GuideDocumentation {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  lastUpdated: Date;
  sections: GuideSection[];
  prerequisites: string[];
  learningObjectives: string[];
  nextSteps: string[];
  resources: ResourceLink[];
}

export interface GuideSection {
  id: string;
  title: string;
  content: string;
  codeBlocks: CodeBlock[];
  images: ImageReference[];
  videos: VideoReference[];
  interactive: boolean;
}

export interface CodeBlock {
  id: string;
  language: string;
  code: string;
  caption?: string;
  filename?: string;
  highlightLines?: number[];
  interactive: boolean;
  runnable: boolean;
}

export interface ImageReference {
  id: string;
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

export interface VideoReference {
  id: string;
  src: string;
  title: string;
  description?: string;
  duration?: string;
  thumbnail?: string;
}

export interface ResourceLink {
  title: string;
  url: string;
  description: string;
  type: 'documentation' | 'tutorial' | 'example' | 'tool' | 'external';
}

export interface PlaygroundConfiguration {
  enabled: boolean;
  defaultCode: string;
  availableCommands: string[];
  environment: PlaygroundEnvironment;
  features: PlaygroundFeature[];
  templates: PlaygroundTemplate[];
}

export interface PlaygroundEnvironment {
  type: 'browser' | 'sandbox' | 'container';
  runtime: string;
  dependencies: string[];
  timeout: number;
  memoryLimit: number;
}

export interface PlaygroundFeature {
  name: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface PlaygroundTemplate {
  id: string;
  title: string;
  description: string;
  code: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface SearchConfiguration {
  enabled: boolean;
  provider: 'local' | 'algolia' | 'elasticsearch';
  indexFields: string[];
  filters: SearchFilter[];
  suggestions: boolean;
  instantSearch: boolean;
}

export interface SearchFilter {
  field: string;
  label: string;
  type: 'category' | 'tag' | 'difficulty' | 'type';
  options: SearchFilterOption[];
}

export interface SearchFilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface DocsGenerationResult {
  success: boolean;
  outputPath: string;
  staticSiteUrl?: string;
  generatedFiles: string[];
  assets: AssetInfo[];
  searchIndex?: SearchIndex;
  statistics: DocsStatistics;
  errors: DocsError[];
  warnings: DocsWarning[];
}

export interface AssetInfo {
  path: string;
  type: 'css' | 'js' | 'image' | 'font' | 'other';
  size: number;
  optimized: boolean;
}

export interface SearchIndex {
  documents: SearchDocument[];
  fields: string[];
  totalDocuments: number;
  lastUpdated: Date;
}

export interface SearchDocument {
  id: string;
  title: string;
  content: string;
  url: string;
  category: string;
  tags: string[];
  difficulty?: string;
  type: string;
}

export interface DocsStatistics {
  totalPages: number;
  totalCommands: number;
  totalExamples: number;
  totalGuides: number;
  totalTypes: number;
  generationTime: number;
  assetSize: number;
  codeBlocks: number;
  interactiveElements: number;
}

export interface DocsError {
  type: 'generation' | 'validation' | 'template' | 'asset';
  message: string;
  file?: string;
  line?: number;
  severity: 'error' | 'warning';
}

export interface DocsWarning {
  type: 'missing_documentation' | 'broken_link' | 'deprecated_usage' | 'optimization';
  message: string;
  suggestion?: string;
  file?: string;
}

export class InteractiveDocsGenerator extends EventEmitter {
  private config: InteractiveDocsConfig;
  private projectPath: string;

  constructor(projectPath: string, config: InteractiveDocsConfig = {}) {
    super();
    this.projectPath = projectPath;
    this.config = {
      outputPath: path.join(projectPath, 'docs'),
      includeExamples: true,
      includeLiveDemo: true,
      includeTypeDefinitions: true,
      includeCodePlayground: true,
      generateStaticSite: true,
      autoRefresh: true,
      port: 3000,
      theme: this.getDefaultTheme(),
      ...config
    };
  }

  async generateDocumentation(): Promise<DocsGenerationResult> {
    this.emit('generation:start', { projectPath: this.projectPath });

    const startTime = Date.now();
    const result: DocsGenerationResult = {
      success: false,
      outputPath: this.config.outputPath!,
      generatedFiles: [],
      assets: [],
      statistics: {
        totalPages: 0,
        totalCommands: 0,
        totalExamples: 0,
        totalGuides: 0,
        totalTypes: 0,
        generationTime: 0,
        assetSize: 0,
        codeBlocks: 0,
        interactiveElements: 0
      },
      errors: [],
      warnings: []
    };

    try {
      // Ensure output directory exists
      await fs.ensureDir(this.config.outputPath!);

      // Generate API documentation
      const apiDocs = await this.generateAPIDocumentation();
      
      // Generate static site if enabled
      if (this.config.generateStaticSite) {
        await this.generateStaticSite(apiDocs);
      }

      // Generate search index
      if (apiDocs.search.enabled) {
        result.searchIndex = await this.generateSearchIndex(apiDocs);
      }

      // Copy assets
      await this.copyAssets();

      // Generate statistics
      result.statistics = this.calculateStatistics(apiDocs);
      result.statistics.generationTime = Date.now() - startTime;

      result.success = true;
      this.emit('generation:complete', result);

    } catch (error: any) {
      result.errors.push({
        type: 'generation',
        message: error.message,
        severity: 'error'
      });
      this.emit('generation:error', error);
    }

    return result;
  }

  private async generateAPIDocumentation(): Promise<APIDocumentation> {
    this.emit('api:generation:start');

    const commands = await this.extractCommandDocumentation();
    const types = await this.extractTypeDocumentation();
    const examples = await this.generateExamples();
    const guides = await this.generateGuides();

    const apiDocs: APIDocumentation = {
      metadata: await this.generateMetadata(),
      commands,
      types,
      examples,
      guides,
      playground: this.generatePlaygroundConfig(),
      search: this.generateSearchConfig()
    };

    // Save API documentation as JSON
    const apiDocsPath = path.join(this.config.outputPath!, 'api-docs.json');
    await fs.writeJson(apiDocsPath, apiDocs, { spaces: 2 });

    this.emit('api:generation:complete', apiDocs);
    return apiDocs;
  }

  private async extractCommandDocumentation(): Promise<CommandDocumentation[]> {
    const commands: CommandDocumentation[] = [];

    try {
      // Find command files
      const commandFiles = await glob('src/commands/**/*.ts', {
        cwd: this.projectPath,
        absolute: true
      });

      for (const file of commandFiles) {
        const commandDoc = await this.parseCommandFile(file);
        if (commandDoc) {
          commands.push(commandDoc);
        }
      }

      // Add built-in commands documentation
      commands.push(...this.getBuiltInCommandDocs());

    } catch (error) {
      this.emit('warning', { 
        type: 'missing_documentation',
        message: 'Could not extract command documentation',
        file: 'commands'
      });
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async parseCommandFile(filePath: string): Promise<CommandDocumentation | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const commandName = path.basename(filePath, '.ts');

      // Extract JSDoc comments and analyze code
      const documentation = this.extractJSDocFromFile(content);
      
      return {
        name: commandName,
        category: this.categorizeCommand(commandName),
        description: documentation.description || `${commandName} command`,
        synopsis: documentation.synopsis || `re-shell ${commandName} [options]`,
        usage: documentation.usage || [
          {
            pattern: `re-shell ${commandName}`,
            description: `Execute ${commandName} command`,
            required: true
          }
        ],
        options: documentation.options || [],
        examples: documentation.examples || this.generateDefaultExamples(commandName),
        relatedCommands: documentation.relatedCommands || [],
        since: documentation.since || '1.0.0',
        deprecated: documentation.deprecated,
        tags: documentation.tags || [this.categorizeCommand(commandName)],
        complexity: documentation.complexity || 'beginner'
      };

    } catch (error) {
      return null;
    }
  }

  private extractJSDocFromFile(content: string): any {
    // Simple JSDoc extraction - in real implementation would use a proper parser
    const jsdocRegex = /\/\*\*([\s\S]*?)\*\//g;
    const matches = content.match(jsdocRegex);
    
    if (!matches || matches.length === 0) {
      return {};
    }

    // Parse first JSDoc block
    const jsdoc = matches[0];
    const description = this.extractDescription(jsdoc);
    const examples = this.extractExamples(jsdoc);
    
    return {
      description,
      examples,
      synopsis: description ? `re-shell command - ${description}` : undefined,
      usage: examples.length > 0 ? examples.map(ex => ({
        pattern: ex.code,
        description: ex.description,
        required: true
      })) : undefined
    };
  }

  private extractDescription(jsdoc: string): string {
    const lines = jsdoc.split('\n');
    const descriptionLines = lines
      .map(line => line.replace(/^\s*\*\s?/, ''))
      .filter(line => line && !line.startsWith('@'))
      .slice(1, -1);
    
    return descriptionLines.join(' ').trim();
  }

  private extractExamples(jsdoc: string): CodeExample[] {
    const examples: CodeExample[] = [];
    const exampleRegex = /@example\s+([\s\S]*?)(?=@|\*\/)/g;
    let match;

    while ((match = exampleRegex.exec(jsdoc)) !== null) {
      const exampleContent = match[1]
        .split('\n')
        .map(line => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();

      examples.push({
        id: `example-${examples.length + 1}`,
        title: `Example ${examples.length + 1}`,
        description: 'Command usage example',
        code: exampleContent,
        language: 'bash',
        interactive: true,
        playgroundEnabled: true,
        difficulty: 'beginner',
        tags: ['example'],
        output: '# Command output would appear here'
      });
    }

    return examples;
  }

  private categorizeCommand(commandName: string): string {
    const categories: Record<string, string[]> = {
      'Project Management': ['init', 'create', 'new', 'setup'],
      'Build & Deploy': ['build', 'deploy', 'serve', 'start'],
      'Development': ['dev', 'watch', 'test', 'lint'],
      'Workspace': ['add', 'remove', 'list', 'workspace'],
      'Configuration': ['config', 'configure', 'settings'],
      'Analysis': ['analyze', 'doctor', 'audit', 'profile'],
      'Utilities': ['help', 'version', 'update', 'clean']
    };

    for (const [category, commands] of Object.entries(categories)) {
      if (commands.some(cmd => commandName.includes(cmd))) {
        return category;
      }
    }

    return 'General';
  }

  private generateDefaultExamples(commandName: string): CodeExample[] {
    return [
      {
        id: `${commandName}-basic`,
        title: `Basic ${commandName} usage`,
        description: `Simple example of using the ${commandName} command`,
        code: `re-shell ${commandName}`,
        language: 'bash',
        output: `# ${commandName} command executed successfully`,
        interactive: true,
        playgroundEnabled: true,
        difficulty: 'beginner',
        tags: ['basic', commandName]
      },
      {
        id: `${commandName}-advanced`,
        title: `Advanced ${commandName} usage`,
        description: `Advanced example with options`,
        code: `re-shell ${commandName} --verbose --config custom.yaml`,
        language: 'bash',
        output: `# ${commandName} executed with custom configuration`,
        interactive: true,
        playgroundEnabled: true,
        difficulty: 'intermediate',
        tags: ['advanced', commandName]
      }
    ];
  }

  private getBuiltInCommandDocs(): CommandDocumentation[] {
    return [
      {
        name: 'init',
        category: 'Project Management',
        description: 'Initialize a new Re-Shell project with comprehensive setup',
        synopsis: 're-shell init [project-name] [options]',
        usage: [
          {
            pattern: 're-shell init',
            description: 'Initialize project in current directory',
            required: false
          },
          {
            pattern: 're-shell init <project-name>',
            description: 'Initialize project in new directory',
            required: false
          }
        ],
        options: [
          {
            name: 'template',
            alias: 't',
            type: 'string',
            description: 'Project template to use',
            default: 'basic',
            required: false,
            choices: ['basic', 'ecommerce', 'dashboard', 'saas'],
            examples: ['--template ecommerce', '-t dashboard'],
            validation: [
              {
                type: 'enum',
                value: ['basic', 'ecommerce', 'dashboard', 'saas'],
                message: 'Template must be one of: basic, ecommerce, dashboard, saas'
              }
            ]
          },
          {
            name: 'package-manager',
            alias: 'pm',
            type: 'string',
            description: 'Package manager to use',
            default: 'npm',
            required: false,
            choices: ['npm', 'yarn', 'pnpm', 'bun'],
            examples: ['--package-manager yarn', '-pm pnpm']
          },
          {
            name: 'skip-install',
            type: 'boolean',
            description: 'Skip dependency installation',
            default: false,
            required: false,
            examples: ['--skip-install']
          }
        ],
        examples: [
          {
            id: 'init-basic',
            title: 'Basic project initialization',
            description: 'Create a new Re-Shell project with default settings',
            code: 're-shell init my-project',
            language: 'bash',
            output: `Creating new Re-Shell project 'my-project'...
✓ Project structure created
✓ Dependencies installed
✓ Configuration files generated
✓ Git repository initialized

Project created successfully!
cd my-project && re-shell dev`,
            interactive: true,
            playgroundEnabled: true,
            difficulty: 'beginner',
            tags: ['init', 'basic', 'getting-started']
          },
          {
            id: 'init-ecommerce',
            title: 'E-commerce project with custom template',
            description: 'Initialize an e-commerce project with specialized template',
            code: 're-shell init my-store --template ecommerce --package-manager yarn',
            language: 'bash',
            output: `Creating e-commerce project 'my-store'...
✓ E-commerce template applied
✓ Product catalog structure created
✓ Payment integration setup
✓ Yarn dependencies installed
✓ Development environment configured

E-commerce project ready!`,
            interactive: true,
            playgroundEnabled: true,
            difficulty: 'intermediate',
            tags: ['init', 'ecommerce', 'template']
          }
        ],
        relatedCommands: ['create', 'add', 'dev'],
        since: '1.0.0',
        tags: ['project', 'initialization', 'setup'],
        complexity: 'beginner'
      },
      {
        name: 'build',
        category: 'Build & Deploy',
        description: 'Build the project for production with optimization',
        synopsis: 're-shell build [workspace] [options]',
        usage: [
          {
            pattern: 're-shell build',
            description: 'Build all workspaces',
            required: false
          },
          {
            pattern: 're-shell build <workspace>',
            description: 'Build specific workspace',
            required: false
          }
        ],
        options: [
          {
            name: 'mode',
            alias: 'm',
            type: 'string',
            description: 'Build mode',
            default: 'production',
            required: false,
            choices: ['development', 'production', 'test'],
            examples: ['--mode production', '-m development']
          },
          {
            name: 'watch',
            alias: 'w',
            type: 'boolean',
            description: 'Watch for changes and rebuild',
            default: false,
            required: false,
            examples: ['--watch']
          },
          {
            name: 'analyze',
            type: 'boolean',
            description: 'Analyze bundle size',
            default: false,
            required: false,
            examples: ['--analyze']
          }
        ],
        examples: [
          {
            id: 'build-production',
            title: 'Production build',
            description: 'Build all workspaces for production deployment',
            code: 're-shell build --mode production',
            language: 'bash',
            output: `Building all workspaces for production...
✓ Frontend built (2.3MB)
✓ Backend built (1.8MB)
✓ Shared libraries built (0.5MB)
✓ Assets optimized
✓ Source maps generated

Build completed in 45.2s`,
            interactive: true,
            playgroundEnabled: true,
            difficulty: 'beginner',
            tags: ['build', 'production']
          }
        ],
        relatedCommands: ['dev', 'serve', 'deploy'],
        since: '1.0.0',
        tags: ['build', 'production', 'optimization'],
        complexity: 'beginner'
      }
    ];
  }

  private async extractTypeDocumentation(): Promise<TypeDocumentation[]> {
    const types: TypeDocumentation[] = [];

    try {
      // Find TypeScript definition files
      const typeFiles = await glob('src/**/*.ts', {
        cwd: this.projectPath,
        absolute: true
      });

      for (const file of typeFiles) {
        const fileTypes = await this.parseTypeFile(file);
        types.push(...fileTypes);
      }

    } catch (error) {
      this.emit('warning', {
        type: 'missing_documentation',
        message: 'Could not extract type documentation'
      });
    }

    return types;
  }

  private async parseTypeFile(filePath: string): Promise<TypeDocumentation[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const types: TypeDocumentation[] = [];

      // Extract interfaces
      const interfaceRegex = /export interface (\w+)\s*{([^}]*)}/g;
      let match;

      while ((match = interfaceRegex.exec(content)) !== null) {
        const [, name, body] = match;
        const properties = this.parseInterfaceProperties(body);

        types.push({
          name,
          type: 'interface',
          description: `${name} interface definition`,
          definition: match[0],
          properties,
          examples: [
            {
              title: `${name} usage example`,
              description: `Example of using ${name} interface`,
              code: this.generateTypeExample(name, properties),
              explanation: `This example shows how to create and use a ${name} object`
            }
          ],
          since: '1.0.0',
          module: path.relative(this.projectPath, filePath)
        });
      }

      return types;
    } catch (error) {
      return [];
    }
  }

  private parseInterfaceProperties(body: string): PropertyDocumentation[] {
    const properties: PropertyDocumentation[] = [];
    const lines = body.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

      const propertyMatch = trimmed.match(/(\w+)(\?)?\s*:\s*([^;]+);?/);
      if (propertyMatch) {
        const [, name, optional, type] = propertyMatch;
        
        properties.push({
          name,
          type: type.trim(),
          description: `${name} property`,
          optional: !!optional,
          readonly: trimmed.includes('readonly'),
          examples: [`${name}: ${this.generatePropertyExample(type.trim())}`]
        });
      }
    }

    return properties;
  }

  private generatePropertyExample(type: string): string {
    switch (type.toLowerCase()) {
      case 'string': return '"example"';
      case 'number': return '42';
      case 'boolean': return 'true';
      case 'date': return 'new Date()';
      default:
        if (type.includes('[]')) return '[]';
        if (type.includes('Record')) return '{}';
        return '{}';
    }
  }

  private generateTypeExample(name: string, properties: PropertyDocumentation[]): string {
    const exampleProps = properties.slice(0, 3).map(prop => {
      return `  ${prop.name}: ${prop.examples[0]}`;
    }).join(',\n');

    return `const example: ${name} = {
${exampleProps}
};`;
  }

  private async generateExamples(): Promise<ExampleDocumentation[]> {
    return [
      {
        id: 'getting-started',
        category: 'Quick Start',
        title: 'Getting Started with Re-Shell',
        description: 'Complete guide to setting up your first Re-Shell project',
        difficulty: 'beginner',
        estimatedTime: '10 minutes',
        prerequisites: ['Node.js 14+', 'Basic command line knowledge'],
        objectives: [
          'Create a new Re-Shell project',
          'Understand the project structure',
          'Run the development server',
          'Make your first changes'
        ],
        steps: [
          {
            stepNumber: 1,
            title: 'Install Re-Shell CLI',
            description: 'Install the Re-Shell CLI globally using npm',
            code: 'npm install -g @umutkorkmaz/re-shell-cli',
            explanation: 'This installs the Re-Shell command line interface globally on your system',
            output: 'Successfully installed @umutkorkmaz/re-shell-cli@latest',
            tips: ['Use sudo on Linux/Mac if you encounter permission errors']
          },
          {
            stepNumber: 2,
            title: 'Create New Project',
            description: 'Initialize a new Re-Shell project',
            code: 're-shell init my-first-app --template basic',
            explanation: 'Creates a new project directory with the basic template',
            output: 'Project created successfully! Navigate to my-first-app to get started.',
            notes: ['The basic template includes a simple microfrontend setup']
          },
          {
            stepNumber: 3,
            title: 'Start Development Server',
            description: 'Navigate to the project and start the development server',
            code: 'cd my-first-app && re-shell dev',
            explanation: 'Starts the development server with hot reloading',
            output: 'Development server running at http://localhost:3000',
            tips: ['The server will automatically reload when you make changes']
          }
        ],
        fullCode: `# Complete setup process
npm install -g @umutkorkmaz/re-shell-cli
re-shell init my-first-app --template basic
cd my-first-app
re-shell dev`,
        output: 'Project created and development server started successfully!',
        troubleshooting: [
          {
            issue: 'Permission denied during global install',
            solution: 'Use sudo or configure npm to use a different directory',
            prevention: 'Set up npm to use a global directory in your home folder'
          }
        ],
        variations: [
          {
            title: 'Using Yarn',
            description: 'Same setup but using Yarn package manager',
            changes: ['Use yarn instead of npm'],
            code: 're-shell init my-first-app --template basic --package-manager yarn'
          }
        ],
        relatedExamples: ['project-structure', 'adding-microfrontends']
      },
      {
        id: 'adding-microfrontends',
        category: 'Microfrontends',
        title: 'Adding Your First Microfrontend',
        description: 'Learn how to add and configure microfrontends in your Re-Shell project',
        difficulty: 'intermediate',
        estimatedTime: '15 minutes',
        prerequisites: ['Existing Re-Shell project', 'Basic React knowledge'],
        objectives: [
          'Add a new microfrontend to your project',
          'Configure routing between microfrontends',
          'Share data between components',
          'Build and deploy the application'
        ],
        steps: [
          {
            stepNumber: 1,
            title: 'Add New Microfrontend',
            description: 'Create a new microfrontend for user management',
            code: 're-shell add users --framework react --typescript',
            explanation: 'Generates a new microfrontend with React and TypeScript setup',
            output: 'Microfrontend "users" created successfully!'
          },
          {
            stepNumber: 2,
            title: 'Configure Routing',
            description: 'Set up routing to the new microfrontend',
            code: `// In src/App.tsx
import { Route } from 'react-router-dom';
import Users from 'users/Users';

<Route path="/users" component={Users} />`,
            explanation: 'Adds routing configuration for the users microfrontend'
          }
        ],
        fullCode: `re-shell add users --framework react --typescript
# Update routing configuration
# Test the new microfrontend
re-shell build`,
        output: 'Microfrontend integrated successfully!',
        troubleshooting: [],
        variations: [],
        relatedExamples: ['getting-started', 'project-structure']
      }
    ];
  }

  private async generateGuides(): Promise<GuideDocumentation[]> {
    return [
      {
        id: 'project-architecture',
        title: 'Re-Shell Project Architecture',
        description: 'Understanding the architecture and design principles of Re-Shell projects',
        category: 'Architecture',
        difficulty: 'intermediate',
        estimatedTime: '20 minutes',
        lastUpdated: new Date(),
        sections: [
          {
            id: 'overview',
            title: 'Architecture Overview',
            content: `Re-Shell follows a microfrontend architecture pattern that allows teams to develop, deploy, and scale frontend applications independently. Each microfrontend is a self-contained application that can be developed using different frameworks and technologies.

## Key Principles

1. **Independence**: Each microfrontend operates independently
2. **Technology Agnostic**: Use different frameworks for different parts
3. **Deployment Flexibility**: Deploy components separately
4. **Team Autonomy**: Teams can work independently on their features`,
            codeBlocks: [
              {
                id: 'structure-example',
                language: 'text',
                code: `project/
├── apps/
│   ├── shell/          # Main application shell
│   ├── header/         # Header microfrontend
│   ├── sidebar/        # Sidebar microfrontend
│   └── dashboard/      # Dashboard microfrontend
├── packages/
│   ├── shared/         # Shared utilities
│   └── types/          # Shared types
└── tools/              # Build and dev tools`,
                caption: 'Typical Re-Shell project structure',
                interactive: false,
                runnable: false
              }
            ],
            images: [],
            videos: [],
            interactive: false
          }
        ],
        prerequisites: ['Basic React knowledge', 'Understanding of frontend build tools'],
        learningObjectives: [
          'Understand microfrontend architecture',
          'Learn Re-Shell project structure',
          'Master component communication patterns'
        ],
        nextSteps: [
          'Build your first microfrontend',
          'Implement shared state management',
          'Set up CI/CD pipeline'
        ],
        resources: [
          {
            title: 'Microfrontends.org',
            url: 'https://microfrontends.org',
            description: 'Comprehensive guide to microfrontend architecture',
            type: 'external'
          }
        ]
      }
    ];
  }

  private async generateMetadata(): Promise<DocsMetadata> {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);

      return {
        title: packageJson.name || 'Re-Shell Documentation',
        version: packageJson.version || '1.0.0',
        description: packageJson.description || 'Interactive API documentation for Re-Shell CLI',
        lastUpdated: new Date(),
        contributors: [
          {
            name: 'Re-Shell Team',
            role: 'Maintainer'
          }
        ],
        license: packageJson.license || 'MIT',
        repository: packageJson.repository?.url || '',
        homepage: packageJson.homepage || ''
      };
    } catch {
      return {
        title: 'Re-Shell Documentation',
        version: '1.0.0',
        description: 'Interactive API documentation for Re-Shell CLI',
        lastUpdated: new Date(),
        contributors: [],
        license: 'MIT',
        repository: '',
        homepage: ''
      };
    }
  }

  private generatePlaygroundConfig(): PlaygroundConfiguration {
    return {
      enabled: this.config.includeCodePlayground || false,
      defaultCode: `// Welcome to the Re-Shell playground!
// Try running some commands:

re-shell init my-app --template basic
re-shell add users --framework react
re-shell build`,
      availableCommands: ['init', 'add', 'build', 'dev', 'serve', 'analyze'],
      environment: {
        type: 'browser',
        runtime: 'nodejs',
        dependencies: ['@umutkorkmaz/re-shell-cli'],
        timeout: 30000,
        memoryLimit: 512
      },
      features: [
        { name: 'syntax-highlighting', enabled: true },
        { name: 'auto-completion', enabled: true },
        { name: 'error-highlighting', enabled: true },
        { name: 'live-output', enabled: true }
      ],
      templates: [
        {
          id: 'basic-init',
          title: 'Basic Project Initialization',
          description: 'Create a new Re-Shell project with default settings',
          code: 're-shell init my-project --template basic',
          category: 'Getting Started',
          difficulty: 'beginner'
        },
        {
          id: 'ecommerce-setup',
          title: 'E-commerce Project Setup',
          description: 'Set up an e-commerce project with specialized features',
          code: `re-shell init my-store --template ecommerce
re-shell add products --framework react
re-shell add cart --framework vue`,
          category: 'Templates',
          difficulty: 'intermediate'
        }
      ]
    };
  }

  private generateSearchConfig(): SearchConfiguration {
    return {
      enabled: true,
      provider: 'local',
      indexFields: ['title', 'description', 'content', 'tags'],
      filters: [
        {
          field: 'category',
          label: 'Category',
          type: 'category',
          options: [
            { value: 'commands', label: 'Commands' },
            { value: 'guides', label: 'Guides' },
            { value: 'examples', label: 'Examples' },
            { value: 'types', label: 'Types' }
          ]
        },
        {
          field: 'difficulty',
          label: 'Difficulty',
          type: 'difficulty',
          options: [
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' }
          ]
        }
      ],
      suggestions: true,
      instantSearch: true
    };
  }

  private async generateStaticSite(apiDocs: APIDocumentation): Promise<void> {
    this.emit('static-site:generation:start');

    // Generate HTML pages
    await this.generateHomePage(apiDocs);
    await this.generateCommandPages(apiDocs.commands);
    await this.generateExamplePages(apiDocs.examples);
    await this.generateGuidePages(apiDocs.guides);
    await this.generateTypePages(apiDocs.types);

    // Generate navigation and search
    await this.generateNavigation(apiDocs);
    await this.generateSearchPage(apiDocs);

    // Generate assets
    await this.generateStyles();
    await this.generateScripts();

    this.emit('static-site:generation:complete');
  }

  private async generateHomePage(apiDocs: APIDocumentation): Promise<void> {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${apiDocs.metadata.title}</title>
    <link rel="stylesheet" href="assets/styles.css">
    <link rel="icon" type="image/x-icon" href="assets/favicon.ico">
</head>
<body>
    <div id="app">
        <header class="header">
            <div class="container">
                <div class="header-content">
                    <h1 class="logo">${apiDocs.metadata.title}</h1>
                    <nav class="nav">
                        <a href="#commands">Commands</a>
                        <a href="#examples">Examples</a>
                        <a href="#guides">Guides</a>
                        <a href="#types">Types</a>
                        <a href="#playground">Playground</a>
                    </nav>
                </div>
            </div>
        </header>

        <main class="main">
            <section class="hero">
                <div class="container">
                    <h2>Interactive API Documentation</h2>
                    <p>${apiDocs.metadata.description}</p>
                    <div class="hero-actions">
                        <a href="#getting-started" class="btn btn-primary">Get Started</a>
                        <a href="#playground" class="btn btn-secondary">Try Playground</a>
                    </div>
                </div>
            </section>

            <section class="features">
                <div class="container">
                    <div class="feature-grid">
                        <div class="feature-card">
                            <h3>📚 Comprehensive Commands</h3>
                            <p>${apiDocs.commands.length} documented commands with examples</p>
                            <a href="commands.html">Explore Commands</a>
                        </div>
                        <div class="feature-card">
                            <h3>🚀 Live Examples</h3>
                            <p>${apiDocs.examples.length} interactive examples to try</p>
                            <a href="examples.html">Browse Examples</a>
                        </div>
                        <div class="feature-card">
                            <h3>📖 Step-by-Step Guides</h3>
                            <p>${apiDocs.guides.length} detailed guides for every use case</p>
                            <a href="guides.html">Read Guides</a>
                        </div>
                        <div class="feature-card">
                            <h3>🔧 Type Definitions</h3>
                            <p>${apiDocs.types.length} TypeScript interfaces and types</p>
                            <a href="types.html">View Types</a>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <footer class="footer">
            <div class="container">
                <p>&copy; ${new Date().getFullYear()} ${apiDocs.metadata.title}. Licensed under ${apiDocs.metadata.license}.</p>
            </div>
        </footer>
    </div>
    
    <script src="assets/scripts.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(this.config.outputPath!, 'index.html'), html);
  }

  private async generateCommandPages(commands: CommandDocumentation[]): Promise<void> {
    // Generate commands index page
    const commandsHtml = this.generateCommandsIndexHtml(commands);
    await fs.writeFile(path.join(this.config.outputPath!, 'commands.html'), commandsHtml);

    // Generate individual command pages
    for (const command of commands) {
      const commandHtml = this.generateCommandPageHtml(command);
      await fs.writeFile(
        path.join(this.config.outputPath!, 'commands', `${command.name}.html`),
        commandHtml
      );
    }
  }

  private generateCommandsIndexHtml(commands: CommandDocumentation[]): string {
    const categories = this.groupCommandsByCategory(commands);
    
    const categoriesHtml = Object.entries(categories).map(([category, cmds]) => `
      <section class="command-category">
        <h3>${category}</h3>
        <div class="command-grid">
          ${cmds.map(cmd => `
            <div class="command-card">
              <h4><a href="commands/${cmd.name}.html">${cmd.name}</a></h4>
              <p>${cmd.description}</p>
              <div class="command-meta">
                <span class="complexity ${cmd.complexity}">${cmd.complexity}</span>
                ${cmd.deprecated ? '<span class="deprecated">Deprecated</span>' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </section>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Commands - Re-Shell Documentation</title>
    <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <div class="container">
                <div class="header-content">
                    <h1><a href="index.html">Re-Shell Docs</a></h1>
                    <nav class="nav">
                        <a href="commands.html" class="active">Commands</a>
                        <a href="examples.html">Examples</a>
                        <a href="guides.html">Guides</a>
                    </nav>
                </div>
            </div>
        </header>

        <main class="main">
            <div class="container">
                <div class="content">
                    <h2>Commands Reference</h2>
                    <p>Complete reference for all Re-Shell CLI commands with examples and options.</p>
                    
                    <div class="search-box">
                        <input type="text" placeholder="Search commands..." id="command-search">
                    </div>

                    ${categoriesHtml}
                </div>
            </div>
        </main>
    </div>
    
    <script src="assets/scripts.js"></script>
</body>
</html>`;
  }

  private groupCommandsByCategory(commands: CommandDocumentation[]): Record<string, CommandDocumentation[]> {
    const categories: Record<string, CommandDocumentation[]> = {};
    
    for (const command of commands) {
      if (!categories[command.category]) {
        categories[command.category] = [];
      }
      categories[command.category].push(command);
    }

    return categories;
  }

  private generateCommandPageHtml(command: CommandDocumentation): string {
    const optionsHtml = command.options.map(option => `
      <tr>
        <td><code>--${option.name}${option.alias ? `, -${option.alias}` : ''}</code></td>
        <td>${option.type}</td>
        <td>${option.description}</td>
        <td>${option.default || 'None'}</td>
        <td>${option.required ? 'Yes' : 'No'}</td>
      </tr>
    `).join('');

    const examplesHtml = command.examples.map(example => `
      <div class="example">
        <h4>${example.title}</h4>
        <p>${example.description}</p>
        <div class="code-block">
          <pre><code class="language-${example.language}">${example.code}</code></pre>
          ${example.interactive ? '<button class="run-example">Run Example</button>' : ''}
        </div>
        ${example.output ? `
          <div class="output">
            <h5>Output:</h5>
            <pre><code>${example.output}</code></pre>
          </div>
        ` : ''}
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${command.name} - Re-Shell Documentation</title>
    <link rel="stylesheet" href="../assets/styles.css">
    <link rel="stylesheet" href="../assets/prism.css">
</head>
<body>
    <div id="app">
        <header class="header">
            <div class="container">
                <div class="header-content">
                    <h1><a href="../index.html">Re-Shell Docs</a></h1>
                    <nav class="nav">
                        <a href="../commands.html">Commands</a>
                        <a href="../examples.html">Examples</a>
                        <a href="../guides.html">Guides</a>
                    </nav>
                </div>
            </div>
        </header>

        <main class="main">
            <div class="container">
                <div class="content">
                    <div class="breadcrumb">
                        <a href="../index.html">Home</a> > 
                        <a href="../commands.html">Commands</a> > 
                        ${command.name}
                    </div>

                    <h1>${command.name}</h1>
                    <p class="lead">${command.description}</p>

                    <div class="command-meta">
                        <span class="category">${command.category}</span>
                        <span class="complexity ${command.complexity}">${command.complexity}</span>
                        <span class="since">Since v${command.since}</span>
                    </div>

                    <section class="synopsis">
                        <h2>Synopsis</h2>
                        <div class="code-block">
                            <pre><code>${command.synopsis}</code></pre>
                        </div>
                    </section>

                    <section class="usage">
                        <h2>Usage</h2>
                        ${command.usage.map(usage => `
                            <div class="usage-pattern">
                                <code>${usage.pattern}</code>
                                <p>${usage.description}</p>
                            </div>
                        `).join('')}
                    </section>

                    <section class="options">
                        <h2>Options</h2>
                        <table class="options-table">
                            <thead>
                                <tr>
                                    <th>Option</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Default</th>
                                    <th>Required</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${optionsHtml}
                            </tbody>
                        </table>
                    </section>

                    <section class="examples">
                        <h2>Examples</h2>
                        ${examplesHtml}
                    </section>

                    ${command.relatedCommands.length > 0 ? `
                        <section class="related">
                            <h2>Related Commands</h2>
                            <ul>
                                ${command.relatedCommands.map(cmd => `
                                    <li><a href="${cmd}.html">${cmd}</a></li>
                                `).join('')}
                            </ul>
                        </section>
                    ` : ''}
                </div>
            </div>
        </main>
    </div>
    
    <script src="../assets/scripts.js"></script>
    <script src="../assets/prism.js"></script>
</body>
</html>`;
  }

  private async generateExamplePages(examples: ExampleDocumentation[]): Promise<void> {
    // Implementation for example pages
    const examplesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Examples - Re-Shell Documentation</title>
    <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
    <div id="app">
        <main class="main">
            <div class="container">
                <h2>Interactive Examples</h2>
                <p>Learn by doing with our interactive examples.</p>
                
                ${examples.map(example => `
                    <div class="example-card">
                        <h3>${example.title}</h3>
                        <p>${example.description}</p>
                        <div class="example-meta">
                            <span class="difficulty ${example.difficulty}">${example.difficulty}</span>
                            <span class="time">${example.estimatedTime}</span>
                        </div>
                        <a href="examples/${example.id}.html" class="btn">Try Example</a>
                    </div>
                `).join('')}
            </div>
        </main>
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(this.config.outputPath!, 'examples.html'), examplesHtml);
  }

  private async generateGuidePages(guides: GuideDocumentation[]): Promise<void> {
    // Implementation for guide pages
    const guidesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guides - Re-Shell Documentation</title>
    <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
    <div id="app">
        <main class="main">
            <div class="container">
                <h2>Comprehensive Guides</h2>
                <p>Step-by-step guides to master Re-Shell.</p>
                
                ${guides.map(guide => `
                    <div class="guide-card">
                        <h3>${guide.title}</h3>
                        <p>${guide.description}</p>
                        <div class="guide-meta">
                            <span class="difficulty ${guide.difficulty}">${guide.difficulty}</span>
                            <span class="time">${guide.estimatedTime}</span>
                        </div>
                        <a href="guides/${guide.id}.html" class="btn">Read Guide</a>
                    </div>
                `).join('')}
            </div>
        </main>
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(this.config.outputPath!, 'guides.html'), guidesHtml);
  }

  private async generateTypePages(types: TypeDocumentation[]): Promise<void> {
    // Implementation for type pages
    const typesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Types - Re-Shell Documentation</title>
    <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
    <div id="app">
        <main class="main">
            <div class="container">
                <h2>Type Definitions</h2>
                <p>Complete TypeScript type definitions and interfaces.</p>
                
                ${types.map(type => `
                    <div class="type-card">
                        <h3>${type.name}</h3>
                        <p>${type.description}</p>
                        <span class="type-badge">${type.type}</span>
                        <a href="types/${type.name}.html" class="btn">View Details</a>
                    </div>
                `).join('')}
            </div>
        </main>
    </div>
</body>
</html>`;

    await fs.writeFile(path.join(this.config.outputPath!, 'types.html'), typesHtml);
  }

  private async generateNavigation(apiDocs: APIDocumentation): Promise<void> {
    const navigation = {
      main: [
        { title: 'Home', url: 'index.html' },
        { title: 'Commands', url: 'commands.html' },
        { title: 'Examples', url: 'examples.html' },
        { title: 'Guides', url: 'guides.html' },
        { title: 'Types', url: 'types.html' },
        { title: 'Playground', url: 'playground.html' }
      ],
      commands: apiDocs.commands.map(cmd => ({
        title: cmd.name,
        url: `commands/${cmd.name}.html`,
        category: cmd.category
      })),
      examples: apiDocs.examples.map(ex => ({
        title: ex.title,
        url: `examples/${ex.id}.html`,
        category: ex.category
      }))
    };

    await fs.writeJson(
      path.join(this.config.outputPath!, 'assets', 'navigation.json'),
      navigation,
      { spaces: 2 }
    );
  }

  private async generateSearchPage(apiDocs: APIDocumentation): Promise<void> {
    const searchHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Search - Re-Shell Documentation</title>
    <link rel="stylesheet" href="assets/styles.css">
</head>
<body>
    <div id="app">
        <main class="main">
            <div class="container">
                <div class="search-page">
                    <h2>Search Documentation</h2>
                    <div class="search-box-large">
                        <input type="text" placeholder="Search commands, examples, guides..." id="main-search">
                        <button id="search-btn">Search</button>
                    </div>
                    
                    <div class="search-filters">
                        <h3>Filter by:</h3>
                        <div class="filter-group">
                            <label>Type:</label>
                            <select id="type-filter">
                                <option value="">All</option>
                                <option value="command">Commands</option>
                                <option value="example">Examples</option>
                                <option value="guide">Guides</option>
                                <option value="type">Types</option>
                            </select>
                        </div>
                        <div class="filter-group">
                            <label>Difficulty:</label>
                            <select id="difficulty-filter">
                                <option value="">All</option>
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="search-results">
                        <p>Enter a search term to find relevant documentation.</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
    
    <script src="assets/search.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(this.config.outputPath!, 'search.html'), searchHtml);
  }

  private async generateSearchIndex(apiDocs: APIDocumentation): Promise<SearchIndex> {
    const documents: SearchDocument[] = [];

    // Index commands
    for (const command of apiDocs.commands) {
      documents.push({
        id: `command-${command.name}`,
        title: command.name,
        content: `${command.description} ${command.synopsis} ${command.options.map(o => o.description).join(' ')}`,
        url: `commands/${command.name}.html`,
        category: command.category,
        tags: command.tags,
        difficulty: command.complexity,
        type: 'command'
      });
    }

    // Index examples
    for (const example of apiDocs.examples) {
      documents.push({
        id: `example-${example.id}`,
        title: example.title,
        content: `${example.description} ${example.steps.map(s => s.description).join(' ')}`,
        url: `examples/${example.id}.html`,
        category: example.category,
        tags: [],
        difficulty: example.difficulty,
        type: 'example'
      });
    }

    const searchIndex: SearchIndex = {
      documents,
      fields: ['title', 'content', 'category', 'tags'],
      totalDocuments: documents.length,
      lastUpdated: new Date()
    };

    // Save search index
    await fs.writeJson(
      path.join(this.config.outputPath!, 'assets', 'search-index.json'),
      searchIndex,
      { spaces: 2 }
    );

    return searchIndex;
  }

  private async generateStyles(): Promise<void> {
    const css = `
/* Re-Shell Documentation Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #fff;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.header {
  background: #fff;
  border-bottom: 1px solid #e1e4e8;
  padding: 1rem 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  font-size: 1.5rem;
  font-weight: bold;
  color: #2196F3;
}

.nav {
  display: flex;
  gap: 2rem;
}

.nav a {
  color: #333;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: all 0.2s;
}

.nav a:hover,
.nav a.active {
  background: #f8f9fa;
  color: #2196F3;
}

/* Hero Section */
.hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4rem 0;
  text-align: center;
}

.hero h2 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.2rem;
  margin-bottom: 2rem;
  opacity: 0.9;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #2196F3;
  color: white;
}

.btn-primary:hover {
  background: #1976D2;
}

.btn-secondary {
  background: transparent;
  color: white;
  border: 2px solid white;
}

.btn-secondary:hover {
  background: white;
  color: #2196F3;
}

/* Feature Grid */
.features {
  padding: 4rem 0;
  background: #f8f9fa;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  text-align: center;
}

.feature-card h3 {
  margin-bottom: 1rem;
  color: #333;
}

.feature-card p {
  margin-bottom: 1.5rem;
  color: #666;
}

.feature-card a {
  color: #2196F3;
  text-decoration: none;
  font-weight: 500;
}

/* Code Blocks */
.code-block {
  background: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 1rem;
  margin: 1rem 0;
  position: relative;
}

.code-block pre {
  margin: 0;
  overflow-x: auto;
}

.code-block code {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 0.9rem;
}

.run-example {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: #28a745;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.run-example:hover {
  background: #218838;
}

/* Tables */
.options-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.options-table th,
.options-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #e1e4e8;
}

.options-table th {
  background: #f6f8fa;
  font-weight: 600;
}

.options-table code {
  background: #f6f8fa;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.9rem;
}

/* Badges */
.complexity {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
}

.complexity.beginner {
  background: #d4edda;
  color: #155724;
}

.complexity.intermediate {
  background: #fff3cd;
  color: #856404;
}

.complexity.advanced {
  background: #f8d7da;
  color: #721c24;
}

.deprecated {
  background: #f8d7da;
  color: #721c24;
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 500;
}

/* Search */
.search-box {
  margin: 2rem 0;
}

.search-box input {
  width: 100%;
  padding: 1rem;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  font-size: 1rem;
}

.search-box input:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
}

/* Footer */
.footer {
  background: #f6f8fa;
  padding: 2rem 0;
  text-align: center;
  color: #666;
  border-top: 1px solid #e1e4e8;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 1rem;
  }
  
  .hero h2 {
    font-size: 2rem;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
`;

    await fs.ensureDir(path.join(this.config.outputPath!, 'assets'));
    await fs.writeFile(path.join(this.config.outputPath!, 'assets', 'styles.css'), css);
  }

  private async generateScripts(): Promise<void> {
    const js = `
// Re-Shell Documentation Scripts
document.addEventListener('DOMContentLoaded', function() {
  // Initialize search functionality
  initializeSearch();
  
  // Initialize interactive examples
  initializeExamples();
  
  // Initialize navigation
  initializeNavigation();
});

function initializeSearch() {
  const searchInput = document.getElementById('command-search');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      const query = e.target.value.toLowerCase();
      const cards = document.querySelectorAll('.command-card, .example-card, .guide-card');
      
      cards.forEach(card => {
        const title = card.querySelector('h4, h3').textContent.toLowerCase();
        const description = card.querySelector('p').textContent.toLowerCase();
        
        if (title.includes(query) || description.includes(query)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }
}

function initializeExamples() {
  const runButtons = document.querySelectorAll('.run-example');
  runButtons.forEach(button => {
    button.addEventListener('click', function() {
      const codeBlock = this.parentElement.querySelector('code');
      const code = codeBlock.textContent;
      
      // Simulate running the example
      this.textContent = 'Running...';
      this.disabled = true;
      
      setTimeout(() => {
        this.textContent = 'Run Example';
        this.disabled = false;
        
        // Show mock output
        showExampleOutput(code, this.parentElement);
      }, 2000);
    });
  });
}

function showExampleOutput(code, container) {
  let outputDiv = container.querySelector('.example-output');
  if (!outputDiv) {
    outputDiv = document.createElement('div');
    outputDiv.className = 'example-output';
    container.appendChild(outputDiv);
  }
  
  // Mock output based on command
  let output = '# Command executed successfully\\n';
  if (code.includes('init')) {
    output += 'Project initialized successfully!\\n';
    output += 'Files created: package.json, src/App.tsx, webpack.config.js\\n';
  } else if (code.includes('build')) {
    output += 'Building project...\\n';
    output += 'Compiled successfully in 2.3s\\n';
    output += 'Bundle size: 1.2MB\\n';
  } else if (code.includes('add')) {
    output += 'Adding microfrontend...\\n';
    output += 'Microfrontend created successfully!\\n';
  }
  
  outputDiv.innerHTML = \`
    <h5>Output:</h5>
    <pre><code>\${output}</code></pre>
  \`;
}

function initializeNavigation() {
  // Highlight current page in navigation
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav a');
  
  navLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath.split('/').pop()) {
      link.classList.add('active');
    }
  });
}

// Smooth scrolling for anchor links
document.addEventListener('click', function(e) {
  if (e.target.tagName === 'A' && e.target.getAttribute('href').startsWith('#')) {
    e.preventDefault();
    const target = document.querySelector(e.target.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }
});
`;

    await fs.writeFile(path.join(this.config.outputPath!, 'assets', 'scripts.js'), js);
  }

  private async copyAssets(): Promise<void> {
    // Copy favicon and other static assets
    const assetsDir = path.join(this.config.outputPath!, 'assets');
    await fs.ensureDir(assetsDir);

    // Create a simple favicon
    const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#2196F3"/>
  <text x="16" y="20" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">R</text>
</svg>`;

    await fs.writeFile(path.join(assetsDir, 'favicon.svg'), faviconSvg);
  }

  private calculateStatistics(apiDocs: APIDocumentation): DocsStatistics {
    const totalCodeBlocks = apiDocs.commands.reduce((sum, cmd) => sum + cmd.examples.length, 0) +
                           apiDocs.examples.reduce((sum, ex) => sum + ex.steps.length, 0);

    return {
      totalPages: apiDocs.commands.length + apiDocs.examples.length + apiDocs.guides.length + apiDocs.types.length + 5, // +5 for index pages
      totalCommands: apiDocs.commands.length,
      totalExamples: apiDocs.examples.length,
      totalGuides: apiDocs.guides.length,
      totalTypes: apiDocs.types.length,
      generationTime: 0, // Will be set by caller
      assetSize: 0, // Would calculate actual asset sizes
      codeBlocks: totalCodeBlocks,
      interactiveElements: apiDocs.playground.enabled ? totalCodeBlocks : 0
    };
  }

  private getDefaultTheme(): DocsTheme {
    return {
      name: 'default',
      colors: {
        primary: '#2196F3',
        secondary: '#607D8B',
        accent: '#FF5722',
        background: '#FFFFFF',
        surface: '#F8F9FA',
        text: '#333333',
        textSecondary: '#666666',
        border: '#E1E4E8',
        success: '#28A745',
        warning: '#FFC107',
        error: '#DC3545',
        info: '#17A2B8'
      },
      typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '16px',
        lineHeight: '1.6',
        headingFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        codeFont: '"SFMono-Regular", Consolas, monospace'
      },
      layout: {
        maxWidth: '1200px',
        sidebarWidth: '250px',
        headerHeight: '64px',
        spacing: '1rem',
        borderRadius: '6px'
      },
      components: {
        button: {
          background: '#2196F3',
          border: 'none',
          padding: '0.75rem 1.5rem',
          margin: '0',
          borderRadius: '6px'
        },
        input: {
          background: '#FFFFFF',
          border: '1px solid #E1E4E8',
          padding: '0.75rem',
          margin: '0',
          borderRadius: '6px'
        },
        card: {
          background: '#FFFFFF',
          border: '1px solid #E1E4E8',
          padding: '1.5rem',
          margin: '1rem 0',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        },
        code: {
          background: '#F6F8FA',
          border: '1px solid #E1E4E8',
          padding: '1rem',
          margin: '1rem 0',
          borderRadius: '6px'
        },
        table: {
          background: '#FFFFFF',
          border: '1px solid #E1E4E8',
          padding: '0',
          margin: '1rem 0',
          borderRadius: '6px'
        }
      }
    };
  }
}

// Export utility functions
export async function generateInteractiveDocs(
  projectPath: string,
  config?: Partial<InteractiveDocsConfig>
): Promise<DocsGenerationResult> {
  const generator = new InteractiveDocsGenerator(projectPath, config);
  return generator.generateDocumentation();
}

export function createDocsTheme(customizations: Partial<DocsTheme>): DocsTheme {
  const defaultTheme: DocsTheme = {
    name: 'default',
    colors: {
      primary: '#2196F3',
      secondary: '#607D8B',
      accent: '#FF5722',
      background: '#FFFFFF',
      surface: '#F8F9FA',
      text: '#333333',
      textSecondary: '#666666',
      border: '#E1E4E8',
      success: '#28A745',
      warning: '#FFC107',
      error: '#DC3545',
      info: '#17A2B8'
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '16px',
      lineHeight: '1.6',
      headingFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      codeFont: '"SFMono-Regular", Consolas, monospace'
    },
    layout: {
      maxWidth: '1200px',
      sidebarWidth: '250px',
      headerHeight: '64px',
      spacing: '1rem',
      borderRadius: '6px'
    },
    components: {
      button: {
        background: '#2196F3',
        border: 'none',
        padding: '0.75rem 1.5rem',
        margin: '0',
        borderRadius: '6px'
      },
      input: {
        background: '#FFFFFF',
        border: '1px solid #E1E4E8',
        padding: '0.75rem',
        margin: '0',
        borderRadius: '6px'
      },
      card: {
        background: '#FFFFFF',
        border: '1px solid #E1E4E8',
        padding: '1.5rem',
        margin: '1rem 0',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      },
      code: {
        background: '#F6F8FA',
        border: '1px solid #E1E4E8',
        padding: '1rem',
        margin: '1rem 0',
        borderRadius: '6px'
      },
      table: {
        background: '#FFFFFF',
        border: '1px solid #E1E4E8',
        padding: '0',
        margin: '1rem 0',
        borderRadius: '6px'
      }
    }
  };
  
  return {
    ...defaultTheme,
    ...customizations,
    colors: { ...defaultTheme.colors, ...customizations.colors },
    typography: { ...defaultTheme.typography, ...customizations.typography },
    layout: { ...defaultTheme.layout, ...customizations.layout },
    components: { ...defaultTheme.components, ...customizations.components }
  };
}