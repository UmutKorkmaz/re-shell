// Identifier helpers shared by every bridge generator.

/** Split an arbitrary string into word tokens (handles camel, snake, kebab, acronyms). */
export function words(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

/** `order-item` / `orderItem` / `order_item` -> `OrderItem`. Preserves existing inner capitals. */
export function toPascal(value: string): string {
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(value)) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return words(value)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

/** `OrderItem` / `order_item` -> `orderItem`; leading acronyms are lowered (`URLPath` -> `urlPath`). */
export function toCamel(value: string): string {
  const pascal = toPascal(value);
  if (!pascal) return pascal;
  if (/^[A-Z]+$/.test(pascal)) return pascal.toLowerCase();
  const lead = pascal.match(/^([A-Z]+)(?=[A-Z][a-z])/);
  if (lead) return lead[1].toLowerCase() + pascal.slice(lead[1].length);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** `OrderItem` / `orderItem` -> `order_item`. */
export function toSnake(value: string): string {
  return words(value)
    .map(w => w.toLowerCase())
    .join('_');
}

/** `order_item` -> `order-item`. */
export function toKebab(value: string): string {
  return toSnake(value).replace(/_/g, '-');
}

const TS_RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
  'else', 'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in',
  'instanceof', 'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try',
  'typeof', 'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'implements', 'interface',
  'package', 'private', 'protected', 'public', 'await', 'async', 'of', 'type', 'readonly',
]);

const PY_RESERVED = new Set([
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if', 'import',
  'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
  'with', 'yield', 'match', 'case', 'type', 'self', 'cls',
]);

const GO_RESERVED = new Set([
  'break', 'default', 'func', 'interface', 'select', 'case', 'defer', 'go', 'map', 'struct',
  'chan', 'else', 'goto', 'package', 'switch', 'const', 'fallthrough', 'if', 'range', 'type',
  'continue', 'for', 'import', 'return', 'var',
]);

/** Make `name` a legal TS identifier (reserved words get a trailing `_`). */
export function tsIdent(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_$]/g, '_');
  const safe = /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  return TS_RESERVED.has(safe) ? `${safe}_` : safe;
}

/** Make `name` a legal Python identifier. */
export function pyIdent(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  const safe = /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  return PY_RESERVED.has(safe) ? `${safe}_` : safe;
}

/** Make `name` a legal Go identifier. */
export function goIdent(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  const safe = /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned;
  return GO_RESERVED.has(safe) ? `${safe}_` : safe;
}

/** Go exported identifier (PascalCase, acronym-aware for ID/URL/HTTP...). */
export function goExported(name: string): string {
  const parts = words(name).map(w => {
    const up = w.toUpperCase();
    if (['ID', 'URL', 'URI', 'HTTP', 'API', 'JSON', 'UUID', 'IP', 'SQL', 'XML', 'HTML'].includes(up)) return up;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
  const joined = parts.join('') || 'X';
  return /^[0-9]/.test(joined) ? `X${joined}` : joined;
}

/** Escape text for inclusion inside a single-line TS/JS/Go `//` comment. */
export function oneLine(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Escape `*\/` sequences so text is safe inside a block comment / docstring. */
export function safeDoc(text: string | undefined): string {
  return oneLine(text).replace(/\*\//g, '*\\/').replace(/"""/g, '\\"\\"\\"');
}
