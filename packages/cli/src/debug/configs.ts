// VS Code launch configurations per language family.

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseToml } from 'smol-toml';

import { detectNodeManager } from '../pkg/detect';
import type { DebugKind } from './ports';

export interface ServiceDebugInput {
  name: string;
  kind: DebugKind;
  framework: string;
  /** Application port (workspace config). */
  appPort?: number;
  env: Record<string, string>;
  /** Absolute service directory. */
  dir: string;
  /** Service directory relative to the VS Code workspace folder (POSIX). */
  relDir: string;
  debugPort: number | null;
  /** In-container source root when the service runs in compose. */
  remoteRoot: string | null;
  /** Compose service name when running in compose. */
  composeService: string | null;
}

export type LaunchConfig = Record<string, unknown>;

export interface ServiceConfigs {
  /** Name prefix shared by all generated entries (used for merge ownership). */
  attach: LaunchConfig | null;
  launch: LaunchConfig | null;
  notes: string[];
}

export const NAME_PREFIX = 're-shell: ';

const folder = (rel: string): string => (rel === '.' || rel === '' ? '${workspaceFolder}' : `\${workspaceFolder}/${rel}`);

function exists(dir: string, ...p: string[]): boolean {
  return fs.existsSync(path.join(dir, ...p));
}

function firstExisting(dir: string, candidates: string[]): string | null {
  return candidates.find(c => exists(dir, c)) ?? null;
}

function pathMapping(i: ServiceDebugInput): Array<{ localRoot: string; remoteRoot: string }> | undefined {
  if (!i.composeService) return undefined;
  return [{ localRoot: folder(i.relDir), remoteRoot: i.remoteRoot ?? '/app' }];
}

function nodeConfigs(i: ServiceDebugInput): ServiceConfigs {
  const notes: string[] = [];
  const attach: LaunchConfig = {
    name: `${NAME_PREFIX}${i.name} (attach)`,
    type: 'node',
    request: 'attach',
    address: 'localhost',
    port: i.debugPort,
    restart: true,
    skipFiles: ['<node_internals>/**'],
    ...(i.composeService ? { localRoot: folder(i.relDir), remoteRoot: i.remoteRoot ?? '/app' } : {}),
  };

  let launch: LaunchConfig | null = null;
  let pkg: { scripts?: Record<string, string>; main?: string } | null = null;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(i.dir, 'package.json'), 'utf8'));
  } catch {
    pkg = null;
  }
  const script = ['dev', 'start', 'serve'].find(s => pkg?.scripts?.[s]);
  if (script) {
    let pm = detectNodeManager(i.dir).ecosystem as string;
    if (pm === 'bun') pm = 'npm';
    launch = {
      name: `${NAME_PREFIX}${i.name} (launch)`,
      type: 'node',
      request: 'launch',
      cwd: folder(i.relDir),
      runtimeExecutable: pm,
      runtimeArgs: ['run', script],
      console: 'integratedTerminal',
      skipFiles: ['<node_internals>/**'],
      ...(Object.keys(i.env).length > 0 || i.appPort ? { env: { ...(i.appPort ? { PORT: String(i.appPort) } : {}), ...i.env } } : {}),
    };
  } else if (pkg?.main) {
    launch = {
      name: `${NAME_PREFIX}${i.name} (launch)`,
      type: 'node',
      request: 'launch',
      cwd: folder(i.relDir),
      program: `${folder(i.relDir)}/${pkg.main}`,
      console: 'integratedTerminal',
      skipFiles: ['<node_internals>/**'],
    };
  } else {
    notes.push(`${i.name}: no dev/start script or "main" in package.json; only an attach configuration was generated`);
  }
  return { attach, launch, notes };
}

function bunConfigs(i: ServiceDebugInput): ServiceConfigs {
  const entry = firstExisting(i.dir, ['index.ts', 'src/index.ts', 'index.js', 'src/index.js', 'server.ts']);
  return {
    attach: {
      name: `${NAME_PREFIX}${i.name} (attach)`,
      type: 'bun',
      request: 'attach',
      url: `ws://localhost:${i.debugPort}/`,
    },
    launch: entry
      ? {
          name: `${NAME_PREFIX}${i.name} (launch)`,
          type: 'bun',
          request: 'launch',
          program: `${folder(i.relDir)}/${entry}`,
          cwd: folder(i.relDir),
          stopOnEntry: false,
          watchMode: false,
        }
      : null,
    notes: entry ? [] : [`${i.name}: no bun entry file found; only an attach configuration was generated`],
  };
}

