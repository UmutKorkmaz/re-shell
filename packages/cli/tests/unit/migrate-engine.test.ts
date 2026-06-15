import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_RECIPES,
  LATEST_TARGET_VERSION,
  getRecipes,
  registerRecipe,
  selectPendingMigrations,
  topoSort,
  planMigrations,
  type MigrationRecipe,
} from '../../src/utils/migrate-engine';
import { migrateResponseSchema } from '@re-shell/contracts';

/**
 * Pure-engine conformance for `re-shell migrate`. Everything here is offline,
 * deterministic, and side-effect free — no git, no filesystem, no network.
 */

describe('workspace-v1-to-v2 recipe (built-in)', () => {
  const recipe = BUILT_IN_RECIPES.find(r => r.id === 'workspace-v1-to-v2')!;

  it('matches a document with no version field', () => {
    expect(recipe.matches({ apps: { web: {} } })).toBe(true);
  });

  it('matches a document whose version starts with 1.', () => {
    expect(recipe.matches({ version: '1.2.0', apps: {} })).toBe(true);
  });

  it('matches an unquoted numeric v1 version (js-yaml parses 1.0 as number 1)', () => {
    expect(recipe.matches({ version: 1, apps: {} })).toBe(true);
    expect(recipe.matches({ version: 1.5, apps: {} })).toBe(true);
  });

  it('does not match an unquoted numeric v2 version', () => {
    expect(recipe.matches({ version: 2, services: {} })).toBe(false);
  });

  it('does not match a v2 document', () => {
    expect(recipe.matches({ version: '2.0.0', services: {} })).toBe(false);
  });

  it('renames apps → services and injects version + dependsOn + tasks', () => {
    const doc = { apps: { web: { path: 'apps/web' } }, name: 'demo' };
    const out = recipe.transform(doc);

    expect(out['version']).toBe('2.0.0');
    expect(out['apps']).toBeUndefined();
    expect(out['services']).toEqual({ web: { path: 'apps/web', dependsOn: [] } });
    // Non-versioned keys are preserved.
    expect(out['name']).toBe('demo');
    // A root tasks map is injected when absent.
    expect(out['tasks']).toEqual({});
  });

  it('preserves an existing services map over apps', () => {
    const doc = {
      apps: { legacy: { path: 'apps/legacy' } },
      services: { api: { path: 'services/api' } },
    };
    const out = recipe.transform(doc);
    expect(out['services']).toEqual({ api: { path: 'services/api', dependsOn: [] } });
    expect(out['apps']).toBeUndefined();
  });

  it('preserves an existing tasks map', () => {
    const doc = { apps: {}, tasks: { build: { dependsOn: [] } } };
    const out = recipe.transform(doc);
    expect(out['tasks']).toEqual({ build: { dependsOn: [] } });
  });

  it('does not overwrite an existing dependsOn on a service', () => {
    const doc = { apps: { api: { path: 'services/api', dependsOn: ['db'] } } };
    const out = recipe.transform(doc);
    expect(out['services']).toEqual({ api: { path: 'services/api', dependsOn: ['db'] } });
  });

  it('never mutates its input document', () => {
    const doc = { apps: { web: {} } };
    const snapshot = JSON.stringify(doc);
    recipe.transform(doc);
    expect(JSON.stringify(doc)).toBe(snapshot);
  });
});

describe('selectPendingMigrations', () => {
  const recipes = getRecipes();

  it('selects the built-in recipe when migrating from v1 to v2', () => {
    const selected = selectPendingMigrations(recipes, '1.0.0', '2.0.0');
    expect(selected.map(r => r.id)).toContain('workspace-v1-to-v2');
  });

  it('selects nothing when the current version already satisfies the target', () => {
    const selected = selectPendingMigrations(recipes, '2.0.0', '2.0.0');
    expect(selected).toHaveLength(0);
  });

  it('selects nothing for an uncoercible current version', () => {
    const selected = selectPendingMigrations(recipes, 'not-a-version', '2.0.0');
    expect(selected).toHaveLength(0);
  });

  it('selects nothing for an uncoercible target version', () => {
    const selected = selectPendingMigrations(recipes, '1.0.0', 'banana');
    expect(selected).toHaveLength(0);
  });

  it('drops a recipe whose own toVersion cannot be coerced', () => {
    const weird: MigrationRecipe = {
      id: 'bad',
      fromVersionRange: '1.x',
      toVersion: 'banana',
      kind: 'yaml',
      title: 'bad',
      description: 'bad',
      targetFile: 'x.yaml',
      matches: () => true,
      transform: d => d,
    };
    const selected = selectPendingMigrations([weird], '1.0.0', '2.0.0');
    expect(selected).toHaveLength(0);
  });

  it('orders selected recipes by toVersion ascending', () => {
    const low: MigrationRecipe = {
      id: 'low',
      fromVersionRange: '1.x',
      toVersion: '1.5.0',
      kind: 'yaml',
      title: 'low',
      description: 'low',
      targetFile: 'a.yaml',
      matches: () => true,
      transform: d => d,
    };
    const high: MigrationRecipe = {
      id: 'high',
      fromVersionRange: '1.x',
      toVersion: '2.0.0',
      kind: 'yaml',
      title: 'high',
      description: 'high',
      targetFile: 'b.yaml',
      matches: () => true,
      transform: d => d,
    };
    const selected = selectPendingMigrations([high, low], '1.0.0', '2.0.0');
    expect(selected.map(r => r.id)).toEqual(['low', 'high']);
  });
});

