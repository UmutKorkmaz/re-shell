import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class MithrilTemplate extends BaseTemplate {
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

    // Models
    files.push({
      path: 'src/models/Todo.ts',
      content: this.generateTodoModel()
    });

    // Routes
    files.push({
      path: 'src/routes.ts',
      content: this.generateRoutes()
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
      description: `${this.context.name} - Mithril.js Application`,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        test: 'echo "No tests configured" && exit 0'
      },
      dependencies: {
        'mithril': '^2.2.2'
      },
      devDependencies: {
        '@types/mithril': '^2.0.12',
        '@types/node': '^20.11.0',
        'typescript': '^5.3.3',
        'vite': '^5.0.12',
        'vite-plugin-mithril': '^2.2.0'
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
          '@models/*': ['./src/models/*'],
          '@utils/*': ['./src/utils/*'],
          '@types/*': ['./src/types/*']
        }
      },
      include: ['src']
    }, null, 2);
  }

  protected generateViteConfig(): string {
    return `import { defineConfig } from 'vite';
import mithril from 'vite-plugin-mithril';
import path from 'path';

export default defineConfig({
  plugins: [mithril()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@models': path.resolve(__dirname, './src/models'),
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
    return `import m, { mount } from 'mithril';
import { routes } from './routes';
import './styles.css';

const root = document.getElementById('app')!;

mount(root, routes);
`;
  }

  private generateApp() {
    return `import m from 'mithril';
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

export const App = {
  view: () => {
    const features: Feature[] = [
      {
        title: 'Fast',
        description: 'Virtual DOM with minimal overhead',
        icon: '⚡'
      },
      {
        title: 'Simple',
        description: 'Small API surface, easy to learn',
        icon: '🎯'
      },
      {
        title: 'Complete',
        description: 'Routing, XHR, and utilities included',
        icon: '📦'
      }
    ];

    return m('div.app', [
      m(Header, { title: '${this.context.name}' }),

      m('main.main', [
        m('section.hero', [
          m('h1', 'Welcome to ${this.context.name}'),
          m('p', 'Built with Mithril.js - A modern JavaScript framework')
        ]),

        m('section.features', features.map((feature, index) =>
          m(FeatureCard, {
            key: index,
            title: feature.title,
            description: feature.description,
            icon: feature.icon
          })
        )),

        m('section.demo', [
          m('h2', 'Interactive Counter'),
          m(Counter, { initialValue: 0, min: 0, max: 100 })
        ]),

        m('section.demo', [
          m('h2', 'Todo List'),
          m(TodoList)
        ])
      ]),

      m(Footer)
    ]);
  }
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
  --primary: #1976d2;
  --primary-light: #42a5f5;
  --primary-dark: #1565c0;
  --secondary: #26a69a;
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
    return `import m from 'mithril';

interface HeaderAttrs {
  title: string;
}

export const Header = {
  view: ({ attrs }: m.Vnode<HeaderAttrs>) => {
    return m('header.header', [
      m('div.container', [
        m('a.logo', { href: '#!/' }, attrs.title),
        m('nav.nav', [
          m('a', { href: '#!/' }, 'Home'),
          m('a', { href: '#!/about' }, 'About'),
          m('a', { href: 'https://mithril.js.org', target: '_blank', rel: 'noopener noreferrer' }, 'Docs')
        ])
      ])
    ]);
  }
};
`;
  }

  private generateFooter() {
    return `import m from 'mithril';

export const Footer = {
  view: () => {
    const year = new Date().getFullYear();

    return m('footer.footer', [
      m('div.container', [
        m('p', \`&copy; \${year} ${this.context.name}. Built with Mithril.js.\`),
        m('p.footer-links', [
          m('a', { href: 'https://mithril.js.org', target: '_blank', rel: 'noopener noreferrer' }, 'Mithril Docs'),
          m('span', '•'),
          m('a', { href: 'https://vitejs.dev', target: '_blank', rel: 'noopener noreferrer' }, 'Vite'),
          m('span', '•'),
          m('a', { href: 'https://typescriptlang.org', target: '_blank', rel: 'noopener noreferrer' }, 'TypeScript')
        ])
      ])
    ]);
  }
};
`;
  }

  private generateCounter() {
    return `import m from 'mithril';

interface CounterAttrs {
  initialValue?: number;
  min?: number;
  max?: number;
}

interface CounterState {
  count: number;
  min: number;
  max: number;
}

export const Counter = {
  count: 0,
  min: 0,
  max: 100,

  oninit: function(this: CounterState & m.Component<CounterAttrs>, vnode: m.Vnode<CounterAttrs>) {
    this.count = vnode.attrs.initialValue || 0;
    this.min = vnode.attrs.min || 0;
    this.max = vnode.attrs.max || 100;
  },

  increment: function(this: CounterState) {
    if (this.count < this.max) {
      this.count++;
      m.redraw();
    }
  },

  decrement: function(this: CounterState) {
    if (this.count > this.min) {
      this.count--;
      m.redraw();
    }
  },

  reset: function(this: CounterState, initialValue: number) {
    this.count = initialValue;
    m.redraw();
  },

  view: function(this: CounterState & { increment: () => void; decrement: () => void; reset: (val: number) => void }, vnode: m.Vnode<CounterAttrs>) {
    const isAtMin = this.count <= this.min;
    const isAtMax = this.count >= this.max;

    return m('div.counter', [
      m('div.counter-display', [
        m('span.count', this.count)
      ]),

      m('div.counter-controls', [
        m('button.btn.btn-secondary', {
          onclick: () => this.decrement(),
          disabled: isAtMin,
          'aria-label': 'Decrement'
        }, '−'),

        m('button.btn.btn-reset', {
          onclick: () => this.reset(vnode.attrs.initialValue || 0),
          'aria-label': 'Reset'
        }, '↺ Reset'),

        m('button.btn.btn-primary', {
          onclick: () => this.increment(),
          disabled: isAtMax,
          'aria-label': 'Increment'
        }, '+')
      ]),

      m('div.counter-info', [
        m('span', \`Min: \${this.min}\`),
        m('span', \`Max: \${this.max}\`)
      ])
    ]);
  }
};
`;
  }

  private generateTodoList() {
    return `import m from 'mithril';
import { Todo } from '../models/Todo';

interface TodoListState {
  todos: Todo[];
  inputValue: string;
}

export const TodoList = {
  todos: [],
  inputValue: '',

  oninit: function(this: TodoListState) {
    const stored = localStorage.getItem('todos');
    if (stored) {
      this.todos = JSON.parse(stored);
    }
  },

  addTodo: function(this: TodoListState) {
    if (this.inputValue.trim()) {
      this.todos.push({
        id: Date.now(),
        text: this.inputValue.trim(),
        completed: false
      });
      this.inputValue = '';
      this.save();
      m.redraw();
    }
  },

  toggleTodo: function(this: TodoListState, id: number) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      this.save();
      m.redraw();
    }
  },

  deleteTodo: function(this: TodoListState, id: number) {
    this.todos = this.todos.filter(t => t.id !== id);
    this.save();
    m.redraw();
  },

  save: function(this: TodoListState) {
    localStorage.setItem('todos', JSON.stringify(this.todos));
  },

  updateInput: function(this: TodoListState, value: string) {
    this.inputValue = value;
  },

  handleKeyPress: function(this: TodoListState, e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.addTodo();
    }
  },

  view: function(this: TodoListState & {
    addTodo: () => void;
    toggleTodo: (id: number) => void;
    deleteTodo: (id: number) => void;
    updateInput: (val: string) => void;
    handleKeyPress: (e: KeyboardEvent) => void;
  }) {
    const completedCount = this.todos.filter(t => t.completed).length;

    return m('div.todo-list', [
      m('div.todo-input', [
        m('input', {
          type: 'text',
          value: this.inputValue,
          oninput: (e: Event) => this.updateInput((e.target as HTMLInputElement).value),
          onkeypress: (e: KeyboardEvent) => this.handleKeyPress(e),
          placeholder: 'Add a new todo...'
        }),
        m('button.btn.btn-primary', {
          onclick: () => this.addTodo()
        }, 'Add')
      ]),

      m('ul.todo-items', this.todos.map(todo =>
        m('li.todo-item', {
          class: todo.completed ? 'completed' : '',
          key: todo.id
        }, [
          m('input[type=checkbox]', {
            checked: todo.completed,
            onchange: () => this.toggleTodo(todo.id)
          }),
          m('span.todo-text', todo.text),
          m('button.btn.btn-danger.btn-sm', {
            onclick: () => this.deleteTodo(todo.id),
            'aria-label': 'Delete todo'
          }, '×')
        ])
      )),

      this.todos.length > 0 && m('div.todo-stats', [
        m('span', \`\${completedCount} of \${this.todos.length} completed\`)
      ])
    ]);
  }
};
`;
  }

  private generateFeatureCard() {
    return `import m from 'mithril';

interface FeatureCardAttrs {
  title: string;
  description: string;
  icon: string;
}

export const FeatureCard = {
  view: ({ attrs }: m.Vnode<FeatureCardAttrs>) => {
    return m('div.feature-card', [
      m('div.feature-icon', attrs.icon),
      m('h3.feature-title', attrs.title),
      m('p.feature-description', attrs.description)
    ]);
  }
};
`;
  }

  private generateTodoModel() {
    return `import m from 'mithril';

export interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

export const TodoModel = {
  list: [] as Todo[],

  getAll: function(): Todo[] {
    return this.list;
  },

  add: function(text: string): Todo {
    const todo: Todo = {
      id: Date.now(),
      text: text,
      completed: false
    };
    this.list.push(todo);
    return todo;
  },

  toggle: function(id: number): void {
    const todo = this.list.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
    }
  },

  remove: function(id: number): void {
    this.list = this.list.filter(t => t.id !== id);
  },

  clear: function(): void {
    this.list = [];
  }
};
`;
  }

  private generateRoutes() {
    return `import m, { RouteDefs } from 'mithril';
import { App } from './App';

export const routes: RouteDefs = {
  '/': App,
  '/about': {
    onmatch: () => {
      return {
        view: () => m('div.about', [
          m('h1', 'About'),
          m('p', 'This is a Mithril.js application built with Vite and TypeScript.')
        ])
      };
    }
  }
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

export interface RouteResolver {
  onmatch?: (args: any, requestedPath: string) => any;
  render?: (vnode: m.Vnode<any, any>) => m.Children;
}
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A Mithril.js application built with Vite, TypeScript, and modern tooling.

## Overview

This template provides a complete Mithril.js SPA with TypeScript support, virtual DOM rendering, built-in routing, and XHR utilities.

## Features

- ⚡ **Fast** - Virtual DOM with minimal overhead
- 📦 **Complete** - Routing, XHR, and utilities included
- 📘 **TypeScript** - Full type safety and excellent DX
- 🎯 **Simple** - Small API surface, easy to learn
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

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── src/
│   ├── components/      # Mithril components
│   ├── models/          # Data models
│   ├── routes.ts        # Route definitions
│   ├── App.ts           # Root component
│   ├── main.ts          # Entry point
│   └── styles.css       # Global styles
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── package.json
\`\`\`

## Mithril.js Components

Components are simple JavaScript objects with a \`view\` method:

\`\`\`typescript
import m from 'mithril';

export const MyComponent = {
  oninit: function(vnode) {
    // Initialize state
    this.count = 0;
  },

  view: function(vnode) {
    return m('div', [
      m('h1', 'Hello, Mithril!'),
      m('p', \`Count: \${this.count}\`),
      m('button', {
        onclick: () => {
          this.count++;
          m.redraw();
        }
      }, 'Increment')
    ]);
  }
};
\`\`\`

## Routing

Mithril includes a powerful router out of the box:

\`\`\`typescript
import m from 'mithril';

const routes = {
  '/': Home,
  '/about': About,
  '/users': {
    onmatch: (args, requestedPath) => {
      // Lazy load component
      return import('./views/Users').then(m => m.default);
    }
  }
};

m.mount(document.getElementById('app'), routes);
\`\`\`

## XHR Requests

Mithril provides a simple XHR utility:

\`\`\`typescript
import m from 'mithril';

// GET request
m.request({
  method: 'GET',
  url: '/api/users'
}).then(users => {
  console.log(users);
});

// POST request
m.request({
  method: 'POST',
  url: '/api/users',
  body: { name: 'John', email: 'john@example.com' }
}).then(response => {
  console.log(response);
});
\`\`\`

## Auto-redraw System

Mithril automatically redraws after:
- XHR requests complete
- Event handlers execute
- \`m.redraw()\` is called

## Components in This Template

### Counter

Interactive counter with min/max bounds and auto-redraw.

### TodoList

Todo list with localStorage persistence.

### FeatureCard

Reusable feature display card.

## Vite Configuration

The template includes:
- Path aliases (@, @components, @models, etc.)
- vite-plugin-mithril for Mithril JSX
- Development server configuration
- Build optimization

## TypeScript

Full TypeScript support with:
- Strict mode enabled
- Path aliases configured
- Type definitions for Mithril

## Mithril vs Other Frameworks

- **Smaller than React**: 8KB vs 40KB
- **Simpler than Vue**: No reactivity system to learn
- **More complete than Preact**: Includes routing and XHR
- **Faster than Angular**: No dependency injection or decorators

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

- [Mithril.js Documentation](https://mithril.js.org/)
- [Mithril.js Guide](https://mithril.js.org/simple-application.html)
- [Vite Documentation](https://vitejs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## License

MIT
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Mithril.js

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
