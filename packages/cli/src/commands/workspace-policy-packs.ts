import chalk from 'chalk';
import type { ErrorCode } from '@re-shell/contracts';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import { ValidationError } from '../utils/error-handler';
import {
  installPolicyPack,
  listPolicyPacks,
  removePolicyPack,
  searchPolicyPacks,
  PolicyPackError,
} from '../utils/policy-pack-marketplace';
import { PolicyPackStoreError } from '../utils/policy-pack-store';
import { resolveVerifyPolicy } from '../utils/plugin-signature';
import { PluginStoreError } from '../utils/plugin-store';
import { RegistryUnreachableError, type FetchLike } from '../utils/registry-client';
import type { ProgressSpinner } from '../utils/spinner';

/**
 * Commands for distributing policy packs through the npm registry
 * (`workspace policy search | install | list | remove`). Pack evaluation
 * (`workspace policy check`) lives in `workspace-policy.ts`.
 *
 * Every command supports `--json` (the standard envelope) and exits non-zero on
 * failure; nothing is simulated.
 */

/** Options shared by the policy-pack commands. */
export interface PolicyPackCommandOptions {
  json?: boolean;
  /** Workspace root (default: `process.cwd()`). */
  cwd?: string;
  /** Optional spinner to stop before rendering. */
  spinner?: ProgressSpinner;
  /** npm registry URL. */
  registry?: string;
  /** Maximum search results. */
  limit?: number | string;
  /** `--verify` / `--no-verify`; undefined defers to the workspace security setting. */
  verify?: boolean;
  force?: boolean;
  dryRun?: boolean;
  /** Injected fetch (tests). */
  fetchImpl?: FetchLike;
}

interface Classified {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** Map a thrown error to the JSON error code and message. */
function classify(error: unknown): Classified {
  if (error instanceof RegistryUnreachableError) {
    return { code: 'MARKETPLACE_UNREACHABLE', message: error.message, details: error.details };
  }
  if (error instanceof PolicyPackError) {
    const code: ErrorCode =
      error.code === 'unverified'
        ? 'MARKETPLACE_VERIFY_ERROR'
        : error.code === 'not-found'
          ? 'POLICY_PACK_NOT_FOUND'
          : 'POLICY_PACK_ERROR';
    return { code, message: error.message, details: { reason: error.code, ...(error.details ?? {}) } };
  }
  if (error instanceof PolicyPackStoreError || error instanceof PluginStoreError) {
    return { code: 'POLICY_PACK_ERROR', message: error.message, details: error.details };
  }
  return { code: 'POLICY_PACK_ERROR', message: error instanceof Error ? error.message : String(error) };
}

function report(json: boolean, error: unknown, prefix: string): void {
  const { code, message, details } = classify(error);
  if (json) {
    fail(code, message, details);
    return;
  }
  throw new ValidationError(`${prefix}: ${message}`);
}

/**
 * `workspace policy search [query]` - find policy packs on the npm registry
 * (keyword `reshell-policy-pack`).
 */
export async function runPolicySearch(
  query: string | undefined,
  options: PolicyPackCommandOptions = {}
): Promise<void> {
  const json = options.json === true;
  const restore = json ? enableJsonMode() : () => {};
  try {
    const limit = options.limit === undefined ? 20 : Number(options.limit);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new PolicyPackError('invalid-pack', `--limit must be a positive integer (got ${String(options.limit)})`);
    }
    const packs = await searchPolicyPacks(query, {
      limit,
      registryUrl: options.registry,
      fetchImpl: options.fetchImpl,
    });
    options.spinner?.stop();

    if (json) {
      ok({ query: query ?? null, packs, total: packs.length });
      return;
    }
    if (packs.length === 0) {
      console.log(chalk.yellow(`No policy packs found${query ? ` for "${query}"` : ''}.`));
      return;
    }
    console.log(chalk.cyan(`\n📋 Policy packs${query ? ` matching "${query}"` : ''} (${packs.length})\n`));
    for (const pack of packs) {
      console.log(`${chalk.white(pack.name)} ${chalk.gray(`v${pack.version}`)}`);
      if (pack.description) console.log(`  ${pack.description}`);
      console.log(chalk.gray(`  install: re-shell workspace policy install ${pack.name}`));
    }
  } catch (error) {
    report(json, error, 'Policy pack search failed');
  } finally {
    restore();
  }
}

