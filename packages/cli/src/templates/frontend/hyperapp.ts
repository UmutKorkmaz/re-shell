import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class HyperappTemplate extends BaseTemplate {
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
      path: 'src/App.ts',
      content: this.generateApp()
    });

    // Styles
    files.push({
      path: 'src/styles.css',
      content: this.generateStyles()
    });

    // Components
    files.push({
      path: 'src/components/Header.ts',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/components/Footer.ts',
      content: this.generateFooter()
    });

    files.push({
      path: 'src/components/Counter.ts',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/components/TodoList.ts',
      content: this.generateTodoList()
    });

    files.push({
      path: 'src/components/FeatureCard.ts',
      content: this.generateFeatureCard()
    });

    // Actions
    files.push({
      path: 'src/actions/index.ts',
      content: this.generateActions()
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
      description: `${this.context.name} - Hyperapp Application`,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        test: 'echo "No tests configured" && exit 0'
      },
      dependencies: {
        'hyperapp': '^2.0.22',
        '@hyperapp/router': '^2.1.0'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        'typescript': '^5.3.3',
        'vite': '^5.0.12',
        'vite-plugin-hyperapp': '^0.6.0'
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
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
        paths: {
          '@/*': ['./src/*'],
          '@components/*': ['./src/components/*'],
          '@actions/*': ['./src/actions/*'],
          '@utils/*': ['./src/utils/*'],
          '@types/*': ['./src/types/*']
        }
      },
      include: ['src']
    }, null, 2);
  }

  protected generateViteConfig(): string {
    return `import { defineConfig } from 'vite';
import hyperapp from 'vite-plugin-hyperapp';
import path from 'path';

export default defineConfig({
  plugins: [hyperapp()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@actions': path.resolve(__dirname, './src/actions'),
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
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
  }

  private generateMain() {
    return `import { app } from 'hyperapp';
import { main } from './App';

app({
  init: () => ({
    count: 0,
    todos: [],
    inputValue: '',
    route: '/'
  }),
  view: main,
  node: document.getElementById('app')!
});
`;
  }

  private generateApp() {
    return `import { h, text } from 'hyperapp';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Counter } from './components/Counter';
import { TodoList } from './components/TodoList';
import { FeatureCard } from './components/FeatureCard';
import './styles.css';

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface State {
  count: number;
  todos: Array<{ id: number; text: string; completed: boolean }>;
  inputValue: string;
  route: string;
}

