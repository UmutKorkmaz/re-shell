/**
 * Stable priority queue with aging.
 *
 * - Higher `priority` is served first.
 * - Items of equal effective priority leave in insertion order (stable).
 * - Aging: every item gains `agingPerSecond` priority points for each second it
 *   waits, so a low-priority item eventually outranks a stream of fresh
 *   high-priority arrivals (no starvation).
 *
 * Because all items age at the same rate, the ORDER between two items never
 * changes with time: item A beats B at any instant iff
 * `priority - aging*enqueuedAt` is larger. That time-invariant key lets a plain
 * binary heap implement aging in O(log n) with no re-heapify.
 */
export interface PriorityQueueOptions {
  /** Priority points gained per second of waiting. Default 0 (no aging). */
  agingPerSecond?: number;
  /** Clock in milliseconds. Defaults to Date.now. */
  now?: () => number;
}

interface Node<T> {
  item: T;
  priority: number;
  enqueuedAt: number;
  seq: number;
  /** Time-invariant ordering key (see header). */
  key: number;
}

export class PriorityQueue<T> {
  private heap: Node<T>[] = [];
  private seq = 0;
  private readonly aging: number;
  private readonly now: () => number;
  private readonly epoch: number;

  constructor(options: PriorityQueueOptions = {}) {
    this.aging = options.agingPerSecond ?? 0;
    this.now = options.now ?? Date.now;
    this.epoch = this.now();
  }

  get size(): number {
    return this.heap.length;
  }

  push(item: T, priority = 0): void {
    const enqueuedAt = this.now();
    const node: Node<T> = {
      item,
      priority,
      enqueuedAt,
      seq: this.seq++,
      key: priority - (this.aging * (enqueuedAt - this.epoch)) / 1000,
    };
    this.heap.push(node);
    this.up(this.heap.length - 1);
  }

  /** Effective priority of the head right now (priority + aging bonus), or undefined when empty. */
  peekEffectivePriority(): number | undefined {
    const head = this.heap[0];
    return head ? head.priority + (this.aging * (this.now() - head.enqueuedAt)) / 1000 : undefined;
  }

  peek(): T | undefined {
    return this.heap[0]?.item;
  }

  pop(): T | undefined {
    const top = this.heap[0];
    if (!top) return undefined;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.down(0);
    }
    return top.item;
  }

  /** Remove and return every item in service order. */
  drain(): T[] {
    const out: T[] = [];
    while (this.size > 0) out.push(this.pop()!);
    return out;
  }

  private before(a: Node<T>, b: Node<T>): boolean {
    if (a.key !== b.key) return a.key > b.key;
    return a.seq < b.seq;
  }

  private up(i: number): void {
    const h = this.heap;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(h[i], h[parent])) break;
      [h[i], h[parent]] = [h[parent], h[i]];
      i = parent;
    }
  }

  private down(i: number): void {
    const h = this.heap;
    const n = h.length;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let best = i;
      if (l < n && this.before(h[l], h[best])) best = l;
      if (r < n && this.before(h[r], h[best])) best = r;
      if (best === i) return;
      [h[i], h[best]] = [h[best], h[i]];
      i = best;
    }
  }
}
