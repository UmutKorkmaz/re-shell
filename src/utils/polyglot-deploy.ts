/**
 * Polyglot Deployment System
 * Unified deployment commands for multi-language full-stack applications
 * Supports Docker, Kubernetes, AWS, GCP, Azure, Vercel, Netlify, and more
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { ProgressSpinner } from './spinner';
import { ServiceInfo, detectLanguage, detectFramework, scanWorkspace } from './polyglot-build';

const execAsync = promisify(exec);

export type DeploymentTarget =
  | 'docker'
  | 'kubernetes'
  | 'aws-lambda'
  | 'aws-ecs'
  | 'aws-eks'
  | 'gcp-cloudrun'
  | 'gcp-gke'
  | 'azure-container'
  | 'azure-aks'
  | 'vercel'
  | 'netlify'
  | 'heroku'
  | 'railway'
  | 'render'
  | 'fly-io'
  | 'digitalocean';

export type DeploymentEnvironment = 'development' | 'staging' | 'production';

export interface DeploymentConfig {
  target: DeploymentTarget;
  environment: DeploymentEnvironment;
  region?: string;
  domain?: string;
  envVars?: Record<string, string>;
  secrets?: Record<string, string>;
  resources?: {
    cpu?: string;
    memory?: string;
    replicas?: number;
  };
  scaling?: {
    min?: number;
    max?: number;
    targetCpu?: number;
    targetMemory?: number;
  };
}

export interface DeploymentOptions {
  dryRun?: boolean;
  verbose?: boolean;
  skipBuild?: boolean;
  spinner?: ProgressSpinner;
  filter?: {
    type?: string[];
    language?: string[];
    name?: string[];
  };
}

export interface DeploymentResult {
  service: ServiceInfo;
  target: DeploymentTarget;
  success: boolean;
  duration: number;
  error?: string;
  url?: string;
}

/**
 * Generate Docker Compose configuration for all services
 */
export function generateDockerCompose(services: ServiceInfo[], config: DeploymentConfig): string {
  const servicesConfig: Record<string, any> = {};

  for (const service of services) {
    const serviceName = service.name;
    const serviceConfig: any = {
      build: {
        context: `./${path.relative(process.cwd(), service.path)}`,
      },
      environment: config.envVars || {},
    };

    // Add build args for production
    if (config.environment === 'production') {
      serviceConfig.build.args = ['NODE_ENV=production'];
    }

    // Add resource limits
    if (config.resources) {
      serviceConfig.deploy = {
        resources: {
          limits: {
            cpus: config.resources.cpu || '1',
            memory: config.resources.memory || '512M',
          },
        },
      };
    }

    // Add port mappings
    if (service.type === 'backend' || service.type === 'frontend') {
      serviceConfig.ports = ['3000:3000'];
    }

    // Add health checks
    serviceConfig.healthcheck = {
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health'],
      interval: '30s',
      timeout: '10s',
      retries: 3,
    };

    servicesConfig[serviceName] = serviceConfig;
  }

  return JSON.stringify({
    version: '3.8',
    services: servicesConfig,
  }, null, 2);
}

/**
 * Generate Kubernetes manifests for all services
 */
