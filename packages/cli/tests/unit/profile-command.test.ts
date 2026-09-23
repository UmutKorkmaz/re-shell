import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'yaml';
import prompts from 'prompts';
import {
  manageProfiles,
  loadProfileConfig,
  saveProfileConfig,
  getActiveProfile,
  applyFrameworkDefaults,
  resolveProfile,
  validateProfileInheritance,
  composeProfiles,
  getProfileTree,
  exportProfile,
  switchProfile,
  deactivateProfile,
  getActiveProfileWithContext,
  validateCurrentContext,
  listProfileContexts,
  validateProfileCrossLanguage,
  validateAllProfiles,
  cloneProfile,
  customizeProfile,
} from '../../src/commands/profile';
import type { EnvironmentProfile, ProfileConfig } from '../../src/commands/profile';

// Covers src/commands/profile.ts (2633 lines, 20 exports) against a REAL
// re-shell.profiles.yaml in a temp cwd: manageProfiles dispatch (create/
// delete/activate/show/list), the config load/save round-trip, framework
// defaults, inheritance resolution + validation (circular deps, override
// conflicts), composition, profile trees, export chains, switch/deactivate
// context persistence + snapshotting, cross-language validation, and the
// clone/customize mutators. Only prompts is mocked — everything else runs
// the real implementation against real files.

vi.mock('prompts', () => ({ default: vi.fn() }));
const promptsMock = vi.mocked(prompts);

let tempRoot: string;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

function output(): string {
  return logSpy.mock.calls.map(c => c.map(String).join(' ')).join('\n');
}

function profile(overrides: Partial<EnvironmentProfile> = {}): EnvironmentProfile {
  return {
    name: 'dev',
    description: 'Development profile',
    environment: 'development',
    config: { dev: { port: 3000, host: 'localhost' }, env: { NODE_ENV: 'development' } },
    ...overrides,
  };
}

async function stageConfig(config: ProfileConfig): Promise<void> {
  await fs.writeFile(
    path.join(tempRoot, 're-shell.profiles.yaml'),
    yaml.stringify(config),
    'utf8'
  );
}

async function readStagedConfig(): Promise<ProfileConfig> {
  const raw = await fs.readFile(
    path.join(tempRoot, 're-shell.profiles.yaml'),
    'utf8'
  );
  return yaml.parse(raw);
}

