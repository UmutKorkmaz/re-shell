// Fixture git repos for the `fix --ci` tests. Each fixture is a REAL git repo
// with a REAL TypeScript project whose gates run the real tsc and vitest
// (resolved through a node_modules symlink to this package's own install).

import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { FixProvider, FixProviderRequest, FixProviderResponse } from '../../src/fix-ci/provider';

const CLI_ROOT = path.resolve(__dirname, '..', '..');

export function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Fixture',
      GIT_AUTHOR_EMAIL: 'fixture@example.com',
      GIT_COMMITTER_NAME: 'Fixture',
      GIT_COMMITTER_EMAIL: 'fixture@example.com',
    },
  }).trim();
}

export const FILES = {
  'package.json': JSON.stringify(
    {
      name: 'fixture',
      version: '1.0.0',
      private: true,
      scripts: { typecheck: 'tsc --noEmit -p tsconfig.json', test: 'vitest run' },
    },
    null,
    2
  ) + '\n',
  'tsconfig.json': JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'node',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      include: ['src', 'tests'],
    },
    null,
    2
  ) + '\n',
  '.gitignore': 'node_modules\n',
  'src/add.ts': 'export function add(a: number, b: number): number {\n  return a + b;\n}\n',
  // Deliberate type error: a string is passed where a number is required.
  'src/index.ts': "import { add } from './add';\n\nexport const total: number = add(1, '2');\n",
  'tests/add.test.ts':
    "import { describe, it, expect } from 'vitest';\nimport { add } from '../src/add';\n\ndescribe('add', () => {\n  it('adds', () => {\n    expect(add(1, 2)).toBe(3);\n  });\n});\n",
} as const;

/** The correct fix for the deliberate type error in src/index.ts. */
export const TYPE_ERROR_FIX_PATCH = `diff --git a/src/index.ts b/src/index.ts
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,3 @@
 import { add } from './add';

-export const total: number = add(1, '2');
+export const total: number = add(1, 2);
`;

export interface Fixture {
  dir: string;
  cleanup: () => void;
}

/** Create a git repo with the given files (merged over {@link FILES}) and one commit. */
export function createFixture(overrides: Record<string, string | null> = {}): Fixture {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'fix-ci-fixture-')));
  const all: Record<string, string | null> = { ...FILES, ...overrides };
  for (const [rel, content] of Object.entries(all)) {
    if (content === null) continue;
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  fs.symlinkSync(path.join(CLI_ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'initial');
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/**
 * `.re-shell/fix-ci.yaml` that runs the real tsc and vitest directly through
 * node (no npm in the middle), which keeps multi-iteration tests fast.
 */
export function fastGatesYaml(): string {
  const node = JSON.stringify(process.execPath);
  const tsc = JSON.stringify(path.join(CLI_ROOT, 'node_modules/typescript/bin/tsc'));
  const vitest = JSON.stringify(path.join(CLI_ROOT, 'node_modules/vitest/vitest.mjs'));
  return [
    'detect: false',
    'gates:',
    '  - name: typecheck',
    `    command: [${node}, ${tsc}, --noEmit, -p, tsconfig.json]`,
    '    locked: true',
    '  - name: test',
    `    command: [${node}, ${vitest}, run]`,
    '',
  ].join('\n');
}

export const FAST_GATES = { '.re-shell/fix-ci.yaml': fastGatesYaml() };

/** Build a git-format patch replacing one (1-based) line of `content` in `file`. */
export function replaceLinePatch(file: string, content: string, lineNo: number, newLine: string): string {
  const lines = content.replace(/\n$/, '').split('\n');
  const start = Math.max(1, lineNo - 3);
  const end = Math.min(lines.length, lineNo + 3);
  const body: string[] = [];
  for (let n = start; n <= end; n++) {
    if (n === lineNo) {
      body.push(`-${lines[n - 1]}`, `+${newLine}`);
    } else {
      body.push(` ${lines[n - 1]}`);
    }
  }
  const count = end - start + 1;
  return (
    `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n` +
    `@@ -${start},${count} +${start},${count} @@\n${body.join('\n')}\n`
  );
}

export type ProposeFn = (request: FixProviderRequest, call: number) => FixProviderResponse | Promise<FixProviderResponse>;

/** A fake provider that records every request it receives. */
export function fakeProvider(propose: ProposeFn): FixProvider & { requests: FixProviderRequest[] } {
  const requests: FixProviderRequest[] = [];
  return {
    name: 'fake',
    model: 'fake-1',
    requests,
    async propose(request) {
      requests.push(request);
      return propose(request, requests.length);
    },
  };
}
