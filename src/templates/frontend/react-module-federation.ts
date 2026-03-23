import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class ReactModuleFederationTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript, normalizedName, name } = this.context;

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

    // HTML file
    files.push({
      path: 'public/index.html',
      content: this.generateHtml()
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

    // App entry point
    files.push({
      path: `src/index.${hasTypeScript ? 'tsx' : 'js'}`,
      content: this.generateIndex()
    });

    // App component
    files.push({
      path: `src/App.${hasTypeScript ? 'tsx' : 'jsx'}`,
      content: this.generateAppComponent()
    });

    // Bootstrap for Module Federation
    files.push({
      path: `src/bootstrap.${hasTypeScript ? 'tsx' : 'js'}`,
      content: this.generateBootstrap()
    });

    // Remote component
    files.push({
      path: `src/components/RemoteComponent.${hasTypeScript ? 'tsx' : 'jsx'}`,
      content: this.generateRemoteComponent()
    });

    // Counter component for demo
    files.push({
      path: `src/components/Counter.${hasTypeScript ? 'tsx' : 'jsx'}`,
      content: this.generateCounterComponent()
    });

    // API utilities
    files.push({
      path: `src/utils/api.${hasTypeScript ? 'ts' : 'js'}`,
      content: this.generateApiUtils()
    });

    // Types
    if (hasTypeScript) {
      files.push({
        path: 'src/types/index.ts',
        content: this.generateTypes()
      });
    }

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
        'lint': 'eslint src --ext .js,.jsx,.ts,.tsx',
        'test': 'jest'
      },
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.20.0'
      },
      devDependencies: {
        '@babel/core': '^7.23.0',
        '@babel/preset-react': '^7.23.0',
        '@babel/preset-typescript': '^7.23.0',
        '@module-federation/utilities': '^3.0.0',
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        'babel-loader': '^9.1.3',
        'css-loader': '^6.8.0',
        'eslint': '^8.50.0',
        'eslint-plugin-react': '^7.33.0',
        'html-webpack-plugin': '^5.5.0',
        'style-loader': '^3.3.0',
        'typescript': '^5.3.0',
        'webpack': '^5.89.0',
        'webpack-cli': '^5.1.0',
        '@docusaurus/react-loadable': '^5.5.2'
      }
    };
  }

  private generateWebpackConfig() {
    const { normalizedName } = this.context;
    return `const HtmlWebpackPlugin = require('html-webpack-plugin');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
const path = require('path');

module.exports = {
  entry: './src/index',

  output: {
    publicPath: 'http://localhost:${this.context.port || 3001}/',
    clean: true
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json']
  },

  module: {
    rules: [
      {
        test: /\\.\\.?m?(tsx|ts|jsx|js)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-react',
              '@babel/preset-typescript'
            ],
            plugins: ['@docusaurus/react-loadable/babel']
          }
        }
      },
      {
        test: /\\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource'
      }
    ]
  },

  plugins: [
    new ModuleFederationPlugin({
      name: '${normalizedName}',

      filename: 'remoteEntry.js',

      exposes: {
        './Counter': './src/components/Counter',
        './RemoteComponent': './src/components/RemoteComponent'
      },

      remotes: {
        // Example: Configure remote microfrontends
        // mf1: 'mf1@http://localhost:3002/remoteEntry.js',
        // mf2: 'mf2@http://localhost:3003/remoteEntry.js'
      },

      shared: {
        react: {
          singleton: true,
          requiredVersion: false,
          eager: true
        },
        'react-dom': {
          singleton: true,
          requiredVersion: false,
          eager: true
        },
        'react-router-dom': {
          singleton: true,
          requiredVersion: false
        }
      }
    }),

    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html'
    })
  ],

  devServer: {
    port: ${this.context.port || 3001},
    historyApiFallback: true,
    hot: true,
    headers: {
      'Access-Control-Allow-Origin': '*'
    }
  }
};
`;
  }

  private generateHtml() {
    const { name } = this.context;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${name} - React Module Federation Microfrontend">
  <title>${name}</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compilerOptions: {
        target: 'es5',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        forceConsistentCasingInFileNames: true,
        noFallthroughCasesInSwitch: true,
        module: 'esnext',
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx'
      },
      include: ['src']
    }, null, 2);
  }

  protected generateEslintConfig() {
    return `module.exports = {
  extends: ['plugin:react/recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['react', '@typescript-eslint'],
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off'
  }
};
`;
  }

  private generateBabelConfig() {
    return `module.exports = {
  presets: [
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript'
  ],
  plugins: ['@docusaurus/react-loadable/babel']
};
`;
  }

  private generateIndex() {
    const { hasTypeScript } = this.context;
    const tsImport = hasTypeScript ? `import App from './App';` : `import App from './App';`;

    return `import('./bootstrap');

// This file is the entry point for the microfrontend
// The actual app initialization happens in bootstrap.js to handle
// Module Federation's async boundary
`;
  }

  private generateAppComponent() {
    return `import React, { useState, useEffect, Suspense, lazy } from 'react';
import Counter from './components/Counter';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('');
  const [remoteComponent, setRemoteComponent] = useState(null);

  useEffect(() => {
    // Listen for events from other microfrontends
    const handleCounterUpdate = (event) => {
      if (event.detail.type === 'COUNTER_UPDATE') {
        setMessage(\`Received from microfrontend: \${event.detail.value}\`);
        setCount(event.detail.value);
      }
    };

    window.addEventListener('counter-update', handleCounterUpdate);
    return () => {
      window.removeEventListener('counter-update', handleCounterUpdate);
    };
  }, []);

  const increment = () => {
    setCount(prev => prev + 1);
    // Emit event for other microfrontends
    window.dispatchEvent(new CustomEvent('counter-update', {
      detail: { type: 'COUNTER_UPDATE', value: count + 1 }
    }));
  };

  const decrement = () => {
    setCount(prev => prev - 1);
    window.dispatchEvent(new CustomEvent('counter-update', {
      detail: { type: 'COUNTER_UPDATE', value: count - 1 }
    }));
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 React Module Federation Microfrontend</h1>
        <p>A powerful microfrontend architecture with Webpack Module Federation</p>
      </header>

      <main className="main">
        <section className="features">
          <div className="feature-card">
            <h2>⚡ Module Federation</h2>
            <p>Load and share React components independently at runtime</p>
          </div>
          <div className="feature-card">
            <h2>🔄 Dynamic Remotes</h2>
            <p>Integrate microfrontends from different URLs dynamically</p>
          </div>
          <div className="feature-card">
            <h2>🎯 Type Safety</h2>
            <p>Full TypeScript support with shared dependencies</p>
          </div>
        </section>

        <section className="counter-section">
          <h2>Shared Counter (Microfrontend Demo)</h2>
          <Counter
            count={count}
            onIncrement={increment}
            onDecrement={decrement}
          />
          {message && <p className="message">{message}</p>}
        </section>

        <section className="remote-section">
          <h2>Remote Component Loading</h2>
          <p>
            This microfrontend exposes components that can be consumed by
            other microfrontends using Module Federation.
          </p>
          <div className="exposed-components">
            <div className="component-card">
              <h3>Exposed Components:</h3>
              <ul>
                <li><code>./Counter</code> - Shared counter component</li>
                <li><code>./RemoteComponent</code> - Remote container component</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="info-section">
          <h2>📝 Module Federation Configuration</h2>
          <p>Check <code>webpack.config.js</code> for Module Federation setup:</p>
          <ul>
            <li>Remote Entry: <code>http://localhost:${this.context.port || 3001}/remoteEntry.js</code></li>
            <li>Exposes: Counter and RemoteComponent</li>
            <li>Shared: React, ReactDOM, React Router</li>
          </ul>
        </section>
      </main>

      <footer className="footer">
        <p>Built with React 18, Webpack 5, and Module Federation</p>
      </footer>
    </div>
  );
}

export default App;
`;
  }

  private generateBootstrap() {
    return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Bootstrap the application
// This file handles the async boundary required by Module Federation
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Enable hot module replacement
if (module.hot) {
  module.hot.accept();
}
`;
  }

  private generateRemoteComponent() {
    return `import React from 'react';
import { lazy, Suspense } from 'react';
import Counter from './Counter';

// Example component that can be loaded as a remote
function RemoteComponent({ onIncrement, onDecrement }) {
  return (
    <div className="remote-container">
      <h3>📦 Remote Component</h3>
      <p>This component can be consumed by other microfrontends</p>
      <Counter
        count={0}
        onIncrement={onIncrement}
        onDecrement={onDecrement}
      />
    </div>
  );
}

export default RemoteComponent;
`;
  }

  private generateCounterComponent() {
    return `import React from 'react';

function Counter({ count = 0, onIncrement, onDecrement }) {
  return (
    <div className="counter-wrapper">
      <div className="counter-display">
        <span className="count">{count}</span>
      </div>
      <div className="counter-controls">
        <button onClick={onDecrement} className="btn btn-decrement">
          -
        </button>
        <button onClick={onIncrement} className="btn btn-increment">
          +
        </button>
      </div>
    </div>
  );
}

export default Counter;
`;
  }

  private generateApiUtils() {
    return `// API utilities for microfrontend communication

export const emitCounterUpdate = (value) => {
  window.dispatchEvent(new CustomEvent('counter-update', {
    detail: { type: 'COUNTER_UPDATE', value }
  }));
};

export const subscribeToCounterUpdates = (callback) => {
  const handler = (event) => {
    if (event.detail.type === 'COUNTER_UPDATE') {
      callback(event.detail.value);
    }
  };

  window.addEventListener('counter-update', handler);

  // Return unsubscribe function
  return () => {
    window.removeEventListener('counter-update', handler);
  };
};

export const fetchRemoteComponent = async (url, scope, module) => {
  // Dynamically load a remote component
  await __webpack_init_sharing__('default');
  const container = window[url];

  // Initialize container if not already initialized
  if (!container) {
    await loadScript(\`http://\${url}/remoteEntry.js\`);
  }

  // Load module from container
  await container.init(__webpack_share_scopes__.default);
  const factory = await container.get(module);
  const Module = factory();

  return Module;
};

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const element = document.createElement('script');
    element.src = url;
    element.type = 'text/javascript';
    element.async = true;
    element.onload = resolve;
    element.onerror = reject;
    document.head.appendChild(element);
  });
}
`;
  }

  private generateTypes() {
    return `export interface CounterProps {
  count?: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export interface RemoteComponentProps {
  onIncrement?: () => void;
  onDecrement?: () => void;
}

export interface MicrofrontendEvent {
  type: 'COUNTER_UPDATE';
  value: number;
}

export interface ModuleInfo {
  url: string;
  scope: string;
  module: string;
}
`;
  }

  private generateAppCss() {
    return `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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

.counter-section {
  text-align: center;
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 2rem;
}

.counter-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.count {
  font-size: 2.5rem;
  font-weight: bold;
  min-width: 80px;
}

.btn {
  width: 50px;
  height: 50px;
  border: none;
  border-radius: 50%;
  font-size: 1.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-increment {
  background: #667eea;
  color: white;
}

.btn-increment:hover {
  background: #5568d3;
  transform: scale(1.1);
}

.btn-decrement {
  background: #764ba2;
  color: white;
}

.btn-decrement:hover {
  background: #64408a;
  transform: scale(1.1);
}

.message {
  margin-top: 1rem;
  color: #667eea;
  font-weight: 500;
}

.remote-section,
.info-section {
  margin-bottom: 2rem;
  padding: 2rem;
  background: #f9f9f9;
  border-radius: 8px;
}

.component-card {
  background: white;
  padding: 1.5rem;
  border-radius: 4px;
  border-left: 4px solid #667eea;
}

.component-card ul {
  text-align: left;
  margin-top: 1rem;
}

.component-card code {
  background: #f0f0f0;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-family: 'Courier New', monospace;
}

.footer {
  background: #333;
  color: white;
  padding: 1.5rem;
  text-align: center;
}
`;
  }

  private generateDockerfile() {
    return `# Multi-stage Dockerfile for React Module Federation

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
        try_files \\$uri \\$uri/ /index.html;
    }

    # Cache remoteEntry.js and other JS files
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\$ {
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
    const { name, description, packageManager } = this.context;
    return `# ${name}

${description || 'React Module Federation Microfrontend'}

## Features

- ⚡ **Webpack Module Federation 2.0**
- 🔄 **Dynamic Remote Loading**
- 🎯 **TypeScript Support**
- 🔥 **Hot Module Replacement**
- 📦 **Component Sharing**
- 🐳 **Docker Support**

## Quick Start

\`\`\`bash
# Install dependencies
${packageManager} install

# Start development server
${packageManager} start

# Build for production
${packageManager} run build
\`\`\`

## Module Federation Setup

### As a Host (Consumer)

To consume remote microfrontends, update \`webpack.config.js\`:

\`\`\`javascript
remotes: {
  mf1: 'mf1@http://localhost:3002/remoteEntry.js',
  mf2: 'mf2@http://localhost:3003/remoteEntry.js'
}
\`\`\`

### Load Remote Component

\`\`\`javascript
import { lazy } from 'react';

const RemoteComponent = lazy(() =>
  import('mf1/Counter')
);
\`\`\`

### As a Remote (Provider)

This microfrontend exposes:
- \`./Counter\` - Shared counter component
- \`./RemoteComponent\` - Remote container

Remote Entry URL: \`http://localhost:${this.context.port || 3001}/remoteEntry.js\`

## Microfrontend Communication

Components communicate via Custom Events:

\`\`\`javascript
// Emit event
window.dispatchEvent(new CustomEvent('counter-update', {
  detail: { type: 'COUNTER_UPDATE', value: 123 }
}));

// Listen for events
window.addEventListener('counter-update', (event) => {
  console.log(event.detail.value);
});
\`\`\`

## Docker

\`\`\`bash
# Build and run
docker build -t ${name} .
docker run -p 80:80 ${name}
\`\`\`

## Module Federation Resources

- [Module Federation Repo](https://github.com/module-federation/module-federation-examples)
- [Webpack Module Federation](https://webpack.js.org/concepts/module-federation/)
- [React Microfrontends](https://martinfowler.com/articles/micro-frontends/)

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
`;
  }

  private generateEnvExample() {
    const { port } = this.context;
    return `# Module Federation Configuration
PORT=${port || 3001}

# Remote Microfrontends (configure as needed)
# REMOTE_MF1=http://localhost:3002
# REMOTE_MF2=http://localhost:3003

# Feature Flags
ENABLE_MF_DEVTOOLS=true
`;
  }
}
