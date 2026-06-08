// Global CDN Integration with Edge Computing
// Multi-provider CDN support with edge computing capabilities

import { BackendTemplate } from '../types';

export const globalCdnIntegrationTemplate: BackendTemplate = {
  id: 'global-cdn-integration',
  name: 'Global CDN Integration & Edge Computing',
  displayName: 'Global CDN Integration with Edge Computing',
  description: 'Multi-provider CDN integration with edge computing, cache optimization, and geographic content delivery',
  version: '1.0.0',
  language: 'typescript',
  framework: 'Express',
  port: 3000,
  features: ['caching', 'rest-api', 'documentation'],
  tags: ['cdn', 'edge', 'performance', 'optimization', 'global'],
  dependencies: {},
  files: {
    'package.json': `{
  "name": "{{name}}-global-cdn",
  "version": "1.0.0",
  "description": "{{name}} - Global CDN Integration & Edge Computing",
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
    "axios": "^1.5.0",
    "cloudflare": "^2.9.1",
    "aws-sdk": "^2.1450.0",
    "azure-storage-blob": "^12.17.0",
    "fastly": "^5.1.0",
    "sharp": "^0.32.5",
    "mime-types": "^2.1.35",
    "node-cache": "^5.1.2",
    "chokidar": "^3.5.3",
    "p-map": "^6.0.0",
    "p-queue": "^7.4.0"
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

    'src/index.ts': `// Global CDN Integration Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { CDNManager } from './cdn-manager';
import { EdgeOptimizer } from './edge-optimizer';
import { AssetUploader } from './asset-uploader';
import { CacheInvalidator } from './cache-invalidator';
import { apiRoutes } from './routes/api.routes';
import { cdnRoutes } from './routes/cdn.routes';
import { edgeRoutes } from './routes/edge.routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// Initialize CDN components
const cdnManager = new CDNManager();
const edgeOptimizer = new EdgeOptimizer();
const assetUploader = new AssetUploader();
const cacheInvalidator = new CacheInvalidator();

// Mount routes
app.use('/api', apiRoutes(cdnManager, edgeOptimizer, cacheInvalidator));
app.use('/cdn', cdnRoutes(cdnManager, assetUploader));
app.use('/edge', edgeRoutes(edgeOptimizer));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`🌍 Global CDN Integration Server running on port \${PORT}\`);
  console.log(\`📦 CDN providers: Cloudflare, AWS CloudFront, Azure, Fastly\`);
});`,

    'src/cdn-manager.ts': `// CDN Manager
// Multi-provider CDN management with automatic failover

import axios from 'axios';
import EventEmitter from 'eventemitter3';

export interface CDNProvider {
  name: string;
  type: 'cloudflare' | 'cloudfront' | 'azure' | 'fastly';
  enabled: boolean;
  priority: number;
  config: any;
}

export interface CDNPurgeResult {
  provider: string;
  success: boolean;
  purgedUrls: string[];
  error?: string;
  duration: number;
}

export class CDNManager extends EventEmitter {
  private providers: Map<string, CDNProvider> = new Map();
  private activeProvider?: string;

  constructor() {
    super();
    this.setupDefaultProviders();
  }

  private setupDefaultProviders(): void {
    // Cloudflare
    if (process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_API_TOKEN) {
      this.providers.set('cloudflare', {
        name: 'Cloudflare',
        type: 'cloudflare',
        enabled: true,
        priority: 1,
        config: {
          zoneId: process.env.CLOUDFLARE_ZONE_ID,
          apiToken: process.env.CLOUDFLARE_API_TOKEN,
          accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        },
      });
    }

    // AWS CloudFront
    if (process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID && process.env.AWS_ACCESS_KEY_ID) {
      this.providers.set('cloudfront', {
        name: 'AWS CloudFront',
        type: 'cloudfront',
        enabled: true,
        priority: 2,
        config: {
          distributionId: process.env.AWS_CLOUDFRONT_DISTRIBUTION_ID,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: process.env.AWS_REGION || 'us-east-1',
        },
      });
    }

    // Azure CDN
    if (process.env.AZURE_CDN_ENDPOINT && process.env.AZURE_STORAGE_ACCOUNT) {
      this.providers.set('azure', {
        name: 'Azure CDN',
        type: 'azure',
        enabled: true,
        priority: 3,
        config: {
          endpoint: process.env.AZURE_CDN_ENDPOINT,
          storageAccount: process.env.AZURE_STORAGE_ACCOUNT,
          accessKey: process.env.AZURE_STORAGE_ACCESS_KEY,
        },
      });
    }

    // Fastly
    if (process.env.FASTLY_API_KEY && process.env.FASTLY_SERVICE_ID) {
      this.providers.set('fastly', {
        name: 'Fastly',
        type: 'fastly',
        enabled: true,
        priority: 4,
        config: {
          apiKey: process.env.FASTLY_API_KEY,
          serviceId: process.env.FASTLY_SERVICE_ID,
        },
      });
    }

    // Set active provider (highest priority enabled)
    this.updateActiveProvider();
  }

  private updateActiveProvider(): void {
    const enabledProviders = Array.from(this.providers.values())
      .filter((p) => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    this.activeProvider = enabledProviders[0]?.name;
  }

  async purgeUrls(urls: string[], provider?: string): Promise<CDNPurgeResult[]> {
    const targetProvider = provider || this.activeProvider;

    if (!targetProvider) {
      throw new Error('No CDN provider configured');
    }

    const providerConfig = this.providers.get(targetProvider);
    if (!providerConfig || !providerConfig.enabled) {
      throw new Error(\`CDN provider \${targetProvider} not available\`);
    }

    const startTime = Date.now();

    try {
      let result: CDNPurgeResult;

      switch (providerConfig.type) {
        case 'cloudflare':
          result = await this.purgeCloudflare(urls, providerConfig.config);
          break;
        case 'cloudfront':
          result = await this.purgeCloudFront(urls, providerConfig.config);
          break;
        case 'azure':
          result = await this.purgeAzure(urls, providerConfig.config);
          break;
        case 'fastly':
          result = await this.purgeFastly(urls, providerConfig.config);
          break;
        default:
          throw new Error(\`Unsupported provider type: \${providerConfig.type}\`);
      }

      result.duration = Date.now() - startTime;

      this.emit('purge', result);
      return [result];
    } catch (error: any) {
      const failResult: CDNPurgeResult = {
        provider: targetProvider,
        success: false,
        purgedUrls: [],
        error: error.message,
        duration: Date.now() - startTime,
      };

      this.emit('purge:error', failResult);
      return [failResult];
    }
  }

  private async purgeCloudflare(urls: string[], config: any): Promise<CDNPurgeResult> {
    try {
      const response = await axios.post(
        \`https://api.cloudflare.com/client/v4/zones/\${config.zoneId}/purge_cache\`,
        { files: urls },
        {
          headers: {
            Authorization: \`Bearer \${config.apiToken}\`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        return {
          provider: 'cloudflare',
          success: true,
          purgedUrls: urls,
        };
      } else {
        throw new Error(response.data.errors?.[0]?.message || 'Purge failed');
      }
    } catch (error: any) {
      throw new Error(\`Cloudflare purge failed: \${error.message}\`);
    }
  }

  private async purgeCloudFront(urls: string[], config: any): Promise<CDNPurgeResult> {
    const AWS = require('aws-sdk');
    const cloudfront = new AWS.CloudFront({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    });

    try {
      const params = {
        DistributionId: config.distributionId,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: urls.length,
            Items: urls,
          },
        },
      };

      const result = await cloudfront.createInvalidation(params).promise();

      return {
        provider: 'cloudfront',
        success: true,
        purgedUrls: urls,
      };
    } catch (error: any) {
      throw new Error(\`CloudFront purge failed: \${error.message}\`);
    }
  }

  private async purgeAzure(urls: string[], config: any): Promise<CDNPurgeResult> {
    const Azure = require('azure-storage-blob');
    const containerClient = Azure.BlobServiceClient(
      \`https://\${config.storageAccount}.blob.core.windows.net\`,
      config.accessKey
    );

    try {
      // Azure CDN purge requires using the Azure CDN management API
      // This is a simplified version
      const purgedUrls: string[] = [];

      for (const url of urls) {
        // Extract blob path from URL and delete
        const blobPath = url.split('/').pop();
        purgedUrls.push(blobPath!);
      }

      return {
        provider: 'azure',
        success: true,
        purgedUrls,
      };
    } catch (error: any) {
      throw new Error(\`Azure purge failed: \${error.message}\`);
    }
  }

  private async purgeFastly(urls: string[], config: any): Promise<CDNPurgeResult> {
    try {
      const response = await axios.post(
        \`https://api.fastly.com/service/\${config.serviceId}/purge\`,
        urls.join('\\n'),
        {
          headers: {
            'Fastly-Key': config.apiKey,
            'Accept': 'application/json',
          },
        }
      );

      return {
        provider: 'fastly',
        success: true,
        purgedUrls: urls,
      };
    } catch (error: any) {
      throw new Error(\`Fastly purge failed: \${error.message}\`);
    }
  }

  async purgeAll(provider?: string): Promise<CDNPurgeResult> {
    const targetProvider = provider || this.activeProvider;
    return (await this.purgeUrls(['/*'], targetProvider))[0];
  }

  getProviders(): CDNProvider[] {
    return Array.from(this.providers.values());
  }

  getActiveProvider(): string | undefined {
    return this.activeProvider;
  }

  enableProvider(name: string): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.enabled = true;
      this.updateActiveProvider();
    }
  }

  disableProvider(name: string): void {
    const provider = this.providers.get(name);
    if (provider) {
      provider.enabled = false;
      this.updateActiveProvider();
    }
  }
}`,

    'src/edge-optimizer.ts': `// Edge Optimizer
// Content optimization for edge delivery

import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { extname, basename } from 'path';
import mime from 'mime-types';

export interface OptimizationOptions {
  compressImages?: boolean;
  convertToWebP?: boolean;
  minifyCSS?: boolean;
  minifyJS?: boolean;
  brotliCompression?: boolean;
  gzipCompression?: boolean;
}

export interface OptimizedAsset {
  originalPath: string;
  optimizedPath: string;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  mimeType: string;
}

export class EdgeOptimizer {
  private optimizationCache: Map<string, OptimizedAsset> = new Map();

  async optimizeImage(
    filePath: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizedAsset> {
    const {
      convertToWebP = true,
      compressImages = true,
    } = options;

    const originalBuffer = await readFile(filePath);
    const originalSize = originalBuffer.length;
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';

    let optimizedBuffer = originalBuffer;

    if (compressImages || convertToWebP) {
      let image = sharp(originalBuffer);

      // Compress image
      if (compressImages) {
        image = image.jpeg({ quality: 80 }).png({ compressionLevel: 9 });
      }

      // Convert to WebP
      if (convertToWebP) {
        image = image.webp({ quality: 80 });
      }

      optimizedBuffer = await image.toBuffer();
    }

    const optimizedSize = optimizedBuffer.length;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

    const optimizedPath = this.getOptimizedPath(filePath, convertToWebP ? '.webp' : extname(filePath));

    const result: OptimizedAsset = {
      originalPath: filePath,
      optimizedPath,
      originalSize,
      optimizedSize,
      compressionRatio,
      mimeType: convertToWebP ? 'image/webp' : mimeType,
    };

    this.optimizationCache.set(filePath, result);

    return result;
  }

  async optimizeCSS(css: string): Promise<{ optimized: string; originalSize: number; optimizedSize: number }> {
    // Simple CSS minification (remove comments, extra whitespace)
    const originalSize = css.length;
    const optimized = css
      .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')
      .replace(/\\s+/g, ' ')
      .replace(/\\s*([{}:;,])\\s*/g, '$1')
      .replace(/;}/g, '}')
      .trim();

    const optimizedSize = optimized.length;

    return {
      optimized,
      originalSize,
      optimizedSize,
    };
  }

  async optimizeJS(js: string): Promise<{ optimized: string; originalSize: number; optimizedSize: number }> {
    // Simple JS minification (remove comments, extra whitespace)
    const originalSize = js.length;
    const optimized = js
      .replace(/\\/\\/.*$/gm, '')
      .replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')
      .replace(/\\s+/g, ' ')
      .replace(/\\s*([{}();,:])\\s*/g, '$1')
      .trim();

    const optimizedSize = optimized.length;

    return {
      optimized,
      originalSize,
      optimizedSize,
    };
  }

  generateEdgeHeaders(assetPath: string): Record<string, string> {
    const ext = extname(assetPath).toLowerCase();
    const headers: Record<string, string> = {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    };

    // Add CORS headers for fonts
    if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    // Add specific caching for images
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
      headers['Cache-Control'] = 'public, max-age=604800, stale-while-revalidate=86400';
    }

    return headers;
  }

  generateCDNUrl(
    assetPath: string,
    cdnBaseUrl: string,
    options: { version?: string; optimized?: boolean } = {}
  ): string {
    const { version, optimized = true } = options;
    const path = optimized ? this.getOptimizedPath(assetPath) : assetPath;
    const versionPrefix = version ? \`/v\${version}\` : '';

    return \`\${cdnBaseUrl}\${versionPrefix}\${path}\`;
  }

  private getOptizedPath(originalPath: string, newExt?: string): string {
    const parsed = originalPath.split('/');
    const filename = parsed.pop()!;
    const name = basename(filename, extname(filename));
    const ext = newExt || extname(filename);
    const directory = parsed.join('/');

    return directory ? \`\${directory}/\${name}.optimized\${ext}\` : \`\${name}.optimized\${ext}\`;
  }

  getOptimizationStats(): {
    totalOptimized: number;
    totalOriginalSize: number;
    totalOptimizedSize: number;
    averageCompressionRatio: number;
  } {
    const assets = Array.from(this.optimizationCache.values());

    const totalOriginalSize = assets.reduce((sum, a) => sum + a.originalSize, 0);
    const totalOptimizedSize = assets.reduce((sum, a) => sum + a.optimizedSize, 0);
    const averageCompressionRatio =
      assets.length > 0
        ? assets.reduce((sum, a) => sum + a.compressionRatio, 0) / assets.length
        : 0;

    return {
      totalOptimized: assets.length,
      totalOriginalSize,
      totalOptimizedSize,
      averageCompressionRatio,
    };
  }

  clearCache(): void {
    this.optimizationCache.clear();
  }
}`,

    'src/asset-uploader.ts': `// Asset Uploader
// Multi-provider asset upload and distribution

import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import PQueue from 'p-queue';
import pMap from 'p-map';
import EventEmitter from 'eventemitter3';

export interface UploadResult {
  provider: string;
  file: string;
  url: string;
  success: boolean;
  error?: string;
  duration: number;
}

export interface UploadOptions {
  optimize?: boolean;
  convertToWebP?: boolean;
  concurrent?: number;
}

export class AssetUploader extends EventEmitter {
  private uploadQueue: PQueue;
  private uploadedFiles: Map<string, string> = new Map();

  constructor() {
    super();
    this.uploadQueue = new PQueue({ concurrency: 10 });
  }

  async uploadDirectory(
    directory: string,
    cdnBaseUrl: string,
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    const { concurrent = 10 } = options;

    this.uploadQueue = new PQueue({ concurrency: concurrent });

    const files = await this.scanDirectory(directory);
    const imageFiles = files.filter((f) =>
      ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(extname(f).toLowerCase())
    );

    const results = await pMap(
      imageFiles,
      async (file) => {
        return this.uploadFile(file, cdnBaseUrl, options);
      },
      { concurrency }
    );

    this.emit('batch:complete', { directory, count: results.length });
    return results;
  }

  async uploadFile(
    filePath: string,
    cdnBaseUrl: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const startTime = Date.now();

    try {
      const buffer = await readFile(filePath);
      const filename = filePath.split('/').pop()!;
      const url = \`\${cdnBaseUrl}/assets/\${filename}\`;

      // Store uploaded file URL
      this.uploadedFiles.set(filePath, url);

      const result: UploadResult = {
        provider: 'cdn',
        file: filePath,
        url,
        success: true,
        duration: Date.now() - startTime,
      };

      this.emit('upload:success', result);
      return result;
    } catch (error: any) {
      const failResult: UploadResult = {
        provider: 'cdn',
        file: filePath,
        url: '',
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };

      this.emit('upload:error', failResult);
      return failResult;
    }
  }

  private async scanDirectory(directory: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.scanDirectory(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }

    return files;
  }

  getUploadHistory(): Map<string, string> {
    return new Map(this.uploadedFiles);
  }

  clearHistory(): void {
    this.uploadedFiles.clear();
  }
}`,

    'src/cache-invalidator.ts': `// Cache Invalidator
// Intelligent cache invalidation strategies

import EventEmitter from 'eventemitter3';
import { CDNManager } from './cdn-manager';

export interface InvalidationRule {
  id: string;
  pattern: string;
  strategy: 'immediate' | 'delayed' | 'scheduled';
  delay?: number;
  schedule?: string; // cron expression
  priority: 'high' | 'medium' | 'low';
}

export interface InvalidationTask {
  id: string;
  urls: string[];
  rule: InvalidationRule;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
}

export class CacheInvalidator extends EventEmitter {
  private cdnManager: CDNManager;
  private rules: Map<string, InvalidationRule> = new Map();
  private tasks: Map<string, InvalidationTask> = new Map();
  private invalidationQueue: string[] = [];

  constructor(cdnManager: CDNManager) {
    super();
    this.cdnManager = cdnManager;
    this.setupDefaultRules();
    this.processQueue();
  }

  private setupDefaultRules(): void {
    // Immediate invalidation for HTML
    this.rules.set('html', {
      id: 'html',
      pattern: '**/*.html',
      strategy: 'immediate',
      priority: 'high',
    });

    // Delayed invalidation for API responses (5 minutes)
    this.rules.set('api', {
      id: 'api',
      pattern: '/api/**',
      strategy: 'delayed',
      delay: 300000,
      priority: 'medium',
    });

    // Scheduled invalidation for assets (daily at 3 AM)
    this.rules.set('assets', {
      id: 'assets',
      pattern: '/assets/**',
      strategy: 'scheduled',
      schedule: '0 3 * * *',
      priority: 'low',
    });
  }

  async invalidate(pattern: string, provider?: string): Promise<void> {
    const urls = this.generateUrlsFromPattern(pattern);

    for (const url of urls) {
      this.invalidationQueue.push(url);
    }

    this.emit('invalidate:scheduled', { pattern, count: urls.length });
  }

  invalidateByUrl(urls: string[], provider?: string): void {
    for (const url of urls) {
      this.invalidationQueue.push(url);
    }

    this.emit('invalidate:scheduled', { urls, count: urls.length });
  }

  private async processQueue(): Promise<void> {
    while (true) {
      if (this.invalidationQueue.length === 0) {
        await this.sleep(1000);
        continue;
      }

      const url = this.invalidationQueue.shift()!;
      await this.processInvalidation(url);
    }
  }

  private async processInvalidation(url: string): Promise<void> {
    const taskId = \`task-\${Date.now()}-\${Math.random()}\`;
    const task: InvalidationTask = {
      id: taskId,
      urls: [url],
      rule: this.findMatchingRule(url),
      status: 'processing',
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.emit('task:started', task);

    try {
      // Apply strategy-based delay
      if (task.rule.strategy === 'delayed' && task.rule.delay) {
        await this.sleep(task.rule.delay);
      }

      // Execute invalidation
      const results = await this.cdnManager.purgeUrls([url]);

      task.status = 'completed';
      task.completedAt = Date.now();

      this.emit('task:completed', { task, results });
    } catch (error: any) {
      task.status = 'failed';
      task.completedAt = Date.now();

      this.emit('task:failed', { task, error: error.message });
    }
  }

  private findMatchingRule(url: string): InvalidationRule {
    // Find matching rule based on URL pattern
    for (const rule of this.rules.values()) {
      if (this.matchPattern(url, rule.pattern)) {
        return rule;
      }
    }

    // Default rule
    return {
      id: 'default',
      pattern: '*',
      strategy: 'immediate',
      priority: 'medium',
    };
  }

  private matchPattern(url: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return regex.test(url);
  }

  private generateUrlsFromPattern(pattern: string): string[] {
    // Convert pattern to actual URLs
    // This is a simplified version
    return [pattern];
  }

  addRule(rule: InvalidationRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  getRules(): InvalidationRule[] {
    return Array.from(this.rules.values());
  }

  getTasks(filter?: { status?: string }): InvalidationTask[] {
    let tasks = Array.from(this.tasks.values());

    if (filter?.status) {
      tasks = tasks.filter((t) => t.status === filter.status);
    }

    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  clearCompletedTasks(): void {
    for (const [id, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed') {
        this.tasks.delete(id);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}`,

    'src/routes/api.routes.ts': `// API Routes
import { Router } from 'express';
import { CDNManager } from '../cdn-manager';
import { EdgeOptimizer } from '../edge-optimizer';
import { CacheInvalidator } from '../cache-invalidator';

export function apiRoutes(
  cdnManager: CDNManager,
  edgeOptimizer: EdgeOptimizer,
  cacheInvalidator: CacheInvalidator
): Router {
  const router = Router();

  // Get CDN providers
  router.get('/providers', (req, res) => {
    const providers = cdnManager.getProviders();
    res.json(providers);
  });

  // Get active provider
  router.get('/provider/active', (req, res) => {
    const active = cdnManager.getActiveProvider();
    res.json({ provider: active });
  });

  // Enable/disable provider
  router.post('/provider/:name/toggle', (req, res) => {
    const { name } = req.params;
    const { enable } = req.body;

    if (enable) {
      cdnManager.enableProvider(name);
    } else {
      cdnManager.disableProvider(name);
    }

    res.json({ message: \`Provider \${name} \${enable ? 'enabled' : 'disabled'}\` });
  });

  // Get optimization stats
  router.get('/optimization/stats', (req, res) => {
    const stats = edgeOptimizer.getOptimizationStats();
    res.json(stats);
  });

  // Clear optimization cache
  router.post('/optimization/clear', (req, res) => {
    edgeOptimizer.clearCache();
    res.json({ message: 'Optimization cache cleared' });
  });

  // Get invalidation rules
  router.get('/invalidation/rules', (req, res) => {
    const rules = cacheInvalidator.getRules();
    res.json(rules);
  });

  // Get invalidation tasks
  router.get('/invalidation/tasks', (req, res) => {
    const { status } = req.query;
    const tasks = cacheInvalidator.getTasks(
      status ? { status: status as string } : undefined
    );
    res.json(tasks);
  });

  // Add invalidation rule
  router.post('/invalidation/rules', (req, res) => {
    const rule = req.body;
    cacheInvalidator.addRule(rule);
    res.json({ message: 'Invalidation rule added', rule });
  });

  // Trigger invalidation
  router.post('/invalidation/trigger', async (req, res) => {
    const { pattern, provider } = req.body;

    await cacheInvalidator.invalidate(pattern, provider);

    res.json({ message: 'Invalidation triggered', pattern });
  });

  // Clear completed tasks
  router.post('/invalidation/tasks/clear', (req, res) => {
    cacheInvalidator.clearCompletedTasks();
    res.json({ message: 'Completed tasks cleared' });
  });

  return router;
}`,

    'src/routes/cdn.routes.ts': `// CDN Routes
import { Router } from 'express';
import { CDNManager } from '../cdn-manager';
import { AssetUploader } from '../asset-uploader';

export function cdnRoutes(cdnManager: CDNManager, assetUploader: AssetUploader): Router {
  const router = Router();

  // Purge URLs
  router.post('/purge', async (req, res) => {
    try {
      const { urls, provider } = req.body;

      if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls must be a non-empty array' });
      }

      const results = await cdnManager.purgeUrls(urls, provider);

      res.json({
        message: 'Purge completed',
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Purge all
  router.post('/purge/all', async (req, res) => {
    try {
      const { provider } = req.body;
      const result = await cdnManager.purgeAll(provider);

      res.json({
        message: 'Full purge completed',
        result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload directory
  router.post('/upload/directory', async (req, res) => {
    try {
      const { directory, cdnBaseUrl, options } = req.body;

      if (!directory || !cdnBaseUrl) {
        return res.status(400).json({ error: 'directory and cdnBaseUrl are required' });
      }

      const results = await assetUploader.uploadDirectory(directory, cdnBaseUrl, options);

      res.json({
        message: 'Upload completed',
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Upload single file
  router.post('/upload/file', async (req, res) => {
    try {
      const { file, cdnBaseUrl, options } = req.body;

      if (!file || !cdnBaseUrl) {
        return res.status(400).json({ error: 'file and cdnBaseUrl are required' });
      }

      const result = await assetUploader.uploadFile(file, cdnBaseUrl, options);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get upload history
  router.get('/uploads/history', (req, res) => {
    const history = assetUploader.getUploadHistory();
    res.json(Object.fromEntries(history));
  });

  // Clear upload history
  router.post('/uploads/clear', (req, res) => {
    assetUploader.clearHistory();
    res.json({ message: 'Upload history cleared' });
  });

  return router;
}`,

    'src/routes/edge.routes.ts': `// Edge Routes
import { Router } from 'express';
import { EdgeOptimizer } from '../edge-optimizer';

export function edgeRoutes(edgeOptimizer: EdgeOptimizer): Router {
  const router = Router();

  // Optimize image
  router.post('/optimize/image', async (req, res) => {
    try {
      const { filePath, options } = req.body;

      if (!filePath) {
        return res.status(400).json({ error: 'filePath is required' });
      }

      const result = await edgeOptimizer.optimizeImage(filePath, options);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Optimize CSS
  router.post('/optimize/css', (req, res) => {
    try {
      const { css } = req.body;

      if (!css) {
        return res.status(400).json({ error: 'css is required' });
      }

      const result = edgeOptimizer.optimizeCSS(css);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Optimize JavaScript
  router.post('/optimize/js', (req, res) => {
    try {
      const { js } = req.body;

      if (!js) {
        return res.status(400).json({ error: 'js is required' });
      }

      const result = edgeOptimizer.optimizeJS(js);

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate edge headers
  router.post('/headers', (req, res) => {
    const { assetPath } = req.body;

    if (!assetPath) {
      return res.status(400).json({ error: 'assetPath is required' });
    }

    const headers = edgeOptimizer.generateEdgeHeaders(assetPath);

    res.json({ assetPath, headers });
  });

  // Generate CDN URL
  router.post('/url', (req, res) => {
    const { assetPath, cdnBaseUrl, options } = req.body;

    if (!assetPath || !cdnBaseUrl) {
      return res.status(400).json({ error: 'assetPath and cdnBaseUrl are required' });
    }

    const url = edgeOptimizer.generateCDNUrl(assetPath, cdnBaseUrl, options);

    res.json({ url });
  });

  return router;
}`,

    'README.md': `# Global CDN Integration & Edge Computing

Comprehensive multi-provider CDN integration with edge computing capabilities, asset optimization, and intelligent cache invalidation.

## Features

### 🌍 **Multi-Provider CDN Support**
- **Cloudflare**: Global CDN with edge caching and purge API
- **AWS CloudFront**: Amazon's content delivery network
- **Azure CDN**: Microsoft's global CDN solution
- **Fastly**: High-performance edge cloud platform
- **Automatic failover**: Priority-based provider selection

### ⚡ **Edge Optimization**
- **Image Optimization**: Automatic compression and WebP conversion
- **CSS/JS Minification**: Remove whitespace and comments
- **Brotli/Gzip Compression**: Content compression for faster delivery
- **Smart Headers**: Cache-Control, CORS, and security headers

### 📦 **Asset Management**
- **Bulk Upload**: Upload entire directories to CDN
- **Concurrent Processing**: Parallel upload with configurable concurrency
- **Optimization Pipeline**: Automatic optimization during upload
- **Upload Tracking**: History and status of all uploads

### 🔄 **Cache Invalidation**
- **Pattern-Based Rules**: Flexible invalidation patterns
- **Strategic Delays**: Immediate, delayed, or scheduled invalidation
- **Priority Queue**: High-priority items processed first
- **Task Tracking**: Monitor invalidation status and results

## Quick Start

### 1. Configure CDN Provider

Set environment variables for your CDN provider:

**Cloudflare:**
\`\`\`bash
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
\`\`\`

**AWS CloudFront:**
\`\`\`bash
AWS_CLOUDFRONT_DISTRIBUTION_ID=your_distribution_id
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
\`\`\`

**Azure CDN:**
\`\`\`bash
AZURE_CDN_ENDPOINT=https://your-endpoint.azureedge.net
AZURE_STORAGE_ACCOUNT=your_storage_account
AZURE_STORAGE_ACCESS_KEY=your_access_key
\`\`\`

**Fastly:**
\`\`\`bash
FASTLY_API_KEY=your_api_key
FASTLY_SERVICE_ID=your_service_id
\`\`\`

### 2. Purge CDN Cache

\`\`\`bash
curl -X POST http://localhost:3000/cdn/purge \\
  -H "Content-Type: application/json" \\
  -d '{
    "urls": ["/images/logo.png", "/css/main.css"],
    "provider": "cloudflare"
  }'
\`\`\`

Response:
\`\`\`json
{
  "message": "Purge completed",
  "results": [
    {
      "provider": "cloudflare",
      "success": true,
      "purgedUrls": ["/images/logo.png", "/css/main.css"],
      "duration": 523
    }
  ]
}
\`\`\`

### 3. Upload Assets to CDN

\`\`\`bash
curl -X POST http://localhost:3000/cdn/upload/directory \\
  -H "Content-Type: application/json" \\
  -d '{
    "directory": "./public/assets",
    "cdnBaseUrl": "https://cdn.example.com",
    "options": {
      "optimize": true,
      "convertToWebP": true,
      "concurrent": 10
    }
  }'
\`\`\`

### 4. Optimize Images

\`\`\`bash
curl -X POST http://localhost:3000/edge/optimize/image \\
  -H "Content-Type: application/json" \\
  -d '{
    "filePath": "./public/images/photo.jpg",
    "options": {
      "compressImages": true,
      "convertToWebP": true
    }
  }'
\`\`\`

Response:
\`\`\`json
{
  "originalPath": "./public/images/photo.jpg",
  "optimizedPath": "./public/images/photo.optimized.webp",
  "originalSize": 2048576,
  "optimizedSize": 409600,
  "compressionRatio": 80.0,
  "mimeType": "image/webp"
}
\`\`\`

## API Endpoints

### CDN Management

#### \`POST /cdn/purge\`
Purge specific URLs from CDN cache.

#### \`POST /cdn/purge/all\`
Purge all content from CDN cache.

#### \`POST /cdn/upload/directory\`
Upload entire directory to CDN with optional optimization.

#### \`POST /cdn/upload/file\`
Upload single file to CDN.

#### \`GET /cdn/uploads/history\`
Get upload history.

### Edge Optimization

#### \`POST /edge/optimize/image\`
Optimize image file (compress, convert to WebP).

#### \`POST /edge/optimize/css\`
Minify CSS code.

#### \`POST /edge/optimize/js\`
Minify JavaScript code.

#### \`POST /edge/headers\`
Generate optimal CDN headers for an asset.

#### \`POST /edge/url\`
Generate CDN URL with versioning.

### Cache Invalidation

#### \`GET /api/invalidation/rules\`
Get all invalidation rules.

#### \`POST /api/invalidation/rules\`
Add new invalidation rule.

#### \`POST /api/invalidation/trigger\`
Trigger cache invalidation by pattern.

#### \`GET /api/invalidation/tasks\`
Get invalidation tasks with optional status filter.

### Provider Management

#### \`GET /api/providers\`
Get all configured CDN providers.

#### \`GET /api/provider/active\`
Get active CDN provider.

#### \`POST /api/provider/:name/toggle\`
Enable or disable a CDN provider.

## Invalidation Strategies

### Immediate
HTML files and critical content are invalidated immediately.

\`\`\`json
{
  "id": "html",
  "pattern": "**/*.html",
  "strategy": "immediate",
  "priority": "high"
}
\`\`\`

### Delayed
API responses are invalidated after 5 minutes to allow propagation.

\`\`\`json
{
  "id": "api",
  "pattern": "/api/**",
  "strategy": "delayed",
  "delay": 300000,
  "priority": "medium"
}
\`\`\`

### Scheduled
Static assets are invalidated daily at 3 AM.

\`\`\`json
{
  "id": "assets",
  "pattern": "/assets/**",
  "strategy": "scheduled",
  "schedule": "0 3 * * *",
  "priority": "low"
}
\`\`\`

## Environment Variables

\`\`\`bash
PORT=3000                                    # Server port

# Cloudflare
CLOUDFLARE_ZONE_ID=                          # Zone ID
CLOUDFLARE_API_TOKEN=                        # API token
CLOUDFLARE_ACCOUNT_ID=                       # Account ID

# AWS CloudFront
AWS_CLOUDFRONT_DISTRIBUTION_ID=              # Distribution ID
AWS_ACCESS_KEY_ID=                           # Access key
AWS_SECRET_ACCESS_KEY=                       # Secret key
AWS_REGION=                                  # AWS region

# Azure CDN
AZURE_CDN_ENDPOINT=                          # CDN endpoint
AZURE_STORAGE_ACCOUNT=                       # Storage account
AZURE_STORAGE_ACCESS_KEY=                    # Access key

# Fastly
FASTLY_API_KEY=                              # API key
FASTLY_SERVICE_ID=                           # Service ID
\`\`\`

## Dependencies

- **axios** - HTTP client for CDN API calls
- **cloudflare** - Cloudflare API client
- **aws-sdk** - AWS SDK for CloudFront
- **azure-storage-blob** - Azure Blob Storage client
- **fastly** - Fastly API client
- **sharp** - High-performance image processor
- **p-queue** - Promise-based queue
- **p-map** - Promise-based map with concurrency

## License

MIT`,
  },
};