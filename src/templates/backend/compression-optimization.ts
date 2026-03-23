// Response Compression, Minification, and Bundling Optimization
// Advanced compression and optimization for all responses

import { BackendTemplate } from '../types';

export const compressionOptimizationTemplate: BackendTemplate = {
  id: 'compression-optimization',
  name: 'Response Compression & Bundling Optimization',
  displayName: 'Advanced Response Compression and Bundling Optimization',
  description: 'Comprehensive response compression with gzip/brotli, CSS/JS/HTML minification, and bundle optimization',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['rest-api', 'performance', 'documentation'],
  tags: ['compression', 'minification', 'optimization', 'performance', 'bundler'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-compression-optimization",
  "version": "1.0.0",
  "description": "{{name}} - Response Compression & Bundling Optimization",
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
    "brotli": "^1.3.3",
    "pako": "^2.1.0",
    "iltorb": "^2.5.1",
    "minify": "^10.5.2",
    "html-minifier-terser": "^7.2.0",
    "clean-css": "^5.3.2",
    "terser": "^5.19.2",
    "@node-minify/core": "^8.0.6",
    "@node-minify/terser": "^8.0.6",
    "@node-minify/clean-css": "^8.0.6",
    "@node-minify/html-minifier": "^8.0.6",
    "mime-types": "^2.1.35",
    "stream": "^0.0.2",
    "zlib": "^1.0.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/cors": "^2.8.13",
    "@types/compression": "^1.7.2",
    "@types/node": "^20.5.0",
    "@types/mime-types": "^2.1.1",
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

    'src/index.ts': `// Response Compression & Bundling Optimization Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { CompressionManager } from './compression-manager';
import { Minifier } from './minifier';
import { BundleOptimizer } from './bundle-optimizer';
import { Precompressor } from './precompressor';
import { apiRoutes } from './routes/api.routes';
import { compressRoutes } from './routes/compress.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize compression components
const compressionManager = new CompressionManager();
const minifier = new Minifier();
const bundleOptimizer = new BundleOptimizer();
const precompressor = new Precompressor();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compressionManager.middleware());
app.use(express.json());

// Mount routes
app.use('/api', apiRoutes(compressionManager, minifier, bundleOptimizer));
app.use('/compress', compressRoutes(compressionManager, minifier, precompressor));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`🗜️ Compression Optimization Server running on port \${PORT}\`);
  console.log(\`📦 Compression: gzip, brotli, deflate\`);
  console.log(\`✨ Minification: CSS, JS, HTML\`);
});`,

    'src/compression-manager.ts': `// Compression Manager
// Multi-algorithm response compression with intelligent selection

import { createBrotliCompress, createGzip, createDeflate, constants } from 'zlib';
import { promisify } from 'util';

const pipeline = promisify(require('stream').pipeline);

export interface CompressionConfig {
  enabled: boolean;
  algorithms: ('gzip' | 'br' | 'deflate')[];
  level: number;
  threshold: number; // bytes
  chunkSize: number;
  windowBits: number;
}

export interface CompressionResult {
  algorithm: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number;
}

export class CompressionManager {
  private config: CompressionConfig;

  constructor() {
    this.config = {
      enabled: true,
      algorithms: ['br', 'gzip', 'deflate'],
      level: 6,
      threshold: 1024, // Only compress responses larger than 1KB
      chunkSize: 16384,
      windowBits: 15,
    };
  }

  middleware(): express.RequestHandler {
    return (req, res, next) => {
      if (!this.config.enabled) {
        return next();
      }

      const acceptEncoding = req.headers['accept-encoding'] || '';
      const originalSend = res.send;
      const originalJson = res.json;
      const chunks: Buffer[] = [];

      // Override res.write
      const originalWrite = res.write;
      (res as any).write = function (chunk: any, ...args: any[]) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      };

      // Override res.send
      res.send = function (body: any) {
        chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
        return this;
      } as any;

      // Override res.json
      res.json = function (body: any) {
        const json = JSON.stringify(body);
        chunks.push(Buffer.from(json));
        res.setHeader('Content-Type', 'application/json');
        return this;
      } as any;

      // Compress on finish
      res.on('finish', async () => {
        if (chunks.length === 0) return;

        const body = Buffer.concat(chunks);

        if (body.length < this.config.threshold) {
          return;
        }

        const algorithm = this.selectAlgorithm(acceptEncoding);
        if (!algorithm) return;

        try {
          const compressed = await this.compress(body, algorithm);
          const result: CompressionResult = {
            algorithm,
            originalSize: body.length,
            compressedSize: compressed.length,
            compressionRatio: ((body.length - compressed.length) / body.length) * 100,
            duration: 0,
          };

          res.setHeader('Content-Encoding', algorithm);
          res.setHeader('X-Compression-Algorithm', algorithm);
          res.setHeader('X-Compression-Ratio', result.compressionRatio.toFixed(2) + '%');
          res.removeHeader('Content-Length');
        } catch (error) {
          console.error('Compression error:', error);
        }
      });

      next();
    };
  }

  private selectAlgorithm(acceptEncoding: string): 'br' | 'gzip' | 'deflate' | null {
    const encodings = acceptEncoding.toLowerCase().split(',').map((e) => e.trim());

    // Check for brotli first (best compression)
    if (encodings.includes('br') || encodings.includes('brotli')) {
      return 'br';
    }

    // Then gzip
    if (encodings.includes('gzip') || encodings.includes('x-gzip')) {
      return 'gzip';
    }

    // Then deflate
    if (encodings.includes('deflate')) {
      return 'deflate';
    }

    return null;
  }

  async compress(buffer: Buffer, algorithm: 'br' | 'gzip' | 'deflate'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      let compressor;

      switch (algorithm) {
        case 'br':
          compressor = createBrotliCompress({
            params: {
              [constants.BROTLI_PARAM_QUALITY]: this.config.level,
            },
          });
          break;
        case 'gzip':
          compressor = createGzip({
            level: this.config.level,
            windowBits: this.config.windowBits,
          });
          break;
        case 'deflate':
          compressor = createDeflate({
            level: this.config.level,
            windowBits: this.config.windowBits,
          });
          break;
        default:
          return reject(new Error(\`Unknown compression algorithm: \${algorithm}\`));
      }

      const chunks: Buffer[] = [];

      compressor.on('data', (chunk) => chunks.push(chunk));
      compressor.on('end', () => resolve(Buffer.concat(chunks)));
      compressor.on('error', reject);

      compressor.write(buffer);
      compressor.end();
    });
  }

  async compressString(text: string, algorithm: 'br' | 'gzip' | 'deflate' = 'br'): Promise<CompressionResult> {
    const buffer = Buffer.from(text);
    const startTime = Date.now();

    const compressed = await this.compress(buffer, algorithm);

    return {
      algorithm,
      originalSize: buffer.length,
      compressedSize: compressed.length,
      compressionRatio: ((buffer.length - compressed.length) / buffer.length) * 100,
      duration: Date.now() - startTime,
    };
  }

  compareAlgorithms(text: string): Promise<CompressionResult[]> {
    const algorithms: ('br' | 'gzip' | 'deflate')[] = ['br', 'gzip', 'deflate'];

    return Promise.all(
      algorithms.map((algo) => this.compressString(text, algo))
    );
  }

  setConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  enable(): void {
    this.config.enabled = true;
  }

  disable(): void {
    this.config.enabled = false;
  }
}`,

    'src/minifier.ts': `// Minifier
// CSS, JavaScript, and HTML minification

import { minify as cssMinify } from 'clean-css';
import { minify as jsMinify, MinifyOptions } from 'terser';
import { minify as htmlMinify, Options as HtmlMinifyOptions } from 'html-minifier-terser';

export interface MinificationResult {
  original: string;
  minified: string;
  originalSize: number;
  minifiedSize: number;
  reduction: number;
  reductionPercent: number;
}

export class Minifier {
  private cssOptions: any;
  private jsOptions: MinifyOptions;
  private htmlOptions: HtmlMinifyOptions;

  constructor() {
    this.cssOptions = {
      level: 2,
      compatibility: '*',
    };

    this.jsOptions = {
      compress: {
        drop_console: true,
        dead_code: true,
        conditionals: true,
        evaluate: true,
        side_effects: true,
      },
      mangle: {
        toplevel: true,
      },
      output: {
        comments: false,
        beautify: false,
      },
    };

    this.htmlOptions = {
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
      minifyCSS: true,
      minifyJS: true,
    };
  }

  minifyCSS(css: string): MinificationResult {
    const startTime = Date.now();
    const result = cssMinify(css, this.cssOptions);

    const originalSize = css.length;
    const minifiedSize = result.styles.length;
    const reduction = originalSize - minifiedSize;
    const reductionPercent = (reduction / originalSize) * 100;

    return {
      original: css,
      minified: result.styles,
      originalSize,
      minifiedSize,
      reduction,
      reductionPercent,
    };
  }

  async minifyJS(js: string): Promise<MinificationResult> {
    const startTime = Date.now();
    const result = await jsMinify(js, this.jsOptions);

    const originalSize = js.length;
    const minifiedSize = result.code?.length || 0;
    const reduction = originalSize - minifiedSize;
    const reductionPercent = (reduction / originalSize) * 100;

    return {
      original: js,
      minified: result.code || '',
      originalSize,
      minifiedSize,
      reduction,
      reductionPercent,
    };
  }

  minifyHTML(html: string): MinificationResult {
    const startTime = Date.now();
    const result = htmlMinify(html, this.htmlOptions);

    const originalSize = html.length;
    const minifiedSize = result.length;
    const reduction = originalSize - minifiedSize;
    const reductionPercent = (reduction / originalSize) * 100;

    return {
      original: html,
      minified: result,
      originalSize,
      minifiedSize,
      reduction,
      reductionPercent,
    };
  }

  async minifyJSON(json: string): Promise<MinificationResult> {
    const startTime = Date.now();
    const parsed = JSON.parse(json);
    const minified = JSON.stringify(parsed);

    const originalSize = json.length;
    const minifiedSize = minified.length;
    const reduction = originalSize - minifiedSize;
    const reductionPercent = (reduction / originalSize) * 100;

    return {
      original: json,
      minified,
      originalSize,
      minifiedSize,
      reduction,
      reductionPercent,
    };
  }

  async minifySVG(svg: string): Promise<MinificationResult> {
    // Basic SVG minification
    const minified = svg
      .replace(/<!--[^>]*-->/g, '') // Remove comments
      .replace(/\\s+/g, ' ') // Collapse whitespace
      .replace(/> </g, '><') // Remove space between tags
      .replace(/\\s*=\\s*/g, '=') // Remove space around equals
      .trim();

    const originalSize = svg.length;
    const minifiedSize = minified.length;
    const reduction = originalSize - minifiedSize;
    const reductionPercent = (reduction / originalSize) * 100;

    return {
      original: svg,
      minified,
      originalSize,
      minifiedSize,
      reduction,
      reductionPercent,
    };
  }

  setCSSOptions(options: any): void {
    this.cssOptions = { ...this.cssOptions, ...options };
  }

  setJSOptions(options: MinifyOptions): void {
    this.jsOptions = { ...this.jsOptions, ...options };
  }

  setHTMLOptions(options: HtmlMinifyOptions): void {
    this.htmlOptions = { ...this.htmlOptions, ...options };
  }
}`,

    'src/bundle-optimizer.ts': `// Bundle Optimizer
// Bundle analysis and optimization recommendations

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

export interface BundleInfo {
  name: string;
  size: number;
  gzipSize: number;
  brotliSize: number;
  modules: number;
  dependencies: string[];
}

export interface OptimizationRecommendation {
  type: 'code-splitting' | 'tree-shaking' | 'lazy-loading' | 'dynamic-import' | 'compression';
  priority: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
}

export class BundleOptimizer {
  private bundles: Map<string, BundleInfo> = new Map();

  analyzeBundle(bundlePath: string): BundleInfo {
    const stat = statSync(bundlePath);
    const content = readFileSync(bundlePath, 'utf-8');

    const bundle: BundleInfo = {
      name: bundlePath.split('/').pop()!,
      size: stat.size,
      gzipSize: Math.round(stat.size * 0.3), // Approximate
      brotliSize: Math.round(stat.size * 0.25), // Approximate
      modules: (content.match(/require\\(|import /g) || []).length,
      dependencies: this.extractDependencies(content),
    };

    this.bundles.set(bundlePath, bundle);
    return bundle;
  }

  analyzeDirectory(directory: string): BundleInfo[] {
    const bundles: BundleInfo[] = [];

    if (!existsSync(directory)) {
      return bundles;
    }

    const files = readdirSync(directory);
    const bundleFiles = files.filter((f) =>
      ['.js', '.css', '.mjs', '.cjs'].includes(extname(f))
    );

    for (const file of bundleFiles) {
      const filePath = join(directory, file);
      try {
        const bundle = this.analyzeBundle(filePath);
        bundles.push(bundle);
      } catch (error) {
        console.error(\`Error analyzing \${filePath}:\`, error);
      }
    }

    return bundles.sort((a, b) => b.size - a.size);
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];

    // Extract require() calls
    const requireMatches = content.matchAll(/require\\(['"]([^'"]+)['"]\\)/g);
    for (const match of requireMatches) {
      dependencies.push(match[1]);
    }

    // Extract import statements
    const importMatches = content.matchAll(/import\\s+.*?\\s+from\\s+['"]([^'"]+)['"]/g);
    for (const match of importMatches) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)];
  }

  getRecommendations(bundles: BundleInfo[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    const totalSize = bundles.reduce((sum, b) => sum + b.size, 0);
    const largestBundle = bundles[0];

    // Check for large bundles
    if (largestBundle && largestBundle.size > 250000) {
      recommendations.push({
        type: 'code-splitting',
        priority: 'high',
        description: \`Bundle \${largestBundle.name} is \${(largestBundle.size / 1024).toFixed(2)}KB\`,
        impact: 'Split large bundles into smaller chunks for faster loading',
      });
    }

    // Check for unused dependencies
    for (const bundle of bundles) {
      if (bundle.dependencies.length > 50) {
        recommendations.push({
          type: 'tree-shaking',
          priority: 'medium',
          description: \`Bundle \${bundle.name} has \${bundle.dependencies.length} dependencies\`,
          impact: 'Remove unused code to reduce bundle size',
        });
      }
    }

    // Check total bundle size
    if (totalSize > 1000000) {
      recommendations.push({
        type: 'lazy-loading',
        priority: 'high',
        description: \`Total bundle size is \${(totalSize / 1024 / 1024).toFixed(2)}MB\`,
        impact: 'Implement lazy loading for routes and components',
      });
    }

    // Suggest compression
    const hasUncompressed = bundles.some((b) => b.size > 100000);
    if (hasUncompressed) {
      recommendations.push({
        type: 'compression',
        priority: 'medium',
        description: 'Some bundles are over 100KB',
        impact: 'Enable gzip and brotli compression for faster transfers',
      });
    }

    // Suggest dynamic imports
    if (bundles.length > 5) {
      recommendations.push({
        type: 'dynamic-import',
        priority: 'medium',
        description: \`Found \${bundles.length} bundles\`,
        impact: 'Use dynamic imports for code splitting',
      });
    }

    return recommendations;
  }

  getBundles(): Map<string, BundleInfo> {
    return new Map(this.bundles);
  }

  clearCache(): void {
    this.bundles.clear();
  }
}`,

    'src/precompressor.ts': `// Precompressor
// Pre-compression of static assets

import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { createGzip, createBrotliCompress, constants } from 'zlib';
import { promisify } from 'util';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

export interface PrecompressionResult {
  file: string;
  gzipSize?: number;
  brotliSize?: number;
  duration: number;
  error?: string;
}

export class Precompressor {
  async precompressFile(filePath: string): Promise<PrecompressionResult> {
    const startTime = Date.now();
    const result: PrecompressionResult = {
      file: filePath,
      duration: 0,
    };

    if (!existsSync(filePath)) {
      result.error = 'File not found';
      return result;
    }

    try {
      // Compress with gzip
      const gzipPath = \`\${filePath}.gz\`;
      await this.compressFile(filePath, gzipPath, 'gzip');
      const gzipStats = statSync(gzipPath);
      result.gzipSize = gzipStats.size;

      // Compress with brotli
      const brotliPath = \`\${filePath}.br\`;
      await this.compressFile(filePath, brotliPath, 'brotli');
      const brotliStats = statSync(brotliPath);
      result.brotliSize = brotliStats.size;

      result.duration = Date.now() - startTime;
    } catch (error: any) {
      result.error = error.message;
    }

    return result;
  }

  async precompressDirectory(
    directory: string,
    extensions: string[] = ['.html', '.css', '.js', '.json', '.svg', '.xml']
  ): Promise<PrecompressionResult[]> {
    const results: PrecompressionResult[] = [];

    if (!existsSync(directory)) {
      return results;
    }

    const files = readdirSync(directory);
    const compressibleFiles = files.filter((f) =>
      extensions.includes(extname(f))
    );

    for (const file of compressibleFiles) {
      const filePath = join(directory, file);
      const result = await this.precompressFile(filePath);
      results.push(result);
    }

    return results;
  }

  private async compressFile(
    inputPath: string,
    outputPath: string,
    algorithm: 'gzip' | 'brotli'
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const input = createReadStream(inputPath);
      const output = createWriteStream(outputPath);

      let compressor;
      if (algorithm === 'gzip') {
        compressor = createGzip({ level: 9 });
      } else {
        compressor = createBrotliCompress({
          params: {
            [constants.BROTLI_PARAM_QUALITY]: 11,
          },
        });
      }

      pipeline(
        input,
        compressor,
        output,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  async precompressWithWatch(
    directory: string,
    callback: (result: PrecompressionResult) => void
  ): Promise<void> {
    const results = await this.precompressDirectory(directory);
    results.forEach(callback);

    // Watch for new files
    const chokidar = require('chokidar');
    const watcher = chokidar.watch(directory, {
      ignored: /\\.gz$|\\.br$/,
      persistent: true,
    });

    watcher.on('add', async (filePath) => {
      const result = await this.precompressFile(filePath);
      callback(result);
    });

    watcher.on('change', async (filePath) => {
      const result = await this.precompressFile(filePath);
      callback(result);
    });
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { CompressionManager } from '../compression-manager';
import { Minifier } from '../minifier';
import { BundleOptimizer } from '../bundle-optimizer';

export function apiRoutes(
  compressionManager: CompressionManager,
  minifier: Minifier,
  bundleOptimizer: BundleOptimizer
): Router {
  const router = Router();

  // Get compression config
  router.get('/compression/config', (req, res) => {
    const config = compressionManager.getConfig();
    res.json(config);
  });

  // Update compression config
  router.post('/compression/config', (req, res) => {
    compressionManager.setConfig(req.body);
    res.json({ message: 'Compression config updated', config: compressionManager.getConfig() });
  });

  // Enable/disable compression
  router.post('/compression/toggle', (req, res) => {
    const { enabled } = req.body;

    if (enabled) {
      compressionManager.enable();
    } else {
      compressionManager.disable();
    }

    res.json({ message: \`Compression \${enabled ? 'enabled' : 'disabled'}\` });
  });

  // Minify CSS
  router.post('/minify/css', (req, res) => {
    const { css } = req.body;

    if (!css) {
      return res.status(400).json({ error: 'css is required' });
    }

    const result = minifier.minifyCSS(css);
    res.json(result);
  });

  // Minify JavaScript
  router.post('/minify/js', async (req, res) => {
    const { js } = req.body;

    if (!js) {
      return res.status(400).json({ error: 'js is required' });
    }

    const result = await minifier.minifyJS(js);
    res.json(result);
  });

  // Minify HTML
  router.post('/minify/html', (req, res) => {
    const { html } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'html is required' });
    }

    const result = minifier.minifyHTML(html);
    res.json(result);
  });

  // Minify JSON
  router.post('/minify/json', async (req, res) => {
    const { json } = req.body;

    if (!json) {
      return res.status(400).json({ error: 'json is required' });
    }

    const result = await minifier.minifyJSON(json);
    res.json(result);
  });

  // Minify SVG
  router.post('/minify/svg', async (req, res) => {
    const { svg } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'svg is required' });
    }

    const result = await minifier.minifySVG(svg);
    res.json(result);
  });

  // Analyze bundle
  router.post('/bundle/analyze', (req, res) => {
    const { bundlePath } = req.body;

    if (!bundlePath) {
      return res.status(400).json({ error: 'bundlePath is required' });
    }

    try {
      const bundle = bundleOptimizer.analyzeBundle(bundlePath);
      res.json(bundle);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Analyze directory
  router.post('/bundle/analyze-directory', (req, res) => {
    const { directory } = req.body;

    if (!directory) {
      return res.status(400).json({ error: 'directory is required' });
    }

    const bundles = bundleOptimizer.analyzeDirectory(directory);
    res.json(bundles);
  });

  // Get recommendations
  router.post('/bundle/recommendations', (req, res) => {
    const { bundles } = req.body;

    if (!Array.isArray(bundles)) {
      return res.status(400).json({ error: 'bundles must be an array' });
    }

    const recommendations = bundleOptimizer.getRecommendations(bundles);
    res.json(recommendations);
  });

  return router;
}`,

    'src/routes/compress.routes.ts': `// Compression Routes
import { Router } from 'express';
import { CompressionManager } from '../compression-manager';
import { Minifier } from '../minifier';
import { Precompressor } from '../precompressor';

export function compressRoutes(
  compressionManager: CompressionManager,
  minifier: Minifier,
  precompressor: Precompressor
): Router {
  const router = Router();

  // Compress string
  router.post('/string', async (req, res) => {
    const { text, algorithm } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const result = await compressionManager.compressString(
      text,
      algorithm || 'br'
    );
    res.json(result);
  });

  // Compare algorithms
  router.post('/compare', async (req, res) => {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const results = await compressionManager.compareAlgorithms(text);
    res.json(results);
  });

  // Precompress file
  router.post('/precompress/file', async (req, res) => {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    const result = await precompressor.precompressFile(filePath);
    res.json(result);
  });

  // Precompress directory
  router.post('/precompress/directory', async (req, res) => {
    const { directory, extensions } = req.body;

    if (!directory) {
      return res.status(400).json({ error: 'directory is required' });
    }

    const results = await precompressor.precompressDirectory(
      directory,
      extensions
    );
    res.json(results);
  });

  return router;
}`,

    'README.md': `# Response Compression & Bundling Optimization

Advanced response compression and optimization system with support for gzip, brotli, deflate, and comprehensive minification.

## Features

### 🗜️ **Multi-Algorithm Compression**
- **Brotli (br)**: Best compression ratio (11 levels)
- **Gzip**: Fast compression with good ratio (9 levels)
- **Deflate**: Basic compression for compatibility
- **Automatic Selection**: Based on Accept-Encoding header
- **Configurable Threshold**: Compress only responses above specified size

### ✨ **Comprehensive Minification**
- **CSS**: Advanced minification with clean-css (level 2)
- **JavaScript**: Terser with mangling and dead code elimination
- **HTML**: HTML-minifier-terser with extensive options
- **JSON**: Remove whitespace for smaller API responses
- **SVG**: Basic SVG optimization

### 📦 **Bundle Optimization**
- **Bundle Analysis**: Size, modules, dependencies tracking
- **Recommendations**: Code splitting, tree shaking, lazy loading
- **Pre-compression**: Generate .gz and .br files for static assets
- **Watch Mode**: Auto-compress on file changes

## Quick Start

### 1. Configure Compression

\`\`\`bash
curl -X POST http://localhost:3000/api/compression/config \\
  -H "Content-Type: application/json" \\
  -d '{
    "enabled": true,
    "algorithms": ["br", "gzip", "deflate"],
    "level": 6,
    "threshold": 1024
  }'
\`\`\`

### 2. Minify CSS

\`\`\`bash
curl -X POST http://localhost:3000/api/minify/css \\
  -H "Content-Type: application/json" \\
  -d '{
    "css": "body { margin: 0; padding: 0; }"
  }'
\`\`\`

Response:
\`\`\`json
{
  "original": "body { margin: 0; padding: 0; }",
  "minified": "body{margin:0;padding:0}",
  "originalSize": 31,
  "minifiedSize": 22,
  "reduction": 9,
  "reductionPercent": 29.03
}
\`\`\`

### 3. Minify JavaScript

\`\`\`bash
curl -X POST http://localhost:3000/api/minify/js \\
  -H "Content-Type: application/json" \\
  -d '{
    "js": "function add(a, b) { return a + b; }"
  }'
\`\`\`

### 4. Analyze Bundle

\`\`\`bash
curl -X POST http://localhost:3000/api/bundle/analyze \\
  -H "Content-Type: application/json" \\
  -d '{
    "bundlePath": "./dist/main.js"
  }'
\`\`\`

Response:
\`\`\`json
{
  "name": "main.js",
  "size": 524288,
  "gzipSize": 157286,
  "brotliSize": 131072,
  "modules": 42,
  "dependencies": ["react", "lodash", "axios"]
}
\`\`\`

### 5. Get Optimization Recommendations

\`\`\`bash
curl -X POST http://localhost:3000/api/bundle/recommendations \\
  -H "Content-Type: application/json" \\
  -d '{
    "bundles": [...]
  }'
\`\`\`

Response:
\`\`\`json
[
  {
    "type": "code-splitting",
    "priority": "high",
    "description": "Bundle main.js is 512.00KB",
    "impact": "Split large bundles into smaller chunks for faster loading"
  },
  {
    "type": "lazy-loading",
    "priority": "high",
    "description": "Total bundle size is 2.50MB",
    "impact": "Implement lazy loading for routes and components"
  }
]
\`\`\`

## API Endpoints

### Compression Management

#### \`GET /api/compression/config\`
Get current compression configuration.

#### \`POST /api/compression/config\`
Update compression configuration.

#### \`POST /api/compression/toggle\`
Enable or disable compression.

### Minification

#### \`POST /api/minify/css\`
Minify CSS code.

#### \`POST /api/minify/js\`
Minify JavaScript code.

#### \`POST /api/minify/html\`
Minify HTML code.

#### \`POST /api/minify/json\`
Minify JSON data.

#### \`POST /api/minify/svg\`
Minify SVG code.

### Bundle Optimization

#### \`POST /api/bundle/analyze\`
Analyze a single bundle file.

#### \`POST /api/bundle/analyze-directory\`
Analyze all bundles in a directory.

#### \`POST /api/bundle/recommendations\`
Get optimization recommendations for bundles.

### Compression Utilities

#### \`POST /compress/string\`
Compress a string with specified algorithm.

#### \`POST /compress/compare\`
Compare compression algorithms.

#### \`POST /compress/precompress/file\`
Pre-compress a single file (creates .gz and .br).

#### \`POST /compress/precompress/directory\`
Pre-compress all files in a directory.

## Compression Algorithms Comparison

| Algorithm | Ratio | Speed | Browser Support |
|-----------|-------|-------|-----------------|
| Brotli (br) | Best | Medium | Modern browsers |
| Gzip | Good | Fast | All browsers |
| Deflate | Medium | Fastest | All browsers |

## Environment Variables

\`\`\`bash
PORT=3000              # Server port
COMPRESSION_ENABLED=true    # Enable/disable compression
COMPRESSION_LEVEL=6         # Compression level (0-11 for brotli, 0-9 for gzip)
COMPRESSION_THRESHOLD=1024  # Minimum size to compress (bytes)
\`\`\`

## Dependencies

- **compression** - Express compression middleware
- **brotli** - Brotli compression
- **pako** - High-speed zlib port
- **iltorb** - Brotli compression bindings
- **minify** - Unified minification
- **html-minifier-terser** - HTML minifier
- **clean-css** - CSS minifier
- **terser** - JavaScript minifier
- **@node-minify/*** - Node.js minification modules

## License

MIT`,
  },
};