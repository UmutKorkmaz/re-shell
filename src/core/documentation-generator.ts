import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

export interface DocumentationConfig {
  projectName: string;
  projectPath: string;
  description?: string;
  author?: string;
  license?: string;
  repository?: string;
  homepage?: string;
  outputFormat?: 'markdown' | 'html' | 'pdf' | 'all';
  includeApi?: boolean;
  includeExamples?: boolean;
  includeChangelog?: boolean;
  includeContributing?: boolean;
  includeLicense?: boolean;
  includeArchitecture?: boolean;
  customSections?: CustomSection[];
  theme?: 'default' | 'minimal' | 'technical' | 'modern';
}

export interface CustomSection {
  title: string;
  content: string;
  order?: number;
}

export interface ProjectInfo {
  name: string;
  version?: string;
  description?: string;
  keywords?: string[];
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  repository?: string | { type: string; url: string };
  homepage?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  engines?: Record<string, string>;
  bin?: string | Record<string, string>;
}

export interface GeneratedDocument {
  type: string;
  path: string;
  content: string;
  format: 'markdown' | 'html' | 'pdf';
}

export interface DocumentationResult {
  success: boolean;
  documents: GeneratedDocument[];
  errors?: string[];
  warnings?: string[];
}

export interface ApiDocumentation {
  modules: ModuleDoc[];
  classes: ClassDoc[];
  functions: FunctionDoc[];
  interfaces: InterfaceDoc[];
  types: TypeDoc[];
}

export interface ModuleDoc {
  name: string;
  description?: string;
  exports: string[];
  imports: string[];
  path: string;
}

export interface ClassDoc {
  name: string;
  description?: string;
  extends?: string;
  implements?: string[];
  constructors: MethodDoc[];
  properties: PropertyDoc[];
  methods: MethodDoc[];
  module: string;
}

export interface FunctionDoc {
  name: string;
  description?: string;
  parameters: ParameterDoc[];
  returns?: ReturnDoc;
  examples?: string[];
  module: string;
}

export interface InterfaceDoc {
  name: string;
  description?: string;
  extends?: string[];
  properties: PropertyDoc[];
  methods: MethodDoc[];
  module: string;
}

export interface TypeDoc {
  name: string;
  description?: string;
  type: string;
  module: string;
}

export interface MethodDoc {
  name: string;
  description?: string;
  visibility?: 'public' | 'private' | 'protected';
  static?: boolean;
  async?: boolean;
  parameters: ParameterDoc[];
  returns?: ReturnDoc;
  examples?: string[];
}

export interface PropertyDoc {
  name: string;
  description?: string;
  type: string;
  visibility?: 'public' | 'private' | 'protected';
  static?: boolean;
  readonly?: boolean;
  optional?: boolean;
  defaultValue?: string;
}

export interface ParameterDoc {
  name: string;
  description?: string;
  type: string;
  optional?: boolean;
  defaultValue?: string;
}

export interface ReturnDoc {
  type: string;
  description?: string;
}

export class DocumentationGenerator extends EventEmitter {
  private projectInfo?: ProjectInfo;
  private apiDocs?: ApiDocumentation;

  constructor() {
    super();
  }

  async generate(config: DocumentationConfig): Promise<DocumentationResult> {
    this.emit('generation:start', config);

    const result: DocumentationResult = {
      success: false,
      documents: [],
      errors: [],
      warnings: []
    };

    try {
      // Load project information
      this.projectInfo = await this.loadProjectInfo(config.projectPath);

      // Generate API documentation if requested
      if (config.includeApi) {
        try {
          this.apiDocs = await this.generateApiDocumentation(config.projectPath);
        } catch (error: any) {
          result.warnings?.push(`Failed to generate API documentation: ${error.message}`);
        }
      }

      // Generate documents based on format
      const formats = config.outputFormat === 'all' 
        ? ['markdown', 'html', 'pdf'] as const
        : [config.outputFormat || 'markdown'];

      for (const format of formats) {
        const documents = await this.generateDocuments(config, format);
        result.documents.push(...documents);
      }

      result.success = result.documents.length > 0;
      this.emit('generation:complete', result);
      return result;

    } catch (error: any) {
      result.errors?.push(error.message);
      this.emit('generation:error', error);
      return result;
    }
  }

  private async loadProjectInfo(projectPath: string): Promise<ProjectInfo> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (await fs.pathExists(packageJsonPath)) {
      return await fs.readJson(packageJsonPath);
    }

