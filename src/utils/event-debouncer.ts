import { EventEmitter } from 'events';
import { ValidationError } from './error-handler';

export interface DebouncedEvent {
  id: string;
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: number;
  stats?: any;
}

export interface BatchedEvents {
  id: string;
  events: DebouncedEvent[];
  startTime: number;
  endTime: number;
  totalEvents: number;
  deduplicated: boolean;
}

export interface DebounceOptions {
  delay: number;
  maxDelay: number;
  maxBatchSize: number;
  enableDeduplication: boolean;
  enableBatching: boolean;
  groupByType: boolean;
  includeStats: boolean;
}

export interface EventFilter {
  patterns: RegExp[];
  types: string[];
  minFileSize?: number;
  maxFileSize?: number;
  extensions?: string[];
  excludePatterns?: RegExp[];
}

// Advanced file system event debouncer with batching and deduplication
export class EventDebouncer extends EventEmitter {
  private pendingEvents: Map<string, DebouncedEvent> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventBatches: Map<string, DebouncedEvent[]> = new Map();
  private options: DebounceOptions;
  private filters: EventFilter[];
  private eventCounter = 0;

  constructor(options: Partial<DebounceOptions> = {}) {
    super();
    this.options = {
      delay: 300,           // 300ms debounce delay
      maxDelay: 2000,       // 2s maximum delay
      maxBatchSize: 100,    // Maximum events per batch
      enableDeduplication: true,
      enableBatching: true,
      groupByType: false,
      includeStats: true,
      ...options
    };
    this.filters = [];
  }

  // Add file system event to debouncer
  addEvent(type: string, path: string, stats?: any): void {
    const event: DebouncedEvent = {
      id: this.generateEventId(),
      type: type as any,
      path,
      timestamp: Date.now(),
      stats: this.options.includeStats ? stats : undefined
    };

    // Apply filters
    if (!this.passesFilters(event)) {
      return;
    }

    const eventKey = this.getEventKey(event);

    // Update or create pending event
    const existingEvent = this.pendingEvents.get(eventKey);
    if (existingEvent && this.options.enableDeduplication) {
      // Update existing event with latest info
      existingEvent.timestamp = event.timestamp;
      existingEvent.stats = event.stats;
    } else {
      this.pendingEvents.set(eventKey, event);
    }

    // Clear existing timer
    const existingTimer = this.timers.get(eventKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.processEvent(eventKey);
    }, this.options.delay);

    this.timers.set(eventKey, timer);

    // Set maximum delay timer if not exists
    if (!this.batchTimers.has(eventKey)) {
      const maxTimer = setTimeout(() => {
        this.forceProcessEvent(eventKey);
      }, this.options.maxDelay);

      this.batchTimers.set(eventKey, maxTimer);
    }