function pythonConfigs(i: ServiceDebugInput): ServiceConfigs {
  const attach: LaunchConfig = {
    name: `${NAME_PREFIX}${i.name} (attach)`,
    type: 'debugpy',
    request: 'attach',
    connect: { host: 'localhost', port: i.debugPort },
    justMyCode: false,
    ...(pathMapping(i) ? { pathMappings: pathMapping(i) } : {}),
  };
  const fw = i.framework.toLowerCase();
  const env = { ...(i.appPort ? { PORT: String(i.appPort) } : {}), ...i.env };
  const base = { name: `${NAME_PREFIX}${i.name} (launch)`, type: 'debugpy', request: 'launch', cwd: folder(i.relDir), console: 'integratedTerminal', justMyCode: false, env };
  let launch: LaunchConfig;
  if ((fw === 'fastapi' || fw === 'sanic' || fw === 'starlette') && (exists(i.dir, 'app', 'main.py') || exists(i.dir, 'main.py'))) {
    const mod = exists(i.dir, 'app', 'main.py') ? 'app.main' : 'main';
    launch = { ...base, module: 'uvicorn', args: [`${mod}:app`, '--port', String(i.appPort ?? 8000)] };
  } else if (fw === 'flask' && firstExisting(i.dir, ['app.py', 'wsgi.py'])) {
    launch = { ...base, module: 'flask', env: { ...env, FLASK_APP: firstExisting(i.dir, ['app.py', 'wsgi.py']) }, args: ['run', '--no-debugger', '--no-reload', '--port', String(i.appPort ?? 5000)] };
  } else if (fw === 'django' && exists(i.dir, 'manage.py')) {
    launch = { ...base, program: `${folder(i.relDir)}/manage.py`, args: ['runserver', String(i.appPort ?? 8000), '--noreload'] };
  } else {
    const entry = firstExisting(i.dir, ['main.py', 'app.py', 'src/main.py', '__main__.py']);
    launch = { ...base, program: entry ? `${folder(i.relDir)}/${entry}` : '${file}' };
  }
  return { attach, launch, notes: [] };
}

function cargoPackageName(dir: string): string | null {
  try {
    const doc = parseToml(fs.readFileSync(path.join(dir, 'Cargo.toml'), 'utf8')) as { package?: { name?: string } };
    return doc.package?.name ?? null;
  } catch {
    return null;
  }
}

function goConfigs(i: ServiceDebugInput): ServiceConfigs {
  return {
    attach: {
      name: `${NAME_PREFIX}${i.name} (attach)`,
      type: 'go',
      request: 'attach',
      mode: 'remote',
      host: '127.0.0.1',
      port: i.debugPort,
      ...(i.composeService
        ? { substitutePath: [{ from: folder(i.relDir), to: i.remoteRoot ?? '/app' }] }
        : {}),
    },
    launch: {
      name: `${NAME_PREFIX}${i.name} (launch)`,
      type: 'go',
      request: 'launch',
      mode: 'auto',
      program: folder(i.relDir),
      cwd: folder(i.relDir),
      env: { ...(i.appPort ? { PORT: String(i.appPort) } : {}), ...i.env },
    },
    notes: [],
  };
}

function rustConfigs(i: ServiceDebugInput): ServiceConfigs {
  const crate = cargoPackageName(i.dir) ?? i.name;
  const manifest = `${folder(i.relDir)}/Cargo.toml`;
  return {
    attach: {
      name: `${NAME_PREFIX}${i.name} (attach)`,
      type: 'lldb',
      request: 'custom',
      targetCreateCommands: [`target create ${folder(i.relDir)}/target/debug/${crate}`],
      processCreateCommands: [`gdb-remote localhost:${i.debugPort}`],
      ...(i.composeService
        ? { sourceMap: { [i.remoteRoot ?? '/app']: folder(i.relDir) } }
        : {}),
    },
    launch: {
      name: `${NAME_PREFIX}${i.name} (launch)`,
      type: 'lldb',
      request: 'launch',
      cargo: { args: ['build', `--manifest-path=${manifest}`, `--bin=${crate}`], filter: { name: crate, kind: 'bin' } },
      args: [],
      cwd: folder(i.relDir),
      env: { ...(i.appPort ? { PORT: String(i.appPort) } : {}), ...i.env },
    },
    notes: [],
  };
}

function javaConfigs(i: ServiceDebugInput): ServiceConfigs {
  return {
    attach: {
      name: `${NAME_PREFIX}${i.name} (attach)`,
      type: 'java',
      request: 'attach',
      hostName: 'localhost',
      port: i.debugPort,
    },
    launch: null,
    notes: [
      `${i.name}: start the JVM with -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:${i.debugPort} (compose override does this automatically)`,
    ],
  };
}

