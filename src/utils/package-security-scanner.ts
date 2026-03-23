// Auto-generated Package Security Scanner
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SecurityVulnerability {
  packageName: string;
  ecosystem: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cveId: string;
  title: string;
  description: string;
  affectedVersions: string[];
  patchedVersions: string[];
  recommendation: string;
  references: string[];
}

interface RemediationAction {
  type: 'upgrade' | 'replace' | 'remove' | 'ignore';
  packageName: string;
  currentVersion: string;
  targetVersion: string;
  reason: string;
  priority: number;
}

interface SecurityReport {
  scanTime: string;
  totalVulnerabilities: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  vulnerabilities: SecurityVulnerability[];
  remediations: RemediationAction[];
}

interface SecurityConfig {
  projectName: string;
  severities: string[];
  autoFix: boolean;
}

export function displayConfig(config: SecurityConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Package Security Scanner');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Severities:', config.severities.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Auto Fix:', config.autoFix ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateSecurityScannerMD(config: SecurityConfig): string {
  let md = '# Package Security Scanner\n\n';
  md += '## Features\n\n';
  md += '- Cross-language vulnerability scanning\n';
  md += '- Unified vulnerability reporting\n';
  md += '- CVE tracking and assessment\n';
  md += '- Automated remediation suggestions\n';
  md += '- Severity-based prioritization\n';
  md += '- Patch version recommendations\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import securityScanner from \'./package-security-scanner\';\n\n';
  md += '// Scan for vulnerabilities\n';
  md += 'const report = await securityScanner.scan();\n\n';
  md += '// Generate remediation plan\n';
  md += 'const remediations = await securityScanner.generateRemediations(report);\n\n';
  md += '// Apply fixes\n';
  md += 'await securityScanner.applyRemediations(remediations);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptSecurityScanner(config: SecurityConfig): string {
  let code = '// Auto-generated Security Scanner for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface SecurityVulnerability {\n';
  code += '  packageName: string;\n';
  code += '  ecosystem: string;\n';
  code += '  severity: \'critical\' | \'high\' | \'medium\' | \'low\';\n';
  code += '  cveId: string;\n';
  code += '  title: string;\n';
  code += '  description: string;\n';
  code += '  affectedVersions: string[];\n';
  code += '  patchedVersions: string[];\n';
  code += '  recommendation: string;\n';
  code += '  references: string[];\n';
  code += '}\n\n';

  code += 'interface RemediationAction {\n';
  code += '  type: \'upgrade\' | \'replace\' | \'remove\' | \'ignore\';\n';
  code += '  packageName: string;\n';
  code += '  currentVersion: string;\n';
  code += '  targetVersion: string;\n';
  code += '  reason: string;\n';
  code += '  priority: number;\n';
  code += '}\n\n';

  code += 'interface SecurityReport {\n';
  code += '  scanTime: string;\n';
  code += '  totalVulnerabilities: number;\n';
  code += '  criticalCount: number;\n';
  code += '  highCount: number;\n';
  code += '  mediumCount: number;\n';
  code += '  lowCount: number;\n';
  code += '  vulnerabilities: SecurityVulnerability[];\n';
  code += '  remediations: RemediationAction[];\n';
  code += '}\n\n';

  code += 'class PackageSecurityScanner {\n';
  code += '  private projectRoot: string;\n';
  code += '  private severities: string[];\n';
  code += '  private autoFix: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.severities = options.severities || [\'critical\', \'high\', \'medium\', \'low\'];\n';
  code += '    this.autoFix = options.autoFix || false;\n';
  code += '  }\n\n';

  code += '  async scan(): Promise<SecurityReport> {\n';
  code += '    console.log(\'[Security Scanner] Scanning for vulnerabilities...\');\n\n';

  code += '    const report: SecurityReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      totalVulnerabilities: 0,\n';
  code += '      criticalCount: 0,\n';
  code += '      highCount: 0,\n';
  code += '      mediumCount: 0,\n';
  code += '      lowCount: 0,\n';
  code += '      vulnerabilities: [],\n';
  code += '      remediations: [],\n';
  code += '    };\n\n';

  code += '    // Scan npm packages\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'package.json\'))) {\n';
  code += '      const npmVulns = await this.scanNpm();\n';
  code += '      report.vulnerabilities.push(...npmVulns);\n';
  code += '    }\n\n';

  code += '    // Scan pip packages\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'requirements.txt\'))) {\n';
  code += '      const pipVulns = await this.scanPip();\n';
  code += '      report.vulnerabilities.push(...pipVulns);\n';
  code += '    }\n\n';

  code += '    // Scan cargo packages\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'Cargo.toml\'))) {\n';
  code += '      const cargoVulns = await this.scanCargo();\n';
  code += '      report.vulnerabilities.push(...cargoVulns);\n';
  code += '    }\n\n';

  code += '    // Filter by severity\n';
  code += '    report.vulnerabilities = report.vulnerabilities.filter(v => this.severities.includes(v.severity));\n\n';

  code += '    // Count by severity\n';
  code += '    for (const vuln of report.vulnerabilities) {\n';
  code += '      report.totalVulnerabilities++;\n';
  code += '      if (vuln.severity === \'critical\') report.criticalCount++;\n';
  code += '      else if (vuln.severity === \'high\') report.highCount++;\n';
  code += '      else if (vuln.severity === \'medium\') report.mediumCount++;\n';
  code += '      else if (vuln.severity === \'low\') report.lowCount++;\n';
  code += '    }\n\n';

  code += '    console.log(`[Security Scanner] Found ${report.totalVulnerabilities} vulnerabilities`);\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  async generateRemediations(report: SecurityReport): Promise<RemediationAction[]> {\n';
  code += '    console.log(\'[Security Scanner] Generating remediation plan...\');\n\n';

  code += '    const remediations: RemediationAction[] = [];\n';

  code += '    for (const vuln of report.vulnerabilities) {\n';
  code += '      if (vuln.patchedVersions.length > 0) {\n';
  code += '        remediations.push({\n';
  code += '          type: \'upgrade\',\n';
  code += '          packageName: vuln.packageName,\n';
  code += '          currentVersion: vuln.affectedVersions[0],\n';
  code += '          targetVersion: vuln.patchedVersions[0],\n';
  code += '          reason: vuln.description,\n';
  code += '          priority: this.calculatePriority(vuln.severity),\n';
  code += '        });\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    // Sort by priority\n';
  code += '    remediations.sort((a, b) => b.priority - a.priority);\n\n';

  code += '    return remediations;\n';
  code += '  }\n\n';

  code += '  async applyRemediations(remediations: RemediationAction[]): Promise<void> {\n';
  code += '    console.log(\'[Security Scanner] Applying remediations...\');\n\n';

  code += '    for (const action of remediations) {\n';
  code += '      if (action.type === \'upgrade\') {\n';
  code += '        await this.upgradePackage(action);\n';
  code += '      } else if (action.type === \'remove\') {\n';
  code += '        await this.removePackage(action);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async scanNpm(): Promise<SecurityVulnerability[]> {\n';
  code += '    const vulnerabilities: SecurityVulnerability[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'npm audit --json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const audit = JSON.parse(output);\n';
  code += '      const vulnData = audit.vulnerabilities || {};\n\n';

  code += '      for (const [packageName, data] of Object.entries(vulnData)) {\n';
  code += '        const vuln = data as any;\n';
  code += '        vulnerabilities.push({\n';
  code += '          packageName,\n';
  code += '          ecosystem: \'npm\',\n';
  code += '          severity: vuln.severity,\n';
  code += '          cveId: vuln.cve || [],\n';
  code += '          title: vuln.title || \'Vulnerability\',\n';
  code += '          description: vuln.overview || \'\',\n';
  code += '          affectedVersions: vuln.findings.map((f: any) => f.version),\n';
  code += '          patchedVersions: vuln.patchedVersions || [],\n';
  code += '          recommendation: vuln.recommendation || \'Update to patched version\',\n';
  code += '          references: vuln.references || [],\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // npm audit returns non-zero exit code if vulnerabilities found\n';
  code += '      if (error.stdout) {\n';
  code += '        try {\n';
  code += '          const audit = JSON.parse(error.stdout);\n';
  code += '          const vulnData = audit.vulnerabilities || {};\n\n';

  code += '          for (const [packageName, data] of Object.entries(vulnData)) {\n';
  code += '            const vuln = data as any;\n';
  code += '            vulnerabilities.push({\n';
  code += '              packageName,\n';
  code += '              ecosystem: \'npm\',\n';
  code += '              severity: vuln.severity,\n';
  code += '              cveId: vuln.cve || [],\n';
  code += '              title: vuln.title || \'Vulnerability\',\n';
  code += '              description: vuln.overview || \'\',\n';
  code += '              affectedVersions: vuln.findings.map((f: any) => f.version),\n';
  code += '              patchedVersions: vuln.patchedVersions || [],\n';
  code += '              recommendation: vuln.recommendation || \'Update to patched version\',\n';
  code += '              references: vuln.references || [],\n';
  code += '            });\n';
  code += '          }\n';
  code += '        } catch (parseError) {\n';
  code += '          console.error(\'[Security Scanner] Failed to parse npm audit output:\', error.message);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return vulnerabilities;\n';
  code += '  }\n\n';

  code += '  private async scanPip(): Promise<SecurityVulnerability[]> {\n';
  code += '    const vulnerabilities: SecurityVulnerability[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'pip-audit --format json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const audit = JSON.parse(output);\n';

  code += '      for (const vuln of audit) {\n';
  code += '        vulnerabilities.push({\n';
  code += '          packageName: vuln.name,\n';
  code += '          ecosystem: \'pip\',\n';
  code += '          severity: this.mapPipSeverity(vuln.severity),\n';
  code += '          cveId: vuln.cve || \'\',\n';
  code += '          title: vuln.vulnerability_id || \'Vulnerability\',\n';
  code += '          description: vuln.description || \'\',\n';
  code += '          affectedVersions: vuln.affected_versions || [],\n';
  code += '          patchedVersions: vuln.fixed_versions || [],\n';
  code += '          recommendation: \'Update to fixed version\',\n';
  code += '          references: vuln.links || [],\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Security Scanner] pip-audit failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return vulnerabilities;\n';
  code += '  }\n\n';

  code += '  private async scanCargo(): Promise<SecurityVulnerability[]> {\n';
  code += '    const vulnerabilities: SecurityVulnerability[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'cargo audit --json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const audit = JSON.parse(output);\n';

  code += '      for (const vuln of audit.vulnerabilities || []) {\n';
  code += '        vulnerabilities.push({\n';
  code += '          packageName: vuln.package.name || \'unknown\',\n';
  code += '          ecosystem: \'cargo\',\n';
  code += '          severity: this.mapCargoSeverity(vuln.severity),\n';
  code += '          cveId: vuln.advisory.id || \'\',\n';
  code += '          title: vuln.advisory.title || \'Vulnerability\',\n';
  code += '          description: vuln.advisory.description || \'\',\n';
  code += '          affectedVersions: [vuln.package.affected_version || \'\'],\n';
  code += '          patchedVersions: [vuln.package.patched_versions || []].flat(),\n';
  code += '          recommendation: vuln.advisory.patch || \'Update to patched version\',\n';
  code += '          references: vuln.advisory.urls || [],\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Security Scanner] cargo audit failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return vulnerabilities;\n';
  code += '  }\n\n';

  code += '  private calculatePriority(severity: string): number {\n';
  code += '    const priorities: { [key: string]: number } = {\n';
  code += '      critical: 100,\n';
  code += '      high: 75,\n';
  code += '      medium: 50,\n';
  code += '      low: 25,\n';
  code += '    };\n';
  code += '    return priorities[severity] || 0;\n';
  code += '  }\n\n';

  code += '  private mapPipSeverity(severity: string): \'critical\' | \'high\' | \'medium\' | \'low\' {\n';
  code += '    if (severity === \'critical\') return \'critical\';\n';
  code += '    if (severity === \'high\') return \'high\';\n';
  code += '    if (severity === \'medium\') return \'medium\';\n';
  code += '    return \'low\';\n';
  code += '  }\n\n';

  code += '  private mapCargoSeverity(severity: string): \'critical\' | \'high\' | \'medium\' | \'low\' {\n';
  code += '    if (severity === \'critical\') return \'critical\';\n';
  code += '    if (severity === \'high\') return \'high\';\n';
  code += '    if (severity === \'medium\') return \'medium\';\n';
  code += '    return \'low\';\n';
  code += '  }\n\n';

  code += '  private async upgradePackage(action: RemediationAction): Promise<void> {\n';
  code += '    console.log(`[Security Scanner] Upgrading ${action.packageName} to ${action.targetVersion}`);\n\n';

  code += '    try {\n';
  code += '      execSync(`npm install ${action.packageName}@${action.targetVersion}`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Security Scanner] Failed to upgrade ${action.packageName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async removePackage(action: RemediationAction): Promise<void> {\n';
  code += '    console.log(`[Security Scanner] Removing ${action.packageName}`);\n\n';

  code += '    try {\n';
  code += '      execSync(`npm uninstall ${action.packageName}`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Security Scanner] Failed to remove ${action.packageName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const securityScanner = new PackageSecurityScanner({\n';
  code += '  severities: [\'critical\', \'high\', \'medium\', \'low\'],\n';
  code += '  autoFix: false,\n';
  code += '});\n\n';

  code += 'export default securityScanner;\n';
  code += 'export { PackageSecurityScanner, SecurityReport, SecurityVulnerability, RemediationAction };\n';

  return code;
}

