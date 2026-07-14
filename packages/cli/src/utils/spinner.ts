import ora from 'ora';
import chalk from 'chalk';

/**
 * Color names supported by the underlying `ora` spinner for visual customization.
 */
type SpinnerColor = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray';

/**
 * A Node.js write stream extended with an optional internal `_flush` hook used
 * to force pending buffered output to be written to the underlying sink.
 */
type FlushableStream = NodeJS.WriteStream & { _flush?: () => void };

/**
 * Configuration object used to construct a {@link ProgressSpinner} instance.
 */
interface SpinnerOptions {
  /** Initial text displayed alongside the spinner animation. */
  text: string;
  /** Color of the spinner animation. Defaults to `cyan` when omitted. */
  color?: SpinnerColor;
  /** Output stream the spinner should render to. Defaults to `process.stdout`. */
  stream?: NodeJS.WriteStream;
  /**
   * When true, the spinner must never emit anything to stdout. Any progress
   * text is routed to stderr instead so that --json output stays pure.
   */
  json?: boolean;
}

/**
 * A terminal-friendly progress spinner wrapping `ora` with sensible fallbacks
 * for non-interactive (CI, piped) and JSON-only output environments.
 *
 * The spinner automatically detects whether the host terminal is interactive
 * and, when not, falls back to plain logging to stdout (or stderr in JSON mode)
 * so consumers always receive progress feedback in some form.
 */
export class ProgressSpinner {
  private spinner: ora.Ora;
  private isInteractive: boolean;
  private isQuiet: boolean;

  /**
   * Creates a new {@link ProgressSpinner}.
   *
   * In interactive terminals an `ora` spinner is initialized and animated.
   * Otherwise, the initial message is printed once (to stdout normally, or to
   * stderr when JSON-pure output is requested) and a no-op spinner is kept for
   * API compatibility.
   *
   * @param options - Configuration controlling the spinner's text, color, stream, and JSON mode.
   */
  constructor(options: SpinnerOptions) {
    // In JSON/quiet mode stdout must stay pure JSON, so suppress all spinner
    // output to stdout and route any progress text to stderr instead.
    this.isQuiet = Boolean(options.json);

    // Check if we're in an interactive terminal
    this.isInteractive = Boolean(
      process.stdout.isTTY &&
      process.env.TERM !== 'dumb' &&
      !process.env.CI &&
      !process.env.RE_SHELL_NO_SPINNER
    ) && !this.isQuiet;

    if (this.isInteractive) {
      this.spinner = ora({
        text: options.text,
        color: options.color || 'cyan',
        stream: options.stream || process.stdout,
        // Enhanced configuration for better terminal compatibility
        discardStdin: false,
        hideCursor: true,
        indent: 0,
        spinner: 'dots'
      });
    } else {
      // For non-interactive terminals, log the message. In quiet/JSON mode
      // route it to stderr so stdout stays a single JSON line.
      if (!this.isQuiet) {
        console.log(chalk.cyan('⏳'), options.text);
      } else {
        process.stderr.write(`${chalk.cyan('⏳')} ${options.text}\n`);
      }
      this.spinner = ora(); // Create dummy spinner
    }
  }

  /**
   * Starts the spinner animation in interactive terminals and immediately
   * flushes output to the terminal. Has no visible effect in non-interactive mode.
   *
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  start(): this {
    if (this.isInteractive) {
      this.spinner.start();
      // Force flush the output immediately
      this.forceFlush();
    }
    return this;
  }

  /**
   * Marks the spinner as successful, displaying a green checkmark and the
   * provided (or default "Done") message, then flushes the terminal output.
   *
   * @param text - Optional success message. Defaults to `"Done"`.
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  succeed(text?: string): this {
    if (this.isInteractive) {
      this.spinner.succeed(text);
      this.spinner.stop(); // Ensure spinner is fully stopped
    } else if (this.isQuiet) {
      process.stderr.write(`${chalk.green('✅')} ${text || 'Done'}\n`);
    } else {
      console.log(chalk.green('✅'), text || 'Done');
    }
    // Ensure final output is flushed and terminal is reset
    this.finalFlush();
    return this;
  }

  /**
   * Marks the spinner as failed, displaying a red cross and the provided (or
   * default "Failed") message, then flushes the terminal output.
   *
   * @param text - Optional failure message. Defaults to `"Failed"`.
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  fail(text?: string): this {
    if (this.isInteractive) {
      this.spinner.fail(text);
      this.spinner.stop(); // Ensure spinner is fully stopped
    } else if (this.isQuiet) {
      process.stderr.write(`${chalk.red('❌')} ${text || 'Failed'}\n`);
    } else {
      console.log(chalk.red('❌'), text || 'Failed');
    }
    // Ensure final output is flushed and terminal is reset
    this.finalFlush();
    return this;
  }

  /**
   * Emits a warning state, displaying a yellow warning symbol and the provided
   * (or default "Warning") message.
   *
   * @param text - Optional warning message. Defaults to `"Warning"`.
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  warn(text?: string): this {
    if (this.isInteractive) {
      this.spinner.warn(text);
    } else if (this.isQuiet) {
      process.stderr.write(`${chalk.yellow('⚠️')} ${text || 'Warning'}\n`);
    } else {
      console.log(chalk.yellow('⚠️'), text || 'Warning');
    }
    return this;
  }

  /**
   * Emits an informational state, displaying a blue info symbol and the
   * provided (or default "Info") message.
   *
   * @param text - Optional informational message. Defaults to `"Info"`.
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  info(text?: string): this {
    if (this.isInteractive) {
      this.spinner.info(text);
    } else if (this.isQuiet) {
      process.stderr.write(`${chalk.blue('ℹ️')} ${text || 'Info'}\n`);
    } else {
      console.log(chalk.blue('ℹ️'), text || 'Info');
    }
    return this;
  }

  /**
   * Stops the spinner animation without emitting a success, failure, or other
   * terminal status symbol. Has no effect in non-interactive mode.
   *
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  stop(): this {
    if (this.isInteractive) {
      this.spinner.stop();
    }
    return this;
  }

  /**
   * Updates the text displayed alongside the spinner. In non-interactive mode
   * the new text is logged to stdout (or stderr when in JSON mode).
   *
   * @param text - The new spinner text to display.
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  setText(text: string): this {
    if (this.isInteractive) {
      this.spinner.text = text;
      this.forceFlush();
    } else if (this.isQuiet) {
      process.stderr.write(`${chalk.cyan('⏳')} ${text}\n`);
    } else {
      console.log(chalk.cyan('⏳'), text);
    }
    return this;
  }

  /**
   * Updates the color of the spinner animation in interactive terminals.
   * Has no effect in non-interactive mode.
   *
   * @param color - One of the supported {@link SpinnerColor} values.
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  setColor(color: SpinnerColor): this {
    if (this.isInteractive) {
      this.spinner.color = color;
    }
    return this;
  }

  /**
   * Clears the spinner's current line of output from the terminal.
   * Has no effect in non-interactive mode.
   *
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  clear(): this {
    if (this.isInteractive) {
      this.spinner.clear();
    }
    return this;
  }

  /**
   * Manually triggers a re-render of the spinner frame and flushes output.
   * Has no effect in non-interactive mode.
   *
   * @returns The current {@link ProgressSpinner} instance for chaining.
   */
  render(): this {
    if (this.isInteractive) {
      this.spinner.render();
      this.forceFlush();
    }
    return this;
  }

