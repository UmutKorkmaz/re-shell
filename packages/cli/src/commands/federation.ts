// `re-shell federation check` — continuous MF contract & type enforcement.
//
// Discovers Module-Federation manifests across the workspace, parses each into a
// normalized remote, optionally diffs the current set against a baseline for
// breaking export/type changes, detects shared-dependency version skew across
// remotes, and emits a CI report. The check EXITS NON-ZERO on any breaking
// change or skew so CI can enforce compatibility.

import * as path from 'path';
import * as fs from 'fs';
import chalk from 'chalk';
import { ok, fail } from '../utils/json-output';
import { createSpinner } from '../utils/spinner';
import {
  parseManifest,
  diffRemote,
  diffToFindings,
  detectSharedSkew,
  skewToFindings,
  type FederationRemoteLite,
  type FederationFindingLite,
} from '../utils/federation-engine';
import type {
  FederationFinding,
  FederationRemote,
  FederationResponse,
} from '@re-shell/contracts';

/** Candidate manifest filenames, in discovery order. */
const MANIFEST_CANDIDATES = [
  'federation-manifest.json',
  'mf-manifest.json',
  'module-federation.json',
];

/** Conventional roots scanned for manifests. */
const MANIFEST_DIRS = ['apps', 'packages', 'services', 'dist'];

/** Options accepted by the `federation check` command. */
export interface FederationCommandOptions {
  json?: boolean;
  /** Baseline directory (a previous manifest set) to diff against. */
  baseline?: string;
  /** Explicit manifest paths/globs to check (overrides discovery). */
  manifests?: string[];
  /** Working directory override (tests). */
  cwd?: string;
}

/** Read + JSON-parse a manifest file, returning null on any failure. */
function readManifest(filePath: string): Record<string, unknown> | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Discover MF manifests under `rootDir`: scan the conventional dirs for the
 * candidate filenames. Returns repo-relative paths (deduped, sorted). When
 * `explicit` paths are given, those are resolved and returned directly.
 */
function discoverManifests(
  rootDir: string,
  explicit?: readonly string[]
): string[] {
  if (explicit && explicit.length > 0) {
    // Normalize every path against rootDir BEFORE testing, so traversal written
    // as `./..`, `foo/../..`, or an absolute-outside-root path is collapsed to a
    // `..`-prefixed (or absolute) relative path and rejected — never read.
    return explicit
      .map(p => path.relative(rootDir, path.resolve(rootDir, p)))
      .filter(p => p !== '' && !p.startsWith('..') && !path.isAbsolute(p));
  }
  const found = new Set<string>();
  for (const dir of MANIFEST_DIRS) {
    const dirAbs = path.join(rootDir, dir);
    // (a) A manifest directly at the conventional-dir root (apps/federation-manifest.json).
    for (const candidate of MANIFEST_CANDIDATES) {
      if (fs.existsSync(path.join(dirAbs, candidate))) {
        found.add(path.join(dir, candidate));
      }
    }
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      continue;
    }
    const visited = new Set<string>();
    for (const entry of entries) {
      // Treat symlinked dirs as dirs (pnpm/yarn symlinked workspaces) but guard
      // against symlink loops via a realpath visited-set.
      const isDirLike = entry.isDirectory() || entry.isSymbolicLink();
      if (!isDirLike) continue;
      try {
        const real = fs.realpathSync(path.join(dirAbs, entry.name));
        if (visited.has(real)) continue;
        visited.add(real);
      } catch {
        continue;
      }
      for (const candidate of MANIFEST_CANDIDATES) {
        const candidatePath = path.join(dirAbs, entry.name, candidate);
        if (fs.existsSync(candidatePath)) {
          found.add(path.join(dir, entry.name, candidate));
        }
      }
      // Also check one level deeper (apps/<mf>/dist/federation-manifest.json).
      try {
        for (const sub of fs.readdirSync(path.join(dirAbs, entry.name), {
          withFileTypes: true,
        })) {
          if (!sub.isDirectory() && !sub.isSymbolicLink()) continue;
          for (const candidate of MANIFEST_CANDIDATES) {
            const deep = path.join(dirAbs, entry.name, sub.name, candidate);
            if (fs.existsSync(deep)) {
              found.add(path.join(dir, entry.name, sub.name, candidate));
            }
          }
        }
      } catch {
        // ignore unreadable subdirs
      }
    }
  }
  return [...found].sort();
}

