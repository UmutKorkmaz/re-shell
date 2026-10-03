// `re-shell service bridge gateway` - compose services' GraphQL SDLs into one gateway.

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import { writeBundle } from './generate';
import { generateGateway, BridgeGatewayError, type GatewayMode, type GatewayResult, type Subgraph } from './gateway';
import { runBridgeCommand } from './run';
import { discoverSpecs, selectSpec } from './spec/discover';
import { BridgeSpecError } from './spec/errors';
import { loadWorkspace, serviceDir } from './workspace';

/** Options of {@link runGateway}. */
export interface GatewayCommandOptions {
  /** Workspace service names whose GraphQL SDL (discovered in the service dir) joins the gateway. */
  services?: string[];
  /** Explicit subgraphs: `name=path/to/schema.graphql[@http://host:port/graphql]`. */
  subgraphs?: string[];
  mode?: GatewayMode | string;
  out?: string;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  json?: boolean;
}

/** JSON payload of the command. */
export interface GatewayCommandResult extends Omit<GatewayResult, 'files'> {
  artifacts: { path: string; kind: string; content: string }[];
  written: string[];
}

function parseSubgraphFlag(value: string, cwd: string): Subgraph {
  const eq = value.indexOf('=');
  if (eq <= 0) throw new BridgeGatewayError(`invalid --subgraph "${value}" (expected name=path[@url])`);
  const name = value.slice(0, eq);
  let rest = value.slice(eq + 1);
  let url: string | undefined;
  const at = rest.lastIndexOf('@http');
  if (at >= 0) {
    url = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }
  const file = path.resolve(cwd, rest);
  if (!fs.existsSync(file)) throw new BridgeSpecError(`subgraph "${name}": ${file} does not exist`);
  return { name, sdl: fs.readFileSync(file, 'utf8'), url, source: file };
}

/** Resolve the subgraph list from workspace services and/or explicit flags. */
export function resolveSubgraphs(options: GatewayCommandOptions): { subgraphs: Subgraph[]; warnings: string[] } {
  const cwd = options.cwd ?? process.cwd();
  const subgraphs: Subgraph[] = [];
  const warnings: string[] = [];
  if (options.services?.length) {
    const ws = loadWorkspace(cwd, options.configPath);
    for (const name of options.services) {
      const svc = ws.config.services?.[name];
      if (!svc) throw new BridgeGatewayError(`service "${name}" not found in ${path.basename(ws.configPath)}`);
      const dir = serviceDir(ws, name);
      const spec = selectSpec(discoverSpecs(dir).filter(c => c.protocol === 'graphql'), 'graphql', dir);
      subgraphs.push({
        name,
        sdl: fs.readFileSync(spec.path, 'utf8'),
        url: svc.port ? `http://localhost:${svc.port}/graphql` : undefined,
        source: spec.path,
      });
      if (!svc.port) warnings.push(`service "${name}" declares no port; its gateway URL is unset`);
    }
  }
  for (const flag of options.subgraphs ?? []) subgraphs.push(parseSubgraphFlag(flag, cwd));
  return { subgraphs, warnings };
}

/** `re-shell service bridge gateway` */
export async function runGateway(options: GatewayCommandOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  await runBridgeCommand<GatewayCommandResult>({
    json: options.json,
    code: 'BRIDGE_GATEWAY_ERROR',
    run: () => {
      const mode = options.mode ?? 'federation';
      if (mode !== 'federation' && mode !== 'stitch') {
        throw new BridgeGatewayError(`unknown gateway mode "${String(mode)}" (expected federation|stitch)`);
      }
      const { subgraphs, warnings: resolveWarnings } = resolveSubgraphs(options);
      const result = generateGateway(subgraphs, mode);
      const written: string[] = [];
      if (options.out && !options.dryRun) {
        written.push(...writeBundle(result.files, path.resolve(cwd, options.out)));
      }
      const { files, ...rest } = result;
      return {
        ...rest,
        warnings: [...resolveWarnings, ...result.warnings],
        artifacts: files.map(f => ({ path: f.path, kind: f.kind, content: f.content })),
        written,
      };
    },
    warnings: r => r.warnings,
    render: r => {
      console.log(chalk.cyan(`\nGraphQL gateway (${r.mode})`));
      for (const s of r.subgraphs) console.log(`  ${chalk.green('•')} ${s.name}${s.url ? ` -> ${s.url}` : ''} (${s.types} types, ${s.rootFields.length} root fields)`);
      for (const a of r.artifacts) console.log(`  ${a.path} ${chalk.gray(`(${a.kind})`)}`);
      console.log(r.written.length ? chalk.green(`\nWrote ${r.written.length} file(s).`) : chalk.yellow('\nNothing written (pass --out <dir>).'));
      for (const w of r.warnings) console.log(chalk.yellow(`  warning: ${w}`));
    },
  });
}
