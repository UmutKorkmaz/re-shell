// Real toolchain verification of generated clients: tsc (TypeScript compiler
// API), `python3 -m py_compile` + mypy, and `go build` + `go vet`. Every result
// states exactly what ran; a missing toolchain is reported as "skipped", never
// as a pass. Verification always runs on a scratch copy, so it never leaves
// caches, go.sum edits or symlinks in the user's output directory.

import { spawnSync, type SpawnSyncReturns } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { ClientFile, ClientLanguage } from './codegen/common';
import { BRIDGE_MARKER } from './spec/discover';

/** Outcome of one verification step. */
export interface VerifyResult {
  language: ClientLanguage;
  /** Tool(s) invoked, e.g. `tsc --strict`, `python3 -m py_compile`, `mypy --strict`, `go build ./...`. */
  tool: string;
  status: 'passed' | 'failed' | 'skipped';
  detail?: string;
}

function run(cmd: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env, timeout = 300000): SpawnSyncReturns<string> {
  return spawnSync(cmd, args, { cwd, encoding: 'utf8', env, timeout });
}

function have(cmd: string, args: string[] = ['--version']): boolean {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 20000 });
  return !r.error && r.status === 0;
}

/** Nearest `node_modules` (walking up from this module) that contains `pkg`. */
function nodeModulesWith(pkg: string): string | undefined {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'node_modules');
    if (fs.existsSync(path.join(candidate, pkg))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function copyBundle(root: string): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-verify-'));
  fs.cpSync(root, tmp, {
    recursive: true,
    filter: src => !/(^|[\\/])(node_modules|__pycache__|\.mypy_cache|dist)([\\/]|$)/.test(src),
  });
  return tmp;
}

function readProtocol(dir: string): string | undefined {
  try {
    return (JSON.parse(fs.readFileSync(path.join(dir, BRIDGE_MARKER), 'utf8')) as { protocol?: string }).protocol;
  } catch {
    return undefined;
  }
}

