// Text-level rewrites applied to every scanned file during a service rename:
// environment variable names, URL hosts, relative/root paths into the service
// directory, JS/TS package specifiers, bridge-generated client identifiers and
// Rust crate paths. Every rule is anchored on a precise token so that a
// service called e.g. "api" does not rewrite unrelated words.

import * as path from 'path';

import type { RenameContext } from './context';
import { escapeRegExp } from './names';

const ENV_SUFFIXES = [
  'URL',
  'HOST',
  'PORT',
  'ADDR',
  'ADDRESS',
  'ENDPOINT',
  'BASE_URL',
  'API_URL',
  'GRPC_URL',
  'GRPC_ADDR',
  'GRPC_ADDRESS',
  'GRPC_HOST',
  'GRPC_PORT',
  'HTTP_URL',
  'SERVICE_URL',
  'SERVICE_HOST',
  'SERVICE_PORT',
];

/** `<OLD>_URL` style environment variable names -> `<NEW>_URL`. */
export function rewriteEnvNames(text: string, ctx: RenameContext): string {
  const suffix = ENV_SUFFIXES.map(escapeRegExp).join('|');
  const re = new RegExp(`\\b${escapeRegExp(ctx.oldV.upper)}_(${suffix})\\b`, 'g');
  return text.replace(re, `${ctx.newV.upper}_$1`);
}

/** URL hosts that are exactly the old service (`http://old:8080`, `old.ns.svc`). */
export function rewriteUrlHosts(text: string, ctx: RenameContext): string {
  const old = escapeRegExp(ctx.oldName);
  const re = new RegExp(
    `(\\b[a-zA-Z][a-zA-Z0-9+.-]*:\\/\\/(?:[^\\/\\s'"@]*@)?)${old}(?=(?:\\.[a-z0-9-]+\\.svc(?:\\.cluster\\.local)?)?(?:[:\\/\\s'"?#,)\\]}]|$))`,
    'gm'
  );
  return text.replace(re, `$1${ctx.newName}`);
}

/** Replace a bare owned-host token such as `old:8080` used as host:port in env values. */
export function rewriteHostPort(text: string, ctx: RenameContext): string {
  const old = escapeRegExp(ctx.oldName);
  // value-position host:port, e.g. BILLING_ADDR=billing:50051 / "billing:50051"
  const re = new RegExp(`((?:_ADDR|_ADDRESS|_HOST|_ENDPOINT)\\s*[=:]\\s*["']?)${old}(?=:\\d+)`, 'g');
  return text.replace(re, `$1${ctx.newName}`);
}

function splitKeepSeps(token: string): string[] {
  return token.split(/([\\/])/);
}

/**
 * Rewrite path tokens that point into the old service directory. Handles
 * relative tokens (`../old/src`, `.\old\Old.csproj`) resolved against the
 * containing file, and bare workspace-root-relative tokens (`services/old`).
 */
export function rewritePathRefs(text: string, fileAbsDir: string, ctx: RenameContext): string {
  if (!ctx.moveDir) return text;
  const oldLast = ctx.oldName;
  const newLast = ctx.newName;

  // A: relative tokens
  let out = text.replace(/((?:\.{1,2}[\\/])+)([\w@.+\-/\\]*)/g, (match, _prefix: string, _rest: string, offset: number, whole: string) => {
    const before = offset > 0 ? whole[offset - 1] : '';
    if (/[\w@.\-/\\]/.test(before)) return match;
    const parts = splitKeepSeps(match);
    const segs: string[] = [];
    for (let i = 0; i < parts.length; i += 2) segs.push(parts[i]);
    for (let i = 0; i < segs.length; i++) {
      if (segs[i] !== oldLast) continue;
      const resolved = path.resolve(fileAbsDir, ...segs.slice(0, i + 1));
      if (resolved === ctx.oldDir) {
        parts[i * 2] = newLast;
        // bridge-generated client folders inside the service directory
        for (let j = i + 1; j < segs.length; j++) {
          const renamed = renameBridgeSegment(segs[j], ctx);
          if (renamed !== segs[j]) parts[j * 2] = renamed;
        }
        return parts.join('');
      }
    }
    return match;
  });

  // B: bare root-relative tokens (only when the service path has a directory part)
  if (ctx.oldRel.includes('/')) {
    const oldPosix = escapeRegExp(ctx.oldRel);
    const oldWin = escapeRegExp(ctx.oldRel.split('/').join('\\'));
    const boundaryAfter = `(?=$|[\\s/\\\\'"\`:,;)\\]}>*])`;
    out = out.replace(new RegExp(`(?<![\\w@.\\-/\\\\])(${oldPosix})${boundaryAfter}`, 'g'), ctx.newRel);
    out = out.replace(new RegExp(`(?<![\\w@.\\-/\\\\])(${oldWin})${boundaryAfter}`, 'g'), ctx.newRel.split('/').join('\\'));
  }
  return out;
}

