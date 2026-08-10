import { describe, it, expect } from 'vitest';
import {
  topologyValidator,
  type TopologyConflict,
} from '../../src/validators/topology-validator';

// topology-validator.ts is pure logic — no fs/exec/prompts — so these tests
// exercise the public `validate` / `getTopologyStats` surface against in-memory
// config shapes and, through them, the internal helpers (normalizeDependencies,
// findCycles, getLayerCount, getServices).

describe('topologyValidator.validate — valid configurations', () => {
  it('reports valid with no conflicts for a self-contained topology', () => {
    const result = topologyValidator.validate({
      services: {
        api: { dependencies: [] },
        web: { dependencies: ['api'] },
      },
    });
    expect(result).toEqual({ valid: true, conflicts: [] });
  });

  it('reports valid when no dependencies are declared at all', () => {
    expect(topologyValidator.validate({ services: { a: {}, b: {} } })).toEqual({
      valid: true,
      conflicts: [],
    });
  });

  it('treats a config without a services object as valid and empty', () => {
    expect(topologyValidator.validate({})).toEqual({ valid: true, conflicts: [] });
    expect(topologyValidator.validate({ services: null })).toEqual({
      valid: true,
      conflicts: [],
    });
  });

  it('treats null/undefined config defensively', () => {
    expect(topologyValidator.validate(null)).toEqual({ valid: true, conflicts: [] });
    expect(topologyValidator.validate(undefined)).toEqual({ valid: true, conflicts: [] });
  });
});

