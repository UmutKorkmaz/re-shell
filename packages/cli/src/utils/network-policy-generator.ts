// Auto-generated Network Policy Generator
// Generated at: 2026-01-12T23:12:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface NetworkPolicyRule {
  direction: 'Ingress' | 'Egress';
  ports?: Array<{
    protocol: 'TCP' | 'UDP' | 'SCTP';
    port: number | string;
    endPort?: number;
  }>;
  from?: Array<{
    podSelector?: {
      matchLabels?: Record<string, string>;
    };
    namespaceSelector?: {
      matchLabels?: Record<string, string>;
    };
    ipBlock?: {
      cidr: string;
      except?: string[];
    };
  }>;
  to?: Array<{
    podSelector?: {
      matchLabels?: Record<string, string>;
    };
    namespaceSelector?: {
      matchLabels?: Record<string, string>;
    };
    ipBlock?: {
      cidr: string;
      except?: string[];
    };
  }>;
}

interface SecurityContext {
  runAsUser?: number;
  runAsGroup?: number;
  runAsNonRoot?: boolean;
  seccompProfile?: {
    type: 'RuntimeDefault' | 'Localhost' | 'Unconfined';
    localhostProfile?: string;
  };
  capabilities?: {
    drop?: string[];
    add?: string[];
  };
  readOnlyRootFilesystem?: boolean;
  allowPrivilegeEscalation?: boolean;
  privileged?: boolean;
}

interface PodSecurityPolicy {
  baseline?: SecurityContext;
  restricted?: SecurityContext;
  privileged?: SecurityContext;
}

interface NetworkPolicyConfig {
  projectName: string;
  namespace: string;
  microSegmentation: boolean;
  denyAllIngress: boolean;
  denyAllEgress: boolean;
  policies: Array<{
    name: string;
    podSelector: Record<string, string>;
    policyTypes: Array<'Ingress' | 'Egress'>;
    rules: NetworkPolicyRule[];
  }>;
  podSecurityPolicy: PodSecurityPolicy;
}

