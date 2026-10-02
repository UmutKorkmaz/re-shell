import { describe, it, expect } from 'vitest';

import { parseCommandCatalog, type CatalogEntry } from '../../src/core/catalog.js';

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    path: 'workspace health',
    aliases: [],
    description: 'Health checks for the current workspace.',
    args: [],
    flags: [{ name: '--json', description: 'JSON output', takesValue: false }],
    supportsJson: true,
    supportsDryRun: false,
    destructive: false,
    ...over,
  };
}

function okEnvelope(data: CatalogEntry[], warnings: string[] = []) {
  return JSON.stringify({ ok: true, data, warnings });
}

describe('parseCommandCatalog', () => {
  it('parses a valid commands.list envelope into sorted entries', () => {
    const raw = okEnvelope([
      entry({ path: 'workspace health' }),
      entry({ path: 'analyze' }),
      entry({ path: 'doctor' }),
    ]);
    const result = parseCommandCatalog(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entries.map((e) => e.path)).toEqual(['analyze', 'doctor', 'workspace health']);
    expect(result.warnings).toEqual([]);
  });

  it('accepts an already-parsed object (not just a string)', () => {
    const obj = { ok: true, data: [entry()], warnings: ['heads up'] };
    const result = parseCommandCatalog(obj);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual(['heads up']);
    expect(result.entries).toHaveLength(1);
  });

  it('surfaces an ok:false error envelope with code + message', () => {
    const raw = JSON.stringify({
      ok: false,
      error: { code: 'COMMANDS_LIST_ERROR', message: 'boom' },
      warnings: [],
    });
    const result = parseCommandCatalog(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('COMMANDS_LIST_ERROR');
    expect(result.error).toContain('boom');
  });

  it('rejects malformed JSON without throwing', () => {
    const result = parseCommandCatalog('{ not json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not valid JSON/);
  });

  it('rejects empty output', () => {
    const result = parseCommandCatalog('   ');
    expect(result.ok).toBe(false);
  });

  it('rejects a payload that does not match the contract shape', () => {
    const raw = JSON.stringify({ ok: true, data: [{ path: 123 }], warnings: [] });
    const result = parseCommandCatalog(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/does not match the contract/);
  });

  it('rejects an unknown error code (not in the contract enum)', () => {
    const raw = JSON.stringify({
      ok: false,
      error: { code: 'TOTALLY_MADE_UP', message: 'x' },
      warnings: [],
    });
    const result = parseCommandCatalog(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/does not match the contract/);
  });
});
