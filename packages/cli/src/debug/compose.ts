// docker-compose awareness for `debug config`: find the compose services that
// correspond to workspace services, work out their in-container source root
// and base command, and generate a debug override file.

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

import type { DebugKind } from './ports';

export const COMPOSE_FILE_NAMES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

type Json = Record<string, unknown>;

export interface ComposeServiceInfo {
  /** Compose service name. */
  name: string;
  /** Compose file the service came from (absolute). */
  file: string;
  def: Json;
  /** In-container source directory (best effort), or null when unknown. */
  remoteRoot: string | null;
  remoteRootSource: 'working_dir' | 'volume' | 'dockerfile' | null;
  /** Base command tokens, when determinable and wrap-safe. */
  command: string[] | null;
  commandSource: 'compose' | 'dockerfile' | null;
  /** Why the base command could not be used for wrapping, if so. */
  commandIssue?: string;
}

export function findComposeFiles(root: string): string[] {
  return COMPOSE_FILE_NAMES.map(n => path.join(root, n)).filter(f => fs.existsSync(f));
}

/** Minimal shell-style tokenizer (quotes + backslashes); rejects shell operators. */
export function splitCommand(cmd: string): string[] | null {
  const tokens: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === '\\' && quote === '"' && i + 1 < cmd.length) cur += cmd[++i];
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) tokens.push(cur);
      cur = '';
      has = false;
    } else if (ch === '\\' && i + 1 < cmd.length) {
      cur += cmd[++i];
      has = true;
    } else if ('&|;<>`$()'.includes(ch)) {
      return null; // shell syntax: not safely wrappable
    } else {
      cur += ch;
      has = true;
    }
  }
  if (quote) return null;
  if (has || cur) tokens.push(cur);
  return tokens;
}

function asTokens(v: unknown): string[] | null {
  if (Array.isArray(v)) return v.every(x => typeof x === 'string') ? (v as string[]) : null;
  if (typeof v === 'string') return splitCommand(v);
  return null;
}

/** Parse the last WORKDIR and the CMD/ENTRYPOINT of a Dockerfile (last stage wins). */
export function parseDockerfile(text: string): { workdir: string | null; cmd: string[] | null; entrypoint: boolean } {
  let workdir: string | null = null;
  let cmd: string[] | null = null;
  let entrypoint = false;
  const lines = text.replace(/\\\r?\n/g, ' ').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (/^FROM\s/i.test(line)) {
      workdir = null;
      cmd = null;
      entrypoint = false;
    }
    let m = /^WORKDIR\s+(\S+)/i.exec(line);
    if (m) workdir = m[1].startsWith('/') || !workdir ? m[1] : `${workdir.replace(/\/$/, '')}/${m[1]}`;
    m = /^CMD\s+(.+)$/i.exec(line);
    if (m) {
      const body = m[1].trim();
      if (body.startsWith('[')) {
        try {
          const parsed = JSON.parse(body) as unknown;
          cmd = Array.isArray(parsed) ? parsed.map(String) : null;
        } catch {
          cmd = null;
        }
      } else cmd = splitCommand(body);
    }
    if (/^ENTRYPOINT\s/i.test(line)) entrypoint = true;
  }
  return { workdir, cmd, entrypoint };
}

function buildContext(def: Json, composeDir: string): { context: string; dockerfile: string } | null {
  const build = def.build;
  if (typeof build === 'string') return { context: path.resolve(composeDir, build), dockerfile: 'Dockerfile' };
  if (build && typeof build === 'object') {
    const b = build as Json;
    const ctx = typeof b.context === 'string' ? b.context : '.';
    return {
      context: path.resolve(composeDir, ctx),
      dockerfile: typeof b.dockerfile === 'string' ? b.dockerfile : 'Dockerfile',
    };
  }
  return null;
}

/**
 * Load every compose file under `root` and map services that run a workspace
 * service (matched by service name or by build context == service directory).
 */
