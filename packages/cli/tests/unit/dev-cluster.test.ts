import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  generateDevClusterConfig,
  resolveAffectedServices,
  buildServiceGraph,
  buildSkaffoldArgv,
  multiplexLogs,
  SkaffoldDevBackend,
  MissingToolError,
  DEFAULT_DEV_NAMESPACE,
  type NamedService,
  type ProbeRunner,
  type SpawnRunner,
} from '../../src/utils/dev-cluster';
import { runDevCluster } from '../../src/commands/dev-cluster';
import {
  devClusterConfigSchema,
  type DevClusterConfig,
} from '@re-shell/contracts';
import type { ServiceConfig } from '../../src/parsers/workspace-parser';

/**
 * Unit coverage for the pure, OFFLINE core of `re-shell dev --cluster`:
 *
 *   - the Skaffold config generator (deterministic artifacts / sync-rules /
 *     port-forwards from a fixture service set),
 *   - affected-scoping (a changed service file maps to that service + its
 *     dependents, never unrelated services), and
 *   - log multiplexing (per-service line prefixing).
 *
 * Plus the injectable backend's probe/error contract, exercised with a FAKE
 * probe runner — no cluster, no skaffold, no child processes are touched.
 */

/** Build a NamedService fixture with sensible defaults. */
function svc(
  name: string,
  config: Partial<ServiceConfig> = {}
): NamedService {
  return {
    name,
    config: {
      name,
      language: 'typescript',
      framework: 'express',
      path: `services/${name}`,
      port: 3000,
      ...config,
    },
  };
}

