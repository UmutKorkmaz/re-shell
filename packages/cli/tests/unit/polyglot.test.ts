import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  buildAll,
  generateDeploymentConfig,
  deployServices,
  listServices,
} from '../../src/commands/polyglot';

// Covers src/commands/polyglot.ts — the polyglot build/deploy command surface
// (buildAll / generateDeploymentConfig / deployServices / listServices). The
// command is pure orchestration over two util modules (polyglot-build and
// polyglot-deploy); we mock BOTH so the generators/scanners return deterministic
// values, then drive the command's own dispatch, filtering, file-writing,
// exit-code, and error-wrapping logic against a real on-disk temp project dir.

const mocks = vi.hoisted(() => ({
  // polyglot-build
  scanWorkspace: vi.fn(),
  filterServices: vi.fn(),
  buildServices: vi.fn(),
  printBuildResults: vi.fn(),
  // polyglot-deploy
  generateDockerCompose: vi.fn(),
  generateKubernetesManifests: vi.fn(),
  generateAwsLambdaConfig: vi.fn(),
  generateVercelConfig: vi.fn(),
  generateNetlifyConfig: vi.fn(),
  generateDeploymentScripts: vi.fn(),
  deployService: vi.fn(),
  printDeploymentResults: vi.fn(),
  // spinner
  flushOutput: vi.fn(),
}));

vi.mock('../../src/utils/polyglot-build', () => ({
  scanWorkspace: mocks.scanWorkspace,
  filterServices: mocks.filterServices,
  buildServices: mocks.buildServices,
  printBuildResults: mocks.printBuildResults,
}));
vi.mock('../../src/utils/polyglot-deploy', () => ({
  generateDockerCompose: mocks.generateDockerCompose,
  generateKubernetesManifests: mocks.generateKubernetesManifests,
  generateAwsLambdaConfig: mocks.generateAwsLambdaConfig,
  generateVercelConfig: mocks.generateVercelConfig,
  generateNetlifyConfig: mocks.generateNetlifyConfig,
  generateDeploymentScripts: mocks.generateDeploymentScripts,
  deployService: mocks.deployService,
  printDeploymentResults: mocks.printDeploymentResults,
}));
vi.mock('../../src/utils/spinner', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/spinner')>(
    '../../src/utils/spinner'
  );
  return { ...actual, flushOutput: mocks.flushOutput };
});

let projectDir: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;
let cwdSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

const WEB = {
  name: 'web',
  path: '',
  type: 'frontend' as const,
  language: 'typescript' as const,
  framework: 'react',
  hasBuildScript: true,
};
const API = {
  name: 'api',
  path: '',
  type: 'backend' as const,
  language: 'python' as const,
  framework: undefined,
  hasBuildScript: false,
};

function logged(): string {
  return logSpy.mock.calls.map(a => a.join(' ')).join('\n');
}

beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-poly-'));
});

