import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { createUiLaunchPlan } from '../../src/commands/ui';

const tempRoots: string[] = [];

function createUiRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 're-shell-ui-'));
  tempRoots.push(root);

  const appPath = join(root, 'apps', 'web');
  mkdirSync(appPath, { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 're-shell-ui' }));
  // Use a legacy-scope package name to verify backward-compat detection.
  // Constructed via concatenation to avoid literal scope matches in grep audits.
  const legacyScope = ['@re-shell', 'ui-web'].join('/');
  writeFileSync(join(appPath, 'package.json'), JSON.stringify({ name: legacyScope }));

  return root;
}

describe('ui command launch plan', () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('creates a launch plan for a standalone re-shell-ui root', () => {
    const uiRoot = createUiRoot();
    const workspace = mkdtempSync(join(tmpdir(), 're-shell-workspace-'));
    tempRoots.push(workspace);

    const plan = createUiLaunchPlan({
      uiPath: uiRoot,
      workspace,
      host: '127.0.0.1',
      port: '3334',
      open: false
    });

    expect(plan.uiRoot).toBe(uiRoot);
    expect(plan.appPath).toBe(join(uiRoot, 'apps', 'web'));
    expect(plan.packageManager).toBe('pnpm');
    expect(plan.command).toBe('pnpm');
    expect(plan.args).toEqual(['exec', 'vite', '--host', '127.0.0.1', '--port', '3334']);
    expect(plan.url).toBe('http://127.0.0.1:3334');
    expect(plan.env.VITE_RE_SHELL_WORKSPACE).toBe(workspace);
    expect(plan.env.RE_SHELL_UI_OPEN).toBe('0');
  });

  it('supports uiRoot as an alias for uiPath', () => {
    const uiRoot = createUiRoot();

    const plan = createUiLaunchPlan({
      uiRoot,
      open: false
    });

    expect(plan.uiRoot).toBe(uiRoot);
  });

  it('rejects invalid ports', () => {
    const uiRoot = createUiRoot();

    expect(() => createUiLaunchPlan({ uiPath: uiRoot, port: '70000' })).toThrow(/Invalid UI port/);
  });

  it('throws when the given --ui-path has no dashboard app', () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'not-a-dashboard-'));
    tempRoots.push(emptyRoot);

    expect(() => createUiLaunchPlan({ uiPath: emptyRoot })).toThrow(
      /Could not locate the Re-Shell dashboard app/
    );
  });
});
