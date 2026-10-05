// In-memory transport: same contract as the broker adapters, for fast unit tests
// and local development. Consumer groups share a queue; every group sees every message.

import type { MessageHandler, SubscribeOptions, Subscription, Transport, TransportMessage } from './transport';

interface Member {
  handler: MessageHandler;
  stopped: boolean;
}

interface Group {
  queue: TransportMessage[];
  members: Member[];
  next: number;
  draining: boolean;
}

/** In-memory transport. */
export class MemoryTransport implements Transport {
  readonly name = 'memory';
  private readonly groups = new Map<string, Map<string, Group>>();
  private readonly history = new Map<string, TransportMessage[]>();
  private pending = 0;
  private closed = false;
  private idleWaiters: (() => void)[] = [];
  /** When set, publish() rejects with this error (to simulate a broker outage in tests). */
  failPublishWith?: Error;

  async publish(channel: string, body: string, headers: Record<string, string>, key?: string): Promise<void> {
    if (this.closed) throw new Error('transport is closed');
    if (this.failPublishWith) throw this.failPublishWith;
    const base = { channel, key, body, headers: { ...headers } };
    const hist = this.history.get(channel) ?? [];
    hist.push({ ...base, deliveryCount: 1 });
    this.history.set(channel, hist);
    for (const group of this.groups.get(channel)?.values() ?? []) {
      group.queue.push({ ...base, deliveryCount: 1 });
      this.pending++;
      this.schedule(group);
    }
  }

  async subscribe(channel: string, group: string, handler: MessageHandler, options: SubscribeOptions = {}): Promise<Subscription> {
    let byGroup = this.groups.get(channel);
    if (!byGroup) {
      byGroup = new Map();
      this.groups.set(channel, byGroup);
    }
    let g = byGroup.get(group);
    if (!g) {
      g = { queue: [], members: [], next: 0, draining: false };
      byGroup.set(group, g);
      if (options.startFrom === 'beginning') {
        for (const m of this.history.get(channel) ?? []) {
          g.queue.push({ ...m });
          this.pending++;
        }
      }
    }
    const member: Member = { handler, stopped: false };
    g.members.push(member);
    this.schedule(g);
    return {
      stop: async () => {
        member.stopped = true;
        g!.members = g!.members.filter(m => m !== member);
      },
    };
  }

  private schedule(group: Group): void {
    if (group.draining || group.members.length === 0 || group.queue.length === 0) return;
    group.draining = true;
    setImmediate(() => void this.drain(group));
  }

  private async drain(group: Group): Promise<void> {
    try {
      while (group.queue.length > 0 && group.members.length > 0) {
        const message = group.queue.shift() as TransportMessage;
        const member = group.members[group.next++ % group.members.length];
        try {
          await member.handler(message);
          this.pending--;
        } catch {
          // handler rejected: redeliver (front of the queue, next attempt)
          group.queue.unshift({ ...message, deliveryCount: message.deliveryCount + 1 });
          await new Promise(r => setTimeout(r, 5));
        }
      }
    } finally {
      group.draining = false;
      this.notifyIdle();
      if (group.queue.length > 0) this.schedule(group);
    }
  }

  private notifyIdle(): void {
    if (this.pending <= 0) {
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      for (const w of waiters) w();
    }
  }

  /** Resolves when every queued message has been acknowledged. */
  idle(timeoutMs = 5000): Promise<void> {
    if (this.pending <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`memory transport not idle after ${timeoutMs}ms (${this.pending} pending)`)), timeoutMs);
      this.idleWaiters.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /** Messages published to `channel` so far (for assertions). */
  published(channel: string): TransportMessage[] {
    return [...(this.history.get(channel) ?? [])];
  }

  async close(): Promise<void> {
    this.closed = true;
    this.groups.clear();
  }
}
