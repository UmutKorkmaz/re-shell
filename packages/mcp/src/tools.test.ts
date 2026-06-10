import { describe, it, expect, afterEach } from 'vitest';
import {
  READ_ONLY_TOOLS,
  WRITE_TOOLS,
  getActiveTools,
  isWriteEnabled,
} from './tools.js';

const EXPECTED_READ_ONLY = [
  'workspace_summary',
  'workspace_graph',
  'workspace_health',
  'templates_list',
  'templates_show',
  'templates_matrix',
  'doctor',
  'analyze',
  'commands_list',
];

describe('read-only tool registry', () => {
  it('exposes exactly the allow-listed read-only tools', () => {
    expect(READ_ONLY_TOOLS.map((t) => t.name)).toEqual(EXPECTED_READ_ONLY);
  });

  it('marks every read-only tool as non-mutating', () => {
    for (const tool of READ_ONLY_TOOLS) {
      expect(tool.mutating).toBe(false);
    }
  });

  it('gives every tool a non-empty description', () => {
    for (const tool of [...READ_ONLY_TOOLS, ...WRITE_TOOLS]) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe('write gating', () => {
  const original = process.env.RE_SHELL_MCP_ALLOW_WRITE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.RE_SHELL_MCP_ALLOW_WRITE;
    } else {
      process.env.RE_SHELL_MCP_ALLOW_WRITE = original;
    }
  });

  it('is read-only by default', () => {
    delete process.env.RE_SHELL_MCP_ALLOW_WRITE;
    expect(isWriteEnabled()).toBe(false);
    expect(getActiveTools()).toEqual(READ_ONLY_TOOLS);
  });

  it('does not enable writes for values other than "1"', () => {
    process.env.RE_SHELL_MCP_ALLOW_WRITE = 'true';
    expect(isWriteEnabled()).toBe(false);
    expect(getActiveTools().some((t) => t.mutating)).toBe(false);
  });

  it('appends mutating tools when RE_SHELL_MCP_ALLOW_WRITE=1', () => {
    process.env.RE_SHELL_MCP_ALLOW_WRITE = '1';
    expect(isWriteEnabled()).toBe(true);
    const active = getActiveTools();
    expect(active.length).toBe(READ_ONLY_TOOLS.length + WRITE_TOOLS.length);
    expect(active.some((t) => t.name === 'workspace_create' && t.mutating)).toBe(true);
  });
});

describe('argv building (fixed array, never a shell string)', () => {
  // A fake invocation; `run` builds argv before any spawn, so we capture the
  // argv by stubbing nothing — instead we assert the input validation rejects
  // injection-style values, proving they can only ever be literal tokens.
  it('rejects a malformed template id before building argv', async () => {
    const show = READ_ONLY_TOOLS.find((t) => t.name === 'templates_show');
    expect(show).toBeDefined();
    await expect(
      show!.run({ prefix: ['node', '/cli'], strategy: 'RE_SHELL_BIN', entry: '/cli' }, {
        id: '; rm -rf ~',
      })
    ).rejects.toThrow();
  });

  it('rejects an invalid analyze type before building argv', async () => {
    const analyze = READ_ONLY_TOOLS.find((t) => t.name === 'analyze');
    expect(analyze).toBeDefined();
    await expect(
      analyze!.run({ prefix: ['node', '/cli'], strategy: 'RE_SHELL_BIN', entry: '/cli' }, {
        type: 'rootkit',
      })
    ).rejects.toThrow();
  });
});
