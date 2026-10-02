import { spawnSync } from 'child_process';
import { mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve, join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const cliPath = resolve(__dirname, '../../dist/index.js');
let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 're-shell-ui-test-'));
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('ui test CLI routing', () => {
  it('reports a missing runner without selecting the dashboard launcher or writing files', () => {
    const result = spawnSync(process.execPath, [cliPath, 'ui', 'test', '--json'], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });

    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: { code: 'UI_TEST_ERROR', message: expect.stringMatching(/no Storybook runner/i) },
    });
    expect(result.stderr).not.toMatch(/dashboard|launch/i);
    expect(readdirSync(workspace)).toEqual([]);
  });
});
