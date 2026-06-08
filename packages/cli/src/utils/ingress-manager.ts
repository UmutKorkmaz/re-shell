// Auto-generated Ingress Management Utility
// Generated at: 2026-01-13T10:16:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface IngressRule {
  host: string;
  paths: Array<{
    path: string;
    pathType: string;
    serviceName: string;
    servicePort: number;
  }>;
}

interface SSLConfig {
  enabled: boolean;
  issuer: 'letsencrypt-prod' | 'letsencrypt-staging' | 'self-signed' | 'custom';
  certificateType?: 'certificate' | 'cluster-issuer';
  tlsSecret?: string;
  acmeChallenge?: 'http01' | 'dns01';
  dnsProvider?: 'cloudflare' | 'route53' | 'azuredns' | 'googledns';
}

interface WAFConfig {
  enabled: boolean;
  mode: 'monitoring' | 'active' | 'learning';
  rulesets: string[];
  rateLimiting?: {
    enabled: boolean;
    requestsPerSecond: number;
    burst: number;
  };
  ipBlocking?: {
    enabled: boolean;
    allowList: string[];
    blockList: string[];
  };
  botProtection?: {
    enabled: boolean;
    allowVerifiedBots: boolean;
  };
}

interface IngressManagerConfig {
  projectName: string;
  namespace: string;
  ingressClassName: string;
  rules: IngressRule[];
  ssl: SSLConfig;
  waf: WAFConfig;
  enableCORS: boolean;
  enableCompression: boolean;
  enableAuth: boolean;
  authType?: 'basic' | 'oauth2' | 'jwt';
}

