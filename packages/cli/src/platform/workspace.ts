// Shared workspace v2 loader for the platform commands (pkg, debug, refactor,
// cloud iac). Walks up from a start directory to find the workspace config,
// validates it with the canonical WorkspaceParser and resolves each service to
// an absolute directory.

import * as fs from 'fs';
import * as path from 'path';

import { WorkspaceParser, type ServiceConfig, type WorkspaceConfig } from '../parsers/workspace-parser';

/** Candidate filenames for a workspace v2 config, in discovery order. */
export const WORKSPACE_CONFIG_CANDIDATES = [
  're-shell.workspaces.yaml',
  're-shell.workspaces.yml',
  'workspace.yaml',
  'workspace.yml',
];

/** Error thrown when the workspace config cannot be found / is invalid. */
export class WorkspaceLoadError extends Error {
  constructor(
    message: string,
    public readonly kind: 'not-found' | 'invalid'
  ) {
    super(message);
    this.name = 'WorkspaceLoadError';
  }
}

/** A service with its directory resolved against the workspace root. */
export interface ResolvedService {
  name: string;
  language: string;
  framework: string;
  type?: ServiceConfig['type'];
  port?: number;
  env: Record<string, string>;
  dependsOn: string[];
  /** Path as written in the config (or the derived default). */
  relPath: string;
  /** Absolute service directory. */
  dir: string;
  config: ServiceConfig;
}

/** A parsed workspace plus its resolved services. */
export interface LoadedWorkspace {
  /** Directory containing the workspace config. */
  root: string;
  configPath: string;
  config: WorkspaceConfig;
  services: ResolvedService[];
}

/**
 * Find the workspace config by walking up from `startDir` (stopping at the
 * filesystem root). An explicit path wins when it exists.
 *
 * @param startDir - Directory to start searching in.
 * @param explicit - Optional explicit config path.
 * @returns The absolute config path, or `undefined` when none is found.
 */
export function findWorkspaceConfig(startDir: string, explicit?: string): string | undefined {
  if (explicit) {
    const abs = path.resolve(startDir, explicit);
    return fs.existsSync(abs) ? abs : undefined;
  }
  let dir = path.resolve(startDir);
  for (;;) {
    for (const candidate of WORKSPACE_CONFIG_CANDIDATES) {
      const full = path.join(dir, candidate);
      if (fs.existsSync(full)) return full;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Load + validate the workspace config and resolve service directories.
 *
 * @param startDir - Directory to start searching from.
 * @param explicit - Optional explicit config path.
 * @returns The loaded workspace.
 * @throws {WorkspaceLoadError} When no config exists or it fails validation.
 */
export function loadWorkspace(startDir: string, explicit?: string): LoadedWorkspace {
  const configPath = findWorkspaceConfig(startDir, explicit);
  if (!configPath) {
    throw new WorkspaceLoadError(
      `No workspace v2 config found (looked for ${WORKSPACE_CONFIG_CANDIDATES.join(', ')} from ${startDir} upwards)`,
      'not-found'
    );
  }
  const parsed = new WorkspaceParser().parse(configPath);
  if (!parsed.valid || !parsed.config) {
    const detail = parsed.errors.map(e => `${e.path}: ${e.message}`).join('; ');
    throw new WorkspaceLoadError(`Invalid workspace config: ${detail || 'unknown error'}`, 'invalid');
  }
  const root = path.dirname(configPath);
  const services: ResolvedService[] = Object.entries(parsed.config.services ?? {}).map(
    ([name, cfg]) => {
      const relPath = cfg.path ?? path.join('services', name);
      const framework =
        typeof cfg.framework === 'string' ? cfg.framework : (cfg.framework?.name ?? '');
      return {
        name,
        language: cfg.language,
        framework,
        type: cfg.type,
        port: cfg.port,
        env: cfg.env ?? {},
        dependsOn: cfg.dependsOn ?? [],
        relPath,
        dir: path.resolve(root, relPath),
        config: cfg,
      };
    }
  );
  return { root, configPath, config: parsed.config, services };
}
