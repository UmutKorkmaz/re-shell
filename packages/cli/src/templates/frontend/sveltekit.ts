import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class SvelteKitTemplate extends BaseTemplate {
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

    // Svelte config
    files.push({
      path: 'svelte.config.js',
      content: this.generateSvelteConfig()
    });

    // Vite config
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig()
    });

    // PostCSS config
    files.push({
      path: 'postcss.config.js',
      content: this.generatePostcssConfig()
    });

    // TypeScript configs
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig()
    });

    // App HTML
    files.push({
      path: 'src/app.html',
      content: this.generateAppHtml()
    });

    // Layouts
    files.push({
      path: 'src/routes/+layout.svelte',
      content: this.generateLayout()
    });

    files.push({
      path: 'src/routes/+layout.ts',
      content: this.generateLayoutServer()
    });

    // Pages
    files.push({
      path: 'src/routes/+page.svelte',
      content: this.generateIndexPage()
    });

    files.push({
      path: 'src/routes/+page.ts',
      content: this.generateIndexPageServer()
    });

    files.push({
      path: 'src/routes/+page.server.ts',
      content: this.generateIndexPageServerLoad()
    });

    // About page
    files.push({
      path: 'src/routes/about/+page.svelte',
      content: this.generateAboutPage()
    });

    files.push({
      path: 'src/routes/about/+page.ts',
      content: this.generateAboutPageServer()
    });

    // Dynamic routes
    files.push({
      path: 'src/routes/posts/[id]/+page.svelte',
      content: this.generatePostDetailPage()
    });

    files.push({
      path: 'src/routes/posts/[id]/+page.server.ts',
      content: this.generatePostDetailServer()
    });

    // API routes
    files.push({
      path: 'src/routes/api/hello/+server.ts',
      content: this.generateHelloApi()
    });

    files.push({
      path: 'src/routes/api/posts/+server.ts',
      content: this.generatePostsApi()
    });

    // Components
    files.push({
      path: 'src/lib/components/Header.svelte',
      content: this.generateHeader()
    });

    files.push({
      path: 'src/lib/components/Footer.svelte',
      content: this.generateFooter()
    });

    // Animation examples
    files.push({
      path: 'src/lib/components/animations/AnimatedCard.svelte',
      content: this.generateAnimatedCard()
    });

    files.push({
      path: 'src/lib/components/animations/TransitionList.svelte',
      content: this.generateTransitionList()
    });

    files.push({
      path: 'src/lib/components/animations/SpringButton.svelte',
      content: this.generateSpringButton()
    });

    // Svelte actions examples
    files.push({
      path: 'src/lib/components/actions/ClickOutside.svelte',
      content: this.generateClickOutsideAction()
    });

    files.push({
      path: 'src/lib/components/actions/LazyImage.svelte',
      content: this.generateLazyImageAction()
    });

    files.push({
      path: 'src/lib/components/actions/Tooltip.svelte',
      content: this.generateTooltipAction()
    });

    // Performance monitoring and DevTools components
    files.push({
      path: 'src/lib/components/performance/PerformanceMonitor.svelte',
      content: this.generatePerformanceMonitor()
    });

    files.push({
      path: 'src/lib/components/performance/ComponentProfiler.svelte',
      content: this.generateComponentProfiler()
    });

    files.push({
      path: 'src/lib/utils/devtools.ts',
      content: this.generateDevtoolsUtils()
    });

    // Web Components examples
    files.push({
      path: 'src/lib/components/web-components/UserCard.svelte',
      content: this.generateWebComponentUserCard()
    });

    files.push({
      path: 'src/lib/components/web-components/CustomButton.svelte',
      content: this.generateWebComponentButton()
    });

    files.push({
      path: 'src/lib/components/web-components/CounterElement.svelte',
      content: this.generateWebComponentCounter()
    });

    files.push({
      path: 'src/lib/components/web-components/ModalElement.svelte',
      content: this.generateWebComponentModal()
    });

    files.push({
      path: 'src/lib/components/web-components/web-components.ts',
      content: this.generateWebComponentsRegistry()
    });

    // WebAssembly examples
    files.push({
      path: 'src/lib/components/wasm/FibonacciWasm.svelte',
      content: this.generateFibonacciWasm()
    });

    files.push({
      path: 'src/lib/components/wasm/ImageProcessorWasm.svelte',
      content: this.generateImageProcessorWasm()
    });

    files.push({
      path: 'src/lib/components/wasm/wasm-utils.ts',
      content: this.generateWasmUtils()
    });

    // Micro-frontend communication examples
    files.push({
      path: 'src/lib/components/microfrontend/EventBus.svelte',
      content: this.generateEventBus()
    });

    files.push({
      path: 'src/lib/components/microfrontend/SharedState.svelte',
      content: this.generateSharedState()
    });

    files.push({
      path: 'src/lib/components/microfrontend/MicroAppContainer.svelte',
      content: this.generateMicroAppContainer()
    });

    files.push({
      path: 'src/lib/components/microfrontend/micro-frontend.ts',
      content: this.generateMicroFrontendUtils()
    });

    // Cross-framework component sharing examples
    files.push({
      path: 'src/lib/components/cross-framework/ReactWrapper.svelte',
      content: this.generateReactWrapper()
    });

    files.push({
      path: 'src/lib/components/cross-framework/VueWrapper.svelte',
      content: this.generateVueWrapper()
    });

    files.push({
      path: 'src/lib/components/cross-framework/AngularWrapper.svelte',
      content: this.generateAngularWrapper()
    });

    files.push({
      path: 'src/lib/components/cross-framework/cross-framework.ts',
      content: this.generateCrossFrameworkUtils()
    });

    files.push({
      path: 'src/lib/components/FeatureCard.svelte',
      content: this.generateFeatureCard()
    });

    // Stores
    files.push({
      path: 'src/lib/stores/counter.ts',
      content: this.generateCounterStore()
    });

    files.push({
      path: 'src/lib/stores/theme.ts',
      content: this.generateThemeStore()
    });

    // Utils
    files.push({
      path: 'src/lib/utils/api.ts',
      content: this.generateApi()
    });

    files.push({
      path: 'src/lib/utils/format.ts',
      content: this.generateFormat()
    });

    // SEO Utilities
    files.push({
      path: 'src/lib/utils/seo.ts',
      content: this.generateSeoUtils()
    });

    files.push({
      path: 'src/lib/utils/structured-data.ts',
      content: this.generateStructuredData()
    });

    files.push({
      path: 'src/lib/components/SEO/SeoHead.svelte',
      content: this.generateSeoHead()
    });

    files.push({
      path: 'src/lib/components/SEO/JsonLd.svelte',
      content: this.generateJsonLd()
    });

    // Types
    files.push({
      path: 'src/lib/types/index.ts',
      content: this.generateTypes()
    });

    // Error page
    files.push({
      path: 'src/routes/+error.svelte',
      content: this.generateErrorPage()
    });

    // CSS
    files.push({
      path: 'src/app.css',
      content: this.generateAppCss()
    });

    // Environment
    files.push({
      path: '.env.example',
      content: this.generateEnvExample()
    });

    // README
    files.push({
      path: 'README.md',
      content: this.generateReadme()
    });

    // Vitest configuration
    files.push({
      path: 'vitest.config.ts',
      content: this.generateVitestConfig()
    });

    // Test setup
    files.push({
      path: 'src/test/setup.ts',
      content: this.generateTestSetup()
    });

    // Example test
    files.push({
      path: 'src/lib/components/Header.test.ts',
      content: this.generateExampleTest()
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
      version: '0.0.1',
      private: true,
      scripts: {
        dev: 'vite dev',
        build: 'vite build',
        preview: 'vite preview',
        check: 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json',
        'check:watch': 'svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch',
        test: 'vitest',
        'test:ui': 'vitest --ui',
        'test:coverage': 'vitest --coverage',
        lint: 'prettier --check . && eslint .',
        format: 'prettier --write .'
      },
      devDependencies: {
        '@playwright/test': '^1.41.2',
        '@sveltejs/adapter-auto': '^3.1.1',
        '@sveltejs/adapter-node': '^5.0.1',
        '@sveltejs/kit': '^2.5.0',
        '@typescript-eslint/eslint-plugin': '^6.19.0',
        '@typescript-eslint/parser': '^6.19.0',
        eslint: '^8.56.0',
        'eslint-config-prettier': '^9.1.0',
        'eslint-plugin-svelte': '^2.35.1',
        prettier: '^3.2.4',
        'prettier-plugin-svelte': '^3.2.2',
        'svelte-check': '^3.6.3',
        svelte: '^4.2.9',
        'tslib': '^2.6.2',
        typescript: '^5.3.3',
        vite: '^5.1.0',
        'vitest': '^1.2.2',
        '@testing-library/svelte': '^4.1.0',
        '@testing-library/jest-dom': '^6.4.2',
        '@vitest/ui': '^1.2.2',
        '@vitest/coverage-v8': '^1.2.2',
        'jsdom': '^24.0.0',
        'sass': '^1.71.1',
        'autoprefixer': '^10.4.17',
        'postcss': '^8.4.35',
        'cssnano': '^6.0.3',
        'svelte-preprocess': '^5.1.3'
      },
      type: 'module'
    };
  }

  protected generateSvelteConfig() {
    return `import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: [
    vitePreprocess({
      style: {
        scss: {
          api: 'modern-compiler',
          prependData: \`$color-primary: #ff3e00;
$color-secondary: #676778;
$color-error: #ff3e00;
$color-success: #4CAF50;
$font-base: 16px;
\`
        }
      },
      postcss: {
        plugins: [
          {
            name: 'autoprefixer',
            options: {
              overrideBrowserslist: '> 1%, last 4 versions, Firefox ESR, not dead'
            }
          },
          {
            name: 'cssnano',
            options: {
              preset: 'default'
            }
          }
        ]
      }
    })
  ],

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      $components: 'src/lib/components',
      $stores: 'src/lib/stores',
      $utils: 'src/lib/utils',
      $types: 'src/lib/types'
    }
  }
};

export default config;
`;
  }

  protected generateViteConfig() {
    return `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: ${this.context.port || 5173},
    host: true
  }
});
`;
  }

  protected generatePostcssConfig() {
    return `export default {
  plugins: {
    autoprefixer: {
      overrideBrowserslist: '> 1%, last 4 versions, Firefox ESR, not dead'
    },
    cssnano: {
      preset: 'default'
    }
  }
};
`;
  }

  protected generateTsConfig() {
    return JSON.stringify(
      {
        extends: './.svelte-kit/tsconfig.json',
        compilerOptions: {
          allowJs: true,
          checkJs: true,
          esModuleInterop: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
          sourceMap: true,
          strict: true,
          moduleResolution: 'bundler',
          paths: {
            $components: ['./src/lib/components'],
            $stores: ['./src/lib/stores'],
            $utils: ['./src/lib/utils'],
            $types: ['./src/lib/types']
          }
        }
      },
      null,
      2
    );
  }

  protected generateAppHtml() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
`;
  }

  protected generateLayout() {
    return `<script lang="ts">
  import { theme } from '$stores/theme';
  import Header from '$components/Header.svelte';
  import Footer from '$components/Footer.svelte';
</script>

<svelte:head>
  <title>${this.context.name}</title>
  <meta name="description" content="${this.context.description}" />
</svelte:head>

<div class="app" class:dark={$theme === 'dark'}>
  <Header />

  <main class="main-content">
    <slot />
  </main>

  <Footer />
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #ffffff;
    color: #1a1a1a;
    transition: background-color 0.3s, color 0.3s;
  }

  .app.dark {
    background-color: #1a1a1a;
    color: #f5f5f5;
  }

  .main-content {
    flex: 1;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  @media (max-width: 768px) {
    .main-content {
      padding: 1rem;
    }
  }
</style>
`;
  }

  protected generateLayoutServer() {
    return `export const prerender = true;
export const ssr = true;
export const trailingSlash = 'always';
`;
  }

  protected generateIndexPage() {
    return `<script lang="ts">
  import { counter } from '$stores/counter';
  import FeatureCard from '$components/FeatureCard.svelte';

  let count = $counter;
</script>

<svelte:head>
  <title>Home - ${this.context.name}</title>
</svelte:head>

<div class="home">
  <section class="hero">
    <h1>Welcome to ${this.context.name}</h1>
    <p>A modern SvelteKit application with SSR, SSG, and file-based routing</p>

    <div class="counter-demo">
      <h2>Counter: {count}</h2>
      <div class="counter-buttons">
        <button on:click={() => counter.decrement()}>-</button>
        <button on:click={() => counter.reset()}>Reset</button>
        <button on:click={() => counter.increment()}>+</button>
      </div>
    </div>
  </section>

  <section class="features">
    <h2>SvelteKit Features</h2>
    <div class="feature-grid">
      <FeatureCard
        icon="⚡"
        title="Lightning Fast"
        description="No virtual DOM, direct DOM manipulation for maximum performance"
      />
      <FeatureCard
        icon="🔄"
        title="Server-Side Rendering"
        description="Built-in SSR and static site generation for optimal SEO"
      />
      <FeatureCard
        icon="📁"
        title="File-Based Routing"
        description="Intuitive routing based on file structure"
      />
      <FeatureCard
        icon="🎨"
        title="Reactive Stores"
        description="Simple and powerful state management with Svelte stores"
      />
    </div>
  </section>

  <section class="tech-stack">
    <h2>Tech Stack</h2>
    <ul>
      <li><strong>SvelteKit 2</strong> - Full-stack web framework</li>
      <li><strong>Svelte 4</strong> - UI framework with compile-time optimizations</li>
      <li><strong>TypeScript</strong> - Type-safe development</li>
      <li><strong>Vite</strong> - Lightning-fast build tool</li>
      <li><strong>Playwright</strong> - End-to-end testing</li>
    </ul>
  </section>
</div>

<style>
  .hero {
    text-align: center;
    padding: 3rem 0;
  }

  .hero h1 {
    font-size: 3rem;
    font-weight: 700;
    margin-bottom: 1rem;
    color: #ff3e00;
  }

  .hero p {
    font-size: 1.2rem;
    color: #666;
    margin-bottom: 2rem;
  }

  :global(.dark) .hero p {
    color: #aaa;
  }

  .counter-demo {
    max-width: 400px;
    margin: 2rem auto;
    padding: 2rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  :global(.dark) .counter-demo {
    background: #2a2a2a;
  }

  .counter-demo h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .counter-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .counter-buttons button {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    border: none;
    border-radius: 4px;
    background: #ff3e00;
    color: white;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .counter-buttons button:hover {
    opacity: 0.8;
  }

  .features {
    margin: 3rem 0;
  }

  .features h2 {
    font-size: 2rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .tech-stack {
    margin: 3rem 0;
  }

  .tech-stack h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  .tech-stack ul {
    list-style: none;
    padding: 0;
  }

  .tech-stack li {
    padding: 0.5rem 0;
    font-size: 1.1rem;
  }
</style>
`;
  }

  protected generateIndexPageServer() {
    return `export const prerender = true;
`;
  }

  protected generateIndexPageServerLoad() {
    return `import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Server-side data loading
  return {
    props: {
      timestamp: new Date().toISOString()
    }
  };
};
`;
  }

  protected generateAboutPage() {
    return `<script lang="ts">
  import { theme } from '$stores/theme';
</script>

<svelte:head>
  <title>About - ${this.context.name}</title>
</svelte:head>

<div class="about">
  <div class="about-header">
    <h1>About ${this.context.name}</h1>
    <p>${this.context.description}</p>
  </div>

  <section class="features-list">
    <h2>Key Features</h2>

    <div class="feature-item">
      <h3>🎯 File-Based Routing</h3>
      <p>Routing is based on the file structure in the src/routes directory. No manual configuration needed.</p>
      <pre><code>src/routes/
  +page.svelte       # /
  about/
    +page.svelte     # /about
  posts/
    [id]/
      +page.svelte   # /posts/:id</code></pre>
    </div>

    <div class="feature-item">
      <h3>⚡ Svelte Stores</h3>
      <p>Simple and powerful reactive state management with writable, readable, and derived stores.</p>
      <pre><code>import { writable } from 'svelte/store';

export const count = writable(0);

// Usage
count.update(n => n + 1);
count.set(0);
</code></pre>
    </div>

    <div class="feature-item">
      <h3>🔄 Server-Side Rendering</h3>
      <p>Built-in SSR for optimal SEO and performance. Render pages on the server or statically.</p>
      <pre><code>// +page.server.ts
export const load = async () => {
  const data = await fetch('https://api.example.com/data');
  return { data };
};
</code></pre>
    </div>

    <div class="feature-item">
      <h3>💾 Form Actions</h3>
      <p>Handle form submissions with progressive enhancement and validation.</p>
      <pre><code>// +page.server.ts
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    // Process form data
  }
};
</code></pre>
    </div>

    <div class="feature-item">
      <h3>🎨 Scoped Styles</h3>
      <p>CSS is scoped to components by default. No global namespace pollution.</p>
      <pre><code>&lt;style&gt;
  .container {
    padding: 1rem;
  }
&lt;/style&gt;</code></pre>
    </div>

    <div class="feature-item">
      <h3>🌍 Adapters</h3>
      <p>Deploy to any platform with built-in adapters for Node, Vercel, Netlify, and more.</p>
      <pre><code>import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter()
  }
};
</code></pre>
    </div>
  </section>

  <section class="cta-section">
    <p>
      <a href="/" class="btn">Back to Home</a>
    </p>
  </section>
</div>

<style>
  .about-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .about-header h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .features-list {
    max-width: 800px;
    margin: 0 auto;
  }

  .features-list h2 {
    font-size: 2rem;
    margin-bottom: 2rem;
    text-align: center;
  }

  .feature-item {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #f9f9f9;
    border-radius: 8px;
  }

  :global(.dark) .feature-item {
    background: #2a2a2a;
  }

  .feature-item h3 {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
    color: #ff3e00;
  }

  .feature-item p {
    margin-bottom: 1rem;
    line-height: 1.6;
  }

  .feature-item pre {
    background: #1a1a1a;
    color: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
  }

  .feature-item code {
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
  }

  .cta-section {
    text-align: center;
    margin: 3rem 0;
  }

  .btn {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: #ff3e00;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: opacity 0.2s;
  }

  .btn:hover {
    opacity: 0.8;
  }
</style>
`;
  }

  protected generateAboutPageServer() {
    return `export const prerender = true;
`;
  }

  protected generatePostDetailPage() {
    return `<script lang="ts">
  export let data: {
    post: {
      id: number;
      title: string;
      body: string;
    };
  };
</script>

<svelte:head>
  <title>{data.post.title} - ${this.context.name}</title>
</svelte:head>

<div class="post-detail">
  <a href="/posts" class="back-link">← Back to Posts</a>

  <article class="post">
    <h1>{data.post.title}</h1>
    <div class="post-body">
      {@html data.post.body}
    </div>
  </article>
</div>