/**
 * Parse a set of manifest paths into remotes (best-effort, with warnings).
 * Returns each SURVIVING remote paired with its originating manifest path, so
 * the caller never has to re-derive the remote→manifest mapping positionally
 * (which breaks whenever a manifest is skipped for being unparseable, unnamed,
 * or a duplicate).
 */
function parseRemotes(
  rootDir: string,
  manifestPaths: readonly string[]
): {
  remotes: { remote: FederationRemoteLite; manifest: string }[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const remotes: { remote: FederationRemoteLite; manifest: string }[] = [];
  const seenNames = new Set<string>();
  for (const rel of manifestPaths) {
    const abs = path.join(rootDir, rel);
    const raw = readManifest(abs);
    if (raw === null) {
      warnings.push(`could not parse manifest ${rel}; skipped`);
      continue;
    }
    const remote = parseManifest(raw, path.basename(path.dirname(rel)));
    if (!remote) {
      warnings.push(`manifest ${rel} has no derivable container name; skipped`);
      continue;
    }
    if (seenNames.has(remote.name)) {
      warnings.push(`duplicate remote "${remote.name}" (from ${rel}); first kept`);
      continue;
    }
    seenNames.add(remote.name);
    remotes.push({ remote, manifest: rel });
  }
  return { remotes, warnings };
}

/** Project a pure remote onto the wire FederationRemote contract shape. */
function toWireRemote(
  remote: FederationRemoteLite,
  manifestPath: string
): FederationRemote {
  return {
    name: remote.name,
    manifest: manifestPath,
    exposes: remote.exposes.map(e => ({
      id: e.id,
      ...(e.path ? { path: e.path } : {}),
      ...(e.types ? { types: e.types } : {}),
    })),
    shared: remote.shared.map(s => ({
      name: s.name,
      ...(s.version ? { version: s.version } : {}),
      ...(s.requiredVersion ? { requiredVersion: s.requiredVersion } : {}),
      ...(s.singleton !== undefined ? { singleton: s.singleton } : {}),
    })),
  };
}

/** Project a pure finding onto the wire FederationFinding shape. */
function toWireFinding(f: FederationFindingLite): FederationFinding {
  return {
    severity: f.severity,
    kind: f.kind,
    message: f.message,
    ...(f.remote ? { remote: f.remote } : {}),
    ...(f.detail ? { detail: { ...f.detail } } : {}),
  };
}

/**
 * `re-shell federation check` — continuous MF contract & type enforcement.
 *
 * Gate semantics: when there is any breaking change or shared-dep skew the
 * command STILL emits a success envelope (the findings are advisory data) but
 * exits non-zero so CI can gate on it. A genuine error (no manifests found) is
 * reported via the FEDERATION_ERROR envelope instead.
 */
export async function runFederationCheck(
  options: FederationCommandOptions
): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  const rootDir = path.resolve(cwd);

  const spinner = json
    ? null
    : createSpinner('Checking federation contracts…', undefined, { json });
  spinner?.start();

  try {
    const manifestPaths = discoverManifests(rootDir, options.manifests);
    if (manifestPaths.length === 0) {
      emitError(
        json,
        `No federation manifests found under ${MANIFEST_DIRS.join(', ')} ` +
          `(looked for ${MANIFEST_CANDIDATES.join(', ')}). ` +
          'Build your remotes or pass --manifest <paths>.'
      );
      return;
    }

    const parsed = parseRemotes(rootDir, manifestPaths);
    const warnings = [...parsed.warnings];
    // Flat remote list + the remote→manifest map derived from the parse pairing
    // (NOT by positional index, which would drift after any skipped manifest).
    const remotes = parsed.remotes.map(r => r.remote);
    const manifestByRemote = new Map<string, string>(
      parsed.remotes.map(r => [r.remote.name, r.manifest])
    );

    const findings: FederationFindingLite[] = [];
    let hasBaseline = false;

    // ── Baseline diff (breaking changes) ───────────────────────────────────────
    if (options.baseline) {
      hasBaseline = true;
      const baselineDir = path.resolve(rootDir, options.baseline);
      const baselinePaths = discoverManifests(baselineDir);
      const baselineParsed = parseRemotes(baselineDir, baselinePaths);
      warnings.push(...baselineParsed.warnings);
      const baselineByName = new Map(
        baselineParsed.remotes.map(r => [r.remote.name, r.remote])
      );

      for (const current of remotes) {
        const baseline = baselineByName.get(current.name);
        if (!baseline) {
          warnings.push(`no baseline manifest for remote "${current.name}"; skipped diff`);
          continue;
        }
        const diff = diffRemote(baseline, current);
        findings.push(...diffToFindings(current.name, diff));
      }
    }

    // ── Cross-remote shared-dep skew ───────────────────────────────────────────
    const skews = detectSharedSkew(remotes);
    for (const skew of skews) {
      findings.push(skewToFindings(skew));
    }

    const breakingCount = findings.filter(f => f.severity === 'breaking').length;
    const skewCount = findings.filter(f => f.severity === 'skew').length;
    const passed = breakingCount === 0 && skewCount === 0;

    // Sort findings: breaking first, then skew, then info.
    const severityRank = { breaking: 0, skew: 1, info: 2 } as const;
    findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

    const payload: FederationResponse = {
      pass: passed,
      breakingCount,
      skewCount,
      hasBaseline,
      remotes: remotes.map(r => toWireRemote(r, manifestByRemote.get(r.name) ?? '')),
      findings: findings.map(toWireFinding),
      warnings,
    };

    if (json) {
      ok(payload);
    } else {
      renderHuman(payload);
    }

    // Gate: unknown breaking change or skew fails the CI check.
    if (!passed) {
      process.exitCode = 1;
    }
  } finally {
    spinner?.stop();
  }
}

