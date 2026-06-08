import { EventEmitter } from 'events';
import { ValidationError } from './error-handler';
import {
  RegistryClient,
  RegistryUnreachableError,
  RegistrySearchHit,
  RegistryPackument,
  RegistryVersion,
  verifyRegistrySignature,
  PLUGIN_KEYWORD,
  type FetchLike,
} from './registry-client';
import {
  installPluginFromIdentifier,
  PluginInstallError,
  type PluginInstallResult,
} from './plugin-installer';

/**
 * Registry-backed plugin marketplace client (P9-F2/F3).
 *
 * The marketplace is the public npm registry: a "plugin" is an ordinary npm
 * package tagged with the `reshell-plugin` keyword and/or published under a
 * recognized scope. `search`/`info` hit the real registry; `install` delegates
 * to the W9b-1 installer (`installPluginFromIdentifier`). There is NO mock
 * fallback — on a network/HTTP failure these methods raise
 * {@link RegistryUnreachableError} (mapped to `MARKETPLACE_UNREACHABLE` by the
 * command layer) instead of pretending to return data.
 *
 * Signature verification is honest and config-gated: when `verifySignatures` is
 * true, install REJECTS any version whose npm Ed25519 registry signature cannot
 * be cryptographically validated (see {@link verifyRegistrySignature}).
 */

// Marketplace plugin information (subset surfaced from the npm registry).
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
}

// Plugin categories.
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
  EXTENSION = 'extension',
}

export interface PluginPricing {
  type: 'free' | 'paid' | 'freemium' | 'subscription';
  price?: number;
  currency?: string;
  billing?: 'monthly' | 'yearly' | 'one-time';
  trialDays?: number;
}

export interface PluginSupport {
  documentation?: string;
  issues?: string;
  community?: string;
  email?: string;
  responseTime?: string;
  languages: string[];
}

// Search filters.
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

// Search result.
export interface MarketplaceSearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  page: number;
  pages: number;
  filters: MarketplaceSearchFilters;
}

// Installation result.
export interface InstallationResult {
  success: boolean;
  plugin: MarketplacePlugin | null;
  installedVersion: string;
  installPath: string;
  source: PluginInstallResult['source'] | '';
  /** Outcome of the gated signature check (honest; never faked). */
  signature: { verified: boolean; reason?: string; gated: boolean };
  warnings: string[];
  errors: string[];
  duration: number;
}

// Marketplace configuration.
export interface MarketplaceConfig {
  apiUrl: string;
  authToken?: string;
  cacheTimeout: number;
  downloadTimeout: number;
  verifySignatures: boolean;
  allowPrerelease: boolean;
  autoUpdate: boolean;
  telemetry: boolean;
  /** Workspace that owns `.re-shell/plugins`. Defaults to process.cwd(). */
  workspaceRoot?: string;
  /** Injected fetch for tests; defaults to the global fetch via RegistryClient. */
  fetchImpl?: FetchLike;
}

const RESHELL_CATEGORY_KEYWORDS: Array<[PluginCategory, string[]]> = [
  [PluginCategory.TESTING, ['test', 'testing', 'jest', 'vitest']],
  [PluginCategory.DEPLOYMENT, ['deploy', 'deployment', 'ci', 'cd', 'docker']],
  [PluginCategory.SECURITY, ['security', 'auth', 'audit']],
  [PluginCategory.MONITORING, ['monitor', 'observability', 'metrics']],
  [PluginCategory.AUTOMATION, ['automation', 'script', 'workflow']],
  [PluginCategory.INTEGRATION, ['integration', 'api', 'connector']],
  [PluginCategory.PRODUCTIVITY, ['productivity']],
  [PluginCategory.THEME, ['theme', 'ui', 'style']],
];

function inferCategory(keywords: string[] | undefined): PluginCategory {
  const ks = (keywords ?? []).map((k) => k.toLowerCase());
  for (const [category, signals] of RESHELL_CATEGORY_KEYWORDS) {
    if (signals.some((s) => ks.includes(s))) return category;
  }
  return PluginCategory.EXTENSION;
}

