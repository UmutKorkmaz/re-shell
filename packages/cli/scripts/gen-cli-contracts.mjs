#!/usr/bin/env node
/**
 * Regenerates the machine-derived parts of docs/CLI-CONTRACTS.md.
 *
 *   node packages/cli/scripts/gen-cli-contracts.mjs            # rewrite the doc
 *   node packages/cli/scripts/gen-cli-contracts.mjs --check    # exit 1 if the doc is stale
 *   node packages/cli/scripts/gen-cli-contracts.mjs --stdout   # print the doc, write nothing
 *
 * What it does
 * ------------
 *  1. Builds a small fixture workspace in a temp directory (fixed file contents).
 *  2. Runs the BUILT CLI (packages/cli/dist/index.js) against it, for every
 *     documented `--json` command and for a handful of error paths.
 *  3. Validates each real envelope against the exact wire schema published by
 *     @re-shell/contracts, and fails (non-zero exit, nothing written) if the real
 *     output does not conform, has keys the contract does not declare, or breaks
 *     the single-line envelope rules. The doc therefore can never describe a
 *     shape the CLI does not print, and a CLI change that is not reflected in the
 *     contract cannot be documented.
 *  4. Rewrites the GENERATED regions of the doc:
 *       - the per-command `data` shapes, rendered from the wire schemas,
 *       - small real examples for the workspace-level commands (fixture output),
 *       - the error-code table: every code of `errorCodeSchema`, marked "emitted"
 *         (with the source files) or "reserved", found by scanning
 *         packages/cli/src with the TypeScript parser (comments are ignored).
 *
 * Determinism
 * -----------
 * No timestamps, no absolute paths (the fixture root is normalised), no values
 * that depend on the template registry or the machine; ordering follows the
 * schemas, the command table below, and sorted file paths. The "emitted" status
 * is read from the sources at generation time, so it follows the code, not this
 * script.
 *
 * Everything outside the `<!-- BEGIN GENERATED: ... -->` / `<!-- END GENERATED:
 * ... -->` markers is hand-written prose and is never touched.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const CLI_ROOT = path.resolve(HERE, '..');
export const REPO_ROOT = path.resolve(CLI_ROOT, '..', '..');
export const CLI_ENTRY = path.join(CLI_ROOT, 'dist', 'index.js');
export const CLI_SRC = path.join(CLI_ROOT, 'src');
export const DOC_PATH = path.join(REPO_ROOT, 'docs', 'CLI-CONTRACTS.md');
export const REGENERATE_COMMAND = 'node packages/cli/scripts/gen-cli-contracts.mjs';

/** How many CLI processes run at once (each boots the whole CLI, seconds apiece). */
const CONCURRENCY = 4;
/** Upper bound for one CLI run, so a wedged child can never hang the generator. */
const RUN_TIMEOUT_MS = 300_000;

// ---------------------------------------------------------------------------
// Command table
// ---------------------------------------------------------------------------

/**
 * The documented commands, in doc order.
 *
 *  - `schema`    export of @re-shell/contracts that describes `data` exactly
 *  - `where`     'fixture' (the generated workspace) | 'empty' (a directory that is
 *                not a workspace)
 *  - `errors`    error codes the command can emit (status is derived from source)
 *  - `example`   include the fixture run's real output in the doc
 *  - `domain`    the UI/domain model + adapter, for the schema map
 */
