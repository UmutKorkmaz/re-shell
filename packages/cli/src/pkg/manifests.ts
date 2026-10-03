// Manifest parsers: turn each ecosystem's dependency manifests into one
// normalized PkgDependency[] shape. Pure functions over file contents plus a
// thin directory reader (`listDependencies`).

import * as fs from 'fs';
import * as path from 'path';
import { parse as parseToml } from 'smol-toml';

import { findDotnetProjects } from './detect';
import type { DependencyKind, Ecosystem, PkgDependency } from './types';

type TomlTable = Record<string, unknown>;

function dep(
  ecosystem: Ecosystem,
  manifest: string,
  name: string,
  requested: string | null,
  kind: DependencyKind
): PkgDependency {
  return { name, requested, kind, ecosystem, manifest };
}

function isTable(v: unknown): v is TomlTable {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// --------------------------------------------------------------------------
// Node
// --------------------------------------------------------------------------

/** Parse package.json dependency sections. */
export function parsePackageJson(
  content: string,
  ecosystem: Ecosystem,
  manifest = 'package.json'
): PkgDependency[] {
  const json = JSON.parse(content) as Record<string, unknown>;
  const sections: Array<[string, DependencyKind]> = [
    ['dependencies', 'prod'],
    ['devDependencies', 'dev'],
    ['optionalDependencies', 'optional'],
    ['peerDependencies', 'peer'],
  ];
  const out: PkgDependency[] = [];
  for (const [key, kind] of sections) {
    const section = json[key];
    if (!isTable(section)) continue;
    for (const [name, range] of Object.entries(section)) {
      out.push(dep(ecosystem, manifest, name, typeof range === 'string' ? range : null, kind));
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Python
// --------------------------------------------------------------------------

/**
 * Split a PEP 508 requirement ("requests[security]>=2.0; python_version>'3'")
 * into name + constraint.
 */
export function parsePep508(spec: string): { name: string; requested: string | null } | null {
  const trimmed = spec.split(';')[0].split(' #')[0].trim();
  const m = /^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*(.*)$/.exec(trimmed);
  if (!m) return null;
  const constraint = m[3].trim().replace(/^\(|\)$/g, '');
  return { name: m[1], requested: constraint.length > 0 ? constraint : null };
}

/** Parse a requirements.txt body (skips comments, options and includes). */
export function parseRequirementsTxt(
  content: string,
  kind: DependencyKind,
  manifest = 'requirements.txt'
): PkgDependency[] {
  const out: PkgDependency[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;
    if (/^(git\+|https?:|file:|\.|\/)/.test(line)) continue;
    const parsed = parsePep508(line);
    if (parsed) out.push(dep('pip', manifest, parsed.name, parsed.requested, kind));
  }
  return out;
}

function pyEco(doc: TomlTable): Ecosystem {
  const tool = doc.tool;
  if (isTable(tool) && 'poetry' in tool) return 'poetry';
  if (isTable(tool) && 'uv' in tool) return 'uv';
  return 'pip';
}

/** Parse pyproject.toml (PEP 621, dependency-groups, poetry, uv). */
export function parsePyproject(content: string, manifest = 'pyproject.toml'): PkgDependency[] {
  const doc = parseToml(content) as TomlTable;
  const eco = pyEco(doc);
  const out: PkgDependency[] = [];
  const pushSpecs = (specs: unknown, kind: DependencyKind): void => {
    if (!Array.isArray(specs)) return;
    for (const s of specs) {
      if (typeof s !== 'string') continue;
      const p = parsePep508(s);
      if (p) out.push(dep(eco, manifest, p.name, p.requested, kind));
    }
  };

  const project = doc.project;
  if (isTable(project)) {
    pushSpecs(project.dependencies, 'prod');
    if (isTable(project['optional-dependencies'])) {
      for (const specs of Object.values(project['optional-dependencies'])) pushSpecs(specs, 'optional');
    }
  }
  const groups = doc['dependency-groups'];
  if (isTable(groups)) {
    for (const [group, specs] of Object.entries(groups)) {
      pushSpecs(specs, /^(dev|test|lint|docs|typing)/.test(group) ? 'dev' : 'optional');
    }
  }

  const tool = doc.tool;
  if (isTable(tool)) {
    const uv = tool.uv;
    if (isTable(uv)) pushSpecs(uv['dev-dependencies'], 'dev');

    const poetry = tool.poetry;
    if (isTable(poetry)) {
      const pushPoetry = (table: unknown, kind: DependencyKind): void => {
        if (!isTable(table)) return;
        for (const [name, spec] of Object.entries(table)) {
          if (name.toLowerCase() === 'python') continue;
          let requested: string | null = null;
          if (typeof spec === 'string') requested = spec;
          else if (isTable(spec) && typeof spec.version === 'string') requested = spec.version;
          else if (Array.isArray(spec) && isTable(spec[0]) && typeof spec[0].version === 'string') {
            requested = spec[0].version;
          }
          out.push(dep(eco, manifest, name, requested, kind));
        }
      };
      pushPoetry(poetry.dependencies, 'prod');
      pushPoetry(poetry['dev-dependencies'], 'dev');
      if (isTable(poetry.group)) {
        for (const [group, def] of Object.entries(poetry.group)) {
          if (isTable(def)) pushPoetry(def.dependencies, group === 'main' ? 'prod' : 'dev');
        }
      }
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// Rust
// --------------------------------------------------------------------------

/** Parse Cargo.toml (dependencies, dev/build, workspace.dependencies, target.*). */
export function parseCargoToml(content: string, manifest = 'Cargo.toml'): PkgDependency[] {
  const doc = parseToml(content) as TomlTable;
  const out: PkgDependency[] = [];
  const pushTable = (table: unknown, kind: DependencyKind): void => {
    if (!isTable(table)) return;
    for (const [name, spec] of Object.entries(table)) {
      let requested: string | null = null;
      let realName = name;
      if (typeof spec === 'string') requested = spec;
      else if (isTable(spec)) {
        if (typeof spec.version === 'string') requested = spec.version;
        else if (typeof spec.path === 'string') requested = `path:${spec.path}`;
        else if (typeof spec.git === 'string') requested = `git:${spec.git}`;
        else if (spec.workspace === true) requested = 'workspace';
        if (typeof spec.package === 'string') realName = spec.package;
      }
      out.push(dep('cargo', manifest, realName, requested, kind));
    }
  };
  const sections = (root: TomlTable): void => {
    pushTable(root.dependencies, 'prod');
    pushTable(root['dev-dependencies'], 'dev');
    pushTable(root['build-dependencies'], 'build');
  };
  sections(doc);
  if (isTable(doc.workspace)) pushTable(doc.workspace.dependencies, 'prod');
  if (isTable(doc.target)) {
    for (const t of Object.values(doc.target)) if (isTable(t)) sections(t);
  }
  return out;
}

// --------------------------------------------------------------------------
// JVM
// --------------------------------------------------------------------------

function stripXmlComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, '');
}

function xmlTag(block: string, tag: string): string | null {
  const m = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`).exec(block);
  return m ? m[1].trim() : null;
}

/** Parse a pom.xml's direct `<dependencies>` (ignores plugins and dependencyManagement). */
export function parsePomXml(content: string, manifest = 'pom.xml'): PkgDependency[] {
  let xml = stripXmlComments(content);
  const props: Record<string, string> = {};
  const propsBlock = xmlTag(xml, 'properties');
  if (propsBlock) {
    for (const m of propsBlock.matchAll(/<([A-Za-z0-9_.-]+)>\s*([^<]*?)\s*<\/\1>/g)) props[m[1]] = m[2];
  }
  const projectVersion = xmlTag(xml.replace(/<parent>[\s\S]*?<\/parent>/, ''), 'version');
  if (projectVersion) props['project.version'] = projectVersion;
  for (const tag of ['dependencyManagement', 'build', 'profiles', 'reporting', 'parent']) {
    xml = xml.replace(new RegExp(`<${tag}>[\\s\\S]*?</${tag}>`, 'g'), '');
  }
  const out: PkgDependency[] = [];
  for (const m of xml.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const groupId = xmlTag(m[1], 'groupId');
    const artifactId = xmlTag(m[1], 'artifactId');
    if (!groupId || !artifactId) continue;
    let version = xmlTag(m[1], 'version');
    if (version) version = version.replace(/\$\{([^}]+)\}/g, (_s, k: string) => props[k] ?? `\${${k}}`);
    const scope = xmlTag(m[1], 'scope');
    const kind: DependencyKind =
      scope === 'test' ? 'dev' : scope === 'provided' ? 'build' : 'prod';
    out.push(dep('maven', manifest, `${groupId}:${artifactId}`, version, kind));
  }
  return out;
}

const GRADLE_CONFIGS =
  'implementation|api|compileOnly|runtimeOnly|testImplementation|testCompileOnly|testRuntimeOnly|annotationProcessor|kapt|ksp|compile|runtime|testCompile|testRuntime|developmentOnly|runtimeClasspath|compileClasspath';

function gradleKind(config: string): DependencyKind {
  if (/^test/i.test(config)) return 'dev';
  if (/compileOnly|annotationProcessor|kapt|ksp|developmentOnly/.test(config)) return 'build';
  return 'prod';
}

/** Parse build.gradle / build.gradle.kts dependency declarations. */
export function parseGradleBuild(content: string, manifest = 'build.gradle'): PkgDependency[] {
  const out: PkgDependency[] = [];
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // implementation 'g:a:v' | implementation("g:a:v") | implementation group: 'g', name: 'a', version: 'v'
  const stringForm = new RegExp(`\\b(${GRADLE_CONFIGS})\\s*\\(?\\s*['"]([^'"\\s]+)['"]`, 'g');
  for (const m of stripped.matchAll(stringForm)) {
    const parts = m[2].split(':');
    if (parts.length < 2) continue;
    out.push(dep('gradle', manifest, `${parts[0]}:${parts[1]}`, parts[2] ?? null, gradleKind(m[1])));
  }
  const mapForm = new RegExp(
    `\\b(${GRADLE_CONFIGS})\\s*\\(?\\s*group\\s*[:=]\\s*['"]([^'"]+)['"]\\s*,\\s*name\\s*[:=]\\s*['"]([^'"]+)['"](?:\\s*,\\s*version\\s*[:=]\\s*['"]([^'"]+)['"])?`,
    'g'
  );
  for (const m of stripped.matchAll(mapForm)) {
    out.push(dep('gradle', manifest, `${m[2]}:${m[3]}`, m[4] ?? null, gradleKind(m[1])));
  }
  return out;
}

// --------------------------------------------------------------------------
// .NET
// --------------------------------------------------------------------------

/** Parse PackageReference / PackageVersion items from a csproj/fsproj/props file. */
export function parseCsproj(content: string, manifest: string): PkgDependency[] {
  const xml = stripXmlComments(content);
  const out: PkgDependency[] = [];
  const re = /<(PackageReference|PackageVersion)\b([^>]*?)(\/>|>([\s\S]*?)<\/\1>)/g;
  for (const m of xml.matchAll(re)) {
    const attrs = m[2];
    const body = m[4] ?? '';
    const name = /(?:Include|Update)\s*=\s*"([^"]+)"/.exec(attrs)?.[1];
    if (!name) continue;
    const version =
      /Version\s*=\s*"([^"]+)"/.exec(attrs)?.[1] ?? xmlTag(body, 'Version') ?? null;
    const privateAssets = /PrivateAssets\s*=\s*"all"/i.test(attrs) || /<PrivateAssets>\s*all/i.test(body);
    out.push(dep('dotnet', manifest, name, version, privateAssets ? 'build' : 'prod'));
  }
  return out;
}

// --------------------------------------------------------------------------
// PHP / Ruby / Go
// --------------------------------------------------------------------------

/** Parse composer.json require / require-dev (platform packages php and ext-* are skipped). */
export function parseComposerJson(content: string, manifest = 'composer.json'): PkgDependency[] {
  const json = JSON.parse(content) as Record<string, unknown>;
  const out: PkgDependency[] = [];
  for (const [key, kind] of [
    ['require', 'prod'],
    ['require-dev', 'dev'],
  ] as Array<[string, DependencyKind]>) {
    const section = json[key];
    if (!isTable(section)) continue;
    for (const [name, range] of Object.entries(section)) {
      if (name === 'php' || name.startsWith('ext-') || name.startsWith('lib-')) continue;
      out.push(dep('composer', manifest, name, typeof range === 'string' ? range : null, kind));
    }
  }
  return out;
}

/** Parse a Gemfile (`gem` lines, `group :x do` blocks and `group:` options). */
export function parseGemfile(content: string, manifest = 'Gemfile'): PkgDependency[] {
  const out: PkgDependency[] = [];
  const groupStack: string[][] = [];
  const isDev = (groups: string[]): boolean =>
    groups.length > 0 && groups.every(g => /^(development|test|ci)$/.test(g));
  const symbols = (s: string): string[] => [...s.matchAll(/:?(\w+)/g)].map(m => m[1]);
  let depth = 0;
  const blockDepth: number[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const g = /^group\s+(.+?)\s+do\b/.exec(line);
    if (g) {
      groupStack.push(symbols(g[1]));
      depth++;
      blockDepth.push(depth);
      continue;
    }
    if (/\bdo\b(\s*\|[^|]*\|)?\s*$/.test(line) && !/^gem\b/.test(line)) {
      depth++;
      continue;
    }
    if (line === 'end') {
      if (blockDepth.length > 0 && blockDepth[blockDepth.length - 1] === depth) {
        blockDepth.pop();
        groupStack.pop();
      }
      depth = Math.max(0, depth - 1);
      continue;
    }
    const gem = /^gem\s+['"]([^'"]+)['"](.*)$/.exec(line);
    if (!gem) continue;
    const rest = gem[2];
    const versions = [...rest.matchAll(/,\s*['"]([^'"]+)['"]/g)]
      .map(m => m[1])
      .filter(v => /^[~<>=!\d]/.test(v));
    const inlineGroup = /\bgroups?:\s*(\[[^\]]*\]|:\w+)/.exec(rest);
    const groups = [...groupStack.flat(), ...(inlineGroup ? symbols(inlineGroup[1]) : [])];
    out.push(dep('bundler', manifest, gem[1], versions.length ? versions.join(', ') : null, isDev(groups) ? 'dev' : 'prod'));
  }
  return out;
}

/** Parse go.mod `require` directives (indirect requirements are flagged). */
export function parseGoMod(content: string, manifest = 'go.mod'): PkgDependency[] {
  const out: PkgDependency[] = [];
  let inBlock = false;
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    if (/^require\s*\($/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && line === ')') {
      inBlock = false;
      continue;
    }
    const single = /^require\s+(\S+)\s+(\S+)(.*)$/.exec(line);
    const blockLine = inBlock ? /^(\S+)\s+(\S+)(.*)$/.exec(line) : null;
    const m = single ?? blockLine;
    if (!m) continue;
    out.push(dep('go', manifest, m[1], m[2], /\/\/\s*indirect/.test(m[3]) ? 'indirect' : 'prod'));
  }
  return out;
}

// --------------------------------------------------------------------------
// Directory-level reader
// --------------------------------------------------------------------------

function read(dir: string, file: string): string | null {
  try {
    return fs.readFileSync(path.join(dir, file), 'utf8');
  } catch {
    return null;
  }
}

/**
 * Read every manifest of `ecosystem` inside `dir` and return the normalized
 * dependency list. Missing manifests yield an empty array; a manifest that is
 * present but unparseable throws so callers can surface a real error.
 */
export function listDependencies(dir: string, ecosystem: Ecosystem): PkgDependency[] {
  const out: PkgDependency[] = [];
  const wrap = <T>(file: string, fn: (content: string) => T[]): void => {
    const content = read(dir, file);
    if (content === null) return;
    try {
      out.push(...(fn(content) as unknown as PkgDependency[]));
    } catch (err) {
      throw new Error(`Failed to parse ${file}: ${(err as Error).message}`);
    }
  };
  switch (ecosystem) {
    case 'npm':
    case 'pnpm':
    case 'yarn':
    case 'bun':
      wrap('package.json', c => parsePackageJson(c, ecosystem));
      break;
    case 'pip':
    case 'poetry':
    case 'uv': {
      wrap('pyproject.toml', c => parsePyproject(c).map(d => ({ ...d, ecosystem })));
      const names = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
      for (const f of names) {
        if (!/^requirements.*\.txt$/.test(f)) continue;
        const kind: DependencyKind = /dev|test|lint/.test(f) ? 'dev' : 'prod';
        wrap(f, c => parseRequirementsTxt(c, kind, f).map(d => ({ ...d, ecosystem })));
      }
      break;
    }
    case 'cargo':
      wrap('Cargo.toml', c => parseCargoToml(c));
      break;
    case 'maven':
      wrap('pom.xml', c => parsePomXml(c));
      break;
    case 'gradle':
      for (const f of ['build.gradle', 'build.gradle.kts']) wrap(f, c => parseGradleBuild(c, f));
      break;
    case 'dotnet':
      for (const f of findDotnetProjects(dir)) wrap(f, c => parseCsproj(c, f));
      for (const f of ['Directory.Packages.props', 'Directory.Build.props']) {
        wrap(f, c => parseCsproj(c, f));
      }
      break;
    case 'composer':
      wrap('composer.json', c => parseComposerJson(c));
      break;
    case 'bundler':
      wrap('Gemfile', c => parseGemfile(c));
      break;
    case 'go':
      wrap('go.mod', c => parseGoMod(c));
      break;
  }
  return out;
}
