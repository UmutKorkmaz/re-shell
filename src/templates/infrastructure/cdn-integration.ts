import { BaseTemplate, TemplateFile, TemplateContext } from '../index';
import { FrameworkConfig } from '../../utils/framework';

export class CDNIntegrationTemplate extends BaseTemplate {
  constructor(framework: FrameworkConfig, context: TemplateContext) {
    super(framework, context);
  }

  async generateFiles(): Promise<TemplateFile[]> {
    const files: TemplateFile[] = [];

    // CDN configuration
    files.push({
      path: 'cdn/cdn.config.ts',
      content: this.generateCDNConfig()
    });

    // Asset optimization utilities
    files.push({
      path: 'cdn/asset-optimizer.ts',
      content: this.generateAssetOptimizer()
    });

    // Image optimization
    files.push({
      path: 'cdn/image-optimizer.ts',
      content: this.generateImageOptimizer()
    });

    // Cache management
    files.push({
      path: 'cdn/cache-manager.ts',
      content: this.generateCacheManager()
    });

    // CDN providers
    files.push({
      path: 'cdn/providers/cloudflare.ts',
      content: this.generateCloudflareProvider()
    });

    files.push({
      path: 'cdn/providers/aws-cloudfront.ts',
      content: this.generateCloudFrontProvider()
    });

    files.push({
      path: 'cdn/providers/azure-cdn.ts',
      content: this.generateAzureCDNProvider()
    });

    files.push({
      path: 'cdn/providers/fastly.ts',
      content: this.generateFastlyProvider()
    });

    files.push({
      path: 'cdn/providers/bunny-cdn.ts',
      content: this.generateBunnyCDNProvider()
    });

    // Build plugins
    files.push({
      path: 'cdn/plugins/vite-cdn-plugin.ts',
      content: this.generateViteCDNPlugin()
    });

    files.push({
      path: 'cdn/plugins/webpack-cdn-plugin.ts',
      content: this.generateWebpackCDNPlugin()
    });

    // Service worker for caching
    files.push({
      path: 'cdn/service-worker/sw.ts',
      content: this.generateServiceWorker()
    });

    files.push({
      path: 'cdn/service-worker/workbox-config.ts',
      content: this.generateWorkboxConfig()
    });

    // Deploy scripts
    files.push({
      path: 'cdn/scripts/deploy.ts',
      content: this.generateDeployScript()
    });

    files.push({
      path: 'cdn/scripts/invalidate-cache.ts',
      content: this.generateCacheInvalidationScript()
    });

    // Terraform/IaC
    files.push({
      path: 'cdn/infrastructure/cloudflare.tf',
      content: this.generateCloudflareTerraform()
    });

    files.push({
      path: 'cdn/infrastructure/aws-cloudfront.tf',
      content: this.generateCloudFrontTerraform()
    });

    // Types
    files.push({
      path: 'cdn/types/index.ts',
      content: this.generateTypes()
    });

    // README
    files.push({
      path: 'cdn/README.md',
      content: this.generateReadme()
    });

    // Package.json for CDN module
    files.push({
      path: 'cdn/package.json',
      content: this.generatePackageJson()
    });

    return files;
  }

  protected generateCDNConfig(): string {
    return `import type { CDNProvider, CDNConfig, AssetConfig } from './types';

/**
 * CDN Configuration for ${this.context.name}
 */
export const cdnConfig: CDNConfig = {
  // Default provider
  provider: (process.env.CDN_PROVIDER as CDNProvider) || 'cloudflare',

  // CDN domains
  domains: {
    assets: process.env.CDN_ASSETS_DOMAIN || 'assets.${this.context.normalizedName}.com',
    images: process.env.CDN_IMAGES_DOMAIN || 'images.${this.context.normalizedName}.com',
    static: process.env.CDN_STATIC_DOMAIN || 'static.${this.context.normalizedName}.com',
  },

  // Origins
  origins: {
    primary: process.env.ORIGIN_URL || 'https://${this.context.normalizedName}.com',
    fallback: process.env.FALLBACK_ORIGIN_URL,
  },

  // Cache settings
  cache: {
    defaultTTL: 86400, // 24 hours
    maxTTL: 31536000, // 1 year
    browserTTL: 3600, // 1 hour
    staleWhileRevalidate: 86400,
    staleIfError: 604800, // 7 days
  },

  // Asset patterns and their cache settings
  assetPatterns: {
    // Immutable assets (hashed filenames)
    immutable: {
      pattern: /\\.[a-f0-9]{8,}\\.(js|css|woff2?|ttf|eot)$/,
      ttl: 31536000,
      immutable: true,
    },
    // Images
    images: {
      pattern: /\\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/,
      ttl: 2592000, // 30 days
      transform: true,
    },
    // HTML pages
    html: {
      pattern: /\\.(html?)$/,
      ttl: 300, // 5 minutes
      revalidate: true,
    },
    // API responses
    api: {
      pattern: /^\\/api\\//,
      ttl: 0,
      private: true,
    },
  },

  // Security headers
  securityHeaders: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  },

  // Performance optimizations
  optimizations: {
    minify: {
      html: true,
      css: true,
      js: true,
    },
    compression: {
      gzip: true,
      brotli: true,
    },
    http2Push: true,
    earlyHints: true,
    imageOptimization: true,
  },

  // Purge settings
  purge: {
    enabled: true,
    paths: ['/'],
    tags: ['static', 'assets', 'pages'],
  },
};

export const assetConfig: AssetConfig = {
  // Base paths
  publicPath: process.env.PUBLIC_PATH || '/',
  assetsDir: 'assets',
  imagesDir: 'images',

  // File handling
  hashLength: 8,
  inlineLimit: 4096, // 4KB

  // Image settings
  images: {
    quality: 80,
    formats: ['webp', 'avif'],
    sizes: [320, 640, 768, 1024, 1280, 1920],
    placeholder: 'blur',
    lazyLoad: true,
  },

  // Font settings
  fonts: {
    preload: true,
    display: 'swap',
    subsets: ['latin'],
  },
};

export function getCDNUrl(path: string, type: 'assets' | 'images' | 'static' = 'assets'): string {
  const domain = cdnConfig.domains[type];
  const cleanPath = path.startsWith('/') ? path : \`/\${path}\`;
  return \`https://\${domain}\${cleanPath}\`;
}

export function getAssetHash(content: Buffer | string): string {
  const crypto = require('crypto');
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex')
    .slice(0, assetConfig.hashLength);
}

export default cdnConfig;
`;
  }

