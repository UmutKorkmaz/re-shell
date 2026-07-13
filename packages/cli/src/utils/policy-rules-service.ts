/**
 * Service-level policy rule engine (Chunk 1 of the policy-pack expansion).
 *
 * The existing `policy-engine.ts` evaluates rules against `package.json` files
 * (required-files, required-scripts, naming, etc.). This module adds 8 new
 * rule types that evaluate `ServiceConfig` objects from the workspace parser,
 * enabling policies like "every backend service must declare a health check"
 * or "every service must have resource limits".
 *
 * The module is CLI-free: `evaluateServiceRules` returns plain data so the
 * command layer can wrap results in the JSON envelope and decide on exit codes.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  WorkspaceParser,
  type ServiceConfig,
  type FrameworkConfig,
} from '../parsers/workspace-parser';

// ---------------------------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------------------------

/** Context passed to each rule evaluator. */
export interface ServiceRuleContext {
  service: ServiceConfig;
  workspacePath: string;
}

/** Result of evaluating a single rule against a single service. */
export interface ServiceRuleResult {
  ruleId: string;
  serviceName: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * A single service-level rule. The `type` field discriminates which evaluator
 * runs. Fields like `min`, `max`, `allowed`, `variables`, etc. are consumed
 * by the corresponding evaluator. `serviceTypes` optionally restricts which
 * services the rule applies to.
 */
export interface ServiceRule {
  id: string;
  type: ServiceRuleType;
  severity: 'error' | 'warning';
  serviceTypes?: string[];
  // resource-limits
  requireCpu?: boolean;
  requireMemory?: boolean;
  // port-range
  min?: number;
  max?: number;
  // service-dependency
  // (reuses min/max)
  // required-env
  variables?: string[];
  // framework / language allowlist
  allowed?: string[];
  // scaling-required
  requireMinReplicas?: boolean;
}

/** The 8 service-level rule type identifiers. */
export type ServiceRuleType =
  | 'healthcheck-required'
  | 'resource-limits'
  | 'port-range'
  | 'service-dependency'
  | 'required-env'
  | 'framework-allowlist'
  | 'language-allowlist'
  | 'scaling-required';

/** A pack of service-level rules. */
export interface ServicePolicyPack {
  name: string;
  description?: string;
  rules: ServiceRule[];
}

/** Function signature every evaluator follows. */
type ServiceRuleEvaluator = (rule: ServiceRule, ctx: ServiceRuleContext) => ServiceRuleResult;

// ---------------------------------------------------------------------------
// Rule Evaluators
// ---------------------------------------------------------------------------

/**
 * healthcheck-required: Fail when `service.healthCheck` is undefined or an
 * empty object.
 */
const evaluateHealthcheckRequired: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const hc = service.healthCheck;
  const hasHealthCheck = hc !== undefined && Object.keys(hc).length > 0;

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: hasHealthCheck,
    message: hasHealthCheck
      ? `Service "${service.name}" has a health check configured`
      : `Service "${service.name}" is missing a health check configuration`,
    severity: rule.severity,
  };
};

/**
 * resource-limits: No-op pass when both `requireCpu` and `requireMemory` are
 * false/omitted. Otherwise fail when `resources` is undefined/empty or the
 * required cpu/memory fields are absent.
 */
const evaluateResourceLimits: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const requireCpu = rule.requireCpu ?? false;
  const requireMemory = rule.requireMemory ?? false;

  // No-op: neither resource is required
  if (!requireCpu && !requireMemory) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: true,
      message: `Service "${service.name}" has no resource requirements to check`,
      severity: rule.severity,
    };
  }

  const resources = service.resources;
  if (resources === undefined || Object.keys(resources).length === 0) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: false,
      message: `Service "${service.name}" has no resource limits defined`,
      severity: rule.severity,
    };
  }

  const missing: string[] = [];
  if (requireCpu && resources.cpu === undefined) {
    missing.push('cpu');
  }
  if (requireMemory && resources.memory === undefined) {
    missing.push('memory');
  }

  if (missing.length > 0) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: false,
      message: `Service "${service.name}" is missing resource limits for: ${missing.join(', ')}`,
      severity: rule.severity,
    };
  }

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: true,
    message: `Service "${service.name}" has the required resource limits`,
    severity: rule.severity,
  };
};

