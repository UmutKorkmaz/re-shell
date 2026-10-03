// Orchestrates one `re-shell pkg` operation: detect ecosystem, plan native
// commands, verify toolchains, apply manifest edits, execute, normalize output.

import * as fs from 'fs';

import { planOperation } from './commands';
import { detectEcosystems } from './detect';
import { applyEdit, computeEdit, rollbackEdit, type AppliedEdit } from './manifest-edit';
import { listDependencies } from './manifests';
import { parseOutdated } from './outdated';
import { defaultExecutor, findExecutable, type ExecResult, type Executor } from './exec';
import {
  ECOSYSTEMS,
  PkgError,
  type Ecosystem,
  type PkgDependency,
  type PkgOperation,
  type PkgOutdated,
  type PlannedCommand,
} from './types';

export interface PkgRunInput {
  operation: PkgOperation;
  packages?: string[];
  dir: string;
  /** Override detection. */
  ecosystem?: Ecosystem;
  dev?: boolean;
  dryRun?: boolean;
  /** Mirror child output to the terminal (human mode). */
  stream?: boolean;
  /** Service name when the target came from `--service`. */
  service?: string | null;
  executor?: Executor;
  env?: NodeJS.ProcessEnv;
}

export interface PkgCommandRecord {
  argv: string[];
  cwd: string;
  purpose: string;
  executed: boolean;
  exitCode: number | null;
  durationMs: number | null;
  stdout?: string;
  stderr?: string;
}

export interface PkgManifestEditRecord {
  file: string;
  action: 'add' | 'remove';
  entries: string[];
  applied: boolean;
  changed: boolean;
}

export interface PkgRunResult {
  operation: PkgOperation;
  ecosystem: Ecosystem;
  detectedBy: string;
  dir: string;
  service: string | null;
  dryRun: boolean;
  packages: string[];
  dev: boolean;
  commands: PkgCommandRecord[];
  manifestEdits: PkgManifestEditRecord[];
  dependencies: PkgDependency[];
  outdated: PkgOutdated[];
  warnings: string[];
}

const TOOL_HINTS: Record<string, string> = {
  npm: 'Install Node.js (https://nodejs.org) which bundles npm',
  pnpm: 'Install pnpm: `npm i -g pnpm` or `corepack enable`',
  yarn: 'Install yarn: `npm i -g yarn` or `corepack enable`',
  bun: 'Install bun: https://bun.sh',
  python3: 'Install Python 3 (https://python.org)',
  python: 'Install Python 3 (https://python.org)',
  poetry: 'Install poetry: https://python-poetry.org/docs/#installation',
  uv: 'Install uv: https://docs.astral.sh/uv/',
  cargo: 'Install Rust: https://rustup.rs',
  mvn: 'Install Apache Maven: https://maven.apache.org',
  gradle: 'Install Gradle: https://gradle.org/install',
  dotnet: 'Install the .NET SDK: https://dotnet.microsoft.com/download',
  composer: 'Install Composer: https://getcomposer.org',
  bundle: 'Install Ruby + Bundler: `gem install bundler`',
  go: 'Install Go: https://go.dev/dl',
};

const MAX_RECORDED_OUTPUT = 20_000;

function tail(text: string): string | undefined {
  if (!text) return undefined;
  return text.length > MAX_RECORDED_OUTPUT ? '…' + text.slice(-MAX_RECORDED_OUTPUT) : text;
}

/** Resolve which ecosystem governs `dir` (or honour the override). */
export function resolveEcosystem(
  dir: string,
  override?: Ecosystem
): { ecosystem: Ecosystem; reason: string } {
  if (override) {
    if (!ECOSYSTEMS.includes(override)) {
      throw new PkgError('PKG_INVALID_ARGS', `Unknown ecosystem "${override}". Expected one of: ${ECOSYSTEMS.join(', ')}`);
    }
    return { ecosystem: override, reason: 'explicit --ecosystem' };
  }
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new PkgError('PKG_INVALID_ARGS', `Target directory does not exist: ${dir}`);
  }
  const candidates = detectEcosystems(dir);
  if (candidates.length === 0) {
    throw new PkgError(
      'PKG_ECOSYSTEM_UNDETECTED',
      `No supported package manifest found in ${dir} (looked for package.json, pyproject.toml, requirements.txt, Cargo.toml, pom.xml, build.gradle, *.csproj, composer.json, Gemfile, go.mod)`
    );
  }
  if (candidates.length > 1) {
    throw new PkgError(
      'PKG_ECOSYSTEM_AMBIGUOUS',
      `Multiple ecosystems detected in ${dir}: ${candidates.map(c => `${c.ecosystem} (${c.reason})`).join('; ')}. Re-run with --ecosystem <id>.`,
      { candidates: candidates.map(c => ({ ecosystem: c.ecosystem, reason: c.reason })) }
    );
  }
  return { ecosystem: candidates[0].ecosystem, reason: candidates[0].reason };
}

