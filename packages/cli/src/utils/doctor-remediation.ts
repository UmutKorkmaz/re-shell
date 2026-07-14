import type { Suggestion, FixPlan, FixPlanStep } from '@re-shell/contracts';

/**
 * Deterministic, offline remediation for `doctor` / `workspace health` checks.
 *
 * The doctor command emits structured checks, each carrying a stable `name`
 * (the check id) plus a status and a human message. This module maps each known
 * check id onto a plain-language *cause* and a concrete *suggestion*, and marks
 * whether the suggestion is auto-fixable. When fixable, a `fixCommand` carries
 * an allow-listed shell command that the `--fix` planner may compose into a
 * dry-run plan.
 *
 * Design constraints (all enforced here):
 *  - PURE + OFFLINE: no I/O, no network, no process spawning. Every function is
 *    a pure transform over its inputs, so it is trivially testable.
 *  - SAFE-BY-DEFAULT: the only commands that may ever be applied are the ones in
 *    {@link ALLOWED_FIX_COMMAND_PREFIXES}. Anything else is treated as a manual
 *    edit (planned, never executed).
 *  - DETERMINISTIC: the rule table is the single source of truth. An optional
 *    LLM phrasing hook may *rewrite the wording* of a cause/suggestion, but the
 *    `fixable`/`fixCommand` decision always comes from these rules.
 */

/**
 * A check as produced by the doctor / workspace-health surfaces. We accept a
 * loose shape so this util can consume either command's checks without coupling
 * to their internal interfaces.
 */
export interface RemediableCheck {
  /**
   * The stable check id used by the `doctor` command. Some surfaces may use
   * `id` instead, so both fields are accepted.
   */
  name?: string;
  /** Alternate key for the check id, used by some health surfaces. */
  id?: string;
  /**
   * Status string from the producing surface. Varies across surfaces
   * (doctor: success|warning|error; rich health: pass|warning|fail|info).
   * Normalized internally before any rule lookup.
   */
  status?: string;
  /** Alternate status-like key (`level`) used by some health surfaces. */
  level?: string;
  /** Human-readable detail message emitted by the original check. */
  message?: string;
}

/**
 * A single remediation rule. The `cause`/`suggestion` may be functions so a rule
 * can incorporate the check's own message (e.g. the vulnerability count) into
 * the explanation without losing determinism.
 */
interface RemediationRule {
  cause: string | ((message: string) => string);
  suggestion: string | ((message: string) => string);
  fixable: boolean;
  fixCommand?: string;
}

/**
 * Package-manager-aware placeholders. The map stores `{pm}` (the package manager
 * binary) and `{update}` (the manager's dependency-update verb, which differs:
 * yarn uses `upgrade`, the rest use `update`). Callers substitute the detected
 * manager; everything defaults to npm when none is supplied.
 */
const PM_PLACEHOLDER = '{pm}';
const UPDATE_VERB_PLACEHOLDER = '{update}';

const UPDATE_VERB_BY_PM: Record<string, string> = {
  npm: 'update',
  pnpm: 'update',
  bun: 'update',
  yarn: 'upgrade',
};

/**
 * The remediation table, keyed by check id. Every check id emitted by
 * `doctor.ts` and the lightweight `workspace health` surface is covered here.
 */
