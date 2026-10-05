/**
 * Builds the workspace {@link GraphModel} from a directory on disk or from the
 * state of a git ref, with no network and no checkout of the whole tree.
 *
 * Git refs are read through plain `git` plumbing (`rev-parse`, `ls-tree`,
 * `cat-file --batch`): only the handful of manifest files the graph depends on
 * are materialised into a temp directory, then the SAME loader that reads the
 * working tree runs over it. That keeps "graph at ref" and "graph now"
 * byte-for-byte comparable.
 */

import { execFile, spawn } from 'child_process';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { isSafeGraphRef, normalizeGraph, parseGraphDocument } from '@re-shell/contracts';
import type { GraphModel, GraphModelEdge, GraphModelNode } from '@re-shell/contracts';
import { getWorkspaces, findMonorepoRoot, LANGUAGE_MARKERS } from './monorepo';

export { detectWorkspaceLanguage } from './monorepo';

/** Every manifest the graph loader may read; the git materialiser copies exactly these. */
export const GRAPH_MANIFEST_FILES = new Set<string>([
  'package.json',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  ...LANGUAGE_MARKERS.map(([file]) => file),
]);

const execFileAsync = promisify(execFile);

/** Error with a stable machine-readable code (mapped to JSON envelope error codes). */
export class GraphSourceError extends Error {
  constructor(
    readonly code:
      | 'GRAPH_DIFF_INVALID_REF'
      | 'GRAPH_DIFF_GIT_ERROR'
      | 'GRAPH_DIFF_INVALID_INPUT'
      | 'NOT_IN_MONOREPO',
    message: string
  ) {
    super(message);
    this.name = 'GraphSourceError';
  }
}

// ─── Working tree ────────────────────────────────────────────────────────────

/**
 * Load the graph of the monorepo rooted at `root`: one node per workspace, one
 * edge per workspace-to-workspace dependency (production or dev). O(V + E).
 */
export async function loadGraphModel(root: string): Promise<GraphModel> {
  const workspaces = await getWorkspaces(root);
  const byName = new Map(workspaces.map((ws) => [ws.name, ws]));

  const nodes: GraphModelNode[] = workspaces.map((ws) => ({
    id: ws.name,
    type: ws.type,
    framework: ws.framework ?? null,
    language: ws.language ?? null,
    path: ws.path,
  }));

  const edges: GraphModelEdge[] = [];
  const BATCH = 64;
  for (let i = 0; i < workspaces.length; i += BATCH) {
    const batch = workspaces.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (ws): Promise<GraphModelEdge[]> => {
        try {
          const pkg = JSON.parse(await fs.readFile(path.join(root, ws.path, 'package.json'), 'utf8')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
          };
          const out: GraphModelEdge[] = [];
          const names = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]);
          for (const dep of names) {
            if (byName.has(dep)) {
              out.push({ from: ws.name, to: dep, type: pkg.dependencies?.[dep] ? 'dependency' : 'devDependency' });
            }
          }
          return out;
        } catch {
          return [];
        }
      })
    );
    for (const list of results) edges.push(...list);
  }
  return normalizeGraph({ nodes, edges });
}

// ─── Git refs ────────────────────────────────────────────────────────────────

async function git(cwd: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    });
    return stdout;
  } catch (error) {
    const e = error as NodeJS.ErrnoException & { stderr?: string };
    if (e.code === 'ENOENT') {
      throw new GraphSourceError('GRAPH_DIFF_GIT_ERROR', '`git` was not found on PATH');
    }
    const detail = (e.stderr ?? e.message ?? '').toString().trim().split('\n')[0];
    throw new GraphSourceError('GRAPH_DIFF_GIT_ERROR', `git ${args[0]} failed: ${detail}`);
  }
}

/** Result of resolving a ref to an immutable commit. */
export interface ResolvedRef {
  commit: string;
}

/**
 * Resolve `ref` to a commit sha. The ref is validated against a strict charset
 * (never starts with `-`, no `..`, no whitespace) and passed after
 * `--end-of-options`, so it can only ever be read as a revision.
 */