describe('generateDevClusterConfig (deterministic, offline)', () => {
  it('produces one artifact per service with stable image, context, and sync rules', () => {
    const services = [
      svc('api', { path: 'services/api', port: 3000 }),
      svc('web', { path: 'services/web', port: 5173 }),
    ];

    const config = generateDevClusterConfig({ services });

    expect(config.apiVersion).toMatch(/^skaffold\//);
    expect(config.kind).toBe('Config');
    expect(config.namespace).toBe(DEFAULT_DEV_NAMESPACE);
    expect(config.artifacts.map(a => a.service)).toEqual(['api', 'web']);

    const api = config.artifacts[0];
    expect(api.image).toBe('re-shell-dev/api');
    expect(api.context).toBe('services/api');
    expect(api.dockerfile).toBe('Dockerfile');
    // Inner-loop sync rules: source globs copy into the container, no rebuild.
    expect(api.sync).toContainEqual({
      src: 'src/**/*.{js,jsx,ts,tsx}',
      dest: '/app/src',
    });
  });

  it('generates one port-forward per service with no localPort collision against declared ports', () => {
    const services = [
      svc('api', { port: 3000 }),
      svc('web', { port: 5173 }),
    ];

    const config = generateDevClusterConfig({ services });
    const declaredPorts = new Set([3000, 5173]);

    expect(config.portForwards).toHaveLength(2);
    expect(config.portForwards[0]!.service).toBe('api');
    expect(config.portForwards[0]!.port).toBe(3000);
    expect(config.portForwards[1]!.service).toBe('web');
    expect(config.portForwards[1]!.port).toBe(5173);

    // No local port may collide with any declared service port.
    for (const pf of config.portForwards) {
      expect(
        declaredPorts.has(pf.localPort),
        `localPort ${pf.localPort} collides with a declared service port`
      ).toBe(false);
    }
    // Local ports must be unique.
    const localPorts = config.portForwards.map(pf => pf.localPort);
    expect(new Set(localPorts).size).toBe(2);
    // Generation is deterministic (same inputs -> same output).
    expect(generateDevClusterConfig({ services })).toEqual(config);
  });

  it('falls back to the service name as context and 8080 as the port when unset', () => {
    const services: NamedService[] = [
      { name: 'worker', config: { name: 'worker', language: 'go', framework: 'none' } },
    ];

    const config = generateDevClusterConfig({ services });

    expect(config.artifacts[0].context).toBe('worker');
    expect(config.portForwards[0].port).toBe(8080);
  });

  it('honours an explicit namespace and manifest globs', () => {
    const config = generateDevClusterConfig({
      services: [svc('api')],
      namespace: 'dev-team',
      manifests: ['deploy/*.yaml'],
    });

    expect(config.namespace).toBe('dev-team');
    expect(config.manifests).toEqual(['deploy/*.yaml']);
  });

  it('is deterministic: identical inputs produce identical config', () => {
    const make = (): DevClusterConfig =>
      generateDevClusterConfig({
        services: [svc('api'), svc('web', { port: 5173 })],
      });

    expect(make()).toEqual(make());
  });

  it('emits a config that validates against the @re-shell/contracts schema', () => {
    const config = generateDevClusterConfig({
      services: [svc('api'), svc('web', { port: 5173 })],
    });

    const parsed = devClusterConfigSchema.safeParse(config);
    expect(
      parsed.success,
      JSON.stringify((parsed as { error?: { issues?: unknown[] } }).error?.issues?.[0])
    ).toBe(true);
  });
});

describe('resolveAffectedServices (changed file -> service + dependents)', () => {
  // Graph: web depends on api; worker depends on api; orders is unrelated.
  const services = [
    svc('api', { path: 'services/api' }),
    svc('web', { path: 'services/web', dependsOn: ['api'] }),
    svc('worker', { path: 'services/worker', dependsOn: ['api'] }),
    svc('orders', { path: 'services/orders' }),
  ];

  it('maps a changed leaf-service file to only that service', () => {
    const affected = resolveAffectedServices(services, [
      'services/web/src/app.ts',
    ]);
    expect(affected).toEqual(['web']);
  });

  it('expands a changed upstream service to itself and ALL its dependents', () => {
    const affected = resolveAffectedServices(services, [
      'services/api/src/index.ts',
    ]);
    // api changed -> api + everything that depends on api (web, worker).
    expect(new Set(affected)).toEqual(new Set(['api', 'web', 'worker']));
    // ...and NOT the unrelated service.
    expect(affected).not.toContain('orders');
  });

  it('does not include unrelated services for an unrelated change', () => {
    const affected = resolveAffectedServices(services, [
      'services/orders/src/handler.ts',
    ]);
    expect(affected).toEqual(['orders']);
    expect(affected).not.toContain('api');
    expect(affected).not.toContain('web');
  });

  it('returns the empty set when no changed file maps to a service', () => {
    expect(resolveAffectedServices(services, ['README.md'])).toEqual([]);
  });

  it('returns results in input service order (deterministic)', () => {
    const affected = resolveAffectedServices(services, [
      'services/api/src/index.ts',
    ]);
    expect(affected).toEqual(['api', 'web', 'worker']);
  });
});

describe('buildServiceGraph', () => {
  it('keeps only edges to other known services', () => {
    const graph = buildServiceGraph([
      svc('web', { dependsOn: ['api', 'external-thing'] }),
      svc('api'),
    ]);
    expect(graph.get('web')).toEqual(['api']);
    expect(graph.get('api')).toEqual([]);
  });
});

describe('multiplexLogs (per-service line prefixing)', () => {
  it('prefixes every line with its [service] tag, preserving source order', () => {
    const lines = multiplexLogs([
      { service: 'api', chunks: ['listening on :3000\n', 'GET /health 200\n'] },
      { service: 'web', chunks: ['vite ready\n'] },
    ]);
    expect(lines).toEqual([
      '[api] listening on :3000',
      '[api] GET /health 200',
      '[web] vite ready',
    ]);
  });

  it('splits multi-line chunks and drops empty trailing lines', () => {
    const lines = multiplexLogs([
      { service: 'api', chunks: ['line1\nline2\n'] },
    ]);
    expect(lines).toEqual(['[api] line1', '[api] line2']);
  });

  it('returns no lines for empty sources', () => {
    expect(multiplexLogs([])).toEqual([]);
    expect(multiplexLogs([{ service: 'api', chunks: [''] }])).toEqual([]);
  });
});

describe('SkaffoldDevBackend (injected probe runner — no real processes)', () => {
  /** A fake probe runner that reports a fixed availability per tool. */
  const fakeRunner =
    (available: Record<string, boolean>): ProbeRunner =>
    (cmd) =>
      available[cmd]
        ? { ok: true, detail: `${cmd} v1.2.3` }
        : { ok: false, detail: `${cmd} not found on PATH` };

  it('probe() reports availability for skaffold and kubectl', async () => {
    const backend = new SkaffoldDevBackend(
      fakeRunner({ skaffold: true, kubectl: true })
    );
    const probes = await backend.probe();
    expect(probes.map(p => p.tool).sort()).toEqual(['kubectl', 'skaffold']);
    expect(probes.every(p => p.available)).toBe(true);
  });

  it('dev() throws an actionable MissingToolError naming the missing tool', async () => {
    const backend = new SkaffoldDevBackend(
      fakeRunner({ skaffold: false, kubectl: true })
    );
    await expect(
      backend.dev({
        config: generateDevClusterConfig({ services: [svc('api')] }),
        namespace: 'default',
        services: ['api'],
      })
    ).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(MissingToolError);
      expect((err as MissingToolError).tool).toBe('skaffold');
      expect((err as Error).message).toMatch(/skaffold/);
      expect((err as Error).message).toMatch(/--dry-run/);
      return true;
    });
  });

  it('dev() invokes the injected spawn with the correct skaffold dev argv when tools are present', async () => {
    const capturedArgvs: string[][] = [];

    const fakeSpawn: SpawnRunner = (argv) => {
      capturedArgvs.push([...argv]);
      return {
        process: null,
        done: Promise.resolve(),
      };
    };

    const backend = new SkaffoldDevBackend(
      fakeRunner({ skaffold: true, kubectl: true }),
      fakeSpawn
    );

    await backend.dev({
      config: generateDevClusterConfig({ services: [svc('api')] }),
      namespace: 'staging',
      services: ['api'],
    });

    expect(capturedArgvs).toHaveLength(1);
    const argv = capturedArgvs[0]!;
    // Binary must be skaffold (no shell: true).
    expect(argv[0]).toBe('skaffold');
    // Must include the 'dev' subcommand.
    expect(argv[1]).toBe('dev');
    // Must pass the namespace.
    expect(argv).toContain('--namespace');
    expect(argv[argv.indexOf('--namespace') + 1]).toBe('staging');
  });
});

