import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab knowledge-sharing` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerKnowledgeSharing(collab: Command): void {
  collab
  .command('knowledge-sharing')
  .description('Generate team knowledge sharing and documentation collaboration with search')
  .argument('<name>', 'Name of the knowledge sharing setup')
  .option('--search-provider <provider>', 'Search provider (elasticsearch, algolia, lunrjs, meilisearch, typesense)', 'elasticsearch')
  .option('--enable-fuzzy-search', 'Enable fuzzy search')
  .option('--enable-highlighting', 'Enable search highlighting')
  .option('--enable-realtime-editing', 'Enable real-time collaborative editing')
  .option('--enable-comments', 'Enable comment system')
  .option('--enable-version-history', 'Enable version history and rollback')
  .option('--max-contributors <number>', 'Maximum concurrent contributors', '10')
  .option('--enable-analytics', 'Enable analytics and insights')
  .option('--enable-notifications', 'Enable notifications for updates')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './knowledge-sharing')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/knowledge-sharing.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      documents: [
        { id: 'd1', title: 'Getting Started Guide', type: 'guide' as const, content: '# Getting Started\n\nWelcome to the platform...', tags: ['onboarding', 'basics'], author: 'user1', contributors: ['user1', 'user2'], createdAt: Date.now(), updatedAt: Date.now(), views: 1250, rating: 4.8 },
        { id: 'd2', title: 'API Reference', type: 'api-reference' as const, content: '# API Reference\n\n## Authentication\n\nAll endpoints require...', tags: ['api', 'rest', 'authentication'], author: 'user2', contributors: ['user2'], createdAt: Date.now(), updatedAt: Date.now(), views: 3420, rating: 4.9 },
        { id: 'd3', title: 'Architecture Decision Record: Microservices', type: 'architecture-decision-record' as const, content: '# ADR: Microservices Architecture\n\n## Status\n\nAccepted\n\n## Context\n\nWe need to scale...', tags: ['architecture', 'microservices', 'adr'], author: 'user3', contributors: ['user3', 'user1'], createdAt: Date.now(), updatedAt: Date.now(), views: 890, rating: 4.7 },
      ],
      comments: [
        { id: 'c1', documentId: 'd1', userId: 'user2', userName: 'Developer 2', content: 'Should we add more examples here?', timestamp: Date.now(), resolved: false },
        { id: 'c2', documentId: 'd2', userId: 'user3', userName: 'Developer 3', content: 'This section needs updating for v2.0', timestamp: Date.now(), resolved: true },
      ],
      search: {
        provider: options.searchProvider as ('elasticsearch' | 'algolia' | 'lunrjs' | 'meilisearch' | 'typesense'),
        indexing: true,
        fuzzySearch: options.enableFuzzySearch || false,
        highlighting: options.enableHighlighting || false,
      },
      collaboration: {
        enableRealTimeEditing: options.enableRealtimeEditing || false,
        enableComments: options.enableComments || false,
        enableSuggestions: true,
        enableVersionHistory: options.enableVersionHistory || false,
        maxContributors: parseInt(options.maxContributors),
      },
      enableAnalytics: options.enableAnalytics || false,
      enableNotifications: options.enableNotifications || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating knowledge sharing configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: knowledge-sharing.tf`));
      console.log(chalk.green(`✅ Generated: knowledge-sharing-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: KNOWLEDGE_SHARING.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: knowledge-sharing-config.json\n`));

      console.log(chalk.green('✓ Knowledge sharing configuration generated successfully!'));
    }, 30000);
  }));

// Performance monitoring collaboration commands
}
