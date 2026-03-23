import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class PreactTemplate extends BaseTemplate {
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
      path: 'src/main.tsx',
      content: this.generateMain()
    });

    // App component
    files.push({
      path: 'src/App.tsx',
      content: this.generateApp()
    });

    // Styles
    files.push({
      path: 'src/index.css',
      content: this.generateIndexCss()
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
      path: 'src/components/TodoList.tsx',
      content: this.generateTodoList()
    });

    files.push({
      path: 'src/components/FeatureCard.tsx',
      content: this.generateFeatureCard()
    });

    // Hooks
    files.push({
      path: 'src/hooks/useCounter.ts',
      content: this.generateUseCounterHook()
    });

    files.push({
      path: 'src/hooks/useLocalStorage.ts',
      content: this.generateUseLocalStorageHook()
    });

    // Utils
    files.push({
      path: 'src/utils/format.ts',
      content: this.generateFormatUtils()
    });

    // Types
    files.push({
      path: 'src/types/index.ts',
      content: this.generateTypes()
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

  protected generatePackageJson(): any {
    return {
      name: this.context.normalizedName,
      version: '0.0.1',
      description: `${this.context.name} - Preact Application`,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
        test: 'vitest'
      },
      dependencies: {
        'preact': '^10.19.3',
        'preact-compat': '^3.19.0',
        'preact-router': '^4.1.0'
      },
      devDependencies: {
        '@preact/preset-vite': '^2.8.1',
        '@types/node': '^20.11.0',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        'eslint': '^8.56.0',
        'eslint-plugin-react-hooks': '^4.6.0',
        'jsdom': '^24.0.0',
        'typescript': '^5.3.3',
        'vite': '^5.0.12',
        'vitest': '^1.2.2'
      }
    };
  }

  protected generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        jsxImportSource: 'preact',
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        paths: {
          '@/*': ['./src/*'],
          '@components/*': ['./src/components/*'],
          '@hooks/*': ['./src/hooks/*'],
          '@utils/*': ['./src/utils/*'],
          '@types/*': ['./src/types/*']
        }
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }]
    }, null, 2);
  }

  protected generateViteConfig(): string {
    return `import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: ${this.context.port || 5173},
    open: true,
  },
});
`;
  }

  private generateIndexHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.context.name}</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`;
  }

  private generateMain() {
    return `import { render } from 'preact';
import { App } from './App';
import './index.css';

render(<App />, document.getElementById('app')!);
`;
  }

  private generateApp() {
    return `import { useState } from 'preact/hooks';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { FeatureCard } from './components/FeatureCard';

interface Feature {
  title: string;
  description: string;
  icon: string;
}

