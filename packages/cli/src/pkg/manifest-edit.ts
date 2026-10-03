// Manifest edits for ecosystems whose package manager has no native
// add/remove command (Maven, Gradle) or does not record installs (pip).
// All functions are pure string transforms; `applyEdit` does the file IO.

import * as fs from 'fs';
import * as path from 'path';

import { parsePep508 } from './manifests';
import { PkgError, type ManifestEditPlan } from './types';

export interface EditResult {
  content: string;
  changed: boolean;
}

function normalizePyName(name: string): string {
  return name.toLowerCase().replace(/[-_.]+/g, '-');
}

// --------------------------------------------------------------------------
// pip requirements.txt
// --------------------------------------------------------------------------

/** Add (or replace by normalized name) requirement lines. */
export function editRequirementsAdd(content: string, specs: string[]): EditResult {
  const lines = content.length === 0 ? [] : content.replace(/\n$/, '').split(/\r?\n/);
  let changed = false;
  for (const spec of specs) {
    const parsed = parsePep508(spec);
    if (!parsed) throw new PkgError('PKG_INVALID_ARGS', `Not a valid requirement: ${spec}`);
    const key = normalizePyName(parsed.name);
    const idx = lines.findIndex(l => {
      const p = parsePep508(l);
      return p !== null && !l.trim().startsWith('#') && normalizePyName(p.name) === key;
    });
    if (idx >= 0) {
      if (lines[idx].trim() !== spec) {
        lines[idx] = spec;
        changed = true;
      }
    } else {
      lines.push(spec);
      changed = true;
    }
  }
  return { content: lines.join('\n') + '\n', changed };
}

/** Remove requirement lines by (normalized) package name. */
export function editRequirementsRemove(content: string, names: string[]): EditResult {
  const keys = new Set(names.map(n => normalizePyName(parsePep508(n)?.name ?? n)));
  const lines = content.split(/\r?\n/);
  const kept = lines.filter(l => {
    const t = l.trim();
    if (!t || t.startsWith('#') || t.startsWith('-')) return true;
    const p = parsePep508(t);
    return !(p && keys.has(normalizePyName(p.name)));
  });
  const changed = kept.length !== lines.length;
  return { content: kept.join('\n'), changed };
}

// --------------------------------------------------------------------------
// Maven pom.xml
// --------------------------------------------------------------------------

/** Replace comments with spaces so offsets are preserved while scanning tags. */
function maskComments(xml: string): string {
  return xml.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
}

interface DepsLocation {
  openEnd: number; // index just after `<dependencies>`
  closeStart: number; // index of `</dependencies>`
  indent: string; // indentation of the `<dependencies>` tag
}

/** Locate `<project><dependencies>` (direct child of the root element). */
function findProjectDependencies(xml: string): DepsLocation | null {
  const masked = maskComments(xml);
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z_][\w.-]*)([^>]*?)(\/?)>/g;
  let openEnd = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(masked)) !== null) {
    const [full, closing, tag, , selfClose] = m;
    if (selfClose) continue;
    if (!closing) {
      if (tag === 'dependencies' && stack.length === 1 && stack[0] === 'project') {
        openEnd = m.index + full.length;
        const lineStart = masked.lastIndexOf('\n', m.index) + 1;
        const indent = masked.slice(lineStart, m.index).match(/^\s*/)?.[0] ?? '';
        // find matching close
        const closeRe = /<\/dependencies>/g;
        closeRe.lastIndex = openEnd;
        // dependencies cannot nest, first close wins
        const c = closeRe.exec(masked);
        if (!c) return null;
        return { openEnd, closeStart: c.index, indent };
      }
      stack.push(tag);
    } else {
      stack.pop();
    }
  }
  return null;
}

function parseCoord(spec: string, needVersion: boolean): { g: string; a: string; v: string | null } {
  const parts = spec.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p, i) => i < 2 && !p)) {
    throw new PkgError('PKG_INVALID_ARGS', `Expected groupId:artifactId[:version], got "${spec}"`);
  }
  if (needVersion && !parts[2]) {
    throw new PkgError(
      'PKG_INVALID_ARGS',
      `A version is required for "${spec}" (use groupId:artifactId:version); Maven/Gradle have no native version resolver for "add"`
    );
  }
  return { g: parts[0], a: parts[1], v: parts[2] ?? null };
}

