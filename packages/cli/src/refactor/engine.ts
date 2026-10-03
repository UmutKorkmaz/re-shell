// `re-shell refactor rename-service <old> <new>`: plan (pure, in memory) then
// apply (write + git-aware move + verify, with rollback).

import * as fs from 'fs';
import * as path from 'path';

import { loadWorkspace, WorkspaceLoadError, type ResolvedService } from '../platform/workspace';
import { buildContext, type RenameContext } from './context';
import { renderFileDiff, type FileDiff } from './diff';
import { scanWorkspace, type ScannedFile } from './files';
import { applyGenericRewrites, renameBridgeSegment } from './generic';
import { gitInfo, moveWithGit, type GitInfo, type MoveMethod } from './git';
import { discoverIdentities, rewriteManifestFile } from './manifests';
import { escapeRegExp, SERVICE_NAME_PATTERN } from './names';
import { parseYamlDocs } from './yaml-edit';
import {
  isComposeFileName,
  renameManifestFileName,
  rewriteCompose,
  rewriteHelmValues,
  rewriteK8sManifest,
  rewriteWorkspaceYaml,
} from './structural';

export type RefactorErrorCode =
  | 'WORKSPACE_NOT_FOUND'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'REFACTOR_ERROR'
  | 'REFACTOR_SERVICE_NOT_FOUND'
  | 'REFACTOR_INVALID_NAME'
  | 'REFACTOR_NAME_COLLISION'
  | 'REFACTOR_DIRTY_TREE';

export class RefactorError extends Error {
  constructor(
    public readonly code: RefactorErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RefactorError';
  }
}

export type ChangeKind =
  | 'workspace'
  | 'compose'
  | 'k8s'
  | 'helm'
  | 'manifest'
  | 'dependency'
  | 'env'
  | 'source'
  | 'docs'
  | 'config';

export interface PlannedFile {
  /** Workspace-relative path BEFORE the rename. */
  from: string;
  /** Workspace-relative path AFTER the rename (differs when inside a moved directory). */
  to: string;
  kind: ChangeKind;
  changedLines: number;
}

export interface PlannedMove {
  from: string;
  to: string;
  kind: 'directory' | 'file';
}

export interface ResidualReference {
  path: string;
  line: number;
  text: string;
}

export interface RenameServiceOptions {
  cwd?: string;
  configPath?: string;
  oldName: string;
  newName: string;
  dryRun?: boolean;
  force?: boolean;
}

export interface RenameServiceResult {
  old: string;
  new: string;
  dryRun: boolean;
  applied: boolean;
  root: string;
  git: { inRepo: boolean; dirty: boolean; moved: MoveMethod | 'none' };
  files: PlannedFile[];
  moves: PlannedMove[];
  /** Git-style unified diff of every content change and rename. */
  diff: string;
  residualReferences: ResidualReference[];
  warnings: string[];
}

interface FileChange {
  file: ScannedFile;
  after: string;
  kind: ChangeKind;
}

const SOURCE_EXT = /\.(?:[cm]?[jt]sx?|vue|svelte|py|go|java|kt|scala|cs|fs|rb|php|rs|swift|dart|ex|exs|proto|sh)$/;

