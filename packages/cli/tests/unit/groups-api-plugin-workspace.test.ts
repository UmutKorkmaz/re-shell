import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// Covers the FINAL three registrar groups in src/groups/*.group.ts:
//  - api.group.ts (2133 lines) — 9 sections (openapi/swagger/versioning/
//    validation/test/docs/gateway/analytics/client). Per-section utils are
//    mocked via their dynamic-import specifiers; fs-extra stays REAL against
//    a temp cwd so the write paths can be asserted on disk.
//  - plugin.group.ts (940 lines) — pure thin registrar: 60 subcommands
//    delegating to 11 command modules, all mocked. Tree shape + option
//    forwarding/normalisation.
//  - workspace.group.ts (2296 lines) — 13 direct subs + 13 nested groups
//    (def/graph-analysis/diagnostics/state/tpl/backup/migration/conflict/
//    watch/changes/impact/ibuild/policy) delegating to 19 command modules,
//    all mocked. The inline migrate-monorepo action keeps json-output REAL
//    (envelope asserted from the stdout gate spy) and fs-extra real.

// --- shared: spinner (statically + dynamically imported) ------------------
vi.mock('../../src/utils/spinner', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(function (this: any) { return this; }),
    stop: vi.fn(function (this: any) { return this; }),
    setText: vi.fn(function (this: any) { return this; }),
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
  flushOutput: vi.fn(),
}));

// --- api.group util mocks --------------------------------------------------
vi.mock('../../src/utils/openapi-generator', () => ({
  createOpenAPIGenerator: vi.fn(),
  formatOpenAPISpec: vi.fn(() => 'title: PetStore'),
  getSupportedFrameworks: vi.fn(() => ['express', 'nestjs', 'fastify', 'fastapi', 'django', 'flask', 'rails', 'spring-boot', 'aspnet-core', 'gin', 'chi', 'fiber', 'actix', 'axum']),
  OpenAPIGenerator: vi.fn(),
}));
vi.mock('../../src/utils/swagger-ui', () => ({
  generateSwaggerUIHTML: vi.fn(() => '<html>swagger</html>'),
  formatSwaggerUIConfig: vi.fn(() => 'Title: API Documentation'),
  detectServices: vi.fn(),
  generateSwaggerUI: vi.fn(),
  getThemePresets: vi.fn(() => ({ blue: { color: '#3b82f6', name: 'Blue' }, green: { color: '#22c55e', name: 'Green' } })),
}));
vi.mock('../../src/utils/api-versioning', () => ({
  createVersioningGenerator: vi.fn(),
  formatVersioningConfig: vi.fn(config => `Strategy: ${config.strategy}`),
  detectBreakingChanges: vi.fn(),
  formatBreakingChanges: vi.fn(changes => `${changes.length} change(s)`),
  generateMigrationGuide: vi.fn(() => '# Migration Guide'),
  getVersioningTemplate: vi.fn(),
}));
vi.mock('../../src/utils/validation-middleware', () => ({
  generateValidationMiddleware: vi.fn(() => '// validation middleware'),
  getValidationTemplate: vi.fn(),
  formatValidationTemplate: vi.fn(() => 'Framework: express'),
}));
vi.mock('../../src/utils/api-testing', () => ({
  generateUnitTestCode: vi.fn(() => '// unit tests'),
  generateIntegrationTestCode: vi.fn(() => '// integration tests'),
  generateContractTestCode: vi.fn(() => '// contract tests'),
  generateMockServerCode: vi.fn(() => '// mock server'),
  generateLoadTestCode: vi.fn(() => '// load tests'),
  generateTestConfig: vi.fn(() => '// test config'),
  getTestingTemplate: vi.fn(),
  formatAPITestConfig: vi.fn(() => 'Framework: express'),
  listTestingFrameworks: vi.fn(() => [{ name: 'express', language: 'TypeScript', testFramework: 'jest' }]),
}));
vi.mock('../../src/utils/interactive-docs', () => ({
  generateDocsFromSpec: vi.fn(),
  generateInteractiveDocsHTML: vi.fn(() => '<html>docs</html>'),
  openAPIToInteractiveDocs: vi.fn(() => ({
    title: 'PetStore', description: '', themeColor: '#3b82f6',
    authConfig: { type: 'none' },
  })),
  formatInteractiveDocsConfig: vi.fn(() => 'Title: PetStore'),
}));
vi.mock('../../src/utils/api-gateway', () => ({
  getGatewayTemplate: vi.fn(),
  generateGatewayConfig: vi.fn(() => 'gateway-config-content'),
  formatGatewayConfig: vi.fn(() => 'Gateway: api-gateway'),
  generateGatewayDockerCompose: vi.fn(() => 'version: "3"'),
  listGatewayTypes: vi.fn(() => [{ type: 'kong', description: 'Kong Gateway' }]),
}));
vi.mock('../../src/utils/api-analytics', () => ({
  generateAnalyticsSetup: vi.fn(),
  generateAnalyticsMiddleware: vi.fn(() => '// analytics middleware line 1'),
  generateAnalyticsDockerCompose: vi.fn(() => 'version: "3"'),
  getAnalyticsProvider: vi.fn(),
  listAnalyticsProviders: vi.fn(() => [{ provider: 'prometheus', description: 'Prometheus + Grafana' }]),
  listSupportedFrameworks: vi.fn(() => ['express', 'nestjs', 'fastapi']),
}));
vi.mock('../../src/utils/typescript-client', () => ({
  generateClient: vi.fn(() => '// api client'),
  generateEnhancedClient: vi.fn(() => '// enhanced client'),
  generateReactQueryHooks: vi.fn(() => '// hooks'),
  generateVueComposables: vi.fn(() => '// composables'),
  generatePiniaStores: vi.fn(() => '// pinia'),
  generateAngularService: vi.fn(() => '// angular service'),
  generateSvelteStores: vi.fn(() => '// svelte stores'),
  generateSvelteKitSdk: vi.fn(() => '// sveltekit sdk'),
  generateMockServer: vi.fn(() => '// mock server'),
  validateSpec: vi.fn(() => ({ valid: true, errors: [] })),
  listOperations: vi.fn(() => [
    { method: 'get', path: '/pets', description: 'List pets' },
    { method: 'post', path: '/pets', description: 'Create pet' },
  ]),
  generateInterfaces: vi.fn(() => 'export interface Pet {}'),
}));
vi.mock('../../src/utils/framework-sdk', () => ({
  generateFrameworkSdkBundle: vi.fn(() => '// sdk bundle'),
  generateBundleConfig: vi.fn(() => '// bundler config'),
}));

