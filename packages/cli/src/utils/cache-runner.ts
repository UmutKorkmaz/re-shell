// Wiring that connects the content-addressed cache to the task runner.
//
// The runner asks this controller two things per (package, task) node, in
// dependency order:
//
//   tryRestore(node)  -> CacheHit | undefined
//       Compute the node's cache key (folding in the keys of its already-
//       computed dependency closure), check the cache (remote-then-local when a
//       remote is configured = CI hydration), and on a HIT restore the declared
//       outputs to disk + hand back the captured logs + exit code. The runner
//       then marks the node `cached` WITHOUT spawning.
//
//   store(node, exitCode, logs) -> void
//       On a MISS the runner spawns the task, then calls this to capture the
//       declared outputs + logs + exit under the key (and push to the remote
//       when configured).
//
// Key computation is memoised per node id so a node that is a dependency of many
// downstream nodes is hashed once. The controller is constructed per `runTask`
// invocation; it holds no global state.

import type { TasksConfig } from '@re-shell/contracts';
import {
  buildToolchainFingerprint,
  computeCacheKey,
  snapshotEnv,
  type ToolchainFingerprint,
} from './cache-key';
import {
  captureOutputs,
  restoreOutputs,
  type CacheBackend,
  type CachedResult,
} from './cache-store';
import { recordCacheTelemetry } from './cache-telemetry';
import { nodeId } from './task-scheduler';
import type { DiscoveredPackage, PackageManager } from './task-runner';

/** A successful cache restore the runner replays instead of spawning. */
export interface CacheHit {
  exitCode: number;
  logs: string;
}

/** A node the controller operates on (mirrors the runner's node view). */
export interface CacheNode {
  package: string;
  task: string;
}

/** Construction inputs for {@link CacheController}. */
export interface CacheControllerOptions {
  workspaceRoot: string;
  packages: ReadonlyMap<string, DiscoveredPackage>;
  /** Dependency edges: nodeId -> the set of nodeIds it depends on. */
  dependencies: ReadonlyMap<string, ReadonlySet<string>>;
  tasksConfig: TasksConfig;
  /** Resolve the package manager for a package (memoised by the runner). */
  pmFor: (pkg: DiscoveredPackage) => PackageManager;
  /** The local backend (always present when caching is on). */
  local: CacheBackend;
  /** The remote backend, when configured (CI hydration / push). */
  remote?: CacheBackend;
  /**
   * The local cache root. When set, the controller accumulates hit/miss counts
   * and flushes them to telemetry via {@link CacheController.flushTelemetry}.
   * Omitted by tests that inject a backend without a real root.
   */
  localRoot?: string;
}

/**
 * Per-run cache controller. Computes deterministic keys, performs remote-then-
 * local lookups, restores artifacts on a hit, and stores artifacts+logs+exit on
 * a miss. Toolchain fingerprints are memoised per package since they are stable
 * for the lifetime of a run.
 */
export class CacheController {
  private readonly opts: CacheControllerOptions;
  private readonly keyCache = new Map<string, Promise<string>>();
  private readonly toolchainCache = new Map<string, Promise<ToolchainFingerprint>>();
  private readonly env = snapshotEnv();
  private hits = 0;
  private misses = 0;

  constructor(options: CacheControllerOptions) {
    this.opts = options;
  }

  /**
   * Flush accumulated hit/miss counts to the local telemetry file. Called once
   * by the runner after a run completes. No-op when no local root was provided.
   */
  async flushTelemetry(): Promise<void> {
    if (!this.opts.localRoot) return;
    await recordCacheTelemetry(this.opts.localRoot, {
      hits: this.hits,
      misses: this.misses,
    });
  }

  /**
   * The package.json script body for a (package, task) — the cache-relevant
   * command. A change to the script body (not just the task name) must change
   * the key, so the body is folded in. Falls back to the task name when no
   * script body is recorded (defensive; such nodes are skipped before caching).
   */
  private commandFor(pkg: DiscoveredPackage, task: string): string {
    return pkg.scriptBodies.get(task) ?? task;
  }

  /** Memoised toolchain fingerprint for a package. */
  private toolchain(pkg: DiscoveredPackage): Promise<ToolchainFingerprint> {
    let cached = this.toolchainCache.get(pkg.name);
    if (!cached) {
      cached = buildToolchainFingerprint(
        pkg.dir,
        this.opts.workspaceRoot,
        this.opts.pmFor(pkg)
      );
      this.toolchainCache.set(pkg.name, cached);
    }
    return cached;
  }

