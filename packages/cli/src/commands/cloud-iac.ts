import chalk from 'chalk';

import { enableJsonMode, fail, ok, type ErrorCode } from '../utils/json-output';
import { deploy, type DeployOptions, type DeployResult } from '../iac/deploy';
import { generateIac, IacError, type GenerateIacResult } from '../iac/generate';
import { validateTerraformDir, type ValidationReport } from '../iac/terraform';

function report(err: unknown, json: boolean | undefined, label: string): void {
  const code: ErrorCode = err instanceof IacError ? (err.code as ErrorCode) : 'IAC_ERROR';
  const message = err instanceof Error ? err.message : String(err);
  const details = err instanceof IacError ? err.details : undefined;
  if (json) fail(code, message, details);
  else {
    console.error(chalk.red(`${label} failed [${code}]: ${message}`));
    if (details && typeof details.output === 'string' && details.output) console.error(chalk.gray(details.output));
    if (details && typeof details.plan === 'string' && details.plan) console.error(chalk.gray(details.plan));
    process.exitCode = 1;
  }
}

function renderValidation(v: ValidationReport): void {
  console.log(chalk.bold('\nValidation'));
  console.log(`  terraform: ${v.terraform.found ? `${v.terraform.path} ${v.terraform.version ?? ''}` : chalk.red('not found')}`);
  for (const s of v.steps) {
    const mark = !s.ran ? chalk.yellow('skipped') : s.ok ? chalk.green('ok') : chalk.red('failed');
    console.log(`  ${s.name.padEnd(14)} ${mark}${s.reason ? chalk.gray(`  ${s.reason}`) : ''}`);
    if (s.ran && !s.ok && s.output) console.log(chalk.gray(s.output.split('\n').map(l => `      ${l}`).join('\n')));
  }
  console.log(`  ${v.validated ? chalk.green('✓') : chalk.red('✖')} ${v.summary}`);
}

// ---------------------------------------------------------------------------
// cloud iac generate
// ---------------------------------------------------------------------------

export interface IacGenerateCommandOptions {
  provider: string;
  services?: string;
  out?: string;
  dryRun?: boolean;
  validate?: boolean;
  json?: boolean;
  cwd?: string;
}

/** `re-shell cloud iac generate`. With --validate a validation that cannot fully run fails (IAC_VALIDATE_ERROR). */
export async function runIacGenerate(options: IacGenerateCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    const result: GenerateIacResult = generateIac({
      cwd: options.cwd,
      provider: options.provider,
      services: options.services ? options.services.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      out: options.out,
      dryRun: options.dryRun,
    });

    let validation: ValidationReport | null = null;
    if (options.validate) {
      if (!result.written || !result.outDir) {
        throw new IacError('IAC_ERROR', '--validate needs written files: remove --dry-run and pass --out');
      }
      validation = await validateTerraformDir(result.outDir);
    }

    const data = {
      provider: result.provider,
      target: result.target,
      outDir: result.outDir,
      dryRun: result.dryRun,
      written: result.written,
      services: result.services,
      files: result.files.map(f => ({ path: f.path, bytes: f.bytes, ...(result.dryRun ? { content: f.content } : {}) })),
      variables: result.variables,
      validation,
      warnings: result.warnings,
    };

    if (validation && !validation.validated) {
      // `terraform validate` never ran (terraform missing / init failed) => incomplete, otherwise it reported errors
      const validateRan = validation.steps.some(s => s.name === 'validate' && s.ran);
      throw new IacError(
        'IAC_VALIDATE_ERROR',
        validateRan
          ? `Terraform validation failed: ${validation.summary}`
          : `Terraform validation could not be completed: ${validation.summary}`,
        { ...data, validation }
      );
    }

    if (options.json) ok(data, result.warnings);
    else {
      console.log(chalk.cyan(`\nre-shell cloud iac generate: ${result.provider} (${result.target})`));
      console.log(`services: ${result.services.map(s => s.name).join(', ')}`);
      for (const f of result.files) console.log(`  ${result.written ? chalk.green('✓') : chalk.yellow('-')} ${f.path} (${f.bytes} bytes)`);
      console.log(result.written ? `\nWrote ${result.files.length} file(s) to ${result.outDir}` : chalk.yellow('\nDry run: nothing written.'));
      if (result.dryRun) for (const f of result.files.filter(x => x.path.endsWith('.tf'))) console.log(`\n# ${f.path}\n${f.content}`);
      if (validation) renderValidation(validation);
      for (const w of result.warnings) console.log(chalk.yellow(`warning: ${w}`));
    }
  } catch (err) {
    report(err, options.json, 'cloud iac generate');
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------------------
// cloud iac validate
// ---------------------------------------------------------------------------

export interface IacValidateCommandOptions {
  dir: string;
  inPlace?: boolean;
  json?: boolean;
  cwd?: string;
}

/** `re-shell cloud iac validate <dir>`: fails explicitly unless init + validate really ran and passed. */
export async function runIacValidate(options: IacValidateCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    const path = await import('path');
    const fs = await import('fs');
    const dir = path.resolve(options.cwd ?? process.cwd(), options.dir);
    if (!fs.existsSync(dir) || !fs.readdirSync(dir).some(f => f.endsWith('.tf'))) {
      throw new IacError('IAC_ERROR', `No .tf files in ${dir}`, { dir });
    }
    const validation = await validateTerraformDir(dir, { inPlace: options.inPlace });
    const data = { dir, validation };
    if (!validation.terraform.found) {
      throw new IacError('IAC_TERRAFORM_MISSING', `terraform was not found on PATH; ${validation.summary}`, data);
    }
    if (!validation.validated) {
      throw new IacError('IAC_VALIDATE_ERROR', `Terraform validation did not pass: ${validation.summary}`, data);
    }
    if (options.json) ok(data);
    else {
      console.log(chalk.cyan(`\nre-shell cloud iac validate ${dir}`));
      renderValidation(validation);
    }
  } catch (err) {
    if (!options.json && err instanceof IacError && err.details && 'validation' in err.details) {
      console.log(chalk.cyan(`\nre-shell cloud iac validate`));
      renderValidation(err.details.validation as ValidationReport);
    }
    report(err, options.json, 'cloud iac validate');
  } finally {
    restore();
  }
}

// ---------------------------------------------------------------------------
// cloud deploy
// ---------------------------------------------------------------------------

export interface CloudDeployCommandOptions extends Omit<DeployOptions, 'env' | 'run'> {
  json?: boolean;
}

/** `re-shell cloud deploy`: credentials-checked terraform apply behind --yes. */
export async function runCloudDeploy(options: CloudDeployCommandOptions): Promise<void> {
  const restore = options.json ? enableJsonMode() : () => {};
  try {
    const result: DeployResult = await deploy(options);
    if (options.json) ok(result);
    else {
      console.log(chalk.cyan(`\nre-shell cloud deploy: ${result.provider} (${result.dir})`));
      if (result.dryRun) console.log(chalk.yellow('Dry run: nothing executed.'));
      else console.log(`credentials: ${result.credentials.source}`);
      for (const s of result.steps) {
        console.log(`  ${s.executed ? (s.exitCode === 0 ? chalk.green('✓') : chalk.red('✖')) : chalk.yellow('-')} ${s.argv.join(' ')}`);
      }
      if (result.applied) {
        console.log(chalk.green('\nApplied.'));
        for (const [k, v] of Object.entries(result.outputs)) console.log(`  ${k}: ${JSON.stringify(v)}`);
      }
    }
  } catch (err) {
    report(err, options.json, 'cloud deploy');
  } finally {
    restore();
  }
}