describe('generateDevClusterConfig — port collision avoidance', () => {
  it('does not assign a local port that collides with any declared service port', () => {
    // Services declare ports 4000 and 4001 — these are the typical PORT_FORWARD_BASE
    // values, so the allocator must step above them.
    const services = [
      svc('api', { port: 4000 }),
      svc('web', { port: 4001 }),
      svc('worker', { port: 8080 }),
    ];

    const config = generateDevClusterConfig({ services });
    const declaredPorts = new Set(services.map(s => s.config.port!));
    const localPorts = config.portForwards.map(pf => pf.localPort);

    // No local port may collide with a declared service port.
    for (const lp of localPorts) {
      expect(
        declaredPorts.has(lp),
        `localPort ${lp} collides with a declared service port`
      ).toBe(false);
    }

    // All local ports must be unique.
    expect(new Set(localPorts).size).toBe(localPorts.length);
  });

  it('keeps generating stable (no-collision) ports for services with no declared port', () => {
    const services = [
      svc('alpha', { port: undefined }),
      svc('beta', { port: undefined }),
    ];

    const config = generateDevClusterConfig({ services });
    const localPorts = config.portForwards.map(pf => pf.localPort);

    expect(new Set(localPorts).size).toBe(localPorts.length);
  });
});

describe('buildSkaffoldArgv (pure — no spawn)', () => {
  it('produces a skaffold dev argv with the correct binary, subcommand, and namespace', () => {
    const argv = buildSkaffoldArgv({
      config: generateDevClusterConfig({ services: [svc('api')] }),
      namespace: 'production',
      services: ['api'],
    });

    expect(argv[0]).toBe('skaffold');
    expect(argv[1]).toBe('dev');
    expect(argv).toContain('--namespace');
    expect(argv[argv.indexOf('--namespace') + 1]).toBe('production');
  });
});

describe('runDevCluster --filter expansion (web->api includes api)', () => {
  /**
   * Write a minimal workspace v2 fixture with two services, web dependsOn api,
   * and return the file path.
   */
  function makeFilterFixture(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-dc-filter-'));
    fs.writeFileSync(
      path.join(dir, 're-shell.workspaces.yaml'),
      [
        'name: filter-fixture',
        'version: 2.0.0',
        'services:',
        '  api:',
        '    name: api',
        '    language: typescript',
        '    framework: express',
        '    path: services/api',
        '    port: 3000',
        '  web:',
        '    name: web',
        '    language: typescript',
        '    framework: react',
        '    path: services/web',
        '    port: 5173',
        '    dependsOn: [api]',
        '',
      ].join('\n')
    );
    return dir;
  }

  it('--filter web expands to include api (its transitive dependency)', async () => {
    const fixtureDir = makeFilterFixture();
    const capturedServices: string[][] = [];

    // Capture what the command resolves as the in-scope service names.
    const recordingBackend: import('../../src/utils/dev-cluster').DevBackend = {
      probe: async () => [],
      dev: async (opts) => {
        capturedServices.push([...opts.services]);
      },
    };

    try {
      await runDevCluster({
        cluster: true,
        dryRun: false,
        json: false,
        filter: ['web'],
        cwd: fixtureDir,
        backend: recordingBackend,
      });
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }

    expect(capturedServices).toHaveLength(1);
    const inScope = capturedServices[0]!;
    // web was explicitly requested, so it must be included.
    expect(inScope).toContain('web');
    // api is a transitive dependency of web, so it must also be included.
    expect(inScope).toContain('api');
  });

  it('--filter api (no dependencies) scopes to only api', async () => {
    const fixtureDir = makeFilterFixture();
    const capturedServices: string[][] = [];

    const recordingBackend: import('../../src/utils/dev-cluster').DevBackend = {
      probe: async () => [],
      dev: async (opts) => {
        capturedServices.push([...opts.services]);
      },
    };

    try {
      await runDevCluster({
        cluster: true,
        dryRun: false,
        json: false,
        filter: ['api'],
        cwd: fixtureDir,
        backend: recordingBackend,
      });
    } finally {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }

    expect(capturedServices).toHaveLength(1);
    const inScope = capturedServices[0]!;
    expect(inScope).toContain('api');
    // web depends ON api, not the other way around; it must not be included
    // when only api is requested.
    expect(inScope).not.toContain('web');
  });
});
