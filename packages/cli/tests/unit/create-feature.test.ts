import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { createFeature } from '../../src/commands/create-feature';
import {
  getFeatureTypeChoices,
  getBackendFrameworkChoices,
  getFrontendFrameworkChoices,
  getDatabaseChoices,
} from '../../src/commands/create-feature';

// Covers src/commands/create-feature.ts — the `generate feature` scaffolder
// (2402 lines). createFeature is driven against a REAL temp monorepo with a
// REAL express backend template (44 files) and REAL frontend generators; the
// exported choice catalogs are pure functions. The remaining exports
// (authMiddleware / createWebSocketServer / handleConnection / Login /
// useAuth / CRUD hooks) live inside generated template strings — they are
// asserted as scaffold output, not imported.

let tempRoot: string;
let monorepoRoot: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function stubSpinner() {
  return {
    text: '',
    start: vi.fn(),
    stop: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  };
}

function output(): string {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

/** Stage a minimal monorepo so findMonorepoRoot resolves to tempRoot. */
async function stageMonorepo(): Promise<void> {
  await fs.ensureDir(path.join(monorepoRoot, 'apps'));
  await fs.writeJson(path.join(monorepoRoot, 'package.json'), {
    name: 'test-monorepo',
    private: true,
    workspaces: ['apps/*', 'packages/*'],
  });
}

beforeEach(async () => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-create-feature-'));
  monorepoRoot = tempRoot;
  const cwdSpy = vi.spyOn(process, 'cwd');
  cwdSpy.mockReturnValue(monorepoRoot);
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  await stageMonorepo();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.remove(tempRoot);
});

