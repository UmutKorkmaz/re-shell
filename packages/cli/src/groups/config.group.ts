import { Command } from 'commander';

import { registerDirectCommands } from './config/direct';
import { registerSchemaGroup } from './config/schema';
import { registerEnvGroup } from './config/env';
import { registerUnifiedGroup } from './config/unified';
import { registerMigrateGroup } from './config/migrate';
import { registerValidateGroup } from './config/validate';
import { registerProjectGroup } from './config/project';
import { registerWorkspaceGroup } from './config/workspace';
import { registerTemplateGroup } from './config/template';
import { registerDiffGroup } from './config/diff';
import { registerBackupGroup } from './config/backup';
import { registerProfileGroup } from './config/profile';

/**
 * Wires the `config` command group. Each domain (direct subcommands, schema,
 * env, unified, migrate, validate, project, workspace, template, diff, backup,
 * profile) lives in its own module under ./config/ and registers itself onto
 * the shared `config` command in the original declaration order. This file is a
 * thin registrar only.
 */
export function registerConfigGroup(program: Command): void {
  const config = new Command('config')
    .description('Manage Re-Shell configuration');

  registerDirectCommands(config);
  registerSchemaGroup(config);
  registerEnvGroup(config);
  registerUnifiedGroup(config);
  registerMigrateGroup(config);
  registerValidateGroup(config);
  registerProjectGroup(config);
  registerWorkspaceGroup(config);
  registerTemplateGroup(config);
  registerDiffGroup(config);
  registerBackupGroup(config);
  registerProfileGroup(config);

  program.addCommand(config);
}
