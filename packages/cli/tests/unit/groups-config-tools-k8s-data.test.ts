import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import * as path from 'path';
import * as os from 'os';
import * as fsReal from 'fs';

// Covers four registration groups in src/groups/:
//   - config.group.ts — thin registrar over 12 ./config/* modules (direct
//     subcommands, schema, env, unified, migrate, validate, project,
//     workspace, template, diff, backup-mgr, profile + profile-subgroups)
//   - tools.group.ts — detect/dry-run/DI analyzers/snapshots + submodule,
//     migrate, cicd, dev, hotreload, devenv, debug subgroups
//   - k8s.group.ts — workspace-config generate trio + 12 generator
//     subcommands driving utils writeFiles/displayConfig pairs
//   - data.group.ts — 8 generator subcommands driving utils
//     write*/display* pairs with language switching
// Command handlers are mocked (they have their own dedicated suites — PRs
// #307–#369); the generator utils behind k8s/data actions are mocked through
// their dynamic-import specifiers so the registration wiring, option
// normalization and config assembly can be asserted in isolation.

vi.mock('../../src/commands/config', () => ({ manageConfig: vi.fn() }));
vi.mock('../../src/commands/environment', () => ({ manageEnvironment: vi.fn() }));
vi.mock('../../src/commands/migration', () => ({ manageMigration: vi.fn() }));
vi.mock('../../src/commands/project-config', () => ({ manageProjectConfig: vi.fn() }));
vi.mock('../../src/commands/workspace-config', () => ({ manageWorkspaceConfig: vi.fn() }));
vi.mock('../../src/commands/config-diff', () => ({ manageConfigDiff: vi.fn() }));
vi.mock('../../src/commands/backup', () => ({ manageBackups: vi.fn() }));
vi.mock('../../src/commands/validate', () => ({ validateConfiguration: vi.fn() }));
vi.mock('../../src/commands/workspace', () => ({ manageWorkspaceTemplates: vi.fn() }));

vi.mock('../../src/commands/profile', () => ({
  manageProfiles: vi.fn(),
  validateProfileCrossLanguage: vi.fn(),
  validateAllProfiles: vi.fn(),
  getProfileTree: vi.fn(),
  exportProfile: vi.fn(),
  cloneProfile: vi.fn(),
  customizeProfile: vi.fn(),
  getActiveProfileWithContext: vi.fn(),
  validateCurrentContext: vi.fn(),
  deactivateProfile: vi.fn(),
}));
vi.mock('../../src/commands/profile-env', () => ({
  addEnvVariable: vi.fn(),
  listEnvVariables: vi.fn(),
  removeEnvVariable: vi.fn(),
  exportEnvVariables: vi.fn(),
  validateRequiredEnvVars: vi.fn(),
  migrateToEncryptedStorage: vi.fn(),
}));
vi.mock('../../src/commands/profile-templates', () => ({
  listTemplates: vi.fn(),
  showTemplate: vi.fn(),
  applyTemplate: vi.fn(),
  searchTemplates: vi.fn(),
}));
vi.mock('../../src/commands/profile-sync', () => ({
  syncProfilesGit: vi.fn(),
  syncProfilesLocal: vi.fn(),
  exportProfiles: vi.fn(),
  importProfiles: vi.fn(),
  showSyncStatus: vi.fn(),
  resolveConflicts: vi.fn(),
}));
vi.mock('../../src/commands/profile-analytics', () => ({
  showAnalyticsDashboard: vi.fn(),
  showUsageStatistics: vi.fn(),
  generateProfileInsights: vi.fn(),
  cleanAnalyticsData: vi.fn(),
}));
vi.mock('../../src/commands/profile-version', () => ({
  createProfileVersion: vi.fn(),
  listProfileVersions: vi.fn(),
  rollbackProfile: vi.fn(),
  compareProfileVersions: vi.fn(),
  cleanupOldVersions: vi.fn(),
}));
vi.mock('../../src/commands/profile-optimize', () => ({
  showOptimizationReport: vi.fn(),
  applyOptimizations: vi.fn(),
  autoOptimizeProfile: vi.fn(),
}));

vi.mock('../../src/commands/k8s-generate', () => ({ runK8sGenerate: vi.fn() }));
vi.mock('../../src/commands/helm-generate', () => ({ runHelmGenerate: vi.fn() }));
vi.mock('../../src/commands/gitops-generate', () => ({ runGitOpsGenerate: vi.fn() }));

vi.mock('../../src/commands/submodule', () => ({
  addGitSubmodule: vi.fn(),
  removeGitSubmodule: vi.fn(),
  updateGitSubmodules: vi.fn(),
  showSubmoduleStatus: vi.fn(),
  initSubmodules: vi.fn(),
  manageSubmodules: vi.fn(),
}));
vi.mock('../../src/commands/migrate-project', () => ({
  importProject: vi.fn(),
  exportProject: vi.fn(),
  backupProject: vi.fn(),
  restoreProject: vi.fn(),
}));
vi.mock('../../src/commands/cicd', () => ({
  generateCICDConfig: vi.fn(),
  generateDeployConfig: vi.fn(),
}));
vi.mock('../../src/commands/dev-mode', () => ({ manageDevMode: vi.fn() }));

// utils reached through dynamic import() in group actions
vi.mock('../../src/utils/unified-config', () => ({
  createUnifiedConfig: vi.fn(async () => fakeUnifiedManager),
}));
vi.mock('../../src/utils/schema-generator', () => ({
  publishSchemas: vi.fn(),
  validateWorkspaceFile: vi.fn(),
  generateSchema: vi.fn(),
}));

const fakeUnifiedManager = {
  syncConfigurations: vi.fn(),
  createSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
  listSnapshots: vi.fn(),
  exportConfig: vi.fn(),
  importConfig: vi.fn(),
  validateConfig: vi.fn(),
  getAllLayers: vi.fn(),
  getValue: vi.fn(),
  setValue: vi.fn(),
  saveAll: vi.fn(),
};

// --- k8s generator utils (dynamic-import mock per specifier) ---
vi.mock('../../src/utils/k8s-manifest-generator', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/helm-chart-generator', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/gitops-integration', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/service-mesh-integration', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/hpa-generator', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/network-policy-generator', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/crd-generator', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/polyglot-operator', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/multi-tenant-isolation', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/cicd-pipeline', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/multi-cluster-deployment', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/ingress-manager', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/pod-security', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));
vi.mock('../../src/utils/cluster-manager', () => ({ displayConfig: vi.fn(), writeFiles: vi.fn() }));

// --- data generator utils ---
vi.mock('../../src/utils/data-type-converter', () => ({
  generateConverterConfig: vi.fn(async (source: string, target: string) => ({ source, target })),
  generateTypeScriptConverter: vi.fn(async (config: any) => ({ ...config, dependencies: ['ts-dep'] })),
  generatePythonConverter: vi.fn(async (config: any) => ({ ...config, dependencies: ['py-dep'] })),
  generateGoConverter: vi.fn(async (config: any) => ({ ...config, dependencies: ['go-dep'] })),
  writeConverterFiles: vi.fn(),
  displayConverterConfig: vi.fn(),
}));
vi.mock('../../src/utils/schema-evolution', () => ({
  generateEvolutionConfig: vi.fn(async (name: string, type: string) => ({ name, type })),
  generateTypeScriptEvolution: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generatePythonEvolution: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generateGoEvolution: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  writeEvolutionFiles: vi.fn(),
  displayEvolutionConfig: vi.fn(),
}));
vi.mock('../../src/utils/serialization-optimizer', () => ({
  generateOptimizerConfig: vi.fn(async (name: string, format: string, compression: string) => ({ name, format, compression })),
  generateTypeScriptOptimizer: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generatePythonOptimizer: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generateGoOptimizer: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  writeOptimizerFiles: vi.fn(),
  displayOptimizerConfig: vi.fn(),
}));
vi.mock('../../src/utils/large-payload-compression', () => ({
  generateCompressionStrategyConfig: vi.fn(async (name: string, encoding: string, chunking: string) => ({ name, encoding, chunking })),
  generateTypeScriptCompressionStrategy: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generatePythonCompressionStrategy: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generateGoCompressionStrategy: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  writeCompressionStrategyFiles: vi.fn(),
  displayCompressionStrategyConfig: vi.fn(),
}));
vi.mock('../../src/utils/data-lineage-tracker', () => ({
  generateLineageTrackerConfig: vi.fn(async (name: string, format: string) => ({ name, format })),
  generateTypeScriptLineageTracker: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generatePythonLineageTracker: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generateGoLineageTracker: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  writeLineageTrackerFiles: vi.fn(),
  displayLineageTrackerConfig: vi.fn(),
}));
vi.mock('../../src/utils/data-encryption', () => ({
  generateEncryptionConfig: vi.fn(async (name: string, algorithm: string) => ({ name, algorithm })),
  generateTypeScriptEncryption: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generatePythonEncryption: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generateGoEncryption: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  writeEncryptionFiles: vi.fn(),
  displayEncryptionConfig: vi.fn(),
}));
vi.mock('../../src/utils/format-negotiator', () => ({
  generateFormatNegotiatorConfig: vi.fn(async (name: string, defaultFormat: string) => ({ name, defaultFormat })),
  generateTypeScriptFormatNegotiator: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generatePythonFormatNegotiator: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generateGoFormatNegotiator: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  writeFormatNegotiatorFiles: vi.fn(),
  displayFormatNegotiatorConfig: vi.fn(),
}));
vi.mock('../../src/utils/data-caching', () => ({
  generateCachingConfig: vi.fn(async (name: string, backend: string) => ({ name, backend })),
  generateTypeScriptCaching: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generatePythonCaching: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  generateGoCaching: vi.fn(async (config: any) => ({ ...config, dependencies: [] })),
  writeCachingFiles: vi.fn(),
  displayCachingConfig: vi.fn(),
}));

