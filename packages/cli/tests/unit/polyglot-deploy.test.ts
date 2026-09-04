import { describe, it, expect, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import {
  generateDockerCompose,
  generateKubernetesManifests,
  generateAwsLambdaConfig,
  generateVercelConfig,
  generateNetlifyConfig,
  generateDeploymentScripts,
  deployService,
  printDeploymentResults,
  type DeploymentConfig,
  type DeploymentResult,
} from '../../src/utils/polyglot-deploy';
import type { ServiceInfo } from '../../src/utils/polyglot-build';

/* eslint-disable @typescript-eslint/no-explicit-any */

function svc(over: Partial<ServiceInfo> = {}): ServiceInfo {
  return {
    name: 'web',
    path: path.join(process.cwd(), 'apps', 'web'),
    type: 'frontend' as any,
    language: 'typescript' as any,
    hasBuildScript: true,
    buildCommand: 'pnpm build',
    ...over,
  } as ServiceInfo;
}

const baseConfig: DeploymentConfig = {
  target: 'docker',
  environment: 'production',
  envVars: { NODE_ENV: 'production', LOG_LEVEL: 'info' },
};

describe('generateDockerCompose', () => {
  it('builds a v3.8 compose document with one entry per service', () => {
    const doc = JSON.parse(
      generateDockerCompose([svc({ name: 'web' }), svc({ name: 'api', type: 'backend' })], baseConfig),
    );
    expect(doc.version).toBe('3.8');
    expect(Object.keys(doc.services)).toEqual(['web', 'api']);
    expect(doc.services.web.build.context).toMatch(/^\.\//);
    expect(doc.services.web.environment).toEqual(baseConfig.envVars);
  });

  it('adds the NODE_ENV production build arg and resource limits', () => {
    const doc = JSON.parse(
      generateDockerCompose([svc()], { ...baseConfig, resources: { cpu: '2', memory: '1G' } }),
    );
    expect(doc.services.web.build.args).toEqual(['NODE_ENV=production']);
    expect(doc.services.web.deploy.resources.limits).toEqual({ cpus: '2', memory: '1G' });
  });

  it('omits the production build arg for non-production environments', () => {
    const doc = JSON.parse(
      generateDockerCompose([svc()], { ...baseConfig, environment: 'development' }),
    );
    expect(doc.services.web.build.args).toBeUndefined();
  });

  it('maps ports for frontend/backend services and adds a healthcheck', () => {
    const doc = JSON.parse(
      generateDockerCompose([svc({ type: 'frontend' as any })], { ...baseConfig, environment: 'staging' }),
    );
    expect(doc.services.web.ports).toEqual(['3000:3000']);
    expect(doc.services.web.healthcheck.test).toEqual([
      'CMD',
      'curl',
      '-f',
      'http://localhost:3000/health',
    ]);
  });
});

describe('generateKubernetesManifests', () => {
  it('produces deployment, service and hpa manifests per service', () => {
    const manifests = generateKubernetesManifests([svc()], baseConfig);
    expect(Object.keys(manifests).sort()).toEqual([
      'web-deployment.yaml',
      'web-hpa.yaml',
      'web-service.yaml',
    ]);
    const deployment = JSON.parse(manifests['web-deployment.yaml']);
    expect(deployment.kind).toBe('Deployment');
    expect(deployment.metadata.namespace).toBe('production');
    expect(deployment.spec.replicas).toBe(3); // production default
    expect(deployment.spec.template.spec.containers[0].env).toContainEqual({
      name: 'NODE_ENV',
      value: 'production',
    });
  });

  it('defaults to 1 replica outside production and honours resources.replicas', () => {
    const dev = generateKubernetesManifests([svc()], { ...baseConfig, environment: 'development' });
    expect(JSON.parse(dev['web-deployment.yaml']).spec.replicas).toBe(1);

    const scaled = generateKubernetesManifests(
      [svc()],
      { ...baseConfig, environment: 'staging', resources: { replicas: 5 } },
    );
    expect(JSON.parse(scaled['web-deployment.yaml']).spec.replicas).toBe(5);
  });

  it('uses a LoadBalancer service for frontend and ClusterIP otherwise', () => {
    const fe = generateKubernetesManifests([svc({ type: 'frontend' as any })], baseConfig);
    expect(JSON.parse(fe['web-service.yaml']).spec.type).toBe('LoadBalancer');

    const be = generateKubernetesManifests([svc({ type: 'backend' as any })], baseConfig);
    expect(JSON.parse(be['web-service.yaml']).spec.type).toBe('ClusterIP');
  });

  it('applies HPA scaling defaults and overrides', () => {
    const defaults = generateKubernetesManifests([svc()], baseConfig);
    const hpa = JSON.parse(defaults['web-hpa.yaml']);
    expect(hpa.spec.minReplicas).toBe(1);
    expect(hpa.spec.maxReplicas).toBe(10);
    expect(hpa.spec.metrics.find((m: any) => m.resource.name === 'cpu').resource.target.averageUtilization).toBe(70);

    const tuned = generateKubernetesManifests(
      [svc()],
      { ...baseConfig, scaling: { min: 2, max: 20, targetCpu: 55, targetMemory: 65 } },
    );
    const hpa2 = JSON.parse(tuned['web-hpa.yaml']);
    expect(hpa2.spec.minReplicas).toBe(2);
    expect(hpa2.spec.maxReplicas).toBe(20);
    expect(hpa2.spec.metrics.find((m: any) => m.resource.name === 'memory').resource.target.averageUtilization).toBe(65);
  });

  it('emits a TLS ingress only for frontend services with a domain', () => {
    const withDomain = generateKubernetesManifests(
      [svc({ type: 'frontend' as any })],
      { ...baseConfig, domain: 'app.example.com' },
    );
    expect(withDomain['web-ingress.yaml']).toBeDefined();
    const ingress = JSON.parse(withDomain['web-ingress.yaml']);
    expect(ingress.spec.tls[0].hosts).toEqual(['app.example.com']);
    expect(ingress.metadata.annotations['cert-manager.io/cluster-issuer']).toBe('letsencrypt-prod');

    const noDomain = generateKubernetesManifests([svc({ type: 'frontend' as any })], baseConfig);
    expect(noDomain['web-ingress.yaml']).toBeUndefined();

    const backendWithDomain = generateKubernetesManifests(
      [svc({ type: 'backend' as any })],
      { ...baseConfig, domain: 'app.example.com' },
    );
    expect(backendWithDomain['web-ingress.yaml']).toBeUndefined();
  });
});

describe('generateAwsLambdaConfig', () => {
  it('maps service language to a Lambda runtime with sensible defaults', () => {
    const cases: Array<[string, string]> = [
      ['python', 'python3.11'],
      ['javascript', 'nodejs20.x'],
      ['typescript', 'nodejs20.x'],
      ['go', 'provided.al2'],
      ['rust', 'provided.al2'],
    ];
    for (const [lang, runtime] of cases) {
      const cfg = generateAwsLambdaConfig(svc({ language: lang as any }), baseConfig);
      expect(cfg.Runtime).toBe(runtime);
    }
    // Unknown language falls back to nodejs20.x.
    expect(generateAwsLambdaConfig(svc({ language: 'cobol' as any }), baseConfig).Runtime).toBe('nodejs20.x');
  });

  it('sets function name, handler, timeout, memory, env and tags', () => {
    const cfg = generateAwsLambdaConfig(svc({ name: 'orders' }), baseConfig);
    expect(cfg).toMatchObject({
      FunctionName: 'orders',
      Handler: 'index.handler',
      Timeout: 30,
      MemorySize: 512,
    });
    expect(cfg.Environment.Variables).toEqual(baseConfig.envVars);
    expect(cfg.Tags).toMatchObject({ Environment: 'production', ManagedBy: 're-shell' });
  });
});

describe('generateVercelConfig', () => {
  it('creates a project entry only for frontend services', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-vercel-'));
    try {
      fs.writeJsonSync(path.join(dir, 'package.json'), { dependencies: { react: '^18.0.0' } });
      const cfg = generateVercelConfig(
        [
          svc({ name: 'web', type: 'frontend' as any, path: dir, language: 'typescript' as any }),
          svc({ name: 'api', type: 'backend' as any }),
        ],
        baseConfig,
      );
      expect(cfg.$schema).toBe('https://openapi.vercel.sh/vercel.json');
      expect(Object.keys(cfg.projects)).toEqual(['web']);
      expect(cfg.projects.web).toMatchObject({
        buildCommand: 'pnpm build',
        outputDirectory: 'dist',
        env: baseConfig.envVars,
      });
      // detectFramework reads the package.json and identifies react.
      expect(cfg.projects.web.framework).toBeTruthy();
    } finally {
      fs.removeSync(dir);
    }
  });
});

describe('generateNetlifyConfig', () => {
  it('configures build command, publish dir, env and functions', () => {
    const cfg = generateNetlifyConfig(svc({ buildCommand: 'npm run build' }), baseConfig);
    expect(cfg).toMatchObject({
      version: 2,
      build: { command: 'npm run build', publish: 'dist' },
      environment: baseConfig.envVars,
      functions: { directory: 'netlify/functions' },
    });
  });
});

describe('generateDeploymentScripts', () => {
  it('renders a docker compose script that branches on environment', () => {
    const prod = generateDeploymentScripts([svc({ name: 'web' })], baseConfig);
    expect(prod['deploy-docker.sh']).toContain('docker-compose.prod.yml up -d');

    const dev = generateDeploymentScripts([svc({ name: 'web' })], { ...baseConfig, environment: 'development' });
    expect(dev['deploy-docker.sh']).toContain('docker compose up -d');
    expect(dev['deploy-docker.sh']).toContain('- web: http://localhost:3000');
  });

  it('renders a kubernetes script with namespace and rollout waits', () => {
    const scripts = generateDeploymentScripts([svc({ name: 'web' }), svc({ name: 'api' })], baseConfig);
    expect(scripts['deploy-kubernetes.sh']).toContain('NAMESPACE="${NAMESPACE:-production}"');
    expect(scripts['deploy-kubernetes.sh']).toContain('kubectl rollout status deployment/web -n $NAMESPACE');
    expect(scripts['deploy-kubernetes.sh']).toContain('kubectl rollout status deployment/api -n $NAMESPACE');
  });

  it('renders an AWS ECS script iterating over service names', () => {
    const scripts = generateDeploymentScripts([svc({ name: 'web' }), svc({ name: 'api' })], baseConfig);
    expect(scripts['deploy-aws-ecs.sh']).toContain('for service in web api;');
    expect(scripts['deploy-aws-ecs.sh']).toContain('aws ecs update-service');
  });
});

describe('deployService', () => {
  it('dryRun returns a simulated successful result with a URL', async () => {
    const result = await deployService(svc(), 'vercel', baseConfig, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.target).toBe('vercel');
    expect(result.url).toBe(`https://web.production.example.com`);
  });

  it('returns a "not yet implemented" failure for unsupported targets (no process spawn)', async () => {
    const result = await deployService(svc(), 'gcp-cloudrun', baseConfig);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not yet implemented/);
    expect(result.target).toBe('gcp-cloudrun');
  });
});

describe('printDeploymentResults', () => {
  it('summarises successful and failed deployments with total time', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      const results: DeploymentResult[] = [
        { service: svc({ name: 'web' }), target: 'vercel', success: true, duration: 1500, url: 'https://web.example.com' },
        { service: svc({ name: 'api' }), target: 'docker', success: false, duration: 800, error: 'boom' },
      ];
      printDeploymentResults(results);
      const out = spy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(out).toContain('Deployment Summary');
      expect(out).toContain('Deployed 1 service');
      expect(out).toContain('web → vercel');
      expect(out).toContain('Failed 1 deployment');
      expect(out).toContain('api → docker: boom');
      expect(out).toContain('Total time: 2.30s');
    } finally {
      spy.mockRestore();
    }
  });
});