  protected generateAssetOptimizer(): string {
    return `import * as fs from 'fs';
import * as path from 'path';
import { assetConfig, getAssetHash } from './cdn.config';

interface OptimizedAsset {
  originalPath: string;
  optimizedPath: string;
  hash: string;
  size: number;
  savings: number;
}

interface OptimizationResult {
  assets: OptimizedAsset[];
  totalOriginalSize: number;
  totalOptimizedSize: number;
  totalSavings: number;
  optimizationRate: number;
}

/**
 * Asset Optimizer for CDN deployment
 */
export class AssetOptimizer {
  private outputDir: string;
  private manifestPath: string;
  private manifest: Record<string, string> = {};

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    this.manifestPath = path.join(outputDir, 'asset-manifest.json');
  }

  /**
   * Optimize all assets in the output directory
   */
  async optimizeAll(): Promise<OptimizationResult> {
    const assets: OptimizedAsset[] = [];
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;

    // Find all assets
    const files = this.findAssets(this.outputDir);

    for (const file of files) {
      const result = await this.optimizeAsset(file);
      if (result) {
        assets.push(result);
        totalOriginalSize += result.size + result.savings;
        totalOptimizedSize += result.size;
      }
    }

    // Generate manifest
    this.generateManifest(assets);

    const totalSavings = totalOriginalSize - totalOptimizedSize;
    const optimizationRate = totalOriginalSize > 0
      ? (totalSavings / totalOriginalSize) * 100
      : 0;

    return {
      assets,
      totalOriginalSize,
      totalOptimizedSize,
      totalSavings,
      optimizationRate,
    };
  }

  /**
   * Optimize a single asset
   */
  private async optimizeAsset(filePath: string): Promise<OptimizedAsset | null> {
    const ext = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath);
    const originalSize = content.length;

    let optimizedContent: Buffer;
    let savings = 0;

    switch (ext) {
      case '.js':
        optimizedContent = await this.minifyJS(content);
        break;
      case '.css':
        optimizedContent = await this.minifyCSS(content);
        break;
      case '.html':
        optimizedContent = await this.minifyHTML(content);
        break;
      case '.json':
        optimizedContent = this.minifyJSON(content);
        break;
      case '.svg':
        optimizedContent = await this.optimizeSVG(content);
        break;
      default:
        return null;
    }

    savings = originalSize - optimizedContent.length;

    // Only save if we achieved savings
    if (savings > 0) {
      fs.writeFileSync(filePath, optimizedContent);
    }

    // Generate hash for cache busting
    const hash = getAssetHash(optimizedContent);
    const hashedPath = this.addHashToPath(filePath, hash);

    // Rename file with hash
    if (this.shouldHashFile(filePath)) {
      fs.renameSync(filePath, hashedPath);
    }

    return {
      originalPath: filePath,
      optimizedPath: hashedPath,
      hash,
      size: optimizedContent.length,
      savings: Math.max(0, savings),
    };
  }

  /**
   * Minify JavaScript
   */
  private async minifyJS(content: Buffer): Promise<Buffer> {
    try {
      const terser = await import('terser');
      const result = await terser.minify(content.toString(), {
        compress: {
          drop_console: process.env.NODE_ENV === 'production',
          drop_debugger: true,
          passes: 2,
        },
        mangle: true,
        format: {
          comments: false,
        },
      });
      return Buffer.from(result.code || content.toString());
    } catch {
      return content;
    }
  }

  /**
   * Minify CSS
   */
  private async minifyCSS(content: Buffer): Promise<Buffer> {
    try {
      const cssnano = await import('cssnano');
      const postcss = await import('postcss');
      const result = await postcss.default([cssnano.default()]).process(content.toString(), {
        from: undefined,
      });
      return Buffer.from(result.css);
    } catch {
      return content;
    }
  }

  /**
   * Minify HTML
   */
  private async minifyHTML(content: Buffer): Promise<Buffer> {
    try {
      const htmlMinifier = await import('html-minifier-terser');
      const result = await htmlMinifier.minify(content.toString(), {
        collapseWhitespace: true,
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        useShortDoctype: true,
        minifyCSS: true,
        minifyJS: true,
      });
      return Buffer.from(result);
    } catch {
      return content;
    }
  }

  /**
   * Minify JSON
   */
  private minifyJSON(content: Buffer): Buffer {
    try {
      const parsed = JSON.parse(content.toString());
      return Buffer.from(JSON.stringify(parsed));
    } catch {
      return content;
    }
  }

  /**
   * Optimize SVG
   */
  private async optimizeSVG(content: Buffer): Promise<Buffer> {
    try {
      const { optimize } = await import('svgo');
      const result = optimize(content.toString(), {
        multipass: true,
        plugins: [
          'preset-default',
          'removeDimensions',
          {
            name: 'removeAttrs',
            params: { attrs: '(stroke|fill)' },
          },
        ],
      });
      return Buffer.from(result.data);
    } catch {
      return content;
    }
  }

  /**
   * Find all optimizable assets
   */
  private findAssets(dir: string, files: string[] = []): string[] {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.findAssets(fullPath, files);
      } else if (this.isOptimizableAsset(fullPath)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Check if file should be optimized
   */
  private isOptimizableAsset(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const optimizableExtensions = ['.js', '.css', '.html', '.json', '.svg'];
    return optimizableExtensions.includes(ext);
  }

  /**
   * Check if file should have hash added
   */
  private shouldHashFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const hashableExtensions = ['.js', '.css'];
    const filename = path.basename(filePath);

    // Don't hash entry files or files that already have hashes
    if (filename.includes('.') && /\\.[a-f0-9]{8,}\\./.test(filename)) {
      return false;
    }

    return hashableExtensions.includes(ext);
  }

  /**
   * Add hash to file path
   */
  private addHashToPath(filePath: string, hash: string): string {
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    return path.join(dir, \`\${base}.\${hash}\${ext}\`);
  }

  /**
   * Generate asset manifest
   */
  private generateManifest(assets: OptimizedAsset[]): void {
    for (const asset of assets) {
      const relativePath = path.relative(this.outputDir, asset.originalPath);
      const relativeOptimizedPath = path.relative(this.outputDir, asset.optimizedPath);
      this.manifest[relativePath] = relativeOptimizedPath;
    }

    fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }

  /**
   * Get the manifest
   */
  getManifest(): Record<string, string> {
    if (fs.existsSync(this.manifestPath)) {
      return JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
    }
    return this.manifest;
  }
}

export default AssetOptimizer;
`;
  }

