import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import chalk from 'chalk';
import { createAsyncCommand, processManager } from '../utils/error-handler';
import { createSpinner, flushOutput } from '../utils/spinner';
import { enableJsonMode, ok, fail } from '../utils/json-output';
import {
  BUILTIN_PACKS,
  policyPackSchema,
  resolvePolicyPack,
  evaluatePolicyPack,
  scoreToGrade,
  type PolicyPack,
  type FailedRule,
  type WaivedRule,
  type ExpiredException,
} from '../utils/policy-engine';
import {
  evaluateServiceRules,
  loadServicesFromWorkspace,
  type ServiceRuleResult,
} from '../utils/policy-rules-service';
import {
  loadExceptions,
  applyExceptions,
  type PolicyException,
} from '../utils/policy-exceptions';

/** Default policy pack reference used by `policy check`. */
const DEFAULT_PACK = 'recommended';

/** Default exceptions file name. */
const DEFAULT_EXCEPTIONS_FILE = '.reshell-policy-exceptions.yaml';

/** Default score threshold for the `policy check` gate. */
const DEFAULT_THRESHOLD = '70';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The scaffold YAML written by `policy init`. All 14 rule types are present as
 * commented examples so users can uncomment what they need.
 */
const POLICY_SCAFFOLD = `# Re-Shell policy pack
# See: https://re-shell.dev/docs/policy
#
# Uncomment the rules you want to enforce. Each rule has a type, severity
# ("error" or "warning"), and type-specific fields.

name: my-policy
description: My custom policy pack

rules:
  # ── Package.json-level rules (6) ────────────────────────────────────────

  # - id: required-files-readme
  #   type: required-files
  #   severity: warning
  #   files:
  #     - README.md

  # - id: required-scripts-build-test
  #   type: required-scripts
  #   severity: error
  #   scripts:
  #     - build
  #     - test

  # - id: dependency-constraints-react
  #   type: dependency-constraints
  #   severity: error
  #   constraints:
  #     - dependency: react
  #       range: "^18.0.0"

  # - id: naming-lowercase
  #   type: naming
  #   severity: error
  #   pattern: '^(@[a-z0-9-]+\\/)?[a-z0-9][a-z0-9.-]*$'

  # - id: min-node-18
  #   type: min-node
  #   severity: warning
  #   minNode: "18.0.0"

  # - id: license-mit
  #   type: license
  #   severity: warning
  #   allowed:
  #     - MIT
  #     - Apache-2.0

  # ── Service-level rules (8) ─────────────────────────────────────────────

  # - id: healthcheck-required
  #   type: healthcheck-required
  #   severity: error
  #   serviceTypes:
  #     - backend

  # - id: resource-limits
  #   type: resource-limits
  #   severity: warning
  #   requireCpu: true
  #   requireMemory: true

  # - id: port-range
  #   type: port-range
  #   severity: error
  #   min: 3000
  #   max: 9999

  # - id: service-dependency
  #   type: service-dependency
  #   severity: warning
  #   min: 0
  #   max: 5

  # - id: required-env
  #   type: required-env
  #   severity: error
  #   variables:
  #     - NODE_ENV
  #     - LOG_LEVEL

  # - id: framework-allowlist
  #   type: framework-allowlist
  #   severity: warning
  #   allowed:
  #     - express
  #     - fastify
  #     - nestjs

  # - id: language-allowlist
  #   type: language-allowlist
  #   severity: error
  #   allowed:
  #     - typescript
  #     - javascript

  # - id: scaling-required
  #   type: scaling-required
  #   severity: warning
  #   serviceTypes:
  #     - backend
  #   requireMinReplicas: 2
`;

/**
 * Format a grade with color matching the score band.
 */
function gradeColor(grade: string): string {
  if (grade === 'A' || grade === 'B') return chalk.green(grade);
  if (grade === 'C') return chalk.yellow(grade);
  if (grade === 'D') return chalk.yellow(grade);
  return chalk.red(grade);
}

// ---------------------------------------------------------------------------
// Command Group
// ---------------------------------------------------------------------------

/**
 * `re-shell policy` — inspect, validate, and evaluate declarative policy packs
 * against the workspace.
 *
 * Subcommands:
 *  - `list`     — list built-in and custom policy packs
 *  - `init`     — scaffold a `.reshell-policy.yaml` file
 *  - `validate` — validate a policy pack YAML against the zod schema
 *  - `check`    — evaluate a pack and gate the exit code on the score
 */