    // Emit immediate event for debugging
    this.emit('event-added', event);
  }

  // Process individual event
  private processEvent(eventKey: string): void {
    const event = this.pendingEvents.get(eventKey);
    if (!event) return;

    this.pendingEvents.delete(eventKey);
    this.timers.delete(eventKey);

    // Clear max delay timer
    const maxTimer = this.batchTimers.get(eventKey);
    if (maxTimer) {
      clearTimeout(maxTimer);
      this.batchTimers.delete(eventKey);
    }

    if (this.options.enableBatching) {
      this.addToBatch(event);
    } else {
      this.emit('debounced-event', event);
    }
  }

  // Force process event when max delay reached
  private forceProcessEvent(eventKey: string): void {
    const event = this.pendingEvents.get(eventKey);
    if (!event) return;

    this.pendingEvents.delete(eventKey);
    
    // Clear regular timer
    const timer = this.timers.get(eventKey);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(eventKey);
    }

    this.batchTimers.delete(eventKey);

    if (this.options.enableBatching) {
      this.addToBatch(event);
    } else {
      this.emit('debounced-event', event);
    }
  }

  // Add event to batch
  private addToBatch(event: DebouncedEvent): void {
    const batchKey = this.getBatchKey(event);
    
    if (!this.eventBatches.has(batchKey)) {
      this.eventBatches.set(batchKey, []);
    }

    const batch = this.eventBatches.get(batchKey)!;
    batch.push(event);

    // Process batch if it reaches max size
    if (batch.length >= this.options.maxBatchSize) {
      this.processBatch(batchKey);
    } else {
      // Set timer to process batch after delay
      setTimeout(() => {
        if (this.eventBatches.has(batchKey)) {
          this.processBatch(batchKey);
        }
      }, this.options.delay);
    }
  }

  // Process event batch
  private processBatch(batchKey: string): void {
    const events = this.eventBatches.get(batchKey);
    if (!events || events.length === 0) return;

    this.eventBatches.delete(batchKey);

    // Deduplicate events if enabled
    const finalEvents = this.options.enableDeduplication 
      ? this.deduplicateEvents(events)
      : events;

    const batch: BatchedEvents = {
      id: this.generateBatchId(),
      events: finalEvents,
      startTime: Math.min(...events.map(e => e.timestamp)),
      endTime: Math.max(...events.map(e => e.timestamp)),
      totalEvents: events.length,
      deduplicated: finalEvents.length !== events.length
    };

    this.emit('batched-events', batch);
  }

  // Deduplicate events in batch
  private deduplicateEvents(events: DebouncedEvent[]): DebouncedEvent[] {
    const eventMap = new Map<string, DebouncedEvent>();

    // Sort events by timestamp
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp);

    for (const event of sortedEvents) {
      const key = this.getDeduplicationKey(event);
      
      // Keep the latest event for each path/type combination
      if (!eventMap.has(key) || eventMap.get(key)!.timestamp < event.timestamp) {
        eventMap.set(key, event);
      }
    }

    return Array.from(eventMap.values());
  }

  // Get event key for debouncing
  private getEventKey(event: DebouncedEvent): string {
    return `${event.path}:${event.type}`;
  }

  // Get batch key for grouping
  private getBatchKey(event: DebouncedEvent): string {
    if (this.options.groupByType) {
      return event.type;
    }
    return 'default';
  }

  // Get deduplication key
  private getDeduplicationKey(event: DebouncedEvent): string {
    return event.path; // Deduplicate by path only
  }

  // Generate unique event ID
  private generateEventId(): string {
    return `event_${Date.now()}_${++this.eventCounter}`;
  }

  // Generate unique batch ID
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if event passes filters
  private passesFilters(event: DebouncedEvent): boolean {
    for (const filter of this.filters) {
      if (!this.eventMatchesFilter(event, filter)) {
        return false;
      }
    }
    return true;
  }

  // Check if event matches specific filter
  private eventMatchesFilter(event: DebouncedEvent, filter: EventFilter): boolean {
    // Check type filter
    if (filter.types.length > 0 && !filter.types.includes(event.type)) {
      return false;
    }

    // Check exclude patterns
    if (filter.excludePatterns) {
      for (const pattern of filter.excludePatterns) {
        if (pattern.test(event.path)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (filter.patterns.length > 0) {
      let matches = false;
      for (const pattern of filter.patterns) {
        if (pattern.test(event.path)) {
          matches = true;
          break;
        }
      }
      if (!matches) {
        return false;
      }
    }

    // Check extensions
    if (filter.extensions && filter.extensions.length > 0) {
      const extension = this.getFileExtension(event.path);
      if (!filter.extensions.includes(extension)) {
        return false;
      }
    }

    // Check file size (if stats available)
    if (event.stats && (filter.minFileSize || filter.maxFileSize)) {
      const fileSize = event.stats.size || 0;
      
      if (filter.minFileSize && fileSize < filter.minFileSize) {
        return false;
      }
      
      if (filter.maxFileSize && fileSize > filter.maxFileSize) {
        return false;
      }
    }

    return true;
  }

  // Get file extension
  private getFileExtension(filePath: string): string {
    const parts = filePath.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  // Add event filter
  addFilter(filter: EventFilter): void {
    this.filters.push(filter);
  }

  // Remove event filter
  removeFilter(index: number): void {
    if (index >= 0 && index < this.filters.length) {
      this.filters.splice(index, 1);
    }
  }

  // Clear all filters
  clearFilters(): void {
    this.filters = [];
  }

  // Get current filter count
  getFilterCount(): number {
    return this.filters.length;
  }

  // Get pending events count
  getPendingEventsCount(): number {
    return this.pendingEvents.size;
  }

  // Get active timers count
  getActiveTimersCount(): number {
    return this.timers.size;
  }

  // Get batch count
  getBatchCount(): number {
    return this.eventBatches.size;
  }

  // Force flush all pending events
  flush(): void {
    // Process all pending events immediately
    for (const [eventKey] of this.pendingEvents) {
      this.forceProcessEvent(eventKey);
    }

    // Process all batches immediately
    for (const [batchKey] of this.eventBatches) {
      this.processBatch(batchKey);
    }
  }

  // Clear all pending events and timers
  clear(): void {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();

    // Clear all pending data
    this.pendingEvents.clear();
    this.eventBatches.clear();
  }

  // Get debouncer statistics
  getStatistics(): {
    pendingEvents: number;
    activeTimers: number;
    activeBatches: number;
    totalFilters: number;
    options: DebounceOptions;
  } {
    return {
      pendingEvents: this.pendingEvents.size,
      activeTimers: this.timers.size,
      activeBatches: this.eventBatches.size,
      totalFilters: this.filters.length,
      options: { ...this.options }
    };
  }

  // Update debounce options
  updateOptions(newOptions: Partial<DebounceOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

// File system event batcher for high-frequency operations
export class EventBatcher extends EventEmitter {
  private batches: Map<string, DebouncedEvent[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: {
    batchInterval: number;
    maxBatchSize: number;
    groupByDirectory: boolean;
  };

  constructor(options: Partial<{
    batchInterval: number;
    maxBatchSize: number;
    groupByDirectory: boolean;
  }> = {}) {
    super();
    this.options = {
      batchInterval: 500,     // 500ms batch interval
      maxBatchSize: 50,       // Maximum 50 events per batch
      groupByDirectory: true, // Group events by directory
      ...options
    };
  }

  // Add event to batcher
  addEvent(event: DebouncedEvent): void {
    const batchKey = this.getBatchKey(event);
    
    if (!this.batches.has(batchKey)) {
      this.batches.set(batchKey, []);
      this.startBatchTimer(batchKey);
    }

    const batch = this.batches.get(batchKey)!;
    batch.push(event);

    // Emit batch if it reaches max size
    if (batch.length >= this.options.maxBatchSize) {
      this.emitBatch(batchKey);
    }
  }

  // Get batch key for grouping
  private getBatchKey(event: DebouncedEvent): string {
    if (this.options.groupByDirectory) {
      const pathParts = event.path.split('/');
      return pathParts.slice(0, -1).join('/'); // Directory path
    }
    return 'default';
  }

  // Start batch timer
  private startBatchTimer(batchKey: string): void {
    const timer = setTimeout(() => {
      this.emitBatch(batchKey);
    }, this.options.batchInterval);

    this.batchTimers.set(batchKey, timer);
  }

  // Emit batch of events
  private emitBatch(batchKey: string): void {
    const events = this.batches.get(batchKey);
    if (!events || events.length === 0) return;

    // Clear timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Remove batch
    this.batches.delete(batchKey);

    // Create batch object
    const batch: BatchedEvents = {
      id: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      events,
      startTime: Math.min(...events.map(e => e.timestamp)),
      endTime: Math.max(...events.map(e => e.timestamp)),
      totalEvents: events.length,
      deduplicated: false
    };

    this.emit('batch', batch);
  }

  // Flush all pending batches
  flush(): void {
    for (const batchKey of this.batches.keys()) {
      this.emitBatch(batchKey);
    }
  }

  // Clear all batches
  clear(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
    this.batches.clear();
  }

  // Get current batch count
  getBatchCount(): number {
    return this.batches.size;
  }

  // Get total pending events
  getPendingEventCount(): number {
    let total = 0;
    for (const batch of this.batches.values()) {
      total += batch.length;
    }
    return total;
  }
}

// Utility functions
export function createEventDebouncer(options?: Partial<DebounceOptions>): EventDebouncer {
  return new EventDebouncer(options);
}

export function createEventBatcher(options?: Partial<{
  batchInterval: number;
  maxBatchSize: number;
  groupByDirectory: boolean;
}>): EventBatcher {
  return new EventBatcher(options);
}

// Pre-configured debouncer for common use cases
export function createWebpackDebouncer(): EventDebouncer {
  const debouncer = new EventDebouncer({
    delay: 300,
    maxDelay: 1000,
    maxBatchSize: 50,
    enableDeduplication: true,
    enableBatching: true
  });

  // Add filter for webpack-relevant files
  debouncer.addFilter({
    patterns: [/\.(js|jsx|ts|tsx|css|scss|less|vue|svelte)$/],
    types: ['add', 'change', 'unlink'],
    excludePatterns: [/node_modules/, /\.git/, /dist/, /build/],
    extensions: ['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'vue', 'svelte']
  });

  return debouncer;
}

export function createTestDebouncer(): EventDebouncer {
  const debouncer = new EventDebouncer({
    delay: 100,
    maxDelay: 500,
    maxBatchSize: 20,
    enableDeduplication: true,
    enableBatching: false
  });

  // Add filter for test files
  debouncer.addFilter({
    patterns: [/\.(test|spec)\.(js|jsx|ts|tsx)$/],
    types: ['add', 'change', 'unlink'],
    excludePatterns: [/node_modules/, /\.git/],
    extensions: ['js', 'jsx', 'ts', 'tsx']
  });

  return debouncer;
}