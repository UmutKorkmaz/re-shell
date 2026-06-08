import { describe, it, expect } from 'vitest';

import { buildCommand, pathToSegments } from '../../src/core/command-builder.js';
import type { CatalogEntry } from '../../src/core/catalog.js';

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    path: 'workspace health',
    aliases: [],
    description: '',
    args: [],
    flags: [],
    supportsJson: false,
    supportsDryRun: false,
    destructive: false,
    ...over,
  };
}

describe('pathToSegments', () => {
  it('splits a multi-word path into argv segments', () => {
    expect(pathToSegments('workspace health')).toEqual(['workspace', 'health']);
    expect(pathToSegments('doctor')).toEqual(['doctor']);
  });
});

describe('buildCommand', () => {
  it('assembles path segments with a boolean switch', () => {
    const e = entry({ flags: [{ name: '--json', description: '', takesValue: false }] });
    const result = buildCommand(e, { switches: ['--json'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.argv).toEqual(['workspace', 'health', '--json']);
    expect(result.commandText).toBe('re-shell workspace health --json');
  });

  it('preserves catalog declaration order for value-flags', () => {
    const e = entry({
      path: 'templates list',
      flags: [
        { name: '--language', description: '', takesValue: true },
        { name: '--framework', description: '', takesValue: true },
        { name: '--json', description: '', takesValue: false },
      ],
    });
    // Pass flags in the OPPOSITE order to prove output order follows the catalog.
    const result = buildCommand(e, {
      flags: { '--framework': 'express', '--language': 'ts' },
      switches: ['--json'],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.argv).toEqual([
      'templates',
      'list',
      '--language',
      'ts',
      '--framework',
      'express',
      '--json',
    ]);
  });

  it('places required positional args before flags, in catalog order', () => {
    const e = entry({
      path: 'create',
      args: [{ name: 'name', required: true }],
      flags: [{ name: '--template', description: '', takesValue: true }],
    });
    const result = buildCommand(e, { args: { name: 'api' }, flags: { '--template': 'express' } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.argv).toEqual(['create', 'api', '--template', 'express']);
  });

  it('fails when a required arg is missing', () => {
    const e = entry({ path: 'create', args: [{ name: 'name', required: true }] });
    const result = buildCommand(e, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/required argument "name"/);
  });

  it('rejects an injection payload in an arg value (never becomes a token)', () => {
    const e = entry({ path: 'create', args: [{ name: 'name', required: true }] });
    const result = buildCommand(e, { args: { name: 'foo; rm -rf ~' } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unsafe value/);
  });

  it('rejects an injection payload in a flag value', () => {
    const e = entry({
      path: 'templates list',
      flags: [{ name: '--language', description: '', takesValue: true }],
    });
    const result = buildCommand(e, { flags: { '--language': '`whoami`' } });
    expect(result.ok).toBe(false);
  });

  it('rejects a switch that is not declared on the entry', () => {
    const e = entry({ flags: [{ name: '--json', description: '', takesValue: false }] });
    const result = buildCommand(e, { switches: ['--evil'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unknown flag/);
  });

  it('rejects using a value-flag as a boolean switch', () => {
    const e = entry({
      path: 'templates list',
      flags: [{ name: '--language', description: '', takesValue: true }],
    });
    const result = buildCommand(e, { switches: ['--language'] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/expects a value/);
  });

  it('skips optional args and unset value-flags', () => {
    const e = entry({
      path: 'templates list',
      args: [{ name: 'filter', required: false }],
      flags: [{ name: '--language', description: '', takesValue: true }],
    });
    const result = buildCommand(e, {});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.argv).toEqual(['templates', 'list']);
  });

  it('does not duplicate a switch already present', () => {
    const e = entry({ flags: [{ name: '--json', description: '', takesValue: false }] });
    const result = buildCommand(e, { switches: ['--json', '--json'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.argv.filter((t) => t === '--json')).toHaveLength(1);
  });
});
