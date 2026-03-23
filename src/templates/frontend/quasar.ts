import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class QuasarTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];
    const { hasTypeScript } = this.context;

    // Package.json
    files.push({
      path: 'package.json',
      content: JSON.stringify(this.generatePackageJson(), null, 2)
    });

    // Quasar config
    files.push({
      path: 'quasar.config.js',
      content: this.generateQuasarConfig()
    });

    // TypeScript config
    if (hasTypeScript) {
      files.push({
        path: 'tsconfig.json',
        content: this.generateTsConfig()
      });
    }

    // App configuration
    files.push({
      path: 'app.config.js',
      content: this.generateAppConfig()
    });

    // Quasar App.vue
    files.push({
      path: 'src/App.vue',
      content: this.generateAppVue()
    });

    // Pages
    files.push({
      path: 'src/pages/IndexPage.vue',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/pages/AboutPage.vue',
      content: this.generateAboutPage()
    });

    // Layouts
    files.push({
      path: 'src/layouts/MainLayout.vue',
      content: this.generateMainLayout()
    });

    // Components
    files.push({
      path: 'src/components/EssentialLink.vue',
      content: this.generateEssentialLink()
    });

    // Stores
    files.push({
      path: 'src/stores/example-store.js',
      content: this.generateExampleStore()
    });

    // Router
    files.push({
      path: 'src/router/routes.js',
      content: this.generateRoutes()
    });

    // CSS
    files.push({
      path: 'src/css/app.scss',
      content: this.generateAppCss()
    });

    // Environment
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // Quasar extensions
    files.push({
      path: 'quasar.extensions.json',
      content: this.generateExtensions()
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
      author: this.context.team || this.context.org,
      private: true,
      scripts: {
        dev: 'quasar dev',
        build: 'quasar build',
        'build:pwa': 'quasar build -m pwa',
        'build:electron': 'quasar build -m electron',
        lint: 'eslint --ext .js,.vue ./src',
        format: 'prettier --write "**/*.{js,vue,scss,md,json}"',
        test: 'echo "No test specified" && exit 0'
      },
      dependencies: {
        '@quasar/extras': '^1.16.9',
        'axios': '^1.6.5',
        'pinia': '^2.1.7',
        'quasar': '^2.14.0',
        'vue': '^3.4.15',
        'vue-router': '^4.2.5'
      },
      devDependencies: {
        '@quasar/app-vite': '^1.5.0',
        '@types/node': '^20.11.0',
        'autoprefixer': '^10.4.17',
        'eslint': '^8.56.0',
        'eslint-config-prettier': '^9.1.0',
        'eslint-plugin-vue': '^9.20.1',
        'prettier': '^3.2.4',
        'typescript': '^5.3.3'
      },
      engines: {
        node: '^18 || ^20',
        npm: '>= 6.13.4',
        yarn: '>= 1.21.1'
      }
    };
  }

  protected generateQuasarConfig() {
    return `const { configure } = require('quasar/wrappers');

module.exports = configure(function (ctx) {
  return {
    boot: [
      'axios'
    ],

    css: [
      'app.scss'
    ],

    extras: [
      'roboto-font',
      'material-icons',
      'material-icons-outlined',
      'fontawesome-v6',
      'mdi-v7'
    ],

    build: {
      vueRouterMode: 'history',

      extendViteConf(viteConf) {
        viteConf.resolve = viteConf.resolve || {};
        viteConf.resolve.alias = viteConf.resolve.alias || {};
        viteConf.resolve.alias['@'] = '/src';
      },

      vitePlugins: [
        [
          '@quasar/quasar-webpack-extension',
          {}
        ]
      ]
    },

    devServer: {
      open: true,
      port: ${this.context.port || 9000}
    },

    framework: {
      config: {
        notify: {},
        loading: {},
        brand: {
          primary: '#1976d2',
          secondary: '#26a69a',
          accent: '#9c27b0',
          dark: '#1d1d1d',
          positive: '#21ba45',
          negative: '#c10015',
          info: '#31ccec',
          warning: '#f2c037'
        }
      },

      iconSet: 'material-icons',
      lang: 'en-US',

      plugins: [
        'Notify',
        'Loading',
        'LocalStorage',
        'SessionStorage'
      ]
    },

    animations: [],

    ssr: {
      pwa: false,
      prodPort: ${this.context.port || 9000},
      middlewares: [
        'render'
      ]
    },

    pwa: {
      workboxMode: 'generateSW',
      injectPwaMetaTags: true,
      swFilename: 'sw.js',
      manifestFilename: 'manifest.json',
      useCredentialsForManifestTag: false
    },

    cordova: {},

    capacitor: {
      hideSplashscreen: true
    },

    electron: {
      inspectPort: 5858,
      bundler: 'packager',
      packager: {},
      builder: {
        appId: '${this.context.org}.${this.context.normalizedName}',
        productName: '${this.context.name}',
        win: {
          target: ['nsis']
        },
        mac: {
          target: ['dmg']
        }
      }
    }
  }
});
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      extends: '@quasar/app-vite/tsconfig-json',
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@/*': ['src/*'],
          'components/*': ['src/components/*'],
          'layouts/*': ['src/layouts/*'],
          'pages/*': ['src/pages/*'],
          'stores/*': ['src/stores/*'],
          'assets/*': ['src/assets/*'],
          'boot/*': ['src/boot/*'],
          'src/*': ['src/*']
        }
      }
    }, null, 2);
  }

  protected generateAppConfig() {
    return `export default {
  // Add app config here
}`;
  }

  protected generateAppVue() {
    return `<template>
  <router-view />
</template>

<script setup>
// Main App component - Quasar handles the rest
</script>
`;
  }

  protected generateIndexPage() {
    return `<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-md">Welcome to ${this.context.name}</div>

    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              <q-icon name="rocket" class="q-mr-sm" />
              Quasar Framework
            </div>
          </q-card-section>

          <q-card-section>
            <p>Build high-performance Vue 3 applications for web, mobile, and desktop from a single codebase.</p>
          </q-card-section>

          <q-card-actions>
            <q-btn flat label="Learn More" href="https://quasar.dev" target="_blank" />
          </q-card-actions>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              <q-icon name="devices" class="q-mr-sm" />
              Cross-Platform
            </div>
          </q-card-section>

          <q-card-section>
            <p>Deploy to SPA, PWA, Electron, Mobile (Capacitor/Cordova), and SSR from one codebase.</p>
          </q-card-section>

          <q-card-actions>
            <q-btn flat label="Platforms" href="https://quasar.dev/start/quasar-cli" target="_blank" />
          </q-card-actions>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              <q-icon name="palette" class="q-mr-sm" />
              Material Design
            </div>
          </q-card-section>

          <q-card-section>
            <p>Beautiful Material Design 2 components with comprehensive theming support.</p>
          </q-card-section>

          <q-card-actions>
            <q-btn flat label="Components" href="https://quasar.dev/components" target="_blank" />
          </q-card-actions>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card>
          <q-card-section>
            <div class="text-h6">
              <q-icon name="bolt" class="q-mr-sm" />
              Vite Powered
            </div>
          </q-card-section>

          <q-card-section>
            <p>Lightning-fast HMR and optimized production builds with Vite.</p>
          </q-card-section>

          <q-card-actions>
            <q-btn flat label="Performance" href="https://quasar.dev/start/vite" target="_blank" />
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <div class="q-mt-xl">
      <q-banner class="bg-primary text-white">
        <template v-slot:avatar>
          <q-icon name="info" />
        </template>
        Press <kbd>F</kbd> to open Quasar DevTools for component inspection and performance monitoring.
      </q-banner>
    </div>
  </q-page>
</template>

<script setup>
import { useQuasar } from 'quasar';

const $q = useQuasar();

// Access store
import { useExampleStore } from 'stores/example-store';
const exampleStore = useExampleStore();
</script>
`;
  }

  protected generateAboutPage() {
    return `<template>
  <q-page class="q-pa-md">
    <div class="text-h4 q-mb-md">About ${this.context.name}</div>

    <q-separator class="q-my-md" />

    <div class="text-h6 q-mb-md">Tech Stack</div>

    <q-list bordered separator>
      <q-item>
        <q-item-section avatar>
          <q-icon color="primary" name="code" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Vue 3</q-item-label>
          <q-item-label caption>Progressive JavaScript framework</q-item-label>
        </q-item-section>
      </q-item>

      <q-item>
        <q-item-section avatar>
          <q-icon color="secondary" name="layers" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Quasar Framework</q-item-label>
          <q-item-label caption>Vue 3 based framework</q-item-label>
        </q-item-section>
      </q-item>

      <q-item>
        <q-item-section avatar>
          <q-icon color="accent" name="style" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Material Design 2</q-item-label>
          <q-item-label caption>Google's design system</q-item-label>
        </q-item-section>
      </q-item>

      <q-item>
        <q-item-section avatar>
          <q-icon color="info" name="speed" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Vite</q-item-label>
          <q-item-label caption>Next generation frontend tooling</q-item-label>
        </q-item-section>
      </q-item>

      <q-item>
        <q-item-section avatar>
          <q-icon color="positive" name="storage" />
        </q-item-section>
        <q-item-section>
          <q-item-label>Pinia</q-item-label>
          <q-item-label caption>State management</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <div class="text-h6 q-mt-xl q-mb-md">Features</div>

    <q-chip v-for="feature in features" :key="feature" :label="feature" class="q-mr-sm q-mb-sm" />

    <q-separator class="q-my-md" />

    <q-card flat bordered class="q-mt-md">
      <q-card-section>
        <div class="text-h6">Cross-Platform Support</div>
        <p class="q-mt-md">
          This Quasar app can be built for multiple platforms:
        </p>
        <ul>
          <li>SPA (Single Page Application)</li>
          <li>PWA (Progressive Web App)</li>
          <li>SSR (Server-Side Rendered)</li>
          <li>Electron (Desktop)</li>
          <li>Capacitor/Cordova (Mobile)</li>
        </ul>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup>
import { ref } from 'vue';

const features = [
  'Material Design Components',
  'Responsive Layout',
  'Dark Mode Support',
  'RTL Support',
  'Tree Shaking',
  'Quasar CLI',
  'Vue Router Integration',
  'Pinia State Management',
  'i18n Support',
  'Unit Testing Ready'
];
</script>
`;
  }

  protected generateMainLayout() {
    return `<template>
  <q-layout view="lHh lpr lFf">
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title>
          ${this.context.name}
        </q-toolbar-title>

        <q-btn flat round dense icon="person" />
        <q-btn flat round dense icon="settings" class="q-ml-sm" />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      bordered
      :width="250"
      :breakpoint="600"
    >
      <q-scroll-area style="height: calc(100% - 150px); margin-top: 150px;">
        <q-list padding>
          <q-item
            v-for="link in essentialLinks"
            :key="link.title"
            clickable
            :to="link.link"
            exact
          >
            <q-item-section avatar>
              <q-icon :name="link.icon" />
            </q-item-section>

            <q-item-section>
              <q-item-label>{{ link.title }}</q-item-label>
              <q-item-label caption>{{ link.caption }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-scroll-area>

      <q-img class="absolute-top" src="https://cdn.quasar.dev/img/material.png" style="height: 150px">
        <div class="absolute-bottom bg-transparent">
          <q-avatar size="56px" class="q-mb-sm">
            <img src="https://cdn.quasar.dev/img/boy-avatar.png">
          </q-avatar>
          <div class="text-weight-bold">${this.context.name}</div>
          <div>@${this.context.org}</div>
        </div>
      </q-img>
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-footer elevated class="bg-grey-8 text-white">
      <q-toolbar>
        <q-toolbar-title>
          <div>{{ $q.screen.gt.sm ? '© ' + new Date().getFullYear() + ' ${this.context.name}' : '' }}</div>
        </q-toolbar-title>
        <q-btn flat round dense icon="favorite" />
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue';
import EssentialLink from 'components/EssentialLink.vue';

const essentialLinks = ref([
  {
    title: 'Home',
    caption: 'quasar.dev',
    icon: 'home',
    link: '/'
  },
  {
    title: 'Docs',
    caption: 'quasar.dev',
    icon: 'school',
    link: 'https://quasar.dev'
  },
  {
    title: 'Github',
    caption: 'github.com/quasarframework',
    icon: 'code',
    link: 'https://github.com/quasarframework'
  },
  {
    title: 'Discord Chat Channel',
    caption: 'chat.quasar.dev',
    icon: 'chat',
    link: 'https://chat.quasar.dev'
  },
  {
    title: 'Forum',
    caption: 'forum.quasar.dev',
    icon: 'record_voice_over',
    link: 'https://forum.quasar.dev'
  },
  {
    title: 'Twitter',
    caption: '@quasarframework',
    icon: 'rss_feed',
    link: 'https://twitter.quasar.dev'
  },
  {
    title: 'Facebook',
    caption: '@QuasarFramework',
    icon: 'public',
    link: 'https://facebook.quasar.dev'
  },
  {
    title: 'Quasar Awesome',
    caption: 'Community Quasar projects',
    icon: 'favorite',
    link: 'https://awesome.quasar.dev'
  }
]);

const leftDrawerOpen = ref(false);

function toggleLeftDrawer() {
  leftDrawerOpen.value = !leftDrawerOpen.value;
}
</script>
`;
  }

  protected generateEssentialLink() {
    return `<template>
  <a
    :href="link.link"
    class="essential-link"
    :target="link.isExternal ? '_blank' : undefined"
  >
    <q-item
      v-ripple
      clickable
      :to="link.link"
      :active="link.link === route.path"
      exact
    >
      <q-item-section avatar>
        <q-icon :name="link.icon" :color="link.link === route.path ? 'primary' : undefined" />
      </q-item-section>

      <q-item-section>
        <q-item-label>{{ link.title }}</q-item-label>
        <q-item-label caption>{{ link.caption }}</q-item-label>
      </q-item-section>
    </q-item>
  </a>
</template>

<script setup>
import { useRoute } from 'vue-router';

defineProps({
  link: {
    type: Object,
    required: true
  }
});

const route = useRoute();
</script>

<style lang="sass">
.essential-link
  color: inherit
  text-decoration: none
</style>
`;
  }

  protected generateExampleStore() {
    return `import { defineStore } from 'pinia';

export const useExampleStore = defineStore('example', {
  state: () => ({
    counter: 0,
    user: null
  }),

  getters: {
    doubleCount: (state) => state.counter * 2,
    isAuthenticated: (state) => !!state.user
  },

  actions: {
    increment() {
      this.counter++;
    },

    decrement() {
      this.counter--;
    },

    async login(email, password) {
      // Simulate API call
      const user = { email, name: 'User Name' };
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));
    },

    logout() {
      this.user = null;
      localStorage.removeItem('user');
    },

    loadUser() {
      const stored = localStorage.getItem('user');
      if (stored) {
        this.user = JSON.parse(stored);
      }
    }
  }
});
`;
  }

  protected generateRoutes() {
    return `const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') },
      { path: 'about', component: () => import('pages/AboutPage.vue') }
    ]
  },

  // Always leave this as last one
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
];