export function generateKubernetesManifests(services: ServiceInfo[], config: DeploymentConfig): Record<string, string> {
  const manifests: Record<string, string> = {};

  for (const service of services) {
    const namespace = config.environment;
    const serviceName = service.name;

    // Generate Deployment
    const deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: serviceName,
        namespace,
        labels: {
          app: serviceName,
          environment: config.environment,
        },
      },
      spec: {
        replicas: config.resources?.replicas || (config.environment === 'production' ? 3 : 1),
        selector: {
          matchLabels: {
            app: serviceName,
          },
        },
        template: {
          metadata: {
            labels: {
              app: serviceName,
            },
          },
          spec: {
            containers: [
              {
                name: serviceName,
                image: `${serviceName}:latest`,
                ports: [
                  {
                    containerPort: 3000,
                  },
                ],
                env: Object.entries(config.envVars || {}).map(([name, value]) => ({
                  name,
                  value,
                })),
                resources: {
                  requests: {
                    cpu: config.resources?.cpu || '100m',
                    memory: config.resources?.memory || '128Mi',
                  },
                  limits: {
                    cpu: config.resources?.cpu || '1',
                    memory: config.resources?.memory || '512Mi',
                  },
                },
                livenessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 3000,
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                },
                readinessProbe: {
                  httpGet: {
                    path: '/health',
                    port: 3000,
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                },
              },
            ],
          },
        },
      },
    };

    // Generate Service
    const k8sService = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: serviceName,
        namespace,
        labels: {
          app: serviceName,
        },
      },
      spec: {
        type: service.type === 'frontend' ? 'LoadBalancer' : 'ClusterIP',
        ports: [
          {
            port: 80,
            targetPort: 3000,
          },
        ],
        selector: {
          app: serviceName,
        },
      },
    };

    // Generate HorizontalPodAutoscaler
    const hpa = {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: serviceName,
        namespace,
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: serviceName,
        },
        minReplicas: config.scaling?.min || 1,
        maxReplicas: config.scaling?.max || 10,
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: config.scaling?.targetCpu || 70,
              },
            },
          },
          {
            type: 'Resource',
            resource: {
              name: 'memory',
              target: {
                type: 'Utilization',
                averageUtilization: config.scaling?.targetMemory || 80,
              },
            },
          },
        ],
      },
    };

    // Generate Ingress for frontend services
    let ingress: any = null;
    if (service.type === 'frontend' && config.domain) {
      ingress = {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: serviceName,
          namespace,
          annotations: {
            'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
            'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
          },
        },
        spec: {
          tls: [
            {
              hosts: [config.domain],
              secretName: `${serviceName}-tls`,
            },
          ],
          rules: [
            {
              host: config.domain,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: serviceName,
                        port: {
                          number: 80,
                        },
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      };
    }

    manifests[`${serviceName}-deployment.yaml`] = JSON.stringify(deployment, null, 2);
    manifests[`${serviceName}-service.yaml`] = JSON.stringify(k8sService, null, 2);
    manifests[`${serviceName}-hpa.yaml`] = JSON.stringify(hpa, null, 2);

    if (ingress) {
      manifests[`${serviceName}-ingress.yaml`] = JSON.stringify(ingress, null, 2);
    }
  }

  return manifests;
}

/**
 * Generate AWS Lambda deployment configuration
 */
export function generateAwsLambdaConfig(service: ServiceInfo, config: DeploymentConfig): any {
  const runtimeMap: Record<string, string> = {
    python: 'python3.11',
    javascript: 'nodejs20.x',
    typescript: 'nodejs20.x',
    go: 'provided.al2',
    rust: 'provided.al2',
  };

  return {
    FunctionName: service.name,
    Runtime: runtimeMap[service.language] || 'nodejs20.x',
    Handler: service.language === 'python' ? 'index.handler' : 'index.handler',
    Timeout: 30,
    MemorySize: 512,
    Environment: {
      Variables: config.envVars || {},
    },
    Tags: {
      Environment: config.environment,
      ManagedBy: 're-shell',
    },
  };
}

/**
 * Generate Vercel deployment configuration
 */
export function generateVercelConfig(services: ServiceInfo[], config: DeploymentConfig): any {
  const projects: any = {};

  for (const service of services) {
    if (service.type === 'frontend') {
      projects[service.name] = {
        framework: detectFramework(service.path, service.language),
        buildCommand: service.buildCommand,
        outputDirectory: 'dist',
        env: config.envVars || {},
      };
    }
  }

  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    projects,
  };
}

/**
 * Generate Netlify deployment configuration
 */
export function generateNetlifyConfig(service: ServiceInfo, config: DeploymentConfig): any {
  return {
    version: 2,
    build: {
      command: service.buildCommand,
      publish: 'dist',
    },
    environment: config.envVars || {},
    functions: {
      directory: 'netlify/functions',
    },
  };
}

/**
 * Generate deployment scripts
 */
