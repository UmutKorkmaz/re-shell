import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import type { TemplateWire, WorkspaceSummaryWire } from '@re-shell/contracts';

/**
 * In-process test of the MCP server's tool handlers against a stubbed CLI.
 *
 * Instead of spawning the real CLI, we mock `node:child_process.spawn` so each
 * invocation emits a canned `--json` stdout payload and a chosen exit code. This
 * keeps the suite deterministic and fully offline while still exercising the
 * real code path: argv building -> spawn -> stdout capture -> JSON parse ->
 * contracts envelope validation -> MCP tool result mapping.
 */

/** Bytes a single fake invocation should write to stdout, plus its exit code. */
interface CannedRun {
  readonly stdout: string;
  readonly code: number;
}

/** The queue of canned runs the mocked `spawn` will replay, in call order. */
let cannedRuns: CannedRun[] = [];

/** Records the argv each mocked `spawn` call received (binary + all args). */
let spawnCalls: string[][] = [];

vi.mock('node:child_process', () => {
  return {
    spawn: (bin: string, args: readonly string[]) => {
      spawnCalls.push([bin, ...args]);
      const next = cannedRuns.shift();
      const stdout = next?.stdout ?? '';
      const code = next?.code ?? 0;

      const child = new EventEmitter() as EventEmitter & {
        stdout: Readable;
        stderr: Readable;
        kill: (signal?: NodeJS.Signals) => boolean;
      };
      child.stdout = Readable.from([Buffer.from(stdout, 'utf8')]);
      child.stderr = Readable.from([]);
      child.kill = () => true;

      // Emit close on the next tick, after stdout has flushed its data.
      setImmediate(() => {
        child.emit('close', code);
      });

      return child;
    },
  };
});

// Import AFTER the mock is registered so the modules pick up the stubbed spawn.
const { READ_ONLY_TOOLS, WRITE_TOOLS, getActiveTools } = await import('../src/tools.js');
const { resolveCli } = await import('../src/cli.js');

/**
 * A `workspaceSummaryWireSchema` payload (exactly what `workspace summary --json`
 * prints: root / packageManager / workspaces / graph / canonical health) wrapped
 * in the success envelope.
 */
const VALID_WORKSPACE_SUMMARY = {
  ok: true,
  data: {
    root: '/tmp/demo-workspace',
    packageManager: 'pnpm',
    workspaces: [
      {
        name: '@demo/web',
        path: 'apps/web',
        type: 'app',
        framework: 'react-ts',
        version: '1.0.0',
        dependencies: ['react'],
      },
    ],
    graph: {
      apps: [{ name: '@demo/web', path: 'apps/web', framework: 'react-ts', dependencies: [] }],
      services: [],
    },
    health: {
      score: 100,
      status: 'healthy',
      checks: [{ name: 'Workspaces', status: 'healthy', message: '1 workspace(s) detected' }],
    },
  },
  warnings: [],
};

/**
 * The OLD, domain-shaped summary (`workspaceSummarySchema`). The real CLI has
 * never printed this, and the server used to demand it, which made the tool throw
 * against every real workspace. It must now be rejected.
 */
const DOMAIN_SHAPED_WORKSPACE_SUMMARY = {
  ok: true,
  data: {
    path: '/tmp/demo-workspace',
    name: 'demo-workspace',
    packageManager: 'pnpm',
    apps: [],
    services: [],
    templates: [],
    health: { score: 100, status: 'pass', checks: [] },
  },
  warnings: [],
};

/** A structured CLI error envelope, as emitted outside a workspace. */
const NOT_A_WORKSPACE_ERROR = {
  ok: false,
  error: {
    code: 'NOT_IN_MONOREPO',
    message: 'No Re-Shell workspace found in the current directory.',
  },
  warnings: [],
};

/** A canned invocation; the mock never reads the path, so any value is fine. */
function fakeInvocation() {
  const entry = '/abs/path/to/cli/dist/index.js';
  return { prefix: ['/node', entry], strategy: 'RE_SHELL_BIN', entry } as ReturnType<
    typeof resolveCli
  >;
}

function queue(...runs: CannedRun[]): void {
  cannedRuns = [...runs];
}

beforeEach(() => {
  cannedRuns = [];
  spawnCalls = [];
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('workspace_summary against a valid workspace fixture', () => {
  it('returns a validated { ok: true, data } envelope', async () => {
    queue({ stdout: JSON.stringify(VALID_WORKSPACE_SUMMARY), code: 0 });

    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'workspace_summary');
    expect(tool).toBeDefined();

    const { envelope, exitCode } = await tool!.run(fakeInvocation(), {});

    expect(exitCode).toBe(0);
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      const data = envelope.data as WorkspaceSummaryWire;
      expect(data.root).toBe('/tmp/demo-workspace');
      expect(data.packageManager).toBe('pnpm');
      expect(data.health.status).toBe('healthy');
      expect(data.workspaces.map((w) => w.name)).toEqual(['@demo/web']);
    }

    // The CLI was driven with the fixed, machine-readable argv (no shell).
    expect(spawnCalls).toHaveLength(1);
    const [, , ...args] = spawnCalls[0];
    expect(args).toEqual(['workspace', 'summary', '--json']);
  });

  it('preserves fields the contract does not declare (a newer CLI never loses data)', async () => {
    const withExtra = structuredClone(VALID_WORKSPACE_SUMMARY) as typeof VALID_WORKSPACE_SUMMARY & {
      data: Record<string, unknown>;
    };
    withExtra.data.futureField = { added: 'later' };
    queue({ stdout: JSON.stringify(withExtra), code: 0 });

    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'workspace_summary');
    const { envelope } = await tool!.run(fakeInvocation(), {});
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect((envelope.data as Record<string, unknown>).futureField).toEqual({ added: 'later' });
    }
  });

  it('rejects the domain-shaped summary the real CLI never printed', async () => {
    queue({ stdout: JSON.stringify(DOMAIN_SHAPED_WORKSPACE_SUMMARY), code: 0 });
    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'workspace_summary');
    await expect(tool!.run(fakeInvocation(), {})).rejects.toThrow(/did not match the expected envelope/);
  });
});

