// Auto-generated Unified Linting Rules
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface LintRule {
  id: string;
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: string;
  languages: string[];
  rule: string;
  fixable: boolean;
}

interface LintViolation {
  file: string;
  line: number;
  column: number;
  ruleId: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  language: string;
  fixable: boolean;
  suggestion?: string;
}

interface LintReport {
  scanTime: string;
  totalFiles: number;
  totalViolations: number;
  errors: number;
  warnings: number;
  info: number;
  fixable: number;
  violations: LintViolation[];
  languageBreakdown: { [key: string]: number };
}

interface LintingConfig {
  projectName: string;
  languages: string[];
  rules: string[];
  autoFix: boolean;
}

export function displayConfig(config: LintingConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Unified Linting Rules');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Languages:', config.languages.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Rules:', config.rules.length);
  console.log('\x1b[33m%s\x1b[0m', 'Auto Fix:', config.autoFix ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateLintingMD(config: LintingConfig): string {
  let md = '# Unified Linting Rules\n\n';
  md += '## Features\n\n';
  md += '- Cross-language linting support\n';
  md += '- Consistent rule enforcement\n';
  md += '- Auto-fix capabilities\n';
  md += '- Severity-based reporting\n';
  md += '- Language-specific adapters\n';
  md += '- Unified configuration\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import linter from \'./linting-rules\';\n\n';
  md += '// Run linter\n';
  md += 'const report = await linter.lint();\n\n';
  md += '// Auto-fix issues\n';
  md += 'await linter.fix(report.violations);\n\n';
  md += '// Generate report\n';
  md += 'linter.generateReport(report);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptLinting(config: LintingConfig): string {
  let code = '// Auto-generated Linting Rules for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface LintRule {\n';
  code += '  id: string;\n';
  code += '  name: string;\n';
  code += '  description: string;\n';
  code += '  severity: \'error\' | \'warning\' | \'info\';\n';
  code += '  category: string;\n';
  code += '  languages: string[];\n';
  code += '  rule: string;\n';
  code += '  fixable: boolean;\n';
  code += '}\n\n';

  code += 'interface LintViolation {\n';
  code += '  file: string;\n';
  code += '  line: number;\n';
  code += '  column: number;\n';
  code += '  ruleId: string;\n';
  code += '  message: string;\n';
  code += '  severity: \'error\' | \'warning\' | \'info\';\n';
  code += '  language: string;\n';
  code += '  fixable: boolean;\n';
  code += '  suggestion?: string;\n';
  code += '}\n\n';

  code += 'interface LintReport {\n';
  code += '  scanTime: string;\n';
  code += '  totalFiles: number;\n';
  code += '  totalViolations: number;\n';
  code += '  errors: number;\n';
  code += '  warnings: number;\n';
  code += '  info: number;\n';
  code += '  fixable: number;\n';
  code += '  violations: LintViolation[];\n';
  code += '  languageBreakdown: { [key: string]: number };\n';
  code += '}\n\n';

  code += 'class UnifiedLinter {\n';
  code += '  private projectRoot: string;\n';
  code += '  private languages: string[];\n';
  code += '  private rules: LintRule[];\n';
  code += '  private autoFix: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.languages = options.languages || [\'typescript\', \'python\', \'go\'];\n';
  code += '    this.rules = this.initializeRules();\n';
  code += '    this.autoFix = options.autoFix || false;\n';
  code += '  }\n\n';

  code += '  async lint(): Promise<LintReport> {\n';
  code += '    console.log(\'[Linter] Running unified linting...\');\n\n';

  code += '    const report: LintReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      totalFiles: 0,\n';
  code += '      totalViolations: 0,\n';
  code += '      errors: 0,\n';
  code += '      warnings: 0,\n';
  code += '      info: 0,\n';
  code += '      fixable: 0,\n';
  code += '      violations: [],\n';
  code += '      languageBreakdown: {},\n';
  code += '    };\n\n';

  code += '    // Lint TypeScript/JavaScript files\n';
  code += '    if (this.languages.includes(\'typescript\') || this.languages.includes(\'javascript\')) {\n';
  code += '      const tsViolations = await this.lintTypeScript();\n';
  code += '      report.violations.push(...tsViolations);\n';
  code += '    }\n\n';

  code += '    // Lint Python files\n';
  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      const pyViolations = await this.lintPython();\n';
  code += '      report.violations.push(...pyViolations);\n';
  code += '    }\n\n';

  code += '    // Lint Go files\n';
  code += '    if (this.languages.includes(\'go\')) {\n';
  code += '      const goViolations = await this.lintGo();\n';
  code += '      report.violations.push(...goViolations);\n';
  code += '    }\n\n';

  code += '    // Calculate statistics\n';
  code += '    for (const violation of report.violations) {\n';
  code += '      report.totalViolations++;\n';
  code += '      if (violation.severity === \'error\') report.errors++;\n';
  code += '      else if (violation.severity === \'warning\') report.warnings++;\n';
  code += '      else if (violation.severity === \'info\') report.info++;\n';
  code += '      if (violation.fixable) report.fixable++;\n\n';

  code += '      report.languageBreakdown[violation.language] = (report.languageBreakdown[violation.language] || 0) + 1;\n';
  code += '    }\n\n';

  code += '    report.totalFiles = this.countFiles();\n\n';

  code += '    console.log(`[Linter] Found ${report.totalViolations} violations (${report.errors} errors, ${report.warnings} warnings)`);\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  async fix(violations: LintViolation[]): Promise<void> {\n';
  code += '    console.log(`[Linter] Auto-fixing ${violations.length} violations...`);\n\n';

  code += '    const fixableViolations = violations.filter(v => v.fixable);\n\n';

  code += '    // Group by language\n';
  code += '    const byLanguage: { [key: string]: LintViolation[] } = {};\n';
  code += '    for (const violation of fixableViolations) {\n';
  code += '      if (!byLanguage[violation.language]) byLanguage[violation.language] = [];\n';
  code += '      byLanguage[violation.language].push(violation);\n';
  code += '    }\n\n';

  code += '    // Fix by language\n';
  code += '    for (const [language, langViolations] of Object.entries(byLanguage)) {\n';
  code += '      if (language === \'typescript\' || language === \'javascript\') {\n';
  code += '        await this.fixTypeScript(langViolations);\n';
  code += '      } else if (language === \'python\') {\n';
  code += '        await this.fixPython(langViolations);\n';
  code += '      } else if (language === \'go\') {\n';
  code += '        await this.fixGo(langViolations);\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    console.log(\'[Linter] Auto-fix complete\');\n';
  code += '  }\n\n';

  code += '  generateReport(report: LintReport): string {\n';
  code += '    let output = \'\\n\';\n';
  code += '    output += \'=== Linting Report ===\\n\';\n';
  code += '    output += `Scan Time: ${report.scanTime}\\n`;\n';
  code += '    output += `Total Files: ${report.totalFiles}\\n`;\n';
  code += '    output += `Total Violations: ${report.totalViolations}\\n`;\n';
  code += '    output += `  Errors: ${report.errors}\\n`;\n';
  code += '    output += `  Warnings: ${report.warnings}\\n`;\n';
  code += '    output += `  Info: ${report.info}\\n`;\n';
  code += '    output += `  Fixable: ${report.fixable}\\n\\n`;\n\n';

  code += '    output += \'Violations by Language:\\n\';\n';
  code += '    for (const [lang, count] of Object.entries(report.languageBreakdown)) {\n';
  code += '      output += `  ${lang}: ${count}\\n`;\n';
  code += '    }\n\n';

  code += '    return output;\n';
  code += '  }\n\n';

  code += '  private async lintTypeScript(): Promise<LintViolation[]> {\n';
  code += '    const violations: LintViolation[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'eslint . --format json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const results = JSON.parse(output);\n';
  code += '      for (const file of results) {\n';
  code += '        for (const msg of file.messages) {\n';
  code += '          violations.push({\n';
  code += '            file: file.filePath,\n';
  code += '            line: msg.line,\n';
  code += '            column: msg.column,\n';
  code += '            ruleId: msg.ruleId,\n';
  code += '            message: msg.message,\n';
  code += '            severity: msg.severity === 2 ? \'error\' : msg.severity === 1 ? \'warning\' : \'info\',\n';
  code += '            language: \'typescript\',\n';
  code += '            fixable: msg.fixable || false,\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      // ESLint returns non-zero on violations\n';
  code += '      if (error.stdout) {\n';
  code += '        try {\n';
  code += '          const results = JSON.parse(error.stdout);\n';
  code += '          for (const file of results) {\n';
  code += '            for (const msg of file.messages) {\n';
  code += '            violations.push({\n';
  code += '              file: file.filePath,\n';
  code += '              line: msg.line,\n';
  code += '              column: msg.column,\n';
  code += '              ruleId: msg.ruleId,\n';
  code += '              message: msg.message,\n';
  code += '              severity: msg.severity === 2 ? \'error\' : \'warning\',\n';
  code += '              language: \'typescript\',\n';
  code += '              fixable: msg.fixable || false,\n';
  code += '            });\n';
  code += '          }\n';
  code += '        }\n';
  code += '        } catch (e) {\n';
  code += '          console.error(\'[Linter] Failed to parse ESLint output:\', error.message);\n';
  code += '        }\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return violations;\n';
  code += '  }\n\n';

  code += '  private async lintPython(): Promise<LintViolation[]> {\n';
  code += '    const violations: LintViolation[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'pylint . --output-format json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const results = JSON.parse(output);\n';
  code += '      for (const msg of results) {\n';
  code += '        violations.push({\n';
  code += '          file: msg.path,\n';
  code += '          line: msg.line,\n';
  code += '          column: msg.column,\n';
  code += '          ruleId: msg.messageId,\n';
  code += '          message: msg.message,\n';
  code += '          severity: msg.type === \'error\' ? \'error\' : \'warning\',\n';
  code += '          language: \'python\',\n';
  code += '          fixable: false,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Linter] Python linting failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return violations;\n';
  code += '  }\n\n';

  code += '  private async lintGo(): Promise<LintViolation[]> {\n';
  code += '    const violations: LintViolation[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'golangci-lint run --out-format json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n';

  code += '      const results = JSON.parse(output);\n';
  code += '      for (const issue of results.Issues) {\n';
  code += '        violations.push({\n';
  code += '          file: issue.FilePath(),\n';
  code += '          line: issue.Line(),\n';
  code += '          column: issue.Column(),\n';
  code += '          ruleId: issue.FromLinter,\n';
  code += '          message: issue.Text,\n';
  code += '          severity: \'warning\',\n';
  code += '          language: \'go\',\n';
  code += '          fixable: false,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Linter] Go linting failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return violations;\n';
  code += '  }\n\n';

  code += '  private async fixTypeScript(violations: LintViolation[]): Promise<void> {\n';
  code += '    try {\n';
  code += '      execSync(\'eslint . --fix\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Linter] Failed to auto-fix TypeScript:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async fixPython(violations: LintViolation[]): Promise<void> {\n';
  code += '    try {\n';
  code += '      execSync(\'autopep8 . --in-place --recursive\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Linter] Failed to auto-fix Python:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async fixGo(violations: LintViolation[]): Promise<void> {\n';
  code += '    try {\n';
  code += '      execSync(\'gofmt -w .\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Linter] Failed to auto-fix Go:\', error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private countFiles(): number {\n';
  code += '    let count = 0;\n';
  code += '    const countDir = (dir: string) => {\n';
  code += '      if (!fs.existsSync(dir)) return;\n';
  code += '      const entries = fs.readdirSync(dir, { withFileTypes: true });\n';
  code += '      for (const entry of entries) {\n';
  code += '        const fullPath = path.join(dir, entry.name);\n';
  code += '        if (entry.isDirectory() && entry.name !== \'node_modules\' && entry.name !== \'.git\') {\n';
  code += '          countDir(fullPath);\n';
  code += '        } else if (entry.isFile()) {\n';
  code += '          if (/\\.(ts|js|py|go)$/.test(entry.name)) {\n';
  code += '            count++;\n';
  code += '          }\n';
  code += '        }\n';
  code += '      }\n';
  code += '    };\n';
  code += '    countDir(this.projectRoot);\n';
  code += '    return count;\n';
  code += '  }\n\n';

  code += '  private initializeRules(): LintRule[] {\n';
  code += '    return [\n';
  code += '      {\n';
  code += '        id: \'no-console\',\n';
  code += '        name: \'No Console\',\n';
  code += '        description: \'Disallow console statements\',\n';
  code += '        severity: \'warning\',\n';
  code += '        category: \'best-practices\',\n';
  code += '        languages: [\'typescript\', \'javascript\'],\n';
  code += '        rule: \'no-console\',\n';
  code += '        fixable: false,\n';
  code += '      },\n';
  code += '      {\n';
  code += '        id: \'indent\',\n';
  code += '        name: \'Indentation\',\n';
  code += '        description: \'Enforce consistent indentation\',\n';
  code += '        severity: \'error\',\n';
  code += '        category: \'style\',\n';
  code += '        languages: [\'typescript\', \'javascript\', \'python\', \'go\'],\n';
  code += '        rule: \'indent\',\n';
  code += '        fixable: true,\n';
  code += '      },\n';
  code += '      {\n';
  code += '        id: \'unused-vars\',\n';
  code += '        name: \'Unused Variables\',\n';
  code += '        description: \'Disallow unused variables\',\n';
  code += '        severity: \'warning\',\n';
  code += '        category: \'variables\',\n';
  code += '        languages: [\'typescript\', \'javascript\', \'python\', \'go\'],\n';
  code += '        rule: \'no-unused-vars\',\n';
  code += '        fixable: true,\n';
  code += '      },\n';
  code += '    ];\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const linter = new UnifiedLinter({\n';
  code += '  languages: [\'typescript\', \'python\', \'go\'],\n';
  code += '  autoFix: false,\n';
  code += '});\n\n';

  code += 'export default linter;\n';
  code += 'export { UnifiedLinter, LintReport, LintViolation, LintRule };\n';

  return code;
}

export function generatePythonLinting(config: LintingConfig): string {
  let code = '# Auto-generated Linting Rules for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class LintViolation:\n';
  code += '    file: str\n';
  code += '    line: int\n';
  code += '    column: int\n';
  code += '    rule_id: str\n';
  code += '    message: str\n';
  code += '    severity: str\n';
  code += '    language: str\n';
  code += '    fixable: bool\n';
  code += '    suggestion: Optional[str] = None\n\n';

  code += '@dataclass\n';
  code += 'class LintReport:\n';
  code += '    scan_time: str\n';
  code += '    total_files: int\n';
  code += '    total_violations: int\n';
  code += '    errors: int\n';
  code += '    warnings: int\n';
  code += '    info: int\n';
  code += '    fixable: int\n';
  code += '    violations: List[LintViolation]\n';
  code += '    language_breakdown: Dict[str, int]\n\n';

  code += 'class UnifiedLinter:\n';
  code += '    def __init__(self, project_root: str = None, languages: List[str] = None, auto_fix: bool = False):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.languages = languages or ["typescript", "python", "go"]\n';
  code += '        self.auto_fix = auto_fix\n\n';

  code += '    async def lint(self) -> LintReport:\n';
  code += '        print("[Linter] Running unified linting...")\n\n';

  code += '        report = LintReport(\n';
  code += '            scan_time="",\n';
  code += '            total_files=0,\n';
  code += '            total_violations=0,\n';
  code += '            errors=0,\n';
  code += '            warnings=0,\n';
  code += '            info=0,\n';
  code += '            fixable=0,\n';
  code += '            violations=[],\n';
  code += '            language_breakdown={},\n';
  code += '        )\n\n';

  code += '        # Lint TypeScript/JavaScript\n';
  code += '        if "typescript" in self.languages or "javascript" in self.languages:\n';
  code += '            ts_violations = await self.lint_typescript()\n';
  code += '            report.violations.extend(ts_violations)\n\n';

  code += '        # Lint Python\n';
  code += '        if "python" in self.languages:\n';
  code += '            py_violations = await self.lint_python()\n';
  code += '            report.violations.extend(py_violations)\n\n';

  code += '        # Calculate statistics\n';
  code += '        for violation in report.violations:\n';
  code += '            report.total_violations += 1\n';
  code += '            if violation.severity == "error":\n';
  code += '                report.errors += 1\n';
  code += '            elif violation.severity == "warning":\n';
  code += '                report.warnings += 1\n';
  code += '            elif violation.severity == "info":\n';
  code += '                report.info += 1\n';
  code += '            if violation.fixable:\n';
  code += '                report.fixable += 1\n\n';

  code += '            report.language_breakdown[violation.language] = \\\n';
  code += '                report.language_breakdown.get(violation.language, 0) + 1\n\n';

  code += '        report.total_files = self.count_files()\n\n';

  code += '        print(f"[Linter] Found {report.total_violations} violations")\n\n';

  code += '        return report\n\n';

  code += '    async def lint_typescript(self) -> List[LintViolation]:\n';
  code += '        violations = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["eslint", ".", "--format", "json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n\n';

  code += '            if result.stdout:\n';
  code += '                results = json.loads(result.stdout)\n';
  code += '                for file in results:\n';
  code += '                    for msg in file.get("messages", []):\n';
  code += '                        violations.append(LintViolation(\n';
  code += '                            file=file.get("filePath", ""),\n';
  code += '                            line=msg.get("line", 0),\n';
  code += '                            column=msg.get("column", 0),\n';
  code += '                            rule_id=msg.get("ruleId", ""),\n';
  code += '                            message=msg.get("message", ""),\n';
  code += '                            severity="error" if msg.get("severity") == 2 else "warning",\n';
  code += '                            language="typescript",\n';
  code += '                            fixable=msg.get("fixable", False),\n';
  code += '                        ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Linter] TypeScript linting failed: {e}")\n\n';

  code += '        return violations\n\n';

  code += '    async def lint_python(self) -> List[LintViolation]:\n';
  code += '        violations = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["pylint", ".", "--output-format=json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n\n';

  code += '            if result.stdout:\n';
  code += '                results = json.loads(result.stdout)\n';
  code += '                for msg in results:\n';
  code += '                    violations.append(LintViolation(\n';
  code += '                        file=msg.get("path", ""),\n';
  code += '                        line=msg.get("line", 0),\n';
  code += '                        column=msg.get("column", 0),\n';
  code += '                        rule_id=msg.get("messageId", ""),\n';
  code += '                        message=msg.get("message", ""),\n';
  code += '                        severity="error" if msg.get("type") == "error" else "warning",\n';
  code += '                        language="python",\n';
  code += '                        fixable=False,\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Linter] Python linting failed: {e}")\n\n';

  code += '        return violations\n\n';

  code += '    def count_files(self) -> int:\n';
  code += '        count = 0\n';
  code += '        for file_path in self.project_root.rglob("*.ts"):\n';
  code += '            if "node_modules" not in str(file_path):\n';
  code += '                count += 1\n';
  code += '        return count\n\n';

  code += 'linter = UnifiedLinter(\n';
  code += '    languages=["typescript", "python", "go"],\n';
  code += '    auto_fix=False,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: LintingConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptLinting(config);
  fs.writeFileSync(path.join(outputDir, 'linting-rules.ts'), tsCode);

  const pyCode = generatePythonLinting(config);
  fs.writeFileSync(path.join(outputDir, 'linting-rules.py'), pyCode);

  const md = generateLintingMD(config);
  fs.writeFileSync(path.join(outputDir, 'LINTING_RULES.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Unified linting rules',
    main: 'linting-rules.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'linting-config.json'), JSON.stringify(config, null, 2));
}
