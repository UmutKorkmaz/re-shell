// Auto-generated Code Quality Metrics
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface QualityMetric {
  name: string;
  value: number;
  maxScore: number;
  weight: number;
  category: 'complexity' | 'maintainability' | 'reliability' | 'security' | 'performance';
  description: string;
}

interface FileMetrics {
  file: string;
  language: string;
  linesOfCode: number;
  complexity: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  duplication: number;
  testCoverage: number;
  issues: number;
}

interface QualityReport {
  scanTime: string;
  overallScore: number;
  categoryScores: {
    complexity: number;
    maintainability: number;
    reliability: number;
    security: number;
    performance: number;
  };
  fileCount: number;
  totalLines: number;
  avgComplexity: number;
  avgMaintainability: number;
  totalDebt: number;
  fileMetrics: FileMetrics[];
  recommendations: string[];
}

interface QualityConfig {
  projectName: string;
  languages: string[];
  thresholds: {
    complexity: number;
    maintainability: number;
    coverage: number;
  };
}

export function displayConfig(config: QualityConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Code Quality Metrics');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Languages:', config.languages.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'Complexity Threshold:', config.thresholds.complexity);
  console.log('\x1b[33m%s\x1b[0m', 'Maintainability Threshold:', config.thresholds.maintainability);
  console.log('\x1b[33m%s\x1b[0m', 'Coverage Threshold:', config.thresholds.coverage);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateQualityMD(config: QualityConfig): string {
  let md = '# Code Quality Metrics\n\n';
  md += '## Features\n\n';
  md += '- Cross-language quality metrics\n';
  md += '- Standardized scoring (0-100)\n';
  md += '- Complexity analysis\n';
  md += '- Maintainability index\n';
  md += '- Technical debt tracking\n';
  md += '- Code duplication detection\n';
  md += '- Test coverage reporting\n';
  md += '- Recommendations for improvement\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import quality from \'./code-quality-metrics\';\n\n';
  md += '// Analyze code quality\n';
  md += 'const report = await quality.analyze();\n\n';
  md += '// Get overall score\n';
  md += 'console.log(`Overall Score: ${report.overallScore}/100`);\n\n';
  md += '// View recommendations\n';
  md += 'report.recommendations.forEach(rec => console.log(rec));\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptQuality(config: QualityConfig): string {
  let code = '// Auto-generated Quality Metrics for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface QualityMetric {\n';
  code += '  name: string;\n';
  code += '  value: number;\n';
  code += '  maxScore: number;\n';
  code += '  weight: number;\n';
  code += '  category: \'complexity\' | \'maintainability\' | \'reliability\' | \'security\' | \'performance\';\n';
  code += '  description: string;\n';
  code += '}\n\n';

  code += 'interface FileMetrics {\n';
  code += '  file: string;\n';
  code += '  language: string;\n';
  code += '  linesOfCode: number;\n';
  code += '  complexity: number;\n';
  code += '  maintainabilityIndex: number;\n';
  code += '  technicalDebt: number;\n';
  code += '  duplication: number;\n';
  code += '  testCoverage: number;\n';
  code += '  issues: number;\n';
  code += '}\n\n';

  code += 'interface QualityReport {\n';
  code += '  scanTime: string;\n';
  code += '  overallScore: number;\n';
  code += '  categoryScores: {\n';
  code += '    complexity: number;\n';
  code += '    maintainability: number;\n';
  code += '    reliability: number;\n';
  code += '    security: number;\n';
  code += '    performance: number;\n';
  code += '  };\n';
  code += '  fileCount: number;\n';
  code += '  totalLines: number;\n';
  code += '  avgComplexity: number;\n';
  code += '  avgMaintainability: number;\n';
  code += '  totalDebt: number;\n';
  code += '  fileMetrics: FileMetrics[];\n';
  code += '  recommendations: string[];\n';
  code += '}\n\n';

  code += 'class CodeQualityAnalyzer {\n';
  code += '  private projectRoot: string;\n';
  code += '  private languages: string[];\n';
  code += '  private thresholds: any;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.languages = options.languages || [\'typescript\', \'python\', \'go\'];\n';
  code += '    this.thresholds = options.thresholds || {\n';
  code += '      complexity: 10,\n';
  code += '      maintainability: 50,\n';
  code += '      coverage: 80,\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  async analyze(): Promise<QualityReport> {\n';
  code += '    console.log(\'[Quality Analyzer] Analyzing code quality...\');\n\n';

  code += '    const report: QualityReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      overallScore: 0,\n';
  code += '      categoryScores: {\n';
  code += '        complexity: 0,\n';
  code += '        maintainability: 0,\n';
  code += '        reliability: 0,\n';
  code += '        security: 0,\n';
  code += '        performance: 0,\n';
  code += '      },\n';
  code += '      fileCount: 0,\n';
  code += '      totalLines: 0,\n';
  code += '      avgComplexity: 0,\n';
  code += '      avgMaintainability: 0,\n';
  code += '      totalDebt: 0,\n';
  code += '      fileMetrics: [],\n';
  code += '      recommendations: [],\n';
  code += '    };\n\n';

  code += '    // Analyze TypeScript files\n';
  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      const tsMetrics = await this.analyzeTypeScript();\n';
  code += '      report.fileMetrics.push(...tsMetrics);\n';
  code += '    }\n\n';

  code += '    // Analyze Python files\n';
  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      const pyMetrics = await this.analyzePython();\n';
  code += '      report.fileMetrics.push(...pyMetrics);\n';
  code += '    }\n\n';

  code += '    // Calculate scores\n';
  code += '    report.overallScore = this.calculateOverallScore(report.fileMetrics);\n';
  code += '    report.categoryScores = this.calculateCategoryScores(report.fileMetrics);\n\n';

  code += '    // Calculate averages\n';
  code += '    report.fileCount = report.fileMetrics.length;\n';
  code += '    report.totalLines = report.fileMetrics.reduce((sum, m) => sum + m.linesOfCode, 0);\n';
  code += '    report.avgComplexity = report.totalLines > 0 ? report.fileMetrics.reduce((sum, m) => sum + m.complexity, 0) / report.fileCount : 0;\n';
  code += '    report.avgMaintainability = report.totalLines > 0 ? report.fileMetrics.reduce((sum, m) => sum + m.maintainabilityIndex, 0) / report.fileCount : 0;\n';
  code += '    report.totalDebt = report.fileMetrics.reduce((sum, m) => sum + m.technicalDebt, 0);\n\n';

  code += '    // Generate recommendations\n';
  code += '    report.recommendations = this.generateRecommendations(report);\n\n';

  code += '    console.log(`[Quality Analyzer] Overall Score: ${report.overallScore}/100`);\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  private async analyzeTypeScript(): Promise<FileMetrics[]> {\n';
  code += '    const metrics: FileMetrics[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'npx complexity-report . --format json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const results = JSON.parse(output);\n';
  code += '      for (const file of results.reports) {\n';
  code += '        metrics.push({\n';
  code += '          file: file.path,\n';
  code += '          language: \'typescript\',\n';
  code += '          linesOfCode: file.lines || 0,\n';
  code += '          complexity: file.complexity || 0,\n';
  code += '          maintainabilityIndex: this.calculateMaintainability(file.complexity, file.lines),\n';
  code += '          technicalDebt: this.calculateDebt(file.complexity),\n';
  code += '          duplication: file.duplicateLines || 0,\n';
  code += '          testCoverage: file.coverage || 0,\n';
  code += '          issues: file.violations || 0,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Quality Analyzer] TypeScript analysis failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return metrics;\n';
  code += '  }\n\n';

  code += '  private async analyzePython(): Promise<FileMetrics[]> {\n';
  code += '    const metrics: FileMetrics[] = [];\n\n';

  code += '    try {\n';
  code += '      const output = execSync(\'radon cc . --json\', {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';

  code += '      const results = JSON.parse(output);\n';
  code += '      for (const [file, data] of Object.entries(results)) {\n';
  code += '        metrics.push({\n';
  code += '          file,\n';
  code += '          language: \'python\',\n';
  code='          linesOfCode: 0,';
  code += '          complexity: data.averageComplexity || 0,\n';
  code += '          maintainabilityIndex: data.mi || 50,\n';
  code += '          technicalDebt: this.calculateDebt(data.averageComplexity),\n';
  code += '          duplication: 0,\n';
  code += '          testCoverage: 0,\n';
  code += '          issues: 0,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Quality Analyzer] Python analysis failed:\', error.message);\n';
  code += '    }\n\n';

  code += '    return metrics;\n';
  code += '  }\n\n';

  code += '  private calculateOverallScore(metrics: FileMetrics[]): number {\n';
  code += '    if (metrics.length === 0) return 0;\n\n';

  code += '    let totalScore = 0;\n';

  code += '    for (const m of metrics) {\n';
  code += '      // Complexity score (lower is better)\n';
  code += '      const complexityScore = Math.max(0, 100 - (m.complexity / this.thresholds.complexity) * 100);\n\n';

  code += '      // Maintainability score (higher is better)\n';
  code += '      const maintainabilityScore = m.maintainabilityIndex;\n\n';

  code += '      // Coverage score (higher is better)\n';
  code += '      const coverageScore = m.testCoverage;\n\n';

  code += '      // Average\n';
  code += '      totalScore += (complexityScore + maintainabilityScore + coverageScore) / 3;\n';
  code += '    }\n\n';

  code += '    return Math.round(totalScore / metrics.length);\n';
  code += '  }\n\n';

  code += '  private calculateCategoryScores(metrics: FileMetrics[]): any {\n';
  code += '    const scores = {\n';
  code += '      complexity: 0,\n';
  code += '      maintainability: 0,\n';
  code += '      reliability: 0,\n';
  code += '      security: 0,\n';
  code += '      performance: 0,\n';
  code += '    };\n\n';

  code += '    for (const m of metrics) {\n';
  code += '      scores.complexity += Math.max(0, 100 - (m.complexity / 10) * 100);\n';
  code += '      scores.maintainability += m.maintainabilityIndex;\n';
  code += '      scores.reliability += 100 - (m.issues * 5);\n';
  code += '      scores.security += 100;\n';
  code += '      scores.performance += 100 - (m.duplication * 2);\n';
  code += '    }\n\n';

  code += '    const count = metrics.length || 1;\n';
  code += '    return {\n';
  code += '      complexity: Math.round(scores.complexity / count),\n';
  code += '      maintainability: Math.round(scores.maintainability / count),\n';
  code += '      reliability: Math.max(0, Math.round(scores.reliability / count)),\n';
  code += '      security: Math.round(scores.security / count),\n';
  code += '      performance: Math.max(0, Math.round(scores.performance / count)),\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  private calculateMaintainability(complexity: number, lines: number): number {\n';
  code += '    // Maintainability Index (simplified)\n';
  code += '    const mi = Math.max(0, (171 - 5.2 * Math.log(complexity) - 0.23 * complexity - 16.2 * Math.log(lines)) * 100 / 171);\n';
  code += '    return Math.round(mi);\n';
  code += '  }\n\n';

  code += '  private calculateDebt(complexity: number): number {\n';
  code += '    // Technical debt in minutes (simplified)\n';
  code += '    return complexity > 10 ? (complexity - 10) * 5 : 0;\n';
  code += '  }\n\n';

  code += '  private generateRecommendations(report: QualityReport): string[] {\n';
  code += '    const recommendations: string[] = [];\n\n';

  code += '    if (report.categoryScores.complexity < 70) {\n';
  code += '      recommendations.push(\'Reduce code complexity by extracting smaller functions and reducing nesting\');\n';
  code += '    }\n\n';

  code += '    if (report.categoryScores.maintainability < 70) {\n';
  code += '      recommendations.push(\'Improve maintainability by adding documentation and refactoring large functions\');\n';
  code += '    }\n\n';

  code += '    if (report.avgComplexity > this.thresholds.complexity) {\n';
  code += '      recommendations.push(`Average complexity (${report.avgComplexity.toFixed(1)}) exceeds threshold (${this.thresholds.complexity})`);\n';
  code += '    }\n\n';

  code += '    if (report.totalDebt > 100) {\n';
  code += '      recommendations.push(`High technical debt detected: ${Math.round(report.totalDebt / 60)} hours. Prioritize refactoring.`);\n';
  code += '    }\n\n';

  code += '    return recommendations;\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const qualityAnalyzer = new CodeQualityAnalyzer({\n';
  code += '  languages: [\'typescript\', \'python\', \'go\'],\n';
  code += '  thresholds: {\n';
  code += '    complexity: 10,\n';
  code += '    maintainability: 50,\n';
  code += '    coverage: 80,\n';
  code += '  },\n';
  code += '});\n\n';

  code += 'export default qualityAnalyzer;\n';
  code += 'export { CodeQualityAnalyzer, QualityReport, FileMetrics, QualityMetric };\n';

  return code;
}