function record(cmd: PlannedCommand, res: ExecResult | null): PkgCommandRecord {
  return {
    argv: cmd.argv,
    cwd: cmd.cwd,
    purpose: cmd.purpose,
    executed: res !== null,
    exitCode: res ? res.exitCode : null,
    durationMs: res ? res.durationMs : null,
    ...(res && tail(res.stdout) ? { stdout: tail(res.stdout) } : {}),
    ...(res && tail(res.stderr) ? { stderr: tail(res.stderr) } : {}),
  };
}

/** Fill `kind` from the manifest and drop transitive noise for pip/uv. */
function enrichOutdated(
  rows: PkgOutdated[],
  declared: PkgDependency[],
  ecosystem: Ecosystem
): PkgOutdated[] {
  const norm = (n: string): string => (ecosystem === 'pip' || ecosystem === 'uv' ? n.toLowerCase().replace(/[-_.]+/g, '-') : n);
  const byName = new Map(declared.map(d => [norm(d.name), d]));
  let result = rows;
  if ((ecosystem === 'pip' || ecosystem === 'uv') && byName.size > 0) {
    result = result.filter(r => byName.has(norm(r.name)));
  }
  return result.map(r => {
    const d = byName.get(norm(r.name));
    const requestedKind = d?.kind ?? null;
    return { ...r, kind: r.kind ?? requestedKind };
  });
}

/**
 * Run one pkg operation.
 *
 * @throws {PkgError} with a machine-readable code for every expected failure.
 */