const REMEDIATION_RULES: Record<string, RemediationRule> = {
  // --- doctor: top-level / structural -------------------------------------
  'monorepo-detection': {
    cause: 'The current directory is not inside a Re-Shell monorepo workspace.',
    suggestion: 'Run "re-shell init" to create a monorepo, or cd into an existing one.',
    fixable: false,
  },
  'doctor-execution': {
    cause: 'The doctor run itself failed before all checks could complete.',
    suggestion: 'Re-run with --verbose to see the underlying error.',
    fixable: false,
  },
  'package-json': {
    cause: 'The root package.json is missing required fields or could not be read.',
    suggestion:
      'Add the missing fields (name, workspaces/private, engines) to the root package.json.',
    fixable: false,
  },

  // --- doctor: dependencies ------------------------------------------------
  'dependency-duplicates': {
    cause: 'Multiple workspaces depend on the same package at conflicting versions.',
    suggestion:
      'Align the versions across workspaces or hoist the shared dependency to the root.',
    fixable: false,
  },
  'outdated-dependencies': {
    cause: 'One or more dependencies have newer published versions available.',
    suggestion: `Review and update them with "${PM_PLACEHOLDER} ${UPDATE_VERB_PLACEHOLDER}".`,
    fixable: true,
    fixCommand: `${PM_PLACEHOLDER} ${UPDATE_VERB_PLACEHOLDER}`,
  },
  'dependencies-health': {
    cause: 'The dependency health scan could not complete.',
    suggestion: 'Ensure every workspace has a valid package.json and re-run.',
    fixable: false,
  },

  // --- doctor: security ----------------------------------------------------
  'security-audit': {
    cause: 'The package audit reported known security vulnerabilities in the dependency tree.',
    suggestion: `Run "${PM_PLACEHOLDER} audit fix" to apply available patches automatically.`,
    fixable: true,
    fixCommand: `${PM_PLACEHOLDER} audit fix`,
  },

  // --- doctor: workspace ---------------------------------------------------
  'workspace-config': {
    cause: 'One or more workspaces are missing or misconfigured (e.g. no package.json).',
    suggestion:
      'Create the missing package.json files or remove stale workspace entries; use "re-shell create" to scaffold.',
    fixable: false,
  },

  // --- doctor: git ---------------------------------------------------------
  'git-config': {
    cause: 'The git setup is incomplete (no repo, missing .gitignore, or uncommitted changes).',
    suggestion:
      'Initialize git with "git init", add a .gitignore, and commit pending work.',
    fixable: true,
    fixCommand: 'git init',
  },

  // --- doctor: build -------------------------------------------------------
  'build-config': {
    cause: 'No workspaces expose a build script, so nothing can be built.',
    suggestion: 'Add a "build" script to each buildable workspace package.json.',
    fixable: false,
  },
  'build-files': {
    cause: 'Workspaces have build scripts but no recognized bundler config file.',
    suggestion:
      'Add a bundler config (vite.config.ts, webpack.config.js, etc.) to the affected workspaces.',
    fixable: false,
  },

  // --- doctor: performance -------------------------------------------------
  'node-modules-size': {
    cause: 'The node_modules footprint could not be analyzed or is large.',
    suggestion: 'Switch to pnpm for a content-addressed store and a smaller footprint.',
    fixable: false,
  },
  'large-files': {
    cause: 'Large files were found in the tree that probably should not be committed.',
    suggestion: 'Move them to Git LFS or add them to .gitignore.',
    fixable: false,
  },
  'performance-check': {
    cause: 'The performance scan could not complete.',
    suggestion: 'Re-run with --verbose to see what failed.',
    fixable: false,
  },

  // --- doctor: filesystem --------------------------------------------------
  'disk-space': {
    cause: 'The workspace path could not be accessed (disk or permission issue).',
    suggestion: 'Check free disk space and directory permissions.',
    fixable: false,
  },
  'broken-symlinks': {
    cause: 'Dangling symbolic links were found that point at missing targets.',
    suggestion: 'Remove or repoint the broken symlinks.',
    fixable: false,
  },
  'filesystem-health': {
    cause: 'The filesystem scan could not complete.',
    suggestion: 'Check permissions on the workspace directory and re-run.',
    fixable: false,
  },

  // --- workspace health (commands/workspace.ts) display-style ids ----------
  // The lightweight `workspace health` surface names its checks with display
  // labels rather than slugs; covering them here lets both surfaces share this
  // util without a translation layer.
  Workspaces: {
    cause: 'No workspaces were discovered, or some are misconfigured.',
    suggestion: 'Add workspaces with "re-shell create", or fix the workspaces glob in package.json.',
    fixable: false,
  },
  'Config File': {
    cause: 'The re-shell.workspaces.yaml is missing, unreadable, or invalid.',
    suggestion: 'Run "re-shell workspace init" to (re)create a valid workspace definition.',
    fixable: false,
  },
  Services: {
    cause: 'One or more declared services are missing or misconfigured.',
    suggestion: 'Reconcile the services block in re-shell.workspaces.yaml with what exists on disk.',
    fixable: false,
  },
  Dependencies: {
    cause: 'Workspace dependencies are inconsistent, missing, or unresolved.',
    suggestion: `Reinstall with "${PM_PLACEHOLDER} install" and align versions across workspaces.`,
    fixable: true,
    fixCommand: `${PM_PLACEHOLDER} install`,
  },
  'File Structure': {
    cause: 'The expected workspace directory layout is incomplete.',
    suggestion: 'Create the missing directories/files the workspace definition references.',
    fixable: false,
  },
  Git: {
    cause: 'The git setup is incomplete (no repo or missing .gitignore).',
    suggestion: 'Initialize git with "git init" and add a .gitignore.',
    fixable: true,
    fixCommand: 'git init',
  },
  'Package Manager': {
    cause: 'No lockfile was found, so the package manager could not be determined reliably.',
    suggestion: `Install dependencies with "${PM_PLACEHOLDER} install" to generate a lockfile.`,
    fixable: true,
    fixCommand: `${PM_PLACEHOLDER} install`,
  },
};

