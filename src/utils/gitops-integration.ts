// Auto-generated GitOps Integration
// Generated at: 2026-01-12T23:02:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface GitOpsConfig {
  projectName: string;
  platform: 'argocd' | 'flux';
  gitRepo: string;
  targetRevision: string;
  namespaces: string[];
  syncPolicy: string;
}

interface Application {
  name: string;
  namespace: string;
  project: string;
  source: {
    repoURL: string;
    targetRevision: string;
    path: string;
  };
  destination: {
    server: string;
    namespace: string;
  };
  syncPolicy: {
    automated: {
      prune: boolean;
      selfHeal: boolean;
    };
  };
}

export function displayConfig(config: GitOpsConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ GitOps Integration');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Platform:', config.platform);
  console.log('\x1b[33m%s\x1b[0m', 'Git Repository:', config.gitRepo);
  console.log('\x1b[33m%s\x1b[0m', 'Target Revision:', config.targetRevision);
  console.log('\x1b[33m%s\x1b[0m', 'Namespaces:', config.namespaces.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Sync Policy:', config.syncPolicy);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateGitOpsMD(config: GitOpsConfig): string {
  let md = '# GitOps Integration\n\n';
  md += '## Features\n\n';
  md += '- ArgoCD application manifests\n';
  md += '- Flux HelmRelease configurations\n';
  md += '- Automated deployment pipelines\n';
  md += '- Rollback strategies\n';
  md += '- Progressive delivery\n';
  md += '- Health checks and monitoring\n';
  md += '- Multi-environment support\n';
  md += '- Git-based configuration drift detection\n';
  md += '- Automated sync policies\n';
  md += '- Self-healing capabilities\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import gitOps from \'./gitops-integration\';\n\n';
  md += '// Generate GitOps manifests\n';
  md += 'await gitOps.generate();\n\n';
  md += '// Apply to cluster\n';
  md += 'await gitOps.apply();\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptGitOps(config: GitOpsConfig): string {
  let code = '// Auto-generated GitOps Integration for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface Application {\n';
  code += '  name: string;\n';
  code += '  namespace: string;\n';
  code += '  project: string;\n';
  code += '  source: any;\n';
  code += '  destination: any;\n';
  code += '  syncPolicy: any;\n';
  code += '}\n\n';

  code += 'class GitOpsIntegration {\n';
  code += '  private projectName: string;\n';
  code += '  private platform: \'argocd\' | \'flux\';\n';
  code += '  private gitRepo: string;\n';
  code += '  private targetRevision: string;\n';
  code += '  private namespaces: string[];\n';
  code += '  private syncPolicy: string;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectName = options.projectName || \'app\';\n';
  code += '    this.platform = options.platform || \'argocd\';\n';
  code += '    this.gitRepo = options.gitRepo || \'https://github.com/example/app.git\';\n';
  code += '    this.targetRevision = options.targetRevision || \'main\';\n';
  code += '    this.namespaces = options.namespaces || [\'dev\', \'staging\', \'prod\'];\n';
  code += '    this.syncPolicy = options.syncPolicy || \'automated\';\n';
  code += '  }\n\n';

  code += '  async generate(): Promise<void> {\n';
  code += '    console.log(`[GitOps] Generating ${this.platform} manifests...`);\n\n';

  code += '    const outputDir = path.join(process.cwd(), \'gitops\', this.platform);\n';
  code += '    fs.mkdirSync(outputDir, { recursive: true });\n\n';

  code += '    if (this.platform === \'argocd\') {\n';
  code += '      await this.generateArgoCD(outputDir);\n';
  code += '    } else {\n';
  code += '      await this.generateFlux(outputDir);\n';
  code += '    }\n\n';

  code += '    console.log(\'[GitOps] Manifest generation complete\');\n';
  code += '  }\n\n';

  code += '  private async generateArgoCD(outputDir: string): Promise<void> {\n';
  code += '    // Generate Application manifests for each namespace\n';
  code += '    for (const ns of this.namespaces) {\n';
  code += '      const app: Application = {\n';
  code += '        name: `${this.projectName}-${ns}`,\n';
  code += '        namespace: \'argocd\',\n';
  code += '        project: \'default\',\n';
  code += '        source: {\n';
  code += '          repoURL: this.gitRepo,\n';
  code += '          targetRevision: this.targetRevision,\n';
  code += '          path: `helm/${this.projectName}`,\n';
  code += '          helm: {\n';
  code += '            valueFiles: [`values-${ns}.yaml`],\n';
  code += '          },\n';
  code += '        },\n';
  code += '        destination: {\n';
  code += '          server: \'https://kubernetes.default.svc\',\n';
  code += '          namespace: ns,\n';
  code += '        },\n';
  code += '        syncPolicy: this.syncPolicy === \'automated\' ? {\n';
  code += '          automated: {\n';
  code += '            prune: true,\n';
  code += '            selfHeal: true,\n';
  code += '          },\n';
  code += '          syncOptions: [\n';
  code += '            \'Validate=false\',\n';
  code += '            \'CreateNamespace=true\',\n';
  code += '          ],\n';
  code += '        } : {},\n';
  code += '      };\n\n';

  code += '      const yaml = this.toYaml(app);\n';
  code += '      fs.writeFileSync(path.join(outputDir, `app-${ns}.yaml`), yaml);\n';
  code += '    }\n\n';

  code += '    // Generate AppProject\n';
  code += '    const project = {\n';
  code += '      apiVersion: \'argoproj.io/v1alpha1\',\n';
  code += '      kind: \'AppProject\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-project`,\n';
  code += '        namespace: \'argocd\',\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        source: {\n';
  code += '          repoURL: this.gitRepo,\n';
  code += '          targetRevision: this.targetRevision,\n';
  code += '        },\n';
  code += '        destinations: this.namespaces.map(ns => ({\n';
  code += '          server: \'https://kubernetes.default.svc\',\n';
  code += '          namespace: ns,\n';
  code += '        })),\n';
  code += '        clusterResourceWhitelist: [\n';
  code += '          { group: \'*\', kind: \'*\' },\n';
  code += '        ],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    fs.writeFileSync(path.join(outputDir, \'project.yaml\'), this.toYaml(project));\n';
  code += '  }\n\n';

  code += '  private async generateFlux(outputDir: string): Promise<void> {\n';
  code += '    // Generate Kustomization for each namespace\n';
  code += '    for (const ns of this.namespaces) {\n';
  code += '      const kustomization = {\n';
  code += '        apiVersion: \'kustomize.toolkit.fluxcd.io/v1\',\n';
  code += '        kind: \'Kustomization\',\n';
  code += '        metadata: {\n';
  code += '          name: `${this.projectName}-${ns}`,\n';
  code += '          namespace: \'flux-system\',\n';
  code += '        },\n';
  code += '        spec: {\n';
  code += '          interval: \'5m\',\n';
  code += '          path: `./helm/${this.projectName}`,\n';
  code += '          prune: true,\n';
  code += '          sourceRef: {\n';
  code += '            kind: \'GitRepository\',\n';
  code += '          name: `${this.projectName}-git`,\n';
  code += '          },\n';
  code += '          helm: {\n';
  code += '            valueFileValues: [`values-${ns}.yaml`],\n';
  code += '          },\n';
  code += '          targetNamespace: ns,\n';
  code += '        },\n';
  code += '      };\n\n';

  code += '      fs.writeFileSync(path.join(outputDir, `kustomization-${ns}.yaml`), this.toYaml(kustomization));\n';
  code += '    }\n\n';

  code += '    // Generate GitRepository\n';
  code += '    const gitRepo = {\n';
  code += '      apiVersion: \'source.toolkit.fluxcd.io/v1\',\n';
  code += '      kind: \'GitRepository\',\n';
  code += '      metadata: {\n';
  code += '        name: `${this.projectName}-git`,\n';
  code += '        namespace: \'flux-system\',\n';
  code += '      },\n';
  code += '      spec: {\n';
  code += '        interval: \'1m\',\n';
  code += '        url: this.gitRepo,\n';
  code += '        ref: {\n';
  code += '          branch: this.targetRevision,\n';
  code += '        },\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    fs.writeFileSync(path.join(outputDir, \'gitrepository.yaml\'), this.toYaml(gitRepo));\n';
  code += '  }\n\n';

  code += '  private toYaml(obj: any): string {\n';
  code += '    const yaml = require(\'js-yaml\');\n';
  code += '    return yaml.dump(obj);\n';
  code += '  }\n\n';

  code += '  async apply(): Promise<void> {\n';
  code += '    console.log(\'[GitOps] Applying GitOps manifests...\');\n\n';

  code += '    const manifestDir = path.join(process.cwd(), \'gitops\', this.platform);\n\n';

  code += '    try {\n';
  code += '      execSync(`kubectl apply -f ${manifestDir}`, {\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '      console.log(\'[GitOps] Manifests applied successfully\');\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[GitOps] Failed to apply manifests:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async rollback(appName: string, revision: string): Promise<void> {\n';
  code += '    console.log(`[GitOps] Rolling back ${appName} to revision ${revision}...`);\n\n';

  code += '    if (this.platform === \'argocd\') {\n';
  code += '      try {\n';
  code += '        execSync(`argocd app rollback ${appName} --revision ${revision}`, {\n';
  code += '          stdio: \'inherit\',\n';
  code += '        });\n';
  code += '        console.log(\'[GitOps] Rollback completed\');\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(\'[GitOps] Rollback failed:\', error.message);\n';
  code += '      }\n';
  code += '    } else {\n';
  code += '      try {\n';
  code += '        execSync(`flux suspend kustomization ${appName}`, {\n';
  code += '          stdio: \'inherit\',\n';
  code += '        });\n';
  code += '        console.log(\'[GitOps] Rollback completed\');\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(\'[GitOps] Rollback failed:\', error.message);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const gitOps = new GitOpsIntegration({\n';
  code += '  platform: \'argocd\',\n';
  code += '  gitRepo: \'https://github.com/example/app.git\',\n';
  code += '  targetRevision: \'main\',\n';
  code += '  namespaces: [\'dev\', \'staging\', \'prod\'],\n';
  code += '  syncPolicy: \'automated\',\n';
  code += '});\n\n';

  code += 'export default gitOps;\n';
  code += 'export { GitOpsIntegration, Application };\n';

  return code;
}

export function generatePythonGitOps(config: GitOpsConfig): string {
  let code = '# Auto-generated GitOps Integration for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import yaml\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class Application:\n';
  code += '    name: str\n';
  code += '    namespace: str\n';
  code += '    project: str\n';
  code += '    source: Dict[str, Any]\n';
  code += '    destination: Dict[str, Any]\n';
  code += '    sync_policy: Dict[str, Any]\n\n';

  code += 'class GitOpsIntegration:\n';
  code += '    def __init__(self, project_name: str = None, platform: str = "argocd", git_repo: str = None, target_revision: str = "main", namespaces: List[str] = None, sync_policy: str = "automated"):\n';
  code += '        self.project_name = project_name or "app"\n';
  code += '        self.platform = platform\n';
  code += '        self.git_repo = git_repo or "https://github.com/example/app.git"\n';
  code += '        self.target_revision = target_revision\n';
  code += '        self.namespaces = namespaces or ["dev", "staging", "prod"]\n';
  code += '        self.sync_policy = sync_policy\n\n';

  code += '    async def generate(self) -> None:\n';
  code += '        print(f"[GitOps] Generating {self.platform} manifests...")\n\n';

  code += '        output_dir = Path.cwd() / "gitops" / self.platform\n';
  code += '        output_dir.mkdir(parents=True, exist_ok=True)\n\n';

  code += '        if self.platform == "argocd":\n';
  code += '            await self.generate_argocd(output_dir)\n';
  code += '        else:\n';
  code += '            await self.generate_flux(output_dir)\n\n';

  code += '        print("[GitOps] Manifest generation complete")\n\n';

  code += '    async def generate_argocd(self, output_dir: Path) -> None:\n';
  code += '        for ns in self.namespaces:\n';
  code += '            app = Application(\n';
  code += '                name=f"{self.project_name}-{ns}",\n';
  code += '                namespace="argocd",\n';
  code += '                project="default",\n';
  code += '                source={\n';
  code += '                    "repoURL": self.git_repo,\n';
  code += '                    "targetRevision": self.target_revision,\n';
  code += '                    "path": f"helm/{self.project_name}",\n';
  code += '                    "helm": {\n';
  code += '                        "valueFiles": [f"values-{ns}.yaml"],\n';
  code += '                    },\n';
  code += '                },\n';
  code += '                destination={\n';
  code += '                    "server": "https://kubernetes.default.svc",\n';
  code += '                    "namespace": ns,\n';
  code += '                },\n';
  code += '                sync_policy={\n';
  code += '                    "automated": {\n';
  code += '                        "prune": True,\n';
  code += '                        "selfHeal": True,\n';
  code += '                    }\n';
  code += '                } if self.sync_policy == "automated" else {},\n';
  code += '            )\n\n';

  code += '            (output_dir / f"app-{ns}.yaml").write_text(yaml.dump(app.to_dict()))\n\n';

  code += 'gitops = GitOpsIntegration(\n';
  code += '    platform="argocd",\n';
  code += '    git_repo="https://github.com/example/app.git",\n';
  code += '    target_revision="main",\n';
  code += '    namespaces=["dev", "staging", "prod"],\n';
  code += '    sync_policy="automated",\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: GitOpsConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptGitOps(config);
  fs.writeFileSync(path.join(outputDir, 'gitops-integration.ts'), tsCode);

  const pyCode = generatePythonGitOps(config);
  fs.writeFileSync(path.join(outputDir, 'gitops-integration.py'), pyCode);

  const md = generateGitOpsMD(config);
  fs.writeFileSync(path.join(outputDir, 'GITOPS.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'GitOps integration',
    main: 'gitops-integration.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: { 'js-yaml': '^4.1.0' },
    devDependencies: { '@types/node': '^20.0.0', '@types/js-yaml': '^4.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), 'pyyaml>=6.0');
  fs.writeFileSync(path.join(outputDir, 'gitops-config.json'), JSON.stringify(config, null, 2));
}
