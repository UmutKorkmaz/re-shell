import { describe, it, expect } from 'vitest';
import { commandSpecSchema } from '@re-shell/contracts';

import type { CatalogEntry } from '../../src/core/catalog.js';
import {
  SPEC_BINARY,
  buildCommandSpec,
  buildHubRunSpec,
  isBareInvocation,
  specIdForPath,
} from '../../src/core/spec.js';

function entry(overrides: Partial<CatalogEntry> & { path: string }): CatalogEntry {
  return {
    aliases: [],
    description: `Description of ${overrides.path}`,
    args: [],
    flags: [],
    supportsJson: true,
    supportsDryRun: false,
    destructive: false,
    ...overrides,
  };
}

describe('specIdForPath', () => {
  it('joins catalog path segments with dots', () => {
    expect(specIdForPath('workspace health')).toBe('workspace.health');
    expect(specIdForPath('doctor')).toBe('doctor');
  });
});

describe('buildCommandSpec', () => {
  const add = entry({
    path: 'add',
    args: [{ name: 'name', required: true }],
    flags: [
      { name: '--team', description: 'Team', takesValue: true },
      { name: '--dry-run', description: 'Preview', takesValue: false },
    ],
    supportsDryRun: true,
  });

  it('builds a contract-valid spec carrying the vetted argv', () => {
    const result = buildCommandSpec(
      add,
      { args: { name: 'my-app' }, flags: { '--team': 'core' }, switches: ['--dry-run'] },
      '/work/space'
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(commandSpecSchema.safeParse(result.spec).success).toBe(true);
    expect(result.spec).toEqual({
      id: 'add',
      title: 'add',
      description: 'Description of add',
      command: [SPEC_BINARY, 'add', 'my-app', '--team', 'core', '--dry-run'],
      cwd: '/work/space',
      dryRunSupported: true,
      destructive: false,
      requiresConfirmation: false,
    });
    expect(result.commandText).toBe('re-shell add my-app --team core --dry-run');
  });

  it('flags a destructive command as requiring confirmation', () => {
    const remove = entry({ path: 'workspace remove', destructive: true });
    const result = buildCommandSpec(remove, {}, '/w');
    expect(result.ok && result.spec.destructive).toBe(true);
    expect(result.ok && result.spec.requiresConfirmation).toBe(true);
    expect(result.ok && result.spec.id).toBe('workspace.remove');
  });

  it('fails the build for an unsafe value (no spec is produced)', () => {
    const result = buildCommandSpec(add, { args: { name: 'foo; rm -rf ~' } }, '/w');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Unsafe value for argument "name"/);
  });

  it('fails the build for a missing required argument', () => {
    const result = buildCommandSpec(add, {}, '/w');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Missing required argument "name"/);
  });

  it('rejects an undeclared switch', () => {
    const result = buildCommandSpec(add, { args: { name: 'x' }, switches: ['--rm-rf'] }, '/w');
    expect(result.ok).toBe(false);
  });
});

describe('buildHubRunSpec', () => {
  it('records exactly the argv the hub run command executes', () => {
    // The hub resolves `run` + subcommand to `<segments> --json`
    // (apps/web/src/hub/command-registry.ts), so the spec must show that.
    const result = buildHubRunSpec(entry({ path: 'workspace summary' }), '/work/space');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.spec.command).toEqual([SPEC_BINARY, 'workspace', 'summary', '--json']);
    expect(result.spec.cwd).toBe('/work/space');
    expect(result.request).toEqual({
      ok: true,
      commandId: 'run',
      params: { subcommand: 'workspace summary', cwd: '/work/space' },
    });
    expect(result.commandText).toBe('re-shell workspace summary --json');
    expect(commandSpecSchema.safeParse(result.spec).success).toBe(true);
  });

  it('rejects a command that is not on the hub allow-list without building a request', () => {
    const result = buildHubRunSpec(entry({ path: 'create' }), '/w');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not on the hub run allow-list/);
  });
});

describe('isBareInvocation', () => {
  const doctor = entry({ path: 'doctor' });
  const health = entry({ path: 'workspace health' });

  it('is true for the bare path, with or without --json', () => {
    expect(isBareInvocation(doctor, ['doctor'])).toBe(true);
    expect(isBareInvocation(doctor, ['doctor', '--json'])).toBe(true);
    expect(isBareInvocation(health, ['workspace', 'health'])).toBe(true);
  });

  it('is false when the hub run command would have to drop an argument or flag', () => {
    expect(isBareInvocation(doctor, ['doctor', '--fix'])).toBe(false);
    expect(isBareInvocation(health, ['workspace', 'health', 'extra'])).toBe(false);
    expect(isBareInvocation(health, ['workspace'])).toBe(false);
    expect(isBareInvocation(health, ['doctor'])).toBe(false);
  });
});
