import { describe, expect, it } from 'vitest';
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createFixtureWorkspace } from '../unit/ai/helpers';

/**
 * Real-terminal test for `re-shell ai --run`: the confirm-then-execute gate,
 * driven with real keystrokes on a real pseudo-terminal.
 *
 *   - answering "n" (or just Enter: the default is NO) executes nothing,
 *   - answering "y" runs EXACTLY the previewed command, by re-invoking the same
 *     CLI build with shell:false.
 *
 * Observable effect: the fixture's `build` script writes `ran.txt` next to its
 * package.json, so we can prove whether the command really ran.
 *
 * The pseudo-terminal comes from util-linux `script`; the tests skip where it is
 * unavailable. (node-pty is deliberately not used: it aborts under Node 22 in
 * some environments.)
 */

const BIN = path.resolve(__dirname, '../../dist/index.js');

const hasScript = process.platform !== 'win32' && spawnSync('script', ['--version']).status === 0;
const ptyTest = hasScript ? it : it.skip;

function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

function runInPty(
  cwd: string,
  home: string,
  args: string[],
  answer: string
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    let output = '';
    let answered = false;
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined && !/^(RE_SHELL_AI_|ANTHROPIC_)/.test(k)) env[k] = v;
    }
    Object.assign(env, { HOME: home, FORCE_COLOR: '0', NO_COLOR: '1' });
    const command = ['node', BIN, ...args].map(shellQuote).join(' ');
    const child = spawn('script', ['-qefc', command, '/dev/null'], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const killTimer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`PTY timed out. Output so far:\n${output}`));
    }, 60_000);
    const onData = (d: Buffer): void => {
      output += d.toString('utf8');
      // Answer the confirmation prompt exactly once, when it appears.
      if (!answered && /Run `re-shell [^`]+`\?/.test(output)) {
        answered = true;
        setTimeout(() => child.stdin.write(answer), 300);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', code => {
      clearTimeout(killTimer);
      resolve({ output, exitCode: code ?? 1 });
    });
  });
}

describe('ai --run in a real terminal', () => {
  const setup = () => {
    const ws = createFixtureWorkspace();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-ai-pty-home-'));
    // `run build --filter api` also builds api's dependencies first, so every
    // package in the chain needs a harmless build script.
    for (const dir of ['payments-db', 'payments-service', 'api']) {
      const pkgFile = path.join(ws.root, 'packages', dir, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      pkg.scripts.build =
        dir === 'api' ? "node -e \"require('fs').writeFileSync('ran.txt','built')\"" : 'node -e 0';
      fs.writeFileSync(pkgFile, JSON.stringify(pkg));
    }
    return {
      ws,
      home,
      marker: path.join(ws.root, 'packages/api/ran.txt'),
      cleanup: () => {
        ws.cleanup();
        fs.rmSync(home, { recursive: true, force: true });
      },
    };
  };
  const ARGS = ['ai', 'build the api', '--run', '--no-cache'];

  ptyTest(
    'answering "y" runs exactly the previewed command',
    async () => {
      const t = setup();
      try {
        const { output } = await runInPty(t.ws.root, t.home, ARGS, 'y\n');
        expect(output).toContain('About to run: re-shell run build --filter @acme/api');
        expect(fs.existsSync(t.marker), output).toBe(true);
        expect(fs.readFileSync(t.marker, 'utf8')).toBe('built');
      } finally {
        t.cleanup();
      }
    },
    90_000
  );

  ptyTest(
    'answering "n" executes nothing',
    async () => {
      const t = setup();
      try {
        const { output } = await runInPty(t.ws.root, t.home, ARGS, 'n\n');
        expect(output).toContain('Nothing was executed');
        expect(fs.existsSync(t.marker)).toBe(false);
      } finally {
        t.cleanup();
      }
    },
    90_000
  );

  ptyTest(
    'pressing Enter (the default) executes nothing',
    async () => {
      const t = setup();
      try {
        const { output } = await runInPty(t.ws.root, t.home, ARGS, '\n');
        expect(output).toContain('Nothing was executed');
        expect(fs.existsSync(t.marker)).toBe(false);
      } finally {
        t.cleanup();
      }
    },
    90_000
  );
});
