import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'js-yaml';
import { findMonorepoRoot, getWorkspaces, type WorkspaceInfo } from '../utils/monorepo';
import { DependencyGraphEngine } from '../graph/dependency-graph-engine';
import { editDistance, stem, words } from './text';
import type { WorkspaceNodeRef } from './types';

/**
 * Live workspace context for `re-shell ai`.
 *
 * The context is built from the REAL workspace: the declared workspaces
 * (`getWorkspaces`, the same source `workspace graph` / `workspace summary`
 * use), polyglot services declared in `re-shell.workspaces.yaml`, per-node
 * language/framework detection from marker files, and a
 * {@link DependencyGraphEngine} for the dependency edges and transitive impact.
 *
 * It serves three consumers:
 *  - the offline resolver ("build the payments service" -> the real node),
 *  - the LLM prompt (a compact, size-capped rendering),
 *  - the cache (a fingerprint that changes whenever the workspace graph does).
 */

/** What kind of workspace node this is. */
export type WorkspaceNodeKind = 'app' | 'service' | 'package' | 'lib' | 'tool';

/** One real node of the workspace graph. */
export interface WorkspaceNode {
  /** Canonical name (package name, or service name for config-declared nodes). */
  name: string;
  /** Path relative to the workspace root (POSIX separators). */
  path: string;
  kind: WorkspaceNodeKind;
  language?: string;
  framework?: string;
  port?: number;
  /** Direct internal dependencies (names of other nodes). */
  dependencies: string[];
  /** Direct internal dependents (names of other nodes). */
  dependents: string[];
  /** Number of nodes transitively impacted by a change here. */
  impact: number;
  /** package.json script names. */
  scripts: string[];
  /**
   * Whether `re-shell run <task> --filter <name>` can see this node. Mirrors
   * the task runner's discovery: `<apps|packages|libs|tools>/<dir>/package.json`.
   */
  runnable: boolean;
  source: 'package.json' | 'workspace-config';
}

/** The compact, fingerprinted view of a workspace. */
export interface WorkspaceContext {
  root: string;
  name: string;
  packageManager: string;
  /** False when no monorepo root was found (nodes is then empty). */
  inWorkspace: boolean;
  nodes: WorkspaceNode[];
  /** Hash of the node set; changes when names/paths/deps/frameworks change. */
  fingerprint: string;
}

/** Empty context for a directory that is not a workspace. */
export function emptyWorkspaceContext(root: string): WorkspaceContext {
  return {
    root,
    name: path.basename(root),
    packageManager: 'npm',
    inWorkspace: false,
    nodes: [],
    fingerprint: 'none',
  };
}

/**
 * The directory AI state (`.re-shell/ai`) belongs to: the monorepo root when
 * `startPath` is inside one, otherwise `startPath` itself.
 *
 * @param startPath - Directory to start from.
 * @returns An absolute directory path.
 */
