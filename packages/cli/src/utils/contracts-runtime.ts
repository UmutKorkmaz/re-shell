import type * as Contracts from '@re-shell/contracts';

/**
 * Runtime access to `@re-shell/contracts` from the CommonJS CLI.
 *
 * The CLI is compiled to CommonJS and `@re-shell/contracts` is an ESM-only
 * package, so a static value import would crash the binary at start-up (type-only
 * imports are fine and are erased). Code that needs contracts VALUES at runtime
 * — the real collaboration client and its shared event reducer — loads the
 * module lazily, through a native `import()`, only when such a command runs.
 */

export type ContractsModule = typeof Contracts;

let cached: Promise<ContractsModule> | undefined;

export function loadContracts(): Promise<ContractsModule> {
  if (!cached) {
    cached = process.env.VITEST
      ? (import('@re-shell/contracts') as Promise<ContractsModule>)
      : (new Function('specifier', 'return import(specifier)')('@re-shell/contracts') as Promise<ContractsModule>);
  }
  return cached;
}
