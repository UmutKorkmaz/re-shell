import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class HugoTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Hugo config
    files.push({
      path: 'hugo.toml',
      content: this.generateHugoConfig()
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

    // Blog section
    files.push({
      path: 'content/blog/_index.md',
      content: this.generateBlogIndex()
    });

    // Blog post
    files.push({
      path: 'content/blog/welcome/index.md',
      content: this.generateBlogPost()
    });

    // Layouts
    files.push({
      path: 'layouts/_default/baseof.html',
      content: this.generateBaseofLayout()
    });

    files.push({
      path: 'layouts/_default/single.html',
      content: this.generateSingleLayout()
    });

    files.push({
      path: 'layouts/_default/list.html',
      content: this.generateListLayout()
    });

    files.push({
      path: 'layouts/partials/header.html',
      content: this.generateHeaderPartial()
    });

    files.push({
      path: 'layouts/partials/footer.html',
      content: this.generateFooterPartial()
    });

    files.push({
      path: 'layouts/partials/counter.html',
      content: this.generateCounterPartial()
    });

    files.push({
      path: 'layouts/partials/badge.html',
      content: this.generateBadgePartial()
    });

    files.push({
      path: 'layouts/shortcodes/counter.html',
      content: this.generateCounterShortcode()
    });

    files.push({
      path: 'layouts/shortcodes/badge.html',
      content: this.generateBadgeShortcode()
    });

    // Assets
    files.push({
      path: 'assets/css/main.css',
      content: this.generateMainCss()
    });

    // Data
    files.push({
      path: 'data/navigation.yml',
      content: this.generateNavigationData()
    });

    files.push({
      path: 'data/features.yml',
      content: this.generateFeaturesData()
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

  private generateHugoConfig() {
    return `baseURL = 'https://example.com/'
languageCode = 'en-us'
title = '${this.context.name}'
theme = ''

[params]
  description = '${this.context.description || 'A Hugo static site'}'
  author = '${this.context.name || 'Author'}'

[markup]
  [markup.highlight]
    style = 'github'
    lineNos = true
    lineNumbersInTable = true
    noClasses = false

[taxonomies]
  category = 'categories'
  tag = 'tags'

[permalinks]
  blog = '/blog/:year/:month/:day/:slug/'

[menu]
  [[menu.main]]
    name = 'Home'
    url = '/'
    weight = 1
  [[menu.main]]
    name = 'About'
    url = '/about/'
    weight = 2
  [[menu.main]]
    name = 'Blog'
    url = '/blog/'
    weight = 3
`;
  }

  private generateIndexPage() {
    return `---
title: Home
---

<div class="hero">
  <h1>{{ .Site.Title }}</h1>
  <p>{{ .Site.Params.description }}</p>
</div>

<section class="features">
  <h2>Features</h2>
  {{ range .Site.Data.features.features }}
  <div class="feature-card">
    <span class="feature-icon">{{ .icon }}</span>
    <h3>{{ .title }}</h3>
    <p>{{ .description }}</p>
  </div>
  {{ end }}
</section>

<section class="demo">
  <h2>Interactive Demo</h2>
  {{ partial "counter.html" . }}
</section>
`;
  }

  private generateAboutPage() {
    return `---
title: About
---

<h1>About</h1>

<p>Welcome to <strong>{{ .Site.Title }}</strong>, built with Hugo.</p>

<h2>Features</h2>
<ul>
  <li>⚡ Blazing Fast</li>
  <li>🎨 Go Templates</li>
  <li>📝 Markdown</li>
  <li>🔍 SEO Ready</li>
</ul>

<h2>Interactive Components</h2>
{{< badge type="info" >}}Hugo{{< /badge >}}
{{< badge type="success" >}}Go{{< /badge >}}
{{< counter >}}
`;
  }

  private generateBlogIndex() {
    return `---
title: Blog
---

<h1>Blog</h1>

{{ range .Pages }}
<article>
  <h2><a href="{{ .Permalink }}">{{ .Title }}</a></h2>
  <p>{{ .Date.Format "January 2, 2006" }}</p>
  <p>{{ .Summary }}</p>
</article>
{{ end }}
`;
  }

  private generateBlogPost() {
    return `---
title: "Welcome to {{ .Site.Title }}"
date: 2024-01-15
tags: [hugo, welcome]
---

# Welcome to {{ .Site.Title }}!

We're excited to launch our new Hugo site!

## Features

- ⚡ Fast builds
- 🎨 Go templates
- 📝 Markdown support

## Interactive Demo

{{< counter >}}
`;
  }

  private generateBaseofLayout() {
    return `<!DOCTYPE html>
<html lang="{{ .Site.Language.Lang }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ if .IsHome }}{{ .Site.Title }}{{ else }}{{ .Title }} | {{ .Site.Title }}{{ end }}</title>
  {{ $css := resources.Get "css/main.css" }}
  <link rel="stylesheet" href="{{ $css.RelPermalink }}">
</head>
<body>
  {{ partial "header.html" . }}
  <main>{{ block "main" . }}{{ end }}</main>
  {{ partial "footer.html" . }}
</body>
</html>
`;
  }

  private generateSingleLayout() {
    return `{{ define "main" }}
<article class="post">
  <h1>{{ .Title }}</h1>
  <p class="meta">{{ .Date.Format "January 2, 2006" }} · {{ .ReadingTime }} min read</p>
  <div class="content">{{ .Content }}</div>
</article>
{{ end }}
`;
  }

  private generateListLayout() {
    return `{{ define "main" }}
<div class="page">{{ .Content }}</div>
{{ end }}
`;
  }

  private generateHeaderPartial() {
    return `<header class="header">
  <a href="{{ .Site.BaseURL }}" class="logo">{{ .Site.Title }}</a>
  <nav class="nav">
    {{ range .Site.Menus.main }}
    <a href="{{ .URL }}" class="nav-link">{{ .Name }}</a>
    {{ end }}
  </nav>
</header>
`;
  }

  private generateFooterPartial() {
    return `<footer class="footer">
  <p>&copy; {{ now.Year }} {{ .Site.Title }}</p>
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

  private generateBadgePartial() {
    return `<span class="badge badge--{{ .type | default "info" }}">{{ .text }}</span>`;
  }

  private generateCounterShortcode() {
    return `<div class="counter">
  <div class="counter-display">0</div>
  <button onclick="incrementCounter()">+</button>
  <button onclick="decrementCounter()">-</button>
</div>
<script>
(function() {
  let count = 0;
  window.incrementCounter = function() { count++; updateDisplay(); };
  window.decrementCounter = function() { count--; updateDisplay(); };
  function updateDisplay() { document.querySelector('.counter-display').textContent = count; };
})();
</script>
`;
  }

  private generateBadgeShortcode() {
    return `<span class="badge badge--{{ .Get "type" | default "info" }}">{{ .Inner }}</span>`;
  }

  private generateMainCss() {
    return `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, sans-serif; line-height: 1.6; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
.header { border-bottom: 2px solid #e0e0e0; padding: 1rem 0; }
.logo { font-size: 1.5rem; font-weight: 700; color: #ff6b6b; text-decoration: none; }
.nav-link { margin-left: 1.5rem; color: #666; text-decoration: none; }
.nav-link:hover { color: #ff6b6b; }
.counter { display: flex; gap: 1rem; align-items: center; }
.counter-display { font-size: 2rem; font-weight: 700; }
.badge { padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.875rem; }
.badge--info { background: #e3f2fd; color: #1976d2; }
.badge--success { background: #e8f5e9; color: #388e3c; }
`;
  }

  private generateNavigationData() {
    return `main:
  - name: Home
    url: /
    weight: 1
  - name: About
    url: /about/
    weight: 2
  - name: Blog
    url: /blog/
    weight: 3
`;
  }

  private generateFeaturesData() {
    return `features:
  - icon: ⚡
    title: Blazing Fast
    description: Build entire sites in milliseconds
  - icon: 🎨
    title: Go Templates
    description: Flexible templating language
  - icon: 📝
    title: Markdown
    description: Write content in Markdown
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A Hugo static site.

## Features

- ⚡ Fast builds
- 🎨 Go templates
- 📝 Markdown support

## Quick Start

\`\`\`bash
hugo server -D
\`\`\`

## Build

\`\`\`bash
hugo --minify
\`\`\`
`;
  }

  private generateDockerfile() {
    return `FROM hugomods/hugo:exts
WORKDIR /app
COPY . .
RUN hugo --minify
FROM nginx:alpine
COPY --from=0 /app/public /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'
services:
  app:
    build: .
    ports:
      - "1313:80"
`;
  }
}
