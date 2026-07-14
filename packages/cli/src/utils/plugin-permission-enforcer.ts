import * as path from 'path';
import type { PluginPermission, PluginUtils } from './plugin-system';
import { AuditLogger, DEFAULT_AUDIT_LOG_PATH } from './plugin-audit';

/** Thrown when a plugin attempts an operation it has no permission for. */
export class PermissionDeniedError extends Error {
  readonly plugin: string;
  readonly action: string;
  readonly resource: string;
  constructor(plugin: string, action: string, resource: string, reason: string) {
    super(`Permission denied for plugin '${plugin}': ${action} on ${resource} — ${reason}`);
    this.name = 'PermissionDeniedError';
    this.plugin = plugin;
    this.action = action;
    this.resource = resource;
  }
}

/**
 * Checks plugin operations against its declared permissions.
 * Every check is logged to the audit file.
 */
export class PermissionEnforcer {
  private pluginName: string;
  private permissions: PluginPermission[];
  private dataPath?: string;
  private cachePath?: string;
  private auditLogger: AuditLogger;

  constructor(
    pluginName: string,
    permissions: PluginPermission[],
    dataPath?: string,
    cachePath?: string,
    auditLogPath: string = DEFAULT_AUDIT_LOG_PATH
  ) {
    this.pluginName = pluginName;
    this.permissions = permissions;
    this.dataPath = dataPath;
    this.cachePath = cachePath;
    this.auditLogger = new AuditLogger(auditLogPath);
  }

  /** Check if a filesystem operation is permitted. Throws on denial. */
  checkFileSystem(operation: 'read' | 'write', targetPath: string): void {
    const allowed = this.isFileSystemAllowed(operation, targetPath);
    const reason = allowed
      ? this.getFileSystemReason(operation, targetPath)
      : this.getFileSystemDenyReason(operation);

    this.auditLogger.log({
      plugin: this.pluginName,
      action: `fs.${operation}`,
      resource: targetPath,
      allowed,
      reason,
    });

    if (!allowed) {
      throw new PermissionDeniedError(this.pluginName, `fs.${operation}`, targetPath, reason);
    }
  }

  /** Check if a process execution is permitted. Throws on denial. */
  checkProcess(command: string): void {
    const allowed = this.isProcessAllowed();
    const reason = allowed
      ? 'process:execute permission declared'
      : 'no process permission declared';

    this.auditLogger.log({
      plugin: this.pluginName,
      action: 'exec',
      resource: command,
      allowed,
      reason,
    });

    if (!allowed) {
      throw new PermissionDeniedError(this.pluginName, 'exec', command, reason);
    }
  }

  private isFileSystemAllowed(operation: 'read' | 'write', targetPath: string): boolean {
    // Always allow access to plugin's own data and cache paths
    if (this.isWithinPath(targetPath, this.dataPath)) return true;
    if (this.isWithinPath(targetPath, this.cachePath)) return true;

    for (const perm of this.permissions) {
      if (perm.type !== 'filesystem') continue;

      const accessOk =
        operation === 'read'
          ? perm.access === 'read' || perm.access === 'full'
          : perm.access === 'write' || perm.access === 'full';

      if (!accessOk) continue;

      // If permission has no resource restriction, allow any path
      if (!perm.resource) return true;

      // If permission has a resource, check path prefix
      if (this.isWithinPath(targetPath, perm.resource)) return true;
    }

    return false;
  }

  private isProcessAllowed(): boolean {
    return this.permissions.some(
      (p) => p.type === 'process' && (p.access === 'execute' || p.access === 'full')
    );
  }

  private getFileSystemReason(operation: 'read' | 'write', targetPath: string): string {
    if (this.isWithinPath(targetPath, this.dataPath)) return 'plugin dataPath access';
    if (this.isWithinPath(targetPath, this.cachePath)) return 'plugin cachePath access';
    const perm = this.permissions.find((p) => {
      if (p.type !== 'filesystem') return false;
      const accessOk =
        operation === 'read'
          ? p.access === 'read' || p.access === 'full'
          : p.access === 'write' || p.access === 'full';
      return accessOk && (!p.resource || this.isWithinPath(targetPath, p.resource));
    });
    return perm
      ? `matches filesystem:${perm.access} permission`
      : 'allowed (fallback)';
  }

  private getFileSystemDenyReason(operation: 'read' | 'write'): string {
    const hasFsPerm = this.permissions.some((p) => p.type === 'filesystem');
    if (!hasFsPerm) return 'no filesystem permission declared';
    return `no filesystem:${operation} permission for this path`;
  }

  private isWithinPath(targetPath: string, basePath?: string): boolean {
    if (!basePath) return false;
    const resolvedTarget = path.resolve(targetPath);
    const resolvedBase = path.resolve(basePath);
    return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase;
  }
}

// --- fs-extra write/read method lists for proxy wrapping ---

const FS_READ_METHODS = new Set([
  'readFile', 'readFileSync', 'readdir', 'readdirSync', 'stat', 'statSync',
  'lstat', 'lstatSync', 'pathExists', 'pathExistsSync', 'readJSON', 'readJSONSync',
  'readJson', 'readJsonSync', 'exists', 'existsSync', 'access', 'accessSync',
]);

const FS_WRITE_METHODS = new Set([
  'writeFile', 'writeFileSync', 'writeJSON', 'writeJSONSync', 'writeJson', 'writeJsonSync',
  'ensureDir', 'ensureDirSync', 'mkdirs', 'mkdirsSync', 'mkdir', 'mkdirSync',
  'remove', 'removeSync', 'unlink', 'unlinkSync', 'rmdir', 'rmdirSync',
  'copy', 'copySync', 'move', 'moveSync', 'rename', 'renameSync',
  'appendFile', 'appendFileSync', 'truncate', 'truncateSync',
  'createWriteStream', 'outputFile', 'outputFileSync',
]);

/**
 * Wrap a PluginUtils object with permission-checking proxies.
 * Returns a new object with the same interface, where fs read/write methods,
 * exec, and spawn are intercepted by the PermissionEnforcer.
 */
export function wrapPluginUtils(utils: PluginUtils, enforcer: PermissionEnforcer): PluginUtils {
  const wrappedFs = new Proxy(utils.fs, {
    get(target, prop: string) {
      const original = (target as Record<string, unknown>)[prop];
      if (typeof original !== 'function') return original;

      const methodName = prop;

      return (...args: unknown[]) => {
        // Determine the file path argument
        const firstArg = args[0];
        const filePath = typeof firstArg === 'string' ? firstArg : '';

        try {
          if (FS_READ_METHODS.has(methodName)) {
            enforcer.checkFileSystem('read', filePath);
          } else if (FS_WRITE_METHODS.has(methodName)) {
            enforcer.checkFileSystem('write', filePath);
          }
        } catch (e) {
          // Async methods (no Sync suffix) should reject rather than throw sync
          if (!methodName.endsWith('Sync')) {
            return Promise.reject(e);
          }
          throw e;
        }

        return (original as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });

  const wrappedExec = async (command: string, options?: unknown): Promise<{ stdout: string; stderr: string }> => {
    enforcer.checkProcess(command);
    return utils.exec(command, options);
  };

  const wrappedSpawn = async (command: string, args: string[], options?: unknown): Promise<number> => {
    enforcer.checkProcess(`${command} ${args.join(' ')}`);
    return utils.spawn(command, args, options);
  };

  return {
    ...utils,
    fs: wrappedFs,
    exec: wrappedExec,
    spawn: wrappedSpawn,
  };
}
