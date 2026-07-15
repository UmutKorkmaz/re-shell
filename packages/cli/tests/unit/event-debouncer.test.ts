import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  EventDebouncer,
  EventBatcher,
  createEventDebouncer,
  createEventBatcher,
  createWebpackDebouncer,
  createTestDebouncer,
  type DebouncedEvent,
  type EventFilter,
} from '../../src/utils/event-debouncer';

describe('EventDebouncer — construction and defaults', () => {
  it('creates with default options', () => {
    const d = new EventDebouncer();
    const stats = d.getStatistics();
    expect(stats.options.delay).toBe(300);
    expect(stats.options.maxDelay).toBe(2000);
    expect(stats.options.maxBatchSize).toBe(100);
    expect(stats.options.enableDeduplication).toBe(true);
    expect(stats.options.enableBatching).toBe(true);
    expect(stats.options.groupByType).toBe(false);
    expect(stats.options.includeStats).toBe(true);
  });

  it('overrides options via constructor', () => {
    const d = new EventDebouncer({ delay: 50, maxBatchSize: 10, groupByType: true });
    const stats = d.getStatistics();
    expect(stats.options.delay).toBe(50);
    expect(stats.options.maxBatchSize).toBe(10);
    expect(stats.options.groupByType).toBe(true);
  });

  it('updateOptions merges new values', () => {
    const d = new EventDebouncer();
    d.updateOptions({ delay: 100, enableBatching: false });
    const stats = d.getStatistics();
    expect(stats.options.delay).toBe(100);
    expect(stats.options.enableBatching).toBe(false);
    expect(stats.options.maxDelay).toBe(2000); // unchanged
  });
});

