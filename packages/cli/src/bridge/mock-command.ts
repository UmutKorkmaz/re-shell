// `re-shell service bridge mock` - run the universal mock server until interrupted.

import chalk from 'chalk';

import { processManager } from '../utils/error-handler';
import { enableJsonMode, fail, ok } from '../utils/json-output';
import { startMockServer, type RunningMockServer } from './mock/server';
import { BridgeSpecError } from './spec/errors';

/** Options of {@link runMock}. */
export interface MockCommandOptions {
  specs: string[];
  port?: number;
  grpcPort?: number;
  host?: string;
  /** Stop automatically after this many seconds (default: run until interrupted). */
  timeout?: number;
  json?: boolean;
  cwd?: string;
}

/** JSON payload emitted once the mock is listening. */
export interface MockStarted {
  host: string;
  protocols: string[];
  baseUrl?: string;
  graphqlUrl?: string;
  grpcAddress?: string;
  httpPort?: number;
  grpcPort?: number;
  specs: { path: string; protocol: string; title: string; operations: number }[];
}

function describe(server: RunningMockServer): MockStarted {
  return {
    host: server.host,
    protocols: server.protocols,
    baseUrl: server.baseUrl,
    graphqlUrl: server.graphqlUrl,
    grpcAddress: server.grpcAddress,
    httpPort: server.httpPort,
    grpcPort: server.grpcPort,
    specs: server.specs,
  };
}

/**
 * Start the mock server and keep the process alive until SIGINT/SIGTERM (or
 * `--timeout`). In `--json` mode exactly one envelope is written (after the
 * server is listening); nothing else is printed to stdout.
 */
export async function runMock(options: MockCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  let server: RunningMockServer;
  try {
    const path = await import('path');
    server = await startMockServer({
      specs: options.specs.map(s => path.resolve(options.cwd ?? process.cwd(), s)),
      port: options.port,
      grpcPort: options.grpcPort,
      host: options.host,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json) {
      fail(error instanceof BridgeSpecError ? 'BRIDGE_SPEC_ERROR' : 'BRIDGE_MOCK_ERROR', message);
      restore();
    } else {
      console.error(chalk.red(`Mock server failed to start: ${message}`));
      process.exitCode = 1;
    }
    return;
  }

  const started = describe(server);
  if (options.json) {
    ok(started, []);
  } else {
    console.log(chalk.cyan('\nre-shell universal mock server'));
    for (const s of server.specs) console.log(`  ${s.protocol.padEnd(7)} ${s.path} (${s.operations} operation(s))`);
    if (server.baseUrl) console.log(`\n  REST     ${server.baseUrl}`);
    if (server.graphqlUrl) console.log(`  GraphQL  ${server.graphqlUrl}`);
    if (server.grpcAddress) console.log(`  gRPC     ${server.grpcAddress}  (plaintext, HTTP/2)`);
    console.log(chalk.gray('\n  GET /__mock/requests lists served calls; Prefer: code=<status> selects a documented response.'));
    console.log(chalk.gray('  Press Ctrl+C to stop.'));
  }

  processManager.keepRunning();
  await new Promise<void>(resolve => {
    let stopping = false;
    const stop = (): void => {
      if (stopping) return;
      stopping = true;
      void server.close().then(() => {
        if (!options.json) console.log(chalk.gray('\nmock server stopped'));
        resolve();
      });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    if (options.timeout && options.timeout > 0) setTimeout(stop, options.timeout * 1000).unref();
  });
  restore();
  process.exit(process.exitCode ?? 0);
}
