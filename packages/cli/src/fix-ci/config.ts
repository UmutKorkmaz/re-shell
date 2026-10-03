// Gate detection + configuration for `fix --ci` (R-3).
//
// Gates come from (1) detection: the workspace's package manager and its
// package.json scripts (typecheck, test, lint, build), overlaid by (2) explicit
// configuration in `.re-shell/fix-ci.yaml` or the `fixCi:` section of
// `re-shell.workspaces.yaml`:
//
//   gates:
//     - name: typecheck
//       command: [npx, tsc, --noEmit]   # argv, never a shell string
//       locked: true
//       timeoutMs: 300000
//       parser: tsc                     # tsc | vitest | jest | eslint | generic
//   skip: [lint]                        # only unlocked gates may be skipped
//   detect: true                        # false = use ONLY the configured gates
//   protectedPaths: ["src/generated/**"]
//   limits: { maxBytes: 200000, maxFiles: 20, maxChangedLines: 1500 }
//
// Tests are ALWAYS locked: a gate of kind `test` can never be skipped or marked
// unlocked, and a workspace with no test gate is refused (nothing could verify
// a fix).

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseYaml } from 'yaml';
import {
  DEFAULT_GATE_TIMEOUT_MS,
  DEFAULT_PATCH_LIMITS,
  FixCiError,
  type FixCiGateKind,
  type GateDefinition,
  type GateParser,
  type PatchLimits,
  type ResolvedFixCiConfig,
} from './types';

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun';

// Runtime value import of @re-shell/contracts is avoided on purpose (ESM-only package);
// this list mirrors fixCiGateKindSchema and is checked by the contract tests.
export const GATE_KINDS: readonly FixCiGateKind[] = ['typecheck', 'test', 'lint', 'build', 'custom'];

const PARSERS: readonly GateParser[] = ['tsc', 'vitest', 'jest', 'eslint', 'generic'];

/** Script-name candidates per gate kind, in priority order. */
const SCRIPT_CANDIDATES: ReadonlyArray<{ kind: FixCiGateKind; name: string; scripts: string[] }> = [
  { kind: 'typecheck', name: 'typecheck', scripts: ['typecheck', 'type-check', 'check-types', 'tsc'] },
  { kind: 'test', name: 'test', scripts: ['test'] },
  { kind: 'lint', name: 'lint', scripts: ['lint'] },
  { kind: 'build', name: 'build', scripts: ['build'] },
];

/** Default locked state for detected gates. Tests are additionally forced. */
const DEFAULT_LOCKED: Record<FixCiGateKind, boolean> = {
  typecheck: true,
  test: true,
  lint: false,
  build: false,
  custom: false,
};

function readJsonFile(file: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Detect the package manager from package.json `packageManager`, then from the
 * lockfile present at the workspace root; defaults to npm.
 */
export function detectPackageManager(root: string, pkg?: Record<string, unknown> | null): PackageManagerName {
  const declared = typeof pkg?.packageManager === 'string' ? pkg.packageManager.split('@')[0] : '';
  if (declared === 'pnpm' || declared === 'yarn' || declared === 'bun' || declared === 'npm') {
    return declared;
  }
  const has = (name: string): boolean => fs.existsSync(path.join(root, name));
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('yarn.lock')) return 'yarn';
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  return 'npm';
}

/** Guess the output parser for a gate from its kind and the script text behind it. */
export function guessParser(kind: FixCiGateKind, text: string): GateParser | undefined {
  const t = text.toLowerCase();
  if (/\btsc\b/.test(t)) return 'tsc';
  if (/\bvitest\b/.test(t)) return 'vitest';
  if (/\bjest\b/.test(t)) return 'jest';
  if (/\beslint\b/.test(t)) return 'eslint';
  if (kind === 'typecheck') return 'tsc';
  return undefined;
}

/** npm's `npm init` placeholder test script is not a real gate. */
function isPlaceholderScript(script: string): boolean {
  return /no test specified/i.test(script);
}

/** Detect gates from the workspace's package manager + package.json scripts. */
export function detectGates(root: string): GateDefinition[] {
  const pkg = readJsonFile(path.join(root, 'package.json'));
  if (!pkg) return [];
  const scripts = (pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {}) as Record<string, unknown>;
  const pm = detectPackageManager(root, pkg);
  const gates: GateDefinition[] = [];
  for (const candidate of SCRIPT_CANDIDATES) {
    const scriptName = candidate.scripts.find(
      s => typeof scripts[s] === 'string' && !isPlaceholderScript(scripts[s] as string)
    );
    if (!scriptName) continue;
    const scriptText = scripts[scriptName] as string;
    gates.push({
      name: candidate.name,
      kind: candidate.kind,
      command: [pm, 'run', scriptName],
      locked: DEFAULT_LOCKED[candidate.kind] || candidate.kind === 'test',
      timeoutMs: DEFAULT_GATE_TIMEOUT_MS,
      parser: guessParser(candidate.kind, scriptText),
    });
  }
  return gates;
}

