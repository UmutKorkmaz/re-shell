/**
 * JSON Schema Generator for IDE Autocompletion
 * Generates and publishes JSON schemas for workspace configuration files
 * with IDE-specific integrations for VSCode, IntelliJ, Vim, and Emacs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import Ajv, { type ErrorObject } from 'ajv';
// The canonical v2 schema is the single source of truth. Importing the JSON
// directly (resolved relative to source) guarantees validation uses the same
// document the IDE-autocomplete schema is published from, regardless of any
// build-time copy under dist/utils/schemas.
import workspaceV2Schema from '../schemas/workspace-v2.schema.json';

/**
 * Owned/served placeholder for the published IDE schema. Deliberately NOT
 * re-shell.dev: it points at a path we control so VSCode/IntelliJ can resolve a
 * stable $id without depending on an unowned domain.
 */
export const SCHEMA_ID =
  'https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json';

/**
 * A single field-level validation error, mirroring ajv's shape but reduced to
 * the two pieces of information callers need: where it happened and what failed.
 */
export interface SchemaValidationError {
  /** JSON Pointer instance path locating where in the document the error occurred (empty string for whole-document errors). */
  instancePath: string;
  /** Human-readable description of the validation failure. */
  message: string;
}

/**
 * Options controlling how {@link publishSchemas} emits IDE configuration files.
 */
export interface SchemaPublishOptions {
  /** Directory where the schema and IDE-specific config files are written. Defaults to `<cwd>/schemas`. */
  outputDir?: string;
  /** VSCode user settings directory whose `settings.json` is updated with schema associations. Defaults to `~/.vscode`. */
  vscodeDir?: string;
  /** When `true`, additionally generates a VSCode extension scaffold under `outputDir/vscode-extension`. Defaults to `false`. */
  createVscodeExtension?: boolean;
  /** Reserved for future use; controls whether emitted files are pretty-printed. */
  format?: boolean;
  /** Reserved for future use; controls whether the published schema is validated before emission. */
  validate?: boolean;
}

/**
 * Generate VSCode settings for schema association.
 *
 * The returned JSON string maps the workspace JSON schema to the common
 * re-shell workspace YAML file names and enables YAML validation/completion.
 *
 * @param schemaPath - Absolute or relative path/URL to the workspace JSON schema that VSCode should associate with the workspace files.
 * @returns A pretty-printed JSON string suitable for writing to VSCode's `settings.json`.
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
 * Generate IntelliJ/IDEA schema mapping.
 *
 * The returned XML snippet registers the re-shell workspace schema against the
 * `re-shell.workspaces.yaml` file name inside IntelliJ's `SchemaColorSettings`.
 *
 * @returns An XML string intended to be merged into `.idea/workspace.xml`.
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
                <option name="namespace" value="https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json" />
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
 * Generate Vim/Neovim schema configuration.
 *
 * The returned Vimscript configures schema namespace matching, file
 * associations, and omnifunc-based completion for `yaml` filetypes.
 *
 * @returns A Vimscript snippet to append to `.vimrc` or `init.vim`.
 */
export function generateVimConfig(): string {
  return `# Vim/Neovim YAML Schema Configuration
# Add to .vimrc or init.vim for vim-yaml-config

" Enable YAML completion with schemas
let g:yaml_schema_namespace_pattern = '^https://schemas.umutkorkmaz.dev/re-shell/'

" Associate schema with workspace files
let g:yaml_schema_associations = {
  \\ 're-shell.workspaces.yaml': 'https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json',
  \\ 'workspace.yaml': 'https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json',
  \\}

" Enable completion
autocmd FileType yaml setlocal omnifunc=yamlcomplete#Complete
`;
}

/**
 * Generate Emacs schema configuration.
 *
 * The returned Emacs Lisp registers the re-shell workspace schema against the
 * relevant YAML file names and wires up `company`-based completion within
 * `yaml-mode`.
 *
 * @returns An Emacs Lisp snippet to append to `init.el` or `.emacs`.
 */
export function generateEmacsConfig(): string {
  return `;; Emacs YAML Schema Configuration
;; Add to init.el or .emacs for yaml-mode

(require 'yaml-mode)

;; Associate schema with workspace files
(add-to-list 'yaml-schema-alist
  '("re-shell.workspaces.yaml" .
    "https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json"))

(add-to-list 'yaml-schema-alist
  '("workspace.yaml" .
    "https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json"))

;; Enable auto-completion
(add-hook 'yaml-mode-hook
  (lambda ()
    (set (make-local-variable 'company-backends)
      '((company-yaml-vars company-capf company-dabbrev-code)))))
`;
}

/**
 * Generate `package.json` content for a minimal VSCode extension that provides
 * IntelliSense, validation, and autocomplete for re-shell workspace files.
 *
 * @returns A pretty-printed JSON string representing the extension's `package.json`.
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
          "url": "https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json"
        }],
        "yamlValidation": [{
          "fileMatch": "*workspace*.yaml",
          "url": "https://schemas.umutkorkmaz.dev/re-shell/workspace-v2.schema.json"
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
 * Generate the VSCode `language-configuration.json` content for the re-shell
 * workspace language, defining comments, brackets, auto-closing pairs, folding
 * markers, and the word pattern.
 *
 * @returns A pretty-printed JSON string suitable for `language-configuration.json`.
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
 * Publish the workspace schema and IDE-specific configuration files.
 *
 * Writes the canonical v2 schema, VSCode `settings.json` (merged with any
 * existing settings), and IntelliJ/Vim/Emacs config snippets. Optionally
 * scaffolds a VSCode extension under the output directory.
 *
 * @param options - Controls output location, VSCode target directory, and whether to emit a VSCode extension scaffold. Defaults to sensible locations with no extension scaffold.
 * @returns Resolves once all files have been written; rejects on filesystem errors.
 */