/**
 * Generic fallback used when a check id has no dedicated rule. The check's own
 * message becomes the cause so the output is still useful for unknown ids.
 */
function fallbackRule(message: string): RemediationRule {
  return {
    cause: message || 'This check did not pass.',
    suggestion: 'Re-run "re-shell doctor --verbose" for the underlying detail.',
    fixable: false,
  };
}

/**
 * Allow-list of fix-command *prefixes*. A composed plan step is only ever
 * executable if its command starts with one of these. This is the single trust
 * boundary for `--fix --yes`: anything not matching is downgraded to a manual,
 * non-executable step.
 */
export const ALLOWED_FIX_COMMAND_PREFIXES: readonly string[] = [
  'npm audit fix',
  'pnpm audit fix',
  'yarn audit fix',
  'bun audit fix',
  'npm update',
  'pnpm update',
  'yarn upgrade',
  'bun update',
  'npm install',
  'pnpm install',
  'yarn install',
  'bun install',
  'git init',
];

/**
 * True when `command` is allow-listed for execution under `--fix --yes`.
 *
 * @param command - The candidate shell command (may be undefined). The check
 *   trims whitespace before comparing against the allow-list.
 * @returns `true` (narrowed to `string`) when the command matches one of the
 *   {@link ALLOWED_FIX_COMMAND_PREFIXES} entries exactly or as a prefix,
 *   otherwise `false`.
 */
export function isAllowedFixCommand(command: string | undefined): command is string {
  if (!command) return false;
  const trimmed = command.trim();
  return ALLOWED_FIX_COMMAND_PREFIXES.some(
    prefix => trimmed === prefix || trimmed.startsWith(prefix + ' ')
  );
}

function checkId(check: RemediableCheck): string {
  return check.id ?? check.name ?? 'unknown';
}

/**
 * Normalize the varied status vocabularies into a tri-state. Returns one of
 * `ok` | `warning` | `failing`. Both `status` and `level` are considered.
 */
function normalizeStatus(check: RemediableCheck): 'ok' | 'warning' | 'failing' {
  const raw = (check.status ?? check.level ?? '').toLowerCase();
  if (raw === 'warning' || raw === 'warn') return 'warning';
  if (raw === 'error' || raw === 'fail' || raw === 'critical') return 'failing';
  return 'ok';
}

