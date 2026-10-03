// Normalizers for each ecosystem's native "outdated" output. Every parser is a
// pure function from the tool's stdout to PkgOutdated[]; unparseable output
// throws so a broken parse never masquerades as "everything is up to date".

import type { DependencyKind, Ecosystem, PkgOutdated } from './types';

function out(
  ecosystem: Ecosystem,
  name: string,
  current: string | null,
  wanted: string | null,
  latest: string,
  kind: DependencyKind | null
): PkgOutdated {
  return { name, current, wanted, latest, kind, ecosystem };
}

function mapNodeKind(t: unknown): DependencyKind | null {
  switch (t) {
    case 'dependencies':
      return 'prod';
    case 'devDependencies':
      return 'dev';
    case 'optionalDependencies':
      return 'optional';
    case 'peerDependencies':
      return 'peer';
    default:
      return null;
  }
}

function parseJson(stdout: string, tool: string): unknown {
  const text = stdout.trim();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Could not parse ${tool} output as JSON: ${(err as Error).message}`);
  }
}

/** Iterate over concatenated top-level JSON values (`go list -json`, cargo-outdated). */
export function splitJsonStream(text: string): unknown[] {
  const values: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0 && start >= 0) {
        values.push(JSON.parse(text.slice(start, i + 1)));
        start = -1;
      }
    }
  }
  if (depth !== 0) throw new Error('Truncated JSON stream');
  return values;
}

/** `npm outdated --json`. */
export function parseNpmOutdated(stdout: string): PkgOutdated[] {
  const json = parseJson(stdout, 'npm outdated') as Record<string, Record<string, unknown>> | null;
  if (!json) return [];
  return Object.entries(json).map(([name, v]) =>
    out(
      'npm',
      name,
      typeof v.current === 'string' ? v.current : null,
      typeof v.wanted === 'string' ? v.wanted : null,
      String(v.latest ?? ''),
      mapNodeKind(v.type)
    )
  );
}

/** `pnpm outdated --format json`. */
export function parsePnpmOutdated(stdout: string): PkgOutdated[] {
  const json = parseJson(stdout, 'pnpm outdated') as Record<string, Record<string, unknown>> | null;
  if (!json) return [];
  return Object.entries(json).map(([name, v]) =>
    out(
      'pnpm',
      name,
      typeof v.current === 'string' ? v.current : null,
      typeof v.wanted === 'string' ? v.wanted : null,
      String(v.latest ?? ''),
      mapNodeKind(v.dependencyType)
    )
  );
}

/** `yarn outdated --json` (yarn classic: one JSON document per line, one is a table). */
export function parseYarnOutdated(stdout: string): PkgOutdated[] {
  const result: PkgOutdated[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    let doc: { type?: string; data?: { head?: string[]; body?: string[][] } };
    try {
      doc = JSON.parse(t);
    } catch {
      throw new Error('Could not parse yarn outdated output as JSON lines');
    }
    if (doc.type !== 'table' || !doc.data?.head || !doc.data.body) continue;
    const head = doc.data.head.map(h => h.toLowerCase());
    const idx = (n: string): number => head.indexOf(n);
    for (const row of doc.data.body) {
      result.push(
        out(
          'yarn',
          row[idx('package')],
          row[idx('current')] ?? null,
          row[idx('wanted')] ?? null,
          row[idx('latest')],
          mapNodeKind(row[idx('package type')])
        )
      );
    }
  }
  return result;
}

/** `bun outdated` (box-drawn table; the Package cell carries a "(dev)" style marker). */
export function parseBunOutdated(stdout: string): PkgOutdated[] {
  const result: PkgOutdated[] = [];
  let sawHeader = false;
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.startsWith('|') || /^\|[-|]+\|$/.test(line.trim())) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    if (cells.length < 4) continue;
    if (cells[0] === 'Package') {
      sawHeader = true;
      continue;
    }
    const m = /^(\S+)(?:\s+\((dev|peer|optional)\))?$/.exec(cells[0]);
    if (!m) continue;
    const kind: DependencyKind =
      m[2] === 'dev' ? 'dev' : m[2] === 'peer' ? 'peer' : m[2] === 'optional' ? 'optional' : 'prod';
    result.push(out('bun', m[1], cells[1] || null, cells[2] || null, cells[3], kind));
  }
  if (!sawHeader && stdout.trim() !== '' && !/^bun outdated v[\d.]+/m.test(stdout)) {
    throw new Error('Unrecognized `bun outdated` output');
  }
  return result;
}

/** `pip list --outdated --format json` (and `uv pip list --outdated --format json`). */
export function parsePipOutdated(stdout: string, ecosystem: 'pip' | 'uv' = 'pip'): PkgOutdated[] {
  const json = parseJson(stdout, 'pip list') as Array<Record<string, unknown>> | null;
  if (!json) return [];
  return json.map(v =>
    out(ecosystem, String(v.name), (v.version as string) ?? null, null, String(v.latest_version ?? ''), null)
  );
}

/** `poetry show --outdated --top-level --no-ansi`: "name current latest description". */
export function parsePoetryOutdated(stdout: string): PkgOutdated[] {
  const result: PkgOutdated[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^(Warning|Skipping|Error|Creating|Using)\b/i.test(line)) continue;
    const m = /^(\S+)\s+(?:\(!\)\s+)?(\S+)\s+(?:\(!\)\s+)?(\S+)(?:\s+.*)?$/.exec(line);
    if (!m) continue;
    result.push(out('poetry', m[1], m[2], null, m[3], null));
  }
  return result;
}

/** `cargo outdated --format json` (one document per workspace member). */
export function parseCargoOutdated(stdout: string): PkgOutdated[] {
  const result: PkgOutdated[] = [];
  for (const doc of splitJsonStream(stdout) as Array<{ dependencies?: Array<Record<string, string>> }>) {
    for (const d of doc.dependencies ?? []) {
      const kind: DependencyKind | null =
        d.kind === 'Normal' ? 'prod' : d.kind === 'Development' ? 'dev' : d.kind === 'Build' ? 'build' : null;
      const present = (v: string | undefined): string | null => (v && v !== '---' ? v : null);
      result.push(out('cargo', d.name, present(d.project), present(d.compat), d.latest, kind));
    }
  }
  return result.filter(r => r.latest !== '---');
}

/** `mvn versions:display-dependency-updates` log lines (handles wrapped entries). */
export function parseMavenOutdated(stdout: string): PkgOutdated[] {
  const result: PkgOutdated[] = [];
  const lines = stdout.split(/\r?\n/).map(l => l.replace(/^\[\w+\]\s?/, ''));
  let inSection = false;
  let pending: string | null = null;
  for (const line of lines) {
    if (/The following dependencies in .*have newer versions:/.test(line)) {
      inSection = !/Dependency Management/i.test(line);
      pending = null;
      continue;
    }
    if (/^\s*$/.test(line) || /^-{5,}/.test(line) || /BUILD |Total time/.test(line)) {
      if (!/^\s*$/.test(line)) inSection = false;
      pending = null;
      continue;
    }
    if (!inSection) continue;
    let m = /^\s+(\S+:\S+?)\s*\.{2,}\s*(\S+)\s+->\s+(\S+)\s*$/.exec(line);
    if (m) {
      result.push(out('maven', m[1], m[2], null, m[3], null));
      pending = null;
      continue;
    }
    m = /^\s+(\S+:\S+?)\s*\.{2,}\s*$/.exec(line);
    if (m) {
      pending = m[1];
      continue;
    }
    const cont = /^\s+(\S+)\s+->\s+(\S+)\s*$/.exec(line);
    if (cont && pending) {
      result.push(out('maven', pending, cont[1], null, cont[2], null));
      pending = null;
    }
  }
  return result;
}

/** `dotnet list package --outdated --format json`. */
export function parseDotnetOutdated(stdout: string): PkgOutdated[] {
  const json = parseJson(stdout, 'dotnet list package') as {
    projects?: Array<{ frameworks?: Array<{ topLevelPackages?: Array<Record<string, string>> }> }>;
  } | null;
  if (!json) return [];
  const seen = new Map<string, PkgOutdated>();
  for (const project of json.projects ?? []) {
    for (const fw of project.frameworks ?? []) {
      for (const p of fw.topLevelPackages ?? []) {
        if (!p.latestVersion) continue;
        if (!seen.has(p.id)) {
          seen.set(p.id, out('dotnet', p.id, p.resolvedVersion ?? null, null, p.latestVersion, 'prod'));
        }
      }
    }
  }
  return [...seen.values()];
}

/** `composer outdated --format=json`. */
export function parseComposerOutdated(stdout: string): PkgOutdated[] {
  const json = parseJson(stdout, 'composer outdated') as {
    installed?: Array<Record<string, string>>;
  } | null;
  if (!json) return [];
  return (json.installed ?? [])
    .filter(p => p['latest-status'] !== 'up-to-date')
    .map(p => out('composer', p.name, p.version ?? null, null, p.latest, null));
}

/** `bundle outdated --parseable`: `rack (newest 3.1.8, installed 2.2.0, requested ~> 2.2)`. */
export function parseBundlerOutdated(stdout: string): PkgOutdated[] {
  const result: PkgOutdated[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const m = /^(\S+)\s+\(newest\s+([^,)]+),\s*installed\s+([^,)]+)(?:,\s*requested\s+[^)]*)?\)\s*$/.exec(raw.trim());
    if (m) result.push(out('bundler', m[1], m[3].trim(), null, m[2].trim(), null));
  }
  return result;
}

/** `go list -u -m -json all`: modules with an `Update` and no `Indirect` flag. */
export function parseGoOutdated(stdout: string): PkgOutdated[] {
  const result: PkgOutdated[] = [];
  for (const m of splitJsonStream(stdout) as Array<{
    Path: string;
    Version?: string;
    Main?: boolean;
    Indirect?: boolean;
    Update?: { Version: string };
  }>) {
    if (m.Main || !m.Update) continue;
    result.push(out('go', m.Path, m.Version ?? null, null, m.Update.Version, m.Indirect ? 'indirect' : 'prod'));
  }
  return result;
}

/** Dispatch to the right normalizer for `ecosystem`. */
export function parseOutdated(ecosystem: Ecosystem, stdout: string): PkgOutdated[] {
  switch (ecosystem) {
    case 'npm':
      return parseNpmOutdated(stdout);
    case 'pnpm':
      return parsePnpmOutdated(stdout);
    case 'yarn':
      return parseYarnOutdated(stdout);
    case 'bun':
      return parseBunOutdated(stdout);
    case 'pip':
      return parsePipOutdated(stdout, 'pip');
    case 'uv':
      return parsePipOutdated(stdout, 'uv');
    case 'poetry':
      return parsePoetryOutdated(stdout);
    case 'cargo':
      return parseCargoOutdated(stdout);
    case 'maven':
      return parseMavenOutdated(stdout);
    case 'dotnet':
      return parseDotnetOutdated(stdout);
    case 'composer':
      return parseComposerOutdated(stdout);
    case 'bundler':
      return parseBundlerOutdated(stdout);
    case 'go':
      return parseGoOutdated(stdout);
    case 'gradle':
      throw new Error('gradle has no native outdated output to parse');
  }
}