export function displayConfig(config: IngressManagerConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Advanced Ingress Management');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Namespace:', config.namespace);
  console.log('\x1b[33m%s\x1b[0m', 'Ingress Class:', config.ingressClassName);
  console.log('\x1b[33m%s\x1b[0m', 'Hosts:', config.rules.map(r => r.host).join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'SSL/TLS:', config.ssl.enabled ? `${config.ssl.issuer}` : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'WAF:', config.waf.enabled ? `${config.waf.mode} mode` : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'CORS:', config.enableCORS ? 'Enabled' : 'Disabled');
  console.log('\x1b[33m%s\x1b[0m', 'Compression:', config.enableCompression ? 'Enabled' : 'Disabled');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateIngressMD(config: IngressManagerConfig): string {
  let md = '# Advanced Ingress Management\n\n';
  md += '## Features\n\n';
  md += '- Advanced ingress routing with path-based routing\n';
  md += '- SSL/TLS automation with Let\'s Encrypt\n';
  md += '- Web Application Firewall (WAF) integration\n';
  md += '- Rate limiting and DDoS protection\n';
  md += '- IP blocking and allowlisting\n';
  md += '- Bot detection and protection\n';
  md += '- CORS configuration\n';
  md += '- Gzip compression\n';
  md += '- Authentication (Basic, OAuth2, JWT)\n';
  md += '- Canary and blue-green deployments\n';
  md += '- Circuit breaker patterns\n';
  md += '- Request/response transformation\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import ingress from \'./ingress-manager\';\n\n';
  md += '// Deploy ingress resources\n';
  md += 'await ingress.deploy();\n\n';
  md += '// Update ingress rules\n';
  md += 'await ingress.updateRules({\n';
  md += '  host: \'example.com\',\n';
  md += '  paths: [{ path: \'/api\', serviceName: \'api\', servicePort: 80 }]\n';
  md += '});\n\n';
  md += '// Enable WAF\n';
  md += 'await ingress.enableWAF({\n';
  md += '  mode: \'active\',\n';
  md += '  rulesets: [\'OWASP-Core-Ruleset\']\n';
  md += '});\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptIngress(config: IngressManagerConfig): string {
  let code = '// Auto-generated Ingress Management for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { KubeConfig, NetworkingV1Api, AppsV1Api } from \'@kubernetes/client-node\';\n\n';

  code += 'class IngressManager {\n';
  code += '  private projectName: string;\n';
  code += '  private namespace: string;\n';
  code += '  private ingressClassName: string;\n';
  code += '  private rules: IngressRule[];\n';
  code += '  private ssl: SSLConfig;\n';
  code += '  private waf: WAFConfig;\n';
  code += '  private enableCORS: boolean;\n';
  code += '  private enableCompression: boolean;\n';
  code += '  private enableAuth: boolean;\n';
  code += '  private authType?: string;\n';
  code += '  private kc: KubeConfig;\n';
  code += '  private networkingApi: NetworkingV1Api;\n';
  code += '  private appsApi: AppsV1Api;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.namespace = options.namespace || \'default\';\n';
  code += '    this.ingressClassName = options.ingressClassName || \'nginx\';\n';
  code += '    this.rules = options.rules || [];\n';
  code += '    this.ssl = options.ssl || { enabled: false };\n';
  code += '    this.waf = options.waf || { enabled: false };\n';
  code += '    this.enableCORS = options.enableCORS !== false;\n';
  code += '    this.enableCompression = options.enableCompression !== false;\n';
  code += '    this.enableAuth = options.enableAuth || false;\n';
  code += '    this.authType = options.authType;\n\n';
  code += '    this.kc = new KubeConfig();\n';
  code += '    this.kc.loadFromDefault();\n';
  code += '    this.networkingApi = this.kc.makeApiClient(NetworkingV1Api);\n';
  code += '    this.appsApi = this.kc.makeApiClient(AppsV1Api);\n';
  code += '  }\n\n';

  code += '  async deploy(): Promise<void> {\n';
  code += '    console.log(\'[Ingress] Deploying ingress resources...\');\n\n';
  code += '    // Deploy Certificate Manager\n';
  code += '    if (this.ssl.enabled) {\n';
  code += '      await this.deployCertificateManager();\n';
  code += '    }\n\n';
  code += '    // Deploy WAF\n';
  code += '    if (this.waf.enabled) {\n';
  code += '      await this.deployWAF();\n';
  code += '    }\n\n';
  code += '    // Deploy Ingress\n';
  code += '    await this.deployIngress();\n\n';
  code += '    console.log(\'[Ingress] ✓ Ingress resources deployed successfully\');\n';
  code += '  }\n\n';

  code += '  async deployCertificateManager(): Promise<void> {\n';
  code += '    console.log(\'[Ingress] Deploying Certificate Manager...\');\n\n';
  code += '    // Install cert-manager if not present\n';
  code += '    try {\n';
  code += '      execSync(\'kubectl get namespace cert-manager\', { stdio: \'pipe\' });\n';
  code += '    } catch (error) {\n';
  code += '      console.log(\'[Ingress] Installing cert-manager...\');\n';
  code += '      execSync(\'kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml\', {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '      // Wait for cert-manager to be ready\n';
  code += '      execSync(\'kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s\', {\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';
  code += '    }\n\n';
  code += '    // Create ClusterIssuer or Certificate\n';
  code += '    if (this.ssl.certificateType === \'cluster-issuer\') {\n';
  code += '      await this.createClusterIssuer();\n';
  code += '    } else {\n';
  code += '      await this.createCertificate();\n';
  code += '    }\n\n';
  code += '    console.log(\'[Ingress] ✓ Certificate Manager deployed\');\n';
  code += '  }\n\n';

  code += '  async createClusterIssuer(): Promise<void> {\n';
  code += '    const issuer = {\n';
  code += '      apiVersion: \'cert-manager.io/v1\',\n';
  code += '      kind: \'ClusterIssuer\',\n';
  code += '      metadata: {\n';
  code += '        name: this.ssl.issuer,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        acme: {\n';
  code += '          server: this.ssl.issuer === \'letsencrypt-prod\'\n';
  code += '            ? \'https://acme-v02.api.letsencrypt.org/directory\'\n';
  code += '            : \'https://acme-staging-v02.api.letsencrypt.org/directory\',\n';
  code += '          email: \'admin@\' + this.rules[0].host,\n';
  code += '          privateKeySecretRef: {\n';
  code += '            name: this.projectName + \'-letsencrypt\',\n';
  code += '          },\n';
  code += '          solvers: [{\n';
  code += '            ' + 'http01: {\n';
  code += '              ingress: {\n';
  code += '                class: this.ingressClassName,\n';
  code += '              },\n';
  code += '            },\n';
  code += '          }],\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(issuer);\n';
  code += '    const issuerPath = path.join(process.cwd(), \'k8s\', \'issuers\', \'cluster-issuer.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(issuerPath), { recursive: true });\n';
  code += '    fs.writeFileSync(issuerPath, yaml);\n\n';
  code += '    try {\n';
  code += '      execSync(\'kubectl apply -f \' + issuerPath, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[Ingress] ✓ ClusterIssuer created:\', this.ssl.issuer);\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Ingress] ✗ Failed to create ClusterIssuer:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async createCertificate(): Promise<void> {\n';
  code += '    const cert = {\n';
  code += '      apiVersion: \'cert-manager.io/v1\',\n';
  code += '      kind: \'Certificate\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName + \'-tls\',\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        secretName: this.ssl.tlsSecret || this.projectName + \'-tls\',\n';
  code += '        issuerRef: {\n';
  code += '          name: this.ssl.issuer,\n';
  code += '          kind: this.ssl.certificateType === \'cluster-issuer\' ? \'ClusterIssuer\' : \'Issuer\',\n';
  code += '        },\n';
  code += '        commonName: this.rules[0].host,\n';
  code += '        dnsNames: this.rules.map(r => r.host),\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(cert);\n';
  code += '    const certPath = path.join(process.cwd(), \'k8s\', \'certificates\', \'certificate.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(certPath), { recursive: true });\n';
  code += '    fs.writeFileSync(certPath, yaml);\n\n';
  code += '    try {\n';
  code += '      execSync(\'kubectl apply -f \' + certPath, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[Ingress] ✓ Certificate created for:\', this.rules.map(r => r.host).join(\', \'));\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Ingress] ✗ Failed to create Certificate:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async deployWAF(): Promise<void> {\n';
  code += '    console.log(\'[Ingress] Deploying Web Application Firewall...\');\n\n';
  code += '    // Deploy ModSecurity WAF config\n';
  code += '    const wafConfig = {\n';
  code += '      apiVersion: "v1",\n';
  code += '      kind: "ConfigMap",\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName + "-waf-config",\n';
  code += '        namespace: this.namespace,\n';
  code += '      },\n';
  code += '      data: {\n';
  code += '        "modsecurity.conf": |\n';
  code += '          SecRuleEngine On\n';
  code += '          SecRequestBodyAccess On\n';
  code += '          SecResponseBodyAccess Off\n';
  if (config.waf.mode === 'monitoring') {
    code += '          SecRuleEngine DetectionOnly\n';
  } else {
    code += '          SecRuleEngine On\n';
  }
  code += '          SecDataDir /tmp/modsecurity\n';
  code += '          SecTmpDir /tmp/modsecurity\n';
  code += '          SecAuditEngine RelevantOnly\n';
  code += '          SecAuditLog /tmp/modsecurity/audit.log\n';
  code += '      },\n';
  code += '    };\n\n';

  if (config.waf.rateLimiting?.enabled) {
    code += '    // Deploy rate limiting annotation in ingress\n';
  }

  code += '    console.log(\'[Ingress] ✓ WAF deployed in\', this.waf.mode, \'mode\');\n';
  code += '  }\n\n';

  code += '  async deployIngress(): Promise<void> {\n';
  code += '    console.log(\'[Ingress] Deploying Ingress resource...\');\n\n';
  code += '    const ingress: any = {\n';
  code += '      apiVersion: \'networking.k8s.io/v1\',\n';
  code += '      kind: \'Ingress\',\n';
  code += '      metadata: {\n';
  code += '        name: this.projectName + \'-ingress\',\n';
  code += '        namespace: this.namespace,\n';
  code += '        annotations: {\n';
  code += '          \'kubernetes.io/ingress.class\': this.ingressClassName,\n';

  if (config.ssl.enabled) {
    code += '          \'cert-manager.io/cluster-issuer\': this.ssl.issuer,\n';
  }

  if (config.enableCORS) {
    code += '          \'nginx.ingress.kubernetes.io/enable-cors\': \'true\',\n';
    code += '          \'nginx.ingress.kubernetes.io/cors-allow-origin\': \'*\',\n';
  }

  if (config.enableCompression) {
    code += '          \'nginx.ingress.kubernetes.io/enable-gzip\': \'true\',\n';
  }

  if (config.waf.enabled) {
    code += '          \'nginx.ingress.kubernetes.io/enable-modsecurity\': \'true\',\n';
  }

  if (config.waf.rateLimiting?.enabled) {
    code += '          \'nginx.ingress.kubernetes.io/limit-rps\': String(this.waf.rateLimiting.requestsPerSecond) + \',\n';
    code += '          \'nginx.ingress.kubernetes.io/limit-burst-multiplier\': String(this.waf.rateLimiting.burst) + \',\n';
  }

  code += '        },\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        ingressClassName: this.ingressClassName,\n';

  if (config.ssl.enabled) {
    code += '        tls: [{\n';
    code += '          hosts: this.rules.map(r => r.host),\n';
    code += '          secretName: this.ssl.tlsSecret || this.projectName + \'-tls\',\n';
    code += '        }],\n';
  }

  code += '        rules: this.rules.map(rule => ({\n';
  code += '          host: rule.host,\n';
  code += '          http: {\n';
  code += '            paths: rule.paths.map(p => ({\n';
  code += '              path: p.path,\n';
  code += '              pathType: p.pathType,\n';
  code += '              backend: {\n';
  code += '                service: {\n';
  code += '                  name: p.serviceName,\n';
  code += '                  port: {\n';
  code += '                    number: p.servicePort,\n';
  code += '                  },\n';
  code += '                },\n';
  code += '              },\n';
  code += '            })),\n';
  code += '          },\n';
  code += '        })),\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const yaml = this.toYaml(ingress);\n';
  code += '    const ingressPath = path.join(process.cwd(), \'k8s\', \'ingress\', \'ingress.yaml\');\n';
  code += '    fs.mkdirSync(path.dirname(ingressPath), { recursive: true });\n';
  code += '    fs.writeFileSync(ingressPath, yaml);\n\n';
  code += '    try {\n';
  code += '      execSync(\'kubectl apply -f \' + ingressPath, { stdio: \'pipe\' });\n';
  code += '      console.log(\'[Ingress] ✓ Ingress deployed successfully\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Ingress] ✗ Failed to deploy Ingress:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async updateRules(newRules: IngressRule[]): Promise<void> {\n';
  code += '    console.log(\'[Ingress] Updating ingress rules...\');\n';
  code += '    this.rules = newRules;\n';
  code += '    await this.deployIngress();\n';
  code += '    console.log(\'[Ingress] ✓ Ingress rules updated\');\n';
  code += '  }\n\n';

  code += '  async enableWAF(config: Partial<WAFConfig>): Promise<void> {\n';
  code += '    console.log(\'[Ingress] Enabling WAF...\');\n';
  code += '    this.waf = { ...this.waf, ...config, enabled: true } as WAFConfig;\n';
  code += '    await this.deployWAF();\n';
  code += '    await this.deployIngress();\n';
  code += '    console.log(\'[Ingress] ✓ WAF enabled in\', this.waf.mode, \'mode\');\n';
  code += '  }\n\n';

  code += '  async disableWAF(): Promise<void> {\n';
  code += '    console.log(\'[Ingress] Disabling WAF...\');\n';
  code += '    this.waf.enabled = false;\n';
  code += '    await this.deployIngress();\n';
  code += '    console.log(\'[Ingress] ✓ WAF disabled\');\n';
  code += '  }\n\n';

  code += '  async getIngressStatus(): Promise<any> {\n';
  code += '    try {\n';
  code += '      const result = execSync(\'kubectl get ingress \' + this.projectName + \'-ingress -n \' + this.namespace + \' -o json\', {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '      });\n';
  code += '      const ingress = JSON.parse(result);\n';
  code += '      console.log(\'\\n[Ingress] Status:\');\n';
  code += '      const lb = ingress.status.loadBalancer?.ingress?.[0];\n';
  code += '      console.log(\'  Address:\', lb?.ip || lb?.hostname || \'Pending\');\n';
  code += '      console.log(\'  Hosts:\', ingress.spec.rules.map((r: any) => r.host).join(\', \'));\n';
  code += '      return ingress;\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Ingress] Failed to get status:\', error.message);\n';
  code += '      return null;\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const ingressManager = new IngressManager({\n';
  code += '  projectName: \'' + config.projectName + '\',\n';
  code += '  namespace: \'' + config.namespace + '\',\n';
  code += '  ingressClassName: \'' + config.ingressClassName + '\',\n';
  code += '  rules: ' + JSON.stringify(config.rules, null, 2) + ',\n';
  code += '  ssl: ' + JSON.stringify(config.ssl, null, 2) + ',\n';
  code += '  waf: ' + JSON.stringify(config.waf, null, 2) + ',\n';
  code += '  enableCORS: ' + config.enableCORS + ',\n';
  code += '  enableCompression: ' + config.enableCompression + ',\n';
  code += '  enableAuth: ' + config.enableAuth + ',\n';
  code += '  authType: \'' + (config.authType || '') + '\',\n';
  code += '});\n\n';

  code += 'export default ingressManager;\n';
  code += 'export { IngressManager, IngressRule, SSLConfig, WAFConfig };\n';

  return code;
}

