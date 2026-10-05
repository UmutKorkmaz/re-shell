import * as fs from 'fs-extra';
import * as path from 'path';
import { builtinModules } from 'module';
import * as semver from 'semver';
import { z } from 'zod';
import type {
  PluginFinding,
  PluginFindingCategory,
  PluginValidateResponse,
} from '@re-shell/contracts';
import { isRecognizedPlugin, isFirstPartyPackage, isValidPackageName } from './plugin-installer';
import { HookType } from './plugin-hooks';
import { RegistryClient, type FetchLike } from './registry-client';

/**
 * Static plugin validator behind `re-shell plugin validate <path>`.
 *
 * Nothing in the plugin is executed. The validator checks, in order:
 *  - the manifest against a zod schema (and that it is a recognized plugin),
 *  - that the entry file resolves inside the plugin directory,
 *  - `engines.reshell-cli` / `engines.node` against the running CLI / Node,
 *  - that every declared dependency can be resolved (on disk, or with
 *    `checkRegistry` against the npm registry) and satisfies its range,
 *  - a static security scan of the plugin's source (child_process, eval,
 *    `new Function`, dynamic require of user-controlled input, network calls,
 *    filesystem writes outside the plugin directory),
 *  - the package size.
 *
 * `error` findings make the plugin invalid; `warning` findings do not (unless
 * `strict`); `info` findings are advisory. The scan is a best-effort lexical
 * analysis, not a sandbox: it reports what the source visibly does, and a
 * clean report is not a proof of safety.
 */

/** Raised when the path cannot be validated at all (missing path, not a directory). */
export class PluginValidationInputError extends Error {
  readonly details: Record<string, unknown>;
  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'PluginValidationInputError';
    this.details = details;
  }
}

/** Options for {@link validatePluginPath}. */
export interface PluginValidateOptions {
  /** CLI version to check `engines.reshell-cli` against (default: this CLI's version). */
  cliVersion?: string;
  /** Node version to check `engines.node` against (default: the running Node). */
  nodeVersion?: string;
  /** Treat warnings as failures. */
  strict?: boolean;
  /** Resolve dependencies that are not installed locally against the npm registry. */
  checkRegistry?: boolean;
  /** npm registry URL for `checkRegistry`. */
  registryUrl?: string;
  /** Injected fetch for `checkRegistry` (tests). */
  fetchImpl?: FetchLike;
  /** Total size above which a warning is raised (default 5 MiB). */
  warnSizeBytes?: number;
  /** Total size above which the plugin is invalid (default 50 MiB). */
  maxSizeBytes?: number;
  /** Largest source file scanned, in bytes (default 2 MiB). */
  maxScanFileBytes?: number;
}

const DEFAULT_WARN_SIZE = 5 * 1024 * 1024;
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;
const DEFAULT_MAX_SCAN_FILE = 2 * 1024 * 1024;
const MAX_FILES_WALKED = 20000;
const MAX_FINDINGS_PER_RULE_FILE = 5;

const SOURCE_EXT = new Set(['.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx', '.mts', '.cts']);
const SKIP_DIRS = new Set(['node_modules', '.git']);

/**
 * Version of the running Re-Shell CLI, read from its own package.json.
 *
 * @returns The semver string, or `'unknown'` when it cannot be read.
 */
export function getCliVersion(): string {
  try {
    const pkg = fs.readJSONSync(path.resolve(__dirname, '..', '..', 'package.json')) as {
      name?: string;
      version?: string;
    };
    if (typeof pkg.version === 'string' && semver.valid(pkg.version)) return pkg.version;
  } catch {
    // fall through
  }
  return 'unknown';
}

// --- Manifest schema -------------------------------------------------------

const permissionSchema = z.object({
  type: z.enum(['filesystem', 'network', 'process', 'environment', 'workspace']),
  access: z.enum(['read', 'write', 'execute', 'full']),
  resource: z.string().optional(),
  description: z.string().optional(),
});

const stringRecord = z.record(z.string(), z.string());

/**
 * Zod schema for a Re-Shell plugin `package.json`. Mirrors what the registry's
 * manifest loader requires (name, version, description, main) and shapes the
 * optional `reshell` block.
 */
