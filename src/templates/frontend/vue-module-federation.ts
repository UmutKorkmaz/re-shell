import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class VueModuleFederationTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript, normalizedName, name } = this.context;
    const ext = hasTypeScript ? 'ts' : 'js';

    // Package.json with Module Federation
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Vue config
    files.push({
      path: 'vue.config.js',
      content: this.generateVueConfig()
    });

    // Webpack config for Module Federation
    files.push({
      path: 'webpack.config.js',
      content: this.generateWebpackConfig()
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

    // Main entry
    files.push({
      path: `src/main.${ext}`,
      content: this.generateMain()
    });

    // App component
    files.push({
      path: 'src/App.vue',
      content: this.generateAppComponent()
    });

    // Counter component
    files.push({
      path: 'src/components/Counter.vue',
      content: this.generateCounterComponent()
    });

    // Remote component
    files.push({
      path: 'src/components/RemoteComponent.vue',
      content: this.generateRemoteComponent()
    });

    // Store for state management
    files.push({
      path: `src/store/index.${ext}`,
      content: this.generateStore()
    });

    // Event bus for microfrontend communication
    files.push({
      path: `src/utils/eventBus.${ext}`,
      content: this.generateEventBus()
    });

    // Public HTML
    files.push({
      path: 'public/index.html',
      content: this.generateHtml()
    });

    // CSS
    files.push({
      path: 'src/assets/style.css',
      content: this.generateStyles()
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
        'serve': 'vue-cli-service serve',
        'build': 'vue-cli-service build',
        'lint': 'vue-cli-service lint'
      },
      dependencies: {
        'vue': '^3.3.0',
        'vue-router': '^4.0.0',
        'vuex': '^4.0.0'
      },
      devDependencies: {
        '@vue/cli-service': '~5.0.0',
        '@vue/cli-plugin-webpack': '~5.0.0',
        'webpack': '^5.89.0',
        'vue-loader': '^17.4.0',
        'vue-template-compiler': '^2.7.0',
        '@module-federation/utilities': '^3.0.0'
      }
    };
  }

  protected generateVueConfig() {
    return `const { defineConfig } = require('@vue/cli-service');
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = defineConfig({
  transpileDependencies: true,

  configureWebpack: {
    plugins: [
      new ModuleFederationPlugin({
        name: '${this.context.normalizedName}',
        filename: 'remoteEntry.js',
        exposes: {
          './Counter': './src/components/Counter',
          './RemoteComponent': './src/components/RemoteComponent'
        },
        remotes: {
          // Configure remote microfrontends here
          // mf1: 'mf1@http://localhost:3002/remoteEntry.js',
        },
        shared: {
          vue: {
            singleton: true,
            requiredVersion: false,
            eager: true
          },
          'vue-router': {
            singleton: true,
            requiredVersion: false
          },
          vuex: {
            singleton: true,
            requiredVersion: false
          }
        }
      })
    ]
  }
});
`;
  }

  private generateWebpackConfig() {
    return `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  output: {
    publicPath: 'http://localhost:${this.context.port || 3002}/'
  },

  optimization: {
    splitChunks: false
  },

  plugins: [
    new ModuleFederationPlugin({
      name: '${this.context.normalizedName}',
      filename: 'remoteEntry.js',
      exposes: {
        './Counter': './src/components/Counter',
        './RemoteComponent': './src/components/RemoteComponent'
      },
      remotes: {},
      shared: {
        vue: {
          singleton: true,
          requiredVersion: false,
          eager: true
        },
        'vue-router': {
          singleton: true,
          requiredVersion: false
        },
        vuex: {
          singleton: true,
          requiredVersion: false
        }
      }
    })
  ]
};
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compilerOptions: {
        target: 'esnext',
        module: 'esnext',
        strict: true,
        jsx: 'preserve',
        moduleResolution: 'node',
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        types: ['webpack-env']
      },
      include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue'],
      exclude: ['node_modules']
    }, null, 2);
  }

  protected generateEslintConfig() {
    return `module.exports = {
  root: true,
  env: {
    node: true
  },
  extends: ['plugin:vue/vue3-essential', 'eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2020
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
  }
};
`;
  }

  private generateMain() {
    return `import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createStore } from 'vuex';
import App from './App.vue';
import './assets/style.css';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: App }
  ]
});

