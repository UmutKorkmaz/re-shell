// Manifest-aware rewriting for `refactor rename-service`: renames the service's
// own package name and every dependency entry that points at it, per ecosystem.

import * as path from 'path';
import { applyEdits, modify, parseTree, findNodeAtLocation, type Node as JsonNode } from 'jsonc-parser';
import { parse as parseToml } from 'smol-toml';

import { newManifestName, type ManifestIdentity, type RenameContext } from './context';
import type { ScannedFile } from './files';
import { escapeRegExp, normalizePyName } from './names';
import { scanLeaves, spliceText, valueRange } from './xml-scan';

// --------------------------------------------------------------------------
// Identity discovery
// --------------------------------------------------------------------------

function ownFile(ctx: RenameContext, f: ScannedFile, name: string | RegExp): boolean {
  if (!f.rel.startsWith(ctx.oldRel + '/')) return false;
  const rest = f.rel.slice(ctx.oldRel.length + 1);
  if (rest.includes('/')) return false;
  return typeof name === 'string' ? rest === name : name.test(rest);
}

function pomIdentity(xml: string): { artifactId?: string; groupId?: string } {
  const leaves = scanLeaves(xml);
  const direct = (tag: string): string | undefined =>
    leaves.find(l => l.path.length === 2 && l.path[0] === 'project' && l.path[1] === tag)?.value;
  const parentGroup = leaves.find(l => l.path.join('/') === 'project/parent/groupId')?.value;
  return { artifactId: direct('artifactId'), groupId: direct('groupId') ?? parentGroup };
}

/**
 * Read the package identities declared at the root of the old service
 * directory and compute their post-rename names.
 */