afterAll(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

beforeEach(() => {
  Object.values(mocks).forEach(m => m.mockReset());
  process.exitCode = undefined;

  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(projectDir);

  // Give each service an absolute path under the temp project so fs writes land
  // in the temp dir regardless of the OS-level cwd.
  WEB.path = path.join(projectDir, 'apps', 'web');
  API.path = path.join(projectDir, 'services', 'api');
  fs.mkdirSync(WEB.path, { recursive: true });
  fs.mkdirSync(API.path, { recursive: true });
});

afterEach(() => {
  logSpy.mockRestore();
  errSpy.mockRestore();
  exitSpy.mockRestore();
  cwdSpy.mockRestore();
  process.exitCode = undefined;
});

describe('polyglot — buildAll', () => {
  it('reports and returns early when no services are found', async () => {
    mocks.scanWorkspace.mockReturnValue([]);
    mocks.filterServices.mockReturnValue([]);
    await buildAll();
    expect(logged()).toContain('No services found to build.');
    expect(mocks.buildServices).not.toHaveBeenCalled();
  });

  it('builds the discovered services and prints the results', async () => {
    mocks.scanWorkspace.mockReturnValue([WEB, API]);
    // filterServices is a passthrough by default in the mock; the command also
    // relies on it, so echo the full list.
    mocks.filterServices.mockImplementation((s: typeof WEB[]) => s);
    mocks.buildServices.mockResolvedValue([
      { service: WEB, success: true, duration: 10 },
      { service: API, success: true, duration: 5 },
    ]);
    await buildAll({ production: true });
    expect(mocks.buildServices).toHaveBeenCalled();
    expect(mocks.printBuildResults).toHaveBeenCalled();
    expect(logged()).toContain('Building 2 services');
    expect(logged()).toContain('(production)');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when any build fails', async () => {
    mocks.scanWorkspace.mockReturnValue([WEB]);
    mocks.filterServices.mockImplementation((s: typeof WEB[]) => s);
    mocks.buildServices.mockResolvedValue([{ service: WEB, success: false, duration: 1 }]);
    await buildAll();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('wraps and rethrows an unexpected error after logging it', async () => {
    mocks.scanWorkspace.mockReturnValue([WEB]);
    mocks.filterServices.mockImplementation((s: typeof WEB[]) => s);
    mocks.buildServices.mockRejectedValue(new Error('toolchain missing'));
    await expect(buildAll()).rejects.toThrow('toolchain missing');
    expect(errSpy).toHaveBeenCalled();
  });
});

describe('polyglot — generateDeploymentConfig', () => {
  beforeEach(() => {
    mocks.scanWorkspace.mockReturnValue([WEB, API]);
  });

  it('reports and returns early when no services match', async () => {
    mocks.scanWorkspace.mockReturnValue([]);
    await generateDeploymentConfig('docker', 'staging');
    expect(logged()).toContain('No services found for deployment.');
    expect(mocks.generateDockerCompose).not.toHaveBeenCalled();
  });

  it('writes docker-compose.yml for the docker target', async () => {
    mocks.generateDockerCompose.mockReturnValue('version: "3.8"\nservices: {}\n');
    mocks.generateDeploymentScripts.mockReturnValue({});
    await generateDeploymentConfig('docker', 'production');
    const composePath = path.join(projectDir, 'deploy', 'production', 'docker-compose.yml');
    expect(mocks.generateDockerCompose).toHaveBeenCalled();
    expect(fs.existsSync(composePath)).toBe(true);
    expect(fs.readFileSync(composePath, 'utf8')).toContain('version: "3.8"');
  });

  it('writes each kubernetes manifest into the k8s subdir', async () => {
    mocks.generateKubernetesManifests.mockReturnValue({
      'web.yaml': 'kind: Deployment\n',
      'api.yaml': 'kind: Deployment\n',
    });
    mocks.generateDeploymentScripts.mockReturnValue({});
    await generateDeploymentConfig('kubernetes', 'staging');
    const k8sDir = path.join(projectDir, 'deploy', 'staging', 'k8s');
    expect(mocks.generateKubernetesManifests).toHaveBeenCalled();
    expect(fs.existsSync(path.join(k8sDir, 'web.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(k8sDir, 'api.yaml'))).toBe(true);
  });

  it('writes a per-service lambda JSON for the aws-lambda target', async () => {
    mocks.generateAwsLambdaConfig.mockReturnValue({ runtime: 'nodejs18.x' });
    mocks.generateDeploymentScripts.mockReturnValue({});
    await generateDeploymentConfig('aws-lambda', 'production');
    expect(mocks.generateAwsLambdaConfig).toHaveBeenCalledTimes(2);
    expect(
      fs.existsSync(path.join(projectDir, 'deploy', 'production', 'web-lambda.json'))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(projectDir, 'deploy', 'production', 'api-lambda.json'))
    ).toBe(true);
  });

  it('writes vercel.json for the vercel target', async () => {
    mocks.generateVercelConfig.mockReturnValue({ buildCommand: 'npm run build' });
    mocks.generateDeploymentScripts.mockReturnValue({});
    await generateDeploymentConfig('vercel', 'staging');
    expect(mocks.generateVercelConfig).toHaveBeenCalled();
    expect(fs.existsSync(path.join(projectDir, 'deploy', 'staging', 'vercel.json'))).toBe(true);
  });

  it('writes netlify.toml only for frontend services (into their own path)', async () => {
    mocks.generateNetlifyConfig.mockReturnValue({ build: { command: 'npm run build' } });
    mocks.generateDeploymentScripts.mockReturnValue({});
    await generateDeploymentConfig('netlify', 'production');
    // WEB is frontend → netlify config written inside its app dir.
    expect(mocks.generateNetlifyConfig).toHaveBeenCalledTimes(1);
    expect(mocks.generateNetlifyConfig).toHaveBeenCalledWith(WEB, expect.anything());
    expect(fs.existsSync(path.join(WEB.path, 'netlify.toml'))).toBe(true);
  });

  it('generates deployment scripts (executable) and an .env.example template', async () => {
    mocks.generateDockerCompose.mockReturnValue('services: {}\n');
    mocks.generateDeploymentScripts.mockReturnValue({ 'deploy-docker.sh': '#!/bin/sh\necho hi\n' });
    await generateDeploymentConfig('docker', 'staging', { env: '' });
    const scriptPath = path.join(projectDir, 'deploy', 'staging', 'deploy-docker.sh');
    expect(fs.existsSync(scriptPath)).toBe(true);
    expect(fs.statSync(scriptPath).mode & 0o777).toBe(0o755);
    // .env.example is always emitted (empty when no env vars).
    expect(
      fs.existsSync(path.join(projectDir, 'deploy', 'staging', '.env.example'))
    ).toBe(true);
  });

  it('parses a provided env file into the .env.example template', async () => {
    mocks.generateDockerCompose.mockReturnValue('services: {}\n');
    mocks.generateDeploymentScripts.mockReturnValue({});
    const envFile = path.join(projectDir, '.env');
    fs.writeFileSync(envFile, 'API_KEY="secret"\n# comment\nPORT=3000\n', 'utf8');
    await generateDeploymentConfig('docker', 'production', { env: envFile });
    const template = fs.readFileSync(
      path.join(projectDir, 'deploy', 'production', '.env.example'),
      'utf8'
    );
    expect(template).toContain('API_KEY="secret"');
    expect(template).toContain('PORT="3000"');
    expect(template).not.toContain('comment');
  });

  it('throws on an unsupported target', async () => {
    mocks.generateDeploymentScripts.mockReturnValue({});
    await expect(generateDeploymentConfig('fly-io' as never, 'staging')).rejects.toThrow(
      'not yet implemented'
    );
  });
});

describe('polyglot — deployServices', () => {
  beforeEach(() => {
    mocks.scanWorkspace.mockReturnValue([WEB, API]);
  });

  it('reports and returns early when no services match', async () => {
    mocks.scanWorkspace.mockReturnValue([]);
    await deployServices('docker', 'production', { skipBuild: true });
    expect(logged()).toContain('No services found for deployment.');
    expect(mocks.deployService).not.toHaveBeenCalled();
  });

  it('skips the build step when skipBuild is set and deploys each service', async () => {
    mocks.deployService.mockResolvedValue({ service: WEB, target: 'docker', success: true });
    // filter inside deployServices uses options.filter; with none, all services pass.
    // But deployServices calls buildAll unless skipBuild — which we skip here.
    await deployServices('docker', 'production', { skipBuild: true });
    expect(mocks.buildServices).not.toHaveBeenCalled();
    expect(mocks.deployService).toHaveBeenCalledTimes(2);
    expect(mocks.printDeploymentResults).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits with code 1 when any deployment fails', async () => {
    mocks.deployService.mockResolvedValue({ service: WEB, target: 'docker', success: false });
    await deployServices('docker', 'production', { skipBuild: true });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('loads an existing deploy/<env>/config.json when present', async () => {
    const cfgDir = path.join(projectDir, 'deploy', 'staging');
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeJsonSync(path.join(cfgDir, 'config.json'), {
      target: 'docker',
      environment: 'staging',
      region: 'us-east-1',
    });
    mocks.deployService.mockResolvedValue({ service: WEB, target: 'docker', success: true });
    await deployServices('docker', 'staging', { skipBuild: true });
    const passedConfig = mocks.deployService.mock.calls[0][2];
    expect(passedConfig).toMatchObject({ region: 'us-east-1' });
  });
});

describe('polyglot — listServices', () => {
  it('reports when the workspace has no services', async () => {
    mocks.scanWorkspace.mockReturnValue([]);
    await listServices();
    expect(logged()).toContain('No services found in workspace.');
  });

  it('emits services as a JSON array in json mode', async () => {
    mocks.scanWorkspace.mockReturnValue([WEB]);
    await listServices({ json: true });
    const json = JSON.parse(logSpy.mock.calls.map(a => a.join('')).find(s => s.trim().startsWith('['))!);
    expect(json).toHaveLength(1);
    expect(json[0].name).toBe('web');
  });

  it('renders a type-grouped table with buildable markers in human mode', async () => {
    mocks.scanWorkspace.mockReturnValue([WEB, API]);
    await listServices();
    const out = logged();
    expect(out).toContain('Services in Workspace');
    expect(out).toContain('FRONTEND:'); // group header from WEB.type
    expect(out).toContain('BACKEND:'); // group header from API.type
    // WEB has a build script (✓), API does not (✗).
    expect(out).toContain('web');
    expect(out).toContain('api');
  });
});