  protected generateImageOptimizer(): string {
    return `import * as fs from 'fs';
import * as path from 'path';
import { assetConfig } from './cdn.config';

interface ImageVariant {
  width: number;
  format: 'webp' | 'avif' | 'jpeg' | 'png';
  quality: number;
  path: string;
}

interface OptimizedImage {
  originalPath: string;
  variants: ImageVariant[];
  placeholder?: string;
  dominantColor?: string;
}

/**
 * Image Optimizer for CDN deployment
 */
export class ImageOptimizer {
  private outputDir: string;
  private config = assetConfig.images;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  /**
   * Optimize all images in directory
   */
  async optimizeAll(inputDir: string): Promise<OptimizedImage[]> {
    const images = this.findImages(inputDir);
    const results: OptimizedImage[] = [];

    for (const imagePath of images) {
      const result = await this.optimizeImage(imagePath);
      results.push(result);
    }

    return results;
  }

  /**
   * Optimize a single image
   */
  async optimizeImage(imagePath: string): Promise<OptimizedImage> {
    const sharp = await this.getSharp();
    const image = sharp(imagePath);
    const metadata = await image.metadata();

    const variants: ImageVariant[] = [];
    const basename = path.basename(imagePath, path.extname(imagePath));
    const outputSubDir = path.join(this.outputDir, 'images', 'optimized');

    // Ensure output directory exists
    fs.mkdirSync(outputSubDir, { recursive: true });

    // Generate responsive variants
    for (const width of this.config.sizes) {
      if (width > (metadata.width || 0)) continue;

      for (const format of this.config.formats as ('webp' | 'avif')[]) {
        const outputPath = path.join(
          outputSubDir,
          \`\${basename}-\${width}.\${format}\`
        );

        await image
          .clone()
          .resize(width)
          .toFormat(format, { quality: this.config.quality })
          .toFile(outputPath);

        variants.push({
          width,
          format,
          quality: this.config.quality,
          path: outputPath,
        });
      }
    }

    // Generate placeholder
    let placeholder: string | undefined;
    if (this.config.placeholder === 'blur') {
      const placeholderBuffer = await image
        .clone()
        .resize(20)
        .blur(10)
        .toBuffer();
      placeholder = \`data:image/jpeg;base64,\${placeholderBuffer.toString('base64')}\`;
    }

    // Get dominant color
    const { dominant } = await image.stats();
    const dominantColor = \`rgb(\${dominant.r}, \${dominant.g}, \${dominant.b})\`;

    return {
      originalPath: imagePath,
      variants,
      placeholder,
      dominantColor,
    };
  }

  /**
   * Generate srcset string for responsive images
   */
  generateSrcSet(variants: ImageVariant[]): Record<string, string> {
    const srcSets: Record<string, string> = {};

    const formatGroups = variants.reduce((acc, v) => {
      if (!acc[v.format]) acc[v.format] = [];
      acc[v.format].push(v);
      return acc;
    }, {} as Record<string, ImageVariant[]>);

    for (const [format, images] of Object.entries(formatGroups)) {
      srcSets[format] = images
        .map((v) => \`\${v.path} \${v.width}w\`)
        .join(', ');
    }

    return srcSets;
  }

  /**
   * Generate picture element HTML
   */
  generatePictureHTML(image: OptimizedImage, alt: string): string {
    const srcSets = this.generateSrcSet(image.variants);
    const fallback = image.variants.find((v) => v.format === 'jpeg') || image.variants[0];

    const sources = Object.entries(srcSets)
      .filter(([format]) => format !== 'jpeg')
      .map(
        ([format, srcset]) =>
          \`<source type="image/\${format}" srcset="\${srcset}" sizes="(max-width: 768px) 100vw, 50vw">\`
      )
      .join('\\n  ');

    return \`<picture>
  \${sources}
  <img
    src="\${fallback.path}"
    srcset="\${srcSets['jpeg'] || ''}"
    sizes="(max-width: 768px) 100vw, 50vw"
    alt="\${alt}"
    loading="lazy"
    decoding="async"
    style="background-color: \${image.dominantColor || '#f0f0f0'}"
  >
</picture>\`;
  }

  /**
   * Find all images in directory
   */
  private findImages(dir: string, images: string[] = []): string[] {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        this.findImages(fullPath, images);
      } else if (this.isImage(fullPath)) {
        images.push(fullPath);
      }
    }

    return images;
  }

  /**
   * Check if file is an image
   */
  private isImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  }

  /**
   * Dynamically import sharp
   */
  private async getSharp() {
    const sharp = await import('sharp');
    return sharp.default;
  }
}

export default ImageOptimizer;
`;
  }

  protected generateCacheManager(): string {
    return `import { cdnConfig } from './cdn.config';
import type { CDNProvider, CacheInvalidation } from './types';

/**
 * CDN Cache Manager
 */
export class CacheManager {
  private provider: CDNProvider;

  constructor(provider?: CDNProvider) {
    this.provider = provider || cdnConfig.provider;
  }

  /**
   * Purge specific URLs from cache
   */
  async purgeUrls(urls: string[]): Promise<CacheInvalidation> {
    const result = await this.getProviderClient().purgeUrls(urls);
    return {
      success: result.success,
      purgedUrls: urls,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Purge by cache tags
   */
  async purgeTags(tags: string[]): Promise<CacheInvalidation> {
    const result = await this.getProviderClient().purgeTags(tags);
    return {
      success: result.success,
      purgedTags: tags,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Purge entire cache
   */
  async purgeAll(): Promise<CacheInvalidation> {
    const result = await this.getProviderClient().purgeAll();
    return {
      success: result.success,
      purgedAll: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Warm cache for specific URLs
   */
  async warmCache(urls: string[]): Promise<void> {
    const fetch = (await import('node-fetch')).default;

    await Promise.all(
      urls.map(async (url) => {
        try {
          await fetch(url, {
            method: 'GET',
            headers: {
              'User-Agent': 'CacheWarmer/1.0',
            },
          });
        } catch (error) {
          console.error(\`Failed to warm cache for \${url}:\`, error);
        }
      })
    );
  }

  /**
   * Get cache headers for a request
   */
  getCacheHeaders(path: string): Record<string, string> {
    const headers: Record<string, string> = {};

    // Find matching pattern
    for (const [, config] of Object.entries(cdnConfig.assetPatterns)) {
      if (config.pattern.test(path)) {
        const ttl = config.ttl;

        if (config.immutable) {
          headers['Cache-Control'] = \`public, max-age=\${ttl}, immutable\`;
        } else if (config.private) {
          headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate';
        } else if (config.revalidate) {
          headers['Cache-Control'] = \`public, max-age=\${ttl}, stale-while-revalidate=\${cdnConfig.cache.staleWhileRevalidate}\`;
        } else {
          headers['Cache-Control'] = \`public, max-age=\${ttl}\`;
        }

        break;
      }
    }

    // Default cache control
    if (!headers['Cache-Control']) {
      headers['Cache-Control'] = \`public, max-age=\${cdnConfig.cache.defaultTTL}\`;
    }

    // Add security headers
    Object.assign(headers, cdnConfig.securityHeaders);

    return headers;
  }

  /**
   * Get provider-specific client
   */
  private getProviderClient() {
    switch (this.provider) {
      case 'cloudflare':
        return require('./providers/cloudflare').default;
      case 'aws-cloudfront':
        return require('./providers/aws-cloudfront').default;
      case 'azure-cdn':
        return require('./providers/azure-cdn').default;
      case 'fastly':
        return require('./providers/fastly').default;
      case 'bunny-cdn':
        return require('./providers/bunny-cdn').default;
      default:
        throw new Error(\`Unsupported CDN provider: \${this.provider}\`);
    }
  }
}

export default CacheManager;
`;
  }

  protected generateCloudflareProvider(): string {
    return `interface CloudflareConfig {
  apiToken: string;
  zoneId: string;
  accountId?: string;
}

interface PurgeResult {
  success: boolean;
  errors?: string[];
}

/**
 * Cloudflare CDN Provider
 */
class CloudflareProvider {
  private config: CloudflareConfig;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor() {
    this.config = {
      apiToken: process.env.CLOUDFLARE_API_TOKEN || '',
      zoneId: process.env.CLOUDFLARE_ZONE_ID || '',
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    };
  }

  /**
   * Purge specific URLs
   */
  async purgeUrls(urls: string[]): Promise<PurgeResult> {
    const response = await this.request(\`/zones/\${this.config.zoneId}/purge_cache\`, {
      method: 'POST',
      body: JSON.stringify({ files: urls }),
    });

    return {
      success: response.success,
      errors: response.errors?.map((e: any) => e.message),
    };
  }

  /**
   * Purge by cache tags
   */
  async purgeTags(tags: string[]): Promise<PurgeResult> {
    const response = await this.request(\`/zones/\${this.config.zoneId}/purge_cache\`, {
      method: 'POST',
      body: JSON.stringify({ tags }),
    });

    return {
      success: response.success,
      errors: response.errors?.map((e: any) => e.message),
    };
  }

  /**
   * Purge everything
   */
  async purgeAll(): Promise<PurgeResult> {
    const response = await this.request(\`/zones/\${this.config.zoneId}/purge_cache\`, {
      method: 'POST',
      body: JSON.stringify({ purge_everything: true }),
    });

    return {
      success: response.success,
      errors: response.errors?.map((e: any) => e.message),
    };
  }

  /**
   * Get zone analytics
   */
  async getAnalytics(since: string, until: string): Promise<any> {
    const response = await this.request(
      \`/zones/\${this.config.zoneId}/analytics/dashboard?since=\${since}&until=\${until}\`
    );

    return response.result;
  }

  /**
   * Create page rule for caching
   */
  async createPageRule(url: string, ttl: number): Promise<any> {
    const response = await this.request(\`/zones/\${this.config.zoneId}/pagerules\`, {
      method: 'POST',
      body: JSON.stringify({
        targets: [{ target: 'url', constraint: { operator: 'matches', value: url } }],
        actions: [
          { id: 'cache_level', value: 'cache_everything' },
          { id: 'edge_cache_ttl', value: ttl },
        ],
        status: 'active',
      }),
    });

    return response.result;
  }

  /**
   * Make API request
   */
  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(\`\${this.baseUrl}\${endpoint}\`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: \`Bearer \${this.config.apiToken}\`,
        ...options.headers,
      },
    });

    return response.json();
  }
}

export default new CloudflareProvider();
`;
  }