export function generatePythonSecurityScanner(config: SecurityConfig): string {
  let code = '# Auto-generated Security Scanner for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class SecurityVulnerability:\n';
  code += '    package_name: str\n';
  code += '    ecosystem: str\n';
  code += '    severity: str\n';
  code += '    cve_id: str\n';
  code += '    title: str\n';
  code += '    description: str\n';
  code += '    affected_versions: List[str]\n';
  code += '    patched_versions: List[str]\n';
  code += '    recommendation: str\n';
  code += '    references: List[str]\n\n';

  code += '@dataclass\n';
  code += 'class RemediationAction:\n';
  code += '    type: str\n';
  code += '    package_name: str\n';
  code += '    current_version: str\n';
  code += '    target_version: str\n';
  code += '    reason: str\n';
  code += '    priority: int\n\n';

  code += '@dataclass\n';
  code += 'class SecurityReport:\n';
  code += '    scan_time: str\n';
  code += '    total_vulnerabilities: int\n';
  code += '    critical_count: int\n';
  code += '    high_count: int\n';
  code += '    medium_count: int\n';
  code += '    low_count: int\n';
  code += '    vulnerabilities: List[SecurityVulnerability]\n';
  code += '    remediations: List[RemediationAction]\n\n';

  code += 'class PackageSecurityScanner:\n';
  code += '    def __init__(self, project_root: str = None, severities: List[str] = None, auto_fix: bool = False):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.severities = severities or ["critical", "high", "medium", "low"]\n';
  code += '        self.auto_fix = auto_fix\n\n';

  code += '    async def scan(self) -> SecurityReport:\n';
  code += '        print("[Security Scanner] Scanning for vulnerabilities...")\n\n';

  code += '        report = SecurityReport(\n';
  code += '            scan_time="{}",\n';
  code += '            total_vulnerabilities=0,\n';
  code += '            critical_count=0,\n';
  code += '            high_count=0,\n';
  code += '            medium_count=0,\n';
  code += '            low_count=0,\n';
  code += '            vulnerabilities=[],\n';
  code += '            remediations=[],\n';
  code += '        )\n\n';

  code += '        # Scan npm packages\n';
  code += '        if (self.project_root / "package.json").exists():\n';
  code += '            npm_vulns = await self.scan_npm()\n';
  code += '            report.vulnerabilities.extend(npm_vulns)\n\n';

  code += '        # Scan pip packages\n';
  code += '        if (self.project_root / "requirements.txt").exists():\n';
  code += '            pip_vulns = await self.scan_pip()\n';
  code += '            report.vulnerabilities.extend(pip_vulns)\n\n';

  code += '        # Filter by severity\n';
  code += '        report.vulnerabilities = [v for v in report.vulnerabilities if v.severity in self.severities]\n\n';

  code += '        # Count by severity\n';
  code += '        for vuln in report.vulnerabilities:\n';
  code += '            report.total_vulnerabilities += 1\n';
  code += '            if vuln.severity == "critical":\n';
  code += '                report.critical_count += 1\n';
  code += '            elif vuln.severity == "high":\n';
  code += '                report.high_count += 1\n';
  code += '            elif vuln.severity == "medium":\n';
  code += '                report.medium_count += 1\n';
  code += '            elif vuln.severity == "low":\n';
  code += '                report.low_count += 1\n\n';

  code += '        print(f"[Security Scanner] Found {report.total_vulnerabilities} vulnerabilities")\n\n';

  code += '        return report\n\n';

  code += '    async def generate_remediations(self, report: SecurityReport) -> List[RemediationAction]:\n';
  code += '        print("[Security Scanner] Generating remediation plan...")\n\n';

  code += '        remediations = []\n\n';

  code += '        for vuln in report.vulnerabilities:\n';
  code += '            if vuln.patched_versions:\n';
  code += '                remediations.append(RemediationAction(\n';
  code += '                    type="upgrade",\n';
  code += '                    package_name=vuln.package_name,\n';
  code += '                    current_version=vuln.affected_versions[0],\n';
  code += '                    target_version=vuln.patched_versions[0],\n';
  code += '                    reason=vuln.description,\n';
  code += '                    priority=self.calculate_priority(vuln.severity),\n';
  code += '                ))\n\n';

  code += '        # Sort by priority\n';
  code += '        remediations.sort(key=lambda x: x.priority, reverse=True)\n\n';

  code += '        return remediations\n\n';

  code += '    async def apply_remediations(self, remediations: List[RemediationAction]) -> None:\n';
  code += '        print("[Security Scanner] Applying remediations...")\n\n';

  code += '        for action in remediations:\n';
  code += '            if action.type == "upgrade":\n';
  code += '                await self.upgrade_package(action)\n';
  code += '            elif action.type == "remove":\n';
  code += '                await self.remove_package(action)\n\n';

  code += '    async def scan_npm(self) -> List[SecurityVulnerability]:\n';
  code += '        vulnerabilities = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["npm", "audit", "--json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n\n';

  code += '            if result.returncode != 0 and result.stdout:\n';
  code += '                audit = json.loads(result.stdout)\n';
  code += '                vuln_data = audit.get("vulnerabilities", {})\n\n';

  code += '                for package_name, data in vuln_data.items():\n';
  code += '                    vulnerabilities.append(SecurityVulnerability(\n';
  code += '                        package_name=package_name,\n';
  code += '                        ecosystem="npm",\n';
  code += '                        severity=data.get("severity", "unknown"),\n';
  code += '                        cve_id=", ".join(data.get("cve", [])),\n';
  code += '                        title=data.get("title", "Vulnerability"),\n';
  code += '                        description=data.get("overview", ""),\n';
  code += '                        affected_versions=[f.get("version") for f in data.get("findings", [])],\n';
  code += '                        patched_versions=data.get("patchedVersions", []),\n';
  code += '                        recommendation=data.get("recommendation", "Update to patched version"),\n';
  code += '                        references=data.get("references", []),\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Security Scanner] npm audit failed: {e}")\n\n';

  code += '        return vulnerabilities\n\n';

  code += '    async def scan_pip(self) -> List[SecurityVulnerability]:\n';
  code += '        vulnerabilities = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["pip-audit", "--format", "json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n\n';

  code += '            if result.returncode == 0:\n';
  code += '                audit = json.loads(result.stdout)\n\n';

  code += '                for vuln in audit:\n';
  code += '                    vulnerabilities.append(SecurityVulnerability(\n';
  code += '                        package_name=vuln.get("name"),\n';
  code += '                        ecosystem="pip",\n';
  code += '                        severity=vuln.get("severity", "unknown"),\n';
  code += '                        cve_id=vuln.get("cve", ""),\n';
  code += '                        title=vuln.get("vulnerability_id", "Vulnerability"),\n';
  code += '                        description=vuln.get("description", ""),\n';
  code += '                        affected_versions=vuln.get("affected_versions", []),\n';
  code += '                        patched_versions=vuln.get("fixed_versions", []),\n';
  code += '                        recommendation="Update to fixed version",\n';
  code += '                        references=vuln.get("links", []),\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Security Scanner] pip-audit failed: {e}")\n\n';

  code += '        return vulnerabilities\n\n';

  code += '    def calculate_priority(self, severity: str) -> int:\n';
  code += '        priorities = {\n';
  code += '            "critical": 100,\n';
  code += '            "high": 75,\n';
  code += '            "medium": 50,\n';
  code += '            "low": 25,\n';
  code += '        }\n';
  code += '        return priorities.get(severity, 0)\n\n';

  code += '    async def upgrade_package(self, action: RemediationAction) -> None:\n';
  code += '        print(f"[Security Scanner] Upgrading {action.package_name} to {action.target_version}")\n\n';

  code += '        try:\n';
  code += '            subprocess.run(\n';
  code += '                ["npm", "install", f"{action.package_name}@{action.target_version}"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                check=True,\n';
  code += '            )\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Security Scanner] Failed to upgrade {action.package_name}: {e}")\n\n';

  code += '    async def remove_package(self, action: RemediationAction) -> None:\n';
  code += '        print(f"[Security Scanner] Removing {action.package_name}")\n\n';

  code += '        try:\n';
  code += '            subprocess.run(\n';
  code += '                ["npm", "uninstall", action.package_name],\n';
  code += '                cwd=self.project_root,\n';
  code += '                check=True,\n';
  code += '            )\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Security Scanner] Failed to remove {action.package_name}: {e}")\n\n';

  code += 'security_scanner = PackageSecurityScanner(\n';
  code += '    severities=["critical", "high", "medium", "low"],\n';
  code += '    auto_fix=False,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: SecurityConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptSecurityScanner(config);
  fs.writeFileSync(path.join(outputDir, 'package-security-scanner.ts'), tsCode);

  const pyCode = generatePythonSecurityScanner(config);
  fs.writeFileSync(path.join(outputDir, 'package-security-scanner.py'), pyCode);

  const md = generateSecurityScannerMD(config);
  fs.writeFileSync(path.join(outputDir, 'PACKAGE_SECURITY_SCANNER.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Package security scanner',
    main: 'package-security-scanner.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'security-config.json'), JSON.stringify(config, null, 2));
}
