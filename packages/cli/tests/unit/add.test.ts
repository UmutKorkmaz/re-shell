import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';
import * as fsExtra from 'fs-extra';
import { addMicrofrontend } from '../../src/commands/add';

// Covers src/commands/add.ts (518 lines) — the `add` command scaffolds a new
// microfrontend (package.json, vite config, entry, html, README, .gitignore)
// under apps/<name> in a Re-Shell project or standalone in the cwd. All file
// writes run against a real temp root (process.cwd spy); fs-extra's
// existsSync is virtualized for the RELATIVE 'package.json'/'apps'/'packages'
// probes because the real node process cwd would resolve them against the
// vitest worker dir, not the temp root.

const mocks = vi.hoisted(() => ({
  prompts: vi.fn(),
  virtualDirs: new Set<string>(),
}));

vi.mock('prompts', () => ({ default: mocks.prompts }));

vi.mock('fs-extra', async importOriginal => {
  const actual = await importOriginal<typeof import('fs-extra')>();
  const spread = { ...actual };
  return {
    ...spread,
    mkdirSync: actual.mkdirSync,
    writeFileSync: actual.writeFileSync,
    readdirSync: actual.readdirSync,
    readFileSync: actual.readFileSync,
    ensureDirSync: actual.ensureDirSync,
    writeJsonSync: actual.writeJsonSync,
    emptyDirSync: actual.emptyDirSync,
    removeSync: actual.removeSync,
    existsSync: (p: string) => {
      if (mocks.virtualDirs.has(p)) return true;
      return actual.existsSync(p);
    },
  };
});

const TMP = fsReal.mkdtempSync(path.join(os.tmpdir(), 'reshell-add-'));
let logSpy: ReturnType<typeof vi.spyOn>;
let cwdSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prompts.mockResolvedValue({});
  mocks.virtualDirs.clear();
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  // add.ts resolves paths against process.cwd(); redirect it to the temp root
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(TMP);
});

afterEach(() => {
  logSpy.mockRestore();
  cwdSpy.mockRestore();
  fsExtra.emptyDirSync(TMP);
  mocks.virtualDirs.clear();
});

afterAll(() => {
  fsReal.rmSync(TMP, { recursive: true, force: true });
});

/** Stage a Re-Shell project skeleton inside the temp root. */
function stageProject(withAppsDir = true): void {
  const dir = withAppsDir ? 'apps' : 'packages';
  fsExtra.ensureDirSync(path.join(TMP, dir));
  fsReal.writeFileSync(path.join(TMP, 'package.json'), JSON.stringify({ name: 'root' }));
  mocks.virtualDirs.add('package.json');
  mocks.virtualDirs.add(dir);
}

function readJson(p: string): Record<string, unknown> {
  return JSON.parse(fsReal.readFileSync(p, 'utf8'));
}