/**
 * port-range: Pass with "no port" message when `service.port` is undefined.
 * Otherwise check `port >= min && port <= max`.
 */
const evaluatePortRange: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const port = service.port;

  if (port === undefined) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: true,
      message: `Service "${service.name}" has no port assigned (no port range check)`,
      severity: rule.severity,
    };
  }

  const min = rule.min ?? 0;
  const max = rule.max ?? Infinity;
  const inRange = port >= min && port <= max;

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: inRange,
    message: inRange
      ? `Service "${service.name}" port ${port} is within range [${min}, ${max}]`
      : `Service "${service.name}" port ${port} is outside allowed range [${min}, ${max}]`,
    severity: rule.severity,
  };
};

/**
 * service-dependency: Count `(service.dependsOn ?? []).length`. Check against
 * `min` (default 0) and `max` (default Infinity).
 */
const evaluateServiceDependency: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const count = (service.dependsOn ?? []).length;
  const min = rule.min ?? 0;
  const max = rule.max ?? Infinity;
  const inRange = count >= min && count <= max;

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: inRange,
    message: inRange
      ? `Service "${service.name}" has ${count} dependencies (within [${min}, ${max}])`
      : `Service "${service.name}" has ${count} dependencies, expected between ${min} and ${max}`,
    severity: rule.severity,
  };
};

/**
 * required-env: Check each variable in `variables` exists as a key in
 * `service.env ?? {}`.
 */
const evaluateRequiredEnv: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const required = rule.variables ?? [];
  const env = service.env ?? {};
  const missing = required.filter(v => !(v in env));

  if (missing.length === 0) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: true,
      message: `Service "${service.name}" has all required environment variables`,
      severity: rule.severity,
    };
  }

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: false,
    message: `Service "${service.name}" is missing required environment variables: ${missing.join(', ')}`,
    severity: rule.severity,
  };
};

/**
 * framework-allowlist: Resolve framework to string (if object, use `.name`,
 * trim). Fail if empty or not in `allowed`.
 */
const evaluateFrameworkAllowlist: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const allowed = rule.allowed ?? [];

  let frameworkName: string;
  if (typeof service.framework === 'object' && service.framework !== null) {
    frameworkName = ((service.framework as FrameworkConfig).name ?? '').trim();
  } else {
    frameworkName = (service.framework as string ?? '').trim();
  }

  if (frameworkName.length === 0) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: false,
      message: `Service "${service.name}" has no framework defined`,
      severity: rule.severity,
    };
  }

  if (!allowed.includes(frameworkName)) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: false,
      message: `Service "${service.name}" framework "${frameworkName}" is not in allowed list: ${allowed.join(', ')}`,
      severity: rule.severity,
    };
  }

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: true,
    message: `Service "${service.name}" framework "${frameworkName}" is allowed`,
    severity: rule.severity,
  };
};

/**
 * language-allowlist: Check `service.language` is in `allowed`.
 */
const evaluateLanguageAllowlist: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const allowed = rule.allowed ?? [];
  const lang = service.language ?? '';

  if (!allowed.includes(lang)) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: false,
      message: `Service "${service.name}" language "${lang}" is not in allowed list: ${allowed.join(', ')}`,
      severity: rule.severity,
    };
  }

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: true,
    message: `Service "${service.name}" language "${lang}" is allowed`,
    severity: rule.severity,
  };
};

/**
 * scaling-required: Fail when `scaling` is undefined or empty. If
 * `requireMinReplicas` is set, check `scaling.minReplicas` via a
 * `typeof actual === 'number'` guard.
 */
