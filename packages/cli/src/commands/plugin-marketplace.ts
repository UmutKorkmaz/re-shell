import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ErrorCode } from '@umutkorkmaz/contracts';
import { RegistryUnreachableError } from '../utils/registry-client';
import {
  createMarketplace,
  MarketplacePlugin,
  PluginCategory,
  MarketplaceSearchFilters,
  isValidPluginId,
  formatFileSize,
} from '../utils/plugin-marketplace';

interface MarketplaceCommandOptions {
  verbose?: boolean;
  json?: boolean;
  limit?: number;
  category?: PluginCategory;
  featured?: boolean;
  verified?: boolean;
  free?: boolean;
  sort?: 'relevance' | 'downloads' | 'rating' | 'updated' | 'created' | 'name';
  order?: 'asc' | 'desc';
  global?: boolean;
  force?: boolean;
  dryRun?: boolean;
  /** Commander maps `--no-verify` to `verify: false` (defaults to true). */
  verify?: boolean;
}

/**
 * Map a thrown error to the right JSON ErrorCode. Registry transport failures
 * become MARKETPLACE_UNREACHABLE; signature/validation rejections become
 * MARKETPLACE_VERIFY_ERROR; everything else MARKETPLACE_ERROR. There is no mock
 * fallback anywhere — failures are reported honestly.
 */
function classifyError(error: unknown, defaultCode: ErrorCode = 'MARKETPLACE_ERROR'): {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
} {
  if (error instanceof RegistryUnreachableError) {
    return { code: 'MARKETPLACE_UNREACHABLE', message: error.message, details: error.details };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/unverified|signature|verification/i.test(message)) {
    return { code: 'MARKETPLACE_VERIFY_ERROR', message };
  }
  return { code: defaultCode, message };
}

// Search plugins in marketplace (real npm registry, keyword-scoped).
export async function searchMarketplace(
  query?: string,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const {
    verbose = false,
    json = false,
    limit = 10,
    category,
    featured,
    verified,
    free,
    sort = 'relevance',
    order = 'desc',
  } = options;
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const marketplace = createMarketplace();
    const filters: MarketplaceSearchFilters = {
      query,
      category,
      featured,
      verified,
      free,
      sortBy: sort,
      sortOrder: order,
      limit,
    };

    const spinner = json ? undefined : createSpinner('Searching marketplace...');
    if (spinner) spinner.start();

    const result = await marketplace.searchPlugins(filters);
    if (spinner) spinner.stop();

    if (json) {
      ok({
        plugins: result.plugins,
        total: result.total,
        page: result.page,
        pages: result.pages,
      });
      return;
    }

    console.log(chalk.cyan(`\n🔍 Marketplace Search Results\n`));
    if (result.plugins.length === 0) {
      console.log(chalk.yellow('No plugins found matching your criteria.'));
      return;
    }
    console.log(chalk.gray(`Found ${result.total} plugin(s), showing ${result.plugins.length}`));
    console.log('');
    result.plugins.forEach((plugin) => {
      displayPluginSummary(plugin, verbose);
      console.log('');
    });
    if (result.pages > 1) {
      console.log(chalk.gray(`Page ${result.page} of ${result.pages}`));
    }
  } catch (error) {
    const { code, message, details } = classifyError(error);
    if (json) {
      fail(code, message, details);
      return;
    }
    throw new ValidationError(`Marketplace search failed: ${message}`);
  } finally {
    restoreJson();
  }
}

// Show plugin details from the registry.
export async function showPluginDetails(
  pluginId: string,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    if (!isValidPluginId(pluginId)) {
      throw new ValidationError(`Invalid plugin ID: ${pluginId}`);
    }

    const marketplace = createMarketplace();
    const spinner = json ? undefined : createSpinner(`Fetching plugin details for ${pluginId}...`);
    if (spinner) spinner.start();

    const plugin = await marketplace.getPlugin(pluginId);
    if (spinner) spinner.stop();

    if (!plugin) {
      if (json) {
        fail('MARKETPLACE_ERROR', `Plugin '${pluginId}' not found in marketplace`);
        return;
      }
      console.log(chalk.red(`Plugin '${pluginId}' not found in marketplace.`));
      return;
    }

    if (json) {
      ok(plugin);
      return;
    }
    displayPluginDetails(plugin, verbose);
  } catch (error) {
    const { code, message, details } = classifyError(error);
    if (json) {
      fail(code, message, details);
      return;
    }
    throw new ValidationError(`Failed to fetch plugin details: ${message}`);
  } finally {
    restoreJson();
  }
}

