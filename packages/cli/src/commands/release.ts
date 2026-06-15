// `re-shell release` orchestrator.
//
// Graph-aware semver bump propagation across internal workspace deps, with
// changelog + annotated git-tag generation and per-registry publish adapters.
//
// Safe by default: `--dry-run` is TRUE unless `--no-dry-run` is passed. In
// dry-run the full plan is computed but NOTHING is written/tagged/published.
// Applying (`--no-dry-run`) writes bumped manifests + dependent ranges +
// CHANGELOG fragments and creates annotated tags. Registry publish runs ONLY
// when BOTH `--no-dry-run` AND `--publish` are given. All git mutations and
// publishes go through injectable functions so tests never touch the network or
// real git.
//
// Only TYPES are imported from contracts (the dist is ESM-only and the CLI is
// CommonJS, so a value import would crash the binary). The wire payload is
// constructed inline and validated by the contracts schema in tests.

import * as path from 'path';
import { ok, fail } from '../utils/json-output';
import { discoverWorkspace } from '../utils/task-runner';
import {
  computeReleasePlan,
  type BumpLevel,
  type ReleasableUnit,
  type ReleasePlanEntry,
} from '../utils/release-engine';
import {
  detectManifestType,
  readCurrentVersion,
  writeManifestVersion,
  updateDependentRanges,
  writeChangelog,
  type ManifestType,
} from '../utils/release-manifest';
import {
  defaultGitRunner,
  isGitRepo,
  lastTag,
  changedFilesSince,
  commitSubjectsSince,
  createAnnotatedTag,
  type GitRunner,
} from '../utils/release-git';
import { execPublish, type PublishExecutor } from '../utils/release-adapters';
import type { ReleaseResponse, ReleaseUnitPlan } from '@re-shell/contracts';

/** Options accepted by `runRelease`. */
export interface ReleaseCommandOptions {
  json?: boolean;
  /** Safe default: dry-run is TRUE unless explicitly set false. */
  dryRun?: boolean;
  /** Publish to registries (only honoured alongside `--no-dry-run`). */
  publish?: boolean;
  /** Global default bump level for changed units. */
  bump?: BumpLevel;
  /** Base ref for change detection (default: last tag). */
  since?: string;
  /** Limit the release to these names (plus their dependents). */
  filter?: string[];
  /** Override the detected registry for every unit. */
  registry?: string;
  /** Working directory override (tests). */
  cwd?: string;
  /** Injectable git runner (tests / dry-run isolation). */
  gitRunner?: GitRunner;
  /** Injectable publish executor (tests / network isolation). */
  publishExecutor?: PublishExecutor;
}

/** Manifest types that carry no version and so cannot be released. */
function isReleasableManifest(t: ManifestType): boolean {
  return t !== 'unknown' && t !== 'Gemfile';
}

/** Map a manifest type to the engine's language label. */
function languageForManifest(t: ManifestType): string {
  switch (t) {
    case 'package.json':
      return 'typescript';
    case 'pyproject.toml':
      return 'python';
    case 'Cargo.toml':
      return 'rust';
    case 'pom.xml':
      return 'java';
    case 'composer.json':
      return 'php';
    default:
      return 'unknown';
  }
}

/** A discovered unit paired with its on-disk directory + manifest metadata. */
interface ResolvedUnit extends ReleasableUnit {
  readonly dir: string;
  readonly manifest: ManifestType;
}

/**
 * `re-shell release` entrypoint. Verifies a git repo, discovers the workspace,
 * resolves the changed set since the base ref, computes the graph-aware plan,
 * and (only when applying) writes versions/changelogs/tags and optionally
 * publishes. Always emits a `{ ok, data, warnings }` envelope.
 */