export function generateDeploymentScripts(
  services: ServiceInfo[],
  config: DeploymentConfig
): Record<string, string> {
  const scripts: Record<string, string> = {};

  // Docker Compose deploy script
  scripts['deploy-docker.sh'] = `#!/bin/bash
set -e

echo "🐳 Deploying services with Docker Compose..."

${config.environment === 'production' ? 'docker compose -f docker-compose.prod.yml up -d' : 'docker compose up -d'}

echo "✅ Services deployed successfully!"
echo "🌐 Access services at:"
${services.map(s => `echo "   - ${s.name}: http://localhost:3000"`).join('\n')}
`;

  // Kubernetes deploy script
  const namespace = config.environment;
  const namespaceLine = 'NAMESPACE="${NAMESPACE:-' + namespace + '}"';
  const kubectlCommands = services.map(s => `kubectl rollout status deployment/${s.name} -n $NAMESPACE`).join('\n');
  const echoCommands = services.map(s => `echo "   - ${s.name}: kubectl get pods -n $NAMESPACE -l app=${s.name}"`).join('\n');

  scripts['deploy-kubernetes.sh'] = `#!/bin/bash
set -e

${namespaceLine}

echo "☸️  Deploying services to Kubernetes..."

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Apply manifests
for manifest in k8s/*.yaml; do
  echo "Applying $manifest..."
  kubectl apply -f $manifest -n $NAMESPACE
done

# Wait for deployments to be ready
echo "Waiting for deployments to be ready..."
${kubectlCommands}

echo "✅ Services deployed successfully!"
${echoCommands}
`;

  // AWS ECS deploy script
  const serviceNames = services.map(s => s.name).join(' ');

  scripts['deploy-aws-ecs.sh'] = `#!/bin/bash
set -e

echo "🚀 Deploying services to AWS ECS..."

CLUSTER_NAME="\${CLUSTER_NAME:-reshell-cluster}"
REGION="\${REGION:-us-east-1}"

for service in ${serviceNames}; do
  echo "Deploying $service..."

  # Build and push Docker image
  aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

  docker build -t $service:latest ./apps/$service
  docker tag $service:latest $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$service:latest
  docker push $AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$service:latest

  # Update ECS service
  aws ecs update-service --cluster $CLUSTER_NAME --service $service --force-new-deployment --region $REGION
done

echo "✅ Services deployed to AWS ECS!"
`;

  return scripts;
}

/**
 * Deploy a single service
 */
