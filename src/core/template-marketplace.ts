import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Template, TemplateCategory } from './template-engine';
import { TemplateValidator, ValidationResult } from './template-validator';
import { TemplateVersionManager, TemplateManifest } from './template-versioning';

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  author: string;
  authorProfile?: AuthorProfile;
  version: string;
  downloads: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  featured: boolean;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  repository?: string;
  homepage?: string;
  license?: string;
  preview?: TemplatePreview;
  stats: TemplateStats;
}

export interface AuthorProfile {
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  website?: string;
  templatesCount: number;
  totalDownloads: number;
  joinedAt: Date;
  verified: boolean;
}

export interface TemplatePreview {
  screenshots: string[];
  demoUrl?: string;
  videoUrl?: string;
  codeExamples: CodeExample[];
}

export interface CodeExample {
  title: string;
  description?: string;
  language: string;
  code: string;
}

export interface TemplateStats {
  weeklyDownloads: number;
  monthlyDownloads: number;
  yearlyDownloads: number;
  forks: number;
  stars: number;
  issues: number;
  pullRequests: number;
  lastCommit: Date;
  commitCount: number;
  contributors: number;
}

export interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  username: string;
  rating: number;
  title?: string;
  comment?: string;
  createdAt: Date;
  updatedAt?: Date;
  helpful: number;
  verified: boolean;
}

export interface SearchOptions {
  query?: string;
  category?: TemplateCategory;
  tags?: string[];
  author?: string;
  minRating?: number;
  verified?: boolean;
  featured?: boolean;
  sortBy?: 'downloads' | 'rating' | 'updated' | 'created' | 'trending';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  templates: MarketplaceTemplate[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets?: SearchFacets;
}

export interface SearchFacets {
  categories: Array<{ category: TemplateCategory; count: number }>;
  tags: Array<{ tag: string; count: number }>;
  authors: Array<{ author: string; count: number }>;
  licenses: Array<{ license: string; count: number }>;
}

export interface PublishOptions {
  private?: boolean;
  beta?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

export interface PublishResult {
  success: boolean;
  templateId: string;
  version: string;
  url?: string;
  warnings?: string[];
  errors?: string[];
}

export interface MarketplaceConfig {
  apiUrl?: string;
  apiKey?: string;
  cacheDir?: string;
  cacheTTL?: number;
  enableAnalytics?: boolean;
  enableOfflineMode?: boolean;
  maxCacheSize?: number;
  userAgent?: string;
}

export class TemplateMarketplace extends EventEmitter {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private validator: TemplateValidator;
  private versionManager: TemplateVersionManager;
  private offlineTemplates: Map<string, MarketplaceTemplate> = new Map();

  private defaultConfig: MarketplaceConfig = {
    apiUrl: 'https://api.re-shell.dev/marketplace',
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    enableAnalytics: true,
    enableOfflineMode: true,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    userAgent: 'Re-Shell CLI'
  };

  constructor(
    private localTemplatesDir: string,
    private config: MarketplaceConfig = {}
  ) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.validator = new TemplateValidator();
    this.versionManager = new TemplateVersionManager(localTemplatesDir);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.config.cacheDir) {
      await fs.ensureDir(this.config.cacheDir);
    }

    if (this.config.enableOfflineMode) {
      await this.loadOfflineTemplates();
    }
  }

  private async loadOfflineTemplates(): Promise<void> {
    const offlinePath = path.join(this.localTemplatesDir, '.marketplace-cache.json');
    
    if (await fs.pathExists(offlinePath)) {
      try {
        const data = await fs.readJson(offlinePath);
        for (const template of data.templates || []) {
          this.offlineTemplates.set(template.id, template);
        }
      } catch (error) {
        this.emit('error', { type: 'offline_load', error });
      }
    }
  }

