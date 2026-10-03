// Small HCL emission helpers (strings, identifiers, literals) plus a
// structural sanity checker used when `terraform` itself is unavailable.

/** Escape a JS string as an HCL quoted string literal (no interpolation). */
export function hclString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    // function replacers: in a replacement *string* `$$` collapses to a single `$`
    .replace(/\$\{/g, () => '$${')
    .replace(/%\{/g, () => '%%{');
  return `"${escaped}"`;
}

/** A raw HCL expression (emitted verbatim by {@link hclValue}, or rendered lazily with the current indent). */
export class Raw {
  constructor(private readonly source: string | ((indent: string) => string)) {}
  render(indent: string): string {
    return typeof this.source === 'string' ? this.source : this.source(indent);
  }
}
export const raw = (expr: string): Raw => new Raw(expr);

/** `fn(<value>)`, with the argument rendered at the call site's indent (e.g. jsonencode(...)). */
export const call = (fn: string, value: HclValue): Raw => new Raw(indent => `${fn}(${hclValue(value, indent)})`);

/**
 * Quoted string that may contain `${...}` interpolations (the caller guarantees
 * they are valid expressions). Quotes and backslashes are escaped outside
 * interpolations only; inside `${ ... }` the expression is copied verbatim.
 */
export function hclTemplate(template: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < template.length; i++) {
    const c = template[i];
    if (depth === 0) {
      if (c === '$' && template[i + 1] === '{') {
        depth = 1;
        out += '${';
        i++;
      } else if (c === '$' && template[i + 1] === '$' && template[i + 2] === '{') {
        out += '$${'; // already-escaped literal
        i += 2;
      } else if (c === '\\') out += '\\\\';
      else if (c === '"') out += '\\"';
      else if (c === '\n') out += '\\n';
      else out += c;
    } else {
      if (c === '{') depth++;
      else if (c === '}') depth--;
      out += c;
    }
  }
  return `"${out}"`;
}

export type HclValue = string | number | boolean | null | Raw | HclValue[] | { [key: string]: HclValue };

/** Render a value as an HCL expression with the given indent (for maps/lists). */
export function hclValue(value: HclValue, indent = ''): string {
  if (value instanceof Raw) return value.render(indent);
  if (value === null) return 'null';
  if (typeof value === 'string') return hclString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map(v => `${indent}  ${hclValue(v, indent + '  ')},`).join('\n');
    return `[\n${inner}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return '{}';
  const rendered = entries.map(([k, v]) => ({ key: mapKey(k), value: hclValue(v, indent + '  ') }));
  return `{\n${alignAssignments(rendered, indent + '  ')}\n${indent}}`;
}

/**
 * Render `key = value` lines aligned the way `terraform fmt` does: consecutive
 * single-line values share one `=` column; a multi-line value is not aligned
 * and ends the run.
 */
function alignAssignments(rows: Array<{ key: string; value: string }>, indent: string): string {
  const out: string[] = [];
  let run: Array<{ key: string; value: string }> = [];
  const flush = (): void => {
    const width = Math.max(0, ...run.map(r => r.key.length));
    for (const r of run) out.push(`${indent}${r.key.padEnd(width)} = ${r.value}`);
    run = [];
  };
  for (const row of rows) {
    if (row.value.includes('\n')) {
      flush();
      out.push(`${indent}${row.key} = ${row.value}`);
    } else run.push(row);
  }
  flush();
  return out.join('\n');
}

function mapKey(k: string): string {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k) ? k : hclString(k);
}

// --------------------------------------------------------------------------
// Block builder (output is `terraform fmt` clean)
// --------------------------------------------------------------------------

export type Item =
  | { kind: 'attr'; key: string; value: HclValue }
  | { kind: 'block'; type: string; labels: string[]; items: Item[] }
  | { kind: 'blank' }
  | { kind: 'comment'; text: string };

export const attr = (key: string, value: HclValue): Item => ({ kind: 'attr', key, value });
export const block = (type: string, labels: string[], items: Item[]): Item => ({ kind: 'block', type, labels, items });
export const blank = (): Item => ({ kind: 'blank' });
export const comment = (text: string): Item => ({ kind: 'comment', text });

function renderItems(items: Item[], indent: string): string[] {
  const lines: string[] = [];
  let run: Array<{ key: string; value: string }> = [];
  const flush = (): void => {
    if (run.length === 0) return;
    lines.push(alignAssignments(run, indent));
    run = [];
  };
  for (const item of items) {
    if (item.kind === 'attr') {
      const rendered = hclValue(item.value, indent);
      if (rendered.includes('\n')) {
        flush();
        lines.push(`${indent}${item.key} = ${rendered}`);
      } else run.push({ key: item.key, value: rendered });
      continue;
    }
    flush();
    if (item.kind === 'blank') lines.push('');
    else if (item.kind === 'comment') lines.push(`${indent}# ${item.text}`);
    else lines.push(...renderBlockLines(item, indent));
  }
  flush();
  return lines;
}

function renderBlockLines(b: { type: string; labels: string[]; items: Item[] }, indent: string): string[] {
  const head = [b.type, ...b.labels.map(l => hclString(l))].join(' ');
  if (b.items.length === 0) return [`${indent}${head} {}`];
  return [`${indent}${head} {`, ...renderItems(b.items, indent + '  '), `${indent}}`];
}

