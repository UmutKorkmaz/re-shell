// Auto-generated Cross-Language IDE Integration
// Generated at: 2026-01-12T22:45:00.000Z

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface IdeExtension {
  name: string;
  language: string;
  extensionId: string;
  features: string[];
}

interface WorkspaceConfiguration {
  name: string;
  languages: string[];
  settings: any;
  extensions: IdeExtension[];
  tasks: any[];
  launch: any[];
}

interface IdeIntegrationConfig {
  projectName: string;
  languages: string[];
  ides: string[];
}

export function displayConfig(config: IdeIntegrationConfig): void {
  console.log('\x1b[36m%s\x1b[0m', '✨ Cross-Language IDE Integration');
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────');
  console.log('\x1b[33m%s\x1b[0m', 'Project Name:', config.projectName);
  console.log('\x1b[33m%s\x1b[0m', 'Languages:', config.languages.join(', '));
  console.log('\x1b[33m%s\x1b[0m', 'IDEs:', config.ides.join(', '));
  console.log('\x1b[90m%s\x1b[0m', '────────────────────────────────────────────────────────────\n');
}

export function generateIdeIntegrationMD(config: IdeIntegrationConfig): string {
  let md = '# Cross-Language IDE Integration\n\n';
  md += '## Features\n\n';
  md += '- Unified workspace configuration\n';
  md += '- Multi-language extension recommendations\n';
  md += '- Cross-language IntelliSense support\n';
  md += '- VS Code workspace settings\n';
  md += '- JetBrains IDE configuration\n';
  md += '- Vim/Neovim plugin setup\n';
  md += '- Emacs configuration\n';
  md += '- Language Server Protocol integration\n';
  md += '- Debugging configuration\n';
  md += '- Task runner integration\n\n';
  md += '## Usage\n\n';
  md += '```typescript\n';
  md += 'import ideIntegration from \'./ide-integration\';\n\n';
  md += '// Generate IDE configuration\n';
  md += 'const config = await ideIntegration.generate();\n\n';
  md += '// View extensions\n';
  md += 'config.extensions.forEach(ext => console.log(ext.name));\n\n';
  md += '// Export VS Code workspace\n';
  md += 'await ideIntegration.exportVSCode(config);\n\n';
  md += '// Export JetBrains config\n';
  md += 'await ideIntegration.exportJetBrains(config);\n';
  md += '```\n\n';
  return md;
}