export async function runRelease(options: ReleaseCommandOptions): Promise<void> {
  const json = Boolean(options.json);
  const cwd = options.cwd ?? process.cwd();
  // Default-safe: undefined means "not explicitly disabled" → dry-run TRUE.
  const dryRun = options.dryRun !== false;
  const gitRunner = options.gitRunner ?? defaultGitRunner;
  const publishExecutor = options.publishExecutor ?? defaultPublishExecutor;
  const warnings: string[] = [];

  // ── Validate --since ref early (before any git call) ────────────────────────
  if (options.since !== undefined && options.since.startsWith('-')) {
    emitError(json, `invalid --since ref: cannot start with '-' (got "${options.since}")`);
    return;
  }

  // ── Hard repo probe ─────────────────────────────────────────────────────────
  if (!(await isGitRepo(gitRunner, cwd))) {
    emitError(json, `Not a git repository: ${cwd}`);
    return;
  }

  // ── Discover workspace ──────────────────────────────────────────────────────
  const discovery = await discoverWorkspace(cwd);
  if (discovery.packages.size === 0) {
    emitError(json, `No workspace packages found under ${cwd}`);
    return;
  }
  // The discovery graph is a ReadonlyMap; the pure engine takes a mutable Map so
  // it can build the reverse graph without aliasing. Copy once at the boundary.
  const graph = new Map<string, readonly string[]>(discovery.graph);

  // ── Resolve base ref + changed packages ─────────────────────────────────────
  const sinceRef = options.since ?? (await lastTag(gitRunner, cwd));
  const noTags = sinceRef === null;
  const changedNames = noTags
    ? new Set(discovery.packages.keys())
    : await resolveChangedPackages(gitRunner, cwd, sinceRef, discovery);
  if (noTags) {
    warnings.push(
      'No base ref/tag found: treating ALL discovered packages as changed.'
    );
  }

  // ── Apply --filter (limit to filtered names + their dependents) ──────────────
  if (options.filter && options.filter.length > 0) {
    for (const name of options.filter) {
      if (!discovery.packages.has(name)) {
        warnings.push(
          `--filter "${name}" does not match any discovered package (ignored)`
        );
      }
    }
  }
  const filtered = applyFilter(changedNames, options.filter, graph);

  // ── Read versions + manifest metadata per unit ──────────────────────────────
  const units: ResolvedUnit[] = [];
  for (const [name, pkg] of discovery.packages) {
    const manifest = detectManifestType(pkg.dir);
    if (!isReleasableManifest(manifest)) {
      if (filtered.has(name)) {
        warnings.push(`skipping "${name}": unsupported manifest type "${manifest}"`);
      }
      continue;
    }
    const currentVersion = readCurrentVersion(pkg.dir, manifest);
    if (currentVersion === null) {
      if (filtered.has(name)) {
        warnings.push(`skipping "${name}": no readable version in ${manifest}`);
      }
      continue;
    }
    units.push({
      name,
      path: path.relative(cwd, pkg.dir),
      language: languageForManifest(manifest),
      manifestType: manifest,
      currentVersion,
      dir: pkg.dir,
      manifest,
    });
  }

  // ── Collect commit subjects per changed pkg (for changelog bodies) ───────────
  const commitsByPkg = new Map<string, string[]>();
  for (const unit of units) {
    if (!filtered.has(unit.name)) continue;
    const subjects = await commitSubjectsSince(gitRunner, cwd, sinceRef, unit.dir);
    commitsByPkg.set(unit.name, subjects);
  }

  // ── Requested bumps: global --bump applied to every changed unit ─────────────
  const requestedBumps = new Map<string, BumpLevel>();
  const globalBump = options.bump;
  if (globalBump) {
    for (const name of filtered) requestedBumps.set(name, globalBump);
  }

  // ── Compute the plan (pure) ─────────────────────────────────────────────────
  const plan = computeReleasePlan(
    units,
    filtered,
    requestedBumps,
    graph,
    commitsByPkg
  );
  warnings.push(...plan.warnings);

  // Apply an optional registry override uniformly.
  const entries = options.registry
    ? plan.entries.map(e => ({ ...e, registry: options.registry! }))
    : plan.entries;

  // ── Apply (only when NOT dry-run) ───────────────────────────────────────────
  const publishedByName = new Map<string, boolean>();
  if (!dryRun) {
    try {
      await applyPlan(
        entries,
        cwd,
        gitRunner,
        publishExecutor,
        Boolean(options.publish),
        publishedByName,
        warnings
      );
    } catch (error) {
      const details =
        error instanceof Error && 'details' in error
          ? (error as Error & { details: Record<string, unknown> }).details
          : undefined;
      if (json) {
        fail('RELEASE_ERROR', messageOf(error), details);
      } else {
        process.stderr.write(`\n✗ ${messageOf(error)}\n`);
        if (details) {
          process.stderr.write(
            `  applied: [${(details['applied'] as string[]).join(', ')}], failed: ${details['failed']}\n`
          );
        }
        process.exitCode = 1;
      }
      return;
    }
  }

  // ── Build + emit the envelope ───────────────────────────────────────────────
  const wireUnits: ReleaseUnitPlan[] = entries.map(e => ({
    name: e.name,
    path: e.path,
    language: e.language,
    manifestType: e.manifestType,
    currentVersion: e.currentVersion,
    nextVersion: e.nextVersion,
    bumpLevel: e.bumpLevel,
    reason: e.reason,
    changelogEntry: e.changelogEntry,
    registry: e.registry,
    published: publishedByName.get(e.name) ?? false,
  }));

  const payload: ReleaseResponse = { dryRun, units: wireUnits, warnings };

  if (json) {
    ok(payload);
  } else {
    renderHuman(payload);
  }
}

/**
 * Apply the plan to disk: write each manifest version, repin internal dependent
 * ranges across the released set, prepend each CHANGELOG fragment, create an
 * annotated tag per unit, and (when `publish`) publish through the adapter.
 *
 * On any throw, a RELEASE_ERROR-shaped error is re-thrown whose `details`
 * contains `{ applied: string[], failed: string }` so callers know exactly
 * which units were fully written before the failure.
 */