function authorName(
  author: RegistryVersion['author'] | RegistrySearchHit['author']
): string {
  if (!author) return 'unknown';
  if (typeof author === 'string') return author;
  return author.name ?? 'unknown';
}

function repoUrl(repository: RegistryVersion['repository']): string | undefined {
  if (!repository) return undefined;
  return typeof repository === 'string' ? repository : repository.url;
}

// Plugin marketplace client.
export class PluginMarketplace extends EventEmitter {
  private config: MarketplaceConfig;
  private client: RegistryClient;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

  constructor(config: Partial<MarketplaceConfig> = {}) {
    super();
    this.config = {
      apiUrl: 'https://registry.npmjs.org',
      cacheTimeout: 300000, // 5 minutes
      downloadTimeout: 30000, // 30 seconds
      verifySignatures: true,
      allowPrerelease: false,
      autoUpdate: false,
      telemetry: true,
      ...config,
    };
    this.client = new RegistryClient({
      registryUrl: this.config.apiUrl,
      fetchImpl: this.config.fetchImpl,
      timeoutMs: this.config.downloadTimeout,
    });
  }

  /** Search plugins against the real npm registry (keyword-scoped). */
  async searchPlugins(filters: MarketplaceSearchFilters = {}): Promise<MarketplaceSearchResult> {
    const cacheKey = `search_${JSON.stringify(filters)}`;
    const cached = this.getCachedData<MarketplaceSearchResult>(cacheKey);
    if (cached) {
      this.emit('search-cache-hit', filters);
      return cached;
    }

    this.emit('search-started', filters);
    const startTime = Date.now();

    try {
      const limit = filters.limit ?? 10;
      const offset = filters.offset ?? 0;
      const hits = await this.client.search(filters.query, limit + offset);
      let plugins = hits.map((hit) => this.hitToPlugin(hit));

      plugins = this.applyFilters(plugins, filters);
      plugins = this.applySort(plugins, filters);

      const total = plugins.length;
      const paginated = plugins.slice(offset, offset + limit);

      const result: MarketplaceSearchResult = {
        plugins: paginated,
        total,
        page: Math.floor(offset / limit) + 1,
        pages: Math.max(1, Math.ceil(total / limit)),
        filters,
      };

      this.setCachedData(cacheKey, result);
      this.emit('search-completed', { filters, total, duration: Date.now() - startTime });
      return result;
    } catch (error) {
      this.emit('search-failed', { filters, error, duration: Date.now() - startTime });
      throw this.toReportableError(error);
    }
  }

  /** Fetch a single plugin's details from the registry packument. */
  async getPlugin(pluginId: string): Promise<MarketplacePlugin | null> {
    const cacheKey = `plugin_${pluginId}`;
    const cached = this.getCachedData<MarketplacePlugin>(cacheKey);
    if (cached) {
      this.emit('plugin-cache-hit', pluginId);
      return cached;
    }

    this.emit('plugin-fetch-started', pluginId);
    try {
      const packument = await this.client.getPackument(pluginId);
      const plugin = this.packumentToPlugin(packument);
      if (plugin) this.setCachedData(cacheKey, plugin);
      this.emit('plugin-fetch-completed', { pluginId, found: !!plugin });
      return plugin;
    } catch (error) {
      // A genuine 404 should surface as "not found"; transport failures as
      // MARKETPLACE_UNREACHABLE.
      if (error instanceof RegistryUnreachableError && error.details?.status === 404) {
        this.emit('plugin-fetch-completed', { pluginId, found: false });
        return null;
      }
      this.emit('plugin-fetch-failed', { pluginId, error });
      throw this.toReportableError(error);
    }
  }