export default routes;
`;
  }

  protected generateAppCss() {
    return `// app global css
`;
  }

  protected generateEnvExample() {
    return `# Quasar Environment Variables
# https://quasar.dev/quasar-cli-vite/quasar-config-vars

# API Configuration
VUE_APP_API_URL=http://localhost:3000/api
VUE_APP_API_KEY=your-api-key-here

# Feature Flags
VUE_APP_FEATURE_DARKMODE=true
VUE_APP_FEATURE_I18N=false

# Build Configuration
NODE_ENV=development
`;
  }

  protected generateExtensions() {
    return JSON.stringify({
      '@quasar/app-vite': {}
    }, null, 2);
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with [Quasar Framework](https://quasar.dev) - The all-in-one UI framework for building high-performance Vue 3 applications.

## Features

- **Quasar Framework**: Vue 3 based framework
- **Material Design 2**: Beautiful and responsive components
- **Cross-Platform**: SPA, PWA, SSR, Electron, Mobile (Capacitor/Cordova)
- **Vite Powered**: Lightning-fast HMR and optimized builds
- **Pinia**: State management
- **Vue Router**: Routing with nested routes
- **TypeScript**: Full type support (optional)
- **i18n**: Internationalization support
- **RTL**: Right-to-left language support
- **Tree Shaking**: Optimized bundle size

## Platforms

Build your app for multiple platforms from a single codebase:

- **SPA**: Single Page Application
- **PWA**: Progressive Web App
- **SSR**: Server-Side Rendered
- **Electron**: Desktop app (Windows, Mac, Linux)
- **Capacitor**: Mobile app (iOS, Android)
- **Cordova**: Legacy mobile app support

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
quasar dev
\`\`\`

Open [http://localhost:9000](http://localhost:9000) in your browser.

### Build

\`\`\`bash
# SPA (default)
npm run build

# PWA
npm run build:pwa

# Electron
npm run build:electron
\`\`\`

### Linting

\`\`\`bash
npm run lint
\`\`\`

## Project Structure

\`\`\`
src/
├── assets/           # Static assets
├── components/       # Reusable Vue components
├── layouts/          # Layout components
│   └── MainLayout.vue
├── pages/            # Page components (routes)
│   ├── IndexPage.vue
│   └── AboutPage.vue
├── stores/           # Pinia stores
├── router/           # Vue Router configuration
├── boot/             # Boot files
├── css/              # Global styles
├── App.vue           # Root component
└── quasar-config.js  # Quasar configuration
\`\`\`

## Quasar Components

Quasar provides 100+ Material Design components:

\`\`\`vue
<template>
  <q-btn label="Click me" color="primary" />
  <q-card>
    <q-card-section>
      <div class="text-h6">Card Title</div>
    </q-card-section>
  </q-card>
  <q-input v-model="text" label="Name" />
  <q-select v-model="select" :options="options" label="Choose" />
</template>
\`\`\`

[View all components](https://quasar.dev/components)

## State Management with Pinia

\`\`\`js
import { useExampleStore } from 'stores/example-store';

const store = useExampleStore();

store.increment();
console.log(store.counter);
console.log(store.doubleCount);
\`\`\`

## Routing

File-based routing or explicit routing with Vue Router:

\`\`\`js
// src/router/routes.js
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/IndexPage.vue') }
    ]
  }
];
\`\`\`

## Theming

Customize colors and styles in \`quasar.config.js\`:

\`\`\`js
brand: {
  primary: '#1976d2',
  secondary: '#26a69a',
  accent: '#9c27b0'
}
\`\`\`

## Dark Mode

\`\`\`vue
<template>
  <q-toggle
    v-model="darkMode"
    @update:model-value="toggleDarkMode"
    label="Dark Mode"
  />
</template>

<script setup>
import { useQuasar } from 'quasar';

const $q = useQuasar();
const darkMode = ref($q.dark.isActive);

function toggleDarkMode() {
  $q.dark.toggle();
}
</script>
\`\`\`

## Deploy as PWA

\`\`\`bash
npm run build:pwa
\`\`\`

Configure PWA settings in \`quasar.config.js\`:

\`\`\`js
pwa: {
  workboxMode: 'generateSW',
  injectPwaMetaTags: true,
  manifestFilename: 'manifest.json'
}
\`\`\`

## Build Electron App

\`\`\`bash
npm run build:electron
\`\`\`

Configure Electron in \`quasar.config.js\`:

\`\`\`js
electron: {
  bundler: 'packager',
  builder: {
    appId: 'org.myapp.app',
    productName: 'My App'
  }
}
\`\`\`

## Docker

### Build

\`\`\`bash
docker build -t ${this.context.normalizedName} .
\`\`\`

### Run

\`\`\`bash
docker run -p 9000:9000 ${this.context.normalizedName}
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

# Output in dist/spa directory
\`\`\`

## Documentation

- [Quasar Documentation](https://quasar.dev)
- [Quasar Components](https://quasar.dev/components)
- [Quasar CLI](https://quasar.dev/quasar-cli-vite)
- [Vue 3 Documentation](https://vuejs.org/)
- [Pinia Documentation](https://pinia.vuejs.org/)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for Quasar SPA

# Dependencies stage
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 quasar

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist/spa ./dist

RUN chown -R quasar:nodejs /app

USER quasar

EXPOSE 9000

ENV PORT=9000

CMD ["npx", "serve", "-s", "dist", "-l", "9000"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "9000:9000"
    environment:
      - NODE_ENV=production
      - PORT=9000
    restart: unless-stopped
`;
  }
}
