import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class LitTemplate extends BaseTemplate {
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

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Vite config
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig()
    });

    // Index HTML
    files.push({
      path: 'index.html',
      content: this.generateIndexHtml()
    });

    // Main entry
    files.push({
      path: 'src/main.ts',
      content: this.generateMain()
    });

    // App component
    files.push({
      path: 'src/components/app.element.ts',
      content: this.generateAppComponent()
    });

    // Components
    files.push({
      path: 'src/components/header.element.ts',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/components/footer.element.ts',
      content: this.generateFooter()
    });

    files.push({
      path: 'src/components/counter.element.ts',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/components/feature-card.element.ts',
      content: this.generateFeatureCard()
    });

    // Pages
    files.push({
      path: 'src/views/home.element.ts',
      content: this.generateHomePage()
    });

    files.push({
      path: 'src/views/about.element.ts',
      content: this.generateAboutPage()
    });

    // Styles
    files.push({
      path: 'src/styles/theme.css',
      content: this.generateThemeCss()
    });

    // Types
    files.push({
      path: 'src/types/index.ts',
      content: this.generateTypes()
    });

    // Environment
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
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

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.1.0',
      description: this.context.description,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        lint: 'eslint . --ext ts,tsx'
      },
      dependencies: {
        'lit': '^3.1.2'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        '@types/web': '^0.0.0',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        'eslint': '^8.56.0',
        'eslint-plugin-lit': '^1.10.1',
        'prettier': '^3.2.4',
        'typescript': '^5.3.3',
        'vite': '^5.1.0',
        'vite-plugin-lit': '^3.0.0'
      }
    };
  }

  protected generateTsConfig() {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          module: 'ESNext',
          lib: ['ES2021', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          strict: true,
          paths: {
            '@components/*': ['./src/components/*'],
            '@views/*': ['./src/views/*'],
            '@styles/*': ['./src/styles/*'],
            '@types/*': ['./src/types/*']
          }
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }]
      },
      null,
      2
    );
  }

  protected generateViteConfig() {
    return `import { defineConfig } from 'vite';
import lit from 'vite-plugin-lit';

export default defineConfig({
  plugins: [lit()],
  server: {
    port: ${this.context.port || 5173},
    host: true
  },
  build: {
    lib: {
      entry: 'src/main.ts',
      formats: ['es']
    }
  }
});
`;
  }

  protected generateIndexHtml() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${this.context.name}</title>
  </head>
  <body>
    <${this.context.normalizedName}-app></${this.context.normalizedName}-app>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
  }

  protected generateMain() {
    return `import { ${this.context.normalizedName}App } from './components/app.element';

${this.context.normalizedName}App.register();
`;
  }

  protected generateAppComponent() {
    return `import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { router } from 'lit-experimental-router';

import './header.element';
import './footer.element';

@customElement('${this.context.normalizedName}-app')
export class ${this.context.name}App extends LitElement {
  @query('router-outlet')
  private routerOutlet!: any;

  static styles = css\`
    :host {
      display: block;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }

    main {
      flex: 1;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }
  \`;

  firstUpdated() {
    // Initialize router
    const routes = [
      {
        path: '/',
        render: () => html\`<home-page></home-page>\`
      },
      {
        path: '/about',
        render: () => html\`<about-page></about-page>\`
      }
    ];

    router(this, this.routerOutlet, routes);
  }

  render() {
    return html\`
      <app-header></app-header>
      <main>
        <router-outlet></router-outlet>
      </main>
      <app-footer></app-footer>
    \`;
  }
}
`;
  }

  protected generateHeader() {
    return `import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('app-header')
export class Header extends LitElement {
  static styles = css\`
    :host {
      display: block;
    }

    header {
      background: #ffffff;
      border-bottom: 1px solid #e5e5e5;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.2rem;
      font-weight: 700;
    }

    nav {
      display: flex;
      gap: 1.5rem;
    }

    nav a {
      color: #1a1a1a;
      text-decoration: none;
      transition: color 0.2s;
    }

    nav a:hover,
    nav a[active] {
      color: #3b82f6;
    }
  \`;

  render() {
    return html\`
      <header>
        <div class="container">
          <div class="logo">
            <span>💡</span>
            <a href="/">${this.context.name}</a>
          </div>
          <nav>
            <a href="/">Home</a>
            <a href="/about">About</a>
          </nav>
        </div>
      </header>
    \`;
  }
}
`;
  }

  protected generateFooter() {
    return `import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('app-footer')
export class Footer extends LitElement {
  static styles = css\`
    :host {
      display: block;
    }

    footer {
      background: #f9f9f9;
      border-top: 1px solid #e5e5e5;
      padding: 2rem 0;
      margin-top: auto;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
      text-align: center;
    }

    .links {
      margin-top: 0.5rem;
    }

    .links a {
      color: #1a1a1a;
      text-decoration: none;
      margin: 0 0.5rem;
    }

    .links a:hover {
      color: #3b82f6;
    }
  \`;

  render() {
    const currentYear = new Date().getFullYear();

    return html\`
      <footer>
        <div class="container">
          <p>&copy; \${currentYear} ${this.context.name}. Built with Lit.</p>
          <div class="links">
            <a href="https://lit.dev" target="_blank" rel="noopener">Lit Docs</a>
            <a href="https://github.com/lit/lit" target="_blank" rel="noopener">GitHub</a>
          </div>
        </div>
      </footer>
    \`;
  }
}
`;
  }

  protected generateCounter() {
    return `import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('simple-counter')
export class Counter extends LitElement {
  @state()
  private count = 0;

  static styles = css\`
    :host {
      display: block;
    }

    .counter {
      text-align: center;
      padding: 2rem;
      background: #f5f5f5;
      border-radius: 8px;
      margin: 2rem 0;
    }

    .count {
      font-size: 3rem;
      font-weight: 700;
      margin-bottom: 1rem;
      color: #3b82f6;
    }

    .buttons {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
    }

    button {
      padding: 0.5rem 1rem;
      font-size: 1rem;
      border: none;
      border-radius: 4px;
      background: #3b82f6;
      color: white;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #2563eb;
    }

    .hint {
      margin-top: 1rem;
      color: #666;
      font-size: 0.9rem;
    }
  \`;

  private increment() {
    this.count++;
  }

  private decrement() {
    this.count--;
  }

  private reset() {
    this.count = 0;
  }

  render() {
    return html\`
      <div class="counter">
        <div class="count">\${this.count}</div>
        <div class="buttons">
          <button @click=\${this.decrement}>-</button>
          <button @click=\${this.reset}>Reset</button>
          <button @click=\${this.increment}>+</button>
        </div>
        <p class="hint">
          This demonstrates Lit's reactive properties and state management
        </p>
      </div>
    \`;
  }
}
`;
  }

  protected generateFeatureCard() {
    return `import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('feature-card')
export class FeatureCard extends LitElement {
  @property({ type: String })
  icon = '';

  @property({ type: String })
  title = '';

  @property({ type: String })
  description = '';

  static styles = css\`
    :host {
      display: block;
    }

    .card {
      padding: 1.5rem;
      background: #f9f9f9;
      border-radius: 8px;
      transition: transform 0.2s;
    }

    .card:hover {
      transform: translateY(-4px);
    }

    .icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    h3 {
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }

    p {
      color: #666;
      line-height: 1.5;
    }
  \`;

  render() {
    return html\`
      <div class="card">
        <div class="icon">\${this.icon}</div>
        <h3>\${this.title}</h3>
        <p>\${this.description}</p>
      </div>
    \`;
  }
}
`;
  }

  protected generateHomePage() {
    return `import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('home-page')
export class HomePage extends LitElement {
  static styles = css\`
    :host {
      display: block;
    }

    .hero {
      text-align: center;
      padding: 3rem 0;
    }

    h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #3b82f6;
    }

    p {
      font-size: 1.2rem;
      color: #666;
    }

    .features {
      margin: 3rem 0;
    }

    .features h2 {
      font-size: 2rem;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .tech-stack {
      margin: 3rem 0;
      text-align: center;
    }

    .tech-stack h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    ul {
      list-style: none;
      padding: 0;
    }

    li {
      padding: 0.5rem 0;
      font-size: 1.1rem;
    }
  \`;

  render() {
    return html\`
      <div class="home">
        <section class="hero">
          <h1>Welcome to ${this.context.name}</h1>
          <p>A modern Lit application with web components and reactive properties</p>
        </section>

        <simple-counter></simple-counter>

        <section class="features">
          <h2>Lit Features</h2>
          <div class="feature-grid">
            <feature-card
              icon="🔥"
              title="Lightweight"
              description="Tiny library size with full-featured web components"
            ></feature-card>
            <feature-card
              icon="⚡"
              title="Fast"
              description="Optimized for performance with minimal overhead"
            ></feature-card>
            <feature-card
              icon="🎨"
              title="Easy to Use"
              description="Simple, declarative API with reactive properties"
            ></feature-card>
            <feature-card
              icon="🌐"
              title="Standards-Based"
              description="Built on Web Components for true interoperability"
            ></feature-card>
          </div>
        </section>

        <section class="tech-stack">
          <h2>Tech Stack</h2>
          <ul>
            <li><strong>Lit 3</strong> - Lightweight library for web components</li>
            <li><strong>TypeScript</strong> - Full type safety</li>
            <li><strong>Vite</strong> - Lightning-fast build tool</li>
            <li><strong>Web Components</strong> - Native browser standards</li>
          </ul>
        </section>
      </div>
    \`;
  }
}
`;
  }

  protected generateAboutPage() {
    return `import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('about-page')
export class AboutPage extends LitElement {
  static styles = css\`
    :host {
      display: block;
    }

    .about {
      max-width: 800px;
      margin: 0 auto;
    }

    .header {
      text-align: center;
      margin-bottom: 3rem;
    }

    h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .features-list {
      margin-top: 2rem;
    }

    .feature-item {
      margin-bottom: 2rem;
      padding: 1.5rem;
      background: #f9f9f9;
      border-radius: 8px;
    }

    .feature-item h3 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
      color: #3b82f6;
    }

    .feature-item p {
      color: #666;
      line-height: 1.6;
    }

    pre {
      background: #1a1a1a;
      color: #f5f5f5;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }

    code {
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
    }

    .back-link {
      display: inline-block;
      margin-top: 2rem;
      color: #3b82f6;
      text-decoration: none;
    }

    .back-link:hover {
      text-decoration: underline;
    }
  \`;

  render() {
    return html\`
      <div class="about">
        <div class="header">
          <h1>About ${this.context.name}</h1>
          <p>\${this.context.description}</p>
        </div>

        <div class="features-list">
          <h2>Key Features</h2>

          <div class="feature-item">
            <h3>🔥 Web Components</h3>
            <p>Lit is a lightweight library that makes it easy to build web components using standard browser APIs.</p>
          </div>

          <div class="feature-item">
            <h3>⚡ Reactive Properties</h3>
            <p>Declarative reactive properties automatically update your component when state changes.</p>
            <pre><code>@property({ type: Number })
count = 0;</code></pre>
          </div>

          <div class="feature-item">
            <h3>🎨 Scoped Styles</h3>
            <p>Built-in scoped styling with CSS that's automatically encapsulated to your component.</p>
            <pre><code>static styles = css\`
:host {
  color: blue;
}
\`;</code></pre>
          </div>

          <div class="feature-item">
            <h3>🌐 Universal</h3>
            <p>Web Components work in any framework or no framework at all. Build once, use everywhere.</p>
          </div>

          <div class="feature-item">
            <h3>💪 TypeScript Support</h3>
            <p>First-class TypeScript support with full type safety and excellent IDE integration.</p>
          </div>

          <div class="feature-item">
            <h3>📦 Small Bundle Size</h3>
            <p>Lit adds only ~5KB to your bundle size while providing a full-featured component library.</p>
          </div>
        </div>

        <div class="back-link">
          <a href="/">← Back to Home</a>
        </div>
      </div>
    \`;
  }
}
`;
  }

  protected generateThemeCss() {
    return `/* Global Styles */
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  body {
    background-color: #1a1a1a;
    color: #f5f5f5;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
`;
  }

  protected generateTypes() {
    return `export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}
`;
  }

  protected generateEnvExample() {
    return `# Vite Environment Variables
# https://vitejs.dev/guide/env-and-mode.html

# API Configuration
VITE_API_URL=https://api.example.com
VITE_API_KEY=your-api-key-here

# Feature Flags
VITE_ENABLE_DARKMODE=true
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Lit - A lightweight library for building fast, lightweight web components.

## Features

- **Lit 3** - Lightweight web components library
- **TypeScript** - Full type safety
- **Web Components** - Native browser standards
- **Reactive Properties** - Declarative state management
- **Scoped Styles** - Encapsulated component styling
- **Vite** - Lightning-fast HMR and builds
- **Small Bundle Size** - Only ~5KB additional overhead

## Getting Started

### Installation

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### Development

\`\`\`bash
npm run dev
# or
vite
\`\`\`

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

\`\`\`bash
npm run build
# or
tsc && vite build
\`\`\`

The build artifacts will be stored in the \`dist/\` directory.

### Preview

\`\`\`bash
npm run preview
# or
vite preview
\`\`\`

## Project Structure

\`\`\`
src/
├── components/         # Reusable components
│   ├── app.element.ts
│   ├── header.element.ts
│   ├── footer.element.ts
│   ├── counter.element.ts
│   └── feature-card.element.ts
├── views/             # Page components
│   ├── home.element.ts
│   └── about.element.ts
├── styles/            # Global styles
│   └── theme.css
├── types/             # TypeScript types
│   └── index.ts
└── main.ts            # Entry point
\`\`\`

## Creating Components

Lit components are web components with decorators:

\`\`\`typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('my-component')
export class MyComponent extends LitElement {
  @property({ type: String })
  title = 'Default Title';

  @state()
  private count = 0;

  static styles = css\`
    :host {
      display: block;
    }
  \`;

  render() {
    return html\`
      <div>
        <h1>\${this.title}</h1>
        <p>Count: \${this.count}</p>
        <button @click=\${() => this.count++}>+</button>
      </div>
    \`;
  }
}
\`\`\`

## Reactive Properties

Use \`@property\` for reactive public properties:

\`\`\`typescript
@property({ type: String })
name = '';

@property({ type: Number })
count = 0;

@property({ attribute: false })
data = {};
\`\`\`

## State

Use \`@state\` for private reactive state:

\`\`\`typescript
@state()
private counter = 0;
\`\`\`

## Scoped Styles

Define scoped styles within components:

\`\`\`typescript
static styles = css\`
  :host {
    display: block;
  }

  .container {
    padding: 1rem;
  }
\`;
\`\`\`

## Event Handling

Add event listeners with decorators:

\`\`\`typescript
@query('#submit-button')
private submitButton!: HTMLElement;

private handleSubmit() {
  console.log('Form submitted');
}

render() {
  return html\`
    <button id="submit-button" @click=\${this.handleSubmit}>
      Submit
    </button>
  \`;
}
\`\`\`

## Templating

Lit's html tag provides a safe, expressive templating system:

\`\`\`typescript
render() {
  const items = ['Apple', 'Banana', 'Cherry'];

  return html\`
    <ul>
      \${items.map(item => html\`
        <li>\${item}</li>
      \`)}
    </ul>
  \`;
}
\`\`\`

## Lifecycle Methods

Use Lit's lifecycle methods:

\`\`\`typescript
override connectedCallback() {
  super.connectedCallback();
  console.log('Component connected');
}

override disconnectedCallback() {
  super.disconnectedCallback();
  console.log('Component disconnected');
}

override willUpdate(changedProperties: PropertyValues) {
  super.willUpdate(changedProperties);
  console.log('Component will update', changedProperties);
}

override updated(changedProperties: PropertyValues) {
  super.updated(changedProperties);
  console.log('Component updated', changedProperties);
}
\`\`\`

## Shadow DOM

All Lit components use Shadow DOM by default for encapsulation:

\`\`\`typescript
render() {
  return html\`
    <div>
      <!-- Styles don't leak out -->
      <style>\`
        h1 { color: blue; }
      </style>
      <h1>Scoped Styles</h1>
    </div>
  \`;
}
\`\`\`

## Query Selectors

Use \`@query\` and \`@queryAll\` to query elements:

\`\`\`typescript
@query('#input')
private input!: HTMLInputElement;

@queryAll('.item')
private items!: NodeListOf<HTMLDivElement>;

private getValue() {
  return this.input.value;
}
\`\`\`

## Docker

### Build

\`\`\`bash
docker build -t ${this.context.normalizedName} .
\`\`\`

### Run

\`\`\`bash
docker run -p 80:80 ${this.context.normalizedName}
\`\`\`

### Docker Compose

\`\`\`bash
docker-compose up
\`\`\`

## Deployment

Deploy to any hosting service:

- **Vercel**: Zero-config deployment
- **Netlify**: Full-stack support
- **AWS**: S3, CloudFront, Amplify
- **Google Cloud**: Firebase, App Engine
- **Azure**: Static Web Apps
- **GitHub Pages**: Static hosting

\`\`\`bash
# Build for production
npm run build

# Output in dist/ directory
# Deploy dist/ folder to your hosting service
\`\`\`

## Documentation

- [Lit Documentation](https://lit.dev)
- [Lit GitHub](https://github.com/lit/lit)
- [Web Components Documentation](https://www.webcomponents.org)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Lit SPA

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
`;
  }
}
