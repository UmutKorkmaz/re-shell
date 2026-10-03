// Parse gate output into structured `failing` entries (R-3).
//
// Supported: tsc diagnostics (plain + pretty), vitest and jest failure
// summaries, eslint (--format json, or the default "stylish" output), and a
// generic tail fallback so a failed gate never reports an empty `failing` list.

import * as path from 'path';
import type { FixCiFailingEntry, FixCiGateKind, GateParser } from './types';

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** Strip ANSI escape sequences and normalise line endings. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI, '').replace(/\r\n?/g, '\n');
}

/** Make a path workspace-relative (posix) when it is absolute and inside `root`. */
export function relativize(file: string, root: string): string {
  let f = file.trim();
  if (f.startsWith('file://')) f = f.slice('file://'.length);
  if (path.isAbsolute(f)) {
    const rel = path.relative(root, f);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) f = rel;
  }
  return f.split(path.sep).join('/').replace(/^\.\//, '');
}

export interface ParseContext {
  gate: string;
  kind: FixCiGateKind;
  root: string;
}

// ---------------------------------------------------------------------------
// tsc
// ---------------------------------------------------------------------------

const TSC_PLAIN = /^(.+?)\((\d+),(\d+)\):\s+(?:error|warning)\s+(TS\d+):\s+(.*)$/;
const TSC_PRETTY = /^(.+?):(\d+):(\d+)\s+-\s+(?:error|warning)\s+(TS\d+):\s+(.*)$/;
const TSC_GLOBAL = /^(?:error)\s+(TS\d+):\s+(.*)$/;

