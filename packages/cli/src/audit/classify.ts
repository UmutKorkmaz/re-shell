/**
 * Which CLI commands change state and therefore belong in the audit trail.
 *
 * Resolution order (first hit wins):
 *   1. `--help` / `--dry-run` never change state.
 *   2. EXPLICIT_RULES: a maintained, ordered table keyed by command-path
 *      pattern. Add a row here when a command's verb is misleading.
 *   3. Verb heuristics over the last path segment (and its hyphen tokens).
 *   4. DEFAULT for unknown commands: audited (fail closed). Operators can flip
 *      this with `audit.unknownCommands: ignore` in .re-shell/config.yaml.
 *
 * `tests/unit/audit-classify.test.ts` walks the real command catalog so stale
 * explicit rules (typos, renamed commands) fail the build.
 */

export type ChangeCategory =
  | 'create'
  | 'modify'
  | 'delete'
  | 'deploy'
  | 'dependency'
  | 'execute'
  | 'read'
  | 'unknown';

export interface Classification {
  /** True when the command should be written to the audit log. */
  mutating: boolean;
  category: ChangeCategory;
  /** How the decision was reached (useful in tests and `--explain` style output). */
  source: 'flag' | 'explicit' | 'verb' | 'default';
}

interface Rule {
  /** Command path pattern; `*` matches any single segment, trailing `**` any suffix. */
  match: string;
  mutating: boolean;
  category: ChangeCategory;
  /** For read-only rules: flags that make the invocation write something. */
  writeFlags?: string[];
}

/**
 * Maintained table. Keep patterns specific; broad verbs are handled by the
 * heuristics below. Entries are matched against the space-joined command path.
 */