describe('topologyValidator.validate — missing dependencies', () => {
  it('flags a single missing dependency', () => {
    const result = topologyValidator.validate({
      services: { api: { dependencies: ['db'] } },
    });
    expect(result.valid).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    const conflict = result.conflicts[0] as TopologyConflict;
    expect(conflict.type).toBe('missing-dependency');
    expect(conflict.message).toBe('api depends on missing service(s): db');
    expect(conflict.affectedServices).toEqual(['api', 'db']);
  });

  it('joins multiple missing dependencies in one conflict', () => {
    const result = topologyValidator.validate({
      services: { api: { dependencies: ['db', 'cache', 'queue'] } },
    });
    const conflict = result.conflicts[0] as TopologyConflict;
    expect(conflict.message).toBe('api depends on missing service(s): db, cache, queue');
    expect(conflict.affectedServices).toEqual(['api', 'db', 'cache', 'queue']);
  });

  it('does not flag dependencies that resolve to defined services', () => {
    const result = topologyValidator.validate({
      services: {
        api: { dependencies: ['db'] },
        db: {},
      },
    });
    expect(result.valid).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('reads dependencies from the top-level dependencies object', () => {
    const result = topologyValidator.validate({
      services: { api: {}, db: {} },
      dependencies: { api: ['db', 'cache'] },
    });
    expect(result.valid).toBe(false);
    const conflict = result.conflicts[0] as TopologyConflict;
    expect(conflict.type).toBe('missing-dependency');
    expect(conflict.message).toBe('api depends on missing service(s): cache');
  });

  it('produces one missing-dependency conflict per offending service', () => {
    const result = topologyValidator.validate({
      services: {
        api: { dependencies: ['ghost'] },
        web: { dependencies: ['phantom'] },
      },
    });
    expect(result.valid).toBe(false);
    expect(result.conflicts).toHaveLength(2);
    expect(result.conflicts.map(c => c.message).sort()).toEqual([
      'api depends on missing service(s): ghost',
      'web depends on missing service(s): phantom',
    ]);
  });
});

describe('topologyValidator.validate — circular dependencies', () => {
  it('detects a simple two-node cycle', () => {
    const result = topologyValidator.validate({
      services: {
        a: { dependencies: ['b'] },
        b: { dependencies: ['a'] },
      },
    });
    expect(result.valid).toBe(false);
    const cycle = result.conflicts.find(c => c.type === 'circular-dependency');
    expect(cycle).toBeDefined();
    expect(cycle!.message).toBe('Circular dependency detected: a -> b -> a');
    // affectedServices are deduped via Set.
    expect(cycle!.affectedServices.sort()).toEqual(['a', 'b']);
  });

  it('detects a self-loop as a cycle', () => {
    const result = topologyValidator.validate({
      services: { a: { dependencies: ['a'] } },
    });
    expect(result.valid).toBe(false);
    const cycle = result.conflicts.find(c => c.type === 'circular-dependency');
    expect(cycle).toBeDefined();
    expect(cycle!.message).toBe('Circular dependency detected: a -> a');
    expect(cycle!.affectedServices).toEqual(['a']);
  });

  it('detects a longer cycle through several nodes', () => {
    const result = topologyValidator.validate({
      services: {
        a: { dependencies: ['b'] },
        b: { dependencies: ['c'] },
        c: { dependencies: ['a'] },
      },
    });
    const cycle = result.conflicts.find(c => c.type === 'circular-dependency');
    expect(cycle).toBeDefined();
    expect(cycle!.message).toBe('Circular dependency detected: a -> b -> c -> a');
  });

  it('reports both missing and circular conflicts together', () => {
    const result = topologyValidator.validate({
      services: {
        a: { dependencies: ['b', 'ghost'] },
        b: { dependencies: ['a'] },
      },
    });
    expect(result.valid).toBe(false);
    const types = result.conflicts.map(c => c.type).sort();
    expect(types).toEqual(['circular-dependency', 'missing-dependency']);
  });

  it('does not report a cycle for an acyclic chain', () => {
    const result = topologyValidator.validate({
      services: {
        a: { dependencies: ['b'] },
        b: { dependencies: ['c'] },
        c: { dependencies: [] },
      },
    });
    expect(result.conflicts.some(c => c.type === 'circular-dependency')).toBe(false);
  });
});

describe('topologyValidator.getTopologyStats — counts', () => {
  it('counts services and dependencies', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        api: { dependencies: ['db', 'cache'] },
        web: { dependencies: ['api'] },
        db: {},
        cache: {},
      },
    });
    expect(stats.totalServices).toBe(4);
    expect(stats.totalDependencies).toBe(3);
  });

  it('reports zero counts for an empty config', () => {
    const stats = topologyValidator.getTopologyStats({});
    expect(stats.totalServices).toBe(0);
    expect(stats.totalDependencies).toBe(0);
    expect(stats.totalLayers).toBe(0);
    expect(stats.hasCircularDependencies).toBe(false);
    expect(stats.circularDependencies).toEqual([]);
    expect(stats.isolatedServices).toEqual([]);
  });
});

describe('topologyValidator.getTopologyStats — layers', () => {
  it('counts distinct values under the `layer` key', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { layer: 'frontend' },
        b: { layer: 'frontend' },
        c: { layer: 'backend' },
        d: { layer: 'data' },
      },
    });
    expect(stats.totalLayers).toBe(3);
  });

  it('falls back to the `type` key when `layer` is absent', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { type: 'app' },
        b: { type: 'package' },
        c: { type: 'app' },
      },
    });
    expect(stats.totalLayers).toBe(2);
  });

  it('prefers `layer` over `type` when both are present', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { layer: 'frontend', type: 'app' },
        b: { layer: 'backend', type: 'package' },
      },
    });
    expect(stats.totalLayers).toBe(2);
  });

  it('ignores empty and non-string layer/type values', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { layer: '' },
        b: { type: 42 },
        c: { layer: 'frontend' },
        d: {},
      },
    });
    expect(stats.totalLayers).toBe(1);
  });
});