export const COMMANDS = [
  {
    id: 'workspace-summary',
    display: 'workspace summary',
    args: ['workspace', 'summary', '--json'],
    where: 'fixture',
    schema: 'workspaceSummaryWireSchema',
    errors: ['NOT_IN_MONOREPO', 'WORKSPACE_SUMMARY_ERROR'],
    example: true,
    domain: '`WorkspaceSummary` via `workspaceSummaryWireToModel`',
  },
  {
    id: 'workspace-graph',
    display: 'workspace graph',
    args: ['workspace', 'graph', '--json'],
    where: 'fixture',
    schema: 'workspaceGraphWireSchema',
    errors: ['NOT_IN_MONOREPO', 'GRAPH_GENERATION_ERROR'],
    example: true,
    domain: 'none (the dashboard validates the wire shape directly)',
  },
  {
    id: 'workspace-health',
    display: 'workspace health',
    args: ['workspace', 'health', '--json'],
    where: 'fixture',
    schema: 'workspaceHealthWireSchema',
    errors: ['WORKSPACE_NOT_FOUND', 'HEALTH_CHECK_ERROR'],
    example: true,
    domain: '`HealthSummary` via `healthWireToSummary`',
  },
  {
    id: 'workspace-list',
    display: 'workspace list',
    args: ['workspace', 'list', '--json'],
    where: 'fixture',
    schema: 'workspaceListWireSchema',
    errors: ['NOT_IN_MONOREPO', 'LIST_WORKSPACES_ERROR'],
    example: true,
    domain: 'none',
  },
  {
    id: 'templates-list',
    display: 'templates list',
    args: ['templates', 'list', '--json'],
    where: 'fixture',
    schema: 'templatesListWireSchema',
    errors: ['TEMPLATES_LIST_ERROR'],
    example: false,
    domain: '`TemplateSummary` via the dashboard adapter `feedToTemplateSummary`',
  },
  {
    id: 'templates-show',
    display: 'templates show <id>',
    args: ['templates', 'show', 'express', '--json'],
    where: 'fixture',
    schema: 'templateWireSchema',
    errors: ['TEMPLATE_NOT_FOUND'],
    example: false,
    domain: '`TemplateSummary` via the dashboard adapter `feedToTemplateSummary`',
  },
  {
    id: 'templates-matrix',
    display: 'templates matrix',
    args: ['templates', 'matrix', '--json'],
    where: 'fixture',
    schema: 'templatesMatrixWireSchema',
    errors: ['TEMPLATES_MATRIX_ERROR'],
    example: false,
    domain: 'none',
  },
  {
    id: 'commands-list',
    display: 'commands list',
    args: ['commands', 'list', '--json'],
    where: 'fixture',
    schema: 'commandCatalogWireSchema',
    errors: ['COMMANDS_LIST_ERROR'],
    example: false,
    domain: 'none (`CommandSpec` is the resolved, ready-to-spawn form, not the catalog)',
  },
  {
    id: 'doctor',
    display: 'doctor',
    args: ['doctor', '--json'],
    // Run in a directory that is not a workspace: still real `doctor --json`
    // output, but it does not shell out to `npm audit` / `npm outdated`, which
    // would make the run slow and network-dependent.
    where: 'empty',
    schema: 'doctorWireSchema',
    gateField: 'healthy',
    errors: ['DOCTOR_ERROR'],
    example: false,
    domain: 'none',
  },
  {
    id: 'analyze',
    display: 'analyze',
    // `--type bundle` is offline and quick. The default (`all`) also shells out to
    // `npm outdated` / `npm audit`, which makes a run slow and network-dependent;
    // those blocks are pinned by the contracts unit tests (real captured output).
    args: ['analyze', '--type', 'bundle', '--json'],
    where: 'fixture',
    schema: 'analyzeWireSchema',
    errors: ['NOT_IN_MONOREPO', 'ANALYZE_ERROR'],
    example: false,
    domain: 'none',
  },
  {
    id: 'list',
    display: 'list',
    args: ['list', '--json'],
    where: 'fixture',
    schema: 'microfrontendListWireSchema',
    errors: ['NOT_IN_RESHELL_PROJECT', 'APPS_DIR_NOT_FOUND', 'LIST_MICROFRONTENDS_ERROR'],
    example: true,
    domain: 'none',
  },
];

/**
 * Real error-path invocations. Each must produce a single-line `ok:false`
 * envelope with exactly this code and a non-zero exit; the doc shows the real
 * envelope. (`doctor` is deliberately absent: its failure behaviour is owned by
 * the command, and the error table already reports whether `DOCTOR_ERROR` is
 * emitted.)
 */
