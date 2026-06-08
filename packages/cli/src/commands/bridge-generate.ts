import chalk from 'chalk';

import {
  generateBridge,
  type BridgeProtocol,
  type GenerateBridgeResult,
} from '../utils/bridge-generate';
import { ok, fail, enableJsonMode } from '../utils/json-output';
import type { ProgressSpinner } from '../utils/spinner';

export interface BridgeGenerateCommandOptions {
  protocol?: string;
  service?: string;
  out?: string;
  json?: boolean;
  dryRun?: boolean;
  cwd?: string;
  configPath?: string;
  spinner?: ProgressSpinner;
}

/**
 * Result of type-checking the emitted TS client with the TypeScript compiler
 * API. `ran` is false (best-effort) when `typescript` is not resolvable.
 */
export interface TsCheckResult {
  ran: boolean;
  ok?: boolean;
  /** Why tsc was skipped, or a diagnostic summary when it ran. */
  detail?: string;
}

function normalizeProtocol(protocol: string | undefined): BridgeProtocol {
  if (protocol === 'grpc' || protocol === 'rest' || protocol === 'graphql') {
    return protocol;
  }
  throw new Error(
    `Unknown bridge protocol "${protocol ?? ''}" (expected grpc|rest|graphql)`
  );
}

/**
 * Type-check the emitted TS client in-memory via the TypeScript compiler API.
 * Never throws; absence of `typescript` is reported as not-run so generation
 * stays usable without it. Only the emitted client's own syntax/semantics are
 * checked (lib types are available; external module imports are not required by
 * the generated stubs, which are dependency-free).
 */
export function typeCheckTsClient(result: GenerateBridgeResult): TsCheckResult {
  const client = result.artifacts.find(a => a.kind === 'ts-client');
  if (!client) {
    return { ran: false, detail: 'no ts-client artifact to check' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ts: typeof import('typescript');
  try {
    // Lazy require so a missing dependency degrades gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ts = require('typescript') as typeof import('typescript');
  } catch {
    return { ran: false, detail: 'typescript not resolvable' };
  }

  const fileName = 'client.ts';
  const sourceFile = ts.createSourceFile(
    fileName,
    client.content,
    ts.ScriptTarget.ES2020,
    true
  );

  const compilerOptions: import('typescript').CompilerOptions = {
    noEmit: true,
    strict: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
    skipLibCheck: true,
  };

  const defaultHost = ts.createCompilerHost(compilerOptions);
  const host: import('typescript').CompilerHost = {
    ...defaultHost,
    getSourceFile: (name, languageVersion, onError, shouldCreate) => {
      if (name === fileName) return sourceFile;
      return defaultHost.getSourceFile(name, languageVersion, onError, shouldCreate);
    },
    writeFile: () => {},
    fileExists: name => name === fileName || defaultHost.fileExists(name),
    readFile: name =>
      name === fileName ? client.content : defaultHost.readFile(name),
  };

  const programDiagnostics = ts.createProgram([fileName], compilerOptions, host);
  const diagnostics = [
    ...programDiagnostics.getSyntacticDiagnostics(sourceFile),
    ...programDiagnostics.getSemanticDiagnostics(sourceFile),
  ];

  if (diagnostics.length === 0) {
    return { ran: true, ok: true };
  }
  const detail = diagnostics
    .map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    .join('; ');
  return { ran: true, ok: false, detail };
}

/**
 * `service bridge generate --grpc|--rest|--graphql` — read the workspace v2
 * config, select a service, and emit a contract artifact + a typed TS client +
 * a documented Python scaffold. In `--json`/`--dry-run` mode nothing is written;
 * the ok envelope carries `{ protocol, service, artifacts, written, tsCheck }`.
 * With `--out` (and not dry-run) artifacts are written to disk. Errors map to a
 * `BRIDGE_GENERATE_ERROR` envelope (exit 1).
 */
export async function runBridgeGenerate(
  options: BridgeGenerateCommandOptions = {}
): Promise<void> {
  const generate = (): GenerateBridgeResult =>
    generateBridge({
      protocol: normalizeProtocol(options.protocol),
      service: options.service,
      cwd: options.cwd,
      configPath: options.configPath,
      out: options.out,
      dryRun: options.dryRun,
    });

  if (options.json) {
    const restore = enableJsonMode();
    try {
      const result = generate();
      const tsCheck = typeCheckTsClient(result);
      const warnings: string[] = [];
      if (!tsCheck.ran) {
        warnings.push(`tsc check not run: ${tsCheck.detail ?? 'unavailable'}`);
      } else if (tsCheck.ok === false) {
        warnings.push(`tsc reported issues: ${tsCheck.detail ?? ''}`.trim());
      }
      ok(
        {
          protocol: result.protocol,
          service: result.service,
          artifacts: result.artifacts,
          written: result.written,
          tsCheck,
        },
        warnings
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown bridge generate error';
      fail('BRIDGE_GENERATE_ERROR', message);
    } finally {
      restore();
    }
    return;
  }

  if (options.spinner) options.spinner.stop();

  try {
    const result = generate();
    const tsCheck = typeCheckTsClient(result);
    displayResult(result, tsCheck, Boolean(options.dryRun));
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Unknown bridge generate error';
    console.error(chalk.red(`Bridge generate failed: ${message}`));
    process.exitCode = 1;
  }
}

function displayResult(
  result: GenerateBridgeResult,
  tsCheck: TsCheckResult,
  dryRun: boolean
): void {
  console.log(chalk.cyan(`\n🌉 Service bridge generation (${result.protocol})`));
  console.log(chalk.gray('═'.repeat(50)));
  console.log(`Service: ${chalk.bold(result.service)}`);
  console.log(`Artifacts: ${chalk.bold(result.artifacts.length)}`);
  for (const artifact of result.artifacts) {
    console.log(`  ${chalk.green('•')} ${artifact.path} ${chalk.gray(`(${artifact.kind})`)}`);
  }

  if (dryRun) {
    console.log(chalk.yellow('\nDry-run: no files written.'));
  } else if (result.written.length > 0) {
    console.log(chalk.green(`\nWrote ${result.written.length} file(s).`));
  } else {
    console.log(chalk.yellow('\nNo --out directory provided; nothing written.'));
  }

  if (tsCheck.ran) {
    const icon = tsCheck.ok ? chalk.green('✓') : chalk.red('✖');
    console.log(`\n${icon} tsc client check: ${tsCheck.ok ? 'PASS' : 'issues'}`);
    if (!tsCheck.ok && tsCheck.detail) console.log(chalk.gray(tsCheck.detail));
  } else {
    console.log(chalk.gray('\ntsc not run (typescript unavailable); client emitted as-is.'));
  }
}
