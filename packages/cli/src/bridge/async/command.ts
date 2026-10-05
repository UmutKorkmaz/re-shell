// `re-shell service bridge async` - generate typed async producers/consumers.

import chalk from 'chalk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BRIDGE_MARKER } from '../spec/discover';
import { BridgeSpecError } from '../spec/errors';
import { writeBundle } from '../generate';
import { runBridgeCommand } from '../run';
import { copyBundle, verifyPython, verifyTypeScript, type VerifyResult } from '../verify';
import { loadWorkspace } from '../workspace';
import { generateAsync, type AsyncLanguage, type AsyncTransport } from './codegen';
import { loadAsyncContract } from './spec';

/** Options of {@link runAsync}. */
export interface AsyncCommandOptions {
  transport?: string;
  spec?: string;
  service?: string;
  lang?: string;
  out?: string;
  dryRun?: boolean;
  verify?: boolean;
  init?: boolean;
  cwd?: string;
  configPath?: string;
  json?: boolean;
}

/** JSON payload of the command. */
export interface AsyncCommandResult {
  service: string;
  transport: AsyncTransport | null;
  languages: AsyncLanguage[];
  messages: { name: string; channel: string; currentVersion: number; versions: number[] }[];
  artifacts: { path: string; kind: string; content: string }[];
  written: string[];
  verification?: VerifyResult[];
  initialized?: string;
}

const STARTER = `# Async contract: the messages this service publishes/consumes.
# Field types: string number integer boolean datetime any object, T[] arrays,
# a trailing ? for optional, enum(a|b). Migration rules (turn the PREVIOUS
# version's payload into this one): rename, add, remove, copy, convert.
service: orders
messages:
  OrderCreated:
    channel: orders.created
    currentVersion: 2
    versions:
      1:
        fields: { orderId: string, amount: number }
      2:
        fields: { orderId: string, total: number, currency: "enum(USD|EUR)" }
        migrate:
          - rename: { from: amount, to: total }
          - add: { field: currency, default: USD }
`;

function discoverSpec(cwd: string, explicit?: string): string {
  if (explicit) return path.resolve(cwd, explicit);
  for (const n of ['async.yaml', 'async.yml', 'async.json']) {
    const p = path.join(cwd, n);
    if (fs.existsSync(p)) return p;
  }
  throw new BridgeSpecError('no async contract found (looked for async.yaml/async.yml/async.json); pass --spec <file> or create one with --init');
}

function parseLangs(value: string | undefined, transport: AsyncTransport): AsyncLanguage[] {
  if (!value) return transport === 'kafka' ? ['ts'] : ['ts', 'python'];
  const out: AsyncLanguage[] = [];
  for (const raw of value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)) {
    const lang = raw === 'typescript' ? 'ts' : raw === 'py' ? 'python' : raw;
    if (lang !== 'ts' && lang !== 'python') throw new BridgeSpecError(`async runtimes exist for ts and python only (got "${raw}")`);
    if (!out.includes(lang)) out.push(lang);
  }
  return out;
}

