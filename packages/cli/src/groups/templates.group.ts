import { Command } from 'commander';
import { createAsyncCommand, withTimeout, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import chalk from 'chalk';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import {
  listBackendTemplates,
  getBackendTemplate,
  toTemplateSummary,
  TemplateSummary,
} from '../templates/backend';
import { buildTemplateMatrix } from '../utils/template-matrix';
import { computeBackendDryRun } from '../utils/template-dry-run';

/**
 * `templates` group: expose the backend framework template registry so it can
 * be discovered and inspected programmatically (--json) or via the terminal.
 */
export function registerTemplatesGroup(program: Command): void {
  const templatesCommand = new Command('templates')
    .description('Discover and inspect framework templates');

  templatesCommand
    .command('list')
    .description('List available framework templates')
    .option('--json', 'Output as JSON')
    .option('--language <l>', 'Filter by language')
    .option('--framework <f>', 'Filter by framework')
    .action(
      createAsyncCommand(async (options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json ? undefined : createSpinner('Loading templates...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          let summaries: TemplateSummary[] = listBackendTemplates().map(toTemplateSummary);

          if (options.language) {
            summaries = summaries.filter(t => t.language === options.language);
          }
          if (options.framework) {
            summaries = summaries.filter(t => t.framework === options.framework);
          }

          if (options.json) {
            ok(summaries);
            return;
          }

          if (spinner) spinner.stop();

          console.log(chalk.cyan.bold(`\n📋 Templates (${summaries.length})\n`));
          if (summaries.length === 0) {
            console.log(chalk.yellow('No templates match the given filters.\n'));
            return;
          }
          for (const t of summaries) {
            console.log(
              `  ${chalk.green('●')} ${chalk.bold(t.id)} ${chalk.blue(`[${t.language}]`)} ${chalk.gray(t.framework)}`
            );
            if (t.description) {
              console.log(`    ${chalk.gray(t.description)}`);
            }
          }
          console.log();
        } catch (error) {
          if (spinner) spinner.stop();
          fail(
            'TEMPLATES_LIST_ERROR',
            `Error listing templates: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          restoreJson();
        }
      })
    );

  templatesCommand
    .command('show <id>')
    .description('Show details for a single framework template')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (id, options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json ? undefined : createSpinner(`Loading template: ${id}`).start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const template = getBackendTemplate(id);

          if (!template) {
            if (spinner) spinner.stop();
            if (options.json) {
              fail('TEMPLATE_NOT_FOUND', `Template not found: ${id}`, { id });
            } else {
              console.log(chalk.red(`\n✗ Template not found: ${id}\n`));
              process.exitCode = 1;
            }
            return;
          }

          const summary = toTemplateSummary(template);

          if (options.json) {
            ok(summary);
            return;
          }

          if (spinner) spinner.stop();

          console.log(chalk.cyan.bold(`\n📄 Template: ${summary.id}\n`));
          console.log(`${chalk.bold('Name:')} ${chalk.gray(summary.displayName || summary.name)}`);
          console.log(`${chalk.bold('Language:')} ${chalk.gray(summary.language)}`);
          console.log(`${chalk.bold('Framework:')} ${chalk.gray(summary.framework)}`);
          if (summary.version) {
            console.log(`${chalk.bold('Version:')} ${chalk.gray(summary.version)}`);
          }
          if (summary.description) {
            console.log(`${chalk.bold('Description:')} ${chalk.gray(summary.description)}`);
          }
          if (summary.tags && summary.tags.length > 0) {
            console.log(`${chalk.bold('Tags:')} ${chalk.gray(summary.tags.join(', '))}`);
          }
          console.log();
        } finally {
          restoreJson();
        }
      })
    );

  templatesCommand
    .command('matrix')
    .description('Show a compatibility grid across language/framework/database/cache/deployment')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner('Building compatibility matrix...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const { matrix, facets } = buildTemplateMatrix();

          if (options.json) {
            ok({ matrix, facets });
            return;
          }

          if (spinner) spinner.stop();

          console.log(chalk.cyan.bold(`\n📊 Template compatibility matrix (${matrix.length})\n`));
          console.log(
            `${chalk.bold('Languages:')} ${chalk.gray(facets.languages.join(', '))}`
          );
          console.log(
            `${chalk.bold('Frameworks:')} ${chalk.gray(String(facets.frameworks.length))}`
          );
          console.log(
            `${chalk.bold('Databases:')} ${chalk.gray(facets.databases.join(', ') || '—')}`
          );
          console.log(
            `${chalk.bold('Caches:')} ${chalk.gray(facets.caches.join(', ') || '—')}`
          );
          console.log(
            `${chalk.bold('Deployment:')} ${chalk.gray(facets.deploymentTargets.join(', ') || '—')}\n`
          );
          for (const row of matrix) {
            const bits = [
              chalk.blue(`[${row.language}]`),
              row.databases.length ? chalk.magenta(`db:${row.databases.join('/')}`) : '',
              row.caches.length ? chalk.yellow(`cache:${row.caches.join('/')}`) : '',
              row.deploymentTargets.length
                ? chalk.green(`deploy:${row.deploymentTargets.join('/')}`)
                : '',
            ].filter(Boolean);
            console.log(`  ${chalk.bold(row.id)} ${bits.join(' ')}`);
          }
          console.log();
        } catch (error) {
          if (spinner) spinner.stop();
          fail(
            'TEMPLATES_MATRIX_ERROR',
            `Error building template matrix: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          restoreJson();
        }
      })
    );

  templatesCommand
    .command('apply <id>')
    .description('Preview the files a template scaffold would produce (dry-run)')
    .option('--json', 'Output as JSON')
    .option('--dry-run', 'Compute the file set without writing anything (default)')
    .option('--name <name>', 'Project name to substitute into placeholders', 'my-service')
    .action(
      createAsyncCommand(async (id, options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner(`Computing dry-run for: ${id}`).start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          // Only a dry-run preview is supported here; writing happens via `create`.
          const result = await computeBackendDryRun(id, { projectName: options.name });

          if (options.json) {
            ok({
              templateId: result.templateId,
              projectName: result.projectName,
              dryRun: true,
              files: result.files,
              totalBytes: result.totalBytes,
              previews: result.previews,
            });
            return;
          }

          if (spinner) spinner.stop();

          console.log(
            chalk.cyan.bold(`\n🔍 Dry run: ${result.templateId} → "${result.projectName}"\n`)
          );
          console.log(
            chalk.gray(`Would create ${result.files.length} files (${result.totalBytes} bytes). Nothing written.\n`)
          );
          for (const file of result.files) {
            console.log(
              `  ${chalk.green('+')} ${chalk.bold(file.path)} ${chalk.gray(`(${file.bytes}b)`)}`
            );
          }
          console.log();
        } catch (error) {
          if (spinner) spinner.stop();
          const message = error instanceof Error ? error.message : 'Unknown error';
          if (options.json) {
            const code = message.startsWith('Template not found')
              ? 'TEMPLATE_NOT_FOUND'
              : 'TEMPLATE_DRY_RUN_ERROR';
            fail(code, message, { id });
          } else {
            console.log(chalk.red(`\n✗ ${message}\n`));
            process.exitCode = 1;
          }
        } finally {
          restoreJson();
        }
      })
    );

  program.addCommand(templatesCommand);
}
