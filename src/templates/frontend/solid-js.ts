import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class SolidJsTemplate extends BaseTemplate {
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

    // Vite config
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig()
    });

    // TypeScript config
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
      path: 'src/main.tsx',
      content: this.generateMain()
    });

    files.push({
      path: 'src/App.tsx',
      content: this.generateApp()
    });

    files.push({
      path: 'src/App.css',
      content: this.generateAppCss()
    });

    // Index CSS
    files.push({
      path: 'src/index.css',
      content: this.generateIndexCss()
    });

    // Pages
    files.push({
      path: 'src/pages/Home.tsx',
      content: this.generateHomePage()
    });

    files.push({
      path: 'src/pages/About.tsx',
      content: this.generateAboutPage()
    });

    // Components
    files.push({
      path: 'src/components/Header.tsx',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/components/Footer.tsx',
      content: this.generateFooter()
    });

    files.push({
      path: 'src/components/Counter.tsx',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/components/FeatureCard.tsx',
      content: this.generateFeatureCard()
    });

    // Stores
    files.push({
      path: 'src/stores/useCounter.ts',
      content: this.generateCounterStore()
    });

    files.push({
      path: 'src/stores/useTheme.ts',
      content: this.generateThemeStore()
    });

    // Utils
    files.push({
      path: 'src/utils/api.ts',
      content: this.generateApi()
    });

    files.push({
      path: 'src/utils/format.ts',
      content: this.generateFormat()
    });

    // Types
    files.push({
      path: 'src/types/index.ts',
      content: this.generateTypes()
    });

    // Assets
    files.push({
      path: 'public/vite.svg',
      content: this.generateViteSvg()
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
        build: 'vite build',
        preview: 'vite preview',
        lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0'
      },
      dependencies: {
        '@solidjs/router': '^0.10.5',
        'solid-js': '^1.8.11'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        'eslint': '^8.56.0',
        'eslint-plugin-solid': '^0.13.1',
        'typescript': '^5.3.3',
        'vite': '^5.1.0',
        'vite-plugin-solid': '^2.9.1'
      }
    };
  }

  protected generateViteConfig() {
    return `import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: ${this.context.port || 5173},
    host: true
  },
  build: {
    target: 'esnext'
  }
});
`;
  }

  protected generateTsConfig() {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          jsx: 'preserve',
          jsxImportSource: 'solid-js',
          resolveJsonModule: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
          paths: {
            '@/*': ['./src/*'],
            '@components/*': ['./src/components/*'],
            '@pages/*': ['./src/pages/*'],
            '@stores/*': ['./src/stores/*'],
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
        include: ['vite.config.ts']
      },
      null,
      2
    );
  }

  protected generateMain() {
    return `import { render } from 'solid-js/web';
import { Router } from '@solidjs/router';
import './index.css';
import App from './App';

render(() => (
  <Router>
    <App />
  </Router>
), document.getElementById('root') as HTMLElement);
`;
  }

  protected generateApp() {
    return `import { useLocation } from '@solidjs/router';
import { Show, Suspense, lazy } from 'solid-js';
import Header from '@components/Header';
import Footer from '@components/Footer';
import './App.css';

// Lazy load pages
const Home = lazy(() => import('@pages/Home'));
const About = lazy(() => import('@pages/About'));

export default function App() {
  const location = useLocation();

  return (
    <div class="app">
      <Header />

      <main class="main-content">
        <Suspense fallback={<div class="loading">Loading...</div>}>
          <Show when={location.pathname === '/'} fallback={<About />}>
            <Home />
          </Show>
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
`;
  }

  protected generateAppCss() {
    return `.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main-content {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  font-size: 1.2rem;
  color: #666;
}

@media (max-width: 768px) {
  .main-content {
    padding: 1rem;
  }
}
`;
  }

  protected generateIndexCss() {
    return `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
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

#root {
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

button:focus,
button:focus-visible {
  outline: 4px auto -webkit-focus-ring-color;
}
`;
  }

  protected generateHomePage() {
    return `import { Component } from 'solid-js';
import Counter from '@components/Counter';
import FeatureCard from '@components/FeatureCard';
import './Home.css';

const Home: Component = () => {
  return (
    <div class="home">
      <section class="hero">
        <h1>Welcome to ${this.context.name}</h1>
        <p>A modern Solid.js application with fine-grained reactivity and JSX</p>
      </section>

      <section class="counter-section">
        <Counter />
      </section>

      <section class="features">
        <h2>Solid.js Features</h2>
        <div class="feature-grid">
          <FeatureCard
            icon="⚡"
            title="Fine-Grained Reactivity"
            description="No virtual DOM, direct DOM updates with fine-grained reactivity"
          />
          <FeatureCard
            icon="🔥"
            title="True Reactivity"
            description="Simple reactive primitives with no re-renders"
          />
          <FeatureCard
            icon="💪"
            title="Performance"
            description="Fastest UI framework with minimal bundle size"
          />
          <FeatureCard
            icon="🎨"
            title="JSX Syntax"
            description="Familiar JSX syntax with TypeScript support"
          />
        </div>
      </section>

      <section class="tech-stack">
        <h2>Tech Stack</h2>
        <ul>
          <li><strong>Solid.js 1.8</strong> - Reactive UI framework</li>
          <li><strong>TypeScript</strong> - Type-safe development</li>
          <li><strong>Vite</strong> - Lightning-fast build tool</li>
          <li><strong>Solid Router</strong> - File-based routing</li>
        </ul>
      </section>
    </div>
  );
};

export default Home;
`;
  }

  protected generateAboutPage() {
    return `import { Component } from 'solid-js';
import './About.css';

const About: Component = () => {
  return (
    <div class="about">
      <div class="about-header">
        <h1>About ${this.context.name}</h1>
        <p>${this.context.description}</p>
      </div>

      <section class="features-list">
        <h2>Key Features</h2>

        <div class="feature-item">
          <h3>🎯 Fine-Grained Reactivity</h3>
          <p>Solid's reactive system tracks dependencies at the granular level, updating only what needs to change.</p>
          <pre><code class="typescript">import { createSignal } from 'solid-js';

const [count, setCount] = createSignal(0);

// Only components using count() will update
setCount(1);</code></pre>
        </div>

        <div class="feature-item">
          <h3>💪 No Virtual DOM</h3>
          <p>Solid compiles JSX to efficient DOM operations, eliminating the virtual DOM overhead.</p>
          <pre><code class="typescript">// Direct DOM manipulation
const el = document.createElement('div');
el.textContent = 'Hello';</code></pre>
        </div>

        <div class="feature-item">
          <h3>🔥 Simple Primitives</h3>
          <p>Signals, Memos, and Effects provide all the reactive primitives you need.</p>
          <pre><code class="typescript">import { createSignal, createMemo, createEffect } from 'solid-js';

const [count] = createSignal(0);
const doubled = createMemo(() => count() * 2);

createEffect(() => {
  console.log('Count changed:', count());
});</code></pre>
        </div>

        <div class="feature-item">
          <h3>🎨 JSX Syntax</h3>
          <p>Familiar JSX syntax that compiles to highly efficient JavaScript.</p>
          <pre><code class="typescript">function Counter() {
  const [count, setCount] = createSignal(0);

  return (
    <button onClick={() => setCount(count() + 1)}>
      {count()}
    </button>
  );
}</code></pre>
        </div>

        <div class="feature-item">
          <h3>🌳 Component Trees</h3>
          <p>Solid uses component trees with props and context for composition.</p>
          <pre><code class="typescript">function Parent() {
  return (
    <Child value="Hello" />
  );
}

function Child(props) {
  return <div>{props.value}</div>;
}</code></pre>
        </div>

        <div class="feature-item">
          <h3>📦 Small Bundle Size</h3>
          <p>Solid's runtime is only a few KB, making it one of the smallest frameworks.</p>
        </div>
      </section>
    </div>
  );
};

export default About;
`;
  }

  protected generateHeader() {
    return `import { Component } from 'solid-js';
import { A } from '@solidjs/router';
import { useTheme } from '@stores/useTheme';
import './Header.css';

const Header: Component = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header class="header">
      <div class="header-container">
        <div class="logo">
          <span class="logo-icon">⚡</span>
          <A href="/" class="logo-link">
            ${this.context.name}
          </A>
        </div>

        <nav class="nav">
          <A href="/" class="nav-link">Home</A>
          <A href="/about" class="nav-link">About</A>
          <button
            class="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {theme() === 'light' ? '🌙' : '☀️'}
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
`;
  }

  protected generateFooter() {
    return `import { Component } from 'solid-js';
import './Footer.css';

const Footer: Component = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer class="footer">
      <div class="footer-container">
        <p>&copy; {currentYear} ${this.context.name}. Built with Solid.js.</p>
        <div class="footer-links">
          <a href="https://www.solidjs.com" target="_blank" rel="noopener">
            Solid.js Docs
          </a>
          <span>•</span>
          <a href="https://github.com/solidjs/solid" target="_blank" rel="noopener">
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
`;
  }

  protected generateCounter() {
    return `import { Component } from 'solid-js';
import { useCounter } from '@stores/useCounter';
import './Counter.css';

const Counter: Component = () => {
  const { count, increment, decrement, reset } = useCounter();

  return (
    <div class="counter">
      <h2>Counter: {count()}</h2>
      <div class="counter-buttons">
        <button onClick={decrement}>-</button>
        <button onClick={reset}>Reset</button>
        <button onClick={increment}>+</button>
      </div>
      <p class="hint">
        Try it! This demonstrates Solid's fine-grained reactivity.
      </p>
    </div>
  );
};

export default Counter;
`;
  }

  protected generateFeatureCard() {
    return `import { Component } from 'solid-js';
import './FeatureCard.css';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureCard: Component<FeatureCardProps> = (props) => {
  return (
    <div class="feature-card">
      <div class="feature-icon">{props.icon}</div>
      <h3 class="feature-title">{props.title}</h3>
      <p class="feature-description">{props.description}</p>
    </div>
  );
};

export default FeatureCard;
`;
  }

  protected generateCounterStore() {
    return `import { createSignal } from 'solid-js';

export function useCounter(initialValue: number = 0) {
  const [count, setCount] = createSignal(initialValue);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);
  const reset = () => setCount(initialValue);

  return {
    count,
    increment,
    decrement,
    reset
  };
}
`;
  }

  protected generateThemeStore() {
    return `import { createSignal, onMount } from 'solid-js';

type Theme = 'light' | 'dark';

const THEME_KEY = 'theme';

export function useTheme() {
  // Get initial theme from localStorage or default to light
  const getInitialTheme = (): Theme => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored as Theme;
      }
    }
    return 'light';
  };

  const [theme, setTheme] = createSignal<Theme>(getInitialTheme());

  const toggleTheme = () => {
    setTheme(t => (t === 'light' ? 'dark' : 'light'));
  };

  // Apply theme class to document and persist to localStorage
  onMount(() => {
    const applyTheme = (t: Theme) => {
      document.documentElement.classList.toggle('dark', t === 'dark');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_KEY, t);
      }
    };

    // Apply initial theme
    applyTheme(theme());

    // Watch for theme changes
    const unsubscribe = theme.subscribe(applyTheme);

    // Cleanup on unmount
    return unsubscribe;
  });

  return {
    theme,
    setTheme,
    toggleTheme
  };
}
`;
  }

  protected generateApi() {
    return `const API_BASE = 'https://jsonplaceholder.typicode.com';

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async delete(endpoint: string): Promise<void> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
  }
};
`;
  }

  protected generateFormat() {
    return `export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
`;
  }

  protected generateTypes() {
    return `export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
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

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
`;
  }

  protected generateViteSvg() {
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="31.88" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 257"><defs><linearGradient id="IconifyId1813088fe1fbc01fb466" x1="-.828%" x2="57.636%" y1="7.652%" y2="78.411%"><stop offset="0%" stop-color="#41D1FF"></stop><stop offset="100%" stop-color="#BD34FE"></stop></linearGradient><linearGradient id="IconifyId1813088fe1fbc01fb467" x1="43.376%" x2="50.316%" y1="2.242%" y2="89.03%"><stop offset="0%" stop-color="#FFEA83"></stop><stop offset="8.333%" stop-color="#FFDD35"></stop><stop offset="100%" stop-color="#FFA800"></stop></linearGradient></defs><path fill="url(#IconifyId1813088fe1fbc01fb466)" d="M255.153 37.938L134.897 252.976c-2.483 4.44-8.862 4.466-11.382.048L.875 37.958c-2.746-4.814 1.371-10.646 6.827-9.67l120.385 21.517a6.537 6.537 0 0 0 2.322-.004l117.867-21.483c5.438-.991 9.574 4.796 6.877 9.62Z"></path><path fill="url(#IconifyId1813088fe1fbc01fb467)" d="M185.432.063L96.44 17.501a3.268 3.268 0 0 0-2.634 3.014l-5.474 92.456a3.268 3.268 0 0 0 3.997 3.378l24.777-5.718c2.318-.535 4.413 1.507 3.936 3.838l-7.361 36.047c-.495 2.426 1.782 4.5 4.151 3.78l15.304-4.649c2.372-.72 4.652 1.36 4.15 3.788l-11.698 56.621c-.732 3.542 3.979 5.473 5.943 2.437l1.313-2.028l72.516-144.72c1.215-2.423-.88-5.186-3.54-4.672l-25.505 4.922c-2.396.462-4.435-1.77-3.759-4.114l16.646-57.705c.677-2.35-1.37-4.583-3.769-4.113Z"></path></svg>`;
  }

  protected generateEnvExample() {
    return `# Vite Environment Variables
# https://vitejs.dev/guide/env-and-mode.html

# API Configuration
VITE_API_URL=https://jsonplaceholder.typicode.com
VITE_API_KEY=your-api-key-here

# Feature Flags
VITE_ENABLE_DARKMODE=true
VITE_ENABLE_ANALYTICS=false

# Build Configuration
NODE_ENV=development
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with Solid.js - a reactive JavaScript framework for building user interfaces with fine-grained reactivity.

## Features

- **Solid.js 1.8** - Reactive UI framework with fine-grained reactivity
- **TypeScript** - Full type safety
- **Vite** - Lightning-fast HMR and optimized builds
- **Solid Router** - Simple and efficient routing
- **Signals** - Reactive primitives for state management
- **JSX Syntax** - Familiar syntax that compiles to efficient DOM operations
- **No Virtual DOM** - Direct DOM manipulation for maximum performance
- **Small Bundle Size** - One of the smallest framework runtimes

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
vite build
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
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Counter.tsx
│   └── FeatureCard.tsx
├── pages/             # Page components
│   ├── Home.tsx
│   └── About.tsx
├── stores/            # Reactive stores
│   ├── useCounter.ts
│   └── useTheme.ts
├── utils/             # Utility functions
│   ├── api.ts
│   └── format.ts
├── types/             # TypeScript types
│   └── index.ts
├── App.tsx            # Root component
├── main.tsx           # Entry point
└── index.css          # Global styles
\`\`\`

## Reactive Primitives

### Signals

\`\`\`typescript
import { createSignal } from 'solid-js';

const [count, setCount] = createSignal(0);

// Read value
console.log(count());

// Update value
setCount(1);
setCount(c => c + 1);
\`\`\`

### Memos

\`\`\`typescript
import { createSignal, createMemo } from 'solid-js';

const [count] = createSignal(0);
const doubled = createMemo(() => count() * 2);

// doubled only recalculates when count() changes
\`\`\`

### Effects

\`\`\`typescript
import { createSignal, createEffect } from 'solid-js';

const [count] = createSignal(0);

createEffect(() => {
  console.log('Count changed:', count());
});
\`\`\`

## Components

Solid.js components are simple functions:

\`\`\`typescript
import { Component } from 'solid-js';

const Counter: Component = () => {
  const [count, setCount] = createSignal(0);

  return (
    <div>
      <h1>Count: {count()}</h1>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  );
};

export default Counter;
\`\`\`

## Props

\`\`\`typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
}

const Button: Component<ButtonProps> = (props) => {
  return <button onClick={props.onClick}>{props.label}</button>;
};
\`\`\`

## Routing

Solid Router provides file-based routing:

\`\`\`typescript
import { Router, Routes, Route, A } from '@solidjs/router';

function App() {
  return (
    <Router>
      <nav>
        <A href="/">Home</A>
        <A href="/about">About</A>
      </nav>
      <Routes>
        <Route path="/" component={Home} />
        <Route path="/about" component={About} />
      </Routes>
    </Router>
  );
}
\`\`\`

## State Management

Create reusable stores with composable functions:

\`\`\`typescript
// stores/useCounter.ts
import { createSignal } from 'solid-js';

export function useCounter(initial: number = 0) {
  const [count, setCount] = createSignal(initial);

  return {
    count,
    increment: () => setCount(c => c + 1),
    decrement: () => setCount(c => c - 1),
    reset: () => setCount(initial)
  };
}

// Usage in component
import { useCounter } from '@stores/useCounter';

function Counter() {
  const { count, increment, decrement, reset } = useCounter(0);

  return (
    <div>
      <button onClick={decrement}>-</button>
      <span>{count()}</span>
      <button onClick={increment}>+</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
\`\`\`

## Lifecycle

Solid uses \`createEffect\` and \`onMount\`:

\`\`\`typescript
import { createSignal, createEffect, onMount } from 'solid-js';

function Component() {
  const [data, setData] = createSignal(null);

  onMount(async () => {
    // Run once on mount
    const response = await fetch('/api/data');
    setData(await response.json());
  });

  createEffect(() => {
    // Run when data() changes
    console.log('Data changed:', data());
  });

  return <div>{data()}</div>;
}
\`\`\`

## Directives

Use directives for reusable DOM manipulation:

\`\`\`typescript
function clickOutside(element: HTMLElement, callback: () => void) {
  const handleClick = (e: MouseEvent) => {
    if (!element.contains(e.target as Node)) {
      callback();
    }
  };

  document.addEventListener('click', handleClick, true);
  onCleanup(() => document.removeEventListener('click', handleClick, true));
}

// Usage
<div use:clickOutside={() => setShowDropdown(false)}>
  Dropdown
</div>
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

- [Solid.js Documentation](https://www.solidjs.com)
- [Solid Tutorial](https://www.solidjs.com/tutorial)
- [Solid Router](https://github.com/solidjs/solid-router)
- [Solid Primitives](https://github.com/solidjs/solid-primitives)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Solid.js SPA

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
