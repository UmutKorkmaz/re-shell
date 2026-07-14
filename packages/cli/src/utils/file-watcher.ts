import * as fs from 'fs-extra';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';

import { ValidationError } from './error-handler';
import { WorkspaceDefinition, WorkspaceEntry } from './workspace-schema';
import { EventDebouncer, DebouncedEvent, BatchedEvents, createEventDebouncer } from './event-debouncer';
import { 
  PlatformWatcher, 
  PlatformCapabilities, 
  PlatformWatchOptions, 
  WatcherFallbackOptions,
  createPlatformWatcher,
  getPlatformCapabilities as getPlatformCaps,
  testPlatformWatching as testPlatformWatchingInternal
} from './platform-watcher';

/**
 * Represents a single file system change event emitted by the watcher.
 */
export interface FileWatchEvent {
  /** The kind of change that occurred (add, change, unlink, addDir, unlinkDir). */
  type: FileChangeType;
  /** Absolute path of the affected file or directory. */
  path: string;
  /** Name of the workspace that owns the changed path, if known. */
  workspace?: string;
  /** Epoch timestamp (ms) at which the event was captured. */
  timestamp: number;
  /** Size of the file in bytes, when available. */
  size?: number;
  /** Raw `fs.Stats` object for the affected entry, when stat information was collected. */
  stats?: fs.Stats;
}

/**
 * Describes the possible types of file system changes that can be observed.
 */
export type FileChangeType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

/**
 * Configuration options for the file watcher, including standard chokidar
 * options alongside cross-platform extensions provided by re-shell.
 */
export interface WatchOptions {
  /** Paths, globs, or regular expressions to ignore. */
  ignored?: string | RegExp | (string | RegExp)[];
  /** Whether the process should keep running as long as files are watched. */
  persistent?: boolean;
  /** Whether to ignore the initial `add` events emitted when watching starts. */
  ignoreInitial?: boolean;
  /** Whether to follow symbolic links. */
  followSymlinks?: boolean;
  /** Base directory used to resolve relative watch paths. */
  cwd?: string;
  /** Whether to disable glob pattern expansion. */
  disableGlobbing?: boolean;
  /** Whether to use polling instead of native file system events. */
  usePolling?: boolean;
  /** Polling interval in milliseconds (used when `usePolling` is true). */
  interval?: number;
  /** Polling interval in milliseconds for binary files. */
  binaryInterval?: number;
  /** Whether to always populate `stats` for emitted events. */
  alwaysStat?: boolean;
  /** Maximum depth of subdirectories to traverse. */
  depth?: number;
  /** Configuration for awaiting write completion before emitting events. */
  awaitWriteFinish?: boolean | {
    /** Time in ms the file size must remain stable before emitting. */
    stabilityThreshold?: number;
    /** Interval in ms at which file stability is polled. */
    pollInterval?: number;
  };
  /** Whether to ignore errors caused by insufficient permissions. */
  ignorePermissionErrors?: boolean;
  /** Whether to treat file renames atomically (renamed-to events). */
  atomic?: boolean;
  /** Whether to enable cross-platform fallback watchers. */
  enableFallbacks?: boolean;
  /** Whether to apply platform-specific optimizations. */
  platformOptimizations?: boolean;
  /** Optional fallback watcher configuration. */
  fallbackOptions?: Partial<WatcherFallbackOptions>;
  /** Platform-specific watcher overrides keyed by Node `process.platform`. */
  platformSpecific?: {
    /** Overrides applied when running on macOS. */
    darwin?: any;
    /** Overrides applied when running on Linux. */
    linux?: any;
    /** Overrides applied when running on Windows. */
    win32?: any;
    /** Index signature allowing additional platform keys. */
    [key: string]: any;
  };
}

/**
 * Defines a rule for propagating file changes to other workspaces, including
 * which source paths trigger the rule, which targets are affected, and what
 * action should be taken.
 */