export function generatePythonQuality(config: QualityConfig): string {
  let code = '# Auto-generated Quality Metrics for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'import math\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class FileMetrics:\n';
  code += '    file: str\n';
  code += '    language: str\n';
  code += '    lines_of_code: int\n';
  code += '    complexity: int\n';
  code += '    maintainability_index: int\n';
  code += '    technical_debt: int\n';
  code += '    duplication: int\n';
  code += '    test_coverage: int\n';
  code += '    issues: int\n\n';

  code += '@dataclass\n';
  code += 'class QualityReport:\n';
  code += '    scan_time: str\n';
  code += '    overall_score: int\n';
  code += '    category_scores: Dict[str, int]\n';
  code += '    file_count: int\n';
  code += '    total_lines: int\n';
  code += '    avg_complexity: float\n';
  code += '    avg_maintainability: float\n';
  code += '    total_debt: int\n';
  code += '    file_metrics: List[FileMetrics]\n';
  code += '    recommendations: List[str]\n\n';

  code += 'class CodeQualityAnalyzer:\n';
  code += '    def __init__(self, project_root: str = None, languages: List[str] = None, thresholds: Dict = None):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.languages = languages or ["typescript", "python", "go"]\n';
  code += '        self.thresholds = thresholds or {"complexity": 10, "maintainability": 50, "coverage": 80}\n\n';

  code += '    async def analyze(self) -> QualityReport:\n';
  code += '        print("[Quality Analyzer] Analyzing code quality...")\n\n';

  code += '        report = QualityReport(\n';
  code += '            scan_time="",\n';
  code += '            overall_score=0,\n';
  code += '            category_scores={},\n';
  code += '            file_count=0,\n';
  code += '            total_lines=0,\n';
  code += '            avg_complexity=0.0,\n';
  code += '            avg_maintainability=0.0,\n';
  code += '            total_debt=0,\n';
  code += '            file_metrics=[],\n';
  code += '            recommendations=[],\n';
  code += '        )\n\n';

  code += '        # Analyze TypeScript\n';
  code += '        if "typescript" in self.languages:\n';
  code += '            ts_metrics = await self.analyze_typescript()\n';
  code += '            report.file_metrics.extend(ts_metrics)\n\n';

  code += '        # Calculate scores\n';
  code += '        report.overall_score = self.calculate_overall_score(report.file_metrics)\n';
  code += '        report.category_scores = self.calculate_category_scores(report.file_metrics)\n\n';

  code += '        # Calculate statistics\n';
  code += '        report.file_count = len(report.file_metrics)\n';
  code += '        report.total_lines = sum(m.lines_of_code for m in report.file_metrics)\n';
  code += '        report.avg_complexity = sum(m.complexity for m in report.file_metrics) / report.file_count if report.file_count > 0 else 0\n';
  code += '        report.avg_maintainability = sum(m.maintainability_index for m in report.file_metrics) / report.file_count if report.file_count > 0 else 0\n';
  code += '        report.total_debt = sum(m.technical_debt for m in report.file_metrics)\n\n';

  code += '        # Generate recommendations\n';
  code += '        report.recommendations = self.generate_recommendations(report)\n\n';

  code += '        print(f"[Quality Analyzer] Overall Score: {report.overall_score}/100")\n\n';

  code += '        return report\n\n';

  code += '    async def analyze_typescript(self) -> List[FileMetrics]:\n';
  code += '        metrics = []\n\n';

  code += '        try:\n';
  code += '            result = subprocess.run(\n';
  code += '                ["npx", "complexity-report", ".", "--format", "json"],\n';
  code += '                cwd=self.project_root,\n';
  code += '                capture_output=True,\n';
  code += '                text=True\n';
  code += '            )\n\n';

  code += '            if result.stdout:\n';
  code += '                results = json.loads(result.stdout)\n';
  code += '                for file in results.get("reports", []):\n';
  code += '                    metrics.append(FileMetrics(\n';
  code += '                        file=file.get("path", ""),\n';
  code += '                        language="typescript",\n';
  code += '                        lines_of_code=file.get("lines", 0),\n';
  code += '                        complexity=file.get("complexity", 0),\n';
  code += '                        maintainability_index=0,\n';
  code += '                        technical_debt=0,\n';
  code += '                        duplication=file.get("duplicateLines", 0),\n';
  code += '                        test_coverage=file.get("coverage", 0),\n';
  code += '                        issues=file.get("violations", 0),\n';
  code += '                    ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Quality Analyzer] TypeScript analysis failed: {e}")\n\n';

  code += '        return metrics\n\n';

  code += '    def calculate_overall_score(self, metrics: List[FileMetrics]) -> int:\n';
  code += '        if not metrics:\n';
  code += '            return 0\n\n';

  code += '        total_score = 0\n';

  code += '        for m in metrics:\n';
  code += '            complexity_score = max(0, 100 - (m.complexity / self.thresholds["complexity"]) * 100)\n';
  code += '            maintainability_score = m.maintainability_index\n';
  code += '            coverage_score = m.test_coverage\n';
  code += '            total_score += (complexity_score + maintainability_score + coverage_score) / 3\n\n';

  code += '        return int(total_score / len(metrics))\n\n';

  code += '    def calculate_category_scores(self, metrics: List[FileMetrics]) -> Dict[str, int]:\n';
  code += '        scores = {"complexity": 0, "maintainability": 0, "reliability": 0, "security": 0, "performance": 0}\n\n';

  code += '        for m in metrics:\n';
  code += '            scores["complexity"] += max(0, 100 - (m.complexity / 10) * 100)\n';
  code += '            scores["maintainability"] += m.maintainability_index\n';
  code += '            scores["reliability"] += 100 - (m.issues * 5)\n';
  code += '            scores["security"] += 100\n';
  code += '            scores["performance"] += 100 - (m.duplication * 2)\n\n';

  code += '        count = len(metrics) or 1\n';
  code += '        return {\n';
  code += '            "complexity": int(scores["complexity"] / count),\n';
  code += '            "maintainability": int(scores["maintainability"] / count),\n';
  code += '            "reliability": max(0, int(scores["reliability"] / count)),\n';
  code += '            "security": int(scores["security"] / count),\n';
  code += '            "performance": max(0, int(scores["performance"] / count)),\n';
  code += '        }\n\n';

  code += '    def generate_recommendations(self, report: QualityReport) -> List[str]:\n';
  code += '        recommendations = []\n\n';

  code += '        if report.category_scores["complexity"] < 70:\n';
  code += '            recommendations.append("Reduce code complexity by extracting smaller functions")\n\n';

  code += '        if report.category_scores["maintainability"] < 70:\n';
  code += '            recommendations.append("Improve maintainability by adding documentation")\n\n';

  code += '        return recommendations\n\n';

  code += 'quality_analyzer = CodeQualityAnalyzer(\n';
  code += '    languages=["typescript", "python", "go"],\n';
  code += '    thresholds={"complexity": 10, "maintainability": 50, "coverage": 80},\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: QualityConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptQuality(config);
  fs.writeFileSync(path.join(outputDir, 'code-quality-metrics.ts'), tsCode);

  const pyCode = generatePythonQuality(config);
  fs.writeFileSync(path.join(outputDir, 'code-quality-metrics.py'), pyCode);

  const md = generateQualityMD(config);
  fs.writeFileSync(path.join(outputDir, 'CODE_QUALITY_METRICS.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Code quality metrics',
    main: 'code-quality-metrics.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'quality-config.json'), JSON.stringify(config, null, 2));
}