export async function resolveWorkspaceRoot(startPath: string = process.cwd()): Promise<string> {
  const start = path.resolve(startPath);
  try {
    return (await findMonorepoRoot(start)) ?? start;
  } catch {
    return start;
  }
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

const RUNNABLE_PATH = /^(apps|packages|libs|tools)\/[^/]+$/;

function readText(file: string): string | undefined {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
}

function readJson(file: string): Record<string, unknown> | undefined {
  const text = readText(file);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Detect language + framework of a node directory from marker files. */
export function detectLanguage(dir: string): { language?: string; framework?: string } {
  const exists = (f: string): boolean => fs.existsSync(path.join(dir, f));
  const has = (text: string | undefined, ...needles: string[]): string | undefined =>
    text ? needles.find(n => text.toLowerCase().includes(n)) : undefined;

  if (exists('go.mod')) {
    const mod = (readText(path.join(dir, 'go.mod')) ?? '').toLowerCase();
    const framework = mod.includes('gin-gonic')
      ? 'gin'
      : mod.includes('gofiber')
        ? 'fiber'
        : mod.includes('labstack/echo')
          ? 'echo'
          : mod.includes('go-chi')
            ? 'chi'
            : undefined;
    return { language: 'go', framework };
  }
  if (exists('Cargo.toml')) {
    const toml = readText(path.join(dir, 'Cargo.toml'));
    return { language: 'rust', framework: has(toml, 'axum', 'actix-web', 'rocket', 'warp') };
  }
  if (exists('pom.xml') || exists('build.gradle') || exists('build.gradle.kts')) {
    const text = readText(path.join(dir, 'pom.xml')) ?? readText(path.join(dir, 'build.gradle')) ?? '';
    return {
      language: 'java',
      framework: has(text, 'spring-boot', 'quarkus', 'micronaut', 'vertx')?.replace('spring-boot', 'spring'),
    };
  }
  if (exists('requirements.txt') || exists('pyproject.toml') || exists('setup.py')) {
    const text =
      (readText(path.join(dir, 'requirements.txt')) ?? '') +
      (readText(path.join(dir, 'pyproject.toml')) ?? '');
    return { language: 'python', framework: has(text, 'fastapi', 'flask', 'django') };
  }
  try {
    if (fs.readdirSync(dir).some(f => f.endsWith('.csproj'))) return { language: 'csharp' };
  } catch {
    /* unreadable directory: fall through */
  }
  if (exists('composer.json')) return { language: 'php' };
  if (exists('Gemfile')) return { language: 'ruby' };
  if (exists('package.json')) {
    const pkg = readJson(path.join(dir, 'package.json')) ?? {};
    const deps = {
      ...((pkg.dependencies as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };
    const language = deps.typescript || exists('tsconfig.json') ? 'typescript' : 'javascript';
    const framework =
      (deps['@angular/core'] && 'angular') ||
      (deps.next && 'next') ||
      (deps.react && 'react') ||
      (deps.vue && 'vue') ||
      (deps.svelte && 'svelte') ||
      (deps['@nestjs/core'] && 'nestjs') ||
      (deps.fastify && 'fastify') ||
      (deps.express && 'express') ||
      undefined;
    return { language, framework };
  }
  return {};
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

interface ConfigService {
  name: string;
  path?: string;
  type?: string;
  language?: string;
  framework?: string;
  port?: number;
  dependsOn: string[];
}

/** Leniently read polyglot services from `re-shell.workspaces.yaml`. */
function readConfigServices(root: string): ConfigService[] {
  for (const file of ['re-shell.workspaces.yaml', 're-shell.workspaces.yml']) {
    const text = readText(path.join(root, file));
    if (!text) continue;
    try {
      const doc = yaml.load(text) as { services?: Record<string, Record<string, unknown>> } | undefined;
      const services = doc?.services;
      if (!services || typeof services !== 'object') return [];
      return Object.entries(services).map(([name, cfg]) => {
        const c = (cfg ?? {}) as Record<string, unknown>;
        const fw = c.framework;
        return {
          name,
          path: typeof c.path === 'string' ? c.path : undefined,
          type: typeof c.type === 'string' ? c.type : undefined,
          language: typeof c.language === 'string' ? c.language : undefined,
          framework:
            typeof fw === 'string'
              ? fw
              : fw && typeof fw === 'object' && typeof (fw as { name?: unknown }).name === 'string'
                ? ((fw as { name: string }).name)
                : undefined,
          port: typeof c.port === 'number' ? c.port : undefined,
          dependsOn: Array.isArray(c.dependsOn) ? c.dependsOn.filter(d => typeof d === 'string') : [],
        };
      });
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Build the workspace context for `startPath`.
 *
 * Never throws: an unreadable or non-workspace directory yields an empty
 * context (`inWorkspace: false`), so callers can always proceed offline.
 *
 * @param startPath - Directory to start the monorepo-root search from.
 * @returns The compact workspace context.
 */
export async function buildWorkspaceContext(
  startPath: string = process.cwd()
): Promise<WorkspaceContext> {
  const start = path.resolve(startPath);
  let root: string | null = null;
  try {
    root = await findMonorepoRoot(start);
  } catch {
    root = null;
  }
  if (!root) return emptyWorkspaceContext(start);

  let workspaces: WorkspaceInfo[] = [];
  try {
    workspaces = await getWorkspaces(root);
  } catch {
    workspaces = [];
  }

  const rootPkg = readJson(path.join(root, 'package.json')) ?? {};
  const packageManager = fs.existsSync(path.join(root, 'pnpm-lock.yaml'))
    ? 'pnpm'
    : fs.existsSync(path.join(root, 'yarn.lock'))
      ? 'yarn'
      : fs.existsSync(path.join(root, 'bun.lockb'))
        ? 'bun'
        : 'npm';

  type Draft = Omit<WorkspaceNode, 'dependents' | 'impact'>;
  const drafts = new Map<string, Draft>();

  for (const ws of workspaces) {
    const dir = path.join(root, ws.path);
    const pkg = readJson(path.join(dir, 'package.json')) ?? {};
    const detected = detectLanguage(dir);
    const relPath = toPosix(ws.path);
    drafts.set(ws.name, {
      name: ws.name,
      path: relPath,
      kind: ws.type,
      language: detected.language,
      framework: detected.framework ?? ws.framework,
      dependencies: ws.dependencies, // narrowed to internal names below
      scripts: Object.keys((pkg.scripts as Record<string, string>) ?? {}),
      runnable: RUNNABLE_PATH.test(relPath),
      source: 'package.json',
    });
  }

  for (const svc of readConfigServices(root)) {
    const relPath = toPosix(svc.path ?? `services/${svc.name}`);
    // A service already discovered through package.json (same path) is
    // enriched, not duplicated.
    const existing = [...drafts.values()].find(d => d.path === relPath || d.name === svc.name);
    if (existing) {
      existing.language = svc.language ?? existing.language;
      existing.framework = svc.framework ?? existing.framework;
      existing.port = svc.port ?? existing.port;
      existing.dependencies = [...existing.dependencies, ...svc.dependsOn];
      continue;
    }
    const detected = detectLanguage(path.join(root, relPath));
    drafts.set(svc.name, {
      name: svc.name,
      path: relPath,
      kind: 'service',
      language: svc.language ?? detected.language,
      framework: svc.framework ?? detected.framework,
      port: svc.port,
      dependencies: svc.dependsOn,
      scripts: [],
      runnable: false,
      source: 'workspace-config',
    });
  }

  // A dependency may be written as the full package name, the unscoped name or
  // the directory name (config-declared `dependsOn` usually is). Resolve each to
  // the canonical node name, only when the match is unambiguous.
  const aliases = new Map<string, string | null>();
  const addAlias = (alias: string, name: string): void => {
    const key = alias.toLowerCase();
    const existing = aliases.get(key);
    aliases.set(key, existing === undefined || existing === name ? name : null);
  };
  for (const d of drafts.values()) {
    addAlias(d.name, d.name);
    addAlias(unscoped(d.name), d.name);
    addAlias(path.posix.basename(d.path), d.name);
  }
  const canonicalDep = (dep: string): string | undefined => {
    if (drafts.has(dep)) return dep;
    return aliases.get(dep.toLowerCase()) ?? undefined;
  };

  // Dependency graph (nodes + internal edges) via the graph engine.
  const engine = new DependencyGraphEngine();
  for (const d of drafts.values()) engine.addNode(d.name, 'service', d.name, d.language);
  for (const d of drafts.values()) {
    d.dependencies = Array.from(
      new Set(
        d.dependencies
          .map(canonicalDep)
          .filter((dep): dep is string => dep !== undefined && dep !== d.name)
      )
    ).sort();
    for (const dep of d.dependencies) engine.addEdge(d.name, dep);
  }

  const dependents = new Map<string, string[]>();
  for (const d of drafts.values()) {
    for (const dep of d.dependencies) {
      const list = dependents.get(dep) ?? [];
      list.push(d.name);
      dependents.set(dep, list);
    }
  }

  const nodes: WorkspaceNode[] = [...drafts.values()]
    .map(d => ({
      ...d,
      dependents: (dependents.get(d.name) ?? []).sort(),
      impact: engine.getAllDependents(d.name).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    root,
    name: typeof rootPkg.name === 'string' && rootPkg.name ? rootPkg.name : path.basename(root),
    packageManager,
    inWorkspace: true,
    nodes,
    fingerprint: fingerprintNodes(nodes),
  };
}

/** Stable hash of the node set. */
export function fingerprintNodes(nodes: readonly WorkspaceNode[]): string {
  const lines = nodes.map(n =>
    [n.name, n.path, n.kind, n.language ?? '', n.framework ?? '', n.dependencies.join(',')].join('|')
  );
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex').slice(0, 16);
}

/** The reference form of a node, for results and the JSON contract. */
export function toNodeRef(node: WorkspaceNode): WorkspaceNodeRef {
  return { name: node.name, path: node.path, kind: node.kind };
}

// ---------------------------------------------------------------------------
// Node matching
// ---------------------------------------------------------------------------

/** Words that describe a KIND of node rather than identify one. */
const GENERIC_WORDS: ReadonlySet<string> = new Set(
  [
    'service', 'app', 'application', 'package', 'lib', 'library', 'module',
    'project', 'workspace', 'tool', 'microservice',
  ].map(stem)
);

function unscoped(name: string): string {
  return name.replace(/^@[^/]+\//, '');
}

/** Identity words (stemmed) of a node: name + directory basename, minus generic words. */
export function nodeIdentityStems(node: WorkspaceNode): { identity: string[]; generic: string[] } {
  const raw = new Set<string>([
    ...words(unscoped(node.name)),
    ...words(path.posix.basename(node.path)),
  ]);
  const identity: string[] = [];
  const generic: string[] = [];
  for (const w of raw) {
    const s = stem(w);
    (GENERIC_WORDS.has(s) ? generic : identity).push(s);
  }
  if (identity.length === 0) return { identity: generic, generic: [] };
  return { identity: Array.from(new Set(identity)), generic: Array.from(new Set(generic)) };
}

/** One node mentioned in a prompt. */
export interface NodeMention {
  node: WorkspaceNode;
  /** Identity stems of the node that the prompt contained. */
  matched: string[];
  /** Fraction of the node's identity stems the prompt contained. */
  coverage: number;
  /** Ranking score (higher is a stronger mention). */
  score: number;
  /** True when the prompt contained the node's literal name or directory name. */
  exact: boolean;
}

/**
 * Find workspace nodes mentioned in a prompt, strongest first.
 *
 * A node counts as mentioned when the prompt contains at least one of its
 * IDENTITY words (generic words like "service" never identify a node alone).
 * More specific matches win: contiguous literal names beat word overlap, and a
 * node whose generic words ("service") also appear beats a bare-name sibling.
 *
 * @param ctx - The workspace context.
 * @param prompt - The raw prompt.
 * @returns Mentions sorted by descending score.
 */
export function findNodeMentions(ctx: WorkspaceContext, prompt: string): NodeMention[] {
  if (ctx.nodes.length === 0) return [];
  const lower = prompt.toLowerCase();
  const promptStems = new Set(words(prompt).map(stem));
  const mentions: NodeMention[] = [];

  for (const node of ctx.nodes) {
    const { identity, generic } = nodeIdentityStems(node);
    const matched = identity.filter(s => promptStems.has(s));
    if (matched.length === 0) continue;
    const coverage = matched.length / identity.length;
    // The prompt names the node in full when every word of its name appears.
    const nameWords = Array.from(new Set(words(unscoped(node.name)).map(stem)));
    const fullName = nameWords.length > 0 && nameWords.every(w => promptStems.has(w));
    const literal = unscoped(node.name).toLowerCase();
    const exact =
      fullName ||
      lower.includes(node.name.toLowerCase()) ||
      (/[-/.]/.test(literal) && lower.includes(literal));
    const genericBonus = generic.some(g => promptStems.has(g)) ? 0.25 : 0;
    const score =
      matched.length +
      coverage * 0.5 +
      genericBonus +
      (exact ? 2 : 0) +
      (fullName ? nameWords.length * 0.1 : 0);
    mentions.push({ node, matched, coverage, score, exact });
  }
  return mentions.sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name));
}

/** Result of resolving a model-supplied value to a real node. */
export interface NodeResolution {
  node?: WorkspaceNode;
  /** Plausible nodes when the value is ambiguous or only fuzzily matched. */
  candidates: WorkspaceNode[];
  /** How the value matched. */
  how: 'exact' | 'path' | 'basename' | 'unscoped' | 'words' | 'fuzzy' | 'none';
}

/**
 * Resolve a value (as a model or a user wrote it) to a real workspace node.
 * Strategies, strongest first: exact name, relative path, directory basename,
 * unscoped name, whole-word overlap, then single-edit fuzzy match. A strategy
 * only resolves when it yields exactly one node; otherwise the nodes it found
 * are returned as `candidates`.
 *
 * @param ctx - The workspace context.
 * @param value - The raw value, e.g. `payments` or `@acme/payments`.
 * @returns The resolution.
 */
export function resolveNodeValue(ctx: WorkspaceContext, value: string): NodeResolution {
  const v = value.toLowerCase().replace(/\/+$/, '');
  const strategies: Array<[NodeResolution['how'], (n: WorkspaceNode) => boolean]> = [
    ['exact', n => n.name.toLowerCase() === v],
    ['path', n => n.path.toLowerCase() === v],
    ['basename', n => path.posix.basename(n.path).toLowerCase() === v],
    ['unscoped', n => unscoped(n.name).toLowerCase() === v],
    [
      'words',
      n => {
        const want = words(v).map(stem);
        if (want.length === 0) return false;
        const have = new Set([
          ...words(unscoped(n.name)).map(stem),
          ...words(path.posix.basename(n.path)).map(stem),
        ]);
        return want.every(w => have.has(w));
      },
    ],
    [
      'fuzzy',
      n =>
        v.length >= 5 &&
        (editDistance(v, unscoped(n.name).toLowerCase(), 1) <= 1 ||
          editDistance(v, path.posix.basename(n.path).toLowerCase(), 1) <= 1),
    ],
  ];

  for (const [how, test] of strategies) {
    const hits = ctx.nodes.filter(test);
    if (hits.length === 1) return { node: hits[0], candidates: hits, how };
    if (hits.length > 1) return { candidates: hits, how };
  }
  return { candidates: [], how: 'none' };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

/** Options for {@link renderWorkspaceContext}. */
export interface RenderContextOptions {
  /** Prompt used to prioritise relevant nodes when the workspace is large. */
  prompt?: string;
  maxNodes?: number;
  maxChars?: number;
}

function listCapped(items: readonly string[], cap = 6): string {
  if (items.length <= cap) return items.join(',');
  return `${items.slice(0, cap).join(',')},+${items.length - cap}`;
}

/**
 * Render a compact, size-capped description of the workspace for an LLM
 * prompt. Nodes the prompt mentions come first, so a large workspace never
 * crowds out the nodes that matter.
 *
 * @param ctx - The workspace context.
 * @param options - Rendering limits and the prompt used for prioritisation.
 * @returns A multi-line string (empty when the context has no nodes).
 */
export function renderWorkspaceContext(
  ctx: WorkspaceContext,
  options: RenderContextOptions = {}
): string {
  if (ctx.nodes.length === 0) return '';
  const maxNodes = options.maxNodes ?? 60;
  const maxChars = options.maxChars ?? 6000;

  const mentioned = new Map<string, number>();
  if (options.prompt) {
    findNodeMentions(ctx, options.prompt).forEach((m, i) => mentioned.set(m.node.name, i));
  }
  const ordered = [...ctx.nodes].sort((a, b) => {
    const ra = mentioned.get(a.name) ?? Infinity;
    const rb = mentioned.get(b.name) ?? Infinity;
    return ra - rb || a.name.localeCompare(b.name);
  });

  const lines = [
    `workspace "${ctx.name}" (package manager: ${ctx.packageManager}, ${ctx.nodes.length} nodes)`,
  ];
  let used = lines[0].length;
  let shown = 0;
  for (const n of ordered) {
    if (shown >= maxNodes) break;
    const parts = [`- ${n.name} [${n.kind}] path=${n.path}`];
    if (n.language) parts.push(`lang=${n.language}`);
    if (n.framework) parts.push(`framework=${n.framework}`);
    if (n.port) parts.push(`port=${n.port}`);
    if (n.dependencies.length) parts.push(`deps=${listCapped(n.dependencies)}`);
    if (n.dependents.length) parts.push(`used-by=${listCapped(n.dependents)}`);
    if (n.scripts.length) parts.push(`scripts=${listCapped(n.scripts, 8)}`);
    if (!n.runnable) parts.push('not-in-run-filter');
    const line = parts.join(' ');
    if (used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
    shown++;
  }
  if (shown < ctx.nodes.length) lines.push(`(+${ctx.nodes.length - shown} more nodes not shown)`);
  return lines.join('\n');
}