export const pluginManifestSchema = z.object({
  name: z.string().refine(isValidPackageName, { message: 'must be a valid npm package name' }),
  version: z
    .string()
    .refine((v) => semver.valid(v) !== null, { message: 'must be a valid semver version' }),
  description: z.string().trim().min(1, { message: 'must be a non-empty string' }),
  main: z.string().min(1, { message: 'must be a non-empty string' }),
  keywords: z.array(z.string()).optional(),
  license: z.string().optional(),
  author: z.union([z.string(), z.object({ name: z.string() })]).optional(),
  homepage: z.string().optional(),
  engines: stringRecord.optional(),
  dependencies: stringRecord.optional(),
  peerDependencies: stringRecord.optional(),
  optionalDependencies: stringRecord.optional(),
  peerDependenciesMeta: z.record(z.string(), z.object({ optional: z.boolean().optional() })).optional(),
  bin: z.union([z.string(), stringRecord]).optional(),
  reshell: z
    .object({
      compatibility: z.string().optional(),
      hooks: z.array(z.string()).optional(),
      commands: z.array(z.string()).optional(),
      permissions: z.array(permissionSchema).optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      plugins: stringRecord.optional(),
    })
    .optional(),
});

type PluginManifestInput = z.infer<typeof pluginManifestSchema>;

// --- Findings collector ----------------------------------------------------

class Findings {
  readonly list: PluginFinding[] = [];

  add(
    id: string,
    category: PluginFindingCategory,
    severity: PluginFinding['severity'],
    message: string,
    where?: { file?: string; line?: number }
  ): void {
    this.list.push({
      id,
      category,
      severity,
      message,
      ...(where?.file ? { file: where.file } : {}),
      ...(where?.line ? { line: where.line } : {}),
    });
  }
}

// --- File walk -------------------------------------------------------------

interface WalkedFile {
  rel: string;
  abs: string;
  size: number;
}

interface WalkResult {
  files: WalkedFile[];
  symlinks: Array<{ rel: string; abs: string }>;
  truncated: boolean;
}

async function walkPackage(root: string): Promise<WalkResult> {
  const files: WalkedFile[] = [];
  const symlinks: Array<{ rel: string; abs: string }> = [];
  let truncated = false;
  const queue: string[] = [root];

  while (queue.length > 0) {
    const dir = queue.pop() as string;
    let entries: fs.Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (entry.isSymbolicLink()) {
        symlinks.push({ rel, abs });
      } else if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) queue.push(abs);
      } else if (entry.isFile()) {
        if (files.length >= MAX_FILES_WALKED) {
          truncated = true;
          return { files, symlinks, truncated };
        }
        try {
          files.push({ rel, abs, size: (await fs.stat(abs)).size });
        } catch {
          // Vanished between readdir and stat.
        }
      }
    }
  }
  return { files, symlinks, truncated };
}

// --- Source scanning -------------------------------------------------------

/** Result of {@link lexSource}: the source in two views of identical length/offsets. */
export interface LexedSource {
  /** Comments blanked; string/template/regex literals intact (for reading arguments). */
  code: string;
  /** Comments AND the contents of string/template/regex literals blanked (for finding call sites). */
  bare: string;
}

/**
 * One lexical pass that blanks comments (keeping newlines so line numbers
 * survive) and, in a second view, the contents of string, template and regex
 * literals. Detection rules look for call sites in `bare` (so `"eval("` inside a
 * string or comment is never a finding) and read arguments from `code`.
 * Best-effort lexical analysis, not a parser.
 *
 * @param src - JavaScript/TypeScript source text.
 */
export function lexSource(src: string): LexedSource {
  const code: string[] = [];
  const bare: string[] = [];
  const n = src.length;
  let i = 0;
  let lastSignificant = '';

  const regexAllowedAfter = '(,=:[!&|?{};+-*%<>~^';
  const push = (shown: string, hidden: string): void => {
    code.push(shown);
    bare.push(hidden);
  };
  const blank = (ch: string): string => (ch === '\n' ? '\n' : ' ');

  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') {
        push(' ', ' ');
        i++;
      }
      continue;
    }
    if (c === '/' && next === '*') {
      push(' ', ' ');
      push(' ', ' ');
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        push(blank(src[i]), blank(src[i]));
        i++;
      }
      if (i < n) {
        push(' ', ' ');
        push(' ', ' ');
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      push(c, c);
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) {
          push(src[i], ' ');
          push(src[i + 1], blank(src[i + 1]));
          i += 2;
          continue;
        }
        if (quote !== '`' && src[i] === '\n') break; // unterminated string: resync at EOL
        push(src[i], blank(src[i]));
        i++;
      }
      if (i < n && src[i] === quote) {
        push(quote, quote);
        i++;
      }
      lastSignificant = quote;
      continue;
    }
    if (c === '/' && (lastSignificant === '' || regexAllowedAfter.includes(lastSignificant))) {
      // Regex literal: keep the delimiters visible, blank the body in `bare`.
      push(c, c);
      i++;
      let inClass = false;
      while (i < n && src[i] !== '\n') {
        const ch = src[i];
        i++;
        if (ch === '\\' && i < n) {
          push(ch, ' ');
          push(src[i], ' ');
          i++;
          continue;
        }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) {
          push(ch, ch);
          break;
        }
        push(ch, ' ');
      }
      lastSignificant = '/';
      continue;
    }
    push(c, c);
    if (!/\s/.test(c)) lastSignificant = c;
    i++;
  }
  return { code: code.join(''), bare: bare.join('') };
}