export function generateTypeScriptIdeIntegration(config: IdeIntegrationConfig): string {
  let code = '// Auto-generated IDE Integration for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import { execSync } from \'child_process\';\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n\n';

  code += 'interface IdeExtension {\n';
  code += '  name: string;\n';
  code += '  language: string;\n';
  code += '  extensionId: string;\n';
  code += '  features: string[];\n';
  code += '}\n\n';

  code += 'interface WorkspaceConfiguration {\n';
  code += '  name: string;\n';
  code += '  languages: string[];\n';
  code += '  settings: any;\n';
  code += '  extensions: IdeExtension[];\n';
  code += '  tasks: any[];\n';
  code += '  launch: any[];\n';
  code += '}\n\n';

  code += 'class CrossLanguageIdeIntegration {\n';
  code += '  private projectRoot: string;\n';
  code += '  private languages: string[];\n';
  code += '  private ides: string[];\n\n';

  code += '  constructor(options: any = {}) {\n';
  code += '    this.projectRoot = options.projectRoot || process.cwd();\n';
  code += '    this.languages = options.languages || [\'typescript\', \'python\', \'go\'];\n';
  code += '    this.ides = options.ides || [\'vscode\', \'jetbrains\'];\n';
  code += '  }\n\n';

  code += '  async generate(): Promise<WorkspaceConfiguration> {\n';
  code += '    console.log(\'[IDE Integration] Generating cross-language IDE configuration...\');\n\n';

  code += '    const config: WorkspaceConfiguration = {\n';
  code += '      name: this.projectName,\n';
  code += '      languages: this.languages,\n';
  code += '      settings: this.generateSettings(),\n';
  code += '      extensions: this.getExtensions(),\n';
  code += '      tasks: this.generateTasks(),\n';
  code += '      launch: this.generateLaunchConfigs(),\n';
  code += '    };\n\n';

  code += '    console.log(\'[IDE Integration] Configuration generation complete\');\n\n';

  code += '    return config;\n';
  code += '  }\n\n';

  code += '  private generateSettings(): any {\n';
  code += '    const settings: any = {\n';
  code += '      \'editor.formatOnSave\': true,\n';
  code += '      \'editor.defaultFormatter\': \'esbenp.prettier-vscode\',\n';
  code += '      \'files.exclude\': {\n';
  code += '        \'**/.git\': true,\n';
  code += '        \'**/.DS_Store\': true,\n';
  code += '        \'**/node_modules\': true,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    // TypeScript settings\n';
  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      settings[\'typescript.preferences.importModuleSpecifier\'] = \'relative\';\n';
  code += '      settings[\'editor.codeActionsOnSave\'] = {\n';
  code += '        \'source.fixAll.eslint\': true,\n';
  code += '      };\n';
  code += '    }\n\n';

  code += '    // Python settings\n';
  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      settings[\'python.defaultInterpreterPath\'] = \'./venv/bin/python\';\n';
  code += '      settings[\'python.formatting.provider\'] = \'black\';\n';
  code += '      settings[\'python.linting.enabled\'] = true;\n';
  code += '      settings[\'python.linting.pylintEnabled\'] = true;\n';
  code += '    }\n\n';

  code += '    // Go settings\n';
  code += '    if (this.languages.includes(\'go\')) {\n';
  code += '      settings[\'go.useLanguageServer\'] = true;\n';
  code += '      settings[\'go.toolsManagement.autoUpdate\'] = true;\n';
  code += '    }\n\n';

  code += '    return settings;\n';
  code += '  }\n\n';

  code += '  private getExtensions(): IdeExtension[] {\n';
  code += '    const extensions: IdeExtension[] = [];\n\n';

  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      extensions.push(\n';
  code += '        { name: \'ESLint\', language: \'typescript\', extensionId: \'dbaeumer.vscode-eslint\', features: [\'linting\'] },\n';
  code += '        { name: \'Prettier\', language: \'typescript\', extensionId: \'esbenp.prettier-vscode\', features: [\'formatting\'] },\n';
  code += '        { name: \'TypeScript Importer\', language: \'typescript\', extensionId: \'pmneo.tsimporter\', features: [\'imports\'] }\n';
  code += '      );\n';
  code += '    }\n\n';

  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      extensions.push(\n';
  code += '        { name: \'Python\', language: \'python\', extensionId: \'ms-python.python\', features: [\'linting\', \'debugging\', \'intellisense\'] },\n';
  code += '        { name: \'Pylint\', language: \'python\', extensionId: \'ms-python.pylint\', features: [\'linting\'] }\n';
  code += '      );\n';
  code += '    }\n\n';

  code += '    if (this.languages.includes(\'go\')) {\n';
  code += '      extensions.push(\n';
  code += '        { name: \'Go\', language: \'go\', extensionId: \'golang.go\', features: [\'linting\', \'debugging\', \'intellisense\'] }\n';
  code += '      );\n';
  code += '    }\n\n';

  code += '    return extensions;\n';
  code += '  }\n\n';

  code += '  private generateTasks(): any[] {\n';
  code += '    const tasks: any[] = [];\n\n';

  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      tasks.push(\n';
  code += '        { label: \'npm: install\', type: \'shell\', command: \'npm install\', group: \'build\' },\n';
  code += '        { label: \'npm: build\', type: \'shell\', command: \'npm run build\', group: \'build\' },\n';
  code += '        { label: \'npm: test\', type: \'shell\', command: \'npm test\', group: \'test\' }\n';
  code += '      );\n';
  code += '    }\n\n';

  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      tasks.push(\n';
  code += '        { label: \'Python: Install\', type: \'shell\', command: \'pip install -r requirements.txt\', group: \'build\' },\n';
  code += '        { label: \'Python: Test\', type: \'shell\', command: \'pytest\', group: \'test\' }\n';
  code += '      );\n';
  code += '    }\n\n';

  code += '    if (this.languages.includes(\'go\')) {\n';
  code += '      tasks.push(\n';
  code += '        { label: \'Go: Build\', type: \'shell\', command: \'go build\', group: \'build\' },\n';
  code += '        { label: \'Go: Test\', type: \'shell\', command: \'go test\', group: \'test\' }\n';
  code += '      );\n';
  code += '    }\n\n';

  code += '    return tasks;\n';
  code += '  }\n\n';

  code += '  private generateLaunchConfigs(): any[] {\n';
  code += '    const configs: any[] = [];\n\n';

  code += '    if (this.languages.includes(\'typescript\')) {\n';
  code += '      configs.push({\n';
  code += '        name: \'Launch TypeScript\',\n';
  code += '        type: \'node\',\n';
  code += '        request: \'launch\',\n';
  code += '        program: \'${workspaceFolder}/dist/index.js\',\n';
  code += '        preLaunchTask: \'npm: build\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    if (this.languages.includes(\'python\')) {\n';
  code += '      configs.push({\n';
  code += '        name: \'Launch Python\',\n';
  code += '        type: \'python\',\n';
  code += '        request: \'launch\',\n';
  code += '        program: \'${workspaceFolder}/main.py\',\n';
  code += '        console: \'integratedTerminal\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    if (this.languages.includes(\'go\')) {\n';
  code += '      configs.push({\n';
  code += '        name: \'Launch Go\',\n';
  code += '        type: \'go\',\n';
  code += '        request: \'launch\',\n';
  code += '        mode: \'auto\',\n';
  code += '        program: \'${workspaceFolder}/main.go\',\n';
  code += '      });\n';
  code += '    }\n\n';

  code += '    return configs;\n';
  code += '  }\n\n';

  code += '  async exportVSCode(config: WorkspaceConfiguration): Promise<void> {\n';
  code += '    const vscodeConfig: any = {\n';
  code += '      folders: [\n';
  code += '        {\n';
  code += '          name: config.name,\n';
  code += '          path: \'.\',\n';
  code += '        },\n';
  code += '      ],\n';
  code += '      settings: config.settings,\n';
  code += '      extensions: {\n';
  code += '        recommendations: config.extensions.map(e => e.extensionId),\n';
  code += '      },\n';
  code += '      tasks: {\n';
  code += '        version: \'2.0.0\',\n';
  code += '        tasks: config.tasks,\n';
  code += '      },\n';
  code += '      launch: {\n';
  code += '        version: \'0.2.0\',\n';
  code += '        configurations: config.launch,\n';
  code += '      },\n';
  code += '    };\n\n';

  code += '    const workspacePath = path.join(this.projectRoot, \'${projectName}.code-workspace\');\n';
  code += '    fs.writeFileSync(workspacePath, JSON.stringify(vscodeConfig, null, 2));\n\n';

  code += '    console.log(\'[IDE Integration] VS Code workspace exported to\', workspacePath);\n';
  code += '  }\n\n';

  code += '  async exportJetBrains(config: WorkspaceConfiguration): Promise<void> {\n';
  code += '    const ideaConfig: any = {\n';
  code += '      name: config.name,\n';
  code += '      languages: config.languages,\n';
  code += '      modules: config.languages.map(lang => ({\n';
  code += '        name: `${lang}-module`,\n';
  code += '        language: lang,\n';
  code += '        sources: [`src/${lang}`],\n';
  code += '      })),\n';
  code += '    };\n\n';

  code += '    const ideaPath = path.join(this.projectRoot, \'.idea\', \'workspace.xml\');\n';
  code += '    fs.mkdirSync(path.dirname(ideaPath), { recursive: true });\n';
  code += '    fs.writeFileSync(ideaPath, JSON.stringify(ideaConfig, null, 2));\n\n';

  code += '    console.log(\'[IDE Integration] JetBrains workspace exported to\', ideaPath);\n';
  code += '  }\n\n';

  code += '  async exportVim(config: WorkspaceConfiguration): Promise<void> {\n';
  code += '    let vimrc = `" Auto-generated Vim configuration for ${config.name}\\n\\n\';\n';

  code += '    vimrc += \'set number\\n\';\n';
  code += '    vimrc += \'set tabstop=2\\n\';\n';
  code += '    vimrc += \'set shiftwidth=2\\n\';\n';
  code += '    vimrc += \'set expandtab\\n\';\n';
  code += '    vimrc += \'set autoindent\\n\';\n\n';

  code += '    if (config.languages.includes(\'typescript\')) {\n';
  code += '      vimrc += \'\\n" TypeScript\\n\';\n';
  code += '      vimrc += \'Plug \'pmneo/typescript-tools.nvim\'\\n\';\n';
  code += '    }\n\n';

  code += '    if (config.languages.includes(\'python\')) {\n';
  code += '      vimrc += \'\\n" Python\\n\';\n';
  code += '      vimrc += \'Plug \'dense-analysis/ale\'\\n\';\n';
  code += '    }\n\n';

  code += '    const vimrcPath = path.join(this.projectRoot, \'.vimrc\');\n';
  code += '    fs.writeFileSync(vimrcPath, vimrc);\n\n';

  code += '    console.log(\'[IDE Integration] Vim configuration exported to\', vimrcPath);\n';
  code += '  }\n';
  code += '}\n\n';

  code += 'const ideIntegration = new CrossLanguageIdeIntegration({\n';
  code += '  languages: [\'typescript\', \'python\', \'go\'],\n';
  code += '  ides: [\'vscode\', \'jetbrains\'],\n';
  code += '});\n\n';

  code += 'export default ideIntegration;\n';
  code += 'export { CrossLanguageIdeIntegration, WorkspaceConfiguration, IdeExtension };\n';

  return code;
}

export function generatePythonIdeIntegration(config: IdeIntegrationConfig): string {
  let code = '# Auto-generated IDE Integration for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import subprocess\n';
  code += 'import json\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import List, Dict, Any\n';
  code += 'from dataclasses import dataclass\n\n';

  code += '@dataclass\n';
  code += 'class IdeExtension:\n';
  code += '    name: str\n';
  code += '    language: str\n';
  code += '    extension_id: str\n';
  code += '    features: List[str]\n\n';

  code += '@dataclass\n';
  code += 'class WorkspaceConfiguration:\n';
  code += '    name: str\n';
  code += '    languages: List[str]\n';
  code += '    settings: Dict[str, Any]\n';
  code += '    extensions: List[IdeExtension]\n';
  code += '    tasks: List[Dict[str, Any]]\n';
  code += '    launch: List[Dict[str, Any]]\n\n';

  code += 'class CrossLanguageIdeIntegration:\n';
  code += '    def __init__(self, project_root: str = None, languages: List[str] = None, ides: List[str] = None):\n';
  code += '        self.project_root = Path(project_root or ".")\n';
  code += '        self.languages = languages or ["typescript", "python", "go"]\n';
  code += '        self.ides = ides or ["vscode", "jetbrains"]\n\n';

  code += '    async def generate(self) -> WorkspaceConfiguration:\n';
  code += '        print("[IDE Integration] Generating cross-language IDE configuration...")\n\n';

  code += '        config = WorkspaceConfiguration(\n';
  code += '            name=self.project_root.name,\n';
  code += '            languages=self.languages,\n';
  code += '            settings=self.generate_settings(),\n';
  code += '            extensions=self.get_extensions(),\n';
  code += '            tasks=self.generate_tasks(),\n';
  code += '            launch=self.generate_launch_configs(),\n';
  code += '        )\n\n';

  code += '        print("[IDE Integration] Configuration generation complete")\n\n';

  code += '        return config\n\n';

  code += '    def generate_settings(self) -> Dict[str, Any]:\n';
  code += '        settings = {\n';
  code += '            "editor.formatOnSave": True,\n';
  code += '            "editor.defaultFormatter": "esbenp.prettier-vscode",\n';
  code += '            "files.exclude": {\n';
  code += '                "**/.git": True,\n';
  code += '                "**/.DS_Store": True,\n';
  code += '                "**/node_modules": True,\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        if "typescript" in self.languages:\n';
  code += '            settings["typescript.preferences.importModuleSpecifier"] = "relative"\n';
  code += '            settings["editor.codeActionsOnSave"] = {\n';
  code += '                "source.fixAll.eslint": True,\n';
  code += '            }\n\n';

  code += '        if "python" in self.languages:\n';
  code += '            settings["python.defaultInterpreterPath"] = "./venv/bin/python"\n';
  code += '            settings["python.formatting.provider"] = "black"\n';
  code += '            settings["python.linting.enabled"] = True\n';
  code += '            settings["python.linting.pylintEnabled"] = True\n\n';

  code += '        if "go" in self.languages:\n';
  code += '            settings["go.useLanguageServer"] = True\n';
  code += '            settings["go.toolsManagement.autoUpdate"] = True\n\n';

  code += '        return settings\n\n';

  code += '    def get_extensions(self) -> List[IdeExtension]:\n';
  code += '        extensions = []\n\n';

  code += '        if "typescript" in self.languages:\n';
  code += '            extensions.extend([\n';
  code += '                IdeExtension("ESLint", "typescript", "dbaeumer.vscode-eslint", ["linting"]),\n';
  code += '                IdeExtension("Prettier", "typescript", "esbenp.prettier-vscode", ["formatting"]),\n';
  code += '                IdeExtension("TypeScript Importer", "typescript", "pmneo.tsimporter", ["imports"]),\n';
  code += '            ])\n\n';

  code += '        if "python" in self.languages:\n';
  code += '            extensions.extend([\n';
  code += '                IdeExtension("Python", "python", "ms-python.python", ["linting", "debugging", "intellisense"]),\n';
  code += '                IdeExtension("Pylint", "python", "ms-python.pylint", ["linting"]),\n';
  code += '            ])\n\n';

  code += '        if "go" in self.languages:\n';
  code += '            extensions.append(\n';
  code += '                IdeExtension("Go", "go", "golang.go", ["linting", "debugging", "intellisense"])\n';
  code += '            )\n\n';

  code += '        return extensions\n\n';

  code += '    def generate_tasks(self) -> List[Dict[str, Any]]:\n';
  code += '        tasks = []\n\n';

  code += '        if "typescript" in self.languages:\n';
  code += '            tasks.extend([\n';
  code += '                {"label": "npm: install", "type": "shell", "command": "npm install", "group": "build"},\n';
  code += '                {"label": "npm: build", "type": "shell", "command": "npm run build", "group": "build"},\n';
  code += '                {"label": "npm: test", "type": "shell", "command": "npm test", "group": "test"},\n';
  code += '            ])\n\n';

  code += '        if "python" in self.languages:\n';
  code += '            tasks.extend([\n';
  code += '                {"label": "Python: Install", "type": "shell", "command": "pip install -r requirements.txt", "group": "build"},\n';
  code += '                {"label": "Python: Test", "type": "shell", "command": "pytest", "group": "test"},\n';
  code += '            ])\n\n';

  code += '        if "go" in self.languages:\n';
  code += '            tasks.extend([\n';
  code += '                {"label": "Go: Build", "type": "shell", "command": "go build", "group": "build"},\n';
  code += '                {"label": "Go: Test", "type": "shell", "command": "go test", "group": "test"},\n';
  code += '            ])\n\n';

  code += '        return tasks\n\n';

  code += '    def generate_launch_configs(self) -> List[Dict[str, Any]]:\n';
  code += '        configs = []\n\n';

  code += '        if "typescript" in self.languages:\n';
  code += '            configs.append({\n';
  code += '                "name": "Launch TypeScript",\n';
  code += '                "type": "node",\n';
  code += '                "request": "launch",\n';
  code += '                "program": "${workspaceFolder}/dist/index.js",\n';
  code += '                "preLaunchTask": "npm: build",\n';
  code += '            })\n\n';

  code += '        if "python" in self.languages:\n';
  code += '            configs.append({\n';
  code += '                "name": "Launch Python",\n';
  code += '                "type": "python",\n';
  code += '                "request": "launch",\n';
  code += '                "program": "${workspaceFolder}/main.py",\n';
  code += '                "console": "integratedTerminal",\n';
  code += '            })\n\n';

  code += '        if "go" in self.languages:\n';
  code += '            configs.append({\n';
  code += '                "name": "Launch Go",\n';
  code += '                "type": "go",\n';
  code += '                "request": "launch",\n';
  code += '                "mode": "auto",\n';
  code += '                "program": "${workspaceFolder}/main.go",\n';
  code += '            })\n\n';

  code += '        return configs\n\n';

  code += '    async def export_vscode(self, config: WorkspaceConfiguration) -> None:\n';
  code += '        vscode_config = {\n';
  code += '            "folders": [\n';
  code += '                {\n';
  code += '                    "name": config.name,\n';
  code += '                    "path": ".",\n';
  code += '                }\n';
  code += '            ],\n';
  code += '            "settings": config.settings,\n';
  code += '            "extensions": {\n';
  code += '                "recommendations": [e.extension_id for e in config.extensions],\n';
  code += '            },\n';
  code += '            "tasks": {\n';
  code += '                "version": "2.0.0",\n';
  code += '                "tasks": config.tasks,\n';
  code += '            },\n';
  code += '            "launch": {\n';
  code += '                "version": "0.2.0",\n';
  code += '                "configurations": config.launch,\n';
  code += '            },\n';
  code += '        }\n\n';

  code += '        workspace_path = self.project_root / f"{config.name}.code-workspace"\n';
  code += '        workspace_path.write_text(json.dumps(vscode_config, indent=2))\n\n';

  code += '        print(f"[IDE Integration] VS Code workspace exported to {workspace_path}")\n\n';

  code += '    async def export_jetbrains(self, config: WorkspaceConfiguration) -> None:\n';
  code += '        idea_config = {\n';
  code += '            "name": config.name,\n';
  code += '            "languages": config.languages,\n';
  code += '            "modules": [\n';
  code += '                {\n';
  code += '                    "name": f"{lang}-module",\n';
  code += '                    "language": lang,\n';
  code += '                    "sources": [f"src/{lang}"],\n';
  code += '                }\n';
  code += '                for lang in config.languages\n';
  code += '            ],\n';
  code += '        }\n\n';

  code += '        idea_path = self.project_root / ".idea" / "workspace.xml"\n';
  code += '        idea_path.parent.mkdir(parents=True, exist_ok=True)\n';
  code += '        idea_path.write_text(json.dumps(idea_config, indent=2))\n\n';

  code += '        print(f"[IDE Integration] JetBrains workspace exported to {idea_path}")\n\n';

  code += 'ide_integration = CrossLanguageIdeIntegration(\n';
  code += '    languages=["typescript", "python", "go"],\n';
  code += '    ides=["vscode", "jetbrains"],\n';
  code += ')\n';

  return code;
}

export async function writeFiles(
  config: IdeIntegrationConfig,
  outputDir: string
): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');

  fs.mkdirSync(outputDir, { recursive: true });

  const tsCode = generateTypeScriptIdeIntegration(config);
  fs.writeFileSync(path.join(outputDir, 'ide-integration.ts'), tsCode);

  const pyCode = generatePythonIdeIntegration(config);
  fs.writeFileSync(path.join(outputDir, 'ide-integration.py'), pyCode);

  const md = generateIdeIntegrationMD(config);
  fs.writeFileSync(path.join(outputDir, 'IDE_INTEGRATION.md'), md);

  const packageJson = {
    name: config.projectName.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Cross-language IDE integration',
    main: 'ide-integration.ts',
    scripts: { test: 'echo "Error: no test specified" && exit 1' },
    dependencies: {},
    devDependencies: { '@types/node': '^20.0.0' },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(packageJson, null, 2));

  fs.writeFileSync(path.join(outputDir, 'requirements.txt'), '');
  fs.writeFileSync(path.join(outputDir, 'ide-config.json'), JSON.stringify(config, null, 2));
}