function phpConfigs(i: ServiceDebugInput): ServiceConfigs {
  return {
    attach: {
      name: `${NAME_PREFIX}${i.name} (xdebug)`,
      type: 'php',
      request: 'launch',
      port: i.debugPort,
      ...(i.composeService
        ? { pathMappings: { [i.remoteRoot ?? '/var/www/html']: folder(i.relDir) } }
        : {}),
    },
    launch: null,
    notes: [`${i.name}: listens for Xdebug on port ${i.debugPort}; set xdebug.client_port=${i.debugPort} (compose override does this automatically)`],
  };
}

function rubyConfigs(i: ServiceDebugInput): ServiceConfigs {
  const rack = exists(i.dir, 'config.ru');
  const entry = firstExisting(i.dir, ['app.rb', 'main.rb', 'server.rb']);
  const launch: LaunchConfig | null =
    rack || entry
      ? {
          name: `${NAME_PREFIX}${i.name} (launch)`,
          type: 'rdbg',
          request: 'launch',
          command: rack ? 'rackup' : 'ruby',
          script: rack ? 'config.ru' : `${folder(i.relDir)}/${entry}`,
          cwd: folder(i.relDir),
          useBundler: exists(i.dir, 'Gemfile'),
        }
      : null;
  return {
    attach: {
      name: `${NAME_PREFIX}${i.name} (attach)`,
      type: 'rdbg',
      request: 'attach',
      debugPort: `localhost:${i.debugPort}`,
      ...(i.composeService
        ? { localfs: false, localfsMap: `${i.remoteRoot ?? '/app'}:${folder(i.relDir)}` }
        : { localfs: true }),
    },
    launch,
    notes: [],
  };
}

function dotnetDll(i: ServiceDebugInput): string | null {
  const proj = fs.existsSync(i.dir) ? fs.readdirSync(i.dir).find(f => /\.(cs|fs|vb)proj$/.test(f)) : undefined;
  if (!proj) return null;
  const xml = fs.readFileSync(path.join(i.dir, proj), 'utf8');
  const tfm = /<TargetFramework>\s*([^<]+?)\s*<\/TargetFramework>/.exec(xml)?.[1];
  const asm = /<AssemblyName>\s*([^<]+?)\s*<\/AssemblyName>/.exec(xml)?.[1] ?? proj.replace(/\.[^.]+$/, '');
  if (!tfm) return null;
  return `${folder(i.relDir)}/bin/Debug/${tfm}/${asm}.dll`;
}

function dotnetConfigs(i: ServiceDebugInput): ServiceConfigs {
  const notes: string[] = [];
  const dll = dotnetDll(i);
  const launch: LaunchConfig | null = dll
    ? {
        name: `${NAME_PREFIX}${i.name} (launch)`,
        type: 'coreclr',
        request: 'launch',
        program: dll,
        args: [],
        cwd: folder(i.relDir),
        stopAtEntry: false,
        env: { ...(i.appPort ? { ASPNETCORE_URLS: `http://localhost:${i.appPort}` } : {}), ...i.env },
      }
    : null;
  if (launch) notes.push(`${i.name}: build the project (dotnet build) before launching: the configuration runs the Debug output`);
  else notes.push(`${i.name}: no project file with a TargetFramework found; only an attach configuration was generated`);
  const attach: LaunchConfig = i.composeService
    ? {
        name: `${NAME_PREFIX}${i.name} (attach)`,
        type: 'coreclr',
        request: 'attach',
        processId: '${command:pickRemoteProcess}',
        pipeTransport: {
          pipeCwd: '${workspaceFolder}',
          pipeProgram: 'docker',
          pipeArgs: ['compose', 'exec', '-T', i.composeService],
          debuggerPath: '/vsdbg/vsdbg',
          quoteArgs: false,
        },
        sourceFileMap: { [i.remoteRoot ?? '/app']: folder(i.relDir) },
      }
    : {
        name: `${NAME_PREFIX}${i.name} (attach)`,
        type: 'coreclr',
        request: 'attach',
        processId: '${command:pickProcess}',
      };
  return { attach, launch, notes };
}

/** Build the attach/launch configurations for one service. */
export function buildServiceConfigs(i: ServiceDebugInput): ServiceConfigs {
  switch (i.kind) {
    case 'node':
      return nodeConfigs(i);
    case 'bun':
      return bunConfigs(i);
    case 'python':
      return pythonConfigs(i);
    case 'go':
      return goConfigs(i);
    case 'rust':
      return rustConfigs(i);
    case 'java':
      return javaConfigs(i);
    case 'php':
      return phpConfigs(i);
    case 'ruby':
      return rubyConfigs(i);
    case 'dotnet':
      return dotnetConfigs(i);
  }
}
