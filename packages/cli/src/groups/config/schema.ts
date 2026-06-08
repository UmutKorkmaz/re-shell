import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../../utils/error-handler';
import { createSpinner, flushOutput } from '../../utils/spinner';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * Registers the `config schema` section.
 * Extracted verbatim from the former monolithic config.group.ts.
 */
export function registerSchemaGroup(config: Command): void {
  // --- config schema ---
  const schemaGroup = config.command('schema')
    .description('Manage JSON schemas for IDE autocompletion');

  schemaGroup
    .command('publish')
    .description('Publish JSON schemas to IDE configuration directories')
    .option('--output-dir <dir>', 'Output directory for schema files', 'schemas')
    .option('--vscode-dir <dir>', 'VSCode settings directory')
    .option('--create-extension', 'Create VSCode extension')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Publishing schemas...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { publishSchemas } = await import('../../utils/schema-generator');
          await publishSchemas({
            outputDir: options.outputDir,
            vscodeDir: options.vscodeDir,
            createVscodeExtension: options.createExtension,
          });
        }, 15000);

        spinner.succeed(chalk.green('Schemas published successfully!'));
      })
    );

  schemaGroup
    .command('validate <file>')
    .description('Validate workspace YAML file against the v2 JSON Schema')
    .option('--json', 'Output as a single JSON envelope')
    .action(
      createAsyncCommand(async (file, options) => {
        const jsonMode = Boolean(options.json);

        // JSON mode: emit exactly one envelope, no spinner/banner noise.
        if (jsonMode) {
          const { enableJsonMode, ok, fail } = await import('../../utils/json-output');
          const restore = enableJsonMode();
          try {
            await withTimeout(async () => {
              const { validateWorkspaceFile } = await import('../../utils/schema-generator');
              const result = await validateWorkspaceFile(file);

              if (result.valid) {
                ok({ valid: true, errors: result.errors }, result.warnings);
              } else {
                fail(
                  'SCHEMA_VALIDATION_ERROR',
                  `Workspace file failed v2 schema validation: ${file}`,
                  { valid: false, errors: result.errors }
                );
              }
            }, 15000);
          } finally {
            restore();
          }
          return;
        }

        const spinner = createSpinner('Validating workspace file...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const { validateWorkspaceFile } = await import('../../utils/schema-generator');
          const result = await validateWorkspaceFile(file);

          spinner.stop();

          if (result.valid) {
            console.log(chalk.green('✅ Workspace file is valid!'));
            if (result.warnings.length > 0) {
              console.log(chalk.yellow('\n⚠️  Warnings:'));
              result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
            }
          } else {
            console.log(chalk.red('❌ Validation failed!'));
            console.log(chalk.red('\nErrors:'));
            result.errors.forEach(e =>
              console.log(chalk.red(`  - ${e.instancePath || '(root)'}: ${e.message}`))
            );
            if (result.warnings.length > 0) {
              console.log(chalk.yellow('\n⚠️  Warnings:'));
              result.warnings.forEach(w => console.log(chalk.yellow(`  - ${w}`)));
            }
            process.exitCode = 1;
          }
        }, 15000);
      })
    );

  schemaGroup
    .command('generate')
    .description('Generate IDE configuration files')
    .option('--output-dir <dir>', 'Output directory', 'schemas')
    .option('--ide <ide>', 'Target IDE (vscode, intellij, vim, emacs, all)', 'all')
    .action(
      createAsyncCommand(async (options) => {
        const spinner = createSpinner('Generating IDE configs...').start();
        processManager.addCleanup(() => spinner.stop());
        flushOutput();

        await withTimeout(async () => {
          const {
            generateVSCodeConfig,
            generateIntelliJConfig,
            generateVimConfig,
            generateEmacsConfig,
            getIdeSchema,
          } = await import('../../utils/schema-generator');

          const outputDir = options.outputDir;
          await fs.ensureDir(outputDir);

          // Always emit the canonical v2 IDE schema (with owned $id) so the
          // generated IDE configs have a real schema file to point at.
          await fs.writeJson(
            path.join(outputDir, 're-shell-workspace.schema.json'),
            getIdeSchema(),
            { spaces: 2 }
          );
          console.log(chalk.green('✅ v2 JSON Schema generated'));

          if (options.ide === 'all' || options.ide === 'vscode') {
            const vscodeConfig = generateVSCodeConfig('./schemas/re-shell-workspace.schema.json');
            await fs.writeFile(path.join(outputDir, 'vscode-settings.json'), vscodeConfig);
            console.log(chalk.green('✅ VSCode settings generated'));
          }

          if (options.ide === 'all' || options.ide === 'intellij') {
            const intellijConfig = generateIntelliJConfig();
            await fs.writeFile(path.join(outputDir, 'intellij-config.xml'), intellijConfig);
            console.log(chalk.green('✅ IntelliJ config generated'));
          }

          if (options.ide === 'all' || options.ide === 'vim') {
            const vimConfig = generateVimConfig();
            await fs.writeFile(path.join(outputDir, 'vim-config.vim'), vimConfig);
            console.log(chalk.green('✅ Vim config generated'));
          }

          if (options.ide === 'all' || options.ide === 'emacs') {
            const emacsConfig = generateEmacsConfig();
            await fs.writeFile(path.join(outputDir, 'emacs-config.el'), emacsConfig);
            console.log(chalk.green('✅ Emacs config generated'));
          }
        }, 15000);

        spinner.succeed(chalk.green('IDE configurations generated!'));
      })
    );
}
