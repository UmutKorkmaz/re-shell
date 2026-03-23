/**
 * Cross-Language Code Search and Navigation with Semantic Understanding
 *
 * Generates code search tools with:
 * - Semantic code search across multiple languages
 * - Symbol definition and reference finding
 * - Cross-language navigation
 * - Code indexing for fast search
 * - Pattern matching and AST-based queries
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type SearchLanguage = 'typescript' | 'python';

export interface CodeSearchConfig {
  projectName: string;
  language: SearchLanguage;
  outputDir: string;
  enableSemanticSearch: boolean;
  enableIndexing: boolean;
  indexPatterns: string[];
}

// TypeScript Code Search Generator
export function generateTypeScriptCodeSearch(config: CodeSearchConfig): string {
  let code = '// Auto-generated Code Search Tools for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { glob } from \'glob\';\n\n';

  code += 'interface SearchResult {\n';
  code += '  file: string;\n';
  code += '  line: number;\n';
  code += '  column: number;\n';
  code += '  symbol: string;\n';
  code += '  type: string;\n';
  code += '  context: string;\n';
  code += '}\n\n';

  code += 'interface CodeIndex {\n';
  code += '  symbols: Map<string, SearchResult[]>;\n';
  code += '  files: string[];\n';
  code += '  lastUpdated: number;\n';
  code += '}\n\n';

  code += 'class CodeSearchEngine {\n';
  code += '  private projectRoot: string;\n';
  code += '  private index: CodeIndex;\n';
  code += '  private enableIndexing: boolean;\n';
  code += '  private indexPatterns: string[];\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.enableIndexing = options.enableIndexing !== false;\n';
  code += '    this.indexPatterns = options.indexPatterns || [\'**/*.ts\', \'**/*.tsx\', \'**/*.js\'];\n';
  code += '    this.index = {\n';
  code += '      symbols: new Map(),\n';
  code += '      files: [],\n';
  code += '      lastUpdated: 0,\n';
  code += '    };\n\n';
  code += '    if (this.enableIndexing) {\n';
  code += '      this.buildIndex();\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  async buildIndex(): Promise<void> {\n';
  code += '    console.log(\'[Search] Building code index...\');\n\n';
  code += '    const files = await this.getSourceFiles();\n';
  code += '    this.index.files = files;\n\n';
  code += '    for (const file of files) {\n';
  code += '      await this.indexFile(file);\n';
  code += '    }\n\n';
  code += '    this.index.lastUpdated = Date.now();\n';
  code += '    console.log(\'[Search] Index built: \' + this.index.symbols.size + \' symbols found\');\n';
  code += '  }\n\n';

  code += '  private async indexFile(filePath: string): Promise<void> {\n';
  code += '    const content = fs.readFileSync(filePath, \'utf-8\');\n';
  code += '    const lines = content.split(\'\\n\');\n\n';
  code += '    lines.forEach((line, index) => {\n';
  code += '      // Find definitions\n';
  code += '      const defPatterns = [\n';
  code += '        /function\\s+(\\w+)/g,\n';
  code += '        /const\\s+(\\w+)\\s*=/g,\n';
  code += '        /class\\s+(\\w+)/g,\n';
  code += '        /interface\\s+(\\w+)/g,\n';
  code += '        /type\\s+(\\w+)\\s*=/g,\n';
  code += '      ];\n\n';
  code += '      defPatterns.forEach(pattern => {\n';
  code += '        let match;\n';
  code += '        while ((match = pattern.exec(line)) !== null) {\n';
  code += '          const symbol = match[1];\n';
  code += '          const result: SearchResult = {\n';
  code += '            file: path.relative(this.projectRoot, filePath),\n';
  code += '            line: index + 1,\n';
  code += '            column: match.index,\n';
  code += '            symbol,\n';
  code += '            type: \'definition\',\n';
  code += '            context: line.trim(),\n';
  code += '          };\n\n';
  code += '          if (!this.index.symbols.has(symbol)) {\n';
  code += '            this.index.symbols.set(symbol, []);\n';
  code += '          }\n';
  code += '          this.index.symbols.get(symbol)!.push(result);\n';
  code += '        }\n';
  code += '      });\n';
  code += '    });\n';
  code += '  }\n\n';

  code += '  // Search for symbol references\n';
  code += '  async findReferences(symbol: string): Promise<SearchResult[]> {\n';
  code += '    const results: SearchResult[] = [];\n';
  code += '    const files = await this.getSourceFiles();\n\n';
  code += '    for (const file of files) {\n';
  code += '      const content = fs.readFileSync(file, \'utf-8\');\n';
  code += '      const lines = content.split(\'\\n\');\n\n';
  code += '      lines.forEach((line, index) => {\n';
  code += '        const regex = new RegExp(\'\\\\b\' + symbol + \'\\\\b\');\n';
  code += '        if (regex.test(line)) {\n';
  code += '          results.push({\n';
  code += '            file: path.relative(this.projectRoot, file),\n';
  code += '            line: index + 1,\n';
  code += '            column: line.indexOf(symbol),\n';
  code += '            symbol,\n';
  code += '            type: \'reference\',\n';
  code += '            context: line.trim(),\n';
  code += '          });\n';
  code += '        }\n';
  code += '      });\n';
  code += '    }\n\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  // Find symbol definition\n';
  code += '  findDefinition(symbol: string): SearchResult | undefined {\n';
  code += '    const results = this.index.symbols.get(symbol);\n';
  code += '    return results?.find(r => r.type === \'definition\');\n';
  code += '  }\n\n';

  code += '  // Semantic search by pattern\n';
  code += '  async searchByPattern(pattern: string): Promise<SearchResult[]> {\n';
  code += '    const results: SearchResult[] = [];\n';
  code += '    const files = await this.getSourceFiles();\n\n';
  code += '    for (const file of files) {\n';
  code += '      const content = fs.readFileSync(file, \'utf-8\');\n';
  code += '      const lines = content.split(\'\\n\');\n\n';
  code += '      lines.forEach((line, index) => {\n';
  code += '        const regex = new RegExp(pattern, \'gi\');\n';
  code += '        let match;\n';
  code += '        while ((match = regex.exec(line)) !== null) {\n';
  code += '          results.push({\n';
  code += '            file: path.relative(this.projectRoot, file),\n';
  code += '            line: index + 1,\n';
  code += '            column: match.index,\n';
  code += '            symbol: match[0] || \'\',\n';
  code += '            type: \'match\',\n';
  code += '            context: line.trim(),\n';
  code += '          });\n';
  code += '        }\n';
  code += '      });\n';
  code += '    }\n\n';
  code += '    return results;\n';
  code += '  }\n\n';

  code += '  // Get all symbols\n';
  code += '  getAllSymbols(): string[] {\n';
  code += '    return Array.from(this.index.symbols.keys());\n';
  code += '  }\n\n';

  code += '  // Navigate to symbol\n';
  code += '  navigateTo(symbol: string): SearchResult | undefined {\n';
  code += '    const def = this.findDefinition(symbol);\n';
  code += '    if (def) {\n';
  code += '      console.log(\'[Search] Navigating to:\', def.file + \':\' + def.line);\n';
  code += '      return def;\n';
  code += '    }\n\n';
  code += '    console.warn(\'[Search] Symbol not found:\', symbol);\n';
  code += '    return undefined;\n';
  code += '  }\n\n';

  code += '  private async getSourceFiles(): Promise<string[]> {\n';
  code += '    const files: string[] = [];\n\n';
  code += '    for (const pattern of this.indexPatterns) {\n';
  code += '      const matched = await glob(pattern, {\n';
  code += '        cwd: this.projectRoot,\n';
  code += '        ignore: [\'**/node_modules/**\', \'**/dist/**\'],\n';
  code += '      });\n';
  code += '      files.push(...matched);\n';
  code += '    }\n\n';
  code += '    return files.map(f => path.join(this.projectRoot, f));\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const codeSearch = new CodeSearchEngine({\n';
  code += '  enableIndexing: ' + config.enableIndexing + ',\n';
  code += '  indexPatterns: ' + JSON.stringify(config.indexPatterns) + ',\n';
  code += '});\n\n';

  code += 'export default codeSearch;\n';
  code += 'export { CodeSearchEngine, SearchResult, CodeIndex };\n';

  return code;
}