async function applyPlan(
  entries: readonly ReleasePlanEntry[],
  cwd: string,
  gitRunner: GitRunner,
  publishExecutor: PublishExecutor,
  publish: boolean,
  publishedByName: Map<string, boolean>,
  warnings: string[]
): Promise<void> {
  const releasedVersions = new Map(entries.map(e => [e.name, e.nextVersion]));
  const applied: string[] = [];

  for (const entry of entries) {
    try {
      const dir = path.resolve(cwd, entry.path);
      writeManifestVersion(dir, entry.manifestType as ManifestType, entry.nextVersion);
      updateDependentRanges(dir, releasedVersions);
      writeChangelog(dir, entry.changelogEntry);
      await createAnnotatedTag(
        gitRunner,
        cwd,
        `${entry.name}@${entry.nextVersion}`,
        `Release ${entry.name}@${entry.nextVersion}`
      );
      // Only push to applied after ALL writes+tag for this unit succeeded.
      applied.push(entry.name);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      const partial = new Error(
        `RELEASE_ERROR: failed applying "${entry.name}": ${message}`
      ) as Error & { details: Record<string, unknown> };
      partial.details = { applied, failed: entry.name };
      throw partial;
    }
  }

  if (!publish) return;

  for (const entry of entries) {
    const outcome = await execPublish(
      { ...entry, path: path.resolve(cwd, entry.path) },
      publishExecutor,
      false
    );
    publishedByName.set(entry.name, outcome.published);
    if (outcome.warning) warnings.push(outcome.warning);
  }
}

/**
 * Map files changed since `ref` to their owning packages (by directory prefix,
 * forward-slash normalised for Windows). Returns the set of directly-changed
 * package names; dependent expansion happens later in the pure engine.
 */
async function resolveChangedPackages(
  run: GitRunner,
  cwd: string,
  ref: string,
  discovery: Awaited<ReturnType<typeof discoverWorkspace>>
): Promise<Set<string>> {
  const root = path.resolve(cwd);
  const files = await changedFilesSince(run, root, ref);
  const dirs = [...discovery.packages.values()].map(p => ({
    name: p.name,
    rel: path.relative(root, path.resolve(p.dir)).split(path.sep).join('/') + '/',
  }));

  const changed = new Set<string>();
  for (const file of files) {
    const rel = file.split('\\').join('/');
    for (const d of dirs) {
      if (rel.startsWith(d.rel)) changed.add(d.name);
    }
  }
  return changed;
}

/**
 * Restrict the changed set to `filter` names plus their transitive dependents.
 * Returns the changed set unchanged when no filter is provided.
 */
function applyFilter(
  changedNames: Set<string>,
  filter: string[] | undefined,
  graph: Map<string, readonly string[]>
): Set<string> {
  if (!filter || filter.length === 0) return changedNames;

  const dependents = new Map<string, string[]>();
  for (const name of graph.keys()) dependents.set(name, []);
  for (const [pkg, deps] of graph) {
    for (const dep of deps) dependents.get(dep)?.push(pkg);
  }

  const allowed = new Set<string>();
  const stack = [...filter];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (allowed.has(cur)) continue;
    allowed.add(cur);
    for (const d of dependents.get(cur) ?? []) {
      if (!allowed.has(d)) stack.push(d);
    }
  }

  return new Set([...changedNames].filter(n => allowed.has(n)));
}

/** Default real publish executor: argv via execFile (no shell interpolation). */
const defaultPublishExecutor: PublishExecutor = async (cmd, args, cwd) => {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const run = promisify(execFile);
  try {
    await run(cmd, args, { cwd, maxBuffer: 1 << 24 });
    return 0;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'number' ? code : 1;
  }
};

/** Emit a RELEASE_ERROR envelope (json) or red message + non-zero exit. */
function emitError(json: boolean, message: string): void {
  if (json) {
    fail('RELEASE_ERROR', message);
  } else {
    process.stderr.write(`\n✗ ${message}\n`);
    process.exitCode = 1;
  }
}

/** Extract a human message from an unknown thrown value. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

/** Human-readable render of the release plan (non-JSON path). */
function renderHuman(payload: ReleaseResponse): void {
  const mode = payload.dryRun ? 'dry-run (no changes written)' : 'applied';
  process.stdout.write(`\n▶ release plan — ${mode}\n\n`);

  if (payload.units.length === 0) {
    process.stdout.write('  No units to release.\n\n');
  }

  for (const unit of payload.units) {
    const pub = unit.published ? ' [published]' : '';
    process.stdout.write(
      `  ${unit.name}  ${unit.currentVersion} → ${unit.nextVersion} ` +
        `(${unit.bumpLevel}, ${unit.reason}, ${unit.registry})${pub}\n`
    );
  }

  for (const warning of payload.warnings) {
    process.stdout.write(`  ! ${warning}\n`);
  }
  process.stdout.write('\n');
}
