// Auto-generated Cross-Ecosystem Package Search Utility
// Generated at: 2026-01-12T22:05:20.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface SearchResult {
  packageName: string;
  version: string;
  description: string;
  ecosystem: string;
  relevance: number;
  downloads: number;
  homepage: string;
  keywords: string[];
}

export function displayConfig(config: any): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Cross-Ecosystem Package Search');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateSearchMD(config: any): string {
  let md = '# Package Search Utility\n\n';
  md += '## Features\n\n';
  md += '- Multi-ecosystem package search\n';
  md += '- Relevance ranking\n';
  md += '- Keyword matching\n';
  md += '- Support for: npm, pip, cargo, maven, composer\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import search from \'./package-search\';\n\n';
  md += 'const results = await search.search(\'http\');\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptSearch(config: any): string {
  let code = '// Auto-generated Package Search for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';
  code += 'interface SearchResult {\n';
  code += '  packageName: string;\n';
  code += '  version: string;\n';
  code += '  description: string;\n';
  code += '  ecosystem: string;\n';
  code += '  relevance: number;\n';
  code += '  downloads: number;\n';
  code += '  homepage: string;\n';
  code += '  keywords: string[];\n';
  code += '}\n\n';
  code += 'class PackageSearch {\n';
  code += '  private projectRoot: string;\n\n';
  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '  }\n\n';
  code += '  async search(query: string, ecosystems?: string[]): Promise<SearchResult[]> {\n';
  code += '    console.log(\'[Search] Searching for:\', query);\n';
  code += '    const results: SearchResult[] = [];\n\n';
  code += '    const targetEcosystems = ecosystems || [\'npm\', \'pip\', \'cargo\', \'composer\'];\n\n';
  code += '    for (const ecosystem of targetEcosystems) {\n';
  code += '      try {\n';
  code += '        results.push(...await this.searchEcosystem(query, ecosystem));\n';
  code += '      } catch (error: any) {\n';
  code += '        console.error(\'[Search] Failed to search\', ecosystem);\n';
  code += '      }\n';
  code += '    }\n\n';
  code += '    // Rank by relevance\n';
  code += '    results.sort((a, b) => b.relevance - a.relevance);\n';
  code += '    return results;\n';
  code += '  }\n\n';
  code += '  private async searchEcosystem(query: string, ecosystem: string): Promise<SearchResult[]> {\n';
  code += '    switch (ecosystem) {\n';
  code += '      case \'npm\':\n';
  code += '        return this.searchNpm(query);\n';
  code += '      case \'pip\':\n';
  code += '        return this.searchPip(query);\n';
  code += '      case \'cargo\':\n';
  code += '        return this.searchCargo(query);\n';
  code += '      case \'composer\':\n';
  code += '        return this.searchComposer(query);\n';
  code += '      default:\n';
  code += '        return [];\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  private async searchNpm(query: string): Promise<SearchResult[]> {\n';
  code += '    const results: SearchResult[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(`npm search ${query} --json`, {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const packages = JSON.parse(output);\n';
  code += '      for (const pkg of packages) {\n';
  code += '        results.push({\n';
  code += '          packageName: pkg.name,\n';
  code += '          version: pkg.version || \'latest\',\n';
  code += '          description: pkg.description || \'\',\n';
  code += '          ecosystem: \'npm\',\n';
  code += '          relevance: this.calculateRelevance(query, pkg.name, pkg.keywords || []),\n';
  code += '          downloads: 0,\n';
  code += '          homepage: pkg.links?.homepage || \'\',\n';
  code += '          keywords: pkg.keywords || [],\n';
  code += '        });\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Search] npm search failed:\', error.message);\n';
  code += '    }\n\n';
  code += '    return results;\n';
  code += '  }\n\n';
  code += '  private async searchPip(query: string): Promise<SearchResult[]> {\n';
  code += '    const results: SearchResult[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(`pip search ${query} 2>/dev/null || echo ""`, {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const lines = output.split(\'\\n\').filter(l => l.trim());\n';
  code += '      for (const line of lines) {\n';
  code += '        const parts = line.split(/\\s+/);\n';
  code += '        if (parts.length >= 2) {\n';
  code += '          results.push({\n';
  code += '            packageName: parts[0],\n';
  code += '            version: \'latest\',\n';
  code += '            description: parts.slice(1).join(\' \'),\n';
  code += '            ecosystem: \'pip\',\n';
  code += '            relevance: this.calculateRelevance(query, parts[0], []),\n';
  code += '            downloads: 0,\n';
  code += '            homepage: \'\',\n';
  code += '            keywords: [],\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Search] pip search failed:\', error.message);\n';
  code += '    }\n\n';
  code += '    return results;\n';
  code += '  }\n\n';
  code += '  private async searchCargo(query: string): Promise<SearchResult[]> {\n';
  code += '    const results: SearchResult[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(`cargo search ${query} 2>/dev/null || echo ""`, {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const lines = output.split(\'\\n\').filter(l => l.trim() && !l.startsWith(\'Searching\'));\n';
  code += '      for (const line of lines) {\n';
  code += '        const match = line.match(/^([\\w-]+)\\s+=\\s+"(.+)"\\s+#(.+)$/);\n';
  code += '        if (match) {\n';
  code += '          results.push({\n';
  code += '            packageName: match[1],\n';
  code += '            version: \'latest\',\n';
  code += '            description: match[3].trim(),\n';
  code += '            ecosystem: \'cargo\',\n';
  code += '            relevance: this.calculateRelevance(query, match[1], []),\n';
  code += '            downloads: 0,\n';
  code += '            homepage: \'\',\n';
  code += '            keywords: [],\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Search] cargo search failed:\', error.message);\n';
  code += '    }\n\n';
  code += '    return results;\n';
  code += '  }\n\n';
  code += '  private async searchComposer(query: string): Promise<SearchResult[]> {\n';
  code += '    const results: SearchResult[] = [];\n\n';
  code += '    try {\n';
  code += '      const output = execSync(`composer search ${query} 2>/dev/null || echo ""`, {\n';
  code += '        encoding: \'utf-8\',\n';
  code += '        stdio: \'pipe\',\n';
  code += '      });\n\n';
  code += '      const lines = output.split(\'\\n\').filter(l => l.trim());\n';
  code += '      for (const line of lines) {\n';
  code += '        const parts = line.split(/\\s+/);\n';
  code += '        if (parts.length >= 2) {\n';
  code += '          results.push({\n';
  code += '            packageName: parts[0],\n';
  code += '            version: \'latest\',\n';
  code += '            description: parts.slice(1).join(\' \'),\n';
  code += '            ecosystem: \'composer\',\n';
  code += '            relevance: this.calculateRelevance(query, parts[0], []),\n';
  code += '            downloads: 0,\n';
  code += '            homepage: \'\',\n';
  code += '            keywords: [],\n';
  code += '          });\n';
  code += '        }\n';
  code += '      }\n';
  code += '    } catch (error: any) {\n';
  code += '      console.error(\'[Search] composer search failed:\', error.message);\n';
  code += '    }\n\n';
  code += '    return results;\n';
  code += '  }\n\n';
  code += '  private calculateRelevance(query: string, packageName: string, keywords: string[]): number {\n';
  code += '    let relevance = 0;\n';
  code += '    const q = query.toLowerCase();\n';
  code += '    const name = packageName.toLowerCase();\n\n';
  code += '    // Exact match\n';
  code += '    if (name === q) relevance += 1.0;\n';
  code += '    // Starts with\n';
  code += '    else if (name.startsWith(q)) relevance += 0.8;\n';
  code += '    // Contains\n';
  code += '    else if (name.includes(q)) relevance += 0.5;\n\n';
  code += '    // Keyword match\n';
  code += '    for (const keyword of keywords) {\n';
  code += '      if (keyword.toLowerCase().includes(q)) relevance += 0.3;\n';
  code += '    }\n\n';
  code += '    return Math.min(relevance, 1.0);\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const search = new PackageSearch();\n\n';
  code += 'export default search;\n';
  code += 'export { PackageSearch, SearchResult };\n';

  return code;
}

