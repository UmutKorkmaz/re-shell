/**
 * Polyglot Configuration Management Generator
 */

import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';

export type ConfigLanguage = 'typescript' | 'python';

export interface ConfigSchema {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  default?: any;
  validation?: string;
  envVar?: string;
  description?: string;
}

export interface ConfigManagementConfig {
  projectName: string;
  language: ConfigLanguage;
  outputDir: string;
  schemas: ConfigSchema[];
  enableHotReload: boolean;
  enableValidation: boolean;
}

// TypeScript Generator
export function generateTypeScriptConfigManagement(config: ConfigManagementConfig): string {
  let code = '// Auto-generated Configuration Management for ' + config.projectName + '\n';
  code += '// Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import fs from \'fs\';\n';
  code += 'import path from \'path\';\n';
  code += 'import { EventEmitter } from \'events\';\n\n';
  code += 'type ConfigValue = string | number | boolean | object | any[];\n\n';
  code += 'interface ConfigSchema {\n';
  code += '  name: string;\n';
  code += '  type: \'string\' | \'number\' | \'boolean\' | \'object\' | \'array\';\n';
  code += '  required: boolean;\n';
  code += '  default?: ConfigValue;\n';
  code += '  envVar?: string;\n';
  code += '}\n\n';
  code += 'class ConfigManager extends EventEmitter {\n';
  code += '  private schemas: Map<string, ConfigSchema>;\n';
  code += '  private values: Map<string, ConfigValue>;\n';
  code += '  private configDir: string;\n\n';
  code += '  constructor(schemas: ConfigSchema[], options: any = {}) {\n';
  code += '    super();\n';
  code += '    this.schemas = new Map();\n';
  code += '    this.values = new Map();\n';
  code += '    this.configDir = options.configDir || process.cwd() + \'/config\';\n';
  code += '    schemas.forEach(s => this.schemas.set(s.name, s));\n';
  code += '    this.load();\n';
  code += '  }\n\n';
  code += '  load(): void {\n';
  code += '    this.loadConfigFile(\'default\');\n';
  code += '    const env = process.env.NODE_ENV || \'development\';\n';
  code += '    this.loadConfigFile(env);\n';
  code += '    this.emit(\'loaded\', this.getAll());\n';
  code += '  }\n\n';
  code += '  private loadConfigFile(env: string): void {\n';
  code += '    const configPath = path.join(this.configDir, env + \'.json\');\n';
  code += '    if (fs.existsSync(configPath)) {\n';
  code += '      try {\n';
  code += '        const config = JSON.parse(fs.readFileSync(configPath, \'utf-8\'));\n';
  code += '        for (const [key, value] of Object.entries(config)) {\n';
  code += '          this.set(key, value, false);\n';
  code += '        }\n';
  code += '      } catch (error) {\n';
  code += '        console.error(\'[Config] Error loading\', configPath, error);\n';
  code += '      }\n';
  code += '    }\n';
  code += '  }\n\n';
  code += '  get(key: string): ConfigValue | undefined {\n';
  code += '    const schema = this.schemas.get(key);\n';
  code += '    if (!schema) throw new Error(\'Unknown config key: \' + key);\n';
  code += '    if (this.values.has(key)) return this.values.get(key);\n';
  code += '    if (schema?.default !== undefined) return schema.default;\n';
  code += '    if (schema?.required) throw new Error(\'Required config missing: \' + key);\n';
  code += '    return undefined;\n';
  code += '  }\n\n';
  code += '  set(key: string, value: ConfigValue, emit = true): void {\n';
  code += '    const schema = this.schemas.get(key);\n';
  code += '    if (!schema) throw new Error(\'Unknown config key: \' + key);\n';
  code += '    this.values.set(key, value);\n';
  code += '    if (emit) this.emit(\'changed\', { key, value });\n';
  code += '  }\n\n';
  code += '  has(key: string): boolean {\n';
  code += '    return this.values.has(key);\n';
  code += '  }\n\n';
  code += '  getAll(): Record<string, ConfigValue> {\n';
  code += '    const result: Record<string, ConfigValue> = {};\n';
  code += '    this.schemas.forEach((schema, key) => {\n';
  code += '      result[key] = this.get(key) as ConfigValue;\n';
  code += '    });\n';
  code += '    return result;\n';
  code += '  }\n\n';
  code += '  export(): string {\n';
  code += '    return JSON.stringify(this.getAll(), null, 2);\n';
  code += '  }\n';
  code += '}\n\n';
  code += 'const schemas: ConfigSchema[] = ' + JSON.stringify(config.schemas, null, 2) + ';\n\n';
  code += 'const config = new ConfigManager(schemas, {\n';
  code += '  enableHotReload: ' + config.enableHotReload + ',\n';
  code += '  enableValidation: ' + config.enableValidation + ',\n';
  code += '});\n\n';
  code += 'export default config;\n';
  code += 'export { ConfigManager, ConfigSchema };\n';
  return code;
}