export const main = (state: State) => {
  const features: Feature[] = [
    {
      title: 'Functional',
      description: 'Pure functions and immutable state',
      icon: 'λ'
    },
    {
      title: 'Simple',
      description: 'Minimal API, easy to learn',
      icon: '🎯'
    },
    {
      title: 'Fast',
      description: 'Tiny bundle, fast execution',
      icon: '⚡'
    }
  ];

  return h('div', { class: 'app' }, [
    Header({ title: '${this.context.name}' }),

    h('main', { class: 'main' }, [
      h('section', { class: 'hero' }, [
        h('h1', {}, text('Welcome to ${this.context.name}')),
        h('p', {}, text('Built with Hyperapp - A functional JavaScript framework'))
      ]),

      h('section', { class: 'features' },
        features.map((feature, index) =>
          FeatureCard({
            key: index.toString(),
            title: feature.title,
            description: feature.description,
            icon: feature.icon
          })
        )
      ),

      h('section', { class: 'demo' }, [
        h('h2', {}, text('Interactive Counter')),
        Counter({
          value: state.count,
          onIncrement: () => ({ count: state.count + 1 }),
          onDecrement: () => ({ count: state.count - 1 }),
          onReset: () => ({ count: 0 })
        })
      ]),

      h('section', { class: 'demo' }, [
        h('h2', {}, text('Todo List')),
        TodoList({
          todos: state.todos,
          inputValue: state.inputValue,
          onAdd: () => {
            if (state.inputValue.trim()) {
              return {
                todos: [...state.todos, {
                  id: Date.now(),
                  text: state.inputValue.trim(),
                  completed: false
                }],
                inputValue: ''
              };
            }
            return {};
          },
          onToggle: (id: number) => ({
            todos: state.todos.map(todo =>
              todo.id === id ? { ...todo, completed: !todo.completed } : todo
            )
          }),
          onDelete: (id: number) => ({
            todos: state.todos.filter(todo => todo.id !== id)
          }),
          onInput: (value: string) => ({ inputValue: value })
        })
      ])
    ]),

    Footer()
  ]);
};
`;
  }

  private generateStyles() {
    return `/**
 * Global Styles
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #e91e63;
  --primary-light: #f48fb1;
  --primary-dark: #c2185b;
  --secondary: #00bcd4;
  --accent: #ff9800;
  --success: #4caf50;
  --warning: #ff9800;
  --error: #f44336;
  --text: #212121;
  --text-secondary: #757575;
  --background: #ffffff;
  --surface: #fafafa;
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
    return `import { h, text } from 'hyperapp';

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  return h('header', { class: 'header' }, [
    h('div', { class: 'container' }, [
      h('a', { class: 'logo', href: '#!/' }, text(title)),
      h('nav', { class: 'nav' }, [
        h('a', { href: '#!/' }, text('Home')),
        h('a', { href: '#!/about' }, text('About')),
        h('a', {
          href: 'https://hyperapp.dev',
          target: '_blank',
          rel: 'noopener noreferrer'
        }, text('Docs'))
      ])
    ])
  ]);
};
`;
  }

  private generateFooter() {
    return `import { h, text } from 'hyperapp';

export const Footer = () => {
  const year = new Date().getFullYear();

  return h('footer', { class: 'footer' }, [
    h('div', { class: 'container' }, [
      h('p', {}, text(\`© \${year} ${this.context.name}. Built with Hyperapp.\`)),
      h('p', { class: 'footer-links' }, [
        h('a', {
          href: 'https://hyperapp.dev',
          target: '_blank',
          rel: 'noopener noreferrer'
        }, text('Hyperapp Docs')),
        h('span', {}, text('•')),
        h('a', {
          href: 'https://vitejs.dev',
          target: '_blank',
          rel: 'noopener noreferrer'
        }, text('Vite')),
        h('span', {}, text('•')),
        h('a', {
          href: 'https://typescriptlang.org',
          target: '_blank',
          rel: 'noopener noreferrer'
        }, text('TypeScript'))
      ])
    ])
  ]);
};
`;
  }

  private generateCounter() {
    return `import { h, text } from 'hyperapp';

interface CounterProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onReset: () => void;
}

export const Counter = ({ value, onIncrement, onDecrement, onReset }: CounterProps) => {
  return h('div', { class: 'counter' }, [
    h('div', { class: 'counter-display' }, [
      h('span', { class: 'count' }, text(value.toString()))
    ]),

    h('div', { class: 'counter-controls' }, [
      h('button', {
        class: 'btn btn-secondary',
        disabled: value <= 0,
        'aria-label': 'Decrement',
        onclick: onDecrement
      }, text('−')),

      h('button', {
        class: 'btn btn-reset',
        'aria-label': 'Reset',
        onclick: onReset
      }, text('↺ Reset')),

      h('button', {
        class: 'btn btn-primary',
        disabled: value >= 100,
        'aria-label': 'Increment',
        onclick: onIncrement
      }, text('+'))
    ]),

    h('div', { class: 'counter-info' }, [
      h('span', {}, text('Min: 0')),
      h('span', {}, text('Max: 100'))
    ])
  ]);
};
`;
  }

  private generateTodoList() {
    return `import { h, text } from 'hyperapp';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface TodoListProps {
  todos: Todo[];
  inputValue: string;
  onAdd: () => any;
  onToggle: (id: number) => any;
  onDelete: (id: number) => any;
  onInput: (value: string) => any;
}

export const TodoList = ({
  todos,
  inputValue,
  onAdd,
  onToggle,
  onDelete,
  onInput
}: TodoListProps) => {
  const completedCount = todos.filter(t => t.completed).length;

  return h('div', { class: 'todo-list' }, [
    h('div', { class: 'todo-input' }, [
      h('input', {
        type: 'text',
        value: inputValue,
        placeholder: 'Add a new todo...',
        oninput: (e: Event) => onInput((e.target as HTMLInputElement).value),
        onkeypress: (e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            onAdd();
          }
        }
      }),
      h('button', {
        class: 'btn btn-primary',
        onclick: onAdd
      }, text('Add'))
    ]),

    h('ul', { class: 'todo-items' },
      todos.map(todo =>
        h('li', {
          class: \`todo-item \${todo.completed ? 'completed' : ''}\`,
          key: todo.id.toString()
        }, [
          h('input', {
            type: 'checkbox',
            checked: todo.completed,
            onchange: () => onToggle(todo.id)
          }),
          h('span', { class: 'todo-text' }, text(todo.text)),
          h('button', {
            class: 'btn btn-danger btn-sm',
            'aria-label': 'Delete todo',
            onclick: () => onDelete(todo.id)
          }, text('×'))
        ])
      )
    ),

    todos.length > 0 && h('div', { class: 'todo-stats' }, [
      h('span', {}, text(\`\${completedCount} of \${todos.length} completed\`))
    ])
  ]);
};
`;
  }

  private generateFeatureCard() {
    return `import { h, text } from 'hyperapp';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: string;
  key?: string;
}

export const FeatureCard = ({ title, description, icon }: FeatureCardProps) => {
  return h('div', { class: 'feature-card' }, [
    h('div', { class: 'feature-icon' }, text(icon)),
    h('h3', { class: 'feature-title' }, text(title)),
    h('p', { class: 'feature-description' }, text(description))
  ]);
};
`;
  }

  private generateActions() {
    return `/**
 * Hyperapp Actions
 * Pure functions that return state updates
 */