function pomDependencyBlock(g: string, a: string, v: string | null, test: boolean, indent: string, unit: string): string {
  const i1 = indent + unit;
  const i2 = i1 + unit;
  const lines = [`${i1}<dependency>`, `${i2}<groupId>${g}</groupId>`, `${i2}<artifactId>${a}</artifactId>`];
  if (v) lines.push(`${i2}<version>${v}</version>`);
  if (test) lines.push(`${i2}<scope>test</scope>`);
  lines.push(`${i1}</dependency>`);
  return lines.join('\n');
}

/** Indentation unit of the pom (indent of the first child of <project>), default 4 spaces. */
function detectIndentUnit(xml: string): string {
  const m = /<project\b[^>]*>\s*\n([ \t]+)</.exec(xml);
  return m ? m[1] : '    ';
}

/** Insert or update direct dependencies in a pom.xml. */
export function editPomAdd(content: string, specs: string[], dev: boolean): EditResult {
  let xml = content;
  let changed = false;
  const unit = detectIndentUnit(content);
  for (const spec of specs) {
    const { g, a, v } = parseCoord(spec, true);
    const loc = findProjectDependencies(xml);
    if (!loc) {
      const closeProject = xml.lastIndexOf('</project>');
      if (closeProject < 0) throw new PkgError('PKG_ERROR', 'pom.xml has no </project> element');
      const block = `${unit}<dependencies>\n${pomDependencyBlock(g, a, v, dev, unit, unit)}\n${unit}</dependencies>\n`;
      xml = xml.slice(0, closeProject) + block + xml.slice(closeProject);
      changed = true;
      continue;
    }
    const inner = xml.slice(loc.openEnd, loc.closeStart);
    const existing = new RegExp(
      `<dependency>(?:(?!</dependency>)[\\s\\S])*?<groupId>\\s*${escapeRe(g)}\\s*</groupId>\\s*<artifactId>\\s*${escapeRe(a)}\\s*</artifactId>(?:(?!</dependency>)[\\s\\S])*?</dependency>`
    ).exec(inner);
    if (existing) {
      const block = existing[0];
      const verMatch = /<version>\s*([^<]*?)\s*<\/version>/.exec(block);
      if (verMatch && verMatch[1] === v) continue;
      const updated = verMatch
        ? block.replace(/<version>[^<]*<\/version>/, `<version>${v}</version>`)
        : block.replace(/(<\/artifactId>)/, `$1\n${loc.indent}${unit}${unit}${unit}<version>${v}</version>`);
      const start = loc.openEnd + existing.index;
      xml = xml.slice(0, start) + updated + xml.slice(start + block.length);
      changed = true;
      continue;
    }
    const block = pomDependencyBlock(g, a, v, dev, loc.indent, unit);
    const beforeClose = xml.slice(0, loc.closeStart).replace(/[ \t]*$/, '');
    xml = `${beforeClose.replace(/\n?$/, '\n')}${block}\n${loc.indent}${xml.slice(loc.closeStart)}`;
    changed = true;
  }
  return { content: xml, changed };
}