export const EXPLICIT_RULES: readonly Rule[] = [
  // Scaffolding and project lifecycle
  { match: 'init', mutating: true, category: 'create' },
  { match: 'create', mutating: true, category: 'create' },
  { match: 'add', mutating: true, category: 'create' },
  { match: 'remove', mutating: true, category: 'delete' },
  { match: 'generate **', mutating: true, category: 'create' },
  { match: 'ai create', mutating: true, category: 'create' },
  { match: 'workspace init', mutating: true, category: 'create' },
  { match: 'workspace migrate', mutating: true, category: 'modify' },
  { match: 'workspace migrate-monorepo', mutating: true, category: 'modify' },
  { match: 'workspace policy check', mutating: false, category: 'read' },
  { match: 'migrate', mutating: true, category: 'modify' },
  { match: 'release', mutating: true, category: 'deploy' },
  { match: 'fix', mutating: true, category: 'modify' },
  { match: 'agents init', mutating: true, category: 'create' },
  { match: 'agents sync', mutating: true, category: 'modify' },
  { match: 'env init', mutating: true, category: 'create' },
  { match: 'env verify', mutating: false, category: 'read' },
  { match: 'catalog', mutating: false, category: 'read', writeFlags: ['--output', '--write'] },

  // Plugins (installs run third-party code, so they are always audited)
  { match: 'plugin install', mutating: true, category: 'dependency' },
  { match: 'plugin uninstall', mutating: true, category: 'dependency' },
  { match: 'plugin update', mutating: true, category: 'dependency' },
  { match: 'plugin install-marketplace', mutating: true, category: 'dependency' },
  { match: 'plugin enable', mutating: true, category: 'modify' },
  { match: 'plugin disable', mutating: true, category: 'modify' },
  { match: 'plugin create', mutating: true, category: 'create' },

  // Configuration
  { match: 'config set', mutating: true, category: 'modify' },
  { match: 'config profile list', mutating: false, category: 'read' },
  { match: 'config profile show', mutating: false, category: 'read' },
  { match: 'config profile insights', mutating: false, category: 'read' },
  { match: 'config profile analytics', mutating: false, category: 'read' },
  { match: 'config profile stats', mutating: false, category: 'read' },
  { match: 'config profile tree', mutating: false, category: 'read' },
  { match: 'config profile history', mutating: false, category: 'read' },
  { match: 'config profile diff', mutating: false, category: 'read' },
  { match: 'config profile sync-status', mutating: false, category: 'read' },
  { match: 'config profile validate-all', mutating: false, category: 'read' },
  { match: 'config profile status', mutating: false, category: 'read' },
  { match: 'config profile optimize', mutating: false, category: 'read', writeFlags: ['--apply', '--auto'] },
  // Everything else under `config profile` (activate, create, delete, import, ...) writes.
  { match: 'config profile **', mutating: true, category: 'modify' },

  // Deployments and runtime control
  { match: 'service run health', mutating: false, category: 'read' },
  { match: 'service run logs', mutating: false, category: 'read' },
  { match: 'service run inspect', mutating: false, category: 'read' },
  { match: 'service run exec', mutating: true, category: 'execute' },
  { match: 'service run **', mutating: true, category: 'deploy' },
  { match: 'service polyglot list', mutating: false, category: 'read' },
  { match: 'service polyglot **', mutating: true, category: 'deploy' },
  { match: 'service bridge **', mutating: true, category: 'create' },
  { match: 'k8s **', mutating: true, category: 'deploy' },
  { match: 'cloud **', mutating: true, category: 'deploy' },

  // Arbitrary task execution is the highest-risk "execute" path
  { match: 'run', mutating: true, category: 'execute' },
  { match: 'cache clean', mutating: true, category: 'delete' },

  // Security group: scaffolds that write files vs. verification that only reads
  { match: 'security audit verify', mutating: false, category: 'read' },
  { match: 'security compliance report', mutating: false, category: 'read', writeFlags: ['--output'] },
  { match: 'security rbac **', mutating: true, category: 'modify' },

  // Interactive / long-running front ends and pure queries
  { match: 'serve', mutating: false, category: 'read' },
  { match: 'dev', mutating: false, category: 'read' },
  { match: 'tui', mutating: false, category: 'read' },
  { match: 'ui', mutating: false, category: 'read' },
  { match: 'build', mutating: false, category: 'read' },
  { match: 'doctor', mutating: false, category: 'read', writeFlags: ['--yes'] },
  { match: 'analyze', mutating: false, category: 'read', writeFlags: ['--output'] },
  { match: 'completion', mutating: false, category: 'read' },
  { match: 'commands **', mutating: false, category: 'read' },
  { match: 'find', mutating: false, category: 'read' },
  { match: 'list', mutating: false, category: 'read' },
  { match: 'scorecard', mutating: false, category: 'read' },
  { match: 'boundaries', mutating: false, category: 'read' },
  { match: 'templates **', mutating: false, category: 'read' },
];

/** First hyphen token that classifies a command as state-changing. */
const MUTATING_VERBS: Record<string, ChangeCategory> = {
  create: 'create', init: 'create', generate: 'create', scaffold: 'create', new: 'create', clone: 'create',
  import: 'create', snapshot: 'create', backup: 'create', export: 'create', write: 'create', setup: 'create', record: 'create',
  add: 'modify', set: 'modify', unset: 'modify', update: 'modify', upgrade: 'modify', enable: 'modify', disable: 'modify',
  apply: 'modify', sync: 'modify', migrate: 'modify', fix: 'modify', optimize: 'modify', configure: 'modify',
  register: 'modify', unregister: 'modify', activate: 'modify', deactivate: 'modify', pin: 'modify', unpin: 'modify',
  merge: 'modify', resolve: 'modify', restore: 'modify', rollback: 'modify', recover: 'modify', reload: 'modify',
  annotate: 'modify', customize: 'modify', rename: 'modify', convert: 'modify', format: 'modify', encrypt: 'modify',
  compress: 'modify', serialize: 'modify', publish: 'deploy', deploy: 'deploy', release: 'deploy', scale: 'deploy',
  up: 'deploy', down: 'deploy', start: 'deploy', stop: 'deploy', restart: 'deploy',
  install: 'dependency', uninstall: 'dependency', delete: 'delete', remove: 'delete', clean: 'delete', cleanup: 'delete',
  clear: 'delete', reset: 'delete', prune: 'delete', purge: 'delete', execute: 'execute', exec: 'execute', run: 'execute',
};