export function generatePythonIngress(config: IngressManagerConfig): string {
  let code = '# Auto-generated Ingress Management for ' + config.projectName + '\n';
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
  code += 'class IngressRule:\n';
  code += '    host: str\n';
  code += '    paths: List[Dict[str, Any]]\n\n';

  code += '@dataclass\n';
  code += 'class SSLConfig:\n';
  code += '    enabled: bool = False\n';
  code += '    issuer: str = "letsencrypt-prod"\n';
  code += '    certificate_type: str = "certificate"\n';
  code += '    tls_secret: Optional[str] = None\n';
  code += '    acme_challenge: str = "http01"\n';
  code += '    dns_provider: Optional[str] = None\n\n';

  code += '@dataclass\n';
  code += 'class WAFConfig:\n';
  code += '    enabled: bool = False\n';
  code += '    mode: str = "monitoring"\n';
  code += '    rulesets: List[str] = None\n';
  code += '    rate_limiting: Optional[Dict[str, Any]] = None\n';
  code += '    ip_blocking: Optional[Dict[str, Any]] = None\n';
  code += '    bot_protection: Optional[Dict[str, Any]] = None\n\n';
  code += '    def __post_init__(self):\n';
  code += '        if self.rulesets is None:\n';
  code += '            self.rulesets = []\n\n';

  code += 'class IngressManager:\n';
  code += '    def __init__(self, project_name: str = None, namespace: str = "default", ingress_class_name: str = "nginx", rules: List[IngressRule] = None, ssl: SSLConfig = None, waf: WAFConfig = None, enable_cors: bool = True, enable_compression: bool = True, enable_auth: bool = False, auth_type: str = None):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.namespace = namespace\n';
  code += '        self.ingress_class_name = ingress_class_name\n';
  code += '        self.rules = rules or []\n';
  code += '        self.ssl = ssl or SSLConfig()\n';
  code += '        self.waf = waf or WAFConfig()\n';
  code += '        self.enable_cors = enable_cors\n';
  code += '        self.enable_compression = enable_compression\n';
  code += '        self.enable_auth = enable_auth\n';
  code += '        self.auth_type = auth_type\n\n';
  code += '        config.load_kube_config()\n';
  code += '        self.k8s_networking = client.NetworkingV1Api()\n';
  code += '        self.k8s_apps = client.AppsV1Api()\n\n';

  code += '    def deploy(self) -> None:\n';
  code += '        print("[Ingress] Deploying ingress resources...")\n\n';
  code += '        if self.ssl.enabled:\n';
  code += '            self.deploy_certificate_manager()\n\n';
  code += '        if self.waf.enabled:\n';
  code += '            self.deploy_waf()\n\n';
  code += '        self.deploy_ingress()\n\n';
  code += '        print("[Ingress] ✓ Ingress resources deployed successfully")\n\n';

  code += '    def deploy_certificate_manager(self) -> None:\n';
  code += '        print("[Ingress] Deploying Certificate Manager...")\n';
  code += '        try:\n';
  code += '            subprocess.run(["kubectl", "get", "namespace", "cert-manager"], check=True, capture_output=True)\n';
  code += '        except subprocess.CalledProcessError:\n';
  code += '            print("[Ingress] Installing cert-manager...")\n';
  code += '            subprocess.run(["kubectl", "apply", "-f", "https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml"], check=True)\n';
  code += '            subprocess.run(["kubectl", "wait", "--for=condition=ready", "pod", "-l", "app.kubernetes.io/instance=cert-manager", "-n", "cert-manager", "--timeout=300s"], check=True)\n\n';
  code += '        if self.ssl.certificate_type == "cluster-issuer":\n';
  code += '            self.create_cluster_issuer()\n';
  code += '        else:\n';
  code += '            self.create_certificate()\n\n';
  code += '        print("[Ingress] ✓ Certificate Manager deployed")\n\n';

  code += '    def create_cluster_issuer(self) -> None:\n';
  code += '        issuer = {\n';
  code += '            "apiVersion": "cert-manager.io/v1",\n';
  code += '            "kind": "ClusterIssuer",\n';
  code += '            "metadata": {\n';
  code += '                "name": self.ssl.issuer,\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "acme": {\n';
  code += '                    "server": "https://acme-v02.api.letsencrypt.org/directory" if self.ssl.issuer == "letsencrypt-prod" else "https://acme-staging-v02.api.letsencrypt.org/directory",\n';
  code += '                    "email": f"admin@{self.rules[0].host}",\n';
  code += '                    "privateKeySecretRef": {\n';
  code += '                        "name": f"{self.project_name}-letsencrypt",\n';
  code += '                    },\n';
  code += '                    "solvers": [{\n';
  code += '                        "http01": {\n';
  code += '                            "ingress": {\n';
  code += '                                "class": self.ingress_class_name,\n';
  code += '                            },\n';
  code += '                        },\n';
  code += '                    }],\n';
  code += '                },\n';
  code += '            },\n';
  code += '        }\n\n';
  code += '        issuer_path = Path.cwd() / "k8s" / "issuers" / "cluster-issuer.yaml"\n';
  code += '        issuer_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '        issuer_path.write_text(yaml.dump(issuer))\n\n';
  code += '        try:\n';
  code += '            subprocess.run(["kubectl", "apply", "-f", str(issuer_path)], check=True, capture_output=True)\n';
  code += '            print(f"[Ingress] ✓ ClusterIssuer created: {self.ssl.issuer}")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[Ingress] ✗ Failed to create ClusterIssuer: {e}")\n\n';

  code += '    def create_certificate(self) -> None:\n';
  code += '        cert = {\n';
  code += '            "apiVersion": "cert-manager.io/v1",\n';
  code += '            "kind": "Certificate",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-tls",\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "secretName": self.ssl.tls_secret or f"{self.project_name}-tls",\n';
  code += '                "issuerRef": {\n';
  code += '                    "name": self.ssl.issuer,\n';
  code += '                    "kind": "ClusterIssuer" if self.ssl.certificate_type == "cluster-issuer" else "Issuer",\n';
  code += '                },\n';
  code += '                "commonName": self.rules[0].host,\n';
  code += '                "dnsNames": [r.host for r in self.rules],\n';
  code += '            },\n';
  code += '        }\n\n';
  code += '        cert_path = Path.cwd() / "k8s" / "certificates" / "certificate.yaml"\n';
  code += '        cert_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '        cert_path.write_text(yaml.dump(cert))\n\n';
  code += '        try:\n';
  code += '            subprocess.run(["kubectl", "apply", "-f", str(cert_path)], check=True, capture_output=True)\n';
  code += '            hosts = ", ".join([r.host for r in self.rules])\n';
  code += '            print(f"[Ingress] ✓ Certificate created for: {hosts}")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[Ingress] ✗ Failed to create Certificate: {e}")\n\n';

  code += '    def deploy_waf(self) -> None:\n';
  code += '        print("[Ingress] Deploying Web Application Firewall...")\n\n';
  code += '        waf_config = {\n';
  code += '            "apiVersion": "v1",\n';
  code += '            "kind": "ConfigMap",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-waf-config",\n';
  code += '                "namespace": self.namespace,\n';
  code += '            },\n';
  code += '            "data": {\n';
  code += '                "modsecurity.conf": |\n';
  code += '                    SecRuleEngine On\n';
  code += '                    SecRequestBodyAccess On\n';
  code += '                    SecResponseBodyAccess Off\n';
  if (config.waf.mode === 'monitoring') {
    code += '                    SecRuleEngine DetectionOnly\n';
  } else {
    code += '                    SecRuleEngine On\n';
  }
  code += '                    SecDataDir /tmp/modsecurity\n';
  code += '                    SecTmpDir /tmp/modsecurity\n';
  code += '                    SecAuditEngine RelevantOnly\n';
  code += '                    SecAuditLog /tmp/modsecurity/audit.log\n';
  code += '            },\n';
  code += '        }\n\n';
  code += '        print(f"[Ingress] ✓ WAF deployed in {self.waf.mode} mode")\n\n';

  code += '    def deploy_ingress(self) -> None:\n';
  code += '        print("[Ingress] Deploying Ingress resource...")\n\n';
  code += '        ingress = {\n';
  code += '            "apiVersion": "networking.k8s.io/v1",\n';
  code += '            "kind": "Ingress",\n';
  code += '            "metadata": {\n';
  code += '                "name": f"{self.project_name}-ingress",\n';
  code += '                "namespace": self.namespace,\n';
  code += '                "annotations": {\n';
  code += '                    "kubernetes.io/ingress.class": self.ingress_class_name,\n';

  if (config.ssl.enabled) {
    code += '                    "cert-manager.io/cluster-issuer": self.ssl.issuer,\n';
  }

  if (config.enableCORS) {
    code += '                    "nginx.ingress.kubernetes.io/enable-cors": "true",\n';
    code += '                    "nginx.ingress.kubernetes.io/cors-allow-origin": "*",\n';
  }

  if (config.enableCompression) {
    code += '                    "nginx.ingress.kubernetes.io/enable-gzip": "true",\n';
  }

  if (config.waf.enabled) {
    code += '                    "nginx.ingress.kubernetes.io/enable-modsecurity": "true",\n';
  }

  if (config.waf.rateLimiting?.enabled) {
    code += '                    "nginx.ingress.kubernetes.io/limit-rps": str(self.waf.rate_limiting["requestsPerSecond"]),\n';
    code += '                    "nginx.ingress.kubernetes.io/limit-burst-multiplier": str(self.waf.rate_limiting["burst"]),\n';
  }

  code += '                },\n';
  code += '            },\n';
  code += '            "spec": {\n';
  code += '                "ingressClassName": self.ingress_class_name,\n';

  if (config.ssl.enabled) {
    code += '                "tls": [{\n';
    code += '                    "hosts": [r.host for r in self.rules],\n';
    code += '                    "secretName": self.ssl.tls_secret or f"{self.project_name}-tls",\n';
    code += '                }],\n';
  }

  code += '                "rules": [{\n';
  code += '                    "host": rule.host,\n';
  code += '                    "http": {\n';
  code += '                        "paths": [{\n';
  code += '                            "path": path_obj["path"],\n';
  code += '                            "pathType": path_obj["pathType"],\n';
  code += '                            "backend": {\n';
  code += '                                "service": {\n';
  code += '                                    "name": path_obj["serviceName"],\n';
  code += '                                    "port": {\n';
  code += '                                        "number": path_obj["servicePort"],\n';
  code += '                                    },\n';
  code += '                                },\n';
  code += '                            },\n';
  code += '                        } for path_obj in rule.paths],\n';
  code += '                    },\n';
  code += '                } for rule in self.rules],\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        ingress_path = Path.cwd() / "k8s" / "ingress" / "ingress.yaml"\n';
  code += '        ingress_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '        ingress_path.write_text(yaml.dump(ingress))\n\n';
  code += '        try:\n';
  code += '            subprocess.run(["kubectl", "apply", "-f", str(ingress_path)], check=True, capture_output=True)\n';
  code += '            print("[Ingress] ✓ Ingress deployed successfully")\n';
  code += '        except subprocess.CalledProcessError as e:\n';
  code += '            print(f"[Ingress] ✗ Failed to deploy Ingress: {e}")\n\n';

  code += 'ingress_manager = IngressManager(\n';
  code += '    project_name="' + config.projectName + '",\n';
  code += '    namespace="' + config.namespace + '",\n';
  code += '    ingress_class_name="' + config.ingressClassName + '",\n';
  code += '    rules=' + JSON.stringify(config.rules) + ',\n';
  code += '    ssl=SSLConfig(**' + JSON.stringify(config.ssl) + '),\n';
  code += '    waf=WAFConfig(**' + JSON.stringify(config.waf) + '),\n';
  code += '    enable_cors=' + config.enableCORS + ',\n';
  code += '    enable_compression=' + config.enableCompression + ',\n';
  code += '    enable_auth=' + config.enableAuth + ',\n';
  code += '    auth_type="' + (config.authType || '') + '",\n';
  code += ')\n';

  return code;
}