describe('topologyValidator.getTopologyStats — cycles', () => {
  it('reports hasCircularDependencies=true and the cycle paths', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { dependencies: ['b'] },
        b: { dependencies: ['a'] },
      },
    });
    expect(stats.hasCircularDependencies).toBe(true);
    expect(stats.circularDependencies).toHaveLength(1);
    expect(stats.circularDependencies[0]).toEqual(['a', 'b', 'a']);
  });

  it('reports hasCircularDependencies=false when acyclic', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { dependencies: ['b'] },
        b: {},
      },
    });
    expect(stats.hasCircularDependencies).toBe(false);
    expect(stats.circularDependencies).toEqual([]);
  });
});

describe('topologyValidator.getTopologyStats — isolated services', () => {
  it('lists services with no inbound or outbound dependencies', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        api: { dependencies: ['db'] },
        web: { dependencies: ['api'] },
        standalone: {},
      },
    });
    // `db` is depended upon by api (inbound), `api` and `web` have outbound
    // deps; only `standalone` is fully disconnected.
    expect(stats.isolatedServices).toEqual(['standalone']);
  });

  it('considers a depended-upon service non-isolated even with no outbound deps', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        api: { dependencies: ['db'] },
        db: {},
      },
    });
    expect(stats.isolatedServices).toEqual([]);
  });

  it('marks every service isolated when none declare dependencies', () => {
    const stats = topologyValidator.getTopologyStats({
      services: { a: {}, b: {}, c: {} },
    });
    expect(stats.isolatedServices.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('dependency normalization edge cases', () => {
  it('filters non-string entries out of per-service dependency arrays', () => {
    const result = topologyValidator.validate({
      services: {
        api: { dependencies: ['db', 123, null, { x: 1 }, 'cache'] as unknown[] },
        db: {},
        cache: {},
      },
    });
    // Only the string entries are real deps; both resolve, so it's valid.
    expect(result.valid).toBe(true);
    const stats = topologyValidator.getTopologyStats({
      services: {
        api: { dependencies: ['db', 123, null, 'cache'] as unknown[] },
        db: {},
        cache: {},
      },
    });
    expect(stats.totalDependencies).toBe(2);
  });

  it('coerces a non-array per-service dependencies value to an empty list', () => {
    const stats = topologyValidator.getTopologyStats({
      services: { api: { dependencies: 'db' } },
    });
    expect(stats.totalDependencies).toBe(0);
  });

  it('lets the top-level dependencies object override per-service arrays', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        api: { dependencies: ['db'] },
        db: {},
        cache: {},
      },
      dependencies: { api: ['cache'] },
    });
    // Top-level dependencies for `api` replaces the per-service [db] → [cache].
    expect(stats.totalDependencies).toBe(1);
  });

  it('coerces non-array values in the top-level dependencies object to []', () => {
    const result = topologyValidator.validate({
      services: { api: {}, db: {} },
      dependencies: { api: 'db' },
    });
    expect(result.valid).toBe(true);
  });
});

describe('findCycles algorithm behavior', () => {
  it('does not duplicate cycles when nodes are visited via multiple paths', () => {
    // Diamond into a cycle: d -> a, d -> b, a -> c, b -> c, c -> a.
    // The cycle a -> c -> a is reachable from both a and b but must be reported once.
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { dependencies: ['c'] },
        b: { dependencies: ['c'] },
        c: { dependencies: ['a'] },
        d: { dependencies: ['a', 'b'] },
      },
    });
    expect(stats.hasCircularDependencies).toBe(true);
    // Only one distinct cycle exists (a <-> c).
    expect(stats.circularDependencies).toHaveLength(1);
  });

  it('can surface two independent cycles', () => {
    const stats = topologyValidator.getTopologyStats({
      services: {
        a: { dependencies: ['b'] },
        b: { dependencies: ['a'] },
        x: { dependencies: ['y'] },
        y: { dependencies: ['x'] },
      },
    });
    expect(stats.hasCircularDependencies).toBe(true);
    expect(stats.circularDependencies).toHaveLength(2);
  });
});
