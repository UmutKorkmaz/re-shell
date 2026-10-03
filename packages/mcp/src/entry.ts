import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Resolve a filesystem path through every symlink, or `null` when it does not
 * exist (or cannot be read).
 */
function realpathOrNull(target: string): string | null {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

/**
 * True when the module at `moduleUrl` is the process entry point, i.e. it is the
 * file Node was asked to run (`argv1`).
 *
 * Both sides are compared by REAL path. The package `bin` is installed as a
 * symlink (`node_modules/.bin/re-shell-mcp` -> `.../dist/index.js`) and Node
 * reports that symlink as `process.argv[1]`, while `import.meta.url` is always the
 * already-resolved real file. Comparing the two lexically (the previous
 * behaviour) made the guard false for every `npx @re-shell/mcp` / `re-shell-mcp`
 * invocation, so the server silently exited 0 without ever starting.
 *
 * `argv1` may also omit the `.js` extension (`node dist/index`), which Node
 * resolves itself; that spelling is accepted too.
 */
export function isMainEntry(argv1: string | undefined, moduleUrl: string): boolean {
  if (!argv1) return false;

  let modulePath: string;
  try {
    modulePath = fileURLToPath(moduleUrl);
  } catch {
    return false;
  }

  const realModule = realpathOrNull(modulePath);
  if (realModule === null) return false;

  const realArgv = realpathOrNull(argv1) ?? realpathOrNull(`${argv1}.js`);
  return realArgv !== null && realArgv === realModule;
}
