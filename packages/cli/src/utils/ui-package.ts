// Locate the UI package (@re-shell/ui conventions) and write generated components into it.
//
// Shared by `re-shell ui component new` and `re-shell ui generate`.

import * as fs from 'fs';
import * as path from 'path';
import { toKebab } from './ui-names';
import type { ComponentGroup, GeneratedFiles } from './ui-component-templates';

/** Raised for every scaffold failure so the commands can emit UI_COMPONENT_ERROR / UI_GENERATE_ERROR. */
export class UiScaffoldError extends Error {
  readonly details?: Record<string, unknown>;
  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'UiScaffoldError';
    this.details = details;
  }
}

/** A located UI package. */
export interface UiPackage {
  readonly dir: string;
  readonly name: string;
}

const SEARCH_PARENTS = ['packages', 'apps', 'libs'];

function readName(dir: string): string | undefined {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: unknown };
    return typeof pkg.name === 'string' ? pkg.name : undefined;
  } catch {
    return undefined;
  }
}

/** A directory follows the @re-shell/ui layout when it has `src/components/ui` and a package.json. */
function isUiPackage(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'src', 'components', 'ui'));
}

/**
 * Find the UI package: `explicit`, else the workspace itself, `packages/ui`, or a single
 * `packages/* | apps/* | libs/*` directory that follows the @re-shell/ui layout.
 *
 * @throws {UiScaffoldError} when none (or several ambiguous ones) are found
 */
export function findUiPackage(workspace: string, explicit?: string): UiPackage {
  const root = path.resolve(workspace);
  if (explicit !== undefined) {
    const dir = path.resolve(root, explicit);
    if (!isUiPackage(dir)) {
      throw new UiScaffoldError(`--ui ${explicit}: ${dir} is not a UI package (needs package.json and src/components/ui)`, { dir });
    }
    return { dir, name: readName(dir) ?? path.basename(dir) };
  }
  const candidates: string[] = [];
  if (isUiPackage(root)) candidates.push(root);
  for (const parent of SEARCH_PARENTS) {
    const parentDir = path.join(root, parent);
    if (!fs.existsSync(parentDir)) continue;
    for (const entry of fs.readdirSync(parentDir, { withFileTypes: true })) {
      const dir = path.join(parentDir, entry.name);
      if (entry.isDirectory() && isUiPackage(dir)) candidates.push(dir);
    }
  }
  const named = candidates.filter((dir) => readName(dir) === '@re-shell/ui');
  const pick = named.length === 1 ? named : candidates;
  if (pick.length === 0) {
    throw new UiScaffoldError(
      `no UI package found under ${root} (looked for a package with src/components/ui in the workspace, packages/*, apps/*, libs/*); pass --ui <dir>`
    );
  }
  if (pick.length > 1) {
    throw new UiScaffoldError(
      `several UI packages found (${pick.map((d) => path.relative(root, d) || '.').join(', ')}); choose one with --ui <dir>`,
      { candidates: pick }
    );
  }
  return { dir: pick[0], name: readName(pick[0]) ?? path.basename(pick[0]) };
}

/** Absolute paths of the three files for a component. */
export function componentPaths(pkg: UiPackage, group: ComponentGroup, name: string): Record<keyof GeneratedFiles, string> {
  const base = path.join(pkg.dir, 'src', 'components', group, toKebab(name));
  return { component: `${base}.tsx`, story: `${base}.stories.tsx`, test: `${base}.test.tsx` };
}

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|stories|test-d)\./.test(entry.name)) yield full;
  }
}

/**
 * Refuse names/files that already exist: an existing component file of the same
 * name, or any exported symbol of that name elsewhere in the package.
 *
 * @throws {UiScaffoldError} on a collision (unless `force` is set for files)
 */
export function assertNoCollision(pkg: UiPackage, group: ComponentGroup, name: string, force: boolean): void {
  const paths = componentPaths(pkg, group, name);
  if (!force) {
    for (const file of Object.values(paths)) {
      if (fs.existsSync(file)) {
        throw new UiScaffoldError(`${path.relative(pkg.dir, file)} already exists; choose another --name or pass --force`, { file });
      }
    }
  }
  const declaration = new RegExp(`\\b(?:const|function|class|interface|type)\\s+${name}\\b`);
  const components = path.join(pkg.dir, 'src');
  if (fs.existsSync(components)) {
    for (const file of walk(components)) {
      if (Object.values(paths).includes(file)) continue;
      if (declaration.test(fs.readFileSync(file, 'utf8'))) {
        throw new UiScaffoldError(
          `a symbol named ${name} is already declared in ${path.relative(pkg.dir, file)}; choose another --name`,
          { file }
        );
      }
    }
  }
}

/** Insert `export * from './<kebab>';` into the group's barrel, keeping it sorted. Returns the new text. */
export function addBarrelExport(existing: string | undefined, kebab: string): string {
  const line = `export * from './${kebab}';`;
  const lines = (existing ?? '').split('\n').filter((l) => l.trim() !== '');
  if (lines.includes(line)) return `${lines.join('\n')}\n`;
  const exports = lines.filter((l) => /^export \* from /.test(l));
  const others = lines.filter((l) => !/^export \* from /.test(l));
  exports.push(line);
  exports.sort((a, b) => a.localeCompare(b));
  return `${[...others, ...exports].join('\n')}\n`;
}

/** What {@link writeComponent} wrote (or would write). */
export interface WriteResult {
  readonly files: string[];
  readonly barrel: string;
  readonly dryRun: boolean;
}

/**
 * Write the component, story and test and register the component in the group's barrel.
 * With `dryRun` nothing touches the disk.
 */
export function writeComponent(
  pkg: UiPackage,
  group: ComponentGroup,
  name: string,
  files: GeneratedFiles,
  options: { dryRun?: boolean } = {}
): WriteResult {
  const paths = componentPaths(pkg, group, name);
  const barrelPath = path.join(pkg.dir, 'src', 'components', group, 'index.ts');
  const barrel = addBarrelExport(fs.existsSync(barrelPath) ? fs.readFileSync(barrelPath, 'utf8') : undefined, toKebab(name));
  const result: WriteResult = {
    files: [paths.component, paths.story, paths.test].map((p) => path.relative(pkg.dir, p)),
    barrel: path.relative(pkg.dir, barrelPath),
    dryRun: Boolean(options.dryRun),
  };
  if (options.dryRun) return result;

  fs.mkdirSync(path.dirname(paths.component), { recursive: true });
  fs.writeFileSync(paths.component, files.component);
  fs.writeFileSync(paths.story, files.story);
  fs.writeFileSync(paths.test, files.test);
  fs.writeFileSync(barrelPath, barrel);
  return result;
}