export const ERROR_RUNS = [
  { id: 'workspace-summary', args: ['workspace', 'summary', '--json'], where: 'empty', code: 'NOT_IN_MONOREPO' },
  { id: 'workspace-health', args: ['workspace', 'health', '--json'], where: 'empty', code: 'WORKSPACE_NOT_FOUND' },
  { id: 'templates-show', args: ['templates', 'show', '__nope__', '--json'], where: 'fixture', code: 'TEMPLATE_NOT_FOUND' },
  { id: 'list', args: ['list', '--json'], where: 'empty', code: 'NOT_IN_RESHELL_PROJECT' },
];

// ---------------------------------------------------------------------------
// Fixture workspace
// ---------------------------------------------------------------------------

const FIXTURE_NAME = 'demo-monorepo';

/** Fixed contents of the fixture monorepo (relative path -> JSON or text). */
const FIXTURE_FILES = {
  'package.json': {
    name: FIXTURE_NAME,
    version: '1.0.0',
    private: true,
    engines: { node: '>=18' },
  },
  'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n  - 'tools/*'\n",
  'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
  'apps/web/package.json': {
    name: '@demo/web',
    version: '1.2.0',
    dependencies: { '@demo/ui': 'workspace:*', react: '^18.2.0' },
    devDependencies: { typescript: '^5.0.0' },
  },
  'apps/admin/package.json': {
    name: '@demo/admin',
    version: '0.4.0',
    dependencies: { '@demo/ui': 'workspace:*', '@demo/utils': 'workspace:*' },
  },
  'packages/ui/package.json': {
    name: '@demo/ui',
    version: '1.0.0',
    dependencies: { '@demo/utils': 'workspace:*' },
  },
  'packages/utils/package.json': { name: '@demo/utils', version: '1.0.0' },
  'tools/lint/package.json': { name: '@demo/lint', version: '1.0.0' },
};

/**
 * Write the fixture monorepo under a fresh temp directory and return its root.
 * Deliberately has no README.md and no .git, so `workspace health` has real
 * warnings to show.
 */
export function buildFixtureWorkspace(parentDir) {
  const root = path.join(parentDir, FIXTURE_NAME);
  for (const [rel, content] of Object.entries(FIXTURE_FILES)) {
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`
    );
  }
  return root;
}

// ---------------------------------------------------------------------------
// Running the CLI
// ---------------------------------------------------------------------------

/**
 * Run the built CLI and capture stdout through an OS PIPE (the way every real
 * consumer reads it), with the whole payload buffered. Resolves with the exit
 * code and both streams; never rejects on a non-zero exit.
 */
export function runCli(args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    });
    const out = [];
    const err = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`re-shell ${args.join(' ')} timed out after ${RUN_TIMEOUT_MS}ms`));
    }, RUN_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    // 'close' (not 'exit'): every byte of both streams has been delivered.
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        status: code ?? 1,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      });
    });
  });
}

/** Run async jobs with at most `limit` in flight, preserving result order. */
async function mapLimited(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Parse stdout as exactly one JSON line (the single-line envelope rule). */
export function parseSingleLineEnvelope(stdout, label) {
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  if (lines.length !== 1) {
    throw new Error(`${label}: expected exactly one stdout line, got ${lines.length}`);
  }
  try {
    return JSON.parse(lines[0]);
  } catch (error) {
    throw new Error(`${label}: stdout is not valid JSON (${error.message})`);
  }
}

// ---------------------------------------------------------------------------
// zod schema introspection (zod 4: `schema._zod.def`)
// ---------------------------------------------------------------------------

const defOf = (schema) => schema._zod.def;

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keys present in `value` that `schema` does not declare, as de-duplicated,
 * sorted dotted paths (`[]` stands for any array index). The wire schemas are
 * loose (they preserve unknown keys at runtime), so this is how drift in the
 * ADDITIVE direction is caught: a field the CLI starts printing must be added to
 * the contract.
 */
export function findUndeclaredKeys(schema, value) {
  const found = new Set();

  const visit = (current, data, at) => {
    const def = defOf(current);
    switch (def.type) {
      case 'optional':
      case 'default':
      case 'readonly':
        visit(def.innerType, data, at);
        return;
      case 'nullable':
        if (data !== null) visit(def.innerType, data, at);
        return;
      case 'array':
        if (Array.isArray(data)) {
          for (const item of data) visit(def.element, item, `${at}[]`);
        }
        return;
      case 'record':
        if (isPlainObject(data)) {
          for (const item of Object.values(data)) visit(def.valueType, item, `${at}.*`);
        }
        return;
      case 'union': {
        const match = def.options.find((option) => option.safeParse(data).success);
        if (match) visit(match, data, at);
        return;
      }
      case 'object':
        if (!isPlainObject(data)) return;
        for (const [key, item] of Object.entries(data)) {
          const child = at ? `${at}.${key}` : key;
          if (Object.prototype.hasOwnProperty.call(def.shape, key)) {
            visit(def.shape[key], item, child);
          } else {
            found.add(child);
          }
        }
        return;
      default:
    }
  };

  visit(schema, value, '');
  return [...found].sort();
}

/**
 * Render a zod schema as a TypeScript-style type literal. Object keys keep the
 * schema's declaration order; optional keys are marked `?`.
 */
export function renderSchema(schema, indent = '') {
  const def = defOf(schema);
  switch (def.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'unknown':
    case 'any':
      return 'unknown';
    case 'never':
      return 'never';
    case 'literal':
      return def.values.map((value) => JSON.stringify(value)).join(' | ');
    case 'enum':
      return Object.values(def.entries)
        .map((value) => `'${value}'`)
        .join(' | ');
    case 'optional':
    case 'default':
    case 'readonly':
      return renderSchema(def.innerType, indent);
    case 'nullable': {
      const inner = renderSchema(def.innerType, indent);
      return `${inner} | null`;
    }
    case 'array': {
      const inner = renderSchema(def.element, indent);
      if (inner === 'never') return '[]'; // the only array that can be valid is the empty one
      return /[|{]/.test(inner) ? `Array<${inner}>` : `${inner}[]`;
    }
    case 'record':
      return `Record<${renderSchema(def.keyType, indent)}, ${renderSchema(def.valueType, indent)}>`;
    case 'union':
      return def.options.map((option) => renderSchema(option, indent)).join(' | ');
    case 'object': {
      const keys = Object.keys(def.shape);
      if (keys.length === 0) return '{}';
      const inner = `${indent}  `;
      const lines = keys.map((key) => {
        const member = def.shape[key];
        const optional = defOf(member).type === 'optional' || defOf(member).type === 'default';
        return `${inner}${key}${optional ? '?' : ''}: ${renderSchema(member, inner)};`;
      });
      return `{\n${lines.join('\n')}\n${indent}}`;
    }
    default:
      throw new Error(`gen-cli-contracts: cannot render zod type "${def.type}"`);
  }
}

// ---------------------------------------------------------------------------
// Error-code scan (TypeScript parser, so comments never count)
// ---------------------------------------------------------------------------

function listSourceFiles(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(full);
      }
    }
  };
  walk(dir);
  return files.sort();
}

/**
 * For every code, the sorted repo-relative source files whose code (not
 * comments) contains the code as a string literal. A code with at least one file
 * is "emitted"; a code with none is "reserved".
 */
export function scanErrorCodeUsage(codes, srcDir = CLI_SRC) {
  const ts = require('typescript');
  const wanted = new Set(codes);
  const pattern = new RegExp(`\\b(?:${[...wanted].join('|')})\\b`);
  const usage = new Map(codes.map((code) => [code, new Set()]));

  for (const file of listSourceFiles(srcDir)) {
    const text = fs.readFileSync(file, 'utf8');
    // Cheap prefilter: only parse files that mention some code at all.
    if (!pattern.test(text)) continue;

    const kind = file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, kind);
    const relative = path.relative(REPO_ROOT, file).split(path.sep).join('/');
    const visit = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (wanted.has(node.text)) usage.get(node.text).add(relative);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  return new Map([...usage].map(([code, files]) => [code, [...files].sort()]));
}

// ---------------------------------------------------------------------------
// JSON example formatting
// ---------------------------------------------------------------------------

/** Single-line rendering with spaces after `,` and `:` (so it reads like prose). */
function compactJson(value) {
  if (Array.isArray(value)) return `[${value.map(compactJson).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${compactJson(item)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(value);
}

/** Pretty-print, keeping short values on one line so examples stay readable. */
function formatJson(value, indent = '') {
  const flat = compactJson(value);
  if (flat.length + indent.length <= 100 || typeof value !== 'object' || value === null) {
    return flat;
  }
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    return `[\n${value.map((item) => `${inner}${formatJson(item, inner)}`).join(',\n')}\n${indent}]`;
  }
  const members = Object.entries(value).map(
    ([key, item]) => `${inner}${JSON.stringify(key)}: ${formatJson(item, inner)}`
  );
  return `{\n${members.join(',\n')}\n${indent}}`;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

function loadContracts() {
  // Resolved from packages/cli (a dependency of this package).
  return import('@re-shell/contracts');
}

/** Replace the fixture root (and its realpath) so no machine path leaks into the doc. */
function makeNormalizer(fixtureRoot) {
  const variants = new Set([fixtureRoot, fs.realpathSync(fixtureRoot)]);
  return (value) => {
    let text = JSON.stringify(value);
    for (const variant of variants) {
      text = text.split(JSON.stringify(variant).slice(1, -1)).join(`/path/to/${FIXTURE_NAME}`);
    }
    return JSON.parse(text);
  };
}

function codeBadge(code, usage) {
  return usage.get(code)?.length ? `\`${code}\`` : `\`${code}\` *(reserved)*`;
}

/**
 * Run the CLI, verify it against the contracts, and compute the generated doc
 * regions. Throws (with every problem listed) if the real output disagrees with
 * the contracts.
 *
 * @returns {Promise<Map<string, string>>} region id -> markdown body
 */
export async function generateRegions() {
  if (!fs.existsSync(CLI_ENTRY)) {
    throw new Error(
      `Built CLI not found at ${CLI_ENTRY}. Run \`pnpm --filter @re-shell/cli build\` first.`
    );
  }
  const contracts = await loadContracts();
  const { jsonResponseSchema, errorCodeSchema } = contracts;
  const allCodes = errorCodeSchema.options;
  const usage = scanErrorCodeUsage(allCodes);

  const problems = [];
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-contracts-')));
  try {
    const fixtureRoot = buildFixtureWorkspace(tmp);
    const emptyDir = path.join(tmp, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });
    const cwdOf = (where) => (where === 'fixture' ? fixtureRoot : emptyDir);
    const normalize = makeNormalizer(fixtureRoot);

    // Validate the table against the contracts before spending time on the CLI.
    for (const command of COMMANDS) {
      if (typeof contracts[command.schema]?.safeParse !== 'function') {
        problems.push(`${command.id}: @re-shell/contracts has no schema "${command.schema}"`);
      }
      for (const code of command.errors) {
        if (!allCodes.includes(code)) problems.push(`${command.id}: unknown error code ${code}`);
      }
    }
    for (const run of ERROR_RUNS) {
      if (!allCodes.includes(run.code)) problems.push(`${run.id}: unknown error code ${run.code}`);
    }
    if (problems.length > 0) throw new Error(problems.join('\n'));

    // 1. Real runs, a few at a time.
    const okRuns = COMMANDS;
    const [okResults, errorResults] = await Promise.all([
      mapLimited(okRuns, CONCURRENCY, (command) => runCli(command.args, cwdOf(command.where))),
      mapLimited(ERROR_RUNS, CONCURRENCY, (run) => runCli(run.args, cwdOf(run.where))),
    ]);

    // 2. Verify the OK runs against the wire schemas.
    const examples = new Map();
    okRuns.forEach((command, index) => {
      const label = `\`re-shell ${command.args.join(' ')}\``;
      const result = okResults[index];
      let envelope;
      try {
        envelope = parseSingleLineEnvelope(result.stdout, label);
      } catch (error) {
        problems.push(error.message);
        return;
      }

      const parsed = jsonResponseSchema(contracts[command.schema]).safeParse(envelope);
      if (!parsed.success) {
        problems.push(
          `${label}: real output does not conform to ${command.schema}: ${JSON.stringify(parsed.error.issues[0])}`
        );
        return;
      }
      if (envelope.ok === true) {
        const undeclared = findUndeclaredKeys(contracts[command.schema], envelope.data);
        if (undeclared.length > 0) {
          problems.push(
            `${label}: the CLI prints keys ${command.schema} does not declare: ${undeclared.join(', ')}`
          );
        }
        // Gate commands (doctor) report a failed verdict as ok:true + data.<gateField>
        // false + exit 1; any other ok:true run must exit 0, and a passing gate too.
        const gateFailed = command.gateField && envelope.data?.[command.gateField] === false;
        if (gateFailed ? result.status === 0 : result.status !== 0) {
          problems.push(`${label}: ok:true envelope (gate failed: ${Boolean(gateFailed)}) but exit code ${result.status}`);
        }
        if (command.example) examples.set(command.id, normalize(envelope));
      } else if (command.id !== 'doctor') {
        // doctor's failure behaviour is the command's own business (see ERROR_RUNS);
        // every other OK-path command must succeed on the fixture.
        problems.push(`${label}: expected ok:true on the fixture, got ${envelope.error.code}`);
      } else if (result.status === 0) {
        problems.push(`${label}: ok:false envelope but exit code 0`);
      }
    });

    // 3. Verify the error runs.
    const errorExamples = new Map();
    ERROR_RUNS.forEach((run, index) => {
      const label = `\`re-shell ${run.args.join(' ')}\` (${run.where})`;
      const result = errorResults[index];
      let envelope;
      try {
        envelope = parseSingleLineEnvelope(result.stdout, label);
      } catch (error) {
        problems.push(error.message);
        return;
      }
      if (envelope.ok !== false || envelope.error?.code !== run.code) {
        problems.push(`${label}: expected ok:false ${run.code}, got ${JSON.stringify(envelope).slice(0, 200)}`);
        return;
      }
      if (
        !contracts.jsonErrorBodySchema.safeParse(envelope.error).success ||
        !Array.isArray(envelope.warnings)
      ) {
        problems.push(`${label}: error envelope does not satisfy the contract`);
      }
      if (result.status === 0) problems.push(`${label}: error envelope but exit code 0`);
      errorExamples.set(run.id, normalize(envelope));
    });

    if (problems.length > 0) {
      throw new Error(`The real CLI output disagrees with @re-shell/contracts:\n  - ${problems.join('\n  - ')}`);
    }

    // 4. Render.
    const regions = new Map();

    regions.set(
      'schema-map',
      [
        '| Command | Wire schema (`@re-shell/contracts`) | Domain / UI model |',
        '| --- | --- | --- |',
        ...COMMANDS.map(
          (command) =>
            `| \`re-shell ${command.display}\` | \`${command.schema}\` | ${command.domain} |`
        ),
      ].join('\n')
    );

    regions.set(
      'error-codes',
      [
        `The vocabulary is \`errorCodeSchema\` in \`@re-shell/contracts\` (${allCodes.length} codes). A code is **emitted** when it appears as a string literal in the code of \`packages/cli/src\`, and **reserved** when it is defined but nothing emits it yet.`,
        '',
        '| Code | Status | Emitted from |',
        '| --- | --- | --- |',
        ...allCodes.map((code) => {
          const files = usage.get(code);
          return files.length
            ? `| \`${code}\` | emitted | ${files.map((file) => `\`${file}\``).join(', ')} |`
            : `| \`${code}\` | reserved | |`;
        }),
      ].join('\n')
    );

    for (const command of COMMANDS) {
      const lines = [];
      lines.push(`- **Invocation:** \`re-shell ${command.args.join(' ')}\``);
      lines.push(
        `- **Wire schema:** \`${command.schema}\` (\`@re-shell/contracts\`); domain / UI model: ${command.domain}`
      );
      lines.push(`- **Error codes:** ${command.errors.map((code) => codeBadge(code, usage)).join(', ')}`);
      lines.push('');
      lines.push('`data` shape:');
      lines.push('');
      lines.push('```ts');
      lines.push(renderSchema(contracts[command.schema]));
      lines.push('```');

      if (examples.has(command.id)) {
        lines.push('');
        lines.push(
          `Real output for the generator's fixture workspace (\`${FIXTURE_NAME}\`; one line on the wire, pretty-printed here):`
        );
        lines.push('');
        lines.push('```json');
        lines.push(formatJson(examples.get(command.id)));
        lines.push('```');
      }

      const errorRuns = ERROR_RUNS.filter((run) => run.id === command.id);
      for (const run of errorRuns) {
        lines.push('');
        lines.push(
          `Error path, real output of \`re-shell ${run.args.join(' ')}\` ${run.where === 'empty' ? 'outside any workspace' : 'with an unknown id'} (exit code 1):`
        );
        lines.push('');
        lines.push('```json');
        lines.push(formatJson(errorExamples.get(run.id)));
        lines.push('```');
      }

      regions.set(`command:${command.id}`, lines.join('\n'));
    }

    return regions;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Doc region plumbing
// ---------------------------------------------------------------------------

const BEGIN = (id) => `<!-- BEGIN GENERATED: ${id} -->`;
const END = (id) => `<!-- END GENERATED: ${id} -->`;

/** Replace each generated region's body in `doc`; throws on a missing or unknown region. */
export function applyRegions(doc, regions) {
  let result = doc;
  for (const [id, body] of regions) {
    const begin = result.indexOf(BEGIN(id));
    const end = result.indexOf(END(id));
    if (begin < 0 || end < 0 || end < begin) {
      throw new Error(
        `docs/CLI-CONTRACTS.md has no generated region "${id}". Add\n  ${BEGIN(id)}\n  ${END(id)}\nwhere it belongs, then regenerate.`
      );
    }
    result = `${result.slice(0, begin + BEGIN(id).length)}\n${body.trimEnd()}\n${result.slice(end)}`;
  }
  const known = new Set(regions.keys());
  for (const match of result.matchAll(/^<!-- BEGIN GENERATED: (.+?) -->$/gm)) {
    if (!known.has(match[1])) {
      throw new Error(`docs/CLI-CONTRACTS.md has a generated region "${match[1]}" that the generator does not produce.`);
    }
  }
  return result;
}

/** The doc as the generator would write it. */
export async function generateDoc(currentDoc = fs.readFileSync(DOC_PATH, 'utf8')) {
  return applyRegions(currentDoc, await generateRegions());
}

/** First differing lines between two texts, for an actionable drift message. */
export function describeDifference(committed, generated) {
  const a = committed.split('\n');
  const b = generated.split('\n');
  const out = [];
  let shown = 0;
  for (let i = 0; i < Math.max(a.length, b.length) && shown < 12; i++) {
    if (a[i] !== b[i]) {
      out.push(`  line ${i + 1}:`);
      out.push(`    committed: ${a[i] ?? '(end of file)'}`);
      out.push(`    generated: ${b[i] ?? '(end of file)'}`);
      shown++;
    }
  }
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

async function main(argv) {
  const check = argv.includes('--check');
  const toStdout = argv.includes('--stdout');
  const committed = fs.readFileSync(DOC_PATH, 'utf8');
  const generated = await generateDoc(committed);

  if (toStdout) {
    process.stdout.write(generated);
    return 0;
  }
  if (check) {
    if (generated === committed) {
      console.log('docs/CLI-CONTRACTS.md is up to date.');
      return 0;
    }
    console.error(
      `docs/CLI-CONTRACTS.md is out of date with the CLI and @re-shell/contracts.\nRegenerate it with:\n  ${REGENERATE_COMMAND}\nFirst differences:\n${describeDifference(committed, generated)}`
    );
    return 1;
  }
  if (generated === committed) {
    console.log('docs/CLI-CONTRACTS.md is already up to date.');
  } else {
    fs.writeFileSync(DOC_PATH, generated);
    console.log('Wrote docs/CLI-CONTRACTS.md.');
  }
  return 0;
}

const isMain = (() => {
  try {
    return (
      process.argv[1] !== undefined &&
      fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
})();

if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  );
}

