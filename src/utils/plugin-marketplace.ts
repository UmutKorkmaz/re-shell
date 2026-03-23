import * as fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import chalk from 'chalk';
import { ValidationError } from './error-handler';
import { PluginManifest, PluginRegistration } from './plugin-system';

// Marketplace plugin information
export interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  latestVersion: string;
  description: string;
  author: string;
  authorEmail?: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  category: PluginCategory;
  downloads: number;
  rating: number;
  reviewCount: number;
  featured: boolean;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  size: number;
  screenshots?: string[];
  readme?: string;
  changelog?: string;
  dependencies: Record<string, string>;
  compatibility: {
    cliVersion: string;
    nodeVersion: string;
    platforms: string[];
  };
  pricing: PluginPricing;
  support: PluginSupport;
  metrics: PluginMetrics;
}

// Plugin categories
export enum PluginCategory {
  DEVELOPMENT = 'development',
  PRODUCTIVITY = 'productivity',
  AUTOMATION = 'automation',
  INTEGRATION = 'integration',
  TESTING = 'testing',
  DEPLOYMENT = 'deployment',
  MONITORING = 'monitoring',
  SECURITY = 'security',
  UTILITY = 'utility',
  THEME = 'theme',
  EXTENSION = 'extension'
}

// Plugin pricing information
export interface PluginPricing {
  type: 'free' | 'paid' | 'freemium' | 'subscription';
  price?: number;
  currency?: string;
  billing?: 'monthly' | 'yearly' | 'one-time';
  trialDays?: number;
}

// Plugin support information
export interface PluginSupport {
  documentation?: string;
  issues?: string;
  community?: string;
  email?: string;
  responseTime?: string;
  languages: string[];
}

// Plugin metrics
export interface PluginMetrics {
  weeklyDownloads: number;
  monthlyDownloads: number;
  totalDownloads: number;
  stars: number;
  forks: number;
  issues: number;
  lastCommit: string;
  contributors: number;
}

// Plugin review
export interface PluginReview {
  id: string;
  pluginId: string;
  userId: string;
  username: string;
  rating: number;
  title: string;
  content: string;
  pros?: string[];
  cons?: string[];
  version: string;
  helpful: number;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

// Search filters
export interface MarketplaceSearchFilters {
  query?: string;
  category?: PluginCategory;
  author?: string;
  license?: string;
  rating?: number;
  featured?: boolean;
  verified?: boolean;
  free?: boolean;
  sortBy?: 'relevance' | 'downloads' | 'rating' | 'updated' | 'created' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Search result
export interface MarketplaceSearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  page: number;
  pages: number;
  filters: MarketplaceSearchFilters;
}

// Installation result
export interface InstallationResult {
  success: boolean;
  plugin: MarketplacePlugin;
  installedVersion: string;
  installPath: string;
  dependencies: string[];
  warnings: string[];
  errors: string[];
  duration: number;
}

// Marketplace configuration
export interface MarketplaceConfig {
  apiUrl: string;
  authToken?: string;
  cacheTimeout: number;
  downloadTimeout: number;
  verifySignatures: boolean;
  allowPrerelease: boolean;
  autoUpdate: boolean;
  telemetry: boolean;
}

// Plugin marketplace client
export class PluginMarketplace extends EventEmitter {
  private config: MarketplaceConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private downloadQueue: Map<string, Promise<any>> = new Map();

  constructor(config: Partial<MarketplaceConfig> = {}) {
    super();
    this.config = {
      apiUrl: 'https://marketplace.re-shell.dev/api/v1',
      cacheTimeout: 300000, // 5 minutes
      downloadTimeout: 30000, // 30 seconds
      verifySignatures: true,
      allowPrerelease: false,
      autoUpdate: false,
      telemetry: true,
      ...config
    };
  }

  // Search plugins in marketplace
  async searchPlugins(filters: MarketplaceSearchFilters = {}): Promise<MarketplaceSearchResult> {
    const cacheKey = `search_${JSON.stringify(filters)}`;
    
    // Check cache
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.emit('search-cache-hit', filters);
      return cached;
    }

    this.emit('search-started', filters);
    const startTime = Date.now();

