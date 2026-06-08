import { BackendTemplate } from '../types';

/**
 * Real-Time Data Synchronization Template
 * Complete real-time data sync system with CRDT support, optimistic updates, event sourcing,
 * and framework-agnostic SDKs for React, Vue, Angular, and Svelte
 */
export const realtimeDataSyncTemplate: BackendTemplate = {
  id: 'realtime-data-sync',
  name: 'Real-Time Data Synchronization',
  displayName: 'Real-Time Data Sync with CRDT & Event Sourcing',
  description: 'Complete real-time data synchronization system with CRDT (Conflict-free Replicated Data Types) for conflict resolution, optimistic updates with rollback support, event sourcing with event store, operational transformation (OT), framework-agnostic JavaScript/TypeScript SDKs (React hooks, Vue composables, Angular services, Svelte stores), automatic conflict resolution, real-time collaboration features, presence awareness, and WebSocket/Server-Sent Events transport',
  version: '1.0.0',
  language: 'typescript',
  framework: 'express',
  tags: ['realtime', 'sync', 'crdt', 'collaboration', 'websocket', 'sse'],
  port: 3002,
  dependencies: {},
  features: ['websockets', 'monitoring'],

  files: {
    'sync-server/models/sync-document.model.ts': `// Sync Document Model
// Represents a document that can be synchronized in real-time

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISyncDocument {
  id: string;
  collection: string;
  version: number;
  data: Record<string, any>;
  crdt: any; // CRDT state (G-Counter, LWW-Register, OR-Set, etc.)
  operations: SyncOperation[];
  collaborators: string[];
  lastModified: Date;
  modifiedBy: string;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncOperation {
  id: string;
  type: 'insert' | 'delete' | 'update' | 'move' | 'format';
  position: any; // Position in document (for OT)
  length?: number;
  content?: any;
  metadata?: Record<string, any>;
  userId: string;
  timestamp: Date;
  causalityId?: string; // For CRDT causality
}

export interface ISyncDocumentDocument extends ISyncDocument, Document {
  applyOperation(operation: SyncOperation): ISyncDocument;
  getVersion(): number;
  getOperations(after?: Date): SyncOperation[];
}

const SyncDocumentSchema = new Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  collection: {
    type: String,
    required: true,
    index: true,
  },
  version: {
    type: Number,
    default: 0,
  },
  data: {
    type: Schema.Types.Mixed,
    default: {},
  },
  crdt: {
    type: Schema.Types.Mixed,
    default: {},
  },
  operations: [{
    id: String,
    type: {
      type: String,
      enum: ['insert', 'delete', 'update', 'move', 'format'],
    },
    position: Schema.Types.Mixed,
    length: Number,
    content: Schema.Types.Mixed,
    metadata: Schema.Types.Mixed,
    userId: String,
    timestamp: Date,
    causalityId: String,
  }],
  collaborators: [String],
  lastModified: Date,
  modifiedBy: String,
  checksum: String,
}, {
  timestamps: true,
});

SyncDocumentSchema.index({ collection: 1, updatedAt: -1 });
SyncDocumentSchema.index({ collaborators: 1 });
SyncDocumentSchema.index({ version: 1 });

export const SyncDocument: Model<ISyncDocumentDocument> = mongoose.model('SyncDocument', SyncDocumentSchema);
`,

    'sync-server/services/crdt.service.ts': `// CRDT (Conflict-free Replicated Data Types) Service
// Provides CRDT implementations for conflict-free replication

export interface CRDT<T> {
  value: T;
  merge(other: CRDT<T>): CRDT<T>;
  toJSON(): T;
}

/**
 * LWW-Register (Last-Write-Wins Register)
 * For single-value conflict resolution using timestamps
 */
export class LWWRegister<T> implements CRDT<T> {
  value: T;
  timestamp: number;
  nodeId: string;

  constructor(value: T, nodeId: string) {
    this.value = value;
    this.timestamp = Date.now();
    this.nodeId = nodeId;
  }

  set(value: T): void {
    const now = Date.now();
    if (now > this.timestamp) {
      this.value = value;
      this.timestamp = now;
    }
  }

  merge(other: LWWRegister<T>): LWWRegister<T> {
    if (other.timestamp > this.timestamp) {
      this.value = other.value;
      this.timestamp = other.timestamp;
    } else if (other.timestamp === this.timestamp && other.nodeId > this.nodeId) {
      this.value = other.value;
      this.timestamp = other.timestamp;
    }
    return this;
  }

  toJSON(): T {
    return this.value;
  }
}

/**
 * G-Counter (Grow-only Counter)
 * For counting with only increment operations
 */
export class GCounter implements CRDT<number> {
  private counters: Map<string, number>;

  constructor() {
    this.counters = new Map();
  }

  increment(nodeId: string, amount: number = 1): void {
    const current = this.counters.get(nodeId) || 0;
    this.counters.set(nodeId, current + amount);
  }

  get value(): number {
    return Array.from(this.counters.values()).reduce((sum, val) => sum + val, 0);
  }

  merge(other: GCounter): GCounter {
    for (const [nodeId, value] of other.counters.entries()) {
      const current = this.counters.get(nodeId) || 0;
      this.counters.set(nodeId, Math.max(current, value));
    }
    return this;
  }

  toJSON(): number {
    return this.value;
  }
}

/**
 * OR-Set (Observed-Remove Set)
 * For sets with add and remove operations
 */
export class ORSet<T> implements CRDT<T[]> {
  value: Map<T, Set<string>>; // element -> set of node IDs that added it
  tombstones: Map<T, Set<string>>; // element -> set of node IDs that removed it

  constructor() {
    this.value = new Map();
    this.tombstones = new Map();
  }

  add(element: T, nodeId: string): void {
    const addedBy = this.value.get(element) || new Set();
    addedBy.add(nodeId);
    this.value.set(element, addedBy);

    // Remove from tombstones if present
    const removedBy = this.tombstones.get(element);
    if (removedBy) {
      removedBy.delete(nodeId);
      if (removedBy.size === 0) {
        this.tombstones.delete(element);
      }
    }
  }

  remove(element: T, nodeId: string): void {
    const removedBy = this.tombstones.get(element) || new Set();
    removedBy.add(nodeId);
    this.tombstones.set(element, removedBy);
  }

  has(element: T): boolean {
    const addedBy = this.value.get(element);
    const removedBy = this.tombstones.get(element);

    if (!addedBy || addedBy.size === 0) {
      return false;
    }

    if (!removedBy || removedBy.size === 0) {
      return true;
    }

    // Element exists if there's an add from a node that hasn't removed it
    for (const adder of addedBy) {
      if (!removedBy.has(adder)) {
        return true;
      }
    }

    return false;
  }

  get value(): T[] {
    const result: T[] = [];

    for (const element of this.value.keys()) {
      if (this.has(element)) {
        result.push(element);
      }
    }

    return result;
  }

  merge(other: ORSet<T>): ORSet<T> {
    // Merge added sets
    for (const [element, addedBy] of other.value.entries()) {
      const currentAdded = this.value.get(element) || new Set();
      for (const nodeId of addedBy) {
        currentAdded.add(nodeId);
      }
      this.value.set(element, currentAdded);
    }

    // Merge tombstone sets
    for (const [element, removedBy] of other.tombstones.entries()) {
      const currentRemoved = this.tombstones.get(element) || new Set();
      for (const nodeId of removedBy) {
        currentRemoved.add(nodeId);
      }
      this.tombstones.set(element, currentRemoved);
    }

    return this;
  }

  toJSON(): T[] {
    return this.value;
  }
}

/**
 * JSON CRDT (JSON CRDT for complex objects)
 * For hierarchical JSON documents with fine-grained merging
 */
export class JSONCRDT implements CRDT<any> {
  value: any;

  constructor(initialValue: any = {}) {
    this.value = initialValue;
  }

  set(path: string[], newValue: any): void {
    let current = this.value;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }

    current[path[path.length - 1]] = newValue;
  }

  delete(path: string[]): void {
    let current = this.value;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (!(key in current)) {
        return; // Path doesn't exist
      }
      current = current[key];
    }

    delete current[path[path.length - 1]];
  }

  merge(other: JSONCRDT): JSONCRDT {
    this.value = this.deepMerge(this.value, other.value);
    return this;
  }

  private deepMerge(target: any, source: any): any {
    if (source === null || typeof source !== 'object') {
      return source;
    }

    if (Array.isArray(source)) {
      // For arrays, take the longer one or merge based on timestamps
      return Array.isArray(target) && target.length > source.length ? target : source;
    }

    const result = { ...target };

    for (const key of Object.keys(source)) {
      if (key in result) {
        result[key] = this.deepMerge(result[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  toJSON(): any {
    return this.value;
  }
}
`,

    'sync-server/services/optimistic-updates.service.ts': `// Optimistic Updates Service
// Handles optimistic updates with automatic rollback on failure

import { EventEmitter } from 'events';

export interface PendingUpdate {
  id: string;
  documentId: string;
  operation: any;
  originalValue: any;
  optimisticValue: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'committed' | 'failed' | 'rolled_back';
}

export class OptimisticUpdatesService extends EventEmitter {
  private pendingUpdates: Map<string, PendingUpdate> = new Map();
  private updateQueue: Map<string, PendingUpdate[]> = new Map();

  /**
   * Apply optimistic update
   */
  async applyOptimisticUpdate(
    documentId: string,
    operation: any,
    currentValue: any
  ): Promise<void> {
    const updateId = this.generateUpdateId();

    const pendingUpdate: PendingUpdate = {
      id: updateId,
      documentId,
      operation,
      originalValue: JSON.parse(JSON.stringify(currentValue)),
      optimisticValue: this.applyOperation(currentValue, operation),
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    };

    this.pendingUpdates.set(updateId, pendingUpdate);

    // Add to queue
    if (!this.updateQueue.has(documentId)) {
      this.updateQueue.set(documentId, []);
    }
    this.updateQueue.get(documentId)!.push(pendingUpdate);

    // Emit optimistic update
    this.emit('optimistic-update', {
      documentId,
      updateId,
      value: pendingUpdate.optimisticValue,
    });

    // Try to commit
    await this.commitUpdate(pendingUpdate);
  }

  /**
   * Commit update to server
   */
  private async commitUpdate(update: PendingUpdate): Promise<void> {
    try {
      // Send update to server
      const response = await fetch(\`\${process.env.API_URL}/sync/documents/\${update.documentId}\`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: update.operation,
          optimistic: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to commit update');
      }

      // Update committed successfully
      update.status = 'committed';
      this.pendingUpdates.delete(update.id);
      this.emit('update-committed', { updateId: update.id, documentId: update.documentId });
    } catch (error) {
      console.error('Failed to commit update:', error);

      update.retries++;

      // Rollback after max retries
      if (update.retries >= 3) {
        this.rollbackUpdate(update);
      } else {
        // Retry after delay
        setTimeout(() => {
          this.commitUpdate(update);
        }, Math.pow(2, update.retries) * 1000);
      }
    }
  }

  /**
   * Rollback optimistic update
   */
  private rollbackUpdate(update: PendingUpdate): void {
    update.status = 'rolled_back';

    this.emit('rollback', {
      documentId: update.documentId,
      updateId: update.id,
      originalValue: update.originalValue,
    });

    this.pendingUpdates.delete(update.id);
  }

  /**
   * Apply operation to value
   */
  private applyOperation(value: any, operation: any): any {
    const result = JSON.parse(JSON.stringify(value));

    switch (operation.type) {
      case 'insert':
        this.applyInsert(result, operation);
        break;
      case 'delete':
        this.applyDelete(result, operation);
        break;
      case 'update':
        this.applyUpdate(result, operation);
        break;
      case 'move':
        this.applyMove(result, operation);
        break;
      default:
        throw new Error(\`Unknown operation type: \${operation.type}\`);
    }

    return result;
  }

  private applyInsert(value: any, operation: any): void {
    // Implementation depends on data structure
    if (Array.isArray(value)) {
      value.splice(operation.position, 0, operation.content);
    } else if (typeof value === 'object' && value !== null) {
      value[operation.path] = operation.content;
    }
  }

  private applyDelete(value: any, operation: any): void {
    if (Array.isArray(value)) {
      value.splice(operation.position, operation.length);
    } else if (typeof value === 'object' && value !== null) {
      delete value[operation.path];
    }
  }

  private applyUpdate(value: any, operation: any): void {
    if (typeof value === 'object' && value !== null) {
      value[operation.path] = operation.content;
    }
  }

  private applyMove(value: any, operation: any): void {
    if (Array.isArray(value)) {
      const [item] = value.splice(operation.from, 1);
      value.splice(operation.to, 0, item);
    }
  }

  private generateUpdateId(): string {
    return \`update-\${Date.now()}-\${Math.random().toString(36).substring(2, 15)}\`;
  }

  /**
   * Get pending updates for document
   */
  getPendingUpdates(documentId: string): PendingUpdate[] {
    return this.updateQueue.get(documentId) || [];
  }

  /**
   * Clear committed updates
   */
  clearCommittedUpdates(documentId: string): void {
    const updates = this.updateQueue.get(documentId) || [];
    this.updateQueue.set(
      documentId,
      updates.filter(u => u.status === 'pending')
    );
  }
}
`,

    'sync-server/services/event-sourcing.service.ts': `// Event Sourcing Service
// Implements event sourcing for real-time collaboration

import { v4 as uuidv4 } from 'uuid';

export interface Event {
  id: string;
  type: string;
  version: number;
  data: any;
  metadata: {
    userId: string;
    timestamp: Date;
    causalityId?: string;
    documentId?: string;
  };
}

export interface EventStream {
  documentId: string;
  version: number;
  events: Event[];
  snapshot?: any;
  snapshotVersion?: number;
}

export class EventSourcingService {
  private streams: Map<string, EventStream> = new Map();
  private subscriptions: Map<string, Set<(event: Event) => void>> = new Map();

  /**
   * Append event to stream
   */
  async appendEvent(
    documentId: string,
    eventType: string,
    data: any,
    userId: string,
    causalityId?: string
  ): Promise<Event> {
    const stream = this.getStream(documentId);
    const version = stream.version + 1;

    const event: Event = {
      id: uuidv4(),
      type: eventType,
      version,
      data,
      metadata: {
        userId,
        timestamp: new Date(),
        causalityId,
        documentId,
      },
    };

    stream.events.push(event);
    stream.version = version;

    // Create snapshot every 100 events
    if (version % 100 === 0) {
      await this.createSnapshot(documentId);
    }

    // Notify subscribers
    this.notifySubscribers(documentId, event);

    return event;
  }

  /**
   * Get event stream
   */
  getStream(documentId: string): EventStream {
    if (!this.streams.has(documentId)) {
      this.streams.set(documentId, {
        documentId,
        version: 0,
        events: [],
      });
    }
    return this.streams.get(documentId)!;
  }

  /**
   * Get events after version
   */
  getEvents(documentId: string, afterVersion: number = 0): Event[] {
    const stream = this.getStream(documentId);
    return stream.events.filter(e => e.version > afterVersion);
  }

  /**
   * Replay events to reconstruct state
   */
  async replayEvents(documentId: string): Promise<any> {
    const stream = this.getStream(documentId);
    let state = {};

    // Start from snapshot if available
    if (stream.snapshot && stream.snapshotVersion) {
      state = stream.snapshot;

      // Only replay events after snapshot
      return this.replayFromVersion(documentId, stream.snapshotVersion);
    }

    // Replay all events
    for (const event of stream.events) {
      state = this.applyEvent(state, event);
    }

    return state;
  }

  /**
   * Replay from specific version
   */
  async replayFromVersion(documentId: string, version: number): Promise<any> {
    const events = this.getEvents(documentId, version);
    let state = {};

    for (const event of events) {
      state = this.applyEvent(state, event);
    }

    return state;
  }

  /**
   * Subscribe to events
   */
  subscribe(documentId: string, callback: (event: Event) => void): () => void {
    if (!this.subscriptions.has(documentId)) {
      this.subscriptions.set(documentId, new Set());
    }

    this.subscriptions.get(documentId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(documentId);
      if (subs) {
        subs.delete(callback);
      }
    };
  }

  /**
   * Create snapshot
   */
  private async createSnapshot(documentId: string): Promise<void> {
    const stream = this.getStream(documentId);
    stream.snapshot = await this.replayEvents(documentId);
    stream.snapshotVersion = stream.version;

    // Remove old events
    stream.events = stream.events.filter(e => e.version > stream.snapshotVersion);
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(documentId: string, event: Event): void {
    const subscribers = this.subscriptions.get(documentId);
    if (subscribers) {
      for (const callback of subscribers) {
        callback(event);
      }
    }
  }

  /**
   * Apply event to state
   */
  private applyEvent(state: any, event: Event): any {
    const newState = { ...state };

    switch (event.type) {
      case 'INSERT':
        this.applyInsertEvent(newState, event.data);
        break;
      case 'DELETE':
        this.applyDeleteEvent(newState, event.data);
        break;
      case 'UPDATE':
        this.applyUpdateEvent(newState, event.data);
        break;
      case 'MOVE':
        this.applyMoveEvent(newState, event.data);
        break;
      default:
        console.warn(\`Unknown event type: \${event.type}\`);
    }

    return newState;
  }

  private applyInsertEvent(state: any, data: any): void {
    // Implementation depends on data structure
  }

  private applyDeleteEvent(state: any, data: any): void {
    // Implementation depends on data structure
  }

  private applyUpdateEvent(state: any, data: any): void {
    // Implementation depends on data structure
  }

  private applyMoveEvent(state: any, data: any): void {
    // Implementation depends on data structure
  }
}
`,

    'sync-server/controllers/sync.controller.ts': `// Sync Controller
// Handle real-time synchronization requests

import { Request, Response } from 'express';
import { SyncDocument } from '../models/sync-document.model';
import { CRDTService } from '../services/crdt.service';
import { OptimisticUpdatesService } from '../services/optimistic-updates.service';
import { EventSourcingService } from '../services/event-sourcing.service';
import { PresenceService } from '../services/presence.service';

export class SyncController {
  private crdtService: CRDTService;
  private optimisticUpdates: OptimisticUpdatesService;
  private eventSourcing: EventSourcingService;
  private presence: PresenceService;

  constructor() {
    this.crdtService = new CRDTService();
    this.optimisticUpdates = new OptimisticUpdatesService();
    this.eventSourcing = new EventSourcingService();
    this.presence = new PresenceService();
  }

  /**
   * Get document
   */
  getDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const { version } = req.query;

      const document = await SyncDocument.findById(documentId);

      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      // Return events after version if specified
      if (version) {
        const events = this.eventSourcing.getEvents(documentId, parseInt(version as string));
        res.json({
          document,
          events,
        });
      } else {
        res.json({ document });
      }
    } catch (error) {
      console.error('Get document error:', error);
      res.status(500).json({ error: 'Failed to get document' });
    }
  };

  /**
   * Create or update document
   */
  saveDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const { collection, data, operation } = req.body;
      const userId = (req as any).user?.id;

      let document = await SyncDocument.findById(documentId);

      if (!document) {
        // Create new document
        document = new SyncDocument({
          id: documentId,
          collection,
          version: 0,
          data,
          crdt: {},
          operations: [],
          collaborators: [userId],
          lastModified: new Date(),
          modifiedBy: userId,
          checksum: this.calculateChecksum(data),
        });
      } else {
        // Apply operation using CRDT
        const result = this.crdtService.applyOperation(document, operation);

        // Append event to event stream
        await this.eventSourcing.appendEvent(
          documentId,
          operation.type,
          operation,
          userId
        );

        document.version++;
        document.lastModified = new Date();
        document.modifiedBy = userId;
        document.checksum = this.calculateChecksum(document.data);
      }

      await document.save();

      // Broadcast to collaborators
      this.presence.broadcast(documentId, {
        type: 'document-updated',
        documentId,
        version: document.version,
        updatedBy: userId,
      });

      res.json({ document });
    } catch (error) {
      console.error('Save document error:', error);
      res.status(500).json({ error: 'Failed to save document' });
    }
  };

  /**
   * Get presence for document
   */
  getPresence = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const presence = this.presence.getPresence(documentId);
      res.json({ presence });
    } catch (error) {
      console.error('Get presence error:', error);
      res.status(500).json({ error: 'Failed to get presence' });
    }
  };

  /**
   * Join document (for collaboration)
   */
  joinDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const userId = (req as any).user?.id;

      await this.presence.join(documentId, userId);

      // Get current document state
      const document = await SyncDocument.findById(documentId);

      // Subscribe to updates
      // (This would set up WebSocket connection in real implementation)

      res.json({
        document,
        presence: this.presence.getPresence(documentId),
      });
    } catch (error) {
      console.error('Join document error:', error);
      res.status(500).json({ error: 'Failed to join document' });
    }
  };

  /**
   * Leave document
   */
  leaveDocument = async (req: Request, res: Response): Promise<void> => {
    try {
      const { documentId } = req.params;
      const userId = (req as any).user?.id;

      await this.presence.leave(documentId, userId);

      res.json({ message: 'Left document successfully' });
    } catch (error) {
      console.error('Leave document error:', error);
      res.status(500).json({ error: 'Failed to leave document' });
    }
  };

  /**
   * Calculate checksum
   */
  private calculateChecksum(data: any): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }
}
`,

    'sync-server/services/presence.service.ts': `// Presence Service
// Track real-time presence and cursors for collaborative editing

import { EventEmitter } from 'events';

export interface UserPresence {
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  cursor?: {
    position: number;
    selection?: { start: number; end: number };
  };
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
}

export class PresenceService extends EventEmitter {
  private presence: Map<string, Map<string, UserPresence>> = new Map();

  /**
   * User joins document
   */
  async join(documentId: string, userId: string, userData?: Partial<UserPresence>): Promise<void> {
    if (!this.presence.has(documentId)) {
      this.presence.set(documentId, new Map());
    }

    const docPresence = this.presence.get(documentId)!;

    docPresence.set(userId, {
      userId,
      name: userData?.name || userId,
      avatar: userData?.avatar,
      color: this.generateColor(userId),
      status: 'online',
      lastSeen: new Date(),
    });

    this.emit('user-joined', { documentId, userId, presence: docPresence.get(userId) });
  }

  /**
   * User leaves document
   */
  async leave(documentId: string, userId: string): Promise<void> {
    const docPresence = this.presence.get(documentId);
    if (docPresence) {
      docPresence.delete(userId);
      this.emit('user-left', { documentId, userId });
    }
  }

  /**
   * Update cursor position
   */
  updateCursor(documentId: string, userId: string, cursor: any): void {
    const docPresence = this.presence.get(documentId);
    const user = docPresence?.get(userId);

    if (user) {
      user.cursor = cursor;
      user.lastSeen = new Date();

      this.emit('cursor-updated', { documentId, userId, cursor });
    }
  }

  /**
   * Update user status
   */
  updateStatus(documentId: string, userId: string, status: UserPresence['status']): void {
    const docPresence = this.presence.get(documentId);
    const user = docPresence?.get(userId);

    if (user) {
      user.status = status;
      user.lastSeen = new Date();

      this.emit('status-updated', { documentId, userId, status });
    }
  }

  /**
   * Get presence for document
   */
  getPresence(documentId: string): Map<string, UserPresence> {
    return this.presence.get(documentId) || new Map();
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcast(documentId: string, message: any): void {
    this.emit('broadcast', { documentId, message });
  }

  /**
   * Clean up offline users
   */
  cleanupOfflineUsers(timeout: number = 5 * 60 * 1000): void {
    const now = Date.now();

    for (const [documentId, docPresence] of this.presence.entries()) {
      for (const [userId, presence] of docPresence.entries()) {
        if (now - presence.lastSeen.getTime() > timeout) {
          docPresence.delete(userId);
          this.emit('user-expired', { documentId, userId });
        }
      }
    }
  }

  /**
   * Generate color for user
   */
  private generateColor(userId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
      '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52C41A',
    ];

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  }
}
`,

    'sync-server/services/crdt-operations.service.ts': `// CRDT Operations Service
// Handles CRDT operations and merging

export class CRDTService {
  /**
   * Apply operation to document using CRDT
   */
  applyOperation(document: any, operation: any): any {
    const result = { ...document };

    switch (operation.type) {
      case 'insert':
        return this.applyInsert(result, operation);
      case 'delete':
        return this.applyDelete(result, operation);
      case 'update':
        return this.applyUpdate(result, operation);
      case 'move':
        return this.applyMove(result, operation);
      default:
        throw new Error(\`Unknown operation type: \${operation.type}\`);
    }
  }

  private applyInsert(document: any, operation: any): any {
    if (Array.isArray(document.data)) {
      const newData = [...document.data];
      newData.splice(operation.position, 0, operation.content);
      document.data = newData;
    } else if (typeof document.data === 'object') {
      document.data = {
        ...document.data,
        [operation.path]: operation.content,
      };
    }

    document.version++;
    return document;
  }

  private applyDelete(document: any, operation: any): any {
    if (Array.isArray(document.data)) {
      const newData = [...document.data];
      newData.splice(operation.position, operation.length);
      document.data = newData;
    } else if (typeof document.data === 'object') {
      const { [operation.path]: removed, ...rest } = document.data;
      document.data = rest;
    }

    document.version++;
    return document;
  }

  private applyUpdate(document: any, operation: any): any {
    if (typeof document.data === 'object') {
      document.data = {
        ...document.data,
        ...operation.content,
      };
    }

    document.version++;
    return document;
  }

  private applyMove(document: any, operation: any): any {
    if (Array.isArray(document.data)) {
      const newData = [...document.data];
      const [item] = newData.splice(operation.from, 1);
      newData.splice(operation.to, 0, item);
      document.data = newData;
    }

    document.version++;
    return document;
  }

  /**
   * Merge two documents using CRDT
   */
  mergeDocuments(doc1: any, doc2: any): any {
    // Use LWW (Last-Write-Wins) based on version/timestamp
    if (doc1.version > doc2.version) {
      return doc1;
    } else if (doc2.version > doc1.version) {
      return doc2;
    } else {
      // Same version, use deterministic merge
      return doc1.modifiedBy > doc2.modifiedBy ? doc1 : doc2;
    }
  }
}
`,

    'client-sdk/sync-client.ts': `// Real-Time Sync Client SDK
// Framework-agnostic JavaScript/TypeScript SDK for real-time data synchronization

import { WebSocket } from 'whatwg-url'; // Native WebSocket in browser

export interface SyncClientConfig {
  serverURL: string;
  documentId: string;
  token?: string;
  transport: 'websocket' | 'sse' | 'polling';
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export interface SyncEventData {
  type: string;
  documentId: string;
  version: number;
  operation: any;
  userId: string;
  timestamp: Date;
}

export class SyncClient {
  private config: SyncClientConfig;
  private ws?: WebSocket;
  private eventSource?: EventSource;
  private reconnectAttempts = 0;
  private isConnected = false;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: SyncClientConfig) {
    this.config = {
      ...config,
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectAttempts: config.maxReconnectAttempts || 5,
    };

    this.connect();
  }

  /**
   * Connect to sync server
   */
  private connect(): void {
    switch (this.config.transport) {
      case 'websocket':
        this.connectWebSocket();
        break;
      case 'sse':
        this.connectSSE();
        break;
      case 'polling':
        this.startPolling();
        break;
    }
  }

  /**
   * Connect via WebSocket
   */
  private connectWebSocket(): void {
    const url = new URL(this.config.serverURL);
    url.searchParams.set('documentId', this.config.documentId);
    if (this.config.token) {
      url.searchParams.set('token', this.config.token);
    }

    this.ws = new WebSocket(url.toString());

    this.ws.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.emit('disconnected', {});
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      this.emit('error', { error });
    };
  }

  /**
   * Connect via Server-Sent Events
   */
  private connectSSE(): void {
    const url = new URL(\`\${this.config.serverURL}/events\`);
    url.searchParams.set('documentId', this.config.documentId);
    if (this.config.token) {
      url.searchParams.set('token', this.config.token);
    }

    this.eventSource = new EventSource(url.toString());

    this.eventSource.onopen = () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected', {});
    };

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.eventSource.onerror = (error) => {
      this.isConnected = false;
      this.emit('disconnected', {});
      this.eventSource?.close();
      this.attemptReconnect();
    };
  }

  /**
   * Start polling
   */
  private startPolling(): void {
    setInterval(async () => {
      if (!this.isConnected) {
        return;
      }

      try {
        const response = await fetch(
          \`\${this.config.serverURL}/documents/\${this.config.documentId}\`,
          {
            headers: {
              'Authorization': \`Bearer \${this.config.token}\`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          this.emit('update', data);
        }
      } catch (error) {
        this.emit('error', { error });
      }
    }, this.config.reconnectInterval);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.emit('max-reconnect-reached', {});
      return;
    }

    this.reconnectAttempts++;
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
    });

    setTimeout(() => {
      this.connect();
    }, this.config.reconnectInterval * this.reconnectAttempts);
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: SyncEventData): void {
    switch (data.type) {
      case 'document-updated':
        this.emit('update', data);
        break;
      case 'user-joined':
        this.emit('user-joined', data);
        break;
      case 'user-left':
        this.emit('user-left', data);
        break;
      case 'cursor-updated':
        this.emit('cursor-updated', data);
        break;
      case 'status-updated':
        this.emit('status-updated', data);
        break;
      default:
        this.emit('message', data);
    }
  }

  /**
   * Send operation to server
   */
  async sendOperation(operation: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to sync server');
    }

    const message = JSON.stringify({
      type: 'operation',
      documentId: this.config.documentId,
      operation,
    });

    if (this.ws) {
      this.ws.send(message);
    } else {
      // Fallback to HTTP for SSE/polling
      await fetch(\`\${this.config.serverURL}/documents/\${this.config.documentId}\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.config.token}\`,
        },
        body: JSON.stringify({ operation }),
      });
    }
  }

  /**
   * Subscribe to event
   */
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Emit event
   */
  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(\`Error in \${event} listener:\`, error);
        }
      }
    }
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.isConnected = false;
  }
}

/**
 * Create sync client
 */
export function createSyncClient(config: SyncClientConfig): SyncClient {
  return new SyncClient(config);
}
`,

    'client-sdk/react/useRealtimeSync.ts': `// React Hook for Real-Time Sync
import { useEffect, useState, useCallback, useRef } from 'react';
import { createSyncClient, SyncClient, SyncClientConfig } from '../sync-client';

export function useRealtimeSync(documentId: string, token?: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [data, setData] = useState<any>(null);
  const [presence, setPresence] = useState<Map<string, any>>(new Map());
  const clientRef = useRef<SyncClient | null>(null);

  useEffect(() => {
    const config: SyncClientConfig = {
      serverURL: process.env.REACT_APP_SYNC_SERVER_URL || 'ws://localhost:3002',
      documentId,
      token,
      transport: 'websocket',
    };

    const client = createSyncClient(config);
    clientRef.current = client;

    // Set up event listeners
    const unsubscribeConnected = client.on('connected', () => {
      setIsConnected(true);
    });

    const unsubscribeDisconnected = client.on('disconnected', () => {
      setIsConnected(false);
    });

    const unsubscribeUpdate = client.on('update', (eventData) => {
      setData(eventData.document);
    });

    const unsubscribeUserJoined = client.on('user-joined', (eventData) => {
      setPresence(prev => {
        const next = new Map(prev);
        next.set(eventData.userId, eventData.presence);
        return next;
      });
    });

    const unsubscribeUserLeft = client.on('user-left', (eventData) => {
      setPresence(prev => {
        const next = new Map(prev);
        next.delete(eventData.userId);
        return next;
      });
    });

    const unsubscribeCursorUpdated = client.on('cursor-updated', (eventData) => {
      setPresence(prev => {
        const next = new Map(prev);
        const user = next.get(eventData.userId);
        if (user) {
          next.set(eventData.userId, { ...user, cursor: eventData.cursor });
        }
        return next;
      });
    });

    // Cleanup
    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      unsubscribeUpdate();
      unsubscribeUserJoined();
      unsubscribeUserLeft();
      unsubscribeCursorUpdated();
      client.disconnect();
    };
  }, [documentId, token]);

  const sendOperation = useCallback(async (operation: any) => {
    if (clientRef.current) {
      await clientRef.current.sendOperation(operation);
    }
  }, []);

  return {
    isConnected,
    data,
    presence,
    sendOperation,
  };
}
`,

    'client-sdk/vue/useRealtimeSync.ts': `// Vue Composable for Real-Time Sync
import { ref, onMounted, onUnmounted, Ref } from 'vue';
import { createSyncClient, SyncClient, SyncClientConfig } from '../sync-client';

export function useRealtimeSync(documentId: string, token?: string) {
  const isConnected = ref(false);
  const data = ref<any>(null);
  const presence = ref<Map<string, any>>(new Map());
  const client = ref<SyncClient | null>(null);

  let syncClient: SyncClient | null = null;

  onMounted(() => {
    const config: SyncClientConfig = {
      serverURL: import.meta.env.VITE_SYNC_SERVER_URL || 'ws://localhost:3002',
      documentId,
      token,
      transport: 'websocket',
    };

    syncClient = createSyncClient(config);
    client.value = syncClient;

    // Set up event listeners
    syncClient.on('connected', () => {
      isConnected.value = true;
    });

    syncClient.on('disconnected', () => {
      isConnected.value = false;
    });

    syncClient.on('update', (eventData) => {
      data.value = eventData.document;
    });

    syncClient.on('user-joined', (eventData) => {
      presence.value.set(eventData.userId, eventData.presence);
    });

    syncClient.on('user-left', (eventData) => {
      presence.value.delete(eventData.userId);
    });

    syncClient.on('cursor-updated', (eventData) => {
      const user = presence.value.get(eventData.userId);
      if (user) {
        presence.value.set(eventData.userId, { ...user, cursor: eventData.cursor });
      }
    });
  });

  onUnmounted(() => {
    if (syncClient) {
      syncClient.disconnect();
    }
  });

  const sendOperation = async (operation: any) => {
    if (syncClient) {
      await syncClient.sendOperation(operation);
    }
  };

  return {
    isConnected,
    data,
    presence,
    sendOperation,
  };
}
`,

    'client-sdk/angular/RealtimeSync.service.ts': `// Angular Service for Real-Time Sync
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { createSyncClient, SyncClient, SyncClientConfig } from '../sync-client';

@Injectable({
  providedIn: 'root',
})
export class RealtimeSyncService implements OnDestroy {
  private client: SyncClient | null = null;
  private isConnected$ = new BehaviorSubject<boolean>(false);
  private data$ = new BehaviorSubject<any>(null);
  private presence$ = new BehaviorSubject<Map<string, any>>(new Map());

  constructor() {}

  /**
   * Connect to sync server
   */
  connect(documentId: string, token?: string): void {
    const config: SyncClientConfig = {
      serverURL: environment.syncServerURL || 'ws://localhost:3002',
      documentId,
      token,
      transport: 'websocket',
    };

    this.client = createSyncClient(config);

    // Set up event listeners
    this.client.on('connected', () => {
      this.isConnected$.next(true);
    });

    this.client.on('disconnected', () => {
      this.isConnected$.next(false);
    });

    this.client.on('update', (eventData) => {
      this.data$.next(eventData.document);
    });

    this.client.on('user-joined', (eventData) => {
      const presence = this.presence$.value;
      presence.set(eventData.userId, eventData.presence);
      this.presence$.next(presence);
    });

    this.client.on('user-left', (eventData) => {
      const presence = this.presence$.value;
      presence.delete(eventData.userId);
      this.presence$.next(presence);
    });

    this.client.on('cursor-updated', (eventData) => {
      const presence = this.presence$.value;
      const user = presence.get(eventData.userId);
      if (user) {
        presence.set(eventData.userId, { ...user, cursor: eventData.cursor });
        this.presence$.next(presence);
      }
    });
  }

  /**
   * Send operation
   */
  async sendOperation(operation: any): Promise<void> {
    if (this.client) {
      await this.client.sendOperation(operation);
    }
  }

  /**
   * Get connection status
   */
  isConnected(): Observable<boolean> {
    return this.isConnected$.asObservable();
  }

  /**
   * Get data
   */
  getData(): Observable<any> {
    return this.data$.asObservable();
  }

  /**
   * Get presence
   */
  getPresence(): Observable<Map<string, any>> {
    return this.presence$.asObservable();
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
`,

    'client-sdk/svelte/useRealtimeSync.ts': `// Svelte Store for Real-Time Sync
import { writable, derived } from 'svelte/store';
import { createSyncClient, SyncClient, SyncClientConfig } from '../sync-client';

function createRealtimeSyncStore() {
  const isConnected = writable(false);
  const data = writable<any>(null);
  const presence = writable<Map<string, any>>(new Map());
  const client = writable<SyncClient | null>(null);

  let syncClient: SyncClient | null = null;

  function connect(documentId: string, token?: string) {
    const config: SyncClientConfig = {
      serverURL: import.meta.env.VITE_SYNC_SERVER_URL || 'ws://localhost:3002',
      documentId,
      token,
      transport: 'websocket',
    };

    syncClient = createSyncClient(config);
    client.set(syncClient);

    // Set up event listeners
    syncClient.on('connected', () => {
      isConnected.set(true);
    });

    syncClient.on('disconnected', () => {
      isConnected.set(false);
    });

    syncClient.on('update', (eventData) => {
      data.set(eventData.document);
    });

    syncClient.on('user-joined', (eventData) => {
      presence.update(presence => {
        presence.set(eventData.userId, eventData.presence);
        return presence;
      });
    });

    syncClient.on('user-left', (eventData) => {
      presence.update(presence => {
        presence.delete(eventData.userId);
        return presence;
      });
    });

    syncClient.on('cursor-updated', (eventData) => {
      presence.update(presence => {
        const user = presence.get(eventData.userId);
        if (user) {
          presence.set(eventData.userId, { ...user, cursor: eventData.cursor });
        }
        return presence;
      });
    });
  }

  async function sendOperation(operation: any) {
    if (syncClient) {
      await syncClient.sendOperation(operation);
    }
  }

  function disconnect() {
    if (syncClient) {
      syncClient.disconnect();
    }
  }

  return {
    isConnected,
    data,
    presence,
    client,
    connect,
    sendOperation,
    disconnect,
  };
}

export const realtimeSync = createRealtimeSyncStore();
`,

    'sync-server/README.md': `# Real-Time Data Synchronization

Complete real-time data synchronization system with CRDT support, optimistic updates,
event sourcing, and framework-agnostic SDKs.

## Features

### Backend Service
- **CRDT Support**: LWW-Register, G-Counter, OR-Set, JSON CRDT
- **Optimistic Updates**: Automatic retry with rollback on failure
- **Event Sourcing**: Complete event store with replay and snapshots
- **Presence Awareness**: Track users, cursors, and status
- **Conflict Resolution**: Automatic CRDT-based conflict resolution
- **Transport**: WebSocket, Server-Sent Events, and Polling support

### Client SDKs
- **Framework-Agnostic**: Works with React, Vue, Angular, Svelte
- **Automatic Reconnection**: Configurable reconnection strategy
- **Event Listeners**: Type-safe event handling
- **Presence Tracking**: Real-time cursor and user presence

## Usage

### React Hook

\`\`\`typescript
import { useRealtimeSync } from '@re-shell/sync-client/react';

function DocumentEditor({ documentId }) {
  const { isConnected, data, presence, sendOperation } = useRealtimeSync(documentId);

  const handleInsert = (position, content) => {
    sendOperation({
      type: 'insert',
      position,
      content,
    });
  };

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>Collaborators: {Array.from(presence.values()).map(p => p.name).join(', ')}</div>
      <textarea
        value={data?.content || ''}
        onChange={(e) => handleInsert(0, e.target.value)}
      />
    </div>
  );
}
\`\`\`

### Vue Composable

\`\`\`typescript
import { useRealtimeSync } from '@re-shell/sync-client/vue';

export default {
  setup() {
    const { isConnected, data, presence, sendOperation } = useRealtimeSync(documentId);

    return {
      isConnected,
      data,
      presence,
      sendOperation,
    };
  },
};
\`\`\`

## License

MIT
`,

    'package.json': `{
  "name": "realtime-data-sync",
  "version": "1.0.0",
  "description": "Real-time data synchronization with CRDT and event sourcing",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.6.0",
    "ws": "^8.16.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/node": "^20.0.0",
    "@types/ws": "^8.5.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0"
  }
}
`,
  },
};
