import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { 
  createMarketplace,
  PluginMarketplace,
  MarketplacePlugin,
  PluginCategory,
  MarketplaceSearchFilters,
  isValidPluginId,
  formatFileSize,
  formatDownloadCount
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
}

// Search plugins in marketplace
export async function searchMarketplace(
  query?: string,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, limit = 10, category, featured, verified, free, sort = 'relevance', order = 'desc' } = options;

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
      limit
    };

    const spinner = createSpinner('Searching marketplace...');
    spinner.start();

    const result = await marketplace.searchPlugins(filters);
    
    spinner.stop();

    if (json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n🔍 Marketplace Search Results\n`));

    if (result.plugins.length === 0) {
      console.log(chalk.yellow('No plugins found matching your criteria.'));
      return;
    }

    console.log(chalk.gray(`Found ${result.total} plugin(s), showing ${result.plugins.length}`));
    console.log('');

    result.plugins.forEach(plugin => {
      displayPluginSummary(plugin, verbose);
      console.log('');
    });

    if (result.pages > 1) {
      console.log(chalk.gray(`Page ${result.page} of ${result.pages}`));
    }

  } catch (error) {
    throw new ValidationError(
      `Marketplace search failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Show plugin details
export async function showPluginDetails(
  pluginId: string,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  if (!isValidPluginId(pluginId)) {
    throw new ValidationError(`Invalid plugin ID: ${pluginId}`);
  }

  try {
    const marketplace = createMarketplace();
    
    const spinner = createSpinner(`Fetching plugin details for ${pluginId}...`);
    spinner.start();

    const plugin = await marketplace.getPlugin(pluginId);
    
    spinner.stop();

    if (!plugin) {
      console.log(chalk.red(`Plugin '${pluginId}' not found in marketplace.`));
      return;
    }

    if (json) {
      console.log(JSON.stringify(plugin, null, 2));
      return;
    }

    displayPluginDetails(plugin, verbose);

  } catch (error) {
    throw new ValidationError(
      `Failed to fetch plugin details: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Install plugin from marketplace
export async function installMarketplacePlugin(
  pluginId: string,
  version?: string,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, global = false, force = false } = options;

  if (!isValidPluginId(pluginId)) {
    throw new ValidationError(`Invalid plugin ID: ${pluginId}`);
  }

  try {
    const marketplace = createMarketplace();
    
    const spinner = createSpinner(`Installing ${pluginId}${version ? `@${version}` : ''}...`);
    spinner.start();

    const result = await marketplace.installPlugin(pluginId, version, { global, force });
    
    spinner.stop();

    if (result.success) {
      console.log(chalk.green(`✓ Successfully installed ${pluginId}@${result.installedVersion}`));
      console.log(`  Location: ${result.installPath}`);
      
      if (result.dependencies.length > 0) {
        console.log(`  Dependencies: ${result.dependencies.join(', ')}`);
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('  Warnings:'));
        result.warnings.forEach(warning => {
          console.log(`    ${chalk.yellow('⚠')} ${warning}`);
        });
      }
      
      console.log(chalk.gray(`  Installation completed in ${result.duration}ms`));
      
    } else {
      console.log(chalk.red(`✗ Failed to install ${pluginId}`));
      
      if (result.errors.length > 0) {
        console.log(chalk.red('  Errors:'));
        result.errors.forEach(error => {
          console.log(`    ${chalk.red('✗')} ${error}`);
        });
      }
    }

    if (verbose && result.warnings.length > 0) {
      console.log(chalk.yellow('\nWarnings:'));
      result.warnings.forEach(warning => {
        console.log(`  ${chalk.yellow('⚠')} ${warning}`);
      });
    }

  } catch (error) {
    throw new ValidationError(
      `Plugin installation failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Get plugin reviews
export async function showPluginReviews(
  pluginId: string,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, limit = 10 } = options;

  if (!isValidPluginId(pluginId)) {
    throw new ValidationError(`Invalid plugin ID: ${pluginId}`);
  }

  try {
    const marketplace = createMarketplace();
    
    const spinner = createSpinner(`Fetching reviews for ${pluginId}...`);
    spinner.start();

    const reviews = await marketplace.getPluginReviews(pluginId, limit);
    
    spinner.stop();

    if (json) {
      console.log(JSON.stringify(reviews, null, 2));
      return;
    }

    console.log(chalk.cyan(`\n⭐ Reviews for ${pluginId}\n`));

    if (reviews.length === 0) {
      console.log(chalk.yellow('No reviews found for this plugin.'));
      return;
    }

    reviews.forEach(review => {
      const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
      const verifiedBadge = review.verified ? chalk.green('[Verified]') : '';
      
      console.log(`${chalk.yellow(stars)} ${chalk.white(review.title)} ${verifiedBadge}`);
      console.log(`By ${chalk.blue(review.username)} on ${new Date(review.createdAt).toLocaleDateString()}`);
      console.log(`${review.content}`);
      
      if (verbose && (review.pros?.length || review.cons?.length)) {
        if (review.pros?.length) {
          console.log(chalk.green('  Pros:'));
          review.pros.forEach(pro => console.log(`    + ${pro}`));
        }
        if (review.cons?.length) {
          console.log(chalk.red('  Cons:'));
          review.cons.forEach(con => console.log(`    - ${con}`));
        }
      }
      
      if (review.helpful > 0) {
        console.log(chalk.gray(`  ${review.helpful} people found this helpful`));
      }
      
      console.log('');
    });

  } catch (error) {
    throw new ValidationError(
      `Failed to fetch reviews: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Get featured plugins
export async function showFeaturedPlugins(
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, limit = 6 } = options;

  try {
    const marketplace = createMarketplace();
    
    const spinner = createSpinner('Fetching featured plugins...');
    spinner.start();

    const plugins = await marketplace.getFeaturedPlugins(limit);
    
    spinner.stop();

    if (json) {
      console.log(JSON.stringify(plugins, null, 2));
      return;
    }

    console.log(chalk.cyan('\n🌟 Featured Plugins\n'));

    if (plugins.length === 0) {
      console.log(chalk.yellow('No featured plugins available.'));
      return;
    }

    plugins.forEach(plugin => {
      displayPluginSummary(plugin, verbose);
      console.log('');
    });

  } catch (error) {
    throw new ValidationError(
      `Failed to fetch featured plugins: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Get popular plugins
export async function showPopularPlugins(
  category?: PluginCategory,
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false, limit = 10 } = options;

  try {
    const marketplace = createMarketplace();
    
    const categoryText = category ? ` in ${category}` : '';
    const spinner = createSpinner(`Fetching popular plugins${categoryText}...`);
    spinner.start();

    const plugins = await marketplace.getPopularPlugins(category, limit);
    
    spinner.stop();

    if (json) {
      console.log(JSON.stringify(plugins, null, 2));
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
      console.log(`    ${chalk.gray(`${formatDownloadCount(plugin.downloads)} downloads • ⭐ ${plugin.rating}/5`)}`);
      
      if (verbose) {
        console.log(`    ${chalk.blue(plugin.author)} • ${chalk.gray(plugin.category)} • ${plugin.license}`);
      }
      
      console.log('');
    });

  } catch (error) {
    throw new ValidationError(
      `Failed to fetch popular plugins: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Get plugin categories
export async function showCategories(
  options: MarketplaceCommandOptions = {}
): Promise<void> {
  const { verbose = false, json = false } = options;

  try {
    const marketplace = createMarketplace();
    
    const spinner = createSpinner('Fetching plugin categories...');
    spinner.start();

    const categories = await marketplace.getCategories();
    
    spinner.stop();

    if (json) {
      console.log(JSON.stringify(categories, null, 2));
      return;
    }

    console.log(chalk.cyan('\n📂 Plugin Categories\n'));

    categories.forEach(category => {
      console.log(`${chalk.yellow(category.name)} (${category.count})`);
      if (verbose) {
        console.log(`  ${chalk.gray(category.description)}`);
      }
      console.log('');
    });

    console.log(chalk.gray(`Total: ${categories.reduce((sum, c) => sum + c.count, 0)} plugins across ${categories.length} categories`));

  } catch (error) {
    throw new ValidationError(
      `Failed to fetch categories: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Clear marketplace cache
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

// Get marketplace statistics
export async function showMarketplaceStats(): Promise<void> {
  try {
    const marketplace = createMarketplace();
    
    const stats = marketplace.getStats();
    
    console.log(chalk.cyan('\n📊 Marketplace Statistics\n'));
    
    console.log(chalk.yellow('Cache:'));
    console.log(`  Cached items: ${stats.cacheSize}`);
    console.log(`  Cache timeout: ${Math.round(stats.config.cacheTimeout / 1000)}s`);
    
    console.log(chalk.yellow('\nDownloads:'));
    console.log(`  Active downloads: ${stats.activeDownloads}`);
    console.log(`  Download timeout: ${Math.round(stats.config.downloadTimeout / 1000)}s`);
    
    console.log(chalk.yellow('\nSecurity:'));
    console.log(`  Signature verification: ${stats.config.verifySignatures ? chalk.green('enabled') : chalk.red('disabled')}`);

  } catch (error) {
    throw new ValidationError(
      `Failed to get marketplace stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Display plugin summary
function displayPluginSummary(plugin: MarketplacePlugin, verbose: boolean): void {
  const badges = [];
  if (plugin.featured) badges.push(chalk.yellow('FEATURED'));
  if (plugin.verified) badges.push(chalk.green('VERIFIED'));
  if (plugin.pricing.type === 'free') badges.push(chalk.blue('FREE'));
  
  const badgeText = badges.length > 0 ? ` ${badges.join(' ')}` : '';
  
  console.log(`${chalk.white(plugin.name)}${badgeText}`);
  console.log(`${plugin.description}`);
  console.log(`${chalk.blue(plugin.author)} • v${plugin.version} • ${chalk.gray(plugin.category)}`);
  console.log(`${chalk.gray(`${formatDownloadCount(plugin.downloads)} downloads • ⭐ ${plugin.rating}/5 (${plugin.reviewCount} reviews)`)}`);
  
  if (verbose) {
    console.log(`Keywords: ${plugin.keywords.join(', ')}`);
    console.log(`Size: ${formatFileSize(plugin.size)} • License: ${plugin.license}`);
    console.log(`Updated: ${new Date(plugin.updatedAt).toLocaleDateString()}`);
  }
}

// Display detailed plugin information
function displayPluginDetails(plugin: MarketplacePlugin, verbose: boolean): void {
  console.log(chalk.cyan(`\n📦 ${plugin.name}\n`));
  
  // Basic info
  console.log(`${plugin.description}\n`);
  
  // Badges
  const badges = [];
  if (plugin.featured) badges.push(chalk.yellow('FEATURED'));
  if (plugin.verified) badges.push(chalk.green('VERIFIED'));
  if (plugin.pricing.type === 'free') badges.push(chalk.blue('FREE'));
  
  if (badges.length > 0) {
    console.log(`${badges.join(' ')}\n`);
  }
  
  // Metadata
  console.log(chalk.yellow('Details:'));
  console.log(`  Author: ${chalk.blue(plugin.author)}`);
  console.log(`  Version: ${plugin.version} (latest: ${plugin.latestVersion})`);
  console.log(`  Category: ${plugin.category}`);
  console.log(`  License: ${plugin.license}`);
  console.log(`  Size: ${formatFileSize(plugin.size)}`);
  
  // Stats
  console.log(chalk.yellow('\nStatistics:'));
  console.log(`  Downloads: ${formatDownloadCount(plugin.downloads)}`);
  console.log(`  Rating: ⭐ ${plugin.rating}/5.0 (${plugin.reviewCount} reviews)`);
  console.log(`  Weekly: ${formatDownloadCount(plugin.metrics.weeklyDownloads)}`);
  console.log(`  Monthly: ${formatDownloadCount(plugin.metrics.monthlyDownloads)}`);
  
  // Keywords
  if (plugin.keywords.length > 0) {
    console.log(chalk.yellow('\nKeywords:'));
    console.log(`  ${plugin.keywords.join(', ')}`);
  }
  
  // Compatibility
  console.log(chalk.yellow('\nCompatibility:'));
  console.log(`  CLI Version: ${plugin.compatibility.cliVersion}`);
  console.log(`  Node.js: ${plugin.compatibility.nodeVersion}`);
  console.log(`  Platforms: ${plugin.compatibility.platforms.join(', ')}`);
  
  // Dependencies
  if (Object.keys(plugin.dependencies).length > 0) {
    console.log(chalk.yellow('\nDependencies:'));
    Object.entries(plugin.dependencies).forEach(([name, version]) => {
      console.log(`  ${name}: ${version}`);
    });
  }
  
  // Support
  console.log(chalk.yellow('\nSupport:'));
  if (plugin.support.documentation) {
    console.log(`  Documentation: ${plugin.support.documentation}`);
  }
  if (plugin.support.issues) {
    console.log(`  Issues: ${plugin.support.issues}`);
  }
  if (plugin.support.community) {
    console.log(`  Community: ${plugin.support.community}`);
  }
  console.log(`  Languages: ${plugin.support.languages.join(', ')}`);
  
  // Dates
  console.log(chalk.yellow('\nTimestamps:'));
  console.log(`  Created: ${new Date(plugin.createdAt).toLocaleDateString()}`);
  console.log(`  Updated: ${new Date(plugin.updatedAt).toLocaleDateString()}`);
  
  if (verbose) {
    // Repository metrics
    console.log(chalk.yellow('\nRepository:'));
    console.log(`  Stars: ${plugin.metrics.stars}`);
    console.log(`  Forks: ${plugin.metrics.forks}`);
    console.log(`  Issues: ${plugin.metrics.issues}`);
    console.log(`  Contributors: ${plugin.metrics.contributors}`);
    console.log(`  Last Commit: ${new Date(plugin.metrics.lastCommit).toLocaleDateString()}`);
    
    // Pricing
    console.log(chalk.yellow('\nPricing:'));
    console.log(`  Type: ${plugin.pricing.type}`);
    if (plugin.pricing.price) {
      console.log(`  Price: ${plugin.pricing.currency}${plugin.pricing.price} (${plugin.pricing.billing})`);
    }
    if (plugin.pricing.trialDays) {
      console.log(`  Trial: ${plugin.pricing.trialDays} days`);
    }
  }
}