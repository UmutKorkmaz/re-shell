import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { addMicrofrontend } from '../src/commands/add';
import { createProject } from '../src/commands/create';
import { removeMicrofrontend } from '../src/commands/remove';
import { listMicrofrontends } from '../src/commands/list';

// Create a more comprehensive mock for fs-extra
const mockFiles = new Map();

// Mock the modules
vi.mock('fs-extra', () => ({
  existsSync: vi.fn((path) => mockFiles.has(String(path))),
  mkdirSync: vi.fn((path) => { mockFiles.set(String(path), 'directory'); }),
  writeFileSync: vi.fn((path, content) => {
    mockFiles.set(String(path), content);
    return { path, content };
  }),
  readFileSync: vi.fn((path) => {
    const content = mockFiles.get(String(path)) || JSON.stringify({ version: '0.2.0' });
    return content;
  }),
  readJsonSync: vi.fn((path) => {
    const content = mockFiles.get(String(path));
    if (content) {
      try {
        return JSON.parse(content);
      } catch {
        return content;
      }
    }
    return { microfrontends: [], workspaces: ['packages/*'] };
  }),
  removeSync: vi.fn((path) => { mockFiles.delete(String(path)); }),
  readdirSync: vi.fn(() => ['mf1', 'mf2'])
}));

vi.mock('prompts', () => ({
  default: vi.fn(() => Promise.resolve({
    template: 'react-ts',
    route: '/test-mf',
    force: true
  }))
}));

vi.mock('path', async () => {
  const actual = await vi.importActual<typeof import('path')>('path');
  return {
    ...actual,
    default: actual,
    resolve: vi.fn((dir: string, ...segments: string[]) => `${dir}/${segments.join('/')}`),
    join: vi.fn((...args: string[]) => args.join('/'))
  };
});

vi.mock('child_process', () => ({
  exec: vi.fn(),
  execSync: vi.fn()
}));

