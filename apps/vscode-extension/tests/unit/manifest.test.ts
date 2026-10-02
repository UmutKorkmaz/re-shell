import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the extension manifest (package.json) against drifting from the code.
 * A command that is contributed but never registered (or the reverse) only
 * shows up inside a real editor, so it is pinned here.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
  name: string;
  publisher: string;
  version: string;
  main: string;
  icon: string;
  engines: { vscode: string };
  contributes: {
    commands: { command: string; title: string }[];
    views: Record<string, { id: string }[]>;
    menus: Record<string, { command: string; when?: string }[]>;
    configuration: { properties: Record<string, { type: string; scope?: string; default?: unknown }> };
  };
  activationEvents: string[];
  dependencies?: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
};
const source = fs.readFileSync(path.join(root, 'src/extension.ts'), 'utf8');

const contributed = manifest.contributes.commands.map((c) => c.command);
const registered = [...source.matchAll(/registerCommand\(\s*'([^']+)'/g)].map((m) => m[1]);

describe('marketplace identity', () => {
  it('keeps the published name, publisher and VS Code engine range', () => {
    expect(manifest.name).toBe('re-shell');
    expect(manifest.publisher).toBe('umutkorkmaz');
    expect(manifest.engines.vscode).toBe('^1.85.0');
  });

  it('points main at the esbuild bundle and ships an icon that exists', () => {
    expect(manifest.main).toBe('./dist/extension.js');
    expect(fs.existsSync(path.join(root, manifest.icon))).toBe(true);
  });

  it('declares @types/vscode no newer than the engine floor (vsce enforces this)', () => {
    const types = manifest.devDependencies['@types/vscode'];
    expect(types).toMatch(/^[~^]?1\.85\./);
  });
});

describe('contributed commands', () => {
  it('registers exactly the commands the manifest contributes', () => {
    expect([...registered].sort()).toEqual([...contributed].sort());
  });

  it('has no duplicate command ids', () => {
    expect(new Set(contributed).size).toBe(contributed.length);
  });

  it('contributes the Build Command and Run via Hub palette commands', () => {
    expect(contributed).toContain('reShell.buildCommand');
    expect(contributed).toContain('reShell.runViaHub');
    const hidden = manifest.contributes.menus['commandPalette'].filter((m) => m.when === 'false').map((m) => m.command);
    expect(hidden).not.toContain('reShell.buildCommand');
    expect(hidden).not.toContain('reShell.runViaHub');
  });

  it('only references contributed commands from menus', () => {
    for (const [menu, items] of Object.entries(manifest.contributes.menus)) {
      for (const item of items) {
        expect(contributed, `${menu}: ${item.command}`).toContain(item.command);
      }
    }
  });
});

describe('views', () => {
  it('contributes every tree view the extension creates', () => {
    const created = [...source.matchAll(/const VIEW_\w+ = '([^']+)'/g)].map((m) => m[1]);
    const contributedViews = Object.values(manifest.contributes.views).flatMap((v) => v.map((x) => x.id));
    expect(created.length).toBe(3);
    for (const id of created) {
      expect(contributedViews).toContain(id);
    }
  });
});

describe('configuration', () => {
  const props = manifest.contributes.configuration.properties;

  it('contributes every setting the extension reads', () => {
    for (const key of ['reShell.cliBin', 'reShell.hub.url', 'reShell.hub.token', 'reShell.hub.timeoutMs']) {
      expect(props[key], key).toBeDefined();
    }
  });

  it('restricts executable/credential settings to user (machine) scope', () => {
    // A workspace's .vscode/settings.json must not be able to choose which
    // binary the extension spawns or which hub receives the token.
    for (const key of ['reShell.cliBin', 'reShell.hub.url', 'reShell.hub.token']) {
      expect(props[key].scope, key).toBe('machine');
    }
  });

  it('defaults the hub URL to loopback and the token to empty', () => {
    expect(props['reShell.hub.url'].default).toBe('http://127.0.0.1:3334');
    expect(props['reShell.hub.token'].default).toBe('');
  });
});

describe('packaging', () => {
  it('bundles its runtime dependencies (none are installed alongside the vsix)', () => {
    expect(manifest.dependencies ?? {}).toEqual({});
  });

  it('has the build, typecheck, test, host-test and package scripts', () => {
    for (const script of ['build', 'typecheck', 'test', 'test:integration', 'test:host', 'package']) {
      expect(manifest.scripts[script], script).toBeDefined();
    }
    expect(manifest.scripts['package']).toContain('vsce package');
  });

  it('excludes sources, tests and tooling from the vsix', () => {
    const ignore = fs.readFileSync(path.join(root, '.vscodeignore'), 'utf8').split('\n');
    for (const pattern of ['src/**', 'tests/**', 'scripts/**', 'node_modules/**', 'dist-test/**', '.vscode-test/**', '*.vsix']) {
      expect(ignore, pattern).toContain(pattern);
    }
  });
});