/** Emit a FEDERATION_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('FEDERATION_ERROR', message);
  } else {
    process.stderr.write(chalk.red(`\n✗ ${message}\n`));
    process.exitCode = 1;
  }
}

/** Colour a finding severity for the terminal. */
function colourSeverity(severity: string): string {
  switch (severity) {
    case 'breaking':
      return chalk.red.bold(severity.toUpperCase());
    case 'skew':
      return chalk.yellow.bold(severity.toUpperCase());
    default:
      return chalk.gray(severity.toUpperCase());
  }
}

/** Human-readable render of the federation report (non-JSON path). */
function renderHuman(payload: FederationResponse): void {
  process.stdout.write(chalk.cyan.bold('\n▶ federation check\n\n'));

  process.stdout.write(
    `  ${chalk.bold('remotes')}  ${payload.remotes.length}  ` +
      chalk.gray(
        `(${payload.remotes.reduce((n, r) => n + r.exposes.length, 0)} exposes · ` +
          `${payload.remotes.reduce((n, r) => n + r.shared.length, 0)} shared)`
      ) + '\n\n'
  );

  for (const remote of payload.remotes) {
    process.stdout.write(
      `  ${chalk.bold(remote.name)}  ` +
        chalk.gray(`${remote.exposes.length} expose(s) · ${remote.shared.length} shared`) +
        '\n'
    );
  }

  if (payload.findings.length === 0) {
    process.stdout.write(chalk.green('\n  ✓ no breaking changes or shared-dep skew\n'));
  } else {
    process.stdout.write('\n');
    for (const f of payload.findings) {
      process.stdout.write(`  ${colourSeverity(f.severity)}  ${f.message}\n`);
    }
  }

  const gate = payload.pass ? chalk.green('PASS') : chalk.red('FAIL');
  process.stdout.write(
    `\n  ${chalk.bold('result')}  ${gate}  ` +
      chalk.gray(
        `(${payload.breakingCount} breaking · ${payload.skewCount} skew` +
          `${payload.hasBaseline ? ' · diffed against baseline' : ''})`
      ) +
      '\n'
  );

  for (const warning of payload.warnings) {
    process.stdout.write(chalk.yellow(`  ! ${warning}\n`));
  }
  process.stdout.write('\n');
}
