import fs from 'node:fs';
import path from 'node:path';
import { glob, globSync, hasMagic, type GlobOptionsWithFileTypesFalse } from 'glob';

/** Options used by the CLI's file discovery and cache collectors. */
export interface FileGlobOptions {
  cwd?: string;
  absolute?: boolean;
  dot?: boolean;
  onlyFiles?: boolean;
  followSymbolicLinks?: boolean;
  ignore?: readonly string[];
  deep?: number;
}

function queries(patterns: string | readonly string[], options: FileGlobOptions) {
  const all = typeof patterns === 'string' ? [patterns] : [...patterns];
  const negative = (pattern: string) => pattern.startsWith('!') && !pattern.startsWith('!(');
  const ignore = [...(options.ignore ?? []), ...all.filter(negative).map(p => p.slice(1))];
  return all.filter(p => !negative(p)).map(pattern => {
    const settings: GlobOptionsWithFileTypesFalse = {
      cwd: options.cwd,
      absolute: options.absolute,
      dot: options.dot,
      nodir: options.onlyFiles ?? true,
      follow: options.followSymbolicLinks ?? true,
      posix: true,
      ignore,
    };
    if (options.deep !== undefined && Number.isFinite(options.deep)) {
      // Depth starts at each pattern's static directory, as in the previous
      // collector. A literal filename does not require recursive traversal.
      const relative = path.isAbsolute(pattern) ? path.relative(options.cwd ?? process.cwd(), pattern) : pattern;
      const segments = relative.split('/');
      const magic = segments.findIndex(segment => hasMagic(segment, { magicalBraces: true }));
      if (magic !== -1) settings.maxDepth = magic + Math.max(1, options.deep);
    }
    return { pattern, settings };
  });
}

function withoutSymlinks(files: string[], options: FileGlobOptions): string[] {
  const unique = [...new Set(files)].sort();
  if (options.followSymbolicLinks !== false) return unique;
  const cwd = path.resolve(options.cwd ?? process.cwd());
  return unique.filter(file => {
    let current = cwd;
    for (const segment of path.relative(cwd, path.resolve(cwd, file)).split(path.sep)) {
      current = path.join(current, segment);
      try {
        if (fs.lstatSync(current).isSymbolicLink()) return false;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
      }
    }
    return true;
  });
}

async function collect(patterns: string | readonly string[], options: FileGlobOptions = {}): Promise<string[]> {
  const groups = await Promise.all(queries(patterns, options).map(({ pattern, settings }) => glob(pattern, settings)));
  return withoutSymlinks(groups.flat(), options);
}

function collectSync(patterns: string | readonly string[], options: FileGlobOptions = {}): string[] {
  const groups = queries(patterns, options).map(({ pattern, settings }) => globSync(pattern, settings));
  return withoutSymlinks(groups.flat(), options);
}

/** File discovery without the unpatched recursive braces parser in fast-glob. */
export default Object.assign(collect, { sync: collectSync });