export interface ChangePropagationRule {
  /** Unique identifier for the rule. */
  id: string;
  /** Human-readable name of the rule. */
  name: string;
  /** Longer description of what the rule does. */
  description: string;
  /** Pattern (string substring or RegExp) matched against source file paths. */
  sourcePattern: RegExp | string;
  /** Resolves the list of target workspaces affected by the rule. */
  targetWorkspaces: string[] | 'all' | ((workspace: string) => boolean);
  /** The kind of action to take when the rule fires. */
  actionType: PropagationActionType;
  /** Optional predicate that must return true for the rule to apply. */
  condition?: (event: FileWatchEvent, workspaces: Record<string, WorkspaceEntry>) => boolean;
  /** Optional transformer applied to the source event before propagation. */
  transform?: (event: FileWatchEvent) => FileWatchEvent;
  /** Optional debounce window in milliseconds before the rule fires. */
  debounceMs?: number;
}

/**
 * The set of actions that can be triggered by a propagation rule.
 */
export type PropagationActionType =
  | 'rebuild'
  | 'restart-dev'
  | 'run-tests'
  | 'invalidate-cache'
  | 'notify'
  | 'custom';

/**
 * Represents an emitted propagation event produced when a
 * {@link ChangePropagationRule} matches a source file event.
 */
export interface PropagationEvent {
  /** The rule that produced this event. */
  rule: ChangePropagationRule;
  /** The originating file event (possibly transformed). */
  sourceEvent: FileWatchEvent;
  /** List of workspace names targeted by the propagation. */
  targetWorkspaces: string[];
  /** Epoch timestamp (ms) when the propagation event was created. */
  timestamp: number;
  /** The action type that should be performed by listeners. */
  actionType: PropagationActionType;
}

/**
 * Snapshot of statistics describing the watcher's activity and health.
 */
export interface WatcherStats {
  /** Total number of raw file events observed. */
  totalEvents: number;
  /** Event counts broken down by {@link FileChangeType}. */
  eventsByType: Record<FileChangeType, number>;
  /** Event counts broken down by workspace name. */
  eventsByWorkspace: Record<string, number>;
  /** Total number of propagation events emitted. */
  propagatedEvents: number;
  /** Epoch timestamp (ms) when watching started. */
  startTime: number;
  /** Total uptime in milliseconds. */
  uptime: number;
  /** List of paths currently being watched. */
  watchedPaths: string[];
  /** Number of currently registered propagation rules. */
  activeRules: number;
  /** Cross-platform capabilities detected for the host platform. */
  platformCapabilities: PlatformCapabilities;
  /** Total number of active underlying watchers. */
  activeWatchers: number;
  /** Number of watchers currently using a fallback mechanism. */
  fallbackWatchers: number;
  /** Number of watchers considered healthy by the platform watcher. */
  healthyWatchers: number;
  /** Total number of watcher failures recorded. */
  watcherFailures: number;
}

/**
 * Cross-platform file watcher with workspace awareness, event debouncing, and
 * configurable change propagation rules. Extends `EventEmitter` to notify
 * consumers about file events, propagation events, and platform health.
 */
export class FileWatcher extends EventEmitter {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private watchedPaths: Set<string> = new Set();
  private propagationRules: Map<string, ChangePropagationRule> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventDebouncer: EventDebouncer;
  private platformWatcher: PlatformWatcher;
  private stats: WatcherStats;
  private workspaces: Record<string, WorkspaceEntry> = {};
  private rootPath: string;
  private isActive = false;
  private watcherFailures = 0;

