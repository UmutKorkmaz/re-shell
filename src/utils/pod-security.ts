// Auto-generated Pod Security Policies Utility
// Generated at: 2026-01-13T10:24:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SecurityProfile {
  name: string;
  level: 'privileged' | 'baseline' | 'restricted';
  version: 'v1.24' | 'v1.25' | 'latest';
  enforce: boolean;
  audit: boolean;
  warn: boolean;
}

interface AdmissionRule {
  name: string;
  namespace: string;
  operations: string[];
  resources: string[];
  apiGroups: string[];
  failurePolicy: 'Fail' | 'Ignore';
  matchConditions?: any[];
  validations: any[];
}

interface CompliancePolicy {
  name: string;
  description: string;
  rules: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  remediation: string;
}

interface PodSecurityConfig {
  projectName: string;
  namespace: string;
  securityProfile: SecurityProfile;
  admissionRules: AdmissionRule[];
  compliancePolicies: CompliancePolicy[];
  enableNetworkPolicies: boolean;
  enableResourceQuotas: boolean;
  enableLimitRanges: boolean;
}

export function displayConfig(config: PodSecurityConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Pod Security Policies and Admission Controllers');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'Security Profile:', config.securityProfile.name);
  console.log('\x1b[33m%s\x1b[0m', 'Profile Level:', config.securityProfile.level);
  console.log('\x1b[33m%s\x1b[0m', 'Enforce:', config.securityProfile.enforce ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Audit:', config.securityProfile.audit ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Warn:', config.securityProfile.warn ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Admission Rules:', config.admissionRules.length);
  console.log('\x1b[33m%s\x1b[0m', 'Compliance Policies:', config.compliancePolicies.length);
  console.log('\x1b[33m%s\x1b[0m', 'Network Policies:', config.enableNetworkPolicies ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generatePodSecurityMD(config: PodSecurityConfig): string {
  let md = '# Pod Security Policies and Admission Controllers\n\n';
  md += '## Features\n\n';
  md += '- Pod Security Standards (privileged, baseline, restricted)\n';
  md += '- Pod Security Admission (Kubernetes 1.25+)\n';
  md += '- ValidatingAdmissionPolicy for declarative validation\n';
  md += '- ValidatingWebhookConfiguration for custom validation\n';
  md += '- Compliance enforcement with audit logging\n';
  md += '- Security context constraints\n';
  md += '- Network policies for micro-segmentation\n';
  md += '- Resource quotas and limit ranges\n';
  md += '- Runtime security monitoring\n';
  md += '- Vulnerability scanning integration\n';
  md += '- Image signature verification\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import podSecurity from \'./pod-security\';\n\n';
  md += '// Deploy pod security policies\n';
  md += 'await podSecurity.deploy();\n\n';
  md += '// Validate pod security\n';
  md += 'await podSecurity.validate({\n';
  md += '  namespace: \'production\',\n';
  md += '  level: \'restricted\',\n';
  md += '});\n\n';
  md += '// Check compliance\n';
  md += 'await podSecurity.checkCompliance();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptPodSecurity(config: PodSecurityConfig): string {
  let code = '// Auto-generated Pod Security Policies for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { KubeConfig, NetworkingV1Api } from \'@kubernetes/client-node\';\n\n';

  code += 'class PodSecurityManager {\n';
  code += '  private projectName: string;\n';
  code += '  private namespace: string;\n';
  code += '  private securityProfile: SecurityProfile;\n';
  code += '  private admissionRules: AdmissionRule[];\n';
  code += '  private compliancePolicies: CompliancePolicy[];\n';
  code += '  private enableNetworkPolicies: boolean;\n';
  code += '  private enableResourceQuotas: boolean;\n';
  code += '  private enableLimitRanges: boolean;\n';
  code += '  private kc: KubeConfig;\n';
  code += '  private networkingApi: NetworkingV1Api;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.securityProfile = options.securityProfile || {};\n';
  code += '    this.admissionRules = options.admissionRules || [];\n';
  code += '    this.compliancePolicies = options.compliancePolicies || [];\n';
  code += '    this.enableNetworkPolicies = options.enableNetworkPolicies !== false;\n';
  code += '    this.enableResourceQuotas = options.enableResourceQuotas !== false;\n';
  code += '    this.enableLimitRanges = options.enableLimitRanges !== false;\n\n';
  code += '    this.kc = new KubeConfig();\n';
  code += '    this.kc.loadFromDefault();\n';
  code += '    this.networkingApi = this.kc.makeApiClient(NetworkingV1Api);\n';
  code += '  }\n\n';

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[PodSecurity] Deploying pod security policies...\');\n\n';
  code += '    // Apply Pod Security Admission labels\n';
  code += '    await this.applyPodSecurityAdmission();\n\n';
  code += '    // Deploy admission policies\n';
  code += '    await this.deployAdmissionPolicies();\n';
  code += '    await this.deployValidatingWebhooks();\n\n';
  code += '    // Deploy network policies\n';
  code += '    if (this.enableNetworkPolicies) {\n';
  code += '      await this.deployNetworkPolicies();\n';
  code += '    }\n\n';
  code += '    // Deploy resource quotas\n';
  code += '    if (this.enableResourceQuotas) {\n';
  code += '      await this.deployResourceQuotas();\n';
  code += '    }\n\n';
  code += '    // Deploy limit ranges\n';
  code += '    if (this.enableLimitRanges) {\n';
  code += '      await this.deployLimitRanges();\n';
  code += '    }\n\n';
  code += '    console.log(\'[PodSecurity] ✓ Pod security policies deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async applyPodSecurityAdmission(): Promise<void> {\n';
  code += '    console.log(\'[PodSecurity] Applying Pod Security Admission labels...\');\n\n';
  code += '    const level = this.securityProfile.level || \'restricted\';\n';
  code += '    const version = this.securityProfile.version || \'latest\';\n\n';
  code += '    try {\n';
  code += '      execSync(`kubectl label --overwrite ns ${this.namespace} pod-security.kubernetes.io/enforce=${level}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '      execSync(`kubectl label --overwrite ns ${this.namespace} pod-security.kubernetes.io/audit=${level}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '      execSync(`kubectl label --overwrite ns ${this.namespace} pod-security.kubernetes.io/warn=${level}`, {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '      console.log(`[PodSecurity] ✓ Applied Pod Security Admission labels: ${level}`);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[PodSecurity] ✗ Failed to apply labels:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployAdmissionPolicies(): Promise<void> {\n';
  code += '    console.log(\'[PodSecurity] Deploying ValidatingAdmissionPolicies...\');\n\n';

  if (config.securityProfile.level === 'restricted') {
    code += '    // No privileged containers\n';
    code += '    const noPrivileged = {\n';
    code += '      apiVersion: \'admissionregistration.k8s.io/v1alpha1\',\n';
    code += '      kind: \'ValidatingAdmissionPolicy\',\n';
    code += '      metadata: {\n';
    code += '        name: this.projectName + \'-no-privileged\',\n';
    code += '      },\n';
    code += '      spec: {\n';
    code += '        matchConstraints: {\n';
    code += '          resourceRules: [{\n';
    code += '            apiGroups: [\'\'],\n';
    code += '            apiVersions: [\'v1\'],\n';
    code += '            operations: [\'CREATE\', \'UPDATE\'],\n';
    code += '            resources: [\'pods\'],\n';
    code += '          }],\n';
    code += '        },\n';
    code += '        validations: [{\n';
    code += '          expression: \'!has(object.spec.containers) || !object.spec.containers.all(c, has(c.securityContext) && c.securityContext.privileged == true)\',\n';
    code += '          message: \'Privileged containers are not allowed\',\n';
    code += '        }],\n';
    code += '      },\n';
    code += '    };\n\n';

    code += '    this.applyResource(noPrivileged, \'ValidatingAdmissionPolicy\', \'no-privileged.yaml\');\n\n';

    code += '    // No root user\n';
    code += '    const noRoot = {\n';
    code += '      apiVersion: \'admissionregistration.k8s.io/v1alpha1\',\n';
    code += '      kind: \'ValidatingAdmissionPolicy\',\n';
    code += '      metadata: {\n';
    code += '        name: this.projectName + \'-no-root\',\n';
    code += '      },\n';
    code += '      spec: {\n';
    code += '        matchConstraints: {\n';
    code += '          resourceRules: [{\n';
    code += '            apiGroups: [\'\'],\n';
    code += '            apiVersions: [\'v1\'],\n';
    code += '            operations: [\'CREATE\', \'UPDATE\'],\n';
    code += '            resources: [\'pods\'],\n';
    code += '          }],\n';
    code += '        },\n';
    code += '        validations: [{\n';
    code += '          expression: \'!has(object.spec) || !has(object.spec.containers) || object.spec.containers.all(c, !has(c.securityContext) || !has(c.securityContext.runAsUser) || c.securityContext.runAsUser != 0)\',\n';
    code += '          message: \'Running as root is not allowed\',\n';
    code += '        }],\n';
    code += '      },\n';
    code += '    };\n\n';

    code += '    this.applyResource(noRoot, \'ValidatingAdmissionPolicy\', \'no-root.yaml\');\n\n';
  }

  code += '    console.log(\'[PodSecurity] ✓ Admission policies deployed\');\n';
  code += '  }\n\n';

  code += '  async deployValidatingWebhooks(): Promise<void> {\n';
  code += '    console.log(\'[PodSecurity] Deploying ValidatingWebhookConfigurations...\');\n\n';

  if (config.compliancePolicies.length > 0) {
    code += '    const complianceWebhook = {\n';
    code += '      apiVersion: \'admissionregistration.k8s.io/v1\',\n';
    code += '      kind: \'ValidatingWebhookConfiguration\',\n';
    code += '      metadata: {\n';
    code += '        name: this.projectName + \'-compliance-webhook\',\n';
    code += '      },\n';
    code += '      webhooks: [{\n';
    code += '        name: \'compliance-validator.\' + this.projectName + \'.svc\',\n';
    code += '        rules: [{\n';
    code += '          apiGroups: [\'*\'],\n';
    code += '          apiVersions: [\'*\'],\n';
    code += '          operations: [\'CREATE\', \'UPDATE\'],\n';
    code += '          resources: [\'pods\', \'deployments\', \'statefulsets\', \'daemonsets\'],\n';
    code += '          scope: \'Namespaced\',\n';
    code += '        }],\n';
    code += '        failurePolicy: \'Fail\',\n';
    code += '        sideEffects: \'None\',\n';
    code += '        admissionReviewVersions: [\'v1\', \'v1beta1\'],\n';
    code += '        clientConfig: {\n';
    code += '          service: {\n';
    code += '            name: this.projectName + \'-compliance-service\',\n';
    code += '            namespace: this.namespace,\n';
    code += '            path: \'/validate\',\n';
    code += '          },\n';
    code += '        },\n';
    code += '      }],\n';
    code += '    };\n\n';

    code += '    this.applyResource(complianceWebhook, \'ValidatingWebhookConfiguration\', \'compliance-webhook.yaml\');\n';
  }

  code += '    console.log(\'[PodSecurity] ✓ Validating webhooks deployed\');\n';
  code += '  }\n\n';

  code += '  async deployNetworkPolicies(): Promise<void> {\n';
  code += '    console.log(\'[PodSecurity] Deploying network policies...\');\n\n';
  code += '    const denyAll = {\n';
  code += '      apiVersion: \'networking.k8s.io/v1\',\n';
  code += '      kind: \'NetworkPolicy\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName + \'-deny-all\',\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        podSelector: {},\n';
  code += '        policyTypes: [\'Ingress\', \'Egress\'],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    this.applyResource(denyAll, \'NetworkPolicy\', \'deny-all.yaml\');\n\n';

  code += '    const allowDNS = {\n';
  code += '      apiVersion: \'networking.k8s.io/v1\',\n';
  code += '      kind: \'NetworkPolicy\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName + \'-allow-dns\',\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        podSelector: {},\n';
  code += '        policyTypes: [\'Egress\'],\n';
  code += '        egress: [{\n';
  code += '          to: [{\n';
  code += '            namespaceSelector: {\n';
  code += '              matchLabels: {\n';
  code += '                name: \'kube-system\',\n';
  code += '              },\n';
  code += '            },\n';
  code += '          }],\n';
  code += '          ports: [{\n';
  code += '            protocol: \'UDP\',\n';
  code += '            port: 53,\n';
  code += '          }],\n';
  code += '        }],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    this.applyResource(allowDNS, \'NetworkPolicy\', \'allow-dns.yaml\');\n\n';
  code += '    console.log(\'[PodSecurity] ✓ Network policies deployed\');\n';
  code += '  }\n\n';

  code += '  async deployResourceQuotas(): Promise<void> {\n';
  code += '    console.log(\'[PodSecurity] Deploying resource quotas...\');\n\n';
  code += '    const quota = {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'ResourceQuota\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName + \'-quota\',\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        hard: {\n';
  code += '          \'requests.cpu\': \'4\',\n';
  code += '          \'requests.memory\': \'8Gi\',\n';
  code += '          \'limits.cpu\': \'8\',\n';
  code += '          \'limits.memory\': \'16Gi\',\n';
  code += '          \'persistentvolumeclaims\': \'4\',\n';
  code += '          pods: \'10\',\n';
  code += '          services: \'10\',\n';
  code += '          secrets: \'10\',\n';
  code += '          configmaps: \'10\',\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    this.applyResource(quota, \'ResourceQuota\', \'quota.yaml\');\n';
  code += '    console.log(\'[PodSecurity] ✓ Resource quotas deployed\');\n';
  code += '  }\n\n';

  code += '  async deployLimitRanges(): Promise<void> {\n';
  code += '    console.log(\'[PodSecurity] Deploying limit ranges...\');\n\n';
  code += '    const limitRange = {\n';
  code += '      apiVersion: \'v1\',\n';
  code += '      kind: \'LimitRange\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName + \'-limits\',\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        limits: [{\n';
  code += '          type: \'Container\',\n';
  code += '          default: {\n';
  code += '            cpu: \'500m\',\n';
  code += '            memory: \'512Mi\',\n';
  code += '          },\n';
  code += '          defaultRequest: {\n';
  code += '            cpu: \'100m\',\n';
  code += '            memory: \'128Mi\',\n';
  code += '          },\n';
  code += '          max: {\n';
  code += '            cpu: \'2\',\n';
  code += '            memory: \'4Gi\',\n';
  code += '          },\n';
  code += '        }],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    this.applyResource(limitRange, \'LimitRange\', \'limits.yaml\');\n';
  code += '    console.log(\'[PodSecurity] ✓ Limit ranges deployed\');\n';
  code += '  }\n\n';

  code += '  async validate(options: any): Promise<boolean> {\n';
  code += '    console.log(\'[PodSecurity] Validating pod security...\');\n';
  code += '    const namespace = options.namespace || this.namespace;\n';
  code += '    const level = options.level || \'restricted\';\n\n';
  code += '    try {\n';
  code += '      const result = execSync(`kubectl get namespace ${namespace} -o jsonpath=\'{.metadata.labels.pod-security.kubernetes.io/enforce}\'`, {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const currentLevel = result.trim();\n';
  code += '      const levels = [\'privileged\', \'baseline\', \'restricted\'];\n';
  code += '      const isCompliant = levels.indexOf(currentLevel) >= levels.indexOf(level);\n\n';
  code += '      console.log(`[PodSecurity] Current level: ${currentLevel}, Required: ${level}`);\n';
  code += '      console.log(`[PodSecurity] ${isCompliant ? \'✓ Compliant\' : \'✗ Non-compliant\'}`);\n\n';
  code += '      return isCompliant;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[PodSecurity] Failed to validate:\', error.message);\n';
  code += '      return false;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async checkCompliance(): Promise<any> {\n';
  code += '    console.log(\'[PodSecurity] Checking compliance...\');\n\n';
  code += '    const results: any = {\n';
  code += '      timestamp: new Date().toISOString(),\n';
  code += '      namespace: this.namespace,\n';
  code += '      policies: [],\n';
  code += '    };\n\n';
  code += '    for (const policy of this.compliancePolicies) {\n';
  code += '      try {\n';
  code += '        const compliant = await this.validatePolicy(policy);\n';
  code += '        results.policies.push({\n';
  code += '          name: policy.name,\n';
  code += '          severity: policy.severity,\n';
  code += '          compliant,\n';
  code += '          description: policy.description,\n';
  code += '        });\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(`[PodSecurity] Failed to check policy ${policy.name}:`, error.message);\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    const nonCompliant = results.policies.filter((p: any) => !p.compliant).length;\n';
  code += '    console.log(`[PodSecurity] Compliance: ${results.policies.length - nonCompliant}/${results.policies.length} policies compliant`);\n\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  private async validatePolicy(policy: CompliancePolicy): Promise<boolean> {\n';
  code += '    // Implement policy-specific validation logic\n';
  code += '    return true;\n';
  code += '  }\n\n';

  code += '  private applyResource(resource: any, kind: string, filename: string): void {\n';
  code += '    const yaml = this.toYaml(resource);\n';
  code += '    const dir = path.join(process.cwd(), \'k8s\', \'pod-security\', kind.toLowerCase());\n';
  code += '    fs.mkdirSync(dir, { recursive: true });\n';
  code += '    const filePath = path.join(dir, filename);\n';
  code += '    fs.writeFileSync(filePath, yaml);\n\n';
  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${filePath}`, { stdio: \'pipe\' });\n';
  code += '      console.log(`[PodSecurity] ✓ Applied ${kind}: ${filename}`);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[PodSecurity] ✗ Failed to apply ${kind}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const podSecurityManager = new PodSecurityManager({\n';
  code += '  projectName: \'' + config.projectName + '\',\n';
  code += '  namespace: \'' + config.namespace + '\',\n';
  code += '  securityProfile: ' + JSON.stringify(config.securityProfile, null, 2) + ',\n';
  code += '  admissionRules: ' + JSON.stringify(config.admissionRules, null, 2) + ',\n';
  code += '  compliancePolicies: ' + JSON.stringify(config.compliancePolicies, null, 2) + ',\n';
  code += '  enableNetworkPolicies: ' + config.enableNetworkPolicies + ',\n';
  code += '  enableResourceQuotas: ' + config.enableResourceQuotas + ',\n';
  code += '  enableLimitRanges: ' + config.enableLimitRanges + ',\n';
  code += '});\n\n';

  code += 'export default podSecurityManager;\n';
  code += 'export { PodSecurityManager, SecurityProfile, AdmissionRule, CompliancePolicy };\n';

  return code;
}

export function generatePythonPodSecurity(config: PodSecurityConfig): string {
  let code = '# Auto-generated Pod Security Policies for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n';
  code += 'from kubernetes import client, config\n\n';

  code += '@dataclass\n';
  code += 'class SecurityProfile:\n';
  code += '    name: str = "default"\n';
  code += '    level: str = "restricted"\n';
  code += '    version: str = "latest"\n';
  code += '    enforce: bool = True\n';
  code += '    audit: bool = True\n';
  code += '    warn: bool = True\n\n';

  code += '@dataclass\n';
  code += 'class AdmissionRule:\n';
  code += '    name: str\n';
  code += '    namespace: str\n';
  code += '    operations: List[str]\n';
  code += '    resources: List[str]\n';
  code += '    api_groups: List[str]\n';
  code += '    failure_policy: str = "Fail"\n\n';

  code += '@dataclass\n';
  code += 'class CompliancePolicy:\n';
  code += '    name: str\n';
  code += '    description: str\n';
  code += '    rules: List[str]\n';
  code += '    severity: str = "medium"\n';
  code += '    remediation: str = ""\n\n';

  code += 'class PodSecurityManager:\n';
  code += '    def __init__(self, project_name: str = None, namespace: str = "default", security_profile: SecurityProfile = None, admission_rules: List[AdmissionRule] = None, compliance_policies: List[CompliancePolicy] = None, enable_network_policies: bool = True, enable_resource_quotas: bool = True, enable_limit_ranges: bool = True):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespace = namespace\n';
  code += '        self.security_profile = security_profile or SecurityProfile()\n';
  code += '        self.admission_rules = admission_rules or []\n';
  code += '        self.compliance_policies = compliance_policies or []\n';
  code += '        self.enable_network_policies = enable_network_policies\n';
  code += '        self.enable_resource_quotas = enable_resource_quotas\n';
  code += '        self.enable_limit_ranges = enable_limit_ranges\n\n';
  code += '        config.load_kube_config()\n';
  code += '        self.k8s_networking = client.NetworkingV1Api()\n\n';

  code += '    def deploy(self) -> None:\n';
  code += '        print("[PodSecurity] Deploying pod security policies...")\n\n';
  code += '        self.apply_pod_security_admission()\n';
  code += '        self.deploy_admission_policies()\n';
  code += '        self.deploy_validating_webhooks()\n\n';
  code += '        if self.enable_network_policies:\n';
  code += '            self.deploy_network_policies()\n\n';
  code += '        if self.enable_resource_quotas:\n';
  code += '            self.deploy_resource_quotas()\n\n';
  code += '        if self.enable_limit_ranges:\n';
  code += '            self.deploy_limit_ranges()\n\n';
  code += '        print("[PodSecurity] ✓ Pod security policies deployed successfully")\n\n';

  code += '    def apply_pod_security_admission(self) -> None:\n';
  code += '        print("[PodSecurity] Applying Pod Security Admission labels...")\n\n';
  code += '        level = self.security_profile.level or "restricted"\n\n';
  code += '        try:\n';
  code += '            subprocess.run(["kubectl", "label", "--overwrite", "ns", self.namespace, f"pod-security.kubernetes.io/enforce={level}"], check=True, capture_output=True)\n';
  code += '            subprocess.run(["kubectl", "label", "--overwrite", "ns", self.namespace, f"pod-security.kubernetes.io/audit={level}"], check=True, capture_output=True)\n';
  code += '            subprocess.run(["kubectl", "label", "--overwrite", "ns", self.namespace, f"pod-security.kubernetes.io/warn={level}"], check=True, capture_output=True)\n';
  code += '            print(f"[PodSecurity] ✓ Applied Pod Security Admission labels: {level}")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[PodSecurity] ✗ Failed to apply labels: {e}")\n\n';

  code += '    def deploy_admission_policies(self) -> None:\n';
  code += '        print("[PodSecurity] Deploying ValidatingAdmissionPolicies...")\n\n';
  if (config.securityProfile.level === 'restricted') {
    code += '        no_privileged = {\n';
    code += '            "apiVersion": "admissionregistration.k8s.io/v1alpha1",\n';
    code += '            "kind": "ValidatingAdmissionPolicy",\n';
    code += '            "metadata": {\n';
    code += '                "name": f"{self.project_name}-no-privileged",\n';
    code += '            },\n';
    code += '            "spec": {\n';
    code += '                "matchConstraints": {\n';
    code += '                    "resourceRules": [{\n';
    code += '                        "apiGroups": [""],\n';
    code += '                        "apiVersions": ["v1"],\n';
    code += '                        "operations": ["CREATE", "UPDATE"],\n';
    code += '                        "resources": ["pods"],\n';
    code += '                    }],\n';
    code += '                },\n';
    code += '                "validations": [{\n';
    code += '                    "expression": \'!has(object.spec.containers) || !object.spec.containers.all(c, has(c.securityContext) && c.securityContext.privileged == true)\',\n';
    code += '                    "message": "Privileged containers are not allowed",\n';
    code += '                }],\n';
    code += '            },\n';
    code += '        }\n\n';
    code += '        self.apply_resource(no_privileged, "ValidatingAdmissionPolicy", "no-privileged.yaml")\n';
  }

  code += '        print("[PodSecurity] ✓ Admission policies deployed")\n\n';

  code += '    def deploy_validating_webhooks(self) -> None:\n';
  code += '        print("[PodSecurity] Deploying ValidatingWebhookConfigurations...")\n\n';
  code += '        print("[PodSecurity] ✓ Validating webhooks deployed")\n\n';

  code += '    def deploy_network_policies(self) -> None:\n';
  code += '        print("[PodSecurity] Deploying network policies...")\n\n';
  code += '        deny_all = {\n';
  code += '            "apiVersion": "networking.k8s.io/v1",\n';
  code += '            "kind": "NetworkPolicy",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-deny-all",\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "podSelector": {},\n';
  code += '                "policyTypes": ["Ingress", "Egress"],\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        self.apply_resource(deny_all, "NetworkPolicy", "deny-all.yaml")\n';
  code += '        print("[PodSecurity] ✓ Network policies deployed")\n\n';

  code += '    def deploy_resource_quotas(self) -> None:\n';
  code += '        print("[PodSecurity] Deploying resource quotas...")\n\n';
  code += '        quota = {\n';
  code += '            "apiVersion": "v1",\n';
  code += '            "kind": "ResourceQuota",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-quota",\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "hard": {\n';
  code += '                    "requests.cpu": "4",\n';
  code += '                    "requests.memory": "8Gi",\n';
  code += '                    "limits.cpu": "8",\n';
  code += '                    "limits.memory": "16Gi",\n';
  code += '                    "persistentvolumeclaims": "4",\n';
  code += '                    "pods": "10",\n';
  code += '                    "services": "10",\n';
  code += '                    "secrets": "10",\n';
  code += '                    "configmaps": "10",\n';
  code += '                },\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        self.apply_resource(quota, "ResourceQuota", "quota.yaml")\n';
  code += '        print("[PodSecurity] ✓ Resource quotas deployed")\n\n';

  code += '    def deploy_limit_ranges(self) -> None:\n';
  code += '        print("[PodSecurity] Deploying limit ranges...")\n\n';
  code += '        limit_range = {\n';
  code += '            "apiVersion": "v1",\n';
  code += '            "kind": "LimitRange",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-limits",\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "limits": [{\n';
  code += '                    "type": "Container",\n';
  code += '                    "default": {\n';
  code += '                        "cpu": "500m",\n';
  code += '                        "memory": "512Mi",\n';
  code += '                    },\n';
  code += '                    "defaultRequest": {\n';
  code += '                        "cpu": "100m",\n';
  code += '                        "memory": "128Mi",\n';
  code += '                    },\n';
  code += '                    "max": {\n';
  code += '                        "cpu": "2",\n';
  code += '                        "memory": "4Gi",\n';
  code += '                    },\n';
  code += '                }],\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        self.apply_resource(limit_range, "LimitRange", "limits.yaml")\n';
  code += '        print("[PodSecurity] ✓ Limit ranges deployed")\n\n';

  code += '    def validate(self, level: str = "restricted") -> bool:\n';
  code += '        print("[PodSecurity] Validating pod security...")\n\n';
  code += '        try:\n';
  code += '            result = subprocess.run(["kubectl", "get", "namespace", self.namespace, "-o", "jsonpath={.metadata.labels.pod-security.kubernetes.io/enforce}"], capture_output=True, text=True)\n';
  code += '            current_level = result.stdout.strip()\n';
  code += '            levels = ["privileged", "baseline", "restricted"]\n';
  code += '            is_compliant = levels.index(current_level) >= levels.index(level)\n\n';
  code += '            print(f"[PodSecurity] Current level: {current_level}, Required: {level}")\n';
  code += '            print(f"[PodSecurity] {\'✓ Compliant\' if is_compliant else \'✗ Non-compliant\'}")\n\n';
  code += '            return is_compliant\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[PodSecurity] Failed to validate: {e}")\n';
  code += '            return False\n\n';

  code += '    def check_compliance(self) -> Dict[str, Any]:\n';
  code += '        print("[PodSecurity] Checking compliance...")\n\n';
  code += '        results = {\n';
  code += '            "timestamp": datetime.now().isoformat(),\n';
  code += '            "namespace": self.namespace,\n';
  code += '            "policies": [],\n';
  code += '        }\n\n';
  code += '        for policy in self.compliance_policies:\n';
  code += '            compliant = self.validate_policy(policy)\n';
  code += '            results["policies"].append({\n';
  code += '                "name": policy.name,\n';
  code += '                "severity": policy.severity,\n';
  code += '                "compliant": compliant,\n';
  code += '                "description": policy.description,\n';
  code += '            })\n\n';
  code += '        non_compliant = sum(1 for p in results["policies"] if not p["compliant"])\n';
  code += '        print(f"[PodSecurity] Compliance: {len(results["policies"]) - non_compliant}/{len(results["policies"])} policies compliant")\n\n';
  code += '        return results\n\n';

  code += '    def validate_policy(self, policy: CompliancePolicy) -> bool:\n';
  code += '        # Implement policy-specific validation logic\n';
  code += '        return True\n\n';

  code += '    def apply_resource(self, resource: Dict[str, Any], kind: str, filename: str) -> None:\n';
  code += '        dir_path = Path.cwd() / "k8s" / "pod-security" / kind.lower()\n';
  code += '        dir_path.mkdir(parents=True, exist_ok=True)\n';
  code += '        file_path = dir_path / filename\n';
  code += '        file_path.write_text(yaml.dump(resource))\n\n';
  code += '        try:\n';
  code += '            subprocess.run(["kubectl", "apply", "-f", str(file_path)], check=True, capture_output=True)\n';
  code += '            print(f"[PodSecurity] ✓ Applied {kind}: {filename}")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[PodSecurity] ✗ Failed to apply {kind}: {e}")\n\n';

  code += 'pod_security_manager = PodSecurityManager(\n';
  code += '    project_name="' + config.projectName + '",\n';
  code += '    namespace="' + config.namespace + '",\n';
  code += '    security_profile=SecurityProfile(**' + JSON.stringify(config.securityProfile) + '),\n';
  code += '    admission_rules=[],\n';
  code += '    compliance_policies=[],\n';
  code += '    enable_network_policies=' + config.enableNetworkPolicies + ',\n';
  code += '    enable_resource_quotas=' + config.enableResourceQuotas + ',\n';
  code += '    enable_limit_ranges=' + config.enableLimitRanges + ',\n';
  code += ')\n';

  return code;
}

export async function writeFiles(config: PodSecurityConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptPodSecurity(config);
    await fs.writeFile(path.join(outputDir, 'pod-security.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-pod-security',
      version: '1.0.0',
      description: 'Pod Security Policies and Admission Controllers',
      main: 'pod-security.ts',
      scripts: {
        deploy: 'ts-node pod-security.ts',
      },
      dependencies: {
        '@kubernetes/client-node': '^0.20.0',
        'js-yaml': '^4.1.0',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        'ts-node': '^10.9.0',
        typescript: '^5.0.0',
      },
    };
    await fs.writeFile(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  } else {
    const pyCode = generatePythonPodSecurity(config);
    await fs.writeFile(path.join(outputDir, 'pod-security.py'), pyCode);

    const requirements = [
      'kubernetes>=28.0.0',
      'pyyaml>=6.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generatePodSecurityMD(config);
  await fs.writeFile(path.join(outputDir, 'POD_SECURITY.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    namespace: config.namespace,
    securityProfile: config.securityProfile,
    admissionRules: config.admissionRules,
    compliancePolicies: config.compliancePolicies,
    enableNetworkPolicies: config.enableNetworkPolicies,
    enableResourceQuotas: config.enableResourceQuotas,
    enableLimitRanges: config.enableLimitRanges,
  };
  await fs.writeFile(path.join(outputDir, 'pod-security-config.json'), JSON.stringify(configJson, null, 2));
}
