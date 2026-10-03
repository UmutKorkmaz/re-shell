// Redis Streams transport (ioredis). At-least-once delivery with consumer groups:
//   publish    XADD <channel> MAXLEN ~ N * body <json> [key <k>] h:<header> <v> ...
//   subscribe  XGROUP CREATE ... MKSTREAM, then XREADGROUP; XACK after the handler resolves.
//   recovery   un-acked messages of this consumer are re-read on start, and entries idle
//              for `claimIdleMs` (crashed consumers) are taken over with XAUTOCLAIM.
// Raw commands are used on purpose so the adapter works with ioredis 5 and 6.

import Redis from 'ioredis';

import type { MessageHandler, SubscribeOptions, Subscription, Transport, TransportMessage } from './transport';

/** Options for {@link RedisStreamsTransport}. */
export interface RedisStreamsOptions {
  /** Redis URL (e.g. `redis://localhost:6379`). Ignored when `client` is given. */
  url?: string;
  /** An existing ioredis client; blocking reads use `client.duplicate()`. */
  client?: Redis;
  /** Approximate stream length cap (default 100_000). */
  maxLen?: number;
  /** XREADGROUP BLOCK time in ms (default 1000); also bounds how fast stop() completes. */
  blockMs?: number;
  /** Messages fetched per read (default 10). */
  batchSize?: number;
  /** A pending message idle this long is claimed from its (presumed dead) consumer (default 30_000). */
  claimIdleMs?: number;
  /** Consumer name within a group (default: hostname-pid-random). */
  consumerName?: string;
  /** Receives non-fatal adapter errors (default: ignore). */
  onError?: (error: unknown) => void;
}

type StreamEntry = [id: string, fields: string[] | null];

/**
 * Entries of the single stream in an XREADGROUP reply. Depending on the ioredis
 * major version / RESP protocol the reply is `[[stream, entries]]` (RESP2),
 * `[stream, entries]` (RESP3 map flattened) or a Map / plain object.
 */
function entriesOf(res: unknown): StreamEntry[] {
  if (res === null || res === undefined) return [];
  if (res instanceof Map) return ((res.values().next().value as StreamEntry[] | undefined) ?? []);
  if (Array.isArray(res)) {
    if (res.length === 0) return [];
    if (typeof res[0] === 'string') return ((res[1] as StreamEntry[] | undefined) ?? []);
    const first = res[0] as [string, StreamEntry[]] | undefined;
    return first?.[1] ?? [];
  }
  if (typeof res === 'object') return ((Object.values(res as Record<string, StreamEntry[]>)[0]) ?? []);
  return [];
}

function fieldsToMessage(channel: string, fields: string[], deliveryCount: number): TransportMessage {
  const headers: Record<string, string> = {};
  let body = '';
  let key: string | undefined;
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const name = fields[i];
    const value = fields[i + 1];
    if (name === 'body') body = value;
    else if (name === 'key') key = value;
    else if (name.startsWith('h:')) headers[name.slice(2)] = value;
  }
  return { channel, key, body, headers, deliveryCount };
}

/** Redis Streams transport. */
export class RedisStreamsTransport implements Transport {
  readonly name = 'redis-streams';
  private readonly client: Redis;
  private readonly ownsClient: boolean;
  private readonly maxLen: number;
  private readonly blockMs: number;
  private readonly batchSize: number;
  private readonly claimIdleMs: number;
  private readonly consumerName: string;
  private readonly onError: (error: unknown) => void;
  private readonly readers = new Set<Redis>();
  private readonly loops = new Set<Promise<void>>();
  private closed = false;