/**
 * A check needs remediation when it is warning or failing. `info`/`pass`/
 * `success` checks are healthy and produce no suggestion.
 *
 * @param check - The check to evaluate. Both `status` and `level` are
 *   considered after lower-casing.
 * @returns `true` when the normalized status is `warning` or `failing`,
 *   otherwise `false`.
 */
export function needsRemediation(check: RemediableCheck): boolean {
  return normalizeStatus(check) !== 'ok';
}

function resolvePm(template: string, packageManager: string): string {
  const updateVerb = UPDATE_VERB_BY_PM[packageManager] ?? 'update';
  return template
    .split(PM_PLACEHOLDER)
    .join(packageManager)
    .split(UPDATE_VERB_PLACEHOLDER)
    .join(updateVerb);
}

function applyText(
  value: string | ((message: string) => string),
  message: string,
  packageManager: string
): string {
  const text = typeof value === 'function' ? value(message) : value;
  return resolvePm(text, packageManager);
}

/**
 * Build a {@link Suggestion} for a single check using the deterministic rules.
 * Returns null for healthy checks. `packageManager` substitutes the `{pm}`
 * placeholder in package-manager-aware rules (defaults to npm).
 *
 * @param check - The check to translate. Its `name`/`id` selects the rule;
 *   its `message` is fed to any dynamic cause/suggestion functions.
 * @param packageManager - The package-manager binary name used to resolve the
 *   `{pm}` and `{update}` placeholders (e.g. `npm`, `pnpm`, `yarn`, `bun`).
 *   Defaults to `npm`.
 * @returns A {@link Suggestion} with cause, suggestion text, and (when both
 *   rule-fixable and allow-listed) a `fixCommand`; or `null` when the check is
 *   healthy.
 */
export function buildSuggestion(
  check: RemediableCheck,
  packageManager = 'npm'
): Suggestion | null {
  if (!needsRemediation(check)) return null;

  const id = checkId(check);
  const message = check.message ?? '';
  const rule = REMEDIATION_RULES[id] ?? fallbackRule(message);

  const cause = applyText(rule.cause, message, packageManager);
  const suggestion = applyText(rule.suggestion, message, packageManager);
  const fixCommand = rule.fixCommand
    ? resolvePm(rule.fixCommand, packageManager)
    : undefined;

  // A rule is only truly fixable if it is both flagged fixable AND its command
  // is allow-listed. This keeps the contract honest: fixable === executable.
  const fixable = rule.fixable && isAllowedFixCommand(fixCommand);

  return {
    checkId: id,
    cause,
    suggestion,
    fixable,
    ...(fixable && fixCommand ? { fixCommand } : {}),
  };
}

/**
 * Map a list of checks to suggestions, dropping healthy checks. Order is
 * preserved so output is stable.
 *
 * @param checks - The checks to translate, in display order.
 * @param packageManager - The package-manager binary used for placeholder
 *   substitution in package-manager-aware rules. Defaults to `npm`.
 * @returns An ordered array of {@link Suggestion} objects, one per
 *   non-healthy check. Healthy checks are omitted.
 */
export function buildSuggestions(
  checks: RemediableCheck[],
  packageManager = 'npm'
): Suggestion[] {
  return checks
    .map(check => buildSuggestion(check, packageManager))
    .filter((s): s is Suggestion => s !== null);
}

/**
 * Compose a {@link FixPlan} from suggestions.
 *
 * - Fixable suggestions with an allow-listed command become executable steps.
 * - Every other suggestion becomes a manual (non-executable) step carrying the
 *   human suggestion as its description, so the plan documents the full picture.
 *
 * `apply` controls the `applied` flag on each step and the plan. This function
 * NEVER runs anything; the caller is responsible for execution. The default
 * (`apply = false`) yields a pure dry-run plan.
 *
 * @param suggestions - The suggestions to compose into a plan.
 * @param apply - When `true`, marks executable steps and the overall plan as
 *   applied. When `false` (default), produces a dry-run plan.
 * @returns A {@link FixPlan} whose steps describe both executable fixes and
 *   manual remediation guidance.
 */
