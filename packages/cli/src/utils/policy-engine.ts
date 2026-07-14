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

// ---------------------------------------------------------------------------
// Service-level rule schemas (Chunk 1 expansion)
// ---------------------------------------------------------------------------

/** Rule: service must declare a healthCheck configuration. */
const healthcheckRequiredRuleSchema = z.object({
  id: z.string(),
  type: z.literal('healthcheck-required'),
  severity: z.enum(['error', 'warning']).default('error'),
  serviceTypes: z.array(z.string()).optional(),
});

/** Rule: service must declare cpu and/or memory resource limits. */
const resourceLimitsRuleSchema = z.object({
  id: z.string(),
  type: z.literal('resource-limits'),
  severity: z.enum(['error', 'warning']).default('warning'),
  requireCpu: z.boolean().optional(),
  requireMemory: z.boolean().optional(),
});

/** Rule: service port must be within the declared range. */
const portRangeRuleSchema = z.object({
  id: z.string(),
  type: z.literal('port-range'),
  severity: z.enum(['error', 'warning']).default('error'),
  min: z.number(),
  max: z.number(),
});

/** Rule: service dependency count (dependsOn) must be within range. */
const serviceDependencyRuleSchema = z.object({
  id: z.string(),
  type: z.literal('service-dependency'),
  severity: z.enum(['error', 'warning']).default('warning'),
  min: z.number().optional(),
  max: z.number().optional(),
});

/** Rule: service must define the listed environment variables. */
const requiredEnvRuleSchema = z.object({
  id: z.string(),
  type: z.literal('required-env'),
  severity: z.enum(['error', 'warning']).default('error'),
  variables: z.array(z.string()).min(1),
});

/** Rule: service framework must be in the allowed list. */
const frameworkAllowlistRuleSchema = z.object({
  id: z.string(),
  type: z.literal('framework-allowlist'),
  severity: z.enum(['error', 'warning']).default('warning'),
  allowed: z.array(z.string()).min(1),
});

/** Rule: service language must be in the allowed list. */
const languageAllowlistRuleSchema = z.object({
  id: z.string(),
  type: z.literal('language-allowlist'),
  severity: z.enum(['error', 'warning']).default('error'),
  allowed: z.array(z.string()).min(1),
});

/** Rule: service must declare scaling configuration. */
const scalingRequiredRuleSchema = z.object({
  id: z.string(),
  type: z.literal('scaling-required'),
  severity: z.enum(['error', 'warning']).default('warning'),
  serviceTypes: z.array(z.string()).optional(),
  requireMinReplicas: z.number().optional(),
});

const ruleSchema = z.discriminatedUnion('type', [
  requiredFilesRuleSchema,
  requiredScriptsRuleSchema,
  dependencyConstraintsRuleSchema,
  namingRuleSchema,
  minNodeRuleSchema,
  licenseRuleSchema,
  healthcheckRequiredRuleSchema,
  resourceLimitsRuleSchema,
  portRangeRuleSchema,
  serviceDependencyRuleSchema,
  requiredEnvRuleSchema,
  frameworkAllowlistRuleSchema,
  languageAllowlistRuleSchema,
  scalingRequiredRuleSchema,
]);

export const policyPackSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  rules: z.array(ruleSchema).min(1),
});

export type PolicyRule = z.infer<typeof ruleSchema>;
export type PolicyPack = z.infer<typeof policyPackSchema>;

export interface FailedRule {
  ruleId: string;
  severity: RuleSeverity;
  message: string;
  /** Workspace name (or "<root>") the failure applies to. */
  target: string;
}

/** Letter grade corresponding to the numeric readiness score. */
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

/** A failed rule that has been waived by a policy exception. */
export interface WaivedRule extends FailedRule {
  waiveReason?: string;
  waiveExpires?: string;
}

/**
 * A single rule evaluation result, used for the `results` array in
 * `PolicyCheckResult`. Covers both passing and failing evaluations across
 * all rule types (package.json-level and service-level).
 */
export interface PolicyResultItem {
  service?: string;
  workspace?: string;
  ruleId: string;
  ruleType: string;
  passed: boolean;
  severity: RuleSeverity;
  message: string;
  waived?: boolean;
  waiveReason?: string;
  waiveExpires?: string;
}

/** Details of a policy exception whose expiry date has passed. */
export interface ExpiredException {
  service: string;
  rule: string;
  expires: string;
}

export interface PolicyCheckResult {
  pack: string;
  score: number;
  /** Letter grade derived from `score`. */
  grade: Grade;
  passed: string[];
  failed: FailedRule[];
  /** Failed rules that were waived by a non-expired exception. */
  waived: WaivedRule[];
  /** Per-rule per-target evaluation results (pass + fail + waived). */
  results: PolicyResultItem[];
  /** True when at least one error-severity rule failed (drives exit code). */
  hasErrors: boolean;
  /** Exceptions that matched failures but have passed their expiry date. */
  expiredExceptions: ExpiredException[];
}

/**
 * Convert a numeric 0-100 score to a letter grade.
 *
 * | Score  | Grade |
 * |--------|-------|
 * | 90-100 | A     |
 * | 80-89  | B     |
 * | 70-79  | C     |
 * | 60-69  | D     |
 * | 0-59   | F     |
 */
export function scoreToGrade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
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
 * Two built-in packs: a strict "recommended" pack and a minimal "baseline".
 * Returned by name so the command can resolve `--pack recommended`.
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
 * Resolve a pack from either a built-in name or a file path. When no value is
 * supplied, the "recommended" built-in pack is used.
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
 * Score is the percentage of (rule × applicable-target) evaluations that pass,
 * rounded to an integer 0-100. A pack with zero evaluable targets scores 100.
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
    grade: scoreToGrade(score),
    passed,
    failed,
    waived: [],
    results: [],
    hasErrors,
    expiredExceptions: [],
  };
}
