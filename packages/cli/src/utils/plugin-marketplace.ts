import { EventEmitter } from 'events';
import { ValidationError } from './error-handler';
import type { PluginQuality } from '@re-shell/contracts';
import {
  RegistryClient,
  RegistryUnreachableError,
  RegistrySearchHit,
  RegistryPackument,
  RegistryVersion,
  PLUGIN_KEYWORD,
  DEFAULT_REGISTRY_URL,
  type FetchLike,
} from './registry-client';
import {
  installPluginFromIdentifier,
  PluginInstallError,
  type PluginInstallResult,
} from './plugin-installer';
import { checkVersionSignature } from './plugin-signature';
import { fetchPluginQuality, qualityCachePath } from './plugin-ratings';
import { readReviewAggregates } from './plugin-reviews';

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
 * true, install REJECTS any version whose npm (ECDSA P-256) registry signature
 * cannot be cryptographically validated (see `verifyRegistrySignature`).
 *
 * Ratings are real: search results carry the npms-derived score the npm search
 * endpoint returns; `getPlugin` (with `fetchQuality`) pulls npms.io / npm download
 * data through {@link fetchPluginQuality}; `reviewCount`/`teamRating` come from the
 * workspace's team reviews (`.re-shell/plugin-reviews.json`). Unknown values are
 * `null`, never a placeholder zero.
 */

/**
 * Marketplace plugin information (subset surfaced from the npm registry).
 */
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
  /** Downloads in the last month; null when the registry data did not include it. */
  downloads: number | null;
  /** 0-5 rating derived from the npms quality score; null when unknown. */
  rating: number | null;
  /** Where the rating/quality data came from; null when no quality data was fetched. */
  quality: PluginQuality | null;
  /** Number of team reviews recorded in `.re-shell/plugin-reviews.json`. */
  reviewCount: number;
  /** Mean team review rating (1-5); null when there are no team reviews. */
  teamRating: number | null;
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

/**
 * Plugin categories used to classify marketplace plugins.
 */
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

/** Pricing model for a marketplace plugin. */
export interface PluginPricing {
  type: 'free' | 'paid' | 'freemium' | 'subscription';
  price?: number;
  currency?: string;
  billing?: 'monthly' | 'yearly' | 'one-time';
  trialDays?: number;
}

/** Support channels and metadata for a marketplace plugin. */
export interface PluginSupport {
  documentation?: string;
  issues?: string;
  community?: string;
  email?: string;
  responseTime?: string;
  languages: string[];
}

/** Filters applied when searching the marketplace. */
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

/** Result of a marketplace search operation. */
export interface MarketplaceSearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  page: number;
  pages: number;
  filters: MarketplaceSearchFilters;
}

/** Result of a plugin installation attempt. */
export interface InstallationResult {
  success: boolean;
  plugin: MarketplacePlugin | null;
  installedVersion: string;
  installPath: string;
  source: PluginInstallResult['source'] | '';
  /** Outcome of the gated signature check (honest; never faked). */
  signature: { verified: boolean; reason?: string; gated: boolean; keyid?: string };
  warnings: string[];
  errors: string[];
  duration: number;
}

/** Configuration for the marketplace client. */
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
  /**
   * When true, `getPlugin` also fetches npms.io / npm download quality data
   * (cached on disk under the workspace). Off by default so library callers and
   * tests make no extra requests.
   */
  fetchQuality?: boolean;
  /** Skip the network for quality data and serve only the on-disk cache. */
  qualityOffline?: boolean;
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

/**
 * The npms-derived quality score the npm search endpoint attaches to each hit,
 * as a {@link PluginQuality}; null when the hit carries no score.
 */
function searchQuality(hit: RegistrySearchHit): PluginQuality | null {
  const final = hit.score?.final;
  if (typeof final !== 'number' || !Number.isFinite(final)) return null;
  const detail = hit.score?.detail ?? {};
  const num = (v: number | undefined): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    source: 'npms',
    rating: Math.round(Math.max(0, Math.min(1, final)) * 50) / 10,
    score: Math.max(0, Math.min(1, final)),
    quality: num(detail.quality),
    popularity: num(detail.popularity),
    maintenance: num(detail.maintenance),
    downloadsLastMonth: hit.downloads?.monthly ?? null,
    fetchedAt: new Date().toISOString(),
    cached: false,
    stale: false,
    derived: false,
  };
}

