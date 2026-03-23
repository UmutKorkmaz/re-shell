import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class AstroTemplate extends BaseTemplate {
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

    // Astro config
    files.push({
      path: 'astro.config.mjs',
      content: this.generateAstroConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Layout
    files.push({
      path: 'src/layouts/Layout.astro',
      content: this.generateLayout()
    });

    // Pages
    files.push({
      path: 'src/pages/index.astro',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/pages/about.astro',
      content: this.generateAboutPage()
    });

    files.push({
      path: 'src/pages/blog/index.astro',
      content: this.generateBlogIndex()
    });

    // Components (Islands)
    files.push({
      path: 'src/components/Counter.jsx',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/components/SearchWidget.jsx',
      content: this.generateSearchWidget()
    });

    files.push({
      path: 'src/components/Header.astro',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/components/Footer.astro',
      content: this.generateFooter()
    });

    files.push({
      path: 'src/components/FeatureCard.astro',
      content: this.generateFeatureCard()
    });

    // Styles
    files.push({
      path: 'src/styles/global.css',
      content: this.generateGlobalStyles()
    });

    // Utils
    files.push({
      path: 'src/utils/format.ts',
      content: this.generateFormatUtils()
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
      description: `${this.context.name} - Astro Application`,
      type: 'module',
      scripts: {
        dev: 'astro dev',
        start: 'astro dev',
        build: 'astro check && astro build',
        preview: 'astro preview',
        astro: 'astro'
      },
      dependencies: {
        '@astrojs/react': '^3.0.9',
        '@astrojs/vue': '^4.0.4',
        '@astrojs/svelte': '^5.0.3',
        '@astrojs/tailwind': '^5.1.0',
        'astro': '^4.4.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'vue': '^3.4.15',
        'svelte': '^4.2.9',
        'tailwindcss': '^3.4.1'
      },
      devDependencies: {
        '@types/react': '^18.2.48',
        '@types/react-dom': '^18.2.18',
        '@types/node': '^20.11.0',
        'prettier': '^3.2.4',
        'prettier-plugin-astro': '^0.13.0',
        'typescript': '^5.3.3'
      }
    };
  }

  private generateAstroConfig() {
    return `import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://${this.context.normalizedName}.com',
  integrations: [
    react(),
    vue(),
    svelte(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: 'static',
  build: {
    format: 'directory',
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
`;
  }

  protected generateTsConfig(): string {
    return JSON.stringify({
      extends: 'astro/tsconfigs/strict',
      compilerOptions: {
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
          '@components/*': ['./src/components/*'],
          '@layouts/*': ['./src/layouts/*'],
          '@utils/*': ['./src/utils/*'],
        }
      }
    }, null, 2);
  }

  private generateLayout() {
    return `---
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title: string;
  description?: string;
}

const { title, description = '${this.context.name} - Built with Astro' } = Astro.props;

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="description" content={description} />
    <title>{title}</title>
  </head>
  <body>
    <Header title="${this.context.name}" />
    <main>
      <slot />
    </main>
    <Footer />
  </body>
</html>
`;
  }

  private generateIndexPage() {
    return `---
import Layout from '../layouts/Layout.astro';
import FeatureCard from '../components/FeatureCard.astro';
import Counter from '../components/Counter.jsx';

const features = [
  {
    title: 'Islands Architecture',
    description: 'Hybrid static server rendering with interactive client islands',
    icon: '🏝️'
  },
  {
    title: 'Zero JS by Default',
    description: 'Ship less JavaScript by default with partial hydration',
    icon: '⚡'
  },
  {
    title: 'Framework Agnostic',
    description: 'Use React, Vue, Svelte, or any UI framework together',
    icon: '🔗'
  },
  {
    title: 'Static First',
    description: 'Generate static HTML with optional hydration',
    icon: '📄'
  }
];
---

<Layout title="${this.context.name} - Home">
  <section class="hero">
    <h1>Welcome to ${this.context.name}</h1>
    <p>Built with Astro - Islands Architecture & Partial Hydration</p>
  </section>

  <section class="features">
    {features.map((feature) => (
      <FeatureCard
        title={feature.title}
        description={feature.description}
        icon={feature.icon}
      />
    ))}
  </section>

  <section class="demo">
    <h2>Interactive Counter (React Island)</h2>
    <p class="hint">
      This component uses React for interactivity, but the rest of the page is static HTML!
    </p>
    <Counter client:load />
  </section>
</Layout>

<style>
  .hero {
    text-align: center;
    padding: 4rem 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
  }

  .demo h2 {
    color: #667eea;
    margin-bottom: 1rem;
  }

  .hint {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }
</style>
`;
  }

  private generateAboutPage() {
    return `---
import Layout from '../layouts/Layout.astro';
---

<Layout title="About - ${this.context.name}">
  <h1>About ${this.context.name}</h1>

  <section class="content">
    <p>
      This is an Astro application built with the islands architecture pattern.
      It combines static HTML generation with client-side interactivity only where needed.
    </p>

    <h2>What is Islands Architecture?</h2>
    <p>
      The islands architecture is a pattern where static HTML is generated on the server,
      and "islands" of interactivity are hydrated on the client. This gives you:
    </p>

    <ul>
      <li><strong>Fast initial page loads</strong> - Ship zero JavaScript by default</li>
      <li><strong>Better SEO</strong> - Content is rendered in HTML</li>
      <li><strong>Progressive enhancement</strong> - Enhance with JavaScript where needed</li>
      <li><strong>Framework flexibility</strong> - Use React, Vue, Svelte together</li>
    </ul>

    <h2>Why Astro?</h2>
    <p>
      Astro is designed for content-focused websites where you want:
    </p>

    <ul>
      <li>Fast page loads with minimal JavaScript</li>
      <li>Great SEO out of the box</li>
      <li>The ability to use any UI framework you want</li>
      <li>Static site generation with server capabilities</li>
    </ul>
  </section>
</Layout>

<style>
  h1 {
    color: #667eea;
    margin-bottom: 2rem;
  }

  .content {
    max-width: 800px;
  }

  h2 {
    color: #667eea;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  p {
    line-height: 1.8;
    margin-bottom: 1rem;
  }

  ul {
    margin-left: 2rem;
    margin-bottom: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
  }
</style>
`;
  }

  private generateBlogIndex() {
    return `---
import Layout from '../../layouts/Layout.astro';

const posts = (await Astro.glob('./**/*.md')).sort((a, b) =>
  b.frontmatter.date.valueOf() - a.frontmatter.date.valueOf()
);

const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};
---

<Layout title="Blog - ${this.context.name}">
  <h1>Blog</h1>

  {posts.length === 0 ? (
    <p>No posts yet!</p>
  ) : (
    <div class="posts">
      {posts.map((post) => (
        <article class="post">
          <h2>
            <a href={post.url}>{post.frontmatter.title}</a>
          </h2>
          <p class="date">{formatDate(post.frontmatter.date)}</p>
          <p>{post.frontmatter.description}</p>
        </article>
      ))}
    </div>
  )}
</Layout>

<style>
  h1 {
    color: #667eea;
    margin-bottom: 2rem;
  }

  .posts {
    display: grid;
    gap: 2rem;
  }

  .post {
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .post h2 {
    margin-bottom: 0.5rem;
  }

  .post h2 a {
    color: #667eea;
    text-decoration: none;
  }

  .post h2 a:hover {
    text-decoration: underline;
  }

  .date {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }
</style>
`;
  }

  private generateCounter() {
    return `import { useState } from 'react';
import './Counter.css';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="counter">
      <div className="counter-display">
        <span className="count">{count}</span>
      </div>

      <div className="counter-controls">
        <button
          onClick={ => setCount(count - 1)}
          disabled={count <= 0}
          aria-label="Decrement"
          className="btn btn-secondary"
        >
          −
        </button>
        <button
          onClick={ => setCount(0)}
          aria-label="Reset"
          className="btn btn-reset"
        >
          ↺ Reset
        </button>
        <button
          onClick={ => setCount(count + 1)}
          aria-label="Increment"
          className="btn btn-primary"
        >
          +
        </button>
      </div>

      <div className="counter-info">
        <span>Min: 0</span>
        <span>Max: ∞</span>
      </div>
    </div>
  );
}
`;
  }

  private generateSearchWidget() {
    return `import { useState, useEffect } from 'react';

export default function SearchWidget() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query.length > 2) {
      // Simulated search
      const mockResults = [
        'Getting Started with Astro',
        'Understanding Islands Architecture',
        'Building Static Sites with Astro',
        'Using React with Astro'
      ].filter(item =>
        item.toLowerCase().includes(query.toLowerCase())
      );
      setResults(mockResults);
    } else {
      setResults([]);
    }
  }, [query]);

  return (
    <div className="search-widget">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search articles..."
        className="search-input"
      />
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((result, index) => (
            <li key={index}>{result}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
`;
  }

  private generateHeader() {
    return `---
interface Props {
  title: string;
}

const { title } = Astro.props;
---

<header class="header">
  <div class="container">
    <a href="/" class="logo">{title}</a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/blog/">Blog</a>
    </nav>
  </div>
</header>

<style>
  .header {
    background: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: #667eea;
    text-decoration: none;
  }

  .nav {
    display: flex;
    gap: 2rem;
    list-style: none;
  }

  .nav a {
    color: #212121;
    text-decoration: none;
    transition: color 0.2s;
  }

  .nav a:hover {
    color: #667eea;
  }
</style>
`;
  }

  private generateFooter() {
    return `---
const year = new Date().getFullYear();
---

<footer class="footer">
  <div class="container">
    <p>&copy; {year} ${this.context.name}. Built with Astro.</p>
    <p class="footer-links">
      <a href="https://astro.build" target="_blank" rel="noopener noreferrer">
        Astro Docs
      </a>
      <span>•</span>
      <a href="https://docs.astro.build" target="_blank" rel="noopener noreferrer">
        Guide
      </a>
      <span>•</span>
      <a href="https://github.com/withastro/astro" target="_blank" rel="noopener noreferrer">
        GitHub
      </a>
    </p>
  </div>
</footer>

<style>
  .footer {
    background: #212121;
    color: white;
    text-align: center;
    padding: 2rem 0;
    margin-top: 4rem;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .footer-links {
    margin-top: 1rem;
  }

  .footer-links a {
    color: white;
    text-decoration: none;
  }

  .footer-links a:hover {
    text-decoration: underline;
  }
</style>
`;
  }

  private generateFeatureCard() {
    return `---
interface Props {
  title: string;
  description: string;
  icon: string;
}

const { title, description, icon } = Astro.props;
---

<div class="feature-card">
  <div class="feature-icon">{icon}</div>
  <h3 class="feature-title">{title}</h3>
  <p class="feature-description">{description}</p>
</div>

<style>
  .feature-card {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  }

  .feature-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .feature-title {
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
    color: #667eea;
  }

  .feature-description {
    color: #666;
    line-height: 1.6;
  }
</style>
`;
  }

  private generateGlobalStyles() {
    return `/**
 * Global Styles
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #667eea;
  --primary-light: #9c4dcc;
  --primary-dark: #5a67d8;
  --text: #212121;
  --text-secondary: #666;
  --background: #fafafa;
  --surface: #ffffff;
  --border: #e0e0e0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background: var(--background);
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

@media (max-width: 768px) {
  main {
    padding: 1rem;
  }
}
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

  protected generateReadme() {
    return `# ${this.context.name}

An Astro application built with islands architecture, partial hydration, and multi-framework support.

## Overview

This template provides a complete Astro site with static HTML generation, interactive islands, and support for React, Vue, and Svelte components.

## Features

- 🏝️ **Islands Architecture** - Static HTML with interactive client islands
- ⚡ **Zero JS by Default** - Ship minimal JavaScript
- 🔗 **Framework Agnostic** - Use React, Vue, Svelte together
- 📄 **Static First** - Generate static HTML with optional hydration
- 🎨 **Tailwind CSS** - Utility-first CSS framework
- 📦 **Content Collections** - Blog posts and markdown support

## Getting Started

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
\`\`\`

## Islands Architecture

Astro uses the islands architecture pattern:

\`\`\`astro
---
// Static HTML (no JS)
import InteractiveComponent from '../components/InteractiveComponent.jsx';
---

<div>
  <h1>This is static HTML</h1>

  <!-- Interactive island (hydrated) -->
  <InteractiveComponent client:load />
</div>
\`\`\`

## Client Directives

Control hydration with client directives:

- \`client:load\` - Hydrate immediately on page load
- \`client:idle\` - Hydrate when browser is idle
- \`client:visible\` - Hydrate when component enters viewport
- \`client:media={query}\` - Hydrate when media query matches

## Multi-Framework Support

Use components from different frameworks:

### React Island

\`\`\`jsx
// src/components/Counter.jsx
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={ => setCount(count + 1)}>{count}</button>;
}
\`\`\`

### Vue Island

\`\`\`vue
<!-- src/components/SearchWidget.vue -->
<template>
  <div>{{ query }}</div>
</template>

<script>
export default {
  data() {
    return { query: '' };
  }
}
</script>
\`\`\`

### Svelte Island

\`\`\`svelte
<!-- src/components/Toggle.svelte -->
<script>
  let open = true;
</script>

<button on:click={ => open = !open}>
  {open ? 'Close' : 'Open'}
</button>
\`\`\`

## Content Collections

Astro supports content collections for blogs and documentation:

\`\`\`markdown
---
title: 'My First Post'
date: 2024-01-09
description: 'This is my first blog post'
---

# My First Post

Content goes here...
\`\`\`

## Tailwind CSS

The template includes Tailwind CSS for styling:

\`\`\`astro
---
import Layout from '../layouts/Layout.astro';
---

<Layout title="My Page">
  <div class="container mx-auto px-4">
    <h1 class="text-4xl font-bold text-purple-600">
      Hello, Astro!
    </h1>
  </div>
</Layout>
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── src/
│   ├── components/     # UI components (React, Vue, Svelte)
│   ├── layouts/        # Page layouts
│   ├── pages/          # File-based routing
│   ├── styles/         # Global styles
│   └── utils/          # Utility functions
├── public/             # Static assets
├── astro.config.mjs    # Astro configuration
├── tailwind.config.js  # Tailwind configuration
└── package.json
\`\`\`

## Building

Astro generates static HTML by default:

\`\`\`bash
npm run build
\`\`\`

Output is in \`dist/\` directory.

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

- [Astro Documentation](https://docs.astro.build)
- [Islands Architecture Guide](https://docs.astro.build/en/concepts/islands/)
- [Integrations Guide](https://docs.astro.build/en/guides/integrations-guide/)
- [Tailwind CSS](https://tailwindcss.com/)

## License

MIT
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Astro

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
.build/
.astro/

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
