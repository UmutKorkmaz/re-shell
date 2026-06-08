import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class SvelteTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript } = this.context;
    const ext = hasTypeScript ? 'ts' : 'js';
    const configExt = hasTypeScript ? 'ts' : 'js';

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Vite config
    files.push({
      path: `vite.config.${configExt}`,
      content: this.generateViteConfig()
    });

    // Svelte config
    files.push({
      path: 'svelte.config.js',
      content: this.generateSvelteConfig()
    });

    // TypeScript config (if TypeScript)
    if (hasTypeScript) {
      files.push({
        path: 'tsconfig.json',
        content: this.generateTsConfig()
      });
    }

    // ESLint config
    files.push({
      path: '.eslintrc.js',
      content: this.generateEslintConfig()
    });

    // Main entry file
    files.push({
      path: `src/main.${ext}`,
      content: this.generateMainFile()
    });

    // App component
    files.push({
      path: 'src/App.svelte',
      content: this.generateAppComponent()
    });

    // Event bus
    files.push({
      path: `src/eventBus.${ext}`,
      content: this.generateEventBus()
    });

    // HTML file for development
    files.push({
      path: 'public/index.html',
      content: this.generateHtmlFile()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Dockerfile for containerization
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    // Docker Compose for development
    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    // Docker ignore
    files.push({
      path: '.dockerignore',
      content: this.generateDockerIgnore()
    });

    // Environment configuration
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // Nginx configuration for production
    files.push({
      path: 'nginx.conf',
      content: this.generateNginxConfig()
    });

    return files;
  }

  private generateSvelteConfig(): string {
    return `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
};`;
  }

  private generateMainFile(): string {
    const { normalizedName, hasTypeScript } = this.context;
    const componentName = normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1).replace(/-./g, x => x[1].toUpperCase());

    if (hasTypeScript) {
      return `import App from './App.svelte';
import { eventBus } from './eventBus';

// Extend window interface for TypeScript
declare global {
  interface Window {
    ${componentName}: {
      mount: (containerId: string) => void;
      unmount: () => void;
      app?: App;
    };
  }
}

// Entry point for the microfrontend
window.${componentName} = {
  mount: (containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(\`Container element with ID "\${containerId}" not found\`);
      return;
    }

    // Create Svelte app instance
    const app = new App({
      target: container
    });
    
    // Notify shell that microfrontend is loaded
    eventBus.emit('microfrontend:loaded', { id: '${normalizedName}' });
    
    // Store app instance for unmounting
    window.${componentName}.app = app;
  },

  unmount: () => {
    if (window.${componentName}.app) {
      window.${componentName}.app.$destroy();
      eventBus.emit('microfrontend:unloaded', { id: '${normalizedName}' });
    }
  }
};

// For development mode
if (import.meta.env.DEV) {
  const devContainer = document.getElementById('app');
  if (devContainer) {
    window.${componentName}.mount('app');
  }
}`;
    } else {
      return `import App from './App.svelte';
import { eventBus } from './eventBus';

// Entry point for the microfrontend
window.${componentName} = {
  mount: (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(\`Container element with ID "\${containerId}" not found\`);
      return;
    }

    // Create Svelte app instance
    const app = new App({
      target: container
    });
    
    // Notify shell that microfrontend is loaded
    eventBus.emit('microfrontend:loaded', { id: '${normalizedName}' });
    
    // Store app instance for unmounting
    window.${componentName}.app = app;
  },

  unmount: () => {
    if (window.${componentName}.app) {
      window.${componentName}.app.$destroy();
      eventBus.emit('microfrontend:unloaded', { id: '${normalizedName}' });
    }
  }
};

// For development mode
if (import.meta.env.DEV) {
  const devContainer = document.getElementById('app');
  if (devContainer) {
    window.${componentName}.mount('app');
  }
}`;
    }
  }

  private generateAppComponent(): string {
    const { normalizedName, name, hasTypeScript } = this.context;
    const scriptLang = hasTypeScript ? ' lang="ts"' : '';

    return `<script${scriptLang}>
  // Component logic here
</script>

<div class="${normalizedName}-app">
  <header class="${normalizedName}-header">
    <h1>${name}</h1>
    <p>A Svelte microfrontend built with Re-Shell CLI</p>
  </header>
  <main class="${normalizedName}-main">
    <section class="${normalizedName}-content">
      <h2>Welcome to ${name}</h2>
      <p>This microfrontend is ready for development!</p>
      <div class="${normalizedName}-features">
        <div class="feature-card">
          <h3>🚀 Fast Development</h3>
          <p>Hot module replacement and fast refresh</p>
        </div>
        <div class="feature-card">
          <h3>📦 Modular Architecture</h3>
          <p>Independent deployment and development</p>
        </div>
        <div class="feature-card">
          <h3>${hasTypeScript ? '🔧 TypeScript Support' : '⚡ Modern Tooling'}</h3>
          <p>${hasTypeScript ? 'Type-safe development experience' : 'Vite-powered build system'}</p>
        </div>
      </div>
    </section>
  </main>
</div>

<style>
  .${normalizedName}-app {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .${normalizedName}-header {
    text-align: center;
    margin-bottom: 40px;
    padding: 20px;
    background: linear-gradient(135deg, #ff3e00 0%, #ff8a00 100%);
    color: white;
    border-radius: 8px;
  }

  .${normalizedName}-header h1 {
    margin: 0 0 10px 0;
    font-size: 2.5rem;
    font-weight: 600;
  }

  .${normalizedName}-header p {
    margin: 0;
    font-size: 1.1rem;
    opacity: 0.9;
  }

  .${normalizedName}-main {
    margin-top: 20px;
  }

  .${normalizedName}-content h2 {
    color: #333;
    margin-bottom: 20px;
    font-size: 2rem;
    text-align: center;
  }

  .${normalizedName}-content > p {
    text-align: center;
    font-size: 1.1rem;
    color: #666;
    margin-bottom: 40px;
  }

  .${normalizedName}-features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 30px;
  }

  .feature-card {
    background: #f8f9fa;
    padding: 30px;
    border-radius: 8px;
    border: 1px solid #e9ecef;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .feature-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .feature-card h3 {
    margin: 0 0 15px 0;
    color: #495057;
    font-size: 1.3rem;
  }

  .feature-card p {
    margin: 0;
    color: #6c757d;
    line-height: 1.6;
  }

  @media (max-width: 768px) {
    .${normalizedName}-app {
      padding: 10px;
    }
    
    .${normalizedName}-header h1 {
      font-size: 2rem;
    }
    
    .${normalizedName}-features {
      grid-template-columns: 1fr;
    }
  }
</style>`;
  }

  private generateEventBus(): string {
    const { hasTypeScript } = this.context;

    if (hasTypeScript) {
      return `// Simple event bus for microfrontend communication
interface EventBusEvents {
  'microfrontend:loaded': { id: string };
  'microfrontend:unloaded': { id: string };
  [key: string]: any;
}

type EventCallback<T = any> = (data: T) => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  emit<K extends keyof EventBusEvents>(event: K, data: EventBusEvents[K]): void {
    const callbacks = this.events.get(event as string);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  on<K extends keyof EventBusEvents>(event: K, callback: EventCallback<EventBusEvents[K]>): void {
    if (!this.events.has(event as string)) {
      this.events.set(event as string, []);
    }
    this.events.get(event as string)!.push(callback);
  }

  off<K extends keyof EventBusEvents>(event: K, callback: EventCallback<EventBusEvents[K]>): void {
    const callbacks = this.events.get(event as string);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
}

export const eventBus = new EventBus();`;
    } else {
      return `// Simple event bus for microfrontend communication
class EventBus {
  constructor() {
    this.events = new Map();
  }

  emit(event, data) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  on(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
}

export const eventBus = new EventBus();`;
    }
  }

  private generateHtmlFile(): string {
    const { name } = this.context;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - Re-Shell Microfrontend</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.${this.context.hasTypeScript ? 'ts' : 'js'}"></script>
</body>
</html>`;
  }

  private generateDockerfile(): string {
    return `# Multi-stage build for Svelte microfrontend
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]`;
  }

  private generateDockerCompose(): string {
    const { normalizedName, name } = this.context;
    const port = 3002;
    
    return `services:
  ${normalizedName}:
    build: .
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=development
      - VITE_API_URL=http://localhost:8000
      - VITE_APP_NAME=${name}
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev -- --host 0.0.0.0 --port ${port}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${port}"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s`;
  }

  private generateDockerIgnore(): string {
    return `node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
.env
.nyc_output
coverage
.idea
.vscode
.DS_Store
dist
build`;
  }

  private generateEnvExample(): string {
    const { normalizedName, name } = this.context;
    
    return `# Application Configuration
VITE_APP_NAME=${name}
VITE_APP_VERSION=1.0.0

# API Configuration
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=5000

# Microfrontend Configuration
VITE_MF_ID=${normalizedName}
VITE_MF_PORT=3002

# Environment
NODE_ENV=development

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_MONITORING=false`;
  }

  private generateNginxConfig(): string {
    return `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Handle SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }

    # Disable access to hidden files
    location ~ /\\. {
        deny all;
    }
}`;
  }
}
