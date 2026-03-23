import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class VuePressTemplate extends BaseTemplate {
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

    // VuePress config
    files.push({
      path: 'docs/.vuepress/config.ts',
      content: this.generateVuePressConfig()
    });

    // TypeScript config
    files.push({
      path: 'docs/.vuepress/tsconfig.json',
      content: this.generateTsConfig()
    });

    // Layouts
    files.push({
      path: 'docs/.vuepress/layouts/Layout.vue',
      content: this.generateLayout()
    });

    files.push({
      path: 'docs/.vuepress/layouts/Home.vue',
      content: this.generateHomeLayout()
    });

    // Components
    files.push({
      path: 'docs/.vuepress/components/Counter.vue',
      content: this.generateCounter()
    });

    files.push({
      path: 'docs/.vuepress/components/Badge.vue',
      content: this.generateBadge()
    });

    files.push({
      path: 'docs/.vuepress/components/FeatureCard.vue',
      content: this.generateFeatureCard()
    });

    // Styles
    files.push({
      path: 'docs/.vuepress/styles/index.scss',
      content: this.generateStyles()
    });

    files.push({
      path: 'docs/.vuepress/styles/palette.scss',
      content: this.generatePalette()
    });

    // Pages
    files.push({
      path: 'docs/index.md',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'docs/guide/index.md',
      content: this.generateGuideIndex()
    });

    files.push({
      path: 'docs/guide/getting-started.md',
      content: this.generateGettingStarted()
    });

    files.push({
      path: 'docs/guide/configuration.md',
      content: this.generateConfiguration()
    });

    files.push({
      path: 'docs/components/index.md',
      content: this.generateComponentsIndex()
    });

    // Blog posts
    files.push({
      path: 'docs/blog/2024-01-15-introduction.md',
      content: this.generateBlogPost()
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

    files.push({
      path: 'docker-compose.yml',
      content: this.generateDockerCompose()
    });

    return files;
  }

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '1.0.0',
      description: `${this.context.name} - VuePress Documentation Site`,
      type: 'module',
      scripts: {
        'docs:dev': 'vuepress dev docs',
        'docs:build': 'vuepress build docs',
        'docs:preview': 'vuepress preview docs',
        'lint': 'eslint --ext .js,.ts,.vue .',
        'format': 'prettier --write .'
      },
      dependencies: {
        'vue': '^3.4.0',
        'vuepress': '^2.0.0-rc.15',
        '@vuepress/client': '^2.0.0-rc.15',
        '@vuepress/bundler-vite': '^2.0.0-rc.15',
        '@vuepress/bundler-webpack': '^2.0.0-rc.15'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        '@vuepress/plugin-docsearch': '^2.0.0-rc.32',
        '@vuepress/plugin-search': '^2.0.0-rc.32',
        '@vuepress/plugin-register-components': '^2.0.0-rc.32',
        '@vuepress/plugin-shiki': '^2.0.0-rc.32',
        'eslint': '^8.56.0',
        'eslint-plugin-vue': '^9.20.0',
        'prettier': '^3.2.0',
        'sass': '^1.70.0',
        'sass-loader': '^14.0.0',
        'typescript': '^5.3.3'
      },
      engines: {
        node: '>=18.16.0',
        npm: '>=9.0.0'
      }
    };
  }

  private generateVuePressConfig() {
    return `import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress/cli'
import { viteBundler } from '@vuepress/bundler-vite'
import { docsearchPlugin } from '@vuepress/plugin-docsearch'
import { registerComponentsPlugin } from '@vuepress/plugin-register-components'
import { shikiPlugin } from '@vuepress/plugin-shiki'
import { getDirname, path } from '@vuepress/utils'

const __dirname = getDirname(import.meta.url)

export default defineUserConfig({
  lang: 'en-US',
  title: '${this.context.name}',
  description: '${this.context.description || this.context.name + ' Documentation'}',

  bundler: viteBundler({
    viteOptions: {
      build: {
        chunkSizeWarningLimit: 1000,
      },
    },
    cssCodeSplit: true,
  }),

  // Page meta
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en-US' }],
    ['meta', { property: 'og:title', content: '${this.context.name}' }],
    ['meta', { property: 'og:site_name', content: '${this.context.name}' }],
    ['meta', { property: 'og:description', content: '${this.context.description || this.context.name + ' Documentation'}' }],
  ],

  // Theme configuration
  theme: defaultTheme({
    logo: '/logo.png',

    navbar: [
      {
        text: 'Guide',
        link: '/guide/',
      },
      {
        text: 'Components',
        link: '/components/',
      },
      {
        text: 'Blog',
        link: '/blog/',
      },
      {
        text: 'GitHub',
        link: 'https://github.com/your-username/${this.context.normalizedName}',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          children: [
            '/guide/getting-started.md',
            '/guide/configuration.md',
          ],
        },
      ],
      '/components/': [
        {
          text: 'Components',
          children: [
            '/components/index.md',
          ],
        },
      ],
    },

    // Edit link
    editLink: true,
    editLinkPattern: 'https://github.com/your-username/${this.context.normalizedName}/edit/main/docs/:path',

    // Last updated
    lastUpdated: true,
    lastUpdatedText: 'Last Updated',

    // Contributors
    contributors: true,
    contributorsText: 'Contributors',

    // Display color mode toggle
    colorMode: 'auto',

    // Theme color
    themePlugins: {
      // Enable some plugins
      git: true,
      // Disable some plugins if needed
      prismjs: false, // Using Shiki instead
    },
  }),

  // Plugins
  plugins: [
    docsearchPlugin({
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_API_KEY',
      indexName: '${this.context.normalizedName}',
      locales: {
        '/': {
          placeholder: 'Search documentation',
          translations: {
            button: {
              buttonText: 'Search documentation',
              buttonAriaLabel: 'Search documentation',
            },
          },
        },
      },
    }),

    registerComponentsPlugin({
      componentsDir: path.resolve(__dirname, './components'),
    }),

    shikiPlugin({
      theme: 'github-dark',
      lineNumbers: true,
    }),
  ],

  // Markdown
  markdown: {
    importCode: {
      handleImportPath: (importPath: string) => {
        // Transform import path for code blocks
        return importPath.replace(/^@/, require('path').resolve(__dirname, '../../'));
      },
    },
  },
})`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compilerOptions: {
        baseUrl: '.',
        strictNullChecks: true,
        module: 'ESNext',
        target: 'ES2020',
        moduleResolution: 'Bundler',
        allowSyntheticDefaultImports: true,
        jsx: 'preserve',
        jsxImportSource: 'vue',
        paths: {
          '@': ['./src'],
          '@theme': ['./client/theme-default'],
        }
      },
      include: ['**/*.ts', '**/*.vue', '**/*.d.ts'],
      exclude: ['node_modules']
    }, null, 2);
  }

  private generateLayout() {
    return `<template>
  <div class="theme-container">
    <Navbar />
    <div class="container">
      <main class="main">
        <Content />
      </main>
      <Sidebar />
    </div>
    <Footer />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePageData } from '@vuepress/client'
import Navbar from '@theme/components/Navbar.vue'
import Sidebar from '@theme/components/Sidebar.vue'
import Footer from '@theme/components/Footer.vue'

const pageData = usePageData()
const title = computed(() => pageData.value.title)
</script>

<style scoped lang="scss">
.theme-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.container {
  flex: 1;
  display: flex;
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  gap: 2rem;
}

.main {
  flex: 1;
  min-width: 0;
}

@media (max-width: 768px) {
  .container {
    flex-direction: column;
    padding: 1rem;
  }
}
</style>
`;
  }

  private generateHomeLayout() {
    return `<template>
  <div class="home">
    <header class="hero">
      <h1 class="hero-title">{{ heroText }}</h1>
      <p class="hero-description">{{ tagline }}</p>
      <div class="hero-actions">
        <a class="action-button primary" href="/guide/getting-started.html">
          Get Started
        </a>
        <a class="action-button secondary" href="/guide/">
          Learn More
        </a>
      </div>
    </header>

    <section class="features">
      <div class="feature-grid">
        <FeatureCard
          v-for="feature in features"
          :key="feature.title"
          :title="feature.title"
          :description="feature.description"
          :icon="feature.icon"
        />
      </div>
    </section>

    <section class="demo">
      <h2>Interactive Demo</h2>
      <Counter :initial-value="0" />
    </section>

    <section class="community">
      <h2>Join the Community</h2>
      <p>Follow us on GitHub for the latest updates</p>
      <a class="action-button" href="https://github.com/your-username/${this.context.normalizedName}">
        View on GitHub
      </a>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Counter from '@components/Counter.vue'
import FeatureCard from '@components/FeatureCard.vue'

const heroText = ref('${this.context.name}')
const tagline = ref('${this.context.description || 'A modern documentation site built with VuePress'}')

const features = ref([
  {
    title: 'Fast Performance',
    description: 'Lightning-fast page loads with Vue 3 and optimized bundling',
    icon: '⚡'
  },
  {
    title: 'Rich Components',
    description: 'Beautiful, interactive components built with Vue 3 Composition API',
    icon: '🎨'
  },
  {
    title: 'SEO Friendly',
    description: 'Built-in SEO optimization and metadata management',
    icon: '🔍'
  },
  {
    title: 'TypeScript Support',
    description: 'Full TypeScript support for type-safe development',
    icon: '📘'
  },
  {
    title: 'Themeable',
    description: 'Customizable themes with dark mode support',
    icon: '🎭'
  },
  {
    title: 'Plugin Ecosystem',
    description: 'Extensible with VuePress plugins and custom components',
    icon: '🔌'
  }
])
</script>

<style scoped lang="scss">
.home {
  padding: 0 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 6rem 0;
}

.hero-title {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
  background: linear-gradient(120deg, #3eaf7c, #42b983);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: 1.25rem;
  color: var(--c-text-light);
  margin-bottom: 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.action-button {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.3s ease;

  &.primary {
    background: var(--c-brand);
    color: #fff;

    &:hover {
      background: var(--c-brand-light);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(62, 175, 124, 0.3);
    }
  }

  &.secondary {
    background: var(--c-bg-soft);
    color: var(--c-text);

    &:hover {
      background: var(--c-bg-soft-hover);
      transform: translateY(-2px);
    }
  }
}

.features {
  padding: 4rem 0;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 3rem;
}

.demo {
  padding: 4rem 0;
  text-align: center;

  h2 {
    margin-bottom: 2rem;
  }
}

.community {
  text-align: center;
  padding: 4rem 0;

  h2 {
    margin-bottom: 1rem;
  }

  p {
    color: var(--c-text-light);
    margin-bottom: 2rem;
  }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-description {
    font-size: 1rem;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
`;
  }

  private generateCounter() {
    return `<template>
  <div class="counter">
    <div class="counter-display">{{ count }}</div>
    <div class="counter-controls">
      <button class="counter-btn" @click="decrement" :disabled="count <= min">
        −
      </button>
      <button class="counter-btn" @click="reset">
        Reset
      </button>
      <button class="counter-btn" @click="increment" :disabled="count >= max">
        +
      </button>
    </div>
    <div class="counter-info">
      <Badge :text="'Min: ' + min" type="tip" />
      <Badge :text="'Max: ' + max" type="tip" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Badge from './Badge.vue'

interface Props {
  initialValue?: number
  min?: number
  max?: number
}

const props = withDefaults(defineProps<Props>(), {
  initialValue: 0,
  min: 0,
  max: 100
})

const count = ref(props.initialValue)

const increment = () => {
  if (count.value < props.max) {
    count.value++
  }
}

const decrement = () => {
  if (count.value > props.min) {
    count.value--
  }
}

const reset = () => {
  count.value = props.initialValue
}

// Expose methods for parent components
defineExpose({
  increment,
  decrement,
  reset
})
</script>

<style scoped lang="scss">
.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  border: 2px solid var(--c-border);
  border-radius: 0.75rem;
  background: var(--c-bg-soft);
}

.counter-display {
  font-size: 4rem;
  font-weight: 700;
  color: var(--c-brand);
  font-variant-numeric: tabular-nums;
}

.counter-controls {
  display: flex;
  gap: 1rem;
}

.counter-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  border: 2px solid var(--c-border);
  border-radius: 0.5rem;
  background: var(--c-bg);
  color: var(--c-text);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--c-brand);
    color: #fff;
    border-color: var(--c-brand);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(62, 175, 124, 0.2);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.counter-info {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}
</style>
`;
  }

  private generateBadge() {
    return `<template>
  <span class="badge" :class="[\`badge-\${type}\`]">
    <slot>{{ text }}</slot>
  </span>
</template>

<script setup lang="ts">
interface Props {
  text?: string
  type?: 'tip' | 'warning' | 'danger' | 'info'
}

withDefaults(defineProps<Props>(), {
  type: 'info'
})
</script>

<style scoped lang="scss">
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 1rem;
  white-space: nowrap;

  &.badge-tip {
    background: var(--c-tip-bg);
    color: var(--c-tip-text);
    border: 1px solid var(--c-tip-border);
  }

  &.badge-warning {
    background: var(--c-warning-bg);
    color: var(--c-warning-text);
    border: 1px solid var(--c-warning-border);
  }

  &.badge-danger {
    background: var(--c-danger-bg);
    color: var(--c-danger-text);
    border: 1px solid var(--c-danger-border);
  }

  &.badge-info {
    background: var(--c-info-bg);
    color: var(--c-info-text);
    border: 1px solid var(--c-info-border);
  }
}
</style>
`;
  }

  private generateFeatureCard() {
    return `<template>
  <div class="feature-card">
    <div class="feature-icon">{{ icon }}</div>
    <h3 class="feature-title">{{ title }}</h3>
    <p class="feature-description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  description: string
  icon: string
}

defineProps<Props>()
</script>

<style scoped lang="scss">
.feature-card {
  padding: 2rem;
  border: 2px solid var(--c-border);
  border-radius: 0.75rem;
  background: var(--c-bg);
  transition: all 0.3s ease;

  &:hover {
    border-color: var(--c-brand);
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(62, 175, 124, 0.15);
  }
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: var(--c-text);
}

.feature-description {
  color: var(--c-text-light);
  line-height: 1.6;
}
</style>
`;
  }

  private generateStyles() {
    return `// Global styles for VuePress site

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

// Custom scrollbar
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--c-bg-soft);
}

::-webkit-scrollbar-thumb {
  background: var(--c-border);
  border-radius: 4px;

  &:hover {
    background: var(--c-text-light);
  }
}

// Smooth scrolling
html {
  scroll-behavior: smooth;
}

// Selection
::selection {
  background: var(--c-brand);
  color: #fff;
}

// Focus styles
:focus-visible {
  outline: 2px solid var(--c-brand);
  outline-offset: 2px;
}
`;
  }

  private generatePalette() {
    return `// Color palette customization

// Brand colors
$c-brand: #3eaf7c;
$c-brand-light: #4abf8a;
$c-brand-dark: #349666;

// Background colors
$c-bg: #ffffff;
$c-bg-soft: #f8f9fa;
$c-bg-soft-hover: #e9ecef;

// Text colors
$c-text: #2c3e50;
$c-text-light: #606266;
$c-text-lighter: #909399;

// Border colors
$c-border: #eaecef;
$c-border-light: #f0f0f0;

// Tip colors
$c-tip: #3eaf7c;
$c-tip-bg: #f0f9ff;
$c-tip-text: #0c5132;
$c-tip-border: #a8dcc8;

// Warning colors
$c-warning: #e7c000;
$c-warning-bg: #fff8e6;
$c-warning-text: #6d4e00;
$c-warning-border: #f5d76e;

// Danger colors
$c-danger: #f26d6d;
$c-danger-bg: #ffe6e6;
$c-danger-text: #7a2323;
$c-danger-border: #f5b2b2;

// Info colors
$c-info: #3aa675;
$c-info-bg: #f0f9ff;
$c-info-text: #0c5132;
$c-info-border: #a8dcc8;
`;
  }

  private generateIndexPage() {
    return `---
home: true
title: ${this.context.name}
heroImage: /logo.png
heroText: ${this.context.name}
tagline: ${this.context.description || 'A modern documentation site built with VuePress'}
actions:
  - text: Get Started
    link: /guide/getting-started.html
    type: primary
  - text: Learn More
    link: /guide/
    type: secondary

features:
  - title: Fast Performance
    details: Lightning-fast page loads with Vue 3 and optimized bundling
    icon: ⚡
  - title: Rich Components
    details: Beautiful, interactive components built with Vue 3 Composition API
    icon: 🎨
  - title: SEO Friendly
    details: Built-in SEO optimization and metadata management
    icon: 🔍
  - title: TypeScript Support
    details: Full TypeScript support for type-safe development
    icon: 📘
  - title: Themeable
    details: Customizable themes with dark mode support
    icon: 🎭
  - title: Plugin Ecosystem
    details: Extensible with VuePress plugins and custom components
    icon: 🔌

footer: MIT Licensed | Copyright © 2024-${this.context.normalizedName}
---

## Interactive Demo

Try the Vue 3 counter component below:

<Counter :initial-value="0" />

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run docs:dev

# Build for production
npm run docs:build
\`\`\`

## Documentation

Explore the documentation to learn more:

- [Getting Started](/guide/getting-started.html)
- [Configuration](/guide/configuration.html)
- [Components](/components/)
`;
  }

  private generateGuideIndex() {
    return `---
title: Guide
icon: 📚
---

# Welcome to ${this.context.name}

This guide will help you get started with ${this.context.name} and VuePress.

## What is VuePress?

VuePress is a static site generator built on Vue 3, optimized for writing technical documentation.

## Key Features

- **Vue 3 Powered**: Built with Vue 3 Composition API
- **High Performance**: Fast page loads and optimized builds
- **Markdown Extensions**: Enhanced Markdown with custom syntax
- **Plugin System**: Extensible with community plugins
- **TypeScript**: Full TypeScript support

## Table of Contents

- [Getting Started](./getting-started.md)
- [Configuration](./configuration.md)
`;
  }

  private generateGettingStarted() {
    return `---
title: Getting Started
icon: 🚀
prev:
  text: Guide
  link: /guide/
next:
  text: Configuration
  link: /guide/configuration.html
---

# Getting Started

## Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/your-username/${this.context.normalizedName}.git
cd ${this.context.normalizedName}

# Install dependencies
npm install
\`\`\`

## Development

\`\`\`bash
# Start development server
npm run docs:dev
\`\`\`

Visit \`http://localhost:8080\` to see your documentation site.

## Building

\`\`\`bash
# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── docs/
│   ├── .vuepress/
│   │   ├── config.ts       # VuePress configuration
│   │   ├── components/     # Custom Vue components
│   │   ├── layouts/        # Custom layouts
│   │   └── styles/         # Global styles
│   ├── guide/              # Guide documentation
│   ├── components/         # Component documentation
│   └── blog/               # Blog posts
└── package.json
\`\`\`

## Writing Content

### Markdown

Create \`.md\` files in the \`docs\` directory:

\`\`\`markdown
---
title: My Page
---

# My Page Title

Content goes here...
\`\`\`

### Front Matter

Use front matter to configure page metadata:

\`\`\`yaml
---
title: Page Title
description: Page description
icon: 📝
prev:
  text: Previous Page
  link: /previous/
next:
  text: Next Page
  link: /next/
---
\`\`\`

### Using Components

Use custom Vue components in your Markdown:

\`\`\`markdown
<Counter :initial-value="5" />

<Badge text="New" type="tip" />
\`\`\`

## Next Steps

- Learn about [Configuration](./configuration.md)
- Explore [Components](../components/)
`;
  }

  private generateConfiguration() {
    return `---
title: Configuration
icon: ⚙️
prev:
  text: Getting Started
  link: /guide/getting-started.html
---

# Configuration

## VuePress Config

The main configuration is in \`docs/.vuepress/config.ts\`:

\`\`\`typescript
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress/cli'
import { viteBundler } from '@vuepress/bundler-vite'

export default defineUserConfig({
  lang: 'en-US',
  title: '${this.context.name}',
  description: 'Your description',

  bundler: viteBundler(),

  theme: defaultTheme({
    // Theme options
  }),
})
\`\`\`

## Theme Configuration

Customize the default theme:

\`\`\`typescript
theme: defaultTheme({
  logo: '/logo.png',

  navbar: [
    { text: 'Guide', link: '/guide/' },
    { text: 'Components', link: '/components/' },
  ],

  sidebar: {
    '/guide/': [
      '/guide/getting-started.md',
      '/guide/configuration.md',
    ],
  },
})
\`\`\`

## Plugins

Add VuePress plugins:

\`\`\`typescript
import { docsearchPlugin } from '@vuepress/plugin-docsearch'

plugins: [
  docsearchPlugin({
    appId: 'YOUR_APP_ID',
    apiKey: 'YOUR_API_KEY',
    indexName: '${this.context.normalizedName}',
  }),
]
\`\`\`

## Styling

Customize colors in \`docs/.vuepress/styles/palette.scss\`:

\`\`\`scss
$c-brand: #3eaf7c;
$c-brand-light: #4abf8a;
\`\`\`

## Environment Variables

Create \`.env\` file:

\`\`\`bash
VUEPRESS_APP_ID=your_app_id
VUEPRESS_API_KEY=your_api_key
\`\`\`
`;
  }

  private generateComponentsIndex() {
    return `---
title: Components
icon: 🧩
---

# Components

This section documents the custom Vue components available in ${this.context.name}.

## Counter Component

An interactive counter with increment, decrement, and reset functionality.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| initialValue | number | 0 | Initial counter value |
| min | number | 0 | Minimum value |
| max | number | 100 | Maximum value |

### Usage

\`\`\`markdown
<Counter :initial-value="5" :min="0" :max="10" />
\`\`\`

### Example

<Counter :initial-value="5" :min="0" :max="10" />

## Badge Component

A badge component for displaying status or information.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| text | string | - | Badge text |
| type | string | 'info' | Badge type: 'tip', 'warning', 'danger', 'info' |

### Usage

\`\`\`markdown
<Badge text="Tip" type="tip" />
<Badge text="Warning" type="warning" />
<Badge text="Danger" type="danger" />
<Badge text="Info" type="info" />
\`\`\`

### Examples

<Badge text="New Feature" type="tip" />
<Badge text="Deprecated" type="warning" />
<Badge text="Breaking" type="danger" />
<Badge text="Information" type="info" />

## FeatureCard Component

A card component for displaying features with icon, title, and description.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| title | string | - | Card title |
| description | string | - | Card description |
| icon | string | - | Icon or emoji |

### Usage

\`\`\`markdown
<FeatureCard
  title="Fast"
  description="Lightning-fast performance"
  icon="⚡"
/>
\`\`\`

### Example

<div class="feature-grid">
  <FeatureCard
    title="Fast"
    description="Lightning-fast performance"
    icon="⚡"
  />
  <FeatureCard
    title="Beautiful"
    description="Modern and clean design"
    icon="🎨"
  />
</div>
`;
  }

  private generateBlogPost() {
    return `---
title: 'Introduction to ${this.context.name}'
date: 2024-01-15
author: '${this.context.name} Team'
tags:
  - announcement
  - introduction
---

# Welcome to ${this.context.name}!

We're excited to introduce ${this.context.name}, a modern documentation site built with VuePress.

## Why VuePress?

We chose VuePress for several reasons:

- **Performance**: Lightning-fast page loads
- **Vue 3**: Built with the latest Vue features
- **Markdown**: Natural documentation workflow
- **Extensible**: Rich plugin ecosystem

## What's Next?

Stay tuned for more updates and tutorials!

## Getting Started

Check out the [Getting Started](/guide/getting-started.html) guide to begin.
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A modern documentation site built with [VuePress](https://vuepress.vuejs.org/).

## Features

- ⚡ **Vue 3 Powered** - Built with Vue 3 Composition API
- 📝 **Markdown Support** - Natural documentation workflow
- 🎨 **Custom Components** - Beautiful, interactive components
- 🔍 **Search** - Built-in search functionality
- 🌙 **Dark Mode** - Automatic theme switching
- 📱 **Responsive** - Mobile-friendly design
- 🚀 **Fast Performance** - Optimized builds and page loads
- 📘 **TypeScript** - Full TypeScript support

## Quick Start

### Installation

\`\`\`bash
# Install dependencies
npm install
\`\`\`

### Development

\`\`\`bash
# Start development server
npm run docs:dev
\`\`\`

Visit \`http://localhost:8080\` to view the documentation site.

### Build

\`\`\`bash
# Build for production
npm run docs:build

# Preview production build
npm run docs:preview
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── docs/
│   ├── .vuepress/
│   │   ├── config.ts       # VuePress configuration
│   │   ├── components/     # Custom Vue components
│   │   ├── layouts/        # Custom layouts
│   │   └── styles/         # Global styles
│   ├── guide/              # Guide documentation
│   ├── components/         # Component documentation
│   └── blog/               # Blog posts
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose setup
└── package.json
\`\`\`

## Customization

### Configuration

Edit \`docs/.vuepress/config.ts\` to customize:

- Site title and description
- Navigation and sidebar
- Theme settings
- Plugins

### Styling

Customize colors in \`docs/.vuepress/styles/palette.scss\`:

\`\`\`scss
$c-brand: #3eaf7c;
$c-brand-light: #4abf8a;
\`\`\`

### Components

Add custom Vue components in \`docs/.vuepress/components/\`:

\`\`\`vue
<template>
  <div class="my-component">
    <!-- Component content -->
  </div>
</template>

<script setup lang="ts">
// Component logic
</script>
\`\`\`

## Docker Deployment

Build and run with Docker:

\`\`\`bash
# Build image
docker build -t ${this.context.normalizedName} .

# Run container
docker run -p 8080:80 ${this.context.normalizedName}
\`\`\`

Or use Docker Compose:

\`\`\`bash
docker-compose up -d
\`\`\`

## Documentation

For more information, visit the [official VuePress documentation](https://vuepress.vuejs.org/).

## License

MIT

---

Generated with [Re-Shell CLI](https://github.com/your-org/re-shell)
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for VuePress documentation site

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run docs:build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/docs/.vuepress/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  ${this.context.normalizedName}:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    labels:
      - "com.${this.context.normalizedName}.description=${this.context.name} Documentation"
      - "com.${this.context.normalizedName}.version=1.0.0"
`;
  }
}