function classify(rel: string, structural: ChangeKind | null): ChangeKind {
  if (structural) return structural;
  const base = path.posix.basename(rel);
  if (/^(package\.json|composer\.json|pyproject\.toml|Cargo\.toml|go\.mod|go\.work|pom\.xml|Gemfile|settings\.gradle(\.kts)?|build\.gradle(\.kts)?|requirements.*\.txt)$/.test(base) || /\.(gemspec|[cf]sproj|vbproj|sln)$/.test(base)) {
    return 'dependency';
  }
  if (/^\.env/.test(base) || base.endsWith('.env')) return 'env';
  if (SOURCE_EXT.test(base)) return 'source';
  if (/\.(md|mdx|rst|txt)$/.test(base)) return 'docs';
  return 'config';
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Map a pre-rename relative path to its post-rename location. */
function mapPath(rel: string, ctx: RenameContext, extraMoves: PlannedMove[]): string {
  let out = rel;
  if (ctx.moveDir && (out === ctx.oldRel || out.startsWith(ctx.oldRel + '/'))) {
    out = ctx.newRel + out.slice(ctx.oldRel.length);
  }
  for (const m of extraMoves) {
    // extra moves are expressed in post-service-move coordinates
    if (out === m.from || out.startsWith(m.from + '/')) out = m.to + out.slice(m.from.length);
  }
  return out;
}

/**
 * Compute the full rename plan without touching the filesystem.
 *
 * @throws {RefactorError} for unknown services, invalid names and collisions.
 */
export function planRenameService(options: RenameServiceOptions): {
  ctx: RenameContext;
  changes: FileChange[];
  moves: PlannedMove[];
  files: PlannedFile[];
  diffs: FileDiff[];
  residual: ResidualReference[];
  warnings: string[];
  svc: ResolvedService;
  scanFiles: ScannedFile[];
} {
  const cwd = options.cwd ?? process.cwd();
  let ws;
  try {
    ws = loadWorkspace(cwd, options.configPath);
  } catch (err) {
    if (err instanceof WorkspaceLoadError) {
      throw new RefactorError(err.kind === 'not-found' ? 'WORKSPACE_NOT_FOUND' : 'SCHEMA_VALIDATION_ERROR', err.message);
    }
    throw err;
  }

  const { oldName, newName } = options;
  if (!SERVICE_NAME_PATTERN.test(newName)) {
    throw new RefactorError(
      'REFACTOR_INVALID_NAME',
      `"${newName}" is not a valid service name (lowercase letters, digits and hyphens; must start and end alphanumeric; max 63 chars)`
    );
  }
  const svc = ws.services.find(s => s.name === oldName);
  if (!svc) {
    throw new RefactorError(
      'REFACTOR_SERVICE_NOT_FOUND',
      `Service "${oldName}" not found. Available: ${ws.services.map(s => s.name).join(', ') || '(none)'}`,
      { available: ws.services.map(s => s.name) }
    );
  }
  if (oldName === newName) {
    throw new RefactorError('REFACTOR_INVALID_NAME', `New name is identical to the current name ("${oldName}")`);
  }
  if (ws.services.some(s => s.name === newName)) {
    throw new RefactorError('REFACTOR_NAME_COLLISION', `A service named "${newName}" already exists in the workspace`, {
      service: newName,
    });
  }

  const scan = scanWorkspace(ws.root);
  const ctx = buildContext({
    root: ws.root,
    configPath: ws.configPath,
    oldName,
    newName,
    oldRel: svc.relPath,
    explicitPath: svc.config.path !== undefined,
  });

  if (ctx.moveDir && fs.existsSync(ctx.newDir)) {
    throw new RefactorError('REFACTOR_NAME_COLLISION', `Target directory already exists: ${ctx.newRel}`, {
      directory: ctx.newRel,
    });
  }
  // docker-compose service collision (compose may define services not in the workspace config)
  for (const f of scan.files) {
    if (!isComposeFileName(f.rel)) continue;
    const doc = parseYamlDocs(f.content)[0] as { services?: Record<string, unknown> } | undefined;
    if (doc && typeof doc.services === 'object' && doc.services && newName in doc.services) {
      throw new RefactorError('REFACTOR_NAME_COLLISION', `${f.rel} already defines a compose service named "${newName}"`, {
        file: f.rel,
        service: newName,
      });
    }
  }

  const warnings: string[] = [];
  ctx.identities = discoverIdentities(ctx, scan.files);
  for (const id of ctx.identities) {
    if (id.oldName === id.newName) {
      warnings.push(
        `${id.file}: package name "${id.oldName}" does not contain the service name "${oldName}", left unchanged`
      );
    }
  }
  if (!ctx.moveDir) {
    warnings.push(
      `Service directory "${ctx.oldRel}" does not end with the service name; the directory is not moved and its path is left as is`
    );
  }

  const relSet = new Set(scan.files.map(f => f.rel));

  // Pass 1: manifest rewrites, to learn which Rust crates depend on the renamed one.
  const dependentCrateDirs: string[] = [];
  for (const f of scan.files) {
    if (path.posix.basename(f.rel) !== 'Cargo.toml') continue;
    const ownCargo = ctx.identities.some(i => i.kind === 'cargo' && i.file === f.rel);
    if (ownCargo) continue;
    if (rewriteManifestFile(ctx, f, f.content) !== f.content) dependentCrateDirs.push(path.posix.dirname(f.rel));
  }

  const changes: FileChange[] = [];
  const renamedManifests = new Map<string, string>(); // rel -> new basename
  for (const f of scan.files) {
    let after = f.content;
    let structural: ChangeKind | null = null;
    const ext = path.posix.extname(f.rel).toLowerCase();
    const base = path.posix.basename(f.rel);

    if (f.abs === ws.configPath) {
      after = rewriteWorkspaceYaml(after, ctx);
      structural = 'workspace';
    } else if (isComposeFileName(f.rel)) {
      after = rewriteCompose(after, ctx);
      structural = 'compose';
    } else if (ext === '.yaml' || ext === '.yml') {
      const dir = path.posix.dirname(f.rel);
      const chartSibling = relSet.has(dir === '.' ? 'Chart.yaml' : `${dir}/Chart.yaml`);
      if (chartSibling && /^values[\w.-]*\.ya?ml$/.test(base)) {
        after = rewriteHelmValues(after, ctx);
        structural = 'helm';
      } else if (!/\.github\//.test(f.rel)) {
        const r = rewriteK8sManifest(after, ctx);
        if (r.isK8s) {
          after = r.text;
          structural = 'k8s';
          if (r.allOwned) {
            const renamed = renameManifestFileName(base, ctx);
            if (renamed !== base) renamedManifests.set(f.rel, renamed);
          }
        }
      }
    }

    const manifestAfter = rewriteManifestFile(ctx, f, after);
    if (manifestAfter !== after) {
      after = manifestAfter;
    }
    after = applyGenericRewrites(after, f.rel, path.dirname(f.abs), ctx, dependentCrateDirs);
    if (after !== f.content) changes.push({ file: f, after, kind: classify(f.rel, structural) });
  }

  // Moves: service directory first, then bridge-generated clients and renamed manifests.
  const moves: PlannedMove[] = [];
  if (ctx.moveDir) moves.push({ from: ctx.oldRel, to: ctx.newRel, kind: 'directory' });
  const extra: PlannedMove[] = [];
  const bridgeDirs = new Set<string>();
  for (const d of scan.dirs) {
    const seg = path.posix.basename(d);
    if (renameBridgeSegment(seg, ctx) === seg) continue;
    // post-service-move coordinates
    const post = ctx.moveDir && (d === ctx.oldRel || d.startsWith(ctx.oldRel + '/')) ? ctx.newRel + d.slice(ctx.oldRel.length) : d;
    if ([...bridgeDirs].some(b => post.startsWith(b + '/'))) continue;
    bridgeDirs.add(post);
    const to = path.posix.join(path.posix.dirname(post), renameBridgeSegment(seg, ctx));
    extra.push({ from: post, to, kind: 'directory' });
  }
  moves.push(...extra);
  const protoOld = `${ctx.oldV.snake}.proto`;
  const protoNew = `${ctx.newV.snake}.proto`;
  for (const f of scan.files) {
    const base = path.posix.basename(f.rel);
    let newBase: string | undefined = renamedManifests.get(f.rel);
    if (!newBase && base === protoOld) newBase = protoNew;
    if (!newBase) continue;
    const post = mapPath(f.rel, ctx, extra);
    moves.push({ from: post, to: path.posix.join(path.posix.dirname(post), newBase), kind: 'file' });
  }

  // Diffs and per-file report (display paths use the post-move location).
  const diffs: FileDiff[] = [];
  const files: PlannedFile[] = [];
  const handled = new Set<string>();
  for (const c of changes) {
    const to = mapPath(c.file.rel, ctx, extra);
    const finalTo = moves.find(m => m.kind === 'file' && m.from === to)?.to ?? to;
    const d = renderFileDiff(c.file.rel, finalTo, c.file.content, c.after);
    diffs.push(d);
    files.push({ from: c.file.rel, to: finalTo, kind: c.kind, changedLines: d.changedLines });
    handled.add(c.file.rel);
  }
  // Pure renames (no content change)
  for (const m of moves) {
    if (m.kind !== 'file') continue;
    const originalRel = scan.files.find(f => mapPath(f.rel, ctx, extra) === m.from)?.rel;
    if (!originalRel || handled.has(originalRel)) continue;
    diffs.push(renderFileDiff(originalRel, m.to, '', ''));
  }
  // Directory moves are shown as a rename header too.
  for (const m of moves) {
    if (m.kind === 'directory') {
      diffs.unshift({ from: m.from, to: m.to, patch: `diff --git a/${m.from} b/${m.to}\nsimilarity index 100%\nrename from ${m.from}\nrename to ${m.to}\n`, changedLines: 0 });
    }
  }

  // Residual references: whole-word mentions of the old name that were not rewritten.
  const residual: ResidualReference[] = [];
  const afterByRel = new Map(changes.map(c => [c.file.rel, c.after]));
  const wordRe = new RegExp(`(?<![\\w-])${escapeRegExp(oldName)}(?![\\w-])`);
  outer: for (const f of scan.files) {
    const text = afterByRel.get(f.rel) ?? f.content;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (wordRe.test(lines[i])) {
        residual.push({ path: mapPath(f.rel, ctx, extra), line: i + 1, text: lines[i].trim().slice(0, 200) });
        if (residual.length >= 100) break outer;
      }
    }
  }
  if (residual.length > 0) {
    warnings.push(
      `${residual.length} remaining mention(s) of "${oldName}" were not rewritten automatically (prose, identifiers, unrelated words); review them`
    );
  }
  const staleLocks = scan.lockfiles.filter(l => {
    try {
      return new RegExp(`(?<![\\w-])${escapeRegExp(oldName)}(?![\\w-])`).test(fs.readFileSync(path.join(ctx.root, l), 'utf8'));
    } catch {
      return false;
    }
  });
  if (staleLocks.length > 0) {
    warnings.push(`Lockfiles reference "${oldName}" and were not edited: ${staleLocks.join(', ')}. Re-run your package manager install to refresh them.`);
  }

  return { ctx, changes, moves, files, diffs, residual, warnings, svc, scanFiles: scan.files };
}