// --- plugin.group handler mocks -------------------------------------------
vi.mock('../../src/commands/plugin-create', () => ({
  createPluginCommand: vi.fn(),
  validatePublish: vi.fn(),
}));
vi.mock('../../src/commands/plugin', () => ({
  managePlugins: vi.fn(), discoverPlugins: vi.fn(), installPlugin: vi.fn(),
  uninstallPlugin: vi.fn(), showPluginInfo: vi.fn(), enablePlugin: vi.fn(),
  disablePlugin: vi.fn(), updatePlugins: vi.fn(), validatePlugin: vi.fn(),
  clearPluginCache: vi.fn(), showPluginStats: vi.fn(), reloadPlugin: vi.fn(),
  showPluginHooks: vi.fn(), executeHook: vi.fn(), listHookTypes: vi.fn(),
}));
vi.mock('../../src/commands/plugin-cache', () => ({
  showCacheStats: vi.fn(), configureCacheSettings: vi.fn(), clearCache: vi.fn(),
  testCachePerformance: vi.fn(), optimizeCache: vi.fn(), listCachedCommands: vi.fn(),
}));
vi.mock('../../src/commands/plugin-command', () => ({
  listPluginCommands: vi.fn(), showCommandConflicts: vi.fn(), resolveCommandConflicts: vi.fn(),
  showCommandStats: vi.fn(), registerTestCommand: vi.fn(), unregisterCommand: vi.fn(),
  showCommandInfo: vi.fn(),
}));
vi.mock('../../src/commands/plugin-conflicts', () => ({
  listCommandConflicts: vi.fn(), showConflictStrategies: vi.fn(), resolveConflict: vi.fn(),
  autoResolveConflicts: vi.fn(), showConflictStats: vi.fn(), setPriorityOverride: vi.fn(),
  showResolutionHistory: vi.fn(),
}));
vi.mock('../../src/commands/plugin-dependency', () => ({
  resolveDependencies: vi.fn(), showDependencyTree: vi.fn(), checkConflicts: vi.fn(),
  validateVersions: vi.fn(), updateDependencies: vi.fn(),
}));
vi.mock('../../src/commands/plugin-docs', () => ({
  generatePluginDocumentation: vi.fn(), showCommandHelp: vi.fn(), listDocumentedCommands: vi.fn(),
  searchDocumentation: vi.fn(), showDocumentationStats: vi.fn(), configureHelpSystem: vi.fn(),
  showDocumentationTemplates: vi.fn(),
}));
vi.mock('../../src/commands/plugin-marketplace', () => ({
  searchMarketplace: vi.fn(), showPluginDetails: vi.fn(), installMarketplacePlugin: vi.fn(),
  showFeaturedPlugins: vi.fn(), showPopularPlugins: vi.fn(), showCategories: vi.fn(),
  clearMarketplaceCache: vi.fn(), showMarketplaceStats: vi.fn(),
}));
vi.mock('../../src/commands/plugin-middleware', () => ({
  listMiddleware: vi.fn(), showMiddlewareStats: vi.fn(), testMiddleware: vi.fn(),
  clearMiddlewareCache: vi.fn(), showMiddlewareChain: vi.fn(), createExampleMiddleware: vi.fn(),
}));
vi.mock('../../src/commands/plugin-security', () => ({
  scanPluginSecurity: vi.fn(), checkSecurityPolicy: vi.fn(), generateSecurityReport: vi.fn(),
  fixSecurityIssues: vi.fn(),
}));
vi.mock('../../src/commands/plugin-validation', () => ({
  testCommandValidation: vi.fn(), createCommandValidationSchema: vi.fn(), listValidationRules: vi.fn(),
  listTransformations: vi.fn(), showCommandValidationSchema: vi.fn(), showValidationStats: vi.fn(),
  generateValidationTemplate: vi.fn(),
}));

// --- workspace.group handler mocks ----------------------------------------
vi.mock('../../src/commands/workspace', () => ({
  listWorkspaces: vi.fn(), updateWorkspaces: vi.fn(), generateWorkspaceGraph: vi.fn(),
  initWorkspace: vi.fn(), validateWorkspaceConfig: vi.fn(), checkWorkspaceHealth: vi.fn(),
  migrateWorkspace: vi.fn(), optimizeWorkspace: vi.fn(), manageWorkspaceTemplates: vi.fn(),
  produceWorkspaceSummary: vi.fn(),
}));
vi.mock('../../src/commands/import-monorepo', () => ({ importFromMonorepo: vi.fn() }));
vi.mock('../../src/commands/migrate-monorepo', () => ({
  migrateMonorepo: vi.fn(),
}));
vi.mock('../../src/commands/workspace-definition', () => ({ manageWorkspaceDefinition: vi.fn() }));
vi.mock('../../src/commands/workspace-graph', () => ({ manageWorkspaceGraph: vi.fn() }));
vi.mock('../../src/commands/workspace-health', () => ({ manageWorkspaceHealth: vi.fn() }));
vi.mock('../../src/commands/workspace-state', () => ({ manageWorkspaceState: vi.fn() }));
vi.mock('../../src/commands/workspace-template', () => ({ manageWorkspaceTemplate: vi.fn() }));
vi.mock('../../src/commands/workspace-backup', () => ({ manageWorkspaceBackup: vi.fn() }));
vi.mock('../../src/commands/workspace-migration', () => ({ manageWorkspaceMigration: vi.fn() }));
vi.mock('../../src/commands/workspace-conflict', () => ({ manageWorkspaceConflict: vi.fn() }));
vi.mock('../../src/commands/file-watcher', () => ({ manageFileWatcher: vi.fn() }));
vi.mock('../../src/commands/change-detector', () => ({ manageChangeDetector: vi.fn() }));
vi.mock('../../src/commands/change-impact', () => ({
  manageChangeImpact: vi.fn(), analyzeWorkspaceImpact: vi.fn(),
}));
vi.mock('../../src/commands/incremental-build', () => ({ manageIncrementalBuild: vi.fn() }));
vi.mock('../../src/commands/workspace-policy', () => ({
  runPolicyCheck: vi.fn(), runDriftCheck: vi.fn(),
}));
vi.mock('../../src/commands/workspace-docs', () => ({ generateWorkspaceDocs: vi.fn() }));
vi.mock('../../src/commands/workspace-diff', () => ({ diffWorkspace: vi.fn() }));

const { registerApiGroup } = await import('../../src/groups/api.group');
const { registerPluginGroup } = await import('../../src/groups/plugin.group');
const { registerWorkspaceGroup } = await import('../../src/groups/workspace.group');

const openapiGen = await import('../../src/utils/openapi-generator');
const swaggerUi = await import('../../src/utils/swagger-ui');
const versioning = await import('../../src/utils/api-versioning');
const validation = await import('../../src/utils/validation-middleware');
const apiTesting = await import('../../src/utils/api-testing');
const interactiveDocs = await import('../../src/utils/interactive-docs');
const gateway = await import('../../src/utils/api-gateway');
const analytics = await import('../../src/utils/api-analytics');
const tsClient = await import('../../src/utils/typescript-client');
const frameworkSdk = await import('../../src/utils/framework-sdk');

const pluginCreate = await import('../../src/commands/plugin-create');
const pluginCmds = await import('../../src/commands/plugin');
const pluginMarketplace = await import('../../src/commands/plugin-marketplace');
const pluginDependency = await import('../../src/commands/plugin-dependency');

const workspaceCmds = await import('../../src/commands/workspace');
const importMonorepo = await import('../../src/commands/import-monorepo');
const migrateMonorepoCmd = await import('../../src/commands/migrate-monorepo');
const workspaceDef = await import('../../src/commands/workspace-definition');
const workspaceGraph = await import('../../src/commands/workspace-graph');
const workspaceState = await import('../../src/commands/workspace-state');
const fileWatcher = await import('../../src/commands/file-watcher');
const changeDetector = await import('../../src/commands/change-detector');
const changeImpact = await import('../../src/commands/change-impact');
const incrementalBuild = await import('../../src/commands/incremental-build');
const workspacePolicy = await import('../../src/commands/workspace-policy');
const workspaceDocs = await import('../../src/commands/workspace-docs');
const workspaceDiff = await import('../../src/commands/workspace-diff');
const spinnerUtil = await import('../../src/utils/spinner');

