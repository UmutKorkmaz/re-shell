import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runEnv } from '../../src/commands/env';
import { envResponseSchema } from '@re-shell/contracts';

/** Integration coverage for `re-shell env init|verify` (issue #21). */

function makeTempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-env-'));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
  return dir;
}
const TEMP_DIRS: string[] = [];
afterEach(() => {
  for (const d of TEMP_DIRS.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('runEnv', () => {
  let writeSpy: ReturnType<typeof vi.spyOn>;
  let written: string[];
  beforeEach(() => {
    written = [];
    process.exitCode = undefined;
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(typeof chunk === 'string' ? chunk : chunk.toString());
        return true;
      }) as unknown as ReturnType<typeof vi.spyOn>;
  });
  afterEach(() => {
    writeSpy.mockRestore();
    process.exitCode = undefined;
  });
  function lastJson(): Record<string, unknown> {
    const raw = written[written.length - 1];
    expect(raw, 'expected JSON output on stdout').toBeDefined();
    return JSON.parse(raw as string);
  }

  it('init dry-run lists the files it would write without touching disk', async () => {
    await runEnv({
      json: true,
      mode: 'init',
      detect: () => [{ language: 'typescript' }, { language: 'python' }],
    });
    const data = lastJson().data as { dryRun: boolean; files: Array<{ written: boolean; kind: string }>; languages: string[] };
    expect(data.dryRun).toBe(true);
    expect(data.languages.sort()).toEqual(['python', 'typescript']);
    expect(data.files.every(f => f.written === false)).toBe(true);
    expect(data.files.map(f => f.kind).sort()).toEqual(['devbox', 'devcontainer']);
  });

  it('init --no-dry-run writes both files with valid JSON', async () => {
    const dir = makeTempDir({});
    TEMP_DIRS.push(dir);
    await runEnv({
      json: true,
      cwd: dir,
      mode: 'init',
      noDryRun: true,
      detect: () => [{ language: 'typescript', version: '18' }],
    });
    expect(fs.existsSync(path.join(dir, 'devbox.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, '.devcontainer/devcontainer.json'))).toBe(true);
    const devbox = JSON.parse(fs.readFileSync(path.join(dir, 'devbox.json'), 'utf8'));
    expect(devbox.packages).toEqual(['nodejs@18']);
  });

  it('verify reports no drift when the config matches detection', async () => {
    const dir = makeTempDir({ 'devbox.json': JSON.stringify({ packages: ['nodejs'] }) });
    TEMP_DIRS.push(dir);
    await runEnv({
      json: true,
      cwd: dir,
      mode: 'verify',
      detect: () => [{ language: 'typescript' }],
    });
    const data = lastJson().data as { warnings: string[] };
    expect(data.warnings.join(' ')).toMatch(/up to date/);
  });

  it('verify reports missing toolchains when detection added a language', async () => {
    const dir = makeTempDir({ 'devbox.json': JSON.stringify({ packages: ['nodejs'] }) });
    TEMP_DIRS.push(dir);
    await runEnv({
      json: true,
      cwd: dir,
      mode: 'verify',
      detect: () => [{ language: 'typescript' }, { language: 'go' }],
    });
    const data = lastJson().data as { warnings: string[] };
    expect(data.warnings.join(' ')).toMatch(/missing.*go/);
  });

  it('emits output that validates against envResponseSchema', async () => {
    await runEnv({ json: true, mode: 'init', detect: () => [{ language: 'go' }] });
    expect(envResponseSchema.safeParse(lastJson().data).success).toBe(true);
  });
});