describe('profile — command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-profile-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    vi.restoreAllMocks();
    fs.removeSync(tempRoot);
  });

  describe('config load/save', () => {
    it('returns an empty config when no file exists', async () => {
      expect(await loadProfileConfig()).toEqual({ profiles: {} });
    });

    it('round-trips profiles and the active marker through YAML', async () => {
      await saveProfileConfig({
        activeProfile: 'dev',
        profiles: { dev: profile() },
      });
      const loaded = await loadProfileConfig();
      expect(loaded.activeProfile).toBe('dev');
      expect(loaded.profiles.dev.config.dev?.port).toBe(3000);
    });
  });

  describe('manageProfiles — list (default)', () => {
    it('suggests creating a profile when none exist', async () => {
      await manageProfiles({});
      expect(output()).toContain('No profiles found');
      expect(output()).toContain('re-shell profile create');
    });

    it('marks the active profile and renders metadata', async () => {
      await stageConfig({
        activeProfile: 'dev',
        profiles: {
          dev: profile(),
          prod: profile({
            name: 'prod',
            environment: 'production',
            framework: 'react',
            extends: ['dev'],
            description: 'Prod profile',
          }),
        },
      });
      await manageProfiles({ list: true });
      expect(output()).toContain('→  dev (active)');
      expect(output()).toContain('prod');
      expect(output()).toContain('Environment: production');
      expect(output()).toContain('Framework: react');
      expect(output()).toContain('Extends: dev');
      expect(output()).toContain('Active profile: dev');
    });

    it('reports "None" when no profile is active', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      await manageProfiles({});
      expect(output()).toContain('Active profile: None');
    });
  });

  describe('manageProfiles — delete', () => {
    it('warns for an unknown profile', async () => {
      await manageProfiles({ delete: 'ghost' });
      expect(output()).toContain('Profile "ghost" not found');
      expect((await loadProfileConfig()).profiles).toEqual({});
    });

    it('cancels when confirmation is declined', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      promptsMock.mockResolvedValueOnce({ value: false } as never);
      await manageProfiles({ delete: 'dev' });
      expect(output()).toContain('cancelled');
      expect((await loadProfileConfig()).profiles.dev).toBeDefined();
    });

    it('deletes the profile and clears an active marker pointing at it', async () => {
      await stageConfig({
        activeProfile: 'dev',
        profiles: { dev: profile(), other: profile({ name: 'other' }) },
      });
      promptsMock.mockResolvedValueOnce({ value: true } as never);
      await manageProfiles({ delete: 'dev' });
      const config = await loadProfileConfig();
      expect(config.profiles.dev).toBeUndefined();
      expect(config.profiles.other).toBeDefined();
      expect(config.activeProfile).toBeUndefined();
    });
  });

  describe('manageProfiles — activate', () => {
    it('warns for an unknown profile', async () => {
      await manageProfiles({ activate: 'ghost' });
      expect(output()).toContain('Profile "ghost" not found');
    });

    it('switches, persists the context files and marks the config', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      const result = await manageProfiles({ activate: 'dev' });
      void result;
      const config = await loadProfileConfig();
      expect(config.activeProfile).toBe('dev');
      expect(await fs.pathExists(path.join(tempRoot, '.re-shell-profile'))).toBe(true);
      expect(
        await fs.pathExists(path.join(tempRoot, '.re-shell', 'profile-context.json'))
      ).toBe(true);
    });

    it('writes .env.local from the profile env vars on activation', async () => {
      await stageConfig({
        profiles: { dev: profile({ config: { env: { NODE_ENV: 'development', PORT: '3000' } } }) },
      });
      await manageProfiles({ activate: 'dev' });
      const env = await fs.readFile(path.join(tempRoot, '.env.local'), 'utf8');
      expect(env).toContain('# Generated by Re-Shell profile: dev');
      expect(env).toContain('NODE_ENV=development');
      expect(env).toContain('PORT=3000');
    });

    it('reports switch warnings surface-level', async () => {
      // child extends parent but overrides a parent setting → conflict warning
      await stageConfig({
        profiles: {
          parent: profile({ name: 'parent', config: { dev: { port: 3000 } } }),
          child: profile({
            name: 'child',
            extends: ['parent'],
            config: { dev: { port: 8080 } },
          }),
        },
      });
      await manageProfiles({ activate: 'child' });
      expect(output()).toContain('Warnings:');
      expect(output()).toContain('Override conflict');
    });
  });

  describe('manageProfiles — show', () => {
    it('warns for an unknown profile', async () => {
      await manageProfiles({ show: 'ghost' });
      expect(output()).toContain('Profile "ghost" not found');
    });

    it('renders build/dev/env sections', async () => {
      await stageConfig({
        profiles: {
          full: profile({
            name: 'full',
            environment: 'production',
            framework: 'react',
            extends: ['dev'],
            config: {
              build: { target: 'es2020', optimize: true, sourcemap: false, minify: true },
              dev: { port: 8080, host: '0.0.0.0', hmr: false, cors: true },
              env: { NODE_ENV: 'production', API_KEY: 'secret' },
            },
          }),
          dev: profile(),
        },
      });
      await manageProfiles({ show: 'full' });
      expect(output()).toContain('Profile: full');
      expect(output()).toContain('Environment: production');
      expect(output()).toContain('Extends: dev');
      expect(output()).toContain('Target: es2020');
      expect(output()).toContain('Minify: true');
      expect(output()).toContain('Port: 8080');
      expect(output()).toContain('HMR: false');
      expect(output()).toContain('NODE_ENV=production');
    });
  });

  describe('manageProfiles — create (wizard)', () => {
    it('cancels at the first prompt', async () => {
      promptsMock.mockResolvedValueOnce({} as never);
      await manageProfiles({ create: true });
      expect(output()).toContain('cancelled');
      expect((await loadProfileConfig()).profiles).toEqual({});
    });

    it('persists a minimal profile when every optional step is skipped', async () => {
      promptsMock
        .mockResolvedValueOnce({ name: 'minimal', description: 'Minimal profile' } as never)
        .mockResolvedValueOnce({ environment: 'development', framework: null } as never)
        .mockResolvedValueOnce({ configureBuild: false } as never)
        .mockResolvedValueOnce({ configureDev: false } as never)
        .mockResolvedValueOnce({ configureTest: false } as never)
        .mockResolvedValueOnce({ configureEnv: false } as never)
        .mockResolvedValueOnce({ configureScripts: false } as never)
        .mockResolvedValueOnce({ configureDeps: false } as never)
        .mockResolvedValueOnce({ configureServices: false } as never)
        // existing profile list is empty → no extends prompt
        .mockResolvedValueOnce({ priority: 0 } as never);

      await manageProfiles({ create: true });

      const config = await readStagedConfig();
      expect(config.profiles.minimal).toMatchObject({
        name: 'minimal',
        environment: 'development',
        priority: 0,
      });
      expect(config.profiles.minimal.config).toEqual({});
      expect(output()).toContain('Profile Created Successfully');
      expect(output()).toContain('re-shell profile activate minimal');
    });

    it('persists every configured section and inheritance', async () => {
      await stageConfig({ profiles: { base: profile() } });
      promptsMock
        .mockResolvedValueOnce({ name: 'rich', description: 'Rich' } as never)
        .mockResolvedValueOnce({ environment: 'production', framework: 'react' } as never)
        .mockResolvedValueOnce({ configureBuild: true } as never)
        .mockResolvedValueOnce({
          target: 'es2020', optimize: true, sourcemap: false, minify: true,
        } as never)
        .mockResolvedValueOnce({ configureDev: true } as never)
        .mockResolvedValueOnce({ port: 3002, host: 'localhost', hmr: false, cors: true } as never)
        .mockResolvedValueOnce({ configureTest: true } as never)
        .mockResolvedValueOnce({ coverage: 85, parallel: false, timeout: 10000 } as never)
        .mockResolvedValueOnce({ configureEnv: true } as never)
        .mockResolvedValueOnce({ key: 'NODE_ENV' } as never)
        .mockResolvedValueOnce({ value: 'production' } as never)
        .mockResolvedValueOnce({ key: '' } as never) // stop env loop
        .mockResolvedValueOnce({ configureScripts: true } as never)
        .mockResolvedValueOnce({ name: 'deploy' } as never)
        .mockResolvedValueOnce({ command: 'npm run build' } as never)
        .mockResolvedValueOnce({ name: '' } as never) // stop script loop
        .mockResolvedValueOnce({ configureDeps: true } as never)
        .mockResolvedValueOnce({ name: 'lodash' } as never)
        .mockResolvedValueOnce({ version: '^4.0.0' } as never)
        .mockResolvedValueOnce({ name: '' } as never) // stop dep loop
        .mockResolvedValueOnce({ configureServices: true } as never)
        .mockResolvedValueOnce({ services: ['web', 'database'] } as never)
        .mockResolvedValueOnce({ configureExtends: true } as never)
        .mockResolvedValueOnce({ extends: ['base'] } as never)
        .mockResolvedValueOnce({ priority: 10 } as never);

      await manageProfiles({ create: true });

      const config = await readStagedConfig();
      expect(config.profiles.rich).toMatchObject({
        framework: 'react',
        environment: 'production',
        extends: ['base'],
        priority: 10,
      });
      expect(config.profiles.rich.config).toEqual({
        build: { target: 'es2020', optimize: true, sourcemap: false, minify: true },
        dev: { port: 3002, host: 'localhost', hmr: false, cors: true },
        test: { coverage: 85, parallel: false, timeout: 10000 },
        env: { NODE_ENV: 'production' },
        scripts: { deploy: 'npm run build' },
        dependencies: { lodash: '^4.0.0' },
        services: ['web', 'database'],
      });
      expect(output()).toContain('Build Config');
      expect(output()).toContain('1 Env Vars');
      expect(output()).toContain('2 Services');
      expect(output()).toContain('Extends 1 Profiles');
    });
  });

  describe('getActiveProfile / applyFrameworkDefaults', () => {
    it('returns null when nothing is active', async () => {
      expect(await getActiveProfile()).toBeNull();
    });

    it('returns the active profile object', async () => {
      await stageConfig({ activeProfile: 'dev', profiles: { dev: profile() } });
      expect((await getActiveProfile())?.name).toBe('dev');
    });

    it('returns null when the active marker dangles', async () => {
      await stageConfig({ activeProfile: 'ghost', profiles: { dev: profile() } });
      expect(await getActiveProfile()).toBeNull();
    });

    it('serves built-in react defaults', async () => {
      expect(await applyFrameworkDefaults('react')).toEqual({
        dev: { port: 3000, hmr: true },
        build: { target: 'es2020', sourcemap: true },
      });
    });

    it('serves distinct built-in defaults per framework', async () => {
      expect((await applyFrameworkDefaults('vue')).dev?.port).toBe(8080);
      expect((await applyFrameworkDefaults('svelte')).dev?.port).toBe(5000);
      expect((await applyFrameworkDefaults('express')).build?.sourcemap).toBe(false);
    });

    it('prefers user-configured framework defaults over built-ins', async () => {
      await stageConfig({
        profiles: {},
        frameworkDefaults: { react: { dev: { port: 9999 } } },
      });
      expect(await applyFrameworkDefaults('react')).toEqual({ dev: { port: 9999 } });
    });

    it('returns an empty object for unknown frameworks', async () => {
      expect(await applyFrameworkDefaults('zig')).toEqual({});
    });
  });

  describe('resolveProfile (inheritance)', () => {
    it('returns null for an unknown profile', async () => {
      expect(await resolveProfile('ghost')).toBeNull();
    });

    it('returns a non-inheriting profile as-is', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      expect(await resolveProfile('dev')).toEqual(profile());
    });

    it('merges parent config under child config', async () => {
      await stageConfig({
        profiles: {
          parent: profile({ name: 'parent', config: { dev: { port: 3000, hmr: true }, env: { A: '1' } } }),
          child: profile({
            name: 'child',
            extends: ['parent'],
            config: { dev: { port: 8080 } },
          }),
        },
      });
      const resolved = await resolveProfile('child');
      expect(resolved?.config.dev).toEqual({ port: 8080, hmr: true }); // child wins, parent's hmr kept
      expect(resolved?.config.env).toEqual({ A: '1' }); // parent-only section inherited
    });

    it('applies framework defaults beneath inherited config (extends required)', async () => {
      await stageConfig({
        profiles: {
          child: profile({
            name: 'child',
            framework: 'react',
            extends: [],
            config: { dev: { port: 4000 } },
          }),
        },
      });
      // QUIRK: a profile without parents returns AS-IS from resolveProfile —
      // framework defaults are only merged on the inheritance path. Force that
      // path by giving the profile a real parent.
      const config = await readStagedConfig();
      config.profiles.child.extends = ['base'];
      config.profiles.base = profile({ name: 'base', config: {} });
      await stageConfig(config);

      const resolved = await resolveProfile('child');
      expect(resolved?.config.build).toEqual({ target: 'es2020', sourcemap: true });
      expect(resolved?.config.dev?.port).toBe(4000);
      expect(resolved?.config.dev?.hmr).toBe(true);
    });

    it('resolves multi-level chains with the deepest parent first', async () => {
      await stageConfig({
        profiles: {
          base: profile({ name: 'base', config: { env: { LEVEL: 'base' } } }),
          mid: profile({ name: 'mid', extends: ['base'], config: { env: { LEVEL: 'mid', EXTRA: 'yes' } } }),
          top: profile({ name: 'top', extends: ['mid'], config: { env: { LEVEL: 'top' } } }),
        },
      });
      const resolved = await resolveProfile('top');
      expect(resolved?.config.env).toEqual({ LEVEL: 'top', EXTRA: 'yes' });
    });

    it('throws on circular dependency chains', async () => {
      await stageConfig({
        profiles: {
          a: profile({ name: 'a', extends: ['b'] }),
          b: profile({ name: 'b', extends: ['a'] }),
        },
      });
      await expect(resolveProfile('a')).rejects.toThrow('Circular profile dependency');
    });
  });

  describe('validateProfileInheritance', () => {
    it('accepts a self-contained profile', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      expect(await validateProfileInheritance('dev')).toEqual({
        valid: true, errors: [], warnings: [],
      });
    });

    it('reports an error for an unknown profile', async () => {
      const result = await validateProfileInheritance('ghost');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not found');
    });

    it('detects circular dependencies as errors', async () => {
      await stageConfig({
        profiles: {
          a: profile({ name: 'a', extends: ['b'] }),
          b: profile({ name: 'b', extends: ['a'] }),
        },
      });
      const result = await validateProfileInheritance('a');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Circular dependency');
    });

    it('warns about override conflicts with differing values', async () => {
      await stageConfig({
        profiles: {
          parent: profile({ name: 'parent', config: { dev: { port: 3000 } } }),
          child: profile({ name: 'child', extends: ['parent'], config: { dev: { port: 8080 } } }),
        },
      });
      const result = await validateProfileInheritance('child');
      expect(result.valid).toBe(true);
      expect(result.warnings[0]).toContain('Override conflict');
      expect(result.warnings[0]).toContain('dev.port');
    });

    it('stays silent when the override matches the parent value', async () => {
      await stageConfig({
        profiles: {
          parent: profile({ name: 'parent', config: { dev: { port: 3000 } } }),
          child: profile({ name: 'child', extends: ['parent'], config: { dev: { port: 3000 } } }),
        },
      });
      const result = await validateProfileInheritance('child');
      expect(result.warnings).toEqual([]);
    });
  });

  describe('composeProfiles / getProfileTree / exportProfile', () => {
    it('composes profiles in array order with later entries winning', async () => {
      await stageConfig({
        profiles: {
          a: profile({ name: 'a', config: { dev: { port: 1111 }, env: { FROM_A: '1' } } }),
          b: profile({ name: 'b', config: { dev: { port: 2222 } } }),
        },
      });
      const composed = await composeProfiles(['a', 'b']);
      expect(composed.dev?.port).toBe(2222);
      expect(composed.env).toEqual({ FROM_A: '1' });
    });

    it('returns an empty config for an empty list', async () => {
      expect(await composeProfiles([])).toEqual({});
    });

    it('skips unknown profiles during composition', async () => {
      await stageConfig({ profiles: { a: profile({ name: 'a', config: { env: { X: '1' } } }) } });
      expect(await composeProfiles(['ghost', 'a'])).toEqual({ env: { X: '1' } });
    });

    it('builds a recursive inheritance tree with depth', async () => {
      await stageConfig({
        profiles: {
          top: profile({ name: 'top', extends: ['mid', 'side'] }),
          mid: profile({ name: 'mid', extends: ['base'] }),
          side: profile({ name: 'side' }),
          base: profile({ name: 'base' }),
        },
      });
      const tree = await getProfileTree('top');
      expect(tree.name).toBe('top');
      expect(tree.depth).toBe(2);
      expect(tree.children.map((c: { name: string }) => c.name).sort()).toEqual(['mid', 'side']);
      const mid = tree.children.find((c: { name: string }) => c.name === 'mid') as {
        children: { name: string }[];
      };
      expect(mid.children[0].name).toBe('base');
    });

    it('throws when the tree root does not exist', async () => {
      await expect(getProfileTree('ghost')).rejects.toThrow('not found');
    });

    it('exports the base profile with its full inheritance chain', async () => {
      await stageConfig({
        profiles: {
          top: profile({ name: 'top', extends: ['mid'], config: { dev: { port: 9000 } } }),
          mid: profile({ name: 'mid', extends: ['base'], config: { env: { M: '1' } } }),
          base: profile({ name: 'base', config: { env: { B: '1' } } }),
        },
      });
      const exported = await exportProfile('top');
      expect(exported.profile.name).toBe('top');
      expect(exported.inheritedFrom.sort()).toEqual(['base', 'mid']);
      // resolved config merges the whole chain
      expect(exported.finalConfig.env).toEqual({ M: '1', B: '1' });
      expect(exported.finalConfig.dev?.port).toBe(9000);
    });

    it('rejects exporting an unknown profile', async () => {
      await expect(exportProfile('ghost')).rejects.toThrow('not found');
    });
  });

  describe('switchProfile / deactivateProfile (context state)', () => {
    it('switches successfully and persists context', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      const result = await switchProfile('dev');
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      const config = await loadProfileConfig();
      expect(config.activeProfile).toBe('dev');
    });

    it('fails for an unknown target profile', async () => {
      const result = await switchProfile('ghost');
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Profile "ghost" not found');
    });

    it('deactivates the previous profile when switching', async () => {
      await stageConfig({
        profiles: { dev: profile(), prod: profile({ name: 'prod', environment: 'production' }) },
      });
      await switchProfile('dev');
      const result = await switchProfile('prod');
      expect(result.success).toBe(true);
      expect(result.warnings.join(' ')).toContain('Deactivated previous profile: dev');
      expect((await loadProfileConfig()).activeProfile).toBe('prod');
    });

    it('blocks the switch on validation errors unless forced', async () => {
      await stageConfig({
        profiles: {
          a: profile({ name: 'a', extends: ['b'] }),
          b: profile({ name: 'b', extends: ['a'] }),
        },
      });
      const blocked = await switchProfile('a');
      expect(blocked.success).toBe(false);
      expect(blocked.errors[0]).toContain('Circular dependency');

      const forced = await switchProfile('a', { force: true });
      expect(forced.success).toBe(true);
      expect(forced.warnings.join(' ')).toContain('Forced switch despite validation errors');
    });

    it('persists a snapshot-validated context on switch', async () => {
      await fs.writeFile(path.join(tempRoot, 'package.json'), '{"name":"ws"}', 'utf8');
      await stageConfig({ profiles: { dev: profile() } });
      await switchProfile('dev');
      const context = await getActiveProfileWithContext();
      expect(context.context?.profileName).toBe('dev');
      expect(context.context?.validated).toBe(true);
      expect(context.context?.validationHash).toBeDefined();
      expect(context.profile?.name).toBe('dev');
    });

    it('skips snapshot validation when workspace files cannot be read', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      await switchProfile('dev');
      const context = await getActiveProfileWithContext();
      expect(context.context?.validated).toBe(true); // package.json absent → still valid
    });

    it('validateCurrentContext flags missing profiles and drift', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      await switchProfile('dev');
      expect((await validateCurrentContext()).valid).toBe(true);

      // Simulate drift: mutate the snapshotted package.json
      await fs.writeFile(path.join(tempRoot, 'package.json'), '{"name":"changed"}', 'utf8');
      const drifted = await validateCurrentContext();
      expect(drifted.snapshotMatches).toBe(false);
      expect(drifted.warnings.join(' ')).toContain('Workspace state has changed');

      // Simulate profile deletion → context dangles
      await stageConfig({ profiles: {} });
      const orphaned = await validateCurrentContext();
      expect(orphaned.profileMatches).toBe(false);
      expect(orphaned.warnings.join(' ')).toContain('no longer exists');
    });

    it('returns a trivially-valid context when none is persisted', async () => {
      const result = await validateCurrentContext();
      expect(result).toEqual({
        valid: true, profileMatches: true, snapshotMatches: true, warnings: [],
      });
    });

    it('deactivate removes context files, clears the marker and deletes generated .env.local', async () => {
      await stageConfig({
        activeProfile: 'dev',
        profiles: { dev: profile({ config: { env: { NODE_ENV: 'development' } } }) },
      });
      await switchProfile('dev');
      expect(await fs.pathExists(path.join(tempRoot, '.env.local'))).toBe(true);

      await deactivateProfile('dev');

      expect(await fs.pathExists(path.join(tempRoot, '.re-shell-profile'))).toBe(false);
      expect(
        await fs.pathExists(path.join(tempRoot, '.re-shell', 'profile-context.json'))
      ).toBe(false);
      expect(await fs.pathExists(path.join(tempRoot, '.env.local'))).toBe(false);
      expect((await loadProfileConfig()).activeProfile).toBeUndefined();
    });

    it('leaves a user-authored .env.local untouched on deactivate', async () => {
      await fs.writeFile(path.join(tempRoot, '.env.local'), 'MY_OWN=var', 'utf8');
      await stageConfig({ profiles: { dev: profile() } });
      await switchProfile('dev');
      // re-write as user content (no generator marker)
      await fs.writeFile(path.join(tempRoot, '.env.local'), 'MY_OWN=var', 'utf8');
      await deactivateProfile('dev');
      expect(await fs.pathExists(path.join(tempRoot, '.env.local'))).toBe(true);
    });

    it('deactivate is a no-op for a profile that is not active', async () => {
      await stageConfig({
        activeProfile: 'dev',
        profiles: { dev: profile(), other: profile({ name: 'other' }) },
      });
      await deactivateProfile('other');
      expect((await loadProfileConfig()).activeProfile).toBe('dev');
    });

    it('lists the workspace context when an indicator file exists', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      expect(await listProfileContexts()).toEqual([]);

      await switchProfile('dev');
      const contexts = await listProfileContexts();
      expect(contexts).toHaveLength(1);
      expect(contexts[0]).toMatchObject({
        workspacePath: tempRoot,
        profileName: 'dev',
        validated: true,
      });
      expect(contexts[0].activatedAt).toBeGreaterThan(0);
    });
  });

  describe('cross-language validation', () => {
    it('errors for an unknown profile', async () => {
      const result = await validateProfileCrossLanguage('ghost');
      expect(result.valid).toBe(false);
      expect(result.language).toBeNull();
      expect(result.errors[0]).toContain('not found');
    });

    it('detects no language without a framework', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      const result = await validateProfileCrossLanguage('dev');
      expect(result.language).toBeNull();
      expect(result.valid).toBe(true);
    });

    it('warns about recommended files for typescript projects', async () => {
      // react → typescript; missing tsconfig.json is a WARNING, not an error
      await stageConfig({
        profiles: { dev: profile({ framework: 'react' }) },
      });
      const result = await validateProfileCrossLanguage('dev');
      expect(result.language).toBe('typescript');
      expect(result.valid).toBe(true);
      expect(result.warnings.join(' ')).toContain('tsconfig.json');
    });

    it('errors on an invalid TypeScript build target', async () => {
      // Hard error: the TS rule rejects unknown build targets outright.
      await stageConfig({
        profiles: {
          dev: profile({
            framework: 'react',
            config: { build: { target: 'es9999', sourcemap: true } },
          }),
        },
      });
      const result = await validateProfileCrossLanguage('dev');
      expect(result.language).toBe('typescript');
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toContain('Invalid TypeScript build target: es9999');
    });

    it('warns about sourcemaps-off and HMR-off in development', async () => {
      await stageConfig({
        profiles: {
          dev: profile({
            framework: 'react',
            config: {
              build: { target: 'es2020', sourcemap: false },
              dev: { port: 3000, hmr: false },
            },
          }),
        },
      });
      const result = await validateProfileCrossLanguage('dev');
      expect(result.valid).toBe(true);
      expect(result.warnings.join(' ')).toContain('Sourcemaps disabled in development');
      expect(result.warnings.join(' ')).toContain('Hot Module Replacement disabled');
    });

    it('warns when a backend profile has no dev port', async () => {
      await stageConfig({
        profiles: { dev: profile({ framework: 'express', config: {} }) },
      });
      const result = await validateProfileCrossLanguage('dev');
      expect(result.warnings.join(' ')).toContain('No development port specified');
    });

    it('recommends missing dependencies when package.json exists', async () => {
      // Dependency advice is warning+suggestion grade, gated on package.json.
      await fs.writeFile(
        path.join(tempRoot, 'package.json'),
        JSON.stringify({ name: 'ws', dependencies: { react: '^18.0.0' } }),
        'utf8'
      );
      await stageConfig({
        profiles: { dev: profile({ framework: 'react' }) },
      });
      const result = await validateProfileCrossLanguage('dev');
      expect(result.valid).toBe(true);
      expect(result.warnings.join(' ')).toContain('Recommended dependency not installed: typescript');
      expect(result.suggestions.join(' ')).toContain('npm install typescript');
    });

    it('detects python from framework and recommends its files', async () => {
      await stageConfig({
        profiles: { dev: profile({ framework: 'fastapi', environment: 'development' }) },
      });
      const result = await validateProfileCrossLanguage('dev');
      expect(result.language).toBe('python');
      expect(result.valid).toBe(true);
      expect(result.warnings.join(' ')).toContain('requirements.txt');
    });

    it('validates all profiles and aggregates a summary', async () => {
      await stageConfig({
        profiles: {
          plain: profile(),
          ts: profile({
            name: 'ts',
            framework: 'react',
            config: { build: { target: 'es9999' } },
          }),
        },
      });
      const { profiles, summary } = await validateAllProfiles();
      expect(summary.total).toBe(2);
      expect(summary.valid).toBe(1);
      expect(summary.invalid).toBe(1);
      expect(summary.byLanguage).toEqual({ typescript: 1 });
      expect(profiles.plain.valid).toBe(true);
      expect(profiles.ts.valid).toBe(false);
      expect(profiles.ts.errors.join(' ')).toContain('Invalid TypeScript build target');
    });

    it('summary counts zero profiles cleanly', async () => {
      const { profiles, summary } = await validateAllProfiles();
      expect(profiles).toEqual({});
      expect(summary).toEqual({ total: 0, valid: 0, invalid: 0, byLanguage: {} });
    });
  });

  describe('cloneProfile', () => {
    it('warns for an unknown source', async () => {
      await cloneProfile('ghost', 'copy');
      expect(output()).toContain('Source profile "ghost" not found');
    });

    it('refuses to overwrite an existing target name', async () => {
      await stageConfig({ profiles: { dev: profile(), other: profile({ name: 'other' }) } });
      await cloneProfile('dev', 'other');
      expect(output()).toContain('already exists');
    });

    it('deep-copies the source under the new name', async () => {
      await stageConfig({
        profiles: { dev: profile({ config: { dev: { port: 3000 } } }) },
      });
      await cloneProfile('dev', 'copy');
      const config = await readStagedConfig();
      expect(config.profiles.copy).toBeDefined();
      expect(config.profiles.copy.config.dev?.port).toBe(3000);
      expect(config.profiles.copy.description).toBe('Cloned from dev');
      // source untouched, clone independent (mutating one must not leak)
      config.profiles.copy.config.dev!.port = 9999;
      expect(config.profiles.dev.config.dev?.port).toBe(3000);
    });

    it('applies modifyConfig/extends/priority overrides', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      await cloneProfile('dev', 'tuned', {
        description: 'Tuned',
        modifyConfig: { dev: { port: 7777 } },
        extends: ['dev'],
        priority: 5,
      });
      const config = await readStagedConfig();
      expect(config.profiles.tuned.description).toBe('Tuned');
      expect(config.profiles.tuned.config.dev?.port).toBe(7777);
      expect(config.profiles.tuned.extends).toEqual(['dev']);
      expect(config.profiles.tuned.priority).toBe(5);
    });
  });

  describe('customizeProfile', () => {
    it('warns for an unknown profile', async () => {
      await customizeProfile('ghost', { description: 'x' });
      expect(output()).toContain('Profile "ghost" not found');
    });

    it('updates basic properties', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      await customizeProfile('dev', {
        description: 'New desc',
        framework: 'vue',
        environment: 'production',
      });
      const saved = (await readStagedConfig()).profiles.dev;
      expect(saved.description).toBe('New desc');
      expect(saved.framework).toBe('vue');
      expect(saved.environment).toBe('production');
    });

    it('creates missing build/dev sections on demand', async () => {
      await stageConfig({ profiles: { bare: profile({ name: 'bare', config: {} }) } });
      await customizeProfile('bare', {
        buildTarget: 'es2015',
        devPort: 1234,
        devHost: 'example.com',
      });
      const saved = (await readStagedConfig()).profiles.bare;
      expect(saved.config.build?.target).toBe('es2015');
      expect(saved.config.dev?.port).toBe(1234);
      expect(saved.config.dev?.host).toBe('example.com');
    });

    it('adds and removes env vars', async () => {
      await stageConfig({
        profiles: { dev: profile({ config: { env: { KEEP: 'yes', DROP: 'no' } } }) },
      });
      await customizeProfile('dev', { addEnv: { NEW: '1' }, removeEnv: ['DROP'] });
      expect((await readStagedConfig()).profiles.dev.config.env).toEqual({
        KEEP: 'yes', NEW: '1',
      });
    });

    it('adds scripts and dependencies', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      await customizeProfile('dev', {
        addScript: { lint: 'eslint .' },
        addDependency: { eslint: '^9.0.0' },
      });
      const saved = (await readStagedConfig()).profiles.dev;
      expect(saved.config.scripts).toEqual({ lint: 'eslint .' });
      expect(saved.config.dependencies).toEqual({ eslint: '^9.0.0' });
    });

    it('extends and prunes the inheritance list', async () => {
      await stageConfig({
        profiles: {
          dev: profile({ extends: ['base'] }),
          base: profile({ name: 'base' }),
          extra: profile({ name: 'extra' }),
        },
      });
      await customizeProfile('dev', { extendAdd: ['extra'], extendRemove: ['base'] });
      expect((await readStagedConfig()).profiles.dev.extends).toEqual(['extra']);
    });

    it('sets the priority', async () => {
      await stageConfig({ profiles: { dev: profile() } });
      await customizeProfile('dev', { priority: 42 });
      expect((await readStagedConfig()).profiles.dev.priority).toBe(42);
    });
  });

  it('fails the spinner and rethrows on unexpected errors', async () => {
    // Corrupt YAML makes loadProfileConfig's yaml.parse throw inside the
    // command's try/catch, exercising the error wrapper.
    await fs.writeFile(
      path.join(tempRoot, 're-shell.profiles.yaml'),
      'profiles: [unclosed',
      'utf8'
    );
    const spinner = { setText: vi.fn(), stop: vi.fn(), fail: vi.fn(), succeed: vi.fn() };
    await expect(manageProfiles({ spinner })).rejects.toThrow();
    expect(spinner.fail).toHaveBeenCalled();
  });
});
