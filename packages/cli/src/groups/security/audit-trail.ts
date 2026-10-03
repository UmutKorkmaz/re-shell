import * as fs from 'fs';
import * as path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { createAsyncCommand } from '../../utils/error-handler';
import { enableJsonMode, ok, fail } from '../../utils/json-output';
import { findAuditRoot } from '../../audit/settings';
import { verifyAuditLog } from '../../audit/log';
import {
  buildComplianceReport,
  listFrameworks,
  parseSince,
  renderComplianceMarkdown,
  type ComplianceFramework,
  type ComplianceReport,
} from '../../audit/compliance';

/**
 * Registers the real audit-trail commands:
 *   security audit verify [--json] [--expect-head <hash>]
 *   security compliance report --framework soc2|iso27001 [--since] [--json|--format md]
 *
 * `audit verify` is attached to the existing `security audit <name>` generator
 * command; commander dispatches a matching subcommand name before treating the
 * token as the generator's positional `<name>`.
 */
export function registerAuditTrail(security: Command): void {
  const audit = security.commands.find(c => c.name() === 'audit') ?? security.command('audit');

  audit
    .command('verify')
    .description('Verify the hash-chained audit log (.re-shell/audit/audit.jsonl) for tampering; exits 1 on failure')
    .option('--json', 'Output a JSON envelope')
    .option('--expect-head <hash>', 'Externally anchored head hash the log must end with')
    .action(
      createAsyncCommand(async options => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        try {
          const root = findAuditRoot(process.cwd());
          if (!root) {
            if (options.json) fail('NOT_IN_MONOREPO', 'No Re-Shell workspace found; there is no audit log to verify.');
            else {
              console.error(chalk.red('No Re-Shell workspace found; there is no audit log to verify.'));
              process.exitCode = 1;
            }
            return;
          }
          const result = verifyAuditLog(root, { expectHead: options.expectHead });

          if (options.json) {
            if (result.valid) ok(result);
            else fail('AUDIT_ERROR', `Audit log verification failed (${result.failures.length} problem${result.failures.length === 1 ? '' : 's'})`, { ...result });
            return;
          }

          if (!result.logExists) {
            console.log(chalk.yellow(`No audit log at ${result.logPath} yet (nothing to verify).`));
            return;
          }
          if (result.valid) {
            console.log(chalk.green(`Audit log verified: ${result.entries} entries, chain intact (head seq ${result.lastSeq}, ${result.lastHash}).`));
            return;
          }
          console.error(chalk.red(`Audit log verification FAILED (${result.failures.length} problem${result.failures.length === 1 ? '' : 's'}):`));
          for (const f of result.failures) {
            console.error(chalk.red(`  [${f.code}] ${f.line > 0 ? `line ${f.line}: ` : ''}${f.message}`));
          }
          process.exitCode = 1;
        } finally {
          restoreJson();
        }
      })
    );

  const compliance = new Command('compliance').description(
    'Compliance evidence mapped from the audit trail, policy checks and configuration'
  );

  compliance
    .command('report')
    .description('Map audit evidence + policy check results + config to SOC 2 / ISO 27001 controls (states which controls lack evidence)')
    .requiredOption('--framework <framework>', `Framework: ${listFrameworks().join('|')}`)
    .option('--since <when>', 'Only consider audit entries since an ISO date or relative window (e.g. 30d)')
    .option('--pack <pack>', 'Policy pack for the policy-check evidence (built-in name or file)')
    .option('--format <format>', 'Output format: text|md', 'text')
    .option('--output <file>', 'Write the report to a file instead of stdout')
    .option('--strict', 'Exit non-zero when any control has no evidence')
    .option('--json', 'Output a JSON envelope')
    .action(
      createAsyncCommand(async options => {
        const restoreJson = options.json ? enableJsonMode() : () => {};
        try {
          const framework = String(options.framework).toLowerCase() as ComplianceFramework;
          if (!listFrameworks().includes(framework)) {
            const message = `Unknown framework "${options.framework}". Supported: ${listFrameworks().join(', ')}.`;
            if (options.json) fail('COMPLIANCE_ERROR', message);
            else {
              console.error(chalk.red(message));
              process.exitCode = 1;
            }
            return;
          }
          if (!['text', 'md'].includes(options.format)) {
            const message = `Unknown format "${options.format}". Supported: text, md.`;
            if (options.json) fail('COMPLIANCE_ERROR', message);
            else {
              console.error(chalk.red(message));
              process.exitCode = 1;
            }
            return;
          }
          const root = findAuditRoot(process.cwd());
          if (!root) {
            const message = 'No Re-Shell workspace found; run this from inside a workspace.';
            if (options.json) fail('NOT_IN_MONOREPO', message);
            else {
              console.error(chalk.red(message));
              process.exitCode = 1;
            }
            return;
          }

          let report: ComplianceReport;
          try {
            report = await buildComplianceReport(root, {
              framework,
              since: parseSince(options.since),
              pack: options.pack,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (options.json) fail('COMPLIANCE_ERROR', message);
            else {
              console.error(chalk.red(message));
              process.exitCode = 1;
            }
            return;
          }

          const warnings = report.controls.filter(c => c.status !== 'evidence').map(c => `${c.id} ${c.title}: ${c.status}`);
          if (options.output) {
            const target = path.resolve(process.cwd(), options.output);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, options.format === 'md' ? renderComplianceMarkdown(report) : JSON.stringify(report, null, 2) + '\n');
          }

          if (options.json) ok(report, warnings);
          else if (!options.output) {
            console.log(options.format === 'md' ? renderComplianceMarkdown(report) : renderText(report));
          } else {
            console.log(chalk.green(`Compliance report written to ${options.output}`));
          }

          if (options.strict && report.summary.noEvidence > 0) process.exitCode = 1;
        } finally {
          restoreJson();
        }
      })
    );

  security.addCommand(compliance);
}

function renderText(r: ComplianceReport): string {
  const color = { evidence: chalk.green, partial: chalk.yellow, 'no-evidence': chalk.red } as const;
  const lines: string[] = [];
  lines.push(chalk.cyan.bold(`\nCompliance evidence: ${r.frameworkName}`));
  lines.push(chalk.gray(`Generated ${r.generatedAt}${r.since ? `, since ${r.since}` : ''}`));
  lines.push(
    `Audit log: ${r.audit.present ? `${r.audit.entriesInWindow} entries in window, chain ${r.audit.chainValid ? 'intact' : chalk.red('BROKEN')}` : 'none'}; ` +
      `policy check: ${r.policy.ran ? `${r.policy.score}%` : 'not evaluated'}\n`
  );
  for (const c of r.controls) {
    lines.push(`${color[c.status](c.status.toUpperCase().padEnd(11))} ${chalk.bold(c.id)} ${c.title}`);
    for (const e of c.evidence) lines.push(chalk.gray(`    + [${e.source}] ${e.summary}`));
    for (const g of c.gaps) lines.push(chalk.gray(`    - ${g}`));
  }
  lines.push(
    `\n${r.summary.evidence} evidence, ${r.summary.partial} partial, ${r.summary.noEvidence} no evidence of ${r.summary.total} evaluated controls.`
  );
  lines.push(chalk.gray('Not evaluated: ' + r.notEvaluated.map(n => `${n.id} ${n.title}`).join('; ')));
  lines.push(chalk.gray(`\n${r.disclaimer}\n`));
  return lines.join('\n');
}