/**
 * Replace comments with spaces (keeping newlines so line numbers survive) while
 * leaving string/template/regex literals intact.
 *
 * @param src - JavaScript/TypeScript source text.
 */
export function stripComments(src: string): string {
  return lexSource(src).code;
}

function lineAt(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) line++;
  }
  return line;
}

/** Read the expression text of the first call argument starting at `from` (just after `(`). */
function firstArgument(code: string, from: number): string {
  let depth = 0;
  let quote: string | null = null;
  let i = from;
  const limit = Math.min(code.length, from + 400);
  for (; i < limit; i++) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break;
      depth--;
    } else if (ch === ',' && depth === 0) break;
  }
  return code.slice(from, i).trim();
}

const SENSITIVE_WRITE_RE =
  /^['"`]\s*(?:\/(?:etc|usr|bin|sbin|boot|lib|lib64|root|var|sys|proc|dev|opt)\b|~?\/?\.ssh\b|[A-Za-z]:[\\/](?:Windows|Program Files))|\.ssh[\\/]|authorized_keys|['"`/\\]\.(?:bashrc|zshrc|profile|bash_profile|npmrc|netrc)\b/i;
const OUTSIDE_WRITE_RE =
  /\.\.[\\/]|^['"`]\s*(?:\/|~|[A-Za-z]:[\\/])|os\s*\.\s*homedir\s*\(|\bhomedir\s*\(|process\s*\.\s*env\s*\.\s*(?:HOME|USERPROFILE)\b|os\s*\.\s*tmpdir\s*\(|\btmpdir\s*\(/;
const INSIDE_HINT_RE = /__dirname|__filename|import\s*\.\s*meta/;
const TAINT_RE =
  /process\s*\.\s*(?:argv|env|stdin)|\breq(?:uest)?\b|\bparams?\b|\bquery\b|\bbody\b|\binput\b|\bargs?\b|\bargv\b|\boptions?\b|\bopts\b|\banswers?\b|\bprompt/i;

const FS_SPECIFIC_WRITE =
  'writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|writeJson|writeJSON|writeJsonSync|writeJSONSync|outputFile|outputFileSync|outputJson|outputJSON|outputJsonSync|outputJSONSync|rmSync|unlinkSync|rmdirSync|truncateSync';
const FS_GENERIC_WRITE =
  'mkdir|mkdirSync|ensureDir|ensureDirSync|ensureFile|ensureFileSync|copy|copySync|copyFile|copyFileSync|cp|cpSync|rename|renameSync|rm|rmdir|unlink|remove|removeSync|move|moveSync|symlink|symlinkSync|truncate|chmod|chmodSync|chown|chownSync';

interface ScanContext {
  rel: string;
  code: string;
  bare: string;
  declared: { process: boolean; network: boolean; fsWrite: boolean };
  findings: Findings;
  counts: Map<string, number>;
}

function report(
  ctx: ScanContext,
  id: string,
  severity: PluginFinding['severity'],
  message: string,
  index: number
): void {
  const key = `${id}:${ctx.rel}`;
  const seen = (ctx.counts.get(key) ?? 0) + 1;
  ctx.counts.set(key, seen);
  if (seen > MAX_FINDINGS_PER_RULE_FILE) return;
  ctx.findings.add(id, 'security', severity, message, {
    file: ctx.rel,
    line: lineAt(ctx.code, index),
  });
}

function scanSource(ctx: ScanContext): void {
  const { code, bare } = ctx;
  let m: RegExpExecArray | null;
  /** True when the match starts in real code (not inside a string/regex/comment). */
  const inCode = (match: RegExpExecArray): boolean => bare[match.index] === code[match.index];

  // eval and friends --------------------------------------------------------
  const evalRe = /(?<![\w$.])eval\s*\(|(?<![\w$])(?:globalThis|global|window|self)\s*\.\s*eval\s*\(/g;
  while ((m = evalRe.exec(bare))) {
    report(ctx, 'security-eval', 'error', 'eval() executes arbitrary strings as code', m.index);
  }
  const vmRe = /\b(?:runInThisContext|runInNewContext|runInContext)\s*\(|new\s+(?:vm\s*\.\s*)?Script\s*\(/g;
  while ((m = vmRe.exec(bare))) {
    report(ctx, 'security-eval', 'error', 'vm module code execution compiles arbitrary strings', m.index);
  }
  const timerStringRe = /(?<![\w$.])set(?:Timeout|Interval)\s*\(\s*['"`]/g;
  while ((m = timerStringRe.exec(bare))) {
    report(ctx, 'security-eval', 'error', 'string argument to a timer is evaluated as code', m.index);
  }

  const fnRe = /(?<![\w$.])(?:new\s+)?Function\s*\(/g;
  while ((m = fnRe.exec(bare))) {
    // `function Function(` / `.Function(` style declarations are not constructor calls.
    const before = bare.slice(Math.max(0, m.index - 10), m.index);
    if (/function\s+$/.test(before)) continue;
    report(ctx, 'security-new-function', 'error', 'Function constructor compiles arbitrary strings as code', m.index);
  }
  const ctorRe = /\.\s*constructor\s*\(\s*['"`]/g;
  while ((m = ctorRe.exec(bare))) {
    report(ctx, 'security-new-function', 'error', 'constructor("...") compiles a string as code', m.index);
  }

  // dynamic require / import -------------------------------------------------
  const dynRe = /(?<![\w$.])(?:module\s*\.\s*)?require\s*\(|(?<![\w$.])import\s*\(/g;
  while ((m = dynRe.exec(bare))) {
    const arg = firstArgument(code, m.index + m[0].length);
    if (arg === '') continue;
    const isStringLiteral =
      /^(['"])(?:(?!\1)[^\\\n]|\\.)*\1$/.test(arg) || /^`[^`$]*`$/.test(arg);
    if (isStringLiteral) continue;
    if (TAINT_RE.test(arg)) {
      report(
        ctx,
        'security-dynamic-require-input',
        'error',
        `module loaded from a value derived from user-controlled input: ${truncate(arg)}`,
        m.index
      );
    } else {
      report(
        ctx,
        'security-dynamic-require',
        'warning',
        `module loaded from a non-literal expression: ${truncate(arg)}`,
        m.index
      );
    }
  }

  // child_process ---------------------------------------------------------------
  const cpRe =
    /(?:require\s*\(\s*|from\s+|import\s*\(\s*|import\s+)['"](?:node:)?(?:child_process|cross-spawn|execa|shelljs)['"]/g;
  while ((m = cpRe.exec(code))) {
    if (!inCode(m)) continue;
    report(
      ctx,
      'security-child-process',
      ctx.declared.process ? 'info' : 'warning',
      ctx.declared.process
        ? 'spawns processes (declared via a "process" permission)'
        : 'spawns processes; declare a "process" permission in reshell.permissions',
      m.index
    );
  }

  // network -----------------------------------------------------------------------
  const netRe =
    /(?:require\s*\(\s*|from\s+|import\s*\(\s*|import\s+)['"](?:node:)?(?:https?|http2|net|tls|dgram|dns|axios|got|node-fetch|undici|request|superagent|ws|socket\.io-client)['"]|(?<![\w$.])fetch\s*\(|(?<![\w$])(?:globalThis|global|window)\s*\.\s*fetch\s*\(|\bXMLHttpRequest\b|new\s+WebSocket\s*\(/g;
  while ((m = netRe.exec(code))) {
    if (!inCode(m)) continue;
    report(
      ctx,
      'security-network',
      ctx.declared.network ? 'info' : 'warning',
      ctx.declared.network
        ? 'makes network calls (declared via a "network" permission)'
        : 'makes network calls; declare a "network" permission in reshell.permissions',
      m.index
    );
  }

  // filesystem writes outside the plugin dir ------------------------------------
  const writeRe = new RegExp(
    `(?<![\\w$])(?:(?:[\\w$]+\\s*\\.\\s*)*(${FS_SPECIFIC_WRITE})|(?:fs|fse|fsp|fsExtra|promises|fsPromises|[\\w$]*[fF]s)\\s*\\.\\s*(${FS_GENERIC_WRITE}))\\s*\\(`,
    'g'
  );
  const unknownWrites: number[] = [];
  while ((m = writeRe.exec(bare))) {
    const arg = firstArgument(code, m.index + m[0].length);
    if (arg === '') continue;
    if (SENSITIVE_WRITE_RE.test(arg)) {
      report(ctx, 'security-fs-write-sensitive', 'error', `writes to a sensitive location: ${truncate(arg)}`, m.index);
    } else if (OUTSIDE_WRITE_RE.test(arg) && !/^path\s*\.\s*(?:join|resolve)\s*\(\s*(?:__dirname|__filename)\s*,\s*['"`][^.]/.test(arg)) {
      report(
        ctx,
        'security-fs-write-outside',
        ctx.declared.fsWrite ? 'info' : 'warning',
        `writes outside the plugin directory: ${truncate(arg)}` +
          (ctx.declared.fsWrite ? ' (declared via a "filesystem" write permission)' : ''),
        m.index
      );
    } else if (!INSIDE_HINT_RE.test(arg)) {
      unknownWrites.push(m.index);
    }
  }
  if (unknownWrites.length > 0) {
    report(
      ctx,
      'security-fs-write',
      'info',
      `${unknownWrites.length} filesystem write call(s) with a target that cannot be determined statically`,
      unknownWrites[0]
    );
  }
}

function truncate(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > max ? `${flat.slice(0, max)}...` : flat;
}

// --- Entry resolution ------------------------------------------------------

async function isFile(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

/** Resolve `main` the way Node's CommonJS loader would (file, +ext, dir/index). */
async function resolveEntry(dir: string, main: string): Promise<string | null> {
  const base = path.resolve(dir, main);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.cjs`,
    `${base}.mjs`,
    `${base}.json`,
    path.join(base, 'index.js'),
  ];
  for (const candidate of candidates) {
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

// --- Dependency resolution -------------------------------------------------

async function readInstalledVersion(startDir: string, dep: string): Promise<string | null> {
  let dir = path.resolve(startDir);
  for (;;) {
    const manifest = path.join(dir, 'node_modules', dep, 'package.json');
    try {
      // fs.readJSON follows symlinks, so pnpm-style node_modules resolve.
      const data = (await fs.readJSON(manifest)) as { version?: unknown };
      return typeof data.version === 'string' ? data.version : '0.0.0';
    } catch {
      // not here; keep climbing
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

type SpecKind = 'range' | 'special' | 'invalid';

function classifySpec(spec: string): SpecKind {
  if (spec.trim() === '') return 'invalid';
  if (/^(?:workspace:|file:|link:|git\+|git:|github:|https?:|npm:|portal:|patch:)/.test(spec)) {
    return 'special';
  }
  if (semver.validRange(spec) !== null) return 'range';
  // dist-tags such as "latest" / "next" resolve at install time.
  if (/^[A-Za-z][\w.-]*$/.test(spec)) return 'special';
  return 'invalid';
}

// --- Public API ------------------------------------------------------------

/**
 * Validate a plugin directory.
 *
 * @param pluginPath - Path to the plugin directory (or its package.json).
 * @param options - See {@link PluginValidateOptions}.
 * @returns The validation report; `valid` is false when any error finding exists
 *   (or any warning with `strict`).
 * @throws {PluginValidationInputError} If the path does not exist or is not a directory.
 */
export async function validatePluginPath(
  pluginPath: string,
  options: PluginValidateOptions = {}
): Promise<PluginValidateResponse> {
  let abs = path.resolve(pluginPath);
  const stat = await fs.stat(abs).catch(() => null);
  if (!stat) {
    throw new PluginValidationInputError(`Plugin path does not exist: ${abs}`, {
      reason: 'not-found',
      path: abs,
    });
  }
  if (stat.isFile()) {
    if (path.basename(abs) === 'package.json') abs = path.dirname(abs);
    else {
      throw new PluginValidationInputError(
        `Plugin path must be a directory (or its package.json): ${abs}`,
        { reason: 'not-a-directory', path: abs }
      );
    }
  }

  const cliVersion = options.cliVersion ?? getCliVersion();
  const nodeVersion = options.nodeVersion ?? process.version;
  const findings = new Findings();
  const evaluated = new Set<PluginFindingCategory>();

  // 1. Manifest -----------------------------------------------------------------
  evaluated.add('manifest');
  let raw: Record<string, unknown> | null = null;
  const manifestPath = path.join(abs, 'package.json');
  if (!(await fs.pathExists(manifestPath))) {
    findings.add('manifest-missing', 'manifest', 'error', `No package.json found in ${abs}`);
  } else {
    try {
      const parsed: unknown = await fs.readJSON(manifestPath);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        findings.add('manifest-invalid', 'manifest', 'error', 'package.json must contain a JSON object');
      } else {
        raw = parsed as Record<string, unknown>;
      }
    } catch (error) {
      findings.add(
        'manifest-unparsable',
        'manifest',
        'error',
        `package.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  let manifest: PluginManifestInput | null = null;
  if (raw) {
    const parsed = pluginManifestSchema.safeParse(raw);
    if (parsed.success) {
      manifest = parsed.data;
    } else {
      for (const issue of parsed.error.issues) {
        const where = issue.path.map(String).join('.') || '(root)';
        findings.add('manifest-invalid', 'manifest', 'error', `${where}: ${issue.message}`);
      }
    }

    if (isFirstPartyPackage(raw.name)) {
      findings.add(
        'manifest-first-party',
        'manifest',
        'error',
        `${String(raw.name)} is a first-party Re-Shell package, not a plugin`
      );
    } else if (!isRecognizedPlugin(raw as Parameters<typeof isRecognizedPlugin>[0])) {
      findings.add(
        'manifest-not-plugin',
        'manifest',
        'error',
        'Not recognized as a Re-Shell plugin: add the "reshell-plugin" keyword, a "reshell" manifest block, ' +
          'a "reshell-plugin-" name prefix or publish under the @re-shell/ scope'
      );
    }

    for (const hook of manifest?.reshell?.hooks ?? []) {
      if (!(Object.values(HookType) as string[]).includes(hook)) {
        findings.add('manifest-unknown-hook', 'manifest', 'warning', `reshell.hooks lists unknown hook "${hook}"`);
      }
    }
  }

  const declaredPermissions = manifest?.reshell?.permissions ?? [];
  const declared = {
    process: declaredPermissions.some((p) => p.type === 'process'),
    network: declaredPermissions.some((p) => p.type === 'network'),
    fsWrite: declaredPermissions.some(
      (p) => p.type === 'filesystem' && (p.access === 'write' || p.access === 'full')
    ),
  };

  // 2. Walk the package (size + sources) ---------------------------------------
  const walk = await walkPackage(abs);

  // 3. Entry -----------------------------------------------------------------------
  const mainField = typeof raw?.main === 'string' && raw.main.length > 0 ? raw.main : null;
  if (mainField !== null) {
    evaluated.add('entry');
    const resolvedMain = path.resolve(abs, mainField);
    const rel = path.relative(abs, resolvedMain);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      findings.add('entry-escapes', 'entry', 'error', `main "${mainField}" points outside the plugin directory`);
    } else {
      const entryFile = await resolveEntry(abs, mainField);
      if (!entryFile) {
        findings.add('entry-missing', 'entry', 'error', `Entry file "${mainField}" does not exist`);
      } else {
        const ext = path.extname(entryFile).toLowerCase();
        const entryRel = path.relative(abs, entryFile).split(path.sep).join('/');
        if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
          findings.add(
            'entry-typescript',
            'entry',
            'error',
            `Entry "${entryRel}" is TypeScript; the plugin loader requires compiled JavaScript`,
            { file: entryRel }
          );
        } else if (ext === '.mjs') {
          findings.add(
            'entry-esm',
            'entry',
            'warning',
            `Entry "${entryRel}" is an ES module; the plugin loader loads plugins with require()`,
            { file: entryRel }
          );
        } else if (ext === '.js' || ext === '.cjs') {
          try {
            const size = (await fs.stat(entryFile)).size;
            if (size <= (options.maxScanFileBytes ?? DEFAULT_MAX_SCAN_FILE)) {
              const text = await fs.readFile(entryFile, 'utf8');
              if (!/\bactivate\b/.test(stripComments(text))) {
                findings.add(
                  'entry-no-activate',
                  'entry',
                  'warning',
                  `Entry "${entryRel}" does not appear to export an activate() function`,
                  { file: entryRel }
                );
              }
            }
          } catch {
            // Unreadable entry is reported by the security scan / loader later.
          }
        }
      }
    }
  }

  // 4. Engines ---------------------------------------------------------------------
  evaluated.add('engines');
  const engines = manifest?.engines ?? asStringRecord(raw?.engines);
  const cliRange =
    engines['reshell-cli'] ??
    manifest?.reshell?.compatibility ??
    compatibilityOf(raw?.['reshell-plugin']) ??
    compatibilityOf(raw?.['reshell-cli']) ??
    null;
  const nodeRange = engines.node ?? null;
  let cliSatisfied: boolean | null = null;
  let nodeSatisfied: boolean | null = null;

  if (cliRange === null) {
    if (raw) {
      findings.add(
        'engines-reshell-cli-missing',
        'engines',
        'warning',
        'No engines.reshell-cli range declared; compatibility with this CLI cannot be verified'
      );
    }
  } else if (semver.validRange(cliRange) === null) {
    findings.add('engines-reshell-cli-invalid', 'engines', 'error', `engines.reshell-cli "${cliRange}" is not a valid semver range`);
  } else if (!semver.valid(cliVersion)) {
    findings.add(
      'engines-cli-version-unknown',
      'engines',
      'warning',
      `Cannot determine the running CLI version, so engines.reshell-cli "${cliRange}" was not checked`
    );
  } else {
    cliSatisfied = semver.satisfies(cliVersion, cliRange, { includePrerelease: true });
    if (!cliSatisfied) {
      findings.add(
        'engines-reshell-cli-unsatisfied',
        'engines',
        'error',
        `Plugin requires re-shell CLI ${cliRange} but this is ${cliVersion}`
      );
    }
  }

  if (nodeRange !== null) {
    if (semver.validRange(nodeRange) === null) {
      findings.add('engines-node-invalid', 'engines', 'error', `engines.node "${nodeRange}" is not a valid semver range`);
    } else {
      nodeSatisfied = semver.satisfies(nodeVersion, nodeRange, { includePrerelease: true });
      if (!nodeSatisfied) {
        findings.add(
          'engines-node-unsatisfied',
          'engines',
          'error',
          `Plugin requires Node ${nodeRange} but this is ${nodeVersion}`
        );
      }
    }
  }

  // 5. Dependencies -----------------------------------------------------------------
  evaluated.add('dependencies');
  if (raw) {
    const client = options.checkRegistry
      ? new RegistryClient({ registryUrl: options.registryUrl, fetchImpl: options.fetchImpl, timeoutMs: 15000 })
      : null;

    const groups: Array<{ field: string; deps: Record<string, string>; required: (dep: string) => boolean }> = [
      { field: 'dependencies', deps: manifest?.dependencies ?? asStringRecord(raw.dependencies), required: () => true },
      {
        field: 'peerDependencies',
        deps: manifest?.peerDependencies ?? asStringRecord(raw.peerDependencies),
        required: (dep) => manifest?.peerDependenciesMeta?.[dep]?.optional !== true,
      },
      {
        field: 'optionalDependencies',
        deps: manifest?.optionalDependencies ?? asStringRecord(raw.optionalDependencies),
        required: () => false,
      },
    ];

    for (const { field, deps, required } of groups) {
      for (const [dep, spec] of Object.entries(deps)) {
        const kind = classifySpec(spec);
        if (kind === 'invalid') {
          findings.add('deps-invalid-spec', 'dependencies', 'error', `${field}.${dep}: "${spec}" is not a valid version range`);
          continue;
        }
        if (builtinModules.includes(dep) || builtinModules.includes(dep.replace(/^node:/, ''))) continue;

        const installed = await readInstalledVersion(abs, dep);
        if (installed !== null) {
          if (kind === 'range' && semver.valid(installed) && !semver.satisfies(installed, spec, { includePrerelease: true })) {
            findings.add(
              'deps-version-mismatch',
              'dependencies',
              required(dep) ? 'error' : 'warning',
              `${field}.${dep}: installed ${installed} does not satisfy "${spec}"`
            );
          }
          continue;
        }

        // Not on disk.
        if (client) {
          const outcome = await resolveFromRegistry(client, dep, kind === 'range' ? spec : null);
          if (outcome === 'ok') {
            findings.add(
              'deps-not-installed',
              'dependencies',
              'warning',
              `${field}.${dep}@${spec} is not installed locally but is resolvable from the npm registry`
            );
            continue;
          }
          if (outcome === 'unreachable') {
            findings.add(
              'deps-registry-unreachable',
              'dependencies',
              'warning',
              `${field}.${dep}@${spec} is not installed locally and the registry could not be reached to resolve it`
            );
            continue;
          }
          findings.add(
            'deps-unresolvable',
            'dependencies',
            required(dep) ? 'error' : 'warning',
            `${field}.${dep}@${spec} cannot be resolved locally or on the npm registry`
          );
          continue;
        }
        findings.add(
          'deps-unresolvable',
          'dependencies',
          required(dep) ? 'error' : 'warning',
          `${field}.${dep}@${spec} is not installed (searched node_modules from ${abs} upwards)`
        );
      }
    }
  }

  // 6. Security scan --------------------------------------------------------------
  evaluated.add('security');
  const maxScan = options.maxScanFileBytes ?? DEFAULT_MAX_SCAN_FILE;
  const counts = new Map<string, number>();
  for (const link of walk.symlinks) {
    let target: string;
    try {
      target = path.resolve(path.dirname(link.abs), await fs.readlink(link.abs));
    } catch {
      continue;
    }
    const rel = path.relative(abs, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      findings.add('security-symlink-escape', 'security', 'error', `symlink points outside the plugin directory (${target})`, {
        file: link.rel,
      });
    }
  }
  for (const file of walk.files) {
    const ext = path.extname(file.rel).toLowerCase();
    if (!SOURCE_EXT.has(ext) || file.rel.endsWith('.d.ts')) continue;
    if (file.size > maxScan) {
      findings.add(
        'security-file-not-scanned',
        'security',
        'warning',
        `${file.rel} (${file.size} bytes) exceeds the ${maxScan}-byte scan limit and was not scanned`,
        { file: file.rel }
      );
      continue;
    }
    let text: string;
    try {
      text = await fs.readFile(file.abs, 'utf8');
    } catch {
      continue;
    }
    const lexed = lexSource(text);
    scanSource({ rel: file.rel, code: lexed.code, bare: lexed.bare, declared, findings, counts });
  }
  for (const [key, count] of counts) {
    if (count > MAX_FINDINGS_PER_RULE_FILE) {
      const [id, file] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
      findings.add(id, 'security', 'info', `${count - MAX_FINDINGS_PER_RULE_FILE} more "${id}" occurrence(s) in ${file} not listed`, { file });
    }
  }

  // 7. Size ------------------------------------------------------------------------
  evaluated.add('size');
  const totalBytes = walk.files.reduce((sum, f) => sum + f.size, 0);
  const warnSize = options.warnSizeBytes ?? DEFAULT_WARN_SIZE;
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_SIZE;
  if (totalBytes > maxSize) {
    findings.add('size-too-large', 'size', 'error', `Package is ${formatBytes(totalBytes)}, above the ${formatBytes(maxSize)} limit`);
  } else if (totalBytes > warnSize) {
    findings.add('size-large', 'size', 'warning', `Package is ${formatBytes(totalBytes)} (more than ${formatBytes(warnSize)})`);
  }
  if (walk.truncated) {
    findings.add(
      'size-too-many-files',
      'size',
      'warning',
      `More than ${MAX_FILES_WALKED} files; the scan stopped early and the size is a lower bound`
    );
  }

  // 8. Verdict ------------------------------------------------------------------
  const list = findings.list;
  const errors = list.filter((f) => f.severity === 'error').length;
  const warnings = list.filter((f) => f.severity === 'warning').length;
  const info = list.filter((f) => f.severity === 'info').length;
  const strict = options.strict === true;

  const checks: Record<string, 'pass' | 'warn' | 'fail' | 'skip'> = {};
  for (const category of ['manifest', 'entry', 'engines', 'dependencies', 'security', 'size'] as const) {
    const mine = list.filter((f) => f.category === category);
    if (!evaluated.has(category)) checks[category] = 'skip';
    else if (mine.some((f) => f.severity === 'error')) checks[category] = 'fail';
    else if (mine.some((f) => f.severity === 'warning')) checks[category] = 'warn';
    else checks[category] = 'pass';
  }
  if (mainField === null) checks.entry = 'skip';

  return {
    path: abs,
    name: typeof raw?.name === 'string' ? raw.name : null,
    version: typeof raw?.version === 'string' ? raw.version : null,
    valid: errors === 0 && (!strict || warnings === 0),
    strict,
    cliVersion,
    findings: list,
    counts: { errors, warnings, info },
    size: { bytes: totalBytes, files: walk.files.length },
    engines: {
      reshellCli: cliRange,
      node: nodeRange,
      reshellCliSatisfied: cliSatisfied,
      nodeSatisfied,
    },
    checks,
  };
}

/** `compatibility` string from a `reshell-plugin` / `reshell-cli` manifest block, if any. */
function compatibilityOf(block: unknown): string | null {
  if (!block || typeof block !== 'object') return null;
  const value = (block as { compatibility?: unknown }).compatibility;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

async function resolveFromRegistry(
  client: RegistryClient,
  name: string,
  range: string | null
): Promise<'ok' | 'missing' | 'unreachable'> {
  try {
    const packument = await client.getPackument(name);
    if (range === null) return 'ok';
    const versions = Object.keys(packument.versions);
    return semver.maxSatisfying(versions, range, { includePrerelease: true }) !== null ? 'ok' : 'missing';
  } catch (error) {
    const status = (error as { details?: { status?: number } })?.details?.status;
    return status === 404 ? 'missing' : 'unreachable';
  }
}
