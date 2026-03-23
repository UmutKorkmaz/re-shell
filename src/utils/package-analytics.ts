// Auto-generated Package Usage Analytics
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface PackageUsage {
  packageName: string;
  ecosystem: string;
  version: string;
  importCount: number;
  files: string[];
  linesOfCode: number;
  lastUsed: string;
  directDependencies: number;
  transitiveDependencies: number;
  bundleSize: number;
  downloadCount: number;
}

interface OptimizationRecommendation {
  type: 'remove-unused' | 'replace-lighter' | 'deduplicate' | 'lazy-load' | 'upgrade';
  packageName: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'hard';
  estimatedSavings: string;
  alternative?: string;
}

interface AnalyticsReport {
  scanTime: string;
  totalPackages: number;
  unusedPackages: string[];
  duplicatePackages: string[];
  heavyPackages: string[];
  recommendations: OptimizationRecommendation[];
  packageUsage: PackageUsage[];
}

interface AnalyticsConfig {
  projectName: string;
  includeTransitive: boolean;
  minUsageThreshold: number;
}

export function displayConfig(config: AnalyticsConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Package Usage Analytics');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Include Transitive:', config.includeTransitive ? 'Yes' : 'No');
  console.log('\x1b[33m%s\x1b[0m', 'Min Usage Threshold:', config.minUsageThreshold);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateAnalyticsMD(config: AnalyticsConfig): string {
  let md = '# Package Usage Analytics\n\n';
  md += '## Features\n\n';
  md += '- Package usage analysis\n';
  md += '- Unused package detection\n';
  md += '- Duplicate package identification\n';
  md += '- Bundle size analysis\n';
  md += '- Optimization recommendations\n';
  md += '- Lazy loading suggestions\n';
  md += '- Lighter alternative proposals\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import analytics from \'./package-analytics\';\n\n';
  md += '// Analyze package usage\n';
  md += 'const report = await analytics.analyze();\n\n';
  md += '// Get optimization recommendations\n';
  md += 'const recommendations = analytics.getRecommendations(report);\n\n';
  md += '// Apply optimizations\n';
  md += 'await analytics.applyOptimizations(recommendations);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptAnalytics(config: AnalyticsConfig): string {
  let code = '// Auto-generated Package Analytics for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface PackageUsage {\n';
  code += '  packageName: string;\n';
  code += '  ecosystem: string;\n';
  code += '  version: string;\n';
  code += '  importCount: number;\n';
  code += '  files: string[];\n';
  code += '  linesOfCode: number;\n';
  code += '  lastUsed: string;\n';
  code += '  directDependencies: number;\n';
  code += '  transitiveDependencies: number;\n';
  code += '  bundleSize: number;\n';
  code += '  downloadCount: number;\n';
  code += '}\n\n';

  code += 'interface OptimizationRecommendation {\n';
  code += '  type: \'remove-unused\' | \'replace-lighter\' | \'deduplicate\' | \'lazy-load\' | \'upgrade\';\n';
  code += '  packageName: string;\n';
  code += '  reason: string;\n';
  code += '  impact: \'high\' | \'medium\' | \'low\';\n';
  code += '  effort: \'easy\' | \'medium\' | \'hard\';\n';
  code += '  estimatedSavings: string;\n';
  code += '  alternative?: string;\n';
  code += '}\n\n';

  code += 'interface AnalyticsReport {\n';
  code += '  scanTime: string;\n';
  code += '  totalPackages: number;\n';
  code += '  unusedPackages: string[];\n';
  code += '  duplicatePackages: string[];\n';
  code += '  heavyPackages: string[];\n';
  code += '  recommendations: OptimizationRecommendation[];\n';
  code += '  packageUsage: PackageUsage[];\n';
  code += '}\n\n';

  code += 'class PackageAnalytics {\n';
  code += '  private projectRoot: string;\n';
  code += '  private includeTransitive: boolean;\n';
  code += '  private minUsageThreshold: number;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.includeTransitive = options.includeTransitive || false;\n';
  code += '    this.minUsageThreshold = options.minUsageThreshold || 0;\n';
  code += '  }\n\n';

  code += '  async analyze(): Promise<AnalyticsReport> {\n';
  code += '    console.log(\'[Analytics] Analyzing package usage...\');\n\n';

  code += '    const report: AnalyticsReport = {\n';
  code += '      scanTime: new Date().toISOString(),\n';
  code += '      totalPackages: 0,\n';
  code += '      unusedPackages: [],\n';
  code += '      duplicatePackages: [],\n';
  code += '      heavyPackages: [],\n';
  code += '      recommendations: [],\n';
  code += '      packageUsage: [],\n';
  code += '    };\n\n';

  code += '    // Analyze npm packages\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'package.json\'))) {\n';
  code += '      const npmUsage = await this.analyzeNpmPackages();\n';
  code += '      report.packageUsage.push(...npmUsage);\n';
  code += '    }\n\n';

  code += '    // Find unused packages\n';
  code += '    report.unusedPackages = this.findUnusedPackages(report.packageUsage);\n\n';

  code += '    // Find duplicate packages\n';
  code += '    report.duplicatePackages = this.findDuplicatePackages(report.packageUsage);\n\n';

  code += '    // Find heavy packages\n';
  code += '    report.heavyPackages = this.findHeavyPackages(report.packageUsage);\n\n';

  code += '    // Generate recommendations\n';
  code += '    report.recommendations = this.generateRecommendations(report);\n\n';

  code += '    report.totalPackages = report.packageUsage.length;\n\n';

  code += '    console.log(`[Analytics] Found ${report.unusedPackages.length} unused packages`);\n';
  code += '    console.log(`[Analytics] Found ${report.duplicatePackages.length} duplicate packages`);\n';
  code += '    console.log(`[Analytics] Generated ${report.recommendations.length} recommendations`);\n\n';

  code += '    return report;\n';
  code += '  }\n\n';

  code += '  private async analyzeNpmPackages(): Promise<PackageUsage[]> {\n';
  code += '    const usage: PackageUsage[] = [];\n\n';

  code += '    try {\n';
  code += '      const packageJsonPath = path.join(this.projectRoot, \'package.json\');\n';
  code += '      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, \'utf-8\'));\n\n';

  code += '      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };\n\n';

  code += '      for (const [name, version] of Object.entries(deps)) {\n';
  code += '        const importInfo = this.analyzeImports(name);\n';
  code += '        usage.push({\n';
  code += '          packageName: name,\n';
  code += '          ecosystem: \'npm\',\n';
  code += '          version: version as string,\n';
  code += '          importCount: importInfo.count,\n';
  code += '          files: importInfo.files,\n';
  code += '          linesOfCode: importInfo.lines,\n';
  code += '          lastUsed: importInfo.lastUsed,\n';
  code += '          directDependencies: 0,\n';
  code += '          transitiveDependencies: 0,\n';
  code += '          bundleSize: 0,\n';
  code += '          downloadCount: 0,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Analytics] Failed to analyze npm packages:\', error.message);\n';
  code += '    }\n\n';

  code += '    return usage;\n';
  code += '  }\n\n';

  code += '  private analyzeImports(packageName: string): { count: number; files: string[]; lines: number; lastUsed: string } {\n';
  code += '    let count = 0;\n';
  code += '    const files: string[] = [];\n';
  code += '    let lines = 0;\n';
  code += '    let lastUsed = \'\';\n';

  code += '    const searchDir = (dir: string) => {\n';
  code += '      if (!fs.existsSync(dir)) return;\n\n';

  code += '      const entries = fs.readdirSync(dir, { withFileTypes: true });\n\n';

  code += '      for (const entry of entries) {\n';
  code += '        const fullPath = path.join(dir, entry.name);\n';
  code += '        if (entry.isDirectory()) {\n';
  code += '          if (entry.name !== \'node_modules\' && entry.name !== \'.git\' && entry.name !== \'dist\') {\n';
  code += '            searchDir(fullPath);\n';
  code += '          }\n';
  code += '        } else if (entry.isFile() && /\\.(ts|js|tsx|jsx)$/.test(entry.name)) {\n';
  code += '          const content = fs.readFileSync(fullPath, \'utf-8\');\n';
  code += '          const lines_count = content.split(\'\\n\').length;\n\n';

  code += '          // Check for imports\n';
  code += '          const patterns = [\n';
  code += '            new RegExp(`from [\'"]${packageName.replace(\'/\', \'\\\\/\')}[\'"]`, \'g\'),\n';
  code += '            new RegExp(`import.*[\'"]${packageName.replace(\'/\', \'\\\\/\')}[\'"]`, \'g\'),\n';
  code += '            new RegExp(`require\\([\'"]${packageName.replace(\'/\', \'\\\\/\')}[\'"]\\)`, \'g\'),\n';
  code += '          ];\n\n';

  code += '          for (const pattern of patterns) {\n';
  code += '            const matches = content.match(pattern);\n';
  code += '            if (matches) {\n';
  code += '              count += matches.length;\n';
  code += '              files.push(fullPath);\n';
  code += '              lines += lines_count;\n';
  code += '              break;\n';
  code += '          }\n';
  code += '        }\n';
  code += '      }\n';
  code += '    };\n\n';

  code += '    searchDir(this.projectRoot);\n';

  code += '    return { count, files, lines, lastUsed };\n';
  code += '  }\n\n';

  code += '  private findUnusedPackages(usage: PackageUsage[]): string[] {\n';
  code += '    return usage\n';
  code += '      .filter(pkg => pkg.importCount === 0)\n';
  code += '      .map(pkg => pkg.packageName);\n';
  code += '  }\n\n';

  code += '  private findDuplicatePackages(usage: PackageUsage[]): string[] {\n';
  code += '    const counts: { [key: string]: number } = {};\n\n';

  code += '    for (const pkg of usage) {\n';
  code += '      const name = pkg.packageName;\n';
  code += '      counts[name] = (counts[name] || 0) + 1;\n';
  code += '    }\n\n';

  code += '    return Object.entries(counts)\n';
  code += '      .filter(([_, count]) => count > 1)\n';
  code += '      .map(([name]) => name);\n';
  code += '  }\n\n';

  code += '  private findHeavyPackages(usage: PackageUsage[]): string[] {\n';
  code += '    return usage\n';
  code += '      .filter(pkg => pkg.bundleSize > 1000000) // > 1MB\n';
  code += '      .map(pkg => pkg.packageName);\n';
  code += '  }\n\n';

  code += '  private generateRecommendations(report: AnalyticsReport): OptimizationRecommendation[] {\n';
  code += '    const recommendations: OptimizationRecommendation[] = [];\n\n';

  code += '    // Recommend removing unused packages\n';
  code += '    for (const pkg of report.unusedPackages) {\n';
  code += '      recommendations.push({\n';
  code += '        type: \'remove-unused\',\n';
  code += '        packageName: pkg,\n';
  code += '        reason: \'Package is not imported in any source files\',\n';
  code += '        impact: \'medium\',\n';
  code += '        effort: \'easy\',\n';
  code += '        estimatedSavings: \'~100KB - 1MB\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    // Deduplicate packages\n';
  code += '    for (const pkg of report.duplicatePackages) {\n';
  code += '      recommendations.push({\n';
  code += '        type: \'deduplicate\',\n';
  code += '        packageName: pkg,\n';
  code += '        reason: \'Multiple versions of the same package detected\',\n';
  code += '        impact: \'medium\',\n';
  code += '        effort: \'medium\',\n';
  code += '        estimatedSavings: \'~50KB - 500KB\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    // Lighter alternatives for heavy packages\n';
  code += '    const alternatives: { [key: string]: string } = {\n';
  code += '      \'moment\': \'dayjs\',\n';
  code += '      \'lodash\': \'lodash-es\',\n';
  code += '      \'axios\': \'fetch API\',\n';
  code += '    };\n\n';

  code += '    for (const pkg of report.heavyPackages) {\n';
  code += '      const alternative = alternatives[pkg];\n';
  code += '      if (alternative) {\n';
  code += '        recommendations.push({\n';
  code += '          type: \'replace-lighter\',\n';
  code += '          packageName: pkg,\n';
  code += '          reason: `Consider using ${alternative} for smaller bundle size`,\n';
  code += '          impact: \'high\',\n';
  code += '          effort: \'medium\',\n';
  code += '          estimatedSavings: \'~100KB - 1MB\',\n';
  code += '          alternative,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    return recommendations;\n';
  code += '  }\n\n';

  code += '  async applyOptimizations(recommendations: OptimizationRecommendation[]): Promise<void> {\n';
  code += '    console.log(\'[Analytics] Applying optimizations...\');\n\n';

  code += '    for (const rec of recommendations) {\n';
  code += '      if (rec.type === \'remove-unused\') {\n';
  code += '        await this.removePackage(rec.packageName);\n';
  code += '      } else if (rec.type === \'replace-lighter\' && rec.alternative) {\n';
  code += '        await this.replacePackage(rec.packageName, rec.alternative);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async removePackage(packageName: string): Promise<void> {\n';
  code += '    console.log(`[Analytics] Removing unused package: ${packageName}`);\n\n';

  code += '    try {\n';
  code += '      execSync(`npm uninstall ${packageName}`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Analytics] Failed to remove ${packageName}:`, error.message);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  private async replacePackage(oldPackage: string, newPackage: string): Promise<void> {\n';
  code += '    console.log(`[Analytics] Replacing ${oldPackage} with ${newPackage}`);\n\n';

  code += '    try {\n';
  code += '      execSync(`npm uninstall ${oldPackage} && npm install ${newPackage}`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        stdio: \'inherit\',\n';
  code += '      });\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(`[Analytics] Failed to replace package:\', error.message);\n';
  code += '    }\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const analytics = new PackageAnalytics({\n';
  code += '  includeTransitive: false,\n';
  code += '  minUsageThreshold: 0,\n';
  code += '});\n\n';

  code += 'export default analytics;\n';
  code += 'export { PackageAnalytics, AnalyticsReport, PackageUsage, OptimizationRecommendation };\n';

  return code;
}

