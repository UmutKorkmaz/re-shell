import { Command } from 'commander';
import { createAsyncCommand } from '../utils/error-handler';
import { runDebugConfig } from '../commands/debug-config';

/**
 * Registers the `debug` command group (cross-language debugging):
 * `debug config` generates VS Code launch.json + compose debug overrides.
 *
 * @param program - The root Commander program to attach the `debug` group to.
 */
export function registerDebugGroup(program: Command): void {
  const debug = new Command('debug').description('Cross-language debugging configuration for workspace services');

  debug
    .command('config')
    .description(
      'Generate a VS Code launch.json (node, python, go, rust, java, php, ruby, dotnet) with a compound configuration, plus a docker-compose debug override'
    )
    .option('--services <names>', 'Comma-separated service names (default: all supported services)')
    .option('--out <file>', 'launch.json path (default: <workspace>/.vscode/launch.json)')
    .option('--compose-out <file>', 'Compose override path (default: <workspace>/docker-compose.debug.yml)')
    .option('--no-compose', 'Do not generate the docker-compose debug override')
    .option('--dry-run', 'Print what would be written without writing files')
    .option('--json', 'Emit a machine-readable JSON envelope')
    .action(
      createAsyncCommand(async (options: Record<string, unknown>) => {
        await runDebugConfig({
          services: options.services as string | undefined,
          out: options.out as string | undefined,
          composeOut: options.composeOut as string | undefined,
          compose: options.compose as boolean | undefined,
          dryRun: Boolean(options.dryRun),
          json: Boolean(options.json),
        });
      })
    );

  program.addCommand(debug);
}