  /**
   * Creates a new `FileWatcher` rooted at the given path.
   *
   * @param rootPath - Root directory the watcher operates relative to. Defaults to `process.cwd()`.
   * @param fallbackOptions - Optional cross-platform fallback configuration.
   */
  constructor(rootPath: string = process.cwd(), fallbackOptions?: Partial<WatcherFallbackOptions>) {
    super();
    this.rootPath = rootPath;
    
    // Initialize platform watcher with cross-platform capabilities
    this.platformWatcher = createPlatformWatcher(fallbackOptions);
    
    // Set up platform watcher event listeners
    this.setupPlatformWatcherListeners();
    
    // Initialize event debouncer with intelligent defaults
    this.eventDebouncer = createEventDebouncer({
      delay: 300,
      maxDelay: 2000,
      maxBatchSize: 100,
      enableDeduplication: true,
      enableBatching: true,
      groupByType: false,
      includeStats: true
    });

    // Set up debouncer event listeners
    this.setupDebouncerListeners();
    
    const platformCapabilities = this.platformWatcher.getPlatformCapabilities();
    
    this.stats = {
      totalEvents: 0,
      eventsByType: {
        add: 0,
        change: 0,
        unlink: 0,
        addDir: 0,
        unlinkDir: 0
      },
      eventsByWorkspace: {},
      propagatedEvents: 0,
      startTime: Date.now(),
      uptime: 0,
      watchedPaths: [],
      activeRules: 0,
      // Cross-platform stats
      platformCapabilities,
      activeWatchers: 0,
      fallbackWatchers: 0,
      healthyWatchers: 0,
      watcherFailures: 0
    };

    this.initializeDefaultRules();
  }

  // Setup platform watcher event listeners
  private setupPlatformWatcherListeners(): void {
    this.platformWatcher.on('watcher-created', ({ watcherId, watchPath, method }) => {
      this.emit('platform-watcher-created', { watcherId, watchPath, method });
    });

    this.platformWatcher.on('watcher-error', ({ watcherId, watchPath, error }) => {
      this.watcherFailures++;
      this.emit('platform-watcher-error', { watcherId, watchPath, error });
    });

    this.platformWatcher.on('fallback-activated', ({ watcherId, watchPath, method }) => {
      this.emit('platform-fallback-activated', { watcherId, watchPath, method });
    });

    this.platformWatcher.on('fallback-failed', ({ watcherId, watchPath, error }) => {
      this.watcherFailures++;
      this.emit('platform-fallback-failed', { watcherId, watchPath, error });
    });

    this.platformWatcher.on('watcher-unhealthy', ({ watcherId, watchPath, error, failureCount }) => {
      this.emit('platform-watcher-unhealthy', { watcherId, watchPath, error, failureCount });
    });

    this.platformWatcher.on('health-check-completed', ({ totalWatchers, healthyWatchers }) => {
      this.stats.activeWatchers = totalWatchers;
      this.stats.healthyWatchers = healthyWatchers;
      this.emit('platform-health-check', { totalWatchers, healthyWatchers });
    });
  }

