// Rename context: everything the rewriters need to know about the rename.

import * as path from 'path';

import { caseVariants, renameInName, type CaseVariants } from './names';

export interface ManifestIdentity {
  kind: 'npm' | 'python' | 'cargo' | 'go' | 'maven' | 'composer' | 'gradle' | 'gem' | 'dotnet';
  /** Manifest file relative to the workspace root. */
  file: string;
  /** Name as declared today. */
  oldName: string;
  /** Name after the rename (equals oldName when it does not mention the service). */
  newName: string;
  /** Maven groupId (for matching dependents). */
  groupId?: string;
}

export interface RenameContext {
  /** Workspace root (directory of the workspace config). */
  root: string;
  configPath: string;
  oldName: string;
  newName: string;
  oldV: CaseVariants;
  newV: CaseVariants;
  /** Service directory relative to root (POSIX) before / after the rename. */
  oldRel: string;
  newRel: string;
  oldDir: string;
  newDir: string;
  /** True when the service directory's last segment is the service name, so it is moved. */
  moveDir: boolean;
  /** True when the service's `path:` is set explicitly in the workspace config. */
  explicitPath: boolean;
  /** Package identities declared by the old service (renamed + referenced by dependents). */
  identities: ManifestIdentity[];
}

/** Replace the last path segment of a POSIX relative path. */
export function replaceLastSegment(rel: string, to: string): string {
  const parts = rel.split('/');
  parts[parts.length - 1] = to;
  return parts.join('/');
}

export function buildContext(input: {
  root: string;
  configPath: string;
  oldName: string;
  newName: string;
  oldRel: string;
  explicitPath: boolean;
}): RenameContext {
  const oldRel = input.oldRel.split(path.sep).join('/').replace(/^\.\//, '').replace(/\/+$/, '');
  const segs = oldRel.split('/');
  const moveDir = segs[segs.length - 1] === input.oldName;
  const newRel = moveDir ? replaceLastSegment(oldRel, input.newName) : oldRel;
  return {
    root: input.root,
    configPath: input.configPath,
    oldName: input.oldName,
    newName: input.newName,
    oldV: caseVariants(input.oldName),
    newV: caseVariants(input.newName),
    oldRel,
    newRel,
    oldDir: path.resolve(input.root, oldRel),
    newDir: path.resolve(input.root, newRel),
    moveDir,
    explicitPath: input.explicitPath,
    identities: [],
  };
}

/** Compute the new manifest name for a declared name. */
export function newManifestName(ctx: RenameContext, declared: string): string {
  return renameInName(declared, ctx.oldName, ctx.newName);
}
