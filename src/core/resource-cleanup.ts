import { EventEmitter } from 'events';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ResourceHandle {
  id: string;
  type: ResourceType;
  resource: any;
  metadata: {
    created: Date;
    lastAccessed: Date;
    size?: number;
    tags?: string[];
    priority: ResourcePriority;
  };
  cleanup: () => Promise<void> | void;
}

export enum ResourceType {
  FILE_HANDLE = 'file_handle',
  STREAM = 'stream',
  NETWORK_CONNECTION = 'network_connection',
  CHILD_PROCESS = 'child_process',
  TIMER = 'timer',
  EVENT_LISTENER = 'event_listener',
  TEMPORARY_FILE = 'temporary_file',
  TEMPORARY_DIRECTORY = 'temporary_directory',
  CACHE_ENTRY = 'cache_entry',
  MEMORY_BUFFER = 'memory_buffer',
  DATABASE_CONNECTION = 'database_connection',
  CUSTOM = 'custom'
}

export enum ResourcePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export interface StateSnapshot {
  id: string;
  timestamp: Date;
  operation: string;
  state: any;
  resources: string[];
  checksum: string;
}

export interface RecoveryPlan {
  id: string;
  operation: string;
  steps: RecoveryStep[];
  rollbackSteps: RecoveryStep[];
  resources: string[];
  metadata: {
    created: Date;
    estimatedDuration: number;
    dependencies: string[];
  };
}

export interface RecoveryStep {
  id: string;
  type: 'cleanup' | 'restore' | 'recreate' | 'verify' | 'rollback';
  description: string;
  action: () => Promise<void>;
  rollback?: () => Promise<void>;
  timeout: number;
  critical: boolean;
}

export interface CleanupOptions {
  gracefulTimeout: number;
  forceTimeout: number;
  priority: ResourcePriority;
  preserveTypes: ResourceType[];
  dryRun: boolean;
}

export class ResourceManager extends EventEmitter {
  private resources: Map<string, ResourceHandle> = new Map();
  private stateSnapshots: Map<string, StateSnapshot> = new Map();
  private recoveryPlans: Map<string, RecoveryPlan> = new Map();
  private activeOperations: Map<string, { startTime: Date; resources: string[] }> = new Map();
  private cleanupInProgress = false;
  private shutdownHooksRegistered = false;

  constructor() {
    super();
    this.registerShutdownHooks();
  }

