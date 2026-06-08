import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class CreateReactAppTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript } = this.context;
    const ext = hasTypeScript ? 'tsx' : 'jsx';

    // Package.json with CRA and PWA dependencies
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Public folder with index.html and manifest
    files.push({
      path: 'public/index.html',
      content: this.generateHtmlFile()
    });

    files.push({
      path: 'public/manifest.json',
      content: this.generateManifest()
    });

    files.push({
      path: 'public/favicon.ico',
      content: '<!-- Replace with actual favicon.ico file -->'
    });

    // Src folder structure
    files.push({
      path: `src/index.${ext}`,
      content: this.generateIndexFile()
    });

    files.push({
      path: `src/App.${ext}`,
      content: this.generateAppComponent()
    });

    files.push({
      path: `src/App.test.${ext}`,
      content: this.generateAppTest()
    });

    files.push({
      path: 'src/App.css',
      content: this.generateAppCss()
    });

    files.push({
      path: 'src/index.css',
      content: this.generateIndexCss()
    });

    files.push({
      path: 'src/setupTests.js',
      content: this.generateSetupTests()
    });

    files.push({
      path: 'src/webVitals.js',
      content: this.generateWebVitals()
    });

    // Service Worker for PWA
    files.push({
      path: 'src/service-worker.js',
      content: this.generateServiceWorker()
    });

    files.push({
      path: 'src/serviceWorkerRegistration.js',
      content: this.generateServiceWorkerRegistration()
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

    // Webpack config override
    files.push({
      path: 'config-overrides.js',
      content: this.generateWebpackOverrides()
    });

    // Env files
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // Docker support
    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile()
    });

    files.push({
      path: 'Dockerfile.dev',
      content: this.generateDockerfileDev()
    });

    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    files.push({
      path: 'docker-compose.dev.yml',
      content: this.generateDockerComposeDev()
    });

    files.push({
      path: '.dockerignore',
      content: this.generateDockerIgnore()
    });

    files.push({
      path: 'nginx.conf',
      content: this.generateNginxConf()
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
    const { hasTypeScript, normalizedName } = this.context;
    const isTypeScript = hasTypeScript !== false;

    return {
      name: normalizedName,
      version: '0.1.0',
      private: true,
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'react-scripts': '5.0.1',
        'web-vitals': '^3.0.0'
      },
      devDependencies: {
        ...(isTypeScript ? {
          '@types/node': '^20.0.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@types/jest': '^29.5.0'
        } : {}),
        'customize-cra': '^1.0.0',
        'react-app-rewired': '^2.2.1',
        'webpack-bundle-analyzer': '^4.9.0',
        '@testing-library/react': '^14.0.0',
        '@testing-library/jest-dom': '^6.0.0',
        '@testing-library/user-event': '^14.5.0'
      },
      scripts: {
        'start': 'react-app-rewired start',
        'build': 'react-app-rewired build',
        'test': 'react-app-rewired test',
        'eject': 'react-scripts eject',
        'analyze': 'ANALYZE=true react-app-rewired build',
        'lint': 'eslint src --ext .js,.jsx,.ts,.tsx',
        'lint:fix': 'eslint src --ext .js,.jsx,.ts,.tsx --fix'
      },
      eslintConfig: {
        extends: ['react-app', ...(isTypeScript ? ['react-app/jest'] : [])]
      },
      browserslist: {
        production: ['>0.2%', 'not dead', 'not op_mini all'],
        development: ['last 1 chrome version', 'last 1 firefox version', 'last 1 safari version']
      },
      homepage: '.'
    };
  }

  protected generateHtmlFile() {
    const { name, description } = this.context;
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta
      name="description"
      content="${description || 'A Create React App application'}"
    />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>${name}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`;
  }

  private generateManifest() {
    const { name } = this.context;
    return JSON.stringify({
      short_name: name,
      name: name,
      icons: [
        { src: 'favicon.ico', sizes: '64x64 32x32 24x24 16x16', type: 'image/x-icon' },
        { src: 'logo192.png', type: 'image/png', sizes: '192x192' },
        { src: 'logo512.png', type: 'image/png', sizes: '512x512' }
      ],
      start_url: '.',
      display: 'standalone',
      theme_color: '#000000',
      background_color: '#ffffff'
    }, null, 2);
  }

  private generateIndexFile() {
    const { hasTypeScript } = this.context;
    const tsImport = hasTypeScript ? `import ReactDOM from 'react-dom/client';
import type { Root } from 'react-dom/client';` : `import ReactDOM from 'react-dom/client';`;

    return `import React from 'react';
${tsImport}
import './index.css';
import App from './App';
import reportWebVitals from './webVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(
  document.getElementById('root')${hasTypeScript ? ' as HTMLElement' : ''}
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Register service worker for PWA support
serviceWorkerRegistration.register();
`;
  }

  private generateAppComponent() {
    const { hasTypeScript } = this.context;
    const imports = hasTypeScript ? `import React, { useState, useEffect } from 'react';
import logo from './logo.svg';` : `import React, { useState, useEffect } from 'react';
import logo from './logo.svg';`;

    return `${imports}
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Listen for custom events from other microfrontends
    const handleMessage = (event: CustomEvent) => {
      if (event.detail.type === 'COUNTER_UPDATE') {
        setMessage(\`Received: \${event.detail.value}\`);
      }
    };

    window.addEventListener('counter-update', handleMessage as EventListener);
    return () => {
      window.removeEventListener('counter-update', handleMessage as EventListener);
    };
  }, []);

  const increment = () => {
    setCount(count + 1);
    // Emit event for other microfrontends
    window.dispatchEvent(new CustomEvent('counter-update', {
      detail: { type: 'COUNTER_UPDATE', value: count + 1 }
    }));
  };

  const decrement = () => {
    setCount(count - 1);
    window.dispatchEvent(new CustomEvent('counter-update', {
      detail: { type: 'COUNTER_UPDATE', value: count - 1 }
    }));
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.${hasTypeScript ? 'tsx' : 'jsx'}</code> and save to reload.
        </p>
        <div className="counter-demo">
          <h2>Counter: {count}</h2>
          <button onClick={increment}>+</button>
          <button onClick={decrement}>-</button>
          {message && <p className="message">{message}</p>}
        </div>
        <p>
          Create React App template with <strong>PWA support</strong>.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
`;
  }

  private generateAppTest() {
    return `import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders app component', () => {
  render(<App />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});

test('counter increments and decrements', () => {
  render(<App />);
  const incrementButton = screen.getByText('+');
  const decrementButton = screen.getByText('-');

  // Initial state
  expect(screen.getByText(/Counter: 0/i)).toBeInTheDocument();

  // Test increment
  fireEvent.click(incrementButton);
  expect(screen.getByText(/Counter: 1/i)).toBeInTheDocument();

  // Test decrement
  fireEvent.click(decrementButton);
  expect(screen.getByText(/Counter: 0/i)).toBeInTheDocument();
});
`;
  }

  private generateAppCss() {
    return `.App {
  text-align: center;
}

.App-logo {
  height: 40vmin;
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .App-logo {
    animation: App-logo-spin infinite 20s linear;
  }
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}

.App-link {
  color: #61dafb;
}

.counter-demo {
  margin: 2rem 0;
  padding: 2rem;
  background-color: #3a3f4b;
  border-radius: 0.5rem;
  min-width: 300px;
}

.counter-demo h2 {
  margin: 1rem 0;
}

.counter-demo button {
  font-size: 1.5rem;
  padding: 0.5rem 1.5rem;
  margin: 0.5rem;
  background-color: #61dafb;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.counter-demo button:hover {
  background-color: #4fa8c7;
}

.message {
  color: #61dafb;
  font-size: 1rem;
  margin-top: 1rem;
}

@keyframes App-logo-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
`;
  }

  private generateIndexCss() {
    return `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}
`;
  }

  private generateSetupTests() {
    return `// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';
`;
  }

  private generateWebVitals() {
    return `const reportWebVitals = onPerfEntry => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

export default reportWebVitals;
`;
  }

  private generateServiceWorker() {
    return `const CACHE_NAME = 'cra-cache-v1';
const urlsToCache = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
`;
  }

  private generateServiceWorkerRegistration() {
    return `// Service worker registration for PWA support

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config) {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href);
    if (publicUrl.origin !== window.location.origin) {
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = \`\${process.env.PUBLIC_URL}/service-worker.js\`;

      if (isLocalhost) {
        checkValidServiceWorker(swUrl, config);
      } else {
        registerValidSW(swUrl, config);
      }
    });
  }
}

function registerValidSW(swUrl, config) {
  navigator.serviceWorker
    .register(swUrl)
    .then(registration => {
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              console.log('New content is available; please refresh.');
              if (config && config.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              console.log('Content is cached for offline use.');
              if (config && config.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch(error => {
      console.error('Error during service worker registration:', error);
    });
}

function checkValidServiceWorker(swUrl, config) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' }
  })
    .then(response => {
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then(registration => {
          registration.unregister().then(() => {
            window.location.reload();
          });
        });
      } else {
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('No internet connection found. App is running in offline mode.');
    });
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}
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
  extends: ['react-app'],
  rules: {
    // Add custom rules here
  },
};
`;
  }

  private generateWebpackOverrides() {
    return `const { override, addWebpackAlias } = require('customize-cra');
const path = require('path');

module.exports = override(
  addWebpackAlias({
    '@': path.resolve(__dirname, 'src'),
  })
);

// Bundle analyzer - run with ANALYZE=true npm run build
if (process.env.ANALYZE === 'true') {
  const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
  module.exports = {
    ...module.exports,
    webpack: function(config, env) {
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: true,
        })
      );
      return config;
    },
  };
}
`;
  }

  private generateEnvExample() {
    const { port } = this.context;
    return `# Environment Variables
# Copy this file to .env.local and fill in your values

# Application
PORT=${port || 3000}
REACT_APP_API_URL=http://localhost:8000/api

# Feature Flags
REACT_APP_ENABLE_ANALYTICS=false
REACT_APP_ENABLE_PWA=true

# Analytics (optional)
# REACT_APP_GA_ID=your-google-analytics-id
`;
  }

  private generateDockerfile() {
    return `# Multi-stage Dockerfile for Create React App

# Build stage
FROM node:18-alpine AS build

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
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

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
build
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
*.log
coverage
`;
  }

  private generateNginxConf() {
    return `server {
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
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
`;
  }

  protected generateReadme() {
    const { name, description, packageManager } = this.context;
    return `# ${name}

${description || 'A Create React App application with PWA support'}

## Features

- ⚛️ Create React App with React 18
- 📱 Progressive Web App (PWA) support
- 🔧 Webpack customization via react-app-rewired
- 🧪 Testing with React Testing Library
- 📊 Bundle analysis
- 🐳 Docker support
- 🎯 TypeScript support
- 📦 Optimized production builds

## Quick Start

\`\`\`bash
# Install dependencies
${packageManager} install

# Start development server
${packageManager} start

# Build for production
${packageManager} run build

# Run tests
${packageManager} test

# Analyze bundle
ANALYZE=true ${packageManager} run build
\`\`\`

## Ejecting

\`\`\`bash
${packageManager} run eject
\`\`\`

⚠️ **One-way operation!** Ejecting copies all config files into your project.

## Docker

\`\`\`bash
docker build -t ${name} .
docker run -p 80:80 ${name}
\`\`\`

## License

MIT
`;
  }

  private generateGitIgnore() {
    return `# See https://help.github.com/articles/ignoring-files/ for more about ignoring files.

# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# production
/build

# misc
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
`;
  }

  private generateDockerfileDev() {
    return `# Development Dockerfile for Create React App with Hot Reload

FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Expose port for development server
EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "start"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "80:80"
    restart: unless-stopped
`;
  }

  private generateDockerComposeDev() {
    return `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
      - ./public:/app/public
      - /app/node_modules
    environment:
      - CHOKIDAR_USEPOLLING=true
      - WATCHPACK_POLLING=true
    restart: "no"
`;
  }
}
