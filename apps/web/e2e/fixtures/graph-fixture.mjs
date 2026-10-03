/**
 * Deterministic large-workspace fixture for the graph explorer (P9-L).
 *
 * `buildGraphSpec(count)` returns `count` workspaces laid out like a real
 * monorepo: ~6% apps (`apps/*`) that depend on layered packages (`packages/*`),
 * each layer depending on the next, a mix of production and dev dependencies,
 * several frameworks and languages, one deliberate 3-node dependency cycle,
 * and a handful of services with real ports / health URLs so live status has
 * something to probe.
 *
 * `writeGraphWorkspace(root, spec)` writes it to disk as real package.json files
 * (plus tsconfig.json / go.mod / pyproject.toml markers) so the real CLI, hub
 * and dashboard run over it. No randomness: same input, same graph.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Small deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAMEWORKS = [
  { id: 'react-ts', deps: { react: '^18.0.0' }, dev: { typescript: '^5.0.0' }, language: 'typescript' },
  { id: 'vue-ts', deps: { vue: '^3.4.0' }, dev: { typescript: '^5.0.0' }, language: 'typescript' },
  { id: 'svelte', deps: { svelte: '^4.0.0' }, dev: {}, language: 'javascript' },
  { id: 'angular', deps: { '@angular/core': '^17.0.0' }, dev: {}, language: 'javascript' },
  { id: null, deps: {}, dev: {}, language: 'javascript' },
  { id: null, deps: {}, dev: { typescript: '^5.0.0' }, language: 'typescript' },
];

/**
 * @param {number} count total workspaces (apps + packages)
 * @param {{ healthyPort?: number, closedPorts?: number[], unhealthyPort?: number }} [ports]
 *   ports for the handful of services that carry a real health config:
 *   `healthyPort` answers 200, `unhealthyPort` is open but answers 500,
 *   `closedPorts` have nothing listening.
 */
export function buildGraphSpec(count, ports = {}) {
  const rand = rng(20260);
  const appCount = Math.max(1, Math.round(count * 0.06));
  const pkgCount = Math.max(0, count - appCount);
  const LAYERS = Math.max(1, Math.min(8, Math.ceil(Math.sqrt(pkgCount) / 6)));
  const perLayer = Math.max(1, Math.ceil(pkgCount / LAYERS));

  const pad = (n) => String(n).padStart(4, '0');
  const pkgs = [];
  for (let i = 0; i < pkgCount; i++) {
    const layer = Math.min(LAYERS - 1, Math.floor(i / perLayer));
    pkgs.push({ name: `@fx/pkg-${pad(i)}`, dir: `packages/pkg-${pad(i)}`, layer, kind: 'package', deps: [], devDeps: [] });
  }
  const byLayer = Array.from({ length: LAYERS }, () => []);
  for (const p of pkgs) byLayer[p.layer].push(p);

  // Package layer k depends on 1-3 packages of layer k+1 (so the graph is a layered DAG).
  for (const p of pkgs) {
    const next = byLayer[p.layer + 1];
    if (!next || next.length === 0) continue;
    const n = 1 + Math.floor(rand() * 3);
    const chosen = new Set();
    for (let k = 0; k < n; k++) chosen.add(next[Math.floor(rand() * next.length)].name);
    for (const name of chosen) (rand() < 0.15 ? p.devDeps : p.deps).push(name);
  }

  const apps = [];
  for (let i = 0; i < appCount; i++) {
    const app = { name: `@fx/app-${pad(i)}`, dir: `apps/app-${pad(i)}`, layer: -1, kind: 'app', deps: [], devDeps: [] };
    const n = 2 + Math.floor(rand() * 4);
    const chosen = new Set();
    for (let k = 0; k < n && byLayer[0].length > 0; k++) chosen.add(byLayer[0][Math.floor(rand() * byLayer[0].length)].name);
    for (const name of chosen) (rand() < 0.1 ? app.devDeps : app.deps).push(name);
    apps.push(app);
  }

  const all = [...apps, ...pkgs];

  // One deliberate cycle among three deep packages: a -> b -> c -> a.
  if (pkgs.length >= 3 && LAYERS >= 2) {
    const last = byLayer[LAYERS - 1];
    if (last.length >= 3) {
      const [a, b, c] = last.slice(0, 3);
      a.deps.push(b.name);
      b.deps.push(c.name);
      c.deps.push(a.name);
    }
  }

  // Frameworks and languages (deterministic by index, apps skew to frameworks).
  all.forEach((w, i) => {
    const fw = w.kind === 'app' ? FRAMEWORKS[i % 4] : FRAMEWORKS[(i * 7) % FRAMEWORKS.length];
    w.framework = fw;
    w.marker = null;
    if (w.kind === 'package' && i % 31 === 0) w.marker = 'go.mod';
    else if (w.kind === 'package' && i % 47 === 0) w.marker = 'pyproject.toml';
    else if (fw.language === 'typescript') w.marker = 'tsconfig.json';
  });

  // A few apps carry real service config so live status has something to probe.
  const services = [];
  const closed = ports.closedPorts ?? [];
  if (ports.healthyPort) services.push({ app: apps[0], port: ports.healthyPort, healthUrl: `http://127.0.0.1:${ports.healthyPort}/health` });
  if (ports.unhealthyPort && apps[1]) services.push({ app: apps[1], port: ports.unhealthyPort, healthUrl: `http://127.0.0.1:${ports.unhealthyPort}/health` });
  closed.forEach((port, i) => {
    const app = apps[2 + i];
    if (app) services.push({ app, port, healthUrl: `http://127.0.0.1:${port}/health` });
  });
  for (const s of services) s.app.service = { port: s.port, healthUrl: s.healthUrl };

  return all;
}

/** Write the spec as a real pnpm-style monorepo under `root`. */
export function writeGraphWorkspace(root, spec) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'graph-fixture', private: true, version: '0.0.0' }, null, 2)
  );
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n  - 'packages/*'\n");

  for (const w of spec) {
    const dir = path.join(root, w.dir);
    fs.mkdirSync(dir, { recursive: true });
    const dependencies = { ...(w.framework?.deps ?? {}) };
    const devDependencies = { ...(w.framework?.dev ?? {}) };
    for (const d of w.deps) dependencies[d] = 'workspace:*';
    for (const d of w.devDeps) devDependencies[d] = 'workspace:*';
    const pkg = {
      name: w.name,
      version: '1.0.0',
      private: true,
      dependencies,
      devDependencies,
    };
    if (w.service) {
      pkg.scripts = { dev: `node server.js --port ${w.service.port}` };
      pkg['re-shell'] = { services: { dev: { port: w.service.port, healthUrl: w.service.healthUrl } } };
    }
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    if (w.marker === 'tsconfig.json') fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}\n');
    else if (w.marker === 'go.mod') fs.writeFileSync(path.join(dir, 'go.mod'), `module example.com/${w.name.replace('@fx/', '')}\n`);
    else if (w.marker === 'pyproject.toml') fs.writeFileSync(path.join(dir, 'pyproject.toml'), `[project]\nname = "${w.name.replace('@fx/', '')}"\n`);
  }
}

/** Summary used by tests to assert what the generator promises. */
export function describeSpec(spec) {
  const edges = spec.reduce((n, w) => n + w.deps.length + w.devDeps.length, 0);
  return { nodes: spec.length, apps: spec.filter((w) => w.kind === 'app').length, edges };
}
