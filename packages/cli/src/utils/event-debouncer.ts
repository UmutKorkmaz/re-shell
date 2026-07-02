/**
 * @file Advanced file system event debouncing and batching utilities.
 * @description Provides classes and factory functions for collecting, deduplicating,
 * and batching high-frequency file system events before emitting them to consumers.
 */

import { EventEmitter } from 'events';


/**
 * @description Represents a single debounced file system event.
 */
export interface DebouncedEvent {
  /** @description Unique identifier for this event. */
  id: string;
  /** @description The type of file system change that occurred. */
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  /** @description The file system path of the affected file or directory. */
  path: string;
  /** @description Unix timestamp (ms) at which the event was recorded. */
  timestamp: number;
  /** @description Optional fs.Stats-like metadata for the affected file. */
  stats?: any;
}

/**
 * @description A collection of debounced events emitted together as a batch.
 */
export interface BatchedEvents {
  /** @description Unique identifier for this batch. */
  id: string;
  /** @description The list of events contained in this batch. */
  events: DebouncedEvent[];
  /** @description Timestamp (ms) of the earliest event in the batch. */
  startTime: number;
  /** @description Timestamp (ms) of the latest event in the batch. */
  endTime: number;
  /** @description Total number of events in the batch (before deduplication). */
  totalEvents: number;
  /** @description Whether deduplication reduced the number of events in this batch. */
  deduplicated: boolean;
}

/**
 * @description Configuration options controlling debounce timing, batching, and deduplication behavior.
 */
export interface DebounceOptions {
  /** @description Delay in milliseconds to wait before processing an event after the last change. */
  delay: number;
  /** @description Maximum delay in milliseconds before an event is forced to process regardless of ongoing changes. */
  maxDelay: number;
  /** @description Maximum number of events allowed in a single batch before it is flushed. */
  maxBatchSize: number;
  /** @description Whether to deduplicate events that share the same key. */
  enableDeduplication: boolean;
  /** @description Whether to group processed events into batches before emitting. */
  enableBatching: boolean;
  /** @description Whether to group batched events by their event type. */
  groupByType: boolean;
  /** @description Whether to attach file stats metadata to each event. */
  includeStats: boolean;
}

/**
 * @description A filter definition used to include or exclude file system events from debouncer processing.
 */
export interface EventFilter {
  /** @description Regular expression patterns that event paths must match to be included. */
  patterns: RegExp[];
  /** @description Event types that are allowed through the filter. */
  types: string[];
  /** @description Optional minimum file size (bytes) required to pass the filter. */
  minFileSize?: number;
  /** @description Optional maximum file size (bytes) required to pass the filter. */
  maxFileSize?: number;
  /** @description Optional list of file extensions allowed through the filter. */
  extensions?: string[];
  /** @description Regular expression patterns whose matching event paths are excluded. */
  excludePatterns?: RegExp[];
}

/**
 * @description Advanced file system event debouncer with batching and deduplication.
 * @description Extends EventEmitter to emit `debounced-event`, `batched-events`, and `event-added` events.
 */
export class EventDebouncer extends EventEmitter {
  private pendingEvents: Map<string, DebouncedEvent> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventBatches: Map<string, DebouncedEvent[]> = new Map();
  private options: DebounceOptions;
  private filters: EventFilter[];
  private eventCounter = 0;

  /**
   * @description Creates a new EventDebouncer instance.
   * @param options - Partial override of the default debounce options. Unspecified fields use sensible defaults.
   */
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