export function generatePythonSearch(config: any): string {
  let code = '# Auto-generated Package Search for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'from typing import List, Optional\n';
  code += 'from dataclasses import dataclass\n\n';
  code += '@dataclass\n';
  code += 'class SearchResult:\n';
  code += '    package_name: str\n';
  code += '    version: str\n';
  code += '    description: str\n';
  code += '    ecosystem: str\n';
  code += '    relevance: float\n';
  code += '    downloads: int\n';
  code += '    homepage: str\n';
  code += '    keywords: List[str]\n\n';
  code += 'class PackageSearch:\n';
  code += '    def __init__(self, project_root: str = None):\n';
  code += '        self.project_root = project_root or "."\n\n';
  code += '    async def search(self, query: str, ecosystems: Optional[List[str]] = None) -> List[SearchResult]:\n';
  code += '        print(f"[Search] Searching for: {query}")\n';
  code += '        results = []\n\n';
  code += '        target_ecosystems = ecosystems or ["npm", "pip", "cargo", "composer"]\n\n';
  code += '        for ecosystem in target_ecosystems:\n';
  code += '            try:\n';
  code += '                results.extend(await self.search_ecosystem(query, ecosystem))\n';
  code += '            except Exception as e:\n';
  code += '                print(f"[Search] Failed to search {ecosystem}")\n\n';
  code += '        # Rank by relevance\n';
  code += '        results.sort(key=lambda x: x.relevance, reverse=True)\n';
  code += '        return results\n\n';
  code += '    async def search_ecosystem(self, query: str, ecosystem: str) -> List[SearchResult]:\n';
  code += '        if ecosystem == "npm":\n';
  code += '            return await self.search_npm(query)\n';
  code += '        elif ecosystem == "pip":\n';
  code += '            return await self.search_pip(query)\n';
  code += '        elif ecosystem == "cargo":\n';
  code += '            return await self.search_cargo(query)\n';
  code += '        elif ecosystem == "composer":\n';
  code += '            return await self.search_composer(query)\n';
  code += '        else:\n';
  code += '            return []\n\n';
  code += '    async def search_npm(self, query: str) -> List[SearchResult]:\n';
  code += '        results = []\n';
  code += '        try:\n';
  code += '            output = subprocess.run(f"npm search {query} --json", shell=True,\n';
  code += '                                        capture_output=True, text=True)\n';
  code += '            import json\n';
  code += '            packages = json.loads(output.stdout)\n';
  code += '            for pkg in packages:\n';
  code += '                results.append(SearchResult(\n';
  code += '                    package_name=pkg.get("name", ""),\n';
  code += '                    version=pkg.get("version", "latest"),\n';
  code += '                    description=pkg.get("description", ""),\n';
  code += '                    ecosystem="npm",\n';
  code += '                    relevance=self.calculate_relevance(query, pkg.get("name", ""), pkg.get("keywords", [])),\n';
  code += '                    downloads=0,\n';
  code += '                    homepage=pkg.get("links", {}).get("homepage", ""),\n';
  code += '                    keywords=pkg.get("keywords", []),\n';
  code += '                ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Search] npm search failed: {e}")\n';
  code += '        return results\n\n';
  code += '    async def search_pip(self, query: str) -> List[SearchResult]:\n';
  code += '        results = []\n';
  code += '        try:\n';
  code += '            output = subprocess.run(f"pip search {query} 2>/dev/null || echo \\""", shell=True,\n';
  code += '                                        capture_output=True, text=True)\n';
  code += '            lines = output.stdout.strip().split("\\n")\n';
  code += '            for line in lines:\n';
  code += '                if line.strip():\n';
  code += '                    parts = line.split(None, 1)\n';
  code += '                    if len(parts) >= 2:\n';
  code += '                        results.append(SearchResult(\n';
  code += '                            package_name=parts[0],\n';
  code += '                            version="latest",\n';
  code += '                            description=parts[1],\n';
  code += '                            ecosystem="pip",\n';
  code += '                            relevance=self.calculate_relevance(query, parts[0], []),\n';
  code += '                            downloads=0,\n';
  code += '                            homepage="",\n';
  code += '                            keywords=[],\n';
  code += '                        ))\n';
  code += '        except Exception as e:\n';
  code += '            print(f"[Search] pip search failed: {e}")\n';
  code += '        return results\n\n';
  code += '    def calculate_relevance(self, query: str, package_name: str, keywords: List[str]) -> float:\n';
  code += '        relevance = 0.0\n';
  code += '        q = query.lower()\n';
  code += '        name = package_name.lower()\n\n';
  code += '        if name == q:\n';
  code += '            relevance += 1.0\n';
  code += '        elif name.startswith(q):\n';
  code += '            relevance += 0.8\n';
  code += '        elif q in name:\n';
  code += '            relevance += 0.5\n\n';
  code += '        for keyword in keywords:\n';
  code += '            if q in keyword.lower():\n';
  code += '                relevance += 0.3\n\n';
  code += '        return min(relevance, 1.0)\n\n';
  code += 'search = PackageSearch()\n';

  return code;
}

export async function writeFiles(config: any, outputDir: string): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptSearch(config);
  fs.writeFileSync(path.join(outputDir, 'package-search.ts'), tsCode);

  const pyCode = generatePythonSearch(config);
  fs.writeFileSync(path.join(outputDir, 'package-search.py'), pyCode);

  const md = generateSearchMD(config);
  fs.writeFileSync(path.join(outputDir, 'PACKAGE_SEARCH.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Cross-ecosystem package search',
    main: 'package-search.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'search-config.json'), JSON.stringify(config, null, 2));
}