    try {
      // In a real implementation, this would make HTTP requests to marketplace API
      const mockResult = await this.mockSearchRequest(filters);
      
      // Cache result
      this.setCachedData(cacheKey, mockResult);

      const duration = Date.now() - startTime;
      this.emit('search-completed', {
        filters,
        total: mockResult.total,
        duration
      });

      return mockResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.emit('search-failed', {
        filters,
        error,
        duration
      });
      throw error;
    }
  }

  // Get plugin details
  async getPlugin(pluginId: string): Promise<MarketplacePlugin | null> {
    const cacheKey = `plugin_${pluginId}`;
    
    // Check cache
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      this.emit('plugin-cache-hit', pluginId);
      return cached;
    }

    this.emit('plugin-fetch-started', pluginId);

    try {
      // Mock plugin data - in real implementation would fetch from API
      const plugin = await this.mockGetPlugin(pluginId);
      
      if (plugin) {
        this.setCachedData(cacheKey, plugin);
      }

      this.emit('plugin-fetch-completed', { pluginId, found: !!plugin });
      return plugin;

    } catch (error) {
      this.emit('plugin-fetch-failed', { pluginId, error });
      throw error;
    }
  }

  // Install plugin from marketplace
  async installPlugin(
    pluginId: string, 
    version?: string,
    options: { global?: boolean; force?: boolean } = {}
  ): Promise<InstallationResult> {
    const installKey = `${pluginId}@${version || 'latest'}`;
    
    // Prevent concurrent installations
    if (this.downloadQueue.has(installKey)) {
      return await this.downloadQueue.get(installKey)!;
    }

    const installPromise = this.performInstallation(pluginId, version, options);
    this.downloadQueue.set(installKey, installPromise);

    try {
      const result = await installPromise;
      return result;
    } finally {
      this.downloadQueue.delete(installKey);
    }
  }

  // Perform plugin installation
  private async performInstallation(
    pluginId: string,
    version?: string,
    options: { global?: boolean; force?: boolean } = {}
  ): Promise<InstallationResult> {
    const startTime = Date.now();
    
    this.emit('installation-started', { pluginId, version, options });

    try {
      // Get plugin information
      const plugin = await this.getPlugin(pluginId);
      if (!plugin) {
        throw new ValidationError(`Plugin '${pluginId}' not found in marketplace`);
      }

      const targetVersion = version || plugin.latestVersion;
      
      // Check compatibility
      await this.checkCompatibility(plugin, targetVersion);

      // Download plugin
      const downloadPath = await this.downloadPlugin(plugin, targetVersion);

      // Verify plugin
      if (this.config.verifySignatures) {
        await this.verifyPluginSignature(downloadPath);
      }

      // Install plugin
      const installPath = await this.installPluginFiles(downloadPath, options);

      // Install dependencies
      const dependencies = await this.installDependencies(plugin);

      const result: InstallationResult = {
        success: true,
        plugin,
        installedVersion: targetVersion,
        installPath,
        dependencies,
        warnings: [],
        errors: [],
        duration: Date.now() - startTime
      };

      this.emit('installation-completed', result);
      return result;

    } catch (error) {
      const result: InstallationResult = {
        success: false,
        plugin: {} as MarketplacePlugin,
        installedVersion: '',
        installPath: '',
        dependencies: [],
        warnings: [],
        errors: [error instanceof Error ? error.message : String(error)],
        duration: Date.now() - startTime
      };

      this.emit('installation-failed', result);
      return result;
    }
  }

  // Check plugin compatibility
  private async checkCompatibility(plugin: MarketplacePlugin, version: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const semver = require('semver');
    
    // Check CLI version compatibility
    if (plugin.compatibility.cliVersion) {
      const currentCliVersion = '0.7.0'; // Would get from package.json
      if (!semver.satisfies(currentCliVersion, plugin.compatibility.cliVersion)) {
        throw new ValidationError(
          `Plugin requires CLI version ${plugin.compatibility.cliVersion}, current: ${currentCliVersion}`
        );
      }
    }

    // Check Node.js version compatibility
    if (plugin.compatibility.nodeVersion) {
      const currentNodeVersion = process.version;
      if (!semver.satisfies(currentNodeVersion, plugin.compatibility.nodeVersion)) {
        throw new ValidationError(
          `Plugin requires Node.js version ${plugin.compatibility.nodeVersion}, current: ${currentNodeVersion}`
        );
      }
    }

    // Check platform compatibility
    if (plugin.compatibility.platforms.length > 0) {
      const currentPlatform = process.platform;
      if (!plugin.compatibility.platforms.includes(currentPlatform)) {
        throw new ValidationError(
          `Plugin not compatible with platform ${currentPlatform}. Supported: ${plugin.compatibility.platforms.join(', ')}`
        );
      }
    }
  }

  // Download plugin from marketplace
  private async downloadPlugin(plugin: MarketplacePlugin, version: string): Promise<string> {
    const downloadUrl = `${this.config.apiUrl}/plugins/${plugin.id}/download/${version}`;
    const downloadPath = path.join(process.cwd(), '.re-shell', 'downloads', `${plugin.id}-${version}.tgz`);

    await fs.ensureDir(path.dirname(downloadPath));

    this.emit('download-started', { plugin: plugin.id, version, url: downloadUrl });

    try {
      // Mock download - in real implementation would use HTTP client
      await this.mockDownloadFile(downloadUrl, downloadPath);
      
      this.emit('download-completed', { plugin: plugin.id, version, path: downloadPath });
      return downloadPath;

    } catch (error) {
      this.emit('download-failed', { plugin: plugin.id, version, error });
      throw error;
    }
  }

  // Verify plugin signature
  private async verifyPluginSignature(downloadPath: string): Promise<void> {
    // Mock signature verification
    this.emit('signature-verification', { path: downloadPath, verified: true });
  }

  // Install plugin files
  private async installPluginFiles(
    downloadPath: string,
    options: { global?: boolean }
  ): Promise<string> {
    const installDir = options.global 
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ? path.join(require('os').homedir(), '.re-shell', 'plugins')
      : path.join(process.cwd(), '.re-shell', 'plugins');

    await fs.ensureDir(installDir);

    // Mock extraction and installation
    const pluginName = path.basename(downloadPath, '.tgz').split('-')[0];
    const installPath = path.join(installDir, pluginName);
    
    await fs.ensureDir(installPath);
    
    // Create mock plugin structure
    await fs.writeJSON(path.join(installPath, 'package.json'), {
      name: pluginName,
      version: '1.0.0',
      description: 'Marketplace plugin',
      main: 'index.js'
    });

    await fs.writeFile(path.join(installPath, 'index.js'), `
module.exports = {
  activate: (context) => {
    console.log('Plugin ${pluginName} activated');
  }
};
`);

    return installPath;
  }

  // Install plugin dependencies
  private async installDependencies(plugin: MarketplacePlugin): Promise<string[]> {
    const dependencies = Object.keys(plugin.dependencies);
    
    // Mock dependency installation
    for (const dep of dependencies) {
      this.emit('dependency-install', { dependency: dep, plugin: plugin.id });
    }

    return dependencies;
  }

  // Get plugin reviews
  async getPluginReviews(pluginId: string, limit = 10, offset = 0): Promise<PluginReview[]> {
    const cacheKey = `reviews_${pluginId}_${limit}_${offset}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const reviews = await this.mockGetReviews(pluginId, limit, offset);
      this.setCachedData(cacheKey, reviews);
      return reviews;

    } catch (error) {
      this.emit('reviews-fetch-failed', { pluginId, error });
      throw error;
    }
  }

  // Submit plugin review
  async submitReview(review: Omit<PluginReview, 'id' | 'createdAt' | 'updatedAt'>): Promise<PluginReview> {
    try {
      // Mock review submission
      const submittedReview: PluginReview = {
        ...review,
        id: `review_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      this.emit('review-submitted', submittedReview);
      return submittedReview;

    } catch (error) {
      this.emit('review-submission-failed', { review, error });
      throw error;
    }
  }

  // Get featured plugins
  async getFeaturedPlugins(limit = 6): Promise<MarketplacePlugin[]> {
    const cacheKey = `featured_${limit}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const featured = await this.mockGetFeatured(limit);
      this.setCachedData(cacheKey, featured);
      return featured;

    } catch (error) {
      this.emit('featured-fetch-failed', { error });
      throw error;
    }
  }

  // Get popular plugins
  async getPopularPlugins(category?: PluginCategory, limit = 10): Promise<MarketplacePlugin[]> {
    const cacheKey = `popular_${category || 'all'}_${limit}`;
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const popular = await this.mockGetPopular(category, limit);
      this.setCachedData(cacheKey, popular);
      return popular;

    } catch (error) {
      this.emit('popular-fetch-failed', { category, error });
      throw error;
    }
  }

  // Get plugin categories
  async getCategories(): Promise<Array<{ name: PluginCategory; count: number; description: string }>> {
    const cacheKey = 'categories';
    
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const categories = [
        { name: PluginCategory.DEVELOPMENT, count: 45, description: 'Development tools and utilities' },
        { name: PluginCategory.PRODUCTIVITY, count: 32, description: 'Productivity and workflow enhancements' },
        { name: PluginCategory.AUTOMATION, count: 28, description: 'Automation and scripting tools' },
        { name: PluginCategory.INTEGRATION, count: 25, description: 'Third-party service integrations' },
        { name: PluginCategory.TESTING, count: 18, description: 'Testing frameworks and utilities' },
        { name: PluginCategory.DEPLOYMENT, count: 15, description: 'Deployment and CI/CD tools' },
        { name: PluginCategory.MONITORING, count: 12, description: 'Monitoring and observability' },
        { name: PluginCategory.SECURITY, count: 10, description: 'Security and vulnerability tools' },
        { name: PluginCategory.UTILITY, count: 22, description: 'General utilities and helpers' },
        { name: PluginCategory.THEME, count: 8, description: 'Visual themes and customizations' },
        { name: PluginCategory.EXTENSION, count: 35, description: 'CLI extensions and enhancements' }
      ];

      this.setCachedData(cacheKey, categories);
      return categories;

    } catch (error) {
      this.emit('categories-fetch-failed', { error });
      throw error;
    }
  }

  // Clear marketplace cache
  clearCache(): void {
    this.cache.clear();
    this.emit('cache-cleared');
  }

  // Get cached data
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  // Set cached data
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Mock methods for development - would be replaced with actual API calls

  private async mockSearchRequest(filters: MarketplaceSearchFilters): Promise<MarketplaceSearchResult> {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const mockPlugins: MarketplacePlugin[] = [
      {
        id: 'eslint-plugin',
        name: 'ESLint Integration',
        version: '1.2.3',
        latestVersion: '1.2.3',
        description: 'Integrate ESLint with Re-Shell for code quality checks',
        author: 'Re-Shell Team',
        license: 'MIT',
        keywords: ['linting', 'quality', 'javascript'],
        category: PluginCategory.DEVELOPMENT,
        downloads: 12450,
        rating: 4.8,
        reviewCount: 89,
        featured: true,
        verified: true,
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-06-15T14:30:00Z',
        size: 2048576,
        dependencies: { 'eslint': '^8.0.0' },
        compatibility: {
          cliVersion: '>=0.6.0',
          nodeVersion: '>=16.0.0',
          platforms: ['darwin', 'linux', 'win32']
        },
        pricing: { type: 'free' },
        support: {
          documentation: 'https://docs.re-shell.dev/plugins/eslint',
          issues: 'https://github.com/re-shell/eslint-plugin/issues',
          languages: ['en', 'es', 'fr']
        },
        metrics: {
          weeklyDownloads: 1250,
          monthlyDownloads: 5200,
          totalDownloads: 12450,
          stars: 456,
          forks: 23,
          issues: 3,
          lastCommit: '2024-06-15T14:30:00Z',
          contributors: 8
        }
      },
      {
        id: 'docker-helper',
        name: 'Docker Helper',
        version: '2.1.0',
        latestVersion: '2.1.0',
        description: 'Streamline Docker operations with enhanced commands',
        author: 'DevOps Community',
        license: 'Apache-2.0',
        keywords: ['docker', 'containers', 'devops'],
        category: PluginCategory.DEPLOYMENT,
        downloads: 8230,
        rating: 4.6,
        reviewCount: 67,
        featured: false,
        verified: true,
        createdAt: '2024-02-20T09:15:00Z',
        updatedAt: '2024-06-10T11:45:00Z',
        size: 1536000,
        dependencies: {},
        compatibility: {
          cliVersion: '>=0.5.0',
          nodeVersion: '>=14.0.0',
          platforms: ['darwin', 'linux']
        },
        pricing: { type: 'free' },
        support: {
          documentation: 'https://docker-helper.dev',
          community: 'https://discord.gg/docker-helper',
          languages: ['en']
        },
        metrics: {
          weeklyDownloads: 890,
          monthlyDownloads: 3400,
          totalDownloads: 8230,
          stars: 234,
          forks: 12,
          issues: 5,
          lastCommit: '2024-06-10T11:45:00Z',
          contributors: 4
        }
      }
    ];

    // Apply filters
    let filteredPlugins = mockPlugins;
    
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filteredPlugins = filteredPlugins.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query) ||
        p.keywords.some(k => k.toLowerCase().includes(query))
      );
    }

    if (filters.category) {
      filteredPlugins = filteredPlugins.filter(p => p.category === filters.category);
    }

    if (filters.featured !== undefined) {
      filteredPlugins = filteredPlugins.filter(p => p.featured === filters.featured);
    }

    if (filters.verified !== undefined) {
      filteredPlugins = filteredPlugins.filter(p => p.verified === filters.verified);
    }

    if (filters.free !== undefined) {
      filteredPlugins = filteredPlugins.filter(p => p.pricing.type === 'free');
    }

    // Apply sorting
    if (filters.sortBy) {
      filteredPlugins.sort((a, b) => {
        let comparison = 0;
        switch (filters.sortBy) {
          case 'downloads':
            comparison = b.downloads - a.downloads;
            break;
          case 'rating':
            comparison = b.rating - a.rating;
            break;
          case 'updated':
            comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            break;
          case 'created':
            comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            break;
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
        }
        return filters.sortOrder === 'asc' ? -comparison : comparison;
      });
    }

    // Apply pagination
    const limit = filters.limit || 10;
    const offset = filters.offset || 0;
    const paginatedPlugins = filteredPlugins.slice(offset, offset + limit);

    return {
      plugins: paginatedPlugins,
      total: filteredPlugins.length,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(filteredPlugins.length / limit),
      filters
    };
  }

  private async mockGetPlugin(pluginId: string): Promise<MarketplacePlugin | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Return mock plugin data if found
    const mockResult = await this.mockSearchRequest({ query: pluginId });
    return mockResult.plugins.find(p => p.id === pluginId) || null;
  }

  private async mockDownloadFile(url: string, downloadPath: string): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate download
    await fs.writeFile(downloadPath, 'mock-plugin-archive');
  }

  private async mockGetReviews(pluginId: string, limit: number, offset: number): Promise<PluginReview[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return [
      {
        id: 'review_1',
        pluginId,
        userId: 'user_123',
        username: 'developer1',
        rating: 5,
        title: 'Excellent plugin!',
        content: 'This plugin has significantly improved my workflow. Highly recommended!',
        pros: ['Easy to use', 'Well documented', 'Fast'],
        cons: [],
        version: '1.2.3',
        helpful: 15,
        verified: true,
        createdAt: '2024-06-01T10:30:00Z',
        updatedAt: '2024-06-01T10:30:00Z'
      },
      {
        id: 'review_2',
        pluginId,
        userId: 'user_456',
        username: 'coder_pro',
        rating: 4,
        title: 'Very useful',
        content: 'Good plugin with room for improvement in configuration options.',
        pros: ['Stable', 'Good performance'],
        cons: ['Limited configuration'],
        version: '1.2.0',
        helpful: 8,
        verified: false,
        createdAt: '2024-05-15T14:20:00Z',
        updatedAt: '2024-05-15T14:20:00Z'
      }
    ];
  }

  private async mockGetFeatured(limit: number): Promise<MarketplacePlugin[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = await this.mockSearchRequest({ featured: true, limit });
    return result.plugins;
  }

  private async mockGetPopular(category?: PluginCategory, limit = 10): Promise<MarketplacePlugin[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = await this.mockSearchRequest({ 
      category, 
      sortBy: 'downloads', 
      sortOrder: 'desc', 
      limit 
    });
    return result.plugins;
  }

  // Get marketplace statistics
  getStats(): any {
    return {
      cacheSize: this.cache.size,
      activeDownloads: this.downloadQueue.size,
      config: {
        cacheTimeout: this.config.cacheTimeout,
        downloadTimeout: this.config.downloadTimeout,
        verifySignatures: this.config.verifySignatures
      }
    };
  }
}

// Utility functions
export function createMarketplace(config?: Partial<MarketplaceConfig>): PluginMarketplace {
  return new PluginMarketplace(config);
}

export function isValidPluginId(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(id) && id.length >= 2 && id.length <= 50;
}

export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function formatDownloadCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}