/**
 * Rename a service across the workspace. Dry runs only plan; real runs apply
 * the plan atomically (rolled back on any failure) and re-validate the
 * workspace config afterwards.
 */
export function renameService(options: RenameServiceOptions): RenameServiceResult {
  const dryRun = Boolean(options.dryRun);
  const plan = planRenameService(options);
  const { ctx } = plan;
  const git: GitInfo = gitInfo(ctx.root);
  const warnings = [...plan.warnings];

  if (git.inRepo && git.dirty) {
    if (!dryRun && !options.force) {
      throw new RefactorError(
        'REFACTOR_DIRTY_TREE',
        `The git working tree has uncommitted changes (${git.dirtyEntries.length}); commit or stash them, or re-run with --force`,
        { entries: git.dirtyEntries.slice(0, 20) }
      );
    }
    warnings.push(
      dryRun
        ? 'The git working tree is dirty: a real run would refuse without --force'
        : 'The git working tree is dirty; continuing because of --force'
    );
  }

  const result: RenameServiceResult = {
    old: options.oldName,
    new: options.newName,
    dryRun,
    applied: false,
    root: ctx.root,
    git: { inRepo: git.inRepo, dirty: git.dirty, moved: 'none' },
    files: plan.files,
    moves: plan.moves,
    diff: plan.diffs.map(d => d.patch).join(''),
    residualReferences: plan.residual,
    warnings,
  };
  if (dryRun) return result;

  // ---- apply ----
  const originals = new Map<string, string>();
  const performedMoves: Array<{ from: string; to: string }> = [];
  const rollback = (): void => {
    for (const m of performedMoves.reverse()) {
      try {
        moveWithGit(git.inRepo ? git.toplevel : undefined, m.to, m.from);
      } catch {
        /* best effort */
      }
    }
    for (const [abs, content] of originals) {
      try {
        fs.writeFileSync(abs, content);
      } catch {
        /* best effort */
      }
    }
  };

  try {
    for (const c of plan.changes) {
      originals.set(c.file.abs, c.file.content);
      fs.writeFileSync(c.file.abs, c.after);
    }
    const repoRoot = git.inRepo ? git.toplevel : undefined;
    let method: MoveMethod | 'none' = 'none';
    for (const m of plan.moves) {
      const from = path.join(ctx.root, m.from);
      const to = path.join(ctx.root, m.to);
      if (!fs.existsSync(from)) continue;
      const used = moveWithGit(repoRoot, from, to);
      performedMoves.push({ from, to });
      if (m.kind === 'directory' && m.from === ctx.oldRel) method = used;
      else if (method === 'none') method = used;
    }
    result.git.moved = method;

    // verify: the workspace config must still be valid and contain the new service
    const reloaded = loadWorkspace(ctx.root, ctx.configPath);
    if (!reloaded.services.some(s => s.name === options.newName) || reloaded.services.some(s => s.name === options.oldName)) {
      throw new Error('workspace config no longer lists the renamed service after the rewrite');
    }
    result.applied = true;
    return result;
  } catch (err) {
    rollback();
    if (err instanceof RefactorError) throw err;
    throw new RefactorError('REFACTOR_ERROR', `Rename failed and was rolled back: ${(err as Error).message}`);
  }
}

export { toPosix };