/**
 * Plugin marketplace client backed by the public npm registry.
 *
 * Emits lifecycle events (`search-started`, `installation-completed`, etc.)
 * via {@link EventEmitter}.
 */
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
      const reviews = await this.loadReviewAggregates();
      let plugins = hits.map((hit) => this.withTeamReviews(this.hitToPlugin(hit), reviews));

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
      let plugin = this.packumentToPlugin(packument);
      if (plugin) {
        plugin = this.withTeamReviews(plugin, await this.loadReviewAggregates());
        if (this.config.fetchQuality) {
          const quality = await fetchPluginQuality(pluginId, {
            fetchImpl: this.config.fetchImpl,
            cacheFile: qualityCachePath(this.workspaceRoot()),
            offline: this.config.qualityOffline,
            registryUrl: this.config.apiUrl,
          });
          plugin = {
            ...plugin,
            quality,
            rating: quality.rating,
            downloads: quality.downloadsLastMonth ?? plugin.downloads,
          };
        }
        this.setCachedData(cacheKey, plugin);
      }
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
    options: { force?: boolean; dryRun?: boolean; pin?: boolean | string } = {}
  ): Promise<InstallationResult> {
    const startTime = Date.now();
    this.emit('installation-started', { pluginId, version, options });

    try {
      const resolved = await this.client.getVersion(pluginId, version);

      // Gated, honest signature verification.
      const gated = this.config.verifySignatures;
      const signature: { verified: boolean; reason?: string; gated: boolean; keyid?: string } = {
        verified: false,
        gated,
      };
      if (gated) {
        const check = await checkVersionSignature(this.client, resolved, true);
        signature.verified = check.verified;
        if (check.reason) signature.reason = check.reason;
        if (check.keyid) signature.keyid = check.keyid;
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
          workspaceRoot: this.workspaceRoot(),
          force: options.force,
          dryRun: options.dryRun,
          pin: options.pin,
          // Fetch from the registry we verified against (npm would otherwise use its own config).
          ...(this.config.apiUrl.replace(/\/+$/, '') !== DEFAULT_REGISTRY_URL
            ? { registry: this.config.apiUrl }
            : {}),
          record: {
            ...(resolved.dist.integrity ? { integrity: resolved.dist.integrity } : {}),
            signature: {
              verified: signature.verified,
              gated: signature.gated,
              ...(signature.keyid ? { keyid: signature.keyid } : {}),
              ...(signature.reason ? { reason: signature.reason } : {}),
              checkedAt: new Date().toISOString(),
            },
          },
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

  /** Clear all cached search and plugin data. */
  clearCache(): void {
    this.cache.clear();
    this.emit('cache-cleared');
  }

  /**
   * Get runtime statistics about the marketplace client.
   *
   * @returns Registry URL, cache size, and selected configuration values.
   */
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
      downloads: hit.downloads?.monthly ?? null,
      rating: searchQuality(hit)?.rating ?? null,
      quality: searchQuality(hit),
      reviewCount: 0,
      teamRating: null,
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
      downloads: null,
      rating: null,
      quality: null,
      reviewCount: 0,
      teamRating: null,
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
        // Ascending by value; `sortOrder: 'desc'` (the default) reverses to highest first.
        case 'downloads':
          return (a.downloads ?? -1) - (b.downloads ?? -1);
        case 'rating':
          return (a.rating ?? -1) - (b.rating ?? -1);
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

  private workspaceRoot(): string {
    return this.config.workspaceRoot ?? process.cwd();
  }

  /** Team review aggregates; a missing/unreadable review file simply means "no reviews" here. */
  private async loadReviewAggregates(): Promise<Awaited<ReturnType<typeof readReviewAggregates>>> {
    try {
      return await readReviewAggregates(this.workspaceRoot());
    } catch {
      return new Map();
    }
  }

  private withTeamReviews(
    plugin: MarketplacePlugin,
    reviews: Awaited<ReturnType<typeof readReviewAggregates>>
  ): MarketplacePlugin {
    const aggregate = reviews.get(plugin.name);
    return aggregate
      ? { ...plugin, reviewCount: aggregate.count, teamRating: aggregate.average }
      : plugin;
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

/**
 * Create a new {@link PluginMarketplace} instance with optional configuration overrides.
 *
 * @param config - Optional partial configuration to override defaults.
 * @returns A configured PluginMarketplace client.
 */
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

/**
 * Format a byte count into a human-readable file size string.
 *
 * @param bytes - Size in bytes.
 * @returns Human-readable size (e.g. `"1.5 MB"`).
 */
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

/**
 * Format a download count into a compact human-readable string.
 *
 * @param count - Raw download count.
 * @returns Abbreviated count (e.g. `"1.2K"`, `"3.4M"`).
 */
export function formatDownloadCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

/** The npm keyword used to tag re-shell plugins on the registry. */
export { PLUGIN_KEYWORD };
