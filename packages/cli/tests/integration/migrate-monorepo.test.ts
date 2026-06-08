import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

const cliPath = path.join(process.cwd(), 'dist/index.js');
const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures');

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
    timeout: 30000,
  });
  return {
    status: res.status,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

interface Envelope {
  ok: boolean;
  data?: { detected: Array<{ name: string }>; yaml: string };
  error?: { code: string; message: string };
  warnings: string[];
}

describe('workspace migrate-monorepo --json (built CLI)', () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error(`Built CLI not found at ${cliPath}. Run the package build first.`);
    }
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'migrate-cli-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('emits an ok envelope with detected services for an Nx workspace', async () => {
    await fs.copy(path.join(FIXTURES, 'nx-sample'), tmpDir);

    const { status, stdout } = runCli(
      ['workspace', 'migrate-monorepo', '--from', 'nx', '--json'],
      tmpDir
    );

    expect(status).toBe(0);
    const env = JSON.parse(stdout.trim()) as Envelope;
    expect(env.ok).toBe(true);
    expect(env.data?.detected.map(s => s.name).sort()).toEqual([
      'api-server',
      'shared-utils',
      'web-app',
    ]);
    expect(env.data?.yaml).toContain('version: 2.0.0');
    // --dry-run / no --output means nothing should be written.
    expect(fs.existsSync(path.join(tmpDir, 're-shell.workspaces.yaml'))).toBe(false);
  });

  it('emits an ok envelope with detected packages for a Turbo workspace', async () => {
    await fs.copy(path.join(FIXTURES, 'turbo-sample'), tmpDir);

    const { status, stdout } = runCli(
      ['workspace', 'migrate-monorepo', '--from', 'turbo', '--json'],
      tmpDir
    );

    expect(status).toBe(0);
    const env = JSON.parse(stdout.trim()) as Envelope;
    expect(env.ok).toBe(true);
    expect(env.data?.detected.map(s => s.name).sort()).toEqual([
      'checkout-api',
      'storefront',
      'ui-kit',
    ]);
  });

  it('fails with MONOREPO_MIGRATE_ERROR for an unsupported --from value', async () => {
    const { status, stdout } = runCli(
      ['workspace', 'migrate-monorepo', '--from', 'lerna', '--json'],
      tmpDir
    );

    expect(status).toBe(1);
    const env = JSON.parse(stdout.trim()) as Envelope;
    expect(env.ok).toBe(false);
    expect(env.error?.code).toBe('MONOREPO_MIGRATE_ERROR');
  });
});
