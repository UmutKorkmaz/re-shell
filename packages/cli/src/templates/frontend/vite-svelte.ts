import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class ViteSvelteTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript, normalizedName, name } = this.context;

    // Package.json with Vite and Svelte
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Vite config with Svelte plugin
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig()
    });

    // Svelte config
    files.push({
      path: 'svelte.config.js',
      content: this.generateSvelteConfig()
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

    // Vite PWA plugin config (optional enhancement)
    files.push({
      path: 'vite-plugin-pwa.ts',
      content: this.generatePWAPlugin()
    });

    // Main entry
    files.push({
      path: 'src/main.ts',
      content: this.generateMain()
    });

    // App component with enhanced Vite HMR
    files.push({
      path: 'src/App.svelte',
      content: this.generateApp()
    });

    // Vite-specific HMR component
    files.push({
      path: 'src/components/HMR.svelte',
      content: this.generateHMRComponent()
    });

    // Counter with Vite HMR
    files.push({
      path: 'src/components/Counter.svelte',
      content: this.generateCounter()
    });

    // Stores using Svelte stores with Vite
    files.push({
      path: 'src/stores/counter.ts',
      content: this.generateCounterStore()
    });

    // Types
    files.push({
      path: 'src/types/index.ts',
      content: this.generateTypes()
    });

    // Vite environment files
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // HTML with Vite HMR overlay
    files.push({
      path: 'index.html',
      content: this.generateHtml()
    });

    // Vitest config for Vite testing
    files.push({
      path: 'vitest.config.ts',
      content: this.generateVitestConfig()
    });

    // Test file
    files.push({
      path: 'src/App.test.ts',
      content: this.generateAppTest()
    });

    // Playwright config for E2E
    files.push({
      path: 'playwright.config.ts',
      content: this.generatePlaywrightConfig()
    });

    // CSS with Vite-specific features
    files.push({
      path: 'src/app.css',
      content: this.generateAppCss()
    });

    // Docker
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    files.push({
      path: '.dockerignore',
      content: this.generateDockerIgnore()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Git ignore
    files.push({
      path: '.gitignore',
      content: this.generateGitIgnore()
    });

    return files;
  }

  protected generatePackageJson() {
    const { normalizedName } = this.context;
    return {
      name: normalizedName,
      version: '0.0.1',
      type: 'module',
      scripts: {
        'dev': 'vite',
        'build': 'vite build',
        'preview': 'vite preview',
        'test': 'vitest',
        'test:ui': 'vitest --ui',
        'test:e2e': 'playwright test',
        'check': 'svelte-check --tsconfig ./tsconfig.json',
        'check:watch': 'svelte-check --tsconfig ./tsconfig.json --watch',
        'lint': 'eslint .',
        'format': 'prettier --write .'
      },
      devDependencies: {
        '@sveltejs/vite-plugin-svelte': '^3.0.0',
        '@sveltejs/vite-plugin-svelte-inspector': '^2.0.0',
        '@playwright/test': '^1.40.0',
        '@tsconfig/svelte': '^5.0.0',
        '@types/node': '^20.10.0',
        '@typescript-eslint/eslint-plugin': '^6.0.0',
        '@typescript-eslint/parser': '^6.0.0',
        '@vitest/ui': '^1.0.0',
        'eslint': '^8.50.0',
        'eslint-config-prettier': '^9.0.0',
        'eslint-plugin-svelte': '^2.35.0',
        'prettier': '^3.0.0',
        'prettier-plugin-svelte': '^3.0.0',
        'svelte': '^4.0.0',
        'svelte-check': '^3.5.0',
        'tslib': '^2.6.0',
        'typescript': '^5.3.0',
        'vite': '^5.0.0',
        'vitest': '^1.0.0'
      },
      dependencies: {
        'svelte-navigator': '^4.0.0'
      }
    };
  }

  protected generateViteConfig() {
    const { port } = this.context;
    return `import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { inspector } from '@sveltejs/vite-plugin-svelte-inspector';

export default defineConfig({
  plugins: [
    svelte({
      inspector: true,
      onwarn: (warning, handler) => {
        // Ignore certain warnings
        if (warning.code === 'a11y-no-onchange') return;
        handler(warning);
      }
    }),
    inspector({
      // Toggle inspector with Ctrl+Shift+I (or Cmd+Shift+I)
      toggleKeyCombo: 'control-shift',
      holdMode: true,
      showToggleButton: 'always'
    })
  ],

  // Vite server configuration with enhanced HMR
  server: {
    port: ${port || 5173},
    strictPort: false,
    host: true,
    hmr: {
      overlay: true,
      protocol: 'ws',
      host: 'localhost'
    },
    watch: {
      usePolling: true // Better HMR in Docker
    }
  },

  // Build optimization
  build: {
    target: 'esnext',
    polyfillModulePreload: true,
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['svelte', 'svelte-navigator'],
          'utils': ['./src/stores/counter.ts']
        }
      }
    }
  },

  // Preview server
  preview: {
    port: 4173,
    host: true
  },

  // Dependencies optimization
  optimizeDeps: {
    include: ['svelte', 'svelte-navigator']
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': '/src',
      '$lib': '/src/lib',
      '$components': '/src/components'
    }
  }
});
`;
  }

  private generateSvelteConfig() {
    return `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),

  // Compiler options for better HMR
  compilerOptions: {
    enableSourcemap: true,
    dev: true
  },

  // Vite-specific options
  vitePlugin: {
    // Enable inspector in dev mode
    inspector: true,

    // Dynamic code options
    dynamicCompileOptions: ({ filename }) => {
      if (filename.includes('.test.')) {
        return {
          css: 'injected',
          hydratable: false
        };
      }
      return {};
    }
  }
};
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      extends: './tsconfig.node.json',
      compilerOptions: {
        target: 'ESNext',
        useDefineForClassFields: true,
        module: 'ESNext',
        resolveJsonModule: true,
        allowJs: true,
        checkJs: true,
        isolatedModules: true,
        moduleDetection: 'force',
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        types: ['vite/client', 'vitest/globals']
      },
      include: ['src/**/*.ts', 'src/**/*.svelte'],
      references: [{ path: './tsconfig.node.json' }]
    }, null, 2);
  }

  protected generateTsConfigNode() {
    return JSON.stringify({
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
        strict: true
      },
      include: ['vite.config.ts', 'vitest.config.ts', 'playwright.config.ts']
    }, null, 2);
  }

  private generatePWAPlugin() {
    return `// PWA plugin configuration (optional)
// Uncomment to enable PWA features

/*
import { VitePWA } from 'vite-plugin-pwa';

export const pwaPlugin = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'robots.txt'],
  manifest: {
    name: '${this.context.name}',
    short_name: '${this.context.name}',
    description: 'Vite + Svelte application',
    theme_color: '#ffffff',
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    runtimeCaching: [
      {
        urlPattern: /^https://api\\.example\\.com\\/.*$/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: {
            maxEntries: 10,
            maxAgeSeconds: 60 * 60 * 24 // 24 hours
          }
        }
      }
    ]
  }
});
*/
`;
  }

  private generateMain() {
    return `import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, {
  target: document.body,
  props: {
    name: 'world'
  }
});

export default app;

// Enable HMR
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    app.$destroy();
  });
}
`;
  }

  private generateApp() {
    return `<script lang="ts">
  import { onMount } from 'svelte';
  import Counter from './components/Counter.svelte';
  import { count } from './stores/counter';
  import type { CounterState } from './types';

  let name = '${this.context.name}';
  let version = '1.0.0';

  // Reactive statement
  $: greeting = \`Hello, \${name}!\`;
  $: enhancedCount = $count * 2;

  // Lifecycle
  onMount(() => {
    console.log('App mounted with Vite HMR!');

    // Listen for microfrontend events
    window.addEventListener('counter-update', handleCounterUpdate);

    return () => {
      window.removeEventListener('counter-update', handleCounterUpdate);
    };
  });

  function handleCounterUpdate(event: CustomEvent<CounterState>) {
    if (event.detail.type === 'COUNTER_UPDATE') {
      console.log('Received counter update:', event.detail.value);
    }
  }

  function emitCounterUpdate(value: number) {
    window.dispatchEvent(new CustomEvent<CounterState>('counter-update', {
      detail: { type: 'COUNTER_UPDATE', value }
    }));
  }
</script>

<div class="app">
  <header class="header">
    <h1>{greeting}</h1>
    <p class="version">v{version}</p>
  </header>

  <main class="main">
    <div class="hero">
      <h2>Vite + Svelte with Enhanced HMR</h2>
      <p>
        Blazing-fast development with Vite's Hot Module Replacement and
        Svelte's reactivity.
      </p>
    </div>

    <section class="features">
      <div class="feature-card">
        <span class="feature-icon">⚡</span>
        <h3>Vite HMR</h3>
        <p>Instant hot reload with state preservation</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🔥</span>
        <h3>Svelte Inspector</h3>
        <p>Debug components visually in browser</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🎯</span>
        <h3>TypeScript</h3>
        <p>Full type safety across your app</p>
      </div>
    </section>

    <section class="counter-section">
      <h2>Reactive Counter</h2>
      <p>Current count: <strong class="count">{count}</strong></p>
      <p>Enhanced count: <strong class="count">{enhancedCount}</strong></p>
      <Counter on:update={(e) => emitCounterUpdate(e.detail)} />
    </section>

    <section class="hmr-info">
      <h3>💡 Vite HMR Features</h3>
      <ul>
        <li>Edit .svelte files and see changes instantly</li>
        <li>State is preserved during HMR updates</li>
        <li>Use Ctrl+Shift+I to toggle Svelte Inspector</li>
        <li>TypeScript errors shown in browser overlay</li>
      </ul>
    </section>
  </main>

  <footer class="footer">
    <p>
      Built with <a href="https://vitejs.dev" target="_blank">Vite</a> +
      <a href="https://svelte.dev" target="_blank">Svelte</a>
    </p>
  </footer>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    background: linear-gradient(135deg, #ff3e00 0%, #ff6b3d 100%);
    color: white;
    padding: 2rem;
    text-align: center;
  }

  .header h1 {
    margin: 0;
    font-size: 2.5rem;
  }

  .version {
    opacity: 0.9;
    margin-top: 0.5rem;
  }

  .main {
    flex: 1;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .hero {
    text-align: center;
    padding: 3rem 1rem;
    margin-bottom: 3rem;
  }

  .hero h2 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    color: #ff3e00;
  }

  .hero p {
    font-size: 1.2rem;
    color: #666;
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

  .feature-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .counter-section {
    text-align: center;
    padding: 2rem;
    background: #f9f9f9;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .count {
    color: #ff3e00;
    font-size: 1.5rem;
  }

  .hmr-info {
    background: #fff3cd;
    padding: 1.5rem;
    border-radius: 8px;
    border-left: 4px solid #ffc107;
  }

  .hmr-info h3 {
    margin-top: 0;
    color: #856404;
  }

  .hmr-info ul {
    text-align: left;
  }

  .footer {
    background: #333;
    color: white;
    padding: 2rem;
    text-align: center;
  }

  .footer a {
    color: #ff3e00;
    text-decoration: none;
  }

  .footer a:hover {
    text-decoration: underline;
  }
</style>
`;
  }

  private generateHMRComponent() {
    return `<script lang="ts">
  import { onMount } from 'svelte';

  export let hmrEnabled = import.meta.env.DEV;

  let hmrStatus = 'connected';

  onMount(() => {
    if (import.meta.hot) {
      import.meta.hot.on('vite:afterUpdate', (event) => {
        hmrStatus = 'updated';
        setTimeout(() => {
          hmrStatus = 'connected';
        }, 1000);
      });

      import.meta.hot.on('vite:error', (event) => {
        hmrStatus = 'error';
      });
    }
  });
</script>

<div class="hmr-status" class:enabled={hmrEnabled}>
  <span class="status-dot" class:connected={hmrStatus === 'connected'}
                           class:updated={hmrStatus === 'updated'}
                           class:error={hmrStatus === 'error'}></span>
  <span class="status-text">HMR: {hmrStatus}</span>
</div>

<style>
  .hmr-status {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    padding: 0.5rem 1rem;
    background: #333;
    color: white;
    border-radius: 4px;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 9999;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #666;
  }

  .status-dot.connected {
    background: #4ade80;
    animation: pulse 2s infinite;
  }

  .status-dot.updated {
    background: #fbbf24;
  }

  .status-dot.error {
    background: #f87171;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
`;
  }

  private generateCounter() {
    return `<script lang="ts">
  import { count, increment, decrement } from '../stores/counter';

  function handleIncrement() {
    increment();
    dispatchEvent();
  }

  function handleDecrement() {
    decrement();
    dispatchEvent();
  }

  function dispatchEvent() {
    dispatch(new CustomEvent('update', {
      detail: $count
    }));
  }
</script>

<div class="counter">
  <button on:click={handleDecrement} aria-label="Decrement counter">-</button>
  <span class="count">{$count}</span>
  <button on:click={handleIncrement} aria-label="Increment counter">+</button>
</div>

<style>
  .counter {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    justify-content: center;
    margin: 2rem 0;
  }

  .counter button {
    width: 50px;
    height: 50px;
    border: none;
    background: #ff3e00;
    color: white;
    font-size: 1.5rem;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
  }

  .counter button:hover {
    background: #e63900;
    transform: scale(1.1);
  }

  .counter button:active {
    transform: scale(0.95);
  }

  .count {
    font-size: 2rem;
    font-weight: bold;
    min-width: 60px;
    text-align: center;
  }
</style>
`;
  }

  private generateCounterStore() {
    return `import { writable, derived, get } from 'svelte/store';

// Writable store
export const count = writable(0, () => {
  console.log('counter store initialized');
  return () => console.log('counter store cleanup');
});

// Actions
export function increment() {
  count.update((n) => n + 1);
}

export function decrement() {
  count.update((n) => n - 1);
}

export function reset() {
  count.set(0);
}

// Derived store
export const doubledCount = derived(count, ($count) => $count * 2);

// Store with history
export const countHistory = writable<number[]>([]);

// Subscribe to count changes and update history
count.subscribe((value) => {
  const history = get(countHistory);
  countHistory.set([...history, value].slice(-10)); // Keep last 10
});
`;
  }

  private generateTypes() {
    return `export interface CounterState {
  type: 'COUNTER_UPDATE';
  value: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AppProps {
  name: string;
  version?: string;
}
`;
  }

  private generateEnvExample() {
    const { port } = this.context;
    return `# Vite environment variables
# Copy this file to .env.local

VITE_PORT=${port || 5173}
VITE_API_URL=http://localhost:8000/api

# Feature flags
VITE_ENABLE_INSPECTOR=true
VITE_ENABLE_HMR_OVERLAY=true
`;
  }

  private generateHtml() {
    const { name } = this.context;
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <meta name="description" content="Vite + Svelte application with enhanced HMR" />
  </head>
  <body>
    <!-- Vite will inject scripts here with HMR support -->
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
  }

  private generateVitestConfig() {
    return `import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.CI })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setup.test.ts'],
    include: ['**/*.{test,spec}.{ts,mts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov']
    }
  }
});
`;
  }

  private generateAppTest() {
    return `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import App from './App.svelte';

describe('App component', () => {
  it('renders greeting', () => {
    render(App, { name: 'Vite' });
    expect(screen.getByText('Hello, Vite!')).toBeInTheDocument();
  });

  it('renders with default props', () => {
    render(App);
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });
});
`;
  }

  private generatePlaywrightConfig() {
    return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
`;
  }

  private generateAppCss() {
    return `/* Vite-specific CSS with HMR support */

@import 'normalize.css';

:root {
  --color-primary: #ff3e00;
  --color-secondary: #ff6b3d;
  --color-background: #ffffff;
  --color-text: #333333;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--font-family);
  color: var(--color-text);
  background: var(--color-background);
}

/* Vite HMR indicator */
.vite-hmr {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.875rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
}

.vite-hmr.visible {
  opacity: 1;
}
`;
  }

  private generateDockerfile() {
    return `# Multi-stage Dockerfile for Vite + Svelte

# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration for SPA
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # SPA fallback
    location / {
        try_files \\$uri \\$uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerIgnore() {
    return `node_modules
npm-debug.log
dist
.env.local
.env.development.local
.env.test.local
.env.production.local
.git
.gitignore
README.md
.DS_Store
.vscode
.idea
coverage
test-results
playwright-report
`;
  }

  protected generateReadme() {
    const { name, description, packageManager } = this.context;
    return `# ${name}

${description || 'Vite + Svelte application with enhanced HMR and TypeScript support'}

## Features

- ⚡ **Vite 5** - Lightning-fast build tool with instant HMR
- 🔥 **Svelte 4** - Reactive framework with compile-time optimizations
- 🎯 **TypeScript** - Full type safety
- 🧪 **Vitest** - Unit testing with Vite's speed
- 🎭 **Playwright** - End-to-end testing
- 🐳 **Docker** - Multi-stage builds
- 🔍 **Svelte Inspector** - Visual component debugging

## Quick Start

\`\`\`bash
# Install dependencies
${packageManager} install

# Start development server with HMR
${packageManager} run dev

# Build for production
${packageManager} run build

# Preview production build
${packageManager} run preview
\`\`\`

## Vite HMR Features

### Hot Module Replacement
- Edit .svelte files and see changes instantly
- Component state is preserved during HMR updates
- CSS changes update without full page reload

### Svelte Inspector
- Press \`Ctrl+Shift+I\` to toggle the inspector
- Click components to inspect their state
- See component hierarchy in real-time

### TypeScript HMR
- Type errors shown in browser overlay
- Auto-restart type checker on file changes

## Testing

\`\`\`bash
# Unit tests with Vitest
${packageManager} run test

# Test UI mode
${packageManager} run test:ui

# E2E tests with Playwright
${packageManager} run test:e2e
\`\`\`

## Docker

\`\`\`bash
# Build Docker image
docker build -t ${name} .

# Run container
docker run -p 80:80 ${name}
\`\`\`

## Vite Configuration

The \`vite.config.ts\` file includes:

- Svelte plugin with inspector enabled
- Optimized dependencies pre-bundling
- Path aliases (\`@\`, \`$lib\`, \`$components\`)
- Development server with HMR overlay
- Build optimization with code splitting

## Svelte Stores

Reactive state management using Svelte stores:

\`\`\`ts
import { count, increment, decrement } from './stores/counter';

// In your component
<script>
  import { count } from './stores/counter';
</script>

<p>Count: {$count}</p>
\`\`\`

## Learn More

- [Vite Documentation](https://vitejs.dev/)
- [Svelte Documentation](https://svelte.dev/)
- [Svelte Inspector](https://github.com/sveltejs/vite-plugin-svelte-inspector)

## License

MIT
`;
  }

  private generateGitIgnore() {
    return `# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Testing
coverage
test-results
playwright-report
playwright/.cache

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
`;
  }
}