  protected generateCloudFrontProvider(): string {
    return `import {
  CloudFrontClient,
  CreateInvalidationCommand,
  GetDistributionCommand,
} from '@aws-sdk/client-cloudfront';

interface CloudFrontConfig {
  distributionId: string;
  region: string;
}

interface PurgeResult {
  success: boolean;
  invalidationId?: string;
  errors?: string[];
}

/**
 * AWS CloudFront CDN Provider
 */
class CloudFrontProvider {
  private client: CloudFrontClient;
  private config: CloudFrontConfig;

  constructor() {
    this.config = {
      distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID || '',
      region: process.env.AWS_REGION || 'us-east-1',
    };

    this.client = new CloudFrontClient({
      region: this.config.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  /**
   * Purge specific URLs
   */
  async purgeUrls(urls: string[]): Promise<PurgeResult> {
    try {
      // Convert URLs to paths
      const paths = urls.map((url) => {
        const urlObj = new URL(url);
        return urlObj.pathname;
      });

      return this.createInvalidation(paths);
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Purge by tags (CloudFront doesn't support tags, purge all matching paths)
   */
  async purgeTags(tags: string[]): Promise<PurgeResult> {
    // CloudFront doesn't have native tag support
    // Implement custom logic based on your tagging scheme
    const paths = tags.map((tag) => \`/\${tag}/*\`);
    return this.createInvalidation(paths);
  }

  /**
   * Purge everything
   */
  async purgeAll(): Promise<PurgeResult> {
    return this.createInvalidation(['/*']);
  }

  /**
   * Create invalidation
   */
  private async createInvalidation(paths: string[]): Promise<PurgeResult> {
    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.config.distributionId,
        InvalidationBatch: {
          CallerReference: \`invalidation-\${Date.now()}\`,
          Paths: {
            Quantity: paths.length,
            Items: paths,
          },
        },
      });

      const response = await this.client.send(command);

      return {
        success: true,
        invalidationId: response.Invalidation?.Id,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Get distribution info
   */
  async getDistributionInfo(): Promise<any> {
    const command = new GetDistributionCommand({
      Id: this.config.distributionId,
    });

    const response = await this.client.send(command);
    return response.Distribution;
  }
}

export default new CloudFrontProvider();
`;
  }

  protected generateAzureCDNProvider(): string {
    return `interface AzureCDNConfig {
  subscriptionId: string;
  resourceGroup: string;
  profileName: string;
  endpointName: string;
}

interface PurgeResult {
  success: boolean;
  errors?: string[];
}

/**
 * Azure CDN Provider
 */
class AzureCDNProvider {
  private config: AzureCDNConfig;
  private baseUrl = 'https://management.azure.com';
  private accessToken?: string;

  constructor() {
    this.config = {
      subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
      resourceGroup: process.env.AZURE_RESOURCE_GROUP || '',
      profileName: process.env.AZURE_CDN_PROFILE || '',
      endpointName: process.env.AZURE_CDN_ENDPOINT || '',
    };
  }

  /**
   * Purge specific URLs
   */
  async purgeUrls(urls: string[]): Promise<PurgeResult> {
    try {
      const paths = urls.map((url) => new URL(url).pathname);
      return this.purgeContent(paths);
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Purge by tags
   */
  async purgeTags(tags: string[]): Promise<PurgeResult> {
    const paths = tags.map((tag) => \`/\${tag}/*\`);
    return this.purgeContent(paths);
  }

  /**
   * Purge everything
   */
  async purgeAll(): Promise<PurgeResult> {
    return this.purgeContent(['/*']);
  }

  /**
   * Purge content from CDN
   */
  private async purgeContent(contentPaths: string[]): Promise<PurgeResult> {
    try {
      await this.ensureAccessToken();

      const fetch = (await import('node-fetch')).default;
      const endpoint = \`\${this.baseUrl}/subscriptions/\${this.config.subscriptionId}/resourceGroups/\${this.config.resourceGroup}/providers/Microsoft.Cdn/profiles/\${this.config.profileName}/endpoints/\${this.config.endpointName}/purge?api-version=2021-06-01\`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${this.accessToken}\`,
        },
        body: JSON.stringify({ contentPaths }),
      });

      return {
        success: response.status === 202,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Get access token
   */
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken) return;

    // Use Azure Identity library in production
    const { DefaultAzureCredential } = await import('@azure/identity');
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken('https://management.azure.com/.default');
    this.accessToken = token?.token;
  }
}

export default new AzureCDNProvider();
`;
  }

  protected generateFastlyProvider(): string {
    return `interface FastlyConfig {
  apiKey: string;
  serviceId: string;
}

interface PurgeResult {
  success: boolean;
  purgeId?: string;
  errors?: string[];
}

/**
 * Fastly CDN Provider
 */
class FastlyProvider {
  private config: FastlyConfig;
  private baseUrl = 'https://api.fastly.com';

  constructor() {
    this.config = {
      apiKey: process.env.FASTLY_API_KEY || '',
      serviceId: process.env.FASTLY_SERVICE_ID || '',
    };
  }

  /**
   * Purge specific URLs
   */
  async purgeUrls(urls: string[]): Promise<PurgeResult> {
    try {
      const results = await Promise.all(
        urls.map((url) => this.purgeUrl(url))
      );

      return {
        success: results.every((r) => r.success),
        errors: results.filter((r) => !r.success).map((r) => r.errors?.[0] || 'Unknown error'),
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Purge single URL
   */
  private async purgeUrl(url: string): Promise<PurgeResult> {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
      method: 'PURGE',
      headers: {
        'Fastly-Key': this.config.apiKey,
      },
    });

    const data = await response.json() as any;

    return {
      success: response.ok,
      purgeId: data.id,
    };
  }

  /**
   * Purge by surrogate key (tag)
   */
  async purgeTags(tags: string[]): Promise<PurgeResult> {
    const fetch = (await import('node-fetch')).default;

    try {
      const response = await fetch(
        \`\${this.baseUrl}/service/\${this.config.serviceId}/purge\`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Fastly-Key': this.config.apiKey,
          },
          body: JSON.stringify({ surrogate_keys: tags }),
        }
      );

      return {
        success: response.ok,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Purge all
   */
  async purgeAll(): Promise<PurgeResult> {
    const fetch = (await import('node-fetch')).default;

    try {
      const response = await fetch(
        \`\${this.baseUrl}/service/\${this.config.serviceId}/purge_all\`,
        {
          method: 'POST',
          headers: {
            'Fastly-Key': this.config.apiKey,
          },
        }
      );

      return {
        success: response.ok,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Soft purge (stale-while-revalidate)
   */
  async softPurge(url: string): Promise<PurgeResult> {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(url, {
      method: 'PURGE',
      headers: {
        'Fastly-Key': this.config.apiKey,
        'Fastly-Soft-Purge': '1',
      },
    });

    return {
      success: response.ok,
    };
  }
}

export default new FastlyProvider();
`;
  }