export async function resolveGitRef(cwd: string, ref: string): Promise<ResolvedRef> {
  if (!isSafeGraphRef(ref)) {
    throw new GraphSourceError(
      'GRAPH_DIFF_INVALID_REF',
      `Invalid git ref "${ref}": use letters, digits and . _ / @ ^ ~ + - only (no leading "-", no "..")`
    );
  }
  try {
    const out = await git(cwd, ['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]);
    const commit = out.trim();
    if (!/^[0-9a-f]{40,64}$/.test(commit)) throw new Error('unexpected rev-parse output');
    return { commit };
  } catch (error) {
    if (error instanceof GraphSourceError && /was not found on PATH/.test(error.message)) throw error;
    throw new GraphSourceError('GRAPH_DIFF_INVALID_REF', `"${ref}" is not a known git ref (or is not a commit) in this repository`);
  }
}

/** Read blobs by `<rev>:<path>` through one `git cat-file --batch` process. */
async function catFileBatch(cwd: string, specs: string[]): Promise<Array<Buffer | null>> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['cat-file', '--batch'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    let stderr = '';
    child.stdout.on('data', (c: Buffer) => chunks.push(c));
    child.stderr.on('data', (c: Buffer) => (stderr += c.toString()));
    child.on('error', (err: NodeJS.ErrnoException) =>
      reject(
        new GraphSourceError(
          'GRAPH_DIFF_GIT_ERROR',
          err.code === 'ENOENT' ? '`git` was not found on PATH' : `git cat-file failed: ${err.message}`
        )
      )
    );
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new GraphSourceError('GRAPH_DIFF_GIT_ERROR', `git cat-file failed (exit ${code}): ${stderr.trim()}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      const out: Array<Buffer | null> = [];
      let pos = 0;
      for (let i = 0; i < specs.length; i++) {
        const nl = buf.indexOf(0x0a, pos);
        if (nl < 0) {
          reject(new GraphSourceError('GRAPH_DIFF_GIT_ERROR', 'git cat-file produced truncated output'));
          return;
        }
        const header = buf.subarray(pos, nl).toString('utf8');
        pos = nl + 1;
        if (/ missing$/.test(header)) {
          out.push(null);
          continue;
        }
        const size = Number(header.split(' ')[2]);
        if (!Number.isInteger(size)) {
          reject(new GraphSourceError('GRAPH_DIFF_GIT_ERROR', `git cat-file: unexpected header "${header}"`));
          return;
        }
        out.push(buf.subarray(pos, pos + size));
        pos += size + 1; // trailing LF
      }
      resolve(out);
    });
    child.stdin.end(specs.map((s) => `${s}\n`).join(''));
  });
}

/**
 * Build the graph of the monorepo as it exists at `commit`. `root` is the
 * monorepo root directory in the working tree (it may be a subdirectory of the
 * git repository). Materialises only manifest files into a temp dir.
 */
export async function loadGraphModelAtCommit(root: string, commit: string): Promise<GraphModel> {
  const toplevel = (await git(root, ['rev-parse', '--show-toplevel'])).trim();
  const realRoot = await fs.realpath(root);
  const realTop = await fs.realpath(toplevel);
  const prefix = path.relative(realTop, realRoot).split(path.sep).join('/');

  const listing = await git(root, ['ls-tree', '-r', '-z', '--full-tree', commit]);
  const wanted: Array<{ rel: string; gitPath: string }> = [];
  for (const entry of listing.split('\0')) {
    if (!entry) continue;
    const tab = entry.indexOf('\t');
    const [mode, type] = entry.slice(0, tab).split(' ');
    const gitPath = entry.slice(tab + 1);
    if (type !== 'blob' || mode === '120000') continue;
    if (prefix && !gitPath.startsWith(`${prefix}/`)) continue;
    const rel = prefix ? gitPath.slice(prefix.length + 1) : gitPath;
    const segments = rel.split('/');
    if (segments.includes('node_modules') || segments.includes('.git')) continue;
    if (!GRAPH_MANIFEST_FILES.has(segments[segments.length - 1])) continue;
    wanted.push({ rel, gitPath });
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 're-shell-graph-'));
  try {
    const BATCH = 500;
    for (let i = 0; i < wanted.length; i += BATCH) {
      const slice = wanted.slice(i, i + BATCH);
      const blobs = await catFileBatch(
        root,
        slice.map((w) => `${commit}:${w.gitPath}`)
      );
      await Promise.all(
        slice.map(async (w, j) => {
          const blob = blobs[j];
          if (!blob) return;
          const dest = path.join(tmp, ...w.rel.split('/'));
          await fs.mkdirp(path.dirname(dest));
          await fs.writeFile(dest, blob);
        })
      );
    }
    if (!fs.existsSync(path.join(tmp, 'package.json'))) {
      throw new GraphSourceError(
        'GRAPH_DIFF_INVALID_INPUT',
        `No package.json at the workspace root in ${commit.slice(0, 12)}: not a monorepo at that ref`
      );
    }
    return await loadGraphModel(tmp);
  } finally {
    await fs.remove(tmp);
  }
}

// ─── Side resolution (git ref | file.json | working tree) ────────────────────

export interface LoadedGraphSide {
  graph: GraphModel;
  side: {
    ref: string;
    kind: 'git' | 'file' | 'working-tree';
    commit?: string | null;
    nodeCount: number;
    edgeCount: number;
  };
}

function describe(graph: GraphModel): { nodeCount: number; edgeCount: number } {
  return { nodeCount: graph.nodes.length, edgeCount: graph.edges.length };
}

/**
 * Resolve one side of a diff. `spec` undefined = the working tree; an existing
 * `.json` file = a saved graph document; anything else is treated as a git ref.
 * A `.json` spec that does not exist is an explicit error (never silently a ref).
 */
export async function loadGraphSide(root: string, spec: string | undefined): Promise<LoadedGraphSide> {
  if (spec === undefined) {
    const graph = await loadGraphModel(root);
    return { graph, side: { ref: 'working-tree', kind: 'working-tree', commit: null, ...describe(graph) } };
  }

  if (/\.json$/i.test(spec)) {
    const file = path.resolve(process.cwd(), spec);
    if (!(await fs.pathExists(file))) {
      throw new GraphSourceError('GRAPH_DIFF_INVALID_INPUT', `Graph file not found: ${spec}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (error) {
      throw new GraphSourceError(
        'GRAPH_DIFF_INVALID_INPUT',
        `${spec} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    try {
      const graph = parseGraphDocument(parsed);
      return { graph, side: { ref: spec, kind: 'file', commit: null, ...describe(graph) } };
    } catch (error) {
      throw new GraphSourceError(
        'GRAPH_DIFF_INVALID_INPUT',
        `${spec} is not a workspace graph document: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const { commit } = await resolveGitRef(root, spec);
  const graph = await loadGraphModelAtCommit(root, commit);
  return { graph, side: { ref: spec, kind: 'git', commit, ...describe(graph) } };
}

/** Find the monorepo root from `startPath` or throw a coded error. */
export async function requireMonorepoRoot(startPath: string = process.cwd()): Promise<string> {
  const root = await findMonorepoRoot(startPath);
  if (!root) {
    throw new GraphSourceError('NOT_IN_MONOREPO', 'Not in a monorepo. Run this command from a monorepo root or workspace.');
  }
  return root;
}
