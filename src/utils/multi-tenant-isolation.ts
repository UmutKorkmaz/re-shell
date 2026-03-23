// Auto-generated Multi-Tenant Isolation Generator
// Generated at: 2026-01-12T23:22:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface ResourceQuota {
  name: string;
  namespace: string;
  hard: {
    requests?: {
      cpu?: string;
      memory?: string;
      storage?: string;
    };
    limits?: {
      cpu?: string;
      memory?: string;
    };
    pods?: string;
    persistentvolumeclaims?: string;
    services?: string;
    secrets?: string;
    configmaps?: string;
  };
  scopes?: string[];
}

interface LimitRange {
  name: string;
  namespace: string;
  limits: Array<{
    type: 'Container' | 'Pod' | 'PersistentVolumeClaim';
    default?: {
      cpu?: string;
      memory?: string;
    };
    defaultRequest?: {
      cpu?: string;
      memory?: string;
    };
    max?: {
      cpu?: string;
      memory?: string;
    };
    min?: {
      cpu?: string;
      memory?: string;
    };
  }>;
}

interface NetworkPolicy {
  name: string;
  namespace: string;
  podSelector: Record<string, string>;
  policyTypes: Array<'Ingress' | 'Egress'>;
  ingress?: Array<{
    from: Array<{
      namespaceSelector?: Record<string, string>;
      podSelector?: Record<string, string>;
    }>;
  }>;
  egress?: Array<{
    to: Array<{
      namespaceSelector?: Record<string, string>;
    }>;
  }>;
}

interface TenantConfig {
  projectName: string;
  namespaces: Array<{
    name: string;
    tenant: string;
    environment: string;
    resourceQuota?: ResourceQuota;
    limitRange?: LimitRange;
  }>;
  enableNetworkIsolation: boolean;
  enableResourceQuotas: boolean;
  enableLimitRanges: boolean;
  enablePodSecurityPolicies: boolean;
}