// Mock console methods
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('CLI Command Tests', () => {
  const testDir = '/test/path';
  const testMfName = 'test-mf';
  const testProjectName = 'test-project';

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    mockFiles.clear();

    // Mock process.cwd
    vi.spyOn(process, 'cwd').mockReturnValue(testDir);

    // Restore fs mock implementations after resetAllMocks
    vi.mocked(fs.existsSync).mockImplementation((p) => mockFiles.has(String(p)));
    vi.mocked(fs.readFileSync).mockImplementation((p) => {
      const content = mockFiles.get(String(p)) || JSON.stringify({ version: '0.2.0' });
      return content;
    });
    vi.mocked(fs.readJsonSync).mockImplementation((p) => {
      const content = mockFiles.get(String(p));
      if (content) {
        try { return JSON.parse(content); } catch { return content; }
      }
      return { microfrontends: [], workspaces: ['packages/*'] };
    });
    vi.mocked(fs.writeFileSync).mockImplementation((p, content) => {
      mockFiles.set(String(p), content);
    });
    vi.mocked(fs.mkdirSync).mockImplementation((p) => {
      mockFiles.set(String(p), 'directory');
      return undefined as any;
    });
    vi.mocked(fs.removeSync).mockImplementation((p) => { mockFiles.delete(String(p)); });
    vi.mocked(fs.readdirSync).mockReturnValue(['mf1', 'mf2'] as any);

    // Set up core files for Re-Shell project detection
    mockFiles.set('package.json', JSON.stringify({
      name: 'reshell-project',
      workspaces: ['packages/*', 'apps/*']
    }));
    mockFiles.set('packages', 'directory');
    mockFiles.set('apps', 'directory');

    // Set up specific test paths
    const appsTestMfPath = `${testDir}/apps/${testMfName}`;
    mockFiles.set(appsTestMfPath, 'directory');

    // Mock path.resolve to handle test paths consistently
    vi.mocked(path.resolve).mockImplementation((dir, ...segments) => {
      if (segments.includes('test-mf')) {
        return `${dir}/${segments.join('/')}`;
      }
      if (segments.includes('test-project')) {
        return `${dir}/${segments.join('/')}`;
      }
      return `${dir}/${segments.join('/')}`;
    });

    // Mock path.join to be consistent
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addMicrofrontend', () => {
    it('should create microfrontend directory structure', async () => {
      // Mock existsSync for Re-Shell project detection
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === 'package.json') return true;
        if (p === 'apps') return true;
        if (p === 'packages') return true;
        return false;
      });

      // Call the function under test
      await addMicrofrontend(testMfName, {
        org: 're-shell',
        template: 'react-ts',
        route: '/test-mf',
        port: '5173'
      });

      // Verify directories are created
      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();

      // Check that files were created
      const writeFileCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const createdFiles = writeFileCalls.map(call => String(call[0]));

      expect(createdFiles.some(f => f.includes('package.json'))).toBe(true);
      expect(createdFiles.some(f => f.includes('vite.config.ts'))).toBe(true);
      expect(createdFiles.some(f => f.includes('App.tsx'))).toBe(true);
    });

    it('should handle existing directory by prompting user', async () => {
      // Mock existsSync to return true for directory existence check
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        // For Re-Shell project detection
        if (p === 'package.json') return true;
        if (p === 'apps') return true;
        if (p === 'packages') return true;

        // For directory existence check
        if (String(p).includes(testMfName)) return true;

        return false;
      });

      // Mock prompts to simulate cancel action
      const promptsMock = await import('prompts');
      vi.mocked(promptsMock.default)
        .mockResolvedValueOnce({ template: 'react-ts', route: '/test-mf' })
        .mockResolvedValueOnce({ action: 'cancel' });

      // Call the function - should not throw, just cancel
      await addMicrofrontend(testMfName, {
        org: 're-shell',
        template: 'react-ts',
        route: '/test-mf',
        port: '5173'
      });

      // Verify no directories are created since user cancelled
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });

    it('should create proper package.json for Re-Shell project', async () => {
      // Mock existsSync for Re-Shell project detection
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === 'package.json') return true;
        if (p === 'apps') return true;
        if (p === 'packages') return true;
        return false;
      });

      // Call the function under test
      await addMicrofrontend(testMfName, {
        org: 're-shell',
        template: 'react-ts',
        route: '/test-mf',
        port: '5173'
      });

      // Verify package.json is created with correct content
      const writeFileCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const packageJsonCall = writeFileCalls.find(call =>
        String(call[0]).includes('package.json')
      );

      expect(packageJsonCall).toBeDefined();
      expect(packageJsonCall![1]).toContain('@re-shell/test-mf');
    });

    it('should create standalone package correctly', async () => {
      // Mock existsSync for non-Re-Shell project
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Call the function under test
      await addMicrofrontend(testMfName, {
        org: 're-shell',
        template: 'react-ts',
        route: '/test-mf',
        port: '5173'
      });

      // Verify eventBus file is created for standalone
      const writeFileCalls = vi.mocked(fs.writeFileSync).mock.calls;

      // Verify package.json has correct name
      const packageJsonCall = writeFileCalls.find(call =>
        String(call[0]).includes('package.json')
      );

      expect(packageJsonCall).toBeDefined();
      expect(packageJsonCall![1]).toContain('"name": "test-mf"');

      // Verify eventBus file exists
      const eventBusCall = writeFileCalls.find(call =>
        String(call[0]).includes('eventBus')
      );

      expect(eventBusCall).toBeDefined();
      expect(eventBusCall![1]).toContain('Simple event bus');
    });
  });

  describe('createProject', () => {
    it('should create a Re-Shell project structure', async () => {
      // Call the function under test
      await createProject(testProjectName, {
        org: 're-shell',
        template: 'react-ts',
        packageManager: 'pnpm',
        isProject: true
      });

      // Verify package.json is created
      const writeFileCalls = vi.mocked(fs.writeFileSync).mock.calls;
      const packageJsonCall = writeFileCalls.find(call =>
        String(call[0]).includes('package.json')
      );

      expect(packageJsonCall).toBeDefined();
      expect(packageJsonCall![1]).toContain('"name": "test-project"');
    });

    it('should handle existing project directory error', async () => {
      // Mock existsSync to return true (directory exists)
      vi.mocked(fs.existsSync).mockReturnValue(true);

      // Verify function throws error for existing directory
      await expect(async () => {
        await createProject(testProjectName, {
          org: 're-shell',
          template: 'react-ts',
          packageManager: 'pnpm',
          isProject: true
        });
      }).rejects.toThrow(/already exists/);

      // Verify no directories are created
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('removeMicrofrontend', () => {
    it('should remove a microfrontend', async () => {
      // Make sure the microfrontend directory exists in the apps directory
      const mfPath = `${testDir}/apps/${testMfName}`;

      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === 'package.json') return true;
        if (p === 'apps') return true;
        if (p === 'packages') return true;
        if (String(p) === mfPath) return true;
        return false;
      });

      // Call the function under test
      await removeMicrofrontend(testMfName, { force: true });

      // Verify remove is called
      expect(fs.removeSync).toHaveBeenCalled();
    });

    it('should throw error if microfrontend does not exist', async () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === 'package.json') return true;
        if (p === 'apps') return true;
        if (p === 'packages') return true;
        return false;
      });

      // Verify function throws error for non-existent microfrontend
      await expect(async () => {
        await removeMicrofrontend(testMfName, { force: true });
      }).rejects.toThrow(/not found/);
    });
  });

  describe('listMicrofrontends', () => {
    it('should list microfrontends', async () => {
      const appsDir = `${testDir}/apps`;

      // Mock for Re-Shell project detection and apps dir
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === 'package.json') return true;
        if (p === 'apps') return true;
        if (p === 'packages') return true;
        if (String(p) === appsDir) return true;
        if (String(p).includes('package.json')) return true;
        return false;
      });

      // Mock readFileSync to return package.json content for microfrontends
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        if (String(p).includes('mf1/package.json')) {
          return JSON.stringify({
            name: '@re-shell/mf1',
            version: '0.1.0',
            reshell: { route: '/mf1' }
          });
        }
        if (String(p).includes('mf2/package.json')) {
          return JSON.stringify({
            name: '@re-shell/mf2',
            version: '0.1.0',
            reshell: { route: '/mf2' }
          });
        }
        return JSON.stringify({ version: '0.2.0' });
      });

      // Mock readdirSync to return Dirent-like objects
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'mf1', isDirectory: () => true, isFile: () => false },
        { name: 'mf2', isDirectory: () => true, isFile: () => false }
      ] as any);

      // Call the function under test
      await listMicrofrontends({});

      // Verify console.log is called with microfrontend info
      expect(console.log).toHaveBeenCalled();
    });

    it('should output JSON when json option is true', async () => {
      const appsDir = `${testDir}/apps`;

      // Mock for Re-Shell project detection and apps dir
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        if (p === 'package.json') return true;
        if (p === 'apps') return true;
        if (p === 'packages') return true;
        if (String(p) === appsDir) return true;
        if (String(p).includes('package.json')) return true;
        return false;
      });

      // Mock readFileSync to return package.json content for microfrontends
      vi.mocked(fs.readFileSync).mockImplementation((p) => {
        if (String(p).includes('mf1/package.json')) {
          return JSON.stringify({
            name: '@re-shell/mf1',
            version: '0.1.0',
            reshell: { route: '/mf1' }
          });
        }
        if (String(p).includes('mf2/package.json')) {
          return JSON.stringify({
            name: '@re-shell/mf2',
            version: '0.1.0',
            reshell: { route: '/mf2' }
          });
        }
        return JSON.stringify({ version: '0.2.0' });
      });

      // Mock readdirSync to return Dirent-like objects
      vi.mocked(fs.readdirSync).mockReturnValue([
        { name: 'mf1', isDirectory: () => true, isFile: () => false },
        { name: 'mf2', isDirectory: () => true, isFile: () => false }
      ] as any);

      // Call the function under test
      await listMicrofrontends({ json: true });

      // Verify console.log is called with JSON containing microfrontends
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('microfrontends'));
    });
  });
});