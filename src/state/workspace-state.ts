// Workspace State Management and Persistence with Versioning
// State tracking, versioning, and persistence for workspace configurations

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

export interface WorkspaceState {
  version: number;
  config: any;
  metadata: StateMetadata;
  checksum: string;
}

export interface StateMetadata {
  createdAt: number;
  updatedAt: number;
  author?: string;
  description?: string;
  tags: string[];
}

export interface StateSnapshot {
  id: string;
  version: number;
  state: WorkspaceState;
  timestamp: number;
  author?: string;
  description?: string;
}

export interface StateChangeEvent {
  type: 'create' | 'update' | 'delete' | 'restore';
  version: number;
  previousChecksum?: string;
  newChecksum: string;
  timestamp: number;
  author?: string;
}

export interface StateHistoryOptions {
  maxSize?: number;
  maxAge?: number;
  autoCompact?: boolean;
}

export class WorkspaceStateManager extends EventEmitter {
  private currentState: WorkspaceState | null = null;
  private stateHistory: StateSnapshot[] = [];
  private storagePath: string;
  private historyOptions: Required<StateHistoryOptions>;

  constructor(storagePath: string, historyOptions: StateHistoryOptions = {}) {
    super();

    this.storagePath = storagePath;
    this.historyOptions = {
      maxSize: historyOptions.maxSize ?? 100,
      maxAge: historyOptions.maxAge ?? 7 * 24 * 60 * 60 * 1000, // 7 days
      autoCompact: historyOptions.autoCompact ?? true,
    };

    this.ensureStorageDirectory();
  }

  /**
   * Initialize state manager with existing state
   */
  async initialize(config?: any): Promise<void> {
    if (config) {
      await this.createState(config, 'Initial state');
    } else {
      await this.loadLatestState();
    }

    if (this.historyOptions.autoCompact) {
      await this.compactHistory();
    }
  }

  /**
   * Create new state
   */
  async createState(
    config: any,
    description?: string,
    author?: string
  ): Promise<WorkspaceState> {
    const checksum = this.calculateChecksum(config);

    const state: WorkspaceState = {
      version: 1,
      config: this.deepClone(config),
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        author,
        description,
        tags: [],
      },
      checksum,
    };

    this.currentState = state;
    await this.saveState(state);
    await this.createSnapshot(state, description, author);

    const event: StateChangeEvent = {
      type: 'create',
      version: state.version,
      newChecksum: checksum,
      timestamp: Date.now(),
      author,
    };