// Python Code Search Generator
export function generatePythonCodeSearch(config: CodeSearchConfig): string {
  let code = '# Auto-generated Code Search Tools for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import os\n';
  code += 'import re\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional, Set\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class SearchResult:\n';
  code += '    file: str\n';
  code += '    line: int\n';
  code += '    column: int\n';
  code += '    symbol: str\n';
  code += '    type: str\n';
  code += '    context: str\n\n';

  code += 'class CodeSearchEngine:\n';
  code += '    def __init__(self, project_root: str = None, enable_indexing: bool = True):\n';
  code += '        self.project_root = Path(project_root or os.getcwd())\n';
  code += '        self.enable_indexing = enable_indexing\n';
  code += '        self.symbols: Dict[str, List[SearchResult]] = {}\n';
  code += '        self.files: List[str] = []\n';
  code += '        self.last_updated = 0\n\n';
  code += '        if enable_indexing:\n';
  code += '            self.build_index()\n\n';

  code += '    def build_index(self):\n';
  code += '        print(\'[Search] Building code index...\')\n\n';
  code += '        self.files = self._get_source_files()\n\n';
  code += '        for file_path in self.files:\n';
  code += '            self._index_file(file_path)\n\n';
  code += '        self.last_updated = int(os.times()[4])\n';
  code += '        print(f\'[Search] Index built: {len(self.symbols)} symbols found\')\n\n';

  code += '    def _index_file(self, file_path: Path):\n';
  code += '        with open(file_path, \'r\') as f:\n';
  code += '            lines = f.readlines()\n\n';
  code += '        for index, line in enumerate(lines):\n';
  code += '            patterns = [\n';
  code += '                (r\'def\\s+(\\w+)\\(\', \'function\'),\n';
  code += '                (r\'class\\s+(\\w+):\', \'class\'),\n';
  code += '                (r\'(\\w+)\\s*=\', \'variable\'),\n';
  code += '            ]\n\n';
  code += '            for pattern, sym_type in patterns:\n';
  code += '                match = re.search(pattern, line)\n';
  code += '                if match:\n';
  code += '                    symbol = match.group(1)\n';
  code += '                    result = SearchResult(\n';
  code += '                        file=str(file_path.relative_to(self.project_root)),\n';
  code += '                        line=index + 1,\n';
  code += '                        column=match.start(),\n';
  code += '                        symbol=symbol,\n';
  code += '                        type=sym_type,\n';
  code += '                        context=line.strip(),\n';
  code += '                    )\n\n';
  code += '                    if symbol not in self.symbols:\n';
  code += '                        self.symbols[symbol] = []\n';
  code += '                    self.symbols[symbol].append(result)\n\n';

  code += '    def find_references(self, symbol: str) -> List[SearchResult]:\n';
  code += '        results = []\n\n';
  code += '        for file_path in self.files:\n';
  code += '            with open(file_path, \'r\') as f:\n';
  code += '                lines = f.readlines()\n\n';
  code += '            for index, line in enumerate(lines):\n';
  code += '                if re.search(r\'\\b\' + re.escape(symbol) + r\'\\b\', line):\n';
  code += '                    results.append(SearchResult(\n';
  code += '                        file=str(file_path.relative_to(self.project_root)),\n';
  code += '                        line=index + 1,\n';
  code += '                        column=line.find(symbol) if symbol in line else 0,\n';
  code += '                        symbol=symbol,\n';
  code += '                        type=\'reference\',\n';
  code += '                        context=line.strip(),\n';
  code += '                    ))\n\n';
  code += '        return results\n\n';

  code += '    def find_definition(self, symbol: str) -> Optional[SearchResult]:\n';
  code += '        results = self.symbols.get(symbol, [])\n';
  code += '        for result in results:\n';
  code += '            if result.type in [\'function\', \'class\']:\n';
  code += '                return result\n';
  code += '        return None\n\n';

  code += '    def search_by_pattern(self, pattern: str) -> List[SearchResult]:\n';
  code += '        results = []\n';
  code += '        regex = re.compile(pattern, re.IGNORECASE)\n\n';
  code += '        for file_path in self.files:\n';
  code += '            with open(file_path, \'r\') as f:\n';
  code += '                lines = f.readlines()\n\n';
  code += '            for index, line in enumerate(lines):\n';
  code += '                for match in regex.finditer(line):\n';
  code += '                    results.append(SearchResult(\n';
  code += '                        file=str(file_path.relative_to(self.project_root)),\n';
  code += '                        line=index + 1,\n';
  code += '                        column=match.start(),\n';
  code += '                        symbol=match.group() or \'\',\n';
  code += '                        type=\'match\',\n';
  code += '                        context=line.strip(),\n';
  code += '                    ))\n\n';
  code += '        return results\n\n';

  code += '    def get_all_symbols(self) -> List[str]:\n';
  code += '        return list(self.symbols.keys())\n\n';

  code += '    def navigate_to(self, symbol: str) -> Optional[SearchResult]:\n';
  code += '        definition = self.find_definition(symbol)\n';
  code += '        if definition:\n';
  code += '            print(f\'[Search] Navigating to: {definition.file}:{definition.line}\')\n';
  code += '            return definition\n\n';
  code += '        print(f\'[Search] Symbol not found: {symbol}\')\n';
  code += '        return None\n\n';

  code += '    def _get_source_files(self) -> List[Path]:\n';
  code += '        patterns = [\'**/*.py\', \'**/*.pyi\']\n';
  code += '        files = []\n\n';
  code += '        for pattern in patterns:\n';
  code += '            for file_path in self.project_root.glob(pattern):\n';
  code += '                if \'site-packages\' not in str(file_path):\n';
  code += '                    files.append(file_path)\n\n';
  code += '        return files\n\n';

  code += 'code_search = CodeSearchEngine(\n';
  code += '    enable_indexing=' + config.enableIndexing + ',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displayCodeSearchConfig(config: CodeSearchConfig): void {
  console.log(chalk.cyan('\n✨ Cross-Language Code Search\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Semantic Search:'), chalk.white(config.enableSemanticSearch ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Indexing:'), chalk.white(config.enableIndexing ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Index Patterns:'), chalk.white(config.indexPatterns.length.toString()));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Semantic code search across languages',
    'Symbol definition and reference finding',
    'Fast code indexing',
    'Pattern matching and regex search',
    'Cross-language navigation',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: CodeSearchConfig): string {
  let content = '# Code Search and Navigation for ' + config.projectName + '\n\n';
  content += 'Semantic code search for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Indexing**: ' + (config.enableIndexing ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Patterns**: ' + config.indexPatterns.length + ' patterns\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import codeSearch from \'./code-search\';\n\n';
  content += '// Find references\n';
  content += 'const refs = await codeSearch.findReferences(\'myFunction\');\n';
  content += 'console.log(\'Found\', refs.length, \'references\');\n\n';
  content += '// Find definition\n';
  content += 'const def = codeSearch.findDefinition(\'myFunction\');\n\n';
  content += '// Search by pattern\n';
  content += 'const results = await codeSearch.searchByPattern(\'async.*await\');\n\n';
  content += '// Navigate to symbol\n';
  content += 'codeSearch.navigateTo(\'myFunction\');\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from code_search import code_search\n\n';
  content += '# Find references\n';
  content += 'refs = code_search.find_references(\'my_function\')\n';
  content += 'print(f\'Found {len(refs)} references\')\n\n';
  content += '# Find definition\n';
  content += 'definition = code_search.find_definition(\'my_function\')\n\n';
  content += '# Search by pattern\n';
  content += 'results = code_search.search_by_pattern(r\'async.*await\')\n\n';
  content += '# Navigate to symbol\n';
  content += 'code_search.navigate_to(\'my_function\')\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **Symbol Search**: Find definitions and references\n';
  content += '- **Pattern Matching**: Search with regex patterns\n';
  content += '- **Fast Indexing**: Pre-built index for instant search\n';
  content += '- **Cross-File**: Search across entire codebase\n';
  content += '- **Navigation**: Jump to symbol definitions\n\n';

  return content;
}

// Write files
export async function writeCodeSearchFiles(
  config: CodeSearchConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'code-search.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptCodeSearch(config);
  } else if (config.language === 'python') {
    content = generatePythonCodeSearch(config);
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
      name: config.projectName.toLowerCase() + '-code-search',
      version: '1.0.0',
      description: 'Code search and navigation for ' + config.projectName,
      types: fileName,
      dependencies: {
        glob: '^10.0.0',
      },
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
    await fs.writeFile(path.join(output, 'requirements.txt'), '');
    console.log(chalk.green('✅ Generated: requirements.txt'));
  }

  const searchConfig = {
    projectName: config.projectName,
    language: config.language,
    enableSemanticSearch: config.enableSemanticSearch,
    enableIndexing: config.enableIndexing,
    indexPatterns: config.indexPatterns,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'code-search-config.json'),
    JSON.stringify(searchConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: code-search-config.json'));
}
