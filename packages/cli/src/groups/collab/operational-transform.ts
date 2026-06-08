import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab operational-transform` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerOperationalTransform(collab: Command): void {
  collab
  .command('operational-transform')
  .description('Generate Operational Transform for conflict resolution in shared editing')
  .argument('<name>', 'Name of the OT setup')
  .option('--algorithm <algo>', 'OT algorithm (ot0, cactus, juggee, google-wave)', 'ot0')
  .option('--strategy <strategy>', 'Conflict strategy (last-write-wins, operational-transform, crdt)', 'operational-transform')
  .option('--protocol <protocol>', 'Sync protocol (websocket, webrtc, http-long-polling)', 'websocket')
  .option('--enable-presence', 'Enable presence awareness')
  .option('--enable-cursors', 'Enable cursor tracking')
  .option('--enable-selections', 'Enable selection sharing')
  .option('--enable-comments', 'Enable commenting')
  .option('--enable-suggestions', 'Enable suggestion mode')
  .option('--enable-replay', 'Enable operation replay')
  .option('--enable-conflict-detection', 'Enable conflict detection')
  .option('--enable-auto-merge', 'Enable auto merge')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './operational-transform')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/operational-transform.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      transform: {
        enabled: true,
        algorithm: options.algorithm as ('ot0' | 'cactus' | 'juggee' | 'google-wave'),
        conflictStrategy: options.strategy as ('last-write-wins' | 'operational-transform' | 'crdt'),
        syncProtocol: options.protocol as ('websocket' | 'webrtc' | 'http-long-polling'),
        broadcast: true,
        delay: 50,
      },
      documentState: {
        version: 1,
        hash: '',
        participants: [],
        locks: {},
      },
      features: {
        presence: options.enablePresence || false,
        cursors: options.enableCursors || false,
        selections: options.enableSelections || false,
        comments: options.enableComments || false,
        suggestions: options.enableSuggestions || false,
      },
      enableReplay: options.enableReplay || false,
      enableConflictDetection: options.enableConflictDetection || false,
      enableAutoMerge: options.enableAutoMerge || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating operational transform configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: operational-transform.tf`));
      console.log(chalk.green(`✅ Generated: operational-transform-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: OPERATIONAL_TRANSFORM.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: operational-transform-config.json\n`));

      console.log(chalk.green('✓ Operational transform configuration generated successfully!'));
    }, 30000);
  }));

// Session recording commands
}