  protected generateBunnyCDNProvider(): string {
    return `interface BunnyCDNConfig {
  apiKey: string;
  pullZoneId: string;
  storageZoneName?: string;
  storageApiKey?: string;
}

interface PurgeResult {
  success: boolean;
  errors?: string[];
}

/**
 * Bunny CDN Provider
 */
class BunnyCDNProvider {
  private config: BunnyCDNConfig;
  private baseUrl = 'https://api.bunny.net';

  constructor() {
    this.config = {
      apiKey: process.env.BUNNY_API_KEY || '',
      pullZoneId: process.env.BUNNY_PULL_ZONE_ID || '',
      storageZoneName: process.env.BUNNY_STORAGE_ZONE,
      storageApiKey: process.env.BUNNY_STORAGE_API_KEY,
    };
  }

  /**
   * Purge specific URLs
   */
  async purgeUrls(urls: string[]): Promise<PurgeResult> {
    const fetch = (await import('node-fetch')).default;

    try {
      const results = await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(
            \`\${this.baseUrl}/purge?url=\${encodeURIComponent(url)}\`,
            {
              method: 'POST',
              headers: {
                AccessKey: this.config.apiKey,
              },
            }
          );
          return response.ok;
        })
      );

      return {
        success: results.every((r) => r),
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Purge by tags (Bunny uses URL patterns)
   */
  async purgeTags(tags: string[]): Promise<PurgeResult> {
    const urls = tags.map((tag) => \`https://*.b-cdn.net/\${tag}/*\`);
    return this.purgeUrls(urls);
  }

  /**
   * Purge entire pull zone
   */
  async purgeAll(): Promise<PurgeResult> {
    const fetch = (await import('node-fetch')).default;

    try {
      const response = await fetch(
        \`\${this.baseUrl}/pullzone/\${this.config.pullZoneId}/purgeCache\`,
        {
          method: 'POST',
          headers: {
            AccessKey: this.config.apiKey,
          },
        }
      );

      return {
        success: response.ok,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Upload file to storage zone
   */
  async uploadFile(path: string, content: Buffer): Promise<boolean> {
    if (!this.config.storageZoneName || !this.config.storageApiKey) {
      throw new Error('Storage zone not configured');
    }

    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      \`https://storage.bunnycdn.com/\${this.config.storageZoneName}/\${path}\`,
      {
        method: 'PUT',
        headers: {
          AccessKey: this.config.storageApiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: content,
      }
    );

    return response.ok;
  }

  /**
   * Get pull zone statistics
   */
  async getStatistics(dateFrom: string, dateTo: string): Promise<any> {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(
      \`\${this.baseUrl}/statistics?dateFrom=\${dateFrom}&dateTo=\${dateTo}&pullZone=\${this.config.pullZoneId}\`,
      {
        headers: {
          AccessKey: this.config.apiKey,
        },
      }
    );

    return response.json();
  }
}

export default new BunnyCDNProvider();
`;
  }

  protected generateViteCDNPlugin(): string {
    return `import type { Plugin } from 'vite';
import { cdnConfig, getCDNUrl } from '../cdn.config';

interface ViteCDNPluginOptions {
  enabled?: boolean;
  cdnDomain?: string;
  exclude?: RegExp[];
  addHash?: boolean;
}

/**
 * Vite plugin for CDN integration
 */
export function viteCDNPlugin(options: ViteCDNPluginOptions = {}): Plugin {
  const {
    enabled = process.env.NODE_ENV === 'production',
    cdnDomain = cdnConfig.domains.assets,
    exclude = [/\\.html$/],
    addHash = true,
  } = options;

  return {
    name: 'vite-cdn-plugin',
    apply: 'build',

    config(config) {
      if (!enabled) return;

      return {
        build: {
          assetsDir: 'assets',
          assetsInlineLimit: 4096,
          rollupOptions: {
            output: {
              assetFileNames: addHash
                ? 'assets/[name]-[hash][extname]'
                : 'assets/[name][extname]',
              chunkFileNames: addHash
                ? 'chunks/[name]-[hash].js'
                : 'chunks/[name].js',
              entryFileNames: addHash
                ? 'entries/[name]-[hash].js'
                : 'entries/[name].js',
            },
          },
        },
        experimental: {
          renderBuiltUrl(filename, { type }) {
            if (exclude.some((re) => re.test(filename))) {
              return filename;
            }

            if (type === 'asset' || type === 'public') {
              return \`https://\${cdnDomain}/\${filename}\`;
            }

            return filename;
          },
        },
      };
    },

    generateBundle(_, bundle) {
      if (!enabled) return;

      // Add cache headers comment to chunks
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.code) {
          const cacheControl = addHash
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=86400';

          chunk.code = \`/* Cache-Control: \${cacheControl} */\\n\${chunk.code}\`;
        }
      }
    },

    transformIndexHtml(html) {
      if (!enabled) return html;

      // Add preconnect hints
      const preconnectHint = \`<link rel="preconnect" href="https://\${cdnDomain}" crossorigin>\\n\`;
      const dnsPrefetch = \`<link rel="dns-prefetch" href="https://\${cdnDomain}">\\n\`;

      return html.replace(
        '<head>',
        \`<head>\\n\${preconnectHint}\${dnsPrefetch}\`
      );
    },
  };
}

export default viteCDNPlugin;
`;
  }

  protected generateWebpackCDNPlugin(): string {
    return `import type { Compiler, Compilation } from 'webpack';
import { cdnConfig } from '../cdn.config';

interface WebpackCDNPluginOptions {
  enabled?: boolean;
  cdnDomain?: string;
  exclude?: RegExp[];
  crossOrigin?: 'anonymous' | 'use-credentials';
}

/**
 * Webpack plugin for CDN integration
 */
export class WebpackCDNPlugin {
  private options: WebpackCDNPluginOptions;

  constructor(options: WebpackCDNPluginOptions = {}) {
    this.options = {
      enabled: process.env.NODE_ENV === 'production',
      cdnDomain: cdnConfig.domains.assets,
      exclude: [/\\.html$/],
      crossOrigin: 'anonymous',
      ...options,
    };
  }

  apply(compiler: Compiler): void {
    if (!this.options.enabled) return;

    // Set public path
    compiler.options.output = {
      ...compiler.options.output,
      publicPath: \`https://\${this.options.cdnDomain}/\`,
      crossOriginLoading: this.options.crossOrigin,
    };

    // Add asset hashing
    compiler.options.output.filename = '[name].[contenthash:8].js';
    compiler.options.output.chunkFilename = '[name].[contenthash:8].chunk.js';

    // Hook into compilation
    compiler.hooks.compilation.tap('WebpackCDNPlugin', (compilation: Compilation) => {
      // Process assets
      compilation.hooks.processAssets.tap(
        {
          name: 'WebpackCDNPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        () => {
          // Add CDN headers info to assets
          for (const [name, asset] of Object.entries(compilation.assets)) {
            if (this.shouldProcess(name)) {
              const cacheControl = this.getCacheControl(name);
              asset.info = {
                ...asset.info,
                cacheControl,
              };
            }
          }
        }
      );
    });

    // Modify HTML output
    compiler.hooks.emit.tap('WebpackCDNPlugin', (compilation: Compilation) => {
      for (const [name, asset] of Object.entries(compilation.assets)) {
        if (name.endsWith('.html')) {
          const content = asset.source().toString();
          const modified = this.processHTML(content);
          compilation.assets[name] = {
            source: () => modified,
            size: () => modified.length,
          } as any;
        }
      }
    });
  }

  private shouldProcess(filename: string): boolean {
    return !this.options.exclude?.some((re) => re.test(filename));
  }

  private getCacheControl(filename: string): string {
    if (/\\.[a-f0-9]{8,}\\./.test(filename)) {
      return 'public, max-age=31536000, immutable';
    }
    return 'public, max-age=86400';
  }

  private processHTML(html: string): string {
    const preconnect = \`<link rel="preconnect" href="https://\${this.options.cdnDomain}" crossorigin="anonymous">\`;
    const dnsPrefetch = \`<link rel="dns-prefetch" href="https://\${this.options.cdnDomain}">\`;

    return html.replace('<head>', \`<head>\\n  \${preconnect}\\n  \${dnsPrefetch}\`);
  }
}

export default WebpackCDNPlugin;
`;
  }

