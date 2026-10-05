import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Make the second directory/file move fail so the apply phase has to roll back.
let moveCalls = 0;
vi.mock('../../src/refactor/git', async () => {
  const actual = await vi.importActual<typeof import('../../src/refactor/git')>('../../src/refactor/git');
  return {
    ...actual,
    moveWithGit: (repoRoot: string | undefined, from: string, to: string) => {
      moveCalls += 1;
      if (moveCalls === 2) throw new Error('simulated move failure');
      return actual.moveWithGit(repoRoot, from, to);
    },
  };
});

import { renameService, RefactorError } from '../../src/refactor/engine';

const FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'polyglot-workspace');
const dirs: string[] = [];
afterEach(() => {
  moveCalls = 0;
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out.set(path.relative(dir, abs), fs.readFileSync(abs, 'utf8'));
    }
  };
  walk(dir);
  return out;
}

describe('rename-service rollback', () => {
  it('restores every edited file and undoes completed moves when a later step fails', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-refactor-rb-'));
    dirs.push(dir);
    fs.cpSync(FIXTURE, dir, { recursive: true });
    const before = snapshot(dir);

    let thrown: unknown;
    try {
      renameService({ cwd: dir, oldName: 'billing', newName: 'payments' });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(RefactorError);
    expect((thrown as RefactorError).code).toBe('REFACTOR_ERROR');
    expect((thrown as RefactorError).message).toMatch(/rolled back: simulated move failure/);
    expect(moveCalls).toBeGreaterThanOrEqual(2);

    // identical tree after rollback: the first (successful) directory move was undone too
    expect(snapshot(dir)).toEqual(before);
    expect(fs.existsSync(path.join(dir, 'services/billing/pom.xml'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'services/payments'))).toBe(false);
  });
});