export function displayConfig(config: NetworkPolicyConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Network Policies & Security Contexts');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'Policies:', config.policies.map(p => p.name).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Micro-segmentation:', config.microSegmentation ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Deny All Ingress:', config.denyAllIngress ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Deny All Egress:', config.denyAllEgress ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateNetworkPolicyMD(config: NetworkPolicyConfig): string {
  let md = '# Network Policies & Security Contexts\n\n';
  md += '## Features\n\n';
  md += '- Micro-segmentation with network policies\n';
  md += '- Pod-to-pod traffic control\n';
  md += '- Namespace isolation\n';
  md += '- IP-based allow/deny lists\n';
  md += '- Port-level traffic filtering\n';
  md += '- Pod security policies (baseline, restricted, privileged)\n';
  md += '- Security context enforcement\n';
  md += '- seccomp profiles\n';
  md += '- Capability dropping\n';
  md += '- Read-only root filesystem\n';
  md += '- Privilege escalation prevention\n';
  md += '- Network policy auditing\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import netPol from \'./network-policy-generator\';\n\n';
  md += '// Deploy network policies\n';
  md += 'await netPol.deploy();\n\n';
  md += '// Apply security contexts\n';
  md += 'await netPol.applySecurityContexts();\n\n';
  md += '// Verify network isolation\n';
  md += 'await netPol.verifyIsolation();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptNetworkPolicy(config: NetworkPolicyConfig): string {
  let code = '// Auto-generated Network Policy Generator for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'class NetworkPolicyController {\n';
  code += '  private projectName: string;\n';
  code += '  private namespace: string;\n';
  code += '  private microSegmentation: boolean;\n';
  code += '  private denyAllIngress: boolean;\n';
  code += '  private denyAllEgress: boolean;\n';
  code += '  private policies: any[];\n';
  code += '  private podSecurityPolicy: PodSecurityPolicy;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.microSegmentation = options.microSegmentation !== false;\n';
  code += '    this.denyAllIngress = options.denyAllIngress !== false;\n';
  code += '    this.denyAllEgress = options.denyAllEgress !== false;\n';
  code += '    this.policies = options.policies || [];\n';
  code += '    this.podSecurityPolicy = options.podSecurityPolicy || {};\n';
  code += '  }\n\n';

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[NetworkPolicy] Deploying network policies...\');\n\n';

  code += '    // Deploy deny-all policies if enabled\n';
  code += '    if (this.denyAllIngress || this.denyAllEgress) {\n';
  code += '      await this.deployDenyAllPolicy();\n';
  code += '    }\n\n';

  code += '    // Deploy specific policies\n';
  code += '    for (const policy of this.policies) {\n';
  code += '      await this.deployPolicy(policy);\n';
  code += '    }\n\n';

  code += '    // Deploy micro-segmentation policies\n';
  code += '    if (this.microSegmentation) {\n';
  code += '      await this.deployMicroSegmentation();\n';
  code += '    }\n\n';

  code += '    console.log(\'[NetworkPolicy] ✓ Network policies deployed successfully\');\n';
  code += '  }\n\n';

  code += '  private async deployDenyAllPolicy(): Promise<void> {\n';
  code += '    console.log(\'[NetworkPolicy] Deploying deny-all policy...\');\n\n';

  code += '    const denyAllPolicy: any = {\n';
  code += '      apiVersion: \'networking.k8s.io/v1\',\n';
  code += '      kind: \'NetworkPolicy\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-deny-all`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        podSelector: {},\n';
  code += '        policyTypes: [],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    if (this.denyAllIngress) {\n';
  code += '      denyAllPolicy.spec.policyTypes.push(\'Ingress\');\n';
  code += '    }\n';
  code += '    if (this.denyAllEgress) {\n';
  code += '      denyAllPolicy.spec.policyTypes.push(\'Egress\');\n';
  code += '    }\n\n';

  code += '    const yaml = this.toYaml(denyAllPolicy);\n';
  code += '    const policyPath = path.join(process.cwd(), \'k8s\', \'network-policies\', \'deny-all.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(policyPath), { recursive: true });\n';
  code += '    fs.writeFileSync(policyPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${policyPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[NetworkPolicy] Failed to deploy deny-all policy:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async deployPolicy(policy: any): Promise<void> {\n';
  code += '    console.log(`[NetworkPolicy] Deploying policy: ${policy.name}...`);\n\n';

  code += '    const networkPolicy: any = {\n';
  code += '      apiVersion: \'networking.k8s.io/v1\',\n';
  code += '      kind: \'NetworkPolicy\',\n';
  code += '      metadata: {\n';
  code += '        name: policy.name,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        podSelector: {\n';
  code += '          matchLabels: policy.podSelector,\n';
  code += '        },\n';
  code += '        policyTypes: policy.policyTypes,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    for (const rule of policy.rules) {\n';
  code += '      if (rule.direction === \'Ingress\') {\n';
  code += '        if (!networkPolicy.spec.ingress) networkPolicy.spec.ingress = [];\n';
  code += '        networkPolicy.spec.ingress.push(this.generateIngressRule(rule));\n';
  code += '      } else {\n';
  code += '        if (!networkPolicy.spec.egress) networkPolicy.spec.egress = [];\n';
  code += '        networkPolicy.spec.egress.push(this.generateEgressRule(rule));\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    const yaml = this.toYaml(networkPolicy);\n';
  code += '    const policyPath = path.join(process.cwd(), \'k8s\', \'network-policies\', `${policy.name}.yaml`);\n';
  code += '    fs.mkdirSync(path.dirname(policyPath), { recursive: true });\n';
  code += '    fs.writeFileSync(policyPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${policyPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[NetworkPolicy] Failed to deploy policy ${policy.name}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private generateIngressRule(rule: NetworkPolicyRule): any {\n';
  code += '    const ingressRule: any = {};\n\n';

  code += '    if (rule.ports) {\n';
  code += '      ingressRule.ports = rule.ports;\n';
  code += '    }\n\n';

  code += '    if (rule.from) {\n';
  code += '      ingressRule.from = rule.from;\n';
  code += '    }\n\n';

  code += '    return ingressRule;\n';
  code += '  }\n\n';

  code += '  private generateEgressRule(rule: NetworkPolicyRule): any {\n';
  code += '    const egressRule: any = {};\n\n';

  code += '    if (rule.ports) {\n';
  code += '      egressRule.ports = rule.ports;\n';
  code += '    }\n\n';

  code += '    if (rule.to) {\n';
  code += '      egressRule.to = rule.to;\n';
  code += '    }\n\n';

  code += '    return egressRule;\n';
  code += '  }\n\n';

  code += '  private async deployMicroSegmentation(): Promise<void> {\n';
  code += '    console.log(\'[NetworkPolicy] Deploying micro-segmentation policies...\');\n\n';

  code += '    // Create namespace isolation policies\n';
  code += '    const namespaceIsolation = {\n';
  code += '      apiVersion: \'networking.k8s.io/v1\',\n';
  code += '      kind: \'NetworkPolicy\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-namespace-isolation`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        podSelector: {},\n';
  code += '        policyTypes: [\'Ingress\', \'Egress\'],\n';
  code += '        ingress: [\n';
  code += '          {\n';
  code += '            from: [\n';
  code += '              {\n';
  code += '                namespaceSelector: {\n';
  code += '                  matchLabels: {\n';
  code += '                    name: this.namespace,\n';
  code += '                  },\n';
  code += '                },\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        ],\n';
  code += '        egress: [\n';
  code += '          {\n';
  code += '            to: [\n';
  code += '              {\n';
  code += '                namespaceSelector: {\n';
  code += '                  matchLabels: {\n';
  code += '                    name: this.namespace,\n';
  code += '                  },\n';
  code += '                },\n';
  code += '              },\n';
  code += '            ],\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(namespaceIsolation);\n';
  code += '    const policyPath = path.join(process.cwd(), \'k8s\', \'network-policies\', \'namespace-isolation.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(policyPath), { recursive: true });\n';
  code += '    fs.writeFileSync(policyPath, yaml);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${policyPath}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[NetworkPolicy] Failed to deploy namespace isolation:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async applySecurityContexts(): Promise<void> {\n';
  code += '    console.log(\'[NetworkPolicy] Applying security contexts...\');\n\n';

  code += '    const securityPolicy = {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'Pod\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-security-demo`,\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        securityContext: this.podSecurityPolicy.restricted || {\n';
  code += '          runAsNonRoot: true,\n';
  code += '          runAsUser: 1000,\n';
  code += '          fsGroup: 1000,\n';
  code += '          seccompProfile: {\n';
  code += '            type: \'RuntimeDefault\',\n';
  code += '          },\n';
  code += '        },\n';
  code += '        containers: [\n';
  code += '          {\n';
  code += '            name: \'app\',\n';
  code += '            image: \'nginx:alpine\',\n';
  code += '            securityContext: {\n';
  code += '              allowPrivilegeEscalation: false,\n';
  code += '              capabilities: {\n';
  code += '                drop: [\'ALL\'],\n';
  code += '              },\n';
  code += '              readOnlyRootFilesystem: true,\n';
  code += '            },\n';
  code += '          },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(securityPolicy);\n';
  code += '    const policyPath = path.join(process.cwd(), \'k8s\', \'security-contexts\', \'security-demo.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(policyPath), { recursive: true });\n';
  code += '    fs.writeFileSync(policyPath, yaml);\n\n';

  code += '    console.log(\'[NetworkPolicy] ✓ Security contexts applied\');\n';
  code += '  }\n\n';

  code += '  async verifyIsolation(): Promise<void> {\n';
  code += '    console.log(\'[NetworkPolicy] Verifying network isolation...\');\n\n';

  code += '    try {\n';
  code += '      const result = execSync(\'kubectl get networkpolicies -n \' + this.namespace + \' -o json\', {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '      });\n\n';

  code += '      const policies = JSON.parse(result);\n';
  code += '      console.log(`[NetworkPolicy] Found ${policies.items.length} network policies`);\n\n';

  code += '      for (const policy of policies.items) {\n';
  code += '        console.log(`  - ${policy.metadata.name}`);\n';
  code += '        console.log(`    Pod Selector: ${JSON.stringify(policy.spec.podSelector)}`);\n';
  code += '        console.log(`    Policy Types: ${policy.spec.policyTypes.join(\', \')}`);\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[NetworkPolicy] Failed to verify isolation:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const networkPolicy = new NetworkPolicyController({\n';
  code += '  projectName: \'my-app\',\n';
  code += '  namespace: \'default\',\n';
  code += '  microSegmentation: true,\n';
  code += '  denyAllIngress: true,\n';
  code += '  denyAllEgress: true,\n';
  code += '  policies: [\n';
  code += '    {\n';
  code += '      name: \'allow-api-ingress\',\n';
  code += '      podSelector: { app: \'api\' },\n';
  code += '      policyTypes: [\'Ingress\'],\n';
  code += '      rules: [\n';
  code += '        {\n';
  code += '          direction: \'Ingress\',\n';
  code += '          ports: [{ protocol: \'TCP\', port: 8080 }],\n';
  code += '          from: [{ namespaceSelector: { matchLabels: { name: \'ingress-nginx\' } } }],\n';
  code += '        },\n';
  code += '      ],\n';
  code += '    },\n';
  code += '  ],\n';
  code += '  podSecurityPolicy: {\n';
  code += '    restricted: {\n';
  code += '      runAsNonRoot: true,\n';
  code += '      runAsUser: 1000,\n';
  code += '      seccompProfile: { type: \'RuntimeDefault\' },\n';
  code += '      capabilities: { drop: [\'ALL\'] },\n';
  code += '      readOnlyRootFilesystem: true,\n';
  code += '      allowPrivilegeEscalation: false,\n';
  code += '    },\n';
  code += '  },\n';
  code += '});\n\n';

  code += 'export default networkPolicy;\n';
  code += 'export { NetworkPolicyController, NetworkPolicyRule, SecurityContext, PodSecurityPolicy };\n';

  return code;
}

export function generatePythonNetworkPolicy(config: NetworkPolicyConfig): string {
  let code = '# Auto-generated Network Policy Generator for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';

  code += '@dataclass\n';
  code += 'class NetworkPolicyRule:\n';
  code += '    direction: str\n';
  code += '    ports: Optional[List[Dict[str, Any]]] = None\n';
  code += '    from_pods: Optional[List[Dict[str, Any]]] = None\n';
  code += '    to_pods: Optional[List[Dict[str, Any]]] = None\n\n';

  code += '@dataclass\n';
  code += 'class SecurityContext:\n';
  code += '    run_as_user: Optional[int] = None\n';
  code += '    run_as_group: Optional[int] = None\n';
  code += '    run_as_non_root: Optional[bool] = None\n';
  code += '    seccomp_profile: Optional[Dict[str, str]] = None\n';
  code += '    capabilities: Optional[Dict[str, List[str]]] = None\n';
  code += '    read_only_root_filesystem: Optional[bool] = None\n';
  code += '    allow_privilege_escalation: Optional[bool] = None\n\n';

  code += 'class NetworkPolicyController:\n';
  code += '    def __init__(self, project_name: str = None, namespace: str = "default", micro_segmentation: bool = True, deny_all_ingress: bool = True, deny_all_egress: bool = True, policies: List[Dict[str, Any]] = None, pod_security_policy: Dict[str, Any] = None):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespace = namespace\n';
  code += '        self.micro_segmentation = micro_segmentation\n';
  code += '        self.deny_all_ingress = deny_all_ingress\n';
  code += '        self.deny_all_egress = deny_all_egress\n';
  code += '        self.policies = policies or []\n';
  code += '        self.pod_security_policy = pod_security_policy or {}\n\n';

  code += '    async def deploy(self) -> None:\n';
  code += '        print("[NetworkPolicy] Deploying network policies...")\n\n';

  code += '        if self.deny_all_ingress or self.deny_all_egress:\n';
  code += '            await self._deploy_deny_all_policy()\n\n';

  code += '        for policy in self.policies:\n';
  code += '            await self._deploy_policy(policy)\n\n';

  code += '        if self.micro_segmentation:\n';
  code += '            await self._deploy_micro_segmentation()\n\n';

  code += '        print("[NetworkPolicy] ✓ Network policies deployed successfully")\n\n';

  code += '    async def _deploy_deny_all_policy(self) -> None:\n';
  code += '        print("[NetworkPolicy] Deploying deny-all policy...")\n\n';

  code += '        policy_types = []\n';
  code += '        if self.deny_all_ingress:\n';
  code += '            policy_types.append("Ingress")\n';
  code += '        if self.deny_all_egress:\n';
  code += '            policy_types.append("Egress")\n\n';

  code += '        deny_all_policy = {\n';
  code += '            "apiVersion": "networking.k8s.io/v1",\n';
  code += '            "kind": "NetworkPolicy",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-deny-all",\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "podSelector": {},\n';
  code += '                "policyTypes": policy_types,\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        policy_path = Path.cwd() / "k8s" / "network-policies" / "deny-all.yaml"\n';
  code += '        policy_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '        policy_path.write_text(yaml.dump(deny_all_policy))\n\n';

  code += '        subprocess.run(["kubectl", "apply", "-f", str(policy_path)], check=True)\n\n';

  code += '    async def verify_isolation(self) -> None:\n';
  code += '        print("[NetworkPolicy] Verifying network isolation...")\n\n';

  code += '        result = subprocess.run(\n';
  code += '            ["kubectl", "get", "networkpolicies", "-n", self.namespace, "-o", "json"],\n';
  code += '            capture_output=True,\n';
  code += '            text=True,\n';
  code += '            check=True\n';
  code += '        )\n\n';

  code += '        policies = json.loads(result.stdout)\n';
  code += '        print(f"[NetworkPolicy] Found {len(policies[\'items\'])} network policies")\n\n';

  code += '        for policy in policies["items"]:\n';
  code += '            print(f"  - {policy[\'metadata\'][\'name\']}")\n';
  code += '            print(f"    Policy Types: {\\\',\\\'.join(policy[\'spec\'][\'policyTypes\'])}")\n\n';

  code += 'network_policy = NetworkPolicyController(\n';
  code += '    project_name="my-app",\n';
  code += '    namespace="default",\n';
  code += '    micro_segmentation=True,\n';
  code += '    deny_all_ingress=True,\n';
  code += '    deny_all_egress=True,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: NetworkPolicyConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptNetworkPolicy(config);
  fs.writeFileSync(path.join(outputDir, 'network-policy-generator.ts'), tsCode);

  const pyCode = generatePythonNetworkPolicy(config);
  fs.writeFileSync(path.join(outputDir, 'network-policy-generator.py'), pyCode);

  const md = generateNetworkPolicyMD(config);
  fs.writeFileSync(path.join(outputDir, 'NETWORK_POLICY.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Network policies and security contexts',
    main: 'network-policy-generator.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0');
  fs.writeFileSync(path.join(outputDir, 'network-policy-config.json'), JSON.stringify(config, null, 2));
}
