// Command runners for `service link|unlink|validate` and `service bridge diff`.

import chalk from 'chalk';
import * as path from 'path';

import { diffContracts, type ContractChange, type ContractDiff } from './diff';
import {
  linkServices,
  unlinkServices,
  validateWorkspace,
  type LinkOptions,
  type LinkResult,
  type UnlinkResult,
  type ValidateResult,
} from './link';
import { runBridgeCommand } from './run';
import { loadContract } from './spec/discover';
import type { ContractSource } from './spec/ir';

const severityColor = {
  breaking: chalk.red,
  dangerous: chalk.yellow,
  'non-breaking': chalk.green,
} as const;

/** `re-shell service link <consumer> <provider>` */
export async function runLink(options: LinkOptions & { json?: boolean }): Promise<void> {
  await runBridgeCommand<LinkResult>({
    json: options.json,
    code: 'BRIDGE_LINK_ERROR',
    run: () => linkServices(options),
    warnings: r => r.warnings,
    render: r => {
      console.log(chalk.cyan(`\nLinked ${chalk.bold(r.consumer)} -> ${chalk.bold(r.provider)} (${r.protocol})`));
      console.log(`  contract: ${r.spec} (${r.operations} operation(s))`);
      console.log(`  client:   ${r.client} [${r.languages.join(', ')}]`);
      console.log(`  config:   ${r.config}${r.dependsOnAdded ? ` (dependsOn += ${r.provider})` : ''}`);
      for (const s of r.stubs) console.log(`  stubs:    ${s.language} ${s.status} - ${s.detail}`);
      if (!r.written) console.log(chalk.yellow('\nDry-run: nothing was written.'));
      for (const w of r.warnings) console.log(chalk.yellow(`  warning: ${w}`));
    },
  });
}

/** `re-shell service unlink <consumer> <provider>` */
export async function runUnlink(options: {
  consumer: string;
  provider: string;
  cwd?: string;
  configPath?: string;
  protocol?: LinkOptions['protocol'];
  keepDependency?: boolean;
  removeClient?: boolean;
  json?: boolean;
}): Promise<void> {
  await runBridgeCommand<UnlinkResult>({
    json: options.json,
    code: 'BRIDGE_LINK_ERROR',
    run: () => unlinkServices(options),
    render: r => {
      console.log(chalk.cyan(`\nUnlinked ${r.consumer} -> ${r.provider}`));
      console.log(`  removed ${r.removed.length} link(s) from ${r.config}`);
      for (const c of r.clientRemoved) console.log(`  deleted generated client ${c}`);
    },
  });
}

/** `re-shell service validate` */
export async function runValidate(options: { cwd?: string; configPath?: string; json?: boolean }): Promise<void> {
  await runBridgeCommand<ValidateResult>({
    json: options.json,
    code: 'BRIDGE_VALIDATE_ERROR',
    run: () => validateWorkspace(options),
    exitCode: r => (r.valid ? 0 : 1),
    warnings: r => r.issues.filter(i => i.severity === 'warning').map(i => i.message),
    render: r => {
      console.log(chalk.cyan(`\nService links in ${r.config} (${r.services} service(s), ${r.links.length} link(s))`));
      for (const l of r.links) {
        const icon = l.status === 'ok' ? chalk.green('ok   ') : l.status === 'stale' ? chalk.yellow('stale') : chalk.red('broken');
        console.log(`  ${icon} ${l.consumer} -> ${l.provider} (${l.protocol})`);
      }
      for (const i of r.issues) {
        const tag = i.severity === 'error' ? chalk.red('error') : chalk.yellow('warn ');
        console.log(`  ${tag} [${i.code}] ${i.message}`);
      }
      console.log(r.valid ? chalk.green('\nAll links resolve and no cycles were found.') : chalk.red('\nWorkspace links are INVALID.'));
    },
  });
}

/** Result payload of `service bridge diff`. */
export interface DiffCommandResult extends ContractDiff {
  base: Pick<ContractSource, 'path' | 'sha256'> & { title: string; version?: string };
  head: Pick<ContractSource, 'path' | 'sha256'> & { title: string; version?: string };
  strict: boolean;
  /** No breaking change (and, with --strict, no dangerous change either). */
  pass: boolean;
}

/** `re-shell service bridge diff --base <spec> --head <spec>` */
export async function runDiff(options: { base: string; head: string; strict?: boolean; cwd?: string; json?: boolean }): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  await runBridgeCommand<DiffCommandResult>({
    json: options.json,
    code: 'BRIDGE_DIFF_ERROR',
    run: () => {
      const base = loadContract(path.resolve(cwd, options.base));
      const head = loadContract(path.resolve(cwd, options.head));
      const diff = diffContracts(base, head);
      const strict = Boolean(options.strict);
      const describe = (c: typeof base): DiffCommandResult['base'] => ({
        path: c.source.path,
        sha256: c.source.sha256,
        title: c.title,
        version: c.version,
      });
      return {
        ...diff,
        base: describe(base),
        head: describe(head),
        strict,
        pass: diff.summary.breaking === 0 && (!strict || diff.summary.dangerous === 0),
      };
    },
    exitCode: r => (r.pass ? 0 : 1),
    render: r => {
      console.log(chalk.cyan(`\nContract diff (${r.protocol}): ${path.basename(r.base.path)} -> ${path.basename(r.head.path)}`));
      const line = (c: ContractChange): string => `  ${severityColor[c.severity](c.severity.padEnd(12))} ${c.code} ${chalk.gray(c.path)} - ${c.message}`;
      for (const c of r.changes) console.log(line(c));
      if (r.changes.length === 0) console.log(chalk.green('  no differences'));
      console.log(
        `\n${r.summary.breaking} breaking, ${r.summary.dangerous} dangerous, ${r.summary.nonBreaking} non-breaking.`
      );
      console.log(r.pass ? chalk.green('Compatible: existing clients keep working.') : chalk.red(`Incompatible: ${r.strict && r.summary.breaking === 0 ? 'dangerous changes are not allowed with --strict' : 'breaking changes detected'}.`));
    },
  });
}