export function verifyTypeScript(dir: string, entryRel = 'ts/client.ts'): VerifyResult {
  const entry = path.join(dir, ...entryRel.split('/'));
  if (!fs.existsSync(entry)) {
    return { language: 'ts', tool: 'tsc --strict', status: 'skipped', detail: 'no TypeScript client was generated' };
  }
  let ts: typeof import('typescript');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ts = require('typescript') as typeof import('typescript');
  } catch {
    return { language: 'ts', tool: 'tsc --strict', status: 'skipped', detail: 'typescript is not resolvable' };
  }
  const nm = nodeModulesWith('@grpc/grpc-js') ?? nodeModulesWith('typescript');
  const typesNm = nodeModulesWith('@types/node');
  const nodeTypes = typesNm !== undefined;
  if (nm) {
    try {
      fs.symlinkSync(nm, path.join(dir, 'ts', 'node_modules'), 'dir');
    } catch {
      /* unresolved imports then surface as diagnostics */
    }
  }
  const program = ts.createProgram([entry], {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
    skipLibCheck: true,
    esModuleInterop: true,
    // explicit typeRoots: the default is relative to the process cwd, which is arbitrary for a CLI
    ...(typesNm ? { typeRoots: [path.join(typesNm, '@types')] } : {}),
    types: nodeTypes ? ['node'] : [],
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length === 0) return { language: 'ts', tool: 'tsc --strict', status: 'passed' };
  const unresolved = diagnostics.filter(d => /Cannot find module '@grpc\//.test(ts.flattenDiagnosticMessageText(d.messageText, '\n')));
  if (unresolved.length > 0 && unresolved.length === diagnostics.length) {
    return { language: 'ts', tool: 'tsc --strict', status: 'skipped', detail: '@grpc/grpc-js and @grpc/proto-loader are not installed, so the gRPC client cannot be type-checked' };
  }
  const detail = diagnostics
    .slice(0, 10)
    .map(d => {
      const where =
        d.file && d.start !== undefined
          ? `${path.basename(d.file.fileName)}:${d.file.getLineAndCharacterOfPosition(d.start).line + 1} `
          : '';
      return `${where}${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
    })
    .join('; ');
  return { language: 'ts', tool: 'tsc --strict', status: 'failed', detail };
}

function listPy(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.py')) out.push(path.relative(path.join(dir, 'python'), p));
    }
  };
  if (fs.existsSync(path.join(dir, 'python'))) walk(path.join(dir, 'python'));
  return out;
}

export function verifyPython(dir: string, protocol: string | undefined): VerifyResult[] {
  const pyFiles = listPy(dir);
  if (pyFiles.length === 0) {
    return [{ language: 'python', tool: 'python3 -m py_compile', status: 'skipped', detail: 'no Python client was generated' }];
  }
  if (!have('python3')) {
    return [{ language: 'python', tool: 'python3 -m py_compile', status: 'skipped', detail: 'python3 not found on PATH' }];
  }
  const pyRoot = path.join(dir, 'python');
  const cache = path.join(dir, '.pycache');
  const env = { ...process.env, PYTHONPYCACHEPREFIX: cache };
  const results: VerifyResult[] = [];
  const compiled = run('python3', ['-m', 'py_compile', ...pyFiles], pyRoot, env);
  if (compiled.status !== 0) {
    return [{ language: 'python', tool: 'python3 -m py_compile', status: 'failed', detail: (compiled.stderr || compiled.stdout).trim().slice(0, 800) }];
  }
  results.push({ language: 'python', tool: 'python3 -m py_compile', status: 'passed' });

  if (!have('python3', ['-m', 'mypy', '--version'])) {
    results.push({ language: 'python', tool: 'mypy --strict', status: 'skipped', detail: 'mypy is not installed (pip install mypy)' });
    return results;
  }
  if (protocol === 'grpc' && !pyFiles.some(f => f.endsWith('_pb2.py'))) {
    results.push({ language: 'python', tool: 'mypy --strict', status: 'skipped', detail: 'protobuf stubs (*_pb2.py) have not been generated; run generate-stubs.sh or pass --compile-stubs' });
    return results;
  }
  // Only the generated client modules are checked; protoc's own stubs are not ours to lint.
  const targets = pyFiles.filter(f => !/_pb2(_grpc)?\.pyi?$/.test(f));
  const stubModules = pyFiles
    .filter(f => /_pb2(_grpc)?\.py$/.test(f))
    .map(f => f.replace(/\.py$/, '').split(path.sep).join('.'));
  const config = path.join(dir, 'mypy.ini');
  fs.writeFileSync(
    config,
    ['[mypy]', 'strict = True', 'ignore_missing_imports = True', ...stubModules.flatMap(m => [`[mypy-${m}]`, 'ignore_errors = True'])].join('\n') + '\n'
  );
  const mypy = run(
    'python3',
    ['-m', 'mypy', '--config-file', config, '--no-error-summary', '--cache-dir', path.join(dir, '.mypy_cache'), ...targets],
    pyRoot,
    env
  );
  results.push(
    mypy.status === 0
      ? { language: 'python', tool: 'mypy --strict', status: 'passed' }
      : { language: 'python', tool: 'mypy --strict', status: 'failed', detail: (mypy.stdout || mypy.stderr).trim().slice(0, 1500) }
  );
  return results;
}

function verifyGo(dir: string, protocol: string | undefined): VerifyResult {
  const goDir = path.join(dir, 'go');
  if (!fs.existsSync(path.join(goDir, 'client.go'))) {
    return { language: 'go', tool: 'go build', status: 'skipped', detail: 'no Go client was generated' };
  }
  if (!have('go', ['version'])) {
    return { language: 'go', tool: 'go build', status: 'skipped', detail: 'go toolchain not found on PATH' };
  }
  const env = { ...process.env, GOFLAGS: '-mod=mod' };
  if (protocol === 'grpc') {
    if (!fs.existsSync(path.join(goDir, 'pb'))) {
      return { language: 'go', tool: 'go build', status: 'skipped', detail: 'protobuf stubs (go/pb) have not been generated; run generate-stubs.sh or pass --compile-stubs' };
    }
    const tidy = run('go', ['mod', 'tidy'], goDir, env);
    if (tidy.status !== 0) {
      return { language: 'go', tool: 'go mod tidy', status: 'failed', detail: (tidy.stderr || tidy.stdout).trim().slice(0, 800) };
    }
  }
  const build = run('go', ['build', './...'], goDir, env);
  if (build.status !== 0) {
    return { language: 'go', tool: 'go build ./...', status: 'failed', detail: (build.stderr || build.stdout).trim().slice(0, 1200) };
  }
  const vet = run('go', ['vet', './...'], goDir, env);
  if (vet.status !== 0) {
    return { language: 'go', tool: 'go vet ./...', status: 'failed', detail: (vet.stderr || vet.stdout).trim().slice(0, 1200) };
  }
  return { language: 'go', tool: 'go build ./... && go vet ./...', status: 'passed' };
}

/**
 * Verify a bridge output directory (as written by `writeBundle`).
 * Runs on a scratch copy; returns one result per tool actually considered.
 */
export function verifyBundleDir(root: string, languages: ClientLanguage[]): VerifyResult[] {
  const tmp = copyBundle(root);
  try {
    const protocol = readProtocol(tmp);
    const out: VerifyResult[] = [];
    if (languages.includes('ts')) out.push(verifyTypeScript(tmp));
    if (languages.includes('python')) out.push(...verifyPython(tmp, protocol));
    if (languages.includes('go')) out.push(verifyGo(tmp, protocol));
    return out;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Verify an in-memory bundle (written to a scratch dir first). */
export function verifyBundleFiles(files: ClientFile[], languages: ClientLanguage[]): VerifyResult[] {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-files-'));
  try {
    for (const f of files) {
      const target = path.join(tmp, f.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, f.content);
    }
    return verifyBundleDir(tmp, languages);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