export function displayConfig(config: TenantConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Multi-Tenant Isolation & Resource Quotas');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespaces:', config.namespaces.map(n => n.name).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Tenants:', [...new Set(config.namespaces.map(n => n.tenant))].join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Network Isolation:', config.enableNetworkIsolation ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Resource Quotas:', config.enableResourceQuotas ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Limit Ranges:', config.enableLimitRanges ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Pod Security Policies:', config.enablePodSecurityPolicies ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateMultiTenantMD(config: TenantConfig): string {
  let md = '# Multi-Tenant Isolation & Resource Quotas\n\n';
  md += '## Features\n\n';
  md += '- Namespace-based tenant isolation\n';
  md += '- Resource quota management per tenant\n';
  md += '- Limit ranges for resource constraints\n';
  md += '- Network isolation between tenants\n';
  md += '- Pod security policies\n';
  md += '- Role-based access control (RBAC)\n';
  md += '- Resource usage monitoring\n';
  md += '- Governance policies enforcement\n';
  md += '- Tenant-specific priority classes\n';
  md += '- Resource request/limit validation\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import tenant from \'./multi-tenant-isolation\';\n\n';
  md += '// Create tenant namespaces\n';
  md += 'await tenant.createNamespaces();\n\n';
  md += '// Apply resource quotas\n';
  md += 'await tenant.applyResourceQuotas();\n\n';
  md += '// Enforce network isolation\n';
  md += 'await tenant.enforceNetworkIsolation();\n\n';
  md += '// Monitor resource usage\n';
  md += 'await tenant.monitorResources();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptMultiTenant(config: TenantConfig): string {
  let code = '// Auto-generated Multi-Tenant Isolation for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'class MultiTenantIsolation {\n';
  code += '  private projectName: string;\n';
  code += '  private namespaces: any[];\n';
  code += '  private enableNetworkIsolation: boolean;\n';
  code += '  private enableResourceQuotas: boolean;\n';
  code += '  private enableLimitRanges: boolean;\n';
  code += '  private enablePodSecurityPolicies: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespaces = options.namespaces || [];\n';
  code += '    this.enableNetworkIsolation = options.enableNetworkIsolation !== false;\n';
  code += '    this.enableResourceQuotas = options.enableResourceQuotas !== false;\n';
  code += '    this.enableLimitRanges = options.enableLimitRanges !== false;\n';
  code += '    this.enablePodSecurityPolicies = options.enablePodSecurityPolicies !== false;\n';
  code += '  }\n\n';

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Deploying multi-tenant isolation...\');\n\n';

  code += '    // Create namespaces\n';
  code += '    await this.createNamespaces();\n\n';

  code += '    // Apply resource quotas\n';
  code += '    if (this.enableResourceQuotas) {\n';
  code += '      await this.applyResourceQuotas();\n';
  code += '    }\n\n';

  code += '    // Apply limit ranges\n';
  code += '    if (this.enableLimitRanges) {\n';
  code += '      await this.applyLimitRanges();\n';
  code += '    }\n\n';

  code += '    // Enforce network isolation\n';
  code += '    if (this.enableNetworkIsolation) {\n';
  code += '      await this.enforceNetworkIsolation();\n';
  code += '    }\n\n';

  code += '    // Apply pod security policies\n';
  code += '    if (this.enablePodSecurityPolicies) {\n';
  code += '      await this.applyPodSecurityPolicies();\n';
  code += '    }\n\n';

  code += '    // Deploy RBAC\n';
  code += '    await this.deployRBAC();\n\n';

  code += '    console.log(\'[Multi-Tenant] ✓ Multi-tenant isolation deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async createNamespaces(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Creating namespaces...\');\n\n';

  code += '    for (const ns of this.namespaces) {\n';
  code += '      const namespace = {\n';
  code += '        apiVersion: \'v1\',\n';
  code += '        kind: \'Namespace\',\n';
  code += '        metadata: {\n';
  code += '          name: ns.name,\n';
  code += '          labels: {\n';
  code += '            name: ns.name,\n';
  code += '            tenant: ns.tenant,\n';
  code += '            environment: ns.environment,\n';
  code += '            \'managed-by\': this.projectName,\n';
  code += '          },\n';
  code += '          annotations: {\n';
  code += '            description: `Tenant ${ns.tenant} - ${ns.environment}`,\n';
  code += '          },\n';
  code += '        },\n';
  code += '      };\n\n';

  code += '      const yaml = this.toYaml(namespace);\n';
  code += '      const nsPath = path.join(process.cwd(), \'k8s\', \'namespaces\', `${ns.name}.yaml`);\n';
  code += '      fs.mkdirSync(path.dirname(nsPath), { recursive: true });\n';
  code += '      fs.writeFileSync(nsPath, yaml);\n\n';

  code += '      try {\n';
  code += '        execSync(`kubectl apply -f ${nsPath}`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        console.log(`[Multi-Tenant] ✓ Created namespace: ${ns.name}`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Multi-Tenant] ✗ Failed to create namespace ${ns.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async applyResourceQuotas(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Applying resource quotas...\');\n\n';

  code += '    for (const ns of this.namespaces) {\n';
  code += '      if (!ns.resourceQuota) continue;\n\n';

  code += '      const quota = {\n';
  code += '        apiVersion: \'v1\',\n';
  code += '        kind: \'ResourceQuota\',\n';
  code += '        metadata: {\n';
  code += '          name: `${ns.name}-quota`,\n';
  code += '          namespace: ns.name,\n';
  code += '        },\n';
  code += '        spec: {\n';
  code += '          hard: ns.resourceQuota.hard,\n';
  code += '          scopes: ns.resourceQuota.scopes || [],\n';
  code += '        },\n';
  code += '      };\n\n';

  code += '      const yaml = this.toYaml(quota);\n';
  code += '      const quotaPath = path.join(process.cwd(), \'k8s\', \'quotas\', `${ns.name}-quota.yaml`);\n';
  code += '      fs.mkdirSync(path.dirname(quotaPath), { recursive: true });\n';
  code += '      fs.writeFileSync(quotaPath, yaml);\n\n';

  code += '      try {\n';
  code += '        execSync(`kubectl apply -f ${quotaPath}`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        console.log(`[Multi-Tenant] ✓ Applied quota for: ${ns.name}`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Multi-Tenant] ✗ Failed to apply quota for ${ns.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async applyLimitRanges(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Applying limit ranges...\');\n\n';

  code += '    for (const ns of this.namespaces) {\n';
  code += '      if (!ns.limitRange) continue;\n\n';

  code += '      const limitRange = {\n';
  code += '        apiVersion: \'v1\',\n';
  code += '        kind: \'LimitRange\',\n';
  code += '        metadata: {\n';
  code += '          name: `${ns.name}-limits`,\n';
  code += '          namespace: ns.name,\n';
  code += '        },\n';
  code += '        spec: {\n';
  code += '          limits: ns.limitRange.limits,\n';
  code += '        },\n';
  code += '      };\n\n';

  code += '      const yaml = this.toYaml(limitRange);\n';
  code += '      const limitPath = path.join(process.cwd(), \'k8s\', \'limits\', `${ns.name}-limits.yaml`);\n';
  code += '      fs.mkdirSync(path.dirname(limitPath), { recursive: true });\n';
  code += '      fs.writeFileSync(limitPath, yaml);\n\n';

  code += '      try {\n';
  code += '        execSync(`kubectl apply -f ${limitPath}`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        console.log(`[Multi-Tenant] ✓ Applied limits for: ${ns.name}`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Multi-Tenant] ✗ Failed to apply limits for ${ns.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async enforceNetworkIsolation(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Enforcing network isolation...\');\n\n';

  code += '    for (const ns of this.namespaces) {\n';
  code += '      // Deny all ingress/egress by default\n';
  code += '      const denyAll = {\n';
  code += '        apiVersion: \'networking.k8s.io/v1\',\n';
  code += '        kind: \'NetworkPolicy\',\n';
  code += '        metadata: {\n';
  code += '          name: `${ns.name}-deny-all`,\n';
  code += '          namespace: ns.name,\n';
  code += '        },\n';
  code += '        spec: {\n';
  code += '          podSelector: {},\n';
  code += '          policyTypes: [\'Ingress\', \'Egress\'],\n';
  code += '        },\n';
  code += '      };\n\n';

  code += '      // Allow DNS queries\n';
  code += '      const allowDNS = {\n';
  code += '        apiVersion: \'networking.k8s.io/v1\',\n';
  code += '        kind: \'NetworkPolicy\',\n';
  code += '        metadata: {\n';
  code += '          name: `${ns.name}-allow-dns`,\n';
  code += '          namespace: ns.name,\n';
  code += '        },\n';
  code += '        spec: {\n';
  code += '          podSelector: {},\n';
  code += '          policyTypes: [\'Egress\'],\n';
  code += '          egress: [\n';
  code += '            {\n';
  code += '              to: [\n';
  code += '                {\n';
  code += '          namespaceSelector: {\n';
  code += '            matchLabels: {\n';
  code += '              name: \'kube-system\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '        },\n';
  code += '      ],\n';
  code += '      ports: [\n';
  code += '        {\n';
  code += '          protocol: \'UDP\',\n';
  code += '          port: 53,\n';
  code += '        },\n';
  code += '      ],\n';
  code += '    },\n';
  code += '  ],\n';
  code += '},\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '      const policyDir = path.join(process.cwd(), \'k8s\', \'network-policies\');\n';
  code += '      fs.mkdirSync(policyDir, { recursive: true });\n\n';

  code += '      fs.writeFileSync(path.join(policyDir, `${ns.name}-deny-all.yaml`), this.toYaml(denyAll));\n';
  code += '      fs.writeFileSync(path.join(policyDir, `${ns.name}-allow-dns.yaml`), this.toYaml(allowDNS));\n\n';

  code += '      try {\n';
  code += '        execSync(`kubectl apply -f ${policyDir}/${ns.name}-deny-all.yaml`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        execSync(`kubectl apply -f ${policyDir}/${ns.name}-allow-dns.yaml`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        console.log(`[Multi-Tenant] ✓ Enforced isolation for: ${ns.name}`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Multi-Tenant] ✗ Failed to enforce isolation for ${ns.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async applyPodSecurityPolicies(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Applying pod security policies...\');\n\n';

  code += '    // Create PodSecurityPolicy (deprecated in K8s 1.25+, use Pod Security Admission)\n';
  code += '    const psp = {\n';
  code += '      apiVersion: \'policy/v1beta1\',\n';
  code += '      kind: \'PodSecurityPolicy\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-restricted`,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        privileged: false,\n';
  code += '        allowPrivilegeEscalation: false,\n';
  code += '        requiredDropCapabilities: [\'ALL\'],\n';
  code += '        volumes: [\'ConfigMap\', \'EmptyDir\', \'Projected\', \'Secret\', \'DownwardAPI\', \'PersistentVolumeClaim\'],\n';
  code += '        hostNetwork: false,\n';
  code += '        hostIPC: false,\n';
  code += '        hostPID: false,\n';
  code += '        runAsUser: {\n';
  code += '          rule: \'MustRunAsNonRoot\',\n';
  code += '        },\n';
  code += '        seccomp: {\n';
  code += '          profiles: [\n';
  code += '            {\n';
  code += '              type: \'RuntimeDefault\',\n';
  code += '            },\n';
  code += '          ],\n';
  code += '        },\n';
  code += '        fsGroup: {\n';
  code += '          rule: \'MustRunAs\',\n';
  code += '          ranges: [\n';
  code += '            {\n';
  code += '              min: 1000,\n';
  code += '              max: 65535,\n';
  code += '            },\n';
  code += '          ],\n';
  code += '        },\n';
  code += '        readOnlyRootFilesystem: false,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(psp);\n';
  code += '    const pspPath = path.join(process.cwd(), \'k8s\', \'psp\', \'restricted.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(pspPath), { recursive: true });\n';
  code += '    fs.writeFileSync(pspPath, yaml);\n\n';

  code += '    // Apply Pod Security Admission labels (K8s 1.25+)\n';
  code += '    for (const ns of this.namespaces) {\n';
  code += '      try {\n';
  code += '        execSync(`kubectl label --overwrite ns ${ns.name} pod-security.kubernetes.io/enforce=restricted`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        execSync(`kubectl label --overwrite ns ${ns.name} pod-security.kubernetes.io/audit=restricted`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        execSync(`kubectl label --overwrite ns ${ns.name} pod-security.kubernetes.io/warn=restricted`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        console.log(`[Multi-Tenant] ✓ Applied security policies for: ${ns.name}`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Multi-Tenant] ✗ Failed to apply security policies for ${ns.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployRBAC(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Deploying RBAC...\');\n\n';

  code += '    for (const ns of this.namespaces) {\n';
  code += '      // Create service account for tenant\n';
  code += '      const serviceAccount = {\n';
  code += '        apiVersion: \'v1\',\n';
  code += '        kind: \'ServiceAccount\',\n';
  code += '        metadata: {\n';
  code += '          name: `${ns.tenant}-admin`,\n';
  code += '          namespace: ns.name,\n';
  code += '        },\n';
  code += '      };\n\n';

  code += '      // Create role for tenant admin\n';
  code += '      const role = {\n';
  code += '        apiVersion: \'rbac.authorization.k8s.io/v1\',\n';
  code += '        kind: \'Role\',\n';
  code += '        metadata: {\n';
  code += '          name: `${ns.tenant}-admin`,\n';
  code += '          namespace: ns.name,\n';
  code += '        },\n';
  code += '        rules: [\n';
  code += '          {\n';
  code += '            apiGroups: [\'*\'],\n';
  code += '            resources: [\'*\'],\n';
  code += '            verbs: [\'get\', \'list\', \'watch\', \'create\', \'update\', \'patch\', \'delete\'],\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      };\n\n';

  code += '      // Create role binding\n';
  code += '      const roleBinding = {\n';
  code += '        apiVersion: \'rbac.authorization.k8s.io/v1\',\n';
  code += '        kind: \'RoleBinding\',\n';
  code += '        metadata: {\n';
  code += '          name: `${ns.tenant}-admin-binding`,\n';
  code += '          namespace: ns.name,\n';
  code += '        },\n';
  code += '        subjects: [\n';
  code += '          {\n';
  code += '            kind: \'ServiceAccount\',\n';
  code += '            name: `${ns.tenant}-admin`,\n';
  code += '            namespace: ns.name,\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        roleRef: {\n';
  code += '          kind: \'Role\',\n';
  code += '          name: `${ns.tenant}-admin`,\n';
  code += '          apiGroup: \'rbac.authorization.k8s.io\',\n';
  code += '        },\n';
  code += '      };\n\n';

  code += '      const rbacDir = path.join(process.cwd(), \'k8s\', \'rbac\', ns.name);\n';
  code += '      fs.mkdirSync(rbacDir, { recursive: true });\n\n';

  code += '      fs.writeFileSync(path.join(rbacDir, \'serviceaccount.yaml\'), this.toYaml(serviceAccount));\n';
  code += '      fs.writeFileSync(path.join(rbacDir, \'role.yaml\'), this.toYaml(role));\n';
  code += '      fs.writeFileSync(path.join(rbacDir, \'rolebinding.yaml\'), this.toYaml(roleBinding));\n\n';

  code += '      try {\n';
  code += '        execSync(`kubectl apply -f ${rbacDir}`, {\n';
  code += '          stdio: \'pipe\',\n';
  code += '        });\n';
  code += '        console.log(`[Multi-Tenant] ✓ Deployed RBAC for: ${ns.name}`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Multi-Tenant] ✗ Failed to deploy RBAC for ${ns.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async monitorResources(): Promise<void> {\n';
  code += '    console.log(\'[Multi-Tenant] Monitoring resource usage...\');\n\n';

  code += '    for (const ns of this.namespaces) {\n';
  code += '      try {\n';
  code += '        const result = execSync(`kubectl get resourcequota ${ns.name}-quota -n ${ns.name} -o json`, {\n';
  code += '          encoding: \'utf-8\',\n';
  code += '        });\n\n';

  code += '        const quota = JSON.parse(result);\n';
  code += '        console.log(`\\n[Multi-Tenant] Resource usage for ${ns.name}:`);\n';
  code += '        console.log(`  Hard: ${JSON.stringify(quota.status.hard)}`);\n';
  code += '        console.log(`  Used: ${JSON.stringify(quota.status.used)}`);\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[Multi-Tenant] Failed to monitor ${ns.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const multiTenant = new MultiTenantIsolation({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  enableNetworkIsolation: true,\n';
  code += '  enableResourceQuotas: true,\n';
  code += '  enableLimitRanges: true,\n';
  code += '  enablePodSecurityPolicies: true,\n';
  code += '  namespaces: [\n';
  code += '    {\n';
  code += '      name: \'tenant-a-dev\',\n';
  code += '      tenant: \'tenant-a\',\n';
  code += '      environment: \'dev\',\n';
  code += '      resourceQuota: {\n';
  code += '        name: \'tenant-a-dev-quota\',\n';
  code += '        namespace: \'tenant-a-dev\',\n';
  code += '        hard: {\n';
  code += '          requests: {\n';
  code += '            cpu: \'4\',\n';
  code += '            memory: \'8Gi\',\n';
  code += '          },\n';
  code += '          limits: {\n';
  code += '            cpu: \'8\',\n';
  code += '            memory: \'16Gi\',\n';
  code += '          },\n';
  code += '          pods: \'10\',\n';
  code += '          persistentvolumeclaims: \'5\',\n';
  code += '          services: \'10\',\n';
  code += '          secrets: \'10\',\n';
  code += '          configmaps: \'10\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '      limitRange: {\n';
  code += '        name: \'tenant-a-dev-limits\',\n';
  code += '        namespace: \'tenant-a-dev\',\n';
  code += '        limits: [\n';
  code += '          {\n';
  code += '            type: \'Container\',\n';
  code += '            default: {\n';
  code += '              cpu: \'500m\',\n';
  code += '              memory: \'512Mi\',\n';
  code += '            },\n';
  code += '            defaultRequest: {\n';
  code += '              cpu: \'100m\',\n';
  code += '              memory: \'128Mi\',\n';
  code += '            },\n';
  code += '            max: {\n';
  code += '              cpu: \'2\',\n';
  code += '              memory: \'4Gi\',\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    },\n';
  code += '    {\n';
  code += '      name: \'tenant-a-prod\',\n';
  code += '      tenant: \'tenant-a\',\n';
  code += '      environment: \'prod\',\n';
  code += '      resourceQuota: {\n';
  code += '        name: \'tenant-a-prod-quota\',\n';
  code += '        namespace: \'tenant-a-prod\',\n';
  code += '        hard: {\n';
  code += '          requests: {\n';
  code += '            cpu: \'16\',\n';
  code += '            memory: \'32Gi\',\n';
  code+'          },\n';
  code += '          limits: {\n';
  code += '            cpu: \'32\',\n';
  code += '            memory: \'64Gi\',\n';
  code += '          },\n';
  code += '          pods: \'50\',\n';
  code += '          persistentvolumeclaims: \'20\',\n';
  code += '          services: \'50\',\n';
  code += '          secrets: \'50\',\n';
  code += '          configmaps: \'50\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '    },\n';
  code += '  ],\n';
  code += '});\n\n';

  code += 'export default multiTenant;\n';
  code += 'export { MultiTenantIsolation, ResourceQuota, LimitRange, TenantConfig };\n';

  return code;
}

export function generatePythonMultiTenant(config: TenantConfig): string {
  let code = '# Auto-generated Multi-Tenant Isolation for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';

  code += '@dataclass\n';
  code += 'class ResourceQuota:\n';
  code += '    name: str\n';
  code += '    namespace: str\n';
  code += '    hard: Dict[str, Any]\n';
  code += '    scopes: Optional[List[str]] = None\n\n';

  code += '@dataclass\n';
  code += 'class LimitRange:\n';
  code += '    name: str\n';
  code += '    namespace: str\n';
  code += '    limits: List[Dict[str, Any]]\n\n';

  code += 'class MultiTenantIsolation:\n';
  code += '    def __init__(self, project_name: str = None, namespaces: List[Dict[str, Any]] = None, enable_network_isolation: bool = True, enable_resource_quotas: bool = True, enable_limit_ranges: bool = True, enable_pod_security_policies: bool = True):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespaces = namespaces or []\n';
  code += '        self.enable_network_isolation = enable_network_isolation\n';
  code += '        self.enable_resource_quotas = enable_resource_quotas\n';
  code += '        self.enable_limit_ranges = enable_limit_ranges\n';
  code += '        self.enable_pod_security_policies = enable_pod_security_policies\n\n';

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[Multi-Tenant] Deploying multi-tenant isolation...")\n';
  code += '        await self._create_namespaces()\n';
  code += '        if self.enable_resource_quotas:\n';
  code += '            await self._apply_resource_quotas()\n';
  code += '        if self.enable_limit_ranges:\n';
  code += '            await self._apply_limit_ranges()\n';
  code += '        print("[Multi-Tenant] ✓ Multi-tenant isolation deployed successfully")\n\n';

  code += '    async def monitor_resources(self) -> None:\n';
  code += '        print("[Multi-Tenant] Monitoring resource usage...")\n';
  code += '        for ns in self.namespaces:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["kubectl", "get", "resourcequota", f"{ns[\'name\']}-quota", "-n", ns["name"], "-o", "json"],\n';
  code += '                capture_output=True,\n';
  code += '                text=True,\n';
  code += '                check=True\n';
  code += '            )\n';
  code += '            quota = json.loads(result.stdout)\n';
  code += '            print(f"\\n[Multi-Tenant] Resource usage for {ns[\'name\']}:")\n';
  code += '            print(f"  Hard: {quota[\'status\'][\'hard\']}")\n';
  code += '            print(f"  Used: {quota[\'status\'][\'used\']}")\n\n';

  code += 'multi_tenant = MultiTenantIsolation(\n';
  code += '    project_name="my-app",\n';
  code += '    enable_network_isolation=True,\n';
  code += '    enable_resource_quotas=True,\n';
  code += '    enable_limit_ranges=True,\n';
  code += '    enable_pod_security_policies=True,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: TenantConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptMultiTenant(config);
  fs.writeFileSync(path.join(outputDir, 'multi-tenant-isolation.ts'), tsCode);

  const pyCode = generatePythonMultiTenant(config);
  fs.writeFileSync(path.join(outputDir, 'multi-tenant-isolation.py'), pyCode);

  const md = generateMultiTenantMD(config);
  fs.writeFileSync(path.join(outputDir, 'MULTI_TENANT.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Multi-tenant isolation and resource quotas',
    main: 'multi-tenant-isolation.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0');
  fs.writeFileSync(path.join(outputDir, 'multi-tenant-config.json'), JSON.stringify(config, null, 2));
}
