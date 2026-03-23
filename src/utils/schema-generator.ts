/**
 * JSON Schema Generator for IDE Autocompletion
 * Generates and publishes JSON schemas for workspace configuration files
 * with IDE-specific integrations for VSCode, IntelliJ, Vim, and Emacs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

export interface SchemaPublishOptions {
  outputDir?: string;
  vscodeDir?: string;
  createVscodeExtension?: boolean;
  format?: boolean;
  validate?: boolean;
}

/**
 * Generate VSCode settings for schema association
 */
export function generateVSCodeConfig(schemaPath: string): string {
  return JSON.stringify(
    {
      "yaml.schemas": {
        [schemaPath]: [
          "re-shell.workspaces.yaml",
          "re-shell.workspace.yaml",
          "workspace.yaml",
          "*.workspace.yaml",
          "workspaces/*.yaml"
        ]
      },
      "yaml.validate": true,
      "yaml.completion": true,
      "yaml.format.enable": true,
      "yaml.hover": true,
      "yaml.schemaStore.enable": false
    },
    null,
    2
  );
}

/**
 * Generate IntelliJ/IDEA schema mapping
 */
export function generateIntelliJConfig(): string {
  return `# IntelliJ/IDEA YAML Schema Configuration
# Add this to .idea/workspace.xml or project settings

<application>
  <component name="SchemaColorSettings">
    <options>
      <option name="SCHEMA_ASSOCIATIONS">
        <map>
          <entry key="re-shell.workspaces.yaml">
            <value>
              <SchemaInfo>
                <option name="name" value="Re-Shell Workspace" />
                <option name="namespace" value="https://re-shell.dev/schemas/workspace.schema.json" />
                <option name="fileRelativePath" value="schemas/re-shell-workspace.schema.json" />
              </SchemaInfo>
            </value>
          </entry>
        </map>
      </option>
    </options>
  </component>
</component>
`;
}

/**
 * Generate Vim/Neovim schema configuration
 */
export function generateVimConfig(): string {
  return `# Vim/Neovim YAML Schema Configuration
# Add to .vimrc or init.vim for vim-yaml-config

" Enable YAML completion with schemas
let g:yaml_schema_namespace_pattern = '^https://re-shell.dev/schemas/'

" Associate schema with workspace files
let g:yaml_schema_associations = {
  \\ 're-shell.workspaces.yaml': 'https://re-shell.dev/schemas/workspace.schema.json',
  \\ 'workspace.yaml': 'https://re-shell.dev/schemas/workspace.schema.json',
  \\}

" Enable completion
autocmd FileType yaml setlocal omnifunc=yamlcomplete#Complete
`;
}

/**
 * Generate Emacs schema configuration
 */
export function generateEmacsConfig(): string {
  return `;; Emacs YAML Schema Configuration
;; Add to init.el or .emacs for yaml-mode

(require 'yaml-mode)

;; Associate schema with workspace files
(add-to-list 'yaml-schema-alist
  '("re-shell.workspaces.yaml" .
    "https://re-shell.dev/schemas/workspace.schema.json"))

(add-to-list 'yaml-schema-alist
  '("workspace.yaml" .
    "https://re-shell.dev/schemas/workspace.schema.json"))

;; Enable auto-completion
(add-hook 'yaml-mode-hook
  (lambda ()
    (set (make-local-variable 'company-backends)
      '((company-yaml-vars company-capf company-dabbrev-code)))))
`;
}

/**
 * Generate package.json for VSCode extension
 */
export function generateVSCodeExtension(): string {
  return JSON.stringify(
    {
      "name": "re-shell-workspace",
      "displayName": "Re-Shell Workspace Language Support",
      "description": "IntelliSense, validation, and autocomplete for Re-Shell workspace configuration files",
      "version": "1.0.0",
      "publisher": "re-shell",
      "engines": {
        "vscode": "^1.80.0"
      },
      "categories": ["Programming Languages", "Snippets", "Formatters"],
      "contributes": {
        "languages": [{
          "id": "re-shell-workspace",
          "aliases": ["Re-Shell Workspace", "Workspace YAML"],
          "extensions": [".yaml", ".yml"],
          "filenames": [
            "re-shell.workspaces.yaml",
            "re-shell.workspace.yaml",
            "workspace.yaml"
          ],
          "configuration": "./language-configuration.json"
        }],
        "jsonValidation": [{
          "fileMatch": "re-shell.workspaces.yaml",
          "url": "https://re-shell.dev/schemas/workspace.schema.json"
        }],
        "yamlValidation": [{
          "fileMatch": "*workspace*.yaml",
          "url": "https://re-shell.dev/schemas/workspace.schema.json"
        }],
        "configuration": {
          "title": "Re-Shell Workspace",
          "properties": {
            "reShell.workspace.schemaPath": {
              "type": "string",
              "default": "./schemas/re-shell-workspace.schema.json",
              "description": "Path to workspace JSON schema"
            },
            "reShell.workspace.enableValidation": {
              "type": "boolean",
              "default": true,
              "description": "Enable YAML validation"
            },
            "reShell.workspace.enableCompletion": {
              "type": "boolean",
              "default": true,
              "description": "Enable auto-completion"
            }
          }
        }
      },
      "activationEvents": [
        "onLanguage:re-shell-workspace",
        "onStartupFinished"
      ],
      "main": "./out/extension.js",
      "scripts": {
        "vscode:prepublish": "npm run compile",
        "compile": "tsc -p ./",
        "watch": "tsc -watch -p ./"
      },
      "devDependencies": {
        "@types/node": "^20.0.0",
        "@types/vscode": "^1.80.0",
        "typescript": "^5.3.0"
      },
      "repository": {
        "type": "git",
        "url": "https://github.com/re-shell/re-shell-vscode"
      }
    },
    null,
    2
  );
}