    this.emit('change', event);
    return state;
  }

  /**
   * Update state
   */
  async updateState(
    config: any,
    description?: string,
    author?: string
  ): Promise<WorkspaceState> {
    if (!this.currentState) {
      throw new Error('No current state exists. Call createState first.');
    }

    const checksum = this.calculateChecksum(config);

    // Check if config actually changed
    if (checksum === this.currentState.checksum) {
      return this.currentState;
    }

    const previousChecksum = this.currentState.checksum;

    const newState: WorkspaceState = {
      version: this.currentState.version + 1,
      config: this.deepClone(config),
      metadata: {
        ...this.currentState.metadata,
        updatedAt: Date.now(),
        author,
        description: description || this.currentState.metadata.description,
      },
      checksum,
    };

    this.currentState = newState;
    await this.saveState(newState);
    await this.createSnapshot(newState, description, author);

    const event: StateChangeEvent = {
      type: 'update',
      version: newState.version,
      previousChecksum,
      newChecksum: checksum,
      timestamp: Date.now(),
      author,
    };

    this.emit('change', event);
    return newState;
  }

  /**
   * Restore state from snapshot
   */
  async restoreState(snapshotId: string, author?: string): Promise<WorkspaceState> {
    const snapshot = this.stateHistory.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const previousChecksum = this.currentState?.checksum;

    this.currentState = {
      ...snapshot.state,
      metadata: {
        ...snapshot.state.metadata,
        updatedAt: Date.now(),
      },
    };

    await this.saveState(this.currentState);

    const event: StateChangeEvent = {
      type: 'restore',
      version: this.currentState.version,
      previousChecksum,
      newChecksum: this.currentState.checksum,
      timestamp: Date.now(),
      author,
    };

    this.emit('change', event);
    return this.currentState;
  }

  /**
   * Get current state
   */
  getState(): WorkspaceState | null {
    return this.currentState;
  }

  /**
   * Get state config
   */
  getConfig(): any | null {
    return this.currentState?.config ?? null;
  }

  /**
   * Get state by version
   */
  getStateByVersion(version: number): WorkspaceState | null {
    const snapshot = this.stateHistory.find(s => s.version === version);
    return snapshot?.state ?? null;
  }

  /**
   * Get all snapshots
   */
  getSnapshots(): StateSnapshot[] {
    return [...this.stateHistory];
  }

  /**
   * Get snapshot history
   */
  getHistory(limit?: number): StateSnapshot[] {
    const history = [...this.stateHistory].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Compare two states
   */
  compareStates(version1: number, version2: number): Record<string, any> | null {
    const state1 = this.getStateByVersion(version1);
    const state2 = this.getStateByVersion(version2);

    if (!state1 || !state2) {
      return null;
    }

    return this.deepDiff(state1.config, state2.config);
  }

  /**
   * Undo last change
   */
  async undo(author?: string): Promise<WorkspaceState> {
    if (!this.currentState) {
      throw new Error('No current state to undo');
    }

    const previousVersion = this.currentState.version - 1;
    if (previousVersion < 1) {
      throw new Error('Cannot undo: already at initial state');
    }

    return this.restoreState(
      this.stateHistory.find(s => s.version === previousVersion)!.id,
      author
    );
  }

  /**
   * Redo last undone change
   */
  async redo(author?: string): Promise<WorkspaceState> {
    const nextVersion = this.currentState ? this.currentState.version + 1 : 1;
    const snapshot = this.stateHistory.find(s => s.version === nextVersion);

    if (!snapshot) {
      throw new Error('Cannot redo: no forward history available');
    }

    return this.restoreState(snapshot.id, author);
  }

  /**
   * Create snapshot
   */
  private async createSnapshot(
    state: WorkspaceState,
    description?: string,
    author?: string
  ): Promise<void> {
    const snapshot: StateSnapshot = {
      id: this.generateSnapshotId(),
      version: state.version,
      state: this.deepClone(state),
      timestamp: Date.now(),
      author,
      description,
    };

    this.stateHistory.push(snapshot);

    // Compact history if needed
    if (this.historyOptions.autoCompact) {
      await this.compactHistory();
    }
  }

  /**
   * Compact history
   */
  private async compactHistory(): Promise<void> {
    const now = Date.now();

    // Remove old snapshots
    this.stateHistory = this.stateHistory.filter(snapshot => {
      const age = now - snapshot.timestamp;
      return age < this.historyOptions.maxAge;
    });

    // Limit history size
    if (this.stateHistory.length > this.historyOptions.maxSize) {
      this.stateHistory = this.stateHistory.slice(-this.historyOptions.maxSize);
    }

    await this.saveHistory();
  }

  /**
   * Save state to disk
   */
  private async saveState(state: WorkspaceState): Promise<void> {
    const filePath = path.join(this.storagePath, 'current-state.json');
    await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2));
  }

  /**
   * Save history to disk
   */
  private async saveHistory(): Promise<void> {
    const filePath = path.join(this.storagePath, 'state-history.json');
    await fs.promises.writeFile(filePath, JSON.stringify(this.stateHistory, null, 2));
  }

  /**
   * Load latest state from disk
   */
  private async loadLatestState(): Promise<void> {
    const stateFilePath = path.join(this.storagePath, 'current-state.json');
    const historyFilePath = path.join(this.storagePath, 'state-history.json');

    // Load current state
    if (fs.existsSync(stateFilePath)) {
      const content = await fs.promises.readFile(stateFilePath, 'utf-8');
      this.currentState = JSON.parse(content);
    }

    // Load history
    if (fs.existsSync(historyFilePath)) {
      const content = await fs.promises.readFile(historyFilePath, 'utf-8');
      this.stateHistory = JSON.parse(content);
    }
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  /**
   * Calculate checksum for config
   */
  private calculateChecksum(config: any): string {
    const json = JSON.stringify(config);
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Deep clone object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Deep diff two objects
   */
  private deepDiff(obj1: any, obj2: any): Record<string, any> {
    const diff: Record<string, any> = {};

    const keys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

    for (const key of keys) {
      const val1 = obj1[key];
      const val2 = obj2[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        if (typeof val1 === 'object' && typeof val2 === 'object' && val1 && val2) {
          diff[key] = this.deepDiff(val1, val2);
        } else {
          diff[key] = { old: val1, new: val2 };
        }
      }
    }

    return diff;
  }

  /**
   * Export state to file
   */
  async export(filePath: string): Promise<void> {
    if (!this.currentState) {
      throw new Error('No current state to export');
    }

    await fs.promises.writeFile(filePath, JSON.stringify(this.currentState, null, 2));
  }

  /**
   * Import state from file
   */
  async import(filePath: string, author?: string): Promise<WorkspaceState> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const state: WorkspaceState = JSON.parse(content);

    return this.createState(state.config, `Imported from ${filePath}`, author);
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    this.currentState = null;
    this.stateHistory = [];

    const stateFile = path.join(this.storagePath, 'current-state.json');
    const historyFile = path.join(this.storagePath, 'state-history.json');

    if (fs.existsSync(stateFile)) {
      await fs.promises.unlink(stateFile);
    }

    if (fs.existsSync(historyFile)) {
      await fs.promises.unlink(historyFile);
    }

    this.emit('cleared');
  }

  /**
   * Get statistics
   */
  getStats(): {
    currentVersion: number;
    totalSnapshots: number;
    oldestSnapshot: number | null;
    newestSnapshot: number | null;
    storagePath: string;
  } {
    const timestamps = this.stateHistory.map(s => s.timestamp);

    return {
      currentVersion: this.currentState?.version ?? 0,
      totalSnapshots: this.stateHistory.length,
      oldestSnapshot: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestSnapshot: timestamps.length > 0 ? Math.max(...timestamps) : null,
      storagePath: this.storagePath,
    };
  }
}