const evaluateScalingRequired: ServiceRuleEvaluator = (rule, ctx) => {
  const { service } = ctx;
  const scaling = service.scaling;

  if (scaling === undefined || Object.keys(scaling).length === 0) {
    return {
      ruleId: rule.id,
      serviceName: service.name,
      passed: false,
      message: `Service "${service.name}" is missing scaling configuration`,
      severity: rule.severity,
    };
  }

  if (rule.requireMinReplicas) {
    const actual = scaling.minReplicas;
    if (typeof actual !== 'number') {
      return {
        ruleId: rule.id,
        serviceName: service.name,
        passed: false,
        message: `Service "${service.name}" scaling.minReplicas is missing or not a number`,
        severity: rule.severity,
      };
    }
  }

  return {
    ruleId: rule.id,
    serviceName: service.name,
    passed: true,
    message: `Service "${service.name}" has scaling configuration`,
    severity: rule.severity,
  };
};

// ---------------------------------------------------------------------------
// Dispatch Table
// ---------------------------------------------------------------------------

const EVALUATORS: Record<ServiceRuleType, ServiceRuleEvaluator> = {
  'healthcheck-required': evaluateHealthcheckRequired,
  'resource-limits': evaluateResourceLimits,
  'port-range': evaluatePortRange,
  'service-dependency': evaluateServiceDependency,
  'required-env': evaluateRequiredEnv,
  'framework-allowlist': evaluateFrameworkAllowlist,
  'language-allowlist': evaluateLanguageAllowlist,
  'scaling-required': evaluateScalingRequired,
};

const SERVICE_RULE_TYPES = new Set<ServiceRuleType>(Object.keys(EVALUATORS) as ServiceRuleType[]);

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Evaluate a pack of service-level rules against a set of services.
 *
 * For each rule:
 *  1. If `serviceTypes` is specified, only services whose `type` matches are
 *     checked. Services without a `type` default to `'backend'`.
 *  2. If `serviceTypes` is omitted, all services are checked.
 *  3. The evaluator for the rule's `type` is called once per applicable service.
 *
 * Returns a flat `ServiceRuleResult[]` — one entry per (rule x service) pair.
 */
export function evaluateServiceRules(
  pack: ServicePolicyPack,
  rootPath: string,
  services: Record<string, ServiceConfig>
): ServiceRuleResult[] {
  const results: ServiceRuleResult[] = [];

  for (const rule of pack.rules) {
    // Skip rules that are not service-level types (future-proofing for
    // when the pack schema also includes package.json-level rules).
    if (!SERVICE_RULE_TYPES.has(rule.type)) continue;

    for (const [serviceName, service] of Object.entries(services)) {
      // serviceTypes filter
      if (rule.serviceTypes && rule.serviceTypes.length > 0) {
        const serviceType = service.type ?? 'backend';
        if (!rule.serviceTypes.includes(serviceType)) continue;
      }

      const ctx: ServiceRuleContext = { service, workspacePath: rootPath };
      const evaluator = EVALUATORS[rule.type];
      results.push(evaluator(rule, ctx));
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Workspace Loader
// ---------------------------------------------------------------------------

/**
 * Async helper: search for `re-shell.workspaces.yaml` or `.yml` in `cwd`.
 * If found, parse it via `WorkspaceParser` and return the services map.
 * If no file is found, returns `{ services: null, rootPath: cwd }`.
 */
export async function loadServicesFromWorkspace(
  cwd: string
): Promise<{ services: Record<string, ServiceConfig> | null; rootPath: string }> {
  const candidates = [
    're-shell.workspaces.yaml',
    're-shell.workspaces.yml',
  ];

  for (const candidate of candidates) {
    const filePath = path.join(cwd, candidate);
    if (fs.existsSync(filePath)) {
      const parser = new WorkspaceParser();
      const result = parser.parse(filePath);
      if (result.valid && result.config?.services) {
        return { services: result.config.services, rootPath: cwd };
      }
      // If parsing fails, return null — the caller can decide how to surface
      // the validation errors.
      return { services: null, rootPath: cwd };
    }
  }

  return { services: null, rootPath: cwd };
}
