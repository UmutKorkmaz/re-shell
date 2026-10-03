/**
 * Backward-compatibility aliases for old flat command names.
 *
 * As commands are extracted from the flat structure into groups,
 * the old names are preserved here with `.hideHelp()` to keep them
 * working without cluttering --help output.
 *
 * Deprecation policy:
 *  - Aliases emit a console.warn() message on stderr
 *  - Aliases will be removed in v1.0.0 (major version) only
 *  - Each alias delegates to the new group command handler
 *
 * Format:
 *   program.command('old-flat-name')
 *     .hideHelp()
 *     .description('[deprecated] Use: re-shell <group> <sub>')
 *     .action(async () => {
 *       console.warn('[deprecated] re-shell old-flat-name → re-shell <group> <sub>');
 *       // delegate to group command
 *     });
 */

import { Command } from 'commander';
import { markDeprecatedAlias } from './utils/command-catalog';
import { fail } from './utils/json-output';

function deprecate(program: Command, oldName: string, newPath: string): void {
  const cmd = new Command(oldName)
    .allowUnknownOption()
    .description(`[deprecated] Use: re-shell ${newPath}`)
    .action(() => {
      const message = `[deprecated] re-shell ${oldName} → re-shell ${newPath}`;
      process.stderr.write(`${message}\n`);
      // A consumer that asked for --json still gets a parseable answer on stdout.
      if (process.argv.includes('--json')) {
        fail('USAGE_ERROR', message, { replacedBy: `re-shell ${newPath}` });
      }
      process.exit(1);
    });
  program.addCommand(cmd, { hidden: true });
  // Let the command catalog / completion tell this stub apart from a real
  // command (and know what replaces it) without parsing its description.
  markDeprecatedAlias(cmd, newPath);
}

export function registerAliases(program: Command): void {
  // workspace-* flat commands → workspace <sub>
  deprecate(program, 'workspace-health', 'workspace health');
  deprecate(program, 'workspace-graph', 'workspace graph');
  deprecate(program, 'workspace-def', 'workspace def');
  deprecate(program, 'workspace-state', 'workspace state');
  deprecate(program, 'workspace-template', 'workspace template');
  deprecate(program, 'workspace-backup', 'workspace');
  deprecate(program, 'workspace-migration', 'workspace migrate');
  deprecate(program, 'workspace-conflict', 'workspace');
  deprecate(program, 'workspace-config', 'workspace');
  deprecate(program, 'file-watcher', 'tools');
  deprecate(program, 'change-detector', 'tools');

  // api-related flat commands → api <sub>
  deprecate(program, 'openapi', 'api');
  deprecate(program, 'swagger', 'api');
  deprecate(program, 'versioning', 'api');
  deprecate(program, 'validation', 'api');
  deprecate(program, 'gateway', 'api gateway');
  deprecate(program, 'analytics', 'api');
  deprecate(program, 'client', 'api');
  deprecate(program, 'api-test', 'api');
  deprecate(program, 'docs', 'learn docs');

  // config-related flat commands → config <sub>
  deprecate(program, 'env', 'config env');
  deprecate(program, 'uconfig', 'config');
  deprecate(program, 'config-migrate', 'config');
  deprecate(program, 'config-diff', 'config diff');
  deprecate(program, 'validate', 'config validate');
  deprecate(program, 'project-config', 'config');
  deprecate(program, 'template', 'generate');

  // quality/testing flat commands → quality <sub>
  deprecate(program, 'test', 'quality test');
  deprecate(program, 'intellisense', 'quality ide');
  deprecate(program, 'cicd', 'tools cicd');

  // tools flat commands → tools <sub>
  deprecate(program, 'debug', 'tools debug');
  deprecate(program, 'devenv', 'tools devenv');
  deprecate(program, 'hotreload', 'tools hotreload');
  deprecate(program, 'dev', 'tools dev');

  // service flat commands → service <sub>
  deprecate(program, 'services', 'service');

  // migrate/backup flat commands → tools migrate <sub>
  deprecate(program, 'backup', 'tools migrate backup');
  deprecate(program, 'migrate', 'tools migrate');
}
