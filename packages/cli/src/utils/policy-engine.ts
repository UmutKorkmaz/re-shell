import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { getWorkspaces, type WorkspaceInfo } from './monorepo';

/**
 * Declarative policy-pack engine (P9-G1).
 *
 * A policy pack is a small, declarative rule-set (YAML or JSON) describing
 * constraints a workspace should satisfy: required files, required scripts,
 * dependency version constraints, naming conventions, a minimum Node engine,
 * and an allowed-license list. Packs are evaluated against every workspace in
 * the monorepo and rolled up into a single 0-100 readiness score.
 *
 * The module is CLI-free: it returns plain data so the command layer can wrap
 * the result in the JSON envelope and decide on exit codes.
 */

/**
 * Severity level for a policy rule.
 *
 * - `'error'` — a failed rule contributes to a non-zero exit code.
 * - `'warning'` — a failed rule surfaces in the report but does not fail the run.
 */
export type RuleSeverity = 'error' | 'warning';

/** Rule: every workspace must contain these files (relative to its dir). */
const requiredFilesRuleSchema = z.object({
  id: z.string(),
  type: z.literal('required-files'),
  severity: z.enum(['error', 'warning']).default('error'),
  files: z.array(z.string()).min(1),
});

/** Rule: every workspace package.json must define these scripts. */
const requiredScriptsRuleSchema = z.object({
  id: z.string(),
  type: z.literal('required-scripts'),
  severity: z.enum(['error', 'warning']).default('error'),
  scripts: z.array(z.string()).min(1),
});

/**
 * Rule: when a dependency is present anywhere in a workspace, its declared
 * range must satisfy `range` (a semver range matched as a substring/equality
 * — packs declare the exact allowed range string, e.g. "^18.0.0").
 */
const dependencyConstraintsRuleSchema = z.object({
  id: z.string(),
  type: z.literal('dependency-constraints'),
  severity: z.enum(['error', 'warning']).default('error'),
  constraints: z
    .array(
      z.object({
        dependency: z.string(),
        range: z.string(),
      })
    )
    .min(1),
});

/** Rule: every workspace package name must match this regex. */
const namingRuleSchema = z.object({
  id: z.string(),
  type: z.literal('naming'),
  severity: z.enum(['error', 'warning']).default('error'),
  pattern: z.string(),
});

/** Rule: root package.json engines.node must be present and >= minNode. */
const minNodeRuleSchema = z.object({
  id: z.string(),
  type: z.literal('min-node'),
  severity: z.enum(['error', 'warning']).default('error'),
  minNode: z.string(),
});

/** Rule: every workspace package.json license must be in the allowed list. */
const licenseRuleSchema = z.object({
  id: z.string(),
  type: z.literal('license'),
  severity: z.enum(['error', 'warning']).default('warning'),
  allowed: z.array(z.string()).min(1),
});

const ruleSchema = z.discriminatedUnion('type', [
  requiredFilesRuleSchema,
  requiredScriptsRuleSchema,
  dependencyConstraintsRuleSchema,
  namingRuleSchema,
  minNodeRuleSchema,
  licenseRuleSchema,
]);

/**
 * Zod schema for validating a policy pack document loaded from YAML or JSON.
 *
 * A policy pack must declare a unique `name`, an optional human-readable
 * `description`, and at least one rule under `rules`.
 */
export const policyPackSchema = z.object({
  /** Unique identifier for the pack (e.g. "recommended"). */
  name: z.string(),
  /** Optional short description shown in CLI output. */
  description: z.string().optional(),
  /** Non-empty list of policy rules to evaluate. */
  rules: z.array(ruleSchema).min(1),
});

/**
 * A single policy rule. Discriminated by the `type` field — one of
 * `'required-files'`, `'required-scripts'`, `'dependency-constraints'`,
 * `'naming'`, `'min-node'`, or `'license'`.
 */
export type PolicyRule = z.infer<typeof ruleSchema>;

/**
 * A validated policy pack: a named bundle of rules with an optional
 * description, ready to be evaluated against a monorepo.
 */
export type PolicyPack = z.infer<typeof policyPackSchema>;

/**
 * A single rule failure produced during policy evaluation. Captures which
 * rule failed, how severely, the human-readable explanation, and which
 * workspace the failure applies to.
 */
export interface FailedRule {
  /** The `id` of the policy rule that failed. */
  ruleId: string;
  /** Severity of the rule (drives exit code). */
  severity: RuleSeverity;
  /** Human-readable description of why the rule failed. */
  message: string;
  /** Workspace name (or "<root>") the failure applies to. */
  target: string;
}

/**
 * Aggregate result of evaluating a policy pack against every workspace in a
 * monorepo. Contains the readiness score, the list of passing rules, the
 * list of failures, and a flag indicating whether the run should fail.
 */