describe('addMicrofrontend', () => {
  it('rejects names containing path separators or traversal', async () => {
    await expect(addMicrofrontend('evil/name', {})).rejects.toThrow(
      'must not contain path separators'
    );
    await expect(addMicrofrontend('..', {})).rejects.toThrow(
      'must not contain path separators'
    );
    await expect(addMicrofrontend('a\\b', {})).rejects.toThrow(
      'must not contain path separators'
    );
  });

  it('normalizes the name to kebab-case and scaffolds under apps/', async () => {
    stageProject();
    await addMicrofrontend('My Feature', { template: 'react', route: '/my-feature' });

    const mfPath = path.join(TMP, 'apps', 'my-feature');
    expect(fsReal.existsSync(mfPath)).toBe(true);
    expect(fsReal.existsSync(path.join(mfPath, 'src'))).toBe(true);
    expect(fsReal.existsSync(path.join(mfPath, 'public'))).toBe(true);

    const pkg = readJson(path.join(mfPath, 'package.json'));
    expect(pkg.name).toBe('@re-shell/my-feature');
    expect(pkg.reshell).toEqual({
      type: 'microfrontend',
      route: '/my-feature',
    });
  });

  it('creates a standalone microfrontend outside a Re-Shell project', async () => {
    await addMicrofrontend('solo', { template: 'react', route: '/solo' });

    const mfPath = path.join(TMP, 'solo');
    const pkg = readJson(path.join(mfPath, 'package.json'));
    // No project detected → unscoped name, no apps/ nesting
    expect(pkg.name).toBe('solo');
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain("doesn't appear to be a Re-Shell project");
  });

  it('falls back to the project root when apps/ is missing but packages/ exists', async () => {
    stageProject(false);
    await addMicrofrontend('pkg-mf', { template: 'react', route: '/pkg-mf' });

    const mfPath = path.join(TMP, 'pkg-mf');
    expect(fsReal.existsSync(mfPath)).toBe(true);
    expect(fsReal.existsSync(path.join(TMP, 'apps', 'pkg-mf'))).toBe(false);
  });

  it('adds TypeScript devDependencies and vite.config.ts for the react-ts template', async () => {
    stageProject();
    await addMicrofrontend('ts-mf', { template: 'react-ts', route: '/ts-mf' });

    const mfPath = path.join(TMP, 'apps', 'ts-mf');
    const pkg = readJson(path.join(mfPath, 'package.json'));
    expect(pkg.devDependencies).toMatchObject({
      typescript: '^5.0.0',
      '@types/react': '^18.2.0',
    });
    expect(fsReal.existsSync(path.join(mfPath, 'vite.config.ts'))).toBe(true);
    expect(fsReal.existsSync(path.join(mfPath, 'vite.config.js'))).toBe(false);
  });

  it('writes vite.config.js and no typescript dep for the plain react template', async () => {
    stageProject();
    await addMicrofrontend('js-mf', { template: 'react', route: '/js-mf' });

    const mfPath = path.join(TMP, 'apps', 'js-mf');
    const pkg = readJson(path.join(mfPath, 'package.json'));
    expect(pkg.devDependencies).not.toHaveProperty('typescript');
    expect(fsReal.existsSync(path.join(mfPath, 'vite.config.js'))).toBe(true);
  });

  it('prompts for template and route when omitted and merges the answers', async () => {
    stageProject();
    mocks.prompts.mockResolvedValue({ template: 'react-ts', route: '/from-prompt' });

    await addMicrofrontend('prompted', {});

    const mfPath = path.join(TMP, 'apps', 'prompted');
    const pkg = readJson(path.join(mfPath, 'package.json'));
    expect(pkg.reshell.route).toBe('/from-prompt');
    expect(pkg.devDependencies).toHaveProperty('typescript');
    expect(mocks.prompts).toHaveBeenCalledTimes(1);
  });

  it('cancels when the template prompt is dismissed', async () => {
    stageProject();
    mocks.prompts.mockResolvedValue({}); // Ctrl+C shape
    await addMicrofrontend('cancelled', {});

    expect(fsReal.existsSync(path.join(TMP, 'apps', 'cancelled'))).toBe(false);
    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Operation cancelled.');
  });

  it('prompts before overwriting an existing directory and removes it on overwrite', async () => {
    stageProject();
    const mfPath = path.join(TMP, 'apps', 'dup');
    fsExtra.ensureDirSync(path.join(mfPath, 'stale'));

    mocks.prompts.mockResolvedValue({ action: 'overwrite' });
    await addMicrofrontend('dup', { template: 'react', route: '/dup' });

    // stale marker gone, fresh scaffold present
    expect(fsReal.existsSync(path.join(mfPath, 'stale'))).toBe(false);
    expect(fsReal.existsSync(path.join(mfPath, 'package.json'))).toBe(true);
  });

  it('cancels when the overwrite prompt answers cancel', async () => {
    stageProject();
    const mfPath = path.join(TMP, 'apps', 'dup2');
    fsExtra.ensureDirSync(path.join(mfPath, 'keepme'));

    mocks.prompts.mockResolvedValue({ action: 'cancel' });
    await addMicrofrontend('dup2', { template: 'react', route: '/dup2' });

    expect(fsReal.existsSync(path.join(mfPath, 'keepme'))).toBe(true);
    expect(fsReal.existsSync(path.join(mfPath, 'package.json'))).toBe(false);
  });

  it('embeds the port, team and custom org into the scaffold', async () => {
    stageProject();
    await addMicrofrontend('conf', {
      template: 'react',
      route: '/conf',
      port: '8080',
      team: 'platform',
      org: 'ACME',
      description: 'Custom description',
    });

    const mfPath = path.join(TMP, 'apps', 'conf');
    const pkg = readJson(path.join(mfPath, 'package.json'));
    expect(pkg.name).toBe('@acme/conf');
    expect(pkg.author).toBe('platform');
    expect(pkg.description).toBe('Custom description');
    expect(String(pkg.scripts.dev)).toContain('8080');

    const vite = fsReal.readFileSync(path.join(mfPath, 'vite.config.js'), 'utf8');
    expect(vite).toContain('8080');
  });

  it('references the generated scope peer dependency inside a project', async () => {
    stageProject();
    await addMicrofrontend('peer', { template: 'react', route: '/peer' });

    const pkg = readJson(path.join(TMP, 'apps', 'peer', 'package.json'));
    expect(pkg.peerDependencies).toEqual({ '@re-shell/core': '^0.1.0' });
  });

  it('writes the README, .gitignore, public/index.html and src entry files', async () => {
    stageProject();
    await addMicrofrontend('docs', { template: 'react-ts', route: '/docs' });

    const mfPath = path.join(TMP, 'apps', 'docs');
    const readme = fsReal.readFileSync(path.join(mfPath, 'README.md'), 'utf8');
    expect(readme).toContain('# docs');
    expect(readme).toContain('/apps/docs/dist/mf.umd.js');
    expect(readme).toContain('route');

    expect(fsReal.existsSync(path.join(mfPath, '.gitignore'))).toBe(true);
    expect(fsReal.existsSync(path.join(mfPath, 'public', 'index.html'))).toBe(true);
    expect(fsReal.readdirSync(path.join(mfPath, 'src')).length).toBeGreaterThan(0);
  });

  it('suggests shell integration when apps/shell/src/App.tsx exists', async () => {
    stageProject();
    fsExtra.ensureDirSync(path.join(TMP, 'apps', 'shell', 'src'));
    fsExtra.writeFileSync(path.join(TMP, 'apps', 'shell', 'src', 'App.tsx'), 'export {}');

    await addMicrofrontend('integrated', { template: 'react', route: '/integrated' });

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('Found shell application');
    expect(out).toContain('Consider updating the shell application');
  });

  it('prints the created path and numbered next steps', async () => {
    stageProject();
    await addMicrofrontend('steps', { template: 'react', route: '/steps' });

    const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(out).toContain('created successfully at');
    expect(out).toContain('cd apps/steps');
    expect(out).toContain('npm install');
    expect(out).toContain('npm run dev');
  });

  it('pauses and resumes the spinner around prompts and file writes', async () => {
    stageProject();
    const spinner = {
      stop: vi.fn(),
      start: vi.fn(),
      setText: vi.fn(),
    };

    mocks.prompts.mockResolvedValue({ action: 'overwrite' });
    // First create a directory so the overwrite path (second prompt) fires
    fsExtra.ensureDirSync(path.join(TMP, 'apps', 'spin'));
    await addMicrofrontend('spin', { template: 'react', route: '/spin', spinner: spinner as never });

    expect(spinner.stop).toHaveBeenCalled();
    expect(spinner.start).toHaveBeenCalled();
    expect(spinner.setText).toHaveBeenCalledWith('Creating microfrontend files...');
  });
});