// --- tools utils (dynamic imports) ---
vi.mock('../../src/utils/rollback', () => ({
  listSnapshots: vi.fn(),
  rollbackOperation: vi.fn(),
  recoverFromSnapshot: vi.fn(),
  cleanupSnapshots: vi.fn(),
}));
vi.mock('../../src/utils/dependency-injection', () => ({
  analyzeServices: vi.fn(),
  generateAutoWiringConfig: vi.fn(),
  showInjectionRecommendations: vi.fn(),
}));
vi.mock('../../src/utils/hot-reload', () => ({
  createHotReload: vi.fn(),
  detectProjectFramework: vi.fn(),
  listSupportedFrameworks: vi.fn(() => [
    { id: 'express', language: 'typescript', reloadStrategy: 'restart', port: 3000, watchPaths: ['src'], devCommand: 'npm run dev' },
    { id: 'vite', language: 'typescript', reloadStrategy: 'hmr', port: 5173, watchPaths: ['src'], devCommand: 'npm run dev' },
  ]),
  getFrameworkPattern: vi.fn(),
}));
vi.mock('../../src/utils/framework-detection', () => ({
  showProjectAnalysis: vi.fn(),
  analyzeProject: vi.fn(async () => ({ frameworks: [] })),
}));
vi.mock('../../src/utils/debugging', () => ({
  writeDebugConfigs: vi.fn(),
  displayDebugConfigInfo: vi.fn(),
}));
vi.mock('../../src/utils/dev-env-setup', () => {
  const manager = {
    on: vi.fn(),
    detectContainers: vi.fn(async () => []),
    setupPortForwarding: vi.fn(async () => true),
    unforwardPort: vi.fn(async () => true),
    listForwardedPorts: vi.fn(() => []),
  };
  return {
    createDevEnv: vi.fn(async () => manager),
    detectContainerRuntime: vi.fn(async () => 'docker'),
    DevEnvManager: vi.fn(() => manager),
    getServicePorts: vi.fn(() => ({ api: 3000 })),
  };
});

const { registerConfigGroup } = await import('../../src/groups/config.group');
const { registerToolsGroup } = await import('../../src/groups/tools.group');
const { registerK8sGroup } = await import('../../src/groups/k8s.group');
const { registerDataGroup } = await import('../../src/groups/data.group');

const { manageConfig } = await import('../../src/commands/config');
const { manageEnvironment } = await import('../../src/commands/environment');
const { manageMigration } = await import('../../src/commands/migration');
const { manageProjectConfig } = await import('../../src/commands/project-config');
const { manageWorkspaceConfig } = await import('../../src/commands/workspace-config');
const { manageConfigDiff } = await import('../../src/commands/config-diff');
const { manageBackups } = await import('../../src/commands/backup');
const { validateConfiguration } = await import('../../src/commands/validate');
const { manageWorkspaceTemplates } = await import('../../src/commands/workspace');
const { runK8sGenerate } = await import('../../src/commands/k8s-generate');
const { runHelmGenerate } = await import('../../src/commands/helm-generate');
const { runGitOpsGenerate } = await import('../../src/commands/gitops-generate');
const { createUnifiedConfig } = await import('../../src/utils/unified-config');
const { validateWorkspaceFile } = await import('../../src/utils/schema-generator');

const profileCmds = await import('../../src/commands/profile');
const profileEnvCmds = await import('../../src/commands/profile-env');
const profileVersionCmds = await import('../../src/commands/profile-version');
const profileSyncCmds = await import('../../src/commands/profile-sync');
const profileAnalyticsCmds = await import('../../src/commands/profile-analytics');

const toolsCmds = {
  submodule: await import('../../src/commands/submodule'),
  migrate: await import('../../src/commands/migrate-project'),
  cicd: await import('../../src/commands/cicd'),
  dev: await import('../../src/commands/dev-mode'),
};
const { manageDevMode } = toolsCmds.dev;

const k8sUtils = {
  manifests: await import('../../src/utils/k8s-manifest-generator'),
  helm: await import('../../src/utils/helm-chart-generator'),
  gitops: await import('../../src/utils/gitops-integration'),
  mesh: await import('../../src/utils/service-mesh-integration'),
  hpa: await import('../../src/utils/hpa-generator'),
  networkPolicy: await import('../../src/utils/network-policy-generator'),
  crd: await import('../../src/utils/crd-generator'),
  operator: await import('../../src/utils/polyglot-operator'),
  multiTenant: await import('../../src/utils/multi-tenant-isolation'),
  cicd: await import('../../src/utils/cicd-pipeline'),
  multiCluster: await import('../../src/utils/multi-cluster-deployment'),
  ingress: await import('../../src/utils/ingress-manager'),
  podSecurity: await import('../../src/utils/pod-security'),
  cluster: await import('../../src/utils/cluster-manager'),
};

const dataUtils = {
  convert: await import('../../src/utils/data-type-converter'),
  schema: await import('../../src/utils/schema-evolution'),
  serialize: await import('../../src/utils/serialization-optimizer'),
  compress: await import('../../src/utils/large-payload-compression'),
  lineage: await import('../../src/utils/data-lineage-tracker'),
  encrypt: await import('../../src/utils/data-encryption'),
  format: await import('../../src/utils/format-negotiator'),
  cache: await import('../../src/utils/data-caching'),
};

const rollbackUtil = await import('../../src/utils/rollback');
const diUtil = await import('../../src/utils/dependency-injection');
const hotreloadUtil = await import('../../src/utils/hot-reload');
const debuggingUtil = await import('../../src/utils/debugging');

/** Build a program with the given groups registered, ready for parseAsync. */
function programWith(...register: Array<(program: Command) => void>): Command {
  const program = new Command();
  program.exitOverride();
  register.forEach(fn => fn(program));
  return program;
}

/** Find a subcommand by name (throws when missing, for shape asserts). */
function subcommand(parent: Command, name: string): Command {
  const found = parent.commands.find(command => command.name() === name);
  if (!found) {
    throw new Error(`subcommand "${name}" not found on ${parent.name()}`);
  }
  return found;
}