const BRIDGE_SEG = /^(.+)-(grpc|rest|graphql)$/;

/** `old-rest` -> `new-rest` for bridge-generated client directories. */
export function renameBridgeSegment(seg: string, ctx: RenameContext): string {
  const m = BRIDGE_SEG.exec(seg);
  if (m && m[1] === ctx.oldName) return `${ctx.newName}-${m[2]}`;
  return seg;
}

const JS_EXT = /\.(?:[cm]?[jt]sx?|vue|svelte)$/;

/** Package specifiers of the old npm package in JS/TS import/require statements. */
export function rewriteJsSpecifiers(text: string, relPath: string, ctx: RenameContext): string {
  if (!JS_EXT.test(relPath)) return text;
  let out = text;
  for (const id of ctx.identities.filter(i => i.kind === 'npm' && i.oldName !== i.newName)) {
    const old = escapeRegExp(id.oldName);
    const re = new RegExp(
      `((?:\\bfrom\\s*|\\bimport\\s*\\(?\\s*|\\brequire\\s*\\(\\s*|\\bimport\\s+|\\bjest\\.mock\\(\\s*|\\bvi\\.mock\\(\\s*)['"])${old}(?=['"/])`,
      'g'
    );
    out = out.replace(re, `$1${id.newName}`);
  }
  return out;
}

const CLIENT_FILE_EXT = /\.(?:[cm]?[jt]sx?|py|go|java|kt|cs|rb|php|rs|proto|md|json|ya?ml)$/;

/** Bridge-generated identifiers (`BillingRestClient`) and proto service names. */
export function rewriteBridgeIdentifiers(text: string, relPath: string, ctx: RenameContext): string {
  if (!CLIENT_FILE_EXT.test(relPath)) return text;
  let out = text.replace(
    new RegExp(`\\b${escapeRegExp(ctx.oldV.pascal)}(Grpc|Rest|Graphql)Client`, 'g'),
    `${ctx.newV.pascal}$1Client`
  );
  if (relPath.endsWith('.proto') || /-(grpc)\//.test(relPath)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(ctx.oldV.pascal)}Service\\b`, 'g'), `${ctx.newV.pascal}Service`);
  }
  return out;
}

/** Rust: `use old::...` / `old::func()` in crates that depend on the renamed crate. */
export function rewriteRustCrate(text: string, relPath: string, ctx: RenameContext, dependentCrateDirs: string[]): string {
  if (!relPath.endsWith('.rs')) return text;
  const id = ctx.identities.find(i => i.kind === 'cargo' && i.oldName !== i.newName);
  if (!id) return text;
  if (!dependentCrateDirs.some(d => relPath.startsWith(d + '/'))) return text;
  const oldC = id.oldName.replace(/-/g, '_');
  const newC = id.newName.replace(/-/g, '_');
  return text
    .replace(new RegExp(`\\b(use\\s+|extern\\s+crate\\s+)${escapeRegExp(oldC)}(?=::|;|\\s+as\\b)`, 'g'), `$1${newC}`)
    .replace(new RegExp(`(?<![\\w:])${escapeRegExp(oldC)}::`, 'g'), `${newC}::`);
}

/** tsconfig path-alias keys for the old package name. */
export function rewriteTsconfigAliases(text: string, relPath: string, ctx: RenameContext): string {
  if (!/(^|\/)tsconfig[^/]*\.json$/.test(relPath)) return text;
  let out = text;
  for (const id of ctx.identities.filter(i => i.kind === 'npm' && i.oldName !== i.newName)) {
    out = out.replace(new RegExp(`"${escapeRegExp(id.oldName)}(/\\*)?"(?=\\s*:)`, 'g'), (_m, star: string | undefined) => `"${id.newName}${star ?? ''}"`);
  }
  return out;
}

/** Run every generic rule over one file's text. */
export function applyGenericRewrites(
  text: string,
  relPath: string,
  absDir: string,
  ctx: RenameContext,
  dependentCrateDirs: string[]
): string {
  let out = text;
  out = rewritePathRefs(out, absDir, ctx);
  out = rewriteEnvNames(out, ctx);
  out = rewriteUrlHosts(out, ctx);
  out = rewriteHostPort(out, ctx);
  out = rewriteJsSpecifiers(out, relPath, ctx);
  out = rewriteTsconfigAliases(out, relPath, ctx);
  out = rewriteBridgeIdentifiers(out, relPath, ctx);
  out = rewriteRustCrate(out, relPath, ctx, dependentCrateDirs);
  return out;
}