// Install plugin from marketplace (gated signature verify + delegate to installer).
export async function installMarketplacePlugin(
  pluginId: string,
  version?: string,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, force = false, dryRun = false, verify = true } = options;
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    if (!isValidPluginId(pluginId)) {
      throw new ValidationError(`Invalid plugin ID: ${pluginId}`);
    }

    // verifySignatures is true by default; --no-verify is an explicit, honest opt-out.
    const marketplace = createMarketplace({ verifySignatures: verify });
    const spinner = json
      ? undefined
      : createSpinner(`Installing ${pluginId}${version ? `@${version}` : ''}...`);
    if (spinner) spinner.start();

    const result = await marketplace.installPlugin(pluginId, version, { force, dryRun });
    if (spinner) spinner.stop();

    if (!result.success) {
      const { code, message } = classifyError(
        new Error(result.errors.join('; ') || 'Installation failed')
      );
      if (json) {
        fail(code, message);
        return;
      }
      console.log(chalk.red(`✗ Failed to install ${pluginId}`));
      result.errors.forEach((e) => console.log(`    ${chalk.red('✗')} ${e}`));
      return;
    }

    if (json) {
      ok(
        {
          name: result.plugin?.name ?? pluginId,
          installedVersion: result.installedVersion,
          installPath: result.installPath,
          source: result.source,
          signature: result.signature,
        },
        result.warnings
      );
      return;
    }

    console.log(chalk.green(`✓ Successfully installed ${pluginId}@${result.installedVersion}`));
    console.log(`  Location: ${result.installPath}`);
    console.log(
      `  Signature: ${
        result.signature.verified
          ? chalk.green('verified')
          : result.signature.gated
            ? chalk.red('unverified')
            : chalk.yellow('not checked (verification disabled)')
      }`
    );
    result.warnings.forEach((w) => console.log(`    ${chalk.yellow('⚠')} ${w}`));
    if (verbose) console.log(chalk.gray(`  Completed in ${result.duration}ms`));
  } catch (error) {
    const { code, message, details } = classifyError(error);
    if (json) {
      fail(code, message, details);
      return;
    }
    throw new ValidationError(`Plugin installation failed: ${message}`);
  } finally {
    restoreJson();
  }
}

// Featured plugins (top relevance hits from the registry).
export async function showFeaturedPlugins(options: MarketplaceCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false, limit = 6 } = options;
  const restoreJson = json ? enableJsonMode() : () => {};
  try {
    const marketplace = createMarketplace();
    const spinner = json ? undefined : createSpinner('Fetching featured plugins...');
    if (spinner) spinner.start();
    const plugins = await marketplace.getFeaturedPlugins(limit);
    if (spinner) spinner.stop();

    if (json) {
      ok({ plugins });
      return;
    }
    console.log(chalk.cyan('\n🌟 Featured Plugins\n'));
    if (plugins.length === 0) {
      console.log(chalk.yellow('No featured plugins available.'));
      return;
    }
    plugins.forEach((plugin) => {
      displayPluginSummary(plugin, verbose);
      console.log('');
    });
  } catch (error) {
    const { code, message, details } = classifyError(error);
    if (json) {
      fail(code, message, details);
      return;
    }
    throw new ValidationError(`Failed to fetch featured plugins: ${message}`);
  } finally {
    restoreJson();
  }
}

// Popular plugins.
export async function showPopularPlugins(
  category?: PluginCategory,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, limit = 10 } = options;
  const restoreJson = json ? enableJsonMode() : () => {};
  try {
    const marketplace = createMarketplace();
    const categoryText = category ? ` in ${category}` : '';
    const spinner = json ? undefined : createSpinner(`Fetching popular plugins${categoryText}...`);
    if (spinner) spinner.start();
    const plugins = await marketplace.getPopularPlugins(category, limit);
    if (spinner) spinner.stop();

    if (json) {
      ok({ plugins });
      return;
    }
    console.log(chalk.cyan(`\n🔥 Popular Plugins${categoryText}\n`));
    if (plugins.length === 0) {
      console.log(chalk.yellow('No popular plugins found.'));
      return;
    }
    plugins.forEach((plugin, index) => {
      console.log(`${chalk.yellow((index + 1).toString().padStart(2))}. ${chalk.white(plugin.name)}`);
      console.log(`    ${plugin.description}`);
      if (verbose) {
        console.log(`    ${chalk.blue(plugin.author)} • ${chalk.gray(plugin.category)} • ${plugin.license}`);
      }
      console.log('');
    });
  } catch (error) {
    const { code, message, details } = classifyError(error);
    if (json) {
      fail(code, message, details);
      return;
    }
    throw new ValidationError(`Failed to fetch popular plugins: ${message}`);
  } finally {
    restoreJson();
  }
}