  constructor(options: RedisStreamsOptions = {}) {
    this.ownsClient = !options.client;
    this.client = options.client ?? new Redis(options.url ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
    if (this.ownsClient) this.client.on('error', error => (options.onError ?? (() => undefined))(error));
    this.maxLen = options.maxLen ?? 100_000;
    this.blockMs = options.blockMs ?? 1000;
    this.batchSize = options.batchSize ?? 10;
    this.claimIdleMs = options.claimIdleMs ?? 30_000;
    this.consumerName = options.consumerName ?? `${process.env.HOSTNAME ?? 'consumer'}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    this.onError = options.onError ?? (() => undefined);
  }

  async publish(channel: string, body: string, headers: Record<string, string>, key?: string): Promise<void> {
    if (this.closed) throw new Error('transport is closed');
    const args: string[] = [channel, 'MAXLEN', '~', String(this.maxLen), '*', 'body', body];
    if (key !== undefined) args.push('key', key);
    for (const [name, value] of Object.entries(headers)) args.push(`h:${name}`, value);
    await this.client.call('XADD', ...args);
  }

  async subscribe(channel: string, group: string, handler: MessageHandler, options: SubscribeOptions = {}): Promise<Subscription> {
    if (this.closed) throw new Error('transport is closed');
    try {
      await this.client.call('XGROUP', 'CREATE', channel, group, options.startFrom === 'beginning' ? '0' : '$', 'MKSTREAM');
    } catch (error) {
      if (!String((error as Error).message).includes('BUSYGROUP')) throw error;
    }
    const reader = this.client.duplicate();
    reader.on('error', error => this.onError(error));
    this.readers.add(reader);
    let stopped = false;
    const consumer = this.consumerName;

    const handleEntries = async (entries: StreamEntry[], deliveryOf: (id: string) => Promise<number>): Promise<void> => {
      for (const [id, fields] of entries) {
        if (stopped) return;
        if (!fields) {
          // entry was trimmed/deleted but is still pending: drop it
          await this.client.call('XACK', channel, group, id);
          continue;
        }
        const message = fieldsToMessage(channel, fields, await deliveryOf(id));
        try {
          await handler(message);
          await this.client.call('XACK', channel, group, id);
        } catch (error) {
          this.onError(error); // stays pending; redelivered after claimIdleMs or on restart
        }
      }
    };

    const deliveries = async (id: string): Promise<number> => {
      try {
        const rows = (await this.client.call('XPENDING', channel, group, id, id, '1')) as [string, string, number, number][];
        return Number(rows[0]?.[3] ?? 1);
      } catch {
        return 1;
      }
    };

    const loop = (async () => {
      let lastClaim = Date.now();
      // 1. our own un-acked backlog (restart recovery)
      let backlogDone = false;
      while (!stopped && !this.closed) {
        try {
          if (!backlogDone) {
            const entries = entriesOf(await reader.call('XREADGROUP', 'GROUP', group, consumer, 'COUNT', String(this.batchSize), 'STREAMS', channel, '0'));
            if (entries.length === 0) backlogDone = true;
            else await handleEntries(entries, deliveries);
            continue;
          }
          // 2. take over messages stuck on other consumers
          if (Date.now() - lastClaim >= Math.max(500, this.claimIdleMs / 2)) {
            lastClaim = Date.now();
            const claimed = (await reader.call('XAUTOCLAIM', channel, group, consumer, String(this.claimIdleMs), '0-0', 'COUNT', String(this.batchSize))) as [string, StreamEntry[]];
            const entries = claimed?.[1] ?? [];
            if (entries.length > 0) await handleEntries(entries, deliveries);
          }
          // 3. new messages
          const entries = entriesOf(await reader.call('XREADGROUP', 'GROUP', group, consumer, 'COUNT', String(this.batchSize), 'BLOCK', String(this.blockMs), 'STREAMS', channel, '>'));
          if (entries.length > 0) await handleEntries(entries, async () => 1);
        } catch (error) {
          if (stopped || this.closed) break;
          this.onError(error);
          await new Promise(r => setTimeout(r, 250));
        }
      }
    })();
    this.loops.add(loop);
    void loop.finally(() => this.loops.delete(loop));

    return {
      stop: async () => {
        stopped = true;
        await loop;
        this.readers.delete(reader);
        reader.disconnect();
      },
    };
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.allSettled([...this.loops]);
    for (const r of this.readers) r.disconnect();
    this.readers.clear();
    if (this.ownsClient) this.client.disconnect();
  }
}