/** `re-shell service bridge async` */
export async function runAsync(options: AsyncCommandOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  await runBridgeCommand<AsyncCommandResult>({
    json: options.json,
    code: 'BRIDGE_ASYNC_ERROR',
    run: () => {
      if (options.init) {
        const target = path.resolve(cwd, options.spec ?? 'async.yaml');
        if (fs.existsSync(target)) throw new BridgeSpecError(`${target} already exists; refusing to overwrite it`);
        fs.writeFileSync(target, STARTER);
        return { service: 'orders', transport: null, languages: [], messages: [], artifacts: [], written: [target], initialized: target };
      }
      if (options.transport !== 'kafka' && options.transport !== 'redis-streams') {
        throw new BridgeSpecError(`--transport must be kafka or redis-streams (got "${options.transport ?? ''}")`);
      }
      const transport: AsyncTransport = options.transport;
      const contract = loadAsyncContract(discoverSpec(cwd, options.spec), options.service);
      if (options.service) contract.service = options.service;
      const languages = parseLangs(options.lang, transport);

      let registry: Record<string, { url: string }> | undefined;
      try {
        const ws = loadWorkspace(cwd, options.configPath);
        registry = {};
        for (const [name, svc] of Object.entries(ws.config.services ?? {})) if (svc.port) registry[name] = { url: `http://localhost:${svc.port}` };
        registry[transport === 'kafka' ? 'kafka' : 'redis'] = { url: transport === 'kafka' ? 'localhost:9092' : 'redis://localhost:6379' };
      } catch {
        registry = undefined; // no workspace: no registry file
      }

      const { files, warnings } = generateAsync({ contract, transport, languages, registry });
      files.push({
        path: BRIDGE_MARKER,
        content: JSON.stringify({ generator: 're-shell service bridge async', service: contract.service, protocol: 'async', transport, languages, contract: path.basename(contract.source.path), contractSha256: contract.source.sha256 }, null, 2) + '\n',
        kind: 'support',
      });
      const written: string[] = [];
      let root: string | undefined;
      if (options.out && !options.dryRun) {
        root = path.join(path.resolve(cwd, options.out), `${contract.service}-async-${transport}`);
        written.push(...writeBundle(files, root));
      }
      let verification: VerifyResult[] | undefined;
      if (options.verify) {
        const dir = root ?? (() => {
          const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bridge-async-'));
          writeBundle(files, tmp);
          return tmp;
        })();
        const copy = copyBundle(dir);
        try {
          verification = [];
          if (languages.includes('ts')) verification.push(verifyTypeScript(copy, 'ts/index.ts'));
          if (languages.includes('python')) verification.push(...verifyPython(copy, 'async'));
        } finally {
          fs.rmSync(copy, { recursive: true, force: true });
          if (!root) fs.rmSync(dir, { recursive: true, force: true });
        }
        for (const v of verification) if (v.status !== 'passed') warnings.push(`${v.language} verification ${v.status} (${v.tool})${v.detail ? `: ${v.detail}` : ''}`);
      }
      return {
        service: contract.service,
        transport,
        languages,
        messages: contract.messages.map(m => ({ name: m.name, channel: m.channel, currentVersion: m.currentVersion, versions: m.versions.map(v => v.version) })),
        artifacts: files.map(f => ({ path: f.path, kind: f.kind, content: f.content })),
        written,
        verification,
        ...(warnings.length ? { warnings } : {}),
      } as AsyncCommandResult;
    },
    warnings: r => (r as AsyncCommandResult & { warnings?: string[] }).warnings ?? [],
    exitCode: r => (r.verification?.some(v => v.status === 'failed') ? 1 : 0),
    render: r => {
      if (r.initialized) {
        console.log(chalk.green(`Wrote starter async contract ${r.initialized}`));
        return;
      }
      console.log(chalk.cyan(`\nAsync messaging for ${r.service} (${r.transport}; ${r.languages.join(', ')})`));
      for (const m of r.messages) console.log(`  ${chalk.green('•')} ${m.name} -> ${m.channel} (current v${m.currentVersion}, versions ${m.versions.join(',')})`);
      console.log(r.written.length ? chalk.green(`\nWrote ${r.written.length} file(s).`) : chalk.yellow('\nNothing written (pass --out <dir>).'));
      for (const v of r.verification ?? []) console.log(`  ${v.status === 'passed' ? chalk.green('✓') : v.status === 'failed' ? chalk.red('✖') : chalk.gray('-')} ${v.language}: ${v.tool} ${v.status}${v.detail ? ` (${v.detail})` : ''}`);
      for (const w of (r as AsyncCommandResult & { warnings?: string[] }).warnings ?? []) console.log(chalk.yellow(`  warning: ${w}`));
    },
  });
}