export function parseTsc(output: string, ctx: ParseContext): FixCiFailingEntry[] {
  const entries: FixCiFailingEntry[] = [];
  let last: FixCiFailingEntry | null = null;
  for (const line of stripAnsi(output).split('\n')) {
    const m = TSC_PLAIN.exec(line) ?? TSC_PRETTY.exec(line);
    if (m) {
      last = {
        gate: ctx.gate,
        file: relativize(m[1], ctx.root),
        line: Number(m[2]),
        column: Number(m[3]),
        code: m[4],
        message: m[5].trim(),
      };
      entries.push(last);
      continue;
    }
    const g = TSC_GLOBAL.exec(line);
    if (g) {
      last = { gate: ctx.gate, code: g[1], message: g[2].trim() };
      entries.push(last);
      continue;
    }
    // tsc wraps elaborations onto indented continuation lines.
    if (last && /^\s{2,}\S/.test(line)) {
      last.message += `\n${line.trim()}`;
    } else if (line.trim() === '') {
      last = null;
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// vitest
// ---------------------------------------------------------------------------

const VITEST_FAIL = /^\s*FAIL\s+(\S+?)(?:\s+\[[^\]]*\])?(?:\s+>\s+(.+?))?\s*$/;
const ERROR_LINE = /^\s*(?:[A-Za-z]*Error|AssertionError|Error|Failed|expected)\b.*$/;
const VITEST_LOC = /^\s*[❯>]\s+(\S+?):(\d+):(\d+)\s*$/;

export function parseVitest(output: string, ctx: ParseContext): FixCiFailingEntry[] {
  const lines = stripAnsi(output).split('\n');
  const entries: FixCiFailingEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const m = VITEST_FAIL.exec(lines[i]);
    if (!m) continue;
    const file = relativize(m[1], ctx.root);
    const name = m[2];
    let message = '';
    let lineNo: number | undefined;
    let colNo: number | undefined;
    for (let j = i + 1; j < lines.length && j < i + 40; j++) {
      if (VITEST_FAIL.test(lines[j])) break;
      if (!message && ERROR_LINE.test(lines[j])) message = lines[j].trim();
      const loc = VITEST_LOC.exec(lines[j]);
      if (loc && lineNo === undefined) {
        // Keep the first stack frame (vitest lists the failing assertion first).
        lineNo = Number(loc[2]);
        colNo = Number(loc[3]);
      }
      if (message && lineNo !== undefined) break;
    }
    const entry: FixCiFailingEntry = {
      gate: ctx.gate,
      file,
      ...(lineNo !== undefined ? { line: lineNo, column: colNo } : {}),
      message: [name, message].filter(Boolean).join(': ') || 'test failed',
    };
    const key = `${entry.file}|${entry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push(entry);
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// jest
// ---------------------------------------------------------------------------

const JEST_FILE = /^\s*FAIL\s+(\S+)\s*$/;
const JEST_CASE = /^\s*●\s+(.+?)\s*$/;
const JEST_AT = /at\s+(?:.*?\()?([^\s()]+?):(\d+):(\d+)\)?\s*$/;

export function parseJest(output: string, ctx: ParseContext): FixCiFailingEntry[] {
  const lines = stripAnsi(output).split('\n');
  const entries: FixCiFailingEntry[] = [];
  const seen = new Set<string>();
  let currentFile: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const f = JEST_FILE.exec(lines[i]);
    if (f) {
      currentFile = relativize(f[1], ctx.root);
      continue;
    }
    const c = JEST_CASE.exec(lines[i]);
    if (!c) continue;
    const name = c[1];
    let message = '';
    let file = currentFile;
    let lineNo: number | undefined;
    let colNo: number | undefined;
    for (let j = i + 1; j < lines.length && j < i + 40; j++) {
      if (JEST_CASE.test(lines[j]) || JEST_FILE.test(lines[j])) break;
      if (!message && lines[j].trim() && !/^\s*$/.test(lines[j]) && !JEST_AT.test(lines[j])) {
        message = lines[j].trim();
      }
      const at = JEST_AT.exec(lines[j]);
      if (at && !at[1].includes('node_modules') && lineNo === undefined) {
        file = relativize(at[1], ctx.root);
        lineNo = Number(at[2]);
        colNo = Number(at[3]);
      }
      if (message && lineNo !== undefined) break;
    }
    const entry: FixCiFailingEntry = {
      gate: ctx.gate,
      ...(file ? { file } : {}),
      ...(lineNo !== undefined ? { line: lineNo, column: colNo } : {}),
      message: [name, message].filter(Boolean).join(': '),
    };
    const key = `${entry.file}|${entry.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push(entry);
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// eslint
// ---------------------------------------------------------------------------

interface EslintJsonMessage {
  ruleId?: string | null;
  severity?: number;
  message?: string;
  line?: number;
  column?: number;
}
interface EslintJsonFile {
  filePath?: string;
  messages?: EslintJsonMessage[];
}

function tryParseEslintJson(output: string): EslintJsonFile[] | null {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(output.slice(start, end + 1));
    if (
      Array.isArray(parsed) &&
      parsed.every(p => p && typeof p === 'object' && typeof (p as EslintJsonFile).filePath === 'string')
    ) {
      return parsed as EslintJsonFile[];
    }
  } catch {
    /* not json */
  }
  return null;
}

const STYLISH_ROW = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.*?)(?:\s{2,}(\S+))?\s*$/;

export function parseEslint(output: string, ctx: ParseContext): FixCiFailingEntry[] {
  const text = stripAnsi(output);
  const json = tryParseEslintJson(text);
  const entries: FixCiFailingEntry[] = [];
  if (json) {
    for (const file of json) {
      for (const msg of file.messages ?? []) {
        // severity 2 = error; warnings do not fail eslint's exit code.
        if (msg.severity !== 2) continue;
        entries.push({
          gate: ctx.gate,
          file: relativize(file.filePath ?? '', ctx.root),
          ...(msg.line !== undefined ? { line: msg.line } : {}),
          ...(msg.column !== undefined ? { column: msg.column } : {}),
          ...(msg.ruleId ? { code: msg.ruleId } : {}),
          message: msg.message ?? 'lint error',
        });
      }
    }
    return entries;
  }
  let file: string | undefined;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line) && /[\\/]/.test(line) && !/^\s*[✖✔]/.test(line) && !/^>/.test(line)) {
      file = relativize(line, ctx.root);
      continue;
    }
    const m = STYLISH_ROW.exec(line);
    if (m && m[3] === 'error' && file) {
      entries.push({
        gate: ctx.gate,
        file,
        line: Number(m[1]),
        column: Number(m[2]),
        ...(m[5] ? { code: m[5] } : {}),
        message: m[4].trim(),
      });
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

/** Last `maxLines` non-empty lines of the output, capped in size. */
export function tailEntry(output: string, ctx: ParseContext, maxLines = 15): FixCiFailingEntry {
  const lines = stripAnsi(output)
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.trim().length > 0);
  const tail = lines.slice(-maxLines).join('\n');
  return { gate: ctx.gate, message: tail.length > 2000 ? tail.slice(-2000) : tail || 'gate failed with no output' };
}

const BY_KIND: Record<FixCiGateKind, GateParser[]> = {
  typecheck: ['tsc', 'eslint'],
  test: ['vitest', 'jest', 'tsc'],
  lint: ['eslint', 'tsc'],
  build: ['tsc', 'eslint', 'vitest'],
  custom: ['tsc', 'eslint', 'vitest', 'jest'],
};

const RUNNERS: Record<Exclude<GateParser, 'generic'>, (o: string, c: ParseContext) => FixCiFailingEntry[]> = {
  tsc: parseTsc,
  vitest: parseVitest,
  jest: parseJest,
  eslint: parseEslint,
};

/**
 * Parse a failed gate's combined output into structured failing entries.
 * With an explicit parser only that parser runs; otherwise parsers are tried in
 * a kind-appropriate order. Never returns an empty list: when nothing parses,
 * the output tail is reported as a single message-only entry.
 */
export function parseGateFailures(
  output: string,
  ctx: ParseContext,
  parser?: GateParser
): FixCiFailingEntry[] {
  const order: GateParser[] = parser ? [parser] : BY_KIND[ctx.kind];
  for (const p of order) {
    if (p === 'generic') break;
    const entries = RUNNERS[p](output, ctx);
    if (entries.length > 0) return entries;
  }
  // An explicit parser that found nothing may still be wrong about the tool;
  // try the kind order once before falling back to the tail.
  if (parser && parser !== 'generic') {
    for (const p of BY_KIND[ctx.kind]) {
      if (p === parser) continue;
      const entries = RUNNERS[p as Exclude<GateParser, 'generic'>](output, ctx);
      if (entries.length > 0) return entries;
    }
  }
  return [tailEntry(output, ctx)];
}