export async function publishSchemas(options: SchemaPublishOptions = {}): Promise<void> {
  const {
    outputDir = path.join(process.cwd(), 'schemas'),
    vscodeDir = path.join(os.homedir(), '.vscode'),
    createVscodeExtension = false,
  } = options;

  await fs.ensureDir(outputDir);

  // Emit the canonical v2 IDE schema (with owned $id) as the published file.
  const schemaDest = path.join(outputDir, 're-shell-workspace.schema.json');
  await fs.writeJson(schemaDest, getIdeSchema(), { spaces: 2 });

  console.log(`✅ Schema published to: ${schemaDest}`);

  // Generate VSCode settings.json
  const vscodeSettings = generateVSCodeConfig(schemaDest);
  const settingsPath = path.join(vscodeDir, 'settings.json');
  await fs.ensureDir(vscodeDir);

  let existingSettings: Record<string, unknown> = {};
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
 * Result of validating a workspace YAML file against the v2 JSON Schema.
 *
 * `errors` carries field-level ajv errors (instancePath + message) so callers
 * can surface exactly where validation failed.
 */
export interface WorkspaceValidationResult {
  /** `true` when the document fully conformed to the v2 JSON Schema. */
  valid: boolean;
  /** Field-level validation errors (instancePath + message); empty when valid. */
  errors: SchemaValidationError[];
  /** Non-blocking warnings (e.g., unexpected file extension) surfaced to the caller. */
  warnings: string[];
}

/**
 * Returns the canonical v2 JSON Schema object used for both validation and IDE
 * publishing. This is the single source of truth (src/schemas/workspace-v2).
 *
 * @returns The v2 workspace JSON Schema as a plain object.
 */
export function getWorkspaceSchema(): Record<string, unknown> {
  return workspaceV2Schema as unknown as Record<string, unknown>;
}

/**
 * Validate a workspace YAML/JSON file against the canonical v2 JSON Schema using
 * ajv. Returns field-level errors (instancePath + message) on failure.
 *
 * Boundary validation: file existence, extension, YAML parseability, and then
 * full schema conformance. Never throws for expected failure modes — those are
 * reported as structured errors so the caller can emit a clean envelope.
 *
 * @param filePath - Path to the YAML/JSON workspace file to validate.
 * @returns A {@link WorkspaceValidationResult} containing the validation outcome, field-level errors, and any non-blocking warnings.
 */
export async function validateWorkspaceFile(
  filePath: string
): Promise<WorkspaceValidationResult> {
  const errors: SchemaValidationError[] = [];
  const warnings: string[] = [];

  if (!(await fs.pathExists(filePath))) {
    errors.push({ instancePath: '', message: `File not found: ${filePath}` });
    return { valid: false, errors, warnings };
  }

  if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
    warnings.push('File should have .yaml or .yml extension');
  }

  // Parse YAML (a superset of JSON, so .json content parses too).
  let parsed: unknown;
  try {
    const content = await fs.readFile(filePath, 'utf8');
    parsed = yaml.load(content);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown YAML parse error';
    errors.push({ instancePath: '', message: `YAML parse error: ${message}` });
    return { valid: false, errors, warnings };
  }

  if (parsed === null || typeof parsed !== 'object') {
    errors.push({
      instancePath: '',
      message: 'Workspace file must contain a YAML/JSON object at the root',
    });
    return { valid: false, errors, warnings };
  }

  // Real JSON-Schema validation against the canonical v2 schema.
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(getWorkspaceSchema());
  const valid = validate(parsed);

  if (!valid && validate.errors) {
    for (const err of validate.errors as ErrorObject[]) {
      errors.push({
        instancePath: err.instancePath || '',
        message: err.message || 'Validation failed',
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Build the IDE-autocomplete JSON Schema: the canonical v2 schema with an
 * owned/served $id (and a draft-07 $schema) so VSCode/IntelliJ can resolve it.
 *
 * @returns A JSON Schema object augmented with `$schema` and owned `$id` fields ready for IDE consumption.
 */
export function getIdeSchema(): Record<string, unknown> {
  const base = getWorkspaceSchema();
  return {
    ...base,
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: SCHEMA_ID,
  };
}

/**
 * Get schema file path (the build copies the canonical v2 schema here for the
 * dist runtime). At source-time the canonical schema is imported directly.
 *
 * @returns Absolute path under `__dirname/schemas` where the published workspace schema is expected to live at runtime.
 */
export function getSchemaPath(): string {
  return path.join(__dirname, 'schemas', 're-shell-workspace.schema.json');
}

/**
 * Load the IDE-autocomplete schema as a JSON object.
 *
 * @returns The IDE-ready schema (canonical v2 schema with `$schema` and owned `$id`).
 */
export async function loadSchema(): Promise<Record<string, unknown>> {
  return getIdeSchema();
}
