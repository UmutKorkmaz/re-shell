import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as YAML from 'yaml';
import {
  PROFILE_TEMPLATES,
  listTemplates,
  getTemplate,
  applyTemplate,
  showTemplate,
  searchTemplates,
} from '../../src/commands/profile-templates';
import type { EnvironmentProfile } from '../../src/commands/profile';

// Covers src/commands/profile-templates.ts — the pre-configured environment
// profile catalog plus its list/get/apply/show/search surface. applyTemplate
// exercises real vault round-trips (re-shell.profiles.yaml in a temp cwd);
// everything else is pure catalog + console output, spied via console.log.

describe('profile-templates — command', () => {
  let tempRoot: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-templates-'));
    vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.removeSync(tempRoot);
  });

  describe('catalog shape', () => {
    it('ships 13 built-in templates with unique ids', () => {
      expect(PROFILE_TEMPLATES.length).toBe(13);
      const ids = PROFILE_TEMPLATES.map(t => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('covers all five documented categories', () => {
      const categories = new Set(PROFILE_TEMPLATES.map(t => t.category));
      for (const category of [
        'development',
        'staging',
        'production',
        'testing',
      ]) {
        expect(categories.has(category as never)).toBe(true);
      }
    });

    it('every template carries a valid embedded profile', () => {
      for (const template of PROFILE_TEMPLATES) {
        expect(template.profile.environment).toMatch(
          /^(development|staging|production|custom)$/
        );
        expect(typeof template.profile.config).toBe('object');
        expect(template.name.length).toBeGreaterThan(0);
        expect(template.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getTemplate', () => {
    it('finds a template by id', () => {
      const template = getTemplate('dev-local');
      expect(template?.id).toBe('dev-local');
      expect(template?.category).toBe('development');
    });

    it('returns null for unknown ids', () => {
      expect(getTemplate('does-not-exist')).toBeNull();
      expect(getTemplate('')).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('renders templates grouped under category headers', () => {
      listTemplates();
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('Available Profile Templates');
      expect(out).toContain('DEVELOPMENT');
      expect(out).toContain('STAGING');
      expect(out).toContain('PRODUCTION');
      expect(out).toContain('dev-local');
      expect(out).toContain('Local Development');
    });

    it('prints the usage hint', () => {
      listTemplates();
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('re-shell profile template apply <id> [name]');
    });
  });

  describe('showTemplate', () => {
    it('renders id, category, environment and build/dev/env sections', () => {
      showTemplate('dev-local');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('Template: Local Development');
      expect(out).toContain('ID: dev-local');
      expect(out).toContain('Category: development');
      expect(out).toContain('Environment: development');
      expect(out).toContain('Build Configuration:');
      expect(out).toContain('Development Server:');
      expect(out).toContain('Environment Variables:');
      expect(out).toContain('NODE_ENV=development');
    });

    it('annotates framework-specific templates', () => {
      const reactTemplate = PROFILE_TEMPLATES.find(
        t => t.framework === 'react'
      );
      expect(reactTemplate).toBeDefined();
      showTemplate(reactTemplate!.id);
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('Framework: react');
    });

    it('warns for unknown template ids', () => {
      showTemplate('nope');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('Template "nope" not found');
    });
  });

  describe('searchTemplates', () => {
    it('matches across id, name, description and category', () => {
      searchTemplates('local');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('dev-local');
      expect(out).toContain('Local Development');
    });

    it('matches framework fields', () => {
      searchTemplates('react');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('react-dev');
      expect(out).toContain('react-prod');
    });

    it('is case-insensitive', () => {
      searchTemplates('REACT');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('react-dev');
    });

    it('reports no matches', () => {
      searchTemplates('zzz-no-match');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('No templates found matching "zzz-no-match"');
    });
  });

  describe('applyTemplate', () => {
    it('creates a profile in the vault from a template', async () => {
      await applyTemplate('dev-local', 'mydev');
      const vaultPath = path.join(tempRoot, 're-shell.profiles.yaml');
      expect(await fs.pathExists(vaultPath)).toBe(true);
      const parsed = YAML.parse(
        await fs.readFile(vaultPath, 'utf8')
      ) as ProfileVault;
      expect(parsed.profiles.mydev.name).toBe('mydev');
      expect(parsed.profiles.mydev.description).toBe(
        'Created from template: Local Development'
      );
      expect(parsed.profiles.mydev.environment).toBe('development');
      expect(parsed.profiles.mydev.config.env.NODE_ENV).toBe('development');
    });

    it('prints the activation hint and template metadata', async () => {
      await applyTemplate('dev-local', 'mydev');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('Profile "mydev" created from template');
      expect(out).toContain('Activate with: re-shell profile activate mydev');
    });

    it('refuses to overwrite an existing profile without --overwrite', async () => {
      await applyTemplate('dev-local', 'mydev');
      vi.mocked(logSpy).mockClear();
      await applyTemplate('dev-local', 'mydev');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('Profile "mydev" already exists');
      expect(out).toContain('Use --overwrite to replace it');
      // Content is untouched
      const parsed = readVault();
      expect(parsed.profiles.mydev.config.env.LOG_LEVEL).toBe('debug');
    });

    it('replaces the profile when --overwrite is set', async () => {
      await applyTemplate('dev-local', 'mydev');
      await applyTemplate('prod-standard', 'mydev', { overwrite: true });
      const parsed = readVault();
      expect(parsed.profiles.mydev.environment).toBe('production');
    });

    it('preserves other profiles in the vault', async () => {
      await applyTemplate('dev-local', 'dev-profile');
      await applyTemplate('prod-standard', 'prod-profile');
      const parsed = readVault();
      expect(Object.keys(parsed.profiles).sort()).toEqual([
        'dev-profile',
        'prod-profile',
      ]);
    });

    it('warns for unknown template ids and writes nothing', async () => {
      await applyTemplate('does-not-exist', 'mydev');
      const out = logSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(out).toContain('Template "does-not-exist" not found');
      expect(out).toContain('re-shell profile template list');
      expect(await fs.pathExists(vaultPath())).toBe(false);
    });

    it('rejects when the vault file is malformed YAML', async () => {
      await fs.writeFile(vaultPath(), '{{{{not yaml', 'utf8');
      await expect(applyTemplate('dev-local', 'mydev')).rejects.toThrow();
      // The malformed file is left untouched
      expect(await fs.readFile(vaultPath(), 'utf8')).toBe('{{{{not yaml');
    });
  });

  function vaultPath(): string {
    return path.join(tempRoot, 're-shell.profiles.yaml');
  }

  interface ProfileVault {
    profiles: Record<string, EnvironmentProfile>;
  }

  function readVault(): ProfileVault {
    return YAML.parse(fs.readFileSync(vaultPath(), 'utf8')) as ProfileVault;
  }
});
