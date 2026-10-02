// Compile protobuf stubs for the Python / Go gRPC clients, using whichever
// protoc is genuinely available: `python3 -m grpc_tools.protoc` (pip install
// grpcio-tools) or a protoc binary on PATH. Nothing is simulated: when a tool
// is missing the step is reported as skipped with the exact install hint.

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import type { BridgeBundle } from './generate';
import type { ClientLanguage } from './codegen/common';

/** Outcome of one stub-compilation step. */
export interface StubResult {
  language: 'python' | 'go';
  status: 'generated' | 'skipped' | 'failed';
  detail: string;
}

interface Protoc {
  cmd: string;
  args: string[];
  label: string;
}

function tryRun(cmd: string, args: string[], cwd?: string, env?: NodeJS.ProcessEnv) {
  return spawnSync(cmd, args, { cwd, env: env ?? process.env, encoding: 'utf8', timeout: 240000 });
}

/** Locate a protoc: grpcio-tools first (pip-installable), then `protoc` on PATH. */
export function findProtoc(): Protoc | undefined {
  const py = tryRun('python3', ['-c', 'import grpc_tools.protoc']);
  if (!py.error && py.status === 0) {
    return { cmd: 'python3', args: ['-m', 'grpc_tools.protoc'], label: 'python3 -m grpc_tools.protoc' };
  }
  const bin = tryRun('protoc', ['--version']);
  if (!bin.error && bin.status === 0) return { cmd: 'protoc', args: [], label: 'protoc' };
  return undefined;
}

function goBinDirs(): string[] {
  const dirs: string[] = [];
  const gopath = tryRun('go', ['env', 'GOPATH']);
  if (!gopath.error && gopath.status === 0) {
    for (const p of gopath.stdout.trim().split(path.delimiter).filter(Boolean)) dirs.push(path.join(p, 'bin'));
  }
  const gobin = tryRun('go', ['env', 'GOBIN']);
  if (!gobin.error && gobin.status === 0 && gobin.stdout.trim()) dirs.push(gobin.stdout.trim());
  return dirs;
}

function findPlugins(): { dir?: string; missing: string[] } {
  const wanted = ['protoc-gen-go', 'protoc-gen-go-grpc'];
  const searchDirs = [...(process.env.PATH ?? '').split(path.delimiter), ...goBinDirs()].filter(Boolean);
  let dir: string | undefined;
  const missing: string[] = [];
  for (const name of wanted) {
    const hit = searchDirs.find(d => fs.existsSync(path.join(d, name)));
    if (!hit) missing.push(name);
    else dir = dir ?? hit;
  }
  return { dir, missing };
}

/**
 * Compile the protobuf stubs the Python/Go gRPC clients import, writing them
 * into the bridge directory `root`.
 */
export function compileGrpcStubs(root: string, grpc: NonNullable<BridgeBundle['grpc']>, languages: ClientLanguage[]): StubResult[] {
  const results: StubResult[] = [];
  const protoc = findProtoc();
  const wantPy = languages.includes('python');
  const wantGo = languages.includes('go');

  if (wantPy) {
    if (!protoc) {
      results.push({ language: 'python', status: 'skipped', detail: 'no protoc available (pip install grpcio-tools)' });
    } else {
      const out = path.join(root, 'python', grpc.pyPackage);
      fs.mkdirSync(out, { recursive: true });
      const r = tryRun(
        protoc.cmd,
        [...protoc.args, `-I${root}`, `--python_out=${out}`, `--pyi_out=${out}`, `--grpc_python_out=${out}`, path.join(root, grpc.protoFile)]
      );
      if (r.status !== 0) {
        results.push({ language: 'python', status: 'failed', detail: `${protoc.label}: ${(r.stderr || r.stdout || String(r.error)).trim().slice(0, 600)}` });
      } else {
        // protoc emits absolute imports; make them package-relative.
        for (const file of fs.readdirSync(out).filter(f => f.endsWith('_pb2_grpc.py'))) {
          const p = path.join(out, file);
          fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^import ([A-Za-z0-9_]+_pb2) as/gm, 'from . import $1 as'));
        }
        results.push({ language: 'python', status: 'generated', detail: `${protoc.label} -> python/${grpc.pyPackage}/*_pb2*.py` });
      }
    }
  }

  if (wantGo) {
    const plugins = findPlugins();
    if (!protoc) {
      results.push({ language: 'go', status: 'skipped', detail: 'no protoc available (pip install grpcio-tools)' });
    } else if (plugins.missing.length > 0) {
      results.push({
        language: 'go',
        status: 'skipped',
        detail: `missing ${plugins.missing.join(', ')} (go install google.golang.org/protobuf/cmd/protoc-gen-go@latest google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest)`,
      });
    } else {
      const out = path.join(root, 'go', 'pb');
      fs.mkdirSync(out, { recursive: true });
      const mapping = `M${grpc.protoFile}=${grpc.goModule}/pb`;
      const env = { ...process.env, PATH: `${plugins.dir}${path.delimiter}${process.env.PATH ?? ''}` };
      const r = tryRun(
        protoc.cmd,
        [
          ...protoc.args,
          `-I${root}`,
          `--go_out=${out}`,
          `--go_opt=paths=source_relative,${mapping}`,
          `--go-grpc_out=${out}`,
          `--go-grpc_opt=paths=source_relative,${mapping}`,
          path.join(root, grpc.protoFile),
        ],
        undefined,
        env
      );
      if (r.status !== 0) {
        results.push({ language: 'go', status: 'failed', detail: `${protoc.label}: ${(r.stderr || r.stdout || String(r.error)).trim().slice(0, 600)}` });
      } else {
        const tidy = tryRun('go', ['mod', 'tidy'], path.join(root, 'go'));
        const note = tidy.status === 0 ? ' (go mod tidy ok)' : ` (go mod tidy failed: ${(tidy.stderr || '').trim().slice(0, 200)}; run it with network access)`;
        results.push({ language: 'go', status: 'generated', detail: `${protoc.label} -> go/pb/*.pb.go${note}` });
      }
    }
  }
  return results;
}
