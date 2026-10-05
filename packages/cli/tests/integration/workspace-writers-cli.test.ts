import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

const cliPath = path.join(process.cwd(), 'dist/index.js');
const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures');
const SCHEMA_URL = 'https://umutkorkmaz.github.io/re-shell/schemas/workspace-v2.json';
const MODELINE = `# yaml-language-server: $schema=${SCHEMA_URL}`;

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], cwd: string): RunResult {
  const res = spawnSync('node', [cliPath, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '' },
    timeout: 60000,
  });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

/** `config schema validate --json` envelope for `file` (the real ajv + canonical schema path). */
function schemaValidate(file: string, cwd: string): { status: number | null; envelope: any } {
  const { status, stdout } = runCli(['config', 'schema', 'validate', file, '--json'], cwd);
  const lines = stdout.trim().split('\n').filter(Boolean);
  return { status, envelope: JSON.parse(lines[lines.length - 1]) };
}

describe('files written by the built CLI validate against the v2 schema', () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Built CLI not found at ${cliPath}. Run the package build first.`);
    }
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-writers-cli-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('workspace init --yes in an empty directory writes a valid v2 file (P9-C3)', async () => {
    const init = runCli(['workspace', 'init', '--yes'], tmpDir);
    expect(init.status).toBe(0);

    const file = path.join(tmpDir, 're-shell.workspaces.yaml');
    const text = await fs.readFile(file, 'utf8');
    expect(text.split('\n')[0]).toBe(MODELINE);
    expect(text).toContain('services: {}');

    const { status, envelope } = schemaValidate(file, tmpDir);
    expect(envelope.error?.details?.errors ?? []).toEqual([]);
    expect(status).toBe(0);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.valid).toBe(true);

    // ...and the workspace parser used by `workspace validate` agrees.
    const validate = runCli(['workspace', 'validate'], tmpDir);
    expect(validate.status).toBe(0);
    expect(validate.stdout).toContain('Workspace configuration is valid');
  });

  it('workspace init --yes with detected services writes a valid v2 file', async () => {
    await fs.outputJson(path.join(tmpDir, 'package.json'), { name: 'root' });
    await fs.outputJson(path.join(tmpDir, 'apps', 'Web_App', 'package.json'), {
      name: 'web',
      dependencies: { react: '^18' },
      devDependencies: { typescript: '^5' },
    });

    expect(runCli(['workspace', 'init', '--yes'], tmpDir).status).toBe(0);

    const file = path.join(tmpDir, 're-shell.workspaces.yaml');
    const { status, envelope } = schemaValidate(file, tmpDir);
    expect(envelope.error?.details?.errors ?? []).toEqual([]);
    expect(status).toBe(0);
    expect(await fs.readFile(file, 'utf8')).toContain('web-app:');
  });

  for (const [fixture, source] of [
    ['nx-sample', 'nx'],
    ['turbo-sample', 'turbo'],
  ] as const) {
    it(`workspace migrate-monorepo --from ${source} --output writes a valid v2 file`, async () => {
      await fs.copy(path.join(FIXTURES, fixture), tmpDir);

      const migrate = runCli(
        ['workspace', 'migrate-monorepo', '--from', source, '--output', 're-shell.workspaces.yaml'],
        tmpDir
      );
      expect(migrate.status).toBe(0);

      const file = path.join(tmpDir, 're-shell.workspaces.yaml');
      expect((await fs.readFile(file, 'utf8')).split('\n')[0]).toBe(MODELINE);
      const { status, envelope } = schemaValidate(file, tmpDir);
      expect(envelope.error?.details?.errors ?? []).toEqual([]);
      expect(status).toBe(0);
    });
  }
});

describe('config schema generate/publish (built CLI)', () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Built CLI not found at ${cliPath}. Run the package build first.`);
    }
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-ide-cli-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('config schema generate emits IDE configs that all reference the hosted schema URL', async () => {
    const res = runCli(['config', 'schema', 'generate', '--output-dir', 'out', '--ide', 'all'], tmpDir);
    expect(res.status).toBe(0);

    const schema = await fs.readJson(path.join(tmpDir, 'out', 're-shell-workspace.schema.json'));
    expect(schema.$id).toBe(SCHEMA_URL);

    const vscode = await fs.readJson(path.join(tmpDir, 'out', 'vscode-settings.json'));
    expect(vscode['yaml.schemas'][SCHEMA_URL]).toContain('re-shell.workspaces.yaml');

    for (const file of ['intellij-config.xml', 'vim-config.vim', 'emacs-config.el']) {
      const content = await fs.readFile(path.join(tmpDir, 'out', file), 'utf8');
      expect(content, file).toContain(SCHEMA_URL);
      expect(content, file).toContain('re-shell.workspaces.yaml');
    }
  });

  it('config schema publish registers the hosted schema in the given VSCode settings dir', async () => {
    const res = runCli(
      ['config', 'schema', 'publish', '--output-dir', 'out', '--vscode-dir', path.join(tmpDir, '.vscode')],
      tmpDir
    );
    expect(res.status).toBe(0);

    const settings = await fs.readJson(path.join(tmpDir, '.vscode', 'settings.json'));
    expect(Object.keys(settings['yaml.schemas'])).toEqual([SCHEMA_URL]);
    expect(settings['yaml.schemas'][SCHEMA_URL]).toContain('re-shell.workspaces.yaml');
    expect(await fs.pathExists(path.join(tmpDir, 'out', 'intellij-config.xml'))).toBe(true);
  });
});
