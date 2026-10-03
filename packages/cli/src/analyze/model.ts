/**
 * Builds the workspace model the analysis rules run over: packages and their
 * dependency graph (from package.json files), plus deployable services parsed
 * from docker-compose and Kubernetes manifests. Everything is derived from
 * files on disk; nothing is assumed.
 */
import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import * as YAML from 'yaml';
import type {
  DeclaredDependency,
  DependencyEdge,
  DepSection,
  PackageKind,
  ServiceModel,
  WorkspaceModel,
  WorkspacePackage,
} from './types';

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**', '**/.next/**', '**/.turbo/**'];
const DEP_SECTIONS: DepSection[] = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
/** Sections that create a build-time/runtime coupling worth drawing as a graph edge. */
const EDGE_SECTIONS: DepSection[] = ['dependencies', 'devDependencies', 'optionalDependencies'];

export const posix = (p: string): string => p.split(path.sep).join('/');

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readJson(file: string): { value: any; text: string } | null {
  const text = readText(file);
  if (text === null) return null;
  try {
    return { value: JSON.parse(text), text };
  } catch {
    return null;
  }
}

/** Workspace globs from package.json `workspaces`, pnpm-workspace.yaml, or conventional dirs. */
export function workspaceGlobs(root: string): string[] {
  const globs: string[] = [];
  const rootPkg = readJson(path.join(root, 'package.json'))?.value;
  const ws = rootPkg?.workspaces;
  if (Array.isArray(ws)) globs.push(...ws);
  else if (ws && Array.isArray(ws.packages)) globs.push(...ws.packages);

  const pnpm = readText(path.join(root, 'pnpm-workspace.yaml'));
  if (pnpm) {
    try {
      const parsed = YAML.parse(pnpm);
      if (Array.isArray(parsed?.packages)) globs.push(...parsed.packages);
    } catch {
      /* malformed pnpm-workspace.yaml: fall through to conventional dirs */
    }
  }
  if (globs.length === 0) {
    globs.push('apps/*', 'packages/*', 'libs/*', 'services/*', 'tools/*');
  }
  return [...new Set(globs.map(g => String(g).replace(/\/+$/, '')))];
}

export function kindOf(rel: string): PackageKind {
  const first = rel.split('/')[0];
  if (first === 'apps' || first === 'app') return 'app';
  if (first === 'packages' || first === 'libs' || first === 'lib' || first === 'libraries') return 'package';
  if (first === 'services' || first === 'service') return 'service';
  if (first === 'tools' || first === 'tooling') return 'tool';
  return 'unknown';
}

/** Locate each declared dependency's 1-based line within the package.json text. */
function locateDeps(text: string, manifest: Record<string, any>): DeclaredDependency[] {
  const out: DeclaredDependency[] = [];
  const lines = text.split('\n');
  let section: DepSection | null = null;
  const lineOf = new Map<string, number>();
  lines.forEach((line, i) => {
    const open = /^\s*"(dependencies|devDependencies|optionalDependencies|peerDependencies)"\s*:\s*\{/.exec(line);
    if (open) {
      section = open[1] as DepSection;
      return;
    }
    if (section && /^\s*\}/.test(line)) {
      section = null;
      return;
    }
    if (section) {
      const m = /^\s*"([^"]+)"\s*:/.exec(line);
      if (m) lineOf.set(`${section}\u0000${m[1]}`, i + 1);
    }
  });
  for (const sec of DEP_SECTIONS) {
    const block = manifest[sec];
    if (!block || typeof block !== 'object') continue;
    for (const [name, range] of Object.entries(block)) {
      out.push({ name, range: String(range), section: sec, line: lineOf.get(`${sec}\u0000${name}`) ?? 0 });
    }
  }
  return out;
}

export function discoverPackages(root: string): WorkspacePackage[] {
  const patterns = workspaceGlobs(root);
  const positives = patterns.filter(p => !p.startsWith('!')).map(p => `${p.replace(/\/$/, '')}/package.json`);
  const negatives = patterns.filter(p => p.startsWith('!')).map(p => p.slice(1));
  const files = fg.sync(positives, { cwd: root, ignore: [...IGNORE, ...negatives], dot: false, onlyFiles: true });

  const packages: WorkspacePackage[] = [];
  for (const file of files.sort()) {
    const json = readJson(path.join(root, file));
    if (!json || typeof json.value !== 'object' || json.value === null) continue;
    const manifest = json.value;
    const rel = posix(path.dirname(file));
    packages.push({
      name: typeof manifest.name === 'string' && manifest.name ? manifest.name : rel,
      dir: path.join(root, rel),
      rel,
      kind: kindOf(rel),
      manifestFile: file,
      manifest,
      deps: locateDeps(json.text, manifest),
      scripts: manifest.scripts && typeof manifest.scripts === 'object' ? manifest.scripts : {},
      private: manifest.private === true,
    });
  }
  return packages;
}

