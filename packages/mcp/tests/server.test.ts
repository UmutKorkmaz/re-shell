import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

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

/** A valid `workspaceSummarySchema` payload wrapped in the success envelope. */
const VALID_WORKSPACE_SUMMARY = {
  ok: true,
  data: {
    path: '/tmp/demo-workspace',
    name: 'demo-workspace',
    packageManager: 'pnpm',
    apps: [],
    services: [],
    templates: [],
    health: {
      score: 100,
      status: 'pass',
      checks: [],
    },
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
      expect(envelope.data.name).toBe('demo-workspace');
      expect(envelope.data.packageManager).toBe('pnpm');
      expect(envelope.data.health.status).toBe('pass');
    }

    // The CLI was driven with the fixed, machine-readable argv (no shell).
    expect(spawnCalls).toHaveLength(1);
    const [, , ...args] = spawnCalls[0];
    expect(args).toEqual(['workspace', 'summary', '--json']);
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
    const template = {
      id: 'react-vite',
      name: 'React + Vite',
      description: 'A React app scaffolded with Vite.',
      domain: 'frontend',
      language: 'typescript',
      framework: 'react',
      tags: ['spa'],
      command: ['re-shell', 'create', '--template', 'react-vite'],
    };
    queue({ stdout: JSON.stringify({ ok: true, data: template, warnings: [] }), code: 0 });

    const tool = READ_ONLY_TOOLS.find((t) => t.name === 'templates_show');
    const { envelope } = await tool!.run(fakeInvocation(), { id: 'react-vite' });
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.data.id).toBe('react-vite');
    }

    const [, , ...args] = spawnCalls[0];
    expect(args).toEqual(['templates', 'show', 'react-vite', '--json']);
  });
});
