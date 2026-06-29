import { launchInkTUI } from './ink-tui';
import { launchGoTUI } from './tui-go';

/**
 * Options for launching the interactive TUI.
 */
interface TUIOptions {
  project?: string;
  mode?: 'dashboard' | 'init' | 'manage' | 'config';
  debug?: boolean;
  /** Legacy: launch the Go-based TUI instead of the default Ink TUI. */
  go?: boolean;
}

/**
 * Launch the interactive TUI.
 *
 * The Ink TUI is the default and the only path that runs without an external
 * toolchain. The legacy Go TUI is opt-in via `--go` and requires Go on PATH.
 *
 * @param options - Options controlling TUI mode, project path, and backend selection
 * @returns Promise that resolves when the TUI session has ended
 */
export async function launchTUI(options: TUIOptions): Promise<void> {
  if (options.go) {
    await launchGoTUI({
      project: options.project,
      mode: options.mode || 'dashboard',
      debug: Boolean(options.debug),
    });
    return;
  }

  await launchInkTUI({
    projectPath: options.project,
    mode: options.mode || 'dashboard',
    debug: Boolean(options.debug),
  });
}