export interface PolicyCheckResult {
  /** Name of the policy pack that was evaluated. */
  pack: string;
  /** Integer 0-100 readiness score (percentage of passed checks). */
  score: number;
  /** IDs of rules that passed for every applicable target. */
  passed: string[];
  /** Details of every rule-target evaluation that failed. */
  failed: FailedRule[];
  /** True when at least one error-severity rule failed (drives exit code). */
  hasErrors: boolean;
}

interface RootPackageJson {
  engines?: { node?: string };
  [key: string]: unknown;
}

interface WorkspacePackageJson {
  name?: string;
  license?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Registry of built-in policy packs keyed by name. Two packs are provided:
 * a strict "recommended" pack and a minimal "baseline" pack. CLI consumers
 * resolve these by name (e.g. `--pack recommended`).
 *
 * - `recommended` — Re-Shell's full workspace readiness policy.
 * - `baseline` — a minimal policy requiring only a build script and a
 *   valid lowercase package name.
 */
export const BUILTIN_PACKS: Record<string, PolicyPack> = {
  recommended: {
    name: 'recommended',
    description: 'Re-Shell recommended workspace readiness policy',
    rules: [
      {
        id: 'required-files-readme',
        type: 'required-files',
        severity: 'warning',
        files: ['README.md'],
      },
      {
        id: 'required-scripts-build-test',
        type: 'required-scripts',
        severity: 'error',
        scripts: ['build', 'test'],
      },
      {
        id: 'naming-lowercase',
        type: 'naming',
        severity: 'error',
        pattern: '^(@[a-z0-9-]+\\/)?[a-z0-9][a-z0-9.-]*$',
      },
      {
        id: 'min-node-18',
        type: 'min-node',
        severity: 'warning',
        minNode: '18.0.0',
      },
    ],
  },
  baseline: {
    name: 'baseline',
    description: 'Minimal baseline policy (package name + build script)',
    rules: [
      {
        id: 'required-scripts-build',
        type: 'required-scripts',
        severity: 'error',
        scripts: ['build'],
      },
      {
        id: 'naming-lowercase',
        type: 'naming',
        severity: 'error',
        pattern: '^(@[a-z0-9-]+\\/)?[a-z0-9][a-z0-9.-]*$',
      },
    ],
  },
};

/**
 * Load and validate a policy pack from a YAML or JSON file.
 *
 * The file is parsed (YAML is a superset of JSON, so both formats are
 * accepted), then validated against {@link policyPackSchema}.
 *
 * @param filePath - Path to a `.yml`, `.yaml`, or `.json` policy pack file.
 * @returns The validated policy pack.
 * @throws Error when the file is missing or fails schema validation.
 */
export async function loadPolicyPack(filePath: string): Promise<PolicyPack> {
  const resolved = path.resolve(filePath);
  if (!(await fs.pathExists(resolved))) {
    throw new Error(`Policy pack not found: ${filePath}`);
  }
  const raw = await fs.readFile(resolved, 'utf8');
  const parsed: unknown = yaml.load(raw); // yaml.load also parses JSON
  const result = policyPackSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(
      `Invalid policy pack ${filePath}: ${issue.path.join('.')} ${issue.message}`
    );
  }
  return result.data;
}

/**
 * Resolve a pack from either a built-in name or a file path.
 *
 * Resolution order:
 * 1. If `packRef` is omitted, returns the built-in `recommended` pack.
 * 2. If `packRef` matches a key in {@link BUILTIN_PACKS}, returns that pack.
 * 3. Otherwise treats `packRef` as a file path and loads it via
 *    {@link loadPolicyPack}.
 *
 * @param packRef - Built-in pack name (`"recommended"` or `"baseline"`) or a
 *   file path. If omitted, defaults to `"recommended"`.
 * @returns The resolved and validated policy pack.
 * @throws Error when `packRef` is a file path that is missing or invalid.
 */
export async function resolvePolicyPack(packRef?: string): Promise<PolicyPack> {
  if (!packRef) return BUILTIN_PACKS.recommended;
  if (BUILTIN_PACKS[packRef]) return BUILTIN_PACKS[packRef];
  return loadPolicyPack(packRef);
}

async function readJsonSafe<T>(filePath: string): Promise<T | null> {
  try {
    return (await fs.readJson(filePath)) as T;
  } catch {
    return null;
  }
}

function workspaceDeps(pkg: WorkspacePackageJson): Record<string, string> {
  return { ...pkg.dependencies, ...pkg.devDependencies };
}

