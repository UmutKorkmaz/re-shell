import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';

/** Options accepted by the legacy Go TUI launcher. */
export interface GoTUIOptions {
  project?: string;
  mode?: 'dashboard' | 'init' | 'manage' | 'config';
  debug?: boolean;
}

/**
 * Resolve the directory that holds the legacy Go TUI source (`main.go`).
 *
 * The Go TUI is a legacy, opt-in path. Its source is no longer bundled with the
 * published CLI, so we look it up in a deterministic order and never assume it is
 * present. Callers must surface a clear error when this returns `null`.
 */
function resolveGoTUIDir(): string | null {
  const candidates = [
    process.env.RE_SHELL_GO_TUI_DIR,
    path.resolve(__dirname, '../tui'),
    path.resolve(__dirname, '../../src/tui'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'main.go'))) {
      return candidate;
    }
  }

  return null;
}

/**
 * Launch the legacy Go-based TUI via `go run .`.
 *
 * This is intentionally NOT the default path. It requires the Go toolchain on
 * PATH and the legacy Go TUI source to be present. When either is missing we
 * fail with an actionable message instead of silently falling back, so the
 * default `re-shell tui` (Ink) never triggers a surprise `go run`.
 *
 * @param options - Launch options (project path, mode, debug flag).
 */
export async function launchGoTUI(options: GoTUIOptions): Promise<void> {
  const goTUIDir = resolveGoTUIDir();

  if (!goTUIDir) {
    throw new Error(
      [
        chalk.red('Legacy Go TUI source not found.'),
        chalk.gray(
          'The Go TUI is no longer bundled with the CLI. Set RE_SHELL_GO_TUI_DIR'
        ),
        chalk.gray(
          'to a directory containing the legacy main.go, or use the default Ink TUI:'
        ),
        chalk.cyan('  re-shell tui'),
      ].join('\n')
    );
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn('go', ['run', '.'], {
      cwd: goTUIDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        RE_SHELL_PROJECT: options.project ?? process.cwd(),
        RE_SHELL_TUI_MODE: options.mode ?? 'dashboard',
        RE_SHELL_DEBUG: options.debug ? '1' : '',
      },
    });

    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            [
              chalk.red('Go toolchain not found on PATH.'),
              chalk.gray(
                'The legacy Go TUI requires Go (run `go mod tidy` in the TUI dir first).'
              ),
              chalk.gray('Use the default Ink TUI instead:'),
              chalk.cyan('  re-shell tui'),
            ].join('\n')
          )
        );
        return;
      }
      reject(error);
    });

    child.on('exit', code => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Legacy Go TUI exited with code ${code}`));
      }
    });
  });
}
