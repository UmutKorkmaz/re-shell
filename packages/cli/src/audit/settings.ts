/**
 * Audit settings and workspace-root discovery. Everything here is synchronous
 * and cheap: it runs on the exit path of every audited command.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

export interface AuditSettings {
  enabled: boolean;
  /** What to do with commands the classifier cannot place. Default: audit them. */
  unknownCommands: 'audit' | 'ignore';
  /** Why auditing is off, when it is. */
  disabledBy?: 'env' | 'config';
}

const OFF_VALUES = new Set(['0', 'false', 'off', 'no', 'disabled']);

/**
 * Read audit settings for a workspace.
 *
 * Opt-out (documented):
 *   - `RE_SHELL_AUDIT=0` (or false/off/no) in the environment, or
 *   - `audit.enabled: false` in `<root>/.re-shell/config.yaml`
 *     (set with `re-shell config set audit.enabled false`).
 * Tuning: `audit.unknownCommands: ignore` stops auditing unclassified commands.
 */
export function readAuditSettings(root: string | null, env: NodeJS.ProcessEnv = process.env): AuditSettings {
  const settings: AuditSettings = { enabled: true, unknownCommands: 'audit' };

  const envValue = env.RE_SHELL_AUDIT;
  if (typeof envValue === 'string' && OFF_VALUES.has(envValue.trim().toLowerCase())) {
    return { ...settings, enabled: false, disabledBy: 'env' };
  }
  if (!root) return settings;

  const configPath = path.join(root, '.re-shell', 'config.yaml');
  let raw: string;
  try {
    raw = fs.readFileSync(configPath, 'utf8');
  } catch {
    return settings;
  }
  if (!/^\s*audit\s*:/m.test(raw)) return settings; // skip the YAML parse for the common case

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('js-yaml') as typeof import('js-yaml');
    const parsed = yaml.load(raw) as { audit?: { enabled?: unknown; unknownCommands?: unknown } } | null;
    const audit = parsed?.audit;
    if (audit) {
      const enabled = audit.enabled;
      if (enabled === false || (typeof enabled === 'string' && OFF_VALUES.has(enabled.trim().toLowerCase()))) {
        return { ...settings, enabled: false, disabledBy: 'config' };
      }
      if (audit.unknownCommands === 'ignore') settings.unknownCommands = 'ignore';
    }
  } catch {
    /* an unreadable config must not silence the audit trail: stay enabled */
  }
  return settings;
}

/**
 * Find the workspace root that owns the audit log for `cwd`:
 *  1. the nearest ancestor that already has `.re-shell/audit/`,
 *  2. else the nearest ancestor that looks like a workspace root
 *     (`.re-shell/config.yaml`, `pnpm-workspace.yaml`, `re-shell.workspaces.yaml`,
 *     or a package.json with `workspaces`).
 * Returns null outside any workspace (nothing is written there).
 */
export function findAuditRoot(cwd: string): string | null {
  let dir = path.resolve(cwd);
  let marker: string | null = null;
  for (let depth = 0; depth < 25; depth++) {
    if (fs.existsSync(path.join(dir, '.re-shell', 'audit'))) return dir;
    if (marker === null && looksLikeWorkspaceRoot(dir)) marker = dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return marker;
}

function looksLikeWorkspaceRoot(dir: string): boolean {
  // A bare `.re-shell/` directory is NOT a marker: several commands create it for
  // caches in whatever directory they run in (and ~/.re-shell is the global
  // config dir). Only real project config counts.
  if (dir !== os.homedir()) {
    if (fs.existsSync(path.join(dir, '.re-shell', 'config.yaml'))) return true;
    if (fs.existsSync(path.join(dir, '.re-shell', 'workspace.yaml'))) return true;
  }
  if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return true;
  if (fs.existsSync(path.join(dir, 're-shell.workspaces.yaml'))) return true;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return Boolean(pkg && pkg.workspaces);
  } catch {
    return false;
  }
}

export interface Actor {
  actor: string;
  actorSource: 'git' | 'os';
}

/** git user.email when configured, otherwise the OS user name. */
export function resolveActor(cwd: string): Actor {
  try {
    const res = spawnSync('git', ['config', 'user.email'], { cwd, encoding: 'utf8', timeout: 3000 });
    const email = res.status === 0 ? res.stdout.trim() : '';
    if (email) return { actor: email, actorSource: 'git' };
  } catch {
    /* git missing */
  }
  let name = '';
  try {
    name = os.userInfo().username;
  } catch {
    /* no passwd entry (some containers) */
  }
  return { actor: name || process.env.USER || process.env.USERNAME || 'unknown', actorSource: 'os' };
}