  /** Resolve the optional inputs/outputs globs for a task from the config. */
  private globsFor(task: string): { inputs?: string[]; outputs?: string[] } {
    const cfg = this.opts.tasksConfig[task];
    return { inputs: cfg?.inputs, outputs: cfg?.outputs };
  }

  /**
   * Compute (and memoise) the cache key for a node. Recurses into the node's
   * dependency closure first so an upstream change cascades into this key.
   */
  keyFor(node: CacheNode): Promise<string> {
    const id = nodeId(node.package, node.task);
    let cached = this.keyCache.get(id);
    if (cached) return cached;

    cached = this.computeKey(id, node);
    this.keyCache.set(id, cached);
    return cached;
  }

  private async computeKey(id: string, node: CacheNode): Promise<string> {
    const pkg = this.opts.packages.get(node.package);
    if (!pkg) {
      // A node without a discovered package cannot be cached meaningfully; use a
      // stable per-id sentinel so callers still get a deterministic value.
      return `no-pkg:${id}`;
    }

    // Resolve dependency keys first (sorted for determinism inside the key util).
    const depIds = [...(this.opts.dependencies.get(id) ?? [])];
    const dependencyKeys = await Promise.all(
      depIds.map(depId => {
        const depNode = this.opts.packages.get(splitNodeId(depId).package)
          ? splitNodeId(depId)
          : undefined;
        return depNode ? this.keyFor(depNode) : Promise.resolve(`no-pkg:${depId}`);
      })
    );

    const { inputs, outputs } = this.globsFor(node.task);
    const toolchain = await this.toolchain(pkg);

    return computeCacheKey({
      packageDir: pkg.dir,
      task: node.task,
      command: this.commandFor(pkg, node.task),
      inputs,
      outputs,
      dependencyKeys,
      toolchain,
      env: this.env,
    });
  }

  /**
   * Attempt to restore a node from the cache. Remote-then-local lookup order
   * means a CI runner with a configured remote hydrates from it first, falling
   * back to the local store. On a HIT the declared outputs are written to disk
   * and the captured logs + exit code are returned. Returns undefined on a miss.
   */
  async tryRestore(node: CacheNode): Promise<CacheHit | undefined> {
    const pkg = this.opts.packages.get(node.package);
    if (!pkg) return undefined;
    const key = await this.keyFor(node);

    const result =
      (await this.getFromRemote(key)) ?? (await this.opts.local.get(key));
    if (!result) {
      this.misses += 1;
      return undefined;
    }

    await restoreOutputs(pkg.dir, result.files);
    this.hits += 1;
    // A remote hit is seeded into the local store (in getFromRemote) so
    // subsequent local runs are instant.
    return { exitCode: result.exitCode, logs: result.logs };
  }

  /** Remote get that swallows transport errors (treated as a miss). */
  private async getFromRemote(key: string): Promise<CachedResult | undefined> {
    if (!this.opts.remote) return undefined;
    try {
      const result = await this.opts.remote.get(key);
      if (result) {
        // Hydrate the local store so the next run hits locally.
        await this.opts.local.put(key, result);
      }
      return result;
    } catch {
      return undefined;
    }
  }

  /**
   * Store a node's result after a real run. Captures the declared `outputs`
   * globs, persists exit code + logs + artifacts under the key in the local
   * store, and pushes to the remote when configured. Only successful runs
   * (exitCode 0) are cached: a failure must not be replayed as a hit.
   */
  async store(node: CacheNode, exitCode: number, logs: string): Promise<void> {
    if (exitCode !== 0) return;
    const pkg = this.opts.packages.get(node.package);
    if (!pkg) return;

    const key = await this.keyFor(node);
    const { outputs } = this.globsFor(node.task);
    const files = await captureOutputs(pkg.dir, outputs ?? []);
    const result: CachedResult = {
      exitCode,
      outputs: files.map(f => f.path),
      logs,
      files,
    };

    await this.opts.local.put(key, result);
    if (this.opts.remote) {
      try {
        await this.opts.remote.put(key, result);
      } catch {
        // A remote push failure is non-fatal: the local cache still benefits.
      }
    }
  }
}

/** Split a `"<package>#<task>"` node id back into its parts. */
function splitNodeId(id: string): CacheNode {
  const hash = id.lastIndexOf('#');
  return { package: id.slice(0, hash), task: id.slice(hash + 1) };
}