import { State } from '../types';

export const actions = {
  // Counter actions
  increment: (state: State) => ({
    ...state,
    count: state.count + 1
  }),

  decrement: (state: State) => ({
    ...state,
    count: state.count - 1
  }),

  reset: (state: State) => ({
    ...state,
    count: 0
  }),

  // Todo actions
  addTodo: (state: State, text: string) => {
    if (!text.trim()) return state;

    return {
      ...state,
      todos: [...state.todos, {
        id: Date.now(),
        text: text.trim(),
        completed: false
      }]
    };
  },

  toggleTodo: (state: State, id: number) => ({
    ...state,
    todos: state.todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    )
  }),

  deleteTodo: (state: State, id: number) => ({
    ...state,
    todos: state.todos.filter(todo => todo.id !== id)
  }),

  updateInput: (state: State, value: string) => ({
    ...state,
    inputValue: value
  })
};
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

export interface State {
  count: number;
  todos: Todo[];
  inputValue: string;
  route: string;
}
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A Hyperapp application built with Vite, TypeScript, and functional programming patterns.

## Overview

This template provides a complete Hyperapp SPA with TypeScript support, functional programming patterns, and immutable state management.

## Features

- λ **Functional** - Pure functions, immutable state, no classes
- ⚡ **Fast** - Tiny bundle (1KB gzipped), fast execution
- 📘 **TypeScript** - Full type safety and excellent DX
- 🎯 **Simple** - Minimal API, easy to learn
- 🔧 **Vite** - Lightning-fast HMR and optimized builds

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

## Hyperapp Basics

Hyperapp uses a simple architecture:

\`\`\`typescript
import { app, h, text } from 'hyperapp';

// State
interface State {
  count: number;
}

// View (pure function)
const view = (state: State) =>
  h('div', {}, [
    h('h1', {}, text(\`Count: \${state.count}\`)),
    h('button', {
      onclick: () => ({ count: state.count + 1 })
    }, text('+'))
  ]);

// App
app({
  init: () => ({ count: 0 }),
  view
  node: document.getElementById('app')!
});
\`\`\`

## Functional Programming Patterns

### Pure Functions

All actions are pure functions:

\`\`\`typescript
// State transition is a pure function
const increment = (state: State) => ({
  ...state,
  count: state.count + 1
});
\`\`\`

### Immutable State

State is never mutated directly:

\`\`\`typescript
// ❌ Bad - mutation
state.count++;

// ✅ Good - immutable update
return { ...state, count: state.count + 1 };
\`\`\`

### Actions as Reducers

Actions take state and return new state:

\`\`\`typescript
const actions = {
  add: (state: State, value: string) => ({
    ...state,
    items: [...state.items, value]
  }),

  remove: (state: State, index: number) => ({
    ...state,
    items: state.items.filter((_, i) => i !== index)
  })
};
\`\`\`

## Components in This Template

### Counter

Stateless counter with functional actions.

### TodoList

Todo list with immutable state updates.

### FeatureCard

Reusable display component.

## Vite Configuration

The template includes:
- Path aliases (@, @components, @actions, etc.)
- vite-plugin-hyperapp for Hyperapp support
- Development server configuration
- Build optimization

## TypeScript

Full TypeScript support with:
- Strict mode enabled
- Path aliases configured
- Type definitions for Hyperapp

## Hyperapp vs Other Frameworks

- **Smaller than Preact**: 1KB vs 3KB
- **Simpler than React**: No hooks, no classes
- **More functional than Vue**: Pure functions throughout
- **Faster than Angular**: No dependency injection

## Functional Programming Benefits

- **Predictable** - Pure functions are easy to test
- **Debuggable** - State changes are explicit
- **Maintainable** - No hidden mutations
- **Performant** - Easy to optimize with memoization

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

- [Hyperapp Documentation](https://hyperapp.dev/)
- [Hyperapp Guide](https://github.com/jorgebucaran/hyperapp#readme)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

MIT
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Hyperapp

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