// Python Generator
export function generatePythonConfigManagement(config: ConfigManagementConfig): string {
  let code = '# Auto-generated Configuration Management for ' + config.projectName + '\n';
  code += '# Generated at: ' + new Date().toISOString() + '\n\n';
  code += 'import json\n';
  code += 'import os\n';
  code += 'from pathlib import Path\n';
  code += 'from typing import Any, Dict, Optional\n\n';
  code += 'class ConfigManager:\n';
  code += '    def __init__(self, schemas: list, env: str = \'development\'):\n';
  code += '        self.schemas = {s[\'name\']: s for s in schemas}\n';
  code += '        self.values: Dict[str, Any] = {}\n';
  code += '        self.config_dir = Path(\'config\')\n';
  code += '        self.env = env\n';
  code += '        self.load()\n\n';
  code += '    def load(self):\n';
  code += '        self._load_config_file(\'default\')\n';
  code += '        self._load_config_file(self.env)\n\n';
  code += '    def _load_config_file(self, env: str):\n';
  code += '        config_path = self.config_dir / (env + \'.json\')\n';
  code += '        if config_path.exists():\n';
  code += '            with open(config_path) as f:\n';
  code += '                config = json.load(f)\n';
  code += '                for key, value in config.items():\n';
  code += '                    self.set(key, value)\n\n';
  code += '    def get(self, key: str) -> Optional[Any]:\n';
  code += '        if key in self.values:\n';
  code += '            return self.values[key]\n';
  code += '        schema = self.schemas.get(key)\n';
  code += '        if schema and schema.get(\'default\') is not None:\n';
  code += '            return schema[\'default\']\n';
  code += '        if schema and schema.get(\'required\'):\n';
  code += '            raise ValueError(f\'Required config missing: {key}\')\n';
  code += '        return None\n\n';
  code += '    def set(self, key: str, value: Any):\n';
  code += '        self.values[key] = value\n\n';
  code += '    def has(self, key: str) -> bool:\n';
  code += '        return key in self.values\n\n';
  code += '    def get_all(self) -> Dict[str, Any]:\n';
  code += '        return {key: self.get(key) for key in self.schemas}\n\n';
  code += '    def export(self) -> str:\n';
  code += '        return json.dumps(self.get_all(), indent=2)\n\n';
  code += 'schemas = ' + JSON.stringify(config.schemas, null, 2) + '\n\n';
  code += 'config = ConfigManager(schemas, os.getenv(\'NODE_ENV\', \'development\'))\n';
  return code;
}

export function displayConfigConfig(config: ConfigManagementConfig): void {
  console.log(chalk.cyan('\n✨ Configuration Management\n'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.yellow('Project:'), chalk.white(config.projectName));
  console.log(chalk.yellow('Language:'), chalk.white(config.language));
  console.log(chalk.yellow('Schemas:'), chalk.white(config.schemas.length.toString()));
  console.log(chalk.yellow('Hot Reload:'), chalk.white(config.enableHotReload ? 'Enabled' : 'Disabled'));
  console.log(chalk.yellow('Validation:'), chalk.white(config.enableValidation ? 'Enabled' : 'Disabled'));
  console.log(chalk.gray('─'.repeat(60)) + '\n');
}

export function generateBuildMD(config: ConfigManagementConfig): string {
  let content = '# Configuration Management for ' + config.projectName + '\n\n';
  content += 'Schema-driven configuration with validation for **' + config.projectName + '**.\n\n';
  content += '## Schemas\n\n';
  content += '| Name | Type | Required | Default |\n';
  content += '|------|------|----------|---------|\n';

  config.schemas.forEach((s: ConfigSchema) => {
    const def = s.default !== undefined ? JSON.stringify(s.default) : '-';
    const req = s.required ? '✓' : '-';
    content += '| ' + s.name + ' | ' + s.type + ' | ' + req + ' | ' + def + ' |\n';
  });

  content += '\n## Usage\n\n';
  content += '### TypeScript\n';
  content += '```typescript\n';
  content += 'import config from \'./config-management\';\n\n';
  content += '// Get values\n';
  content += 'const port = config.get(\'port\');\n\n';
  content += '// Set values\n';
  content += 'config.set(\'debug\', true);\n\n';
  content += '// Check existence\n';
  content += 'if (config.has(\'feature\')) {\n';
  content += '  console.log(config.get(\'feature\'));\n';
  content += '}\n';
  content += '```\n\n';

  content += '### Python\n';
  content += '```python\n';
  content += 'from config_management import config\n\n';
  content += '# Get values\n';
  content += 'port = config.get(\'port\')\n\n';
  content += '# Set values\n';
  content += 'config.set(\'debug\', True)\n\n';
  content += '# Check existence\n';
  content += 'if config.has(\'feature\'):\n';
  content += '    print(config.get(\'feature\'))\n';
  content += '```\n\n';

  return content;
}

export async function writeConfigManagementFiles(
  config: ConfigManagementConfig,
  output: string
): Promise<void> {
  const ext = config.language === 'typescript' ? 'ts' : 'py';
  const fileName = 'config-management.' + ext;
  const filePath = path.join(output, fileName);

  let content: string;
  if (config.language === 'typescript') {
    content = generateTypeScriptConfigManagement(config);
  } else if (config.language === 'python') {
    content = generatePythonConfigManagement(config);
  } else {
    throw new Error('Unsupported language: ' + config.language);
  }

  await fs.ensureDir(output);
  await fs.writeFile(filePath, content);
  console.log(chalk.green('✅ Generated: ' + fileName));

  const buildMD = generateBuildMD(config);
  await fs.writeFile(path.join(output, 'BUILD.md'), buildMD);
  console.log(chalk.green('✅ Generated: BUILD.md'));

  const configDir = path.join(output, 'config');
  await fs.ensureDir(configDir);
  await fs.writeFile(path.join(configDir, 'default.json'), JSON.stringify({
    port: 3000,
    host: 'localhost',
    debug: false
  }, null, 2));
  console.log(chalk.green('✅ Generated: config/default.json'));
}
