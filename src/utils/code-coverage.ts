// Auto-generated Code Coverage Reporting
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CoverageData {
  language: string;
  file: string;
  linesCovered: number;
  linesTotal: number;
  functionsCovered: number;
  functionsTotal: number;
  branchesCovered: number;
  branchesTotal: number;
  percentage: number;
}

interface CoverageReport {
  scanTime: string;
  overallCoverage: number;
  totalLines: number;
  coveredLines: number;
  totalFiles: number;
  byLanguage: { [key: string]: number };
  byFile: CoverageData[];
  lowCoverageFiles: CoverageData[];
  recommendations: string[];
}

interface CoverageConfig {
  projectName: string;
  languages: string[];
  threshold: number;
}

export function displayConfig(config: CoverageConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Code Coverage Reporting');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Languages:', config.languages.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Threshold:', config.threshold, '%');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateCoverageMD(config: CoverageConfig): string {
  let md = '# Code Coverage Reporting\n\n';
  md += '## Features\n\n';
  md += '- Cross-language coverage tracking\n';
  md += '- Line, branch, and function coverage\n';
  md += '- Unified dashboard generation\n';
  md += '- Threshold enforcement\n';
  md += '- Low coverage detection\n';
  md += '- Improvement recommendations\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import coverage from \'./code-coverage\';\n\n';
  md += '// Generate coverage report\n';
  md += 'const report = await coverage.generate();\n\n';
  md += '// View overall coverage\n';
  md += 'console.log(`Overall: ${report.overallCoverage}%`);\n\n';
  md += '// Check low coverage files\n';
  md += 'report.lowCoverageFiles.forEach(f => console.log(f.file));\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptCoverage(config: CoverageConfig): string {
  let code = '// Auto-generated Code Coverage for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface CoverageData {\n';
  code += '  language: string;\n';
  code += '  file: string;\n';
  code += '  linesCovered: number;\n';
  code += '  linesTotal: number;\n';
  code += '  functionsCovered: number;\n';
  code += '  functionsTotal: number;\n';
  code += '  branchesCovered: number;\n';
  code += '  branchesTotal: number;\n';
  code += '  percentage: number;\n';
  code += '}\n\n';

  code += 'interface CoverageReport {\n';
  code += '  scanTime: string;\n';
  code += '  overallCoverage: number;\n';
  code += '  totalLines: number;\n';
  code += '  coveredLines: number;\n';
  code += '  totalFiles: number;\n';
  code += '  byLanguage: { [key: string]: number };\n';
  code += '  byFile: CoverageData[];\n';
  code += '  lowCoverageFiles: CoverageData[];\n';
  code += '  recommendations: string[];\n';
  code += '}\n\n';

  code += 'class CodeCoverageReporter {\n';
  code += '  private projectRoot: string;\n';
  code += '  private languages: string[];\n';
  code += '  private threshold: number;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.languages = options.languages || [\'typescript\', \'python\', \'go\'];\n';
  code += '    this.threshold = options.threshold || 80;\n';
  code += '  }\n\n';

  code += '  async generate(): Promise<CoverageReport> {\n';
  code += '    console.log(\'[Coverage Reporter] Generating code coverage report...\');\n\n';

  code += '    const report: CoverageReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      overallCoverage: 0,\n';
  code += '      totalLines: 0,\n';
  code += '      coveredLines: 0,\n';
  code += '      totalFiles: 0,\n';
  code += '      byLanguage: {},\n';
  code += '      byFile: [],\n';
  code += '      lowCoverageFiles: [],\n';
  code += '      recommendations: [],\n';
  code += '    };\n\n';

  code += '    // Collect TypeScript coverage\n';
  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      const tsCoverage = await this.collectTypeScriptCoverage();\n';
  code += '      report.byFile.push(...tsCoverage);\n';
  code += '    }\n\n';

  code += '    // Collect Python coverage\n';
  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      const pyCoverage = await this.collectPythonCoverage();\n';
  code += '      report.byFile.push(...pyCoverage);\n';
  code += '    }\n\n';

  code += '    // Calculate totals\n';
  code += '    for (const coverage of report.byFile) {\n';
  code += '      report.totalLines += coverage.linesTotal;\n';
  code += '      report.coveredLines += coverage.linesCovered;\n';
  code += '      report.byLanguage[coverage.language] = (report.byLanguage[coverage.language] || 0) + coverage.percentage;\n';
  code += '    }\n\n';

  code += '    report.totalFiles = report.byFile.length;\n';
  code += '    report.overallCoverage = report.totalLines > 0 ? Math.round((report.coveredLines / report.totalLines) * 100) : 0;\n\n';

  code += '    // Find low coverage files\n';
  code += '    report.lowCoverageFiles = report.byFile.filter(f => f.percentage < this.threshold);\n\n';

  code += '    // Generate recommendations\n';
  code += '    report.recommendations = this.generateRecommendations(report);\n\n';

  code += '    console.log(`[Coverage Reporter] Overall coverage: ${report.overallCoverage}%`);\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  private async collectTypeScriptCoverage(): Promise<CoverageData[]> {\n';
  code += '    const coverage: CoverageData[] = [];\n\n';

  code += '    try {\n';
  code += '      // Run istanbul/nyc for coverage\n';
  code += '      execSync(\'npm test -- --coverage\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n\n';

  code += '      // Read coverage output\n';
  code += '      const coveragePath = path.join(this.projectRoot, \'coverage\', \'coverage-final.json\');\n';
  code += '      if (fs.existsSync(coveragePath)) {\n';
  code += '        const coverageData = JSON.parse(fs.readFileSync(coveragePath, \'utf-8\'));\n\n';

  code += '        for (const [file, data] of Object.entries(coverageData)) {\n';
  code += '          if (data.path) {\n';
  code += '            const lines = data.l || {};\n';
  code += '            let linesCovered = 0;\n';
  code += '            let linesTotal = 0;\n\n';

  code += '            for (const [lineNum, hitCount] of Object.entries(lines)) {\n';
  code += '              if (hitCount > 0) linesCovered++;\n';
  code += '              linesTotal++;\n';
  code += '            }\n\n';

  code += '            coverage.push({\n';
  code += '              language: \'typescript\',\n';
  code += '              file: data.path,\n';
  code += '              linesCovered,\n';
  code += '              linesTotal,\n';
  code += '              functionsCovered: 0,\n';
  code += '              functionsTotal: 0,\n';
  code += '              branchesCovered: 0,\n';
  code += '              branchesTotal: 0,\n';
  code += '              percentage: linesTotal > 0 ? Math.round((linesCovered / linesTotal) * 100) : 0,\n';
  code += '            });\n';
  code += '          }\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Coverage Reporter] TypeScript coverage collection failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return coverage;\n';
  code += '  }\n\n';

  code += '  private async collectPythonCoverage(): Promise<CoverageData[]> {\n';
  code += '    const coverage: CoverageData[] = [];\n\n';

  code += '    try {\n';
  code += '      // Run pytest with coverage\n';
  code += '      execSync(\'pytest --cov=. --cov-report=json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n\n';

  code += '      // Read coverage output\n';
  code += '      const coveragePath = path.join(this.projectRoot, \'coverage.json\');\n';
  code += '      if (fs.existsSync(coveragePath)) {\n';
  code += '        const coverageData = JSON.parse(fs.readFileSync(coveragePath, \'utf-8\'));\n';
  code += '        const files = coverageData.files || {};\n\n';

  code += '        for (const [filePath, data] of Object.entries(files)) {\n';
  code += '          const summary = data.summary || {};\n';
  code += '          coverage.push({\n';
  code += '            language: \'python\',\n';
  code += '            file: filePath,\n';
  code += '            linesCovered: summary.num_covered_lines || 0,\n';
  code += '            linesTotal: summary.num_statements || 0,\n';
  code += '            functionsCovered: summary.num_covered_functions || 0,\n';
  code += '            functionsTotal: summary.num_functions || 0,\n';
  code += '            branchesCovered: 0,\n';
  code += '            branchesTotal: 0,\n';
  code += '            percentage: summary.percent_covered || 0,\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Coverage Reporter] Python coverage collection failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return coverage;\n';
  code += '  }\n\n';

  code += '  private generateRecommendations(report: CoverageReport): string[] {\n';
  code += '    const recommendations: string[] = [];\n\n';

  code += '    if (report.overallCoverage < this.threshold) {\n';
  code += '      recommendations.push(`Overall coverage (${report.overallCoverage}%) is below threshold (${this.threshold}%). Add more tests.`);\n';
  code += '    }\n\n';

  code += '    if (report.lowCoverageFiles.length > 0) {\n';
  code += '      recommendations.push(`${report.lowCoverageFiles.length} files have low coverage. Prioritize testing these files.`);\n';
  code += '    }\n\n';

  code += '    return recommendations;\n';
  code += '  }\n';

  code += '  generateDashboard(report: CoverageReport): string {\n';
  code += '    let dashboard = \'\\n\';\n';
  code += '    dashboard += \'=== Code Coverage Dashboard ===\\n\';\n';
  code += '    dashboard += `Overall Coverage: ${report.overallCoverage}%\\n`;\n';
  code += '    dashboard += `Total Lines: ${report.totalLines}\\n`;\n';
  code += '    dashboard += `Covered Lines: ${report.coveredLines}\\n`;\n';
  code += '    dashboard += `Total Files: ${report.totalFiles}\\n\\n\';\n';

  code += '    dashboard += \'Coverage by Language:\\n\';\n';
  code += '    for (const [lang, pct] of Object.entries(report.byLanguage)) {\n';
  code += '      dashboard += `  ${lang}: ${pct}%\\n`;\n';
  code += '    }\n\n';

  code += '    return dashboard;\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const coverageReporter = new CodeCoverageReporter({\n';
  code += '  languages: [\'typescript\', \'python\', \'go\'],\n';
  code += '  threshold: 80,\n';
  code += '});\n\n';

  code += 'export default coverageReporter;\n';
  code += 'export { CodeCoverageReporter, CoverageReport, CoverageData };\n';

  return code;
}

