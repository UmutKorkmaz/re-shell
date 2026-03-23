import { Command } from 'commander';
import { createAsyncCommand, withTimeout } from '../utils/error-handler';
import chalk from 'chalk';

export function registerK8sGroup(program: Command): void {
  const k8s = new Command('k8s')
    .description('Kubernetes manifests, Helm charts, and cluster operations');

  // k8s-manifests → k8s manifests
  k8s
    .command('manifests')
    .description('Generate K8s manifests from workspace YAML with optimization')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--services <services>', 'Services (api:3000,worker:8080)', 'api:3000,worker:8080')
    .option('--namespace <namespace>', 'K8s namespace', 'default')
    .option('--replicas <number>', 'Number of replicas', '3')
    .option('-o, --output <output>', 'Output directory', '/tmp/k8s-manifests')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/k8s-manifest-generator');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n☸️  K8s Manifest Generator\n'));

          // Parse services
          const services = options.services.split(',').map((s: string) => {
            const [name, port] = s.split(':');
            return {
              name,
              language: 'typescript',
              port: parseInt(port),
              image: `${name}:latest`,
              env: {},
            };
          });

          const config = {
            projectName,
            services,
            namespace: options.namespace,
            replicas: parseInt(options.replicas),
          };

          displayConfig(config);

          console.log(chalk.gray('Generating K8s manifest generator...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: k8s-manifest-generator.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: K8S_MANIFESTS.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: k8s-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ K8s manifest generator generated successfully!');
        }, 30000);
      })
    );

  // helm-charts → k8s helm
  k8s
    .command('helm')
    .description('Generate Helm chart templates with environment-specific values and dependency management')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--chart-name <name>', 'Helm chart name', 'my-chart')
    .option('--environments <envs>', 'Environments (dev,staging,prod)', 'dev,staging,prod')
    .option('--services <services>', 'Services (api:3000:my-api,worker:8080:my-worker)', 'api:3000:my-api,worker:8080:my-worker')
    .option('-o, --output <output>', 'Output directory', '/tmp/helm-charts')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/helm-chart-generator');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n⛵ Helm Chart Generator\n'));

          // Parse services
          const services = options.services.split(',').map((s: string) => {
            const [name, port, image] = s.split(':');
            return {
              name,
              port: parseInt(port),
              image: image || `${name}:latest`,
              replicas: 3,
            };
          });

          const config = {
            projectName,
            chartName: options.chartName,
            environments: options.environments.split(','),
            services,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating Helm chart generator...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: helm-chart-generator.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: HELM_CHARTS.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: helm-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ Helm chart generator generated successfully!');
        }, 30000);
      })
    );

  // gitops → k8s gitops
  k8s
    .command('gitops')
    .description('Generate GitOps integration with ArgoCD/Flux for automated deployments and rollbacks')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--platform <platform>', 'GitOps platform (argocd|flux)', 'argocd')
    .option('--git-repo <repo>', 'Git repository URL', 'https://github.com/example/app.git')
    .option('--target-revision <revision>', 'Git target revision', 'main')
    .option('--namespaces <namespaces>', 'Target namespaces (dev,staging,prod)', 'dev,staging,prod')
    .option('--sync-policy <policy>', 'Sync policy (automated|manual)', 'automated')
    .option('-o, --output <output>', 'Output directory', '/tmp/gitops')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/gitops-integration');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🔄 GitOps Integration\n'));

          const config = {
            projectName,
            platform: options.platform,
            gitRepo: options.gitRepo,
            targetRevision: options.targetRevision,
            namespaces: options.namespaces.split(','),
            syncPolicy: options.syncPolicy,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating GitOps integration tool...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: gitops-integration.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: GITOPS.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: gitops-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ GitOps integration tool generated successfully!');
        }, 30000);
      })
    );

  // service-mesh → k8s mesh
  k8s
    .command('mesh')
    .description('Generate service mesh integration with Istio/Linkerd for traffic management and security')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--mesh <mesh>', 'Service mesh (istio|linkerd)', 'istio')
    .option('--services <services>', 'Services (api:3000,worker:8080)', 'api:3000,worker:8080')
    .option('--no-mtls', 'Disable mTLS')
    .option('--no-traffic-management', 'Disable traffic management')
    .option('-o, --output <output>', 'Output directory', '/tmp/service-mesh')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/service-mesh-integration');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🔗 Service Mesh Integration\n'));

          // Parse services
          const services = options.services.split(',').map((s: string) => {
            const [name, port] = s.split(':');
            return {
              name,
              port: parseInt(port) || 3000,
              namespace: 'default',
            };
          });

          const config = {
            projectName,
            mesh: options.mesh,
            services,
            enableMTLS: options.mtls !== false,
            enableTrafficManagement: options.trafficManagement !== false,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating service mesh integration tool...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: service-mesh-integration.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: SERVICE_MESH.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: service-mesh-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ Service mesh integration tool generated successfully!');
        }, 30000);
      })
    );

  // hpa → k8s hpa
  k8s
    .command('hpa')
    .description('Generate Horizontal Pod Autoscaler with custom metrics and predictive scaling')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--min-replicas <number>', 'Minimum replicas', '2')
    .option('--max-replicas <number>', 'Maximum replicas', '10')
    .option('--metrics <metrics>', 'Metrics (cpu:70,memory:80,rps:1000)', 'cpu:70,memory:80')
    .option('--no-predictive-scaling', 'Disable predictive scaling')
    .option('--algorithm <algorithm>', 'Prediction algorithm (linear|exponential|ml-based)', 'ml-based')
    .option('-o, --output <output>', 'Output directory', '/tmp/hpa')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/hpa-generator');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n📊 Horizontal Pod Autoscaler\n'));

          // Parse metrics
          const metrics = options.metrics.split(',').map((m: string) => {
            const [name, target] = m.split(':');
            if (name === 'cpu') {
              return {
                name: 'cpu',
                type: 'Resource',
                resource: {
                  name: 'cpu',
                  target: {
                    type: 'Utilization',
                    averageUtilization: parseInt(target) || 70,
                  },
                },
              };
            } else if (name === 'memory') {
              return {
                name: 'memory',
                type: 'Resource',
                resource: {
                  name: 'memory',
                  target: {
                    type: 'Utilization',
                    averageUtilization: parseInt(target) || 80,
                  },
                },
              };
            } else {
              return {
                name: name,
                type: 'Pods',
                pods: {
                  metric: {
                    name: name,
                  },
                  target: {
                    type: 'AverageValue',
                    averageValue: target || '100',
                  },
                },
              };
            }
          });

          const config = {
            projectName,
            namespace: options.namespace,
            minReplicas: parseInt(options.minReplicas) || 2,
            maxReplicas: parseInt(options.maxReplicas) || 10,
            targetMetrics: metrics,
            behavior: {
              scaleDown: {
                stabilizationWindowSeconds: 300,
                policies: [
                  { type: 'Percent', value: 50, periodSeconds: 60 },
                ],
              },
              scaleUp: {
                stabilizationWindowSeconds: 0,
                policies: [
                  { type: 'Percent', value: 100, periodSeconds: 15 },
                  { type: 'Pods', value: 4, periodSeconds: 15 },
                ],
                selectPolicy: 'Max',
              },
            },
            predictiveScaling: options.predictiveScaling !== false ? {
              enabled: true,
              algorithm: options.algorithm,
              lookbackDays: 7,
              predictionHorizonMinutes: 15,
              scaleUpCooldownMinutes: 5,
              scaleDownCooldownMinutes: 10,
            } : { enabled: false },
          };

          displayConfig(config);

          console.log(chalk.gray('Generating HPA controller...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: hpa-generator.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: HPA.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: hpa-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ HPA controller generated successfully!');
        }, 30000);
      })
    );

  // network-policy → k8s network-policy
  k8s
    .command('network-policy')
    .description('Generate network policies and security contexts with micro-segmentation')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--no-micro-segmentation', 'Disable micro-segmentation')
    .option('--no-deny-all-ingress', 'Disable deny-all ingress policy')
    .option('--no-deny-all-egress', 'Disable deny-all egress policy')
    .option('-o, --output <output>', 'Output directory', '/tmp/network-policy')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/network-policy-generator');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🔒 Network Policies & Security\n'));

          const config = {
            projectName,
            namespace: options.namespace,
            microSegmentation: options.microSegmentation !== false,
            denyAllIngress: options.denyAllIngress !== false,
            denyAllEgress: options.denyAllEgress !== false,
            policies: [
              {
                name: 'allow-api-ingress',
                podSelector: { app: 'api' },
                policyTypes: ['Ingress' as const],
                rules: [
                  {
                    direction: 'Ingress' as const,
                    ports: [{ protocol: 'TCP' as const, port: 8080 }],
                    from: [{ namespaceSelector: { matchLabels: { name: 'ingress-nginx' } } }],
                  },
                ],
              },
              {
                name: 'allow-db-egress',
                podSelector: { app: 'api' },
                policyTypes: ['Egress' as const],
                rules: [
                  {
                    direction: 'Egress' as const,
                    ports: [{ protocol: 'TCP' as const, port: 5432 }],
                    to: [{ podSelector: { matchLabels: { app: 'postgres' } } }],
                  },
                ],
              },
            ],
            podSecurityPolicy: {
              restricted: {
                runAsNonRoot: true,
                runAsUser: 1000,
                seccompProfile: { type: 'RuntimeDefault' as const },
                capabilities: { drop: ['ALL'] },
                readOnlyRootFilesystem: true,
                allowPrivilegeEscalation: false,
              },
            },
          };

          displayConfig(config);

          console.log(chalk.gray('Generating network policy controller...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: network-policy-generator.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: NETWORK_POLICY.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: network-policy-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ Network policy controller generated successfully!');
        }, 30000);
      })
    );

  // crd → k8s crd
  k8s
    .command('crd')
    .description('Generate Custom Resource Definitions and Operators for Kubernetes')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--no-controller', 'Disable operator controller deployment')
    .option('--no-webhooks', 'Disable validation/mutation webhooks')
    .option('-o, --output <output>', 'Output directory', '/tmp/crd')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/crd-generator');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n📋 Custom Resource Definitions\n'));

          const config = {
            projectName,
            namespace: options.namespace,
            enableController: options.controller !== false,
            enableWebhooks: options.webhooks !== false,
            crds: [
              {
                name: 'MicroService',
                group: 're-shell.io',
                scope: 'Namespaced' as const,
                kind: 'MicroService',
                plural: 'microservices',
                singular: 'microservice',
                shortNames: ['ms'],
                properties: {
                  spec: {
                    type: 'object',
                    description: 'Specification of the MicroService',
                    required: true,
                    properties: {
                      replicas: {
                        type: 'number',
                        description: 'Number of replicas',
                      },
                      image: {
                        type: 'string',
                        description: 'Container image',
                        required: true,
                      },
                      port: {
                        type: 'number',
                        description: 'Service port',
                      },
                    },
                  },
                },
              },
              {
                name: 'Database',
                group: 're-shell.io',
                scope: 'Namespaced' as const,
                kind: 'Database',
                plural: 'databases',
                singular: 'database',
                shortNames: ['db'],
                properties: {
                  spec: {
                    type: 'object',
                    description: 'Database specification',
                    properties: {
                      type: {
                        type: 'string',
                        description: 'Database type (postgres, mysql, mongo)',
                        required: true,
                      },
                      version: {
                        type: 'string',
                        description: 'Database version',
                      },
                      size: {
                        type: 'string',
                        description: 'Storage size',
                      },
                    },
                  },
                },
              },
            ],
          };

          displayConfig(config);

          console.log(chalk.gray('Generating CRD operator...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: crd-generator.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: CRD.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: crd-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ CRD operator generated successfully!');
        }, 30000);
      })
    );

  // polyglot-operator → k8s operator
  k8s
    .command('operator')
    .description('Generate polyglot Kubernetes operator for multi-language application management')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--languages <languages>', 'Supported languages (nodejs,python,go)', 'nodejs,python,go')
    .option('--no-lifecycle-hooks', 'Disable lifecycle hooks')
    .option('--no-rollback', 'Disable automatic rollback')
    .option('--no-scaling', 'Disable dynamic scaling')
    .option('--no-monitoring', 'Disable monitoring integration')
    .option('-o, --output <output>', 'Output directory', '/tmp/polyglot-operator')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/polyglot-operator');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🔧 Polyglot Kubernetes Operator\n'));

          // Parse languages
          const languages = options.languages.split(',').map((lang: string) => {
            const langConfigs: Record<string, any> = {
              nodejs: {
                name: 'nodejs',
                runtime: 'node',
                version: '18',
                buildTool: 'npm',
                port: 3000,
                healthCheck: { path: '/health', interval: 30 },
              },
              python: {
                name: 'python',
                runtime: 'python',
                version: '3.11',
                buildTool: 'pip',
                port: 8000,
                healthCheck: { path: '/health', interval: 30 },
              },
              go: {
                name: 'go',
                runtime: 'go',
                version: '1.21',
                buildTool: 'go',
                port: 8080,
                healthCheck: { path: '/health', interval: 30 },
              },
              java: {
                name: 'java',
                runtime: 'java',
                version: '17',
                buildTool: 'maven',
                port: 8080,
                healthCheck: { path: '/actuator/health', interval: 30 },
              },
            };
            return langConfigs[lang.trim()] || langConfigs.nodejs;
          });

          const config = {
            projectName,
            namespace: options.namespace,
            languages,
            enableLifecycleHooks: options.lifecycleHooks !== false,
            enableRollback: options.rollback !== false,
            enableScaling: options.scaling !== false,
            enableMonitoring: options.monitoring !== false,
            lifecycleHooks: [
              {
                name: 'migrate-db',
                type: 'pre-install' as const,
                command: 'npm',
                args: ['run', 'migrate'],
              },
              {
                name: 'seed-data',
                type: 'post-install' as const,
                command: 'npm',
                args: ['run', 'seed'],
              },
            ],
          };

          displayConfig(config);

          console.log(chalk.gray('Generating polyglot operator...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: polyglot-operator.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: POLYGLOT_OPERATOR.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: polyglot-operator-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ Polyglot operator generated successfully!');
        }, 30000);
      })
    );

  // multi-tenant → k8s multi-tenant
  k8s
    .command('multi-tenant')
    .description('Generate multi-tenant isolation and resource quotas with governance policies')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--tenants <tenants>', 'Tenants (tenant-a,tenant-b)', 'tenant-a,tenant-b')
    .option('--environments <environments>', 'Environments per tenant (dev,prod)', 'dev,prod')
    .option('--no-network-isolation', 'Disable network isolation')
    .option('--no-resource-quotas', 'Disable resource quotas')
    .option('--no-limit-ranges', 'Disable limit ranges')
    .option('--no-pod-security-policies', 'Disable pod security policies')
    .option('-o, --output <output>', 'Output directory', '/tmp/multi-tenant')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/multi-tenant-isolation');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🏢 Multi-Tenant Isolation\n'));

          // Parse tenants and environments
          const tenants = options.tenants.split(',');
          const environments = options.environments.split(',');

          const namespaces: any[] = [];
          for (const tenant of tenants) {
            for (const env of environments) {
              const isProd = env.trim() === 'prod';
              namespaces.push({
                name: `${tenant.trim()}-${env.trim()}`,
                tenant: tenant.trim(),
                environment: env.trim(),
                resourceQuota: {
                  name: `${tenant.trim()}-${env.trim()}-quota`,
                  namespace: `${tenant.trim()}-${env.trim()}`,
                  hard: {
                    requests: {
                      cpu: isProd ? '16' : '4',
                      memory: isProd ? '32Gi' : '8Gi',
                    },
                    limits: {
                      cpu: isProd ? '32' : '8',
                      memory: isProd ? '64Gi' : '16Gi',
                    },
                    pods: isProd ? '50' : '10',
                    persistentvolumeclaims: isProd ? '20' : '5',
                    services: isProd ? '50' : '10',
                    secrets: isProd ? '50' : '10',
                    configmaps: isProd ? '50' : '10',
                  },
                },
                limitRange: {
                  name: `${tenant.trim()}-${env.trim()}-limits`,
                  namespace: `${tenant.trim()}-${env.trim()}`,
                  limits: [
                    {
                      type: 'Container',
                      default: {
                        cpu: isProd ? '500m' : '250m',
                        memory: isProd ? '512Mi' : '256Mi',
                      },
                      defaultRequest: {
                        cpu: '100m',
                        memory: '128Mi',
                      },
                      max: {
                        cpu: isProd ? '2' : '1',
                        memory: isProd ? '4Gi' : '2Gi',
                      },
                    },
                  ],
                },
              });
            }
          }

          const config = {
            projectName,
            namespaces,
            enableNetworkIsolation: options.networkIsolation !== false,
            enableResourceQuotas: options.resourceQuotas !== false,
            enableLimitRanges: options.limitRanges !== false,
            enablePodSecurityPolicies: options.podSecurityPolicies !== false,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating multi-tenant isolation...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: multi-tenant-isolation.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: MULTI_TENANT.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: multi-tenant-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ Multi-tenant isolation generated successfully!');
        }, 30000);
      })
    );

  // k8s-cicd → k8s cicd
  k8s
    .command('cicd')
    .description('Generate Kubernetes-native CI/CD pipelines with progressive delivery')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--git-repo <repo>', 'Git repository URL', 'https://github.com/example/app.git')
    .option('--branch <branch>', 'Git branch', 'main')
    .option('--strategy <strategy>', 'Progressive delivery strategy (canary|blue-green|shadow)', 'canary')
    .option('--canary-steps <number>', 'Number of canary steps', '10')
    .option('--canary-interval <seconds>', 'Canary interval in seconds', '60')
    .option('--no-progressive-delivery', 'Disable progressive delivery')
    .option('--no-notifications', 'Disable notifications')
    .option('--no-rollback', 'Disable auto rollback')
    .option('-o, --output <output>', 'Output directory', '/tmp/cicd')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/cicd-pipeline');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🚀 Kubernetes-Native CI/CD Pipeline\n'));

          const config = {
            projectName,
            namespace: options.namespace,
            gitRepo: options.gitRepo,
            branch: options.branch,
            stages: [
              {
                name: 'clone',
                type: 'build' as const,
                image: 'golang:1.21',
                commands: ['git clone $(params.git-repo) .', 'git checkout $(params.git-revision)'],
              },
              {
                name: 'build',
                type: 'build' as const,
                image: 'golang:1.21',
                commands: ['go build -o app ./main.go', 'docker build -t $(params.image-url) .'],
              },
              {
                name: 'test',
                type: 'test' as const,
                image: 'golang:1.21',
                commands: ['go test ./...', 'go vet ./...'],
              },
              {
                name: 'deploy',
                type: 'deploy' as const,
                image: 'bitnami/kubectl:latest',
                commands: ['kubectl apply -f k8s/'],
              },
            ],
            progressiveDelivery: options.progressiveDelivery !== false ? {
              enabled: true,
              strategy: options.strategy,
              canary: {
                steps: parseInt(options.canarySteps) || 10,
                intervalSeconds: parseInt(options.canaryInterval) || 60,
                incrementPercentage: 10,
              },
              analysis: {
                enabled: true,
                metrics: ['request-success-rate', 'request-duration', 'cpu-usage'],
                successThreshold: 99,
              },
            } : { enabled: false },
            enableNotifications: options.notifications !== false,
            enableRollback: options.rollback !== false,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating CI/CD pipeline...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: cicd-pipeline.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: CICD.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: cicd-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ CI/CD pipeline generated successfully!');
        }, 30000);
      })
    );

  // multi-cluster → k8s multi-cluster
  k8s
    .command('multi-cluster')
    .description('Generate multi-cluster deployment strategies with disaster recovery and failover')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--strategy <strategy>', 'Deployment strategy (active-active|active-passive|geo-distributed)', 'active-passive')
    .option('--clusters <clusters>', 'Clusters (us-east:prod,us-west:dr,eu-west:dr)', 'us-east:prod,us-west:dr,eu-west:dr')
    .option('-o, --output <output>', 'Output directory', '/tmp/multi-cluster')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/multi-cluster-deployment');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🌐 Multi-Cluster Deployment\n'));

          // Parse clusters
          const clusters = options.clusters.split(',').map((c: string) => {
            const [name, env] = c.split(':');
            return {
              name,
              context: `${name}-cluster`,
              region: name === 'eu-west' ? 'eu-west-1' : `${name}-1`,
              provider: 'aws',
              environment: env || 'prod',
            };
          });

          const config = {
            projectName,
            clusters,
            strategy: options.strategy,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating multi-cluster deployment tool...'));

          await writeFiles(config, options.output);

          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: multi-cluster-deployment.' + (options.language === 'python' ? 'py' : 'ts'));
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: MULTI_CLUSTER.md');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: package.json (TypeScript) or requirements.txt (Python)');
          console.log('\x1b[32m%s\x1b[0m', '✅ Generated: multi-cluster-config.json');
          console.log('');
          console.log('\x1b[32m%s\x1b[0m', '✓ Multi-cluster deployment tool generated successfully!');
        }, 30000);
      })
    );

  // ingress → k8s ingress
  k8s
    .command('ingress')
    .description('Generate advanced ingress management with SSL/TLS automation and WAF integration')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--ingress-class <class>', 'Ingress class name', 'nginx')
    .option('--hosts <hosts>', 'Comma-separated host names', 'example.com,www.example.com')
    .option('--service-name <name>', 'Backend service name', 'app')
    .option('--service-port <port>', 'Backend service port', '80')
    .option('--ssl-issuer <issuer>', 'SSL issuer (letsencrypt-prod|letsencrypt-staging|self-signed|custom)', 'letsencrypt-prod')
    .option('--no-ssl', 'Disable SSL/TLS')
    .option('--waf-mode <mode>', 'WAF mode (monitoring|active|learning)', 'monitoring')
    .option('--no-waf', 'Disable WAF')
    .option('--waf-ratelimit <rps>', 'Enable rate limiting with RPS limit', '100')
    .option('--no-waf-ratelimit', 'Disable rate limiting')
    .option('--no-cors', 'Disable CORS')
    .option('--no-compression', 'Disable gzip compression')
    .option('-o, --output <output>', 'Output directory', '/tmp/ingress')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/ingress-manager');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🚀 Advanced Ingress Management\n'));

          const hosts = options.hosts.split(',').map((h: string) => h.trim());
          const rules = [{
            host: hosts[0],
            paths: [{
              path: '/',
              pathType: 'Prefix',
              serviceName: options.serviceName,
              servicePort: parseInt(options.servicePort),
            }],
          }];

          const config = {
            projectName,
            namespace: options.namespace,
            ingressClassName: options.ingressClass,
            rules,
            ssl: {
              enabled: options.ssl !== false,
              issuer: options.sslIssuer as 'letsencrypt-prod' | 'letsencrypt-staging' | 'self-signed' | 'custom',
              certificateType: 'cluster-issuer' as const,
              acmeChallenge: 'http01' as const,
            },
            waf: {
              enabled: options.waf !== false,
              mode: options.wafMode as 'monitoring' | 'active' | 'learning',
              rulesets: ['OWASP-Core-Ruleset'],
              rateLimiting: options.wafRatelimit ? {
                enabled: true,
                requestsPerSecond: parseInt(options.wafRatelimit),
                burst: parseInt(options.wafRatelimit) * 2,
              } : undefined,
            },
            enableCORS: options.cors !== false,
            enableCompression: options.compression !== false,
            enableAuth: false,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating ingress management resources...'));

          await writeFiles(config, options.output, options.language);

          console.log(chalk.green(`\n✅ Generated: ingress-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
          console.log(chalk.green(`✅ Generated: INGRESS.md`));
          console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
          console.log(chalk.green(`✅ Generated: ingress-config.json\n`));

          console.log(chalk.green('✓ Ingress management generated successfully!'));
        }, 30000);
      })
    );

  // pod-security → k8s pod-security
  k8s
    .command('pod-security')
    .description('Generate pod security policies and admission controllers with compliance enforcement')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--level <level>', 'Security level (privileged|baseline|restricted)', 'restricted')
    .option('--version <version>', 'Pod Security version (v1.24|v1.25|latest)', 'latest')
    .option('--no-enforce', 'Disable enforcement')
    .option('--no-audit', 'Disable audit')
    .option('--no-warn', 'Disable warning')
    .option('--no-network-policies', 'Disable network policies')
    .option('--no-resource-quotas', 'Disable resource quotas')
    .option('--no-limit-ranges', 'Disable limit ranges')
    .option('-o, --output <output>', 'Output directory', '/tmp/pod-security')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/pod-security');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🚀 Pod Security Policies and Admission Controllers\n'));

          const config = {
            projectName,
            namespace: options.namespace,
            securityProfile: {
              name: 'default',
              level: options.level as 'privileged' | 'baseline' | 'restricted',
              version: options.version as 'v1.24' | 'v1.25' | 'latest',
              enforce: options.enforce !== false,
              audit: options.audit !== false,
              warn: options.warn !== false,
            },
            admissionRules: [],
            compliancePolicies: [],
            enableNetworkPolicies: options.networkPolicies !== false,
            enableResourceQuotas: options.resourceQuotas !== false,
            enableLimitRanges: options.limitRanges !== false,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating pod security policies...'));

          await writeFiles(config, options.output, options.language);

          console.log(chalk.green(`\n✅ Generated: pod-security.${options.language === 'typescript' ? 'ts' : 'py'}`));
          console.log(chalk.green(`✅ Generated: POD_SECURITY.md`));
          console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
          console.log(chalk.green(`✅ Generated: pod-security-config.json\n`));

          console.log(chalk.green('✓ Pod security policies generated successfully!'));
        }, 30000);
      })
    );

  // cluster-manager → k8s cluster
  k8s
    .command('cluster')
    .description('Generate Kubernetes cluster management and upgrade automation with safety checks')
    .argument('<project-name>', 'Name of the project')
    .option('-l, --language <language>', 'Tool language (typescript|python)', 'typescript')
    .option('--context <context>', 'Kubernetes context', 'default')
    .option('--namespace <namespace>', 'Kubernetes namespace', 'default')
    .option('--current-version <version>', 'Current Kubernetes version', '1.27.0')
    .option('--target-version <version>', 'Target Kubernetes version', '1.28.0')
    .option('--auto-approve', 'Auto-approve upgrade')
    .option('--no-drain-nodes', 'Skip node draining')
    .option('--dry-run', 'Dry run only')
    .option('-o, --output <output>', 'Output directory', '/tmp/cluster-manager')
    .action(
      createAsyncCommand(async (projectName, options) => {
        await withTimeout(async () => {
          const { writeFiles, displayConfig } = await import('../utils/cluster-manager');
          const fs = await import('fs-extra');
          const path = await import('path');

          console.log(chalk.cyan.bold('\n🚀 Kubernetes Cluster Management and Upgrade Automation\n'));

          const config = {
            projectName,
            kubeconfig: process.env.KUBECONFIG || '~/.kube/config',
            context: options.context,
            namespace: options.namespace,
            upgradeConfig: {
              currentVersion: options.currentVersion,
              targetVersion: options.targetVersion,
              autoApprove: options.autoApprove || false,
              drainNodes: options.drainNodes !== false,
              ignoreDaemonSets: true,
              timeout: 300,
              dryRun: options.dryRun || false,
            },
            safetyChecks: [],
            enableMonitoring: true,
            enableLogging: true,
          };

          displayConfig(config);

          console.log(chalk.gray('Generating cluster management resources...'));

          await writeFiles(config, options.output, options.language);

          console.log(chalk.green(`\n✅ Generated: cluster-manager.${options.language === 'typescript' ? 'ts' : 'py'}`));
          console.log(chalk.green(`✅ Generated: CLUSTER_MANAGER.md`));
          console.log(chalk.green(`✅ Generated: package.json (${options.language === 'typescript' ? 'TypeScript' : 'Python'}) or requirements.txt (Python)`));
          console.log(chalk.green(`✅ Generated: cluster-config.json\n`));

          console.log(chalk.green('✓ Cluster management generated successfully!'));
        }, 30000);
      })
    );

  program.addCommand(k8s);
}