  /**
   * Install a plugin from the marketplace. Resolves the version from the
   * registry, runs the gated honest signature check, then delegates the actual
   * download/extract/register to the W9b-1 installer
   * ({@link installPluginFromIdentifier}) using the `<name>@<version>` npm spec.
   */
  async installPlugin(
    pluginId: string,
    version?: string,
    options: { force?: boolean; dryRun?: boolean } = {}
  ): Promise<InstallationResult> {
    const startTime = Date.now();
    this.emit('installation-started', { pluginId, version, options });

    try {
      const resolved = await this.client.getVersion(pluginId, version);

      // Gated, honest signature verification.
      const gated = this.config.verifySignatures;
      let signature: { verified: boolean; reason?: string; gated: boolean } = {
        verified: false,
        gated,
      };
      if (gated) {
        const keys = await this.client.getSigningKeys();
        const check = verifyRegistrySignature(resolved, keys);
        signature = { verified: check.verified, reason: check.reason, gated: true };
        if (!check.verified) {
          throw new ValidationError(
            `Refusing to install unverified plugin "${pluginId}@${resolved.version}": ` +
              `${check.reason ?? 'signature verification failed'}. ` +
              `Disable signature verification explicitly to override.`
          );
        }
      }

      const installResult = await installPluginFromIdentifier(
        `${pluginId}@${resolved.version}`,
        {
          workspaceRoot: this.config.workspaceRoot ?? process.cwd(),
          force: options.force,
          dryRun: options.dryRun,
        }
      );

      const result: InstallationResult = {
        success: true,
        plugin: this.versionToPlugin(resolved),
        installedVersion: installResult.version,
        installPath: installResult.path,
        source: installResult.source,
        signature,
        warnings: gated ? [] : ['Signature verification disabled by configuration'],
        errors: [],
        duration: Date.now() - startTime,
      };
      this.emit('installation-completed', result);
      return result;
    } catch (error) {
      const reportable = this.toReportableError(error);
      const result: InstallationResult = {
        success: false,
        plugin: null,
        installedVersion: '',
        installPath: '',
        source: '',
        signature: { verified: false, gated: this.config.verifySignatures },
        warnings: [],
        errors: [reportable.message],
        duration: Date.now() - startTime,
      };
      this.emit('installation-failed', result);
      // Transport failures must propagate so the command layer can emit
      // MARKETPLACE_UNREACHABLE rather than a generic install error.
      if (reportable instanceof RegistryUnreachableError) {
        throw reportable;
      }
      return result;
    }
  }

  /** Featured plugins: top relevance hits, derived from the registry. */
  async getFeaturedPlugins(limit = 6): Promise<MarketplacePlugin[]> {
    const result = await this.searchPlugins({ limit, sortBy: 'relevance' });
    return result.plugins;
  }

  /** Popular plugins: registry search ordered by name (npm search has no global download sort here). */
  async getPopularPlugins(category?: PluginCategory, limit = 10): Promise<MarketplacePlugin[]> {
    const result = await this.searchPlugins({ category, limit, sortBy: 'name', sortOrder: 'asc' });
    return result.plugins;
  }

  /** Categories with live counts derived from a single registry search pass. */
  async getCategories(): Promise<Array<{ name: PluginCategory; count: number; description: string }>> {
    const result = await this.searchPlugins({ limit: 250 });
    const counts = new Map<PluginCategory, number>();
    for (const plugin of result.plugins) {
      counts.set(plugin.category, (counts.get(plugin.category) ?? 0) + 1);
    }
    return Object.values(PluginCategory).map((name) => ({
      name,
      count: counts.get(name) ?? 0,
      description: `${name} plugins`,
    }));
  }

  clearCache(): void {
    this.cache.clear();
    this.emit('cache-cleared');
  }

  getStats(): {
    registryUrl: string;
    cacheSize: number;
    config: { cacheTimeout: number; downloadTimeout: number; verifySignatures: boolean };
  } {
    return {
      registryUrl: this.config.apiUrl,
      cacheSize: this.cache.size,
      config: {
        cacheTimeout: this.config.cacheTimeout,
        downloadTimeout: this.config.downloadTimeout,
        verifySignatures: this.config.verifySignatures,
      },
    };
  }

  // --- Mapping helpers -----------------------------------------------------

