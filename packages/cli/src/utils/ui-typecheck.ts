// Typecheck generated component sources BEFORE they are written.
//
// The sources are laid out in a temporary overlay of the UI package, under
// `<ui>/node_modules/.cache/re-shell/ui-generate-*`, so module resolution finds the
// package's own dependencies (react, radix, vitest, storybook, ...). The overlay's
// tsconfig maps the `@/*` alias to the overlay first and the real `src/` second, so
// the generated files compile against the package's REAL components, utilities and
// tsconfig strictness, without the package being modified. tsc runs with `--noEmit`;
// only diagnostics located in the generated files are reported.

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { toKebab } from './ui-names';
import type { ComponentGroup, GeneratedFiles } from './ui-component-templates';
import type { UiPackage } from './ui-package';
import { UiScaffoldError } from './ui-package';

/** One compiler diagnostic. */
export interface TypecheckDiagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  readonly code: string;
  readonly message: string;
}

/** Result of {@link typecheckComponent}. */
export interface TypecheckResult {
  readonly ok: boolean;
  readonly diagnostics: TypecheckDiagnostic[];
  readonly durationMs: number;
  /** Tail of the raw compiler output (diagnostics outside the generated files included). */
  readonly output: string;
}

const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/** Parse `tsc` output into diagnostics located under `onlyInside`. */
export function parseTscOutput(output: string, onlyInside: string, relativeTo: string): TypecheckDiagnostic[] {
  const diagnostics: TypecheckDiagnostic[] = [];
  for (const line of output.split('\n')) {
    const match = DIAGNOSTIC.exec(line.trim());
    if (!match) continue;
    const file = path.resolve(relativeTo, match[1]);
    if (!file.startsWith(onlyInside + path.sep)) continue;
    diagnostics.push({
      file: path.relative(onlyInside, file),
      line: Number(match[2]),
      column: Number(match[3]),
      code: match[4],
      message: match[5],
    });
  }
  return diagnostics;
}

/** Locate the TypeScript compiler script (`typescript/bin/tsc`) of the UI package. */
function findTsc(pkg: UiPackage): string {
  for (const dir of [pkg.dir, path.join(pkg.dir, '..', '..')]) {
    const candidate = path.join(dir, 'node_modules', 'typescript', 'bin', 'tsc');
    if (fs.existsSync(candidate)) return fs.realpathSync(candidate);
  }
  throw new UiScaffoldError(
    `cannot typecheck generated code: TypeScript is not installed for ${pkg.name} (run your package manager install first)`
  );
}

/**
 * Typecheck the three generated files of one component against `pkg`.
 *
 * @throws {UiScaffoldError} when tsc cannot be found or run
 */
export async function typecheckComponent(
  pkg: UiPackage,
  group: ComponentGroup,
  name: string,
  files: GeneratedFiles,
  timeoutMs = 120_000
): Promise<TypecheckResult> {
  const tsc = findTsc(pkg);
  const cacheRoot = path.join(pkg.dir, 'node_modules', '.cache', 're-shell');
  fs.mkdirSync(cacheRoot, { recursive: true });
  const overlay = fs.mkdtempSync(path.join(cacheRoot, 'ui-generate-'));
  const started = Date.now();
  try {
    const kebab = toKebab(name);
    const target = path.join(overlay, 'src', 'components', group);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, `${kebab}.tsx`), files.component);
    fs.writeFileSync(path.join(target, `${kebab}.stories.tsx`), files.story);
    fs.writeFileSync(path.join(target, `${kebab}.test.tsx`), files.test);

    const base = path.join(pkg.dir, 'tsconfig.json');
    fs.writeFileSync(
      path.join(overlay, 'tsconfig.json'),
      JSON.stringify({
        extends: base,
        compilerOptions: {
          noEmit: true,
          composite: false,
          declaration: false,
          declarationMap: false,
          incremental: false,
          rootDir: null,
          outDir: null,
          baseUrl: overlay,
          paths: { '@/*': ['./src/*', path.join(pkg.dir, 'src', '*')] },
        },
        // The package's ambient test typings (vitest-axe matchers) ride along.
        include: ['src', path.join(pkg.dir, 'src', 'test', 'vitest-axe.ts')].filter(
          (entry) => !entry.startsWith(pkg.dir) || fs.existsSync(entry)
        ),
        exclude: [],
      })
    );

    const { output, code } = await new Promise<{ output: string; code: number | null }>((resolve, reject) => {
      const child = spawn(process.execPath, [tsc, '-p', overlay], { cwd: overlay, stdio: ['ignore', 'pipe', 'pipe'] });
      let text = '';
      child.stdout.on('data', (chunk: Buffer) => (text += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (text += chunk.toString()));
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new UiScaffoldError(`typecheck timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(new UiScaffoldError(`could not run tsc: ${error.message}`));
      });
      child.once('close', (exitCode) => {
        clearTimeout(timer);
        resolve({ output: text, code: exitCode });
      });
    });

    const diagnostics = parseTscOutput(output, path.join(overlay, 'src'), overlay);
    // A non-zero exit with no compiler diagnostics at all (crash, bad config) must not read as
    // success. (Diagnostics in OTHER files are pre-existing problems, not this component's.)
    if (code !== 0 && !/error TS\d+/.test(output)) {
      throw new UiScaffoldError(`tsc could not typecheck the generated code (exit ${code}): ${output.trim().split('\n')[0] ?? ''}`);
    }
    // A config-level error (TS5xxx / TS6xxx / TS18xxx) means nothing was really checked.
    if (diagnostics.length === 0 && /error TS(?:5\d{3}|6\d{3}|18\d{3})/.test(output)) {
      throw new UiScaffoldError(`tsc could not typecheck the generated code: ${output.trim().split('\n')[0]}`);
    }
    return { ok: diagnostics.length === 0, diagnostics, durationMs: Date.now() - started, output: output.trim().slice(-4000) };
  } finally {
    fs.rmSync(overlay, { recursive: true, force: true });
  }
}