  protected generateServiceWorker(): string {
    return `/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

// Clean old caches
cleanupOutdatedCaches();

// Precache static assets
precacheAndRoute(self.__WB_MANIFEST || []);

// Cache strategies

// Static assets (CSS, JS, fonts) - Cache First
registerRoute(
  ({ request }) =>
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font',
  new CacheFirst({
    cacheName: 'static-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// Images - Cache First with fallback
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// API requests - Network First
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 10,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 5, // 5 minutes
      }),
    ],
  })
);

// HTML pages - Network First
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  })
);

// CDN assets - Stale While Revalidate
registerRoute(
  ({ url }) =>
    url.hostname.includes('cdn') ||
    url.hostname.includes('cloudflare') ||
    url.hostname.includes('b-cdn'),
  new StaleWhileRevalidate({
    cacheName: 'cdn-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      }),
    ],
  })
);

// Default handler - Network First
setDefaultHandler(
  new NetworkFirst({
    cacheName: 'default',
    networkTimeoutSeconds: 10,
  })
);

// Fallback for offline
setCatchHandler(async ({ event }) => {
  if (event.request.destination === 'document') {
    return caches.match('/offline.html') || Response.error();
  }
  return Response.error();
});

// Handle messages
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
`;
  }

  protected generateWorkboxConfig(): string {
    return `import type { GenerateSWOptions } from 'workbox-build';

const workboxConfig: GenerateSWOptions = {
  swDest: 'dist/sw.js',
  globDirectory: 'dist',
  globPatterns: [
    '**/*.{js,css,html,ico,png,svg,woff,woff2}',
  ],
  globIgnores: [
    '**/node_modules/**/*',
    '**/sw.js',
    '**/workbox-*.js',
  ],

  // Runtime caching
  runtimeCaching: [
    {
      urlPattern: /\\.(?:png|jpg|jpeg|svg|gif|webp|avif)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      urlPattern: /\\.(?:js|css)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources',
      },
    },
    {
      urlPattern: /^https:\\/\\/fonts\\.googleapis\\.com/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'google-fonts-stylesheets',
      },
    },
    {
      urlPattern: /^https:\\/\\/fonts\\.gstatic\\.com/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts-webfonts',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /\\/api\\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ],

  // Skip waiting and claim clients
  skipWaiting: true,
  clientsClaim: true,

  // Precache manifest
  mode: 'production',

  // Navigtion fallback
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [
    /^\\/api/,
    /\\.[a-z]+$/i,
  ],
};

export default workboxConfig;
`;
  }

  protected generateDeployScript(): string {
    return `#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { cdnConfig } from '../cdn.config';
import { AssetOptimizer } from '../asset-optimizer';
import { ImageOptimizer } from '../image-optimizer';
import { CacheManager } from '../cache-manager';

interface DeployOptions {
  distDir: string;
  provider?: string;
  dryRun?: boolean;
  purgeCache?: boolean;
  warmCache?: boolean;
}

async function deploy(options: DeployOptions): Promise<void> {
  const {
    distDir,
    provider = cdnConfig.provider,
    dryRun = false,
    purgeCache = true,
    warmCache = false,
  } = options;

  console.log('🚀 Starting CDN deployment...');
  console.log(\`   Provider: \${provider}\`);
  console.log(\`   Source: \${distDir}\`);
  console.log(\`   Dry run: \${dryRun}\`);

  // Validate dist directory
  if (!fs.existsSync(distDir)) {
    throw new Error(\`Distribution directory not found: \${distDir}\`);
  }

  // Step 1: Optimize assets
  console.log('\\n📦 Optimizing assets...');
  const assetOptimizer = new AssetOptimizer(distDir);
  const assetResult = await assetOptimizer.optimizeAll();
  console.log(\`   Processed \${assetResult.assets.length} assets\`);
  console.log(\`   Total savings: \${formatBytes(assetResult.totalSavings)} (\${assetResult.optimizationRate.toFixed(1)}%)\`);

  // Step 2: Optimize images
  console.log('\\n🖼️  Optimizing images...');
  const imageOptimizer = new ImageOptimizer(distDir);
  const imagesDir = path.join(distDir, 'images');
  if (fs.existsSync(imagesDir)) {
    const imageResult = await imageOptimizer.optimizeAll(imagesDir);
    console.log(\`   Generated \${imageResult.reduce((sum, img) => sum + img.variants.length, 0)} image variants\`);
  }

  // Step 3: Generate manifest
  console.log('\\n📋 Generating manifest...');
  const manifest = assetOptimizer.getManifest();
  console.log(\`   Manifest entries: \${Object.keys(manifest).length}\`);

  if (dryRun) {
    console.log('\\n⚠️  Dry run - skipping upload and cache operations');
    return;
  }

  // Step 4: Upload to CDN
  console.log('\\n⬆️  Uploading to CDN...');
  await uploadToCDN(distDir, provider);
  console.log('   Upload complete');

  // Step 5: Purge cache
  if (purgeCache) {
    console.log('\\n🗑️  Purging cache...');
    const cacheManager = new CacheManager(provider as any);
    const purgeResult = await cacheManager.purgeAll();
    console.log(\`   Cache purged: \${purgeResult.success}\`);
  }

  // Step 6: Warm cache
  if (warmCache) {
    console.log('\\n🔥 Warming cache...');
    const cacheManager = new CacheManager(provider as any);
    const urls = generateWarmUrls(distDir);
    await cacheManager.warmCache(urls);
    console.log(\`   Warmed \${urls.length} URLs\`);
  }

  console.log('\\n✅ Deployment complete!');
}

async function uploadToCDN(distDir: string, provider: string): Promise<void> {
  // Implementation depends on provider
  switch (provider) {
    case 'bunny-cdn':
      await uploadToBunny(distDir);
      break;
    case 'aws-cloudfront':
      await uploadToS3(distDir);
      break;
    default:
      // For edge providers like Cloudflare, deployment is usually via CI/CD
      console.log('   Using CI/CD deployment for this provider');
  }
}

async function uploadToBunny(distDir: string): Promise<void> {
  const bunnyProvider = (await import('../providers/bunny-cdn')).default;
  const files = getAllFiles(distDir);

  for (const file of files) {
    const relativePath = path.relative(distDir, file);
    const content = fs.readFileSync(file);
    await bunnyProvider.uploadFile(relativePath, content);
  }
}

async function uploadToS3(distDir: string): Promise<void> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({ region: process.env.AWS_REGION });
  const bucket = process.env.AWS_S3_BUCKET!;

  const files = getAllFiles(distDir);

  for (const file of files) {
    const relativePath = path.relative(distDir, file);
    const content = fs.readFileSync(file);
    const contentType = getContentType(file);

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: relativePath,
        Body: content,
        ContentType: contentType,
        CacheControl: getCacheControl(file),
      })
    );
  }
}

function getAllFiles(dir: string, files: string[] = []): string[] {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, files);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function generateWarmUrls(distDir: string): string[] {
  const baseUrl = cdnConfig.origins.primary;
  const manifest = JSON.parse(
    fs.readFileSync(path.join(distDir, 'asset-manifest.json'), 'utf-8')
  );

  return Object.values(manifest).map((file) => \`\${baseUrl}/\${file}\`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return \`\${(bytes / Math.pow(k, i)).toFixed(2)} \${sizes[i]}\`;
}

function getContentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
  };
  return types[ext] || 'application/octet-stream';
}

function getCacheControl(file: string): string {
  if (/\\.[a-f0-9]{8,}\\./.test(file)) {
    return 'public, max-age=31536000, immutable';
  }
  if (file.endsWith('.html')) {
    return 'public, max-age=300, stale-while-revalidate=86400';
  }
  return 'public, max-age=86400';
}

// CLI
const args = process.argv.slice(2);
const options: DeployOptions = {
  distDir: args[0] || './dist',
  provider: args[1] || undefined,
  dryRun: args.includes('--dry-run'),
  purgeCache: !args.includes('--no-purge'),
  warmCache: args.includes('--warm'),
};

deploy(options).catch((error) => {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
});
`;
  }

