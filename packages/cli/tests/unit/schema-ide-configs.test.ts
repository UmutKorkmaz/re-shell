import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { SCHEMA_URL, WORKSPACE_FILE_NAMES } from '../../src/constants/brand';
import {
  WORKSPACE_FILE_GLOBS,
  generateEmacsConfig,
  generateIntelliJConfig,
  generateVSCodeConfig,
  generateVSCodeExtension,
  generateVimConfig,
  getIdeSchema,
  publishSchemas,
} from '../../src/utils/schema-generator';

const GLOB = 're-shell.workspaces.yaml';

/** Every IDE config must point at the hosted schema, never a stale/unowned URL. */
function expectNoStaleUrls(content: string): void {
  expect(content).not.toMatch(/re-shell\.dev/i);
  expect(content).not.toMatch(/umutkorkmaz\.dev/i);
  expect(content).not.toMatch(/schemas\.umutkorkmaz/i);
}

describe('IDE configs map re-shell.workspaces.yaml to the hosted schema', () => {
  it('derives the globs from the file names the CLI loads', () => {
    expect([...WORKSPACE_FILE_GLOBS]).toEqual([...WORKSPACE_FILE_NAMES]);
    expect(WORKSPACE_FILE_GLOBS).toContain(GLOB);
  });

  it('VSCode: yaml.schemas maps SCHEMA_URL to exactly the workspace file globs', () => {
    const settings = JSON.parse(generateVSCodeConfig());
    expect(Object.keys(settings['yaml.schemas'])).toEqual([SCHEMA_URL]);
    expect(settings['yaml.schemas'][SCHEMA_URL]).toEqual([GLOB, 're-shell.workspaces.yml']);
    expect(settings['yaml.validate']).toBe(true);
    expect(settings['yaml.completion']).toBe(true);
    expect(settings['yaml.hover']).toBe(true);
    // Must not switch off SchemaStore for the user's other YAML files.
    expect(settings).not.toHaveProperty('yaml.schemaStore.enable');
    expectNoStaleUrls(JSON.stringify(settings));
  });

  it('VSCode: an explicit schema location is still honoured', () => {
    const settings = JSON.parse(generateVSCodeConfig('./local.schema.json'));
    expect(Object.keys(settings['yaml.schemas'])).toEqual(['./local.schema.json']);
  });

  it('IntelliJ: .idea/jsonSchemas.xml maps the hosted URL to the file name pattern', () => {
    const xml = generateIntelliJConfig();
    expect(xml).toContain('<component name="JsonSchemaMappingsProjectConfiguration">');
    expect(xml).toContain(`<option name="relativePathToSchema" value="${SCHEMA_URL}" />`);
    expect(xml).toContain(`<option name="path" value="${GLOB}" />`);
    expect(xml).toContain('<option name="mappingKind" value="Pattern" />');
    // One Item per workspace file name, tags balanced.
    expect(xml.match(/<Item>/g)).toHaveLength(WORKSPACE_FILE_NAMES.length);
    expect(xml.match(/<\/Item>/g)).toHaveLength(WORKSPACE_FILE_NAMES.length);
    expect(xml.match(/<project\b/g)).toHaveLength(1);
    expect(xml.match(/<\/project>/g)).toHaveLength(1);
    expectNoStaleUrls(xml);
  });

  it('Vim: registers yaml-language-server with the hosted schema for the file name', () => {
    const vim = generateVimConfig();
    expect(vim).toContain(`'${SCHEMA_URL}': ['${GLOB}', 're-shell.workspaces.yml']`);
    expect(vim).toContain("'name': 'yaml-language-server'");
    expectNoStaleUrls(vim);
  });

  it('Emacs: lsp-yaml-schemas maps the hosted schema to the file name', () => {
    const el = generateEmacsConfig();
    expect(el).toContain(`("${SCHEMA_URL}" . ["${GLOB}" "re-shell.workspaces.yml"])`);
    expect(el).toContain('lsp-yaml-schemas');
    expectNoStaleUrls(el);
  });

  it('VSCode extension scaffold validates the file names against the hosted schema', () => {
    const pkg = JSON.parse(generateVSCodeExtension());
    expect(pkg.contributes.yamlValidation).toEqual([
      { fileMatch: [GLOB, 're-shell.workspaces.yml'], url: SCHEMA_URL },
    ]);
    expect(pkg.contributes.configuration.properties['reShell.workspace.schemaPath'].default).toBe(SCHEMA_URL);
    expect(pkg.repository.url).toBe('https://github.com/UmutKorkmaz/re-shell.git');
    expectNoStaleUrls(JSON.stringify(pkg));
  });

  it('does not associate unrelated yaml files (workspace.yaml, workspaces/*.yaml) with the v2 schema', () => {
    const globs = JSON.parse(generateVSCodeConfig())['yaml.schemas'][SCHEMA_URL] as string[];
    expect(globs).not.toContain('workspace.yaml');
    expect(globs).not.toContain('workspaces/*.yaml');
    expect(globs.every(g => g.startsWith('re-shell.workspaces.'))).toBe(true);
  });
});

