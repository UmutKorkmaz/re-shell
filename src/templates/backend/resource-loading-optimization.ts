// Resource Loading and Code Splitting Strategies
// Intelligent resource loading and code splitting for all frontend frameworks

import { BackendTemplate } from '../types';

export const resourceLoadingOptimizationTemplate: BackendTemplate = {
  id: 'resource-loading-optimization',
  name: 'Resource Loading & Code Splitting',
  displayName: 'Intelligent Resource Loading and Code Splitting Strategies',
  description: 'Advanced resource loading optimization with code splitting, lazy loading, and prefetching strategies for all frontend frameworks',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['performance', 'documentation', 'rest-api'],
  tags: ['code-splitting', 'lazy-loading', 'prefetch', 'performance', 'optimization'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-resource-loading",
  "version": "1.0.0",
  "description": "{{name}} - Resource Loading & Code Splitting",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.0.0",
    "compression": "^1.7.4",
    "axios": "^1.5.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "typescript": "^5.1.6",
    "ts-node": "^10.9.1"
  }
}`,

    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}`,

    'src/index.ts': `// Resource Loading & Code Splitting Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { CodeSplittingManager } from './code-splitting-manager';
import { ResourceLoader } from './resource-loader';
import { FrameworkAdapter } from './framework-adapter';
import { apiRoutes } from './routes/api.routes';
import { strategiesRoutes } from './routes/strategies.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize components
const codeSplittingManager = new CodeSplittingManager();
const resourceLoader = new ResourceLoader();
const frameworkAdapter = new FrameworkAdapter();

// Mount routes
app.use('/api', apiRoutes(codeSplittingManager, resourceLoader, frameworkAdapter));
app.use('/strategies', strategiesRoutes(codeSplittingManager));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`⚡ Resource Loading Optimization Server running on port \${PORT}\`);
  console.log(\`📦 Frameworks: React, Vue, Angular, Svelte\`);
  console.log(\`🎯 Strategies: Code splitting, lazy loading, prefetching\`);
});`,

    'src/code-splitting-manager.ts': `// Code Splitting Manager
// Framework-agnostic code splitting strategies

export interface SplitPoint {
  id: string;
  path: string;
  type: 'route' | 'component' | 'module' | 'library';
  framework: 'react' | 'vue' | 'angular' | 'svelte';
  priority: 'critical' | 'high' | 'medium' | 'low';
  lazy: boolean;
  prefetch: boolean;
  preload: boolean;
  dependencies: string[];
  estimatedSize: number;
}

export interface SplittingStrategy {
  framework: string;
  routeBasedSplitting: boolean;
  componentBasedSplitting: boolean;
  vendorSplitting: boolean;
  cssCodeSplitting: boolean;
  granularity: 'route' | 'component' | 'module';
}

export class CodeSplittingManager {
  private splitPoints: Map<string, SplitPoint> = new Map();
  private strategies: Map<string, SplittingStrategy> = new Map();

  constructor() {
    this.setupDefaultStrategies();
  }

  private setupDefaultStrategies(): void {
    // React strategy
    this.strategies.set('react', {
      framework: 'react',
      routeBasedSplitting: true,
      componentBasedSplitting: true,
      vendorSplitting: true,
      cssCodeSplitting: true,
      granularity: 'route',
    });

    // Vue strategy
    this.strategies.set('vue', {
      framework: 'vue',
      routeBasedSplitting: true,
      componentBasedSplitting: true,
      vendorSplitting: true,
      cssCodeSplitting: true,
      granularity: 'route',
    });

    // Angular strategy
    this.strategies.set('angular', {
      framework: 'angular',
      routeBasedSplitting: true,
      componentBasedSplitting: false,
      vendorSplitting: true,
      cssCodeSplitting: true,
      granularity: 'route',
    });

    // Svelte strategy
    this.strategies.set('svelte', {
      framework: 'svelte',
      routeBasedSplitting: true,
      componentBasedSplitting: true,
      vendorSplitting: true,
      cssCodeSplitting: true,
      granularity: 'component',
    });
  }

  addSplitPoint(point: SplitPoint): void {
    this.splitPoints.set(point.id, point);
  }

  getSplitPoints(framework?: string): SplitPoint[] {
    let points = Array.from(this.splitPoints.values());

    if (framework) {
      points = points.filter((p) => p.framework === framework);
    }

    return points.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  generateReactCode(splitPoint: SplitPoint): string {
    const { path, type, lazy } = splitPoint;

    if (type === 'route' && lazy) {
      return \`
// Dynamic import for route \${path}
import { lazy } from 'react';

const \${this.slugify(path)} = lazy(() => import('./\${path}'));
\`;
    }

    if (type === 'component' && lazy) {
      return \`
// Lazy component \${path}
import { lazy, Suspense } from 'react';

const \${this.slugify(path)} = lazy(() => import('./\${path}'));

// Usage with Suspense
<Suspense fallback={<div>Loading...</div>}>
  <\${this.slugify(path)} />
</Suspense>
\`;
    }

    return \`// Regular import for \${path}\\nimport { \${this.slugify(path)} } from './\${path}';\`;
  }

  generateVueCode(splitPoint: SplitPoint): string {
    const { path, type, lazy } = splitPoint;

    if (type === 'route' && lazy) {
      return \`
// Dynamic route component for \${path}
const \${this.slugify(path)} = () => import('./\${path}.vue');

// Router configuration
{
  path: '/\${path}',
  component: \${this.slugify(path)}
}
\`;
    }

    if (type === 'component' && lazy) {
      return \`
// Async component \${path}
import { defineAsyncComponent } from 'vue';

const \${this.slugify(path)} = defineAsyncComponent(() =>
  import('./\${path}.vue')
);
\`;
    }

    return \`// Regular import for \${path}\\nimport \${this.slugify(path)} from './\${path}.vue';\`;
  }

  generateAngularCode(splitPoint: SplitPoint): string {
    const { path, lazy } = splitPoint;

    if (lazy) {
      return \`
// Lazy loaded module for \${path}
const \${this.slugify(path)} = () => import('./\${path}').then(m => m.\${this.capitalize(this.slugify(path))}Module);

// Routing configuration
{
  path: '\${path}',
  loadChildren: \${this.slugify(path)}
}
\`;
    }

    return \`// Regular import for \${path}\\nimport { \${this.capitalize(this.slugify(path))}Module } from './\${path}';\`;
  }

  generateSvelteCode(splitPoint: SplitPoint): string {
    const { path, lazy } = splitPoint;

    if (lazy) {
      return \`
// Dynamic import for \${path}
const \${this.slugify(path)} = () => import('./\${path}.svelte');
\`;
    }

    return \`// Regular import for \${path}\\nimport \${this.slugify(path)} from './\${path}.svelte';\`;
  }

  private slugify(path: string): string {
    return path
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getStrategy(framework: string): SplittingStrategy | undefined {
    return this.strategies.get(framework);
  }

  setStrategy(strategy: SplittingStrategy): void {
    this.strategies.set(strategy.framework, strategy);
  }

  getAllStrategies(): SplittingStrategy[] {
    return Array.from(this.strategies.values());
  }

  analyzeBundle(bundlePath: string): {
    recommendations: string[];
    splitPoints: SplitPoint[];
  } {
    const recommendations: string[] = [];
    const splitPoints: SplitPoint[] = [];

    // Analyze bundle and generate recommendations
    // This is a simplified version - real implementation would parse bundle stats

    recommendations.push('Consider route-based code splitting for better initial load');
    recommendations.push('Extract vendor dependencies into separate chunks');
    recommendations.push('Use lazy loading for below-the-fold components');
    recommendations.push('Implement dynamic imports for heavy libraries');

    return { recommendations, splitPoints };
  }

  clear(): void {
    this.splitPoints.clear();
  }
}`,

    'src/resource-loader.ts': `// Resource Loader
// Intelligent resource loading strategies

export interface ResourceConfig {
  url: string;
  type: 'script' | 'style' | 'font' | 'image' | 'media';
  priority: 'critical' | 'high' | 'medium' | 'low';
  loading: 'eager' | 'lazy' | 'preload' | 'prefetch';
  async: boolean;
  defer: boolean;
  crossOrigin?: 'anonymous' | 'use-credentials';
  integrity?: string;
}

export class ResourceLoader {
  private resources: Map<string, ResourceConfig> = new Map();

  addResource(config: ResourceConfig): void {
    this.resources.set(config.url, config);
  }

  generateResourceTag(config: ResourceConfig, framework: string): string {
    switch (config.type) {
      case 'script':
        return this.generateScriptTag(config);
      case 'style':
        return this.generateStyleTag(config);
      case 'font':
        return this.generateFontTag(config);
      case 'image':
        return this.generateImageTag(config);
      default:
        return '';
    }
  }

  private generateScriptTag(config: ResourceConfig): string {
    const attributes: string[] = [];

    if (config.async) attributes.push('async');
    if (config.defer) attributes.push('defer');
    if (config.crossOrigin) attributes.push(\`crossorigin="\${config.crossOrigin}"\`);
    if (config.integrity) attributes.push(\`integrity="\${config.integrity}"\`);

    if (config.loading === 'preload') {
      return \`<link rel="preload" href="\${config.url}" as="script" \${attributes.join(' ')}>\`;
    }

    if (config.loading === 'prefetch') {
      return \`<link rel="prefetch" href="\${config.url}" as="script">\`;
    }

    return \`<script src="\${config.url}" \${attributes.join(' ')}></script>\`;
  }

  private generateStyleTag(config: ResourceConfig): string {
    if (config.loading === 'preload') {
      return \`<link rel="preload" href="\${config.url}" as="style" onload="this.onload=null;this.rel='stylesheet'">\`;
    }

    if (config.loading === 'prefetch') {
      return \`<link rel="prefetch" href="\${config.url}" as="style">\`;
    }

    return \`<link rel="stylesheet" href="\${config.url}">\`;
  }

  private generateFontTag(config: ResourceConfig): string {
    const attributes: string[] = ['rel="preload"'];

    attributes.push(\`href="\${config.url}"\`);
    attributes.push('as="font"');
    attributes.push('crossorigin="anonymous"');

    if (config.loading === 'prefetch') {
      attributes[0] = 'rel="prefetch"';
    }

    return \`<link \${attributes.join(' ')}>\`;
  }

  private generateImageTag(config: ResourceConfig): string {
    if (config.loading === 'lazy') {
      return \`<img src="\${config.url}" loading="lazy" />\`;
    }

    if (config.loading === 'preload') {
      return \`<link rel="preload" href="\${config.url}" as="image">\`;
    }

    if (config.loading === 'prefetch') {
      return \`<link rel="prefetch" href="\${config.url}" as="image">\`;
    }

    return \`<img src="\${config.url}" />\`;
  }

  generateCriticalCSS(css: string): string {
    // Extract above-the-fold CSS
    // This is a simplified version
    return css.substring(0, Math.min(css.length, 10000));
  }

  generatePreloadHints(resources: ResourceConfig[]): string {
    const hints: string[] = [];

    for (const resource of resources) {
      if (resource.loading === 'preload' || resource.loading === 'prefetch') {
        hints.push(this.generateResourceTag(resource, ''));
      }
    }

    return hints.join('\\n');
  }

  generateResourcePriorityScript(): string {
    return \`
<script>
// Resource priority hints
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

// Connection-aware loading
if (navigator.connection) {
  const connection = navigator.connection;
  if (connection.saveData || connection.effectiveType.includes('2g')) {
    // Load low-quality versions
    document.documentElement.setAttribute('data-saver', 'true');
  }
}
</script>
\`;
  }

  getResources(type?: string): ResourceConfig[] {
    let resources = Array.from(this.resources.values());

    if (type) {
      resources = resources.filter((r) => r.type === type);
    }

    return resources.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  clear(): void {
    this.resources.clear();
  }
}`,

    'src/framework-adapter.ts': `// Framework Adapter
// Framework-specific resource loading and code splitting adapters

export interface FrameworkConfig {
  name: 'react' | 'vue' | 'angular' | 'svelte';
  version: string;
  buildTool: 'vite' | 'webpack' | 'rollup' | 'parcel';
  features: {
    lazyRoutes: boolean;
    lazyComponents: boolean;
    prefetch: boolean;
    preload: boolean;
    suspense: boolean;
  };
}

export class FrameworkAdapter {
  private configs: Map<string, FrameworkConfig> = new Map();

  constructor() {
    this.setupDefaultConfigs();
  }

  private setupDefaultConfigs(): void {
    this.configs.set('react', {
      name: 'react',
      version: '18',
      buildTool: 'vite',
      features: {
        lazyRoutes: true,
        lazyComponents: true,
        prefetch: true,
        preload: true,
        suspense: true,
      },
    });

    this.configs.set('vue', {
      name: 'vue',
      version: '3',
      buildTool: 'vite',
      features: {
        lazyRoutes: true,
        lazyComponents: true,
        prefetch: true,
        preload: true,
        suspense: false,
      },
    });

    this.configs.set('angular', {
      name: 'angular',
      version: '16',
      buildTool: 'webpack',
      features: {
        lazyRoutes: true,
        lazyComponents: false,
        prefetch: true,
        preload: true,
        suspense: false,
      },
    });

    this.configs.set('svelte', {
      name: 'svelte',
      version: '4',
      buildTool: 'vite',
      features: {
        lazyRoutes: true,
        lazyComponents: true,
        prefetch: true,
        preload: true,
        suspense: false,
      },
    });
  }

  generateReactConfig(): string {
    return \`
// React code splitting configuration
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Lazy load routes
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// App component with Suspense
function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

// Vite config for React
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
        },
      },
    },
  },
};
\`;
  }

  generateVueConfig(): string {
    return \`
// Vue code splitting configuration
import { createRouter, createWebHistory } from 'vue-router';

// Lazy load routes
const routes = [
  {
    path: '/',
    component: () => import('./views/Home.vue')
  },
  {
    path: '/about',
    component: () => import('./views/About.vue')
  },
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// Vite config for Vue
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'ui-library': ['element-plus']
        }
      }
    }
  }
};
\`;
  }

  generateAngularConfig(): string {
    return \`
// Angular lazy loading configuration
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./home/home.module').then(m => m.HomeModule)
  },
  {
    path: 'about',
    loadChildren: () => import('./about/about.module').then(m => m.AboutModule)
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
\`;
  }

  generateSvelteConfig(): string {
    return \`
// Svelte code splitting configuration
import Router from 'svelte-spa-router';

// Lazy load pages
const routes = {
  '/: () => import('./pages/Home.svelte'),
  '/about': () => import('./pages/About.svelte'),
  '/dashboard': () => import('./pages/Dashboard.svelte')
};

// App component
export default {
  Router,
  routes
};

// Vite config for Svelte
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'svelte-vendor': ['svelte', 'svelte-spa-router']
        }
      }
    }
  }
};
\`;
  }

  getConfig(framework: string): FrameworkConfig | undefined {
    return this.configs.get(framework);
  }

  setConfig(config: FrameworkConfig): void {
    this.configs.set(config.name, config);
  }

  getAllConfigs(): FrameworkConfig[] {
    return Array.from(this.configs.values());
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { CodeSplittingManager } from '../code-splitting-manager';
import { ResourceLoader } from '../resource-loader';
import { FrameworkAdapter } from '../framework-adapter';

export function apiRoutes(
  codeSplittingManager: CodeSplittingManager,
  resourceLoader: ResourceLoader,
  frameworkAdapter: FrameworkAdapter
): Router {
  const router = Router();

  // Get code splitting strategies
  router.get('/strategies', (req, res) => {
    const strategies = codeSplittingManager.getAllStrategies();
    res.json(strategies);
  });

  // Get framework config
  router.get('/config/:framework', (req, res) => {
    const { framework } = req.params;
    const config = frameworkAdapter.getConfig(framework);

    if (!config) {
      return res.status(404).json({ error: \`Framework \${framework} not found\` });
    }

    res.json(config);
  });

  // Generate framework code
  router.post('/generate/:framework', (req, res) => {
    const { framework } = req.params;
    const { splitPoint } = req.body;

    if (!splitPoint) {
      return res.status(400).json({ error: 'splitPoint is required' });
    }

    let code: string;

    switch (framework) {
      case 'react':
        code = codeSplittingManager.generateReactCode(splitPoint);
        break;
      case 'vue':
        code = codeSplittingManager.generateVueCode(splitPoint);
        break;
      case 'angular':
        code = codeSplittingManager.generateAngularCode(splitPoint);
        break;
      case 'svelte':
        code = codeSplittingManager.generateSvelteCode(splitPoint);
        break;
      default:
        return res.status(400).json({ error: \`Unknown framework: \${framework}\` });
    }

    res.json({ code, framework, splitPoint });
  });

  // Generate full framework config
  router.get('/config/:framework/full', (req, res) => {
    const { framework } = req.params;

    let config: string;

    switch (framework) {
      case 'react':
        config = frameworkAdapter.generateReactConfig();
        break;
      case 'vue':
        config = frameworkAdapter.generateVueConfig();
        break;
      case 'angular':
        config = frameworkAdapter.generateAngularConfig();
        break;
      case 'svelte':
        config = frameworkAdapter.generateSvelteConfig();
        break;
      default:
        return res.status(400).json({ error: \`Unknown framework: \${framework}\` });
    }

    res.json({ config, framework });
  });

  // Add resource
  router.post('/resources', (req, res) => {
    const resource = req.body;
    resourceLoader.addResource(resource);
    res.json({ message: 'Resource added', resource });
  });

  // Get resources
  router.get('/resources', (req, res) => {
    const { type } = req.query;
    const resources = resourceLoader.getResources(type as string);
    res.json(resources);
  });

  // Generate resource tags
  router.post('/resources/tags', (req, res) => {
    const { resources } = req.body;

    if (!Array.isArray(resources)) {
      return res.status(400).json({ error: 'resources must be an array' });
    }

    const tags = resources.map(r => resourceLoader.generateResourceTag(r, ''));
    res.json({ tags });
  });

  // Generate preload hints
  router.post('/resources/preload', (req, res) => {
    const { resources } = req.body;

    if (!Array.isArray(resources)) {
      return res.status(400).json({ error: 'resources must be an array' });
    }

    const hints = resourceLoader.generatePreloadHints(resources);
    res.json({ hints });
  });

  // Analyze bundle
  router.post('/analyze', (req, res) => {
    const { bundlePath } = req.body;

    if (!bundlePath) {
      return res.status(400).json({ error: 'bundlePath is required' });
    }

    const analysis = codeSplittingManager.analyzeBundle(bundlePath);
    res.json(analysis);
  });

  return router;
}`,

    'src/routes/strategies.routes.ts': `// Strategies Routes
import { Router } from 'express';
import { CodeSplittingManager } from '../code-splitting-manager';

export function strategiesRoutes(codeSplittingManager: CodeSplittingManager): Router {
  const router = Router();

  // Get all split points
  router.get('/split-points', (req, res) => {
    const { framework } = req.query;
    const splitPoints = codeSplittingManager.getSplitPoints(framework as string);
    res.json(splitPoints);
  });

  // Add split point
  router.post('/split-points', (req, res) => {
    const splitPoint = req.body;
    codeSplittingManager.addSplitPoint(splitPoint);
    res.json({ message: 'Split point added', splitPoint });
  });

  // Clear split points
  router.delete('/split-points', (req, res) => {
    codeSplittingManager.clear();
    res.json({ message: 'Split points cleared' });
  });

  return router;
}`,

    'README.md': `# Resource Loading & Code Splitting Strategies

Intelligent resource loading and code splitting strategies for React, Vue, Angular, and Svelte applications.

## Features

### ⚡ **Code Splitting**
- **Route-Based Splitting**: Automatic route-level code splitting
- **Component-Based Splitting**: Lazy load individual components
- **Vendor Splitting**: Separate chunks for third-party libraries
- **CSS Code Splitting**: Framework-specific CSS splitting

### 🎯 **Resource Loading**
- **Lazy Loading**: Defer non-critical resources
- **Prefetching**: Proactively fetch likely-needed resources
- **Preloading**: Load critical resources early
- **Priority Management**: Critical, high, medium, low priority

### 🔧 **Framework Support**
- **React**: React.lazy + Suspense, dynamic imports
- **Vue**: Async components, lazy routes
- **Angular**: Lazy loaded modules
- **Svelte**: Dynamic imports for components

## Quick Start

### 1. Get Framework Configuration

**React:**
\`\`\`bash
curl http://localhost:3000/api/config/react/full
\`\`\`

**Vue:**
\`\`\`bash
curl http://localhost:3000/api/config/vue/full
\`\`\`

### 2. Generate Code Splitting Code

\`\`\`bash
curl -X POST http://localhost:3000/api/generate/react \\
  -H "Content-Type: application/json" \\
  -d '{
    "splitPoint": {
      "id": "dashboard",
      "path": "./pages/Dashboard",
      "type": "route",
      "framework": "react",
      "priority": "high",
      "lazy": true,
      "prefetch": true,
      "preload": false
    }
  }'
\`\`\`

Response:
\`\`\`json
{
  "code": "// Dynamic import for route ./pages/Dashboard\\nimport { lazy } from 'react';\\n\\nconst dashboard = lazy(() => import('./pages/Dashboard'));",
  "framework": "react",
  "splitPoint": { ... }
}
\`\`\`

### 3. Add Resource for Optimization

\`\`\`bash
curl -X POST http://localhost:3000/api/resources \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "/assets/main.js",
    "type": "script",
    "priority": "critical",
    "loading": "preload",
    "async": false,
    "defer": true
  }'
\`\`\`

### 4. Generate Resource Tags

\`\`\`bash
curl -X POST http://localhost:3000/api/resources/tags \\
  -H "Content-Type: application/json" \\
  -d '{
    "resources": [
      {
        "url": "https://cdn.example.com/script.js",
        "type": "script",
        "priority": "high",
        "loading": "defer",
        "async": true
      }
    ]
  }'
\`\`\`

### 5. Get Optimization Recommendations

\`\`\`bash
curl -X POST http://localhost:3000/api/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "bundlePath": "./dist/assets/main.js"
  }'
\`\`\`

Response:
\`\`\`json
{
  "recommendations": [
    "Consider route-based code splitting for better initial load",
    "Extract vendor dependencies into separate chunks",
    "Use lazy loading for below-the-fold components"
  ],
  "splitPoints": []
}
\`\`\`

## API Endpoints

### Framework Configuration

#### \`GET /api/config/:framework/full\`
Get complete framework configuration with code splitting setup.

#### \`POST /api/generate/:framework\`
Generate code splitting code for a specific split point.

#### \`GET /api/strategies\`
Get all code splitting strategies.

### Code Splitting

#### \`GET /strategies/split-points?framework=react\`
Get all split points for a framework.

#### \`POST /strategies/split-points\`
Add a new split point.

#### \`DELETE /strategies/split-points\`
Clear all split points.

### Resource Management

#### \`POST /api/resources\`
Add a resource for optimization.

#### \`GET /api/resources?type=script\`
Get resources by type.

#### \`POST /api/resources/tags\`
Generate HTML tags for resources.

#### \`POST /api/resources/preload\`
Generate preload hints for resources.

#### \`POST /api/analyze\`
Analyze bundle and get optimization recommendations.

## Resource Loading Strategies

### Critical Resources
Load immediately and synchronously:
\`\`\`html
<link rel="preload" href="critical.css" as="style">
<script src="critical.js" defer></script>
\`\`\`

### High Priority
Preload for faster access:
\`\`\`html
<link rel="prefetch" href="next-page.js">
\`\`\`

### Low Priority
Lazy load when needed:
\`\`\`html
<img src="image.jpg" loading="lazy">
\`\`\`

## Framework Examples

### React with Vite
\`\`\`javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom']
        }
      }
    }
  }
}
\`\`\`

### Vue with Vite
\`\`\`javascript
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router']
        }
      }
    }
  }
}
\`\`\`

### Angular with CLI
\`\`\`typescript
// angular.json
"build": {
  "optimization": true,
  "vendorChunk": true,
  "extractCss": true,
  "buildOptimizer": true
}
\`\`\`

## Environment Variables

\`\`\`bash
PORT=3000    # Server port
\`\`\`

## Dependencies

- **express** - Web framework
- **cors** - CORS middleware
- **helmet** - Security headers
- **compression** - Response compression
- **axios** - HTTP client

## License

MIT`,
  },
};