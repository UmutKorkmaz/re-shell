import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class HexoTemplate extends BaseTemplate {
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

    // Hexo config
    files.push({
      path: '_config.yml',
      content: this.generateHexoConfig()
    });

    // Index page
    files.push({
      path: 'source/index.md',
      content: this.generateIndexPage()
    });

    // About page
    files.push({
      path: 'source/about/index.md',
      content: this.generateAboutPage()
    });

    // Layouts
    files.push({
      path: 'themes/layout.ejs',
      content: this.generateMainLayout()
    });

    files.push({
      path: 'themes/_partial/header.ejs',
      content: this.generateHeaderPartial()
    });

    files.push({
      path: 'themes/_partial/footer.ejs',
      content: this.generateFooterPartial()
    });

    files.push({
      path: 'themes/_partial/counter.ejs',
      content: this.generateCounterPartial()
    });

    files.push({
      path: 'themes/_partial/badge.ejs',
      content: this.generateBadgePartial()
    });

    // CSS
    files.push({
      path: 'themes/css/style.css',
      content: this.generateStyles()
    });

    // Scripts
    files.push({
      path: 'themes/js/main.js',
      content: this.generateScripts()
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
      description: `${this.context.name} - A Hexo static site`,
      private: true,
      scripts: {
        'build': 'hexo generate',
        'clean': 'hexo clean',
        'deploy': 'hexo deploy',
        'server': 'hexo server',
        'start': 'hexo server --debug'
      },
      dependencies: {
        'hexo': '^7.0.0',
        'hexo-generator-archive': '^2.0.0',
        'hexo-generator-category': '^2.0.0',
        'hexo-generator-index': '^3.0.0',
        'hexo-generator-tag': '^2.0.0',
        'hexo-renderer-ejs': '^2.0.0',
        'hexo-renderer-marked': '^6.0.0',
        'hexo-renderer-stylus': '^3.0.0',
        'hexo-server': '^3.0.0',
        'hexo-deployer-git': '^4.0.0',
        'hexo-generator-searchdb': '^1.4.0',
        'hexo-generator-sitemap': '^3.0.0',
        'hexo-generator-feed': '^3.0.0',
        'hexo-util': '^3.0.0'
      },
      devDependencies: {
        'hexo-cli': '^4.3.0'
      },
      engines: {
        node: '>=18.0.0'
      }
    };
  }

  private generateHexoConfig() {
    return `# Hexo Configuration
title: ${this.context.name}
subtitle: ''
description: '${this.context.description || 'A Hexo static site'}'
keywords: null
author: ${this.context.name || 'Author'}
language: en
timezone: ''

# URL
url: https://example.com
permalink: :year/:month/:day/:title/
permalink_defaults:
pretty_urls:
  trailing_index: true
  trailing_html: true

# Directory
source_dir: source
public_dir: public
tag_dir: tags
archive_dir: archives
category_dir: categories
code_dir: downloads/code
i18n_dir: :lang
skip_render:

# Writing
new_post_name: :title.md
default_layout: post
titlecase: false
external_link:
  enable: true
  field: site
  exclude: ''
filename_case: 0
render_drafts: false
post_asset_folder: false
relative_link: false
future: true
syntax_highlighter: highlight.js
highlight:
  line_number: true
  auto_detect: false
  tab_replace: ''
  wrap: true
  hljs: false
prismjs:
  enable: false
  preprocess: true
  line_number: true
  tab_replace: ''

# Home page setting
index_generator:
  path: ''
  per_page: 10
  order_by: -date

# Category & Tag
default_category: uncategorized
category_map:
tag_map:

# Metadata elements
meta_generator: true

# Date / Time format
date_format: YYYY-MM-DD
time_format: HH:mm:ss
updated_option: 'mtime'

# Pagination
per_page: 10
pagination_dir: page

# Include / Exclude file(s)
include:
exclude:
ignore:

# Extensions
theme:
layout:
  post:
  page:
  archive:
  category:
  tag:

# Plugins
plugins:
  - hexo-generator-searchdb
  - hexo-generator-sitemap
  - hexo-generator-feed

# Feed
feed:
  type:
    - atom
    - rss2
  path:
    - atom.xml
    - rss2.xml
  limit: 20
  hub:
  content:
  content_limit: 140
  content_limit_delim: ' '
  icon: icon.png
  order_by: -date

# Sitemap
sitemap:
  path: sitemap.xml
  rel: false
  tags: true
  categories: true

# Search
search:
  path: search.xml
  field: post
  content: true
  format: html
`;
  }

  private generateIndexPage() {
    return `---
title: Home
date: 2024-01-15 10:00:00
type: "home"
---

<div class="hero">
  <div class="container">
    <h1><%= config.title %></h1>
    <p><%= config.description %></p>
    <div class="hero-actions">
      <a href="/about/" class="action-button primary">About</a>
      <a href="/archives/" class="action-button secondary">Archives</a>
    </div>
  </div>
</div>

<section class="features">
  <div class="container">
    <h2>Features</h2>
    <div class="feature-grid">
      <div class="feature-card">
        <span class="feature-icon">⚡</span>
        <h3>Fast Generation</h3>
        <p>Blazing-fast static site generation with Node.js</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">🔌</span>
        <h3>Plugin Ecosystem</h3>
        <p>Extensive plugin ecosystem for customization</p>
      </div>
      <div class="feature-card">
        <span class="feature-icon">📝</span>
        <h3>Markdown Support</h3>
        <p>Write content in your favorite markup language</p>
      </div>
    </div>
  </div>
</section>

<section class="demo">
  <div class="container">
    <h2>Interactive Demo</h2>
    <%- partial('_partial/counter') %>
  </div>
</section>
`;
  }

  private generateAboutPage() {
    return `---
title: About
date: 2024-01-15 10:00:00
---

<div class="about">
  <div class="container">
    <header class="page-header">
      <h1>About</h1>
    </header>

    <div class="content">
      <p>
        Welcome to <strong><%= config.title %></strong>, a modern static site
        built with Hexo and Node.js.
      </p>

      <h2>What is Hexo?</h2>
      <p>
        Hexo is a fast, simple and powerful blog framework powered by Node.js.
        You write posts in Markdown (or other languages) and Hexo generates
        static files with a single command.
      </p>

      <h2>Features</h2>
      <ul>
        <li>⚡ Blazing fast</li>
        <li>🔌 Support for Octopress plugins</li>
        <li>📝 Markdown and other renderers</li>
        <li>🎨 One-command deployment</li>
        <li>🔍 Powerful API for theming</li>
      </ul>

      <h2>Interactive Components</h2>
      <div class="badge-demo">
        <%- partial('_partial/badge', { text: 'Hexo', type: 'info' }) %>
        <%- partial('_partial/badge', { text: 'Node.js', type: 'success' }) %>
        <%- partial('_partial/badge', { text: 'EJS', type: 'warning' }) %>
        <%- partial('_partial/badge', { text: 'Fast', type: 'danger' }) %>
      </div>

      <div class="counter-demo">
        <%- partial('_partial/counter') %>
      </div>
    </div>
  </div>
</div>
`;
  }

  private generateMainLayout() {
    return `<!DOCTYPE html>
<html lang="<%= config.language %>">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="<%= config.description %>">
  <title><%= page.title %> | <%= config.title %></title>

  <!-- CSS -->
  <link rel="stylesheet" href="/css/style.css">

  <!-- Feed -->
  <%- atom_feed() %>

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
</head>
<body>
  <%- partial('_partial/header') %>

  <main class="main">
    <%- body %>
  </main>

  <%- partial('_partial/footer') %>

  <!-- Scripts -->
  <script src="/js/main.js"></script>
</body>
</html>
`;
  }

  private generateHeaderPartial() {
    return `<header class="header">
  <div class="container">
    <a href="<%- url_for('/') %>" class="logo"><%= config.title %></a>
    <nav class="nav">
      <a href="<%- url_for('/') %>" class="nav-link<%= typeof(is_home) !== 'undefined' && is_home ? ' active' : '' %>">Home</a>
      <a href="<%- url_for('/about/') %>" class="nav-link">About</a>
      <a href="<%- url_for('/archives/') %>" class="nav-link">Archives</a>
    </nav>
  </div>
</header>
`;
  }

  private generateFooterPartial() {
    return `<footer class="footer">
  <div class="container">
    <p>&copy; <%= new Date().getFullYear() %> <%= config.title %></p>
    <p class="footer-links">
      <a href="<%- url_for('/atom.xml') %>">RSS</a>
    </p>
  </div>
</footer>
`;
  }

  private generateCounterPartial() {
    return `<div class="counter">
  <div class="counter-display">0</div>
  <div class="counter-controls">
    <button class="counter-btn decrement" onclick="decrementCounter()">−</button>
    <button class="counter-btn reset" onclick="resetCounter()">Reset</button>
    <button class="counter-btn increment" onclick="incrementCounter()">+</button>
  </div>
  <div class="counter-info">
    <span>Min: 0</span>
    <span>Max: 100</span>
  </div>
</div>

<script>
let count = 0;
const min = 0;
const max = 100;

function updateDisplay() {
  document.querySelector('.counter-display').textContent = count;
}

function incrementCounter() {
  if (count < max) {
    count++;
    updateDisplay();
  }
}

function decrementCounter() {
  if (count > min) {
    count--;
    updateDisplay();
  }
}

function resetCounter() {
  count = 0;
  updateDisplay();
}

document.addEventListener('DOMContentLoaded', updateDisplay);
</script>
`;
  }

  private generateBadgePartial() {
    return `<span class="badge badge--<%= type || 'info' %>">
  <%= text %>
</span>`;
  }

  private generateStyles() {
    return `/* Global Styles */

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #333;
  background: #fff;
  line-height: 1.6;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Selection */
::selection {
  background: #2c3e50;
  color: #fff;
}

/* Focus styles */
*:focus-visible {
  outline: 2px solid #2c3e50;
  outline-offset: 2px;
}

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Header */
.header {
  background: #fff;
  border-bottom: 2px solid #e0e0e0;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #2c3e50;
  text-decoration: none;
  display: inline-block;
  padding: 1.5rem 0;
}

.nav {
  display: inline-block;
  margin-left: 2rem;
}

.nav-link {
  color: #666;
  text-decoration: none;
  margin-left: 1.5rem;
  padding: 0.5rem 0;
  transition: color 0.2s ease;
}

.nav-link:hover,
.nav-link.active {
  color: #2c3e50;
}

/* Main */
.main {
  min-height: calc(100vh - 200px);
  padding: 2rem 0;
}

/* Footer */
.footer {
  background: #f5f5f5;
  border-top: 2px solid #e0e0e0;
  padding: 2rem 0;
  text-align: center;
  color: #666;
}

.footer p {
  margin-bottom: 0.5rem;
}

.footer-links a {
  margin: 0 1rem;
  color: #666;
  text-decoration: none;
}

/* Hero */
.hero {
  text-align: center;
  padding: 6rem 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  margin-bottom: 4rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.hero p {
  font-size: 1.25rem;
  margin-bottom: 2rem;
  opacity: 0.9;
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
}

.action-button.primary {
  background: #fff;
  color: #667eea;
}

.action-button.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.action-button.secondary {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 2px solid #fff;
}

.action-button.secondary:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

/* Features */
.features {
  padding: 4rem 0;
  margin-bottom: 4rem;
}

.features h2 {
  text-align: center;
  margin-bottom: 3rem;
  font-size: 2rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  padding: 2rem;
  border: 2px solid #e0e0e0;
  border-radius: 0.75rem;
  text-align: center;
  transition: all 0.3s ease;
}

.feature-card:hover {
  border-color: #2c3e50;
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(44, 62, 80, 0.15);
}

.feature-card h3 {
  margin: 1rem 0 0.5rem;
}

.feature-card p {
  color: #666;
}

.feature-icon {
  font-size: 3rem;
  display: block;
}

/* Demo */
.demo {
  padding: 4rem 0;
  text-align: center;
}

/* Counter */
.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  border: 2px solid #e0e0e0;
  border-radius: 0.75rem;
  background: #f9f9f9;
  max-width: 500px;
  margin: 0 auto;
}

.counter-display {
  font-size: 4rem;
  font-weight: 700;
  color: #2c3e50;
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
  border: 2px solid #e0e0e0;
  border-radius: 0.5rem;
  background: #fff;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;
}

.counter-btn:hover:not(:disabled) {
  border-color: #2c3e50;
  color: #2c3e50;
  transform: translateY(-2px);
}

.counter-btn:active:not(:disabled) {
  transform: translateY(0);
}

.counter-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.increment {
  background: #2c3e50;
  color: #fff;
  border-color: #2c3e50;
}

.increment:hover:not(:disabled) {
  background: #1a252f;
  border-color: #1a252f;
  color: #fff;
}

.decrement {
  background: #666;
  color: #fff;
  border-color: #666;
}

.decrement:hover:not(:disabled) {
  background: #555;
  border-color: #555;
  color: #fff;
}

.counter-info {
  display: flex;
  gap: 1rem;
  color: #666;
  font-size: 0.875rem;
}

/* Badge */
.badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 1rem;
  white-space: nowrap;
  margin: 0.25rem;
}

.badge--info {
  background: #e3f2fd;
  color: #1976d2;
  border: 1px solid #90caf9;
}

.badge--success {
  background: #e8f5e9;
  color: #388e3c;
  border: 1px solid #81c784;
}

.badge--warning {
  background: #fff3e0;
  color: #f57c00;
  border: 1px solid #ffb74d;
}

.badge--danger {
  background: #ffebee;
  color: #d32f2f;
  border: 1px solid #e57373;
}

/* Page */
.page-header {
  text-align: center;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.content {
  max-width: 800px;
  margin: 0 auto;
}

.content ul {
  list-style: none;
  padding: 0;
}

.content li {
  padding: 0.5rem 0;
  font-size: 1.1rem;
}

.badge-demo,
.counter-demo {
  margin: 2rem 0;
}

/* Post */
.post-header {
  text-align: center;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #e0e0e0;
}

.post-header h1 {
  font-size: 2.5rem;
  margin-bottom: 1rem;
}

.post-meta {
  color: #666;
  font-size: 0.875rem;
}

.post-meta span {
  margin: 0 0.5rem;
}

.post-content {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.8;
  font-size: 1.125rem;
}

.post-content h2 {
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.post-content pre {
  background: #f3f4f6;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.post-content code {
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 2rem 0;
}

.pagination a,
.pagination span {
  padding: 0.5rem 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 0.5rem;
  text-decoration: none;
  color: #333;
}

.pagination a:hover {
  border-color: #2c3e50;
  color: #2c3e50;
}

.pagination .current {
  background: #2c3e50;
  color: #fff;
  border-color: #2c3e50;
}

/* Archive */
.archive {
  max-width: 800px;
  margin: 0 auto;
}

.archive-post {
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.archive-post:last-child {
  border-bottom: none;
}

.archive-post h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.archive-post h2 a {
  color: #333;
  text-decoration: none;
}

.archive-post h2 a:hover {
  color: #2c3e50;
}

.archive-post time {
  color: #666;
  font-size: 0.875rem;
}

/* Post Card */
.post-card {
  padding: 2rem;
  border: 2px solid #e0e0e0;
  border-radius: 0.75rem;
  background: #fff;
  transition: all 0.3s ease;
  margin-bottom: 2rem;
}

.post-card:hover {
  border-color: #2c3e50;
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(44, 62, 80, 0.15);
}

.post-card h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.post-card h2 a {
  color: #333;
  text-decoration: none;
}

.post-card h2 a:hover {
  color: #2c3e50;
}

.post-card time {
  color: #666;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  display: block;
}

.post-card .excerpt {
  color: #666;
  line-height: 1.6;
}

.post-card .read-more {
  display: inline-block;
  margin-top: 1rem;
  color: #2c3e50;
  text-decoration: none;
  font-weight: 500;
}

.post-card .read-more:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .nav {
    display: block;
    margin-left: 0;
    margin-top: 1rem;
  }

  .nav-link {
    margin: 0 1rem 0 0;
  }

  .hero h1 {
    font-size: 2rem;
  }

  .hero p {
    font-size: 1rem;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }
}
`;
  }

  private generateScripts() {
    return `// Main JavaScript file

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
  // Add smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add active state to navigation
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
});

console.log('${this.context.name} loaded successfully!');
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A Hexo static site with Node.js.

## Features

- ⚡ **Fast** - Blazing-fast static site generation
- 🔌 **Plugins** - Extensive plugin ecosystem
- 📝 **Markdown** - Write content in Markdown
- 🎨 **Themes** - Easy to customize
- 🚀 **Deploy** - One-command deployment

## Quick Start

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
# Start development server
npm start

# Generate static files
npm run build

# Clean generated files
npm run clean
\`\`\`

Visit \`http://localhost:4000\` to view the site.

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── source/              # Content directory
│   ├── _posts/         # Blog posts
│   └── about/          # Pages
├── themes/             # Theme files
│   ├── layout/         # Layouts
│   ├── _partial/       # Partials
│   ├── css/            # Styles
│   └── js/             # Scripts
├── _config.yml         # Hexo configuration
├── package.json
└── README.md
\`\`\`

## Customization

### Configuration

Edit \`_config.yml\` to customize:

- Site settings
- Theme
- Plugins
- Deployment

### Theming

- Layouts: \`themes/layout/\`
- Partials: \`themes/_partial/\`
- Styles: \`themes/css/\`

### Writing Posts

\`\`\`bash
hexo new post "My Post"
\`\`\`

## Deployment

### GitHub Pages

\`\`\`bash
npm run deploy
\`\`\`

### Docker

\`\`\`bash
docker build -t ${this.context.normalizedName} .
docker run -p 4000:80 ${this.context.normalizedName}
\`\`\`

Or use Docker Compose:

\`\`\`bash
docker-compose up -d
\`\`\`

## Documentation

- [Hexo Docs](https://hexo.io/docs/)
- [Hexo Plugins](https://hexo.io/plugins/)

## License

MIT

---

Generated with [Re-Shell CLI](https://github.com/your-org/re-shell)
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Hexo site

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and install hexo-cli
COPY . .
RUN npx hexo install && npx hexo generate

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/public /usr/share/nginx/html

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
      - "4000:80"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
    labels:
      - "com.${this.context.normalizedName}.description=${this.context.name} Hexo Site"
      - "com.${this.context.normalizedName}.version=1.0.0"
`;
  }
}