interface RawConfig {
  source: string;
  data: Record<string, unknown>;
}

/** Locate the explicit configuration: `.re-shell/fix-ci.yaml` wins over `re-shell.workspaces.yaml#fixCi`. */
function loadRawConfig(root: string): RawConfig | null {
  const candidates = [
    path.join(root, '.re-shell', 'fix-ci.yaml'),
    path.join(root, '.re-shell', 'fix-ci.yml'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const rel = path.relative(root, file);
    let doc: unknown;
    try {
      doc = parseYaml(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new FixCiError('FIX_CI_CONFIG_INVALID', `${rel}: invalid YAML: ${(err as Error).message}`);
    }
    if (doc === null || doc === undefined) return { source: rel, data: {} };
    if (typeof doc !== 'object' || Array.isArray(doc)) {
      throw new FixCiError('FIX_CI_CONFIG_INVALID', `${rel}: expected a mapping at the top level`);
    }
    return { source: rel, data: doc as Record<string, unknown> };
  }
  const ws = path.join(root, 're-shell.workspaces.yaml');
  if (fs.existsSync(ws)) {
    let doc: unknown;
    try {
      doc = parseYaml(fs.readFileSync(ws, 'utf8'));
    } catch (err) {
      throw new FixCiError(
        'FIX_CI_CONFIG_INVALID',
        `re-shell.workspaces.yaml: invalid YAML: ${(err as Error).message}`
      );
    }
    const section = doc && typeof doc === 'object' ? (doc as Record<string, unknown>).fixCi : undefined;
    if (section !== undefined && section !== null) {
      if (typeof section !== 'object' || Array.isArray(section)) {
        throw new FixCiError('FIX_CI_CONFIG_INVALID', 're-shell.workspaces.yaml: `fixCi` must be a mapping');
      }
      return { source: 're-shell.workspaces.yaml#fixCi', data: section as Record<string, unknown> };
    }
  }
  return null;
}

function invalid(source: string, message: string): FixCiError {
  return new FixCiError('FIX_CI_CONFIG_INVALID', `${source}: ${message}`);
}

function parseConfiguredGate(source: string, raw: unknown, index: number): GateDefinition {
  const where = `gates[${index}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw invalid(source, `${where} must be a mapping`);
  }
  const g = raw as Record<string, unknown>;
  if (typeof g.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(g.name)) {
    throw invalid(source, `${where}.name must be a simple identifier`);
  }
  if (typeof g.command === 'string') {
    throw invalid(
      source,
      `${where}.command must be an argv array (e.g. [npx, tsc, --noEmit]); shell strings are not executed`
    );
  }
  if (
    !Array.isArray(g.command) ||
    g.command.length === 0 ||
    !g.command.every(a => typeof a === 'string' && a.length > 0)
  ) {
    throw invalid(source, `${where}.command must be a non-empty array of strings`);
  }
  let kind: FixCiGateKind;
  if (g.kind !== undefined) {
    if (typeof g.kind !== 'string' || !GATE_KINDS.includes(g.kind as FixCiGateKind)) {
      throw invalid(source, `${where}.kind must be one of ${GATE_KINDS.join(', ')}`);
    }
    kind = g.kind as FixCiGateKind;
  } else {
    kind = GATE_KINDS.includes(g.name as FixCiGateKind) ? (g.name as FixCiGateKind) : 'custom';
  }
  if (g.locked !== undefined && typeof g.locked !== 'boolean') {
    throw invalid(source, `${where}.locked must be a boolean`);
  }
  if (g.timeoutMs !== undefined && (typeof g.timeoutMs !== 'number' || !(g.timeoutMs > 0))) {
    throw invalid(source, `${where}.timeoutMs must be a positive number`);
  }
  let parser: GateParser | undefined;
  if (g.parser !== undefined) {
    if (typeof g.parser !== 'string' || !PARSERS.includes(g.parser as GateParser)) {
      throw invalid(source, `${where}.parser must be one of ${PARSERS.join(', ')}`);
    }
    parser = g.parser as GateParser;
  }
  const command = g.command as string[];
  return {
    name: g.name,
    kind,
    command,
    locked: typeof g.locked === 'boolean' ? g.locked : DEFAULT_LOCKED[kind],
    timeoutMs: typeof g.timeoutMs === 'number' ? g.timeoutMs : DEFAULT_GATE_TIMEOUT_MS,
    parser: parser ?? guessParser(kind, command.join(' ')),
  };
}

function parseStringList(source: string, value: unknown, key: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) {
    throw invalid(source, `${key} must be an array of strings`);
  }
  return value as string[];
}

function parseLimits(source: string, value: unknown): PatchLimits {
  const limits = { ...DEFAULT_PATCH_LIMITS };
  if (value === undefined || value === null) return limits;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw invalid(source, 'limits must be a mapping');
  }
  const v = value as Record<string, unknown>;
  for (const key of ['maxBytes', 'maxFiles', 'maxChangedLines'] as const) {
    if (v[key] === undefined) continue;
    if (typeof v[key] !== 'number' || !Number.isInteger(v[key]) || (v[key] as number) <= 0) {
      throw invalid(source, `limits.${key} must be a positive integer`);
    }
    limits[key] = v[key] as number;
  }
  return limits;
}

export interface ResolveConfigOptions {
  /** Gate names to skip (from `--skip-gate`), in addition to the config `skip` list. */
  skipGates?: readonly string[];
}

/**
 * Resolve the effective gate set for a workspace: detected gates overlaid with
 * configured gates, minus skipped (unlocked-only) gates. Enforces the locked-gate
 * invariants and refuses a workspace that has no test gate.
 */
export function resolveFixCiConfig(root: string, options: ResolveConfigOptions = {}): ResolvedFixCiConfig {
  const warnings: string[] = [];
  const raw = loadRawConfig(root);
  const source = raw?.source ?? 'detected from package.json scripts';
  const data = raw?.data ?? {};
  const label = raw?.source ?? 'fix-ci config';

  const configured: GateDefinition[] = [];
  if (data.gates !== undefined && data.gates !== null) {
    if (!Array.isArray(data.gates)) throw invalid(label, 'gates must be an array');
    data.gates.forEach((g, i) => configured.push(parseConfiguredGate(label, g, i)));
  }
  const seen = new Set<string>();
  for (const g of configured) {
    if (seen.has(g.name)) throw invalid(label, `duplicate gate name "${g.name}"`);
    seen.add(g.name);
  }
  if (data.detect !== undefined && typeof data.detect !== 'boolean') {
    throw invalid(label, 'detect must be a boolean');
  }
  const detect = data.detect !== false;

  const byName = new Map<string, GateDefinition>();
  if (detect) {
    for (const g of detectGates(root)) byName.set(g.name, g);
  }
  for (const g of configured) byName.set(g.name, g);
  let gates = [...byName.values()];

  // Tests are ALWAYS locked.
  for (const g of gates) {
    if (g.kind === 'test' && !g.locked) {
      warnings.push(`gate "${g.name}" is a test gate and is always locked; ignoring locked: false`);
      g.locked = true;
    }
  }

  const skipList = [...parseStringList(label, data.skip, 'skip'), ...(options.skipGates ?? [])];
  for (const name of skipList) {
    const gate = gates.find(g => g.name === name);
    if (!gate) {
      warnings.push(`skip: no gate named "${name}"; ignoring`);
      continue;
    }
    if (gate.locked || gate.kind === 'test') {
      throw new FixCiError(
        'FIX_CI_CONFIG_INVALID',
        `gate "${name}" is locked and cannot be skipped (tests and gates marked locked are never skipped)`,
        { gate: name }
      );
    }
    gates = gates.filter(g => g !== gate);
  }

  if (gates.length === 0) {
    throw new FixCiError(
      'FIX_CI_NO_GATES',
      'No gates found: add typecheck/test/lint/build scripts to package.json or define gates in .re-shell/fix-ci.yaml'
    );
  }
  if (!gates.some(g => g.kind === 'test')) {
    throw new FixCiError(
      'FIX_CI_NO_GATES',
      'No test gate found. Tests are always a locked gate: add a "test" script to package.json or a gate with kind: test in .re-shell/fix-ci.yaml'
    );
  }

  return {
    source,
    gates,
    protectedPaths: parseStringList(label, data.protectedPaths, 'protectedPaths'),
    limits: parseLimits(label, data.limits),
    warnings,
  };
}