export function discoverIdentities(ctx: RenameContext, files: ScannedFile[]): ManifestIdentity[] {
  const out: ManifestIdentity[] = [];
  const add = (kind: ManifestIdentity['kind'], file: string, oldName: string | undefined, groupId?: string): void => {
    if (!oldName) return;
    out.push({ kind, file, oldName, newName: newManifestName(ctx, oldName), ...(groupId ? { groupId } : {}) });
  };
  for (const f of files) {
    if (ownFile(ctx, f, 'package.json')) {
      try {
        const name = (JSON.parse(f.content) as { name?: string }).name;
        add('npm', f.rel, typeof name === 'string' ? name : undefined);
      } catch {
        /* unparseable: ignored (reported as unchanged) */
      }
    } else if (ownFile(ctx, f, 'pyproject.toml')) {
      try {
        const doc = parseToml(f.content) as { project?: { name?: string }; tool?: { poetry?: { name?: string } } };
        add('python', f.rel, doc.project?.name ?? doc.tool?.poetry?.name);
      } catch {
        /* ignore */
      }
    } else if (ownFile(ctx, f, 'Cargo.toml')) {
      try {
        const doc = parseToml(f.content) as { package?: { name?: string } };
        add('cargo', f.rel, doc.package?.name);
      } catch {
        /* ignore */
      }
    } else if (ownFile(ctx, f, 'go.mod')) {
      const m = /^module\s+(\S+)/m.exec(f.content);
      if (m) {
        const last = m[1].split('/').pop();
        out.push({
          kind: 'go',
          file: f.rel,
          oldName: m[1],
          newName: last === ctx.oldName ? m[1].slice(0, m[1].length - last.length) + ctx.newName : m[1],
        });
      }
    } else if (ownFile(ctx, f, 'pom.xml')) {
      const id = pomIdentity(f.content);
      add('maven', f.rel, id.artifactId, id.groupId);
    } else if (ownFile(ctx, f, 'composer.json')) {
      try {
        const name = (JSON.parse(f.content) as { name?: string }).name;
        add('composer', f.rel, typeof name === 'string' ? name : undefined);
      } catch {
        /* ignore */
      }
    } else if (ownFile(ctx, f, /^settings\.gradle(\.kts)?$/)) {
      const m = /rootProject\.name\s*=\s*['"]([^'"]+)['"]/.exec(f.content);
      add('gradle', f.rel, m?.[1]);
    } else if (ownFile(ctx, f, /\.gemspec$/)) {
      const m = /\.name\s*=\s*['"]([^'"]+)['"]/.exec(f.content);
      add('gem', f.rel, m?.[1]);
    } else if (ownFile(ctx, f, /\.(cs|fs|vb)proj$/)) {
      const m = /<(AssemblyName|PackageId)>\s*([^<]+?)\s*<\/\1>/.exec(f.content);
      if (m && (m[2] === ctx.oldV.pascal || m[2] === ctx.oldName)) {
        out.push({
          kind: 'dotnet',
          file: f.rel,
          oldName: m[2],
          newName: m[2] === ctx.oldName ? ctx.newName : ctx.newV.pascal,
        });
      }
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// JSON manifests (package.json / composer.json) via jsonc-parser edits
// --------------------------------------------------------------------------

const NPM_DEP_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
  'resolutions',
  'overrides',
  'dependenciesMeta',
  'peerDependenciesMeta',
];

function jsonKeyEdits(
  text: string,
  sectionPaths: string[][],
  oldKey: string,
  newKey: string
): Array<{ offset: number; length: number; content: string }> {
  const tree = parseTree(text);
  if (!tree) return [];
  const edits: Array<{ offset: number; length: number; content: string }> = [];
  for (const sp of sectionPaths) {
    const section: JsonNode | undefined = findNodeAtLocation(tree, sp);
    if (!section || section.type !== 'object') continue;
    for (const prop of section.children ?? []) {
      const keyNode = prop.children?.[0];
      if (keyNode && keyNode.value === oldKey) {
        edits.push({ offset: keyNode.offset, length: keyNode.length, content: JSON.stringify(newKey) });
      }
    }
  }
  return edits;
}

function renameJsonName(text: string, newName: string): string {
  const edits = modify(text, ['name'], newName, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
  return applyEdits(text, edits);
}

function rewritePackageJson(ctx: RenameContext, f: ScannedFile, text: string): string {
  let out = text;
  const own = ctx.identities.find(i => i.kind === 'npm' && i.file === f.rel);
  if (own && own.oldName !== own.newName) out = renameJsonName(out, own.newName);
  for (const id of ctx.identities.filter(i => i.kind === 'npm' && i.file !== f.rel && i.oldName !== i.newName)) {
    const edits = jsonKeyEdits(
      out,
      [...NPM_DEP_SECTIONS.map(s => [s]), ['pnpm', 'overrides']],
      id.oldName,
      id.newName
    );
    if (edits.length > 0) out = applyEdits(out, edits);
  }
  return out;
}

function rewriteComposerJson(ctx: RenameContext, f: ScannedFile, text: string): string {
  let out = text;
  const own = ctx.identities.find(i => i.kind === 'composer' && i.file === f.rel);
  if (own && own.oldName !== own.newName) out = renameJsonName(out, own.newName);
  for (const id of ctx.identities.filter(i => i.kind === 'composer' && i.file !== f.rel && i.oldName !== i.newName)) {
    const edits = jsonKeyEdits(out, [['require'], ['require-dev'], ['replace'], ['provide']], id.oldName, id.newName);
    if (edits.length > 0) out = applyEdits(out, edits);
  }
  return out;
}

// --------------------------------------------------------------------------
// TOML manifests (line based, format preserving)
// --------------------------------------------------------------------------

function pyNameRegex(name: string): string {
  return normalizePyName(name)
    .split('-')
    .map(escapeRegExp)
    .join('[-_.]+');
}

function rewritePyproject(ctx: RenameContext, f: ScannedFile, text: string): string {
  const own = ctx.identities.find(i => i.kind === 'python' && i.file === f.rel);
  const others = ctx.identities.filter(i => i.kind === 'python' && i.file !== f.rel && i.oldName !== i.newName);
  const lines = text.split('\n');
  let table = '';
  for (let i = 0; i < lines.length; i++) {
    const header = /^\s*\[\[?([^\]]+)\]\]?\s*(#.*)?$/.exec(lines[i]);
    if (header) {
      table = header[1].trim();
      // [tool.poetry.dependencies.old] style headers
      for (const id of others) {
        const re = new RegExp(`^(\\s*\\[tool\\.poetry\\.(?:group\\.[^.\\]]+\\.)?(?:dev-)?dependencies\\.)${pyNameRegex(id.oldName)}(\\]\\s*)`, 'i');
        if (re.test(lines[i])) lines[i] = lines[i].replace(re, `$1${id.newName}$2`);
      }
      continue;
    }
    if (own && (table === 'project' || table === 'tool.poetry')) {
      const re = /^(\s*name\s*=\s*)(["'])([^"']+)\2/;
      const m = re.exec(lines[i]);
      if (m && m[3] === own.oldName) lines[i] = lines[i].replace(re, `$1$2${own.newName}$2`);
    }
    for (const id of others) {
      const nameRe = pyNameRegex(id.oldName);
      if (/^tool\.poetry\.(group\.[^.]+\.)?(dev-)?dependencies$/.test(table)) {
        const re = new RegExp(`^(\\s*)${nameRe}(\\s*=)`, 'i');
        if (re.test(lines[i])) lines[i] = lines[i].replace(re, `$1${id.newName}$2`);
        const pkg = new RegExp(`(package\\s*=\\s*["'])${nameRe}(["'])`, 'i');
        lines[i] = lines[i].replace(pkg, `$1${id.newName}$2`);
      } else if (/^(project|project\.optional-dependencies|dependency-groups|tool\.uv)$/.test(table)) {
        const re = new RegExp(`(["'])${nameRe}(?=[\\s\\[<>=!~;@,)"'])`, 'gi');
        lines[i] = lines[i].replace(re, `$1${id.newName}`);
      }
    }
  }
  return lines.join('\n');
}

function rewriteRequirements(ctx: RenameContext, text: string): string {
  const others = ctx.identities.filter(i => i.kind === 'python' && i.oldName !== i.newName);
  if (others.length === 0) return text;
  return text
    .split('\n')
    .map(line => {
      for (const id of others) {
        const re = new RegExp(`^(\\s*)${pyNameRegex(id.oldName)}(?=\\s*(?:[\\[<>=!~;@]|$|\\s))`, 'i');
        if (re.test(line)) return line.replace(re, `$1${id.newName}`);
      }
      return line;
    })
    .join('\n');
}

function rewriteCargoToml(ctx: RenameContext, f: ScannedFile, text: string): string {
  const own = ctx.identities.find(i => i.kind === 'cargo' && i.file === f.rel);
  const others = ctx.identities.filter(i => i.kind === 'cargo' && i.file !== f.rel && i.oldName !== i.newName);
  const lines = text.split('\n');
  let table = '';
  const depTable = /^(workspace\.)?(dev-|build-)?dependencies$|^target\..+\.(dev-|build-)?dependencies$/;
  for (let i = 0; i < lines.length; i++) {
    const header = /^\s*\[\[?([^\]]+)\]\]?\s*(#.*)?$/.exec(lines[i]);
    if (header) {
      table = header[1].trim();
      for (const id of others) {
        const re = new RegExp(`^(\\s*\\[(?:workspace\\.)?(?:dev-|build-)?dependencies\\.)${escapeRegExp(id.oldName)}(\\]\\s*)`);
        if (re.test(lines[i])) lines[i] = lines[i].replace(re, `$1${id.newName}$2`);
      }
      continue;
    }
    if (own && table === 'package') {
      const re = /^(\s*name\s*=\s*)(["'])([^"']+)\2/;
      const m = re.exec(lines[i]);
      if (m && m[3] === own.oldName) lines[i] = lines[i].replace(re, `$1$2${own.newName}$2`);
    }
    for (const id of others) {
      if (depTable.test(table) || /^(workspace\.)?(dev-|build-)?dependencies\./.test(table)) {
        const key = new RegExp(`^(\\s*)${escapeRegExp(id.oldName)}(\\s*(?:=|\\.))`);
        if (key.test(lines[i])) lines[i] = lines[i].replace(key, `$1${id.newName}$2`);
        const pkg = new RegExp(`(package\\s*=\\s*["'])${escapeRegExp(id.oldName)}(["'])`);
        lines[i] = lines[i].replace(pkg, `$1${id.newName}$2`);
      }
    }
  }
  return lines.join('\n');
}

// --------------------------------------------------------------------------
// Go
// --------------------------------------------------------------------------

function rewriteGoModulePaths(ctx: RenameContext, text: string): string {
  let out = text;
  for (const id of ctx.identities.filter(i => i.kind === 'go' && i.oldName !== i.newName)) {
    const re = new RegExp(`${escapeRegExp(id.oldName)}(?=$|[/\\s"'\`\\r\\n@])`, 'gm');
    out = out.replace(re, id.newName);
  }
  return out;
}

// --------------------------------------------------------------------------
// Maven / Gradle
// --------------------------------------------------------------------------

function rewritePom(ctx: RenameContext, f: ScannedFile, text: string): string {
  let out = text;
  const own = ctx.identities.find(i => i.kind === 'maven' && i.file === f.rel);
  if (own && own.oldName !== own.newName) {
    const leaf = scanLeaves(out).find(l => l.path.length === 2 && l.path[0] === 'project' && l.path[1] === 'artifactId');
    if (leaf && leaf.value === own.oldName) {
      const r = valueRange(out, leaf);
      out = spliceText(out, [{ start: r.start, end: r.end, text: own.newName }]);
    }
  }
  for (const id of ctx.identities.filter(i => i.kind === 'maven' && i.file !== f.rel && i.oldName !== i.newName)) {
    out = out.replace(/<(dependency|parent|exclusion)>[\s\S]*?<\/\1>/g, block => {
      const g = /<groupId>\s*([^<]*?)\s*<\/groupId>/.exec(block)?.[1];
      const a = /<artifactId>\s*([^<]*?)\s*<\/artifactId>/.exec(block)?.[1];
      if (a !== id.oldName || (id.groupId && g !== id.groupId)) return block;
      return block.replace(/(<artifactId>\s*)[^<]*?(\s*<\/artifactId>)/, `$1${id.newName}$2`);
    });
  }
  // <module>path</module> entries resolving to the old directory
  if (ctx.moveDir) {
    const fileDir = path.dirname(f.abs);
    out = out.replace(/(<module>\s*)([^<]+?)(\s*<\/module>)/g, (m, pre: string, mod: string, post: string) => {
      const segs = mod.split('/');
      const last = segs[segs.length - 1];
      if (last !== ctx.oldName) return m;
      if (path.resolve(fileDir, mod) !== ctx.oldDir) return m;
      segs[segs.length - 1] = ctx.newName;
      return `${pre}${segs.join('/')}${post}`;
    });
  }
  return out;
}

function rewriteGradle(ctx: RenameContext, f: ScannedFile, text: string): string {
  let out = text;
  const own = ctx.identities.find(i => i.kind === 'gradle' && i.file === f.rel);
  if (own && own.oldName !== own.newName) {
    out = out.replace(
      /(rootProject\.name\s*=\s*['"])([^'"]+)(['"])/,
      (m, a: string, name: string, b: string) => (name === own.oldName ? `${a}${own.newName}${b}` : m)
    );
  }
  for (const id of ctx.identities.filter(i => i.kind === 'gradle' && i.oldName !== i.newName)) {
    // implementation project(':old')  /  project(":old")
    out = out.replace(new RegExp(`(project\\(\\s*['"]:)${escapeRegExp(id.oldName)}(?=['"])`, 'g'), `$1${id.newName}`);
  }
  if (ctx.moveDir && /^settings\.gradle(\.kts)?$/.test(path.basename(f.rel))) {
    out = out
      .split('\n')
      .map(line =>
        /^\s*include\b/.test(line)
          ? line.replace(new RegExp(`(['"]:?)${escapeRegExp(ctx.oldName)}(?=['"])`, 'g'), `$1${ctx.newName}`)
          : line
      )
      .join('\n');
  }
  return out;
}

// --------------------------------------------------------------------------
// Ruby / .NET
// --------------------------------------------------------------------------

function rewriteGemfile(ctx: RenameContext, text: string): string {
  let out = text;
  for (const id of ctx.identities.filter(i => i.kind === 'gem' && i.oldName !== i.newName)) {
    out = out.replace(new RegExp(`(\\bgem\\s+['"])${escapeRegExp(id.oldName)}(['"])`, 'g'), `$1${id.newName}$2`);
  }
  return out;
}

function rewriteGemspec(ctx: RenameContext, f: ScannedFile, text: string): string {
  const own = ctx.identities.find(i => i.kind === 'gem' && i.file === f.rel);
  if (!own || own.oldName === own.newName) return text;
  return text.replace(/(\.name\s*=\s*['"])([^'"]+)(['"])/, (m, a: string, n: string, b: string) =>
    n === own.oldName ? `${a}${own.newName}${b}` : m
  );
}

function rewriteDotnetProject(ctx: RenameContext, f: ScannedFile, text: string): string {
  const own = ctx.identities.find(i => i.kind === 'dotnet' && i.file === f.rel);
  if (!own || own.oldName === own.newName) return text;
  return text.replace(/(<(?:AssemblyName|PackageId)>\s*)([^<]+?)(\s*<\/(?:AssemblyName|PackageId)>)/g, (m, a: string, n: string, b: string) =>
    n === own.oldName ? `${a}${own.newName}${b}` : m
  );
}

// --------------------------------------------------------------------------
// Entry point
// --------------------------------------------------------------------------

/**
 * Apply manifest-aware rewrites for one file. Returns the (possibly unchanged)
 * text. Files that are not manifests pass through untouched.
 */
export function rewriteManifestFile(ctx: RenameContext, f: ScannedFile, text: string): string {
  const base = path.posix.basename(f.rel);
  if (base === 'package.json') return rewritePackageJson(ctx, f, text);
  if (base === 'composer.json') return rewriteComposerJson(ctx, f, text);
  if (base === 'pyproject.toml') return rewritePyproject(ctx, f, text);
  if (/^requirements.*\.txt$/.test(base)) return rewriteRequirements(ctx, text);
  if (base === 'Cargo.toml') return rewriteCargoToml(ctx, f, text);
  if (base === 'go.mod' || base === 'go.work') return rewriteGoModulePaths(ctx, text);
  if (base.endsWith('.go')) return rewriteGoModulePaths(ctx, text);
  if (base === 'pom.xml') return rewritePom(ctx, f, text);
  if (/^(settings|build)\.gradle(\.kts)?$/.test(base)) return rewriteGradle(ctx, f, text);
  if (base === 'Gemfile') return rewriteGemfile(ctx, text);
  if (base.endsWith('.gemspec')) return rewriteGemspec(ctx, f, text);
  if (/\.(cs|fs|vb)proj$/.test(base)) return rewriteDotnetProject(ctx, f, text);
  return text;
}
