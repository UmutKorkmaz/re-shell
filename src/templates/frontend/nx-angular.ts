import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class NxAngularTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { normalizedName, name } = this.context;

    // Root Package.json for Nx workspace
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generateRootPackageJson(), null, 2)
    });

    // Nx configuration
    files.push({
      path: 'nx.json',
      content: this.generateNxJson()
    });

    // Angular CLI configuration with Nx
    files.push({
      path: 'angular.json',
      content: this.generateAngularJson()
    });

    // TypeScript configs
    files.push({
      path: 'tsconfig.base.json',
      content: this.generateTsConfigBase()
    });

    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Workspace configuration
    files.push({
      path: 'workspace.json',
      content: this.generateWorkspaceJson()
    });

    // Prettier config
    files.push({
      path: '.prettierrc',
      content: this.generatePrettierConfig()
    });

    files.push({
      path: '.prettierignore',
      content: this.generatePrettierIgnore()
    });

    // ESLint config
    files.push({
      path: '.eslintrc.json',
      content: this.generateEslintConfig()
    });

    files.push({
      path: '.eslintignore',
      content: this.generateEslintIgnore()
    });

    // Git ignore
    files.push({
      path: '.gitignore',
      content: this.generateGitIgnore()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Dockerfile for production deployment
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Docker Compose for local development
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // Docker Compose for development
    files.push({
      path: 'docker-compose.dev.yml',
      content: this.generateDockerComposeDev()
    });

    // Nginx configuration for production
    files.push({
      path: 'nginx.conf',
      content: this.generateNginxConfig()
    });

    // Environment configuration
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    files.push({
      path: 'apps/app1/src/environments/environment.ts',
      content: this.generateEnvironment()
    });

    files.push({
      path: 'apps/app1/src/environments/environment.prod.ts',
      content: this.generateEnvironmentProd()
    });

    // Application files
    files.push({
      path: 'apps/app1/project.json',
      content: this.generateApp1ProjectJson()
    });

    files.push({
      path: 'apps/app1/src/index.html',
      content: this.generateApp1IndexHtml()
    });

    files.push({
      path: 'apps/app1/src/main.ts',
      content: this.generateApp1Main()
    });

    files.push({
      path: 'apps/app1/src/app/app.config.ts',
      content: this.generateApp1Config()
    });

    files.push({
      path: 'apps/app1/src/app/app.component.ts',
      content: this.generateApp1Component()
    });

    files.push({
      path: 'apps/app1/src/app/app.component.html',
      content: this.generateApp1ComponentHtml()
    });

    files.push({
      path: 'apps/app1/src/app/app.component.scss',
      content: this.generateApp1ComponentStyles()
    });

    files.push({
      path: 'apps/app1/src/styles.scss',
      content: this.generateApp1Styles()
    });

    // Library files
    files.push({
      path: 'libs/ui-lib/project.json',
      content: this.generateLibProjectJson()
    });

    files.push({
      path: 'libs/ui-lib/src/lib/ui-lib.component.ts',
      content: this.generateLibComponent()
    });

    files.push({
      path: 'libs/ui-lib/src/lib/ui-lib.component.html',
      content: this.generateLibComponentHtml()
    });

    files.push({
      path: 'libs/ui-lib/src/lib/ui-lib.component.scss',
      content: this.generateLibComponentStyles()
    });

    files.push({
      path: 'libs/ui-lib/src/index.ts',
      content: this.generateLibIndex()
    });

    return files;
  }

  private generateRootPackageJson() {
    const { normalizedName } = this.context;
    return {
      name: normalizedName,
      version: '0.0.0',
      scripts: {
        'nx': 'nx',
        'start': 'nx serve',
        'build': 'nx run-many --target=build --all',
        'test': 'nx run-many --target=test --all',
        'lint': 'nx workspace-lint && nx run-many --target=lint --all',
        'e2e': 'nx run-many --target=e2e --all',
        'affected': 'nx affected --graph',
        'affected:build': 'nx affected --target=build',
        'affected:test': 'nx affected --target=test',
        'format': 'nx format:write',
        'format:check': 'nx format:check',
        'workspace-generator': 'nx workspace-generator'
      },
      private: true,
      dependencies: {
        '@angular/animations': '^17.0.0',
        '@angular/common': '^17.0.0',
        '@angular/compiler': '^17.0.0',
        '@angular/core': '^17.0.0',
        '@angular/forms': '^17.0.0',
        '@angular/platform-browser': '^17.0.0',
        '@angular/platform-browser-dynamic': '^17.0.0',
        '@angular/router': '^17.0.0',
        'rxjs': '^7.8.0',
        'tslib': '^2.6.0',
        'zone.js': '^0.14.0'
      },
      devDependencies: {
        '@angular-devkit/build-angular': '^17.0.0',
        '@angular-devkit/build-webpack': '^17.0.0',
        '@angular-eslint/eslint-plugin': '^17.0.0',
        '@angular-eslint/eslint-plugin-template': '^17.0.0',
        '@angular-eslint/template-parser': '^17.0.0',
        '@angular/cli': '^17.0.0',
        '@angular/compiler-cli': '^17.0.0',
        '@angular/language-service': '^17.0.0',
        '@nx/angular': '^17.0.0',
        '@nx/cypress': '^17.0.0',
        '@nx/eslint-plugin': '^17.0.0',
        '@nx/jest': '^17.0.0',
        '@nx/workspace': '^17.0.0',
        '@types/jest': '^29.5.0',
        '@types/node': '^20.10.0',
        '@typescript-eslint/eslint-plugin': '^6.13.0',
        '@typescript-eslint/parser': '^6.13.0',
        'cypress': '^13.6.0',
        'eslint': '^8.55.0',
        'eslint-config-prettier': '^9.1.0',
        'jest': '^29.7.0',
        'jest-environment-jsdom': '^29.7.0',
        'jest-preset-angular': '^13.1.0',
        'nx': '^17.0.0',
        'prettier': '^3.2.0',
        'ts-jest': '^29.1.0',
        'typescript': '^5.3.0'
      }
    };
  }

  private generateNxJson() {
    return JSON.stringify({
      '$schema': './node_modules/nx/schemas/nx-schema.json',
      'namedInputs': {
        'default': ['{projectRoot}/**/*', 'sharedGlobals'],
        'production': [
          'default',
          '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
          '!{projectRoot}/tsconfig.spec.json',
          '!{projectRoot}/jest.config.[jt]s',
          '!{projectRoot}/src/test-setup.[jt]s',
          '!{projectRoot}/test-setup.[jt]s'
        ],
        'sharedGlobals': []
      },
      'targetDefaults': {
        'build': {
          'cache': true,
          'dependsOn': ['^build'],
          'inputs': ['production', '^production']
        },
        'test': {
          'cache': true,
          'inputs': ['default', '^production', '{workspaceRoot}/jest.preset.js']
        },
        'lint': {
          'cache': true,
          'inputs': [
            'default',
            '{workspaceRoot}/.eslintrc.json',
            '{workspaceRoot}/.eslintignore'
          ]
        }
      },
      'generators': {
        '@nx/angular:application': {
          'style': 'scss',
          'linter': 'eslint',
          'standalone': true,
          'changeDetection': 'OnPush',
          'routing': true
        },
        '@nx/angular:library': {
          'linter': 'eslint',
          'style': 'scss',
          'standalone': true,
          'changeDetection': 'OnPush'
        },
        '@nx/angular:component': {
          'style': 'scss',
          'standalone': true,
          'changeDetection': 'OnPush'
        }
      }
    }, null, 2);
  }

  private generateAngularJson() {
    return JSON.stringify({
      '$schema': './node_modules/@angular/cli/lib/config/schema.json',
      'version': 2,
      'newProjectRoot': '',
      'projects': {}
    }, null, 2);
  }

  protected generateTsConfigBase() {
    return JSON.stringify({
      'compileOnSave': false,
      'compilerOptions': {
        'rootDir': '.',
        'sourceMap': true,
        'declaration': false,
        'moduleResolution': 'node',
        'emitDecoratorMetadata': true,
        'experimentalDecorators': true,
        'importHelpers': true,
        'target': 'ES2022',
        'module': 'ES2022',
        'lib': ['ES2022', 'dom'],
        'skipLibCheck': true,
        'skipDefaultLibCheck': true,
        'baseUrl': '.',
        'paths': {
          '@${this.context.normalizedName}/ui-lib': ['libs/ui-lib/src/index.ts']
        }
      },
      'exclude': ['node_modules', 'tmp']
    }, null, 2);
  }

  protected generateTsConfig() {
    return JSON.stringify({
      'extends': './tsconfig.base.json',
      'files': [],
      'include': [],
      'references': [
        {
          'path': './apps/app1/tsconfig.app.json'
        },
        {
          'path': './apps/app1/tsconfig.spec.json'
        },
        {
          'path': './libs/ui-lib/tsconfig.lib.json'
        }
      ]
    }, null, 2);
  }

  private generateWorkspaceJson() {
    const { normalizedName } = this.context;
    return JSON.stringify({
      'version': 2,
      'projects': {
        'app1': {
          'root': 'apps/app1',
          'sourceRoot': 'apps/app1/src',
          'projectType': 'application',
          'prefix': 'app',
          'schematics': {},
          'architect': {}
        },
        'ui-lib': {
          'root': 'libs/ui-lib',
          'sourceRoot': 'libs/ui-lib/src',
          'projectType': 'library',
          'prefix': 'lib',
          'schematics': {},
          'architect': {}
        }
      }
    }, null, 2);
  }

  private generatePrettierConfig() {
    return JSON.stringify({
      'singleQuote': true,
      'semi': true,
      'trailingComma': 'es5',
      'tabWidth': 2,
      'printWidth': 100
    }, null, 2);
  }

  private generatePrettierIgnore() {
    return `# Nx ignore
.nx/cache

# Build outputs
dist
tmp
out-tsc

# Node modules
node_modules

# Logs
*.log
`;
  }

  protected generateEslintConfig() {
    return JSON.stringify({
      'root': true,
      'ignorePatterns': ['**/*'],
      'plugins': ['@nx/eslint-plugin'],
      'overrides': [
        {
          'files': ['*.ts', '*.tsx', '*.js', '*.jsx'],
          'rules': {
            '@nx/enforce-module-boundaries': [
              'error',
              {
                'enforceBuildableLibDependency': true,
                'allow': [],
                'depConstraints': [
                  { 'sourceTag': '*', 'onlyDependOnLibsWithTags': ['*'] }
                ]
              }
            ]
          }
        },
        {
          'files': ['*.ts', '*.tsx'],
          'extends': ['plugin:@nx/angular', 'plugin:@angular-eslint/recommended'],
          'rules': {}
        },
        {
          'files': ['*.js', '*.jsx'],
          'extends': ['plugin:@nx/javascript'],
          'rules': {}
        },
        {
          'files': ['*.html'],
          'extends': ['plugin:@nx/angular-template'],
          'rules': {}
        }
      ]
    }, null, 2);
  }

  private generateEslintIgnore() {
    return `# Nx
.nx/cache

# Build outputs
dist
tmp

# Node modules
node_modules
`;
  }

  private generateGitIgnore() {
    return `# Nx
.nx/cache

# Build outputs
dist
tmp
out-tsc

# Node modules
node_modules

# Logs
*.log

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store

# Testing
coverage
.nyc_output
`;
  }

  protected generateReadme() {
    const { name, description } = this.context;
    return `# ${name}

${description || 'Nx Angular Monorepo Workspace'}

## Overview

This is an Nx workspace with Angular applications and libraries. Nx provides advanced monorepo features including:

- ⚡ **Affected Builds**: Only build what changed
- 🔄 **Distributed Task Execution**: Run tasks in parallel
- 📦 **Smart Caching**: Never rebuild the same thing twice
- 🧩 **Monorepo Support**: Multiple apps and shared libraries
- 🎯 **Code Generation**: Schematics for consistent code

## Workspace Structure

\`\`\`
${name}/
├── apps/
│   └── app1/              # Main Angular application
│       ├── src/
│       ├── project.json   # Nx project configuration
│       └── tsconfig.*.json
├── libs/
│   └── ui-lib/            # Shared UI library
│       ├── src/
│       │   └── lib/
│       ├── project.json
│       └── tsconfig.lib.json
├── nx.json                # Nx configuration
├── angular.json           # Angular CLI configuration
└── package.json           # Root package.json
\`\`\`

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm start

# Build all applications
npm run build

# Run all tests
npm run test

# Run affected commands (only for changed projects)
npm run affected:build
npm run affected:test
\`\`\`

## Nx Commands

\`\`\`bash
# Show affected projects
nx affected:graph

# Run specific project
nx serve app1

# Build specific project
nx build app1

# Test specific project
nx test app1

# Generate new library
nx g @nx/angular:library my-lib

# Generate new component
nx g @nx/angular:component my-component --project=ui-lib

# Run affected build
nx affected --target=build

# Visualize dependency graph
nx graph
\`\`\`

## Monorepo Features

### Affected Commands

Nx analyzes your dependency graph and only runs commands on projects affected by recent changes:

\`\`\`bash
# Build only what changed
nx affected --target=build

# Test only what changed
nx affected --target=test

# Lint only what changed
nx affected --target=lint
\`\`\`

### Code Sharing

Libraries in \`libs/\` can be imported into applications:

\`\`\`typescript
import { UiLibComponent } from '@${this.context.normalizedName}/ui-lib';
\`\`\`

### Path Mapping

Paths are automatically configured in \`tsconfig.base.json\`:

\`\`\`json
{
  "paths": {
    "@${this.context.normalizedName}/ui-lib": ["libs/ui-lib/src/index.ts"]
  }
}
\`\`\`

## Project Configuration

Each project has a \`project.json\` with targets:

\`\`\`json
{
  "name": "app1",
  "targets": {
    "build": { ... },
    "serve": { ... },
    "test": { ... },
    "lint": { ... }
  }
}
\`\`\`

## Visualizing Dependencies

\`\`\`bash
# Show dependency graph
nx graph

# Show affected projects
nx affected:graph
\`\`\`

## Adding More Apps or Libs

\`\`\`bash
# Create new app
nx g @nx/angular:application my-app

# Create new library
nx g @nx/angular:library my-lib
\`\`\`

## Resources

- [Nx Documentation](https://nx.dev)
- [Angular with Nx](https://nx.dev/getting-started/nx-and-angular)
- [Nx Workspace](https://nx.dev/features/workspace)

## License

MIT
`;
  }

  private generateApp1ProjectJson() {
    return JSON.stringify({
      'name': 'app1',
      '$schema': '../../node_modules/nx/schemas/project-schema.json',
      'sourceRoot': 'apps/app1/src',
      'projectType': 'application',
      'prefix': 'app',
      'targets': {
        'build': {
          'executor': '@angular-devkit/build-angular:browser',
          'outputs': ['{options.outputPath}'],
          'options': {
            'outputPath': 'dist/apps/app1',
            'index': 'apps/app1/src/index.html',
            'main': 'apps/app1/src/main.ts',
            'polyfills': ['zone.js'],
            'tsConfig': 'apps/app1/tsconfig.app.json',
            'inlineStyleLanguage': 'scss',
            'assets': ['apps/app1/src/favicon.ico', 'apps/app1/src/assets'],
            'styles': ['apps/app1/src/styles.scss'],
            'scripts': []
          },
          'configurations': {
            'production': {
              'budgets': [
                { 'type': 'initial', 'maximumWarning': '500kb', 'maximumError': '1mb' },
                { 'type': 'anyComponentStyle', 'maximumWarning': '2kb', 'maximumError': '4kb' }
              ],
              'outputHashing': 'all'
            },
            'development': {
              'buildOptimizer': false,
              'optimization': false,
              'vendorChunk': true,
              'extractLicenses': false,
              'sourceMap': true,
              'namedChunks': true
            }
          },
          'defaultConfiguration': 'production'
        },
        'serve': {
          'executor': '@angular-devkit/build-angular:dev-server',
          'configurations': {
            'production': {
              'buildTarget': 'app1:build:production'
            },
            'development': {
              'buildTarget': 'app1:build:development'
            }
          },
          'defaultConfiguration': 'development'
        },
        'extract-i18n': {
          'executor': '@angular-devkit/build-angular:extract-i18n',
          'options': {
            'buildTarget': 'app1:build'
          }
        },
        'lint': {
          'executor': '@nx/eslint:lint',
          'outputs': ['{options.outputFile}'],
          'options': {
            'lintFilePatterns': ['apps/app1/**/*.ts', 'apps/app1/**/*.html']
          }
        },
        'test': {
          'executor': '@nx/jest:jest',
          'outputs': ['{workspaceRoot}/coverage/{projectName}'],
          'options': {
            'jestConfig': 'apps/app1/jest.config.ts',
            'passWithNoTests': true
          }
        }
      }
    }, null, 2);
  }

  private generateApp1IndexHtml() {
    const { name } = this.context;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${name}</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <app-root></app-root>
</body>
</html>
`;
  }

  private generateApp1Main() {
    return `import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
`;
  }

  private generateApp1Config() {
    return `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter([])]
};
`;
  }

  private generateApp1Component() {
    return `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = '${this.context.name}';
}
`;
  }

  private generateApp1ComponentHtml() {
    const { name } = this.context;
    return `<div class="app">
  <header class="header">
    <h1>🚀 ${name}</h1>
    <p>Nx Angular Monorepo Workspace</p>
  </header>

  <main class="main">
    <section class="features">
      <div class="feature-card">
        <h2>⚡ Affected Builds</h2>
        <p>Only build what changed with Nx affected commands</p>
      </div>
      <div class="feature-card">
        <h2>📦 Shared Libraries</h2>
        <p>Reusable UI components across multiple applications</p>
      </div>
      <div class="feature-card">
        <h2>🔄 Smart Caching</h2>
        <p>Never rebuild the same thing twice</p>
      </div>
    </section>

    <section class="info-section">
      <h2>📝 Nx Workspace</h2>
      <p>This is an Nx monorepo with multiple apps and libs:</p>
      <ul>
        <li><strong>apps/app1</strong> - Main Angular application</li>
        <li><strong>libs/ui-lib</strong> - Shared UI library</li>
      </ul>
    </section>

    <section class="commands-section">
      <h2>🔧 Useful Commands</h2>
      <div class="command-card">
        <code>nx serve app1</code>
        <p>Start development server</p>
      </div>
      <div class="command-card">
        <code>nx build app1</code>
        <p>Build application</p>
      </div>
      <div class="command-card">
        <code>nx affected --target=build</code>
        <p>Build affected projects only</p>
      </div>
      <div class="command-card">
        <code>nx graph</code>
        <p>Visualize dependency graph</p>
      </div>
    </section>
  </main>

  <footer class="footer">
    <p>Built with Angular 17 and Nx</p>
  </footer>
