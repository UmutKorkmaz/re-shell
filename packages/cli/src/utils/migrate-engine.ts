// `re-shell migrate` — PURE migration/codemod engine.
//
// This module is intentionally I/O-free and contracts-free: it holds the recipe
// registry, the version-window selection logic, the topological sort that orders
// targets deps-before-dependents, and the pure plan assembly. The command layer
// (commands/migrate.ts) and the IO layer (utils/migrate-runner.ts) handle disk
// access; this file only transforms in-memory data.
//
// `semver` is a normal value import (already a dependency). No mutation of any
// input is ever performed — every transform returns a fresh object.

import semver from 'semver';

/**
 * The transform mechanism a recipe uses. Mirrors the contracts
 * `migrationKindSchema` enum values exactly (kept local so this file stays
 * contracts-free).
 */
export type MigrationKind = 'config' | 'yaml' | 'json' | 'ast-grep';

/**
 * A declarative migration recipe. `matches` decides whether a parsed document is
 * a candidate for this recipe; `transform` returns the rewritten document
 * (never mutating its input). `astGrep` carries the source-codemod pattern when
 * `kind === 'ast-grep'`.
 */
export interface MigrationRecipe {
  /** Stable recipe id (e.g. "workspace-v1-to-v2"). */
  readonly id: string;
  /** semver range the workspace's current version must satisfy. */
  readonly fromVersionRange: string;
  /** The version this recipe migrates the workspace to. */
  readonly toVersion: string;
  /** Transform mechanism. */
  readonly kind: MigrationKind;
  /** Short human title. */
  readonly title: string;
  /** Human description of what the recipe does. */
  readonly description: string;
  /** Target file path relative to the repo root and to each package dir. */
  readonly targetFile: string;
  /** Whether a parsed document is a candidate for this recipe. */
  matches(doc: Record<string, unknown>): boolean;
  /** Return the rewritten document. MUST NOT mutate `doc`. */
  transform(doc: Record<string, unknown>): Record<string, unknown>;
  /** Source-codemod spec, present only when `kind === 'ast-grep'`. */
  readonly astGrep?: { readonly pattern: string; readonly rewrite: string };
}

/** Default target version when none is requested on the command line. */
export const LATEST_TARGET_VERSION = '2.0.0';

/**
 * The built-in `workspace-v1-to-v2` recipe.
 *
 * Matches a workspace YAML whose `version` is absent or starts with `1.`. The
 * transform renames `apps` → `services`, sets `version: "2.0.0"`, injects an
 * empty `dependsOn: []` on each service that lacks one, and injects a root
 * `tasks: {}` when absent. Pure: the input document is never mutated.
 */
function workspaceMatches(doc: Record<string, unknown>): boolean {
  const raw = doc['version'];
  if (raw === undefined || raw === null) return true;
  // js-yaml parses an unquoted `version: 1.0` as the NUMBER 1, so coerce before
  // checking. semver.coerce normalises both "1"/1 and "1.2.3"/"1.x" shapes; an
  // uncoercible version is treated as v1 (conservative — prefer to migrate).
  const coerced = semver.coerce(String(raw));
  if (coerced === null) return true;
  return coerced.major === 1;
}

/** Is the value a plain object (record) and not an array/null? */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Inject `dependsOn: []` into each service that lacks it (immutably). */
function withDependsOn(
  services: Record<string, unknown>
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [name, service] of Object.entries(services)) {
    if (isRecord(service) && service['dependsOn'] === undefined) {
      next[name] = { ...service, dependsOn: [] };
    } else {
      next[name] = service;
    }
  }
  return next;
}