describe('workspace_summary outside a workspace', () => {
  it('returns a structured { ok: false, error } envelope (surfaced as an MCP error)', async () => {
    // A non-zero exit that still emits a valid ERROR envelope is returned, not
    // thrown, so the server can surface the CLI's own code/message.
    queue({ stdout: JSON.stringify(NOT_A_WORKSPACE_ERROR), code: 1 });

    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'workspace_summary');
    const { envelope, exitCode } = await tool!.run(fakeInvocation(), {});

    expect(exitCode).toBe(1);
    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe('NOT_IN_MONOREPO');
      expect(envelope.error.message).toMatch(/workspace/i);
    }
  });

  it('throws when the CLI emits non-JSON output', async () => {
    queue({ stdout: 'Error: not json at all', code: 1 });
    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'workspace_summary');
    await expect(tool!.run(fakeInvocation(), {})).rejects.toThrow(/not valid JSON/);
  });

  it('throws when the envelope fails schema validation', async () => {
    // `ok: true` but `data` is missing the required workspace summary fields.
    queue({ stdout: JSON.stringify({ ok: true, data: { name: 42 }, warnings: [] }), code: 0 });
    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'workspace_summary');
    await expect(tool!.run(fakeInvocation(), {})).rejects.toThrow(/did not match the expected envelope/);
  });
});

describe('mutating tools are gated behind RE_SHELL_MCP_ALLOW_WRITE=1', () => {
  const original = process.env.RE_SHELL_MCP_ALLOW_WRITE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.RE_SHELL_MCP_ALLOW_WRITE;
    } else {
      process.env.RE_SHELL_MCP_ALLOW_WRITE = original;
    }
  });

  it('omits workspace_create by default', () => {
    delete process.env.RE_SHELL_MCP_ALLOW_WRITE;
    const active = getActiveTools();
    expect(active.some((t) => t.name === 'workspace_create')).toBe(false);
    expect(active.every((t) => t.mutating === false)).toBe(true);
  });

  it('includes workspace_create only when the flag is exactly "1"', () => {
    process.env.RE_SHELL_MCP_ALLOW_WRITE = '1';
    const active = getActiveTools();
    expect(active.some((t) => t.name === 'workspace_create')).toBe(true);
    expect(active).toHaveLength(READ_ONLY_TOOLS.length + WRITE_TOOLS.length);
  });

  it('routes workspace_create through the fixed CLI argv when enabled', async () => {
    process.env.RE_SHELL_MCP_ALLOW_WRITE = '1';
    queue({ stdout: JSON.stringify({ ok: true, data: {}, warnings: [] }), code: 0 });

    const create = WRITE_TOOLS.find((t) => t.name === 'workspace_create');
    expect(create).toBeDefined();
    const { envelope } = await create!.run(fakeInvocation(), { name: 'my-app' });
    expect(envelope.ok).toBe(true);

    expect(spawnCalls).toHaveLength(1);
    const [, , ...args] = spawnCalls[0];
    expect(args).toEqual(['workspace', 'init', 'my-app', '--json']);
  });

  it('rejects an injection-style workspace name before any spawn', async () => {
    process.env.RE_SHELL_MCP_ALLOW_WRITE = '1';
    const create = WRITE_TOOLS.find((t) => t.name === 'workspace_create');
    await expect(create!.run(fakeInvocation(), { name: '../../etc/passwd' })).rejects.toThrow();
    // No CLI invocation should have happened — validation fails first.
    expect(spawnCalls).toHaveLength(0);
  });
});

describe('templates_show forwards a validated id as a single argv token', () => {
  it('passes a well-formed id through and validates the template envelope', async () => {
    // Exactly what `templates show <id> --json` prints (the registry projection:
    // no `domain` / `command`, which only the UI adapter derives).
    const template = {
      id: 'react-vite',
      name: 'react-vite',
      displayName: 'React + Vite',
      description: 'A React app scaffolded with Vite.',
      language: 'typescript',
      framework: 'react',
      version: '18.3.1',
      tags: ['spa'],
      features: ['hmr'],
      port: 5173,
      fileCount: 12,
    };
    queue({ stdout: JSON.stringify({ ok: true, data: template, warnings: [] }), code: 0 });

    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'templates_show');
    const { envelope } = await tool!.run(fakeInvocation(), { id: 'react-vite' });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect((envelope.data as TemplateWire).id).toBe('react-vite');
    }

    const [, , ...args] = spawnCalls[0];
    expect(args).toEqual(['templates', 'show', 'react-vite', '--json']);
  });
});
