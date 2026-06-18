import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildCommandCatalog } from '../../src/utils/command-catalog';
import { normalizeHealth } from '../../src/utils/health-normalizer';
import { registerCommandsGroup } from '../../src/groups/commands.group';
import { registerTemplatesGroup } from '../../src/groups/templates.group';

// Capture process.stdout.write output while running an async action.
async function captureStdout(run: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Buffer) => {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return true;
  }) as typeof process.stdout.write;
  try {
    await run();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

function parseEnvelope(out: string): { ok: boolean; data?: unknown; error?: { code: string } } {
  const line = out.split('\n').find(l => l.trim().startsWith('{') || l.trim().startsWith('['));
  if (!line) throw new Error(`No JSON envelope in output: ${out}`);
  return JSON.parse(line.trim());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('command-catalog', () => {
  function buildProgram(): Command {
    const program = new Command('re-shell');

    // A pure namespace group with an auto-added help command (walked, not emitted).
    const group = new Command('workspace').description('Workspace tools');

    group
      .command('summary')
      .description('Summarize the workspace')
      .option('--json', 'Output as JSON')
      .option('--dry-run', 'Preview only')
      .argument('<name>', 'workspace name')
      .action(() => {});

    // Destructive leaf verb (delete).
    group
      .command('delete')
      .description('Delete a workspace')
      .argument('[target]', 'optional target')
      .action(() => {});

    // Nested subgroup to exercise the recursive walk + path-suffix destructive rule.
    const service = new Command('service').description('Service ops');
    service
      .command('down')
      .description('Tear down services')
      .action(() => {});
    group.addCommand(service);

    program.addCommand(group);

    // Top-level runnable with a value-taking flag and an alias.
    program
      .command('analyze')
      .alias('a')
      .description('Analyze the project')
      .option('--json-output', 'Output as JSON')
      .option('--depth <n>', 'analysis depth')
      .action(() => {});

    return program;
  }

  it('flattens every runnable command sorted by path', () => {
    const catalog = buildCommandCatalog(buildProgram());
    const paths = catalog.map(e => e.path);

    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
    expect(paths).toContain('workspace summary');
    expect(paths).toContain('workspace delete');
    expect(paths).toContain('workspace service down');
    expect(paths).toContain('analyze');
    // Pure namespace groups without their own action are not emitted.
    expect(paths).not.toContain('workspace');
    expect(paths).not.toContain('workspace service');
  });

  it('derives json, dry-run, and destructive metadata', () => {
    const byPath = new Map(buildCommandCatalog(buildProgram()).map(e => [e.path, e]));

    const summary = byPath.get('workspace summary')!;
    expect(summary.supportsJson).toBe(true);
    expect(summary.supportsDryRun).toBe(true);
    expect(summary.destructive).toBe(false);
    expect(summary.args).toEqual([{ name: 'name', required: true }]);
    const jsonFlag = summary.flags.find(f => f.name === '--json');
    expect(jsonFlag?.takesValue).toBe(false);

    const del = byPath.get('workspace delete')!;
    expect(del.destructive).toBe(true);
    expect(del.args).toEqual([{ name: 'target', required: false }]);

    const down = byPath.get('workspace service down')!;
    expect(down.destructive).toBe(true);

    const analyze = byPath.get('analyze')!;
    expect(analyze.aliases).toEqual(['a']);
    expect(analyze.supportsJson).toBe(true); // --json-output counts
    const depth = analyze.flags.find(f => f.name === '--depth');
    expect(depth?.takesValue).toBe(true);
  });

  it('captures option defaults when declared', () => {
    const program = new Command('re-shell');
    program
      .command('run')
      .description('Run something')
      .option('--mode <m>', 'mode', 'fast')
      .action(() => {});

    const entry = buildCommandCatalog(program).find(e => e.path === 'run')!;
    const mode = entry.flags.find(f => f.name === '--mode')!;
    expect(mode.default).toBe('fast');
    expect(mode.takesValue).toBe(true);
  });
});

describe('health-normalizer', () => {
  it('normalizes a rich report using its own score', () => {
    const rich = {
      overall: { score: 87.6, status: 'degraded' },
      categories: [
        {
          name: 'deps',
          checks: [
            { name: 'a', status: 'pass', message: 'ok' },
            { name: 'b', status: 'fail', metadata: { x: 1 } },
            { name: 'c', status: 'warning' },
            { name: 'd', status: 'info' },
          ],
        },
      ],
    };

    const result = normalizeHealth(rich);
    expect(result.score).toBe(88); // rounded
    expect(result.status).toBe('degraded');
    expect(result.checks).toHaveLength(4);
    expect(result.checks[0]).toEqual({ name: 'a', status: 'healthy', message: 'ok' });
    expect(result.checks[1]).toEqual({ name: 'b', status: 'critical', details: { x: 1 } });
    expect(result.checks[2].status).toBe('warning');
    expect(result.checks[3].status).toBe('healthy'); // info -> healthy
  });

  it('clamps a rich score outside 0-100', () => {
    const high = normalizeHealth({
      overall: { score: 150, status: 'healthy' },
      categories: [],
    });
    expect(high.score).toBe(100);
    expect(high.status).toBe('healthy');

    const low = normalizeHealth({
      overall: { score: -20, status: 'unhealthy' },
      categories: [],
    });
    expect(low.score).toBe(0);
    expect(low.status).toBe('critical'); // unhealthy -> critical
  });

  it('derives a score from check severities on the lightweight path', () => {
    const result = normalizeHealth({
      checks: [
        { name: 'a', status: 'healthy' },
        { name: 'b', status: 'warning', message: 'meh' },
        { name: 'c', status: 'critical', details: 'boom' },
      ],
    });
    // (1 + 0.5 + 0) / 3 * 100 = 50 -> critical
    expect(result.score).toBe(50);
    expect(result.status).toBe('critical');
    expect(result.checks[1]).toEqual({ name: 'b', status: 'warning', message: 'meh' });
    expect(result.checks[2]).toEqual({ name: 'c', status: 'critical', details: 'boom' });
  });

  it('maps derived score onto healthy/degraded thresholds', () => {
    const healthy = normalizeHealth({ checks: [{ name: 'a', status: 'healthy' }] });
    expect(healthy.score).toBe(100);
    expect(healthy.status).toBe('healthy');

    const degraded = normalizeHealth({
      checks: [
        { name: 'a', status: 'healthy' },
        { name: 'b', status: 'healthy' },
        { name: 'c', status: 'healthy' },
        { name: 'd', status: 'warning' },
      ],
    });
    // (3 + 0.5)/4*100 = 87.5 -> 88 -> degraded
    expect(degraded.status).toBe('degraded');
  });

  it('returns 0 score for an empty lightweight checks array', () => {
    const result = normalizeHealth({ checks: [] });
    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
    expect(result.checks).toEqual([]);
  });

  it('returns an empty critical report for unknown input', () => {
    for (const bad of [null, undefined, 42, 'nope', {}, { foo: 'bar' }]) {
      const result = normalizeHealth(bad);
      expect(result).toEqual({ score: 0, status: 'critical', checks: [] });
    }
  });

  it('normalizes lightweight check status variants', () => {
    const result = normalizeHealth({
      checks: [
        { name: 'a', status: 'critical' as const },
        { name: 'b', status: 'warning' as const },
        { name: 'c', status: 'healthy' as const },
      ],
    });
    expect(result.checks.map(c => c.status)).toEqual(['critical', 'warning', 'healthy']);
  });
});

describe('commands.group', () => {
  it('emits a JSON catalog of registered commands', async () => {
    const program = new Command('re-shell');
    program
      .command('analyze')
      .description('Analyze')
      .option('--json', 'json')
      .action(() => {});
    registerCommandsGroup(program);

    const out = await captureStdout(async () => {
      await program.parseAsync(['node', 're-shell', 'commands', 'list', '--json']);
    });
    const env = parseEnvelope(out);
    expect(env.ok).toBe(true);
    const paths = (env.data as Array<{ path: string }>).map(e => e.path);
    expect(paths).toContain('analyze');
    expect(paths).toContain('commands list');
  });

  it('prints a human-readable catalog without --json', async () => {
    const program = new Command('re-shell');
    registerCommandsGroup(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 're-shell', 'commands', 'list']);
    const printed = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(printed).toContain('Commands');
    expect(printed).toContain('commands list');
  });
});

describe('templates.group', () => {
  it('emits a JSON list of templates', async () => {
    const program = new Command('re-shell');
    registerTemplatesGroup(program);
    const out = await captureStdout(async () => {
      await program.parseAsync(['node', 're-shell', 'templates', 'list', '--json']);
    });
    const env = parseEnvelope(out);
    expect(env.ok).toBe(true);
    expect(Array.isArray(env.data)).toBe(true);
    expect((env.data as unknown[]).length).toBeGreaterThan(0);
  });

  it('filters the JSON list by language', async () => {
    const program = new Command('re-shell');
    registerTemplatesGroup(program);
    const out = await captureStdout(async () => {
      await program.parseAsync(['node', 're-shell', 'templates', 'list', '--json', '--language', '__none__']);
    });
    const env = parseEnvelope(out);
    expect(env.ok).toBe(true);
    expect(env.data).toEqual([]);
  });

  it('shows a single template as JSON', async () => {
    // First discover a real template id from the list, then show it.
    const listProgram = new Command('re-shell');
    registerTemplatesGroup(listProgram);
    const listOut = await captureStdout(async () => {
      await listProgram.parseAsync(['node', 're-shell', 'templates', 'list', '--json']);
    });
    const list = parseEnvelope(listOut).data as Array<{ id: string }>;
    const id = list[0].id;

    const showProgram = new Command('re-shell');
    registerTemplatesGroup(showProgram);
    const showOut = await captureStdout(async () => {
      await showProgram.parseAsync(['node', 're-shell', 'templates', 'show', id, '--json']);
    });
    const env = parseEnvelope(showOut);
    expect(env.ok).toBe(true);
    expect((env.data as { id: string }).id).toBe(id);
  });

  it('returns a TEMPLATE_NOT_FOUND error for an unknown id', async () => {
    const program = new Command('re-shell');
    registerTemplatesGroup(program);
    const out = await captureStdout(async () => {
      await program.parseAsync(['node', 're-shell', 'templates', 'show', '__missing__', '--json']);
    });
    const env = parseEnvelope(out);
    expect(env.ok).toBe(false);
    expect(env.error?.code).toBe('TEMPLATE_NOT_FOUND');
  });

  it('prints a human-readable template list without --json', async () => {
    const program = new Command('re-shell');
    registerTemplatesGroup(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 're-shell', 'templates', 'list']);
    const printed = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(printed).toContain('Templates');
  });

  it('prints a single template detail block without --json', async () => {
    const listProgram = new Command('re-shell');
    registerTemplatesGroup(listProgram);
    const listOut = await captureStdout(async () => {
      await listProgram.parseAsync(['node', 're-shell', 'templates', 'list', '--json']);
    });
    const id = (parseEnvelope(listOut).data as Array<{ id: string }>)[0].id;

    const program = new Command('re-shell');
    registerTemplatesGroup(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 're-shell', 'templates', 'show', id]);
    const printed = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(printed).toContain('Template:');
    expect(printed).toContain('Language:');
    expect(printed).toContain('Framework:');
  });

  it('prints a not-found message without --json and sets exit code', async () => {
    const program = new Command('re-shell');
    registerTemplatesGroup(program);
    const prevExit = process.exitCode;
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 're-shell', 'templates', 'show', '__missing__']);
    const printed = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(printed).toContain('Template not found');
    expect(process.exitCode).toBe(1);
    process.exitCode = prevExit;
  });

  it('prints "no templates match" for an impossible filter without --json', async () => {
    const program = new Command('re-shell');
    registerTemplatesGroup(program);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 're-shell', 'templates', 'list', '--framework', '__none__']);
    const printed = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(printed).toContain('No templates match');
  });
});