</div>

<router-outlet></router-outlet>
`;
  }

  private generateApp1ComponentStyles() {
    return `.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #dd0031 0%, #c3002f 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.header h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card {
  padding: 2rem;
  background: #f5f5f5;
  border-radius: 8px;
  text-align: center;
  transition: transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
}

.info-section,
.commands-section {
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.command-card {
  margin: 1rem 0;
  padding: 1rem;
  background: white;
  border-radius: 4px;
}

.command-card code {
  display: block;
  background: #e0e0e0;
  padding: 0.5rem;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  margin-bottom: 0.5rem;
}

.footer {
  background: #1976d2;
  color: white;
  padding: 1.5rem;
  text-align: center;
}
`;
  }

  private generateApp1Styles() {
    return `/* Global Styles */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`;
  }

  private generateLibProjectJson() {
    return JSON.stringify({
      'name': 'ui-lib',
      '$schema': '../../node_modules/nx/schemas/project-schema.json',
      'sourceRoot': 'libs/ui-lib/src',
      'projectType': 'library',
      'prefix': 'lib',
      'targets': {
        'build': {
          'executor': '@nx/angular:package',
          'outputs': ['{workspaceRoot}/dist/{projectName}'],
          'options': {
            'project': 'libs/ui-lib/ng-package.json'
          }
        },
        'lint': {
          'executor': '@nx/eslint:lint',
          'outputs': ['{options.outputFile}'],
          'options': {
            'lintFilePatterns': ['libs/ui-lib/**/*.ts', 'libs/ui-lib/**/*.html']
          }
        },
        'test': {
          'executor': '@nx/jest:jest',
          'outputs': ['{workspaceRoot}/coverage/{projectName}'],
          'options': {
            'jestConfig': 'libs/ui-lib/jest.config.ts',
            'passWithNoTests': true
          }
        }
      }
    }, null, 2);
  }

  private generateLibComponent() {
    return `import { Component } from '@angular/core';

@Component({
  selector: 'lib-ui-lib',
  standalone: true,
  templateUrl: './ui-lib.component.html',
  styleUrls: ['./ui-lib.component.scss']
})
export class UiLibComponent {
  message = 'UI Library Component';
}
`;
  }

  private generateLibComponentHtml() {
    return `<div class="ui-lib">
  <h3>📦 {{ message }}</h3>
  <p>This is a shared component from the UI library</p>
</div>
`;
  }

  private generateLibComponentStyles() {
    return `.ui-lib {
  padding: 1rem;
  background: #f0f0f0;
  border-radius: 4px;
  border-left: 4px solid #dd0031;
}

.ui-lib h3 {
  margin-top: 0;
  color: #dd0031;
}
`;
  }

  private generateLibIndex() {
    return `export * from './lib/ui-lib.component';
`;
  }

  private generateDockerfile() {
    return `# Multi-stage Dockerfile for Nx Angular workspace

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build affected projects or all projects
RUN npx nx run-many -t=build --all --parallel=1

# Stage 3: Production server
FROM nginx:alpine AS production

# Copy built app from build stage
COPY --from=build /app/dist/apps/app1 /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    restart: unless-stopped
`;
  }

  private generateDockerComposeDev() {
    return `version: '3.8'

services:
  app:
    image: node:20-alpine
    working_dir: /app
    ports:
      - "4200:4200"
    volumes:
      - .:/app
      - /app/node_modules
    command: npx nx serve app1
    environment:
      - NODE_ENV=development
`;
  }

  private generateNginxConfig() {
    return `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;

    # SPA fallback - all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
}
`;
  }

  private generateEnvExample() {
    return `# Environment Configuration for Nx Angular

# API Configuration
API_URL=http://localhost:3000/api
API_KEY=your-api-key-here

# Feature Flags
FEATURE_DARK_MODE=true
FEATURE_ANALYTICS=false

# Analytics
GA_TRACKING_ID=

# Application Title
APP_TITLE=${this.context.name || 'Nx Angular App'}
`;
  }

  private generateEnvironment() {
    return `export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  apiKey: 'dev-key',
  featureFlags: {
    darkMode: true,
    analytics: false,
  },
  gaTrackingId: '',
  appTitle: '${this.context.name || 'Nx Angular App'}',
};
`;
  }

  private generateEnvironmentProd() {
    return `export const environment = {
  production: true,
  apiUrl: process.env['API_URL'] || 'https://api.example.com',
  apiKey: process.env['API_KEY'] || '',
  featureFlags: {
    darkMode: true,
    analytics: true,
  },
  gaTrackingId: process.env['GA_TRACKING_ID'] || '',
  appTitle: process.env['APP_TITLE'] || '${this.context.name || 'Nx Angular App'}',
};
`;
  }
}