// ---------------------------------------------------------------------------
// Services (docker-compose + Kubernetes)
// ---------------------------------------------------------------------------

const asArray = <T>(v: T | T[] | undefined | null): T[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

function lineOfNode(node: any, lc: YAML.LineCounter): number {
  const offset = node?.range?.[0];
  return typeof offset === 'number' ? lc.linePos(offset).line : 0;
}

function envEntries(value: unknown, node: any, lc: YAML.LineCounter): ServiceModel['env'] {
  const out: ServiceModel['env'] = [];
  const line = (key: string) => lineOfNode(node?.get?.(key, true), lc) || lineOfNode(node, lc);
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = String(item);
      const eq = s.indexOf('=');
      if (eq > 0) out.push({ key: s.slice(0, eq), value: s.slice(eq + 1), line: lineOfNode(node, lc), fromSecretRef: false });
    }
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push({ key: k, value: v === null || v === undefined ? '' : String(v), line: line(k), fromSecretRef: false });
    }
  }
  return out;
}

function parseCompose(root: string, file: string, text: string): ServiceModel[] {
  const lc = new YAML.LineCounter();
  let doc: YAML.Document.Parsed;
  try {
    doc = YAML.parseDocument(text, { lineCounter: lc });
  } catch {
    return [];
  }
  if (doc.errors.length > 0) return [];
  const services = doc.get('services', true) as any;
  if (!services || !YAML.isMap(services)) return [];

  const out: ServiceModel[] = [];
  for (const pair of services.items as any[]) {
    const name = String(pair.key?.value ?? pair.key);
    const node = pair.value as any;
    const svc = (node?.toJSON?.() ?? {}) as Record<string, any>;
    const hc = svc.healthcheck;
    const limits = svc.deploy?.resources?.limits;
    const replicasRaw = svc.deploy?.replicas ?? svc.scale;
    const dependsRaw = svc.depends_on;
    const dependsNames = Array.isArray(dependsRaw) ? dependsRaw.map(String) : dependsRaw && typeof dependsRaw === 'object' ? Object.keys(dependsRaw) : [];
    out.push({
      id: `docker-compose:${file}:${name}`,
      name,
      source: 'docker-compose',
      file,
      line: lineOfNode(pair.key, lc) || lineOfNode(node, lc),
      images: svc.image ? [String(svc.image)] : [],
      hasHealthcheck: Boolean(hc) && hc.disable !== true && !(Array.isArray(hc?.test) && hc.test[0] === 'NONE'),
      hasResourceLimits: Boolean(limits && (limits.memory || limits.cpus)) || svc.mem_limit !== undefined || svc.cpus !== undefined || svc.cpu_quota !== undefined,
      replicas: typeof replicasRaw === 'number' ? replicasRaw : 1,
      replicasImplicit: typeof replicasRaw !== 'number',
      autoscaled: false,
      dependsOn: dependsNames.map(n => ({ name: n, line: lineOfNode(node?.get?.('depends_on', true), lc) || lineOfNode(pair.key, lc) })),
      env: envEntries(svc.environment, node?.get?.('environment', true), lc),
    });
  }
  return out;
}

const K8S_WORKLOADS = new Set(['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet']);

