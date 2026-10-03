// Structure-aware YAML rewriters for rename-service: the workspace v2 config,
// docker-compose files, generated Kubernetes manifests and Helm values.
// Edits are spliced by source range (see yaml-edit.ts) so comments and
// formatting survive untouched.

import * as path from 'path';

import type { RenameContext } from './context';
import { escapeRegExp } from './names';
import { editYamlScalars, parseYamlDocs, type ScalarVisit, type YamlPathPart } from './yaml-edit';

const samePath = (a: YamlPathPart[], b: YamlPathPart[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// --------------------------------------------------------------------------
// workspace config
// --------------------------------------------------------------------------

/** Rename the service key, `name`, `path` and every `dependsOn` entry. */
export function rewriteWorkspaceYaml(text: string, ctx: RenameContext): string {
  return editYamlScalars(text, ({ value, path: p, isKey }: ScalarVisit) => {
    if (isKey && samePath(p, ['services']) && value === ctx.oldName) return ctx.newName;
    if (!isKey && samePath(p, ['services', ctx.oldName, 'name']) && value === ctx.oldName) return ctx.newName;
    if (!isKey && ctx.moveDir && samePath(p, ['services', ctx.oldName, 'path'])) {
      const norm = value.replace(/^\.\//, '').replace(/\/+$/, '');
      if (norm === ctx.oldRel) return value.startsWith('./') ? `./${ctx.newRel}` : ctx.newRel;
    }
    if (
      !isKey &&
      p.length === 4 &&
      p[0] === 'services' &&
      p[2] === 'dependsOn' &&
      typeof p[3] === 'number' &&
      value === ctx.oldName
    ) {
      return ctx.newName;
    }
    return undefined;
  }).text;
}

// --------------------------------------------------------------------------
// docker compose
// --------------------------------------------------------------------------

export function isComposeFileName(rel: string): boolean {
  return /^(docker-)?compose([.-][\w.-]+)?\.ya?ml$/.test(path.posix.basename(rel));
}

/** Replace the image repository segment `old` in `[registry/][org/]old[:tag|@digest]`. */
export function renameImageRepo(image: string, oldName: string, newName: string): string {
  const m = /^((?:[^/@:]+(?::\d+)?\/)*)([^/@:]+)([:@].*)?$/.exec(image);
  if (!m || m[2] !== oldName) return image;
  return `${m[1]}${newName}${m[3] ?? ''}`;
}

/** Rewrite a docker-compose document for the rename. */
export function rewriteCompose(text: string, ctx: RenameContext): string {
  return editYamlScalars(text, ({ value, path: p, isKey }: ScalarVisit) => {
    if (p[0] !== 'services') return undefined;
    // service key
    if (isKey && p.length === 1 && value === ctx.oldName) return ctx.newName;
    const owned = p[1] === ctx.oldName;
    if (!isKey && owned && p.length === 3 && (p[2] === 'container_name' || p[2] === 'hostname') && value === ctx.oldName) {
      return ctx.newName;
    }
    if (!isKey && owned && p.length === 3 && p[2] === 'image') {
      const next = renameImageRepo(value, ctx.oldName, ctx.newName);
      return next === value ? undefined : next;
    }
    // depends_on: list form and map form
    if (!isKey && p.length === 4 && p[2] === 'depends_on' && typeof p[3] === 'number' && value === ctx.oldName) return ctx.newName;
    if (isKey && p.length === 3 && p[2] === 'depends_on' && value === ctx.oldName) return ctx.newName;
    // links / external_links ("old" or "old:alias")
    if (!isKey && p.length === 4 && (p[2] === 'links' || p[2] === 'external_links') && typeof p[3] === 'number') {
      const [target, ...rest] = value.split(':');
      if (target === ctx.oldName) return [ctx.newName, ...rest].join(':');
    }
    // extends.service
    if (!isKey && p.length === 4 && p[2] === 'extends' && p[3] === 'service' && value === ctx.oldName) return ctx.newName;
    // network aliases of the renamed service ("old" or "old.internal")
    if (!isKey && owned && p.length === 6 && p[2] === 'networks' && p[4] === 'aliases') {
      if (value === ctx.oldName) return ctx.newName;
      if (value.startsWith(ctx.oldName + '.')) return ctx.newName + value.slice(ctx.oldName.length);
    }
    return undefined;
  }).text;
}

// --------------------------------------------------------------------------
// Kubernetes manifests + Helm values
// --------------------------------------------------------------------------

interface K8sDocLike {
  apiVersion?: unknown;
  kind?: unknown;
  metadata?: { name?: unknown; labels?: Record<string, unknown> };
}

export function isK8sDoc(doc: unknown): doc is K8sDocLike {
  return (
    typeof doc === 'object' &&
    doc !== null &&
    typeof (doc as K8sDocLike).apiVersion === 'string' &&
    typeof (doc as K8sDocLike).kind === 'string'
  );
}

/** A manifest belongs to the renamed service when its name or `app` label is the service name. */
export function isOwnedK8sDoc(doc: K8sDocLike, oldName: string): boolean {
  const labels = doc.metadata?.labels ?? {};
  return (
    doc.metadata?.name === oldName ||
    labels.app === oldName ||
    labels['app.kubernetes.io/name'] === oldName
  );
}

const SELECTOR_KEYS = new Set(['app', 'app.kubernetes.io/name', 'app.kubernetes.io/instance']);

export interface K8sRewrite {
  text: string;
  /** True when every document in the file belongs to the renamed service. */
  allOwned: boolean;
  /** True when the file contained at least one k8s document. */
  isK8s: boolean;
}

/** Rewrite one (possibly multi-document) Kubernetes manifest file. */
export function rewriteK8sManifest(text: string, ctx: RenameContext): K8sRewrite {
  const docs = parseYamlDocs(text);
  const k8s = docs.map(d => (isK8sDoc(d) ? d : null));
  const realDocs = k8s.filter((d): d is K8sDocLike => d !== null);
  if (realDocs.length === 0) return { text, allOwned: false, isK8s: false };
  const owned = k8s.map(d => (d ? isOwnedK8sDoc(d, ctx.oldName) : false));
  const allOwned = k8s.every((d, i) => d === null || owned[i]);
  const old = escapeRegExp(ctx.oldName);
  const tokenRe = new RegExp(`(?<![\\w-])${old}(?![\\w-])`, 'g');

  const edited = editYamlScalars(text, ({ value, path: p, isKey, docIndex }: ScalarVisit) => {
    if (!k8s[docIndex]) return undefined;
    const lastKey = [...p].reverse().find(x => typeof x === 'string') as string | undefined;
    if (owned[docIndex]) {
      if (isKey) return undefined;
      if (value === ctx.oldName) return ctx.newName;
      if (lastKey === 'name' && value.startsWith(ctx.oldName + '-')) return ctx.newName + value.slice(ctx.oldName.length);
      if (lastKey === 'image') {
        const next = renameImageRepo(value, ctx.oldName, ctx.newName);
        if (next !== value) return next;
      }
      if (tokenRe.test(value)) {
        tokenRe.lastIndex = 0;
        // DNS-style names inside owned documents (hosts, selectors)
        return value.replace(tokenRe, ctx.newName);
      }
      tokenRe.lastIndex = 0;
      return undefined;
    }
    // References from other services' manifests
    if (isKey) return undefined;
    if (lastKey && SELECTOR_KEYS.has(lastKey) && value === ctx.oldName) return ctx.newName;
    if ((lastKey === 'serviceName' || (lastKey === 'name' && p.includes('service'))) && value === ctx.oldName) {
      return ctx.newName;
    }
    return undefined;
  });
  return { text: edited.text, allOwned, isK8s: true };
}

/** Helm values: rename the `services.<old>` entry and DNS tokens inside it. */
export function rewriteHelmValues(text: string, ctx: RenameContext): string {
  const old = escapeRegExp(ctx.oldName);
  const tokenRe = new RegExp(`(?<![\\w-])${old}(?![\\w-])`, 'g');
  return editYamlScalars(text, ({ value, path: p, isKey }: ScalarVisit) => {
    if (p[0] !== 'services') return undefined;
    if (isKey && p.length === 1 && value === ctx.oldName) return ctx.newName;
    if (!isKey && p[1] === ctx.oldName && p.length > 2) {
      tokenRe.lastIndex = 0;
      if (tokenRe.test(value)) {
        tokenRe.lastIndex = 0;
        return value.replace(tokenRe, ctx.newName);
      }
    }
    return undefined;
  }).text;
}

/** Filename for an owned manifest after the rename (`deployment-old.yaml` -> `deployment-new.yaml`). */
export function renameManifestFileName(basename: string, ctx: RenameContext): string {
  const re = new RegExp(`(^|-)${escapeRegExp(ctx.oldName)}(?=-|\\.)`);
  return basename.replace(re, `$1${ctx.newName}`);
}
