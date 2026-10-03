/**
 * Analysis rules. Each rule inspects the workspace model (package graph,
 * services) and files on disk and returns findings with evidence (file:line or
 * a graph path) and a concrete recommendation. Nothing here is templated: a
 * finding exists only when the files show the problem.
 */
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import fg from 'fast-glob';
import { isSecretName, SECRET_VALUE_PATTERNS } from '../audit/redact';
import { posix } from './model';
import type {
  AnalysisType,
  DependencyEdge,
  Evidence,
  Finding,
  ServiceModel,
  Severity,
  WorkspaceModel,
  WorkspacePackage,
} from './types';

const IGNORE = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/coverage/**', '**/.next/**', '**/.turbo/**', '**/out/**'];

function finding(
  type: AnalysisType,
  ruleId: string,
  subject: string,
  severity: Severity,
  title: string,
  message: string,
  evidence: Evidence[],
  recommendation: string
): Finding {
  return { id: `${ruleId}:${subject}`, ruleId, type, severity, title, message, evidence, recommendation };
}

/**
 * Credential-shaped patterns suitable for scanning SOURCE files. The generic
 * `Bearer <word>` pattern is excluded: in source it overwhelmingly matches auth
 * scheme names and documentation, not secrets (it stays enabled for argv
 * redaction where a literal bearer token is far more likely). A bare
 * `-----BEGIN ... PRIVATE KEY-----` header is excluded too (templates and docs
 * mention it); actual key material is detected by {@link findPrivateKeyBlock}.
 */
const SOURCE_PATTERNS = SECRET_VALUE_PATTERNS.filter(p => !p.source.includes('Bearer') && !p.source.includes('PRIVATE KEY')).map(
  p => new RegExp(p.source, p.flags.replace('g', ''))
);
const EXAMPLE_VALUE = /example|placeholder|xxxx|your[-_ ]|dummy|sample|fake/i;

/** The first credential-shaped (and not obviously example) match in a line, or null. */
export function findCredentialInLine(line: string): string | null {
  for (const re of SOURCE_PATTERNS) {
    const m = re.exec(line);
    if (m && !EXAMPLE_VALUE.test(m[0])) return m[0];
  }
  return null;
}

const PRIVATE_KEY_BLOCK = /-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[\r\n]+\s*[A-Za-z0-9+/=]{40,}/;

/** 1-based line of the first real private-key block (header followed by key material), or 0. */
export function findPrivateKeyBlock(text: string): number {
  const m = PRIVATE_KEY_BLOCK.exec(text);
  return m ? text.slice(0, m.index).split('\n').length : 0;
}

const TEST_PATH = /(^|\/)(tests?|__tests__|__mocks__|fixtures?|mocks?|examples?|e2e)\/|\.(test|spec)\.[a-z]+$/i;

