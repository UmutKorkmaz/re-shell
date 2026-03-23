/**
 * Polyglot Code Completion and IntelliSense with Cross-Language Context
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type CompletionLanguage = 'typescript' | 'python';

export interface CompletionConfig {
  projectName: string;
  language: CompletionLanguage;
  outputDir: string;
  enableContextAware: boolean;
  enableCrossLanguage: boolean;
  enableSnippetCompletion: boolean;
}

// TypeScript Code Completion (Simplified)
export function generateTypeScriptCompletion(config: CompletionConfig): string {
  let code = '// Auto-generated Code Completion for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface CompletionItem {\n';
  code += '  label: string;\n';
  code += '  kind: string;\n';
  code += '  detail: string;\n';
  code += '  documentation?: string;\n';
  code += '  insertText: string;\n';
  code += '  sortText: string;\n';
  code += '  filterText: string;\n';
  code += '}\n\n';

  code += 'interface CompletionContext {\n';
  code += '  language: string;\n';
  code += '  file: string;\n';
  code += '  line: number;\n';
  code += '  column: number;\n';
  code += '  prefix: string;\n';
  code += '  symbols: Map<string, any>;\n';
  code += '}\n\n';

  code += 'class CodeCompletionProvider {\n';
  code += '  private projectRoot: string;\n';
  code += '  private symbolIndex: Map<string, any>;\n';
  code += '  private enableContextAware: boolean;\n';
  code += '  private enableCrossLanguage: boolean;\n';
  code += '  private enableSnippetCompletion: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.symbolIndex = new Map();\n';
  code += '    this.enableContextAware = options.enableContextAware !== false;\n';
  code += '    this.enableCrossLanguage = options.enableCrossLanguage !== false;\n';
  code += '    this.enableSnippetCompletion = options.enableSnippetCompletion !== false;\n';
  code += '    this.buildIndex();\n';
  code += '  }\n\n';

  code += '  buildIndex(): void {\n';
  code += '    console.log(\'[Completion] Building symbol index...\');\n';
  code += '    // TODO: Implement full indexing\n';
  code += '  }\n\n';

  code += '  getCompletions(context: CompletionContext): CompletionItem[] {\n';
  code += '    const completions: CompletionItem[] = [];\n\n';

  code += '    // Add keyword completions\n';
  code += '    const keywords = [\n';
  code += '      \'interface\', \'type\', \'class\', \'function\', \'const\', \'let\', \'var\',\n';
  code += '      \'import\', \'export\', \'from\', \'async\', \'await\', \'return\', \'if\', \'else\',\n';
  code += '    ];\n\n';

  code += '    for (const keyword of keywords) {\n';
  code += '      if (keyword.startsWith(context.prefix)) {\n';
  code += '        completions.push({\n';
  code += '          label: keyword,\n';
  code += '          kind: \'Keyword\',\n';
  code += '          detail: \'TypeScript keyword\',\n';
  code += '          insertText: keyword,\n';
  code += '          sortText: \'0_\' + keyword,\n';
  code += '          filterText: keyword,\n';
  code += '        });\n';
  code += '      }\n';
  code += '    }\n\n';

  code += '    // Add snippet completions\n';
  code += '    if (this.enableSnippetCompletion) {\n';
  code += '      const snippets = this.getSnippets(context);\n';
  code += '      completions.push(...snippets);\n';
  code += '    }\n\n';

  code += '    return completions;\n';
  code += '  }\n\n';

  code += '  getSnippets(context: CompletionContext): CompletionItem[] {\n';
  code += '    const snippets: CompletionItem[] = [];\n\n';

  code += '    if (\'cl\'.startsWith(context.prefix)) {\n';
  code += '      snippets.push({\n';
  code += '        label: \'console.log\',\n';
  code += '        kind: \'Snippet\',\n';
  code += '        detail: \'Console log statement\',\n';
  code += '        documentation: \'Insert a console.log statement\',\n';
  code += '        insertText: \'console.log();\',\n';
  code += '        sortText: \'1_console.log\',\n';
  code += '        filterText: \'cl\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    if (\'fn\'.startsWith(context.prefix)) {\n';
  code += '      snippets.push({\n';
  code += '        label: \'function\',\n';
  code += '        kind: \'Snippet\',\n';
  code += '        detail: \'Function declaration\',\n';
  code += '        documentation: \'Insert a function declaration\',\n';
  code += '        insertText: \'function ${1:name}(${2:params}) {\\n  ${0}\\n}\',\n';
  code += '        sortText: \'1_function\',\n';
  code += '        filterText: \'fn\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return snippets;\n';
  code += '  }\n\n';

  code += '  resolveCompletion(item: CompletionItem): any {\n';
  code += '    console.log(\'[Completion] Resolving:\', item.label);\n';
  code += '    return item;\n';
  code += '  }\n\n';

  code += '  getCrossLanguageCompletions(context: CompletionContext): CompletionItem[] {\n';
  code += '    if (!this.enableCrossLanguage) return [];\n';
  code += '    console.log(\'[Completion] Getting cross-language completions...\');\n';
  code += '    return [];\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const completion = new CodeCompletionProvider({\n';
  code += '  enableContextAware: ' + config.enableContextAware + ',\n';
  code += '  enableCrossLanguage: ' + config.enableCrossLanguage + ',\n';
  code += '  enableSnippetCompletion: ' + config.enableSnippetCompletion + ',\n';
  code += '});\n\n';

  code += 'export default completion;\n';
  code += 'export { CodeCompletionProvider, CompletionItem, CompletionContext };\n';

  return code;
}

// Python Code Completion (Simplified)
export function generatePythonCompletion(config: CompletionConfig): string {
  let code = '# Auto-generated Code Completion for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import os\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class CompletionItem:\n';
  code += '    label: str\n';
  code += '    kind: str\n';
  code += '    detail: str\n';
  code += '    documentation: Optional[str] = None\n';
  code += '    insert_text: str = ""\n';
  code += '    sort_text: str = ""\n';
  code += '    filter_text: str = ""\n\n';

  code += '    def __post_init__(self):\n';
  code += '        if not self.insert_text:\n';
  code += '            self.insert_text = self.label\n';
  code += '        if not self.sort_text:\n';
  code += '            self.sort_text = self.label\n';
  code += '        if not self.filter_text:\n';
  code += '            self.filter_text = self.label\n\n';

  code += '@dataclass\n';
  code += 'class CompletionContext:\n';
  code += '    language: str\n';
  code += '    file: str\n';
  code += '    line: int\n';
  code += '    column: int\n';
  code += '    prefix: str\n';
  code += '    symbols: Dict[str, Any] = None\n\n';

  code += '    def __post_init__(self):\n';
  code += '        if self.symbols is None:\n';
  code += '            self.symbols = {}\n\n';

  code += 'class CodeCompletionProvider:\n';
  code += '    def __init__(self, project_root: str = None, enable_context_aware: bool = True, enable_cross_language: bool = True, enable_snippet_completion: bool = True):\n';
  code += '        self.project_root = Path(project_root or os.getcwd())\n';
  code += '        self.symbol_index: Dict[str, Any] = {}\n';
  code += '        self.enable_context_aware = enable_context_aware\n';
  code += '        self.enable_cross_language = enable_cross_language\n';
  code += '        self.enable_snippet_completion = enable_snippet_completion\n';
  code += '        self.build_index()\n\n';

  code += '    def build_index(self) -> None:\n';
  code += '        print(\'[Completion] Building symbol index...\')\n';
  code += '        # TODO: Implement full indexing\n';
  code += '        pass\n\n';

  code += '    def get_completions(self, context: CompletionContext) -> List[CompletionItem]:\n';
  code += '        completions = []\n\n';

  code += '        # Add keyword completions\n';
  code += '        keywords = [\n';
  code += '            \'def\', \'class\', \'import\', \'from\', \'return\', \'if\', \'else\',\n';
  code += '            \'elif\', \'for\', \'while\', \'with\', \'async\', \'await\',\n';
  code += '        ]\n\n';

  code += '        for keyword in keywords:\n';
  code += '            if keyword.startswith(context.prefix):\n';
  code += '                completions.append(CompletionItem(\n';
  code += '                    label=keyword,\n';
  code += '                    kind=\'Keyword\',\n';
  code += '                    detail=\'Python keyword\',\n';
  code += '                    sort_text=\'0_\' + keyword,\n';
  code += '                ))\n\n';

  code += '        # Add snippet completions\n';
  code += '        if self.enable_snippet_completion:\n';
  code += '            snippets = self.get_snippets(context)\n';
  code += '            completions.extend(snippets)\n\n';

  code += '        return completions\n\n';

  code += '    def get_snippets(self, context: CompletionContext) -> List[CompletionItem]:\n';
  code += '        snippets = []\n\n';

  code += '        if \'pr\'.startswith(context.prefix):\n';
  code += '            snippets.append(CompletionItem(\n';
  code += '                label=\'print\',\n';
  code += '                kind=\'Snippet\',\n';
  code += '                detail=\'Print statement\',\n';
  code += '                documentation=\'Insert a print statement\',\n';
  code += '                insert_text="print()",' + '\n';
  code += '                sort_text=\'1_print\',\n';
  code += '                filter_text=\'pr\',\n';
  code += '            ))\n\n';

  code += '        if \'fn\'.startswith(context.prefix) or \'def\'.startswith(context.prefix):\n';
  code += '            snippets.append(CompletionItem(\n';
  code += '                label=\'def\',\n';
  code += '                kind=\'Snippet\',\n';
  code += '                detail=\'Function definition\',\n';
  code += '                documentation=\'Insert a function definition\',\n';
  code += '                insert_text=\'def ${1:name}(${2:params}):\n    ${0}\',\n';
  code += '                sort_text=\'1_def\',\n';
  code += '                filter_text=\'def fn\',\n';
  code += '            ))\n\n';

  code += '        return snippets\n\n';

  code += '    def resolve_completion(self, item: CompletionItem) -> Any:\n';
  code += '        print(f\'[Completion] Resolving: {item.label}\')\n';
  code += '        return item\n\n';

  code += '    def get_cross_language_completions(self, context: CompletionContext) -> List[CompletionItem]:\n';
  code += '        if not self.enable_cross_language:\n';
  code += '            return []\n';
  code += '        print(\'[Completion] Getting cross-language completions...\')\n';
  code += '        return []\n\n';

  code += 'completion = CodeCompletionProvider(\n';
  code += '    enable_context_aware=' + (config.enableContextAware ? 'True' : 'False') + ',\n';
  code += '    enable_cross_language=' + (config.enableCrossLanguage ? 'True' : 'False') + ',\n';
  code += '    enable_snippet_completion=' + (config.enableSnippetCompletion ? 'True' : 'False') + ',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displayCompletionConfig(config: CompletionConfig): void {
  console.log(chalk.cyan('\n✨ Polyglot Code Completion with Cross-Language Context\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Context Aware:'), chalk.white(config.enableContextAware ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Cross-Language:'), chalk.white(config.enableCrossLanguage ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Snippet Completion:'), chalk.white(config.enableSnippetCompletion ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Polyglot code completion and IntelliSense',
    'Cross-language context awareness',
    'Snippet management and expansion',
    'Symbol indexing and resolution',
    'Multi-language support',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: CompletionConfig): string {
  let content = '# Polyglot Code Completion for ' + config.projectName + '\n\n';
  content += 'Polyglot code completion and IntelliSense with cross-language context for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Context Aware**: ' + (config.enableContextAware ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Cross-Language**: ' + (config.enableCrossLanguage ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Snippet Completion**: ' + (config.enableSnippetCompletion ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import completion from \'./code-completion\';\n\n';
  content += '// Get completions for a context\n';
  content += 'const context: CompletionContext = {\n';
  content += '  language: \'typescript\',\n';
  content += '  file: \'src/index.ts\',\n';
  content += '  line: 10,\n';
  content += '  column: 5,\n';
  content += '  prefix: \'con\',\n';
  content += '  symbols: new Map(),\n';
  content += '};\n\n';
  content += 'const items = completion.getCompletions(context);\n';
  content += 'console.log(items);\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from code_completion import completion, CompletionContext\n\n';
  content += '# Get completions for a context\n';
  content += 'context = CompletionContext(\n';
  content += '    language=\'python\',\n';
  content += '    file=\'src/index.py\',\n';
  content += '    line=10,\n';
  content += '    column=5,\n';
  content += '    prefix=\'pr\',\n';
  content += ')\n\n';
  content += 'items = completion.get_completions(context)\n';
  content += 'print(items)\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **Code Completion**: Intelligent code suggestions based on context\n';
  content += '- **Cross-Language**: Completions across different language files\n';
  content += '- **Snippets**: Pre-built code snippets for common patterns\n';
  content += '- **Symbol Indexing**: Fast symbol lookups and resolution\n';
  content += '- **Context Aware**: Suggestions based on file and cursor position\n\n';

  return content;
}

// Write files
export async function writeCompletionFiles(
  config: CompletionConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'code-completion.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptCompletion(config);
  } else if (config.language === 'python') {
    content = generatePythonCompletion(config);
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
      name: config.projectName.toLowerCase() + '-completion',
      version: '1.0.0',
      description: 'Code completion for ' + config.projectName,
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

  const completionConfig = {
    projectName: config.projectName,
    language: config.language,
    enableContextAware: config.enableContextAware,
    enableCrossLanguage: config.enableCrossLanguage,
    enableSnippetCompletion: config.enableSnippetCompletion,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'completion-config.json'),
    JSON.stringify(completionConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: completion-config.json'));
}
