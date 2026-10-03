import { Command } from 'commander';
import { registerPkgGroup } from './pkg.group';
import { registerDebugGroup } from './debug.group';
import { registerRefactorGroup } from './refactor.group';

/**
 * Registers the platform command groups (R-1a): `pkg`, `debug` and `refactor`.
 * Kept in one aggregator so `src/index.ts` needs a single registration line.
 *
 * @param program - The root Commander program.
 */
export function registerPlatformGroups(program: Command): void {
  registerPkgGroup(program);
  registerDebugGroup(program);
  registerRefactorGroup(program);
}
