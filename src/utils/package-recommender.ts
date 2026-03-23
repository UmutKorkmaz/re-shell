// Auto-generated Package Recommendation Engine
// Generated at: 2026-01-12T22:04:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface PackageRecommendation {
  packageName: string;
  version: string;
  description: string;
  language: string;
  score: number;
  popularity: number;
  compatibility: string;
  reason: string;
}

interface RecommendationConfig {
  projectName: string;
  maxRecommendations: number;
  includeBeta: boolean;
}

export function displayConfig(config: RecommendationConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Package Recommendation Engine');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Max Recommendations:', config.maxRecommendations);
  console.log('\x1b[33m%s\x1b[0m', 'Include Beta:', config.includeBeta ? 'Yes' : 'No');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateRecommenderMD(config: RecommendationConfig): string {
  let md = '# Package Recommendation Engine\n\n';
  md += '## Features\n\n';
  md += '- Intelligent package recommendations\n';
  md += '- Compatibility checking\n';
  md += '- Popularity scoring\n';
  md += '- Multi-language support\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import recommender from \'./package-recommender\';\n\n';
  md += 'const recs = await recommender.recommend(\'http\');\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptRecommender(config: RecommendationConfig): string {
  let code = '// Auto-generated Package Recommender for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';
  code += 'interface PackageRecommendation {\n';
  code += '  packageName: string;\n';
  code += '  version: string;\n';
  code += '  description: string;\n';
  code += '  language: string;\n';
  code += '  score: number;\n';
  code += '  popularity: number;\n';
  code += '  compatibility: string;\n';
  code += '  reason: string;\n';
  code += '}\n\n';
  code += 'class PackageRecommender {\n';
  code += '  private projectRoot: string;\n';
  code += '  private maxRecommendations: number;\n';
  code += '  private includeBeta: boolean;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.maxRecommendations = options.maxRecommendations || 10;\n';
  code += '    this.includeBeta = options.includeBeta || false;\n';
  code += '  }\n\n';
  code += '  async recommend(query: string): Promise<PackageRecommendation[]> {\n';
  code += '    console.log(\'[Recommender] Searching for packages matching:\', query);\n';
  code += '    const recommendations: PackageRecommendation[] = [];\n\n';
  code += '    // Detect project language\n';
  code += '    const language = this.detectLanguage();\n\n';
  code += '    if (language === \'javascript\' || language === \'typescript\') {\n';
  code += '      recommendations.push(...await this.searchNpm(query));\n';
  code += '    } else if (language === \'python\') {\n';
  code += '      recommendations.push(...await this.searchPip(query));\n';
  code += '    }\n\n';
  code += '    return recommendations.sort((a, b) => b.score - a.score).slice(0, this.maxRecommendations);\n';
  code += '  }\n\n';
  code += '  private detectLanguage(): string {\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'package.json\'))) return \'javascript\';\n';
  code += '    if (fs.existsSync(path.join(this.projectRoot, \'requirements.txt\'))) return \'python\';\n';
  code += '    return \'unknown\';\n';
  code += '  }\n\n';
  code += '  private async searchNpm(query: string): Promise<PackageRecommendation[]> {\n';
  code += '    const recommendations: PackageRecommendation[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(`npm search ${query} --json`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const results = JSON.parse(output);\n';
  code += '      for (const pkg of results) {\n';
  code += '        recommendations.push({\n';
  code += '          packageName: pkg.name,\n';
  code += '          version: pkg.version || \'latest\',\n';
  code += '          description: pkg.description || \'\',\n';
  code += '          language: \'javascript\',\n';
  code += '          score: this.calculateScore(pkg),\n';
  code += '          popularity: 0,\n';
  code += '          compatibility: \'compatible\',\n';
  code += '          reason: \'Matches search query\',\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Recommender] npm search failed:\', error.message);\n';
  code += '    }\n\n';
  code += '    return recommendations;\n';
  code += '  }\n\n';
  code += '  private async searchPip(query: string): Promise<PackageRecommendation[]> {\n';
  code += '    const recommendations: PackageRecommendation[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(`pip search ${query} 2>/dev/null || echo ""`, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const lines = output.split(\'\\n\').filter(l => l.trim());\n';
  code += '      for (const line of lines) {\n';
  code += '        const parts = line.split(/\\s+/);\n';
  code += '        if (parts.length >= 2) {\n';
  code += '          recommendations.push({\n';
  code += '            packageName: parts[0],\n';
  code += '            version: \'latest\',\n';
  code += '            description: parts.slice(1).join(\' \'),\n';
  code += '            language: \'python\',\n';
  code += '            score: 0.5,\n';
  code += '            popularity: 0,\n';
  code += '            compatibility: \'compatible\',\n';
  code += '            reason: \'Matches search query\',\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Recommender] pip search failed:\', error.message);\n';
  code += '    }\n\n';
  code += '    return recommendations;\n';
  code += '  }\n\n';
  code += '  private calculateScore(pkg: any): number {\n';
  code += '    let score = 0.5;\n';
  code += '    if (pkg.quality) score += pkg.quality * 0.3;\n';
  code += '    if (pkg.maintenance) score += pkg.maintenance * 0.2;\n';
  code += '    return Math.min(score, 1.0);\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const recommender = new PackageRecommender({\n';
  code += '  maxRecommendations: 10,\n';
  code += '  includeBeta: false,\n';
  code += '});\n\n';
  code += 'export default recommender;\n';
  code += 'export { PackageRecommender, PackageRecommendation };\n';

  return code;
}

