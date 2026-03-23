/**
 * Startup optimization utilities
 */
import { performance } from 'perf_hooks';

// Simple performance tracking
const startTime = performance.now();
const marks: { name: string; time: number }[] = [];

export function mark(name: string): void {
  marks.push({ name, time: performance.now() });
}

export function getStartupTime(): number {
  return performance.now() - startTime;
}

export function getMarks(): { name: string; time: number; delta: number }[] {
  let lastTime = startTime;
  return marks.map(m => {
    const delta = m.time - lastTime;
    lastTime = m.time;
    return { ...m, delta };
  });
}

// Defer heavy operations
export function defer(fn: () => Promise<void>): void {
  setTimeout(fn, 0);
}

// Cache for expensive operations
const cache = new Map<string, any>();

export function getFromCache<T>(key: string): T | undefined {
  return cache.get(key);
}

export function setCache<T>(key: string, value: T): void {
  if (cache.size > 100) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  cache.set(key, value);
}

// Fast path for version display
export function isVersionRequest(): boolean {
  const args = process.argv.slice(2);
  return args.length === 1 && ['--version', '-v', '-V'].includes(args[0]);
}

export function isHelpRequest(): boolean {
  return process.argv.includes('--help') || process.argv.includes('-h') || process.argv.length <= 2;
}