export function generatePythonAnalytics(config: AnalyticsConfig): string {
  let code = '# Auto-generated Package Analytics for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional, Dict\n';
  code += 'from dataclasses import dataclass\n';
  code += 'import re\n\n';

  code += '@dataclass\n';
  code += 'class PackageUsage:\n';
  code += '    package_name: str\n';
  code += '    ecosystem: str\n';
  code += '    version: str\n';
  code += '    import_count: int\n';
  code += '    files: List[str]\n';
  code += '    lines_of_code: int\n';
  code += '    last_used: str\n';
  code += '    direct_dependencies: int\n';
  code += '    transitive_dependencies: int\n';
  code += '    bundle_size: int\n';
  code += '    download_count: int\n\n';

  code += '@dataclass\n';
  code += 'class OptimizationRecommendation:\n';
  code += '    type: str\n';
  code += '    package_name: str\n';
  code += '    reason: str\n';
  code += '    impact: str\n';
  code += '    effort: str\n';
  code += '    estimated_savings: str\n';
  code += '    alternative: Optional[str] = None\n\n';

  code += '@dataclass\n';
  code += 'class AnalyticsReport:\n';
  code += '    scan_time: str\n';
  code += '    total_packages: int\n';
  code += '    unused_packages: List[str]\n';
  code += '    duplicate_packages: List[str]\n';
  code += '    heavy_packages: List[str]\n';
  code += '    recommendations: List[OptimizationRecommendation]\n';
  code += '    package_usage: List[PackageUsage]\n\n';

  code += 'class PackageAnalytics:\n';
  code += '    def __init__(self, project_root: str = None, include_transitive: bool = False, min_threshold: int = 0):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.include_transitive = include_transitive\n';
  code += '        self.min_threshold = min_threshold\n\n';

  code += '    async def analyze(self) -> AnalyticsReport:\n';
  code += '        print("[Analytics] Analyzing package usage...")\n\n';

  code += '        report = AnalyticsReport(\n';
  code += '            scan_time="",\n';
  code += '            total_packages=0,\n';
  code += '            unused_packages=[],\n';
  code += '            duplicate_packages=[],\n';
  code += '            heavy_packages=[],\n';
  code += '            recommendations=[],\n';
  code += '            package_usage=[],\n';
  code += '        )\n\n';

  code += '        # Analyze npm packages\n';
  code += '        if (self.project_root / "package.json").exists():\n';
  code += '            npm_usage = await self.analyze_npm_packages()\n';
  code += '            report.package_usage.extend(npm_usage)\n\n';

  code += '        # Find unused packages\n';
  code += '        report.unused_packages = self.find_unused_packages(report.package_usage)\n\n';

  code += '        # Find duplicate packages\n';
  code += '        report.duplicate_packages = self.find_duplicate_packages(report.package_usage)\n\n';

  code += '        # Generate recommendations\n';
  code += '        report.recommendations = self.generate_recommendations(report)\n\n';

  code += '        report.total_packages = len(report.package_usage)\n\n';

  code += '        print(f"[Analytics] Found {len(report.unused_packages)} unused packages")\n';
  code += '        print(f"[Analytics] Generated {len(report.recommendations)} recommendations")\n\n';

  code += '        return report\n\n';

  code += '    async def analyze_npm_packages(self) -> List[PackageUsage]:\n';
  code += '        usage = []\n\n';

  code += '        try:\n';
  code += '            package_json_path = self.project_root / "package.json"\n';
  code += '            package_json = json.loads(package_json_path.read_text())\n\n';

  code += '            deps = {**package_json.get("dependencies", {}), **package_json.get("devDependencies", {})}\n\n';

  code += '            for name, version in deps.items():\n';
  code += '                import_info = self.analyze_imports(name)\n';
  code += '                usage.append(PackageUsage(\n';
  code += '                    package_name=name,\n';
  code += '                    ecosystem="npm",\n';
  code += '                    version=version,\n';
  code += '                    import_count=import_info["count"],\n';
  code += '                    files=import_info["files"],\n';
  code += '                    lines_of_code=import_info["lines"],\n';
  code += '                    last_used=import_info["last_used"],\n';
  code += '                    direct_dependencies=0,\n';
  code += '                    transitive_dependencies=0,\n';
  code += '                    bundle_size=0,\n';
  code += '                    download_count=0,\n';
  code += '                ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Analytics] Failed to analyze npm packages: {e}")\n\n';

  code += '        return usage\n\n';

  code += '    def analyze_imports(self, package_name: str) -> Dict:\n';
  code += '        count = 0\n';
  code += '        files = []\n';
  code += '        lines = 0\n';
  code += '        last_used = ""\n\n';

  code += '        for file_path in self.project_root.rglob("*.ts"):\n';
  code += '            if "node_modules" not in str(file_path) and "dist" not in str(file_path):\n';
  code += '                content = file_path.read_text()\n';
  code += '                lines_count = len(content.split("\\n"))\n\n';

  code += '                # Check for imports\n';
  code += '                patterns = [\n';
  code += '                    re.compile(r\'from ["\']\' + re.escape(package_name) + r\'["\']\'),\n';
  code += '                    re.compile(r\'import.*["\']\' + re.escape(package_name) + r\'["\']\'),\n';
  code += '                    re.compile(r\'require\\(["\']\' + re.escape(package_name) + r\'["\']\\)\'),\n';
  code += '                ]\n\n';

  code += '                for pattern in patterns:\n';
  code += '                    if pattern.search(content):\n';
  code += '                        count += 1\n';
  code += '                        files.append(str(file_path))\n';
  code += '                        lines += lines_count\n';
  code += '                        break\n\n';

  code += '        return {"count": count, "files": files, "lines": lines, "last_used": last_used}\n\n';

  code += '    def find_unused_packages(self, usage: List[PackageUsage]) -> List[str]:\n';
  code += '        return [pkg.package_name for pkg in usage if pkg.import_count == 0]\n\n';

  code += '    def find_duplicate_packages(self, usage: List[PackageUsage]) -> List[str]:\n';
  code += '        counts = {}\n\n';

  code += '        for pkg in usage:\n';
  code += '            name = pkg.package_name\n';
  code += '            counts[name] = counts.get(name, 0) + 1\n\n';

  code += '        return [name for name, count in counts.items() if count > 1]\n\n';

  code += '    def generate_recommendations(self, report: AnalyticsReport) -> List[OptimizationRecommendation]:\n';
  code += '        recommendations = []\n\n';

  code += '        # Recommend removing unused packages\n';
  code += '        for pkg in report.unused_packages:\n';
  code += '            recommendations.append(OptimizationRecommendation(\n';
  code += '                type="remove-unused",\n';
  code += '                package_name=pkg,\n';
  code += '                reason="Package is not imported in any source files",\n';
  code += '                impact="medium",\n';
  code += '                effort="easy",\n';
  code += '                estimated_savings="~100KB - 1MB",\n';
  code += '            ))\n\n';

  code += '        return recommendations\n\n';

  code += 'analytics = PackageAnalytics(\n';
  code += '    include_transitive=False,\n';
  code += '    min_threshold=0,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: AnalyticsConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptAnalytics(config);
  fs.writeFileSync(path.join(outputDir, 'package-analytics.ts'), tsCode);

  const pyCode = generatePythonAnalytics(config);
  fs.writeFileSync(path.join(outputDir, 'package-analytics.py'), pyCode);

  const md = generateAnalyticsMD(config);
  fs.writeFileSync(path.join(outputDir, 'PACKAGE_ANALYTICS.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Package usage analytics',
    main: 'package-analytics.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'analytics-config.json'), JSON.stringify(config, null, 2));
}