const store = createStore({
  state() {
    return {
      count: 0
    };
  },
  mutations: {
    increment(state) {
      state.count++;
    },
    decrement(state) {
      state.count--;
    }
  }
});

const app = createApp(App);
app.use(router);
app.use(store);

app.mount('#app');

// Microfrontend event listeners
window.addEventListener('counter-update', (event) => {
  if (event.detail.type === 'COUNTER_UPDATE') {
    store.commit('increment', event.detail.value - store.state.count);
  }
});
`;
  }

  private generateAppComponent() {
    return `<template>
  <div class="app">
    <header class="header">
      <h1>🚀 Vue Module Federation Microfrontend</h1>
      <p>A powerful microfrontend architecture with Vue 3 and Webpack Module Federation</p>
    </header>

    <main class="main">
      <section class="features">
        <div class="feature-card">
          <h2>⚡ Module Federation</h2>
          <p>Load and share Vue components independently at runtime</p>
        </div>
        <div class="feature-card">
          <h2>🔄 Dynamic Remotes</h2>
          <p>Integrate microfrontends from different URLs dynamically</p>
        </div>
        <div class="feature-card">
          <h2>🎯 Vue 3 Composition API</h2>
          <p>Modern reactive features with TypeScript support</p>
        </div>
      </section>

      <section class="counter-section">
        <h2>Shared Counter (Microfrontend Demo)</h2>
        <Counter />
      </section>

      <section class="info-section">
        <h2>📝 Module Federation Configuration</h2>
        <p>Check <code>vue.config.js</code> for Module Federation setup:</p>
        <ul>
          <li>Remote Entry: <code>http://localhost:${this.context.port || 3002}/remoteEntry.js</code></li>
          <li>Exposes: Counter and RemoteComponent</li>
          <li>Shared: Vue, Vue Router, Vuex</li>
        </ul>
      </section>
    </main>

    <footer class="footer">
      <p>Built with Vue 3, Webpack 5, and Module Federation</p>
    </footer>
  </div>
</template>

<script>
import { defineComponent, ref, onMounted, onUnmounted } from 'vue';
import Counter from './components/Counter.vue';

