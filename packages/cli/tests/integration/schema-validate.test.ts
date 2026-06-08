import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';

const cliPath = path.join(process.cwd(), 'dist/index.js');

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[]): RunResult {
  const res = spawnSync('node', [cliPath, ...args], {
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

const VALID_WORKSPACE = `
name: my-workspace
version: 2.0.0
services:
  api:
    name: api
    language: typescript
    framework: express
`;

describe('config schema validate --json (built CLI)', () => {
  let tmpDir: string;

  beforeAll(() => {
    if (!fs.existsSync(cliPath)) {
      throw new Error(
        `Built CLI not found at ${cliPath}. Run the package build first.`
      );
    }
  });

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-validate-'));
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('returns an ok envelope and exit 0 for a valid v2 workspace', async () => {
    const file = path.join(tmpDir, 'workspace.yaml');
    await fs.writeFile(file, VALID_WORKSPACE, 'utf8');

    const { status, stdout } = runCli([
      'config',
      'schema',
      'validate',
      file,
      '--json',
    ]);

    expect(status).toBe(0);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const envelope = JSON.parse(lines[lines.length - 1]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.valid).toBe(true);
    expect(Array.isArray(envelope.warnings)).toBe(true);
  });

  it('returns a fail envelope with field-level errors and exit 1 for an invalid workspace', async () => {
    const file = path.join(tmpDir, 'workspace.yaml');
    // Missing required `services`.
    await fs.writeFile(file, 'name: my-workspace\nversion: 2.0.0\n', 'utf8');

    const { status, stdout } = runCli([
      'config',
      'schema',
      'validate',
      file,
      '--json',
    ]);

    expect(status).toBe(1);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const envelope = JSON.parse(lines[lines.length - 1]);
    expect(envelope.ok).toBe(false);
    expect(envelope.error.code).toBe('SCHEMA_VALIDATION_ERROR');
    expect(envelope.error.details.valid).toBe(false);
    expect(envelope.error.details.errors.length).toBeGreaterThan(0);
    expect(envelope.error.details.errors[0]).toHaveProperty('instancePath');
    expect(envelope.error.details.errors[0]).toHaveProperty('message');
  });
});