/**
 * Generate language configuration for VSCode
 */
export function generateLanguageConfig(): string {
  return JSON.stringify(
    {
      "comments": {
        "lineComment": "#",
        "blockComment": ["/*", "*/"]
      },
      "brackets": [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ],
      "autoClosingPairs": [
        {"open": "{", "close": "}"},
        {"open": "[", "close": "]"},
        {"open": "(", "close": ")"},
        {"open": '"', "close": '"'},
        {"open": "'", "close": "'"}
      ],
      "surroundingPairs": [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
        ["'", "'"]
      ],
      "folding": {
        "markers": {
          "start": "^\\s*#region\\b",
          "end": "^\\s*#endregion\\b"
        }
      },
      "wordPattern": "([^\\s\\-\\[\\]{}()\\.\"'`=\\/\\!,\\?@#$%^&*\\+|]+)|([^\\s])"
    },
    null,
    2
  );
}

/**
 * Publish schemas to IDE configuration directories
 */
export async function publishSchemas(options: SchemaPublishOptions = {}): Promise<void> {
  const {
    outputDir = path.join(process.cwd(), 'schemas'),
    vscodeDir = path.join(os.homedir(), '.vscode'),
    createVscodeExtension = false,
  } = options;

  await fs.ensureDir(outputDir);

  // Copy schema file
  const schemaSource = path.join(__dirname, 'schemas', 're-shell-workspace.schema.json');
  const schemaDest = path.join(outputDir, 're-shell-workspace.schema.json');
  await fs.copy(schemaSource, schemaDest);

  console.log(`✅ Schema published to: ${schemaDest}`);

  // Generate VSCode settings.json
  const vscodeSettings = generateVSCodeConfig(schemaDest);
  const settingsPath = path.join(vscodeDir, 'settings.json');
  await fs.ensureDir(vscodeDir);

  let existingSettings: Record<string, any> = {};
  if (await fs.pathExists(settingsPath)) {
    try {
      existingSettings = await fs.readJson(settingsPath);
    } catch {
      // File exists but is invalid JSON, will overwrite
    }
  }

  // Merge settings
  const mergedSettings = {
    ...existingSettings,
    ...JSON.parse(vscodeSettings)
  };

  await fs.writeJson(settingsPath, mergedSettings, { spaces: 2 });
  console.log(`✅ VSCode settings updated: ${settingsPath}`);

  // Generate IDE-specific configs
  const intellijConfig = generateIntelliJConfig();
  const intellijPath = path.join(outputDir, 'intellij-config.xml');
  await fs.writeFile(intellijPath, intellijConfig);
  console.log(`✅ IntelliJ config: ${intellijPath}`);

  const vimConfig = generateVimConfig();
  const vimPath = path.join(outputDir, 'vim-config.vim');
  await fs.writeFile(vimPath, vimConfig);
  console.log(`✅ Vim config: ${vimPath}`);

  const emacsConfig = generateEmacsConfig();
  const emacsPath = path.join(outputDir, 'emacs-config.el');
  await fs.writeFile(emacsPath, emacsConfig);
  console.log(`✅ Emacs config: ${emacsPath}`);

  // Generate VSCode extension if requested
  if (createVscodeExtension) {
    const extensionDir = path.join(outputDir, 'vscode-extension');
    await fs.ensureDir(extensionDir);

    const extensionPackage = generateVSCodeExtension();
    await fs.writeJson(path.join(extensionDir, 'package.json'), JSON.parse(extensionPackage), { spaces: 2 });

    const languageConfig = generateLanguageConfig();
    await fs.writeJson(path.join(extensionDir, 'language-configuration.json'), JSON.parse(languageConfig), { spaces: 2 });

    console.log(`✅ VSCode extension: ${extensionDir}`);
  }

  console.log('\n📝 Setup Instructions:');
  console.log('   VSCode: Schema already registered in settings.json');
  console.log('   IntelliJ: Copy intellij-config.xml to .idea/workspace.xml');
  console.log('   Vim/Neovim: Copy vim-config.vim to ~/.vimrc or ~/.config/nvim/init.vim');
  console.log('   Emacs: Copy emacs-config.el to ~/.emacs or ~/.emacs.d/init.el');
}

/**
 * Validate YAML file against schema
 */
export async function validateWorkspaceFile(filePath: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!await fs.pathExists(filePath)) {
    errors.push(`File not found: ${filePath}`);
    return { valid: false, errors, warnings };
  }

  // Check file extension
  if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
    warnings.push('File should have .yaml or .yml extension');
  }

  // TODO: Add actual JSON schema validation using a library like ajv
  // This would require parsing the YAML and validating against the schema

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Get schema file path
 */
export function getSchemaPath(): string {
  return path.join(__dirname, 'schemas', 're-shell-workspace.schema.json');
}

/**
 * Load schema as JSON object
 */
export async function loadSchema(): Promise<any> {
  const schemaPath = getSchemaPath();
  return await fs.readJson(schemaPath);
}
