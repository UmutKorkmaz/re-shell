import { noteStdoutClosed } from './json-output';

/**
 * Handle a downstream consumer closing a pipe early.
 *
 * `re-shell templates list --json | head -c 100` makes `head` close its end of
 * the pipe after 100 bytes; the next write then fails with `EPIPE`. Without a
 * listener Node raises that as an uncaught exception, which the CLI's global
 * handler printed as a stack trace with exit code 1. A closed pipe is the
 * reader's decision, not a failure of the command, so we exit quietly instead:
 * no stack trace, and the exit code the command had already decided on (0 if it
 * had not set one).
 *
 * Every other stream error is rethrown unchanged so genuine I/O failures keep
 * surfacing through the existing uncaughtException handler.
 *
 * @param streams - Streams to guard. Defaults to stdout and stderr.
 * @param exit - Exit function, injectable for tests. Defaults to `process.exit`.
 */
export function installEpipeHandler(
  streams: ReadonlyArray<NodeJS.WriteStream> = [process.stdout, process.stderr],
  exit: (code: number) => void = code => process.exit(code)
): void {
  for (const stream of streams) {
    stream.on('error', (error: NodeJS.ErrnoException) => {
      if (error && error.code === 'EPIPE') {
        noteStdoutClosed();
        const raw = process.exitCode;
        const code = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? 0), 10) || 0;
        exit(code);
        return;
      }
      throw error;
    });
  }
}