function parseKubernetes(file: string, text: string): ServiceModel[] {
  const lc = new YAML.LineCounter();
  let docs: YAML.Document.Parsed[];
  try {
    docs = YAML.parseAllDocuments(text, { lineCounter: lc }) as YAML.Document.Parsed[];
  } catch {
    return [];
  }
  const hpaTargets = new Set<string>();
  const workloads: Array<{ svc: ServiceModel; spec: any; kind: string }> = [];

  for (const doc of docs) {
    if (doc.errors.length > 0) continue;
    const obj = doc.toJS() as any;
    if (!obj || typeof obj !== 'object' || typeof obj.kind !== 'string') continue;
    if (obj.kind === 'HorizontalPodAutoscaler') {
      const target = obj.spec?.scaleTargetRef?.name;
      if (target) hpaTargets.add(String(target));
      continue;
    }
    if (!K8S_WORKLOADS.has(obj.kind)) continue;
    const name = String(obj.metadata?.name ?? '');
    if (!name) continue;
    const podSpec = obj.spec?.template?.spec ?? {};
    const containers: any[] = [...asArray(podSpec.containers)];
    const probeless = containers.filter(c => !(c.livenessProbe || c.readinessProbe || c.startupProbe));
    const unlimited = containers.filter(c => !(c.resources?.limits && (c.resources.limits.memory || c.resources.limits.cpu)));
    const rootNode = doc.contents as any;
    const nameLine = lineOfNode(rootNode?.getIn?.(['metadata', 'name'], true), lc) || lineOfNode(rootNode, lc);
    const env: ServiceModel['env'] = [];
    for (const c of containers) {
      for (const e of asArray<any>(c.env)) {
        if (e?.name) env.push({ key: String(e.name), value: e.value === undefined ? '' : String(e.value), line: nameLine, fromSecretRef: Boolean(e.valueFrom) });
      }
    }
    workloads.push({
      kind: obj.kind,
      spec: obj,
      svc: {
        id: `kubernetes:${file}:${obj.kind}/${name}`,
        name,
        source: 'kubernetes',
        kind: obj.kind,
        file,
        line: nameLine,
        images: containers.map(c => String(c.image ?? '')).filter(Boolean),
        hasHealthcheck: containers.length > 0 && probeless.length === 0,
        hasResourceLimits: containers.length > 0 && unlimited.length === 0,
        replicas: obj.kind === 'DaemonSet' ? null : typeof obj.spec?.replicas === 'number' ? obj.spec.replicas : 1,
        replicasImplicit: obj.kind !== 'DaemonSet' && typeof obj.spec?.replicas !== 'number',
        autoscaled: false,
        dependsOn: [],
        env,
      },
    });
  }

  // Infer dependencies from hostnames in env values/args that name another workload in the same file.
  const names = new Set(workloads.map(w => w.svc.name));
  for (const w of workloads) {
    w.svc.autoscaled = hpaTargets.has(w.svc.name);
    const seen = new Set<string>();
    const haystack: Array<{ text: string; line: number }> = w.svc.env.map(e => ({ text: e.value, line: e.line }));
    for (const c of asArray<any>(w.spec.spec?.template?.spec?.containers)) {
      for (const a of [...asArray<any>(c.args), ...asArray<any>(c.command)]) haystack.push({ text: String(a), line: w.svc.line });
    }
    for (const { text: t, line } of haystack) {
      for (const other of names) {
        if (other === w.svc.name || seen.has(other)) continue;
        const re = new RegExp(`(?:^|[/@=\\s])${other.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[:./\\s]|$)`);
        if (re.test(t)) {
          seen.add(other);
          w.svc.dependsOn.push({ name: other, line });
        }
      }
    }
  }
  return workloads.map(w => w.svc);
}

export function discoverServices(root: string): ServiceModel[] {
  const files = fg.sync(['**/*.{yml,yaml}'], { cwd: root, ignore: IGNORE, deep: 6, onlyFiles: true });
  const services: ServiceModel[] = [];
  for (const file of files.sort()) {
    const base = path.basename(file);
    const isCompose = /^(docker-)?compose([.-].+)?\.ya?ml$/.test(base);
    const text = readText(path.join(root, file));
    if (text === null || text.length > 1_500_000) continue;
    if (isCompose) {
      services.push(...parseCompose(root, file, text));
    } else if (/^\s*kind:\s*(Deployment|StatefulSet|DaemonSet|ReplicaSet|HorizontalPodAutoscaler)\b/m.test(text) && /^\s*apiVersion:/m.test(text) && !text.includes('{{')) {
      services.push(...parseKubernetes(file, text));
    }
  }
  return services;
}

// ---------------------------------------------------------------------------

export function buildModel(root: string): WorkspaceModel {
  const packages = discoverPackages(root);
  const byName = new Map(packages.map(p => [p.name, p]));
  const edges: DependencyEdge[] = [];
  const dependents = new Map<string, string[]>();
  const dependencies = new Map<string, string[]>();
  for (const p of packages) {
    dependents.set(p.name, []);
    dependencies.set(p.name, []);
  }
  for (const p of packages) {
    for (const dep of p.deps) {
      if (!EDGE_SECTIONS.includes(dep.section)) continue;
      if (!byName.has(dep.name) || dep.name === p.name) continue;
      edges.push({ from: p.name, to: dep.name, section: dep.section, file: p.manifestFile, line: dep.line });
      if (!dependencies.get(p.name)!.includes(dep.name)) dependencies.get(p.name)!.push(dep.name);
      if (!dependents.get(dep.name)!.includes(p.name)) dependents.get(dep.name)!.push(p.name);
    }
  }
  return { root, packages, byName, edges, dependents, dependencies, services: discoverServices(root) };
}
