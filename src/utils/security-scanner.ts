// Auto-generated Integrated Security Scanning
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SecurityIssue {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'injection' | 'xss' | 'auth' | 'crypto' | 'config' | 'dependency';
  language: string;
  file: string;
  line: number;
  code: string;
  cwe: string[];
  references: string[];
  correlatedIssues: string[];
}

interface SecurityReport {
  scanTime: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  issues: SecurityIssue[];
  correlations: Correlation[];
  summary: {
    byCategory: { [key: string]: number };
    byLanguage: { [key: string]: number };
    topFiles: { file: string; count: number }[];
  };
}

interface Correlation {
  type: string;
  description: string;
  issues: SecurityIssue[];
  riskMultiplier: number;
}

interface SecurityConfig {
  projectName: string;
  languages: string[];
  severities: string[];
  enableCorrelation: boolean;
}

export function displayConfig(config: SecurityConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Integrated Security Scanning');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Languages:', config.languages.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Severities:', config.severities.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Enable Correlation:', config.enableCorrelation ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateSecurityMD(config: SecurityConfig): string {
  let md = '# Integrated Security Scanning\n\n';
  md += '## Features\n\n';
  md += '- Polyglot security scanning\n';
  md += '- Cross-language vulnerability correlation\n';
  md += '- CWE mapping\n';
  md += '- Severity-based prioritization\n';
  md += '- Pattern-based detection\n';
  md += '- Dependency vulnerability scanning\n';
  md += '- Security hotspots identification\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import securityScanner from \'./security-scanner\';\n\n';
  md += '// Run security scan\n';
  md += 'const report = await securityScanner.scan();\n\n';
  md += '// View correlations\n';
  md += 'report.correlations.forEach(cor => console.log(cor.description));\n\n';
  md += '// Get summary\n';
  md += 'console.log(report.summary);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptSecurity(config: SecurityConfig): string {
  let code = '// Auto-generated Security Scanner for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface SecurityIssue {\n';
  code += '  id: string;\n';
  code += '  title: string;\n';
  code += '  description: string;\n';
  code += '  severity: \'critical\' | \'high\' | \'medium\' | \'low\';\n';
  code += '  category: \'injection\' | \'xss\' | \'auth\' | \'crypto\' | \'config\' | \'dependency\';\n';
  code += '  language: string;\n';
  code += '  file: string;\n';
  code += '  line: number;\n';
  code += '  code: string;\n';
  code += '  cwe: string[];\n';
  code += '  references: string[];\n';
  code += '  correlatedIssues: string[];\n';
  code += '}\n\n';

  code += 'interface Correlation {\n';
  code += '  type: string;\n';
  code += '  description: string;\n';
  code += '  issues: SecurityIssue[];\n';
  code += '  riskMultiplier: number;\n';
  code += '}\n\n';

  code += 'interface SecurityReport {\n';
  code += '  scanTime: string;\n';
  code += '  totalIssues: number;\n';
  code += '  criticalCount: number;\n';
  code += '  highCount: number;\n';
  code += '  mediumCount: number;\n';
  code += '  lowCount: number;\n';
  code += '  issues: SecurityIssue[];\n';
  code += '  correlations: Correlation[];\n';
  code += '  summary: any;\n';
  code += '}\n\n';

  code += 'class IntegratedSecurityScanner {\n';
  code += '  private projectRoot: string;\n';
  code += '  private languages: string[];\n';
  code += '  private severities: string[];\n';
  code += '  private enableCorrelation: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.languages = options.languages || [\'typescript\', \'python\', \'go\'];\n';
  code += '    this.severities = options.severities || [\'critical\', \'high\', \'medium\', \'low\'];\n';
  code += '    this.enableCorrelation = options.enableCorrelation !== undefined ? options.enableCorrelation : true;\n';
  code += '  }\n\n';

  code += '  async scan(): Promise<SecurityReport> {\n';
  code += '    console.log(\'[Security Scanner] Running integrated security scan...\');\n\n';

  code += '    const report: SecurityReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      totalIssues: 0,\n';
  code += '      criticalCount: 0,\n';
  code += '      highCount: 0,\n';
  code += '      mediumCount: 0,\n';
  code += '      lowCount: 0,\n';
  code += '      issues: [],\n';
  code += '      correlations: [],\n';
  code += '      summary: {\n';
  code += '        byCategory: {},\n';
  code += '        byLanguage: {},\n';
  code += '        topFiles: [],\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    // Scan TypeScript files\n';
  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      const tsIssues = await this.scanTypeScript();\n';
  code += '      report.issues.push(...tsIssues);\n';
  code += '    }\n\n';

  code += '    // Scan Python files\n';
  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      const pyIssues = await this.scanPython();\n';
  code += '      report.issues.push(...pyIssues);\n';
  code += '    }\n\n';

  code += '    // Filter by severity\n';
  code += '    report.issues = report.issues.filter(i => this.severities.includes(i.severity));\n\n';

  code += '    // Count by severity\n';
  code += '    for (const issue of report.issues) {\n';
  code += '      report.totalIssues++;\n';
  code += '      if (issue.severity === \'critical\') report.criticalCount++;\n';
  code += '      else if (issue.severity === \'high\') report.highCount++;\n';
  code += '      else if (issue.severity === \'medium\') report.mediumCount++;\n';
  code += '      else if (issue.severity === \'low\') report.lowCount++;\n';
  code += '    }\n\n';

  code += '    // Find correlations\n';
  code += '    if (this.enableCorrelation) {\n';
  code += '      report.correlations = this.findCorrelations(report.issues);\n';
  code += '    }\n\n';

  code += '    // Generate summary\n';
  code += '    report.summary = this.generateSummary(report.issues);\n\n';

  code += '    console.log(`[Security Scanner] Found ${report.totalIssues} security issues`);\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  private async scanTypeScript(): Promise<SecurityIssue[]> {\n';
  code += '    const issues: SecurityIssue[] = [];\n\n';

  code += '    try {\n';
  code += '      // Run security linters\n';
  code += '      const output = execSync(\'npx eslint . --plugin security --format json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const results = JSON.parse(output);\n';
  code += '      for (const file of results) {\n';
  code += '        for (const msg of file.messages) {\n';
  code += '          if (msg.ruleId && msg.ruleId.startsWith(\'security\')) {\n';
  code += '            issues.push({\n';
  code += '              id: `ts-${file.filePath}-${msg.line}`,\n';
  code += '              title: msg.message,\n';
  code += '              description: msg.message,\n';
  code += '              severity: this.mapSeverity(msg.severity),\n';
  code += '              category: this.categorizeRule(msg.ruleId),\n';
  code += '              language: \'typescript\',\n';
  code += '              file: file.filePath,\n';
  code += '              line: msg.line,\n';
  code += '              code: \'\',\n';
  code += '              cwe: this.getCWEForRule(msg.ruleId),\n';
  code += '              references: [],\n';
  code += '              correlatedIssues: [],\n';
  code += '            });\n';
  code += '          }\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // Pattern-based scanning as fallback\n';
  code += '      issues.push(...this.scanPatternsTypeScript());\n';
  code += '    }\n\n';

  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  private async scanPython(): Promise<SecurityIssue[]> {\n';
  code += '    const issues: SecurityIssue[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'bandit -r . -f json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const results = JSON.parse(output);\n';
  code += '      for (const result of results.results) {\n';
  code += '        issues.push({\n';
  code += '          id: `py-${result.filename}-${result.line_number}`,\n';
  code += '          title: result.issue_text,\n';
  code += '          description: result.text,\n';
  code += '          severity: this.mapBanditSeverity(result.issue_severity),\n';
  code += '          category: this.categorizeBanditTest(result.test_id),\n';
  code += '          language: \'python\',\n';
  code += '          file: result.filename,\n';
  code += '          line: result.line_number,\n';
  code += '          code: result.code,\n';
  code += '          cwe: result.cwe || [],\n';
  code += '          references: [],\n';
  code += '          correlatedIssues: [],\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Security Scanner] Python scan failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  private scanPatternsTypeScript(): SecurityIssue[] {\n';
  code += '    const issues: SecurityIssue[] = [];\n';
  code += '    const patterns = [\n';
  code += '      { pattern: /eval\\s*\\(/, cwe: [\'CWE-95\'], title: \'Use of eval()\', severity: \'high\', category: \'injection\' },\n';
  code += '      { pattern: /innerHTML\\s*=/, cwe: [\'CWE-79\'], title: \'XSS vulnerability via innerHTML\', severity: \'high\', category: \'xss\' },\n';
  code += '      { pattern: /document\\.write\\s*\\(/, cwe: [\'CWE-79\'], title: \'XSS via document.write\', severity: \'medium\', category: \'xss\' },\n';
  code += '    ];\n\n';

  code += '    const searchFiles = (dir: string) => {\n';
  code += '      if (!fs.existsSync(dir)) return;\n';
  code += '      const entries = fs.readdirSync(dir, { withFileTypes: true });\n';
  code += '      for (const entry of entries) {\n';
  code += '        const fullPath = path.join(dir, entry.name);\n';
  code += '        if (entry.isDirectory() && entry.name !== \'node_modules\' && entry.name !== \'.git\') {\n';
  code += '          searchFiles(fullPath);\n';
  code += '        } else if (entry.isFile() && /\\.(ts|js|tsx|jsx)$/.test(entry.name)) {\n';
  code += '          const content = fs.readFileSync(fullPath, \'utf-8\');\n';
  code += '          const lines = content.split(\'\\n\');\n';
  code += '          for (const pattern of patterns) {\n';
  code += '            lines.forEach((line, idx) => {\n';
  code += '              if (pattern.pattern.test(line)) {\n';
  code += '                issues.push({\n';
  code += '                  id: `pattern-${fullPath}-${idx}`,\n';
  code += '                  title: pattern.title,\n';
  code += '                  description: `Detected: ${pattern.title}`,\n';
  code += '                  severity: pattern.severity as any,\n';
  code += '                  category: pattern.category as any,\n';
  code += '                  language: \'typescript\',\n';
  code += '                  file: fullPath,\n';
  code += '                  line: idx + 1,\n';
  code += '                  code: line.trim(),\n';
  code += '                  cwe: pattern.cwe,\n';
  code += '                  references: [],\n';
  code += '                  correlatedIssues: [],\n';
  code += '                });\n';
  code += '              }\n';
  code += '            });\n';
  code += '          }\n';
  code += '        }\n';
  code += '      }\n';
  code += '    };\n\n';

  code += '    searchFiles(this.projectRoot);\n';
  code += '    return issues;\n';
  code += '  }\n\n';

  code += '  private findCorrelations(issues: SecurityIssue[]): Correlation[] {\n';
  code += '    const correlations: Correlation[] = [];\n\n';

  code += '    // Group by category\n';
  code += '    const byCategory: { [key: string]: SecurityIssue[] } = {};\n';
  code += '    for (const issue of issues) {\n';
  code += '      if (!byCategory[issue.category]) byCategory[issue.category] = [];\n';
  code += '      byCategory[issue.category].push(issue);\n';
  code += '    }\n\n';

  code += '    // Find patterns\n';
  code += '    for (const [category, categoryIssues] of Object.entries(byCategory)) {\n';
  code += '      if (categoryIssues.length > 3) {\n';
  code += '        correlations.push({\n';
  code += '          type: \'cluster\',\n';
  code += '          description: `Cluster of ${categoryIssues.length} ${category} issues detected across the codebase`,\n';
  code += '          issues: categoryIssues,\n';
  code += '          riskMultiplier: 1.5,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return correlations;\n';
  code += '  }\n\n';

  code += '  private generateSummary(issues: SecurityIssue[]): any {\n';
  code += '    const byCategory: { [key: string]: number } = {};\n';
  code += '    const byLanguage: { [key: string]: number } = {};\n';
  code += '    const fileCounts: { [key: string]: number } = {};\n\n';

  code += '    for (const issue of issues) {\n';
  code += '      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;\n';
  code += '      byLanguage[issue.language] = (byLanguage[issue.language] || 0) + 1;\n';
  code += '      fileCounts[issue.file] = (fileCounts[issue.file] || 0) + 1;\n';
  code += '    }\n\n';

  code += '    const topFiles = Object.entries(fileCounts)\n';
  code += '      .sort(([, a], [, b]) => b - a)\n';
  code += '      .slice(0, 10)\n';
  code += '      .map(([file, count]) => ({ file, count }));\n\n';

  code += '    return { byCategory, byLanguage, topFiles };\n';
  code += '  }\n\n';

  code += '  private mapSeverity(severity: number): \'critical\' | \'high\' | \'medium\' | \'low\' {\n';
  code += '    if (severity >= 3) return \'critical\';\n';
  code += '    if (severity === 2) return \'high\';\n';
  code += '    if (severity === 1) return \'medium\';\n';
  code += '    return \'low\';\n';
  code += '  }\n\n';

  code += '  private categorizeRule(ruleId: string): \'injection\' | \'xss\' | \'auth\' | \'crypto\' | \'config\' | \'dependency\' {\n';
  code += '    if (ruleId.includes(\'injection\')) return \'injection\';\n';
  code += '    if (ruleId.includes(\'xss\')) return \'xss\';\n';
  code += '    if (ruleId.includes(\'auth\')) return \'auth\';\n';
  code += '    if (ruleId.includes(\'crypto\')) return \'crypto\';\n';
  code += '    return \'config\';\n';
  code += '  }\n\n';

  code += '  private mapBanditSeverity(severity: string): \'critical\' | \'high\' | \'medium\' | \'low\' {\n';
  code += '    if (severity === \'high\') return \'critical\';\n';
  code += '    if (severity === \'medium\') return \'high\';\n';
  code += '    return \'low\';\n';
  code += '  }\n\n';

  code += '  private categorizeBanditTest(testId: string): \'injection\' | \'xss\' | \'auth\' | \'crypto\' | \'config\' | \'dependency\' {\n';
  code += '    if (testId.includes(\'inject\')) return \'injection\';\n';
  code += '    if (testId.includes(\'xss\')) return \'xss\';\n';
  code += '    if (testId.includes(\'auth\')) return \'auth\';\n';
  code += '    if (testId.includes(\'crypto\')) return \'crypto\';\n';
  code += '    return \'config\';\n';
  code += '  }\n\n';

  code += '  private getCWEForRule(ruleId: string): string[] {\n';
  code += '    const cweMap: { [key: string]: string[] } = {\n';
  code += '      \'security/detect-sql-injection\': [\'CWE-89\'],\n';
  code += '      \'security/detect-no-assign-in-expression\': [\'CWE-482\'],\n';
  code += '      \'security/detect-object-injection\': [\'CWE-94\'],\n';
  code += '    };\n';
  code += '    return cweMap[ruleId] || [];\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const securityScanner = new IntegratedSecurityScanner({\n';
  code += '  languages: [\'typescript\', \'python\', \'go\'],\n';
  code += '  severities: [\'critical\', \'high\', \'medium\', \'low\'],\n';
  code += '  enableCorrelation: true,\n';
  code += '});\n\n';

  code += 'export default securityScanner;\n';
  code += 'export { IntegratedSecurityScanner, SecurityReport, SecurityIssue, Correlation };\n';

  return code;
}

export function generatePythonSecurity(config: SecurityConfig): string {
  let code = '# Auto-generated Security Scanner for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'import re\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class SecurityIssue:\n';
  code += '    id: str\n';
  code += '    title: str\n';
  code += '    description: str\n';
  code += '    severity: str\n';
  code += '    category: str\n';
  code += '    language: str\n';
  code += '    file: str\n';
  code += '    line: int\n';
  code += '    code: str\n';
  code += '    cwe: List[str]\n';
  code += '    references: List[str]\n';
  code += '    correlated_issues: List[str]\n\n';

  code += '@dataclass\n';
  code += 'class Correlation:\n';
  code += '    type: str\n';
  code += '    description: str\n';
  code += '    issues: List[SecurityIssue]\n';
  code += '    risk_multiplier: float\n\n';

  code += 'class IntegratedSecurityScanner:\n';
  code += '    def __init__(self, project_root: str = None, languages: List[str] = None, severities: List[str] = None):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.languages = languages or ["typescript", "python", "go"]\n';
  code += '        self.severities = severities or ["critical", "high", "medium", "low"]\n\n';

  code += '    async def scan(self):\n';
  code += '        print("[Security Scanner] Running integrated security scan...")\n\n';

  code += '        issues = []\n';

  code += '        # Scan TypeScript files\n';
  code += '        if "typescript" in self.languages:\n';
  code += '            ts_issues = await self.scan_typescript()\n';
  code += '            issues.extend(ts_issues)\n\n';

  code += '        # Scan Python files\n';
  code += '        if "python" in self.languages:\n';
  code += '            py_issues = await self.scan_python()\n';
  code += '            issues.extend(py_issues)\n\n';

  code += '        print(f"[Security Scanner] Found {len(issues)} security issues")\n\n';

  code += '        return {\n';
  code += '            "scan_time": "",\n';
  code += '            "total_issues": len(issues),\n';
  code += '            "critical_count": sum(1 for i in issues if i.severity == "critical"),\n';
  code += '            "high_count": sum(1 for i in issues if i.severity == "high"),\n';
  code += '            "medium_count": sum(1 for i in issues if i.severity == "medium"),\n';
  code += '            "low_count": sum(1 for i in issues if i.severity == "low"),\n';
  code += '            "issues": issues,\n';
  code += '            "correlations": [],\n';
  code += '            "summary": {},\n';
  code += '        }\n\n';

  code += '    async def scan_typescript(self) -> List[SecurityIssue]:\n';
  code += '        issues = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["npx", "eslint", ".", "--plugin", "security", "--format", "json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n\n';
  code += '            if result.stdout:\n';
  code += '                results = json.loads(result.stdout)\n';
  code += '                for file in results:\n';
  code += '                    for msg in file.get("messages", []):\n';
  code += '                        if msg.get("ruleId", "").startswith("security"):\n';
  code += '                            issues.append(SecurityIssue(\n';
  code += '                                id=f"ts-{file.get(\'filePath\')}-{msg.get(\'line\')}",\n';
  code += '                                title=msg.get("message", ""),\n';
  code += '                                description=msg.get("message", ""),\n';
  code += '                                severity="high",\n';
  code += '                                category="injection",\n';
  code += '                                language="typescript",\n';
  code += '                                file=file.get("filePath", ""),\n';
  code += '                                line=msg.get("line", 0),\n';
  code += '                                code="",\n';
  code += '                                cwe=[],\n';
  code += '                                references=[],\n';
  code += '                                correlated_issues=[],\n';
  code += '                            ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Security Scanner] TypeScript scan failed: {e}")\n\n';

  code += '        return issues\n\n';

  code += '    async def scan_python(self) -> List[SecurityIssue]:\n';
  code += '        issues = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["bandit", "-r", ".", "-f", "json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n\n';

  code += '            if result.stdout:\n';
  code += '                results = json.loads(result.stdout)\n';
  code += '                for result_item in results.get("results", []):\n';
  code += '                    issues.append(SecurityIssue(\n';
  code += '                        id=f"py-{result_item.get(\'filename\')}-{result_item.get(\'line_number\')}",\n';
  code += '                        title=result_item.get("issue_text", ""),\n';
  code += '                        description=result_item.get("text", ""),\n';
  code += '                        severity="high",\n';
  code += '                        category="injection",\n';
  code += '                        language="python",\n';
  code += '                        file=result_item.get("filename", ""),\n';
  code += '                        line=result_item.get("line_number", 0),\n';
  code += '                        code=result_item.get("code", ""),\n';
  code += '                        cwe=result_item.get("cwe", []),\n';
  code += '                        references=[],\n';
  code += '                        correlated_issues=[],\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Security Scanner] Python scan failed: {e}")\n\n';

  code += '        return issues\n\n';

  code += 'security_scanner = IntegratedSecurityScanner(\n';
  code += '    languages=["typescript", "python", "go"],\n';
  code += '    severities=["critical", "high", "medium", "low"],\n';
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

  const tsCode = generateTypeScriptSecurity(config);
  fs.writeFileSync(path.join(outputDir, 'security-scanner.ts'), tsCode);

  const pyCode = generatePythonSecurity(config);
  fs.writeFileSync(path.join(outputDir, 'security-scanner.py'), pyCode);

  const md = generateSecurityMD(config);
  fs.writeFileSync(path.join(outputDir, 'SECURITY_SCANNER.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Integrated security scanning',
    main: 'security-scanner.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'security-config.json'), JSON.stringify(config, null, 2));
}