/** Tokens that mark a command as a pure query. */
const READ_ONLY_VERBS = new Set([
  'list', 'show', 'get', 'status', 'info', 'check', 'verify', 'validate', 'inspect', 'describe', 'search', 'find',
  'analyze', 'analyse', 'report', 'health', 'graph', 'diff', 'compare', 'scan', 'lint', 'explain', 'docs', 'help',
  'history', 'logs', 'stats', 'tree', 'summary', 'topology', 'detect', 'discover', 'doctor', 'preview', 'plan',
  'visualize', 'layers', 'cycles', 'order', 'critical', 'drift', 'matrix', 'recommend', 'rules', 'chain', 'categories',
  'popular', 'featured', 'ports', 'watch', 'test', 'analytics', 'insights', 'active', 'themes', 'frameworks',
  'conflicts', 'hooks', 'schema', 'structure', 'quick', 'types', 'interactive', 'debug', 'tui', 'dry-run', 'build',
  'serve', 'dev', 'dashboard', 'monitor', 'metrics', 'trace', 'alerts', 'cost',
]);

export interface ClassifyInput {
  /** Command path segments, e.g. ['plugin', 'install']. */
  path: readonly string[];
  /** Raw (unredacted is fine; only flag names are inspected) args after the path. */
  args: readonly string[];
}

function patternMatches(pattern: string, segments: readonly string[]): boolean {
  const pat = pattern.split(' ');
  for (let i = 0; i < pat.length; i++) {
    if (pat[i] === '**') return true;
    if (i >= segments.length) return false;
    if (pat[i] !== '*' && pat[i] !== segments[i]) return false;
  }
  return pat.length === segments.length;
}

function hasFlag(args: readonly string[], flag: string): boolean {
  return args.some(a => a === flag || a.startsWith(`${flag}=`));
}

function hasAnyFlag(args: readonly string[], flags: readonly string[]): boolean {
  return flags.some(f => hasFlag(args, f));
}

/** Heuristic over the last segment's hyphen tokens. Returns undefined when nothing matches. */
function classifyByVerb(segments: readonly string[]): { mutating: boolean; category: ChangeCategory } | undefined {
  const last = segments[segments.length - 1];
  if (!last) return undefined;
  const tokens = last.split('-');
  if (READ_ONLY_VERBS.has(tokens[0]) || READ_ONLY_VERBS.has(last)) return { mutating: false, category: 'read' };
  for (const token of tokens) {
    const category = MUTATING_VERBS[token];
    if (category) return { mutating: true, category };
  }
  if (tokens.some(t => READ_ONLY_VERBS.has(t))) return { mutating: false, category: 'read' };
  return undefined;
}

/** Flags that turn an otherwise read-only verb into a write (verb heuristic path). */
const GENERIC_WRITE_FLAGS = ['--output', '--write', '--apply', '--fix'];

export function classifyCommand(input: ClassifyInput): Classification {
  const { path, args } = input;

  if (hasAnyFlag(args, ['--help', '-h'])) return { mutating: false, category: 'read', source: 'flag' };
  if (hasFlag(args, '--dry-run')) return { mutating: false, category: 'read', source: 'flag' };

  for (const rule of EXPLICIT_RULES) {
    if (!patternMatches(rule.match, path)) continue;
    if (!rule.mutating && rule.writeFlags && hasAnyFlag(args, rule.writeFlags)) {
      return { mutating: true, category: 'modify', source: 'explicit' };
    }
    return { mutating: rule.mutating, category: rule.category, source: 'explicit' };
  }

  const byVerb = classifyByVerb(path);
  if (byVerb) {
    if (!byVerb.mutating && hasAnyFlag(args, GENERIC_WRITE_FLAGS)) {
      return { mutating: true, category: 'modify', source: 'verb' };
    }
    return { ...byVerb, source: 'verb' };
  }

  return { mutating: true, category: 'unknown', source: 'default' };
}

/** Pattern validity helper used by the maintenance test. */
export function ruleMatchesAnyPath(rule: { match: string }, paths: readonly string[][]): boolean {
  return paths.some(p => patternMatches(rule.match, p));
}