/** First 4 characters then asterisks: enough to identify, never the secret. */
export function mask(value: string): string {
  if (value.length <= 4) return '****';
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(12, value.length - 4))}`;
}

// ===========================================================================
// architecture
// ===========================================================================

/** Tarjan strongly-connected components over the package graph. */
function stronglyConnected(nodes: string[], adj: Map<string, string[]>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const on = new Set<string>();
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const out: string[][] = [];
  const visit = (v: string): void => {
    idx.set(v, index);
    low.set(v, index);
    index++;
    stack.push(v);
    on.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (on.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        on.delete(w);
        comp.push(w);
      } while (w !== v);
      out.push(comp);
    }
  };
  for (const n of nodes) if (!idx.has(n)) visit(n);
  return out;
}

/** A concrete cycle `[a, b, c, a]` inside a strongly connected component. */
function cycleWithin(component: string[], adj: Map<string, string[]>): string[] {
  const members = new Set(component);
  const start = [...component].sort()[0];
  const pathSoFar: string[] = [start];
  const visited = new Set<string>([start]);
  const dfs = (v: string): boolean => {
    for (const w of [...(adj.get(v) ?? [])].filter(x => members.has(x)).sort()) {
      if (w === start) {
        pathSoFar.push(start);
        return true;
      }
      if (visited.has(w)) continue;
      visited.add(w);
      pathSoFar.push(w);
      if (dfs(w)) return true;
      pathSoFar.pop();
    }
    return false;
  };
  dfs(start);
  return pathSoFar;
}

const PLACEHOLDER_TEST = /no test specified|exit 1\s*$/i;

function hasTestScript(pkg: WorkspacePackage): boolean {
  const t = pkg.scripts.test;
  return typeof t === 'string' && t.trim() !== '' && !PLACEHOLDER_TEST.test(t);
}

const SOURCE_GLOB = '**/*.{ts,tsx,js,jsx,mjs,cjs,py,go,rs,java,cs,rb,php}';
const TEST_FILE = /(\.(test|spec)\.[a-z]+$)|(^|\/)(__tests__|tests?|spec)\/|(^|\/)test_[^/]+\.py$|_test\.go$/i;
const CONFIG_FILE = /(^|\/)[\w.-]*(\.config|\.setup|rc)\.[cm]?[jt]s$/i;

function sourceFiles(pkg: WorkspacePackage): { source: string[]; tests: string[] } {
  const files = fg.sync(SOURCE_GLOB, { cwd: pkg.dir, ignore: [...IGNORE, '**/*.d.ts', '**/*.min.js'], onlyFiles: true });
  const tests = files.filter(f => TEST_FILE.test(f));
  const source = files.filter(f => !TEST_FILE.test(f) && !CONFIG_FILE.test(f));
  return { source, tests };
}

export function architectureFindings(model: WorkspaceModel): Finding[] {
  const out: Finding[] = [];
  const names = model.packages.map(p => p.name).sort();

  // --- dependency cycles -----------------------------------------------------
  const adj = model.dependencies;
  for (const comp of stronglyConnected(names, adj)) {
    if (comp.length < 2) continue;
    const members = new Set(comp);
    const cycle = cycleWithin(comp, adj);
    const cycleEdges: DependencyEdge[] = [];
    for (let i = 0; i < cycle.length - 1; i++) {
      const edge =
        model.edges.find(e => e.from === cycle[i] && e.to === cycle[i + 1] && e.section === 'dependencies') ??
        model.edges.find(e => e.from === cycle[i] && e.to === cycle[i + 1]);
      if (edge) cycleEdges.push(edge);
    }
    const runtime = cycleEdges.some(e => e.section !== 'devDependencies');
    out.push(
      finding(
        'architecture',
        'arch.dependency-cycle',
        [...members].sort().join('>'),
        runtime ? 'high' : 'medium',
        `Dependency cycle between ${comp.length} packages`,
        `Packages ${[...members].sort().join(', ')} depend on each other, so none can be built, versioned or tested in isolation.`,
        [
          { kind: 'graph', path: cycle, detail: `cycle: ${cycle.join(' -> ')}` },
          ...cycleEdges.map(e => ({
            kind: 'file' as const,
            file: e.file,
            ...(e.line ? { line: e.line } : {}),
            detail: `${e.from} declares ${e.to} in ${e.section}`,
          })),
        ],
        `Break the cycle: extract the code that ${cycle[0]} and ${cycle[1]} share into a new lower-level package, or invert one dependency (for example with an interface/event passed in by the caller).`
      )
    );
  }

  // --- layering ---------------------------------------------------------------
  for (const e of model.edges) {
    const from = model.byName.get(e.from)!;
    const to = model.byName.get(e.to)!;
    if (from.kind === 'app' && to.kind === 'app') {
      out.push(
        finding(
          'architecture',
          'arch.layering-app-depends-on-app',
          `${e.from}->${e.to}`,
          'high',
          `App "${e.from}" depends on app "${e.to}"`,
          'Apps are deployment roots; depending on another app couples release cycles and drags application code into this bundle.',
          [
            { kind: 'file', file: e.file, ...(e.line ? { line: e.line } : {}), detail: `${e.from} -> ${e.to} (${e.section})` },
            { kind: 'graph', path: [e.from, e.to], detail: `${from.rel} -> ${to.rel}` },
          ],
          `Move what ${e.from} needs from ${e.to} into a shared package under packages/ and depend on that instead.`
        )
      );
    } else if (from.kind === 'package' && to.kind === 'app') {
      out.push(
        finding(
          'architecture',
          'arch.layering-package-depends-on-app',
          `${e.from}->${e.to}`,
          'high',
          `Package "${e.from}" depends on app "${e.to}"`,
          'Libraries must sit below applications in the dependency direction; this inverts the layering and makes the library unusable without the app.',
          [
            { kind: 'file', file: e.file, ...(e.line ? { line: e.line } : {}), detail: `${e.from} -> ${e.to} (${e.section})` },
            { kind: 'graph', path: [e.from, e.to], detail: `${from.rel} -> ${to.rel}` },
          ],
          `Extract the shared code from ${e.to} into a package that both can depend on, then remove ${e.to} from ${e.from}'s package.json.`
        )
      );
    }
  }

  // --- fan-in / fan-out hotspots -----------------------------------------------
  const n = model.packages.length;
  for (const p of model.packages) {
    const fanIn = model.dependents.get(p.name)!.length;
    const fanOut = model.dependencies.get(p.name)!.length;
    if (fanIn >= Math.max(4, Math.ceil((n - 1) / 2))) {
      out.push(
        finding(
          'architecture',
          'arch.fan-in-hotspot',
          p.name,
          fanIn >= 15 ? 'high' : fanIn >= 8 ? 'medium' : 'low',
          `"${p.name}" is depended on by ${fanIn} packages`,
          `A change to ${p.name} can break ${fanIn} of ${n - 1} other packages; it is the workspace's blast-radius hotspot.`,
          [
            { kind: 'graph', path: [...model.dependents.get(p.name)!.slice().sort(), p.name], detail: `fan-in ${fanIn}: ${model.dependents.get(p.name)!.slice().sort().join(', ')}` },
            { kind: 'file', file: p.manifestFile, detail: 'package manifest' },
          ],
          `Keep ${p.name} small and stable: split unrelated exports into separate packages, add contract tests, and gate changes with \`re-shell workspace impact analyze\`.`
        )
      );
    }
    if (fanOut >= 8) {
      out.push(
        finding(
          'architecture',
          'arch.fan-out-hotspot',
          p.name,
          fanOut >= 15 ? 'high' : 'medium',
          `"${p.name}" depends on ${fanOut} workspace packages`,
          `${p.name} is coupled to ${fanOut} internal packages, so it is rebuilt and retested whenever any of them changes.`,
          [
            { kind: 'graph', path: [p.name, ...model.dependencies.get(p.name)!.slice().sort()], detail: `fan-out ${fanOut}: ${model.dependencies.get(p.name)!.slice().sort().join(', ')}` },
            { kind: 'file', file: p.manifestFile, detail: 'package manifest' },
          ],
          `Introduce a facade package or split ${p.name} so each part depends only on the packages it uses.`
        )
      );
    }
  }

  // --- missing tests -------------------------------------------------------------
  for (const p of model.packages) {
    const { source, tests } = sourceFiles(p);
    if (source.length === 0) continue; // nothing to test
    if (tests.length > 0 || hasTestScript(p)) continue;
    const big = source.length >= 5;
    out.push(
      finding(
        'architecture',
        'arch.missing-tests',
        p.name,
        p.kind === 'app' || p.kind === 'service' ? 'medium' : big ? 'medium' : 'low',
        `"${p.name}" has no tests`,
        `${source.length} source file(s) in ${p.rel} and neither test files nor a real "test" script were found.`,
        [
          { kind: 'file', file: p.manifestFile, detail: p.scripts.test ? `scripts.test is a placeholder: ${p.scripts.test}` : 'no "test" script declared' },
          { kind: 'file', file: posix(path.join(p.rel, source[0])), detail: `e.g. untested source (${source.length} source files, 0 test files)` },
        ],
        `Add a test runner script ("test") and at least smoke tests for ${p.name}'s public API; wire it into \`re-shell run test\`.`
      )
    );
  }
  return out;
}