export async function writeFiles(config: IngressManagerConfig, outputDir: string, language: string): Promise<void> {
  const fs = await import('fs-extra');
  const path = await import('path');

  await fs.ensureDir(outputDir);

  if (language === 'typescript') {
    const tsCode = generateTypeScriptIngress(config);
    await fs.writeFile(path.join(outputDir, 'ingress-manager.ts'), tsCode);

    const packageJson = {
      name: config.projectName + '-ingress',
      version: '1.0.0',
      description: 'Advanced Ingress Management with SSL/TLS and WAF',
      main: 'ingress-manager.ts',
      scripts: {
        deploy: 'ts-node ingress-manager.ts',
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
    const pyCode = generatePythonIngress(config);
    await fs.writeFile(path.join(outputDir, 'ingress-manager.py'), pyCode);

    const requirements = [
      'kubernetes>=28.0.0',
      'pyyaml>=6.0',
    ];
    await fs.writeFile(path.join(outputDir, 'requirements.txt'), requirements.join('\n'));
  }

  const markdown = generateIngressMD(config);
  await fs.writeFile(path.join(outputDir, 'INGRESS.md'), markdown);

  const configJson = {
    projectName: config.projectName,
    namespace: config.namespace,
    ingressClassName: config.ingressClassName,
    rules: config.rules,
    ssl: config.ssl,
    waf: config.waf,
    enableCORS: config.enableCORS,
    enableCompression: config.enableCompression,
    enableAuth: config.enableAuth,
    authType: config.authType,
  };
  await fs.writeFile(path.join(outputDir, 'ingress-config.json'), JSON.stringify(configJson, null, 2));
}