export function loadComposeServices(
  root: string,
  workspaceServices: Array<{ name: string; dir: string }>
): Map<string, ComposeServiceInfo> {
  const out = new Map<string, ComposeServiceInfo>();
  for (const file of findComposeFiles(root)) {
    let doc: { services?: Record<string, Json> };
    try {
      doc = (yaml.load(fs.readFileSync(file, 'utf8')) as { services?: Record<string, Json> }) ?? {};
    } catch {
      continue;
    }
    const composeDir = path.dirname(file);
    for (const [name, def] of Object.entries(doc.services ?? {})) {
      if (!def || typeof def !== 'object') continue;
      const bc = buildContext(def, composeDir);
      const ws = workspaceServices.find(s => s.name === name) ?? workspaceServices.find(s => bc && bc.context === s.dir);
      if (!ws || out.has(ws.name)) continue;

      let dockerfile: ReturnType<typeof parseDockerfile> | null = null;
      if (bc) {
        const df = path.resolve(bc.context, bc.dockerfile);
        if (fs.existsSync(df)) dockerfile = parseDockerfile(fs.readFileSync(df, 'utf8'));
      }

      // remote root
      let remoteRoot: string | null = null;
      let remoteRootSource: ComposeServiceInfo['remoteRootSource'] = null;
      if (typeof def.working_dir === 'string') {
        remoteRoot = def.working_dir;
        remoteRootSource = 'working_dir';
      } else {
        for (const v of Array.isArray(def.volumes) ? def.volumes : []) {
          const spec = typeof v === 'string' ? v : typeof v === 'object' && v ? `${(v as Json).source}:${(v as Json).target}` : '';
          const [host, container] = spec.split(':');
          if (host && container && container.startsWith('/') && path.resolve(composeDir, host) === ws.dir) {
            remoteRoot = container;
            remoteRootSource = 'volume';
            break;
          }
        }
        if (!remoteRoot && dockerfile?.workdir) {
          remoteRoot = dockerfile.workdir;
          remoteRootSource = 'dockerfile';
        }
      }

      // base command
      let command: string[] | null = null;
      let commandSource: ComposeServiceInfo['commandSource'] = null;
      let commandIssue: string | undefined;
      if (def.entrypoint !== undefined) {
        commandIssue = 'compose service defines an entrypoint';
      } else if (def.command !== undefined) {
        command = asTokens(def.command);
        commandSource = 'compose';
        if (!command) commandIssue = 'compose command uses shell syntax and cannot be wrapped safely';
      } else if (dockerfile?.entrypoint) {
        commandIssue = 'the image defines an ENTRYPOINT';
      } else if (dockerfile?.cmd) {
        command = dockerfile.cmd;
        commandSource = 'dockerfile';
      } else {
        commandIssue = 'no explicit command in compose or the Dockerfile';
      }
      if (command && command.length === 0) {
        command = null;
        commandIssue = 'empty command';
      }
      if (command && /^(sh|bash|zsh|ash|dash|env|exec|su|sudo|tini|dumb-init)$/.test(path.posix.basename(command[0]))) {
        command = null;
        commandIssue = 'the command runs through a shell or process wrapper';
      }

      out.set(ws.name, { name, file, def, remoteRoot, remoteRootSource, command, commandSource, commandIssue });
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Override generation
// --------------------------------------------------------------------------

function envEntries(def: Json): Record<string, string> {
  const env = def.environment;
  const out: Record<string, string> = {};
  if (Array.isArray(env)) {
    for (const e of env) {
      if (typeof e !== 'string') continue;
      const i = e.indexOf('=');
      if (i > 0) out[e.slice(0, i)] = e.slice(i + 1);
    }
  } else if (env && typeof env === 'object') {
    for (const [k, v] of Object.entries(env as Json)) out[k] = String(v ?? '');
  }
  return out;
}

export interface OverrideEntry {
  service: string;
  block: Json;
  notes: string[];
}

/**
 * Build the compose override block for one service. Wrapping (python/go/rust)
 * needs the base command; when it is unknown the block carries only the port
 * and environment parts and a note says what is missing.
 */
export function buildOverrideBlock(
  info: ComposeServiceInfo,
  kind: DebugKind,
  port: number | null,
  workspaceSvc: string
): OverrideEntry {
  const notes: string[] = [];
  const block: Json = {};
  const baseEnv = envEntries(info.def);
  const env: Record<string, string> = {};
  const ports: string[] = [];
  const addPort = (): void => {
    if (port !== null) ports.push(`${port}:${port}`);
  };
  const wrapNote = (tool: string, reason?: string): void => {
    notes.push(
      `${workspaceSvc}: command not wrapped for ${tool} (${reason ?? info.commandIssue ?? 'unknown command'}); start it manually under the debugger or set an explicit \`command\` in the compose file`
    );
  };

  switch (kind) {
    case 'node': {
      const existing = baseEnv.NODE_OPTIONS ? `${baseEnv.NODE_OPTIONS} ` : '';
      env.NODE_OPTIONS = `${existing}--inspect=0.0.0.0:${port}`;
      addPort();
      break;
    }
    case 'bun':
      env.BUN_INSPECT = `ws://0.0.0.0:${port}/`;
      addPort();
      break;
    case 'java': {
      const existing = baseEnv.JAVA_TOOL_OPTIONS ? `${baseEnv.JAVA_TOOL_OPTIONS} ` : '';
      env.JAVA_TOOL_OPTIONS = `${existing}-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=*:${port}`;
      addPort();
      break;
    }
    case 'ruby':
      env.RUBY_DEBUG_OPEN = 'true';
      env.RUBY_DEBUG_HOST = '0.0.0.0';
      env.RUBY_DEBUG_PORT = String(port);
      addPort();
      break;
    case 'php':
      env.XDEBUG_MODE = 'debug';
      env.XDEBUG_CONFIG = `client_host=host.docker.internal client_port=${port}`;
      block.extra_hosts = ['host.docker.internal:host-gateway'];
      break;
    case 'python': {
      addPort();
      const launcher = info.command?.[0] ?? '';
      const isPyExe = /^python[\d.]*$/.test(path.posix.basename(launcher));
      // `python -m <module>` only works for module-style launchers (uvicorn, gunicorn, flask, ...), not scripts/paths
      if (info.command && !isPyExe && /[\\/]/.test(launcher)) {
        wrapNote('debugpy', `"${launcher}" is a script path, not a python module`);
      } else if (info.command) {
        const [first, ...rest] = info.command;
        const isPython = isPyExe;
        block.command = isPython
          ? [first, '-m', 'debugpy', '--listen', `0.0.0.0:${port}`, ...rest]
          : ['python', '-m', 'debugpy', '--listen', `0.0.0.0:${port}`, '-m', first, ...rest];
        notes.push(`${workspaceSvc}: the image must have debugpy installed (pip install debugpy)`);
      } else wrapNote('debugpy');
      break;
    }
    case 'go': {
      addPort();
      block.cap_add = ['SYS_PTRACE'];
      block.security_opt = ['seccomp:unconfined'];
      if (info.command) {
        block.command = [
          'dlv', 'exec', '--headless', '--accept-multiclient', '--continue', '--api-version=2',
          `--listen=:${port}`, info.command[0], ...(info.command.length > 1 ? ['--', ...info.command.slice(1)] : []),
        ];
        notes.push(`${workspaceSvc}: the image must contain the delve binary (dlv) and a binary built with -gcflags="all=-N -l"`);
      } else wrapNote('delve');
      break;
    }
    case 'rust': {
      addPort();
      block.cap_add = ['SYS_PTRACE'];
      block.security_opt = ['seccomp:unconfined'];
      if (info.command) {
        block.command = ['gdbserver', `0.0.0.0:${port}`, ...info.command];
        notes.push(`${workspaceSvc}: the image must contain gdbserver and a debug build of the binary`);
      } else wrapNote('gdbserver');
      break;
    }
    case 'dotnet':
      block.volumes = ['./.vsdbg:/vsdbg:ro'];
      notes.push(
        `${workspaceSvc}: install vsdbg once with \`curl -sSL https://aka.ms/getvsdbgsh | bash /dev/stdin -v latest -l ./.vsdbg -r linux-x64\`; the container needs a Debug build`
      );
      break;
  }
  if (Object.keys(env).length > 0) block.environment = env;
  if (ports.length > 0) block.ports = ports;
  return { service: info.name, block, notes };
}

/** Render the override file. */
export function renderOverride(entries: OverrideEntry[]): string {
  const services: Json = {};
  for (const e of entries) services[e.service] = e.block;
  const header =
    '# Generated by `re-shell debug config`. Use together with your base file:\n' +
    '#   docker compose -f docker-compose.yml -f docker-compose.debug.yml up\n';
  return header + yaml.dump({ services }, { lineWidth: 120, noRefs: true });
}
