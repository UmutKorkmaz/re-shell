import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class QwikTemplate extends BaseTemplate {
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

    // Qwik config
    files.push({
      path: 'qwik.config.ts',
      content: this.generateQwikConfig()
    });

    // Vite config
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig()
    });

    // TypeScript configs
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    files.push({
      path: 'tsconfig.node.json',
      content: this.generateTsConfigNode()
    });

    // App entry
    files.push({
      path: 'src/root.tsx',
      content: this.generateRoot()
    });

    files.push({
      path: 'src/global.css',
      content: this.generateGlobalCss()
    });

    // Layouts
    files.push({
      path: 'src/routes/layout.tsx',
      content: this.generateLayout()
    });

    // Pages
    files.push({
      path: 'src/routes/index.tsx',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/routes/about/index.tsx',
      content: this.generateAboutPage()
    });

    // Components
    files.push({
      path: 'src/components/counter/counter.tsx',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/components/feature-card/feature-card.tsx',
      content: this.generateFeatureCard()
    });

    files.push({
      path: 'src/components/header/header.tsx',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/components/footer/footer.tsx',
      content: this.generateFooter()
    });

    // Loader
    files.push({
      path: 'src/routes/index.tsx',
      content: this.generateIndexPage()
    });

    // Entry files
    files.push({
      path: 'src/entry.ssr.tsx',
      content: this.generateEntrySsr()
    });

    files.push({
      path: 'src/entry.preview.tsx',
      content: this.generateEntryPreview()
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
      version: '0.0.1',
      description: this.context.description,
      scripts: {
        dev: 'qwik dev',
        build: 'qwik build',
        'build.preview': 'qwik build --preview',
        deploy: 'qwik build deploy',
        'fmt': 'prettier --write .',
        'fmt.check': 'prettier --check .',
        lint: 'eslint "src/**/*.ts{,x}"',
        test: 'vitest',
        start: 'qwik build preview && vite preview',
        qwikCity: 'qwikCity'
      },
      devDependencies: {
        '@builder.io/qwik': '^1.5.1',
        '@builder.io/qwik-city': '^1.5.1',
        '@types/eslint': '^8.56.0',
        '@types/node': '^20.11.0',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        'eslint': '^8.56.0',
        'eslint-plugin-qwik': '^1.5.1',
        'node-fetch': '^3.3.2',
        'prettier': '^3.2.4',
        'typescript': '^5.3.3',
        'undici': '^6.6.2',
        'vite': '^5.1.0',
        'vitest': '^1.2.2'
      },
      eslintConfig: {
        extends: [
          'plugin:qwik/recommended'
        ]
      }
    };
  }

  protected generateQwikConfig() {
    return `import { defineConfig } from '@builder.io/qwik-city/vite';
import { qwikVite } from '@builder.io/qwik/optimizer';

export default defineConfig({
  plugins: [qwikVite()],
  server: {
    port: ${this.context.port || 5173},
    host: true
  },
  preview: {
    port: ${this.context.port || 4173}
  }
});
`;
  }

  protected generateViteConfig() {
    return `import { defineConfig } from 'vite';
import { qwikVite } from '@builder.io/qwik/optimizer';
import { qwikCity } from '@builder.io/qwik-city/vite';
import { join } from 'path';

export default defineConfig({
  plugins: [qwikCity()],
  resolve: {
    alias: {
      '@components': join(__dirname, './src/components'),
      '@utils': join(__dirname, './src/utils'),
      '@types': join(__dirname, './src/types')
    }
  }
});
`;
  }

  protected generateTsConfig() {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          types: ['vite/client'],
          paths: {
            '@components/*': ['./src/components/*'],
            '@utils/*': ['./src/utils/*'],
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

  protected generateTsConfigNode() {
    return JSON.stringify(
      {
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          allowSyntheticDefaultImports: true
        },
        include: ['vite.config.ts', 'qwik.config.ts']
      },
      null,
      2
    );
  }

  protected generateRoot() {
    return `import { component$ } from '@builder.io/qwik';
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city';
import { RouterHead } from './components/router-head/router-head';

import './global.css';

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body lang="en">
        <RouterHead />
        <RouterOutlet />
      </body>
    </QwikCityProvider>
  );
});
`;
  }

  protected generateGlobalCss() {
    return `:root {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
}

a {
  color: #4f8cc9;
  text-decoration: none;
}

a:hover {
  color: #3a6ea5;
}

button {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.6em 1.2em;
  font-size: 1em;
  font-weight: 500;
  font-family: inherit;
  background-color: #1a1a1a;
  color: white;
  cursor: pointer;
  transition: border-color 0.25s;
}

button:hover {
  border-color: #4f8cc9;
}
`;
  }

  protected generateLayout() {
    return `import { component$ } from '@builder.io/qwik';
import Header from '@components/header/header';
import Footer from '@components/footer/footer';

export default component$((props) => {
  return (
    <>
      <Header />
      <main class="main-content">
        {props.children}
      </main>
      <Footer />
    </>
  );
});
`;
  }

  protected generateIndexPage() {
    return `import { component$, $ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import Counter from '@components/counter/counter';
import FeatureCard from '@components/feature-card/feature-card';

export const useDataloader = routeLoader$(async () => {
  // Server-side data loading
  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=5');
  const posts = await response.json();
  return {
    posts,
    timestamp: new Date().toISOString()
  };
});

export default component$(() => {
  const data = useDataloader();
  const count = $(0);

  return (
    <div class="home">
      <section class="hero">
        <h1>Welcome to ${this.context.name}</h1>
        <p>A Qwik application with resumability and edge-side rendering</p>
      </section>

      <section class="counter-section">
        <Counter />
      </section>

      <section class="features">
        <h2>Qwik Features</h2>
        <div class="feature-grid">
          <FeatureCard
            icon="⚡"
            title="Resumability"
            description="Resume app execution where it left off, no hydration required"
          />
          <FeatureCard
            icon="🌐"
            title="Edge-Side Rendering"
            description="Render at the edge for optimal performance worldwide"
          />
          <FeatureCard
            icon="📦"
            title="Lazy Loading"
            description="Code splitting at the component level by default"
          />
          <FeatureCard
            icon="🚀"
            title="Instant Loading"
            description="No JavaScript required for initial page load"
          />
        </div>
      </section>

      <section class="data-section">
        <h2>Server Data (Loaded at Edge)</h2>
        <p>Timestamp: {data.value.timestamp}</p>
        <div class="posts">
          {data.value.posts.map((post: any) => (
            <div key={post.id} class="post-item">
              <h3>{post.title}</h3>
              <p>{post.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section class="tech-stack">
        <h2>Tech Stack</h2>
        <ul>
          <li><strong>Qwik 1.5</strong> - Resumable framework</li>
          <li><strong>TypeScript</strong> - Type-safe development</li>
          <li><strong>Qwik City</strong> - Meta-framework for Qwik</li>
          <li><strong>Vite</strong> - Lightning-fast build tool</li>
        </ul>
      </section>
    </div>
  );
});
`;
  }

  protected generateAboutPage() {
    return `import { component$ } from '@builder.io/qwik';

export default component$(() => {
  return (
    <div class="about">
      <div class="about-header">
        <h1>About ${this.context.name}</h1>
        <p>${this.context.description}</p>
      </div>

      <section class="features-list">
        <h2>Key Features</h2>

        <div class="feature-item">
          <h3>⚡ Resumability</h3>
          <p>Qwik's unique resumability means your app can pause and resume execution at any point, shipping only the minimal JavaScript needed.</p>
        </div>

        <div class="feature-item">
          <h3>🌐 Edge-Side Rendering</h3>
          <p>Render your application at the edge, close to users worldwide for the fastest possible initial load.</p>
        </div>

        <div class="feature-item">
          <h3>📦 Fine-Grained Lazy Loading</h3>
          <p>Qwik lazy loads everything by default - components, styles, even event handlers are only loaded when needed.</p>
        </div>

        <div class="feature-item">
          <h3>🚀 No Hydration</h3>
          <p>Unlike other frameworks, Qwik doesn't need to hydrate the page. It resumes execution exactly where it left off.</p>
        </div>

        <div class="feature-item">
          <h3>💎 Delayed Initialization</h3>
          <p>JavaScript is delayed until user interaction, ensuring the fastest possible Time to Interactive (TTI).</p>
        </div>

        <div class="feature-item">
          <h3>🎨 Familiar Syntax</h3>
          <p>Qwik uses familiar JSX/TSX syntax that React/Vue developers will recognize, making the learning curve minimal.</p>
        </div>
      </section>
    </div>
  );
});
`;
  }

  protected generateCounter() {
    return `import { component$, useSignal } from '@builder.io/qwik';

export const Counter = component$(() => {
  const count = useSignal(0);

  return (
    <div class="counter">
      <h2>Counter: {count.value}</h2>
      <div class="counter-buttons">
        <button onClick$={() => count.value--}>Decrement</button>
        <button onClick$={() => count.value = 0}>Reset</button>
        <button onClick$={() => count.value++}>Increment</button>
      </div>
      <p class="hint">
        This component is lazy-loaded and its JavaScript is only fetched when you interact!
      </p>
    </div>
  );
});
`;
  }

  protected generateFeatureCard() {
    return `import { component$ } from '@builder.io/qwik';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

export const FeatureCard = component$((props: FeatureCardProps) => {
  return (
    <div class="feature-card">
      <div class="feature-icon">{props.icon}</div>
      <h3 class="feature-title">{props.title}</h3>
      <p class="feature-description">{props.description}</p>
    </div>
  );
});
`;
  }

  protected generateHeader() {
    return `import { component$, $ } from '@builder.io/qwik';
import { useLocation } from '@builder.io/qwik-city';

export const Header = component$(() => {
  const location = useLocation();

  return (
    <header class="header">
      <div class="header-container">
        <div class="logo">
          <span class="logo-icon">⚡</span>
          <a href="/" class="logo-link">
            ${this.context.name}
          </a>
        </div>

        <nav class="nav">
          <a href="/" class={$('nav-link', { class: { active: location.url.pathname === '/' } })}>
            Home
          </a>
          <a href="/about/" class={$('nav-link', { class: { active: location.url.pathname.startsWith('/about') } })}>
            About
          </a>
        </nav>
      </div>
    </header>
  );
});
`;
  }

  protected generateFooter() {
    return `import { component$ } from '@builder.io/qwik';

export const Footer = component$(() => {
  const currentYear = new Date().getFullYear();

  return (
    <footer class="footer">
      <div class="footer-container">
        <p>&copy; {currentYear} ${this.context.name}. Built with Qwik.</p>
        <div class="footer-links">
          <a href="https://qwik.builder.io" target="_blank" rel="noopener">
            Qwik Docs
          </a>
          <span>•</span>
          <a href="https://github.com/BuilderIO/qwik" target="_blank" rel="noopener">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
});
`;
  }

  protected generateEntrySsr() {
    // This is a placeholder - Qwik handles SSR automatically
    return `// SSR Entry - Qwik handles this automatically
export {};
`;
  }

  protected generateEntryPreview() {
    // This is a placeholder - Qwik handles preview automatically
    return `// Preview Entry - Qwik handles this automatically
export {};
`;
  }

  protected generateEnvExample() {
    return `# Qwik Environment Variables
# https://qwik.builder.io/docs/env-variables/

# Private variables (only available server-side)
PRIVATE_API_KEY=your-private-api-key
DATABASE_URL=your-database-url

# Public variables (available to client)
PUBLIC_API_URL=https://api.example.com
PUBLIC_SITE_URL=https://yourdomain.com
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Qwik - A resumable framework for building high-performance web applications.

## Features

- **Qwik 1.5** - Resumable framework with no hydration
- **Qwik City** - Meta-framework with routing and data loading
- **TypeScript** - Full type safety
- **Resumability** - Resume execution without hydration
- **Edge-Side Rendering** - Render at the edge for optimal performance
- **Fine-Grained Lazy Loading** - Code splitting at component level
- **Instant Loading** - No JavaScript required for initial page load
- **Vite** - Lightning-fast HMR and builds

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
qwik dev
\`\`\`

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

\`\`\`bash
npm run build
# or
qwik build
\`\`\`

### Preview

\`\`\`bash
npm run start
# or
qwik build preview && vite preview
\`\`\`

## Project Structure

\`\`\`
src/
├── components/         # Reusable components
│   ├── counter/
│   │   └── counter.tsx
│   ├── feature-card/
│   │   └── feature-card.tsx
│   ├── header/
│   │   └── header.tsx
│   └── footer/
│       └── footer.tsx
├── routes/             # File-based routing
│   ├── layout.tsx      # Root layout
│   ├── index.tsx       # Home page
│   └── about/
│       └── index.tsx   # About page
├── root.tsx            # Root component
├── global.css          # Global styles
├── entry.ssr.tsx       # SSR entry
└── entry.preview.tsx   # Preview entry
\`\`\`

## Qwik Core Concepts

### Resumability

Qwik apps are resumable - they can pause and resume execution without needing hydration:

\`\`\`typescript
import { component$, useSignal } from '@builder.io/qwik';

export default component$(() => {
  const count = useSignal(0);

  return (
    <button onClick$={() => count.value++}>
      Count: {count.value}
    </button>
  );
});
\`\`\`

### $ for Lazy Loading

Use \`$\` to mark functions for lazy loading:

\`\`\`typescript
// This code is only loaded when the button is clicked
const handleClick = $(() => {
  console.log('Clicked!');
});
\`\`\`

### Loaders

Load data on the server with \`routeLoader$\`:

\`\`\`typescript
import { routeLoader$ } from '@builder.io/qwik-city';

export const useData = routeLoader$(async () => {
  const response = await fetch('https://api.example.com/data');
  return response.json();
});
\`\`\`

### Action$

Handle form submissions with \`action$\`:

\`\`\`typescript
import { action$ } from '@builder.io/qwik-city';

export const useAction = action$((async (data) => {
  // Process form data
  return { success: true };
}));
\`\`\`

### Components

Qwik components use special syntax:

\`\`\`typescript
import { component$, useSignal } from '@builder.io/qwik';

interface Props {
  title: string;
}

export const MyComponent = component$((props: Props) => {
  const count = useSignal(0);

  return (
    <div>
      <h1>{props.title}</h1>
      <p>Count: {count.value}</p>
      <button onClick$={() => count.value++}>+</button>
    </div>
  );
});
\`\`\`

## Styling

Qwik supports CSS, CSS Modules, and CSS-in-JS:

\`\`\`typescript
// In-component styles
export const MyComponent = component$(() => {
  return (
    <div style={{
      padding: '1rem',
      background: '#f0f0f0'
    }}>
      Content
    </div>
  );
});
\`\`\`

Or use external CSS files:

\`\`\`typescript
import './my-component.css';

export const MyComponent = component$(() => {
  return <div class="my-component">Content</div>;
});
\`\`\`

## Deployment

Deploy to any platform:

### Node.js

\`\`\`bash
npm run build
npm run deploy
\`\`\`

### Cloudflare Pages

\`\`\`bash
npm run build
# Upload dist/ folder
\`\`\`

### Netlify

\`\`\`bash
npm run build
# Upload dist/ folder
\`\`\`

### Vercel

\`\`\`bash
npm run build
# Upload dist/ folder
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

## Documentation

- [Qwik Documentation](https://qwik.builder.io)
- [Qwik City Documentation](https://qwik.builder.io/qwikcity/)
- [Qwik Examples](https://stackblitz.com/@builderio/qwik)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Qwik SPA

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server/entry.fastify.js"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
    restart: unless-stopped
`;
  }
}