/**
 * `workspace policy install <source>` - install a pack from npm, git, a package
 * directory or a pack file into `.re-shell/policy-packs/`.
 */
export async function runPolicyInstall(
  source: string,
  options: PolicyPackCommandOptions = {}
): Promise<void> {
  const json = options.json === true;
  const root = options.cwd ?? process.cwd();
  const restore = json ? enableJsonMode() : () => {};
  try {
    const verifySignatures = await resolveVerifyPolicy(root, options.verify);
    const result = await installPolicyPack(source, {
      workspaceRoot: root,
      force: options.force,
      dryRun: options.dryRun,
      registryUrl: options.registry,
      fetchImpl: options.fetchImpl,
      verifySignatures,
    });
    options.spinner?.stop();

    if (json) {
      const { warnings, ...data } = result;
      ok(data, warnings);
      return;
    }
    console.log(
      chalk.green(
        `${result.dryRun ? 'Validated' : result.replaced ? 'Replaced' : 'Installed'} policy pack ` +
          `${result.name}${result.version ? `@${result.version}` : ''} (${result.ruleCount} rule(s), source: ${result.source})`
      )
    );
    console.log(chalk.gray(`  ${result.dryRun ? 'Would store' : 'Stored'}: ${result.path}`));
    if (result.signature?.gated) {
      console.log(chalk.gray(`  Signature: ${result.signature.verified ? 'verified' : 'NOT verified'}`));
    }
    result.warnings.forEach((w) => console.log(chalk.yellow(`  ⚠ ${w}`)));
    if (!result.dryRun) {
      console.log(chalk.gray(`  Use it with: re-shell workspace policy check --pack ${result.name}`));
    }
  } catch (error) {
    report(json, error, 'Policy pack installation failed');
  } finally {
    restore();
  }
}

/** `workspace policy list` - built-in and installed packs. */
export async function runPolicyList(options: PolicyPackCommandOptions = {}): Promise<void> {
  const json = options.json === true;
  const restore = json ? enableJsonMode() : () => {};
  try {
    const { warnings, ...data } = await listPolicyPacks(options.cwd ?? process.cwd());
    options.spinner?.stop();
    if (json) {
      ok(data, warnings);
      return;
    }
    warnings.forEach((w) => console.log(chalk.yellow(`⚠ ${w}`)));
    console.log(chalk.cyan(`\n📋 Policy packs (${data.total})\n`));
    for (const pack of data.packs) {
      const where =
        pack.source === 'builtin'
          ? 'built-in'
          : `${pack.source}${pack.package ? `: ${pack.package}` : ''}${pack.version ? `@${pack.version}` : ''}`;
      console.log(`${chalk.white(pack.name)} ${chalk.gray(`(${where}, ${pack.ruleCount} rule(s))`)}`);
      if (pack.description) console.log(`  ${pack.description}`);
    }
  } catch (error) {
    report(json, error, 'Policy pack listing failed');
  } finally {
    restore();
  }
}

/** `workspace policy remove <name>` - delete an installed pack. */
export async function runPolicyRemove(
  name: string,
  options: PolicyPackCommandOptions = {}
): Promise<void> {
  const json = options.json === true;
  const restore = json ? enableJsonMode() : () => {};
  try {
    const result = await removePolicyPack(options.cwd ?? process.cwd(), name);
    options.spinner?.stop();
    if (json) {
      ok(result);
      return;
    }
    console.log(chalk.green(`Removed policy pack ${result.name}`));
    result.removed.forEach((p) => console.log(chalk.gray(`  Removed: ${p}`)));
  } catch (error) {
    report(json, error, 'Policy pack removal failed');
  } finally {
    restore();
  }
}