  private hitToPlugin(hit: RegistrySearchHit): MarketplacePlugin {
    return {
      id: hit.name,
      name: hit.name,
      version: hit.version,
      latestVersion: hit.version,
      description: hit.description ?? '',
      author: authorName(hit.author) ?? hit.publisher?.username ?? 'unknown',
      license: 'UNKNOWN',
      homepage: hit.links?.homepage,
      repository: hit.links?.repository,
      keywords: hit.keywords ?? [],
      category: inferCategory(hit.keywords),
      downloads: 0,
      rating: 0,
      reviewCount: 0,
      featured: false,
      // `verified` reflects registry-signature status, which is only known after
      // an install-time check; search results are conservatively unverified.
      verified: false,
      createdAt: hit.date ?? '',
      updatedAt: hit.date ?? '',
      size: 0,
      dependencies: {},
      compatibility: { cliVersion: '*', nodeVersion: '*', platforms: [] },
      pricing: { type: 'free' },
      support: { languages: [] },
    };
  }

  private packumentToPlugin(packument: RegistryPackument): MarketplacePlugin | null {
    const latest = packument['dist-tags']?.latest;
    const version = latest ? packument.versions[latest] : undefined;
    if (!version) return null;
    const plugin = this.versionToPlugin(version);
    const time = packument.time ?? {};
    return {
      ...plugin,
      createdAt: time.created ?? plugin.createdAt,
      updatedAt: time.modified ?? plugin.updatedAt,
      latestVersion: latest ?? plugin.version,
    };
  }

  private versionToPlugin(version: RegistryVersion): MarketplacePlugin {
    const author = typeof version.author === 'object' ? version.author : undefined;
    return {
      id: version.name,
      name: version.name,
      version: version.version,
      latestVersion: version.version,
      description: version.description ?? '',
      author: authorName(version.author),
      authorEmail: author?.email,
      license: version.license ?? 'UNKNOWN',
      homepage: version.homepage,
      repository: repoUrl(version.repository),
      keywords: version.keywords ?? [],
      category: inferCategory(version.keywords),
      downloads: 0,
      rating: 0,
      reviewCount: 0,
      featured: false,
      verified: (version.dist.signatures?.length ?? 0) > 0,
      createdAt: '',
      updatedAt: '',
      size: version.dist.unpackedSize ?? 0,
      dependencies: version.dependencies ?? {},
      compatibility: {
        cliVersion: '*',
        nodeVersion: version.engines?.node ?? '*',
        platforms: [],
      },
      pricing: { type: 'free' },
      support: { languages: [] },
    };
  }

  private applyFilters(
    plugins: MarketplacePlugin[],
    filters: MarketplaceSearchFilters
  ): MarketplacePlugin[] {
    let out = plugins;
    if (filters.query) {
      const q = filters.query.toLowerCase();
      out = out.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.keywords.some((k) => k.toLowerCase().includes(q))
      );
    }
    if (filters.category) out = out.filter((p) => p.category === filters.category);
    if (filters.author) out = out.filter((p) => p.author === filters.author);
    // Re-Shell plugins on npm are free packages; the `free` filter is a no-op
    // pass-through kept for command-surface compatibility.
    return out;
  }

  private applySort(
    plugins: MarketplacePlugin[],
    filters: MarketplaceSearchFilters
  ): MarketplacePlugin[] {
    if (!filters.sortBy || filters.sortBy === 'relevance') return plugins;
    const sorted = [...plugins].sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
    return filters.sortOrder === 'asc' ? sorted : sorted.reverse();
  }

  private toReportableError(error: unknown): Error {
    if (error instanceof RegistryUnreachableError) return error;
    if (error instanceof ValidationError) return error;
    if (error instanceof PluginInstallError) return error;
    return error instanceof Error ? error : new Error(String(error));
  }

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.data as T;
    }
    return null;
  }

  private setCachedData(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// Utility functions.
export function createMarketplace(config?: Partial<MarketplaceConfig>): PluginMarketplace {
  return new PluginMarketplace(config);
}

/**
 * Validate a marketplace plugin identifier. Accepts plain npm names and scoped
 * names (`@scope/name`), which the old `[a-z0-9-]` regex rejected.
 */
export function isValidPluginId(id: string): boolean {
  return /^(@[a-z0-9][a-z0-9-._]*\/)?[a-z0-9][a-z0-9-._]*$/.test(id) && id.length <= 214;
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
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

export { PLUGIN_KEYWORD };