export function buildFixPlan(
  suggestions: Suggestion[],
  apply = false
): FixPlan {
  const steps: FixPlanStep[] = suggestions.map(s => {
    const executable = s.fixable && isAllowedFixCommand(s.fixCommand);
    return {
      checkId: s.checkId,
      description: executable
        ? `Run: ${s.fixCommand}`
        : s.suggestion,
      ...(executable && s.fixCommand ? { command: s.fixCommand } : {}),
      // A step is only ever marked applied when we are applying AND it is
      // executable. Manual steps are never "applied".
      applied: apply && executable,
    };
  });

  return {
    applied: apply,
    steps,
  };
}

/**
 * Coverage helper for tests/reporting: the set of check ids with a dedicated
 * (non-fallback) rule.
 *
 * @returns A sorted-stable array of check-id strings that have an explicit
 *   rule in the {@link REMEDIATION_RULES} table. Useful for asserting rule
 *   coverage in tests and reporting gaps.
 */
export function remediationCoverage(): string[] {
  return Object.keys(REMEDIATION_RULES);
}

// ---------------------------------------------------------------------------
// Optional LLM phrasing hook — OFF by default, deterministic rules always work.
// ---------------------------------------------------------------------------

/**
 * Hook for an optional LLM that rewrites the *wording* of a suggestion's
 * cause/suggestion for friendlier phrasing. It MUST NOT change `checkId`,
 * `fixable`, or `fixCommand` — those remain rule-driven so the safety boundary
 * is unaffected by any model output.
 */
export interface RemediationPhraser {
  /** Human-readable name identifying this phraser (e.g. "identity"). */
  readonly name: string;
  /**
   * Rewrite the wording of a suggestion's cause/suggestion text.
   *
   * @param suggestion - The deterministic suggestion to rephrase.
   * @returns A {@link Suggestion} with potentially friendlier wording. The
   *   safety-relevant fields (`checkId`, `fixable`, `fixCommand`) are
   *   re-asserted by {@link applyPhraser} regardless of what this returns.
   */
  phrase(suggestion: Suggestion): Suggestion;
}

/**
 * Default phraser: identity. With no LLM configured, suggestions pass through
 * unchanged. This is the only phraser used offline / in CI.
 *
 * Implements {@link RemediationPhraser}; calling `phrase` on this object
 * simply returns its argument unmodified.
 */
export const identityPhraser: RemediationPhraser = {
  name: 'identity',
  phrase: (suggestion: Suggestion): Suggestion => suggestion,
};

/**
 * Apply a phraser while hard-guaranteeing the safety-relevant fields are
 * preserved from the original deterministic suggestion. Even a misbehaving
 * phraser cannot change which command would run.
 *
 * @param suggestion - The original deterministic suggestion.
 * @param phraser - The phraser to apply. Defaults to
 *   {@link identityPhraser} when omitted, yielding an unchanged suggestion.
 * @returns A {@link Suggestion} whose `cause`/`suggestion` text may have been
 *   rephrased, but whose `checkId`, `fixable`, and `fixCommand` are always
 *   taken from the original input.
 */
export function applyPhraser(
  suggestion: Suggestion,
  phraser: RemediationPhraser = identityPhraser
): Suggestion {
  const phrased = phraser.phrase(suggestion);
  return {
    cause: phrased.cause,
    suggestion: phrased.suggestion,
    // Safety-critical fields are always taken from the deterministic original.
    checkId: suggestion.checkId,
    fixable: suggestion.fixable,
    ...(suggestion.fixable && suggestion.fixCommand
      ? { fixCommand: suggestion.fixCommand }
      : {}),
  };
}
