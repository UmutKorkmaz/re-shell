/**
 * Unified Security Scanning with Vulnerability Correlation
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type SecurityLanguage = 'typescript' | 'python';

export interface SecurityConfig {
  projectName: string;
  language: SecurityLanguage;
  outputDir: string;
  enableDependencyScan: boolean;
  enableCodeScan: boolean;
  enableSecretScan: boolean;
  severityThreshold: string;
}

// TypeScript Security Scanning (Simplified)
export function generateTypeScriptSecurity(config: SecurityConfig): string {
  let code = '// Auto-generated Security Scanning for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface Vulnerability {\n';
  code += '  id: string;\n';
  code += '  title: string;\n';
  code += '  severity: \'low\' | \'medium\' | \'high\' | \'critical\';\n';
  code += '  description: string;\n';
  code += '  affected: string;\n';
  code += '  fix?: string;\n';
  code += '  references: string[];\n';
  code += '}\n\n';

  code += 'interface SecurityReport {\n';
  code += '  scanTime: string;\n';
  code += '  totalVulnerabilities: number;\n';
  code += '  critical: number;\n';
  code += '  high: number;\n';
  code += '  medium: number;\n';
  code += '  low: number;\n';
  code += '  vulnerabilities: Vulnerability[];\n';
  code += '}\n\n';

  code += 'class SecurityScanner {\n';
  code += '  private projectRoot: string;\n';
  code += '  private severityThreshold: string;\n';
  code += '  private enableDependencyScan: boolean;\n';
  code += '  private enableCodeScan: boolean;\n';
  code += '  private enableSecretScan: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.severityThreshold = options.severityThreshold || \'low\';\n';
  code += '    this.enableDependencyScan = options.enableDependencyScan !== false;\n';
  code += '    this.enableCodeScan = options.enableCodeScan !== false;\n';
  code += '    this.enableSecretScan = options.enableSecretScan !== false;\n';
  code += '  }\n\n';

  code += '  async scanDependencies(): Promise<Vulnerability[]> {\n';
  code += '    if (!this.enableDependencyScan) return [];\n';
  code += '    console.log(\'[Security] Scanning dependencies...\');\n\n';

  code += '    const vulnerabilities: Vulnerability[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(\'npm audit --json\', { cwd: this.projectRoot, encoding: \'utf-8\' });\n';
  code += '      const audit = JSON.parse(output);\n\n';

  code += '      if (audit.vulnerabilities) {\n';
  code += '        for (const [name, data] of Object.entries(audit.vulnerabilities as any)) {\n';
  code += '          const vuln: Vulnerability = {\n';
  code += '            id: name,\n';
  code += '            title: name + \' vulnerability\',\n';
  code += '            severity: data.severity,\n';
  code += '            description: data.via[0]?.title || \'Dependency vulnerability\',\n';
  code += '            affected: name,\n';
  code += '            fix: data.fixAvailable?.version,\n';
  code += '            references: [],\n';
  code += '          };\n';
  code += '          vulnerabilities.push(vuln);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // npm audit exits with non-zero if vulnerabilities found\n';
  code += '      if (error.stdout) {\n';
  code += '        try {\n';
  code += '          const audit = JSON.parse(error.stdout);\n';
  code += '          // Parse same way\n';
  code += '        } catch {}\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return vulnerabilities;\n';
  code += '  }\n\n';

  code += '  async scanCode(): Promise<Vulnerability[]> {\n';
  code += '    if (!this.enableCodeScan) return [];\n';
  code += '    console.log(\'[Security] Scanning code patterns...\');\n\n';

  code += '    const vulnerabilities: Vulnerability[] = [];\n';
  code += '    const patterns = [\n';
  code += '      { pattern: /eval\\(/, severity: \'high\', title: \'eval() usage\' },\n';
  code += '      { pattern: /innerHTML\\s*=/, severity: \'high\', title: \'innerHTML assignment\' },\n';
  code += '      { pattern: /dangerouslySetInnerHTML/, severity: \'medium\', title: \'dangerouslySetInnerHTML\' },\n';
  code += '      { pattern: /setTimeout\\s*\\(/, severity: \'low\', title: \'setTimeout usage\' },\n';
  code += '    ];\n\n';

  code += '    const files = this.getSourceFiles();\n';
  code += '    for (const file of files) {\n';
  code += '      const content = fs.readFileSync(file, \'utf-8\');\n';
  code += '      for (const { pattern, severity, title } of patterns) {\n';
  code += '        if (pattern.test(content)) {\n';
  code += '          vulnerabilities.push({\n';
  code += '            id: \'CODE-\' + file.replace(/[^a-zA-Z0-9]/g, \'-\'),\n';
  code += '            title,\n';
  code += '            severity: severity as any,\n';
  code += '            description: \'Potentially insecure code pattern detected\',\n';
  code += '            affected: file,\n';
  code += '            references: [],\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return vulnerabilities;\n';
  code += '  }\n\n';

  code += '  async scanSecrets(): Promise<Vulnerability[]> {\n';
  code += '    if (!this.enableSecretScan) return [];\n';
  code += '    console.log(\'[Security] Scanning for secrets...\');\n\n';

  code += '    const vulnerabilities: Vulnerability[] = [];\n';
  code += '    const secretPatterns = [\n';
  code += '      /password\\s*[:=]\\s*[\'"]\\w+/,\n';
  code += '      /api[_-]?key\\s*[:=]\\s*[\'"]\\w+/,\n';
  code += '      /secret[_-]?key\\s*[:=]\\s*[\'"]\\w+/,\n';
  code += '      /token\\s*[:=]\\s*[\'"]\\w+/,\n';
  code += '    ];\n\n';

  code += '    const files = this.getSourceFiles();\n';
  code += '    for (const file of files) {\n';
  code += '      const content = fs.readFileSync(file, \'utf-8\');\n';
  code += '      for (const pattern of secretPatterns) {\n';
  code += '        if (pattern.test(content)) {\n';
  code += '          vulnerabilities.push({\n';
  code += '            id: \'SECRET-\' + file.replace(/[^a-zA-Z0-9]/g, \'-\'),\n';
  code += '            title: \'Potential secret detected\',\n';
  code += '            severity: \'critical\',\n';
  code += '            description: \'Possible hardcoded secret or credential\',\n';
  code += '            affected: file,\n';
  code += '            references: [],\n';
  code += '          });\n';
  code += '          break;\n';
  code += '        }\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return vulnerabilities;\n';
  code += '  }\n\n';

  code += '  async runFullScan(): Promise<SecurityReport> {\n';
  code += '    console.log(\'[Security] Starting security scan...\');\n\n';

  code += '    const allVulnerabilities: Vulnerability[] = [];\n\n';

  code += '    const deps = await this.scanDependencies();\n';
  code += '    allVulnerabilities.push(...deps);\n\n';

  code += '    const code = await this.scanCode();\n';
  code += '    allVulnerabilities.push(...code);\n\n';

  code += '    const secrets = await this.scanSecrets();\n';
  code += '    allVulnerabilities.push(...secrets);\n\n';

  code += '    const report: SecurityReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      totalVulnerabilities: allVulnerabilities.length,\n';
  code += '      critical: allVulnerabilities.filter(v => v.severity === \'critical\').length,\n';
  code += '      high: allVulnerabilities.filter(v => v.severity === \'high\').length,\n';
  code += '      medium: allVulnerabilities.filter(v => v.severity === \'medium\').length,\n';
  code += '      low: allVulnerabilities.filter(v => v.severity === \'low\').length,\n';
  code += '      vulnerabilities: allVulnerabilities,\n';
  code += '    };\n\n';

  code += '    console.log(\'[Security] Scan complete:\', report.totalVulnerabilities + \' vulnerabilities found\');\n';
  code += '    return report;\n';
  code += '  }\n\n';

  code += '  generateReport(report: SecurityReport): string {\n';
  code += '    let output = \'\\n=== Security Scan Report ===\\n\\n\';\n';
  code += '    output += \'Scan Time: \' + report.scanTime + \'\\n\\n\';\n\n';

  code += '    output += \'Summary:\\n\';\n';
  code += '    output += \'  Critical: \' + report.critical + \'\\n\';\n';
  code += '    output += \'  High: \' + report.high + \'\\n\';\n';
  code += '    output += \'  Medium: \' + report.medium + \'\\n\';\n';
  code += '    output += \'  Low: \' + report.low + \'\\n\\n\';\n\n';

  code += '    if (report.vulnerabilities.length > 0) {\n';
  code += '      output += \'Vulnerabilities:\\n\';\n';
  code += '      for (const vuln of report.vulnerabilities) {\n';
  code += '        output += \'  [\' + vuln.severity.toUpperCase() + \'] \' + vuln.title + \'\\n\';\n';
  code += '        output += \'    Affected: \' + vuln.affected + \'\\n\';\n';
  code += '        if (vuln.fix) output += \'    Fix: \' + vuln.fix + \'\\n\';\n';
  code += '        output += \'    \' + vuln.description + \'\\n\\n\';\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return output;\n';
  code += '  }\n\n';

  code += '  exportReport(report: SecurityReport, filePath: string): void {\n';
  code += '    const output = this.generateReport(report);\n';
  code += '    fs.writeFileSync(filePath, output);\n';
  code += '    console.log(\'[Security] Report exported to:\', filePath);\n';
  code += '  }\n\n';

  code += '  private getSourceFiles(): string[] {\n';
  code += '    const files: string[] = [];\n';
  code += '    const extensions = [\'.ts\', \'.tsx\', \'.js\', \'.jsx\'];\n\n';

  code += '    const scanDir = (dir: string) => {\n';
  code += '      const entries = fs.readdirSync(dir, { withFileTypes: true });\n';
  code += '      for (const entry of entries) {\n';
  code += '        if (entry.isDirectory() && entry.name !== \'node_modules\' && entry.name !== \'.git\') {\n';
  code += '          scanDir(path.join(dir, entry.name));\n';
  code += '        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {\n';
  code += '          files.push(path.join(dir, entry.name));\n';
  code += '        }\n';
  code += '      }\n';
  code += '    };\n\n';

  code += '    scanDir(this.projectRoot);\n';
  code += '    return files;\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const scanner = new SecurityScanner({\n';
  code += '  severityThreshold: \'' + config.severityThreshold + '\',\n';
  code += '  enableDependencyScan: ' + config.enableDependencyScan + ',\n';
  code += '  enableCodeScan: ' + config.enableCodeScan + ',\n';
  code += '  enableSecretScan: ' + config.enableSecretScan + ',\n';
  code += '});\n\n';

  code += 'export default scanner;\n';
  code += 'export { SecurityScanner, Vulnerability, SecurityReport };\n';

  return code;
}

// Python Security Scanning (Simplified)
export function generatePythonSecurity(config: SecurityConfig): string {
  let code = '# Auto-generated Security Scanning for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import re\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional\n';
  code += 'from dataclasses import dataclass\n';
  code += 'from datetime import datetime\n\n';

  code += '@dataclass\n';
  code += 'class Vulnerability:\n';
  code += '    id: str\n';
  code += '    title: str\n';
  code += '    severity: str\n';
  code += '    description: str\n';
  code += '    affected: str\n';
  code += '    fix: Optional[str] = None\n';
  code += '    references: List[str] = None\n\n';

  code += '    def __post_init__(self):\n';
  code += '        if self.references is None:\n';
  code += '            self.references = []\n\n';

  code += '@dataclass\n';
  code += 'class SecurityReport:\n';
  code += '    scan_time: str\n';
  code += '    total_vulnerabilities: int\n';
  code += '    critical: int\n';
  code += '    high: int\n';
  code += '    medium: int\n';
  code += '    low: int\n';
  code += '    vulnerabilities: List[Vulnerability]\n\n';

  code += 'class SecurityScanner:\n';
  code += '    def __init__(self, project_root: str = None, severity_threshold: str = \'low\', enable_dependency_scan: bool = True, enable_code_scan: bool = True, enable_secret_scan: bool = True):\n';
  code += '        self.project_root = Path(project_root or \'.\')\n';
  code += '        self.severity_threshold = severity_threshold\n';
  code += '        self.enable_dependency_scan = enable_dependency_scan\n';
  code += '        self.enable_code_scan = enable_code_scan\n';
  code += '        self.enable_secret_scan = enable_secret_scan\n\n';

  code += '    async def scan_dependencies(self) -> List[Vulnerability]:\n';
  code += '        if not self.enable_dependency_scan:\n';
  code += '            return []\n';
  code += '        print(\'[Security] Scanning dependencies...\')\n\n';

  code += '        vulnerabilities = []\n';
  code += '        try:\n';
  code += '            result = subprocess.run([\'pip\', \'audit\', \'--json\'], cwd=self.project_root, capture_output=True, text=True)\n';
  code += '            if result.stdout:\n';
  code += '                # Parse pip-audit output\n';
  code += '                pass\n';
  code += '        except FileNotFoundError:\n';
  code += '            print(\'[Security] pip-audit not installed\')\n\n';

  code += '        return vulnerabilities\n\n';

  code += '    async def scan_code(self) -> List[Vulnerability]:\n';
  code += '        if not self.enable_code_scan:\n';
  code += '            return []\n';
  code += '        print(\'[Security] Scanning code patterns...\')\n\n';

  code += '        vulnerabilities = []\n';
  code += '        patterns = [\n';
  code += '            (re.compile(r\'eval\\(\'), \'high\', \'eval() usage\'),\n';
  code += '            (re.compile(r\'exec\\(\'), \'high\', \'exec() usage\'),\n';
  code += '            (re.compile(r\'subprocess\\.call\\(\'), \'medium\', \'subprocess.call\'),\n';
  code += '            (re.compile(r\'os\\.system\\(\'), \'high\', \'os.system usage\'),\n';
  code += '        ]\n\n';

  code += '        for file in self._get_source_files():\n';
  code += '            with open(file, \'r\') as f:\n';
  code += '                content = f.read()\n';
  code += '            for pattern, severity, title in patterns:\n';
  code += '                if pattern.search(content):\n';
  code += '                    vulnerabilities.append(Vulnerability(\n';
  code += '                        id=\'CODE-\' + re.sub(r\'[^a-zA-Z0-9]\', \'-\', str(file)),\n';
  code += '                        title=title,\n';
  code += '                        severity=severity,\n';
  code += '                        description=\'Potentially insecure code pattern detected\',\n';
  code += '                        affected=str(file),\n';
  code += '                    ))\n';
  code += '                    break\n\n';

  code += '        return vulnerabilities\n\n';

  code += '    async def scan_secrets(self) -> List[Vulnerability]:\n';
  code += '        if not self.enable_secret_scan:\n';
  code += '            return []\n';
  code += '        print(\'[Security] Scanning for secrets...\')\n\n';

  code += '        vulnerabilities = []\n';
  code += '        secret_patterns = [\n';
  code += '            re.compile(r\'password\\s*[:=]\\s*[\\\'"]\\w+\'),\n';
  code += '            re.compile(r\'api[_-]?key\\s*[:=]\\s*[\\\'"]\\w+\'),\n';
  code += '            re.compile(r\'secret[_-]?key\\s*[:=]\\s*[\\\'"]\\w+\'),\n';
  code += '            re.compile(r\'token\\s*[:=]\\s*[\\\'"]\\w+\'),\n';
  code += '        ]\n\n';

  code += '        for file in self._get_source_files():\n';
  code += '            with open(file, \'r\') as f:\n';
  code += '                content = f.read()\n';
  code += '            for pattern in secret_patterns:\n';
  code += '                if pattern.search(content):\n';
  code += '                    vulnerabilities.append(Vulnerability(\n';
  code += '                        id=\'SECRET-\' + re.sub(r\'[^a-zA-Z0-9]\', \'-\', str(file)),\n';
  code += '                        title=\'Potential secret detected\',\n';
  code += '                        severity=\'critical\',\n';
  code += '                        description=\'Possible hardcoded secret or credential\',\n';
  code += '                        affected=str(file),\n';
  code += '                    ))\n';
  code += '                    break\n\n';

  code += '        return vulnerabilities\n\n';

  code += '    async def run_full_scan(self) -> SecurityReport:\n';
  code += '        print(\'[Security] Starting security scan...\')\n\n';

  code += '        all_vulnerabilities = []\n';
  code += '        deps = await self.scan_dependencies()\n';
  code += '        all_vulnerabilities.extend(deps)\n\n';

  code += '        code_vulns = await self.scan_code()\n';
  code += '        all_vulnerabilities.extend(code_vulns)\n\n';

  code += '        secrets = await self.scan_secrets()\n';
  code += '        all_vulnerabilities.extend(secrets)\n\n';

  code += '        report = SecurityReport(\n';
  code += '            scan_time=datetime.now().isoformat(),\n';
  code += '            total_vulnerabilities=len(all_vulnerabilities),\n';
  code += '            critical=len([v for v in all_vulnerabilities if v.severity == \'critical\']),\n';
  code += '            high=len([v for v in all_vulnerabilities if v.severity == \'high\']),\n';
  code += '            medium=len([v for v in all_vulnerabilities if v.severity == \'medium\']),\n';
  code += '            low=len([v for v in all_vulnerabilities if v.severity == \'low\']),\n';
  code += '            vulnerabilities=all_vulnerabilities,\n';
  code += '        )\n\n';

  code += '        print(f\'[Security] Scan complete: {report.total_vulnerabilities} vulnerabilities found\')\n';
  code += '        return report\n\n';

  code += '    def generate_report(self, report: SecurityReport) -> str:\n';
  code += '        output = \'\\n=== Security Scan Report ===\\n\\n\'\n';
  code += '        output += f\'Scan Time: {report.scan_time}\\n\\n\'\n\n';

  code += '        output += \'Summary:\\n\'\n';
  code += '        output += f\'  Critical: {report.critical}\\n\'\n';
  code += '        output += f\'  High: {report.high}\\n\'\n';
  code += '        output += f\'  Medium: {report.medium}\\n\'\n';
  code += '        output += f\'  Low: {report.low}\\n\\n\'\n\n';

  code += '        if report.vulnerabilities:\n';
  code += '            output += \'Vulnerabilities:\\n\'\n';
  code += '            for vuln in report.vulnerabilities:\n';
  code += '                output += f\'  [{vuln.severity.upper()}] {vuln.title}\\n\'\n';
  code += '                output += f\'    Affected: {vuln.affected}\\n\'\n';
  code += '                if vuln.fix:\n';
  code += '                    output += f\'    Fix: {vuln.fix}\\n\'\n';
  code += '                output += f\'    {vuln.description}\\n\\n\'\n\n';

  code += '        return output\n\n';

  code += '    def export_report(self, report: SecurityReport, file_path: str) -> None:\n';
  code += '        output = self.generate_report(report)\n';
  code += '        with open(file_path, \'w\') as f:\n';
  code += '            f.write(output)\n';
  code += '        print(f\'[Security] Report exported to: {file_path}\')\n\n';

  code += '    def _get_source_files(self) -> List[Path]:\n';
  code += '        files = []\n';
  code += '        extensions = [\'.py\', \'.pyi\']\n';

  code += '        for file in self.project_root.rglob(\'*\'):\n';
  code += '            if file.is_file() and file.suffix in extensions:\n';
  code += '                if \'site-packages\' not in str(file):\n';
  code += '                    files.append(file)\n\n';

  code += '        return files\n\n';

  code += 'scanner = SecurityScanner(\n';
  code += '    severity_threshold=\'' + config.severityThreshold + '\',\n';
  code += '    enable_dependency_scan=' + (config.enableDependencyScan ? 'True' : 'False') + ',\n';
  code += '    enable_code_scan=' + (config.enableCodeScan ? 'True' : 'False') + ',\n';
  code += '    enable_secret_scan=' + (config.enableSecretScan ? 'True' : 'False') + ',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displaySecurityConfig(config: SecurityConfig): void {
  console.log(chalk.cyan('\n✨ Unified Security Scanning with Vulnerability Correlation\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Severity Threshold:'), chalk.white(config.severityThreshold));
  console.log(chalk.yellow('Dependency Scan:'), chalk.white(config.enableDependencyScan ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Code Scan:'), chalk.white(config.enableCodeScan ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Secret Scan:'), chalk.white(config.enableSecretScan ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Cross-language vulnerability scanning',
    'Dependency security audits',
    'Code pattern analysis',
    'Secret detection',
    'Vulnerability correlation and reporting',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: SecurityConfig): string {
  let content = '# Unified Security Scanning for ' + config.projectName + '\n\n';
  content += 'Cross-language security scanning with vulnerability correlation for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Severity Threshold**: ' + config.severityThreshold + '\n';
  content += '- **Dependency Scan**: ' + (config.enableDependencyScan ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Code Scan**: ' + (config.enableCodeScan ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Secret Scan**: ' + (config.enableSecretScan ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import scanner from \'./security-scanning\';\n\n';
  content += '// Run full security scan\n';
  content += 'const report = await scanner.runFullScan();\n\n';
  content += '// Generate report\n';
  content += 'const output = scanner.generateReport(report);\n';
  content += 'console.log(output);\n\n';
  content += '// Export report\n';
  content += 'scanner.exportReport(report, \'security-report.txt\');\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from security_scanning import scanner\n\n';
  content += '# Run full security scan\n';
  content += 'report = await scanner.run_full_scan()\n\n';
  content += '# Generate report\n';
  content += 'output = scanner.generate_report(report)\n';
  content += 'print(output)\n\n';
  content += '# Export report\n';
  content += 'scanner.export_report(report, \'security-report.txt\')\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **Dependency Scanning**: Audit npm/pip dependencies for vulnerabilities\n';
  content += '- **Code Analysis**: Detect potentially insecure code patterns\n';
  content += '- **Secret Detection**: Find hardcoded secrets and credentials\n';
  content += '- **Vulnerability Correlation**: Correlate findings across scan types\n';
  content += '- **Report Generation**: Export detailed security reports\n\n';

  return content;
}

// Write files
export async function writeSecurityFiles(
  config: SecurityConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'security-scanning.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptSecurity(config);
  } else if (config.language === 'python') {
    content = generatePythonSecurity(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  const buildMD = generateBuildMD(config);
  await fs.writeFile(path.join(output, 'BUILD.md'), buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  if (config.language === 'typescript') {
    const packageJson = {
      name: config.projectName.toLowerCase() + '-security',
      version: '1.0.0',
      description: 'Security scanning for ' + config.projectName,
      types: fileName,
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    };

    await fs.writeFile(
      path.join(output, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
    console.log(chalk.green('✅ Generated: package.json'));
  }

  if (config.language === 'python') {
    const requirements = [];

    await fs.writeFile(path.join(output, 'requirements.txt'), requirements.join('\n') || '# No dependencies\n');
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  const securityConfig = {
    projectName: config.projectName,
    language: config.language,
    severityThreshold: config.severityThreshold,
    enableDependencyScan: config.enableDependencyScan,
    enableCodeScan: config.enableCodeScan,
    enableSecretScan: config.enableSecretScan,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'security-config.json'),
    JSON.stringify(securityConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: security-config.json'));
}
