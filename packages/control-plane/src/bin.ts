#!/usr/bin/env node
import { main } from './cli.js';

main(process.argv.slice(2), {
  stdout: (text) => {
    process.stdout.write(text);
  },
  stderr: (text) => {
    process.stderr.write(text);
  },
  env: process.env,
}).then(
  (code) => {
    // Let stdout flush before exiting.
    process.exitCode = code;
    setImmediate(() => process.exit(code));
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exit(1);
  }
);