export default defineComponent({
  name: 'App',
  components: {
    Counter
  },
  setup() {
    const message = ref('');

    const handleCounterUpdate = (event) => {
      if (event.detail.type === 'COUNTER_UPDATE') {
        message.value = \`Received: \${event.detail.value}\`;
      }
    };

    onMounted(() => {
      window.addEventListener('counter-update', handleCounterUpdate);
    });

    onUnmounted(() => {
      window.removeEventListener('counter-update', handleCounterUpdate);
    });

    return {
      message
    };
  }
});
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #42b883 0%, #35495e 100%);
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

.footer {
  background: #35495e;
  color: white;
  padding: 1.5rem;
  text-align: center;
}
</style>
`;
  }

  private generateCounterComponent() {
    return `<template>
  <div class="counter-wrapper">
    <div class="counter-display">
      <span class="count">{{ count }}</span>
    </div>
    <div class="counter-controls">
      <button @click="decrement" class="btn btn-decrement">-</button>
      <button @click="increment" class="btn btn-increment">+</button>
    </div>
  </div>
</template>

<script>
import { defineComponent, ref } from 'vue';

export default defineComponent({
  name: 'Counter',
  setup() {
    const count = ref(0);

    const increment = () => {
      count.value++;
      emitCounterUpdate(count.value);
    };

    const decrement = () => {
      count.value--;
      emitCounterUpdate(count.value);
    };

    const emitCounterUpdate = (value) => {
      window.dispatchEvent(new CustomEvent('counter-update', {
        detail: { type: 'COUNTER_UPDATE', value }
      }));
    };

    return {
      count,
      increment,
      decrement
    };
  }
});
</script>

<style scoped>
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
  background: #42b883;
  color: white;
}

.btn-increment:hover {
  background: #35a372;
  transform: scale(1.1);
}

.btn-decrement {
  background: #35495e;
  color: white;
}

.btn-decrement:hover {
  background: #2c3e50;
  transform: scale(1.1);
}
</style>
`;
  }

  private generateRemoteComponent() {
    return `<template>
  <div class="remote-container">
    <h3>📦 Remote Component</h3>
    <p>This component can be consumed by other microfrontends</p>
    <Counter />
  </div>
</template>

<script>
import { defineComponent } from 'vue';
import Counter from './Counter.vue';

export default defineComponent({
  name: 'RemoteComponent',
  components: {
    Counter
  }
});
</script>

<style scoped>
.remote-container {
  padding: 2rem;
  background: white;
  border-radius: 8px;
  border-left: 4px solid #42b883;
}

.remote-container h3 {
  margin-top: 0;
  color: #42b883;
}
</style>
`;
  }

  private generateStore() {
    return `import { createStore } from 'vuex';

export default createStore({
  state() {
    return {
      count: 0,
      message: ''
    };
  },

  mutations: {
    increment(state) {
      state.count++;
    },
    decrement(state) {
      state.count--;
    },
    setMessage(state, message) {
      state.message = message;
    }
  },

  actions: {
    updateCounter({ commit }, value) {
      commit('increment', value);
    }
  },

  getters: {
    doubleCount: (state) => state.count * 2
  }
});
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

  private generateHtml() {
    const { name } = this.context;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link rel="icon" href="<%= BASE_URL %>favicon.ico">
  <title>${name}</title>
</head>
<body>
  <noscript>
    <strong>We're sorry but this app doesn't work properly without JavaScript enabled. Please enable it to continue.</strong>
  </noscript>
  <div id="app"></div>
</body>
</html>
`;
  }

  private generateStyles() {
    return `* {
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
    return `# Multi-stage Dockerfile for Vue Module Federation

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

${description || 'Vue Module Federation Microfrontend'}

## Features

- ⚡ **Webpack Module Federation 2.0**
- 🔄 **Dynamic Remote Loading**
- 🎯 **Vue 3 Composition API**
- 📦 **Vuex State Management**
- 🔥 **Hot Module Replacement**
- 🐳 **Docker Support**

## Quick Start

\`\`\`bash
# Install dependencies
${packageManager} install

# Start development server
${packageManager} run serve

# Build for production
${packageManager} run build

# Run linter
${packageManager} run lint
\`\`\`

## Module Federation Setup

### As a Host (Consumer)

To consume remote microfrontends, update \`vue.config.js\`:

\`\`\`javascript
remotes: {
  mf1: 'mf1@http://localhost:3003/remoteEntry.js',
  mf2: 'mf2@http://localhost:3004/remoteEntry.js'
}
\`\`\`

### Load Remote Component

\`\`\`vue
<template>
  <component :is="RemoteCounter" />
</template>

<script>
import { defineComponent, ref, shallowRef } from 'vue';

export default defineComponent({
  setup() {
    const RemoteCounter = shallowRef(null);

    onMounted(async () => {
      // Load remote component
      RemoteCounter.value = await loadRemoteComponent('mf1/Counter');
    });

    return { RemoteCounter };
  }
});
</script>
\`\`\`

### As a Remote (Provider)

This microfrontend exposes:
- \`./Counter\` - Shared counter component
- \`./RemoteComponent\` - Remote container component

Remote Entry URL: \`http://localhost:${this.context.port || 3002}/remoteEntry.js\`

## Microfrontend Communication

Components communicate via Custom Events:

\`\`\`javascript
// Emit event
window.dispatchEvent(new CustomEvent('counter-update', {
  detail: { type: 'COUNTER_UPDATE', value: 123 }
}));

// Listen for events (in setup())
onMounted(() => {
  const handler = (event) => {
    console.log(event.detail.value);
  };
  window.addEventListener('counter-update', handler);

  onUnmounted(() => {
    window.removeEventListener('counter-update', handler);
  });
});
\`\`\`

## Docker

\`\`\`bash
# Build and run
docker build -t ${name} .
docker run -p 80:80 ${name}
\`\`\`

## Module Federation Resources

- [Module Federation for Vue](https://module-federation.io/guide/vue)
- [Webpack Module Federation](https://webpack.js.org/concepts/module-federation/)
- [Vue 3 Documentation](https://vuejs.org/)

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
PORT=${port || 3002}

# Remote Microfrontends (configure as needed)
# REMOTE_MF1=http://localhost:3003
# REMOTE_MF2=http://localhost:3004
`;
  }
}