  /**
   * Forces pending stdout output to be written immediately by invoking any
   * internal `_flush` hook and toggling cursor visibility. Errors are ignored
   * because flush failures are non-critical.
   */
  private forceFlush(): void {
    try {
      // Multiple approaches to ensure output is flushed immediately
      if (process.stdout.write('')) {
        process.stdout.write('');
      }
      if (typeof (process.stdout as FlushableStream)._flush === 'function') {
        (process.stdout as FlushableStream)._flush();
      }
      // Force a small delay to ensure output reaches terminal
      process.nextTick(() => {
        if (process.stdout.isTTY) {
          process.stdout.write('\x1b[?25l'); // Hide cursor
          process.stdout.write('\x1b[?25h'); // Show cursor
        }
      });
    } catch (error) {
      // Ignore flush errors - they're not critical
    }
  }

  /**
   * Performs a terminal-wide final flush after a terminal status (succeed/fail)
   * is emitted: writes any pending output, resets cursor visibility and text
   * colors, and ensures a trailing newline. Skipped entirely in JSON/quiet mode
   * to keep stdout pure.
   */
  private finalFlush(): void {
    try {
      // In quiet/JSON mode stdout must stay pure JSON, so never touch it here.
      if (this.isQuiet) {
        return;
      }

      // Final flush to ensure all output is displayed immediately
      process.stdout.write('');
      if (typeof (process.stdout as FlushableStream)._flush === 'function') {
        (process.stdout as FlushableStream)._flush();
      }

      // Ensure cursor is visible and terminal is in proper state
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[?25h'); // Show cursor
        process.stdout.write('\x1b[0m');   // Reset colors
      }

      // Force immediate flush with newline
      console.log(''); // This ensures a newline and flushes output
    } catch (error) {
      // Ignore flush errors - they're not critical
    }
  }
}

/**
 * Convenience factory that constructs a {@link ProgressSpinner} from positional
 * arguments rather than an options object.
 *
 * @param text - Initial text displayed alongside the spinner.
 * @param color - Optional spinner color. Defaults to `cyan` when omitted.
 * @param options - Optional behavioral flags, such as `{ json: true }` to route all spinner output to stderr.
 * @returns A new {@link ProgressSpinner} configured with the supplied arguments.
 */
export function createSpinner(
  text: string,
  color?: SpinnerColor,
  options?: { json?: boolean }
): ProgressSpinner {
  return new ProgressSpinner({ text, color, json: options?.json });
}

/**
 * Forces immediate flushing of both `process.stdout` and `process.stderr`,
 * invoking any internal `_flush` hooks and nudging the terminal with a cursor
 * movement on the next tick. Intended for situations where output must appear
 * promptly (for example, before a long-running synchronous operation).
 *
 * Errors are intentionally swallowed because flush failures are non-critical.
 *
 * @returns No return value; the function performs side effects only.
 */
export function flushOutput(): void {
  try {
    // Force immediate output flushing
    if (process.stdout.write('')) {
      process.stdout.write('');
    }
    if (process.stderr.write('')) {
      process.stderr.write('');
    }
    
    // Try additional flush methods if available
    if (typeof (process.stdout as FlushableStream)._flush === 'function') {
      (process.stdout as FlushableStream)._flush();
    }
    if (typeof (process.stderr as FlushableStream)._flush === 'function') {
      (process.stderr as FlushableStream)._flush();
    }
    
    // Ensure output appears immediately in terminal
    process.nextTick(() => {
      if (process.stdout.isTTY) {
        // Force a cursor movement to trigger terminal update
        process.stdout.write('\x1b[0G');
      }
    });
  } catch (error) {
    // Ignore flush errors - they're not critical
  }
}