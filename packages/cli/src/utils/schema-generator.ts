/**
 * JSON Schema Generator for IDE Autocompletion
 * Generates and publishes JSON schemas for workspace configuration files
 * with IDE-specific integrations for VSCode, IntelliJ, Vim, and Emacs
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv, { type ErrorObject } from 'ajv';
// The canonical v2 schema is the single source of truth. Importing the JSON
// directly (resolved relative to source) guarantees validation uses the same
// document the IDE-autocomplete schema is published from, regardless of any
// build-time copy under dist/utils/schemas.
import workspaceV2Schema from '../schemas/workspace-v2.schema.json';
import { SCHEMA_URL, REPO_URL, WORKSPACE_FILE_NAMES } from '../constants/brand';

/**
 * `$id` of the published IDE schema: the hosted URL the docs site serves it
 * from. Alias of {@link SCHEMA_URL}; the URL itself lives only in
 * `constants/brand.ts`.
 */
export const SCHEMA_ID = SCHEMA_URL;

/**
 * Glob patterns (as used by yaml-language-server `yaml.schemas`) that select the
 * workspace files the schema applies to. Derived from the names the CLI itself
 * loads, so IDE mappings and CLI behaviour cannot drift apart.
 */
export const WORKSPACE_FILE_GLOBS: readonly string[] = WORKSPACE_FILE_NAMES;

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
  /** Directory whose `settings.json` is updated with the `yaml.schemas` association. Defaults to the project's `<cwd>/.vscode` (workspace settings, which VSCode reads). */
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
 * @param schemaPath - URL or path of the workspace JSON schema that VSCode should associate with the workspace files. Defaults to the hosted {@link SCHEMA_URL}.
 * @returns A pretty-printed JSON string suitable for writing to VSCode's `settings.json`.
 */
export function generateVSCodeConfig(schemaPath: string = SCHEMA_URL): string {
  return JSON.stringify(
    {
      "yaml.schemas": {
        [schemaPath]: [...WORKSPACE_FILE_GLOBS]
      },
      "yaml.validate": true,
      "yaml.completion": true,
      "yaml.hover": true
    },
    null,
    2
  );
}

/**
 * Generate the IntelliJ/IDEA JSON Schema mapping.
 *
 * The returned XML is the content of `.idea/jsonSchemas.xml` (the project-level
 * "JSON Schema Mappings" store), mapping the hosted schema to the workspace
 * file names. IntelliJ applies JSON Schema mappings to YAML files as well.
 *
 * @returns An XML document to save as `.idea/jsonSchemas.xml`.
 */