describe('EventDebouncer — event handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits event-added immediately when an event is added', () => {
    const d = new EventDebouncer({ enableBatching: false });
    const handler = vi.fn();
    d.on('event-added', handler);
    d.addEvent('change', '/src/file.ts');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].path).toBe('/src/file.ts');
    expect(handler.mock.calls[0][0].type).toBe('change');
  });

  it('emits debounced-event after delay when batching is disabled', () => {
    const d = new EventDebouncer({ delay: 100, enableBatching: false });
    const handler = vi.fn();
    d.on('debounced-event', handler);
    d.addEvent('change', '/src/a.ts');
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].path).toBe('/src/a.ts');
  });

  it('emits batched-events after delay when batching is enabled', () => {
    const d = new EventDebouncer({ delay: 100, enableBatching: true });
    const handler = vi.fn();
    d.on('batched-events', handler);
    d.addEvent('change', '/src/a.ts');
    d.addEvent('change', '/src/b.ts');
    // Each event's debounce timer fires after 100ms, then batch collects with another delay
    vi.advanceTimersByTime(100);
    // After debounce, events go to batch; batch has its own timer
    vi.advanceTimersByTime(100);
    expect(handler).toHaveBeenCalledTimes(1);
    const batch = handler.mock.calls[0][0];
    expect(batch.events).toHaveLength(2);
    expect(batch.totalEvents).toBeGreaterThanOrEqual(2);
  });

  it('deduplicates events with the same path and type', () => {
    const d = new EventDebouncer({
      delay: 100,
      enableBatching: false,
      enableDeduplication: true,
    });
    const handler = vi.fn();
    d.on('debounced-event', handler);
    d.addEvent('change', '/src/same.ts');
    d.addEvent('change', '/src/same.ts');
    d.addEvent('change', '/src/same.ts');
    vi.advanceTimersByTime(100);
    // Should emit only once for the same path+type
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('processes different types for the same path separately', () => {
    const d = new EventDebouncer({
      delay: 100,
      enableBatching: false,
    });
    const handler = vi.fn();
    d.on('debounced-event', handler);
    d.addEvent('add', '/src/file.ts');
    d.addEvent('change', '/src/file.ts');
    vi.advanceTimersByTime(100);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('forces process after maxDelay', () => {
    const d = new EventDebouncer({
      delay: 500,
      maxDelay: 300,
      enableBatching: false,
    });
    const handler = vi.fn();
    d.on('debounced-event', handler);
    d.addEvent('change', '/src/file.ts');
    // Not yet processed at normal delay
    vi.advanceTimersByTime(300);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('EventDebouncer — filters', () => {
  it('addFilter increases filter count', () => {
    const d = new EventDebouncer();
    expect(d.getFilterCount()).toBe(0);
    d.addFilter({ patterns: [/\.ts$/], types: ['change'] });
    expect(d.getFilterCount()).toBe(1);
  });

  it('removeFilter removes by index', () => {
    const d = new EventDebouncer();
    d.addFilter({ patterns: [/\.ts$/], types: ['change'] });
    d.addFilter({ patterns: [/\.js$/], types: ['add'] });
    d.removeFilter(0);
    expect(d.getFilterCount()).toBe(1);
  });

  it('removeFilter ignores out-of-range index', () => {
    const d = new EventDebouncer();
    d.addFilter({ patterns: [/\.ts$/], types: ['change'] });
    d.removeFilter(5);
    expect(d.getFilterCount()).toBe(1);
  });

  it('clearFilters resets count', () => {
    const d = new EventDebouncer();
    d.addFilter({ patterns: [/\.ts$/], types: ['change'] });
    d.addFilter({ patterns: [/\.js$/], types: ['add'] });
    d.clearFilters();
    expect(d.getFilterCount()).toBe(0);
  });

  it('filters out events that do not match type', () => {
    vi.useFakeTimers();
    const d = new EventDebouncer({
      delay: 100,
      enableBatching: false,
    });
    const addedHandler = vi.fn();
    d.on('event-added', addedHandler);
    d.addFilter({ patterns: [], types: ['change'] });
    d.addEvent('add', '/src/file.ts');
    expect(addedHandler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('filters out events matching excludePatterns', () => {
    vi.useFakeTimers();
    const d = new EventDebouncer({
      delay: 100,
      enableBatching: false,
    });
    const addedHandler = vi.fn();
    d.on('event-added', addedHandler);
    d.addFilter({
      patterns: [],
      types: [],
      excludePatterns: [/node_modules/],
    });
    d.addEvent('change', '/node_modules/pkg/index.ts');
    expect(addedHandler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('filters events by include patterns', () => {
    vi.useFakeTimers();
    const d = new EventDebouncer({
      delay: 100,
      enableBatching: false,
    });
    const addedHandler = vi.fn();
    d.on('event-added', addedHandler);
    d.addFilter({
      patterns: [/\.ts$/],
      types: [],
    });
    d.addEvent('change', '/src/file.ts');
    expect(addedHandler).toHaveBeenCalledTimes(1);
    // Non-matching file
    d.addEvent('change', '/src/file.css');
    expect(addedHandler).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('filters events by extension', () => {
    vi.useFakeTimers();
    const d = new EventDebouncer({ delay: 100, enableBatching: false });
    const addedHandler = vi.fn();
    d.on('event-added', addedHandler);
    d.addFilter({
      patterns: [],
      types: [],
      extensions: ['ts', 'tsx'],
    });
    d.addEvent('change', '/src/file.ts');
    d.addEvent('change', '/src/file.tsx');
    d.addEvent('change', '/src/file.js');
    expect(addedHandler).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('filters by file size when stats are present', () => {
    vi.useFakeTimers();
    const d = new EventDebouncer({
      delay: 100,
      enableBatching: false,
      includeStats: true,
    });
    const addedHandler = vi.fn();
    d.on('event-added', addedHandler);
    d.addFilter({
      patterns: [],
      types: [],
      minFileSize: 100,
      maxFileSize: 1000,
    });
    d.addEvent('change', '/small.ts', { size: 50 });
    d.addEvent('change', '/ok.ts', { size: 500 });
    d.addEvent('change', '/big.ts', { size: 2000 });
    expect(addedHandler).toHaveBeenCalledTimes(1);
    expect(addedHandler.mock.calls[0][0].path).toBe('/ok.ts');
    vi.useRealTimers();
  });
});

describe('EventDebouncer — statistics', () => {
  it('returns correct initial statistics', () => {
    const d = new EventDebouncer();
    const stats = d.getStatistics();
    expect(stats.pendingEvents).toBe(0);
    expect(stats.activeTimers).toBe(0);
    expect(stats.activeBatches).toBe(0);
    expect(stats.totalFilters).toBe(0);
  });

  it('tracks pending events count', () => {
    vi.useFakeTimers();
    const d = new EventDebouncer({ delay: 500 });
    d.addEvent('change', '/a.ts');
    d.addEvent('change', '/b.ts');
    expect(d.getPendingEventsCount()).toBe(2);
    vi.useRealTimers();
  });
});

describe('EventDebouncer — flush and clear', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('flush processes pending events immediately', () => {
    const d = new EventDebouncer({
      delay: 1000,
      enableBatching: false,
    });
    const handler = vi.fn();
    d.on('debounced-event', handler);
    d.addEvent('change', '/a.ts');
    d.addEvent('change', '/b.ts');
    expect(handler).not.toHaveBeenCalled();
    d.flush();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('clear removes all pending events without emitting', () => {
    const d = new EventDebouncer({
      delay: 1000,
      enableBatching: false,
    });
    const handler = vi.fn();
    d.on('debounced-event', handler);
    d.addEvent('change', '/a.ts');
    d.addEvent('change', '/b.ts');
    d.clear();
    expect(d.getPendingEventsCount()).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('EventBatcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function makeEvent(path: string, type: string = 'change'): DebouncedEvent {
    return {
      id: `event_${path}`,
      type: type as DebouncedEvent['type'],
      path,
      timestamp: Date.now(),
    };
  }

  it('creates with default options', () => {
    const b = new EventBatcher();
    expect(b.getBatchCount()).toBe(0);
    expect(b.getPendingEventCount()).toBe(0);
  });

  it('adds events and groups by directory', () => {
    const b = new EventBatcher({ groupByDirectory: true });
    b.addEvent(makeEvent('/src/a.ts'));
    b.addEvent(makeEvent('/src/b.ts'));
    b.addEvent(makeEvent('/test/c.ts'));
    expect(b.getBatchCount()).toBe(2); // /src and /test
    expect(b.getPendingEventCount()).toBe(3);
  });

  it('uses default key when groupByDirectory is false', () => {
    const b = new EventBatcher({ groupByDirectory: false });
    b.addEvent(makeEvent('/src/a.ts'));
    b.addEvent(makeEvent('/test/b.ts'));
    expect(b.getBatchCount()).toBe(1);
  });

  it('emits batch when maxBatchSize is reached', () => {
    const b = new EventBatcher({ maxBatchSize: 2, groupByDirectory: false });
    const handler = vi.fn();
    b.on('batch', handler);
    b.addEvent(makeEvent('/src/a.ts'));
    b.addEvent(makeEvent('/src/b.ts'));
    expect(handler).toHaveBeenCalledTimes(1);
    const batch = handler.mock.calls[0][0];
    expect(batch.events).toHaveLength(2);
    expect(batch.totalEvents).toBe(2);
    expect(batch.deduplicated).toBe(false);
  });

  it('emits batch on timer interval', () => {
    const b = new EventBatcher({
      batchInterval: 200,
      groupByDirectory: false,
    });
    const handler = vi.fn();
    b.on('batch', handler);
    b.addEvent(makeEvent('/src/a.ts'));
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('flush emits all pending batches', () => {
    const b = new EventBatcher({
      batchInterval: 10000,
      groupByDirectory: true,
    });
    const handler = vi.fn();
    b.on('batch', handler);
    b.addEvent(makeEvent('/src/a.ts'));
    b.addEvent(makeEvent('/test/b.ts'));
    expect(handler).not.toHaveBeenCalled();
    b.flush();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('clear removes all batches without emitting', () => {
    const b = new EventBatcher({
      batchInterval: 10000,
      groupByDirectory: false,
    });
    const handler = vi.fn();
    b.on('batch', handler);
    b.addEvent(makeEvent('/src/a.ts'));
    b.clear();
    expect(b.getBatchCount()).toBe(0);
    vi.advanceTimersByTime(10000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('batch includes correct startTime and endTime', () => {
    const b = new EventBatcher({ maxBatchSize: 2, groupByDirectory: false });
    const handler = vi.fn();
    b.on('batch', handler);
    const early = Date.now();
    b.addEvent({ ...makeEvent('/a.ts'), timestamp: 1000 });
    b.addEvent({ ...makeEvent('/b.ts'), timestamp: 2000 });
    const batch = handler.mock.calls[0][0];
    expect(batch.startTime).toBe(1000);
    expect(batch.endTime).toBe(2000);
  });
});

describe('factory functions', () => {
  it('createEventDebouncer returns EventDebouncer instance', () => {
    const d = createEventDebouncer({ delay: 50 });
    expect(d).toBeInstanceOf(EventDebouncer);
    expect(d.getStatistics().options.delay).toBe(50);
  });

  it('createEventDebouncer works with no args', () => {
    const d = createEventDebouncer();
    expect(d).toBeInstanceOf(EventDebouncer);
    expect(d.getStatistics().options.delay).toBe(300);
  });

  it('createEventBatcher returns EventBatcher instance', () => {
    const b = createEventBatcher({ batchInterval: 100 });
    expect(b).toBeInstanceOf(EventBatcher);
  });

  it('createEventBatcher works with no args', () => {
    const b = createEventBatcher();
    expect(b).toBeInstanceOf(EventBatcher);
  });

  it('createWebpackDebouncer returns configured debouncer', () => {
    const d = createWebpackDebouncer();
    const stats = d.getStatistics();
    expect(stats.options.delay).toBe(300);
    expect(stats.options.maxDelay).toBe(1000);
    expect(stats.options.maxBatchSize).toBe(50);
    expect(stats.options.enableDeduplication).toBe(true);
    expect(stats.options.enableBatching).toBe(true);
    expect(stats.totalFilters).toBe(1);
  });

  it('createWebpackDebouncer filters out non-source files', () => {
    vi.useFakeTimers();
    const d = createWebpackDebouncer();
    const addedHandler = vi.fn();
    d.on('event-added', addedHandler);
    d.addEvent('change', '/src/file.ts');
    d.addEvent('change', '/src/file.css');
    d.addEvent('change', '/node_modules/lib/index.js');
    d.addEvent('change', '/dist/bundle.js');
    expect(addedHandler).toHaveBeenCalledTimes(2); // .ts and .css pass
    vi.useRealTimers();
  });

  it('createTestDebouncer returns configured debouncer with no batching', () => {
    const d = createTestDebouncer();
    const stats = d.getStatistics();
    expect(stats.options.delay).toBe(100);
    expect(stats.options.maxDelay).toBe(500);
    expect(stats.options.maxBatchSize).toBe(20);
    expect(stats.options.enableBatching).toBe(false);
    expect(stats.totalFilters).toBe(1);
  });

  it('createTestDebouncer filters for test files only', () => {
    vi.useFakeTimers();
    const d = createTestDebouncer();
    const addedHandler = vi.fn();
    d.on('event-added', addedHandler);
    d.addEvent('change', '/src/file.test.ts');
    d.addEvent('change', '/src/file.spec.tsx');
    d.addEvent('change', '/src/file.ts');
    d.addEvent('change', '/src/file.test.css');
    expect(addedHandler).toHaveBeenCalledTimes(2); // only .test.ts and .spec.tsx
    vi.useRealTimers();
  });
});