  /**
   * @description Adds a file system event to the debouncer for processing.
   * @description Applies configured filters, deduplicates if enabled, and schedules processing via debounce and max-delay timers.
   * @param type - The type of file system event (e.g. 'add', 'change', 'unlink').
   * @param path - The file system path the event applies to.
   * @param stats - Optional fs.Stats-like metadata for the affected file.
   * @returns void
   */
  addEvent(type: string, path: string, stats?: any): void {
    const event: DebouncedEvent = {
      id: this.generateEventId(),
      type: type as DebouncedEvent['type'],
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

  /**
   * @description Appends an event filter to the active filter chain.
   * @param filter - The EventFilter to add.
   * @returns void
   */
  addFilter(filter: EventFilter): void {
    this.filters.push(filter);
  }

  /**
   * @description Removes an event filter by its index in the filter list. No-op if the index is out of range.
   * @param index - The zero-based index of the filter to remove.
   * @returns void
   */
  removeFilter(index: number): void {
    if (index >= 0 && index < this.filters.length) {
      this.filters.splice(index, 1);
    }
  }

  /**
   * @description Clears all configured event filters.
   * @returns void
   */
  clearFilters(): void {
    this.filters = [];
  }

  /**
   * @description Returns the number of currently registered event filters.
   * @returns The count of active filters.
   */
  getFilterCount(): number {
    return this.filters.length;
  }

  /**
   * @description Returns the number of events currently awaiting debounce processing.
   * @returns The count of pending events.
   */
  getPendingEventsCount(): number {
    return this.pendingEvents.size;
  }

  /**
   * @description Returns the number of active debounce timers.
   * @returns The count of active timers.
   */
  getActiveTimersCount(): number {
    return this.timers.size;
  }

  /**
   * @description Returns the number of event batches currently being accumulated.
   * @returns The count of active batches.
   */
  getBatchCount(): number {
    return this.eventBatches.size;
  }

  /**
   * @description Forces immediate processing of all pending events and in-progress batches, ignoring remaining timers.
   * @returns void
   */
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

  /**
   * @description Cancels all pending timers and clears all pending events and batches without emitting them.
   * @returns void
   */
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

  /**
   * @description Returns runtime statistics about the debouncer's current state.
   * @returns An object containing pending events count, active timers count, active batches count, total filters count, and current options.
   */
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

  /**
   * @description Merges new option values into the existing debounce options.
   * @param newOptions - Partial debounce options to override the current configuration.
   * @returns void
   */
  updateOptions(newOptions: Partial<DebounceOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }
}

/**
 * @description File system event batcher for high-frequency operations.
 * @description Collects events into batches keyed by directory (or a single default key) and emits them on interval or when batch size is reached.
 */
export class EventBatcher extends EventEmitter {
  private batches: Map<string, DebouncedEvent[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private options: {
    batchInterval: number;
    maxBatchSize: number;
    groupByDirectory: boolean;
  };

  /**
   * @description Creates a new EventBatcher instance.
   * @param options - Partial override of batch interval, max batch size, and groupByDirectory settings.
   */
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

  /**
   * @description Adds an event to the batcher, starting a batch timer if necessary and emitting when max batch size is reached.
   * @param event - The DebouncedEvent to add to the batcher.
   * @returns void
   */
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

  /**
   * @description Emits all pending batches immediately, bypassing their remaining timers.
   * @returns void
   */
  flush(): void {
    for (const batchKey of this.batches.keys()) {
      this.emitBatch(batchKey);
    }
  }

  /**
   * @description Cancels all batch timers and clears all accumulated batches without emitting them.
   * @returns void
   */
  clear(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer);
    }
    this.batchTimers.clear();
    this.batches.clear();
  }

  /**
   * @description Returns the number of batches currently being accumulated.
   * @returns The count of active batches.
   */
  getBatchCount(): number {
    return this.batches.size;
  }

  /**
   * @description Returns the total number of events across all pending batches.
   * @returns The total pending event count.
   */
  getPendingEventCount(): number {
    let total = 0;
    for (const batch of this.batches.values()) {
      total += batch.length;
    }
    return total;
  }
}

/**
 * @description Factory function that creates and returns a new EventDebouncer instance.
 * @param options - Optional partial debounce options to override defaults.
 * @returns A configured EventDebouncer instance.
 */
export function createEventDebouncer(options?: Partial<DebounceOptions>): EventDebouncer {
  return new EventDebouncer(options);
}

/**
 * @description Factory function that creates and returns a new EventBatcher instance.
 * @param options - Optional partial configuration for batch interval, max batch size, and directory grouping.
 * @returns A configured EventBatcher instance.
 */
export function createEventBatcher(options?: Partial<{
  batchInterval: number;
  maxBatchSize: number;
  groupByDirectory: boolean;
}>): EventBatcher {
  return new EventBatcher(options);
}

/**
 * @description Creates a pre-configured EventDebouncer tuned for typical webpack development workflows.
 * @description Filters for source file types and excludes common build/vendor directories.
 * @returns An EventDebouncer configured for webpack file watching.
 */
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

/**
 * @description Creates a pre-configured EventDebouncer tuned for test file watching.
 * @description Uses short delays and filters for test/spec files, with batching disabled.
 * @returns An EventDebouncer configured for test runner file watching.
 */
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