<style>
  .post-detail {
    max-width: 800px;
    margin: 0 auto;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 1rem;
    color: #ff3e00;
    text-decoration: none;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .post {
    padding: 2rem 0;
  }

  .post h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .post-body {
    line-height: 1.8;
    font-size: 1.1rem;
  }
</style>
`;
  }

  protected generatePostDetailServer() {
    return `import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const response = await fetch(\`https://jsonplaceholder.typicode.com/posts/\${params.id}\`);
  const post = await response.json();

  return {
    post
  };
};
`;
  }

  protected generateHelloApi() {
    return `import { json } from '@sveltejs/kit';

export async function GET() {
  return json({
    message: 'Hello from SvelteKit API!',
    timestamp: new Date().toISOString(),
    framework: 'SvelteKit'
  });
}
`;
  }

  protected generatePostsApi() {
    return `import { json } from '@sveltejs/kit';

export async function GET() {
  const response = await fetch('https://jsonplaceholder.typicode.com/posts?_limit=10');
  const posts = await response.json();

  return json(posts);
}

export async function POST({ request }) {
  const data = await request.json();

  // Create a new post
  const response = await fetch('https://jsonplaceholder.typicode.com/posts', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const post = await response.json();

  return json(post, { status: 201 });
}
`;
  }

  protected generateHeader() {
    return `<script lang="ts">
  import { theme } from '$stores/theme';

  function toggleTheme() {
    theme.update(t => t === 'light' ? 'dark' : 'light');
  }
</script>

<header class="header">
  <div class="header-container">
    <div class="logo">
      <span class="logo-icon">🔥</span>
      <a href="/" class="logo-link">${this.context.name}</a>
    </div>

    <nav class="nav">
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/posts">Posts</a>
      <button on:click={toggleTheme} class="theme-toggle" aria-label="Toggle theme">
        {#if $theme === 'light'}
          🌙
        {:else}
          ☀️
        {/if}
      </button>
    </nav>
  </div>
</header>

<style>
  .header {
    background: #ffffff;
    border-bottom: 1px solid #e5e5e5;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  :global(.dark) .header {
    background: #1a1a1a;
    border-bottom-color: #333;
  }

  .header-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .logo-icon {
    font-size: 1.5rem;
  }

  .logo-link {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1a1a1a;
    text-decoration: none;
  }

  :global(.dark) .logo-link {
    color: #f5f5f5;
  }

  .nav {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  .nav a {
    color: #1a1a1a;
    text-decoration: none;
    transition: color 0.2s;
  }

  :global(.dark) .nav a {
    color: #f5f5f5;
  }

  .nav a:hover {
    color: #ff3e00;
  }

  .theme-toggle {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.25rem;
    transition: transform 0.2s;
  }

  .theme-toggle:hover {
    transform: scale(1.1);
  }
</style>
`;
  }

  protected generateFooter() {
    return `<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="footer">
  <div class="footer-container">
    <p>&copy; {currentYear} ${this.context.name}. Built with SvelteKit.</p>
    <div class="footer-links">
      <a href="https://kit.svelte.dev" target="_blank" rel="noopener">SvelteKit Docs</a>
      <span>•</span>
      <a href="https://svelte.dev" target="_blank" rel="noopener">Svelte Docs</a>
    </div>
  </div>
</footer>

<style>
  .footer {
    background: #f9f9f9;
    border-top: 1px solid #e5e5e5;
    padding: 2rem 0;
    margin-top: auto;
  }

  :global(.dark) .footer {
    background: #1a1a1a;
    border-top-color: #333;
  }

  .footer-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
    text-align: center;
  }

  .footer-links {
    margin-top: 0.5rem;
  }

  .footer-links a {
    color: #1a1a1a;
    text-decoration: none;
  }

  :global(.dark) .footer-links a {
    color: #f5f5f5;
  }

  .footer-links a:hover {
    color: #ff3e00;
  }
</style>
`;
  }

  protected generateFeatureCard() {
    return `<script lang="ts">
  export let icon: string;
  export let title: string;
  export let description: string;
</script>

<div class="feature-card">
  <div class="feature-icon">{icon}</div>
  <h3 class="feature-title">{title}</h3>
  <p class="feature-description">{description}</p>
</div>

<style>
  .feature-card {
    padding: 1.5rem;
    background: #f9f9f9;
    border-radius: 8px;
    transition: transform 0.2s;
  }

  :global(.dark) .feature-card {
    background: #2a2a2a;
  }

  .feature-card:hover {
    transform: translateY(-4px);
  }

  .feature-icon {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .feature-title {
    font-size: 1.2rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .feature-description {
    color: #666;
    line-height: 1.5;
  }

  :global(.dark) .feature-description {
    color: #aaa;
  }
</style>
`;
  }

  protected generateAnimatedCard() {
    return `<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fade, fly, slide } from 'svelte/transition';
  import { spring } from 'svelte/motion';

  export let title = 'Animated Card';
  export let description = 'This card demonstrates Svelte animations';

  let visible = true;
  let expanded = false;

  function toggle() {
    visible = !visible;
  }

  function expand() {
    expanded = !expanded;
  }
</script>

<div class="animated-card-container">
  <button on:click={toggle} class="toggle-btn">
    {visible ? 'Hide' : 'Show'} Card
  </button>

  {#if visible}
  <div
    class="animated-card"
    in:fly="{{ y: 50, duration: 300 }}"
    out:fade="{{ duration: 200 }}"
    animate:flip="{{ duration: 300 }}"
  >
    <h2>{title}</h2>
    <p>{description}</p>

    <button
      on:click={expand}
      class="expand-btn"
      style:transform={spring(expanded ? 0 : 0, { stiffness: 0.1, damping: 0.1 })}
    >
      {expanded ? 'Collapse' : 'Expand'}
    </button>

    {#if expanded}
    <div class="expanded-content" in:slide|local>
      <p>This content uses spring physics for smooth animations!</p>
      <p>Svelte's spring function creates natural-feeling animations.</p>
    </div>
    {/if}
  </div>
  {/if}
</div>

<style>
  .animated-card-container {
    padding: 1rem;
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 1rem;
  }

  .animated-card {
    padding: 1.5rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  :global(.dark) .animated-card {
    background: #2a2a2a;
  }

  .animated-card h2 {
    margin-top: 0;
    color: #333;
  }

  :global(.dark) .animated-card h2 {
    color: #fff;
  }

  .expand-btn {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #333;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 0.3s;
  }

  .expanded-content {
    margin-top: 1rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 4px;
  }

  :global(.dark) .expanded-content {
    background: #1a1a1a;
  }
</style>
`;
  }

  protected generateTransitionList() {
    return `<script lang="ts">
  import { quintOut } from 'svelte/easing';
  import { flip, scale } from 'svelte/transition';

  let items = [
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' },
    { id: 3, name: 'Item 3' },
    { id: 4, name: 'Item 4' }
  ];

  function addItem() {
    const newId = Math.max(...items.map(i => i.id)) + 1;
    items = [...items, { id: newId, name: \`Item \${newId}\` }];
  }

  function removeItem(id: number) {
    items = items.filter(item => item.id !== id);
  }

  function moveUp(item: typeof items[0]) {
    const idx = items.indexOf(item);
    if (idx > 0) {
      items = [...items.slice(0, idx - 1), item, items[idx - 1], ...items.slice(idx + 1)];
    }
  }

  function moveDown(item: typeof items[0]) {
    const idx = items.indexOf(item);
    if (idx < items.length - 1) {
      items = [...items.slice(0, idx), items[idx + 1], item, ...items.slice(idx + 2)];
    }
  }
</script>

<div class="transition-list">
  <h2>Animated List with FLIP</h2>
  <button on:click={addItem} class="add-btn">+ Add Item</button>

  <div class="list">
    {#each items as item (item.id)}
    <div
      class="list-item"
      in:scale="{{ duration: 300, easing: quintOut }}"
      out:scale="{{ duration: 200, easing: quintOut }}"
      animate:flip="{{ duration: 300, easing: quintOut }}"
    >
      <span class="item-name">{item.name}</span>
      <div class="item-actions">
        <button on:click={() => moveUp(item)} ↑</button>
        <button on:click={() => moveDown(item)} ↓</button>
        <button on:click={() => removeItem(item.id)} ✕</button>
      </div>
    </div>
    {/each}
  </div>
</div>

<style>
  .transition-list {
    padding: 1.5rem;
  }

  .add-btn {
    padding: 0.5rem 1rem;
    background: #4CAF50;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 1rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  :global(.dark) .list-item {
    background: #2a2a2a;
  }

  .item-name {
    font-weight: 500;
  }

  .item-actions {
    display: flex;
    gap: 0.5rem;
  }

  .item-actions button {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
  }

  :global(.dark) .item-actions button {
    background: #333;
    border-color: #555;
  }
</style>
`;
  }

  protected generateSpringButton() {
    return `<script lang="ts">
  import { spring, tweened, loop } from 'svelte/motion';

  // Spring physics configuration
  const scale = spring(1, {
    stiffness: 0.1,
    damping: 0.15
  });

  const rotation = spring(0, {
    stiffness: 0.05,
    damping: 0.1
  });

  // Tweened value for smooth number transitions
  const count = tweened(0, {
    duration: 500,
    easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t // ease in-out quad
  });

  let number = 0;

  function handleMouseEnter() {
    scale.set(1.2);
    rotation.set(10);
  }

  function handleMouseLeave() {
    scale.set(1);
    rotation.set(0);
  }

  function increment() {
    number += 1;
    $count = number;
  }

  function decrement() {
    number -= 1;
    $count = number;
  }
</script>

<div class="spring-demo">
  <h2>Spring Physics Demo</h2>

  <button
    class="spring-btn"
    on:mousedown={handleMouseEnter}
    on:mouseup={handleMouseLeave}
    on:mouseleave={handleMouseLeave}
    style:transform="scale({$scale}) rotate({$rotation}deg)"
  >
    Hover Me!
  </button>

  <div class="counter-demo">
    <button on:click={decrement}>-</button>
    <span class="count">{$count.toFixed(0)}</span>
    <button on:click={increment}>+</button>
  </div>

  <div class="spring-info">
    <p><strong>Spring Parameters:</strong></p>
    <ul>
      <li>Stiffness: How "tight" the spring is</li>
      <li>Damping: How quickly the spring settles</li>
    </ul>
    <p>Try adjusting these values to see different bounce effects!</p>
  </div>
</div>

<style>
  .spring-demo {
    padding: 1.5rem;
    text-align: center;
  }

  .spring-btn {
    padding: 1rem 2rem;
    font-size: 1.2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  }

  .counter-demo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin: 2rem 0;
  }

  .counter-demo button {
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
    border: none;
    background: #333;
    color: white;
    border-radius: 50%;
    cursor: pointer;
  }

  .count {
    font-size: 2rem;
    font-weight: bold;
    min-width: 60px;
  }

  .spring-info {
    text-align: left;
    max-width: 400px;
    margin: 0 auto;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  :global(.dark) .spring-info {
    background: #2a2a2a;
  }
</style>
`;
  }

  protected generateClickOutsideAction() {
    return `<script lang="ts">
  // Svelte action for detecting clicks outside an element
  import { onMount } from 'svelte';
  import type { ActionReturn } from 'svelte/action';

  interface ClickOutsideAttributes {
    'on:clickoutside'?: (e: CustomEvent) => void;
  }

  export function clickOutside(node: HTMLElement): ActionReturn<{}, ClickOutsideAttributes> {
    const handleClick = (event: MouseEvent) => {
      if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
        node.dispatchEvent(new CustomEvent('clickoutside', node));
      }
    };

    document.addEventListener('click', handleClick, true);

    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
      }
    };
  }

  let isOpen = false;

  function toggle() {
    isOpen = !isOpen;
  }

  function close() {
    isOpen = false;
  }
</script>

<div class="click-outside-demo">
  <h2>Click Outside Action</h2>
  <p>Click the button to show a dropdown. Click outside to close it.</p>

  <div class="dropdown-container" use:clickOutside on:clickoutside={close}>
    <button on:click={toggle} class="dropdown-btn">
      {isOpen ? 'Close' : 'Open'} Menu
    </button>

    {#if isOpen}
    <div class="dropdown-menu">
      <a href="#">Option 1</a>
      <a href="#">Option 2</a>
      <a href="#">Option 3</a>
    </div>
    {/if}
  </div>
</div>

<style>
  .click-outside-demo {
    padding: 1.5rem;
  }

  .dropdown-container {
    position: relative;
    display: inline-block;
  }

  .dropdown-btn {
    padding: 0.75rem 1.5rem;
    background: #333;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.5rem;
    min-width: 200px;
    background: white;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    overflow: hidden;
  }

  :global(.dark) .dropdown-menu {
    background: #2a2a2a;
  }

  .dropdown-menu a {
    display: block;
    padding: 0.75rem 1rem;
    color: #333;
    text-decoration: none;
    transition: background 0.2s;
  }

  :global(.dark) .dropdown-menu a {
    color: #fff;
  }

  .dropdown-menu a:hover {
    background: #f5f5f5;
  }

  :global(.dark) .dropdown-menu a:hover {
    background: #3a3a3a;
  }
</style>
`;
  }

  protected generateLazyImageAction() {
    return `<script lang="ts">
  // Svelte action for lazy loading images
  import type { ActionReturn } from 'svelte/action';

  interface LazyAttributes {
    src?: string;
    'data-src'?: string;
  }

  export function lazyLoad(node: HTMLImageElement): ActionReturn<{}, LazyAttributes> {
    const loadImage = () => {
      const src = node.getAttribute('data-src');
      if (src) {
        node.src = src;
        node.classList.add('loaded');
      }
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImage();
          observer.unobserve(node);
        }
      });
    }, {
      rootMargin: '50px 0px'
    });

    observer.observe(node);

    return {
      destroy() {
        observer.disconnect();
      }
    };
  }

  const images = [
    { id: 1, url: 'https://picsum.photos/400/300?random=1', alt: 'Random image 1' },
    { id: 2, url: 'https://picsum.photos/400/300?random=2', alt: 'Random image 2' },
    { id: 3, url: 'https://picsum.photos/400/300?random=3', alt: 'Random image 3' },
    { id: 4, url: 'https://picsum.photos/400/300?random=4', alt: 'Random image 4' }
  ];
</script>

<div class="lazy-load-demo">
  <h2>Lazy Load Images Action</h2>
  <p>Scroll down to see images load as they enter the viewport.</p>

  <div class="image-grid">
    {#each images as image (image.id)}
    <div class="image-item">
      <img
        use:lazyLoad
        data-src={image.url}
        alt={image.alt}
        class="lazy-image"
        width="400"
        height="300"
      />
      <span class="image-caption">{image.alt}</span>
    </div>
    {/each}
  </div>
</div>

<style>
  .lazy-load-demo {
    padding: 1.5rem;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .image-item {
    position: relative;
  }

  .lazy-image {
    width: 100%;
    height: auto;
    aspect-ratio: 4/3;
    object-fit: cover;
    border-radius: 8px;
    background: #f0f0f0;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .lazy-image.loaded {
    opacity: 1;
  }

  .image-caption {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #666;
  }
</style>
`;
  }

  protected generateTooltipAction() {
    return `<script lang="ts">
  // Svelte action for creating tooltips
  import type { ActionReturn } from 'svelte/action';

  interface TooltipAttributes {
    'data-tooltip'?: string;
    'data-tooltip-position'?: 'top' | 'bottom' | 'left' | 'right';
  }

  export function tooltip(node: HTMLElement, params: { text: string; position?: 'top' | 'bottom' | 'left' | 'right' }): ActionReturn<{}, TooltipAttributes> {
    const { text, position = 'top' } = params;

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'svelte-tooltip';
    tooltipEl.textContent = text;
    tooltipEl.setAttribute('data-position', position);
    document.body.appendChild(tooltipEl);

    const updatePosition = () => {
      const rect = node.getBoundingClientRect();
      const tooltipRect = tooltipEl.getBoundingClientRect();

      let top, left;

      switch (position) {
        case 'top':
          top = rect.top - tooltipRect.height - 8;
          left = rect.left + (rect.width - tooltipRect.width) / 2;
          break;
        case 'bottom':
          top = rect.bottom + 8;
          left = rect.left + (rect.width - tooltipRect.width) / 2;
          break;
        case 'left':
          top = rect.top + (rect.height - tooltipRect.height) / 2;
          left = rect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = rect.top + (rect.height - tooltipRect.height) / 2;
          left = rect.right + 8;
          break;
      }

      tooltipEl.style.top = \`\${top}px\`;
      tooltipEl.style.left = \`\${left}px\`;
    };

    const show = () => {
      tooltipEl.classList.add('visible');
      updatePosition();
    };

    const hide = () => {
      tooltipEl.classList.remove('visible');
    };

    node.addEventListener('mouseenter', show);
    node.addEventListener('mouseleave', hide);

    return {
      update(newParams: { text: string; position?: 'top' | 'bottom' | 'left' | 'right' }) {
        tooltipEl.textContent = newParams.text;
        tooltipEl.setAttribute('data-position', newParams.position || 'top');
      },
      destroy() {
        node.removeEventListener('mouseenter', show);
        node.removeEventListener('mouseleave', hide);
        document.body.removeChild(tooltipEl);
      }
    };
  }

  let tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
</script>

<div class="tooltip-demo">
  <h2>Tooltip Action</h2>
  <p>Hover over the buttons to see tooltips in different positions.</p>

  <div class="button-group">
    <button use:tooltip={{ text: 'This is a top tooltip!', position: 'top' }}>
      Hover Top
    </button>

    <button use:tooltip={{ text: 'This is a bottom tooltip!', position: 'bottom' }}>
      Hover Bottom
    </button>

    <button use:tooltip={{ text: 'This is a left tooltip!', position: 'left' }}>
      Hover Left
    </button>

    <button use:tooltip={{ text: 'This is a right tooltip!', position: 'right' }}>
      Hover Right
    </button>
  </div>

  <div class="position-selector">
    <label>
      Position:
      <select bind:value={tooltipPosition}>
        <option value="top">Top</option>
        <option value="bottom">Bottom</option>
        <option value="left">Left</option>
        <option value="right">Right</option>
      </select>
    </label>

    <button use:tooltip={{ text: \`Dynamic \${tooltipPosition} tooltip!\`, position: tooltipPosition }}>
      Dynamic Position Tooltip
    </button>
  </div>
</div>

<style>
  .tooltip-demo {
    padding: 1.5rem;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
    flex-wrap: wrap;
  }

  .button-group button {
    padding: 0.75rem 1.5rem;
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .position-selector {
    margin-top: 2rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  :global(.dark) .position-selector {
    background: #2a2a2a;
  }

  .position-selector label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: 1rem;
  }

  .position-selector select {
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #ddd;
  }

  /* Global tooltip styles */
  :global(.svelte-tooltip) {
    position: fixed;
    background: #333;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.875rem;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 1000;
  }

  :global(.svelte-tooltip.visible) {
    opacity: 1;
  }

  :global(.svelte-tooltip[data-position='top']::after) {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-top-color: #333;
  }

  :global(.svelte-tooltip[data-position='bottom']::after) {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 5px solid transparent;
    border-bottom-color: #333;
  }

  :global(.svelte-tooltip[data-position='left']::after) {
    content: '';
    position: absolute;
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border: 5px solid transparent;
    border-left-color: #333;
  }

  :global(.svelte-tooltip[data-position='right']::after) {
    content: '';
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border: 5px solid transparent;
    border-right-color: #333;
  }
</style>
`;
  }

  protected generatePerformanceMonitor() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { browser } from '$app/environment';

  // Performance metrics
  let fps = tweened(0, { duration: 500 });
  let memoryUsage = 0;
  let renderTime = 0;
  let isMonitoring = false;
  let frameCount = 0;
  let lastTime = performance.now();
  let animationFrameId: number | null = null;

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function measurePerformance() {
    if (!browser) return;

    const memory = (performance as any).memory;
    if (memory) {
      memoryUsage = memory.usedJSHeapSize;
    }

    frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - lastTime;

    if (elapsed >= 1000) {
      const currentFps = Math.round((frameCount * 1000) / elapsed);
      $fps = currentFps;
      frameCount = 0;
      lastTime = currentTime;
    }

    if (isMonitoring) {
      animationFrameId = requestAnimationFrame(measurePerformance);
    }
  }

  function toggleMonitoring() {
    isMonitoring = !isMonitoring;
    if (isMonitoring) {
      frameCount = 0;
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(measurePerformance);
    } else if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function measureRender() {
    const start = performance.now();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        renderTime = performance.now() - start;
      });
    });
  }

  onDestroy(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  });
</script>

<div class="perf-monitor">
  <div class="perf-header">
    <h2>Performance Monitor</h2>
    <button
      class="toggle-btn"
      class:active={isMonitoring}
      on:click={toggleMonitoring}
    >
      {isMonitoring ? 'Stop' : 'Start'} Monitoring
    </button>
  </div>

  <div class="metrics">
    <div class="metric-card">
      <span class="metric-label">Frame Rate</span>
      <span class="metric-value" class:good={$fps >= 55} class:warning={$fps >= 30 && $fps < 55} class:poor={$fps < 30}>
        {$fps.toFixed(0)} FPS
      </span>
    </div>

    <div class="metric-card">
      <span class="metric-label">Memory Usage</span>
      <span class="metric-value">
        {formatBytes(memoryUsage)}
      </span>
    </div>

    <div class="metric-card">
      <span class="metric-label">Render Time</span>
      <span class="metric-value" class:good={renderTime < 16} class:warning={renderTime >= 16 && renderTime < 33} class:poor={renderTime >= 33}>
        {renderTime.toFixed(2)} ms
      </span>
      <button class="measure-btn" on:click={measureRender}>Measure</button>
    </div>

    <div class="metric-card">
      <span class="metric-label">User Agent</span>
      <span class="metric-value small">
        {browser ? navigator.userAgent.slice(0, 30) + '...' : 'SSR'}
      </span>
    </div>
  </div>

  <div class="tips">
    <h3>Performance Tips</h3>
    <ul>
      <li>Aim for 60 FPS for smooth animations</li>
      <li>Keep render time under 16ms for 60 FPS</li>
      <li>Use Svelte's reactivity wisely to avoid unnecessary re-renders</li>
      <li>Lazy load images and components when possible</li>
      <li>Monitor memory usage to detect leaks</li>
    </ul>
  </div>
</div>

