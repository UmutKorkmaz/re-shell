import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class JekyllTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // Gemfile
    files.push({
      path: 'Gemfile',
      content: this.generateGemfile()
    });

    // Jekyll config
    files.push({
      path: '_config.yml',
      content: this.generateJekyllConfig()
    });

    // Index page
    files.push({
      path: 'index.md',
      content: this.generateIndexPage()
    });

    // About page
    files.push({
      path: 'about.md',
      content: this.generateAboutPage()
    });

    // Layouts
    files.push({
      path: '_layouts/default.html',
      content: this.generateDefaultLayout()
    });

    files.push({
      path: '_layouts/post.html',
      content: this.generatePostLayout()
    });

    files.push({
      path: '_layouts/page.html',
      content: this.generatePageLayout()
    });

    // Includes
    files.push({
      path: '_includes/head.html',
      content: this.generateHeadInclude()
    });

    files.push({
      path: '_includes/header.html',
      content: this.generateHeaderInclude()
    });

    files.push({
      path: '_includes/footer.html',
      content: this.generateFooterInclude()
    });

    files.push({
      path: '_includes/counter.html',
      content: this.generateCounterInclude()
    });

    files.push({
      path: '_includes/badge.html',
      content: this.generateBadgeInclude()
    });

    // CSS
    files.push({
      path: 'assets/css/main.scss',
      content: this.generateMainScss()
    });

    files.push({
      path: '_sass/_variables.scss',
      content: this.generateVariablesScss()
    });

    files.push({
      path: '_sass/_base.scss',
      content: this.generateBaseScss()
    });

    files.push({
      path: '_sass/_layout.scss',
      content: this.generateLayoutScss()
    });

    files.push({
      path: '_sass/_components.scss',
      content: this.generateComponentsScss()
    });

    // Blog posts
    files.push({
      path: '_posts/2024-01-15-welcome.md',
      content: this.generateBlogPost()
    });

    // Data
    files.push({
      path: '_data/navigation.yml',
      content: this.generateNavigationData()
    });

    files.push({
      path: '_data/features.yml',
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

  private generateGemfile() {
    return `source "https://rubygems.org"

gem "jekyll", "~> 4.3.3"

# Platform support
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance booster
gem "liquid-c", "~> 4.0"

# HTML and Markdown
gem "kramdown", "~> 2.4"
gem "kramdown-parser-gfm"
gem "rdiscount"

# Plugins
gem "jekyll-feed", "~> 0.12"
gem "jekyll-seo-tag", "~> 2.8"
gem "jekyll-sitemap", "~> 1.4"
gem "jekyll-paginate", "~> 1.1"
gem "jekyll-archives", "~> 2.2"
gem "jekyll-include-cache", "~> 0.1"

# CSS and Assets
gem "sass-embedded", "~> 1.69"
gem "jekyll-assets", "~> 3.0"

# Syntax highlighting
gem "rouge", "~> 4.2"

# Windows and JRuby compatibility
gem "jekyll-watch", "~> 2.2"

# GitHub Pages compatible
gem "github-pages", group: :jekyll_plugins

group :jekyll_plugins do
  gem "jekyll-compose", "~> 0.12"
  gem "jekyll-redirect-from", "~> 0.16"
end
`;
  }

  private generateJekyllConfig() {
    return `# Site settings
title: "${this.context.name}"
email: your-email@example.com
description: "${this.context.description || 'A Jekyll static site'}"
baseurl: ""
url: "https://example.com"

# Social
twitter_username: username
github_username: username
linkedin_username: username

# Build settings
markdown: kramdown
highlighter: rouge
lsi: false
excerpt_separator: "\\n\\n"
incremental: false

# Markdown processing
kramdown:
  input: GFM
  syntax_highlighter: rouge
  syntax_highlighter_opts:
    span:
      line_numbers: false
    block:
      line_numbers: true
      start_line: 1

# Sass/SCSS settings
sass:
  sass_dir: _sass
  style: compressed

# Plugins
plugins:
  - jekyll-feed
  - jekyll-seo-tag
  - jekyll-sitemap
  - jekyll-paginate
  - jekyll-archives
  - jekyll-include-cache
  - jekyll-redirect-from

# Pagination
paginate: 5
paginate_path: "/blog/page:num/"

# Archives
jekyll-archives:
  enabled:
    - categories
    - tags
  layouts:
    category: archive
    tag: archive
  permalinks:
    category: '/category/:name/'
    tag: '/tag/:name/'

# Exclude from processing
exclude:
  - .sass-cache/
  - .jekyll-cache/
  - gemfiles/
  - Gemfile
  - Gemfile.lock
  - node_modules/
  - vendor/bundle/
  - vendor/cache/
  - vendor/gems/
  - vendor/ruby/
  - README.md
  - LICENSE
  - Dockerfile
  - docker-compose.yml

# Collections
collections:
  posts:
    output: true
    permalink: /blog/:year/:month/:day/:title/

# Defaults
defaults:
  - scope:
      path: ""
      type: "posts"
    values:
      layout: "post"
      author: "${this.context.name || 'Author'}"
  - scope:
      path: ""
      type: "pages"
    values:
      layout: "page"

# SEO
lang: en_US
timezone: America/New_York
`;
  }

  private generateIndexPage() {
    return `---
layout: default
title: Home
---

<div class="hero">
  <div class="container">
    <h1>{{ site.title }}</h1>
    <p>{{ site.description }}</p>
    <div class="hero-actions">
      <a href="/about" class="action-button primary">About</a>
      <a href="/blog/" class="action-button secondary">Blog</a>
    </div>
  </div>
</div>

<section class="features">
  <div class="container">
    <h2>Features</h2>
    <div class="feature-grid">
      {% for feature in site.data.features.features %}
      <div class="feature-card">
        <span class="feature-icon">{{ feature.icon }}</span>
        <h3>{{ feature.title }}</h3>
        <p>{{ feature.description }}</p>
      </div>
      {% endfor %}
    </div>
  </div>
</section>

<section class="demo">
  <div class="container">
    <h2>Interactive Demo</h2>
    {% include counter.html %}
  </div>
</section>

<section class="latest-posts">
  <div class="container">
    <h2>Latest Posts</h2>
    <div class="post-grid">
      {% for post in site.posts limit:3 %}
      <article class="post-card">
        <h3>
          <a href="{{ post.url }}">{{ post.title }}</a>
        </h3>
        <p class="post-date">{{ post.date | date: "%B %d, %Y" }}</p>
        <p class="post-excerpt">{{ post.excerpt | strip_html }}</p>
        <a href="{{ post.url }}" class="read-more">Read more →</a>
      </article>
      {% endfor %}
    </div>
  </div>
</section>
`;
  }

  private generateAboutPage() {
    return `---
layout: default
title: About
---

<div class="about">
  <div class="container">
    <header class="page-header">
      <h1>About</h1>
    </header>

    <div class="content">
      <p>
        Welcome to <strong>{{ site.title }}</strong>, a modern static site
        built with Jekyll and Liquid templating.
      </p>

      <h2>What is Jekyll?</h2>
      <p>
        Jekyll is a static site generator that transforms plain text into
        static websites and blogs. It's perfect for GitHub Pages and
        requires no database.
      </p>

      <h2>Features</h2>
      <ul>
        <li>⚡ Simple, static, and blog-aware</li>
        <li>🎨 Liquid templating engine</li>
        <li>📝 Markdown support</li>
        <li>🔍 SEO optimized</li>
        <li>🚀 Fast and secure</li>
        <li>🔧 Easy customization</li>
      </ul>

      <h2>Interactive Components</h2>
      <div class="badge-demo">
        {% include badge.html text="Jekyll" type="info" %}
        {% include badge.html text="Liquid" type="success" %}
        {% include badge.html text="Markdown" type="warning" %}
        {% include badge.html text="Sass" type="danger" %}
      </div>

      <div class="counter-demo">
        {% include counter.html %}
      </div>
    </div>
  </div>
</div>
`;
  }

  private generateDefaultLayout() {
    return `<!DOCTYPE html>
<html lang="{{ site.lang | default: "en" }}">
  <head>
    {% include head.html %}
  </head>
  <body>
    {% include header.html %}

    <main class="main">
      {{ content }}
    </main>

    {% include footer.html %}
  </body>
</html>
`;
  }

  private generatePostLayout() {
    return `---
layout: default
---

<article class="post">
  <div class="container">
    <header class="post-header">
      <h1>{{ page.title }}</h1>
      <p class="post-meta">
        <span>{{ page.date | date: "%B %d, %Y" }}</span>
        {% if page.author %}
        <span>· {{ page.author }}</span>
        {% endif %}
        <span>· {{ content | reading_time }}</span>
      </p>
      {% if page.tags %}
      <div class="post-tags">
        {% for tag in page.tags %}
        <a href="/tag/{{ tag }}" class="tag">{{ tag }}</a>
        {% endfor %}
      </div>
      {% endif %}
    </header>

    <div class="post-content">
      {{ content }}
    </div>

    <footer class="post-footer">
      <a href="/blog/" class="back-link">← Back to blog</a>
    </footer>
  </div>
</article>
`;
  }

  private generatePageLayout() {
    return `---
layout: default
---

<div class="page">
  <div class="container">
    {{ content }}
  </div>
</div>
`;
  }

  private generateHeadInclude() {
    return `<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{{ page.excerpt | default: site.description | strip_html | normalize_whitespace | truncate: 160 | escape }}">
  <title>{{ page.title }} | {{ site.title }}</title>

  <!-- CSS -->
  <link rel="stylesheet" href="{{ "/assets/css/main.scss" | relative_url }}">

  <!-- Feed -->
  {% feed_meta %}

  <!-- Favicon -->
  <link rel="icon" type="image/x-icon" href="{{ "/favicon.ico" | relative_url }}">

  <!-- SEO -->
  {% seo %}
</head>
`;
  }

  private generateHeaderInclude() {
    return `<header class="header">
  <div class="container">
    <a href="{{ "/" | relative_url }}" class="logo">{{ site.title }}</a>
    <nav class="nav">
      {% for item in site.data.navigation.main %}
      <a href="{{ item.url | relative_url }}" class="nav-link">
        {{ item.title }}
      </a>
      {% endfor %}
    </nav>
  </div>
</header>
`;
  }

  private generateFooterInclude() {
    return `<footer class="footer">
  <div class="container">
    <p>&copy; {{ "now" | date: "%Y" }} {{ site.title }}</p>
    <p class="footer-links">
      <a href="{{ "/feed.xml" | relative_url }}">RSS</a>
      {% if site.github_username %}
      <a href="https://github.com/{{ site.github_username }}">GitHub</a>
      {% endif %}
    </p>
  </div>
</footer>
`;
  }

  private generateCounterInclude() {
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

  private generateBadgeInclude() {
    return `<span class="badge badge--{{ include.type | default: 'info' }}">
  {{ include.text }}
</span>
`;
  }

  private generateMainScss() {
    return `---
---

@import "variables";
@import "base";
@import "layout";
@import "components";
`;
  }

  private generateVariablesScss() {
    return `// Colors
$primary-color: #c00;
$primary-dark: #900;
$primary-light: #e00;

$text-color: #333;
$text-light: #666;
$text-lighter: #999;

$bg-color: #fff;
$bg-alt: #f9f9f9;
$bg-dark: #2c3e50;

$border-color: #ddd;
$border-light: #eee;

$info-color: #3498db;
$success-color: #2ecc71;
$warning-color: #f39c12;
$danger-color: #e74c3c;

// Typography
$font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
$font-size-base: 16px;
$line-height: 1.6;

// Spacing
$spacing-xs: 0.5rem;
$spacing-sm: 1rem;
$spacing-md: 1.5rem;
$spacing-lg: 2rem;
$spacing-xl: 3rem;

// Layout
$max-width: 1200px;
$header-height: 70px;

// Border radius
$border-radius-sm: 0.25rem;
$border-radius: 0.5rem;
$border-radius-lg: 0.75rem;

// Transitions
$transition-base: all 0.3s ease;
`;
  }

  private generateBaseScss() {
    return `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: $font-family;
  font-size: $font-size-base;
  line-height: $line-height;
  color: $text-color;
  background: $bg-color;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

// Custom scrollbar
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: $bg-alt;
}

::-webkit-scrollbar-thumb {
  background: $border-color;
  border-radius: 4px;

  &:hover {
    background: $text-light;
  }
}

// Smooth scrolling
html {
  scroll-behavior: smooth;
}

// Selection
::selection {
  background: $primary-color;
  color: #fff;
}

// Focus styles
*:focus-visible {
  outline: 2px solid $primary-color;
  outline-offset: 2px;
}

// Typography
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: $spacing-sm;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }
h4 { font-size: 1.25rem; }
h5 { font-size: 1rem; }
h6 { font-size: 0.875rem; }

p {
  margin-bottom: $spacing-sm;
}

a {
  color: $primary-color;
  text-decoration: none;
  transition: $transition-base;

  &:hover {
    color: $primary-dark;
  }
}

// Lists
ul, ol {
  margin-left: $spacing-md;
  margin-bottom: $spacing-sm;
}

li {
  margin-bottom: $spacing-xs;
}
`;
  }

  private generateLayoutScss() {
    return `.container {
  max-width: $max-width;
  margin: 0 auto;
  padding: 0 $spacing-lg;
}

.header {
  background: $bg-color;
  border-bottom: 2px solid $border-color;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: $primary-color;
  text-decoration: none;
  display: inline-block;
  padding: $spacing-md 0;
}

.nav {
  display: inline-block;
  margin-left: $spacing-lg;
}

.nav-link {
  color: $text-light;
  text-decoration: none;
  margin-left: $spacing-md;
  padding: $spacing-xs 0;
  transition: $transition-base;

  &:hover,
  &.active {
    color: $primary-color;
  }
}

.main {
  min-height: calc(100vh - #{$header-height} - 150px);
  padding: $spacing-lg 0;
}

.footer {
  background: $bg-alt;
  border-top: 2px solid $border-color;
  padding: $spacing-lg 0;
  text-align: center;
  color: $text-light;

  p {
    margin-bottom: $spacing-xs;
  }
}

.footer-links {
  a {
    margin: 0 $spacing-sm;
    color: $text-light;
  }
}

@media (max-width: 768px) {
  .nav {
    display: block;
    margin-left: 0;
    margin-top: $spacing-sm;
  }

  .nav-link {
    margin: 0 $spacing-sm 0 0;
  }
}
`;
  }

  private generateComponentsScss() {
    return `// Hero
.hero {
  text-align: center;
  padding: $spacing-xl 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  margin-bottom: $spacing-xl;

  h1 {
    font-size: 3rem;
    margin-bottom: $spacing-sm;
  }

  p {
    font-size: 1.25rem;
    margin-bottom: $spacing-md;
    opacity: 0.9;
  }
}

.hero-actions {
  display: flex;
  gap: $spacing-sm;
  justify-content: center;
  flex-wrap: wrap;
}

.action-button {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: $border-radius;
  font-weight: 500;
  text-decoration: none;
  transition: $transition-base;

  &.primary {
    background: #fff;
    color: #667eea;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
  }

  &.secondary {
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    border: 2px solid #fff;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: translateY(-2px);
    }
  }
}

// Features
.features {
  padding: $spacing-xl 0;
  margin-bottom: $spacing-xl;

  h2 {
    text-align: center;
    margin-bottom: $spacing-lg;
  }
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: $spacing-lg;
}

.feature-card {
  padding: $spacing-lg;
  border: 2px solid $border-color;
  border-radius: $border-radius-lg;
  text-align: center;
  transition: $transition-base;

  &:hover {
    border-color: $primary-color;
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(192, 0, 0, 0.15);
  }

  h3 {
    margin: $spacing-sm 0 $spacing-xs;
  }

  p {
    color: $text-light;
    line-height: $line-height;
  }
}

.feature-icon {
  font-size: 3rem;
  display: block;
}

// Demo
.demo {
  padding: $spacing-xl 0;
  text-align: center;
}

// Counter
.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-lg;
  border: 2px solid $border-color;
  border-radius: $border-radius-lg;
  background: $bg-alt;
  max-width: 500px;
  margin: 0 auto;
}

.counter-display {
  font-size: 4rem;
  font-weight: 700;
  color: $primary-color;
  font-variant-numeric: tabular-nums;
}

.counter-controls {
  display: flex;
  gap: $spacing-sm;
}

.counter-btn {
  padding: 0.75rem 1.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  border: 2px solid $border-color;
  border-radius: $border-radius;
  background: $bg-color;
  color: $text-color;
  cursor: pointer;
  transition: $transition-base;

  &:hover:not(:disabled) {
    border-color: $primary-color;
    color: $primary-color;
    transform: translateY(-2px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.increment {
  background: $primary-color;
  color: #fff;
  border-color: $primary-color;

  &:hover:not(:disabled) {
    background: $primary-dark;
    border-color: $primary-dark;
    color: #fff;
  }
}

.decrement {
  background: $text-light;
  color: #fff;
  border-color: $text-light;

  &:hover:not(:disabled) {
    background: $text-color;
    border-color: $text-color;
    color: #fff;
  }
}

.counter-info {
  display: flex;
  gap: $spacing-sm;
  color: $text-light;
  font-size: 0.875rem;
}

// Badge
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

// Page
.page {
  padding: $spacing-lg 0;
}

.page-header {
  text-align: center;
  margin-bottom: $spacing-xl;
  padding-bottom: $spacing-lg;
  border-bottom: 2px solid $border-color;

  h1 {
    font-size: 2.5rem;
  }
}

.content {
  max-width: 800px;
  margin: 0 auto;

  h2 {
    margin-top: $spacing-lg;
  }

  ul {
    list-style: none;
    padding: 0;

    li {
      padding: $spacing-xs 0;
      font-size: 1.1rem;
    }
  }
}

// Post
.post {
  padding: $spacing-lg 0;
}

.post-header {
  text-align: center;
  margin-bottom: $spacing-xl;
  padding-bottom: $spacing-lg;
  border-bottom: 2px solid $border-color;

  h1 {
    font-size: 2.5rem;
    margin-bottom: $spacing-sm;
  }
}

.post-meta {
  color: $text-light;
  font-size: 0.875rem;

  span {
    margin: 0 $spacing-xs;
  }
}

.post-tags {
  margin-top: $spacing-sm;

  .tag {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: $bg-alt;
    border-radius: $border-radius-sm;
    font-size: 0.875rem;
    margin: 0.25rem;
    color: $primary-color;
  }
}

.post-content {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.8;
  font-size: 1.125rem;

  h2 {
    margin-top: $spacing-lg;
    margin-bottom: $spacing-sm;
  }

  pre {
    background: $bg-alt;
    padding: $spacing-md;
    border-radius: $border-radius;
    overflow-x: auto;
    margin-bottom: $spacing-sm;
  }

  code {
    background: $bg-alt;
    padding: 0.25rem 0.5rem;
    border-radius: $border-radius-sm;
    font-size: 0.875em;
  }
}

.post-footer {
  margin-top: $spacing-xl;
  padding-top: $spacing-lg;
  border-top: 2px solid $border-color;
  text-align: center;
}

.back-link {
  color: $primary-color;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

// Latest Posts
.latest-posts {
  padding: $spacing-xl 0;
}

.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-lg;
  margin-top: $spacing-lg;
}

.post-card {
  padding: $spacing-lg;
  border: 2px solid $border-color;
  border-radius: $border-radius-lg;
  background: $bg-color;
  transition: $transition-base;

  &:hover {
    border-color: $primary-color;
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(192, 0, 0, 0.15);
  }

  h3 {
    font-size: 1.25rem;
    margin-bottom: $spacing-sm;

    a {
      color: $text-color;
      text-decoration: none;

      &:hover {
        color: $primary-color;
      }
    }
  }
}

.post-date {
  color: $text-light;
  font-size: 0.875rem;
  margin-bottom: $spacing-sm;
}

.post-excerpt {
  color: $text-light;
  line-height: $line-height;
  margin-bottom: $spacing-sm;
}

.read-more {
  color: $primary-color;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

// Badge Demo
.badge-demo {
  margin: $spacing-lg 0;
}

// Counter Demo
.counter-demo {
  margin: $spacing-lg 0;
}
`;
  }

  private generateBlogPost() {
    return `---
layout: post
title: "Welcome to {{ site.title }}"
date: 2024-01-15 10:00:00 -0500
categories: jekyll update
tags: [jekyll, welcome]
---

# Welcome to {{ site.title }}!

We're thrilled to announce the launch of our new static site, built with the power of **Jekyll** and **Liquid templating**.

## Why Jekyll?

Jekyll is one of the most popular static site generators, and for good reason:

- ⚡ **Simple** - Transform plain text into static websites
- 🔧 **Flexible** - Liquid templating for dynamic layouts
- 📝 **Markdown** - Write content in Markdown
- 🔍 **SEO Friendly** - Built-in SEO optimization
- 🚀 **Fast** - No database required
- 🎨 **Customizable** - Easy to theme and extend

## Getting Started with Jekyll

Jekyll is built with Ruby and uses Liquid as its templating language. It's the default engine for GitHub Pages, making it incredibly easy to deploy.

## What's Next?

Stay tuned for more tutorials, tips, and tricks on building modern static websites with Jekyll!

---

## Interactive Components

Try out the counter component:

{% include counter.html %}

## Badge Examples

{% include badge.html text="Jekyll" type="info" %}
{% include badge.html text="Liquid" type="success" %}
{% include badge.html text="Markdown" type="warning" %}
{% include badge.html text="Sass" type="danger" %}
`;
  }

  private generateNavigationData() {
    return `main:
  - title: Home
    url: /
  - title: About
    url: /about
  - title: Blog
    url: /blog/
`;
  }

  private generateFeaturesData() {
    return `features:
  - icon: ⚡
    title: Fast Performance
    description: Static site generation for lightning-fast page loads

  - icon: 🔍
    title: SEO Optimized
    description: Built-in search engine optimization features

  - icon: 🎨
    title: Easy Customization
    description: Liquid templating for flexible layouts

  - icon: 📝
    title: Markdown Support
    description: Write content in your favorite markup language

  - icon: 🔧
    title: Plugin Ecosystem
    description: Extend functionality with Jekyll plugins

  - icon: 🚀
    title: GitHub Pages Ready
    description: Deploy to GitHub Pages with zero configuration
`;
  }

  protected generateReadme() {
    return `# {{ site.title }}

A Jekyll static site with Liquid templating.

## Features

- ⚡ **Fast** - Static site generation for optimal performance
- 🔍 **SEO** - Built-in search engine optimization
- 🎨 **Customizable** - Liquid templating engine
- 📝 **Markdown** - Write content in Markdown
- 🔧 **Plugins** - Extensive plugin ecosystem
- 🚀 **GitHub Pages** - Easy deployment

## Quick Start

### Prerequisites

- Ruby 2.7 or higher
- Bundler

### Installation

\`\`\`bash
# Install dependencies
bundle install

# Start development server
bundle exec jekyll serve

# Build site
bundle exec jekyll build

# Watch for changes
bundle exec jekyll serve --watch
\`\`\`

Visit \`http://localhost:4000\` to view the site.

## Project Structure

\`\`\`
{{ site.title | downcase }}/
├── _includes/           # Reusable includes
├── _layouts/            # Page layouts
├── _posts/              # Blog posts
├── _sass/               # Sass partials
├── _data/               # Data files
├── assets/              # Static assets
├── _config.yml          # Jekyll configuration
├── Gemfile              # Ruby dependencies
└── README.md
\`\`\`

## Customization

### Configuration

Edit \`_config.yml\` to customize:

- Site settings
- Navigation
- Build options
- Plugins

### Styling

- Global styles: \`assets/css/main.scss\`
- Sass partials: \`_sass/\`
- Component styles: \`_sass/_components.scss\`

### Content

- Pages: Root directory
- Posts: \`_posts/YYYY-MM-DD-title.md\`
- Data: \`_data/\`

## Deployment

### GitHub Pages

\`\`\`bash
# Push to GitHub
git push origin main
\`\`\`

### Docker

\`\`\`bash
docker build -t {{ site.title | downcase }} .
docker run -p 4000:4000 {{ site.title | downcase }}
\`\`\`

Or use Docker Compose:

\`\`\`bash
docker-compose up -d
\`\`\`

## Documentation

- [Jekyll Docs](https://jekyllrb.com/docs/)
- [Liquid Docs](https://shopify.github.io/liquid/)
- [Markdown Guide](https://www.markdownguide.org/)

## License

MIT

---

Generated with [Re-Shell CLI](https://github.com/your-org/re-shell)
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Jekyll site

# Stage 1: Build
FROM ruby:3.2-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \\
    build-base \\
    git \\
    tzdata

# Install bundler
RUN gem install bundler

# Copy gemsfile and install gems
COPY Gemfile* ./
RUN bundle install --jobs 4 --retry 3

# Copy site and build
COPY . .
RUN bundle exec jekyll build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/_site /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateDockerCompose() {
    return `version: '3.8'

services:
  {{ site.title | downcase }}:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "4000:80"
    environment:
      - JEKYLL_ENV=production
    restart: unless-stopped
    labels:
      - "com.{{ site.title | downcase }}.description={{ site.description }}"
      - "com.{{ site.title | downcase }}.version=1.0.0"
`;
  }
}
