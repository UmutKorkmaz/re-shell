// `re-shell service bridge transform` - JSON <-> Protobuf <-> Avro <-> MessagePack.

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';

import { runBridgeCommand } from '../run';
import { BridgeTransformError, DATA_FORMATS, bytesToBase64, loadRules, sideSchema, transform, type DataFormat } from './index';

/** Options of {@link runTransform}. */
export interface TransformCommandOptions {
  from?: string;
  to?: string;
  /** Input file path (`-` = stdin). */
  input?: string;
  /** Inline input instead of a file. */
  data?: string;
  /** How `--data` / the input file are encoded: utf8 (default for json), base64 or hex (for binary formats). */
  inputEncoding?: string;
  schema?: string;
  message?: string;
  fromSchema?: string;
  fromMessage?: string;
  toSchema?: string;
  toMessage?: string;
  migrate?: string;
  out?: string;
  pretty?: boolean;
  cwd?: string;
  json?: boolean;
}

/** JSON payload of the command. */
export interface TransformCommandResult {
  from: DataFormat;
  to: DataFormat;
  bytes: number;
  /** JSON text when the target is json. */
  output?: string;
  /** Encoded bytes (base64) when the target is binary. */
  outputBase64?: string;
  /** The decoded, migrated value (bytes as base64). */
  value: unknown;
  steps: string[];
  written?: string;
}

function readInput(options: TransformCommandOptions, cwd: string, from: DataFormat): Buffer {
  const encoding = options.inputEncoding ?? (from === 'json' ? 'utf8' : 'binary');
  let raw: Buffer;
  if (options.data !== undefined) raw = Buffer.from(options.data, 'utf8');
  else if (options.input === '-' || options.input === undefined) {
    if (options.input === undefined) throw new BridgeTransformError('give the input with --input <file> (or - for stdin) or --data <inline>');
    raw = fs.readFileSync(0);
  } else {
    try {
      raw = fs.readFileSync(path.resolve(cwd, options.input));
    } catch (error: unknown) {
      throw new BridgeTransformError(`cannot read input ${options.input}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (encoding === 'base64') return Buffer.from(raw.toString('utf8').trim(), 'base64');
  if (encoding === 'hex') return Buffer.from(raw.toString('utf8').trim(), 'hex');
  if (encoding === 'utf8' || encoding === 'binary') return raw;
  throw new BridgeTransformError(`--input-encoding must be utf8, base64 or hex (got "${encoding}")`);
}

/** `re-shell service bridge transform` */
export async function runTransform(options: TransformCommandOptions): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  await runBridgeCommand<TransformCommandResult>({
    json: options.json,
    code: 'BRIDGE_TRANSFORM_ERROR',
    run: () => {
      const from = options.from as DataFormat;
      const to = options.to as DataFormat;
      if (!DATA_FORMATS.includes(from) || !DATA_FORMATS.includes(to)) {
        throw new BridgeTransformError(`--from and --to must each be one of ${DATA_FORMATS.join(', ')}`);
      }
      const abs = (f: string | undefined): string | undefined => (f ? path.resolve(cwd, f) : undefined);
      const result = transform({
        from,
        to,
        input: readInput(options, cwd, from),
        fromSchema: sideSchema(abs(options.fromSchema ?? options.schema), options.fromMessage ?? options.message),
        toSchema: sideSchema(abs(options.toSchema ?? options.schema), options.toMessage ?? options.message),
        rules: options.migrate ? loadRules(path.resolve(cwd, options.migrate)) : undefined,
        pretty: options.pretty,
      });
      let written: string | undefined;
      if (options.out) {
        written = path.resolve(cwd, options.out);
        fs.mkdirSync(path.dirname(written), { recursive: true });
        fs.writeFileSync(written, result.output);
      }
      return {
        from,
        to,
        bytes: result.output.length,
        ...(to === 'json' ? { output: result.output.toString('utf8') } : { outputBase64: result.output.toString('base64') }),
        value: bytesToBase64(result.value),
        steps: result.steps,
        ...(written ? { written } : {}),
      };
    },
    render: r => {
      if (r.written) console.log(chalk.green(`Wrote ${r.bytes} byte(s) of ${r.to} to ${r.written}`));
      else if (r.output !== undefined) process.stdout.write(r.output);
      else console.log(r.outputBase64);
      for (const s of r.steps) console.error(chalk.gray(`  ${s}`));
    },
  });
}