export async function deployService(
  service: ServiceInfo,
  target: DeploymentTarget,
  config: DeploymentConfig,
  options: DeploymentOptions = {}
): Promise<DeploymentResult> {
  const { dryRun = false, verbose = false } = options;
  const startTime = Date.now();

  if (dryRun) {
    return {
      service,
      target,
      success: true,
      duration: Date.now() - startTime,
      url: `https://${service.name}.${config.environment}.example.com`,
    };
  }

  try {
    switch (target) {
      case 'docker':
        return await deployToDocker(service, config, options);
      case 'kubernetes':
        return await deployToKubernetes(service, config, options);
      case 'vercel':
        return await deployToVercel(service, config, options);
      case 'netlify':
        return await deployToNetlify(service, config, options);
      case 'aws-ecs':
        return await deployToAwsEcs(service, config, options);
      default:
        return {
          service,
          target,
          success: false,
          duration: Date.now() - startTime,
          error: `Deployment target ${target} not yet implemented`,
        };
    }
  } catch (error: any) {
    return {
      service,
      target,
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Deploy to Docker Compose
 */
async function deployToDocker(
  service: ServiceInfo,
  config: DeploymentConfig,
  options: DeploymentOptions
): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    const composePath = path.join(process.cwd(), 'docker-compose.yml');
    if (!fs.existsSync(composePath)) {
      throw new Error('docker-compose.yml not found. Generate it first with deployment config.');
    }

    const cmd = config.environment === 'production'
      ? 'docker compose -f docker-compose.prod.yml up -d'
      : 'docker compose up -d';

    await execAsync(cmd, { timeout: 300000 });

    return {
      service,
      target: 'docker',
      success: true,
      duration: Date.now() - startTime,
      url: `http://localhost:3000`,
    };
  } catch (error: any) {
    return {
      service,
      target: 'docker',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Deploy to Kubernetes
 */
async function deployToKubernetes(
  service: ServiceInfo,
  config: DeploymentConfig,
  options: DeploymentOptions
): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    const namespace = config.environment;
    const manifestPath = path.join(process.cwd(), 'k8s', `${service.name}-deployment.yaml`);

    if (!fs.existsSync(manifestPath)) {
      throw new Error('Kubernetes manifest not found. Generate it first with deployment config.');
    }

    // Create namespace
    await execAsync(`kubectl create namespace ${namespace} --dry-run=client -o yaml | kubectl apply -f -`);

    // Apply manifest
    await execAsync(`kubectl apply -f ${manifestPath} -n ${namespace}`);

    // Wait for rollout
    await execAsync(`kubectl rollout status deployment/${service.name} -n ${namespace} --timeout=5m`);

    // Get service URL
    const { stdout } = await execAsync(`kubectl get service ${service.name} -n ${namespace} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'`);

    return {
      service,
      target: 'kubernetes',
      success: true,
      duration: Date.now() - startTime,
      url: stdout || `http://${service.name}.${namespace}.svc.cluster.local`,
    };
  } catch (error: any) {
    return {
      service,
      target: 'kubernetes',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Deploy to Vercel
 */
async function deployToVercel(
  service: ServiceInfo,
  config: DeploymentConfig,
  options: DeploymentOptions
): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    if (!fs.existsSync(path.join(service.path, 'vercel.json'))) {
      throw new Error('vercel.json not found. Generate it first with deployment config.');
    }

    const originalCwd = process.cwd();
    process.chdir(service.path);

    try {
      const { stdout } = await execAsync('vercel --prod --yes', {
        env: {
          ...process.env,
          ...config.envVars,
        },
        timeout: 300000,
      });

      // Extract URL from output
      const urlMatch = stdout.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);

      return {
        service,
        target: 'vercel',
        success: true,
        duration: Date.now() - startTime,
        url: urlMatch ? urlMatch[0] : undefined,
      };
    } finally {
      process.chdir(originalCwd);
    }
  } catch (error: any) {
    return {
      service,
      target: 'vercel',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Deploy to Netlify
 */
async function deployToNetlify(
  service: ServiceInfo,
  config: DeploymentConfig,
  options: DeploymentOptions
): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    const originalCwd = process.cwd();
    process.chdir(service.path);

    try {
      const { stdout } = await execAsync('netlify deploy --prod --dir=dist', {
        env: {
          ...process.env,
          ...config.envVars,
        },
        timeout: 300000,
      });

      // Extract URL from output
      const urlMatch = stdout.match(/https:\/\/[a-zA-Z0-9-]+\.netlify\.app/);

      return {
        service,
        target: 'netlify',
        success: true,
        duration: Date.now() - startTime,
        url: urlMatch ? urlMatch[0] : undefined,
      };
    } finally {
      process.chdir(originalCwd);
    }
  } catch (error: any) {
    return {
      service,
      target: 'netlify',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Deploy to AWS ECS
 */
async function deployToAwsEcs(
  service: ServiceInfo,
  config: DeploymentConfig,
  options: DeploymentOptions
): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    const clusterName = process.env.AWS_ECS_CLUSTER || 'reshell-cluster';
    const region = config.region || 'us-east-1';
    const accountId = process.env.AWS_ACCOUNT_ID;

    if (!accountId) {
      throw new Error('AWS_ACCOUNT_ID environment variable is required');
    }

    // Build and push Docker image
    const registry = `${accountId}.dkr.ecr.${region}.amazonaws.com`;
    const imageName = `${registry}/${service.name}:latest`;

    await execAsync(`aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${registry}`);
    await execAsync(`docker build -t ${service.name}:latest ${service.path}`);
    await execAsync(`docker tag ${service.name}:latest ${imageName}`);
    await execAsync(`docker push ${imageName}`);

    // Update ECS service
    await execAsync(`aws ecs update-service --cluster ${clusterName} --service ${service.name} --force-new-deployment --region ${region}`);

    return {
      service,
      target: 'aws-ecs',
      success: true,
      duration: Date.now() - startTime,
      url: `http://${service.name}.${clusterName}.${region}.elb.amazonaws.com`,
    };
  } catch (error: any) {
    return {
      service,
      target: 'aws-ecs',
      success: false,
      duration: Date.now() - startTime,
      error: error.message,
    };
  }
}

/**
 * Print deployment results summary
 */
export function printDeploymentResults(results: DeploymentResult[]): void {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(chalk.bold('\n🚀 Deployment Summary\n'));

  if (successful.length > 0) {
    console.log(chalk.green(`✅ Deployed ${successful.length} service${successful.length > 1 ? 's' : ''}:`));
    for (const result of successful) {
      const duration = ((result.duration / 1000).toFixed(2)) + 's';
      const url = result.url ? chalk.cyan(result.url) : '';
      console.log(chalk.green(`   ✓ ${result.service.name} → ${result.target} - ${duration} ${url}`));
    }
  }

  if (failed.length > 0) {
    console.log(chalk.red(`\n❌ Failed ${failed.length} deployment${failed.length > 1 ? 's' : ''}:`));
    for (const result of failed) {
      console.log(chalk.red(`   ✗ ${result.service.name} → ${result.target}: ${result.error}`));
    }
  }

  console.log(chalk.gray(`\n⏱️  Total time: ${((totalDuration / 1000).toFixed(2))}s\n`));
}
