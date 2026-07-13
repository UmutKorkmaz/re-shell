import { describe, expect, it } from 'vitest';
import {
  formatBadges,
  formatRating,
  formatPluginRow,
  formatPluginDetail,
  formatSearchResults,
  formatCategoryList,
  tableLayout,
} from '../../src/utils/marketplace-display';
import type { MarketplacePlugin } from '../../src/utils/plugin-marketplace';

function makePlugin(overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin {
  return {
    id: 'reshell-plugin-test',
    name: 'reshell-plugin-test',
    version: '1.2.0',
    latestVersion: '1.2.0',
    description: 'A test plugin for re-shell',
    author: 'testauthor',
    license: 'MIT',
    keywords: ['reshell-plugin', 'testing'],
    category: 'development' as any,
    downloads: 25300,
    rating: 4.2,
    reviewCount: 18,
    featured: false,
    verified: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2025-06-01T00:00:00.000Z',
    size: 45056,
    dependencies: { chalk: '^4.1.0', 'fs-extra': '^10.0.0' },
    compatibility: { cliVersion: '>=0.30.0', nodeVersion: '>=18.0.0', platforms: ['linux', 'darwin'] },
    pricing: { type: 'free' },
    support: { languages: ['en'] },
    ...overrides,
  };
}

describe('formatBadges', () => {
  it('shows [SIGNED] for verified plugin', () => {
    const result = formatBadges(makePlugin({ verified: true }));
    expect(result).toContain('[SIGNED]');
  });

  it('shows [FREE] for free pricing', () => {
    const result = formatBadges(makePlugin({ pricing: { type: 'free' } as any }));
    expect(result).toContain('[FREE]');
  });

  it('shows [FEATURED] for featured plugin', () => {
    const result = formatBadges(makePlugin({ featured: true }));
    expect(result).toContain('[FEATURED]');
  });

  it('shows all three badges when all apply', () => {
    const result = formatBadges(makePlugin({ verified: true, featured: true, pricing: { type: 'free' } as any }));
    expect(result).toContain('[SIGNED]');
    expect(result).toContain('[FREE]');
    expect(result).toContain('[FEATURED]');
  });

  it('returns empty string when no badges apply', () => {
    const result = formatBadges(makePlugin({ verified: false, featured: false, pricing: { type: 'paid' } as any }));
    expect(result).toBe('');
  });
});

describe('formatRating', () => {
  it('formats 5.0 as five full stars', () => {
    const result = formatRating(5.0);
    expect(result).toContain('★★★★★');
    expect(result).toContain('5.0');
  });

  it('formats 4.2 as four full and one empty', () => {
    const result = formatRating(4.2);
    expect(result).toContain('★★★★☆');
    expect(result).toContain('4.2');
  });

  it('formats 0 as all empty stars', () => {
    const result = formatRating(0);
    expect(result).toContain('☆☆☆☆☆');
    expect(result).toContain('0.0');
  });

  it('formats 3.0 as three full stars', () => {
    const result = formatRating(3.0);
    expect(result).toContain('★★★☆☆');
    expect(result).toContain('3.0');
  });

  it('always has exactly 5 star characters', () => {
    const result = formatRating(2.5);
    const stars = result.match(/[★☆]/g);
    expect(stars).toHaveLength(5);
  });
});

describe('formatPluginRow', () => {
  it('includes plugin name and description', () => {
    const plugin = makePlugin();
    const result = formatPluginRow(plugin);
    expect(result).toContain('reshell-plugin-test');
    expect(result).toContain('A test plugin for re-shell');
  });

  it('includes author and version', () => {
    const plugin = makePlugin();
    const result = formatPluginRow(plugin);
    expect(result).toContain('testauthor');
    expect(result).toContain('1.2.0');
  });

  it('includes category', () => {
    const plugin = makePlugin();
    const result = formatPluginRow(plugin);
    expect(result).toContain('development');
  });

  it('includes rating and downloads', () => {
    const plugin = makePlugin();
    const result = formatPluginRow(plugin);
    expect(result).toContain('★★★★');
    expect(result).toContain('downloads');
  });

  it('verbose mode includes keywords', () => {
    const plugin = makePlugin();
    const result = formatPluginRow(plugin, true);
    expect(result).toContain('reshell-plugin');
    expect(result).toContain('testing');
  });

  it('verbose mode includes size and license', () => {
    const plugin = makePlugin();
    const result = formatPluginRow(plugin, true);
    expect(result).toContain('MIT');
    expect(result).toContain('KB');
  });
});

describe('formatPluginDetail', () => {
  it('includes plugin name with emoji header', () => {
    const result = formatPluginDetail(makePlugin());
    expect(result).toContain('reshell-plugin-test');
    expect(result).toContain('A test plugin for re-shell');
  });

  it('includes Stats section', () => {
    const result = formatPluginDetail(makePlugin());
    expect(result).toContain('Stats');
    expect(result).toContain('Downloads');
    expect(result).toContain('Rating');
    expect(result).toContain('Size');
  });

  it('includes Compatibility section', () => {
    const result = formatPluginDetail(makePlugin());
    expect(result).toContain('Compatibility');
    expect(result).toContain('>=0.30.0');
    expect(result).toContain('>=18.0.0');
  });

  it('includes Dependencies section when deps exist', () => {
    const result = formatPluginDetail(makePlugin());
    expect(result).toContain('Dependencies');
    expect(result).toContain('chalk');
    expect(result).toContain('fs-extra');
  });

  it('omits Dependencies section when deps empty', () => {
    const result = formatPluginDetail(makePlugin({ dependencies: {} }));
    expect(result).not.toContain('Dependencies');
  });

  it('includes Links section when homepage/repo exist', () => {
    const result = formatPluginDetail(makePlugin({ homepage: 'https://example.com', repository: 'https://github.com/x/y' }));
    expect(result).toContain('Links');
    expect(result).toContain('https://example.com');
    expect(result).toContain('https://github.com/x/y');
  });

  it('omits Links section when no links', () => {
    const result = formatPluginDetail(makePlugin({ homepage: undefined, repository: undefined }));
    expect(result).not.toContain('Links');
  });

  it('verbose mode includes Keywords section', () => {
    const result = formatPluginDetail(makePlugin(), true);
    expect(result).toContain('Keywords');
    expect(result).toContain('reshell-plugin');
  });

  it('verbose mode includes Timestamps section', () => {
    const result = formatPluginDetail(makePlugin(), true);
    expect(result).toContain('Timestamps');
    expect(result).toContain('Created');
    expect(result).toContain('Updated');
  });
});

describe('formatSearchResults', () => {
  it('includes header for multiple results', () => {
    const plugins = [makePlugin(), makePlugin({ name: 'reshell-plugin-2', id: 'reshell-plugin-2' })];
    const result = formatSearchResults(plugins, 1, 3, 25);
    expect(result).toContain('Search Results');
    expect(result).toContain('25');
  });

  it('shows both plugin names', () => {
    const plugins = [makePlugin(), makePlugin({ name: 'reshell-plugin-2', id: 'reshell-plugin-2' })];
    const result = formatSearchResults(plugins, 1, 1, 2);
    expect(result).toContain('reshell-plugin-test');
    expect(result).toContain('reshell-plugin-2');
  });

  it('includes separator between plugins', () => {
    const plugins = [makePlugin(), makePlugin({ name: 'reshell-plugin-2', id: 'reshell-plugin-2' })];
    const result = formatSearchResults(plugins, 1, 1, 2);
    expect(result).toContain('─');
  });

  it('includes pagination info when multiple pages', () => {
    const result = formatSearchResults([makePlugin()], 2, 5, 50);
    expect(result).toContain('Page 2 of 5');
  });

  it('omits pagination when single page', () => {
    const result = formatSearchResults([makePlugin()], 1, 1, 1);
    expect(result).not.toContain('Page');
  });

  it('shows no results message for empty array', () => {
    const result = formatSearchResults([], 1, 1, 0);
    expect(result).toContain('No plugins found');
  });
});

describe('formatCategoryList', () => {
  it('formats categories with names and counts', () => {
    const result = formatCategoryList([
      { name: 'development', count: 42 },
      { name: 'automation', count: 28 },
    ]);
    expect(result).toContain('development');
    expect(result).toContain('42');
    expect(result).toContain('automation');
    expect(result).toContain('28');
  });

  it('includes descriptions when provided', () => {
    const result = formatCategoryList([
      { name: 'security', count: 5, description: 'Security-focused plugins' },
    ]);
    expect(result).toContain('Security-focused plugins');
  });

  it('includes total at bottom', () => {
    const result = formatCategoryList([
      { name: 'development', count: 42 },
      { name: 'automation', count: 28 },
    ]);
    expect(result).toContain('70');
    expect(result).toContain('2 categories');
  });
});

describe('tableLayout', () => {
  it('aligns columns with padding', () => {
    const result = tableLayout(
      ['Name', 'Version'],
      [['plugin-a', '1.0.0'], ['plugin-b', '2.0.0']]
    );
    expect(result).toContain('Name');
    expect(result).toContain('Version');
    expect(result).toContain('plugin-a');
    expect(result).toContain('1.0.0');
    expect(result).toContain('plugin-b');
    expect(result).toContain('2.0.0');
  });

  it('handles single column', () => {
    const result = tableLayout(['Name'], [['plugin-a'], ['plugin-b']]);
    expect(result).toContain('plugin-a');
    expect(result).toContain('plugin-b');
  });

  it('truncates long content at 30 chars', () => {
    const longName = 'a'.repeat(40);
    const result = tableLayout(['Name'], [[longName]]);
    expect(result).toContain('a'.repeat(27) + '...');
  });
});