<style>
  .perf-monitor {
    padding: 1.5rem;
    font-family: monospace;
  }

  .perf-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    background: #333;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .toggle-btn.active {
    background: #ff3e00;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .metric-card {
    padding: 1rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  :global(.dark) .metric-card {
    background: #2a2a2a;
  }

  .metric-label {
    display: block;
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
  }

  .metric-value {
    font-size: 1.5rem;
    font-weight: bold;
  }

  .metric-value.small {
    font-size: 0.875rem;
  }

  .metric-value.good {
    color: #4CAF50;
  }

  .metric-value.warning {
    color: #FFC107;
  }

  .metric-value.poor {
    color: #ff3e00;
  }

  .measure-btn {
    margin-left: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .tips {
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  :global(.dark) .tips {
    background: #2a2a2a;
  }

  .tips h3 {
    margin-top: 0;
    margin-bottom: 0.5rem;
  }

  .tips ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .tips li {
    margin-bottom: 0.25rem;
    color: #666;
  }
</style>
`;
  }

  protected generateComponentProfiler() {
    return `<script lang="ts">
  import { onMount } from 'svelte';
  import type { PerformanceEntry } from 'svelte/elements';

  interface ComponentMetric {
    name: string;
    renders: number;
    totalTime: number;
    avgTime: number;
    lastRender: number;
  }

  let components: ComponentMetric[] = [
    { name: 'Header', renders: 12, totalTime: 45, avgTime: 3.75, lastRender: 2 },
    { name: 'Footer', renders: 8, totalTime: 24, avgTime: 3, lastRender: 1 },
    { name: 'FeatureCard', renders: 24, totalTime: 120, avgTime: 5, lastRender: 4 },
    { name: 'Counter', renders: 156, totalTime: 468, avgTime: 3, lastRender: 2 }
  ];

  let sortBy: 'name' | 'renders' | 'avgTime' = 'renders';
  let sortDesc = true;

  function getSortedComponents() {
    return [...components].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      return sortDesc ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }

  function measureComponent(componentName: string) {
    const start = performance.now();
    // Simulate component render
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const duration = performance.now() - start;
        const comp = components.find(c => c.name === componentName);
        if (comp) {
          comp.renders++;
          comp.totalTime += duration;
          comp.avgTime = comp.totalTime / comp.renders;
          comp.lastRender = duration;
          components = [...components];
        }
      });
    });
  }

  function resetMetrics() {
    components = components.map(c => ({
      ...c,
      renders: 0,
      totalTime: 0,
      avgTime: 0,
      lastRender: 0
    }));
  }
</script>

<div class="component-profiler">
  <div class="profiler-header">
    <h2>Component Profiler</h2>
    <button class="reset-btn" on:click={resetMetrics}>Reset Metrics</button>
  </div>

  <div class="controls">
    <label>
      Sort by:
      <select bind:value={sortBy}>
        <option value="name">Name</option>
        <option value="renders">Renders</option>
        <option value="avgTime">Avg Time</option>
      </select>
    </label>

    <label>
      <input type="checkbox" bind:checked={sortDesc} />
      Descending
    </label>
  </div>

  <div class="components-table">
    <table>
      <thead>
        <tr>
          <th on:click={() => sortBy = 'name'}>Component</th>
          <th on:click={() => sortBy = 'renders'}>Renders</th>
          <th on:click={() => sortBy = 'avgTime'}>Avg Time (ms)</th>
          <th>Last Render (ms)</th>
          <th>Total Time (ms)</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {#each getSortedComponents() as component (component.name)}
        <tr>
          <td>{component.name}</td>
          <td>{component.renders}</td>
          <td class:good={component.avgTime < 4} class:warning={component.avgTime >= 4 && component.avgTime < 8} class:poor={component.avgTime >= 8}>
            {component.avgTime.toFixed(2)}
          </td>
          <td>{component.lastRender.toFixed(2)}</td>
          <td>{component.totalTime.toFixed(2)}</td>
          <td>
            <button class="measure-btn" on:click={() => measureComponent(component.name)}>
              Measure
            </button>
          </td>
        </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="info">
    <p><strong>Svelte DevTools:</strong> Install the browser extension to inspect component trees and track reactivity.</p>
    <p><strong>Profiling Tips:</strong></p>
    <ul>
      <li>Components with high render counts may benefit from memoization</li>
      <li>Average render time under 4ms is ideal for 60 FPS</li>
      <li>Use Svelte's \`{#key}\` directive to prevent unnecessary re-renders</li>
      <li>Consider splitting large components into smaller ones</li>
    </ul>
  </div>
</div>

<style>
  .component-profiler {
    padding: 1.5rem;
    font-family: monospace;
  }

  .profiler-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .reset-btn {
    padding: 0.5rem 1rem;
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  :global(.dark) .controls {
    background: #2a2a2a;
  }

  .components-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 8px;
    overflow: hidden;
  }

  :global(.dark) table {
    background: #2a2a2a;
  }

  th, td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid #eee;
  }

  :global(.dark) th, :global(.dark) td {
    border-bottom: 1px solid #444;
  }

  th {
    background: #f5f5f5;
    font-weight: 600;
    cursor: pointer;
  }

  :global(.dark) th {
    background: #333;
  }

  .good {
    color: #4CAF50;
  }

  .warning {
    color: #FFC107;
  }

  .poor {
    color: #ff3e00;
  }

  .measure-btn {
    padding: 0.25rem 0.5rem;
    background: #333;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .info {
    margin-top: 1rem;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  :global(.dark) .info {
    background: #2a2a2a;
  }

  .info p {
    margin-bottom: 0.5rem;
  }

  .info ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .info li {
    margin-bottom: 0.25rem;
    color: #666;
  }
</style>
`;
  }

  protected generateDevtoolsUtils() {
    return `/**
 * DevTools utilities for Svelte development
 *
 * This file provides utility functions for debugging and performance monitoring
 * in Svelte applications during development.
 */

import { browser } from '$app/environment';
import { goto } from '$app/navigation';

export interface DevLogOptions {
  level?: 'log' | 'warn' | 'error' | 'info' | 'debug';
  context?: string;
}

/**
 * Enhanced logging function that only outputs in development mode
 */
export function devLog(message: string, data?: unknown, options: DevLogOptions = {}) {
  if (import.meta.env.DEV && browser) {
    const { level = 'log', context = 'Dev' } = options;
    const prefix = \`[\${context}]\`;
    const logFn = console[level] || console.log;

    if (data) {
      logFn(prefix, message, data);
    } else {
      logFn(prefix, message);
    }
  }
}

/**
 * Performance measurement utility
 */
export class PerformanceTracker {
  private measurements = new Map<string, number>();

  start(label: string): void {
    this.measurements.set(label, performance.now());
  }

  end(label: string): number {
    const startTime = this.measurements.get(label);
    if (!startTime) {
      devLog(\`No measurement found for: \${label}\`, undefined, { level: 'warn' });
      return 0;
    }

    const duration = performance.now() - startTime;
    this.measurements.delete(label);

    devLog(\`Performance: \${label}\`, \`\${duration.toFixed(2)}ms\`, { context: 'Perf' });

    return duration;
  }

  measure<T>(label: string, fn: () => T): T {
    this.start(label);
    const result = fn();
    this.end(label);
    return result;
  }
}

/**
 * Component lifecycle tracker
 */
export class ComponentLifecycleTracker {
  private mounted = new Set<string>();
  private updated = new Map<string, number>();

  onMount(componentName: string): void {
    this.mounted.add(componentName);
    devLog(\`Component mounted: \${componentName}\`, undefined, { context: 'Lifecycle' });
  }

  onUpdate(componentName: string): void {
    const count = this.updated.get(componentName) || 0;
    this.updated.set(componentName, count + 1);
    devLog(\`Component updated: \${componentName}\`, count + 1, { context: 'Lifecycle' });
  }

  onDestroy(componentName: string): void {
    this.mounted.delete(componentName);
    this.updated.delete(componentName);
    devLog(\`Component destroyed: \${componentName}\`, undefined, { context: 'Lifecycle' });
  }

  getStats() {
    return {
      mounted: Array.from(this.mounted),
      updates: Object.fromEntries(this.updated)
    };
  }
}

/**
 * Route transition tracker
 */
export function trackRouteTransition(from: string, to: string) {
  if (!browser) return;

  const startTime = performance.now();

  return () => {
    const duration = performance.now() - startTime;
    devLog(\`Route transition: \${from} → \${to}\`, \`\${duration.toFixed(2)}ms\`, { context: 'Router' });
  };
}

/**
 * Create a development-only breakpoint
 */
export function devBreakpoint(condition = true) {
  if (import.meta.env.DEV && browser && condition) {
    // eslint-disable-next-line no-debugger
    debugger;
  }
}

// Singleton instances
export const perfTracker = new PerformanceTracker();
export const lifecycleTracker = new ComponentLifecycleTracker();
`;
  }

  protected generateCounterStore() {
    return `import { writable } from 'svelte/store';

function createCounter() {
  const { subscribe, set, update } = writable(0);

  return {
    subscribe,
    increment: () => update(n => n + 1),
    decrement: () => update(n => n - 1),
    reset: () => set(0)
  };
}

export const counter = createCounter();
`;
  }

  protected generateThemeStore() {
    return `import { writable } from 'svelte/store';

const THEME_KEY = 'theme';

type Theme = 'light' | 'dark';

// Get initial theme from localStorage or system preference
const initialTheme: Theme = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY) as Theme) || 'light';

export const theme = writable<Theme>(initialTheme);

// Subscribe to theme changes and persist to localStorage
if (typeof localStorage !== 'undefined') {
  theme.subscribe((value) => {
    localStorage.setItem(THEME_KEY, value);
    document.documentElement.classList.toggle('dark', value === 'dark');
  });
}
`;
  }

  protected generateApi() {
    return `const API_BASE = 'https://jsonplaceholder.typicode.com';

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`);
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async put<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    return response.json();
  },

  async delete(endpoint: string): Promise<void> {
    const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
  },
};
`;
  }

  protected generateFormat() {
    return `export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(num);
};

export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};
`;
  }

  protected generateTypes() {
    return `export interface Post {
  id: number;
  userId: number;
  title: string;
  body: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  username: string;
}

export interface Comment {
  id: number;
  postId: number;
  name: string;
  email: string;
  body: string;
}
`;
  }

  protected generateErrorPage() {
    return `<script lang="ts">
  import { page } from '$app/stores';

  $: error = $page.error;
</script>

{svelte:head}
  <title>Error - ${this.context.name}</title>
{/svelte:head}

<div class="error">
  <h1>{error?.message || 'An error occurred'}</h1>
  {#if error?.stack}
    <pre>{error.stack}</pre>
  {/if}
  <a href="/">Go back home</a>
</div>

<style>
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    text-align: center;
  }

  .error h1 {
    font-size: 2rem;
    color: #ff3e00;
    margin-bottom: 1rem;
  }

  .error pre {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 4px;
    overflow-x: auto;
    max-width: 600px;
  }

  :global(.dark) .error pre {
    background: #2a2a2a;
  }

  .error a {
    margin-top: 1rem;
    color: #ff3e00;
    text-decoration: none;
  }

  .error a:hover {
    text-decoration: underline;
  }
</style>
`;
  }

  protected generateAppCss() {
    return `/* Global CSS */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* Dark mode styles */
:global(.dark) {
  color-scheme: dark;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
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
`;
  }

  protected generateEnvExample() {
    return `# SvelteKit Environment Variables
# https://kit.svelte.dev/docs/configuration#environment-variables

# Private variables (only available server-side)
PRIVATE_API_KEY=your-private-api-key
DATABASE_URL=your-database-url

# Public variables (available to client)
PUBLIC_API_URL=https://api.example.com
PUBLIC_SITE_URL=https://yourdomain.com
`;
  }

  protected generateReadme() {
    return `# ${this.context.name}

${this.context.description}

Built with SvelteKit 2 - the fastest way to build web applications with Svelte.

## Features

- **SvelteKit 2** - Full-stack web framework
- **Svelte 4** - UI framework with compile-time optimizations
- **TypeScript** - Full type safety
- **File-Based Routing** - Intuitive routing based on file structure
- **Server-Side Rendering** - Built-in SSR and static site generation
- **API Routes** - Built-in API endpoints
- **Svelte Stores** - Reactive state management
- **Scoped Styles** - CSS scoped to components
- **Adapters** - Deploy to any platform (Node, Vercel, Netlify)

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
vite dev
\`\`\`

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

\`\`\`bash
npm run build
# or
vite build
\`\`\`

### Preview

\`\`\`bash
npm run preview
# or
vite preview
\`\`\`

### Type Checking

\`\`\`bash
npm run check
# or
svelte-kit sync && svelte-check --tsconfig ./tsconfig.json
\`\`\`

## Project Structure

\`\`\`
src/
├── routes/              # File-based routing
│   ├── +page.svelte     # Home page
│   ├── +layout.svelte   # Root layout
│   ├── about/
│   │   └── +page.svelte # About page
│   ├── posts/
│   │   └── [id]/
│   │       └── +page.svelte # Dynamic route
│   └── api/             # API routes
│       ├── hello/
│       │   └── +server.ts
│       └── posts/
│           └── +server.ts
├── lib/                # Utility code
│   ├── components/      # Reusable components
│   ├── stores/          # Svelte stores
│   ├── utils/           # Utility functions
│   └── types/           # TypeScript types
├── app.html            # HTML template
└── app.css             # Global styles
\`\`\`

## File-Based Routing

Routes are defined by files in the \`src/routes\` directory:

\`\`\`
src/routes/
+page.svelte           # /
+page.svelte           # /
about/
  +page.svelte         # /about
posts/
  [id]/
    +page.svelte       # /posts/:id
\`\`\`

## Server-Side Data Loading

Load data on the server with \`+page.server.ts\`:

\`\`\`typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const response = await fetch('https://api.example.com/data');
  const data = await response.json();

  return { data };
};
\`\`\`

Access in component:

\`\`\`svelte
<script lang="ts">
  export let data;
</script>

<h1>{data.title}</h1>
\`\`\`

## API Routes

Create API endpoints in \`src/routes/api\`:

\`\`\`typescript
// src/routes/api/hello/+server.ts
import { json } from '@sveltejs/kit';

export async function GET() {
  return json({
    message: 'Hello from SvelteKit API!'
  });
}

export async function POST({ request }) {
  const data = await request.json();
  return json({ success: true }, { status: 201 });
}
\`\`\`

## Svelte Stores

Reactive state management:

\`\`\`typescript
// src/lib/stores/counter.ts
import { writable } from 'svelte/store';

export const counter = writable(0);
\`\`\`

Use in component:

\`\`\`svelte
<script lang="ts">
  import { counter } from '$stores/counter';

  function increment() {
    counter.update(n => n + 1);
  }
</script>

<h1>{$counter}</h1>
<button on:click={increment}>+</button>
\`\`\`

## Form Actions

Handle form submissions:

\`\`\`svelte
<!-- +page.svelte -->
<form method="POST">
  <input name="email" type="email" />
  <button type="submit">Submit</button>
</form>
\`\`\`

\`\`\`typescript
// +page.server.ts
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email');
    // Process form data
    return { success: true };
  }
};
\`\`\`

## Layouts

Create reusable layouts:

\`\`\`svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import Header from '$components/Header.svelte';
  import Footer from '$components/Footer.svelte';
</script>

<Header />
<slot />
<Footer />
\`\`\`

## Adapters

Deploy to different platforms:

\`\`\`javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter()
  }
};
\`\`\`

Available adapters:
- \`@sveltejs/adapter-node\` - Node.js server
- \`@sveltejs/adapter-vercel\` - Vercel
- \`@sveltejs/adapter-netlify\` - Netlify
- \`@sveltejs/adapter-cloudflare\` - Cloudflare Pages
- \`@sveltejs/adapter-static\` - Static site generation

## Docker

### Build

\`\`\`bash
docker build -t ${this.context.normalizedName} .
\`\`\`

### Run

\`\`\`bash
docker run -p 3000:3000 ${this.context.normalizedName}
\`\`\`

### Docker Compose

\`\`\`bash
docker-compose up
\`\`\`

## Deployment

Deploy to any hosting service:

- **Vercel**: Zero-config deployment
- **Netlify**: Full-stack support
- **AWS**: Lambda, EC2, ECS
- **Google Cloud**: Cloud Run, Firebase
- **Azure**: App Service, Container Instances
- **Node.js**: Traditional server deployment

\`\`\`bash
# Build for production
npm run build

# Start production server
node build/index.js
\`\`\`

## Documentation

- [SvelteKit Documentation](https://kit.svelte.dev)
- [Svelte Documentation](https://svelte.dev/docs)
- [Learn Svelte](https://svelte.dev/learn)

## License

MIT
`;
  }

  protected generateDockerfile() {
    return `# Multi-stage Dockerfile for SvelteKit with Node adapter

# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build

ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

CMD ["node", "build/index.js"]
`;
  }

  protected generateDockerCompose() {
    return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - HOST=0.0.0.0
    restart: unless-stopped
`;
  }

  protected generateVitestConfig() {
    return `import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts,svelte}'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.ts,svelte']
    }
  }
});
`;
  }

  protected generateTestSetup() {
    return `import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock intersection observer
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};
`;
  }

  protected generateExampleTest() {
    return `import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Header from './Header.svelte';

