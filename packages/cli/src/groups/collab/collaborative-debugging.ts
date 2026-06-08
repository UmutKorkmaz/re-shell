import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../../utils/error-handler';
import chalk from 'chalk';

/**
 * Registers the `collab collaborative-debugging` subcommand.
 * Extracted verbatim from the former monolithic collab.group.ts.
 */
export function registerCollaborativeDebugging(collab: Command): void {
  collab
  .command('collaborative-debugging')
  .description('Generate collaborative debugging across multiple services with shared breakpoints')
  .argument('<name>', 'Name of the collaborative debugging setup')
  .option('--protocol <protocol>', 'Debugger protocol (chrome-devtools, debug-adapter-protocol, gdb, pdb)', 'debug-adapter-protocol')
  .option('--max-participants <number>', 'Maximum participants', '10')
  .option('--enable-shared-breakpoints', 'Enable shared breakpoints')
  .option('--enable-shared-console', 'Enable shared console')
  .option('--enable-variable-inspection', 'Enable variable inspection')
  .option('--enable-callstack-sharing', 'Enable call stack sharing')
  .option('--enable-remote-debugging', 'Enable remote debugging')
  .option('--enable-hot-reload', 'Enable hot reload')
  .option('--enable-aws', 'Enable AWS integration')
  .option('--enable-azure', 'Enable Azure integration')
  .option('--enable-gcp', 'Enable GCP integration')
  .option('--output <dir>', 'Output directory', './collaborative-debugging')
  .option('--language <lang>', 'Language for manager code (typescript|python)', 'typescript')
  .action(createAsyncCommand(async (name, options) => {
    const { writeFiles, displayConfig } = await import('../../utils/collaborative-debugging.js');

    const providers: ('aws' | 'azure' | 'gcp')[] = [];
    if (options.enableAws) providers.push('aws');
    if (options.enableAzure) providers.push('azure');
    if (options.enableGcp) providers.push('gcp');

    const config = {
      projectName: name,
      providers,
      protocol: options.protocol as ('chrome-devtools' | 'debug-adapter-protocol' | 'gdb' | 'pdb'),
      breakpoints: [
        { id: 'bp1', type: 'line' as const, file: 'index.js', line: 42, enabled: true },
        { id: 'bp2', type: 'conditional' as const, file: 'api.ts', line: 15, condition: 'userId > 0', enabled: true },
        { id: 'bp3', type: 'logpoint' as const, file: 'utils.js', line: 89, logMessage: 'Processing data: ${data}', enabled: true },
      ],
      sessions: [],
      collaboration: {
        maxParticipants: parseInt(options.maxParticipants),
        sharedBreakpoints: options.enableSharedBreakpoints || false,
        sharedConsole: options.enableSharedConsole || false,
        variableInspection: options.enableVariableInspection || false,
        callStackSharing: options.enableCallstackSharing || false,
        memoryInspection: true,
      },
      enableRemoteDebugging: options.enableRemoteDebugging || false,
      enableHotReload: options.enableHotReload || false,
    };

    displayConfig(config);

    console.log(chalk.gray('Generating collaborative debugging configuration...'));

    await withTimeout(async () => {
      await writeFiles(config, options.output, options.language);
      console.log(chalk.green(`\n✅ Generated: collaborative-debugging.tf`));
      console.log(chalk.green(`✅ Generated: collaborative-debugging-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
      console.log(chalk.green(`✅ Generated: COLLABORATIVE_DEBUGGING.md`));
      console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
      console.log(chalk.green(`✅ Generated: collaborative-debugging-config.json\n`));

      console.log(chalk.green('✓ Collaborative debugging configuration generated successfully!'));
    }, 30000);
  }));

// Workspace sync commands
}
