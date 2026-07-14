import chalk from 'chalk';
import { createSpinner } from '../utils/spinner';
import { ValidationError } from '../utils/error-handler';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import { buildConfigFromFlags } from '../utils/plugin-wizard';
import { scaffold } from '../utils/plugin-scaffolder';
import { validatePluginForPublish, type PublishValidationResult } from '../utils/plugin-publish-validator';

export interface CreatePluginOptions {
  noInteractive?: boolean;
  description?: string;
  author?: string;
  license?: string;
  type?: string;
  hooks?: string;
  commands?: string;
  permissions?: string;
  framework?: string;
  tests?: boolean;
  ci?: boolean;
  force?: boolean;
  dryRun?: boolean;
  json?: boolean;
}

export async function createPluginCommand(
  name: string,
  options: CreatePluginOptions
): Promise<void> {
  const { json = false, force = false, dryRun = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const config = buildConfigFromFlags({
      name,
      description: options.description ?? '',
      author: options.author ?? 'unknown',
      license: options.license,
      type: options.type,
      hooks: options.hooks,
      commands: options.commands,
      permissions: options.permissions,
      framework: options.framework,
      includeTests: options.tests,
      includeCI: options.ci,
    });

    const spinner = json ? undefined : createSpinner(`Creating plugin ${config.name}...`);
    if (spinner) spinner.start();

    const result = await scaffold(config, process.cwd(), { dryRun, force });

    if (spinner) spinner.stop();

    if (json) {
      ok({
        pluginDir: result.pluginDir,
        files: result.files.map(f => f.path),
      });
      return;
    }

    if (dryRun) {
      console.log(chalk.cyan(`\nDry run - files that would be created:\n`));
      result.files.forEach(f => console.log(`  ${chalk.gray(f.path)}`));
      return;
    }

    console.log(chalk.green(`\nPlugin created successfully: ${config.name}`));
    console.log(`  Location: ${result.pluginDir}`);
    console.log(`  Files: ${result.files.length}`);
    console.log(chalk.gray(`\nNext steps:`));
    console.log(chalk.gray(`  cd ${config.name}`));
    console.log(chalk.gray(`  npm install`));
    console.log(chalk.gray(`  npm run build`));
    console.log(chalk.gray(`  re-shell plugin validate-publish`));
  } catch (error) {
    if (json) {
      const code = error instanceof ValidationError ? 'SCHEMA_VALIDATION_ERROR' : 'PLUGIN_INSTALL_ERROR';
      fail(code as 'SCHEMA_VALIDATION_ERROR', error instanceof Error ? error.message : String(error));
      return;
    }
    throw error;
  } finally {
    restoreJson();
  }
}

export interface ValidatePublishOptions {
  json?: boolean;
  verbose?: boolean;
}

export async function validatePublish(
  pluginPath: string,
  options: ValidatePublishOptions
): Promise<PublishValidationResult> {
  const { json = false, verbose = false } = options;
  const restoreJson = json ? enableJsonMode() : () => {};

  try {
    const result = await validatePluginForPublish(pluginPath);

    if (json) {
      ok({
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      });
      return result;
    }

    if (result.valid) {
      console.log(chalk.green(`\nPlugin is valid for publishing`));
    } else {
      console.log(chalk.red(`\nPlugin validation failed:`));
    }

    if (result.errors.length > 0) {
      console.log(chalk.red(`\nErrors:`));
      result.errors.forEach(e => {
        console.log(`  ${chalk.red('x')} [${e.name}] ${e.message}`);
      });
    }

    if (result.warnings.length > 0) {
      console.log(chalk.yellow(`\nWarnings:`));
      result.warnings.forEach(w => {
        console.log(`  ${chalk.yellow('!')} [${w.name}] ${w.message}`);
      });
    }

    if (verbose && result.checks.length > 0) {
      const passedChecks = result.checks.filter(c => c.passed);
      if (passedChecks.length > 0) {
        console.log(chalk.gray(`\nPassed checks:`));
        passedChecks.forEach(c => {
          console.log(`  ${chalk.green('v')} [${c.name}] ${c.message}`);
        });
      }
    }

    return result;
  } finally {
    restoreJson();
  }
}