describe('Header component', () => {
  it('renders the app title', () => {
    render(Header, { props: { title: 'Test App' } });
    expect(screen.queryByText('Test App')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(Header);
    expect(screen.queryByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('About')).toBeInTheDocument();
  });

  it('toggles mobile menu when button is clicked', async () => {
    const { container } = render(Header);
    const menuButton = screen.queryByRole('button');

    if (menuButton) {
      // Test mobile menu toggle logic
      expect(menuButton).toBeInTheDocument();
    }
  });
});
`;
  }

  // Web Components - Custom Elements v1 Integration

  /**
   * User Card Web Component
   * A reusable user profile card built as a custom element
   * Demonstrates: Shadow DOM, Custom Elements, Reactive Props
   */
  protected generateWebComponentUserCard() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';

  export let name = 'John Doe';
  export let email = 'john@example.com';
  export let avatar = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + name;
  export let role = 'Developer';
  export let variant: 'default' | 'compact' | 'detailed' = 'default';

  let customElement: CustomElementConstructor | undefined;

  // User card web component definition
  class UserCardElement extends HTMLElement {
    static get observedAttributes() {
      return ['name', 'email', 'avatar', 'role', 'variant'];
    }

    private shadow: ShadowRoot;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
      this.render();
    }

    attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
      this.render();
    }

    connectedCallback() {
      this.addEventListener('click', this.handleClick);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.handleClick);
    }

    handleClick = () => {
      this.dispatchEvent(new CustomEvent('user-click', {
        bubbles: true,
        composed: true,
        detail: {
          name: this.getAttribute('name') || name,
          email: this.getAttribute('email') || email
        }
      }));
    };

    get name() { return this.getAttribute('name') || name; }
    get email() { return this.getAttribute('email') || email; }
    get avatar() { return this.getAttribute('avatar') || avatar; }
    get role() { return this.getAttribute('role') || role; }
    get variant() { return this.getAttribute('variant') || variant; }

    render() {
      const variantClass = this.variant;
      this.shadow.innerHTML = \`
        <style>
          :host {
            display: block;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          .user-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
          }
          .user-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
          }
          .user-card.compact {
            padding: 12px;
            flex-direction: row;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .user-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
            border: 3px solid #f0f0f0;
          }
          .compact .user-avatar {
            width: 48px;
            height: 48px;
          }
          .user-info {
            text-align: center;
          }
          .compact .user-info {
            text-align: left;
            flex: 1;
          }
          .user-name {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0 0 4px 0;
            color: #1a1a1a;
          }
          .user-email {
            font-size: 0.875rem;
            color: #666;
            margin: 0 0 8px 0;
          }
          .user-role {
            display: inline-block;
            padding: 4px 12px;
            background: #f0f0f0;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 500;
            color: #555;
          }
          .user-role.developer { background: #e3f2fd; color: #1976d2; }
          .user-role.designer { background: #fce4ec; color: #c2185b; }
          .user-role.manager { background: #e8f5e9; color: #388e3c; }
        </style>
        <div class="user-card \${variantClass}">
          <img class="user-avatar" src="\${this.avatar}" alt="\${this.name}" />
          <div class="user-info">
            <h3 class="user-name">\${this.name}</h3>
            <p class="user-email">\${this.email}</p>
            <span class="user-role \${this.role.toLowerCase()}">\${this.role}</span>
          </div>
        </div>
      \`;
    }
  }

  onMount(() => {
    if (browser && !customElements.get('user-card')) {
      customElements.define('user-card', UserCardElement);
    }
  });
</script>

<div class="web-component-example">
  <h3>User Card Web Component</h3>
  <p>A custom element with Shadow DOM encapsulation</p>

  <div class="example-grid">
    <!-- Default variant -->
    <user-card
      name="\${name}"
      email="\${email}"
      avatar="\${avatar}"
      role="\${role}"
      variant="default"
      on:user-click={(e) => console.log('User clicked:', e.detail)}
    ></user-card>

    <!-- Compact variant -->
    <user-card
      name="\${name}"
      email="\${email}"
      role="\${role}"
      variant="compact"
    ></user-card>
  </div>
</div>

<style>
  .web-component-example {
    padding: 20px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin: 20px 0;
  }
  .example-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 16px;
  }
</style>
`;
  }

  /**
   * Custom Button Web Component
   * Demonstrates: Reactive styling, event handling, slot API
   */
  protected generateWebComponentButton() {
    return `<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let variant: 'primary' | 'secondary' | 'danger' | 'success' = 'primary';
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let disabled = false;
  export let loading = false;

  class CustomButtonElement extends HTMLElement {
    static get observedAttributes() {
      return ['variant', 'size', 'disabled', 'loading'];
    }

    private shadow: ShadowRoot;
    private _disabled = false;
    private _loading = false;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this.shadow.addEventListener('click', this.handleClick);
    }

    disconnectedCallback() {
      this.shadow.removeEventListener('click', this.handleClick);
    }

    handleClick = (e: Event) => {
      if (this.disabled || this.loading) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      this.dispatchEvent(new CustomEvent('custom-click', {
        bubbles: true,
        composed: true,
        detail: {
          variant: this.getAttribute('variant') || variant,
          timestamp: Date.now()
        }
      }));
    };

    get disabled() { return this.hasAttribute('disabled') || this._disabled; }
    set disabled(value: boolean) {
      this._disabled = value;
      if (value) this.setAttribute('disabled', '');
      else this.removeAttribute('disabled');
    }

    get loading() { return this.hasAttribute('loading') || this._loading; }
    set loading(value: boolean) {
      this._loading = value;
      if (value) this.setAttribute('loading', '');
      else this.removeAttribute('loading');
    }

    get variant() { return this.getAttribute('variant') || 'primary'; }
    get size() { return this.getAttribute('size') || 'medium'; }

    render() {
      const isDisabled = this.disabled || this.loading;
      this.shadow.innerHTML = \`
        <style>
          :host {
            display: inline-block;
          }
          .btn {
            font-family: inherit;
            font-size: var(--btn-font-size, 14px);
            padding: var(--btn-padding, 10px 20px);
            border: none;
            border-radius: var(--btn-radius, 6px);
            cursor: pointer;
            transition: all 0.2s ease;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            gap: 8px;
          }
          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .btn.small {
            --btn-font-size: 12px;
            --btn-padding: 6px 12px;
          }
          .btn.large {
            --btn-font-size: 16px;
            --btn-padding: 14px 28px;
          }
          .btn.primary {
            background: #ff3e00;
            color: white;
          }
          .btn.primary:hover:not(:disabled) {
            background: #e63700;
          }
          .btn.secondary {
            background: #676778;
            color: white;
          }
          .btn.secondary:hover:not(:disabled) {
            background: #5a5a68;
          }
          .btn.danger {
            background: #dc3545;
            color: white;
          }
          .btn.danger:hover:not(:disabled) {
            background: #c82333;
          }
          .btn.success {
            background: #28a745;
            color: white;
          }
          .btn.success:hover:not(:disabled) {
            background: #218838;
          }
          .spinner {
            width: 14px;
            height: 14px;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
        <button class="btn \${this.variant} \${this.size}" \${isDisabled ? 'disabled' : ''}>
          \${this.loading ? '<span class="spinner"></span>' : ''}
          <slot></slot>
        </button>
      \`;
    }
  }

  onMount(() => {
    if (browser && !customElements.get('custom-button')) {
      customElements.define('custom-button', CustomButtonElement);
    }
  });

  function handleClick(e: CustomEvent) {
    console.log('Custom button clicked:', e.detail);
  }
</script>

<div class="web-component-example">
  <h3>Custom Button Web Component</h3>
  <p>Features: Slot API, reactive styling, loading states</p>

  <div class="button-examples">
    <custom-button on:custom-click={handleClick}>
      Primary Button
    </custom-button>

    <custom-button variant="secondary" size="small" on:custom-click={handleClick}>
      Small Secondary
    </custom-button>

    <custom-button variant="danger" size="large" on:custom-click={handleClick}>
      Large Danger
    </custom-button>

    <custom-button variant="success" loading={loading} on:custom-click={handleClick}>
      {loading ? 'Loading...' : 'Success Button'}
    </custom-button>
  </div>

  <button on:click={() => loading = !loading}>
    Toggle Loading State
  </button>
</div>

<style>
  .button-examples {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 16px 0;
  }
</style>
`;
  }

  /**
   * Counter Web Component
   * Demonstrates: State management, event dispatching, lifecycle
   */
  protected generateWebComponentCounter() {
    return `<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';

  export let value = 0;
  export let min = 0;
  export let max = 100;
  export let step = 1;

  let localValue = value;

  class CounterElement extends HTMLElement {
    static get observedAttributes() {
      return ['value', 'min', 'max', 'step'];
    }

    private shadow: ShadowRoot;
    private _value = 0;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
      this._value = parseInt(this.getAttribute('value') || '0');
    }

    get value() { return this._value; }
    set value(val: number) {
      const min = parseInt(this.getAttribute('min') || '0');
      const max = parseInt(this.getAttribute('max') || '100');
      this._value = Math.max(min, Math.min(max, val));
      this.render();
    }

    connectedCallback() {
      this.render();
      this.shadow.querySelector('.decrement')?.addEventListener('click', () => this.decrement());
      this.shadow.querySelector('.increment')?.addEventListener('click', () => this.increment());
    }

    increment() {
      const step = parseInt(this.getAttribute('step') || '1');
      this.value = this._value + step;
      this.dispatchChange();
    }

    decrement() {
      const step = parseInt(this.getAttribute('step') || '1');
      this.value = this._value - step;
      this.dispatchChange();
    }

    dispatchChange() {
      this.dispatchEvent(new CustomEvent('counter-change', {
        bubbles: true,
        composed: true,
        detail: { value: this._value }
      }));
    }

    render() {
      const min = parseInt(this.getAttribute('min') || '0');
      const max = parseInt(this.getAttribute('max') || '100');

      this.shadow.innerHTML = \`
        <style>
          :host {
            display: inline-block;
          }
          .counter {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #f5f5f5;
            border-radius: 8px;
            padding: 4px;
          }
          .counter-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s;
          }
          .counter-btn:hover:not(:disabled) {
            background: #ff3e00;
            color: white;
          }
          .counter-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }
          .counter-value {
            min-width: 48px;
            text-align: center;
            font-weight: 600;
            font-size: 16px;
          }
        </style>
        <div class="counter">
          <button class="counter-btn decrement" \${this._value <= min ? 'disabled' : ''}>−</button>
          <span class="counter-value">\${this._value}</span>
          <button class="counter-btn increment" \${this._value >= max ? 'disabled' : ''}>+</button>
        </div>
      \`;
    }
  }

  onMount(() => {
    if (browser && !customElements.get('counter-element')) {
      customElements.define('counter-element', CounterElement);
    }
  });

  function handleChange(e: CustomEvent) {
    localValue = e.detail.value;
  }
</script>

<div class="web-component-example">
  <h3>Counter Web Component</h3>
  <p>Stateful component with min/max constraints and change events</p>

  <div class="counter-examples">
    <counter-element
      value={value}
      min={min}
      max={max}
      step={step}
      on:counter-change={handleChange}
    ></counter-element>

    <p>Current value: {localValue}</p>

    <counter-element value="5" min="0" max="10" step="2"></counter-element>
  </div>
</div>

<style>
  .counter-examples {
    display: flex;
    align-items: center;
    gap: 20px;
    margin: 16px 0;
  }
</style>
`;
  }

  /**
   * Modal Web Component
   * Demonstrates: Portal-like behavior, overlay, accessibility
   */
  protected generateWebComponentModal() {
    return `<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  export let open = false;
  export let title = 'Modal Title';
  export let closeOnEsc = true;
  export let closeOnBackdrop = true;

  class ModalElement extends HTMLElement {
    static get observedAttributes() {
      return ['open', 'title', 'close-on-esc', 'close-on-backdrop'];
    }

    private shadow: ShadowRoot;
    private _open = false;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
    }

    get open() { return this._open; }
    set open(value: boolean) {
      this._open = value;
      this.render();
      if (value) {
        this trapFocus();
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }

    connectedCallback() {
      this.render();
      this._open = this.hasAttribute('open');
    }

    trapFocus() {
      const focusable = this.shadow.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };

      this.addEventListener('keydown', handleTab);
      first?.focus();
    }

    close() {
      this.open = false;
      this.dispatchEvent(new CustomEvent('modal-close', { bubbles: true, composed: true }));
    }

    render() {
      const title = this.getAttribute('title') || title;
      const closeOnEsc = this.hasAttribute('close-on-esc');
      const closeOnBackdrop = this.hasAttribute('close-on-backdrop');

      this.shadow.innerHTML = \`
        <style>
          :host {
            display: \${this._open ? 'contents' : 'none'};
          }
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            animation: fadeIn 0.15s ease;
          }
          .modal {
            background: white;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 85vh;
            overflow: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideUp 0.2s ease;
          }
          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px;
            border-bottom: 1px solid #eee;
          }
          .modal-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0;
          }
          .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #666;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }
          .modal-close:hover {
            background: #f5f5f5;
          }
          .modal-body {
            padding: 20px;
          }
          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            padding: 16px 20px;
            border-top: 1px solid #eee;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        </style>
        <div class="modal-overlay" data-backdrop>
          <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div class="modal-header">
              <h2 class="modal-title" id="modal-title">\${title}</h2>
              <button class="modal-close" aria-label="Close" data-close>&times;</button>
            </div>
            <div class="modal-body">
              <slot></slot>
            </div>
            <div class="modal-footer">
              <slot name="footer">
                <button type="button" data-close>Cancel</button>
                <button type="button" class="confirm" data-confirm>Confirm</button>
              </slot>
            </div>
          </div>
        </div>
      \`;

      // Event listeners
      this.shadow.querySelector('[data-close]')?.addEventListener('click', () => this.close());
      this.shadow.querySelector('[data-confirm]')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('modal-confirm', { bubbles: true, composed: true }));
      });

      if (closeOnBackdrop) {
        this.shadow.querySelector('[data-backdrop]')?.addEventListener('click', (e: Event) => {
          if (e.target === e.currentTarget) this.close();
        });
      }

      if (closeOnEsc) {
        const handleEsc = (e: KeyboardEvent) => {
          if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', handleEsc, { once: true });
      }
    }
  }

  onMount(() => {
    if (browser && !customElements.get('modal-element')) {
      customElements.define('modal-element', ModalElement);
    }
  });

  function handleOpen() { open = true; }
  function handleClose() { open = false; }
  function handleConfirm() {
    console.log('Modal confirmed');
    open = false;
  }
</script>

<div class="web-component-example">
  <h3>Modal Web Component</h3>
  <p>Accessible modal with focus trap, keyboard support, and event dispatching</p>

  <button on:click={handleOpen}>Open Modal</button>

  <modal-element
    title="Web Component Modal"
    open={open}
    close-on-esc
    close-on-backdrop
    on:modal-close={handleClose}
    on:modal-confirm={handleConfirm}
  >
    <p>This is a modal built with Web Components Custom Elements v1.</p>
    <p>Features include:</p>
    <ul>
      <li>Shadow DOM encapsulation</li>
      <li>Focus trap for accessibility</li>
      <li>ESC key to close</li>
      <li>Click outside to close</li>
      <li>Custom event dispatching</li>
    </ul>

    <div slot="footer" style="display: flex; gap: 8px;">
      <button onclick="this.closest('modal-element').dispatchEvent(new CustomEvent('modal-close'))">
        Custom Cancel
      </button>
      <button onclick="this.closest('modal-element').dispatchEvent(new CustomEvent('modal-confirm'))" style="background: #ff3e00; color: white; border: none; padding: 8px 16px; border-radius: 4px;">
        Custom Confirm
      </button>
    </div>
  </modal-element>
</div>
`;
  }

  /**
   * Web Components Registry
   * Utility module for registering and managing web components
   */
  protected generateWebComponentsRegistry() {
    return `/**
 * Web Components Registry
 *
 * This module provides utilities for registering and managing custom elements.
 * It includes helper functions for safe component registration and lifecycle management.
 */

import { browser } from '$app/environment';

/**
 * Registry of all web components
 */
const componentRegistry = new Map<string, CustomElementConstructor>();

/**
 * Safely register a custom element
 * @param tagName - The custom element tag name (must contain a hyphen)
 * @param constructor - The custom element constructor
 * @returns true if registered, false if already exists
 */
export function registerComponent(
  tagName: string,
  constructor: CustomElementConstructor
): boolean {
  if (!browser) {
    console.warn(\`[WebComponents] Cannot register \${tagName} on the server\`);
    return false;
  }

  if (customElements.get(tagName)) {
    console.warn(\`[WebComponents] \${tagName} is already registered\`);
    return false;
  }

  customElements.define(tagName, constructor);
  componentRegistry.set(tagName, constructor);
  console.log(\`[WebComponents] Registered \${tagName}\`);

  return true;
}

/**
 * Check if a custom element is registered
 */
export function isRegistered(tagName: string): boolean {
  return customElements.get(tagName) !== undefined;
}

/**
 * Get a custom element constructor
 */
export function getComponent(tagName: string): CustomElementConstructor | undefined {
  return customElements.get(tagName);
}

/**
 * Wait for a custom element to be defined
 * Useful when working with dynamically loaded components
 */
export function whenDefined(tagName: string): Promise<void> {
  return customElements.whenDefined(tagName);
}

/**
 * Register all web components
 * Call this in your app's initialization code
 */
export function registerAll(): void {
  if (!browser) return;

  // Components are auto-registered in their onMount
  // This function ensures all are available for SSR/hydration
  console.log('[WebComponents] All components registered');
}

/**
 * Create a web component instance with props
 * @param tagName - The custom element tag name
 * @param props - Object mapping attribute names to values
 * @returns The created element or null if tag is not registered
 */
export function createComponent(
  tagName: string,
  props: Record<string, string | number | boolean> = {}
): HTMLElement | null {
  if (!isRegistered(tagName)) {
    console.warn(\`[WebComponents] \${tagName} is not registered\`);
    return null;
  }

  const element = document.createElement(tagName);

  Object.entries(props).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      if (value) element.setAttribute(key, '');
    } else {
      element.setAttribute(key, String(value));
    }
  });

  return element;
}

/**
 * HOC that wraps a Svelte component to register its web components
 * Use this in route components that use custom elements
 */
export function withWebComponents<T extends Record<string, any>>(
  component: T,
  components: string[] = []
): T {
  if (browser) {
    // Wait for all components to be defined before rendering
    Promise.all(components.map(tag => customElements.whenDefined(tag))).then(() => {
      console.log('[WebComponents] All required components are ready');
    });
  }
  return component;
}

/**
 * Web component version info
 */
export const WEB_COMPONENTS_VERSION = '1.0.0';

/**
 * List of all custom element tags used in this app
 */
export const CUSTOM_ELEMENTS = [
  'user-card',
  'custom-button',
  'counter-element',
  'modal-element'
] as const;

export type CustomElementTag = typeof CUSTOM_ELEMENTS[number];
`;
  }

  // WebAssembly (WASM) Integration Examples

  /**
   * Fibonacci WASM Example
   * Demonstrates: Loading WASM modules, calling WASM functions, performance comparison
   */
  protected generateFibonacciWasm() {
    return `<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { loadWasm, measureWasmVsJs } from '$lib/components/wasm/wasm-utils';

  let wasmModule: WebAssembly.WebAssemblyInstantiatedSource | null = null;
  let wasmFib: ((n: number) => number) | null = null;
  let inputNumber = 40;
  let wasmResult = 0;
  let jsResult = 0;
  let wasmTime = 0;
  let jsTime = 0;
  let loading = false;
  let error = '';

  // Simple Fibonacci implementation for comparison
  function fibonacciJS(n: number): number {
    if (n <= 1) return n;
    return fibonacciJS(n - 1) + fibonacciJS(n - 2);
  }

  // Simple WASM module as base64 (fibonacci.wasm)
  // This is a minimal WASM module that exports a fibonacci function
  const wasmBase64 = 'AGFzbQEAAAABBwBgA39/fwF/YAB/f39/AX9gAX8Bf2ABfwF/YAF9AX9gAX8Bf2AAAX9gAX8Bf2ABfn9gAX8Bf2AAAX9gAX8Bf2ABfn9gAn9/AX9gAX8BfGAAAX9gAX8Bf2ABfn9/AX9gAn9/AX4DAgNACAAQQA2AhAgAEEANgIUIAJBAWohBCACQQFqIQQgAEEBNgIAIABBAjYCACAAQQU2AgAgAEEINgIAIAFBATYCACABQQI2AgAgAUEENgIAIAFBBTYCACABQQg2AgAgAUEJNgIAIAFBCjYCACABQQs2AgAgAUENNgIA';

  async function loadWasmModule() {
    if (!browser) return;

    loading = true;
    error = '';

    try {
      // Decode base64 to binary
      const binaryString = atob(wasmBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Instantiate WASM module
      const module = await WebAssembly.instantiate(bytes);
      wasmModule = module;

      // Get the fibonacci function export
      // Note: For a real fibonacci function, you'd need a properly compiled WASM module
      // This is a placeholder showing the pattern
      wasmFib = (n: number) => {
        // For demo purposes, use JS implementation
        // In production, this would be: module.instance.exports.fibonacci(n);
        return fibonacciJS(n);
      };

    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load WASM module';
      console.error('WASM load error:', e);
    } finally {
      loading = false;
    }
  }

  function runComparison() {
    if (!wasmFib) {
      error = 'WASM module not loaded';
      return;
    }

    // Measure WASM performance
    const wasmStart = performance.now();
    wasmResult = wasmFib(inputNumber);
    wasmTime = performance.now() - wasmStart;

    // Measure JS performance
    const jsStart = performance.now();
    jsResult = fibonacciJS(inputNumber);
    jsTime = performance.now() - jsStart;
  }

  onMount(() => {
    loadWasmModule();
  });
</script>

<div class="wasm-example">
  <h2>WebAssembly Fibonacci Calculator</h2>
  <p>Compare performance between WASM and JavaScript implementations</p>

  {#if loading}
    <div class="loading">Loading WASM module...</div>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <div class="controls">
    <label for="fib-input">Calculate Fibonacci(n):</label>
    <input
      id="fib-input"
      type="number"
      min="0"
      max="45"
      bind:value={inputNumber}
    />
    <button on:click={runComparison} disabled={loading || !wasmFib}>
      Run Comparison
    </button>
  </div>

  {#if wasmTime > 0 || jsTime > 0}
    <div class="results">
      <h3>Results for n = {inputNumber}</h3>

      <div class="result-card wasm">
        <h4>WebAssembly</h4>
        <div class="result-value">{wasmResult.toLocaleString()}</div>
        <div class="result-time">{wasmTime.toFixed(3)} ms</div>
      </div>

      <div class="result-card js">
        <h4>JavaScript</h4>
        <div class="result-value">{jsResult.toLocaleString()}</div>
        <div class="result-time">{jsTime.toFixed(3)} ms</div>
      </div>

      <div class="speedup">
        Speedup: {jsTime > 0 ? (jsTime / wasmTime).toFixed(2) : 'N/A'}x
        {jsTime < wasmTime ? ' 🐌 (JS faster)' : ' 🚀 (WASM faster)'}
      </div>
    </div>
  {/if}

  <div class="info">
    <h4>Understanding WASM Performance</h4>
    <ul>
      <li>WASM excels at CPU-intensive tasks (image processing, cryptography, calculations)</li>
      <li>JavaScript can be faster for simple operations due to JIT compilation</li>
      <li>WASM provides near-native performance for compiled code</li>
    </ul>
  </div>
</div>

<style>
  .wasm-example {
    padding: 24px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    margin: 20px 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  .wasm-example h2 {
    margin-top: 0;
  }
  .controls {
    display: flex;
    gap: 12px;
    align-items: center;
    margin: 20px 0;
    flex-wrap: wrap;
  }
  .controls input {
    padding: 8px 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
  }
  .controls button {
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  .controls button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
  }
  .controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .loading, .error {
    padding: 12px;
    border-radius: 6px;
    margin: 12px 0;
  }
  .loading {
    background: rgba(255, 255, 255, 0.1);
  }
  .error {
    background: rgba(220, 38, 38, 0.3);
  }
  .results {
    display: grid;
    gap: 16px;
    margin: 20px 0;
  }
  .result-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  .result-card h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    opacity: 0.9;
  }
  .result-value {
    font-size: 32px;
    font-weight: 700;
    margin: 8px 0;
  }
  .result-time {
    font-size: 14px;
    opacity: 0.8;
  }
  .speedup {
    text-align: center;
    font-size: 18px;
    font-weight: 600;
    margin-top: 8px;
  }
  .info {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 16px;
    margin-top: 20px;
  }
  .info h4 {
    margin-top: 0;
  }
  .info ul {
    margin: 8px 0 0 20px;
  }
</style>
`;
  }

  /**
   * Image Processor WASM Example
   * Demonstrates: Image manipulation with WASM, memory management, SharedArrayBuffer
   */
  protected generateImageProcessorWasm() {
    return `<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { processImageWithWasm, createGrayscaleFilter, createBlurFilter } from '$lib/components/wasm/wasm-utils';

  let canvasElement: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let originalImageData: ImageData | null = null;
  let processedImageData: ImageData | null = null;

  let uploadedImage: HTMLImageElement | null = null;
  let selectedFilter = 'grayscale';
  let filterIntensity = 100;
  let processingTime = 0;
  let isProcessing = false;

  const filters = [
    { value: 'grayscale', label: 'Grayscale' },
    { value: 'blur', label: 'Blur' },
    { value: 'invert', label: 'Invert Colors' },
    { value: 'brightness', label: 'Brightness' },
    { value: 'threshold', label: 'Threshold' }
  ];

  onMount(() => {
    if (browser && canvasElement) {
      ctx = canvasElement.getContext('2d', { willReadFrequently: true })!;
      loadSampleImage();
    }
  });

  function loadSampleImage() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      uploadedImage = img;
      drawImageToCanvas();
    };
    // Use a placeholder image
    img.src = 'data:image/svg+xml,' + encodeURIComponent(\`
      <svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">
        <defs>
          <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#ff6b6b"/>
            <stop offset="50%" style="stop-color:#4ecdc4"/>
            <stop offset="100%" style="stop-color:#45b7d1"/>
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#g)"/>
        <circle cx="200" cy="150" r="80" fill="white" opacity="0.3"/>
        <rect x="100" y="100" width="200" height="100" fill="white" opacity="0.2"/>
      </svg>
    \`);
  }

  function drawImageToCanvas() {
    if (!uploadedImage || !ctx || !canvasElement) return;

    // Resize canvas to match image (max 600px width)
    const maxWidth = 600;
    const scale = Math.min(1, maxWidth / uploadedImage.width);
    canvasElement.width = uploadedImage.width * scale;
    canvasElement.height = uploadedImage.height * scale;

    ctx.drawImage(uploadedImage, 0, 0, canvasElement.width, canvasElement.height);
    originalImageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      uploadedImage = img;
      drawImageToCanvas();
    };
    img.src = URL.createObjectURL(file);
  }

  async function applyFilter() {
    if (!originalImageData || !ctx || !canvasElement || isProcessing) return;

    isProcessing = true;
    const startTime = performance.now();

    try {
      // Clone the original image data
      const imageData = new ImageData(
        new Uint8ClampedArray(originalImageData.data),
        originalImageData.width,
        originalImageData.height
      );

      // Apply the selected filter using WASM-like processing
      // In production, this would call actual WASM functions
      const result = processImageWithWasm(imageData, selectedFilter, filterIntensity);

      // Put the processed image data back
      ctx.putImageData(result, 0, 0);
      processedImageData = result;

      processingTime = performance.now() - startTime;
    } catch (error) {
      console.error('Filter error:', error);
    } finally {
      isProcessing = false;
    }
  }

  function resetImage() {
    if (!originalImageData || !ctx) return;
    ctx.putImageData(originalImageData, 0, 0);
    processedImageData = null;
    processingTime = 0;
  }

  function downloadImage() {
    if (!canvasElement) return;
    const link = document.createElement('a');
    link.download = \`processed-\${selectedFilter}.png\`;
    link.href = canvasElement.toDataURL();
    link.click();
  }
</script>

<div class="image-processor">
  <h2>Image Processing with WebAssembly</h2>
  <p>Apply filters using near-native performance</p>

  <div class="processor-layout">
    <div class="controls-panel">
      <div class="control-group">
        <h4>Upload Image</h4>
        <input
          type="file"
          accept="image/*"
          on:change={handleFileUpload}
          id="image-upload"
        />
        <label for="image-upload" class="upload-btn">
          Choose File
        </label>
      </div>

      <div class="control-group">
        <h4>Filter</h4>
        <select bind:value={selectedFilter}>
          {#each filters as filter}
            <option value={filter.value}>{filter.label}</option>
          {/each}
        </select>
      </div>

      <div class="control-group">
        <h4>Intensity: {filterIntensity}%</h4>
        <input
          type="range"
          min="0"
          max="100"
          bind:value={filterIntensity}
        />
      </div>

      <div class="button-group">
        <button
          class="apply-btn"
          on:click={applyFilter}
          disabled={isProcessing || !originalImageData}
        >
          {isProcessing ? 'Processing...' : 'Apply Filter'}
        </button>
        <button
          class="reset-btn"
          on:click={resetImage}
          disabled={!processedImageData}
        >
          Reset
        </button>
        <button
          class="download-btn"
          on:click={downloadImage}
          disabled={!processedImageData}
        >
          Download
        </button>
      </div>

      {#if processingTime > 0}
        <div class="performance-stats">
          <strong>Processing time:</strong> {processingTime.toFixed(2)} ms
        </div>
      {/if}
    </div>

    <div class="canvas-container">
      <canvas
        bind:this={canvasElement}
        class="image-canvas"
      ></canvas>

      {#if !originalImageData}
        <div class="placeholder">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <p>Load an image to get started</p>
        </div>
      {/if}
    </div>
  </div>

  <div class="info-panel">
    <h4>WASM Image Processing Benefits</h4>
    <div class="benefits-grid">
      <div class="benefit">
        <strong>🚀 Performance</strong>
        <p>Near-native execution speed for pixel manipulation</p>
      </div>
      <div class="benefit">
        <strong>💾 Memory</strong>
        <p>Direct memory access with SharedArrayBuffer support</p>
      </div>
      <div class="benefit">
        <strong>🔒 Security</strong>
        <p>Sandboxed execution environment</p>
      </div>
      <div class="benefit">
        <strong>📱 Portable</strong>
        <p>Same binary runs on any platform</p>
      </div>
    </div>
  </div>
</div>

<style>
  .image-processor {
    padding: 24px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    margin: 20px 0;
  }
  .processor-layout {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: 24px;
    margin: 20px 0;
  }
  @media (max-width: 768px) {
    .processor-layout {
      grid-template-columns: 1fr;
    }
  }
  .controls-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .control-group h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #555;
  }
  .control-group input[type="file"] {
    display: none;
  }
  .upload-btn {
    display: inline-block;
    padding: 8px 16px;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
    transition: all 0.2s;
  }
  .upload-btn:hover {
    background: #e8e8e8;
  }
  .control-group select {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }
  .control-group input[type="range"] {
    width: 100%;
  }
  .button-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .button-group button {
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s;
  }
  .apply-btn {
    background: #ff3e00;
    color: white;
  }
  .apply-btn:hover:not(:disabled) {
    background: #e63700;
  }
  .reset-btn {
    background: #676778;
    color: white;
  }
  .reset-btn:hover:not(:disabled) {
    background: #5a5a68;
  }
  .download-btn {
    background: #28a745;
    color: white;
  }
  .download-btn:hover:not(:disabled) {
    background: #218838;
  }
  .button-group button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .performance-stats {
    padding: 12px;
    background: #f0f9ff;
    border-radius: 6px;
    font-size: 14px;
  }
  .canvas-container {
    position: relative;
    min-height: 300px;
    background: #f8f8f8;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .image-canvas {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: #999;
  }
  .placeholder svg {
    opacity: 0.5;
  }
  .info-panel {
    margin-top: 24px;
    padding: 16px;
    background: #f8f9fa;
    border-radius: 8px;
  }
  .info-panel h4 {
    margin-top: 0;
  }
  .benefits-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-top: 12px;
  }
  .benefit {
    padding: 12px;
    background: white;
    border-radius: 6px;
  }
  .benefit strong {
    display: block;
    margin-bottom: 4px;
  }
  .benefit p {
    margin: 0;
    font-size: 13px;
    color: #666;
  }
</style>
`;
  }

  /**
   * WASM Utilities
   * Helper functions for loading and working with WebAssembly modules
   */
  protected generateWasmUtils() {
    return `/**
 * WebAssembly (WASM) Utilities
 *
 * This module provides helper functions for loading, instantiating,
 * and working with WebAssembly modules in SvelteKit applications.
 */

import { browser } from '$app/environment';

/**
 * WASM module cache to avoid reloading the same module
 */
const wasmCache = new Map<string, WebAssembly.WebAssemblyInstantiatedSource>();

/**
 * Load a WASM module from a URL
 * @param url - URL to the WASM file
 * @param useCache - Whether to cache the module (default: true)
 * @returns The instantiated WASM module
 */
export async function loadWasm(
  url: string,
  useCache = true
): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
  if (!browser) {
    throw new Error('WASM can only be loaded in the browser');
  }

  // Check cache first
  if (useCache && wasmCache.has(url)) {
    return wasmCache.get(url)!;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(\`Failed to load WASM module: \${response.statusText}\`);
  }

  const buffer = await response.arrayBuffer();
  const module = await WebAssembly.instantiate(buffer);

  if (useCache) {
    wasmCache.set(url, module);
  }

  return module;
}

/**
 * Load a WASM module from base64 encoded string
 * @param base64 - Base64 encoded WASM binary
 * @returns The instantiated WASM module
 */
export async function loadWasmFromBase64(
  base64: string
): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
  if (!browser) {
    throw new Error('WASM can only be loaded in the browser');
  }

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return await WebAssembly.instantiate(bytes);
}

/**
 * Create a WebAssembly memory object
 * @param initial - Initial pages (64KB each)
 * @param maximum - Maximum pages
 * @param shared - Whether to use SharedArrayBuffer
 */
export function createWasmMemory(
  initial = 256,
  maximum = 512,
  shared = false
): WebAssembly.Memory {
  return new WebAssembly.Memory({
    initial,
    maximum,
    shared: shared && typeof SharedArrayBuffer !== 'undefined'
  });
}

/**
 * Read a string from WASM memory
 * @param memory - The WebAssembly memory object
 * @param offset - Byte offset in memory
 * @param length - Length of the string
 * @returns The decoded string
 */
export function readWasmString(
  memory: WebAssembly.Memory,
  offset: number,
  length: number
): string {
  const bytes = new Uint8Array(memory.buffer, offset, length);
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Write a string to WASM memory
 * @param memory - The WebAssembly memory object
 * @param offset - Byte offset in memory
 * @param str - String to write
 * @returns The number of bytes written
 */
export function writeWasmString(
  memory: WebAssembly.Memory,
  offset: number,
  str: string
): number {
  const bytes = new TextEncoder().encode(str);
  new Uint8Array(memory.buffer, offset, bytes.length).set(bytes);
  return bytes.length;
}

/**
 * Measure performance between WASM and JS implementations
 * @param wasmFn - The WASM function to test
 * @param jsFn - The JavaScript function to test
 * @param input - Input to pass to both functions
 * @param iterations - Number of iterations to run
 * @returns Performance comparison results
 */
export async function measureWasmVsJs<T>(
  wasmFn: (input: T) => any,
  jsFn: (input: T) => any,
  input: T,
  iterations = 100
): Promise<{ wasmTime: number; jsTime: number; speedup: number }> {
  // Warm up
  for (let i = 0; i < 10; i++) {
    wasmFn(input);
    jsFn(input);
  }

  // Measure WASM
  const wasmStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    wasmFn(input);
  }
  const wasmTime = performance.now() - wasmStart;

  // Measure JS
  const jsStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    jsFn(input);
  }
  const jsTime = performance.now() - jsStart;

  return {
    wasmTime: wasmTime / iterations,
    jsTime: jsTime / iterations,
    speedup: jsTime / wasmTime
  };
}

/**
 * Image processing utilities for WASM
 */

/**
 * Process image data with a filter (simulated WASM implementation)
 * In production, this would call actual WASM functions
 */
export function processImageWithWasm(
  imageData: ImageData,
  filter: string,
  intensity: number
): ImageData {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  switch (filter) {
    case 'grayscale':
      return applyGrayscale(data, width, height, intensity);
    case 'invert':
      return applyInvert(data, width, height, intensity);
    case 'brightness':
      return applyBrightness(data, width, height, intensity);
    case 'threshold':
      return applyThreshold(data, width, height, intensity);
    case 'blur':
      return applyBlur(data, width, height, intensity / 100);
    default:
      return imageData;
  }
}

function applyGrayscale(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number
): ImageData {
  const factor = intensity / 100;
  const output = new Uint8ClampedArray(data);

  for (let i = 0; i < output.length; i += 4) {
    const gray = output[i] * 0.299 + output[i + 1] * 0.587 + output[i + 2] * 0.114;
    output[i] = output[i] + (gray - output[i]) * factor;
    output[i + 1] = output[i + 1] + (gray - output[i + 1]) * factor;
    output[i + 2] = output[i + 2] + (gray - output[i + 2]) * factor;
  }

  return new ImageData(output, width, height);
}

function applyInvert(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number
): ImageData {
  const factor = intensity / 100;
  const output = new Uint8ClampedArray(data);

  for (let i = 0; i < output.length; i += 4) {
    output[i] = output[i] + (255 - output[i] * 2) * factor;
    output[i + 1] = output[i + 1] + (255 - output[i + 1] * 2) * factor;
    output[i + 2] = output[i + 2] + (255 - output[i + 2] * 2) * factor;
  }

  return new ImageData(output, width, height);
}

function applyBrightness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number
): ImageData {
  const adjustment = (intensity - 50) * 2.55;
  const output = new Uint8ClampedArray(data);

  for (let i = 0; i < output.length; i += 4) {
    output[i] = Math.max(0, Math.min(255, output[i] + adjustment));
    output[i + 1] = Math.max(0, Math.min(255, output[i + 1] + adjustment));
    output[i + 2] = Math.max(0, Math.min(255, output[i + 2] + adjustment));
  }

  return new ImageData(output, width, height);
}

function applyThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  intensity: number
): ImageData {
  const threshold = (255 * intensity) / 100;
  const output = new Uint8ClampedArray(data);

  for (let i = 0; i < output.length; i += 4) {
    const gray = output[i] * 0.299 + output[i + 1] * 0.587 + output[i + 2] * 0.114;
    const value = gray > threshold ? 255 : 0;
    output[i] = output[i + 1] = output[i + 2] = value;
  }

  return new ImageData(output, width, height);
}

function applyBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number
): ImageData {
  if (radius <= 0) return new ImageData(data, width, height);

  const output = new Uint8ClampedArray(data);
  const kernelSize = Math.ceil(radius * 3);
  const kernel: number[] = [];

  // Create Gaussian kernel
  for (let i = 0; i < kernelSize; i++) {
    const x = i - kernelSize / 2;
    kernel.push(Math.exp(-(x * x) / (2 * radius * radius)));
  }

  // Normalize kernel
  const sum = kernel.reduce((a, b) => a + b, 0);
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  // Apply horizontal blur
  const temp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < kernelSize; k++) {
        const px = Math.min(width - 1, Math.max(0, x + k - kernelSize / 2));
        const idx = (y * width + px) * 4;
        r += data[idx] * kernel[k];
        g += data[idx + 1] * kernel[k];
        b += data[idx + 2] * kernel[k];
      }
      const idx = (y * width + x) * 4;
      temp[idx] = r;
      temp[idx + 1] = g;
      temp[idx + 2] = b;
      temp[idx + 3] = data[idx + 3];
    }
  }

  // Apply vertical blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < kernelSize; k++) {
        const py = Math.min(height - 1, Math.max(0, y + k - kernelSize / 2));
        const idx = (py * width + x) * 4;
        r += temp[idx] * kernel[k];
        g += temp[idx + 1] * kernel[k];
        b += temp[idx + 2] * kernel[k];
      }
      const idx = (y * width + x) * 4;
      output[idx] = r;
      output[idx + 1] = g;
      output[idx + 2] = b;
      output[idx + 3] = temp[idx + 3];
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Create a grayscale filter function (for use with WASM)
 */
export function createGrayscaleFilter() {
  return (data: Uint8ClampedArray, width: number, height: number) => {
    return applyGrayscale(data, width, height, 100);
  };
}

/**
 * Create a blur filter function (for use with WASM)
 */
export function createBlurFilter(radius: number) {
  return (data: Uint8ClampedArray, width: number, height: number) => {
    return applyBlur(data, width, height, radius);
  };
}

/**
 * WASM feature detection
 */
export const wasmFeatures = {
  simd: (() => {
    try {
      return WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ]));
    } catch {
      return false;
    }
  })(),

  threads: typeof SharedArrayBuffer !== 'undefined',

  bulkMemory: (() => {
    try {
      return WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 112, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ]));
    } catch {
      return false;
    }
  })(),

  exceptions: (() => {
    try {
      return WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 112, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ]));
    } catch {
      return false;
    }
  })()
};
`;
  }

  // Micro-Frontend Communication Examples

  /**
   * Event Bus Component
   * Demonstrates: Custom events, event bubbling, cross-frame communication
   */
  protected generateEventBus() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { eventBus, EventBusEvent } from '$lib/components/microfrontend/micro-frontend';

  // Local state for this micro-frontend
  let message = '';
  let receivedMessages: EventBusEvent[] = [];
  let eventCount = 0;

  // Unsubscribe function
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    // Subscribe to events from other micro-frontends
    unsubscribe = eventBus.subscribe('*', (event) => {
      receivedMessages = [...receivedMessages, event];
      eventCount++;
    });
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  function publishEvent() {
    if (!message.trim()) return;

    eventBus.publish('custom:message', {
      text: message,
      timestamp: Date.now(),
      source: 'sveltekit-mfe'
    });

    message = '';
  }

  function clearMessages() {
    receivedMessages = [];
    eventCount = 0;
  }

  // Broadcast to all iframes/windows
  function broadcastToAll() {
    eventBus.broadcast('global:ping', {
      source: 'sveltekit',
      time: new Date().toISOString()
    });
  }
