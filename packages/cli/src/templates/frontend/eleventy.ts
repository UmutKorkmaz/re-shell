import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class EleventyTemplate extends BaseTemplate {
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

    // Eleventy config
    files.push({
      path: 'eleventy.config.js',
      content: this.generateEleventyConfig()
    });

    // .eleventyignore
    files.push({
      path: '.eleventyignore',
      content: 'node_modules\n.git\ndist\n'
    });

    // Layouts
    files.push({
      path: 'src/_layouts/base.njk',
      content: this.generateBaseLayout()
    });

    files.push({
      path: 'src/_layouts/post.njk',
      content: this.generatePostLayout()
    });

    // Pages
    files.push({
      path: 'src/index.njk',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/about.njk',
      content: this.generateAboutPage()
    });

    // Components (includes)
    files.push({
      path: 'src/_includes/header.njk',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/_includes/footer.njk',
      content: this.generateFooter()
    });

    files.push({
      path: 'src/_components/feature-card.njk',
      content: this.generateFeatureCard()
    });

    // Data
    files.push({
      path: 'src/_data/site.json',
      content: JSON.stringify({
        title: this.context.name,
        description: 'Built with 11ty - Data Cascade & Plugins',
        url: 'https://example.com'
      }, null, 2)
    });

    files.push({
      path: 'src/_data/features.json',
      content: JSON.stringify([
        {
          title: 'Data Cascade',
          description: 'Powerful data merging and inheritance system',
          icon: '📊'
        },
        {
          title: 'Template-Free',
          description: 'Use HTML, Markdown, Nunjucks, or any template language',
          icon: '🔓'
        },
        {
          title: 'Fast',
          description: 'Zero client-side JavaScript by default',
          icon: '⚡'
        },
        {
          title: 'Flexible',
          description: 'Plugin ecosystem for extensibility',
          icon: '🔧'
        }
      ], null, 2)
    });

    // CSS
    files.push({
      path: 'src/css/styles.css',
      content: this.generateStyles()
    });

    // Sample blog post
    files.push({
      path: 'src/posts/first-post.md',
      content: this.generateSamplePost()
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

  protected generatePackageJson() {
    return {
      name: this.context.normalizedName,
      version: '0.0.1',
      description: `${this.context.name} - 11ty Static Site Generator`,
      type: 'module',
      scripts: {
        build: 'eleventy',
        start: 'eleventy --serve',
        watch: 'eleventy --watch',
        serve: 'eleventy --serve'
      },
      devDependencies: {
        '@11ty/eleventy': '^3.0.0-alpha.12',
        '@11ty/eleventy-img': '^5.0.0-beta.6',
        '@11ty/eleventy-plugin-rss': '^2.0.0',
        '@11ty/eleventy-plugin-syntaxhighlight': '^5.0.0',
        'markdown-it': '^14.0.0',
        'markdown-it-anchor': '^9.0.1'
      }
    };
  }

  private generateEleventyConfig() {
    return `import { EleventyHtmlBasePlugin } from "@11ty/eleventy";
import eleventyPluginRss from "@11ty/eleventy-plugin-rss";
import eleventyPluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import pluginImages from "@11ty/eleventy-img";

export default function (eleventyConfig) {
  // Add plugins
  eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
  eleventyConfig.addPlugin(eleventyPluginRss);
  eleventyConfig.addPlugin(eleventyPluginSyntaxHighlight);
  eleventyConfig.addPlugin(pluginImages);

  // Add passthrough copy
  eleventyConfig.addPassthroughCopy("./src/css");
  eleventyConfig.addPassthroughCopy("./src/img");

  // Directory settings
  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
    }
  };
};
`;
  }

  private generateBaseLayout() {
    return `---
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% if title %}{{ title }} | {% endif %}{{ site.title }}</title>
    <meta name="description" content="{{ site.description }}">
    <link rel="stylesheet" href="/css/styles.css">
  </head>
  <body>
    {% include 'header.njk' %}

    <main>
      {{ content }}
    </main>

    {% include 'footer.njk' %}
  </body>
</html>
`;
  }

  private generatePostLayout() {
    return `---
layout: base.njk
---

<article class="post">
  <header class="post-header">
    <h1>{{ title }}</h1>
    <div class="post-meta">
      <time datetime="{{ page.date }}">{{ page.date | date("MMMM D, YYYY") }}</time>
      {% if author %}
      <span class="author">by {{ author }}</span>
      {% endif %}
    </div>
  </header>

  <div class="post-content">
    {{ content }}
  </div>

  <footer class="post-footer">
    <a href="/">← Back to home</a>
  </footer>
</article>

<style>
  .post {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 0;
  }

  .post-header {
    margin-bottom: 2rem;
  }

  .post-header h1 {
    color: #e91e63;
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  .post-meta {
    color: #666;
    font-size: 0.875rem;
  }

  .post-content {
    line-height: 1.8;
    font-size: 1.125rem;
  }

  .post-content h2 {
    color: #e91e63;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  .post-content p {
    margin-bottom: 1rem;
  }

  .post-footer {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #e0e0e0;
  }

  .post-footer a {
    color: #e91e63;
    text-decoration: none;
  }

  .post-footer a:hover {
    text-decoration: underline;
  }
</style>
`;
  }

  private generateIndexPage() {
    return `---
layout: base.njk
title: Home
---

<section class="hero">
  <h1>Welcome to ${this.context.name}</h1>
  <p>Built with 11ty - Data Cascade & Plugins</p>
</section>

<section class="features">
  {% for feature in features %}
    {% include 'feature-card.njk' %}
  {% endfor %}
</section>

<section class="latest-posts">
  <h2>Latest Posts</h2>
  {% set posts = collections.posts | reverse %}
  {% for post in posts.slice(0, 3) %}
    <article class="post-preview">
      <h3>
        <a href="{{ post.url }}">{{ post.data.title }}</a>
      </h3>
      <p class="post-date">{{ post.date | date("MMMM D, YYYY") }}</p>
      <p>{{ post.data.description }}</p>
    </article>
  {% endfor %}
</section>

<style>
  .hero {
    text-align: center;
    padding: 4rem 0;
    background: linear-gradient(135deg, #e91e63 0%, #f48fb1 100%);
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

  .latest-posts {
    background: white;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .latest-posts h2 {
    color: #e91e63;
    margin-bottom: 2rem;
  }

  .post-preview {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .post-preview:last-child {
    border-bottom: none;
  }

  .post-preview h3 a {
    color: #e91e63;
    text-decoration: none;
  }

  .post-preview h3 a:hover {
    text-decoration: underline;
  }

  .post-date {
    color: #666;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }
</style>
`;
  }

  private generateAboutPage() {
    return `---
layout: base.njk
title: About
---

<h1>About ${this.context.name}</h1>

<section class="content">
  <p>
    This is an 11ty static site built with the data cascade and plugin system.
    11ty is a simple static site generator that transforms templates into HTML.
  </p>

  <h2>What is 11ty?</h2>
  <p>
    11ty (Eleventy) is a flexible static site generator that:
  </p>

  <ul>
    <li>Works with any template language (HTML, Markdown, Nunjucks, etc.)</li>
    <li>Uses the data cascade for powerful data merging</li>
    <li>Has zero client-side JavaScript by default</li>
    <li>Offers an extensive plugin ecosystem</li>
    <li>Generates fast, SEO-friendly static sites</li>
  </ul>

  <h2>Data Cascade</h2>
  <p>
    The data cascade is 11ty's system for merging data from multiple sources:
  </p>

  <ol>
    <li>Front matter data in templates</li>
    <li>Template data files</li>
    <li>Global data files</li>
    <li>Configuration data</li>
  </ol>

  <h2>Why 11ty?</h2>
  <p>
    11ty is perfect for:
  </p>

  <ul>
    <li>Blogs and documentation sites</li>
    <li>Marketing websites</li>
    <li>Portfolios</li>
    <li>Any content-focused site</li>
  </ul>
</section>

<style>
  h1 {
    color: #e91e63;
    margin-bottom: 2rem;
  }

  .content {
    max-width: 800px;
  }

  h2 {
    color: #e91e63;
    margin-top: 2rem;
    margin-bottom: 1rem;
  }

  p {
    line-height: 1.8;
    margin-bottom: 1rem;
  }

  ul, ol {
    margin-left: 2rem;
    margin-bottom: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
  }
</style>
`;
  }

  private generateHeader() {
    return `<header class="header">
  <div class="container">
    <a href="/" class="logo">{{ site.title }}</a>
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about/">About</a>
      <a href="https://www.11ty.dev/docs/" target="_blank" rel="noopener noreferrer">Docs</a>
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
    color: #e91e63;
    text-decoration: none;
  }

  .nav {
    display: flex;
    gap: 2rem;
  }

  .nav a {
    color: #212121;
    text-decoration: none;
  }

  .nav a:hover {
    color: #e91e63;
  }
</style>
`;
  }

  private generateFooter() {
    return `---
---

<footer class="footer">
  <div class="container">
    <p>&copy; {{ eleventy.fetch.getYearNow() }} {{ site.title }}. Built with 11ty.</p>
    <p class="footer-links">
      <a href="https://www.11ty.dev/docs/" target="_blank" rel="noopener noreferrer">11ty Docs</a>
      <span>•</span>
      <a href="https://www.11ty.dev/docs/plugins/" target="_blank" rel="noopener noreferrer">Plugins</a>
      <span>•</span>
      <a href="https://github.com/11ty/eleventy" target="_blank" rel="noopener noreferrer">GitHub</a>
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
    return `<div class="feature-card">
  <div class="feature-icon">{{ feature.icon }}</div>
  <h3 class="feature-title">{{ feature.title }}</h3>
  <p class="feature-description">{{ feature.description }}</p>
</div>
`;
  }

  private generateStyles() {
    return `/**
 * Global Styles
 */

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #e91e63;
  --primary-light: #f48fb1;
  --primary-dark: #c2185b;
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

/* Typography */
h1, h2, h3, h4, h5, h6 {
  line-height: 1.2;
  margin-bottom: 1rem;
}

p {
  margin-bottom: 1rem;
}

a {
  color: var(--primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Components */
.feature-card {
  background: var(--surface);
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
  color: var(--primary);
}

.feature-description {
  color: var(--text-secondary);
  line-height: 1.6;
}
`;
  }

  private generateSamplePost() {
    return `---
title: "My First Post"
date: 2024-01-09
description: "This is my first blog post built with 11ty"
tags:
  - blog
  - 11ty
---

# Welcome to 11ty

This is my first blog post built with 11ty static site generator!

## What is 11ty?

11ty (pronounced "Eleventy") is a simple static site generator that transforms templates into HTML. It's:

- **Fast**: Zero client-side JavaScript by default
- **Flexible**: Works with HTML, Markdown, Nunjucks, and more
- **Powerful**: Data cascade for complex data merging
- **Extensible**: Plugin ecosystem for added functionality

## Getting Started

To create a new post, just add a markdown file to the \`posts\` directory with front matter:

\`\`\`markdown
---
title: "Your Post Title"
date: YYYY-MM-DD
description: "Post description"
---

Your content here...
\`\`\`

## Data Cascade

11ty's data cascade allows you to merge data from multiple sources:

1. Front matter in your templates
2. Global data files
3. Configuration data

This makes it easy to share data across your site while keeping specific data localized.
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

An 11ty (Eleventy) static site with data cascade and plugins.

## Overview

This template provides a complete 11ty site with the data cascade system, plugins, and multi-format template support.

## Features

- 📊 **Data Cascade** - Powerful data merging and inheritance
- 🔓 **Template-Free** - Use HTML, Markdown, Nunjucks, or any template language
- ⚡ **Fast** - Zero client-side JavaScript by default
- 🔧 **Extensible** - Plugin ecosystem for added functionality
- 📝 **Markdown** - Built-in Markdown support
- 🎨 **Syntax Highlighting** - Code highlighting with plugins
- 🖼️ **Image Processing** - Optimize images with Eleventy Image plugin

## Getting Started

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
# Build site
npm run build

# Serve site with hot reload
npm run start

# Watch for changes and rebuild
npm run watch
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── src/
│   ├── _data/          # Global data files (JSON, JS)
│   ├── _includes/      # Reusable includes
│   ├── _layouts/       # Page layouts
│   ├── _components/    # Reusable components
│   ├── css/            # Stylesheets
│   ├── img/            # Images
│   ├── posts/          # Blog posts
│   ├── index.njk       # Home page
│   └── about.njk       # About page
├── eleventy.config.js  # 11ty configuration
├── .eleventyignore     # Files to ignore
└── package.json
\`\`\`

## Data Cascade

11ty uses a data cascade to merge data from multiple sources:

\`\`\`njk
---
# Front matter data
title: "Page Title"
variable: "value"
---

<!-- Access global data -->
{{ site.title }}

<!-- Access front matter -->
{{ title }}

<!-- Access computed data -->
{{ eleventy.fetch.getYearNow() }}
\`\`\`

## Collections

Automatically create collections:

\`\`\`javascript
// eleventy.config.js
module.exports = function (eleventyConfig) {
  eleventyConfig.addCollection('posts', {
    pattern: 'posts/**/*.md',
    sortBy: 'date'
  });
};
\`\`\`

Access in templates:

\`\`\`njk
{% for post in collections.posts %}
  <article>
    <h2>{{ post.data.title }}</h2>
    <p>{{ post.date | date("MMMM D, YYYY") }}</p>
  </article>
{% endfor %}
\`\`\`

## Plugins

This template includes:

- **@11ty/eleventy-plugin-rss** - RSS feed generation
- **@11ty/eleventy-plugin-syntaxhighlight** - Code syntax highlighting
- **@11ty/eleventy-img** - Image optimization

## Filters

Use built-in filters:

\`\`\`njk
{{ date | date("MMMM D, YYYY") }}
{{ content | markdown | safe }}
{{ tags | join(", ") }}
\`\`\`

## Shortcodes

Create reusable shortcodes:

\`\`\`javascript
// .eleventy.js
module.exports = function (eleventyConfig) {
  eleventyConfig.addShortcode('feature', function (title, description) {
    return \`<div class="feature">
      <h3>\${title}</h3>
      <p>\${description}</p>
    </div>\`;
  });
};
\`\`\`

Use in templates:

\`\`\`njk
{% feature "Title", "Description" %}
\`\`\`

## Building

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

- [11ty Documentation](https://www.11ty.dev/docs/)
- [11ty Plugins](https://www.11ty.dev/docs/plugins/)
- [11ty Starter Projects](https://www.11ty.dev/docs/starter/)

## License

MIT
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for 11ty

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build site
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine

WORKDIR /app

# Install a simple HTTP server
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

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
_build/

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