export function App() {
  const [features] = useState<Feature[]>([
    {
      title: 'Fast',
      description: '3kB bundle size with React-compatible API',
      icon: '⚡'
    },
    {
      title: 'Simple',
      description: 'Virtual DOM with automatic re-rendering',
      icon: '🎯'
    },
    {
      title: 'Compatible',
      description: 'Use most React libraries with preact-compat',
      icon: '🔗'
    }
  ]);

  return (
    <div class="app">
      <Header title="${this.context.name}" />

      <main class="main">
        <section class="hero">
          <h1>Welcome to ${this.context.name}</h1>
          <p>Built with Preact - Fast 3kB alternative to React</p>
        </section>

        <section class="features">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
            />
          ))}
        </section>

        <section class="demo">
          <h2>Interactive Counter</h2>
          <Counter initialValue={0} min={0} max={100} />
        </section>

        <section class="demo">
          <h2>Todo List</h2>
          <TodoList />
        </section>
      </main>

      <Footer />
    </div>
  );
}
`;
  }

  private generateIndexCss() {
    return `/**
 * Global Styles
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #673ab8;
  --primary-light: #9c4dcc;
  --primary-dark: #320e86;
  --secondary: #00bcd4;
  --accent: #ff4081;
  --success: #4caf50;
  --warning: #ff9800;
  --error: #f44336;
  --text: #212121;
  --text-secondary: #757575;
  --background: #ffffff;
  --surface: #f5f5f5;
  --border: #e0e0e0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background: var(--surface);
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main {
  flex: 1;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  width: 100%;
}

.hero {
  text-align: center;
  padding: 4rem 0;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: white;
  border-radius: 12px;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.25rem;
  opacity: 0.9;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 3rem;
}

.demo {
  background: var(--background);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 2rem;
}

.demo h2 {
  color: var(--primary);
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .main {
    padding: 1rem;
  }

  .hero h1 {
    font-size: 2rem;
  }

  .features {
    grid-template-columns: 1fr;
  }
}
`;
  }

  private generateHeader() {
    return `import { Link } from 'preact-router';

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header class="header">
      <div class="container">
        <Link href="/" class="logo">
          {title}
        </Link>
        <nav class="nav">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <a href="https://preactjs.com" target="_blank" rel="noopener noreferrer">
            Docs
          </a>
        </nav>
      </div>
    </header>
  );
}
`;
  }

  private generateFooter() {
    return `export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer class="footer">
      <div class="container">
        <p>&copy; {year} ${this.context.name}. Built with Preact.</p>
        <p class="footer-links">
          <a href="https://preactjs.com" target="_blank" rel="noopener noreferrer">
            Preact Docs
          </a>
          <span>•</span>
          <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">
            Vite
          </a>
          <span>•</span>
          <a href="https://typescriptlang.org" target="_blank" rel="noopener noreferrer">
            TypeScript
          </a>
        </p>
      </div>
    </footer>
  );
}
`;
  }

  private generateCounter() {
    return `import { useCounter } from '../hooks/useCounter';

interface CounterProps {
  initialValue?: number;
  min?: number;
  max?: number;
}

export function Counter({ initialValue = 0, min = 0, max = 100 }: CounterProps) {
  const { count, increment, decrement, reset, isAtMin, isAtMax } = useCounter(initialValue, min, max);

  return (
    <div class="counter">
      <div class="counter-display">
        <span class="count">{count}</span>
      </div>

      <div class="counter-controls">
        <button
          onClick={decrement}
          disabled={isAtMin}
          aria-label="Decrement"
          class="btn btn-secondary"
        >
          −
        </button>
        <button
          onClick={reset}
          aria-label="Reset"
          class="btn btn-reset"
        >
          ↺ Reset
        </button>
        <button
          onClick={increment}
          disabled={isAtMax}
          aria-label="Increment"
          class="btn btn-primary"
        >
          +
        </button>
      </div>

      <div class="counter-info">
        <span>Min: {min}</span>
        <span>Max: {max}</span>
      </div>
    </div>
  );
}
`;
  }

  private generateTodoList() {
    return `import { useState, useCallback } from 'preact/hooks';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export function TodoList() {
  const [todos, setTodos] = useLocalStorage<Todo[]>('todos', []);
  const [inputValue, setInputValue] = useState('');

  const addTodo = useCallback(() => {
    if (inputValue.trim()) {
      setTodos([
        ...todos,
        {
          id: Date.now(),
          text: inputValue.trim(),
          completed: false,
        },
      ]);
      setInputValue('');
    }
  }, [inputValue, todos, setTodos]);

  const toggleTodo = useCallback((id: number) => {
    setTodos(
      todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, [todos, setTodos]);

  const deleteTodo = useCallback((id: number) => {
    setTodos(todos.filter(todo => todo.id !== id));
  }, [todos, setTodos]);

  const completedCount = todos.filter(todo => todo.completed).length;

  return (
    <div class="todo-list">
      <div class="todo-input">
        <input
          type="text"
          value={inputValue}
          onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
          onKeyPress={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a new todo..."
        />
        <button onClick={addTodo} class="btn btn-primary">
          Add
        </button>
      </div>

      <ul class="todo-items">
        {todos.map(todo => (
          <li key={todo.id} class={\`todo-item \${todo.completed ? 'completed' : ''}\`}>
            <input
              type="checkbox"
              checked={todo.completed}
              onChange={ => toggleTodo(todo.id)}
            />
            <span class="todo-text">{todo.text}</span>
            <button
              onClick={ => deleteTodo(todo.id)}
              class="btn btn-danger btn-sm"
              aria-label="Delete todo"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {todos.length > 0 && (
        <div class="todo-stats">
          <span>{completedCount} of {todos.length} completed</span>
        </div>
      )}
    </div>
  );
}
`;
  }

  private generateFeatureCard() {
    return `import './FeatureCard.css';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div class="feature-card">
      <div class="feature-icon">{icon}</div>
      <h3 class="feature-title">{title}</h3>
      <p class="feature-description">{description}</p>
    </div>
  );
}
`;
  }

  private generateUseCounterHook() {
    return `import { useState, useCallback, useMemo } from 'preact/hooks';

export function useCounter(initialValue: number = 0, min: number = 0, max: number = 100) {
  const [count, setCount] = useState<number>(initialValue);

  const increment = useCallback(() => {
    setCount(prev => (prev < max ? prev + 1 : prev));
  }, [max]);

  const decrement = useCallback(() => {
    setCount(prev => (prev > min ? prev - 1 : prev));
  }, [min]);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  const isAtMin = useMemo(() => count <= min, [count, min]);
  const isAtMax = useMemo(() => count >= max, [count, max]);

  return {
    count,
    increment,
    decrement,
    reset,
    isAtMin,
    isAtMax,
  };
}
`;
  }

  private generateUseLocalStorageHook() {
    return `import { useState, useEffect } from 'preact/hooks';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(\`Error reading localStorage key "\${key}":\`, error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (error) {
      console.error(\`Error setting localStorage key "\${key}":\`, error);
    }
  };

  return [storedValue, setValue];
}
`;
  }

  private generateFormatUtils() {
    return `/**
 * Format utilities
 */

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date: Date): string {
  return \`\${formatDate(date)} at \${formatTime(date)}\`;
}

export function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}
`;
  }

  private generateTypes() {
    return `/**
 * Global type definitions
 */

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface CounterState {
  count: number;
  min: number;
  max: number;
}

export interface Feature {
  title: string;
  description: string;
  icon: string;
}
`;
  }

  protected generateReadme(): string {
    return `# ${this.context.name}

A Preact application built with Vite, TypeScript, and modern tooling.

## Overview

This template provides a fast, lightweight Preact application with React-compatible API, TypeScript support, and modern development tooling.

## Features

- ⚡ **Fast** - 3kB bundle size (vs 40kB for React)
- 🔗 **Compatible** - Use most React libraries with preact-compat
- 📘 **TypeScript** - Full type safety and excellent DX
- 🎯 **Hooks** - Modern React-like hooks API
- 🔧 **Vite** - Lightning-fast HMR and optimized builds
- 📦 **Small** - Minimal bundle size for faster page loads

## Getting Started

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
# Start dev server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── src/
│   ├── components/      # Reusable components
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript types
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
└── package.json
\`\`\`

## Custom Hooks

### useCounter

Counter with min/max constraints.

\`\`\`tsx
import { useCounter } from '@hooks/useCounter';

function MyComponent() {
  const { count, increment, decrement, reset } = useCounter(0, 0, 100);

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
\`\`\`

### useLocalStorage

Persist state to localStorage.

\`\`\`tsx
import { useLocalStorage } from '@hooks/useLocalStorage';

function MyComponent() {
  const [name, setName] = useLocalStorage('name', '');

  return (
    <input
      value={name}
      onInput={(e) => setName((e.target as HTMLInputElement).value)}
    />
  );
}
\`\`\`

## Components

### Counter

Interactive counter with min/max bounds.

### TodoList

Todo list with localStorage persistence.

### FeatureCard

Reusable feature display card.

## Preact vs React

Preact provides the same modern API as React but with:

- **Smaller bundle**: 3kB vs 40kB
- **Faster rendering**: Optimized virtual DOM
- **Less memory**: Lower memory footprint
- **Same API**: Drop-in replacement for most cases

For React compatibility:

\`\`\`bash
npm install preact-compat
\`\`\`

Then update your imports:

\`\`\`tsx
import { render } from 'preact';
import { h } from 'preact';
import React from 'preact/compat';
\`\`\`

## Vite Configuration

The template includes:

- Path aliases (@, @components, @hooks, etc.)
- Preset for Preact JSX
- Development server configuration
- Build optimization

## TypeScript

Full TypeScript support with:

- Strict mode enabled
- Path aliases configured
- Type checking for all files

## Docker

Build and run with Docker:

\`\`\`bash
# Build image
docker build -t ${this.context.normalizedName} .

# Run container
docker-compose up

# Access at http://localhost:80
\`\`\`

## Resources

- [Preact Documentation](https://preactjs.com/)
- [Preact Guide](https://preactjs.com/guide/)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

MIT
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Preact

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Install a simple HTTP server
RUN npm install -g serve

EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "80"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "80:80"
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
build/

# Logs
logs/
*.log
npm-debug.log*

# Editor directories and files
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
`;
  }
}