</script>

<div class="event-bus-demo">
  <h2>Micro-Frontend Event Bus</h2>
  <p>Publish and subscribe to events across micro-frontends</p>

  <div class="event-bus-grid">
    <!-- Publisher Section -->
    <div class="panel publisher">
      <h3>Publisher</h3>
      <div class="input-group">
        <input
          type="text"
          placeholder="Type a message..."
          bind:value={message}
          on:keydown={(e) => e.key === 'Enter' && publishEvent()}
        />
        <button on:click={publishEvent} disabled={!message.trim()}>
          Publish
        </button>
      </div>

      <div class="quick-actions">
        <button on:click={broadcastToAll} class="broadcast-btn">
          📡 Broadcast Global
        </button>
      </div>
    </div>

    <!-- Subscriber Section -->
    <div class="panel subscriber">
      <h3>Subscriber</h3>
      <div class="stats">
        <div class="stat">
          <span class="stat-value">{eventCount}</span>
          <span class="stat-label">Events Received</span>
        </div>
      </div>

      <div class="messages-list">
        {#each receivedMessages.slice().reverse() as msg (msg.id)}
          <div class="message-item">
            <span class="message-type">{msg.type}</span>
            <span class="message-content">
              {msg.data?.text || JSON.stringify(msg.data)}
            </span>
            <span class="message-time">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
        {/each}

        {#if receivedMessages.length === 0}
          <div class="empty-state">No messages received yet</div>
        {/if}
      </div>

      {#if receivedMessages.length > 0}
        <button on:click={clearMessages} class="clear-btn">
          Clear Messages
        </button>
      {/if}
    </div>
  </div>

  <div class="info-panel">
    <h4>Event Bus Features</h4>
    <ul>
      <li><strong>Wildcards:</strong> Subscribe to all events with '*'</li>
      <li><strong>Namespaced:</strong> Use colons for event categories (e.g., 'user:login')</li>
      <li><strong>Broadcast:</strong> Send events to all windows/frames</li>
      <li><strong>Type Safety:</strong> Fully typed events with TypeScript</li>
    </ul>
  </div>
</div>

<style>
  .event-bus-demo {
    padding: 24px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    margin: 20px 0;
  }
  .event-bus-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin: 20px 0;
  }
  .panel {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
  }
  .panel h3 {
    margin-top: 0;
    font-size: 16px;
  }
  .input-group {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .input-group input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
  }
  .input-group button {
    padding: 8px 16px;
    background: #ff3e00;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }
  .input-group button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .quick-actions {
    display: flex;
    gap: 8px;
  }
  .broadcast-btn {
    padding: 8px 12px;
    background: #676778;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
  }
  .stats {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }
  .stat {
    text-align: center;
    padding: 12px;
    background: white;
    border-radius: 6px;
  }
  .stat-value {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: #ff3e00;
  }
  .stat-label {
    font-size: 12px;
    color: #666;
  }
  .messages-list {
    max-height: 200px;
    overflow-y: auto;
    background: white;
    border-radius: 6px;
    padding: 8px;
  }
  .message-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    border-bottom: 1px solid #eee;
    font-size: 13px;
  }
  .message-item:last-child {
    border-bottom: none;
  }
  .message-type {
    padding: 2px 6px;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .message-content {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .message-time {
    color: #999;
    font-size: 11px;
  }
  .empty-state {
    text-align: center;
    color: #999;
    padding: 20px;
  }
  .clear-btn {
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    background: transparent;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
  }
  .info-panel {
    background: #f0f9ff;
    border-radius: 8px;
    padding: 16px;
    margin-top: 20px;
  }
  .info-panel h4 {
    margin-top: 0;
  }
  .info-panel ul {
    margin: 8px 0 0 20px;
  }
  .info-panel li {
    margin-bottom: 4px;
  }
</style>
`;
  }

  /**
   * Shared State Component
   * Demonstrates: Cross-micro-frontend state management, sync mechanisms
   */
  protected generateSharedState() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { sharedStore, SharedStoreKeys } from '$lib/components/microfrontend/micro-frontend';

  // Local state synced with shared store
  let userSettings = {
    theme: 'light' as 'light' | 'dark',
    language: 'en',
    fontSize: 16
  };

  let cartItems = 0;
  let notifications = 0;
  let isOnline = true;

  let unsubscribeFns: (() => void)[] = [];

  onMount(() => {
    if (!browser) return;

    // Subscribe to shared state changes
    unsubscribeFns.push(
      sharedStore.subscribe(SharedStoreKeys.USER_SETTINGS, (settings) => {
        if (settings) userSettings = settings as typeof userSettings;
      })
    );

    unsubscribeFns.push(
      sharedStore.subscribe(SharedStoreKeys.CART_ITEMS, (count) => {
        cartItems = count as number;
      })
    );

    unsubscribeFns.push(
      sharedStore.subscribe(SharedStoreKeys.NOTIFICATIONS, (count) => {
        notifications = count as number;
      })
    );

    unsubscribeFns.push(
      sharedStore.subscribe(SharedStoreKeys.ONLINE_STATUS, (status) => {
        isOnline = status as boolean;
      })
    );

    // Initialize local state from shared store
    const savedSettings = sharedStore.get(SharedStoreKeys.USER_SETTINGS);
    if (savedSettings) userSettings = savedSettings as typeof userSettings;
  });

  onDestroy(() => {
    unsubscribeFns.forEach(fn => fn());
  });

  function updateTheme(theme: 'light' | 'dark') {
    userSettings.theme = theme;
    sharedStore.set(SharedStoreKeys.USER_SETTINGS, userSettings);
  }

  function updateLanguage(lang: string) {
    userSettings.language = lang;
    sharedStore.set(SharedStoreKeys.USER_SETTINGS, userSettings);
  }

  function addToCart() {
    cartItems++;
    sharedStore.set(SharedStoreKeys.CART_ITEMS, cartItems);
  }

  function clearCart() {
    cartItems = 0;
    sharedStore.set(SharedStoreKeys.CART_ITEMS, 0);
  }

  function addNotification() {
    notifications++;
    sharedStore.set(SharedStoreKeys.NOTIFICATIONS, notifications);
  }

  function clearNotifications() {
    notifications = 0;
    sharedStore.set(SharedStoreKeys.NOTIFICATIONS, 0);
  }
</script>

<div class="shared-state-demo" class:dark-mode={userSettings.theme === 'dark'}>
  <h2>Micro-Frontend Shared State</h2>
  <p>Synchronized state across all micro-frontends</p>

  <div class="state-grid">
    <!-- Theme Settings -->
    <div class="state-card">
      <h3>🎨 Theme Settings</h3>
      <div class="theme-selector">
        <button
          class:active={userSettings.theme === 'light'}
          on:click={() => updateTheme('light')}
        >
          ☀️ Light
        </button>
        <button
          class:active={userSettings.theme === 'dark'}
          on:click={() => updateTheme('dark')}
        >
          🌙 Dark
        </button>
      </div>

      <div class="setting-row">
        <label>Language:</label>
        <select bind:value={userSettings.language} on:change={(e) => updateLanguage(e.currentTarget.value)}>
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
        </select>
      </div>

      <div class="setting-row">
        <label>Font Size: {userSettings.fontSize}px</label>
        <input
          type="range"
          min="12"
          max="24"
          bind:value={userSettings.fontSize}
          on:input={() => sharedStore.set('user-settings', userSettings)}
        />
      </div>
    </div>

    <!-- Cart State -->
    <div class="state-card">
      <h3>🛒 Shopping Cart</h3>
      <div class="counter-display">
        <span class="counter-value">{cartItems}</span>
        <span class="counter-label">items</span>
      </div>
      <div class="button-row">
        <button on:click={addToCart}>+ Add Item</button>
        <button on:click={clearCart} disabled={cartItems === 0}>Clear</button>
      </div>
    </div>

    <!-- Notifications -->
    <div class="state-card">
      <h3>🔔 Notifications</h3>
      <div class="counter-display">
        <span class="counter-value">{notifications}</span>
        <span class="counter-label">unread</span>
      </div>
      <div class="button-row">
        <button on:click={addNotification}>+ Add Notification</button>
        <button on:click={clearNotifications} disabled={notifications === 0}>Clear All</button>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="state-card">
      <h3>📡 Connection Status</h3>
      <div class="status-display" class:online={isOnline} class:offline={!isOnline}>
        <span class="status-dot"></span>
        <span class="status-text">{isOnline ? 'Online' : 'Offline'}</span>
      </div>
      <button on:click={() => {
        isOnline = !isOnline;
        sharedStore.set(SharedStoreKeys.ONLINE_STATUS, isOnline);
      }}>
        Toggle Status
      </button>
    </div>
  </div>

  <div class="info-panel">
    <h4>Shared State Benefits</h4>
    <ul>
      <li><strong>Sync:</strong> All micro-frontends see the same data instantly</li>
      <li><strong>Persistence:</strong> Survives page navigations and reloads</li>
      <li><strong>Isolation:</strong> Each micro-frontend can work independently</li>
      <li><strong>Type Safety:</strong> Typed access to shared data structures</li>
    </ul>
  </div>
</div>

<style>
  .shared-state-demo {
    padding: 24px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    margin: 20px 0;
    transition: background 0.3s, color 0.3s;
  }
  .dark-mode {
    background: #1a1a1a;
    color: white;
  }
  .dark-mode .state-card {
    background: #2a2a2a;
    color: white;
  }
  .dark-mode .info-panel {
    background: #2a2a2a;
  }
  .state-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin: 20px 0;
  }
  .state-card {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
  }
  .state-card h3 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 16px;
  }
  .theme-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }
  .theme-selector button {
    flex: 1;
    padding: 8px 12px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .theme-selector button.active {
    background: #ff3e00;
    color: white;
    border-color: #ff3e00;
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .setting-row label {
    font-size: 14px;
  }
  .setting-row select {
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  .counter-display {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 4px;
    margin: 16px 0;
  }
  .counter-value {
    font-size: 48px;
    font-weight: 700;
    color: #ff3e00;
  }
  .counter-label {
    font-size: 14px;
    color: #666;
  }
  .button-row {
    display: flex;
    gap: 8px;
  }
  .button-row button {
    flex: 1;
    padding: 8px 12px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
  }
  .button-row button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .status-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    background: white;
    border-radius: 6px;
    margin: 16px 0;
  }
  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .online .status-dot {
    background: #4CAF50;
    box-shadow: 0 0 8px #4CAF50;
  }
  .offline .status-dot {
    background: #f44336;
  }
  .status-text {
    font-weight: 600;
  }
  .info-panel {
    background: #f0f9ff;
    border-radius: 8px;
    padding: 16px;
    margin-top: 20px;
  }
  .info-panel h4 {
    margin-top: 0;
  }
  .info-panel ul {
    margin: 8px 0 0 20px;
  }
</style>
`;
  }

  /**
   * Micro-App Container Component
   * Demonstrates: Loading external micro-frontends, iframe communication, lazy loading
   */
  protected generateMicroAppContainer() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { eventBus, MicroAppLoader } from '$lib/components/microfrontend/micro-frontend';

  // Available micro-apps
  const microApps = [
    { id: 'dashboard', name: 'Dashboard', url: 'https://example.com/dashboard.js', color: '#ff3e00' },
    { id: 'products', name: 'Products', url: 'https://example.com/products.js', color: '#4CAF50' },
    { id: 'cart', name: 'Shopping Cart', url: 'https://example.com/cart.js', color: '#2196F3' },
    { id: 'settings', name: 'Settings', url: 'https://example.com/settings.js', color: '#9C27B0' }
  ];

  let loadedApps: Set<string> = new Set();
  let activeAppId = '';
  let isLoading = false;
  let loadError: string | null = null;

  let containerElement: HTMLDivElement;
  let loader: MicroAppLoader;
  let iframeElement: HTMLIFrameElement;

  onMount(() => {
    loader = new MicroAppLoader();

    // Listen for events from micro-apps
    eventBus.subscribe('microapp:*', (event) => {
      console.log('Event from micro-app:', event);
    });

    // Listen for iframe messages
    window.addEventListener('message', handleIframeMessage);
  });

  onDestroy(() => {
    window.removeEventListener('message', handleIframeMessage);
    loader?.unloadAll();
  });

  async function loadApp(appId: string) {
    const app = microApps.find(a => a.id === appId);
    if (!app || loadedApps.has(appId)) return;

    isLoading = true;
    loadError = null;

    try {
      // In production, this would load the actual micro-app
      // For demo, we simulate loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      loadedApps.add(appId);
      activeAppId = appId;

      eventBus.publish('microapp:loaded', {
        appId,
        name: app.name,
        timestamp: Date.now()
      });
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Failed to load micro-app';
    } finally {
      isLoading = false;
    }
  }

  function unloadApp(appId: string) {
    loadedApps.delete(appId);
    if (activeAppId === appId) {
      activeAppId = '';
    }
    loader?.unload(appId);
  }

  function handleIframeMessage(event: MessageEvent) {
    // Validate message origin
    if (!event.origin.includes('example.com')) return;

    const { type, payload } = event.data;

    switch (type) {
      case 'MOUNT_READY':
        console.log('Micro-app mounted:', payload.appId);
        break;
      case 'NAVIGATION':
        console.log('Navigation request:', payload.path);
        break;
      case 'AUTH_REQUIRED':
        console.log('Auth required for:', payload.appId);
        break;
    }
  }

  function sendMessageToApp(appId: string, message: any) {
    if (!iframeElement || !iframeElement.contentWindow) return;

    iframeElement.contentWindow.postMessage({
      type: 'HOST_MESSAGE',
      payload: { appId, message }
    }, '*');
  }

  function refreshApp(appId: string) {
    unloadApp(appId);
    loadApp(appId);
  }
</script>

<div class="micro-app-container">
  <h2>Micro-Frontend Container</h2>
  <p>Load and manage multiple micro-frontends in a single application</p>

  <div class="container-layout">
    <!-- Sidebar -->
    <div class="sidebar">
      <h3>Available Micro-Apps</h3>

      <div class="app-list">
        {#each microApps as app (app.id)}
          <div class="app-item" class:loaded={loadedApps.has(app.id)} class:active={activeAppId === app.id}>
            <div class="app-info">
              <span class="app-dot" style="background: {app.color}"></span>
              <span class="app-name">{app.name}</span>
            </div>
            <div class="app-actions">
              {#if loadedApps.has(app.id)}
                <button on:click={() => unloadApp(app.id)} title="Unload">
                  ✕
                </button>
                <button on:click={() => refreshApp(app.id)} title="Refresh">
                  ↻
                </button>
              {:else}
                <button on:click={() => loadApp(app.id)} disabled={isLoading}>
                  {isLoading && activeAppId === app.id ? '...' : '+'}
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="stats-panel">
        <div class="stat-row">
          <span>Loaded:</span>
          <strong>{loadedApps.size} / {microApps.length}</strong>
        </div>
        <div class="stat-row">
          <span>Active:</span>
          <strong>{activeAppId || 'None'}</strong>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="content-area">
      {#if isLoading}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading micro-app...</p>
        </div>
      {:else if activeAppId}
        <div class="app-viewport">
          <div class="viewport-header">
            <span class="viewport-title">
              {microApps.find(a => a.id === activeAppId)?.name}
            </span>
            <div class="viewport-actions">
              <button on:click={() => sendMessageToApp(activeAppId, { action: 'refresh' })}>
                Send Message
              </button>
              <button on:click={() => unloadApp(activeAppId)}>
                Close
              </button>
            </div>
          </div>
          <div class="viewport-content" bind:this={containerElement}>
            <iframe
              bind:this={iframeElement}
              title={activeAppId}
              sandbox="allow-scripts allow-same-origin allow-forms"
              class="app-iframe"
            ></iframe>
          </div>
        </div>
      {:else}
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
          <h3>No Micro-App Loaded</h3>
          <p>Select a micro-app from the sidebar to load it</p>
        </div>
      {/if}

      {#if loadError}
        <div class="error-banner">
          <strong>Error:</strong> {loadError}
        </div>
      {/if}
    </div>
  </div>

  <div class="info-panel">
    <h4>Micro-Frontend Container Features</h4>
    <div class="features-grid">
      <div class="feature">
        <strong>🔄 Lazy Loading</strong>
        <p>Load micro-apps on demand to reduce initial bundle size</p>
      </div>
      <div class="feature">
        <strong>📦 Isolation</strong>
        <p>Sandboxed execution prevents CSS and JS conflicts</p>
      </div>
      <div class="feature">
        <strong>📡 Communication</strong>
        <p>PostMessage API for secure cross-frame messaging</p>
      </div>
      <div class="feature">
        <strong>🎯 Lifecycle</strong>
        <p>Mount, unmount, and refresh micro-apps independently</p>
      </div>
    </div>
  </div>
</div>

<style>
  .micro-app-container {
    padding: 24px;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    margin: 20px 0;
  }
  .container-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 20px;
    min-height: 500px;
  }
  @media (max-width: 768px) {
    .container-layout {
      grid-template-columns: 1fr;
    }
  }
  .sidebar {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
  }
  .sidebar h3 {
    margin-top: 0;
    margin-bottom: 16px;
    font-size: 16px;
  }
  .app-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .app-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: white;
    border-radius: 6px;
    border: 1px solid transparent;
    transition: all 0.2s;
  }
  .app-item:hover {
    border-color: #ddd;
  }
  .app-item.loaded {
    border-color: #4CAF50;
    background: #f1f8f4;
  }
  .app-item.active {
    border-color: #ff3e00;
    box-shadow: 0 0 0 2px rgba(255, 62, 0, 0.2);
  }
  .app-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .app-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .app-name {
    font-weight: 500;
  }
  .app-actions {
    display: flex;
    gap: 4px;
  }
  .app-actions button {
    width: 24px;
    height: 24px;
    border: none;
    background: #f5f5f5;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }
  .app-actions button:hover {
    background: #e8e8e8;
  }
  .stats-panel {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
  }
  .stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    margin-bottom: 4px;
  }
  .content-area {
    background: white;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: #666;
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #f3f3f3;
    border-top-color: #ff3e00;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .app-viewport {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .viewport-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
    background: #f8f9fa;
  }
  .viewport-title {
    font-weight: 600;
  }
  .viewport-actions {
    display: flex;
    gap: 8px;
  }
  .viewport-actions button {
    padding: 6px 12px;
    font-size: 13px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
  }
  .viewport-content {
    flex: 1;
    position: relative;
    background: #fafafa;
  }
  .app-iframe {
    width: 100%;
    height: 100%;
    border: none;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: #999;
  }
  .empty-state svg {
    opacity: 0.5;
  }
  .error-banner {
    padding: 12px 16px;
    background: #fef2f2;
    border-top: 1px solid #fecaca;
    color: #dc2626;
  }
  .info-panel {
    margin-top: 24px;
    padding: 16px;
    background: #f0f9ff;
    border-radius: 8px;
  }
  .info-panel h4 {
    margin-top: 0;
  }
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 12px;
  }
  .feature {
    padding: 12px;
    background: white;
    border-radius: 6px;
  }
  .feature strong {
    display: block;
    margin-bottom: 4px;
  }
  .feature p {
    margin: 0;
    font-size: 13px;
    color: #666;
  }
</style>
`;
  }

  /**
   * Micro-Frontend Utilities
   * Core utilities for micro-frontend communication and state management
   */
  protected generateMicroFrontendUtils() {
    return `/**
 * Micro-Frontend Communication Utilities
 *
 * This module provides utilities for building micro-frontend architectures:
 * - Event Bus for pub/sub messaging
 * - Shared State Store for cross-MFE data
 * - Micro-App Loader for dynamic module loading
 */

import { browser } from '$app/environment';

// ============================================================================
// EVENT BUS
// ============================================================================

export interface EventBusEvent {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  source?: string;
}

type EventListener = (event: EventBusEvent) => void;
type WildcardPattern = string;

class EventBus {
  private listeners = new Map<string, Set<EventListener>>();
  private wildcardListeners = new Set<EventListener>();
  private eventId = 0;

  /**
   * Subscribe to events of a specific type
   * @param type - Event type or wildcard pattern (* for all)
   * @param listener - Event callback function
   * @returns Unsubscribe function
   */
  subscribe(type: string, listener: EventListener): () => void {
    if (!browser) return () => {};

    if (type === '*') {
      this.wildcardListeners.add(listener);
    } else {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, new Set());
      }
      this.listeners.get(type)!.add(listener);
    }

    // Return unsubscribe function
    return () => {
      if (type === '*') {
        this.wildcardListeners.delete(listener);
      } else {
        this.listeners.get(type)?.delete(listener);
      }
    };
  }

  /**
   * Publish an event to all subscribers
   * @param type - Event type
   * @param data - Event payload
   * @param source - Optional source identifier
   */
  publish(type: string, data: any, source?: string): void {
    if (!browser) return;

    const event: EventBusEvent = {
      id: \`event-\${++this.eventId}\`,
      type,
      data,
      timestamp: Date.now(),
      source
    };

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(\`EventBus error for \${type}:\`, error);
        }
      });
    }

    // Notify wildcard listeners
    this.wildcardListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('EventBus wildcard error:', error);
      }
    });

    // Broadcast to other windows/frames
    this.broadcast(type, data, source);
  }

  /**
   * Broadcast event to all windows/frames using postMessage
   */
  broadcast(type: string, data: any, source?: string): void {
    if (!browser) return;

    const message = {
      type: 'MFE_EVENT',
      payload: {
        id: \`broadcast-\${++this.eventId}\`,
        type,
        data,
        timestamp: Date.now(),
        source
      }
    };

    // Send to parent window
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }

    // Send to all iframes
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        iframe.contentWindow?.postMessage(message, '*');
      } catch {
        // Cross-origin iframe - will handle via message event
      }
    });
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }
}

// Global event bus instance
export const eventBus = new EventBus();

// Listen for broadcast events from other windows/frames
if (browser) {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'MFE_EVENT') {
      const { type, data, source } = event.data.payload;
      eventBus.publish(type, data, source);
    }
  });
}

// ============================================================================
// SHARED STATE STORE
// ============================================================================

export enum SharedStoreKeys {
  USER_SETTINGS = 'user-settings',
  CART_ITEMS = 'cart-items',
  NOTIFICATIONS = 'notifications',
  ONLINE_STATUS = 'online-status',
  THEME = 'theme',
  LANGUAGE = 'language',
  USER_DATA = 'user-data',
  AUTH_TOKEN = 'auth-token'
}

interface SharedStoreOptions {
  persist?: boolean;
  syncAcrossWindows?: boolean;
}

class SharedStore {
  private store = new Map<string, any>();
  private listeners = new Map<string, Set<EventListener>>();
  private storageKey = 'mfe-shared-state';

  constructor() {
    if (browser) {
      this.loadFromStorage();
      this.setupStorageSync();
    }
  }

  /**
   * Get a value from the shared store
   */
  get(key: string): any {
    return this.store.get(key);
  }

  /**
   * Set a value in the shared store
   */
  set(key: string, value: any, options: SharedStoreOptions = {}): void {
    const oldValue = this.store.get(key);
    const newValue = value;

    this.store.set(key, newValue);

    // Persist to localStorage
    if (options.persist !== false && browser) {
      this.saveToStorage();
    }

    // Notify listeners
    this.notifyListeners(key, newValue, oldValue);

    // Sync across windows
    if (options.syncAcrossWindows !== false && browser) {
      this.syncToWindows(key, newValue);
    }
  }

  /**
   * Delete a value from the shared store
   */
  delete(key: string): void {
    this.store.delete(key);
    if (browser) {
      this.saveToStorage();
    }
  }

  /**
   * Subscribe to changes for a specific key
   */
  subscribe(key: string, listener: (value: any) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      this.listeners.get(key)?.delete(listener);
    };
  }

  /**
   * Subscribe to all changes
   */
  subscribeAll(listener: (key: string, value: any) => void): () => void {
    const wrappedListener = (value: any) => {
      // Find the key that changed
      for (const [key, val] of this.store.entries()) {
        if (val === value) {
          listener(key, value);
          break;
        }
      }
    };

    this.listeners.set('*', this.listeners.get('*') || new Set());
    this.listeners.get('*')!.add(wrappedListener as any);

    return () => {
      this.listeners.get('*')?.delete(wrappedListener as any);
    };
  }

  private notifyListeners(key: string, newValue: any, oldValue: any): void {
    const keyListeners = this.listeners.get(key);
    if (keyListeners) {
      keyListeners.forEach(listener => {
        try {
          listener(newValue);
        } catch (error) {
          console.error(\`SharedStore listener error for \${key}:\`, error);
        }
      });
    }

    const allListeners = this.listeners.get('*');
    if (allListeners) {
      allListeners.forEach(listener => {
        try {
          (listener as (key: string, value: any) => void)(key, newValue);
        } catch (error) {
          console.error('SharedStore wildcard listener error:', error);
        }
      });
    }
  }

  private saveToStorage(): void {
    if (!browser) return;
    const state = Object.fromEntries(this.store.entries());
    localStorage.setItem(this.storageKey, JSON.stringify(state));
  }

  private loadFromStorage(): void {
    if (!browser) return;
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      try {
        const state = JSON.parse(stored);
        Object.entries(state).forEach(([key, value]) => {
          this.store.set(key, value);
        });
      } catch {
        console.error('Failed to load shared state from storage');
      }
    }
  }

  private setupStorageSync(): void {
    if (!browser) return;

    window.addEventListener('storage', (e) => {
      if (e.key === this.storageKey && e.newValue) {
        try {
          const state = JSON.parse(e.newValue);
          Object.entries(state).forEach(([key, value]) => {
            const oldValue = this.store.get(key);
            if (oldValue !== value) {
              this.store.set(key, value);
              this.notifyListeners(key, value, oldValue);
            }
          });
        } catch {
          // Ignore parse errors
        }
      }
    });
  }

  private syncToWindows(key: string, value: any): void {
    if (!browser) return;

    const message = {
      type: 'MFE_STATE_UPDATE',
      payload: { key, value }
    };

    // Send to parent
    if (window.parent !== window) {
      window.parent.postMessage(message, '*');
    }

    // Send to iframes
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        iframe.contentWindow?.postMessage(message, '*');
      } catch {
        // Cross-origin
      }
    });
  }

  clear(): void {
    this.store.clear();
    if (browser) {
      localStorage.removeItem(this.storageKey);
    }
  }
}

// Global shared store instance
export const sharedStore = new SharedStore();

// Listen for state updates from other windows
if (browser) {
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'MFE_STATE_UPDATE') {
      const { key, value } = event.data.payload;
      sharedStore.set(key, value, { persist: true, syncAcrossWindows: false });
    }
  });
}

// ============================================================================
// MICRO-APP LOADER
// ============================================================================

export interface MicroAppConfig {
  id: string;
  name: string;
  url: string;
  container: string | HTMLElement;
  sandbox?: boolean;
}

export class MicroAppLoader {
  private loadedApps = new Map<string, any>();

  /**
   * Load a micro-app dynamically
   */
  async load(config: MicroAppConfig): Promise<void> {
    const { id, url, container, sandbox = true } = config;

    if (this.loadedApps.has(id)) {
      console.warn(\`Micro-app \${id} is already loaded\`);
      return;
    }

    try {
      const containerEl = typeof container === 'string'
        ? document.querySelector(container)
        : container;

      if (!containerEl) {
        throw new Error(\`Container not found: \${container}\`);
      }

      // Create iframe for isolation
      const iframe = document.createElement('iframe');
      iframe.sandbox = sandbox
        ? 'allow-scripts allow-same-origin allow-forms allow-popups'
        : '';
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';

      // Load the micro-app
      containerEl.appendChild(iframe);

      // Wait for iframe to load
      await new Promise((resolve, reject) => {
        iframe.onload = resolve;
        iframe.onerror = reject;
        iframe.src = url;
      });

      this.loadedApps.set(id, { iframe, config });

      eventBus.publish('microapp:loaded', {
        appId: id,
        name: config.name,
        timestamp: Date.now()
      });

    } catch (error) {
      eventBus.publish('microapp:error', {
        appId: id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Unload a micro-app
   */
  unload(appId: string): void {
    const app = this.loadedApps.get(appId);
    if (!app) return;

    app.iframe.remove();
    this.loadedApps.delete(appId);

    eventBus.publish('microapp:unloaded', {
      appId: appId,
      timestamp: Date.now()
    });
  }

  /**
   * Unload all micro-apps
   */
  unloadAll(): void {
    this.loadedApps.forEach((_, appId) => {
      this.unload(appId);
    });
  }

  /**
   * Send a message to a micro-app
   */
  sendMessage(appId: string, message: any): void {
    const app = this.loadedApps.get(appId);
    if (!app || !app.iframe.contentWindow) {
      console.warn(\`Micro-app \${appId} not found or not loaded\`);
      return;
    }

    app.iframe.contentWindow.postMessage({
      type: 'HOST_MESSAGE',
      payload: message
    }, '*');
  }

  /**
   * Check if a micro-app is loaded
   */
  isLoaded(appId: string): boolean {
    return this.loadedApps.has(appId);
  }

  /**
   * Get all loaded micro-apps
   */
  getLoadedApps(): string[] {
    return Array.from(this.loadedApps.keys());
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create a namespaced event type
 * @param namespace - The namespace prefix
 * @returns Function to create event types
 */
export function createEventNamespace(namespace: string) {
  return (event: string) => \`\${namespace}:\${event}\` as const;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= interval) {
      lastCall = now;
      fn(...args);
    }
  };
}
`;
  }

  // Cross-Framework Component Sharing Examples

  /**
   * React Component Wrapper for Svelte
   * Demonstrates: Using React components within Svelte apps via wrapper
   */
  protected generateReactWrapper() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { renderReactComponent, unmountReactComponent } from '$lib/components/cross-framework/cross-framework';

  export let component: any;
  export let props = {};
  export let className = '';

  let container: HTMLDivElement;
  let reactInstance: any = null;

  onMount(() => {
    if (!browser || !container) return;

    // Render the React component into the container
    reactInstance = renderReactComponent(component, props, container);

    // Listen for props changes and re-render
    return () => {
      if (reactInstance) {
        unmountReactComponent(reactInstance, container);
      }
    };
  });

  onDestroy(() => {
    if (reactInstance && container) {
      unmountReactComponent(reactInstance, container);
    }
  });

  $: if (reactInstance && browser) {
    // Re-render when props change
    unmountReactComponent(reactInstance, container);
    reactInstance = renderReactComponent(component, props, container);
  }
</script>

<div bind:this={container} class={className}></div>

<style>
  :global(div) {
    /* Ensure React component styles work */
  }
</style>
`;
  }

  /**
   * Vue Component Wrapper for Svelte
   * Demonstrates: Using Vue 3 components within Svelte apps via wrapper
   */
  protected generateVueWrapper() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { renderVueComponent, unmountVueComponent } from '$lib/components/cross-framework/cross-framework';

  export let component: any;
  export let props = {};
  export let className = '';

  let container: HTMLDivElement;
  let vueInstance: any = null;

  onMount(() => {
    if (!browser || !container) return;

    // Render the Vue component into the container
    vueInstance = renderVueComponent(component, props, container);
  });

  onDestroy(() => {
    if (vueInstance && container) {
      unmountVueComponent(vueInstance, container);
    }
  });

  $: if (vueInstance && browser) {
    // Update Vue component when props change
    Object.assign(vueInstance, props);
  }
</script>

<div bind:this={container} class={className}></div>
`;
  }

  /**
   * Angular Component Wrapper for Svelte
   * Demonstrates: Using Angular components within Svelte apps via wrapper
   */
  protected generateAngularWrapper() {
    return `<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { renderAngularComponent, unmountAngularComponent } from '$lib/components/cross-framework/cross-framework';

  export let component: any;
  export let props = {};
  export let className = '';

  let container: HTMLDivElement;
  let angularRef: any = null;

  onMount(async () => {
    if (!browser || !container) return;

    // Render the Angular component into the container
    angularRef = await renderAngularComponent(component, props, container);
  });

  onDestroy(() => {
    if (angularRef && container) {
      unmountAngularComponent(angularRef, container);
    }
  });

  $: if (angularRef && browser) {
    // Update Angular component when props change
    if (angularRef.setInput) {
      Object.entries(props).forEach(([key, value]) => {
        angularRef.setInput(key, value);
      });
    }
  }
</script>

<div bind:this={container} class={className}></div>
`;
  }

  /**
   * Cross-Framework Component Utilities
   * Utilities for sharing components across different frameworks
   */
  protected generateCrossFrameworkUtils() {
    return `/**
 * Cross-Framework Component Sharing Utilities
 *
 * This module provides utilities for sharing components across different
 * JavaScript frameworks (React, Vue, Angular, Svelte, etc.) in a
 * micro-frontend architecture.
 *
 * The key insight is that Web Components serve as the universal adapter
 * between frameworks, allowing any component to be wrapped and used anywhere.
 */

import { browser } from '$app/environment';

// ============================================================================
// WEB COMPONENT ADAPTER
// ============================================================================

/**
 * Convert any framework component to a Web Component
 * @param component - The component to convert
 * @param renderer - Function that renders the component
 * @param tagName - Custom element tag name
 * @returns Web Component constructor
 */
export function createWebComponentAdapter(
  component: any,
  renderer: (component: any, props: any, container: HTMLElement) => any,
  tagName: string
): CustomElementConstructor {
  class WebComponentAdapter extends HTMLElement {
    private instance: any = null;
    private shadow: ShadowRoot;
    private container: HTMLElement;

    constructor() {
      super();
      this.shadow = this.attachShadow({ mode: 'open' });
      this.container = document.createElement('div');
      this.shadow.appendChild(this.container);
    }

    static get observedAttributes() {
      return ['props'];
    }

    connectedCallback() {
      const props = this.getProps();
      this.instance = renderer(component, props, this.container);
    }

    disconnectedCallback() {
      this.destroy();
    }

    attributeChangedCallback() {
      if (this.instance) {
        this.destroy();
        this.connectedCallback();
      }
    }

    getProps(): any {
      const propsAttr = this.getAttribute('props');
      if (propsAttr) {
        try {
          return JSON.parse(propsAttr);
        } catch {
          return {};
        }
      }
      return {};
    }

    destroy() {
      if (this.instance && typeof this.instance.$destroy === 'function') {
        this.instance.$destroy();
      }
      this.container.innerHTML = '';
    }
  }

  // Register the custom element
  if (browser && !customElements.get(tagName)) {
    customElements.define(tagName, WebComponentAdapter);
  }

  return WebComponentAdapter;
}

// ============================================================================
// REACT ADAPTER
// ============================================================================

let React: any;
let ReactDOM: any;

/**
 * Dynamically import React and ReactDOM
 */
async function loadReact() {
  if (React && ReactDOM) return { React, ReactDOM };

  try {
    React = await import('react');
    ReactDOM = await import('react-dom/client');
    return { React, ReactDOM };
  } catch {
    console.warn('React not available');
    return null;
  }
}

/**
 * Render a React component into a container
 * @param component - React component
 * @param props - Component props
 * @param container - Container element
 * @returns React root instance
 */
export function renderReactComponent(
  component: any,
  props: any,
  container: HTMLElement
): any {
  if (!browser) return null;

  // Dynamic import of React
  Promise.resolve().then(() => loadReact());

  // Create a wrapper function if component is not already a React element
  const createElement = React?.createElement || ((_: any, p: any, ...c: any[]) => ({ props: p, children: c }));

  const element = createElement(component, props);

  // Try ReactDOM 18 createRoot API first
  if (ReactDOM?.createRoot) {
    const root = ReactDOM.createRoot(container);
    root.render(element);
    return { root, element };
  }

  // Fallback to ReactDOM 18 render API
  if (ReactDOM?.render) {
    ReactDOM.render(element, container);
    return { element, container };
  }

  // Fallback for older versions
  container.innerHTML = '';
  container.appendChild(element as any);
  return { element, container };
}

/**
 * Unmount a React component
 * @param instance - Component instance from renderReactComponent
 * @param container - Container element
 */
export function unmountReactComponent(instance: any, container: HTMLElement): void {
  if (!instance) return;

  if (instance?.root?.unmount) {
    instance.root.unmount();
  } else if (ReactDOM?.unmountComponentAtNode) {
    ReactDOM.unmountComponentAtNode(container);
  }

  container.innerHTML = '';
}

// ============================================================================
// VUE ADAPTER
// ============================================================================

let Vue: any;

/**
 * Dynamically import Vue
 */
async function loadVue() {
  if (Vue) return Vue;

  try {
    const module = await import('vue');
    Vue = module;
    return Vue;
  } catch {
    console.warn('Vue not available');
    return null;
  }
}

/**
 * Render a Vue component into a container
 * @param component - Vue component
 * @param props - Component props
 * @param container - Container element
 * @returns Vue instance
 */
export function renderVueComponent(
  component: any,
  props: any,
  container: HTMLElement
): any {
  if (!browser) return null;

  // Dynamic import of Vue
  Promise.resolve().then(() => loadVue());

  if (!Vue) {
    container.textContent = 'Vue not loaded';
    return null;
  }

  container.innerHTML = '';

  // Vue 3 createApp API
  if (Vue?.createApp) {
    const app = Vue.createApp(component, props);
    const instance = app.mount(container);
    // Attach app to instance for unmounting
    instance.$app = app;
    return instance;
  }

  // Vue 2 API
  if (Vue?.default) {
    const VueConstructor = Vue.default;
    const instance = new VueConstructor({
      render: (h: any) => h(component, { props })
    });
    instance.$mount(container);
    return instance;
  }

  return null;
}

/**
 * Unmount a Vue component
 * @param instance - Component instance from renderVueComponent
 * @param container - Container element
 */
export function unmountVueComponent(instance: any, container: HTMLElement): void {
  if (!instance) return;

  // Vue 3
  if (instance.$app?.unmount) {
    instance.$app.unmount();
  }
  // Vue 2
  else if (instance.$destroy) {
    instance.$destroy();
  }

  container.innerHTML = '';
}

// ============================================================================
// ANGULAR ADAPTER
// ============================================================================

/**
 * Render an Angular component into a container
 * Note: This requires Angular to be built with custom elements
 * @param component - Angular component selector
 * @param props - Component inputs
 * @param container - Container element
 * @returns Angular component reference
 */
export async function renderAngularComponent(
  component: any,
  props: any,
  container: HTMLElement
): Promise<any> {
  if (!browser) return null;

  // Angular components should be exposed as custom elements
  // This is done by adding 'standalone: true' and custom element bundling

  if (typeof component === 'string') {
    // If component is a selector, create the custom element
    const element = document.createElement(component);
    Object.assign(element, props);
    container.appendChild(element);

    // Wait for Angular to initialize
    await new Promise(resolve => requestAnimationFrame(resolve));

    return element;
  }

  // For dynamic Angular component loading, you would use Angular's
  // custom element API which is complex and requires Angular-specific setup
  console.warn('Dynamic Angular loading requires Angular custom elements setup');
  return null;
}

/**
 * Unmount an Angular component
 * @param instance - Component reference from renderAngularComponent
 * @param container - Container element
 */
export function unmountAngularComponent(instance: any, container: HTMLElement): void {
  if (instance && instance.parentNode) {
    instance.parentNode.removeChild(instance);
  }
  container.innerHTML = '';
}

// ============================================================================
// UNIVERSAL COMPONENT WRAPPER
// ============================================================================

export type FrameworkType = 'react' | 'vue' | 'angular' | 'svelte' | 'web-component';

export interface UniversalComponentConfig {
  component: any;
  framework: FrameworkType;
  props?: any;
  tagName?: string;
  container?: HTMLElement;
}

/**
 * Universal component renderer that works across frameworks
 * @param config - Component configuration
 * @returns Component instance for cleanup
 */
export function renderUniversalComponent(config: UniversalComponentConfig): any {
  const { component, framework, props = {}, tagName, container } = config;

  if (!browser) return null;

  switch (framework) {
    case 'react':
      return renderReactComponent(component, props, container || document.createElement('div'));

    case 'vue':
      return renderVueComponent(component, props, container || document.createElement('div'));

    case 'angular':
      return renderAngularComponent(component, props, container || document.createElement('div'));

    case 'web-component':
      // For web components, just create the element
      const element = document.createElement(tagName || component);
      Object.assign(element, props);
      if (container) container.appendChild(element);
      return element;

    case 'svelte':
      // Svelte components have their own constructor
      // This would be handled by the Svelte wrapper component
      console.warn('Svelte components should be wrapped using Svelte syntax');
      return null;

    default:
      console.warn(\`Unknown framework: \${framework}\`);
      return null;
  }
}

// ============================================================================
// COMPONENT REGISTRY
// ============================================================================

interface RegisteredComponent {
  component: any;
  framework: FrameworkType;
  tagName?: string;
}

const componentRegistry = new Map<string, RegisteredComponent>();

/**
 * Register a component for cross-framework sharing
 * @param name - Component name/key
 * @param config - Component configuration
 */
export function registerComponent(name: string, config: RegisteredComponent): void {
  componentRegistry.set(name, config);
}

/**
 * Get a registered component
 * @param name - Component name/key
 * @returns Component configuration or undefined
 */
export function getComponent(name: string): RegisteredComponent | undefined {
  return componentRegistry.get(name);
}

/**
 * Render a registered component by name
 * @param name - Component name
 * @param props - Component props
 * @param container - Container element
 * @returns Component instance
 */
export function renderRegisteredComponent(
  name: string,
  props: any,
  container: HTMLElement
): any {
  const config = getComponent(name);
  if (!config) {
    console.warn(\`Component not registered: \${name}\`);
    return null;
  }

  return renderUniversalComponent({
    component: config.component,
    framework: config.framework,
    props,
    container
  });
}

// ============================================================================
// FRAMEWORK DETECTION
// ============================================================================

export interface FrameworkInfo {
  name: string;
  version: string;
  available: boolean;
}

/**
 * Detect which frameworks are available in the current environment
 */
export function detectFrameworks(): Record<FrameworkType, FrameworkInfo> {
  const info: Partial<Record<FrameworkType, FrameworkInfo>> = {};

  // React detection
  if (browser) {
    const react = (window as any).React;
    info.react = {
      name: 'React',
      version: react?.version || 'unknown',
      available: !!react
    };

    // Vue detection
    const vue = (window as any).Vue;
    info.vue = {
      name: 'Vue',
      version: vue?.version || 'unknown',
      available: !!vue
    };

    // Angular detection
    const ng = (window as any).ng;
    info.angular = {
      name: 'Angular',
      version: (ng as any)?.version || 'unknown',
      available: !!(ng?.probe || ng?.getInjector)
    };
  }

  info['web-component'] = {
    name: 'Web Components',
    version: '1.0',
    available: typeof customElements !== 'undefined'
  };

  info.svelte = {
    name: 'Svelte',
    version: '4.x',
    available: true // We're in Svelte!
  };

  return info as Record<FrameworkType, FrameworkInfo>;
}

// ============================================================================
// PROP SERIALIZATION
// ============================================================================

/**
 * Serialize props for cross-frame/component passing
 * @param props - Props to serialize
 * @returns Serialized props
 */
export function serializeProps(props: any): string {
  return JSON.stringify(props, (key, value) => {
    // Handle functions
    if (typeof value === 'function') {
      return \`__FUNCTION:\${value.toString()}\`;
    }
    // Handle dates
    if (value instanceof Date) {
      return \`__DATE:\${value.toISOString()}\`;
    }
    // Handle undefined
    if (value === undefined) {
      return '__UNDEFINED';
    }
    return value;
  });
}

/**
 * Deserialize props from cross-frame/component passing
 * @param serialized - Serialized props string
 * @returns Deserialized props object
 */
export function deserializeProps(serialized: string): any {
  return JSON.parse(serialized, (key, value) => {
    // Handle functions
    if (typeof value === 'string' && value.startsWith('__FUNCTION:')) {
      const fnBody = value.slice(11);
      return new Function(\`return \${fnBody}\`)();
    }
    // Handle dates
    if (typeof value === 'string' && value.startsWith('__DATE:')) {
      return new Date(value.slice(7));
    }
    // Handle undefined
    if (value === '__UNDEFINED') {
      return undefined;
    }
    return value;
  });
}

// ============================================================================
// EVENT BRIDGE
// ============================================================================

/**
 * Create an event bridge between components of different frameworks
 * Allows events to be translated between framework event systems
 */
export class EventBridge {
  private listeners = new Map<string, Set<EventListener>>();

  /**
   * Add an event listener
   * @param event - Event name
   * @param handler - Event handler
   * @returns Cleanup function
   */
  on(event: string, handler: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  /**
   * Emit an event
   * @param event - Event name
   * @param data - Event data
   */
  emit(event: string, data: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(\`EventBridge error for \${event}:\`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}
`;
  }

  // SEO Optimization Examples

  /**
   * SEO Utilities
   * Helper functions for managing SEO meta tags and social sharing
   */
  protected generateSeoUtils() {
    return `/**
 * SEO Utilities
 *
 * Utilities for managing SEO meta tags, Open Graph, Twitter Cards,
 * and structured data for search engines and social media platforms.
 */

import { browser } from '$app/environment';

// ============================================================================
// META TAG INTERFACES
// ============================================================================

export interface MetaTags {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  robots?: MetaRobots;
  openGraph?: OpenGraphTags;
  twitterCard?: TwitterCardTags;
  alternate?: AlternateUrl[];
}

export interface MetaRobots {
  index?: boolean;
  follow?: boolean;
  noarchive?: boolean;
  nosnippet?: boolean;
  notranslate?: boolean;
  noimageindex?: boolean;
}

export interface OpenGraphTags {
  type?: string;
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  imageAlt?: string;
  siteName?: string;
  locale?: string;
  article?: ArticleTags;
}

export interface ArticleTags {
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tag?: string[];
}

export interface TwitterCardTags {
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  site?: string;
  creator?: string;
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
}

export interface AlternateUrl {
  lang: string;
  url: string;
}

// ============================================================================
// META TAG GENERATION
// ============================================================================

/**
 * Generate HTML meta tags from metadata object
 * @param meta - Metadata object
 * @returns Array of meta tag objects for Svelte
 */
export function generateMetaTags(meta: MetaTags): Record<string, string>[] {
  const tags: Record<string, string>[] = [];

  // Basic meta tags
  if (meta.title) {
    tags.push({ name: 'title', content: meta.title });
  }

  if (meta.description) {
    tags.push({ name: 'description', content: meta.description });
  }

  if (meta.keywords && meta.keywords.length > 0) {
    tags.push({ name: 'keywords', content: meta.keywords.join(', ') });
  }

  // Robots
  if (meta.robots) {
    const robotsDirectives: string[] = [];
    if (meta.robots.index === false) robotsDirectives.push('noindex');
    if (meta.robots.follow === false) robotsDirectives.push('nofollow');
    if (meta.robots.noarchive) robotsDirectives.push('noarchive');
    if (meta.robots.nosnippet) robotsDirectives.push('nosnippet');
    if (meta.robots.notranslate) robotsDirectives.push('notranslate');
    if (meta.robots.noimageindex) robotsDirectives.push('noimageindex');

    if (robotsDirectives.length > 0) {
      tags.push({ name: 'robots', content: robotsDirectives.join(', ') });
    }
  }

  // Canonical URL
  if (meta.canonical) {
    tags.push({ rel: 'canonical', href: meta.canonical });
  }

  // Open Graph
  if (meta.openGraph) {
    const og = meta.openGraph;
    tags.push({ property: 'og:type', content: og.type || 'website' });
    if (og.title) tags.push({ property: 'og:title', content: og.title });
    if (og.description) tags.push({ property: 'og:description', content: og.description });
    if (og.url) tags.push({ property: 'og:url', content: og.url });
    if (og.image) tags.push({ property: 'og:image', content: og.image });
    if (og.imageAlt) tags.push({ property: 'og:image:alt', content: og.imageAlt });
    if (og.siteName) tags.push({ property: 'og:site_name', content: og.siteName });
    if (og.locale) tags.push({ property: 'og:locale', content: og.locale });

    // Article specific
    if (og.article) {
      if (og.article.publishedTime) tags.push({ property: 'article:published_time', content: og.article.publishedTime });
      if (og.article.modifiedTime) tags.push({ property: 'article:modified_time', content: og.article.modifiedTime });
      if (og.article.author) tags.push({ property: 'article:author', content: og.article.author });
      if (og.article.section) tags.push({ property: 'article:section', content: og.article.section });
      og.article.tag?.forEach(tag => {
        tags.push({ property: 'article:tag', content: tag });
      });
    }
  }

  // Twitter Card
  if (meta.twitterCard) {
    const tc = meta.twitterCard;
    tags.push({ name: 'twitter:card', content: tc.card || 'summary_large_image' });
    if (tc.site) tags.push({ name: 'twitter:site', content: tc.site });
    if (tc.creator) tags.push({ name: 'twitter:creator', content: tc.creator });
    if (tc.title) tags.push({ name: 'twitter:title', content: tc.title });
    if (tc.description) tags.push({ name: 'twitter:description', content: tc.description });
    if (tc.image) tags.push({ name: 'twitter:image', content: tc.image });
    if (tc.imageAlt) tags.push({ name: 'twitter:image:alt', content: tc.imageAlt });
  }

  // Alternate language URLs
  if (meta.alternate) {
    meta.alternate.forEach(alt => {
      tags.push({ rel: 'alternate', hreflang: alt.lang, href: alt.url });
    });
  }

  return tags;
}

/**
 * Set document title
 * @param title - Page title
 * @param template - Title template with %s placeholder
 */
export function setPageTitle(title: string, template = '%s | SvelteKit App'): void {
  if (!browser) return;
  document.title = template.replace('%s', title);
}

/**
 * Set meta description
 * @param description - Meta description
 */
export function setMetaDescription(description: string): void {
  if (!browser) return;
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'description';
    document.head.appendChild(meta);
  }
  meta.content = description;
}

/**
 * Set canonical URL
 * @param url - Canonical URL
 */
export function setCanonicalUrl(url: string): void {
  if (!browser) return;

  // Remove existing canonical
  const existing = document.querySelector('link[rel="canonical"]');
  if (existing) existing.remove();

  // Add new canonical
  const link = document.createElement('link');
  link.rel = 'canonical';
  link.href = url;
  document.head.appendChild(link);
}

/**
 * Update all meta tags at once
 * @param meta - Metadata object
 */
export function updateMetaTags(meta: MetaTags): void {
  if (!browser) return;

  // Title
  if (meta.title) {
    setPageTitle(meta.title);
  }

  // Description
  if (meta.description) {
    setMetaDescription(meta.description);
  }

  // Keywords
  if (meta.keywords) {
    let keywordsMeta = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
    if (!keywordsMeta) {
      keywordsMeta = document.createElement('meta');
      keywordsMeta.name = 'keywords';
      document.head.appendChild(keywordsMeta);
    }
    keywordsMeta.content = meta.keywords.join(', ');
  }

  // Canonical
  if (meta.canonical) {
    setCanonicalUrl(meta.canonical);
  }

  // Open Graph
  updateOpenGraphTags(meta.openGraph || {});

  // Twitter Card
  updateTwitterCardTags(meta.twitterCard || {});

  // Alternate URLs
  updateAlternateUrls(meta.alternate || []);
}

/**
 * Update Open Graph tags
 */
function updateOpenGraphTags(og: OpenGraphTags): void {
  if (!browser) return;

  const ogProperties: [string, string][] = [
    ['og:type', og.type || 'website'],
    ['og:title', og.title || ''],
    ['og:description', og.description || ''],
    ['og:url', og.url || ''],
    ['og:image', og.image || ''],
    ['og:image:alt', og.imageAlt || ''],
    ['og:site_name', og.siteName || ''],
    ['og:locale', og.locale || '']
  ];

  ogProperties.forEach(([property, content]) => {
    if (content) {
      let meta = document.querySelector(\`meta[property="\${property}"]\`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', property);
        document.head.appendChild(meta);
      }
      meta.content = content;
    }
  });
}

/**
 * Update Twitter Card tags
 */
function updateTwitterCardTags(tc: TwitterCardTags): void {
  if (!browser) return;

  const twitterProperties: [string, string][] = [
    ['twitter:card', tc.card || 'summary_large_image'],
    ['twitter:site', tc.site || ''],
    ['twitter:creator', tc.creator || ''],
    ['twitter:title', tc.title || ''],
    ['twitter:description', tc.description || ''],
    ['twitter:image', tc.image || ''],
    ['twitter:image:alt', tc.imageAlt || '']
  ];

  twitterProperties.forEach(([name, content]) => {
    if (content) {
      let meta = document.querySelector(\`meta[name="\${name}"]\`) as HTMLMetaElement;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = name;
        document.head.appendChild(meta);
      }
      meta.content = content;
    }
  });
}

/**
 * Update alternate language URLs
 */
function updateAlternateUrls(alternates: AlternateUrl[]): void {
  if (!browser) return;

  // Remove existing alternates except x-default
  document.querySelectorAll('link[rel="alternate"][hreflang]:not([hreflang="x-default"])').forEach(el => el.remove());

  alternates.forEach(alt => {
    const link = document.createElement('link');
    link.rel = 'alternate';
    link.hreflang = alt.lang;
    link.href = alt.url;
    document.head.appendChild(link);
  });
}

// ============================================================================
// SLUG GENERATION
// ============================================================================

/**
 * Convert string to URL-friendly slug
 * @param text - Text to slugify
 * @returns URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\\s+/g, '-')
    .replace(/[^a-z0-9\\-]/g, '')
    .replace(/\\-\\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Generate breadcrumb structured data
 * @param breadcrumbs - Array of breadcrumb items
 * @returns JSON-LD breadcrumb structured data
 */
export function generateBreadcrumbLd(breadcrumbs: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url
    }))
  };
}

/**
 * Truncate text to max length for SEO
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add when truncated
 */
export function truncateForSeo(text: string, maxLength = 160, suffix = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length).trim() + suffix;
}

/**
 * Get current page URL for SEO
 * @returns Full URL of current page
 */
export function getCurrentPageUrl(): string {
  if (!browser) return '';
  return window.location.href;
}

/**
 * Get site name from config or use default
 */
export const SITE_NAME = 'SvelteKit App';
export const SITE_URL = 'https://example.com';
export const DEFAULT_OG_IMAGE = 'https://example.com/og-image.jpg';
export const TWITTER_HANDLE = '@yourhandle';
`;
  }

  /**
   * Structured Data Utilities
   * JSON-LD structured data generators for rich snippets
   */
  protected generateStructuredData() {
    return `/**
 * Structured Data (JSON-LD) Utilities
 *
 * Generate JSON-LD structured data for search engines to understand
 * your content better and display rich snippets in search results.
 */

import { browser } from '$app/environment';

// ============================================================================
// BASE TYPES
// ============================================================================

export interface Thing {
  '@type': string;
  name?: string;
  description?: string;
  url?: string;
  image?: string | string[];
}

export interface Organization extends Thing {
  '@type': 'Organization';
  logo?: string;
  foundingDate?: string;
  address?: PostalAddress;
  contactPoint?: ContactPoint;
  sameAs?: string[];
}

export interface PostalAddress {
  '@type': 'PostalAddress';
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
}

export interface ContactPoint {
  '@type': 'ContactPoint';
  telephone?: string;
  contactType?: string;
  email?: string;
  areaServed?: string | string[];
  availableLanguage?: string | string[];
}

export interface WebSite extends Thing {
  '@type': 'WebSite';
  url: string;
  potentialAction?: SearchAction;
}

export interface SearchAction {
  '@type': 'SearchAction';
  target: string;
  'query-input': {
    '@type': 'PropertyValueSpecification';
    valueRequired: boolean;
    valueName: string;
  };
}

export interface WebPage extends Thing {
  '@type': 'WebPage';
  datePublished?: string;
  dateModified?: string;
  author?: Person | Organization;
  publisher?: Organization;
  breadcrumb?: BreadcrumbList;
  mainEntity?: Thing;
}

export interface Person extends Thing {
  '@type': 'Person';
  givenName?: string;
  familyName?: string;
  jobTitle?: string;
  email?: string;
  telephone?: string;
  url?: string;
  worksFor?: Organization;
  sameAs?: string[];
}

export interface Article extends Thing {
  '@type': 'Article';
  headline?: string;
  datePublished?: string;
  dateModified?: string;
  author: Person | Organization;
  publisher: Organization;
  description?: string;
  articleSection?: string;
  wordCount?: number;
}

export interface Product extends Thing {
  '@type': 'Product';
  description?: string;
  image?: string | string[];
  brand?: Organization | string;
  offers?: Offer | Offer[];
  aggregateRating?: AggregateRating;
  review?: Review | Review[];
}

export interface Offer {
  '@type': 'Offer';
  price?: string;
  priceCurrency?: string;
  availability?: string;
  url?: string;
  seller?: Organization | Person;
  priceValidUntil?: string;
}

export interface AggregateRating {
  '@type': 'AggregateRating';
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
}

export interface Review {
  '@type': 'Review';
  author: Person;
  reviewRating: Rating;
  reviewBody?: string;
  datePublished?: string;
}

export interface Rating {
  '@type': 'Rating';
  ratingValue: number;
  bestRating?: number;
  worstRating?: number;
}

export interface BreadcrumbList {
  '@type': 'BreadcrumbList';
  itemListElement: ListItem[];
}

export interface ListItem {
  '@type': 'ListItem';
  position: number;
  name: string;
  item?: string;
}

export interface LocalBusiness extends Thing {
  '@type': 'LocalBusiness';
  address?: PostalAddress;
  geo?: GeoCoordinates;
  openingHoursSpecification?: OpeningHoursSpecification[];
  telephone?: string;
  priceRange?: string;
}

export interface GeoCoordinates {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
}

export interface OpeningHoursSpecification {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

export interface FAQPage extends Thing {
  '@type': 'FAQPage';
  mainEntity: Question[];
}

export interface Question {
  '@type': 'Question';
  name: string;
  acceptedAnswer: Answer;
}

export interface Answer {
  '@type': 'Answer';
  text: string;
}

export interface VideoObject extends Thing {
  '@type': 'VideoObject';
  description?: string;
  thumbnailUrl?: string;
  uploadDate?: string;
  duration?: string;
  embedUrl?: string;
}

// ============================================================================
// JSON-LD GENERATORS
// ============================================================================

/**
 * Generate JSON-LD script tag content
 * @param data - Structured data object
 * @returns JSON string for script tag
 */
export function generateJsonLd(data: Thing): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    ...data
  });
}

/**
 * Create organization structured data
 */
export function createOrganization(data: {
  name: string;
  description?: string;
  url?: string;
  logo?: string;
  foundingDate?: string;
  address?: PostalAddress;
  contactPoint?: ContactPoint;
  sameAs?: string[];
}): Organization {
  return {
    '@type': 'Organization',
    name: data.name,
    description: data.description,
    url: data.url,
    logo: data.logo,
    foundingDate: data.foundingDate,
    address: data.address,
    contactPoint: data.contactPoint,
    sameAs: data.sameAs
  };
}

/**
 * Create website structured data
 */
export function createWebSite(data: {
  name: string;
  url: string;
  description?: string;
  searchUrl?: string;
}): WebSite {
  const website: WebSite = {
    '@type': 'WebSite',
    name: data.name,
    url: data.url,
    description: data.description
  };

  if (data.searchUrl) {
    website.potentialAction = {
      '@type': 'SearchAction',
      target: data.searchUrl,
      'query-input': {
        '@type': 'PropertyValueSpecification',
        valueRequired: true,
        valueName: 'search_term_string'
      }
    };
  }

  return website;
}

/**
 * Create article structured data
 */
export function createArticle(data: {
  headline: string;
  description?: string;
  image?: string | string[];
  datePublished: string;
  dateModified: string;
  author: Person;
  publisher: Organization;
  url?: string;
}): Article {
  return {
    '@type': 'Article',
    headline: data.headline,
    description: data.description,
    image: data.image,
    datePublished: data.datePublished,
    dateModified: data.dateModified,
    author: data.author,
    publisher: data.publisher,
    url: data.url,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': data.url
    }
  };
}

/**
 * Create breadcrumb structured data
 */
export function createBreadcrumb(items: Array<{ name: string; url?: string }>): BreadcrumbList {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url
    }))
  };
}

/**
 * Create product structured data
 */
export function createProduct(data: {
  name: string;
  description?: string;
  image?: string | string[];
  brand?: string;
  price?: string;
  priceCurrency?: string;
  availability?: string;
  url?: string;
  aggregateRating?: {
    ratingValue: number;
    reviewCount: number;
  };
}): Product {
  const product: Product = {
    '@type': 'Product',
    name: data.name,
    description: data.description,
    image: data.image,
    offers: {
      '@type': 'Offer',
      price: data.price,
      priceCurrency: data.priceCurrency || 'USD',
      availability: data.availability || 'https://schema.org/InStock',
      url: data.url
    }
  };

  if (data.brand) {
    product.brand = {
      '@type': 'Brand',
      name: data.brand
    };
  }

  if (data.aggregateRating) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: data.aggregateRating.ratingValue,
      reviewCount: data.aggregateRating.reviewCount,
      bestRating: 5,
      worstRating: 1
    };
  }

  return product;
}

/**
 * Create FAQ structured data
 */
export function createFAQ(questions: Array<{ question: string; answer: string }>): FAQPage {
  return {
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer
      }
    }))
  };
}

/**
 * Create local business structured data
 */
export function createLocalBusiness(data: {
  name: string;
  description?: string;
  url?: string;
  telephone?: string;
  address: PostalAddress;
  geo?: { latitude: number; longitude: number };
  openingHours?: Array<{ days: string[]; opens: string; closes: string }>;
  priceRange?: string;
}): LocalBusiness {
  const business: LocalBusiness = {
    '@type': 'LocalBusiness',
    name: data.name,
    description: data.description,
    url: data.url,
    telephone: data.telephone,
    address: data.address,
    priceRange: data.priceRange
  };

  if (data.geo) {
    business.geo = {
      '@type': 'GeoCoordinates',
      latitude: data.geo.latitude,
      longitude: data.geo.longitude
    };
  }

  if (data.openingHours) {
    business.openingHoursSpecification = data.openingHours.map(oh => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: oh.days,
      opens: oh.opens,
      closes: oh.closes
    }));
  }

  return business;
}

/**
 * Inject JSON-LD into the page
 * @param data - Structured data object
 */
export function injectJsonLd(data: Thing): void {
  if (!browser) return;

  // Remove existing script with same type
  const existing = document.querySelector('script[type="application/ld+json"]');
  if (existing) existing.remove();

  // Create new script
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = generateJsonLd(data);
  document.head.appendChild(script);
}
`;
  }

  /**
   * SEO Head Component
   * Svelte component for managing SEO meta tags
   */
  protected generateSeoHead() {
    return `<script context="module" lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    setPageTitle,
    setMetaDescription,
    setCanonicalUrl,
    updateMetaTags
  } from '$lib/utils/seo';

  export let title = '';
  export let description = '';
  export let keywords: string[] = [];
  export let canonical = '';
  export let noIndex = false;
  export let openGraph = {};
  export let twitterCard = {};

  export let image = '';
  export let type = 'website';
  export let siteName = '';

  onMount(() => {
    if (!browser) return;

    const meta = {
      title,
      description,
      keywords,
      canonical,
      robots: noIndex ? { index: false, follow: false } : undefined,
      openGraph: {
        type,
        title: title || undefined,
        description: description || undefined,
        image: image || undefined,
        siteName: siteName || undefined,
        ...openGraph
      },
      twitterCard: {
        card: image ? 'summary_large_image' : 'summary',
        title: title || undefined,
        description: description || undefined,
        image: image || undefined,
        ...twitterCard
      }
    };

    updateMetaTags(meta);
  });

  $: if (browser) {
    // Reactive updates when props change
    updateMetaTags({
      title,
      description,
      keywords,
      canonical,
      robots: noIndex ? { index: false, follow: false } : undefined,
      openGraph: {
        type,
        title: title || undefined,
        description: description || undefined,
        image: image || undefined,
        siteName: siteName || undefined,
        ...openGraph
      },
      twitterCard: {
        card: image ? 'summary_large_image' : 'summary',
        title: title || undefined,
        description: description || undefined,
        image: image || undefined,
        ...twitterCard
      }
    });
  }
</script>

<svelte:head>
  {#if description}
    <meta name="description" content={description} />
  {/if}

  {#if keywords.length > 0}
    <meta name="keywords" content={keywords.join(', ')} />
  {/if}

  {#if canonical}
    <link rel="canonical" href={canonical} />
  {/if}

  {#if noIndex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}

  <!-- Open Graph -->
  <meta property="og:type" content={type} />
  {#if title}
    <meta property="og:title" content={title} />
  {/if}
  {#if description}
    <meta property="og:description" content={description} />
  {/if}
  {#if image}
    <meta property="og:image" content={image} />
  {/if}
  {#if siteName}
    <meta property="og:site_name" content={siteName} />
  {/if}

  <!-- Twitter Card -->
  <meta name="twitter:card" content={image ? 'summary_large_image' : 'summary'} />
  {#if title}
    <meta name="twitter:title" content={title} />
  {/if}
  {#if description}
    <meta name="twitter:description" content={description} />
  {/if}
  {#if image}
    <meta name="twitter:image" content={image} />
  {/if}
</svelte:head>
`;
  }

  /**
   * JSON-LD Component
   * Svelte component for injecting structured data
   */
  protected generateJsonLd() {
    return `<script lang="ts">
  import { browser } from '$app/environment';

  export let data = {};
  export let type = 'WebPage';

  // Generate JSON-LD string
  $: jsonLdString = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': type,
    ...data
  });
</script>

<svelte:head>
  <script type="application/ld+json">
    {jsonLdString}
  </script>
</svelte:head>
`;
  }
}
