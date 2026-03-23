/**
 * Polyglot Snippet Management and Sharing with Template Expansion
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type SnippetLanguage = 'typescript' | 'python';

export interface SnippetConfig {
  projectName: string;
  language: SnippetLanguage;
  outputDir: string;
  enableSharing: boolean;
  enableTemplateExpansion: boolean;
  enableCategories: boolean;
}

// TypeScript Snippet Management (Simplified)
export function generateTypeScriptSnippets(config: SnippetConfig): string {
  let code = '// Auto-generated Snippet Management for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface CodeSnippet {\n';
  code += '  id: string;\n';
  code += '  name: string;\n';
  code += '  description: string;\n';
  code += '  language: string;\n';
  code += '  category?: string;\n';
  code += '  template: string;\n';
  code += '  variables: string[];\n';
  code += '}\n\n';

  code += 'interface ExpandedSnippet {\n';
  code += '  original: CodeSnippet;\n';
  code += '  code: string;\n';
  code += '  values: Record<string, string>;\n';
  code += '}\n\n';

  code += 'class SnippetManager {\n';
  code += '  private snippets: Map<string, CodeSnippet>;\n';
  code += '  private categories: Set<string>;\n';
  code += '  private enableSharing: boolean;\n';
  code += '  private enableTemplateExpansion: boolean;\n';
  code += '  private enableCategories: boolean;\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.snippets = new Map();\n';
  code += '    this.categories = new Set();\n';
  code += '    this.enableSharing = options.enableSharing !== false;\n';
  code += '    this.enableTemplateExpansion = options.enableTemplateExpansion !== false;\n';
  code += '    this.enableCategories = options.enableCategories !== false;\n';
  code += '    this.loadDefaultSnippets();\n';
  code += '  }\n\n';

  code += '  loadDefaultSnippets(): void {\n';
  code += '    console.log(\'[Snippet] Loading default snippets...\');\n\n';

  code += '    const defaults: CodeSnippet[] = [\n';
  code += '      {\n';
  code += '        id: \'react-component\',\n';
  code += '        name: \'React Component\',\n';
  code += '        description: \'Basic React functional component\',\n';
  code += '        language: \'typescript\',\n';
  code += '        category: \'React\',\n';
  code += '        template: \'import React from "react";\\n\\ninterface ${1:Name}Props {\\n  // TODO\\n}\\n\\nexport const ${1:Name}: React.FC<${1:Name}Props> = ({}) => {\\n  return (<div>${2:content}</div>);\\n};\\n\',\n';
  code += '        variables: [\'Name\', \'content\'],\n';
  code += '      },\n';
  code += '      {\n';
  code += '        id: \'async-function\',\n';
  code += '        name: \'Async Function\',\n';
  code += '        description: \'Async function template\',\n';
  code += '        language: \'typescript\',\n';
  code += '        category: \'Functions\',\n';
  code += '        template: \'async function ${1:name}(${2:params}): Promise<${3:returnType}> {\\n  ${4:// implementation}\\n}\\n\',\n';
  code += '        variables: [\'name\', \'params\', \'returnType\'],\n';
  code += '      },\n';
  code += '      {\n';
  code += '        id: \'api-fetch\',\n';
  code += '        name: \'API Fetch\',\n';
  code += '        description: \'Fetch data from API\',\n';
  code += '        language: \'typescript\',\n';
  code += '        category: \'API\',\n';
  code += '        template: \'const response = await fetch("${1:url}");\\nconst data = await response.json();\\nconsole.log(data);\\n\',\n';
  code += '        variables: [\'url\'],\n';
  code += '      },\n';
  code += '    ];\n\n';

  code += '    for (const snippet of defaults) {\n';
  code += '      this.addSnippet(snippet);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  addSnippet(snippet: CodeSnippet): void {\n';
  code += '    this.snippets.set(snippet.id, snippet);\n';
  code += '    if (snippet.category && this.enableCategories) {\n';
  code += '      this.categories.add(snippet.category);\n';
  code += '    }\n';
  code += '  }\n\n';

  code += '  getSnippet(id: string): CodeSnippet | undefined {\n';
  code += '    return this.snippets.get(id);\n';
  code += '  }\n\n';

  code += '  expandSnippet(id: string, values: Record<string, string>): ExpandedSnippet | undefined {\n';
  code += '    if (!this.enableTemplateExpansion) {\n';
  code += '      console.warn(\'[Snippet] Template expansion is disabled\');\n';
  code += '      return undefined;\n';
  code += '    }\n\n';

  code += '    const snippet = this.getSnippet(id);\n';
  code += '    if (!snippet) return undefined;\n\n';

  code += '    let code = snippet.template;\n';
  code += '    for (const [key, value] of Object.entries(values)) {\n';
  code += '      const pattern = "${" + key + \':[^}]*}\';\n';
  code += '      code = code.replace(new RegExp(pattern, "g"), value);\n';
  code += '    }\n\n';

  code += '    return {\n';
  code += '      original: snippet,\n';
  code += '      code,\n';
  code += '      values,\n';
  code += '    };\n';
  code += '  }\n\n';

  code += '  listSnippets(category?: string): CodeSnippet[] {\n';
  code += '    const all = Array.from(this.snippets.values());\n';
  code += '    if (category && this.enableCategories) {\n';
  code += '      return all.filter(s => s.category === category);\n';
  code += '    }\n';
  code += '    return all;\n';
  code += '  }\n\n';

  code += '  searchSnippets(query: string): CodeSnippet[] {\n';
  code += '    const q = query.toLowerCase();\n';
  code += '    return Array.from(this.snippets.values()).filter(s =>\n';
  code += '      s.name.toLowerCase().includes(q) ||\n';
  code += '      s.description.toLowerCase().includes(q)\n';
  code += '    );\n';
  code += '  }\n\n';

  code += '  exportSnippet(id: string, filePath: string): void {\n';
  code += '    const snippet = this.getSnippet(id);\n';
  code += '    if (!snippet) {\n';
  code += '      console.warn(\'[Snippet] Snippet not found:\', id);\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    fs.writeFileSync(filePath, JSON.stringify(snippet, null, 2));\n';
  code += '    console.log(\'[Snippet] Exported to:\', filePath);\n';
  code += '  }\n\n';

  code += '  importSnippet(filePath: string): void {\n';
  code += '    if (!this.enableSharing) {\n';
  code += '      console.warn(\'[Snippet] Sharing is disabled\');\n';
  code += '      return;\n';
  code += '    }\n\n';

  code += '    const content = fs.readFileSync(filePath, \'utf-8\');\n';
  code += '    const snippet: CodeSnippet = JSON.parse(content);\n';
  code += '    this.addSnippet(snippet);\n';
  code += '    console.log(\'[Snippet] Imported:\', snippet.id);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const snippetManager = new SnippetManager({\n';
  code += '  enableSharing: ' + config.enableSharing + ',\n';
  code += '  enableTemplateExpansion: ' + config.enableTemplateExpansion + ',\n';
  code += '  enableCategories: ' + config.enableCategories + ',\n';
  code += '});\n\n';

  code += 'export default snippetManager;\n';
  code += 'export { SnippetManager, CodeSnippet, ExpandedSnippet };\n';

  return code;
}

// Python Snippet Management (Simplified)
export function generatePythonSnippets(config: SnippetConfig): string {
  let code = '# Auto-generated Snippet Management for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Optional, Any\n';
  code += 'from dataclasses import dataclass, field\n\n';

  code += '@dataclass\n';
  code += 'class CodeSnippet:\n';
  code += '    id: str\n';
  code += '    name: str\n';
  code += '    description: str\n';
  code += '    language: str\n';
  code += '    category: Optional[str] = None\n';
  code += '    template: str = ""\n';
  code += '    variables: List[str] = field(default_factory=list)\n\n';

  code += '@dataclass\n';
  code += 'class ExpandedSnippet:\n';
  code += '    original: CodeSnippet\n';
  code += '    code: str\n';
  code += '    values: Dict[str, str]\n\n';

  code += 'class SnippetManager:\n';
  code += '    def __init__(self, enable_sharing: bool = True, enable_template_expansion: bool = True, enable_categories: bool = True):\n';
  code += '        self.snippets: Dict[str, CodeSnippet] = {}\n';
  code += '        self.categories = set()\n';
  code += '        self.enable_sharing = enable_sharing\n';
  code += '        self.enable_template_expansion = enable_template_expansion\n';
  code += '        self.enable_categories = enable_categories\n';
  code += '        self.load_default_snippets()\n\n';

  code += '    def load_default_snippets(self) -> None:\n';
  code += '        print(\'[Snippet] Loading default snippets...\')\n\n';

  code += '        defaults = [\n';
  code += '            CodeSnippet(\n';
  code += '                id=\'dataclass\',\n';
  code += '                name=\'Dataclass\',\n';
  code += '                description=\'Python dataclass template\',\n';
  code += '                language=\'python\',\n';
  code += '                category=\'Classes\',\n';
  code += '                template=\'@dataclass\\nclass ${1:ClassName}:\\n    ${2:field1}: str\\n    ${3:field2}: int\\n\',\n';
  code += '                variables=[\'ClassName\', \'field1\', \'field2\'],\n';
  code += '            ),\n';
  code += '            CodeSnippet(\n';
  code += '                id=\'async-function\',\n';
  code += '                name=\'Async Function\',\n';
  code += '                description=\'Async function template\',\n';
  code += '                language=\'python\',\n';
  code += '                category=\'Functions\',\n';
  code += '                template=\'async def ${1:name}(${2:params}) -> ${3:return_type}:\\n    """${4:docstring}"""\\n    ${5:# implementation}\\n\',\n';
  code += '                variables=[\'name\', \'params\', \'return_type\'],\n';
  code += '            ),\n';
  code += '            CodeSnippet(\n';
  code += '                id=\'context-manager\',\n';
  code += '                name=\'Context Manager\',\n';
  code += '                description=\'Context manager template\',\n';
  code += '                language=\'python\',\n';
  code += '                category=\'Patterns\',\n';
  code += '                template=\'from contextlib import contextmanager\\n\\n@contextmanager\\ndef ${1:name}():\\n    ${2:# setup}\\n    yield ${3:value}\\n    ${4:# teardown}\\n\',\n';
  code += '                variables=[\'name\', \'value\'],\n';
  code += '            ),\n';
  code += '        ]\n\n';

  code += '        for snippet in defaults:\n';
  code += '            self.add_snippet(snippet)\n\n';

  code += '    def add_snippet(self, snippet: CodeSnippet) -> None:\n';
  code += '        self.snippets[snippet.id] = snippet\n';
  code += '        if snippet.category and self.enable_categories:\n';
  code += '            self.categories.add(snippet.category)\n\n';

  code += '    def get_snippet(self, id: str) -> Optional[CodeSnippet]:\n';
  code += '        return self.snippets.get(id)\n\n';

  code += '    def expand_snippet(self, id: str, values: Dict[str, str]) -> Optional[ExpandedSnippet]:\n';
  code += '        if not self.enable_template_expansion:\n';
  code += '            print(\'[Snippet] Template expansion is disabled\')\n';
  code += '            return None\n\n';

  code += '        snippet = self.get_snippet(id)\n';
  code += '        if not snippet:\n';
  code += '            return None\n\n';

  code += '        code = snippet.template\n';
  code += '        for key, value in values.items():\n';
  code += '            import re\n';
  code += '            code = re.sub(re.escape("${" + key + \':")}[^}]*}\', str(value), code)\n\n';

  code += '        return ExpandedSnippet(\n';
  code += '            original=snippet,\n';
  code += '            code=code,\n';
  code += '            values=values,\n';
  code += '        )\n\n';

  code += '    def list_snippets(self, category: str = None) -> List[CodeSnippet]:\n';
  code += '        all_snippets = list(self.snippets.values())\n';
  code += '        if category and self.enable_categories:\n';
  code += '            return [s for s in all_snippets if s.category == category]\n';
  code += '        return all_snippets\n\n';

  code += '    def search_snippets(self, query: str) -> List[CodeSnippet]:\n';
  code += '        q = query.lower()\n';
  code += '        return [\n';
  code += '            s for s in self.snippets.values()\n';
  code += '            if q in s.name.lower() or q in s.description.lower()\n';
  code += '        ]\n\n';

  code += '    def export_snippet(self, id: str, file_path: str) -> None:\n';
  code += '        snippet = self.get_snippet(id)\n';
  code += '        if not snippet:\n';
  code += '            print(f\'[Snippet] Snippet not found: {id}\')\n';
  code += '            return\n\n';

  code += '        with open(file_path, \'w\') as f:\n';
  code += '            json.dump(snippet.__dict__, f, indent=2)\n';
  code += '        print(f\'[Snippet] Exported to: {file_path}\')\n\n';

  code += '    def import_snippet(self, file_path: str) -> None:\n';
  code += '        if not self.enable_sharing:\n';
  code += '            print(\'[Snippet] Sharing is disabled\')\n';
  code += '            return\n\n';

  code += '        with open(file_path, \'r\') as f:\n';
  code += '            data = json.load(f)\n';
  code += '        snippet = CodeSnippet(**data)\n';
  code += '        self.add_snippet(snippet)\n';
  code += '        print(f\'[Snippet] Imported: {snippet.id}\')\n\n';

  code += 'snippet_manager = SnippetManager(\n';
  code += '    enable_sharing=' + (config.enableSharing ? 'True' : 'False') + ',\n';
  code += '    enable_template_expansion=' + (config.enableTemplateExpansion ? 'True' : 'False') + ',\n';
  code += '    enable_categories=' + (config.enableCategories ? 'True' : 'False') + ',\n';
  code += ')\n';

  return code;
}

// Display configuration
export function displaySnippetConfig(config: SnippetConfig): void {
  console.log(chalk.cyan('\n✨ Polyglot Snippet Management with Template Expansion\n'));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.yellow('Project Name:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Sharing:'), chalk.white(config.enableSharing ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Template Expansion:'), chalk.white(config.enableTemplateExpansion ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Categories:'), chalk.white(config.enableCategories ? 'Enabled' : 'Disabled'));

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan('\n🎯 Features:\n'));

  const features = [
    'Polyglot snippet management',
    'Template expansion with variables',
    'Snippet sharing and import/export',
    'Category-based organization',
    'Search and discovery',
  ];

  features.forEach((feature, index) => {
    console.log('  ' + chalk.green('✓') + ' ' + chalk.white(feature));
  });

  console.log(chalk.gray('\n' + '─'.repeat(60) + '\n'));
}

// Generate BUILD.md
export function generateBuildMD(config: SnippetConfig): string {
  let content = '# Polyglot Snippet Management for ' + config.projectName + '\n\n';
  content += 'Polyglot snippet management and sharing with template expansion for **' + config.projectName + '**.\n\n';

  content += '## 📋 Configuration\n\n';
  content += '- **Project**: ' + config.projectName + '\n';
  content += '- **Language**: ' + config.language + '\n';
  content += '- **Sharing**: ' + (config.enableSharing ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Template Expansion**: ' + (config.enableTemplateExpansion ? 'Enabled' : 'Disabled') + '\n';
  content += '- **Categories**: ' + (config.enableCategories ? 'Enabled' : 'Disabled') + '\n\n';

  content += '## 💻 Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import snippetManager from \'./snippet-management\';\n\n';
  content += '// List all snippets\n';
  content += 'const snippets = snippetManager.listSnippets();\n';
  content += 'console.log(snippets);\n\n';
  content += '// Search snippets\n';
  content += 'const results = snippetManager.searchSnippets(\'react\');\n\n';
  content += '// Expand snippet with variables\n';
  content += 'const expanded = snippetManager.expandSnippet(\'react-component\', {\n';
  content += '  name: \'Button\',\n';
  content += '  content: \'Click me\',\n';
  content += '});\n';
  content += 'console.log(expanded.code);\n\n';
  content += '// Export/Import snippets\n';
  content += 'snippetManager.exportSnippet(\'react-component\', \'./snippet.json\');\n';
  content += 'snippetManager.importSnippet(\'./shared-snippet.json\');\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from snippet_management import snippet_manager\n\n';
  content += '# List all snippets\n';
  content += 'snippets = snippet_manager.list_snippets()\n';
  content += 'print(snippets)\n\n';
  content += '# Search snippets\n';
  content += 'results = snippet_manager.search_snippets(\'async\')\n\n';
  content += '# Expand snippet with variables\n';
  content += 'expanded = snippet_manager.expand_snippet(\'dataclass\', {\n';
  content += '    \'ClassName\': \'User\',\n';
  content += '    \'field1\': \'name\',\n';
  content += '})\n';
  content += 'print(expanded.code)\n\n';
  content += '# Export/Import snippets\n';
  content += 'snippet_manager.export_snippet(\'dataclass\', \'./snippet.json\')\n';
  content += 'snippet_manager.import_snippet(\'./shared-snippet.json\')\n';
  content += '```\n\n';

  content += '## 📚 Features\n\n';
  content += '- **Snippet Library**: Pre-built code snippets for common patterns\n';
  content += '- **Template Expansion**: Variables in snippets for customization\n';
  content += '- **Sharing**: Import/export snippets for team collaboration\n';
  content += '- **Categories**: Organize snippets by language or framework\n';
  content += '- **Search**: Quick discovery of relevant snippets\n\n';

  return content;
}

// Write files
export async function writeSnippetFiles(
  config: SnippetConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'snippet-management.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptSnippets(config);
  } else if (config.language === 'python') {
    content = generatePythonSnippets(config);
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
      name: config.projectName.toLowerCase() + '-snippets',
      version: '1.0.0',
      description: 'Snippet management for ' + config.projectName,
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

  const snippetConfig = {
    projectName: config.projectName,
    language: config.language,
    enableSharing: config.enableSharing,
    enableTemplateExpansion: config.enableTemplateExpansion,
    enableCategories: config.enableCategories,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
    },
  };

  await fs.writeFile(
    path.join(output, 'snippet-config.json'),
    JSON.stringify(snippetConfig, null, 2)
  );
  console.log(chalk.green('✅ Generated: snippet-config.json'));
}
