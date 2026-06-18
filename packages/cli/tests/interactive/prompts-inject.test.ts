import { describe, it, expect, beforeEach } from 'vitest';
import prompts from 'prompts';
import * as fs from 'fs-extra';
import * as path from 'path';
import { makeTmpWorkspace, inWorkspace, type TmpWorkspace } from './harness';

/**
 * PRIMARY interactive mechanism: prompts.inject().
 *
 * Each command imports the `prompts` library and asks questions via `prompts([...])`.
 * We pre-seed the answers with `prompts.inject([...])` (in prompt order), invoke the
 * command's exported action inside an isolated tmp workspace, then assert the real
 * generated files / package.json on disk.
 *
 * Commands are dynamically imported AFTER chdir so that any module-load-time
 * `process.cwd()` capture (e.g. the template engine singleton) targets the tmp dir.
 */
describe('interactive flows via prompts.inject', () => {
  let ws: TmpWorkspace;

  beforeEach(() => {
    ws = makeTmpWorkspace();
    return () => ws.cleanup();
  });

  it('create: scaffolds a monorepo project (template select + package manager select)', async () => {
    await inWorkspace(ws.dir, async () => {
      const { createProject } = await import('../../src/commands/create');
      // createMonorepoProject prompts in order: [template, packageManager]
      prompts.inject(['react-ts', 'pnpm']);
      await createProject('My Cool App', { org: 'acme' });
    });

    const projDir = path.join(ws.dir, 'my-cool-app');
    const pkg = fs.readJsonSync(path.join(projDir, 'package.json'));
    expect(pkg.name).toBe('my-cool-app');
    expect(pkg.private).toBe(true);
    expect(pkg.scripts.dev).toContain('pnpm');
    expect(fs.existsSync(path.join(projDir, 'pnpm-workspace.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(projDir, 'apps'))).toBe(true);
    expect(fs.existsSync(path.join(projDir, 'packages'))).toBe(true);
    expect(fs.existsSync(path.join(projDir, 'README.md'))).toBe(true);
  });

  it('create (workspace): scaffolds a frontend app (framework select + options)', async () => {
    await inWorkspace(ws.dir, async () => {
      const { createProject } = await import('../../src/commands/create');
      // createWorkspace prompts in order: [useTemplate -> 'no', framework]
      prompts.inject(['no', 'react-ts']);
      await createProject('Store Front', {
        type: 'app',
        port: '4000',
        route: '/store',
        org: 'acme',
        packageManager: 'pnpm',
      });
    });

    const appPkg = fs.readJsonSync(
      path.join(ws.dir, 'apps', 'store-front', 'package.json')
    );
    expect(appPkg.name).toContain('store-front');
  });

  it('add: adds a microfrontend to an existing project (template select + route text)', async () => {
    // Set up a minimal existing Re-Shell project so add detects it.
    fs.writeJsonSync(path.join(ws.dir, 'package.json'), {
      name: 'host',
      workspaces: ['apps/*'],
    });
    fs.ensureDirSync(path.join(ws.dir, 'apps'));

    await inWorkspace(ws.dir, async () => {
      const { addMicrofrontend } = await import('../../src/commands/add');
      // add prompts in order: [template, route]
      prompts.inject(['react-ts', '/dash']);
      await addMicrofrontend('Dash Board', { org: 'acme' });
    });

    const mfPkg = fs.readJsonSync(
      path.join(ws.dir, 'apps', 'dash-board', 'package.json')
    );
    expect(mfPkg.name).toBe('@acme/dash-board');
    expect(mfPkg.reshell.route).toBe('/dash');
    expect(mfPkg.reshell.type).toBe('microfrontend');
    expect(fs.existsSync(path.join(ws.dir, 'apps', 'dash-board', 'src'))).toBe(true);
  });

  it('template wizard: creates a built-in template (source -> type -> package manager)', async () => {
    await inWorkspace(ws.dir, async () => {
      const { manageTemplates } = await import('../../src/commands/template');
      // createTemplate: [source]; createBuiltinTemplate: [type, packageManager]
      prompts.inject(['builtin', 'react-project', 'pnpm']);
      await manageTemplates({ create: true });
    });

    const tplDir = path.join(ws.dir, '.re-shell', 'templates');
    expect(fs.existsSync(tplDir)).toBe(true);
    const files = fs.readdirSync(tplDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('.template.yaml'))).toBe(true);

    const content = fs.readFileSync(path.join(tplDir, files[0]), 'utf8');
    expect(content).toContain('react');
  });
});
