import chalk from 'chalk';
import { formatFileSize, formatDownloadCount } from './plugin-marketplace';
import type { MarketplacePlugin } from './plugin-marketplace';

export { formatFileSize, formatDownloadCount };

// --- Badge formatting ---

export function formatBadges(plugin: MarketplacePlugin): string {
  const badges: string[] = [];
  if (plugin.verified) badges.push(chalk.green('[SIGNED]'));
  if (plugin.pricing.type === 'free') badges.push(chalk.blue('[FREE]'));
  if (plugin.featured) badges.push(chalk.magenta('[FEATURED]'));
  return badges.length > 0 ? ` ${badges.join(' ')}` : '';
}

// --- Rating formatting ---

export function formatRating(rating: number): string {
  const rounded = Math.round(rating);
  const fullStars = Math.max(0, Math.min(5, rounded));
  const emptyStars = 5 - fullStars;
  const stars = '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
  return `${chalk.yellow(stars)} ${chalk.gray(rating.toFixed(1))}`;
}

// --- Plugin row (for search/list results) ---

export function formatPluginRow(plugin: MarketplacePlugin, verbose?: boolean): string {
  const lines: string[] = [];
  const badges = formatBadges(plugin);

  lines.push(`${chalk.white.bold(plugin.name)}${badges}`);
  lines.push(plugin.description);
  lines.push(
    `${chalk.blue(plugin.author)} • v${plugin.version} • ${chalk.cyan(plugin.category)} • ${formatRating(plugin.rating)} • ${formatDownloadCount(plugin.downloads)} downloads`
  );

  if (verbose) {
    const metaParts: string[] = [];
    if (plugin.keywords.length > 0) metaParts.push(`Keywords: ${plugin.keywords.join(', ')}`);
    if (plugin.size > 0) metaParts.push(`Size: ${formatFileSize(plugin.size)}`);
    metaParts.push(`License: ${plugin.license}`);
    if (plugin.updatedAt) metaParts.push(`Updated: ${new Date(plugin.updatedAt).toLocaleDateString()}`);
    lines.push(chalk.gray(metaParts.join('  •  ')));
  }

  return lines.join('\n');
}

// --- Plugin detail (for show command) ---

export function formatPluginDetail(plugin: MarketplacePlugin, verbose?: boolean): string {
  const lines: string[] = [];
  const badges = formatBadges(plugin);

  lines.push(`${chalk.cyan('📦')} ${chalk.white.bold(plugin.name)}${badges}`);
  lines.push(plugin.description);
  lines.push('');

  // Stats section
  lines.push(`  ${chalk.cyan.bold('Stats')}`);
  lines.push(`    ${chalk.gray('Downloads:')}  ${formatDownloadCount(plugin.downloads)}`);
  lines.push(`    ${chalk.gray('Rating:')}     ${formatRating(plugin.rating)} (${plugin.reviewCount} reviews)`);
  if (plugin.size > 0) lines.push(`    ${chalk.gray('Size:')}       ${formatFileSize(plugin.size)}`);
  if (plugin.updatedAt) lines.push(`    ${chalk.gray('Updated:')}    ${new Date(plugin.updatedAt).toLocaleDateString()}`);
  lines.push('');

  // Compatibility section
  lines.push(`  ${chalk.cyan.bold('Compatibility')}`);
  lines.push(`    ${chalk.gray('CLI:')}        ${plugin.compatibility.cliVersion}`);
  lines.push(`    ${chalk.gray('Node.js:')}    ${plugin.compatibility.nodeVersion}`);
  if (plugin.compatibility.platforms.length > 0) {
    lines.push(`    ${chalk.gray('Platforms:')}  ${plugin.compatibility.platforms.join(', ')}`);
  }
  lines.push('');

  // Dependencies section
  const depEntries = Object.entries(plugin.dependencies);
  if (depEntries.length > 0) {
    lines.push(`  ${chalk.cyan.bold('Dependencies')}`);
    for (const [name, version] of depEntries) {
      lines.push(`    ${name}: ${version}`);
    }
    lines.push('');
  }

  // Links section
  if (plugin.homepage || plugin.repository) {
    lines.push(`  ${chalk.cyan.bold('Links')}`);
    if (plugin.homepage) lines.push(`    ${chalk.gray('Homepage:')}   ${plugin.homepage}`);
    if (plugin.repository) lines.push(`    ${chalk.gray('Repository:')} ${plugin.repository}`);
    lines.push('');
  }

  // Verbose-only sections
  if (verbose) {
    if (plugin.keywords.length > 0) {
      lines.push(`  ${chalk.cyan.bold('Keywords')}`);
      lines.push(`    ${plugin.keywords.join(', ')}`);
      lines.push('');
    }

    lines.push(`  ${chalk.cyan.bold('Timestamps')}`);
    if (plugin.createdAt) lines.push(`    ${chalk.gray('Created:')}  ${new Date(plugin.createdAt).toLocaleDateString()}`);
    if (plugin.updatedAt) lines.push(`    ${chalk.gray('Updated:')}  ${new Date(plugin.updatedAt).toLocaleDateString()}`);
  }

  return lines.join('\n').trimEnd();
}

