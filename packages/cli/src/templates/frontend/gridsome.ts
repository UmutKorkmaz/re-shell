import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class GridsomeTemplate extends BaseTemplate {
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

    // Gridsome config
    files.push({
      path: 'gridsome.config.js',
      content: this.generateGridsomeConfig()
    });

    // TypeScript config
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // Pages
    files.push({
      path: 'src/pages/Index.vue',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/pages/About.vue',
      content: this.generateAboutPage()
    });

    // Components
    files.push({
      path: 'src/components/Counter.vue',
      content: this.generateCounter()
    });

    files.push({
      path: 'src/components/Badge.vue',
      content: this.generateBadge()
    });

    files.push({
      path: 'src/components/PostCard.vue',
      content: this.generatePostCard()
    });

    // Layouts
    files.push({
      path: 'src/layouts/Default.vue',
      content: this.generateDefaultLayout()
    });

    // Templates
    files.push({
      path: 'src/templates/Post.vue',
      content: this.generatePostTemplate()
    });

    // GraphQL
    files.push({
      path: 'gridsome.server.js',
      content: this.generateGridsomeServer()
    });

    // Styles
    files.push({
      path: 'src/assets/styles/main.scss',
      content: this.generateMainStyles()
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
      description: `${this.context.name} - A Gridsome static site`,
      private: true,
      scripts: {
        'build': 'gridsome build',
        'develop': 'gridsome develop',
        'explore': 'gridsome explore',
        'lint': 'eslint --ext .js,.ts,.vue src',
        'format': 'prettier --write "**/*.{js,ts,vue,json,css,scss}"'
      },
      dependencies: {
        'gridsome': '^0.7.23',
        'vue': '^2.7.14',
        'vue-runtime-template-compiler': '^2.7.14',
        'graphql-request': '^6.1.0',
        'vue-property-decorator': '^9.1.2',
        'vuex': '^3.6.2'
      },
      devDependencies: {
        '@gridsome/plugin-sitemap': '^0.4.0',
        '@gridsome/transformer-remark': '^0.6.0',
        '@gridsome/vue-docgen-loader': '^0.6.0',
        '@types/node': '^20.11.0',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        'eslint': '^8.56.0',
        'eslint-plugin-prettier': '^5.1.3',
        'eslint-plugin-vue': '^9.20.0',
        'node-sass': '^9.0.0',
        'prettier': '^3.2.0',
        'sass-loader': '^14.0.0',
        'typescript': '^5.3.3',
        'webpack-node-externals': '^3.0.0'
      },
      engines: {
        node: '>=16.0',
        npm: '>=8.0'
      }
    };
  }

  private generateGridsomeConfig() {
    return `module.exports = {
  siteName: '${this.context.name}',
  siteDescription: '${this.context.description || 'A Gridsome static site'}',
  siteUrl: 'https://example.com',

  plugins: [
    {
      use: '@gridsome/plugin-sitemap',
      options: {
        cacheTime: 1000 * 60 * 24,
        config: {
          '/': {
            changefreq: 'weekly',
            priority: 1.0,
          },
          '/about': {
            changefreq: 'monthly',
            priority: 0.8,
          },
        },
      },
    },
  ],

  transformers: {
    remark: {
      externalLinksTarget: '_blank',
      externalLinksRel: ['nofollow', 'noopener', 'noreferrer'],
      anchorClassName: 'icon icon-link',
      plugins: [
        '@gridsome/remark-prism',
        '@gridsome/remark-autolink-headers',
      ],
    },
  },

  templates: {
    Post: '/blog/:title',
  },

  chainWebpack: (config) => {
    config.module
      .rule('vue')
      .use('vue-loader')
      .tap((options) => ({
        ...options,
        compilerOptions: {
          ...(options.compilerOptions || {}),
          isCustomElement: (tag) => tag.startsWith('x-'),
        },
      }));

    config.resolve.alias.set('@', path.resolve(__dirname, 'src'));
  },

  configureWebpack: {
    resolve: {
      extensions: ['.js', '.ts', '.vue', '.json'],
    },
  },
};
`;
  }

  protected generateTsConfig() {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        lib: ['ES2020', 'DOM'],
        strict: true,
        jsx: 'preserve',
        moduleResolution: 'node',
        esModuleInterop: true,
      skipLibCheck: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      types: ['node'],
      baseUrl: '.',
      paths: {
        '@/*': ['src/*']
      }
    },
    include: ['src/**/*', 'gridsome.d.ts'],
    exclude: ['node_modules']
  }, null, 2);
  }

  private generateIndexPage() {
    return `<template>
  <Layout>
    <div class="home">
      <header class="hero">
        <h1 class="hero-title">{{ $page.metadata.siteName }}</h1>
        <p class="hero-description">{{ $page.metadata.siteDescription }}</p>
        <div class="hero-actions">
          <g-link to="/about" class="action-button primary">
            Learn More
          </g-link>
          <g-link to="/blog" class="action-button secondary">
            View Blog
          </g-link>
        </div>
      </header>

      <section class="features">
        <h2>Features</h2>
        <div class="feature-grid">
          <div class="feature-card">
            <span class="feature-icon">⚡</span>
            <h3>Fast Performance</h3>
            <p>Lightning-fast page loads with Vue 2 and Gridsome optimization</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">🔍</span>
            <h3>GraphQL Data Layer</h3>
            <p>Powerful GraphQL API for data management and queries</p>
          </div>
          <div class="feature-card">
            <span class="feature-icon">📱</span>
            <h3>Responsive Design</h3>
            <p>Mobile-first approach with modern CSS</p>
          </div>
        </div>
      </section>

      <section class="demo">
        <h2>Interactive Demo</h2>
        <Counter :initial-value="0" />
      </section>

      <section class="latest-posts">
        <h2>Latest Posts</h2>
        <div class="post-grid">
          <PostCard
            v-for="edge in $page.allPost.edges"
            :key="edge.node.id"
            :post="edge.node"
          />
        </div>
      </section>
    </div>
  </Layout>
</template>

<page-query>
query {
  metadata {
    siteName
    siteDescription
  }
  allPost(limit: 3) {
    edges {
      node {
        id
        title
        date (format: "MMMM D, YYYY")
        path
        excerpt
      }
    }
  }
}
</page-query>

<script>
import Counter from '~/components/Counter.vue';
import PostCard from '~/components/PostCard.vue';

export default {
  components: {
    Counter,
    PostCard,
  },
  metaInfo() {
    return {
      title: 'Home',
    };
  },
};
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
  background: linear-gradient(120deg, #42b983, #35495e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-description {
  font-size: 1.25rem;
  color: #666;
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
    background: #42b983;
    color: #fff;

    &:hover {
      background: #35a372;
      transform: translateY(-2px);
    }
  }

  &.secondary {
    background: #f3f4f6;
    color: #333;

    &:hover {
      background: #e5e7eb;
      transform: translateY(-2px);
    }
  }
}

.features {
  padding: 4rem 0;
}

h2 {
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
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  text-align: center;
  transition: all 0.3s ease;

  &:hover {
    border-color: #42b983;
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(66, 185, 131, 0.15);
  }
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  display: block;
}

.demo {
  padding: 4rem 0;
  text-align: center;
}

.latest-posts {
  padding: 4rem 0;
}

.post-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-description {
    font-size: 1rem;
  }

  .feature-grid,
  .post-grid {
    grid-template-columns: 1fr;
  }
}
</style>
`;
  }

  private generateAboutPage() {
    return `<template>
  <Layout>
    <div class="about">
      <header class="page-header">
        <h1>About</h1>
      </header>

      <div class="content">
        <p>
          Welcome to <strong>${this.context.name}</strong>, a modern static site
          built with Gridsome and Vue 2.
        </p>

        <h2>What is Gridsome?</h2>
        <p>
          Gridsome is a Vue-powered static site generator for building CDN-ready
          websites for any headless CMS, API or Markdown-files.
        </p>

        <h2>Features</h2>
        <ul>
          <li>⚡ Lightning-fast static site generation</li>
          <li>🔍 Powerful GraphQL data layer</li>
          <li>📱 Responsive design out of the box</li>
          <li>🎨 Vue 2 components with single-file components</li>
          <li>🔐 SEO-friendly with automatic sitemap generation</li>
        </ul>

        <section class="demo-section">
          <h2>Interactive Components</h2>
          <Badge type="info">Gridsome</Badge>
          <Badge type="success">Vue 2</Badge>
          <Badge type="warning">GraphQL</Badge>
          <Counter :initial-value="10" />
        </section>
      </div>
    </div>
  </Layout>
</template>

<script>
import Badge from '~/components/Badge.vue';
import Counter from '~/components/Counter.vue';

export default {
  components: {
    Badge,
    Counter,
  },
  metaInfo() {
    return {
      title: 'About',
    };
  },
};
</script>

<style scoped lang="scss">
.about {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  text-align: center;
  margin-bottom: 3rem;
}

h1 {
  font-size: 3rem;
  font-weight: 700;
}

.content {
  line-height: 1.8;

  h2 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-size: 1.75rem;
  }

  p {
    margin-bottom: 1rem;
    color: #666;
  }

  ul {
    list-style: none;
    padding: 0;

    li {
      padding: 0.5rem 0;
      font-size: 1.1rem;
    }
  }
}

.demo-section {
  margin-top: 3rem;
  padding: 2rem;
  background: #f9fafb;
  border-radius: 0.75rem;
  text-align: center;
}
</style>
`;
  }

  private generateCounter() {
    return `<template>
  <div class="counter">
    <div class="counter-display">{{ count }}</div>
    <div class="counter-controls">
      <button class="counter-btn decrement" @click="decrement" :disabled="count <= min">
        −
      </button>
      <button class="counter-btn reset" @click="reset">
        Reset
      </button>
      <button class="counter-btn increment" @click="increment" :disabled="count >= max">
        +
      </button>
    </div>
    <div class="counter-info">
      <span>Min: {{ min }}</span>
      <span>Max: {{ max }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Counter',
  props: {
    initialValue: {
      type: Number,
      default: 0,
    },
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 100,
    },
  },
  data() {
    return {
      count: this.initialValue,
    };
  },
  methods: {
    increment() {
      if (this.count < this.max) {
        this.count++;
      }
    },
    decrement() {
      if (this.count > this.min) {
        this.count--;
      }
    },
    reset() {
      this.count = this.initialValue;
    },
  },
};
</script>

<style scoped lang="scss">
.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #f9fafb;
}

.counter-display {
  font-size: 4rem;
  font-weight: 700;
  color: #42b983;
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
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    border-color: #42b983;
    color: #42b983;
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
  background: #42b983;
  color: #fff;
  border-color: #42b983;

  &:hover:not(:disabled) {
    background: #35a372;
    border-color: #35a372;
    color: #fff;
  }
}

.decrement {
  background: #ef4444;
  color: #fff;
  border-color: #ef4444;

  &:hover:not(:disabled) {
    background: #dc2626;
    border-color: #dc2626;
    color: #fff;
  }
}

.counter-info {
  display: flex;
  gap: 1rem;
  color: #666;
  font-size: 0.875rem;
}
</style>
`;
  }

  private generateBadge() {
    return `<template>
  <span :class="['badge', \`badge--\${type}\`]">
    <slot />
  </span>
</template>

<script>
export default {
  name: 'Badge',
  props: {
    type: {
      type: String,
      default: 'info',
      validator: (value) => ['info', 'success', 'warning', 'danger'].includes(value),
    },
  },
};
</script>

<style scoped lang="scss">
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
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.badge--success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.badge--warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.badge--danger {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
}
</style>
`;
  }

  private generatePostCard() {
    return `<template>
  <g-link :to="post.path" class="post-card">
    <article>
      <h2 class="post-title">{{ post.title }}</h2>
      <p class="post-date">{{ post.date }}</p>
      <p class="post-excerpt">{{ post.excerpt }}</p>
      <span class="read-more">Read more →</span>
    </article>
  </g-link>
</template>

<script>
export default {
  name: 'PostCard',
  props: {
    post: {
      type: Object,
      required: true,
    },
  },
};
</script>

<style scoped lang="scss">
.post-card {
  display: block;
  padding: 1.5rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #fff;
  text-decoration: none;
  color: inherit;
  transition: all 0.3s ease;

  &:hover {
    border-color: #42b983;
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(66, 185, 131, 0.15);
  }
}

.post-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #1f2937;
}

.post-date {
  font-size: 0.875rem;
  color: #666;
  margin-bottom: 0.75rem;
}

.post-excerpt {
  color: #666;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.read-more {
  color: #42b983;
  font-weight: 500;
}
</style>
`;
  }

  private generateDefaultLayout() {
    return `<template>
  <div class="layout">
    <header class="header">
      <div class="container">
        <g-link to="/" class="logo">
          {{ $page.metadata.siteName }}
        </g-link>
        <nav class="nav">
          <g-link to="/" class="nav-link">Home</g-link>
          <g-link to="/about" class="nav-link">About</g-link>
          <g-link to="/blog" class="nav-link">Blog</g-link>
        </nav>
      </div>
    </header>

    <slot />

    <footer class="footer">
      <div class="container">
        <p>&copy; {{ new Date().getFullYear() }} {{ $page.metadata.siteName }}</p>
      </div>
    </footer>
  </div>
</template>

<static-query>
query {
  metadata {
    siteName
  }
}
</static-query>

<script>
export default {
  name: 'DefaultLayout',
};
</script>

<style scoped lang="scss">
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: #fff;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 100;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #42b983;
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

  &:hover,
  &.active--exact {
    color: #42b983;
  }
}

.footer {
  background: #f9fafb;
  border-top: 2px solid #e5e7eb;
  padding: 2rem 0;
  margin-top: auto;
  text-align: center;
  color: #666;
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
}
</style>
`;
  }

  private generatePostTemplate() {
    return `<template>
  <Layout>
    <div class="post">
      <header class="post-header">
        <h1>{{ $page.post.title }}</h1>
        <p class="post-meta">
          <span>{{ $page.post.date }}</span>
          <span>·</span>
          <span>{{ $page.post.timeToRead }} min read</span>
        </p>
      </header>

      <div class="post-content" v-html="$page.post.content" />

      <footer class="post-footer">
        <g-link to="/blog" class="back-link">← Back to blog</g-link>
      </footer>
    </div>
  </Layout>
</template>

<page-query>
query ($id: ID!) {
  post(id: $id) {
    title
    date (format: "MMMM D, YYYY")
    timeToRead
    content
  }
}
</page-query>

<script>
export default {
  name: 'PostTemplate',
  metaInfo() {
    return {
      title: this.$page.post.title,
    };
  },
};
</script>

<style scoped lang="scss">
.post {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.post-header {
  text-align: center;
  margin-bottom: 3rem;
  padding-bottom: 2rem;
  border-bottom: 2px solid #e5e7eb;
}

h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.post-meta {
  color: #666;
  font-size: 0.875rem;

  span {
    margin: 0 0.5rem;
  }
}

.post-content {
  line-height: 1.8;
  font-size: 1.125rem;

  :deep(h2) {
    margin-top: 2rem;
    margin-bottom: 1rem;
    font-size: 1.75rem;
  }

  :deep(p) {
    margin-bottom: 1rem;
  }

  :deep(pre) {
    background: #f3f4f6;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin-bottom: 1rem;
  }

  :deep(code) {
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875em;
  }
}

.post-footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 2px solid #e5e7eb;
}

.back-link {
  color: #42b983;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}
</style>
`;
  }

  private generateGridsomeServer() {
    return `const server = require('gridsome/lib/server');

server.createManagedPages(({ createPage }) => {
  // Create additional pages here if needed
});

module.exports = function (api) {
  api.loadSource(async actions => {
    // Add data sources here
    // For example: actions.addMetaData('siteName', '${this.context.name}')
  });

  api.createPages(async ({ createPage }) => {
    // Create dynamic pages here
  });
};
`;
  }

  private generateMainStyles() {
    return `/* Global styles */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #1f2937;
  background: #fff;
  line-height: 1.6;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f3f4f6;
}

::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;

  &:hover {
    background: #9ca3af;
  }
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Selection */
::selection {
  background: #42b983;
  color: #fff;
}

/* Focus styles */
*:focus-visible {
  outline: 2px solid #42b983;
  outline-offset: 2px;
}

/* Link styles */
a {
  color: #42b983;
  text-decoration: none;
  transition: color 0.2s ease;

  &:hover {
    color: #35a372;
  }
}

/* Container */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 1rem;
}

h1 { font-size: 2.5rem; }
h2 { font-size: 2rem; }
h3 { font-size: 1.5rem; }
h4 { font-size: 1.25rem; }
h5 { font-size: 1rem; }
h6 { font-size: 0.875rem; }

p {
  margin-bottom: 1rem;
}
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

A Gridsome static site with Vue 2 and GraphQL.

## Features

- ⚡ **Fast Performance** - Static site generation for lightning-fast loads
- 🔍 **GraphQL Data Layer** - Powerful GraphQL API for data management
- 📱 **Responsive Design** - Mobile-first approach
- 🎨 **Vue 2 Components** - Single-file components with scoped styles
- 🔐 **SEO Friendly** - Automatic sitemap generation
- 🎯 **TypeScript** - Full TypeScript support

## Quick Start

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run develop
\`\`\`

Open \`http://localhost:8080\` to view the site.

### Build

\`\`\`bash
npm run build
\`\`\`

### Explore GraphQL

\`\`\`bash
npm run explore
\`\`\`

## Project Structure

\`\`\`
${this.context.normalizedName}/
├── src/
│   ├── components/      # Vue components
│   ├── layouts/         # Layout components
│   ├── pages/           # Page components
│   ├── templates/       # GraphQL templates
│   └── assets/          # Static assets
├── static/              # Static files
├── gridsome.config.js   # Gridsome configuration
└── package.json
\`\`\`

## Customization

### Configuration

Edit \`gridsome.config.js\` to customize:

- Site metadata
- Plugins
- Transformers
- Templates

### Styling

Customize global styles in \`src/assets/styles/main.scss\`.

### GraphQL

Explore the GraphQL API at \`http://localhost:8080/___explore\`.

## Documentation

For more information, visit the [Gridsome documentation](https://gridsome.org/docs/).

## License

MIT

---

Generated with [Re-Shell CLI](https://github.com/your-org/re-shell)
`;
  }

  private generateDockerfile() {
    return `# Multi-stage build for Gridsome site

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

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
      - "com.${this.context.normalizedName}.description=${this.context.name} Gridsome Site"
      - "com.${this.context.normalizedName}.version=1.0.0"
`;
  }
}
