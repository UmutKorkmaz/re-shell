// Common error types and utilities
import chalk from 'chalk';

export class ValidationError extends Error {
  field?: string;
  path?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Process manager for cleanup
class ProcessManagerImpl {
  private cleanupFns: Array<() => void> = [];
  private _keepRunning = false;

  addCleanup(fn: () => void) {
    this.cleanupFns.push(fn);
  }

  cleanup() {
    for (const fn of this.cleanupFns) {
      try {
        fn();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.cleanupFns = [];
  }

  // Signal that the command should keep the process running (e.g., for dev servers)
  keepRunning() {
    this._keepRunning = true;
  }

  // Check if the process should keep running
  shouldKeepRunning(): boolean {
    return this._keepRunning;
  }
}

export const processManager = new ProcessManagerImpl();

// Setup stream error handlers
export function setupStreamErrorHandlers(): void {
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

// Create async command wrapper
export function createAsyncCommand(fn: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (error: any) {
      if (error instanceof ValidationError) {
        console.error(chalk.red(`Validation Error: ${error.message}`));
      } else {
        console.error(chalk.red(`Error: ${error?.message || 'Unknown error'}`));
      }
      process.exit(1);
    }
  };
}

// Timeout wrapper
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage?: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle!);
  }
}
