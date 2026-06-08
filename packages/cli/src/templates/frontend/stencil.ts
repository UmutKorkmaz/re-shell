import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class StencilTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Stencil config
    files.push({
      path: 'stencil.config.ts',
      content: this.generateStencilConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Index HTML
    files.push({
      path: 'src/index.html',
      content: this.generateIndexHtml()
    });

    // Global styles
    files.push({
      path: 'src/global.css',
      content: this.generateGlobalCss()
    });

    // Components
    files.push({
      path: 'src/components/app-root/app-root.tsx',
      content: this.generateAppRoot()
    });

    files.push({
      path: 'src/components/app-root/app-root.css',
      content: this.generateAppRootCss()
    });

    files.push({
      path: 'src/components/my-component/my-component.tsx',
      content: this.generateMyComponent()
    });

    files.push({
      path: 'src/components/my-component/my-component.css',
      content: this.generateMyComponentCss()
    });

    files.push({
      path: 'src/components/counter-component/counter-component.tsx',
      content: this.generateCounterComponent()
    });

    files.push({
      path: 'src/components/counter-component/counter-component.css',
      content: this.generateCounterComponentCss()
    });

    files.push({
      path: 'src/components/card-component/card-component.tsx',
      content: this.generateCardComponent()
    });

    files.push({
      path: 'src/components/card-component/card-component.css',
      content: this.generateCardComponentCss()
    });

    // Utils
    files.push({
      path: 'src/utils/utils.ts',
      content: this.generateUtils()
    });

    // Test files
    files.push({
      path: 'src/components/my-component/my-component.spec.ts',
      content: this.generateMyComponentSpec()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Dockerfile
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Docker Compose
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // .gitignore
    files.push({
      path: '.gitignore',
      content: this.generateGitignore()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.0.1',
      description: `${this.context.name} - Stencil Web Components`,
      main: 'dist/index.cjs.js',
      module: 'dist/index.js',
      es2015: 'dist/esm/index.mjs',
      es2017: 'dist/esm/index.mjs',
      types: 'dist/types/components.d.ts',
      collection: 'dist/collection/collection-manifest.json',
      files: [
        'dist/',
        'loader/'
      ],
      scripts: {
        build: 'stencil build',
        start: 'stencil build --dev --watch --serve',
        test: 'stencil test --spec --e2e',
        'test.watch': 'stencil test --spec --e2e --watchAll',
        generate: 'stencil generate'
      },
      dependencies: {
        '@stencil/core': '^4.12.0'
      },
      devDependencies: {
        '@stencil/angular-output-target': '^0.8.0',
        '@stencil/react-output-target': '^0.5.0',
        '@stencil/svelte-output-target': '^0.6.0',
        '@stencil/vue-output-target': '^0.8.0',
        '@stencil/web-components-output-target': '^0.4.0',
        '@types/jest': '^29.5.11',
        '@types/node': '^20.11.0',
        'jest': '^29.7.0',
        'jest-cli': '^29.7.0',
        'puppeteer': '^22.0.0',
        'typescript': '^5.3.3'
      }
    };
  }

  private generateStencilConfig() {
    return `import { Config } from '@stencil/core';
import { angularOutputTarget, ValueAccessorConfig } from '@stencil/angular-output-target';
import { reactOutputTarget } from '@stencil/react-output-target';
import { vueOutputTarget } from '@stencil/vue-output-target';
import { svelteOutputTarget } from '@stencil/svelte-output-target';
import { defineCustomElements as defineCustomElementsHTMLElement } from '@stencil/web-components-output-target';

export const config: Config = {
  namespace: '${this.context.normalizedName}',
  taskQueue: 'async',
  outputTargets: [
    {
      type: 'dist',
      esmLoaderPath: '../loader',
    },
    {
      type: 'docs-readme',
    },
    {
      type: 'www',
      serviceWorker: false, // disable service workers
    },
    {
      type: 'dist-custom-elements',
      customElementsExportBehavior: 'auto-define-custom-elements',
      externalRuntime: false,
    },
    {
      type: 'angular',
      componentCorePackage: '${this.context.normalizedName}',
      directivesProxyFile: '{{TMP}}/angular/components.ts',
      directivesArrayFile: '{{TMP}}/angular/index.ts',
      valueAccessorConfigs: [
        {
          elementSelectors: ['${this.context.normalizedName}-my-component'],
          event: ['${this.context.normalizedName}Change'],
          targetAttr: 'value',
          type: 'text',
        } as ValueAccessorConfig,
      ],
    },
    reactOutputTarget({
      componentCorePackage: '${this.context.normalizedName}',
      proxiesFile: '{{TMP}}/react/components.ts',
      includeDefineCustomElements: true,
    }),
    vueOutputTarget({
      componentCorePackage: '${this.context.normalizedName}',
      proxiesFile: '{{TMP}}/vue/components.ts',
    }),
    svelteOutputTarget({
      componentCorePackage: '${this.context.normalizedName}',
      proxiesFile: '{{TMP}}/svelte/components.ts',
    }),
  ],
  testing: {
    browserHeadless: 'new',
  },
};
`;
  }

  protected generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        allowSyntheticDefaultImports: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        lib: ['DOM', 'ES2021'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        target: 'ES2021',
        skipLibCheck: true,
        strict: true,
        resolveJsonModule: true,
        esModuleInterop: true,
        types: ['node', 'jest']
      },
      include: ['src'],
      exclude: ['node_modules']
    }, null, 2);
  }

  private generateIndexHtml() {
    return `<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=5.0" />
  <title>${this.context.name}</title>
  <script type="module" src="/build/${this.context.normalizedName}.esm.js"></script>
  <script nomodule src="/build/${this.context.normalizedName}.js"></script>
  <link rel="stylesheet" href="/build/${this.context.normalizedName}.css">
</head>
<body>
  <app-root></app-root>
</body>
</html>
`;
  }

  private generateGlobalCss() {
    return `/**
 * Global Styles
 */

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  padding: 0;
}

a {
  color: #667eea;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
`;
  }

  private generateAppRoot() {
    return `import { Component, Host, h } from '@stencil/core';

@Component({
  tag: 'app-root',
  styleUrl: 'app-root.css',
  shadow: true,
})
export class AppRoot {
  render() {
    return (
      <Host>
        <div class="container">
          <header>
            <h1>${this.context.name}</h1>
            <p>Built with Stencil Web Components</p>
          </header>

          <main>
            <section class="features">
              <card-component
                title="Web Components"
                description="Build framework-agnostic components that work everywhere"
                icon="🌐"
              ></card-component>

              <card-component
                title="TypeScript"
                description="Full TypeScript support with type safety"
                icon="📘"
              ></card-component>

              <card-component
                title="Framework Agnostic"
                description="Use in React, Angular, Vue, Svelte, or vanilla JS"
                icon="⚡"
              ></card-component>
            </section>

            <section class="demo">
              <h2>Interactive Demo</h2>
              <counter-component
                initial-value={0}
                min-value={0}
                max-value={100}
              ></counter-component>
            </section>

            <section class="demo">
              <h2>Component Usage</h2>
              <my-component
                first="Stencil"
                last="'Don't call me a framework' JS"
              ></my-component>
            </section>
          </main>

          <footer>
            <p>&copy; {new Date().getFullYear()} ${this.context.name}. Built with Stencil.</p>
          </footer>
        </div>
      </Host>
    );
  }
}
`;
  }

  private generateAppRootCss() {
    return `:host {
  display: block;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  text-align: center;
  margin-bottom: 3rem;
  color: white;
}

header h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
}

header p {
  font-size: 1.2rem;
  opacity: 0.9;
}

main {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.demo {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.demo h2 {
  margin-bottom: 1.5rem;
  color: #667eea;
}

footer {
  text-align: center;
  margin-top: 3rem;
  color: white;
  opacity: 0.9;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  header h1 {
    font-size: 2rem;
  }

  .features {
    grid-template-columns: 1fr;
  }
}
`;
  }

  private generateMyComponent() {
    return `import { Component, Host, h, Prop, Event, EventEmitter, State } from '@stencil/core';

@Component({
  tag: 'my-component',
  styleUrl: 'my-component.css',
  shadow: true,
})
export class MyComponent {
  /**
   * The first name
   */
  @Prop() first: string;

  /**
   * The last name
   */
  @Prop() last: string;

  /**
   * The middle name
   */
  @Prop() middle: string;

  @State() private isVisible: boolean = true;

  /**
   * Emitted when the component is clicked
   */
  @Event() componentClick: EventEmitter<string>;

  private getText(): string {
    return \`\${this.first} \${this.middle} \${this.last}\`;
  }

  private handleClick() {
    this.isVisible = !this.isVisible;
    this.componentClick.emit(this.getText());
  }

  render() {
    return (
      <Host onClick={() => this.handleClick()}>
        <div class="my-component">
          <p>Hello, World! I'm {this.getText()}</p>
          <p class="hint">Click me to toggle visibility!</p>
          {this.isVisible && (
            <div class="content">
              <p>This is a Stencil web component</p>
              <p>It works in any framework!</p>
            </div>
          )}
        </div>
      </Host>
    );
  }
}
`;
  }

  private generateMyComponentCss() {
    return `:host {
  display: block;
  cursor: pointer;
}

.my-component {
  padding: 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.my-component:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.my-component p {
  margin: 0.5rem 0;
  font-size: 1rem;
}

.hint {
  font-size: 0.875rem;
  opacity: 0.8;
  font-style: italic;
}

.content {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.content p {
  opacity: 0.95;
}
`;
  }

  private generateCounterComponent() {
    return `import { Component, Host, h, Prop, Event, EventEmitter, State, Watch } from '@stencil/core';

@Component({
  tag: 'counter-component',
  styleUrl: 'counter-component.css',
  shadow: true,
})
export class CounterComponent {
  /**
   * Initial counter value
   */
  @Prop() initialValue: number = 0;

  /**
   * Minimum value
   */
  @Prop() minValue: number = 0;

  /**
   * Maximum value
   */
  @Prop() maxValue: number = 100;

  @State() count: number = 0;

  /**
   * Emitted when count changes
   */
  @Event() countChange: EventEmitter<number>;

  componentWillLoad() {
    this.count = this.initialValue;
  }

  @Watch('initialValue')
  initialValueChanged(newValue: number) {
    this.count = newValue;
  }

  private increment = () => {
    if (this.count < this.maxValue) {
      this.count++;
      this.countChange.emit(this.count);
    }
  };

  private decrement = () => {
    if (this.count > this.minValue) {
      this.count--;
      this.countChange.emit(this.count);
    }
  };

  private reset = () => {
    this.count = this.initialValue;
    this.countChange.emit(this.count);
  };

  render() {
    return (
      <Host>
        <div class="counter">
          <div class="counter-display">
            <span class="count">{this.count}</span>
          </div>

          <div class="counter-controls">
            <button
              onClick={this.decrement}
              disabled={this.count <= this.minValue}
              aria-label="Decrement"
            >
              −
            </button>
            <button
              onClick={this.reset}
              aria-label="Reset"
              class="reset"
            >
              ↺
            </button>
            <button
              onClick={this.increment}
              disabled={this.count >= this.maxValue}
              aria-label="Increment"
            >
              +
            </button>
          </div>

          <div class="counter-info">
            <span>Min: {this.minValue}</span>
            <span>Max: {this.maxValue}</span>
          </div>
        </div>
      </Host>
    );
  }
}
`;
  }

  private generateCounterComponentCss() {
    return `:host {
  display: block;
}

.counter {
  text-align: center;
  padding: 1.5rem;
}

.counter-display {
  margin-bottom: 1.5rem;
}

.count {
  font-size: 4rem;
  font-weight: bold;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.counter-controls {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: center;
}

.counter-controls button {
  width: 50px;
  height: 50px;
  font-size: 1.5rem;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.counter-controls button:hover:not(:disabled) {
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.4);
}

.counter-controls button:active:not(:disabled) {
  transform: scale(0.95);
}

.counter-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.counter-controls button.reset {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.counter-info {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
  color: #666;
  font-size: 0.875rem;
}
`;
  }

  private generateCardComponent() {
    return `import { Component, Host, h, Prop } from '@stencil/core';

@Component({
  tag: 'card-component',
  styleUrl: 'card-component.css',
  shadow: true,
})
export class CardComponent {
  /**
   * Card title
   */
  @Prop() title: string;

  /**
   * Card description
   */
  @Prop() description: string;

  /**
   * Card icon (emoji)
   */
  @Prop() icon: string;

  render() {
    return (
      <Host>
        <div class="card">
          <div class="card-icon">{this.icon}</div>
          <h3 class="card-title">{this.title}</h3>
          <p class="card-description">{this.description}</p>
        </div>
      </Host>
    );
  }
}
`;
  }

  private generateCardComponentCss() {
    return `:host {
  display: block;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s, box-shadow 0.3s;
  height: 100%;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.15);
}

.card-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.card-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #333;
}

.card-description {
  color: #666;
  line-height: 1.6;
}
`;
  }

  private generateUtils() {
    return `/**
 * Utility functions
 */

export function formatTime(date: Date): string {
  return date.toLocaleTimeString();
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
`;
  }

  private generateMyComponentSpec() {
    return `import { newSpecPage } from '@stencil/core/testing';
import { MyComponent } from './my-component';

describe('my-component', () => {
  it('renders', async () => {
    const page = await newSpecPage({
      components: [MyComponent],
      html: \`<my-component first="Stencil" last="Don't call me a framework"></my-component>\`,
    });
    expect(page.root).toEqualHtml(\`
      <my-component first="Stencil" last="Don't call me a framework">
        <div class="my-component">
          <p>Hello, World! I'm Stencil Don't call me a framework</p>
        </div>
      </my-component>
    \`);
  });

  it('emits event on click', async () => {
    const page = await newSpecPage({
      components: [MyComponent],
      html: \`<my-component first="Stencil" last="Component"></my-component>\`,
    });

    const component = page.rootInstance as MyComponent;
    const eventSpy = jest.fn();
    component.componentClick.subscribe(eventSpy);

    (page.rootShadowRoot?.querySelector('.my-component') as HTMLElement).click();
    await page.waitForChanges();

    expect(eventSpy).toHaveBeenCalledWith("Stencil Component");
  });
});
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A Stencil web components library built with [Stencil](https://stenciljs.com/).

## Overview

Stencil is a compiler for building reusable, scalable design systems and web components that work across any framework (React, Angular, Vue, Svelte) or with no framework at all.

## Features

- 🌐 **Framework-Agnostic**: Use components in any framework or vanilla JavaScript
- 📘 **TypeScript**: Full type safety and excellent developer experience
- ⚡ **Performance**: Highly optimized with small bundle sizes
- 🎨 **Shadow DOM**: Encapsulated styling and DOM structure
- 🔧 **Tooling**: Built-in testing, documentation generation, and more

## Getting Started

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
# Start development server with hot-reload
npm start

# Build for production
npm run build

# Run tests
npm test

# Watch tests
npm run test.watch
\`\`\`

### Using Components

#### Vanilla JavaScript

\`\`\`html
<script type="module" src="/build/${this.context.normalizedName}.esm.js"></script>
<my-component first="Stencil" last="Web Components"></my-component>
\`\`\`

#### React

\`\`\`tsx
import { MyComponent } from '${this.context.normalizedName}/react';

function App() {
  return <MyComponent first="Stencil" last="React" />;
}
\`\`\`

#### Angular

\`\`\`typescript
import { Module } from '@angular/core';
import { MyApp } from './app';

@NgModule({
  declarations: [MyApp],
  imports: [MyComponent],
  bootstrap: [MyApp],
})
export class AppModule {}
\`\`\`

#### Vue

\`\`\`vue
<template>
  <my-component first="Stencil" last="Vue"></my-component>
</template>

<script>
import { MyComponent } from '${this.context.normalizedName}/vue';

export default {
  components: { MyComponent }
};
</script>
\`\`\`

## Components

### MyComponent

A simple greeting component with click interaction.

\`\`\`html
<my-component first="Stencil" last="Component"></my-component>
\`\`\`

**Props:**
- \`first\`: First name
- \`last\`: Last name
- \`middle\`: Middle name (optional)

### CounterComponent

Interactive counter with increment, decrement, and reset functionality.

\`\`\`html
<counter-component
  initial-value={0}
  min-value={0}
  max-value={100}
></counter-component>
\`\`\`

**Props:**
- \`initial-value\`: Starting value (default: 0)
- \`min-value\`: Minimum value (default: 0)
- \`max-value\`: Maximum value (default: 100)

**Events:**
- \`countChange\`: Emitted when count changes

### CardComponent

Display card component for showcasing features.

\`\`\`html
<card-component
  title="Title"
  description="Description"
  icon="🌐"
></card-component>
\`\`\`

**Props:**
- \`title\`: Card title
- \`description\`: Card description
- \`icon\`: Emoji icon

## Testing

\`\`\`bash
# Run all tests
npm test

# Run specific test file
npx stencil test --spec src/components/my-component/my-component.spec.ts

# Run e2e tests
npx stencil test --e2e
\`\`\`

## Building for Distribution

\`\`\`bash
# Build all output targets
npm run build

# Output structure:
# dist/
# ├── components.d.ts       # TypeScript declarations
# ├── collection/           # Component collection
# ├── ${this.context.normalizedName}/          # Framework-specific wrappers
# ├── ${this.context.normalizedName}.esm.js   # ESM bundle
# └── ${this.context.normalizedName}.js       # UMD bundle
\`\`\`

## Docker

Build and run with Docker:

\`\`\`bash
# Build image
docker build -t ${this.context.normalizedName} .

# Run container
docker-compose up

# Access at http://localhost:8080
\`\`\`

## License

MIT

## Links

- [Stencil Documentation](https://stenciljs.com/docs)
- [Web Components](https://www.webcomponents.org/)
- [Stencil GitHub](https://github.com/ionic-team/stencil)
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Stencil Web Components

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build Stencil components
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/www ./www
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production

# Install a simple HTTP server
RUN npm install -g http-server

EXPOSE 8080

CMD ["http-server", "./www", "-p", "8080"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
`;
  }

  private generateGitignore() {
    return `# Dependencies
node_modules/

# Build outputs
dist/
www/
www-build/
loader/

# Testing
coverage/
.stencil/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*

# Environment
.env
.env.local
`;
  }
}