describe('groups — api / plugin / workspace registration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let tempRoot: string;
  let realCwd: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBefore: string | number | undefined;

  // Several api.group actions write companion files to hardcoded relative
  // paths ('./prometheus.yml', 'mock-server.ts', 'webpack.config.js', ...).
  // A process.cwd spy does NOT redirect fs writes (Node resolves relatives
  // against the worker's real cwd), so those tests capture the real cwd
  // upfront and scrub the strays here.
  const RELATIVE_STRAYS = [
    'prometheus.yml', 'grafana-dashboard.json', 'alerts.yml', 'docker-compose.yml',
    'mock-server.ts', 'mock-server.package.json', 'webpack.config.js',
    'rollup.config.js', 'vite.config.ts',
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    exitCodeBefore = process.exitCode;
    realCwd = process.cwd();
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'groups-apw-'));
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((() => true) as never);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    logSpy.mockRestore();
    cwdSpy.mockRestore();
    process.exitCode = exitCodeBefore;
    vi.restoreAllMocks();
    fs.rmSync(tempRoot, { recursive: true, force: true });
    for (const stray of RELATIVE_STRAYS) {
      const file = path.join(realCwd, stray);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  function output(): string {
    return logSpy.mock.calls.map(call => call.join(' ')).join('\n');
  }

  function jsonChunks(): string[] {
    return stdoutSpy.mock.calls
      .map(call => String(call[0]))
      .filter(chunk => chunk.trim().startsWith('{'));
  }

  function programWith(register: (p: Command) => void): Command {
    const program = new Command();
    program.exitOverride();
    register(program);
    return program;
  }

  function sub(program: Command, ...names: string[]): Command {
    let cmd: Command = program;
    for (const name of names) {
      const next = cmd.commands.find(c => c.name() === name);
      expect(next, `missing command ${names.join(' ')}`).toBeDefined();
      cmd = next!;
    }
    return cmd;
  }

  // ========================================================================
  // api.group.ts
  // ========================================================================
  describe('api group', () => {
    function generatorFixture() {
      return {
        detectFramework: vi.fn().mockResolvedValue('express'),
        generateSpec: vi.fn().mockResolvedValue({
          paths: { '/users': { get: { summary: 'List users' }, post: { summary: 'Create user' } } },
        }),
        discoverRoutes: vi.fn().mockResolvedValue([
          { method: 'get', path: '/users', operation: 'listUsers', tags: ['users'], parameters: [{ name: 'limit' }] },
        ]),
      };
    }

    it('registers the nine api sections with their subcommands', () => {
      const program = programWith(registerApiGroup);
      const api = sub(program, 'api');
      expect(api.commands.map(c => c.name())).toEqual([
        'openapi', 'swagger', 'versioning', 'validation', 'test',
        'docs', 'gateway', 'analytics', 'client',
      ]);
      expect(sub(program, 'api', 'openapi').commands.map(c => c.name())).toEqual([
        'generate', 'discover', 'list-frameworks', 'annotate',
      ]);
      expect(sub(program, 'api', 'swagger').commands.map(c => c.name())).toEqual([
        'generate', 'multi-service', 'list-services', 'themes',
      ]);
      expect(sub(program, 'api', 'versioning').commands.map(c => c.name())).toEqual([
        'init', 'middleware', 'compare', 'migrate', 'template', 'list-strategies',
      ]);
      expect(sub(program, 'api', 'validation').commands.map(c => c.name())).toEqual([
        'generate', 'template', 'list-frameworks', 'schema',
      ]);
      expect(sub(program, 'api', 'test').commands.map(c => c.name())).toEqual([
        'generate', 'unit', 'integration', 'contract', 'mock', 'load',
        'list-frameworks', 'config',
      ]);
      expect(sub(program, 'api', 'docs').commands.map(c => c.name())).toEqual([
        'generate', 'serve', 'preview', 'themes',
      ]);
      expect(sub(program, 'api', 'gateway').commands.map(c => c.name())).toEqual([
        'generate', 'docker-compose', 'list', 'template',
      ]);
      expect(sub(program, 'api', 'analytics').commands.map(c => c.name())).toEqual([
        'generate', 'docker-compose', 'list-providers', 'list-frameworks', 'template',
      ]);
      expect(sub(program, 'api', 'client').commands.map(c => c.name())).toEqual([
        'generate', 'list', 'validate', 'types', 'sdk',
      ]);
    });

    it('openapi generate --dry-run renders the spec without writing', async () => {
      const gen = generatorFixture();
      vi.mocked(openapiGen.createOpenAPIGenerator).mockResolvedValue(gen as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'openapi', 'generate', tempRoot,
        '--framework', 'express', '--dry-run',
      ]);

      expect(gen.generateSpec).toHaveBeenCalled();
      expect(output()).toContain('title: PetStore');
      expect(output()).toContain('Dry run - no file written.');
      expect(fs.existsSync(path.join(tempRoot, 'openapi.yaml'))).toBe(false);
    });

    it('openapi generate writes via OpenAPIGenerator and lists endpoints', async () => {
      const gen = generatorFixture();
      vi.mocked(openapiGen.createOpenAPIGenerator).mockResolvedValue(gen as never);
      const writeSpec = vi.fn().mockResolvedValue(undefined);
      vi.mocked(openapiGen.OpenAPIGenerator).mockImplementation((() => ({
        writeSpec,
      })) as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'openapi', 'generate', tempRoot,
        '--framework', 'express', '--output', 'spec.yaml', '--format', 'json',
        '--port', '8080', '--base-path', '/v2',
      ]);

      expect(writeSpec).toHaveBeenCalledWith(
        path.join(tempRoot, 'spec.yaml'),
        'json',
        expect.objectContaining({ info: expect.objectContaining({ title: path.basename(tempRoot) }) })
      );
      expect(output()).toContain('Framework: express');
      expect(output()).toContain('Endpoints: 1');
      expect(output()).toContain('GET');
      expect(output()).toContain('/users');
    });

    it('openapi discover emits JSON and groups routes by tag', async () => {
      const gen = generatorFixture();
      vi.mocked(openapiGen.createOpenAPIGenerator).mockResolvedValue(gen as never);
      const program = programWith(registerApiGroup);

      await program.parseAsync(['node', 're-shell', 'api', 'openapi', 'discover', tempRoot, '--json']);
      expect(JSON.parse(logSpy.mock.calls.at(-1)![0] as string)).toHaveLength(1);

      await programWith(registerApiGroup).parseAsync([
        'node', 're-shell', 'api', 'openapi', 'discover', tempRoot,
      ]);
      expect(output()).toContain('Discovered 1 routes');
      expect(output()).toContain('users:');
      expect(output()).toContain('GET');
      expect(output()).toContain('Params: limit');
    });

    it('openapi annotate renders framework annotations', async () => {
      vi.mocked(openapiGen.OpenAPIGenerator).mockImplementation((() => ({
        generateAnnotatedCode: vi.fn(() => '// annotated express route'),
      })) as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'openapi', 'annotate', 'express',
        '--route', '/orders', '--method', 'post',
      ]);
      expect(output()).toContain('annotated express route');
    });

    it('swagger generate renders single-service config and writes the HTML', async () => {
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'swagger', 'generate', tempRoot,
        '--spec', 'https://api.example.com/openapi.json', '--service-name', 'petstore',
        '--no-try-it-out',
      ]);
      const config = vi.mocked(swaggerUi.generateSwaggerUIHTML).mock.calls[0][0] as any;
      expect(config.services).toEqual([
        expect.objectContaining({ name: 'petstore', url: 'https://api.example.com/openapi.json' }),
      ]);
      expect(config.tryItOutEnabled).toBe(false);
      expect(config.persistAuthorization).toBe(true);
      expect(fs.readFileSync(path.join(tempRoot, 'swagger-ui.html'), 'utf-8')).toBe('<html>swagger</html>');
      expect(output()).toContain('Swagger UI generated successfully');
    });

    it('swagger multi-service warns when no specs are found', async () => {
      vi.mocked(swaggerUi.detectServices).mockResolvedValue([]);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'swagger', 'multi-service', tempRoot]);
      expect(output()).toContain('No services found with OpenAPI specs');
      expect(swaggerUi.generateSwaggerUI).not.toHaveBeenCalled();
    });

    it('swagger multi-service writes one UI for all detected services', async () => {
      vi.mocked(swaggerUi.detectServices).mockResolvedValue([
        { name: 'users', specPath: 'users/openapi.yaml' },
        { name: 'orders', specPath: 'orders/openapi.yaml' },
      ] as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'swagger', 'multi-service', tempRoot]);
      expect(swaggerUi.generateSwaggerUI).toHaveBeenCalledWith(
        path.join(tempRoot, 'swagger-ui.html'),
        expect.objectContaining({ services: expect.anything() })
      );
      expect(output()).toContain('Services: 2');
      expect(output()).toContain('users');
    });

    it('versioning init builds the config via the generator (dry-run vs write)', async () => {
      const gen = {
        generateVersioningConfig: vi.fn().mockReturnValue({ strategy: 'header', defaultVersion: '2' }),
        writeConfig: vi.fn(),
      };
      vi.mocked(versioning.createVersioningGenerator).mockResolvedValue(gen as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'versioning', 'init', tempRoot,
        '--strategy', 'header', '--default-version', '2', '--dry-run',
      ]);
      expect(gen.generateVersioningConfig).toHaveBeenCalledWith({
        strategy: 'header', defaultVersion: '2', headerName: 'X-API-Version',
      });
      expect(output()).toContain('Strategy: header');
      expect(gen.writeConfig).not.toHaveBeenCalled();

      await programWith(registerApiGroup).parseAsync([
        'node', 're-shell', 'api', 'versioning', 'init', tempRoot,
      ]);
      expect(gen.writeConfig).toHaveBeenCalledWith(
        path.join(tempRoot, 'api-versioning.json'),
        expect.anything()
      );
    });

    it('versioning compare flags breaking changes between two real spec files', async () => {
      const oldSpec = path.join(tempRoot, 'old.json');
      const newSpec = path.join(tempRoot, 'new.json');
      fs.writeFileSync(oldSpec, JSON.stringify({ info: { title: 'old', version: '1' } }));
      fs.writeFileSync(newSpec, JSON.stringify({ info: { title: 'new', version: '2' } }));
      vi.mocked(versioning.detectBreakingChanges).mockReturnValue([
        { type: 'removed-endpoint', description: 'GET /pets removed' },
      ] as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'versioning', 'compare', oldSpec, newSpec]);
      expect(versioning.detectBreakingChanges).toHaveBeenCalledWith(
        { info: { title: 'old', version: '1' } },
        { info: { title: 'new', version: '2' } }
      );
      expect(output()).toContain('1 breaking change(s)');
      expect(output()).toContain('Consider a major version bump');
    });

    it('versioning compare celebrates zero breaking changes', async () => {
      const a = path.join(tempRoot, 'a.json');
      const b = path.join(tempRoot, 'b.json');
      fs.writeFileSync(a, '{}');
      fs.writeFileSync(b, '{}');
      vi.mocked(versioning.detectBreakingChanges).mockReturnValue([] as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'versioning', 'compare', a, b]);
      expect(output()).toContain('No breaking changes');
    });

    it('versioning migrate writes MIGRATION.md with the detected changes', async () => {
      const oldSpec = path.join(tempRoot, 'old.json');
      const newSpec = path.join(tempRoot, 'new.json');
      fs.writeFileSync(oldSpec, '{}');
      fs.writeFileSync(newSpec, '{}');
      vi.mocked(versioning.detectBreakingChanges).mockReturnValue([{ d: 1 }] as never);
      const program = programWith(registerApiGroup);
      const migrationDoc = path.join(tempRoot, 'MIGRATION.md');
      await program.parseAsync([
        'node', 're-shell', 'api', 'versioning', 'migrate', '1', '2',
        '--old-spec', oldSpec, '--new-spec', newSpec,
        '--output', migrationDoc,
      ]);
      expect(fs.readFileSync(migrationDoc, 'utf-8')).toBe('# Migration Guide');
      expect(output()).toContain('Breaking Changes: 1');
    });

    it('versioning template warns for unknown frameworks', async () => {
      vi.mocked(versioning.getVersioningTemplate).mockReturnValue(undefined);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'versioning', 'template', 'cobol']);
      expect(output()).toContain('No versioning template found for cobol');
    });

    it('validation generate guards missing and unknown frameworks, then writes', async () => {
      const program = programWith(registerApiGroup);

      await program.parseAsync(['node', 're-shell', 'api', 'validation', 'generate', tempRoot]);
      expect(output()).toContain('Please specify a framework');
      expect(validation.generateValidationMiddleware).not.toHaveBeenCalled();

      vi.mocked(validation.getValidationTemplate).mockReturnValue(undefined);
      await programWith(registerApiGroup).parseAsync([
        'node', 're-shell', 'api', 'validation', 'generate', tempRoot, '--framework', 'cobol',
      ]);
      expect(output()).toContain('No validation template found for cobol');

      vi.mocked(validation.getValidationTemplate).mockReturnValue({
        middlewareFile: 'src/middleware/validation.ts', dependencies: ['joi'],
      } as never);
      await programWith(registerApiGroup).parseAsync([
        'node', 're-shell', 'api', 'validation', 'generate', tempRoot,
        '--framework', 'express', '--mode', 'strict', '--response',
      ]);
      expect(validation.generateValidationMiddleware).toHaveBeenCalledWith('express', {
        mode: 'strict', validateRequest: true, validateResponse: true, stripUnknown: true,
      });
      expect(fs.readFileSync(path.join(tempRoot, 'src/middleware/validation.ts'), 'utf-8'))
        .toContain('validation middleware');
      expect(output()).toContain('npm install');
      expect(output()).toContain('joi');
    });

    it('validation schema renders framework-specific validation code', async () => {
      vi.mocked(validation.getValidationTemplate).mockReturnValue({} as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'validation', 'schema', 'express',
        '--model-name', 'Pet', '--fields', 'name:string:required,age:number:min=1',
      ]);
      expect(output()).toContain('Joi');
      expect(output()).toContain('Joi.string()');
      expect(output()).toContain('Joi.number()');
      expect(output()).toContain('.min(1)');
    });

    it('api test generate previews per include flag in dry-run', async () => {
      vi.mocked(apiTesting.getTestingTemplate).mockReturnValue({
        setupCommands: ['npm i -D jest'],
      } as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'test', 'generate', tempRoot,
        '--framework', 'express', '--include-contract', '--include-mock', '--include-load',
        '--dry-run',
      ]);
      expect(apiTesting.formatAPITestConfig).toHaveBeenCalledWith(expect.objectContaining({
        framework: 'express', testTypes: ['unit', 'integration'],
        includeContractTests: true, includeMockServer: true, includeLoadTests: true,
      }));
      expect(output()).toContain('Unit Test Preview');
      expect(output()).toContain('Contract Test Preview');
      expect(output()).toContain('Mock Server Preview');
      expect(output()).toContain('Load Test Preview');
    });

    it('api test mock coerces the port and renders the generated code', async () => {
      vi.mocked(apiTesting.getTestingTemplate).mockReturnValue({} as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'test', 'mock', 'express', '--port', '4000']);
      expect(apiTesting.generateMockServerCode).toHaveBeenCalledWith('express', {
        port: 4000, host: 'localhost', cors: true,
      });
      expect(output()).toContain('mock server');
    });

    it('api test load coerces duration/concurrency ints', async () => {
      vi.mocked(apiTesting.getTestingTemplate).mockReturnValue({} as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'test', 'load', 'express',
        '--base-url', 'https://api.test', '--duration', '120', '--concurrency', '50',
      ]);
      expect(apiTesting.generateLoadTestCode).toHaveBeenCalledWith('express', {
        baseUrl: 'https://api.test', duration: 120, concurrency: 50, rampUp: 10,
        scenarios: [{ name: 'Default Scenario', weight: 100, requests: [] }],
      });
    });

    it('docs generate applies overrides and delegates to the real generator', async () => {
      const specFile = path.join(tempRoot, 'petstore.json');
      fs.writeFileSync(specFile, JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Petstore', version: '1.0.0' },
        paths: {},
      }));
      vi.mocked(interactiveDocs.generateDocsFromSpec).mockResolvedValue(undefined);
      const program = programWith(registerApiGroup);
      await program.parseAsync([
        'node', 're-shell', 'api', 'docs', 'generate', specFile, 'out.html',
        '--title', 'Petstore API', '--theme-color', '#ff0000', '--auth-type', 'bearer',
      ]);
      const config = vi.mocked(interactiveDocs.openAPIToInteractiveDocs).mock.results[0].value as any;
      expect(config.title).toBe('Petstore API');
      expect(config.themeColor).toBe('#ff0000');
      expect(config.authConfig).toEqual({ type: 'bearer' });
      expect(interactiveDocs.generateDocsFromSpec).toHaveBeenCalledWith(specFile, 'out.html', 'http://localhost:3000');
      expect(output()).toContain('Documentation generated!');
    });

    it('docs generate warns for a missing spec and never calls the generator', async () => {
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'docs', 'generate', 'nope.json']);
      expect(output()).toContain('Spec file not found: nope.json');
      expect(interactiveDocs.generateDocsFromSpec).not.toHaveBeenCalled();
    });

    it('gateway generate parses pipe-separated services/routes and rate limits', async () => {
      vi.mocked(gateway.getGatewayTemplate).mockReturnValue({
        configPath: './kong.yml', format: 'yaml', description: 'Kong', docsUrl: '',
      } as never);
      const program = programWith(registerApiGroup);
      const gwFile = path.join(tempRoot, 'gw.yml');
      await program.parseAsync([
        'node', 're-shell', 'api', 'gateway', 'generate', 'kong', gwFile,
        '--services', 'users;Users;http://localhost:3001|orders;Orders;http://localhost:3002',
        '--routes', 'users;/api/users;GET,POST;users',
        '--rate-limit', '100', '--rate-window', '30', '--cors', '--auth', 'jwt',
      ]);
      const config = vi.mocked(gateway.generateGatewayConfig).mock.calls[0][1] as any;
      expect(config.services).toEqual([
        { id: 'users', name: 'Users', url: 'http://localhost:3001' },
        { id: 'orders', name: 'Orders', url: 'http://localhost:3002' },
      ]);
      expect(config.routes).toEqual([
        { id: 'users', path: '/api/users', method: ['GET', 'POST'], service: 'users' },
      ]);
      expect(config.rateLimit).toEqual({ enabled: true, window: 30, limit: 100 });
      expect(config.cors.origins).toEqual(['*']);
      expect(config.auth).toEqual({ type: 'jwt' });
      expect(fs.readFileSync(gwFile, 'utf-8')).toBe('gateway-config-content');
    });

    it('gateway generate rejects unsupported types', async () => {
      vi.mocked(gateway.getGatewayTemplate).mockReturnValue(undefined);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'gateway', 'generate', 'mystery', '--dry-run']);
      expect(output()).toContain('Unsupported gateway type: mystery');
      expect(gateway.generateGatewayConfig).not.toHaveBeenCalled();
    });

    it('analytics generate validates provider + framework and writes the middleware', async () => {
      vi.mocked(analytics.generateAnalyticsSetup).mockReturnValue({
        middleware: '// analytics middleware',
        prometheusConfig: 'global: scrape',
        grafanaDashboard: '{"dash":1}',
        alertRules: 'groups: []',
        dockerCompose: 'version: "3"',
      } as never);
      const program = programWith(registerApiGroup);

      await program.parseAsync(['node', 're-shell', 'api', 'analytics', 'generate', 'datadog', 'express']);
      expect(output()).toContain('Unsupported provider: datadog');

      await programWith(registerApiGroup).parseAsync(['node', 're-shell', 'api', 'analytics', 'generate', 'prometheus', 'cobol']);
      expect(output()).toContain('Unsupported framework: cobol');

      const analyticsFile = path.join(tempRoot, 'analytics.ts');
      await programWith(registerApiGroup).parseAsync([
        'node', 're-shell', 'api', 'analytics', 'generate', 'prometheus', 'express', analyticsFile,
        '--custom-metrics', 'orders_total,counter,Order count|failures,gauge,Failures',
        '--dashboard', '--alerts',
      ]);
      const config = vi.mocked(analytics.generateAnalyticsSetup).mock.calls[0][0] as any;
      expect(config.metrics).toEqual([
        { name: 'orders_total', type: 'counter', description: 'Order count' },
        { name: 'failures', type: 'gauge', description: 'Failures' },
      ]);
      expect(config.dashboard).toBe(true);
      expect(config.alerts).toHaveLength(1);
      expect(fs.readFileSync(analyticsFile, 'utf-8')).toContain('analytics middleware');
      // The companion files are hardcoded to './<name>' so they land in the
      // REAL cwd (the cwd spy cannot redirect fs writes); they are scrubbed in
      // afterEach.
      expect(fs.existsSync(path.join(realCwd, 'prometheus.yml'))).toBe(true);
      expect(fs.existsSync(path.join(realCwd, 'grafana-dashboard.json'))).toBe(true);
      expect(fs.existsSync(path.join(realCwd, 'alerts.yml'))).toBe(true);
      expect(fs.existsSync(path.join(realCwd, 'docker-compose.yml'))).toBe(true);
    });

    it('client generate writes the client + framework extras from a real spec', async () => {
      const specFile = path.join(tempRoot, 'spec.json');
      fs.writeFileSync(specFile, JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Pet Store', version: '1.0.0' },
        paths: { '/pets': { get: {} } },
      }));
      const program = programWith(registerApiGroup);
      const clientFile = path.join(tempRoot, 'pet-client.ts');
      await program.parseAsync([
        'node', 're-shell', 'api', 'client', 'generate', specFile, clientFile,
        '--framework', 'react', '--name', 'PetStore', '--fetch',
      ]);
      const options = vi.mocked(tsClient.generateClient).mock.calls[0][1] as any;
      expect(options.clientName).toBe('PetStore');
      expect(options.useAxios).toBe(false);
      expect(tsClient.generateReactQueryHooks).toHaveBeenCalled();
      expect(fs.existsSync(clientFile)).toBe(true);
      expect(fs.existsSync(path.join(tempRoot, 'pet-client-hooks.ts'))).toBe(true);
      expect(output()).toContain('Operations: 2');
    });

    it('client generate takes the enhanced path and vue/angular/svelte extras', async () => {
      const specFile = path.join(tempRoot, 'spec.json');
      fs.writeFileSync(specFile, JSON.stringify({
        openapi: '3.0.0', info: { title: 'Pet Store', version: '1.0.0' }, paths: {},
      }));
      const base = ['node', 're-shell', 'api', 'client', 'generate', specFile];

      await programWith(registerApiGroup).parseAsync([...base, path.join(tempRoot, 'c1.ts'), '--enhanced']);
      expect(tsClient.generateEnhancedClient).toHaveBeenCalled();
      expect(tsClient.generateClient).not.toHaveBeenCalled();

      await programWith(registerApiGroup).parseAsync([...base, path.join(tempRoot, 'c2.ts'), '--framework', 'vue', '--pinia']);
      expect(tsClient.generateVueComposables).toHaveBeenCalled();
      expect(tsClient.generatePiniaStores).toHaveBeenCalled();

      await programWith(registerApiGroup).parseAsync([...base, path.join(tempRoot, 'c3.ts'), '--framework', 'angular']);
      expect(tsClient.generateAngularService).toHaveBeenCalled();

      await programWith(registerApiGroup).parseAsync([...base, path.join(tempRoot, 'c4.ts'), '--framework', 'svelte', '--sveltekit']);
      expect(tsClient.generateSvelteStores).toHaveBeenCalled();
      expect(tsClient.generateSvelteKitSdk).toHaveBeenCalled();
      expect(fs.existsSync(path.join(tempRoot, 'c4-sdk.ts'))).toBe(true);
    });

    it('client validate reports invalid specs from the validator', async () => {
      const specFile = path.join(tempRoot, 'bad.json');
      fs.writeFileSync(specFile, JSON.stringify({
        openapi: '3.0.0', info: { title: 'Bad', version: '0' }, paths: {},
      }));
      vi.mocked(tsClient.validateSpec).mockReturnValue({
        valid: false, errors: ['info.version is required'],
      } as never);
      const program = programWith(registerApiGroup);
      await program.parseAsync(['node', 're-shell', 'api', 'client', 'validate', specFile]);
      expect(output()).toContain('OpenAPI Specification Invalid');
      expect(output()).toContain('info.version is required');
    });

    it('client sdk writes the bundle plus the bundler config', async () => {
      const specFile = path.join(tempRoot, 'spec.json');
      fs.writeFileSync(specFile, JSON.stringify({
        openapi: '3.0.0', info: { title: 'Pet Store', version: '1.0.0' }, paths: {},
      }));
      const program = programWith(registerApiGroup);
      const sdkFile = path.join(tempRoot, 'sdk.ts');
      await program.parseAsync([
        'node', 're-shell', 'api', 'client', 'sdk', specFile, sdkFile,
        '--framework', 'react', '--bundler', 'webpack',
      ]);
      expect(frameworkSdk.generateFrameworkSdkBundle).toHaveBeenCalledWith(expect.anything(), { framework: 'react' });
      expect(frameworkSdk.generateBundleConfig).toHaveBeenCalledWith('webpack');
      expect(fs.existsSync(sdkFile)).toBe(true);
      // The bundler config path is hardcoded relative ('webpack.config.js') →
      // real cwd; scrubbed in afterEach.
      expect(fs.existsSync(path.join(realCwd, 'webpack.config.js'))).toBe(true);
      expect(output()).toContain('Framework SDK generated!');
    });
  });

  // ========================================================================
  // plugin.group.ts
  // ========================================================================
  describe('plugin group', () => {
    it('registers all 74 plugin subcommands in declaration order', () => {
      const program = programWith(registerPluginGroup);
      const names = sub(program, 'plugin').commands.map(c => c.name());
      expect(names).toEqual([
        // lifecycle
        'list', 'discover', 'install', 'uninstall', 'info', 'enable', 'disable',
        'update', 'validate', 'clear-cache', 'stats', 'reload', 'hooks',
        'execute-hook', 'hook-types',
        // dependency
        'resolve', 'deps', 'conflicts', 'validate-versions', 'update-deps',
        // security
        'security-scan', 'security-policy', 'security-report', 'security-fix',
        // marketplace
        'search', 'show', 'install-marketplace', 'featured', 'popular',
        'categories', 'clear-marketplace-cache', 'marketplace-stats',
        // command registration
        'commands', 'command-conflicts', 'resolve-conflicts', 'command-stats',
        'register-command', 'unregister-command', 'command-info',
        // middleware
        'middleware', 'middleware-stats', 'test-middleware', 'clear-middleware-cache',
        'middleware-chain', 'middleware-example',
        // conflict resolution
        'list-conflicts', 'conflict-strategies', 'resolve-conflict', 'auto-resolve',
        'conflict-stats', 'set-priority', 'resolution-history',
        // docs
        'generate-docs', 'help', 'list-docs', 'search-docs', 'docs-stats',
        'configure-help', 'docs-templates',
        // validation
        'test-validation', 'create-schema', 'validation-rules', 'transformations',
        'show-schema', 'validation-stats', 'generate-template',
        // cache
        'cache-stats', 'configure-cache', 'clear-command-cache', 'test-cache',
        'optimize-cache', 'list-cached',
        // authoring
        'create', 'validate-publish',
      ]);
      expect(names).toHaveLength(74);
    });

    it('forwards plugin + options to the lifecycle handlers', async () => {
      const program = programWith(registerPluginGroup);
      await program.parseAsync([
        'node', 're-shell', 'plugin', 'install', '@scope/my-plugin',
        '--global', '--force', '--dry-run', '--json',
      ]);
      expect(pluginCmds.installPlugin).toHaveBeenCalledWith('@scope/my-plugin', {
        global: true, force: true, dryRun: true, json: true,
      });
    });

    it('resolve defaults to the strict strategy', async () => {
      const program = programWith(registerPluginGroup);
      await program.parseAsync(['node', 're-shell', 'plugin', 'resolve', 'my-plugin']);
      expect(pluginDependency.resolveDependencies).toHaveBeenCalledWith('my-plugin', {
        strategy: 'strict', allowPrerelease: undefined, ignoreOptional: undefined,
        autoInstall: undefined, dryRun: undefined, verbose: undefined, json: undefined,
      });
    });

    it('search forwards the catalogue defaults', async () => {
      const program = programWith(registerPluginGroup);
      await program.parseAsync(['node', 're-shell', 'plugin', 'search', 'lint']);
      expect(pluginMarketplace.searchMarketplace).toHaveBeenCalledWith('lint', {
        sort: 'relevance', order: 'desc', limit: '10',
        verbose: undefined, json: undefined,
      });
    });

    it('install-marketplace passes the explicit --no-verify opt-out', async () => {
      const program = programWith(registerPluginGroup);
      await program.parseAsync([
        'node', 're-shell', 'plugin', 'install-marketplace', 'cool-plugin', '1.2.3', '--no-verify',
      ]);
      expect(pluginMarketplace.installMarketplacePlugin).toHaveBeenCalledWith(
        'cool-plugin', '1.2.3', { verify: false, force: undefined, dryRun: undefined, verbose: undefined, json: undefined }
      );
    });

    it('generate-docs normalises negated options and variadic commands', async () => {
      const pluginDocs = await import('../../src/commands/plugin-docs');
      const program = programWith(registerPluginGroup);
      await program.parseAsync([
        'node', 're-shell', 'plugin', 'generate-docs', 'build', 'deploy',
        '--no-examples', '--no-index', '--format', 'html',
      ]);
      expect(pluginDocs.generatePluginDocumentation).toHaveBeenCalledWith(
        ['build', 'deploy'],
        { format: 'html', examples: false, index: false, includePrivate: undefined, includeDeprecated: undefined, output: undefined, template: 'markdown', verbose: undefined, json: undefined }
      );
    });

    it('create normalises the negated authoring flags', async () => {
      const program = programWith(registerPluginGroup);
      await program.parseAsync([
        'node', 're-shell', 'plugin', 'create', 'my-plugin',
        '--no-interactive', '--no-tests', '--no-ci', '--license', 'Apache-2.0',
      ]);
      expect(pluginCreate.createPluginCommand).toHaveBeenCalledWith('my-plugin', {
        interactive: false, tests: false, ci: false, license: 'Apache-2.0',
        description: undefined, author: undefined, type: 'both',
        hooks: undefined, commands: undefined, permissions: undefined,
        framework: 'universal', force: undefined, dryRun: undefined, json: undefined,
      });
    });

    it('validate-publish falls back to process.cwd() when no path is given', async () => {
      const program = programWith(registerPluginGroup);
      await program.parseAsync(['node', 're-shell', 'plugin', 'validate-publish']);
      expect(pluginCreate.validatePublish).toHaveBeenCalledWith(tempRoot, { json: undefined, verbose: undefined });
    });

    it('execute-hook forwards hook type and data', async () => {
      const program = programWith(registerPluginGroup);
      await program.parseAsync(['node', 're-shell', 'plugin', 'execute-hook', 'before-build', '{"x":1}']);
      expect(pluginCmds.executeHook).toHaveBeenCalledWith('before-build', '{"x":1}', {
        verbose: undefined, json: undefined,
      });
    });
  });

  // ========================================================================
  // workspace.group.ts
  // ========================================================================
  describe('workspace group', () => {
    it('registers the direct subcommands and all nested groups', () => {
      const program = programWith(registerWorkspaceGroup);
      const names = sub(program, 'workspace').commands.map(c => c.name());
      expect(names).toEqual([
        'summary', 'init', 'list', 'update', 'validate', 'health', 'migrate',
        'optimize', 'template', 'graph', 'import', 'migrate-monorepo', 'docs',
        'diff', 'def', 'graph-analysis', 'diagnostics', 'state', 'tpl',
        'backup', 'migration', 'conflict', 'watch', 'changes', 'impact',
        'ibuild', 'policy', 'drift',
      ]);
      // Nested group shapes.
      expect(sub(program, 'workspace', 'def').commands.map(c => c.name())).toEqual([
        'init', 'validate', 'structure', 'auto-detect', 'fix', 'interactive',
      ]);
      expect(sub(program, 'workspace', 'graph-analysis').commands.map(c => c.name())).toEqual([
        'analyze', 'cycles', 'order', 'critical', 'visualize', 'interactive',
      ]);
      expect(sub(program, 'workspace', 'diagnostics').commands.map(c => c.name())).toEqual([
        'check', 'topology', 'quick', 'watch', 'fix', 'interactive',
      ]);
      expect(sub(program, 'workspace', 'state').commands.map(c => c.name())).toEqual([
        'status', 'clear', 'backup', 'restore', 'cache', 'optimize', 'interactive',
      ]);
      expect(sub(program, 'workspace', 'watch').commands.map(c => c.name())).toEqual([
        'start', 'stop', 'status', 'stats', 'rules', 'add-rule', 'remove-rule', 'interactive',
      ]);
      expect(sub(program, 'workspace', 'changes').commands.map(c => c.name())).toEqual([
        'scan', 'status', 'stats', 'check', 'clear', 'watch', 'compare', 'interactive',
      ]);
      expect(sub(program, 'workspace', 'impact').commands.map(c => c.name())).toEqual([
        'analyze', 'workspace', 'graph',
      ]);
      expect(sub(program, 'workspace', 'ibuild').commands.map(c => c.name())).toEqual([
        'build', 'plan', 'stats', 'clear-cache',
      ]);
      expect(sub(program, 'workspace', 'policy').commands.map(c => c.name())).toEqual([
        'check',
      ]);
    });

    it('summary suppresses the spinner in json mode and forwards options', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync(['node', 're-shell', 'workspace', 'summary', '--json']);
      expect(workspaceCmds.produceWorkspaceSummary).toHaveBeenCalledWith(
        expect.objectContaining({ json: true })
      );
      const call = vi.mocked(workspaceCmds.produceWorkspaceSummary).mock.calls[0][0] as any;
      expect(call.spinner).toBeUndefined();
    });

    it('init/list/update/validate forward options with the spinner', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync(['node', 're-shell', 'workspace', 'init', '--yes']);
      expect(workspaceCmds.initWorkspace).toHaveBeenCalledWith({ yes: true });

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'list', '--type', 'app', '--json',
      ]);
      expect(workspaceCmds.listWorkspaces).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'app', json: true })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'update', '--workspace', 'web', '--dev',
      ]);
      expect(workspaceCmds.updateWorkspaces).toHaveBeenCalledWith(
        expect.objectContaining({ workspace: 'web', dev: true, spinner: expect.anything() })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'validate', '--watch',
      ]);
      expect(workspaceCmds.validateWorkspaceConfig).toHaveBeenCalledWith({ watch: true });
    });

    it('migrate honours --no-backup and health forwards explain', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync(['node', 're-shell', 'workspace', 'migrate', '--no-backup', '--to', '2.0.0']);
      expect(workspaceCmds.migrateWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({ backup: false, to: '2.0.0' })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'health', '--explain',
      ]);
      expect(workspaceCmds.checkWorkspaceHealth).toHaveBeenCalledWith({ explain: true });
    });

    it('template show passes the action + templateId normalisation', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync(['node', 're-shell', 'workspace', 'template', 'show', 'react-starter']);
      expect(workspaceCmds.manageWorkspaceTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'show', templateId: 'react-starter', spinner: expect.anything() })
      );
    });

    it('import normalises --no-dev/--no-detect into includeDev/detectFrameworks', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync(['node', 're-shell', 'workspace', 'import', '--no-dev', '--no-detect']);
      expect(importMonorepo.importFromMonorepo).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'auto',
          includeDev: false,
          detectFrameworks: false,
          spinner: expect.anything(),
        })
      );
    });

    it('docs normalises include flags (default true, --no-* false) and watch mode', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync(['node', 're-shell', 'workspace', 'docs', '--no-diagrams']);
      expect(workspaceDocs.generateWorkspaceDocs).toHaveBeenCalledWith({
        output: 'WORKSPACE.md', format: 'markdown',
        includeDiagrams: false, includeEnv: true, includeDependencies: true,
      });

      await programWith(registerWorkspaceGroup).parseAsync(['node', 're-shell', 'workspace', 'docs', '--watch']);
      expect(workspaceDocs.generateWorkspaceDocs).toHaveBeenCalledWith(
        expect.objectContaining({ watch: true })
      );
    });

    it('diff forwards the from/to/format options', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync([
        'node', 're-shell', 'workspace', 'diff', '--from', 'a.yaml', '--to', 'b.yaml', '--format', 'json',
      ]);
      expect(workspaceDiff.diffWorkspace).toHaveBeenCalledWith({
        from: 'a.yaml', to: 'b.yaml', format: 'json', verbose: undefined,
      });
    });

    it('def/state/watch/changes/impact/ibuild/policy delegate with action flags', async () => {
      const program = programWith(registerWorkspaceGroup);

      await program.parseAsync(['node', 're-shell', 'workspace', 'def', 'init', '--dry-run']);
      expect(workspaceDef.manageWorkspaceDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ init: true, dryRun: true, spinner: expect.anything() })
      );

      await programWith(registerWorkspaceGroup).parseAsync(['node', 're-shell', 'workspace', 'state', 'status', '--json']);
      expect(workspaceState.manageWorkspaceState).toHaveBeenCalledWith(
        expect.objectContaining({ status: true, json: true, spinner: expect.anything() })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'watch', 'start', '--use-polling', '--interval', '500',
      ]);
      expect(fileWatcher.manageFileWatcher).toHaveBeenCalledWith(
        expect.objectContaining({ start: true, usePolling: true, interval: '500' })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'changes', 'scan', '--path', tempRoot, '--algorithm', 'md5',
      ]);
      expect(changeDetector.manageChangeDetector).toHaveBeenCalledWith(
        expect.objectContaining({ scan: true, path: tempRoot, algorithm: 'md5' })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'impact', 'analyze', '--files', 'a.ts', '--format', 'json',
      ]);
      // impact analyze has NO action flag — the subcommand IS the analyze
      // branch and maxDepth is coerced to an int.
      expect(changeImpact.manageChangeImpact).toHaveBeenCalledWith(
        expect.objectContaining({ files: ['a.ts'], format: 'json', maxDepth: 10 })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'ibuild', 'build', '--targets', 'web', '--no-cache',
      ]);
      // ibuild build has no action flag; --no-cache becomes enableCache:false
      // and max-parallel is coerced to an int.
      expect(incrementalBuild.manageIncrementalBuild).toHaveBeenCalledWith(
        expect.objectContaining({ targets: ['web'], enableCache: false, maxParallelBuilds: 4 })
      );

      await programWith(registerWorkspaceGroup).parseAsync([
        'node', 're-shell', 'workspace', 'policy', 'check', '--pack', 'recommended',
      ]);
      expect(workspacePolicy.runPolicyCheck).toHaveBeenCalledWith(
        expect.objectContaining({ pack: 'recommended' })
      );
    });

    it('graph-analysis analyze delegates with the analyse flag', async () => {
      const program = programWith(registerWorkspaceGroup);
      await program.parseAsync([
        'node', 're-shell', 'workspace', 'graph-analysis', 'analyze', '--detailed',
      ]);
      expect(workspaceGraph.manageWorkspaceGraph).toHaveBeenCalledWith(
        expect.objectContaining({ analyze: true, detailed: true, file: 're-shell.workspaces.yaml' })
      );
    });

    describe('migrate-monorepo inline action', () => {
      /**
       * Human-mode status messages go through the spinner stub (fail/succeed),
       * not console.log, so read the most recently created spinner.
       */
      function lastSpinnerMessage(method: 'fail' | 'succeed'): string {
        const results = vi.mocked(spinnerUtil.createSpinner).mock.results;
        const stub = results.at(-1)!.value as Record<string, { mock: { calls: unknown[][] } }>;
        return stub[method].mock.calls.map(c => c.join(' ')).join('\n');
      }

      it('rejects unsupported --from values with exit 1 (human mode)', async () => {
        const program = programWith(registerWorkspaceGroup);
        await program.parseAsync(['node', 're-shell', 'workspace', 'migrate-monorepo', '--from', 'bazel']);
        expect(migrateMonorepoCmd.migrateMonorepo).not.toHaveBeenCalled();
        expect(lastSpinnerMessage('fail')).toContain('Unsupported --from value: bazel');
        expect(process.exitCode).toBe(1);
      });

      it('prints the would-be YAML in dry-run mode', async () => {
        vi.mocked(migrateMonorepoCmd.migrateMonorepo).mockResolvedValue({
          detected: [{ name: 'web' }, { name: 'api' }],
          yaml: 'workspaces: [...]',
        } as never);
        const program = programWith(registerWorkspaceGroup);
        await program.parseAsync([
          'node', 're-shell', 'workspace', 'migrate-monorepo', '--from', 'nx', '--dry-run',
        ]);
        expect(migrateMonorepoCmd.migrateMonorepo).toHaveBeenCalledWith({
          source: 'nx', output: undefined, dryRun: true,
        });
        expect(lastSpinnerMessage('succeed')).toContain('Detected 2 service(s) from nx');
        expect(output()).toContain('workspaces: [...]');
      });

      it('writes the YAML to --output when not dry-running', async () => {
        vi.mocked(migrateMonorepoCmd.migrateMonorepo).mockResolvedValue({
          detected: [{ name: 'web' }],
          yaml: 'workspaces: [web]',
        } as never);
        const program = programWith(registerWorkspaceGroup);
        const outFile = path.join(tempRoot, 'out.yaml');
        await program.parseAsync([
          'node', 're-shell', 'workspace', 'migrate-monorepo', '--from', 'turbo',
          '--output', outFile,
        ]);
        expect(fs.readFileSync(outFile, 'utf-8')).toBe('workspaces: [web]');
        expect(lastSpinnerMessage('succeed')).toContain('Migrated 1 service(s)');
      });

      it('emits the {detected, yaml} JSON envelope in --json mode', async () => {
        vi.mocked(migrateMonorepoCmd.migrateMonorepo).mockResolvedValue({
          detected: [{ name: 'web' }],
          yaml: 'workspaces: [web]',
        } as never);
        const program = programWith(registerWorkspaceGroup);
        await program.parseAsync([
          'node', 're-shell', 'workspace', 'migrate-monorepo', '--from', 'nx', '--json',
        ]);
        expect(migrateMonorepoCmd.migrateMonorepo).toHaveBeenCalledWith(
          expect.objectContaining({ json: true })
        );
        const chunks = jsonChunks();
        expect(chunks).toHaveLength(1);
        expect(JSON.parse(chunks[0]).data).toEqual({
          detected: [{ name: 'web' }], yaml: 'workspaces: [web]',
        });
      });

      it('fails the JSON envelope for unsupported tools without calling the migrator', async () => {
        const program = programWith(registerWorkspaceGroup);
        await program.parseAsync([
          'node', 're-shell', 'workspace', 'migrate-monorepo', '--from', 'bazel', '--json',
        ]);
        const chunks = jsonChunks();
        expect(chunks).toHaveLength(1);
        const payload = JSON.parse(chunks[0]);
        expect(payload.ok).toBe(false);
        expect(payload.error.code).toBe('MONOREPO_MIGRATE_ERROR');
        expect(migrateMonorepoCmd.migrateMonorepo).not.toHaveBeenCalled();
      });

      it('fails the JSON envelope when the migrator throws', async () => {
        vi.mocked(migrateMonorepoCmd.migrateMonorepo).mockRejectedValue(
          new Error('nx.json unreadable') as never
        );
        const program = programWith(registerWorkspaceGroup);
        await program.parseAsync([
          'node', 're-shell', 'workspace', 'migrate-monorepo', '--from', 'nx', '--json',
        ]);
        const payload = JSON.parse(jsonChunks()[0]);
        expect(payload.ok).toBe(false);
        expect(payload.error.message).toContain('nx.json unreadable');
      });
    });
  });
});