    // Fallback for non-Node.js projects
    return {
      name: path.basename(projectPath),
      description: 'Project documentation'
    };
  }

  private async generateDocuments(
    config: DocumentationConfig,
    format: 'markdown' | 'html' | 'pdf'
  ): Promise<GeneratedDocument[]> {
    const documents: GeneratedDocument[] = [];

    // Main README
    const readme = await this.generateReadme(config);
    documents.push({
      type: 'README',
      path: path.join(config.projectPath, format === 'markdown' ? 'README.md' : `README.${format}`),
      content: this.convertFormat(readme, 'markdown', format),
      format
    });

    // API Documentation
    if (config.includeApi && this.apiDocs) {
      const apiDoc = await this.generateApiDoc(config);
      documents.push({
        type: 'API',
        path: path.join(config.projectPath, 'docs', format === 'markdown' ? 'API.md' : `API.${format}`),
        content: this.convertFormat(apiDoc, 'markdown', format),
        format
      });
    }

    // Examples Documentation
    if (config.includeExamples) {
      const examples = await this.generateExamplesDoc(config);
      documents.push({
        type: 'EXAMPLES',
        path: path.join(config.projectPath, 'docs', format === 'markdown' ? 'EXAMPLES.md' : `EXAMPLES.${format}`),
        content: this.convertFormat(examples, 'markdown', format),
        format
      });
    }

    // Changelog
    if (config.includeChangelog) {
      const changelog = await this.generateChangelog(config);
      documents.push({
        type: 'CHANGELOG',
        path: path.join(config.projectPath, format === 'markdown' ? 'CHANGELOG.md' : `CHANGELOG.${format}`),
        content: this.convertFormat(changelog, 'markdown', format),
        format
      });
    }

    // Contributing Guide
    if (config.includeContributing) {
      const contributing = await this.generateContributing(config);
      documents.push({
        type: 'CONTRIBUTING',
        path: path.join(config.projectPath, format === 'markdown' ? 'CONTRIBUTING.md' : `CONTRIBUTING.${format}`),
        content: this.convertFormat(contributing, 'markdown', format),
        format
      });
    }

    // Architecture Documentation
    if (config.includeArchitecture) {
      const architecture = await this.generateArchitectureDoc(config);
      documents.push({
        type: 'ARCHITECTURE',
        path: path.join(config.projectPath, 'docs', format === 'markdown' ? 'ARCHITECTURE.md' : `ARCHITECTURE.${format}`),
        content: this.convertFormat(architecture, 'markdown', format),
        format
      });
    }

    // License
    if (config.includeLicense) {
      const license = await this.generateLicense(config);
      documents.push({
        type: 'LICENSE',
        path: path.join(config.projectPath, 'LICENSE'),
        content: license,
        format: 'markdown' // License is always plain text
      });
    }

    return documents;
  }

  private async generateReadme(config: DocumentationConfig): Promise<string> {
    const sections: string[] = [];
    const info = this.projectInfo || { name: config.projectName };

    // Header
    sections.push(`# ${info.name}`);
    sections.push('');

    // Badges
    const badges = this.generateBadges(config, info);
    if (badges.length > 0) {
      sections.push(badges.join(' '));
      sections.push('');
    }

    // Description
    const description = config.description || info.description || 'A project built with Re-Shell CLI';
    sections.push(description);
    sections.push('');

    // Table of Contents
    sections.push('## Table of Contents');
    sections.push('');
    sections.push('- [Features](#features)');
    sections.push('- [Installation](#installation)');
    sections.push('- [Usage](#usage)');
    sections.push('- [Development](#development)');
    if (config.includeApi) sections.push('- [API Documentation](#api-documentation)');
    if (config.includeExamples) sections.push('- [Examples](#examples)');
    if (config.includeArchitecture) sections.push('- [Architecture](#architecture)');
    sections.push('- [Testing](#testing)');
    sections.push('- [Contributing](#contributing)');
    sections.push('- [License](#license)');
    sections.push('');

    // Features
    sections.push('## Features');
    sections.push('');
    sections.push(await this.generateFeaturesList(config));
    sections.push('');

    // Installation
    sections.push('## Installation');
    sections.push('');
    sections.push('### Prerequisites');
    sections.push('');
    sections.push(this.generatePrerequisites(info));
    sections.push('');
    sections.push('### Setup');
    sections.push('');
    sections.push('```bash');
    sections.push('# Clone the repository');
    sections.push(`git clone ${info.repository || 'https://github.com/username/repo.git'}`);
    sections.push(`cd ${info.name}`);
    sections.push('');
    sections.push('# Install dependencies');
    sections.push(this.getInstallCommand(config.projectPath));
    sections.push('```');
    sections.push('');

    // Usage
    sections.push('## Usage');
    sections.push('');
    sections.push(await this.generateUsageSection(config, info));
    sections.push('');

    // Development
    sections.push('## Development');
    sections.push('');
    sections.push(this.generateDevelopmentSection(info));
    sections.push('');

    // API Documentation
    if (config.includeApi) {
      sections.push('## API Documentation');
      sections.push('');
      sections.push('See [API.md](docs/API.md) for detailed API documentation.');
      sections.push('');
    }

    // Examples
    if (config.includeExamples) {
      sections.push('## Examples');
      sections.push('');
      sections.push('See [EXAMPLES.md](docs/EXAMPLES.md) for usage examples.');
      sections.push('');
    }

    // Architecture
    if (config.includeArchitecture) {
      sections.push('## Architecture');
      sections.push('');
      sections.push('See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for architectural details.');
      sections.push('');
    }

    // Testing
    sections.push('## Testing');
    sections.push('');
    sections.push(this.generateTestingSection(info));
    sections.push('');

    // Contributing
    sections.push('## Contributing');
    sections.push('');
    if (config.includeContributing) {
      sections.push('Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.');
    } else {
      sections.push('Contributions are welcome! Please feel free to submit a Pull Request.');
    }
    sections.push('');

    // License
    sections.push('## License');
    sections.push('');
    const license = config.license || info.license || 'MIT';
    sections.push(`This project is licensed under the ${license} License${config.includeLicense ? ' - see the [LICENSE](LICENSE) file for details' : ''}.`);
    sections.push('');

    // Custom sections
    if (config.customSections) {
      const sortedSections = [...config.customSections].sort((a, b) => (a.order || 0) - (b.order || 0));
      for (const section of sortedSections) {
        sections.push(`## ${section.title}`);
        sections.push('');
        sections.push(section.content);
        sections.push('');
      }
    }

    // Footer
    sections.push('---');
    sections.push('');
    sections.push(`Generated with ❤️ by [Re-Shell CLI](https://github.com/umutkorkmaz/re-shell-cli)`);

    return sections.join('\n');
  }

  private generateBadges(config: DocumentationConfig, info: ProjectInfo): string[] {
    const badges: string[] = [];

    // Version badge
    if (info.version) {
      badges.push(`![Version](https://img.shields.io/badge/version-${info.version}-blue.svg)`);
    }

    // License badge
    const license = config.license || info.license;
    if (license) {
      badges.push(`![License](https://img.shields.io/badge/license-${license}-green.svg)`);
    }

    // Build status badge (if CI is detected)
    if (info.scripts?.test || info.scripts?.build) {
      badges.push('![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)');
    }

    // Coverage badge
    if (info.scripts?.coverage) {
      badges.push('![Coverage](https://img.shields.io/badge/coverage-0%25-red.svg)');
    }

    // Node version badge
    if (info.engines?.node) {
      badges.push(`![Node](https://img.shields.io/badge/node-${info.engines.node}-brightgreen.svg)`);
    }

    return badges;
  }

  private async generateFeaturesList(config: DocumentationConfig): Promise<string> {
    const features: string[] = [];

    // Analyze project to determine features
    const projectPath = config.projectPath;
    
    // Check for common features
    if (await fs.pathExists(path.join(projectPath, 'tsconfig.json'))) {
      features.push('✅ TypeScript support');
    }

    if (await fs.pathExists(path.join(projectPath, '.eslintrc.js')) || 
        await fs.pathExists(path.join(projectPath, '.eslintrc.json'))) {
      features.push('✅ ESLint configuration');
    }

    if (await fs.pathExists(path.join(projectPath, '.prettierrc'))) {
      features.push('✅ Prettier code formatting');
    }

    if (await fs.pathExists(path.join(projectPath, 'jest.config.js')) ||
        this.projectInfo?.devDependencies?.jest) {
      features.push('✅ Jest testing framework');
    }

    if (await fs.pathExists(path.join(projectPath, 'docker-compose.yml')) ||
        await fs.pathExists(path.join(projectPath, 'Dockerfile'))) {
      features.push('✅ Docker support');
    }

    if (await fs.pathExists(path.join(projectPath, '.github/workflows'))) {
      features.push('✅ GitHub Actions CI/CD');
    }

    // Add default features if none detected
    if (features.length === 0) {
      features.push('🚀 Fast and efficient');
      features.push('📦 Easy to install');
      features.push('🔧 Highly configurable');
      features.push('📚 Well documented');
    }

    return features.map(f => `- ${f}`).join('\n');
  }

  private generatePrerequisites(info: ProjectInfo): string {
    const prereqs: string[] = [];

    if (info.engines?.node) {
      prereqs.push(`- Node.js ${info.engines.node}`);
    } else {
      prereqs.push('- Node.js >= 16.0.0');
    }

    if (info.engines?.npm) {
      prereqs.push(`- npm ${info.engines.npm}`);
    }

    if (info.engines?.yarn) {
      prereqs.push(`- Yarn ${info.engines.yarn}`);
    }

    return prereqs.join('\n');
  }

  private getInstallCommand(projectPath: string): string {
    // Detect package manager
    if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
      return 'pnpm install';
    } else if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
      return 'yarn install';
    } else if (fs.existsSync(path.join(projectPath, 'bun.lockb'))) {
      return 'bun install';
    }
    return 'npm install';
  }

  private async generateUsageSection(config: DocumentationConfig, info: ProjectInfo): Promise<string> {
    const lines: string[] = [];

    // Basic usage
    if (info.scripts?.start) {
      lines.push('### Running the application');
      lines.push('');
      lines.push('```bash');
      lines.push('npm start');
      lines.push('```');
      lines.push('');
    }

    // Development mode
    if (info.scripts?.dev || info.scripts?.develop) {
      lines.push('### Development mode');
      lines.push('');
      lines.push('```bash');
      lines.push(`npm run ${info.scripts.dev ? 'dev' : 'develop'}`);
      lines.push('```');
      lines.push('');
    }

    // CLI usage if applicable
    if (info.bin) {
      lines.push('### CLI Usage');
      lines.push('');
      lines.push('```bash');
      const binName = typeof info.bin === 'string' ? info.name : Object.keys(info.bin)[0];
      lines.push(`${binName} [command] [options]`);
      lines.push('```');
      lines.push('');
      lines.push('For more information, run:');
      lines.push('```bash');
      lines.push(`${binName} --help`);
      lines.push('```');
      lines.push('');
    }

    // Configuration
    lines.push('### Configuration');
    lines.push('');
    lines.push('Configuration options can be set in the following ways:');
    lines.push('');
    lines.push('1. Environment variables');
    lines.push('2. Configuration file (`.env` or `config.json`)');
    lines.push('3. Command line arguments');
    lines.push('');

    return lines.join('\n');
  }

  private generateDevelopmentSection(info: ProjectInfo): string {
    const lines: string[] = [];

    // Available scripts
    if (info.scripts && Object.keys(info.scripts).length > 0) {
      lines.push('### Available Scripts');
      lines.push('');
      
      for (const [script, command] of Object.entries(info.scripts)) {
        lines.push(`- \`npm run ${script}\`: ${this.describeScript(script, command)}`);
      }
      lines.push('');
    }

    // Project structure
    lines.push('### Project Structure');
    lines.push('');
    lines.push('```');
    lines.push(this.generateProjectStructure());
    lines.push('```');

    return lines.join('\n');
  }

  private describeScript(script: string, command: string): string {
    const descriptions: Record<string, string> = {
      start: 'Start the application',
      dev: 'Start development server with hot reload',
      develop: 'Start development server',
      build: 'Build the application for production',
      test: 'Run tests',
      'test:watch': 'Run tests in watch mode',
      'test:coverage': 'Run tests with coverage report',
      lint: 'Run linter',
      'lint:fix': 'Run linter and fix issues',
      format: 'Format code with Prettier',
      clean: 'Clean build artifacts',
      typecheck: 'Run TypeScript type checking',
      docs: 'Generate documentation',
      deploy: 'Deploy the application'
    };

    return descriptions[script] || command;
  }

  private generateProjectStructure(): string {
    return `├── src/              # Source files
│   ├── index.ts      # Application entry point
│   ├── config/       # Configuration files
│   ├── controllers/  # Route controllers
│   ├── models/       # Data models
│   ├── services/     # Business logic
│   └── utils/        # Utility functions
├── tests/            # Test files
├── docs/             # Documentation
├── scripts/          # Build and deployment scripts
├── .env.example      # Environment variables example
├── .gitignore        # Git ignore file
├── package.json      # Project metadata and dependencies
├── README.md         # Project documentation
└── tsconfig.json     # TypeScript configuration`;
  }

  private generateTestingSection(info: ProjectInfo): string {
    const lines: string[] = [];

    lines.push('Run the test suite using:');
    lines.push('');
    lines.push('```bash');
    lines.push('# Run all tests');
    lines.push(info.scripts?.test ? 'npm test' : 'npm test');
    lines.push('');
    
    if (info.scripts?.['test:watch']) {
      lines.push('# Run tests in watch mode');
      lines.push('npm run test:watch');
      lines.push('');
    }
    
    if (info.scripts?.['test:coverage'] || info.scripts?.coverage) {
      lines.push('# Run tests with coverage');
      lines.push(`npm run ${info.scripts['test:coverage'] ? 'test:coverage' : 'coverage'}`);
      lines.push('');
    }
    
    lines.push('```');

    return lines.join('\n');
  }

  private async generateApiDoc(config: DocumentationConfig): Promise<string> {
    if (!this.apiDocs) {
      return '# API Documentation\n\nNo API documentation available.';
    }

    const sections: string[] = [];

    sections.push('# API Documentation');
    sections.push('');
    sections.push(`API documentation for ${config.projectName}`);
    sections.push('');

    // Table of Contents
    sections.push('## Table of Contents');
    sections.push('');
    if (this.apiDocs.modules.length > 0) sections.push('- [Modules](#modules)');
    if (this.apiDocs.classes.length > 0) sections.push('- [Classes](#classes)');
    if (this.apiDocs.interfaces.length > 0) sections.push('- [Interfaces](#interfaces)');
    if (this.apiDocs.functions.length > 0) sections.push('- [Functions](#functions)');
    if (this.apiDocs.types.length > 0) sections.push('- [Types](#types)');
    sections.push('');

    // Modules
    if (this.apiDocs.modules.length > 0) {
      sections.push('## Modules');
      sections.push('');
      
      for (const module of this.apiDocs.modules) {
        sections.push(`### ${module.name}`);
        sections.push('');
        if (module.description) {
          sections.push(module.description);
          sections.push('');
        }
        sections.push(`**Path:** \`${module.path}\``);
        sections.push('');
        
        if (module.exports.length > 0) {
          sections.push('**Exports:**');
          sections.push('');
          for (const exp of module.exports) {
            sections.push(`- \`${exp}\``);
          }
          sections.push('');
        }
      }
    }

    // Classes
    if (this.apiDocs.classes.length > 0) {
      sections.push('## Classes');
      sections.push('');
      
      for (const cls of this.apiDocs.classes) {
        sections.push(`### ${cls.name}`);
        sections.push('');
        if (cls.description) {
          sections.push(cls.description);
          sections.push('');
        }
        
        if (cls.extends) {
          sections.push(`**Extends:** \`${cls.extends}\``);
          sections.push('');
        }
        
        if (cls.implements && cls.implements.length > 0) {
          sections.push(`**Implements:** ${cls.implements.map(i => `\`${i}\``).join(', ')}`);
          sections.push('');
        }
        
        // Constructor
        if (cls.constructors.length > 0) {
          sections.push('#### Constructor');
          sections.push('');
          for (const ctor of cls.constructors) {
            sections.push(this.formatMethod(ctor, 'constructor'));
          }
        }
        
        // Properties
        if (cls.properties.length > 0) {
          sections.push('#### Properties');
          sections.push('');
          sections.push('| Name | Type | Description |');
          sections.push('|------|------|-------------|');
          for (const prop of cls.properties) {
            const visibility = prop.visibility !== 'public' ? `${prop.visibility} ` : '';
            const modifiers = [
              visibility,
              prop.static ? 'static ' : '',
              prop.readonly ? 'readonly ' : ''
            ].join('');
            sections.push(`| ${modifiers}\`${prop.name}\` | \`${prop.type}\` | ${prop.description || '-'} |`);
          }
          sections.push('');
        }
        
        // Methods
        if (cls.methods.length > 0) {
          sections.push('#### Methods');
          sections.push('');
          for (const method of cls.methods) {
            sections.push(this.formatMethod(method));
          }
        }
      }
    }

    // Interfaces
    if (this.apiDocs.interfaces.length > 0) {
      sections.push('## Interfaces');
      sections.push('');
      
      for (const iface of this.apiDocs.interfaces) {
        sections.push(`### ${iface.name}`);
        sections.push('');
        if (iface.description) {
          sections.push(iface.description);
          sections.push('');
        }
        
        if (iface.extends && iface.extends.length > 0) {
          sections.push(`**Extends:** ${iface.extends.map(e => `\`${e}\``).join(', ')}`);
          sections.push('');
        }
        
        // Properties
        if (iface.properties.length > 0) {
          sections.push('#### Properties');
          sections.push('');
          sections.push('| Name | Type | Required | Description |');
          sections.push('|------|------|----------|-------------|');
          for (const prop of iface.properties) {
            sections.push(`| \`${prop.name}\` | \`${prop.type}\` | ${prop.optional ? 'No' : 'Yes'} | ${prop.description || '-'} |`);
          }
          sections.push('');
        }
        
        // Methods
        if (iface.methods.length > 0) {
          sections.push('#### Methods');
          sections.push('');
          for (const method of iface.methods) {
            sections.push(this.formatMethod(method));
          }
        }
      }
    }

    // Functions
    if (this.apiDocs.functions.length > 0) {
      sections.push('## Functions');
      sections.push('');
      
      for (const func of this.apiDocs.functions) {
        sections.push(`### ${func.name}`);
        sections.push('');
        sections.push(this.formatFunction(func));
      }
    }

    // Types
    if (this.apiDocs.types.length > 0) {
      sections.push('## Types');
      sections.push('');
      
      for (const type of this.apiDocs.types) {
        sections.push(`### ${type.name}`);
        sections.push('');
        if (type.description) {
          sections.push(type.description);
          sections.push('');
        }
        sections.push('```typescript');
        sections.push(`type ${type.name} = ${type.type};`);
        sections.push('```');
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  private formatMethod(method: MethodDoc, name?: string): string {
    const lines: string[] = [];
    const methodName = name || method.name;
    
    // Signature
    const visibility = method.visibility !== 'public' ? `${method.visibility} ` : '';
    const modifiers = [
      visibility,
      method.static ? 'static ' : '',
      method.async ? 'async ' : ''
    ].join('');
    
    const params = method.parameters.map(p => {
      const optional = p.optional ? '?' : '';
      const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
      return `${p.name}${optional}: ${p.type}${defaultVal}`;
    }).join(', ');
    
    const returnType = method.returns ? `: ${method.returns.type}` : '';
    
    lines.push(`##### ${modifiers}\`${methodName}(${params})${returnType}\``);
    lines.push('');
    
    if (method.description) {
      lines.push(method.description);
      lines.push('');
    }
    
    // Parameters
    if (method.parameters.length > 0) {
      lines.push('**Parameters:**');
      lines.push('');
      for (const param of method.parameters) {
        lines.push(`- \`${param.name}\` (\`${param.type}\`)${param.optional ? ' - Optional' : ''} - ${param.description || 'No description'}`);
      }
      lines.push('');
    }
    
    // Returns
    if (method.returns) {
      lines.push('**Returns:**');
      lines.push('');
      lines.push(`\`${method.returns.type}\` - ${method.returns.description || 'No description'}`);
      lines.push('');
    }
    
    // Examples
    if (method.examples && method.examples.length > 0) {
      lines.push('**Example:**');
      lines.push('');
      lines.push('```typescript');
      lines.push(method.examples.join('\n'));
      lines.push('```');
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private formatFunction(func: FunctionDoc): string {
    const lines: string[] = [];
    
    if (func.description) {
      lines.push(func.description);
      lines.push('');
    }
    
    // Signature
    const params = func.parameters.map(p => {
      const optional = p.optional ? '?' : '';
      const defaultVal = p.defaultValue ? ` = ${p.defaultValue}` : '';
      return `${p.name}${optional}: ${p.type}${defaultVal}`;
    }).join(', ');
    
    const returnType = func.returns ? `: ${func.returns.type}` : '';
    
    lines.push('```typescript');
    lines.push(`function ${func.name}(${params})${returnType}`);
    lines.push('```');
    lines.push('');
    
    // Parameters
    if (func.parameters.length > 0) {
      lines.push('**Parameters:**');
      lines.push('');
      for (const param of func.parameters) {
        lines.push(`- \`${param.name}\` (\`${param.type}\`)${param.optional ? ' - Optional' : ''} - ${param.description || 'No description'}`);
      }
      lines.push('');
    }
    
    // Returns
    if (func.returns) {
      lines.push('**Returns:**');
      lines.push('');
      lines.push(`\`${func.returns.type}\` - ${func.returns.description || 'No description'}`);
      lines.push('');
    }
    
    // Examples
    if (func.examples && func.examples.length > 0) {
      lines.push('**Example:**');
      lines.push('');
      lines.push('```typescript');
      lines.push(func.examples.join('\n'));
      lines.push('```');
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private async generateExamplesDoc(config: DocumentationConfig): Promise<string> {
    const sections: string[] = [];

    sections.push('# Examples');
    sections.push('');
    sections.push(`Usage examples for ${config.projectName}`);
    sections.push('');

    // Basic example
    sections.push('## Basic Usage');
    sections.push('');
    sections.push('```javascript');
    sections.push(`const ${this.toCamelCase(config.projectName)} = require('${config.projectName}');`);
    sections.push('');
    sections.push('// Basic example');
    sections.push(`const result = ${this.toCamelCase(config.projectName)}.doSomething();`);
    sections.push('console.log(result);');
    sections.push('```');
    sections.push('');

    // Advanced examples
    sections.push('## Advanced Usage');
    sections.push('');
    
    // Configuration example
    sections.push('### With Configuration');
    sections.push('');
    sections.push('```javascript');
    sections.push(`const ${this.toCamelCase(config.projectName)} = require('${config.projectName}');`);
    sections.push('');
    sections.push('const config = {');
    sections.push('  option1: true,');
    sections.push('  option2: \'value\',');
    sections.push('  nested: {');
    sections.push('    setting: 42');
    sections.push('  }');
    sections.push('};');
    sections.push('');
    sections.push(`const instance = new ${this.toPascalCase(config.projectName)}(config);`);
    sections.push('const result = await instance.process();');
    sections.push('```');
    sections.push('');

    // Error handling example
    sections.push('### Error Handling');
    sections.push('');
    sections.push('```javascript');
    sections.push('try {');
    sections.push(`  const result = await ${this.toCamelCase(config.projectName)}.riskyOperation();`);
    sections.push('  console.log(\'Success:\', result);');
    sections.push('} catch (error) {');
    sections.push('  console.error(\'Error:\', error.message);');
    sections.push('  // Handle error appropriately');
    sections.push('}');
    sections.push('```');
    sections.push('');

    // Real-world example
    sections.push('## Real-World Example');
    sections.push('');
    sections.push('Here\'s a complete example showing how to use this library in a real application:');
    sections.push('');
    sections.push('```javascript');
    sections.push('const express = require(\'express\');');
    sections.push(`const ${this.toCamelCase(config.projectName)} = require('${config.projectName}');`);
    sections.push('');
    sections.push('const app = express();');
    sections.push(`const service = new ${this.toPascalCase(config.projectName)}({`);
    sections.push('  // Configuration options');
    sections.push('});');
    sections.push('');
    sections.push('app.post(\'/api/process\', async (req, res) => {');
    sections.push('  try {');
    sections.push('    const result = await service.process(req.body);');
    sections.push('    res.json({ success: true, data: result });');
    sections.push('  } catch (error) {');
    sections.push('    res.status(500).json({ success: false, error: error.message });');
    sections.push('  }');
    sections.push('});');
    sections.push('');
    sections.push('app.listen(3000, () => {');
    sections.push('  console.log(\'Server running on port 3000\');');
    sections.push('});');
    sections.push('```');

    return sections.join('\n');
  }

  private async generateChangelog(config: DocumentationConfig): Promise<string> {
    const sections: string[] = [];

    sections.push('# Changelog');
    sections.push('');
    sections.push('All notable changes to this project will be documented in this file.');
    sections.push('');
    sections.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),');
    sections.push('and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).');
    sections.push('');

    // Current version
    const version = this.projectInfo?.version || '1.0.0';
    const date = new Date().toISOString().split('T')[0];

    sections.push(`## [${version}] - ${date}`);
    sections.push('');
    sections.push('### Added');
    sections.push('- Initial release');
    sections.push('- Core functionality implementation');
    sections.push('- Documentation');
    sections.push('- Test suite');
    sections.push('');
    sections.push('### Changed');
    sections.push('- N/A');
    sections.push('');
    sections.push('### Deprecated');
    sections.push('- N/A');
    sections.push('');
    sections.push('### Removed');
    sections.push('- N/A');
    sections.push('');
    sections.push('### Fixed');
    sections.push('- N/A');
    sections.push('');
    sections.push('### Security');
    sections.push('- N/A');

    return sections.join('\n');
  }

  private async generateContributing(config: DocumentationConfig): Promise<string> {
    const sections: string[] = [];

    sections.push('# Contributing');
    sections.push('');
    sections.push(`We love your input! We want to make contributing to ${config.projectName} as easy and transparent as possible, whether it's:`);
    sections.push('');
    sections.push('- Reporting a bug');
    sections.push('- Discussing the current state of the code');
    sections.push('- Submitting a fix');
    sections.push('- Proposing new features');
    sections.push('- Becoming a maintainer');
    sections.push('');

    sections.push('## Development Process');
    sections.push('');
    sections.push('We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.');
    sections.push('');

    sections.push('## Pull Requests');
    sections.push('');
    sections.push('1. Fork the repo and create your branch from `main`.');
    sections.push('2. If you\'ve added code that should be tested, add tests.');
    sections.push('3. If you\'ve changed APIs, update the documentation.');
    sections.push('4. Ensure the test suite passes.');
    sections.push('5. Make sure your code lints.');
    sections.push('6. Issue that pull request!');
    sections.push('');

    sections.push('## Any contributions you make will be under the Software License');
    sections.push('');
    sections.push('In short, when you submit code changes, your submissions are understood to be under the same license that covers the project.');
    sections.push('');

    sections.push('## Report bugs using Github\'s issues');
    sections.push('');
    sections.push('We use GitHub issues to track public bugs. Report a bug by opening a new issue.');
    sections.push('');

    sections.push('## Write bug reports with detail, background, and sample code');
    sections.push('');
    sections.push('**Great Bug Reports** tend to have:');
    sections.push('');
    sections.push('- A quick summary and/or background');
    sections.push('- Steps to reproduce');
    sections.push('  - Be specific!');
    sections.push('  - Give sample code if you can.');
    sections.push('- What you expected would happen');
    sections.push('- What actually happens');
    sections.push('- Notes (possibly including why you think this might be happening, or stuff you tried that didn\'t work)');
    sections.push('');

    sections.push('## Code Style');
    sections.push('');
    sections.push('- 2 spaces for indentation rather than tabs');
    sections.push('- 80 character line length');
    sections.push('- Run `npm run lint` to check your code style');
    sections.push('- Run `npm run format` to automatically format your code');
    sections.push('');

    sections.push('## License');
    sections.push('');
    sections.push(`By contributing, you agree that your contributions will be licensed under its ${config.license || 'MIT'} License.`);

    return sections.join('\n');
  }

  private async generateArchitectureDoc(config: DocumentationConfig): Promise<string> {
    const sections: string[] = [];

    sections.push('# Architecture');
    sections.push('');
    sections.push(`This document describes the architecture of ${config.projectName}.`);
    sections.push('');

    sections.push('## Overview');
    sections.push('');
    sections.push('The application follows a modular architecture with clear separation of concerns.');
    sections.push('');

    sections.push('## Core Components');
    sections.push('');
    sections.push('### 1. Core Module');
    sections.push('');
    sections.push('The core module contains the fundamental business logic and domain models.');
    sections.push('');
    sections.push('```');
    sections.push('core/');
    sections.push('├── models/      # Domain models');
    sections.push('├── services/    # Business logic');
    sections.push('├── interfaces/  # Core interfaces');
    sections.push('└── utils/       # Core utilities');
    sections.push('```');
    sections.push('');

    sections.push('### 2. API Layer');
    sections.push('');
    sections.push('The API layer handles external communication and request/response processing.');
    sections.push('');
    sections.push('```');
    sections.push('api/');
    sections.push('├── controllers/ # Request handlers');
    sections.push('├── middleware/  # Request processing');
    sections.push('├── routes/      # Route definitions');
    sections.push('└── validators/  # Input validation');
    sections.push('```');
    sections.push('');

    sections.push('### 3. Data Layer');
    sections.push('');
    sections.push('The data layer manages data persistence and retrieval.');
    sections.push('');
    sections.push('```');
    sections.push('data/');
    sections.push('├── repositories/ # Data access');
    sections.push('├── migrations/   # Database migrations');
    sections.push('├── seeds/        # Test data');
    sections.push('└── adapters/     # External service adapters');
    sections.push('```');
    sections.push('');

    sections.push('## Design Patterns');
    sections.push('');
    sections.push('### Repository Pattern');
    sections.push('Used for data access abstraction, allowing easy swapping of data sources.');
    sections.push('');
    sections.push('### Dependency Injection');
    sections.push('Used throughout the application for loose coupling and testability.');
    sections.push('');
    sections.push('### Observer Pattern');
    sections.push('Used for event-driven communication between components.');
    sections.push('');

    sections.push('## Data Flow');
    sections.push('');
    sections.push('```');
    sections.push('Client Request');
    sections.push('     ↓');
    sections.push('API Gateway');
    sections.push('     ↓');
    sections.push('Controller');
    sections.push('     ↓');
    sections.push('Service Layer');
    sections.push('     ↓');
    sections.push('Data Layer');
    sections.push('     ↓');
    sections.push('Database');
    sections.push('```');
    sections.push('');

    sections.push('## Security Considerations');
    sections.push('');
    sections.push('- Input validation at API boundaries');
    sections.push('- Authentication and authorization middleware');
    sections.push('- Rate limiting and DDoS protection');
    sections.push('- Secure configuration management');
    sections.push('- Regular security audits');
    sections.push('');

    sections.push('## Performance Optimization');
    sections.push('');
    sections.push('- Caching strategies at multiple levels');
    sections.push('- Database query optimization');
    sections.push('- Lazy loading and code splitting');
    sections.push('- Horizontal scaling support');
    sections.push('- Monitoring and performance metrics');

    return sections.join('\n');
  }

  private async generateLicense(config: DocumentationConfig): Promise<string> {
    const licenseType = config.license || this.projectInfo?.license || 'MIT';
    const year = new Date().getFullYear();
    const author = config.author || this.projectInfo?.author || 'Your Name';
    const authorName = typeof author === 'string' ? author : author.name;

    const licenses: Record<string, string> = {
      MIT: `MIT License

Copyright (c) ${year} ${authorName}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,

      'Apache-2.0': `Copyright ${year} ${authorName}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,

      'GPL-3.0': `Copyright (C) ${year} ${authorName}

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.`,

      ISC: `ISC License

Copyright (c) ${year}, ${authorName}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`
    };

    return licenses[licenseType] || licenses.MIT;
  }

  private async generateApiDocumentation(projectPath: string): Promise<ApiDocumentation> {
    // This is a simplified API documentation generator
    // In a real implementation, you would use tools like TypeDoc or JSDoc
    const apiDocs: ApiDocumentation = {
      modules: [],
      classes: [],
      functions: [],
      interfaces: [],
      types: []
    };

    // Scan for TypeScript/JavaScript files
    const sourceFiles = await this.findSourceFiles(projectPath);

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const relativePath = path.relative(projectPath, file);

        // Extract module info
        const moduleName = path.basename(file, path.extname(file));
        apiDocs.modules.push({
          name: moduleName,
          path: relativePath,
          exports: this.extractExports(content),
          imports: this.extractImports(content)
        });

        // Extract other API elements (simplified)
        // In practice, you'd use a proper AST parser
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return apiDocs;
  }

  private async findSourceFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const srcDir = path.join(projectPath, 'src');

    if (!await fs.pathExists(srcDir)) {
      return files;
    }

    const walk = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await walk(fullPath);
        } else if (entry.isFile() && /\.(ts|js|tsx|jsx)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
    };

    await walk(srcDir);
    return files;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return exports;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private convertFormat(
    content: string,
    from: 'markdown' | 'html' | 'pdf',
    to: 'markdown' | 'html' | 'pdf'
  ): string {
    if (from === to) {
      return content;
    }

    // Simplified conversion - in practice, you'd use proper conversion libraries
    if (from === 'markdown' && to === 'html') {
      return this.markdownToHtml(content);
    }

    // For PDF, you'd typically use a library like puppeteer or wkhtmltopdf
    return content;
  }

  private markdownToHtml(markdown: string): string {
    // Very basic markdown to HTML conversion
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    // Clean up
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6]>)/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 40px; }
    code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '')
      .replace(/^./, (match) => match.toLowerCase());
  }

  private toPascalCase(str: string): string {
    return str.replace(/[-_\s]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '')
      .replace(/^./, (match) => match.toUpperCase());
  }

  async writeDocuments(documents: GeneratedDocument[]): Promise<{ written: string[]; errors: string[] }> {
    const written: string[] = [];
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        const dir = path.dirname(doc.path);
        await fs.ensureDir(dir);
        await fs.writeFile(doc.path, doc.content);
        written.push(doc.path);
        this.emit('document:written', doc);
      } catch (error: any) {
        errors.push(`Failed to write ${doc.path}: ${error.message}`);
        this.emit('document:error', { document: doc, error });
      }
    }

    return { written, errors };
  }
}

// Helper functions
export async function generateDocumentation(
  projectPath: string,
  options: Partial<DocumentationConfig> = {}
): Promise<DocumentationResult> {
  const generator = new DocumentationGenerator();
  
  const config: DocumentationConfig = {
    projectName: path.basename(projectPath),
    projectPath,
    ...options
  };

  return generator.generate(config);
}

export async function generateAndWriteDocumentation(
  projectPath: string,
  options: Partial<DocumentationConfig> = {}
): Promise<{ result: DocumentationResult; written: string[]; errors: string[] }> {
  const generator = new DocumentationGenerator();
  const result = await generateDocumentation(projectPath, options);
  
  if (result.success) {
    const writeResult = await generator.writeDocuments(result.documents);
    return { result, ...writeResult };
  }

  return { result, written: [], errors: result.errors || [] };
}