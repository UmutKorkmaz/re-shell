import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { createProject } from '../../src/commands/create';

/**
 * A scaffold that fails midway must not leave a half-written project behind:
 * `create` removes the directories it created, and leaves ones that already
 * existed alone.
 */

vi.mock('../../src/templates/frontend/registry', async importOriginal => {
  const original = await importOriginal<typeof import('../../src/templates/frontend/registry')>();
  return {
    ...original,
    // The root files are already written when the frontend app is rendered.
    createFrontendTemplate: vi.fn(() => {
      throw new Error('template render failed');
    }),
  };
});

vi.mock('prompts', () => ({ default: vi.fn() }));

let tempRoot: string;

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'reshell-create-rollback-'));
  vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  Object.defineProperty(process.stdin, 'isTTY', { value: undefined, configurable: true, writable: true });
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete (process.stdin as { isTTY?: boolean }).isTTY;
  await fs.remove(tempRoot);
});

describe('create rollback', () => {
  it('removes the project directory it created when the write fails', async () => {
    await expect(createProject('doomed', { frontend: 'react-ts', yes: true })).rejects.toThrow(
      'template render failed'
    );
    expect(fs.existsSync(path.join(tempRoot, 'doomed'))).toBe(false);
  });

  it('keeps a pre-existing directory (--force) when the write fails', async () => {
    fs.outputFileSync(path.join(tempRoot, 'keepme', 'mine.txt'), 'precious');
    await expect(
      createProject('keepme', { frontend: 'react-ts', yes: true, force: true })
    ).rejects.toThrow('template render failed');
    expect(fs.readFileSync(path.join(tempRoot, 'keepme', 'mine.txt'), 'utf8')).toBe('precious');
  });
});
