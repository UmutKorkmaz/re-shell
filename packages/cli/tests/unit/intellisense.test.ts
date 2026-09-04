import { describe, it, expect } from 'vitest';

import {
  getRecommendedExtensions,
  getAllLanguageServers,
  IntelliSenseGenerator,
} from '../../src/utils/intellisense';

describe('intellisense', () => {
  describe('getRecommendedExtensions', () => {
    it('returns extensions for typescript', () => {
      const exts = getRecommendedExtensions('typescript');
      expect(exts.length).toBeGreaterThan(0);
      expect(exts).toContain('dbaeumer.vscode-eslint');
      expect(exts).toContain('esbenp.prettier-vscode');
    });

    it('returns extensions for javascript', () => {
      const exts = getRecommendedExtensions('javascript');
      expect(exts).toContain('vscode.typescript-language-features');
    });

    it('returns python extensions including pylance', () => {
      const exts = getRecommendedExtensions('python');
      expect(exts).toContain('ms-python.python');
      expect(exts).toContain('ms-python.pylance');
    });

    it('returns rust-analyzer extension for rust', () => {
      const exts = getRecommendedExtensions('rust');
      expect(exts).toContain('rust-lang.rust-analyzer');
    });

    it('returns the golang extension for go', () => {
      const exts = getRecommendedExtensions('go');
      expect(exts).toContain('golang.go');
    });

    it('is case-insensitive', () => {
      expect(getRecommendedExtensions('TypeScript')).toEqual(
        getRecommendedExtensions('typescript')
      );
      expect(getRecommendedExtensions('PYTHON')).toEqual(
        getRecommendedExtensions('python')
      );
    });

    it('returns an empty array for unknown languages', () => {
      expect(getRecommendedExtensions('klingon')).toEqual([]);
    });

    it('returns vue volar extension for vue', () => {
      const exts = getRecommendedExtensions('vue');
      expect(exts).toContain('Vue.volar');
    });

    it('returns svelte-vscode for svelte', () => {
      const exts = getRecommendedExtensions('svelte');
      expect(exts).toContain('svelte.svelte-vscode');
    });
  });

  describe('getAllLanguageServers', () => {
    it('returns a record keyed by language identifier', () => {
      const servers = getAllLanguageServers();
      expect(typeof servers).toBe('object');
      expect(servers).not.toBeNull();
    });

    it('includes typescript and javascript entries', () => {
      const servers = getAllLanguageServers();
      expect(servers.typescript).toBeDefined();
      expect(servers.javascript).toBeDefined();
    });

    it('each entry has the required LanguageServerConfig fields', () => {
      const servers = getAllLanguageServers();
      for (const [key, cfg] of Object.entries(servers)) {
        expect(cfg.language).toBeTruthy();
        expect(Array.isArray(cfg.fileExtensions)).toBe(true);
        expect(cfg.fileExtensions.length).toBeGreaterThan(0);
        expect(typeof cfg.serverName).toBe('string');
        expect(typeof cfg.command).toBe('string');
        expect(typeof cfg.requiresInstall).toBe('boolean');
      }
    });

    it('typescript language server uses --stdio', () => {
      const ts = getAllLanguageServers().typescript;
      expect(ts.args).toContain('--stdio');
      expect(ts.configFiles).toContain('tsconfig.json');
    });

    it('python language server requires install', () => {
      const py = getAllLanguageServers().python;
      expect(py.requiresInstall).toBe(true);
      expect(py.installCommand).toMatch(/pyright|pylance/);
    });

    it('rust language server is rust-analyzer', () => {
      const rust = getAllLanguageServers().rust;
      expect(rust.serverName).toBe('rust-analyzer');
      expect(rust.configFiles).toContain('Cargo.toml');
    });
  });

  describe('IntelliSenseGenerator', () => {
    it('constructs with a project path and optional type', () => {
      const gen = new IntelliSenseGenerator('/tmp/project', 'node');
      expect(gen).toBeInstanceOf(IntelliSenseGenerator);
    });

    it('constructs without a project type', () => {
      const gen = new IntelliSenseGenerator('/tmp/project');
      expect(gen).toBeInstanceOf(IntelliSenseGenerator);
    });

    it('detects languages from file extensions', async () => {
      const tmp = `/tmp/intellisense-test-${Date.now()}`;
      const fs = await import('fs-extra');
      await fs.ensureDir(tmp);
      await fs.writeFile(`${tmp}/index.ts`, '');
      await fs.writeFile(`${tmp}/app.py`, '');
      await fs.writeFile(`${tmp}/main.go`, '');

      try {
        const gen = new IntelliSenseGenerator(tmp);
        const langs = await gen.detectLanguages();
        expect(langs).toEqual(expect.arrayContaining(['typescript', 'python', 'go']));
      } finally {
        await fs.remove(tmp);
      }
    });
  });
});
