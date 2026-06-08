import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class SvelteModuleFederationTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript, normalizedName, name, port } = this.context;
    const ext = hasTypeScript ? 'ts' : 'js';

    // Package.json with Module Federation dependencies
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Webpack config with Module Federation
    files.push({
      path: 'webpack.config.js',
      content: this.generateWebpackConfig()
    });

    // Svelte config
    files.push({
      path: 'svelte.config.js',
      content: this.generateSvelteConfig()
    });

    // TypeScript config
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

    // Babel config
    files.push({
      path: '.babelrc.js',
      content: this.generateBabelConfig()
    });

    // HTML file
    files.push({
      path: 'public/index.html',
      content: this.generateHtml()
    });

    // Main entry point
    files.push({
      path: `src/main.${ext}`,
      content: this.generateMain()
    });

    // Bootstrap for Module Federation
    files.push({
      path: `src/bootstrap.${ext}`,
      content: this.generateBootstrap()
    });

    // App component
    files.push({
      path: 'src/App.svelte',
      content: this.generateApp()
    });

    // Counter component for demo
    files.push({
      path: 'src/components/Counter.svelte',
      content: this.generateCounterComponent()
    });

    // Remote component exposed for Module Federation
    files.push({
      path: 'src/components/RemoteComponent.svelte',
      content: this.generateRemoteComponent()
    });

    // Stores using Svelte stores
    files.push({
      path: `src/stores/counter.${ext}`,
      content: this.generateCounterStore()
    });

    // Event bus for microfrontend communication
    files.push({
      path: `src/utils/eventBus.${ext}`,
      content: this.generateEventBus()
    });

    // CSS
    files.push({
      path: 'src/App.css',
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

    // Env example
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    return files;
  }

  protected generatePackageJson() {
    const { normalizedName } = this.context;
    return {
      name: normalizedName,
      version: '1.0.0',
      scripts: {
        'start': 'webpack serve --mode development',
        'build': 'webpack --mode production',
        'serve': 'webpack serve --mode development',
        'lint': 'eslint src --ext .js,.svelte'
      },
      dependencies: {
        'svelte': '^4.0.0',
        'svelte-routing': '^2.0.0'
      },
      devDependencies: {
        '@module-federation/utilities': '^3.0.0',
        '@tsconfig/svelte': '^5.0.0',
        '@types/svelte': '^3.24.0',
        'cross-env': '^7.0.3',
        'css-loader': '^6.8.0',
        'eslint': '^8.56.0',
        'eslint-plugin-svelte': '^2.35.0',
        'html-webpack-plugin': '^5.5.0',
        'mini-css-extract-plugin': '^2.7.0',
        'svelte-loader': '^3.1.0',
        'svelte-preprocess': '^5.1.0',
        'webpack': '^5.89.0',
        'webpack-cli': '^5.1.0',
        'webpack-dev-server': '^4.15.0'
      }
    };
  }

  private generateWebpackConfig() {
    const { normalizedName, port } = this.context;
    const portValue = port || 5173;
    return `const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: 'http://localhost:${portValue}/',
    clean: true
  },

  resolve: {
    alias: {
      svelte: path.dirname(require.resolve('svelte/package.json'))
    },
    extensions: ['.mjs', '.js', '.svelte'],
    mainFields: ['svelte', 'browser', 'module', 'main']
  },

  module: {
    rules: [
      {
        test: /\\.svelte$/,
        use: {
          loader: 'svelte-loader',
          options: {
            compilerOptions: {
              customElement: true
            },
            preprocess: require('svelte-preprocess')()
          }
        }
      },
      {
        test: /\\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      },
      {
        test: /\\.(js|ts)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },

  plugins: [
    new ModuleFederationPlugin({
      name: '${normalizedName}',
      filename: 'remoteEntry.js',
      exposes: {
        './Counter': './src/components/Counter.svelte',
        './RemoteComponent': './src/components/RemoteComponent.svelte'
      },
      remotes: {
        // Configure remote microfrontends here
        // mf1: 'mf1@http://localhost:5174/remoteEntry.js',
      },
      shared: {
        svelte: {
          singleton: true,
          requiredVersion: false
        },
        'svelte-routing': {
          singleton: true,
          requiredVersion: false
        }
      }
    }),
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html'
    }),
    new MiniCssExtractPlugin({
      filename: '[name].[contenthash].css'
    })
  ],

  devServer: {
    static: {
      directory: path.join(__dirname, 'public')
    },
    port: ${portValue},
    hot: true,
    historyApiFallback: true
  },

  optimization: {
    splitChunks: false
  }
};
`;
  }

  private generateSvelteConfig() {
    return `const { preprocess } = require('svelte-preprocess');

module.exports = {
  preprocess: preprocess(),
  compilerOptions: {
    customElement: true
  }
};
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      extends: '@tsconfig/svelte/tsconfig.json',
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
      resolveJsonModule: true,
        allowJs: true,
        checkJs: true,
        isolatedModules: true
      },
      include: ['src/**/*.ts', 'src/**/*.js', 'src/**/*.svelte'],
      references: [{ path: './tsconfig.node.json' }]
    }, null, 2);
  }

  protected generateEslintConfig() {
    return `module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended', 'plugin:svelte/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  overrides: [
    {
      files: ['*.svelte'],
      parser: 'svelte-eslint-parser',
      parserOptions: {
        parser: 'espree'
      }
    }
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
  }
};
`;
  }

  private generateBabelConfig() {
    return `module.exports = {
  presets: ['@babel/preset-env']
};
`;
  }

  private generateHtml() {
    const { name } = this.context;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${name}</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>
`;
  }

  private generateMain() {
    return `import './App.css';

// Bootstrap for Module Federation
import('./bootstrap');
`;
  }

  private generateBootstrap() {
    return `import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, {
  target: document.getElementById('app')
});

// Microfrontend event listeners
window.addEventListener('counter-update', (event) => {
  if (event.detail.type === 'COUNTER_UPDATE') {
    console.log('Counter update received:', event.detail.value);
  }
});

export default app;
`;
  }

  private generateApp() {
    const { port } = this.context;
    const portValue = port || 5173;
    return `<script>
  import Counter from './components/Counter.svelte';
  import { onMount } from 'svelte';

  let message = '';

  onMount(() => {
    const handleCounterUpdate = (event) => {
      if (event.detail.type === 'COUNTER_UPDATE') {
        message = \`Received: \${event.detail.value}\`;
      }
    };

    window.addEventListener('counter-update', handleCounterUpdate);

    return () => {
      window.removeEventListener('counter-update', handleCounterUpdate);
    };
  });
</script>

<div class="app">
  <header class="header">
    <h1>🚀 Svelte Module Federation Microfrontend</h1>
    <p>A powerful microfrontend architecture with Svelte 4 and Webpack Module Federation</p>
  </header>

  <main class="main">
    <section class="features">
      <div class="feature-card">
        <h2>⚡ Module Federation</h2>
        <p>Load and share Svelte components independently at runtime</p>
      </div>
      <div class="feature-card">
        <h2>🔄 Dynamic Remotes</h2>
        <p>Integrate microfrontends from different URLs dynamically</p>
      </div>
      <div class="feature-card">
        <h2>🎯 Svelte 4</h2>
        <p>Modern reactive framework with TypeScript support</p>
      </div>
    </section>

    <section class="counter-section">
      <h2>Shared Counter (Microfrontend Demo)</h2>
      <Counter />
      {#if message}
        <p class="message">{message}</p>
      {/if}
    </section>

    <section class="info-section">
      <h2>📝 Module Federation Configuration</h2>
      <p>Check <code>webpack.config.js</code> for Module Federation setup:</p>
      <ul>
        <li>Remote Entry: <code>http://localhost:${portValue}/remoteEntry.js</code></li>
        <li>Exposes: Counter, RemoteComponent</li>
        <li>Shared: Svelte, Svelte Routing</li>
      </ul>
    </section>
  </main>

  <footer class="footer">
    <p>Built with Svelte 4, Webpack 5, and Module Federation</p>
  </footer>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header {
    background: linear-gradient(135deg, #ff3e00 0%, #ff6b35 100%);
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

  .counter-section,
  .info-section {
    padding: 2rem;
    background: #f9f9f9;
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .message {
    margin-top: 1rem;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
  }

  .footer {
    background: #ff3e00;
    color: white;
    padding: 1.5rem;
    text-align: center;
  }

  code {
    background: #e0e0e0;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
  }
</style>
`;
  }

  private generateCounterComponent() {
    return `<script>
  import { count } from '../stores/counter';
  import { emitCounterUpdate } from '../utils/eventBus';

  function increment() {
    count.update(n => n + 1);
    emitCounterUpdate($count);
  }

  function decrement() {
    count.update(n => n - 1);
    emitCounterUpdate($count);
  }

  function reset() {
    count.set(0);
    emitCounterUpdate(0);
  }
</script>

<div class="counter-wrapper">
  <div class="counter-display">
    <span class="count">{$count}</span>
    <span class="label">Count</span>
  </div>
  <div class="counter-controls">
    <button on:click={decrement} class="btn btn-decrement">-</button>
    <button on:click={reset} class="btn btn-reset">Reset</button>
    <button on:click={increment} class="btn btn-increment">+</button>
  </div>
</div>

<style>
  .counter-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .counter-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .count {
    font-size: 3rem;
    font-weight: bold;
    color: #ff3e00;
  }

  .label {
    font-size: 0.875rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .counter-controls {
    display: flex;
    gap: 1rem;
  }

  .btn {
    width: 60px;
    height: 60px;
    border: none;
    border-radius: 50%;
    font-size: 1.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-increment {
    background: #ff3e00;
    color: white;
  }

  .btn-increment:hover {
    background: #e63700;
    transform: scale(1.1);
  }

  .btn-decrement {
    background: #676778;
    color: white;
  }

  .btn-decrement:hover {
    background: #575767;
    transform: scale(1.1);
  }

  .btn-reset {
    background: #757575;
    color: white;
    width: 80px;
    border-radius: 30px;
  }

  .btn-reset:hover {
    background: #616161;
    transform: scale(1.05);
  }
</style>
`;
  }

  private generateRemoteComponent() {
    return `<script>
  import Counter from './Counter.svelte';
</script>

<div class="remote-container">
  <h3>📦 Remote Component</h3>
  <p>This component can be consumed by other microfrontends</p>
  <Counter />
</div>

<style>
  .remote-container {
    padding: 2rem;
    background: white;
    border-radius: 8px;
    border-left: 4px solid #ff3e00;
  }

  .remote-container h3 {
    margin-top: 0;
    color: #ff3e00;
  }
</style>
`;
  }

  private generateCounterStore() {
    return `import { writable } from 'svelte/store';

export const count = writable(0);

if (typeof window !== 'undefined') {
  // Listen for counter updates from other microfrontends
  window.addEventListener('counter-update', (event) => {
    if (event.detail.type === 'COUNTER_UPDATE') {
      count.set(event.detail.value);
    }
  });
}
`;
  }

  private generateEventBus() {
    return `// Event bus for microfrontend communication

export const eventBus = {
  emit(event, detail) {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  },

  on(event, callback) {
    window.addEventListener(event, callback);
  },

  off(event, callback) {
    window.removeEventListener(event, callback);
  }
};

// Helper functions for counter updates
export const emitCounterUpdate = (value) => {
  eventBus.emit('counter-update', { type: 'COUNTER_UPDATE', value });
};

export const onCounterUpdate = (callback) => {
  eventBus.on('counter-update', (event) => {
    if (event.detail.type === 'COUNTER_UPDATE') {
      callback(event.detail.value);
    }
  });
};
`;
  }

  private generateAppCss() {
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

#app {
  min-height: 100vh;
}
`;
  }

  private generateDockerfile() {
    return `# Multi-stage Dockerfile for Svelte Module Federation

FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration for SPA with Module Federation
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
        try_files \\\\$uri \\\\$uri/ /index.html;
    }

    # Cache remoteEntry.js and other JS files
    location ~* \\\\\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\\\\\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # CORS for Module Federation
    add_header 'Access-Control-Allow-Origin' '*' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
}
EOF

EXPOSE 80

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
`;
  }

  protected generateReadme() {
    const { name, description, packageManager, port } = this.context;
    return `# ${name}

${description || 'Svelte Module Federation Microfrontend'}

## Features

- ⚡ **Webpack Module Federation 2.0**
- 🔄 **Dynamic Remote Loading**
- 🎯 **Svelte 4 with TypeScript**
- 📦 **Svelte Stores for State Management**
- 🔥 **Hot Module Replacement**
- 🐳 **Docker Support**

## Quick Start

\`\`\`bash
# Install dependencies
${packageManager} install

# Start development server
${packageManager} start

# Build for production
${packageManager} run build

# Run linter
${packageManager} run lint
\`\`\`

## Module Federation Setup

### As a Host (Consumer)

To consume remote microfrontends, update \`webpack.config.js\`:

\`\`\`javascript
remotes: {
  mf1: 'mf1@http://localhost:5174/remoteEntry.js',
  mf2: 'mf2@http://localhost:5175/remoteEntry.js'
}
\`\`\`

### Load Remote Component

\`\`\`svelte
<script>
  import { onMount } from 'svelte';

  let RemoteCounter;

  onMount(async () => {
    // Load remote component
    const module = await import('mf1/Counter');
    RemoteCounter = module.default;
  });
</script>

{#if RemoteCounter}
  <svelte:component this={RemoteCounter} />
{/if}
\`\`\`

### As a Remote (Provider)

This microfrontend exposes:
- \`./Counter\` - Shared counter component
- \`./RemoteComponent\` - Remote container component

Remote Entry URL: \`http://localhost:${port || 5173}/remoteEntry.js\`

## Svelte Stores

\`\`\`javascript
import { count } from './stores/counter';

// Read store
console.log($count);

// Update store
count.update(n => n + 1);

// Set store
count.set(0);

// Subscribe to store
count.subscribe(value => {
  console.log(value);
});
\`\`\`

## Microfrontend Communication

Components communicate via Custom Events:

\`\`\`javascript
// Emit event
window.dispatchEvent(new CustomEvent('counter-update', {
  detail: { type: 'COUNTER_UPDATE', value: 123 }
}));

// Listen for events (onMount)
onMount(() => {
  const handler = (event) => {
    console.log(event.detail.value);
  };
  window.addEventListener('counter-update', handler);

  return () => {
    window.removeEventListener('counter-update', handler);
  };
});
\`\`\`

## Docker

\`\`\`bash
# Build and run
docker build -t ${name} .
docker run -p 80:80 ${name}
\`\`\`

## Module Federation Resources

- [Module Federation Guide](https://module-federation.io/guide/)
- [Webpack Module Federation](https://webpack.js.org/concepts/module-federation/)
- [Svelte Documentation](https://svelte.dev/)

## License

MIT
`;
  }

  private generateGitIgnore() {
    return `# Dependencies
node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Production
/dist
/build

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode
.idea
*.swp
*.swo

# Svelte
.svelte-kit/
`;
  }

  private generateEnvExample() {
    const { port } = this.context;
    return `# Module Federation Configuration
PORT=${port || 5173}

# Remote Microfrontends (configure as needed)
# REMOTE_MF1=http://localhost:5174
# REMOTE_MF2=http://localhost:5175
`;
  }
}