  async search(options: SearchOptions = {}): Promise<SearchResult> {
    const cacheKey = this.getCacheKey('search', options);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const result = await this.searchOnline(options);
      this.setCache(cacheKey, result);
      
      // Update offline cache
      if (this.config.enableOfflineMode) {
        await this.updateOfflineCache(result.templates);
      }
      
      return result;
    } catch (error) {
      // Fallback to offline search
      if (this.config.enableOfflineMode) {
        return this.searchOffline(options);
      }
      throw error;
    }
  }

  private async searchOnline(options: SearchOptions): Promise<SearchResult> {
    const params = new URLSearchParams();
    
    if (options.query) params.append('q', options.query);
    if (options.category) params.append('category', options.category);
    if (options.tags) params.append('tags', options.tags.join(','));
    if (options.author) params.append('author', options.author);
    if (options.minRating) params.append('minRating', options.minRating.toString());
    if (options.verified !== undefined) params.append('verified', options.verified.toString());
    if (options.featured !== undefined) params.append('featured', options.featured.toString());
    if (options.sortBy) params.append('sort', options.sortBy);
    if (options.order) params.append('order', options.order);
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());

    const response = await this.apiRequest(`/templates?${params}`);
    
    return {
      templates: response.data.map((t: any) => this.transformTemplate(t)),
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
      totalPages: response.totalPages,
      facets: response.facets
    };
  }

  private searchOffline(options: SearchOptions): SearchResult {
    let templates = Array.from(this.offlineTemplates.values());
    
    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    if (options.category) {
      templates = templates.filter(t => t.category === options.category);
    }
    
    if (options.tags && options.tags.length > 0) {
      templates = templates.filter(t => 
        options.tags!.some(tag => t.tags.includes(tag))
      );
    }
    
    if (options.author) {
      templates = templates.filter(t => t.author === options.author);
    }
    
    if (options.minRating) {
      templates = templates.filter(t => t.rating >= options.minRating!);
    }
    
    if (options.verified !== undefined) {
      templates = templates.filter(t => t.verified === options.verified);
    }
    
    if (options.featured !== undefined) {
      templates = templates.filter(t => t.featured === options.featured);
    }
    
    // Sort
    templates = this.sortTemplates(templates, options.sortBy, options.order);
    
    // Paginate
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const paginatedTemplates = templates.slice(offset, offset + limit);
    
    return {
      templates: paginatedTemplates,
      total: templates.length,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      totalPages: Math.ceil(templates.length / limit)
    };
  }

  private sortTemplates(
    templates: MarketplaceTemplate[],
    sortBy: SearchOptions['sortBy'] = 'downloads',
    order: SearchOptions['order'] = 'desc'
  ): MarketplaceTemplate[] {
    const sorted = [...templates];
    
    sorted.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'downloads':
          compareValue = a.downloads - b.downloads;
          break;
        case 'rating':
          compareValue = a.rating - b.rating;
          break;
        case 'updated':
          compareValue = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'created':
          compareValue = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'trending':
          compareValue = a.stats.weeklyDownloads - b.stats.weeklyDownloads;
          break;
      }
      
      return order === 'asc' ? compareValue : -compareValue;
    });
    
    return sorted;
  }

  async getTemplate(templateId: string): Promise<MarketplaceTemplate | null> {
    const cacheKey = this.getCacheKey('template', templateId);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.apiRequest(`/templates/${templateId}`);
      const template = this.transformTemplate(response);
      
      this.setCache(cacheKey, template);
      
      if (this.config.enableOfflineMode) {
        await this.updateOfflineCache([template]);
      }
      
      return template;
    } catch (error) {
      // Fallback to offline
      if (this.config.enableOfflineMode) {
        return this.offlineTemplates.get(templateId) || null;
      }
      throw error;
    }
  }

  async getReviews(templateId: string, limit = 10, offset = 0): Promise<TemplateReview[]> {
    const cacheKey = this.getCacheKey('reviews', { templateId, limit, offset });
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.apiRequest(
        `/templates/${templateId}/reviews?limit=${limit}&offset=${offset}`
      );
      
      const reviews = response.data.map((r: any) => ({
        ...r,
        createdAt: new Date(r.createdAt),
        updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined
      }));
      
      this.setCache(cacheKey, reviews);
      return reviews;
    } catch (error) {
      this.emit('error', { type: 'reviews_fetch', templateId, error });
      return [];
    }
  }

  async submitReview(
    templateId: string,
    rating: number,
    title?: string,
    comment?: string
  ): Promise<boolean> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    try {
      await this.apiRequest(`/templates/${templateId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, title, comment })
      });
      
      // Invalidate cache
      this.invalidateCache('reviews', templateId);
      this.invalidateCache('template', templateId);
      
      this.emit('review:submitted', { templateId, rating });
      return true;
    } catch (error) {
      this.emit('error', { type: 'review_submit', templateId, error });
      return false;
    }
  }

  async install(templateId: string, version?: string): Promise<string> {
    this.emit('install:start', { templateId, version });
    
    try {
      // Get template metadata
      const template = await this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }
      
      // Download template
      const targetVersion = version || template.version;
      const downloadUrl = await this.getDownloadUrl(templateId, targetVersion);
      const installPath = path.join(this.localTemplatesDir, templateId);
      
      // Download and extract
      await this.downloadAndExtract(downloadUrl, installPath);
      
      // Validate template
      const templateData = await this.loadTemplateFromPath(installPath);
      const validation = await this.validator.validate(templateData);
      
      if (!validation.valid && validation.errors.some(e => e.severity === 'critical')) {
        await fs.remove(installPath);
        throw new Error(`Template validation failed: ${validation.errors[0].message}`);
      }
      
      // Register with version manager
      await this.versionManager.registerTemplate(templateData, installPath);
      
      // Track analytics
      if (this.config.enableAnalytics) {
        this.trackInstall(templateId, targetVersion).catch(() => { /* ignore */ });
      }
      
      this.emit('install:complete', { templateId, version: targetVersion, path: installPath });
      return installPath;
      
    } catch (error) {
      this.emit('install:error', { templateId, error });
      throw error;
    }
  }

  async publish(
    templatePath: string,
    options: PublishOptions = {}
  ): Promise<PublishResult> {
    this.emit('publish:start', { templatePath, options });
    
    try {
      // Load and validate template
      const template = await this.loadTemplateFromPath(templatePath);
      const validation = await this.validator.validate(template);
      
      if (!validation.valid) {
        return {
          success: false,
          templateId: template.id,
          version: template.version,
          errors: validation.errors.map(e => e.message),
          warnings: validation.warnings.map(w => w.message)
        };
      }
      
      // Dry run
      if (options.dryRun) {
        return {
          success: true,
          templateId: template.id,
          version: template.version,
          warnings: ['This is a dry run. Template was not published.']
        };
      }
      
      // Package template
      const packagePath = await this.packageTemplate(templatePath);
      
      // Upload to marketplace
      const formData = new FormData();
      const packageBuffer = await fs.readFile(packagePath);
      formData.append('template', new Blob([packageBuffer]), path.basename(packagePath));
      formData.append('metadata', JSON.stringify({
        private: options.private,
        beta: options.beta,
        force: options.force
      }));
      
      const response = await this.apiRequest('/templates', {
        method: 'POST',
        body: formData
      });
      
      // Cleanup
      await fs.remove(packagePath);
      
      this.emit('publish:complete', { templateId: template.id, version: template.version });
      
      return {
        success: true,
        templateId: template.id,
        version: template.version,
        url: response.url,
        warnings: validation.warnings.map(w => w.message)
      };
      
    } catch (error: any) {
      this.emit('publish:error', { templatePath, error });
      
      return {
        success: false,
        templateId: '',
        version: '',
        errors: [error.message]
      };
    }
  }

  async unpublish(templateId: string, version?: string): Promise<boolean> {
    try {
      const endpoint = version 
        ? `/templates/${templateId}/versions/${version}`
        : `/templates/${templateId}`;
        
      await this.apiRequest(endpoint, { method: 'DELETE' });
      
      this.invalidateCache('template', templateId);
      this.emit('unpublish:complete', { templateId, version });
      
      return true;
    } catch (error) {
      this.emit('unpublish:error', { templateId, version, error });
      return false;
    }
  }

  async getFeaturedTemplates(): Promise<MarketplaceTemplate[]> {
    return (await this.search({ featured: true, limit: 10 })).templates;
  }

  async getTrendingTemplates(): Promise<MarketplaceTemplate[]> {
    return (await this.search({ sortBy: 'trending', limit: 10 })).templates;
  }

  async getTemplatesByAuthor(author: string): Promise<MarketplaceTemplate[]> {
    return (await this.search({ author, limit: 100 })).templates;
  }

  async getAuthorProfile(username: string): Promise<AuthorProfile | null> {
    const cacheKey = this.getCacheKey('author', username);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.apiRequest(`/authors/${username}`);
      const profile = {
        ...response,
        joinedAt: new Date(response.joinedAt)
      };
      
      this.setCache(cacheKey, profile);
      return profile;
    } catch (error) {
      return null;
    }
  }

  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.config.apiUrl}${endpoint}`;
    const headers: HeadersInit = {
      'User-Agent': this.config.userAgent!,
      ...options.headers
    };
    
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    if (options.body && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${response.status} - ${error}`);
    }
    
    return await response.json();
  }

  private transformTemplate(data: any): MarketplaceTemplate {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      stats: {
        ...data.stats,
        lastCommit: new Date(data.stats.lastCommit)
      }
    };
  }

  private async getDownloadUrl(templateId: string, version: string): Promise<string> {
    const response = await this.apiRequest(
      `/templates/${templateId}/download?version=${version}`
    );
    return response.url;
  }

  private async downloadAndExtract(url: string, destination: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    
    const tempFile = path.join(this.localTemplatesDir, `.tmp-${Date.now()}.tar.gz`);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(tempFile, Buffer.from(buffer));
    
    // Extract
    await fs.ensureDir(destination);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tarLib = require('tar');
    await tarLib.extract({
      file: tempFile,
      cwd: destination
    });

    // Cleanup
    await fs.remove(tempFile);
  }

  private async loadTemplateFromPath(templatePath: string): Promise<Template> {
    const manifestPath = path.join(templatePath, 'template.yaml');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yamlLib = require('js-yaml');
    const content = await fs.readFile(manifestPath, 'utf8');
    return yamlLib.load(content) as Template;
  }

  private async packageTemplate(templatePath: string): Promise<string> {
    const packagePath = path.join(this.localTemplatesDir, `.tmp-package-${Date.now()}.tar.gz`);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tarLib = require('tar');
    await tarLib.create({
      gzip: true,
      file: packagePath,
      cwd: templatePath,
      filter: (path: string) => !path.includes('node_modules') && !path.startsWith('.')
    }, ['.']);
    
    return packagePath;
  }

  private async trackInstall(templateId: string, version: string): Promise<void> {
    try {
      await this.apiRequest('/analytics/install', {
        method: 'POST',
        body: JSON.stringify({ templateId, version })
      });
    } catch {
      // Ignore analytics errors
    }
  }

  private async updateOfflineCache(templates: MarketplaceTemplate[]): Promise<void> {
    for (const template of templates) {
      this.offlineTemplates.set(template.id, template);
    }
    
    // Save to file
    const offlinePath = path.join(this.localTemplatesDir, '.marketplace-cache.json');
    await fs.writeJson(offlinePath, {
      templates: Array.from(this.offlineTemplates.values()),
      updated: new Date()
    });
    
    // Cleanup old entries
    await this.cleanupOfflineCache();
  }

  private async cleanupOfflineCache(): Promise<void> {
    if (!this.config.maxCacheSize) return;
    
    const offlinePath = path.join(this.localTemplatesDir, '.marketplace-cache.json');
    const stats = await fs.stat(offlinePath);
    
    if (stats.size > this.config.maxCacheSize) {
      // Remove oldest templates
      const templates = Array.from(this.offlineTemplates.values())
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      
      while (templates.length > 100) { // Keep top 100
        const removed = templates.pop()!;
        this.offlineTemplates.delete(removed.id);
      }
      
      await fs.writeJson(offlinePath, {
        templates: Array.from(this.offlineTemplates.values()),
        updated: new Date()
      });
    }
  }

  private getCacheKey(type: string, data: any): string {
    return `${type}:${JSON.stringify(data)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.config.cacheTTL!) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Limit cache size
    if (this.cache.size > 1000) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  private invalidateCache(type: string, id: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${type}:`) && key.includes(id)) {
        this.cache.delete(key);
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.emit('cache:cleared');
  }
}

// Global marketplace instance
let globalMarketplace: TemplateMarketplace | null = null;

export function createTemplateMarketplace(
  localTemplatesDir: string,
  config?: MarketplaceConfig
): TemplateMarketplace {
  return new TemplateMarketplace(localTemplatesDir, config);
}

export function getGlobalTemplateMarketplace(): TemplateMarketplace {
  if (!globalMarketplace) {
    const templatesDir = path.join(process.cwd(), 'templates');
    globalMarketplace = new TemplateMarketplace(templatesDir);
  }
  return globalMarketplace;
}

export function setGlobalTemplateMarketplace(marketplace: TemplateMarketplace): void {
  globalMarketplace = marketplace;
}