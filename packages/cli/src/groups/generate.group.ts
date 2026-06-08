import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import { generateCode, generateTests, generateDocumentation } from '../commands/generate';
import { createFeature } from '../commands/create-feature';

export function registerGenerateGroup(program: Command): void {
  const generate = new Command('generate')
    .description('Generate code, tests, and documentation');

  generate
    .command('component <name>')
    .description('Generate a new component')
    .option('--framework <framework>', 'Framework (react, vue, svelte, angular)', 'react')
    .option('--workspace <workspace>', 'Target workspace')
    .option('--export', 'Add to index exports')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Generating component ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateCode(name, { ...options, type: 'component', spinner });
        }, 60000);

        spinner.succeed(chalk.green(`Component ${name} generated!`));
      })
    );

  generate
    .command('hook <name>')
    .description('Generate a React hook')
    .option('--workspace <workspace>', 'Target workspace')
    .option('--export', 'Add to index exports')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Generating hook ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateCode(name, { ...options, type: 'hook', framework: 'react', spinner });
        }, 60000);

        spinner.succeed(chalk.green(`Hook ${name} generated!`));
      })
    );

  generate
    .command('service <name>')
    .description('Generate a service class')
    .option('--workspace <workspace>', 'Target workspace')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Generating service ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateCode(name, { ...options, type: 'service', spinner });
        }, 60000);

        spinner.succeed(chalk.green(`Service ${name} generated!`));
      })
    );

  generate
    .command('test <workspace>')
    .description('Generate test suite for workspace')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (workspace, options) => {
        const spinner = createSpinner(`Generating tests for ${workspace}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateTests(workspace, { ...options, spinner });
        }, 120000);

        spinner.succeed(chalk.green(`Test suite for ${workspace} generated!`));
      })
    );

  generate
    .command('docs')
    .description('Generate project documentation')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Generating documentation...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateDocumentation({ ...options, spinner });
        }, 180000);

        spinner.succeed(chalk.green('Documentation generated!'));
      })
    );

  generate
    .command('backend <name>')
    .description('Generate a backend service or API')
    .option('--framework <framework>', 'Backend framework (express, fastapi, django, flask, sanic, tornado, laravel, symfony, slim, codeigniter)', 'express')
    .option('--language <language>', 'Programming language (typescript, python, php)', 'typescript')
    .option('--features <features...>', 'Additional features (code-quality, celery, redis, type-hints, hot-reload, pytest)')
    .option('--workspace <workspace>', 'Target workspace')
    .option('--port <port>', 'Default port for the service', '8000')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Generating backend ${name}...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          await generateCode(name, { ...options, type: 'backend', spinner });
        }, 120000);

        spinner.succeed(chalk.green(`Backend ${name} generated!`));
      })
    );

  generate
    .command('feature <name>')
    .alias('create-feature')
    .description('Create a new full-stack feature (CRUD, auth, file-upload, websocket, graphql)')
    .option('--type <type>', 'Feature type (crud, auth, file-upload, websocket, graphql, fullstack)', 'crud')
    .option('--backend <framework>', 'Backend framework (express, fastify, nestjs, etc.)')
    .option('--frontend <framework>', 'Frontend framework (react, vue, svelte, angular, vanilla)', 'react')
    .option('--language <language>', 'Language (typescript, javascript, python, go, rust)', 'typescript')
    .option('--database <database>', 'Database (prisma, typeorm, mongoose, sequelize, none)', 'none')
    .option('--workspace <workspace>', 'Target workspace')
    .option('--port <port>', 'Backend port', '3000')
    .option('--skip-install', 'Skip package installation')
    .option('--openapi', 'Include OpenAPI specification')
    .option('--graphql', 'Use GraphQL instead of REST')
    .option('--websockets', 'Include WebSocket support')
    .option('--features <features>', 'Comma-separated additional features')
    .option('--verbose', 'Show detailed information')
    .action(
      createAsyncCommand(async (name, options) => {
        const spinner = createSpinner(`Creating feature "${name}"...`).start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const featureOptions = {
            ...options,
            features: options.features ? options.features.split(',') : [],
            spinner,
          };
          await createFeature(name, featureOptions);
        }, 120000);

        spinner.stop();
      })
    );

  program.addCommand(generate);
}