export function generatePythonCoverage(config: CoverageConfig): string {
  let code = '# Auto-generated Code Coverage for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class CoverageData:\n';
  code += '    language: str\n';
  code += '    file: str\n';
  code += '    lines_covered: int\n';
  code += '    lines_total: int\n';
  code += '    functions_covered: int\n';
  code += '    functions_total: int\n';
  code += '    branches_covered: int\n';
  code += '    branches_total: int\n';
  code += '    percentage: int\n\n';

  code += '@dataclass\n';
  code += 'class CoverageReport:\n';
  code += '    scan_time: str\n';
  code += '    overall_coverage: int\n';
  code += '    total_lines: int\n';
  code += '    covered_lines: int\n';
  code += '    total_files: int\n';
  code += '    by_language: Dict[str, int]\n';
  code += '    by_file: List[CoverageData]\n';
  code += '    low_coverage_files: List[CoverageData]\n';
  code += '    recommendations: List[str]\n\n';

  code += 'class CodeCoverageReporter:\n';
  code += '    def __init__(self, project_root: str = None, languages: List[str] = None, threshold: int = 80):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.languages = languages or ["typescript", "python", "go"]\n';
  code += '        self.threshold = threshold\n';

  code += '    async def generate(self) -> CoverageReport:\n';
  code += '        print("[Coverage Reporter] Generating code coverage report...")\n';

  code += '        report = CoverageReport(\n';
  code += '            scan_time="",\n';
  code += '            overall_coverage=0,\n';
  code += '            total_lines=0,\n';
  code += '            covered_lines=0,\n';
  code += '            total_files=0,\n';
  code += '            by_language={},\n';
  code += '            by_file=[],\n';
  code += '            low_coverage_files=[],\n';
  code += '            recommendations=[],\n';
  code += '        )\n';

  code += '        if "typescript" in self.languages:\n';
  code += '            ts_coverage = await self.collect_typescript_coverage()\n';
  code += '            report.by_file.extend(ts_coverage)\n';

  code += '        if "python" in self.languages:\n';
  code += '            py_coverage = await self.collect_python_coverage()\n';
  code += '            report.by_file.extend(py_coverage)\n';

  code += '        # Calculate totals\n';
  code += '        for coverage in report.by_file:\n';
  code += '            report.total_lines += coverage.lines_total\n';
  code += '            report.covered_lines += coverage.lines_covered\n';
  code += '            report.by_language[coverage.language] = \\\n';
  code += '                report.by_language.get(coverage.language, 0) + coverage.percentage\n';

  code += '        report.total_files = len(report.by_file)\n';
  code += '        report.overall_coverage = int((report.covered_lines / report.total_lines * 100) if report.total_lines > 0 else 0)\n';

  code += '        report.low_coverage_files = [f for f in report.by_file if f.percentage < self.threshold]\n';
  code += '        report.recommendations = self.generate_recommendations(report)\n';

  code += '        print(f"[Coverage Reporter] Overall coverage: {report.overall_coverage}%")\n';

  code += '        return report\n';

  code += '    async def collect_typescript_coverage(self) -> List[CoverageData]:\n';
  code += '        coverage = []\n\n';

  code += '        try:\n';
  code += '            subprocess.run(\n';
  code += '                ["npm", "test", "--", "--coverage"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '            )\n';

  code += '            coverage_path = self.project_root / "coverage" / "coverage-final.json"\n';
  code += '            if coverage_path.exists():\n';
  code += '                data = json.loads(coverage_path.read_text())\n';

  code += '                for file_path, file_data in data.items():\n';
  code += '                    if file_data.get("path"):\n';
  code += '                        lines = file_data.get("l", {})\n';
  code += '                        lines_covered = sum(1 for v in lines.values() if v > 0)\n';
  code += '                        lines_total = len(lines)\n\n';
  code += '                        coverage.append(CoverageData(\n';
  code += '                            language="typescript",\n';
  code += '                            file=file_data["path"],\n';
  code += '                            lines_covered=lines_covered,\n';
  code += '                            lines_total=lines_total,\n';
  code += '                            functions_covered=0,\n';
  code += '                            functions_total=0,\n';
  code += '                            branches_covered=0,\n';
  code += '                            branches_total=0,\n';
  code += '                            percentage=int((lines_covered / lines_total * 100)) if lines_total > 0 else 0,\n';
  code += '                        ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Coverage Reporter] TypeScript coverage failed: {e}")\n';

  code += '        return coverage\n';

  code += '    def generate_recommendations(self, report: CoverageReport) -> List[str]:\n';
  code += '        recommendations = []\n';

  code += '        if report.overall_coverage < self.threshold:\n';
  code += '            recommendations.append(f"Overall coverage ({report.overall_coverage}%) is below threshold ({self.threshold}%). Add more tests.")\n';

  code += '        if len(report.low_coverage_files) > 0:\n';
  code += '            recommendations.append(f"{len(report.low_coverage_files)} files have low coverage. Prioritize testing these files.")\n';

  code += '        return recommendations\n';

  code += 'coverage_reporter = CodeCoverageReporter(\n';
  code += '    languages=["typescript", "python", "go"],\n';
  code += '    threshold=80,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: CoverageConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptCoverage(config);
  fs.writeFileSync(path.join(outputDir, 'code-coverage.ts'), tsCode);

  const pyCode = generatePythonCoverage(config);
  fs.writeFileSync(path.join(outputDir, 'code-coverage.py'), pyCode);

  const md = generateCoverageMD(config);
  fs.writeFileSync(path.join(outputDir, 'CODE_COVERAGE.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Code coverage reporting',
    main: 'code-coverage.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'coverage-config.json'), JSON.stringify(config, null, 2));
}