describe('publishSchemas', () => {
  let tmp: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-publish-'));
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
    await fs.remove(tmp);
  });

  it('writes every IDE config pointing at the hosted URL, plus a local schema copy with the same $id', async () => {
    const outputDir = path.join(tmp, 'schemas');
    const vscodeDir = path.join(tmp, '.vscode');

    await publishSchemas({ outputDir, vscodeDir, createVscodeExtension: true });

    const local = await fs.readJson(path.join(outputDir, 're-shell-workspace.schema.json'));
    expect(local.$id).toBe(SCHEMA_URL);
    expect(local).toEqual(getIdeSchema());

    const settings = await fs.readJson(path.join(vscodeDir, 'settings.json'));
    expect(settings['yaml.schemas'][SCHEMA_URL]).toContain(GLOB);
    // The hosted URL is what is registered, not the local copy's path.
    expect(Object.keys(settings['yaml.schemas'])).toEqual([SCHEMA_URL]);

    const intellij = await fs.readFile(path.join(outputDir, 'intellij-config.xml'), 'utf8');
    const vim = await fs.readFile(path.join(outputDir, 'vim-config.vim'), 'utf8');
    const emacs = await fs.readFile(path.join(outputDir, 'emacs-config.el'), 'utf8');
    for (const content of [intellij, vim, emacs]) {
      expect(content).toContain(SCHEMA_URL);
      expect(content).toContain(GLOB);
      expectNoStaleUrls(content);
    }

    const ext = await fs.readJson(path.join(outputDir, 'vscode-extension', 'package.json'));
    expect(ext.contributes.yamlValidation[0].url).toBe(SCHEMA_URL);
  });

  it('merges into existing VSCode settings without dropping the user\'s other yaml.schemas', async () => {
    const vscodeDir = path.join(tmp, '.vscode');
    await fs.ensureDir(vscodeDir);
    await fs.writeJson(path.join(vscodeDir, 'settings.json'), {
      'editor.tabSize': 4,
      'yaml.schemas': { 'https://example.com/other.json': ['other/*.yaml'] },
    });

    await publishSchemas({ outputDir: path.join(tmp, 'schemas'), vscodeDir });

    const settings = await fs.readJson(path.join(vscodeDir, 'settings.json'));
    expect(settings['editor.tabSize']).toBe(4);
    expect(settings['yaml.schemas']['https://example.com/other.json']).toEqual(['other/*.yaml']);
    expect(settings['yaml.schemas'][SCHEMA_URL]).toContain(GLOB);
  });

  it('replaces (not duplicates) a previous Re-Shell mapping when published twice', async () => {
    const vscodeDir = path.join(tmp, '.vscode');
    const outputDir = path.join(tmp, 'schemas');

    await publishSchemas({ outputDir, vscodeDir });
    await publishSchemas({ outputDir, vscodeDir });

    const settings = await fs.readJson(path.join(vscodeDir, 'settings.json'));
    expect(Object.keys(settings['yaml.schemas'])).toEqual([SCHEMA_URL]);
    expect(settings['yaml.schemas'][SCHEMA_URL]).toEqual([...WORKSPACE_FILE_NAMES]);
  });

  it('defaults the VSCode settings to the project\'s .vscode directory (never the home directory)', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue(tmp);

    await publishSchemas({});

    const settings = await fs.readJson(path.join(tmp, '.vscode', 'settings.json'));
    expect(settings['yaml.schemas'][SCHEMA_URL]).toContain(GLOB);
    expect(await fs.pathExists(path.join(tmp, 'schemas', 're-shell-workspace.schema.json'))).toBe(true);
  });

  it('overwrites an unparseable settings.json rather than failing', async () => {
    const vscodeDir = path.join(tmp, '.vscode');
    await fs.ensureDir(vscodeDir);
    await fs.writeFile(path.join(vscodeDir, 'settings.json'), '{ not json');

    await publishSchemas({ outputDir: path.join(tmp, 'schemas'), vscodeDir });

    const settings = await fs.readJson(path.join(vscodeDir, 'settings.json'));
    expect(settings['yaml.schemas'][SCHEMA_URL]).toContain(GLOB);
  });
});