function workspaceTransform(
  doc: Record<string, unknown>
): Record<string, unknown> {
  // Rename apps → services (prefer an existing services map if both are present).
  const rawServices = isRecord(doc['services'])
    ? (doc['services'] as Record<string, unknown>)
    : isRecord(doc['apps'])
      ? (doc['apps'] as Record<string, unknown>)
      : {};
  const services = withDependsOn(rawServices);

  // Build the next document from the input minus `apps`, with the new fields.
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(doc)) {
    if (key === 'apps' || key === 'services' || key === 'version') continue;
    next[key] = value;
  }
  next['version'] = '2.0.0';
  next['services'] = services;
  if (doc['tasks'] === undefined) {
    next['tasks'] = {};
  } else {
    next['tasks'] = doc['tasks'];
  }
  return next;
}

const WORKSPACE_V1_TO_V2: MigrationRecipe = {
  id: 'workspace-v1-to-v2',
  fromVersionRange: '1.x',
  toVersion: '2.0.0',
  kind: 'yaml',
  title: 'Workspace config v1 → v2',
  description:
    'Rewrite the v1 workspace scaffold to v2: rename `apps` → `services`, set ' +
    'version to 2.0.0, inject `dependsOn: []` per service and a root `tasks: {}`.',
  targetFile: 're-shell.workspaces.yaml',
  matches: workspaceMatches,
  transform: workspaceTransform,
};

/**
 * The recipe registry. Seeded with the built-in recipes; extendable via
 * {@link registerRecipe}. Kept as a module-level mutable array so registration
 * is a documented extension point.
 */
const RECIPE_REGISTRY: MigrationRecipe[] = [WORKSPACE_V1_TO_V2];

/** The built-in recipes shipped with the CLI (a stable snapshot). */
export const BUILT_IN_RECIPES: readonly MigrationRecipe[] = [WORKSPACE_V1_TO_V2];

/**
 * Register an additional recipe (documented extension point). Appends to the
 * registry; later calls to {@link getRecipes} reflect the addition.
 */
export function registerRecipe(recipe: MigrationRecipe): void {
  RECIPE_REGISTRY.push(recipe);
}

/** The current recipe registry (built-ins plus any registered recipes). */
export function getRecipes(): readonly MigrationRecipe[] {
  return RECIPE_REGISTRY;
}

/** Coerce a loose version string to a strict semver, or null when impossible. */
function coerceVersion(version: string): string | null {
  const coerced = semver.coerce(version);
  return coerced ? coerced.version : null;
}

/**
 * Select the recipes that apply when migrating from `fromVersion` up to
 * `toVersion`: a recipe is pending when the (coerced) current version satisfies
 * its `fromVersionRange` AND its `toVersion` is `<=` the (coerced) requested
 * target. Results are sorted by `toVersion` ascending so earlier upgrades run
 * first. Loose versions are coerced; recipes whose own `toVersion` cannot be
 * coerced are dropped defensively.
 */
export function selectPendingMigrations(
  recipes: readonly MigrationRecipe[],
  fromVersion: string,
  toVersion: string
): MigrationRecipe[] {
  const from = coerceVersion(fromVersion);
  const to = coerceVersion(toVersion);
  if (from === null || to === null) return [];

  const selected = recipes.filter(recipe => {
    const recipeTo = coerceVersion(recipe.toVersion);
    if (recipeTo === null) return false;
    return (
      semver.satisfies(from, recipe.fromVersionRange) &&
      semver.lte(recipeTo, to)
    );
  });

  return [...selected].sort((a, b) => {
    const av = coerceVersion(a.toVersion) ?? a.toVersion;
    const bv = coerceVersion(b.toVersion) ?? b.toVersion;
    return semver.compare(av, bv);
  });
}

/**
 * Kahn's topological sort over a workspace dependency graph (each key maps to
 * its UPSTREAM dependencies). Returns node names ordered deps-before-dependents.
 * Ties are broken alphabetically for determinism. Cycles are tolerated: unknown
 * nodes that cannot be ordered are appended at the end (the caller can warn).
 */