export function registerPolicyGroup(program: Command): void {
  const policyCommand = new Command('policy').description(
    'Inspect, validate, and evaluate policy packs'
  );

  // ── policy list ─────────────────────────────────────────────────────────

  policyCommand
    .command('list')
    .description('List built-in and custom policy packs')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner('Loading policy packs...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          // Scan cwd root (NOT subdirectories) for .reshell-policy.yaml
          const cwd = process.cwd();
          const customPath = path.join(cwd, '.reshell-policy.yaml');
          const hasCustom = await fs.pathExists(customPath);

          let customPack: { name: string; description?: string; ruleCount: number } | null = null;
          if (hasCustom) {
            try {
              const raw = await fs.readFile(customPath, 'utf8');
              const parsed: unknown = yaml.load(raw);
              const result = policyPackSchema.safeParse(parsed);
              if (result.success) {
                customPack = {
                  name: result.data.name,
                  description: result.data.description,
                  ruleCount: result.data.rules.length,
                };
              }
            } catch {
              // If parse fails, still note the file exists but is invalid
            }
          }

          const builtinSummaries = Object.entries(BUILTIN_PACKS).map(([key, pack]) => ({
            name: key,
            description: pack.description,
            ruleCount: pack.rules.length,
            builtin: true,
          }));

          if (options.json) {
            ok({
              builtin: builtinSummaries,
              custom: customPack ? [{ ...customPack, builtin: false }] : [],
            });
            return;
          }

          if (spinner) spinner.stop();

          console.log(chalk.cyan.bold('\n📋 Policy Packs\n'));

          console.log(chalk.bold('Built-in packs:'));
          for (const pack of builtinSummaries) {
            console.log(
              `  ${chalk.green('●')} ${chalk.bold(pack.name)} ${chalk.gray(`(${pack.ruleCount} rules)`)}`
            );
            if (pack.description) {
              console.log(`    ${chalk.gray(pack.description)}`);
            }
          }

          console.log();
          console.log(chalk.bold('Custom packs:'));
          if (customPack) {
            console.log(
              `  ${chalk.green('●')} ${chalk.bold(customPack.name)} ${chalk.gray(`(${customPack.ruleCount} rules)`)}`
            );
            if (customPack.description) {
              console.log(`    ${chalk.gray(customPack.description)}`);
            }
          } else {
            console.log(chalk.gray('  No .reshell-policy.yaml found in current directory.'));
          }
          console.log();
        } catch (error) {
          if (spinner) spinner.stop();
          fail(
            'POLICY_CHECK_ERROR',
            `Error listing policy packs: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        } finally {
          restoreJson();
        }
      })
    );

  // ── policy init ─────────────────────────────────────────────────────────

  policyCommand
    .command('init')
    .description('Create a .reshell-policy.yaml scaffold in the current directory')
    .option('--name <name>', 'Policy pack name', 'my-policy')
    .option('--desc <description>', 'Policy pack description', 'My custom policy pack')
    .option('--force', 'Overwrite existing .reshell-policy.yaml')
    .action(
      createAsyncCommand(async (options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const cwd = process.cwd();
        const targetPath = path.join(cwd, '.reshell-policy.yaml');

        try {
          if ((await fs.pathExists(targetPath)) && !options.force) {
            const msg = `.reshell-policy.yaml already exists. Use --force to overwrite.`;
            if (options.json) {
              fail('POLICY_CHECK_ERROR', msg);
            } else {
              console.log(chalk.red(`\n✗ ${msg}\n`));
              process.exitCode = 1;
            }
            return;
          }

          // Substitute name/desc into the scaffold
          let scaffold = POLICY_SCAFFOLD;
          scaffold = scaffold.replace(/^name: .*$/m, `name: ${options.name}`);
          scaffold = scaffold.replace(
            /^description: .*$/m,
            `description: ${options.desc}`
          );

          await fs.writeFile(targetPath, scaffold, 'utf8');

          if (options.json) {
            ok({ path: targetPath, created: true });
            return;
          }

          console.log(
            chalk.green(`\n✓ Created `) +
              chalk.bold('.reshell-policy.yaml') +
              chalk.gray(` at ${targetPath}\n`)
          );
          console.log(
            chalk.gray('Uncomment the rules you want to enforce, then run:\n')
          );
          console.log(chalk.cyan('  re-shell policy check --pack .reshell-policy.yaml\n'));
        } catch (error) {
          if (options.json) {
            fail(
              'POLICY_CHECK_ERROR',
              `Error creating policy scaffold: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          } else {
            console.log(
              chalk.red(
                `\n✗ Error creating policy scaffold: ${error instanceof Error ? error.message : 'Unknown error'}\n`
              )
            );
            process.exitCode = 1;
          }
        } finally {
          restoreJson();
        }
      })
    );

  // ── policy validate ─────────────────────────────────────────────────────

  policyCommand
    .command('validate <file>')
    .description('Validate a policy pack YAML file against the schema')
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (file: string, options) => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        const spinner = options.json
          ? undefined
          : createSpinner(`Validating ${file}...`).start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const resolved = path.resolve(file);
          if (!(await fs.pathExists(resolved))) {
            const msg = `File not found: ${file}`;
            if (options.json) {
              fail('POLICY_CHECK_ERROR', msg);
            } else {
              if (spinner) spinner.stop();
              console.log(chalk.red(`\n✗ ${msg}\n`));
              process.exitCode = 1;
            }
            return;
          }

          const raw = await fs.readFile(resolved, 'utf8');
          let parsed: unknown;
          try {
            parsed = yaml.load(raw);
          } catch (err) {
            const msg = `Failed to parse YAML: ${(err as Error).message}`;
            if (options.json) {
              fail('POLICY_CHECK_ERROR', msg);
            } else {
              if (spinner) spinner.stop();
              console.log(chalk.red(`\n✗ ${msg}\n`));
              process.exitCode = 1;
            }
            return;
          }

          const result = policyPackSchema.safeParse(parsed);

          if (result.success) {
            const pack = result.data;
            if (options.json) {
              ok({
                valid: true,
                name: pack.name,
                description: pack.description,
                ruleCount: pack.rules.length,
                rules: pack.rules.map((r) => ({
                  id: r.id,
                  type: r.type,
                  severity: r.severity,
                })),
              });
              return;
            }

            if (spinner) spinner.stop();
            console.log(chalk.green(`\n✓ Valid policy pack: ${chalk.bold(pack.name)}\n`));
            if (pack.description) {
              console.log(`${chalk.bold('Description:')} ${chalk.gray(pack.description)}`);
            }
            console.log(`${chalk.bold('Rules:')} ${chalk.gray(String(pack.rules.length))}\n`);
            for (const rule of pack.rules) {
              console.log(
                `  ${chalk.green('●')} ${chalk.bold(rule.id)} ` +
                  chalk.gray(`[${rule.type}] `) +
                  (rule.severity === 'error'
                    ? chalk.red('error')
                    : chalk.yellow('warning'))
              );
            }
            console.log();
          } else {
            const issues = result.error.issues;
            if (options.json) {
              fail('POLICY_CHECK_ERROR', `Invalid policy pack: ${file}`, {
                errors: issues.map((i) => ({
                  path: i.path.join('.'),
                  message: i.message,
                })),
              });
              return;
            }

            if (spinner) spinner.stop();
            console.log(chalk.red(`\n✗ Invalid policy pack: ${file}\n`));
            for (const issue of issues) {
              console.log(
                `  ${chalk.red('●')} ${chalk.gray(issue.path.join('.'))} ${issue.message}`
              );
            }
            console.log();
            process.exitCode = 1;
          }
        } catch (error) {
          if (spinner) spinner.stop();
          if (options.json) {
            fail(
              'POLICY_CHECK_ERROR',
              `Error validating policy pack: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          } else {
            console.log(
              chalk.red(
                `\n✗ Error validating policy pack: ${error instanceof Error ? error.message : 'Unknown error'}\n`
              )
            );
            process.exitCode = 1;
          }
        } finally {
          restoreJson();
        }
      })
    );

  // ── policy check ────────────────────────────────────────────────────────

  policyCommand
    .command('check')
    .description('Evaluate a policy pack and gate the exit code on the score')
    .option('--pack <ref>', 'Policy pack name or file path', DEFAULT_PACK)
    .option('--service <name>', 'Filter service-level rules to a single service')
    .option('--exceptions <file>', 'Policy exceptions file', DEFAULT_EXCEPTIONS_FILE)
    .option('--no-exceptions', 'Disable exceptions (for CI)')
    .option('--threshold <n>', 'Score below which the command exits non-zero', DEFAULT_THRESHOLD)
    .option('--json', 'Output as JSON')
    .action(
      createAsyncCommand(async (options) => {
        const json = Boolean(options.json);
        const restoreJson = json ? enableJsonMode() : () => {};

        const threshold = Number(options.threshold);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
          const reason = `Invalid --threshold "${options.threshold}": expected a number between 0 and 100`;
          if (json) {
            fail('POLICY_CHECK_ERROR', reason);
          } else {
            process.stderr.write(`${reason}\n`);
            process.exitCode = 1;
          }
          restoreJson();
          return;
        }

        const spinner = json
          ? undefined
          : createSpinner('Evaluating policy pack...').start();
        if (spinner) {
          processManager.addCleanup(() => spinner.stop());
          flushOutput();
        }

        try {
          const cwd = process.cwd();

          // 1. Resolve the policy pack
          let pack: PolicyPack;
          try {
            pack = await resolvePolicyPack(options.pack);
          } catch (err) {
            const msg = `Failed to resolve policy pack "${options.pack}": ${(err as Error).message}`;
            if (json) {
              fail('POLICY_CHECK_ERROR', msg);
            } else {
              if (spinner) spinner.stop();
              console.log(chalk.red(`\n✗ ${msg}\n`));
              process.exitCode = 1;
            }
            restoreJson();
            return;
          }

          // 2. Evaluate package.json-level rules
          const pkgResult = await evaluatePolicyPack(pack, cwd);

          // Collect package-level failures and passed count
          let passedCount = pkgResult.passed.length;
          let failedItems: (FailedRule & { service?: string })[] = pkgResult.failed.map(
            (f) => ({ ...f })
          );

          // 3. Load services and evaluate service-level rules
          const { services, rootPath } = await loadServicesFromWorkspace(cwd);
          let serviceResults: ServiceRuleResult[] = [];
          if (services) {
            // Filter to single service if --service was specified
            let servicesToCheck = services;
            if (options.service) {
              const filtered: typeof services = {};
              if (services[options.service]) {
                filtered[options.service] = services[options.service];
              }
              servicesToCheck = filtered;
            }
            if (Object.keys(servicesToCheck).length > 0) {
              const servicePack = {
                name: pack.name,
                description: pack.description,
                rules: pack.rules as any,
              };
              serviceResults = evaluateServiceRules(servicePack, rootPath, servicesToCheck);
            }
          }

          // Count service-level passes/failures
          for (const sr of serviceResults) {
            if (sr.passed) {
              passedCount++;
            } else {
              failedItems.push({
                ruleId: sr.ruleId,
                severity: sr.severity,
                message: sr.message,
                target: sr.serviceName,
                service: sr.serviceName,
              });
            }
          }

          // 4. Apply exceptions (unless --no-exceptions)
          let waived: WaivedRule[] = [];
          let effectiveFailed: (FailedRule & { service?: string })[] = failedItems;
          let expiredExceptions: ExpiredException[] = [];
          let exceptions: PolicyException[] = [];

          const useExceptions = options.exceptions !== false;
          if (useExceptions && failedItems.length > 0) {
            const exceptionsFile = path.resolve(
              cwd,
              typeof options.exceptions === 'string'
                ? options.exceptions
                : DEFAULT_EXCEPTIONS_FILE
            );
            exceptions = await loadExceptions(exceptionsFile);

            if (exceptions.length > 0) {
              const exceptionResult = applyExceptions(failedItems, exceptions);
              effectiveFailed = exceptionResult.stillFailed as (FailedRule & {
                service?: string;
              })[];
              waived = exceptionResult.waived;
              expiredExceptions = exceptionResult.expired;
            }
          }

          // 5. Calculate score
          const totalFailed = effectiveFailed.length;
          const totalPassed = passedCount;
          const totalChecks = totalPassed + totalFailed;
          const score =
            totalChecks === 0
              ? 100
              : Math.round((totalPassed / totalChecks) * 100);
          const grade = scoreToGrade(score);

          const hasErrors = effectiveFailed.some((f) => f.severity === 'error');

          // 6. Set exit code
          const belowThreshold = score < threshold;
          if (belowThreshold || hasErrors) {
            process.exitCode = 1;
          }

          // 7. Build result object
          const result = {
            pack: pack.name,
            score,
            grade,
            threshold,
            passed: totalPassed,
            failed: effectiveFailed,
            waived,
            serviceResults,
            expiredExceptions,
            hasErrors,
            belowThreshold,
          };

          if (json) {
            if (belowThreshold || hasErrors) {
              ok({
                ...result,
                gate: 'failed',
              });
              process.exitCode = 1;
            } else {
              ok({
                ...result,
                gate: 'passed',
              });
            }
            return;
          }

          // Human-readable output
          if (spinner) spinner.stop();

          console.log(
            chalk.cyan.bold(`\n🛡️  Policy Check: ${chalk.bold(pack.name)}\n`)
          );

          // Score + grade
          const scoreStr = `${score}/100`;
          const gradeStr = gradeColor(grade);
          console.log(
            `${chalk.bold('Score:')} ${scoreStr} ${chalk.gray('Grade:')} ${gradeStr}`
          );
          console.log(
            `${chalk.bold('Threshold:')} ${chalk.gray(String(threshold))}`
          );

          // Summary line
          const passedStr = chalk.green(`${totalPassed} passed`);
          const failedStr = chalk.red(`${effectiveFailed.length} failed`);
          const waivedStr = chalk.blue(`${waived.length} waived`);
          console.log(`\n${chalk.bold('Summary:')} ${passedStr}, ${failedStr}, ${waivedStr}`);

          // Expired exceptions
          if (expiredExceptions.length > 0) {
            console.log(
              chalk.yellow(`\n⚠ ${expiredExceptions.length} expired exception(s):`)
            );
            for (const ex of expiredExceptions) {
              console.log(
                `  ${chalk.yellow('⚠')} ${chalk.gray(`${ex.service} → ${ex.rule} (expired ${ex.expires})`)}`
              );
            }
          }

          // Failure details
          if (effectiveFailed.length > 0) {
            const errors = effectiveFailed.filter((f) => f.severity === 'error');
            const warnings = effectiveFailed.filter((f) => f.severity === 'warning');

            if (errors.length > 0) {
              console.log(chalk.red.bold(`\nErrors (${errors.length}):`));
              for (const f of errors) {
                const target = f.service ? ` [${f.service}]` : ` [${f.target}]`;
                console.log(`  ${chalk.red('✗')} ${chalk.bold(f.ruleId)}${target}`);
                console.log(`    ${chalk.gray(f.message)}`);
              }
            }

            if (warnings.length > 0) {
              console.log(chalk.yellow.bold(`\nWarnings (${warnings.length}):`));
              for (const f of warnings) {
                const target = f.service ? ` [${f.service}]` : ` [${f.target}]`;
                console.log(`  ${chalk.yellow('⚠')} ${chalk.bold(f.ruleId)}${target}`);
                console.log(`    ${chalk.gray(f.message)}`);
              }
            }
          }

          // Waived details
          if (waived.length > 0) {
            console.log(chalk.blue.bold(`\nWaived (${waived.length}):`));
            for (const w of waived) {
              const target = ` [${w.target}]`;
              console.log(`  ${chalk.blue('⊙')} ${chalk.bold(w.ruleId)}${target}`);
              console.log(`    ${chalk.gray(w.message)}`);
              if (w.waiveReason) {
                console.log(`    ${chalk.gray(`reason: ${w.waiveReason}`)}`);
              }
            }
          }

          // Gate result
          console.log();
          if (belowThreshold || hasErrors) {
            if (belowThreshold) {
              console.log(
                chalk.red(
                  `✗ Score ${score} is below threshold ${threshold}`
                )
              );
            }
            if (hasErrors) {
              console.log(
                chalk.red(
                  `✗ ${effectiveFailed.filter((f) => f.severity === 'error').length} error-severity rule(s) failed`
                )
              );
            }
          } else {
            console.log(
              chalk.green(`✓ Policy check passed (score ${score} ≥ threshold ${threshold})`)
            );
          }
          console.log();
        } catch (error) {
          if (spinner) spinner.stop();
          if (json) {
            fail(
              'POLICY_CHECK_ERROR',
              `Error evaluating policy pack: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          } else {
            console.log(
              chalk.red(
                `\n✗ Error evaluating policy pack: ${error instanceof Error ? error.message : 'Unknown error'}\n`
              )
            );
            process.exitCode = 1;
          }
        } finally {
          restoreJson();
        }
      })
    );

  program.addCommand(policyCommand);
}
