// `re-shell env init|verify` — reproducible dev-environment generation (#21).
//
// Detects the workspace's toolchains (via the existing polyglot detection),
// emits devbox.json + .devcontainer/devcontainer.json from the SAME facts, and
// verifies a previously-generated config against the current detection (drift).
// Dry-run is the default; --no-dry-run writes the files. Idempotent: re-running
// after a toolchain change updates the pinned versions.

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import { scanWorkspace } from '../utils/polyglot-build';
import {
  generateDevbox,
  generateDevcontainer,
  verifyEnvConfig,
  type DetectedToolchain,
  type EnvLanguage,
} from '../utils/env-engine';
import type { EnvResponse } from '@re-shell/contracts';

/**
 * Options accepted by the `env` command.
 *
 * Controls whether the command emits machine-readable JSON or a human-readable
 * report, which subcommand (`init` vs `verify`) to run, whether files are
 * written to disk, and provides injection points for tests.
 */
export interface EnvOptions {
  /** When `true`, emit a machine-readable JSON envelope instead of styled text. */
  json?: boolean;
  /** `init` (generate configs) or `verify` (check drift against current detection). */
  mode?: 'init' | 'verify';
  /** When `false` (default), only report; when `true`, write the generated files to disk. */
  noDryRun?: boolean;
  /** Working directory override; defaults to `process.cwd()`. Primarily used by tests. */
  cwd?: string;
  /** Injectable toolchain detection function; primarily used by tests to bypass filesystem scanning. */
  detect?: () => DetectedToolchain[];
}

/** Detect toolchains by scanning the workspace (one entry per service language). */
function detectToolchains(rootDir: string): DetectedToolchain[] {
  try {
    const services = scanWorkspace(rootDir);
    return services.map(s => ({
      language: s.language as EnvLanguage,
    }));
  } catch {
    return [];
  }
}

/** Pretty-print a JSON object to a stable string. */
function serialize(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2) + '\n';
}

/**
 * Entry point for the `re-shell env init|verify` command.
 *
 * - `init`: emits `devbox.json` and `.devcontainer/devcontainer.json` from the
 *   detected toolchains. Runs as a dry-run by default; pass `noDryRun: true` to
 *   write the files. Re-running after a toolchain change updates the pinned
 *   versions (idempotent).
 * - `verify`: reads an existing `devbox.json`, re-detects the current
 *   toolchains, and reports any drift (missing or extra entries).
 *
 * Generating the config is pure/offline; no network calls are made.
 *
 * @param options - Configuration controlling mode, output format, and write behavior.
 * @returns A promise that resolves once the command has finished rendering its report.
 */
export async function runEnv(options: EnvOptions): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const rootDir = path.resolve(cwd);
  const mode = options.mode ?? 'init';
  const dryRun = !options.noDryRun;

  const spinner = json ? null : createSpinner(`${mode === 'init' ? 'Generating' : 'Verifying'} dev environment…`, undefined, { json });
  spinner?.start();

  try {
    const toolchains = options.detect ? options.detect() : detectToolchains(rootDir);
    const languages = [...new Set(toolchains.map(t => t.language))].filter(l => l !== 'unknown').sort();

    if (languages.length === 0) {
      emitError(json, 'No toolchains detected in the workspace.');
      return;
    }

    const warnings: string[] = [];
    const files: { path: string; kind: 'devbox' | 'devcontainer'; written: boolean }[] = [];

    if (mode === 'init') {
      const devbox = generateDevbox(toolchains);
      const devcontainer = generateDevcontainer(toolchains);
      const devboxPath = 'devbox.json';
      const devcontainerPath = '.devcontainer/devcontainer.json';

      if (!dryRun) {
        fs.writeFileSync(path.join(rootDir, devboxPath), serialize(devbox), 'utf8');
        fs.mkdirSync(path.join(rootDir, path.dirname(devcontainerPath)), { recursive: true });
        fs.writeFileSync(path.join(rootDir, devcontainerPath), serialize(devcontainer), 'utf8');
      }
      files.push({ path: devboxPath, kind: 'devbox', written: !dryRun });
      files.push({ path: devcontainerPath, kind: 'devcontainer', written: !dryRun });
      warnings.push(
        dryRun
          ? `env init dry-run: would write ${files.length} file(s) for ${languages.length} toolchain(s).`
          : `env init: wrote ${files.length} file(s) for ${languages.length} toolchain(s).`
      );
    } else {
      // verify: read the existing devbox.json and compare to current detection.
      const devboxPath = path.join(rootDir, 'devbox.json');
      let generatedPackages: string[] = [];
      try {
        const raw = JSON.parse(fs.readFileSync(devboxPath, 'utf8'));
        if (Array.isArray(raw.packages)) generatedPackages = raw.packages.map(String);
      } catch {
        warnings.push('no devbox.json found to verify; run `re-shell env init` first.');
      }
      const drift = verifyEnvConfig(generatedPackages, toolchains);
      if (drift.missing.length > 0) {
        warnings.push(`devbox.json is missing toolchains added since generation: ${drift.missing.join(', ')}`);
      }
      if (drift.extra.length > 0) {
        warnings.push(`devbox.json has toolchains no longer detected: ${drift.extra.join(', ')}`);
      }
      if (drift.missing.length === 0 && drift.extra.length === 0 && generatedPackages.length > 0) {
        warnings.push('devbox.json is up to date with the current detection.');
      }
    }

    const payload: EnvResponse = {
      languages,
      dryRun,
      files,
      drift: { missing: [], extra: [] },
      warnings,
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload, mode);
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit an ENV_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('ENV_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Human-readable render of the env report. */
function renderHuman(payload: EnvResponse, mode: string): void {
  process.stdout.write(chalk.cyan.bold(`\n▶ env ${mode}\n\n`));
  process.stdout.write(`  ${chalk.bold('toolchains')}  ${payload.languages.join(', ') || '(none)'}\n\n`);
  for (const f of payload.files) {
    const mark = f.written ? chalk.green('✓') : chalk.gray('·');
    process.stdout.write(`  ${mark} ${f.kind.padEnd(12)} ${f.path}\n`);
  }
  for (const w of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${w}\n`));
  }
  process.stdout.write('\n');
}