export function topoSort(
  graph: ReadonlyMap<string, readonly string[]>
): string[] {
  // indegree[n] = number of unresolved upstream deps that are IN the graph.
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const name of graph.keys()) {
    indegree.set(name, 0);
    dependents.set(name, []);
  }
  for (const [name, deps] of graph) {
    let count = 0;
    for (const dep of deps) {
      if (graph.has(dep) && dep !== name) {
        count += 1;
        dependents.get(dep)?.push(name);
      }
    }
    indegree.set(name, count);
  }

  const ready = [...indegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([name]) => name)
    .sort();

  const ordered: string[] = [];
  const visited = new Set<string>();
  while (ready.length > 0) {
    const current = ready.shift() as string;
    if (visited.has(current)) continue;
    visited.add(current);
    ordered.push(current);
    const next: string[] = [];
    for (const dependent of dependents.get(current) ?? []) {
      const deg = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, deg);
      if (deg <= 0 && !visited.has(dependent)) next.push(dependent);
    }
    // Keep the ready queue alphabetically ordered for deterministic output.
    ready.push(...next);
    ready.sort();
  }

  // Append any leftover nodes (cycle members) alphabetically. The caller warns.
  const leftover = [...graph.keys()].filter(n => !visited.has(n)).sort();
  return [...ordered, ...leftover];
}

/**
 * A single descriptor in a migration plan: the pure assembly output, mirroring
 * the contracts `migrationDescriptorSchema` shape (kept local/contracts-free).
 */
export interface MigrationDescriptorLite {
  readonly id: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly kind: MigrationKind;
  readonly title: string;
  readonly description: string;
  readonly targets: string[];
  readonly status: 'pending' | 'applied' | 'skipped' | 'failed';
  readonly applied: boolean;
}

/** Candidate targets for one recipe, already resolved + topo-ordered. */
export interface RecipeCandidateTargets {
  readonly recipeId: string;
  readonly targets: string[];
}

/** The output of {@link planMigrations}: the full reviewable plan. */
export interface MigrationPlan {
  readonly toVersion: string;
  readonly dryRun: boolean;
  readonly migrations: MigrationDescriptorLite[];
  readonly warnings: string[];
}

/**
 * Pure plan assembly: pair every selected recipe with its (pre-resolved,
 * topo-ordered) candidate targets and produce a dry-run plan where every
 * descriptor is `pending`/`applied: false`. No I/O, no mutation.
 */
export function planMigrations(
  recipes: readonly MigrationRecipe[],
  fromVersion: string,
  toVersion: string,
  candidateTargetsInOrder: readonly RecipeCandidateTargets[]
): MigrationPlan {
  const targetsByRecipe = new Map<string, string[]>();
  for (const entry of candidateTargetsInOrder) {
    targetsByRecipe.set(entry.recipeId, entry.targets);
  }

  const migrations: MigrationDescriptorLite[] = recipes.map(recipe => ({
    id: recipe.id,
    fromVersion,
    toVersion: recipe.toVersion,
    kind: recipe.kind,
    title: recipe.title,
    description: recipe.description,
    targets: targetsByRecipe.get(recipe.id) ?? [],
    status: 'pending',
    applied: false,
  }));

  return { toVersion, dryRun: true, migrations, warnings: [] };
}

/**
 * Optional AI advisor seam. A provider may PROPOSE additional recipes for a
 * given workspace state; the command layer MUST filter any proposal against the
 * built-in registry so a misbehaving provider can never inject an unknown
 * transform. The DEFAULT path never constructs or calls an advisor.
 */
export interface MigrationAdvisor {
  readonly name: string;
  /** Propose recipes for a workspace state. May be async (network). */
  propose(state: Record<string, unknown>): Promise<MigrationRecipe[]>;
}

/**
 * Resolve a migration advisor from the environment, if any. Returns undefined on
 * the default path so callers stay offline unless a provider is explicitly
 * wired. This is a documented seam only — it reads nothing and never performs a
 * network call.
 */
export function advisorFromEnv(): MigrationAdvisor | undefined {
  return undefined;
}