export async function runPkgOperation(input: PkgRunInput): Promise<PkgRunResult> {
  const packages = input.packages ?? [];
  const dev = Boolean(input.dev);
  const dryRun = Boolean(input.dryRun);
  const executor = input.executor ?? defaultExecutor;
  const env = input.env ?? process.env;

  const { ecosystem, reason } = resolveEcosystem(input.dir, input.ecosystem);
  const plan = planOperation({ ecosystem, operation: input.operation, packages, dev, dir: input.dir });

  const result: PkgRunResult = {
    operation: input.operation,
    ecosystem,
    detectedBy: reason,
    dir: input.dir,
    service: input.service ?? null,
    dryRun,
    packages,
    dev,
    commands: [],
    manifestEdits: [],
    dependencies: [],
    outdated: [],
    warnings: [],
  };

  if (ecosystem === 'pip' && plan.commands.length > 0) {
    const py = plan.commands[0].argv[0];
    if ((py === 'python3' || py === 'python') && !env.VIRTUAL_ENV) {
      result.warnings.push(
        'No .venv/venv found in the target and no VIRTUAL_ENV set: pip will operate on the global interpreter. Create one with `python3 -m venv .venv` first.'
      );
    }
  }

  // list: manifests only
  if (input.operation === 'list') {
    try {
      result.dependencies = listDependencies(input.dir, ecosystem);
    } catch (err) {
      throw new PkgError('PKG_ERROR', (err as Error).message);
    }
    return result;
  }

  if (dryRun) {
    result.commands = plan.commands.map(c => record(c, null));
    result.manifestEdits = plan.edits.map(e => {
      let changed = false;
      try {
        const current = fs.existsSync(e.file) ? fs.readFileSync(e.file, 'utf8') : '';
        changed = computeEdit(e, current, dev).changed;
      } catch (err) {
        if (err instanceof PkgError) throw err;
        throw new PkgError('PKG_ERROR', `Cannot plan edit of ${e.file}: ${(err as Error).message}`);
      }
      return { file: e.file, action: e.action, entries: e.entries, applied: false, changed };
    });
    return result;
  }

  // Toolchain check before touching anything.
  const tools = new Set(plan.commands.map(c => c.argv[0]));
  for (const tool of tools) {
    if (!findExecutable(tool, env)) {
      const hint = TOOL_HINTS[tool.replace(/^.*[\\/]/, '')] ?? `Install ${tool} and make sure it is on PATH`;
      throw new PkgError(
        'PKG_TOOLCHAIN_MISSING',
        `Required toolchain "${tool}" for ${ecosystem} was not found on PATH. ${hint}`,
        { tool, ecosystem, hint }
      );
    }
  }

  // Validate every manifest edit up front so a bad spec cannot fail after the
  // native command already mutated the environment.
  for (const e of plan.edits) {
    const current = fs.existsSync(e.file) ? fs.readFileSync(e.file, 'utf8') : '';
    try {
      computeEdit(e, current, dev);
    } catch (err) {
      if (err instanceof PkgError) throw err;
      throw new PkgError('PKG_ERROR', `Cannot edit ${e.file}: ${(err as Error).message}`);
    }
  }

  const applied: AppliedEdit[] = [];
  const rollback = (): void => {
    for (const a of applied.reverse()) rollbackEdit(a);
  };

  try {
    for (const edit of plan.edits.filter(e => e.phase === 'before')) {
      const a = applyEdit(edit, dev);
      applied.push(a);
      result.manifestEdits.push({ file: edit.file, action: edit.action, entries: edit.entries, applied: true, changed: a.changed });
    }

    let lastStdout = '';
    for (const command of plan.commands) {
      const res = await executor(command, { stream: Boolean(input.stream), env });
      result.commands.push(record(command, res));
      const exitOk = res.exitCode !== null && (command.okExitCodes ?? [0]).includes(res.exitCode);
      const patternFailed = exitOk && command.failPattern !== undefined && new RegExp(command.failPattern).test(res.stdout);
      const ok = exitOk && !patternFailed;
      if (!ok) {
        const text = `${res.stderr}\n${res.stdout}`;
        if (res.exitCode === null) {
          throw new PkgError('PKG_TOOLCHAIN_MISSING', `Could not run ${command.argv[0]}: ${res.error ?? 'spawn failed'}`, {
            tool: command.argv[0],
            ecosystem,
          });
        }
        if (ecosystem === 'pip' && /No module named pip/.test(text)) {
          throw new PkgError('PKG_TOOLCHAIN_MISSING', `pip is not available for ${command.argv[0]} (No module named pip)`, {
            tool: 'pip',
            ecosystem,
            hint: `Run \`${command.argv[0]} -m ensurepip\` or install python3-pip`,
          });
        }
        if (ecosystem === 'cargo' && command.argv[1] === 'outdated' && /no such (command|subcommand)/i.test(text)) {
          throw new PkgError('PKG_TOOLCHAIN_MISSING', 'cargo-outdated is not installed', {
            tool: 'cargo-outdated',
            ecosystem,
            hint: 'Install it with `cargo install cargo-outdated --locked`',
          });
        }
        throw new PkgError(
          'PKG_COMMAND_FAILED',
          patternFailed
            ? `${command.argv.join(' ')} reported unresolved dependencies (output matched /${command.failPattern}/)`
            : `${command.argv.join(' ')} exited with code ${res.exitCode}`,
          {
            argv: command.argv,
            cwd: command.cwd,
            exitCode: res.exitCode,
            stderr: tail(res.stderr),
            stdout: tail(res.stdout),
          }
        );
      }
      lastStdout = res.stdout;
    }

    for (const edit of plan.edits.filter(e => e.phase === 'after')) {
      const a = applyEdit(edit, dev);
      applied.push(a);
      result.manifestEdits.push({ file: edit.file, action: edit.action, entries: edit.entries, applied: true, changed: a.changed });
    }

    if (input.operation === 'outdated') {
      let rows: PkgOutdated[];
      try {
        rows = parseOutdated(ecosystem, lastStdout);
      } catch (err) {
        throw new PkgError('PKG_ERROR', `Could not parse ${ecosystem} outdated output: ${(err as Error).message}`);
      }
      let declared: PkgDependency[] = [];
      try {
        declared = listDependencies(input.dir, ecosystem);
      } catch {
        /* manifest enrichment is best-effort */
      }
      result.outdated = enrichOutdated(rows, declared, ecosystem);
      // The raw tool output is redundant once normalized.
      result.commands = result.commands.map(c => ({ ...c, stdout: undefined }));
    }
    return result;
  } catch (err) {
    rollback();
    throw err;
  }
}
