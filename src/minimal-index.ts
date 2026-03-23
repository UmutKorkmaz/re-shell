#!/usr/bin/env node

// Minimal startup optimization test
const startTime = Date.now();

// Read package.json for version
import { readFileSync } from 'fs';
import { join } from 'path';
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

// Fast path for version
const args = process.argv.slice(2);
if (args.length === 1 && ['--version', '-v', '-V'].includes(args[0])) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chalk = require('chalk');
  console.log(chalk.cyan(`
██████╗ ███████╗           ███████╗██╗  ██╗███████╗██╗     ██╗
██╔══██╗██╔════╝           ██╔════╝██║  ██║██╔════╝██║     ██║
██████╔╝█████╗  ████████╗  ███████╗███████║█████╗  ██║     ██║
██╔══██╗██╔══╝  ╚═══════╝  ╚════██║██╔══██║██╔══╝  ██║     ██║
██║  ██║███████╗           ███████║██║  ██║███████╗███████╗███████╗
╚═╝  ╚═╝╚══════╝           ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
                                v${packageJson.version}
`));
  console.log(packageJson.version);
  const endTime = Date.now();
  if (process.env.DEBUG) {
    console.error(`Startup time: ${endTime - startTime}ms`);
  }
  process.exit(0);
}

// Defer heavy imports
import { Command } from 'commander';

const program = new Command();

// Basic program setup
program
  .name('re-shell')
  .description('Re-Shell CLI - Universal Full-Stack Development Platform')
  .enablePositionalOptions()
  .version(packageJson.version);

// Minimal commands for testing
program
  .command('test')
  .description('Test command')
  .action(() => {
    console.log('Test command executed');
  });

// Show help if no commands
if (process.argv.length <= 2) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const chalk = require('chalk');
  console.log(chalk.cyan(`
██████╗ ███████╗           ███████╗██╗  ██╗███████╗██╗     ██╗
██╔══██╗██╔════╝           ██╔════╝██║  ██║██╔════╝██║     ██║
██████╔╝█████╗  ████████╗  ███████╗███████║█████╗  ██║     ██║
██╔══██╗██╔══╝  ╚═══════╝  ╚════██║██╔══██║██╔══╝  ██║     ██║
██║  ██║███████╗           ███████║██║  ██║███████╗███████╗███████╗
╚═╝  ╚═╝╚══════╝           ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝
                                v${packageJson.version}
`));
  program.outputHelp();
}

program.parse();

const endTime = Date.now();
if (process.env.DEBUG) {
  console.error(`Total startup time: ${endTime - startTime}ms`);
}
