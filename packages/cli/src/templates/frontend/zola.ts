import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class ZolaTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Zola config
    files.push({
      path: 'config.toml',
      content: this.generateZolaConfig()
    });

    // Index page
    files.push({
      path: 'content/_index.md',
      content: this.generateIndexPage()
    });

    // About page
    files.push({
      path: 'content/about/_index.md',
      content: this.generateAboutPage()
    });

    // Templates
    files.push({
      path: 'templates/base.html',
      content: this.generateBaseTemplate()
    });

    files.push({
      path: 'templates/page.html',
      content: this.generatePageTemplate()
    });

    // Partials
    files.push({
      path: 'templates/header.html',
      content: this.generateHeaderPartial()
    });

    files.push({
      path: 'templates/footer.html',
      content: this.generateFooterPartial()
    });

    files.push({
      path: 'templates/counter.html',
      content: this.generateCounterPartial()
    });

    // Styles
    files.push({
      path: 'styles/main.css',
      content: this.generateStyles()
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

    return files;
  }

  private generateZolaConfig() {
    return `name = "${this.context.name}"
description = "${this.context.description || 'A Zola static site'}"
base_url = "https://example.com"
default_language = "en"
compile_sass = true
highlight_theme = "base16-ocean-dark"
generate_feeds = true
taxonomies = [
  {name = "tags", feed = true},
  {name = "categories", feed = true},
]
`;
  }

  private generateIndexPage() {
    return `+++
title = "Home"
+++

<div class="hero">
  <h1>{{ config.name }}</h1>
  <p>{{ config.description }}</p>
</div>

<section class="features">
  <h2>Features</h2>
  <div class="feature-grid">
    <div class="feature-card">
      <span class="feature-icon">⚡</span>
      <h3>Blazing Fast</h3>
      <p>Static site generation powered by Rust</p>
    </div>
    <div class="feature-card">
      <span class="feature-icon">🔧</span>
      <h3>Tera Templates</h3>
      <p>Powerful and type-safe templating</p>
    </div>
  </div>
</section>

<section class="demo">
  <h2>Interactive Demo</h2>
  {% include "counter.html" %}
</section>
`;
  }

  private generateAboutPage() {
    return `+++
title = "About"
+++

<h1>About</h1>

<p>Welcome to <strong>{{ config.name }}</strong>, built with Zola and Rust.</p>

<h2>Features</h2>
<ul>
  <li>⚡ Blazing fast compilation</li>
  <li>🔧 Tera templating engine</li>
  <li>📝 Markdown support</li>
</ul>

<h2>Interactive Components</h2>
{% include "counter.html" %}
`;
  }

  private generateBaseTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{% block title %}{{ config.name }}{% endblock title %}</title>
  <link rel="stylesheet" href="/styles/main.css">
</head>
<body>
  {% include "header.html" %}
  <main>{% block content %}{% endblock content %}</main>
  {% include "footer.html" %}
</body>
</html>
`;
  }

  private generatePageTemplate() {
    return `{% extends "base.html" %}
{% block content %}
<div class="page">{{ page.content | safe }}</div>
{% endblock content %}
`;
  }

  private generateHeaderPartial() {
    return `<header class="header">
  <a href="/" class="logo">{{ config.name }}</a>
  <nav class="nav">
    <a href="/" class="nav-link">Home</a>
    <a href="/about/" class="nav-link">About</a>
  </nav>
</header>
`;
  }

  private generateFooterPartial() {
    return `<footer class="footer">
  <p>&copy; {{ now() | date(format="%Y") }} {{ config.name }}</p>
</footer>
`;
  }

  private generateCounterPartial() {
    return `<div class="counter">
  <div class="counter-display">0</div>
  <button onclick="incrementCounter()">+</button>
  <button onclick="decrementCounter()">-</button>
</div>
<script>
let count = 0;
function incrementCounter() { count++; updateDisplay(); }
function decrementCounter() { count--; updateDisplay(); }
function updateDisplay() { document.querySelector('.counter-display').textContent = count; }
</script>
`;
  }

  private generateStyles() {
    return `* { box-sizing: border-box; }
body { font-family: -apple-system, sans-serif; line-height: 1.6; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
.header { border-bottom: 2px solid #e0e0e0; padding: 1rem 0; }
.logo { color: #e67e22; text-decoration: none; font-size: 1.5rem; font-weight: 700; }
.nav-link { margin-left: 1.5rem; color: #666; text-decoration: none; }
.counter { display: flex; gap: 1rem; align-items: center; }
.counter-display { font-size: 2rem; font-weight: 700; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
.feature-card { padding: 2rem; border: 2px solid #e0e0e0; border-radius: 0.75rem; }
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A Zola static site.

## Quick Start

\`\`\`bash
zola serve
\`\`\`

## Build

\`\`\`bash
zola build
\`\`\`
`;
  }

  private generateDockerfile() {
    return `FROM alpine:latest
RUN apk add --no-cache curl
RUN curl -L https://github.com/getzola/zola/releases/download/v0.19.2/zola-v0.19.2-x86_64-unknown-linux-musl.tar.gz | tar -xz
WORKDIR /app
COPY . .
RUN zola build
FROM nginx:alpine
COPY --from=0 /app/public /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
  }
}