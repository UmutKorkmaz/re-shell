// Naming helpers for the `re-shell ui component|generate` scaffolders.

/** Split an identifier / phrase into lowercase words (camelCase, snake, kebab, spaces). */
export function splitWords(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());
}

/** `service status` -> `ServiceStatus`. */
export function toPascal(input: string): string {
  return splitWords(input)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join('');
}

/** `ServiceStatus` -> `service-status`. */
export function toKebab(input: string): string {
  return splitWords(input).join('-');
}

/** `service status` -> `serviceStatus` (always a valid identifier start). */
export function toCamel(input: string): string {
  const pascal = toPascal(input);
  const camel = pascal ? pascal[0].toLowerCase() + pascal.slice(1) : '';
  return /^[a-z]/.test(camel) ? camel : `field${pascal}`;
}

/** `portNumber` -> `Port number`. */
export function toLabel(input: string): string {
  const words = splitWords(input);
  if (words.length === 0) return '';
  const text = words.join(' ');
  return text[0].toUpperCase() + text.slice(1);
}

/** A component name must be PascalCase and a safe identifier. */
export const COMPONENT_NAME_RE = /^[A-Z][A-Za-z0-9]{0,63}$/;

/** True for a valid PascalCase component name. */
export function isValidComponentName(name: string): boolean {
  return COMPONENT_NAME_RE.test(name);
}

/** Identifiers that cannot be used as a generated field / prop name. */
export const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'enum',
  'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new', 'null',
  'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
  'let', 'static', 'implements', 'interface', 'package', 'private', 'protected', 'public', 'await', 'async',
]);