  private registerShutdownHooks(): void {
    if (this.shutdownHooksRegistered) return;

    process.on('exit', () => {
      this.performEmergencyCleanup();
    });

    process.on('SIGINT', () => {
      this.performGracefulShutdown().then(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      this.performGracefulShutdown().then(() => process.exit(0));
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception, performing emergency cleanup:', error);
      this.performEmergencyCleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection, performing emergency cleanup:', reason);
      this.performEmergencyCleanup();
      process.exit(1);
    });

    this.shutdownHooksRegistered = true;
  }

  registerResource<T>(
    type: ResourceType,
    resource: T,
    cleanup: () => Promise<void> | void,
    options: {
      tags?: string[];
      priority?: ResourcePriority;
      size?: number;
    } = {}
  ): string {
    const id = this.generateResourceId();
    const now = new Date();

    const handle: ResourceHandle = {
      id,
      type,
      resource,
      metadata: {
        created: now,
        lastAccessed: now,
        size: options.size,
        tags: options.tags || [],
        priority: options.priority || ResourcePriority.NORMAL
      },
      cleanup
    };

    this.resources.set(id, handle);
    this.emit('resource:registered', handle);

    return id;
  }

  unregisterResource(id: string): boolean {
    const handle = this.resources.get(id);
    if (handle) {
      this.resources.delete(id);
      this.emit('resource:unregistered', handle);
      return true;
    }
    return false;
  }

  async cleanupResource(id: string, force = false): Promise<boolean> {
    const handle = this.resources.get(id);
    if (!handle) return false;

    try {
      this.emit('resource:cleanup:start', handle);

      if (force) {
        await this.forceCleanupResource(handle);
      } else {
        await this.gracefulCleanupResource(handle);
      }

      this.resources.delete(id);
      this.emit('resource:cleanup:success', handle);
      return true;

    } catch (error) {
      this.emit('resource:cleanup:error', { handle, error });
      throw error;
    }
  }

  private async gracefulCleanupResource(handle: ResourceHandle): Promise<void> {
    const timeout = this.getTimeoutForPriority(handle.metadata.priority);
    
    await this.withTimeout(async () => {
      await handle.cleanup();
    }, timeout);
  }

  private async forceCleanupResource(handle: ResourceHandle): Promise<void> {
    try {
      // Try graceful cleanup first with shorter timeout
      await this.withTimeout(async () => {
        await handle.cleanup();
      }, 1000);
    } catch (error) {
      // Force cleanup for specific resource types
      await this.performForceCleanup(handle);
    }
  }

  private async performForceCleanup(handle: ResourceHandle): Promise<void> {
    switch (handle.type) {
      case ResourceType.FILE_HANDLE:
        if (handle.resource && typeof handle.resource.close === 'function') {
          handle.resource.close();
        }
        break;

      case ResourceType.STREAM:
        if (handle.resource && typeof handle.resource.destroy === 'function') {
          handle.resource.destroy();
        }
        break;

      case ResourceType.CHILD_PROCESS:
        if (handle.resource && typeof handle.resource.kill === 'function') {
          handle.resource.kill('SIGKILL');
        }
        break;

      case ResourceType.TIMER:
        if (handle.resource) {
          clearTimeout(handle.resource);
          clearInterval(handle.resource);
        }
        break;

      case ResourceType.TEMPORARY_FILE:
        try {
          await fs.unlink(handle.resource);
        } catch {
          // Ignore errors
        }
        break;

      case ResourceType.TEMPORARY_DIRECTORY:
        try {
          await fs.remove(handle.resource);
        } catch {
          // Ignore errors
        }
        break;

      default:
        // Custom cleanup
        try {
          await handle.cleanup();
        } catch {
          // Ignore errors in force mode
        }
        break;
    }
  }

  private getTimeoutForPriority(priority: ResourcePriority): number {
    switch (priority) {
      case ResourcePriority.LOW: return 1000;
      case ResourcePriority.NORMAL: return 5000;
      case ResourcePriority.HIGH: return 10000;
      case ResourcePriority.CRITICAL: return 30000;
      default: return 5000;
    }
  }

  async cleanupByType(type: ResourceType, options: Partial<CleanupOptions> = {}): Promise<number> {
    const handles = Array.from(this.resources.values())
      .filter(h => h.type === type);

    if (options.dryRun) {
      this.emit('cleanup:dry_run', { type, count: handles.length });
      return handles.length;
    }

    let cleaned = 0;
    for (const handle of handles) {
      try {
        await this.cleanupResource(handle.id);
        cleaned++;
      } catch (error) {
        this.emit('cleanup:error', { handle, error });
      }
    }

    return cleaned;
  }

  async cleanupByTags(tags: string[], options: Partial<CleanupOptions> = {}): Promise<number> {
    const handles = Array.from(this.resources.values())
      .filter(h => h.metadata.tags && tags.some(tag => h.metadata.tags!.includes(tag)));

    if (options.dryRun) {
      this.emit('cleanup:dry_run', { tags, count: handles.length });
      return handles.length;
    }

    let cleaned = 0;
    for (const handle of handles) {
      try {
        await this.cleanupResource(handle.id);
        cleaned++;
      } catch (error) {
        this.emit('cleanup:error', { handle, error });
      }
    }

    return cleaned;
  }

  async cleanupAll(options: Partial<CleanupOptions> = {}): Promise<number> {
    if (this.cleanupInProgress) {
      return 0;
    }

    this.cleanupInProgress = true;
    const defaultOptions: CleanupOptions = {
      gracefulTimeout: 30000,
      forceTimeout: 5000,
      priority: ResourcePriority.LOW,
      preserveTypes: [],
      dryRun: false
    };

    const opts = { ...defaultOptions, ...options };

    try {
      const handles = Array.from(this.resources.values())
        .filter(h => !opts.preserveTypes.includes(h.type))
        .filter(h => h.metadata.priority >= opts.priority)
        .sort((a, b) => b.metadata.priority - a.metadata.priority);

      if (opts.dryRun) {
        this.emit('cleanup:dry_run', { count: handles.length });
        return handles.length;
      }

      this.emit('cleanup:start', { count: handles.length });

      // Phase 1: Graceful cleanup
      let cleaned = 0;
      const gracefulPromises = handles.map(async (handle) => {
        try {
          await this.withTimeout(async () => {
            await this.cleanupResource(handle.id);
          }, opts.gracefulTimeout);
          cleaned++;
        } catch (error) {
          this.emit('cleanup:graceful_failed', { handle, error });
        }
      });

      await Promise.allSettled(gracefulPromises);

      // Phase 2: Force cleanup remaining resources
      const remainingHandles = Array.from(this.resources.values())
        .filter(h => !opts.preserveTypes.includes(h.type));

      if (remainingHandles.length > 0) {
        this.emit('cleanup:force_start', { count: remainingHandles.length });

        const forcePromises = remainingHandles.map(async (handle) => {
          try {
            await this.cleanupResource(handle.id, true);
            cleaned++;
          } catch (error) {
            this.emit('cleanup:force_failed', { handle, error });
          }
        });

        await Promise.allSettled(forcePromises);
      }

      this.emit('cleanup:complete', { cleaned });
      return cleaned;

    } finally {
      this.cleanupInProgress = false;
    }
  }

  private performEmergencyCleanup(): void {
    const handles = Array.from(this.resources.values());
    
    for (const handle of handles) {
      try {
        if (typeof handle.cleanup === 'function') {
          const result = handle.cleanup();
          if (result && typeof result.then === 'function') {
            // Don't wait for async cleanup in emergency
            result.catch(() => { /* ignore */ });
          }
        }
      } catch {
        // Ignore errors in emergency cleanup
      }
    }

    this.resources.clear();
  }

  private async performGracefulShutdown(): Promise<void> {
    try {
      await this.cleanupAll({
        gracefulTimeout: 10000,
        forceTimeout: 2000,
        priority: ResourcePriority.LOW
      });
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      this.performEmergencyCleanup();
    }
  }

  // State management
  createSnapshot(operation: string, state: any): string {
    const id = this.generateSnapshotId();
    const resources = Array.from(this.resources.keys());
    const checksum = this.calculateChecksum(state);

    const snapshot: StateSnapshot = {
      id,
      timestamp: new Date(),
      operation,
      state: this.deepClone(state),
      resources,
      checksum
    };

    this.stateSnapshots.set(id, snapshot);
    this.emit('snapshot:created', snapshot);

    // Keep only recent snapshots
    this.cleanupOldSnapshots();

    return id;
  }

  restoreSnapshot(id: string): any {
    const snapshot = this.stateSnapshots.get(id);
    if (!snapshot) {
      throw new Error(`Snapshot ${id} not found`);
    }

    // Verify checksum
    const currentChecksum = this.calculateChecksum(snapshot.state);
    if (currentChecksum !== snapshot.checksum) {
      throw new Error(`Snapshot ${id} is corrupted`);
    }

    this.emit('snapshot:restored', snapshot);
    return this.deepClone(snapshot.state);
  }

  createRecoveryPlan(operation: string, steps: RecoveryStep[]): string {
    const id = this.generateRecoveryPlanId();
    const resources = Array.from(this.resources.keys());
    const estimatedDuration = steps.reduce((total, step) => total + step.timeout, 0);

    const plan: RecoveryPlan = {
      id,
      operation,
      steps,
      rollbackSteps: steps.filter(s => s.rollback).reverse(),
      resources,
      metadata: {
        created: new Date(),
        estimatedDuration,
        dependencies: []
      }
    };

    this.recoveryPlans.set(id, plan);
    this.emit('recovery_plan:created', plan);

    return id;
  }

  async executeRecoveryPlan(id: string): Promise<void> {
    const plan = this.recoveryPlans.get(id);
    if (!plan) {
      throw new Error(`Recovery plan ${id} not found`);
    }

    this.emit('recovery:start', plan);

    const executedSteps: RecoveryStep[] = [];

    try {
      for (const step of plan.steps) {
        this.emit('recovery:step:start', step);

        try {
          await this.withTimeout(step.action, step.timeout);
          executedSteps.push(step);
          this.emit('recovery:step:success', step);
        } catch (error) {
          this.emit('recovery:step:error', { step, error });
          
          if (step.critical) {
            throw new Error(`Critical recovery step failed: ${step.description}`);
          }
        }
      }

      this.emit('recovery:success', plan);

    } catch (error) {
      this.emit('recovery:failure', { plan, error });

      // Execute rollback
      await this.executeRollback(executedSteps);
      throw error;
    }
  }

  private async executeRollback(executedSteps: RecoveryStep[]): Promise<void> {
    this.emit('rollback:start', { steps: executedSteps.length });

    for (const step of executedSteps.reverse()) {
      if (step.rollback) {
        try {
          await this.withTimeout(step.rollback, step.timeout);
          this.emit('rollback:step:success', step);
        } catch (error) {
          this.emit('rollback:step:error', { step, error });
        }
      }
    }

    this.emit('rollback:complete');
  }

  // Utility methods
  private generateResourceId(): string {
    return `res_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateSnapshotId(): string {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private generateRecoveryPlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  private calculateChecksum(data: any): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private deepClone(obj: any): any {
    return JSON.parse(JSON.stringify(obj));
  }

  private cleanupOldSnapshots(): void {
    const snapshots = Array.from(this.stateSnapshots.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());

    // Keep only last 100 snapshots
    if (snapshots.length > 100) {
      const toDelete = snapshots.slice(100);
      for (const [id] of toDelete) {
        this.stateSnapshots.delete(id);
      }
    }
  }

  private async withTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // Query methods
  getResourceCount(): number {
    return this.resources.size;
  }

  getResourcesByType(type: ResourceType): ResourceHandle[] {
    return Array.from(this.resources.values())
      .filter(h => h.type === type);
  }

  getResourcesByTags(tags: string[]): ResourceHandle[] {
    return Array.from(this.resources.values())
      .filter(h => h.metadata.tags && tags.some(tag => h.metadata.tags!.includes(tag)));
  }

  getResourceStats(): {
    total: number;
    byType: Record<string, number>;
    byPriority: Record<string, number>;
    totalSize: number;
  } {
    const resources = Array.from(this.resources.values());
    
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalSize = 0;

    for (const resource of resources) {
      byType[resource.type] = (byType[resource.type] || 0) + 1;
      byPriority[ResourcePriority[resource.metadata.priority]] = 
        (byPriority[ResourcePriority[resource.metadata.priority]] || 0) + 1;
      
      if (resource.metadata.size) {
        totalSize += resource.metadata.size;
      }
    }

    return {
      total: resources.length,
      byType,
      byPriority,
      totalSize
    };
  }

  getSnapshots(): StateSnapshot[] {
    return Array.from(this.stateSnapshots.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRecoveryPlans(): RecoveryPlan[] {
    return Array.from(this.recoveryPlans.values())
      .sort((a, b) => b.metadata.created.getTime() - a.metadata.created.getTime());
  }
}

// Global resource manager
let globalResourceManager: ResourceManager | null = null;

export function createResourceManager(): ResourceManager {
  return new ResourceManager();
}

export function getGlobalResourceManager(): ResourceManager {
  if (!globalResourceManager) {
    globalResourceManager = new ResourceManager();
  }
  return globalResourceManager;
}

export function setGlobalResourceManager(manager: ResourceManager): void {
  globalResourceManager = manager;
}