  /**
   * Begins watching the provided workspace directories (and root configuration
   * files) using platform-optimized watchers.
   *
   * @param workspaces - Map of workspace name to workspace entry to watch.
   * @param options - Optional watcher configuration; merged with sensible defaults.
   * @returns Resolves once all watchers have been initialized.
   * @throws {ValidationError} If watching is already active.
   */
  async startWatching(
    workspaces: Record<string, WorkspaceEntry>,
    options: WatchOptions = {}
  ): Promise<void> {
    if (this.isActive) {
      throw new ValidationError('File watcher is already active');
    }

    this.workspaces = workspaces;
    this.isActive = true;
    this.stats.startTime = Date.now();

    const defaultOptions: WatchOptions = {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.re-shell/**',
        '**/.next/**',
        '**/.nuxt/**',
        '**/coverage/**',
        '**/.nyc_output/**',
        '**/*.log',
        '**/.DS_Store',
        '**/Thumbs.db'
      ],
      persistent: true,
      ignoreInitial: true,
      followSymlinks: true,
      usePolling: false,
      interval: 1000,
      binaryInterval: 3000,
      alwaysStat: true,
      depth: undefined,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      },
      ignorePermissionErrors: true,
      atomic: true,
      // Enable cross-platform features by default
      enableFallbacks: true,
      platformOptimizations: true,
      ...options
    };

    // Watch each workspace directory using platform watcher
    for (const [workspaceName, workspace] of Object.entries(workspaces)) {
      if (!workspace.path) continue;

      const watchPath = path.resolve(this.rootPath, workspace.path);
      
      if (!(await fs.pathExists(watchPath))) {
        this.emit('warning', `Workspace path does not exist: ${watchPath}`);
        continue;
      }

      try {
        // Convert WatchOptions to PlatformWatchOptions
        const platformOptions: PlatformWatchOptions = {
          usePolling: defaultOptions.usePolling,
          interval: defaultOptions.interval,
          binaryInterval: defaultOptions.binaryInterval,
          useNativeWatcher: !defaultOptions.usePolling,
          enableFallbacks: defaultOptions.enableFallbacks,
          fallbackOptions: defaultOptions.fallbackOptions,
          platformSpecific: defaultOptions.platformSpecific
        };

        // Create platform-optimized watcher
        const watcher = await this.platformWatcher.createWatcher(watchPath, platformOptions);
        
        // Set up event handlers
        watcher
          .on('add', (filePath, stats) => this.handleFileEvent('add', filePath, workspaceName, stats))
          .on('change', (filePath, stats) => this.handleFileEvent('change', filePath, workspaceName, stats))
          .on('unlink', (filePath) => this.handleFileEvent('unlink', filePath, workspaceName))
          .on('addDir', (dirPath, stats) => this.handleFileEvent('addDir', dirPath, workspaceName, stats))
          .on('unlinkDir', (dirPath) => this.handleFileEvent('unlinkDir', dirPath, workspaceName))
          .on('error', (error) => this.handleWatchError(error, workspaceName))
          .on('ready', () => this.handleWatchReady(workspaceName, watchPath));

        this.watchers.set(workspaceName, watcher);
        this.watchedPaths.add(watchPath);
        
      } catch (error) {
        this.watcherFailures++;
        this.emit('error', new ValidationError(
          `Failed to start watching ${workspaceName}: ${error instanceof Error ? error.message : String(error)}`
        ));
      }
    }

    // Watch root configuration files using platform watcher
    await this.watchRootFiles(defaultOptions);

    // Update stats
    this.stats.activeWatchers = this.platformWatcher.getActiveWatchersCount();

    this.emit('started', {
      watchedWorkspaces: Object.keys(workspaces).length,
      watchedPaths: Array.from(this.watchedPaths),
      activeRules: this.propagationRules.size,
      platformCapabilities: this.stats.platformCapabilities
    });
  }

  /**
   * Stops all active watchers, clears pending debounce timers, and finalizes
   * statistics. Emits a `stopped` event once complete.
   *
   * @returns Resolves once all watchers have been closed.
   */
  async stopWatching(): Promise<void> {
    if (!this.isActive) return;

    this.isActive = false;

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Flush and clear the event debouncer
    this.eventDebouncer.flush();
    this.eventDebouncer.clear();

    // Close platform watcher (handles all watchers)
    await this.platformWatcher.closeAll();
    
    this.watchers.clear();
    this.watchedPaths.clear();
    
    this.stats.uptime = Date.now() - this.stats.startTime;
    this.stats.activeWatchers = 0;
    this.stats.healthyWatchers = 0;
    
    this.emit('stopped', {
      uptime: this.stats.uptime,
      totalEvents: this.stats.totalEvents,
      propagatedEvents: this.stats.propagatedEvents,
      watcherFailures: this.watcherFailures
    });
  }

  /**
   * Registers a new change propagation rule.
   *
   * @param rule - The propagation rule to register.
   */
  addPropagationRule(rule: ChangePropagationRule): void {
    this.propagationRules.set(rule.id, rule);
    this.stats.activeRules = this.propagationRules.size;
    this.emit('rule-added', rule);
  }

  /**
   * Removes a previously registered propagation rule by id.
   *
   * @param ruleId - Identifier of the rule to remove.
   * @returns `true` if a rule was removed; `false` otherwise.
   */
  removePropagationRule(ruleId: string): boolean {
    const removed = this.propagationRules.delete(ruleId);
    this.stats.activeRules = this.propagationRules.size;
    if (removed) {
      this.emit('rule-removed', ruleId);
    }
    return removed;
  }

  /**
   * Returns a snapshot of the watcher's current statistics and health.
   *
   * @returns A {@link WatcherStats} object with up-to-date metrics.
   */
  getStats(): WatcherStats {
    return {
      ...this.stats,
      uptime: this.isActive ? Date.now() - this.stats.startTime : this.stats.uptime,
      watchedPaths: Array.from(this.watchedPaths),
      activeWatchers: this.platformWatcher.getActiveWatchersCount(),
      watcherFailures: this.watcherFailures
    };
  }

  /**
   * Indicates whether the watcher is currently active.
   *
   * @returns `true` if watching has started and not yet stopped; `false` otherwise.
   */
  isWatching(): boolean {
    return this.isActive;
  }

  /**
   * Returns the cross-platform capabilities detected for the host platform.
   *
   * @returns A {@link PlatformCapabilities} object.
   */
  getPlatformCapabilities(): PlatformCapabilities {
    return this.platformWatcher.getPlatformCapabilities();
  }

  /**
   * Retrieves health information for one or all platform watchers.
   *
   * @param watcherId - Optional identifier of a specific watcher to inspect.
   * @returns Health information from the underlying platform watcher.
   */
  getPlatformWatcherHealth(watcherId?: string) {
    return this.platformWatcher.getWatcherHealth(watcherId);
  }

  /**
   * Runs a runtime test of the host platform's file watching capabilities.
   *
   * @returns Resolves to the platform capability test results.
   */
  async testPlatformCapabilities() {
    return await this.platformWatcher.testPlatformCapabilities();
  }

  // Setup debouncer event listeners
  private setupDebouncerListeners(): void {
    // Handle individual debounced events
    this.eventDebouncer.on('debounced-event', (debouncedEvent: DebouncedEvent) => {
      const event: FileWatchEvent = {
        type: debouncedEvent.type,
        path: debouncedEvent.path,
        workspace: this.getWorkspaceForPath(debouncedEvent.path),
        timestamp: debouncedEvent.timestamp,
        size: debouncedEvent.stats?.size,
        stats: debouncedEvent.stats
      };

      // Emit the debounced file event
      this.emit('file-event', event);

      // Process propagation rules
      this.processPropagationRules(event);
    });

    // Handle batched events
    this.eventDebouncer.on('batched-events', (batch: BatchedEvents) => {
      const events: FileWatchEvent[] = batch.events.map(debouncedEvent => ({
        type: debouncedEvent.type,
        path: debouncedEvent.path,
        workspace: this.getWorkspaceForPath(debouncedEvent.path),
        timestamp: debouncedEvent.timestamp,
        size: debouncedEvent.stats?.size,
        stats: debouncedEvent.stats
      }));

      // Emit batch event
      this.emit('batched-file-events', {
        events,
        batch,
        totalEvents: batch.totalEvents,
        timespan: batch.endTime - batch.startTime
      });

      // Process each event for propagation rules
      events.forEach(event => this.processPropagationRules(event));
    });

    // Handle raw event additions for debugging
    this.eventDebouncer.on('event-added', (event: DebouncedEvent) => {
      this.emit('raw-event', event);
    });
  }

  // Get workspace for file path
  private getWorkspaceForPath(filePath: string): string {
    for (const [workspaceName, workspace] of Object.entries(this.workspaces)) {
      const workspacePath = path.resolve(this.rootPath, workspace.path);
      if (filePath.startsWith(workspacePath)) {
        return workspaceName;
      }
    }
    return 'unknown';
  }

  // Handle file system events
  private handleFileEvent(
    type: FileChangeType,
    filePath: string,
    workspace: string,
    stats?: fs.Stats
  ): void {
    // Update statistics for raw events
    this.stats.totalEvents++;
    this.stats.eventsByType[type]++;
    this.stats.eventsByWorkspace[workspace] = (this.stats.eventsByWorkspace[workspace] || 0) + 1;

    // Add event to debouncer for intelligent processing
    this.eventDebouncer.addEvent(type, filePath, stats);
  }

  // Process change propagation rules
  private processPropagationRules(event: FileWatchEvent): void {
    for (const rule of this.propagationRules.values()) {
      if (this.matchesRule(event, rule)) {
        this.propagateChange(event, rule);
      }
    }
  }

  // Check if event matches propagation rule
  private matchesRule(event: FileWatchEvent, rule: ChangePropagationRule): boolean {
    // Check source pattern
    const sourceMatch = typeof rule.sourcePattern === 'string'
      ? event.path.includes(rule.sourcePattern)
      : rule.sourcePattern.test(event.path);

    if (!sourceMatch) return false;

    // Check condition if provided
    if (rule.condition && !rule.condition(event, this.workspaces)) {
      return false;
    }

    return true;
  }

  // Propagate change to target workspaces
  private propagateChange(event: FileWatchEvent, rule: ChangePropagationRule): void {
    const targetWorkspaces = this.resolveTargetWorkspaces(rule.targetWorkspaces, event);
    
    if (targetWorkspaces.length === 0) return;

    const propagationEvent: PropagationEvent = {
      rule,
      sourceEvent: rule.transform ? rule.transform(event) : event,
      targetWorkspaces,
      timestamp: Date.now(),
      actionType: rule.actionType
    };

    // Handle debouncing if specified
    if (rule.debounceMs && rule.debounceMs > 0) {
      this.debouncePropagate(propagationEvent, rule);
    } else {
      this.emitPropagation(propagationEvent);
    }
  }

  // Handle debounced propagation
  private debouncePropagate(event: PropagationEvent, rule: ChangePropagationRule): void {
    const timerId = `${rule.id}-${event.sourceEvent.path}`;
    
    // Clear existing timer
    if (this.debounceTimers.has(timerId)) {
      clearTimeout(this.debounceTimers.get(timerId)!);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.debounceTimers.delete(timerId);
      this.emitPropagation(event);
    }, rule.debounceMs);

    this.debounceTimers.set(timerId, timer);
  }

  // Emit propagation event
  private emitPropagation(event: PropagationEvent): void {
    this.stats.propagatedEvents++;
    this.emit('propagate', event);
  }

  // Resolve target workspaces from rule definition
  private resolveTargetWorkspaces(
    target: string[] | 'all' | ((workspace: string) => boolean),
    event: FileWatchEvent
  ): string[] {
    if (target === 'all') {
      return Object.keys(this.workspaces);
    }

    if (Array.isArray(target)) {
      return target.filter(ws => this.workspaces[ws]);
    }

    if (typeof target === 'function') {
      return Object.keys(this.workspaces).filter(target);
    }

    return [];
  }

  // Watch root configuration files
  private async watchRootFiles(options: WatchOptions): Promise<void> {
    const rootFiles = [
      're-shell.workspaces.yaml',
      're-shell.config.yaml',
      'package.json',
      'tsconfig.json',
      '.env',
      '.env.local'
    ];

    for (const file of rootFiles) {
      const filePath = path.join(this.rootPath, file);
      
      if (await fs.pathExists(filePath)) {
        try {
          // Convert to platform watch options
          const platformOptions: PlatformWatchOptions = {
            usePolling: options.usePolling,
            interval: options.interval,
            binaryInterval: options.binaryInterval,
            useNativeWatcher: !options.usePolling,
            enableFallbacks: options.enableFallbacks,
            fallbackOptions: options.fallbackOptions,
            platformSpecific: options.platformSpecific
          };

          const watcher = await this.platformWatcher.createWatcher(filePath, platformOptions);

          watcher
            .on('change', (changedPath, stats) => this.handleFileEvent('change', changedPath, 'root', stats))
            .on('unlink', (changedPath) => this.handleFileEvent('unlink', changedPath, 'root'))
            .on('error', (error) => this.handleWatchError(error, 'root'));

          this.watchers.set(`root-${file}`, watcher);
          this.watchedPaths.add(filePath);
          
        } catch (error) {
          this.emit('warning', `Failed to watch root file ${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Handle watch errors
  private handleWatchError(error: unknown, workspace: string): void {
    const message = error instanceof Error ? error.message : String(error);
    this.emit('error', new ValidationError(
      `File watcher error in ${workspace}: ${message}`
    ));
  }

  // Handle watcher ready state
  private handleWatchReady(workspace: string, path: string): void {
    this.emit('watcher-ready', { workspace, path });
  }

  /**
   * Updates the configuration of the underlying event debouncer.
   *
   * @param options - Partial debouncer options to apply.
   */
  configureDebouncer(options: Partial<{
    delay: number;
    maxDelay: number;
    maxBatchSize: number;
    enableDeduplication: boolean;
    enableBatching: boolean;
    groupByType: boolean;
    includeStats: boolean;
  }>): void {
    this.eventDebouncer.updateOptions(options);
  }

  /**
   * Adds a filter to the event debouncer so that only matching events are processed.
   *
   * @param filter - Filter configuration describing which events to keep.
   */
  addDebouncerFilter(filter: {
    patterns: RegExp[];
    types: string[];
    minFileSize?: number;
    maxFileSize?: number;
    extensions?: string[];
    excludePatterns?: RegExp[];
  }): void {
    this.eventDebouncer.addFilter(filter);
  }

  /**
   * Returns statistics about the event debouncer's current state.
   *
   * @returns An object with pending event counts, timer/batch counts, and options.
   */
  getDebouncerStats(): {
    pendingEvents: number;
    activeTimers: number;
    activeBatches: number;
    totalFilters: number;
    options: any;
  } {
    return this.eventDebouncer.getStatistics();
  }

  /**
   * Immediately flushes all pending debounced events through the pipeline.
   */
  flushDebouncedEvents(): void {
    this.eventDebouncer.flush();
  }

  // Initialize default propagation rules
  private initializeDefaultRules(): void {
    // Package.json changes trigger dependency updates
    this.addPropagationRule({
      id: 'package-json-changed',
      name: 'Package.json Dependencies',
      description: 'Propagate package.json changes to dependent workspaces',
      sourcePattern: /package\.json$/,
      targetWorkspaces: 'all',
      actionType: 'invalidate-cache',
      debounceMs: 3000,
      condition: (event) => event.type === 'change'
    });

    // TypeScript config changes
    this.addPropagationRule({
      id: 'tsconfig-changed',
      name: 'TypeScript Configuration',
      description: 'Rebuild TypeScript workspaces when config changes',
      sourcePattern: /tsconfig.*\.json$/,
      targetWorkspaces: (workspace) => {
        const ws = this.workspaces[workspace];
        return ws?.type === 'app' || ws?.type === 'lib';
      },
      actionType: 'rebuild',
      debounceMs: 2000
    });

    // Source code changes in libraries
    this.addPropagationRule({
      id: 'lib-source-changed',
      name: 'Library Source Changes',
      description: 'Rebuild dependent workspaces when library source changes',
      sourcePattern: /\.(ts|tsx|js|jsx)$/,
      targetWorkspaces: [],
      actionType: 'rebuild',
      debounceMs: 1000,
      condition: (event, workspaces) => {
        const workspace = workspaces[event.workspace!];
        return workspace?.type === 'lib' && event.type === 'change';
      }
    });

    // Environment file changes
    this.addPropagationRule({
      id: 'env-changed',
      name: 'Environment Variables',
      description: 'Restart development servers when environment changes',
      sourcePattern: /\.env/,
      targetWorkspaces: 'all',
      actionType: 'restart-dev',
      debounceMs: 1000
    });

    // Test file changes
    this.addPropagationRule({
      id: 'test-changed',
      name: 'Test Files',
      description: 'Run tests when test files change',
      sourcePattern: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      targetWorkspaces: (workspace) => !!workspace,
      actionType: 'run-tests',
      debounceMs: 500,
      condition: (event) => event.type === 'change' || event.type === 'add'
    });

    // Configuration file changes
    this.addPropagationRule({
      id: 'config-changed',
      name: 'Configuration Files',
      description: 'Restart when configuration files change',
      sourcePattern: /\.(config|rc)\.(js|json|yaml|yml)$/,
      targetWorkspaces: 'all',
      actionType: 'restart-dev',
      debounceMs: 2000
    });
  }
}

/**
 * Factory that constructs a new {@link FileWatcher} instance.
 *
 * @param rootPath - Root directory the watcher should operate within.
 * @param fallbackOptions - Optional cross-platform fallback configuration.
 * @returns Resolves to a ready-to-use `FileWatcher` instance.
 */
export async function createFileWatcher(
  rootPath?: string,
  fallbackOptions?: Partial<WatcherFallbackOptions>
): Promise<FileWatcher> {
  return new FileWatcher(rootPath, fallbackOptions);
}

/**
 * Convenience helper that constructs a {@link FileWatcher}, loads a workspace
 * definition from the given file, and immediately starts watching.
 *
 * @param workspaceFile - Path to the workspace definition YAML file.
 * @param options - Optional watcher configuration merged with defaults.
 * @param fallbackOptions - Optional cross-platform fallback configuration.
 * @returns Resolves to the started `FileWatcher` instance.
 */
export async function startWorkspaceWatcher(
  workspaceFile: string,
  options?: WatchOptions,
  fallbackOptions?: Partial<WatcherFallbackOptions>
): Promise<FileWatcher> {
  const watcher = new FileWatcher(process.cwd(), fallbackOptions);
  
  // Load workspace definition
  const definition = await loadWorkspaceDefinition(workspaceFile);
  
  // Start watching
  await watcher.startWatching(definition.workspaces, options);
  
  return watcher;
}

/**
 * Creates a {@link FileWatcher} preconfigured with cross-platform optimizations
 * and fallback support, logging any platform recommendations detected.
 *
 * @param rootPath - Root directory the watcher should operate within.
 * @param enableFallbacks - Whether to enable cross-platform fallbacks. Defaults to `true`.
 * @returns Resolves to a cross-platform optimized `FileWatcher` instance.
 */
export async function createCrossPlatformWatcher(
  rootPath?: string,
  enableFallbacks = true
): Promise<FileWatcher> {
  const fallbackOptions: Partial<WatcherFallbackOptions> = {
    enableFallbackLogging: true,
    platformOptimizations: true,
    adaptivePolling: true,
    maxRetries: 3,
    fallbackDelay: 2000
  };

  const watcher = new FileWatcher(rootPath, fallbackOptions);
  
  // Test platform capabilities
  const capabilities = await watcher.testPlatformCapabilities();
  
  if (capabilities.recommendations.length > 0) {
    console.log('Platform recommendations:', capabilities.recommendations.join(', '));
  }
  
  return watcher;
}

// Helper function to load workspace definition
async function loadWorkspaceDefinition(filePath: string): Promise<WorkspaceDefinition> {
  if (!(await fs.pathExists(filePath))) {
    throw new ValidationError(`Workspace file not found: ${filePath}`);
  }

  const content = await fs.readFile(filePath, 'utf8');
  const yaml = await import('yaml');
  return yaml.parse(content) as WorkspaceDefinition;
}

/**
 * Returns the file watching capabilities of the current platform.
 *
 * @returns A {@link PlatformCapabilities} object describing native and fallback support.
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  return getPlatformCaps();
}

/**
 * Runs a runtime test of the current platform's file watching behavior.
 *
 * @returns Resolves to the platform watching test results.
 */
export async function testPlatformWatching() {
  return await testPlatformWatchingInternal();
}