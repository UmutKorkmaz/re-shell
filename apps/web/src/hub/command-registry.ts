/**
 * The typed, allow-listed command registry now lives in `@re-shell/contracts`
 * (packages/contracts/src/command-registry.ts) so the local hub and the hosted
 * control plane (packages/control-plane) share ONE allow-list and ONE argv
 * builder.
 *
 * It is exposed as the `@re-shell/contracts/command-registry` subpath rather
 * than through the contracts barrel because the dashboard UI package re-exports
 * the barrel and has its own, unrelated `resolveCommand`; a barrel export would
 * collide with it.
 *
 * This module is a thin re-export that keeps every existing import site
 * (`hub-server.ts`, the assistant allow-list adapter, tests) unchanged.
 */
export {
  REGISTERED_COMMAND_IDS,
  isRegisteredCommandId,
  listRegisteredCommands,
  resolveCommand,
  toCommandSpec,
} from '@re-shell/contracts/command-registry';
export type {
  CommandId,
  RegisteredCommandMeta,
  ResolveResult,
} from '@re-shell/contracts/command-registry';
