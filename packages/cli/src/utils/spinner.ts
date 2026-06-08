import ora from 'ora';
import chalk from 'chalk';

interface SpinnerOptions {
  text: string;
  color?: string;
  stream?: NodeJS.WriteStream;
  // When true, the spinner must never emit anything to stdout. Any progress
  // text is routed to stderr instead so that --json output stays pure.
  json?: boolean;
}

export class ProgressSpinner {
  private spinner: ora.Ora;
  private isInteractive: boolean;
  private isQuiet: boolean;

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
        color: options.color as any || 'cyan',
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

  start(): this {
    if (this.isInteractive) {
      this.spinner.start();
      // Force flush the output immediately
      this.forceFlush();
    }
    return this;
  }

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

  stop(): this {
    if (this.isInteractive) {
      this.spinner.stop();
    }
    return this;
  }

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

  setColor(color: string): this {
    if (this.isInteractive) {
      this.spinner.color = color as any;
    }
    return this;
  }

  clear(): this {
    if (this.isInteractive) {
      this.spinner.clear();
    }
    return this;
  }

  render(): this {
    if (this.isInteractive) {
      this.spinner.render();
      this.forceFlush();
    }
    return this;
  }

  private forceFlush(): void {
    try {
      // Multiple approaches to ensure output is flushed immediately
      if (process.stdout.write('')) {
        process.stdout.write('');
      }
      if (typeof (process.stdout as any)._flush === 'function') {
        (process.stdout as any)._flush();
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

  private finalFlush(): void {
    try {
      // In quiet/JSON mode stdout must stay pure JSON, so never touch it here.
      if (this.isQuiet) {
        return;
      }

      // Final flush to ensure all output is displayed immediately
      process.stdout.write('');
      if (typeof (process.stdout as any)._flush === 'function') {
        (process.stdout as any)._flush();
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

// Helper function to create a spinner
export function createSpinner(
  text: string,
  color?: string,
  options?: { json?: boolean }
): ProgressSpinner {
  return new ProgressSpinner({ text, color, json: options?.json });
}

// Helper function to force flush output
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
    if (typeof (process.stdout as any)._flush === 'function') {
      (process.stdout as any)._flush();
    }
    if (typeof (process.stderr as any)._flush === 'function') {
      (process.stderr as any)._flush();
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

// Helper to detect if terminal supports interactive features
export function isInteractiveTerminal(): boolean {
  return Boolean(
    process.stdout.isTTY && 
    process.env.TERM !== 'dumb' && 
    !process.env.CI &&
    !process.env.RE_SHELL_NO_SPINNER
  );
}