describe('topoSort', () => {
  it('orders dependencies before dependents in a chain', () => {
    // A → B → C (each depends on the previous).
    const graph = new Map<string, readonly string[]>([
      ['a', []],
      ['b', ['a']],
      ['c', ['b']],
    ]);
    expect(topoSort(graph)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties alphabetically for determinism', () => {
    // Two independent nodes with no deps.
    const graph = new Map<string, readonly string[]>([
      ['zeta', []],
      ['alpha', []],
    ]);
    expect(topoSort(graph)).toEqual(['alpha', 'zeta']);
  });

  it('appends cycle members at the end (tolerates cycles)', () => {
    // A ↔ B cycle.
    const graph = new Map<string, readonly string[]>([
      ['a', ['b']],
      ['b', ['a']],
    ]);
    const ordered = topoSort(graph);
    expect(ordered).toHaveLength(2);
    expect(new Set(ordered)).toEqual(new Set(['a', 'b']));
  });

  it('handles a diamond dependency (A → B, A → C, B → D, C → D)', () => {
    const graph = new Map<string, readonly string[]>([
      ['a', []],
      ['b', ['a']],
      ['c', ['a']],
      ['d', ['b', 'c']],
    ]);
    const ordered = topoSort(graph);
    const idx = (n: string) => ordered.indexOf(n);
    expect(idx('a')).toBeLessThan(idx('b'));
    expect(idx('a')).toBeLessThan(idx('c'));
    expect(idx('b')).toBeLessThan(idx('d'));
    expect(idx('c')).toBeLessThan(idx('d'));
  });

  it('ignores edges to nodes not in the graph', () => {
    const graph = new Map<string, readonly string[]>([
      ['a', ['external']],
    ]);
    expect(topoSort(graph)).toEqual(['a']);
  });
});

describe('planMigrations', () => {
  it('produces a dry-run plan where every migration is pending / not applied', () => {
    const recipe = BUILT_IN_RECIPES[0];
    const plan = planMigrations([recipe], '1.0.0', '2.0.0', [
      { recipeId: recipe.id, targets: ['re-shell.workspaces.yaml'] },
    ]);

    expect(plan.toVersion).toBe('2.0.0');
    expect(plan.dryRun).toBe(true);
    expect(plan.warnings).toEqual([]);
    expect(plan.migrations).toHaveLength(1);
    expect(plan.migrations[0]).toMatchObject({
      id: recipe.id,
      status: 'pending',
      applied: false,
    });
    expect(plan.migrations[0].targets).toEqual(['re-shell.workspaces.yaml']);
  });

  it('defaults to an empty targets list when no candidates were resolved', () => {
    const recipe = BUILT_IN_RECIPES[0];
    const plan = planMigrations([recipe], '1.0.0', '2.0.0', []);
    expect(plan.migrations[0].targets).toEqual([]);
  });

  it('carries the recipe kind and human title/description onto the descriptor', () => {
    const recipe = BUILT_IN_RECIPES[0];
    const plan = planMigrations([recipe], '1.0.0', '2.0.0', []);
    expect(plan.migrations[0].kind).toBe(recipe.kind);
    expect(plan.migrations[0].title).toBe(recipe.title);
    expect(plan.migrations[0].description).toBe(recipe.description);
  });
});

describe('recipe registry', () => {
  it('exposes the built-in recipe via getRecipes', () => {
    const ids = getRecipes().map(r => r.id);
    expect(ids).toContain('workspace-v1-to-v2');
  });

  it('appends registered recipes to the registry', () => {
    const before = getRecipes().length;
    const custom: MigrationRecipe = {
      id: 'custom-test-recipe',
      fromVersionRange: '2.x',
      toVersion: '2.1.0',
      kind: 'yaml',
      title: 'custom',
      description: 'custom',
      targetFile: 'c.yaml',
      matches: () => true,
      transform: d => d,
    };
    registerRecipe(custom);
    expect(getRecipes().map(r => r.id)).toContain('custom-test-recipe');
    expect(getRecipes().length).toBe(before + 1);
  });
});

describe('contracts conformance', () => {
  it('the default target version is a valid semver 2.x', () => {
    expect(LATEST_TARGET_VERSION).toBe('2.0.0');
  });

  it('a constructed plan validates against migrateResponseSchema', () => {
    const recipe = BUILT_IN_RECIPES[0];
    const plan = planMigrations([recipe], '1.0.0', '2.0.0', [
      { recipeId: recipe.id, targets: ['re-shell.workspaces.yaml'] },
    ]);

    const payload = {
      toVersion: plan.toVersion,
      dryRun: plan.dryRun,
      migrations: plan.migrations.map(m => ({
        id: m.id,
        fromVersion: m.fromVersion,
        toVersion: m.toVersion,
        kind: m.kind,
        title: m.title,
        description: m.description,
        targets: m.targets,
        status: m.status,
        applied: m.applied,
      })),
      warnings: plan.warnings,
    };

    expect(migrateResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('rejects an unknown migration kind against the schema', () => {
    const payload = {
      toVersion: '2.0.0',
      dryRun: true,
      migrations: [
        {
          id: 'x',
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          kind: 'nonsense',
          title: 'x',
          description: 'x',
          targets: [],
          status: 'pending',
          applied: false,
        },
      ],
      warnings: [],
    };
    expect(migrateResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects an unknown migration status against the schema', () => {
    const payload = {
      toVersion: '2.0.0',
      dryRun: true,
      migrations: [
        {
          id: 'x',
          fromVersion: '1.0.0',
          toVersion: '2.0.0',
          kind: 'yaml',
          title: 'x',
          description: 'x',
          targets: [],
          status: 'in-progress',
          applied: false,
        },
      ],
      warnings: [],
    };
    expect(migrateResponseSchema.safeParse(payload).success).toBe(false);
  });
});
