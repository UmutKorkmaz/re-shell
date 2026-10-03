/**
 * Debounced file watcher for the terminal graph explorer. Uses the same
 * chokidar watcher stack as the ink TUI (`commands/ink-tui.tsx`).
 *
 * Reports what changed so the explorer can reload cheaply:
 *  - `graph`:  a package.json / pnpm-workspace.yaml / tsconfig / language
 *              manifest changed, so nodes, edges or attributes may differ
 *  - `status`: a service PID record under `.re-shell/pids` changed
 */

import * as path from 'path';
import * as chokidar from 'chokidar';
import { GRAPH_MANIFEST_FILES } from './graph-source';

export type WorkspaceChangeKind = 'graph' | 'status';

export interface WorkspaceWatchOptions {
  debounceMs?: number;
  /** Max directory depth below the root to watch. Default 4. */
  depth?: number;
  usePolling?: boolean;
}

const IGNORED = /(^|[/\\])(node_modules|\.git|dist|build|\.next|\.turbo|coverage|\.cache)([/\\]|$)/;

/** Classify a changed path; `null` when it does not affect the graph or status. */
export function classifyWorkspaceChange(filePath: string): WorkspaceChangeKind | null {
  const dir = path.dirname(filePath);
  if (path.basename(dir) === 'pids' && path.basename(path.dirname(dir)) === '.re-shell') return 'status';
  if (GRAPH_MANIFEST_FILES.has(path.basename(filePath))) return 'graph';
  return null;
}

/**
 * Watch `root` and call `onChange` (debounced, with the union of change kinds
 * seen in the window). Resolves once the initial scan is done so callers never
 * miss an edit made right after start. `close()` stops the watcher.
 */
export async function watchWorkspaceChanges(
  root: string,
  onChange: (kinds: ReadonlySet<WorkspaceChangeKind>) => void,
  options: WorkspaceWatchOptions = {}
): Promise<() => Promise<void>> {
  const debounceMs = options.debounceMs ?? 300;
  let pending = new Set<WorkspaceChangeKind>();
  let timer: NodeJS.Timeout | undefined;
  let closed = false;

  const watcher = chokidar.watch(root, {
    ignored: IGNORED,
    ignoreInitial: true,
    persistent: true,
    depth: options.depth ?? 4,
    usePolling: options.usePolling ?? process.env.RE_SHELL_WATCH_POLLING === '1',
    interval: 100,
    awaitWriteFinish: { stabilityThreshold: 80, pollInterval: 20 },
  });

  const handle = (filePath: string): void => {
    if (closed) return;
    const kind = classifyWorkspaceChange(filePath);
    if (!kind) return;
    pending.add(kind);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const kinds = pending;
      pending = new Set();
      if (!closed) onChange(kinds);
    }, debounceMs);
  };

  // New/removed directories only matter once a manifest file inside them appears or goes.
  watcher.on('add', handle).on('change', handle).on('unlink', handle);

  await new Promise<void>((resolve, reject) => {
    watcher.once('ready', () => resolve());
    watcher.once('error', (err: unknown) => reject(err));
  });

  return async () => {
    closed = true;
    if (timer) clearTimeout(timer);
    await watcher.close();
  };
}
