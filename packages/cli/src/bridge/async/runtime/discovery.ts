// Cross-language service discovery. The same three sources, in the same order,
// are implemented by the Python runtime:
//   1. environment   <NAME>_URL | <NAME>_ADDR (host:port) | <NAME>_HOST + <NAME>_PORT
//   2. registry file services.registry.json (path: $SERVICE_REGISTRY, default ./services.registry.json)
//   3. DNS SRV        _<name>._tcp.$SERVICE_DISCOVERY_DOMAIN

import * as dns from 'dns';
import * as fs from 'fs';

/** Where an endpoint was found. */
export type DiscoverySource = 'env' | 'registry' | 'dns-srv';

/** A resolved service endpoint. */
export interface Endpoint {
  name: string;
  /** Full URL when known (e.g. `redis://broker:6379`, `http://orders:9090`). */
  url?: string;
  host?: string;
  port?: number;
  source: DiscoverySource;
  /** SRV priority (lower first) and weight (higher preferred). */
  priority?: number;
  weight?: number;
}

/** Thrown when no source knows the service. */
export class ServiceNotFoundError extends Error {
  constructor(readonly service: string, readonly tried: string[]) {
    super(`service "${service}" not found (tried: ${tried.join(', ')})`);
    this.name = 'ServiceNotFoundError';
  }
}

/** SRV record as returned by dns.resolveSrv. */
export interface SrvRecord {
  name: string;
  port: number;
  priority: number;
  weight: number;
}

/** Discovery configuration. */
export interface DiscoveryOptions {
  env?: NodeJS.ProcessEnv;
  /** Registry file path (default: $SERVICE_REGISTRY or ./services.registry.json). */
  registryPath?: string;
  /** SRV domain (default: $SERVICE_DISCOVERY_DOMAIN); SRV is skipped when unset. */
  srvDomain?: string;
  /** Injectable SRV resolver (default: dns.promises.resolveSrv). */
  resolveSrv?: (name: string) => Promise<SrvRecord[]>;
  /** Injectable file reader. */
  readFile?: (path: string) => string;
  /** How long resolved endpoints are cached (default 30_000 ms; 0 disables). */
  cacheTtlMs?: number;
  now?: () => number;
}

interface RegistryEntry {
  url?: string;
  host?: string;
  port?: number;
  instances?: { url?: string; host?: string; port?: number }[];
}

/** `orders-api` -> `ORDERS_API`. */
export function envName(service: string): string {
  return service.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

/** Resolves service names to endpoints through env, registry file and DNS SRV. */
export class ServiceDiscovery {
  private readonly env: NodeJS.ProcessEnv;
  private readonly cache = new Map<string, { at: number; endpoints: Endpoint[] }>();
  private readonly ttl: number;
  private readonly now: () => number;

  constructor(private readonly options: DiscoveryOptions = {}) {
    this.env = options.env ?? process.env;
    this.ttl = options.cacheTtlMs ?? 30_000;
    this.now = options.now ?? Date.now;
  }

  private fromEnv(service: string): Endpoint[] {
    const key = envName(service);
    const url = this.env[`${key}_URL`];
    if (url) return [{ name: service, url, source: 'env' }];
    const addr = this.env[`${key}_ADDR`];
    if (addr) {
      const [host, port] = addr.split(':');
      return [{ name: service, host, port: port ? Number(port) : undefined, url: addr, source: 'env' }];
    }
    const host = this.env[`${key}_HOST`];
    if (host) {
      const port = this.env[`${key}_PORT`];
      return [{ name: service, host, port: port ? Number(port) : undefined, source: 'env' }];
    }
    return [];
  }

  private fromRegistry(service: string): Endpoint[] {
    const file = this.options.registryPath ?? this.env.SERVICE_REGISTRY ?? './services.registry.json';
    let text: string;
    try {
      text = (this.options.readFile ?? ((p: string) => fs.readFileSync(p, 'utf8')))(file);
    } catch {
      return [];
    }
    let doc: { services?: Record<string, RegistryEntry> };
    try {
      doc = JSON.parse(text);
    } catch {
      throw new Error(`service registry ${file} is not valid JSON`);
    }
    const entry = doc.services?.[service];
    if (!entry) return [];
    const list = entry.instances?.length ? entry.instances : [entry];
    return list.map(i => ({ name: service, url: i.url, host: i.host, port: i.port, source: 'registry' as const }));
  }

  private async fromSrv(service: string): Promise<Endpoint[]> {
    const domain = this.options.srvDomain ?? this.env.SERVICE_DISCOVERY_DOMAIN;
    if (!domain) return [];
    const resolve = this.options.resolveSrv ?? ((n: string) => dns.promises.resolveSrv(n));
    let records: SrvRecord[];
    try {
      records = await resolve(`_${service}._tcp.${domain}`);
    } catch {
      return [];
    }
    return [...records]
      .sort((a, b) => a.priority - b.priority || b.weight - a.weight)
      .map(r => ({
        name: service,
        host: r.name,
        port: r.port,
        url: `tcp://${r.name}:${r.port}`,
        source: 'dns-srv' as const,
        priority: r.priority,
        weight: r.weight,
      }));
  }

  /** All endpoints of the first source that knows `service`. @throws ServiceNotFoundError */
  async resolveAll(service: string): Promise<Endpoint[]> {
    const cached = this.cache.get(service);
    if (cached && this.ttl > 0 && this.now() - cached.at < this.ttl) return cached.endpoints;
    const tried: string[] = [];
    let endpoints = this.fromEnv(service);
    tried.push(`env ${envName(service)}_URL`);
    if (endpoints.length === 0) {
      endpoints = this.fromRegistry(service);
      tried.push(`registry ${this.options.registryPath ?? this.env.SERVICE_REGISTRY ?? './services.registry.json'}`);
    }
    if (endpoints.length === 0) {
      endpoints = await this.fromSrv(service);
      tried.push(this.options.srvDomain ?? this.env.SERVICE_DISCOVERY_DOMAIN ? `dns-srv _${service}._tcp.${this.options.srvDomain ?? this.env.SERVICE_DISCOVERY_DOMAIN}` : 'dns-srv (SERVICE_DISCOVERY_DOMAIN unset)');
    }
    if (endpoints.length === 0) throw new ServiceNotFoundError(service, tried);
    if (this.ttl > 0) this.cache.set(service, { at: this.now(), endpoints });
    return endpoints;
  }

  /** The preferred endpoint of `service`. @throws ServiceNotFoundError */
  async resolve(service: string): Promise<Endpoint> {
    return (await this.resolveAll(service))[0];
  }

  /** Drop cached results (all, or one service). */
  invalidate(service?: string): void {
    if (service) this.cache.delete(service);
    else this.cache.clear();
  }
}