/** Render top-level blocks separated by blank lines, ending with a newline. */
export function renderFile(blocks: Item[]): string {
  const parts = blocks.map(b => {
    if (b.kind === 'block') return renderBlockLines(b, '').join('\n');
    if (b.kind === 'comment') return `# ${b.text}`;
    if (b.kind === 'attr') return `${b.key} = ${hclValue(b.value)}`;
    return '';
  });
  return parts.join('\n\n') + '\n';
}

/** Terraform resource label for a service name (labels must not start with a digit). */
export function label(name: string): string {
  const l = name.replace(/[^A-Za-z0-9_-]/g, '_');
  return /^[0-9]/.test(l) ? `_${l}` : l;
}

// --------------------------------------------------------------------------
// Structural checker
// --------------------------------------------------------------------------

export interface HclStructureIssue {
  line: number;
  message: string;
}

/**
 * Lightweight structural check of HCL source: balanced braces/brackets/parens
 * outside strings, comments and heredocs, terminated strings and heredocs, and
 * top-level constructs that are blocks (`ident [labels] {`) or attributes.
 * It is NOT a full HCL parser and does not replace `terraform validate`.
 */
export function checkHclStructure(source: string): HclStructureIssue[] {
  const issues: HclStructureIssue[] = [];
  const stack: Array<{ ch: string; line: number }> = [];
  const closers: Record<string, string> = { '}': '{', ']': '[', ')': '(' };
  let line = 1;
  let i = 0;
  const n = source.length;
  let heredoc: { tag: string; line: number } | null = null;

  const skipTemplateInterp = (): void => {
    // inside "${ ... }": track nested braces until the matching close
    let depth = 1;
    i += 2;
    while (i < n && depth > 0) {
      const c = source[i];
      if (c === '\n') line++;
      if (c === '"') {
        skipString();
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      i++;
    }
  };
  const skipString = (): void => {
    const start = line;
    i++; // opening quote
    while (i < n) {
      const c = source[i];
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '\n') {
        issues.push({ line: start, message: 'unterminated string literal' });
        return;
      }
      if (c === '"') {
        i++;
        return;
      }
      if ((c === '$' || c === '%') && source[i + 1] === '{' && source[i - 1] !== c) {
        skipTemplateInterp();
        continue;
      }
      if ((c === '$' || c === '%') && source[i + 1] === c && source[i + 2] === '{') {
        i += 3; // escaped $${ / %%{
        continue;
      }
      i++;
    }
    issues.push({ line: start, message: 'unterminated string literal' });
  };

  while (i < n) {
    const c = source[i];
    if (heredoc) {
      // consume until a line that is exactly the tag (optionally indented)
      const eol = source.indexOf('\n', i);
      const text = source.slice(i, eol < 0 ? n : eol);
      if (text.trim() === heredoc.tag) heredoc = null;
      i = eol < 0 ? n : eol + 1;
      line++;
      continue;
    }
    if (c === '\n') {
      line++;
      i++;
      continue;
    }
    if (c === '#' || (c === '/' && source[i + 1] === '/')) {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) {
        issues.push({ line, message: 'unterminated block comment' });
        break;
      }
      line += (source.slice(i, end).match(/\n/g) ?? []).length;
      i = end + 2;
      continue;
    }
    if (c === '"') {
      skipString();
      continue;
    }
    if (c === '<' && source[i + 1] === '<') {
      const m = /^<<-?([A-Za-z_][A-Za-z0-9_]*)[ \t]*\r?\n/.exec(source.slice(i));
      if (m) {
        heredoc = { tag: m[1], line };
        i += m[0].length;
        line++;
        continue;
      }
    }
    if (c === '{' || c === '[' || c === '(') stack.push({ ch: c, line });
    else if (c === '}' || c === ']' || c === ')') {
      const top = stack.pop();
      if (!top) issues.push({ line, message: `unexpected "${c}"` });
      else if (top.ch !== closers[c]) issues.push({ line, message: `mismatched "${c}" (opened "${top.ch}" on line ${top.line})` });
    }
    i++;
  }
  if (heredoc) issues.push({ line: heredoc.line, message: `unterminated heredoc <<${heredoc.tag}` });
  for (const open of stack) issues.push({ line: open.line, message: `unclosed "${open.ch}"` });

  // top-level constructs
  if (issues.length === 0) {
    let depth = 0;
    let inHeredoc: string | null = null;
    const lines = source.split(/\r?\n/);
    lines.forEach((raw, idx) => {
      const text = raw.trim();
      if (inHeredoc) {
        if (text === inHeredoc) inHeredoc = null;
        return;
      }
      const h = /<<-?([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(text);
      if (depth === 0 && text && !text.startsWith('#') && !text.startsWith('//') && !text.startsWith('/*') && !text.startsWith('*')) {
        const block = /^[A-Za-z_][\w-]*(\s+("[^"]*"|[A-Za-z_][\w-]*))*\s*\{/.test(text);
        const attr = /^[A-Za-z_][\w-]*\s*=/.test(text);
        if (!block && !attr) issues.push({ line: idx + 1, message: `unexpected top-level text: ${text.slice(0, 60)}` });
      }
      if (h) inHeredoc = h[1];
      // depth tracking outside strings is approximated line-wise: strip strings/comments first
      const stripped = text.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/(#|\/\/).*$/, '');
      for (const ch of stripped) {
        if (ch === '{' || ch === '[' || ch === '(') depth++;
        else if (ch === '}' || ch === ']' || ch === ')') depth--;
      }
    });
  }
  return issues;
}