// --- Search results page ---

export function formatSearchResults(
  plugins: MarketplacePlugin[],
  page: number,
  totalPages: number,
  total: number
): string {
  if (plugins.length === 0) {
    return `${chalk.cyan('\n🔍 Search Results\n')}\n${chalk.yellow('No plugins found matching your criteria.')}`;
  }

  const lines: string[] = [];
  lines.push(chalk.cyan(`\n🔍 Search Results\n`));
  lines.push(chalk.gray(`Found ${total} plugin(s), showing ${plugins.length}`));
  lines.push('');

  plugins.forEach((plugin, index) => {
    lines.push(formatPluginRow(plugin));
    if (index < plugins.length - 1) {
      lines.push(chalk.gray('─'.repeat(60)));
    }
  });

  if (totalPages > 1) {
    lines.push('');
    lines.push(chalk.gray(`Page ${page} of ${totalPages}`));
  }

  return lines.join('\n');
}

// --- Category list ---

export function formatCategoryList(
  categories: { name: string; count: number; description?: string }[]
): string {
  if (categories.length === 0) {
    return chalk.yellow('No categories found.');
  }

  const lines: string[] = [];
  lines.push(chalk.cyan('\n📂 Plugin Categories\n'));

  categories.forEach(category => {
    lines.push(`${chalk.cyan(category.name)}  ${chalk.gray(`(${category.count})`)}`);
    if (category.description) {
      lines.push(`  ${chalk.gray(category.description)}`);
    }
    lines.push('');
  });

  const total = categories.reduce((sum, c) => sum + c.count, 0);
  lines.push(chalk.gray(`Total: ${total} plugins across ${categories.length} categories`));

  return lines.join('\n');
}

// --- Table layout utility ---

export function tableLayout(headers: string[], rows: string[][]): string {
  const MAX_COL_WIDTH = 30;
  const colCount = headers.length;
  const widths: number[] = new Array(colCount).fill(0);

  // Calculate column widths
  for (let i = 0; i < colCount; i++) {
    widths[i] = Math.max(widths[i], headers[i].length);
  }
  for (const row of rows) {
    for (let i = 0; i < colCount && i < row.length; i++) {
      widths[i] = Math.max(widths[i], Math.min(MAX_COL_WIDTH, row[i].length));
    }
  }

  const padCell = (text: string, width: number) => {
    if (text.length > MAX_COL_WIDTH) {
      return text.substring(0, MAX_COL_WIDTH - 3) + '...';
    }
    return text.padEnd(width);
  };

  const lines: string[] = [];
  lines.push(chalk.gray.bold(headers.map((h, i) => padCell(h, widths[i])).join('  ')));
  for (const row of rows) {
    lines.push(row.map((cell, i) => padCell(cell, widths[i] || 0)).join('  '));
  }

  return lines.join('\n');
}