describe('create-feature — command', () => {
  describe('preconditions', () => {
    it('throws when not inside a Re-Shell monorepo', async () => {
      // Remove the monorepo markers so findMonorepoRoot bails.
      await fs.remove(path.join(monorepoRoot, 'package.json'));

      await expect(createFeature('my-feature')).rejects.toThrow(
        /Not in a Re-Shell monorepo/
      );
    });

    it('fails the spinner and rethrows when creation errors', async () => {
      const spinner = stubSpinner();
      await fs.remove(path.join(monorepoRoot, 'package.json'));

      await expect(createFeature('my-feature', { spinner })).rejects.toThrow(
        /Not in a Re-Shell monorepo/
      );
      expect(spinner.fail).toHaveBeenCalled();
    });

    it('rejects when the feature already exists at the target path', async () => {
      await createFeature('existing');
      await expect(createFeature('existing')).rejects.toThrow(
        /already exists at/
      );
    });
  });

  describe('default (crud, no explicit backend/frontend)', () => {
    it('falls through to the full-stack branch and writes root config only', async () => {
      // QUIRK: with neither backend nor frontend set, generateFeature takes
      // the "default to CRUD full-stack" branch but generateFullStackFeature
      // skips both api/ and web/ — only the root config files land on disk.
      const spinner = stubSpinner();
      await createFeature('My Feature', { spinner });

      const featurePath = path.join(monorepoRoot, 'apps', 'my-feature');
      await expect(fs.pathExists(featurePath)).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featurePath, 'package.json'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featurePath, 'README.md'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featurePath, 'api'))
      ).resolves.toBe(false);
      await expect(
        fs.pathExists(path.join(featurePath, 'web'))
      ).resolves.toBe(false);

      expect(spinner.succeed).toHaveBeenCalled();
      expect(output()).toContain('Feature Created:');
      expect(output()).toContain('Name: My Feature');
      expect(output()).toContain('Type: crud');
    });

    it('scaffolds api/ + web/ when both backend and frontend are provided', async () => {
      const spinner = stubSpinner();
      await createFeature('My Feature', { spinner, backend: 'express', frontend: 'react' });

      const featurePath = path.join(monorepoRoot, 'apps', 'my-feature');
      await expect(fs.pathExists(featurePath)).resolves.toBe(true);
      // Full-stack layout: api/ from the express template, web/ from react.
      await expect(
        fs.pathExists(path.join(featurePath, 'api', 'package.json'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featurePath, 'web', 'package.json'))
      ).resolves.toBe(true);
      // Root config files.
      await expect(
        fs.pathExists(path.join(featurePath, 'docker-compose.yml'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featurePath, '.env.example'))
      ).resolves.toBe(true);

      expect(spinner.succeed).toHaveBeenCalled();
      expect(output()).toContain('Feature Created:');
      expect(output()).toContain('Name: My Feature');
      expect(output()).toContain('Type: crud');
    });

    it('normalizes display names into kebab-case paths', async () => {
      await createFeature('Payment Gateway');

      await expect(
        fs.pathExists(path.join(monorepoRoot, 'apps', 'payment-gateway'))
      ).resolves.toBe(true);
    });

    it('announces the relative path in the summary', async () => {
      await createFeature('orders');

      expect(output()).toContain(path.join('apps', 'orders'));
    });

    it('prints pnpm install in next steps unless skipInstall', async () => {
      await createFeature('orders');
      expect(output()).toContain('pnpm install');

      logSpy.mockClear();
      await createFeature('orders-skip', { skipInstall: true });
      expect(output()).not.toContain('pnpm install');
    });
  });

  describe('backend-only features', () => {
    it('scaffolds under apps/<name>-api and reports the backend', async () => {
      await createFeature('billing', { backend: 'express', frontend: undefined as never });

      const featurePath = path.join(monorepoRoot, 'apps', 'billing-api');
      await expect(
        fs.pathExists(path.join(featurePath, 'src', 'index.ts'))
      ).resolves.toBe(true);
      // Backend-only must NOT create a web/ frontend.
      await expect(fs.pathExists(path.join(featurePath, 'web'))).resolves.toBe(
        false
      );
      expect(output()).toContain('Backend: express');
    });

    it('throws for an unknown backend template id', async () => {
      await expect(
        createFeature('billing', { backend: 'nope-framework' })
      ).rejects.toThrow(/Backend template not found: nope-framework/);
    });
  });

  describe('frontend-only features', () => {
    it('scaffolds a react frontend under apps/<name> without api/', async () => {
      await createFeature('dashboard', { frontend: 'react', backend: undefined as never });

      const featurePath = path.join(monorepoRoot, 'apps', 'dashboard');
      await expect(
        fs.pathExists(path.join(featurePath, 'src', 'App.tsx'))
      ).resolves.toBe(true);
      await expect(fs.pathExists(path.join(featurePath, 'api'))).resolves.toBe(
        false
      );
      expect(output()).toContain('Frontend: react');
    });
  });

  describe('backend feature types', () => {
    it('generates CRUD routes/controllers/services/models', async () => {
      await createFeature('products', { backend: 'express', frontend: undefined as never });

      const base = path.join(monorepoRoot, 'apps', 'products-api', 'src');
      await expect(
        fs.pathExists(path.join(base, 'routes', 'products.routes.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'controllers', 'products.controller.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'services', 'products.service.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'models', 'products.model.ts'))
      ).resolves.toBe(true);

      // Name placeholders are processed into the generated code.
      const routes = await fs.readFile(
        path.join(base, 'routes', 'products.routes.ts'),
        'utf8'
      );
      expect(routes).toContain('products');
    });

    it('generates JavaScript artifacts when language=javascript', async () => {
      await createFeature('legacy', {
        backend: 'express',
        frontend: undefined as never,
        language: 'javascript',
      });

      const base = path.join(monorepoRoot, 'apps', 'legacy-api', 'src');
      await expect(
        fs.pathExists(path.join(base, 'routes', 'legacy.routes.js'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'routes', 'legacy.routes.ts'))
      ).resolves.toBe(false);
    });

    it('generates auth controllers/services/routes/middleware', async () => {
      await createFeature('accounts', {
        backend: 'express',
        frontend: undefined as never,
        type: 'auth',
      });

      const base = path.join(monorepoRoot, 'apps', 'accounts-api', 'src');
      await expect(
        fs.pathExists(path.join(base, 'controllers', 'auth.controller.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'services', 'auth.service.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'routes', 'auth.routes.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'middleware', 'auth.middleware.ts'))
      ).resolves.toBe(true);

      const middleware = await fs.readFile(
        path.join(base, 'middleware', 'auth.middleware.ts'),
        'utf8'
      );
      expect(middleware).toContain('export async function authMiddleware');
    });

    it('generates file-upload controllers/routes/multer config', async () => {
      await createFeature('media', {
        backend: 'express',
        frontend: undefined as never,
        type: 'file-upload',
      });

      const base = path.join(monorepoRoot, 'apps', 'media-api', 'src');
      await expect(
        fs.pathExists(path.join(base, 'controllers', 'upload.controller.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'routes', 'upload.routes.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'config', 'multer.config.ts'))
      ).resolves.toBe(true);
    });

    it('generates websocket server and handlers', async () => {
      await createFeature('chat', {
        backend: 'express',
        frontend: undefined as never,
        type: 'websocket',
      });

      const base = path.join(monorepoRoot, 'apps', 'chat-api', 'src');
      await expect(
        fs.pathExists(path.join(base, 'websocket', 'server.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'websocket', 'handlers.ts'))
      ).resolves.toBe(true);

      const server = await fs.readFile(
        path.join(base, 'websocket', 'server.ts'),
        'utf8'
      );
      expect(server).toContain('export function createWebSocketServer');

      const handlers = await fs.readFile(
        path.join(base, 'websocket', 'handlers.ts'),
        'utf8'
      );
      expect(handlers).toContain('export function handleConnection');
    });

    it('generates graphql schema and resolvers', async () => {
      await createFeature('social', {
        backend: 'express',
        frontend: undefined as never,
        type: 'graphql',
      });

      const base = path.join(monorepoRoot, 'apps', 'social-api', 'src');
      await expect(
        fs.pathExists(path.join(base, 'graphql', 'schema.graphql'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(base, 'graphql', 'resolvers.ts'))
      ).resolves.toBe(true);
    });

    it('processes template placeholders against the feature context', async () => {
      await createFeature('user-profile', {
        backend: 'express',
        frontend: undefined as never,
        port: '4040',
      });

      const pkg = await fs.readJson(
        path.join(monorepoRoot, 'apps', 'user-profile-api', 'package.json')
      );
      // {{projectName}} resolves to <normalizedName>-api.
      expect(pkg.name).toBe('user-profile-api');
    });
  });

  describe('frontend frameworks', () => {
    it('scaffolds a Vue frontend with App.vue and a CRUD composable', async () => {
      await createFeature('catalog', {
        frontend: 'vue',
        backend: 'express',
        type: 'crud',
      });

      const web = path.join(monorepoRoot, 'apps', 'catalog', 'web');
      await expect(
        fs.pathExists(path.join(web, 'src', 'App.vue'))
      ).resolves.toBe(true);

      const featureDir = path.join(web, 'src', 'features', 'catalog');
      await expect(
        fs.pathExists(path.join(featureDir, 'Catalog.vue'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featureDir, 'useCatalog.ts'))
      ).resolves.toBe(true);
    });

    it('scaffolds a Svelte frontend with App.svelte and a CRUD component', async () => {
      await createFeature('alerts', {
        frontend: 'svelte',
        backend: 'express',
        type: 'crud',
      });

      const web = path.join(monorepoRoot, 'apps', 'alerts', 'web');
      await expect(
        fs.pathExists(path.join(web, 'src', 'App.svelte'))
      ).resolves.toBe(true);

      const featureDir = path.join(web, 'src', 'features', 'alerts');
      await expect(
        fs.pathExists(path.join(featureDir, 'Alerts.svelte'))
      ).resolves.toBe(true);
    });

    it('falls back to the React generator for unhandled frameworks', async () => {
      // angular has no dedicated generator — falls through to React.
      await createFeature('legacy', {
        frontend: 'angular' as never,
        backend: 'express',
      });

      const web = path.join(monorepoRoot, 'apps', 'legacy', 'web');
      await expect(
        fs.pathExists(path.join(web, 'src', 'App.tsx'))
      ).resolves.toBe(true);
    });

    it('generates the React auth frontend (Login + useAuth) for auth features', async () => {
      await createFeature('portal', {
        frontend: 'react',
        backend: 'express',
        type: 'auth',
      });

      const authDir = path.join(
        monorepoRoot,
        'apps',
        'portal',
        'web',
        'src',
        'features',
        'auth'
      );
      await expect(fs.pathExists(path.join(authDir, 'Login.tsx'))).resolves.toBe(
        true
      );
      await expect(fs.pathExists(path.join(authDir, 'useAuth.ts'))).resolves.toBe(
        true
      );
    });

    it('generates React CRUD component, hook and types', async () => {
      await createFeature('inventory', {
        frontend: 'react',
        backend: 'express',
        type: 'crud',
      });

      const featureDir = path.join(
        monorepoRoot,
        'apps',
        'inventory',
        'web',
        'src',
        'features',
        'inventory'
      );
      await expect(
        fs.pathExists(path.join(featureDir, 'Inventory.tsx'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featureDir, 'useInventory.ts'))
      ).resolves.toBe(true);
      await expect(
        fs.pathExists(path.join(featureDir, 'Inventory.types.ts'))
      ).resolves.toBe(true);

      const hook = await fs.readFile(
        path.join(featureDir, 'useInventory.ts'),
        'utf8'
      );
      expect(hook).toContain('export function useInventory');
    });
  });

  describe('workspace targeting', () => {
    it('places the feature under <workspace>/features/<name>', async () => {
      await createFeature('payments', { workspace: 'packages/billing' });

      const featurePath = path.join(
        monorepoRoot,
        'packages',
        'billing',
        'features',
        'payments'
      );
      await expect(fs.pathExists(featurePath)).resolves.toBe(true);
    });
  });

  describe('root configuration', () => {
    it('writes a root package.json wiring web+api workspaces', async () => {
      await createFeature('reports');

      const pkg = await fs.readJson(
        path.join(monorepoRoot, 'apps', 'reports', 'package.json')
      );
      expect(pkg.name).toBe('reports');
      expect(pkg.scripts.dev).toContain('--filter web');
      expect(pkg.scripts.dev).toContain('--filter api');
      expect(pkg.devDependencies).toHaveProperty('concurrently');
    });

    it('renders the README with endpoint documentation and ports', async () => {
      await createFeature('search', { port: '5000' });

      const readme = await fs.readFile(
        path.join(monorepoRoot, 'apps', 'search', 'README.md'),
        'utf8'
      );
      expect(readme).toContain('# search');
      expect(readme).toContain('GET /api/search');
      expect(readme).toContain('port 5000');
    });

    it('maps the configured backend port into docker-compose and env', async () => {
      await createFeature('analytics', { port: '4321' });

      const compose = await fs.readFile(
        path.join(monorepoRoot, 'apps', 'analytics', 'docker-compose.yml'),
        'utf8'
      );
      expect(compose).toContain('4321:3000');
      // Frontend port is backend port + 1000.
      expect(compose).toContain('5321:5173');

      const env = await fs.readFile(
        path.join(monorepoRoot, 'apps', 'analytics', '.env.example'),
        'utf8'
      );
      expect(env).toContain('PORT=4321');
      expect(env).toContain('VITE_API_URL=http://localhost:4321');
    });

    it('defaults the port to 3000 when unset', async () => {
      await createFeature('notes');

      const env = await fs.readFile(
        path.join(monorepoRoot, 'apps', 'notes', '.env.example'),
        'utf8'
      );
      expect(env).toContain('PORT=3000');
    });
  });

  describe('verbose mode', () => {
    it('logs each created file', async () => {
      await createFeature('verbose-feature', {
        frontend: 'react',
        backend: 'express',
        verbose: true,
      });

      expect(output()).toContain('✓ Created package.json');
      expect(output()).toContain('✓ Created CRUD backend files');
      expect(output()).toContain('✓ Created React CRUD frontend files');
      expect(output()).toContain('✓ Created root configuration files');
    });
  });

  describe('spinner lifecycle', () => {
    it('sets the spinner text while creating', async () => {
      const spinner = stubSpinner();
      await createFeature('spinner-check', { spinner });

      expect(spinner.text).toContain('Creating feature "spinner-check"');
      expect(spinner.succeed).toHaveBeenCalled();
      expect(spinner.fail).not.toHaveBeenCalled();
    });

    it('fails the spinner when scaffolding throws', async () => {
      const spinner = stubSpinner();
      // Existing feature guard triggers the failure path.
      await createFeature('dup', { spinner });
      await expect(createFeature('dup', { spinner })).rejects.toThrow(
        /already exists/
      );
      expect(spinner.fail).toHaveBeenCalled();
    });
  });

  describe('choice catalogs', () => {
    it('getFeatureTypeChoices lists the six feature types', () => {
      const choices = getFeatureTypeChoices();
      const values = choices.map((c) => c.value);
      expect(values).toEqual([
        'crud',
        'auth',
        'file-upload',
        'websocket',
        'graphql',
        'fullstack',
      ]);
      // Every entry is fully described for the interactive prompt.
      for (const c of choices) {
        expect(c.title).toBeTruthy();
        expect(c.description).toBeTruthy();
      }
    });

    it('getBackendFrameworkChoices mirrors the backend template catalog', () => {
      const choices = getBackendFrameworkChoices();
      const values = choices.map((c) => c.value);
      expect(values).toContain('express');
      expect(values).toContain('fastapi');
      // Every backend template gets an entry with display metadata.
      expect(choices.length).toBeGreaterThan(20);
      const express = choices.find((c) => c.value === 'express');
      expect(express?.title).toBe('Express.js');
      expect(express?.description).toBeTruthy();
    });

    it('getFrontendFrameworkChoices lists the five frontend frameworks', () => {
      const choices = getFrontendFrameworkChoices();
      expect(choices.map((c) => c.value)).toEqual([
        'react',
        'vue',
        'svelte',
        'angular',
        'vanilla',
      ]);
    });

    it('getDatabaseChoices lists none plus the four ORMs', () => {
      const choices = getDatabaseChoices();
      expect(choices.map((c) => c.value)).toEqual([
        'none',
        'prisma',
        'typeorm',
        'mongoose',
        'sequelize',
      ]);
    });
  });
});
