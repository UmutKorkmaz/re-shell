// Format-preserving YAML scalar edits. Documents are parsed with the `yaml`
// package only to locate scalars; replacements are spliced into the original
// text by source range, so comments, quoting, indentation and key order are
// left byte-for-byte intact.

import { isAlias, isMap, isScalar, isSeq, parseAllDocuments, type Node } from 'yaml';

export type YamlPathPart = string | number;

export interface ScalarVisit {
  /** Scalar value (always a string here; non-strings are skipped). */
  value: string;
  /** Path to the scalar's container: for a map key, the map; for a value, the value itself. */
  path: YamlPathPart[];
  isKey: boolean;
  /** Index of the YAML document within the stream. */
  docIndex: number;
  /** The document root as plain JS (for ownership checks). */
  root: unknown;
}

interface Splice {
  start: number;
  end: number;
  text: string;
}

/**
 * Visit every string scalar in every document of `text`. `fn` returns the
 * replacement value (or undefined to leave it). Returns the edited text, or
 * the original string when nothing changed or the text is not valid YAML.
 */
export function editYamlScalars(
  text: string,
  fn: (visit: ScalarVisit) => string | undefined
): { text: string; changed: boolean; parsed: boolean } {
  const docs = parseAllDocuments(text);
  if (docs.some(d => d.errors.length > 0)) return { text, changed: false, parsed: false };
  const splices: Splice[] = [];

  docs.forEach((doc, docIndex) => {
    const root = doc.toJS({ maxAliasCount: -1 });
    const walk = (node: unknown, p: YamlPathPart[], isKey: boolean): void => {
      if (node === null || node === undefined) return;
      if (isAlias(node)) return;
      if (isMap(node)) {
        for (const pair of node.items) {
          if (pair.key !== undefined) walk(pair.key, p, true);
          const keyName = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
          if (pair.value !== undefined) walk(pair.value, [...p, keyName], false);
        }
        return;
      }
      if (isSeq(node)) {
        node.items.forEach((item, i) => walk(item, [...p, i], false));
        return;
      }
      if (isScalar(node) && typeof node.value === 'string' && node.range) {
        const next = fn({ value: node.value, path: p, isKey, docIndex, root });
        if (next === undefined || next === node.value) return;
        const [start, end] = node.range;
        const raw = text.slice(start, end);
        let replacement: string;
        if (node.type === 'QUOTE_DOUBLE') replacement = JSON.stringify(next);
        else if (node.type === 'QUOTE_SINGLE') replacement = `'${next.replace(/'/g, "''")}'`;
        else if (node.type === 'PLAIN') replacement = next;
        else {
          // Block scalars: only simple in-place value replacement of the exact text.
          if (!raw.includes(node.value)) return;
          replacement = raw.replace(node.value, next);
        }
        splices.push({ start, end, text: replacement });
      }
    };
    walk(doc.contents as Node | null, [], false);
  });

  if (splices.length === 0) return { text, changed: false, parsed: true };
  splices.sort((a, b) => b.start - a.start);
  let out = text;
  for (const s of splices) out = out.slice(0, s.start) + s.text + out.slice(s.end);
  return { text: out, changed: out !== text, parsed: true };
}

/** Parse every YAML document of `text` to plain JS values (empty array on a parse error). */
export function parseYamlDocs(text: string): unknown[] {
  const docs = parseAllDocuments(text);
  if (docs.some(d => d.errors.length > 0)) return [];
  return docs.map(d => d.toJS({ maxAliasCount: -1 }));
}