function parseMajor(version: string): number | null {
  const match = version.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Evaluate a single rule against one workspace's package.json and disk layout.
 * Returns the failures it found (empty array == rule passed for this target).
 */
async function evaluateRuleForWorkspace(
  rule: PolicyRule,
  workspace: WorkspaceInfo,
  rootPath: string,
  pkg: WorkspacePackageJson
): Promise<FailedRule[]> {
  const target = workspace.name;
  const wsDir = path.join(rootPath, workspace.path);

  switch (rule.type) {
    case 'required-files': {
      const failures: FailedRule[] = [];
      for (const file of rule.files) {
        if (!(await fs.pathExists(path.join(wsDir, file)))) {
          failures.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: `Missing required file: ${file}`,
            target,
          });
        }
      }
      return failures;
    }
    case 'required-scripts': {
      const scripts = pkg.scripts ?? {};
      return rule.scripts
        .filter(s => !scripts[s])
        .map(s => ({
          ruleId: rule.id,
          severity: rule.severity,
          message: `Missing required script: ${s}`,
          target,
        }));
    }
    case 'dependency-constraints': {
      const deps = workspaceDeps(pkg);
      const failures: FailedRule[] = [];
      for (const { dependency, range } of rule.constraints) {
        const declared = deps[dependency];
        if (declared !== undefined && declared !== range) {
          failures.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: `Dependency ${dependency} is "${declared}" but policy requires "${range}"`,
            target,
          });
        }
      }
      return failures;
    }
    case 'naming': {
      const name = pkg.name ?? '';
      const re = new RegExp(rule.pattern);
      if (!re.test(name)) {
        return [
          {
            ruleId: rule.id,
            severity: rule.severity,
            message: `Package name "${name}" does not match pattern ${rule.pattern}`,
            target,
          },
        ];
      }
      return [];
    }
    case 'license': {
      const license = pkg.license ?? '';
      if (!rule.allowed.includes(license)) {
        return [
          {
            ruleId: rule.id,
            severity: rule.severity,
            message: license
              ? `License "${license}" not in allowed list: ${rule.allowed.join(', ')}`
              : `Missing license (allowed: ${rule.allowed.join(', ')})`,
            target,
          },
        ];
      }
      return [];
    }
    case 'min-node':
      // Evaluated once against the root package.json, not per-workspace.
      return [];
  }
}

/**
 * Evaluate a policy pack against the monorepo rooted at `rootPath`.
 *
 * Every rule is evaluated against each applicable workspace (or against the
 * root `package.json` for `min-node` rules). The resulting {@link
 * PolicyCheckResult.score} is the percentage of (rule x applicable-target)
 * evaluations that pass, rounded to an integer 0-100. A pack with zero
 * evaluable targets scores 100.
 *
 * @param pack - The validated policy pack to evaluate.
 * @param rootPath - Absolute path to the monorepo root. Defaults to the
 *   current working directory.
 * @returns Aggregate result containing the score, passed rule IDs, failures,
 *   and an `hasErrors` flag for exit-code decisions.
 */
export async function evaluatePolicyPack(
  pack: PolicyPack,
  rootPath: string = process.cwd()
): Promise<PolicyCheckResult> {
  const workspaces = await getWorkspaces(rootPath);
  const rootPkg =
    (await readJsonSafe<RootPackageJson>(path.join(rootPath, 'package.json'))) ??
    {};

  const passed: string[] = [];
  const failed: FailedRule[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  for (const rule of pack.rules) {
    if (rule.type === 'min-node') {
      // Root-level, single evaluation.
      totalChecks += 1;
      const declared = rootPkg.engines?.node;
      const declaredMajor = declared ? parseMajor(declared) : null;
      const requiredMajor = parseMajor(rule.minNode);
      const ok =
        declaredMajor !== null &&
        requiredMajor !== null &&
        declaredMajor >= requiredMajor;
      if (ok) {
        passedChecks += 1;
        passed.push(rule.id);
      } else {
        failed.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: declared
            ? `Root engines.node "${declared}" is below required ${rule.minNode}`
            : `Root package.json is missing engines.node (>= ${rule.minNode})`,
          target: '<root>',
        });
      }
      continue;
    }

    let ruleFullyPassed = true;
    for (const workspace of workspaces) {
      const pkg =
        (await readJsonSafe<WorkspacePackageJson>(
          path.join(rootPath, workspace.path, 'package.json')
        )) ?? {};
      totalChecks += 1;
      const failures = await evaluateRuleForWorkspace(
        rule,
        workspace,
        rootPath,
        pkg
      );
      if (failures.length === 0) {
        passedChecks += 1;
      } else {
        ruleFullyPassed = false;
        failed.push(...failures);
      }
    }
    if (ruleFullyPassed) passed.push(rule.id);
  }

  const score = totalChecks === 0 ? 100 : Math.round((passedChecks / totalChecks) * 100);
  const hasErrors = failed.some(f => f.severity === 'error');

  return {
    pack: pack.name,
    score,
    passed,
    failed,
    hasErrors,
  };
}
