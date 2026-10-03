// Merge generated entries into an existing .vscode/launch.json (JSONC) without
// clobbering the user's own configurations or losing their comments.

import {
  applyEdits,
  findNodeAtLocation,
  modify,
  parse,
  parseTree,
  printParseErrorCode,
  type FormattingOptions,
  type ParseError,
} from 'jsonc-parser';
import { isDeepStrictEqual } from 'util';

export interface MergeResult {
  text: string;
  created: boolean;
  added: string[];
  updated: string[];
  unchanged: string[];
  /** Entries in the existing file that this tool does not own. */
  preserved: number;
}

export class LaunchJsonError extends Error {}

type Entry = Record<string, unknown>;

function detectFormatting(text: string): FormattingOptions {
  if (/^\t/m.test(text)) return { insertSpaces: false, tabSize: 1 };
  const m = /^( +)\S/m.exec(text);
  return { insertSpaces: true, tabSize: m ? m[1].length : 2 };
}

/**
 * Append `entry` to the array at `key` by splicing text after the last element,
 * so the user's existing elements keep their exact formatting and comments.
 * Returns null when the layout is too unusual (the caller falls back to a
 * jsonc-parser edit).
 */
function appendToArray(text: string, key: string, entry: Entry, fmt: FormattingOptions): string | null {
  const tree = parseTree(text);
  const arr = tree ? findNodeAtLocation(tree, [key]) : undefined;
  if (!arr || arr.type !== 'array' || !arr.children || arr.children.length === 0) return null;
  const last = arr.children[arr.children.length - 1];
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const unit = fmt.insertSpaces ? ' '.repeat(fmt.tabSize ?? 2) : '\t';

  const lineStart = text.lastIndexOf('\n', last.offset) + 1;
  const before = text.slice(lineStart, last.offset);
  const startsOwnLine = before.trim() === '';
  const arrLineStart = text.lastIndexOf('\n', arr.offset) + 1;
  const arrIndent = /^[ \t]*/.exec(text.slice(arrLineStart))?.[0] ?? '';
  const indent = startsOwnLine ? before : arrIndent + unit;

  let i = last.offset + last.length;
  while (text[i] === ' ' || text[i] === '\t') i++;
  const hasComma = text[i] === ',';
  if (hasComma) i++;
  let lineEnd = text.indexOf('\n', i);
  if (lineEnd < 0) lineEnd = text.length;
  const rest = text.slice(i, lineEnd).replace(/\r$/, '');
  if (rest.trim() !== '' && !rest.trim().startsWith('//')) return null;

  const body = JSON.stringify(entry, null, unit)
    .split('\n')
    .map((l, n) => (n === 0 ? l : indent + l))
    .join(eol);
  const insertAt = text[lineEnd - 1] === '\r' ? lineEnd - 1 : lineEnd;
  const insertion = `${eol}${indent}${body}${hasComma ? ',' : ''}`;
  let out = text.slice(0, insertAt) + insertion + text.slice(insertAt);
  if (!hasComma) {
    const commaAt = last.offset + last.length;
    out = out.slice(0, commaAt) + ',' + out.slice(commaAt);
  }
  return out;
}

function mergeList(
  text: string,
  key: 'configurations' | 'compounds',
  generated: Entry[],
  fmt: FormattingOptions,
  result: Pick<MergeResult, 'added' | 'updated' | 'unchanged'>
): string {
  let out = text;
  for (const entry of generated) {
    const errors: ParseError[] = [];
    const doc = parse(out, errors, { allowTrailingComma: true }) as Record<string, unknown>;
    const list = Array.isArray(doc[key]) ? (doc[key] as Entry[]) : null;
    const name = String(entry.name);
    if (list === null) {
      out = applyEdits(out, modify(out, [key], [entry], { formattingOptions: fmt }));
      result.added.push(name);
      continue;
    }
    const idx = list.findIndex(e => e && e.name === name);
    if (idx < 0) {
      out =
        appendToArray(out, key, entry, fmt) ??
        applyEdits(out, modify(out, [key, -1], entry, { formattingOptions: fmt, isArrayInsertion: true }));
      result.added.push(name);
    } else if (isDeepStrictEqual(list[idx], entry)) {
      result.unchanged.push(name);
    } else {
      out = applyEdits(out, modify(out, [key, idx], entry, { formattingOptions: fmt }));
      result.updated.push(name);
    }
  }
  return out;
}

/**
 * Merge generated configurations/compounds into `existing` launch.json text
 * (null when the file does not exist). Entries are matched by `name`; entries
 * with other names are left byte-for-byte untouched.
 *
 * @throws {LaunchJsonError} when the existing file is not valid JSONC.
 */
export function mergeLaunchJson(
  existing: string | null,
  configurations: Entry[],
  compounds: Entry[]
): MergeResult {
  const result: MergeResult = { text: '', created: existing === null, added: [], updated: [], unchanged: [], preserved: 0 };
  if (existing === null || existing.trim() === '') {
    const doc: Record<string, unknown> = { version: '0.2.0', configurations };
    if (compounds.length > 0) doc.compounds = compounds;
    result.text = JSON.stringify(doc, null, 2) + '\n';
    result.created = true;
    result.added = [...configurations, ...compounds].map(e => String(e.name));
    return result;
  }

  const errors: ParseError[] = [];
  const parsed = parse(existing, errors, { allowTrailingComma: true });
  if (errors.length > 0 || parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const why = errors.length > 0 ? errors.map(e => printParseErrorCode(e.error)).join(', ') : 'root is not an object';
    throw new LaunchJsonError(`Existing launch.json is not valid JSONC (${why}); refusing to overwrite it`);
  }
  const doc = parsed as Record<string, unknown>;
  const generatedNames = new Set([...configurations, ...compounds].map(e => String(e.name)));
  const existingEntries = [
    ...(Array.isArray(doc.configurations) ? (doc.configurations as Entry[]) : []),
    ...(Array.isArray(doc.compounds) ? (doc.compounds as Entry[]) : []),
  ];
  result.preserved = existingEntries.filter(e => !(e && generatedNames.has(String(e.name)))).length;

  const fmt = detectFormatting(existing);
  let text = existing;
  if (doc.version === undefined) {
    text = applyEdits(text, modify(text, ['version'], '0.2.0', { formattingOptions: fmt }));
  }
  text = mergeList(text, 'configurations', configurations, fmt, result);
  text = mergeList(text, 'compounds', compounds, fmt, result);
  result.text = text;
  return result;
}