describe('groups — config / tools / k8s / data registration', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let exitCodeBackup: string | number | undefined;
  let cwdBackup: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let tempRoot: string;

  beforeEach(() => {
    vi.clearAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    exitCodeBackup = process.exitCode;
    process.exitCode = undefined;
    tempRoot = fsReal.mkdtempSync(path.join(os.tmpdir(), 'groups-ctkd-'));
    cwdBackup = process.cwd();
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    // unified-config manager mocks default to resolved fakes
    fakeUnifiedManager.syncConfigurations.mockResolvedValue({
      success: true, syncedEnvironments: ['staging'], conflicts: [], message: 'ok',
    });
    fakeUnifiedManager.createSnapshot.mockResolvedValue({
      environment: 'dev', version: '1.0.0', checksum: 'abc123', timestamp: 1700000000000,
    });
    fakeUnifiedManager.listSnapshots.mockReturnValue([
      { environment: 'dev', version: '1.0.0', checksum: 'abc', timestamp: 1700000000000 },
    ]);
    fakeUnifiedManager.validateConfig.mockReturnValue({ valid: true, errors: [] });
    fakeUnifiedManager.getAllLayers.mockReturnValue([
      { name: 'defaults', priority: 1, source: 'builtin', readOnly: true },
      { name: 'project', priority: 10, source: `${tempRoot}/re-shell.config.json`, readOnly: false },
    ]);
  });

  afterEach(() => {
    cwdSpy.mockRestore();
    fsReal.rmSync(tempRoot, { recursive: true, force: true });
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    stdoutSpy.mockRestore();
    process.exitCode = exitCodeBackup;
  });

  /** All console.log output joined for content assertions. */
  function output(): string {
    return logSpy.mock.calls.map(call => call.join(' ')).join('\n');
  }

  /** The last JSON-looking object printed on stdout (json-output envelope). */
  function jsonOutput(): any {
    const lines = stdoutSpy.mock.calls
      .map(call => String(call[0]))
      .filter(text => text.trim().startsWith('{'));
    if (lines.length === 0) {
      throw new Error('no JSON envelope emitted on stdout');
    }
    return JSON.parse(lines[lines.length - 1].trim());
  }

  describe('config group', () => {
    it('registers all 12 domain sections in declaration order', () => {
      const program = programWith(registerConfigGroup);
      const config = subcommand(program, 'config');
      expect(config.commands.map(command => command.name())).toEqual([
        'show', 'get', 'set', 'preset', 'backup', 'restore', 'interactive',
        'schema', 'env', 'unified', 'migrate', 'validate', 'project',
        'workspace', 'template', 'diff', 'backup-mgr', 'profile',
      ]);
    });

    it('show forwards normalized options to manageConfig', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'show', '--json', '--verbose']);
      expect(manageConfig).toHaveBeenCalledWith(expect.objectContaining({
        list: true, json: true, verbose: true, spinner: expect.anything(),
      }));
    });

    it('get and set forward their key/value payloads', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'get', 'packageManager']);
      expect(manageConfig).toHaveBeenCalledWith(expect.objectContaining({ get: 'packageManager' }));
      await program.parseAsync(['node', 're-shell', 'config', 'set', 'theme', 'dark', '--global']);
      expect(manageConfig).toHaveBeenCalledWith(expect.objectContaining({
        set: 'theme', value: 'dark', global: true,
      }));
    });

    it('preset maps save/load/list/delete actions onto manageConfig options', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'preset', 'save', 'my-preset']);
      expect(manageConfig).toHaveBeenCalledWith(expect.objectContaining({ save: 'my-preset' }));
      await program.parseAsync(['node', 're-shell', 'config', 'preset', 'list']);
      expect(manageConfig).toHaveBeenCalledWith(expect.objectContaining({ list: true }));
    });

    it('preset errors are wrapped by createAsyncCommand into exit(1)', async () => {
      // createAsyncCommand swallows the throw and calls process.exit(1) —
      // the parseAsync promise itself resolves.
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'preset', 'sync']);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown action: sync'));
      expect(exitSpy).toHaveBeenCalledWith(1);
      await program.parseAsync(['node', 're-shell', 'config', 'preset', 'save']);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Preset name required for save action'));
    });

    it('backup/restore/interactive forward to manageConfig', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'backup']);
      expect(manageConfig).toHaveBeenCalledWith(expect.objectContaining({ backup: true }));
      await program.parseAsync(['node', 're-shell', 'config', 'restore', 'backup-42']);
      expect(manageConfig).toHaveBeenCalledWith(expect.objectContaining({ restore: 'backup-42' }));
      await program.parseAsync(['node', 're-shell', 'config', 'interactive']);
      expect(manageConfig).toHaveBeenCalledWith({ interactive: true });
    });

    it('schema validate emits an ok envelope in json mode', async () => {
      vi.mocked(validateWorkspaceFile).mockResolvedValue({
        valid: true, errors: [], warnings: ['minor'],
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'schema', 'validate', 'ws.yaml', '--json']);
      expect(validateWorkspaceFile).toHaveBeenCalledWith('ws.yaml');
      const envelope = jsonOutput();
      expect(envelope.ok).toBe(true);
      expect(envelope.data.valid).toBe(true);
    });

    it('schema validate emits a fail envelope for invalid files in json mode', async () => {
      vi.mocked(validateWorkspaceFile).mockResolvedValue({
        valid: false, errors: ['services: required'], warnings: [],
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'schema', 'validate', 'bad.yaml', '--json']);
      const envelope = jsonOutput();
      expect(envelope.ok).toBe(false);
      expect(envelope.error.code).toBe('SCHEMA_VALIDATION_ERROR');
    });

    it('env list/active forward to manageEnvironment', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'env', 'list', '--json']);
      expect(manageEnvironment).toHaveBeenCalledWith(expect.objectContaining({ list: true, json: true }));
      await program.parseAsync(['node', 're-shell', 'config', 'env', 'active']);
      expect(manageEnvironment).toHaveBeenCalledWith(expect.objectContaining({ active: true }));
    });

    it('migrate auto/global/project/rollback forward to manageMigration', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'migrate', 'auto', '--json']);
      expect(manageMigration).toHaveBeenCalledWith(expect.objectContaining({ auto: true, json: true }));
      await program.parseAsync(['node', 're-shell', 'config', 'migrate', 'global']);
      expect(manageMigration).toHaveBeenCalledWith(expect.objectContaining({ global: true }));
      await program.parseAsync(['node', 're-shell', 'config', 'migrate', 'rollback', 'v2']);
      expect(manageMigration).toHaveBeenCalledWith(expect.objectContaining({ rollback: 'v2' }));
    });

    it('validate all/global/project forward to validateConfiguration with scope flags', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'validate', 'all', '--warnings']);
      expect(validateConfiguration).toHaveBeenCalledWith(expect.objectContaining({ warnings: true }));
      await program.parseAsync(['node', 're-shell', 'config', 'validate', 'global']);
      expect(validateConfiguration).toHaveBeenCalledWith(expect.objectContaining({ global: true }));
    });

    it('project and workspace get/set forward to their managers', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'project', 'get', 'name']);
      expect(manageProjectConfig).toHaveBeenCalledWith(expect.objectContaining({ get: 'name' }));
      await program.parseAsync(['node', 're-shell', 'config', 'project', 'set', 'name', '"demo"']);
      expect(manageProjectConfig).toHaveBeenCalledWith(expect.objectContaining({
        set: 'name', value: '"demo"',
      }));
      await program.parseAsync(['node', 're-shell', 'config', 'workspace', 'get', 'framework']);
      expect(manageWorkspaceConfig).toHaveBeenCalledWith(expect.objectContaining({ get: 'framework' }));
    });

    it('template list/create/apply forward to manageWorkspaceTemplates', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'template', 'list', '--json']);
      expect(manageWorkspaceTemplates).toHaveBeenCalledWith(expect.objectContaining({
        action: 'list', json: true,
      }));
      await program.parseAsync(['node', 're-shell', 'config', 'template', 'create']);
      expect(manageWorkspaceTemplates).toHaveBeenCalledWith(expect.objectContaining({ action: 'create' }));
    });

    it('diff warns and flags exit 1 when --left/--right are missing', async () => {
      // QUIRK: the guard calls process.exit(1) but with exit stubbed the action
      // keeps running and still forwards to manageConfigDiff.
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'diff', 'diff']);
      expect(output()).toContain('Both --left and --right sources are required');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('diff merge/apply forward to manageConfigDiff', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'diff', 'merge', '--output', 'merged.json']);
      expect(manageConfigDiff).toHaveBeenCalledWith(expect.objectContaining({
        merge: true, output: 'merged.json',
      }));
    });

    it('backup-mgr create/list forward to manageBackups', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'backup-mgr', 'create', '--full', '--name', 'snap']);
      expect(manageBackups).toHaveBeenCalledWith(expect.objectContaining({
        create: true, full: true, name: 'snap',
      }));
      await program.parseAsync(['node', 're-shell', 'config', 'backup-mgr', 'list', '--json']);
      expect(manageBackups).toHaveBeenCalledWith(expect.objectContaining({ list: true, json: true }));
    });

    it('unified sync forwards parsed options to the unified config manager', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync([
        'node', 're-shell', 'config', 'unified', 'sync', 'dev', 'staging', 'prod',
        '--strategy', 'overwrite', '--include-secrets', '--dry-run',
      ]);
      // QUIRK: the option is declared as `-s, --strategy` but the action reads
      // `options.mergeStrategy` — the parsed value never reaches the manager
      // and the documented merge/overwrite/ask choice is silently dropped.
      expect(fakeUnifiedManager.syncConfigurations).toHaveBeenCalledWith({
        sourceEnv: 'dev',
        targetEnvs: ['staging', 'prod'],
        includeSecrets: true,
        dryRun: true,
        mergeStrategy: undefined,
        excludePatterns: [],
        includePatterns: [],
      });
      expect(output()).toContain('Configuration sync complete');
    });

    it('unified snapshot/restore/list-snapshots use the manager lifecycle', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'unified', 'snapshot', 'dev', '--version', '2.0.0']);
      expect(fakeUnifiedManager.createSnapshot).toHaveBeenCalledWith('dev', '2.0.0');
      expect(output()).toContain('Snapshot created: 1.0.0');
      await program.parseAsync(['node', 're-shell', 'config', 'unified', 'restore', 'dev', '1.0.0']);
      expect(fakeUnifiedManager.restoreSnapshot).toHaveBeenCalledWith('dev', '1.0.0');
      await program.parseAsync(['node', 're-shell', 'config', 'unified', 'list-snapshots', 'dev']);
      expect(fakeUnifiedManager.listSnapshots).toHaveBeenCalledWith('dev');
      expect(output()).toContain('Snapshots for');
    });

    it('unified get/set route through the manager with JSON value parsing', async () => {
      fakeUnifiedManager.getValue.mockReturnValueOnce({ port: 3000 });
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'unified', 'get', 'server.port', '--env', 'dev']);
      expect(fakeUnifiedManager.getValue).toHaveBeenCalledWith('server.port', 'dev');
      expect(output()).toContain('server.port');
      await program.parseAsync(['node', 're-shell', 'config', 'unified', 'set', 'server.port', '3000', '--layer', 'global']);
      expect(fakeUnifiedManager.setValue).toHaveBeenCalledWith('server.port', 3000, 'global');
      expect(fakeUnifiedManager.saveAll).toHaveBeenCalled();
    });

    it('unified layers renders the layer list and validate reports errors', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'unified', 'layers']);
      expect(output()).toContain('Configuration Layers');
      expect(output()).toContain('defaults');
      expect(output()).toContain('read-only');

      fakeUnifiedManager.validateConfig.mockReturnValueOnce({
        valid: false, errors: ['missing name'],
      });
      await program.parseAsync(['node', 're-shell', 'config', 'unified', 'validate', 'dev']);
      expect(output()).toContain('Configuration validation failed');
      expect(output()).toContain('missing name');
    });

    it('profile list/activate/show/delete forward to manageProfiles', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'list', '--json']);
      expect(profileCmds.manageProfiles).toHaveBeenCalledWith(expect.objectContaining({ json: true }));
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'activate', 'production']);
      expect(profileCmds.manageProfiles).toHaveBeenCalledWith(expect.objectContaining({ activate: 'production' }));
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'show', 'dev', '--json']);
      expect(profileCmds.manageProfiles).toHaveBeenCalledWith(expect.objectContaining({ show: 'dev' }));
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'delete', 'old']);
      expect(profileCmds.manageProfiles).toHaveBeenCalledWith(expect.objectContaining({ delete: 'old' }));
    });

    it('profile validate renders errors, warnings and suggestions', async () => {
      vi.mocked(profileCmds.validateProfileCrossLanguage).mockResolvedValue({
        language: 'typescript',
        valid: false,
        errors: ['Invalid build target es9999'],
        warnings: ['sourcemaps slow dev'],
        suggestions: ['use es2020'],
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'validate', 'dev', '--cross-language']);
      expect(profileCmds.validateProfileCrossLanguage).toHaveBeenCalledWith('dev');
      expect(output()).toContain('Language: typescript');
      expect(output()).toContain('Profile has validation errors');
      expect(output()).toContain('Invalid build target es9999');
      expect(output()).toContain('sourcemaps slow dev');
      expect(output()).toContain('use es2020');
    });

    it('profile validate-all renders the per-language summary', async () => {
      vi.mocked(profileCmds.validateAllProfiles).mockResolvedValue({
        profiles: {
          dev: { valid: true, language: 'typescript', errors: [], warnings: [] },
          legacy: { valid: false, language: 'python', errors: ['e1', 'e2', 'e3'], warnings: ['w1', 'w2'] },
        },
        summary: { total: 2, valid: 1, invalid: 1, byLanguage: { typescript: 1, python: 1 } },
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'validate-all']);
      expect(output()).toContain('Total: 2 | Valid: 1 | Invalid: 1');
      expect(output()).toContain('typescript: 1');
      expect(output()).toContain('... and 1 more errors');
      expect(output()).toContain('... and 1 more warnings');
    });

    it('profile tree renders the recursive inheritance tree', async () => {
      vi.mocked(profileCmds.getProfileTree).mockResolvedValue({
        name: 'base',
        children: [{ name: 'dev', children: [{ name: 'dev-local', children: [] }] }],
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'tree', 'base']);
      expect(output()).toContain('Profile Inheritance Tree: base');
      expect(output()).toContain('dev-local');
      expect(output()).toContain('└─');
    });

    it('profile export writes the resolved config to --output', async () => {
      vi.mocked(profileCmds.exportProfile).mockResolvedValue({
        inheritedFrom: ['base'], finalConfig: { framework: 'react' },
      } as never);
      const program = programWith(registerConfigGroup);
      // QUIRK: the action writes with fs.writeFile directly — the parent
      // directory must already exist or the write fails silently in the
      // withTimeout wrapper. Pre-create it.
      fsReal.mkdirSync(path.join(tempRoot, 'out'), { recursive: true });
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'export', 'dev', '--output', 'out/profile.json']);
      expect(output()).toContain('Exported Profile: dev');
      expect(fsReal.existsSync(path.join(tempRoot, 'out/profile.json'))).toBe(true);
      const written = JSON.parse(fsReal.readFileSync(path.join(tempRoot, 'out/profile.json'), 'utf8'));
      expect(written.finalConfig).toEqual({ framework: 'react' });
    });

    it('profile status reports active profile with context and validation', async () => {
      vi.mocked(profileCmds.getActiveProfileWithContext).mockResolvedValue({
        profile: { name: 'dev', environment: 'development', framework: 'react' },
        context: { activatedAt: 1700000000000, validated: true },
      } as never);
      vi.mocked(profileCmds.validateCurrentContext).mockResolvedValue({
        valid: false, warnings: ['drift detected'],
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'status']);
      expect(output()).toContain('Active Profile Status');
      expect(output()).toContain('Profile: dev');
      expect(output()).toContain('Profile context has issues');
      expect(output()).toContain('drift detected');
    });

    it('profile status and deactivate warn when nothing is active', async () => {
      vi.mocked(profileCmds.getActiveProfileWithContext).mockResolvedValue({ profile: null } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'status']);
      expect(output()).toContain('No active profile');
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'deactivate']);
      expect(output()).toContain('No active profile to deactivate');
      expect(profileCmds.deactivateProfile).not.toHaveBeenCalled();
    });

    it('profile deactivate restores workspace state', async () => {
      vi.mocked(profileCmds.getActiveProfileWithContext).mockResolvedValue({
        profile: { name: 'staging', environment: 'staging' },
        context: { activatedAt: 1700000000000, validated: false },
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'deactivate']);
      expect(profileCmds.deactivateProfile).toHaveBeenCalledWith('staging');
      expect(output()).toContain('Deactivated profile "staging"');
    });

    it('profile clone parses extend/priority into typed options', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'clone', 'base', 'base-copy',
        '--description', 'copy of base', '--extend', 'base,other', '--priority', '5',
      ]).catch(() => undefined);
      // BUG (documented): `--extend <profiles...>` is variadic so commander
      // always hands the action an ARRAY, but the action calls
      // `.split(',')` on it — `config profile clone --extend X` crashes with
      // "options.extend.split is not a function" for every invocation.
      expect(profileCmds.cloneProfile).not.toHaveBeenCalled();
    });

    it('profile customize parses boolean strings, KEY=VALUE maps and dependency ids', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'customize', 'dev',
        '--build-optimize', 'true', '--dev-port', '3001',
        '--add-env', 'API_KEY=secret', 'EXTRA=a=b',
        '--add-script', 'build=tsc -b',
        '--add-dependency', '@scope/pkg@1.2.3', 'plain@2.0.0',
        '--extend-add', 'base', '--extend-remove', 'legacy',
        '--priority', '3',
      ]);
      expect(profileCmds.customizeProfile).toHaveBeenCalledWith('dev', {
        description: undefined,
        framework: undefined,
        environment: undefined,
        buildTarget: undefined,
        buildOptimize: true,
        buildSourcemap: undefined,
        buildMinify: undefined,
        devPort: 3001,
        devHost: undefined,
        devHmr: undefined,
        devCors: undefined,
        addEnv: { API_KEY: 'secret', EXTRA: 'a=b' },
        removeEnv: undefined,
        addScript: { build: 'tsc -b' },
        addDependency: { '@scope/pkg': '1.2.3', plain: '2.0.0' },
        extendAdd: ['base'],
        extendRemove: ['legacy'],
        priority: 3,
      });
    });

    it('profile sync routes git vs local methods with strategy options', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'sync',
        '--method', 'git', '--remote', 'upstream', '--branch', 'develop', '--force',
      ]);
      expect(profileSyncCmds.syncProfilesGit).toHaveBeenCalledWith(expect.objectContaining({
        remote: 'upstream', branch: 'develop', force: true,
      }));
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'sync', '--method', 'local', '--strategy', 'merge',
      ]);
      expect(profileSyncCmds.syncProfilesLocal).toHaveBeenCalledWith(expect.objectContaining({
        strategy: 'merge',
      }));
    });

    it('profile env add forwards encryption toggles and metadata', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'env', 'add', 'dev', 'API_KEY', 'secret',
        '--no-encrypt', '--description', 'the key', '--required',
      ]);
      expect(profileEnvCmds.addEnvVariable).toHaveBeenCalledWith('dev', 'API_KEY', 'secret', {
        encrypt: false,
        description: 'the key',
        required: true,
      });
    });

    it('profile env list/remove/export/validate/migrate forward to the env command', async () => {
      vi.mocked(profileEnvCmds.validateRequiredEnvVars).mockResolvedValue({
        valid: false, missing: ['DB_URL'], present: ['API_KEY'],
      } as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'env', 'list', 'dev']);
      expect(profileEnvCmds.listEnvVariables).toHaveBeenCalledWith('dev');
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'env', 'remove', 'dev', 'API_KEY']);
      expect(profileEnvCmds.removeEnvVariable).toHaveBeenCalledWith('dev', 'API_KEY');
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'env', 'export', 'dev', '--output', 'dev.env', '--no-decrypt',
      ]);
      expect(profileEnvCmds.exportEnvVariables).toHaveBeenCalledWith('dev', {
        outputPath: 'dev.env', decrypt: false,
      });
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'env', 'validate', 'dev']);
      expect(output()).toContain('Missing required variables');
      expect(output()).toContain('DB_URL');
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'env', 'migrate', '.env.prod', '--profile', 'prod']);
      expect(profileEnvCmds.migrateToEncryptedStorage).toHaveBeenCalledWith('.env.prod', 'prod');
    });

    it('profile template subcommands forward to the templates command', async () => {
      const program = programWith(registerConfigGroup);
      const { listTemplates, showTemplate, applyTemplate, searchTemplates } =
        await import('../../src/commands/profile-templates');
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'template', 'list']);
      expect(listTemplates).toHaveBeenCalled();
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'template', 'show', 'production']);
      expect(showTemplate).toHaveBeenCalledWith('production');
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'template', 'apply', 'production', 'prod-copy']);
      expect(applyTemplate).toHaveBeenCalledWith('production', 'prod-copy', { overwrite: undefined });
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'template', 'search', 'prod']);
      expect(searchTemplates).toHaveBeenCalledWith('prod');
    });

    it('profile version subcommands forward snapshot/rollback/cleanup options', async () => {
      const program = programWith(registerConfigGroup);
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'snapshot', 'dev', '--message', 'before refactor', '--tags', 'manual', 'keep',
      ]);
      expect(profileVersionCmds.createProfileVersion).toHaveBeenCalledWith('dev', {
        message: 'before refactor', tags: ['manual', 'keep'],
      });
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'history', 'dev']);
      expect(profileVersionCmds.listProfileVersions).toHaveBeenCalledWith('dev');
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'rollback', 'dev', 'v3', '--force', '--no-backup',
      ]);
      expect(profileVersionCmds.rollbackProfile).toHaveBeenCalledWith('dev', 'v3', {
        force: true, createBackup: false,
      });
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'diff', 'dev', 'v1', 'v2']);
      expect(profileVersionCmds.compareProfileVersions).toHaveBeenCalledWith('dev', 'v1', 'v2');
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'cleanup-versions', 'dev', '--keep', '5', '--before', '2026-01-01', '--auto-only',
      ]);
      expect(profileVersionCmds.cleanupOldVersions).toHaveBeenCalledWith('dev', {
        keep: 5, before: '2026-01-01', autoOnly: true,
      });
    });

    it('profile analytics/optimize subcommands forward typed options', async () => {
      vi.mocked(profileAnalyticsCmds.generateProfileInsights).mockResolvedValue([
        { severity: 'warning', title: 'Low usage', description: 'used twice', recommendation: 'delete it', impact: 'medium' },
        { severity: 'info', title: 'Multi-framework', description: 'two frameworks' },
      ] as never);
      const program = programWith(registerConfigGroup);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'analytics', 'dev']);
      expect(profileAnalyticsCmds.showAnalyticsDashboard).toHaveBeenCalledWith('dev');
      await program.parseAsync([
        'node', 're-shell', 'config', 'profile', 'stats', '--sort', 'duration', '--limit', '5', '--format', 'json',
      ]);
      expect(profileAnalyticsCmds.showUsageStatistics).toHaveBeenCalledWith({
        sortBy: 'duration', limit: 5, format: 'json',
      });
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'clean-analytics', '--days', '30']);
      expect(profileAnalyticsCmds.cleanAnalyticsData).toHaveBeenCalledWith(30);
      await program.parseAsync(['node', 're-shell', 'config', 'profile', 'insights', 'dev']);
      expect(output()).toContain('Insights & Recommendations');
      expect(output()).toContain('Low usage');
      expect(output()).toContain('delete it');
      expect(output()).toContain('Impact: medium');
      const { autoOptimizeProfile, applyOptimizations, showOptimizationReport } =
        await import('../../src/commands/profile-optimize');
      await programWith(registerConfigGroup)
        .parseAsync(['node', 're-shell', 'config', 'profile', 'optimize', 'dev', '--auto']);
      expect(autoOptimizeProfile).toHaveBeenCalledWith('dev');
      await programWith(registerConfigGroup)
        .parseAsync(['node', 're-shell', 'config', 'profile', 'optimize', 'dev', '--apply', 'r1', 'r2']);
      expect(applyOptimizations).toHaveBeenCalledWith('dev', ['r1', 'r2']);
      await programWith(registerConfigGroup)
        .parseAsync(['node', 're-shell', 'config', 'profile', 'optimize', 'dev']);
      expect(showOptimizationReport).toHaveBeenCalledWith('dev');
    });

    it('profile optimize --apply routes to applyOptimizations in isolation', async () => {
      const { applyOptimizations } = await import('../../src/commands/profile-optimize');
      await programWith(registerConfigGroup)
        .parseAsync(['node', 're-shell', 'config', 'profile', 'optimize', 'dev', '--apply', 'r1', 'r2']);
      expect(applyOptimizations).toHaveBeenCalledWith('dev', ['r1', 'r2']);
    });
  });

  describe('tools group', () => {
    it('registers the standalone commands and subgroups', () => {
      const program = programWith(registerToolsGroup);
      const tools = subcommand(program, 'tools');
      expect(tools.commands.map(command => command.name())).toEqual([
        'detect', 'dry-run', 'di-analyze', 'di-generate', 'snapshots', 'rollback',
        'recover', 'cleanup-snapshots', 'submodule', 'migrate', 'cicd', 'dev',
        'hotreload', 'devenv', 'debug',
      ]);
      expect(subcommand(tools, 'hotreload').aliases()).toContain('hr');
      expect(subcommand(tools, 'devenv').aliases()).toContain('ide');
    });

    it('dry-run prints the mode banner and examples in human mode', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'dry-run']);
      expect(output()).toContain('Dry-Run Mode');
      expect(output()).toContain('re-shell create test-app --dry-run');
    });

    it('dry-run --json currently produces no output (writes suppressed by enableJsonMode)', async () => {
      // BUG: the action wraps its stdout write in enableJsonMode(), whose
      // patched write swallows everything not emitted through emitJson. The
      // direct process.stdout.write here is suppressed, so `tools dry-run
      // --json` prints nothing. Pinned as current behavior.
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'dry-run', '--json']);
      const lines = stdoutSpy.mock.calls.map(call => String(call[0])).join('');
      expect(lines.trim()).toBe('');
    });

    it('di-analyze writes the auto-wiring config and prints recommendations', async () => {
      vi.mocked(diUtil.analyzeServices).mockResolvedValue({
        nodes: new Map([['api', { name: 'api' }]]),
        edges: new Map([['api', new Set(['db'])]]),
        cycles: [],
      } as never);
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'di-analyze', '--output', 'di.json']);
      expect(diUtil.analyzeServices).toHaveBeenCalled();
      expect(diUtil.generateAutoWiringConfig).toHaveBeenCalledWith(expect.anything(), 'di.json');
      expect(diUtil.showInjectionRecommendations).toHaveBeenCalled();
    });

    it('di-analyze emits a serialized graph in json mode', async () => {
      vi.mocked(diUtil.analyzeServices).mockResolvedValue({
        nodes: new Map([['api', { name: 'api' }]]),
        edges: new Map([['api', new Set(['db'])]]),
        cycles: [['api', 'db', 'api']],
      } as never);
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'di-analyze', '--json']);
      const lines = stdoutSpy.mock.calls.map(call => String(call[0])).join('');
      const parsed = JSON.parse(lines.slice(lines.indexOf('{'), lines.lastIndexOf('}') + 1));
      expect(parsed.nodes).toEqual([['api', { name: 'api' }]]);
      expect(parsed.edges).toEqual([['api', ['db']]]);
      expect(parsed.cycles).toEqual([['api', 'db', 'api']]);
      expect(diUtil.showInjectionRecommendations).not.toHaveBeenCalled();
    });

    it('di-generate defaults the output path to di-config.json', async () => {
      vi.mocked(diUtil.analyzeServices).mockResolvedValue({
        nodes: new Map(), edges: new Map(), cycles: [],
      } as never);
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'di-generate']);
      expect(diUtil.generateAutoWiringConfig).toHaveBeenCalledWith(expect.anything(), 'di-config.json');
    });

    it('snapshot lifecycle commands forward to the rollback util', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'snapshots']);
      expect(rollbackUtil.listSnapshots).toHaveBeenCalled();
      await program.parseAsync(['node', 're-shell', 'tools', 'rollback', 'snap-1', '--keep-backup', '--force']);
      expect(rollbackUtil.rollbackOperation).toHaveBeenCalledWith('snap-1', { keepBackup: true, force: true });
      await program.parseAsync(['node', 're-shell', 'tools', 'recover', 'snap-1']);
      expect(rollbackUtil.recoverFromSnapshot).toHaveBeenCalledWith('snap-1');
      await program.parseAsync(['node', 're-shell', 'tools', 'cleanup-snapshots', '--keep', '3']);
      expect(rollbackUtil.cleanupSnapshots).toHaveBeenCalledWith(3);
    });

    it('submodule add/remove/update forward options with the spinner', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'submodule', 'add', 'https://example.com/lib.git', '--path', 'libs/lib', '--branch', 'v2']);
      expect(toolsCmds.submodule.addGitSubmodule).toHaveBeenCalledWith('https://example.com/lib.git',
        expect.objectContaining({ path: 'libs/lib', branch: 'v2', spinner: expect.anything() }));
      await program.parseAsync(['node', 're-shell', 'tools', 'submodule', 'remove', 'libs/lib', '--force']);
      expect(toolsCmds.submodule.removeGitSubmodule).toHaveBeenCalledWith('libs/lib',
        expect.objectContaining({ force: true, spinner: expect.anything() }));
      await program.parseAsync(['node', 're-shell', 'tools', 'submodule', 'update', '--path', 'libs/lib']);
      expect(toolsCmds.submodule.updateGitSubmodules).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'libs/lib', spinner: expect.anything() }));
    });

    it('submodule status maps not-a-repo errors to a friendly message and exit 1', async () => {
      vi.mocked(toolsCmds.submodule.showSubmoduleStatus).mockRejectedValue(
        new Error('Not in a Git repository'));
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'submodule', 'status']);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Not in a Git repository. Please run this command'));
      expect(process.exitCode).toBe(1);
    });

    it('submodule init/manage forward to their handlers', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'submodule', 'init']);
      expect(toolsCmds.submodule.initSubmodules).toHaveBeenCalled();
      await program.parseAsync(['node', 're-shell', 'tools', 'submodule', 'manage']);
      expect(toolsCmds.submodule.manageSubmodules).toHaveBeenCalled();
    });

    it('migrate import/export/backup/restore forward with timeouts', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'migrate', 'import', '../legacy', '--dry-run', '--backup']);
      expect(toolsCmds.migrate.importProject).toHaveBeenCalledWith('../legacy',
        expect.objectContaining({ dryRun: true, backup: true, spinner: expect.anything() }));
      await program.parseAsync(['node', 're-shell', 'tools', 'migrate', 'export', '../out', '--force']);
      expect(toolsCmds.migrate.exportProject).toHaveBeenCalledWith('../out',
        expect.objectContaining({ force: true, spinner: expect.anything() }));
      await program.parseAsync(['node', 're-shell', 'tools', 'migrate', 'backup']);
      expect(toolsCmds.migrate.backupProject).toHaveBeenCalledWith(
        expect.objectContaining({ spinner: expect.anything() }));
      await program.parseAsync(['node', 're-shell', 'tools', 'migrate', 'restore', 'backup.tar', '../restored', '--force']);
      expect(toolsCmds.migrate.restoreProject).toHaveBeenCalledWith('backup.tar', '../restored',
        expect.objectContaining({ force: true, spinner: expect.anything() }));
    });

    it('cicd generate/deploy forward provider and environment options', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync([
        'node', 're-shell', 'tools', 'cicd', 'generate',
        '--provider', 'gitlab', '--template', 'advanced', '--force',
      ]);
      expect(toolsCmds.cicd.generateCICDConfig).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'gitlab', template: 'advanced', force: true, spinner: expect.anything() }));
      await program.parseAsync(['node', 're-shell', 'tools', 'cicd', 'deploy', 'staging']);
      expect(toolsCmds.cicd.generateDeployConfig).toHaveBeenCalledWith('staging', expect.anything());
    });

    it('dev start normalizes negated flags and flattens services', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync([
        'node', 're-shell', 'tools', 'dev', 'start',
        '--debounce', '250', '--no-validation', '--no-backup',
        '--profile', 'fast', '--services', 'web,api',
      ]);
      // QUIRK: `-s, --services <services...>` is variadic so a single
      // comma-joined token is forwarded as ['web,api'] — the .flat() in the
      // action does not split it. Only space-separated tokens flatten.
      expect(manageDevMode).toHaveBeenCalledWith(expect.objectContaining({
        start: true,
        debounce: '250',
        noValidation: true,
        noBackup: true,
        profile: 'fast',
        services: ['web,api'],
        spinner: expect.anything(),
      }));
    });

    it('dev stop/restart/status/interactive dispatch their actions', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'dev', 'stop']);
      expect(manageDevMode).toHaveBeenCalledWith(expect.objectContaining({ stop: true }));
      await program.parseAsync(['node', 're-shell', 'tools', 'dev', 'restart', '--debounce', '100']);
      expect(manageDevMode).toHaveBeenCalledWith(expect.objectContaining({ restart: true, debounce: '100' }));
      await program.parseAsync(['node', 're-shell', 'tools', 'dev', 'status', '--json']);
      expect(manageDevMode).toHaveBeenCalledWith(expect.objectContaining({ status: true, json: true }));
      await program.parseAsync(['node', 're-shell', 'tools', 'dev', 'interactive']);
      expect(manageDevMode).toHaveBeenCalledWith(expect.objectContaining({ interactive: true }));
    });

    it('hotreload detect prints the detected framework or the supported list', async () => {
      vi.mocked(hotreloadUtil.detectProjectFramework).mockResolvedValueOnce({
        framework: 'express', language: 'typescript', confidence: 90,
        config: { framework: 'express', language: 'typescript', reloadStrategy: 'restart', port: 3000, watchPaths: ['src'], devCommand: 'npm run dev' },
      } as never);
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'hotreload', 'detect']);
      expect(output()).toContain('Framework detected');
      expect(output()).toContain('express');
      expect(output()).toContain('90%');

      vi.mocked(hotreloadUtil.detectProjectFramework).mockResolvedValueOnce(null);
      await program.parseAsync(['node', 're-shell', 'tools', 'hotreload', 'detect']);
      expect(output()).toContain('Could not detect framework');
      expect(output()).toContain('express');
    });

    it('hotreload detect --json prints the raw detection result', async () => {
      vi.mocked(hotreloadUtil.detectProjectFramework).mockResolvedValueOnce({
        framework: 'vite', language: 'typescript', confidence: 100, config: {},
      } as never);
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'hotreload', 'detect', '--json']);
      const lines = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      const parsed = JSON.parse(lines.slice(lines.indexOf('{'), lines.lastIndexOf('}') + 1));
      expect(parsed.framework).toBe('vite');
    });

    it('hotreload list groups frameworks by language with strategy icons', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'hotreload', 'list']);
      expect(output()).toContain('Supported Hot-Reload Frameworks');
      expect(output()).toContain('Typescript:');
      expect(output()).toContain('express');
      expect(output()).toContain('⚡');
    });

    it('hotreload list --language filters and --json dumps the array', async () => {
      await programWith(registerToolsGroup)
        .parseAsync(['node', 're-shell', 'tools', 'hotreload', 'list', '--language', 'python']);
      expect(output()).not.toContain('express');
      logSpy.mockClear();
      await programWith(registerToolsGroup)
        .parseAsync(['node', 're-shell', 'tools', 'hotreload', 'list', '--json']);
      const lines = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
      const parsed = JSON.parse(lines.slice(lines.indexOf('['), lines.lastIndexOf(']') + 1));
      expect(parsed).toHaveLength(2);
    });

    it('debug generate assembles the project info and skips writes on --dry-run', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync([
        'node', 're-shell', 'tools', 'debug', 'generate',
        '--framework', 'nestjs', '--language', 'typescript',
        '--type', 'fullstack', '--entry', 'src/main.ts', '--port', '8080', '--dry-run',
      ]);
      expect(debuggingUtil.displayDebugConfigInfo).toHaveBeenCalledWith(expect.objectContaining({
        framework: 'nestjs', language: 'typescript', type: 'fullstack',
        entryPoint: 'src/main.ts', port: 8080,
      }));
      expect(debuggingUtil.writeDebugConfigs).not.toHaveBeenCalled();
      expect(output()).toContain('Dry run - no files written');
    });

    it('debug generate writes configs when not dry-running', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'debug', 'generate']);
      expect(debuggingUtil.writeDebugConfigs).toHaveBeenCalledWith(
        tempRoot,
        expect.objectContaining({ name: path.basename(tempRoot), framework: 'express' }),
        expect.objectContaining({ force: undefined, verbose: true }),
      );
      expect(output()).toContain('Debug configurations generated');
    });

    it('debug list derives the framework from the language', async () => {
      const program = programWith(registerToolsGroup);
      await program.parseAsync(['node', 're-shell', 'tools', 'debug', 'list', 'python']);
      expect(debuggingUtil.displayDebugConfigInfo).toHaveBeenCalledWith(expect.objectContaining({
        framework: 'fastapi', language: 'python', entryPoint: 'src/main.py',
      }));
      await program.parseAsync(['node', 're-shell', 'tools', 'debug', 'list', 'go']);
      expect(debuggingUtil.displayDebugConfigInfo).toHaveBeenCalledWith(expect.objectContaining({
        framework: 'gin', language: 'go',
      }));
    });
  });

  describe('k8s group', () => {
    it('registers the workspace-config generators and 12 generator subcommands', () => {
      const program = programWith(registerK8sGroup);
      const k8s = subcommand(program, 'k8s');
      expect(k8s.commands.map(command => command.name())).toEqual([
        'generate', 'manifests', 'helm', 'gitops', 'mesh', 'hpa',
        'network-policy', 'crd', 'operator', 'multi-tenant', 'cicd',
        'multi-cluster', 'ingress', 'pod-security', 'cluster',
      ]);
    });

    it('generate forwards namespace/json/dry-run to runK8sGenerate and skips the spinner in json mode', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'generate', '--namespace', 'apps', '--json', '--dry-run', '--out', 'k8s-out',
      ]);
      expect(runK8sGenerate).toHaveBeenCalledWith({
        out: 'k8s-out', namespace: 'apps', json: true, dryRun: true, spinner: undefined,
      });
    });

    it('helm/gitops generate forward their tool options', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync(['node', 're-shell', 'k8s', 'helm', 'generate', '--dry-run']);
      expect(runHelmGenerate).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'gitops', 'generate',
        '--tool', 'flux', '--namespace', 'gitops', '--revision', 'release',
      ]);
      expect(runGitOpsGenerate).toHaveBeenCalledWith(expect.objectContaining({
        tool: 'flux', namespace: 'gitops', revision: 'release',
      }));
    });

    it('manifests parses services, assembles the config and writes files', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'manifests', 'my-app',
        '--services', 'api:3000,worker:8080', '--namespace', 'apps', '--replicas', '5', '--output', 'out/k8s',
      ]);
      expect(k8sUtils.manifests.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
        projectName: 'my-app',
        namespace: 'apps',
        replicas: 5,
        services: [
          { name: 'api', language: 'typescript', port: 3000, image: 'api:latest', env: {} },
          { name: 'worker', language: 'typescript', port: 8080, image: 'worker:latest', env: {} },
        ],
      }));
      expect(k8sUtils.manifests.writeFiles).toHaveBeenCalledWith(expect.anything(), 'out/k8s');
      expect(output()).toContain('K8s manifest generator generated successfully');
    });

    it('helm parses name:port:image service triples and splits environments', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'helm', 'my-app',
        '--chart-name', 'app-chart', '--environments', 'dev,prod',
        '--services', 'api:3000:my-api,worker:8080:my-worker',
      ]);
      expect(k8sUtils.helm.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
        chartName: 'app-chart',
        environments: ['dev', 'prod'],
        services: [
          { name: 'api', port: 3000, image: 'my-api', replicas: 3 },
          { name: 'worker', port: 8080, image: 'my-worker', replicas: 3 },
        ],
      }));
      expect(k8sUtils.helm.writeFiles).toHaveBeenCalledWith(expect.anything(), '/tmp/helm-charts');
    });

    it('gitops forwards platform/repo/revision/namespaces options', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'gitops', 'my-app',
        '--platform', 'flux', '--git-repo', 'https://git.example.com/app.git',
        '--target-revision', 'v2', '--namespaces', 'dev,prod', '--sync-policy', 'manual',
      ]);
      expect(k8sUtils.gitops.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
        platform: 'flux',
        gitRepo: 'https://git.example.com/app.git',
        targetRevision: 'v2',
        namespaces: ['dev', 'prod'],
        syncPolicy: 'manual',
      }));
    });

    it('mesh parses services and applies --no-* flag inversions', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'mesh', 'my-app',
        '--mesh', 'linkerd', '--services', 'api:3000', '--no-mtls', '--no-traffic-management',
      ]);
      expect(k8sUtils.mesh.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
        mesh: 'linkerd',
        services: [{ name: 'api', port: 3000, namespace: 'default' }],
        enableMTLS: false,
        enableTrafficManagement: false,
      }));
    });

    it('hpa parses cpu/memory/custom metrics and builds the scaling behavior', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'hpa', 'my-app',
        '--min-replicas', '1', '--max-replicas', '6',
        '--metrics', 'cpu:65,rps:1200', '--no-predictive-scaling', '--algorithm', 'linear',
      ]);
      expect(k8sUtils.hpa.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
        minReplicas: 1,
        maxReplicas: 6,
        predictiveScaling: { enabled: false },
        behavior: expect.objectContaining({
          scaleUp: expect.objectContaining({ selectPolicy: 'Max' }),
        }),
      }));
      const config = vi.mocked(k8sUtils.hpa.displayConfig).mock.calls[0][0] as any;
      expect(config.targetMetrics).toEqual([
        expect.objectContaining({ name: 'cpu', type: 'Resource' }),
        expect.objectContaining({
          name: 'rps', type: 'Pods',
          pods: { metric: { name: 'rps' }, target: { type: 'AverageValue', averageValue: '1200' } },
        }),
      ]);
    });

    it('network-policy forwards namespace and flag-derived toggles', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'network-policy', 'my-app',
        '--namespace', 'secure', '--no-micro-segmentation', '--no-deny-all-egress',
      ]);
      expect(k8sUtils.networkPolicy.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
        namespace: 'secure',
        microSegmentation: false,
        denyAllIngress: true,
        denyAllEgress: false,
      }));
      expect(k8sUtils.networkPolicy.writeFiles).toHaveBeenCalledWith(expect.anything(), '/tmp/network-policy');
    });

    it('crd registers the two built-in CRD definitions', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync(['node', 're-shell', 'k8s', 'crd', 'my-app', '--no-webhooks']);
      const config = vi.mocked(k8sUtils.crd.displayConfig).mock.calls[0][0] as any;
      expect(config.enableController).toBe(true);
      expect(config.enableWebhooks).toBe(false);
      expect(config.crds.map((crd: any) => crd.kind)).toEqual(['MicroService', 'Database']);
      expect(k8sUtils.crd.writeFiles).toHaveBeenCalledWith(expect.anything(), '/tmp/crd');
    });

    it('operator resolves known and unknown languages onto runtime configs', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'operator', 'my-app',
        '--languages', 'python, unknown-lang', '--no-rollback',
      ]);
      const config = vi.mocked(k8sUtils.operator.displayConfig).mock.calls[0][0] as any;
      expect(config.languages).toEqual([
        expect.objectContaining({ name: 'python', runtime: 'python', port: 8000 }),
        // unknown ids fall back to the nodejs runtime config
        expect.objectContaining({ name: 'nodejs', buildTool: 'npm' }),
      ]);
      expect(config.enableRollback).toBe(false);
      expect(config.enableScaling).toBe(true);
    });

    it('multi-tenant cross-products tenants with environments into namespaces', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'multi-tenant', 'my-app',
        '--tenants', 'acme,globex', '--environments', 'dev,prod', '--no-limit-ranges',
      ]);
      const config = vi.mocked(k8sUtils.multiTenant.displayConfig).mock.calls[0][0] as any;
      expect(config.namespaces.map((ns: any) => ns.name)).toEqual([
        'acme-dev', 'acme-prod', 'globex-dev', 'globex-prod',
      ]);
      const prodQuota = config.namespaces.find((ns: any) => ns.name === 'acme-prod').resourceQuota.hard;
      const devQuota = config.namespaces.find((ns: any) => ns.name === 'acme-dev').resourceQuota.hard;
      expect(prodQuota.pods).toBe('50');
      expect(devQuota.pods).toBe('10');
      expect(config.enableLimitRanges).toBe(false);
    });

    it('cicd parses canary options into the progressive delivery config', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'cicd', 'my-app',
        '--strategy', 'blue-green', '--canary-steps', '5', '--canary-interval', '30',
        '--no-notifications', '--no-progressive-delivery',
      ]);
      const config = vi.mocked(k8sUtils.cicd.displayConfig).mock.calls[0][0] as any;
      expect(config.progressiveDelivery).toEqual({ enabled: false });
      expect(config.enableNotifications).toBe(false);
      expect(config.stages.map((stage: any) => stage.name)).toEqual(['clone', 'build', 'test', 'deploy']);
    });

    it('cicd keeps the default canary numbers when progressive delivery stays on', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync(['node', 're-shell', 'k8s', 'cicd', 'my-app']);
      const config = vi.mocked(k8sUtils.cicd.displayConfig).mock.calls[0][0] as any;
      expect(config.progressiveDelivery).toEqual({
        enabled: true,
        strategy: 'canary',
        canary: { steps: 10, intervalSeconds: 60, incrementPercentage: 10 },
        analysis: expect.objectContaining({ successThreshold: 99 }),
      });
    });

    it('multi-cluster parses cluster descriptors with region mapping', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'multi-cluster', 'my-app',
        '--strategy', 'active-active', '--clusters', 'us-east:prod,eu-west:dr',
      ]);
      const config = vi.mocked(k8sUtils.multiCluster.displayConfig).mock.calls[0][0] as any;
      expect(config.strategy).toBe('active-active');
      expect(config.clusters).toEqual([
        { name: 'us-east', context: 'us-east-cluster', region: 'us-east-1', provider: 'aws', environment: 'prod' },
        { name: 'eu-west', context: 'eu-west-cluster', region: 'eu-west-1', provider: 'aws', environment: 'dr' },
      ]);
    });

    it('ingress parses hosts into rules with rate-limit math', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'ingress', 'my-app',
        '--hosts', 'app.io,www.app.io', '--service-name', 'web', '--service-port', '8080',
        '--waf-ratelimit', '50', '--no-compression',
      ]);
      const config = vi.mocked(k8sUtils.ingress.displayConfig).mock.calls[0][0] as any;
      expect(config.rules).toEqual([{
        host: 'app.io',
        paths: [{ path: '/', pathType: 'Prefix', serviceName: 'web', servicePort: 8080 }],
      }]);
      expect(config.waf.rateLimiting).toEqual({ enabled: true, requestsPerSecond: 50, burst: 100 });
      expect(config.enableCompression).toBe(false);
      expect(config.ssl).toEqual(expect.objectContaining({ enabled: true, issuer: 'letsencrypt-prod' }));
    });

    it('ingress drops rate limiting entirely with --no-waf-ratelimit', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync(['node', 're-shell', 'k8s', 'ingress', 'my-app', '--no-waf-ratelimit', '--no-ssl']);
      const config = vi.mocked(k8sUtils.ingress.displayConfig).mock.calls[0][0] as any;
      expect(config.waf.rateLimiting).toBeUndefined();
      expect(config.ssl.enabled).toBe(false);
    });

    it('pod-security maps level/version into the security profile', async () => {
      const program = programWith(registerK8sGroup);
      await program.parseAsync([
        'node', 're-shell', 'k8s', 'pod-security', 'my-app',
        '--level', 'baseline', '--version', 'v1.24', '--no-audit',
      ]);
      expect(k8sUtils.podSecurity.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
        securityProfile: {
          name: 'default', level: 'baseline', version: 'v1.24',
          enforce: true, audit: false, warn: true,
        },
        enableNetworkPolicies: true,
      }));
      expect(k8sUtils.podSecurity.writeFiles).toHaveBeenCalledWith(expect.anything(), '/tmp/pod-security', 'typescript');
    });

    it('cluster builds the upgrade config with KUBECONFIG fallback', async () => {
      const kubeconfigBackup = process.env.KUBECONFIG;
      process.env.KUBECONFIG = '/custom/kubeconfig';
      try {
        const program = programWith(registerK8sGroup);
        await program.parseAsync([
          'node', 're-shell', 'k8s', 'cluster', 'my-app',
          '--context', 'prod-ctx', '--target-version', '1.29.0',
          '--auto-approve', '--no-drain-nodes', '--dry-run',
        ]);
        expect(k8sUtils.cluster.displayConfig).toHaveBeenCalledWith(expect.objectContaining({
          kubeconfig: '/custom/kubeconfig',
          context: 'prod-ctx',
          upgradeConfig: {
            currentVersion: '1.27.0', targetVersion: '1.29.0',
            autoApprove: true, drainNodes: false, ignoreDaemonSets: true,
            timeout: 300, dryRun: true,
          },
        }));
        expect(k8sUtils.cluster.writeFiles).toHaveBeenCalledWith(expect.anything(), '/tmp/cluster-manager', 'typescript');
      } finally {
        if (kubeconfigBackup === undefined) delete process.env.KUBECONFIG;
        else process.env.KUBECONFIG = kubeconfigBackup;
      }
    });
  });

  describe('data group', () => {
    it('registers all 8 generator subcommands', () => {
      const program = programWith(registerDataGroup);
      const data = subcommand(program, 'data');
      expect(data.commands.map(command => command.name())).toEqual([
        'convert', 'schema', 'serialize', 'compress', 'lineage', 'encrypt', 'format', 'cache',
      ]);
    });

    it('convert assembles the converter config and writes TS files by default', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync([
        'node', 're-shell', 'data', 'convert', '--source', 'json', '--target', 'avro', '--output', 'out/conv',
      ]);
      expect(dataUtils.convert.generateConverterConfig).toHaveBeenCalledWith('json', 'avro');
      expect(dataUtils.convert.displayConverterConfig).toHaveBeenCalledWith({ source: 'json', target: 'avro' });
      expect(dataUtils.convert.generateTypeScriptConverter).toHaveBeenCalled();
      expect(dataUtils.convert.writeConverterFiles).toHaveBeenCalledWith(
        'converter', expect.objectContaining({ dependencies: ['ts-dep'] }), 'out/conv', 'typescript');
      expect(output()).toContain('json -> avro');
      expect(output()).toContain('ts-dep');
    });

    it('convert switches generators for python and go', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync(['node', 're-shell', 'data', 'convert', '--language', 'python']);
      expect(dataUtils.convert.generatePythonConverter).toHaveBeenCalled();
      await program.parseAsync(['node', 're-shell', 'data', 'convert', '--language', 'go']);
      expect(dataUtils.convert.generateGoConverter).toHaveBeenCalled();
    });

    it('schema routes the service name and type through the evolution generator', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync(['node', 're-shell', 'data', 'schema', 'orders', '--type', 'protobuf']);
      expect(dataUtils.schema.generateEvolutionConfig).toHaveBeenCalledWith('orders', 'protobuf');
      expect(dataUtils.schema.writeEvolutionFiles).toHaveBeenCalledWith(
        'orders', expect.anything(), 'schema-evolution', 'typescript');
      expect(output()).toContain('Schema evolution files written');
    });

    it('serialize overrides the default strategy on the config', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync([
        'node', 're-shell', 'data', 'serialize', 'events',
        '--format', 'protobuf', '--compression', 'zstd', '--strategy', 'speed',
      ]);
      expect(dataUtils.serialize.generateOptimizerConfig).toHaveBeenCalledWith('events', 'protobuf', 'zstd');
      const config = vi.mocked(dataUtils.serialize.displayOptimizerConfig).mock.calls[0][0] as any;
      expect(config.defaultStrategy).toBe('speed');
    });

    it('compress forwards encoding/chunking/adaptive options', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync([
        'node', 're-shell', 'data', 'compress', 'media',
        '--encoding', 'binary', '--chunking', 'fixed-size', '--adaptive', 'speed-priority',
      ]);
      expect(dataUtils.compress.generateCompressionStrategyConfig).toHaveBeenCalledWith('media', 'binary', 'fixed-size');
      expect(output()).toContain('Encoding: binary');
      expect(output()).toContain('Chunking: fixed-size');
      expect(output()).toContain('Adaptive: speed-priority');
    });

    it('lineage forwards the visualization format', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync(['node', 're-shell', 'data', 'lineage', 'pipeline', '--format', 'dot']);
      expect(dataUtils.lineage.generateLineageTrackerConfig).toHaveBeenCalledWith('pipeline', 'dot');
      expect(output()).toContain('Data lineage tracker files written');
    });

    it('encrypt overrides the key exchange protocol', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync([
        'node', 're-shell', 'data', 'encrypt', 'payments',
        '--algorithm', 'chacha20-poly1305', '--key-exchange', 'x25519',
      ]);
      expect(dataUtils.encrypt.generateEncryptionConfig).toHaveBeenCalledWith('payments', 'chacha20-poly1305');
      const config = vi.mocked(dataUtils.encrypt.displayEncryptionConfig).mock.calls[0][0] as any;
      expect(config.keyExchangeProtocol).toBe('x25519');
    });

    it('format splits the supported-formats list and overrides the default', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync([
        'node', 're-shell', 'data', 'format', 'gateway',
        '--formats', 'json, yaml ,csv', '--default', 'yaml',
      ]);
      const config = vi.mocked(dataUtils.format.displayFormatNegotiatorConfig).mock.calls[0][0] as any;
      expect(config.supportedFormats).toEqual(['json', 'yaml', 'csv']);
      expect(config.defaultFormat).toBe('yaml');
    });

    it('cache parses ttl/max-entries integers onto the config', async () => {
      const program = programWith(registerDataGroup);
      await program.parseAsync([
        'node', 're-shell', 'data', 'cache', 'sessions',
        '--backend', 'redis', '--eviction', 'lfu', '--ttl', '600', '--max-entries', '2500',
      ]);
      expect(dataUtils.cache.generateCachingConfig).toHaveBeenCalledWith('sessions', 'redis');
      const config = vi.mocked(dataUtils.cache.displayCachingConfig).mock.calls[0][0] as any;
      expect(config.evictionPolicy).toBe('lfu');
      expect(config.defaultTTL).toBe(600);
      expect(config.maxEntries).toBe(2500);
    });

    it('prints an error and exits 1 when a generator throws', async () => {
      vi.mocked(dataUtils.convert.generateConverterConfig).mockRejectedValueOnce(
        new Error('unsupported pair'));
      const program = programWith(registerDataGroup);
      await program.parseAsync(['node', 're-shell', 'data', 'convert']);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error generating data converter'), expect.anything());
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