/** Remove direct dependencies (by groupId:artifactId) from a pom.xml. */
export function editPomRemove(content: string, specs: string[]): EditResult {
  let xml = content;
  let changed = false;
  for (const spec of specs) {
    const { g, a } = parseCoord(spec, false);
    const loc = findProjectDependencies(xml);
    if (!loc) continue;
    const inner = xml.slice(loc.openEnd, loc.closeStart);
    const re = new RegExp(
      `[ \\t]*<dependency>(?:(?!</dependency>)[\\s\\S])*?<groupId>\\s*${escapeRe(g)}\\s*</groupId>\\s*<artifactId>\\s*${escapeRe(a)}\\s*</artifactId>(?:(?!</dependency>)[\\s\\S])*?</dependency>[ \\t]*\\r?\\n?`
    );
    const m = re.exec(inner);
    if (!m) continue;
    const start = loc.openEnd + m.index;
    xml = xml.slice(0, start) + xml.slice(start + m[0].length);
    changed = true;
  }
  return { content: xml, changed };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --------------------------------------------------------------------------
// Gradle build files
// --------------------------------------------------------------------------

interface BraceBlock {
  openEnd: number;
  closeStart: number;
}

/** Find the top-level `dependencies { ... }` block by brace matching. */
function findGradleDependencies(src: string): BraceBlock | null {
  const re = /^dependencies\s*\{/gm;
  const m = re.exec(src);
  if (!m) return null;
  const openEnd = m.index + m[0].length;
  let depth = 1;
  for (let i = openEnd; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { openEnd, closeStart: i };
    }
  }
  return null;
}

/** Insert dependency lines into build.gradle(.kts). */
export function editGradleAdd(content: string, specs: string[], dev: boolean, kotlin: boolean): EditResult {
  let src = content;
  let changed = false;
  const config = dev ? 'testImplementation' : 'implementation';
  for (const spec of specs) {
    const { g, a, v } = parseCoord(spec, true);
    const coord = `${g}:${a}:${v}`;
    const line = kotlin ? `    ${config}("${coord}")` : `    ${config} '${coord}'`;
    const existing = new RegExp(`^[ \\t]*\\w+\\s*\\(?\\s*['"]${escapeRe(g)}:${escapeRe(a)}(:[^'"]*)?['"]\\)?[ \\t]*$`, 'm');
    const em = existing.exec(src);
    if (em) {
      const same = em[0].includes(`${coord}'`) || em[0].includes(`${coord}"`);
      if (same) continue;
      src = src.replace(existing, line);
      changed = true;
      continue;
    }
    const block = findGradleDependencies(src);
    if (block) {
      const before = src.slice(0, block.closeStart).replace(/[ \t]*$/, '').replace(/\n?$/, '\n');
      src = `${before}${line}\n${src.slice(block.closeStart)}`;
    } else {
      src = `${src.replace(/\n*$/, '\n')}\ndependencies {\n${line}\n}\n`;
    }
    changed = true;
  }
  return { content: src, changed };
}

/** Remove dependency lines (by group:artifact) from build.gradle(.kts). */
export function editGradleRemove(content: string, specs: string[]): EditResult {
  let src = content;
  let changed = false;
  for (const spec of specs) {
    const { g, a } = parseCoord(spec, false);
    const re = new RegExp(`^[ \\t]*\\w+\\s*\\(?\\s*['"]${escapeRe(g)}:${escapeRe(a)}(:[^'"]*)?['"]\\)?[ \\t]*\\r?\\n?`, 'gm');
    const next = src.replace(re, '');
    if (next !== src) {
      src = next;
      changed = true;
    }
  }
  return { content: src, changed };
}

// --------------------------------------------------------------------------
// IO
// --------------------------------------------------------------------------

/** Compute the edited content for a plan without writing it. */
export function computeEdit(plan: ManifestEditPlan, current: string, dev: boolean): EditResult {
  switch (plan.kind) {
    case 'pip-requirements':
      return plan.action === 'add'
        ? editRequirementsAdd(current, plan.entries)
        : editRequirementsRemove(current, plan.entries);
    case 'maven-pom':
      return plan.action === 'add'
        ? editPomAdd(current, plan.entries, dev)
        : editPomRemove(current, plan.entries);
    case 'gradle-build':
      return plan.action === 'add'
        ? editGradleAdd(current, plan.entries, dev, plan.file.endsWith('.kts'))
        : editGradleRemove(current, plan.entries);
  }
}

export interface AppliedEdit {
  file: string;
  /** Original content, or null when the file did not exist (for rollback). */
  original: string | null;
  changed: boolean;
}

/** Apply a manifest edit to disk and return what is needed to roll it back. */
export function applyEdit(plan: ManifestEditPlan, dev: boolean): AppliedEdit {
  const original = fs.existsSync(plan.file) ? fs.readFileSync(plan.file, 'utf8') : null;
  if (original === null && plan.action === 'remove') {
    return { file: plan.file, original, changed: false };
  }
  const result = computeEdit(plan, original ?? '', dev);
  if (result.changed) {
    fs.mkdirSync(path.dirname(plan.file), { recursive: true });
    fs.writeFileSync(plan.file, result.content);
  }
  return { file: plan.file, original, changed: result.changed };
}

/** Undo {@link applyEdit}. */
export function rollbackEdit(applied: AppliedEdit): void {
  if (!applied.changed) return;
  if (applied.original === null) fs.rmSync(applied.file, { force: true });
  else fs.writeFileSync(applied.file, applied.original);
}