  protected generateCacheInvalidationScript(): string {
    return `#!/usr/bin/env ts-node

import { CacheManager } from '../cache-manager';
import { cdnConfig } from '../cdn.config';

interface InvalidateOptions {
  urls?: string[];
  tags?: string[];
  all?: boolean;
  provider?: string;
}

async function invalidateCache(options: InvalidateOptions): Promise<void> {
  const { urls, tags, all, provider = cdnConfig.provider } = options;

  const cacheManager = new CacheManager(provider as any);

  console.log('🗑️  Cache Invalidation');
  console.log(\`   Provider: \${provider}\`);

  if (all) {
    console.log('   Invalidating all cache...');
    const result = await cacheManager.purgeAll();
    console.log(\`   Success: \${result.success}\`);
  } else if (urls && urls.length > 0) {
    console.log(\`   Invalidating \${urls.length} URLs...\`);
    const result = await cacheManager.purgeUrls(urls);
    console.log(\`   Success: \${result.success}\`);
  } else if (tags && tags.length > 0) {
    console.log(\`   Invalidating tags: \${tags.join(', ')}\`);
    const result = await cacheManager.purgeTags(tags);
    console.log(\`   Success: \${result.success}\`);
  } else {
    console.log('   No invalidation target specified');
    console.log('   Use --all, --urls <url1,url2>, or --tags <tag1,tag2>');
  }
}

// CLI
const args = process.argv.slice(2);
const options: InvalidateOptions = {
  all: args.includes('--all'),
  provider: undefined,
};

// Parse URLs
const urlsIndex = args.indexOf('--urls');
if (urlsIndex !== -1 && args[urlsIndex + 1]) {
  options.urls = args[urlsIndex + 1].split(',');
}

// Parse tags
const tagsIndex = args.indexOf('--tags');
if (tagsIndex !== -1 && args[tagsIndex + 1]) {
  options.tags = args[tagsIndex + 1].split(',');
}

// Parse provider
const providerIndex = args.indexOf('--provider');
if (providerIndex !== -1 && args[providerIndex + 1]) {
  options.provider = args[providerIndex + 1];
}

invalidateCache(options).catch((error) => {
  console.error('❌ Invalidation failed:', error.message);
  process.exit(1);
});
`;
  }

  protected generateCloudflareTerraform(): string {
    return `# Cloudflare CDN Infrastructure

terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token"
  sensitive   = true
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID"
}

variable "origin_server" {
  type        = string
  description = "Origin server URL"
}

# Cache rules
resource "cloudflare_ruleset" "cache_rules" {
  zone_id     = var.cloudflare_zone_id
  name        = "Cache rules for ${this.context.name}"
  description = "Cache rules for static assets"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 31536000
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
    }
    expression  = "(http.request.uri.path.extension in {\\"js\\" \\"css\\" \\"woff\\" \\"woff2\\"})"
    description = "Cache immutable assets for 1 year"
  }

  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 2592000
      }
    }
    expression  = "(http.request.uri.path.extension in {\\"jpg\\" \\"jpeg\\" \\"png\\" \\"gif\\" \\"webp\\" \\"avif\\" \\"svg\\"})"
    description = "Cache images for 30 days"
  }

  rules {
    action = "set_cache_settings"
    action_parameters {
      cache = false
    }
    expression  = "starts_with(http.request.uri.path, \\"/api/\\")"
    description = "Don't cache API responses"
  }
}

# Page rules for redirects
resource "cloudflare_page_rule" "redirect_www" {
  zone_id  = var.cloudflare_zone_id
  target   = "www.\${var.domain}/*"
  priority = 1

  actions {
    forwarding_url {
      url         = "https://\${var.domain}/$1"
      status_code = 301
    }
  }
}

# Workers for edge computing
resource "cloudflare_worker_script" "cdn_worker" {
  account_id = var.cloudflare_account_id
  name       = "${this.context.normalizedName}-cdn-worker"
  content    = file("\${path.module}/worker.js")
}

# Output
output "cdn_domain" {
  value = var.domain
}
`;
  }

  protected generateCloudFrontTerraform(): string {
    return `# AWS CloudFront CDN Infrastructure

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "domain_name" {
  type        = string
  description = "Domain name for CloudFront"
}

variable "s3_bucket_name" {
  type        = string
  description = "S3 bucket for static assets"
}

# S3 bucket for static assets
resource "aws_s3_bucket" "static_assets" {
  bucket = var.s3_bucket_name

  tags = {
    Name        = "${this.context.name} Static Assets"
    Environment = "production"
  }
}

resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for ${this.context.name}"
}

# S3 bucket policy for CloudFront
resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.oai.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "\${aws_s3_bucket.static_assets.arn}/*"
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${this.context.name} CDN"
  default_root_object = "index.html"
  price_class         = "PriceClass_All"

  aliases = [var.domain_name]

  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "S3-\${var.s3_bucket_name}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-\${var.s3_bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id            = aws_cloudfront_cache_policy.assets.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.cors.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # Cache behavior for immutable assets
  ordered_cache_behavior {
    path_pattern           = "/assets/*"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-\${var.s3_bucket_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = aws_cloudfront_cache_policy.immutable.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = {
    Name        = "${this.context.name} CDN"
    Environment = "production"
  }
}

# Cache policy for general assets
resource "aws_cloudfront_cache_policy" "assets" {
  name        = "${this.context.normalizedName}-assets-policy"
  comment     = "Cache policy for general assets"
  default_ttl = 86400
  max_ttl     = 31536000
  min_ttl     = 1

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Cache policy for immutable assets
resource "aws_cloudfront_cache_policy" "immutable" {
  name        = "${this.context.normalizedName}-immutable-policy"
  comment     = "Cache policy for immutable assets"
  default_ttl = 31536000
  max_ttl     = 31536000
  min_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# CORS origin request policy
resource "aws_cloudfront_origin_request_policy" "cors" {
  name    = "${this.context.normalizedName}-cors-policy"
  comment = "CORS headers policy"

  cookies_config {
    cookie_behavior = "none"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
    }
  }
  query_strings_config {
    query_string_behavior = "none"
  }
}

# Security headers policy
resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${this.context.normalizedName}-security-headers"
  comment = "Security headers policy"

  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "SAMEORIGIN"
      override     = true
    }
    xss_protection {
      mode_block = true
      override   = true
      protection = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }

  cors_config {
    access_control_allow_credentials = false
    access_control_allow_headers {
      items = ["*"]
    }
    access_control_allow_methods {
      items = ["GET", "HEAD", "OPTIONS"]
    }
    access_control_allow_origins {
      items = ["*"]
    }
    origin_override = true
  }
}

# Outputs
output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.cdn.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.cdn.domain_name
}

output "s3_bucket_name" {
  value = aws_s3_bucket.static_assets.id
}
`;
  }