// Plugin categories (live counts derived from a registry search pass).
export async function showCategories(options: MarketplaceCommandOptions = {}): Promise<void> {
  const { verbose = false, json = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};
  try {
    const marketplace = createMarketplace();
    const spinner = json ? undefined : createSpinner('Fetching plugin categories...');
    if (spinner) spinner.start();
    const categories = await marketplace.getCategories();
    if (spinner) spinner.stop();

    if (json) {
      ok({ categories });
      return;
    }
    console.log(chalk.cyan('\n📂 Plugin Categories\n'));
    categories.forEach((category) => {
      console.log(`${chalk.yellow(category.name)} (${category.count})`);
      if (verbose) console.log(`  ${chalk.gray(category.description)}`);
      console.log('');
    });
    console.log(
      chalk.gray(
        `Total: ${categories.reduce((sum, c) => sum + c.count, 0)} plugins across ${categories.length} categories`
      )
    );
  } catch (error) {
    const { code, message, details } = classifyError(error);
    if (json) {
      fail(code, message, details);
      return;
    }
    throw new ValidationError(`Failed to fetch categories: ${message}`);
  } finally {
    restoreJson();
  }
}

// Clear marketplace cache.
export async function clearMarketplaceCache(): Promise<void> {
  try {
    const marketplace = createMarketplace();
    marketplace.clearCache();
    console.log(chalk.green('✓ Marketplace cache cleared'));
  } catch (error) {
    throw new ValidationError(
      `Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Marketplace statistics.
export async function showMarketplaceStats(): Promise<void> {
  try {
    const marketplace = createMarketplace();
    const stats = marketplace.getStats();
    console.log(chalk.cyan('\n📊 Marketplace Statistics\n'));
    console.log(chalk.yellow('Registry:'));
    console.log(`  URL: ${stats.registryUrl}`);
    console.log(chalk.yellow('\nCache:'));
    console.log(`  Cached items: ${stats.cacheSize}`);
    console.log(`  Cache timeout: ${Math.round(stats.config.cacheTimeout / 1000)}s`);
    console.log(chalk.yellow('\nSecurity:'));
    console.log(
      `  Signature verification: ${
        stats.config.verifySignatures ? chalk.green('enabled') : chalk.red('disabled')
      }`
    );
  } catch (error) {
    throw new ValidationError(
      `Failed to get marketplace stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Display plugin summary.
function displayPluginSummary(plugin: MarketplacePlugin, verbose: boolean): void {
  const badges: string[] = [];
  if (plugin.verified) badges.push(chalk.green('SIGNED'));
  if (plugin.pricing.type === 'free') badges.push(chalk.blue('FREE'));
  const badgeText = badges.length > 0 ? ` ${badges.join(' ')}` : '';

  console.log(`${chalk.white(plugin.name)}${badgeText}`);
  console.log(`${plugin.description}`);
  console.log(`${chalk.blue(plugin.author)} • v${plugin.version} • ${chalk.gray(plugin.category)}`);
  if (verbose) {
    console.log(`Keywords: ${plugin.keywords.join(', ')}`);
    if (plugin.size > 0) console.log(`Size: ${formatFileSize(plugin.size)}`);
    console.log(`License: ${plugin.license}`);
    if (plugin.updatedAt) console.log(`Updated: ${new Date(plugin.updatedAt).toLocaleDateString()}`);
  }
}

// Display detailed plugin information.
function displayPluginDetails(plugin: MarketplacePlugin, verbose: boolean): void {
  console.log(chalk.cyan(`\n📦 ${plugin.name}\n`));
  console.log(`${plugin.description}\n`);

  console.log(chalk.yellow('Details:'));
  console.log(`  Author: ${chalk.blue(plugin.author)}`);
  console.log(`  Version: ${plugin.version} (latest: ${plugin.latestVersion})`);
  console.log(`  Category: ${plugin.category}`);
  console.log(`  License: ${plugin.license}`);
  if (plugin.size > 0) console.log(`  Size: ${formatFileSize(plugin.size)}`);
  console.log(`  Signed: ${plugin.verified ? chalk.green('yes') : chalk.yellow('no')}`);

  if (plugin.keywords.length > 0) {
    console.log(chalk.yellow('\nKeywords:'));
    console.log(`  ${plugin.keywords.join(', ')}`);
  }

  console.log(chalk.yellow('\nCompatibility:'));
  console.log(`  Node.js: ${plugin.compatibility.nodeVersion}`);

  if (Object.keys(plugin.dependencies).length > 0) {
    console.log(chalk.yellow('\nDependencies:'));
    Object.entries(plugin.dependencies).forEach(([name, version]) => {
      console.log(`  ${name}: ${version}`);
    });
  }

  if (plugin.homepage || plugin.repository) {
    console.log(chalk.yellow('\nLinks:'));
    if (plugin.homepage) console.log(`  Homepage: ${plugin.homepage}`);
    if (plugin.repository) console.log(`  Repository: ${plugin.repository}`);
  }

  if (verbose && plugin.createdAt) {
    console.log(chalk.yellow('\nTimestamps:'));
    console.log(`  Created: ${new Date(plugin.createdAt).toLocaleDateString()}`);
    if (plugin.updatedAt) console.log(`  Updated: ${new Date(plugin.updatedAt).toLocaleDateString()}`);
  }
}