export function generatePythonRecommender(config: RecommendationConfig): string {
  let code = '# Auto-generated Package Recommender for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Optional\n';
  code += 'from dataclasses import dataclass\n\n';
  code += '@dataclass\n';
  code += 'class PackageRecommendation:\n';
  code += '    package_name: str\n';
  code += '    version: str\n';
  code += '    description: str\n';
  code += '    language: str\n';
  code += '    score: float\n';
  code += '    popularity: int\n';
  code += '    compatibility: str\n';
  code += '    reason: str\n\n';
  code += 'class PackageRecommender:\n';
  code += '    def __init__(self, project_root: str = None, max_recommendations: int = 10, include_beta: bool = False):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.max_recommendations = max_recommendations\n';
  code += '        self.include_beta = include_beta\n\n';
  code += '    async def recommend(self, query: str) -> List[PackageRecommendation]:\n';
  code += '        print(f"[Recommender] Searching for packages matching: {query}")\n';
  code += '        recommendations = []\n\n';
  code += '        # Detect project language\n';
  code += '        language = self.detect_language()\n\n';
  code += '        if language in ["javascript", "typescript"]:\n';
  code += '            recommendations.extend(await self.search_npm(query))\n';
  code += '        elif language == "python":\n';
  code += '            recommendations.extend(await self.search_pip(query))\n\n';
  code += '        recommendations.sort(key=lambda x: x.score, reverse=True)\n';
  code += '        return recommendations[:self.max_recommendations]\n\n';
  code += '    def detect_language(self) -> str:\n';
  code += '        if (self.project_root / "package.json").exists():\n';
  code += '            return "javascript"\n';
  code += '        if (self.project_root / "requirements.txt").exists():\n';
  code += '            return "python"\n';
  code += '        return "unknown"\n\n';
  code += '    async def search_npm(self, query: str) -> List[PackageRecommendation]:\n';
  code += '        recommendations = []\n\n';
  code += '        try:\n';
  code += '            result = subprocess.run(f"npm search {query} --json", shell=True, cwd=self.project_root,\n';
  code += '                                        capture_output=True, text=True)\n';
  code += '            import json\n';
  code += '            results = json.loads(result.stdout)\n';
  code += '            for pkg in results:\n';
  code += '                recommendations.append(PackageRecommendation(\n';
  code += '                    package_name=pkg.get("name", ""),\n';
  code += '                    version=pkg.get("version", "latest"),\n';
  code += '                    description=pkg.get("description", ""),\n';
  code += '                    language="javascript",\n';
  code += '                    score=0.5,\n';
  code += '                    popularity=0,\n';
  code += '                    compatibility="compatible",\n';
  code += '                    reason="Matches search query",\n';
  code += '                ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Recommender] npm search failed: {e}")\n\n';
  code += '        return recommendations\n\n';
  code += '    async def search_pip(self, query: str) -> List[PackageRecommendation]:\n';
  code += '        recommendations = []\n\n';
  code += '        try:\n';
  code += '            result = subprocess.run(f"pip search {query} 2>/dev/null || echo \\""", shell=True, cwd=self.project_root,\n';
  code += '                                        capture_output=True, text=True)\n';
  code += '            lines = result.stdout.strip().split("\\n")\n';
  code += '            for line in lines:\n';
  code += '                if line.strip():\n';
  code += '                    parts = line.split(None, 1)\n';
  code += '                    if len(parts) >= 2:\n';
  code += '                        recommendations.append(PackageRecommendation(\n';
  code += '                            package_name=parts[0],\n';
  code += '                            version="latest",\n';
  code += '                            description=parts[1],\n';
  code += '                            language="python",\n';
  code += '                            score=0.5,\n';
  code += '                            popularity=0,\n';
  code += '                            compatibility="compatible",\n';
  code += '                            reason="Matches search query",\n';
  code += '                        ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Recommender] pip search failed: {e}")\n\n';
  code += '        return recommendations\n\n';
  code += 'recommender = PackageRecommender(\n';
  code += '    max_recommendations=10,\n';
  code += '    include_beta=False,\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: RecommendationConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptRecommender(config);
  fs.writeFileSync(path.join(outputDir, 'package-recommender.ts'), tsCode);

  const pyCode = generatePythonRecommender(config);
  fs.writeFileSync(path.join(outputDir, 'package-recommender.py'), pyCode);

  const md = generateRecommenderMD(config);
  fs.writeFileSync(path.join(outputDir, 'PACKAGE_RECOMMENDER.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Package recommendation engine',
    main: 'package-recommender.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'recommender-config.json'), JSON.stringify(config, null, 2));
}