  protected generateTypes(): string {
    return `export type CDNProvider =
  | 'cloudflare'
  | 'aws-cloudfront'
  | 'azure-cdn'
  | 'fastly'
  | 'bunny-cdn'
  | 'akamai'
  | 'google-cloud-cdn';

export interface CDNConfig {
  provider: CDNProvider;
  domains: {
    assets: string;
    images: string;
    static: string;
  };
  origins: {
    primary: string;
    fallback?: string;
  };
  cache: CacheConfig;
  assetPatterns: Record<string, AssetPattern>;
  securityHeaders: Record<string, string>;
  optimizations: OptimizationConfig;
  purge: PurgeConfig;
}

export interface CacheConfig {
  defaultTTL: number;
  maxTTL: number;
  browserTTL: number;
  staleWhileRevalidate: number;
  staleIfError: number;
}

export interface AssetPattern {
  pattern: RegExp;
  ttl: number;
  immutable?: boolean;
  transform?: boolean;
  revalidate?: boolean;
  private?: boolean;
}

export interface OptimizationConfig {
  minify: {
    html: boolean;
    css: boolean;
    js: boolean;
  };
  compression: {
    gzip: boolean;
    brotli: boolean;
  };
  http2Push: boolean;
  earlyHints: boolean;
  imageOptimization: boolean;
}

export interface PurgeConfig {
  enabled: boolean;
  paths: string[];
  tags: string[];
}

export interface AssetConfig {
  publicPath: string;
  assetsDir: string;
  imagesDir: string;
  hashLength: number;
  inlineLimit: number;
  images: ImageConfig;
  fonts: FontConfig;
}

export interface ImageConfig {
  quality: number;
  formats: string[];
  sizes: number[];
  placeholder: 'blur' | 'dominant-color' | 'none';
  lazyLoad: boolean;
}

export interface FontConfig {
  preload: boolean;
  display: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  subsets: string[];
}

export interface CacheInvalidation {
  success: boolean;
  purgedUrls?: string[];
  purgedTags?: string[];
  purgedAll?: boolean;
  timestamp: string;
  errors?: string[];
}
`;
  }

  protected generateReadme(): string {
    return `# CDN Integration for ${this.context.name}

This module provides CDN integration and static asset optimization for microfrontend applications.

## Features

- Multi-CDN provider support (Cloudflare, AWS CloudFront, Azure CDN, Fastly, Bunny CDN)
- Asset optimization (minification, compression, image optimization)
- Service worker for offline caching
- Cache management and invalidation
- Terraform infrastructure as code
- Build tool plugins (Vite, Webpack)

## Quick Start

\`\`\`bash
# Install dependencies
npm install

# Configure CDN provider
cp .env.example .env
# Edit .env with your CDN credentials

# Build and deploy
npm run build
npm run deploy
\`\`\`

## Configuration

### Environment Variables

\`\`\`env
# CDN Provider
CDN_PROVIDER=cloudflare

# Domain Configuration
CDN_ASSETS_DOMAIN=assets.example.com
CDN_IMAGES_DOMAIN=images.example.com

# Provider-specific credentials
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ZONE_ID=your_zone_id
\`\`\`

### CDN Configuration

Edit \`cdn.config.ts\` to customize:

- Cache TTLs
- Asset patterns
- Security headers
- Optimization settings

## Asset Optimization

### JavaScript & CSS

Automatically minified with:
- Terser for JavaScript
- cssnano for CSS
- Content hashing for cache busting

### Images

Optimized with Sharp:
- WebP and AVIF format generation
- Responsive image sizes
- Blur placeholders
- Lazy loading support

## Cache Management

### Purge Cache

\`\`\`bash
# Purge all
npm run cache:purge -- --all

# Purge specific URLs
npm run cache:purge -- --urls https://example.com/page1,https://example.com/page2

# Purge by tags
npm run cache:purge -- --tags static,assets
\`\`\`

### Cache Warming

\`\`\`bash
npm run deploy -- --warm
\`\`\`

## Service Worker

The service worker provides:
- Precaching of static assets
- Runtime caching strategies
- Offline support
- Background sync

## Build Tool Integration

### Vite

\`\`\`typescript
import { viteCDNPlugin } from './cdn/plugins/vite-cdn-plugin';

export default defineConfig({
  plugins: [viteCDNPlugin()],
});
\`\`\`

### Webpack

\`\`\`typescript
import { WebpackCDNPlugin } from './cdn/plugins/webpack-cdn-plugin';

module.exports = {
  plugins: [new WebpackCDNPlugin()],
};
\`\`\`

## Infrastructure

### Terraform

Deploy infrastructure with Terraform:

\`\`\`bash
cd cdn/infrastructure

# Cloudflare
terraform init
terraform apply -var-file=cloudflare.tfvars

# AWS CloudFront
terraform init
terraform apply -var-file=aws.tfvars
\`\`\`

## API Reference

### AssetOptimizer

\`\`\`typescript
const optimizer = new AssetOptimizer('./dist');
const result = await optimizer.optimizeAll();
\`\`\`

### ImageOptimizer

\`\`\`typescript
const optimizer = new ImageOptimizer('./dist');
const images = await optimizer.optimizeAll('./src/images');
\`\`\`

### CacheManager

\`\`\`typescript
const manager = new CacheManager('cloudflare');
await manager.purgeUrls(['https://example.com/page']);
await manager.purgeTags(['static']);
await manager.purgeAll();
\`\`\`

## License

MIT
`;
  }

  protected generatePackageJson(): string {
    return JSON.stringify({
      name: `@${this.context.org}/${this.context.normalizedName}-cdn`,
      version: '1.0.0',
      description: 'CDN integration for microfrontend applications',
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        deploy: 'ts-node scripts/deploy.ts',
        'cache:purge': 'ts-node scripts/invalidate-cache.ts',
        'optimize:assets': 'ts-node -e "import { AssetOptimizer } from \'./asset-optimizer\'; new AssetOptimizer(\'./dist\').optimizeAll()"',
        'optimize:images': 'ts-node -e "import { ImageOptimizer } from \'./image-optimizer\'; new ImageOptimizer(\'./dist\').optimizeAll(\'./src/images\')"'
      },
      dependencies: {
        'node-fetch': '^3.3.0',
        '@aws-sdk/client-cloudfront': '^3.500.0',
        '@aws-sdk/client-s3': '^3.500.0',
        '@azure/identity': '^4.0.0',
        'sharp': '^0.33.0',
        'terser': '^5.27.0',
        'cssnano': '^6.0.0',
        'postcss': '^8.4.0',
        'html-minifier-terser': '^7.2.0',
        'svgo': '^3.2.0',
        'workbox-build': '^7.0.0',
        'workbox-precaching': '^7.0.0',
        'workbox-routing': '^7.0.0',
        'workbox-strategies': '^7.0.0',
        'workbox-expiration': '^7.0.0',
        'workbox-cacheable-response': '^7.0.0'
      },
      devDependencies: {
        '@types/node': '^20.11.0',
        'typescript': '^5.3.0',
        'ts-node': '^10.9.0'
      }
    }, null, 2);
  }
}

export default CDNIntegrationTemplate;