export function generateIntelliJConfig(): string {
  const items = WORKSPACE_FILE_GLOBS.map(
    (glob) => `                  <Item>
                    <option name="path" value="${glob}" />
                    <option name="mappingKind" value="Pattern" />
                  </Item>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Save as .idea/jsonSchemas.xml (IntelliJ IDEA, WebStorm, PyCharm, ...). -->
<project version="4">
  <component name="JsonSchemaMappingsProjectConfiguration">
    <state>
      <map>
        <entry key="Re-Shell Workspace">
          <value>
            <SchemaInfo>
              <option name="name" value="Re-Shell Workspace" />
              <option name="relativePathToSchema" value="${SCHEMA_URL}" />
              <option name="schemaVersion" value="JSON Schema version 7" />
              <option name="patterns">
                <list>
${items}
                </list>
              </option>
            </SchemaInfo>
          </value>
        </entry>
      </map>
    </state>
  </component>
</project>
`;
}

/**
 * Generate Vim/Neovim schema configuration.
 *
 * The returned Vimscript registers `yaml-language-server` through vim-lsp and
 * hands it the hosted workspace schema for the workspace file names. A Neovim
 * (nvim-lspconfig) equivalent is included as comments.
 *
 * @returns A Vimscript snippet to append to `.vimrc` or `init.vim`.
 */
export function generateVimConfig(): string {
  const globs = WORKSPACE_FILE_GLOBS.map((g) => `'${g}'`).join(', ');
  const luaGlobs = WORKSPACE_FILE_GLOBS.map((g) => `"${g}"`).join(', ');

  return `" Vim/Neovim YAML Schema Configuration for Re-Shell workspace files
" Requires yaml-language-server (npm i -g yaml-language-server).
" Schema: ${SCHEMA_URL}

" vim-lsp (prabirshrestha/vim-lsp)
if executable('yaml-language-server')
  augroup reshell_yaml_schema
    autocmd!
    autocmd User lsp_setup call lsp#register_server({
      \\ 'name': 'yaml-language-server',
      \\ 'cmd': {server_info -> ['yaml-language-server', '--stdio']},
      \\ 'allowlist': ['yaml'],
      \\ 'workspace_config': {'yaml': {'schemas': {'${SCHEMA_URL}': [${globs}]}}},
      \\ })
  augroup END
endif

" Neovim (nvim-lspconfig), in init.lua:
"   require('lspconfig').yamlls.setup({
"     settings = { yaml = { schemas = {
"       ["${SCHEMA_URL}"] = { ${luaGlobs} },
"     } } },
"   })
"
" Any yaml-language-server client also honours the modeline that
" \`re-shell workspace init\` writes on the first line of the file:
"   # yaml-language-server: $schema=${SCHEMA_URL}
`;
}

/**
 * Generate Emacs schema configuration.
 *
 * The returned Emacs Lisp associates the hosted workspace schema with the
 * workspace file names for lsp-mode's yaml-language-server client.
 *
 * @returns An Emacs Lisp snippet to append to `init.el` or `.emacs`.
 */
export function generateEmacsConfig(): string {
  const globs = WORKSPACE_FILE_GLOBS.map((g) => `"${g}"`).join(' ');

  return `;; Emacs YAML Schema Configuration for Re-Shell workspace files
;; Requires lsp-mode with yaml-language-server (npm i -g yaml-language-server).
;; Schema: ${SCHEMA_URL}

(with-eval-after-load 'lsp-yaml
  (setq lsp-yaml-schemas
        '(("${SCHEMA_URL}" . [${globs}]))))

;; Any yaml-language-server client also honours the modeline that
;; \`re-shell workspace init\` writes on the first line of the file:
;;   # yaml-language-server: $schema=${SCHEMA_URL}
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
          "filenames": [...WORKSPACE_FILE_GLOBS],
          "configuration": "./language-configuration.json"
        }],
        "yamlValidation": [{
          "fileMatch": [...WORKSPACE_FILE_GLOBS],
          "url": SCHEMA_URL
        }],
        "configuration": {
          "title": "Re-Shell Workspace",
          "properties": {
            "reShell.workspace.schemaPath": {
              "type": "string",
              "default": SCHEMA_URL,
              "description": "URL or path of the workspace JSON schema"
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
        "url": `${REPO_URL}.git`
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
 * Writes a local copy of the canonical v2 schema, VSCode `settings.json` (the
 * `yaml.schemas` entry is merged into any existing settings and mappings), and
 * IntelliJ/Vim/Emacs config snippets. Every IDE config points at the hosted
 * {@link SCHEMA_URL}, not at the local copy. Optionally scaffolds a VSCode
 * extension under the output directory.
 *
 * @param options - Controls output location, VSCode target directory, and whether to emit a VSCode extension scaffold. Defaults to sensible locations with no extension scaffold.
 * @returns Resolves once all files have been written; rejects on filesystem errors.
 */
export async function publishSchemas(options: SchemaPublishOptions = {}): Promise<void> {
  const {
    outputDir = path.join(process.cwd(), 'schemas'),
    vscodeDir = path.join(process.cwd(), '.vscode'),
    createVscodeExtension = false,
  } = options;

  await fs.ensureDir(outputDir);

  // Emit a local copy of the canonical v2 schema (its $id is the hosted URL).
  const schemaDest = path.join(outputDir, 're-shell-workspace.schema.json');
  await fs.writeJson(schemaDest, getIdeSchema(), { spaces: 2 });

  console.log(`✅ Schema published to: ${schemaDest}`);

  // Generate VSCode settings.json (maps the hosted schema URL, not the local copy)
  const vscodeSettings = generateVSCodeConfig(SCHEMA_URL);
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

  // Merge settings. `yaml.schemas` is merged key-by-key so mappings the user
  // already has (Kubernetes, CI schemas, ...) are preserved.
  const generated = JSON.parse(vscodeSettings) as Record<string, unknown>;
  const existingSchemas =
    existingSettings['yaml.schemas'] !== null &&
    typeof existingSettings['yaml.schemas'] === 'object' &&
    !Array.isArray(existingSettings['yaml.schemas'])
      ? (existingSettings['yaml.schemas'] as Record<string, unknown>)
      : {};
  const mergedSettings = {
    ...existingSettings,
    ...generated,
    'yaml.schemas': {
      ...existingSchemas,
      ...(generated['yaml.schemas'] as Record<string, unknown>),
    },
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
  console.log(`   Schema URL: ${SCHEMA_URL}`);
  console.log('   VSCode: yaml.schemas registered in settings.json (needs the redhat.vscode-yaml extension)');
  console.log('   IntelliJ: Save intellij-config.xml as .idea/jsonSchemas.xml');
  console.log('   Vim/Neovim: Add vim-config.vim to ~/.vimrc or ~/.config/nvim/init.vim');
  console.log('   Emacs: Add emacs-config.el to ~/.emacs or ~/.emacs.d/init.el');
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
  errors.push(...validateWorkspaceDocument(parsed));

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate an already-parsed workspace document against the canonical v2 JSON
 * Schema using ajv. Used by {@link validateWorkspaceFile} and by writers that
 * want to verify what they are about to emit.
 *
 * @param document - The parsed workspace document (YAML/JSON value).
 * @returns Field-level errors (instancePath + message); empty when the document conforms.
 */
export function validateWorkspaceDocument(document: unknown): SchemaValidationError[] {
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(getWorkspaceSchema());
  const errors: SchemaValidationError[] = [];

  if (!validate(document) && validate.errors) {
    for (const err of validate.errors as ErrorObject[]) {
      errors.push({
        instancePath: err.instancePath || '',
        message: err.message || 'Validation failed',
      });
    }
  }
  return errors;
}

/**
 * Build the IDE-autocomplete JSON Schema: the canonical v2 schema with its
 * `$id` pinned to the hosted {@link SCHEMA_URL} (and a draft-07 `$schema`), i.e.
 * exactly the document the docs site serves at that URL.
 *
 * @returns A JSON Schema object with `$schema` and the hosted `$id`, ready for IDE consumption.
 */
export function getIdeSchema(): Record<string, unknown> {
  const base = getWorkspaceSchema();
  return {
    ...base,
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: SCHEMA_URL,
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
 * @returns The IDE-ready schema (canonical v2 schema with `$schema` and the hosted `$id`).
 */
export async function loadSchema(): Promise<Record<string, unknown>> {
  return getIdeSchema();
}