// ===========================================================================
// security
// ===========================================================================

const PLACEHOLDER_VALUE = /^(?:|\s*|changeme|change[-_]me|replace[-_]?me|your[-_ ].*|<.*>|\$\{.*\}|\$[A-Z_]+|x{3,}|\*{3,}|todo|null|none|false|true|undefined|example|dummy|secret|password|test|\.{3})$/i;

function isPlaceholder(value: string): boolean {
  const v = value.trim().replace(/^['"]|['"]$/g, '');
  return PLACEHOLDER_VALUE.test(v) || v.length < 4;
}

function isIgnoredByGit(root: string, rel: string): boolean | null {
  try {
    const res = spawnSync('git', ['check-ignore', '-q', '--', rel], { cwd: root, timeout: 5000 });
    if (res.error) return null;
    if (res.status === 0) return true;
    if (res.status === 1) return false;
    return null; // 128: not a git repository
  } catch {
    return null;
  }
}

function gitignoreFallback(root: string, rel: string): boolean {
  const base = path.posix.basename(rel);
  let dir = path.dirname(path.join(root, rel));
  for (let i = 0; i < 6; i++) {
    try {
      const text = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
      for (const raw of text.split('\n')) {
        const line = raw.trim().replace(/^\/+/, '');
        if (!line || line.startsWith('#') || line.startsWith('!')) continue;
        const re = new RegExp('^' + line.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.') + '/?$');
        if (re.test(base)) return true;
      }
    } catch {
      /* no .gitignore here */
    }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return false;
}

const ENV_FILE = /^\.env(\..+)?$|\.env$/;
const ENV_TEMPLATE = /\.(example|sample|template|dist|defaults?)$/i;

function secretFindingFromKV(
  key: string,
  value: string
): { reason: string; credentialShaped: boolean } | null {
  const urlCred = /^[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:([^\s/@]+)@/i.exec(value);
  if (urlCred && !isPlaceholder(urlCred[1])) return { reason: 'URL with an embedded password', credentialShaped: true };
  const shaped = findCredentialInLine(value) !== null || /^Bearer\s+\S{12,}$/i.test(value.trim());
  if (shaped) return { reason: 'value matches a known credential format', credentialShaped: true };
  if (isSecretName(key) && !isPlaceholder(value)) return { reason: `"${key}" looks like a secret and has a literal value`, credentialShaped: false };
  return null;
}

const TOKEN_EXT = '{ts,tsx,js,jsx,mjs,cjs,json,yml,yaml,py,go,rb,java,properties,toml,ini,sh,tf,php,cs}';

export function securityFindings(model: WorkspaceModel): Finding[] {
  const out: Finding[] = [];
  const root = model.root;

  // --- secrets in env files ---------------------------------------------------
  const envFiles = fg
    .sync(['**/.env', '**/.env.*', '**/*.env'], { cwd: root, ignore: IGNORE, dot: true, onlyFiles: true, deep: 6 })
    .filter(f => ENV_FILE.test(path.posix.basename(f)) && !ENV_TEMPLATE.test(f))
    .sort();
  for (const file of envFiles) {
    let text: string;
    try {
      text = fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
      continue;
    }
    const ignored = isIgnoredByGit(root, file) ?? gitignoreFallback(root, file);
    text.split('\n').forEach((raw, i) => {
      const line = raw.replace(/^\s*export\s+/, '').trim();
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq <= 0) return;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      const hit = secretFindingFromKV(key, value);
      if (!hit) return;
      out.push(
        finding(
          'security',
          'sec.secret-in-env-file',
          `${file}:${key}`,
          !ignored || hit.credentialShaped ? 'critical' : 'high',
          `Secret "${key}" in ${file}${ignored ? '' : ' (not gitignored)'}`,
          `${hit.reason}. The value (${mask(value)}) is stored in plain text${ignored ? ' in a git-ignored file' : ' in a file that git does not ignore, so it can be committed'}.`,
          [
            { kind: 'file', file, line: i + 1, detail: `${key}=${mask(value)}` },
            { kind: 'config', file: '.gitignore', detail: ignored ? 'file is ignored by git' : 'file is NOT ignored by git' },
          ],
          ignored
            ? `Move ${key} to a secret manager (or CI/CD secret store), keep only a ${path.posix.basename(file)}.example with placeholders in git, and rotate the value if it ever left this machine.`
            : `Add ${path.posix.basename(file)} to .gitignore immediately, remove it from git history if committed (git rm --cached), rotate ${key}, and keep only a .example file with placeholders.`
        )
      );
    });
  }

  // --- secrets inlined in compose / Kubernetes env -------------------------------
  for (const svc of model.services) {
    for (const e of svc.env) {
      if (e.fromSecretRef) continue;
      const hit = secretFindingFromKV(e.key, e.value);
      if (!hit) continue;
      out.push(
        finding(
          'security',
          'sec.secret-in-service-env',
          `${svc.id}:${e.key}`,
          'high',
          `Literal secret "${e.key}" in ${svc.source} service "${svc.name}"`,
          `${hit.reason}. The value (${mask(e.value)}) is committed in ${svc.file}.`,
          [{ kind: 'file', file: svc.file, ...(e.line ? { line: e.line } : {}), detail: `${svc.name}: ${e.key}=${mask(e.value)}` }],
          svc.source === 'kubernetes'
            ? `Reference a Kubernetes Secret with valueFrom.secretKeyRef (or an external secret operator) instead of a literal value for ${e.key}.`
            : `Use \`environment: - ${e.key}\` with the value supplied from an untracked .env file or Docker/Compose secrets instead of a literal.`
        )
      );
    }
  }

  // --- credential patterns in source ---------------------------------------------
  const sourceFilesToScan = fg
    .sync([`**/*.${TOKEN_EXT}`], { cwd: root, ignore: [...IGNORE, '**/*.min.js', '**/package-lock.json', '**/pnpm-lock.yaml', '**/*.lock', '**/.env*'], onlyFiles: true, deep: 8 })
    .sort()
    .slice(0, 4000);
  const seenInFile = new Set<string>();
  for (const file of sourceFilesToScan) {
    let text: string;
    try {
      const stat = fs.statSync(path.join(root, file));
      if (stat.size > 300_000) continue;
      text = fs.readFileSync(path.join(root, file), 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    const inTests = TEST_PATH.test(file);
    const report = (line: number, hit: string): void => {
      const key = `${file}:${line}`;
      if (seenInFile.has(key)) return;
      seenInFile.add(key);
      out.push(
        finding(
          'security',
          'sec.credential-in-source',
          key,
          inTests ? 'low' : 'critical',
          `Credential-shaped value in ${file}:${line}`,
          `The string ${mask(hit)} matches a well-known credential format and is committed to source${inTests ? ' (in a test/fixture path: confirm it is fake)' : ''}.`,
          [{ kind: 'file', file, line, detail: `matches credential pattern (${mask(hit)})` }],
          inTests
            ? 'Confirm this is synthetic test data and make that obvious (for example an EXAMPLE/fake marker); if it is real, revoke and rotate it.'
            : 'Revoke and rotate the credential, remove it from the file and history, and load it from the environment or a secret manager at runtime. If it is test data, replace it with an obviously fake value.'
        )
      );
    };
    for (let i = 0; i < lines.length; i++) {
      const hit = findCredentialInLine(lines[i]);
      if (hit) report(i + 1, hit);
    }
    const pk = findPrivateKeyBlock(text);
    if (pk > 0) report(pk, '-----BEGIN PRIVATE KEY-----');
  }

  // --- unpinned dependency ranges --------------------------------------------------
  for (const p of model.packages) {
    for (const d of p.deps) {
      if (d.section === 'peerDependencies') continue;
      if (model.byName.has(d.name)) continue; // workspace protocol / local links are intentional
      const why = unpinnedReason(d.range);
      if (!why) continue;
      out.push(
        finding(
          'security',
          'sec.unpinned-dependency',
          `${p.name}:${d.name}`,
          d.section === 'dependencies' ? 'medium' : 'low',
          `Unpinned dependency "${d.name}@${d.range}" in ${p.name}`,
          `${why}. Installs are not reproducible and any new release (including a compromised one) is pulled in automatically.`,
          [{ kind: 'file', file: p.manifestFile, ...(d.line ? { line: d.line } : {}), detail: `${d.section}.${d.name} = "${d.range}"` }],
          `Pin ${d.name} to an exact version or a bounded range (for example ^x.y.z), and commit the lockfile.`
        )
      );
    }
  }

  // --- no lockfile --------------------------------------------------------------------
  if (model.packages.length > 0) {
    const lock = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json', 'bun.lockb'].find(f => fs.existsSync(path.join(root, f)));
    if (!lock) {
      out.push(
        finding(
          'security',
          'sec.no-lockfile',
          'root',
          'medium',
          'No dependency lockfile at the workspace root',
          'Without a lockfile, every install can resolve different transitive versions, which defeats pinning and supply-chain review.',
          [{ kind: 'config', file: 'package.json', detail: 'no pnpm-lock.yaml, yarn.lock, package-lock.json or bun.lockb found' }],
          'Run your package manager install once and commit the generated lockfile; install with --frozen-lockfile (or ci) in CI.'
        )
      );
    }
  }

  // --- unpinned container images ----------------------------------------------------------
  for (const svc of model.services) {
    for (const image of svc.images) {
      const tag = imageTag(image);
      if (tag === null || tag === 'latest') {
        out.push(
          finding(
            'security',
            'sec.unpinned-image',
            `${svc.id}:${image}`,
            'medium',
            `Image "${image}" is not pinned (${svc.name})`,
            tag === null ? 'No tag means `latest` is pulled.' : 'The `latest` tag moves, so deployments are not reproducible.',
            [{ kind: 'file', file: svc.file, ...(svc.line ? { line: svc.line } : {}), detail: `${svc.name}: image ${image}` }],
            `Pin ${image.split(':')[0]} to a specific version tag or, better, a digest (image@sha256:...).`
          )
        );
      }
    }
  }
  return out;
}

function imageTag(image: string): string | null {
  if (image.includes('@sha256:')) return 'digest';
  const last = image.split('/').pop()!;
  const idx = last.indexOf(':');
  return idx === -1 ? null : last.slice(idx + 1);
}

function unpinnedReason(range: string): string | null {
  const r = range.trim();
  if (r === '' || r === '*' || r === 'x' || r === 'X') return `Range "${r || '(empty)'}" accepts any version`;
  if (/^(latest|next|beta|alpha|canary|rc)$/i.test(r)) return `Dist-tag "${r}" always resolves to a moving target`;
  if (/^(>=|>)\s*[\d.]+\s*$/.test(r)) return `Range "${r}" has no upper bound`;
  if (/^(git\+|git:|github:|https?:\/\/)/i.test(r) && !/#[0-9a-f]{7,40}$/i.test(r) && !/#semver:/i.test(r) && !/\.tgz$/i.test(r)) {
    return `Git/URL dependency "${r}" is not pinned to a commit`;
  }
  return null;
}

// ===========================================================================
// performance
// ===========================================================================

const HEAVY_DEPENDENCIES: Record<string, { why: string; instead: string }> = {
  moment: { why: 'moment is ~290KB minified with locales and cannot be tree-shaken', instead: 'dayjs or date-fns' },
  'moment-timezone': { why: 'moment-timezone bundles the full tz database', instead: 'Intl.DateTimeFormat, date-fns-tz or luxon' },
  lodash: { why: 'importing the CommonJS lodash bundle defeats tree-shaking', instead: 'lodash-es or per-method imports (lodash/get)' },
  'aws-sdk': { why: 'AWS SDK v2 is a monolithic ~60MB package', instead: 'modular @aws-sdk/client-* packages (v3)' },
  '@mui/icons-material': { why: 'barrel imports of the icon set can pull thousands of modules', instead: 'path imports (@mui/icons-material/Add)' },
  'core-js': { why: 'a full core-js polyfill bundle is rarely needed on modern targets', instead: 'targeted polyfills via browserslist / useBuiltIns: "usage"' },
};

function normalizeRange(range: string): string {
  return range.trim();
}

function majorOf(range: string): string {
  const m = /(\d+)\./.exec(range);
  return m ? m[1] : range;
}

export function performanceFindings(model: WorkspaceModel): Finding[] {
  const out: Finding[] = [];

  // --- the same external dependency at different versions across packages -------------
  const byDep = new Map<string, Array<{ pkg: WorkspacePackage; range: string; line: number; section: string }>>();
  for (const p of model.packages) {
    for (const d of p.deps) {
      if (d.section === 'peerDependencies') continue;
      if (model.byName.has(d.name) || /^(workspace|link|file):/.test(d.range)) continue;
      const list = byDep.get(d.name) ?? [];
      list.push({ pkg: p, range: normalizeRange(d.range), line: d.line, section: d.section });
      byDep.set(d.name, list);
    }
  }
  for (const [dep, uses] of [...byDep.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const ranges = new Set(uses.map(u => u.range));
    if (ranges.size < 2) continue;
    const majors = new Set(uses.map(u => majorOf(u.range)));
    out.push(
      finding(
        'performance',
        'perf.duplicate-dependency-versions',
        dep,
        majors.size > 1 ? 'medium' : 'low',
        `"${dep}" is declared at ${ranges.size} different versions`,
        `${[...ranges].sort().join(', ')} across ${uses.length} packages: multiple copies are installed and bundled${majors.size > 1 ? ', including different major versions' : ''}.`,
        uses.map(u => ({ kind: 'file' as const, file: u.pkg.manifestFile, ...(u.line ? { line: u.line } : {}), detail: `${u.pkg.name}: ${u.section}.${dep} = "${u.range}"` })),
        `Align ${dep} to one version (a pnpm catalog / overrides entry or a root-level range), then reinstall to dedupe.`
      )
    );
  }

  // --- long dependency chains serialize builds --------------------------------------------
  const longest = longestChain(model);
  if (longest.length >= 6) {
    out.push(
      finding(
        'performance',
        'perf.deep-dependency-chain',
        longest[0],
        longest.length >= 9 ? 'medium' : 'low',
        `Dependency chain ${longest.length} packages deep`,
        `Builds along ${longest.join(' -> ')} must run strictly in sequence, which bounds how much \`re-shell run build\` can parallelize.`,
        [{ kind: 'graph', path: longest, detail: longest.join(' -> ') }],
        'Flatten the chain: depend on the lowest-level package directly where possible and split mid-chain packages that only re-export.'
      )
    );
  }

  // --- known heavyweight dependencies -----------------------------------------------------
  for (const p of model.packages) {
    for (const d of p.deps) {
      if (d.section !== 'dependencies') continue;
      const heavy = HEAVY_DEPENDENCIES[d.name];
      if (!heavy) continue;
      out.push(
        finding(
          'performance',
          'perf.heavy-dependency',
          `${p.name}:${d.name}`,
          'low',
          `Heavy dependency "${d.name}" in ${p.name}`,
          `${heavy.why}.`,
          [{ kind: 'file', file: p.manifestFile, ...(d.line ? { line: d.line } : {}), detail: `dependencies.${d.name} = "${d.range}"` }],
          `Consider ${heavy.instead} for ${p.name}.`
        )
      );
    }
  }
  return out;
}

/** Longest chain in the package graph (cycle-safe; cyclic parts are cut where they close). */
function longestChain(model: WorkspaceModel): string[] {
  const memo = new Map<string, string[]>();
  const visiting = new Set<string>();
  const best = (v: string): string[] => {
    const hit = memo.get(v);
    if (hit) return hit;
    if (visiting.has(v)) return [v];
    visiting.add(v);
    let top: string[] = [];
    for (const w of model.dependencies.get(v) ?? []) {
      if (visiting.has(w)) continue;
      const sub = best(w);
      if (sub.length > top.length) top = sub;
    }
    visiting.delete(v);
    const result = [v, ...top];
    memo.set(v, result);
    return result;
  };
  let longest: string[] = [];
  for (const p of model.packages.map(x => x.name).sort()) {
    const c = best(p);
    if (c.length > longest.length) longest = c;
  }
  return longest;
}

// ===========================================================================
// scalability
// ===========================================================================

function dependentsOf(svc: ServiceModel, all: ServiceModel[]): ServiceModel[] {
  return all.filter(o => o.file === svc.file && o.id !== svc.id && o.dependsOn.some(d => d.name === svc.name));
}

export function scalabilityFindings(model: WorkspaceModel): Finding[] {
  const out: Finding[] = [];
  const svcs = model.services;

  for (const svc of svcs) {
    const dependents = dependentsOf(svc, svcs);
    const where: Evidence = { kind: 'file', file: svc.file, ...(svc.line ? { line: svc.line } : {}), detail: `${svc.kind ?? 'service'} "${svc.name}" (${svc.source})` };

    if (!svc.hasHealthcheck) {
      out.push(
        finding(
          'scalability',
          'scale.service-no-healthcheck',
          svc.id,
          dependents.length > 0 ? 'high' : 'medium',
          `Service "${svc.name}" has no health check`,
          svc.source === 'kubernetes'
            ? `${svc.kind} "${svc.name}" defines no liveness/readiness/startup probe for at least one container, so traffic is routed to instances that may not be ready and failed instances are not restarted.`
            : `Compose service "${svc.name}" has no healthcheck, so depends_on conditions and orchestrators cannot tell when it is actually serving.${dependents.length ? ` ${dependents.length} service(s) depend on it.` : ''}`,
          [where, ...dependents.map(d => ({ kind: 'graph' as const, path: [d.name, svc.name], detail: `${d.name} depends on ${svc.name}` }))],
          svc.source === 'kubernetes'
            ? `Add readinessProbe and livenessProbe (and a startupProbe for slow starts) to every container of ${svc.name}.`
            : `Add a healthcheck (test/interval/timeout/retries) to ${svc.name} and use depends_on with condition: service_healthy.`
        )
      );
    }

    if (!svc.hasResourceLimits) {
      out.push(
        finding(
          'scalability',
          'scale.service-no-resource-limits',
          svc.id,
          svc.source === 'kubernetes' ? 'medium' : 'low',
          `Service "${svc.name}" has no resource limits`,
          'Without CPU/memory limits one noisy instance can starve its neighbours and autoscaling decisions have no baseline.',
          [where],
          svc.source === 'kubernetes'
            ? `Set resources.requests and resources.limits (cpu, memory) on every container of ${svc.name}.`
            : `Set deploy.resources.limits (cpus, memory) or mem_limit/cpus for ${svc.name}.`
        )
      );
    }

    const replicated = svc.autoscaled || (svc.replicas !== null && svc.replicas > 1);
    if (dependents.length >= 2 && !replicated && svc.replicas !== null) {
      out.push(
        finding(
          'scalability',
          'scale.single-point-of-failure',
          svc.id,
          dependents.length >= 3 ? 'high' : 'medium',
          `"${svc.name}" is a single point of failure for ${dependents.length} services`,
          `${dependents.map(d => d.name).join(', ')} all depend on ${svc.name}, which runs ${svc.replicasImplicit ? 'with the default single replica (none configured)' : `${svc.replicas} replica`} and has no autoscaler.`,
          [
            where,
            ...dependents.map(d => ({ kind: 'graph' as const, path: [d.name, svc.name], detail: `${d.name} -> ${svc.name}` })),
            { kind: 'config', file: svc.file, detail: svc.replicasImplicit ? 'replicas not configured' : `replicas: ${svc.replicas}` },
          ],
          svc.source === 'kubernetes'
            ? `Run ${svc.name} with replicas >= 2 (or an HPA) and a PodDisruptionBudget, and spread replicas across nodes/zones.`
            : `Set deploy.replicas >= 2 for ${svc.name} behind a load balancer (or move it to an orchestrator that can replicate it).`
        )
      );
    } else if (svc.source === 'kubernetes' && svc.kind === 'Deployment' && svc.replicas !== null && svc.replicas <= 1 && !svc.autoscaled && dependents.length < 2) {
      out.push(
        finding(
          'scalability',
          'scale.single-replica',
          svc.id,
          'low',
          `Deployment "${svc.name}" runs a single replica`,
          `${svc.replicasImplicit ? 'No replicas value is set (defaults to 1)' : 'replicas is 1'} and no HorizontalPodAutoscaler targets it: a node drain or crash causes downtime.`,
          [where, { kind: 'config', file: svc.file, detail: svc.replicasImplicit ? 'replicas not configured' : 'replicas: 1' }],
          `Set replicas: 2 or more (or add an HPA) for ${svc.name} if it is meant to stay available.`
        )
      );
    }
  }
  return out;
}
