/**
 * Startup optimization utilities
 */
import { performance } from 'perf_hooks';

// Simple performance tracking
const marks: { name: string; time: number }[] = [];

export function mark(name: string): void {
  marks.push({ name, time: performance.now() });
}

// Defer heavy operations
export function defer(fn: () => Promise<void>): void {
  setTimeout(fn, 0);
}

// Cache for expensive operations
const cache = new Map<string, unknown>();

export function getFromCache<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCache<T>(key: string, value: T): void {
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, value);
}

// Fast path for version display
export function isVersionRequest(): boolean {
  const args = process.argv.slice(2);
  return args.length === 1 && ['--version', '-v', '-V'].includes(args[0]);
}
